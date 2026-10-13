import { cutPreviewSpan, playSpan } from '@/lib/spark/effects/cut-preview'
import { applyToAllSpecs, transitionBoundaries, transitionLengthSpec, transitionSpecs } from '@/lib/spark/effects/transition-browser'
import type { SceneTransition, TransitionKind } from '@/lib/spark/scene-transitions'

import type { SparkToolContext } from './spark-tool-types'

/**
 * Spark effects WP1: the writes of the Transitions browser and the strip chips. Each is ONE command (one undo step) through
 * the session (`scene.set_transition` / `scene.clear_transition`, validated by the gateway); after a transition is applied
 * the stage plays about a second either side of the cut, once the preview plan draws it.
 */

/** How long the editor waits for the preview plan to draw a new transition before it plays the cut anyway. */
const PLAN_WAIT_MS = 2500

/** Puts `kind` on the boundaries into `sceneIds` (`cut` clears them). Resolves true when the command applied. */
export async function applyTransitionKind(ctx: SparkToolContext, sceneIds: readonly string[], kind: TransitionKind | 'cut', options: { preview?: boolean } = {}): Promise<boolean> {
  const document = ctx.latest().workingCopy?.document
  if (!document || sceneIds.length === 0) return false
  const specs = transitionSpecs(document, sceneIds, kind)
  const applied = specs.length === 0 ? true : await ctx.actions.apply(specs)
  if (applied && options.preview && kind !== 'cut') previewCut(ctx, sceneIds[0]!, kind)
  return applied
}

/** "Apply to all": copies a transition onto every boundary as one command, then plays the first cut. */
export async function applyTransitionToAll(ctx: SparkToolContext, transition: SceneTransition): Promise<boolean> {
  const document = ctx.latest().workingCopy?.document
  if (!document) return false
  const specs = applyToAllSpecs(document, transition)
  if (specs.length === 0) return true
  const applied = await ctx.actions.apply(specs)
  const first = transitionBoundaries(document)[0]
  if (applied && first) previewCut(ctx, first.sceneId, transition.kind)
  return applied
}

/** The duration handle of a chip: one command with the new length (clamped to 2-300 frames by the op's own range). */
export async function applyTransitionLength(ctx: SparkToolContext, sceneId: string, frames: number): Promise<boolean> {
  const document = ctx.latest().workingCopy?.document
  if (!document) return false
  const spec = transitionLengthSpec(document, sceneId, frames)
  if (!spec) return true
  const applied = await ctx.actions.apply([spec], { coalesceKey: `scene:${sceneId}:transition` })
  const kind = transitionBoundaries(document).find((boundary) => boundary.sceneId === sceneId)?.stored?.kind
  if (applied && kind) previewCut(ctx, sceneId, kind)
  return applied
}

/**
 * Plays [cut - 1 s, cut + 1 s] of the boundary into `sceneId` on the stage: as soon as the preview plan lists the
 * transition (the gateway compiled its segment, or said why it plays as a cut), at the latest after `PLAN_WAIT_MS`.
 */
export function previewCut(ctx: SparkToolContext, sceneId: string, kind: TransitionKind): void {
  const stage = ctx.current().stage
  const document = ctx.latest().workingCopy?.document
  const boundary = document ? transitionBoundaries(document).find((candidate) => candidate.sceneId === sceneId) : undefined
  if (!stage || !document || !boundary) return
  const fps = document.canvas.fps
  const planned = () => stage.controller.presenter.plan?.transitions?.some((transition) => transition.toSceneId === sceneId && transition.kind === kind) === true
  let done = false
  const play = () => {
    if (done) return
    done = true
    unsubscribe()
    globalThis.clearTimeout(timer)
    // The span stays inside the two scenes of the cut (playback into a third scene would select it).
    const span = cutPreviewSpan(boundary.cutFrame, fps, stage.playback.getSnapshot().totalFrames)
    const start = boundary.fromFrames === null ? span.start : Math.max(span.start, boundary.cutFrame - boundary.fromFrames)
    const end = boundary.toFrames === null ? span.end : Math.min(span.end, boundary.cutFrame + boundary.toFrames - 1)
    playSpan(stage.playback, { start, end })
  }
  const unsubscribe = stage.controller.subscribe(() => {
    if (planned()) play()
  })
  const timer = globalThis.setTimeout(play, planned() ? 0 : PLAN_WAIT_MS)
}
