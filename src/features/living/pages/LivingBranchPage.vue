<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import LivingPageShell from '@/features/living/components/LivingPageShell.vue'
import {
  mobileBranchAddress,
  mobileBranchDistance,
  mobileBranchDocuments,
  mobileBranchId,
  mobileBranchName,
  mobileBranchSchedule,
  mobileBranchServices,
} from '@/features/living/mobile-branch/presentation.js'
import { useServiceDataStore } from '@/features/living/stores/serviceData.js'
import { getCurrentLocation } from '@/shared/native/nativeCapabilities.js'
import { goBackOrReplace } from '@/shared/lib/navigation.js'

const props = defineProps({ screenKey: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const serviceData = useServiceDataStore()
const error = ref('')
const locating = ref(false)
const isDetail = computed(() => props.screenKey === 'living-branch-detail')
const isList = computed(() => props.screenKey === 'living-branches')
const isEmpty = computed(() => props.screenKey === 'living-branches-empty')
const isError = computed(() => props.screenKey === 'living-branches-error')
const selectedBranchId = ref('')
const page = computed(() => {
  if (isDetail.value) return ['이동점포 상세', '선택한 이동점포의 위치와 일정을 확인합니다.']
  if (isEmpty.value) return ['가까운 이동점포가 없어요', '다른 시간에 다시 찾아 주세요.']
  if (isError.value) return ['이동점포를 못 찾았어요', '위치 설정을 확인한 뒤 다시 시도해 주세요.']
  return ['이동점포 목록', '현재 위치에서 가까운 이동점포를 찾습니다.']
})
const selected = computed(
  () =>
    serviceData.mobileBranches.find(
      (item) =>
        String(mobileBranchId(item)) === String(route.query.branchId || selectedBranchId.value),
    ) || null,
)
async function load() {
  if (isDetail.value) {
    if (!selected.value)
      await router.replace({ name: 'living-screen', params: { screenKey: 'living-branches' } })
    return
  }
  if (!isList.value) return
  locating.value = true
  error.value = ''
  try {
    const location = await getCurrentLocation()
    const latitude = Number(location?.coords?.latitude ?? location?.latitude)
    const longitude = Number(location?.coords?.longitude ?? location?.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('현재 위치를 확인하지 못했어요.')
    }
    await serviceData.loadMobileBranches({
      latitude,
      longitude,
    })
    if (!serviceData.mobileBranches.length)
      await router.replace({
        name: 'living-screen',
        params: { screenKey: 'living-branches-empty' },
      })
  } catch (loadError) {
    error.value = loadError?.message || '현재 위치를 확인하지 못했어요.'
    await router.replace({ name: 'living-screen', params: { screenKey: 'living-branches-error' } })
  } finally {
    locating.value = false
  }
}
function open(item) {
  router.push({
    name: 'living-screen',
    params: { screenKey: 'living-branch-detail' },
    query: { branchId: String(mobileBranchId(item)) },
  })
}
function isSelected(item) {
  return String(mobileBranchId(item)) === String(selectedBranchId.value)
}
function select(item) {
  selectedBranchId.value = String(mobileBranchId(item))
}
function primary() {
  if (isDetail.value) {
    return router.push({ name: 'living-screen', params: { screenKey: 'living-branches' } })
  }
  if (isList.value) {
    if (!selected.value) {
      error.value = '이동점포를 하나 선택해 주세요.'
      return
    }
    return open(selected.value)
  }
  return router.push({ name: 'living-screen', params: { screenKey: 'living-branches' } })
}
watch(() => [props.screenKey, route.query.branchId], load, { immediate: true })
</script>
<template>
  <LivingPageShell
    :busy="locating || serviceData.loading.mobileBranches"
    :description="page[1]"
    :primary-label="isDetail ? '목록으로' : isList ? '상세 보기' : '다시 찾기'"
    :title="page[0]"
    @back="goBackOrReplace(router, { name: 'living-home' })"
    @primary="primary"
    ><p
      v-if="error"
      class="service-route-error"
      role="alert"
    >
      {{ error }}
    </p>
    <section class="service-route-screen-content screen-content">
      <div class="content">
        <div
          v-if="isList && (locating || serviceData.loading.mobileBranches)"
          aria-live="polite"
          class="mobile-branch-state"
          role="status"
        >
          <strong>현재 위치와 주변 이동점포를 확인하고 있어요</strong>
          <p>잠시만 기다려 주세요.</p>
        </div>
        <div
          v-else-if="isEmpty"
          class="mobile-branch-state"
        >
          <strong>주변에 예정된 이동점포가 없어요</strong>
          <p>다른 시간에 다시 찾아 주세요.</p>
        </div>
        <div
          v-else-if="isError"
          class="mobile-branch-state mobile-branch-state-error"
          role="alert"
        >
          <strong>이동점포 정보를 불러오지 못했어요</strong>
          <p>{{ error || '위치 설정을 확인한 뒤 다시 시도해 주세요.' }}</p>
        </div>
        <p
          v-else-if="isDetail && !selected"
          class="mobile-branch-state"
        >
          목록에서 이동점포를 먼저 선택해 주세요.
        </p>
        <div
          v-else
          class="mobile-branch-list"
        >
          <article
            v-for="branch in isDetail ? [selected] : serviceData.mobileBranches"
            :key="mobileBranchId(branch)"
            class="mobile-branch-card"
            :class="{ 'is-selected': isSelected(branch) }"
          >
            <button
              v-if="isList"
              class="mobile-branch-select"
              :aria-label="`${mobileBranchName(branch)} ${isSelected(branch) ? '선택됨' : '선택'}`"
              :aria-pressed="isSelected(branch)"
              type="button"
              @click="select(branch)"
            >
              <span
                aria-hidden="true"
                class="mobile-branch-select-indicator"
              >
                {{ isSelected(branch) ? '✓' : '' }}
              </span>
              <span>{{ isSelected(branch) ? '선택됨' : '이동점포 선택' }}</span>
            </button>
            <div class="mobile-branch-card-body">
              <div class="mobile-branch-card-header">
                <strong>{{ mobileBranchName(branch) }}</strong>
                <span>{{ mobileBranchDistance(branch) }}</span>
              </div>
              <p class="mobile-branch-address">{{ mobileBranchAddress(branch) }}</p>
              <dl class="mobile-branch-details">
                <div>
                  <dt>방문 시간</dt>
                  <dd>{{ mobileBranchSchedule(branch) }}</dd>
                </div>
                <div>
                  <dt>가능 업무</dt>
                  <dd>
                    <ul
                      v-if="mobileBranchServices(branch).length"
                      class="mobile-branch-tags"
                    >
                      <li
                        v-for="serviceName in mobileBranchServices(branch)"
                        :key="serviceName"
                      >
                        {{ serviceName }}
                      </li>
                    </ul>
                    <span v-else>안내 없음</span>
                  </dd>
                </div>
                <div>
                  <dt>준비물</dt>
                  <dd>
                    <ul
                      v-if="mobileBranchDocuments(branch).length"
                      class="mobile-branch-tags"
                    >
                      <li
                        v-for="document in mobileBranchDocuments(branch)"
                        :key="document"
                      >
                        {{ document }}
                      </li>
                    </ul>
                    <span v-else>안내 없음</span>
                  </dd>
                </div>
              </dl>
            </div>
          </article>
        </div>
      </div>
    </section></LivingPageShell
  >
</template>
