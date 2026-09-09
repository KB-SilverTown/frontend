<script setup>
import { computed, onMounted } from 'vue'

import { useServiceDataStore } from '@/features/living/stores/serviceData.js'
import { useTransferStore } from '@/features/transfer/stores/transfer.js'

const props = defineProps({
  screenKey: {
    type: String,
    default: '',
  },
})

const transferStore = useTransferStore()
const serviceData = useServiceDataStore()

const RECIPIENT_SCREENS = ['transfer-recipient-select', 'transfer-recipient-confirm']
const ACCOUNT_SCREENS = ['transfer-account-select']
const AMOUNT_SCREENS = ['transfer-amount-confirm']
const CONFIRM_SCREENS = ['transfer-confirm']
const RESULT_SCREENS = ['transfer-complete', 'transfer-failed']

const showRecipients = computed(() => RECIPIENT_SCREENS.includes(props.screenKey))
const showAccounts = computed(() => ACCOUNT_SCREENS.includes(props.screenKey))
const showAmount = computed(() => AMOUNT_SCREENS.includes(props.screenKey))
const showConfirm = computed(() => CONFIRM_SCREENS.includes(props.screenKey))
const showResult = computed(() => RESULT_SCREENS.includes(props.screenKey))
const showFailure = computed(() => props.screenKey === 'transfer-failed')

const accounts = computed(() => serviceData.accounts ?? [])
const candidates = computed(() => transferStore.candidates ?? [])
const prepared = computed(() => transferStore.prepared)
const result = computed(() => transferStore.result)
const failureMessage = computed(
  () =>
    transferStore.error?.message ||
    result.value?.message ||
    '은행에서 처리하지 못했어요. 돈은 그대로 있으니 안심하세요.',
)

const amountCandidates = computed(() => transferStore.validation?.amountCandidates ?? [])
const amountOptions = computed(() => {
  const selected = Number(transferStore.draftAmount)
  if (!Number.isSafeInteger(selected) || selected <= 0) return []

  const options = [selected, ...amountCandidates.value]
  if (selected === 50000) options.push(500000)
  return [...new Set(options.filter((value) => Number.isSafeInteger(Number(value)) && value > 0))]
})

function formatAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : '금액 확인 중'
}

function spokenAmount(value) {
  if (Number(value) === 50000) return '오만원'
  if (Number(value) === 500000) return '오십만원'
  return formatAmount(value)
}

function accountName(account) {
  return account?.accountName || account?.accountType || '계좌'
}

function accountLabel(account) {
  return `${accountName(account)} · ${account?.accountNumberMasked ?? ''}`.trim()
}

function recipientLabel(candidate) {
  const parts = [candidate?.displayName, candidate?.relationship, candidate?.accountNumberMasked]
  return parts.filter(Boolean).join(' · ')
}

onMounted(() => {
  if (showAccounts.value && !accounts.value.length) {
    serviceData.loadAccounts({ active: true }).catch(() => {})
  }
})
</script>

<template>
  <section
    aria-label="송금 진행"
    class="transfer-flow-panel"
  >
    <div
      v-if="showRecipients"
      aria-label="받는 분 고르기"
      class="flex flex-col gap-3"
      role="radiogroup"
    >
      <strong class="text-[15px]">받는 분을 골라주세요</strong>

      <p
        v-if="!candidates.length"
        class="text-lg leading-relaxed"
      >
        아직 찾은 분이 없어요. 아래 단추로 다시 찾아주세요.
      </p>

      <button
        v-for="candidate in candidates"
        :key="candidate.recipientId"
        :aria-checked="transferStore.selectedRecipient?.recipientId === candidate.recipientId"
        class="flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-5 text-left text-lg"
        :class="
          transferStore.selectedRecipient?.recipientId === candidate.recipientId
            ? 'border-primary bg-muted font-bold'
            : ''
        "
        role="radio"
        type="button"
        @click="transferStore.selectRecipient(candidate)"
      >
        <span>{{ recipientLabel(candidate) }}</span>
        <b v-if="transferStore.selectedRecipient?.recipientId === candidate.recipientId">✓</b>
      </button>
    </div>

    <div
      v-if="showAccounts"
      aria-label="출금 계좌 고르기"
      class="flex flex-col gap-3"
      role="radiogroup"
    >
      <strong class="text-[15px]">어느 계좌에서 보낼까요</strong>

      <p
        v-if="serviceData.loading.accounts"
        class="text-lg"
      >
        계좌를 불러오는 중이에요.
      </p>
      <p
        v-else-if="!accounts.length"
        class="text-lg leading-relaxed"
      >
        사용할 수 있는 계좌가 없어요.
      </p>

      <button
        v-for="account in accounts"
        :key="account.accountId"
        :aria-checked="transferStore.fromAccount?.accountId === account.accountId"
        class="flex min-h-16 flex-col items-start justify-center gap-1 rounded-2xl border px-5 py-3 text-left"
        :class="
          transferStore.fromAccount?.accountId === account.accountId
            ? 'border-primary bg-muted font-bold'
            : ''
        "
        role="radio"
        type="button"
        @click="transferStore.selectAccount(account)"
      >
        <span class="text-lg">{{ accountLabel(account) }}</span>
        <span class="text-[15px] text-muted-foreground">{{ formatAmount(account.balance) }}</span>
      </button>
    </div>

    <div
      v-if="showAmount"
      class="transfer-amount-review"
    >
      <section
        aria-labelledby="transfer-amount-heading"
        class="transfer-amount-callout"
      >
        <span id="transfer-amount-heading">확인할 금액</span>
        <strong>{{ formatAmount(transferStore.draftAmount) }}</strong>
        <p>{{ spokenAmount(transferStore.draftAmount) }}이 맞습니까?</p>
      </section>
      <div
        v-if="amountOptions.length"
        class="transfer-amount-options"
        role="radiogroup"
        aria-label="금액 다시 고르기"
      >
        <button
          v-for="value in amountOptions"
          :key="value"
          :aria-checked="Number(transferStore.draftAmount) === Number(value)"
          class="transfer-amount-option"
          :class="{ 'is-selected': Number(transferStore.draftAmount) === Number(value) }"
          role="radio"
          type="button"
          @click="transferStore.setAmount(value)"
        >
          <span>{{ spokenAmount(value) }}</span>
          <b v-if="Number(transferStore.draftAmount) === Number(value)">✓</b>
        </button>
      </div>
    </div>

    <div
      v-if="showConfirm && prepared"
      aria-label="보내는 내용 확인"
      class="transfer-confirm-card"
    >
      <strong class="transfer-summary-title">이대로 보낼까요?</strong>
      <dl class="transfer-summary-list">
        <div class="transfer-summary-row">
          <dt>받는 분</dt>
          <dd>{{ prepared.recipient?.displayName || transferStore.recipientName || '확인 중' }}</dd>
        </div>
        <div class="transfer-summary-row is-amount">
          <dt>보내는 금액</dt>
          <dd>{{ formatAmount(prepared.amount ?? transferStore.amount) }}</dd>
        </div>
        <div class="transfer-summary-row">
          <dt>출금 계좌</dt>
          <dd class="transfer-summary-account">
            <span>{{ accountName(transferStore.fromAccount) }}</span>
            <small>{{ transferStore.fromAccount?.accountNumberMasked }}</small>
          </dd>
        </div>
      </dl>
    </div>

    <div
      v-if="showResult"
      class="transfer-result-card"
    >
      <template v-if="showFailure">
        <div
          class="flex flex-col gap-2"
          role="alert"
        >
          <strong class="text-xl">송금을 처리하지 못했어요</strong>
          <p class="text-lg leading-relaxed">{{ failureMessage }}</p>
        </div>
        <div
          v-if="result?.amount ?? transferStore.amount"
          class="transfer-summary-row"
        >
          <span>보내려던 금액</span
          ><b>{{ formatAmount(result?.amount ?? transferStore.amount) }}</b>
        </div>
      </template>
      <template v-else-if="result">
        <div class="transfer-summary-row is-amount">
          <span>보낸 금액</span>
          <b>{{ formatAmount(result.amount) }}</b>
        </div>
        <div class="transfer-summary-row">
          <span>상태</span>
          <b>{{ result.status === 'SUCCESS' ? '완료' : result.status }}</b>
        </div>
      </template>
      <p
        v-else
        class="text-lg leading-relaxed"
      >
        아직 보낸 내역이 없어요.
      </p>
    </div>

    <p
      v-if="transferStore.error && !showFailure"
      class="text-[15px] leading-relaxed text-destructive"
      role="alert"
    >
      {{ transferStore.error.message }}
    </p>
  </section>
</template>
