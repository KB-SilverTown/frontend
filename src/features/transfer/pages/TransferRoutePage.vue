<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TransferFlowPage from '@/features/transfer/pages/TransferFlowPage.vue'
import TransferSchedulePage from '@/features/transfer/pages/TransferSchedulePage.vue'
import TransferStatusPage from '@/features/transfer/pages/TransferStatusPage.vue'

const route = useRoute()
const screenKey = computed(() => String(route.params.screenKey || ''))
const flowKeys = new Set([
  'transfer-recipient-select',
  'transfer-recipient-confirm',
  'transfer-account-select',
  'transfer-amount-confirm',
  'transfer-confirm',
  'transfer-risk-confirm',
  'transfer-pending',
  'transfer-guardian-confirm',
  'transfer-guardian-message-failed',
  'transfer-authentication-expired',
  'transfer-executing',
  'transfer-complete',
  'transfer-failed',
  'transfer-existing-plan',
  'transfer-expired',
])
const scheduleKeys = new Set([
  'transfer-scheduled-list',
  'transfer-scheduled-create',
  'transfer-scheduled-edit',
  'transfer-scheduled-due',
  'transfer-scheduled-complete',
])
</script>

<template>
  <TransferFlowPage
    v-if="flowKeys.has(screenKey)"
    :screen-key="screenKey"
  /><TransferSchedulePage
    v-else-if="scheduleKeys.has(screenKey)"
    :screen-key="screenKey"
  /><TransferStatusPage
    v-else
    :screen-key="screenKey"
  />
</template>
