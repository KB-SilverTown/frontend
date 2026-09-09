<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import VoiceConversationPage from '@/features/voice/pages/VoiceConversationPage.vue'
import VoiceSettingsPage from '@/features/voice/pages/VoiceSettingsPage.vue'
import VoiceStatusPage from '@/features/voice/pages/VoiceStatusPage.vue'

const route = useRoute()
const screenKey = computed(() => String(route.params.screenKey || ''))
const isSettingsScreen = computed(() =>
  ['voice-voice-select', 'voice-voice-preview'].includes(screenKey.value),
)
</script>

<template>
  <VoiceSettingsPage
    v-if="isSettingsScreen"
    :screen-key="screenKey"
  />
  <VoiceConversationPage
    v-else-if="screenKey === 'voice-enabled'"
    :screen-key="screenKey"
  />
  <VoiceStatusPage
    v-else
    :screen-key="screenKey"
  />
</template>
