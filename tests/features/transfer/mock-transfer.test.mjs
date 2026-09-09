import assert from 'node:assert/strict'
import test from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { apiClient } from '../../../src/shared/api/client.js'
import { accountsApi } from '../../../src/features/transfer/api/accounts.js'
import { transfersApi } from '../../../src/features/transfer/api/transfers.js'
import { useTransferStore } from '../../../src/features/transfer/stores/transfer.js'

test('mock transfer completes the confirmed flow without an HTTP request', async () => {
  setActivePinia(createPinia())
  const originalAdapter = apiClient.defaults.adapter
  let httpRequests = 0
  apiClient.defaults.adapter = async (config) => {
    httpRequests += 1
    return { data: [], status: 200, statusText: 'OK', headers: {}, config }
  }

  try {
    const accounts = await accountsApi.list({ active: true })
    assert.equal(httpRequests, 0)

    const [account] = accounts
    const store = useTransferStore()
    const [recipient] = await store.findRecipients({ keyword: '김영희' })

    store.selectAccount(account)
    store.selectRecipient(recipient)
    store.setAmount(50000)
    await store.validateAmount()
    await store.prepare()
    await store.assessRisk()
    await store.confirm({ approved: true })
    await store.authenticate({ pin: '123456' })
    const result = await store.execute()

    assert.equal(account.accountNumberMasked, '***-***-123456')
    assert.equal(recipient.displayName, '김영희')
    assert.equal(store.executable, true)
    assert.equal(store.authenticated, true)
    assert.equal(result.status, 'SUCCESS')
    assert.equal(result.amount, 50000)
  } finally {
    apiClient.defaults.adapter = originalAdapter
  }
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
  setActivePinia(createPinia())
  const demoModule = await import('../../../src/features/transfer/services/mockTransferDemo.js')
  assert.equal(typeof demoModule.prepareMockTransferDraft, 'function')

  const store = useTransferStore()
  const summary = await demoModule.prepareMockTransferDraft({
    transferStore: store,
    loadAccounts: () => accountsApi.list({ active: true }),
  })

  assert.equal(summary.recipient.displayName, '김영희')
  assert.equal(summary.account.accountId, 'account-kb-main')
  assert.equal(summary.amount, 50000)
  assert.equal(store.selectedRecipient.displayName, '김영희')
  assert.equal(store.fromAccount.accountId, 'account-kb-main')
  assert.equal(store.draftAmount, 50000)
})
