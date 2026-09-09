import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const fontSizePageSource = readSource('../../../src/features/my-page/pages/FontSizePage.vue')
const onboardingStyleSource = readSource('../../../src/features/onboarding/styles/onboarding.css')
const globalStyleSource = readSource('../../../src/shared/styles/globals.css')

test('large font option previews a size four pixels larger than the standard body text', () => {
  assert.ok(globalStyleSource.includes('--font-size-body: 19px;'))
  assert.ok(globalStyleSource.includes(":root[data-font-scale='large']"))
  assert.ok(globalStyleSource.includes('--font-size-body: 21px;'))
  assert.ok(onboardingStyleSource.includes('font-size: max(var(--font-size-body), 23px);'))
})

test('font size picker keeps its typography independent from the selected scale', () => {
  assert.ok(fontSizePageSource.includes('class="mobile-app-shell my-page-device"'))
  assert.ok(fontSizePageSource.includes('class="font-size-picker font-size-page"'))

  const pageTokenBlock = onboardingStyleSource.split('.font-size-page {')[1]?.split('}')[0]

  assert.ok(pageTokenBlock, 'font size page should define fixed typography tokens')
  assert.ok(pageTokenBlock.includes('--font-size-title: 30px;'))
  assert.ok(pageTokenBlock.includes('--font-size-body: 19px;'))
  assert.ok(pageTokenBlock.includes('--font-size-action: 24px;'))
  assert.ok(pageTokenBlock.includes('--font-size-display: 36px;'))
  assert.ok(pageTokenBlock.includes('--font-size-nav: 16px;'))
})

test('four-item bottom navigation spaces labels by their content width', () => {
  const fourItemNavBlock = onboardingStyleSource
    .split('.app-bottom-nav.four-items {')[1]
    ?.split('}')[0]

  assert.ok(fourItemNavBlock, 'four-item bottom navigation should define its own layout')
  assert.ok(fourItemNavBlock.includes('display: flex;'))
  assert.ok(fourItemNavBlock.includes('justify-content: space-evenly;'))
  assert.ok(fourItemNavBlock.includes('padding-inline: 8px;'))
  assert.ok(onboardingStyleSource.includes('.app-bottom-nav.four-items :is(a, button)'))
  assert.ok(onboardingStyleSource.includes('min-width: 44px;'))
  assert.ok(onboardingStyleSource.includes('white-space: nowrap;'))
})
