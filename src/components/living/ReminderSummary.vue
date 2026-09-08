<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { remindersApi } from '@/api/reminders.js'
import { withAppLoading } from '@/services/appLoading.js'
import {
  formatReminderDateTime,
  reminderItems,
  reminderScheduledAt,
  reminderSortTime,
  reminderTitle,
} from '@/services/reminderPresentation.js'
import '@/styles/living-summary.css'

const reminders = ref([])
const loading = ref(false)
const errorMessage = ref('')
let requestId = 0

async function loadReminders() {
  const currentRequestId = ++requestId
  loading.value = true
  errorMessage.value = ''

  try {
    await withAppLoading(async () => {
      const response = await remindersApi.list({ status: 'SCHEDULED' })
      if (currentRequestId !== requestId) return

      reminders.value = reminderItems(response).slice().sort((left, right) => {
        return reminderSortTime(left) - reminderSortTime(right)
      })
    })
  } catch {
    if (currentRequestId === requestId) {
      errorMessage.value = '납부 알림을 불러오지 못했어요.'
    }
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}

onMounted(loadReminders)
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <section
    aria-labelledby="living-reminder-summary-title"
    class="living-reminder-summary"
  >
    <div class="living-reminder-summary-heading">
      <div>
        <span class="living-reminder-summary-kicker">납부 알림</span>
        <h2 id="living-reminder-summary-title">놓치지 않도록 알려드려요</h2>
      </div>
      <span
        v-if="!loading && !errorMessage"
        class="living-reminder-summary-count"
      >
        {{ reminders.length }}건
      </span>
    </div>

    <p
      v-if="loading"
      aria-live="polite"
      class="living-reminder-summary-status"
      role="status"
    >
      예정된 알림을 확인하고 있어요.
    </p>
    <div
      v-else-if="errorMessage"
      class="living-reminder-summary-error"
      role="alert"
    >
      <p>{{ errorMessage }}</p>
      <Button
        size="sm"
        variant="secondary"
        @click="loadReminders"
      >
        다시 불러오기
      </Button>
    </div>
    <div
      v-else-if="reminders.length"
      class="living-reminder-summary-content"
    >
      <p class="living-reminder-summary-status">
        예정된 납부 알림 {{ reminders.length }}건이 있어요.
      </p>
      <RouterLink
        class="living-reminder-summary-link"
        :to="{ name: 'reminders' }"
      >
        <span>
          <strong>{{ reminderTitle(reminders[0]) }}</strong>
          <small>{{ formatReminderDateTime(reminderScheduledAt(reminders[0])) }}</small>
        </span>
        <b aria-hidden="true">›</b>
      </RouterLink>
    </div>
    <div
      v-else
      class="living-reminder-summary-empty"
    >
      <p>등록된 알림이 없어요. 납부일을 잊지 않도록 정해 보세요.</p>
      <RouterLink
        class="living-reminder-summary-link"
        :to="{ name: 'reminder-create' }"
      >
        새 알림 만들기 <b aria-hidden="true">›</b>
      </RouterLink>
    </div>
  </section>
</template>
