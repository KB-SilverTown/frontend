<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { Button } from '@/shared/components/ui/button'
import { TRANSFER_VOICE_PHASE, useVoiceStore } from '@/features/voice/stores/voice.js'

const voiceStore = useVoiceStore()
const draft = ref('')
const showKeyboard = ref(false)
const actionError = ref('')
let sessionPromise = null

const busy = computed(() => voiceStore.busy || voiceStore.listening)
const transcript = computed(() => voiceStore.partialTranscript || voiceStore.transcript)
const canSubmitDraft = computed(() => !busy.value && draft.value.trim().length > 0)
const statusLabel = computed(() => {
  if (voiceStore.transferPhase === TRANSFER_VOICE_PHASE.TEXT_FALLBACK) {
    return '글자로 입력해 주세요'
  }
  if (voiceStore.listening || voiceStore.busy) return '듣고 있어요'
  return '마이크를 준비하고 있어요'
})

function ensureSession() {
  if (voiceStore.sessionId) return Promise.resolve()
  if (sessionPromise) return sessionPromise

  sessionPromise = voiceStore.startSession('TRANSFER').finally(() => {
    sessionPromise = null
  })
  return sessionPromise
}

async function listen() {
  if (busy.value) return

  actionError.value = ''
  try {
    await ensureSession()
    await voiceStore.listenAndSendTurn()
  } catch {
    actionError.value = '음성을 확인하지 못했어요. 다시 말씀해 주세요.'
    showKeyboard.value = true
  }
}

async function submitDraft() {
  if (!canSubmitDraft.value) return

  actionError.value = ''
  try {
    await ensureSession()
    await voiceStore.sendTextTurn(draft.value)
    draft.value = ''
  } catch (error) {
    actionError.value = error?.message || '입력하신 내용을 보내지 못했어요.'
  }
}

onMounted(() => {
  void listen()
})

onBeforeUnmount(() => {
  voiceStore.silence()
  void voiceStore.stopVoiceResources()
})
</script>

<template>
  <section
    aria-label="송금 음성 입력"
    class="transfer-voice-panel"
  >
    <button
      :aria-label="busy ? '음성을 듣고 있어요' : '음성으로 다시 입력하기'"
      class="transfer-voice-stage"
      :disabled="busy"
      type="button"
      @click="listen"
    >
      <span
        class="transfer-voice-rings"
        aria-hidden="true"
      >
        <i /><i /><i />
      </span>
      <span
        class="transfer-voice-mic"
        aria-hidden="true"
        >●</span
      >
      <span
        :class="[
          'transfer-voice-wave',
          { 'is-listening': voiceStore.listening || voiceStore.busy },
        ]"
        aria-hidden="true"
      >
        <i
          v-for="height in [18, 28, 40, 52, 35, 46, 30, 52, 40, 28, 18]"
          :key="height"
          :style="{ height: `${height}px` }"
        />
      </span>
      <strong class="transfer-voice-status"><b aria-hidden="true">●</b> {{ statusLabel }}</strong>
    </button>

    <section
      v-if="transcript"
      class="transfer-voice-transcript is-active"
      aria-live="polite"
    >
      <small
        ><b aria-hidden="true">●</b> {{ transcript ? '인식하고 있어요' : '말씀해 주세요' }}</small
      >
      <strong
        >{{ transcript || '김영희에게 오만원 보내줘'
        }}<i
          v-if="voiceStore.partialTranscript"
          aria-hidden="true"
      /></strong>
    </section>

    <section class="transfer-voice-guide">
      <b aria-hidden="true">✓</b>
      <span><strong>말씀해 주세요</strong><small>“김영희에게 오만원 보내줘”</small></span>
    </section>

    <p
      v-if="actionError"
      class="transfer-voice-error"
      role="alert"
    >
      {{ actionError }}
    </p>

    <Button
      class="transfer-voice-keyboard"
      variant="secondary"
      @click="showKeyboard = !showKeyboard"
    >
      {{ showKeyboard ? '키보드 닫기' : '키보드로 입력' }}
    </Button>

    <div
      v-if="showKeyboard"
      class="transfer-voice-keyboard-form"
    >
      <label for="transfer-voice-draft">송금할 내용을 적어주세요</label>
      <input
        id="transfer-voice-draft"
        v-model="draft"
        maxlength="200"
        placeholder="예: 김영희에게 오만원 보내줘"
        type="text"
        @keyup.enter="submitDraft"
      />
      <Button
        :disabled="!canSubmitDraft"
        @click="submitDraft"
        >입력한 내용 보내기</Button
      >
    </div>
  </section>
</template>
