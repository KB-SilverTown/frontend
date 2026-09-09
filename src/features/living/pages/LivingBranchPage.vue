<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import LivingPageShell from '@/features/living/components/LivingPageShell.vue'
import {
  mobileBranchAddress,
  mobileBranchDistance,
  mobileBranchId,
  mobileBranchName,
  mobileBranchSchedule,
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
const selected = computed(
  () =>
    serviceData.mobileBranches.find(
      (item) => String(mobileBranchId(item)) === String(route.query.branchId || ''),
    ) || null,
)
async function load() {
  if (isDetail.value) {
    if (!selected.value)
      await router.replace({ name: 'living-screen', params: { screenKey: 'living-branches' } })
    return
  }
  locating.value = true
  error.value = ''
  try {
    const location = await getCurrentLocation()
    await serviceData.loadMobileBranches({
      latitude: location.latitude,
      longitude: location.longitude,
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
watch(() => [props.screenKey, route.query.branchId], load, { immediate: true })
</script>
<template>
  <LivingPageShell
    :busy="locating || serviceData.loading.mobileBranches"
    :description="
      isDetail
        ? '선택한 이동점포의 위치와 일정을 확인합니다.'
        : '현재 위치에서 가까운 이동점포를 찾습니다.'
    "
    :primary-label="isDetail ? '목록으로' : '다시 찾기'"
    :title="isDetail ? '이동점포 상세' : '이동점포 목록'"
    @back="goBackOrReplace(router, { name: 'living-home' })"
    @primary="
      isDetail
        ? router.push({ name: 'living-screen', params: { screenKey: 'living-branches' } })
        : load()
    "
    ><p
      v-if="error"
      class="service-route-error"
      role="alert"
    >
      {{ error }}
    </p>
    <section class="service-route-screen-content screen-content">
      <div class="content">
        <template v-if="isDetail && selected"
          ><section class="hero">
            <div class="hero-icon">✓</div>
            <div>
              <strong>{{ mobileBranchName(selected) }}</strong>
              <p>{{ mobileBranchAddress(selected) }}</p>
            </div>
          </section>
          <div class="meta">
            <span>거리</span><b>{{ mobileBranchDistance(selected) }}</b>
          </div>
          <div class="meta">
            <span>일정</span><b>{{ mobileBranchSchedule(selected) }}</b>
          </div></template
        >
        <div
          v-else
          class="service-route-live-rows"
        >
          <button
            v-for="item in serviceData.mobileBranches"
            :key="mobileBranchId(item)"
            class="service-route-live-row"
            type="button"
            @click="open(item)"
          >
            <span>{{ mobileBranchName(item) }}</span
            ><b>{{ mobileBranchDistance(item) }}</b>
          </button>
        </div>
      </div>
    </section></LivingPageShell
  >
</template>
