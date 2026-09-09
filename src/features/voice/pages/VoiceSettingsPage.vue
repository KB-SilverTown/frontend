<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import VoicePageShell from '@/features/voice/components/VoicePageShell.vue'
import VoiceSettingsPanel from '@/features/voice/components/VoiceSettingsPanel.vue'
import { useVoiceStore } from '@/features/voice/stores/voice.js'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({
  screenKey: { type: String, required: true },
})

const router = useRouter()
const voiceStore = useVoiceStore()
const loading = ref(false)
const actionError = ref('')
const isPreview = computed(() => props.screenKey === 'voice-voice-preview')
const title = computed(() => (isPreview.value ? '미리 듣기' : '목소리 고르기'))
const description = computed(() =>
  isPreview.value
    ? '고른 목소리로 들어보고 저장합니다.'
    : '목소리, 말하기 속도와 높낮이를 직접 정합니다.',
)

function selectRoute() {
  return { name: 'my-page-voice', params: { screenKey: 'voice-voice-select' } }
}

function previewRoute() {
  return { name: 'my-page-voice', params: { screenKey: 'voice-voice-preview' } }
}

async function handlePrimary() {
  actionError.value = ''
  if (!isPreview.value) return router.push(previewRoute())

  loading.value = true
  try {
    await voiceStore.saveSettings(voiceStore.draftSettings)
    await router.push({ name: 'my-page' })
  } catch (error) {
    actionError.value = error?.message || '음성 설정을 저장하지 못했어요. 다시 눌러 주세요.'
  } finally {
    loading.value = false
  }
}

function handleSecondary() {
  actionError.value = ''
  if (!isPreview.value) {
    voiceStore.resetDraftSettings()
    return
  }
  router.push(selectRoute())
}

function handleBack() {
  voiceStore.discardDraftSettings()
  goBackOrReplace(router, { name: 'my-page' })
}

onMounted(async () => {
  loading.value = true
  try {
    await voiceStore.loadSettings()
  } catch (error) {
    actionError.value = error?.message || '음성 설정을 불러오지 못했어요.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <VoicePageShell
    :back-route="{ name: 'my-page' }"
    :busy="loading"
    :description="description"
    :primary-label="isPreview ? '이 목소리로 저장' : '미리 들어보기'"
    :secondary-label="isPreview ? '다시 고르기' : '기본값으로'"
    :title="title"
    @back="handleBack"
    @primary="handlePrimary"
    @secondary="handleSecondary"
  >
    <p
      v-if="actionError"
      class="service-route-error"
      role="alert"
    >
      {{ actionError }}
    </p>
    <section
      aria-label="목소리와 말하기 설정"
      class="service-route-screen-content screen-content voice-settings-content"
    >
      <div class="content">
        <VoiceSettingsPanel
          :disabled="loading"
          :mode="isPreview ? 'preview' : 'select'"
        />
      </div>
    </section>
  </VoicePageShell>
</template>
