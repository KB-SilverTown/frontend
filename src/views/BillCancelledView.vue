<script setup>
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import '@/styles/bill-cancelled.css'

const router = useRouter()

function leave() {
  return router.push({ name: 'bills-home' })
}
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell bill-cancelled-device">
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

      <main class="app-main bill-cancelled-main">
        <section class="screen-heading bill-cancelled-heading">
          <h1>사용자 취소</h1>
          <p>취소한 촬영 결과는 목록에 저장하지 않습니다.</p>
        </section>

        <section
          aria-label="고지서 등록 취소 안내"
          class="bill-cancelled-card"
        >
          <div class="bill-cancelled-hero">
            <span
              aria-hidden="true"
              class="bill-cancelled-icon"
            >
              ✓
            </span>
            <div>
              <strong>등록을 취소했어요</strong>
              <p>아직 저장되거나 납부된 내용은 없습니다.</p>
            </div>
          </div>
          <p class="bill-cancelled-note">
            <b>안내</b> 다시 등록하려면 고지서 목록에서 새로 촬영해 주세요.
          </p>
        </section>
      </main>

      <footer class="app-actions bill-cancelled-actions">
        <Button
          class="w-full"
          @click="leave"
        >
          고지서 목록으로
        </Button>
      </footer>
    </article>
  </div>
</template>
