<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import VoiceConversationPanel from '@/components/voice/VoiceConversationPanel.vue'
import { Button } from '@/components/ui/button'
import { useVoiceStore } from '@/stores/voice.js'
import '@/styles/voice.css'

/**
 * 화면 어디서든 음성 도움을 열 수 있게 하는 전역 시트.
 * 서비스 홈의 마이크 단추가 window 이벤트로 이 시트를 연다.
 */
const VOICE_ASSIST_EVENT = 'gwipyeonhan:voice-transfer'
const DEFAULT_ENTRY_POINT = 'TRANSFER'

const route = useRoute()
const router = useRouter()
const voiceStore = useVoiceStore()
const open = ref(false)
const entryPoint = ref(DEFAULT_ENTRY_POINT)

/** 송금 화면 밖에서 음성 도움을 열면 화면 단추로 진행할 길도 함께 보여준다. */
const showTransferShortcut = computed(
  () => entryPoint.value === 'TRANSFER' && !String(route.name ?? '').startsWith('transfer'),
)

function openPanel(event) {
  const requested = String(event?.detail?.entryPoint ?? '').trim()
  entryPoint.value = requested || DEFAULT_ENTRY_POINT
  open.value = true
}

/** 시트를 닫을 때 재생 중인 안내를 남기지 않는다. */
function closePanel() {
  voiceStore.silence()
  open.value = false
}

/** 음성이 어려울 때 화면 단추로 송금을 이어갈 수 있게 한다. */
function openTransferScreen() {
  closePanel()
  return router.push({ name: 'transfer-home' })
}

onMounted(() => {
  window.addEventListener(VOICE_ASSIST_EVENT, openPanel)
})

onBeforeUnmount(() => {
  window.removeEventListener(VOICE_ASSIST_EVENT, openPanel)
  voiceStore.silence()
})
</script>

<template>
  <Transition name="voice-assist">
    <div
      v-if="open"
      aria-label="음성 도움"
      class="voice-assist-overlay"
      role="dialog"
    >
      <div class="voice-assist-sheet">
        <header class="voice-assist-header">
          <strong>음성 도움</strong>
          <Button
            aria-label="음성 도움 닫기"
            size="icon"
            variant="ghost"
            @click="closePanel"
          >
            ✕
          </Button>
        </header>

        <VoiceConversationPanel
          :entry-point="entryPoint"
          @close="closePanel"
        />

        <Button
          v-if="showTransferShortcut"
          class="w-full"
          variant="secondary"
          @click="openTransferScreen"
        >
          화면 단추로 송금하기
        </Button>
      </div>
    </div>
  </Transition>
</template>
