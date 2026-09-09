/**
 * Float32 마이크 샘플에서 발화 시작과 끝을 찾는 가벼운 VAD다.
 *
 * Web Audio worklet이 넘기는 블록 크기에 의존하지 않도록 시간을 샘플 수로
 * 누적한다. 시작·종료 임계값을 다르게 둬 작은 볼륨 변화로 상태가 흔들리지 않게
 * 하고, 말하지 않는 동안에는 주변 소음 바닥을 조금씩 학습한다.
 *
 * TTS 재생 중에는 안내 음성의 잔향을 사용자 발화로 잘못 판단하지 않도록
 * 더 큰 시작 임계값과 더 긴 지속시간을 사용한다. 실제 발화로 판정되면
 * 컨트롤러가 즉시 TTS를 끊고, 이후 VAD 상태를 새 입력에 맞춰 초기화한다.
 */

const DEFAULT_SAMPLE_RATE = 16_000
const DEFAULT_START_THRESHOLD = 0.045
const DEFAULT_END_THRESHOLD = 0.025
const DEFAULT_TTS_START_THRESHOLD = 0.09
const DEFAULT_MIN_SPEECH_MS = 120
const DEFAULT_TTS_MIN_SPEECH_MS = 260
const DEFAULT_END_SILENCE_MS = 450
const DEFAULT_NOISE_FLOOR = 0.008
const DEFAULT_NOISE_MULTIPLIER = 2.5
const DEFAULT_NOISE_SMOOTHING = 0.02

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export function calculateRms(samples) {
  if (!samples?.length) return 0

  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

export function createVoiceActivityDetector(options = {}) {
  const sampleRate = positiveNumber(options.sampleRate, DEFAULT_SAMPLE_RATE)
  const startThreshold = positiveNumber(options.startThreshold, DEFAULT_START_THRESHOLD)
  const endThreshold = positiveNumber(options.endThreshold, DEFAULT_END_THRESHOLD)
  const ttsStartThreshold = positiveNumber(
    options.ttsStartThreshold,
    Math.max(DEFAULT_TTS_START_THRESHOLD, startThreshold * 2),
  )
  const minSpeechSamples = Math.max(
    1,
    Math.round((sampleRate * positiveNumber(options.minSpeechMs, DEFAULT_MIN_SPEECH_MS)) / 1_000),
  )
  const ttsMinSpeechSamples = Math.max(
    minSpeechSamples,
    Math.round(
      (sampleRate *
        positiveNumber(
          options.ttsMinSpeechMs,
          Math.max(DEFAULT_TTS_MIN_SPEECH_MS, DEFAULT_MIN_SPEECH_MS * 2),
        )) /
        1_000,
    ),
  )
  const endSilenceSamples = Math.max(
    1,
    Math.round((sampleRate * positiveNumber(options.endSilenceMs, DEFAULT_END_SILENCE_MS)) / 1_000),
  )
  const noiseMultiplier = positiveNumber(options.noiseMultiplier, DEFAULT_NOISE_MULTIPLIER)
  const noiseSmoothing = Math.min(
    positiveNumber(options.noiseSmoothing, DEFAULT_NOISE_SMOOTHING),
    1,
  )
  const initialNoiseFloor = Math.max(
    0,
    Number.isFinite(Number(options.noiseFloor)) ? Number(options.noiseFloor) : DEFAULT_NOISE_FLOOR,
  )

  let noiseFloor = initialNoiseFloor
  let speechSamples = 0
  let silenceSamples = 0
  let speaking = false
  let ttsPlaying = false

  function reset() {
    noiseFloor = initialNoiseFloor
    speechSamples = 0
    silenceSamples = 0
    speaking = false
  }

  function setTtsPlaying(value) {
    const nextValue = Boolean(value)
    if (ttsPlaying === nextValue) return

    const wasSpeaking = speaking
    ttsPlaying = nextValue
    speechSamples = 0
    silenceSamples = 0
    if (!wasSpeaking) {
      speaking = false
    }
  }

  function process(samples) {
    const length = samples?.length ?? 0
    const rms = calculateRms(samples)
    const result = {
      speechStart: false,
      speechEnd: false,
      speaking,
      rms,
    }

    if (!length) return result

    const activeStartThreshold = ttsPlaying ? ttsStartThreshold : startThreshold
    const activeMinSpeechSamples = ttsPlaying ? ttsMinSpeechSamples : minSpeechSamples

    if (!speaking) {
      if (rms >= activeStartThreshold && rms >= noiseFloor * noiseMultiplier) {
        speechSamples += length
      } else {
        speechSamples = 0
        // VAD가 열려 있지 않을 때만 소음 바닥을 학습한다. 발화 중에는
        // 사용자의 작은 목소리를 소음으로 흡수하지 않는다.
        noiseFloor += (rms - noiseFloor) * noiseSmoothing
        noiseFloor = Math.max(0, Math.min(noiseFloor, activeStartThreshold))
      }

      if (speechSamples >= activeMinSpeechSamples) {
        speaking = true
        silenceSamples = 0
        result.speechStart = true
      }
    } else if (rms < endThreshold) {
      silenceSamples += length
      if (silenceSamples >= endSilenceSamples) {
        speaking = false
        speechSamples = 0
        silenceSamples = 0
        result.speechEnd = true
      }
    } else {
      silenceSamples = 0
    }

    result.speaking = speaking
    return result
  }

  return {
    process,
    reset,
    setTtsPlaying,
    isTtsPlaying: () => ttsPlaying,
    isSpeaking: () => speaking,
  }
}
