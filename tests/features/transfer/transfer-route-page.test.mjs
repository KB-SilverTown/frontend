import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { transferRoutes } from '../../../src/features/transfer/routes.js'

const route = transferRoutes.find(({ name }) => name === 'transfer-screen')
const routePage = readFileSync(
  new URL('../../../src/features/transfer/pages/TransferRoutePage.vue', import.meta.url),
  'utf8',
)
const flowPage = readFileSync(
  new URL('../../../src/features/transfer/pages/TransferFlowPage.vue', import.meta.url),
  'utf8',
)
const schedulePage = readFileSync(
  new URL('../../../src/features/transfer/pages/TransferSchedulePage.vue', import.meta.url),
  'utf8',
)
const statusPage = readFileSync(
  new URL('../../../src/features/transfer/pages/TransferStatusPage.vue', import.meta.url),
  'utf8',
)

const transferShell = readFileSync(
  new URL('../../../src/features/transfer/components/TransferPageShell.vue', import.meta.url),
  'utf8',
)
test('transfer routes canonicalize every design id and reject unknown screens', () => {
  for (let number = 2; number <= 31; number += 1) {
    const target = route?.beforeEnter?.({
      params: { screenKey: `2-${String(number).padStart(2, '0')}` },
    })
    assert.notDeepEqual(target, { name: 'transfer-home' })
  }
  assert.deepEqual(route?.beforeEnter?.({ params: { screenKey: 'missing' } }), {
    name: 'transfer-home',
  })
})

test('transfer route page delegates flow, schedule, and status without the legacy screen', () => {
  assert.match(routePage, /TransferFlowPage/)
  assert.match(routePage, /TransferSchedulePage/)
  assert.match(routePage, /TransferStatusPage/)
  assert.doesNotMatch(routePage, /service-screen|v-html|contentHtml/)
})

test('transfer listening renders the transfer voice panel with keyboard fallback', () => {
  assert.match(statusPage, /VoiceConversationPanel/)
  assert.match(statusPage, /entry-point="TRANSFER"/)
  assert.match(statusPage, /isListeningScreen \? '' : state\[2\]/)
  assert.match(statusPage, /if \(isListeningScreen\.value\) return/)
})

test('transfer flow keeps explicit confirmation, risk, authentication, and execution gates', () => {
  assert.match(flowPage, /transfer\.selectedRecipient/)
  assert.match(flowPage, /transfer\.validateAmount/)
  assert.match(flowPage, /transfer\.prepare/)
  assert.match(flowPage, /transfer\.assessRisk/)
  assert.match(flowPage, /transfer\.confirm/)
  assert.match(flowPage, /transfer\.authenticate/)
  assert.match(flowPage, /transfer\.execute/)
  assert.match(flowPage, /transfer\.startGuardianVerification/)
})

test('transfer schedule keeps local plan CRUD separate from financial execution', () => {
  assert.match(schedulePage, /plans\.addPlan/)
  assert.match(schedulePage, /plans\.updatePlan/)
  assert.match(schedulePage, /plans\.removePlan/)
  assert.match(schedulePage, /transfer-listening/)
})

test('transfer keeps action buttons in the body and returns home from every back button', () => {
  assert.match(
    transferShell,
    /<main class="app-main">[\s\S]*<footer[\s\S]*class="app-actions service-route-actions"[\s\S]*<\/footer>\s*<\/main>/,
  )
  assert.match(transferShell, /service-route-back/)
  assert.match(transferShell, /service-route-bottom-nav/)

  for (const page of [flowPage, schedulePage, statusPage]) {
    assert.match(page, /@back="router\.push\(\{ name: 'transfer-home' \}\)"/)
    assert.doesNotMatch(page, /goBackOrReplace/)
  }
})

test('transfer clears draft values only when it leaves the transfer flow', () => {
  for (const page of [flowPage, statusPage]) {
    assert.match(page, /onBeforeRouteLeave/)
    assert.match(page, /if \(to\.name !== 'transfer-screen'\) \{\s*transfer\.reset\(\)/)
  }
})
