let pendingBillImage = null

export function setPendingBillImage(image) {
  pendingBillImage = image || null
  return pendingBillImage
}

export function getPendingBillImage() {
  return pendingBillImage
}

export function clearPendingBillImage() {
  pendingBillImage = null
}
