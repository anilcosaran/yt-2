import {
  createMotionDraft,
  newMotionDraftClientRequestId,
  newMotionPublishIntentKey,
  publishMotionDraft,
  updateMotionDraftSource,
  validateMotionDraft,
  type MotionDraft,
} from '@/lib/motion-editor/api'
import { classifyMotionEditorError, type MotionResourceFailure } from '@/lib/motion-editor/resource'

import type { CompositionMotionRevisionRef } from '../composition-typed-edits'
import type { MotionLayerView } from '../motion-layers'

import { checkMotionSourceText, type MotionSourceIssue } from './motion-code-validate'

/**
 * Code tab Apply, steps 1-5: the user's edited source becomes a NEW IMMUTABLE REVISION through the Motion editor's own client
 * (nothing duplicated, nothing invented):
 *
 *   1. cheap local check (`checkMotionSourceText`): JSON, object, keeps `manifest` / `body`; a hard failure stops here;
 *   2. fork the pinned revision into a private draft that returns to this project and layer (`createMotionDraft`, replayed by
 *      the client request id on a retry);
 *   3. write the source with the draft's CAS version (`updateMotionDraftSource`);
 *   4. the Motion validator (`validateMotionDraft`): its receipt decides. A receipt that is not `ok` and `current` BLOCKS the
 *      apply and its issues are shown inline. The receipt has no warning/error severity, so there is no "apply anyway" yet
 *      (GAP: the owner's "warnings only may be applied" needs the validator to say which issues are warnings);
 *   5. "Save as Motion" (`publishMotionDraft`): the immutable revision, whose ref the caller pins (`repointMotionLayer`).
 *
 * Every step is one server call; a refusal names the step. A step that fails after the draft exists leaves the private draft
 * in the user's Motion area (it is theirs, listed there) and nothing on the project changes: the layer is repointed only after
 * the revision exists.
 */

export type MotionCodeIssue = { code: string; path?: string; message?: string }

export type MotionCodeStage = 'local' | 'fork' | 'write' | 'validator' | 'publish'

export type MotionCodePublishResult =
  | { status: 'published'; ref: CompositionMotionRevisionRef; draftId: string; revisionNumber: number }
  /** The user can fix it: the source is refused (locally, by the server's write check or the validator) or cannot be saved as a Motion. */
  | { status: 'blocked'; stage: MotionCodeStage; issues: MotionCodeIssue[]; reason: string | null }
  /** The call did not go through (network, permission, a moved draft); retrying the same attempt is safe. */
  | { status: 'failed'; stage: MotionCodeStage; kind: MotionResourceFailure; reason: string | null }

export type MotionCodeApplyDeps = {
  createDraft: typeof createMotionDraft
  updateSource: typeof updateMotionDraftSource
  validate: typeof validateMotionDraft
  publish: typeof publishMotionDraft
}

export const DEFAULT_MOTION_CODE_APPLY_DEPS: MotionCodeApplyDeps = {
  createDraft: createMotionDraft,
  updateSource: updateMotionDraftSource,
  validate: validateMotionDraft,
  publish: publishMotionDraft,
}

/** The client-minted intents of ONE apply attempt: a retry of the same attempt replays the draft and the revision. */
export type MotionCodeAttempt = { clientRequestId: string; publishIntentKey: string }

export function newMotionCodeAttempt(): MotionCodeAttempt {
  return { clientRequestId: newMotionDraftClientRequestId(), publishIntentKey: newMotionPublishIntentKey() }
}

const localIssue = (issue: MotionSourceIssue): MotionCodeIssue => ({ code: issue.code, ...(issue.detail && { message: issue.detail }) })

function pinnableRef(ref: { motion_id: string; motion_revision_id: string; scope: string; manifest_sha256: string }): CompositionMotionRevisionRef {
  return { motion_id: ref.motion_id, motion_revision_id: ref.motion_revision_id, scope: ref.scope === 'project_private' ? 'project_private' : 'library', manifest_sha256: ref.manifest_sha256 }
}

export async function publishEditedMotionSource(
  input: {
    projectId: string
    view: MotionLayerView
    text: string
    baseline: Record<string, unknown>
    attempt: MotionCodeAttempt
    /** Called before each step starts (the tab shows what it is doing). */
    onStage?: (stage: MotionCodeStage) => void
  },
  deps: MotionCodeApplyDeps = DEFAULT_MOTION_CODE_APPLY_DEPS,
): Promise<MotionCodePublishResult> {
  const check = checkMotionSourceText(input.text, input.baseline)
  if (!check.ok) return { status: 'blocked', stage: 'local', issues: check.issues.map(localIssue), reason: null }
  if (!check.changed) return { status: 'blocked', stage: 'local', issues: [{ code: 'unchanged' }], reason: null }

  const failed = (stage: MotionCodeStage, error: unknown): MotionCodePublishResult => {
    const classified = classifyMotionEditorError(error)
    // A write the server refuses on its merits is the user's to fix, not a failed call.
    if (classified.kind === 'invalid') return { status: 'blocked', stage, issues: [], reason: classified.reason ?? classified.code }
    return { status: 'failed', stage, kind: classified.kind, reason: classified.reason ?? classified.code }
  }

  const { motionRef } = input.view
  const enter = (stage: MotionCodeStage) => input.onStage?.(stage)
  let draft: MotionDraft
  enter('fork')
  try {
    const created = await deps.createDraft({
      source: { motion_id: motionRef.motion_id, motion_revision_id: motionRef.motion_revision_id, manifest_sha256: motionRef.manifest_sha256 },
      returnTo: { projectId: input.projectId, layerId: input.view.layerId },
      clientRequestId: input.attempt.clientRequestId,
    })
    draft = created.draft
  } catch (error) {
    return failed('fork', error)
  }
  // The server says whether this draft's source may be edited at all (`code_panel.source_editable`); nothing is guessed.
  if (!draft.capabilities.actions.edit_source || !draft.capabilities.surfaces.code_panel.source_editable) {
    return { status: 'blocked', stage: 'fork', issues: [], reason: 'source_not_editable' }
  }

  enter('write')
  try {
    draft = await deps.updateSource(draft.draft_id, { expectedVersion: draft.draft.version, pattern: check.pattern })
  } catch (error) {
    return failed('write', error)
  }

  enter('validator')
  try {
    draft = await deps.validate(draft.draft_id, { expectedVersion: draft.draft.version })
  } catch (error) {
    return failed('validator', error)
  }
  const receipt = draft.draft.validation
  if (!receipt || !receipt.current || !receipt.ok) {
    return { status: 'blocked', stage: 'validator', issues: (receipt?.issues ?? []).map((issue) => ({ code: issue.code, path: issue.path, message: issue.message })), reason: null }
  }

  const publish = draft.capabilities.actions.publish
  if (!publish.available) return { status: 'blocked', stage: 'publish', issues: [], reason: publish.reason }
  enter('publish')
  try {
    const published = await deps.publish(draft.draft_id, { expectedVersion: draft.draft.version, publishIntentKey: input.attempt.publishIntentKey })
    return { status: 'published', ref: pinnableRef(published.revision.ref), draftId: published.draft.draft_id, revisionNumber: published.revision.revision_number }
  } catch (error) {
    return failed('publish', error)
  }
}
