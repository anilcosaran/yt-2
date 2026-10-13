'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { transitionCards, transitionWithKind } from '@/lib/spark/effects/transition-browser'
import {
  TRANSITION_CATALOG,
  TRANSITION_DEFAULT_COLOR,
  TRANSITION_MAX_FRAMES,
  TRANSITION_MIN_FRAMES,
  offeredTransitionKinds,
  resolvedTransition,
  type SceneTransition,
  type TransitionDirection,
  type TransitionExportState,
  type TransitionKind,
} from '@/lib/spark/scene-transitions'
import { formatSecondsLength } from '@/lib/spark/timeline/timeline-geometry'
import type { TimelineCut, TimelineFps } from '@/lib/spark/timeline/timeline-model'

import { TransitionThumb } from '../tools/effect-thumbs'
import '../tools/effects.css'

/**
 * Spark timeline v3: the small picker that opens at a cut's icon. Animated tiles of the catalogue kinds the editor offers,
 * in the Transitions drawer's groups (None first in Basic; the `scene-transitions@2` kinds only while the gateway writes
 * them, `offeredTransitionKinds` over the preview plan's `transitionCatalog`; a kind the cut already stores is always shown),
 * the length buttons, the direction / colour the kind takes, "Apply to all cuts" and "Remove". Every choice is ONE command
 * (one undo step) sent by the timeline's host; the picker itself writes nothing. It says what the export renders at this
 * cut (`transitionExportState`).
 */

/** The length buttons (seconds). */
export const PICKER_LENGTHS = [0.3, 0.5, 0.8, 1.0] as const

export function lengthFrames(seconds: number, fps: TimelineFps): number {
  return Math.min(TRANSITION_MAX_FRAMES, Math.max(TRANSITION_MIN_FRAMES, Math.round((seconds * fps.num) / fps.den)))
}

export type TransitionPickerProps = {
  cut: TimelineCut
  fps: TimelineFps
  /** Position inside the timeline (px from its top-left). */
  x: number
  y: number
  /** More than one cut: "Apply to all cuts" is offered. */
  multipleCuts: boolean
  /**
   * The transition catalogue whose kinds the gateway writes now (`StagePlan.transitionCatalog`: 2 = `scene-transitions@2`,
   * reported by the preview manifest's `transition_catalog_version`); absent = the `@1` kinds only.
   */
  catalog?: number
  /** One command; `coalesce` = a colour drag (one undo step for the whole drag). */
  onSet: (transition: SceneTransition | null, options?: { coalesce?: boolean }) => void
  onApplyToAll: (transition: SceneTransition) => void
  onClose: () => void
}

/** The one-line export status of a cut (hover tooltip, picker note). */
export function useExportStatusText(): (state: TransitionExportState, fps: TimelineFps) => string | null {
  const t = useTranslations('Spark.editor.timelineV3.exportState')
  return React.useCallback(
    (state: TransitionExportState, fps: TimelineFps) => {
      switch (state.state) {
        case 'none':
          return null
        case 'exports':
          return t('exports')
        case 'shortened':
          return t('shortened', { seconds: formatSecondsLength(state.frames, fps) })
        case 'video_cut':
          return t('video_cut')
        case 'video_project':
          return t('video_project')
        case 'off':
          return t('off')
        case 'unavailable':
          return t(`unavailable.${state.reason}`)
      }
    },
    [t],
  )
}

export function TransitionPicker({ cut, fps, x, y, multipleCuts, catalog, onSet, onApplyToAll, onClose }: TransitionPickerProps) {
  const t = useTranslations('Spark.editor.timelineV3.picker')
  const tTransition = useTranslations('Spark.editor.transition')
  const tGroups = useTranslations('Spark.editor.effects.transitions.groups')
  const statusText = useExportStatusText()
  const [hover, setHover] = React.useState<TransitionKind | 'cut' | null>(null)
  const stored = cut.transition
  const resolved = stored ? resolvedTransition(stored) : null
  // The drawer's cards: each shows what a click would write on this cut (its direction / colour carry over).
  const groups = React.useMemo(() => transitionCards(offeredTransitionKinds(catalog, stored?.kind ?? null), stored), [catalog, stored])
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Escape and a press outside close the picker.
  React.useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])
  React.useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('.fx-card.on, .fx-card')?.focus({ preventScroll: true })
  }, [])

  const choose = (kind: TransitionKind | 'cut') => {
    if (kind === 'cut') {
      if (stored) onSet(null)
      return
    }
    const next = transitionWithKind(stored, kind, fps)
    if (JSON.stringify(next) !== JSON.stringify(stored)) onSet(next)
  }
  const setParams = (patch: NonNullable<SceneTransition['params']>, coalesce = false) => {
    if (stored) onSet({ ...stored, params: { ...stored.params, ...patch } }, coalesce ? { coalesce: true } : undefined)
  }
  const directions = stored ? TRANSITION_CATALOG[stored.kind].directions : null
  const note = statusText(cut.exportState, fps)
  const warn = cut.exportState.state === 'video_cut' || cut.exportState.state === 'video_project' || cut.exportState.state === 'off'

  return (
    <div
      ref={rootRef}
      className="tl3-picker"
      role="dialog"
      aria-label={t('title', { n: cut.index })}
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      data-transition-picker={cut.sceneId}
    >
      <div className="tl3-picker-head">
        <b>{t('title', { n: cut.index })}</b>
        <button type="button" className="ib sm" aria-label={t('close')} title={t('close')} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="fx-groups tl3-picker-groups" role="group" aria-label={t('kinds')}>
        {groups.map((group) => (
          <section key={group.group} className="fx-group" data-picker-group={group.group}>
            <h3 className="fx-group-name">{tGroups(group.group)}</h3>
            <div className="fx-grid tl3-picker-grid">
              {group.cards.map(({ kind, direction, color }) => {
                const on = (stored?.kind ?? 'cut') === kind
                return (
                  <button
                    key={kind}
                    type="button"
                    className={`fx-card${on ? ' on' : ''}`}
                    aria-pressed={on}
                    data-picker-kind={kind}
                    onPointerEnter={() => setHover(kind)}
                    onPointerLeave={() => setHover((current) => (current === kind ? null : current))}
                    onFocus={() => setHover(kind)}
                    onBlur={() => setHover((current) => (current === kind ? null : current))}
                    onClick={() => choose(kind)}
                  >
                    <TransitionThumb kind={kind} direction={direction} color={color} active={hover === kind} />
                    <span className="fx-name">{kind === 'cut' ? t('none') : tTransition(`kinds.${kind}`)}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="tl3-picker-row" role="group" aria-label={t('length')}>
        <span className="lb">{t('length')}</span>
        {PICKER_LENGTHS.map((seconds) => {
          const frames = lengthFrames(seconds, fps)
          const on = stored?.duration_frames === frames
          return (
            <button key={seconds} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} disabled={!stored} data-picker-length={seconds} onClick={() => stored && !on && onSet({ ...stored, duration_frames: frames })}>
              {t('seconds', { seconds })}
            </button>
          )
        })}
      </div>
      {stored && directions ? (
        <div className="tl3-picker-row" role="group" aria-label={tTransition('direction')}>
          <span className="lb">{tTransition('direction')}</span>
          {directions.map((direction: TransitionDirection) => {
            const on = resolved?.direction === direction
            return (
              <button key={direction} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => !on && setParams({ direction })}>
                {tTransition(`directions.${direction}`)}
              </button>
            )
          })}
        </div>
      ) : null}
      {stored && resolved?.color ? (
        <label className="tl3-picker-row">
          <span className="lb">{tTransition('color')}</span>
          <input type="color" aria-label={tTransition('color')} value={resolved.color ?? TRANSITION_DEFAULT_COLOR} onChange={(event) => setParams({ color: event.target.value }, true)} />
        </label>
      ) : null}
      {note ? (
        <p className={`tl3-picker-note${warn ? ' warn' : ''}`} role="note" data-export-state={cut.exportState.state}>
          {note}
        </p>
      ) : null}
      <div className="tl3-picker-foot">
        <button type="button" className="btn sm" disabled={!stored || !multipleCuts} onClick={() => stored && onApplyToAll(stored)} data-picker-all>
          {t('applyAll')}
        </button>
        <button type="button" className="btn sm" disabled={!stored} onClick={() => onSet(null)} data-picker-remove>
          {t('remove')}
        </button>
      </div>
    </div>
  )
}
