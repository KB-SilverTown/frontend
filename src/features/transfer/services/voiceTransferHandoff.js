const TRANSFER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 음성 대화가 송금 초안을 완성한 경우에만, 화면의 최종 확인 절차로 넘긴다.
 * 사용자 승인·PIN 인증·실행은 이 함수가 수행하지 않는다.
 */
export function transferIdForManualConfirmation(turn) {
  if (turn?.state !== 'WAITING_FINAL_APPROVAL' || turn?.nextAction !== 'ASK_FINAL_APPROVAL') {
    return ''
  }

  const transferId = String(turn?.draftSummary?.transferId ?? turn?.displayCard?.transferId ?? '').trim()
  return TRANSFER_ID_PATTERN.test(transferId) ? transferId : ''
}

export async function handoffVoiceTransferToManualConfirmation({
  turn,
  sessionId,
  transferStore,
  loadAccounts,
  selectAccount,
  handoffSession,
}) {
  const transferId = transferIdForManualConfirmation(turn)
  if (!transferId) return null
  if (!sessionId) throw new Error('음성 송금 세션을 확인하지 못했어요. 다시 입력해 주세요.')

  const prepared = await transferStore.load(transferId)
  const accounts = await loadAccounts()
  const fromAccount = accounts.find((account) => account?.accountId === prepared?.fromAccountId)
  if (!fromAccount) throw new Error('출금 계좌를 확인하지 못했어요. 다시 시도해 주세요.')

  selectAccount(fromAccount)
  await handoffSession(sessionId)
  return transferId
}
