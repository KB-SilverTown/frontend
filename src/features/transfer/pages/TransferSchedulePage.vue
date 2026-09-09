<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TransferPageShell from '@/features/transfer/components/TransferPageShell.vue'
import { useTransferPlanStore } from '@/features/transfer/stores/transferPlan.js'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({ screenKey: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const plans = useTransferPlanStore()
const label = ref('')
const amount = ref('')
const day = ref('')
const repeat = ref('MONTHLY')
const error = ref('')
const editId = computed(() => String(route.query.planId || ''))
const editing = computed(() => props.screenKey === 'transfer-scheduled-edit')
const form = computed(() =>
  ['transfer-scheduled-create', 'transfer-scheduled-edit'].includes(props.screenKey),
)
const title = computed(() =>
  form.value
    ? editing.value
      ? '보낼 돈 고치기'
      : '보낼 돈 정하기'
    : props.screenKey === 'transfer-scheduled-due'
      ? '오늘 보낼 돈'
      : props.screenKey === 'transfer-scheduled-complete'
        ? '이미 보내셨어요'
        : '이번 달 보낼 돈',
)
const description = computed(() =>
  form.value ? '받는 분, 금액, 날짜를 정해 주세요.' : '정해둔 보낼 돈을 확인합니다.',
)
const routeTo = (screenKey, query) => ({
  name: 'transfer-screen',
  params: { screenKey },
  ...(query ? { query } : {}),
})
function save() {
  const input = {
    label: label.value.trim(),
    recipientName: label.value.trim(),
    amount: Number(amount.value.replace(/[^0-9]/g, '')),
    dayOfMonth: Number(day.value),
    repeat: repeat.value,
  }
  const saved = editing.value ? plans.updatePlan(editId.value, input) : plans.addPlan(input)
  if (!saved) {
    error.value = plans.error || '약속을 저장하지 못했어요.'
    return
  }
  router.push(routeTo('transfer-scheduled-list'))
}
function primary() {
  if (form.value) return save()
  if (props.screenKey === 'transfer-scheduled-due') {
    const due = plans.duePlans[0]
    return due
      ? router.push(
          routeTo(
            plans.alreadySentThisMonth(due.id)
              ? 'transfer-scheduled-complete'
              : 'transfer-listening',
            { planId: due.id },
          ),
        )
      : router.push(routeTo('transfer-scheduled-list'))
  }
  return router.push(routeTo('transfer-scheduled-create'))
}
function secondary() {
  if (editing.value && plans.removePlan(editId.value))
    return router.push(routeTo('transfer-scheduled-list'))
  return goBackOrReplace(router, { name: 'transfer-home' })
}
watch(
  [() => props.screenKey, editId],
  () => {
    plans.ensureLoaded()
    error.value = ''
    const plan = editing.value ? plans.findPlan(editId.value) : null
    if (editing.value && !plan) router.replace(routeTo('transfer-scheduled-list'))
    if (plan) {
      label.value = plan.label
      amount.value = String(plan.amount)
      day.value = String(plan.dayOfMonth)
      repeat.value = plan.repeat
    }
  },
  { immediate: true },
)
</script>
<template>
  <TransferPageShell
    :title="title"
    :description="description"
    :primary-label="
      form ? '저장' : screenKey === 'transfer-scheduled-due' ? '송금하기' : '보낼 돈 정하기'
    "
    :secondary-label="editing ? '삭제' : ''"
    @back="goBackOrReplace(router, { name: 'transfer-home' })"
    @primary="primary"
    @secondary="secondary"
    ><template #error>{{ error }}</template>
    <section class="service-route-screen-content screen-content">
      <div class="content">
        <template v-if="form"
          ><label class="service-route-input-field"
            ><span>무엇을 보내는 돈인가요</span
            ><input
              v-model="label"
              maxlength="30"
              type="text" /></label
          ><label class="service-route-input-field"
            ><span>보낼 금액</span
            ><input
              v-model="amount"
              inputmode="numeric"
              maxlength="12"
              type="text" /></label
          ><label class="service-route-input-field"
            ><span>보낼 날짜</span
            ><input
              v-model="day"
              inputmode="numeric"
              maxlength="2"
              type="text" /></label
        ></template>
        <div
          v-else
          class="service-route-live-rows"
        >
          <p
            v-if="!plans.sortedPlans.length"
            class="service-route-live-empty"
          >
            아직 정해두신 것이 없어요.
          </p>
          <button
            v-for="plan in plans.sortedPlans"
            :key="plan.id"
            class="service-route-live-row"
            type="button"
            @click="router.push(routeTo('transfer-scheduled-edit', { planId: plan.id }))"
          >
            <span>{{ plan.label }}</span
            ><b>{{ Number(plan.amount).toLocaleString('ko-KR') }}원 · {{ plan.dayOfMonth }}일</b>
          </button>
        </div>
      </div>
    </section></TransferPageShell
  >
</template>
