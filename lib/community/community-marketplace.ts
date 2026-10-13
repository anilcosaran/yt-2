'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-24 Community marketplace client (`/api/v1/community`; login only; closed by the marketplace gate, 404). The verified
 * creator prices their own post; a buyer looks up offers, buys once per tenant and follows the sale to `sold`; the creator's
 * panel data (sales, earnings) is read here too. The client only ever sends the price and revision the user SAW: a changed price
 * or revision is a 409 and nothing is charged. Credits and balances are Billing's; product data is never kept in browser
 * storage (the screens show a loading state until the server answers).
 */
const BASE = '/api/v1/community'

export const communityPriceMax = 10_000

export const communitySaleStates = ['charging', 'sold', 'failed'] as const
export type CommunitySaleState = (typeof communitySaleStates)[number]

const listingSchema = z
  .object({
    schema_version: z.literal('community_listing_v1'),
    post_id: z.string(),
    price_credits: z.number().int().min(0).max(communityPriceMax),
    version: z.number().int().min(0),
    updated_at: z.string(),
  })
  .passthrough()
export type CommunityListing = z.output<typeof listingSchema>

const offerSchema = z
  .object({
    post_id: z.string(),
    revision: z.number().int().min(1),
    price_credits: z.number().int().min(0),
    free: z.boolean(),
    owned: z.boolean(),
    own_listing: z.boolean(),
    purchasable: z.boolean(),
    blocked_reason: z.enum(['own_listing', 'owned', 'publisher_not_verified']).nullable(),
    /** Only on the creator's own listing: the version the next price change must name. */
    listing_version: z.number().int().min(0).optional(),
  })
  .passthrough()
export type CommunityOffer = z.output<typeof offerSchema>

const purchaseSchema = z
  .object({
    schema_version: z.literal('community_purchase_v1'),
    sale_id: z.string().regex(/^csl_[0-9a-f-]{36}$/),
    post_id: z.string(),
    revision: z.number().int().min(1),
    state: z.enum(communitySaleStates),
    price_credits: z.number().int().min(1),
    reason_code: z.string().nullable(),
    already_owned: z.boolean(),
    created_at: z.string(),
    completed_at: z.string().nullable(),
  })
  .passthrough()
export type CommunityPurchase = z.output<typeof purchaseSchema>

const creatorSaleSchema = z
  .object({
    schema_version: z.literal('community_sale_v1'),
    sale_id: z.string(),
    post_id: z.string(),
    revision: z.number().int().min(1),
    price_credits: z.number().min(0),
    creator_share_credits: z.number().min(0),
    commission_credits: z.number().min(0),
    commission_bps: z.number().int(),
    /** `pending` = earned but not yet spendable; `settled` = written to the wallet by the 4-hourly settlement. */
    earning_state: z.enum(['pending', 'settled']),
    sold_at: z.string(),
    settled_at: z.string().nullable(),
  })
  .passthrough()
export type CommunityCreatorSale = z.output<typeof creatorSaleSchema>

const earningsSchema = z
  .object({
    schema_version: z.literal('community_earnings_v1'),
    sales_count: z.number().int().min(0),
    gross_credits: z.number().min(0),
    creator_share_credits: z.number().min(0),
    commission_credits: z.number().min(0),
    pending_credits: z.number().min(0),
    settled_credits: z.number().min(0),
    settlement_interval_hours: z.number(),
    spendable_only_in_youtorch: z.literal(true),
    posts: z.array(
      z
        .object({
          post_id: z.string(),
          price_credits: z.number().min(0),
          sales_count: z.number().int().min(0),
          creator_share_credits: z.number().min(0),
          pending_credits: z.number().min(0),
          settled_credits: z.number().min(0),
          last_sold_at: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough()
export type CommunityEarnings = z.output<typeof earningsSchema>

const listingEnvelope = z.object({ data: z.object({ listing: listingSchema }) })
const offersEnvelope = z.object({ data: z.object({ offers: z.array(offerSchema) }) })
const purchaseEnvelope = z.object({ data: z.object({ purchase: purchaseSchema }) })
const salesEnvelope = z.object({ data: z.array(creatorSaleSchema), meta: z.object({ limit: z.number(), next_cursor: z.string().nullable() }) })
const earningsEnvelope = z.object({ data: z.object({ earnings: earningsSchema }) })

/** The creator prices their own post: whole credits from 1 to 10,000, or 0 for free. Only a verified creator may charge. */
export async function setCommunityPrice(input: { postId: string; priceCredits: number; expectedVersion: number }): Promise<CommunityListing> {
  const response = await gatewayRequest(`${BASE}/me/posts/${encodeURIComponent(input.postId)}/price`, {
    method: 'PUT',
    csrf: true,
    body: { price_credits: input.priceCredits, expected_version: input.expectedVersion },
    schema: listingEnvelope,
  })
  return response.data.listing
}

/** Price and buyability of up to 24 visible posts (the server answers in the given order; unknown posts are absent). */
export async function lookupCommunityOffers(postIds: string[], options: { signal?: AbortSignal } = {}): Promise<CommunityOffer[]> {
  const response = await gatewayRequest(`${BASE}/offers/lookup`, {
    method: 'POST',
    csrf: true,
    body: { post_ids: [...new Set(postIds)].slice(0, 24) },
    schema: offersEnvelope,
    signal: options.signal,
  })
  return response.data.offers
}

/** ONE purchase intent: the revision and the price the user saw. A replay of the same intent answers the same sale. */
export async function startCommunityPurchase(input: {
  postId: string
  revision: number
  expectedPriceCredits: number
  intentKey: string
}): Promise<CommunityPurchase> {
  const response = await gatewayRequest(`${BASE}/posts/${encodeURIComponent(input.postId)}/purchases`, {
    method: 'POST',
    csrf: true,
    body: { revision: input.revision, expected_price_credits: input.expectedPriceCredits, intent_key: input.intentKey },
    schema: purchaseEnvelope,
  })
  return response.data.purchase
}

export async function getCommunityPurchase(saleId: string, options: { signal?: AbortSignal } = {}): Promise<CommunityPurchase> {
  const response = await gatewayRequest(`${BASE}/purchases/${encodeURIComponent(saleId)}`, { schema: purchaseEnvelope, signal: options.signal })
  return response.data.purchase
}

/** The creator's SOLD sales (newest first; never the buyer). */
export async function listCommunityCreatorSales(
  input: { cursor?: string | null; limit?: number } = {},
  options: { signal?: AbortSignal } = {},
): Promise<{ sales: CommunityCreatorSale[]; nextCursor: string | null }> {
  const query = new URLSearchParams()
  if (input.cursor) query.set('cursor', input.cursor)
  if (input.limit) query.set('limit', String(input.limit))
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  const response = await gatewayRequest(`${BASE}/me/sales${suffix}`, { schema: salesEnvelope, signal: options.signal })
  return { sales: response.data, nextCursor: response.meta.next_cursor }
}

export async function getCommunityEarnings(options: { signal?: AbortSignal } = {}): Promise<CommunityEarnings> {
  const response = await gatewayRequest(`${BASE}/me/earnings`, { schema: earningsEnvelope, signal: options.signal })
  return response.data.earnings
}

export type CommunityPurchaseTransport = {
  start: typeof startCommunityPurchase
  get: typeof getCommunityPurchase
}

export const communityPurchaseGatewayTransport: CommunityPurchaseTransport = {
  start: startCommunityPurchase,
  get: getCommunityPurchase,
}

/** A sale still `charging` is polled briefly (Billing answered late); the server job finishes it either way. */
const POLL_DELAYS_MS = [1000, 2000, 3000, 5000]
const POLL_BUDGET_MS = 60_000

export type CommunityPurchaseOutcome =
  /** The buyer's tenant owns it now (`purchase.already_owned` says it owned it before this click). */
  | { status: 'sold'; purchase: CommunityPurchase }
  /** The wait budget ended; the server keeps going and the item becomes usable when the sale completes. */
  | { status: 'processing'; purchase: CommunityPurchase; notice: CommunityMarketplaceNotice }
  /** The caller stopped following (screen closed); nothing is undone on the server. */
  | { status: 'cancelled'; purchase: CommunityPurchase }

export type FollowCommunityPurchaseOptions = {
  transport?: CommunityPurchaseTransport
  /** Injected for tests; the real wait is a timer. */
  wait?: (ms: number) => Promise<void>
  now?: () => number
  budgetMs?: number
  isCancelled?: () => boolean
}

/** Follows one sale to `sold` (or until the wait budget ends); it never starts a second purchase. */
export async function followCommunityPurchase(first: CommunityPurchase, options: FollowCommunityPurchaseOptions = {}): Promise<CommunityPurchaseOutcome> {
  const transport = options.transport ?? communityPurchaseGatewayTransport
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const now = options.now ?? (() => Date.now())
  const budgetMs = options.budgetMs ?? POLL_BUDGET_MS
  const started = now()
  let purchase = first
  let attempt = 0
  while (purchase.state === 'charging') {
    if (options.isCancelled?.()) return { status: 'cancelled', purchase }
    if (now() - started > budgetMs) return { status: 'processing', purchase, notice: { kind: 'stillProcessing' } }
    await wait(POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)]!)
    attempt += 1
    if (options.isCancelled?.()) return { status: 'cancelled', purchase }
    purchase = await transport.get(purchase.sale_id)
  }
  // A `failed` sale is never returned by the server as a success: it is a 402 (`COMMUNITY_INSUFFICIENT_CREDITS`).
  return { status: 'sold', purchase }
}

export type BuyCommunityPostOptions = FollowCommunityPurchaseOptions & {
  postId: string
  revision: number
  expectedPriceCredits: number
  /** Fresh id per click (tests inject a fixed one). */
  createId?: () => string
}

/** One click: start the sale with the price and revision the user saw, and follow it. Errors are thrown as they are. */
export async function buyCommunityPost(options: BuyCommunityPostOptions): Promise<CommunityPurchaseOutcome> {
  const transport = options.transport ?? communityPurchaseGatewayTransport
  const createId = options.createId ?? (() => crypto.randomUUID())
  const purchase = await transport.start({
    postId: options.postId,
    revision: options.revision,
    expectedPriceCredits: options.expectedPriceCredits,
    intentKey: `community-buy:${createId()}`,
  })
  return followCommunityPurchase(purchase, options)
}

/** Explanations of a marketplace step that cannot proceed (everything else keeps the caller's generic handling). */
export type CommunityMarketplaceNotice =
  | { kind: 'unavailable' }
  | { kind: 'priceNotAllowed'; reason: 'publisher_not_verified' | 'post_removed' | 'price_out_of_range' }
  | { kind: 'listingChanged' }
  | { kind: 'priceChanged'; currentPriceCredits: number }
  | { kind: 'changed' }
  | { kind: 'selfPurchase' }
  | { kind: 'notForSale' }
  | { kind: 'insufficientCredits'; priceCredits: number }
  | { kind: 'purchaseRequired'; priceCredits: number }
  | { kind: 'stillProcessing' }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

const PRICE_REASONS = new Set(['publisher_not_verified', 'post_removed', 'price_out_of_range'])

/** A marketplace request error as a notice, or `null` when the caller's generic handling should apply. */
export function communityMarketplaceNotice(error: unknown): CommunityMarketplaceNotice | null {
  if (!isAuthClientError(error)) return null
  const details = record(error.details)
  switch (error.code) {
    case 'COMMUNITY_MARKETPLACE_UNAVAILABLE':
    case 'COMMUNITY_POST_NOT_FOUND':
    case 'COMMUNITY_SALE_NOT_FOUND':
      return { kind: 'unavailable' }
    case 'COMMUNITY_PRICE_NOT_ALLOWED': {
      const reason = String(details?.['reason'] ?? '')
      return { kind: 'priceNotAllowed', reason: (PRICE_REASONS.has(reason) ? reason : 'price_out_of_range') as never }
    }
    case 'COMMUNITY_LISTING_CONFLICT':
      return { kind: 'listingChanged' }
    case 'COMMUNITY_PRICE_CHANGED':
      return { kind: 'priceChanged', currentPriceCredits: Math.max(0, Number(details?.['current_price_credits']) || 0) }
    case 'COMMUNITY_REVISION_CHANGED':
      return { kind: 'changed' }
    case 'COMMUNITY_SELF_PURCHASE':
      return { kind: 'selfPurchase' }
    case 'COMMUNITY_LISTING_NOT_FOR_SALE':
      return { kind: 'notForSale' }
    case 'COMMUNITY_INSUFFICIENT_CREDITS':
      return { kind: 'insufficientCredits', priceCredits: Math.max(1, Number(details?.['price_credits']) || 1) }
    case 'COMMUNITY_PURCHASE_REQUIRED':
      return { kind: 'purchaseRequired', priceCredits: Math.max(1, Number(details?.['price_credits']) || 1) }
    default:
      return null
  }
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/** The notice text from the `Community.marketplace` messages (no technical code ever reaches the user). */
export function communityMarketplaceMessage(notice: CommunityMarketplaceNotice, t: Translate): string {
  switch (notice.kind) {
    case 'unavailable':
      return t('errors.unavailable')
    case 'priceNotAllowed':
      return t(`errors.priceNotAllowed.${notice.reason}`)
    case 'listingChanged':
      return t('errors.listingChanged')
    case 'priceChanged':
      return notice.currentPriceCredits === 0
        ? t('errors.priceChangedFree')
        : t('errors.priceChanged', { price: notice.currentPriceCredits })
    case 'changed':
      return t('errors.changed')
    case 'selfPurchase':
      return t('errors.selfPurchase')
    case 'notForSale':
      return t('errors.notForSale')
    case 'insufficientCredits':
      return t('errors.insufficientCredits', { price: notice.priceCredits })
    case 'purchaseRequired':
      return t('errors.purchaseRequired', { price: notice.priceCredits })
    case 'stillProcessing':
      return t('errors.stillProcessing')
  }
}

/** The label of a sale's state (`community_purchase_v1.state`). */
export function communityPurchaseStateMessage(state: CommunitySaleState, t: Translate): string {
  return t(`purchase.state.${state}`)
}

/** The label of an earning's state in the creator panel (`pending` is not spendable yet; `settled` is in the wallet). */
export function communityEarningStateMessage(state: 'pending' | 'settled', t: Translate): string {
  return t(`earnings.state.${state}`)
}

/** The price field is open to verified creators only; every other account lists for free (Q94). */
export function communityPriceFieldOpen(input: { verified: boolean }): boolean {
  return input.verified
}

/** Local validation of the price input before the request (the server enforces the same bounds). */
export function communityPriceInputError(value: number): 'not_integer' | 'out_of_range' | null {
  if (!Number.isInteger(value)) return 'not_integer'
  if (value < 0 || value > communityPriceMax) return 'out_of_range'
  return null
}
