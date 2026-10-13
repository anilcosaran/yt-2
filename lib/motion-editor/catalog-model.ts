import type { BrandMotionListItem } from '@/lib/brand-kit/motions-api'

import type { MotionDraftListItem, MotionExposedParameter, MotionRevision } from './api'

/**
 * `/motion` catalog model: the three things the Motion area lists (the platform catalogue, the user's saved Motions and the
 * user's drafts) normalised to ONE card model, plus the pure filtering the screen does (tab, category chip, search). Nothing
 * here reads the server or the browser: the library session hands the lists in, the screen keeps tab/category/search in the
 * URL (never in browser storage). Categories are DERIVED from what the server already says (the `blueprint_ref` of the
 * Motion, or of the draft a saved Motion was published from); no backend field was invented for them.
 */

export type CatalogTab = 'catalog' | 'mine' | 'drafts'
export const CATALOG_TABS: readonly CatalogTab[] = ['catalog', 'mine', 'drafts']

export type CatalogItemKind = 'platform' | 'mine' | 'draft'
export type CatalogRatio = '16:9' | '9:16' | '1:1'

export const CATEGORY_IDS = ['titles', 'data', 'social', 'overlays', 'captions', 'logo', 'camera', 'media', 'other'] as const
export type CategoryId = (typeof CATEGORY_IDS)[number]

/** The frame rate a Motion's natural length is stated at on a card (the compile's own rate is used once a preview is drawn). */
export const CATALOG_FPS = 30
/** Seconds a Motion plays when its own range allows (the same default the Spark drawer inserts with). */
export const CATALOG_DEFAULT_SECONDS = 4

const SLUG_CATEGORY: Record<string, CategoryId> = {
  'baslik-karti': 'titles',
  'kinetik-baslik': 'titles',
  'premium-kinetik-tanitim': 'titles',
  'premium-kelime-karti': 'titles',
  'premium-metin-dagilmasi': 'titles',
  'premium-cok-renkli-vurgu': 'titles',
  'premium-nefes-karti': 'titles',
  'premium-goruntu-ustu-metin': 'titles',
  'sayi-vurusu': 'data',
  karsilastirma: 'data',
  'ozellik-izgarasi': 'data',
  'rota-haritasi': 'data',
  'premium-deger-kaydirici': 'data',
  'premium-cip-etiket': 'data',
  'premium-varyant-dizilimi': 'data',
  'sohbet-hikayesi': 'social',
  'prompt-yaz-uret': 'social',
  'uygulama-ikonu': 'social',
  'alt-bant': 'overlays',
  'premium-yasal-dipnot': 'overlays',
  'altyazi-bandi': 'captions',
  'logo-cta': 'logo',
  'premium-logo-kilidi': 'logo',
  'kamera-yolculugu': 'camera',
  'detaydan-geri-cekil': 'camera',
  'premium-makro-supurme': 'camera',
  'premium-kahraman-cekim': 'camera',
  'premium-cihaz-ucusu': 'camera',
  'cihaz-vitrini': 'media',
  'metin-medya': 'media',
}

/** The category of a blueprint (`alt-bant@1` -> overlays); a blueprint this table does not know is `other`, never guessed. */
export function categoryOfBlueprint(blueprintRef: string | null | undefined): CategoryId {
  if (!blueprintRef) return 'other'
  const slug = blueprintRef.replace(/@\d+$/, '')
  return SLUG_CATEGORY[slug] ?? 'other'
}

export type CatalogItem = {
  /** Unique across kinds: the platform `motion_id`, a saved Motion's `motion_revision_id`, a draft's `draft_id` (the `?motion=` deep link). */
  id: string
  kind: CatalogItemKind
  title: { en: string; tr: string }
  summary: string
  category: CategoryId
  /** The formats the Motion offers (empty for a draft: its list row does not say). */
  aspectRatios: readonly CatalogRatio[]
  /** The Motion's natural length in frames at `CATALOG_FPS`; null when the source does not state it. */
  durationFrames: number | null
  /** Premium platform Motion (bought once per workspace in Community Motions). */
  premium: boolean
  /** A premium Motion the workspace has not bought: a shop window without parameters or samples. */
  locked: boolean
  /** The first sample text: the face of the poster. */
  sampleText: string | null
  sampleValues: Readonly<Record<string, string | number>>
  parameters: readonly MotionExposedParameter[]
  /** The draft whose compile is drawn live on the card (a draft, or the draft a saved Motion was published from); null = no compile to draw. */
  draftId: string | null
  /** Deterministic poster colour. */
  hue: number
  /** Draft rows: the version and whether it passed validation. */
  draftVersion?: number
  validated?: boolean
  /** The source row, for the actions (customize forks a platform item; a saved Motion pins its revision). */
  platform?: BrandMotionListItem
  revision?: MotionRevision
}

const RATIO_ORDER: readonly CatalogRatio[] = ['16:9', '9:16', '1:1']
const ratiosOf = (values: readonly string[]): CatalogRatio[] => RATIO_ORDER.filter((ratio) => values.includes(ratio))

function hueOf(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  return hash % 360
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function naturalFrames(range: { min: number; max: number } | null): number | null {
  if (!range) return null
  return clamp(Math.round(CATALOG_DEFAULT_SECONDS * CATALOG_FPS), range.min, range.max)
}

function exposedParameters(values: readonly unknown[]): MotionExposedParameter[] {
  return values.filter(
    (value): value is MotionExposedParameter =>
      typeof value === 'object' && value !== null && typeof (value as { parameter_id?: unknown }).parameter_id === 'string' && typeof (value as { kind?: unknown }).kind === 'string',
  )
}

export function platformItem(motion: BrandMotionListItem): CatalogItem {
  const sample = Object.entries(motion.sample_values).find(([, value]) => typeof value === 'string' && value.trim() !== '')
  return {
    id: motion.motion_id,
    kind: 'platform',
    title: motion.title,
    summary: motion.summary,
    category: categoryOfBlueprint(motion.blueprint_ref),
    aspectRatios: ratiosOf(motion.aspect_ratios),
    durationFrames: naturalFrames({ min: motion.duration_range.min_frames, max: motion.duration_range.max_frames }),
    premium: motion.collection === 'premium_film',
    locked: motion.content_locked === true,
    sampleText: typeof sample?.[1] === 'string' ? sample[1] : null,
    sampleValues: motion.sample_values,
    parameters: exposedParameters(motion.parameters),
    draftId: null,
    hue: hueOf(motion.motion_id),
    platform: motion,
  }
}

export function revisionItem(revision: MotionRevision, drafts: readonly MotionDraftListItem[]): CatalogItem {
  const parameters = exposedParameters(revision.parameters ?? [])
  const duration = parameters.find((parameter) => parameter.kind === 'duration')?.duration
  // A saved Motion's own blueprint is its private id; its category is the one of the Motion it was made from.
  const origin = drafts.find((draft) => draft.draft_id === revision.draft_id)
  return {
    id: revision.motion_revision_id,
    kind: 'mine',
    title: revision.title,
    summary: revision.summary,
    category: categoryOfBlueprint(origin?.source.blueprint_ref),
    aspectRatios: ratiosOf(revision.aspect_ratios),
    durationFrames: naturalFrames(duration ? { min: duration.min_frames, max: duration.max_frames } : null),
    premium: false,
    locked: false,
    sampleText: null,
    sampleValues: {},
    parameters,
    draftId: revision.draft_id,
    hue: hueOf(revision.motion_id),
    revision,
  }
}

export function draftItem(draft: MotionDraftListItem): CatalogItem {
  return {
    id: draft.draft_id,
    kind: 'draft',
    title: { en: draft.name, tr: draft.name },
    summary: '',
    category: categoryOfBlueprint(draft.source.blueprint_ref),
    aspectRatios: [],
    durationFrames: null,
    premium: false,
    locked: false,
    sampleText: null,
    sampleValues: {},
    parameters: [],
    draftId: draft.draft_id,
    hue: hueOf(draft.draft_id),
    draftVersion: draft.draft_version,
    validated: draft.validated,
  }
}

export type CatalogSources = {
  motions: readonly BrandMotionListItem[]
  revisions: readonly MotionRevision[]
  drafts: readonly MotionDraftListItem[]
}

export type CatalogByTab = Record<CatalogTab, readonly CatalogItem[]>

export function buildCatalog(sources: CatalogSources): CatalogByTab {
  return {
    catalog: sources.motions.map(platformItem),
    mine: sources.revisions.map((revision) => revisionItem(revision, sources.drafts)),
    drafts: sources.drafts.map(draftItem),
  }
}

export const titleOf = (item: Pick<CatalogItem, 'title'>, locale: 'en' | 'tr'): string => item.title[locale] || item.title.en

const fold = (value: string, locale: 'en' | 'tr') => value.normalize('NFC').toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US')

/** Whether an item matches the search text: every word occurs in its title (either language), summary, blueprint or category label. */
export function matchesCatalogQuery(item: CatalogItem, query: string, locale: 'en' | 'tr', categoryLabel: string): boolean {
  const words = fold(query.trim(), locale).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const blueprint = item.platform?.blueprint_ref ?? item.revision?.blueprint_ref ?? ''
  const haystack = [item.title.en, item.title.tr, item.summary, blueprint, categoryLabel].map((part) => fold(part, locale)).join('\n')
  return words.every((word) => haystack.includes(word))
}

export type CatalogFilter = { query: string; category: CategoryId | null; locale: 'en' | 'tr' }

/** Items of one tab that match the search text (the category chips count these). */
export function searchCatalog(items: readonly CatalogItem[], filter: Pick<CatalogFilter, 'query' | 'locale'>, categoryLabel: (category: CategoryId) => string): CatalogItem[] {
  return items.filter((item) => matchesCatalogQuery(item, filter.query, filter.locale, categoryLabel(item.category)))
}

export type CategoryCount = { id: CategoryId; count: number }

/** The category chips of the searched items: only categories that hold something, in the fixed order, with their counts. */
export function categoryCounts(items: readonly CatalogItem[]): CategoryCount[] {
  const counts = new Map<CategoryId, number>()
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  return CATEGORY_IDS.filter((id) => counts.has(id)).map((id) => ({ id, count: counts.get(id)! }))
}

export function filterCatalog(items: readonly CatalogItem[], filter: CatalogFilter, categoryLabel: (category: CategoryId) => string): CatalogItem[] {
  const searched = searchCatalog(items, filter, categoryLabel)
  return filter.category ? searched.filter((item) => item.category === filter.category) : searched
}

export function isCategoryId(value: string | null | undefined): value is CategoryId {
  return value != null && (CATEGORY_IDS as readonly string[]).includes(value)
}

export function isCatalogTab(value: string | null | undefined): value is CatalogTab {
  return value != null && (CATALOG_TABS as readonly string[]).includes(value)
}

/** `m:ss` of a length in seconds, rounded to the nearest second (`16` -> `0:16`). */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The card's meta line, e.g. `0:04 · 16:9` (a part the source does not state is left out). */
export function metaLine(item: Pick<CatalogItem, 'durationFrames' | 'aspectRatios'>, live: { durationSeconds: number; ratio: string } | null = null): string {
  const parts: string[] = []
  if (live) parts.push(formatClock(live.durationSeconds), live.ratio)
  else {
    if (item.durationFrames !== null) parts.push(formatClock(item.durationFrames / CATALOG_FPS))
    const ratio = item.aspectRatios[0]
    if (ratio) parts.push(ratio)
  }
  return parts.join(' · ')
}

/** The starter a "Create motion" prompt forks: the first free, unlocked platform Motion (there is no empty-draft API). */
export function starterMotion(motions: readonly BrandMotionListItem[]): BrandMotionListItem | null {
  return motions.find((motion) => motion.collection !== 'premium_film' && motion.content_locked !== true) ?? null
}
