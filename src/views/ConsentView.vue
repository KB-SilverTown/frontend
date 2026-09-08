<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { profileApi } from '@/api/profile.js'
import { withAppLoading } from '@/services/appLoading.js'
import {
  buildConsentUpdate,
  presentConsents,
} from '@/services/consentPresentation.js'
import '@/styles/consents.css'

const router = useRouter()
const consents = ref(presentConsents())
const initialState = ref('')
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const notice = ref('')
let requestId = 0

const hasChanges = computed(() => JSON.stringify(consents.value) !== initialState.value)

function stateSnapshot() {
  return JSON.stringify(consents.value)
}

function clearMessages() {
  errorMessage.value = ''
  notice.value = ''
}

function setConsents(value) {
  consents.value = presentConsents(value)
  initialState.value = stateSnapshot()
}

async function loadConsents() {
  const currentRequestId = ++requestId
  loading.value = true
  clearMessages()

  try {
    await withAppLoading(async () => {
      const response = await profileApi.getConsents()
      if (currentRequestId === requestId) setConsents(response)
    })
  } catch {
    if (currentRequestId === requestId) {
      errorMessage.value = '동의 내역을 불러오지 못했어요. 다시 시도해 주세요.'
    }
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}

function toggleConsent(consent) {
  if (consent.required || loading.value || saving.value) return
  consent.agreed = !consent.agreed
  clearMessages()
}

async function saveConsents() {
  if (saving.value || loading.value || !hasChanges.value) return

  saving.value = true
  clearMessages()

  try {
    await withAppLoading(async () => {
      const response = await profileApi.updateConsents(buildConsentUpdate(consents.value))
      if (response && typeof response === 'object') {
        setConsents(response)
      } else {
        initialState.value = stateSnapshot()
      }
    })
    notice.value = '동의 설정을 저장했어요.'
  } catch {
    errorMessage.value = '동의 설정을 저장하지 못했어요. 다시 시도해 주세요.'
  } finally {
    saving.value = false
  }
}

function goBack() {
  return router.push({ name: 'my-page' })
}

onMounted(loadConsents)
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell consents-device">
      <header class="app-header">
        <Button
          aria-label="마이페이지로 돌아가기"
          class="app-back-button"
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

      <main class="app-main consents-main">
        <section class="screen-heading consents-heading">
          <h1>동의 다시 보기</h1>
          <p>동의한 항목을 확인하고 선택 항목을 바꿀 수 있어요.</p>
        </section>

        <p
          v-if="loading"
          aria-live="polite"
          class="consents-status"
          role="status"
        >
          동의 내역을 불러오고 있어요.
        </p>
        <p
          v-if="errorMessage"
          class="consents-error"
          role="alert"
        >
          {{ errorMessage }}
        </p>
        <p
          v-if="notice"
          aria-live="polite"
          class="consents-notice"
          role="status"
        >
          {{ notice }}
        </p>

        <section
          aria-label="동의 항목"
          class="consent-list"
        >
          <button
            v-for="consent in consents"
            :key="consent.type"
            :aria-pressed="consent.agreed"
            class="consent-item"
            :class="{ agreed: consent.agreed, required: consent.required }"
            :disabled="consent.required || loading || saving"
            type="button"
            @click="toggleConsent(consent)"
          >
            <span class="consent-item-copy">
              <strong>{{ consent.title }}</strong>
              <small>{{ consent.description }}</small>
              <em>{{ consent.required ? '필수' : '선택' }} · {{ consent.retention }}</em>
            </span>
            <span
              aria-hidden="true"
              class="consent-item-state"
            >
              {{ consent.agreed ? '✓' : '꺼짐' }}
            </span>
          </button>
        </section>

        <p class="consents-guide">
          <b>안내</b> 필수 항목은 기본 기능 제공을 위해 켜져 있어요. 선택 항목은 언제든 바꿀 수
          있습니다.
        </p>

        <footer class="app-actions consents-actions">
          <Button
            class="w-full"
            :disabled="loading || saving || !hasChanges"
            @click="saveConsents"
          >
            {{ saving ? '저장하고 있어요…' : '바꾼 대로 저장' }}
          </Button>
          <Button
            class="w-full"
            :disabled="saving"
            variant="secondary"
            @click="goBack"
          >
            취소
          </Button>
        </footer>
      </main>

      <nav
        aria-label="주요 메뉴"
        class="app-bottom-nav three-items consents-bottom-nav"
      >
        <RouterLink :to="{ name: 'bills-home' }">고지서</RouterLink>
        <RouterLink :to="{ name: 'living-home' }">생활금융</RouterLink>
        <RouterLink
          aria-current="page"
          :to="{ name: 'my-page' }"
        >
          마이페이지
        </RouterLink>
      </nav>
    </article>
  </div>
</template>
