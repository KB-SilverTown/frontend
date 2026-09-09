import assert from 'node:assert/strict'
import test from 'node:test'

import {
  arePermissionsGranted,
  NATIVE_PERMISSION_ORDER,
  requestOnboardingDevicePermissions,
  requestPermissionsInOrder,
} from '../../../src/features/onboarding/services/permissions.js'

test('granted and limited native permissions are treated as already available', () => {
  assert.equal(
    arePermissionsGranted({
      contacts: 'granted',
      camera: 'limited',
      location: 'granted',
      microphone: 'granted',
    }),
    true,
  )
})

test('any non-granted native permission keeps the permissions step', () => {
  assert.equal(
    arePermissionsGranted({
      contacts: 'granted',
      camera: 'prompt',
      location: 'granted',
      microphone: 'granted',
    }),
    false,
  )
})

test('native permissions are requested in the UI order and one failure does not stop the flow', async () => {
  const calls = []

  const failures = await requestPermissionsInOrder({
    contacts: async () => calls.push('contacts'),
    camera: async () => {
      calls.push('camera')
      throw new Error('camera denied')
    },
    location: async () => calls.push('location'),
    microphone: async () => calls.push('microphone'),
  })

  assert.deepEqual(calls, NATIVE_PERMISSION_ORDER)
  assert.deepEqual(
    failures.map(({ permission }) => permission),
    ['camera'],
  )
})

function createPermissionPlugin(
  permission,
  status,
  calls,
  requestResult = { [permission]: 'granted' },
) {
  return {
    checkPermissions: async () => {
      calls.push(`${permission}:check`)
      return { [permission]: status }
    },
    requestPermissions: async (options) => {
      calls.push([`${permission}:request`, options])
      return requestResult
    },
  }
}

test('onboarding permission request is skipped in the browser', async () => {
  const calls = []
  const failures = await requestOnboardingDevicePermissions({
    capacitor: { isNativePlatform: () => false },
    contacts: createPermissionPlugin('contacts', 'prompt', calls),
  })

  assert.deepEqual(failures, [])
  assert.deepEqual(calls, [])
})

test('onboarding permission request only prompts unavailable native permissions', async () => {
  const calls = []
  const failures = await requestOnboardingDevicePermissions({
    capacitor: { isNativePlatform: () => true },
    contacts: createPermissionPlugin('contacts', 'prompt', calls),
    camera: createPermissionPlugin('camera', 'limited', calls),
    geolocation: createPermissionPlugin('location', 'prompt', calls),
    speechRecognition: createPermissionPlugin('speechRecognition', 'granted', calls),
  })

  assert.deepEqual(failures, [])
  assert.deepEqual(calls, [
    'contacts:check',
    ['contacts:request', undefined],
    'camera:check',
    'location:check',
    ['location:request', { permissions: ['location'] }],
    'speechRecognition:check',
  ])
})

test('onboarding continues when a native permission request is rejected', async () => {
  const calls = []
  const contacts = createPermissionPlugin('contacts', 'prompt', calls)
  contacts.requestPermissions = async () => {
    calls.push('contacts:request')
    throw new Error('contacts denied')
  }

  const failures = await requestOnboardingDevicePermissions({
    capacitor: { isNativePlatform: () => true },
    contacts,
    camera: createPermissionPlugin('camera', 'granted', calls),
    geolocation: createPermissionPlugin('location', 'granted', calls),
    speechRecognition: createPermissionPlugin('speechRecognition', 'granted', calls),
  })

  assert.deepEqual(
    failures.map(({ permission }) => permission),
    ['contacts'],
  )
  assert.deepEqual(calls, [
    'contacts:check',
    'contacts:request',
    'camera:check',
    'location:check',
    'speechRecognition:check',
  ])
})
