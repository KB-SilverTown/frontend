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
const transferVoicePanel = readFileSync(
  new URL('../../../src/features/transfer/components/TransferVoicePanel.vue', import.meta.url),
  'utf8',
)
const transferStyles = readFileSync(
  new URL('../../../src/features/transfer/styles/transfer.css', import.meta.url),
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

test('transfer listening renders response cards and routes their actions through the voice session', () => {
  assert.match(statusPage, /TransferVoicePanel/)
  assert.match(transferVoicePanel, /transfer-voice-stage/)
  assert.match(transferVoicePanel, /transfer-voice-wave/)
  assert.match(transferVoicePanel, /transfer-voice-keyboard/)
  assert.match(transferVoicePanel, /onMounted\(\(\) => \{\s*void listen\(\)/)
  assert.match(transferVoicePanel, /voiceStore\.selectableCard/)
  assert.match(transferVoicePanel, /voiceStore\.acceptCardSelection/)
  assert.match(transferVoicePanel, /voiceStore\.rejectCardSelection/)
  assert.match(transferVoicePanel, /voiceStore\.cancelCardFlow/)
  assert.match(transferVoicePanel, /RECIPIENT_CANDIDATES|candidateHeading/)
  assert.match(transferStyles, /\.transfer-voice-card-option/)
  assert.match(transferStyles, /\.transfer-voice-card-actions/)
  assert.match(statusPage, /isListeningScreen \? '' : state\[2\]/)
  assert.match(statusPage, /if \(isListeningScreen\.value\) return/)
})

test('mock listening visibly recognizes a sentence and stages the short confirmation flow', () => {
  assert.match(transferVoicePanel, /playMockTransferRecognition/)
  assert.match(transferVoicePanel, /prepareMockTransferDraft/)
  assert.match(transferVoicePanel, /이 문장이 맞아요/)
  assert.match(transferVoicePanel, /transfer-amount-confirm/)
  assert.match(flowPage, /transfer\.authenticate\([\s\S]*transfer\.execute\(\)/)
  assert.match(
    flowPage,
    /result\?\.status === 'SUCCESS' \? 'transfer-complete' : 'transfer-failed'/,
  )
  assert.match(flowPage, /시연용 PIN은 123456입니다/)
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
