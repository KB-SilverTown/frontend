import assert from 'node:assert/strict'
import test from 'node:test'

import {
  handoffVoiceTransferToManualConfirmation,
  transferIdForManualConfirmation,
} from '../../../src/features/transfer/services/voiceTransferHandoff.js'
import {
  applyVoiceTurnToTransferStore,
  transferScreenForVoiceTurn,
} from '../../../src/features/transfer/services/voiceTransferProgress.js'

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

test('voice turn state moves to its matching screen without authorizing a transfer', () => {
  const transferStore = {
    candidates: [],
    selectedRecipient: { recipientId: 'old-recipient' },
    setAmount(value) {
      this.amount = value
    },
  }
  const recipientTurn = {
    state: 'AWAITING_RECIPIENT',
    displayCard: {
      type: 'RECIPIENT_CANDIDATES',
      items: [{ id: 'recipient-1', displayName: '김철수' }],
    },
  }
  const amountTurn = {
    state: 'RECONFIRMING',
    displayCard: {
      type: 'AMOUNT_RECONFIRM',
      focusedItemId: 'amount-1',
      items: [{ id: 'amount-1', amount: 50000 }],
    },
  }

  assert.equal(
    applyVoiceTurnToTransferStore(recipientTurn, transferStore),
    'transfer-recipient-select',
  )
  assert.deepEqual(transferStore.candidates, [
    { id: 'recipient-1', recipientId: 'recipient-1', displayName: '김철수' },
  ])
  assert.equal(transferStore.selectedRecipient, null)
  assert.equal(applyVoiceTurnToTransferStore(amountTurn, transferStore), 'transfer-amount-confirm')
  assert.equal(transferStore.amount, 50000)
  assert.equal(
    transferScreenForVoiceTurn({
      state: 'WAITING_FINAL_APPROVAL',
      nextAction: 'ASK_FINAL_APPROVAL',
    }),
    'transfer-confirm',
  )
})
