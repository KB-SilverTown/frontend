import { apiClient } from './client.js'

export const mobileBranchesApi = {
  async nearby(params) {
    const { data } = await apiClient.get('/mobile-branches/nearby', { params })
    return data
  },
}
