<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TransferFlowPanel from '@/features/transfer/components/TransferFlowPanel.vue'
import TransferPageShell from '@/features/transfer/components/TransferPageShell.vue'
import { useServiceDataStore } from '@/features/living/stores/serviceData.js'
import { useTransferPlanStore } from '@/features/transfer/stores/transferPlan.js'
import { useTransferStore } from '@/features/transfer/stores/transfer.js'
import { voiceApi } from '@/features/voice/api/voice.js'
import { useVoiceStore } from '@/features/voice/stores/voice.js'
import { handoffVoiceTransferToManualConfirmation } from '@/features/transfer/services/voiceTransferHandoff.js'
import { applyVoiceTurnToTransferStore } from '@/features/transfer/services/voiceTransferProgress.js'

const props = defineProps({ screenKey: { type: String, required: true } })
const router = useRouter()
const transfer = useTransferStore()
const plans = useTransferPlanStore()
const serviceData = useServiceDataStore()
const voiceStore = useVoiceStore()
const busy = ref(false)
const error = ref('')
const pin = ref('')
const guardianCode = ref('')
const riskPurpose = ref('')

const titles = {
  'transfer-recipient-select': ['받는 분 선택', '받는 분을 직접 골라주세요.', '다음'],
  'transfer-recipient-confirm': ['이분이 맞나요', '받는 분을 직접 골라주세요.', '다음'],
  'transfer-account-select': ['어느 계좌에서', '돈이 나갈 계좌를 고릅니다.', '다음'],
  'transfer-amount-confirm': [
    '금액 재확인',
    '유사 발음 금액은 한 번 더 확인합니다.',
    '이 금액이 맞아요',
  ],
  'transfer-confirm': ['최종 확인', '받는 분·금액·계좌를 다시 확인해 주세요.', '확인 후 보내기'],
  'transfer-risk-confirm': ['위험 확인', '송금 목적을 알려주세요.', '답변 제출'],
  'transfer-pending': ['송금 보류', '위험 신호가 있어 송금을 잠시 보류했어요.', '보호자 확인'],
  'transfer-guardian-confirm': ['거래 승인', 'PIN 또는 보호자 인증번호를 입력해 주세요.', '확인'],
  'transfer-guardian-message-failed': [
    '보호자 메시지 실패',
    '메시지를 보내지 못했어요.',
    '다시 보내기',
  ],
  'transfer-authentication-expired': ['인증 만료', '인증을 완료할 수 없어요.', '새 인증 요청'],
  'transfer-executing': ['보내는 중', '은행에 송금을 요청합니다.', '송금 실행'],
  'transfer-complete': ['송금 완료', '송금이 완료됐어요.', '확인'],
  'transfer-failed': ['보내지 못했어요', '돈은 그대로 있으니 안심하세요.', '다시 시도하기'],
  'transfer-existing-plan': [
    '하시던 송금이 있어요',
    '마무리하지 못한 송금이 있어요.',
    '이어서 보내기',
  ],
  'transfer-expired': ['시간이 지났어요', '안전을 위해 거래를 닫았어요.', '처음부터 다시'],
}
const page = computed(() => titles[props.screenKey] || ['송금', '송금 내용을 확인합니다.', '확인'])
const primaryLabel = computed(() => {
  if (props.screenKey !== 'transfer-amount-confirm') return page.value[2]
  const amount = Number(transfer.draftAmount)
  if (amount === 50000) return '오만원이 맞아요'
  if (amount === 500000) return '오십만원이 맞아요'
  return amount > 0 ? `${amount.toLocaleString('ko-KR')}원이 맞아요` : page.value[2]
})
const guardianPending = computed(() =>
  Boolean(transfer.guardianVerification && !transfer.guardianVerified),
)
const isCorePanel = computed(() =>
  [
    'transfer-recipient-select',
    'transfer-recipient-confirm',
    'transfer-account-select',
    'transfer-amount-confirm',
    'transfer-confirm',
    'transfer-complete',
    'transfer-failed',
  ].includes(props.screenKey),
)
const flowRoute = (screenKey, query) => ({
  name: 'transfer-screen',
  params: { screenKey },
  ...(query ? { query } : {}),
})
const voiceCardType = computed(() => voiceStore.displayCard?.type ?? '')
const voiceTranscript = computed(() => voiceStore.transcript || voiceStore.partialTranscript || '')

async function handoffVoiceTurn(turn) {
  const transferId = await handoffVoiceTransferToManualConfirmation({
    turn,
    sessionId: voiceStore.sessionId,
    transferStore: transfer,
    loadAccounts: () =>
      serviceData.accounts.length
        ? Promise.resolve(serviceData.accounts)
        : serviceData.loadAccounts({ active: true }),
    selectAccount: transfer.selectAccount,
    handoffSession: voiceApi.handoffToManualConfirmation,
  })
  if (!transferId) return false

  voiceStore.silence()
  await voiceStore.stopVoiceResources()
  await router.push(flowRoute('transfer-confirm'))
  return true
}

async function advanceVoiceTurn(turn) {
  const screenKey = applyVoiceTurnToTransferStore(turn, transfer)
  if (screenKey === 'transfer-confirm') return handoffVoiceTurn(turn)
  if (!screenKey) return false
  await router.push(flowRoute(screenKey))
  return true
}
const resetError = () => {
  error.value = ''
}

async function primary() {
  if (busy.value) return
  resetError()
  busy.value = true
  try {
    if (['transfer-recipient-select', 'transfer-recipient-confirm'].includes(props.screenKey)) {
      if (!transfer.selectedRecipient) throw new Error('받는 분을 직접 선택해 주세요.')
      if (voiceCardType.value === 'RECIPIENT_CANDIDATES') {
        const recipientId = transfer.selectedRecipient.recipientId ?? transfer.selectedRecipient.id
        const turn = await voiceStore.acceptCardSelection(recipientId)
        await advanceVoiceTurn(turn)
        return
      }
      await router.push(flowRoute('transfer-account-select'))
      return
    }
    if (props.screenKey === 'transfer-account-select') {
      if (!transfer.fromAccount) throw new Error('출금할 계좌를 직접 선택해 주세요.')
      await router.push(flowRoute('transfer-amount-confirm'))
      return
    }
    if (props.screenKey === 'transfer-amount-confirm') {
      const amount = transfer.draftAmount
      if (!amount) throw new Error('보낼 금액을 숫자로 입력해 주세요.')
      if (voiceCardType.value === 'AMOUNT_RECONFIRM') {
        const item = voiceStore.cardItems.find(
          (candidate) => Number(candidate?.amount) === Number(amount),
        )
        if (!item?.id) throw new Error('보낼 금액을 다시 선택해 주세요.')
        const turn = await voiceStore.acceptCardSelection(item.id)
        await advanceVoiceTurn(turn)
        return
      }
      const checked = await transfer.validateAmount({
        recognizedAmount: amount,
        amountCandidates: [amount],
      })
      if (transfer.amountReconfirmRequired) return
      const confirmed = Number(checked?.confirmedAmount ?? amount)
      if (!Number.isSafeInteger(confirmed) || confirmed <= 0)
        throw new Error('보낼 금액을 확인해 주세요.')
      transfer.setAmount(confirmed)
      await transfer.prepare({
        fromAccountId: transfer.fromAccount?.accountId ?? transfer.fromAccount?.id,
        recipientId: transfer.selectedRecipient?.recipientId ?? transfer.selectedRecipient?.id,
        amount: confirmed,
      })
      await router.push(flowRoute('transfer-confirm'))
      return
    }
    if (props.screenKey === 'transfer-confirm') {
      if (!transfer.transferId) throw new Error('송금 정보를 다시 확인해 주세요.')
      if (!transfer.riskCleared) {
        const risk = await transfer.assessRisk()
        if (transfer.isRiskHeld(risk)) {
          await router.push(flowRoute('transfer-pending'))
          return
        }
        if (transfer.needsAdditionalRiskCheck(risk)) {
          await router.push(flowRoute('transfer-risk-confirm'))
          return
        }
      }
      const confirmed = await transfer.confirm({ approved: true })
      if (!confirmed?.executable || !transfer.executable)
        throw new Error('지금은 송금을 진행할 수 없어요.')
      await router.push(flowRoute('transfer-guardian-confirm'))
      return
    }
    if (props.screenKey === 'transfer-risk-confirm') {
      if (voiceCardType.value === 'TRANSFER_RISK_CHECK') {
        if (!riskPurpose.value.trim()) throw new Error('송금 목적을 말씀하거나 입력해 주세요.')
        const turn = await voiceStore.sendTextTurn(riskPurpose.value.trim())
        await advanceVoiceTurn(turn)
        return
      }
      const risk = await transfer.checkRisk({ purposeAnswer: riskPurpose.value.trim() || null })
      if (transfer.isRiskHeld(risk)) await router.push(flowRoute('transfer-pending'))
      else if (transfer.needsAdditionalRiskCheck(risk))
        throw new Error('추가 확인이 필요해요. 안내를 다시 확인해 주세요.')
      else await router.push(flowRoute('transfer-confirm'))
      return
    }
    if (
      props.screenKey === 'transfer-pending' ||
      ['transfer-guardian-message-failed', 'transfer-authentication-expired'].includes(
        props.screenKey,
      )
    ) {
      if (voiceCardType.value === 'TRANSFER_HELD') {
        throw new Error('보호자 확인이 끝날 때까지 잠시 기다려 주세요.')
      }
      const started = await transfer.startGuardianVerification()
      if (started?.deliveryFailureCode)
        throw new Error('보호자에게 메시지를 보내지 못했어요. 잠시 후 다시 해주세요.')
      await router.push(flowRoute('transfer-guardian-confirm'))
      return
    }
    if (props.screenKey === 'transfer-guardian-confirm') {
      if (guardianPending.value) {
        if (!guardianCode.value.trim()) throw new Error('보호자에게 온 번호를 입력해 주세요.')
        const verified = await transfer.verifyGuardian(guardianCode.value.trim())
        guardianCode.value = ''
        await router.push(
          flowRoute(verified?.verified ? 'transfer-confirm' : 'transfer-authentication-expired'),
        )
        return
      }
      if (!/^\d{6}$/.test(pin.value)) throw new Error('송금 PIN 6자리를 입력해 주세요.')
      const authenticated = await transfer.authenticate({ pin: pin.value })
      pin.value = ''
      if (!authenticated?.authenticated) {
        await router.push(flowRoute('transfer-authentication-expired'))
        return
      }
      const result = await transfer.execute()
      if (result?.status === 'SUCCESS' && transfer.planId && plans.markSent(transfer.planId))
        transfer.clearPlanId()
      await router.replace(
        flowRoute(result?.status === 'SUCCESS' ? 'transfer-complete' : 'transfer-failed'),
      )
      return
    }
    if (props.screenKey === 'transfer-executing') {
      const result = await transfer.execute()
      if (result?.status === 'SUCCESS' && transfer.planId && plans.markSent(transfer.planId))
        transfer.clearPlanId()
      await router.replace(
        flowRoute(result?.status === 'SUCCESS' ? 'transfer-complete' : 'transfer-failed'),
      )
      return
    }
    if (props.screenKey === 'transfer-complete') return router.push({ name: 'transfer-home' })
    if (props.screenKey === 'transfer-failed') return router.push(flowRoute('transfer-executing'))
    if (props.screenKey === 'transfer-existing-plan')
      return router.push(flowRoute(transfer.transferId ? 'transfer-confirm' : 'transfer-listening'))
    if (props.screenKey === 'transfer-expired') {
      transfer.reset()
      return router.push(flowRoute('transfer-listening'))
    }
  } catch (caught) {
    error.value = caught?.message || '송금을 처리하지 못했어요.'
  } finally {
    busy.value = false
  }
}
async function secondary() {
  if (props.screenKey === 'transfer-existing-plan') {
    if (transfer.transferId) await transfer.cancel().catch(() => {})
    transfer.discardDraft()
    return router.push({ name: 'transfer-home' })
  }
  if (
    ['transfer-guardian-message-failed', 'transfer-authentication-expired'].includes(
      props.screenKey,
    ) &&
    transfer.transferId
  )
    await transfer.cancel().catch(() => {})
  return router.push({ name: 'transfer-home' })
}
watch(
  () => props.screenKey,
  async (key) => {
    error.value = ''
    if (key === 'transfer-account-select' && !serviceData.accounts.length)
      await serviceData.loadAccounts({ active: true }).catch(() => {})
    if (
      key === 'transfer-executing' &&
      (!transfer.confirmationCompleted || !transfer.authenticationCompleted)
    )
      await router.replace(flowRoute('transfer-confirm'))
  },
  { immediate: true },
)
</script>
<template>
  <TransferPageShell
    :title="page[0]"
    :description="page[1]"
    :primary-label="primaryLabel"
    :secondary-label="
      [
        'transfer-existing-plan',
        'transfer-guardian-message-failed',
        'transfer-authentication-expired',
      ].includes(screenKey)
        ? '취소'
        : ''
    "
    :busy="busy || transfer.busy"
    @back="router.push({ name: 'transfer-home' })"
    @primary="primary"
    @secondary="secondary"
    ><template #error>{{ error }}</template>
    <section
      v-if="voiceTranscript"
      aria-live="polite"
      class="rounded-2xl bg-muted p-4 text-lg leading-relaxed"
    >
      <span class="block text-[15px] font-semibold text-muted-foreground">음성으로 들은 내용</span>
      <strong>{{ voiceTranscript }}</strong>
    </section>
    <TransferFlowPanel
      v-if="isCorePanel"
      :screen-key="screenKey" /><label
      v-if="screenKey === 'transfer-risk-confirm'"
      class="service-route-input-field"
      ><span>송금 목적 (선택)</span
      ><input
        v-model="riskPurpose"
        maxlength="500"
        placeholder="예: 생활비"
        type="text" /></label
    ><label
      v-if="screenKey === 'transfer-guardian-confirm'"
      class="service-route-input-field"
      ><span>{{ guardianPending ? '보호자에게 온 인증번호' : '거래 승인 비밀번호' }}</span
      ><input
        v-if="guardianPending"
        v-model="guardianCode"
        maxlength="12"
        autocomplete="one-time-code"
        inputmode="numeric"
        type="password" /><input
        v-else
        v-model="pin"
        class="transfer-pin-input"
        maxlength="6"
        autocomplete="one-time-code"
        inputmode="numeric"
        type="password" /></label
  ></TransferPageShell>
</template>
