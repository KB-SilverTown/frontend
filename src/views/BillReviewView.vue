<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { billsApi } from '@/api/bills.js'
import { withAppLoading } from '@/services/appLoading.js'
import { buildBillConfirmationRequest, isValidBillConfirmationDate, presentBillConfirmation } from '@/services/billConfirmationPresentation.js'
import { presentBill } from '@/services/billPresentation.js'
import '@/styles/bill-review.css'

const route = useRoute()
const router = useRouter()
const bill = ref(null)
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const actionError = ref('')
const notice = ref('')
const form = reactive({ payee: '', amount: '', dueDate: '' })
let requestId = 0

const billId = computed(() => String(route.params.billId ?? '').trim())
const presentedBill = computed(() => (bill.value ? presentBill(bill.value) : null))

function extractBill(value) {
  if (value?.bill && typeof value.bill === 'object') return value.bill
  if (value?.data?.bill && typeof value.data.bill === 'object') return value.data.bill
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) return value.data
  return value
}

function processErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function clearActionState() {
  actionError.value = ''
  notice.value = ''
}

async function loadBill() {
  const currentRequestId = ++requestId
  bill.value = null
  form.payee = ''
  form.amount = ''
  form.dueDate = ''
  loading.value = true
  errorMessage.value = ''
  clearActionState()

  if (!billId.value) {
    loading.value = false
    errorMessage.value = '확인할 고지서를 찾지 못했어요.'
    return
  }

  try {
    await withAppLoading(async () => {
      const response = await billsApi.get(billId.value)
      if (currentRequestId !== requestId) return

      const loadedBill = extractBill(response)
      bill.value = loadedBill
      Object.assign(form, presentBillConfirmation(loadedBill))
    })
  } catch (error) {
    if (currentRequestId === requestId) {
      errorMessage.value = processErrorMessage(
        error,
        '고지서 정보를 불러오지 못했어요. 다시 시도해 주세요.',
      )
    }
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}

function validateForm() {
  if (!form.payee.trim()) return { error: '납부처를 입력해 주세요.' }

  const amount = Number(String(form.amount).replace(/,/g, '').replace(/원/g, '').trim())
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { error: '납부금액을 확인해 주세요.' }
  }

  if (!isValidBillConfirmationDate(form.dueDate)) {
    return { error: '납부기한을 확인해 주세요.' }
  }

  return {
    request: buildBillConfirmationRequest(form),
  }
}

function clearFieldError() {
  actionError.value = ''
  notice.value = ''
}

function isUnexpectedConfirmation(response) {
  const status = String(response?.status ?? '').trim().toUpperCase()
  return status === 'RECONFIRM' || (status && status !== 'CONFIRMED') || response?.executable === false
}

async function confirmBill() {
  if (saving.value) return

  const validation = validateForm()
  if (validation.error) {
    actionError.value = validation.error
    notice.value = ''
    return
  }

  saving.value = true
  clearActionState()

  try {
    const response = await withAppLoading(() => billsApi.confirm(billId.value, validation.request))
    if (isUnexpectedConfirmation(response)) {
      throw new Error('고지서 정보를 다시 확인해 주세요.')
    }

    bill.value = {
      ...bill.value,
      payee: validation.request.confirmedPayee,
      amount: validation.request.confirmedAmount,
      dueDate: validation.request.confirmedDueDate,
    }
    notice.value = '납부 내용을 확인했어요. 다음 단계에서 진행할 수 있습니다.'
  } catch (error) {
    actionError.value = processErrorMessage(
      error,
      '고지서 내용을 확인하지 못했어요. 다시 시도해 주세요.',
    )
  } finally {
    saving.value = false
  }
}

function goBack() {
  return router.push({ name: 'bill-detail', params: { billId: billId.value } })
}

function leave() {
  return router.push({ name: 'bills-home' })
}

watch(() => route.params.billId, loadBill, { immediate: true })
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-review-device">
      <header class="app-header">
        <Button
          aria-label="고지서 상세 화면으로 돌아가기"
          class="app-back-button"
          size="icon"
          variant="secondary"
          @click="goBack"
        >
          ‹
        </Button>
        <strong class="app-brand">귀편한 금융</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main bill-review-main">
        <section class="screen-heading bill-review-heading">
          <h1>납부 내용 확인</h1>
          <p>납부하기 전에 고지서 정보를 확인해 주세요.</p>
        </section>

        <p
          v-if="loading"
          aria-live="polite"
          class="bill-review-status"
          role="status"
        >
          고지서 정보를 불러오고 있어요.
        </p>
        <section
          v-else-if="errorMessage"
          class="bill-review-error"
          role="alert"
        >
          <p>{{ errorMessage }}</p>
          <Button
            variant="secondary"
            @click="loadBill"
          >
            다시 불러오기
          </Button>
        </section>
        <section
          v-else-if="presentedBill"
          aria-label="고지서 납부 내용 확인"
          class="bill-review-card"
        >
          <div class="bill-review-overview">
            <strong>{{ presentedBill.payee }}</strong>
            <p>서버가 인식한 내용을 납부 전에 확인해 주세요.</p>
            <dl>
              <div>
                <dt>현재 납부처</dt>
                <dd>{{ presentedBill.payee }}</dd>
              </div>
              <div>
                <dt>현재 금액</dt>
                <dd>{{ presentedBill.amount }}</dd>
              </div>
              <div>
                <dt>현재 납부기한</dt>
                <dd>{{ presentedBill.dueDate }}</dd>
              </div>
            </dl>
          </div>

          <p
            v-if="actionError"
            class="bill-review-error"
            role="alert"
          >
            {{ actionError }}
          </p>
          <p
            v-if="notice"
            aria-live="polite"
            class="bill-review-notice"
            role="status"
          >
            {{ notice }}
          </p>

          <form
            aria-label="고지서 납부 내용 입력"
            class="bill-review-form"
            @submit.prevent="confirmBill"
          >
            <label class="bill-review-field">
              <span>납부처</span>
              <Input
                v-model="form.payee"
                :disabled="saving"
                aria-label="납부처"
                autocomplete="organization"
                maxlength="100"
                placeholder="납부처"
                required
                @input="clearFieldError"
              />
            </label>
            <label class="bill-review-field">
              <span>납부금액</span>
              <Input
                v-model="form.amount"
                :disabled="saving"
                aria-label="납부금액"
                inputmode="numeric"
                min="1"
                placeholder="납부금액"
                required
                step="1"
                type="number"
                @input="clearFieldError"
              />
            </label>
            <label class="bill-review-field">
              <span>납부기한</span>
              <Input
                v-model="form.dueDate"
                :disabled="saving"
                aria-label="납부기한"
                required
                type="date"
                @input="clearFieldError"
              />
            </label>
            <p class="bill-review-note">
              <b>안내</b> 잘못 인식된 내용은 직접 고친 뒤 확인해 주세요.
            </p>
          </form>
        </section>
      </main>

      <footer class="app-actions bill-review-actions">
        <Button
          v-if="errorMessage"
          class="w-full"
          variant="secondary"
          @click="loadBill"
        >
          다시 불러오기
        </Button>
        <Button
          v-else
          class="w-full"
          :disabled="loading || saving || !presentedBill"
          @click="confirmBill"
        >
          {{ saving ? '확인하고 있어요…' : '내용 확인' }}
        </Button>
        <Button
          class="w-full"
          :disabled="saving"
          variant="secondary"
          @click="errorMessage ? leave() : goBack()"
        >
          {{ errorMessage ? '고지서 목록' : '고지서 상세' }}
        </Button>
      </footer>
    </article>
  </div>
</template>
