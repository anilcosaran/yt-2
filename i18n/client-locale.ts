'use client'

import { normalizeLocale, type AppLocale } from './config'

export async function saveLocaleCookie(
  locale: AppLocale,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher('/api/locale', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locale }),
  })

  if (!response.ok) throw new Error('LOCALE_COOKIE_SAVE_FAILED')
}

export async function syncPreferredLocaleCookie(
  preferredLocale: string | null | undefined,
  fetcher: typeof fetch = fetch,
): Promise<AppLocale | null> {
  const locale = normalizeLocale(preferredLocale)
  if (!locale) return null

  await saveLocaleCookie(locale, fetcher)
  return locale
}
