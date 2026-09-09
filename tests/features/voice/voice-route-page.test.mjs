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
