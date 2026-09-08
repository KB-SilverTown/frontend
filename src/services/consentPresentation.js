import {
  CONSENT_DEFINITIONS,
  CONSENT_DOCUMENT_VERSION,
} from '@/features/onboarding/contract.js'

function consentSource(value) {
  const source = value?.consents ?? value?.items ?? value?.data ?? value
  return source && typeof source === 'object' ? source : []
}

function consentType(value) {
  return String(value?.type ?? value?.consentType ?? value?.code ?? '').trim()
}

function consentAgreed(value) {
  return value?.agreed ?? value?.consented ?? value?.enabled ?? value?.accepted ?? false
}

export function normalizeConsentState(value) {
  const source = consentSource(value)
  const state = Object.fromEntries(
    CONSENT_DEFINITIONS.map(({ type, required }) => [type, required]),
  )

  if (Array.isArray(source)) {
    for (const item of source) {
      const type = consentType(item)
      if (type in state) state[type] = Boolean(consentAgreed(item))
    }
    return state
  }

  for (const { type } of CONSENT_DEFINITIONS) {
    if (type in source) state[type] = Boolean(source[type])
  }

  return state
}

export function presentConsents(value) {
  const state = normalizeConsentState(value)
  return CONSENT_DEFINITIONS.map((definition) => ({
    ...definition,
    agreed: state[definition.type],
  }))
}

export function buildConsentUpdate(consents) {
  return {
    consents: CONSENT_DEFINITIONS.map(({ type }) => ({
      type,
      agreed: Boolean(consents?.find((consent) => consent.type === type)?.agreed),
      documentVersion: CONSENT_DOCUMENT_VERSION,
    })),
  }
}
