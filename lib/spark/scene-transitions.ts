import type { CompositionDocument, CompositionScene } from './composition-client'
import { resolveTimeline } from './scene-timing'
import {
  EASINGS,
  TRANSITION_CATALOG as RECIPE_CATALOG,
  TRANSITION_DEFAULT_COLOR as RECIPE_DEFAULT_COLOR,
  TRANSITION_GROUPS,
  TRANSITION_KINDS as RECIPE_KINDS,
  resolveTransition,
  type Easing,
  type TransitionDirection as RecipeDirection,
  type TransitionGroup as RecipeGroup,
  type TransitionKind as RecipeKind,
} from './stage/motion-core/recipes'

/**
 * E1-L (D8): scene transitions in the browser. The catalogue is the Spark effects library's own
 * (`stage/motion-core/recipes/transitions.ts`, the generated copy of `packages/motion-runtime/src/recipes/`; the gateway
 * compiles from the same file), the timing rule a mirror of the gateway's (`scene-compiler/scene-transition-timing.ts`);
 * the gateway is the authority (it validates every write and compiles every transition), the browser only reads the
 * document to show the controls and the chips. Parity of the timing rule is asserted by `scene-transitions.test.ts` over
 * `fixtures/scene-transition-parity.json`, the fixture the gateway test reads.
 *
 * A scene's `transition_in` is the transition from the PREVIOUS scene into it (absent = a cut; inert on the first scene).
 * TIMING RULE: an overlap transition centred on the cut takes `floor(T / 2)` frames from the end of the outgoing scene and
 * the rest from the start of the incoming one; scene starts and the total length never change; a scene gives at most half
 * of its length to each side, so a longer request is shortened (never refused).
 */

export const TRANSITION_KINDS = RECIPE_KINDS
export type TransitionKind = RecipeKind
export type TransitionDirection = RecipeDirection
export const TRANSITION_EASINGS = EASINGS
export type TransitionEasing = Easing
export type TransitionGroup = RecipeGroup

export const TRANSITION_MIN_FRAMES = 2
export const TRANSITION_MAX_FRAMES = 300
export const TRANSITION_DEFAULT_COLOR = RECIPE_DEFAULT_COLOR

export type SceneTransitionParams = { direction?: TransitionDirection; color?: string; easing?: TransitionEasing }
export type SceneTransition = { kind: TransitionKind; duration_frames: number; params?: SceneTransitionParams }

type CatalogEntry = {
  /** Allowed `params.direction`; null = the kind takes none. */
  directions: readonly TransitionDirection[] | null
  defaultDirection: TransitionDirection | null
  color: boolean
  /** `params.easing` is accepted (false: the kind's own fixed timing). */
  easing: boolean
  defaultEasing: TransitionEasing
  /** The catalogue version that added the kind (`scene-transitions@<catalog>`). */
  catalog: number
  /** The Transitions drawer's group. */
  group: TransitionGroup
  /** Progress (0-1) of the still frame its thumbnail shows at rest. */
  thumbProgress: number
}

/** The recipes' catalogue in the editor's shape. */
export const TRANSITION_CATALOG: Readonly<Record<TransitionKind, CatalogEntry>> = Object.fromEntries(
  TRANSITION_KINDS.map((kind) => {
    const entry = RECIPE_CATALOG[kind]
    return [
      kind,
      {
        directions: entry.directions,
        defaultDirection: entry.default_direction,
        color: entry.color,
        easing: entry.easing,
        defaultEasing: entry.default_easing,
        catalog: entry.catalog,
        group: entry.group,
        thumbProgress: entry.thumb_progress,
      },
    ]
  }),
) as Record<TransitionKind, CatalogEntry>

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** The drawer's group order, the catalogue's (later catalogues add Shape, Glitch and 3D; a group without a kind is not shown). */
export const TRANSITION_GROUP_ORDER: readonly TransitionGroup[] = TRANSITION_GROUPS

/**
 * The kinds the editor may OFFER: the gateway writes a `scene-transitions@2` kind only while its switch is open, which the
 * preview plan says (`StagePlan.transitionCatalog`); a kind a scene already stores is always shown.
 */
export function offeredTransitionKinds(catalog: number | undefined, stored: TransitionKind | null = null): TransitionKind[] {
  return TRANSITION_KINDS.filter((kind) => TRANSITION_CATALOG[kind].catalog <= (catalog ?? 1) || kind === stored)
}

/** Half a second at the project's frame rate, never below the minimum (the length a new transition starts with). */
export function defaultTransitionFrames(fps: { num: number; den: number }): number {
  return Math.min(TRANSITION_MAX_FRAMES, Math.max(TRANSITION_MIN_FRAMES, Math.round((0.5 * fps.num) / fps.den)))
}

/** The stored transition of a scene as the gateway validates it, or null (absent or not valid: shown as a cut). */
export function sceneTransitionOf(scene: CompositionScene): SceneTransition | null {
  return readTransition((scene as Record<string, unknown>)['transition_in'])
}

export function readTransition(value: unknown): SceneTransition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const kind = raw['kind']
  const frames = raw['duration_frames']
  if (typeof kind !== 'string' || !(TRANSITION_KINDS as readonly string[]).includes(kind)) return null
  if (typeof frames !== 'number' || !Number.isInteger(frames) || frames < TRANSITION_MIN_FRAMES || frames > TRANSITION_MAX_FRAMES) return null
  const entry = TRANSITION_CATALOG[kind as TransitionKind]
  const rawParams = raw['params']
  const params: SceneTransitionParams = {}
  if (rawParams !== undefined) {
    if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) return null
    const given = rawParams as Record<string, unknown>
    for (const key of Object.keys(given)) if (key !== 'direction' && key !== 'color' && key !== 'easing') return null
    if (given['direction'] !== undefined) {
      if (!entry.directions || !(entry.directions as readonly unknown[]).includes(given['direction'])) return null
      params.direction = given['direction'] as TransitionDirection
    }
    if (given['color'] !== undefined) {
      if (!entry.color || typeof given['color'] !== 'string' || !HEX_COLOR.test(given['color'])) return null
      params.color = given['color'].toLowerCase()
    }
    if (given['easing'] !== undefined) {
      if (!entry.easing || !(TRANSITION_EASINGS as readonly unknown[]).includes(given['easing'])) return null
      params.easing = given['easing'] as TransitionEasing
    }
  }
  return { kind: kind as TransitionKind, duration_frames: frames, ...(Object.keys(params).length > 0 && { params }) }
}

/** What the controls show (and the recipe draws): the stored parameters with every default applied. */
export function resolvedTransition(transition: SceneTransition): { kind: TransitionKind; direction: TransitionDirection | null; color: string | null; easing: TransitionEasing } {
  return resolveTransition(transition)
}

// ---------------------------------------------------------------- timing rule

export type TransitionUnavailableReason = 'invalid' | 'first_scene' | 'scene_length_unresolved' | 'scene_too_short'

export type ReadyTransitionWindow = {
  status: 'ready'
  fromSceneId: string
  toSceneId: string
  transition: SceneTransition
  requestedFrames: number
  /** Frames taken from the end of the outgoing / the start of the incoming scene, and their sum (the window length). */
  fromFrames: number
  toFrames: number
  durationFrames: number
  clamped: boolean
  /** Absolute project frames, end exclusive. */
  startFrame: number
  endFrame: number
  /** Frame of the transition document at which the window starts. */
  documentFrameOffset: number
}

export type UnavailableTransitionWindow = { status: 'unavailable'; reason: TransitionUnavailableReason; fromSceneId: string | null; toSceneId: string }
export type TransitionWindow = ReadyTransitionWindow | UnavailableTransitionWindow

export type TransitionSceneInput = {
  sceneId: string
  startFrame: number
  /** null = unresolved length. */
  durationFrames: number | null
  transition: unknown
}

/** Windows by INCOMING scene id, only for scenes that store a `transition_in`. */
export function planTransitionWindows(scenes: readonly TransitionSceneInput[]): Map<string, TransitionWindow> {
  const plans = new Map<string, TransitionWindow>()
  scenes.forEach((scene, index) => {
    if (scene.transition === undefined) return
    const previous = index > 0 ? scenes[index - 1]! : null
    const unavailable = (reason: TransitionUnavailableReason): UnavailableTransitionWindow => ({
      status: 'unavailable',
      reason,
      fromSceneId: previous?.sceneId ?? null,
      toSceneId: scene.sceneId,
    })
    if (!previous) {
      plans.set(scene.sceneId, unavailable('first_scene'))
      return
    }
    const transition = readTransition(scene.transition)
    if (!transition) {
      plans.set(scene.sceneId, unavailable('invalid'))
      return
    }
    if (previous.durationFrames === null || scene.durationFrames === null) {
      plans.set(scene.sceneId, unavailable('scene_length_unresolved'))
      return
    }
    const requested = transition.duration_frames
    const wantFrom = Math.floor(requested / 2)
    const from = Math.min(wantFrom, Math.floor(previous.durationFrames / 2))
    const to = Math.min(requested - wantFrom, Math.floor(scene.durationFrames / 2))
    if (from < 1 || to < 1) {
      plans.set(scene.sceneId, unavailable('scene_too_short'))
      return
    }
    plans.set(scene.sceneId, {
      status: 'ready',
      fromSceneId: previous.sceneId,
      toSceneId: scene.sceneId,
      transition,
      requestedFrames: requested,
      fromFrames: from,
      toFrames: to,
      durationFrames: from + to,
      clamped: from + to !== requested,
      startFrame: scene.startFrame - from,
      endFrame: scene.startFrame + to,
      documentFrameOffset: previous.durationFrames - from,
    })
  })
  return plans
}

/** The windows of a working copy, from the document alone (what the editor shows before, or without, the preview plan). */
export function transitionWindowsOf(document: CompositionDocument): Map<string, TransitionWindow> {
  const timeline = resolveTimeline(document)
  const byId = new Map(document.scenes.map((scene) => [scene.scene_id, scene]))
  return planTransitionWindows(
    timeline.scenes.map((resolved) => ({
      sceneId: resolved.sceneId,
      startFrame: resolved.startFrame,
      durationFrames: resolved.lengthFrames,
      transition: (byId.get(resolved.sceneId) as Record<string, unknown> | undefined)?.['transition_in'],
    })),
  )
}

/**
 * The longest request that is not shortened, in frames: each side gives at most half of its scene, the odd frame of an odd
 * request goes to the incoming side (`floor(T / 2)` from the outgoing one). null when the pair cannot transition at all.
 */
export function longestUnclampedFrames(fromSceneFrames: number | null, toSceneFrames: number | null): number | null {
  if (fromSceneFrames === null || toSceneFrames === null) return null
  const outgoing = Math.floor(fromSceneFrames / 2)
  const incoming = Math.floor(toSceneFrames / 2)
  for (let frames = Math.min(TRANSITION_MAX_FRAMES, outgoing * 2 + 1, incoming * 2); frames >= TRANSITION_MIN_FRAMES; frames -= 1) {
    if (Math.floor(frames / 2) <= outgoing && frames - Math.floor(frames / 2) <= incoming) return frames
  }
  return null
}

// ---------------------------------------------------------------- what the export does with a cut (timeline v3)

/**
 * What the EXPORT renders at the cut into a scene (timeline v3 export-status bands, coordinator rule "the preview plays
 * exactly what the export renders"). A mirror of the gateway's `compileSceneTransitions` (`scene-transition-compile.ts`):
 *
 * - `none`: no stored transition, a plain cut.
 * - `exports`: drawn at the requested length.
 * - `shortened`: drawn, but the timing rule gives it fewer frames (`frames` of `requestedFrames`).
 * - `video_cut`: a scene of the pair holds a video clip, so the export shows a cut here (R2 composite path).
 * - `video_project`: the pair holds no video but the project does elsewhere: the export refuses the drawn transition
 *   (`transition_with_video_not_compiled`) until footage transitions ship.
 * - `unavailable`: the rule cannot draw it (scene too short, length unknown, invalid, first scene): a cut.
 * - `off`: the gateway's transitions switch is closed (the export refuses a stored transition).
 */
export type TransitionExportState =
  | { state: 'none' }
  | { state: 'exports'; frames: number }
  | { state: 'shortened'; frames: number; requestedFrames: number }
  | { state: 'video_cut' }
  | { state: 'video_project' }
  | { state: 'unavailable'; reason: TransitionUnavailableReason }
  | { state: 'off' }

type ExportBody = Record<string, unknown>

function videoSourceIds(document: CompositionDocument): Set<string> {
  const ids = new Set<string>()
  for (const source of document.source_media as ExportBody[]) {
    const kind = (source['storage_object'] as ExportBody | undefined)?.['media_kind']
    if (kind === 'video' && typeof source['source_id'] === 'string') ids.add(source['source_id'])
  }
  return ids
}

function sceneHoldsVideo(scene: CompositionScene | undefined, videos: ReadonlySet<string>): boolean {
  if (!scene) return false
  return (scene.layers as ExportBody[]).some((layer) => {
    if (layer['layer_kind'] !== 'clip') return false
    const sourceId = (layer['placement'] as ExportBody | undefined)?.['source_id']
    return typeof sourceId === 'string' && videos.has(sourceId)
  })
}

/**
 * The export state of the cut into every scene of the strip after the first (by incoming scene id). `windows` may be passed
 * when the caller already has them (`transitionWindowsOf`); `enabled: false` = the gateway does not draw transitions.
 */
export function transitionExportStates(
  document: CompositionDocument,
  options: { windows?: ReadonlyMap<string, TransitionWindow>; enabled?: boolean } = {},
): Map<string, TransitionExportState> {
  const windows = options.windows ?? transitionWindowsOf(document)
  const videos = videoSourceIds(document)
  const byId = new Map(document.scenes.map((scene) => [scene.scene_id, scene]))
  const order = document.scene_sequence.scene_ids.filter((id) => byId.has(id))
  const footage = new Set(order.filter((id) => sceneHoldsVideo(byId.get(id), videos)))
  const states = new Map<string, TransitionExportState>()
  order.forEach((sceneId, index) => {
    if (index === 0) return
    const window = windows.get(sceneId)
    if (!window) {
      states.set(sceneId, { state: 'none' })
      return
    }
    if (options.enabled === false) {
      states.set(sceneId, { state: 'off' })
      return
    }
    if (window.status === 'unavailable') {
      states.set(sceneId, { state: 'unavailable', reason: window.reason })
      return
    }
    if (footage.has(window.fromSceneId) || footage.has(window.toSceneId)) {
      states.set(sceneId, { state: 'video_cut' })
      return
    }
    if (footage.size > 0) {
      states.set(sceneId, { state: 'video_project' })
      return
    }
    states.set(
      sceneId,
      window.clamped ? { state: 'shortened', frames: window.durationFrames, requestedFrames: window.requestedFrames } : { state: 'exports', frames: window.durationFrames },
    )
  })
  return states
}

/** The export state of the cut into one scene (see `transitionExportStates`); `none` for the first scene or an unknown id. */
export function transitionExportState(document: CompositionDocument, sceneId: string, options: { enabled?: boolean } = {}): TransitionExportState {
  return transitionExportStates(document, options).get(sceneId) ?? { state: 'none' }
}
