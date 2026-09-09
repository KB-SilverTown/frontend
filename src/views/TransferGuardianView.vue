<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { useTransferStore } from '@/stores/transfer.js'
import '@/styles/transfer.css'

const router = useRouter()
const transferStore = useTransferStore()

const code = ref('')
const actionError = ref('')

const verification = computed(() => transferStore.guardianVerification)
const started = computed(() => Boolean(verification.value?.verificationId))
const guardianName = computed(() => verification.value?.guardianName || '보호자')
const displayError = computed(() => actionError.value || transferStore.error?.message || '')
const canVerify = computed(() => !transferStore.busy && code.value.trim().length > 0)

/** 위험 점수가 높다는 사실이 사기라는 뜻은 아니다. 확인 절차만 안내한다. */
const riskNotice = computed(
  () =>
    verification.value?.riskReason ||
    '평소와 다른 송금이라 한 번 더 확인해요. 잘못된 송금이라는 뜻은 아니에요.',
)

function onlyDigits(value) {
  return String(value ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, 8)
}

function normalizeCode() {
  code.value = onlyDigits(code.value)
}

async function requestVerification() {
  actionError.value = ''
  try {
    await transferStore.startGuardianVerification()
  } catch (error) {
    actionError.value = error?.message || '보호자에게 인증 요청을 보내지 못했어요.'
  }
}

/** 입력한 인증번호는 확인이 끝나면 화면에 남기지 않는다. */
async function submitCode() {
  actionError.value = ''
  const entered = code.value
  try {
    const response = await transferStore.verifyGuardian(entered)
    if (!response?.verified) {
      actionError.value = '번호가 맞지 않아요. 보호자에게 온 번호를 다시 확인해 주세요.'
      return
    }
    await router.push({ name: 'transfer-flow' })
  } catch (error) {
    actionError.value = error?.message || '보호자 확인을 마치지 못했어요.'
  } finally {
    code.value = ''
  }
}

function goBackToTransfer() {
  code.value = ''
  return router.push({ name: 'transfer-flow' })
}

async function cancelTransfer() {
  actionError.value = ''
  try {
    if (transferStore.transferId) await transferStore.cancel()
  } catch (error) {
    actionError.value = error?.message || '송금을 취소하지 못했어요.'
    return
  }
  transferStore.reset()
  await router.push({ name: 'transfer-home' })
}

onMounted(() => {
  if (!started.value && transferStore.transferId) requestVerification()
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell">
      <header class="app-header">
        <Button
          aria-label="송금 화면으로 돌아가기"
          class="app-header-button"
          size="icon"
          variant="secondary"
          @click="goBackToTransfer"
        >
          ‹
        </Button>
        <strong class="app-brand">보호자 확인</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main transfer-main">
        <section class="screen-heading">
          <h1>보호자 확인이 필요해요</h1>
          <p>{{ riskNotice }}</p>
        </section>

        <div class="transfer-content">
          <p
            v-if="transferStore.guardianDeliveryFailed"
            class="transfer-note"
            role="status"
          >
            {{ guardianName }}에게 번호를 보내지 못했어요. 연락처를 확인한 뒤 다시 보내주세요.
          </p>
          <p
            v-else-if="transferStore.guardianExpired"
            class="transfer-note"
            role="status"
          >
            인증번호 유효시간이 지났어요. 새 번호를 다시 받아주세요.
          </p>
          <p
            v-else-if="started"
            class="transfer-note"
            role="status"
          >
            {{ guardianName }}에게 인증번호를 보냈어요. 받으신 번호를 아래에 적어주세요.
          </p>
          <p
            v-else
            class="transfer-note"
            role="status"
          >
            보호자에게 인증번호를 보내려면 아래 단추를 눌러주세요.
          </p>

          <div
            v-if="started && !transferStore.guardianDeliveryFailed"
            class="transfer-section"
          >
            <label
              class="transfer-field-label"
              for="guardian-code"
            >
              보호자에게 온 인증번호
            </label>
            <input
              id="guardian-code"
              v-model="code"
              autocomplete="one-time-code"
              class="transfer-field transfer-amount-field"
              inputmode="numeric"
              maxlength="8"
              placeholder="숫자만 입력"
              type="text"
              @input="normalizeCode"
              @keyup.enter="canVerify && submitCode()"
            />
          </div>

          <p
            v-if="displayError"
            class="transfer-error"
            role="alert"
          >
            {{ displayError }}
          </p>
        </div>
      </main>

      <footer class="app-actions transfer-actions">
        <Button
          v-if="started && !transferStore.guardianDeliveryFailed && !transferStore.guardianExpired"
          class="w-full"
          :disabled="!canVerify"
          @click="submitCode"
        >
          번호 확인하기
        </Button>
        <Button
          class="w-full"
          :disabled="transferStore.busy"
          :variant="started ? 'secondary' : 'default'"
          @click="requestVerification"
        >
          {{ started ? '번호 다시 받기' : '보호자에게 번호 보내기' }}
        </Button>
        <Button
          class="w-full"
          :disabled="transferStore.busy"
          variant="ghost"
          @click="cancelTransfer"
        >
          송금 그만두기
        </Button>
      </footer>
    </article>
  </div>
</template>
