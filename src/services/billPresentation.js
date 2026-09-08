export function responseItems(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.bills)) return value.bills
  return []
}

function firstValue(value, keys) {
  for (const key of keys) {
    if (value?.[key] !== undefined && value?.[key] !== null && value[key] !== '') {
      return value[key]
    }
  }

  return ''
}

export function billIdentifier(bill) {
  return String(firstValue(bill, ['billId', 'id']) || '')
}

export function billPayee(bill) {
  return String(firstValue(bill, ['payee', 'billName', 'provider', 'name']) || '고지서')
}

export function billAmount(bill) {
  const amount = Number(firstValue(bill, ['amount', 'totalAmount', 'dueAmount']))
  return Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : '금액 확인 중'
}

export function billStatusLabel(bill) {
  const status = String(firstValue(bill, ['status', 'paymentStatus'])).toUpperCase()

  if (['PAID', 'PAYMENT_COMPLETED', 'COMPLETED', 'SETTLED'].includes(status)) {
    return '납부 완료'
  }
  if (['OVERDUE', 'LATE'].includes(status)) return '납부 지연'
  if (['CANCELLED', 'CANCELED'].includes(status)) return '취소됨'
  return status ? String(firstValue(bill, ['status', 'paymentStatus'])) : '납부 전'
}

export function billDueDateLabel(bill) {
  const value = String(firstValue(bill, ['dueDate', 'paymentDueDate', 'deadline']) || '')
  if (!value) return '납부기한 확인 중'

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) return `${dateOnly[1]}.${dateOnly[2]}.${dateOnly[3]}`

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR')
}

export function presentBill(bill, index = 0) {
  return {
    key: billIdentifier(bill) || `${billPayee(bill)}-${index}`,
    payee: billPayee(bill),
    amount: billAmount(bill),
    status: billStatusLabel(bill),
    dueDate: billDueDateLabel(bill),
  }
}

export function presentBillSummary(value, fallbackCount = 0) {
  const source = value?.summary && typeof value.summary === 'object' ? value.summary : value || {}
  const countValue = Number(firstValue(source, ['totalCount', 'billCount', 'count']))
  const amountValue = Number(firstValue(source, ['totalAmount', 'amount']))

  return {
    count: Number.isFinite(countValue) ? countValue : fallbackCount,
    amount: Number.isFinite(amountValue)
      ? `${amountValue.toLocaleString('ko-KR')}원`
      : '금액 확인 중',
    hasAmount: Number.isFinite(amountValue),
    hasCount: Number.isFinite(countValue),
  }
}
