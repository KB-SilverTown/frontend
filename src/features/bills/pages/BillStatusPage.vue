<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import BillsPageShell from '@/features/bills/components/BillsPageShell.vue'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({ screenKey: { type: String, required: true } })
const router = useRouter()

const states = {
  'bill-ocr-processing': {
    title: '고지서를 읽고 있어요',
    description: '문서를 업로드하고 항목을 인식합니다.',
    primaryLabel: '',
    secondaryLabel: '취소',
    message: '고지서 내용을 확인하고 있어요.',
    primary: null,
    secondary: 'bills-home',
  },
  'bill-recognition-failed': {
    title: '내용을 읽지 못했어요',
    description: '흐림과 잘림이 없는지 확인해 주세요.',
    primaryLabel: '다시 촬영',
    secondaryLabel: '다른 파일 선택',
    message: '고지서를 다시 찍어 주세요.',
    primary: 'bill-camera',
    secondary: 'bill-source-select',
  },
  'bill-unsupported-file': {
    title: '파일을 올릴 수 없어요',
    description: '지원 형식 또는 최대 용량을 확인해 주세요.',
    primaryLabel: '다른 파일 선택',
    secondaryLabel: '',
    message: 'JPG, PNG 또는 PDF 파일을 선택해 주세요.',
    primary: 'bill-source-select',
    secondary: null,
  },
  'bill-camera-permission': {
    title: '카메라 권한 없음',
    description: '거부 시 파일 선택 경로를 제공합니다.',
    primaryLabel: '설정 열기',
    secondaryLabel: '파일에서 선택',
    message: '촬영할 때만 카메라 권한을 요청합니다.',
    primary: 'bill-camera',
    secondary: 'bill-source-select',
  },
  'bill-expired': {
    title: '확인 시간이 지났어요',
    description: '오래된 확인 정보는 다시 검토합니다.',
    primaryLabel: '다시 확인',
    secondaryLabel: '',
    message: '최신 납부 정보를 다시 불러옵니다.',
    primary: 'bill-review',
    secondary: null,
  },
  'bill-cancelled': {
    title: '등록을 취소했어요',
    description: '취소한 촬영 결과를 목록에 남기지 않습니다.',
    primaryLabel: '고지서 목록으로',
    secondaryLabel: '',
    message: '아직 저장되거나 납부된 내용은 없습니다.',
    primary: 'bills-home',
    secondary: null,
  },
  'bill-payment-number': {
    title: '납부번호 확인',
    description: '읽어낸 납부번호를 확인합니다.',
    primaryLabel: '맞아요',
    secondaryLabel: '고칠게요',
    message: '한 자리만 달라도 다른 곳으로 가요.',
    primary: 'bill-confirm',
    secondary: 'bill-low-confidence',
  },
  'bill-read-accuracy': {
    title: '읽은 정확도',
    description: '항목마다 얼마나 확실한지 보여드립니다.',
    primaryLabel: '흐린 곳 고치기',
    secondaryLabel: '이대로 진행',
    message: '흐린 항목만 확인해 주시면 돼요.',
    primary: 'bill-low-confidence',
    secondary: 'bill-confirm',
  },
  'bill-retake': {
    title: '다시 찍어볼까요',
    description: '더 또렷하게 다시 촬영합니다.',
    primaryLabel: '다시 촬영',
    secondaryLabel: '직접 입력하기',
    message: '빛 반사만 피하면 훨씬 잘 읽혀요.',
    primary: 'bill-camera',
    secondary: 'bill-payment-number',
  },
  'bill-unsupported-format': {
    title: '못 읽는 형식이에요',
    description: '지원하지 않는 파일입니다.',
    primaryLabel: '다른 파일 고르기',
    secondaryLabel: '촬영하기',
    message: '사진(JPG·PNG)이나 PDF만 됩니다.',
    primary: 'bill-source-select',
    secondary: 'bill-camera',
  },
  'bill-file-too-large': {
    title: '파일이 너무 커요',
    description: '크기 제한을 넘었습니다.',
    primaryLabel: '촬영하기',
    secondaryLabel: '다른 파일 고르기',
    message: '직접 찍으시면 크기가 알맞게 맞춰져요.',
    primary: 'bill-camera',
    secondary: 'bill-source-select',
  },
  'bill-overdue': {
    title: '지난 고지서',
    description: '저장해 둔 고지서를 봅니다.',
    primaryLabel: '영수증 보기',
    secondaryLabel: '목록으로',
    message: '서버에 저장된 납부 결과를 확인합니다.',
    primary: 'bill-overdue',
    secondary: 'bills-home',
  },
  'bill-payment-failed': {
    title: '납부하지 못했어요',
    description: '서버에서 처리하지 못했습니다.',
    primaryLabel: '다시 시도하기',
    secondaryLabel: '나중에 하기',
    message: '잠시 후 다시 시도해 주세요.',
    primary: 'bill-paying',
    secondary: 'bills-home',
  },
}

const state = computed(() => states[props.screenKey] || states['bill-cancelled'])

function go(target) {
  if (!target) return
  if (target === 'bills-home') return router.push({ name: target })
  router.push({ name: 'bills-screen', params: { screenKey: target } })
}
</script>

<template>
  <BillsPageShell
    :description="state.description"
    :primary-label="state.primaryLabel"
    :secondary-label="state.secondaryLabel"
    :title="state.title"
    @back="goBackOrReplace(router, { name: 'bills-home' })"
    @primary="go(state.primary)"
    @secondary="go(state.secondary)"
  >
    <section class="service-route-screen-content screen-content">
      <div class="content">
        <section class="hero">
          <div class="hero-icon">{{ screenKey === 'bill-payment-failed' ? '!' : '✓' }}</div>
          <div>
            <strong>{{ state.title }}</strong>
            <p>{{ state.message }}</p>
          </div>
        </section>
      </div>
    </section>
  </BillsPageShell>
</template>
