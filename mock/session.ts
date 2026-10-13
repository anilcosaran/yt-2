// The signed-in demo account every page sees. There is no real authentication in yt-2: you are signed in
// unless the `yt2_mock_signed_out` cookie is set (the sidebar's "Sign out" sets it, the login page clears it),
// so both the app and the login screen can be designed.

import type { AuthSessionData } from '@/lib/auth/schemas'

import { MOCK_TENANT } from './vocabulary'

export const MOCK_SIGNED_OUT_COOKIE = 'yt2_mock_signed_out'

export function mockTenant() {
  const now = new Date()
  return {
    id: MOCK_TENANT.id,
    name: MOCK_TENANT.name,
    email: MOCK_TENANT.email,
    preferred_locale: null,
    plan_type: 'pro' as const,
    account_status: 'active' as const,
    onboarding_completed: true,
    restriction_reason: null,
    plan_ends_at: new Date(now.getTime() + 21 * 24 * 3600 * 1000).toISOString(),
    billing_period: 'monthly',
    scheduled_cleanup_at: null,
    created_at: new Date(now.getTime() - 120 * 24 * 3600 * 1000).toISOString(),
    updated_at: now.toISOString(),
  }
}

export function mockAuthSession(): AuthSessionData {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return {
    tenant: mockTenant(),
    tokenMeta: { iat: nowSeconds, exp: nowSeconds + 3600 },
    authStrategy: { refreshHandledBy: 'mock', backendRole: 'owner' },
  }
}

export function setMockSignedOut(signedOut: boolean) {
  if (typeof document === 'undefined') return
  document.cookie = signedOut
    ? `${MOCK_SIGNED_OUT_COOKIE}=1; Path=/; SameSite=Lax`
    : `${MOCK_SIGNED_OUT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}
