'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'
import { readBrowserPrincipalScope, registerBrowserPrincipalLifecycleResetter } from '@/lib/auth/browser-principal-storage'
import { ClientMutationAttemptStore, isAmbiguousMutationError, stableClientFingerprint } from '@/lib/idempotency/client-mutation-control'
import { clientMarketCacheSegment, withClientMarketQuery } from '@/lib/offer/client-market'

const sanitizePriceCaption = (value: string | null) => {
  const normalized = value?.trim() ?? ''
  return normalized && !/^\d+(?:[.,]\d+)?$/.test(normalized) ? normalized : null
}

export const billingPeriodSchema = z.enum(['monthly', 'quarterly', 'yearly'])
export const MY_OFFERS_QUERY_KEY = ['offer', 'my-offers'] as const
export type BillingPeriod = z.infer<typeof billingPeriodSchema>

const offerPricingSchema = z.object({
  currency: z.string(),
  original_price: z.number(),
  discounted_price: z.number(),
  discount_percent: z.number(),
  credit_equivalent: z.number(),
  billing_period: billingPeriodSchema,
  stripe_product_id: z.string().nullable().catch(null),
  stripe_price_id: z.string().nullable().catch(null),
})

const displayItemSchema = z.object({
  source: z.enum(['feature_limit', 'quota_grant', 'manual']),
  key: z.string().optional(),
  label: z.string().optional(),
  label_override: z.string().nullable().optional(),
  badge_text: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  included: z.boolean().catch(true),
  emphasis: z.enum(['normal', 'muted', 'strong']).catch('normal'),
})

const displaySectionConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  caption: z.string().nullable().catch(null),
  badge_text: z.string().nullable().catch(null),
  emphasis: z.enum(['normal', 'muted', 'strong']).catch('normal'),
  items: z.array(displayItemSchema).catch([]),
})

const catalogWidgetSchema = z.object({
  enabled: z.boolean().catch(false),
  position: z.enum(['left', 'right']).catch('right'),
  title: z.string().nullable().catch(null),
  description: z.string().nullable().catch(null),
  locales: z.record(z.object({
    title: z.string().nullable().catch(null),
    description: z.string().nullable().catch(null),
  })).catch({}),
  background_color: z.string().nullable().catch(null),
  text_color: z.string().nullable().catch(null),
  accent_color: z.string().nullable().catch(null),
  countdown_style: z.enum(['digital', 'flip', 'ring', 'minimal']).catch('digital'),
  show_countdown: z.boolean().catch(true),
  show_confetti: z.boolean().catch(false),
  show_shimmer: z.boolean().catch(false),
  media_kind: z.enum(['none', 'image', 'video']).catch('none'),
  media_url: z.string().nullable().catch(null),
  replace_countdown_with_media: z.boolean().catch(false),
}).nullable().catch(null)

const displayConfigSchema = z.object({
  display_items: z.array(displayItemSchema).catch([]),
  sections: z.array(displaySectionConfigSchema).catch([]),
  catalog_widget: catalogWidgetSchema,
  show_savings: z.boolean().catch(true),
  savings_label: z.string().nullable().catch(null),
  price_caption: z.string().nullable().catch(null).transform(sanitizePriceCaption),
  renewal_note: z.string().nullable().catch(null),
  value_summary_gbp: z.number().nullable().catch(null),
  badge_text: z.string().nullable().catch(null),
  show_quota_details: z.boolean().catch(false),
  show_feature_limits: z.boolean().catch(false),
}).catch({
  display_items: [],
  sections: [],
  catalog_widget: null,
  show_savings: true,
  savings_label: null,
  price_caption: null,
  renewal_note: null,
  value_summary_gbp: null,
  badge_text: null,
  show_quota_details: false,
  show_feature_limits: false,
})

const resolvedDisplayItemSchema = z.object({
  source: z.enum(['feature_limit', 'quota_grant', 'manual']),
  key: z.string().nullable(),
  label: z.string(),
  included: z.boolean().catch(true),
  emphasis: z.enum(['normal', 'muted', 'strong']).catch('normal'),
  value: z.number().nullable().catch(null),
  unit: z.string().nullable().catch(null),
  display_order: z.number().catch(999),
  badge_text: z.string().nullable().catch(null),
  caption: z.string().nullable().catch(null),
})

const resolvedDisplaySectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  caption: z.string().nullable().catch(null),
  badge_text: z.string().nullable().catch(null),
  emphasis: z.enum(['normal', 'muted', 'strong']).catch('normal'),
  items: z.array(resolvedDisplayItemSchema).catch([]),
})

const planPeriodSchema = z.object({
  billing_period: billingPeriodSchema,
  offer_id: z.string(),
  offer_kind: z.enum(['default', 'promo']).catch('default'),
  pricing: offerPricingSchema,
  display_config: displayConfigSchema,
  display_items: z.array(resolvedDisplayItemSchema).catch([]),
  display_sections: z.array(resolvedDisplaySectionSchema).catch([]),
  quota_overrides: z.array(z.unknown()).catch([]),
  feature_overrides: z.record(z.number()).catch({}),
  grant_balance_credits: z.number().catch(0),
  lifecycle_type: z.string(),
  max_renewals: z.number().nullable(),
  valid_until: z.string().datetime({ offset: true }).nullable().catch(null),
}).nullable()

const periodsSchema = z.object({
  monthly: planPeriodSchema,
  quarterly: planPeriodSchema,
  yearly: planPeriodSchema,
})

export const planPackageSchema = z.object({
  base_plan: z.string(),
  name: z.string(),
  description: z.string(),
  sort_order: z.number(),
  periods: periodsSchema,
  has_active_subscription: z.boolean(),
  is_current_plan: z.boolean(),
  transition_info: z.unknown().nullable(),
})

const publicPlanCatalogItemSchema = z.object({
  base_plan: z.string(),
  name: z.string(),
  description: z.string(),
  sort_order: z.number(),
  periods: periodsSchema,
})

const pendingPlanChangeSchema = z.object({
  purchase_intent_id: z.string(),
  offer_id: z.string(),
  target_plan: z.string(),
  target_billing_period: billingPeriodSchema,
  scheduled_for: z.string(),
  charge_amount: z.number(),
  currency: z.string(),
  can_cancel: z.boolean(),
}).nullable().catch(null)

const giftEndedSchema = z.object({
  ended: z.boolean(),
  previous_offer_id: z.string().nullable().catch(null),
  previous_plan: z.string().nullable().catch(null),
  ended_at: z.string().datetime({ offset: true }).nullable().catch(null),
  requires_customer_purchase: z.boolean().catch(false),
  login_redirect: z.boolean().catch(false),
}).catch({
  ended: false,
  previous_offer_id: null,
  previous_plan: null,
  ended_at: null,
  requires_customer_purchase: false,
  login_redirect: false,
})

const personalOfferSchema = z.object({
  assignment_id: z.string(),
  offer_id: z.string(),
  valid_until: z.string().datetime({ offset: true }).nullable().catch(null),
  presented_at: z.string().datetime({ offset: true }).nullable().catch(null),
  dismissed_at: z.string().datetime({ offset: true }).nullable().catch(null),
  auto_popup: z.boolean().catch(false),
}).nullable().catch(null)

const clientMarketSchema = z.object({
  country: z.string().nullable().catch(null),
  source: z.string().catch('global'),
}).catch({ country: null, source: 'global' })
const planPackagesResponseSchema = z.object({
  data: z.object({
    packages: z.array(planPackageSchema),
    current_plan: z.string(),
    current_billing_period: billingPeriodSchema.nullable().catch(null),
    current_plan_ends_at: z.string().datetime({ offset: true }).nullable().catch(null),
    pending_change: pendingPlanChangeSchema,
    gift_ended: giftEndedSchema,
    personal_offer: personalOfferSchema,
    view_context_id: z.string().catch(''),
    server_now: z.string().datetime({ offset: true }).catch(() => new Date().toISOString()),
    client_market: clientMarketSchema,
  }),
})

const publicPlanCatalogResponseSchema = z.object({
  data: z.object({
    plans: z.array(publicPlanCatalogItemSchema),
    client_market: clientMarketSchema.optional(),
  }),
})

const refreshOnboardingAssignmentResponseSchema = z.object({
  data: z.object({
    assigned_offer_ids: z.array(z.string()),
  }),
})

const redeemOfferResponseSchema = z.object({
  data: z.union([
    z.object({
      action: z.literal('redeemed'),
      tenantOffer: z.unknown(),
    }),
    z.object({
      action: z.literal('requires_payment_confirmation'),
      purchase_intent_id: z.string(),
      payment_intent_id: z.string(),
      client_secret: z.string(),
      amount_gbp: z.number(),
      currency: z.string(),
      expires_at: z.string().datetime({ offset: true }).optional().catch(undefined),
      activation_mode: z.literal('immediate').catch('immediate'),
    }),
    z.object({
      action: z.literal('scheduled'),
      purchase_intent_id: z.string(),
      offer_id: z.string(),
      base_plan: z.string(),
      billing_period: billingPeriodSchema,
      scheduled_for: z.string(),
      activation_mode: z.literal('period_end'),
    }),
  ]),
})

const completeOfferPurchaseResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    tenant_offer_id: z.string().nullable(),
    error_message: z.string().nullable(),
  }),
})

const purchaseStatusResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    purchase_intent_id: z.string().nullable(),
    offer_id: z.string().nullable(),
    tenant_offer_id: z.string().nullable(),
    error_message: z.string().nullable(),
    decline_code: z.string().nullable(),
    activation_mode: z.enum(['immediate', 'period_end']).nullable().catch(null),
    scheduled_for: z.string().nullable().catch(null),
    target_plan: z.string().nullable().catch(null),
    target_billing_period: billingPeriodSchema.nullable().catch(null),
    charge_amount: z.number().nullable().catch(null),
    currency: z.string().nullable().catch(null),
    can_cancel_pending_change: z.boolean().catch(false),
    expires_at: z.string().datetime({ offset: true }).nullable().catch(null),
  }),
})

export const myOfferSchema = z.object({
  id: z.string(),
  offer_id: z.string(),
  status: z.string(),
  started_at: z.string().or(z.date()).transform((value) => value instanceof Date ? value.toISOString() : value),
  expires_at: z.string().or(z.date()).transform((value) => value instanceof Date ? value.toISOString() : value),
  effective_cancellation_at: z.string().or(z.date()).nullable().transform((value) => {
    if (!value) return null
    return value instanceof Date ? value.toISOString() : value
  }),
  renewals_used: z.number().catch(0),
  max_renewals: z.number().nullable().catch(null),
  lifecycle_type: z.string(),
  pricing_snapshot: offerPricingSchema,
  quota_snapshot: z.array(z.unknown()).catch([]),
  feature_snapshot: z.record(z.number()).catch({}),
  grant_balance_credits: z.number().catch(0),
  source: z.string(),
  created_at: z.string().or(z.date()).transform((value) => value instanceof Date ? value.toISOString() : value),
}).passthrough()

const myOffersResponseSchema = z.object({
  data: z.object({
    tenant_offers: z.array(myOfferSchema).catch([]),
  }),
})

const tenantOfferMutationResponseSchema = z.object({
  data: z.object({
    tenantOffer: z.unknown().optional(),
  }).passthrough(),
})

let publicPlanCatalogCache: {
  market: string
  expiresAt: number
  result: z.output<typeof publicPlanCatalogResponseSchema>
} | null = null
let publicPlanCatalogRequest: Promise<z.output<typeof publicPlanCatalogResponseSchema>> | null = null
let publicPlanCatalogRequestMarket: string | null = null
let publicPlanCatalogRequestSequence = 0
const PUBLIC_PLAN_CATALOG_CACHE_MS = 60_000

export type PlanPackage = z.infer<typeof planPackageSchema>
export type PlanPackagePeriod = NonNullable<PlanPackage['periods'][BillingPeriod]>
export type PendingPlanChange = NonNullable<z.infer<typeof pendingPlanChangeSchema>>
export type GiftEndedContext = z.infer<typeof giftEndedSchema>
export type PersonalOfferWindow = NonNullable<z.infer<typeof personalOfferSchema>>
export type PublicPlanCatalogItem = z.infer<typeof publicPlanCatalogItemSchema>
export type RedeemOfferResult = z.infer<typeof redeemOfferResponseSchema>['data']
export type CompleteOfferPurchaseResult = z.infer<typeof completeOfferPurchaseResponseSchema>['data']
export type OfferPurchaseStatus = z.infer<typeof purchaseStatusResponseSchema>['data']
export type MyOffer = z.infer<typeof myOfferSchema>

export async function refreshOnboardingAssignment() {
  return gatewayRequest('/api/v1/offer/refresh-onboarding-assignment', {
    method: 'POST',
    csrf: true,
    schema: refreshOnboardingAssignmentResponseSchema,
  })
}

export async function getPlanPackages() {
  return gatewayRequest(withClientMarketQuery('/api/v1/offer/plan-packages'), {
    schema: planPackagesResponseSchema,
  })
}

const pageExitResponseSchema = z.object({
  data: z.object({
    assigned_offer_ids: z.array(z.string()).catch([]),
    assignment: z.object({
      assignment_id: z.string(),
      offer_id: z.string(),
      valid_until: z.string().datetime({ offset: true }).nullable().catch(null),
      generation: z.union([z.string(), z.number()]).optional(),
      presented_at: z.string().datetime({ offset: true }).nullable().catch(null),
      dismissed_at: z.string().datetime({ offset: true }).nullable().catch(null),
      trigger_type: z.string().optional(),
    }).nullable().catch(null),
    server_now: z.string().datetime({ offset: true }).optional(),
  }),
})

const assignmentPresentationResponseSchema = z.object({
  data: z.object({
    assignment_id: z.string(),
    presented_at: z.string().datetime({ offset: true }).nullable().catch(null),
    dismissed_at: z.string().datetime({ offset: true }).nullable().catch(null),
  }),
})

export type PageExitResult = z.infer<typeof pageExitResponseSchema>['data']

export async function postOfferPageExit(input: { view_context_id: string; idempotency_key: string }) {
  const result = await gatewayRequest(withClientMarketQuery('/api/v1/offer/page-exit'), {
    method: 'POST',
    csrf: true,
    body: input,
    schema: pageExitResponseSchema,
  })
  return result.data
}

export async function postAssignmentPresentation(input: { assignment_id: string; event: 'shown' | 'dismissed' }) {
  const result = await gatewayRequest('/api/v1/offer/assignment-presentation', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: assignmentPresentationResponseSchema,
  })
  return result.data
}

export async function getPublicPlanCatalog(options: { forceRefresh?: boolean } = {}) {
  const now = Date.now()
  const market = clientMarketCacheSegment()
  if (
    !options.forceRefresh
    && publicPlanCatalogCache
    && publicPlanCatalogCache.market === market
    && publicPlanCatalogCache.expiresAt > now
  ) {
    return publicPlanCatalogCache.result
  }
  if (!options.forceRefresh && publicPlanCatalogRequest && publicPlanCatalogRequestMarket === market) {
    return publicPlanCatalogRequest
  }

  if (options.forceRefresh) publicPlanCatalogCache = null

  const requestSequence = ++publicPlanCatalogRequestSequence
  const request = gatewayRequest(withClientMarketQuery('/api/v1/offer/public/plan-catalog'), {
    schema: publicPlanCatalogResponseSchema,
  })
    .then((result) => {
      if (requestSequence === publicPlanCatalogRequestSequence) {
        const cachedAt = Date.now()
        const cacheDurationMs = getPublicCatalogCacheDurationMs(result, cachedAt)
        publicPlanCatalogCache = cacheDurationMs > 0
          ? { market, result, expiresAt: cachedAt + cacheDurationMs }
          : null
      }
      return result
    })
    .finally(() => {
      if (publicPlanCatalogRequest === request) {
        publicPlanCatalogRequest = null
        publicPlanCatalogRequestMarket = null
      }
    })

  publicPlanCatalogRequest = request
  publicPlanCatalogRequestMarket = market
  return request
}

function getPublicCatalogCacheDurationMs(
  result: z.output<typeof publicPlanCatalogResponseSchema>,
  now: number,
) {
  let durationMs = PUBLIC_PLAN_CATALOG_CACHE_MS
  for (const plan of result.data.plans) {
    for (const period of billingPeriodSchema.options) {
      const validUntil = plan.periods[period]?.valid_until
      if (!validUntil) continue
      const remainingMs = Date.parse(validUntil) - now
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0
      durationMs = Math.min(durationMs, remainingMs)
    }
  }
  return durationMs
}

export async function getMyOffers() {
  const result = await gatewayRequest('/api/v1/offer/my-offers', {
    schema: myOffersResponseSchema,
  })
  return result.data.tenant_offers
}

type RedeemOfferInput = {
  offer_id: string
  idempotency_key?: string
  activation_mode?: 'immediate' | 'period_end'
  acknowledge_immediate_reset?: boolean
}

const redeemAttemptStore = new ClientMutationAttemptStore<{ offer_id: string }>({
  storageKey: 'youtorch:offer-redeem-intents:v1',
  isPayload: (value): value is { offer_id: string } => Boolean(value && typeof value === 'object' && 'offer_id' in value && typeof value.offer_id === 'string'),
})
registerBrowserPrincipalLifecycleResetter(() => redeemAttemptStore.clearAll())

export async function redeemOffer(input: RedeemOfferInput) {
  const scope = readBrowserPrincipalScope() ?? 'unbound-session'
  const fingerprint = stableClientFingerprint(input)
  const attempt = input.idempotency_key ? { idempotencyKey: input.idempotency_key }
    : redeemAttemptStore.find(scope, fingerprint) ?? redeemAttemptStore.save({
      scope, fingerprint, idempotencyKey: crypto.randomUUID(), payload: { offer_id: input.offer_id },
    })
  try {
    const result = await gatewayRequest(withClientMarketQuery('/api/v1/offer/redeem'), {
      method: 'POST', csrf: true,
      body: { ...input, idempotency_key: attempt.idempotencyKey },
      schema: redeemOfferResponseSchema,
    })
    redeemAttemptStore.clear(scope, attempt.idempotencyKey)
    return result.data
  } catch (error) {
    if (!isAmbiguousMutationError(error)) redeemAttemptStore.clear(scope, attempt.idempotencyKey)
    throw error
  }
}

export async function completeOfferPurchase(input: { purchase_intent_id: string }) {
  const result = await gatewayRequest('/api/v1/offer/complete-purchase', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: completeOfferPurchaseResponseSchema,
  })
  return result.data
}

export async function abandonCheckout(input: { purchase_intent_id: string }) {
  await gatewayRequest('/api/v1/offer/abandon-checkout', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: z.object({
      data: z.object({
        purchase_intent_id: z.string(),
        status: z.literal('cancelled'),
        offer_id: z.string(),
      }),
    }),
  })
}

export async function cancelScheduledPlanChange(input: { purchase_intent_id: string }) {
  await gatewayRequest('/api/v1/offer/cancel-scheduled-change', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: z.object({
      data: z.object({
        purchase_intent_id: z.string(),
        status: z.literal('cancelled'),
        offer_id: z.string(),
      }),
    }),
  })
}

export async function cancelTenantOffer(input: { tenant_offer_id: string }) {
  await gatewayRequest('/api/v1/offer/cancel', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: tenantOfferMutationResponseSchema,
  })
}

export async function undoCancelTenantOffer(input: { tenant_offer_id: string }) {
  await gatewayRequest('/api/v1/offer/undo-cancel', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: tenantOfferMutationResponseSchema,
  })
}

export async function getOfferPurchaseStatus(purchaseIntentId: string) {
  const params = new URLSearchParams({ purchase_intent_id: purchaseIntentId })
  const result = await gatewayRequest(`/api/v1/offer/purchase-status?${params.toString()}`, {
    schema: purchaseStatusResponseSchema,
  })
  return result.data
}
