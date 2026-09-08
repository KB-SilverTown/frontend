<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/api/errors.js'
import { createReminderRequestKey, remindersApi } from '@/api/reminders.js'
import {
  buildReminderScheduledAt,
  formatReminderDateTime,
  reminderId,
  reminderInputValues,
  reminderItems,
  reminderScheduledAt,
  reminderSortTime,
  reminderStatusLabel,
  reminderTitle,
} from '@/services/reminderPresentation.js'
import '@/styles/reminder.css'

const route = useRoute()
const router = useRouter()
const reminders = ref([])
const isLoading = ref(false)
const isActionBusy = ref(false)
const loadError = ref('')
const actionError = ref('')
const showCancelConfirm = ref(false)
const mutationKey = ref('')
const form = reactive({
  title: '',
  date: '',
  time: '',
})
let requestId = 0

const isListView = computed(() => route.name === 'reminders')
const isCreateView = computed(() => route.name === 'reminder-create')
const isEditView = computed(() => route.name === 'reminder-edit')
const currentReminder = computed(() => {
  const targetId = String(route.params.reminderId ?? '').trim()
  if (!targetId) return null
  return reminders.value.find((reminder) => reminderId(reminder) === targetId) || null
})
const pageTitle = computed(() => {
  if (isCreateView.value) return '알림 만들기'
  if (isEditView.value) return '알림 편집'
  return '납부 알림'
})
const pageDescription = computed(() => {
  if (isCreateView.value) return '잊지 않도록 날짜와 시간을 정해 주세요.'
  if (isEditView.value) return '저장한 알림을 바꾸거나 취소할 수 있어요.'
  return '예정된 납부 알림을 확인하고 관리합니다.'
})
const reminderMinDate = computed(() => {
  const now = new Date()
  const pad = (part) => String(part).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
})

function mutationErrorMessage(error, operation) {
  const normalized = normalizeApiError(error)
  if (normalized.status === 404) return '알림을 찾지 못했어요. 목록을 다시 확인해 주세요.'

  const messages = {
    create: '알림을 저장하지 못했어요. 다시 시도해 주세요.',
    update: '알림을 변경하지 못했어요. 다시 시도해 주세요.',
    cancel: '알림을 취소하지 못했어요. 다시 시도해 주세요.',
  }
  return messages[operation] || normalized.message
}

function clearActionState() {
  actionError.value = ''
  mutationKey.value = ''
}

function resetForm() {
  form.title = ''
  form.date = ''
  form.time = ''
}

function fillForm(reminder) {
  const inputValues = reminderInputValues(reminderScheduledAt(reminder))
  form.title = String(reminder?.title ?? '')
  form.date = inputValues.date
  form.time = inputValues.time
}

function syncRouteForm() {
  showCancelConfirm.value = false
  clearActionState()
  if (isCreateView.value) resetForm()
  if (isEditView.value && currentReminder.value) fillForm(currentReminder.value)
}

watch(() => [route.name, route.params.reminderId], syncRouteForm, { immediate: true })
watch(
  currentReminder,
  (reminder) => {
    if (isEditView.value && reminder) fillForm(reminder)
  },
  { immediate: true },
)

async function loadReminders() {
  const currentRequestId = ++requestId
  isLoading.value = true
  loadError.value = ''

  try {
    const response = await remindersApi.list({ status: 'SCHEDULED' })
    if (currentRequestId !== requestId) return

    reminders.value = reminderItems(response).slice().sort((left, right) => {
      return reminderSortTime(left) - reminderSortTime(right)
    })
  } catch (error) {
    if (currentRequestId !== requestId) return
    loadError.value = normalizeApiError(error).message
  } finally {
    if (currentRequestId === requestId) isLoading.value = false
  }
}

function openCreate() {
  resetForm()
  clearActionState()
  return router.push({ name: 'reminder-create' })
}

function openEdit(reminder) {
  const targetId = reminderId(reminder)
  if (!targetId) return
  fillForm(reminder)
  clearActionState()
  return router.push({ name: 'reminder-edit', params: { reminderId: targetId } })
}

function backToList() {
  showCancelConfirm.value = false
  clearActionState()
  return router.push({ name: 'reminders' })
}

function leave() {
  requestId += 1
  return router.push({ name: 'living-home' })
}

function validateForm() {
  const title = form.title.trim()
  if (!title) return { error: '알림 제목을 입력해 주세요.' }
  if (!form.date || !form.time) return { error: '날짜와 시간을 모두 선택해 주세요.' }

  const scheduledAt = buildReminderScheduledAt(form.date, form.time)
  if (!scheduledAt) return { error: '날짜와 시간을 다시 선택해 주세요.' }
  if (new Date(scheduledAt).getTime() <= Date.now()) {
    return { error: '현재 이후의 날짜와 시간을 선택해 주세요.' }
  }

  return { request: { title, scheduledAt } }
}

function clearFieldError() {
  actionError.value = ''
  mutationKey.value = ''
}

async function saveReminder() {
  if (isActionBusy.value) return

  const validation = validateForm()
  if (validation.error) {
    actionError.value = validation.error
    return
  }

  const targetId = reminderId(currentReminder.value)
  if (isEditView.value && !targetId) {
    actionError.value = '수정할 알림을 찾지 못했어요. 목록을 다시 확인해 주세요.'
    return
  }

  const operation = isEditView.value ? 'update' : 'create'
  const key = mutationKey.value || createReminderRequestKey()
  mutationKey.value = key
  actionError.value = ''
  isActionBusy.value = true

  try {
    if (operation === 'update') {
      await remindersApi.update(targetId, validation.request, { idempotencyKey: key })
    } else {
      await remindersApi.create(validation.request, { idempotencyKey: key })
    }
    mutationKey.value = ''
    await router.push({ name: 'reminders' })
    await loadReminders()
  } catch (error) {
    actionError.value = mutationErrorMessage(error, operation)
  } finally {
    isActionBusy.value = false
  }
}

function requestCancel() {
  if (!currentReminder.value || isActionBusy.value) return
  actionError.value = ''
  showCancelConfirm.value = true
}

async function cancelReminder() {
  const targetId = reminderId(currentReminder.value)
  if (!targetId || isActionBusy.value) return

  const key = mutationKey.value || createReminderRequestKey()
  mutationKey.value = key
  actionError.value = ''
  isActionBusy.value = true

  try {
    await remindersApi.cancel(targetId, { idempotencyKey: key })
    mutationKey.value = ''
    showCancelConfirm.value = false
    await router.push({ name: 'reminders' })
    await loadReminders()
  } catch (error) {
    showCancelConfirm.value = false
    actionError.value = mutationErrorMessage(error, 'cancel')
  } finally {
    isActionBusy.value = false
  }
}

onMounted(() => {
  if (!isCreateView.value) loadReminders()
})

onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell reminder-device">
      <header class="app-header">
        <Button
          :aria-label="isListView ? '생활금융 화면으로 돌아가기' : '알림 목록으로 돌아가기'"
          class="app-back-button"
          size="icon"
          variant="secondary"
          @click="isListView ? leave() : backToList()"
        >
          ‹
        </Button>
        <strong class="app-brand">귀편한 금융</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main reminder-main">
        <section class="screen-heading reminder-heading">
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageDescription }}</p>
        </section>

        <div
          v-if="actionError"
          class="reminder-error"
          role="alert"
        >
          {{ actionError }}
        </div>

        <div
          v-if="isLoading"
          aria-live="polite"
          class="reminder-state"
          role="status"
        >
          <strong>알림을 불러오고 있어요</strong>
          <p>잠시만 기다려 주세요.</p>
        </div>

        <div
          v-else-if="loadError"
          class="reminder-state"
          role="alert"
        >
          <strong>알림을 불러오지 못했어요</strong>
          <p>{{ loadError }}</p>
          <Button
            :disabled="isActionBusy"
            variant="secondary"
            @click="loadReminders"
          >
            다시 불러오기
          </Button>
        </div>

        <section
          v-else-if="isListView"
          aria-label="납부 알림 목록"
        >
          <div
            v-if="reminders.length"
            class="reminder-list"
          >
            <button
              v-for="reminder in reminders"
              :key="reminderId(reminder)"
              :aria-label="`${reminderTitle(reminder)} ${formatReminderDateTime(reminderScheduledAt(reminder))} ${reminderStatusLabel(reminder.status)} 수정`"
              class="reminder-list-item"
              type="button"
              @click="openEdit(reminder)"
            >
              <span class="reminder-list-copy">
                <strong>{{ reminderTitle(reminder) }}</strong>
                <span>{{ formatReminderDateTime(reminderScheduledAt(reminder)) }}</span>
              </span>
              <span class="reminder-list-status">
                {{ reminderStatusLabel(reminder.status) }}
              </span>
            </button>
          </div>
          <div
            v-else
            class="reminder-empty"
          >
            <strong>등록된 알림이 없어요</strong>
            <p>납부일을 잊지 않도록 새 알림을 만들어 보세요.</p>
            <Button
              variant="secondary"
              @click="openCreate"
            >
              새 알림 만들기
            </Button>
          </div>
        </section>

        <form
          v-else
          aria-label="납부 알림 입력"
          class="reminder-form"
          @submit.prevent="saveReminder"
        >
          <label class="reminder-form-field">
            <span>알림 제목</span>
            <input
              v-model="form.title"
              autocomplete="off"
              maxlength="100"
              placeholder="예: 전기요금 납부일"
              required
              type="text"
              @input="clearFieldError"
            />
          </label>
          <label class="reminder-form-field">
            <span>날짜</span>
            <input
              v-model="form.date"
              :min="reminderMinDate"
              required
              type="date"
              @input="clearFieldError"
            />
          </label>
          <label class="reminder-form-field">
            <span>시간</span>
            <input
              v-model="form.time"
              required
              step="60"
              type="time"
              @input="clearFieldError"
            />
          </label>
          <p
            aria-live="polite"
            class="reminder-form-hint"
          >
            현재보다 이후인 날짜와 시간을 선택해 주세요.
          </p>
        </form>
      </main>

      <footer
        v-if="isListView && !loadError"
        class="app-actions reminder-actions"
      >
        <Button
          v-if="reminders.length"
          class="w-full"
          @click="openCreate"
        >
          새 알림 만들기
        </Button>
      </footer>
      <footer
        v-else-if="!isListView && !loadError"
        class="app-actions reminder-actions"
      >
        <Button
          class="w-full"
          :disabled="isActionBusy"
          @click="saveReminder"
        >
          {{ isActionBusy ? '저장 중…' : isEditView ? '변경 저장' : '알림 저장' }}
        </Button>
        <Button
          v-if="isEditView"
          class="w-full"
          :disabled="isActionBusy"
          variant="secondary"
          @click="requestCancel"
        >
          알림 취소
        </Button>
      </footer>

      <div
        v-if="showCancelConfirm"
        class="reminder-dialog-backdrop"
        @click.self="showCancelConfirm = false"
      >
        <section
          aria-describedby="reminder-cancel-description"
          aria-modal="true"
          class="reminder-dialog"
          role="dialog"
        >
          <h2>알림을 취소할까요?</h2>
          <p id="reminder-cancel-description">취소한 알림은 예정된 목록에서 사라집니다.</p>
          <div class="reminder-dialog-actions">
            <Button
              :disabled="isActionBusy"
              @click="cancelReminder"
            >
              취소하기
            </Button>
            <Button
              :disabled="isActionBusy"
              variant="secondary"
              @click="showCancelConfirm = false"
            >
              돌아가기
            </Button>
          </div>
        </section>
      </div>
    </article>
  </div>
</template>
