/**
 * PIPE-05 (5 Oct speed package): which earlier run the next run of a saved workflow reuses finished steps from.
 *
 * After a review gate asked for changes (the user edits the workflow and runs it again) or after a failed run (run
 * again = retry), every step whose resolved inputs did not change reuses that run's finished, already charged result:
 * it is neither run nor charged again, and only the changed or failed branch runs. A rejected review or a completed or
 * cancelled run starts fresh, so "Run" there still produces new results. The gateway checks that the source belongs to
 * the same workflow; the engine decides per step (WORKFLOW_RETRY_RESULT_REUSE_ENABLED).
 */
export type ReviewStopAction = 'reject' | 'request_changes'

export function getNextRunResultReuseSource(input: {
  workflowId: string | null | undefined
  status: string | null | undefined
  reviewStopAction: ReviewStopAction | null
}): string | null {
  const workflowId = input.workflowId?.trim()
  if (!workflowId) return null
  if (input.reviewStopAction === 'reject') return null
  if (input.reviewStopAction === 'request_changes') return workflowId
  return input.status?.trim().toLowerCase() === 'failed' ? workflowId : null
}
