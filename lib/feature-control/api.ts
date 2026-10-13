'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

export const MY_FEATURE_LIMITS_QUERY_KEY = ['feature-control', 'my-limits'] as const
export const MY_QUOTA_GRANTS_QUERY_KEY = ['feature-control', 'my-quotas'] as const

const featureLimitSchema = z.object({
  key: z.string(),
  name: z.string(),
  value: z.coerce.number(),
  has_override: z.boolean().catch(false),
  expires_at: z.string().nullable().catch(null),
})

const quotaGrantSchema = z.object({
  key: z.string(),
  name: z.string(),
  amount: z.coerce.number(),
  period: z.string(),
  carryover: z.boolean().catch(false),
  has_override: z.boolean().catch(false),
  expires_at: z.string().nullable().catch(null),
})

const myFeatureLimitsResponseSchema = z.object({
  data: z.object({
    plan_type: z.string(),
    features: z.array(featureLimitSchema).catch([]),
  }).catch({ plan_type: 'current', features: [] }),
})

const myQuotaGrantsResponseSchema = z.object({
  data: z.object({
    plan_type: z.string(),
    quotas: z.array(quotaGrantSchema).catch([]),
  }).catch({ plan_type: 'current', quotas: [] }),
})

export type FeatureLimit = z.infer<typeof featureLimitSchema>
export type QuotaGrant = z.infer<typeof quotaGrantSchema>

export async function getMyFeatureLimits() {
  const result = await gatewayRequest('/api/v1/features/my/limits', {
    schema: myFeatureLimitsResponseSchema,
  })
  return result.data
}

export async function getMyQuotaGrants() {
  const result = await gatewayRequest('/api/v1/features/my/quotas', {
    schema: myQuotaGrantsResponseSchema,
  })
  return result.data
}
