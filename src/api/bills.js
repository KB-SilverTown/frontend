import { apiClient } from './client.js'

function normalizeConfirmationRequest(request = {}) {
  if (request.approved !== true) return request

  const confirmedPayee = String(request.confirmedPayee ?? '').trim()
  const confirmedAmount = Number(request.confirmedAmount)
  const confirmedDueDate = String(request.confirmedDueDate ?? '').trim()

  if (
    !confirmedPayee ||
    !Number.isSafeInteger(confirmedAmount) ||
    confirmedAmount <= 0 ||
    !isValidDateOnly(confirmedDueDate)
  ) {
    throw new Error('납부처·금액·납부기한을 다시 확인해 주세요.')
  }

  return {
    ...request,
    confirmedPayee,
    confirmedAmount,
    confirmedDueDate,
  }
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export const billsApi = {
  async list(params) {
    const { data } = await apiClient.get('/bills', { params })
    return data
  },

  async monthlySummary(params) {
    const { data } = await apiClient.get('/bills/monthly-summary', { params })
    return data
  },

  async ocr({ image, voiceSessionId } = {}) {
    const sessionId = String(voiceSessionId ?? '').trim()
    if (!sessionId) throw new Error('음성 세션을 준비한 뒤 고지서를 업로드해 주세요.')

    const formData = new FormData()
    if (image) formData.append('image', image, image.name ?? 'bill-image.jpg')
    formData.append('voiceSessionId', sessionId)

    const { data } = await apiClient.post('/bills/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async get(billId) {
    const { data } = await apiClient.get(`/bills/${billId}`)
    return data
  },

  async confirm(billId, request) {
    const confirmationRequest = normalizeConfirmationRequest(request)
    const { data } = await apiClient.post(`/bills/${billId}/confirm`, confirmationRequest)
    return data
  },
}
