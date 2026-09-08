<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { mobileBranchesApi } from '@/api/mobileBranches.js'
import { getCurrentLocation } from '@/services/nativeCapabilities.js'
import {
  mobileBranchAddress,
  mobileBranchDistance,
  mobileBranchDistanceValue,
  mobileBranchId,
  mobileBranchItems,
  mobileBranchName,
  mobileBranchSchedule,
  mobileBranchServices,
  mobileBranchDocuments,
} from '@/services/mobileBranchPresentation.js'
import '@/styles/mobile-branch.css'

const route = useRoute()
const router = useRouter()
const branches = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const locationHint = ref('')
const selectedBranchId = ref('')
const region = ref('')
const regionError = ref('')
const lookupMode = ref('location')
const locationPermissionDenied = ref(false)
let requestId = 0

const isDetailView = computed(() => route.name === 'mobile-branch-detail')
const selectedBranch = computed(() => {
  const routeId = String(route.params.branchId ?? '').trim()
  const currentId = routeId || selectedBranchId.value
  if (!currentId) return null

  return (
    branches.value.find((branch) => String(mobileBranchId(branch) ?? '') === currentId) || null
  )
})

function locationErrorMessage(error) {
  if (error?.code === 1 || error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return '위치 권한을 허용하면 가까운 이동점포를 찾아드릴 수 있어요.'
  }

  if (globalThis.navigator?.onLine === false) {
    return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
  }

  return (
    error?.response?.data?.message ||
    error?.message ||
    '이동점포 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  )
}

function isLocationPermissionError(error) {
  return (
    error?.code === 1 ||
    error?.name === 'NotAllowedError' ||
    error?.name === 'SecurityError' ||
    String(error?.message ?? '').includes('위치 권한')
  )
}

function coordinatesFromPosition(position) {
  const latitude = Number(position?.coords?.latitude)
  const longitude = Number(position?.coords?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('현재 위치를 확인하지 못했어요. 위치 설정을 확인해 주세요.')
  }
  return { latitude, longitude }
}

function applyBranches(response, currentRequestId, hint) {
  if (currentRequestId !== requestId) return

  branches.value = mobileBranchItems(response)
    .slice()
    .sort((left, right) => mobileBranchDistanceValue(left) - mobileBranchDistanceValue(right))

  const routeId = String(route.params.branchId ?? '').trim()
  selectedBranchId.value =
    routeId || String(mobileBranchId(branches.value[0]) ?? '').trim() || ''
  locationPermissionDenied.value = false
  locationHint.value = hint
}

async function loadLocationBranches() {
  const currentRequestId = ++requestId
  lookupMode.value = 'location'
  isLoading.value = true
  errorMessage.value = ''
  locationHint.value = ''
  regionError.value = ''
  branches.value = []
  selectedBranchId.value = ''

  try {
    const position = await getCurrentLocation()
    if (currentRequestId !== requestId) return

    const params = coordinatesFromPosition(position)
    const response = await mobileBranchesApi.nearby(params)
    applyBranches(response, currentRequestId, '현재 위치에서 가까운 순서로 보여드려요.')
  } catch (error) {
    if (currentRequestId !== requestId) return
    locationPermissionDenied.value = isLocationPermissionError(error)
    if (locationPermissionDenied.value) lookupMode.value = 'region'
    errorMessage.value = locationErrorMessage(error)
  } finally {
    if (currentRequestId === requestId) isLoading.value = false
  }
}

async function loadRegionBranches() {
  const selectedRegion = region.value.trim()
  if (!selectedRegion) {
    regionError.value = '찾을 지역을 입력해 주세요.'
    return
  }

  const currentRequestId = ++requestId
  lookupMode.value = 'region'
  locationPermissionDenied.value = false
  isLoading.value = true
  errorMessage.value = ''
  locationHint.value = ''
  regionError.value = ''
  branches.value = []
  selectedBranchId.value = ''

  try {
    const response = await mobileBranchesApi.list({ region: selectedRegion })
    applyBranches(response, currentRequestId, `${selectedRegion} 기준으로 가까운 순서로 보여드려요.`)
  } catch (error) {
    if (currentRequestId !== requestId) return
    errorMessage.value = locationErrorMessage(error)
  } finally {
    if (currentRequestId === requestId) isLoading.value = false
  }
}

function retryLookup() {
  return lookupMode.value === 'region' ? loadRegionBranches() : loadLocationBranches()
}

function openBranch(branch) {
  const branchId = mobileBranchId(branch)
  if (branchId == null || String(branchId).trim() === '') return
  selectedBranchId.value = String(branchId)
  return router.push({ name: 'mobile-branch-detail', params: { branchId: String(branchId) } })
}

function backToList() {
  return router.push({ name: 'mobile-branches' })
}

function leave() {
  requestId += 1
  return router.push({ name: 'living-home' })
}

onMounted(loadLocationBranches)
onBeforeUnmount(() => {
  requestId += 1
})
</script>

<template>
  <div class="app-stage">
    <article class="mobile-app-shell mobile-branch-device">
      <header class="app-header">
        <Button
          aria-label="생활금융 화면으로 돌아가기"
          class="app-back-button"
          size="icon"
          variant="secondary"
          @click="leave"
        >
          ‹
        </Button>
        <strong class="app-brand">귀편한 금융</strong>
        <span
          aria-hidden="true"
          class="app-header-spacer"
        />
      </header>

      <main class="app-main mobile-branch-main">
        <section class="screen-heading mobile-branch-heading">
          <h1>{{ isDetailView ? '이동점포 상세' : '이동점포 찾기' }}</h1>
          <p>
            {{
              isDetailView
                ? '방문 일정과 필요한 준비물을 확인해 주세요.'
                : lookupMode === 'region'
                  ? '지역을 직접 입력해 이동점포를 찾아드려요.'
                  : '현재 위치 주변의 이동점포를 찾아드려요.'
            }}
          </p>
        </section>

        <div
          v-if="errorMessage"
          class="mobile-branch-state mobile-branch-state-error"
          role="alert"
        >
          <strong>{{ locationPermissionDenied ? '현재 위치를 확인할 수 없어요' : '이동점포 정보를 불러오지 못했어요' }}</strong>
          <p>{{ errorMessage }}</p>
          <form
            v-if="lookupMode === 'region'"
            class="mobile-branch-region-form"
            @submit.prevent="loadRegionBranches"
          >
            <label class="mobile-branch-region-field">
              <span>찾는 지역</span>
              <input
                v-model="region"
                autocomplete="address-level2"
                maxlength="80"
                placeholder="예: 서울 성동구"
                type="text"
                @input="regionError = ''"
              />
            </label>
            <p
              v-if="regionError"
              class="mobile-branch-region-error"
              role="alert"
            >
              {{ regionError }}
            </p>
            <Button
              class="w-full"
              type="submit"
            >
              이 지역에서 찾기
            </Button>
            <Button
              class="w-full"
              type="button"
              variant="secondary"
              @click="loadLocationBranches"
            >
              현재 위치로 다시 찾기
            </Button>
          </form>
          <Button
            v-else
            :disabled="isLoading"
            variant="secondary"
            @click="retryLookup"
          >
            다시 찾기
          </Button>
        </div>

        <div
          v-else-if="isLoading"
          aria-live="polite"
          class="mobile-branch-state"
          role="status"
        >
          <strong>{{ lookupMode === 'region' ? '선택한 지역을 찾고 있어요' : '주변 이동점포를 찾고 있어요' }}</strong>
          <p>{{ lookupMode === 'region' ? '해당 지역의 운영 정보를 확인하고 있습니다.' : '현재 위치와 운영 정보를 확인하고 있습니다.' }}</p>
        </div>

        <template v-else-if="isDetailView">
          <section
            v-if="selectedBranch"
            aria-label="이동점포 상세 정보"
            class="mobile-branch-detail"
          >
            <div class="mobile-branch-detail-hero">
              <h2>{{ mobileBranchName(selectedBranch) }}</h2>
              <p>{{ mobileBranchAddress(selectedBranch) }}</p>
              <p class="mobile-branch-schedule">{{ mobileBranchSchedule(selectedBranch) }}</p>
            </div>

            <section class="mobile-branch-detail-section">
              <h3>가능 업무</h3>
              <ul
                v-if="mobileBranchServices(selectedBranch).length"
                class="mobile-branch-tags"
              >
                <li
                  v-for="serviceName in mobileBranchServices(selectedBranch)"
                  :key="serviceName"
                >
                  {{ serviceName }}
                </li>
              </ul>
              <p
                v-else
                class="mobile-branch-empty-list"
              >
                안내된 가능 업무가 없어요.
              </p>
            </section>

            <section class="mobile-branch-detail-section">
              <h3>준비물</h3>
              <ul
                v-if="mobileBranchDocuments(selectedBranch).length"
                class="mobile-branch-tags"
              >
                <li
                  v-for="document in mobileBranchDocuments(selectedBranch)"
                  :key="document"
                >
                  {{ document }}
                </li>
              </ul>
              <p
                v-else
                class="mobile-branch-empty-list"
              >
                안내된 준비물이 없어요.
              </p>
            </section>
          </section>

          <div
            v-else
            class="mobile-branch-state"
          >
            <strong>선택한 이동점포를 찾을 수 없어요</strong>
            <p>목록으로 돌아가 다른 이동점포를 선택해 주세요.</p>
            <Button
              variant="secondary"
              @click="backToList"
            >
              목록으로
            </Button>
          </div>
        </template>

        <template v-else>
          <p
            v-if="locationHint"
            class="mobile-branch-hint"
          >
            {{ locationHint }}
          </p>
          <div
            v-if="branches.length"
            class="mobile-branch-list"
          >
            <article
              v-for="branch in branches"
              :key="mobileBranchId(branch) ?? mobileBranchName(branch)"
              class="mobile-branch-card"
            >
              <button
                class="mobile-branch-card-button"
                type="button"
                @click="openBranch(branch)"
              >
                <span class="mobile-branch-card-header">
                  <strong>{{ mobileBranchName(branch) }}</strong>
                  <span class="mobile-branch-distance">{{ mobileBranchDistance(branch) }}</span>
                </span>
                <span class="mobile-branch-address">{{ mobileBranchAddress(branch) }}</span>
                <span class="mobile-branch-schedule">{{ mobileBranchSchedule(branch) }}</span>
                <span class="mobile-branch-card-cta">
                  상세 정보 보기
                  <b aria-hidden="true">›</b>
                </span>
              </button>
            </article>
          </div>
          <div
            v-else
            class="mobile-branch-state"
          >
            <strong>주변에 예정된 이동점포가 없어요</strong>
            <p>{{ lookupMode === 'region' ? '다른 지역을 입력하거나 잠시 후 다시 찾아보세요.' : '다른 시간에 다시 찾아보면 새로운 일정이 보일 수 있어요.' }}</p>
            <Button
              variant="secondary"
              @click="retryLookup"
            >
              다시 찾기
            </Button>
          </div>
        </template>
      </main>

      <footer
        v-if="isDetailView && !isLoading"
        class="app-actions mobile-branch-actions"
      >
        <Button
          class="w-full"
          variant="secondary"
          @click="backToList"
        >
          목록으로
        </Button>
      </footer>
    </article>
  </div>
</template>
