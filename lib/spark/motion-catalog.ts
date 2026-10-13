import { listBrandMotionsConditional, type BrandMotionListItem, type BrandMotionListRead } from '@/lib/brand-kit/motions-api'
import {
  listOwnMotionRevisions,
  listVideoStylePresetOptions,
  motionExposedParameterSchema,
  type MotionExposedParameter,
  type MotionRevision,
  type VideoStylePresetOption,
} from '@/lib/motion-editor/api'
import { classifyMotionEditorError } from '@/lib/motion-editor/resource'
import { loadMotionMarketDrawerData, mergePremiumOffers, type MotionMarketDrawerData } from '@/lib/motion-market/drawer-data'
import type { MotionPremiumOffer } from '@/lib/motion-market/motion-market'

import type { CompositionMotionEnergy, CompositionMotionRevisionRef } from './composition-typed-edits'

/**
 * E1-D data of the Spark Motion drawer: the platform Motion catalogue (`GET /api/v1/brand/motions`, behind
 * `BRAND_MOTION_TYPED_SEEDS_ENABLED`), the user's own saved Motions (`GET /api/v1/brand/motion-revisions`, behind
 * `BRAND_MOTION_AUTHORING_ENABLED`) and the VideoStyle presets a Motion is inserted with (`BRAND_VIDEO_STYLE_ENABLED`),
 * normalised to one card model. Library = platform, My Motions = the user's saved ones plus the Motions the workspace bought
 * (E1-I), Premium = the platform Motions the marketplace lists an offer for (D3: bought once with credits per workspace; the
 * server's offer decides what is premium, its price and whether the workspace owns it). A closed gate is a state of its tab,
 * never an empty list pretending to be a catalogue. Server state only: nothing is kept in browser storage.
 */

export type MotionCardOrigin = 'platform' | 'mine'
export type MotionRatio = '16:9' | '9:16' | '1:1'

export type MotionCard = {
  /** Stable key (`motion_id:revision_id`). */
  key: string
  origin: MotionCardOrigin
  /**
   * The platform's premium family (`premium_film`), or - once the marketplace answered - exactly the Motions it lists an offer
   * for: shown in the Premium tab, priced, not insertable before the workspace bought it (E1-I).
   */
  premium: boolean
  /** The exact revision a project pins. */
  ref: CompositionMotionRevisionRef
  title: { en: string; tr: string }
  summary: string
  aspectRatios: readonly MotionRatio[]
  /** The energies the Motion offers; null when the source does not state them (a saved Motion). */
  energies: readonly CompositionMotionEnergy[] | null
  durationRange: { minFrames: number; maxFrames: number } | null
  /** The exposed `motion_exposure_v1` fields. */
  parameters: readonly MotionExposedParameter[]
  /** The first sample text (the card's face), when the revision carries one. */
  sampleText: string | null
  /** Credits of a premium Motion (D3 default until the server lists a price); null for every other card. */
  priceCredits: number | null
  /** E1-I: this workspace bought the premium Motion (insertable, no Buy button). */
  owned?: boolean
  /** E1-I: the marketplace offer behind a premium card (what the buy dialog names); null/absent when the marketplace did not answer. */
  offer?: MotionPremiumOffer | null
  /** A required, Spark-editable image field: the Motion cannot be inserted without a project image. */
  needsImage: boolean
}

/** D3: the platform's premium Motion price when no other is set (admin-set price, default 25 credits). */
export const PREMIUM_MOTION_DEFAULT_PRICE_CREDITS = 25

const RATIOS: readonly string[] = ['16:9', '9:16', '1:1']
const ENERGIES: readonly string[] = ['sakin', 'dengeli', 'canli']

const ratiosOf = (values: readonly string[]): MotionRatio[] => values.filter((value): value is MotionRatio => RATIOS.includes(value))

function parametersOf(values: readonly unknown[]): MotionExposedParameter[] {
  const out: MotionExposedParameter[] = []
  for (const value of values) {
    const parsed = motionExposedParameterSchema.safeParse(value)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

const needsImageOf = (parameters: readonly MotionExposedParameter[]) => parameters.some((parameter) => parameter.kind === 'media' && parameter.required && parameter.spark_editable)

function durationOf(parameters: readonly MotionExposedParameter[]): MotionCard['durationRange'] {
  const bounds = parameters.find((parameter) => parameter.kind === 'duration')?.duration
  return bounds ? { minFrames: bounds.min_frames, maxFrames: bounds.max_frames } : null
}

/** The platform card of one catalogue entry (its head revision is what a new instance pins). */
export function platformCard(item: BrandMotionListItem): MotionCard {
  const parameters = parametersOf(item.parameters)
  const premium = item.collection === 'premium_film'
  const sample = Object.entries(item.sample_values).find(([, value]) => typeof value === 'string' && value.trim() !== '')
  return {
    key: `${item.head_revision.ref.motion_id}:${item.head_revision.ref.motion_revision_id}`,
    origin: 'platform',
    premium,
    ref: { ...item.head_revision.ref },
    title: item.title,
    summary: item.summary,
    aspectRatios: ratiosOf(item.aspect_ratios),
    energies: item.energies.filter((energy): energy is CompositionMotionEnergy => ENERGIES.includes(energy)),
    durationRange: { minFrames: item.duration_range.min_frames, maxFrames: item.duration_range.max_frames },
    parameters,
    sampleText: typeof sample?.[1] === 'string' ? sample[1] : null,
    priceCredits: premium ? PREMIUM_MOTION_DEFAULT_PRICE_CREDITS : null,
    needsImage: needsImageOf(parameters),
  }
}

/** What a card of a saved or bought Motion needs of its immutable revision; the exposed fields are validated one by one. */
export type OwnedRevisionLike = Pick<MotionRevision, 'motion_id' | 'motion_revision_id' | 'ref' | 'title' | 'summary' | 'aspect_ratios'> & {
  parameters?: readonly unknown[]
}

/** The card of one of the user's saved Motions (an immutable revision; `ref` is what a project pins) or of a Motion the workspace bought. */
export function ownedCard(revision: OwnedRevisionLike): MotionCard {
  const parameters = parametersOf(revision.parameters ?? [])
  const scope = revision.ref.scope === 'project_private' ? 'project_private' : 'library'
  return {
    key: `${revision.motion_id}:${revision.motion_revision_id}`,
    origin: 'mine',
    premium: false,
    ref: { motion_id: revision.ref.motion_id, motion_revision_id: revision.ref.motion_revision_id, scope, manifest_sha256: revision.ref.manifest_sha256 },
    title: revision.title,
    summary: revision.summary,
    aspectRatios: ratiosOf(revision.aspect_ratios),
    energies: null,
    durationRange: durationOf(parameters),
    parameters,
    sampleText: null,
    priceCredits: null,
    needsImage: needsImageOf(parameters),
  }
}

const fold = (value: string, locale: 'en' | 'tr') => value.normalize('NFC').toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US')

/** Whether a card matches the search text: every word occurs in the title (either language) or the summary. */
export function matchesMotionQuery(card: MotionCard, query: string, locale: 'en' | 'tr'): boolean {
  const words = fold(query.trim(), locale).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [fold(card.title.en, locale), fold(card.title.tr, locale), fold(card.summary, locale)].join('\n')
  return words.every((word) => haystack.includes(word))
}

export type MotionCatalogTab = 'library' | 'mine' | 'premium'

/** The cards of one tab, filtered by the search text. */
export function motionTabCards(state: MotionCatalogState, tab: MotionCatalogTab, query: string, locale: 'en' | 'tr'): MotionCard[] {
  const source = tab === 'mine' ? state.mine.cards : state.platform.cards.filter((card) => card.premium === (tab === 'premium'))
  return source.filter((card) => matchesMotionQuery(card, query, locale))
}

export type MotionCatalogSection = { status: 'ok' | 'unavailable' | 'error'; cards: readonly MotionCard[] }

export type MotionCatalogState = {
  status: 'loading' | 'ready'
  /** The platform catalogue (Library + Premium). `unavailable` = `BRAND_MOTION_TYPED_SEEDS_ENABLED` is closed. */
  platform: MotionCatalogSection
  /** The user's saved Motions and the Motions the workspace bought. `unavailable` = `BRAND_MOTION_AUTHORING_ENABLED` is closed. */
  mine: MotionCatalogSection
  /** E1-I the marketplace read behind the Premium tab and the bought Motions; `unavailable` = `MOTION_MARKETPLACE_ENABLED` is closed. */
  market: { status: 'ok' | 'unavailable' | 'error' }
  /** The looks a Motion may be inserted with; `unavailable` = the VideoStyle surface is closed (nothing can be inserted). */
  styles: { status: 'ok' | 'unavailable' | 'error'; presets: readonly VideoStylePresetOption[] }
}

export type MotionCatalogApi = {
  /**
   * The platform catalogue. WP4: called with the ETag of the cards the catalogue holds (in memory), it may answer
   * `{ notModified: true }` and the held cards stay; a plain `{ data }` answer replaces them.
   */
  listMotions: (options: { signal?: AbortSignal; ifNoneMatch?: string | null }) => Promise<BrandMotionListRead>
  listOwn: typeof listOwnMotionRevisions
  listStyles: typeof listVideoStylePresetOptions
  /** The premium offers and the bought Motions of the workspace (E1-I); a closed marketplace is a status, never a throw. */
  loadMarket: typeof loadMotionMarketDrawerData
}

const DEFAULT_API: MotionCatalogApi = {
  listMotions: listBrandMotionsConditional,
  listOwn: listOwnMotionRevisions,
  listStyles: listVideoStylePresetOptions,
  loadMarket: loadMotionMarketDrawerData,
}

const INITIAL: MotionCatalogState = {
  status: 'loading',
  platform: { status: 'ok', cards: [] },
  mine: { status: 'ok', cards: [] },
  market: { status: 'ok' },
  styles: { status: 'ok', presets: [] },
}

type PurchasedRevision = Extract<MotionMarketDrawerData, { status: 'ok' }>['purchased'][number]

/** The Motions the workspace bought, after the user's own saved ones, once per revision. */
function withPurchased(own: readonly MotionCard[], purchased: readonly PurchasedRevision[]): MotionCard[] {
  const seen = new Set(own.map((card) => card.key))
  const bought = purchased.map((revision) => ownedCard(revision)).filter((card) => !seen.has(card.key))
  return [...own, ...bought]
}

/**
 * WP4 revalidation: a section that could not be read this time (`error`, a network blip) keeps the cards it showed; a gate
 * that closed (`unavailable`) or an answer that changed replaces them. A failed marketplace read is not papered over: the
 * premium offers it carries are merged into the other sections, so the Premium tab says so and its Retry reads again.
 */
function keepOnBlip(previous: MotionCatalogState, next: MotionCatalogState): MotionCatalogState {
  const keep = <T extends { status: string }>(before: T, after: T): T => (after.status === 'error' && before.status === 'ok' ? before : after)
  if (next.market.status !== previous.market.status) return next
  return {
    ...next,
    platform: keep(previous.platform, next.platform),
    mine: keep(previous.mine, next.mine),
    styles: keep(previous.styles, next.styles),
  }
}

function sectionStatus(error: unknown): 'unavailable' | 'error' {
  const failure = classifyMotionEditorError(error)
  // A closed gate answers 403 (typed seeds, authoring) or 404 (the VideoStyle surface answers as if it did not exist).
  return failure.kind === 'forbidden' || failure.kind === 'unavailable' || failure.kind === 'not_found' ? 'unavailable' : 'error'
}

/**
 * Loader of the drawer's catalogue. Each of the three reads fails on its own: a closed Motion authoring gate leaves the
 * Library usable, a closed catalogue leaves My Motions. `load()` runs again on retry and when the drawer reopens.
 *
 * WP4: the editor keeps one catalogue while it is open (`ctx.service`), in memory only. A `load()` after the first one
 * keeps showing the cards it has while it revalidates them (the platform list with its ETag: an unchanged catalogue is a
 * 304 without a body), so a reopened drawer is instant; a read that fails while revalidating keeps the cards it had.
 */
export class SparkMotionCatalog {
  private state: MotionCatalogState = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly api: MotionCatalogApi
  private controller: AbortController | null = null
  private generation = 0
  /** The platform list as the gateway last sent it, with its ETag (what a 304 means). */
  private platformList: { items: readonly BrandMotionListItem[]; etag: string | null } | null = null

  constructor(options: { api?: Partial<MotionCatalogApi> } = {}) {
    this.api = { ...DEFAULT_API, ...options.api }
    this.load = this.load.bind(this)
    this.dispose = this.dispose.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  async load(): Promise<void> {
    this.dispose()
    const generation = this.generation
    const controller = new AbortController()
    this.controller = controller
    const previous = this.state
    const revalidating = previous.status === 'ready'
    if (!revalidating) this.set({ ...INITIAL })
    const options = { signal: controller.signal }
    const held = this.platformList
    const [motions, own, styles, market] = await Promise.allSettled([
      this.api.listMotions({ ...options, ifNoneMatch: held?.etag ?? null }),
      this.api.listOwn(options),
      this.api.listStyles(options),
      this.api.loadMarket(options),
    ])
    if (generation !== this.generation || controller.signal.aborted) return
    this.controller = null
    let platformItems: readonly BrandMotionListItem[] | null = null
    if (motions.status === 'fulfilled') {
      const read = motions.value
      if (read.notModified === true) platformItems = held?.items ?? null
      else {
        platformItems = read.data
        this.platformList = { items: read.data, etag: read.etag ?? null }
      }
    }
    const marketData: MotionMarketDrawerData = market.status === 'fulfilled' ? market.value : { status: 'error' }
    const offers = marketData.status === 'ok' ? marketData.offers : null
    const purchased = marketData.status === 'ok' ? marketData.purchased : []
    const next: MotionCatalogState = {
      status: 'ready',
      platform: platformItems
        ? { status: 'ok', cards: offers ? mergePremiumOffers(platformItems.map(platformCard), offers) : platformItems.map(platformCard) }
        : { status: motions.status === 'rejected' ? sectionStatus(motions.reason) : 'error', cards: [] },
      mine:
        own.status === 'fulfilled'
          ? { status: 'ok', cards: withPurchased(own.value.map(ownedCard), purchased) }
          : purchased.length > 0
            ? { status: 'ok', cards: withPurchased([], purchased) }
            : { status: sectionStatus(own.reason), cards: [] },
      market: { status: marketData.status },
      styles:
        styles.status === 'fulfilled'
          ? { status: 'ok', presets: styles.value }
          : { status: sectionStatus(styles.reason), presets: [] },
    }
    this.set(revalidating ? keepOnBlip(previous, next) : next)
  }

  /** Stops an in-flight read (unmount, or the next `load`). */
  dispose(): void {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
  }

  private set(next: MotionCatalogState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}
