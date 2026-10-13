import {
  buyMotion,
  motionMarketNotice,
  type FollowMotionPurchaseOptions,
  type MotionMarketNotice,
  type MotionPurchase,
  type MotionPurchaseTransport,
  type MotionSaleSource,
} from './motion-market'

/**
 * E1-I what the buy dialog buys: the Motion, the exact revision and the price the user SAW (the server charges nothing when either
 * changed). `source` says whose it is: a Community listing (paid from the top-up balance only) or a platform premium Motion (normal funding
 * order).
 */
export type MotionBuyTarget = {
  source: MotionSaleSource
  motionId: string
  motionRevisionId: string
  priceCredits: number
  title: { en: string; tr: string }
  summary: string
  /** The seller's Community name, when the Motion is a Community listing and the seller has one. */
  seller: string | null
}

export type MotionBuyState =
  | { phase: 'confirm'; notice: MotionMarketNotice | null; failed: boolean }
  | { phase: 'buying' }
  /** The wait budget ended while the sale was still completing; the server finishes it. */
  | { phase: 'processing'; purchase: MotionPurchase }
  | { phase: 'done'; purchase: MotionPurchase }

export type MotionBuyOptions = Pick<FollowMotionPurchaseOptions, 'wait' | 'now' | 'budgetMs'> & {
  transport?: MotionPurchaseTransport
  createId?: () => string
  /** The workspace owns the Motion now (bought, or it already did): refresh the cards and the library. */
  onPurchased?: (purchase: MotionPurchase) => void
  /** The seller changed the Motion under the buyer (revision) or it is gone: the card must be read again. */
  onStale?: () => void
}

const INITIAL: MotionBuyState = { phase: 'confirm', notice: null, failed: false }

/**
 * One buy flow. The click starts ONE purchase intent with the price the user saw and follows the sale to `sold`; a changed price shows the
 * new price and asks again (the next click names it), a refusal says why in the user's words, a balance that cannot pay says so and
 * charges nothing, and a sale still completing after the wait budget is reported as processing (never as failed, never started twice).
 * Server state only: nothing is kept in browser storage.
 */
export class MotionBuySession {
  private state: MotionBuyState = INITIAL
  private price: number
  private cancelled = false
  private readonly listeners = new Set<() => void>()

  constructor(
    readonly target: MotionBuyTarget,
    private readonly options: MotionBuyOptions = {},
  ) {
    this.price = target.priceCredits
    this.buy = this.buy.bind(this)
    this.cancel = this.cancel.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** The price the next click names (the target's, or the current one after a price change). */
  get priceCredits(): number {
    return this.price
  }

  async buy(): Promise<void> {
    if (this.state.phase === 'buying' || this.state.phase === 'done') return
    this.cancelled = false
    this.set({ phase: 'buying' })
    try {
      const outcome = await buyMotion({
        source: this.target.source,
        motionId: this.target.motionId,
        motionRevisionId: this.target.motionRevisionId,
        expectedPriceCredits: this.price,
        transport: this.options.transport,
        wait: this.options.wait,
        now: this.options.now,
        budgetMs: this.options.budgetMs,
        createId: this.options.createId,
        isCancelled: () => this.cancelled,
      })
      if (outcome.status === 'cancelled') return
      if (outcome.status === 'failed') {
        // T1R-4: a sale that failed while followed is not a purchase: say so truthfully and keep the way to add credits.
        const { purchase } = outcome
        const notice: MotionMarketNotice =
          purchase.reason_code === 'insufficient_credits'
            ? { kind: 'insufficientCredits', priceCredits: purchase.price_credits, funding: purchase.funding === 'standard' ? 'standard' : 'top_up_only' }
            : { kind: 'purchaseFailed' }
        this.set({ phase: 'confirm', notice, failed: true })
        return
      }
      if (outcome.status === 'processing') {
        this.set({ phase: 'processing', purchase: outcome.purchase })
        return
      }
      this.set({ phase: 'done', purchase: outcome.purchase })
      this.options.onPurchased?.(outcome.purchase)
    } catch (error) {
      const notice = motionMarketNotice(error)
      if (notice?.kind === 'priceChanged') this.price = notice.currentPriceCredits
      if (notice?.kind === 'revisionChanged' || notice?.kind === 'unavailable' || notice?.kind === 'notForSale') this.options.onStale?.()
      this.set({ phase: 'confirm', notice, failed: true })
    }
  }

  /** The dialog closed: stop following the sale (nothing is undone on the server; it finishes there). */
  cancel(): void {
    this.cancelled = true
  }

  private set(next: MotionBuyState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

export function motionBuyTargetFromOffer(offer: {
  motion_id: string
  motion_revision_id: string
  price_credits: number
  title: { en: string; tr: string }
  summary: string
}): MotionBuyTarget {
  return {
    source: 'platform',
    motionId: offer.motion_id,
    motionRevisionId: offer.motion_revision_id,
    priceCredits: offer.price_credits,
    title: offer.title,
    summary: offer.summary,
    seller: null,
  }
}

export function motionBuyTargetFromListing(listing: {
  motion_id: string
  motion_revision_id: string
  price_credits: number
  title: { en: string; tr: string }
  summary: string
  seller: { username: string | null } | null
}): MotionBuyTarget {
  return {
    source: 'community',
    motionId: listing.motion_id,
    motionRevisionId: listing.motion_revision_id,
    priceCredits: listing.price_credits,
    title: listing.title,
    summary: listing.summary,
    seller: listing.seller?.username ?? null,
  }
}
