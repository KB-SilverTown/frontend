<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import '@/styles/bill-unsupported-format.css'

const route = useRoute()
const router = useRouter()

const voiceSessionId = computed(() => String(route.query.voiceSessionId ?? '').trim())

function cameraQuery() {
  return voiceSessionId.value ? { voiceSessionId: voiceSessionId.value } : undefined
}

function selectAnotherFile() {
  return router.push({ name: 'bills-camera', query: cameraQuery() })
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
          <h1>파일을 올릴 수 없어요</h1>
          <p>지원 형식 또는 최대 용량을 확인해 주세요.</p>
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
              <strong>파일을 올릴 수 없어요</strong>
              <p>지원 형식 또는 최대 용량을 확인해 주세요.</p>
            </div>
          </div>
          <dl class="bill-unsupported-format-options">
            <div>
              <dt>지원하는 파일</dt>
              <dd>JPG · PNG · PDF</dd>
            </div>
            <div>
              <dt>허용 용량</dt>
              <dd>20MB 이하</dd>
            </div>
          </dl>
        </section>
      </main>

      <footer class="app-actions bill-unsupported-format-actions">
        <Button
          class="w-full"
          @click="selectAnotherFile"
        >
          다른 파일 선택
        </Button>
      </footer>
    </article>
  </div>
</template>
