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

  async get(billId) {
    const { data } = await apiClient.get(`/bills/${billId}`)
    return data
  },
}
