export const SUPPORTED_LOCALES = ['en', 'tr'] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'en'
export const LOCALE_COOKIE_NAME = 'youtorch_locale'
export const ORIGIN_LOCALE_COOKIE_NAME = 'youtorch_origin_locale'
export const LOCALE_REQUEST_HEADER = 'x-youtorch-locale'
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  const language = value?.trim().toLowerCase().split(/[-_]/, 1)[0]
  if (language && (SUPPORTED_LOCALES as readonly string[]).includes(language)) {
    return language as AppLocale
  }
  return null
}

export function getLocaleFromAcceptLanguage(value: string | null | undefined): AppLocale {
  if (!value) return DEFAULT_LOCALE

  const preferredLanguage = value
    .split(',')
    .map((entry, index) => {
      const [rawLanguage, ...parameters] = entry.trim().split(';')
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='))
      const quality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1

      return {
        index,
        language: normalizeLocale(rawLanguage),
        quality: Number.isFinite(quality) ? quality : 0,
      }
    })
    .filter((entry) => entry.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)[0]

  return preferredLanguage?.language ?? DEFAULT_LOCALE
}
