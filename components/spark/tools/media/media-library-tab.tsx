'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { LibraryCategory, LibraryItem, SparkMediaLibrary } from '@/lib/spark/media/media-library'
import { writeCardDrag } from '@/lib/spark/stage/placement'

import { Icon } from '../studio-parts'
import type { SparkToolContext } from '../spark-tool-types'
import type { SparkMediaAdder } from './media-services'

/** Typing settles before the library is searched (one request per pause, not per key). */
const SEARCH_DEBOUNCE_MS = 300
const CATEGORIES: readonly LibraryCategory[] = ['all', 'image', 'video', 'audio']

/** The drag payload of a card of "My media"; the Media tool's `onDrop` reads it back (`media-tool.ts`). */
export const LIBRARY_CARD_KIND = 'storage_object'

/**
 * "My media" (D10): the user's Storage library as cards (image / video / audio, every folder, newest first) with search
 * and a category filter. A card adds its file to the scene at the playhead ("+" or Enter), or is dragged onto the canvas
 * (at the drop point) or the timeline (at that second). A file that is not ready shows "Processing..." and is added as
 * soon as the project can use it.
 */
export function MediaLibraryTab({
  ctx,
  library,
  adder,
  onUpload,
}: {
  ctx: SparkToolContext
  library: SparkMediaLibrary
  adder: SparkMediaAdder
  /** The empty state's "Upload files" switches to the Upload tab. */
  onUpload: () => void
}) {
  const t = useTranslations('Spark.editor.media.library')
  const state = React.useSyncExternalStore(library.subscribe, library.getSnapshot, library.getSnapshot)
  const busy = React.useSyncExternalStore(adder.subscribe, adder.getSnapshot, adder.getSnapshot).busy
  const [query, setQuery] = React.useState(state.query)

  React.useEffect(() => {
    void library.load()
    // The library lives as long as the editor: reopening the tab shows the cards at once and reads them again.
  }, [library])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void library.setQuery(query), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [library, query])

  const chip = (category: LibraryCategory) => (
    <button
      key={category}
      type="button"
      className={`fchip${state.category === category ? ' on' : ''}`}
      aria-pressed={state.category === category}
      onClick={() => void library.setCategory(category)}
    >
      {t(`categories.${category}`)}
    </button>
  )

  return (
    <>
      <div className="search" style={{ marginTop: 10 }}>
        <Icon name="search" size="sm" />
        <input aria-label={t('searchPlaceholder')} placeholder={t('searchPlaceholder')} value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="chips-x" style={{ marginTop: 10 }}>
        {CATEGORIES.map(chip)}
      </div>
      <LibraryResults ctx={ctx} library={library} adder={adder} state={state} busy={busy} query={query} onUpload={onUpload} />
    </>
  )
}

function LibraryResults({
  ctx,
  library,
  adder,
  state,
  busy,
  query,
  onUpload,
}: {
  ctx: SparkToolContext
  library: SparkMediaLibrary
  adder: SparkMediaAdder
  state: ReturnType<SparkMediaLibrary['getSnapshot']>
  busy: Readonly<Record<string, 'binding' | 'processing' | 'placing'>>
  query: string
  onUpload: () => void
}) {
  const t = useTranslations('Spark.editor.media.library')
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
        <button type="button" className="lnk" onClick={() => void library.retry()}>
          {t('retry')}
        </button>
      </div>
    )
  }
  if (state.items.length === 0) {
    const searching = query.trim().length > 0
    return (
      <div className="mm-empty" style={{ padding: '32px 12px' }}>
        {searching ? (
          <p>{t('noResults', { query: query.trim() })}</p>
        ) : (
          <>
            <p>
              <b>{t('empty')}</b>
            </p>
            <p>{t('emptyHint')}</p>
            <button type="button" className="btn sm" onClick={onUpload}>
              <Icon name="upload" size="sm" />
              {t('emptyUpload')}
            </button>
          </>
        )}
      </div>
    )
  }
  return (
    <>
      <div className="masonry" role="list" style={{ marginTop: 10 }}>
        {state.items.map((item) => (
          <LibraryCard key={item.id} item={item} ctx={ctx} library={library} adder={adder} busy={busy[item.id] ?? null} />
        ))}
      </div>
      {state.hasMore ? (
        <button type="button" className="add-scene" disabled={state.loadingMore} onClick={() => void library.loadMore()}>
          {state.loadingMore ? <span className="spin" aria-hidden /> : null}
          {t('loadMore')}
        </button>
      ) : null}
    </>
  )
}

function LibraryCard({
  item,
  ctx,
  library,
  adder,
  busy,
}: {
  item: LibraryItem
  ctx: SparkToolContext
  library: SparkMediaLibrary
  adder: SparkMediaAdder
  busy: 'binding' | 'processing' | 'placing' | null
}) {
  const t = useTranslations('Spark.editor.media.library')
  const ref = React.useRef<HTMLDivElement>(null)
  const visible = useInView(ref)
  const [url, setUrl] = React.useState<string | null>(null)
  const [broken, setBroken] = React.useState(false)

  React.useEffect(() => {
    if (!visible || !item.kind || item.kind === 'audio' || item.unsupported) return undefined
    let active = true
    void library.thumbnailUrl(item).then((value) => {
      if (active) setUrl(value)
    })
    return () => {
      active = false
    }
  }, [visible, library, item])

  const usable = item.kind !== null && !item.failed
  const canAdd = ctx.canWrite && usable && !busy
  const waiting = busy === 'binding' || busy === 'processing' || busy === 'placing'
  const processing = busy === 'processing' || (!item.ready && !item.failed && usable)
  const unsupportedText = item.unsupported ? t(item.unsupported === 'svg' ? 'unsupportedSvg' : item.unsupported === 'gif' ? 'unsupportedGif' : 'unsupportedType') : null
  const hue = hueOf(item.id)
  const title = [item.name, unsupportedText, item.failed ? t('failed') : null].filter(Boolean).join(' · ')
  const add = () => {
    void adder.addObject({ id: item.id, checksum: item.checksum, kind: item.kind, ready: item.ready, name: item.name })
  }

  return (
    <div
      ref={ref}
      role="listitem"
      className={`mt media-card${item.kind === 'audio' ? ' audio' : ''}${usable ? '' : ' disabled'}`}
      title={title}
      data-object={item.id}
      draggable={usable && item.ready && ctx.canWrite}
      aria-label={item.name}
      style={{ aspectRatio: '16 / 10', background: `linear-gradient(135deg,hsl(${hue} 25% 42%),hsl(${(hue + 40) % 360} 25% 22%))` }}
      onDragStart={(event) => {
        writeCardDrag(event.dataTransfer, {
          tool: 'media',
          kind: LIBRARY_CARD_KIND,
          data: { storageObjectId: item.id, checksum: item.checksum, mediaKind: item.kind, ready: item.ready, name: item.name },
        })
      }}
    >
      {/* A short-lived signed grid thumbnail (Storage delivery); next/image would proxy and cache it. Timeline v3: the drawn
          thumbnail's size (its media's aspect) lets an insert cover the canvas before the picture is read. */}
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          alt=""
          draggable={false}
          src={url}
          onLoad={(event) => library.rememberThumbnailSize(item.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
          onError={() => setBroken(true)}
        />
      ) : null}
      {item.kind === 'audio' || !url || broken ? (
        <span className="media-card-glyph" aria-hidden>
          <Icon name={item.kind === 'audio' ? 'music' : item.kind === 'video' ? 'video' : 'image'} />
        </span>
      ) : null}
      {item.kind && item.kind !== 'image' && item.durationSeconds ? (
        <span className="dur-b">
          <Icon name={item.kind === 'audio' ? 'music' : 'play'} />
          {formatClock(item.durationSeconds)}
        </span>
      ) : null}
      <span className="mt-t media-card-title">{item.name}</span>
      {processing ? (
        <span className="media-card-state" role="status">
          <span className="spin" aria-hidden />
          {t('processing')}
        </span>
      ) : null}
      {waiting && !processing ? (
        <span className="add-b" style={{ opacity: 1, transform: 'none' }} role="status" aria-label={t('adding')}>
          <span className="spin" aria-hidden />
        </span>
      ) : (
        <button
          type="button"
          className="add-b"
          disabled={!canAdd}
          title={canAdd ? (item.ready ? t('dragHint') : t('addWhenReady')) : (unsupportedText ?? ctx.writeTitle)}
          aria-label={t('addLabel', { name: item.name })}
          onClick={add}
        >
          <Icon name="plus" size="sm" />
        </button>
      )}
    </div>
  )
}

/** Visible in the drawer's scroll area (IntersectionObserver); without an observer every card counts as visible. */
function useInView(ref: React.RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = React.useState(() => typeof IntersectionObserver === 'undefined')
  React.useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
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
function formatClock(seconds: number): string {
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
