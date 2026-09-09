import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { billsRoutes } from '../../../src/features/bills/routes.js'

const route = billsRoutes.find(({ name }) => name === 'bills-screen')
const routePageSource = readFileSync(
  new URL('../../../src/features/bills/pages/BillsRoutePage.vue', import.meta.url),
  'utf8',
)
const capturePageSource = readFileSync(
  new URL('../../../src/features/bills/pages/BillCapturePage.vue', import.meta.url),
  'utf8',
)
const paymentPageSource = readFileSync(
  new URL('../../../src/features/bills/pages/BillPaymentPage.vue', import.meta.url),
  'utf8',
)

test('bills routes canonicalize every design id and reject unknown screens', () => {
  for (const designId of [
    '3-02',
    '3-02A',
    '3-03',
    '3-04',
    '3-05',
    '3-06',
    '3-07',
    '3-08',
    '3-09',
    '3-10',
    '3-11',
    '3-12',
    '3-13',
    '3-14',
    '3-15',
    '3-16',
    '3-17',
    '3-18',
    '3-19',
    '3-20',
    '3-21',
    '3-22',
  ]) {
    const target = route?.beforeEnter?.({ params: { screenKey: designId } })
    assert.notDeepEqual(target, { name: 'bills-home' }, `${designId} must remain reachable`)
  }

  assert.deepEqual(route?.beforeEnter?.({ params: { screenKey: 'missing' } }), {
    name: 'bills-home',
  })
})

test('bills route page delegates to feature pages without the legacy service screen', () => {
  assert.match(routePageSource, /BillCapturePage/)
  assert.match(routePageSource, /BillPaymentPage/)
  assert.match(routePageSource, /BillStatusPage/)
  assert.doesNotMatch(routePageSource, /service-screen|v-html|contentHtml/)
})

test('bills capture keeps native camera, gallery, OCR, and voice-session contracts', () => {
  assert.match(capturePageSource, /navigator\.mediaDevices\.getUserMedia/)
  assert.match(capturePageSource, /captureVideoFrame/)
  assert.match(capturePageSource, /takeBillPhoto/)
  assert.match(capturePageSource, /voiceStore\.startSession\('BILL_PAYMENT'\)/)
  assert.match(capturePageSource, /billStore\.upload/)
})

test('bills payment confirms every safety value before idempotent execution', () => {
  assert.match(paymentPageSource, /confirmedPayee: billStore\.bill\.payee/)
  assert.match(paymentPageSource, /confirmedAmount: billStore\.bill\.amount/)
  assert.match(paymentPageSource, /confirmedDueDate: billStore\.bill\.dueDate/)
  assert.match(paymentPageSource, /confirmationToken/)
  assert.match(paymentPageSource, /billStore\.execute\(\)/)
  assert.match(paymentPageSource, /bill-complete/)
  assert.match(paymentPageSource, /bill-payment-failed/)
})
