import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isMockTransferEnabled,
  mockAccountsApi,
  mockTransfersApi,
} from '../../../src/features/transfer/api/mockTransfer.js'

test('mock transfer is disabled by default and only enabled explicitly', () => {
  assert.equal(isMockTransferEnabled({}), false)
  assert.equal(isMockTransferEnabled({ VITE_USE_MOCK_TRANSFER: 'false' }), false)
  assert.equal(isMockTransferEnabled({ VITE_USE_MOCK_TRANSFER: 'true' }), true)
})

test('explicit mock transfer completes the confirmed flow without HTTP', async () => {
  const [account] = await mockAccountsApi.list({ active: true })
  const [recipient] = (await mockTransfersApi.candidates({ keyword: '김영희' })).candidates
  const prepared = await mockTransfersApi.prepare({
    fromAccountId: account.accountId,
    recipientId: recipient.recipientId,
    amount: 50000,
  })
  const confirmation = await mockTransfersApi.confirm(prepared.transferId, { approved: true })
  const authentication = await mockTransfersApi.authenticate(prepared.transferId, { pin: '123456' })
  const result = await mockTransfersApi.execute(prepared.transferId)

  assert.equal(account.accountNumberMasked, '***-***-123456')
  assert.equal(recipient.displayName, '김영희')
  assert.equal(confirmation.executable, true)
  assert.equal(authentication.authenticated, true)
  assert.equal(result.status, 'SUCCESS')
  assert.equal(result.amount, 50000)
})

test('mock voice recognition reports listening, partial text, and the final sentence in order', async () => {
  const demoModule =
    await import('../../../src/features/transfer/services/mockTransferDemo.js').catch(() => null)
  assert.ok(demoModule, 'mock transfer voice demo module must exist')

  const updates = []
  await demoModule.playMockTransferRecognition({
    wait: async () => {},
    onUpdate: (update) => updates.push(update),
  })

  assert.deepEqual(updates, [
    { phase: 'listening', transcript: '' },
    { phase: 'recognizing', transcript: '김영희에게' },
    { phase: 'recognized', transcript: '김영희에게 5만원 보내줘' },
  ])
})

test('recognized mock sentence stages the recipient, account, and amount for confirmation', async () => {
  const demoModule = await import('../../../src/features/transfer/services/mockTransferDemo.js')
  assert.equal(typeof demoModule.prepareMockTransferDraft, 'function')

  const store = {
    selectedRecipient: null,
    fromAccount: null,
    draftAmount: null,
    findRecipients: async () => (await mockTransfersApi.candidates({ keyword: '김영희' })).candidates,
    selectRecipient(recipient) {
      this.selectedRecipient = recipient
    },
    selectAccount(account) {
      this.fromAccount = account
    },
    setAmount(amount) {
      this.draftAmount = amount
    },
  }
  const summary = await demoModule.prepareMockTransferDraft({
    transferStore: store,
    loadAccounts: () => mockAccountsApi.list({ active: true }),
  })

  assert.equal(summary.recipient.displayName, '김영희')
  assert.equal(summary.account.accountId, 'account-kb-main')
  assert.equal(summary.amount, 50000)
  assert.equal(store.selectedRecipient.displayName, '김영희')
  assert.equal(store.fromAccount.accountId, 'account-kb-main')
  assert.equal(store.draftAmount, 50000)
})
