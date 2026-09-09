<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import VoiceConversationPanel from '@/features/voice/components/VoiceConversationPanel.vue'
import VoicePageShell from '@/features/voice/components/VoicePageShell.vue'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

defineProps({
  screenKey: { type: String, required: true },
})

const router = useRouter()
const route = useRoute()
const VOICE_CONTEXTS = {
  bills: {
    title: '고지서 음성 도움',
    description: '고지서 금액과 납부기한을 말로 확인할 수 있습니다.',
    entryPoint: 'BILL_PAYMENT',
    returnRoute: { name: 'bills-home' },
    inputPlaceholder: '예: 이번 달 고지서 알려줘',
  },
  living: {
    title: '생활금융 음성 도움',
    description: '계좌, 납부 알림과 이동점포를 말로 찾을 수 있습니다.',
    entryPoint: 'GENERAL_FINANCE',
    returnRoute: { name: 'living-home' },
    inputPlaceholder: '예: 이번 달 납부 알림 알려줘',
  },
  general: {
    title: '음성 명령 켜짐',
    description: '필요한 금융 내용을 편하게 말씀해 주세요.',
    entryPoint: 'GENERAL_FINANCE',
    returnRoute: { name: 'transfer-home' },
    inputPlaceholder: '예: 김영희에게 오만원 보내줘',
  },
}
const source = computed(() =>
  route.query.source === 'bills' ? 'bills' : route.query.source === 'living' ? 'living' : 'general',
)
const voiceContext = computed(() => VOICE_CONTEXTS[source.value])
</script>

<template>
  <VoicePageShell
    :back-route="voiceContext.returnRoute"
    :description="voiceContext.description"
    :title="voiceContext.title"
    @back="goBackOrReplace(router, voiceContext.returnRoute)"
  >
    <VoiceConversationPanel
      :entry-point="voiceContext.entryPoint"
      :screen-key="screenKey"
      :return-route="voiceContext.returnRoute"
      :input-placeholder="voiceContext.inputPlaceholder"
    />
  </VoicePageShell>
</template>
