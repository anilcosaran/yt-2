import { AuthClientError } from '@/lib/auth/errors'

import {
  issueFullAccessLimitCommand,
  revokeFullAccessConsent,
  setFullAccessWorkspacePolicy,
  type FullAccessState,
} from './full-access-api'
import {
  issueAssistantSpendPolicyCommand,
  type AssistantSpendPolicy,
} from './spend-policy-api'

/**
 * Y1-02 Settings > Approvals commands: each one is a CAS command against the version the page read, and the result is
 * explicit: `saved`, `conflict` (changed elsewhere; the page re-reads) or `failed`. Nothing is applied optimistically.
 */

export type SettingsSaveResult = 'saved' | 'conflict' | 'failed' | 'above_ceiling'

export type ApprovalsSettingsDeps = {
  issueLimit: typeof issueFullAccessLimitCommand
  setWorkspacePolicy: typeof setFullAccessWorkspacePolicy
  revoke: typeof revokeFullAccessConsent
  issuePolicy: typeof issueAssistantSpendPolicyCommand
}

const DEFAULT_DEPS: ApprovalsSettingsDeps = {
  issueLimit: issueFullAccessLimitCommand,
  setWorkspacePolicy: setFullAccessWorkspacePolicy,
  revoke: revokeFullAccessConsent,
  issuePolicy: issueAssistantSpendPolicyCommand,
}

async function guarded(run: () => Promise<SettingsSaveResult>): Promise<SettingsSaveResult> {
  try {
    return await run()
  } catch (error) {
    // A stale version surfaces as a result, never as a thrown error; a 409 from the gateway is read the same way.
    return error instanceof AuthClientError && error.status === 409 ? 'conflict' : 'failed'
  }
}

/** The user's Full access approval limit: on/off and/or the amount (`credits` null = the default amount). */
export function saveFullAccessLimit(
  state: FullAccessState,
  change: { enabled: boolean; credits?: number | null },
  deps: ApprovalsSettingsDeps = DEFAULT_DEPS,
): Promise<SettingsSaveResult> {
  return guarded(async () => {
    if (!state.limit) return 'failed'
    const result = await deps.issueLimit({
      enabled: change.enabled,
      ...(change.credits !== undefined ? { credits: change.credits } : {}),
      expectedLimitVersion: state.limit.limit_version,
    })
    if (result.outcome === 'applied' || result.outcome === 'replayed') return 'saved'
    return result.outcome === 'conflict' ? 'conflict' : 'failed'
  })
}

/** Owner / admin: members may use Full access only while the switch is on. */
export function saveFullAccessMembersSwitch(
  state: FullAccessState,
  allowMembers: boolean,
  deps: ApprovalsSettingsDeps = DEFAULT_DEPS,
): Promise<SettingsSaveResult> {
  return guarded(async () => {
    if (!state.workspace_policy.can_manage) return 'failed'
    const result = await deps.setWorkspacePolicy({
      allowMembers,
      expectedPolicyVersion: state.workspace_policy.policy_version,
    })
    if (result.outcome === 'applied' || result.outcome === 'unchanged') return 'saved'
    return 'conflict'
  })
}

/** Withdraws the one-time consent; the next switch to Full access asks again. */
export function revokeFullAccess(deps: ApprovalsSettingsDeps = DEFAULT_DEPS): Promise<SettingsSaveResult> {
  return guarded(async () => {
    await deps.revoke()
    return 'saved'
  })
}

/** The most the workspace lets a "don't ask below" be: its Auto ceiling A (null while the server does not say). */
export function autoFloorMaxCredits(policy: AssistantSpendPolicy | null): number | null {
  return policy?.auto_threshold?.ceiling_credits ?? null
}

/**
 * Auto: "don't ask below N credits" (null follows the tenant / plan value), at most the workspace's Auto ceiling A
 * (Y1R-MONEY-1: a larger value is refused, so nobody can switch the Auto question off). Loosens only the question, never
 * the balance stop.
 */
export function saveAutoAskFloor(
  policy: AssistantSpendPolicy,
  credits: number | null,
  deps: ApprovalsSettingsDeps = DEFAULT_DEPS,
): Promise<SettingsSaveResult> {
  return guarded(async () => {
    const max = autoFloorMaxCredits(policy)
    // The server decides (it knows A); this only saves a round trip when the page already knows the limit.
    if (credits !== null && max !== null && credits > max) return 'above_ceiling'
    const result = await deps.issuePolicy({ expectedPolicyVersion: policy.policy_version, autoAskMinCredits: credits })
    if (result.outcome === 'applied' || result.outcome === 'replayed') return 'saved'
    if (result.outcome === 'rejected_above_auto_ceiling') return 'above_ceiling'
    return result.outcome === 'conflict' ? 'conflict' : 'failed'
  })
}

/** The user's own optional cap on one job's estimate (null = no cap). */
export function saveJobCap(
  policy: AssistantSpendPolicy,
  credits: number | null,
  deps: ApprovalsSettingsDeps = DEFAULT_DEPS,
): Promise<SettingsSaveResult> {
  return guarded(async () => {
    const result = await deps.issuePolicy({ expectedPolicyVersion: policy.policy_version, jobMaxCredits: credits })
    if (result.outcome === 'applied' || result.outcome === 'replayed') return 'saved'
    return result.outcome === 'conflict' ? 'conflict' : 'failed'
  })
}
