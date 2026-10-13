'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { getStockStatus, type StockCard, type StockTransport } from '@/lib/media-catalog/stock-api'
import { writeCardDrag } from '@/lib/spark/stage/placement'
import { createSparkStockCreate, type SparkStockCreate } from '@/lib/media-catalog/stock-create'
import {
  createSparkStockPanel,
  type SparkStockPanel,
  type StockKindFilter,
  type StockNotice,
  type StockPlaceSource,
} from '@/lib/media-catalog/stock-panel'

/** Typing settles before the catalogue is searched (one request per pause, not per key). */
const SEARCH_DEBOUNCE_MS = 300
/** P06-40: the price of a typed creation request is asked once typing settles. */
const QUOTE_DEBOUNCE_MS = 500
// The design shows a notice for 2.2 s.
const NOTICE_MS = 2200

/**
 * P06-16 F26: the Media rail tool opens only when the platform catalogue is available (server gate + taxonomy).
 * `loading` and `unavailable` keep the tool disabled; nothing is cached in browser storage.
 */
export function useStockAvailability(load: () => Promise<{ source_status: string }> = getStockStatus): 'loading' | 'available' | 'unavailable' {
  const [status, setStatus] = React.useState<'loading' | 'available' | 'unavailable'>('loading')
  React.useEffect(() => {
    let active = true
    load().then(
      (value) => { if (active) setStatus(value.source_status === 'available' ? 'available' : 'unavailable') },
      () => { if (active) setStatus('unavailable') },
    )
    return () => { active = false }
  }, [load])
  return status
}

/** Drag payload kind of a Stock card (the Media tool places it when it is dropped on the canvas or the timeline, D14). */
export const STOCK_CARD_KIND = 'stock_item'

/**
 * E1-A D14: how a dragged Stock card is acquired and placed where it was dropped. `place` inserts the acquired source;
 * resolves true when the clip was placed.
 */
export type StockDropHandler = (
  ref: { itemId: string; revision: number },
  place: (sourceId: string, kind: 'image' | 'video') => Promise<number | null>,
) => Promise<boolean>

/**
 * P06-16 Spark Media drawer, Stock tab (the design's left panel: source segments, search, kind + topic chips, masonry
 * grid, "Add to scene" on hover). Platform catalogue only; Library/Uploads are not connected here and stay visible but
 * disabled. Cards come from the server (no sample array); grid previews are requested only for visible cards; "Add"
 * acquires the item for this project and then inserts one clip as a new scene (a separate command). P06-40: the design's
 * "Generate with AI" row opens the create box (Stock'ta Oluştur) when the catalogue has a model for a kind; otherwise it
 * stays passive with the reason.
 */
export function SparkStockDrawer({
  projectId,
  canWrite,
  writeTitle,
  insertSourceClip,
  transport,
  panel: injectedPanel,
  create: injectedCreate,
  sourceTabs,
  registerDrop,
}: {
  projectId: string
  canWrite: boolean
  writeTitle: string | undefined
  insertSourceClip: (sourceId: string, kind: 'image' | 'video') => Promise<number | null>
  transport?: StockTransport
  /** Tests render a pre-loaded panel statically. */
  panel?: SparkStockPanel
  /** Tests render a pre-loaded create controller statically. */
  create?: SparkStockCreate
  /** E1-A: the Media drawer's own tab strip (Upload / My media / Stock) in place of the Stock-only one. */
  sourceTabs?: React.ReactNode
  /** E1-A D14: registers the handler of a Stock card dropped on the canvas or the timeline (null when the drawer closes). */
  registerDrop?: (handler: StockDropHandler | null) => void
}) {
  const t = useTranslations('Spark.editor.stock')
  const comingSoon = useTranslations('Spark.editor')('comingSoon')
  const [panel] = React.useState<SparkStockPanel>(
    () => injectedPanel ?? createSparkStockPanel({ projectId, ...(transport && { transport }) }),
  )
  const place = React.useCallback<StockPlaceSource>(({ sourceId, card }) => insertSourceClip(sourceId, card.kind), [insertSourceClip])
  const state = React.useSyncExternalStore(panel.subscribe, panel.getSnapshot, panel.getSnapshot)
  const [query, setQuery] = React.useState('')
  const insertRef = React.useRef(insertSourceClip)
  insertRef.current = insertSourceClip
  const [creator] = React.useState<SparkStockCreate>(() => injectedCreate ?? createSparkStockCreate({
    projectId,
    notify: (kind, values) => panel.announce(kind, values),
    place: ({ sourceId, kind }) => insertRef.current(sourceId, kind),
  }))

  React.useEffect(() => {
    void panel.load()
    return () => panel.dispose()
  }, [panel])

  React.useEffect(() => {
    if (!registerDrop) return undefined
    registerDrop(async (ref, place) => {
      const card = panel.getSnapshot().items.find((candidate) => candidate.item_id === ref.itemId && candidate.revision === ref.revision)
      if (!card) return false
      let placed = false
      await panel.add(card, async ({ sourceId, card: acquired }) => {
        const scene = await place(sourceId, acquired.kind === 'video' ? 'video' : 'image')
        placed = scene !== null
        return scene
      })
      return placed
    })
    return () => registerDrop(null)
  }, [panel, registerDrop])

  React.useEffect(() => {
    if (!injectedCreate) void creator.load()
    return () => creator.dispose()
  }, [creator, injectedCreate])

  React.useEffect(() => {
    const timer = window.setTimeout(() => panel.setQuery(query), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [panel, query])

  const categories = state.categories.filter((category) => state.kind === 'all' || category.kinds.includes(state.kind))
  const kindChip = (kind: StockKindFilter) => (
    <button
      key={kind}
      type="button"
      className={`fchip${state.kind === kind ? ' on' : ''}`}
      aria-pressed={state.kind === kind}
      onClick={() => panel.setKind(kind)}
    >
      {t(`kinds.${kind}`)}
    </button>
  )
  const categoryLabel = (id: string) => (t.has(`categories.${id}`) ? t(`categories.${id}`) : id)

  return (
    <>
      <div className="dr-body">
        {sourceTabs ?? (
          <div className="seg" role="tablist">
            <button type="button" role="tab" aria-selected className="on">{t('sources.stock')}</button>
            <button type="button" role="tab" aria-selected={false} disabled title={`${t('sources.library')} · ${comingSoon}`}>
              {t('sources.library')}
            </button>
            <button type="button" role="tab" aria-selected={false} disabled title={`${t('sources.uploads')} · ${comingSoon}`}>
              {t('sources.uploads')}
            </button>
          </div>
        )}
        <div className="search" style={{ marginTop: 10 }}>
          <StudioIcon name="search" size="sm" />
          <input
            aria-label={t('searchPlaceholder')}
            placeholder={t('searchPlaceholder')}
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="ib xs" disabled title={`${t('filters')} · ${comingSoon}`} aria-label={t('filters')}>
            <StudioIcon name="sliders" size="sm" />
          </button>
        </div>
        <div className="chips-x" style={{ marginTop: 10 }}>
          {(['all', 'image', 'video'] as const).map(kindChip)}
          <span className="vsep" />
          <button
            type="button"
            className={`fchip${state.category === null ? ' on' : ''}`}
            aria-pressed={state.category === null}
            onClick={() => panel.setCategory(null)}
          >
            {t('allTopics')}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`fchip${state.category === category.id ? ' on' : ''}`}
              aria-pressed={state.category === category.id}
              onClick={() => panel.setCategory(category.id)}
            >
              {categoryLabel(category.id)}
            </button>
          ))}
        </div>
        <StockCreateBox creator={creator} canWrite={canWrite} writeTitle={writeTitle} />
        <StockResults
          panel={panel}
          state={state}
          query={query}
          canWrite={canWrite}
          writeTitle={writeTitle}
          place={place}
        />
      </div>
      <StockToast notice={state.notice} />
    </>
  )
}

function StockResults({
  panel,
  state,
  query,
  canWrite,
  writeTitle,
  place,
}: {
  panel: SparkStockPanel
  state: ReturnType<SparkStockPanel['getSnapshot']>
  query: string
  canWrite: boolean
  writeTitle: string | undefined
  place: StockPlaceSource
}) {
  const t = useTranslations('Spark.editor.stock')
  if (state.status === 'loading') {
    return (
      <div className="dr-label" role="status" aria-live="polite">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="spin" aria-hidden />
          {t('loading')}
        </span>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="mm-empty" role="alert" style={{ padding: '32px 12px' }}>
        <p>{t('loadFailed')}</p>
        <button type="button" className="lnk" onClick={() => void panel.retry()}>{t('retry')}</button>
      </div>
    )
  }
  if (state.status === 'unavailable') return null
  return (
    <>
      <div className="dr-label">
        <span>{t('results', { count: state.items.length })}</span>
        {state.searching ? <span className="spin" aria-hidden /> : null}
      </div>
      {state.items.length === 0 ? (
        <div className="mm-empty" style={{ padding: '32px 12px' }}>
          {query.trim() ? t('empty', { query: query.trim() }) : t('emptyAll')}
        </div>
      ) : (
        <div className="masonry">
          {state.items.map((card) => (
            <StockTile
              key={`${card.item_id}:${card.revision}`}
              card={card}
              panel={panel}
              busy={Boolean(state.adding[card.item_id])}
              canWrite={canWrite}
              writeTitle={writeTitle}
              place={place}
            />
          ))}
        </div>
      )}
      {state.nextCursor ? (
        <button type="button" className="add-scene" disabled={state.loadingMore} onClick={() => void panel.loadMore()}>
          {state.loadingMore ? <span className="spin" aria-hidden /> : null}
          {t('loadMore')}
        </button>
      ) : null}
    </>
  )
}

function StockTile({
  card,
  panel,
  busy,
  canWrite,
  writeTitle,
  place,
}: {
  card: StockCard
  panel: SparkStockPanel
  busy: boolean
  canWrite: boolean
  writeTitle: string | undefined
  place: StockPlaceSource
}) {
  const t = useTranslations('Spark.editor.stock')
  const ref = React.useRef<HTMLDivElement>(null)
  const visible = useInView(ref)
  const [url, setUrl] = React.useState<string | null>(null)
  const [broken, setBroken] = React.useState(false)

  React.useEffect(() => {
    if (!visible) return undefined
    let active = true
    // Only a visible card asks for its grid preview; a failure keeps the placeholder (no large original).
    void panel.previewUrl(card).then((value) => { if (active) setUrl(value) })
    return () => { active = false }
  }, [visible, panel, card])

  const title = card.title ?? t('untitled')
  const price = t('price', { credits: card.price_credits })
  const width = card.width ?? 16
  const height = card.height ?? 9
  const hue = hueOf(card.item_id)
  const canAdd = canWrite && card.allowed_actions.includes('acquire')
  const tooltip = [t('tileTitle', { title, price }), card.license?.attribution_required && card.license.attribution_text
    ? t('attribution', { text: card.license.attribution_text })
    : null].filter(Boolean).join('\n')

  return (
    <div
      ref={ref}
      className="mt"
      title={tooltip}
      data-item={card.item_id}
      draggable={canAdd && !busy}
      onDragStart={(event) => {
        writeCardDrag(event.dataTransfer, { tool: 'media', kind: STOCK_CARD_KIND, data: { itemId: card.item_id, revision: card.revision } })
      }}
      style={{
        aspectRatio: `${width}/${height}`,
        background: `linear-gradient(135deg,hsl(${hue} 25% 42%),hsl(${(hue + 40) % 360} 25% 22%))`,
      }}
    >
      {/* A short-lived signed grid preview (Storage delivery); next/image would proxy and cache it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && !broken ? <img loading="lazy" alt="" draggable={false} src={url} onError={() => setBroken(true)} /> : null}
      {card.kind === 'video' && card.duration_ms ? (
        <span className="dur-b">
          <StudioIcon name="play" />
          {formatDuration(card.duration_ms)}
        </span>
      ) : null}
      <span className="mt-t">{title}</span>
      {busy ? (
        <span className="add-b" style={{ opacity: 1, transform: 'none' }} role="status" aria-label={t('adding')}>
          <span className="spin" aria-hidden />
        </span>
      ) : (
        <button
          type="button"
          className="add-b"
          disabled={!canAdd}
          title={canAdd ? `${t('add')} · ${price}` : writeTitle}
          aria-label={`${t('add')}: ${title} · ${price}`}
          onClick={() => void panel.add(card, place)}
        >
          <StudioIcon name="plus" size="sm" />
        </button>
      )}
    </div>
  )
}

/**
 * P06-40 "Stock'ta Oluştur": the design's `ai-row` + `ai-box` (prompt, kind and ratio chips, Create). The button shows the
 * server's price of exactly this request; a passive row names why (no catalogue model / closed), never a fake option.
 */
function StockCreateBox({ creator, canWrite, writeTitle }: { creator: SparkStockCreate; canWrite: boolean; writeTitle: string | undefined }) {
  const t = useTranslations('Spark.editor.stock')
  const state = React.useSyncExternalStore(creator.subscribe, creator.getSnapshot, creator.getSnapshot)
  React.useEffect(() => {
    if (!state.open) return undefined
    const timer = window.setTimeout(() => void creator.requestQuote(), QUOTE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [creator, state.open, state.prompt, state.kind, state.ratio])
  const current = state.kinds[state.kind]
  const passive = Object.values(state.kinds).every((entry) => 'passive' in entry)
    ? ('passive' in state.kinds.image ? state.kinds.image.passive : 'catalog_unavailable')
    : null
  const rowTitle = !canWrite ? writeTitle : passive ? t(`create.passive.${passive}`) : undefined
  const price = state.quote.credits !== null ? t('price', { credits: state.quote.credits }) : null
  const ready = canWrite && state.quote.status === 'ready' && price !== null && !state.creating
  return (
    <>
      <button
        type="button"
        className="ai-row"
        disabled={!canWrite || passive !== null}
        title={rowTitle}
        aria-expanded={state.open}
        onClick={() => creator.toggle()}
      >
        <StudioIcon name="sparkles" />
        <span>
          <b>{t('generateWithAi')}</b>
          <small>{passive ? t(`create.passive.${passive}`) : t('generateHint')}</small>
        </span>
        <StudioIcon name="down" size="sm" />
      </button>
      {state.open ? (
        <div className="ai-box" style={{ marginTop: 8 }}>
          <textarea
            aria-label={t('create.promptLabel')}
            placeholder={t('create.placeholder')}
            value={state.prompt}
            maxLength={2000}
            onChange={(event) => creator.setPrompt(event.target.value)}
          />
          <div className="ai-box-bar">
            <button type="button" className="chipsel" title={'modelId' in current ? t('create.model', { model: current.modelLabel }) : undefined} onClick={() => creator.cycleKind()}>
              <StudioIcon name={state.kind === 'video' ? 'video' : 'image'} size="sm" />
              {t(`create.kinds.${state.kind}`)}
              <StudioIcon name="down" size="sm" />
            </button>
            <button type="button" className="chipsel" onClick={() => creator.cycleRatio()}>{state.ratio}</button>
            <span className="grow" />
            <button type="button" className="btn primary sm" disabled={!ready} onClick={() => void creator.create()}>
              {state.creating ? <span className="spin" aria-hidden /> : <StudioIcon name="sparkles" size="sm" />}
              {state.creating
                ? t('create.creating')
                : state.quote.status === 'quoting'
                  ? t('create.quoting')
                  : price
                    ? t('create.submitPrice', { price })
                    : t('create.submit')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

function StockToast({ notice }: { notice: StockNotice | null }) {
  const t = useTranslations('Spark.editor.stock.notices')
  const [hiddenId, setHiddenId] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setHiddenId(notice.id), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])
  const show = notice !== null && hiddenId !== notice.id
  return (
    <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">
      <StudioIcon name={!notice || notice.kind === 'added' || notice.kind === 'created' ? 'check' : 'x'} />
      <span>{notice ? t(notice.kind, notice.values) : ''}</span>
    </div>
  )
}

/** Visible in the drawer's scroll area (IntersectionObserver); without an observer every card counts as visible. */
function useInView(ref: React.RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = React.useState(() => typeof IntersectionObserver === 'undefined')
  React.useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return visible
}

function hueOf(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  return hash % 360
}

/** m:ss (design `fmt`). */
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function StudioIcon({ name, size }: { name: string; size?: 'sm' }) {
  return (
    <svg className={`i${size ? ` ${size}` : ''}`} aria-hidden>
      <use href={`#i-${name}`} />
    </svg>
  )
}
