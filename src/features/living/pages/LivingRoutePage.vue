<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import LivingBranchPage from '@/features/living/pages/LivingBranchPage.vue'
import LivingReminderPage from '@/features/living/pages/LivingReminderPage.vue'
import LivingAccountPage from '@/features/living/pages/LivingAccountPage.vue'
import LivingStatusPage from '@/features/living/pages/LivingStatusPage.vue'

const route = useRoute()
const screenKey = computed(() => String(route.params.screenKey || ''))
const isAccountScreen = computed(() =>
  ['living-accounts', 'living-accounts-empty', 'living-accounts-error'].includes(screenKey.value),
)
const isReminderScreen = computed(() =>
  [
    'living-reminders',
    'living-reminder-create',
    'living-reminder-edit',
    'living-reminders-empty',
    'living-reminders-error',
  ].includes(screenKey.value),
)
const isBranchScreen = computed(
  () =>
    screenKey.value.startsWith('living-branch') || screenKey.value === 'living-location-permission',
)
</script>

<template>
  <LivingAccountPage v-if="isAccountScreen" />
  <LivingReminderPage
    v-else-if="isReminderScreen"
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
