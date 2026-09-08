<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { billsApi } from '@/api/bills.js'
import { withAppLoading } from '@/services/appLoading.js'
import {
  clearPendingBillImage,
  getPendingBillImage,
} from '@/services/billCapture.js'
import '@/styles/bill-ocr.css'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')
const image = ref(getPendingBillImage())
let requestId = 0

const voiceSessionId = computed(() => String(route.query.voiceSessionId ?? '').trim())

function responseBillId(response) {
  const bill = response?.bill ?? response?.data?.bill ?? response?.data ?? response
  return String(bill?.billId ?? bill?.id ?? '').trim()
}

function processErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    '고지서를 읽지 못했어요. 사진을 다시 준비해 주세요.'
  )
}

async function processBill() {
  if (loading.value) return

  image.value = getPendingBillImage()
  errorMessage.value = ''

  if (!image.value) {
    errorMessage.value = '먼저 고지서 사진을 준비해 주세요.'
    return
  }

  if (!voiceSessionId.value) {
    errorMessage.value = '음성 안내를 준비한 뒤 고지서를 처리할 수 있어요.'
    return
  }

  const currentRequestId = ++requestId
  loading.value = true

  try {
    const response = await withAppLoading(() =>
      billsApi.ocr({ image: image.value, voiceSessionId: voiceSessionId.value }),
    )
    if (currentRequestId !== requestId) return

    const billId = responseBillId(response)
    if (!billId) {
      errorMessage.value = '고지서를 읽었지만 확인할 식별자를 받지 못했어요.'
      return
    }

    clearPendingBillImage()
    await router.replace({ name: 'bill-detail', params: { billId } })
  } catch (error) {
    if (currentRequestId === requestId) errorMessage.value = processErrorMessage(error)
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}

function backToCamera() {
  clearPendingBillImage()
  return router.push({ name: 'bills-camera' })
}

function leave() {
  clearPendingBillImage()
  return router.push({ name: 'bills-home' })
}

onMounted(processBill)
watch(voiceSessionId, processBill)
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-ocr-device">
      <header class="app-header">
        <Button
          aria-label="고지서 촬영 화면으로 돌아가기"
          class="app-back-button"
          size="icon"
          variant="secondary"
          @click="backToCamera"
        >
          ‹
        </Button>
        <strong class="app-brand">귀편한 금융</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main bill-ocr-main">
        <section class="screen-heading bill-ocr-heading">
          <h1>고지서 읽기</h1>
          <p>사진을 안전하게 확인하고 고지서 정보를 읽고 있어요.</p>
        </section>

        <section
          v-if="loading"
          aria-live="polite"
          class="bill-ocr-state"
          role="status"
        >
          <strong>고지서를 읽고 있어요</strong>
          <p>납부기관과 금액을 확인하고 있습니다. 잠시만 기다려 주세요.</p>
        </section>
        <section
          v-else-if="errorMessage"
          class="bill-ocr-state bill-ocr-state-error"
          role="alert"
        >
          <strong>고지서를 처리하지 못했어요</strong>
          <p>{{ errorMessage }}</p>
          <Button
            v-if="voiceSessionId && image"
            variant="secondary"
            @click="processBill"
          >
            다시 읽기
          </Button>
          <Button
            variant="secondary"
            @click="backToCamera"
          >
            촬영 화면으로 돌아가기
          </Button>
        </section>
        <section
          v-else
          aria-live="polite"
          class="bill-ocr-state"
          role="status"
        >
          <strong>고지서 읽기를 준비하고 있어요</strong>
          <p>촬영 화면에서 사진을 다시 준비할 수 있습니다.</p>
        </section>
      </main>

      <footer class="app-actions bill-ocr-actions">
        <Button
          class="w-full"
          variant="secondary"
          @click="leave"
        >
          고지서 목록
        </Button>
      </footer>
    </article>
  </div>
</template>
