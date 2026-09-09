<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import BillCapturePage from '@/features/bills/pages/BillCapturePage.vue'
import BillPaymentPage from '@/features/bills/pages/BillPaymentPage.vue'
import BillStatusPage from '@/features/bills/pages/BillStatusPage.vue'

const route = useRoute()
const screenKey = computed(() => String(route.params.screenKey || ''))
const isCaptureScreen = computed(() =>
  ['bill-source-select', 'bill-camera'].includes(screenKey.value),
)
const isPaymentScreen = computed(() =>
  [
    'bill-review',
    'bill-low-confidence',
    'bill-confirm',
    'bill-paying',
    'bill-complete',
    'bill-duplicate-request',
    'bill-read-aloud',
  ].includes(screenKey.value),
)
</script>

<template>
  <BillCapturePage
    v-if="isCaptureScreen"
    :screen-key="screenKey"
  />
  <BillPaymentPage
    v-else-if="isPaymentScreen"
    :screen-key="screenKey"
  />
  <BillStatusPage
    v-else
    :screen-key="screenKey"
  />
</template>
