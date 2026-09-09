<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/shared/components/ui/button'

import LivingPageShell from '@/features/living/components/LivingPageShell.vue'
import { useServiceDataStore } from '@/features/living/stores/serviceData.js'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({ screenKey: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const serviceData = useServiceDataStore()
const title = ref('납부 알림 목록')
const description = ref('등록한 알림을 확인합니다.')
const formTitle = ref('')
const formDate = ref('')
const formTime = ref('')
const error = ref('')
const busy = ref(false)
const selectedReminder = computed(() =>
  serviceData.reminders.find(
    (item) => String(item.reminderId ?? item.id) === String(route.query.reminderId || ''),
  ),
)
const isForm = computed(() =>
  ['living-reminder-create', 'living-reminder-edit'].includes(props.screenKey),
)
const isList = computed(() => props.screenKey === 'living-reminders')

const isEmpty = computed(() => props.screenKey === 'living-reminders-empty')
function routeTo(screenKey, query = {}) {
  return { name: 'living-screen', params: { screenKey }, query }
}
function formatDate(value) {
  return value ? new Date(value).toLocaleString('ko-KR') : '시간 확인 중'
}
function setHeadings() {
  const labels = {
    'living-reminders': ['납부 알림 목록', '등록한 알림을 확인합니다.'],
    'living-reminder-create': ['알림 만들기', '날짜와 시간을 정해 드립니다.'],
    'living-reminder-edit': ['알림 편집·취소', '알림 시간을 바꾸거나 취소합니다.'],
    'living-reminders-empty': ['알림이 없어요', '필요한 납부 알림을 추가해 주세요.'],
    'living-reminders-error': ['알림을 못 가져왔어요', '다시 불러와 주세요.'],
  }
  ;[title.value, description.value] = labels[props.screenKey] || ['알림 안내', '알림을 확인합니다.']
}
async function load() {
  setHeadings()
  error.value = ''
  if (
    ![
      'living-reminders',
      'living-reminder-edit',
      'living-reminders-empty',
      'living-reminders-error',
    ].includes(props.screenKey)
  )
    return
  try {
    await serviceData.loadReminders({ status: 'SCHEDULED' })
    if (props.screenKey === 'living-reminders') {
      await router.replace(
        routeTo(serviceData.reminders.length ? 'living-reminders' : 'living-reminders-empty'),
      )
    }
    if (props.screenKey === 'living-reminder-edit' && !selectedReminder.value)
      await router.replace(routeTo('living-reminders'))
    if (props.screenKey === 'living-reminder-edit' && selectedReminder.value) {
      const date = new Date(selectedReminder.value.scheduledAt)
      formTitle.value = selectedReminder.value.title || ''
      formDate.value = date.toISOString().slice(0, 10)
      formTime.value = date.toTimeString().slice(0, 5)
    }
  } catch (loadError) {
    error.value = loadError?.message || '알림을 불러오지 못했어요.'
    if (props.screenKey === 'living-reminders')
      await router.replace(routeTo('living-reminders-error'))
  }
}
async function save() {
  const name = formTitle.value.trim()
  const scheduledAt = new Date(`${formDate.value}T${formTime.value}:00`)
  if (
    !name ||
    !formDate.value ||
    !formTime.value ||
    Number.isNaN(scheduledAt.getTime()) ||
    scheduledAt <= new Date()
  ) {
    error.value = '현재 이후의 알림 제목, 날짜와 시간을 입력해 주세요.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    if (props.screenKey === 'living-reminder-edit')
      await serviceData.updateReminder(route.query.reminderId, {
        title: name,
        scheduledAt: scheduledAt.toISOString(),
      })
    else await serviceData.createReminder({ title: name, scheduledAt: scheduledAt.toISOString() })
    await router.push(routeTo('living-reminders'))
  } catch (saveError) {
    error.value = saveError?.message || '알림을 저장하지 못했어요.'
  } finally {
    busy.value = false
  }
}
async function cancel() {
  busy.value = true
  error.value = ''
  try {
    await serviceData.cancelReminder(route.query.reminderId)
    await router.push(routeTo('living-reminders'))
  } catch (cancelError) {
    error.value = cancelError?.message || '알림을 취소하지 못했어요.'
  } finally {
    busy.value = false
  }
}
function primary() {
  if (isList.value || isEmpty.value) return router.push(routeTo('living-reminder-create'))
  if (isForm.value) return save()
  return load()
}
watch(() => [props.screenKey, route.query.reminderId], load, { immediate: true })
</script>

<template>
  <LivingPageShell
    :busy="busy || serviceData.loading.reminders"
    :description="description"
    :primary-label="isList || isEmpty ? '알림 추가' : isForm ? '저장' : '다시 불러오기'"
    :secondary-label="screenKey === 'living-reminder-edit' ? '알림 취소' : ''"
    :title="title"
    @back="goBackOrReplace(router, { name: 'living-home' })"
    @primary="primary"
    @secondary="cancel"
  >
    <p
      v-if="error"
      class="service-route-error"
      role="alert"
    >
      {{ error }}
    </p>
    <section class="service-route-screen-content screen-content">
      <div class="content">
        <template v-if="isList"
          ><p
            v-if="!serviceData.reminders.length"
            class="reminder-state"
          >
            등록된 알림이 없어요.
          </p>
          <div class="reminder-list">
            <Button
              v-for="item in serviceData.reminders"
              :key="item.reminderId ?? item.id"
              class="reminder-list-item"
              variant="secondary"
              @click="
                router.push(
                  routeTo('living-reminder-edit', { reminderId: item.reminderId ?? item.id }),
                )
              "
            >
              <span class="reminder-list-copy">
                <strong>{{ item.title || '제목 없는 리마인더' }}</strong>
                <span>{{ formatDate(item.scheduledAt) }}</span>
              </span>
              <span class="reminder-list-status">예정</span>
            </Button>
          </div></template
        >
        <template v-else-if="isForm"
          ><label class="service-route-input-field"
            ><span>알림 제목</span
            ><input
              v-model="formTitle"
              maxlength="30"
              type="text" /></label
          ><label class="service-route-input-field"
            ><span>날짜</span
            ><input
              v-model="formDate"
              :min="new Date().toISOString().slice(0, 10)"
              type="date" /></label
          ><label class="service-route-input-field"
            ><span>시간</span
            ><input
              v-model="formTime"
              type="time" /></label
        ></template>
        <section
          v-else
          class="hero"
        >
          <div class="hero-icon">!</div>
          <div>
            <strong>{{ title }}</strong>
            <p>{{ description }}</p>
          </div>
        </section>
      </div>
    </section>
  </LivingPageShell>
</template>
