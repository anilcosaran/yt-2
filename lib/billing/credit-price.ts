/**
 * Pure price/state helpers for the shared credit action button (`✦ Label [pill]` + status line).
 * Kept free of React so every state can be unit tested and reused by Tools and Avatar Studio.
 */

export type CreditPrice =
  | { kind: 'pending' }
  | { kind: 'free'; remaining?: number | null; limit?: number | null }
  | {
      kind: 'credits'
      /** Displayed price (what is expected to be charged). */
      credits: number
      approximate?: boolean
      /**
       * Peak credits the workflow reserves before it runs. The action needs at least this much
       * available even though the charge settles at `credits`.
       */
      reserveCredits?: number | null
    }
  | { kind: 'unavailable' }

export type CreditActionBlock =
  | 'upgrade'
  | 'insufficient'
  | 'reserve'
  | 'pending'
  | 'unavailable'
  | 'blocked'
  | 'busy'
  | null

export type CreditActionState = {
  /** The button cannot be clicked. */
  disabled: boolean
  /** Why it is disabled (or `null` when the action is available). */
  block: CreditActionBlock
  /** Credits the action needs, when the price is known and credit-based. */
  requiredCredits: number | null
  /** Credits that must be available to start (reservation peak), when above the price. */
  reserveCredits: number | null
  /** Credits the user has, when known. */
  availableCredits: number | null
  /** Show an `Add credits` path next to the status line. */
  showAddCredits: boolean
  /** Show an `Upgrade plan` path next to the status line. */
  showUpgrade: boolean
}

export type ResolveCreditActionStateInput = {
  price: CreditPrice
  /** Current spendable credits (plan-included + purchased). `null` when unknown. */
  availableCredits?: number | null
  /** The feature needs a higher plan. Wins over every other state. */
  upgradeRequired?: boolean
  /** The request was sent and is in flight. */
  busy?: boolean
  /** A caller-specific blocker (missing input, fair-use limit, ...). */
  blocked?: boolean
  /** Offer the upgrade path as a secondary option when credits are short (Basic). */
  suggestUpgradeWhenInsufficient?: boolean
}

export function resolveCreditActionState(input: ResolveCreditActionStateInput): CreditActionState {
  const availableCredits = isFiniteNumber(input.availableCredits) ? input.availableCredits : null
  const requiredCredits = input.price.kind === 'credits' ? normalizeCredits(input.price.credits) : null
  const reserveCredits = input.price.kind === 'credits'
    && isFiniteNumber(input.price.reserveCredits)
    && requiredCredits !== null
    && input.price.reserveCredits > requiredCredits
    ? normalizeCredits(input.price.reserveCredits)
    : null
  const base = {
    requiredCredits,
    reserveCredits,
    availableCredits,
    showAddCredits: false,
    showUpgrade: false,
  }
  if (input.upgradeRequired) {
    return { ...base, disabled: false, block: 'upgrade', showUpgrade: true }
  }
  if (input.busy) return { ...base, disabled: true, block: 'busy' }
  if (input.price.kind === 'pending') return { ...base, disabled: true, block: 'pending' }
  if (input.price.kind === 'unavailable') return { ...base, disabled: true, block: 'unavailable' }
  if (
    requiredCredits !== null
    && availableCredits !== null
    && availableCredits < requiredCredits
  ) {
    return {
      ...base,
      disabled: true,
      block: 'insufficient',
      showAddCredits: true,
      showUpgrade: Boolean(input.suggestUpgradeWhenInsufficient),
    }
  }
  if (reserveCredits !== null && availableCredits !== null && availableCredits < reserveCredits) {
    return {
      ...base,
      disabled: true,
      block: 'reserve',
      showAddCredits: true,
      showUpgrade: Boolean(input.suggestUpgradeWhenInsufficient),
    }
  }
  if (input.blocked) return { ...base, disabled: true, block: 'blocked' }
  return { ...base, disabled: false, block: null }
}

/** Rounds a credit amount for display (at most two decimals, trailing zeros removed). */
export function normalizeCredits(value: number) {
  if (!isFiniteNumber(value)) return 0
  const safe = Math.max(0, value)
  if (Number.isInteger(safe)) return safe
  const precision = safe < 0.01 ? 4 : 2
  return Number(safe.toFixed(precision))
}

export function creditPriceFromEstimate(input: {
  credits: number | null | undefined
  pending: boolean
  fallbackCredits?: number | null
  approximate?: boolean
  reserveCredits?: number | null
}): CreditPrice {
  const reserve = isFiniteNumber(input.reserveCredits) && input.reserveCredits > 0
    ? { reserveCredits: input.reserveCredits }
    : {}
  if (isFiniteNumber(input.credits) && input.credits > 0) {
    return { kind: 'credits', credits: normalizeCredits(input.credits), approximate: input.approximate, ...reserve }
  }
  if (input.pending) return { kind: 'pending' }
  if (isFiniteNumber(input.fallbackCredits) && input.fallbackCredits > 0) {
    return { kind: 'credits', credits: normalizeCredits(input.fallbackCredits), approximate: true, ...reserve }
  }
  return { kind: 'unavailable' }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
