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

function normalizePaymentNumber(value) {
  return String(value ?? '').trim()
}

export function presentBillPaymentNumber(value) {
  const bill = normalizeBill(value)
  const sources = [bill, bill.ocrResult, bill.recognition, bill.ocr].filter(
    (source) => source && typeof source === 'object',
  )

  for (const source of sources) {
    const paymentNumber = firstValue(source, [
      'paymentNumber',
      'paymentNo',
      'billPaymentNumber',
      'paymentCode',
      'payNumber',
    ])
    const normalized = normalizePaymentNumber(paymentNumber)
    if (normalized) return normalized
  }

  return ''
}
