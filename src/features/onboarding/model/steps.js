export const ONBOARDING_STEPS = Object.freeze([
  { id: 'start', title: '시작하기', progress: 0 },
  { id: 'permissions', title: '권한 이용 안내', progress: 1 },
  { id: 'consent-overview', title: '약관 한눈에 보기', progress: 2 },
  { id: 'basic-info', title: '기본 정보', progress: 3 },
  { id: 'resident-number', title: '주민등록번호', progress: 4 },
  { id: 'address', title: '주소 입력', progress: 5 },
  { id: 'bank-account', title: '은행 계좌', progress: 6 },
  { id: 'phone', title: '휴대전화', progress: 7 },
  { id: 'emergency-contact', title: '비상 연락처', progress: 8 },
  { id: 'complete', title: '가입 완료', progress: 10 },
])

export const ONBOARDING_PROGRESS_TOTAL = 10

const ONBOARDING_DISPLAY_PROGRESS = Object.freeze({
  permissions: 1,
  'consent-overview': 2,
  'consent-optional': 2,
  'mydata-consent': 2,
  'ai-voice-consent': 2,
  'basic-info': 3,
  'missing-fields': 3,
  'resident-number': 4,
  address: 5,
  'address-not-found': 5,
  'bank-account': 6,
  'bank-select': 6,
  'account-error': 6,
  phone: 7,
  'emergency-contact': 8,
  'microphone-denied': 8,
  'notification-denied': 8,
})

export const ONBOARDING_DISPLAY_PROGRESS_TOTAL = 8

export function getOnboardingDisplayProgress(stepId) {
  const current = ONBOARDING_DISPLAY_PROGRESS[stepId]
  if (!current) return null

  return { current, total: ONBOARDING_DISPLAY_PROGRESS_TOTAL }
}

export function getOnboardingStep(stepId) {
  return ONBOARDING_STEPS.find(({ id }) => id === stepId) ?? null
}

export function getAdjacentStep(stepId, direction) {
  const currentIndex = ONBOARDING_STEPS.findIndex(({ id }) => id === stepId)
  if (currentIndex < 0) return null

  return ONBOARDING_STEPS[currentIndex + direction]?.id ?? null
}
