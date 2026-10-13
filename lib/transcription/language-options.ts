import { getLanguageDisplay } from '@/lib/i18n/language-display'

export type TranscriptionLanguageOption = {
  value: string
  label: string
  description?: string
  flagRegion?: string | null
  code?: string
}

type PublishedLanguage = {
  value: string
  label?: string
}

const EXPLICIT_HINT_KEYS = [
  'supported_language_hints',
  'source_language_hints',
  'supported_source_language_hints',
] as const

const FALLBACK_LANGUAGE_KEYS = [
  'source_languages',
  'supported_source_languages',
] as const

const LANGUAGE_LIST_KEYS = [
  'allowed_values',
  'enum',
  'values',
  'options',
  'languages',
  'codes',
  'supported',
  'hints',
] as const

const LANGUAGE_CODE_KEYS = ['value', 'code', 'id', 'language', 'language_code'] as const
const LANGUAGE_LABEL_KEYS = ['label', 'name', 'display_name'] as const
const CAPABILITY_MARKERS = new Set([
  'auto_or_iso_639_1',
  'auto_or_iso639_1',
  'iso_639_1',
  'iso639_1',
  'bcp_47',
  'bcp47',
  'provider_native',
])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function readString(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function isLanguageCode(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized.length > 64) return false
  if (normalized.toLowerCase() === 'auto') return true
  if (CAPABILITY_MARKERS.has(normalized.toLowerCase())) return false
  return /^[a-z]{2,8}(?:[-_][a-z0-9]{1,8})*$/i.test(normalized)
}

function readPublishedLanguages(value: unknown, depth = 0): PublishedLanguage[] {
  if (depth > 3) return []
  if (typeof value === 'string') {
    const code = value.trim()
    return isLanguageCode(code) ? [{ value: code }] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => readPublishedLanguages(item, depth + 1))
  }

  const record = asRecord(value)
  if (Object.keys(record).length === 0) return []
  const code = readString(record, LANGUAGE_CODE_KEYS)
  if (code && isLanguageCode(code)) {
    return [{ value: code, label: readString(record, LANGUAGE_LABEL_KEYS) }]
  }

  return LANGUAGE_LIST_KEYS.flatMap((key) => readPublishedLanguages(record[key], depth + 1))
}

function sourceLanguagePort(schema: Record<string, unknown>) {
  const direct = asRecord(schema.source_language)
  if (Object.keys(direct).length > 0) return direct
  return asRecord(asRecord(schema.properties).source_language)
}

function comparisonKey(value: string) {
  return value.trim().replaceAll('_', '-').toLowerCase()
}

function dedupePublishedLanguages(values: PublishedLanguage[]) {
  const seen = new Set<string>()
  const result: PublishedLanguage[] = []
  values.forEach((item) => {
    const value = item.value.trim()
    const key = comparisonKey(value)
    if (!value || seen.has(key)) return
    seen.add(key)
    result.push({ value: key === 'auto' ? 'auto' : value, label: item.label })
  })
  return result
}

function readAutoSupport(schemas: readonly Record<string, unknown>[]) {
  for (const schema of schemas) {
    for (const key of ['supports_auto_detection', 'supports_auto_language_detection', 'supports_auto']) {
      if (schema[key] === false) return false
      if (schema[key] === true) return true
    }
    const port = sourceLanguagePort(schema)
    if (port.supports_auto_detection === false || port.supports_auto === false) return false
    if (port.supports_auto_detection === true || port.supports_auto === true) return true
  }
  return true
}

/**
 * Returns only explicit language hints published by the selected model contract.
 * Capability markers such as `auto_or_iso_639_1` are deliberately not expanded
 * into a UI-owned language list.
 */
export function deriveTranscriptionLanguageHints(
  ...rawSchemas: Array<Record<string, unknown> | null | undefined>
) {
  const schemas = rawSchemas.filter((schema): schema is Record<string, unknown> => Boolean(schema))
  const direct = schemas.map((schema) => readPublishedLanguages(sourceLanguagePort(schema)))
    .find((languages) => languages.length > 0) ?? []
  const explicit = schemas.map((schema) => (
    EXPLICIT_HINT_KEYS.flatMap((key) => readPublishedLanguages(schema[key]))
  )).find((languages) => languages.length > 0) ?? []
  const fallback = schemas.map((schema) => (
    FALLBACK_LANGUAGE_KEYS.flatMap((key) => readPublishedLanguages(schema[key]))
  )).find((languages) => languages.length > 0) ?? []
  // Explicit hints are authoritative; the input port may be a broader generic allowlist.
  // Unioning both would expose request hints unsupported by the selected model.
  const published = explicit.length > 0
    ? explicit
    : fallback.length > 0 ? fallback : direct
  const withoutAuto = dedupePublishedLanguages(published)
    .filter((language) => comparisonKey(language.value) !== 'auto')

  return {
    supportsAuto: readAutoSupport(schemas),
    languages: withoutAuto,
  }
}

function canonicalDisplayCode(value: string) {
  const normalized = value.replaceAll('_', '-')
  try {
    return Intl.getCanonicalLocales(normalized)[0] ?? normalized
  } catch {
    return normalized
  }
}

function localizedLanguageName(code: string, displayLocale: string, fallback?: string) {
  try {
    const name = new Intl.DisplayNames([displayLocale], { type: 'language' }).of(code)
    if (name && comparisonKey(name) !== comparisonKey(code)) return name
  } catch {
    // Provider-published label/code remains a safe fallback.
  }
  return fallback?.trim() || code
}

export function buildTranscriptionLanguageOptions(
  schemas: Array<Record<string, unknown> | null | undefined>,
  displayLocale = 'en',
): TranscriptionLanguageOption[] {
  const capability = deriveTranscriptionLanguageHints(...schemas)
  const options = capability.languages.map((language) => {
    const displayCode = canonicalDisplayCode(language.value)
    const name = localizedLanguageName(displayCode, displayLocale, language.label)
    const display = getLanguageDisplay(displayCode, name, displayLocale)
    return {
      value: language.value,
      label: display.label,
      code: display.code,
      flagRegion: display.flagRegion,
    }
  })

  return capability.supportsAuto
    ? [{
        value: 'auto',
        label: 'Auto',
        description: 'Detect the spoken language from the source audio.',
        code: 'AUTO',
        flagRegion: null,
      }, ...options]
    : options
}

export function resolvePublishedTranscriptionLanguage(
  value: unknown,
  options: readonly TranscriptionLanguageOption[],
) {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : 'auto'
  return options.find((option) => comparisonKey(option.value) === comparisonKey(requested))?.value ?? null
}

export function isPublishedTranscriptionLanguage(
  value: unknown,
  options: readonly TranscriptionLanguageOption[],
) {
  return resolvePublishedTranscriptionLanguage(value, options) !== null
}
