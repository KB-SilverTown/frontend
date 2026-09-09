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

const livingStatusPageSource = readFileSync(
  new URL('../../../src/features/living/pages/LivingStatusPage.vue', import.meta.url),
  'utf8',
)

test('profile edit route directs users to the my page', () => {
  assert.match(
    livingStatusPageSource,
    /'living-profile-edit': \['내 정보 고치기', '내 정보는 마이페이지에서 확인합니다\.', 'my-page'\]/,
  )
})
