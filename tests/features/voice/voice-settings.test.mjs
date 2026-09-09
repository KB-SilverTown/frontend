import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_VOICE_SETTINGS,
  PITCH_OPTIONS,
  SPEECH_RATE_OPTIONS,
  VOICE_GENDER_OPTIONS,
  normalizeVoiceSettings,
} from '../../../src/features/voice/model/settings.js'
import {
  CLEAR_SPEECH_EQ,
  DEFAULT_EQ_PRESET,
  EQ_PRESET,
  normalizeEqPreset,
} from '../../../src/features/voice/model/eqPreset.js'
import { eqPresetStorageKey } from '../../../src/features/voice/services/eqPresetStorage.js'
import { createSourceReader } from '../../helpers/source.js'

const readSource = createSourceReader(import.meta.url)
const panelSource = readSource('../../../src/features/voice/components/VoiceSettingsPanel.vue')
const voiceStoreSource = readSource('../../../src/features/voice/stores/voice.js')
const voiceSettingsStyleSource = readSource('../../../src/features/voice/styles/voice-settings.css')
const voiceSettingsPageSource = readSource(
  '../../../src/features/voice/pages/VoiceSettingsPage.vue',
)

test('voice settings expose the requested gender, rate, and pitch choices', () => {
  assert.deepEqual(
    VOICE_GENDER_OPTIONS.map(({ label }) => label),
    ['남성 목소리', '여성 목소리'],
  )
  assert.deepEqual(
    SPEECH_RATE_OPTIONS.map(({ label }) => label),
    ['느리게', '조금 느리게', '보통', '조금 빠르게', '빠르게'],
  )
  assert.deepEqual(
    PITCH_OPTIONS.map(({ label }) => label),
    ['낮게', '보통', '높게'],
  )
})

test('EQ presets use safe defaults and keep CLEAR_SPEECH gain within +6dB', () => {
  assert.equal(DEFAULT_EQ_PRESET, EQ_PRESET.BALANCED)
  assert.equal(normalizeEqPreset(EQ_PRESET.CLEAR_SPEECH), EQ_PRESET.CLEAR_SPEECH)
  assert.equal(normalizeEqPreset('unsupported'), EQ_PRESET.BALANCED)
  assert.equal(CLEAR_SPEECH_EQ.peaking.gain <= 6, true)
})

test('EQ preset storage is versioned and separated per authenticated user', () => {
  assert.notEqual(eqPresetStorageKey('user-a'), eqPresetStorageKey('user-b'))
  assert.match(eqPresetStorageKey('user-a'), /voice-eq-preset\.v1/)
  assert.equal(eqPresetStorageKey(null), null)
})

test('voice settings normalize unsupported values to safe selectable defaults', () => {
  assert.deepEqual(normalizeVoiceSettings({}), DEFAULT_VOICE_SETTINGS)

  const normalized = normalizeVoiceSettings({
    ttsVoice: 'not-supported',
    speechRateMultiplier: 1.14,
    pitchMultiplier: 0.99,
    volumeMultiplier: 1.2,
  })

  assert.equal(normalized.ttsVoice, DEFAULT_VOICE_SETTINGS.ttsVoice)
  assert.equal(normalized.speechRateMultiplier, 1.2)
  assert.equal(normalized.pitchMultiplier, 0.97)
  assert.equal(normalized.volumeMultiplier, 1.2)
})

test('voice settings panel renders every requested option and keeps controls accessible', () => {
  assert.match(panelSource, /VOICE_GENDER_OPTIONS/)
  assert.match(panelSource, /SPEECH_RATE_OPTIONS/)
  assert.match(panelSource, /PITCH_OPTIONS/)
  assert.match(panelSource, /EQ_PRESET_OPTIONS/)
  assert.match(panelSource, /v-for="option in VOICE_GENDER_OPTIONS"/)
  assert.match(panelSource, /v-for="option in SPEECH_RATE_OPTIONS"/)
  assert.match(panelSource, /v-for="option in PITCH_OPTIONS"/)
  assert.match(panelSource, /aria-pressed/)
})
test('speech rate choices stay readable in a two-column layout', () => {
  assert.match(
    voiceSettingsStyleSource,
    /\.voice-settings-options-five\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  )
  assert.match(
    voiceSettingsStyleSource,
    /\.voice-settings-option-compact\s*\{[\s\S]*?font-size:\s*clamp\(18px,\s*5vw,\s*26px\);/,
  )
  assert.match(
    voiceSettingsStyleSource,
    /\.voice-settings-options-five \.voice-settings-option:nth-child\(3\)\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/,
  )
})

test('preview playback uses the unsaved draft settings', () => {
  assert.match(voiceStoreSource, /settingsOverride/)
  assert.match(panelSource, /voiceStore\.draftSettings/)
  assert.match(panelSource, /voiceStore\.speakText\([\s\S]*voiceStore\.draftSettings/)
  assert.match(panelSource, /eqPreset:\s*voiceStore\.draftEqPreset/)
})

test('voice settings page uses the interactive panel for the my-page flow', () => {
  assert.match(voiceSettingsPageSource, /VoiceSettingsPanel/)
  assert.match(voiceSettingsPageSource, /isPreview/)
  assert.match(voiceSettingsPageSource, /voiceStore\.saveSettings/)
  assert.match(voiceSettingsPageSource, /voiceStore\.resetDraftSettings/)
})
