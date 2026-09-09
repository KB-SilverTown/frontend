<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { profileApi } from '@/features/my-page/api/profile.js'
import { profileRows } from '@/features/my-page/services/profilePresentation.js'
import { Button } from '@/shared/components/ui/button'

const router = useRouter()
const profile = ref({})
const loading = ref(true)
const error = ref('')
const rows = computed(() => profileRows(profile.value))

async function loadProfile() {
  loading.value = true
  error.value = ''
  try {
    profile.value = (await profileApi.get()) || {}
  } catch {
    error.value = '가입 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.'
  } finally {
    loading.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell my-page-device">
      <header class="app-header">
        <Button
          aria-label="마이페이지로 돌아가기"
          class="app-back-button"
          size="icon"
          variant="secondary"
          @click="router.push({ name: 'my-page' })"
          >‹</Button
        >
        <strong class="app-brand">귀편한 금융</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>
      <main class="app-main my-page-main">
        <section class="screen-heading my-page-heading">
          <h1>가입 정보</h1>
          <p>가입할 때 등록한 정보를 확인합니다.</p>
        </section>
        <p
          v-if="loading"
          class="service-home-data-summary"
          aria-live="polite"
        >
          가입 정보를 불러오고 있어요.
        </p>
        <p
          v-else-if="error"
          class="service-home-data-error"
          role="alert"
        >
          {{ error }}
        </p>
        <dl
          v-else
          class="profile-info-list"
        >
          <div
            v-for="row in rows"
            :key="row.label"
            class="profile-info-row"
          >
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </main>
      <nav
        aria-label="주요 메뉴"
        class="app-bottom-nav four-items my-page-bottom-nav"
      >
        <RouterLink
          replace
          :to="{ name: 'transfer-home' }"
          >홈</RouterLink
        >
        <RouterLink
          replace
          :to="{ name: 'bills-home' }"
          >고지서</RouterLink
        >
        <RouterLink
          replace
          :to="{ name: 'living-home' }"
          >생활금융</RouterLink
        >
        <RouterLink
          replace
          aria-current="page"
          :to="{ name: 'my-page' }"
          >마이페이지</RouterLink
        >
      </nav>
    </article>
  </div>
</template>
