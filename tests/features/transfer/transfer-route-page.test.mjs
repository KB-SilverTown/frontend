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
const flowPanel = readFileSync(
  new URL('../../../src/features/transfer/components/TransferFlowPanel.vue', import.meta.url),
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

test('transfer voice entry keeps the backend voice conversation in the transfer screen', () => {
  const statusPage = readFileSync(
    new URL('../../../src/features/transfer/pages/TransferStatusPage.vue', import.meta.url),
    'utf8',
  )
  const homePage = readFileSync(
    new URL('../../../src/features/transfer/pages/TransferHomePage.vue', import.meta.url),
    'utf8',
  )
  const voicePanel = readFileSync(
    new URL('../../../src/features/voice/components/VoiceConversationPanel.vue', import.meta.url),
    'utf8',
  )

  assert.match(statusPage, /VoiceConversationPanel/)
  assert.match(statusPage, /entry-point="TRANSFER"/)
  assert.match(statusPage, /RECIPIENT_CANDIDATES/)
  assert.match(statusPage, /TRANSFER_READBACK/)
  assert.match(statusPage, /TRANSFER_RISK_CHECK/)
  assert.match(homePage, /query: \{ voice: '1' \}/)
  assert.doesNotMatch(homePage, /gwipyeonhan:voice-transfer/)
  assert.match(voicePanel, /autoStart: Boolean/)
  assert.match(voicePanel, /if \(props\.autoStart\) void listen\(\)/)
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

test('transfer recipient selection searches before a candidate can be selected', () => {
  assert.match(flowPanel, /v-model="recipientKeyword"/)
  assert.match(flowPanel, /transferStore\.findRecipients\(\{ keyword \}\)/)
  assert.match(flowPanel, /@submit\.prevent="searchRecipients"/)
  assert.match(flowPanel, /@input="clearRecipientCandidates"/)
  assert.match(flowPanel, /role="alert"/)
})
test('transfer schedule keeps local plan CRUD separate from financial execution', () => {
  assert.match(schedulePage, /plans\.addPlan/)
  assert.match(schedulePage, /plans\.updatePlan/)
  assert.match(schedulePage, /plans\.removePlan/)
  assert.match(schedulePage, /transfer-listening/)
})
