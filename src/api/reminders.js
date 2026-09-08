import { apiClient } from './client.js'

export function createReminderRequestKey() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
  } catch {
    // Use the fallback below when the browser does not expose a secure UUID API.
  }

  return `reminder-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function mutationConfig(options = {}) {
  const { idempotencyKey, ...config } = options ?? {}
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      'Idempotency-Key': idempotencyKey || createReminderRequestKey(),
    },
  }
}

export const remindersApi = {
  async list(params) {
    const { data } = await apiClient.get('/reminders', { params })
    return data
  },

  async create(request, options = {}) {
    const { data } = await apiClient.post('/reminders', request, mutationConfig(options))
    return data
  },

  async update(reminderId, request, options = {}) {
    const { data } = await apiClient.put(
      `/reminders/${reminderId}`,
      request,
      mutationConfig(options),
    )
    return data
  },

  async cancel(reminderId, options = {}) {
    await apiClient.delete(`/reminders/${reminderId}`, mutationConfig(options))
  },
}
