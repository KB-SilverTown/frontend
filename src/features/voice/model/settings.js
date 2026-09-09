export const DEFAULT_VOICE_SETTINGS = Object.freeze({
  ttsVoice: 'ko-KR-JiMinNeural',
  speechRateMultiplier: 1.05,
  pitchMultiplier: 0.97,
  volumeMultiplier: 1,
})

export const VOICE_GENDER_OPTIONS = Object.freeze([
  {
    value: 'ko-KR-GookMinNeural',
    label: '남성 목소리',
    description: '낮고 또렷한 안내 음성',
  },
  {
    value: 'ko-KR-JiMinNeural',
    label: '여성 목소리',
    description: '차분하고 편안한 안내 음성',
  },
])

export const SPEECH_RATE_OPTIONS = Object.freeze([
  { value: 0.9, label: '느리게' },
  { value: 0.95, label: '조금 느리게' },
  { value: 1, label: '보통' },
  { value: 1.05, label: '조금 빠르게' },
  { value: 1.2, label: '빠르게' },
])

export const PITCH_OPTIONS = Object.freeze([
  { value: 0.85, label: '낮게' },
  { value: 0.97, label: '보통' },
  { value: 1.1, label: '높게' },
])

function nearestOptionValue(value, options, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback

  return options.reduce((closest, option) => {
    const closestDistance = Math.abs(Number(closest) - number)
    const optionDistance = Math.abs(option.value - number)
    return optionDistance < closestDistance ? option.value : closest
  }, fallback)
}

function normalizeVolume(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_VOICE_SETTINGS.volumeMultiplier
  return Math.min(Math.max(number, 1), 1.2)
}

export function normalizeVoiceSettings(value = {}) {
  const source = value || {}
  const ttsVoice = VOICE_GENDER_OPTIONS.some(({ value: option }) => option === source.ttsVoice)
    ? source.ttsVoice
    : DEFAULT_VOICE_SETTINGS.ttsVoice

  return {
    ttsVoice,
    speechRateMultiplier: nearestOptionValue(
      source.speechRateMultiplier,
      SPEECH_RATE_OPTIONS,
      DEFAULT_VOICE_SETTINGS.speechRateMultiplier,
    ),
    pitchMultiplier: nearestOptionValue(
      source.pitchMultiplier,
      PITCH_OPTIONS,
      DEFAULT_VOICE_SETTINGS.pitchMultiplier,
    ),
    volumeMultiplier: normalizeVolume(source.volumeMultiplier),
  }
}

export function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || options[0]?.label || ''
}
