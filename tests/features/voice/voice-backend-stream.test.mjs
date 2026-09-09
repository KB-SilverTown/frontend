import assert from 'node:assert/strict'
import test from 'node:test'

import { Capacitor } from '@capacitor/core'
import { createPinia, setActivePinia } from 'pinia'

import { voiceApi } from '../../../src/features/voice/api/voice.js'
import { useVoiceStore } from '../../../src/features/voice/stores/voice.js'

function replaceGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, value })
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous)
    else delete globalThis[name]
  }
}

function samples(amplitude, length) {
  return Float32Array.from({ length }, () => amplitude)
}

async function waitFor(predicate, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    const value = predicate()
    if (value) return value
    await new Promise((resolve) => setImmediate(resolve))
  }
  throw new Error('test setup timed out')
}

class FakeWebSocket {
  static OPEN = 1

  static CLOSED = 3

  static instances = []

  constructor(url, protocols) {
    this.url = url
    this.protocols = protocols
    this.readyState = 0
    this.bufferedAmount = 0
    this.sent = []
    FakeWebSocket.instances.push(this)
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN
      this.onopen?.()
    })
  }

  send(payload) {
    this.sent.push(payload)
  }

  receive(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code: 1_000, reason: '' })
  }
}

class FakeAudioContext {
  sampleRate = 16_000

  state = 'running'

  audioWorklet = { addModule: async () => {} }

  destination = {}

  createMediaStreamSource() {
    return {
      connect() {},
      disconnect() {},
    }
  }

  async close() {}

  async resume() {}
}

class FakeAudioWorkletNode {
  static instances = []

  constructor() {
    this.port = { onmessage: null }
    FakeAudioWorkletNode.instances.push(this)
  }

  connect() {}

  disconnect() {}
}

function sentJson(socket, index) {
  return JSON.parse(socket.sent[index])
}

test('backend stream renders only the active turn and never POSTs /turns', async () => {
  setActivePinia(createPinia())
  FakeWebSocket.instances.length = 0
  FakeAudioWorkletNode.instances.length = 0

  const originalIssueStreamTicket = voiceApi.issueStreamTicket
  const originalIssueSpeechToken = voiceApi.issueSpeechToken
  const originalSendTurn = voiceApi.sendTurn
  const originalNativeCheck = Capacitor.isNativePlatform

  let sendTurnCalls = 0
  const restoreWindow = replaceGlobal('window', { AudioContext: FakeAudioContext })
  const restoreNavigator = replaceGlobal('navigator', {
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    },
  })
  const restoreWorklet = replaceGlobal('AudioWorkletNode', FakeAudioWorkletNode)
  const restoreWebSocket = replaceGlobal('WebSocket', FakeWebSocket)

  Capacitor.isNativePlatform = () => false
  voiceApi.issueStreamTicket = async () => ({ ticket: 'ticket-1' })
  voiceApi.issueSpeechToken = async () => null
  voiceApi.sendTurn = async () => {
    sendTurnCalls += 1
    return null
  }

  let store
  try {
    store = useVoiceStore()
    store.sessionId = 'session-1'
    store.session = {
      sessionId: 'session-1',
      flowType: 'TRANSFER',
      sttMode: 'BACKEND_STREAM',
      status: 'LISTENING',
    }

    const pending = store.listenAndSendTurn()
    const socket = await waitFor(() => FakeWebSocket.instances[0])
    const worklet = await waitFor(() => FakeAudioWorkletNode.instances[0])
    const inputTurnId = sentJson(socket, 0).inputTurnId

    assert.match(inputTurnId, /^[0-9a-f-]{36}$/i)
    assert.deepEqual(socket.protocols, ['voice-stream-v1', 'ticket.ticket-1'])
    assert.equal(sentJson(socket, 0).type, 'START')

    // 캡처는 시작됐지만 START_ACK 전에는 PCM이 소켓에 도착하지 않는다.
    worklet.port.onmessage({ data: samples(0.2, 1_600) })
    worklet.port.onmessage({ data: samples(0.2, 1_600) })
    assert.equal(socket.sent.length, 1)

    socket.receive({ type: 'START_ACK', inputTurnId, nextSequence: 0 })
    assert.equal(socket.sent[1] instanceof ArrayBuffer, true)
    assert.equal(new DataView(socket.sent[1]).getUint32(0, false), 0)

    socket.receive({
      type: 'PARTIAL_TRANSCRIPT',
      inputTurnId: 'stale-input',
      text: '오래된 전사',
    })
    socket.receive({
      type: 'PARTIAL_TRANSCRIPT',
      inputTurnId,
      text: '김영',
    })
    assert.equal(store.partialTranscript, '김영')

    socket.receive({
      type: 'FINAL_TRANSCRIPT',
      inputTurnId: 'stale-input',
      text: '오래된 최종',
      sttConfidence: 0.99,
    })
    socket.receive({
      type: 'FINAL_TRANSCRIPT',
      inputTurnId,
      text: '김영희에게 오만원',
      sttConfidence: 0.94,
    })

    // VAD trailing silence가 끝나면 STOP을 보낸다. STOP_ACK는 final이 아니다.
    for (let index = 0; index < 5; index += 1) {
      worklet.port.onmessage({ data: samples(0.01, 1_600) })
    }
    const stopIndex = socket.sent.findIndex(
      (value) =>
        typeof value === 'string' && sentJson(socket, socket.sent.indexOf(value)).type === 'STOP',
    )
    assert.notEqual(stopIndex, -1)
    assert.deepEqual(sentJson(socket, stopIndex), {
      type: 'STOP',
      inputTurnId,
    })

    socket.receive({ type: 'STOP_ACK', inputTurnId })
    socket.receive({
      type: 'TURN_RESPONSE',
      inputTurnId: 'stale-input',
      data: { turnId: 'ai-stale', ttsText: '오래된 응답' },
    })
    socket.receive({
      type: 'TURN_RESPONSE',
      inputTurnId,
      data: {
        turnId: 'ai-1',
        aiTurnId: 'ai-1',
        state: 'AWAITING_AMOUNT',
        ttsText: '',
        ttsSsml: null,
      },
    })

    await pending

    assert.equal(sendTurnCalls, 0)
    assert.equal(store.transcript, '김영희에게 오만원')
    assert.equal(store.partialTranscript, '')
    assert.equal(store.lastTurn.inputTurnId, inputTurnId)
    assert.equal(store.lastTurn.aiTurnId, 'ai-1')
  } finally {
    await store?.stopVoiceResources?.().catch(() => {})
    voiceApi.issueStreamTicket = originalIssueStreamTicket
    voiceApi.issueSpeechToken = originalIssueSpeechToken
    voiceApi.sendTurn = originalSendTurn
    Capacitor.isNativePlatform = originalNativeCheck
    restoreWebSocket()
    restoreWorklet()
    restoreNavigator()
    restoreWindow()
  }
})
