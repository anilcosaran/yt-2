import { listMotionLibrary, listMotionPremiumOffers, motionLibraryItemAsRevision, motionMarketNotice, type MotionPremiumOffer } from './motion-market'

/**
 * E1-I what the Spark Motion drawer needs from the marketplace, in the shape of its own cards (E1-D's `MotionCard`): the premium offers
 * (price and "owned" per Motion) and the Motions this workspace bought, as saved-Motion revisions so "My Motions" lists them with its own
 * card model. The marketplace fails on its own: a closed marketplace (404) leaves the Library and My Motions tabs exactly as they are and
 * the Premium tab says so, never an empty list pretending to be a catalogue.
 */

export type PremiumCardLike = { ref: { motion_id: string }; premium: boolean; priceCredits: number | null }

export type PremiumMerged<T> = T & {
  /** The price the server asks now (null when the card is not premium). */
  priceCredits: number | null
  /** This workspace bought it: the card is usable and the Buy button is gone. */
  owned: boolean
  offer: MotionPremiumOffer | null
}

/**
 * The cards with the server's premium truth on top: a card is premium exactly when the server lists an offer for its Motion (so an admin
 * price of 0 frees a premium_film Motion, and an admin price above 0 makes any catalogue Motion premium), with the price the server asks
 * and whether this workspace already owns it.
 */
export function mergePremiumOffers<T extends PremiumCardLike>(cards: readonly T[], offers: readonly MotionPremiumOffer[]): Array<PremiumMerged<T>> {
  const byMotion = new Map(offers.map((offer) => [offer.motion_id, offer]))
  return cards.map((card) => {
    const offer = byMotion.get(card.ref.motion_id) ?? null
    return { ...card, premium: offer !== null, priceCredits: offer?.price_credits ?? null, owned: offer?.owned ?? false, offer }
  })
}

export type MotionMarketDrawerData =
  | { status: 'ok'; offers: MotionPremiumOffer[]; purchased: Array<ReturnType<typeof motionLibraryItemAsRevision>> }
  /** `MOTION_MARKETPLACE_ENABLED` is closed: no purchase surface (the drawer keeps what it had). */
  | { status: 'unavailable' }
  | { status: 'error' }

/** One read of the premium offers and the workspace library (aborts with the drawer). */
export async function loadMotionMarketDrawerData(options: { signal?: AbortSignal } = {}): Promise<MotionMarketDrawerData> {
  const [offers, library] = await Promise.allSettled([listMotionPremiumOffers(options), listMotionLibrary(options)])
  if (offers.status === 'fulfilled' && library.status === 'fulfilled') {
    return { status: 'ok', offers: offers.value, purchased: library.value.map(motionLibraryItemAsRevision) }
  }
  const failure = offers.status === 'rejected' ? offers.reason : library.status === 'rejected' ? library.reason : null
  return motionMarketNotice(failure)?.kind === 'unavailable' ? { status: 'unavailable' } : { status: 'error' }
}
