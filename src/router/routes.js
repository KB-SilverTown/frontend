export const routes = [
  {
    path: '/',
    redirect: { name: 'onboarding', params: { stepId: 'start' } },
  },
  {
    path: '/onboarding',
    redirect: { name: 'onboarding', params: { stepId: 'start' } },
  },
  {
    path: '/onboarding/help',
    name: 'onboarding-help',
    component: () => import('@/views/OnboardingHelpView.vue'),
  },
  {
    path: '/my-page',
    name: 'my-page',
    component: () => import('@/views/MyPageView.vue'),
  },
  {
    path: '/font-size',
    name: 'font-size',
    component: () => import('@/views/MyPageFontSizeView.vue'),
  },
  {
    path: '/my-page/font-size',
    name: 'my-page-font-size',
    component: () => import('@/views/MyPageFontSizeView.vue'),
  },
  {
    path: '/my-page/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
  },
  {
    path: '/my-page/consents',
    name: 'consents',
    component: () => import('@/views/ConsentView.vue'),
  },
  {
    path: '/onboarding/:stepId',
    name: 'onboarding',
    component: () => import('@/views/OnboardingView.vue'),
  },
  {
    path: '/bills',
    name: 'bills-home',
    component: () => import('@/views/ServiceHomeView.vue'),
  },
  {
    path: '/bills/camera',
    name: 'bills-camera',
    component: () => import('@/views/BillCameraView.vue'),
  },
  {
    path: '/bills/camera-permission',
    name: 'bill-camera-permission',
    component: () => import('@/views/BillCameraPermissionView.vue'),
  },
  {
    path: '/bills/ocr',
    name: 'bills-ocr',
    component: () => import('@/views/BillOcrView.vue'),
  },
  {
    path: '/bills/ocr/failed',
    name: 'bill-recognition-failed',
    component: () => import('@/views/BillOcrView.vue'),
  },
  {
    path: '/bills/cancelled',
    name: 'bill-cancelled',
    component: () => import('@/views/BillCancelledView.vue'),
  },
  {
    path: '/bills/unsupported-format',
    name: 'bill-unsupported-format',
    component: () => import('@/views/BillUnsupportedFormatView.vue'),
  },
  {
    path: '/bills/unsupported-file',
    name: 'bill-unsupported-file',
    component: () => import('@/views/BillUnsupportedFileView.vue'),
  },
  {
    path: '/bills/file-too-large',
    name: 'bill-file-too-large',
    component: () => import('@/views/BillFileTooLargeView.vue'),
  },
  {
    path: '/bills/retake',
    name: 'bill-retake',
    component: () => import('@/views/BillRetakeView.vue'),
  },
  {
    path: '/bills/:billId/payment-number',
    name: 'bill-payment-number',
    component: () => import('@/views/BillPaymentNumberView.vue'),
  },
  {
    path: '/bills/:billId/read-accuracy',
    name: 'bill-read-accuracy',
    component: () => import('@/views/BillReadAccuracyView.vue'),
  },
  {
    path: '/bills/:billId/overdue',
    name: 'bill-overdue',
    component: () => import('@/views/BillDetailView.vue'),
  },
  {
    path: '/bills/:billId/expired',
    name: 'bill-expired',
    component: () => import('@/views/BillReviewView.vue'),
  },
  {
    path: '/bills/:billId/review/edit',
    name: 'bill-low-confidence',
    component: () => import('@/views/BillReviewView.vue'),
  },
  {
    path: '/bills/:billId/review',
    name: 'bill-review',
    component: () => import('@/views/BillReviewView.vue'),
  },
  {
    path: '/bills/:billId',
    name: 'bill-detail',
    component: () => import('@/views/BillDetailView.vue'),
  },
  {
    path: '/living',
    name: 'living-home',
    component: () => import('@/views/ServiceHomeView.vue'),
  },
  {
    path: '/living/session-expired',
    name: 'living-session-expired',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/living/mobile-branches',
    name: 'mobile-branches',
    component: () => import('@/views/MobileBranchView.vue'),
  },
  {
    path: '/living/mobile-branches/location-permission',
    name: 'living-location-permission',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/living/mobile-branches/empty',
    name: 'living-branches-empty',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/living/mobile-branches/error',
    name: 'living-branches-error',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/living/mobile-branches/:branchId',
    name: 'mobile-branch-detail',
    component: () => import('@/views/MobileBranchView.vue'),
  },
  {
    path: '/living/reminders',
    name: 'reminders',
    component: () => import('@/views/ReminderView.vue'),
  },
  {
    path: '/living/reminders/empty',
    name: 'living-reminders-empty',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/living/reminders/error',
    name: 'living-reminders-error',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/living/reminders/disabled',
    name: 'living-reminders-disabled',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/living/reminders/arrived',
    name: 'living-reminder-arrived',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/living/reminders/new',
    name: 'reminder-create',
    component: () => import('@/views/ReminderView.vue'),
  },
  {
    path: '/living/reminders/:reminderId/edit',
    name: 'reminder-edit',
    component: () => import('@/views/ReminderView.vue'),
  },
  {
    path: '/living/emergency-contact',
    name: 'living-emergency-contact-edit',
    component: () => import('@/views/LivingStateView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'onboarding', params: { stepId: 'start' } },
  },
]
