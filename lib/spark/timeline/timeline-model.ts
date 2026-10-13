import { layerAnimationsOf, slotsOf, type StoredAnimation } from '../animations/layer-animations'
import type { CompositionDocument, CompositionScene } from '../composition-client'
import { readTransition, transitionExportStates, transitionWindowsOf, type SceneTransition, type TransitionExportState } from '../scene-transitions'
import { resolveSceneLength } from '../scene-timing'
import { framesForTicks } from '../stage/placement'

/**
 * Spark timeline (v2 P1-A, v3 owner feedback 2026-10-03): a VIEW of the document, never stored. CapCut's layout over the
 * Composition document as it is:
 *
 * - Chapter row (v3, the YouTube-chapter look): runs of consecutive scenes with the same `scene.section_id`
 *   (`document.sections` gives the title). A scene without a section joins the chapter before it (the first chapter when it
 *   leads), so there is never an "Unsorted" chapter. A project where no scene has a section shows one MUTED automatic
 *   chapter per scene (3+ scenes: the first "Intro", the last "Outro", the others named by their first text, their media,
 *   else "Scene n"); editing one writes real sections (`timeline-chapter-edits.ts`).
 * - Main track: one block per scene, back to back (`scene_sequence` is gapless: CapCut's magnetic main track). A scene's
 *   "main clip" is its LOWEST clip layer whose transform is absent or covers the canvas; the block shows it.
 * - Overlay rows: every other visual layer of a scene, at the scene start + its `scene_range`. Row = the layer's rank among
 *   the scene's overlays from the bottom (row 0 is the lowest; a higher row draws on top). Moving between rows is
 *   `layer.arrange`. In/out animations show as ramps.
 * - Voice / music / sfx lanes from `audio.placements`, a captions lane from `caption_tracks`.
 * - Cuts between main blocks carry the transition INTO the next scene (`Scene.transition_in`) and what the export renders
 *   there (`exportState`, the export-status band).
 * - Media slots (v3): each main block names the Storage object and source seconds of its picture and of its waveform, so
 *   the filmstrip and the peaks are picked from the clip's own source start.
 *
 * Frames: the model's axis is DISPLAY frames. A scene whose length cannot be derived yet (follow_media without a clip,
 * follow_narration before its narration) still needs a block, so it gets a stand-in length on the display axis while the
 * playback clock (the gateway's preview timeline, `resolveTimeline`) gives it zero frames. `playToDisplayFrame` /
 * `displayToPlayFrame` convert; for a document without unresolved scenes both are the identity.
 *
 * Pure and framework free; rebuilt only when the document object changes (≤ 3 ms for 200 scenes, see the perf test).
 */

export type TimelineFps = { num: number; den: number }
export type TimelineSourceRange = { in_tick: number; out_tick: number }
export type TimelineMediaKind = 'image' | 'video' | 'audio' | null

/**
 * The part of a Storage object a clip plays (v3 clip media slots): the filmstrip tiles and the waveform peaks are picked
 * from `sourceStartSeconds`, so the halves of a split clip continue the film. Seconds are null for an image.
 */
export type TimelineMediaSpan = {
  storageObjectId: string
  mediaKind: 'image' | 'video' | 'audio'
  sourceStartSeconds: number | null
  sourceEndSeconds: number | null
}

/** Where a main block's waveform comes from: the main clip's own sound, else the scene's narration (scene-local frames). */
export type TimelineWaveformSource = TimelineMediaSpan & { startFrame: number; endFrame: number }

export type TimelineMainClip = {
  layerId: string
  sourceId: string | null
  mediaKind: TimelineMediaKind
  /** The clip's Storage object and the source seconds it plays (null without a bound object). */
  media: TimelineMediaSpan | null
  /** Scene-local frames of the clip. */
  startFrame: number
  endFrame: number
  sourceRange: TimelineSourceRange | null
  /** Frames of the source still unused before the in point / after the out point (video); null = unbounded (image). */
  headroomStartFrames: number | null
  headroomEndFrames: number | null
  /** The clip carries animations or `after()` anchors (`clip.split` refuses it). */
  animated: boolean
}

export type TimelineMainBlock = {
  key: string
  sceneId: string
  /** 0-based strip position. */
  index: number
  /** Display frames on the timeline axis. */
  startFrame: number
  lengthFrames: number
  endFrame: number
  /** Start on the playback clock (the gateway's timeline: an unresolved scene there has length 0). */
  playStartFrame: number
  /** False when the scene's length cannot be derived yet (the block shows a stand-in length). */
  resolved: boolean
  policy: CompositionScene['timing_policy']
  sectionId: string | null
  mainClip: TimelineMainClip | null
  /** What the block shows: the first text, the main clip's media kind, else the number. */
  label: { kind: 'text'; text: string } | { kind: 'video' } | { kind: 'image' } | { kind: 'none' }
  /**
   * The picture of the block's media slot: the main clip, else the scene's first clip (a picture-in-picture still shows);
   * null for graphics only (the block shows a title card of its first text).
   */
  picture: TimelineMediaSpan | null
  /** The waveform under the picture: the main clip's sound (a video), else the scene's narration; null = none. */
  waveform: TimelineWaveformSource | null
  transitionIn: SceneTransition | null
  /** The scene follows its narration or is bound to script beats (`scene.split` refuses it; trim is disabled). */
  narrationBound: boolean
  /** A pending placeholder (an operation fills the scene). */
  pending: boolean
}

export type TimelineOverlayKind = 'clip' | 'text' | 'shape' | 'motion_instance' | 'pending_slot'

export type TimelineOverlayBlock = {
  key: string
  layerId: string
  sceneId: string
  kind: TimelineOverlayKind
  /** 0 = the lowest overlay row. */
  row: number
  /** Index in `scene.layers` (paint order). */
  zIndex: number
  /** Scene-local frames. */
  localStart: number
  localEnd: number
  /** Display frames (clamped into the scene). */
  startFrame: number
  endFrame: number
  sceneStartFrame: number
  sceneLengthFrames: number
  mediaKind: TimelineMediaKind
  sourceId: string | null
  sourceRange: TimelineSourceRange | null
  headroomStartFrames: number | null
  headroomEndFrames: number | null
  text: string | null
  /** Lengths of the In / Out animation ramps (frames), null without one. */
  enterFrames: number | null
  exitFrames: number | null
  enterAnimation: StoredAnimation | null
  exitAnimation: StoredAnimation | null
  /** Any stored animation (re-placed when the layer moves or is trimmed). */
  animated: boolean
  /** `after()` anchors to or from the layer (moving it to another scene is refused by the gateway). */
  anchored: boolean
  movable: boolean
  trimmable: boolean
}

export type TimelineAudioRole = 'narration' | 'music' | 'sfx'

export type TimelineAudioBlock = {
  key: string
  placementId: string
  role: TimelineAudioRole
  sceneId: string | null
  startFrame: number
  endFrame: number
  /** The placement's Storage object and source seconds (its waveform), null when the source is not bound to one. */
  media: TimelineMediaSpan | null
}

export type TimelineCaptionBlock = { key: string; captionTrackId: string; startFrame: number; endFrame: number }

/**
 * A chapter's name: a section's title; for an automatic chapter (no sections in the project) "Intro" / "Outro" at the ends
 * of 3+ scenes, else the scene's first text, its media's name (resolved by the UI; `n` is the fallback) or "Scene n".
 */
export type TimelineChapterTitle =
  | { kind: 'section'; text: string }
  | { kind: 'intro' }
  | { kind: 'outro' }
  | { kind: 'text'; text: string }
  | { kind: 'media'; storageObjectId: string; n: number }
  | { kind: 'scene'; n: number }

export type TimelineChapter = {
  /** Stable while the run exists: `chapter:<sectionId>` (`#<n>` for a later run of the same section) or `auto:<sceneId>`. */
  key: string
  /** 0-based place in the chapter row. */
  index: number
  /** The run's section; null for an automatic chapter. */
  sectionId: string | null
  /** An automatic chapter of a project without sections (shown muted; one per scene). */
  auto: boolean
  title: TimelineChapterTitle
  /** Slot of the chapter palette (by section order, so a chapter keeps its colour while scenes move). */
  colorIndex: number
  startFrame: number
  endFrame: number
  /** Start on the playback clock (YouTube chapter times). */
  playStartFrame: number
  sceneIds: string[]
}

export type TimelineCut = {
  /** The incoming scene (the `transition_in` holder). */
  sceneId: string
  fromSceneId: string
  /** Index of the incoming scene. */
  index: number
  /** Display frame of the cut. */
  frame: number
  transition: SceneTransition | null
  /** The window the timing rule gives the stored transition (display frames), or null (cut / not drawable). */
  window: { startFrame: number; endFrame: number; durationFrames: number; clamped: boolean } | null
  /** Both scenes have a resolved length (a transition can sit here). */
  resolved: boolean
  /** What the export renders here (`transitionExportStates`; the preview plays exactly that). */
  exportState: TransitionExportState
}

export type TimelineModel = {
  fps: TimelineFps
  /** Frames per second as a number. */
  rate: number
  canvas: { width: number; height: number }
  totalFrames: number
  playTotalFrames: number
  /** The chapter row (never "Unsorted"; automatic chapters for a project without sections). */
  chapters: TimelineChapter[]
  /** No scene has a section: the chapters are automatic. */
  autoChapters: boolean
  /** The chapter of each scene (`chapterOf.get(sceneId)` is its index in `chapters`). */
  chapterOf: ReadonlyMap<string, number>
  main: TimelineMainBlock[]
  overlays: TimelineOverlayBlock[]
  overlayRowCount: number
  voice: TimelineAudioBlock[]
  music: TimelineAudioBlock[]
  sfx: TimelineAudioBlock[]
  captions: TimelineCaptionBlock[]
  cuts: TimelineCut[]
  /** Sorted unique display frames a gesture snaps to (cuts, block and section edges, 0 and the end). */
  snapFrames: number[]
  hasUnresolved: boolean
  /** Lookups. */
  mainById: ReadonlyMap<string, TimelineMainBlock>
  overlayById: ReadonlyMap<string, TimelineOverlayBlock>
}

/** Seconds a scene whose length cannot be derived yet shows on the timeline (the "Add scene" default). */
export const UNRESOLVED_SCENE_SECONDS = 3

type Body = Record<string, unknown>

function rangeOf(value: unknown): { start: number; end: number } | null {
  if (!value || typeof value !== 'object') return null
  const { start_frame: start, end_frame: end } = value as Body
  return typeof start === 'number' && typeof end === 'number' && end > start && start >= 0 ? { start, end } : null
}

function sourceRangeOf(value: unknown): TimelineSourceRange | null {
  if (!value || typeof value !== 'object') return null
  const { in_tick: inTick, out_tick: outTick } = value as Body
  return typeof inTick === 'number' && typeof outTick === 'number' && outTick > inTick ? { in_tick: inTick, out_tick: outTick } : null
}

type SourceInfo = {
  kind: TimelineMediaKind
  durationTicks: number | null
  timebase: TimelineFps | null
  storageObjectId: string | null
  /** The source carries sound (a video with audio channels, any audio). */
  audible: boolean
}

function sourceIndex(document: CompositionDocument): Map<string, SourceInfo> {
  const index = new Map<string, SourceInfo>()
  for (const source of document.source_media as Body[]) {
    const id = source['source_id']
    if (typeof id !== 'string') continue
    const object = source['storage_object'] as Body | undefined
    const kind = object?.['media_kind']
    const probe = source['probe'] as Body | undefined
    const timebase = probe?.['timebase'] as Body | undefined
    const validTimebase = timebase && typeof timebase['num'] === 'number' && typeof timebase['den'] === 'number' && timebase['num'] > 0 && timebase['den'] > 0
    const mediaKind = kind === 'image' || kind === 'video' || kind === 'audio' ? kind : null
    const channels = probe?.['audio_channels']
    index.set(id, {
      kind: mediaKind,
      durationTicks: typeof probe?.['duration_ticks'] === 'number' ? (probe['duration_ticks'] as number) : null,
      timebase: validTimebase ? { num: timebase['num'] as number, den: timebase['den'] as number } : null,
      storageObjectId: typeof object?.['storage_object_id'] === 'string' ? (object['storage_object_id'] as string) : null,
      audible: mediaKind === 'audio' || (mediaKind === 'video' && (typeof channels !== 'number' || channels > 0)),
    })
  }
  return index
}

/** The Storage object and source seconds a placement plays (null without a bound object or a known kind). */
function mediaSpanOf(info: SourceInfo | undefined, range: TimelineSourceRange | null): TimelineMediaSpan | null {
  if (!info?.storageObjectId || !info.kind) return null
  const seconds = (tick: number) => (info.timebase ? (tick * info.timebase.num) / info.timebase.den : null)
  const timed = info.kind !== 'image' && range !== null
  return {
    storageObjectId: info.storageObjectId,
    mediaKind: info.kind,
    sourceStartSeconds: timed ? seconds(range.in_tick) : null,
    sourceEndSeconds: timed ? seconds(range.out_tick) : null,
  }
}

/** Frames of source left before the in point and after the out point of a video clip (null for an image / unknown). */
function headroomOf(info: SourceInfo | undefined, range: TimelineSourceRange | null, fps: TimelineFps): { start: number | null; end: number | null } {
  if (!info || info.kind !== 'video' || !range || !info.timebase || info.durationTicks === null) return { start: null, end: null }
  return {
    start: Math.max(0, framesForTicks(range.in_tick, info.timebase, fps)),
    end: Math.max(0, framesForTicks(info.durationTicks - range.out_tick, info.timebase, fps)),
  }
}

/**
 * Whether a clip's transform leaves it covering the canvas. The document holds no media dimensions, so a transform reads as
 * "cover" when it is unrotated, not scaled down and its top-left lies at or above/left of the canvas origin (the cover
 * transform of a contain-fitted clip is `scale ≥ 1` with a non-positive offset). No transform = the compiler's full-frame fit.
 */
export function transformCoversCanvas(transform: unknown): boolean {
  if (transform === undefined || transform === null) return true
  if (typeof transform !== 'object') return false
  const { x, y, scale, rotation_deg: rotation } = transform as Body
  if (typeof x !== 'number' || typeof y !== 'number' || typeof scale !== 'number') return false
  return (typeof rotation !== 'number' || Math.abs(rotation) < 1e-6) && scale >= 1 - 1e-6 && x <= 0.5 && y <= 0.5
}

function afterAnchorTargets(layer: Body): string[] {
  const animations = layer['animations']
  if (!Array.isArray(animations)) return []
  return animations.flatMap((animation) => {
    const anchor = (animation as Body | null)?.['anchor'] as Body | undefined
    return anchor?.['kind'] === 'after' && typeof anchor['layer_id'] === 'string' ? [anchor['layer_id']] : []
  })
}

function layerRangeOf(layer: Body): { start: number; end: number } | null {
  return rangeOf(layer['layer_kind'] === 'clip' ? (layer['placement'] as Body | undefined)?.['scene_range'] : layer['scene_range'])
}

const OVERLAY_KINDS: ReadonlySet<string> = new Set(['clip', 'text', 'shape', 'motion_instance', 'pending_slot'])

/** The scene's main clip: its lowest scene-local clip layer whose transform is absent or covers the canvas. */
export function mainClipLayerOf(scene: CompositionScene): Body | null {
  for (const layer of scene.layers as Body[]) {
    if (layer['layer_kind'] !== 'clip') continue
    const placement = layer['placement'] as Body | undefined
    if (!rangeOf(placement?.['scene_range'])) continue
    if (transformCoversCanvas(layer['transform'])) return layer
  }
  return null
}

function narrationBoundOf(scene: CompositionScene): boolean {
  return scene.timing_policy === 'follow_narration' || (scene as Body)['narration_binding'] !== undefined
}

/** Builds the timeline view of a document (see the module header). */
export function buildTimelineModel(document: CompositionDocument, options: { unresolvedSeconds?: number } = {}): TimelineModel {
  const fps = { num: document.canvas.fps.num, den: document.canvas.fps.den }
  const rate = fps.num / fps.den
  const standIn = Math.max(1, Math.round((options.unresolvedSeconds ?? UNRESOLVED_SCENE_SECONDS) * rate))
  const sources = sourceIndex(document)
  const byId = new Map<string, CompositionScene>()
  for (const scene of document.scenes) byId.set(scene.scene_id, scene)
  const sectionTitles = new Map<string, string>()
  for (const section of document.sections) sectionTitles.set(section.section_id, section.title)
  // The narration of each scene (its waveform when the scene has no sounding main clip).
  const narrationOf = new Map<string, Body>()
  for (const placement of document.audio.placements as Body[]) {
    const sceneId = placement['scene_id']
    if (placement['role'] === 'narration' && typeof sceneId === 'string' && !narrationOf.has(sceneId)) narrationOf.set(sceneId, placement)
  }

  const main: TimelineMainBlock[] = []
  const overlays: TimelineOverlayBlock[] = []
  const mainById = new Map<string, TimelineMainBlock>()
  const overlayById = new Map<string, TimelineOverlayBlock>()
  let cursor = 0
  let playCursor = 0
  let overlayRowCount = 0
  let hasUnresolved = false

  for (const sceneId of document.scene_sequence.scene_ids) {
    const scene = byId.get(sceneId)
    if (!scene) continue
    const resolvedLength = resolveSceneLength(document, scene)
    const resolved = resolvedLength !== null
    if (!resolved) hasUnresolved = true
    const lengthFrames = resolvedLength ?? standIn
    const startFrame = cursor
    const mainLayer = mainClipLayerOf(scene)
    let mainClip: TimelineMainClip | null = null
    let firstText: string | null = null
    let firstClipMedia: TimelineMediaSpan | null = null
    let pending = false
    const layers = scene.layers as Body[]
    const anchoredIds = new Set<string>()
    for (const layer of layers) {
      const targets = afterAnchorTargets(layer)
      if (targets.length > 0) {
        anchoredIds.add(layer['layer_id'] as string)
        for (const target of targets) anchoredIds.add(target)
      }
    }
    if (mainLayer) {
      const placement = mainLayer['placement'] as Body
      const range = rangeOf(placement['scene_range'])!
      const sourceId = typeof placement['source_id'] === 'string' ? placement['source_id'] : null
      const info = sourceId ? sources.get(sourceId) : undefined
      const sourceRange = sourceRangeOf(placement['source_range'])
      const headroom = headroomOf(info, sourceRange, fps)
      mainClip = {
        layerId: mainLayer['layer_id'] as string,
        sourceId,
        mediaKind: info?.kind ?? null,
        media: mediaSpanOf(info, sourceRange),
        startFrame: range.start,
        endFrame: range.end,
        sourceRange,
        headroomStartFrames: headroom.start,
        headroomEndFrames: headroom.end,
        animated: layerAnimationsOf(mainLayer).length > 0 || anchoredIds.has(mainLayer['layer_id'] as string),
      }
    }

    // Overlays: every other visual layer, ranked from the bottom.
    let rank = 0
    for (let z = 0; z < layers.length; z += 1) {
      const layer = layers[z]!
      const kind = layer['layer_kind']
      if (typeof kind !== 'string' || !OVERLAY_KINDS.has(kind)) continue
      if (kind === 'pending_slot') pending = true
      if (kind === 'text' && firstText === null && typeof layer['text'] === 'string' && layer['text'].trim().length > 0) firstText = layer['text'].trim()
      if (layer === mainLayer) continue
      const range = layerRangeOf(layer)
      if (!range) continue
      const layerId = layer['layer_id'] as string
      const placement = kind === 'clip' ? (layer['placement'] as Body | undefined) : undefined
      const sourceId = typeof placement?.['source_id'] === 'string' ? (placement['source_id'] as string) : null
      const info = sourceId ? sources.get(sourceId) : undefined
      const sourceRange = placement ? sourceRangeOf(placement['source_range']) : null
      if (placement && firstClipMedia === null && info?.kind !== 'audio') firstClipMedia = mediaSpanOf(info, sourceRange)
      const headroom = headroomOf(info, sourceRange, fps)
      const animations = layerAnimationsOf(layer)
      const slots = slotsOf(animations)
      const localStart = Math.min(range.start, lengthFrames)
      const localEnd = Math.min(range.end, lengthFrames)
      const block: TimelineOverlayBlock = {
        key: `layer:${layerId}`,
        layerId,
        sceneId,
        kind: kind as TimelineOverlayKind,
        row: rank,
        zIndex: z,
        localStart: range.start,
        localEnd: range.end,
        startFrame: startFrame + localStart,
        endFrame: startFrame + Math.max(localStart, localEnd),
        sceneStartFrame: startFrame,
        sceneLengthFrames: lengthFrames,
        mediaKind: info?.kind ?? null,
        sourceId,
        sourceRange,
        headroomStartFrames: headroom.start,
        headroomEndFrames: headroom.end,
        text: kind === 'text' && typeof layer['text'] === 'string' ? layer['text'] : null,
        enterFrames: slots.in?.params.duration_frames ?? null,
        exitFrames: slots.out?.params.duration_frames ?? null,
        enterAnimation: slots.in,
        exitAnimation: slots.out,
        animated: animations.length > 0,
        anchored: anchoredIds.has(layerId),
        movable: resolved && kind !== 'pending_slot',
        trimmable: resolved && (kind === 'clip' || kind === 'text' || kind === 'shape'),
      }
      rank += 1
      overlays.push(block)
      overlayById.set(layerId, block)
    }
    overlayRowCount = Math.max(overlayRowCount, rank)

    const label: TimelineMainBlock['label'] = firstText
      ? { kind: 'text', text: firstText }
      : mainClip?.mediaKind === 'video'
        ? { kind: 'video' }
        : mainClip?.mediaKind === 'image'
          ? { kind: 'image' }
          : { kind: 'none' }
    let waveform: TimelineWaveformSource | null = null
    const mainInfo = mainClip?.sourceId ? sources.get(mainClip.sourceId) : undefined
    if (mainClip?.media && mainInfo?.audible) {
      waveform = { ...mainClip.media, startFrame: mainClip.startFrame, endFrame: mainClip.endFrame }
    } else {
      const narration = narrationOf.get(sceneId)
      const range = narration ? rangeOf(narration['scene_range']) : null
      const span = narration && typeof narration['source_id'] === 'string' ? mediaSpanOf(sources.get(narration['source_id']), sourceRangeOf(narration['source_range'])) : null
      if (span && range) waveform = { ...span, startFrame: range.start, endFrame: range.end }
    }
    const block: TimelineMainBlock = {
      key: `scene:${sceneId}`,
      sceneId,
      index: main.length,
      startFrame,
      lengthFrames,
      endFrame: startFrame + lengthFrames,
      playStartFrame: playCursor,
      resolved,
      policy: scene.timing_policy,
      sectionId: scene.section_id !== null && sectionTitles.has(scene.section_id) ? scene.section_id : null,
      mainClip,
      label,
      picture: mainClip?.media ?? firstClipMedia,
      waveform,
      transitionIn: readTransition((scene as Body)['transition_in']),
      narrationBound: narrationBoundOf(scene),
      pending,
    }
    main.push(block)
    mainById.set(sceneId, block)
    cursor += lengthFrames
    playCursor += resolvedLength ?? 0
  }
  const totalFrames = cursor

  const { chapters, chapterOf, auto: autoChapters } = chaptersOf(main, document.sections)

  // Cuts and the transition windows (computed on the play clock, shown on the display axis).
  const windows = transitionWindowsOf(document)
  const exportStates = transitionExportStates(document, { windows })
  const cuts: TimelineCut[] = []
  for (let index = 1; index < main.length; index += 1) {
    const block = main[index]!
    const previous = main[index - 1]!
    const window = windows.get(block.sceneId)
    const ready = window?.status === 'ready' && block.resolved && previous.resolved ? window : null
    cuts.push({
      sceneId: block.sceneId,
      fromSceneId: previous.sceneId,
      index,
      frame: block.startFrame,
      transition: block.transitionIn,
      window: ready
        ? {
            startFrame: block.startFrame - ready.fromFrames,
            endFrame: block.startFrame + ready.toFrames,
            durationFrames: ready.durationFrames,
            clamped: ready.clamped,
          }
        : null,
      resolved: block.resolved && previous.resolved,
      exportState: exportStates.get(block.sceneId) ?? { state: 'none' },
    })
  }

  // Audio and captions on the play clock, mapped to display frames.
  const toDisplay = (frame: number) => playToDisplay(main, hasUnresolved, frame)
  const voice: TimelineAudioBlock[] = []
  const music: TimelineAudioBlock[] = []
  const sfx: TimelineAudioBlock[] = []
  for (const placement of document.audio.placements as Body[]) {
    const role = placement['role']
    if (role !== 'narration' && role !== 'music' && role !== 'sfx') continue
    const placementId = placement['placement_id'] as string
    const sceneId = typeof placement['scene_id'] === 'string' ? placement['scene_id'] : null
    let start: number
    let end: number
    if (sceneId) {
      const block = mainById.get(sceneId)
      const range = rangeOf(placement['scene_range'])
      if (!block || !range) continue
      start = block.startFrame + range.start
      end = block.startFrame + range.end
    } else {
      const range = rangeOf(placement['project_range'])
      if (!range) continue
      start = toDisplay(range.start)
      end = toDisplay(range.end)
    }
    start = Math.max(0, Math.min(start, totalFrames))
    end = Math.max(start, Math.min(end, totalFrames))
    if (end <= start) continue
    const media = typeof placement['source_id'] === 'string' ? mediaSpanOf(sources.get(placement['source_id']), sourceRangeOf(placement['source_range'])) : null
    const block: TimelineAudioBlock = { key: `audio:${placementId}`, placementId, role, sceneId, startFrame: start, endFrame: end, media }
    if (role === 'narration') voice.push(block)
    else if (role === 'music') music.push(block)
    else sfx.push(block)
  }
  const captions: TimelineCaptionBlock[] = totalFrames > 0
    ? document.caption_tracks.map((track) => ({ key: `caption:${track.caption_track_id}`, captionTrackId: track.caption_track_id, startFrame: 0, endFrame: totalFrames }))
    : []

  const byStart = (a: { startFrame: number; endFrame: number }, b: { startFrame: number; endFrame: number }) => a.startFrame - b.startFrame || a.endFrame - b.endFrame
  overlays.sort(byStart)
  voice.sort(byStart)
  music.sort(byStart)
  sfx.sort(byStart)

  const snap = new Set<number>([0, totalFrames])
  for (const block of main) {
    snap.add(block.startFrame)
    snap.add(block.endFrame)
  }
  for (const block of overlays) {
    snap.add(block.startFrame)
    snap.add(block.endFrame)
  }
  for (const block of [...voice, ...music, ...sfx]) {
    snap.add(block.startFrame)
    snap.add(block.endFrame)
  }
  const snapFrames = [...snap].sort((a, b) => a - b)

  return {
    fps,
    rate,
    canvas: { width: document.canvas.width, height: document.canvas.height },
    totalFrames,
    playTotalFrames: playCursor,
    chapters,
    autoChapters,
    chapterOf,
    main,
    overlays,
    overlayRowCount,
    voice,
    music,
    sfx,
    captions,
    cuts,
    snapFrames,
    hasUnresolved,
    mainById,
    overlayById,
  }
}

/** An automatic chapter's name (see `TimelineChapterTitle`). */
function autoChapterTitle(block: TimelineMainBlock, count: number): TimelineChapterTitle {
  if (count >= 3 && block.index === 0) return { kind: 'intro' }
  if (count >= 3 && block.index === count - 1) return { kind: 'outro' }
  if (block.label.kind === 'text') return { kind: 'text', text: block.label.text }
  if (block.picture) return { kind: 'media', storageObjectId: block.picture.storageObjectId, n: block.index + 1 }
  return { kind: 'scene', n: block.index + 1 }
}

/**
 * The chapter row: runs of the same section; a scene without a section joins the run before it (the first run when it
 * leads). Without any sectioned scene, one automatic chapter per scene.
 */
function chaptersOf(
  main: readonly TimelineMainBlock[],
  sections: CompositionDocument['sections'],
): { chapters: TimelineChapter[]; chapterOf: Map<string, number>; auto: boolean } {
  const chapters: TimelineChapter[] = []
  const chapterOf = new Map<string, number>()
  const auto = !main.some((block) => block.sectionId !== null)
  if (auto) {
    for (const block of main) {
      chapterOf.set(block.sceneId, chapters.length)
      chapters.push({
        key: `auto:${block.sceneId}`,
        index: chapters.length,
        sectionId: null,
        auto: true,
        title: autoChapterTitle(block, main.length),
        colorIndex: chapters.length,
        startFrame: block.startFrame,
        endFrame: block.endFrame,
        playStartFrame: block.playStartFrame,
        sceneIds: [block.sceneId],
      })
    }
    return { chapters, chapterOf, auto }
  }
  const order = new Map(sections.map((section, index) => [section.section_id, index]))
  const titles = new Map(sections.map((section) => [section.section_id, section.title]))
  const runs = new Map<string, number>()
  let leading: TimelineMainBlock[] = []
  for (const block of main) {
    const last = chapters[chapters.length - 1]
    if (block.sectionId === null || (last && last.sectionId === block.sectionId)) {
      if (!last) {
        leading.push(block)
        continue
      }
      last.endFrame = block.endFrame
      last.sceneIds.push(block.sceneId)
      chapterOf.set(block.sceneId, last.index)
      continue
    }
    const sectionId = block.sectionId
    const run = runs.get(sectionId) ?? 0
    runs.set(sectionId, run + 1)
    const first = leading[0] ?? block
    const chapter: TimelineChapter = {
      key: run === 0 ? `chapter:${sectionId}` : `chapter:${sectionId}#${run}`,
      index: chapters.length,
      sectionId,
      auto: false,
      title: { kind: 'section', text: titles.get(sectionId) ?? '' },
      colorIndex: order.get(sectionId) ?? chapters.length,
      startFrame: first.startFrame,
      endFrame: block.endFrame,
      playStartFrame: first.playStartFrame,
      sceneIds: [...leading.map((candidate) => candidate.sceneId), block.sceneId],
    }
    for (const sceneId of chapter.sceneIds) chapterOf.set(sceneId, chapter.index)
    chapters.push(chapter)
    leading = []
  }
  return { chapters, chapterOf, auto }
}

/** The chapter holding a scene (null for an unknown scene). */
export function chapterOfScene(model: Pick<TimelineModel, 'chapters' | 'chapterOf'>, sceneId: string): TimelineChapter | null {
  const index = model.chapterOf.get(sceneId)
  return index === undefined ? null : (model.chapters[index] ?? null)
}

/** Index of the main block holding a display frame (binary search; the last block holds the end). -1 when empty. */
export function mainIndexAtFrame(model: Pick<TimelineModel, 'main'>, frame: number): number {
  const { main } = model
  if (main.length === 0) return -1
  let low = 0
  let high = main.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (main[middle]!.startFrame <= frame) low = middle
    else high = middle - 1
  }
  return low
}

function playToDisplay(main: readonly TimelineMainBlock[], hasUnresolved: boolean, frame: number): number {
  if (!hasUnresolved || main.length === 0) return frame
  // The last block that starts at or before the frame on the play clock (play starts never decrease).
  let low = 0
  let high = main.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (main[middle]!.playStartFrame <= frame) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  // An unresolved block has no play length: the frame belongs to the resolved block before it (or is its end).
  let index = found
  while (index >= 0 && !main[index]!.resolved) index -= 1
  if (index < 0) return 0
  const block = main[index]!
  return block.startFrame + Math.min(Math.max(0, frame - block.playStartFrame), block.lengthFrames)
}

/** A playback (gateway timeline) frame on the display axis. */
export function playToDisplayFrame(model: Pick<TimelineModel, 'main' | 'hasUnresolved'>, frame: number): number {
  return playToDisplay(model.main, model.hasUnresolved, frame)
}

/** A display frame on the playback clock (inside an unresolved stand-in block: that block's play start). */
export function displayToPlayFrame(model: Pick<TimelineModel, 'main' | 'hasUnresolved'>, frame: number): number {
  if (!model.hasUnresolved) return frame
  const index = mainIndexAtFrame(model, frame)
  if (index < 0) return 0
  const block = model.main[index]!
  if (!block.resolved) return block.playStartFrame
  return block.playStartFrame + Math.min(Math.max(0, frame - block.startFrame), block.lengthFrames)
}

/** The overlay blocks of one row (index 0 = lowest). */
export function overlayRowsOf(model: Pick<TimelineModel, 'overlays' | 'overlayRowCount'>): TimelineOverlayBlock[][] {
  const rows: TimelineOverlayBlock[][] = Array.from({ length: model.overlayRowCount }, () => [])
  for (const block of model.overlays) rows[block.row]!.push(block)
  return rows
}

/** The overlays of one scene in paint order (bottom first). */
export function sceneOverlays(model: Pick<TimelineModel, 'overlays'>, sceneId: string): TimelineOverlayBlock[] {
  return model.overlays.filter((block) => block.sceneId === sceneId).sort((a, b) => a.zIndex - b.zIndex)
}

/** The cut nearest to a display frame (null with fewer than two blocks). */
export function nearestCut(model: Pick<TimelineModel, 'cuts'>, frame: number): TimelineCut | null {
  let best: TimelineCut | null = null
  for (const cut of model.cuts) if (!best || Math.abs(cut.frame - frame) < Math.abs(best.frame - frame)) best = cut
  return best
}
