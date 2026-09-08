import { apiClient } from './client.js'

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
}
