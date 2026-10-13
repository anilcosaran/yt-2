import { orderedScenes, type CompositionDocument } from '../composition-client'
import { recipeEase } from '../effects/recipe-eases'
import { planTransitionWindows, readTransition, resolvedTransition, TRANSITION_KINDS, type SceneTransition, type TransitionKind } from '../scene-transitions'
import { REST_LOOK, lookCss, sampleTransition, transitionRecipe, type ClipPolygon, type Look } from './motion-core/recipes'
import type { StageIssue, StagePlan, StagePlanScene, StagePlanTransition } from './stage-types'
import { TRANSITION_HOLD_PHASE, transitionAnimationRoles, type TransitionHold } from './transition-animation-hold'

/**
 * Live FX preview (`SPARK_LIVE_FX_PREVIEW_ENABLED`, timeline design phase 2 "client-side transition preview"): the stage draws
 * a scene transition ITSELF by blending the two scene pictures it holds anyway - the outgoing scene (mounted) and the incoming
 * one (preloaded) - instead of waiting for the server to compile a transition segment. A new transition, a new length, a new
 * kind or direction is on the stage in the frame of the edit, and a boundary next to footage blends too (the `<video>` layers
 * sit inside the scene pictures).
 *
 * The blend is the gateway's recipe itself: `blendAt` samples the Spark effects library's `transitionRecipe` (the generated
 * copy `motion-core/recipes/` of `packages/motion-runtime/src/recipes/`, the very function the gateway's segment compiler
 * builds its Motion IR from) with the runtime's own ease curves (`recipe-eases.ts`) and the runtime's per-frame progress
 * (frame of the window / window length). `transition-blend-parity.test.ts` evaluates the gateway's own segment documents with
 * the vendored runtime at every frame of the window and asserts the same values. Inside the window the outgoing scene is
 * drawn at its own frame (past its last frame it holds its end state: it is mounted with a `tail`), the incoming scene at its
 * own frame (before its first frame it holds its first frame), exactly like the segment's sheet.
 *
 * Timeline v3 (export-truth rule, coordinator decision 2026-10-03; footage relaxed 2026-10-04 on owner request: shown, badged "preview only"). The
 * stage blends only where the export blends: a boundary next to footage (the export cuts there), a transition in a video that
 * holds footage elsewhere and one next to a Motion scene the segment refuses (the export refuses them) are drawn as cuts, with
 * the reason on the scene. Inside a window the outgoing exit and the incoming entry animations are not played, exactly like
 * the segment (`transition-animation-hold.ts`): the presenter mounts the two pictures held for the window.
 */

export type BlendInsets = { top: number; right: number; bottom: number; left: number }

/**
 * How one scene picture looks inside the window: the recipe's look (canvas-px offset, scales about the transform origin,
 * rotation and skew in degrees, opacity, canvas-px blur), the origin (normalised, the canvas centre unless the kind turns
 * about another point) and the visible part while the picture is revealed by a clipping window: `clip` when the window is
 * an axis-aligned band (insets of the canvas), `clipPolygon` otherwise (the window's corners as fractions of the canvas).
 */
export type BlendLook = Look & { origin: readonly [number, number]; clip: BlendInsets | null; clipPolygon: ReadonlyArray<{ x: number; y: number }> | null }

export type BlendFrame = {
  /** Paint order, bottom first. */
  order: ReadonlyArray<'from' | 'to' | 'dip'>
  from: BlendLook
  to: BlendLook
  /** The colour layer of `dip_to_color` and `flash`; null for the other kinds. */
  dip: { color: string; opacity: number } | null
}

export type BlendWindow = {
  transition: SceneTransition
  /** Frames taken from the outgoing scene (`floor(T / 2)`, clamped) and the window length. */
  fromFrames: number
  durationFrames: number
}

const CENTRE = [0.5, 0.5] as const

/** The visible part of a picture as insets of the canvas when the window is an axis-aligned rectangle, else null. */
function insetsOf(polygon: ClipPolygon, canvas: { width: number; height: number }): BlendInsets | null {
  const xs = polygon.map((point) => point.x)
  const ys = polygon.map((point) => point.y)
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
  const [p0, p1, p2, p3] = polygon
  const axisAligned = (near(p0.y, p1.y) && near(p1.x, p2.x) && near(p2.y, p3.y) && near(p3.x, p0.x)) || (near(p0.x, p1.x) && near(p1.y, p2.y) && near(p2.x, p3.x) && near(p3.y, p0.y))
  if (!axisAligned) return null
  const clamp01 = (value: number) => (value <= 0 ? 0 : value >= 1 ? 1 : value)
  return {
    left: clamp01(Math.min(...xs) / canvas.width),
    right: clamp01((canvas.width - Math.max(...xs)) / canvas.width),
    top: clamp01(Math.min(...ys) / canvas.height),
    bottom: clamp01((canvas.height - Math.max(...ys)) / canvas.height),
  }
}

/** The blend at `step` frames into the window (0 = its first frame), for a canvas of `canvas` pixels. */
export function blendAt(window: BlendWindow, step: number, canvas: { width: number; height: number }): BlendFrame {
  const resolved = resolvedTransition(window.transition)
  const recipe = transitionRecipe(resolved, canvas, { from_frames: window.fromFrames, duration_frames: window.durationFrames, document_frame_offset: 0 })
  const sample = sampleTransition(recipe, resolved, canvas, step, recipeEase)
  const insets = sample.clip ? insetsOf(sample.clip, canvas) : null
  return {
    order: sample.order,
    from: { ...sample.from, origin: sample.origin?.from ?? CENTRE, clip: null, clipPolygon: null },
    to: {
      ...sample.to,
      origin: sample.origin?.to ?? CENTRE,
      clip: insets,
      clipPolygon: sample.clip && !insets ? sample.clip.map((point) => ({ x: point.x / canvas.width, y: point.y / canvas.height })) : null,
    },
    dip: sample.dip,
  }
}

// ---------------------------------------------------------------- the plan's transitions as blends

/** Why the export cannot render what the preview blends: `cut` = it exports a cut there; `refused` = it refuses it. */
export type PreviewOnly = 'cut' | 'refused'

/** A blend transition of the plan (`StagePlanTransition.blend`). */
export type PlanBlend = { transition: SceneTransition; previewOnly: PreviewOnly | null }

/** A picture's hold, or null when it holds nothing. */
const holdOf = (side: 'from' | 'to', frame: number, roles: string[]): TransitionHold | null => (roles.length > 0 ? { side, frame, roles } : null)

/**
 * The plan with its scene transitions turned into blends the stage draws itself (`blend` set on every ready entry). Timing
 * is the gateway's rule (`planTransitionWindows`, a parity-tested mirror) over the plan's own scene lengths and the document's
 * stored `transition_in`; a pair the plan does not hold back to back (a document newer or older than the plan) is a cut until
 * the next plan. Nothing changes when the gateway does not draw transitions (`transitionsEnabled` absent): the boundary stays
 * a cut with the server's reason, exactly as before. Timeline v3: a boundary the export does not blend (footage next to it or
 * anywhere in the video) stays a cut with the export's reason; every blend carries the holds of its two pictures.
 */
export function withBlendTransitions(plan: StagePlan, document: CompositionDocument): StagePlan {
  if (plan.transitionsEnabled !== true) return plan
  const scenes = orderedScenes(document)
  const stored = new Map(scenes.map((scene) => [scene.scene_id, (scene as Record<string, unknown>)['transition_in']]))
  if (![...stored.values()].some((value) => value !== undefined && value !== null) && !(plan.transitions?.length ?? 0)) return plan
  const planIndex = new Map(plan.scenes.map((scene, index) => [scene.sceneId, index]))
  const windows = planTransitionWindows(
    scenes.map((scene) => {
      const planned = planIndex.has(scene.scene_id) ? plan.scenes[planIndex.get(scene.scene_id) as number]! : null
      const value = stored.get(scene.scene_id)
      return { sceneId: scene.scene_id, startFrame: planned?.startFrame ?? 0, durationFrames: planned?.durationFrames ?? null, transition: value === null ? undefined : value }
    }),
  )
  // Footage anywhere in the video: the export's composite path has no transition band, it refuses every drawn transition.
  const footage = plan.scenes.some((scene) => scene.nativeLayers.length > 0)
  const transitions: StagePlanTransition[] = []
  const issues = new Map<string, StageIssue[]>()
  for (const [toSceneId, window] of windows) {
    if (window.status === 'unavailable' && window.reason === 'first_scene') continue
    const transition = readTransition(stored.get(toSceneId))
    const base = {
      toSceneId,
      fromSceneId: window.fromSceneId ?? '',
      kind: transition?.kind ?? 'cut',
      requestedFrames: transition?.duration_frames ?? 0,
      durationFrames: null,
      fromFrames: null,
      toFrames: null,
      clamped: false,
      startFrame: null,
      documentFrameOffset: null,
      dependencyHash: null,
    } satisfies Partial<StagePlanTransition>
    if (window.status === 'unavailable') {
      if (window.reason === 'invalid') issues.set(toSceneId, [{ code: 'transition_invalid', message: 'the scene\'s transition is not valid and is shown as a cut', sceneId: toSceneId }])
      else transitions.push({ ...base, status: 'unavailable', reason: window.reason })
      continue
    }
    const fromIndex = planIndex.get(window.fromSceneId)
    const toIndex = planIndex.get(toSceneId)
    const fromScene = fromIndex === undefined ? null : plan.scenes[fromIndex]!
    const toScene = toIndex === undefined ? null : plan.scenes[toIndex]!
    const adjacent = fromScene !== null && toScene !== null && toIndex === (fromIndex as number) + 1 && fromScene.startFrame + fromScene.durationFrames === toScene.startFrame
    if (!adjacent || fromScene.status === 'unavailable' || toScene.status === 'unavailable') {
      transitions.push({ ...base, status: 'unavailable', reason: 'scene_unavailable' })
      continue
    }
    const nextToFootage = fromScene.nativeLayers.length > 0 || toScene.nativeLayers.length > 0
    // Footage: the stage blends it anyway (the `<video>` layers sit inside the scene pictures, the other picture's videos hold
    // their first / last frame) so the user sees the transition while editing, like every cloud editor does. The export does not
    // draw it yet (R2 composite path: a cut next to footage, a refusal with footage elsewhere): the stage badge and the cut's
    // note say so (`previewOnly`), never a silent difference.
    const previewOnly: PreviewOnly | null = nextToFootage ? 'cut' : footage ? 'refused' : null
    transitions.push({
      ...base,
      kind: window.transition.kind,
      status: 'ready',
      reason: null,
      requestedFrames: window.requestedFrames,
      durationFrames: window.durationFrames,
      fromFrames: window.fromFrames,
      toFrames: window.toFrames,
      clamped: window.clamped,
      startFrame: window.startFrame,
      documentFrameOffset: window.documentFrameOffset,
      dependencyHash: `blend:${fromScene.dependencyHash}>${toScene.dependencyHash}`,
      blend: {
        transition: window.transition,
        previewOnly,
        // Timeline v3: inside the window the outgoing exit and the incoming entry animations are not played, like the export.
        holds: {
          from: holdOf('from', window.documentFrameOffset, transitionAnimationRoles(document, window.fromSceneId, TRANSITION_HOLD_PHASE.from)),
          to: holdOf('to', window.toFrames, transitionAnimationRoles(document, toSceneId, TRANSITION_HOLD_PHASE.to)),
        },
      },
    })
  }
  // The scene warnings: the gateway's reasons for a boundary drawn as a cut (a local plan does not carry them yet) and an
  // invalid stored transition, each once.
  const sceneOut: StagePlanScene[] = plan.scenes.map((scene) => {
    const extra = (issues.get(scene.sceneId) ?? []).filter((issue) => !scene.warnings.some((warning) => warning.code === issue.code))
    const kept = scene.warnings
    if (extra.length === 0) return scene
    const warnings = [...kept, ...extra]
    const status: StagePlanScene['status'] = scene.status === 'unavailable' ? 'unavailable' : warnings.length > 0 ? 'partial' : 'ready'
    return { ...scene, warnings, status }
  })
  return { ...plan, scenes: sceneOut, transitions }
}

/** The ready blend into the scene at `index`, or null. */
export function blendInto(plan: Pick<StagePlan, 'scenes' | 'transitions'>, index: number): StagePlanTransition | null {
  const scene = plan.scenes[index]
  if (!scene) return null
  return (plan.transitions ?? []).find((transition) => transition.toSceneId === scene.sceneId && transition.status === 'ready' && transition.blend !== undefined) ?? null
}

/**
 * Frames a scene is mounted past its own end: the incoming side of the blend that leaves it (the outgoing scene holds its end
 * state there, like the segment's sheet evaluates it past its last frame). 0 when no blend leaves it.
 */
export function blendTailOf(plan: Pick<StagePlan, 'scenes' | 'transitions'>, index: number): number {
  return blendInto(plan, index + 1)?.toFrames ?? 0
}

// ---------------------------------------------------------------- what the segment refuses (`transitionSceneRefusal`)

type IrNode = { kind?: string; children?: IrNode[] }
type IrTrack = { kind?: string; tracks?: IrTrack[] }

/**
 * Whether a scene picture could take part in the export's transition segment (a mirror of `transitionSceneRefusal`): a
 * camera (world / camera nodes, camera phases, focus regions), video, Kit or code components, media windows, and word or beat
 * anchors are refused there. The preview blends such a scene anyway; the badge says the export cannot.
 */
export function segmentRefuses(ir: Record<string, unknown>): boolean {
  let refused = false
  const walkNodes = (nodes: readonly IrNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.kind === 'world' || node.kind === 'camera' || node.kind === 'video' || node.kind === 'kit_component' || node.kind === 'code_component') refused = true
      walkNodes(node.children)
    }
  }
  const walkTracks = (tracks: readonly IrTrack[] | undefined) => {
    for (const track of tracks ?? []) {
      if (track.kind === 'camera_phase' || track.kind === 'media_window') refused = true
      if (track.kind === 'timeline') walkTracks(track.tracks)
    }
  }
  walkNodes(ir['nodes'] as IrNode[] | undefined)
  walkTracks(ir['tracks'] as IrTrack[] | undefined)
  if (((ir['focus_regions'] as unknown[] | undefined)?.length ?? 0) > 0) refused = true
  const anchors = (ir['anchors'] as Array<{ anchor?: { kind?: string } }> | undefined) ?? []
  if (anchors.some((entry) => entry.anchor?.kind === 'word' || entry.anchor?.kind === 'beat')) refused = true
  return refused
}

// ---------------------------------------------------------------- the DOM

/** The element a look is written to: the runtime's stage of the scene picture (runtime nodes and `<video>` layers inside). */
export type BlendTarget = { element: HTMLElement; stage: HTMLElement | null }

const pictureOf = (target: BlendTarget): HTMLElement => target.stage ?? target.element

const round = (value: number, digits = 4) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Whether a look leaves the picture's transform alone (offset 0, scales 1, no rotation or skew). */
function restTransform(look: Look): boolean {
  return look.x === REST_LOOK.x && look.y === REST_LOOK.y && look.scale === 1 && look.scale_x === 1 && look.scale_y === 1 && look.rotation === 0 && look.skew_x === 0 && look.skew_y === 0
}

/** Writes one look (style only: transform and its origin, opacity, filter, clip-path) and the paint position. */
export function applyBlendLook(target: BlendTarget, look: BlendLook, z: number): void {
  const picture = pictureOf(target)
  const style = picture.style
  const css = lookCss(look)
  style.transformOrigin = `${round(look.origin[0] * 100, 3)}% ${round(look.origin[1] * 100, 3)}%`
  style.transform = restTransform(look) ? '' : css.transform
  style.opacity = look.opacity === 1 ? '' : String(round(look.opacity))
  style.filter = css.filter
  const percent = (value: number) => `${round(value * 100, 3)}%`
  // A turned clipping window (`diagonal_wipe`): a polygon in percent of the picture, so a stage drawn at any size clips there.
  style.clipPath = look.clip
    ? `inset(${percent(look.clip.top)} ${percent(look.clip.right)} ${percent(look.clip.bottom)} ${percent(look.clip.left)})`
    : look.clipPolygon
      ? `polygon(${look.clipPolygon.map((point) => `${percent(point.x)} ${percent(point.y)}`).join(', ')})`
      : ''
  target.element.style.zIndex = String(z)
}

/** Takes every blend style off a scene picture (it is drawn as itself again). */
export function clearBlendLook(target: BlendTarget): void {
  const picture = pictureOf(target)
  const style = picture.style
  style.transform = ''
  style.opacity = ''
  style.filter = ''
  style.clipPath = ''
  style.transformOrigin = ''
  target.element.style.zIndex = ''
}

/** Draws one frame of a blend on the two scene pictures and the dip layer. */
export function applyBlendFrame(parts: { from: BlendTarget; to: BlendTarget; dip: HTMLElement | null }, frame: BlendFrame): void {
  frame.order.forEach((part, index) => {
    if (part === 'from') applyBlendLook(parts.from, frame.from, index + 1)
    else if (part === 'to') applyBlendLook(parts.to, frame.to, index + 1)
    else if (parts.dip) parts.dip.style.zIndex = String(index + 1)
  })
  if (parts.dip) {
    if (frame.dip) {
      parts.dip.style.display = 'block'
      parts.dip.style.backgroundColor = frame.dip.color
      parts.dip.style.opacity = String(round(frame.dip.opacity))
    } else {
      parts.dip.style.display = 'none'
    }
  }
}

/** The kinds a blend draws (every kind of the catalogue: the recipes are shared). */
export const BLEND_KINDS: readonly TransitionKind[] = TRANSITION_KINDS
