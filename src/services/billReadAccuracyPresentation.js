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

function fieldSources(source) {
  return [
    source,
    source?.fields,
    source?.ocrFields,
    source?.recognizedFields,
  ].filter((value) => value && typeof value === 'object')
}

function getSources(bill) {
  return [bill, bill.ocrResult, bill.recognition, bill.ocr]
    .filter((value) => value && typeof value === 'object')
    .flatMap(fieldSources)
}

function getFieldObject(sources, definition) {
  for (const source of sources) {
    const value = firstValue(source, definition.valueKeys)
    if (value && typeof value === 'object') return value
  }

  return null
}

function getFieldValue(sources, definition) {
  const fieldObject = getFieldObject(sources, definition)
  if (fieldObject) {
    const nestedValue = firstValue(fieldObject, ['value', 'text', 'raw', 'normalized'])
    if (nestedValue !== '') return nestedValue
  }

  for (const source of sources) {
    const value = firstValue(source, definition.valueKeys)
    if (value !== '' && (typeof value !== 'object' || value === null)) return value
  }

  return ''
}

function getConfidenceValue(sources, definition) {
  const fieldObject = getFieldObject(sources, definition)
  if (fieldObject) {
    const nestedConfidence = firstValue(fieldObject, ['confidence', 'accuracy', 'score'])
    if (nestedConfidence !== '') return nestedConfidence
  }

  for (const source of sources) {
    const directConfidence = firstValue(source, definition.confidenceKeys)
    if (directConfidence !== '') return directConfidence

    for (const containerKey of [
      'confidence',
      'confidences',
      'fieldConfidence',
      'fieldConfidences',
      'accuracy',
      'accuracies',
    ]) {
      const container = source[containerKey]
      if (!container || typeof container !== 'object') continue
      const nestedConfidence = firstValue(container, definition.containerKeys)
      if (nestedConfidence !== '') return nestedConfidence
    }
  }

  return ''
}

function normalizeConfidence(value) {
  const text = String(value ?? '').trim().toUpperCase()
  if (!text) return null

  if (['HIGH', 'CONFIDENT', 'CONFIRMED', 'GOOD'].includes(text)) return 0.9
  if (['MEDIUM', 'MID', 'PARTIAL', 'CHECK'].includes(text)) return 0.7
  if (['LOW', 'UNCERTAIN', 'UNCONFIRMED', 'BAD'].includes(text)) return 0.3

  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  if (number <= 1) return number
  if (number <= 100) return number / 100
  return null
}

function confidenceStatus(value) {
  if (value === null) return { key: 'unknown', label: '확인 필요' }
  if (value >= 0.9) return { key: 'high', label: '확실해요' }
  if (value >= 0.7) return { key: 'medium', label: '한 번 확인해 주세요' }
  return { key: 'low', label: '조금 흐려요' }
}

function formatAmount(value) {
  if (value === '') return '인식 결과 없음'
  const amount = Number(String(value).replace(/,/g, '').replace(/원/g, '').trim())
  return Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : String(value)
}

function formatDate(value) {
  if (value === '') return '인식 결과 없음'
  const text = String(value).trim()
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  return match ? `${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}` : text
}

const FIELD_DEFINITIONS = [
  {
    key: 'paymentNumber',
    label: '납부번호',
    valueKeys: ['paymentNumber', 'paymentNo', 'billPaymentNumber', 'paymentCode', 'payNumber'],
    confidenceKeys: [
      'paymentNumberConfidence',
      'paymentNoConfidence',
      'paymentNumberAccuracy',
      'paymentNoAccuracy',
    ],
    containerKeys: ['paymentNumber', 'paymentNo', 'billPaymentNumber', 'paymentCode', 'payNumber'],
    format: (value) => (value === '' ? '인식 결과 없음' : String(value)),
  },
  {
    key: 'amount',
    label: '금액',
    valueKeys: ['amount', 'totalAmount', 'dueAmount'],
    confidenceKeys: ['amountConfidence', 'totalAmountConfidence', 'dueAmountConfidence', 'amountAccuracy'],
    containerKeys: ['amount', 'totalAmount', 'dueAmount'],
    format: formatAmount,
  },
  {
    key: 'dueDate',
    label: '납부기한',
    valueKeys: ['dueDate', 'paymentDueDate', 'deadline'],
    confidenceKeys: ['dueDateConfidence', 'paymentDueDateConfidence', 'deadlineConfidence', 'dueDateAccuracy'],
    containerKeys: ['dueDate', 'paymentDueDate', 'deadline'],
    format: formatDate,
  },
]

export function presentBillReadAccuracy(value) {
  const bill = normalizeBill(value)
  const sources = getSources(bill)
  const fields = FIELD_DEFINITIONS.map((definition) => {
    const rawValue = getFieldValue(sources, definition)
    const confidence = normalizeConfidence(getConfidenceValue(sources, definition))
    const status = confidenceStatus(confidence)

    return {
      key: definition.key,
      label: definition.label,
      value: definition.format(rawValue),
      statusKey: status.key,
      statusLabel: status.label,
      hasValue: rawValue !== '',
    }
  })

  return {
    fields,
    hasValues: fields.some((field) => field.hasValue),
    needsReview: fields.some((field) => field.statusKey !== 'high'),
  }
}
