export function isFailedRunStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return normalized === 'failed'
    || normalized === 'error'
    || normalized === 'billing_failed'
    || normalized === 'reconciliation_required'
    || normalized === 'expired'
}

export function isTerminalRunStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return normalized === 'completed'
    || normalized === 'success'
    || normalized === 'succeeded'
    || normalized === 'done'
    || isFailedRunStatus(normalized)
    || normalized === 'cancelled'
    || normalized === 'canceled'
}

export function isCancellationLifecycleStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return normalized === 'cancelling'
    || normalized === 'draining'
    || normalized === 'settlement_pending'
}

export function isParkedRunStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return normalized === 'parked'
    || normalized === 'promoting'
    || normalized === 'waiting_for_credit'
    || normalized === 'failed_balance'
}

export function isQueuedRunStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return normalized === 'queued'
    || normalized === 'pending'
    || normalized === 'launching'
    || isParkedRunStatus(normalized)
}

export function isRunningRunStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return normalized === 'running'
    || normalized === 'started'
    || normalized === 'in_process'
    || normalized === 'in_progress'
    || normalized === 'processing'
    || normalized === 'executing'
    || isCancellationLifecycleStatus(normalized)
}

export function isActiveRunStatus(status: string | null | undefined) {
  return isQueuedRunStatus(status) || isRunningRunStatus(status)
}

export function isCancellableRunStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return (isActiveRunStatus(normalized) || normalized === 'paused' || isParkedRunStatus(normalized))
    && !isCancellationLifecycleStatus(normalized)
}

export function overlayCancelRequestedStatus(
  status: string | null | undefined,
  cancelRequested: boolean,
) {
  if (
    cancelRequested
    && !isCancellationLifecycleStatus(status)
    && !isTerminalRunStatus(status)
  ) {
    return 'cancelling'
  }
  return status
}
