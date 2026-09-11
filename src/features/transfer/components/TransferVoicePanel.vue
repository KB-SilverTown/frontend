<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/shared/components/ui/button'
import { isMockTransferEnabled } from '@/features/transfer/api/mockTransfer.js'
import { useServiceDataStore } from '@/features/living/stores/serviceData.js'
import { useTransferStore } from '@/features/transfer/stores/transfer.js'
import { handoffVoiceTransferToManualConfirmation } from '@/features/transfer/services/voiceTransferHandoff.js'
import { applyVoiceTurnToTransferStore } from '@/features/transfer/services/voiceTransferProgress.js'
import {
  playMockTransferRecognition,
  prepareMockTransferDraft,
} from '@/features/transfer/services/mockTransferDemo.js'
import { voiceApi } from '@/features/voice/api/voice.js'
import { TRANSFER_VOICE_PHASE, useVoiceStore } from '@/features/voice/stores/voice.js'

const router = useRouter()
const voiceStore = useVoiceStore()
const transferStore = useTransferStore()
const serviceData = useServiceDataStore()
const mockMode = isMockTransferEnabled()
const draft = ref('')
const showKeyboard = ref(false)
const actionError = ref('')
const focusedIndex = ref(0)
const mockPhase = ref('idle')
const mockTranscript = ref('')
let sessionPromise = null
let mockRunId = 0

const mockBusy = computed(() => ['listening', 'recognizing', 'preparing'].includes(mockPhase.value))
const busy = computed(() => (mockMode ? mockBusy.value : voiceStore.busy || voiceStore.listening))
const transcript = computed(() =>
  mockMode ? mockTranscript.value : voiceStore.partialTranscript || voiceStore.transcript,
)
const isPartialTranscript = computed(() =>
  mockMode
    ? mockPhase.value === 'recognizing'
    : Boolean(voiceStore.partialTranscript) && !voiceStore.error,
)
const transcriptHeading = computed(() => {
  if (!transcript.value) return '말씀하신 내용을 여기에 보여드릴게요'
  if (!mockMode && voiceStore.error) return '인식 중에 들은 내용이에요'
  return isPartialTranscript.value ? '인식하고 있어요' : '이렇게 들었어요'
})
const canSubmitDraft = computed(() => !busy.value && draft.value.trim().length > 0)
const candidateCard = computed(() => (mockMode ? null : voiceStore.selectableCard))
const candidateItems = computed(() => (mockMode ? [] : voiceStore.cardItems))
const isAmountCard = computed(() => candidateCard.value?.type === 'AMOUNT_RECONFIRM')
const candidateHeading = computed(() =>
  isAmountCard.value ? '보낼 금액을 골라주세요' : '받는 분을 골라주세요',
)
const statusLabel = computed(() => {
  if (mockMode) {
    if (mockPhase.value === 'listening') return '듣고 있어요'
    if (mockPhase.value === 'recognizing') return '음성을 글자로 바꾸고 있어요'
    if (mockPhase.value === 'preparing') return '송금 내용을 준비하고 있어요'
    if (mockPhase.value === 'recognized') return '인식이 끝났어요'
  }
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
    if (mockMode) {
      const runId = ++mockRunId
      await playMockTransferRecognition({
        onUpdate: ({ phase, transcript: recognizedText }) => {
          if (runId !== mockRunId) return
          mockPhase.value = phase
          mockTranscript.value = recognizedText
        },
        isCancelled: () => runId !== mockRunId,
      })
      return
    }

    await ensureSession()
    const turn = await voiceStore.listenAndSendTurn()
    await advanceFromVoiceTurn(turn)
  } catch (error) {
    actionError.value = error?.message || '음성을 확인하지 못했어요. 다시 말씀해 주세요.'
    mockPhase.value = 'idle'
    if (!mockMode) showKeyboard.value = true
  }
}

async function confirmMockTranscript() {
  if (!mockMode || mockPhase.value !== 'recognized' || busy.value) return

  actionError.value = ''
  mockPhase.value = 'preparing'
  try {
    await prepareMockTransferDraft({
      transferStore,
      loadAccounts: () =>
        serviceData.accounts.length
          ? Promise.resolve(serviceData.accounts)
          : serviceData.loadAccounts({ active: true }),
    })
    await router.push({
      name: 'transfer-screen',
      params: { screenKey: 'transfer-amount-confirm' },
    })
  } catch (error) {
    actionError.value = error?.message || '송금 내용을 준비하지 못했어요. 다시 시도해 주세요.'
    mockPhase.value = 'recognized'
  }
}

async function submitDraft() {
  if (!canSubmitDraft.value) return

  actionError.value = ''
  try {
    await ensureSession()
    const turn = await voiceStore.sendTextTurn(draft.value)
    draft.value = ''
    await advanceFromVoiceTurn(turn)
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
    const turn = await voiceStore.acceptCardSelection(item.id)
    await advanceFromVoiceTurn(turn)
  } catch (error) {
    actionError.value = error?.message || '선택을 확인하지 못했어요. 다시 해주세요.'
  }
}

async function handoffToManualConfirmation(turn) {
  const transferId = await handoffVoiceTransferToManualConfirmation({
    turn,
    sessionId: voiceStore.sessionId,
    transferStore,
    loadAccounts: () =>
      serviceData.accounts.length
        ? Promise.resolve(serviceData.accounts)
        : serviceData.loadAccounts({ active: true }),
    selectAccount: transferStore.selectAccount,
    handoffSession: voiceApi.handoffToManualConfirmation,
  })
  if (!transferId) return false

  voiceStore.silence()
  await voiceStore.stopVoiceResources()
  await router.push({
    name: 'transfer-screen',
    params: { screenKey: 'transfer-confirm' },
  })
  return true
}

async function advanceFromVoiceTurn(turn) {
  const screenKey = applyVoiceTurnToTransferStore(turn, transferStore)
  if (screenKey === 'transfer-confirm') return handoffToManualConfirmation(turn)
  if (!screenKey || screenKey === 'transfer-listening') return false

  voiceStore.silence()
  await voiceStore.stopVoiceResources()
  await router.push({ name: 'transfer-screen', params: { screenKey } })
  return true
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
    if (mockMode) return
    const focusedItemId = voiceStore.focusedItemId
    const serverFocusedIndex = candidateItems.value.findIndex((item) => item?.id === focusedItemId)
    focusedIndex.value = serverFocusedIndex >= 0 ? serverFocusedIndex : 0
  },
)

onMounted(() => {
  void listen()
})

onBeforeUnmount(() => {
  mockRunId += 1
  if (!mockMode) {
    voiceStore.silence()
    void voiceStore.stopVoiceResources()
  }
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
          {
            'is-listening': mockMode
              ? ['listening', 'recognizing'].includes(mockPhase)
              : voiceStore.listening || voiceStore.busy,
          },
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
      class="transfer-voice-transcript is-active"
      aria-live="polite"
    >
      <small><b aria-hidden="true">●</b> {{ transcriptHeading }}</small>
      <strong
        >{{ transcript || '마이크를 누르고 말씀해 주세요.'
        }}<i
          v-if="isPartialTranscript"
          aria-hidden="true"
      /></strong>
    </section>

    <section
      v-if="mockMode && mockPhase === 'recognized'"
      class="transfer-voice-guide"
    >
      <b aria-hidden="true">✓</b>
      <span>
        <strong>인식한 문장이 맞나요?</strong>
        <small>맞으면 금액부터 차례로 확인할게요.</small>
      </span>
      <div class="transfer-voice-card-actions">
        <Button @click="confirmMockTranscript">이 문장이 맞아요</Button>
        <Button
          variant="secondary"
          @click="listen"
          >다시 듣기</Button
        >
      </div>
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
      v-if="!mockMode"
      class="transfer-voice-keyboard"
      variant="secondary"
      @click="showKeyboard = !showKeyboard"
    >
      {{ showKeyboard ? '키보드 닫기' : '키보드로 입력' }}
    </Button>

    <div
      v-if="!mockMode && showKeyboard"
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
