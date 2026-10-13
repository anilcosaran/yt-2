import type { CompositionCommandReceipt, CompositionDocument, CompositionOpSpec } from '../composition-client'
import type { SparkOptimisticInfo } from '../composition-session'
import type { SparkUndoGroup } from '../undo-group'

/**
 * The session side the stage writes through (Y1-07 `editor-interfaces.md` section 5). Every edit of the canvas is
 * `apply(specs)`: one command, one undo group, latest-wins coalescing per `coalesceKey` for bursts. The stage never sees
 * the write queue, receipts or CAS; it only learns whether the command applied and, through `onApplied`, which working
 * copy version it produced (its transient preview stays on screen until that version is drawn).
 */
export interface StageSessionPort {
  document(): CompositionDocument | null
  workingCopyVersion(): number
  /** Viewer role, archived project or a refused write: every write control is disabled. */
  readOnly(): boolean
  apply(
    specs: readonly CompositionOpSpec[],
    options?: {
      coalesceKey?: string
      onApplied?: (receipt: CompositionCommandReceipt) => void
      onOptimistic?: (info?: SparkOptimisticInfo) => void
      /** Timeline v3: the undo step the command opens (`SparkApplyOptions.undoGroup`). */
      undoGroup?: SparkUndoGroup
      /** Timeline v3: the undo step the command joins (`SparkApplyOptions.joinUndoGroup`). */
      joinUndoGroup?: SparkUndoGroup
    },
  ): Promise<boolean>
  /** E1-N: true when the session applies edits to its own copy of the document first (the stage draws them at once). */
  optimistic?(): boolean
  /** Conditional re-read of the working copy (no-op where the session has none). */
  refresh(): Promise<void>
  /** Selects the scene in the session (local view state). */
  selectScene(sceneId: string): void
}

/** The part of the editor's session actions and state the adapter reads (structural: the real session satisfies it). */
export type StageSessionActionsLike = {
  apply(
    specs: readonly CompositionOpSpec[],
    options?: { onApplied?: (receipt: CompositionCommandReceipt) => void; onOptimistic?: (info?: SparkOptimisticInfo) => void; coalesceKey?: string; undoGroup?: SparkUndoGroup; joinUndoGroup?: SparkUndoGroup },
  ): Promise<boolean>
  select(sceneId: string | null): void
  refresh?: (options?: { minVersion?: number }) => Promise<void>
}

export type StageSessionStateLike = {
  workingCopy: { workingCopyVersion: number; document: CompositionDocument; localRevision?: number } | null
  readOnly: boolean
  optimistic?: boolean
}

/**
 * Adapter over the editor's session. `read` returns the CURRENT state at call time (the stage holds the adapter across
 * renders, the session state changes under it).
 */
export function stageSessionPort(actions: StageSessionActionsLike, read: () => StageSessionStateLike): StageSessionPort {
  return {
    document: () => read().workingCopy?.document ?? null,
    workingCopyVersion: () => read().workingCopy?.workingCopyVersion ?? 0,
    readOnly: () => read().readOnly,
    apply: (specs, options) => actions.apply(specs, options),
    optimistic: () => read().optimistic === true,
    refresh: () => actions.refresh?.() ?? Promise.resolve(),
    selectScene: (sceneId) => actions.select(sceneId),
  }
}
