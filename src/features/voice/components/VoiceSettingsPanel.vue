<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useVoiceStore } from '@/features/voice/stores/voice.js'
import {
  PITCH_OPTIONS,
  SPEECH_RATE_OPTIONS,
  VOICE_GENDER_OPTIONS,
  optionLabel,
} from '@/features/voice/model/settings.js'

const props = defineProps({
  mode: {
    type: String,
    default: 'select',
    validator: (value) => ['select', 'preview'].includes(value),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const voiceStore = useVoiceStore()
const previewState = ref('idle')
const PREVIEW_TEXT = '안녕하세요. 귀편한 금융입니다. 선택하신 목소리로 안내해 드릴게요.'

const selectedVoice = computed(() =>
  VOICE_GENDER_OPTIONS.find(({ value }) => value === voiceStore.draftSettings.ttsVoice),
)
const selectedRate = computed(() =>
  optionLabel(SPEECH_RATE_OPTIONS, voiceStore.draftSettings.speechRateMultiplier),
)
const selectedPitch = computed(() =>
  optionLabel(PITCH_OPTIONS, voiceStore.draftSettings.pitchMultiplier),
)
const previewStatus = computed(() => {
  if (previewState.value === 'playing') return '선택하신 목소리로 들려드리는 중이에요.'
  if (previewState.value === 'complete') return '미리 듣기를 마쳤어요.'
  if (previewState.value === 'unsupported')
    return '이 기기에서는 소리를 재생할 수 없어 글자로 안내해 드려요.'
  if (previewState.value === 'failed') return '미리 듣기를 재생하지 못했어요. 다시 눌러 주세요.'
  return '선택하신 목소리를 미리 들어보세요.'
})

function isSelected(key, value) {
  return voiceStore.draftSettings[key] === value
}

function selectSetting(key, value) {
  if (props.disabled) return
  voiceStore.updateDraftSettings({ [key]: value })
}

async function playPreview() {
  if (props.disabled) return

  previewState.value = 'playing'
  try {
    const result = await voiceStore.speakText(PREVIEW_TEXT, undefined, voiceStore.draftSettings)
    previewState.value = result?.spoken ? 'complete' : 'unsupported'
  } catch {
    previewState.value = 'failed'
  }
}

onMounted(() => {
  if (props.mode === 'preview') playPreview()
})

onBeforeUnmount(() => {
  if (props.mode === 'preview') voiceStore.silence()
})
</script>

<template>
  <section
    aria-label="음성 설정"
    class="voice-settings-panel"
    :aria-busy="disabled"
  >
    <template v-if="mode === 'select'">
      <fieldset class="voice-settings-group">
        <legend>목소리</legend>
        <button
          v-for="option in VOICE_GENDER_OPTIONS"
          :key="option.value"
          :aria-pressed="isSelected('ttsVoice', option.value)"
          class="voice-settings-option"
          :class="{ 'is-selected': isSelected('ttsVoice', option.value) }"
          :disabled="disabled"
          type="button"
          @click="selectSetting('ttsVoice', option.value)"
        >
          <span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </span>
          <b aria-hidden="true">{{ isSelected('ttsVoice', option.value) ? '✓' : '' }}</b>
        </button>
      </fieldset>

      <fieldset class="voice-settings-group">
        <legend>말하기 속도</legend>
        <div class="voice-settings-options voice-settings-options-five">
          <button
            v-for="option in SPEECH_RATE_OPTIONS"
            :key="option.value"
            :aria-pressed="isSelected('speechRateMultiplier', option.value)"
            class="voice-settings-option voice-settings-option-compact"
            :class="{ 'is-selected': isSelected('speechRateMultiplier', option.value) }"
            :disabled="disabled"
            type="button"
            @click="selectSetting('speechRateMultiplier', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </fieldset>

      <fieldset class="voice-settings-group">
        <legend>목소리 높낮이</legend>
        <div class="voice-settings-options voice-settings-options-three">
          <button
            v-for="option in PITCH_OPTIONS"
            :key="option.value"
            :aria-pressed="isSelected('pitchMultiplier', option.value)"
            class="voice-settings-option voice-settings-option-compact"
            :class="{ 'is-selected': isSelected('pitchMultiplier', option.value) }"
            :disabled="disabled"
            type="button"
            @click="selectSetting('pitchMultiplier', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </fieldset>

      <p class="voice-settings-hint">원하는 목소리와 속도를 고른 뒤 미리 들어보세요.</p>
    </template>

    <template v-else>
      <div
        aria-live="polite"
        class="voice-settings-preview-card"
        role="status"
      >
        <span
          aria-hidden="true"
          class="voice-settings-preview-icon"
          >♪</span
        >
        <strong>{{ selectedVoice?.label || '선택한 목소리' }}</strong>
        <p>{{ previewStatus }}</p>
      </div>

      <dl class="voice-settings-summary">
        <div>
          <dt>말하기 속도</dt>
          <dd>{{ selectedRate }}</dd>
        </div>
        <div>
          <dt>목소리 높낮이</dt>
          <dd>{{ selectedPitch }}</dd>
        </div>
      </dl>

      <button
        class="voice-settings-replay"
        :disabled="disabled"
        type="button"
        @click="playPreview"
      >
        다시 들어보기
      </button>
    </template>
  </section>
</template>
