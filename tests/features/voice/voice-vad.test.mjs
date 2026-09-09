import assert from 'node:assert/strict'
import test from 'node:test'

import { createVoiceActivityDetector } from '../../../src/features/voice/services/voiceVad.js'

function samples(amplitude, length = 100) {
  return Float32Array.from({ length }, () => amplitude)
}

test('VAD waits for sustained speech and ignores a short noise spike', () => {
  const vad = createVoiceActivityDetector({
    sampleRate: 1_000,
    startThreshold: 0.05,
    endThreshold: 0.03,
    minSpeechMs: 100,
    endSilenceMs: 200,
  })

  assert.equal(vad.process(samples(0.01)).speechStart, false)
  assert.equal(vad.process(samples(0.2, 50)).speechStart, false)
  assert.equal(vad.process(samples(0.01)).speechStart, false)

  assert.equal(vad.process(samples(0.2, 50)).speechStart, false)
  const started = vad.process(samples(0.2, 50))

  assert.equal(started.speechStart, true)
  assert.equal(started.speaking, true)
})

test('VAD ends speech only after the configured trailing silence', () => {
  const vad = createVoiceActivityDetector({
    sampleRate: 1_000,
    startThreshold: 0.05,
    endThreshold: 0.03,
    minSpeechMs: 100,
    endSilenceMs: 200,
  })

  vad.process(samples(0.2, 100))
  assert.equal(vad.isSpeaking(), true)

  assert.equal(vad.process(samples(0.01, 100)).speechEnd, false)
  const ended = vad.process(samples(0.01, 100))

  assert.equal(ended.speechEnd, true)
  assert.equal(ended.speaking, false)
  assert.equal(vad.isSpeaking(), false)
})

test('VAD reset clears a pending speech candidate and speaking state', () => {
  const vad = createVoiceActivityDetector({
    sampleRate: 1_000,
    minSpeechMs: 100,
  })

  vad.process(samples(0.2, 50))
  vad.reset()

  assert.equal(vad.isSpeaking(), false)
  assert.equal(vad.process(samples(0.2, 50)).speechStart, false)
})

test('VAD requires a longer and louder utterance while TTS is playing', () => {
  const vad = createVoiceActivityDetector({
    sampleRate: 1_000,
    startThreshold: 0.05,
    ttsStartThreshold: 0.1,
    minSpeechMs: 100,
    ttsMinSpeechMs: 300,
  })

  vad.setTtsPlaying(true)
  assert.equal(vad.isTtsPlaying(), true)
  assert.equal(vad.process(samples(0.08, 300)).speechStart, false)
  assert.equal(vad.process(samples(0.15, 200)).speechStart, false)
  assert.equal(vad.process(samples(0.15, 100)).speechStart, true)

  vad.reset()
  vad.setTtsPlaying(false)
  assert.equal(vad.isTtsPlaying(), false)
  assert.equal(vad.process(samples(0.08, 100)).speechStart, true)
})

test('changing TTS state clears a candidate that was accumulated under the old threshold', () => {
  const vad = createVoiceActivityDetector({
    sampleRate: 1_000,
    startThreshold: 0.05,
    ttsStartThreshold: 0.1,
    minSpeechMs: 100,
    ttsMinSpeechMs: 300,
  })

  assert.equal(vad.process(samples(0.08, 80)).speechStart, false)
  vad.setTtsPlaying(true)
  assert.equal(vad.process(samples(0.15, 200)).speechStart, false)
})
