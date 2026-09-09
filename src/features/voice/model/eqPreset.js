export const EQ_PRESET = Object.freeze({
  BALANCED: 'BALANCED',
  CLEAR_SPEECH: 'CLEAR_SPEECH',
})

export const DEFAULT_EQ_PRESET = EQ_PRESET.BALANCED

export const EQ_PRESET_OPTIONS = Object.freeze([
  {
    value: EQ_PRESET.BALANCED,
    label: '균형 잡힌 소리',
    description: '기본 음색으로 들려드려요.',
  },
  {
    value: EQ_PRESET.CLEAR_SPEECH,
    label: '또렷한 말소리',
    description: '말소리가 더 또렷하게 들리도록 도와드려요.',
  },
])

export const CLEAR_SPEECH_EQ = Object.freeze({
  highPass: Object.freeze({ frequency: 120, q: 0.707 }),
  peaking: Object.freeze({ frequency: 2500, gain: 4, q: 0.9 }),
})

export function normalizeEqPreset(value) {
  return EQ_PRESET_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_EQ_PRESET
}

export function eqPresetLabel(value) {
  return EQ_PRESET_OPTIONS.find((option) => option.value === normalizeEqPreset(value))?.label
}
