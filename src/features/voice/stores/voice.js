import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'

import { normalizeApiError } from '../../../shared/api/errors.js'
import { loadAuthSession } from '../../../shared/services/authStorage.js'
import { voiceApi } from '../api/voice.js'
import { isSpeechSupported, speak, stop as cancelSpeech } from '../services/speech.js'
import {
  STT_MODE,
  TEXT_INPUT_CONFIDENCE,
  abortSpeechCapture,
  captureSpeech,
} from '../services/voiceStt.js'
import { createTransferVoiceController } from '../services/voiceTransferController.js'
import { DEFAULT_VOICE_SETTINGS, normalizeVoiceSettings } from '../model/settings.js'
import { DEFAULT_EQ_PRESET, normalizeEqPreset } from '../model/eqPreset.js'
import { loadEqPreset, saveEqPreset } from '../services/eqPresetStorage.js'

/** Azure 토큰이 이 시간 안에 만료되면 재생 전에 새로 받는다. */
const SPEECH_TOKEN_REFRESH_MARGIN_MS = 60_000

/** 서버가 화면 조작을 허용하는 카드 종류다. */
const SELECTABLE_CARD_TYPES = ['RECIPIENT_CANDIDATES', 'AMOUNT_RECONFIRM']

export const TRANSFER_VOICE_PHASE = Object.freeze({
  IDLE: 'IDLE',
  TTS_PLAYING: 'TTS_PLAYING',
  BARGE_IN_PENDING: 'BARGE_IN_PENDING',
  WAITING_CANCELLED: 'WAITING_CANCELLED',
  WAITING_START_ACK: 'WAITING_START_ACK',
  STREAMING: 'STREAMING',
  WAITING_STOP_ACK: 'WAITING_STOP_ACK',
  WAITING_TURN_RESPONSE: 'WAITING_TURN_RESPONSE',
  TEXT_FALLBACK: 'TEXT_FALLBACK',
})

export const useVoiceStore = defineStore('voice', () => {
  const sessionId = ref('')
  const session = ref(null)
  const lastTurn = ref(null)
  const lastEvent = ref(null)
  const speechToken = ref(null)
  const listening = ref(false)
  const speaking = ref(false)
  const transcript = ref('')
  const partialTranscript = ref('')
  const settings = reactive({ ...DEFAULT_VOICE_SETTINGS })
  const draftSettings = reactive({ ...DEFAULT_VOICE_SETTINGS })
  const settingsLoaded = ref(false)
  const eqPreset = ref(DEFAULT_EQ_PRESET)
  const draftEqPreset = ref(DEFAULT_EQ_PRESET)
  const error = ref(null)
  const busy = ref(false)
  const transferPhase = ref(TRANSFER_VOICE_PHASE.IDLE)

  const sttMode = computed(() => session.value?.sttMode ?? STT_MODE.CLIENT)
  const usesBackendStream = computed(() => sttMode.value === STT_MODE.BACKEND_STREAM)
  const currentStep = computed(() => lastTurn.value?.state || session.value?.currentStep || '')
  const ttsText = computed(() => lastTurn.value?.ttsText || session.value?.firstPrompt || '')
  const ttsSsml = computed(() => lastTurn.value?.ttsSsml || '')
  const displayCard = computed(() => lastTurn.value?.displayCard ?? null)
  const requiredSlot = computed(() => lastTurn.value?.requiredSlot ?? null)
  const draftSummary = computed(() => lastTurn.value?.draftSummary ?? null)
  const nextAction = computed(() => lastTurn.value?.nextAction || '')
  const slots = computed(() => lastTurn.value?.slots ?? {})
  const sessionClosed = computed(() => ['CLOSED', 'EXPIRED'].includes(session.value?.status ?? ''))

  const cardItems = computed(() => {
    const items = displayCard.value?.items
    return Array.isArray(items) ? items : []
  })
  /** 후보를 고르는 카드만 화면에서 조작한다. 읽어주기·위험 카드는 표시만 한다. */
  const selectableCard = computed(() =>
    SELECTABLE_CARD_TYPES.includes(displayCard.value?.type ?? '') && cardItems.value.length
      ? displayCard.value
      : null,
  )
  const focusedItemId = computed(() => displayCard.value?.focusedItemId ?? '')
  /** 서버가 흐름을 끝냈다는 신호. 종료 안내를 읽고 홈으로 보낸다. */
  const flowCancelled = computed(
    () => currentStep.value === 'CANCELLED' || nextAction.value === 'END_SESSION',
  )

  function toUserError(cause) {
    // axios 오류도 응답 없이 code와 message를 가진다. createSttError가 표식을 남긴
    // 로컬 오류만 그대로 쓰고, 나머지는 normalizeApiError가 사용자 문구로 바꾼다.
    if (cause?.isLocalError && cause?.code && cause?.message) {
      return {
        status: null,
        code: cause.code,
        message: cause.message,
        requestId: null,
        fieldErrors: [],
      }
    }
    return normalizeApiError(cause)
  }

  async function run(request) {
    busy.value = true
    error.value = null
    try {
      return await request()
    } catch (cause) {
      error.value = toUserError(cause)
      throw error.value
    } finally {
      busy.value = false
    }
  }

  function createTurnId() {
    const randomUUID = globalThis.crypto?.randomUUID
    if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = (Math.random() * 16) | 0
      const value = character === 'x' ? random : (random & 0x3) | 0x8
      return value.toString(16)
    })
  }
  /** 발화 세대. 취소된 이전 발화가 최신 발화의 상태를 덮어쓰지 않게 한다. */
  let speakGeneration = 0
  let transferController = null
  let transferVoiceEnabled = false
  let transferPending = null
  // TTS 중 생성한 모니터의 늦은 완료/실패가 이후 사용자 입력용 컨트롤러를 정리하지 않게 한다.
  let transferMonitorOwner = null

  function transferUserError(cause) {
    const normalized = toUserError(cause)
    error.value = normalized
    listening.value = false
    busy.value = false
    transferPhase.value = TRANSFER_VOICE_PHASE.TEXT_FALLBACK

    const pending = transferPending
    if (pending) {
      transferPending = null
      pending.reject(normalized)
    }
    return normalized
  }

  function createTransferPending() {
    if (transferPending) return transferPending

    let resolvePending
    let rejectPending
    const responsePromise = new Promise((resolve, reject) => {
      resolvePending = resolve
      rejectPending = reject
    })
    transferPending = {
      promise: responsePromise,
      inputTurnId: '',
      resolve: resolvePending,
      reject: rejectPending,
    }
    return transferPending
  }

  function getTransferController() {
    if (transferController) return transferController

    transferController = createTransferVoiceController({
      getSessionId: () => sessionId.value,
      // BACKEND_STREAM의 BARGE_IN(AI_TTS)은 AI 응답 turn ID만 허용한다.
      // data.turnId는 사용자 입력(inputTurnId)이므로 대체값으로 쓰면 안 된다.
      getCurrentTurnId: () => lastTurn.value?.aiTurnId ?? '',
      isSpeaking: () => speaking.value,
      issueStreamTicket: (id) => voiceApi.issueStreamTicket(id),
      onBeforeBargeIn: () => {
        transferPhase.value = TRANSFER_VOICE_PHASE.BARGE_IN_PENDING
        busy.value = true
        silence()
      },
      onBargeInPending: () => {
        transferPhase.value = TRANSFER_VOICE_PHASE.WAITING_CANCELLED
        busy.value = true
      },
      onBargeInReady: () => {},
      onStartPending: ({ newInputTurnId }) => {
        const pending = createTransferPending()
        transferPhase.value = TRANSFER_VOICE_PHASE.WAITING_START_ACK
        pending.inputTurnId = newInputTurnId
      },
      onStartReady: ({ inputTurnId }) => {
        if (transferPending?.inputTurnId === inputTurnId) {
          transferPhase.value = TRANSFER_VOICE_PHASE.STREAMING
        }
      },
      onInputStart: ({ newInputTurnId }) => {
        partialTranscript.value = ''
        transcript.value = ''
        listening.value = true
        busy.value = true
        error.value = null
        transferPhase.value = TRANSFER_VOICE_PHASE.WAITING_START_ACK
        const pending = createTransferPending()
        pending.inputTurnId = newInputTurnId
      },
      onInputEnd: () => {
        listening.value = false
      },
      onStopPending: ({ inputTurnId }) => {
        if (transferPending?.inputTurnId === inputTurnId) {
          transferPhase.value = TRANSFER_VOICE_PHASE.WAITING_STOP_ACK
        }
      },
      onStopAck: ({ inputTurnId }) => {
        if (transferPending?.inputTurnId === inputTurnId) {
          transferPhase.value = TRANSFER_VOICE_PHASE.WAITING_TURN_RESPONSE
        }
      },
      onPartial: ({ inputTurnId, text }) => {
        if (transferPending?.inputTurnId !== inputTurnId) return
        partialTranscript.value = text
      },
      onFinal: ({ inputTurnId, text }) => {
        if (transferPending?.inputTurnId !== inputTurnId) return
        transcript.value = text
        partialTranscript.value = ''
      },
      onTurnResponse: ({ inputTurnId, data }) => {
        const pending = transferPending
        if (!pending || pending.inputTurnId !== inputTurnId) return

        const turn = {
          ...(data || {}),
          inputTurnId,
          turnId: data?.turnId ?? data?.aiTurnId ?? '',
          aiTurnId: data?.aiTurnId ?? '',
        }
        partialTranscript.value = ''
        listening.value = false
        busy.value = false
        transferPending = null

        // 신규 계약에서 data.turnId는 inputTurnId다. AI 응답 ID가 없는 상태로
        // 다음 발화를 받으면 BARGE_IN이 잘못된 대상을 취소할 수 있으므로, 음성
        // 스트림은 여기서 멈추고 카드/텍스트 입력으로만 이어 간다.
        if (!turn.aiTurnId) {
          lastTurn.value = turn
          const missingAiTurnError = {
            isLocalError: true,
            code: 'VOICE_AI_TURN_MISSING',
            message: '음성 응답을 확인하지 못했어요. 아래에서 글자로 입력해 주세요.',
          }
          transferUserError(missingAiTurnError)
          void stopVoiceResources()
          // listenAndSendTransferTurn도 이 오류를 한 번 더 정규화하므로 로컬
          // 오류 표식을 유지한 원본을 거절한다.
          pending.reject(missingAiTurnError)
          return
        }

        transferPhase.value = turn.ttsText
          ? TRANSFER_VOICE_PHASE.TTS_PLAYING
          : TRANSFER_VOICE_PHASE.IDLE
        applyTurn(turn)
        pending.resolve(turn)
      },
      onCancelled: (event) => {
        if (event?.target === 'AI_TTS') {
          transferPhase.value = TRANSFER_VOICE_PHASE.WAITING_CANCELLED
        }
      },
      onError: (cause) => {
        transferUserError(cause)
        void closeTransferResources()
      },
    })

    return transferController
  }

  async function startTransferMonitor(owner) {
    if (!usesBackendStream.value || !transferVoiceEnabled || !sessionId.value) return null

    const controller = getTransferController()
    try {
      return await controller.startMonitoring()
    } catch (cause) {
      // 안내 TTS가 끝났거나 새 입력이 시작되면 이 모니터는 더 이상 현재 흐름의 소유자가 아니다.
      if (transferMonitorOwner !== owner || transferController !== controller) return null
      transferUserError(cause)
      await closeTransferResources(cause, controller)
      return null
    }
  }

  async function closeTransferResources(cause = null, expectedController = null) {
    if (expectedController && transferController !== expectedController) return false

    const controller = transferController
    transferController = null
    transferMonitorOwner = null
    partialTranscript.value = ''

    const pending = transferPending
    transferPending = null
    if (pending) {
      const normalized = toUserError(
        cause || {
          isLocalError: true,
          code: 'VOICE_STREAM_DISCONNECTED',
          message: '음성 연결이 끊겼어요. 다시 말씀해 주세요.',
        },
      )
      error.value = normalized
      pending.reject(normalized)
    }

    await controller?.close?.().catch(() => {})
    return Boolean(controller)
  }

  async function stopVoiceResources() {
    transferVoiceEnabled = false
    await closeTransferResources()
    if (transferPhase.value !== TRANSFER_VOICE_PHASE.TEXT_FALLBACK) {
      transferPhase.value = TRANSFER_VOICE_PHASE.IDLE
    }
  }
  function silence() {
    cancelSpeech()
    speakGeneration += 1
    speaking.value = false
  }

  /** 입력 시작 시 TTS를 끊고, 모드에 맞는 서버 취소 신호를 보낸다. */
  async function interruptForInput() {
    const interruptedSessionId = sessionId.value
    // 일반 CLIENT 모드는 기존 turn ID를 서버 이벤트에 보낸다.
    const interruptedTurnId = lastTurn.value?.turnId ?? ''
    // BACKEND_STREAM의 AI_TTS 취소에는 AI 응답 turn ID만 쓴다.
    const interruptedAiTurnId = lastTurn.value?.aiTurnId ?? ''
    const shouldInvalidateClientTurn =
      speaking.value &&
      !usesBackendStream.value &&
      Boolean(interruptedSessionId && interruptedTurnId)
    const shouldBargeInTransfer =
      speaking.value &&
      usesBackendStream.value &&
      transferVoiceEnabled &&
      Boolean(interruptedSessionId && interruptedAiTurnId)

    // 사용자가 입력을 시작하면 직전 TTS 모니터의 늦은 정리가 새 스트림에 관여하면 안 된다.
    if (usesBackendStream.value) transferMonitorOwner = null

    // TTS는 서버 ACK를 기다리지 않고 즉시 중단한다. 단, 새 START는
    // BARGE_IN의 CANCELLED.readyForStart=true가 도착한 뒤에만 컨트롤러가 보낸다.
    if (shouldBargeInTransfer) {
      transferPhase.value = TRANSFER_VOICE_PHASE.BARGE_IN_PENDING
      silence()
      try {
        await getTransferController().bargeIn(interruptedAiTurnId)
      } catch (cause) {
        transferPhase.value = TRANSFER_VOICE_PHASE.TEXT_FALLBACK
        await closeTransferResources(cause)
        throw cause
      }
      return null
    }

    silence()
    if (!shouldInvalidateClientTurn) return null

    try {
      return await voiceApi.event(interruptedSessionId, {
        eventType: 'INTERRUPTED',
        turnId: interruptedTurnId,
      })
    } catch {
      // 로컬 TTS 중단과 새 입력은 서버 이벤트 실패와 무관하게 계속한다.
      return null
    }
  }

  function isCredentialUsable(credential) {
    if (!credential?.token || !credential?.region) return false

    const expiresAt = Date.parse(credential.expiresAt ?? '')
    if (!Number.isFinite(expiresAt)) return true
    return expiresAt - Date.now() > SPEECH_TOKEN_REFRESH_MARGIN_MS
  }

  /**
   * Azure 토큰은 최대 9분이라 재생 전에 만료가 임박했으면 새로 받는다.
   * 실패해도 브라우저 음성으로 읽을 수 있으므로 오류로 처리하지 않는다.
   */
  async function ensureSpeechCredential() {
    if (isCredentialUsable(speechToken.value)) return speechToken.value

    try {
      speechToken.value = await voiceApi.issueSpeechToken()
    } catch {
      speechToken.value = null
    }
    return speechToken.value
  }

  async function speakText(text, ssml, settingsOverride) {
    const content = String(text ?? '').trim()
    if (!content) return { spoken: false, reason: 'EMPTY_TEXT' }

    speakGeneration += 1
    const generation = speakGeneration
    const monitorOwner = {}
    speaking.value = true
    if (usesBackendStream.value && transferVoiceEnabled) {
      transferPhase.value = TRANSFER_VOICE_PHASE.TTS_PLAYING
      transferMonitorOwner = monitorOwner
      startTransferMonitor(monitorOwner).catch(() => {})
    }
    try {
      const credential = await ensureSpeechCredential()
      if (generation !== speakGeneration) return { spoken: false, reason: 'STOPPED' }
      if (!credential && !isSpeechSupported()) return { spoken: false, reason: 'UNSUPPORTED' }

      const playbackSettings = settingsOverride || settings
      return await speak(content, {
        ...playbackSettings,
        eqPreset: normalizeEqPreset(settingsOverride?.eqPreset ?? eqPreset.value),
        ttsSsml: ssml,
        speechCredential: credential,
      })
    } finally {
      // 더 최신 발화가 시작됐다면 상태는 그쪽이 관리한다.
      if (generation === speakGeneration) {
        speaking.value = false
        if (usesBackendStream.value && transferVoiceEnabled) {
          if (transferMonitorOwner === monitorOwner) {
            await closeTransferResources()
          }
          if (transferPhase.value === TRANSFER_VOICE_PHASE.TTS_PLAYING) {
            transferPhase.value = TRANSFER_VOICE_PHASE.IDLE
          }
        }
      }
    }
  }

  function speakLatest() {
    return speakText(ttsText.value, ttsSsml.value)
  }

  function applyTurn(turn) {
    lastTurn.value = turn
    speakLatest().catch(() => {})
    return turn
  }

  async function startSession(entryPoint = 'GENERAL_FINANCE') {
    const response = await run(() => voiceApi.createSession({ entryPoint }))
    session.value = response
    sessionId.value = response?.sessionId ?? ''
    transferVoiceEnabled = response?.sttMode === STT_MODE.BACKEND_STREAM
    lastTurn.value = null
    transcript.value = ''
    partialTranscript.value = ''
    if (response?.firstPrompt) speakText(response.firstPrompt).catch(() => {})
    return response
  }

  async function loadSession(id = sessionId.value) {
    const response = await run(() => voiceApi.getSession(id))
    session.value = response
    sessionId.value = response?.sessionId ?? id
    transferVoiceEnabled = response?.sttMode === STT_MODE.BACKEND_STREAM
    return response
  }

  async function sendTurn(request) {
    const response = await run(() => voiceApi.sendTurn(sessionId.value, request))
    return applyTurn(response)
  }

  /** 송금은 오디오 프레임을 WebSocket으로 보내고 소켓 턴 응답을 기다린다. */
  async function listenAndSendTransferTurn() {
    try {
      await interruptForInput()
    } catch (cause) {
      const normalized = transferUserError(cause)
      await closeTransferResources(cause)
      throw normalized
    }
    busy.value = true
    listening.value = false
    error.value = null
    partialTranscript.value = ''
    transferVoiceEnabled = true

    const responsePromise = createTransferPending().promise

    try {
      const turnId = await getTransferController().startInput()
      if (!turnId) {
        throw {
          isLocalError: true,
          code: 'VOICE_STREAM_UNAVAILABLE',
          message: '음성 연결이 되지 않았어요. 화면 단추로 진행해 주세요.',
        }
      }
      return await responsePromise
    } catch (cause) {
      const normalized = transferUserError(cause)
      await closeTransferResources(cause)
      error.value = normalized
      throw normalized
    } finally {
      if (transferPending?.promise === responsePromise) transferPending = null
      listening.value = false
      busy.value = false
    }
  }

  /** 한 번 듣고 그 발화를 서버에 보낸다. 듣기 직전 재생 중인 안내를 끊는다. */
  async function listenAndSendTurn() {
    if (usesBackendStream.value) return listenAndSendTransferTurn()
    await interruptForInput()
    busy.value = true
    listening.value = true
    error.value = null

    try {
      const captured = await captureSpeech(sttMode.value)
      transcript.value = captured.transcript

      const turn = await voiceApi.sendTurn(sessionId.value, {
        turnId: createTurnId(),
        transcript: captured.transcript,
        sttConfidence: captured.confidence,
        inputType: 'VOICE',
      })
      return applyTurn(turn)
    } catch (cause) {
      error.value = toUserError(cause)
      throw error.value
    } finally {
      listening.value = false
      busy.value = false
    }
  }

  /** 음성이 어려울 때 쓰는 키보드 경로. */
  async function sendTextTurn(text) {
    const content = String(text ?? '').trim()
    if (!content) {
      error.value = toUserError({
        isLocalError: true,
        code: 'TEXT_INPUT_EMPTY',
        message: '내용을 입력해 주세요.',
      })
      throw error.value
    }

    try {
      await interruptForInput()
    } catch (cause) {
      const normalized = transferUserError(cause)
      await closeTransferResources(cause)
      throw normalized
    }
    if (usesBackendStream.value) {
      transferPhase.value = TRANSFER_VOICE_PHASE.TEXT_FALLBACK
      try {
        await transferController?.cancelForFallback?.()
      } catch {
        // 오디오 정리가 실패해도 capture/socket을 닫고 text fallback을 제공한다.
      }
      await stopVoiceResources()
      transferPhase.value = TRANSFER_VOICE_PHASE.TEXT_FALLBACK
    }
    transcript.value = content
    return sendTurn({
      turnId: createTurnId(),
      transcript: content,
      sttConfidence: TEXT_INPUT_CONFIDENCE,
      inputType: 'TEXT',
    })
  }

  function selectionActionType(card) {
    return card?.type === 'AMOUNT_RECONFIRM' ? 'SELECT_AMOUNT' : 'SELECT_RECIPIENT'
  }

  /**
   * 카드 액션을 보낸다. 서버는 actionId로 멱등 처리하고 cardVersion이 어긋나면 거부한다.
   * 응답은 턴과 같은 모양이라 기존 경로로 흘려 TTS까지 이어지게 한다.
   */
  async function sendUiAction(actionType, itemId = null) {
    const card = displayCard.value
    const sourceTurnId = lastTurn.value?.turnId

    if (!card?.cardId || !sourceTurnId) {
      error.value = toUserError({
        isLocalError: true,
        code: 'VOICE_CARD_MISSING',
        message: '화면 정보를 찾지 못했어요. 다시 말씀해 주세요.',
      })
      throw error.value
    }

    await interruptForInput()

    const request = {
      actionId: createTurnId(),
      actionType,
      cardId: card.cardId,
      cardVersion: card.cardVersion,
      sourceTurnId,
    }
    if (itemId) request.itemId = itemId

    const response = await run(() => voiceApi.uiAction(sessionId.value, request))
    return applyTurn({ ...response, turnId: response?.responseTurnId ?? sourceTurnId })
  }

  function selectCardItem(itemId) {
    return sendUiAction(selectionActionType(displayCard.value), itemId)
  }

  /**
   * 화면의 기본 선택은 확정이 아니다. 서버는 포커스가 없으면 승인을 거부하므로
   * 먼저 선택을 보내 포커스를 만든 뒤 승인한다.
   */
  async function acceptCardSelection(itemId) {
    if (itemId && itemId !== focusedItemId.value) await selectCardItem(itemId)
    return sendUiAction('ACCEPT_FOCUSED_SELECTION')
  }

  function rejectCardSelection() {
    return sendUiAction('REJECT_FOCUSED_SELECTION')
  }

  function cancelCardFlow() {
    return sendUiAction('CANCEL_FLOW')
  }

  async function sendEvent(request) {
    const response = await run(() => voiceApi.event(sessionId.value, request))
    lastEvent.value = response
    return response
  }

  /**
   * 다시 듣기. CLIENT 세션은 서버 REPLAY 이벤트로 원문을 다시 받고,
   * BACKEND_STREAM 세션은 REPLAY가 허용되지 않아 마지막 안내를 그대로 다시 읽는다.
   */
  async function replay() {
    silence()

    if (!usesBackendStream.value && sessionId.value && lastTurn.value?.turnId) {
      const response = await sendEvent({
        eventType: 'REPLAY',
        turnId: lastTurn.value.turnId,
      }).catch(() => null)

      const payload = response?.replayPayload
      if (payload?.ttsText) return speakText(payload.ttsText, payload.ttsSsml)
    }

    return speakLatest()
  }

  async function closeSession() {
    silence()
    await stopVoiceResources()
    await abortSpeechCapture()
    const response = await run(() => voiceApi.closeSession(sessionId.value))
    session.value = response
    return response
  }

  async function issueSpeechToken() {
    const response = await run(() => voiceApi.issueSpeechToken())
    speechToken.value = response
    return response
  }

  async function loadSettings(options = {}) {
    const force = options?.force === true
    if (settingsLoaded.value && !force) return { ...settings }

    const response = await run(() => voiceApi.getSettings())
    const nextSettings = normalizeVoiceSettings(response)
    Object.assign(settings, nextSettings)
    Object.assign(draftSettings, nextSettings)
    const authSession = await loadAuthSession().catch(() => null)
    const nextEqPreset = loadEqPreset(authSession?.userId)
    eqPreset.value = nextEqPreset
    draftEqPreset.value = nextEqPreset
    settingsLoaded.value = true
    return response
  }

  function updateDraftSettings(request) {
    Object.assign(draftSettings, normalizeVoiceSettings({ ...draftSettings, ...(request || {}) }))
  }

  function updateDraftEqPreset(preset) {
    draftEqPreset.value = normalizeEqPreset(preset)
  }

  function resetDraftSettings() {
    Object.assign(draftSettings, DEFAULT_VOICE_SETTINGS)
    draftEqPreset.value = DEFAULT_EQ_PRESET
  }

  function discardDraftSettings() {
    Object.assign(draftSettings, settings)
    draftEqPreset.value = eqPreset.value
  }

  async function saveSettings(request) {
    const payload = normalizeVoiceSettings({
      ...draftSettings,
      ...(request || {}),
    })
    const response = await run(() => voiceApi.updateSettings(payload))
    const nextSettings = normalizeVoiceSettings({ ...payload, ...(response || {}) })
    Object.assign(settings, nextSettings)
    Object.assign(draftSettings, nextSettings)
    const authSession = await loadAuthSession().catch(() => null)
    const nextEqPreset = saveEqPreset(authSession?.userId, draftEqPreset.value)
    eqPreset.value = nextEqPreset
    draftEqPreset.value = nextEqPreset
    settingsLoaded.value = true
    return response
  }

  function reset() {
    silence()
    void stopVoiceResources()
    sessionId.value = ''
    session.value = null
    lastTurn.value = null
    lastEvent.value = null
    speechToken.value = null
    listening.value = false
    transcript.value = ''
    partialTranscript.value = ''
    Object.assign(settings, DEFAULT_VOICE_SETTINGS)
    Object.assign(draftSettings, DEFAULT_VOICE_SETTINGS)
    eqPreset.value = DEFAULT_EQ_PRESET
    draftEqPreset.value = DEFAULT_EQ_PRESET
    settingsLoaded.value = false
    error.value = null
    busy.value = false
    transferPhase.value = TRANSFER_VOICE_PHASE.IDLE
  }

  return {
    sessionId,
    session,
    lastTurn,
    lastEvent,
    speechToken,
    listening,
    speaking,
    transcript,
    partialTranscript,
    transferPhase,
    settings,
    draftSettings,
    settingsLoaded,
    eqPreset,
    draftEqPreset,
    error,
    busy,
    sttMode,
    usesBackendStream,
    currentStep,
    ttsText,
    ttsSsml,
    displayCard,
    requiredSlot,
    draftSummary,
    nextAction,
    slots,
    sessionClosed,
    cardItems,
    selectableCard,
    focusedItemId,
    flowCancelled,
    startSession,
    loadSession,
    sendTurn,
    listenAndSendTurn,
    sendTextTurn,
    sendEvent,
    sendUiAction,
    selectCardItem,
    acceptCardSelection,
    rejectCardSelection,
    cancelCardFlow,
    replay,
    speakLatest,
    speakText,
    silence,
    stopVoiceResources,
    closeSession,
    issueSpeechToken,
    loadSettings,
    updateDraftSettings,
    updateDraftEqPreset,
    resetDraftSettings,
    discardDraftSettings,
    saveSettings,
    reset,
  }
})
