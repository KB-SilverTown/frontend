<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import LivingPageShell from '@/features/living/components/LivingPageShell.vue'
import { goBackOrReplace } from '@/shared/lib/navigation.js'
const props = defineProps({ screenKey: { type: String, required: true } })
const router = useRouter()
const states = {
  'living-accounts': ['계좌 목록', '연결된 계좌를 확인합니다.', 'living-home'],
  'living-accounts-empty': ['연결 계좌 없음', '연결된 계좌가 없어요.', 'living-accounts'],
  'living-accounts-error': ['계좌 조회 실패', '계좌를 다시 불러와 주세요.', 'living-accounts'],
  'living-session-expired': ['세션 만료', '다시 로그인해 주세요.', 'onboarding'],
  'living-reminder-arrived': ['납부 알림', '확인할 납부 알림이 있어요.', 'living-reminders'],
  'living-reminders-disabled': [
    '알림이 꺼져 있어요',
    '기기 설정에서 알림을 켜 주세요.',
    'living-reminders',
  ],
  'living-reminder-speak': [
    '알림 읽어주기',
    '알림 내용을 음성으로 들을 수 있어요.',
    'living-reminders',
  ],
  'living-reminder-notice': ['알림 안내', '중요한 납부 일정을 확인해 주세요.', 'living-reminders'],
  'living-reminder-reading': [
    '알림을 읽고 있어요',
    '납부 일정을 안내하고 있습니다.',
    'living-reminders',
  ],
  'living-reminder-quiet-hours': [
    '알림 쉬는 시간',
    '조용한 시간에는 알림을 보내지 않아요.',
    'living-reminders',
  ],
  'living-reminder-missed': ['놓친 알림', '확인하지 못한 납부 알림이 있어요.', 'living-reminders'],
  'living-branches-empty': [
    '가까운 곳이 없어요',
    '다른 시간에 다시 찾아 주세요.',
    'living-branches',
  ],
  'living-branches-error': [
    '못 찾아봤어요',
    '위치 설정을 확인한 뒤 다시 시도해 주세요.',
    'living-branches',
  ],
  'living-profile-edit': ['내 정보 고치기', '내 정보는 마이페이지에서 확인합니다.', 'my-page'],
  'living-emergency-contact-edit': [
    '비상 연락처 고치기',
    '비상 연락처는 마이페이지에서 확인합니다.',
    'my-page',
  ],
  'living-consents': ['동의 다시 보기', '동의 내용은 마이페이지에서 확인합니다.', 'my-page'],
}
const state = computed(() => {
  const [title, description, target] = states[props.screenKey] || [
    '생활금융 안내',
    '화면을 확인합니다.',
    'living-home',
  ]
  return { title, description, target }
})
function primary() {
  const target = state.value.target
  if (target === 'onboarding')
    return router.push({ name: 'onboarding', params: { stepId: 'login' } })
  if (['living-home', 'my-page'].includes(target)) return router.push({ name: target })
  return router.push({ name: 'living-screen', params: { screenKey: target } })
}
</script>
<template>
  <LivingPageShell
    :description="state.description"
    primary-label="확인"
    :title="state.title"
    @back="goBackOrReplace(router, { name: 'living-home' })"
    @primary="primary"
    ><section class="service-route-screen-content screen-content">
      <div class="content">
        <section class="hero">
          <div class="hero-icon">✓</div>
          <div>
            <strong>{{ state.title }}</strong>
            <p>{{ state.description }}</p>
          </div>
        </section>
      </div>
    </section></LivingPageShell
  >
</template>
