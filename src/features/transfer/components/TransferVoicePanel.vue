<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/shared/components/ui/button'
import { TRANSFER_VOICE_PHASE, useVoiceStore } from '@/features/voice/stores/voice.js'

const voiceStore = useVoiceStore()
const draft = ref('')
const showKeyboard = ref(false)
const actionError = ref('')
const focusedIndex = ref(0)
let sessionPromise = null

const busy = computed(() => voiceStore.busy || voiceStore.listening)
const transcript = computed(() => voiceStore.partialTranscript || voiceStore.transcript)
const canSubmitDraft = computed(() => !busy.value && draft.value.trim().length > 0)
const candidateCard = computed(() => voiceStore.selectableCard)
const candidateItems = computed(() => voiceStore.cardItems)
const isAmountCard = computed(() => candidateCard.value?.type === 'AMOUNT_RECONFIRM')
const candidateHeading = computed(() =>
  isAmountCard.value ? '보낼 금액을 골라주세요' : '받는 분을 골라주세요',
)
const statusLabel = computed(() => {
  if (voiceStore.transferPhase === TRANSFER_VOICE_PHASE.TEXT_FALLBACK) {
    return '글자로 입력해 주세요'
  }
  if (voiceStore.transferPhase === TRANSFER_VOICE_PHASE.WAITING_TURN_RESPONSE) {
    return '내용을 확인하고 있어요'
  }
  if (voiceStore.listening) return '듣고 있어요'
  if (voiceStore.busy) return '음성 입력을 준비하고 있어요'
  return '마이크를 준비하고 있어요'
})

function candidateLabel(item) {
  if (isAmountCard.value) {
    const amount = Number(item?.amount)
    return item?.label || (Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : '금액')
  }

  const parts = [item?.displayName || item?.name, item?.relationship, item?.accountNumberMasked]
  return parts.filter(Boolean).join(' · ') || '받는 분'
}

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

function focusCandidate(index) {
  focusedIndex.value = index
}

async function confirmSelection() {
  actionError.value = ''
  const item = candidateItems.value[focusedIndex.value]
  if (!item?.id) {
    actionError.value = '고르신 항목을 찾지 못했어요. 다시 골라주세요.'
    return
  }

  try {
    await voiceStore.acceptCardSelection(item.id)
  } catch (error) {
    actionError.value = error?.message || '선택을 확인하지 못했어요. 다시 해주세요.'
  }
}

async function rejectSelection() {
  actionError.value = ''
  try {
    await voiceStore.rejectCardSelection()
  } catch (error) {
    actionError.value = error?.message || '다시 고를 수 없었어요.'
  }
}

async function cancelFlow() {
  actionError.value = ''
  try {
    await voiceStore.cancelCardFlow()
  } catch (error) {
    actionError.value = error?.message || '송금을 취소하지 못했어요.'
  }
}

watch(
  () => voiceStore.lastTurn,
  () => {
    const focusedItemId = voiceStore.focusedItemId
    const serverFocusedIndex = candidateItems.value.findIndex((item) => item?.id === focusedItemId)
    focusedIndex.value = serverFocusedIndex >= 0 ? serverFocusedIndex : 0
  },
)

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
        ><b aria-hidden="true">●</b>
        {{ voiceStore.partialTranscript ? '인식하고 있어요' : '이렇게 들었어요' }}</small
      >
      <strong
        >{{ transcript || '김영희에게 오만원 보내줘'
        }}<i
          v-if="voiceStore.partialTranscript"
          aria-hidden="true"
      /></strong>
    </section>

    <section
      v-if="candidateCard"
      :aria-label="candidateHeading"
      class="transfer-voice-guide"
      role="radiogroup"
    >
      <span>
        <strong>{{ candidateHeading }}</strong>
        <button
          v-for="(item, index) in candidateItems"
          :key="item.id"
          :aria-checked="index === focusedIndex"
          :disabled="busy"
          class="transfer-voice-card-option"
          role="radio"
          type="button"
          @click="focusCandidate(index)"
        >
          {{ candidateLabel(item) }} {{ index === focusedIndex ? '✓' : '' }}
        </button>
      </span>
      <div class="transfer-voice-card-actions">
        <Button
          :disabled="busy"
          @click="confirmSelection"
          >이게 맞아요</Button
        >
        <Button
          :disabled="busy"
          variant="secondary"
          @click="rejectSelection"
          >다시 고를게요</Button
        >
        <Button
          :disabled="busy"
          variant="ghost"
          @click="cancelFlow"
          >송금 그만두기</Button
        >
      </div>
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
