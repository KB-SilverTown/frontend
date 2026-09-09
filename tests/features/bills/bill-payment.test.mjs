import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routeSource = readFileSync(
  new URL('../../../src/features/bills/pages/BillPaymentPage.vue', import.meta.url),
  'utf8',
)
const homeSource = readFileSync(
  new URL('../../../src/app/pages/ServiceHomePage.vue', import.meta.url),
  'utf8',
)
const primaryHandlerSource = routeSource.slice(
  routeSource.indexOf('async function primary'),
  routeSource.indexOf('function secondary'),
)
const billExecutionSource = routeSource.slice(
  routeSource.indexOf('async function runPayment'),
  routeSource.indexOf('async function speakBill'),
)

test('bill confirmation sends all required confirmation values from the payment page', () => {
  assert.match(
    routeSource,
    /async function confirmBill[\s\S]*confirmedPayee: billStore\.bill\.payee/,
  )
  assert.match(
    routeSource,
    /async function confirmBill[\s\S]*confirmedAmount: billStore\.bill\.amount/,
  )
  assert.match(
    routeSource,
    /async function confirmBill[\s\S]*confirmedDueDate: billStore\.bill\.dueDate/,
  )
  assert.match(
    primaryHandlerSource,
    /\['bill-review', 'bill-low-confidence'\]\.includes\(props\.screenKey\)[\s\S]*confirmBill\(\)/,
  )
})
test('bill confirmation keeps a mismatch on the reconfirmation screen', () => {
  assert.match(routeSource, /status !== ['"]CONFIRMED['"]/)
  assert.match(routeSource, /executable !== true/)
  assert.match(routeSource, /screenKey: ['"]bill-low-confidence['"]|bill-low-confidence/)
})

test('bill execution routes by the actual SUCCESS response', () => {
  assert.match(routeSource, /status === ['"]SUCCESS['"]|isBillPaymentSuccessful/)
  assert.match(routeSource, /screenKey: ['"]bill-complete['"]|bill-complete/)
  assert.match(routeSource, /screenKey: ['"]bill-payment-failed['"]|bill-payment-failed/)
})

test('bill execution validates the latest confirmation state', () => {
  assert.match(billExecutionSource, /billStore\.bill\?\.status !== ['"]CONFIRMED['"]/)
  assert.match(billExecutionSource, /billStore\.bill\?\.executable !== true/)
  assert.match(billExecutionSource, /billStore\.confirmationToken/)
  assert.match(billExecutionSource, /screenKey: ['"]bill-low-confidence['"]|bill-low-confidence/)
})
test('bill success screen renders actual payment result fields', () => {
  assert.match(routeSource, /result\.paymentId/)
  assert.match(routeSource, /result\.amount/)
  assert.match(routeSource, /result\.paidAt/)
})
test('bill home does not contain hardcoded bill entries', () => {
  assert.doesNotMatch(homeSource, /전기요금 · 48,200원/)
  assert.doesNotMatch(homeSource, /통신요금 · 납부 완료/)
  assert.match(homeSource, /serviceData\.loading\.bills|loading\.bills/)
  assert.match(homeSource, /등록된 고지서가 없어요|고지서가 없어요|!serviceData\.bills\.length/)
})
