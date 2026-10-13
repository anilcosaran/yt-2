/**
 * Timeline v3 (instant media add): an opaque handle naming ONE undo step across several commands of the editor session. The
 * command applied with `SparkApplyOptions.undoGroup: handle` opens the step; a later command applied with
 * `joinUndoGroup: handle` joins it (the gateway appends it to the same `undo_group_id`), so one undo reverts both — e.g. media
 * inserted at once with the fit known up front, then its exact fit once the picture's size is read (`composition-session.ts`).
 *
 * A plain object compared by identity; it carries nothing and is never sent anywhere (the session keeps the group id).
 */
export type SparkUndoGroup = { readonly kind: 'spark_undo_group' }

export function createSparkUndoGroup(): SparkUndoGroup {
  return { kind: 'spark_undo_group' }
}
