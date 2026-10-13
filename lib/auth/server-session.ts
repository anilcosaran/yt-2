import 'server-only'

import { cookies } from 'next/headers'

import { MOCK_SIGNED_OUT_COOKIE, mockAuthSession } from '@/mock/session'

import type { AuthSessionData } from './schemas'

type AuthSessionOptions = {
  cacheTtlMs?: number
  timeoutMs?: number
}

/** yt-2: the demo account (mock/session.ts) is signed in unless the mock sign-out cookie is set. */
export async function getCurrentAuthSession(_options: AuthSessionOptions = {}): Promise<AuthSessionData | null> {
  const cookieStore = await cookies()
  if (cookieStore.get(MOCK_SIGNED_OUT_COOKIE)?.value) return null
  return mockAuthSession()
}
