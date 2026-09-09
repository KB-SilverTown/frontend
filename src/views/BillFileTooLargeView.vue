<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import '@/styles/bill-file-too-large.css'

const route = useRoute()
const router = useRouter()

const voiceSessionId = computed(() => String(route.query.voiceSessionId ?? '').trim())

function cameraQuery(source = '') {
  const query = {}
  if (voiceSessionId.value) query.voiceSessionId = voiceSessionId.value
  if (source) query.source = source
  return Object.keys(query).length ? query : undefined
}

function selectAnotherFile() {
  return router.push({ name: 'bills-camera', query: cameraQuery() })
}

function openCamera() {
  return router.push({ name: 'bills-camera', query: cameraQuery('camera') })
}

function leave() {
  return router.push({ name: 'bills-home' })
}
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-file-too-large-device">
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

      <main class="app-main bill-file-too-large-main">
        <section class="screen-heading bill-file-too-large-heading">
          <h1>파일이 너무 커요</h1>
          <p>크기 제한을 넘은 파일입니다.</p>
        </section>

        <section
          aria-label="파일 용량 초과 안내"
          class="bill-file-too-large-card"
        >
          <div class="bill-file-too-large-hero">
            <span
              aria-hidden="true"
              class="bill-file-too-large-icon"
            >
              !
            </span>
            <div>
              <strong>20MB까지만 올릴 수 있어요</strong>
              <p>파일 크기를 줄이거나 직접 촬영해 주세요.</p>
            </div>
          </div>
          <dl class="bill-file-too-large-value">
            <dt>허용 용량</dt>
            <dd>20MB 이하</dd>
          </dl>
          <p class="bill-file-too-large-note">
            <b>안내</b> 직접 찍으시면 고지서에 맞는 크기로 준비할 수 있어요.
          </p>
        </section>
      </main>

      <footer class="app-actions bill-file-too-large-actions">
        <Button
          class="w-full"
          @click="openCamera"
        >
          촬영하기
        </Button>
        <Button
          class="w-full"
          variant="secondary"
          @click="selectAnotherFile"
        >
          다른 파일 고르기
        </Button>
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
