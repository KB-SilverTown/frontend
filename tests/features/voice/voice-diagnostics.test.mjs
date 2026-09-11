import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const voiceStore = readFileSync(
  new URL('../../../src/features/voice/stores/voice.js', import.meta.url),
  'utf8',
)

test('development voice diagnostics keep server identifiers without recording a transcript', () => {
  const diagnosticSource = voiceStore.slice(
    voiceStore.indexOf('function reportVoiceDiagnostic'),
    voiceStore.indexOf('function transferUserError'),
  )
  assert.match(voiceStore, /function reportVoiceDiagnostic/)
  assert.match(voiceStore, /import\.meta\.env\.DEV/)
  assert.match(voiceStore, /serverCode: normalized\.serverCode/)
  assert.match(voiceStore, /requestId: normalized\.requestId/)
  assert.match(voiceStore, /error\.value = toUserError\(cause\)\s+reportVoiceDiagnostic\(error\.value\)/)
  assert.doesNotMatch(diagnosticSource, /transcript/i)
})
