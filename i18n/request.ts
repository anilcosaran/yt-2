import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

import { isOriginRecordingHost } from '@/lib/avatar/origin-host'

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_REQUEST_HEADER,
  ORIGIN_LOCALE_COOKIE_NAME,
  normalizeLocale,
} from './config'
import { appFormats } from './formats'
import { getMessagesForLocale } from './messages'

export default getRequestConfig(async () => {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
  const originHost = isOriginRecordingHost(requestHeaders.get('host'))
  const locale = originHost
    ? normalizeLocale(cookieStore.get(ORIGIN_LOCALE_COOKIE_NAME)?.value)
      ?? normalizeLocale(requestHeaders.get(LOCALE_REQUEST_HEADER))
      ?? DEFAULT_LOCALE
    : normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value)
      ?? normalizeLocale(requestHeaders.get(LOCALE_REQUEST_HEADER))
      ?? DEFAULT_LOCALE

  return {
    locale,
    messages: getMessagesForLocale(locale),
    formats: appFormats,
    now: new Date(),
    timeZone: 'UTC',
    getMessageFallback: () => 'Not found',
  }
})
