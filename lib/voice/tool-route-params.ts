const OPAQUE_VOICE_ROUTE_PARAM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const CANONICAL_VOICE_LANGUAGE_PATTERN = /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/

/**
 * Voice and public-model ids are opaque catalog identifiers. Never interpret
 * or partially repair an invalid value received through metadata or a URL.
 */
export function getOpaqueVoiceRouteParam(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized || normalized.length > 255) return null
  return OPAQUE_VOICE_ROUTE_PARAM_PATTERN.test(normalized) ? normalized : null
}

/** Mirrors the Voice Catalog's canonical, lower-case BCP-47-like language. */
export function getCanonicalVoiceLanguageRouteParam(value: string | null | undefined) {
  const normalized = value?.trim().replaceAll('_', '-').toLowerCase()
  if (!normalized || normalized.length > 63) return null
  return CANONICAL_VOICE_LANGUAGE_PATTERN.test(normalized) ? normalized : null
}
