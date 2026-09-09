const transferScreenAliases = Object.fromEntries(
  Array.from({ length: 30 }, (_, index) => {
    const designId = `2-${String(index + 2).padStart(2, '0')}`
    const keys = [
      'transfer-listening',
      'transfer-processing',
      'transfer-speaking',
      'transfer-recipient-select',
      'transfer-contacts-permission',
      'transfer-amount-confirm',
      'transfer-confirm',
      'transfer-risk-confirm',
      'transfer-pending',
      'transfer-guardian-confirm',
      'transfer-guardian-message-failed',
      'transfer-authentication-expired',
      'transfer-complete',
      'transfer-voice-recognition-failed',
      'transfer-recipient-not-found',
      'transfer-recipient-confirm',
      'transfer-account-select',
      'transfer-existing-plan',
      'transfer-not-sent',
      'transfer-expired',
      'transfer-executing',
      'transfer-failed',
      'transfer-replay',
      'transfer-misheard',
      'transfer-conversation-ended',
      'transfer-scheduled-list',
      'transfer-scheduled-create',
      'transfer-scheduled-due',
      'transfer-scheduled-complete',
      'transfer-scheduled-edit',
    ]
    return [designId, keys[index]]
  }),
)

const transferScreenKeys = new Set(Object.values(transferScreenAliases))

function canonicalTarget(screenKey, query) {
  const target = { name: 'transfer-screen', params: { screenKey } }
  if (query && Object.keys(query).length) target.query = query
  return target
}

function createTransferGuard(to) {
  const requested = String(to.params.screenKey || '')
  const screenKey = transferScreenAliases[requested] ?? requested
  if (!transferScreenKeys.has(screenKey)) return { name: 'transfer-home' }
  return screenKey === requested ? true : canonicalTarget(screenKey, to.query)
}

export const transferRoutes = [
  {
    path: '/transfer/:screenKey',
    name: 'transfer-screen',
    component: () => import('@/features/transfer/pages/TransferRoutePage.vue'),
    props: true,
    meta: { service: 'transfer' },
    beforeEnter: createTransferGuard,
  },
]
