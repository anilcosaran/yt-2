export type PlanActivationMode = 'immediate' | 'period_end'

export type PlanTransitionKind =
  | 'from_basic'
  | 'upgrade'
  | 'downgrade'
  | 'same_plan_period_change'
  | 'same_plan_same_period'

export interface PlanTransitionDecision {
  kind: PlanTransitionKind
  activationMode: PlanActivationMode | 'not_applicable'
}

/**
 * Mirrors api-gateway `resolvePlanTransition`. Catalog/sort order decides
 * level; the client cannot override the server decision.
 */
export function resolvePlanTransition(params: {
  currentPlan: string
  currentPeriod: string | null
  currentPlanOrder: number
  targetPlan: string
  targetPeriod: string
  targetPlanOrder: number
}): PlanTransitionDecision {
  const currentPlan = params.currentPlan.trim().toLowerCase()
  const targetPlan = params.targetPlan.trim().toLowerCase()
  const currentPeriod = normalizePeriod(params.currentPeriod)
  const targetPeriod = normalizePeriod(params.targetPeriod)

  if (currentPlan === 'basic') {
    return { kind: 'from_basic', activationMode: 'immediate' }
  }

  if (currentPlan === targetPlan && currentPeriod === targetPeriod) {
    return { kind: 'same_plan_same_period', activationMode: 'not_applicable' }
  }

  if (params.targetPlanOrder > params.currentPlanOrder) {
    return { kind: 'upgrade', activationMode: 'immediate' }
  }

  if (params.targetPlanOrder < params.currentPlanOrder) {
    return { kind: 'downgrade', activationMode: 'period_end' }
  }

  return { kind: 'same_plan_period_change', activationMode: 'period_end' }
}

function normalizePeriod(value: string | null): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}
