/**
 * Y1-08 editor stage: the plain value types that move between the stage modules and the thin adapter interfaces the
 * stage consumes from the server/session side (Y1-07, `editor-interfaces.md`). Every server call the stage makes goes
 * through one of these interfaces, so the stage never knows a URL, a wire shape or the session's write queue.
 */

export type StageFps = { num: number; den: number }

export type StageCanvas = { width: number; height: number; fps: StageFps }

/** A canvas-pixel rectangle. */
export type StageRect = { x: number; y: number; width: number; height: number }

/** A problem the preview compile reports for a scene or layer (left out of the picture, never hidden). */
export type StageIssue = { code: string; message: string; sceneId?: string; layerId?: string }

/**
 * A layer the runtime cannot draw (video): the stage draws it with `<video>`. Field names are the wire names of
 * `composition_preview_v1` `native_layers[]` so the JSON in the network tab is what the code reads.
 */
export type StageNativeLayer = {
  layer_id: string
  kind: 'video'
  /** Index in `scene.layers`: paint order among ALL layers of the scene (runtime layers included). */
  z_index: number
  source_id: string
  storage_object_id: string
  scene_range: { start_frame: number; end_frame: number }
  source_range: { in_tick: number; out_tick: number }
  source_timebase: { num: number; den: number }
  transform: { x: number; y: number; scale: number; rotation_deg: number } | null
  audio: { gain_db?: number; muted?: boolean } | null
}

/** One scene of the preview plan with its RESOLVED timing (the gateway's `compositionSceneLength`). */
export type StagePlanScene = {
  sceneId: string
  startFrame: number
  durationFrames: number
  /** Changes exactly when what is drawn in this scene changes; the scene cache key. */
  dependencyHash: string
  status: 'ready' | 'partial' | 'unavailable'
  warnings: StageIssue[]
  nativeLayers: StageNativeLayer[]
  /**
   * WP1 (local plans only): the hash of the scene's content in the document the plan was made from. `dependencyHash` names
   * the picture shown, which for a scene the browser cannot draw is the server's older one; the picture contains the
   * document's edits exactly when the two are equal.
   */
  contentHash?: string
}

/**
 * E1-L (D8): the transition INTO a scene as the plan holds it. `ready`: the stage draws the transition segment over the
 * absolute frames `[startFrame, startFrame + durationFrames)` (the segment document is read at `documentFrameOffset + (frame -
 * startFrame)`); `unavailable`: the boundary plays as a cut and `reason` says why.
 */
export type StagePlanTransition = {
  /** The incoming scene. */
  toSceneId: string
  fromSceneId: string
  kind: string
  status: 'ready' | 'unavailable'
  reason: string | null
  requestedFrames: number
  durationFrames: number | null
  fromFrames: number | null
  toFrames: number | null
  clamped: boolean
  startFrame: number | null
  documentFrameOffset: number | null
  /** Changes exactly when what the segment draws changes; the segment cache key. */
  dependencyHash: string | null
  /**
   * Live FX preview (`SPARK_LIVE_FX_PREVIEW_ENABLED`): the stage draws this transition itself by blending the two scene
   * pictures (`transition-blend.ts`), no segment is read. `previewOnly` says what the export cannot render yet: `cut` = it
   * exports a cut at this boundary (footage next to it), `refused` = it refuses the transition (footage elsewhere in the video).
   * Timeline v3 (export-truth): the stage only blends where the export blends, so a blend it draws has `previewOnly: null`.
   * `holds`: what each picture holds inside the window (the outgoing exit and the incoming entry animations are not played,
   * `transition-animation-hold.ts`); null for a side with nothing to hold.
   */
  blend?: {
    transition: import('../scene-transitions').SceneTransition
    previewOnly: 'cut' | 'refused' | null
    holds?: { from: import('./transition-animation-hold').TransitionHold | null; to: import('./transition-animation-hold').TransitionHold | null }
  }
}

/** The preview of one working copy version: resolved scene timings, the canvas and what the runtime must match. */
export type StagePlan = {
  workingCopyVersion: number
  canvas: StageCanvas
  /** Scenes with a resolved length, in strip order (playback skips the others: nothing is estimated). */
  scenes: StagePlanScene[]
  /** E1-L: the scene transitions (only the scenes that store one), in strip order. Absent or empty = every boundary is a cut. */
  transitions?: StagePlanTransition[]
  /** E1-L: the gateway draws scene transitions (`COMPOSITION_TRANSITIONS_ENABLED`); absent = it does not. */
  transitionsEnabled?: boolean
  /**
   * Spark effects library: the transition catalogue whose kinds the gateway lets the editor WRITE now (2 =
   * `scene-transitions@2`, `COMPOSITION_TRANSITIONS_V2_ENABLED`); absent = the `@1` kinds only.
   */
  transitionCatalog?: 2
  /**
   * Timeline v3: the gateway's `scene.split` takes the relaxed rules (`COMPOSITION_RELAXED_SPLIT_ENABLED`, manifest
   * `relaxed_split_enabled`): the timeline may plan a relaxed split (`planSceneSplit` with `relaxed`). Absent = the P02-12 rules.
   */
  relaxedSplitEnabled?: boolean
  unresolvedSceneIds: string[]
  totalFrames: number
  /** Canvas-pixel rectangle that stays clear of platform UI; shown only while dragging (V6). */
  safeArea: StageRect | null
  /** `motion-runtime` version the compile was made for; the host refuses a different loaded runtime. */
  runtimeVersion: string | null
  /** Hash of everything drawn; changes when any scene, the canvas or the font set changes. */
  dependencyHash: string
  /** E1-N: `scene_compiler` version and font set hash of the manifest (the inputs of every scene hash the browser recomputes). */
  sceneCompilerVersion?: number
  fontSetHash?: string
  /**
   * WP1: `'local'` = the browser planned the editor's own copy of the document (`planLocalPreview`); absent = the server's
   * manifest. A server plan never replaces a local one on its own (the stage decides which copy is newer).
   */
  origin?: 'local'
}

/**
 * WP1: the source has a picture of the scene, but not the one asked for (`dependencyHash`): the server moved on (a newer
 * hash, e.g. after a `COMPOSITION_PREVIEW_STALE` re-read; `bundle` is that newer picture), or a hash only the browser knows
 * could not be compiled here (`bundle` null: nothing older is offered in its place). The caller decides what to draw; a
 * different picture is never handed out as if it were the one asked for.
 */
export class StageSceneMismatchError extends Error {
  readonly code = 'scene_version_mismatch'
  constructor(
    readonly sceneId: string,
    readonly requestedHash: string,
    readonly bundle: StageSceneBundle | null,
  ) {
    super(bundle ? `The preview of ${sceneId} moved on to another version.` : `The preview of ${sceneId} at the requested version is not available here.`)
    this.name = 'StageSceneMismatchError'
  }
}

/** The compiled Motion IR of one scene plus everything the runtime needs to draw it (no second layout). */
export type StageSceneBundle = {
  sceneId: string
  startFrame: number
  durationFrames: number
  dependencyHash: string
  /** `motion-ir@1` document; opaque to the stage (the runtime's own `init` validates it). */
  ir: Record<string, unknown>
  /** IR `media_ref` key -> URL of the image asset. */
  assets: Record<string, string>
  nativeLayers: StageNativeLayer[]
  warnings: StageIssue[]
}

/**
 * What the stage needs from the preview side. Y1-07's `SparkPreviewStore` (manifest in step with the working copy,
 * de-duplicated scene loads, font gate) implements it through `previewSourceFromStore`; `createGatewayPreviewSource`
 * is the same contract straight over the gateway routes.
 */
export interface StagePreviewSource {
  /** Plan of the working copy version (idempotent for the same version; conditional re-read for a new one). */
  sync(workingCopyVersion: number, signal?: AbortSignal): Promise<StagePlan>
  /**
   * Compiled IR of one scene at the plan's current hash; a moved hash re-syncs once and retries. `dependencyHash` (E1-N) is
   * the hash the stage wants: a source that draws edits before the server has seen them answers a hash it planned itself.
   */
  loadScene(sceneId: string, signal?: AbortSignal, dependencyHash?: string): Promise<StageSceneBundle>
  /**
   * E1-L: the transition segment into `sceneId` at the plan's current hash, as a bundle whose `sceneId` is
   * `transitionBundleId(sceneId)` (the sheet of both scenes and the blend, one Motion IR document). Absent: no transitions,
   * every boundary is a cut. Rejects when the gateway cannot draw it (the presenter then shows the cut).
   */
  loadTransition?(sceneId: string, signal?: AbortSignal): Promise<StageSceneBundle>
  /** Resolves when every face the scene's text nodes use is loaded (the first frame waits for this). */
  ensureFonts(bundle: StageSceneBundle): Promise<void>
  dispose(): void
  /** E1-N: the picture of the editor's own copy of the document, drawn before the server has seen the edit. */
  local?: StageLocalPreview
}

/** E1-N: what a preview source can draw of a document the server has not confirmed yet (see `optimistic/local-preview-source.ts`). */
export interface StageLocalPreview {
  /** The plan of the editor's copy, or null when it cannot be drawn here (no manifest yet, burned-in captions, ...). */
  plan(document: import('../composition-client').CompositionDocument, workingCopyVersion: number): StagePlan | null
  /** The server's plan arrived: scenes drawn locally under the hash it names are checked against the server's own IR. */
  verify(plan: StagePlan): void
  /** The server's IR differs from what was drawn for the same hash (a bug the parity tests should prevent): redraw with it. */
  onCorrection(listener: (bundle: StageSceneBundle) => void): () => void
  /** Loads the face a new text layer will use, so adding text needs no download. true = the face is known and loaded. */
  prepareText(font: { font_id: string; font_revision: string; sha256: string }): Promise<boolean>
}

/** Playback URLs of project media objects (the Range BFF for video/audio, the redirecting download route for images). */
export interface StageMediaResolver {
  playbackUrl(storageObjectId: string): string
  imageUrl(storageObjectId: string): string
}

export type StageGlyphCoverage = { status: 'covered' | 'glyph_missing' | 'unsupported_script'; missingCount: number }

/** Glyph coverage of a text in a pinned face (F45: a warning, never a silent fallback). */
export interface StageCoverageChecker {
  check(input: {
    text: string
    lang: string
    font: { font_id: string; font_revision: string; sha256: string }
  }): Promise<StageGlyphCoverage>
}

export type StageLayerKind = 'text' | 'shape' | 'clip' | 'motion_instance' | 'pending_slot'
