<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import '@/styles/living-state.css'

const route = useRoute()
const router = useRouter()
const actionNotice = ref('')

const SCREEN_DEFINITIONS = Object.freeze({
  'living-session-expired': {
    title: '세션 만료',
    description: '인증이 만료되면 재로그인을 요청합니다.',
    heroTitle: '안전한 이용을 위해 다시 확인해 주세요',
    heroDescription: '로그인 시간이 만료되었습니다.',
    icon: '?',
    variant: 'warning',
    primaryLabel: '다시 로그인',
    primaryAction: 'login',
  },
  'living-reminders-empty': {
    title: '알림이 없어요',
    description: '아직 받은 알림이 없습니다.',
    heroTitle: '새로운 알림이 없어요',
    heroDescription: '납부일이 다가오면 알려드릴게요.',
    icon: '✓',
    note: '알림을 켜두시면 놓치는 일이 줄어요.',
    primaryLabel: '알림 만들기',
    primaryAction: 'reminder-create',
    secondaryLabel: '홈으로',
    secondaryAction: 'living-home',
  },
  'living-reminders-error': {
    title: '알림을 못 가져왔어요',
    description: '목록을 불러오지 못했습니다.',
    heroTitle: '잠시 연결이 안 돼요',
    heroDescription: '통신 상태를 확인해 주세요.',
    icon: '!',
    variant: 'danger',
    primaryLabel: '다시 불러오기',
    primaryAction: 'reminders',
    secondaryLabel: '홈으로',
    secondaryAction: 'living-home',
  },
  'living-reminders-disabled': {
    title: '알림이 꺼져 있어요',
    description: '알림 권한이 없습니다.',
    heroTitle: '알림을 보낼 수 없어요',
    heroDescription: '납부일을 못 알려드려요.',
    icon: '!',
    variant: 'warning',
    note: '설정 › 귀편한 금융 › 알림에서 켜실 수 있어요.',
    primaryLabel: '설정 열기',
    primaryAction: 'open-settings',
    secondaryLabel: '괜찮아요',
    secondaryAction: 'living-home',
  },
  'living-reminder-arrived': {
    title: '알림 도착',
    description: '내용 확인 중심의 알림으로 정리합니다.',
    heroTitle: '오늘은 전기요금 납부일이에요',
    heroDescription: '등록해 둔 일정을 확인해 주세요.',
    icon: '✓',
    note: '등록해 둔 납부 알림 내용을 확인할 수 있어요.',
    primaryLabel: '알림 상세 보기',
    primaryAction: 'reminders',
  },
  'living-location-permission': {
    title: '위치 권한 없음',
    description: '지역 직접 선택으로 서비스를 계속 이용합니다.',
    heroTitle: '현재 위치를 확인할 수 없어요',
    heroDescription: '지역을 직접 선택해 이동점포를 찾을 수 있습니다.',
    icon: '✓',
    fieldLabel: '시·군·구 선택',
    primaryLabel: '이 지역에서 찾기',
    primaryAction: 'mobile-branches',
    secondaryLabel: '설정 열기',
    secondaryAction: 'open-settings',
  },
  'living-branches-empty': {
    title: '가까운 곳이 없어요',
    description: '주변에 이동점포가 없습니다.',
    heroTitle: '10km 안에 없어요',
    heroDescription: '다른 지역으로 넓혀서 찾아볼까요?',
    icon: '!',
    variant: 'warning',
    fieldLabel: '찾는 지역',
    fieldValue: '성동구',
    primaryLabel: '넓혀서 찾기',
    primaryAction: 'mobile-branches',
    secondaryLabel: '홈으로',
    secondaryAction: 'living-home',
  },
  'living-branches-error': {
    title: '못 찾아봤어요',
    description: '이동점포 정보를 불러오지 못했습니다.',
    heroTitle: '잠시 연결이 안 돼요',
    heroDescription: '통신 상태를 확인해 주세요.',
    icon: '!',
    variant: 'danger',
    primaryLabel: '다시 찾기',
    primaryAction: 'mobile-branches',
    secondaryLabel: '홈으로',
    secondaryAction: 'living-home',
  },
  'living-emergency-contact-edit': {
    title: '비상 연락처 고치기',
    description: '믿을 수 있는 분을 바꿉니다.',
    heroTitle: '지금 등록된 분',
    heroDescription: '김영희 · 자녀 · 010-1234-5678',
    icon: '✓',
    fieldLabel: '새 연락처',
    fieldValue: '›',
    note: '이상한 송금이 있을 때 이분께 먼저 알려요.',
    primaryLabel: '바꾸기',
    primaryAction: 'profile',
    secondaryLabel: '그대로 두기',
    secondaryAction: 'living-home',
  },
})

const screen = computed(() => SCREEN_DEFINITIONS[route.name] ?? SCREEN_DEFINITIONS['living-session-expired'])
const screenClass = computed(() => ({
  'is-warning': screen.value.variant === 'warning',
  'is-danger': screen.value.variant === 'danger',
}))

function navigate(action) {
  if (action === 'open-settings') {
    window.dispatchEvent(new CustomEvent('gwipyeonhan:open-settings'))
    actionNotice.value = '기기 설정에서 권한을 바꿀 수 있어요.'
    return
  }

  if (action === 'login') {
    return router.push({ name: 'onboarding', params: { stepId: 'login' } })
  }

  if (action === 'profile') return router.push({ name: 'profile' })
  return router.push({ name: action })
}

function leave() {
  return router.push({ name: 'living-home' })
}
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell living-state-device">
      <header class="app-header">
        <Button
          aria-label="생활금융 화면으로 돌아가기"
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

      <main class="app-main living-state-main">
        <section class="screen-heading living-state-heading">
          <h1>{{ screen.title }}</h1>
          <p>{{ screen.description }}</p>
        </section>

        <section
          :class="['living-state-card', screenClass]"
          :aria-label="`${screen.title} 안내`"
        >
          <div class="living-state-hero">
            <span
              aria-hidden="true"
              class="living-state-icon"
            >
              {{ screen.icon }}
            </span>
            <div>
              <strong>{{ screen.heroTitle }}</strong>
              <p>{{ screen.heroDescription }}</p>
            </div>
          </div>
          <dl
            v-if="screen.fieldLabel"
            class="living-state-meta"
          >
            <dt>{{ screen.fieldLabel }}</dt>
            <dd>{{ screen.fieldValue || '›' }}</dd>
          </dl>
          <p
            v-if="screen.note"
            class="living-state-note"
          >
            <b>안내</b> {{ screen.note }}
          </p>
          <p
            v-if="actionNotice"
            aria-live="polite"
            class="living-state-notice"
            role="status"
          >
            {{ actionNotice }}
          </p>
        </section>
      </main>

      <footer class="app-actions living-state-actions">
        <Button
          v-if="screen.primaryLabel"
          class="w-full"
          @click="navigate(screen.primaryAction)"
        >
          {{ screen.primaryLabel }}
        </Button>
        <Button
          v-if="screen.secondaryLabel"
          class="w-full"
          variant="secondary"
          @click="navigate(screen.secondaryAction)"
        >
          {{ screen.secondaryLabel }}
        </Button>
      </footer>
    </article>
  </div>
</template>
