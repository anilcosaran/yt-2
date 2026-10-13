import type { CompositionDocument, CompositionOpSpec } from '../composition-client'
import { sceneClearTransitionSpec, sceneSetTransitionSpec } from '../composition-typed-edits'
import { sourceMediaKind } from '../preview-only'
import {
  TRANSITION_CATALOG,
  TRANSITION_GROUP_ORDER,
  TRANSITION_MAX_FRAMES,
  TRANSITION_MIN_FRAMES,
  defaultTransitionFrames,
  longestUnclampedFrames,
  planTransitionWindows,
  readTransition,
  type SceneTransition,
  type TransitionDirection,
  type TransitionGroup,
  type TransitionKind,
} from '../scene-transitions'
import { resolveTimeline } from '../scene-timing'

/**
 * Spark effects WP1: the pure rules of the Transitions browser (left-rail "Transitions"). A boundary is named by its
 * INCOMING scene (the scene whose `transition_in` it is), exactly like the document stores it. Every write is the same
 * `scene.set_transition` / `scene.clear_transition` the Transition section of the scene panel sends; the gateway validates
 * and shortens, these helpers only pick targets, carry parameters over and say what the timing rule will make of a length.
 */

export type TransitionBoundary = {
  /** The incoming scene (`transition_in` holder). */
  sceneId: string
  /** 1-based strip numbers of the two scenes. */
  fromNumber: number
  toNumber: number
  /** Absolute project frame of the cut (the incoming scene's start). */
  cutFrame: number
  /** Resolved lengths of the outgoing and incoming scenes (null = unresolved). */
  fromFrames: number | null
  toFrames: number | null
  stored: SceneTransition | null
}

/** Every boundary of the strip, in order (scene 1 → 2, 2 → 3, ...). */
export function transitionBoundaries(document: CompositionDocument): TransitionBoundary[] {
  const timeline = resolveTimeline(document)
  const byId = new Map(document.scenes.map((scene) => [scene.scene_id, scene]))
  const boundaries: TransitionBoundary[] = []
  for (let index = 1; index < timeline.scenes.length; index += 1) {
    const previous = timeline.scenes[index - 1]!
    const scene = timeline.scenes[index]!
    boundaries.push({
      sceneId: scene.sceneId,
      fromNumber: index,
      toNumber: index + 1,
      cutFrame: scene.startFrame,
      fromFrames: previous.lengthFrames,
      toFrames: scene.lengthFrames,
      stored: readTransition((byId.get(scene.sceneId) as Record<string, unknown> | undefined)?.['transition_in']),
    })
  }
  return boundaries
}

/**
 * The boundary a click in the browser applies to: the one INTO the selected scene; with the first scene (it has no scene
 * before it) or nothing selected, the first boundary. Null while the strip has fewer than two scenes.
 */
export function targetBoundary(document: CompositionDocument, selectedSceneId: string | null): TransitionBoundary | null {
  const boundaries = transitionBoundaries(document)
  return boundaries.find((boundary) => boundary.sceneId === selectedSceneId) ?? boundaries[0] ?? null
}

/** The boundary closest to an absolute project frame (a card dropped on the strip lands on the nearest cut). */
export function nearestBoundary(document: CompositionDocument, frame: number): TransitionBoundary | null {
  let best: TransitionBoundary | null = null
  for (const boundary of transitionBoundaries(document)) {
    if (!best || Math.abs(boundary.cutFrame - frame) < Math.abs(best.cutFrame - frame)) best = boundary
  }
  return best
}

/**
 * The transition a new kind becomes on a boundary: what still makes sense of the stored one (its length, easing, a
 * direction the new kind takes, a colour) carries over, the rest takes the catalogue's defaults. The same rule as the
 * scene panel's kind picker.
 */
export function transitionWithKind(stored: SceneTransition | null, kind: TransitionKind, fps: { num: number; den: number }): SceneTransition {
  const entry = TRANSITION_CATALOG[kind]
  const params: NonNullable<SceneTransition['params']> = {}
  // A kind with its own fixed timing (flash, bounce in, shake) takes no easing.
  if (entry.easing && stored?.params?.easing) params.easing = stored.params.easing
  if (entry.directions && stored?.params?.direction && (entry.directions as readonly string[]).includes(stored.params.direction)) params.direction = stored.params.direction
  if (entry.color && stored?.params?.color) params.color = stored.params.color
  return { kind, duration_frames: stored?.duration_frames ?? defaultTransitionFrames(fps), ...(Object.keys(params).length > 0 && { params }) }
}

const sameTransition = (a: SceneTransition | null, b: SceneTransition | null): boolean => JSON.stringify(a) === JSON.stringify(b)

/** One card of the Transitions drawer: the kind and the direction and colour its thumbnail shows. */
export type TransitionCard = { kind: TransitionKind | 'cut'; direction: TransitionDirection | null; color: string | null }

/**
 * The drawer's cards in the catalogue's groups (Basic first, with the cut; empty groups are left out): each card shows what a
 * click would write on the selected cut (`transitionWithKind`): the stored direction and colour where the kind takes them,
 * else its defaults.
 */
export function transitionCards(kinds: readonly TransitionKind[], stored: SceneTransition | null): Array<{ group: TransitionGroup; cards: TransitionCard[] }> {
  const groups: Array<{ group: TransitionGroup; cards: TransitionCard[] }> = []
  for (const group of TRANSITION_GROUP_ORDER) {
    const cards: TransitionCard[] = group === 'basic' ? [{ kind: 'cut', direction: null, color: null }] : []
    for (const kind of kinds) {
      const entry = TRANSITION_CATALOG[kind]
      if (entry.group !== group) continue
      const next = transitionWithKind(stored, kind, { num: 30, den: 1 })
      cards.push({
        kind,
        direction: entry.directions ? (next.params?.direction ?? entry.defaultDirection) : null,
        color: entry.color ? (next.params?.color ?? null) : null,
      })
    }
    if (cards.length > 0) groups.push({ group, cards })
  }
  return groups
}

/**
 * The specs of ONE command that puts `kind` on these boundaries (`cut` clears them). A boundary that already holds exactly
 * that is left out, so "Apply to all" on a strip that is already uniform sends nothing.
 */
export function transitionSpecs(document: CompositionDocument, sceneIds: readonly string[], kind: TransitionKind | 'cut'): CompositionOpSpec[] {
  const byId = new Map(transitionBoundaries(document).map((boundary) => [boundary.sceneId, boundary]))
  const specs: CompositionOpSpec[] = []
  for (const sceneId of sceneIds) {
    const boundary = byId.get(sceneId)
    if (!boundary) continue
    if (kind === 'cut') {
      if (boundary.stored) specs.push(sceneClearTransitionSpec(sceneId))
      continue
    }
    const next = transitionWithKind(boundary.stored, kind, document.canvas.fps)
    if (!sameTransition(boundary.stored, next)) specs.push(sceneSetTransitionSpec(sceneId, next))
  }
  return specs
}

/**
 * "Apply to all": the specs of ONE command that copy a transition (kind, length and parameters) onto every boundary of the
 * strip; boundaries that already hold exactly it are left out.
 */
export function applyToAllSpecs(document: CompositionDocument, transition: SceneTransition): CompositionOpSpec[] {
  return transitionBoundaries(document)
    .filter((boundary) => !sameTransition(boundary.stored, transition))
    .map((boundary) => sceneSetTransitionSpec(boundary.sceneId, transition))
}

/** The spec that gives a boundary's stored transition a new length (clamped to the op's range), or null if unchanged. */
export function transitionLengthSpec(document: CompositionDocument, sceneId: string, frames: number): CompositionOpSpec | null {
  const boundary = transitionBoundaries(document).find((candidate) => candidate.sceneId === sceneId)
  if (!boundary?.stored) return null
  const next = clampTransitionFrames(frames)
  if (next === boundary.stored.duration_frames) return null
  return sceneSetTransitionSpec(sceneId, { ...boundary.stored, duration_frames: next })
}

export function clampTransitionFrames(frames: number): number {
  return Math.min(TRANSITION_MAX_FRAMES, Math.max(TRANSITION_MIN_FRAMES, Math.round(frames)))
}

export type LengthFeedback = {
  requestedFrames: number
  /** What the timing rule really gives this boundary for the request (null = it plays as a cut). */
  appliedFrames: number | null
  clamped: boolean
  /** The longest request the two scenes give in full (null = the pair cannot transition). */
  maxFrames: number | null
}

/**
 * What a length on a boundary turns into (the duration handle's live feedback while it is dragged): the same rule the
 * gateway's preview manifest reports (`clamped`, `duration_frames`), computed from the document alone.
 */
export function lengthFeedback(boundary: TransitionBoundary, requestedFrames: number): LengthFeedback {
  const requested = clampTransitionFrames(requestedFrames)
  const window = planTransitionWindows([
    { sceneId: 'from', startFrame: 0, durationFrames: boundary.fromFrames, transition: undefined },
    { sceneId: 'to', startFrame: boundary.fromFrames ?? 0, durationFrames: boundary.toFrames, transition: { kind: 'fade', duration_frames: requested } },
  ]).get('to')
  const appliedFrames = window?.status === 'ready' ? window.durationFrames : null
  return {
    requestedFrames: requested,
    appliedFrames,
    clamped: appliedFrames !== null && appliedFrames !== requested,
    maxFrames: longestUnclampedFrames(boundary.fromFrames, boundary.toFrames),
  }
}

/**
 * Whether the project holds footage (a clip whose source is a video). Until footage transitions ship, the export renders a
 * boundary next to footage as a cut and refuses the other drawn transitions of such a project; the browser says so.
 */
export function projectHasFootage(document: CompositionDocument): boolean {
  return document.scenes.some((scene) =>
    scene.layers.some((layer) => {
      if (layer.layer_kind !== 'clip') return false
      const placement = (layer as Record<string, unknown>)['placement'] as { source_id?: string } | undefined
      return sourceMediaKind(document, placement?.source_id) === 'video'
    }),
  )
}

/** Whether one of the two scenes of a boundary holds footage (the boundary plays and exports as a cut). */
export function boundaryTouchesFootage(document: CompositionDocument, boundary: TransitionBoundary): boolean {
  const order = document.scene_sequence.scene_ids
  const index = order.indexOf(boundary.sceneId)
  const ids = new Set([order[index - 1], boundary.sceneId])
  return document.scenes.some(
    (scene) =>
      ids.has(scene.scene_id) &&
      scene.layers.some((layer) => {
        if (layer.layer_kind !== 'clip') return false
        const placement = (layer as Record<string, unknown>)['placement'] as { source_id?: string } | undefined
        return sourceMediaKind(document, placement?.source_id) === 'video'
      }),
  )
}
