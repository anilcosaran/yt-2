import { NextResponse, type NextRequest } from 'next/server'

import {
  LOCALE_COOKIE_NAME,
  LOCALE_REQUEST_HEADER,
  getLocaleFromAcceptLanguage,
  normalizeLocale,
} from '@/i18n/config'
import { setLocaleCookie } from '@/i18n/locale-cookie'
import { MOCK_SIGNED_OUT_COOKIE } from '@/mock/session'

// yt-2: no remote session check. Pages behind sign-in redirect to /login only while the mock sign-out
// cookie is set; locale negotiation works as in Youtorch.
const protectedPathPrefixes = [
  '/apps',
  '/areas',
  '/automation',
  '/brand',
  '/calendar',
  '/chat',
  '/channels',
  '/components',
  '/customers',
  '/dashboard',
  '/favorites',
  '/goals',
  '/inbox',
  '/library',
  '/memory',
  '/models',
  '/new',
  '/offer-plan',
  '/onboarding',
  '/recent',
  '/settings',
  '/spark',
  '/storage',
  '/tools',
  '/workflows',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(LOCALE_REQUEST_HEADER)
  const localeCookieValue = request.cookies.get(LOCALE_COOKIE_NAME)?.value
  const locale = normalizeLocale(localeCookieValue)
    ?? getLocaleFromAcceptLanguage(request.headers.get('accept-language'))
  requestHeaders.set(LOCALE_REQUEST_HEADER, locale)

  const isProtectedPath = protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const signedOut = Boolean(request.cookies.get(MOCK_SIGNED_OUT_COOKIE)?.value)

  let response: NextResponse
  if (isProtectedPath && signedOut) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    response = NextResponse.redirect(loginUrl)
  } else if (pathname === '/chat' && request.nextUrl.searchParams.has('new')) {
    // A new chat (`/chat?new=…`, `NEW_CHAT_QUERY_PARAM`) is a new project now: the new tab opens one (`/new`). Past
    // chats stay where they were (`/chat?id=…`).
    const newTab = request.nextUrl.clone()
    newTab.pathname = '/new'
    newTab.search = ''
    response = NextResponse.redirect(newTab)
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (localeCookieValue !== locale) setLocaleCookie(response, request, locale)
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|icon-light-32x32.png|icon-dark-32x32.png|apple-icon.png).*)'],
}
