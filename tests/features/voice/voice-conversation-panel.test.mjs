import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panelSource = readFileSync(
  new URL('../../../src/features/voice/components/VoiceConversationPanel.vue', import.meta.url),
  'utf8',
)

test('transfer conversation starts microphone input as soon as the screen mounts', () => {
  assert.match(panelSource, /onMounted\(\(\) => \{\s*if \(isTransfer\.value\) \{\s*void listen\(\)/)
  assert.match(panelSource, /if \(sessionPromise\) return sessionPromise/)
  assert.match(panelSource, /voiceStore\.startSession\(props\.entryPoint\)/)
})

test('transfer no-response timer remains fifteen seconds after speech playback', () => {
  assert.match(panelSource, /const NO_RESPONSE_MS = 15_000/)
  assert.match(panelSource, /\(speaking\) => \{\s*if \(speaking\) \{\s*clearNoResponseTimer\(\)/)
  assert.match(panelSource, /startNoResponseTimer\(\)/)
})
