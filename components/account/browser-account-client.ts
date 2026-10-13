'use client'

import { z } from 'zod'

import { gatewayRequest, resetGatewayAuthTransport } from '@/lib/gateway/client'
import type { AppLocale } from '@/i18n/config'

export interface AccountProfileTenant {
  client_mutation_scope?: string
  name: string
  email: string
  preferred_locale?: AppLocale | null
  picture_url?: string | null
  photo_url?: string | null
  avatar_url?: string | null
  plan_type?: string
  billing_period?: string | null
  plan_ends_at?: string | null
}

export const ACCOUNT_PROFILE_UPDATED_EVENT = 'youtorch:account-profile-updated'
export const ACCOUNT_PROFILE_QUERY_KEY = ['account', 'profile'] as const
export const ACCOUNT_PLAN_SYNC_UPDATED_EVENT = 'youtorch:account-plan-sync-updated'

const ACCOUNT_PLAN_SYNC_STORAGE_KEY = 'youtorch:account-plan-sync'
const ACCOUNT_PLAN_SYNC_MAX_AGE_MS = 10 * 60 * 1000

export interface AccountPlanSyncState {
  plan_type: string
  billing_period?: string | null
  updated_at: number
}

export const accountProfileTenantSchema = z
  .object({
    client_mutation_scope: z.string().regex(/^tenant-scope:v1:[A-Za-z0-9_-]{43}$/).optional(),
    name: z.string(),
    email: z.string(),
    preferred_locale: z.preprocess((value) => {
      if (typeof value !== 'string') return value
      const base = value.toLowerCase().split(/[-_]/, 1)[0]
      return base === 'en' || base === 'tr' ? base : value
    }, z.enum(['en', 'tr']).nullable().optional()),
    picture_url: z.string().nullable().optional(),
    photo_url: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
    plan_type: z.string().optional(),
    billing_period: z.string().nullable().optional(),
    plan_ends_at: z.string().nullable().optional(),
  })
  .passthrough()

export const accountProfileTenantPayloadSchema = z.union([
  accountProfileTenantSchema,
  z
    .object({
      props: accountProfileTenantSchema,
    })
    .passthrough()
    .transform((tenant) => tenant.props),
])

const updateTenantResponseSchema = z
  .object({
    data: z.union([
      z
        .object({
          tenant: accountProfileTenantPayloadSchema,
        })
        .passthrough()
        .transform((data) => data.tenant),
      accountProfileTenantPayloadSchema,
    ]),
  })
  .transform((payload) => payload.data)

const currentAccountResponseSchema = z
  .object({
    data: z
      .object({
        tenant: accountProfileTenantPayloadSchema,
      })
      .passthrough(),
  })
  .transform((payload) => payload.data.tenant)

export function resetBrowserAccountClientCaches() {
  resetGatewayAuthTransport()
}

export function createBrowserAccountClient(fetcher: typeof fetch = fetch) {
  return {
    async getCurrentProfile(options: { signal?: AbortSignal; timeoutMs?: number } = {}) {
      return gatewayRequest('/api/v1/auth/me', {
        schema: currentAccountResponseSchema,
        fetcher,
        ...options,
      })
    },
    async updateProfile(
      input: { name?: string; preferred_locale?: AppLocale },
      options: { signal?: AbortSignal; timeoutMs?: number } = {},
    ) {
      return gatewayRequest('/api/v1/tenants/me', {
        method: 'PUT',
        body: input,
        schema: updateTenantResponseSchema,
        csrf: true,
        fetcher,
        ...options,
      })
    },
  }
}

export function readAccountPlanSyncState(now = Date.now()): AccountPlanSyncState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(ACCOUNT_PLAN_SYNC_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<AccountPlanSyncState>
    if (!parsed.plan_type || typeof parsed.plan_type !== 'string') {
      clearAccountPlanSyncState(false)
      return null
    }

    const updatedAt = Number(parsed.updated_at)
    if (!Number.isFinite(updatedAt) || now - updatedAt > ACCOUNT_PLAN_SYNC_MAX_AGE_MS) {
      clearAccountPlanSyncState(false)
      return null
    }

    return {
      plan_type: parsed.plan_type,
      billing_period: parsed.billing_period ?? null,
      updated_at: updatedAt,
    }
  } catch {
    clearAccountPlanSyncState(false)
    return null
  }
}

export function saveAccountPlanSyncState(input: {
  planType: string
  billingPeriod?: string | null
}): AccountPlanSyncState | null {
  if (typeof window === 'undefined') return null

  const state: AccountPlanSyncState = {
    plan_type: input.planType,
    billing_period: input.billingPeriod ?? null,
    updated_at: Date.now(),
  }

  try {
    window.localStorage.setItem(ACCOUNT_PLAN_SYNC_STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent<AccountPlanSyncState>(ACCOUNT_PLAN_SYNC_UPDATED_EVENT, { detail: state }))
    return state
  } catch {
    return null
  }
}

export function clearAccountPlanSyncState(emit = true) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(ACCOUNT_PLAN_SYNC_STORAGE_KEY)
  } catch {
    // Local storage is best-effort only.
  }

  if (emit) {
    window.dispatchEvent(new CustomEvent<AccountPlanSyncState | null>(ACCOUNT_PLAN_SYNC_UPDATED_EVENT, { detail: null }))
  }
}

export function applyAccountPlanSync(
  profile: AccountProfileTenant | null | undefined,
  syncState: AccountPlanSyncState | null,
): AccountProfileTenant | null {
  if (!profile) return null
  if (!syncState) return profile

  return {
    ...profile,
    plan_type: syncState.plan_type,
    billing_period: syncState.billing_period ?? profile.billing_period,
  }
}
