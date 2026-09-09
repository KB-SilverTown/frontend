<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TransferFlowPanel from '@/features/transfer/components/TransferFlowPanel.vue'
import TransferPageShell from '@/features/transfer/components/TransferPageShell.vue'
import { isMockTransferEnabled } from '@/features/transfer/api/mockTransfer.js'
import { useServiceDataStore } from '@/features/living/stores/serviceData.js'
import { useTransferPlanStore } from '@/features/transfer/stores/transferPlan.js'
import { useTransferStore } from '@/features/transfer/stores/transfer.js'

const props = defineProps({ screenKey: { type: String, required: true } })
const router = useRouter()
const transfer = useTransferStore()
const plans = useTransferPlanStore()
const serviceData = useServiceDataStore()
const mockMode = isMockTransferEnabled()
const busy = ref(false)
const error = ref('')
const pin = ref('')
const guardianCode = ref('')
const riskPurpose = ref('')

const titles = {
  'transfer-recipient-select': ['받는 분 선택', '받는 분을 직접 골라주세요.', '다음'],
  'transfer-recipient-confirm': ['이분이 맞나요', '받는 분을 직접 골라주세요.', '다음'],
  'transfer-account-select': ['어느 계좌에서', '돈이 나갈 계좌를 고릅니다.', '다음'],
  'transfer-amount-confirm': ['금액 재확인', '보낼 금액을 확인해 주세요.', '이 금액이 맞아요'],
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
    :primary-label="page[2]"
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
    ><template #error>{{ error }}</template
    ><TransferFlowPanel
      v-if="isCorePanel"
      :screen-key="screenKey"
    /><label
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
        type="password"
      /><input
        v-else
        v-model="pin"
        maxlength="6"
        autocomplete="one-time-code"
        inputmode="numeric"
        type="password"
      /><small
        v-if="mockMode && !guardianPending"
        class="text-[15px] text-muted-foreground"
        >시연용 PIN은 123456입니다.</small
      ></label
    ></TransferPageShell
  >
</template>
