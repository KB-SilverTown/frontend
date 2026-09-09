<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BillsPageShell from '@/features/bills/components/BillsPageShell.vue'
import { useBillStore } from '@/features/bills/stores/bill.js'
import { useVoiceStore } from '@/features/voice/stores/voice.js'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({ screenKey: { type: String, required: true } })

const route = useRoute()
const router = useRouter()
const billStore = useBillStore()
const voiceStore = useVoiceStore()
const error = ref('')
const executing = ref(false)

const screen = computed(() => {
  const screens = {
    'bill-review': ['인식 결과 확인', '추출된 필드를 납부 전에 검토합니다.', '내용 확인', ''],
    'bill-low-confidence': [
      '낮은 신뢰도 수정',
      '확실하지 않은 필드만 직접 수정합니다.',
      '수정 완료',
      '',
    ],
    'bill-confirm': ['납부 최종 확인', '출금 계좌와 납부 내용을 확인합니다.', '납부하기', ''],
    'bill-paying': ['납부하는 중', '지금 납부를 처리하고 있습니다.', '', ''],
    'bill-complete': ['납부 완료', '결제 식별자와 상태만 제공합니다.', '확인', ''],
    'bill-duplicate-request': [
      '중복 요청 처리',
      '같은 납부 요청은 최초 결과를 재사용합니다.',
      '결과 확인',
      '',
    ],
    'bill-read-aloud': [
      '읽어드릴게요',
      '고지서 내용을 소리로 확인합니다.',
      '다시 듣기',
      '음성 끄기',
    ],
  }
  const [title, description, primaryLabel, secondaryLabel] =
    screens[props.screenKey] || screens['bill-review']
  return { title, description, primaryLabel, secondaryLabel }
})

const busy = computed(() => executing.value || billStore.busy)
const billRows = computed(() => {
  const bill = billStore.bill
  if (!bill) return []
  return [
    { label: '납부처', value: bill.payee || '확인 중' },
    { label: '금액', value: formatCurrency(bill.amount) },
    { label: '납부 기한', value: formatDate(bill.dueDate) },
  ]
})
const spokenText = computed(() =>
  billRows.value.map((row) => `${row.label} ${row.value}`).join(', '),
)
const resultRows = computed(() => {
  const result = billStore.result
  if (!result) return []
  return [
    {
      label: '상태',
      value:
        result.status === 'SUCCESS' || result.status === 'PAID'
          ? '완료'
          : result.status || '확인 중',
    },
    { label: '납부 금액', value: formatCurrency(result.amount ?? billStore.bill?.amount) },
    { label: '결제 번호', value: result.paymentId || '확인 중' },
    { label: '처리 시각', value: formatDate(result.paidAt) },
  ]
})

function formatCurrency(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : '금액 확인 중'
}

function formatDate(value) {
  if (!value) return '확인 중'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ko-KR')
}

async function loadContext() {
  error.value = ''
  const billId = String(route.query.billId || '').trim()
  if (billId && billStore.billId !== billId) {
    try {
      await billStore.load(billId)
    } catch (loadError) {
      error.value = loadError?.message || '고지서를 불러오지 못했어요. 다시 시도해 주세요.'
    }
  }

  if (props.screenKey === 'bill-complete' && billStore.result?.status !== 'SUCCESS') {
    await router.replace({ name: 'bills-home' })
  }
}

async function confirmBill() {
  if (!billStore.billId || !billStore.bill) {
    error.value = '고지서를 먼저 촬영하거나 목록에서 선택해 주세요.'
    return
  }

  try {
    const response = await billStore.confirm({
      approved: true,
      confirmedPayee: billStore.bill.payee,
      confirmedAmount: billStore.bill.amount,
      confirmedDueDate: billStore.bill.dueDate,
    })
    if (
      response?.status !== 'CONFIRMED' ||
      response?.executable !== true ||
      !response?.confirmationToken
    ) {
      if (props.screenKey !== 'bill-low-confidence') {
        await router.push({ name: 'bills-screen', params: { screenKey: 'bill-low-confidence' } })
      } else {
        error.value = '입력한 고지서 정보를 다시 확인해 주세요.'
      }
      return
    }
    await router.push({ name: 'bills-screen', params: { screenKey: 'bill-confirm' } })
  } catch (confirmError) {
    error.value = confirmError?.message || '고지서 정보를 확인하지 못했어요. 다시 시도해 주세요.'
  }
}

async function runPayment() {
  if (!billStore.billId || busy.value) return
  if (billStore.alreadyPaid) {
    await router.replace({ name: 'bills-screen', params: { screenKey: 'bill-duplicate-request' } })
    return
  }
  if (
    billStore.bill?.status !== 'CONFIRMED' ||
    billStore.bill?.executable !== true ||
    !String(billStore.confirmationToken || '').trim()
  ) {
    await router.replace({ name: 'bills-screen', params: { screenKey: 'bill-low-confidence' } })
    return
  }

  executing.value = true
  try {
    const response = await billStore.execute()
    await router.replace({
      name: 'bills-screen',
      params: {
        screenKey: response?.status === 'SUCCESS' ? 'bill-complete' : 'bill-payment-failed',
      },
    })
  } catch (paymentError) {
    error.value = paymentError?.message || '납부하지 못했어요. 다시 시도해 주세요.'
    await router.replace({ name: 'bills-screen', params: { screenKey: 'bill-payment-failed' } })
  } finally {
    executing.value = false
  }
}

async function speakBill() {
  if (!spokenText.value) {
    error.value = '읽어드릴 고지서 정보가 없어요.'
    return
  }
  await voiceStore.speakText(spokenText.value).catch((speakError) => {
    error.value = speakError?.message || '음성으로 읽어드리지 못했어요.'
  })
}

async function primary() {
  error.value = ''
  if (['bill-review', 'bill-low-confidence'].includes(props.screenKey)) return confirmBill()
  if (props.screenKey === 'bill-confirm') {
    if (billStore.alreadyPaid) {
      return router.push({ name: 'bills-screen', params: { screenKey: 'bill-duplicate-request' } })
    }
    return router.push({ name: 'bills-screen', params: { screenKey: 'bill-paying' } })
  }
  if (props.screenKey === 'bill-read-aloud') return speakBill()
  return router.push({ name: 'bills-home' })
}

function secondary() {
  if (props.screenKey === 'bill-read-aloud') voiceStore.silence()
}

function back() {
  if (props.screenKey === 'bill-read-aloud') voiceStore.silence()
  goBackOrReplace(router, { name: 'bills-home' })
}

watch(
  () => [props.screenKey, route.query.billId],
  async () => {
    await loadContext()
    if (props.screenKey === 'bill-paying') await runPayment()
    if (props.screenKey === 'bill-read-aloud') await speakBill()
  },
  { immediate: true },
)
</script>

<template>
  <BillsPageShell
    :busy="busy"
    :description="screen.description"
    :primary-label="screen.primaryLabel"
    :secondary-label="screen.secondaryLabel"
    :title="screen.title"
    @back="back"
    @primary="primary"
    @secondary="secondary"
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
        <section
          v-if="screenKey === 'bill-complete'"
          class="hero"
        >
          <div class="hero-icon">✓</div>
          <div>
            <strong>납부가 완료됐어요</strong>
            <p>서버에서 처리한 실제 결과를 보여드려요.</p>
          </div>
        </section>
        <section
          v-else-if="screenKey === 'bill-paying'"
          class="hero"
        >
          <div class="hero-icon">✓</div>
          <div>
            <strong>은행에 보내고 있어요</strong>
            <p>잠시만 기다려 주세요.</p>
          </div>
        </section>
        <section
          v-else-if="screenKey === 'bill-duplicate-request'"
          class="hero"
        >
          <div class="hero-icon">✓</div>
          <div>
            <strong>이미 처리된 요청이에요</strong>
            <p>돈이 두 번 빠져나가지 않았어요.</p>
          </div>
        </section>
        <section
          v-else-if="screenKey === 'bill-read-aloud'"
          class="hero"
        >
          <div class="hero-icon">✓</div>
          <div>
            <strong>고지서 내용을 읽고 있어요</strong>
            <p>{{ spokenText || '고지서 정보를 확인하고 있어요.' }}</p>
          </div>
        </section>
        <div class="service-route-live-rows">
          <div
            v-for="row in screenKey === 'bill-complete' || screenKey === 'bill-duplicate-request'
              ? resultRows
              : billRows"
            :key="row.label"
            class="service-route-live-row"
          >
            <span>{{ row.label }}</span
            ><b>{{ row.value }}</b>
          </div>
        </div>
      </div>
    </section>
  </BillsPageShell>
</template>
