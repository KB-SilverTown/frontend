import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { voiceRoutes } from '../../../src/features/voice/routes.js'

const voiceRoute = voiceRoutes.find(({ name }) => name === 'voice-screen')
const myPageVoiceRoute = voiceRoutes.find(({ name }) => name === 'my-page-voice')
const routePageSource = readFileSync(
  new URL('../../../src/features/voice/pages/VoiceRoutePage.vue', import.meta.url),
  'utf8',
)
const settingsPageSource = readFileSync(
  new URL('../../../src/features/voice/pages/VoiceSettingsPage.vue', import.meta.url),
  'utf8',
)
const statusPageSource = readFileSync(
  new URL('../../../src/features/voice/pages/VoiceStatusPage.vue', import.meta.url),
  'utf8',
)
const shellSource = readFileSync(
  new URL('../../../src/features/voice/components/VoicePageShell.vue', import.meta.url),
  'utf8',
)

test('voice routes preserve settings redirects, aliases, and fallback behavior', () => {
  assert.deepEqual(voiceRoute?.beforeEnter?.({ params: { screenKey: 'voice-voice-select' } }), {
    name: 'my-page-voice',
    params: { screenKey: 'voice-voice-select' },
  })
  assert.deepEqual(
    voiceRoute?.beforeEnter?.({ params: { screenKey: '5-02' }, query: { source: 'help' } }),
    {
      name: 'my-page-voice',
      params: { screenKey: 'voice-voice-preview' },
      query: { source: 'help' },
    },
  )
  assert.equal(voiceRoute?.beforeEnter?.({ params: { screenKey: 'voice-replay' } }), true)
  assert.deepEqual(voiceRoute?.beforeEnter?.({ params: { screenKey: 'missing' } }), {
    name: 'voice-home',
  })
  assert.equal(
    myPageVoiceRoute?.beforeEnter?.({ params: { screenKey: 'voice-voice-preview' } }),
    true,
  )
  assert.deepEqual(myPageVoiceRoute?.beforeEnter?.({ params: { screenKey: '5-01' } }), {
    name: 'my-page-voice',
    params: { screenKey: 'voice-voice-select' },
  })
})

test('voice route page selects feature pages without the legacy service screen', () => {
  assert.match(routePageSource, /VoiceSettingsPage/)
  assert.match(routePageSource, /VoiceConversationPage/)
  assert.match(routePageSource, /VoiceStatusPage/)
  assert.doesNotMatch(routePageSource, /service-screen|v-html|contentHtml/)
})
test('every legacy voice design id is canonicalized without changing its allowed flow', () => {
  const legacyIds = ['5-01', '5-02', '5-03', '5-04', '5-05', '5-06', '5-07', '5-08']

  for (const designId of legacyIds) {
    const result = voiceRoute?.beforeEnter?.({ params: { screenKey: designId } })
    assert.notDeepEqual(result, { name: 'voice-home' }, `${designId} must remain reachable`)
  }

  for (const designId of ['5-01', '5-02']) {
    const result = myPageVoiceRoute?.beforeEnter?.({ params: { screenKey: designId } })
    assert.equal(typeof result, 'object', `${designId} must canonicalize in My Page`)
    assert.equal(result.name, 'my-page-voice')
  }
})

test('voice settings preserve load, reset, preview, save, and discard contracts', () => {
  assert.match(settingsPageSource, /voiceStore\.loadSettings\(\)/)
  assert.match(settingsPageSource, /voiceStore\.resetDraftSettings\(\)/)
  assert.match(settingsPageSource, /voiceStore\.saveSettings\(voiceStore\.draftSettings\)/)
  assert.match(settingsPageSource, /voiceStore\.discardDraftSettings\(\)/)
  assert.match(settingsPageSource, /name: 'my-page-voice'/)
  assert.match(settingsPageSource, /name: 'my-page'/)
  assert.match(settingsPageSource, /role="alert"/)
})

test('voice status pages preserve all legacy action destinations', () => {
  for (const screenKey of [
    'voice-replay',
    'voice-ended',
    'voice-resume',
    'voice-expired',
    'voice-bill-reading',
  ]) {
    assert.match(statusPageSource, new RegExp(`case '${screenKey}'`))
    assert.match(statusPageSource, new RegExp(`props\\.screenKey === '${screenKey}'`))
  }

  assert.match(statusPageSource, /name: 'living-home'/)
  assert.match(statusPageSource, /name: 'transfer-screen'/)
  assert.match(statusPageSource, /screenKey: 'transfer-listening'/)
  assert.match(statusPageSource, /name: 'bills-home'/)
})

test('voice shell keeps accessible back, action, and microphone controls', () => {
  assert.match(shellSource, /aria-label="이전 화면"/)
  assert.match(shellSource, /aria-label="음성 도움"/)
  assert.match(shellSource, /gwipyeonhan:voice-assist/)
  assert.match(shellSource, /screenKey: 'voice-enabled'/)
  assert.match(shellSource, /:disabled="busy"/)
})
