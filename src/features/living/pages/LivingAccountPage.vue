<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import LivingPageShell from '@/features/living/components/LivingPageShell.vue'
import { useServiceDataStore } from '@/features/living/stores/serviceData.js'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const router = useRouter()
const serviceData = useServiceDataStore()
const accounts = computed(() => serviceData.accounts ?? [])

function formatAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `${amount.toLocaleString('ko-KR')}원` : '잔액 확인 중'
}

function accountLabel(account) {
  const name = account?.accountName || account?.accountType || '내 계좌'
  const number = account?.accountNumberMasked || ''
  return number ? `${name} · ${number}` : name
}

function loadAccounts() {
  return serviceData.loadAccounts({ active: true }).catch(() => {})
}

onMounted(loadAccounts)
</script>

<template>
  <LivingPageShell
    :busy="serviceData.loading.accounts"
    description="연결된 계좌와 잔액을 확인합니다."
    primary-label="다시 불러오기"
    title="내 계좌"
    @back="goBackOrReplace(router, { name: 'living-home' })"
    @primary="loadAccounts"
  >
    <section class="service-route-screen-content screen-content">
      <div class="content">
        <p
          v-if="serviceData.loading.accounts"
          class="service-route-live-empty"
          aria-live="polite"
        >
          계좌를 불러오고 있어요.
        </p>
        <p
          v-else-if="serviceData.errors.accounts"
          class="service-route-live-error"
          role="alert"
        >
          계좌를 불러오지 못했어요. 다시 불러와 주세요.
        </p>
        <p
          v-else-if="!accounts.length"
          class="service-route-live-empty"
        >
          연결된 계좌가 없어요.
        </p>
        <template v-else>
          <template
            v-for="account in accounts"
            :key="account.accountId ?? account.id"
          >
            <section class="hero">
              <div class="hero-icon">✓</div>
              <div>
                <strong>{{ accountLabel(account) }}</strong>
                <p>잔액 {{ formatAmount(account.balance) }}</p>
              </div>
            </section>
            <div class="meta">
              <span>사용 가능</span>
              <strong>{{ formatAmount(account.availableBalance ?? account.balance) }}</strong>
            </div>
          </template>
        </template>
      </div>
    </section>
  </LivingPageShell>
</template>
