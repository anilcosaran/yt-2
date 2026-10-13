import { getMotionDraft, listMotionDraftRevisions } from '@/lib/motion-editor/api'

import { resolveSceneLength } from '../scene-timing'
import type { CompositionDocument } from '../composition-client'
import type { CompositionMotionRevisionRef } from '../composition-typed-edits'
import type { MotionLayerView } from '../motion-layers'
import type { MotionResult } from '../motion-result'

import { repointMotionLayer, type MotionRepointDeps, type MotionRepointOutcome } from './motion-repoint-run'

/**
 * Assistant direct apply (owner decision 2026-10-04): when the user selected a Motion layer and asked the Assistant to change
 * it, the revision the Assistant published is applied to THAT layer at once - no approval step - and the chat card shows an
 * applied action with the usual Undo (undo of the exact undo group, `motion-placement-undo.ts`).
 *
 * This is the client side of the path, written against what the gateway has today. The `/motion` job publishes a revision
 * from a draft FORKED from the layer's pinned revision (the draft's `source`, or its `return_to` layer) and reports it on the
 * closing card (`published`); the placement the job wrote itself (`placement`) is a new overlay and only exists when the job
 * placed one. So the editor applies a card exactly when:
 *
 * - the card carries a published revision and the job placed nothing itself (no `applied`, and no `proposed` waiting for an
 *   approval: that one is the server's decision and stays the user's);
 * - the draft the card names was forked from the revision the selected layer pinned when the message was sent (or returns to
 *   that layer): an unrelated new Motion the Assistant made while a layer happened to be selected is NOT applied to it;
 * - the layer still exists and does not already hold that revision.
 *
 * GAP: the same card from the server (a `placement` of kind "revised layer" with its own undo group, written by the job through
 * `composition.edit.propose`) needs a gateway op that re-pins an instance to another Motion's revision; until then the write is
 * the editor's own (`repointMotionLayer`) and happens while the editor is open. A reload before it ran applies nothing: the
 * revision stays in My Motions and on the card.
 */

export type AssistantApplyTarget = {
  sceneId: string
  layerId: string
  /** The revision the layer pinned when the message was sent. */
  revisionId: string
}

export type AssistantApplyResult =
  | { status: 'applied'; result: MotionResult; outcome: Extract<MotionRepointOutcome, { status: 'applied' }> }
  | { status: 'skipped'; reason: 'not_eligible' | 'unrelated_motion' | 'layer_gone' | 'already_applied' | 'revision_unknown' }
  | { status: 'refused' | 'failed'; outcome: Exclude<MotionRepointOutcome, { status: 'applied' }> | { status: 'failed'; stage: 'lookup' } }

export type AssistantApplyDeps = MotionRepointDeps & {
  getDraft?: typeof getMotionDraft
  listRevisions?: typeof listMotionDraftRevisions
  /** The layer's current view in the newest document (null once it is gone). */
  layerView: (sceneId: string, layerId: string) => MotionLayerView | null
  projectId: string
}

/** A card the editor may apply: a published revision and no placement the server wrote or proposed. */
export function assistantApplyEligible(result: MotionResult): boolean {
  if (!result.published) return false
  return result.placement === null || result.placement.status === 'not_placed'
}

function sceneStartFrame(document: CompositionDocument | null, sceneId: string): number {
  if (!document) return 0
  let start = 0
  for (const id of document.scene_sequence.scene_ids) {
    if (id === sceneId) return start
    const scene = document.scenes.find((candidate) => candidate.scene_id === id)
    start += scene ? (resolveSceneLength(document, scene) ?? 0) : 0
  }
  return start
}

export async function applyAssistantMotionRevision(
  input: { result: MotionResult; target: AssistantApplyTarget },
  deps: AssistantApplyDeps,
): Promise<AssistantApplyResult> {
  const { result, target } = input
  if (!assistantApplyEligible(result) || !result.published) return { status: 'skipped', reason: 'not_eligible' }
  let ref: CompositionMotionRevisionRef | null
  try {
    const draft = await (deps.getDraft ?? getMotionDraft)(result.draftId)
    if (draft.source.motion_revision_id !== target.revisionId && draft.return_to?.layer_id !== target.layerId) return { status: 'skipped', reason: 'unrelated_motion' }
    const revisions = await (deps.listRevisions ?? listMotionDraftRevisions)(result.draftId)
    const found = revisions.find((revision) => revision.motion_revision_id === result.published!.motionRevisionId)
    ref = found
      ? { motion_id: found.ref.motion_id, motion_revision_id: found.ref.motion_revision_id, scope: found.ref.scope === 'project_private' ? 'project_private' : 'library', manifest_sha256: found.ref.manifest_sha256 }
      : null
  } catch {
    return { status: 'failed', outcome: { status: 'failed', stage: 'lookup' } }
  }
  if (!ref) return { status: 'skipped', reason: 'revision_unknown' }

  const view = deps.layerView(target.sceneId, target.layerId)
  if (!view) return { status: 'skipped', reason: 'layer_gone' }
  if (view.motionRef.motion_revision_id === ref.motion_revision_id) return { status: 'skipped', reason: 'already_applied' }

  const outcome = await repointMotionLayer({ view, target: ref }, deps)
  if (outcome.status !== 'applied') return { status: outcome.status, outcome }
  const length = view.range ? view.range.endFrame - view.range.startFrame : 0
  const startFrame = view.range?.startFrame ?? 0
  return {
    status: 'applied',
    outcome,
    result: {
      ...result,
      placement: {
        status: 'applied',
        projectId: deps.projectId,
        sceneId: outcome.sceneId,
        layerId: outcome.layerId,
        startFrame,
        endFrame: startFrame + length,
        sceneStartFrame: sceneStartFrame(deps.document(), outcome.sceneId),
        undoGroupId: outcome.undoGroupId ?? '',
        workingCopyVersion: outcome.workingCopyVersion,
        revised: true,
      },
    },
  }
}
