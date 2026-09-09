# 시니어 청취 보조 EQ 프리셋 MVP

`BALANCED`와 `CLEAR_SPEECH` 두 가지 TTS 음색 프리셋만 제공합니다. 이는 의료적 청력 보정이나 진단 기능이 아닙니다.

- `CLEAR_SPEECH`: 120Hz high-pass(Q 0.707), 2500Hz peaking(+4dB, Q 0.9), compressor를 Azure TTS의 Web Audio 출력에 적용합니다.
- 설정은 `gwipyeonhan.voice-eq-preset.v1.<userId>` localStorage에만 저장합니다. 같은 기기/브라우저에서만 유지되며 서버 voice-settings API payload에는 포함하지 않습니다.
- Azure TTS 또는 Web Audio를 쓸 수 없으면 기존 브라우저 TTS로 재생합니다. 이 경로에서는 EQ 적용을 보장하지 않습니다.
- 기기 미디어 볼륨, 블루투스, 보청기 설정은 변경하지 않습니다.
