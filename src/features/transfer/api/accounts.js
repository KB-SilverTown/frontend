import { apiClient } from '../../../shared/api/client.js'
import { isMockTransferEnabled, mockAccountsApi } from './mockTransfer.js'

export const httpAccountsApi = {
  async list(params) {
    const { data } = await apiClient.get('/accounts', { params })
    return data
  },
}

export const accountsApi = isMockTransferEnabled() ? mockAccountsApi : httpAccountsApi
