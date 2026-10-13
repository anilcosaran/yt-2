import type { CompositionCommandReceipt, CompositionDocument } from '../composition-client'
import type { SparkCompositionActions } from '../composition-session'
import type { CompositionMotionRevisionRef } from '../composition-typed-edits'
import { loadMotionExposureShared } from '../motion-exposure'
import type { MotionLayerView } from '../motion-layers'
import { createSparkUndoGroup } from '../undo-group'

import { planMotionRepoint, type MotionRepointLost, type MotionRepointRefusal } from './motion-repoint'

/**
 * Runs a Motion repoint (`planMotionRepoint`) through the editor's own write path, so it is ONE undo step of the editor (the
 * header Undo and Ctrl/Cmd+Z revert it) and has a server undo group (`undo_group_id`) the chat's Undo can name.
 */

export type MotionRepointOutcome =
  | {
      status: 'applied'
      sceneId: string
      /** The layer that now holds the new revision (a replace: the old layer id is gone). */
      layerId: string
      previousLayerId: string
      previousRef: CompositionMotionRevisionRef
      ref: CompositionMotionRevisionRef
      undoGroupId: string | null
      workingCopyVersion: number
      dropped: string[]
      lost: MotionRepointLost[]
      /** The layer's transform / lock could not follow (the step is applied; the user can undo it). */
      followUpFailed: boolean
    }
  | { status: 'refused'; refusal: MotionRepointRefusal }
  | { status: 'failed'; stage: 'exposure' | 'write' }

export type MotionRepointDeps = {
  /** The newest document the editor holds, read after every await (the plan is built from it, never from a stale copy). */
  document: () => CompositionDocument | null
  apply: SparkCompositionActions['apply']
  loadExposure?: typeof loadMotionExposureShared
  uuid?: () => string
}

export async function repointMotionLayer(
  input: { view: MotionLayerView; target: CompositionMotionRevisionRef },
  deps: MotionRepointDeps,
): Promise<MotionRepointOutcome> {
  const load = deps.loadExposure ?? loadMotionExposureShared
  let exposure
  try {
    exposure = await load(input.target)
  } catch {
    return { status: 'failed', stage: 'exposure' }
  }
  const document = deps.document()
  if (!document) return { status: 'refused', refusal: { reason: 'layer_missing' } }
  const plan = planMotionRepoint({ document, view: input.view, target: input.target, exposure, uuid: deps.uuid ?? (() => crypto.randomUUID()) })
  if (!plan.ok) return { status: 'refused', refusal: plan.refusal }

  const group = createSparkUndoGroup()
  let receipt: CompositionCommandReceipt | null = null
  const applied = await deps.apply(plan.specs, { undoGroup: group, onApplied: (value) => (receipt = value) })
  if (!applied) return { status: 'failed', stage: 'write' }

  let followUpFailed = false
  const followUp = plan.followUp(plan.newLayerId)
  if (followUp.length > 0) followUpFailed = !(await deps.apply(followUp, { joinUndoGroup: group }))
  const done = receipt as CompositionCommandReceipt | null
  return {
    status: 'applied',
    sceneId: plan.sceneId,
    layerId: plan.newLayerId,
    previousLayerId: plan.oldLayerId,
    previousRef: input.view.motionRef,
    ref: input.target,
    undoGroupId: done?.undo_group_id ?? null,
    workingCopyVersion: done?.working_copy_version ?? document.working_copy_version,
    dropped: plan.dropped,
    lost: plan.lost,
    followUpFailed,
  }
}
