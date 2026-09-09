import { voiceRoutes } from '../../features/voice/routes.js'
import { billsRoutes } from '../../features/bills/routes.js'
import { livingRoutes } from '../../features/living/routes.js'
import { transferRoutes } from '../../features/transfer/routes.js'

export const routes = [
  {
    path: '/',
    redirect: { name: 'onboarding', params: { stepId: 'login' } },
  },
  {
    path: '/onboarding',
    redirect: { name: 'onboarding', params: { stepId: 'login' } },
  },
  {
    path: '/onboarding/help',
    name: 'onboarding-help',
    component: () => import('@/features/onboarding/pages/OnboardingHelpPage.vue'),
  },
  {
    path: '/font-size',
    name: 'font-size',
    component: () => import('@/features/my-page/pages/FontSizePage.vue'),
  },
  {
    path: '/onboarding/:stepId',
    name: 'onboarding',
    component: () => import('@/features/onboarding/pages/OnboardingPage.vue'),
  },
  {
    path: '/transfer',
    name: 'transfer-home',
    component: () => import('@/features/transfer/pages/TransferHomePage.vue'),
  },
  {
    path: '/bills',
    name: 'bills-home',
    component: () => import('@/app/pages/ServiceHomePage.vue'),
  },
  {
    path: '/living',
    name: 'living-home',
    component: () => import('@/app/pages/ServiceHomePage.vue'),
  },
  {
    path: '/mypage',
    name: 'my-page',
    component: () => import('@/features/my-page/pages/MyPagePage.vue'),
  },
  {
    path: '/mypage/font-size',
    name: 'my-page-font-size',
    component: () => import('@/features/my-page/pages/FontSizePage.vue'),
  },
  ...voiceRoutes,
  ...billsRoutes,
  ...livingRoutes,
  ...transferRoutes,
  {
    path: '/mypage/transfer-pin',
    name: 'transfer-pin',
    component: () => import('@/features/transfer/pages/TransferPinPage.vue'),
  },
  {
    path: '/voice',
    name: 'voice-home',
    redirect: { name: 'my-page' },
  },
  {
    path: '/design-system',
    name: 'design-system',
    component: () => import('@/app/pages/DesignSystemPage.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'onboarding', params: { stepId: 'login' } },
  },
]
