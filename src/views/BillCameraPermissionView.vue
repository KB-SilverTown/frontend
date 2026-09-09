<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import '@/styles/bill-camera-permission.css'

const route = useRoute()
const router = useRouter()

const voiceSessionId = computed(() => String(route.query.voiceSessionId ?? '').trim())

function cameraQuery(source = '') {
  const query = {}
  if (voiceSessionId.value) query.voiceSessionId = voiceSessionId.value
  if (source) query.source = source
  return Object.keys(query).length ? query : undefined
}

function openSettings() {
  window.dispatchEvent(new CustomEvent('gwipyeonhan:open-settings'))
}

function selectFile() {
  return router.push({ name: 'bills-camera', query: cameraQuery() })
}

function leave() {
  return router.push({ name: 'bills-home' })
}
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-camera-permission-device">
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

      <main class="app-main bill-camera-permission-main">
        <section class="screen-heading bill-camera-permission-heading">
          <h1>카메라 권한 없음</h1>
          <p>카메라를 사용할 수 없을 때 다른 방법을 선택할 수 있어요.</p>
        </section>

        <section
          aria-label="카메라 권한 안내"
          class="bill-camera-permission-card"
        >
          <div class="bill-camera-permission-hero">
            <span
              aria-hidden="true"
              class="bill-camera-permission-icon"
            >
              ✓
            </span>
            <div>
              <strong>카메라 권한이 필요해요</strong>
              <p>촬영할 때만 권한을 요청합니다.</p>
            </div>
          </div>
          <p class="bill-camera-permission-note">
            기기 설정에서 카메라 권한을 허용하거나 파일에서 고지서를 선택해 주세요.
          </p>
        </section>
      </main>

      <footer class="app-actions bill-camera-permission-actions">
        <Button
          class="w-full"
          @click="openSettings"
        >
          설정 열기
        </Button>
        <Button
          class="w-full"
          variant="secondary"
          @click="selectFile"
        >
          파일에서 선택
        </Button>
      </footer>
    </article>
  </div>
</template>
