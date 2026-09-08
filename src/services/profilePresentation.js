function profileSource(value) {
  const source = value?.profile ?? value?.user ?? value?.data ?? value
  return source && typeof source === 'object' ? source : {}
}

function firstValue(value, keys) {
  for (const key of keys) {
    if (value?.[key] !== undefined && value[key] !== null && value[key] !== '') {
      return value[key]
    }
  }

  return ''
}

function text(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export function formatProfilePhone(value) {
  const digits = String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 11)

  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function normalizeProfile(value) {
  const source = profileSource(value)
  const addressValue = firstValue(source, ['address', 'roadAddress', 'baseAddress'])
  const addressObject = addressValue && typeof addressValue === 'object' ? addressValue : null

  return {
    name: text(firstValue(source, ['name', 'userName', 'fullName'])),
    phone: formatProfilePhone(firstValue(source, ['phone', 'phoneNumber', 'mobilePhone'])),
    address: text(addressObject ? firstValue(addressObject, ['address', 'roadAddress']) : addressValue),
    detailAddress: text(
      firstValue(source, ['detailAddress', 'addressDetail']) ||
        (addressObject ? firstValue(addressObject, ['detailAddress', 'detail']) : ''),
    ),
  }
}

export function buildProfileUpdate(profile) {
  return {
    name: String(profile?.name ?? '').trim(),
    phone: String(profile?.phone ?? '').replace(/\D/g, ''),
    address: String(profile?.address ?? '').trim(),
    detailAddress: String(profile?.detailAddress ?? '').trim(),
  }
}
