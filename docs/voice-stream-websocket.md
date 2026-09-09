# 송금 음성 스트리밍 WebSocket 전송 계층 설계

송금(`TRANSFER + BACKEND_STREAM`) 음성 인식의 **전송 계층** 설계 문서다.
현재 프론트에는 WebSocket 클라이언트가 존재하지 않는다.

기준 계약: `음성_구현_FE_BE_공통_개발가이드_2026-09-03.md` §4.3, §5.3 및
2026-09-09 백엔드 전달 내용.

## 1. 지금 상태

| 계층                     | 상태     | 위치                                      |
| ------------------------ | -------- | ----------------------------------------- |
| 마이크 캡처 → PCM 프레임 | 완료     | `features/voice/services/audioCapture.js` |
| 프레임을 서버로 전송     | **없음** | —                                         |
| 부분 전사 수신·표시      | **없음** | —                                         |
| 세션/턴 REST 연동        | 완료     | `features/voice/api/voice.js`             |

`captureSpeech()`는 `BACKEND_STREAM`이면 `STT_MODE_UNSUPPORTED`를 던지고 끝난다
(`voiceStt.js`). `VoiceConversationPanel`은 이 때문에 마이크 UI를 감추고
"송금 음성 인식은 아직 준비 중" 안내를 띄운다. 전송 계층이 붙기 전까지는
이 분기를 지우면 안 된다.

## 2. 확정된 서버 계약

### 2.1 엔드포인트

```text
ws(s)://{host}/api/voice/sessions/{sessionId}/stream
```

- `sessionId`는 path parameter이며 canonical UUID 문자열이어야 한다.
- 세션 소유자이고 `flowType=TRANSFER`, `sttMode=BACKEND_STREAM`일 때만 사용한다.
- 일반 금융(`CLIENT`)은 이 WebSocket을 쓰지 않는다.

### 2.2 인증 — 백엔드 미구현

브라우저 `WebSocket` 생성자는 커스텀 헤더를 넣을 수 없다. REST JWT 필터는
`Authorization: Bearer` 헤더만 읽으므로, 지금 브라우저에서 연결하면 인증
Principal이 없어 실패한다.

백엔드 권장안은 단수명·1회용 WS 티켓이다.

1. 로그인 JWT로 REST 티켓 발급 API 호출
2. 서버가 사용자·`sessionId`에 묶인 짧은 수명의 1회용 `wsTicket` 발급
3. WebSocket은 `Sec-WebSocket-Protocol`로 티켓 전달
4. 핸드셰이크에서 티켓 검증 후 Principal 설정, 사용된 티켓 폐기

`POST /api/voice/speech-token`은 Azure Speech 직접 연결용이므로 WS 인증
티켓으로 재사용하지 않는다.

**티켓 발급 엔드포인트와 핸드셰이크 인터셉터가 아직 없다. 이것이 구현을 막는
유일한 항목이다.**

### 2.3 클라이언트 → 서버

제어 메시지는 JSON이다.

```json
{ "type": "START", "turnId": "uuid" }
{ "type": "STOP", "turnId": "uuid" }
{ "type": "BARGE_IN", "turnId": "uuid" }
{ "type": "RESUME", "turnId": "uuid", "lastReceivedSequence": 12 }
```

오디오는 JSON이 아니라 binary frame이다.

```text
4바이트 unsigned big-endian sequence + PCM payload
```

- PCM 16 kHz / 16-bit / 모노, 리틀 엔디안
- frame당 PCM payload 최대 64 KiB
- `sequence`는 0부터 정확히 1씩 증가
- 발화 종료는 `STOP`이다. 서버가 Azure STT 입력을 멈추고 최종 결과를 처리한다.

`audioCapture.js`가 이미 이 형식대로 `ArrayBuffer`를 만들어 `onFrame`으로 넘긴다.
전송 계층은 그 프레임을 소켓으로 흘려보내면 된다.

### 2.4 서버 → 클라이언트

```json
{ "type": "PARTIAL_TRANSCRIPT", "turnId": "uuid", "text": "..." }
{ "type": "FINAL_TRANSCRIPT", "turnId": "uuid", "text": "...", "sttConfidence": 0.93 }
{ "type": "TURN_RESPONSE", "turnId": "uuid", "data": {} }
{ "type": "CANCEL_ACK", "turnId": "uuid" }
{
  "type": "ERROR",
  "code": "INVALID_REQUEST",
  "message": "요청값을 확인해 주세요.",
  "retryable": false,
  "requestId": "uuid"
}
```

`TURN_RESPONSE.data`는 Swagger의 `VoiceTurnResponse`다. 주요 필드는
`sessionId`, `turnId`, `state`, `intent`, `requestedFunction`, `slots`,
`confidence`, `ttsText`, `ttsSsml`, `displayCard`, `requiredSlot`,
`draftSummary`, `nextAction`이다. HTTP `/turns` 응답과 같은 구조이므로
**렌더링 경로를 공유해야 한다**(공통 가이드 §9.1).

### 2.5 종료·오류 정책 (현재 구현)

| 상황                                           | 서버 동작                                        |
| ---------------------------------------------- | ------------------------------------------------ |
| 핸드셰이크 이후 인증·세션 검증 실패            | `ERROR` 후 close **1008**                        |
| 오디오 sequence 불일치, 잘못된 제어 이벤트     | `ERROR(INVALID_REQUEST)`만. **소켓을 닫지 않음** |
| 재연결 sequence 불일치, 다른 사용자/turn, 만료 | `ERROR(VOICE_TURN_CONFLICT)`. 기존 스트림 폐기   |

sequence 불일치에서 소켓이 유지되므로, 클라이언트는 close 이벤트만 보고
복구를 판단하면 안 된다. `ERROR` 코드로도 분기해야 한다.

> 백엔드는 `ERROR(INVALID_REQUEST)` 후 1008 종료로 통일하는 안을 제안했으나
> 아직 확정이 아니다. 아래 설계는 **현재 구현(소켓 유지)** 기준이며, 통일되면
> close 처리 한 곳만 바꾸면 되도록 분리한다.

### 2.6 재연결

- 연결이 끊겨도 서버가 활성 STT 스트림을 **10초**간 메모리에 유지한다.
- 새 WS 연결 직후 같은 `turnId`와 `lastReceivedSequence`로 `RESUME`을 보낸다.
- `lastReceivedSequence`는 서버가 마지막으로 받은 번호와 정확히 일치해야 한다.
  아직 오디오를 보내지 않았으면 `-1`이다.
- 검증 성공 시 다음 번호부터 보낸다. `12` 뒤의 첫 binary frame은 `13`이다.
- 10초 초과·sequence 불일치·취소된 turn이면 이어받지 않고 **새 `turnId`로
  재발화**한다.
- 재연결은 자동으로 시도하며 사용자에게 sequence나 재연결 여부를 묻지 않는다.

## 3. 설계

### 3.1 새 모듈 `features/voice/services/voiceStream.js`

`audioCapture.js`(마이크)와 `voice.js` 스토어(세션 상태) 사이의 순수 전송 계층.
Vue도 Pinia도 모른다. 그래야 가짜 소켓으로 테스트할 수 있다.

```js
/**
 * @param {{
 *   sessionId: string,
 *   ticket: string,
 *   onPartial: (event: { turnId: string, text: string }) => void,
 *   onFinal: (event: { turnId: string, text: string, sttConfidence: number }) => void,
 *   onTurnResponse: (event: { turnId: string, data: object }) => void,
 *   onCancelAck: (event: { turnId: string }) => void,
 *   onError: (error: Error) => void,
 * }} options
 * @returns {Promise<{
 *   start: (turnId: string) => void,
 *   send: (frame: ArrayBuffer) => void,
 *   stop: (turnId: string) => void,
 *   bargeIn: (turnId: string) => void,
 *   close: () => Promise<void>,
 * }>}
 */
export async function openVoiceStream(options)
```

- 티켓은 1회용이므로 **재연결마다 새로 발급**받아야 한다. 모듈 안에서 재발급
  콜백을 받거나, 호출자가 매번 새 티켓으로 다시 연다.
- 소켓이 `OPEN`이 되기 전 도착한 프레임은 큐에 담았다가 순서대로 흘린다.
  마이크가 소켓보다 먼저 열릴 수 있다.
- 큐에 상한을 둔다. 소켓이 끝내 안 열리면 메모리를 계속 먹으면 안 된다.
- `bufferedAmount`가 임계치를 넘으면 프레임을 버린다. 느린 회선에서 지연이
  무한히 쌓이는 것보다 낫다. 단 서버가 sequence 연속을 요구하므로 **버리면 그
  턴은 이어갈 수 없다.** 버림이 발생하면 `STOP` 대신 새 `turnId`로 재발화를
  안내한다.
- 오류는 기존 `createSttError(code, message)`로 만들어 스토어의 `toUserError`가
  아는 모양으로 넘긴다. 새 오류 표현을 만들지 않는다.

### 3.2 sequence 소유권

`audioCapture.js`의 `createChunker`가 sequence를 0부터 매긴다. 재연결 시
`RESUME` 이후 이어서 보내야 하므로 **캡처를 멈추지 않고 소켓만 다시 여는**
구조여야 한다. 캡처를 재시작하면 sequence가 0으로 되감겨 서버가 거부한다.

캡처를 반드시 재시작해야 하는 상황이면 그 턴은 포기하고 새 `turnId`로 시작한다.

### 3.3 오류 코드 매핑

| 상황                     | 서버 신호                     | code                        | 사용자 문구                                           |
| ------------------------ | ----------------------------- | --------------------------- | ----------------------------------------------------- |
| 티켓 발급·소켓 연결 실패 | —                             | `VOICE_STREAM_UNAVAILABLE`  | 음성 연결이 되지 않았어요. 화면 단추로 진행해 주세요. |
| 인증·세션 검증 실패      | close 1008                    | `VOICE_STREAM_UNAUTHORIZED` | 다시 로그인해 주세요.                                 |
| 도중 끊김                | close ≠ 1008                  | `VOICE_STREAM_DISCONNECTED` | 연결이 끊겼어요. 다시 말씀해 주세요.                  |
| sequence·제어 오류       | `ERROR` `INVALID_REQUEST`     | `VOICE_STREAM_REJECTED`     | 음성을 보내지 못했어요. 다시 말씀해 주세요.           |
| 재연결 충돌              | `ERROR` `VOICE_TURN_CONFLICT` | `VOICE_TURN_CONFLICT`       | 다시 말씀해 주세요.                                   |

`retryable=false`인 오류는 자동 재시도하지 않는다(공통 가이드 §9.2).
모든 경로에 화면 단추 대체 수단이 남아 있어야 한다. 음성이 실패했다고 송금을
못 하게 되면 안 된다.

### 3.4 스토어 연결

`voice.js`의 `listenAndSendTurn()`은 "한 번 듣고 → 전사 받고 → `POST /turns`"
단발 구조다. `BACKEND_STREAM`은 듣는 동안 서버가 부분 전사를 밀어주고, 턴 응답도
소켓으로 온다. 분기를 하나 더 두되 **렌더링 경로는 공유한다**.

```text
CLIENT          : captureSpeech() → transcript → POST /turns → applyTurn()
BACKEND_STREAM  : openVoiceStream() + startTransferAudioCapture()
                  START(turnId)
                  → onPartial      : partialTranscript 갱신
                  → STOP(turnId)
                  → onFinal        : transcript 확정
                  → onTurnResponse : applyTurn(data)   ← 같은 함수
```

- 스토어에 `partialTranscript` ref를 새로 둔다. 확정본 `transcript`와 섞지 않는다.
- `BACKEND_STREAM`에서는 `POST /turns`를 호출하지 않는다. 턴 응답은 소켓의
  `TURN_RESPONSE`로 온다.
- `turnId`가 현재 발화와 다른 늦은 응답은 버린다(공통 가이드 §9.1).
- 바지인은 `BARGE_IN`으로 보낸다. HTTP `/events`로 보내지 않는다(공통 가이드 §1).
- `silence()`/`reset()`/화면 이탈 시 소켓과 마이크를 **둘 다** 닫는다.
  한쪽만 닫으면 마이크 표시등이 켜진 채 남는다.

### 3.5 화면

- `VoiceConversationPanel`의 `voiceCaptureReady`는 전송 계층이 붙은 뒤에 지운다.
- 부분 전사는 확정본과 시각적으로 구분한다. `reference.js`의
  `transfer-listening`에 이미 `.stt` / `.stt-caret` 마크업이 있고,
  `transfer-speaking`은 `.stt.done`이다. 이 구분을 그대로 쓴다.
- 금액·수취인은 부분 전사로 절대 확정하지 않는다. 서버 확정본만 쓴다.

## 4. 보안

- 티켓을 쿼리스트링에 넣지 않는다. `Sec-WebSocket-Protocol`로 보낸다.
  공통 가이드 §5.3도 "query string에 JWT를 넣지 않는다"고 정한다.
- `wss://`만 허용한다. `VITE_API_BASE_URL`이 `https`면 `wss`로 유도하고,
  `http`(로컬 개발)일 때만 `ws`를 허용한다.
- 소켓 URL·티켓·전사 내용을 콘솔에 로그로 남기지 않는다. 전사에 수취인과 금액이
  들어간다. PIN·confirmation token·전체 계좌번호는 WebSocket에 포함하지 않는다
  (공통 가이드 §9, LLM 계약 가이드 §5.3).

## 5. 테스트

가짜 소켓으로 검증한다.

- 프레임 sequence가 0부터 1씩 증가하는지
- 소켓이 열리기 전 프레임이 큐에 쌓였다가 순서대로 나가는지
- close 1008 → `VOICE_STREAM_UNAUTHORIZED`, 그 외 close → `DISCONNECTED`
- `ERROR(INVALID_REQUEST)`에 소켓이 살아 있어도 사용자 안내가 나오는지
- `RESUME`의 `lastReceivedSequence`가 마지막 전송 번호와 같은지, 오디오 전
  재연결이면 `-1`인지
- `onFinal`이 아니라 `onTurnResponse`로 화면이 갱신되는지
- 다른 `turnId`의 늦은 이벤트가 화면에 반영되지 않는지
- 화면 이탈 시 소켓과 마이크가 모두 닫히는지

## 6. 진행 순서

1. **백엔드 WS 티켓 발급 엔드포인트 + 핸드셰이크 인터셉터** ← 현재 여기서 막힘
2. `voiceStream.js` + 테스트
3. 스토어 `BACKEND_STREAM` 분기와 `partialTranscript`
4. 패널에서 `voiceCaptureReady` 제거, 부분 전사 표시
5. 실기기 확인 (웹 / Capacitor 안드로이드)

## 7. 문서 간 불일치 (확인 필요)

1. 공통 가이드 §4.3의 연결 예시는 `Authorization: Bearer {JWT}` 헤더 방식이다.
   이번 티켓 방식과 충돌하므로 공통 가이드도 갱신해야 한다.
2. 백엔드 전달 문구 "브라우저 WebSocket 생성자는 이 헤더를 넣을 수 있습니다"는
   바로 다음 문장("인증 Principal이 없어 실패합니다") 및 티켓 권장안과 모순된다.
   브라우저는 넣을 수 없다. 오타로 보인다.
3. 공통 가이드 §4.3의 `ERROR` 예시에는 `retryable`이 없지만 §9.2와 이번 전달에는
   있다. §4.3 예시가 낡았다.
4. sequence 불일치 시 close 여부가 미확정이다(2.5 참고).
