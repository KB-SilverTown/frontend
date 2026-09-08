import { apiClient } from './client.js'

function createRequestKey() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  } catch {
    // Use the fallback below when the browser does not expose a secure UUID API.
  }

  return `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function updateConfig(options = {}) {
  const { idempotencyKey, ...config } = options ?? {}
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      'Idempotency-Key': idempotencyKey || createRequestKey(),
    },
  }
}

export const profileApi = {
  async get() {
    const { data } = await apiClient.get('/users/me')
    return data
  },

  async update(request, options = {}) {
    const { data } = await apiClient.put('/users/me', request, updateConfig(options))
    return data
  },
}
