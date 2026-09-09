<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import '@/styles/bill-unsupported-format.css'

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
    <article class="mobile-app-shell bill-unsupported-format-device">
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

      <main class="app-main bill-unsupported-format-main">
        <section class="screen-heading bill-unsupported-format-heading">
          <h1>못 읽는 형식이에요</h1>
          <p>지원하지 않는 파일입니다.</p>
        </section>

        <section
          aria-label="지원하지 않는 파일 안내"
          class="bill-unsupported-format-card"
        >
          <div class="bill-unsupported-format-hero">
            <span
              aria-hidden="true"
              class="bill-unsupported-format-icon"
            >
              !
            </span>
            <div>
              <strong>이 파일은 열 수 없어요</strong>
              <p>사진(JPG·PNG)이나 PDF만 사용할 수 있어요.</p>
            </div>
          </div>
          <dl class="bill-unsupported-format-options">
            <dt>지원하는 파일</dt>
            <dd>JPG · PNG · PDF</dd>
          </dl>
          <p class="bill-unsupported-format-note">
            <b>안내</b> 파일 형식을 바꾼 뒤 다시 선택하거나 직접 촬영해 주세요.
          </p>
        </section>
      </main>

      <footer class="app-actions bill-unsupported-format-actions">
        <Button
          class="w-full"
          @click="selectAnotherFile"
        >
          다른 파일 고르기
        </Button>
        <Button
          class="w-full"
          variant="secondary"
          @click="openCamera"
        >
          촬영하기
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
