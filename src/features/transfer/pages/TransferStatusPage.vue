<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import VoiceConversationPanel from '@/features/voice/components/VoiceConversationPanel.vue'
import { TRANSFER_VOICE_PHASE, useVoiceStore } from '@/features/voice/stores/voice.js'
import TransferPageShell from '@/features/transfer/components/TransferPageShell.vue'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({ screenKey: { type: String, required: true } })
const router = useRouter()
const route = useRoute()
const voiceStore = useVoiceStore()
const isVoiceTransfer = computed(() => props.screenKey === 'transfer-listening')
const states = {
  'transfer-listening': ['듣는 중', '송금할 내용을 말씀해 주세요.', '', ''],
  'transfer-processing': ['처리 중', '요청을 안전하게 확인하고 있어요.', '취소', 'transfer-home'],
  'transfer-speaking': [
    '읽어드리는 중',
    '제가 이해한 내용을 읽어드려요.',
    '다시 말하기',
    'transfer-listening',
  ],
  'transfer-contacts-permission': [
    '연락처 권한 없음',
    '직접 이름으로 찾을 수 있어요.',
    '직접 찾기',
    'transfer-recipient-select',
  ],
  'transfer-voice-recognition-failed': [
    '음성 인식 실패',
    '직접 입력으로 계속할 수 있어요.',
    '직접 입력',
    'transfer-recipient-select',
  ],
  'transfer-recipient-not-found': [
    '받는 분을 못 찾았어요',
    '이름을 다시 확인해 주세요.',
    '다시 찾기',
    'transfer-listening',
  ],
  'transfer-not-sent': [
    '보내지 않았어요',
    '계좌에서 빠져나간 금액이 없어요.',
    '홈으로',
    'transfer-home',
  ],
  'transfer-replay': [
    '다시 들려드릴게요',
    '방금 안내를 다시 읽어드려요.',
    '확인',
    'transfer-conversation-ended',
  ],
  'transfer-misheard': [
    '잘못 들었나요',
    '틀린 부분을 고쳐서 다시 확인해 주세요.',
    '다시 말하기',
    'transfer-listening',
  ],
  'transfer-conversation-ended': [
    '음성 대화 끝',
    '필요하실 때 다시 송금할 수 있어요.',
    '홈으로',
    'transfer-home',
  ],
}
const VOICE_CARD_STATES = {
  RECIPIENT_CANDIDATES: ['받는 분 선택', '읽어드린 후보 중 받는 분을 골라주세요.'],
  AMOUNT_RECONFIRM: ['금액 재확인', '보낼 금액을 한 번 더 확인해 주세요.'],
  TRANSFER_READBACK: ['최종 확인', '받는 분과 금액을 읽어드리고 있어요.'],
  TRANSFER_RISK_CHECK: ['위험 확인', '안전을 위해 송금 목적을 확인할게요.'],
  TRANSFER_HELD: ['송금 보류', '안전을 위해 송금을 잠시 보류했어요.'],
}
const voiceState = computed(() => {
  const cardState = VOICE_CARD_STATES[voiceStore.displayCard?.type]
  if (cardState) return [...cardState, '', '']
  if (voiceStore.transferPhase === TRANSFER_VOICE_PHASE.WAITING_TURN_RESPONSE)
    return ['처리 중', '말씀하신 내용을 안전하게 확인하고 있어요.', '', '']
  if (voiceStore.transferPhase === TRANSFER_VOICE_PHASE.TTS_PLAYING)
    return ['읽어드리는 중', '제가 이해한 내용을 읽어드리고 있어요.', '', '']
  return states['transfer-listening']
})
const state = computed(() => {
  if (isVoiceTransfer.value) return voiceState.value
  return (
    states[props.screenKey] || ['송금 안내', '송금 내용을 확인합니다.', '홈으로', 'transfer-home']
  )
})
function primary() {
  const target = state.value[3]
  return router.push(
    target === 'transfer-home'
      ? { name: target }
      : { name: 'transfer-screen', params: { screenKey: target } },
  )
}
</script>

<template>
  <TransferPageShell
    :title="state[0]"
    :description="state[1]"
    :primary-label="state[2]"
    @back="goBackOrReplace(router, { name: 'transfer-home' })"
    @primary="primary"
  >
    <VoiceConversationPanel
      v-if="isVoiceTransfer"
      :auto-start="route.query.voice === '1'"
      entry-point="TRANSFER"
      :screen-key="screenKey"
    />
    <section
      v-else
      class="service-route-screen-content screen-content"
    >
      <div class="content">
        <section class="hero">
          <div class="hero-icon">!</div>
          <div>
            <strong>{{ state[0] }}</strong>
            <p>{{ state[1] }}</p>
          </div>
        </section>
      </div>
    </section>
  </TransferPageShell>
</template>
