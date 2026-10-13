'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

import { motionBuyTargetFromOffer } from '@/lib/motion-market/purchase-session'
import { motionCardDrag } from '@/lib/spark/motion-card-drag'
import { motionTabCards, SparkMotionCatalog, type MotionCard, type MotionCatalogState, type MotionCatalogTab } from '@/lib/spark/motion-catalog'
import { motionRevisionRefusal } from '@/lib/spark/motion-insert'
import { overlayBlockFor, prefetchOverlaySupport, revisionEnergies, subscribeOverlaySupport } from '@/lib/spark/motion-overlay-support'
import { writeCardDrag } from '@/lib/spark/stage/placement'
import { sparkAddSceneMode, sparkAddSceneReasonKey } from '@/lib/spark/template-policy'

import { announceMotionInsert, announceMotionScene, insertMotion, insertMotionScene, watchOverlay } from './insert-motion'
import { useMotionBuy } from './motion-buy-dialog'
import './motion-drawer.css'
import { MotionPremiumBuyButton } from './motion-premium-buy-button'
import type { SparkToolContext, SparkToolDrawerProps } from './spark-tool-types'
import { Icon } from './studio-parts'

const TABS: readonly MotionCatalogTab[] = ['library', 'mine', 'premium']
/** Where the Motion area (library, drafts, saved Motions) lives. */
export const MOTION_AREA_HREF = '/motion'

/**
 * The registry's Motion drawer (D13): Library (the platform catalogue), My Motions (the user's saved Motions and the Motions
 * the workspace bought) and Premium (priced; "Buy" opens the buy dialog: once per workspace, with credits, E1-I; a bought
 * Motion is a normal card), a search box and a link to the Motion area. A card's "+" puts the Motion on the scene under the playhead; the card can also be dragged onto the canvas
 * or the timeline (D14). Each tab states its own closed gate or failure; nothing is invented while a read is open.
 */
export function MotionToolDrawer({ ctx }: SparkToolDrawerProps) {
  // WP4: one catalogue per editor (`ctx.service`): reopening the drawer shows the cards at once and revalidates them.
  const catalog = ctx.service('motion.catalog', () => new SparkMotionCatalog())
  return <MotionDrawerView ctx={ctx} catalog={catalog} />
}

export function MotionDrawerView({ ctx, catalog }: { ctx: SparkToolContext; catalog: SparkMotionCatalog }) {
  const t = useTranslations('Spark.editor.motionDrawer')
  const tEditor = useTranslations('Spark.editor')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const state = React.useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot)
  const [tab, setTab] = React.useState<MotionCatalogTab>('library')
  const [query, setQuery] = React.useState('')
  // WP4: inserts in flight per card. Nothing is locked: every "+" is queued as its own command right away.
  const [adding, setAdding] = React.useState<Readonly<Record<string, number>>>({})
  const track = (key: string, delta: 1 | -1) =>
    setAdding((current) => {
      const next = { ...current, [key]: (current[key] ?? 0) + delta }
      if (next[key]! <= 0) delete next[key]
      return next
    })

  React.useEffect(() => {
    void catalog.load()
    return () => catalog.dispose()
  }, [catalog])

  const defaultStyle = state.styles.presets[0]?.preset_ref ?? null
  const canvasRatio = ctx.document?.canvas.aspect_ratio ?? null
  const plan = ctx.stage?.controller.presenter.plan
  const fps = plan ? plan.canvas.fps.num / plan.canvas.fps.den : 30
  // E1-I: the Premium tab lives on the marketplace read: a closed or failed marketplace is the tab's own state, the others stay.
  const section =
    tab === 'mine' ? state.mine : tab === 'premium' && state.platform.status === 'ok' && state.market.status !== 'ok' ? { status: state.market.status, cards: [] } : state.platform
  const marketClosed = tab === 'premium' && state.platform.status === 'ok' && state.market.status === 'unavailable'
  // The buy dialog (one target at a time); a bought Motion and a Motion the seller changed both read the cards again.
  const buy = useMotionBuy({ onPurchased: () => void catalog.load(), onStale: () => void catalog.load() })

  const add = async (card: MotionCard) => {
    track(card.key, 1)
    try {
      const outcome = await insertMotion(ctx.current(), card, { kind: 'playhead' }, defaultStyle)
      announceMotionInsert(ctx.current(), card, outcome)
      // The scene's preview tells whether the gateway could draw the overlay (a camera Motion cannot, E1-C).
      void watchOverlay(ctx.current(), card, outcome)
    } finally {
      track(card.key, -1)
    }
  }

  // "Add as new scene": the Motion as a scene of its own (the way for a Motion that cannot sit over other layers).
  const addScene = async (card: MotionCard) => {
    track(card.key, 1)
    try {
      announceMotionScene(ctx.current(), card, await insertMotionScene(ctx.current(), card, defaultStyle))
    } finally {
      track(card.key, -1)
    }
  }
  const sceneReasonKey = sparkAddSceneReasonKey(sparkAddSceneMode(ctx.document))
  const sceneReason = sceneReasonKey ? tEditor(sceneReasonKey) : undefined

  const cards = state.status === 'ready' && section.status === 'ok' ? motionTabCards(state, tab, query, locale) : []
  const total = section.cards.filter((card) => (tab === 'mine' ? true : card.premium === (tab === 'premium'))).length
  const lookClosed = state.status === 'ready' && state.styles.status !== 'ok'

  // WP4: the typed source of every card of the open tab is read in the background when the drawer shows it (a few at a
  // time, once per revision): a Motion that cannot sit over other layers is flagged before anyone clicks it, a saved Motion's
  // energies are known, and the "+" never waits for that read. A premium Motion the workspace has not bought is skipped
  // (its source is the paid content).
  const prefetchKey = state.status === 'ready' && section.status === 'ok' ? `${tab}:${motionTabCards(state, tab, '', locale).map((card) => card.key).join(',')}` : ''
  React.useEffect(() => {
    if (!prefetchKey) return undefined
    const controller = new AbortController()
    const refs = motionTabCards(catalog.getSnapshot(), tab, '', locale)
      .filter((card) => !(card.premium && card.owned !== true))
      .map((card) => card.ref)
    void prefetchOverlaySupport(refs, { signal: controller.signal })
    return () => controller.abort()
    // `prefetchKey` names the cards of the tab; the catalogue and the tab are read through it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchKey])

  return (
    <>
      <div className="dr-body" data-motion-drawer={state.status}>
        <div className="seg" role="tablist" aria-label={t('tabsLabel')}>
          {TABS.map((id) => (
            <button key={id} type="button" role="tab" id={`motion-tab-${id}`} aria-selected={tab === id} aria-controls="motion-panel" className={tab === id ? 'on' : undefined} onClick={() => setTab(id)}>
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
        <div className="search" style={{ marginTop: 10 }}>
          <Icon name="search" size="sm" />
          <input aria-label={t('searchPlaceholder')} placeholder={t('searchPlaceholder')} value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {!ctx.hasScene ? <p className="mo-note">{t('needsScene')}</p> : null}
        {lookClosed && tab !== 'premium' ? <p className="mo-note">{t('styleUnavailable')}</p> : null}

        <div id="motion-panel" role="tabpanel" aria-labelledby={`motion-tab-${tab}`}>
          {state.status === 'loading' ? (
            <div className="dr-label" role="status" aria-live="polite">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="spin" aria-hidden />
                {t('loading')}
              </span>
            </div>
          ) : section.status === 'unavailable' ? (
            <div className="mm-empty" role="status" style={{ padding: '32px 12px' }} data-motion-state="unavailable">
              <p>{t(`unavailable.${marketClosed ? 'market' : tab}`)}</p>
            </div>
          ) : section.status === 'error' ? (
            <div className="mm-empty" role="alert" style={{ padding: '32px 12px' }} data-motion-state="error">
              <p>{t('loadFailed')}</p>
              <button type="button" className="lnk" onClick={() => void catalog.load()}>
                {t('retry')}
              </button>
            </div>
          ) : (
            <>
              <div className="dr-label">
                <span className="mo-count">{t('results', { count: cards.length })}</span>
              </div>
              {cards.length === 0 ? (
                <div className="mm-empty" style={{ padding: '32px 12px' }}>
                  {query.trim() ? t('noMatch', { query: query.trim() }) : total === 0 ? t(`empty.${tab}`) : t('noMatch', { query: '' })}
                </div>
              ) : (
                <ul className="mo-grid">
                  {cards.map((card) => (
                    <MotionTile
                      key={card.key}
                      card={card}
                      locale={locale}
                      fps={fps}
                      canvasRatio={canvasRatio}
                      canWrite={ctx.stageCanWrite && ctx.hasScene}
                      writeTitle={ctx.stageCanWrite ? (ctx.hasScene ? undefined : t('needsScene')) : ctx.writeTitle}
                      busy={(adding[card.key] ?? 0) > 0}
                      defaultStyle={defaultStyle}
                      sceneBlocked={sceneReason}
                      canAddScene={ctx.stageCanWrite}
                      onAdd={() => void add(card)}
                      onAddScene={() => void addScene(card)}
                      onBuy={() => {
                        if (card.offer) buy.open(motionBuyTargetFromOffer(card.offer))
                      }}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
      <div className="dr-foot">
        <Link className="lnk" href={MOTION_AREA_HREF}>
          {t('openArea')}
        </Link>
      </div>
      {buy.dialog}
    </>
  )
}

function hueOf(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  return hash % 360
}

const secondsLabel = (frames: number, fps: number) => String(Math.round((frames / fps) * 10) / 10)

function MotionTile({
  card,
  locale,
  fps,
  canvasRatio,
  canWrite,
  writeTitle,
  busy,
  defaultStyle,
  sceneBlocked,
  canAddScene,
  onAdd,
  onAddScene,
  onBuy,
}: {
  card: MotionCard
  locale: 'en' | 'tr'
  fps: number
  canvasRatio: string | null
  canWrite: boolean
  writeTitle: string | undefined
  busy: boolean
  defaultStyle: string | null
  /** Why "Add as new scene" is passive for this project (a template-bound project), or undefined. */
  sceneBlocked: string | undefined
  canAddScene: boolean
  onAdd: () => void
  onAddScene: () => void
  onBuy: () => void
}) {
  const t = useTranslations('Spark.editor.motionDrawer')
  const name = card.title[locale]
  // Learned from the Motion's typed source or the preview's per-layer warning (E1-C): it can only be a scene of its own.
  const block = React.useSyncExternalStore(
    subscribeOverlaySupport,
    () => overlayBlockFor(card.ref.manifest_sha256),
    () => null,
  )
  // WP4: what the card's revision itself rules out (a project-private revision, no energy an instance can start with),
  // checked against what its typed source taught (read when the drawer opened).
  const revisionRefusal = React.useSyncExternalStore(
    subscribeOverlaySupport,
    () => motionRevisionRefusal(card, revisionEnergies(card.ref.manifest_sha256))?.reason ?? null,
    () => null,
  )
  const hue = hueOf(card.key)
  const ratioMissing = canvasRatio !== null && !card.aspectRatios.includes(canvasRatio as never)
  // A premium Motion the workspace owns is a normal card; one it does not own is bought first (the server refuses the insert too).
  const locked = card.premium && card.owned !== true
  const insertable = !locked && canWrite && !ratioMissing && block === null && revisionRefusal === null
  const sceneInsertable = !locked && canAddScene && !ratioMissing && !sceneBlocked && revisionRefusal === null
  const reason = locked
    ? t('buyFirst')
    : revisionRefusal
      ? t(`refused.${revisionRefusal}`, { title: name })
      : ratioMissing
        ? t('refused.ratio_not_available', { title: name, ratio: canvasRatio ?? '' })
        : block
          ? t(`refused.own_scene_only.${block}`, { title: name })
          : writeTitle
  const range = card.durationRange
  return (
    <li
      className="mo-tile"
      data-motion-card={card.key}
      data-disabled={!insertable}
      draggable={insertable}
      title={[name, card.summary, reason].filter(Boolean).join('\n')}
      style={{ background: `linear-gradient(135deg,hsl(${hue} 30% 42%),hsl(${(hue + 50) % 360} 30% 22%))` }}
      onDragStart={(event) => {
        if (!insertable) {
          event.preventDefault()
          return
        }
        writeCardDrag(event.dataTransfer, motionCardDrag(card, defaultStyle))
      }}
    >
      {locked ? (
        <span className="mo-chip price" style={{ alignSelf: 'flex-start' }} data-motion-price={card.priceCredits ?? undefined}>
          {t('price', { credits: card.priceCredits ?? 0 })}
        </span>
      ) : card.premium ? (
        <span className="mo-chip" style={{ alignSelf: 'flex-start' }} data-motion-owned="true">
          {t('owned')}
        </span>
      ) : null}
      <span className="mo-title">{name}</span>
      {card.sampleText ? <span className="mo-sample">{card.sampleText}</span> : null}
      {card.summary ? <span className="mo-sum">{card.summary}</span> : null}
      <span className="mo-meta">
        {range ? <span className="mo-chip">{t('lengthRange', { min: secondsLabel(range.minFrames, fps), max: secondsLabel(range.maxFrames, fps) })}</span> : null}
        {card.aspectRatios.length > 0 ? <span className="mo-chip">{card.aspectRatios.join(' · ')}</span> : null}
        {ratioMissing ? <span className="mo-chip warn">{t('ratioChip', { ratio: canvasRatio ?? '' })}</span> : null}
        {card.needsImage ? <span className="mo-chip">{t('needsImage')}</span> : null}
        {block ? <span className="mo-chip warn" data-motion-own-scene={block}>{t('ownSceneOnly')}</span> : null}
        {card.origin === 'mine' ? <span className="mo-chip">{t('mineChip', { number: card.ref.motion_revision_id.split('_').at(-1) ?? '' })}</span> : null}
      </span>
      {busy ? (
        // WP4: the insert is queued; the card stays usable (another "+" is its own command).
        <span className="mo-chip mo-busy" role="status" aria-label={t('adding')} data-motion-adding="true">
          <span className="spin" aria-hidden />
        </span>
      ) : null}
      {locked ? (
        <MotionPremiumBuyButton card={card} onBuy={onBuy} />
      ) : (
        <>
          <button type="button" className="mo-add" disabled={!insertable} title={insertable ? t('addTitle', { title: name }) : reason} aria-label={t('addLabel', { title: name })} onClick={onAdd}>
            <Icon name="plus" size="sm" />
          </button>
          <button
            type="button"
            className="mo-add mo-scene"
            disabled={!sceneInsertable}
            title={sceneInsertable ? t('sceneTitle', { title: name }) : (sceneBlocked ?? reason)}
            aria-label={t('sceneLabel', { title: name })}
            onClick={onAddScene}
          >
            <Icon name="scenes" size="sm" />
          </button>
        </>
      )}
    </li>
  )
}

export type { MotionCatalogState }
