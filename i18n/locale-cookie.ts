import type { NextRequest, NextResponse } from 'next/server'

import {
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
  ORIGIN_LOCALE_COOKIE_NAME,
  type AppLocale,
} from './config'

export function setLocaleCookie(
  response: NextResponse,
  request: NextRequest,
  locale: AppLocale,
) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: 'lax',
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    ...getDomainCookieOption(request),
  })
}

export function setOriginLocaleCookie(
  response: NextResponse,
  request: NextRequest,
  locale: AppLocale,
) {
  response.cookies.set(ORIGIN_LOCALE_COOKIE_NAME, locale, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: 'lax',
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
  })
}

function shouldUseSecureCookie(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  return forwardedProto === 'https'
    || request.nextUrl.protocol === 'https:'
    || process.env.NODE_ENV === 'production'
}

function getDomainCookieOption(request: NextRequest): { domain?: string } {
  const hostname = request.nextUrl.hostname.toLowerCase()
  if (hostname === 'youtorch.io' || hostname.endsWith('.youtorch.io')) {
    return { domain: '.youtorch.io' }
  }
  return {}
}
