import assert from 'node:assert/strict'
import test from 'node:test'

import { createTransferVoiceController } from '../../../src/features/voice/services/voiceTransferController.js'
import { createVoiceActivityDetector } from '../../../src/features/voice/services/voiceVad.js'

function samples(amplitude, length = 100) {
  return Float32Array.from({ length }, () => amplitude)
}

function frame(sequence) {
  const value = new ArrayBuffer(6)
  new DataView(value).setUint32(0, sequence, false)
  return value
}

function nextTick() {
  return new Promise((resolve) => setImmediate(resolve))
}

function createHarness({ speaking = true, turnId = 'ai-1', inputTurnId = 'input-1' } = {}) {
  const calls = []
  let speakingState = speaking
  let captureOptions
  let captureStopped = 0
  let resolveBargeIn
  let resolveStart
  let bargeInPromise = null
  let startPromise = null

  const stream = {
    start: (newInputTurnId) => {
      calls.push(['start', newInputTurnId])
      startPromise = new Promise((resolve) => {
        resolveStart = resolve
      })
      return startPromise
    },
    send: (value) => calls.push(['send', value]),
    stop: (newInputTurnId) => calls.push(['stop', newInputTurnId]),
    bargeIn: (request) => {
      calls.push(['bargeIn', request])
      bargeInPromise = new Promise((resolve) => {
        resolveBargeIn = resolve
      })
      return bargeInPromise
    },
    close: async () => calls.push(['close']),
  }

  const controller = createTransferVoiceController({
    getSessionId: () => 'session-1',
    getCurrentTurnId: () => turnId,
    isSpeaking: () => speakingState,
    issueStreamTicket: async () => ({ ticket: 'ticket-1' }),
    createStream: async (options) => {
      stream.options = options
      return stream
    },
    createCapture: async (options) => {
      captureOptions = options
      return {
        resetSequence: () => calls.push(['resetSequence']),
        stop: async () => {
          captureStopped += 1
          calls.push(['captureStop'])
        },
      }
    },
    createVad: () =>
      createVoiceActivityDetector({
        sampleRate: 1_000,
        startThreshold: 0.05,
        ttsStartThreshold: 0.1,
        endThreshold: 0.03,
        minSpeechMs: 100,
        ttsMinSpeechMs: 100,
        endSilenceMs: 200,
      }),
    createTurnId: () => inputTurnId,
    onBeforeBargeIn: (request) => {
      speakingState = false
      calls.push(['beforeBargeIn', request])
    },
    onBargeInPending: (request) => calls.push(['bargeInPending', request]),
    onBargeInReady: (event) => calls.push(['bargeInReady', event]),
    onStartPending: (event) => calls.push(['startPending', event]),
    onStartReady: (event) => calls.push(['startReady', event]),
    onInputStart: (event) => calls.push(['inputStart', event]),
    onInputEnd: (event) => calls.push(['inputEnd', event]),
    onStopPending: (event) => calls.push(['stopPending', event]),
    onStopAck: (event) => calls.push(['stopAck', event]),
  })

  return {
    calls,
    controller,
    get captureOptions() {
      return captureOptions
    },
    get captureStopped() {
      return captureStopped
    },
    get resolveBargeIn() {
      return resolveBargeIn
    },
    get resolveStart() {
      return resolveStart
    },
    get bargeInPromise() {
      return bargeInPromise
    },
    get startPromise() {
      return startPromise
    },
    stream,
  }
}

test('controller waits for CANCELLED before sending the new START and suppresses duplicate BARGE_IN', async () => {
  const harness = createHarness()
  await harness.controller.startMonitoring()

  harness.captureOptions.onSamples(samples(0.2, 100))
  await nextTick()

  assert.deepEqual(harness.calls.filter(([type]) => type !== 'resetSequence').slice(0, 3), [
    ['beforeBargeIn', { target: 'AI_TTS', interruptedAiTurnId: 'ai-1' }],
    ['bargeInPending', { target: 'AI_TTS', interruptedAiTurnId: 'ai-1' }],
    ['bargeIn', { target: 'AI_TTS', interruptedAiTurnId: 'ai-1' }],
  ])
  assert.equal(
    harness.calls.some(([type]) => type === 'start'),
    false,
  )

  // 취소가 끝나기 전 캡처된 선행 프레임도 보관하되 socket에는 보내지 않는다.
  harness.captureOptions.onFrame(frame(0))

  // BARGE_IN_PENDING 동안 추가 VAD 블록은 같은 요청을 다시 보내지 않는다.
  harness.captureOptions.onSamples(samples(0.2, 100))
  await nextTick()
  assert.equal(harness.calls.filter(([type]) => type === 'bargeIn').length, 1)

  harness.resolveBargeIn({
    target: 'AI_TTS',
    interruptedAiTurnId: 'ai-1',
    readyForStart: true,
  })
  await nextTick()

  const startCall = harness.calls.find(([type]) => type === 'start')
  assert.deepEqual(startCall, ['start', 'input-1'])
  assert.equal(
    harness.calls.findIndex(([type]) => type === 'start') >
      harness.calls.findIndex(([type]) => type === 'bargeInReady'),
    true,
  )

  // START_ACK 전에는 캡처된 선행 프레임을 socket으로 보내지 않는다.
  assert.equal(harness.calls.filter(([type]) => type === 'send').length, 0)
  assert.equal(harness.controller.getState().phase, 'WAITING_START_ACK')

  harness.resolveStart({ inputTurnId: 'input-1', nextSequence: 0 })
  await nextTick()
  assert.equal(harness.calls.filter(([type]) => type === 'send').length, 1)
  assert.equal(harness.controller.getState().phase, 'STREAMING')

  harness.captureOptions.onSamples(samples(0.2, 100))
  harness.captureOptions.onSamples(samples(0.01, 100))
  harness.captureOptions.onSamples(samples(0.01, 100))
  assert.deepEqual(harness.calls.at(-2), ['stop', 'input-1'])
  assert.deepEqual(harness.calls.at(-1), ['inputEnd', { inputTurnId: 'input-1' }])
  assert.equal(harness.controller.getState().phase, 'WAITING_STOP_ACK')

  harness.stream.options.onStopAck({ inputTurnId: 'input-1' })
  assert.equal(harness.controller.getState().phase, 'WAITING_TURN_RESPONSE')

  await harness.controller.close()
  assert.equal(harness.captureStopped, 1)
  assert.deepEqual(harness.calls.at(-1), ['close'])
})

test('controller forwards only the active input turn and ignores stale responses', async () => {
  const responses = []
  const partial = []
  const final = []
  const harness = createHarness({
    speaking: false,
    turnId: '',
    inputTurnId: 'input-2',
  })

  // Add event callbacks without changing the fake socket contract.
  const originalCreateStream = harness.stream.options
  assert.equal(originalCreateStream, undefined)

  const controller = createTransferVoiceController({
    getSessionId: () => 'session-1',
    getCurrentTurnId: () => '',
    isSpeaking: () => false,
    issueStreamTicket: async () => ({ ticket: 'ticket-1' }),
    createStream: async (options) => {
      harness.stream.options = options
      return harness.stream
    },
    createCapture: async () => ({
      resetSequence() {},
      async stop() {},
    }),
    createVad: () =>
      createVoiceActivityDetector({
        sampleRate: 1_000,
        minSpeechMs: 100,
        endSilenceMs: 200,
      }),
    createTurnId: () => 'input-2',
    onPartial: (event) => partial.push(event),
    onFinal: (event) => final.push(event),
    onTurnResponse: (event) => responses.push(event),
  })

  await controller.startInput()
  await nextTick()

  harness.stream.options.onPartial({ inputTurnId: 'input-old', text: '오래된' })
  harness.stream.options.onPartial({ inputTurnId: 'input-2', text: '김영' })
  harness.stream.options.onFinal({
    inputTurnId: 'input-old',
    text: '오래된 최종',
  })
  harness.stream.options.onFinal({
    inputTurnId: 'input-2',
    text: '김영희에게 오만원',
  })
  harness.stream.options.onTurnResponse({
    inputTurnId: 'input-old',
    data: { turnId: 'ai-old', ttsText: '오래된 응답' },
  })
  harness.stream.options.onTurnResponse({
    inputTurnId: 'input-2',
    data: { turnId: 'ai-2', aiTurnId: 'ai-2', ttsText: '최신 응답' },
  })
  harness.stream.options.onTurnResponse({
    inputTurnId: 'input-2',
    data: { turnId: 'ai-late', ttsText: '늦은 응답' },
  })

  assert.deepEqual(partial, [{ inputTurnId: 'input-2', text: '김영' }])
  assert.deepEqual(final, [{ inputTurnId: 'input-2', text: '김영희에게 오만원' }])
  assert.deepEqual(responses, [
    {
      inputTurnId: 'input-2',
      data: { turnId: 'ai-2', aiTurnId: 'ai-2', ttsText: '최신 응답' },
    },
  ])

  await controller.close()
})

test('controller cancels the active input turn before text fallback cleanup', async () => {
  const harness = createHarness({
    speaking: false,
    turnId: '',
    inputTurnId: 'input-fallback',
  })
  await harness.controller.startInput()
  await nextTick()
  harness.resolveStart({ inputTurnId: 'input-fallback', nextSequence: 0 })
  await nextTick()

  const cancelPromise = harness.controller.cancelForFallback()
  await nextTick()

  assert.deepEqual(harness.calls.at(-1), [
    'bargeIn',
    { target: 'INPUT_STREAM', inputTurnId: 'input-fallback' },
  ])
  assert.equal(
    harness.calls.some(([type]) => type === 'close'),
    false,
  )

  harness.resolveBargeIn({
    target: 'INPUT_STREAM',
    inputTurnId: 'input-fallback',
    readyForStart: true,
  })
  await cancelPromise

  assert.equal(harness.calls.at(-2)[0], 'captureStop')
  assert.equal(harness.calls.at(-1)[0], 'close')
  assert.equal(harness.controller.getState().monitoring, false)
})

test('controller clears a synchronous BARGE_IN failure', async () => {
  const controller = createTransferVoiceController({
    getSessionId: () => 'session-1',
    isSpeaking: () => false,
    issueStreamTicket: async () => ({ ticket: 'ticket-1' }),
    createStream: async () => ({
      bargeIn: () => {
        throw new Error('synchronous failure')
      },
      close: async () => {},
    }),
    createCapture: async () => ({
      resetSequence() {},
      async stop() {},
    }),
    createVad: () => createVoiceActivityDetector({ sampleRate: 1_000 }),
  })

  await controller.startMonitoring()
  await assert.rejects(() => controller.bargeIn('ai-1'), /synchronous failure/)
  assert.equal(controller.getState().bargeInPending, false)
  await controller.close()
})
