<script setup>
import { useRouter } from 'vue-router'

import VoiceConversationPanel from '@/features/voice/components/VoiceConversationPanel.vue'
import VoicePageShell from '@/features/voice/components/VoicePageShell.vue'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

defineProps({
  screenKey: { type: String, required: true },
})

const router = useRouter()
</script>

<template>
  <VoicePageShell
    :back-route="{ name: 'transfer-home' }"
    description="생활금융에서도 말로 조작할 수 있습니다."
    title="음성 명령 켜짐"
    @back="goBackOrReplace(router, { name: 'transfer-home' })"
  >
    <VoiceConversationPanel
      entry-point="GENERAL_FINANCE"
      :screen-key="screenKey"
    />
  </VoicePageShell>
</template>
