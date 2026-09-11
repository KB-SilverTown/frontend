const RECIPIENT_CARD = 'RECIPIENT_CANDIDATES'
const AMOUNT_CARD = 'AMOUNT_RECONFIRM'

function candidateFromVoiceCard(item) {
  const recipientId = String(item?.recipientId ?? item?.id ?? '').trim()
  return recipientId
    ? {
        ...item,
        id: recipientId,
        recipientId,
      }
    : null
}

/**
 * A transfer turn moves the user to the matching visual step; it never authorizes a transfer.
 * Recipient and amount selections remain server-card actions, while the final read-back is handed
 * to the ordinary manual confirmation flow.
 */
export function transferScreenForVoiceTurn(turn) {
  const cardType = turn?.displayCard?.type
  if (cardType === RECIPIENT_CARD) return 'transfer-recipient-select'
  if (cardType === AMOUNT_CARD) return 'transfer-amount-confirm'

  if (turn?.state === 'RISK_CHECK') return 'transfer-risk-confirm'
  if (turn?.state === 'HELD') return 'transfer-pending'
  if (turn?.state === 'WAITING_FINAL_APPROVAL' && turn?.nextAction === 'ASK_FINAL_APPROVAL') {
    return 'transfer-confirm'
  }
  if (turn?.state === 'AWAITING_AMOUNT') return 'transfer-listening'
  return ''
}

/** Populate only presentation state from a server-issued voice card. */
export function applyVoiceTurnToTransferStore(turn, transferStore) {
  const card = turn?.displayCard
  if (card?.type === RECIPIENT_CARD) {
    transferStore.candidates = (Array.isArray(card.items) ? card.items : [])
      .map(candidateFromVoiceCard)
      .filter(Boolean)
    transferStore.selectedRecipient = null
  }
  if (card?.type === AMOUNT_CARD) {
    const focused = (Array.isArray(card.items) ? card.items : []).find(
      (item) => item?.id === card.focusedItemId,
    )
    const amount = Number(focused?.amount)
    if (Number.isSafeInteger(amount) && amount > 0) transferStore.setAmount(amount)
  }
  return transferScreenForVoiceTurn(turn)
}
