import { resolveApiBaseUrl } from '../../../shared/api/client.js'
import { createSttError } from './voiceStt.js'

const runtimeEnvironment = import.meta.env || {}
const OPEN = 1
const CLOSED = 3
const POLICY_VIOLATION = 1_008
const DEFAULT_MAX_BUFFERED_BYTES = 256 * 1024
const DEFAULT_MAX_QUEUED_BYTES = 512 * 1024
const DEFAULT_RECONNECT_DELAY_MS = 250
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 1
const DEFAULT_START_TIMEOUT_MS = 5_000
const DEFAULT_CANCEL_TIMEOUT_MS = 5_000
const DEFAULT_STOP_TIMEOUT_MS = 5_000

const ERROR_MESSAGES = {
  VOICE_STREAM_UNAVAILABLE: '음성 연결이 되지 않았어요. 화면 단추로 진행해 주세요.',
  VOICE_STREAM_UNAUTHORIZED: '다시 로그인해 주세요.',
  VOICE_STREAM_DISCONNECTED: '연결이 끊겼어요. 다시 말씀해 주세요.',
  VOICE_STREAM_REJECTED: '음성을 보내지 못했어요. 다시 말씀해 주세요.',
  VOICE_TURN_CONFLICT: '다시 말씀해 주세요.',
  VOICE_STREAM_BACKPRESSURE: '음성 연결이 느려요. 다시 말씀해 주세요.',
  VOICE_STREAM_SEQUENCE_INVALID: '음성 순서를 확인하지 못했어요. 다시 말씀해 주세요.',
  VOICE_STREAM_START_TIMEOUT: '음성 입력 준비가 늦어지고 있어요. 다시 말씀해 주세요.',
  VOICE_STREAM_CANCEL_TIMEOUT: '음성 안내를 끊지 못했어요. 다시 말씀해 주세요.',
  VOICE_STREAM_STOP_TIMEOUT: '음성 입력 종료가 늦어지고 있어요. 다시 말씀해 주세요.',
}

function streamError(code, message = ERROR_MESSAGES[code]) {
  return createSttError(code, message || '음성 연결을 사용할 수 없어요.')
}

function ticketValue(value) {
  if (typeof value === 'string') return value.trim()
  return String(value?.wsTicket ?? value?.ticket ?? '').trim()
}

function locationHref(value) {
  return value || globalThis.location?.href || 'http://localhost/'
}

function callbackOf(options, name) {
  return typeof options[name] === 'function' ? options[name] : () => {}
}

function eventInputTurnId(event) {
  return String(event?.inputTurnId ?? '').trim()
}

function eventInterruptedAiTurnId(event) {
  return String(event?.interruptedAiTurnId ?? '').trim()
}

function frameArrayBuffer(frame) {
  if (frame instanceof ArrayBuffer) return frame
  if (ArrayBuffer.isView(frame)) {
    return frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength)
  }
  return null
}

function frameSequence(frame) {
  if (frame.byteLength <= 4) {
    throw streamError('VOICE_STREAM_SEQUENCE_INVALID', '음성 프레임을 확인하지 못했어요.')
  }
  return new DataView(frame).getUint32(0, false)
}

function isSequenceError(event) {
  const code = String(event?.code ?? '').toUpperCase()
  if (
    ['SEQUENCE_ERROR', 'INVALID_SEQUENCE', 'PCM_SEQUENCE_INVALID'].includes(code) ||
    code.includes('SEQUENCE')
  ) {
    return true
  }

  const text = String(event?.message ?? '').toLowerCase()
  return (
    text.includes('sequence') ||
    text.includes('pcm') ||
    text.includes('프레임') ||
    text.includes('순서')
  )
}

function mapServerError(event) {
  const code = String(event?.code ?? '')
  const sequenceError = isSequenceError(event)
  const mappedCode = sequenceError
    ? 'VOICE_STREAM_SEQUENCE_INVALID'
    : code === 'INVALID_REQUEST'
      ? 'VOICE_STREAM_REJECTED'
      : code === 'VOICE_TURN_CONFLICT'
        ? 'VOICE_TURN_CONFLICT'
        : code || 'VOICE_STREAM_REJECTED'
  const error = streamError(mappedCode, event?.message || ERROR_MESSAGES[mappedCode])
  error.requestId = event?.requestId ?? null
  error.retryable = Boolean(event?.retryable)
  error.serverCode = code || null
  return error
}

function parseMessage(data) {
  if (typeof data !== 'string') return null
  try {
    const event = JSON.parse(data)
    return event && typeof event === 'object' ? event : null
  } catch {
    return null
  }
}

function createOperation(timeoutCode, timeoutMs, onTimeout) {
  let settled = false
  let timer = null
  let resolvePromise
  let rejectPromise

  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const settle = (settler, value) => {
    if (settled) return
    settled = true
    if (timer !== null) clearTimeout(timer)
    settler(value)
  }

  timer = setTimeout(() => {
    if (settled) return
    const error = streamError(timeoutCode)
    settled = true
    timer = null
    rejectPromise(error)
    onTimeout(error)
  }, timeoutMs)

  return {
    promise,
    resolve: (value) => settle(resolvePromise, value),
    reject: (error) => settle(rejectPromise, error),
  }
}

/** API base URL을 브라우저 WebSocket URL로 바꾼다. */
export function buildVoiceStreamUrl(
  sessionId,
  apiBaseUrl = runtimeEnvironment.VITE_API_BASE_URL,
  currentLocation = globalThis.location?.href,
) {
  const base = new URL(resolveApiBaseUrl(apiBaseUrl), locationHref(currentLocation))
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname =
    base.pathname.replace(/\/+$/, '') +
    '/voice/sessions/' +
    encodeURIComponent(sessionId) +
    '/stream'
  base.search = ''
  base.hash = ''
  return base.toString()
}

/**
 * Browser WebSocket은 Authorization header를 임의로 넣을 수 없으므로 프로토콜 버전과
 * ticket을 실제 Sec-WebSocket-Protocol 값으로 전달한다.
 */
export function buildVoiceStreamProtocols(ticket) {
  const value = ticketValue(ticket)
  return value ? ['voice-stream-v1', 'ticket.' + value] : ['voice-stream-v1']
}

/**
 * 송금 음성 WebSocket을 연다.
 *
 * START/STOP/BARGE_IN은 제어 메시지를 보낼 뿐 아니라 서버의 완료 이벤트를
 * Promise로 표현한다. 따라서 호출자는 START_ACK 또는 CANCELLED.readyForStart=true
 * 전까지 PCM과 다음 START를 진행하지 않는다.
 */
export async function openVoiceStream(options = {}) {
  const sessionId = String(options.sessionId ?? '').trim()
  if (!sessionId) throw streamError('VOICE_STREAM_UNAVAILABLE')

  const WebSocketClass = options.WebSocketClass ?? globalThis.WebSocket
  if (typeof WebSocketClass !== 'function') {
    throw streamError('VOICE_STREAM_UNAVAILABLE')
  }

  let currentTicket = ticketValue(options.ticket)
  if (!currentTicket && typeof options.getTicket === 'function') {
    try {
      currentTicket = ticketValue(await options.getTicket())
    } catch {
      throw streamError('VOICE_STREAM_UNAVAILABLE')
    }
  }
  if (!currentTicket) throw streamError('VOICE_STREAM_UNAVAILABLE')

  const url =
    options.url || buildVoiceStreamUrl(sessionId, options.apiBaseUrl, options.currentLocation)
  const maxBufferedBytes =
    Number(options.maxBufferedBytes) > 0
      ? Number(options.maxBufferedBytes)
      : DEFAULT_MAX_BUFFERED_BYTES
  const maxQueuedBytes =
    Number(options.maxQueuedBytes) > 0 ? Number(options.maxQueuedBytes) : DEFAULT_MAX_QUEUED_BYTES
  const reconnectDelayMs = Math.max(
    0,
    Number.isFinite(Number(options.reconnectDelayMs))
      ? Number(options.reconnectDelayMs)
      : DEFAULT_RECONNECT_DELAY_MS,
  )
  const maxReconnectAttempts = Math.max(
    0,
    Number.isFinite(Number(options.maxReconnectAttempts))
      ? Number(options.maxReconnectAttempts)
      : DEFAULT_MAX_RECONNECT_ATTEMPTS,
  )
  const startTimeoutMs = Math.max(
    1,
    Number.isFinite(Number(options.startTimeoutMs))
      ? Number(options.startTimeoutMs)
      : DEFAULT_START_TIMEOUT_MS,
  )
  const cancelTimeoutMs = Math.max(
    1,
    Number.isFinite(Number(options.cancelTimeoutMs))
      ? Number(options.cancelTimeoutMs)
      : DEFAULT_CANCEL_TIMEOUT_MS,
  )
  const stopTimeoutMs = Math.max(
    1,
    Number.isFinite(Number(options.stopTimeoutMs))
      ? Number(options.stopTimeoutMs)
      : DEFAULT_STOP_TIMEOUT_MS,
  )

  const onOpen = callbackOf(options, 'onOpen')
  const onStartAck = callbackOf(options, 'onStartAck')
  const onStopAck = callbackOf(options, 'onStopAck')
  const onPartial = callbackOf(options, 'onPartial')
  const onFinal = callbackOf(options, 'onFinal')
  const onTurnResponse = callbackOf(options, 'onTurnResponse')
  const onCancelled = callbackOf(options, 'onCancelled')
  const onCancelAck = callbackOf(options, 'onCancelAck')
  const onError = callbackOf(options, 'onError')
  const onClose = callbackOf(options, 'onClose')

  let socket = null
  let closed = false
  let reconnectTimer = null
  let reconnectAttempts = 0
  let pending = []
  let pendingBytes = 0
  let activeInputTurnId = ''
  let turnOpen = false
  let inputStreaming = false
  let startConfirmed = false
  let startPending = null
  let stopPending = false
  let stopAcknowledged = false
  let stopTimer = null
  const sentFrames = new Map()
  let bargeInPending = null
  let lastQueuedSequence = -1
  let lastSentSequence = -1
  let lastReceivedSequence = -1
  let serverSequenceKnown = false
  let errorReportedForClose = false

  function recalculatePendingBytes() {
    pendingBytes = pending.reduce((total, item) => total + item.bytes, 0)
  }

  function clearPending() {
    pending = []
    pendingBytes = 0
  }

  function clearQueuedBinary() {
    pending = pending.filter((item) => item.kind !== 'binary')
    recalculatePendingBytes()
  }

  function removeQueuedControl(type) {
    pending = pending.filter((item) => item.controlType !== type)
    recalculatePendingBytes()
  }

  function clearStopTimer() {
    if (stopTimer !== null) clearTimeout(stopTimer)
    stopTimer = null
  }

  function clearSentFrames() {
    sentFrames.clear()
  }

  function acknowledgeSentFrames(sequence) {
    for (const sentSequence of sentFrames.keys()) {
      if (sentSequence <= sequence) sentFrames.delete(sentSequence)
    }
  }

  function unacknowledgedFrameBytes() {
    let total = 0
    for (const item of sentFrames.values()) total += item.bytes
    return total
  }

  function copyBinaryItem(item) {
    return { ...item, payload: item.payload.slice(0) }
  }

  function rebuildResumeQueue() {
    const resumeControls = pending.filter((item) => item.controlType === 'RESUME')
    const replay = new Map()

    for (const [sequence, item] of sentFrames) {
      if (sequence > lastReceivedSequence) replay.set(sequence, copyBinaryItem(item))
    }
    for (const item of pending) {
      if (item.kind === 'binary' && item.sequence > lastReceivedSequence) {
        replay.set(item.sequence, copyBinaryItem(item))
      }
    }

    const replayItems = [...replay.values()].sort((left, right) => left.sequence - right.sequence)
    const controls = pending.filter(
      (item) => item.kind !== 'binary' && item.controlType !== 'RESUME',
    )
    pending = [...resumeControls, ...replayItems, ...controls]
    recalculatePendingBytes()
  }

  function queueItem(item, front = false) {
    if (pendingBytes + item.bytes > maxQueuedBytes) {
      throw streamError('VOICE_STREAM_BACKPRESSURE')
    }
    if (front) pending.unshift(item)
    else pending.push(item)
    pendingBytes += item.bytes
  }

  function report(error) {
    onError(error)
  }

  function reportLocalError(error) {
    error.streamReported = true
    report(error)
  }

  function reportCloseError(error) {
    if (errorReportedForClose) return
    errorReportedForClose = true
    report(error)
  }

  function sendNow(payload) {
    if (!socket || socket.readyState !== OPEN) return false
    socket.send(payload)
    return true
  }

  function sendItem(item) {
    if (!sendNow(item.payload)) return false
    if (item.kind === 'binary') {
      lastSentSequence = item.sequence
      sentFrames.set(item.sequence, copyBinaryItem(item))
    }
    return true
  }

  function flush() {
    if (!socket || socket.readyState !== OPEN) return

    while (pending.length) {
      const item = pending[0]
      if (item.kind === 'binary' && !startConfirmed) return
      if (item.kind === 'binary' && socket.bufferedAmount > maxBufferedBytes) {
        clearPending()
        report(streamError('VOICE_STREAM_BACKPRESSURE'))
        return
      }
      if (!sendItem(item)) return
      pending.shift()
      pendingBytes -= item.bytes
    }
  }

  function controlItem(type, fields) {
    return {
      payload: JSON.stringify({ type, ...fields }),
      bytes: 0,
      kind: 'control',
      controlType: type,
      sequence: null,
    }
  }

  function dispatchControl(type, fields, { front = false, afterStart = false } = {}) {
    const item = controlItem(type, fields)
    if (
      !front &&
      socket?.readyState === OPEN &&
      pending.length === 0 &&
      (!afterStart || startConfirmed)
    ) {
      if (!sendItem(item)) throw streamError('VOICE_STREAM_DISCONNECTED')
      return true
    }

    queueItem(item, front)
    flush()
    return false
  }

  function prependStart() {
    removeQueuedControl('START')
    queueItem(controlItem('START', { inputTurnId: activeInputTurnId }), true)
  }

  function normalizeBargeRequest(value) {
    if (typeof value === 'string') {
      const interruptedAiTurnId = value.trim()
      if (!interruptedAiTurnId) {
        throw streamError('VOICE_STREAM_REJECTED', '음성 안내를 끊지 못했어요.')
      }
      return { target: 'AI_TTS', interruptedAiTurnId }
    }

    const target = value?.target
    if (target === 'AI_TTS') {
      const interruptedAiTurnId = String(value?.interruptedAiTurnId ?? '').trim()
      if (!interruptedAiTurnId) {
        throw streamError('VOICE_STREAM_REJECTED', '음성 안내를 끊지 못했어요.')
      }
      return { target, interruptedAiTurnId }
    }

    if (target === 'INPUT_STREAM') {
      const inputTurnId = String(value?.inputTurnId ?? '').trim()
      if (!inputTurnId) {
        throw streamError('VOICE_STREAM_REJECTED', '음성 입력을 취소하지 못했어요.')
      }
      return { target, inputTurnId }
    }

    throw streamError('VOICE_STREAM_REJECTED', '음성 안내를 끊지 못했어요.')
  }

  function sameBargeRequest(left, right) {
    if (!left || !right || left.target !== right.target) return false
    return left.target === 'AI_TTS'
      ? left.interruptedAiTurnId === right.interruptedAiTurnId
      : left.inputTurnId === right.inputTurnId
  }

  function cancellationMatches(event, request) {
    if (!request) return false
    if (request.target === 'AI_TTS') {
      return (
        event.target === 'AI_TTS' && eventInterruptedAiTurnId(event) === request.interruptedAiTurnId
      )
    }
    return event.target === 'INPUT_STREAM' && eventInputTurnId(event) === request.inputTurnId
  }

  function resolveStart(event) {
    const operation = startPending
    startPending = null
    startConfirmed = true
    operation?.resolve(event)
    onStartAck(event)
    flush()
  }

  function resetTurnState() {
    clearStopTimer()
    clearSentFrames()
    activeInputTurnId = ''
    turnOpen = false
    inputStreaming = false
    startConfirmed = false
    stopPending = false
    stopAcknowledged = false
    lastQueuedSequence = -1
    lastSentSequence = -1
    lastReceivedSequence = -1
    serverSequenceKnown = false
    clearQueuedBinary()
  }

  function rejectStart(error) {
    const operation = startPending
    startPending = null
    operation?.reject(error)
  }

  function rejectBargeIn(error) {
    const operation = bargeInPending?.operation
    bargeInPending = null
    operation?.reject(error)
  }

  function armStopTimer() {
    clearStopTimer()
    stopTimer = setTimeout(() => {
      stopTimer = null
      failActiveTurn(streamError('VOICE_STREAM_STOP_TIMEOUT'))
    }, stopTimeoutMs)
  }

  function failActiveTurn(error, notify = true) {
    rejectStart(error)
    rejectBargeIn(error)
    resetTurnState()
    if (notify) report(error)
  }

  function updateServerSequence(event) {
    const inputTurnId = eventInputTurnId(event)
    if (!turnOpen || !inputTurnId || inputTurnId !== activeInputTurnId) return

    const valueSource =
      event?.lastReceivedSequence ??
      event?.receivedSequence ??
      (event?.type === 'PCM_ACK' || event?.type === 'FRAME_ACK' ? event?.sequence : null)
    if (valueSource === null || valueSource === undefined) return

    const value = Number(valueSource)
    if (
      !Number.isInteger(value) ||
      value < -1 ||
      value > lastSentSequence ||
      (serverSequenceKnown && value < lastReceivedSequence)
    ) {
      return
    }
    lastReceivedSequence = value
    serverSequenceKnown = true
    acknowledgeSentFrames(value)
  }

  function resumeSequence() {
    return serverSequenceKnown ? lastReceivedSequence : -1
  }

  function handleMessage(raw) {
    const event = parseMessage(raw?.data)
    if (!event) return
    updateServerSequence(event)

    if (event.type === 'START_ACK') {
      const inputTurnId = eventInputTurnId(event)
      if (inputTurnId && inputTurnId === activeInputTurnId && startPending) {
        resolveStart({ inputTurnId, nextSequence: Number(event.nextSequence ?? 0) })
      }
      return
    }

    if (event.type === 'STOP_ACK') {
      const inputTurnId = eventInputTurnId(event)
      if (inputTurnId && inputTurnId === activeInputTurnId && stopPending) {
        stopPending = false
        stopAcknowledged = true
        clearStopTimer()
        onStopAck({ inputTurnId })
      }
      return
    }

    if (event.type === 'PARTIAL_TRANSCRIPT') {
      const inputTurnId = eventInputTurnId(event)
      if (!turnOpen || !inputTurnId || inputTurnId !== activeInputTurnId) return
      onPartial({ inputTurnId, text: String(event.text ?? '') })
      return
    }

    if (event.type === 'FINAL_TRANSCRIPT') {
      const inputTurnId = eventInputTurnId(event)
      if (!turnOpen || !inputTurnId || inputTurnId !== activeInputTurnId) return
      const confidence = Number(event.sttConfidence)
      onFinal({
        inputTurnId,
        text: String(event.text ?? ''),
        sttConfidence: Number.isFinite(confidence) ? confidence : null,
      })
      return
    }

    if (event.type === 'TURN_RESPONSE') {
      const inputTurnId = eventInputTurnId(event)
      if (!turnOpen || !inputTurnId || inputTurnId !== activeInputTurnId) return

      const response = {
        inputTurnId,
        data: event.data && typeof event.data === 'object' ? event.data : {},
      }
      onTurnResponse(response)
      resetTurnState()
      return
    }

    if (
      event.type === 'CANCELLED' ||
      event.type === 'READY_FOR_START' ||
      event.type === 'CANCEL_ACK'
    ) {
      const pendingCancellation = bargeInPending
      const request = pendingCancellation?.request
      const readyForStart = event.type === 'READY_FOR_START' || event.readyForStart === true
      if (!request || !readyForStart || !cancellationMatches(event, request)) return

      const cancellation = {
        target: event.target ?? request.target,
        interruptedAiTurnId: event.interruptedAiTurnId ?? request.interruptedAiTurnId ?? null,
        inputTurnId: event.inputTurnId ?? request.inputTurnId ?? null,
        readyForStart: true,
      }
      const operation = pendingCancellation.operation
      bargeInPending = null
      operation.resolve(cancellation)
      if (request.target === 'INPUT_STREAM') resetTurnState()
      onCancelled(cancellation)
      onCancelAck(cancellation)
      return
    }

    if (event.type === 'PCM_ACK' || event.type === 'FRAME_ACK') {
      return
    }

    if (event.type === 'ERROR') {
      const error = mapServerError(event)
      const shouldReset = isSequenceError(event) || Boolean(turnOpen)
      if (shouldReset) failActiveTurn(error, false)
      else {
        rejectStart(error)
        rejectBargeIn(error)
      }
      report(error)
    }
  }

  function scheduleReconnect(reason = 'stream') {
    if (closed || reconnectTimer !== null) return

    const requiresReconnect = reason === 'auth' || turnOpen || Boolean(bargeInPending)
    if (!requiresReconnect || typeof options.getTicket !== 'function') {
      const code = reason === 'auth' ? 'VOICE_STREAM_UNAUTHORIZED' : 'VOICE_STREAM_DISCONNECTED'
      reportCloseError(streamError(code))
      if (reason === 'auth') failActiveTurn(streamError(code), false)
      return
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      const code = reason === 'auth' ? 'VOICE_STREAM_UNAUTHORIZED' : 'VOICE_STREAM_DISCONNECTED'
      reportCloseError(streamError(code))
      failActiveTurn(streamError(code), false)
      return
    }

    reconnectAttempts += 1
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null
      try {
        const nextTicket = ticketValue(await options.getTicket())
        if (!nextTicket) throw new Error('missing ticket')
        currentTicket = nextTicket
        createSocket(currentTicket, true)
      } catch {
        scheduleReconnect(reason)
      }
    }, reconnectDelayMs)
  }

  function createSocket(ticket, isReconnect = false) {
    let nextSocket
    try {
      nextSocket = new WebSocketClass(url, buildVoiceStreamProtocols(ticket))
    } catch {
      scheduleReconnect(isReconnect ? 'stream' : 'auth')
      return
    }

    socket = nextSocket
    nextSocket.binaryType = 'arraybuffer'
    let opened = false

    nextSocket.onopen = () => {
      opened = true
      errorReportedForClose = false

      if (isReconnect && turnOpen) {
        if (!startConfirmed) {
          prependStart()
        } else {
          const resume = controlItem('RESUME', {
            inputTurnId: activeInputTurnId,
            lastReceivedSequence: resumeSequence(),
          })
          if (!sendItem(resume)) queueItem(resume, true)
          rebuildResumeQueue()
          if (stopPending && !stopAcknowledged) {
            removeQueuedControl('STOP')
            queueItem(controlItem('STOP', { inputTurnId: activeInputTurnId }))
          }
        }
      }

      flush()
      onOpen({ reconnect: isReconnect })
    }

    nextSocket.onmessage = handleMessage
    nextSocket.onerror = () => {
      // 상세 원인은 close code가 제공될 때만 사용자 오류로 바꾼다.
    }
    nextSocket.onclose = (event) => {
      if (socket === nextSocket) socket = null
      onClose(event)
      if (closed) return

      if (event?.code === POLICY_VIOLATION) {
        scheduleReconnect('auth')
        return
      }

      if ((opened && turnOpen) || bargeInPending) {
        scheduleReconnect('stream')
        return
      }

      if (!errorReportedForClose) {
        reportCloseError(
          streamError(opened ? 'VOICE_STREAM_DISCONNECTED' : 'VOICE_STREAM_UNAVAILABLE'),
        )
      }
    }
  }

  function start(inputTurnId) {
    const value = String(inputTurnId ?? '').trim()
    if (!value) {
      throw streamError('VOICE_STREAM_REJECTED', '음성 턴을 시작하지 못했어요.')
    }
    if (bargeInPending) {
      throw streamError('VOICE_STREAM_REJECTED', '이전 음성 안내를 정리하는 중이에요. 잠시만요.')
    }
    if (turnOpen) {
      if (activeInputTurnId === value && startPending) return startPending.promise
      if (activeInputTurnId === value && startConfirmed)
        return Promise.resolve({ inputTurnId: value })
      throw streamError('VOICE_TURN_CONFLICT')
    }

    clearQueuedBinary()
    clearSentFrames()
    clearStopTimer()
    activeInputTurnId = value
    turnOpen = true
    inputStreaming = true
    startConfirmed = false
    stopPending = false
    stopAcknowledged = false
    lastQueuedSequence = -1
    lastSentSequence = -1
    lastReceivedSequence = -1
    serverSequenceKnown = false

    const operation = createOperation('VOICE_STREAM_START_TIMEOUT', startTimeoutMs, (error) =>
      failActiveTurn(error),
    )
    startPending = operation

    try {
      dispatchControl('START', { inputTurnId: value })
    } catch (error) {
      startPending = null
      operation.reject(error)
      failActiveTurn(error, false)
      throw error
    }

    return operation.promise
  }

  function send(frame) {
    const value = frameArrayBuffer(frame)
    if (!value) {
      throw streamError('VOICE_STREAM_SEQUENCE_INVALID', '음성 프레임을 확인하지 못했어요.')
    }
    if (!turnOpen || !activeInputTurnId || !inputStreaming) {
      throw streamError('VOICE_STREAM_REJECTED', '현재 음성 입력을 받고 있지 않아요.')
    }
    if (!startPending && !startConfirmed) {
      throw streamError('VOICE_STREAM_REJECTED', '음성 입력 준비가 끝나지 않았어요.')
    }

    let sequence
    try {
      sequence = frameSequence(value)
    } catch (error) {
      failActiveTurn(error, false)
      reportLocalError(error)
      throw error
    }
    if (sequence !== lastQueuedSequence + 1) {
      const error = streamError('VOICE_STREAM_SEQUENCE_INVALID')
      failActiveTurn(error, false)
      reportLocalError(error)
      throw error
    }

    if (pendingBytes + unacknowledgedFrameBytes() + value.byteLength > maxQueuedBytes) {
      const error = streamError('VOICE_STREAM_BACKPRESSURE')
      failActiveTurn(error, false)
      reportLocalError(error)
      throw error
    }

    if (startConfirmed && socket?.readyState === OPEN && pending.length === 0) {
      if (socket.bufferedAmount > maxBufferedBytes) {
        throw streamError('VOICE_STREAM_BACKPRESSURE')
      }
      if (!sendNow(value)) throw streamError('VOICE_STREAM_DISCONNECTED')
      lastQueuedSequence = sequence
      lastSentSequence = sequence
      sentFrames.set(sequence, {
        payload: value.slice(0),
        bytes: value.byteLength,
        kind: 'binary',
        sequence,
      })
      return
    }

    queueItem({ payload: value, bytes: value.byteLength, kind: 'binary', sequence })
    lastQueuedSequence = sequence
    flush()
  }

  function stop(inputTurnId = activeInputTurnId) {
    const value = String(inputTurnId ?? '').trim()
    if (!value || value !== activeInputTurnId || !turnOpen) {
      throw streamError('VOICE_STREAM_REJECTED', '음성 턴을 끝내지 못했어요.')
    }

    inputStreaming = false
    stopPending = true
    stopAcknowledged = false
    armStopTimer()
    try {
      dispatchControl('STOP', { inputTurnId: value }, { afterStart: true })
    } catch (error) {
      clearStopTimer()
      stopPending = false
      failActiveTurn(error, false)
      throw error
    }
  }

  function bargeIn(value) {
    const request = normalizeBargeRequest(value)
    if (bargeInPending) {
      if (sameBargeRequest(bargeInPending.request, request)) {
        return bargeInPending.operation.promise
      }
      throw streamError('VOICE_STREAM_REJECTED', '이전 음성 안내를 정리하는 중이에요. 잠시만요.')
    }

    const operation = createOperation('VOICE_STREAM_CANCEL_TIMEOUT', cancelTimeoutMs, (error) =>
      failActiveTurn(error),
    )
    bargeInPending = { request, operation }

    if (request.target === 'INPUT_STREAM') {
      inputStreaming = false
      clearStopTimer()
      stopPending = false
      stopAcknowledged = false
      clearQueuedBinary()
      clearSentFrames()
      removeQueuedControl('STOP')
    }

    const fields =
      request.target === 'AI_TTS'
        ? { target: 'AI_TTS', interruptedAiTurnId: request.interruptedAiTurnId }
        : { target: 'INPUT_STREAM', inputTurnId: request.inputTurnId }

    try {
      dispatchControl('BARGE_IN', fields, {
        front: request.target === 'INPUT_STREAM',
      })
    } catch (error) {
      bargeInPending = null
      operation.reject(error)
      throw error
    }

    return operation.promise
  }

  async function close() {
    closed = true
    rejectStart(streamError('VOICE_STREAM_DISCONNECTED'))
    rejectBargeIn(streamError('VOICE_STREAM_DISCONNECTED'))
    resetTurnState()
    if (reconnectTimer !== null) clearTimeout(reconnectTimer)
    reconnectTimer = null
    clearPending()

    const current = socket
    socket = null
    if (current && current.readyState !== CLOSED) current.close(1_000)
  }

  createSocket(currentTicket)

  return {
    start,
    send,
    stop,
    bargeIn,
    close,
    getState: () => ({
      activeInputTurnId,
      inputTurnId: activeInputTurnId,
      turnOpen,
      inputStreaming,
      startConfirmed,
      startPending: Boolean(startPending),
      stopPending,
      bargeInPending: bargeInPending ? { ...bargeInPending.request } : null,
      lastQueuedSequence,
      lastSentSequence,
      lastReceivedSequence,
      reconnecting: reconnectTimer !== null,
      readyState: socket?.readyState ?? CLOSED,
    }),
  }
}
