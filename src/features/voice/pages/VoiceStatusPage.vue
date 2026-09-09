<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import VoicePageShell from '@/features/voice/components/VoicePageShell.vue'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({
  screenKey: { type: String, required: true },
})

const router = useRouter()

const content = computed(() => {
  switch (props.screenKey) {
    case 'voice-replay':
      return {
        title: '다시 들려드릴까요',
        description: '방금 안내를 처음부터 다시 읽어드립니다.',
        primary: '다시 듣기',
        secondary: '그만 듣기',
        strong: '놓치셨어도 괜찮아요',
        message: '몇 번이든 다시 들으실 수 있어요.',
        meta: '마지막 안내',
        metaValue: '30초 전',
      }
    case 'voice-ended':
      return {
        title: '음성 안내 종료',
        description: '음성 대화를 끝내고 화면만 사용합니다.',
        primary: '화면으로 계속하기',
        secondary: '음성 다시 켜기',
        strong: '음성 안내를 껐어요',
        message: '언제든 마이크 단추로 다시 켤 수 있어요.',
        warning: true,
        note: '진행 중이던 내용은 그대로 남아 있어요.',
      }
    case 'voice-resume':
      return {
        title: '이어서 하시겠어요',
        description: '중단된 음성 대화를 그대로 이어갑니다.',
        primary: '이어서 하기',
        secondary: '처음부터 다시',
        strong: '아까 하시던 것이 있어요',
        message: '“김영희에게 오만원 보내줘”까지 진행했어요.',
      }
    case 'voice-expired':
      return {
        title: '시간이 지났어요',
        description: '안전을 위해 음성 대화를 닫았습니다.',
        primary: '다시 시작하기',
        secondary: '홈으로',
        strong: '5분 동안 말씀이 없으셨어요',
        message: '처음부터 다시 시작해 주세요.',
        warning: true,
        note: '입력하신 내용은 저장되지 않았어요.',
      }
    case 'voice-bill-reading':
      return {
        title: '고지서 읽어드리는 중',
        description: '고지서 내용을 음성으로 안내합니다.',
        primary: '다시 듣기',
        secondary: '음성 끄기',
        strong: '고지서 내용을 읽고 있어요',
        message: '읽는 중인 항목을 다시 들을 수 있어요.',
        meta: '읽는 중',
        metaValue: '2 / 4번째 항목',
      }
    default:
      return {
        title: '음성 안내',
        description: '음성 안내를 확인합니다.',
        primary: '확인',
        secondary: '',
        strong: '음성 안내를 준비하고 있어요',
        message: '잠시만 기다려 주세요.',
      }
  }
})

function routeForPrimary() {
  if (props.screenKey === 'voice-replay')
    return { name: 'voice-screen', params: { screenKey: 'voice-replay' } }
  if (props.screenKey === 'voice-ended') return { name: 'living-home' }
  if (props.screenKey === 'voice-resume')
    return { name: 'transfer-screen', params: { screenKey: 'transfer-listening' } }
  if (props.screenKey === 'voice-expired') return { name: 'my-page' }
  if (props.screenKey === 'voice-bill-reading')
    return { name: 'voice-screen', params: { screenKey: 'voice-bill-reading' } }
  return { name: 'my-page' }
}

function routeForSecondary() {
  if (props.screenKey === 'voice-replay')
    return { name: 'voice-screen', params: { screenKey: 'voice-ended' } }
  if (props.screenKey === 'voice-ended') return { name: 'my-page' }
  if (props.screenKey === 'voice-resume') return { name: 'my-page' }
  if (props.screenKey === 'voice-expired') return { name: 'transfer-home' }
  if (props.screenKey === 'voice-bill-reading') return { name: 'bills-home' }
  return null
}

function handlePrimary() {
  router.push(routeForPrimary())
}

function handleSecondary() {
  const target = routeForSecondary()
  if (target) router.push(target)
}
</script>

<template>
  <VoicePageShell
    :back-route="{ name: 'my-page' }"
    :description="content.description"
    :primary-label="content.primary"
    :secondary-label="content.secondary"
    :title="content.title"
    @back="goBackOrReplace(router, { name: 'my-page' })"
    @primary="handlePrimary"
    @secondary="handleSecondary"
  >
    <section class="service-route-screen-content screen-content">
      <div class="content">
        <section
          class="hero"
          :class="{ warn: content.warning }"
        >
          <div class="hero-icon">{{ content.warning ? '!' : '✓' }}</div>
          <div>
            <strong>{{ content.strong }}</strong>
            <p>{{ content.message }}</p>
          </div>
        </section>
        <div
          v-if="content.meta"
          class="meta"
        >
          <span>{{ content.meta }}</span>
          <b>{{ content.metaValue }}</b>
        </div>
        <div
          v-if="content.note"
          class="note"
        >
          <b>안내</b>
          <span>{{ content.note }}</span>
        </div>
      </div>
    </section>
  </VoicePageShell>
</template>
