import { AuthClientError } from '@/lib/auth/errors'

export function isWorkflowSettlementPending(error: unknown): boolean {
  if (!(error instanceof AuthClientError) || error.status !== 409) return false
  const details = error.details
  return Boolean(details && typeof details === 'object'
    && 'billing_settlement_pending' in details && details.billing_settlement_pending === true
    && !('payment_risk_pending' in details && details.payment_risk_pending === true))
}

// Only the temporary output-delivery fence may be retried. All other 4xx and
// infrastructure errors remain visible; long settlement requires manual retry.
export function retryWorkflowSettlementOutput(failureCount: number, error: unknown): boolean {
  return failureCount < 8 && isWorkflowSettlementPending(error)
}

export function workflowSettlementRetryDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 15_000)
}
