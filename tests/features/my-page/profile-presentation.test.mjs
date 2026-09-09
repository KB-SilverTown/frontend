import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { profileRows } from '../../../src/features/my-page/services/profilePresentation.js'

test('profile rows expose the current user fields returned by GET /users/me', () => {
  assert.deepEqual(
    profileRows({
      name: '김순자',
      phoneMasked: '010-****-0000',
      address: '서울특별시 성동구 왕십리로 83-21',
      detailAddress: '101동 1203호',
    }),
    [
      { label: '이름', value: '김순자' },
      { label: '휴대전화', value: '010-****-0000' },
      { label: '주소', value: '서울특별시 성동구 왕십리로 83-21 101동 1203호' },
    ],
  )
})

const livingReferenceSource = readFileSync(
  new URL('../../../src/features/living/screens/reference.js', import.meta.url),
  'utf8',
)

test('profile edit screen describes its read-only scope', () => {
  assert.match(
    livingReferenceSource,
    /key: 'living-profile-edit',[\s\S]*?description: '등록된 내 정보를 확인합니다.'/,
  )
})
