function firstValue(value, keys) {
  for (const key of keys) {
    if (value?.[key] !== undefined && value?.[key] !== null && value[key] !== '') {
      return value[key]
    }
  }

  return ''
}

function normalizeBill(value) {
  if (value?.bill && typeof value.bill === 'object') return value.bill
  if (value?.data?.bill && typeof value.data.bill === 'object') return value.data.bill
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) {
    return value.data
  }
  return value || {}
}

function normalizeDate(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!match) return ''

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function normalizeAmount(value) {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '').replace(/원/g, '').trim())
  return Number.isSafeInteger(amount) && amount > 0 ? String(amount) : ''
}

export function presentBillConfirmation(value) {
  const bill = normalizeBill(value)

  return {
    payee: String(firstValue(bill, ['payee', 'billName', 'provider', 'name']) || '').trim(),
    amount: normalizeAmount(firstValue(bill, ['amount', 'totalAmount', 'dueAmount'])),
    dueDate: normalizeDate(firstValue(bill, ['dueDate', 'paymentDueDate', 'deadline'])),
  }
}

export function isValidBillConfirmationDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function buildBillConfirmationRequest(values = {}) {
  const amount = Number(String(values.amount ?? '').replace(/,/g, '').replace(/원/g, '').trim())

  return {
    approved: true,
    confirmedPayee: String(values.payee ?? '').trim(),
    confirmedAmount: amount,
    confirmedDueDate: String(values.dueDate ?? '').trim(),
  }
}
