const billScreenAliases = {
  '3-02': 'bill-source-select',
  '3-02A': 'bill-camera',
  '3-03': 'bill-ocr-processing',
  '3-04': 'bill-review',
  '3-05': 'bill-low-confidence',
  '3-06': 'bill-confirm',
  '3-07': 'bill-complete',
  '3-08': 'bill-recognition-failed',
  '3-09': 'bill-unsupported-file',
  '3-10': 'bill-camera-permission',
  '3-11': 'bill-expired',
  '3-12': 'bill-cancelled',
  '3-13': 'bill-duplicate-request',
  '3-14': 'bill-payment-number',
  '3-15': 'bill-read-accuracy',
  '3-16': 'bill-read-aloud',
  '3-17': 'bill-retake',
  '3-18': 'bill-unsupported-format',
  '3-19': 'bill-file-too-large',
  '3-20': 'bill-overdue',
  '3-21': 'bill-paying',
  '3-22': 'bill-payment-failed',
}

const billScreenKeys = new Set(Object.values(billScreenAliases))

function normalizeBillScreenKey(screenKey) {
  const key = String(screenKey || '')
  return billScreenAliases[key] ?? key
}

function canonicalTarget(screenKey, query) {
  const target = {
    name: 'bills-screen',
    params: { screenKey: normalizeBillScreenKey(screenKey) },
  }

  if (query && Object.keys(query).length) target.query = query
  return target
}

function createBillsGuard(to) {
  const screenKey = String(to.params.screenKey || '')
  const canonicalKey = normalizeBillScreenKey(screenKey)

  if (!billScreenKeys.has(canonicalKey)) return { name: 'bills-home' }
  if (canonicalKey !== screenKey) return canonicalTarget(canonicalKey, to.query)
  return true
}

export const billsRoutes = [
  {
    path: '/bills/:screenKey',
    name: 'bills-screen',
    component: () => import('@/features/bills/pages/BillsRoutePage.vue'),
    props: true,
    meta: { service: 'bills' },
    beforeEnter: createBillsGuard,
  },
]
