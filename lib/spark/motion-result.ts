import { z } from 'zod'

/**
 * E1-H `assistant_motion_result_v1` (`content_json.motion_result` of a closing assistant answer): the card of a job that
 * authored a Motion with `/motion` (Spark chat, Dashboard chat). The server derives it from the job's own owner state and
 * carries ids and numbers only. The UI builds the Motion link from the draft id, and Undo asks Composition to undo exactly the
 * named undo group - nothing here is a path, a URL or a command taken from the message.
 */

const opaqueId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
const draftId = z.string().regex(/^bmotd_[A-Za-z0-9_-]{1,64}$/)
const frame = z.number().int().min(0)

const placedBase = {
  project_id: opaqueId,
  scene_id: opaqueId,
  layer_id: opaqueId,
  start_frame: frame,
  end_frame: frame,
  scene_start_frame: frame,
}

const placementSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('applied'), ...placedBase, undo_group_id: opaqueId, working_copy_version: frame }),
  z.object({ status: z.literal('proposed'), ...placedBase }),
  z.object({ status: z.literal('not_placed'), reason: z.string().max(64), project_id: opaqueId.nullable() }),
])

const resultSchema = z.object({
  schema_version: z.literal('assistant_motion_result_v1'),
  draft: z.object({
    draft_id: draftId,
    name: z.string().max(80),
    draft_version: z.number().int().min(1),
    blueprint_ref: z.string().max(80),
  }),
  published: z.object({ motion_id: opaqueId, motion_revision_id: opaqueId, revision_number: z.number().int().min(1) }).nullable(),
  placement: placementSchema.nullable(),
})

export type MotionPlacementView =
  | {
      status: 'applied'
      projectId: string
      sceneId: string
      layerId: string
      startFrame: number
      endFrame: number
      sceneStartFrame: number
      undoGroupId: string
      workingCopyVersion: number
      /**
       * Set by the editor only (never by the server's card, `readMotionResult` does not read it): the revision was applied to the
       * Motion layer the user had selected, instead of being placed as a new overlay (Code tab, direct apply). The card then
       * says so; its Undo is the same undo-by-group as for a placement. An empty `undoGroupId` has no Undo button.
       */
      revised?: true
    }
  | { status: 'proposed'; projectId: string; sceneId: string; layerId: string; startFrame: number; endFrame: number; sceneStartFrame: number }
  | { status: 'not_placed'; reason: string; projectId: string | null }

export type MotionResult = {
  draftId: string
  name: string
  draftVersion: number
  published: { motionId: string; motionRevisionId: string; revisionNumber: number } | null
  placement: MotionPlacementView | null
}

/** The Motion result card a message carries, or null (malformed content is no card, never a half-trusted one). */
export function readMotionResult(contentJson: Record<string, unknown> | null | undefined): MotionResult | null {
  const raw = contentJson?.['motion_result']
  if (raw === undefined) return null
  const parsed = resultSchema.safeParse(raw)
  if (!parsed.success) return null
  const { draft, published, placement } = parsed.data
  return {
    draftId: draft.draft_id,
    name: draft.name,
    draftVersion: draft.draft_version,
    published: published ? { motionId: published.motion_id, motionRevisionId: published.motion_revision_id, revisionNumber: published.revision_number } : null,
    placement: placement ? placementView(placement) : null,
  }
}

function placementView(placement: z.infer<typeof placementSchema>): MotionPlacementView {
  if (placement.status === 'not_placed') return { status: 'not_placed', reason: placement.reason, projectId: placement.project_id }
  const base = {
    projectId: placement.project_id,
    sceneId: placement.scene_id,
    layerId: placement.layer_id,
    startFrame: placement.start_frame,
    endFrame: placement.end_frame,
    sceneStartFrame: placement.scene_start_frame,
  }
  return placement.status === 'proposed'
    ? { status: 'proposed', ...base }
    : { status: 'applied', ...base, undoGroupId: placement.undo_group_id, workingCopyVersion: placement.working_copy_version }
}

/** The Motion screen of a draft; the draft is private, so another user's link is a 404 there, never a leak. */
export function motionDraftPath(draftId: string): string {
  return `/motion/${encodeURIComponent(draftId)}`
}

/** "0:12" style start of the overlay on the project timeline (project frames at the canvas fps). */
export function motionPlacementStartLabel(placement: Extract<MotionPlacementView, { status: 'applied' | 'proposed' }>, fps: number): string {
  const seconds = Math.max(0, Math.floor((placement.sceneStartFrame + placement.startFrame) / Math.max(1, fps)))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
