const voiceScreenAliases = {
  '5-01': 'voice-voice-select',
  '5-02': 'voice-voice-preview',
  '5-03': 'voice-replay',
  '5-04': 'voice-ended',
  '5-05': 'voice-resume',
  '5-06': 'voice-expired',
  '5-07': 'voice-bill-reading',
  '5-08': 'voice-enabled',
}

const voiceScreenKeys = new Set(Object.values(voiceScreenAliases))
const voiceSettingsKeys = new Set(['voice-voice-select', 'voice-voice-preview'])

function normalizeVoiceScreenKey(screenKey) {
  const key = String(screenKey || '')
  return voiceScreenAliases[key] ?? key
}

function isVoiceScreen(screenKey) {
  return voiceScreenKeys.has(normalizeVoiceScreenKey(screenKey))
}

function isVoiceSettingsScreen(screenKey) {
  return voiceSettingsKeys.has(normalizeVoiceScreenKey(screenKey))
}

function canonicalTarget(routeName, screenKey, query) {
  const target = {
    name: routeName,
    params: { screenKey: normalizeVoiceScreenKey(screenKey) },
  }

  if (query && Object.keys(query).length) target.query = query
  return target
}

function createVoiceScreenGuard(to) {
  const screenKey = String(to.params.screenKey || '')
  const canonicalKey = normalizeVoiceScreenKey(screenKey)

  if (isVoiceSettingsScreen(canonicalKey)) {
    return canonicalTarget('my-page-voice', canonicalKey, to.query)
  }

  if (!isVoiceScreen(canonicalKey)) return { name: 'voice-home' }
  if (canonicalKey !== screenKey) return canonicalTarget('voice-screen', canonicalKey, to.query)

  return true
}

function createMyPageVoiceGuard(to) {
  const screenKey = String(to.params.screenKey || '')
  const canonicalKey = normalizeVoiceScreenKey(screenKey)

  if (!isVoiceSettingsScreen(canonicalKey)) return { name: 'my-page' }
  if (canonicalKey !== screenKey) return canonicalTarget('my-page-voice', canonicalKey, to.query)

  return true
}

export const voiceRoutes = [
  {
    path: '/mypage/voice/:screenKey',
    name: 'my-page-voice',
    component: () => import('@/features/voice/pages/VoiceRoutePage.vue'),
    props: true,
    meta: { service: 'voice', myPageVoice: true },
    beforeEnter: createMyPageVoiceGuard,
  },
  {
    path: '/voice/:screenKey',
    name: 'voice-screen',
    component: () => import('@/features/voice/pages/VoiceRoutePage.vue'),
    props: true,
    meta: { service: 'voice' },
    beforeEnter: createVoiceScreenGuard,
  },
]
