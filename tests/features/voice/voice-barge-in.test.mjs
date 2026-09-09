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

test('voice input interrupts current client TTS and invalidates its server turn', async () => {
  setActivePinia(createPinia())

  const originalNativeCheck = Capacitor.isNativePlatform
  const originalEvent = voiceApi.event
  const originalSendTurn = voiceApi.sendTurn
  const events = []
  let recognition

  class FakeRecognition {
    constructor() {
      recognition = this
    }

    start() {}

    abort() {}
  }

  Capacitor.isNativePlatform = () => false
  const restoreWindow = replaceGlobal('window', { SpeechRecognition: FakeRecognition })
  voiceApi.event = async (sessionId, request) => {
    events.push({ sessionId, request })
    return { replayPayload: null }
  }
  voiceApi.sendTurn = async () => ({ turnId: 'turn-2', ttsText: '', ttsSsml: null })

  try {
    const store = useVoiceStore()
    store.sessionId = 'session-1'
    store.session = { sessionId: 'session-1', sttMode: 'CLIENT', status: 'SPEAKING' }
    store.lastTurn = {
      turnId: 'turn-1',
      ttsText: '안내를 읽어드릴게요.',
      ttsSsml: '<speak>안내를 읽어드릴게요.</speak>',
    }
    store.speaking = true

    const pending = store.listenAndSendTurn()
    await new Promise((resolve) => setImmediate(resolve))
    recognition.onresult({
      results: [[{ transcript: '네', confidence: 0.95 }]],
    })
    await pending

    assert.deepEqual(events, [
      {
        sessionId: 'session-1',
        request: { eventType: 'INTERRUPTED', turnId: 'turn-1' },
      },
    ])
    assert.equal(store.transcript, '네')
    assert.equal(store.speaking, false)
  } finally {
    voiceApi.event = originalEvent
    voiceApi.sendTurn = originalSendTurn
    Capacitor.isNativePlatform = originalNativeCheck
    restoreWindow()
  }
})

test('text input interrupts current client TTS before sending the new turn', async () => {
  setActivePinia(createPinia())

  const originalEvent = voiceApi.event
  const originalSendTurn = voiceApi.sendTurn
  const events = []
  voiceApi.event = async (sessionId, request) => {
    events.push({ sessionId, request })
    return { replayPayload: null }
  }
  voiceApi.sendTurn = async () => ({ turnId: 'turn-2', ttsText: '', ttsSsml: null })

  try {
    const store = useVoiceStore()
    store.sessionId = 'session-1'
    store.session = { sessionId: 'session-1', sttMode: 'CLIENT', status: 'SPEAKING' }
    store.lastTurn = { turnId: 'turn-1', ttsText: '안내를 읽어드릴게요.' }
    store.speaking = true

    await store.sendTextTurn('네')

    assert.deepEqual(events, [
      {
        sessionId: 'session-1',
        request: { eventType: 'INTERRUPTED', turnId: 'turn-1' },
      },
    ])
    assert.equal(store.transcript, '네')
    assert.equal(store.speaking, false)
  } finally {
    voiceApi.event = originalEvent
    voiceApi.sendTurn = originalSendTurn
  }
})

test('card input interrupts current client TTS before sending a UI action', async () => {
  setActivePinia(createPinia())

  const originalEvent = voiceApi.event
  const originalUiAction = voiceApi.uiAction
  const events = []
  voiceApi.event = async (sessionId, request) => {
    events.push({ sessionId, request })
    return { replayPayload: null }
  }
  voiceApi.uiAction = async () => ({
    responseTurnId: 'turn-2',
    ttsText: null,
    ttsSsml: null,
    displayCard: {
      type: 'RECIPIENT_CANDIDATES',
      cardId: 'card-1',
      cardVersion: 2,
      items: [{ id: 'recipient-1' }],
    },
  })

  try {
    const store = useVoiceStore()
    store.sessionId = 'session-1'
    store.session = { sessionId: 'session-1', sttMode: 'CLIENT', status: 'SPEAKING' }
    store.lastTurn = {
      turnId: 'turn-1',
      ttsText: '받는 분을 골라주세요.',
      displayCard: {
        type: 'RECIPIENT_CANDIDATES',
        cardId: 'card-1',
        cardVersion: 1,
        items: [{ id: 'recipient-1' }],
      },
    }
    store.speaking = true

    await store.sendUiAction('SELECT_RECIPIENT', 'recipient-1')

    assert.deepEqual(events, [
      {
        sessionId: 'session-1',
        request: { eventType: 'INTERRUPTED', turnId: 'turn-1' },
      },
    ])
    assert.equal(store.speaking, false)
  } finally {
    voiceApi.event = originalEvent
    voiceApi.uiAction = originalUiAction
  }
})

test('backend stream input does not send the CLIENT INTERRUPTED event', async () => {
  setActivePinia(createPinia())

  const originalEvent = voiceApi.event
  const originalSendTurn = voiceApi.sendTurn
  const events = []
  voiceApi.event = async (sessionId, request) => {
    events.push({ sessionId, request })
    return { replayPayload: null }
  }
  voiceApi.sendTurn = async () => ({ turnId: 'turn-2', ttsText: '', ttsSsml: null })

  try {
    const store = useVoiceStore()
    store.sessionId = 'session-1'
    store.session = { sessionId: 'session-1', sttMode: 'BACKEND_STREAM', status: 'SPEAKING' }
    store.lastTurn = { turnId: 'turn-1', ttsText: '안내를 읽어드릴게요.' }
    store.speaking = true

    await store.sendTextTurn('네')

    assert.deepEqual(events, [])
    assert.equal(store.speaking, false)
  } finally {
    voiceApi.event = originalEvent
    voiceApi.sendTurn = originalSendTurn
  }
})

test('client input continues when the INTERRUPTED event cannot be delivered', async () => {
  setActivePinia(createPinia())

  const originalEvent = voiceApi.event
  const originalSendTurn = voiceApi.sendTurn
  voiceApi.event = async () => {
    throw new Error('event unavailable')
  }
  voiceApi.sendTurn = async () => ({ turnId: 'turn-2', ttsText: '', ttsSsml: null })

  try {
    const store = useVoiceStore()
    store.sessionId = 'session-1'
    store.session = { sessionId: 'session-1', sttMode: 'CLIENT', status: 'SPEAKING' }
    store.lastTurn = { turnId: 'turn-1', ttsText: '안내를 읽어드릴게요.' }
    store.speaking = true

    await store.sendTextTurn('네')

    assert.equal(store.transcript, '네')
    assert.equal(store.speaking, false)
  } finally {
    voiceApi.event = originalEvent
    voiceApi.sendTurn = originalSendTurn
  }
})

test('stopping during speech token loading prevents delayed TTS playback', async () => {
  setActivePinia(createPinia())

  const originalIssueSpeechToken = voiceApi.issueSpeechToken
  const originalNativeCheck = Capacitor.isNativePlatform
  let resolveToken
  let speakCalls = 0

  class FakeUtterance {
    constructor() {
      this.onerror = null
    }
  }

  const fakeSpeechSynthesis = {
    speaking: false,
    pending: false,
    getVoices: () => [],
    addEventListener() {},
    removeEventListener() {},
    speak(utterance) {
      speakCalls += 1
      queueMicrotask(() => utterance.onerror?.({ error: 'canceled' }))
    },
    cancel() {},
  }

  voiceApi.issueSpeechToken = () =>
    new Promise((resolve) => {
      resolveToken = resolve
    })
  Capacitor.isNativePlatform = () => false
  const restoreWindow = replaceGlobal('window', {
    speechSynthesis: fakeSpeechSynthesis,
    SpeechSynthesisUtterance: FakeUtterance,
  })

  try {
    const store = useVoiceStore()
    const pendingSpeech = store.speakText('늦게 도착한 안내')
    store.silence()
    resolveToken(null)

    await pendingSpeech

    assert.equal(speakCalls, 0)
  } finally {
    voiceApi.issueSpeechToken = originalIssueSpeechToken
    Capacitor.isNativePlatform = originalNativeCheck
    restoreWindow()
  }
})
