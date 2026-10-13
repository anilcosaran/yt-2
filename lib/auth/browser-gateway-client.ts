'use client'

import {
  authLogoutResponseSchema,
  authRegisterResponseSchema,
  authSessionResponseSchema,
} from './schemas'
import { gatewayRequest } from '@/lib/gateway/client'

export type BrowserAuthGatewayClient = ReturnType<typeof createBrowserAuthGatewayClient>

type BrowserAuthRequestOptions = { signal?: AbortSignal; timeoutMs?: number }

export function createBrowserAuthGatewayClient(fetcher: typeof fetch = fetch) {
  return {
    async register(
      idToken: string,
      input: { name?: string } = {},
      options: BrowserAuthRequestOptions = {},
    ) {
      const result = await gatewayRequest('/api/v1/auth/register', {
        method: 'POST',
        body: { name: input.name },
        schema: authRegisterResponseSchema,
        headers: { authorization: `Bearer ${idToken}` },
        fetcher,
        ...options,
      })

      return {
        data: {
          tenant: result.data.tenant,
          requiresTokenRefresh: true as const,
        },
      }
    },
    async createSession(
      idToken: string,
      input: { requireOwnerClaim?: boolean } = {},
      options: BrowserAuthRequestOptions = {},
    ) {
      return gatewayRequest('/api/v1/auth/session', {
        method: 'POST',
        body: { require_owner_claim: input.requireOwnerClaim },
        schema: authSessionResponseSchema,
        headers: { authorization: `Bearer ${idToken}` },
        fetcher,
        ...options,
      })
    },
    async logout(options: BrowserAuthRequestOptions = {}) {
      return gatewayRequest('/api/v1/auth/logout', {
        method: 'POST',
        schema: authLogoutResponseSchema,
        csrf: true,
        fetcher,
        ...options,
      })
    },
  }
}
