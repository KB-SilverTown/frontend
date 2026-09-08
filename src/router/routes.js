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
    path: '/font-size',
    name: 'font-size',
    component: () => import('@/views/MyPageFontSizeView.vue'),
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
    path: '/living',
    name: 'living-home',
    component: () => import('@/views/ServiceHomeView.vue'),
  },
  {
    path: '/living/mobile-branches',
    name: 'mobile-branches',
    component: () => import('@/views/MobileBranchView.vue'),
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
    path: '/:pathMatch(.*)*',
    redirect: { name: 'onboarding', params: { stepId: 'start' } },
  },
]
