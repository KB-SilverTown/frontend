import assert from 'node:assert/strict'
import test from 'node:test'

import {
  handoffVoiceTransferToManualConfirmation,
  transferIdForManualConfirmation,
} from '../../../src/features/transfer/services/voiceTransferHandoff.js'

const transferId = '30000000-0000-4000-8000-000000000001'

test('only a completed voice transfer can enter manual confirmation', () => {
  assert.equal(
    transferIdForManualConfirmation({
      state: 'WAITING_FINAL_APPROVAL',
      nextAction: 'ASK_FINAL_APPROVAL',
      draftSummary: { transferId },
    }),
    transferId,
  )
  assert.equal(
    transferIdForManualConfirmation({
      state: 'AWAITING_AMOUNT',
      nextAction: 'ASK_FINAL_APPROVAL',
      draftSummary: { transferId },
    }),
    '',
  )
})

test('handoff reloads the prepared transfer and its source account before closing the voice session', async () => {
  const calls = []
  const sourceAccount = { accountId: '40000000-0000-4000-8000-000000000001' }
  const transferStore = {
    async load(id) {
      calls.push(`load:${id}`)
      return { transferId: id, fromAccountId: sourceAccount.accountId }
    },
  }

  const result = await handoffVoiceTransferToManualConfirmation({
    turn: {
      state: 'WAITING_FINAL_APPROVAL',
      nextAction: 'ASK_FINAL_APPROVAL',
      displayCard: { transferId },
    },
    sessionId: '50000000-0000-4000-8000-000000000001',
    transferStore,
    loadAccounts: async () => {
      calls.push('accounts')
      return [sourceAccount]
    },
    selectAccount: (account) => calls.push(`account:${account.accountId}`),
    handoffSession: async (sessionId) => calls.push(`handoff:${sessionId}`),
  })

  assert.equal(result, transferId)
  assert.deepEqual(calls, [
    `load:${transferId}`,
    'accounts',
    `account:${sourceAccount.accountId}`,
    'handoff:50000000-0000-4000-8000-000000000001',
  ])
})
