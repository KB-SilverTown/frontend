<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import '@/styles/bill-camera.css'
import '@/styles/bill-retake.css'

const route = useRoute()
const router = useRouter()
const actionNotice = ref('')

const billId = computed(() => String(route.query.billId ?? '').trim())
const voiceSessionId = computed(() => String(route.query.voiceSessionId ?? '').trim())

function cameraQuery() {
  const query = { source: 'camera' }
  if (voiceSessionId.value) query.voiceSessionId = voiceSessionId.value
  return query
}

function retake() {
  return router.push({ name: 'bills-camera', query: cameraQuery() })
}

function directInput() {
  if (!billId.value) {
    actionNotice.value = '고지서 확인 후 직접 입력할 수 있어요.'
    return
  }

  return router.push({ name: 'bill-payment-number', params: { billId: billId.value } })
}

function leave() {
  return router.push({ name: 'bills-home' })
}
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-retake-device">
      <header class="app-header">
        <Button
          aria-label="고지서 목록으로 돌아가기"
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

      <main class="app-main bill-retake-main">
        <section class="screen-heading bill-retake-heading">
          <h1>다시 찍어볼까요</h1>
          <p>더 또렷하게 다시 촬영합니다.</p>
        </section>

        <section
          aria-label="고지서 재촬영 안내"
          class="bill-retake-capture"
        >
          <div class="bill-camera-viewfinder bill-retake-viewfinder">
            <div
              aria-hidden="true"
              class="bill-retake-document"
            />
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
            <p class="bill-retake-hint">글자가 흐리면 조금 더 가까이</p>
          </div>
          <p class="bill-retake-note">
            <b>안내</b> 빛 반사만 피하면 훨씬 잘 읽혀요.
          </p>
          <p
            v-if="actionNotice"
            aria-live="polite"
            class="bill-retake-notice"
            role="status"
          >
            {{ actionNotice }}
          </p>
        </section>
      </main>

      <footer class="app-actions bill-retake-actions">
        <Button
          class="w-full"
          @click="retake"
        >
          다시 촬영
        </Button>
        <Button
          class="w-full"
          variant="secondary"
          @click="directInput"
        >
          직접 입력하기
        </Button>
      </footer>
    </article>
  </div>
</template>
