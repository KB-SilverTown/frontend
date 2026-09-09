<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BillsPageShell from '@/features/bills/components/BillsPageShell.vue'
import { useBillStore } from '@/features/bills/stores/bill.js'
import { useVoiceStore } from '@/features/voice/stores/voice.js'
import {
  captureVideoFrame,
  photoToBlob,
  takeBillPhoto,
} from '@/shared/native/nativeCapabilities.js'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({ screenKey: { type: String, required: true } })

const router = useRouter()
const billStore = useBillStore()
const voiceStore = useVoiceStore()
const video = ref(null)
const cameraReady = ref(false)
const previewUrl = ref('')
const busy = ref(false)
const error = ref('')
let stream = null
let requestId = 0

const isCamera = computed(() => props.screenKey === 'bill-camera')
const title = computed(() => (isCamera.value ? '고지서를 비춰 주세요' : '촬영 또는 앨범에서 선택'))
const description = computed(() =>
  isCamera.value ? '네 모서리가 모두 보이게 맞춰 주세요.' : '카메라와 앨범 중 하나를 선택합니다.',
)

function stopCamera() {
  requestId += 1
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  cameraReady.value = false
  if (video.value) video.value.srcObject = null
}

function clearPreview() {
  if (previewUrl.value) globalThis.URL?.revokeObjectURL?.(previewUrl.value)
  previewUrl.value = ''
}

async function startCamera() {
  stopCamera()
  clearPreview()
  billStore.reset()
  const currentRequest = requestId

  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = '카메라 미리보기를 준비할 수 없어요. 촬영 버튼을 눌러 기기 카메라를 열어 주세요.'
    return
  }

  try {
    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    if (currentRequest !== requestId || !isCamera.value || !video.value) {
      nextStream.getTracks().forEach((track) => track.stop())
      return
    }
    stream = nextStream
    video.value.srcObject = nextStream
    await video.value.play()
    if (currentRequest === requestId && isCamera.value) cameraReady.value = true
  } catch (cameraError) {
    if (currentRequest !== requestId) return
    error.value =
      cameraError?.name === 'NotAllowedError' || cameraError?.name === 'SecurityError'
        ? '카메라 권한을 허용해 주세요. 촬영 버튼을 누르면 다시 시도할 수 있어요.'
        : '카메라 미리보기를 준비하지 못했어요. 촬영 버튼을 눌러 다시 시도해 주세요.'
  }
}

async function upload(source, capturedImage = null) {
  busy.value = true
  error.value = ''
  try {
    const photo = capturedImage ? null : await takeBillPhoto(source)
    const image = capturedImage ?? (await photoToBlob(photo))
    if (!image) throw new Error('사진을 읽을 수 없어요. 다시 촬영해 주세요.')
    if (source === 'camera') previewUrl.value = globalThis.URL?.createObjectURL?.(image) || ''

    const session =
      voiceStore.session?.entryPoint === 'BILL_PAYMENT'
        ? voiceStore.session
        : await voiceStore.startSession('BILL_PAYMENT')
    if (!session?.sessionId) throw new Error('음성 세션을 준비하지 못했어요. 다시 시도해 주세요.')

    await billStore.upload({ image, voiceSessionId: session.sessionId })
    await router.push({ name: 'bills-screen', params: { screenKey: 'bill-review' } })
  } catch (uploadError) {
    if (
      !String(uploadError?.message || '')
        .toLowerCase()
        .includes('cancel')
    ) {
      error.value = uploadError?.message || '고지서를 준비하지 못했어요. 다시 시도해 주세요.'
    }
  } finally {
    busy.value = false
  }
}

async function capture() {
  if (!video.value?.srcObject || !cameraReady.value) return upload('camera')
  try {
    const image = await captureVideoFrame(video.value)
    stopCamera()
    return upload('camera', image)
  } catch {
    stopCamera()
    return upload('camera')
  }
}

function back() {
  stopCamera()
  clearPreview()
  goBackOrReplace(router, { name: 'bills-home' })
}

watch(
  isCamera,
  async (camera) => {
    error.value = ''
    if (!camera) {
      stopCamera()
      clearPreview()
      return
    }
    await nextTick()
    startCamera()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopCamera()
  clearPreview()
})
</script>

<template>
  <BillsPageShell
    :busy="busy"
    :description="description"
    :primary-label="isCamera ? '촬영' : ''"
    :title="title"
    @back="back"
    @primary="capture"
  >
    <p
      v-if="error"
      class="service-route-error"
      role="alert"
    >
      {{ error }}
    </p>
    <section
      v-if="!isCamera"
      aria-label="고지서 사진 선택"
      class="service-route-screen-content screen-content bill-source-selection"
    >
      <div class="content">
        <section class="hero">
          <div class="hero-icon">✓</div>
          <div>
            <strong>고지서를 화면 안에 맞춰 주세요</strong>
            <p>빛 반사를 피하면 더 정확해요.</p>
          </div>
        </section>
        <div class="choices">
          <button
            class="choice"
            type="button"
            @click="router.push({ name: 'bills-screen', params: { screenKey: 'bill-camera' } })"
          >
            카메라 촬영
          </button>
          <button
            class="choice"
            :disabled="busy"
            type="button"
            @click="upload('gallery')"
          >
            앨범에서 선택
          </button>
        </div>
      </div>
    </section>
    <section
      v-else
      class="service-route-screen-content screen-content bill-camera-capture"
    >
      <div class="content">
        <div class="viewfinder bill-camera-viewfinder">
          <video
            v-show="cameraReady && !previewUrl"
            ref="video"
            aria-label="고지서 촬영 미리보기"
            autoplay
            muted
            playsinline
          />
          <div
            v-if="previewUrl"
            class="bill-camera-preview"
          >
            <img
              alt="촬영한 고지서 미리보기"
              :src="previewUrl"
            />
          </div>
          <p
            v-else-if="!cameraReady"
            class="bill-camera-status"
            role="status"
          >
            카메라를 준비하고 있어요.
          </p>
          <span class="vf-corner tl" /><span class="vf-corner tr" /><span
            class="vf-corner bl"
          /><span class="vf-corner br" />
        </div>
      </div>
    </section>
  </BillsPageShell>
</template>
