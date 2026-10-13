import { classifyCompositionError, undoCompositionCommand } from './composition-client'

/**
 * E1-H "Undo" of the Motion result card: undoes EXACTLY the undo group the AI's placement made (`undo_group_id` of the
 * card), on the server, as the user (persistent across reloads and devices, like the editor's own Undo). If the user edited
 * on top of it since, the group is no longer the newest and the server answers an undo conflict - the card says so and the
 * editor's own Undo / history stays the way back; this never undoes some other edit.
 */

export type MotionUndoOutcome = 'undone' | 'nothing_to_undo' | 'conflict' | 'failed'

export type MotionUndoDeps = { undo: typeof undoCompositionCommand }

export async function undoMotionPlacement(
  input: { projectId: string; undoGroupId: string },
  deps: MotionUndoDeps = { undo: undoCompositionCommand },
): Promise<MotionUndoOutcome> {
  try {
    // One key per placement: a second click (or a retry after a lost response) replays the same undo, never a second one.
    const receipt = await deps.undo(input.projectId, { idempotency_key: `motion-undo:${input.undoGroupId}`, undo_group_id: input.undoGroupId })
    return receipt.outcome === 'undone' ? 'undone' : 'nothing_to_undo'
  } catch (error) {
    const kind = classifyCompositionError(error)
    return kind === 'undo_conflict' || kind === 'conflict' ? 'conflict' : 'failed'
  }
}
