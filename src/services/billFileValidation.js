export const BILL_FILE_MAX_BYTES = 20 * 1024 * 1024

const SUPPORTED_BILL_FILE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
])

function createBillFileError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export function validateBillFile(file) {
  const type = String(file?.type ?? '').trim().toLowerCase()
  if (!SUPPORTED_BILL_FILE_TYPES.has(type)) {
    throw createBillFileError('UNSUPPORTED_BILL_FILE', 'JPG·PNG·PDF 파일만 올릴 수 있어요.')
  }

  const size = Number(file?.size)
  if (Number.isFinite(size) && size > BILL_FILE_MAX_BYTES) {
    throw createBillFileError('BILL_FILE_TOO_LARGE', '20MB 이하 파일을 선택해 주세요.')
  }

  return file
}

export function isPdfBillFile(file) {
  return String(file?.type ?? '').trim().toLowerCase() === 'application/pdf'
}
