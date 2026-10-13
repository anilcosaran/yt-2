import { NextRequest, NextResponse } from 'next/server'

import { normalizeLocale } from '@/i18n/config'
import { setLocaleCookie, setOriginLocaleCookie } from '@/i18n/locale-cookie'
import { isOriginRecordingHost } from '@/lib/avatar/origin-host'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'LOCALE_REQUEST_INVALID', message: 'Locale request was invalid.' } },
      { status: 400 },
    )
  }

  const locale = normalizeLocale(
    body && typeof body === 'object' && 'locale' in body
      ? String(body.locale)
      : null,
  )
  if (!locale) {
    return NextResponse.json(
      { error: { code: 'LOCALE_UNSUPPORTED', message: 'Locale is not supported.' } },
      { status: 400 },
    )
  }

  const response = NextResponse.json({ data: { locale } })
  if (isOriginRecordingHost(request.nextUrl.hostname) || isOriginRecordingHost(request.headers.get('host'))) {
    setOriginLocaleCookie(response, request, locale)
  } else {
    setLocaleCookie(response, request, locale)
  }
  return response
}
