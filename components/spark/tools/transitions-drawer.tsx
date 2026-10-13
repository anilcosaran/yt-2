'use client'

import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'

import { boundaryTouchesFootage, projectHasFootage, targetBoundary, transitionBoundaries, type TransitionBoundary } from '@/lib/spark/effects/transition-browser'
import { transitionCards } from '@/lib/spark/effects/transition-browser'
import { offeredTransitionKinds, type TransitionKind } from '@/lib/spark/scene-transitions'
import { writeCardDrag } from '@/lib/spark/stage/placement'

import { useStageState } from '../stage/use-stage-state'
import type { SparkStageBinding } from '../stage/use-spark-stage'
import { TransitionThumb } from './effect-thumbs'
import './effects.css'
import type { SparkToolContext, SparkToolDrawerProps } from './spark-tool-types'
import { Icon } from './studio-parts'
import { applyTransitionKind, applyTransitionToAll } from './transition-actions'

/** The card kind a Transitions card carries while it is dragged onto a cut of the strip. */
export const TRANSITION_CARD_KIND = 'transition'

/**
 * Spark effects WP1 — rail "Transitions": every transition of the catalogue as a card with an animated hover preview (A → B
 * sample pictures, the gateway's own recipe), in the catalogue's groups (Basic / Motion / Zoom / Light; the kinds of
 * `scene-transitions@2` only while the gateway writes them). Each card shows what a click would put on the selected cut: its
 * direction and colour carry over where the kind takes them. A click puts it on the selected cut (the one into the selected scene), a card
 * dragged onto a cut of the strip puts it there, "Apply to all" copies the selected cut's transition onto every cut. After
 * applying, the stage plays about a second either side of the cut. Every write is one `scene.set_transition` command.
 * Behind `SPARK_TRANSITIONS_BROWSER_ENABLED` (UI) and the gateway's `COMPOSITION_TRANSITIONS_ENABLED` (the preview plan says
 * whether transitions are drawn); with footage in the project the drawer says what the export does with it.
 */
export function TransitionsToolDrawer({ ctx }: SparkToolDrawerProps) {
  return ctx.stage ? <TransitionsBrowser ctx={ctx} stage={ctx.stage} /> : null
}

function TransitionsBrowser({ ctx, stage }: { ctx: SparkToolContext; stage: SparkStageBinding }) {
  const t = useTranslations('Spark.editor.effects.transitions')
  const tKinds = useTranslations('Spark.editor.transition')
  const locale = useLocale()
  const plan = useStageState(stage).presenter.plan
  const document = ctx.document
  const [hovered, setHovered] = React.useState<TransitionKind | 'cut' | null>(null)
  const boundaries = React.useMemo(() => (document ? transitionBoundaries(document) : []), [document])
  const boundary = document ? targetBoundary(document, ctx.composition.selectedSceneId) : null
  const footage = document ? projectHasFootage(document) : false
  const enabled = plan?.transitionsEnabled === true
  const writable = enabled && ctx.canWrite && boundary !== null

  if (!document) return null
  const fps = document.canvas.fps.num / document.canvas.fps.den
  const seconds = (frames: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.round((frames / fps) * 10) / 10)
  const select = (next: TransitionBoundary | undefined) => {
    if (next) ctx.actions.select(next.sceneId)
  }
  const index = boundary ? boundaries.findIndex((candidate) => candidate.sceneId === boundary.sceneId) : -1
  const apply = (kind: TransitionKind | 'cut') => {
    if (!boundary || !writable) return
    void applyTransitionKind(ctx, [boundary.sceneId], kind, { preview: true })
  }
  const stored = boundary?.stored ?? null

  let note: string | null = null
  if (!plan) note = t('loading')
  else if (!enabled) note = t('off')
  else if (boundaries.length === 0) note = t('needsTwoScenes')

  return (
    <div className="dr-body fx-drawer">
      {note ? (
        <p className="fx-note" role="note">
          {note}
        </p>
      ) : null}
      {footage ? (
        <p className="fx-note warn" role="note" data-footage-note>
          {t('footage')}
        </p>
      ) : null}
      {boundary ? (
        <div className="fx-target">
          <button type="button" className="ib sm" aria-label={t('previousCut')} title={t('previousCut')} disabled={index <= 0} onClick={() => select(boundaries[index - 1])}>
            <Icon name="left" size="sm" />
          </button>
          <span className="fx-target-name">
            {t('cut', { from: boundary.fromNumber, to: boundary.toNumber })}
            <small>{stored ? t('current', { name: tKinds(`kinds.${stored.kind}`), seconds: seconds(stored.duration_frames) }) : tKinds('kinds.cut')}</small>
          </span>
          <button
            type="button"
            className="ib sm"
            aria-label={t('nextCut')}
            title={t('nextCut')}
            disabled={index < 0 || index >= boundaries.length - 1}
            onClick={() => select(boundaries[index + 1])}
          >
            <Icon name="right" size="sm" />
          </button>
        </div>
      ) : null}
      {boundary && boundaryTouchesFootage(document, boundary) ? (
        <p className="fx-note" role="note">
          {t('footageCut')}
        </p>
      ) : null}
      <div className="fx-groups" role="group" aria-label={t('listLabel')}>
        {transitionCards(offeredTransitionKinds(plan?.transitionCatalog, stored?.kind ?? null), stored).map((group) => (
          <section key={group.group} className="fx-group" data-transition-group={group.group}>
            <h3 className="fx-group-name" id={`fx-group-${group.group}`}>
              {t(`groups.${group.group}`)}
            </h3>
            <div className="fx-grid" role="list" aria-labelledby={`fx-group-${group.group}`}>
              {group.cards.map(({ kind, direction, color }) => {
                const on = (stored?.kind ?? 'cut') === kind
                const name = tKinds(`kinds.${kind}`)
                return (
                  <div key={kind} role="listitem">
                    <button
                      type="button"
                      className={`fx-card${on ? ' on' : ''}`}
                      aria-pressed={on}
                      aria-label={boundary ? t('applyTo', { name, from: boundary.fromNumber, to: boundary.toNumber }) : name}
                      title={writable ? (kind === 'cut' ? t('cutHint') : t('cardHint')) : (ctx.writeTitle ?? note ?? undefined)}
                      disabled={!writable}
                      draggable={writable && kind !== 'cut'}
                      data-transition-kind={kind}
                      onClick={() => apply(kind)}
                      onMouseEnter={() => setHovered(kind)}
                      onMouseLeave={() => setHovered((current) => (current === kind ? null : current))}
                      onFocus={() => setHovered(kind)}
                      onBlur={() => setHovered((current) => (current === kind ? null : current))}
                      onDragStart={(event) => {
                        if (kind === 'cut') return
                        writeCardDrag(event.dataTransfer, { tool: 'transitions', kind: TRANSITION_CARD_KIND, data: { kind } })
                      }}
                    >
                      <TransitionThumb kind={kind} direction={direction} color={color} active={hovered === kind} />
                      <span className="fx-name">{name}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <button
        type="button"
        className="btn sm w100 fx-all"
        disabled={!writable || !stored || boundaries.length < 2}
        title={stored ? undefined : t('applyAllNeedsOne')}
        onClick={() => {
          if (stored) void applyTransitionToAll(ctx, stored)
        }}
      >
        <Icon name="dup" size="sm" />
        {stored ? t('applyAll', { name: tKinds(`kinds.${stored.kind}`) }) : t('applyAllEmpty')}
      </button>
      <p className="fx-hint">{t('hint')}</p>
    </div>
  )
}
