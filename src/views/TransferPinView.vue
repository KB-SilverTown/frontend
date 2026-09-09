<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { useTransferStore } from '@/stores/transfer.js'
import '@/styles/transfer.css'

const route = useRoute()
const router = useRouter()
const transferStore = useTransferStore()

const cameFromTransfer = computed(() => route.query.from === 'transfer')

/** 송금 도중 들어왔으면 송금 화면으로, 그 밖에는 송금 홈으로 돌아간다. */
const backRoute = computed(() => {
  if (cameFromTransfer.value && transferStore.transferId) return { name: 'transfer-flow' }
  return { name: 'transfer-home' }
})

const pin = ref('')
const pinConfirm = ref('')
const saving = ref(false)
const errorMessage = ref('')
const savedMessage = ref('')

const canSubmit = computed(() => pin.value.length === 6 && pinConfirm.value.length === 6)

function onlyDigits(value) {
  return String(value ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, 6)
}

function normalizePin() {
  pin.value = onlyDigits(pin.value)
}

function normalizePinConfirm() {
  pinConfirm.value = onlyDigits(pinConfirm.value)
}

/** 입력한 비밀번호는 화면을 벗어날 때 남기지 않는다. */
function clearPins() {
  pin.value = ''
  pinConfirm.value = ''
}

async function handleSubmit() {
  if (saving.value) return

  errorMessage.value = ''
  savedMessage.value = ''

  if (!/^\d{6}$/.test(pin.value)) {
    errorMessage.value = '비밀번호를 숫자 6자리로 입력해 주세요.'
    return
  }
  if (pin.value !== pinConfirm.value) {
    errorMessage.value = '두 번 입력한 비밀번호가 서로 달라요. 다시 입력해 주세요.'
    pinConfirm.value = ''
    return
  }

  saving.value = true
  try {
    await transferStore.registerPin(pin.value)
    savedMessage.value = '거래 승인 비밀번호를 저장했어요.'
  } catch (error) {
    errorMessage.value = error.message || '비밀번호를 저장하지 못했어요. 잠시 후 다시 해주세요.'
  } finally {
    clearPins()
    saving.value = false
  }
}

function goBack() {
  clearPins()
  return router.push(backRoute.value)
}
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
          @click="goBack"
        >
          ‹
        </Button>
        <strong class="app-brand">귀편한 금융</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main transfer-main">
        <section class="screen-heading">
          <h1>거래 승인 비밀번호</h1>
          <p>송금할 때 쓰는 숫자 6자리를 정해 주세요.</p>
        </section>

        <form
          class="transfer-content"
          @submit.prevent="handleSubmit"
        >
          <div class="transfer-section">
            <label
              class="transfer-field-label"
              for="transfer-new-pin"
            >
              새 비밀번호 (숫자 6자리)
            </label>
            <input
              id="transfer-new-pin"
              v-model="pin"
              autocomplete="new-password"
              class="transfer-field transfer-pin-field"
              inputmode="numeric"
              maxlength="6"
              placeholder="숫자 6자리"
              type="password"
              @input="normalizePin"
            />
          </div>

          <div class="transfer-section">
            <label
              class="transfer-field-label"
              for="transfer-new-pin-confirm"
            >
              한 번 더 입력
            </label>
            <input
              id="transfer-new-pin-confirm"
              v-model="pinConfirm"
              autocomplete="new-password"
              class="transfer-field transfer-pin-field"
              inputmode="numeric"
              maxlength="6"
              placeholder="숫자 6자리"
              type="password"
              @input="normalizePinConfirm"
              @keyup.enter="handleSubmit"
            />
          </div>

          <p class="transfer-pin-guide">비밀번호는 기기에 남기지 않고 은행에만 보냅니다.</p>

          <p
            v-if="errorMessage"
            class="transfer-error"
            role="alert"
          >
            {{ errorMessage }}
          </p>
          <p
            v-if="savedMessage"
            class="transfer-pin-saved"
            role="status"
          >
            {{ savedMessage }}
          </p>
        </form>
      </main>

      <footer class="app-actions transfer-actions">
        <Button
          v-if="!savedMessage"
          :aria-busy="saving"
          class="w-full"
          :disabled="!canSubmit || saving"
          @click="handleSubmit"
        >
          {{ saving ? '저장 중…' : '비밀번호 저장' }}
        </Button>
        <Button
          v-else
          class="w-full"
          @click="goBack"
        >
          {{ cameFromTransfer ? '송금 계속하기' : '송금 홈으로' }}
        </Button>
      </footer>
    </article>
  </div>
</template>
