import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'
import { getMotionDraft } from '@/lib/motion-editor/api'

import type { CompositionMotionRevisionRef } from '../composition-typed-edits'

/**
 * Code tab "Revert": which revision a layer goes back to. Two sources, the first that exists wins:
 *
 * 1. the revision the layer pinned right before THIS editor session repointed it (`RevertMemory`, view state only: a reload
 *    forgets it, nothing is stored in the browser);
 * 2. the lineage the server holds: a saved Motion (`bmot_u_…`) names the draft it was published from (`draft_id` of
 *    `GET /api/v1/brand/motion-revisions/:id`) and that draft names the revision it was forked from (`source`). Revert then goes
 *    back to what the user's edit started from.
 *
 * A layer pinned to a platform revision, or a saved Motion whose lineage cannot be read, has no revert target and the tab
 * shows no Revert button.
 */

export type RevertMemory = Map<string, CompositionMotionRevisionRef>

const lineageSchema = z.object({ data: z.object({ draft_id: z.string().optional() }).passthrough() })
const isOwnedMotionId = (motionId: string) => motionId.startsWith('bmot_u_')

export type RevertDeps = { request?: typeof gatewayRequest; getDraft?: typeof getMotionDraft }

/** The revision the saved Motion was forked from, or null (not a saved Motion, or the server does not say). */
export async function loadRevisionOrigin(ref: CompositionMotionRevisionRef, deps: RevertDeps = {}): Promise<CompositionMotionRevisionRef | null> {
  if (!isOwnedMotionId(ref.motion_id)) return null
  try {
    const read = await (deps.request ?? gatewayRequest)(`/api/v1/brand/motion-revisions/${encodeURIComponent(ref.motion_revision_id)}`, { schema: lineageSchema })
    const draftId = read.data.draft_id
    if (!draftId) return null
    const draft = await (deps.getDraft ?? getMotionDraft)(draftId)
    const { source } = draft
    return { motion_id: source.motion_id, motion_revision_id: source.motion_revision_id, scope: 'library', manifest_sha256: source.manifest_sha256 }
  } catch {
    return null
  }
}

/** The revision to go back to for `ref` on `layerId`: the session's memory first, then the server's lineage. */
export async function revertTargetFor(layerId: string, ref: CompositionMotionRevisionRef, memory: RevertMemory, deps: RevertDeps = {}): Promise<CompositionMotionRevisionRef | null> {
  return memory.get(layerId) ?? loadRevisionOrigin(ref, deps)
}
