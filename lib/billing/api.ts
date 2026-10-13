'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'
import { isAuthClientError } from '@/lib/auth/errors'
import { getMyOffers, myOfferSchema } from '@/lib/offer/api'

export const BILLING_BALANCE_UPDATED_EVENT = 'youtorch:billing-balance-updated'
export const BILLING_QUERY_KEY = ['billing'] as const
export const BILLING_OVERVIEW_QUERY_KEY = [...BILLING_QUERY_KEY, 'overview'] as const
export const BILLING_BALANCE_QUERY_KEY = [...BILLING_QUERY_KEY, 'balance'] as const
export const BILLING_QUOTA_USAGE_QUERY_KEY = [...BILLING_QUERY_KEY, 'quota-usage'] as const
export const BILLING_PAYMENT_METHODS_QUERY_KEY = [...BILLING_QUERY_KEY, 'payment-methods'] as const
export const BILLING_PAYMENT_METHOD_STATUS_QUERY_KEY = [...BILLING_QUERY_KEY, 'payment-method-status'] as const
export const BILLING_TOP_UP_PACKAGES_QUERY_KEY = [...BILLING_QUERY_KEY, 'top-up-packages'] as const
export const BILLING_AUTO_TOPUP_QUERY_KEY = [...BILLING_QUERY_KEY, 'auto-topup'] as const
export const BILLING_PAYMENT_RISK_QUERY_KEY = [...BILLING_QUERY_KEY, 'payment-risk'] as const
export const STORAGE_DEBT_STATUS_QUERY_KEY = ['storage', 'debt-status'] as const
const BILLING_OVERVIEW_TRANSACTION_LIMIT = 100

export function billingTransactionsQueryKey(input: {
  page?: number
  limit?: number
  type?: string
  from?: string
  to?: string
} = {}) {
  return [
    ...BILLING_QUERY_KEY,
    'transactions',
    {
      page: input.page ?? null,
      limit: input.limit ?? null,
      type: input.type ?? null,
      from: input.from ?? null,
      to: input.to ?? null,
    },
  ] as const
}

export function billingTransactionSummaryQueryKey(input: {
  cycleStart?: string
  cycleEnd?: string
  cycle_start?: string
  cycle_end?: string
}) {
  return [
    ...BILLING_QUERY_KEY,
    'transaction-summary',
    {
      cycle_start: input.cycleStart ?? input.cycle_start ?? null,
      cycle_end: input.cycleEnd ?? input.cycle_end ?? null,
    },
  ] as const
}

export function billingOverviewQueryKey(input: {
  cycleStart?: string
  cycleEnd?: string
  cycle_start?: string
  cycle_end?: string
  invoiceLimit?: number
  invoice_limit?: number
  invoicePage?: number
  invoice_page?: number
}) {
  return [
    ...BILLING_OVERVIEW_QUERY_KEY,
    {
      cycle_start: input.cycleStart ?? input.cycle_start ?? null,
      cycle_end: input.cycleEnd ?? input.cycle_end ?? null,
      invoice_limit: input.invoiceLimit ?? input.invoice_limit ?? null,
      invoice_page: input.invoicePage ?? input.invoice_page ?? null,
    },
  ] as const
}

const creditNumberSchema = z.preprocess((value) => {
  if (value && typeof value === 'object' && 'credits' in value) {
    return (value as { credits?: unknown }).credits
  }
  return value
}, z.coerce.number().catch(0))

const strictCreditNumberSchema = z.preprocess((value) => {
  if (value && typeof value === 'object' && 'credits' in value) {
    return (value as { credits?: unknown }).credits
  }
  return value
}, z.coerce.number())

const nullableCreditNumberSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return null
  if (value && typeof value === 'object' && 'credits' in value) {
    return (value as { credits?: unknown }).credits
  }
  return value
}, z.coerce.number().nullable().catch(null))

const metadataSchema = z.preprocess((value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  return null
}, z.record(z.unknown()).nullable().catch(null))

const quotaUsageItemSchema = z.object({
  quota_key: z.string(),
  total_quota: strictCreditNumberSchema,
  used_quota: strictCreditNumberSchema,
  remaining_quota: strictCreditNumberSchema,
})

const planIncludedCreditsSchema = z.object({
  quota_key: z.string().catch('billing:plan_included_credits'),
  total: creditNumberSchema,
  used: creditNumberSchema,
  remaining: creditNumberSchema,
}).catch({
  quota_key: 'billing:plan_included_credits',
  total: 0,
  used: 0,
  remaining: 0,
})

export const quotaUsageDataSchema = z.object({
    credit_balance: creditNumberSchema,
    top_up_balance_credits: creditNumberSchema.optional(),
    available_credits: creditNumberSchema.optional(),
    plan_included_credits: planIncludedCreditsSchema.optional(),
    quotas: z.array(quotaUsageItemSchema).catch([]),
}).catch({ credit_balance: 0, top_up_balance_credits: 0, available_credits: 0, quotas: [] })

const quotaUsageResponseSchema = z.object({
  data: quotaUsageDataSchema,
})

const billingBalanceResponseSchema = z.object({
  data: z.object({
    credit_balance: creditNumberSchema.optional(),
    balance_credits: creditNumberSchema.optional(),
  }).passthrough(),
}).transform((payload) => ({
  credit_balance: payload.data.credit_balance ?? payload.data.balance_credits ?? 0,
}))

const paymentMethodSchema = z.object({
  payment_method_id: z.string().catch(''),
  brand: z.string().nullable().catch(null),
  last4: z.string().nullable().catch(null),
  exp_month: z.coerce.number().nullable().catch(null),
  exp_year: z.coerce.number().nullable().catch(null),
  is_default: z.boolean().catch(false),
})

const paymentMethodsResponseSchema = z.object({
  data: z.object({
    payment_methods: z.array(paymentMethodSchema).catch([]),
  }),
})

const paymentMethodStatusSchema = z.object({
  payment_method_count: z.coerce.number().catch(0),
  payment_method_limit: z.coerce.number().catch(0),
  can_add: z.boolean().catch(false),
  payment_method_added: z.boolean().catch(false),
  has_payment_method: z.boolean().optional().catch(undefined),
  has_default_payment_method: z.boolean().optional().catch(undefined),
  default_payment_method_id: z.string().nullable().optional().catch(null),
})

const paymentMethodStatusResponseSchema = z.object({
  data: paymentMethodStatusSchema,
})

const topUpPackageSchema = z.object({
  package_id: z.string(),
  name: z.string(),
  amount_gbp: z.coerce.number(),
  amount_credits: creditNumberSchema,
  currency: z.string().catch('GBP'),
  discount_percent: z.coerce.number().nullable().catch(null),
  original_price_gbp: z.coerce.number().nullable().catch(null),
  badge_text: z.string().nullable().catch(null),
}).transform((pkg) => ({
  package_id: pkg.package_id,
  name: pkg.name,
  amount_gbp: pkg.amount_gbp,
  amount_credits: pkg.amount_credits,
  currency: pkg.currency,
  discount_percent: pkg.discount_percent,
  original_price_gbp: pkg.original_price_gbp,
  badge_text: pkg.badge_text,
}))

const topUpPackagesResponseSchema = z.object({
  data: z.object({
    packages: z.array(topUpPackageSchema).catch([]),
  }),
})

const createTopUpResponseSchema = z.object({
  data: z.object({
    request_id: z.string(),
    status: z.string(),
    package_id: z.string(),
    amount_credits: creditNumberSchema,
    amount_gbp: z.coerce.number(),
  }).transform((payload) => ({
    request_id: payload.request_id,
    status: payload.status,
    package_id: payload.package_id,
    amount_credits: payload.amount_credits,
    amount_gbp: payload.amount_gbp,
  })),
})

const topUpStatusResponseSchema = z.object({
  data: z.object({
    status: z.enum(['processing', 'completed', 'failed', 'not_found']).catch('processing'),
    credit_balance: creditNumberSchema.optional(),
    transaction_id: z.string().optional(),
    error: z.string().optional(),
  }),
})

const autoTopupResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean().optional(),
    auto_topup_enabled: z.boolean().optional(),
    threshold_credits: creditNumberSchema.nullable().optional(),
    auto_topup_threshold_credits: creditNumberSchema.nullable().optional(),
    amount_credits: creditNumberSchema.nullable().optional(),
    auto_topup_amount_credits: creditNumberSchema.nullable().optional(),
    current_balance_credits: creditNumberSchema.optional(),
    trigger_status: z.enum(['disabled', 'not_configured', 'ready', 'armed']).optional(),
    credits_until_trigger: creditNumberSchema.nullable().optional(),
  }).passthrough(),
}).transform((payload) => ({
  enabled: payload.data.enabled ?? payload.data.auto_topup_enabled ?? false,
  threshold_credits: payload.data.threshold_credits ?? payload.data.auto_topup_threshold_credits ?? null,
  amount_credits: payload.data.amount_credits ?? payload.data.auto_topup_amount_credits ?? null,
  current_balance_credits: payload.data.current_balance_credits ?? 0,
  trigger_status: payload.data.trigger_status ?? 'disabled',
  credits_until_trigger: payload.data.credits_until_trigger ?? null,
}))

const setupIntentResponseSchema = z.object({
  data: z.object({
    client_secret: z.string(),
    setup_intent_id: z.string(),
  }),
})

const confirmSetupIntentResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    payment_method_id: z.string().nullable().catch(null),
    already_saved: z.boolean().catch(false),
  }),
})

const setDefaultPaymentMethodResponseSchema = z.object({
  data: z.object({
    payment_method_id: z.string(),
    is_default: z.boolean().catch(true),
  }),
})

const removePaymentMethodResponseSchema = z.object({
  data: z.object({
    removed: z.boolean().catch(true),
    payment_method_id: z.string().optional(),
  }),
})

const storageDebtSchema = z.object({
  debt_id: z.string(),
  cycle_start: z.string(),
  cycle_end: z.string(),
  original_credits: creditNumberSchema,
  remaining_credits: creditNumberSchema,
  paid_credits: creditNumberSchema,
  status: z.string(),
  attempt_count: z.coerce.number().catch(0),
  created_at: z.string(),
  reconciliation_required: z.boolean().optional().default(false).catch(false),
  reconciliation_reason: z.string().nullable().optional().default(null).catch(null),
})

const storageDebtStatusDataSchema = z.object({
    total_debt_credits: creditNumberSchema,
    total_paid_credits: creditNumberSchema,
    has_outstanding_debt: z.boolean().catch(false),
    debts: z.array(storageDebtSchema).catch([]),
})

const storageDebtStatusResponseSchema = z.object({
  data: storageDebtStatusDataSchema,
})

const payStorageDebtResponseSchema = z.object({
  data: z.object({
    paid_credits: creditNumberSchema,
    remaining_debt_credits: creditNumberSchema,
    debts_cleared: z.coerce.number().catch(0),
    all_debts_cleared: z.boolean().catch(false),
    transactions: z.array(z.object({
      debt_id: z.string(),
      paid: creditNumberSchema,
      remaining: creditNumberSchema,
    })).catch([]),
  }),
})

const billingTransactionCoreSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount_credits: strictCreditNumberSchema,
  quota_credits: strictCreditNumberSchema,
  balance_credits: strictCreditNumberSchema,
  balance_before_credits: nullableCreditNumberSchema,
  balance_after_credits: nullableCreditNumberSchema,
  reservation_id: z.string().nullable().optional().catch(null),
  workflow_id: z.string().nullable().optional().catch(null),
  quota_key: z.string().nullable().optional().catch(null),
  funding_source: z.string().nullable().optional().catch(null),
  source_type: z.string().nullable().optional().catch(null),
  source_id: z.string().nullable().optional().catch(null),
  idempotency_key: z.string().nullable().optional().catch(null),
  metadata: metadataSchema,
  created_at: z.string(),
}).passthrough()

const billingTransactionSchema = z.union([
  billingTransactionCoreSchema,
  z.object({ props: billingTransactionCoreSchema }).transform((transaction) => transaction.props),
])

const transactionCollectionSchema = z.union([
  z.object({
    transactions: z.array(billingTransactionSchema).catch([]).optional(),
    page: z.coerce.number().catch(1),
    limit: z.coerce.number().catch(20),
    total: z.coerce.number().nullable().optional().catch(null),
  }).transform((data) => ({
    transactions: data.transactions ?? [],
    items: data.transactions ?? [],
    page: data.page,
    limit: data.limit,
    total: data.total ?? data.transactions?.length ?? 0,
  })),
  z.object({
    items: z.array(billingTransactionSchema).catch([]).optional(),
    page: z.coerce.number().catch(1),
    limit: z.coerce.number().catch(20),
    total: z.coerce.number().nullable().optional().catch(null),
  }).transform((data) => ({
    transactions: data.items ?? [],
    items: data.items ?? [],
    page: data.page,
    limit: data.limit,
    total: data.total ?? data.items?.length ?? 0,
  })),
])

const billingTransactionsResponseSchema = z.object({
  data: transactionCollectionSchema.catch({
    transactions: [],
    items: [],
    page: 1,
    limit: 20,
    total: 0,
  }),
})

const transactionSummaryCoreSchema = z.object({
  total_spent_credits: creditNumberSchema.optional(),
  total_topup_credits: creditNumberSchema.optional(),
  total_top_up_credits: creditNumberSchema.optional(),
  total_grant_credits: creditNumberSchema.optional(),
  total_charge_credits: creditNumberSchema.optional(),
  total_refund_credits: creditNumberSchema.optional(),
  cycle_start: z.string().nullable().optional().catch(null),
  cycle_end: z.string().nullable().optional().catch(null),
}).transform((summary) => ({
  total_spent_credits: summary.total_spent_credits ?? summary.total_charge_credits ?? 0,
  total_charge_credits: summary.total_charge_credits ?? summary.total_spent_credits ?? 0,
  total_topup_credits: summary.total_topup_credits ?? summary.total_top_up_credits ?? 0,
  total_grant_credits: summary.total_grant_credits ?? 0,
  total_added_credits: (summary.total_topup_credits ?? summary.total_top_up_credits ?? 0) + (summary.total_grant_credits ?? 0),
  total_refund_credits: summary.total_refund_credits ?? 0,
  cycle_start: summary.cycle_start ?? null,
  cycle_end: summary.cycle_end ?? null,
}))

const transactionSummaryResponseSchema = z.object({
  data: z.union([
    z.object({ summary: transactionSummaryCoreSchema }).transform((payload) => payload.summary),
    transactionSummaryCoreSchema,
  ]).catch({
    total_spent_credits: 0,
    total_charge_credits: 0,
    total_topup_credits: 0,
    total_grant_credits: 0,
    total_added_credits: 0,
    total_refund_credits: 0,
    cycle_start: null,
    cycle_end: null,
  }),
})

const billingOverviewResponseSchema = z.object({
  data: z.object({
    quota_usage: quotaUsageDataSchema,
    payment_methods: z.array(paymentMethodSchema).catch([]),
    payment_method_status: paymentMethodStatusSchema,
    transactions: transactionCollectionSchema.catch({
      transactions: [],
      items: [],
      page: 1,
      limit: 100,
      total: 0,
    }),
    invoices: z.object({
      transactions: z.array(billingTransactionSchema).catch([]),
      page: z.number().catch(1),
      limit: z.number().catch(10),
      total: z.number().catch(0),
    }).catch({
      transactions: [],
      page: 1,
      limit: 10,
      total: 0,
    }),
    transaction_summary: transactionSummaryCoreSchema.catch({
      total_spent_credits: 0,
      total_charge_credits: 0,
      total_topup_credits: 0,
      total_grant_credits: 0,
      total_added_credits: 0,
      total_refund_credits: 0,
      cycle_start: null,
      cycle_end: null,
    }),
    debt_status: storageDebtStatusDataSchema,
    my_offers: z.array(myOfferSchema).catch([]),
  }),
})

export type QuotaUsageItem = z.infer<typeof quotaUsageItemSchema>
export type BillingQuotaUsage = z.infer<typeof quotaUsageResponseSchema>['data']
export type BillingTransaction = z.infer<typeof billingTransactionSchema>
export type BillingTransactionSummary = z.infer<typeof transactionSummaryResponseSchema>['data']
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type PaymentMethodStatus = z.infer<typeof paymentMethodStatusSchema>
export type TopUpPackage = z.infer<typeof topUpPackageSchema>
export type AutoTopupSettings = z.infer<typeof autoTopupResponseSchema>
export type StorageDebtStatus = z.infer<typeof storageDebtStatusResponseSchema>['data']
export type BillingOverview = z.infer<typeof billingOverviewResponseSchema>['data']
type GatewayRequestOptions = { signal?: AbortSignal }
const LEGACY_INVOICE_TRANSACTION_TYPES = ['topup', 'auto_topup', 'plan_change'] as const

const paymentRiskCreditSchema = z.number().finite().nonnegative()
export const paymentRiskResponseSchema = z.object({
  data: z.object({
    sources: z.array(z.object({
      id: z.string(),
      payment_intent_id: z.string().nullable(),
      tenant_offer_id: z.string().nullable(),
      remaining_credits: paymentRiskCreditSchema,
      frozen_credits: paymentRiskCreditSchema,
      revoked_credits: paymentRiskCreditSchema,
      status: z.string(),
    })),
    cases: z.array(z.object({
      risk_key: z.string(),
      kind: z.enum(['dispute', 'refund']),
      status: z.string(),
      amount_minor: z.number().int().nonnegative(),
      currency: z.string(),
      operator_review_required: z.boolean(),
    })),
  }),
})
export type PaymentRiskSummary = z.infer<typeof paymentRiskResponseSchema>['data']

export async function getPaymentRiskSummary(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/billing/payment-risk', {
    schema: paymentRiskResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getQuotaUsage(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/billing/quota-usage', {
    schema: quotaUsageResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getBillingBalance(options: GatewayRequestOptions = {}) {
  return gatewayRequest('/api/v1/billing/balance', {
    schema: billingBalanceResponseSchema,
    signal: options.signal,
  })
}

export async function getBillingQuotaUsage(options: GatewayRequestOptions = {}) {
  return getQuotaUsage(options)
}

export async function getBillingOverview(input: {
  cycleStart?: string
  cycleEnd?: string
  cycle_start?: string
  cycle_end?: string
  invoiceLimit?: number
  invoice_limit?: number
  invoicePage?: number
  invoice_page?: number
}, options: GatewayRequestOptions = {}) {
  const cycleStart = input.cycleStart ?? input.cycle_start
  const cycleEnd = input.cycleEnd ?? input.cycle_end
  if (!cycleStart || !cycleEnd) {
    throw new Error('cycle_start and cycle_end are required')
  }

  const params = new URLSearchParams({
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
  })
  const invoiceLimit = input.invoiceLimit ?? input.invoice_limit
  const invoicePage = input.invoicePage ?? input.invoice_page
  if (invoiceLimit) params.set('invoice_limit', String(invoiceLimit))
  if (invoicePage) params.set('invoice_page', String(invoicePage))

  try {
    const result = await gatewayRequest(`/api/v1/billing/overview?${params.toString()}`, {
      schema: billingOverviewResponseSchema,
      signal: options.signal,
    })
    return result.data
  } catch (error) {
    if (isAuthClientError(error) && error.status === 404) {
      return getBillingOverviewFallback({
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
        invoice_limit: invoiceLimit,
        invoice_page: invoicePage,
      }, options)
    }
    throw error
  }
}

async function getBillingOverviewFallback(input: {
  cycle_start: string
  cycle_end: string
  invoice_limit?: number
  invoice_page?: number
}, options: GatewayRequestOptions = {}): Promise<BillingOverview> {
  const invoiceLimit = input.invoice_limit ?? 100
  const invoicePage = input.invoice_page ?? 1
  const [
    quotaUsage,
    paymentMethods,
    paymentMethodStatus,
    transactions,
    invoices,
    transactionSummary,
    debtStatus,
    myOffers,
  ] = await Promise.all([
    getBillingQuotaUsage(options),
    getPaymentMethods(options),
    getPaymentMethodStatus(options),
    getBillingTransactions({ page: 1, limit: BILLING_OVERVIEW_TRANSACTION_LIMIT }, options),
    getLegacyInvoiceHistory(invoicePage, invoiceLimit, options),
    getBillingTransactionSummary({ cycle_start: input.cycle_start, cycle_end: input.cycle_end }, options),
    getStorageDebtStatus(options),
    getMyOffers(),
  ])

  return {
    quota_usage: quotaUsage,
    payment_methods: paymentMethods,
    payment_method_status: paymentMethodStatus,
    transactions,
    invoices,
    transaction_summary: transactionSummary,
    debt_status: debtStatus,
    my_offers: myOffers,
  }
}

export async function getLegacyInvoiceHistory(
  page: number,
  limit: number,
  options: GatewayRequestOptions = {},
): Promise<BillingOverview['invoices']> {
  const targetCount = page * limit

  const perType = await Promise.all(LEGACY_INVOICE_TRANSACTION_TYPES.map(async (type) => {
    const first = await getBillingTransactions({ page: 1, limit, type }, options)
    const pageCount = Math.ceil(Math.min(first.total, targetCount) / limit)
    const transactions = [...first.transactions]

    for (let nextPage = 2; nextPage <= pageCount; nextPage += 1) {
      const next = await getBillingTransactions({ page: nextPage, limit, type }, options)
      transactions.push(...next.transactions)
    }

    return { total: first.total, transactions }
  }))

  const transactions = perType
    .flatMap((result) => result.transactions)
    .sort((left, right) => {
      const byCreatedAt = Date.parse(right.created_at) - Date.parse(left.created_at)
      return byCreatedAt || left.id.localeCompare(right.id)
    })
  const offset = (page - 1) * limit

  return {
    transactions: transactions.slice(offset, offset + limit),
    page,
    limit,
    total: perType.reduce((sum, result) => sum + result.total, 0),
  }
}

export async function getPaymentMethods(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/billing/payment-methods', {
    schema: paymentMethodsResponseSchema,
    signal: options.signal,
  })
  return result.data.payment_methods
}

export async function getPaymentMethodStatus(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/billing/payment-methods/status', {
    schema: paymentMethodStatusResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getTopUpPackages(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/billing/top-up/packages', {
    schema: topUpPackagesResponseSchema,
    signal: options.signal,
  })
  return result.data.packages
}

export async function createTopUp(input: { package_id: string; idempotency_key: string }) {
  const result = await gatewayRequest('/api/v1/billing/top-up', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: createTopUpResponseSchema,
  })
  return result.data
}

export async function getTopUpStatus(requestId: string, options: GatewayRequestOptions = {}) {
  const params = new URLSearchParams({ request_id: requestId })
  const result = await gatewayRequest(`/api/v1/billing/top-up/status?${params.toString()}`, {
    schema: topUpStatusResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getAutoTopup(options: GatewayRequestOptions = {}) {
  return gatewayRequest('/api/v1/billing/auto-topup', {
    schema: autoTopupResponseSchema,
    signal: options.signal,
  })
}

export async function updateAutoTopup(input: {
  enabled: boolean
  threshold_credits?: number
  amount_credits?: number
}) {
  return gatewayRequest('/api/v1/billing/auto-topup', {
    method: 'PUT',
    csrf: true,
    body: input,
    schema: autoTopupResponseSchema,
  })
}

export async function createSetupIntent(input: { email: string }) {
  const result = await gatewayRequest('/api/v1/billing/payment-methods/setup-intent', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: setupIntentResponseSchema,
  })
  return result.data
}

export async function confirmSetupIntent(input: { setup_intent_id: string }) {
  const result = await gatewayRequest('/api/v1/billing/payment-methods/confirm', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: confirmSetupIntentResponseSchema,
  })
  return result.data
}

export async function setDefaultPaymentMethod(paymentMethodId: string) {
  const result = await gatewayRequest(`/api/v1/billing/payment-methods/${encodeURIComponent(paymentMethodId)}/default`, {
    method: 'PUT',
    csrf: true,
    schema: setDefaultPaymentMethodResponseSchema,
  })
  return result.data
}

export async function removePaymentMethod(paymentMethodId: string) {
  const result = await gatewayRequest(`/api/v1/billing/payment-methods/${encodeURIComponent(paymentMethodId)}`, {
    method: 'DELETE',
    csrf: true,
    schema: removePaymentMethodResponseSchema,
  })
  return result.data
}

export async function getStorageDebtStatus(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/storage/debts', {
    schema: storageDebtStatusResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function payStorageDebt(input: {
  debt_id?: string
  amount_credits?: number
  idempotency_key: string
}) {
  const result = await gatewayRequest('/api/v1/storage/debts/pay', {
    method: 'POST',
    csrf: true,
    body: input,
    schema: payStorageDebtResponseSchema,
  })
  return result.data
}

export async function getBillingTransactions(input: {
  page?: number
  limit?: number
  type?: string
  from?: string
  to?: string
} = {}, options: GatewayRequestOptions = {}) {
  const params = new URLSearchParams()
  if (input.page) params.set('page', String(input.page))
  if (input.limit) params.set('limit', String(input.limit))
  if (input.type) params.set('type', input.type)
  if (input.from) params.set('from', input.from)
  if (input.to) params.set('to', input.to)

  const suffix = params.toString() ? `?${params.toString()}` : ''
  const result = await gatewayRequest(`/api/v1/billing/transactions${suffix}`, {
    schema: billingTransactionsResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getBillingTransactionSummary(input: {
  cycleStart?: string
  cycleEnd?: string
  cycle_start?: string
  cycle_end?: string
}, options: GatewayRequestOptions = {}) {
  const cycleStart = input.cycleStart ?? input.cycle_start
  const cycleEnd = input.cycleEnd ?? input.cycle_end
  if (!cycleStart || !cycleEnd) {
    throw new Error('cycle_start and cycle_end are required')
  }

  const params = new URLSearchParams({
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
  })

  const result = await gatewayRequest(`/api/v1/billing/transactions/summary?${params.toString()}`, {
    schema: transactionSummaryResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export function getCurrentBillingCycleRange(now = new Date()) {
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    cycleStart: cycleStart.toISOString(),
    cycleEnd: now.toISOString(),
  }
}
