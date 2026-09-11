const MOCK_ACCOUNT = Object.freeze({
  accountId: 'account-kb-main',
  accountName: 'KB국민 주거래통장',
  accountType: '입출금통장',
  bankName: 'KB국민은행',
  accountNumberMasked: '***-***-123456',
  balance: 1240000,
})

const MOCK_RECIPIENT = Object.freeze({
  recipientId: 'recipient-kim-younghee',
  displayName: '김영희',
  relationship: '가족',
  bankName: '신한은행',
  accountNumberMasked: '***-***-567890',
})

export const MOCK_TRANSFER_SCENARIO = Object.freeze({
  transcript: '김영희에게 5만원 보내줘',
  partialTranscript: '김영희에게',
  amount: 50000,
  pin: '123456',
  account: MOCK_ACCOUNT,
  recipient: MOCK_RECIPIENT,
})

const MOCK_TRANSFER_ID = 'mock-transfer-001'
const MOCK_TRANSACTION_ID = 'mock-transaction-001'
let currentTransfer = null

function mockApiError(code, message) {
  return { response: { data: { code, message } } }
}

function transferSnapshot() {
  return (
    currentTransfer ?? {
      transferId: MOCK_TRANSFER_ID,
      status: 'READY',
      fromAccountId: MOCK_ACCOUNT.accountId,
      recipientId: MOCK_RECIPIENT.recipientId,
      recipient: { ...MOCK_RECIPIENT },
      amount: MOCK_TRANSFER_SCENARIO.amount,
      confirmationText: '김영희 님에게 50,000원을 보냅니다.',
      preparedAt: new Date().toISOString(),
    }
  )
}

export function isMockTransferEnabled(environment = import.meta.env ?? {}) {
  return environment.VITE_USE_MOCK_TRANSFER === 'true'
}

export const mockAccountsApi = {
  async list(params = {}) {
    return params.active === false ? [] : [{ ...MOCK_ACCOUNT }]
  },
}

export const mockTransfersApi = {
  async listAccounts(params) {
    return mockAccountsApi.list(params)
  },

  async candidates(request = {}) {
    const keyword = String(request.keyword ?? '').replace(/\s/g, '')
    const matches = !keyword || MOCK_RECIPIENT.displayName.includes(keyword)
    return { candidates: matches ? [{ ...MOCK_RECIPIENT }] : [] }
  },

  async prepare(request = {}) {
    const amount = Number(request.amount)
    if (request.fromAccountId !== MOCK_ACCOUNT.accountId) {
      throw mockApiError('MOCK_ACCOUNT_NOT_FOUND', '출금 계좌를 다시 선택해 주세요.')
    }
    if (request.recipientId !== MOCK_RECIPIENT.recipientId) {
      throw mockApiError('MOCK_RECIPIENT_NOT_FOUND', '받는 분을 다시 확인해 주세요.')
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw mockApiError('MOCK_AMOUNT_INVALID', '보낼 금액을 확인해 주세요.')
    }

    currentTransfer = {
      transferId: MOCK_TRANSFER_ID,
      status: 'READY',
      ...request,
      recipient: { ...MOCK_RECIPIENT },
      amount,
      confirmationText: '김영희 님에게 ' + amount.toLocaleString('ko-KR') + '원을 보냅니다.',
      preparedAt: new Date().toISOString(),
    }
    return { ...currentTransfer, recipient: { ...currentTransfer.recipient } }
  },

  async get(transferId) {
    const transfer = transferSnapshot()
    if (transferId !== transfer.transferId) {
      throw mockApiError('MOCK_TRANSFER_NOT_FOUND', '송금 정보를 다시 확인해 주세요.')
    }
    return { ...transfer, recipient: { ...transfer.recipient } }
  },

  async confirm(transferId, request = {}) {
    if (transferId !== transferSnapshot().transferId) {
      throw mockApiError('MOCK_TRANSFER_NOT_FOUND', '송금 정보를 다시 확인해 주세요.')
    }
    return {
      transferId,
      status: request.approved === true ? 'CONFIRMED' : 'READY',
      executable: request.approved === true,
    }
  },

  async setPin(request = {}) {
    if (!/^\d{6}$/.test(String(request.pin ?? ''))) {
      throw mockApiError('MOCK_PIN_INVALID', 'PIN 6자리를 숫자로 입력해 주세요.')
    }
    return { updated: true }
  },

  async authenticate(transferId, request = {}) {
    if (transferId !== transferSnapshot().transferId) {
      throw mockApiError('MOCK_TRANSFER_NOT_FOUND', '송금 정보를 다시 확인해 주세요.')
    }
    return { transferId, authenticated: request.pin === MOCK_TRANSFER_SCENARIO.pin }
  },

  async execute(transferId) {
    const transfer = transferSnapshot()
    if (transferId !== transfer.transferId) {
      throw mockApiError('MOCK_TRANSFER_NOT_FOUND', '송금 정보를 다시 확인해 주세요.')
    }
    return {
      transactionId: MOCK_TRANSACTION_ID,
      transferId,
      status: 'SUCCESS',
      amount: transfer.amount,
      recipient: { ...MOCK_RECIPIENT },
      transferredAt: new Date().toISOString(),
    }
  },

  async cancel(transferId) {
    return { transferId, status: 'CANCELLED' }
  },

  async startGuardianVerification(transferId) {
    return {
      transferId,
      verificationId: 'mock-guardian-verification',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }
  },

  async verifyGuardian(transferId, verificationId, request = {}) {
    return {
      transferId,
      verificationId,
      verified: request.code === '2580',
    }
  },

  async riskScore() {
    return {
      riskLevel: 'LOW',
      score: 12,
      recommendedAction: 'PROCEED',
      hold: false,
      additionalCheckRequired: false,
    }
  },

  async riskCheck() {
    return { hold: false, additionalCheckRequired: false }
  },

  async validateAmount(request = {}) {
    const recognizedAmount = Number(request.recognizedAmount)
    const valid = Number.isSafeInteger(recognizedAmount) && recognizedAmount > 0
    return {
      confirmedAmount: valid ? recognizedAmount : null,
      amountCandidates: valid ? [recognizedAmount] : [MOCK_TRANSFER_SCENARIO.amount],
      amountReconfirmRequired: !valid,
    }
  },
}
