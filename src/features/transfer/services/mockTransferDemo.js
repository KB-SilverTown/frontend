import { MOCK_TRANSFER_SCENARIO } from '../api/mockTransfer.js'

const waitFor = (milliseconds) =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds)
  })

export async function playMockTransferRecognition({
  wait = waitFor,
  onUpdate = () => {},
  isCancelled = () => false,
} = {}) {
  onUpdate({ phase: 'listening', transcript: '' })
  await wait(650)
  if (isCancelled()) return false

  onUpdate({
    phase: 'recognizing',
    transcript: MOCK_TRANSFER_SCENARIO.partialTranscript,
  })
  await wait(850)
  if (isCancelled()) return false

  onUpdate({
    phase: 'recognized',
    transcript: MOCK_TRANSFER_SCENARIO.transcript,
  })
  return true
}

export async function prepareMockTransferDraft({ transferStore, loadAccounts }) {
  const candidates = await transferStore.findRecipients({
    keyword: MOCK_TRANSFER_SCENARIO.recipient.displayName,
  })
  const recipient = candidates.find(
    (candidate) => candidate.recipientId === MOCK_TRANSFER_SCENARIO.recipient.recipientId,
  )
  if (!recipient) throw new Error('받는 분을 찾지 못했어요. 다시 들어주세요.')

  const accounts = await loadAccounts()
  const account =
    accounts.find((item) => item.accountId === MOCK_TRANSFER_SCENARIO.account.accountId) ??
    accounts[0]
  if (!account) throw new Error('보낼 계좌를 불러오지 못했어요.')

  transferStore.selectRecipient(recipient)
  transferStore.selectAccount(account)
  transferStore.setAmount(MOCK_TRANSFER_SCENARIO.amount)

  return { recipient, account, amount: MOCK_TRANSFER_SCENARIO.amount }
}
