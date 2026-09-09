<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { useTransferStore } from '@/stores/transfer.js'
import '@/styles/transfer.css'

/**
 * 송금을 끝내지 못했을 때 보여주는 안내 화면들이다.
 * resume은 이어서 보낼지 물어보고, expired와 cancelled는 알리기만 한다.
 */
const NOTICES = {
  resume: {
    title: '하시던 송금이 있어요',
    description: '마무리하지 못한 송금이 남아 있어요. 이어서 보내시겠어요?',
    primaryLabel: '이어서 보내기',
    secondaryLabel: '그만두기',
  },
  expired: {
    title: '시간이 지났어요',
    description: '송금을 시작한 지 오래되어 처음부터 다시 해주셔야 해요.',
    primaryLabel: '처음부터 다시 하기',
    secondaryLabel: '',
  },
  cancelled: {
    title: '송금을 그만뒀어요',
    description: '돈은 빠져나가지 않았어요. 잔액은 그대로예요.',
    primaryLabel: '송금 홈으로',
    secondaryLabel: '',
  },
}

const route = useRoute()
const router = useRouter()
const transferStore = useTransferStore()

const actionError = ref('')

const noticeId = computed(() => String(route.params.noticeId ?? ''))
const notice = computed(() => NOTICES[noticeId.value] ?? NOTICES.cancelled)

const balanceLabel = computed(() => {
  const balance = Number(transferStore.accounts[0]?.balance)
  return Number.isFinite(balance) ? `${balance.toLocaleString('ko-KR')}원` : ''
})

const amountLabel = computed(() => {
  const amount = Number(transferStore.amount)
  return Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : ''
})

async function handlePrimary() {
  actionError.value = ''

  if (noticeId.value === 'resume') {
    await router.push({ name: 'transfer-flow' })
    return
  }

  transferStore.reset()
  await router.push({ name: 'transfer-home' })
}

/** 이어하지 않기로 하면 남은 초안과 서버 거래를 함께 정리한다. */
async function handleSecondary() {
  actionError.value = ''
  try {
    if (transferStore.transferId) await transferStore.cancel()
  } catch (error) {
    actionError.value = error?.message || '송금을 정리하지 못했어요.'
    return
  }
  transferStore.reset()
  await router.push({ name: 'transfer-home' })
}
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell">
      <header class="app-header">
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
        <strong class="app-brand">송금</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main transfer-main">
        <section class="screen-heading">
          <h1>{{ notice.title }}</h1>
          <p>{{ notice.description }}</p>
        </section>

        <div class="transfer-content">
          <div
            v-if="noticeId === 'resume' && amountLabel"
            class="transfer-summary"
          >
            <div class="transfer-summary-row">
              <span>받는 분</span>
              <b>{{ transferStore.recipientName || '확인 중' }}</b>
            </div>
            <div class="transfer-summary-row transfer-summary-amount">
              <span>보내려던 금액</span>
              <b>{{ amountLabel }}</b>
            </div>
          </div>

          <p
            v-if="noticeId === 'cancelled' && balanceLabel"
            aria-live="polite"
            class="transfer-note"
          >
            지금 잔액은 {{ balanceLabel }}이에요.
          </p>

          <p
            v-if="actionError"
            class="transfer-error"
            role="alert"
          >
            {{ actionError }}
          </p>
        </div>
      </main>

      <footer class="app-actions transfer-actions">
        <Button
          class="w-full"
          :disabled="transferStore.busy"
          @click="handlePrimary"
        >
          {{ notice.primaryLabel }}
        </Button>
        <Button
          v-if="notice.secondaryLabel"
          class="w-full"
          :disabled="transferStore.busy"
          variant="secondary"
          @click="handleSecondary"
        >
          {{ notice.secondaryLabel }}
        </Button>
      </footer>
    </article>
  </div>
</template>
