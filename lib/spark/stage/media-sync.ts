import type { CompositionDocument } from '../composition-client'
import { nativeBasis, type LayerBasis } from './geometry'
import type { StageFps, StageMediaResolver, StageNativeLayer, StagePlan } from './stage-types'

/**
 * Footage and sound of the stage (D1, D2): video clips are not compilable into the Motion IR (the final render composites
 * them with FFmpeg), so the stage draws them with `<video>` elements inserted into the runtime's stage in PAINT ORDER, and
 * plays narration/music/sfx with `<audio>`. The timeline clock decides every element's time (`currentTime = source start
 * + frames since the clip start / fps`); an element is only re-seeked when it drifts, so playback stays smooth.
 *
 * The planners are pure; the DOM wiring uses a tiny port so the logic is tested without a media pipeline. Preview of video
 * approximates the final composite (no pixel parity claim for footage).
 */

export const VIDEO_DRIFT_SECONDS = 0.2
const MAX_LIVE_VIDEO = 2
const MAX_LIVE_AUDIO = 4

const dbToVolume = (gainDb: number) => Math.min(1, Math.max(0, 10 ** (gainDb / 20)))
const ticksToSeconds = (ticks: number, timebase: { num: number; den: number }) => (ticks * timebase.num) / timebase.den

// ---------------------------------------------------------------- planners

export type MediaSyncAction = {
  /** The element shows / may sound at this frame. */
  active: boolean
  /** Seek the element to this time (seconds) before anything else; null = leave it. */
  seekTo: number | null
  play: boolean
  pause: boolean
}

export function planVideoSync(input: {
  frame: number
  sceneStart: number
  fps: StageFps
  playing: boolean
  layer: Pick<StageNativeLayer, 'scene_range' | 'source_range' | 'source_timebase'>
  currentTime: number
  paused: boolean
}): MediaSyncAction {
  const local = input.frame - input.sceneStart
  const { scene_range: range, source_range: source, source_timebase: timebase } = input.layer
  if (local < range.start_frame || local >= range.end_frame) return { active: false, seekTo: null, play: false, pause: true }
  const fps = input.fps.num / input.fps.den
  const inSeconds = ticksToSeconds(source.in_tick, timebase)
  const outSeconds = ticksToSeconds(source.out_tick, timebase)
  const target = Math.min(Math.max(inSeconds + (local - range.start_frame) / fps, inSeconds), Math.max(inSeconds, outSeconds - 1 / fps))
  const drift = Math.abs(input.currentTime - target)
  if (!input.playing) {
    // Paused or scrubbing: show the exact frame, never play.
    return { active: true, seekTo: drift > 0.5 / fps ? target : null, play: false, pause: true }
  }
  return { active: true, seekTo: drift > VIDEO_DRIFT_SECONDS ? target : null, play: input.paused, pause: false }
}

export type AudioPlacementPlan = {
  placementId: string
  role: 'narration' | 'music' | 'sfx'
  storageObjectId: string
  /** Absolute project frames, end exclusive. */
  startFrame: number
  endFrame: number
  sourceInSeconds: number
  sourceOutSeconds: number
  gainDb: number
}

type Body = Record<string, unknown>

/** Audio placements of the working copy on the project timeline (scene-local ones are placed at their scene's start). */
export function audioPlacementPlans(document: CompositionDocument, plan: Pick<StagePlan, 'scenes'>): AudioPlacementPlan[] {
  const sceneStart = new Map(plan.scenes.map((scene) => [scene.sceneId, scene.startFrame]))
  const sources = new Map(document.source_media.map((source) => [source.source_id, source as Body]))
  const plans: AudioPlacementPlan[] = []
  for (const placement of document.audio.placements as Body[]) {
    const role = placement['role']
    if (role !== 'narration' && role !== 'music' && role !== 'sfx') continue
    const source = sources.get(String(placement['source_id']))
    const storage = (source?.['storage_object'] as Body | undefined)?.['storage_object_id']
    const timebase = (source?.['probe'] as Body | undefined)?.['timebase'] as { num: number; den: number } | undefined
    const sourceRange = placement['source_range'] as { in_tick: number; out_tick: number } | undefined
    if (typeof storage !== 'string' || !timebase || !sourceRange) continue
    let range: { start_frame: number; end_frame: number } | undefined
    let offset = 0
    if (placement['project_range']) range = placement['project_range'] as { start_frame: number; end_frame: number }
    else if (typeof placement['scene_id'] === 'string' && placement['scene_range']) {
      const start = sceneStart.get(placement['scene_id'])
      if (start === undefined) continue
      range = placement['scene_range'] as { start_frame: number; end_frame: number }
      offset = start
    }
    if (!range || range.end_frame <= range.start_frame) continue
    plans.push({
      placementId: String(placement['placement_id']),
      role,
      storageObjectId: storage,
      startFrame: offset + range.start_frame,
      endFrame: offset + range.end_frame,
      sourceInSeconds: ticksToSeconds(sourceRange.in_tick, timebase),
      sourceOutSeconds: ticksToSeconds(sourceRange.out_tick, timebase),
      gainDb: typeof placement['gain_db'] === 'number' ? placement['gain_db'] : 0,
    })
  }
  return plans
}

export function planAudioSync(input: {
  frame: number
  fps: StageFps
  playing: boolean
  placement: AudioPlacementPlan
  currentTime: number
  paused: boolean
}): MediaSyncAction & { volume: number } {
  const { placement } = input
  const volume = dbToVolume(placement.gainDb)
  // Sound only while the timeline plays; a paused or scrubbing timeline is silent.
  if (!input.playing || input.frame < placement.startFrame || input.frame >= placement.endFrame) {
    return { active: false, seekTo: null, play: false, pause: true, volume }
  }
  const fps = input.fps.num / input.fps.den
  const target = Math.min(placement.sourceInSeconds + (input.frame - placement.startFrame) / fps, placement.sourceOutSeconds)
  const drift = Math.abs(input.currentTime - target)
  return { active: true, seekTo: drift > VIDEO_DRIFT_SECONDS ? target : null, play: input.paused, pause: false, volume }
}

/** Audio placements that matter now: the active ones first (at most `limit`), so the live element budget is kept. */
export function activeAudioPlacements(plans: readonly AudioPlacementPlan[], frame: number, limit = MAX_LIVE_AUDIO): AudioPlacementPlan[] {
  return plans.filter((plan) => frame >= plan.startFrame && frame < plan.endFrame).slice(0, limit)
}

// ---------------------------------------------------------------- DOM wiring

/** The slice of a media element the layer drives (`HTMLVideoElement` / `HTMLAudioElement` fit; tests pass a fake). */
export interface MediaPort {
  currentTime: number
  readonly paused: boolean
  muted: boolean
  volume: number
  src: string
  readonly videoWidth: number
  readonly videoHeight: number
  play(): Promise<void> | void
  pause(): void
  remove(): void
}

export interface VideoPort extends MediaPort {
  /** The element placed into the runtime stage. */
  readonly element: HTMLElement
  onMetadata(listener: () => void): void
}

export type StageMediaFactory = {
  createVideo(doc: Document): VideoPort
  createAudio(doc: Document): MediaPort
}

export function browserMediaFactory(): StageMediaFactory {
  return {
    createVideo(doc) {
      const video = doc.createElement('video')
      video.preload = 'auto'
      video.playsInline = true
      video.style.width = '100%'
      video.style.height = '100%'
      video.style.display = 'block'
      video.style.objectFit = 'fill'
      const port: VideoPort = {
        get currentTime() {
          return video.currentTime
        },
        set currentTime(value: number) {
          video.currentTime = value
        },
        get paused() {
          return video.paused
        },
        get muted() {
          return video.muted
        },
        set muted(value: boolean) {
          video.muted = value
        },
        get volume() {
          return video.volume
        },
        set volume(value: number) {
          video.volume = value
        },
        get src() {
          return video.src
        },
        set src(value: string) {
          video.src = value
        },
        get videoWidth() {
          return video.videoWidth
        },
        get videoHeight() {
          return video.videoHeight
        },
        element: video,
        play: () => video.play(),
        pause: () => video.pause(),
        remove: () => {
          video.pause()
          video.removeAttribute('src')
          video.load()
          video.remove()
        },
        onMetadata: (listener) => video.addEventListener('loadedmetadata', listener, { once: true }),
      }
      return port
    },
    createAudio(doc) {
      const audio = doc.createElement('audio')
      audio.preload = 'auto'
      return {
        get currentTime() {
          return audio.currentTime
        },
        set currentTime(value: number) {
          audio.currentTime = value
        },
        get paused() {
          return audio.paused
        },
        get muted() {
          return audio.muted
        },
        set muted(value: boolean) {
          audio.muted = value
        },
        get volume() {
          return audio.volume
        },
        set volume(value: number) {
          audio.volume = value
        },
        get src() {
          return audio.src
        },
        set src(value: string) {
          audio.src = value
        },
        videoWidth: 0,
        videoHeight: 0,
        play: () => audio.play(),
        pause: () => audio.pause(),
        remove: () => {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
          audio.remove()
        },
      }
    },
  }
}

const swallow = (result: Promise<void> | void) => {
  if (result && typeof (result as Promise<void>).catch === 'function') (result as Promise<void>).catch(() => undefined)
}

type LiveVideo = { layer: StageNativeLayer; port: VideoPort; wrapper: HTMLElement; ready: boolean; basis: LayerBasis | null }

/** What `bindScene` places: the scene's stage, where it starts, its native layers and the runtime layers around them. */
export type MediaSceneInput = {
  stage: HTMLElement | null
  startFrame: number
  canvas: { width: number; height: number }
  nativeLayers: readonly StageNativeLayer[]
  runtimeLayers: ReadonlyArray<{ layerId: string; zIndex: number; element: HTMLElement | null }>
  transformOf: (layerId: string) => { x: number; y: number; scale: number; rotation_deg: number } | null
  /** Live FX: the scene's length (a partner picture holds its first / last frame outside it). */
  durationFrames?: number
}

/** The videos of one scene picture, kept while that picture stays on the stage (a role swap reuses them). */
type SceneBinding = { stage: HTMLElement; startFrame: number; durationFrames: number | null; key: string; videos: Map<string, LiveVideo> }

/**
 * Owns the `<video>` elements of the mounted scene (at most two alive) and the `<audio>` elements of the project (at
 * most four alive). `bindScene` places the videos in paint order; `sync` is called on every playback frame and on every
 * seek; `dispose` releases every element (the perf budget counts live media elements). Live FX: inside a transition blend
 * the other scene picture's videos are bound too (`bindScenes`, at most two more, paused on their held frame).
 */
export class StageMediaLayer {
  /** The videos of the scene that holds the frame (selection, hit-testing and sound follow these). */
  private primary: SceneBinding | null = null
  /** Live FX: the videos of the other picture of a transition blend; they hold their first / last frame, paused and silent. */
  private partnerBinding: SceneBinding | null = null
  private audio = new Map<string, { port: MediaPort; plan: AudioPlacementPlan }>()
  private audioPlans: AudioPlacementPlan[] = []
  private listeners = new Set<() => void>()

  private get videos(): Map<string, LiveVideo> {
    return this.primary?.videos ?? new Map()
  }

  constructor(
    private readonly options: {
      doc: Document
      media: StageMediaResolver
      fps: () => StageFps
      factory?: StageMediaFactory
    },
  ) {}

  private get factory(): StageMediaFactory {
    return (this.options.factory ??= browserMediaFactory())
  }

  /** A video's natural size became known (or a box changed): the selection overlay re-reads its geometry. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Places the scene's native (video) layers. `zIndexOf` gives a runtime layer's paint index so each video lands between
   * the right runtime layers; `runtimeLayers` are the IR layer ids in DOM order with their group elements.
   */
  bindScene(input: MediaSceneInput): void {
    this.bindScenes(input, null)
  }

  /**
   * Live FX: places the videos of the scene that holds the frame and of the other picture of a transition blend (`partner`,
   * null outside a blend). A picture already bound (the same stage element, the same native layers) keeps its `<video>`
   * elements, whatever its role: crossing the cut or entering a window never reloads footage.
   */
  bindScenes(primary: MediaSceneInput, partner: MediaSceneInput | null): void {
    const held = [this.primary, this.partnerBinding].filter((binding): binding is SceneBinding => binding !== null)
    const take = (input: MediaSceneInput | null): SceneBinding | null => {
      if (!input?.stage) return null
      const key = bindingKey(input)
      const index = held.findIndex((binding) => binding.stage === input.stage && binding.key === key)
      if (index < 0) return null
      const binding = held.splice(index, 1)[0]!
      binding.startFrame = input.startFrame
      binding.durationFrames = input.durationFrames ?? null
      return binding
    }
    const keptPrimary = take(primary)
    const keptPartner = take(partner)
    for (const binding of held) this.release(binding)
    this.primary = keptPrimary ?? (primary.stage ? this.createBinding(primary) : null)
    this.partnerBinding = keptPartner ?? (partner?.stage ? this.createBinding(partner) : null)
  }

  private createBinding(input: MediaSceneInput): SceneBinding {
    const stage = input.stage as HTMLElement
    const binding: SceneBinding = { stage, startFrame: input.startFrame, durationFrames: input.durationFrames ?? null, key: bindingKey(input), videos: new Map() }
    const layers = [...input.nativeLayers].sort((a, b) => a.z_index - b.z_index).slice(0, MAX_LIVE_VIDEO)
    for (const layer of layers) {
      const port = this.factory.createVideo(this.options.doc)
      port.src = this.options.media.playbackUrl(layer.storage_object_id)
      port.muted = layer.audio?.muted === true
      port.volume = dbToVolume(layer.audio?.gain_db ?? 0)
      const wrapper = this.options.doc.createElement('div')
      wrapper.setAttribute('data-native-layer', layer.layer_id)
      Object.assign(wrapper.style, { position: 'absolute', left: '0px', top: '0px', transformOrigin: '0 0', visibility: 'hidden', overflow: 'hidden' })
      wrapper.appendChild(port.element)
      const before = input.runtimeLayers.find((candidate) => candidate.zIndex > layer.z_index && candidate.element)?.element ?? null
      if (before && before.parentElement === stage) stage.insertBefore(wrapper, before)
      else stage.appendChild(wrapper)
      const live: LiveVideo = { layer, port, wrapper, ready: false, basis: null }
      const place = () => {
        const transform = input.transformOf(layer.layer_id)
        live.basis = nativeBasis(input.canvas, { width: port.videoWidth, height: port.videoHeight }, transform)
        Object.assign(wrapper.style, {
          left: `${live.basis.x}px`,
          top: `${live.basis.y}px`,
          width: `${live.basis.width}px`,
          height: `${live.basis.height}px`,
          transform: `scale(${live.basis.scale})`,
        })
        port.element.style.transform = live.basis.rotationDeg ? `rotate(${live.basis.rotationDeg}deg)` : ''
        live.ready = port.videoWidth > 0
        for (const listener of this.listeners) listener()
      }
      port.onMetadata(place)
      binding.videos.set(layer.layer_id, live)
    }
    return binding
  }

  /** Audio placements of the working copy (replaces the previous list; live elements follow on the next `sync`). */
  setAudio(plans: readonly AudioPlacementPlan[]): void {
    this.audioPlans = [...plans]
    for (const [id, live] of this.audio) {
      if (!this.audioPlans.some((plan) => plan.placementId === id)) {
        live.port.remove()
        this.audio.delete(id)
      }
    }
  }

  /** The natural box a native layer occupies (for selection and hit-testing); null until its size is known. */
  basisOf(layerId: string): LayerBasis | null {
    const live = this.videos.get(layerId)
    return live?.ready ? live.basis : null
  }

  nativeLayerIds(): string[] {
    return [...this.videos.keys()]
  }

  /** Whether the layer's `<video>` is showing at the last synced frame. */
  isShowing(layerId: string): boolean {
    return this.videos.get(layerId)?.wrapper.style.visibility === 'visible'
  }

  liveCounts(): { video: number; audio: number } {
    return { video: this.videos.size + (this.partnerBinding?.videos.size ?? 0), audio: this.audio.size }
  }

  sync(frame: number, playing: boolean): void {
    const fps = this.options.fps()
    if (this.primary) this.syncVideos(this.primary, frame, playing, fps)
    if (this.partnerBinding) {
      // The other picture of a blend holds its first frame (before it starts) or its last (after it ends), paused.
      const binding = this.partnerBinding
      const last = Math.max(0, (binding.durationFrames ?? 1) - 1)
      const held = binding.startFrame + Math.min(Math.max(0, frame - binding.startFrame), last)
      this.syncVideos(binding, held, false, fps)
    }
    const wanted = activeAudioPlacements(this.audioPlans, frame)
    for (const [id, live] of this.audio) {
      if (!wanted.some((plan) => plan.placementId === id)) {
        live.port.pause()
        if (!playing) {
          live.port.remove()
          this.audio.delete(id)
        }
      }
    }
    for (const plan of wanted) {
      let live = this.audio.get(plan.placementId)
      if (!live && playing) {
        const port = this.factory.createAudio(this.options.doc)
        port.src = this.options.media.playbackUrl(plan.storageObjectId)
        live = { port, plan }
        this.audio.set(plan.placementId, live)
      }
      if (!live) continue
      live.plan = plan
      const action = planAudioSync({ frame, fps, playing, placement: plan, currentTime: live.port.currentTime, paused: live.port.paused })
      live.port.volume = action.volume
      if (action.seekTo !== null) live.port.currentTime = action.seekTo
      if (action.play) swallow(live.port.play())
      else if (action.pause && !live.port.paused) live.port.pause()
    }
  }

  private syncVideos(binding: SceneBinding, frame: number, playing: boolean, fps: StageFps): void {
    for (const live of binding.videos.values()) {
      const action = planVideoSync({ frame, sceneStart: binding.startFrame, fps, playing, layer: live.layer, currentTime: live.port.currentTime, paused: live.port.paused })
      live.wrapper.style.visibility = action.active && live.ready ? 'visible' : 'hidden'
      if (action.seekTo !== null) live.port.currentTime = action.seekTo
      if (action.play) swallow(live.port.play())
      else if (action.pause && !live.port.paused) live.port.pause()
    }
  }

  pauseAll(): void {
    for (const live of this.videos.values()) if (!live.port.paused) live.port.pause()
    for (const live of this.partnerBinding?.videos.values() ?? []) if (!live.port.paused) live.port.pause()
    for (const live of this.audio.values()) if (!live.port.paused) live.port.pause()
  }

  dispose(): void {
    this.releaseVideos()
    for (const live of this.audio.values()) live.port.remove()
    this.audio.clear()
    this.listeners.clear()
  }

  private releaseVideos(): void {
    if (this.primary) this.release(this.primary)
    if (this.partnerBinding) this.release(this.partnerBinding)
    this.primary = null
    this.partnerBinding = null
  }

  private release(binding: SceneBinding): void {
    for (const live of binding.videos.values()) {
      live.port.remove()
      live.wrapper.remove()
    }
    binding.videos.clear()
  }
}

/** Identity of what a binding placed: the native layers and the transforms they were placed with. */
function bindingKey(input: MediaSceneInput): string {
  return JSON.stringify(input.nativeLayers.map((layer) => [layer, input.transformOf(layer.layer_id)]))
}
