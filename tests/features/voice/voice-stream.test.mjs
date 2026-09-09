import assert from 'node:assert/strict'
import test from 'node:test'

import { openVoiceStream } from '../../../src/features/voice/services/voiceStream.js'

class FakeWebSocket {
  static CONNECTING = 0

  static OPEN = 1

  static CLOSED = 3

  static instances = []

  constructor(url, protocols) {
    this.url = url
    this.protocols = protocols
    this.readyState = FakeWebSocket.CONNECTING
    this.bufferedAmount = 0
    this.sent = []
    this.closeCalls = 0
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  send(payload) {
    this.sent.push(payload)
  }

  receive(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  close(code = 1_000) {
    this.closeCalls += 1
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason: '' })
  }
}

function resetSockets() {
  FakeWebSocket.instances.length = 0
}

function frame(sequence) {
  const value = new ArrayBuffer(6)
  const view = new DataView(value)
  view.setUint32(0, sequence, false)
  view.setInt16(4, sequence, true)
  return value
}

function sequenceOf(value) {
  return new DataView(value).getUint32(0, false)
}

function sentJson(socket, index) {
  return JSON.parse(socket.sent[index])
}

function nextTick() {
  return new Promise((resolve) => setImmediate(resolve))
}

test('voice stream uses the negotiated version and ticket subprotocol without putting ticket in URL', async () => {
  resetSockets()

  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'one-time-ticket',
    apiBaseUrl: 'https://bank.example/api',
    WebSocketClass: FakeWebSocket,
  })
  const socket = FakeWebSocket.instances[0]

  assert.equal(socket.url, 'wss://bank.example/api/voice/sessions/session-1/stream')
  assert.deepEqual(socket.protocols, ['voice-stream-v1', 'ticket.one-time-ticket'])
  assert.equal(socket.url.includes('ticket'), false)

  await stream.close()
})

test('voice stream waits for the connection and does not close a CONNECTING socket', async () => {
  resetSockets()

  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'one-time-ticket',
    WebSocketClass: FakeWebSocket,
  })
  const socket = FakeWebSocket.instances[0]
  const ready = stream.waitForOpen()

  await stream.close()

  await assert.rejects(ready, (error) => error.code === 'VOICE_STREAM_DISCONNECTED')
  assert.equal(socket.closeCalls, 0)

  socket.open()
  assert.equal(socket.closeCalls, 1)
})

test('voice stream sends START before PCM and starts a new turn only after cancellation completes', async () => {
  resetSockets()
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket-1',
    WebSocketClass: FakeWebSocket,
  })
  const socket = FakeWebSocket.instances[0]

  const startPromise = stream.start('input-1')
  stream.send(frame(0))
  assert.equal(socket.sent.length, 0)

  socket.open()
  assert.deepEqual(sentJson(socket, 0), {
    type: 'START',
    inputTurnId: 'input-1',
  })
  assert.equal(socket.sent.length, 1)

  socket.receive({
    type: 'START_ACK',
    inputTurnId: 'input-1',
    nextSequence: 0,
  })
  await startPromise
  assert.equal(socket.sent[1] instanceof ArrayBuffer, true)
  assert.equal(sequenceOf(socket.sent[1]), 0)

  stream.stop('input-1')
  assert.deepEqual(sentJson(socket, 2), {
    type: 'STOP',
    inputTurnId: 'input-1',
  })
  socket.receive({ type: 'STOP_ACK', inputTurnId: 'input-1' })
  socket.receive({
    type: 'TURN_RESPONSE',
    inputTurnId: 'input-1',
    data: { turnId: 'ai-1', aiTurnId: 'ai-1', ttsText: '확인해 주세요.' },
  })

  const cancellationPromise = stream.bargeIn({
    target: 'AI_TTS',
    interruptedAiTurnId: 'ai-1',
  })
  assert.deepEqual(sentJson(socket, 3), {
    type: 'BARGE_IN',
    target: 'AI_TTS',
    interruptedAiTurnId: 'ai-1',
  })
  assert.equal(
    socket.sent
      .slice(4)
      .some((value) => typeof value === 'string' && JSON.parse(value).type === 'START'),
    false,
  )

  socket.receive({
    type: 'CANCELLED',
    target: 'AI_TTS',
    interruptedAiTurnId: 'ai-1',
    readyForStart: true,
  })
  await cancellationPromise

  const nextStart = stream.start('input-2')
  assert.deepEqual(sentJson(socket, 4), {
    type: 'START',
    inputTurnId: 'input-2',
  })
  socket.receive({ type: 'START_ACK', inputTurnId: 'input-2', nextSequence: 0 })
  await nextStart

  await stream.close()
})

test('voice stream filters partial, final, and response events by active inputTurnId', async () => {
  resetSockets()
  const received = { partial: [], final: [], responses: [] }
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket',
    WebSocketClass: FakeWebSocket,
    onPartial: (event) => received.partial.push(event),
    onFinal: (event) => received.final.push(event),
    onTurnResponse: (event) => received.responses.push(event),
  })
  const socket = FakeWebSocket.instances[0]
  socket.open()

  const startPromise = stream.start('input-current')
  socket.receive({ type: 'START_ACK', inputTurnId: 'input-current', nextSequence: 0 })
  await startPromise

  socket.receive({
    type: 'PARTIAL_TRANSCRIPT',
    inputTurnId: 'input-old',
    text: '오래된 내용',
  })
  socket.receive({
    type: 'PARTIAL_TRANSCRIPT',
    inputTurnId: 'input-current',
    text: '김영',
  })
  socket.receive({
    type: 'FINAL_TRANSCRIPT',
    inputTurnId: 'input-old',
    text: '오래된 최종',
    sttConfidence: 0.99,
  })
  socket.receive({
    type: 'FINAL_TRANSCRIPT',
    inputTurnId: 'input-current',
    text: '김영희에게 오만원',
    sttConfidence: 0.93,
  })
  socket.receive({
    type: 'TURN_RESPONSE',
    inputTurnId: 'input-old',
    data: { turnId: 'ai-old', ttsText: '오래된 응답' },
  })
  socket.receive({
    type: 'TURN_RESPONSE',
    inputTurnId: 'input-current',
    data: { turnId: 'ai-current', ttsText: '확인해 주세요.' },
  })
  socket.receive({
    type: 'PARTIAL_TRANSCRIPT',
    inputTurnId: 'input-current',
    text: '늦게 도착한 전사',
  })

  assert.deepEqual(received.partial, [{ inputTurnId: 'input-current', text: '김영' }])
  assert.deepEqual(received.final, [
    {
      inputTurnId: 'input-current',
      text: '김영희에게 오만원',
      sttConfidence: 0.93,
    },
  ])
  assert.deepEqual(received.responses, [
    {
      inputTurnId: 'input-current',
      data: { turnId: 'ai-current', ttsText: '확인해 주세요.' },
    },
  ])

  await stream.close()
})

test('voice stream accepts only the matching cancellation completion', async () => {
  resetSockets()
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket',
    WebSocketClass: FakeWebSocket,
  })
  const socket = FakeWebSocket.instances[0]
  socket.open()

  const cancellationPromise = stream.bargeIn({
    target: 'AI_TTS',
    interruptedAiTurnId: 'ai-current',
  })
  socket.receive({
    type: 'CANCELLED',
    target: 'AI_TTS',
    interruptedAiTurnId: 'ai-old',
    readyForStart: true,
  })
  socket.receive({
    type: 'CANCEL_ACK',
    target: 'AI_TTS',
    interruptedAiTurnId: 'ai-current',
    readyForStart: false,
  })

  let settled = false
  cancellationPromise.then(() => {
    settled = true
  })
  await nextTick()
  assert.equal(settled, false)

  socket.receive({
    type: 'CANCELLED',
    target: 'AI_TTS',
    interruptedAiTurnId: 'ai-current',
    readyForStart: true,
  })
  await cancellationPromise
  assert.equal(stream.getState().bargeInPending, null)

  await stream.close()
})

test('voice stream resets a turn after sequence errors and reports a safe local code', async () => {
  resetSockets()
  const errors = []
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket',
    WebSocketClass: FakeWebSocket,
    onError: (error) => errors.push(error),
  })
  const socket = FakeWebSocket.instances[0]
  socket.open()

  const startPromise = stream.start('input-1')
  socket.receive({ type: 'START_ACK', inputTurnId: 'input-1', nextSequence: 0 })
  await startPromise

  assert.throws(
    () => stream.send(frame(2)),
    (error) => error.code === 'VOICE_STREAM_SEQUENCE_INVALID',
  )
  assert.equal(stream.getState().turnOpen, false)
  assert.equal(errors.at(-1).code, 'VOICE_STREAM_SEQUENCE_INVALID')
  assert.equal(
    socket.sent.some((value) => value instanceof ArrayBuffer),
    false,
  )

  await stream.close()
})

test('voice stream maps INVALID_REQUEST and keeps an idle socket available', async () => {
  resetSockets()
  const errors = []
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket',
    WebSocketClass: FakeWebSocket,
    onError: (error) => errors.push(error),
  })
  const socket = FakeWebSocket.instances[0]
  socket.open()
  socket.receive({
    type: 'ERROR',
    code: 'INVALID_REQUEST',
    message: '요청값을 확인해 주세요.',
    retryable: false,
    requestId: 'request-1',
  })

  assert.equal(socket.readyState, FakeWebSocket.OPEN)
  assert.equal(errors[0].code, 'VOICE_STREAM_REJECTED')
  assert.equal(errors[0].message, '요청값을 확인해 주세요.')
  assert.equal(errors[0].requestId, 'request-1')

  await stream.close()
})

test('voice stream resumes an active turn with a fresh ticket and the server received sequence', async () => {
  resetSockets()
  const tickets = []
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket-1',
    getTicket: async () => {
      tickets.push('requested')
      return 'ticket-2'
    },
    reconnectDelayMs: 0,
    WebSocketClass: FakeWebSocket,
  })
  const first = FakeWebSocket.instances[0]
  first.open()

  const startPromise = stream.start('input-1')
  socketReceive(first, { type: 'START_ACK', inputTurnId: 'input-1', nextSequence: 0 })
  await startPromise
  stream.send(frame(0))
  stream.send(frame(1))
  first.receive({ type: 'PCM_ACK', inputTurnId: 'input-1', sequence: 0 })
  first.close(1_006)

  await new Promise((resolve) => setTimeout(resolve, 100))
  const second = FakeWebSocket.instances[1]
  assert.ok(second)
  assert.deepEqual(tickets, ['requested'])
  assert.deepEqual(second.protocols, ['voice-stream-v1', 'ticket.ticket-2'])

  second.open()
  assert.deepEqual(sentJson(second, 0), {
    type: 'RESUME',
    inputTurnId: 'input-1',
    lastReceivedSequence: 0,
  })
  assert.equal(second.sent[1] instanceof ArrayBuffer, true)
  assert.equal(sequenceOf(second.sent[1]), 1)

  await stream.close()
})

test('voice stream rejects a skipped PCM sequence before it reaches the socket', async () => {
  resetSockets()
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket',
    WebSocketClass: FakeWebSocket,
  })
  const socket = FakeWebSocket.instances[0]
  socket.open()

  const startPromise = stream.start('input-1')
  socket.receive({ type: 'START_ACK', inputTurnId: 'input-1', nextSequence: 0 })
  await startPromise
  assert.throws(
    () => stream.send(frame(1)),
    (error) => error.code === 'VOICE_STREAM_SEQUENCE_INVALID',
  )

  await stream.close()
})

test('voice stream maps a policy close to unauthorized', async () => {
  resetSockets()
  const errors = []
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket',
    maxReconnectAttempts: 0,
    WebSocketClass: FakeWebSocket,
    onError: (error) => errors.push(error),
  })
  const socket = FakeWebSocket.instances[0]
  socket.open()
  socket.close(1_008)

  assert.equal(errors.at(-1).code, 'VOICE_STREAM_UNAUTHORIZED')
  await stream.close()
})

function socketReceive(socket, payload) {
  socket.receive(payload)
}

test('voice stream ignores PCM acknowledgements from another input turn', async () => {
  resetSockets()
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket-1',
    getTicket: async () => 'ticket-2',
    reconnectDelayMs: 0,
    WebSocketClass: FakeWebSocket,
  })
  const first = FakeWebSocket.instances[0]
  first.open()

  const startPromise = stream.start('input-1')
  first.receive({ type: 'START_ACK', inputTurnId: 'input-1', nextSequence: 0 })
  await startPromise
  stream.send(frame(0))
  first.receive({ type: 'PCM_ACK', inputTurnId: 'input-old', sequence: 0 })
  first.close(1_006)

  await new Promise((resolve) => setTimeout(resolve, 20))
  const second = FakeWebSocket.instances[1]
  second.open()
  assert.deepEqual(sentJson(second, 0), {
    type: 'RESUME',
    inputTurnId: 'input-1',
    lastReceivedSequence: -1,
  })
  assert.equal(second.sent[1] instanceof ArrayBuffer, true)
  assert.equal(sequenceOf(second.sent[1]), 0)

  await stream.close()
})

test('voice stream times out when STOP_ACK never arrives', async () => {
  resetSockets()
  const errors = []
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket',
    stopTimeoutMs: 10,
    WebSocketClass: FakeWebSocket,
    onError: (error) => errors.push(error),
  })
  const socket = FakeWebSocket.instances[0]
  socket.open()
  const startPromise = stream.start('input-1')
  socket.receive({ type: 'START_ACK', inputTurnId: 'input-1', nextSequence: 0 })
  await startPromise

  stream.stop('input-1')
  await new Promise((resolve) => setTimeout(resolve, 25))

  assert.equal(stream.getState().turnOpen, false)
  assert.equal(errors.at(-1).code, 'VOICE_STREAM_STOP_TIMEOUT')
  await stream.close()
})

test('voice stream resumes after STOP_ACK while waiting for TURN_RESPONSE', async () => {
  resetSockets()
  const stream = await openVoiceStream({
    sessionId: 'session-1',
    ticket: 'ticket-1',
    getTicket: async () => 'ticket-2',
    reconnectDelayMs: 0,
    WebSocketClass: FakeWebSocket,
  })
  const first = FakeWebSocket.instances[0]
  first.open()

  const startPromise = stream.start('input-1')
  first.receive({ type: 'START_ACK', inputTurnId: 'input-1', nextSequence: 0 })
  await startPromise
  stream.stop('input-1')
  first.receive({ type: 'STOP_ACK', inputTurnId: 'input-1' })
  first.close(1_006)

  await new Promise((resolve) => setTimeout(resolve, 20))
  const second = FakeWebSocket.instances[1]
  second.open()
  assert.deepEqual(sentJson(second, 0), {
    type: 'RESUME',
    inputTurnId: 'input-1',
    lastReceivedSequence: -1,
  })

  await stream.close()
})
