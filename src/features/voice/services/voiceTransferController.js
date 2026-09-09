import { createSttError, startTransferAudioCapture } from './voiceStt.js'
import { createVoiceActivityDetector } from './voiceVad.js'
import { openVoiceStream } from './voiceStream.js'

function ticketValue(value) {
  if (typeof value === 'string') return value.trim()
  return String(value?.wsTicket ?? value?.ticket ?? '').trim()
}

function inputTurnIdOf(event) {
  return String(event?.inputTurnId ?? '').trim()
}

function noop() {}

function streamUnavailableError() {
  return createSttError(
    'VOICE_STREAM_UNAVAILABLE',
    '음성 연결을 준비하지 못했어요. 다시 시도해 주세요.',
  )
}

// 16 kHz PCM 프레임은 약 100 ms다. Azure STT START_ACK 대기와 맞춰 최대 10초를 보관한다.
const MAX_PRE_ROLL_FRAMES = 100

function copyFrame(frame) {
  if (frame instanceof ArrayBuffer) return frame.slice(0)
  if (ArrayBuffer.isView(frame)) {
    return frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength)
  }
  return null
}

/**
 * 송금용 VAD, 마이크 캡처, WebSocket의 수명을 한 곳에서 조정한다.
 * Vue/Pinia 상태는 콜백으로만 전달해 가짜 의존성으로 턴 순서를 검증할 수 있게 한다.
 */
export function createTransferVoiceController(options = {}) {
  const getSessionId = options.getSessionId ?? (() => '')
  const getCurrentTurnId = options.getCurrentTurnId ?? (() => '')
  const isSpeaking = options.isSpeaking ?? (() => false)
  const issueStreamTicket = options.issueStreamTicket
  const createStream = options.createStream ?? openVoiceStream
  const createCapture = options.createCapture ?? startTransferAudioCapture
  const createVad = options.createVad ?? createVoiceActivityDetector
  const createTurnId = options.createTurnId ?? (() => globalThis.crypto?.randomUUID?.() ?? '')

  const onBeforeBargeIn = options.onBeforeBargeIn ?? noop
  const onBargeInPending = options.onBargeInPending ?? noop
  const onBargeInReady = options.onBargeInReady ?? noop
  const onInputStart = options.onInputStart ?? noop
  const onStartPending = options.onStartPending ?? noop
  const onStartReady = options.onStartReady ?? noop
  const onInputEnd = options.onInputEnd ?? noop
  const onStopPending = options.onStopPending ?? noop
  const onStopAck = options.onStopAck ?? noop
  const onPartial = options.onPartial ?? noop
  const onFinal = options.onFinal ?? noop
  const onTurnResponse = options.onTurnResponse ?? noop
  const onCancelled = options.onCancelled ?? noop
  const onCancelAck = options.onCancelAck ?? noop
  const onError = options.onError ?? noop

  if (typeof issueStreamTicket !== 'function') {
    throw new TypeError('issueStreamTicket is required')
  }

  let stream = null
  let streamPromise = null
  let capture = null
  let capturePromise = null
  const vad = createVad(options.vadOptions)
  let closed = false
  let monitoring = false
  let inputActive = false
  let inputStarting = false
  let awaitingResponse = false
  let stopPending = false
  let bargeInPending = false
  let bargeInRequest = null
  let bargeInPromise = null
  let startAcknowledged = false
  let activeInputTurnId = ''
  let speechEndedBeforeStart = false
  let preRollFrames = []
  let lifecycle = 0
  const completedInputTurnIds = new Set()

  function resetVad() {
    vad.reset()
  }

  function rememberCompletedTurn(inputTurnId) {
    if (!inputTurnId) return
    completedInputTurnIds.add(inputTurnId)
    if (completedInputTurnIds.size <= 12) return
    const oldest = completedInputTurnIds.values().next().value
    completedInputTurnIds.delete(oldest)
  }

  function isCurrentEvent(event) {
    const inputTurnId = inputTurnIdOf(event)
    return (
      Boolean(inputTurnId) &&
      inputTurnId === activeInputTurnId &&
      !completedInputTurnIds.has(inputTurnId) &&
      (inputActive || awaitingResponse || stopPending)
    )
  }

  function handlePartial(event) {
    if (!isCurrentEvent(event)) return
    onPartial({ ...event, inputTurnId: inputTurnIdOf(event) })
  }

  function handleFinal(event) {
    if (!isCurrentEvent(event)) return
    onFinal({ ...event, inputTurnId: inputTurnIdOf(event) })
  }

  function handleStartReady(event) {
    const inputTurnId = inputTurnIdOf(event)
    if (!inputTurnId || inputTurnId !== activeInputTurnId || !inputActive || startAcknowledged) {
      return
    }

    startAcknowledged = true
    const frames = preRollFrames
    preRollFrames = []
    try {
      for (const frame of frames) stream.send(frame)
    } catch (error) {
      handleError(error)
      return
    }
    onStartReady({ inputTurnId })
    if (speechEndedBeforeStart) {
      speechEndedBeforeStart = false
      finishInput()
    }
  }

  function handleStopReady(event) {
    const inputTurnId = inputTurnIdOf(event)
    if (!inputTurnId || inputTurnId !== activeInputTurnId || !stopPending) return

    stopPending = false
    onStopAck({ inputTurnId })
  }

  function handleTurnResponse(event) {
    if (!isCurrentEvent(event)) return

    const inputTurnId = inputTurnIdOf(event)
    rememberCompletedTurn(inputTurnId)
    inputActive = false
    inputStarting = false
    awaitingResponse = false
    stopPending = false
    startAcknowledged = false
    activeInputTurnId = ''
    speechEndedBeforeStart = false
    preRollFrames = []
    resetVad()
    onTurnResponse({ ...event, inputTurnId })
  }

  function handleCancelled(event) {
    const inputTurnId = inputTurnIdOf(event)
    if (event?.target === 'INPUT_STREAM' && inputTurnId === activeInputTurnId) {
      inputActive = false
      inputStarting = false
      awaitingResponse = false
      stopPending = false
      startAcknowledged = false
      activeInputTurnId = ''
      preRollFrames = []
      resetVad()
    }
    onCancelled(event)
    onCancelAck(event)
  }

  function handleError(error) {
    inputActive = false
    inputStarting = false
    awaitingResponse = false
    stopPending = false
    bargeInPending = false
    bargeInRequest = null
    bargeInPromise = null
    startAcknowledged = false
    activeInputTurnId = ''
    speechEndedBeforeStart = false
    preRollFrames = []
    resetVad()
    onError(error)
  }

  async function issueTicket() {
    const sessionId = String(getSessionId() ?? '').trim()
    if (!sessionId) throw new Error('VOICE_SESSION_MISSING')
    const response = await issueStreamTicket(sessionId)
    const ticket = ticketValue(response)
    if (!ticket) throw new Error('VOICE_STREAM_TICKET_MISSING')
    return { sessionId, ticket }
  }

  async function ensureStream(expectedLifecycle = lifecycle) {
    if (stream) return stream
    if (streamPromise) return streamPromise

    streamPromise = issueTicket()
      .then(({ sessionId, ticket }) =>
        createStream({
          sessionId,
          ticket,
          getTicket: async () => issueStreamTicket(sessionId),
          onStartAck: handleStartReady,
          onStopAck: handleStopReady,
          onPartial: handlePartial,
          onFinal: handleFinal,
          onTurnResponse: handleTurnResponse,
          onCancelled: handleCancelled,
          onCancelAck: noop,
          onError: handleError,
        }),
      )
      .then(async (created) => {
        try {
          await created?.waitForOpen?.()
        } catch (error) {
          await created?.close?.().catch(() => {})
          throw error
        }
        if (expectedLifecycle !== lifecycle || closed) {
          await created?.close?.()
          return null
        }
        stream = created
        return stream
      })
      .finally(() => {
        streamPromise = null
      })

    return streamPromise
  }

  function processSamples(samples) {
    if (closed || !monitoring) return

    vad.setTtsPlaying?.(Boolean(isSpeaking()))
    const result = vad.process(samples)
    if (bargeInPending || inputStarting) {
      if (result.speechStart) speechEndedBeforeStart = false
      if (result.speechEnd) speechEndedBeforeStart = true
      return
    }
    if (awaitingResponse) {
      resetVad()
      return
    }
    // START_ACK 이전에는 서버가 아직 PCM 프레임을 받을 수 없다. 이 구간에서 VAD가
    // 발화 종료를 감지해도 STOP을 보내면 START 다음에 오디오 없이 STOP이 도착해
    // Azure가 NoMatch를 반환할 수 있다. 종료 의도만 보관했다가 ACK 후 버퍼를 먼저
    // 전송한 다음 STOP을 보낸다.
    if (inputActive && !startAcknowledged) {
      if (result.speechEnd) speechEndedBeforeStart = true
      return
    }
    if (result.speechStart && !inputActive) {
      void beginInput().catch((error) => {
        if (!closed) onError(error)
      })
    }
    if (result.speechEnd && inputActive) finishInput()
  }

  function processFrame(frame) {
    if (!stream) return
    if (inputStarting || (inputActive && !startAcknowledged)) {
      const bufferedFrame = copyFrame(frame)
      if (!bufferedFrame) return
      if (preRollFrames.length >= MAX_PRE_ROLL_FRAMES) {
        handleError(
          createSttError(
            'VOICE_STREAM_START_TIMEOUT',
            '음성 입력이 너무 길어 준비되지 않았어요. 다시 말씀해 주세요.',
          ),
        )
        return
      }
      preRollFrames.push(bufferedFrame)
      return
    }
    if (!inputActive) return
    try {
      stream.send(frame)
    } catch (error) {
      inputActive = false
      inputStarting = false
      awaitingResponse = false
      stopPending = false
      activeInputTurnId = ''
      startAcknowledged = false
      preRollFrames = []
      resetVad()
      if (!error?.streamReported) onError(error)
    }
  }

  async function ensureCapture(expectedLifecycle = lifecycle) {
    if (capture) return capture
    if (capturePromise) return capturePromise

    capturePromise = Promise.resolve(
      createCapture({
        onSamples: processSamples,
        onFrame: processFrame,
      }),
    )
      .then(async (created) => {
        if (expectedLifecycle !== lifecycle || closed || !monitoring) {
          await created?.stop?.()
          return null
        }
        capture = created
        return capture
      })
      .finally(() => {
        capturePromise = null
      })

    return capturePromise
  }

  async function prepareResources() {
    const expectedLifecycle = lifecycle
    const currentStream = await ensureStream(expectedLifecycle)
    if (!currentStream) return null
    return ensureCapture(expectedLifecycle)
  }

  async function requestBargeIn(request) {
    if (bargeInPending) {
      if (
        bargeInRequest?.target === request.target &&
        (request.target === 'AI_TTS'
          ? bargeInRequest.interruptedAiTurnId === request.interruptedAiTurnId
          : bargeInRequest.inputTurnId === request.inputTurnId)
      ) {
        return bargeInPromise
      }
      throw new Error('VOICE_STREAM_BARGE_IN_PENDING')
    }

    const currentStream = await ensureStream()
    if (!currentStream) throw streamUnavailableError()

    bargeInPending = true
    bargeInRequest = request
    onBargeInPending(request)
    try {
      const pending = Promise.resolve(currentStream.bargeIn(request))
      bargeInPromise = pending
      const cancellation = await pending
      onBargeInReady(cancellation)
      return cancellation
    } finally {
      bargeInPending = false
      bargeInRequest = null
      bargeInPromise = null
    }
  }

  async function beginInput() {
    if (closed || !monitoring || inputActive || inputStarting || awaitingResponse || !stream) {
      return ''
    }

    inputStarting = true
    preRollFrames = []
    capture?.resetSequence?.()
    speechEndedBeforeStart = false
    const interruptedAiTurnId = isSpeaking() ? String(getCurrentTurnId() ?? '').trim() : ''

    if (interruptedAiTurnId) {
      const request = {
        target: 'AI_TTS',
        interruptedAiTurnId,
      }
      onBeforeBargeIn({ ...request })
      try {
        await requestBargeIn(request)
      } catch (error) {
        inputStarting = false
        preRollFrames = []
        resetVad()
        onError(error)
        return ''
      }
      if (closed || !monitoring || !stream) {
        inputStarting = false
        preRollFrames = []
        return ''
      }
    }

    const newInputTurnId = String(createTurnId() ?? '').trim()
    if (!newInputTurnId) {
      inputStarting = false
      onError(new Error('VOICE_INPUT_TURN_MISSING'))
      return ''
    }

    activeInputTurnId = newInputTurnId
    inputActive = true
    inputStarting = false
    awaitingResponse = false
    stopPending = false
    startAcknowledged = false

    onStartPending({
      newInputTurnId,
      interruptedAiTurnId: interruptedAiTurnId || null,
    })
    onInputStart({
      newInputTurnId,
      interruptedAiTurnId: interruptedAiTurnId || null,
      // 이전 콜백과의 호환을 위해 같은 값의 별칭만 제공한다.
      turnId: newInputTurnId,
    })

    try {
      const startResult = stream.start(newInputTurnId)
      void Promise.resolve(startResult)
        .then(() => handleStartReady({ inputTurnId: newInputTurnId }))
        .catch((error) => {
          if (activeInputTurnId !== newInputTurnId) return
          handleError(error)
        })
    } catch (error) {
      handleError(error)
      return ''
    }

    return newInputTurnId
  }

  function finishInput() {
    if (!inputActive || !stream || !activeInputTurnId) return

    const inputTurnId = activeInputTurnId
    inputActive = false
    awaitingResponse = true
    stopPending = true
    onStopPending({ inputTurnId })
    try {
      stream.stop(inputTurnId)
      onInputEnd({ inputTurnId })
    } catch (error) {
      stopPending = false
      awaitingResponse = false
      activeInputTurnId = ''
      resetVad()
      if (!error?.streamReported) onError(error)
    }
  }

  async function startMonitoring() {
    closed = false
    monitoring = true
    resetVad()
    const resources = await prepareResources()
    if (!resources) throw streamUnavailableError()
    return resources
  }

  async function startInput() {
    closed = false
    monitoring = true
    resetVad()
    const resources = await prepareResources()
    if (!resources) throw streamUnavailableError()
    return beginInput()
  }

  async function bargeIn(interruptedAiTurnId) {
    const value = String(interruptedAiTurnId ?? '').trim()
    if (!value) return null
    return requestBargeIn({
      target: 'AI_TTS',
      interruptedAiTurnId: value,
    })
  }

  async function cancelForFallback() {
    const inputTurnId = activeInputTurnId
    const shouldCancelInput =
      Boolean(inputTurnId) && (inputActive || inputStarting || awaitingResponse || stopPending)
    let cancellationError = null

    if (shouldCancelInput && stream) {
      inputActive = false
      inputStarting = false
      awaitingResponse = false
      stopPending = false
      resetVad()
      try {
        await requestBargeIn({ target: 'INPUT_STREAM', inputTurnId })
      } catch (error) {
        cancellationError = error
      }
    }

    await stopMonitoring()
    if (cancellationError) throw cancellationError
  }

  async function stopMonitoring() {
    monitoring = false
    lifecycle += 1
    resetVad()
    inputActive = false
    inputStarting = false
    awaitingResponse = false
    stopPending = false
    bargeInPending = false
    bargeInRequest = null
    bargeInPromise = null
    startAcknowledged = false
    activeInputTurnId = ''
    speechEndedBeforeStart = false
    preRollFrames = []

    const currentCapture = capture
    capture = null
    if (currentCapture) await currentCapture.stop?.().catch(() => {})
    if (capturePromise) await capturePromise.catch(() => {})

    const currentStream = stream
    stream = null
    if (currentStream) await currentStream.close?.().catch(() => {})
    if (streamPromise) await streamPromise.catch(() => {})
  }

  async function close() {
    closed = true
    await stopMonitoring()
  }

  function getState() {
    let phase = 'IDLE'
    if (bargeInPending) phase = 'WAITING_CANCELLED'
    else if (inputStarting) phase = 'WAITING_CANCELLED'
    else if (inputActive) phase = startAcknowledged ? 'STREAMING' : 'WAITING_START_ACK'
    else if (stopPending) phase = 'WAITING_STOP_ACK'
    else if (awaitingResponse) phase = 'WAITING_TURN_RESPONSE'

    return {
      phase,
      activeInputTurnId,
      activeTurnId: activeInputTurnId,
      inputActive,
      inputStarting,
      awaitingResponse,
      stopPending,
      bargeInPending,
      monitoring,
      hasStream: Boolean(stream),
      hasCapture: Boolean(capture),
    }
  }

  return {
    startMonitoring,
    startInput,
    bargeIn,
    cancelForFallback,
    stopMonitoring,
    close,
    getState,
  }
}
