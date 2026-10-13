export type LanguageDisplay = {
  code: string
  flagRegion: string | null
  label: string
}

export function canonicalizeLanguageDisplayCode(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replaceAll('_', '-')
  if (!normalized) return null
  if (normalized.toLowerCase() === 'auto') return 'auto'
  try {
    return Intl.getCanonicalLocales(normalized)[0] ?? normalized
  } catch {
    return null
  }
}

export function formatLanguageDisplayCode(value: unknown) {
  const canonical = canonicalizeLanguageDisplayCode(value)
  return canonical ? canonical.toLocaleUpperCase('en-US') : ''
}

export function getLanguageFlagRegion(value: unknown) {
  const canonical = canonicalizeLanguageDisplayCode(value)
  if (!canonical || canonical === 'auto') return null
  try {
    const locale = new Intl.Locale(canonical)
    const region = locale.region ?? locale.maximize().region
    return region && /^[A-Z]{2}$/.test(region) ? region : null
  } catch {
    return null
  }
}

export function isLanguageSelectionFieldName(value: unknown) {
  if (typeof value !== 'string') return false
  const normalized = value.trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized === 'language'
    || normalized.endsWith('_language')
    || normalized.endsWith('_language_code')
}

export function getLocalizedLanguageName(value: unknown, displayLocale = 'en', fallback?: string) {
  const canonical = canonicalizeLanguageDisplayCode(value)
  if (!canonical) return fallback?.trim() || String(value ?? '')
  if (canonical === 'auto') return fallback?.trim() || 'Auto'
  try {
    const name = new Intl.DisplayNames([displayLocale], {
      type: 'language',
      languageDisplay: 'standard',
    }).of(canonical)
    if (name && name.toLocaleLowerCase('en-US') !== canonical.toLocaleLowerCase('en-US')) return name
  } catch {
    // A provider label is the stable fallback for runtimes without DisplayNames.
  }
  return fallback?.trim() || canonical
}

export function getLanguageDisplay(
  value: unknown,
  fallbackLabel?: string,
  displayLocale = 'en',
): LanguageDisplay {
  const code = formatLanguageDisplayCode(value) || String(value ?? '').trim().toLocaleUpperCase('en-US')
  return {
    code,
    flagRegion: getLanguageFlagRegion(value),
    label: getLocalizedLanguageName(value, displayLocale, fallbackLabel),
  }
}
