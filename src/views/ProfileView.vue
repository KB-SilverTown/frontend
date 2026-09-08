<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { profileApi } from '@/api/profile.js'
import { withAppLoading } from '@/services/appLoading.js'
import {
  buildProfileUpdate,
  formatProfilePhone,
  normalizeProfile,
} from '@/services/profilePresentation.js'
import '@/styles/profile.css'

const router = useRouter()
const profile = ref(normalizeProfile())
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const validationMessage = ref('')
const notice = ref('')
let requestId = 0

const canSave = computed(
  () => Boolean(profile.value.name.trim() && profile.value.phone.replace(/\D/g, '').length >= 10),
)

function updatePhone(value) {
  profile.value.phone = formatProfilePhone(value)
  validationMessage.value = ''
  notice.value = ''
}

function clearMessages() {
  errorMessage.value = ''
  validationMessage.value = ''
  notice.value = ''
}

async function loadProfile() {
  const currentRequestId = ++requestId
  loading.value = true
  clearMessages()

  try {
    await withAppLoading(async () => {
      const response = await profileApi.get()
      if (currentRequestId === requestId) profile.value = normalizeProfile(response)
    })
  } catch {
    if (currentRequestId === requestId) {
      errorMessage.value = '가입 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
    }
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}

function validateProfile() {
  if (!profile.value.name.trim()) {
    validationMessage.value = '이름을 입력해 주세요.'
    return false
  }

  if (profile.value.phone.replace(/\D/g, '').length < 10) {
    validationMessage.value = '휴대전화 번호를 확인해 주세요.'
    return false
  }

  if (!profile.value.address.trim()) {
    validationMessage.value = '주소를 입력해 주세요.'
    return false
  }

  return true
}

async function saveProfile() {
  if (saving.value || !validateProfile()) return

  saving.value = true
  clearMessages()

  try {
    await withAppLoading(async () => {
      const response = await profileApi.update(buildProfileUpdate(profile.value))
      if (response && typeof response === 'object') profile.value = normalizeProfile(response)
    })
    notice.value = '가입 정보를 저장했어요.'
  } catch {
    errorMessage.value = '가입 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    saving.value = false
  }
}

function goBack() {
  return router.push({ name: 'my-page' })
}

onMounted(loadProfile)
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell profile-device">
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

      <main class="app-main profile-main">
        <section class="screen-heading profile-heading">
          <h1>가입 정보</h1>
          <p>이름과 연락처를 확인하고 필요한 내용을 바꿉니다.</p>
        </section>

        <p
          v-if="loading"
          aria-live="polite"
          class="profile-status"
        >
          가입 정보를 불러오고 있어요.
        </p>
        <p
          v-if="errorMessage"
          class="profile-error"
          role="alert"
        >
          {{ errorMessage }}
        </p>
        <p
          v-if="validationMessage"
          class="profile-error"
          role="alert"
        >
          {{ validationMessage }}
        </p>
        <p
          v-if="notice"
          aria-live="polite"
          class="profile-notice"
          role="status"
        >
          {{ notice }}
        </p>

        <form
          class="profile-form"
          @submit.prevent="saveProfile"
        >
          <label class="profile-field">
            <span>이름</span>
            <Input
              v-model="profile.name"
              :disabled="loading || saving"
              aria-label="이름"
              autocomplete="name"
              placeholder="이름"
              @input="clearMessages"
            />
          </label>
          <label class="profile-field">
            <span>휴대전화</span>
            <Input
              :disabled="loading || saving"
              :model-value="profile.phone"
              aria-label="휴대전화"
              autocomplete="tel"
              inputmode="tel"
              maxlength="13"
              placeholder="010-0000-0000"
              type="tel"
              @update:model-value="updatePhone"
            />
          </label>
          <label class="profile-field">
            <span>주소</span>
            <Input
              v-model="profile.address"
              :disabled="loading || saving"
              aria-label="주소"
              autocomplete="street-address"
              placeholder="기본 주소"
              @input="clearMessages"
            />
          </label>
          <label class="profile-field">
            <span>상세 주소</span>
            <Input
              v-model="profile.detailAddress"
              :disabled="loading || saving"
              aria-label="상세 주소"
              autocomplete="address-line2"
              placeholder="동·호수 등"
              @input="clearMessages"
            />
          </label>

          <footer class="app-actions profile-actions">
            <Button
              class="w-full"
              :disabled="loading || saving || !canSave"
              @click="saveProfile"
            >
              {{ saving ? '저장하고 있어요…' : '저장하기' }}
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
        </form>
      </main>

      <nav
        aria-label="주요 메뉴"
        class="app-bottom-nav three-items profile-bottom-nav"
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
