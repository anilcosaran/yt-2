import type { CompositionDocument, CompositionOpSpec } from '../composition-client'
import type { PlaybackStore } from '../playback-store'
import {
  canvasRectToFrame,
  clientToCanvas,
  basisFromNatural,
  centreBasis,
  pointInRect,
  visualBox,
  type LayerBasis,
} from './geometry'
import { GestureController, type GestureOutcome, type GesturePreview, type PointerInput } from './gesture-controller'
import { audioBedSpecs, mediaPlacementSpecs, resolvePlacement, sourceProbeOf, type CanvasPoint, type PlacementTarget, type StagePlacement, type VideoFit } from './placement'
import { runtimeOnlyZIndex } from './caption-layers'
import { isNativeVideoLayer, layerViewOf, layerVisibleAt, sceneLayerViews, type StageLayerView } from './document-layers'
import { StageMediaLayer, audioPlacementPlans, type MediaSceneInput } from './media-sync'
import { withBlendTransitions } from './transition-blend'
import { sceneAtFrame } from './scene-plan'
import { ScenePresenter, type PresenterState } from './scene-presenter'
import type { MountedScene } from './runtime-host'
import {
  arrangeCommit,
  cornerRadiusCommit,
  fillCommit,
  layerDeleteCommit,
  lockCommit,
  newTextDefaults,
  opacityCommit,
  normalizeTextCommit,
  patchedBasis,
  shapeResizeCommit,
  styleCommit,
  textCommit,
  textInsertAction,
  textSizeCommit,
  transformClear,
  transformCommit,
  type ArrangeAction,
} from './stage-edits'
import {
  FALLBACK_SHAPE_FILL,
  MAX_SHAPE_PX,
  MIN_SHAPE_PX,
  isAspectLocked,
  isBoxedShape,
  isEdgeHandle,
  isPillRadius,
  isShapeFill,
  pillRadius,
  shapeInsertAction,
  type ShapeHandle,
  type ShapeKind,
} from './shape-model'
import { singleLayerId, StageSelectionStore, type StageSelection } from './stage-selection'
import type { StageSessionPort } from './stage-session'
import type { StageCoverageChecker, StageLayerKind, StageMediaResolver, StagePlan, StageRect } from './stage-types'
import type { StageMediaFactory } from './media-sync'
import { clipReplaceSourceSpec, clipSetAudioSpec, layerSetTransformSpec, newAudioPlacementId, newLayerId, type CompositionFontRef, type TextStyleSpecPatch } from '../composition-typed-edits'
import type { InspectorSchema } from './inspector-schema'
import { controlSet, toggledDecoration } from './toolbox-model'
import type { SparkAspectRatio } from '../api'
import { planAspectSwitch, type AspectPlan } from './aspect-relayout'
import { coverTransform, mediaFitOf, type MediaFit, type Size } from './cover-transform'
import { DUPLICATE_OFFSET_PX, copyOfLayer, pasteSpecs, type LayerCopy, type PasteRefusal } from './layer-clipboard'
import { mediaSourceRef, type MediaSizeResolver } from './media-size'
import { insertCover, sameMediaFit, type MediaInsertFit } from './media-insert-fit'
import { createSparkUndoGroup, type SparkUndoGroup } from '../undo-group'

/**
 * The stage controller: the one object behind the `SparkStage` component. It glues the playback clock, the scene
 * presenter (runtime host), the media layer, the selection and the gestures to the editor session, and publishes ONE
 * view-state snapshot for React. The document and the session stay the only authority for values: a gesture previews
 * transiently on the mounted DOM, then sends exactly one typed command through `session.apply`; the preview stays until
 * a drawn picture CONTAINS the edit (WP1): a picture of the editor's own copy made from a copy that carries it, or a server
 * picture of a version at or after the command's receipt. Merely redrawing the scene (an older picture, the server's
 * picture the local plan keeps for a scene it cannot draw) never drops it: the stage never shows the pre-drag position again.
 */

export type StageOverlay = {
  layerId: string
  kind: StageLayerKind
  /** Frame-local CSS pixels. */
  rect: StageRect
  resizable: boolean
  isText: boolean
  isMedia: boolean
  /** E1-B: a shape that resizes freely also has the four edge handles (a square or a circle keeps equal sides: corners only). */
  edgeHandles: boolean
  /** Spark styling round: the layer is locked (selected from a panel: no handles, no drag; the panels still edit it). */
  locked: boolean
}

export type StageTextEdit = {
  layerId: string
  sceneId: string
  rect: StageRect
  text: string
  fontFamily: string
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  fontSizePx: number
  lineHeightPx: number
  color: string
  align: 'left' | 'center' | 'right'
  committing: boolean
  tooLong: boolean
}

export type StageTextHint = { layerId: string; status: 'glyph_missing' | 'unsupported_script'; missingCount: number }

/** A short message of a canvas action that did nothing visible (a paste that does not fit, a copy of a Motion layer, ...). */
export type StageNotice = {
  key:
    | 'pasteDoesNotFit'
    | 'pasteUnsupported'
    | 'pasteMissingSource'
    | 'copyUnsupported'
    | 'clipboardEmpty'
    | 'copied'
    | 'replaceKind'
    | 'replaceTooShort'
    | 'replaceFailed'
    | 'replaced'
    | 'redoSoon'
  seq: number
}

/**
 * What changes FRAME BY FRAME while a gesture runs or the clip plays: the selection box, the position badge and the snap
 * guides. It is written straight to the DOM by the stage component (`subscribeLive`), never through a React render: a drag
 * or playback costs no React commit per pointer move or per frame (60 fps target). The view state carries the same values
 * (read synchronously by `getSnapshot`), React is told only when the gesture starts and ends.
 */
export type StageLive = {
  /** Frame-local CSS pixels of the selected layer. */
  overlay: StageRect | null
  badge: { text: string; x: number; y: number } | null
  guides: { v: number | null; h: number | null } | null
}

export type StageViewState = {
  presenter: PresenterState
  selection: StageSelection | null
  overlay: StageOverlay | null
  hover: StageRect | null
  dragging: boolean
  badge: { text: string; x: number; y: number } | null
  guides: { v: number | null; h: number | null } | null
  safeArea: StageRect | null
  editing: StageTextEdit | null
  textHint: StageTextHint | null
  menu: { x: number; y: number; layerId: string } | null
  scale: number
  /** A command of the stage is being written. */
  pending: boolean
  /** The keyboard shortcuts sheet ("?") is open. */
  shortcuts: boolean
  notice: StageNotice | null
  /** Toolbar "Replace": the next image or video picked in the Media tool replaces this clip's source. */
  replacing: { sceneId: string; layerId: string } | null
  /**
   * Timeline v3: playback waits (at most `PLAYBACK_WAIT_MS`) for a frame the stage cannot draw yet, a transition still
   * loading, instead of skipping it; the stage shows a small ring meanwhile.
   */
  waiting: boolean
}

export type StagePointerEvent = PointerInput & { button: number; target: EventTarget | null; preventDefault(): void }
export type StageKeyEvent = {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  target: EventTarget | null
  preventDefault(): void
}

export type InspectorFontsLike = {
  families: ReadonlyArray<{ family: string; faces: ReadonlyArray<{ font: CompositionFontRef; weight: number; style: 'normal' | 'italic' }> }>
}

export type StageControllerOptions = {
  source: import('./stage-types').StagePreviewSource
  loadRuntime: () => Promise<import('./runtime-api').MotionRuntimeModule>
  media: StageMediaResolver
  session: StageSessionPort
  playback: PlaybackStore
  selection?: StageSelectionStore
  doc: Document
  mediaFactory?: StageMediaFactory
  coverage?: StageCoverageChecker | null
  fonts?: () => InspectorFontsLike | null
  /** The inspector schema (`composition_inspector_schema_v1`): a keyboard shortcut offers only what a listed control writes. */
  schema?: () => InspectorSchema | null
  uuid?: () => string
  timers?: { setTimeout(callback: () => void, ms: number): number; clearTimeout(handle: number): void }
  /** Strings the stage puts into the document (a new text layer's copy). */
  labels: { newText: string }
  /** Opens the Ask-AI panel for the current selection (the shell implements it). */
  onAskAi?: (target: { selection: StageSelection | null; playheadFrame: number }) => void
  /** Seconds a newly added image holds (F35 default 3 s). */
  imageHoldSeconds?: number
  /**
   * WP2: idle time (ms) after which a copy the stage drew entirely by itself (no manifest or scene read) is checked against
   * the server's plan and IR in the background. Default 2000; null = no automatic check (a test seam: tests that are not
   * about the check keep a wall-clock timer out of their traffic, a test about it sets the delay it waits for).
   */
  verifyIdleMs?: number | null
  /**
   * `SPARK_CONTEXT_TOOLBAR_ENABLED`: the contextual toolbar's canvas behaviour: Ctrl/Cmd+D / C / V, the "?" sheet, and an
   * image or video added to a scene covers the canvas (`cover-transform.ts`). Off: the canvas behaves exactly as before.
   */
  contextToolbar?: boolean
  /**
   * `SPARK_REDO_ENABLED`: the editor owns the history keys (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y; `use-history-shortcuts.ts`),
   * so the canvas leaves redo alone instead of saying "not available yet".
   */
  historyKeys?: boolean
  /** The pixel size of a project source (cover on insert, the aspect switch); without it the size is never known. */
  mediaSize?: MediaSizeResolver
  /**
   * `SPARK_LIVE_FX_PREVIEW_ENABLED`: scene transitions are drawn by the stage itself, blending the two scene pictures
   * (`transition-blend.ts`), next to footage too; no transition segment is read. Off: the server's segments, as before.
   */
  liveFx?: boolean
}

const NUDGE_COMMIT_MS = 350
/** Timeline v3: the longest playback waits for a frame the stage cannot draw yet (a transition loading) before it plays on. */
export const PLAYBACK_WAIT_MS = 300
/** Timeline v3: a wait shorter than this shows no ring (nothing for React). */
const WAIT_RING_DELAY_MS = 80
/** Timeline v3: transitions starting this far ahead of the playhead are loaded before it reaches them (spec: at least 3 s). */
const PRELOAD_SECONDS = 4
/** Timeline v3: how often (in frames) playback looks ahead for transitions to load. */
const PRELOAD_STEP_FRAMES = 15
const PREVIEW_RELEASE_MS = 8000
const VERIFY_IDLE_MS = 2000
/** Scene hashes remembered with the server version that named them (a bound, not a cache that matters when it forgets). */
const SERVER_HASHES = 512
const INITIAL_PRESENTER: PresenterState = { status: 'idle', error: null, plan: null, sceneId: null, sceneStatus: 'loading', issues: [] }

type TextStylePatch = TextStyleSpecPatch

/** Coalesce key of a PARTIAL op: only a command that sets the same fields may replace a queued one (latest wins). */
function fieldsKey(patch: Record<string, unknown>): string {
  return Object.keys(patch).filter((field) => patch[field] !== undefined).sort().join(',')
}

type Transient = {
  layerId: string
  element: HTMLElement
  saved: { left: string; top: string; transform: string; width: string; height: string }
  /** E1-B: the content node of a shape whose box is previewed while it is resized (restored with the group). */
  content?: { element: HTMLElement; saved: { width: string; height: string; transformOrigin: string; borderRadius: string } }
  base: LayerBasis
  visual: StageRect
  /** WP1: the last preview drawn, applied again when the scene is mounted anew before a picture contains the edit. */
  preview: GesturePreview
}

/** WP1: a layer whose command was written and whose preview stays until a drawn picture contains the edit. */
type PendingLayer = {
  seq: number
  sceneId: string
  /** E1-N: the session's `localRevision` of the first copy that carries the edit (null: the edit waits for the server). */
  localRevision: number | null
  /** The stage's copy sequence (`docSeq`) from which every copy handed in carries the edit. */
  fromSeq: number | null
  /** The server's working copy version that holds the edit (from the receipt); null until the server has answered. */
  minVersion: number | null
  /** The gesture's picture when the command was written (a later gesture on the layer that is cancelled comes back to it). */
  preview: GesturePreview | null
}

const hashKey = (sceneId: string, hash: string) => `${sceneId}\u0000${hash}`

/** WP2: every scene of a local plan is drawn from the copy itself (no server picture of older content is kept in it). */
function planDrawsItsCopy(plan: StagePlan): boolean {
  return plan.origin === 'local' && plan.scenes.every((scene) => scene.status !== 'unavailable' && scene.contentHash !== undefined && scene.contentHash === scene.dependencyHash)
}

export class SparkStageController {
  readonly presenter: ScenePresenter
  readonly selection: StageSelectionStore
  readonly media: StageMediaLayer
  private readonly options: StageControllerOptions
  private readonly listeners = new Set<() => void>()
  private state: StageViewState
  private frame: HTMLElement | null = null
  private document: CompositionDocument | null = null
  private version = -1
  /** The working copy version whose preview is drawn (`version` is only the held document's). */
  private drawnVersion = -1
  /** E1-N: `localRevision` of the copy last handed in (> 0: the document carries edits the server has not confirmed). */
  private localRevision = 0
  /** WP1: counts the copies handed in (each new version or local revision is one). */
  private docSeq = 0
  /** WP1: the copy the plan on the stage was made from when it is a LOCAL plan (null: the server's plan is drawn). */
  private planned: { seq: number; version: number } | null = null
  /** WP1: `sceneId\0hash` -> the highest server version whose plan named that hash (the content of the scene at it). */
  private serverHashes = new Map<string, number>()
  private verifyTimer: number | null = null
  private textWarmed = false
  private gesture: GestureController | null = null
  private gestureLayer: { layerId: string; sceneId: string; moved: boolean } | null = null
  /** Gesture pictures on the mounted DOM, per layer (a layer dropped while another one's picture is still held keeps its own). */
  private transients = new Map<string, Transient>()
  /** Commands written whose preview stays until a drawn picture contains the edit (WP1). */
  private pendingLayers = new Map<string, PendingLayer>()
  private lastBasis = new Map<string, LayerBasis>()
  /** Y1R-EDITOR-3: text style fields sent but not yet in the held working copy (layer -> merged patch). */
  private pendingStyles = new Map<string, { patch: TextStylePatch; token: object; minVersion: number }>()
  private layerSeq = new Map<string, number>()
  private pendingSelect: { layerId: string; sceneId: string; minVersion: number } | null = null
  private pendingWrites = 0
  private nudge: { layerId: string; sceneId: string; basis: LayerBasis; timer: number | null } | null = null
  private unsubscribes: Array<() => void> = []
  private hoverScheduled = false
  private disposed = false
  private removeWindowListeners: (() => void) | null = null
  private syncing: Promise<void> = Promise.resolve()
  private frameWidth = 0
  private readonly liveListeners = new Set<(live: StageLive) => void>()
  private live: StageLive = { overlay: null, badge: null, guides: null }
  /** Ctrl/Cmd+C of this page (memory only): the copied layer and how often it was pasted into its own scene. */
  private clipboard: { copy: LayerCopy; pastes: number } | null = null
  private noticeSeq = 0
  /** A colour being picked, shown on the drawn element until the pick is committed or abandoned. */
  private colorPreview: ColorPreview | null = null
  /** Spark styling round: an opacity being slid, shown on the drawn layer group until it is committed or abandoned. */
  private opacityPreview: { element: HTMLElement; saved: string } | null = null

  constructor(options: StageControllerOptions) {
    this.options = options
    this.selection = options.selection ?? new StageSelectionStore()
    this.presenter = new ScenePresenter({ source: options.source, loadRuntime: options.loadRuntime, onPlanOutdated: () => this.onPlanOutdated() })
    this.media = new StageMediaLayer({
      doc: options.doc,
      media: options.media,
      fps: () => options.playback.getSnapshot().fps,
      ...(options.mediaFactory && { factory: options.mediaFactory }),
    })
    this.state = {
      presenter: INITIAL_PRESENTER,
      selection: null,
      overlay: null,
      hover: null,
      dragging: false,
      badge: null,
      guides: null,
      safeArea: null,
      editing: null,
      textHint: null,
      menu: null,
      scale: 1,
      pending: false,
      shortcuts: false,
      notice: null,
      replacing: null,
      waiting: false,
    }
    this.unsubscribes.push(
      this.presenter.subscribe(() => this.publish()),
      this.selection.subscribe(() => this.onSelectionChanged()),
      this.presenter.onPresented((scene) => this.onPresented(scene)),
      options.playback.subscribeFrame((frame) => this.onFrame(frame)),
      options.playback.subscribe(() => this.onPlaybackState()),
      this.media.onChange(() => this.publish()),
    )
    // E1-N: the server's IR differs from the local picture of the same hash: the server's wins.
    const corrections = options.source.local?.onCorrection((bundle) => this.presenter.replaceBundle(bundle))
    if (corrections) this.unsubscribes.push(corrections)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = (): StageViewState => this.state

  /** Frame-by-frame values (selection box, badge, guides) for the stage component to write to the DOM (`StageLive`). */
  readonly subscribeLive = (listener: (live: StageLive) => void) => {
    this.liveListeners.add(listener)
    return () => {
      this.liveListeners.delete(listener)
    }
  }

  readonly getLive = (): StageLive => this.live

  private emitLive(patch: Partial<StageLive>): void {
    this.live = { ...this.live, ...patch }
    for (const listener of [...this.liveListeners]) listener(this.live)
  }

  // ---------------------------------------------------------------- lifecycle

  /** Binds the DOM: `frame` is the canvas-sized box the scenes mount into (its client rect maps pointer to canvas px). */
  attach(frame: HTMLElement): void {
    this.frame = frame
    this.presenter.attach(frame)
    void this.showCurrentFrame()
  }

  detach(): void {
    this.endGestureListeners()
    this.media.pauseAll()
    this.presenter.detach()
    this.frame = null
  }

  /** CSS width of the frame (the canvas is scaled to it). */
  setFrameWidth(width: number): void {
    this.frameWidth = width
    this.applyScale()
  }

  private applyScale(): void {
    const canvasWidth = this.presenter.plan?.canvas.width ?? 0
    if (canvasWidth <= 0 || this.frameWidth <= 0) return
    const scale = this.frameWidth / canvasWidth
    if (Math.abs(scale - this.state.scale) < 1e-9) return
    this.presenter.setScale(scale)
    this.publish({ scale })
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  dispose(): void {
    this.disposed = true
    this.endGestureListeners()
    this.clearNudgeTimer()
    if (this.verifyTimer !== null) this.timers().clearTimeout(this.verifyTimer)
    this.verifyTimer = null
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    this.unsubscribes = []
    this.media.dispose()
    this.presenter.dispose()
    this.listeners.clear()
    this.liveListeners.clear()
  }

  /** The session's working copy changed (or was loaded): read the new preview and draw it. */
  setWorkingCopy(input: { version: number; document: CompositionDocument; localRevision?: number }): void {
    this.document = input.document
    const localRevision = input.localRevision ?? 0
    if (input.version === this.version && localRevision === this.localRevision) return
    this.version = input.version
    this.docSeq += 1
    for (const [layerId, pending] of [...this.pendingStyles]) if (pending.minVersion <= input.version) this.pendingStyles.delete(layerId)
    this.localRevision = localRevision
    for (const pending of this.pendingLayers.values()) this.noteCarried(pending)
    this.selection.prune(input.document)
    // Spark styling round: locking draws nothing new (the scene's picture and hash stay), so the scene is not presented again;
    // the selection frame of the locked / unlocked layer is published here instead.
    const overlay = this.state.overlay
    const selectedView = overlay ? layerViewOf(input.document, this.selection.getSnapshot()?.sceneId ?? null, overlay.layerId) : null
    if (overlay && selectedView && (selectedView.locked === true) !== overlay.locked) this.publish()
    if (localRevision > 0) {
      // E1-N: the editor's own copy (the server's with unconfirmed edits on top) is drawn NOW, not queued behind the
      // server's reads. When it cannot be drawn here the stage keeps what it shows until the server's picture arrives.
      void this.showLocal(input.version, input.document)
      return
    }
    // WP2: the server's copy (taken from a receipt, or read) that the browser draws entirely by itself is drawn now: no
    // manifest or scene read on the way; the server's plan and IR are compared in the background once the editor is idle.
    if (this.showLocal(input.version, input.document, { complete: true })) {
      this.scheduleVerify()
      return
    }
    this.syncing = this.syncing.then(() => this.syncPreview(input.version, input.document)).catch(() => undefined)
  }

  /**
   * E1-N: plans and draws the editor's own copy of the document; null when the source cannot draw it locally. `complete`
   * (WP2): only when every scene is drawn from the copy itself (then the copy, the server's at `version`, needs no read: its
   * scene hashes are the server's, by the parity of the port).
   */
  private showLocal(version: number, document: CompositionDocument, options: { complete?: boolean } = {}): Promise<void> | null {
    const plan = this.options.source.local?.plan(document, version) ?? null
    if (!plan || this.disposed) return null
    if (options.complete && !planDrawsItsCopy(plan)) return null
    this.planned = { seq: this.docSeq, version }
    if (options.complete) this.noteServerPlan(plan, version)
    this.options.playback.configure({ totalFrames: plan.totalFrames, fps: plan.canvas.fps })
    this.presenter.usePlan(this.withFx(plan, document))
    this.applyScale()
    this.media.setAudio(audioPlacementPlans(document, plan))
    const shown = this.showCurrentFrame()
    if (!options.complete) return shown
    return shown.then(() => {
      // The server's copy at `version` is on the stage: what waited for that version is drawn.
      this.drawnVersion = Math.max(this.drawnVersion, version)
      this.releasePending(version)
    })
  }

  /** WP1: a copy that carries a pending edit reached the stage: every later copy carries it too. */
  private noteCarried(pending: PendingLayer): void {
    if (pending.fromSeq === null && pending.localRevision !== null && this.localRevision >= pending.localRevision) pending.fromSeq = this.docSeq
  }

  /** WP1: remembers which server version named each scene hash of a plan (a picture of that hash shows that content). */
  private noteServerPlan(plan: StagePlan, version = plan.workingCopyVersion): void {
    for (const scene of plan.scenes) {
      const key = hashKey(scene.sceneId, scene.dependencyHash)
      const known = this.serverHashes.get(key)
      if (known !== undefined && known >= version) continue
      this.serverHashes.delete(key)
      this.serverHashes.set(key, version)
    }
    while (this.serverHashes.size > SERVER_HASHES) this.serverHashes.delete(this.serverHashes.keys().next().value as string)
  }

  private timers(): { setTimeout(callback: () => void, ms: number): number; clearTimeout(handle: number): void } {
    return this.options.timers ?? { setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms) as unknown as number, clearTimeout: (handle) => globalThis.clearTimeout(handle) }
  }

  /**
   * WP2: a copy drawn without the server's plan is checked once the editor is idle: the server's plan is read (quietly) and
   * every scene the browser compiled is compared with the server's IR (`local.verify`); a difference redraws it.
   */
  private scheduleVerify(): void {
    const timers = this.timers()
    if (this.verifyTimer !== null) timers.clearTimeout(this.verifyTimer)
    this.verifyTimer = null
    const delay = this.options.verifyIdleMs === undefined ? VERIFY_IDLE_MS : this.options.verifyIdleMs
    if (delay === null || this.disposed) return
    this.verifyTimer = timers.setTimeout(() => {
      this.verifyTimer = null
      if (this.disposed || !this.document) return
      if (this.pendingWrites > 0 || this.gesture) {
        this.scheduleVerify()
        return
      }
      const document = this.document
      this.syncing = this.syncing.then(() => this.syncPreview(this.version, this.document ?? document, { quiet: true })).catch(() => undefined)
    }, delay)
  }

  /** WP1: the presenter met a server picture newer than the one the local plan keeps: re-read the plan, re-plan on top. */
  private onPlanOutdated(): void {
    if (this.disposed || !this.document) return
    const document = this.document
    this.syncing = this.syncing.then(() => this.syncPreview(this.version, this.document ?? document, { quiet: true })).catch(() => undefined)
  }

  /** E1-N: loads the face of a new text so that adding text is instant (the stage's rail "Text" calls it when ready). */
  prepareText(): void {
    if (this.textWarmed) return
    const fonts = this.options.fonts?.()
    const canvas = this.canvasSize()
    const local = this.options.source.local
    if (!fonts || !canvas || !local) return
    const defaults = newTextDefaults(fonts.families, canvas.height)
    // Tried again on every server plan until the face (and the manifest that names it) is there.
    if (defaults) void local.prepareText(defaults.font).then((loaded) => { if (loaded) this.textWarmed = true })
  }

  /** Resolves when the newest `setWorkingCopy` has been read and drawn (tests and the shell's "saved" state use it). */
  whenSettled(): Promise<void> {
    return this.syncing
  }

  private async syncPreview(version: number, document: CompositionDocument, options: { quiet?: boolean } = {}): Promise<void> {
    const plan = await this.presenter.readPlan(version, options)
    if (!plan || this.disposed) return
    this.noteServerPlan(plan)
    // E1-N: the server compiled what the browser drew; the two pictures are compared in the background.
    this.options.source.local?.verify(plan)
    this.prepareText()
    // A newer edit arrived while the server's plan was being read: its picture stays on the stage (the plan just read is
    // the server's state BEFORE that edit, and the source keeps it as the base of the next local plan).
    if (this.localRevision > 0) {
      const shown = this.showLocal(this.version, this.document ?? document)
      if (shown) return shown
    }
    // WP1: a server plan older than the copy whose picture the stage shows (a lagging read) never replaces that picture.
    if (plan.workingCopyVersion < this.version && this.planned !== null) {
      const shown = this.showLocal(this.version, this.document ?? document)
      if (shown) return shown
    }
    this.planned = null
    this.presenter.adopt(this.withFx(plan, document))
    this.options.playback.configure({ totalFrames: plan.totalFrames, fps: plan.canvas.fps })
    this.applyScale()
    this.media.setAudio(audioPlacementPlans(document, plan))
    if (this.frame) await this.showCurrentFrame()
    this.drawnVersion = Math.max(this.drawnVersion, version)
    this.releasePending(version)
  }

  /** Live FX: the plan with its transitions drawn by the stage itself (blends), or the plan as it is. */
  private withFx(plan: StagePlan, document: CompositionDocument): StagePlan {
    return this.options.liveFx === true ? withBlendTransitions(plan, document) : plan
  }

  private async showCurrentFrame(): Promise<void> {
    await this.presenter.show(this.options.playback.frame)
    this.publish()
  }

  // ---------------------------------------------------------------- playback

  private onFrame(frame: number): void {
    this.preloadAhead(frame)
    if (this.presenter.seek(frame)) {
      this.waitSpent = false
      this.syncMedia(frame)
      // Only a selection follows the picture frame by frame (animations move it); nothing else re-renders.
      if (this.state.selection || this.state.overlay) this.followSelection()
      return
    }
    // Timeline v3 (wait instead of skip): playing into a frame the stage cannot draw yet (a transition window or a scene still
    // loading), the clock waits for it, at most PLAYBACK_WAIT_MS with a small ring, then plays on. Once per load.
    if (this.options.playback.playing && !this.waitRelease && !this.waitSpent) {
      const release = this.options.playback.stall()
      this.waitRelease = release
      // The ring only for a wait that lasts: a picture that is ready in a moment (the usual case) changes nothing for React.
      const ring = this.timers().setTimeout(() => {
        if (this.waitRelease === release) this.publish({ waiting: true })
      }, WAIT_RING_DELAY_MS)
      const end = (spent: boolean) => {
        if (this.waitRelease !== release) return
        this.waitRelease = null
        this.timers().clearTimeout(timer)
        this.timers().clearTimeout(ring)
        this.waitSpent = spent
        release()
        if (this.state.waiting) this.publish({ waiting: false })
      }
      const timer = this.timers().setTimeout(() => end(true), PLAYBACK_WAIT_MS)
      void this.showCurrentFrame()
        .catch(() => undefined)
        .then(() => {
          end(false)
          this.syncMedia(this.options.playback.frame)
        })
      return
    }
    void this.showCurrentFrame().then(() => this.syncMedia(frame))
  }

  /** Timeline v3: the release of the playback wait on screen (null: none). */
  private waitRelease: (() => void) | null = null
  /** Timeline v3: a wait already timed out for the load in progress: playback goes on without waiting again until a frame draws. */
  private waitSpent = false
  /** Timeline v3: the last preload bucket asked for (`preloadAhead` runs a few times a second, not on every frame). */
  private preloadBucket = -1

  /** Timeline v3: the transitions starting within the next PRELOAD_SECONDS are loaded before the playhead reaches them. */
  private preloadAhead(frame: number): void {
    const plan = this.presenter.plan
    if (!plan || !(plan.transitions?.length ?? 0)) return
    const bucket = Math.floor(frame / PRELOAD_STEP_FRAMES)
    if (bucket === this.preloadBucket) return
    this.preloadBucket = bucket
    const { num, den } = plan.canvas.fps
    this.presenter.preloadAhead(frame, Math.ceil((PRELOAD_SECONDS * num) / den))
  }

  /**
   * The selection box follows an animated layer. While the clip PLAYS the box moves on the DOM only (`StageLive`): playback
   * costs no React render per frame; the view state is told when the selected layer appears, disappears or playback stops.
   */
  private followSelection(): void {
    const current = this.state.overlay
    if (!this.options.playback.playing || !current) {
      this.publish()
      return
    }
    const selection = this.selection.getSnapshot()
    const layerId = singleLayerId(selection)
    const overlay = layerId && selection ? this.overlayFor(layerId, selection.sceneId) : null
    if (!overlay || overlay.layerId !== current.layerId || overlay.kind !== current.kind) {
      this.publish()
      return
    }
    if (sameOverlay(overlay, current)) return
    this.state = { ...this.state, overlay }
    this.emitLive({ overlay: overlay.rect })
  }

  private onPlaybackState(): void {
    const { playing, frame } = this.options.playback.getSnapshot()
    if (playing) {
      // Design: playing deselects nothing here; a click on the canvas pauses and selects (V5). Close transient UI.
      this.publish({ menu: null, hover: null })
    } else {
      this.media.pauseAll()
      // Timeline v3: a pause ends a playback wait (the clock ended it already).
      this.waitRelease = null
      this.waitSpent = false
      // The box followed the clip on the DOM only: React learns where it stopped (the toolbar comes back there).
      this.publish(this.state.waiting ? { waiting: false } : {}, { force: true })
    }
    this.syncMedia(frame)
  }

  private syncMedia(frame: number): void {
    this.media.sync(frame, this.options.playback.playing)
  }

  private currentSceneAt() {
    const plan = this.presenter.plan
    return plan ? sceneAtFrame(plan, this.options.playback.frame) : null
  }

  private onPresented(scene: MountedScene | null): void {
    if (scene) this.bindMedia(scene, this.presenter.partner)
    else this.media.bindScene({ stage: null, startFrame: 0, canvas: { width: 1, height: 1 }, nativeLayers: [], runtimeLayers: [], transformOf: () => null })
    // WP1: the previews whose edit the mounted picture contains are dropped (the picture shows the edit now) ...
    this.settleIncluded(scene)
    // ... and those it does not contain stay where they were dropped: a scene mounted anew (an older picture, the server's
    // picture the local plan keeps for a scene it cannot draw, the scene shown again after another one) gets the preview
    // again instead of showing the old position. A gesture or nudge in progress keeps its own picture on the new element.
    for (const [layerId, transient] of [...this.transients]) {
      if (transient.element.isConnected) continue
      this.transients.delete(layerId)
      if (scene && (this.gestureLayer?.layerId === layerId || this.nudge?.layerId === layerId)) this.applyTransient(scene, transient.preview)
    }
    if (scene) {
      for (const [layerId, pending] of this.pendingLayers) {
        if (pending.sceneId === scene.sceneId && pending.preview && !this.transients.has(layerId)) this.applyTransient(scene, pending.preview)
      }
    }
    this.syncMedia(this.options.playback.frame)
    this.publish()
  }

  /**
   * WP1: whether the mounted picture of the pending layer's scene contains its edit: a server picture (its hash was named by a
   * server plan at or after the receipt's version), or a picture of the editor's own copy whose content hash it is, made from
   * a copy that carries the edit. Merely having the layer in the picture is not enough.
   */
  private includes(pending: PendingLayer, scene: MountedScene): boolean {
    if (scene.sceneId !== pending.sceneId) return false
    if (pending.minVersion !== null) {
      const version = this.serverHashes.get(hashKey(scene.sceneId, scene.dependencyHash))
      if (version !== undefined && version >= pending.minVersion) return true
    }
    const planned = this.planned
    const plan = this.presenter.plan
    if (!planned || plan?.origin !== 'local') return false
    const planScene = plan.scenes.find((candidate) => candidate.sceneId === scene.sceneId)
    if (planScene?.contentHash === undefined || planScene.contentHash !== scene.dependencyHash) return false
    return (pending.fromSeq !== null && planned.seq >= pending.fromSeq) || (pending.minVersion !== null && planned.version >= pending.minVersion)
  }

  /** WP1: drops the previews whose edit the mounted picture contains. */
  private settleIncluded(scene: MountedScene | null): void {
    if (!scene) return
    for (const [layerId, pending] of [...this.pendingLayers]) if (this.includes(pending, scene)) this.settle(layerId)
  }

  private settle(layerId: string): void {
    this.pendingLayers.delete(layerId)
    this.lastBasis.delete(layerId)
    // A drag or nudge in progress on the layer owns its picture now: the picture of an EARLIER drop arriving meanwhile must
    // not take it away (the layer would leave the pointer, and a release before the next move would show the older position
    // until the new drop's own picture is drawn). `onPresented` moves the gesture's picture onto a scene mounted anew.
    if (this.gesturePictureOf(layerId)) return
    this.restoreTransient(layerId)
  }

  /** Whether a gesture or an arrow-key nudge in progress has drawn its own picture of the layer. */
  private gesturePictureOf(layerId: string): boolean {
    return (this.gestureLayer?.layerId === layerId && this.gestureLayer.moved) || this.nudge?.layerId === layerId
  }

  /** The footage of the scene that holds the frame, and (live FX) of the other picture of a blend on screen. */
  private bindMedia(scene: MountedScene, partner: MountedScene | null = null): void {
    const primary = this.mediaInputOf(scene)
    if (!primary) return
    this.media.bindScenes(primary, partner ? this.mediaInputOf(partner) : null)
  }

  private mediaInputOf(scene: MountedScene): MediaSceneInput | null {
    const plan = this.presenter.plan
    const planScene = plan?.scenes.find((candidate) => candidate.sceneId === scene.sceneId)
    if (!plan || !planScene) return null
    const views = sceneLayerViews(this.document, scene.sceneId)
    const byId = new Map(views.map((view) => [view.layerId, view]))
    return {
      stage: scene.stage,
      startFrame: planScene.startFrame,
      durationFrames: planScene.durationFrames,
      canvas: scene.canvas,
      nativeLayers: planScene.nativeLayers,
      runtimeLayers: scene.layerIds().map((layerId) => ({ layerId, zIndex: byId.get(layerId)?.zIndex ?? runtimeOnlyZIndex(layerId), element: scene.groupElement(layerId) })),
      transformOf: (layerId) => byId.get(layerId)?.transform ?? null,
    }
  }

  // ---------------------------------------------------------------- selection and geometry

  private onSelectionChanged(): void {
    // A colour being picked belongs to the layer it was picked for; "Replace" belongs to the clip it was armed on.
    this.restoreColorPreview()
    this.restoreOpacityPreview()
    const replacing = this.state.replacing
    const keepReplace = replacing !== null && singleLayerId(this.selection.getSnapshot()) === replacing.layerId
    this.publish({ menu: null, ...(replacing && !keepReplace && { replacing: null }) })
  }

  private views(sceneId: string): StageLayerView[] {
    return sceneLayerViews(this.document, sceneId)
  }

  private mounted(): MountedScene | null {
    return this.presenter.current
  }

  private localFrame(): number {
    return this.currentSceneAt()?.localFrame ?? 0
  }

  /** The layer's current basis: the IR's natural box (runtime layers), the media box (video), or a pending preview. */
  private basisOf(view: StageLayerView): LayerBasis | null {
    const pending = this.lastBasis.get(view.layerId)
    if (pending) return pending
    if (isNativeVideoLayer(view)) return this.media.basisOf(view.layerId)
    const scene = this.mounted()
    const natural = scene?.naturalBox(view.layerId)
    return natural ? basisFromNatural(natural, view.transform) : null
  }

  /** Live FX: a canvas rect of the current scene as the blend on screen draws it (offset, scale about the canvas centre). */
  private throughBlend(rect: StageRect): StageRect {
    const look = this.presenter.currentBlendLook
    const canvas = this.canvasSize()
    if (!look || !canvas || (look.x === 0 && look.y === 0 && look.scale === 1)) return rect
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    return { x: cx + (rect.x - cx) * look.scale + look.x, y: cy + (rect.y - cy) * look.scale + look.y, width: rect.width * look.scale, height: rect.height * look.scale }
  }

  /** Live FX: the canvas point of the current scene under a point of the frame while a blend offsets or scales its picture. */
  private fromBlend(point: { x: number; y: number }): { x: number; y: number } {
    const look = this.presenter.currentBlendLook
    const canvas = this.canvasSize()
    if (!look || !canvas || (look.x === 0 && look.y === 0 && look.scale === 1) || look.scale === 0) return point
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    return { x: cx + (point.x - look.x - cx) / look.scale, y: cy + (point.y - look.y - cy) / look.scale }
  }

  private canvasSize() {
    const plan = this.presenter.plan
    return plan ? { width: plan.canvas.width, height: plan.canvas.height } : null
  }

  private frameRect(): { left: number; top: number; width: number } | null {
    if (!this.frame) return null
    const rect = this.frame.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width }
  }

  private isSelectable(view: StageLayerView): boolean {
    // E1-D: a Motion overlay is selectable too (its Properties are the Motion fields); the runtime draws it like text.
    return view.kind === 'text' || view.kind === 'shape' || view.kind === 'clip' || view.kind === 'motion_instance'
  }

  private overlayFor(layerId: string, sceneId: string): StageOverlay | null {
    const view = layerViewOf(this.document, sceneId, layerId)
    const scene = this.mounted()
    const plan = this.presenter.plan
    if (!view || !scene || !plan || scene.sceneId !== sceneId || !this.isSelectable(view)) return null
    const local = this.localFrame()
    const scale = this.state.scale
    let rect: StageRect | null = null
    const transient = this.transients.get(layerId)
    if (transient) rect = transient.visual
    else if (isNativeVideoLayer(view)) {
      const basis = this.basisOf(view)
      if (basis && this.media.isShowing(layerId)) rect = visualBox(basis)
    } else {
      const bounds = scene.contentBounds(layerId, local)
      if (bounds?.visible) rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    }
    if (!rect) return null
    if (!layerVisibleAt(view, local) && !transient) return null
    // Live FX: inside a blend the picture may be offset or scaled (a slide, a push, a zoom): the box follows it.
    if (!transient) rect = this.throughBlend(rect)
    const locked = view.locked === true
    const shapeBasis = isBoxedShape(view) && !locked ? this.basisOf(view) : null
    return {
      layerId,
      kind: view.kind,
      rect: canvasRectToFrame(rect, scale),
      // A locked layer (selected from a panel) shows its frame without handles: the stage does not move or resize it.
      resizable: !locked,
      isText: view.kind === 'text',
      isMedia: view.kind === 'clip',
      edgeHandles: shapeBasis !== null && !isAspectLocked(shapeBasis.width, shapeBasis.height, false),
      locked,
    }
  }

  /**
   * Spark styling round: what the stage hits with the pointer (and walks with Tab). A locked layer is never selected or
   * dragged on the stage: a click goes through it to the layer below; the layer panels select and edit it.
   */
  private isStageHittable(view: StageLayerView): boolean {
    return this.isSelectable(view) && view.locked !== true
  }

  /** Layer ids under a client point, topmost first: runtime layers (hit test) merged with `<video>` layers by paint order. */
  private layersAt(client: { x: number; y: number }): string[] {
    const scene = this.mounted()
    const rect = this.frameRect()
    const canvas = this.canvasSize()
    if (!scene || !rect || !canvas || rect.width === 0) return []
    const point = this.fromBlend(clientToCanvas(rect, canvas.width, client))
    const local = this.localFrame()
    const views = this.views(scene.sceneId)
    const byId = new Map(views.map((view) => [view.layerId, view]))
    // WP1: a runtime layer whose dropped position is not drawn yet (its preview is held) is hit where the user sees it.
    const heldVisual = (id: string): StageRect | null => {
      const view = byId.get(id)
      const transient = this.transients.get(id)
      return view && transient?.element.isConnected && !isNativeVideoLayer(view) ? transient.visual : null
    }
    const hits: Array<{ layerId: string; z: number }> = scene
      .hitTest(local, point)
      .filter((id) => byId.has(id) && this.isStageHittable(byId.get(id)!) && heldVisual(id) === null)
      .map((id) => ({ layerId: id, z: byId.get(id)!.zIndex }))
    for (const id of this.transients.keys()) {
      const visual = heldVisual(id)
      if (visual && this.isStageHittable(byId.get(id)!) && pointInRect(point, visual)) hits.push({ layerId: id, z: byId.get(id)!.zIndex })
    }
    for (const view of views) {
      if (!isNativeVideoLayer(view) || !this.media.isShowing(view.layerId) || view.locked === true) continue
      const basis = this.basisOf(view)
      if (basis && pointInRect(point, visualBox(basis))) hits.push({ layerId: view.layerId, z: view.zIndex })
    }
    return hits.sort((a, b) => b.z - a.z).map((hit) => hit.layerId)
  }

  // ---------------------------------------------------------------- pointer, gestures

  handlePointerDown(event: StagePointerEvent): void {
    if (event.button !== 0 || this.state.editing) return
    const scene = this.mounted()
    if (!scene) return
    const { playing } = this.options.playback.getSnapshot()
    const handle = (event.target as HTMLElement | null)?.getAttribute?.('data-h') as ShapeHandle | null | undefined
    if (playing) this.options.playback.pause()
    const sceneId = scene.sceneId
    let layerId: string | null = null
    if (handle) layerId = singleLayerId(this.selection.getSnapshot())
    else layerId = this.layersAt({ x: event.clientX, y: event.clientY })[0] ?? null
    this.publish({ menu: null })
    if (!layerId) {
      // A click on empty canvas deselects the layer and opens nothing.
      this.selection.selectScene(sceneId)
      return
    }
    const view = layerViewOf(this.document, sceneId, layerId)
    if (!view) return
    this.selection.selectLayer(sceneId, layerId)
    this.options.session.selectScene(sceneId)
    // A locked layer is never dragged or resized on the stage (it is hit only through its own handles, which it has none of).
    if (this.options.session.readOnly() || view.locked === true) return
    const basis = this.basisOf(view)
    if (!basis) return
    event.preventDefault()
    this.endNudge(true)
    const style = view.style
    // A shape is resized by its box (`shape.set_size`), every other layer by its scale; edge handles exist for shapes only.
    let target: Parameters<GestureController['begin']>[0] | null
    if (!handle) target = { kind: 'move', layerId, layerKind: view.kind, basis }
    else if (isBoxedShape(view)) target = { kind: 'shape_resize', layerId, basis, handle, shape: view.shape as 'rect' | 'ellipse', cornerRadiusPx: view.cornerRadiusPx ?? null }
    else if (isEdgeHandle(handle)) target = null
    else target = { kind: 'resize', layerId, layerKind: view.kind, basis, corner: handle, ...(view.kind === 'text' && style && { textSizePx: style.sizePx }) }
    if (!target) return
    this.startGesture(target, event, sceneId)
  }

  private startGesture(target: Parameters<GestureController['begin']>[0], event: PointerInput, sceneId: string): void {
    const canvas = this.canvasSize()
    if (!canvas) return
    this.gestureLayer = { layerId: target.layerId, sceneId, moved: false }
    // Read ONCE per gesture: a client rect read after the previous move's style writes would force a layout every move.
    const frameRect = this.frameRect() ?? { left: 0, top: 0, width: canvas.width }
    this.gesture = new GestureController({
      canvas,
      safeArea: this.presenter.plan?.safeArea ?? null,
      frame: () => frameRect,
      onPreview: (preview) => this.onGesturePreview(preview),
      onEnd: (outcome, info) => this.onGestureEnd(outcome, info.moved),
    })
    this.gesture.begin(target, event)
    const view = this.doc.defaultView
    if (!view) return
    const move = (e: PointerEvent) => this.gesture?.update(e)
    const up = () => this.gesture?.end()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.gesture?.cancel()
    }
    view.addEventListener('pointermove', move)
    view.addEventListener('pointerup', up)
    view.addEventListener('pointercancel', up)
    view.addEventListener('keydown', key)
    this.removeWindowListeners = () => {
      view.removeEventListener('pointermove', move)
      view.removeEventListener('pointerup', up)
      view.removeEventListener('pointercancel', up)
      view.removeEventListener('keydown', key)
    }
  }

  private get doc(): Document {
    return this.options.doc
  }

  private endGestureListeners(): void {
    this.removeWindowListeners?.()
    this.removeWindowListeners = null
  }

  private onGesturePreview(preview: GesturePreview): void {
    const scene = this.mounted()
    if (!scene || !this.gestureLayer) return
    this.gestureLayer.moved = true
    this.applyTransient(scene, preview)
    const scale = this.state.scale
    const rect = canvasRectToFrame(preview.visual, scale)
    const badge = { text: preview.badge, x: rect.x + rect.width / 2, y: rect.y + rect.height + 10 }
    const guides = { v: preview.guides.v === null ? null : preview.guides.v * scale, h: preview.guides.h === null ? null : preview.guides.h * scale }
    if (!this.state.dragging) {
      // The first move: ONE React render shows the drag state (badge, guides, safe area; the toolbar hides).
      const safe = this.presenter.plan?.safeArea
      this.publish({ dragging: true, badge, guides, safeArea: safe ? canvasRectToFrame(safe, scale) : null })
      this.emitLive({ overlay: this.state.overlay?.rect ?? null, badge, guides })
      return
    }
    // Every further move: the DOM only. The snapshot carries the same values for synchronous readers; React is not told.
    const current = this.state.overlay
    const overlay = current && current.layerId === preview.layerId ? { ...current, rect } : current
    this.state = { ...this.state, badge, guides, overlay }
    this.emitLive({ overlay: overlay?.rect ?? null, badge, guides })
  }

  /** Mutates only the mounted element (no React render, no runtime seek): the gesture's transient picture. */
  private applyTransient(scene: MountedScene, preview: GesturePreview): void {
    const view = layerViewOf(this.document, scene.sceneId, preview.layerId)
    const native = view ? isNativeVideoLayer(view) : false
    const element = native ? this.nativeWrapper(preview.layerId) : scene.groupElement(preview.layerId)
    if (!element) return
    let transient = this.transients.get(preview.layerId)
    if (!transient || transient.element !== element) {
      transient = {
        layerId: preview.layerId,
        element,
        saved: { left: element.style.left, top: element.style.top, transform: element.style.transform, width: element.style.width, height: element.style.height },
        base: preview.basis,
        visual: preview.visual,
        preview,
      }
      this.transients.set(preview.layerId, transient)
    }
    transient.visual = preview.visual
    transient.preview = preview
    if (preview.shape) this.previewShapeBox(transient, element, preview.shape)
    // Text corner drags preview a scale (the wrap changes once the server lays the new size out).
    const natural = scene.naturalBox(preview.layerId)
    const width = native ? (this.media.basisOf(preview.layerId)?.width ?? preview.visual.width) : (natural?.width ?? preview.visual.width)
    const scale = width > 0 ? preview.visual.width / width : preview.basis.scale
    element.style.left = `${preview.visual.x}px`
    element.style.top = `${preview.visual.y}px`
    element.style.transform = `scale(${preview.textSizePx !== undefined ? scale : preview.basis.scale})`
  }

  /**
   * E1-B: the transient picture of a shape resize changes the BOX (not a scale): the group and its content node take the new
   * size, the radius follows (an ellipse stays `50%`). The runtime is not asked to redraw; the originals are saved so a
   * refused or superseded command restores the picture exactly.
   */
  private previewShapeBox(transient: Transient, group: HTMLElement, shape: NonNullable<GesturePreview['shape']>): void {
    const content = group.firstElementChild as HTMLElement | null
    if (content && !transient.content) {
      transient.content = {
        element: content,
        saved: { width: content.style.width, height: content.style.height, transformOrigin: content.style.transformOrigin, borderRadius: content.style.borderRadius },
      }
    }
    group.style.width = `${shape.width}px`
    group.style.height = `${shape.height}px`
    if (!content) return
    content.style.width = `${shape.width}px`
    content.style.height = `${shape.height}px`
    content.style.transformOrigin = `${shape.width / 2}px ${shape.height / 2}px`
    content.style.borderRadius = shape.ellipse ? '50%' : `${Math.min(shape.cornerRadius ?? 0, Math.min(shape.width, shape.height) / 2)}px`
  }

  private nativeWrapper(layerId: string): HTMLElement | null {
    const wrappers = this.frame?.querySelectorAll<HTMLElement>('[data-native-layer]') ?? []
    return [...wrappers].find((element) => element.getAttribute('data-native-layer') === layerId) ?? null
  }

  private restoreTransient(layerId: string): void {
    const transient = this.transients.get(layerId)
    if (!transient) return
    this.transients.delete(layerId)
    // An element the runtime already replaced (a scene mounted anew) shows the new picture: nothing to put back on it.
    if (!transient.element.isConnected) return
    const { element, saved } = transient
    element.style.left = saved.left
    element.style.top = saved.top
    element.style.transform = saved.transform
    if (transient.content) {
      element.style.width = saved.width
      element.style.height = saved.height
      const { element: content, saved: contentSaved } = transient.content
      content.style.width = contentSaved.width
      content.style.height = contentSaved.height
      content.style.transformOrigin = contentSaved.transformOrigin
      content.style.borderRadius = contentSaved.borderRadius
    }
  }

  /**
   * A gesture that ended without a command (a click, Escape): its picture goes; a layer whose earlier command is still held
   * (WP1) comes back to that command's picture, not to the position before it.
   */
  private cancelTransient(layerId: string): void {
    this.restoreTransient(layerId)
    const pending = this.pendingLayers.get(layerId)
    const scene = this.mounted()
    if (pending?.preview && scene) this.applyTransient(scene, pending.preview)
  }

  private onGestureEnd(outcome: GestureOutcome | null, moved: boolean): void {
    this.endGestureListeners()
    const info = this.gestureLayer
    this.gesture = null
    this.gestureLayer = null
    this.publish({ dragging: false, badge: null, guides: null, safeArea: null }, { force: true })
    this.emitLive({ overlay: this.state.overlay?.rect ?? null, badge: null, guides: null })
    if (!info) return
    if (!outcome) {
      if (moved) this.cancelTransient(info.layerId)
      this.publish()
      return
    }
    const specs =
      outcome.kind === 'transform'
        ? transformCommit(info.sceneId, info.layerId, outcome.basis)
        : outcome.kind === 'shape_size'
          ? shapeResizeCommit(info.sceneId, info.layerId, {
              basis: outcome.basis,
              size: outcome.size,
              pinPosition: true,
              ...(outcome.cornerRadiusPx !== undefined && { cornerRadiusPx: outcome.cornerRadiusPx }),
            })
          : textSizeCommit(info.sceneId, info.layerId, outcome.sizePx)
    if (outcome.kind === 'transform' || outcome.kind === 'shape_size') this.lastBasis.set(info.layerId, outcome.basis)
    // One key per property group: a resize (it carries `shape.set_size`) is never replaced by a transform-only command.
    const group = outcome.kind === 'text_size' ? 'style' : outcome.kind === 'shape_size' ? 'size' : 'transform'
    void this.write(specs, { layerId: info.layerId, sceneId: info.sceneId, coalesceKey: `layer:${info.layerId}:${group}`, keepPreview: true })
  }

  // ---------------------------------------------------------------- writing

  /**
   * Sends one command. With `keepPreview`, the layer's transient picture stays until a drawn picture contains the edit (WP1,
   * `includes`); a refused or superseded-by-failure command restores the picture. A newer gesture on the same layer owns the
   * preview, so an older command's failure never undoes it.
   */
  private async write(
    specs: CompositionOpSpec[],
    options: {
      layerId?: string
      sceneId?: string
      coalesceKey?: string
      keepPreview?: boolean
      onApplied?: (version: number) => void
      onOptimistic?: () => void
      /** Timeline v3: the undo step the command opens (`SparkApplyOptions.undoGroup`). */
      undoGroup?: SparkUndoGroup
      /** Timeline v3: the undo step the command joins (`SparkApplyOptions.joinUndoGroup`). */
      joinUndoGroup?: SparkUndoGroup
    },
  ): Promise<boolean> {
    if (specs.length === 0) return false
    const { layerId } = options
    const seq = layerId ? (this.layerSeq.get(layerId) ?? 0) + 1 : 0
    if (layerId) this.layerSeq.set(layerId, seq)
    this.pendingWrites += 1
    this.publish({ pending: true })
    // WP1: held from the moment the command is written (an optimistic copy can be drawn before `apply` even returns).
    const sceneId = options.sceneId ?? (layerId ? this.sceneOfLayer(layerId) : null)
    const pending: PendingLayer | null =
      layerId && options.keepPreview && sceneId
        ? { seq, sceneId, localRevision: null, fromSeq: null, minVersion: null, preview: this.transients.get(layerId)?.preview ?? null }
        : null
    if (pending && layerId) this.pendingLayers.set(layerId, pending)
    let appliedVersion: number | null = null
    let applied = false
    let optimistic = false
    try {
      const writing = this.options.session.apply(specs, {
        ...(options.coalesceKey && { coalesceKey: options.coalesceKey }),
        ...(options.undoGroup && { undoGroup: options.undoGroup }),
        ...(options.joinUndoGroup && { joinUndoGroup: options.joinUndoGroup }),
        // E1-N: runs inside `apply()` when the edit is already in the copy the stage draws (the picture follows at once).
        onOptimistic: (info) => {
          optimistic = true
          if (pending && info) {
            pending.localRevision = info.localRevision
            this.noteCarried(pending)
          }
        },
        onApplied: (receipt) => {
          appliedVersion = receipt.working_copy_version
        },
      })
      if (optimistic) options.onOptimistic?.()
      applied = await writing
    } catch {
      applied = false
    }
    this.pendingWrites -= 1
    if (layerId && this.layerSeq.get(layerId) === seq) {
      if (!applied) {
        this.restoreTransient(layerId)
        this.lastBasis.delete(layerId)
        this.pendingLayers.delete(layerId)
      } else if (pending && this.pendingLayers.get(layerId) === pending) {
        pending.minVersion = appliedVersion ?? this.version + 1
        if (!optimistic) void this.options.session.refresh()
        // Safety: a command the drawn copy never reflects must not leave a stale preview on the canvas.
        this.timers().setTimeout(() => {
          if (this.pendingLayers.get(layerId) !== pending) return
          this.settle(layerId)
          this.publish()
        }, PREVIEW_RELEASE_MS)
        // The drawn version may already be there (the preview was redrawn before this resolved). Y1R-EDITOR-4: the DRAWN
        // version, not the held document's; the basis is kept until the new scene is mounted.
        if (this.drawnVersion >= pending.minVersion) this.releasePending(this.drawnVersion)
        // WP1: or the picture on the stage already contains it (a picture of the editor's own copy, the server's copy).
        this.settleIncluded(this.mounted())
      }
    }
    if (applied && appliedVersion !== null) options.onApplied?.(appliedVersion)
    this.publish({ pending: this.pendingWrites > 0 })
    return applied
  }

  /** The scene of a layer in the held document (null when it is not there). */
  private sceneOfLayer(layerId: string): string | null {
    return this.document?.scenes.find((scene) => scene.layers.some((layer) => layer.layer_id === layerId))?.scene_id ?? null
  }

  /** Drops the previews whose commands the drawn server copy (version `drawn`) already includes. */
  private releasePending(drawn: number): void {
    for (const [layerId, pending] of [...this.pendingLayers]) {
      if (pending.minVersion === null || pending.minVersion > drawn) continue
      this.settle(layerId)
    }
    if (this.pendingSelect && this.pendingSelect.minVersion <= drawn) {
      const { sceneId, layerId } = this.pendingSelect
      this.pendingSelect = null
      if (layerViewOf(this.document, sceneId, layerId)) this.selection.selectLayer(sceneId, layerId)
    }
    this.publish()
  }

  // ---------------------------------------------------------------- toolbox / keyboard actions

  private selectedView(): { view: StageLayerView; sceneId: string } | null {
    const selection = this.selection.getSnapshot()
    const layerId = singleLayerId(selection)
    if (!selection || !layerId) return null
    const view = layerViewOf(this.document, selection.sceneId, layerId)
    return view ? { view, sceneId: selection.sceneId } : null
  }

  canWrite(): boolean {
    return !this.options.session.readOnly()
  }

  deleteSelected(): Promise<boolean> {
    const target = this.selectedView()
    if (!target) return Promise.resolve(false)
    this.publish({ menu: null })
    return this.write(layerDeleteCommit(target.sceneId, target.view.layerId), {})
  }

  arrangeSelected(action: ArrangeAction): Promise<boolean> {
    const target = this.selectedView()
    if (!target) return Promise.resolve(false)
    const order = this.views(target.sceneId).map((view) => view.layerId)
    this.publish({ menu: null })
    return this.write(arrangeCommit(target.sceneId, target.view.layerId, order, action), {})
  }

  centreSelected(axes: 'h' | 'v' | 'hv' = 'hv'): Promise<boolean> {
    const target = this.selectedView()
    const canvas = this.canvasSize()
    if (!target || !canvas) return Promise.resolve(false)
    const basis = this.basisOf(target.view)
    if (!basis) return Promise.resolve(false)
    this.publish({ menu: null })
    return this.writeBasis(target.sceneId, target.view.layerId, centreBasis(basis, canvas, axes))
  }

  /** "Reset position & size": clears the transform (the natural box, centred). */
  resetSelected(): Promise<boolean> {
    const target = this.selectedView()
    const layerId = target?.view.layerId
    // A transform just sent is not in the held document yet: it can be reset too (Y1R-EDITOR-4).
    if (!target || !layerId || (!target.view.transform && !this.lastBasis.has(layerId))) return Promise.resolve(false)
    this.publish({ menu: null })
    // The compiler centres the natural box of a layer without transform; a field edit before the redraw starts from there.
    const basis = this.basisOf(target.view)
    const canvas = this.canvasSize()
    if (basis && canvas) {
      const natural: LayerBasis = { x: basis.x, y: basis.y, width: basis.width, height: basis.height, scale: 1, rotationDeg: 0 }
      this.lastBasis.set(layerId, centreBasis(natural, canvas))
    } else {
      this.lastBasis.delete(layerId)
    }
    return this.write(transformClear(target.sceneId, layerId), { layerId, sceneId: target.sceneId, coalesceKey: `layer:${layerId}:transform`, keepPreview: true })
  }

  /** Properties numeric fields: position, scale, rotation (V3: rotation only here). */
  setTransformField(patch: { x?: number; y?: number; scale?: number; rotationDeg?: number }): Promise<boolean> {
    const target = this.selectedView()
    if (!target) return Promise.resolve(false)
    const basis = this.basisOf(target.view)
    if (!basis) return Promise.resolve(false)
    // X then Y before the redraw: the second write builds on the first one's box, not on the drawn one (T1R-11, Y1R-EDITOR-4).
    return this.writeBasis(target.sceneId, target.view.layerId, patchedBasis(basis, patch))
  }

  /**
   * Y1R-EDITOR-4 / T1R-11: `layer.set_transform` replaces the whole transform, so the committed basis is remembered (like a
   * gesture's) until the drawn working copy has it: the next quick field edit, centre or nudge builds on it. One coalesce key
   * per property group (`:transform`), the preview stays until drawn.
   */
  private writeBasis(sceneId: string, layerId: string, basis: LayerBasis): Promise<boolean> {
    this.lastBasis.set(layerId, basis)
    // WP1: a layer whose dropped position is held moves on from there (its held picture follows the field), never back to
    // the position before the drop.
    const scene = this.mounted()
    if (scene?.sceneId === sceneId && this.transients.has(layerId)) this.applyTransient(scene, { layerId, basis, visual: visualBox(basis), badge: '', guides: { v: null, h: null } })
    return this.write(transformCommit(sceneId, layerId, basis), { layerId, sceneId, coalesceKey: `layer:${layerId}:transform`, keepPreview: true })
  }

  setTextStyle(patch: TextStylePatch): Promise<boolean> {
    const target = this.selectedView()
    if (!target || target.view.kind !== 'text') return Promise.resolve(false)
    const layerId = target.view.layerId
    // Y1R-EDITOR-3: `text.set_style` is partial. The key names the fields, so a queued patch is only replaced by one that
    // sets the same fields; and the patch is remembered until drawn, so bold/italic/align build on what was sent.
    const token = {}
    this.pendingStyles.set(layerId, { patch: { ...this.pendingStyles.get(layerId)?.patch, ...patch }, token, minVersion: Number.POSITIVE_INFINITY })
    // A colour picked with a preview: the drawn element keeps it until the redraw (or gets the old one back on a refusal).
    const preview = patch.color !== undefined ? this.takeColorPreview() : null
    return this.write(styleCommit(target.sceneId, layerId, patch), {
      coalesceKey: `layer:${layerId}:style:${fieldsKey(patch)}`,
      onApplied: (version) => {
        const pending = this.pendingStyles.get(layerId)
        if (pending?.token !== token) return
        if (this.version >= version) this.pendingStyles.delete(layerId)
        else pending.minVersion = version
      },
    }).then((applied) => {
      if (!applied && this.pendingStyles.get(layerId)?.token === token) this.pendingStyles.delete(layerId)
      if (!applied) restoreColor(preview)
      return applied
    })
  }

  /** The text layer's style with the fields already sent but not yet drawn (Y1R-EDITOR-3); the view itself when none. */
  withPendingStyle(view: StageLayerView): StageLayerView {
    const pending = this.pendingStyles.get(view.layerId)?.patch
    if (!pending || !view.style) return view
    const { align: storedAlign, lineHeight: storedLineHeight, decoration: storedDecoration, stroke: storedStroke, ...rest } = view.style
    const align = pending.align === undefined ? storedAlign : (pending.align ?? undefined)
    // Spark styling round: `null` (or a decoration without a line) clears a field, like the op does.
    const lineHeight = pending.lineHeight === undefined ? storedLineHeight : (pending.lineHeight ?? undefined)
    const decoration =
      pending.decoration === undefined ? storedDecoration : pending.decoration && (pending.decoration.underline || pending.decoration.strikethrough) ? pending.decoration : undefined
    const stroke = pending.stroke === undefined ? storedStroke : pending.stroke ? { color: pending.stroke.color, widthPx: pending.stroke.width_px } : undefined
    return {
      ...view,
      style: {
        ...rest,
        ...(pending.font && { font: pending.font }),
        ...(pending.sizePx !== undefined && { sizePx: pending.sizePx }),
        ...(pending.color !== undefined && { color: pending.color }),
        ...(align !== undefined && { align }),
        ...(lineHeight !== undefined && { lineHeight }),
        ...(decoration && { decoration }),
        ...(stroke && { stroke }),
      },
    }
  }

  /**
   * Spark styling round: the underline / strikethrough toggle of the toolbar and its shortcut (Ctrl/Cmd+U, Ctrl/Cmd+Shift+X).
   * The full decoration is sent (the other line keeps its state, read with the fields already sent): ONE command per press.
   */
  toggleTextDecoration(line: 'underline' | 'strikethrough'): Promise<boolean> {
    const target = this.selectedView()
    if (!target || target.view.kind !== 'text') return Promise.resolve(false)
    const current = this.withPendingStyle(target.view).style?.decoration
    return this.setTextStyle({ decoration: toggledDecoration(current, line) })
  }

  /**
   * Spark styling round: the opacity of the selected text, shape or image (0-1; 1 removes the field). One command; a burst of
   * slider changes is coalesced into one by the write queue's key. A video clip or a Motion layer has no opacity.
   */
  setLayerOpacity(opacity: number): Promise<boolean> {
    const target = this.selectedView()
    if (!target) return Promise.resolve(false)
    const { view } = target
    const allowed = view.kind === 'text' || view.kind === 'shape' || (view.kind === 'clip' && view.mediaKind === 'image')
    const next = Math.min(1, Math.max(0, opacity))
    if (!allowed || !Number.isFinite(next) || next === (view.opacity ?? 1)) {
      this.previewOpacity(null)
      return Promise.resolve(false)
    }
    // The slid value stays drawn until the redraw of the command replaces it (or comes back on a refusal).
    const preview = this.takeOpacityPreview()
    return this.write(opacityCommit(target.sceneId, view.layerId, next), { coalesceKey: `layer:${view.layerId}:opacity` }).then((applied) => {
      if (!applied && preview) preview.element.style.opacity = preview.saved
      return applied
    })
  }

  /** Spark styling round: locks or unlocks the selected layer (UI-only; the selection stays). One command. */
  setLayerLocked(locked: boolean): Promise<boolean> {
    const target = this.selectedView()
    if (!target || !this.isSelectable(target.view) || (target.view.locked === true) === locked) return Promise.resolve(false)
    this.endNudge(true)
    return this.write(lockCommit(target.sceneId, target.view.layerId, locked), { coalesceKey: `layer:${target.view.layerId}:locked` })
  }

  /**
   * Spark styling round: shows an opacity on the selected layer's drawn group while the slider moves (no command); `null`
   * puts the drawn value back. The committed command's redraw replaces it.
   */
  previewOpacity(opacity: number | null): void {
    if (opacity === null) {
      this.restoreOpacityPreview()
      return
    }
    const target = this.selectedView()
    const scene = this.mounted()
    if (!target || !scene || scene.sceneId !== target.sceneId) return
    const group = scene.groupElement(target.view.layerId)
    if (!group) return
    if (this.opacityPreview?.element !== group) {
      this.restoreOpacityPreview()
      this.opacityPreview = { element: group, saved: group.style.opacity }
    }
    group.style.opacity = String(Math.min(1, Math.max(0, opacity)))
  }

  private takeOpacityPreview(): { element: HTMLElement; saved: string } | null {
    const preview = this.opacityPreview
    this.opacityPreview = null
    return preview
  }

  private restoreOpacityPreview(): void {
    const preview = this.takeOpacityPreview()
    if (preview) preview.element.style.opacity = preview.saved
  }

  setShapeFill(fill: string): Promise<boolean> {
    const target = this.selectedView()
    if (!target || target.view.kind !== 'shape') return Promise.resolve(false)
    const preview = this.takeColorPreview()
    return this.write(fillCommit(target.sceneId, target.view.layerId, fill), { coalesceKey: `layer:${target.view.layerId}:fill` }).then((applied) => {
      if (!applied) restoreColor(preview)
      return applied
    })
  }

  /**
   * Properties "Width" / "Height" (E1-B, D4): the new box of the selected rect or ellipse in canvas pixels. The top-left
   * stays where it is (a layer without a transform is pinned in the same command, the compiler would re-centre it), and a
   * pill stays a pill (its radius follows the shorter side). One command = one undo group.
   */
  setShapeSize(patch: { widthPx?: number; heightPx?: number }): Promise<boolean> {
    const target = this.selectedView()
    if (!target || !isBoxedShape(target.view) || (patch.widthPx === undefined && patch.heightPx === undefined)) return Promise.resolve(false)
    const basis = this.basisOf(target.view)
    if (!basis) return Promise.resolve(false)
    const clamp = (value: number) => Math.min(MAX_SHAPE_PX, Math.max(MIN_SHAPE_PX, Math.round(value)))
    const size = { width_px: clamp(patch.widthPx ?? basis.width), height_px: clamp(patch.heightPx ?? basis.height) }
    if (size.width_px === Math.round(basis.width) && size.height_px === Math.round(basis.height)) return Promise.resolve(false)
    const pill = target.view.shape === 'rect' && isPillRadius(target.view.cornerRadiusPx, basis.width, basis.height)
    const next = { ...basis, width: size.width_px, height: size.height_px }
    const specs = shapeResizeCommit(target.sceneId, target.view.layerId, {
      basis: next,
      size,
      pinPosition: target.view.transform === null,
      ...(pill && { cornerRadiusPx: pillRadius(size.width_px, size.height_px) }),
    })
    // Width then Height before the redraw: the second write builds on the first one's box, not on the drawn one (T1R-11).
    this.lastBasis.set(target.view.layerId, next)
    return this.write(specs, { layerId: target.view.layerId, sceneId: target.sceneId, coalesceKey: `layer:${target.view.layerId}:size`, keepPreview: true })
  }

  /** Properties "Corner radius" (E1-B, D4): a rect's radius in canvas pixels; `null` clears it (square corners). */
  setShapeCornerRadius(radiusPx: number | null): Promise<boolean> {
    const target = this.selectedView()
    if (!target || target.view.kind !== 'shape' || target.view.shape !== 'rect') return Promise.resolve(false)
    const radius = radiusPx === null ? null : Math.min(MAX_SHAPE_PX, Math.max(0, Math.round(radiusPx)))
    if ((radius ?? 0) === Math.round(target.view.cornerRadiusPx ?? 0)) return Promise.resolve(false)
    return this.write(cornerRadiusCommit(target.sceneId, target.view.layerId, radius === 0 ? null : radius), { coalesceKey: `layer:${target.view.layerId}:radius` })
  }

  askAi(): void {
    this.publish({ menu: null })
    this.options.onAskAi?.({ selection: this.selection.getSnapshot(), playheadFrame: this.options.playback.frame })
  }

  openMenu(event: { clientX: number; clientY: number; target: EventTarget | null; preventDefault(): void }): void {
    const layerId = this.layersAt({ x: event.clientX, y: event.clientY })[0] ?? null
    const scene = this.mounted()
    if (!layerId || !scene) return
    event.preventDefault()
    this.selection.selectLayer(scene.sceneId, layerId)
    this.publish({ menu: { x: event.clientX, y: event.clientY, layerId } })
  }

  /** The toolbox's "More" button and the keyboard (ContextMenu, Shift+F10): the menu of the SELECTED layer at a client point. */
  openSelectionMenu(position: { x: number; y: number }): void {
    const layerId = singleLayerId(this.selection.getSnapshot())
    if (!layerId || !this.mounted()) return
    this.publish({ menu: { x: position.x, y: position.y, layerId } })
  }

  closeMenu(): void {
    if (this.state.menu) this.publish({ menu: null })
  }

  /** Keyboard on the focused canvas (D9). Returns true when the key was handled. */
  handleKeyDown(event: StageKeyEvent): boolean {
    const target = event.target as HTMLElement | null
    if (target && (target.isContentEditable || target.closest?.('input, textarea, select'))) return false
    if (this.state.editing) return false
    const mod = event.ctrlKey || event.metaKey
    const selected = this.selectedView()
    const playback = this.options.playback
    const fps = playback.getSnapshot().fps
    const second = Math.round(fps.num / fps.den)
    const handled = () => {
      event.preventDefault()
      return true
    }
    if (mod && event.key.toLowerCase() === 'k') {
      this.askAi()
      return handled()
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      const rect = this.frameRect()
      const overlay = this.state.overlay
      if (!rect || !overlay) return false
      this.openSelectionMenu({ x: rect.left + overlay.rect.x, y: rect.top + overlay.rect.y + overlay.rect.height + 4 })
      return handled()
    }
    if (this.options.contextToolbar === true && !event.altKey) {
      // The contextual toolbar's shortcuts (`SPARK_CONTEXT_TOOLBAR_ENABLED`): duplicate, copy, paste and the shortcut sheet.
      const key = event.key.toLowerCase()
      if (mod && !event.shiftKey && key === 'd') {
        if (!selected || !this.canWrite()) return false
        void this.duplicateSelected()
        return handled()
      }
      if (mod && !event.shiftKey && key === 'c') {
        if (!selected) return false
        this.copySelected()
        return handled()
      }
      if (mod && !event.shiftKey && key === 'v') {
        if (!this.canWrite() || !this.clipboard) return false
        void this.pasteClipboard()
        return handled()
      }
      // Spark styling round: underline (Ctrl/Cmd+U) and strikethrough (Ctrl/Cmd+Shift+X) of the selected text.
      if (mod && ((!event.shiftKey && key === 'u') || (event.shiftKey && key === 'x'))) {
        if (selected?.view.kind !== 'text' || !this.canWrite() || !controlSet(this.options.schema?.() ?? null, selected.view).decoration) return false
        void this.toggleTextDecoration(key === 'u' ? 'underline' : 'strikethrough')
        return handled()
      }
      if (mod && ((event.shiftKey && key === 'z') || (!event.shiftKey && key === 'y'))) {
        // With redo on the editor's history keys redo (the window listener); without it the press says redo is not there yet.
        if (this.options.historyKeys === true) return false
        this.showNotice('redoSoon')
        return handled()
      }
      if (!mod && event.key === '?') {
        this.toggleShortcuts()
        return handled()
      }
      if (!mod && event.key === 'Escape' && this.state.shortcuts) {
        this.toggleShortcuts(false)
        return handled()
      }
      if (!mod && event.key === 'Escape' && this.state.replacing) {
        this.cancelReplace()
        return handled()
      }
    }
    if (mod || event.altKey) return false
    switch (event.key) {
      case ' ':
        playback.toggle()
        return handled()
      case 'Home':
        playback.seek(0)
        return handled()
      case 'End':
        playback.seek(playback.getSnapshot().totalFrames - 1)
        return handled()
      case ',':
        playback.step(event.shiftKey ? -second : -1)
        return handled()
      case '.':
        playback.step(event.shiftKey ? second : 1)
        return handled()
      case 'Escape':
        if (this.state.menu) this.closeMenu()
        else if (selected) this.selection.selectScene(selected.sceneId)
        return handled()
      case 'Enter':
        if (selected?.view.kind === 'text') {
          this.startTextEdit()
          return handled()
        }
        return false
      case 'Delete':
      case 'Backspace':
        if (!selected || !this.canWrite()) return false
        void this.deleteSelected()
        return handled()
      case '[':
      case ']':
        if (!selected || !this.canWrite()) return false
        void this.arrangeSelected(event.key === ']' ? (event.shiftKey ? 'front' : 'forward') : event.shiftKey ? 'back' : 'backward')
        return handled()
      case 'Tab':
        return this.cycleLayer(event.shiftKey ? -1 : 1) ? handled() : false
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        // A locked layer does not move on the stage; the arrows step the playhead as with nothing selected.
        if (selected && this.canWrite() && selected.view.locked !== true) {
          const step = event.shiftKey ? 10 : 1
          this.nudgeSelected(event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)
          return handled()
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          playback.step((event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? second : 1))
          return handled()
        }
        return false
      }
      default:
        return false
    }
  }

  // ---------------------------------------------------------------- duplicate, copy, paste (contextual toolbar)

  /** Resolved length of a scene on the plan (null while the plan has no length for it). */
  private sceneFramesOf(sceneId: string): number | null {
    return this.presenter.plan?.scenes.find((scene) => scene.sceneId === sceneId)?.durationFrames ?? null
  }

  private copyOf(target: { view: StageLayerView; sceneId: string }): LayerCopy | null {
    const document = this.options.session.document() ?? this.document
    if (!document) return null
    return copyOfLayer({
      document,
      sceneId: target.sceneId,
      layerId: target.view.layerId,
      sceneFrames: this.sceneFramesOf(target.sceneId) ?? 0,
      basis: this.basisOf(target.view),
    })
  }

  /** Ctrl/Cmd+C: keeps the selected layer for a paste in this page (never the system clipboard, never browser storage). */
  copySelected(): boolean {
    const target = this.selectedView()
    if (!target) return false
    const copy = this.copyOf(target)
    if (!copy) {
      this.showNotice('copyUnsupported')
      return false
    }
    this.clipboard = { copy, pastes: 0 }
    this.showNotice('copied')
    return true
  }

  /** Whether a copied layer waits for a paste. */
  get canPaste(): boolean {
    return this.clipboard !== null
  }

  /** `SPARK_CONTEXT_TOOLBAR_ENABLED` as the stage was created with it (the menus offer duplicate / copy / paste). */
  get contextToolbar(): boolean {
    return this.options.contextToolbar === true
  }

  /** `SPARK_REDO_ENABLED`: redo is available (the "?" sheet lists it without "soon"). */
  get historyKeys(): boolean {
    return this.options.historyKeys === true
  }

  /** Ctrl/Cmd+D / toolbar "Duplicate": the selected layer again, right above it and moved a little; ONE command. */
  duplicateSelected(): Promise<boolean> {
    const target = this.selectedView()
    if (!target || !this.canWrite()) return Promise.resolve(false)
    const copy = this.copyOf(target)
    const frames = this.sceneFramesOf(target.sceneId)
    if (!copy || frames === null) {
      this.showNotice('copyUnsupported')
      return Promise.resolve(false)
    }
    return this.insertCopy(copy, { sceneId: target.sceneId, sceneFrames: frames, afterLayerId: target.view.layerId }, DUPLICATE_OFFSET_PX)
  }

  /** Ctrl/Cmd+V: the copied layer on top of the scene under the playhead (moved a little when it is its own scene). */
  pasteClipboard(): Promise<boolean> {
    const clipboard = this.clipboard
    if (!clipboard) {
      this.showNotice('clipboardEmpty')
      return Promise.resolve(false)
    }
    const at = this.currentSceneAt()
    const document = this.options.session.document() ?? this.document
    const scene = at ? document?.scenes.find((candidate) => candidate.scene_id === at.scene.sceneId) : null
    if (!at || !scene || !this.canWrite()) return Promise.resolve(false)
    const own = clipboard.copy.sceneId === scene.scene_id
    if (own) clipboard.pastes += 1
    const offset = own ? DUPLICATE_OFFSET_PX * clipboard.pastes : 0
    return this.insertCopy(clipboard.copy, { sceneId: scene.scene_id, sceneFrames: at.scene.durationFrames, afterLayerId: scene.layers.at(-1)?.layer_id ?? null }, offset)
  }

  private insertCopy(copy: LayerCopy, target: { sceneId: string; sceneFrames: number; afterLayerId: string | null }, offset: number): Promise<boolean> {
    const document = this.options.session.document() ?? this.document
    if (!document) return Promise.resolve(false)
    const layerId = newLayerId((this.options.uuid ?? (() => globalThis.crypto.randomUUID()))())
    const result = pasteSpecs({ copy, layerId, target, offset, document })
    if ('refused' in result) {
      this.showNotice(PASTE_NOTICES[result.refused])
      return Promise.resolve(false)
    }
    this.publish({ menu: null })
    let selectedAtOnce = false
    return this.write(result.specs, {
      onOptimistic: () => {
        selectedAtOnce = true
        this.selection.selectLayer(target.sceneId, layerId)
      },
      onApplied: (version) => {
        if (!selectedAtOnce) this.pendingSelect = { layerId, sceneId: target.sceneId, minVersion: version }
      },
    })
  }

  // ---------------------------------------------------------------- media fit (contextual toolbar)

  /** The natural (contain) box of a clip as drawn: the IR's box of an image, the contain box of a playing video. */
  private naturalSizeOf(view: StageLayerView): Size | null {
    if (isNativeVideoLayer(view)) {
      const basis = this.media.basisOf(view.layerId)
      return basis ? { width: basis.width, height: basis.height } : null
    }
    const natural = this.mounted()?.naturalBox(view.layerId)
    return natural ? { width: natural.width, height: natural.height } : null
  }

  /** How the selected image or video fills the canvas: contain (fitted), cover (filled), custom; null for another layer. */
  selectedMediaFit(): MediaFit | null {
    const target = this.selectedView()
    const canvas = this.canvasSize()
    if (!target || target.view.kind !== 'clip' || !canvas) return null
    const basis = this.lastBasis.get(target.view.layerId)
    const transform = basis ? { x: basis.x, y: basis.y, scale: basis.scale, rotation_deg: basis.rotationDeg } : target.view.transform
    return mediaFitOf(transform, canvas, this.naturalSizeOf(target.view))
  }

  /**
   * Toolbar "Fill" / "Fit" of the selected image or video: cover = the transform that fills the canvas (scale + offset, no
   * crop: `cover-transform.ts`), contain = no transform (the compiler's fit, centred). One `layer.set_transform` command.
   */
  fitSelected(fit: 'cover' | 'contain'): Promise<boolean> {
    const target = this.selectedView()
    const canvas = this.canvasSize()
    if (!target || target.view.kind !== 'clip' || !canvas || !this.canWrite()) return Promise.resolve(false)
    if (fit === 'contain') return this.resetSelected()
    const natural = this.naturalSizeOf(target.view)
    if (!natural) return Promise.resolve(false)
    const cover = coverTransform(canvas, natural)
    this.publish({ menu: null })
    return this.writeBasis(target.sceneId, target.view.layerId, { x: cover.x, y: cover.y, width: natural.width, height: natural.height, scale: cover.scale, rotationDeg: 0 })
  }

  /** Toolbar "Replace" on an image or video: the next pick in the Media tool replaces its source (Escape / another selection cancels). */
  armReplace(): boolean {
    const target = this.selectedView()
    if (!target || target.view.kind !== 'clip' || !this.canWrite()) return false
    this.publish({ replacing: { sceneId: target.sceneId, layerId: target.view.layerId }, menu: null })
    return true
  }

  cancelReplace(): void {
    if (this.state.replacing) this.publish({ replacing: null })
  }

  /**
   * The Media tool's pick while "Replace" is armed: `clip.replace_source` of the armed clip (it keeps its place, timing,
   * transform, sound setting and animations). Null when nothing is armed (the pick is a normal insert). An image replaces
   * an image, a video a video at least as long as the clip (it plays the same length).
   */
  async replaceArmed(sourceId: string, kind: 'image' | 'video'): Promise<'replaced' | 'refused' | null> {
    const armed = this.state.replacing
    if (!armed) return null
    this.publish({ replacing: null })
    const document = this.options.session.document() ?? this.document
    const view = layerViewOf(document, armed.sceneId, armed.layerId)
    const layer = document?.scenes.find((scene) => scene.scene_id === armed.sceneId)?.layers.find((candidate) => candidate.layer_id === armed.layerId) as
      | { placement?: { source_id?: string; source_range?: { in_tick: number; out_tick: number } } }
      | undefined
    const next = document ? sourceProbeOf(document, sourceId) : null
    const previous = document && view?.sourceId ? sourceProbeOf(document, view.sourceId) : null
    if (!document || !view || view.kind !== 'clip' || !next || !previous || !layer?.placement?.source_range) {
      this.showNotice('replaceFailed')
      return 'refused'
    }
    if (view.mediaKind !== kind || next.kind !== kind) {
      this.showNotice('replaceKind')
      return 'refused'
    }
    let range = { in_tick: 0, out_tick: next.durationTicks }
    if (kind === 'video') {
      const old = layer.placement.source_range
      const seconds = ((old.out_tick - old.in_tick) * previous.timebase.num) / previous.timebase.den
      const ticks = Math.round((seconds * next.timebase.den) / next.timebase.num)
      if (ticks > next.durationTicks) {
        this.showNotice('replaceTooShort')
        return 'refused'
      }
      range = { in_tick: 0, out_tick: ticks }
    }
    const applied = await this.write([clipReplaceSourceSpec({ sceneId: armed.sceneId, layerId: armed.layerId, sourceId, sourceRange: range })], {})
    this.showNotice(applied ? 'replaced' : 'replaceFailed')
    return applied ? 'replaced' : 'refused'
  }

  // ---------------------------------------------------------------- canvas format (contextual toolbar)

  /** Pixel sizes of the sources of every moved clip of the document (what re-covering needs), plus what the canvas drew. */
  private async mediaSizesOf(document: CompositionDocument): Promise<Map<string, Size>> {
    const sizes = new Map<string, Size>()
    const scene = this.mounted()
    const ids = new Set<string>()
    for (const candidate of document.scenes) {
      for (const layer of candidate.layers) {
        const body = layer as unknown as Record<string, unknown>
        const sourceId = (body['placement'] as Record<string, unknown> | undefined)?.['source_id']
        if (body['layer_kind'] !== 'clip' || !body['transform'] || typeof sourceId !== 'string') continue
        ids.add(sourceId)
        // The drawn contain box has the media's aspect: enough when the picture cannot be read.
        const view = scene && scene.sceneId === candidate.scene_id ? layerViewOf(document, candidate.scene_id, layer.layer_id) : null
        const natural = view ? this.naturalSizeOf(view) : null
        if (natural && !sizes.has(sourceId)) sizes.set(sourceId, natural)
      }
    }
    const resolve = this.options.mediaSize
    if (resolve) {
      await Promise.all(
        [...ids].map(async (sourceId) => {
          const ref = mediaSourceRef(document, sourceId)
          const size = ref ? await resolve(ref).catch(() => null) : null
          if (size) sizes.set(sourceId, size)
        }),
      )
    }
    return sizes
  }

  /** Natural boxes of the layers of the drawn scene (a text's real height on the current canvas). */
  private drawnNaturalBoxes(): Map<string, Size> {
    const boxes = new Map<string, Size>()
    const scene = this.mounted()
    if (!scene) return boxes
    for (const layerId of scene.layerIds()) {
      const natural = scene.naturalBox(layerId)
      if (natural) boxes.set(layerId, { width: natural.width, height: natural.height })
    }
    return boxes
  }

  /** The switch to another canvas format and its impact list, from the freshest copy (null: nothing to switch). */
  async planAspect(to: SparkAspectRatio): Promise<AspectPlan | null> {
    const document = this.options.session.document() ?? this.document
    if (!document) return null
    const mediaSizes = await this.mediaSizesOf(document)
    const latest = this.options.session.document() ?? this.document ?? document
    return planAspectSwitch({ document: latest, to, mediaSizes, naturalBoxes: this.drawnNaturalBoxes() })
  }

  /**
   * Switches the canvas to `to`: `canvas.set_format` and the re-layout of every layer as ONE command (one undo reverts all).
   * The plan is made again from the copy at this moment, so an edit made while the impact list was open is not overwritten.
   */
  async switchAspect(to: SparkAspectRatio): Promise<'applied' | 'unchanged' | 'failed'> {
    if (!this.canWrite()) return 'failed'
    const plan = await this.planAspect(to)
    if (!plan) return 'unchanged'
    this.publish({ menu: null })
    return (await this.write(plan.specs, {})) ? 'applied' : 'failed'
  }

  // ---------------------------------------------------------------- colour preview, sheet, notices

  /**
   * Shows a colour being picked (shape fill or text colour) on the drawn element, before anything is written: the picker's
   * moves cost no command. `null` puts the drawn colour back (the pick was abandoned); `commitColorPreview` keeps it until the
   * redraw of the committed command replaces the element.
   */
  previewColor(kind: 'fill' | 'text', color: string | null): void {
    if (color === null) {
      this.restoreColorPreview()
      return
    }
    const target = this.selectedView()
    const scene = this.mounted()
    if (!target || !scene || scene.sceneId !== target.sceneId) return
    if ((kind === 'fill' && target.view.kind !== 'shape') || (kind === 'text' && target.view.kind !== 'text')) return
    const content = scene.groupElement(target.view.layerId)?.firstElementChild as HTMLElement | null | undefined
    if (!content) return
    const property = kind === 'fill' ? 'backgroundColor' : 'color'
    if (this.colorPreview?.element !== content || this.colorPreview.property !== property) {
      this.restoreColorPreview()
      this.colorPreview = { element: content, property, saved: content.style[property] }
    }
    content.style[property] = color
  }

  commitColorPreview(): void {
    this.colorPreview = null
  }

  /** The preview a commit takes over (it is no longer restored when the selection changes). */
  private takeColorPreview(): ColorPreview | null {
    const preview = this.colorPreview
    this.colorPreview = null
    return preview
  }

  private restoreColorPreview(): void {
    restoreColor(this.takeColorPreview())
  }

  /** Opens / closes the keyboard shortcuts sheet ("?"). */
  toggleShortcuts(open?: boolean): void {
    const next = open ?? !this.state.shortcuts
    if (next !== this.state.shortcuts) this.publish({ shortcuts: next, menu: null })
  }

  private showNotice(key: StageNotice['key']): void {
    this.noticeSeq += 1
    this.publish({ notice: { key, seq: this.noticeSeq } })
  }

  /** The stage component hides a notice after a moment. */
  clearNotice(seq: number): void {
    if (this.state.notice?.seq === seq) this.publish({ notice: null })
  }

  /** Tab walks the layers; past the last (Shift+Tab: before the first) it is not taken, so the focus can leave (Y1R-EDITOR-5). */
  private cycleLayer(direction: 1 | -1): boolean {
    const scene = this.mounted()
    if (!scene) return false
    const ids = this.views(scene.sceneId).filter((view) => this.isStageHittable(view)).map((view) => view.layerId)
    if (ids.length === 0) return false
    const current = singleLayerId(this.selection.getSnapshot())
    const index = current ? ids.indexOf(current) : -1
    const next = index + direction
    if (next < 0 || next >= ids.length) return false
    this.selection.selectLayer(scene.sceneId, ids[next]!)
    return true
  }

  /** Arrow nudge: transient preview on every press, ONE command after the burst (coalesced; one undo group). */
  private nudgeSelected(dx: number, dy: number): void {
    const target = this.selectedView()
    const scene = this.mounted()
    if (!target || !scene) return
    const base = this.nudge?.basis ?? this.basisOf(target.view)
    if (!base) return
    const basis = { ...base, x: base.x + dx, y: base.y + dy }
    this.clearNudgeTimer()
    const timers = this.options.timers ?? { setTimeout: (cb: () => void, ms: number) => globalThis.setTimeout(cb, ms) as unknown as number, clearTimeout: (h: number) => globalThis.clearTimeout(h) }
    this.nudge = { layerId: target.view.layerId, sceneId: target.sceneId, basis, timer: timers.setTimeout(() => this.endNudge(true), NUDGE_COMMIT_MS) }
    this.applyTransient(scene, { layerId: target.view.layerId, basis, visual: visualBox(basis), badge: '', guides: { v: null, h: null } })
    this.publish()
  }

  private clearNudgeTimer(): void {
    if (this.nudge?.timer !== null && this.nudge?.timer !== undefined) {
      const timers = this.options.timers ?? { clearTimeout: (h: number) => globalThis.clearTimeout(h) }
      timers.clearTimeout(this.nudge.timer)
      this.nudge.timer = null
    }
  }

  /** Commits a pending nudge burst as one command. */
  endNudge(commit: boolean): void {
    const nudge = this.nudge
    if (!nudge) return
    this.clearNudgeTimer()
    this.nudge = null
    if (!commit) {
      this.cancelTransient(nudge.layerId)
      return
    }
    this.lastBasis.set(nudge.layerId, nudge.basis)
    void this.write(transformCommit(nudge.sceneId, nudge.layerId, nudge.basis), { layerId: nudge.layerId, sceneId: nudge.sceneId, coalesceKey: `layer:${nudge.layerId}:transform`, keepPreview: true })
  }

  // ---------------------------------------------------------------- inline text editing

  startTextEdit(): void {
    const target = this.selectedView()
    const scene = this.mounted()
    if (!target || !scene || target.view.kind !== 'text' || !target.view.style || target.view.text === undefined || !this.canWrite()) return
    // A locked text is not edited on the stage; its Properties text field still edits it.
    if (target.view.locked === true) return
    if (this.options.playback.playing) this.options.playback.pause()
    const overlay = this.overlayFor(target.view.layerId, target.sceneId)
    if (!overlay) return
    const font = textFontOf(scene.bundle.ir, target.view.layerId)
    const scale = this.state.scale
    const align = target.view.style.align
    this.publish({
      menu: null,
      editing: {
        layerId: target.view.layerId,
        sceneId: target.sceneId,
        rect: overlay.rect,
        text: target.view.text,
        fontFamily: font?.family ?? 'sans-serif',
        fontWeight: font?.weight ?? 400,
        fontStyle: font?.style ?? 'normal',
        fontSizePx: (font?.sizePx ?? target.view.style.sizePx) * scale,
        lineHeightPx: (font?.lineHeightPx ?? (font?.sizePx ?? target.view.style.sizePx) * 1.2) * scale,
        color: target.view.style.color,
        align: align === 'center' ? 'center' : align === 'end' ? 'right' : 'left',
        committing: false,
        tooLong: false,
      },
    })
  }

  cancelTextEdit(): void {
    if (this.state.editing) this.publish({ editing: null })
  }

  /** Enter / blur: commits `text.set` (NFC, non-empty, max 2000) after the glyph coverage check (F45). */
  async commitTextEdit(text: string): Promise<boolean> {
    const editing = this.state.editing
    if (!editing || editing.committing) return false
    const view = layerViewOf(this.document, editing.sceneId, editing.layerId)
    if (!view || view.text === undefined) {
      this.publish({ editing: null })
      return false
    }
    const normalized = normalizeTextCommit(text, view.text)
    if ('reject' in normalized) {
      if (normalized.reject === 'too_long') this.publish({ editing: { ...editing, tooLong: true } })
      else this.publish({ editing: null })
      return false
    }
    this.publish({ editing: { ...editing, committing: true, text: normalized.text, tooLong: false } })
    await this.checkCoverage(view, normalized.text)
    // E1-N: with optimistic writes the re-laid-out text is drawn from the editor's own copy; the editor closes once THAT picture
    // is on the stage, not when the server has answered.
    const optimistic = this.options.session.optimistic?.() === true
    if (optimistic) this.pendingEditClose = editing.layerId
    const applied = await this.write(textCommit(editing.sceneId, editing.layerId, normalized.text), { coalesceKey: `layer:${editing.layerId}:text` })
    // Keep the editor until the re-laid-out scene lands; a refused command closes it without changing anything.
    if (!applied) this.publish({ editing: null })
    else if (!optimistic) this.pendingEditClose = editing.layerId
    else this.publish()
    return applied
  }

  private pendingEditClose: string | null = null

  /** Glyph coverage of a new text in the layer's pinned face (F45: a hint under the text controls, never a silent fallback). */
  private async checkCoverage(view: StageLayerView, text: string): Promise<void> {
    if (!this.options.coverage || !view.style) return
    try {
      const coverage = await this.options.coverage.check({ text, lang: 'und', font: view.style.font })
      this.publish({ textHint: coverage.status === 'covered' ? null : { layerId: view.layerId, status: coverage.status, missingCount: coverage.missingCount } })
    } catch {
      // The check is advisory; the command path does not depend on it.
    }
  }

  /**
   * Properties "Content": the same commit as the inline editor (NFC, non-empty, at most 2000 code points, glyph hint) for
   * the selected text layer without the canvas overlay. `unchanged` and `empty` send nothing.
   */
  async setSelectedText(text: string): Promise<'applied' | 'unchanged' | 'empty' | 'too_long' | 'failed'> {
    const target = this.selectedView()
    if (!target || target.view.kind !== 'text' || target.view.text === undefined || !this.canWrite()) return 'failed'
    const normalized = normalizeTextCommit(text, target.view.text)
    if ('reject' in normalized) return normalized.reject
    await this.checkCoverage(target.view, normalized.text)
    const applied = await this.write(textCommit(target.sceneId, target.view.layerId, normalized.text), { coalesceKey: `layer:${target.view.layerId}:text` })
    return applied ? 'applied' : 'failed'
  }

  /** The selected layer's geometry as the Properties position fields show it (canvas pixels, top-left, scale, rotation). */
  selectedBasis(): LayerBasis | null {
    const target = this.selectedView()
    return target ? this.basisOf(target.view) : null
  }

  /** Video clip audio from the toolbox / Properties (`clip.set_audio`): one command per change. */
  setClipAudio(patch: { gainDb?: number; muted?: boolean }): Promise<boolean> {
    const target = this.selectedView()
    if (!target || target.view.kind !== 'clip' || target.view.mediaKind !== 'video' || (patch.gainDb === undefined && patch.muted === undefined)) return Promise.resolve(false)
    return this.write([clipSetAudioSpec(target.sceneId, target.view.layerId, patch)], { coalesceKey: `layer:${target.view.layerId}:audio:${fieldsKey(patch)}` })
  }

  /**
   * A typed edit of the selected Motion layer from its Properties (one exposed field, the start second): ONE command, one
   * undo group, written through the same queue as every gesture (E1-D).
   */
  applyMotionEdit(specs: CompositionOpSpec[]): Promise<boolean> {
    const target = this.selectedView()
    if (!target || target.view.kind !== 'motion_instance' || specs.length === 0) return Promise.resolve(false)
    return this.write(specs, {})
  }

  handleDoubleClick(event: { clientX: number; clientY: number }): void {
    const layerId = this.layersAt({ x: event.clientX, y: event.clientY })[0]
    const scene = this.mounted()
    if (!layerId || !scene) return
    const view = layerViewOf(this.document, scene.sceneId, layerId)
    if (view?.kind !== 'text') return
    this.selection.selectLayer(scene.sceneId, layerId)
    this.startTextEdit()
  }

  // ---------------------------------------------------------------- hover

  handlePointerMove(event: { clientX: number; clientY: number }): void {
    if (this.gesture || this.state.editing || this.options.playback.playing) return
    if (this.hoverScheduled) return
    this.hoverScheduled = true
    const view = this.doc.defaultView
    const run = () => {
      this.hoverScheduled = false
      if (this.disposed) return
      const layerId = this.layersAt({ x: event.clientX, y: event.clientY })[0] ?? null
      const scene = this.mounted()
      const selected = singleLayerId(this.selection.getSnapshot())
      const overlay = layerId && layerId !== selected && scene ? this.overlayFor(layerId, scene.sceneId) : null
      const next = overlay?.rect ?? null
      if (next?.x !== this.state.hover?.x || next?.y !== this.state.hover?.y || next?.width !== this.state.hover?.width) this.publish({ hover: next })
    }
    if (view) view.requestAnimationFrame(run)
    else run()
  }

  handlePointerLeave(): void {
    if (this.state.hover) this.publish({ hover: null })
  }

  // ---------------------------------------------------------------- adding layers

  /**
   * The session the stage writes through (E1-J): a tool that edits something other than "a new layer at a placement"
   * (the scene panel's background) reads the freshest document and working copy version here at call time, which the
   * React snapshot of the shell cannot give right after a `refresh()`.
   */
  get session(): StageControllerOptions['session'] {
    return this.options.session
  }

  /** Where an add-action puts its layer for `target` (the playhead by default); null while no scene is drawn (E1-A). */
  placementAt(target: PlacementTarget = { kind: 'playhead' }): StagePlacement | null {
    const plan = this.presenter.plan
    const document = this.options.session.document() ?? this.document
    if (!plan || !document) return null
    return resolvePlacement({ plan, document, playbackFrame: this.options.playback.frame, target })
  }

  /** Canvas pixels of a client point (a drop), kept inside the canvas; null before the frame has been measured. */
  canvasPointAt(client: { x: number; y: number }): CanvasPoint | null {
    const rect = this.frameRect()
    const canvas = this.canvasSize()
    if (!rect || !canvas || rect.width === 0) return null
    const point = clientToCanvas(rect, canvas.width, client)
    return { x: Math.min(Math.max(0, point.x), canvas.width), y: Math.min(Math.max(0, point.y), canvas.height) }
  }

  /**
   * THE entry of every "add something to the scene" action (text, media, shapes, Motion, ...). `build` gets the resolved
   * placement (scene, start frame, drop point, ...) and the freshest document and returns the specs of ONE command (one
   * gesture = one undo group) and the layer to select once it is drawn. `target` is the "+" button (the playhead, the
   * default), a canvas drop or a timeline drop (D14). `refresh` re-reads the working copy first (a source bound on the
   * server after the editor loaded). After a timeline drop the placed scene is selected and the playhead moves onto it —
   * timeline v3: the moment the edit is drawn (optimistic writes), not when the server answers. `onLocal` runs then too (a
   * tile's busy state ends), `onQueued` right after the command was handed to the session (a follow-up of the same undo
   * step, e.g. the exact media fit, may be queued behind it from then on).
   */
  async placeLayer(
    build: (placement: StagePlacement, document: CompositionDocument) => PlacedLayers | null,
    target: PlacementTarget = { kind: 'playhead' },
    options: { refresh?: boolean; onLocal?: () => void; onQueued?: () => void } = {},
  ): Promise<PlaceResult> {
    const none: PlaceResult = { applied: false, layerId: null, notice: null }
    if (!this.canWrite() || !this.presenter.plan) return none
    if (options.refresh) await this.options.session.refresh()
    const placement = this.placementAt(target)
    const document = this.options.session.document() ?? this.document
    if (!placement || !document) return none
    const placed = build(placement, document)
    if (!placed || placed.specs.length === 0) return none
    const selectLayerId = placed.selectLayerId ?? null
    let selectedAtOnce = false
    let focused = false
    const focusPlacedScene = () => {
      if (focused || target.kind !== 'timeline') return
      focused = true
      // The layer went into a scene that exists already: its start is the one the drawn plan holds.
      const sceneStart = this.presenter.plan?.scenes.find((scene) => scene.sceneId === placement.sceneId)?.startFrame
      this.options.session.selectScene(placement.sceneId)
      if (sceneStart !== undefined) this.options.playback.seek(sceneStart + placement.startFrame)
    }
    const writing = this.write(placed.specs, {
      ...(placed.undoGroup && { undoGroup: placed.undoGroup }),
      // E1-N: with optimistic writes the new layer is in the copy already: it is selected at once, the stage draws it
      // (and its handles) in the same frame; otherwise it is selected once the server's picture has it.
      onOptimistic: () => {
        if (selectLayerId) {
          selectedAtOnce = true
          this.selection.selectLayer(placement.sceneId, selectLayerId)
        }
        focusPlacedScene()
        options.onLocal?.()
      },
      onApplied: (version) => {
        // Not again when the server answers: the user may have picked something else meanwhile.
        if (selectLayerId && !selectedAtOnce) this.pendingSelect = { layerId: selectLayerId, sceneId: placement.sceneId, minVersion: version }
      },
    })
    options.onQueued?.()
    const applied = await writing
    if (applied) focusPlacedScene()
    return { applied, layerId: applied ? selectLayerId : null, notice: applied ? (placed.notice ?? null) : null }
  }

  /** Rail "Text": a new text layer on top of the current scene, over the whole scene, selected once drawn. */
  async addText(): Promise<boolean> {
    const canvas = this.canvasSize()
    const fonts = this.options.fonts?.()
    if (!canvas || !fonts) return false
    const defaults = newTextDefaults(fonts.families, canvas.height)
    if (!defaults) return false
    const result = await this.placeLayer((placement) => {
      const action = textInsertAction({
        sceneId: placement.sceneId,
        afterLayerId: placement.afterLayerId,
        uuid: this.options.uuid ?? (() => globalThis.crypto.randomUUID()),
        text: this.options.labels.newText,
        defaults,
        sceneRange: { start_frame: 0, end_frame: placement.sceneFrames },
      })
      return { specs: action.specs, selectLayerId: action.layerId }
    })
    return result.applied
  }

  /**
   * Rail "Shape" (E1-B, D4): a new square, rectangle, circle, ellipse or pill, centred on the canvas (or at the drop point)
   * from the placement's start frame to the end of the scene, selected once drawn. `target` is the "+" press (the playhead),
   * a canvas drop or a timeline drop (D14); one gesture = one `shape.insert` = one undo group.
   */
  async addShape(kind: ShapeKind, options: { fill?: string; target?: PlacementTarget } = {}): Promise<boolean> {
    const fill = isShapeFill(options.fill) ? options.fill : FALLBACK_SHAPE_FILL
    const result = await this.placeLayer(
      (placement) => {
        const action = shapeInsertAction({ placement, kind, fill, uuid: this.options.uuid ?? (() => globalThis.crypto.randomUUID()) })
        return { specs: action.specs, selectLayerId: action.layerId }
      },
      options.target ?? { kind: 'playhead' },
    )
    return result.applied
  }

  /** Strip position (1-based) of the scene the playhead is in, or null while nothing is drawn (no scene, plan not read). */
  currentSceneNumber(): number | null {
    const at = this.currentSceneAt()
    if (!at || !this.document) return null
    const position = this.document.scene_sequence.scene_ids.indexOf(at.scene.sceneId)
    return position >= 0 ? position + 1 : null
  }

  /**
   * A project source (image or video) placed into a scene at `target` (the playhead by default): `clip.insert_sequence`
   * with the D11 fit for a video longer than its scene. The notice names what D11 did so the caller can say it.
   *
   * With the contextual toolbar the media covers the canvas (centred, aspect kept). Timeline v3: nothing waits for the
   * picture any more — the insert carries the cover from the size known right now (`sizeHint`: the drawer card's thumbnail,
   * only its aspect matters), and the exact cover follows in the same undo step once the picture's size is read
   * (`mediaInsertFitFor`). `onLocal` runs when the clip is in the drawn copy (the caller's busy state ends there).
   */
  async placeMedia(
    sourceId: string,
    kind: 'image' | 'video',
    target: PlacementTarget = { kind: 'playhead' },
    options: { sizeHint?: Size | null; onLocal?: () => void } = {},
  ): Promise<PlaceResult> {
    let refresh = this.needsRefreshFor(sourceId)
    let fit: MediaInsertFit | null = null
    if (this.options.contextToolbar === true && this.canWrite() && this.presenter.plan) {
      // The fit is decided on the copy that holds the source (a source bound after the copy was read is read first).
      if (refresh) {
        await this.options.session.refresh()
        refresh = false
      }
      const document = this.options.session.document() ?? this.document
      fit = document ? this.mediaInsertFitFor(sourceId, document, options.sizeHint ?? null) : null
    }
    let placedLayer: { sceneId: string; layerId: string } | null = null
    return this.placeLayer(
      (placement, document) => {
        const layerId = newLayerId((this.options.uuid ?? (() => globalThis.crypto.randomUUID()))())
        const placed = mediaPlacementSpecs({
          document,
          placement,
          sourceId,
          kind,
          layerId,
          ...(this.options.imageHoldSeconds !== undefined && { imageHoldSeconds: this.options.imageHoldSeconds }),
        })
        const cover = fit?.transform ?? null
        const specs = cover ? [...placed.specs, layerSetTransformSpec(placement.sceneId, layerId, cover)] : placed.specs
        placedLayer = { sceneId: placement.sceneId, layerId }
        return { specs, selectLayerId: layerId, notice: noticeOfFit(placed.fit, placement.fps), ...(fit && { undoGroup: fit.undoGroup }) }
      },
      target,
      {
        refresh,
        ...(options.onLocal && { onLocal: options.onLocal }),
        onQueued: () => {
          if (fit && placedLayer) fit.settle(placedLayer)
        },
      },
    )
  }

  /**
   * Timeline v3 instant media add (`media-insert-fit.ts`): the fit of `sourceId` for an insert planned on `document`. The
   * transform written with the insert is the cover from the size known right now — what this tab measured or read before,
   * else `hint` (any size with the media's aspect, e.g. the drawer card's thumbnail) — or none; `settle` reads the real size
   * in the background (once for the page) and sends the exact cover as one `layer.set_transform` in the insert's undo step
   * when it differs. Null with the contextual toolbar off or for a source the copy does not hold as an image or video.
   */
  mediaInsertFitFor(sourceId: string, document: CompositionDocument, hint: Size | null = null): MediaInsertFit | null {
    if (this.options.contextToolbar !== true) return null
    const source = mediaSourceRef(document, sourceId)
    if (!source) return null
    const canvas = this.canvasSize() ?? { width: document.canvas.width, height: document.canvas.height }
    const resolve = this.options.mediaSize
    const knownNow = resolve?.known?.(source) ?? null
    const transform = insertCover(canvas, knownNow ?? hint)
    const undoGroup = createSparkUndoGroup()
    return {
      transform,
      undoGroup,
      settle: (placed) => {
        // A size known up front is the picture's own: the insert already carries the exact fit.
        if (knownNow || !resolve) return
        void resolve(source)
          .catch(() => null)
          .then((size) => {
            if (!size || this.disposed) return
            const exact = insertCover(canvas, size)
            if (sameMediaFit(exact, transform)) return
            // Joins the insert's undo step; the session drops it when anything was written after the insert.
            void this.write([layerSetTransformSpec(placed.sceneId, placed.layerId, exact)], { joinUndoGroup: undoGroup })
          })
      },
    }
  }

  /**
   * E1-N: a source the working copy already holds needs no re-read before it is placed when the session applies edits to
   * its own copy (the read only exists for a source bound on the server after the editor loaded).
   */
  private needsRefreshFor(sourceId: string): boolean {
    const document = this.options.session.document() ?? this.document
    return !(this.options.session.optimistic?.() === true && document !== null && sourceProbeOf(document, sourceId) !== null)
  }

  /**
   * An audio file as the music bed of the scene at `target`: `audio.insert` from the placement's start to the end of the
   * file or of the scene (E1-A). Nothing is selected afterwards (an audio placement is not a stage layer).
   */
  placeAudio(sourceId: string, target: PlacementTarget = { kind: 'playhead' }, options: { onLocal?: () => void } = {}): Promise<PlaceResult> {
    return this.placeLayer(
      (placement, document) => {
        const plan = audioBedSpecs({
          document,
          sceneId: placement.sceneId,
          startFrame: placement.startFrame,
          sceneFrames: placement.sceneFrames,
          sourceId,
          placementId: newAudioPlacementId((this.options.uuid ?? (() => globalThis.crypto.randomUUID()))()),
        })
        if (!plan) return null
        return { specs: plan.specs, notice: plan.trimmed ? { kind: 'audioTrimmed', seconds: Math.round(((plan.frames * placement.fps.den) / placement.fps.num) * 10) / 10 } : null }
      },
      target,
      { refresh: this.needsRefreshFor(sourceId), ...(options.onLocal && { onLocal: options.onLocal }) },
    )
  }

  /** Rail "Media": a project source (image or video) placed into the current scene at the playhead. */
  async addMedia(sourceId: string, kind: 'image' | 'video', target?: PlacementTarget): Promise<boolean> {
    return (await this.placeMedia(sourceId, kind, target)).applied
  }

  // ---------------------------------------------------------------- publishing

  private publish(patch: Partial<StageViewState> = {}, options: { force?: boolean } = {}): void {
    if (this.disposed) return
    const presenter = this.presenter.getSnapshot()
    const selection = this.selection.getSnapshot()
    const layerId = singleLayerId(selection)
    const overlay = layerId && selection ? this.overlayFor(layerId, selection.sceneId) : null
    // The text editor closes once the re-laid-out scene is drawn.
    let editing = patch.editing !== undefined ? patch.editing : this.state.editing
    if (editing?.committing && this.pendingEditClose === editing.layerId && !this.pendingLayers.has(editing.layerId)) {
      const view = layerViewOf(this.document, editing.sceneId, editing.layerId)
      if (this.options.session.optimistic?.() === true) {
        // E1-N: closes when the mounted scene draws the new text (laid out locally), whatever the server has answered.
        const mounted = this.presenter.current
        if (view?.text === editing.text && mounted?.sceneId === editing.sceneId && irTextOf(mounted.bundle.ir, editing.layerId) === editing.text) {
          editing = null
          this.pendingEditClose = null
        }
      } else if (this.pendingWrites === 0 && view?.text === editing.text) {
        editing = null
        this.pendingEditClose = null
      }
    }
    const next: StageViewState = { ...this.state, ...patch, presenter, selection, overlay: sameOverlay(overlay, this.state.overlay) ? this.state.overlay : overlay, editing }
    const keys = Object.keys(next) as Array<keyof StageViewState>
    // `force`: values written to the DOM only (a drag, playback) are handed to React even when the snapshot already has them.
    if (!options.force && keys.every((key) => next[key] === this.state[key])) return
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * What an add-action's `build` returns: the specs of one command and the layer to select once it is drawn; `undoGroup` names
 * the undo step the command opens (timeline v3: a follow-up such as the exact media fit joins it).
 */
export type PlacedLayers = { specs: CompositionOpSpec[]; selectLayerId?: string | null; notice?: PlacementNotice | null; undoGroup?: SparkUndoGroup }
/** What the placement did beyond the plain insert, for the caller to tell the user (translated by the tool, not here). */
export type PlacementNotice = { kind: 'videoTrimmed'; seconds: number } | { kind: 'sceneFollowsMedia' } | { kind: 'audioTrimmed'; seconds: number }
export type PlaceResult = { applied: boolean; layerId: string | null; notice: PlacementNotice | null }

type ColorPreview = { element: HTMLElement; property: 'backgroundColor' | 'color'; saved: string }

/** Puts the drawn colour back on an element a colour preview changed (nothing when the runtime already replaced it). */
function restoreColor(preview: ColorPreview | null): void {
  if (preview?.element.isConnected) preview.element.style[preview.property] = preview.saved
}

const PASTE_NOTICES: Record<PasteRefusal, StageNotice['key']> = {
  unsupported: 'pasteUnsupported',
  does_not_fit: 'pasteDoesNotFit',
  missing_source: 'pasteMissingSource',
}

function noticeOfFit(fit: VideoFit | null, fps: { num: number; den: number }): PlacementNotice | null {
  if (fit?.mode === 'trim') return { kind: 'videoTrimmed', seconds: Math.round(((fit.frames * fps.den) / fps.num) * 10) / 10 }
  if (fit?.mode === 'follow_media') return { kind: 'sceneFollowsMedia' }
  return null
}

function sameOverlay(a: StageOverlay | null, b: StageOverlay | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.layerId === b.layerId &&
    a.kind === b.kind &&
    a.locked === b.locked &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.width === b.rect.width &&
    a.rect.height === b.rect.height
  )
}

type IrTextNode = { role?: string; children?: IrTextNode[]; content?: { kind?: string; font?: { family?: string; weight?: number; style?: string; size_px?: number }; layout?: { line_height_px?: number; font?: { family?: string; weight?: number; style?: string } } } }

/** The text the compiled scene draws for a text layer (the IR's text node), or null. */
export function irTextOf(ir: unknown, layerId: string): string | null {
  const nodes = (ir as { nodes?: IrTextNode[] }).nodes ?? []
  const group = nodes.find((node) => node.role === layerId)
  const content = group?.children?.find((child) => child.role === `${layerId}.content`)?.content as { kind?: string; text?: string } | undefined
  return content?.kind === 'text' && typeof content.text === 'string' ? content.text : null
}

/** The face and metrics the compiled scene drew a text layer with (the inline editor matches them). */
export function textFontOf(ir: unknown, layerId: string): { family: string; weight: number; style: 'normal' | 'italic'; sizePx: number; lineHeightPx: number | null } | null {
  const nodes = (ir as { nodes?: IrTextNode[] }).nodes ?? []
  const group = nodes.find((node) => node.role === layerId)
  const content = group?.children?.find((child) => child.role === `${layerId}.content`)?.content
  if (!content || content.kind !== 'text' || !content.font) return null
  const font = content.layout?.font ?? content.font
  return {
    family: font.family ?? 'sans-serif',
    weight: font.weight ?? 400,
    style: font.style === 'italic' ? 'italic' : 'normal',
    sizePx: content.font.size_px ?? 16,
    lineHeightPx: content.layout?.line_height_px ?? null,
  }
}

export type { StagePlan }
