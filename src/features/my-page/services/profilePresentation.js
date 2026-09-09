const EMPTY_VALUE = '등록된 정보가 없어요'

export function profileRows(profile = {}) {
  const address = [profile.address, profile.detailAddress]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ')

  return [
    { label: '이름', value: String(profile.name ?? '').trim() || EMPTY_VALUE },
    { label: '휴대전화', value: String(profile.phoneMasked ?? '').trim() || EMPTY_VALUE },
    { label: '주소', value: address || EMPTY_VALUE },
  ]
}
