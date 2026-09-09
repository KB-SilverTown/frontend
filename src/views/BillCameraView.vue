<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { captureVideoFrame, photoToBlob, takeBillPhoto } from '@/services/nativeCapabilities.js'
import {
  clearPendingBillImage,
  setPendingBillImage,
} from '@/services/billCapture.js'
import { isPdfBillFile, validateBillFile } from '@/services/billFileValidation.js'
import '@/styles/bill-camera.css'

const route = useRoute()
const router = useRouter()
const billCameraVideo = ref(null)
const billCameraReady = ref(false)
const billCameraPreviewUrl = ref('')
const billCameraPreviewType = ref('')
const sourceSelection = ref(true)
const actionBusy = ref(false)
const actionError = ref('')
const actionErrorCode = ref('')
const actionNotice = ref('')
let billCameraStream = null
let billCameraRequestId = 0
let pendingBillImage = null

const actionErrorTitle = computed(() => {
  if (actionErrorCode.value === 'UNSUPPORTED_BILL_FILE') return '파일을 올릴 수 없어요'
  if (actionErrorCode.value === 'BILL_FILE_TOO_LARGE') return '파일이 너무 커요'
  if (actionErrorCode.value === 'CAMERA_PERMISSION') return '카메라 권한이 필요해요'
  return '고지서 사진을 준비하지 못했어요'
})

function clearBillCameraPreview() {
  const objectUrl = globalThis.URL
  if (billCameraPreviewUrl.value && typeof objectUrl?.revokeObjectURL === 'function') {
    objectUrl.revokeObjectURL(billCameraPreviewUrl.value)
  }
  billCameraPreviewUrl.value = ''
  billCameraPreviewType.value = ''
}

function stopBillCamera() {
  billCameraRequestId += 1
  billCameraStream?.getTracks().forEach((track) => track.stop())
  billCameraStream = null
  billCameraReady.value = false

  if (billCameraVideo.value) billCameraVideo.value.srcObject = null
}

function cleanupBillCamera() {
  stopBillCamera()
  clearBillCameraPreview()
}

function setBillCameraPreview(image) {
  const objectUrl = globalThis.URL
  if (!image || typeof objectUrl?.createObjectURL !== 'function') return

  pendingBillImage = image
  setPendingBillImage(image)
  clearBillCameraPreview()
  billCameraPreviewType.value = String(image.type ?? '').trim().toLowerCase()
  billCameraPreviewUrl.value = objectUrl.createObjectURL(image)
}

async function startBillCamera() {
  cleanupBillCamera()
  pendingBillImage = null
  clearPendingBillImage()
  sourceSelection.value = false
  actionError.value = ''
  actionErrorCode.value = ''
  actionNotice.value = ''
  await nextTick()

  if (!navigator.mediaDevices?.getUserMedia) {
    actionError.value =
      '카메라 미리보기를 준비할 수 없어요. 촬영 버튼을 눌러 기기 카메라를 열어 주세요.'
    return
  }

  const requestId = billCameraRequestId

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })

    if (requestId !== billCameraRequestId) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    const video = billCameraVideo.value
    if (!video) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    billCameraStream = stream
    video.srcObject = stream
    await video.play()

    if (requestId !== billCameraRequestId) {
      stopBillCamera()
      return
    }

    billCameraReady.value = true
  } catch (error) {
    if (requestId !== billCameraRequestId) return

    stopBillCamera()
    const permissionDenied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
    actionErrorCode.value = permissionDenied ? 'CAMERA_PERMISSION' : ''
    actionError.value = permissionDenied
      ? '카메라 권한을 허용해 주세요. 촬영 버튼을 누르면 다시 시도할 수 있어요.'
      : '카메라 미리보기를 준비하지 못했어요. 촬영 버튼을 눌러 다시 시도해 주세요.'
  }
}

async function setPhotoPreview(source, capturedImage = null) {
  const photo = capturedImage ? null : await takeBillPhoto(source)
  const image = capturedImage ?? (await photoToBlob(photo))
  if (!image) throw new Error('사진을 읽을 수 없어요. 다시 촬영해 주세요.')

  validateBillFile(image)
  setBillCameraPreview(image)
  stopBillCamera()
  sourceSelection.value = false
  actionNotice.value = '사진을 확인했어요. 다음 단계에서 처리할 수 있습니다.'
}

async function uploadBill(source, capturedImage = null) {
  actionBusy.value = true
  actionError.value = ''
  actionErrorCode.value = ''
  actionNotice.value = ''

  try {
    await setPhotoPreview(source, capturedImage)
  } catch (error) {
    if (error?.code === 'UNSUPPORTED_BILL_FILE') {
      cleanupBillCamera()
      pendingBillImage = null
      clearPendingBillImage()
      await router.replace({ name: 'bill-unsupported-format', query: route.query })
      return
    }

    if (!String(error?.message || '').toLowerCase().includes('cancel')) {
      actionErrorCode.value = error?.code || ''
      actionError.value = error?.message || '고지서 사진을 준비하지 못했어요. 다시 시도해 주세요.'
    }
  } finally {
    actionBusy.value = false
  }
}

async function captureBillFrame() {
  const video = billCameraVideo.value

  if (!video?.srcObject || !billCameraReady.value) {
    stopBillCamera()
    return uploadBill('camera')
  }

  try {
    const image = await captureVideoFrame(video)
    stopBillCamera()
    return uploadBill('camera', image)
  } catch {
    stopBillCamera()
    return uploadBill('camera')
  }
}

function continueToOcr() {
  if (!pendingBillImage || !billCameraPreviewUrl.value) {
    actionErrorCode.value = ''
    actionError.value = '먼저 고지서 사진을 준비해 주세요.'
    return
  }

  setPendingBillImage(pendingBillImage)
  const voiceSessionId = String(route.query.voiceSessionId ?? '').trim()
  const query = voiceSessionId ? { voiceSessionId } : undefined
  return router.push({ name: 'bills-ocr', query })
}

function selectAnotherPhoto() {
  cleanupBillCamera()
  pendingBillImage = null
  clearPendingBillImage()
  sourceSelection.value = true
  actionError.value = ''
  actionErrorCode.value = ''
  actionNotice.value = ''
}

function leave() {
  cleanupBillCamera()
  pendingBillImage = null
  clearPendingBillImage()
  return router.push({ name: 'bill-cancelled' })
}

onMounted(() => {
  if (route.query.source === 'camera') startBillCamera()
})
onBeforeUnmount(cleanupBillCamera)
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-camera-device">
      <header class="app-header">
        <Button
          aria-label="고지서 화면으로 돌아가기"
          class="app-back-button"
          size="icon"
          variant="secondary"
          @click="leave"
        >
          ‹
        </Button>
        <strong class="app-brand">귀편한 금융</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main bill-camera-main">
        <section class="screen-heading bill-camera-heading">
          <h1>고지서 촬영</h1>
          <p>고지서를 화면 안에 맞춰 주세요. 빛 반사를 피하면 더 정확해요.</p>
        </section>

        <section
          v-if="actionError"
          class="bill-camera-error"
          role="alert"
        >
          <strong>{{ actionErrorTitle }}</strong>
          <p>{{ actionError }}</p>
          <p class="bill-camera-error-hint">JPG·PNG·PDF, 20MB 이하 파일을 사용할 수 있어요.</p>
        </section>

        <section
          v-if="sourceSelection"
          class="bill-source-selection"
        >
          <div class="bill-camera-hero">
            <div
              aria-hidden="true"
              class="bill-camera-hero-icon"
            >
              ✓
            </div>
            <div>
              <strong>고지서를 화면 안에 맞춰 주세요</strong>
              <p>사진이 선명하면 확인하기 쉬워요.</p>
            </div>
          </div>
          <div
            aria-label="고지서 사진 선택"
            class="bill-camera-choices"
            role="group"
          >
            <Button
              class="bill-camera-choice"
              :disabled="actionBusy"
              @click="startBillCamera"
            >
              카메라 촬영
            </Button>
            <Button
              class="bill-camera-choice"
              :disabled="actionBusy"
              variant="secondary"
              @click="uploadBill('gallery')"
            >
              앨범에서 선택
            </Button>
          </div>
        </section>

        <section
          v-else
          class="bill-camera-capture"
        >
          <div class="bill-camera-viewfinder">
            <video
              v-show="billCameraReady && !billCameraPreviewUrl"
              ref="billCameraVideo"
              aria-label="고지서 촬영 미리보기"
              autoplay
              muted
              playsinline
            />
            <div
              v-if="billCameraPreviewUrl"
              aria-live="polite"
              class="bill-camera-preview"
            >
              <div
                v-if="isPdfBillFile({ type: billCameraPreviewType })"
                class="bill-camera-pdf-preview"
              >
                <strong aria-hidden="true">PDF</strong>
                <p class="bill-camera-status" role="status">PDF 파일을 준비했어요.</p>
              </div>
              <img
                v-else
                alt="촬영한 고지서 미리보기"
                :src="billCameraPreviewUrl"
              />
              <p
                v-if="actionBusy"
                class="bill-camera-status"
                role="status"
              >
                사진을 확인하고 있어요.
              </p>
            </div>
            <div
              v-else-if="!billCameraReady"
              aria-live="polite"
              class="bill-camera-placeholder"
            >
              <span
                aria-hidden="true"
                class="bill-camera-placeholder-icon"
              />
              <p
                class="bill-camera-status"
                role="status"
              >
                카메라를 준비하고 있어요.
              </p>
            </div>
            <div
              aria-hidden="true"
              class="vf-corner tl"
            />
            <div
              aria-hidden="true"
              class="vf-corner tr"
            />
            <div
              aria-hidden="true"
              class="vf-corner bl"
            />
            <div
              aria-hidden="true"
              class="vf-corner br"
            />
          </div>
          <p
            v-if="actionNotice"
            class="bill-camera-notice"
            role="status"
          >
            {{ actionNotice }}
          </p>
        </section>
      </main>

      <footer
        v-if="!sourceSelection"
        class="app-actions bill-camera-actions"
      >
        <Button
          v-if="billCameraPreviewUrl"
          class="w-full"
          :disabled="actionBusy"
          @click="continueToOcr"
        >
          다음 단계
        </Button>
        <Button
          v-else
          class="w-full"
          :disabled="actionBusy"
          @click="captureBillFrame"
        >
          사진 촬영
        </Button>
        <Button
          class="w-full"
          :disabled="actionBusy"
          variant="secondary"
          @click="billCameraPreviewUrl ? uploadBill('camera') : selectAnotherPhoto()"
        >
          {{ billCameraPreviewUrl ? '사진 다시 촬영' : '다른 사진 선택' }}
        </Button>
      </footer>
    </article>
  </div>
</template>
