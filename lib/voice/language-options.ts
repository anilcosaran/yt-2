import { getLanguageDisplay } from '@/lib/i18n/language-display'

export type VoiceLanguageOption = {
  value: string
  label: string
  languageLabel: string
  flagRegion: string | null
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/**
 * Normalize provider language metadata to a canonical BCP-47 language tag.
 * Underscores are accepted because a few provider catalogs still emit POSIX-style tags.
 */
export function canonicalizeVoiceLanguageCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replaceAll('_', '-')
  if (!normalized) return null

  try {
    return Intl.getCanonicalLocales(normalized)[0] ?? null
  } catch {
    return null
  }
}

function canonicalizeAndDedupe(values: readonly string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    const canonical = canonicalizeVoiceLanguageCode(value)
    if (!canonical) return
    const key = canonical.toLocaleLowerCase('en-US')
    if (seen.has(key)) return
    seen.add(key)
    result.push(canonical)
  })

  return result
}

/**
 * Read language constraints from either the workflow port-map shape or the
 * JSON-Schema/model-metadata shape returned by Discovery.
 *
 * An enum is an executable constraint, so it takes precedence over descriptive
 * root metadata when both are present. Root `supported_languages` then takes
 * precedence over the legacy `languages` key.
 */
export function deriveVoiceLanguageCodes(effectiveModelSchema: Record<string, unknown>) {
  const directLanguagePort = getRecord(effectiveModelSchema.language)
  const propertiesLanguagePort = getRecord(getRecord(effectiveModelSchema.properties).language)
  const candidateSources = [
    ...['allowed_values', 'enum', 'values', 'options'].map((key) => getStringArray(directLanguagePort[key])),
    getStringArray(propertiesLanguagePort.enum),
    getStringArray(effectiveModelSchema.supported_languages),
    getStringArray(effectiveModelSchema.languages),
  ]

  for (const candidates of candidateSources) {
    const canonical = canonicalizeAndDedupe(candidates)
    if (canonical.length > 0) return canonical
  }

  return []
}

/** Build display-ready options without exposing a provider name. */
export function buildVoiceLanguageOptions(
  effectiveModelSchema: Record<string, unknown>,
  displayLocale = 'en',
): VoiceLanguageOption[] {
  return deriveVoiceLanguageCodes(effectiveModelSchema).map((value) => {
    const display = getLanguageDisplay(value, undefined, displayLocale)
    return {
      value,
      flagRegion: display.flagRegion,
      languageLabel: display.label,
      label: display.label,
    }
  })
}

/** Keep a valid current selection; otherwise prefer English and then the first option. */
export function chooseVoiceLanguageDefault(
  supportedLanguages: readonly (string | VoiceLanguageOption)[],
  currentValue?: unknown,
): string | null {
  const supported = canonicalizeAndDedupe(
    supportedLanguages.map((item) => typeof item === 'string' ? item : item.value),
  )
  const current = canonicalizeVoiceLanguageCode(currentValue)
  if (current) {
    const matchingCurrent = supported.find(
      (language) => language.toLocaleLowerCase('en-US') === current.toLocaleLowerCase('en-US'),
    )
    if (matchingCurrent) return matchingCurrent
  }

  return supported.find((language) => language === 'en') ?? supported[0] ?? null
}
