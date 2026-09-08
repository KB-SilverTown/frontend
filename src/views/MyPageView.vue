<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { FONT_SCALE, readFontScale } from '@/services/fontScale.js'
import { useOnboardingStore } from '@/stores/onboarding.js'
import '@/styles/my-page.css'

const router = useRouter()
const onboardingStore = useOnboardingStore()
const fontScale = ref(readFontScale())
const fontScaleLabel = computed(() => (fontScale.value === FONT_SCALE.large ? '큰 글씨' : '기본 크기'))
const isLoggingOut = ref(false)
const logoutError = ref('')

async function handleLogout() {
  if (isLoggingOut.value) return

  isLoggingOut.value = true
  logoutError.value = ''
  try {
    await onboardingStore.logout()
    await router.replace({ name: 'onboarding', params: { stepId: 'login' } })
  } catch {
    logoutError.value = '로그아웃을 마치지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    isLoggingOut.value = false
  }
}

function goBack() {
  return router.push({ name: 'living-home' })
}
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell my-page-device">
      <header class="app-header">
        <Button
          aria-label="생활금융 화면으로 돌아가기"
          class="app-back-button"
          size="icon"
          variant="secondary"
          @click="goBack"
        >
          ‹
        </Button>
        <strong class="app-brand">귀편한 금융</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main my-page-main">
        <section class="screen-heading my-page-heading">
          <h1>마이페이지</h1>
          <p>보기 편한 환경과 나의 설정을 관리합니다.</p>
        </section>

        <div
          v-if="logoutError"
          class="my-page-error"
          role="alert"
        >
          {{ logoutError }}
        </div>

        <div class="my-page-card-list">
          <RouterLink
            aria-label="글씨 크기 설정 열기"
            class="my-page-card"
            :to="{ name: 'my-page-font-size' }"
          >
            <span>
              <strong>글씨 크기</strong>
              <small>{{ fontScaleLabel }}</small>
            </span>
            <b aria-hidden="true">›</b>
          </RouterLink>
          <RouterLink
            aria-label="가입 정보 열기"
            class="my-page-card"
            :to="{ name: 'profile' }"
          >
            <span>
              <strong>가입 정보</strong>
              <small>이름과 연락처를 확인합니다.</small>
            </span>
            <b aria-hidden="true">›</b>
          </RouterLink>
          <button
            :aria-busy="isLoggingOut"
            :aria-label="isLoggingOut ? '로그아웃 중' : '로그아웃'"
            class="my-page-card my-page-logout"
            :disabled="isLoggingOut"
            type="button"
            @click="handleLogout"
          >
            <span>
              <strong>{{ isLoggingOut ? '로그아웃 중…' : '로그아웃' }}</strong>
              <small>현재 기기에서 안전하게 로그아웃합니다.</small>
            </span>
            <b aria-hidden="true">↪</b>
          </button>
        </div>
      </main>

      <nav
        aria-label="주요 메뉴"
        class="app-bottom-nav three-items my-page-bottom-nav"
      >
        <RouterLink :to="{ name: 'bills-home' }">고지서</RouterLink>
        <RouterLink :to="{ name: 'living-home' }">생활금융</RouterLink>
        <RouterLink
          aria-current="page"
          :to="{ name: 'my-page' }"
        >
          마이페이지
        </RouterLink>
      </nav>
    </article>
  </div>
</template>
