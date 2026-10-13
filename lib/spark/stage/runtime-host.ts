import type { MotionRuntimeLike, MotionRuntimeModule, RuntimeDescribeNode } from './runtime-api'
import type { StageRect, StageSceneBundle } from './stage-types'
import { segmentRefuses } from './transition-blend'

/**
 * The runtime host (D1): mounts the pinned `motion-runtime` on a server-compiled scene IR (`mode: 'preview'`, seek-only)
 * inside the stage frame, keeps ONE scene mounted plus at most one warmed next scene, and answers the read questions the
 * editor asks the picture: where a layer is at a frame (`inspect`) and which layers are under a point (`hitTest`). The
 * host adds no layout and no timing: a frame is exactly `runtime.seek(frame)`.
 */

export class StageMountError extends Error {
  constructor(readonly code: 'runtime_version_mismatch' | 'ir_refused', message: string) {
    super(message)
    this.name = 'StageMountError'
  }
}

/** Natural geometry of a layer as the compiler placed it (canvas px; `scale` is the transform scale about top-left). */
export type LayerNaturalBox = { x: number; y: number; width: number; height: number; scale: number }

export type LayerHandles = { group: string; content: string | null }

export interface MountedScene {
  readonly sceneId: string
  readonly dependencyHash: string
  readonly bundle: StageSceneBundle
  /** `.scene-root` wrapper (canvas-sized, scaled to the frame). */
  readonly element: HTMLElement
  /** The runtime's own stage element; native (video) layers are inserted into it in paint order. */
  readonly stage: HTMLElement | null
  readonly canvas: { width: number; height: number }
  readonly durationFrames: number
  /**
   * Live FX: frames the scene was asked to be mounted PAST its own end (the incoming side of a blend that leaves it): `seek`
   * reaches `durationFrames + tail - 1`, where the scene holds its end state like the transition segment's sheet. 0 = none.
   * (A picture whose IR drives a camera is not extended - its camera plan reads the document length - and holds its last
   * frame instead; the transition segment refuses such a scene anyway.)
   */
  readonly tail: number
  seek(localFrame: number): void
  /** Layer ids the runtime drew, in DOM (paint) order. */
  layerIds(): string[]
  /** The layer's natural box from the IR, or null when the runtime does not draw the layer. */
  naturalBox(layerId: string): LayerNaturalBox | null
  groupElement(layerId: string): HTMLElement | null
  /** Current canvas-px bounds of the layer's drawn content at `localFrame` (follows animations and rotation). */
  contentBounds(layerId: string, localFrame: number): (StageRect & { visible: boolean }) | null
  /** Layer ids under a canvas-px point at `localFrame`, topmost first. */
  hitTest(localFrame: number, point: { x: number; y: number }): string[]
  show(visible: boolean): void
  dispose(): void
}

type IrNode = { handle?: string; role?: string; kind?: string; box?: { x: number; y: number; width: number; height: number }; props?: Record<string, unknown>; children?: IrNode[] }

const CONTENT_SUFFIX = '.content'

function indexRoles(nodes: RuntimeDescribeNode[]): Map<string, LayerHandles> {
  const layers = new Map<string, LayerHandles>()
  for (const node of nodes) {
    if (node.kind !== 'group') continue
    const content = node.children.find((child) => child.role === `${node.role}${CONTENT_SUFFIX}`) ?? null
    layers.set(node.role, { group: node.handle, content: content?.handle ?? null })
  }
  return layers
}

function naturalBoxes(ir: unknown): Map<string, LayerNaturalBox> {
  const boxes = new Map<string, LayerNaturalBox>()
  const nodes = (ir as { nodes?: IrNode[] }).nodes ?? []
  for (const node of nodes) {
    if (node.kind !== 'group' || !node.role || !node.box) continue
    const scale = typeof node.props?.['scale'] === 'number' ? node.props['scale'] : 1
    boxes.set(node.role, { x: node.box.x, y: node.box.y, width: node.box.width, height: node.box.height, scale })
  }
  return boxes
}

function mount(module: MotionRuntimeModule, bundle: StageSceneBundle, root: HTMLElement, expectedVersion: string | null, tail = 0): MountedScene {
  if (expectedVersion !== null && module.MOTION_RUNTIME_VERSION !== expectedVersion) {
    throw new StageMountError(
      'runtime_version_mismatch',
      `The preview was compiled for motion-runtime ${expectedVersion}, the page loaded ${module.MOTION_RUNTIME_VERSION}.`,
    )
  }
  const rawCanvas = (bundle.ir as { canvas?: { width?: unknown; height?: unknown } }).canvas
  if (!rawCanvas || typeof rawCanvas.width !== 'number' || typeof rawCanvas.height !== 'number') {
    throw new StageMountError('ir_refused', 'The scene IR has no canvas.')
  }
  const canvas = { width: rawCanvas.width, height: rawCanvas.height }
  const element = root.ownerDocument.createElement('div')
  element.className = 'scene-root'
  element.setAttribute('data-scene-id', bundle.sceneId)
  Object.assign(element.style, { width: `${canvas.width}px`, height: `${canvas.height}px`, transformOrigin: '0 0', position: 'absolute', left: '0px', top: '0px' })
  root.appendChild(element)
  const runtime: MotionRuntimeLike = module.createMotionRuntime()
  let durationFrames: number
  // Live FX: a scene a blend leaves is mounted with its end extended by the blend's incoming frames (nothing else of the IR
  // changes, so every frame of the scene itself draws exactly as before).
  const extendable = tail > 0 && typeof bundle.ir['duration_frames'] === 'number' && !segmentRefuses(bundle.ir)
  const extended = extendable ? { ...bundle.ir, duration_frames: (bundle.ir['duration_frames'] as number) + tail } : bundle.ir
  const mountedTail = extended === bundle.ir ? 0 : tail
  try {
    durationFrames = runtime.init(extended, {}, bundle.assets, { mode: 'preview', container: element }).duration_frames - mountedTail
  } catch (error) {
    runtime.dispose()
    element.remove()
    throw new StageMountError('ir_refused', error instanceof Error ? error.message : 'The scene could not be drawn.')
  }
  const roles = indexRoles(runtime.describe().nodes)
  const boxes = naturalBoxes(bundle.ir)
  const stage = element.querySelector<HTMLElement>('[data-motion-stage]')
  let disposed = false

  const clampFrame = (frame: number) => Math.min(Math.max(0, Math.round(frame)), Math.max(0, durationFrames + mountedTail - 1))
  const layerOfRole = (role: string): string | null => {
    const id = role.endsWith(CONTENT_SUFFIX) ? role.slice(0, -CONTENT_SUFFIX.length) : role
    return roles.has(id) ? id : null
  }

  return {
    sceneId: bundle.sceneId,
    dependencyHash: bundle.dependencyHash,
    bundle,
    element,
    stage,
    canvas,
    durationFrames,
    tail,
    seek(localFrame) {
      if (!disposed) runtime.seek(clampFrame(localFrame))
    },
    layerIds: () => [...roles.keys()],
    naturalBox: (layerId) => boxes.get(layerId) ?? null,
    groupElement(layerId) {
      const handles = roles.get(layerId)
      return handles ? (element.querySelector<HTMLElement>(`[data-handle="${handles.group}"]`) ?? null) : null
    },
    contentBounds(layerId, localFrame) {
      const handles = roles.get(layerId)
      if (!handles || disposed) return null
      const target = handles.content ?? handles.group
      const [inspection] = runtime.inspect([target], clampFrame(localFrame))
      if (!inspection) return null
      const { x, y, width, height } = inspection.box.canvas
      return { x, y, width, height, visible: inspection.visible }
    },
    hitTest(localFrame, point) {
      if (disposed) return []
      const nx = point.x / canvas.width
      const ny = point.y / canvas.height
      if (!(nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1)) return []
      const hits = runtime.hitTest(clampFrame(localFrame), { point: { x: nx, y: ny } })
      const ids: string[] = []
      for (const hit of hits) {
        const id = layerOfRole(hit.role)
        if (id !== null && !ids.includes(id)) ids.push(id)
      }
      return ids
    },
    show(visible) {
      element.style.visibility = visible ? 'visible' : 'hidden'
    },
    dispose() {
      if (disposed) return
      disposed = true
      runtime.dispose()
      element.remove()
    },
  }
}

/**
 * One mounted scene plus at most one warmed next scene. `activate` swaps scenes without a blank frame (the warmed scene
 * is already drawn, the old one is disposed after the swap); `warm` prepares the next scene while the current plays.
 *
 * Live FX: during a transition blend a second scene is shown beside the current one (`partner`, visible, drawn with the blend
 * look by the presenter). The current, the partner and the warmed scene are reused by identity (scene, hash, tail) when they
 * change roles: crossing the cut swaps current and partner without mounting anything.
 */
export class SceneRuntimePool {
  private currentScene: MountedScene | null = null
  private partnerScene: MountedScene | null = null
  private warmScene: MountedScene | null = null
  private dip: HTMLElement | null = null
  private scale = 1

  constructor(
    private readonly module: MotionRuntimeModule,
    private readonly root: HTMLElement,
    private readonly expectedVersion: string | null = null,
  ) {}

  get current(): MountedScene | null {
    return this.currentScene
  }

  /** Live FX: the second scene of the blend on the stage, or null. */
  get partner(): MountedScene | null {
    return this.partnerScene
  }

  /** CSS scale of every scene wrapper (frame width / canvas width). */
  setScale(scale: number): void {
    this.scale = scale
    for (const scene of [this.currentScene, this.partnerScene, this.warmScene]) if (scene) scene.element.style.transform = `scale(${scale})`
  }

  /**
   * `force` (E1-N): draw `bundle` fresh even when a scene with the same id and hash is mounted (the server's IR replaces a local one).
   * `tail` (live FX): frames the scene is mounted past its end. `partner` (live FX): the second scene of a blend, shown beside
   * the current one; without it the stage shows the current scene alone (a partner left over is disposed).
   */
  activate(bundle: StageSceneBundle, options: { force?: boolean; tail?: number; partner?: { bundle: StageSceneBundle; tail?: number } | null } = {}): MountedScene {
    const tail = options.tail ?? 0
    const held = [this.currentScene, this.partnerScene, this.warmScene].filter((scene): scene is MountedScene => scene !== null)
    const take = (wanted: StageSceneBundle, wantedTail: number, force: boolean): MountedScene => {
      if (!force) {
        const index = held.findIndex((scene) => scene.sceneId === wanted.sceneId && scene.dependencyHash === wanted.dependencyHash && scene.tail === wantedTail)
        if (index >= 0) return held.splice(index, 1)[0]!
      }
      return this.mountScene(wanted, wantedTail)
    }
    const before = new Set(held)
    const next = take(bundle, tail, options.force === true)
    let partner: MountedScene | null = null
    try {
      partner = options.partner ? take(options.partner.bundle, options.partner.tail ?? 0, false) : null
    } catch (error) {
      // Nothing changes on the stage when the partner cannot be drawn; a scene mounted for this call is taken down again.
      if (!before.has(next)) next.dispose()
      throw error
    }
    next.show(true)
    partner?.show(true)
    const warm = this.warmScene && held.includes(this.warmScene) ? this.warmScene : null
    for (const scene of held) if (scene !== warm) scene.dispose()
    this.currentScene = next
    this.partnerScene = partner
    this.warmScene = warm
    if (!partner && this.dip) this.dip.style.display = 'none'
    return next
  }

  /** Mounts the scene hidden so a later `activate` of it is instant; replaces an older warmed scene. */
  warm(bundle: StageSceneBundle, tail = 0): void {
    const same = (scene: MountedScene | null) => scene?.sceneId === bundle.sceneId && scene.dependencyHash === bundle.dependencyHash && scene.tail === tail
    if (same(this.currentScene) || same(this.partnerScene) || same(this.warmScene)) return
    this.warmScene?.dispose()
    this.warmScene = null
    try {
      const warmed = this.mountScene(bundle, tail)
      warmed.show(false)
      this.warmScene = warmed
    } catch {
      // A scene that cannot be drawn surfaces when it is activated; warming never breaks the playing scene.
    }
  }

  /** Live FX: the colour layer of a `dip_to_color` blend (one element over the frame, hidden while no blend draws it). */
  dipElement(): HTMLElement {
    if (!this.dip) {
      const dip = this.root.ownerDocument.createElement('div')
      dip.className = 'scene-dip'
      dip.setAttribute('aria-hidden', 'true')
      Object.assign(dip.style, { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%', pointerEvents: 'none', display: 'none' })
      this.root.appendChild(dip)
      this.dip = dip
    }
    return this.dip
  }

  dispose(): void {
    this.currentScene?.dispose()
    this.partnerScene?.dispose()
    this.warmScene?.dispose()
    this.dip?.remove()
    this.currentScene = null
    this.partnerScene = null
    this.warmScene = null
    this.dip = null
  }

  private mountScene(bundle: StageSceneBundle, tail = 0): MountedScene {
    const scene = mount(this.module, bundle, this.root, this.expectedVersion, tail)
    scene.element.style.transform = `scale(${this.scale})`
    return scene
  }
}
