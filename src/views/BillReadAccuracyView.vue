<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { billsApi } from '@/api/bills.js'
import { withAppLoading } from '@/services/appLoading.js'
import { presentBillReadAccuracy } from '@/services/billReadAccuracyPresentation.js'
import '@/styles/bill-read-accuracy.css'

const route = useRoute()
const router = useRouter()
const bill = ref(null)
const accuracy = computed(() => (bill.value ? presentBillReadAccuracy(bill.value) : null))
const loading = ref(true)
const errorMessage = ref('')
let requestId = 0

const billId = computed(() => String(route.params.billId ?? '').trim())

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
      bill.value = extractBill(response)
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
  if (!billId.value) return leave()
  return router.push({ name: 'bill-payment-number', params: { billId: billId.value } })
}

function leave() {
  return router.push({ name: 'bills-home' })
}

function openEdit() {
  return router.push({ name: 'bill-low-confidence', params: { billId: billId.value } })
}

function openReview() {
  return router.push({ name: 'bill-review', params: { billId: billId.value } })
}

watch(() => route.params.billId, loadBill, { immediate: true })
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-read-accuracy-device">
      <header class="app-header">
        <Button
          aria-label="납부번호 확인 화면으로 돌아가기"
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

      <main class="app-main bill-read-accuracy-main">
        <section class="screen-heading bill-read-accuracy-heading">
          <h1>읽은 정확도</h1>
          <p>항목마다 얼마나 확실한지 확인해 주세요.</p>
        </section>

        <p
          v-if="loading"
          aria-live="polite"
          class="bill-read-accuracy-status"
          role="status"
        >
          고지서 정보를 불러오고 있어요.
        </p>
        <section
          v-else-if="errorMessage"
          class="bill-read-accuracy-error"
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
          v-else-if="accuracy"
          aria-label="고지서 인식 정확도"
          class="bill-read-accuracy-card"
        >
          <div class="bill-read-accuracy-hero">
            <span
              aria-hidden="true"
              class="bill-read-accuracy-icon"
            >
              {{ accuracy.needsReview ? '?' : '✓' }}
            </span>
            <div>
              <strong>{{ accuracy.needsReview ? '확인할 항목이 있어요' : '인식 결과가 또렷해요' }}</strong>
              <p>흐린 항목만 확인해 주시면 돼요.</p>
            </div>
          </div>
          <dl class="bill-read-accuracy-fields">
            <div
              v-for="field in accuracy.fields"
              :key="field.key"
              class="bill-read-accuracy-field"
            >
              <div class="bill-read-accuracy-field-head">
                <dt>{{ field.label }}</dt>
                <span
                  :class="`bill-read-accuracy-field-status bill-read-accuracy-field-status-${field.statusKey}`"
                >
                  {{ field.statusLabel }}
                </span>
              </div>
              <dd>{{ field.value }}</dd>
            </div>
          </dl>
          <p class="bill-read-accuracy-note">
            <b>안내</b> 흐린 항목은 수정 화면에서 직접 확인할 수 있어요.
          </p>
        </section>
      </main>

      <footer class="app-actions bill-read-accuracy-actions">
        <Button
          v-if="accuracy && !loading && !errorMessage"
          class="w-full"
          @click="openEdit"
        >
          흐린 곳 고치기
        </Button>
        <Button
          v-if="accuracy && !loading && !errorMessage"
          class="w-full"
          variant="secondary"
          @click="openReview"
        >
          이대로 진행
        </Button>
        <Button
          class="w-full"
          :disabled="loading"
          variant="secondary"
          @click="errorMessage ? leave() : goBack()"
        >
          {{ errorMessage ? '고지서 목록' : '납부번호 확인' }}
        </Button>
      </footer>
    </article>
  </div>
</template>
