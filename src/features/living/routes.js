const livingScreenAliases = {
  '4-02': 'living-accounts',
  '4-03': 'living-accounts-empty',
  '4-04': 'living-accounts-error',
  '4-05': 'living-session-expired',
  '4-06': 'living-reminders',
  '4-07': 'living-reminder-create',
  '4-08': 'living-reminder-edit',
  '4-09': 'living-reminder-arrived',
  '4-10': 'living-branches',
  '4-11': 'living-branch-detail',
  '4-12': 'living-location-permission',
  '4-13': 'living-voice-settings',
  '4-14': 'living-profile-edit',
  '4-15': 'living-emergency-contact-edit',
  '4-16': 'living-consents',
  '4-17': 'living-reminders-empty',
  '4-18': 'living-reminders-error',
  '4-19': 'living-reminders-disabled',
  '4-20': 'living-branches-empty',
  '4-21': 'living-branches-error',
  '4-22': 'living-reminder-speak',
  '4-23': 'living-reminder-notice',
  '4-24': 'living-reminder-reading',
  '4-25': 'living-reminder-quiet-hours',
  '4-26': 'living-reminder-missed',
}

const livingScreenKeys = new Set(Object.values(livingScreenAliases))

function normalizeLivingScreenKey(screenKey) {
  const key = String(screenKey || '')
  return livingScreenAliases[key] ?? key
}

function canonicalTarget(screenKey, query) {
  const target = {
    name: 'living-screen',
    params: { screenKey: normalizeLivingScreenKey(screenKey) },
  }
  if (query && Object.keys(query).length) target.query = query
  return target
}

function createLivingGuard(to) {
  const screenKey = String(to.params.screenKey || '')
  const canonicalKey = normalizeLivingScreenKey(screenKey)

  if (canonicalKey === 'living-voice-settings') {
    const target = { name: 'my-page-voice', params: { screenKey: 'voice-voice-select' } }
    if (to.query && Object.keys(to.query).length) target.query = to.query
    return target
  }
  if (!livingScreenKeys.has(canonicalKey)) return { name: 'living-home' }
  if (canonicalKey !== screenKey) return canonicalTarget(canonicalKey, to.query)
  return true
}

export const livingRoutes = [
  {
    path: '/living/:screenKey',
    name: 'living-screen',
    component: () => import('@/features/living/pages/LivingRoutePage.vue'),
    props: true,
    meta: { service: 'living' },
    beforeEnter: createLivingGuard,
  },
]
