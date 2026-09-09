<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { CONTACTS_PERMISSION_DENIED, getContactCandidates } from '@/services/nativeCapabilities.js'
import { useTransferStore } from '@/stores/transfer.js'
import { useTransferPlanStore } from '@/stores/transferPlan.js'
import '@/styles/transfer.css'

/**
 * 송금은 Prepare → Confirm → Authentication → Execute 순서를 지킨다.
 * 어느 단계도 앞 단계를 건너뛰고 진행하지 않는다.
 */
const STEPS = [
  { key: 'recipient', title: '받는 분', description: '보내실 분을 찾아 골라주세요.' },
  { key: 'account', title: '출금 계좌', description: '어느 계좌에서 보낼지 골라주세요.' },
  { key: 'amount', title: '보내는 금액', description: '보내실 금액을 적어주세요.' },
  { key: 'confirm', title: '내용 확인', description: '이대로 보낼지 확인해 주세요.' },
  { key: 'authenticate', title: '비밀번호', description: '거래 비밀번호를 눌러주세요.' },
  { key: 'result', title: '보낸 결과', description: '송금 결과를 확인해 주세요.' },
]

const router = useRouter()
const transferStore = useTransferStore()
const planStore = useTransferPlanStore()

const stepIndex = ref(0)
const keyword = ref('')
const amountText = ref('')
const pin = ref('')
const actionError = ref('')
const contactsBlocked = ref(false)

const step = computed(() => STEPS[stepIndex.value])
const busy = computed(() => transferStore.busy)
const displayError = computed(() => actionError.value || transferStore.error?.message || '')
const amountCandidates = computed(() => transferStore.validation?.amountCandidates ?? [])
const canSearch = computed(() => !busy.value && keyword.value.trim().length > 0)
const canSubmitAmount = computed(() => !busy.value && Number(transferStore.draftAmount) > 0)
const canAuthenticate = computed(() => !busy.value && pin.value.length >= 6)

function formatAmount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `${parsed.toLocaleString('ko-KR')}원` : '금액 확인 중'
}

function accountLabel(account) {
  if (!account) return '아직 고르지 않았어요'
  const name = account.accountName || account.accountType || '계좌'
  return `${name} · ${account.accountNumberMasked ?? ''}`.trim()
}

function recipientLabel(candidate) {
  return [candidate?.displayName, candidate?.relationship, candidate?.accountNumberMasked]
    .filter(Boolean)
    .join(' · ')
}

function goToStep(key) {
  const index = STEPS.findIndex((item) => item.key === key)
  if (index >= 0) stepIndex.value = index
  actionError.value = ''
}

function goBack() {
  actionError.value = ''
  if (stepIndex.value === 0) {
    router.push({ name: 'transfer-home' })
    return
  }
  stepIndex.value -= 1
}

async function searchRecipients() {
  actionError.value = ''
  try {
    await transferStore.findRecipients({ keyword: keyword.value.trim() })
    if (!transferStore.candidates.length) {
      actionError.value = '찾으시는 분을 찾지 못했어요. 이름을 다시 확인해 주세요.'
    }
  } catch (error) {
    actionError.value = error?.message || '받는 분을 찾지 못했어요.'
  }
}

/**
 * 연락처에서 이름을 가져와 검색어로 넣는다.
 * 권한을 주지 않으면 막지 않고 직접 적어 넣도록 안내한다.
 */
async function fillFromContacts() {
  actionError.value = ''
  contactsBlocked.value = false

  try {
    const contacts = await getContactCandidates()
    const names = contacts.map((contact) => contact.displayName).filter(Boolean)
    if (!names.length) {
      actionError.value = '연락처에서 이름을 찾지 못했어요. 직접 적어주세요.'
      return
    }
    keyword.value = names[0]
  } catch (error) {
    if (error?.code === CONTACTS_PERMISSION_DENIED) {
      contactsBlocked.value = true
      return
    }
    actionError.value = error?.message || '연락처를 읽지 못했어요. 직접 적어주세요.'
  }
}

/** 후보를 고른다. 고르기만으로 다음 단계로 넘어가지 않는다. */
function chooseRecipient(candidate) {
  actionError.value = ''
  try {
    transferStore.selectRecipient(candidate)
  } catch (error) {
    actionError.value = error?.message || '받는 분을 다시 골라주세요.'
  }
}

async function confirmRecipient() {
  if (!transferStore.selectedRecipient) {
    actionError.value = '받는 분을 먼저 골라주세요.'
    return
  }
  goToStep('account')
  if (!transferStore.accounts.length) {
    await transferStore.loadAccounts({ active: true }).catch(() => {})
  }
}

function chooseAccount(account) {
  actionError.value = ''
  try {
    transferStore.selectAccount(account)
  } catch (error) {
    actionError.value = error?.message || '출금 계좌를 다시 골라주세요.'
  }
}

function confirmAccount() {
  if (!transferStore.fromAccount) {
    actionError.value = '출금 계좌를 먼저 골라주세요.'
    return
  }
  goToStep('amount')
}

function changeAmount(value) {
  amountText.value = String(value ?? '')
  transferStore.setAmount(amountText.value)
}

function chooseAmountCandidate(value) {
  changeAmount(value)
}

/** 금액을 서버에서 한 번 더 확인한 뒤 초안을 만든다. */
async function submitAmount() {
  actionError.value = ''
  try {
    await transferStore.validateAmount()
    if (transferStore.amountReconfirmRequired && amountCandidates.value.length) {
      actionError.value = '들은 금액이 확실하지 않아요. 금액을 다시 골라주세요.'
      return
    }
    await transferStore.prepare()
    goToStep('confirm')
  } catch (error) {
    actionError.value = error?.message || '보낼 금액을 확인하지 못했어요.'
  }
}

/**
 * 승인 뒤 위험도를 확인한다. 추가 확인이 필요하면 보호자 인증을 먼저 거친다.
 * 위험도 조회 자체가 실패해도 송금을 막지는 않는다.
 */
async function approveTransfer() {
  actionError.value = ''
  try {
    const response = await transferStore.confirm({ approved: true })
    if (!response?.executable) {
      actionError.value = '아직 보낼 수 있는 상태가 아니에요. 내용을 다시 확인해 주세요.'
      return
    }

    const risk = await transferStore.assessRisk().catch(() => null)
    if (risk && !transferStore.riskCleared) {
      await router.push({ name: 'transfer-guardian' })
      return
    }

    goToStep('authenticate')
  } catch (error) {
    actionError.value = error?.message || '보내는 내용을 확인하지 못했어요.'
  }
}

/** PIN은 요청에만 쓰고 화면과 스토어에 남기지 않는다. */
async function authenticateTransfer() {
  actionError.value = ''
  const enteredPin = pin.value
  try {
    const response = await transferStore.authenticate({ pin: enteredPin })
    if (!response?.authenticated) {
      actionError.value = '비밀번호가 맞지 않아요. 다시 눌러주세요.'
      return
    }
    await transferStore.execute()
    // 실제로 보낸 뒤에만 약속에 기록한다.
    if (transferStore.planId) planStore.markSent(transferStore.planId)
    goToStep('result')
  } catch (error) {
    actionError.value = error?.message || '송금을 마치지 못했어요.'
  } finally {
    pin.value = ''
  }
}

async function cancelTransfer() {
  actionError.value = ''
  try {
    if (transferStore.transferId) await transferStore.cancel()
  } catch (error) {
    actionError.value = error?.message || '송금을 취소하지 못했어요.'
    return
  }
  transferStore.reset()
  router.push({ name: 'transfer-home' })
}

function finish() {
  transferStore.reset()
  router.push({ name: 'transfer-home' })
}

/** 보호자 확인을 마치고 돌아오면 처음이 아니라 비밀번호 단계에서 이어간다. */
function resumeStep() {
  if (transferStore.result) {
    goToStep('result')
    return
  }
  if (transferStore.executable) {
    goToStep('authenticate')
    return
  }
  if (transferStore.prepared) goToStep('confirm')
}

onMounted(() => {
  resumeStep()
  transferStore.loadAccounts({ active: true }).catch(() => {})
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell">
      <header class="app-header">
        <Button
          aria-label="이전 단계"
          class="app-header-button"
          size="icon"
          variant="ghost"
          @click="goBack"
        >
          ←
        </Button>
        <strong class="app-brand">송금</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main transfer-main">
        <section class="screen-heading">
          <span class="transfer-kicker"> {{ stepIndex + 1 }}단계 / {{ STEPS.length }}단계 </span>
          <h1>{{ step.title }}</h1>
          <p>{{ step.description }}</p>
        </section>

        <div class="transfer-content">
          <section
            v-if="step.key === 'recipient'"
            aria-label="받는 분 고르기"
            class="transfer-section"
          >
            <label
              class="transfer-field-label"
              for="recipient-keyword"
            >
              받는 분 이름
            </label>
            <input
              id="recipient-keyword"
              v-model="keyword"
              class="transfer-field"
              maxlength="30"
              placeholder="예: 김영희"
              type="text"
              @keyup.enter="canSearch && searchRecipients()"
            />
            <Button
              class="w-full"
              :disabled="!canSearch"
              variant="secondary"
              @click="searchRecipients"
            >
              받는 분 찾기
            </Button>
            <Button
              class="w-full"
              :disabled="busy"
              variant="ghost"
              @click="fillFromContacts"
            >
              연락처에서 이름 가져오기
            </Button>
            <p
              v-if="contactsBlocked"
              class="transfer-note"
              role="status"
            >
              연락처를 볼 수 있게 허용해 주시면 이름으로 찾아드려요. 지금은 위에 직접 적어주세요.
            </p>

            <div
              v-if="transferStore.candidates.length"
              aria-label="받는 분 후보"
              class="transfer-choice-list"
              role="radiogroup"
            >
              <button
                v-for="candidate in transferStore.candidates"
                :key="candidate.recipientId"
                :aria-checked="
                  transferStore.selectedRecipient?.recipientId === candidate.recipientId
                "
                class="transfer-choice"
                :class="{
                  selected: transferStore.selectedRecipient?.recipientId === candidate.recipientId,
                }"
                role="radio"
                type="button"
                @click="chooseRecipient(candidate)"
              >
                <span>{{ recipientLabel(candidate) }}</span>
                <b v-if="transferStore.selectedRecipient?.recipientId === candidate.recipientId">
                  ✓
                </b>
              </button>
            </div>
          </section>

          <section
            v-else-if="step.key === 'account'"
            aria-label="출금 계좌 고르기"
            class="transfer-section"
          >
            <p
              v-if="transferStore.accountsLoading"
              aria-live="polite"
            >
              계좌를 불러오는 중이에요.
            </p>
            <p v-else-if="!transferStore.accounts.length">사용할 수 있는 계좌가 없어요.</p>

            <div
              v-else
              class="transfer-choice-list"
              role="radiogroup"
            >
              <button
                v-for="account in transferStore.accounts"
                :key="account.accountId"
                :aria-checked="transferStore.fromAccount?.accountId === account.accountId"
                class="transfer-choice transfer-choice-account"
                :class="{ selected: transferStore.fromAccount?.accountId === account.accountId }"
                role="radio"
                type="button"
                @click="chooseAccount(account)"
              >
                <span>{{ accountLabel(account) }}</span>
                <small>{{ formatAmount(account.balance) }}</small>
              </button>
            </div>
          </section>

          <section
            v-else-if="step.key === 'amount'"
            class="transfer-section"
          >
            <label
              class="transfer-field-label"
              for="transfer-amount"
            >
              보내실 금액
            </label>
            <input
              id="transfer-amount"
              class="transfer-field transfer-amount-field"
              inputmode="numeric"
              maxlength="12"
              placeholder="예: 50000"
              type="text"
              :value="amountText"
              @input="changeAmount($event.target.value)"
            />
            <p
              v-if="transferStore.draftAmount"
              class="transfer-amount-preview"
            >
              {{ formatAmount(transferStore.draftAmount) }}
            </p>

            <div
              v-if="transferStore.amountReconfirmRequired && amountCandidates.length"
              aria-label="금액 다시 고르기"
              class="transfer-section transfer-note"
              role="radiogroup"
            >
              <strong>어느 금액이 맞나요</strong>
              <Button
                v-for="value in amountCandidates"
                :key="value"
                class="w-full"
                variant="secondary"
                @click="chooseAmountCandidate(value)"
              >
                {{ formatAmount(value) }}
              </Button>
            </div>
          </section>

          <section
            v-else-if="step.key === 'confirm'"
            aria-label="보내는 내용 확인"
            class="transfer-section transfer-summary"
          >
            <div class="transfer-summary-row">
              <span>받는 분</span>
              <b>{{ transferStore.recipientName || '확인 중' }}</b>
            </div>
            <div class="transfer-summary-row transfer-summary-amount">
              <span>보내는 금액</span>
              <b>{{ formatAmount(transferStore.amount) }}</b>
            </div>
            <div class="transfer-summary-row">
              <span>출금 계좌</span>
              <b>{{ accountLabel(transferStore.fromAccount) }}</b>
            </div>
            <p v-if="transferStore.prepared?.confirmationText">
              {{ transferStore.prepared.confirmationText }}
            </p>
          </section>

          <section
            v-else-if="step.key === 'authenticate'"
            class="transfer-section"
          >
            <label
              class="transfer-field-label"
              for="transfer-pin"
            >
              거래 비밀번호 여섯 자리
            </label>
            <input
              id="transfer-pin"
              v-model="pin"
              autocomplete="off"
              class="transfer-field transfer-pin-field"
              inputmode="numeric"
              maxlength="6"
              type="password"
            />
            <p
              v-if="transferStore.guardianVerified"
              class="transfer-note"
              role="status"
            >
              보호자 확인이 끝났어요. 이제 비밀번호만 눌러주세요.
            </p>
            <p class="transfer-note">비밀번호는 저장하지 않고 확인에만 사용해요.</p>
            <RouterLink
              class="transfer-pin-link"
              :to="{ name: 'transfer-pin', query: { from: 'transfer' } }"
            >
              비밀번호를 아직 정하지 않았어요
            </RouterLink>
          </section>

          <section
            v-else
            class="transfer-section transfer-summary"
          >
            <template v-if="transferStore.result">
              <div class="transfer-summary-row transfer-summary-amount">
                <span>보낸 금액</span>
                <b>{{ formatAmount(transferStore.result.amount) }}</b>
              </div>
              <div class="transfer-summary-row">
                <span>상태</span>
                <b>{{
                  transferStore.result.status === 'SUCCESS' ? '완료' : transferStore.result.status
                }}</b>
              </div>
            </template>
            <p v-else>아직 보낸 내역이 없어요.</p>
          </section>

          <p
            v-if="displayError"
            class="transfer-error"
            role="alert"
          >
            {{ displayError }}
          </p>
        </div>
      </main>

      <footer class="app-actions transfer-actions">
        <Button
          v-if="step.key === 'recipient'"
          class="w-full"
          :disabled="busy || !transferStore.selectedRecipient"
          @click="confirmRecipient"
        >
          이 분에게 보내기
        </Button>
        <Button
          v-else-if="step.key === 'account'"
          class="w-full"
          :disabled="busy || !transferStore.fromAccount"
          @click="confirmAccount"
        >
          이 계좌에서 보내기
        </Button>
        <Button
          v-else-if="step.key === 'amount'"
          class="w-full"
          :disabled="!canSubmitAmount"
          @click="submitAmount"
        >
          금액 확인하기
        </Button>
        <Button
          v-else-if="step.key === 'confirm'"
          class="w-full"
          :disabled="busy"
          @click="approveTransfer"
        >
          이대로 보내기
        </Button>
        <Button
          v-else-if="step.key === 'authenticate'"
          class="w-full"
          :disabled="!canAuthenticate"
          @click="authenticateTransfer"
        >
          비밀번호 확인
        </Button>
        <Button
          v-else
          class="w-full"
          @click="finish"
        >
          송금 홈으로
        </Button>

        <Button
          v-if="step.key !== 'result'"
          class="w-full"
          :disabled="busy"
          variant="secondary"
          @click="cancelTransfer"
        >
          송금 그만두기
        </Button>
      </footer>
    </article>
  </div>
</template>
