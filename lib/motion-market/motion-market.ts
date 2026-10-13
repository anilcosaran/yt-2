'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * E1-I Premium Motion marketplace client (`/api/v1/motion-market`; login only; closed by `MOTION_MARKETPLACE_ENABLED`, 404). A Motion is
 * bought ONCE per workspace and then belongs to the workspace library (every project of the workspace uses it): the Community cards,
 * the platform's premium offers, the workspace library, the seller's own listings, sales and earnings, and the purchase. The client only
 * ever sends the price and revision the user SAW: a changed price or revision is a 409 and nothing is charged. Credits and balances are
 * Billing's; product data is never kept in browser storage (the screens show a loading state until the server answers).
 */
const BASE = '/api/v1/motion-market'

export const motionListingPriceMin = 10
export const motionListingPriceMax = 100_000
/** D3: the platform's premium Motion price until an admin sets another (the server decides; this is only the fallback label). */
export const motionPremiumDefaultPriceCredits = 25

export const motionSaleStates = ['charging', 'sold', 'failed'] as const
export type MotionSaleState = (typeof motionSaleStates)[number]

export type MotionSaleSource = 'community' | 'platform'

const localizedSchema = z.object({ en: z.string(), tr: z.string() })

export const motionListingSchema = z
  .object({
    schema_version: z.literal('motion_listing_v1'),
    listing_id: z.string(),
    motion_id: z.string(),
    motion_revision_id: z.string(),
    manifest_sha256: z.string(),
    state: z.enum(['active', 'delisted']),
    delisted_by: z.enum(['seller', 'admin']).nullable(),
    price_credits: z.number().int().min(1),
    title: localizedSchema,
    summary: z.string(),
    blueprint_ref: z.string(),
    aspect_ratios: z.array(z.string()),
    parameter_count: z.number().int().min(0),
    /** The Community name of the seller when they have one (never the workspace). */
    seller: z.object({ username: z.string().nullable(), verified: z.boolean() }).nullable(),
    /** This workspace already bought it. */
    owned: z.boolean(),
    /** The asking member sells it (or is in the seller's workspace). */
    own_listing: z.boolean(),
    purchasable: z.boolean(),
    /** The token the next change of the seller's listing must name. */
    version: z.number().int().min(1),
    updated_at: z.string(),
  })
  .passthrough()
export type MotionListing = z.output<typeof motionListingSchema>

export const motionPremiumOfferSchema = z
  .object({
    schema_version: z.literal('motion_premium_offer_v1'),
    motion_id: z.string(),
    motion_revision_id: z.string(),
    manifest_sha256: z.string(),
    collection: z.string(),
    price_credits: z.number().int().min(1),
    title: localizedSchema,
    summary: z.string(),
    aspect_ratios: z.array(z.string()),
    owned: z.boolean(),
    purchasable: z.boolean(),
  })
  .passthrough()
export type MotionPremiumOffer = z.output<typeof motionPremiumOfferSchema>

const licenceSchema = z
  .object({
    terms_version: z.string(),
    scope: z.literal('workspace'),
    resale: z.literal(false),
    community_republish: z.literal(false),
    derivative_community_republish: z.literal(false),
    refunds: z.literal(false),
  })
  .passthrough()

export const motionLibraryItemSchema = z
  .object({
    schema_version: z.literal('motion_library_item_v1'),
    source: z.enum(['community', 'platform']),
    sale_id: z.string(),
    motion_id: z.string(),
    motion_revision_id: z.string(),
    revision_number: z.number().int(),
    ref: z.object({ motion_id: z.string(), motion_revision_id: z.string(), scope: z.string(), manifest_sha256: z.string() }),
    blueprint_ref: z.string(),
    title: localizedSchema,
    summary: z.string(),
    parameter_schema_hash: z.string(),
    parameters: z.array(z.unknown()),
    aspect_ratios: z.array(z.string()),
    /** T1R-5: why the Motion cannot sit over other layers (the licence holder never receives the pattern itself). */
    overlay_block: z.enum(['camera', 'content']).nullable().optional(),
    price_credits: z.number().int().min(1),
    purchased_at: z.string(),
    licence: licenceSchema,
  })
  .passthrough()
export type MotionLibraryItem = z.output<typeof motionLibraryItemSchema>

export const motionPurchaseSchema = z
  .object({
    schema_version: z.literal('motion_purchase_v1'),
    sale_id: z.string().regex(/^msl_[0-9a-f-]{36}$/),
    source: z.enum(['community', 'platform']),
    motion_id: z.string(),
    motion_revision_id: z.string(),
    state: z.enum(motionSaleStates),
    price_credits: z.number().int().min(1),
    funding: z.enum(['top_up_only', 'standard']),
    reason_code: z.string().nullable(),
    already_owned: z.boolean(),
    created_at: z.string(),
    completed_at: z.string().nullable(),
  })
  .passthrough()
export type MotionPurchase = z.output<typeof motionPurchaseSchema>

export const motionSellerSaleSchema = z
  .object({
    schema_version: z.literal('motion_sale_v1'),
    sale_id: z.string(),
    motion_id: z.string(),
    motion_revision_id: z.string(),
    title: z.string().nullable(),
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
export type MotionSellerSale = z.output<typeof motionSellerSaleSchema>

export const motionEarningsSchema = z
  .object({
    schema_version: z.literal('motion_earnings_v1'),
    sales_count: z.number().int().min(0),
    gross_credits: z.number().min(0),
    creator_share_credits: z.number().min(0),
    commission_credits: z.number().min(0),
    pending_credits: z.number().min(0),
    settled_credits: z.number().min(0),
    settlement_interval_hours: z.number(),
    spendable_only_in_youtorch: z.literal(true),
    motions: z.array(
      z
        .object({
          motion_id: z.string(),
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
export type MotionEarnings = z.output<typeof motionEarningsSchema>

const pageMeta = z.object({ limit: z.number(), next_cursor: z.string().nullable() })
const listingPageEnvelope = z.object({ data: z.array(motionListingSchema), meta: pageMeta })
const listingEnvelope = z.object({ data: z.object({ listing: motionListingSchema }) })
const myListingsEnvelope = z.object({ data: z.object({ listings: z.array(motionListingSchema) }) })
const offersEnvelope = z.object({ data: z.object({ offers: z.array(motionPremiumOfferSchema) }) })
const libraryEnvelope = z.object({ data: z.object({ items: z.array(motionLibraryItemSchema) }) })
const purchaseEnvelope = z.object({ data: z.object({ purchase: motionPurchaseSchema }) })
const salesEnvelope = z.object({ data: z.array(motionSellerSaleSchema), meta: pageMeta })
const earningsEnvelope = z.object({ data: z.object({ earnings: motionEarningsSchema }) })

type ReadOptions = { signal?: AbortSignal }

/** The Community cards: active listings, newest first; `query` filters by title or summary. */
export async function listMotionListings(
  input: { cursor?: string | null; limit?: number; query?: string } = {},
  options: ReadOptions = {},
): Promise<{ listings: MotionListing[]; nextCursor: string | null }> {
  const query = new URLSearchParams()
  if (input.cursor) query.set('cursor', input.cursor)
  if (input.limit) query.set('limit', String(input.limit))
  if (input.query?.trim()) query.set('q', input.query.trim().slice(0, 80))
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  const response = await gatewayRequest(`${BASE}/listings${suffix}`, { schema: listingPageEnvelope, signal: options.signal })
  return { listings: response.data, nextCursor: response.meta.next_cursor }
}

/** The platform's premium Motions with their prices and what this workspace already bought. */
export async function listMotionPremiumOffers(options: ReadOptions = {}): Promise<MotionPremiumOffer[]> {
  const response = await gatewayRequest(`${BASE}/premium`, { schema: offersEnvelope, signal: options.signal })
  return response.data.offers
}

/** The Motions this workspace bought (user and platform), newest first: the "purchased" entries of My Motions. */
export async function listMotionLibrary(options: ReadOptions = {}): Promise<MotionLibraryItem[]> {
  const response = await gatewayRequest(`${BASE}/library`, { schema: libraryEnvelope, signal: options.signal })
  return response.data.items
}

/** The actor's own listings (active and delisted). */
export async function listMyMotionListings(options: ReadOptions = {}): Promise<MotionListing[]> {
  const response = await gatewayRequest(`${BASE}/me/listings`, { schema: myListingsEnvelope, signal: options.signal })
  return response.data.listings
}

/** Sell one of your own published Motion revisions (or change its price or revision, or list it again). 0 = not listed yet. */
export async function sellMotion(input: { motionRevisionId: string; priceCredits: number; expectedVersion: number }): Promise<MotionListing> {
  const response = await gatewayRequest(`${BASE}/me/listings`, {
    method: 'PUT',
    csrf: true,
    body: { motion_revision_id: input.motionRevisionId, price_credits: input.priceCredits, expected_version: input.expectedVersion },
    schema: listingEnvelope,
  })
  return response.data.listing
}

/** Stop selling a Motion; workspaces that already bought it keep it. */
export async function delistMotion(input: { motionId: string; expectedVersion: number }): Promise<MotionListing> {
  const response = await gatewayRequest(`${BASE}/me/listings/${encodeURIComponent(input.motionId)}/delist`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: input.expectedVersion },
    schema: listingEnvelope,
  })
  return response.data.listing
}

/** The seller's SOLD sales (newest first; never the buyer). */
export async function listMotionSellerSales(
  input: { cursor?: string | null; limit?: number } = {},
  options: ReadOptions = {},
): Promise<{ sales: MotionSellerSale[]; nextCursor: string | null }> {
  const query = new URLSearchParams()
  if (input.cursor) query.set('cursor', input.cursor)
  if (input.limit) query.set('limit', String(input.limit))
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  const response = await gatewayRequest(`${BASE}/me/sales${suffix}`, { schema: salesEnvelope, signal: options.signal })
  return { sales: response.data, nextCursor: response.meta.next_cursor }
}

export async function getMotionEarnings(options: ReadOptions = {}): Promise<MotionEarnings> {
  const response = await gatewayRequest(`${BASE}/me/earnings`, { schema: earningsEnvelope, signal: options.signal })
  return response.data.earnings
}

export type StartMotionPurchaseInput = {
  source: MotionSaleSource
  motionId: string
  motionRevisionId: string
  expectedPriceCredits: number
  intentKey: string
}

/** ONE purchase intent: the revision and the price the user saw. A replay of the same intent answers the same sale. */
export async function startMotionPurchase(input: StartMotionPurchaseInput): Promise<MotionPurchase> {
  const response = await gatewayRequest(`${BASE}/purchases`, {
    method: 'POST',
    csrf: true,
    body: {
      source: input.source,
      motion_id: input.motionId,
      motion_revision_id: input.motionRevisionId,
      expected_price_credits: input.expectedPriceCredits,
      intent_key: input.intentKey,
    },
    schema: purchaseEnvelope,
  })
  return response.data.purchase
}

export async function getMotionPurchase(saleId: string, options: ReadOptions = {}): Promise<MotionPurchase> {
  const response = await gatewayRequest(`${BASE}/purchases/${encodeURIComponent(saleId)}`, { schema: purchaseEnvelope, signal: options.signal })
  return response.data.purchase
}

export type MotionPurchaseTransport = {
  start: typeof startMotionPurchase
  get: typeof getMotionPurchase
}

export const motionPurchaseGatewayTransport: MotionPurchaseTransport = {
  start: startMotionPurchase,
  get: getMotionPurchase,
}

/** A sale still `charging` is polled briefly (Billing answered late); the server job finishes it either way. */
const POLL_DELAYS_MS = [1000, 2000, 3000, 5000]
const POLL_BUDGET_MS = 60_000

export type MotionPurchaseOutcome =
  /** The buyer's workspace owns it now (`purchase.already_owned` says it owned it before this click). */
  | { status: 'sold'; purchase: MotionPurchase }
  /** The wait budget ended; the server keeps going and the Motion becomes usable when the sale completes. */
  | { status: 'processing'; purchase: MotionPurchase }
  /** The caller stopped following (screen closed); nothing is undone on the server. */
  | { status: 'cancelled'; purchase: MotionPurchase }
  /** T1R-4: the sale ended `failed` while it was followed (a short balance, a Billing refusal): nothing was charged, nothing is owned. */
  | { status: 'failed'; purchase: MotionPurchase }

export type FollowMotionPurchaseOptions = {
  transport?: MotionPurchaseTransport
  /** Injected for tests; the real wait is a timer. */
  wait?: (ms: number) => Promise<void>
  now?: () => number
  budgetMs?: number
  isCancelled?: () => boolean
}

/** Follows one sale to `sold` (or until the wait budget ends); it never starts a second purchase. */
export async function followMotionPurchase(first: MotionPurchase, options: FollowMotionPurchaseOptions = {}): Promise<MotionPurchaseOutcome> {
  const transport = options.transport ?? motionPurchaseGatewayTransport
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const now = options.now ?? (() => Date.now())
  const budgetMs = options.budgetMs ?? POLL_BUDGET_MS
  const started = now()
  let purchase = first
  let attempt = 0
  while (purchase.state === 'charging') {
    if (options.isCancelled?.()) return { status: 'cancelled', purchase }
    if (now() - started > budgetMs) return { status: 'processing', purchase }
    await wait(POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)]!)
    attempt += 1
    if (options.isCancelled?.()) return { status: 'cancelled', purchase }
    try {
      purchase = await transport.get(purchase.sale_id)
    } catch {
      // The sale exists (its id is known): a poll that timed out, was throttled or hit a bad gateway says nothing about it. It is
      // still completing on the server, never a failed purchase and never a reason to start another one (T1R-4).
      return { status: 'processing', purchase }
    }
  }
  // The POST answers a failed sale as a 402, but a poll answers it as a 200 with `state: failed`: that is not a purchase (T1R-4).
  if (purchase.state === 'failed') return { status: 'failed', purchase }
  return { status: 'sold', purchase }
}

export type BuyMotionOptions = FollowMotionPurchaseOptions & {
  source: MotionSaleSource
  motionId: string
  motionRevisionId: string
  expectedPriceCredits: number
  /** Fresh id per click (tests inject a fixed one). */
  createId?: () => string
}

/** One click: start the sale with the price and revision the user saw, and follow it. Errors are thrown as they are. */
export async function buyMotion(options: BuyMotionOptions): Promise<MotionPurchaseOutcome> {
  const transport = options.transport ?? motionPurchaseGatewayTransport
  const createId = options.createId ?? (() => crypto.randomUUID())
  const purchase = await transport.start({
    source: options.source,
    motionId: options.motionId,
    motionRevisionId: options.motionRevisionId,
    expectedPriceCredits: options.expectedPriceCredits,
    intentKey: `motion-buy:${createId()}`,
  })
  return followMotionPurchase(purchase, options)
}

/** Explanations of a marketplace step that cannot proceed (everything else keeps the caller's generic handling). */
export type MotionMarketNotice =
  | { kind: 'unavailable' }
  | { kind: 'listingNotAllowed'; reason: MotionListingReason }
  | { kind: 'listingChanged' }
  | { kind: 'priceChanged'; currentPriceCredits: number }
  | { kind: 'revisionChanged' }
  | { kind: 'selfPurchase' }
  | { kind: 'notForSale' }
  | { kind: 'insufficientCredits'; priceCredits: number; funding: 'top_up_only' | 'standard' }
  | { kind: 'purchaseRequired'; priceCredits: number }
  /** T1R-3: a member buying another user's Motion above the member limit: an owner or admin has to buy it. */
  | { kind: 'approvalRequired'; priceCredits: number; memberLimitCredits: number }
  /** T1R-4: the sale failed after it was accepted (nothing was charged). */
  | { kind: 'purchaseFailed' }

export const motionListingReasons = [
  'price_out_of_range',
  'revision_not_found',
  'not_owner',
  'licensed_source',
  'premium_source',
  'lineage_unverifiable',
  'admin_delisted',
] as const
export type MotionListingReason = (typeof motionListingReasons)[number]

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** A marketplace request error as a notice, or `null` when the caller's generic handling should apply. */
export function motionMarketNotice(error: unknown): MotionMarketNotice | null {
  if (!isAuthClientError(error)) return null
  const details = record(error.details)
  switch (error.code) {
    case 'MOTION_MARKETPLACE_UNAVAILABLE':
    case 'MOTION_LISTING_NOT_FOUND':
    case 'MOTION_SALE_NOT_FOUND':
      return { kind: 'unavailable' }
    case 'MOTION_LISTING_NOT_ALLOWED': {
      const reason = String(details?.['reason'] ?? '')
      return { kind: 'listingNotAllowed', reason: (motionListingReasons as readonly string[]).includes(reason) ? (reason as MotionListingReason) : 'revision_not_found' }
    }
    case 'MOTION_LISTING_CONFLICT':
      return { kind: 'listingChanged' }
    case 'MOTION_PRICE_CHANGED':
      return { kind: 'priceChanged', currentPriceCredits: Math.max(0, Number(details?.['current_price_credits']) || 0) }
    case 'MOTION_REVISION_CHANGED':
      return { kind: 'revisionChanged' }
    case 'MOTION_SELF_PURCHASE':
      return { kind: 'selfPurchase' }
    case 'MOTION_NOT_FOR_SALE':
      return { kind: 'notForSale' }
    case 'MOTION_INSUFFICIENT_CREDITS':
      return {
        kind: 'insufficientCredits',
        priceCredits: Math.max(1, Number(details?.['price_credits']) || 1),
        funding: details?.['funding'] === 'standard' ? 'standard' : 'top_up_only',
      }
    case 'MOTION_PURCHASE_REQUIRED':
      return { kind: 'purchaseRequired', priceCredits: Math.max(1, Number(details?.['price_credits']) || 1) }
    case 'MOTION_PURCHASE_APPROVAL_REQUIRED':
      return {
        kind: 'approvalRequired',
        priceCredits: Math.max(1, Number(details?.['price_credits']) || 1),
        memberLimitCredits: Math.max(1, Number(details?.['member_limit_credits']) || 200),
      }
    default:
      return null
  }
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/** The notice text from the `Motion.market` messages (no technical code ever reaches the user). */
export function motionMarketMessage(notice: MotionMarketNotice, t: Translate): string {
  switch (notice.kind) {
    case 'unavailable':
      return t('errors.unavailable')
    case 'listingNotAllowed':
      return t(`errors.listingNotAllowed.${notice.reason}`)
    case 'listingChanged':
      return t('errors.listingChanged')
    case 'priceChanged':
      return t('errors.priceChanged', { price: notice.currentPriceCredits })
    case 'revisionChanged':
      return t('errors.revisionChanged')
    case 'selfPurchase':
      return t('errors.selfPurchase')
    case 'notForSale':
      return t('errors.notForSale')
    case 'insufficientCredits':
      return t(notice.funding === 'top_up_only' ? 'errors.insufficientTopUp' : 'errors.insufficientCredits', { price: notice.priceCredits })
    case 'purchaseRequired':
      return t('errors.purchaseRequired', { price: notice.priceCredits })
    case 'approvalRequired':
      return t('errors.approvalRequired', { price: notice.priceCredits, limit: notice.memberLimitCredits })
    case 'purchaseFailed':
      return t('errors.purchaseFailed')
  }
}

/** Local validation of a seller's price input before the request (the server enforces the same bounds). */
export function motionListingPriceInputError(value: number): 'not_integer' | 'out_of_range' | null {
  if (!Number.isInteger(value)) return 'not_integer'
  if (value < motionListingPriceMin || value > motionListingPriceMax) return 'out_of_range'
  return null
}

/**
 * The seller's share and the platform's share of a price, in credits (tenths of a credit are exact: 70 % / 30 %). Shown in the sell
 * dialog so the seller sees what they will earn before they list.
 */
export function motionSellerShareCredits(priceCredits: number): { seller: number; platform: number } {
  const tenths = priceCredits * 10
  const platformTenths = Math.round(priceCredits * 3)
  return { seller: (tenths - platformTenths) / 10, platform: platformTenths / 10 }
}

/**
 * A bought Motion in the shape of the owner's own saved Motions (`MotionRevision` of the Motion editor client), so one card model serves
 * "mine" and "purchased". The fields a bought Motion does not have (the draft it came from) are empty.
 */
export function motionLibraryItemAsRevision(item: MotionLibraryItem) {
  return {
    motion_id: item.motion_id,
    motion_revision_id: item.motion_revision_id,
    revision_number: item.revision_number,
    draft_id: '',
    ref: { ...item.ref },
    blueprint_ref: item.blueprint_ref,
    title: { ...item.title },
    summary: item.summary,
    parameter_schema_hash: item.parameter_schema_hash,
    parameters: item.parameters,
    aspect_ratios: [...item.aspect_ratios],
    source_draft_version: 0,
    validation_receipt_id: '',
    published_at: item.purchased_at,
  }
}
