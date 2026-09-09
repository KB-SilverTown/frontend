import { DEFAULT_EQ_PRESET, normalizeEqPreset } from '../model/eqPreset.js'

const STORAGE_PREFIX = 'gwipyeonhan.voice-eq-preset.v1'

export function eqPresetStorageKey(userId) {
  const value = String(userId ?? '').trim()
  return value ? `${STORAGE_PREFIX}.${encodeURIComponent(value)}` : null
}

function storage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** 이 기기 브라우저에만 저장하는 MVP 설정이다. 서버 voice-settings payload에는 넣지 않는다. */
export function loadEqPreset(userId) {
  const key = eqPresetStorageKey(userId)
  if (!key) return DEFAULT_EQ_PRESET
  try {
    return normalizeEqPreset(storage()?.getItem(key))
  } catch {
    return DEFAULT_EQ_PRESET
  }
}

export function saveEqPreset(userId, preset) {
  const key = eqPresetStorageKey(userId)
  const normalized = normalizeEqPreset(preset)
  if (!key) return normalized
  try {
    storage()?.setItem(key, normalized)
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 현재 세션에만 적용한다.
  }
  return normalized
}
