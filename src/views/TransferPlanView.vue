<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { useTransferPlanStore } from '@/stores/transferPlan.js'
import { useTransferStore } from '@/stores/transfer.js'
import '@/styles/transfer.css'

const route = useRoute()
const router = useRouter()
const planStore = useTransferPlanStore()
const transferStore = useTransferStore()

const editingId = computed(() => String(route.params.planId ?? ''))
const isEditing = computed(() => Boolean(editingId.value))
const isForm = computed(() => route.name === 'transfer-plan-new' || isEditing.value)

const form = ref({ recipientName: '', amount: '', dayOfMonth: '', repeat: 'MONTHLY' })
const actionError = ref('')
const savedMessage = ref('')

const plans = computed(() => planStore.sortedPlans)
const duePlans = computed(() =>
  planStore.duePlans.filter((plan) => !planStore.alreadySentThisMonth(plan.id)),
)
const displayError = computed(() => actionError.value || planStore.error || '')

function formatAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : ''
}

function planSummary(plan) {
  return `매달 ${plan.dayOfMonth}일 · ${formatAmount(plan.amount)}`
}

function onlyDigits(value, max) {
  return String(value ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, max)
}

function fillForm(plan) {
  form.value = {
    recipientName: plan?.recipientName ?? '',
    amount: plan ? String(plan.amount) : '',
    dayOfMonth: plan ? String(plan.dayOfMonth) : '',
    repeat: plan?.repeat ?? 'MONTHLY',
  }
}

function savePlan() {
  actionError.value = ''
  savedMessage.value = ''

  const input = {
    recipientName: form.value.recipientName,
    label: form.value.recipientName,
    amount: Number(form.value.amount),
    dayOfMonth: Number(form.value.dayOfMonth),
    repeat: form.value.repeat,
  }

  const saved = isEditing.value
    ? planStore.updatePlan(editingId.value, input)
    : planStore.addPlan(input)

  if (!saved) return

  savedMessage.value = '약속을 저장했어요.'
  router.push({ name: 'transfer-plans' })
}

function removePlan(planId) {
  actionError.value = ''
  planStore.removePlan(planId)
}

/** 약속은 알림일 뿐이라 실제 송금은 사용자가 직접 진행한다. */
function startTransferFromPlan(plan) {
  transferStore.reset()
  transferStore.setPlanId(plan.id)
  transferStore.setAmount(plan.amount)
  return router.push({ name: 'transfer-flow' })
}

onMounted(() => {
  planStore.ensureLoaded()
  if (isEditing.value) fillForm(planStore.findPlan(editingId.value))
})

watch(editingId, (planId) => {
  if (planId) fillForm(planStore.findPlan(planId))
  else fillForm(null)
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell">
      <header class="app-header">
        <Button
          aria-label="이전 화면으로 돌아가기"
          class="app-header-button"
          size="icon"
          variant="secondary"
          @click="router.back()"
        >
          ‹
        </Button>
        <strong class="app-brand">정기 송금</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main transfer-main">
        <section class="screen-heading">
          <h1>{{ isForm ? (isEditing ? '약속 고치기' : '약속 만들기') : '정기 송금 약속' }}</h1>
          <p>
            {{
              isForm
                ? '받는 분과 금액, 보낼 날짜를 정해 주세요.'
                : '정한 날이 오면 알려드려요. 보내기는 직접 확인한 뒤에 합니다.'
            }}
          </p>
        </section>

        <div class="transfer-content">
          <template v-if="isForm">
            <div class="transfer-section">
              <label
                class="transfer-field-label"
                for="plan-recipient"
              >
                받는 분
              </label>
              <input
                id="plan-recipient"
                v-model="form.recipientName"
                class="transfer-field"
                maxlength="30"
                placeholder="예: 김영희"
                type="text"
              />
            </div>

            <div class="transfer-section">
              <label
                class="transfer-field-label"
                for="plan-amount"
              >
                보낼 금액
              </label>
              <input
                id="plan-amount"
                class="transfer-field transfer-amount-field"
                inputmode="numeric"
                maxlength="12"
                placeholder="예: 300000"
                type="text"
                :value="form.amount"
                @input="form.amount = onlyDigits($event.target.value, 12)"
              />
            </div>

            <div class="transfer-section">
              <label
                class="transfer-field-label"
                for="plan-day"
              >
                보낼 날짜 (1일 ~ 31일)
              </label>
              <input
                id="plan-day"
                class="transfer-field"
                inputmode="numeric"
                maxlength="2"
                placeholder="예: 25"
                type="text"
                :value="form.dayOfMonth"
                @input="form.dayOfMonth = onlyDigits($event.target.value, 2)"
              />
              <p class="transfer-note">말일이 없는 달에는 그 달의 마지막 날에 알려드려요.</p>
            </div>
          </template>

          <template v-else>
            <div
              v-if="duePlans.length"
              class="transfer-note"
              role="status"
            >
              오늘 보낼 약속이 {{ duePlans.length }}건 있어요.
            </div>

            <p v-if="!plans.length">아직 정해 둔 약속이 없어요.</p>

            <div
              v-else
              class="transfer-choice-list"
            >
              <div
                v-for="plan in plans"
                :key="plan.id"
                class="transfer-plan-row"
              >
                <div class="transfer-plan-copy">
                  <strong>{{ plan.recipientName }}</strong>
                  <small>{{ planSummary(plan) }}</small>
                </div>
                <div class="transfer-plan-actions">
                  <Button
                    size="sm"
                    @click="startTransferFromPlan(plan)"
                  >
                    지금 보내기
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    @click="
                      router.push({ name: 'transfer-plan-edit', params: { planId: plan.id } })
                    "
                  >
                    고치기
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    @click="removePlan(plan.id)"
                  >
                    지우기
                  </Button>
                </div>
              </div>
            </div>
          </template>

          <p
            v-if="displayError"
            class="transfer-error"
            role="alert"
          >
            {{ displayError }}
          </p>
          <p
            v-if="savedMessage"
            class="transfer-pin-saved"
            role="status"
          >
            {{ savedMessage }}
          </p>
        </div>
      </main>

      <footer class="app-actions transfer-actions">
        <Button
          v-if="isForm"
          class="w-full"
          @click="savePlan"
        >
          약속 저장
        </Button>
        <Button
          v-else
          class="w-full"
          @click="router.push({ name: 'transfer-plan-new' })"
        >
          약속 만들기
        </Button>
      </footer>
    </article>
  </div>
</template>
