'use client'

import * as React from 'react'

import type { AnimationDirection, AnimationPhase } from '@/lib/spark/animations/animation-catalog'
import { loopProgress, type PreviewEasing } from '@/lib/spark/effects/preview-math'
import { useRecipeEasesVersion } from '@/lib/spark/effects/recipe-eases'
import { FX_SAMPLE_A, FX_SAMPLE_B, clipPathOf, presetThumbLook, transitionThumbFrame } from '@/lib/spark/effects/thumb-sample'
import { TRANSITION_CATALOG, type TransitionDirection, type TransitionKind } from '@/lib/spark/scene-transitions'
import { lookCss, type Look } from '@/lib/spark/stage/motion-core/recipes'

/**
 * Spark effects library: the thumbnails of the Transitions and Animations cards. A transition card shows two sample pictures
 * (A, a warm landscape with a title bar, leaves; B, a night city, arrives: `public/spark/fx/`, drawn by
 * `scripts/generate-fx-samples.py`), an animation card a sample word, a shape or picture B. What a card shows is the very
 * recipe the export draws, sampled in the browser (`lib/spark/effects/thumb-sample.ts`): no server call and no render.
 *
 * At rest a transition card shows its still frame (the moment the kind reads best, `thumb_progress` of the catalogue) and an
 * animation card the arrived (or not yet leaving) element. A card plays its loop only while it is hovered or focused (the
 * drawer keeps one such card) and on screen (an IntersectionObserver; a card scrolled away is not even sampled); with
 * `prefers-reduced-motion: reduce` it keeps its still frame.
 */

/** Whether the user asked the system for reduced motion (live: follows a change of the setting). */
export function usePrefersReducedMotion(): boolean {
  const subscribe = React.useCallback((listener: () => void) => {
    const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    query?.addEventListener?.('change', listener)
    return () => query?.removeEventListener?.('change', listener)
  }, [])
  const read = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false)
  return React.useSyncExternalStore(subscribe, read, () => false)
}

/**
 * Whether an element is on screen (an IntersectionObserver with a small margin). True until the observer says otherwise,
 * and where the browser has none.
 */
export function useOnScreen<T extends Element>(): [(node: T | null) => void, boolean] {
  const [node, setNode] = React.useState<T | null>(null)
  const [onScreen, setOnScreen] = React.useState(true)
  React.useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOnScreen(entry.isIntersecting)
      },
      { rootMargin: '64px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, onScreen]
}

/**
 * The effect's progress (0-1) while `active`: a loop of rest → effect → rest on `requestAnimationFrame`. Null while inactive
 * or with reduced motion (the card shows its still frame).
 */
export function usePreviewProgress(active: boolean, effectMs: number): number | null {
  const reduced = usePrefersReducedMotion()
  const [progress, setProgress] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!active || reduced || typeof window === 'undefined' || !window.requestAnimationFrame) return undefined
    const started = window.performance?.now?.() ?? Date.now()
    let handle = window.requestAnimationFrame(function tick(now) {
      setProgress(loopProgress(now - started, effectMs))
      handle = window.requestAnimationFrame(tick)
    })
    return () => {
      window.cancelAnimationFrame(handle)
      setProgress(null)
    }
  }, [active, reduced, effectMs])
  if (!active || reduced) return null
  return progress ?? 0
}

const SAMPLE_SIZE = { width: 96, height: 54 }

function cssOf(look: Look, origin: readonly [number, number] = [0.5, 0.5]): React.CSSProperties {
  const css = lookCss(look)
  return {
    transform: css.transform,
    transformOrigin: `${origin[0] * 100}% ${origin[1] * 100}%`,
    opacity: css.opacity,
    ...(css.filter && { filter: css.filter }),
  }
}

const picture = (src: string): React.CSSProperties => ({ backgroundImage: `url(${src})` })

/** Two sample pictures (A → B) of a transition, at the hover loop's progress or at the kind's still frame. */
export function TransitionThumb({
  kind,
  direction,
  color,
  active,
}: {
  kind: TransitionKind | 'cut'
  direction?: TransitionDirection | null
  color?: string | null
  active: boolean
}) {
  useRecipeEasesVersion()
  const [ref, onScreen] = useOnScreen<HTMLSpanElement>()
  const progress = usePreviewProgress(active && onScreen && kind !== 'cut', 900)
  if (kind === 'cut') {
    return (
      <span ref={ref} className="fx-thumb cut" aria-hidden data-progress="rest">
        <span className="fx-pic a half-l" style={picture(FX_SAMPLE_A)} />
        <span className="fx-pic b half-r" style={picture(FX_SAMPLE_B)} />
      </span>
    )
  }
  if (!onScreen) {
    return (
      <span ref={ref} className="fx-thumb" aria-hidden data-progress="offscreen">
        <span className="fx-pic a" style={picture(FX_SAMPLE_A)} />
      </span>
    )
  }
  const frame = transitionThumbFrame({ kind, direction: direction ?? null, color: color ?? null }, progress ?? TRANSITION_CATALOG[kind].thumbProgress, SAMPLE_SIZE)
  const clip = clipPathOf(frame.clip)
  return (
    <span ref={ref} className="fx-thumb" aria-hidden data-progress={progress === null ? 'rest' : String(Math.round(progress * 100))}>
      {frame.order.map((part) =>
        part === 'dip' ? (
          frame.dip ? <span key="dip" className="fx-dip" style={{ background: frame.dip.color, opacity: frame.dip.opacity }} /> : null
        ) : (
          <span
            key={part}
            className={`fx-pic ${part === 'from' ? 'a' : 'b'}`}
            style={{ ...picture(part === 'from' ? FX_SAMPLE_A : FX_SAMPLE_B), ...cssOf(frame[part], frame.origin?.[part]), ...(part === 'to' && clip && { clipPath: clip }) }}
          />
        ),
      )}
    </span>
  )
}

/** A sample element (a word, a shape or picture B) animated by a preset at the hover loop's progress. */
export function AnimationThumb({
  presetId,
  phase,
  direction,
  easing,
  sample,
  active,
  word,
}: {
  presetId: string | null
  phase: AnimationPhase
  direction?: AnimationDirection | null
  easing: PreviewEasing
  sample: 'text' | 'shape' | 'image'
  active: boolean
  /** The sample word of a text card (a count up counts the number it shows). */
  word: string
}) {
  useRecipeEasesVersion()
  const [ref, onScreen] = useOnScreen<HTMLSpanElement>()
  const emphasis = phase === 'emphasis'
  const progress = usePreviewProgress(active && onScreen && presetId !== null, emphasis ? 1400 : 800)
  // At rest an enter shows the arrived element, an exit the element before it leaves, an emphasis the element at rest.
  const sampled = presetId && onScreen ? presetThumbLook({ presetId, phase, direction: direction ?? null, easing }, progress ?? (phase === 'exit' ? 0 : 1), SAMPLE_SIZE, word) : null
  return (
    <span ref={ref} className="fx-thumb anim" aria-hidden data-progress={progress === null ? 'rest' : String(Math.round(progress * 100))}>
      <span className={`fx-el ${sample}`} style={{ ...(sample === 'image' && picture(FX_SAMPLE_B)), ...(sampled && cssOf(sampled.look)) }}>
        {sample === 'text' ? (sampled ? sampled.text : word) || ' ' : null}
      </span>
    </span>
  )
}
