import type { MotionCard } from '@/lib/spark/motion-catalog'
import { planMotionInsert, planMotionScene, type MotionInsertRefusal } from '@/lib/spark/motion-insert'
import { ensureOverlaySupport, overlayBlockFor, rememberOverlayBlock, revisionEnergies, type OverlayBlock } from '@/lib/spark/motion-overlay-support'
import { pendingInsertsFor } from '@/lib/spark/stage/pending-inserts'
import type { PlacementTarget } from '@/lib/spark/stage/placement'
import { formatFrameTime } from '@/lib/spark/stage/scene-plan'
import { sparkAddSceneReasonKey } from '@/lib/spark/template-policy'

import type { SparkToolContext } from './spark-tool-types'

/**
 * "Put this Motion on the scene": the one path of the Motion tool ("+" at the playhead, a card dropped on the canvas or on the
 * timeline, D13/D14). The shared placement (`placeLayer`) resolves the scene and the second; `planMotionInsert` turns the card
 * into ONE `motion.instance.insert` (an overlay beside the scene's other layers, D2); the new layer is selected once drawn, so
 * its Properties (the Motion fields) open. A refusal the UI can know before the server is returned, never written.
 *
 * A Motion that moves a camera, follows word/beat timing or draws unstaged content cannot be an overlay (E1-C): it is found
 * out from the typed source BEFORE the write (`ensureOverlaySupport`) and, when the scan could not tell, from the preview's
 * per-layer warning right after it (`watchOverlay`). Such a Motion is offered as "Add as new scene" (`insertMotionScene`).
 */

export type MotionInsertOutcome = {
  applied: boolean
  /** Why nothing was written, when the plan refused (null when it was sent: a server refusal shows the editor's notice). */
  refusal: MotionInsertRefusal | null
  /** The overlay was shortened to end with its scene. */
  shortened: boolean
  /** Absolute project frame the overlay starts at (null when nothing was placed). */
  startFrame: number | null
  /** The written layer and its scene, and the scene's preview hash before the write (what `watchOverlay` compares). */
  layerId: string | null
  sceneId: string | null
  previousHash: string | null
}

const NONE: MotionInsertOutcome = { applied: false, refusal: null, shortened: false, startFrame: null, layerId: null, sceneId: null, previousHash: null }

export async function insertMotion(ctx: SparkToolContext, card: MotionCard, target: PlacementTarget, defaultVideoStyleRef: string | null): Promise<MotionInsertOutcome> {
  const controller = ctx.stage?.controller
  if (!controller) return NONE
  // The typed source of a Motion is read once (immutable by digest), normally already when the drawer opened
  // (`prefetchOverlaySupport`): a camera Motion is refused before anything is written, without a read on the click.
  const overlayBlock: OverlayBlock | null = card.premium && card.owned !== true ? null : await ensureOverlaySupport(card.ref)
  const held = { refusal: null as MotionInsertRefusal | null, shortened: false, startFrame: null as number | null, layerId: null as string | null, sceneId: null as string | null, previousHash: null as string | null }
  // WP4: with instant editing the stage shows a selected placeholder box the moment the insert is queued (the gateway
  // compiles the Motion, so its real picture follows the server's answer); it goes once that picture is drawn.
  const pending = ctx.composition.optimistic === true ? pendingInsertsFor(controller) : null
  let placeholder: string | null = null
  const result = await controller.placeLayer((placement, document) => {
    const plan = planMotionInsert({
      document,
      card,
      sceneId: placement.sceneId,
      sceneFrames: placement.sceneFrames,
      localFrame: placement.startFrame,
      lastLayerId: placement.afterLayerId,
      fps: placement.fps,
      defaultVideoStyleRef,
      overlayBlock: overlayBlock ?? overlayBlockFor(card.ref.manifest_sha256),
      energies: revisionEnergies(card.ref.manifest_sha256),
      uuid: () => globalThis.crypto.randomUUID(),
    })
    if (!plan.ok) {
      held.refusal = plan.refusal
      return null
    }
    held.shortened = plan.shortened
    held.layerId = plan.layerId
    held.sceneId = plan.sceneId
    held.previousHash = controller.presenter.plan?.scenes.find((scene) => scene.sceneId === placement.sceneId)?.dependencyHash ?? null
    const sceneStart = controller.presenter.plan?.scenes.find((scene) => scene.sceneId === placement.sceneId)?.startFrame ?? 0
    held.startFrame = sceneStart + plan.range.start_frame
    placeholder = pending?.add({ kind: 'motion', label: titleOf(ctx, card), status: 'saving', sceneId: placement.sceneId }) ?? null
    return { specs: plan.specs, selectLayerId: plan.layerId }
  }, target)
  if (pending && placeholder) {
    const id = placeholder
    // Kept until the stage has drawn the working copy that holds the new layer (or right away when nothing was written).
    if (result.applied) void controller.whenSettled().finally(() => pending.remove(id))
    else pending.remove(id)
  }
  return {
    applied: result.applied,
    refusal: held.refusal,
    shortened: held.shortened,
    startFrame: result.applied ? held.startFrame : null,
    layerId: result.applied ? held.layerId : null,
    sceneId: result.applied ? held.sceneId : null,
    previousHash: held.previousHash,
  }
}

const CAUSE_OF_WARNING: Record<string, OverlayBlock> = {
  motion_overlay_camera_not_supported: 'camera',
  motion_overlay_anchor_not_supported: 'anchor',
  motion_content_not_staged: 'content',
}

/**
 * After an overlay was written: the preview of its scene reports the gateway's per-layer refusal (E1-C). When the layer is
 * named in `motion_overlay_camera_not_supported`, `motion_overlay_anchor_not_supported` or `motion_content_not_staged`, the
 * Motion is remembered as own-scene-only (its card says so) and the user is told what to do. Waits for the scene's next
 * preview (its dependency hash moves) and gives up quietly after a few seconds: nothing is wrong with a Motion that draws.
 */
export async function watchOverlay(ctx: SparkToolContext, card: MotionCard, outcome: MotionInsertOutcome, timeoutMs = 5000): Promise<OverlayBlock | null> {
  const controller = ctx.stage?.controller
  if (!controller || !outcome.applied || !outcome.layerId || !outcome.sceneId) return null
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (controller.isDisposed) return null
    await controller.whenSettled()
    const scene = controller.presenter.plan?.scenes.find((candidate) => candidate.sceneId === outcome.sceneId)
    if (scene && scene.dependencyHash !== outcome.previousHash) {
      const warning = scene.warnings.find((issue) => issue.layerId === outcome.layerId && issue.code in CAUSE_OF_WARNING)
      if (!warning) return null
      const cause = CAUSE_OF_WARNING[warning.code]!
      rememberOverlayBlock(card.ref.manifest_sha256, cause)
      ctx.toast(ctx.translate?.(`motionDrawer.overlayWarning.${cause}`, { title: titleOf(ctx, card) }) ?? cause, 'error')
      return cause
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return null
}

export type MotionSceneOutcome = { applied: boolean; refusal: MotionInsertRefusal | null; sceneId: string | null }

/** "Add as new scene": the Motion as a scene of its own after the selected scene (one command, one undo group). */
export async function insertMotionScene(ctx: SparkToolContext, card: MotionCard, defaultVideoStyleRef: string | null): Promise<MotionSceneOutcome> {
  const document = ctx.composition.workingCopy?.document ?? ctx.document
  if (!document) return { applied: false, refusal: { reason: 'no_scene' }, sceneId: null }
  const plan = planMotionScene({
    document,
    card,
    afterSceneId: ctx.composition.selectedSceneId,
    fps: document.canvas.fps,
    defaultVideoStyleRef,
    energies: revisionEnergies(card.ref.manifest_sha256),
    uuid: () => globalThis.crypto.randomUUID(),
  })
  if (!plan.ok) return { applied: false, refusal: plan.refusal, sceneId: null }
  const applied = await ctx.actions.apply(plan.specs, {
    onApplied: () => {
      // The new scene becomes the selected one and the Motion layer the selection, so its fields open in Properties.
      ctx.actions.select(plan.sceneId)
      ctx.stage?.controller.selection.selectLayer(plan.sceneId, plan.layerId)
    },
  })
  return { applied, refusal: null, sceneId: applied ? plan.sceneId : null }
}

const titleOf = (ctx: SparkToolContext, card: MotionCard) => (ctx.locale === 'tr' ? card.title.tr : card.title.en)

function refusalMessage(ctx: SparkToolContext, card: MotionCard, refusal: MotionInsertRefusal): string {
  const title = titleOf(ctx, card)
  const say = (key: string, values: Record<string, string | number> = {}) => ctx.translate?.(key, values) ?? key
  switch (refusal.reason) {
    case 'ratio_not_available':
      return say('motionDrawer.refused.ratio_not_available', { title, ratio: refusal.ratio })
    case 'scene_too_short':
      return say('motionDrawer.refused.scene_too_short', { title, seconds: refusal.minSeconds })
    case 'own_scene_only':
      return say(`motionDrawer.refused.own_scene_only.${refusal.cause}`, { title })
    case 'scene_policy':
      return say(sparkAddSceneReasonKey(refusal.mode) ?? 'motionDrawer.refused.no_scene', { title })
    default:
      return say(`motionDrawer.refused.${refusal.reason}`, { title })
  }
}

/** Tells the user what an insert did or why it did not (a server refusal already raised the editor's own notice). */
export function announceMotionInsert(ctx: SparkToolContext, card: MotionCard, outcome: MotionInsertOutcome): void {
  if (outcome.refusal) {
    ctx.toast(refusalMessage(ctx, card, outcome.refusal), 'error')
    return
  }
  if (!outcome.applied || outcome.startFrame === null) return
  const fps = ctx.stage?.controller.presenter.plan?.canvas.fps ?? { num: 30, den: 1 }
  const title = titleOf(ctx, card)
  const key = outcome.shortened ? 'motionDrawer.addedShortened' : 'motionDrawer.added'
  ctx.toast(ctx.translate?.(key, { title, time: formatFrameTime(outcome.startFrame, fps) }) ?? key)
}

export function announceMotionScene(ctx: SparkToolContext, card: MotionCard, outcome: MotionSceneOutcome): void {
  if (outcome.refusal) {
    ctx.toast(refusalMessage(ctx, card, outcome.refusal), 'error')
    return
  }
  if (outcome.applied) ctx.toast(ctx.translate?.('motionDrawer.sceneAdded', { title: titleOf(ctx, card) }) ?? 'motionDrawer.sceneAdded')
}
