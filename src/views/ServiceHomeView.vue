<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { billsApi } from '@/api/bills.js'
import { withAppLoading } from '@/services/appLoading.js'
import {
  presentBill,
  presentBillSummary,
  responseItems,
} from '@/services/billPresentation.js'
import '@/styles/service.css'

const route = useRoute()
const router = useRouter()
const billItems = ref([])
const monthlySummary = ref(null)
const billLoading = ref(false)
const billListError = ref('')
const billSummaryError = ref('')
let billRequestId = 0

const serviceScreens = {
  bills: {
    title: '고지서 목록',
    description: '등록된 고지서 상태와 납부기한을 봅니다.',
    groups: [],
    primaryLabel: '고지서 등록',
  },
  living: {
    title: '내 정보',
    description: '계좌·알림·이동점포로 이동합니다.',
    groups: [
      [
        { label: '내 계좌', selected: true },
        { label: '납부 알림', to: { name: 'reminders' } },
      ],
      [
        {
          label: '이동점포 정보',
          selected: true,
          to: { name: 'mobile-branches' },
        },
        { label: '가입 정보' },
      ],
    ],
    primaryLabel: '',
  },
}

const service = computed(() => (route.name === 'living-home' ? 'living' : 'bills'))
const screen = computed(() => serviceScreens[service.value])
const visibleBills = computed(() => billItems.value.slice(0, 4).map(presentBill))
const billSummary = computed(() =>
  presentBillSummary(monthlySummary.value, billItems.value.length),
)
const billSummaryText = computed(() => {
  if (monthlySummary.value && (billSummary.value.hasCount || billSummary.value.hasAmount)) {
    return `${billSummary.value.count}건, 이번 달 ${billSummary.value.amount}입니다.`
  }
  if (billItems.value.length) return `등록된 고지서 ${billItems.value.length}건을 불러왔어요.`
  return ''
})

async function loadBillData() {
  const requestId = ++billRequestId
  billLoading.value = true
  billItems.value = []
  monthlySummary.value = null
  billListError.value = ''
  billSummaryError.value = ''

  try {
    await withAppLoading(async () => {
      await Promise.all([
        billsApi
          .list()
          .then((value) => {
            if (requestId === billRequestId) billItems.value = responseItems(value)
          })
          .catch(() => {
            if (requestId === billRequestId) {
              billListError.value = '고지서 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
            }
          }),
        billsApi
          .monthlySummary()
          .then((value) => {
            if (requestId === billRequestId) monthlySummary.value = value
          })
          .catch(() => {
            if (requestId === billRequestId) {
              billSummaryError.value = '이번 달 합계를 불러오지 못했어요.'
            }
          }),
      ])
    })
  } finally {
    if (requestId === billRequestId) billLoading.value = false
  }
}

function invalidateBillRequest() {
  billRequestId += 1
  billLoading.value = false
}

function startVoiceAssist() {
  window.dispatchEvent(new CustomEvent('gwipyeonhan:voice-transfer'))
}

function openBillCamera() {
  return router.push({ name: 'bills-camera' })
}

onMounted(() => {
  if (service.value === 'bills') loadBillData()
})

watch(service, (nextService) => {
  if (nextService === 'bills') {
    loadBillData()
  } else {
    invalidateBillRequest()
  }
})

onBeforeUnmount(invalidateBillRequest)
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell service-home-device">
      <header class="app-header">
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
        <strong class="app-brand">귀편한 금융</strong>
        <Button
          aria-label="음성 도움"
          class="app-header-button service-mic-button"
          size="icon"
          variant="secondary"
          @click="startVoiceAssist"
        >
          <span
            aria-hidden="true"
            class="service-mic-icon"
          >
            <span class="service-mic-stem" />
          </span>
        </Button>
      </header>

      <main class="app-main service-home-main">
        <section class="screen-heading service-home-heading">
          <span class="service-home-kicker">{{
            service === 'bills' ? '고지서 · 홈' : '생활금융 · 홈'
          }}</span>
          <h1>{{ screen.title }}</h1>
          <p>{{ screen.description }}</p>
        </section>

        <div class="service-home-content">
          <Card class="service-list-card">
            <CardContent class="service-list-content">
              <template v-if="service === 'bills'">
                <p
                  v-if="billLoading"
                  aria-live="polite"
                  class="service-home-data-summary"
                >
                  고지서 정보를 불러오고 있어요.
                </p>
                <p
                  v-else-if="billListError"
                  class="service-home-data-error"
                  role="alert"
                >
                  {{ billListError }}
                </p>
                <p
                  v-else-if="!visibleBills.length"
                  class="service-home-data-summary"
                >
                  등록된 고지서가 없어요. 아래에서 고지서를 등록해 주세요.
                </p>
                <div
                  v-else
                  aria-label="등록된 고지서"
                  class="service-bill-list"
                >
                  <article
                    v-for="bill in visibleBills"
                    :key="bill.key"
                    class="service-bill-row"
                  >
                    <div class="service-bill-copy">
                      <strong>{{ bill.payee }}</strong>
                      <small>납부기한 {{ bill.dueDate }}</small>
                    </div>
                    <div class="service-bill-meta">
                      <b>{{ bill.amount }}</b>
                      <span>{{ bill.status }}</span>
                    </div>
                  </article>
                </div>
              </template>

              <div
                v-else
                v-for="(group, groupIndex) in screen.groups"
                :key="groupIndex"
                class="service-choice-grid"
              >
                <template
                  v-for="choice in group"
                  :key="choice.label"
                >
                  <RouterLink
                    v-if="choice.to"
                    class="service-choice service-choice-link"
                    :class="{ selected: choice.selected }"
                    :to="choice.to"
                  >
                    <span>{{ choice.label }}</span>
                    <b v-if="choice.selected">✓</b>
                  </RouterLink>
                  <div
                    v-else
                    class="service-choice"
                    :class="{ selected: choice.selected }"
                  >
                    <span>{{ choice.label }}</span>
                    <b v-if="choice.selected">✓</b>
                  </div>
                </template>
              </div>
            </CardContent>
          </Card>

          <p
            v-if="service === 'bills' && billSummaryText"
            aria-live="polite"
            class="service-home-data-summary"
          >
            {{ billSummaryText }}
          </p>
          <p
            v-if="service === 'bills' && billSummaryError"
            class="service-home-data-error"
            role="status"
          >
            {{ billSummaryError }}
          </p>
        </div>
      </main>

      <footer
        v-if="screen.primaryLabel"
        class="app-actions service-home-actions"
      >
        <Button
          class="w-full"
          @click="openBillCamera"
        >
          {{ screen.primaryLabel }}
        </Button>
      </footer>

      <nav
        aria-label="서비스 메뉴"
        class="app-bottom-nav three-items service-bottom-nav"
      >
        <RouterLink
          :aria-current="route.name === 'bills-home' ? 'page' : undefined"
          :to="{ name: 'bills-home' }"
        >
          고지서
        </RouterLink>
        <RouterLink
          :aria-current="route.name === 'living-home' ? 'page' : undefined"
          :to="{ name: 'living-home' }"
        >
          생활금융
        </RouterLink>
        <RouterLink
          :aria-current="route.name === 'my-page' ? 'page' : undefined"
          :to="{ name: 'my-page' }"
        >
          마이페이지
        </RouterLink>
      </nav>
    </article>
  </div>
</template>

<style>
.service-choice-link {
  text-decoration: none;
}

.service-bill-list {
  display: grid;
  gap: 10px;
}

.service-bill-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 74px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
}

.service-bill-copy,
.service-bill-meta {
  display: grid;
  gap: 5px;
}

.service-bill-copy {
  min-width: 0;
}

.service-bill-copy strong {
  overflow: hidden;
  font-size: var(--font-size-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-bill-copy small {
  color: var(--muted-foreground);
  font-size: var(--font-size-body);
}

.service-bill-meta {
  flex: 0 0 auto;
  justify-items: end;
  text-align: right;
}

.service-bill-meta b {
  font-size: var(--font-size-body);
}

.service-bill-meta span {
  color: var(--muted-foreground);
  font-size: var(--font-size-body);
  font-weight: 700;
}
</style>
