<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { billsApi } from '@/api/bills.js'
import { withAppLoading } from '@/services/appLoading.js'
import { presentBillPaymentNumber } from '@/services/billPaymentNumberPresentation.js'
import { presentBill } from '@/services/billPresentation.js'
import '@/styles/bill-detail.css'

const route = useRoute()
const router = useRouter()
const bill = ref(null)
const loading = ref(true)
const errorMessage = ref('')
let requestId = 0

const presentedBill = computed(() => (bill.value ? presentBill(bill.value) : null))
const hasPaymentNumber = computed(() => Boolean(presentBillPaymentNumber(bill.value)))
const isOverdue = computed(() => isOverdueStatus(bill.value))
const pageTitle = computed(() => (isOverdue.value ? '지난 고지서' : '고지서 확인'))
const pageDescription = computed(() =>
  isOverdue.value
    ? '저장해 둔 고지서와 납부 상태를 봅니다.'
    : '납부하기 전에 고지서 내용을 확인해 주세요.',
)
const detailRows = computed(() => {
  if (!presentedBill.value) return []

  return [
    { label: '납부기관', value: presentedBill.value.payee },
    { label: '납부금액', value: presentedBill.value.amount },
    { label: '납부기한', value: presentedBill.value.dueDate },
    { label: '납부상태', value: presentedBill.value.status },
  ]
})

function isOverdueStatus(value) {
  const status = String(value?.status ?? value?.paymentStatus ?? '').trim().toUpperCase()
  return ['OVERDUE', 'LATE'].includes(status)
}

async function loadBill() {
  const currentRequestId = ++requestId
  const billId = String(route.params.billId ?? '').trim()
  bill.value = null
  loading.value = true
  errorMessage.value = ''

  if (!billId) {
    loading.value = false
    errorMessage.value = '확인할 고지서를 찾지 못했어요.'
    return
  }

  try {
    await withAppLoading(async () => {
      const response = await billsApi.get(billId)
      if (currentRequestId !== requestId) return

      const loadedBill = response?.bill && typeof response.bill === 'object' ? response.bill : response
      bill.value = loadedBill
      if (isOverdueStatus(loadedBill) && route.name === 'bill-detail') {
        await router.replace({ name: 'bill-overdue', params: { billId } })
      }
    })
  } catch {
    if (currentRequestId === requestId) {
      errorMessage.value = '고지서 정보를 불러오지 못했어요. 다시 시도해 주세요.'
    }
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}

function goBack() {
  return router.push({ name: 'bills-home' })
}

function openReview() {
  const billId = String(route.params.billId ?? '').trim()
  if (!billId || isOverdue.value) return
  return router.push({ name: 'bill-review', params: { billId } })
}

function openPaymentNumber() {
  const billId = String(route.params.billId ?? '').trim()
  if (!billId || isOverdue.value || !hasPaymentNumber.value) return
  return router.push({ name: 'bill-payment-number', params: { billId } })
}

function openCamera() {
  return router.push({ name: 'bills-camera' })
}

watch(() => route.params.billId, loadBill, { immediate: true })
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-detail-device">
      <header class="app-header">
        <Button
          aria-label="고지서 목록으로 돌아가기"
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

      <main class="app-main bill-detail-main">
        <section class="screen-heading bill-detail-heading">
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageDescription }}</p>
        </section>

        <p
          v-if="loading"
          aria-live="polite"
          class="bill-detail-status"
          role="status"
        >
          고지서 정보를 불러오고 있어요.
        </p>
        <section
          v-else-if="errorMessage"
          class="bill-detail-error"
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
          :aria-label="isOverdue ? '지난 고지서 상세 정보' : '고지서 상세 정보'"
          class="bill-detail-card"
        >
          <div class="bill-detail-hero">
            <span
              aria-hidden="true"
              class="bill-detail-icon"
            >
              {{ isOverdue ? '?' : '✓' }}
            </span>
            <div>
              <strong>{{ isOverdue ? '지난 고지서' : presentedBill.payee }}</strong>
              <p>
                {{
                  isOverdue
                    ? '서버에 저장된 납부 결과를 확인합니다.'
                    : '서버에 저장된 고지서 정보입니다.'
                }}
              </p>
            </div>
          </div>
          <div class="bill-detail-rows">
            <div
              v-for="row in detailRows"
              :key="row.label"
              class="bill-detail-row"
            >
              <span>{{ row.label }}</span>
              <b>{{ row.value }}</b>
            </div>
          </div>
          <p class="bill-detail-note">
            <b>안내</b>
            {{
              isOverdue
                ? '지난 고지서는 납부 상태와 저장된 정보만 확인할 수 있어요.'
                : '납부를 진행하기 전 금액과 납부기한을 한 번 더 확인해 주세요.'
            }}
          </p>
        </section>
      </main>

      <footer class="app-actions bill-detail-actions">
        <Button
          v-if="presentedBill && !loading && !errorMessage && !isOverdue && hasPaymentNumber"
          class="w-full"
          variant="secondary"
          @click="openPaymentNumber"
        >
          납부번호 확인
        </Button>
        <Button
          v-if="presentedBill && !loading && !errorMessage && !isOverdue"
          class="w-full"
          @click="openReview"
        >
          납부 내용 확인
        </Button>
        <Button
          class="w-full"
          @click="goBack"
        >
          고지서 목록
        </Button>
        <Button
          class="w-full"
          variant="secondary"
          @click="openCamera"
        >
          새 고지서 촬영
        </Button>
      </footer>
    </article>
  </div>
</template>
