<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { withAppLoading } from '@/services/appLoading.js'
import { isTransferDraftExpired, loadTransferDraft } from '@/services/transferDraft.js'
import { useTransferStore } from '@/stores/transfer.js'
import { useTransferPlanStore } from '@/stores/transferPlan.js'
import '@/styles/transfer.css'

const router = useRouter()
const transferStore = useTransferStore()
const planStore = useTransferPlanStore()

/** 오늘 보낼 약속 중 이번 달에 아직 보내지 않은 것만 알린다. */
const duePlans = computed(() =>
  planStore.duePlans.filter((plan) => !planStore.alreadySentThisMonth(plan.id)),
)

const primaryAccount = computed(() => transferStore.accounts[0] || null)
const balanceLabel = computed(() => {
  const balance = Number(primaryAccount.value?.balance)
  if (Number.isFinite(balance)) return `${balance.toLocaleString('ko-KR')}원`
  return transferStore.accountsLoading ? '잔액을 불러오는 중이에요' : '잔액을 확인할 수 없어요'
})

/**
 * 마무리하지 못한 송금이 있으면 알려준다.
 * 오래 열어둔 초안은 이어서 보내지 않고 시간이 지났음을 알린 뒤 처음부터 다시 하게 한다.
 */
async function checkUnfinishedTransfer() {
  const draft = loadTransferDraft()
  if (!draft) return

  if (isTransferDraftExpired(draft)) {
    transferStore.discardDraft()
    await router.replace({ name: 'transfer-notice', params: { noticeId: 'expired' } })
    return
  }

  const restored = await transferStore.restoreDraft()
  if (!restored) return

  await router.replace({ name: 'transfer-notice', params: { noticeId: 'resume' } })
}

function startTransfer() {
  transferStore.reset()
  return router.push({ name: 'transfer-flow' })
}

/** 음성 도움 시트를 열고 송금 흐름 화면으로 옮긴다. */
function startVoiceTransfer() {
  window.dispatchEvent(
    new CustomEvent('gwipyeonhan:voice-transfer', { detail: { entryPoint: 'TRANSFER' } }),
  )
  return router.push({ name: 'transfer-flow' })
}

onMounted(() => {
  planStore.ensureLoaded()
  withAppLoading(() => transferStore.loadAccounts({ active: true }).catch(() => {}))
  checkUnfinishedTransfer().catch(() => {})
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell">
      <header class="app-header">
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
        <strong class="app-brand">귀편한 금융</strong>
        <Button
          aria-label="음성 도움"
          class="app-header-button"
          size="icon"
          variant="secondary"
          @click="startVoiceTransfer"
        >
          <span
            aria-hidden="true"
            class="transfer-mic-icon"
          >
            <span class="transfer-mic-stem" />
          </span>
        </Button>
      </header>

      <main class="app-main transfer-main">
        <section class="screen-heading">
          <span class="transfer-kicker">송금 · 홈</span>
          <h1>송금</h1>
          <p>보낼 금액과 받는 분을 하나씩 확인하며 진행합니다.</p>
        </section>

        <div class="transfer-content">
          <Card>
            <CardContent class="transfer-balance-content">
              <h2>사용 가능 금액</h2>
              <p
                aria-live="polite"
                class="transfer-balance-amount"
              >
                {{ balanceLabel }}
              </p>
              <small v-if="primaryAccount">{{ primaryAccount.accountNumberMasked }}</small>
            </CardContent>
          </Card>

          <p
            v-if="transferStore.error"
            class="transfer-error"
            role="status"
          >
            잔액을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
          </p>

          <p
            v-if="duePlans.length"
            aria-live="polite"
            class="transfer-note"
          >
            오늘 보낼 약속이 {{ duePlans.length }}건 있어요.
          </p>

          <RouterLink
            class="transfer-pin-link"
            :to="{ name: 'transfer-plans' }"
          >
            정기 송금 약속 보기
          </RouterLink>

          <RouterLink
            class="transfer-pin-link"
            :to="{ name: 'transfer-pin' }"
          >
            거래 승인 비밀번호 정하기
          </RouterLink>
        </div>
      </main>

      <footer class="app-actions transfer-actions">
        <Button
          class="w-full"
          @click="startTransfer"
        >
          송금하기
        </Button>
        <Button
          class="w-full"
          variant="secondary"
          @click="startVoiceTransfer"
        >
          음성으로 송금
        </Button>
      </footer>

      <nav
        aria-label="서비스 메뉴"
        class="app-bottom-nav three-items"
      >
        <RouterLink :to="{ name: 'bills-home' }">고지서</RouterLink>
        <RouterLink :to="{ name: 'living-home' }">생활금융</RouterLink>
        <RouterLink :to="{ name: 'my-page' }">마이페이지</RouterLink>
      </nav>
    </article>
  </div>
</template>
