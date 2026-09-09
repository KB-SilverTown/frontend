import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
import { Contacts } from '@capacitor-community/contacts'
import { Geolocation } from '@capacitor/geolocation'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

export const NATIVE_PERMISSION_ORDER = Object.freeze([
  'contacts',
  'camera',
  'location',
  'microphone',
])

export function arePermissionsGranted(permissions = {}) {
  return NATIVE_PERMISSION_ORDER.every((permission) =>
    ['granted', 'limited'].includes(permissions[permission]),
  )
}

export async function requestPermissionsInOrder(requesters = {}) {
  const failures = []

  for (const permission of NATIVE_PERMISSION_ORDER) {
    const request = requesters[permission]
    if (typeof request !== 'function') continue

    try {
      await request()
    } catch (error) {
      failures.push({ permission, error })
    }
  }

  return failures
}

function isPermissionGranted(value) {
  return value === 'granted' || value === 'limited'
}

async function requestPermissionIfNeeded(plugin, permission, options) {
  const status = await plugin.checkPermissions()
  if (isPermissionGranted(status?.[permission])) return
  await plugin.requestPermissions(options)
}

export async function requestOnboardingDevicePermissions(dependencies = {}) {
  const capacitor = dependencies.capacitor ?? Capacitor
  if (!capacitor.isNativePlatform()) return []

  const contacts = dependencies.contacts ?? Contacts
  const camera = dependencies.camera ?? Camera
  const geolocation = dependencies.geolocation ?? Geolocation
  const speechRecognition = dependencies.speechRecognition ?? SpeechRecognition

  return requestPermissionsInOrder({
    contacts: () => requestPermissionIfNeeded(contacts, 'contacts'),
    camera: () => requestPermissionIfNeeded(camera, 'camera', { permissions: ['camera'] }),
    location: () =>
      requestPermissionIfNeeded(geolocation, 'location', { permissions: ['location'] }),
    microphone: () => requestPermissionIfNeeded(speechRecognition, 'speechRecognition'),
  })
}
