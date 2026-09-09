import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { livingRoutes } from '../../../src/features/living/routes.js'

const route = livingRoutes.find(({ name }) => name === 'living-screen')
const routePageSource = readFileSync(
  new URL('../../../src/features/living/pages/LivingRoutePage.vue', import.meta.url),
  'utf8',
)
const reminderPageSource = readFileSync(
  new URL('../../../src/features/living/pages/LivingReminderPage.vue', import.meta.url),
  'utf8',
)
const branchPageSource = readFileSync(
  new URL('../../../src/features/living/pages/LivingBranchPage.vue', import.meta.url),
  'utf8',
)
const statusPageSource = readFileSync(
  new URL('../../../src/features/living/pages/LivingStatusPage.vue', import.meta.url),
  'utf8',
)

test('living routes canonicalize every design id and reject unknown screens', () => {
  for (let number = 2; number <= 26; number += 1) {
    const designId = `4-${String(number).padStart(2, '0')}`
    const target = route?.beforeEnter?.({ params: { screenKey: designId } })
    assert.notDeepEqual(target, { name: 'living-home' }, `${designId} must remain reachable`)
  }

  assert.deepEqual(route?.beforeEnter?.({ params: { screenKey: 'missing' } }), {
    name: 'living-home',
  })
})

test('living voice settings preserves the my-page contract without an empty query', () => {
  assert.deepEqual(route?.beforeEnter?.({ params: { screenKey: '4-13' } }), {
    name: 'my-page-voice',
    params: { screenKey: 'voice-voice-select' },
  })
})

test('living route page delegates to feature pages without the legacy service screen', () => {
  assert.match(routePageSource, /LivingReminderPage/)
  assert.match(routePageSource, /LivingBranchPage/)
  assert.match(routePageSource, /LivingStatusPage/)
  assert.doesNotMatch(routePageSource, /service-screen|v-html|contentHtml/)
})

test('living reminder page keeps reminder loading and explicit CRUD contracts', () => {
  assert.match(reminderPageSource, /serviceData\.loadReminders/)
  assert.match(reminderPageSource, /serviceData\.createReminder/)
  assert.match(reminderPageSource, /serviceData\.updateReminder/)
  assert.match(reminderPageSource, /serviceData\.cancelReminder/)
  assert.match(reminderPageSource, /living-reminders-error/)
})

test('living branch and status pages use native location and feature routes', () => {
  assert.match(branchPageSource, /getCurrentLocation/)
  assert.match(branchPageSource, /serviceData\.loadMobileBranches/)
  assert.match(statusPageSource, /name: 'living-screen'/)
  assert.match(statusPageSource, /living-reminder-arrived/)
})
