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

const profilePageSource = readFileSync(
  new URL('../../../src/features/my-page/pages/ProfilePage.vue', import.meta.url),
  'utf8',
)

test('profile page loads membership information with loading and error states', () => {
  assert.match(profilePageSource, /profileApi\.get/)
  assert.match(profilePageSource, /profileRows/)
  assert.match(profilePageSource, /가입 정보를 불러오고 있어요/)
  assert.match(profilePageSource, /v-else-if="error"/)
})
