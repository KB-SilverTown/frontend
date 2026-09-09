<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import LivingBranchPage from '@/features/living/pages/LivingBranchPage.vue'
import LivingReminderPage from '@/features/living/pages/LivingReminderPage.vue'
import LivingStatusPage from '@/features/living/pages/LivingStatusPage.vue'

const route = useRoute()
const screenKey = computed(() => String(route.params.screenKey || ''))
const isReminderScreen = computed(() => screenKey.value.startsWith('living-reminder'))
const isBranchScreen = computed(
  () =>
    screenKey.value.startsWith('living-branch') || screenKey.value === 'living-location-permission',
)
</script>

<template>
  <LivingReminderPage
    v-if="isReminderScreen"
    :screen-key="screenKey"
  />
  <LivingBranchPage
    v-else-if="isBranchScreen"
    :screen-key="screenKey"
  />
  <LivingStatusPage
    v-else
    :screen-key="screenKey"
  />
</template>
