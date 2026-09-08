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
const isRecognitionFailed = computed(() => route.name === 'bill-recognition-failed')
const headingTitle = computed(() => (isRecognitionFailed.value ? '인식 실패' : '고지서 읽기'))
const headingDescription = computed(() =>
  isRecognitionFailed.value
    ? '다시 촬영하거나 다른 사진을 선택할 수 있어요.'
    : '사진을 안전하게 확인하고 고지서 정보를 읽고 있어요.',
)

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

async function showRecognitionFailure(message) {
  errorMessage.value = message
  if (!isRecognitionFailed.value) {
    await router.replace({ name: 'bill-recognition-failed', query: route.query })
  }
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
      await showRecognitionFailure('고지서를 읽었지만 확인할 식별자를 받지 못했어요.')
      return
    }

    clearPendingBillImage()
    await router.replace({ name: 'bill-review', params: { billId } })
  } catch (error) {
    if (currentRequestId === requestId) await showRecognitionFailure(processErrorMessage(error))
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
          <h1>{{ headingTitle }}</h1>
          <p>{{ headingDescription }}</p>
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
          <div
            v-if="isRecognitionFailed"
            class="bill-ocr-failure-hero"
          >
            <span
              aria-hidden="true"
              class="bill-ocr-failure-icon"
            >
              !
            </span>
            <div>
              <strong>내용을 읽지 못했어요</strong>
              <p>사진이 흐리거나 잘리지 않았는지 확인해 주세요.</p>
            </div>
          </div>
          <template v-else>
            <strong>고지서를 처리하지 못했어요</strong>
            <p>{{ errorMessage }}</p>
          </template>
          <p
            v-if="isRecognitionFailed"
            class="bill-ocr-failure-detail"
          >
            {{ errorMessage }}
          </p>
          <div class="bill-ocr-failure-actions">
            <Button
              v-if="isRecognitionFailed && voiceSessionId && image"
              @click="processBill"
            >
              같은 사진으로 다시 읽기
            </Button>
            <Button
              @click="backToCamera"
            >
              다시 촬영
            </Button>
            <Button
              variant="secondary"
              @click="backToCamera"
            >
              다른 사진 선택
            </Button>
          </div>
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
