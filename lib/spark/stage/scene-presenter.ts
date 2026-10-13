import { SceneBundleCache } from './scene-cache'
import { nextScene, presentationAtFrame, sceneAtFrame, transitionBundleId, transitionInto, transitionKey, type Presentation } from './scene-plan'
import { SceneRuntimePool, StageMountError, type MountedScene } from './runtime-host'
import type { MotionRuntimeModule } from './runtime-api'
import { StageSceneMismatchError, type StageIssue, type StagePlan, type StagePlanScene, type StagePreviewSource, type StageSceneBundle } from './stage-types'
import { applyBlendFrame, blendAt, blendTailOf, clearBlendLook, segmentRefuses, type BlendLook, type PreviewOnly } from './transition-blend'
import { holdTransitionAnimations, type TransitionHold } from './transition-animation-hold'

/**
 * The scene presenter: turns "show frame N" into a mounted, seeked scene. It syncs the preview plan of a working copy
 * version, loads a scene's compiled IR lazily through an LRU (prefetching the next scene while one plays), waits for the
 * scene's pinned fonts (the first frame never draws with a fallback), and swaps scenes without a blank frame. Late answers
 * never replace newer ones. It draws nothing itself; the pool mounts the pinned runtime.
 *
 * Live FX (`SPARK_LIVE_FX_PREVIEW_ENABLED`): inside the window of a BLEND transition (`StagePlanTransition.blend`) the stage
 * shows both scene pictures - the scene that holds the frame as the current scene, the other one as the pool's partner - each
 * at its own frame, and writes the blend look of that frame onto them (`transition-blend.ts`). Playing, scrubbing and
 * stepping through the window are seeks of the two mounted pictures plus a few style writes; no load, no state change,
 * nothing for React, until the playhead crosses the cut (the holder changes) or leaves the window.
 */

export type PresenterErrorCode = 'runtime_unavailable' | 'preview_unavailable' | 'font_unavailable' | 'scene_failed' | 'runtime_mismatch'

export type PresenterState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: { code: PresenterErrorCode; message: string } | null
  plan: StagePlan | null
  /** Scene the stage shows (the mounted one, or the one being loaded). */
  sceneId: string | null
  sceneStatus: 'loading' | 'ready' | 'partial' | 'unavailable' | 'failed'
  issues: StageIssue[]
  /**
   * E1-L: the stage shows a transition segment (the blend of two scenes) at the playhead instead of one scene; nothing in it
   * can be selected (`sceneId` still names the scene that holds the frame). null or absent = a scene.
   * Live FX: also while a blend is on screen; `previewOnly` says what the export cannot render of it (the stage's badge).
   */
  transition?: { toSceneId: string; kind: string; blend?: boolean; previewOnly?: PreviewOnly | null } | null
}

const INITIAL: PresenterState = { status: 'idle', error: null, plan: null, sceneId: null, sceneStatus: 'loading', issues: [], transition: null }

/** Timeline v3: what one picture of a blend holds inside its window (null: nothing). */
function holdOf(at: Extract<Presentation, { kind: 'blend' }>, side: 'from' | 'to'): TransitionHold | null {
  return at.transition.blend?.holds?.[side] ?? null
}
/** Cache key of a loaded bundle: the hash it was actually compiled at, which can be newer than the plan's. */
const bundleKey = (bundle: StageSceneBundle) => SceneBundleCache.key(bundle.sceneId, bundle.dependencyHash)

export class ScenePresenter {
  private state: PresenterState = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly presented = new Set<(scene: MountedScene | null) => void>()
  private readonly cache = new SceneBundleCache<StageSceneBundle>()
  private pool: SceneRuntimePool | null = null
  private module: MotionRuntimeModule | null = null
  private moduleRequest: Promise<MotionRuntimeModule> | null = null
  /** E1-L: transitions the gateway could not draw (or that failed to load) for the plan in hand: shown as cuts, not retried per frame. */
  private readonly failedTransitions = new Set<string>()
  private readonly transitionIssues = new Map<string, { issue: StageIssue; fromSceneId: string }>()
  private root: HTMLElement | null = null
  private scale = 1
  private token = 0
  private disposed = false
  /**
   * WP1: scenes of a LOCAL plan whose picture could not be the one asked for (the server moved on, or content only the browser
   * has could not be compiled): plan scene key -> hash of the picture shown instead. Bound to that plan object; a new plan
   * starts empty. Scrubbing over such a scene seeks the picture shown instead of loading it again on every frame.
   */
  private substitutes: { plan: StagePlan; byKey: Map<string, string> } | null = null
  /** The last outdated local plan reported (scene, asked hash, hash the server has): reported once, never in a loop. */
  private lastOutdated: string | null = null
  /** Live FX: a blend look is on the mounted pictures (taken off when the stage shows one scene again). */
  private blendShown = false
  /** Live FX: the look drawn on the CURRENT scene's picture by the blend on screen (null: it is drawn as itself). */
  private currentLook: BlendLook | null = null
  /**
   * Timeline v3: a scene picture held for a blend window (its exit / entry animations not played, `transition-animation-hold.ts`),
   * by the bundle it was made from and the hold; and the bundle each held picture was made from. Same object in, same object
   * out, so a mounted picture is recognised by identity.
   */
  private readonly heldBundles = new WeakMap<StageSceneBundle, Map<string, StageSceneBundle>>()
  private readonly heldBase = new WeakMap<StageSceneBundle, StageSceneBundle>()

  constructor(
    private readonly options: {
      source: StagePreviewSource
      loadRuntime: () => Promise<MotionRuntimeModule>
      /**
       * WP1: the plan on the stage asks for a scene picture the source does not have (the server moved on to another one,
       * or content only the browser had could not be compiled). The owner reads the server's plan again (and plans its own
       * copy on top of it); the presenter never swaps a local plan for a server one by itself. Reported once per scene,
       * asked hash and answer. Without an owner callback a SERVER plan is re-read here (Y1R-EDITOR-6).
       */
      onPlanOutdated?: () => void
    },
  ) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** Called after a scene is mounted (or unmounted, `null`): the overlay, media and selection follow it. */
  onPresented(listener: (scene: MountedScene | null) => void): () => void {
    this.presented.add(listener)
    return () => this.presented.delete(listener)
  }

  get current(): MountedScene | null {
    return this.pool?.current ?? null
  }

  /** Live FX: the second scene picture of the blend on the stage (null outside a blend window). */
  get partner(): MountedScene | null {
    return this.pool?.partner ?? null
  }

  /**
   * Live FX: where the blend on screen draws the current scene's picture (offset and scale about the canvas centre), so the
   * selection box and hit-testing follow a layer of a picture that slides, pushes or zooms. null outside a blend.
   */
  get currentBlendLook(): BlendLook | null {
    return this.currentLook
  }

  get plan(): StagePlan | null {
    return this.state.plan
  }

  attach(root: HTMLElement): void {
    this.root = root
    this.pool?.dispose()
    this.pool = null
    if (this.module) this.createPool(this.module)
  }

  detach(): void {
    this.pool?.dispose()
    this.pool = null
    this.root = null
  }

  setScale(scale: number): void {
    this.scale = scale
    this.pool?.setScale(scale)
  }

  dispose(): void {
    this.disposed = true
    this.token += 1
    this.pool?.dispose()
    this.pool = null
    this.cache.clear()
    this.options.source.dispose()
    this.listeners.clear()
    this.presented.clear()
  }

  /**
   * Reads the preview plan of a working copy version and draws it from the next `show` (scenes whose hash changed reload).
   * WP1: a plan of the editor's own copy (`origin: 'local'`) on the stage is not replaced: the plan is returned and the owner
   * decides (`adopt` or a new local plan); a server plan is never assumed to be newer than the editor's own copy.
   */
  async sync(workingCopyVersion: number): Promise<StagePlan | null> {
    const plan = await this.readPlan(workingCopyVersion)
    if (!plan) return null
    if (this.state.plan?.origin !== 'local') this.adopt(plan)
    return plan
  }

  /**
   * Reads the server's plan of a working copy version WITHOUT drawing it. `quiet` (a background check): a failed read leaves
   * the state alone instead of reporting the preview as unreadable.
   */
  async readPlan(workingCopyVersion: number, options: { quiet?: boolean } = {}): Promise<StagePlan | null> {
    if (!options.quiet) this.set({ ...this.state, status: this.state.plan ? this.state.status : 'loading' })
    try {
      const plan = await this.options.source.sync(workingCopyVersion)
      return this.disposed ? null : plan
    } catch {
      if (this.disposed) return null
      if (!options.quiet) this.set({ ...this.state, status: this.state.plan ? 'ready' : 'error', error: { code: 'preview_unavailable', message: 'The preview could not be read.' } })
      return null
    }
  }

  /** Draws a server plan (read with `readPlan`) from the next `show`. */
  adopt(plan: StagePlan): void {
    if (this.disposed) return
    // A new plan may draw what the last one could not (the transition changed): start from no failures.
    this.failedTransitions.clear()
    this.transitionIssues.clear()
    this.set({ ...this.state, status: 'ready', error: null, plan })
  }

  /**
   * E1-N: draws `plan` (the plan of the editor's own copy of the document) instead of reading the server's. Scenes whose
   * hash is not cached are compiled by the source's local preview (`loadScene` with the hash); the next `sync()` replaces
   * the plan with the server's again.
   */
  usePlan(plan: StagePlan): void {
    if (this.disposed) return
    this.set({ ...this.state, status: 'ready', error: null, plan })
  }

  /**
   * E1-N: the server's IR for a hash the browser had drawn itself differs from what was drawn: the server's replaces it
   * (cache and, when the scene is on the stage, the mounted picture).
   */
  replaceBundle(bundle: StageSceneBundle): void {
    if (this.disposed) return
    this.cache.replace(SceneBundleCache.key(bundle.sceneId, bundle.dependencyHash), bundle)
    const current = this.pool?.current
    if (!this.pool || !current || current.sceneId !== bundle.sceneId || current.dependencyHash !== bundle.dependencyHash) return
    const mounted = this.pool.activate(bundle, { force: true, tail: current.tail })
    mounted.seek(this.currentLocalFrame)
    for (const listener of [...this.presented]) listener(mounted)
  }

  private currentLocalFrame = 0

  /** Fast path while playing or scrubbing inside the mounted scene: a seek, no load. */
  seek(frame: number): boolean {
    const plan = this.state.plan
    const current = this.pool?.current
    if (!plan || !current) return false
    const at = presentationAtFrame(plan, frame, this.failedTransitions)
    if (!at) return false
    if (at.kind === 'blend') {
      // Live FX: both pictures of this blend must be on the stage (held for the window), the holder as the current scene.
      const partner = this.pool?.partner
      const holder = at.holder === 'from' ? at.from : at.scene
      const other = at.holder === 'from' ? at.scene : at.from
      const otherSide = at.holder === 'from' ? 'to' : 'from'
      if (!partner || !this.shows(plan, holder, current, holdOf(at, at.holder)) || !this.shows(plan, other, partner, holdOf(at, otherSide))) return false
      this.currentLocalFrame = at.localFrame
      this.drawBlend(at)
      return true
    }
    // Leaving a blend: the partner and the look go (`show`).
    if (this.pool?.partner) return false
    if (at.kind === 'transition') {
      // E1-L: inside a window the mounted unit must be that transition's segment (a scene mounted for the frame before it is not).
      if (current.sceneId !== transitionBundleId(at.transition.toSceneId) || current.dependencyHash !== at.transition.dependencyHash) return false
    } else if (at.scene.sceneId !== current.sceneId || (at.scene.dependencyHash !== current.dependencyHash && this.substituteOf(plan, at.scene) !== current.dependencyHash)) {
      return false
    }
    this.currentLocalFrame = at.localFrame
    current.seek(at.localFrame)
    return true
  }

  /** Loads, mounts and seeks the scene that holds `frame`. Resolves with the mounted scene, or null when nothing is shown. */
  async show(frame: number): Promise<MountedScene | null> {
    const plan = this.state.plan
    if (!plan) return null
    const at = presentationAtFrame(plan, frame, this.failedTransitions)
    if (!at) {
      this.unmount()
      return null
    }
    const token = ++this.token
    if (at.kind === 'blend') return this.showBlend(plan, at, token)
    // E1-L: inside a transition window the stage shows the segment, but the SCENE that holds the frame stays the one the editor
    // selects in, shows warnings for and reports (the segment has nothing selectable).
    const scene = at.kind === 'transition' ? sceneAtFrame(plan, frame)!.scene : at.scene
    const transition = at.kind === 'transition' ? { toSceneId: at.transition.toSceneId, kind: at.transition.kind } : null
    this.set({ ...this.state, sceneId: scene.sceneId, sceneStatus: scene.status === 'unavailable' ? 'unavailable' : 'loading', issues: this.issuesOf(scene), transition })
    if (scene.status === 'unavailable') {
      this.unmount()
      return null
    }
    try {
      const runtime = await this.runtime()
      if (token !== this.token) return null
      let bundle: StageSceneBundle
      if (at.kind === 'transition') {
        try {
          bundle = await this.loadTransitionBundle(at)
        } catch (error) {
          if (token !== this.token) return null
          // The gateway cannot draw it (or it could not be read): the boundary plays as a cut, and the editor says so.
          this.failedTransitions.add(transitionKey(at.transition))
          this.transitionIssues.set(at.transition.toSceneId, {
            issue: {
              code: 'transition_unavailable',
              message: error instanceof Error && error.message ? error.message : 'The transition cannot be previewed; the boundary is shown as a cut.',
              sceneId: at.transition.toSceneId,
            },
            fromSceneId: at.transition.fromSceneId,
          })
          return this.show(frame)
        }
      } else {
        const loaded = await this.sceneBundle(plan, scene)
        if (token !== this.token) return null
        if (loaded === 'keep') {
          // WP1: the picture asked for is not available (yet): the one on the stage stays, nothing is unmounted or swapped.
          const kept = this.pool?.current
          if (!kept || kept.sceneId !== scene.sceneId) return null
          // Live FX: a blend that was on screen ends here (the partner goes, the picture is drawn as itself).
          if (this.pool?.partner) this.pool.activate(kept.bundle, { tail: kept.tail })
          this.endBlendLook(kept)
          this.currentLocalFrame = at.localFrame
          kept.seek(at.localFrame)
          this.set({ ...this.state, sceneId: scene.sceneId, sceneStatus: scene.status === 'partial' ? 'partial' : 'ready', issues: [...this.issuesOf(scene), ...kept.bundle.warnings], transition })
          return kept
        }
        bundle = loaded
        await this.options.source.ensureFonts(bundle)
      }
      if (token !== this.token) return null
      if (!this.pool) this.createPool(runtime, plan.runtimeVersion)
      // Live FX: a scene a blend leaves is mounted with that blend's tail now, so the window opens without a remount.
      const mounted = this.pool!.activate(bundle, at.kind === 'scene' ? { tail: blendTailOf(plan, at.index) } : {})
      this.endBlendLook(mounted)
      this.currentLocalFrame = at.localFrame
      mounted.seek(at.localFrame)
      const issues = this.issuesOf(scene)
      // A transition the stage showed as a cut makes the scene partial too (the editor's warning pill says so).
      const cutTransition = issues.length > scene.warnings.length
      this.set({ ...this.state, sceneId: scene.sceneId, sceneStatus: scene.status === 'partial' || cutTransition ? 'partial' : 'ready', issues: [...issues, ...bundle.warnings], transition })
      for (const listener of [...this.presented]) listener(mounted)
      this.prefetch(plan, at)
      // Y1R-EDITOR-6: the scene moved on after this server plan was read (the source re-read the manifest): take the newer
      // plan. WP1: never for a plan of the editor's own copy (its owner re-plans on top of the newer server plan), and never
      // over a plan that replaced this one meanwhile. An owner that reads plans itself (the stage) is asked to do it, so it
      // knows which server version drew what.
      if (at.kind === 'scene' && bundle.dependencyHash !== scene.dependencyHash && plan.origin !== 'local' && this.state.plan === plan) {
        if (this.options.onPlanOutdated) this.reportOutdated(`${scene.sceneId}\u0000${scene.dependencyHash}\u0000${bundle.dependencyHash}`)
        else void this.sync(plan.workingCopyVersion)
      }
      return mounted
    } catch (error) {
      if (token !== this.token) return null
      this.unmount()
      const mismatch = error instanceof StageMountError && error.code === 'runtime_version_mismatch'
      const runtimeMissing = this.module === null
      const fontFailed = error instanceof Error && error.name === 'StageFontLoadError'
      this.set({
        ...this.state,
        sceneStatus: 'failed',
        error: {
          code: mismatch ? 'runtime_mismatch' : runtimeMissing ? 'runtime_unavailable' : fontFailed ? 'font_unavailable' : 'scene_failed',
          message: error instanceof Error ? error.message : 'The scene could not be shown.',
        },
      })
      return null
    }
  }

  /**
   * Whether a mounted picture is the plan scene's (its hash, or the picture shown in its place) with the tail the plan gives it,
   * held as `hold` says (timeline v3: a blend's pictures are held for the window; a held picture is never the scene itself).
   */
  private shows(plan: StagePlan, scene: StagePlanScene, mounted: MountedScene, hold: TransitionHold | null = null): boolean {
    if (mounted.sceneId !== scene.sceneId) return false
    const base = this.heldBase.get(mounted.bundle) ?? mounted.bundle
    if (base.dependencyHash !== scene.dependencyHash && this.substituteOf(plan, scene) !== base.dependencyHash) return false
    if (mounted.bundle !== this.held(base, hold)) return false
    return mounted.tail === blendTailOf(plan, plan.scenes.indexOf(scene))
  }

  /**
   * Timeline v3: a scene picture held for a blend window — the outgoing scene's exit or the incoming scene's entry animations
   * not played, exactly like the export's segment (`transition-animation-hold.ts`). The bundle itself when nothing is held.
   * The held picture keeps the scene's id and gets its own hash (`<hash>~hold:<side>:<frame>`), so it is mounted as a picture
   * of its own and never taken for the scene drawn outside the window.
   */
  private held(bundle: StageSceneBundle, hold: TransitionHold | null): StageSceneBundle {
    if (!hold || hold.roles.length === 0) return bundle
    const key = `${hold.side}:${hold.frame}:${hold.roles.join(',')}`
    let byKey = this.heldBundles.get(bundle)
    const known = byKey?.get(key)
    if (known) return known
    const ir = holdTransitionAnimations(bundle.ir, hold)
    const out = ir === bundle.ir ? bundle : { ...bundle, ir, dependencyHash: `${bundle.dependencyHash}~hold:${hold.side}:${hold.frame}` }
    if (!byKey) {
      byKey = new Map()
      this.heldBundles.set(bundle, byKey)
    }
    byKey.set(key, out)
    if (out !== bundle) this.heldBase.set(out, bundle)
    return out
  }

  /** Live FX: the two pictures of a blend at the frame: each seeked to its own frame, the blend look written onto them. */
  private drawBlend(at: Extract<Presentation, { kind: 'blend' }>): void {
    const pool = this.pool
    const current = pool?.current
    const partner = pool?.partner
    const blend = at.transition.blend
    if (!pool || !current || !partner || !blend) return
    const fromScene = at.holder === 'from' ? current : partner
    const toScene = at.holder === 'from' ? partner : current
    // The outgoing scene past its last frame holds its end state (its tail); the incoming one before its first frame holds it.
    fromScene.seek(at.fromFrame)
    toScene.seek(Math.max(0, at.toFrame))
    const frame = blendAt({ transition: blend.transition, fromFrames: at.transition.fromFrames ?? 0, durationFrames: at.transition.durationFrames ?? 1 }, at.step, current.canvas)
    applyBlendFrame({ from: fromScene, to: toScene, dip: pool.dipElement() }, frame)
    this.blendShown = true
    this.currentLook = at.holder === 'from' ? frame.from : frame.to
  }

  /** Takes a blend look off the picture shown alone again. */
  private endBlendLook(scene: MountedScene): void {
    if (!this.blendShown) return
    this.blendShown = false
    this.currentLook = null
    clearBlendLook(scene)
  }

  /**
   * Live FX: loads (cache) both pictures of a blend, mounts the holder as the current scene and the other one as the partner,
   * draws the frame and reports the holder like any scene (selection, warnings), with the blend marked.
   */
  private async showBlend(plan: StagePlan, at: Extract<Presentation, { kind: 'blend' }>, token: number): Promise<MountedScene | null> {
    const holder = at.holder === 'from' ? at.from : at.scene
    const other = at.holder === 'from' ? at.scene : at.from
    const blend = at.transition.blend!
    const marked = { toSceneId: at.transition.toSceneId, kind: at.transition.kind, blend: true, previewOnly: blend.previewOnly }
    this.set({ ...this.state, sceneId: holder.sceneId, sceneStatus: 'loading', issues: this.issuesOf(holder), transition: marked })
    try {
      const runtime = await this.runtime()
      if (token !== this.token) return null
      const [holderLoaded, otherLoaded] = await Promise.all([this.sceneBundle(plan, holder), this.sceneBundle(plan, other)])
      if (token !== this.token) return null
      // WP1 `keep`: the picture asked for is not available; the one on the stage stands in for it (the scene's own picture).
      const mountedOf = (sceneId: string) => {
        const bundle = [this.pool?.current, this.pool?.partner].find((scene) => scene?.sceneId === sceneId)?.bundle ?? null
        return bundle ? (this.heldBase.get(bundle) ?? bundle) : null
      }
      const holderBundle = holderLoaded === 'keep' ? mountedOf(holder.sceneId) : holderLoaded
      const otherBundle = otherLoaded === 'keep' ? mountedOf(other.sceneId) : otherLoaded
      if (!holderBundle || !otherBundle) return null
      if (segmentRefuses(holderBundle.ir) || segmentRefuses(otherBundle.ir)) {
        // Timeline v3 (export-truth): the export refuses a transition next to a scene its segment cannot hold (a camera, a
        // Kit / code component, word timing): the boundary plays as a cut, and the editor says why.
        this.failedTransitions.add(transitionKey(at.transition))
        this.transitionIssues.set(at.transition.toSceneId, {
          issue: { code: 'transition_scene_not_supported', message: 'the export cannot draw this transition (a scene it cannot blend); it is shown as a cut', sceneId: at.transition.toSceneId },
          fromSceneId: at.transition.fromSceneId,
        })
        return this.show((at.transition.startFrame ?? 0) + at.step)
      }
      await Promise.all([this.options.source.ensureFonts(holderBundle), this.options.source.ensureFonts(otherBundle)])
      if (token !== this.token) return null
      if (!this.pool) this.createPool(runtime, plan.runtimeVersion)
      const holderIndex = plan.scenes.indexOf(holder)
      const otherIndex = plan.scenes.indexOf(other)
      // Timeline v3: inside the window both pictures are held (exit / entry not played), exactly like the export's segment.
      const holderPicture = this.held(holderBundle, holdOf(at, at.holder))
      const otherPicture = this.held(otherBundle, holdOf(at, at.holder === 'from' ? 'to' : 'from'))
      const mounted = this.pool!.activate(holderPicture, { tail: blendTailOf(plan, holderIndex), partner: { bundle: otherPicture, tail: blendTailOf(plan, otherIndex) } })
      this.currentLocalFrame = at.localFrame
      this.drawBlend(at)
      const previewOnly: PreviewOnly | null = blend.previewOnly ?? null
      this.set({
        ...this.state,
        sceneId: holder.sceneId,
        sceneStatus: holder.status === 'partial' ? 'partial' : 'ready',
        issues: [...this.issuesOf(holder), ...holderBundle.warnings],
        transition: { ...marked, previewOnly },
      })
      for (const listener of [...this.presented]) listener(mounted)
      this.prefetch(plan, at)
      return mounted
    } catch (error) {
      if (token !== this.token) return null
      this.unmount()
      const mismatch = error instanceof StageMountError && error.code === 'runtime_version_mismatch'
      const fontFailed = error instanceof Error && error.name === 'StageFontLoadError'
      this.set({
        ...this.state,
        sceneStatus: 'failed',
        error: {
          code: mismatch ? 'runtime_mismatch' : this.module === null ? 'runtime_unavailable' : fontFailed ? 'font_unavailable' : 'scene_failed',
          message: error instanceof Error ? error.message : 'The scene could not be shown.',
        },
      })
      return null
    }
  }

  private runtime(): Promise<MotionRuntimeModule> {
    if (this.module) return Promise.resolve(this.module)
    this.moduleRequest ??= this.options.loadRuntime().then((module) => {
      this.module = module
      return module
    })
    this.moduleRequest.catch(() => {
      this.moduleRequest = null
    })
    return this.moduleRequest
  }

  private createPool(module: MotionRuntimeModule, expectedVersion: string | null = null): void {
    if (!this.root) throw new Error('The stage root is not attached.')
    this.pool = new SceneRuntimePool(module, this.root, expectedVersion ?? this.state.plan?.runtimeVersion ?? null)
    this.pool.setScale(this.scale)
  }

  private unmount(): void {
    if (!this.pool?.current) return
    this.pool.dispose()
    this.pool = null
    for (const listener of [...this.presented]) listener(null)
  }

  /**
   * Warms what plays next (IR loaded, fonts ready, mounted hidden) so the cut is instant. Never breaks playback. After a scene
   * that is the transition into the next scene when there is one (its window opens before the scene ends), else the next scene;
   * after a transition segment it is the scene it leads into. A scene that only follows a transition is loaded into the cache
   * (not mounted) in the meantime, so it mounts without waiting for the network.
   */
  private prefetch(plan: StagePlan, at: Presentation): void {
    const pool = this.pool
    // Timeline v3: inside a blend whose incoming picture is held, what plays next is that scene's OWN picture (after the window).
    const heldIncoming = at.kind === 'blend' ? holdOf(at, 'to') : null
    if (at.kind === 'blend' && heldIncoming) {
      const scene = at.scene
      void (async () => {
        try {
          const bundle = await this.cache.load(SceneBundleCache.key(scene.sceneId, scene.dependencyHash), () => this.loadFromSource(plan, scene), bundleKey)
          if (this.held(bundle, heldIncoming) === bundle) return
          if (!this.disposed && this.pool === pool && this.state.plan === plan) pool?.warm(bundle, blendTailOf(plan, at.index))
        } catch {
          // The scene reports its own failure when it is shown.
        }
      })()
      return
    }
    const incoming = at.kind === 'transition' ? at.scene : nextScene(plan, at.index)
    if (!incoming || incoming.status === 'unavailable') return
    const incomingIndex = at.kind === 'transition' ? at.index : at.index + 1
    // Live FX: a blend needs no segment, only the incoming scene's picture (warmed with its own blend tail, held as the window
    // opens with it: timeline v3).
    const into = at.kind === 'scene' ? transitionInto(plan, at.index + 1) : null
    const upcoming = into && !into.blend ? into : null
    const incomingHold = into?.blend?.holds?.to ?? null
    const tail = blendTailOf(plan, incomingIndex)
    const warmScene = async (): Promise<StageSceneBundle> => {
      const bundle = await this.cache.load(SceneBundleCache.key(incoming.sceneId, incoming.dependencyHash), () => this.loadFromSource(plan, incoming), bundleKey)
      await this.options.source.ensureFonts(bundle)
      return bundle
    }
    void (async () => {
      try {
        if (upcoming && !this.failedTransitions.has(transitionKey(upcoming))) {
          const [segment] = await Promise.all([this.loadTransitionBundle({ transition: upcoming }), warmScene()])
          if (!this.disposed && this.pool === pool && this.state.plan === plan) pool?.warm(segment)
          return
        }
        const bundle = await warmScene()
        if (!this.disposed && this.pool === pool && this.state.plan === plan) pool?.warm(this.held(bundle, incomingHold), tail)
      } catch {
        // The scene (or the transition) reports its own failure when it is shown; a transition that cannot load plays as a cut.
      }
    })()
  }

  /** Timeline v3: the plan and the transitions `preloadAhead` already asked for (cache loads, never repeated per frame). */
  private preloaded: { plan: StagePlan; keys: Set<string> } | null = null

  /**
   * Timeline v3: loads — into the cache, never mounted — what the transition windows that start within `horizonFrames` after
   * `frame` need, so a transition is ready seconds before it starts instead of when the playhead reaches it: the server's
   * segment, or both pictures of a blend with their fonts. Cheap to call on every frame (each window is asked for once per
   * plan); failures are reported when the window is shown.
   */
  preloadAhead(frame: number, horizonFrames: number): void {
    const plan = this.state.plan
    if (!plan || this.disposed || !(plan.transitions?.length ?? 0)) return
    if (this.preloaded?.plan !== plan) this.preloaded = { plan, keys: new Set() }
    const keys = this.preloaded.keys
    for (const transition of plan.transitions ?? []) {
      if (transition.status !== 'ready' || transition.startFrame === null) continue
      if (transition.startFrame + (transition.durationFrames ?? 0) <= frame || transition.startFrame > frame + horizonFrames) continue
      const key = transitionKey(transition)
      if (keys.has(key) || this.failedTransitions.has(key)) continue
      keys.add(key)
      const scenes = transition.blend ? plan.scenes.filter((scene) => scene.sceneId === transition.fromSceneId || scene.sceneId === transition.toSceneId) : []
      void (async () => {
        try {
          if (!transition.blend) {
            await this.loadTransitionBundle({ transition })
            return
          }
          await Promise.all(
            scenes.map(async (scene) => {
              const bundle = await this.cache.load(SceneBundleCache.key(scene.sceneId, scene.dependencyHash), () => this.loadFromSource(plan, scene), bundleKey)
              await this.options.source.ensureFonts(bundle)
            }),
          )
        } catch {
          // Shown as a cut (or retried) when the window is reached.
        }
      })()
    }
  }

  /**
   * The source's picture of a plan scene at the plan's hash. Y1R-EDITOR-6: for a SERVER plan, a scene that moved on is drawn
   * at its newer hash (the caller then reads the plan again); for a local plan a mismatch is the caller's to handle.
   */
  private loadFromSource(plan: StagePlan, scene: StagePlanScene): Promise<StageSceneBundle> {
    return this.options.source.loadScene(scene.sceneId, undefined, scene.dependencyHash).catch((error: unknown) => {
      if (plan.origin !== 'local' && error instanceof StageSceneMismatchError && error.bundle) return error.bundle
      throw error
    })
  }

  /**
   * The bundle to draw for a scene of `plan`, or `'keep'` (WP1): the picture on the stage is that scene and the picture the
   * local plan asked for is not available, so the stage keeps what it shows (a gesture preview on top stays where it is).
   */
  private async sceneBundle(plan: StagePlan, scene: StagePlanScene): Promise<StageSceneBundle | 'keep'> {
    const key = SceneBundleCache.key(scene.sceneId, scene.dependencyHash)
    const substitute = this.substituteOf(plan, scene)
    if (substitute !== undefined) {
      const current = this.pool?.current
      if (current && current.sceneId === scene.sceneId && current.dependencyHash === substitute) return 'keep'
      const held = this.cache.peek(SceneBundleCache.key(scene.sceneId, substitute))
      if (held) return held
    }
    try {
      return await this.cache.load(key, () => this.loadFromSource(plan, scene), bundleKey)
    } catch (error) {
      if (plan.origin !== 'local' || !(error instanceof StageSceneMismatchError)) throw error
      return this.localMismatch(plan, scene, error)
    }
  }

  /**
   * WP1: a local plan asked for a picture the source does not have. A newer server picture is cached under its own hash and
   * the owner is told to re-plan on top of the newer server plan. What is drawn meanwhile: the picture on the stage when it is
   * this scene (never an older one in its place); else the newer server picture; else, when the stage shows nothing of the
   * scene at all, the server's current picture of it.
   */
  private async localMismatch(plan: StagePlan, scene: StagePlanScene, error: StageSceneMismatchError): Promise<StageSceneBundle | 'keep'> {
    const key = SceneBundleCache.key(scene.sceneId, scene.dependencyHash)
    if (error.bundle) this.cache.replace(bundleKey(error.bundle), error.bundle)
    // The owner reads the server's plan again: a newer server picture, or (no picture) content the server may have by now.
    this.reportOutdated(`${scene.sceneId}\u0000${scene.dependencyHash}\u0000${error.bundle?.dependencyHash ?? ''}`)
    const current = this.pool?.current
    if (current && current.sceneId === scene.sceneId) {
      this.substitute(plan, key, current.dependencyHash)
      return 'keep'
    }
    const instead = error.bundle ?? (await this.options.source.loadScene(scene.sceneId))
    if (!error.bundle) this.cache.replace(bundleKey(instead), instead)
    this.substitute(plan, key, instead.dependencyHash)
    return instead
  }

  /** Tells the owner once per (scene, hash asked, hash the server has): a plan that keeps meeting it never loops. */
  private reportOutdated(signal: string): void {
    if (this.lastOutdated === signal) return
    this.lastOutdated = signal
    this.options.onPlanOutdated?.()
  }

  private substituteOf(plan: StagePlan, scene: { sceneId: string; dependencyHash: string }): string | undefined {
    return this.substitutes?.plan === plan ? this.substitutes.byKey.get(SceneBundleCache.key(scene.sceneId, scene.dependencyHash)) : undefined
  }

  private substitute(plan: StagePlan, key: string, hash: string): void {
    if (this.substitutes?.plan !== plan) this.substitutes = { plan, byKey: new Map() }
    this.substitutes.byKey.set(key, hash)
  }

  /** The segment bundle of a transition (cached by its dependency hash; its fonts are ready). */
  private async loadTransitionBundle(at: { transition: { toSceneId: string; dependencyHash: string | null } }): Promise<StageSceneBundle> {
    const load = this.options.source.loadTransition
    if (!load) throw new Error('The preview source has no transitions.')
    const { toSceneId, dependencyHash } = at.transition
    const bundle = await this.cache.load(SceneBundleCache.key(transitionBundleId(toSceneId), dependencyHash ?? ''), () => load.call(this.options.source, toSceneId))
    await this.options.source.ensureFonts(bundle)
    return bundle
  }

  /**
   * A scene's own warnings plus a transition at either of its edges that the stage could not draw (it plays as a cut): the
   * scene before the boundary and the one after it both say so.
   */
  private issuesOf(scene: { sceneId: string; warnings: StageIssue[] }): StageIssue[] {
    const failed = [...this.transitionIssues.entries()].filter(([toSceneId, entry]) => toSceneId === scene.sceneId || entry.fromSceneId === scene.sceneId).map(([, entry]) => entry.issue)
    return failed.length > 0 ? [...scene.warnings, ...failed] : scene.warnings
  }

  private set(next: PresenterState): void {
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
}
