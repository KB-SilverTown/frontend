<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { billsApi } from '@/api/bills.js'
import { withAppLoading } from '@/services/appLoading.js'
import { presentBillPaymentNumber } from '@/services/billPaymentNumberPresentation.js'
import { presentBill } from '@/services/billPresentation.js'
import '@/styles/bill-payment-number.css'

const route = useRoute()
const router = useRouter()
const bill = ref(null)
const loading = ref(true)
const errorMessage = ref('')
let requestId = 0

const billId = computed(() => String(route.params.billId ?? '').trim())
const presentedBill = computed(() => (bill.value ? presentBill(bill.value) : null))
const paymentNumber = computed(() => presentBillPaymentNumber(bill.value))

function extractBill(value) {
  if (value?.bill && typeof value.bill === 'object') return value.bill
  if (value?.data?.bill && typeof value.data.bill === 'object') return value.data.bill
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) return value.data
  return value
}

function processErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

async function loadBill() {
  const currentRequestId = ++requestId
  bill.value = null
  loading.value = true
  errorMessage.value = ''

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
      if (!presentBillPaymentNumber(loadedBill)) {
        errorMessage.value = '서버에서 납부번호를 확인하지 못했어요. 다시 시도해 주세요.'
      }
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

function goBack() {
  return router.push({ name: 'bill-detail', params: { billId: billId.value } })
}

function leave() {
  return router.push({ name: 'bills-home' })
}

function openReview() {
  return router.push({ name: 'bill-review', params: { billId: billId.value } })
}

function openEdit() {
  return router.push({ name: 'bill-low-confidence', params: { billId: billId.value } })
}

watch(() => route.params.billId, loadBill, { immediate: true })
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-payment-number-device">
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

      <main class="app-main bill-payment-number-main">
        <section class="screen-heading bill-payment-number-heading">
          <h1>납부번호 확인</h1>
          <p>읽어낸 납부번호가 맞는지 확인해 주세요.</p>
        </section>

        <p
          v-if="loading"
          aria-live="polite"
          class="bill-payment-number-status"
          role="status"
        >
          고지서 정보를 불러오고 있어요.
        </p>
        <section
          v-else-if="errorMessage"
          class="bill-payment-number-error"
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
          v-else-if="paymentNumber"
          aria-label="납부번호 확인"
          class="bill-payment-number-card"
        >
          <div class="bill-payment-number-hero">
            <span
              aria-hidden="true"
              class="bill-payment-number-icon"
            >
              ✓
            </span>
            <div>
              <strong>납부번호를 읽었어요</strong>
              <p>{{ presentedBill?.payee || '고지서' }}의 서버 인식 결과입니다.</p>
            </div>
          </div>
          <dl class="bill-payment-number-value">
            <dt>납부번호</dt>
            <dd>{{ paymentNumber }}</dd>
          </dl>
          <p class="bill-payment-number-note">
            <b>안내</b> 한 자리만 달라도 다른 곳으로 갈 수 있으니 꼭 확인해 주세요.
          </p>
        </section>
      </main>

      <footer class="app-actions bill-payment-number-actions">
        <Button
          v-if="paymentNumber && !loading && !errorMessage"
          class="w-full"
          @click="openReview"
        >
          맞아요
        </Button>
        <Button
          v-if="paymentNumber && !loading && !errorMessage"
          class="w-full"
          variant="secondary"
          @click="openEdit"
        >
          고칠게요
        </Button>
        <Button
          class="w-full"
          :disabled="loading"
          variant="secondary"
          @click="errorMessage ? leave() : goBack()"
        >
          {{ errorMessage ? '고지서 목록' : '고지서 상세' }}
        </Button>
      </footer>
    </article>
  </div>
</template>
