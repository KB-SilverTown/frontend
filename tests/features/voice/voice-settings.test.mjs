import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_VOICE_SETTINGS,
  PITCH_OPTIONS,
  SPEECH_RATE_OPTIONS,
  VOICE_GENDER_OPTIONS,
  normalizeVoiceSettings,
} from '../../../src/features/voice/model/settings.js'
import { createSourceReader } from '../../helpers/source.js'

const readSource = createSourceReader(import.meta.url)
const panelSource = readSource('../../../src/features/voice/components/VoiceSettingsPanel.vue')
const voiceStoreSource = readSource('../../../src/features/voice/stores/voice.js')
const routeViewSource = `${readSource(
  '../../../src/features/service-screen/composables/useServiceScreen.js',
)}\n${readSource('../../../src/features/service-screen/pages/ServiceScreenPage.vue')}`

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
  assert.match(panelSource, /v-for="option in VOICE_GENDER_OPTIONS"/)
  assert.match(panelSource, /v-for="option in SPEECH_RATE_OPTIONS"/)
  assert.match(panelSource, /v-for="option in PITCH_OPTIONS"/)
  assert.match(panelSource, /aria-pressed/)
})
test('preview playback uses the unsaved draft settings', () => {
  assert.match(voiceStoreSource, /settingsOverride/)
  assert.match(panelSource, /voiceStore\.draftSettings/)
  assert.match(panelSource, /voiceStore\.speakText\([\s\S]*voiceStore\.draftSettings/)
})

test('service screen uses the interactive panel for the my-page voice flow', () => {
  assert.match(routeViewSource, /VoiceSettingsPanel/)
  assert.match(routeViewSource, /isVoiceSettingsSelectScreen/)
  assert.match(routeViewSource, /isVoiceSettingsPreviewScreen/)
  assert.match(routeViewSource, /voiceStore\.saveSettings/)
  assert.match(routeViewSource, /voiceStore\.resetDraftSettings/)
})
