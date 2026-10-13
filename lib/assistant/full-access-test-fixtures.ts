import type { FullAccessState } from './full-access-api'
import type { AssistantSpendJobMeter, AssistantSpendMeter, AssistantSpendReceipt } from './spend-meter-api'
import type { AssistantSpendPolicy } from './spend-policy-api'

/** Y1-02 test fixtures: server payloads of the Full access, meter, receipt and spend policy reads (frozen times). */

export const FULL_ACCESS_WARNING_REVISION = 'full_access_warning_v1'

export const FULL_ACCESS_CONSENT = {
  consent_id: 'fac_1',
  warning_revision: FULL_ACCESS_WARNING_REVISION,
  shown_at: '2026-10-01T10:00:00.000Z',
  accepted_at: '2026-10-01T10:00:05.000Z',
  revoked_at: null,
}

export function fullAccessState(patch: Partial<FullAccessState> = {}): FullAccessState {
  return {
    warning_revision: FULL_ACCESS_WARNING_REVISION,
    consent_state: 'none',
    consent: null,
    effective: false,
    can_enable: true,
    ineligible_reason: null,
    actor_role: 'owner',
    limit: { enabled: true, credits: null, effective_credits: 1000, default_credits: 1000, source: 'default', limit_version: 0, updated_at: null },
    workspace_policy: { allow_members: false, policy_version: 0, can_manage: true, updated_at: null },
    ...patch,
  }
}

export function jobMeter(patch: Partial<AssistantSpendJobMeter> = {}): AssistantSpendJobMeter {
  return {
    job_id: 'run-1',
    run_id: 'run-1',
    envelope_id: 'env_1',
    envelope_status: 'open',
    phase: 'production',
    mode: 'auto',
    basis: 'mode_snapshot',
    approved_ceiling_credits: 120,
    spent_credits: 41.2,
    outstanding_credits: 18,
    remaining_credits: 60.8,
    overrun_credits: 0,
    state: 'within_ceiling',
    pending_approval: null,
    ...patch,
  }
}

export function spendMeter(patch: Partial<AssistantSpendMeter> = {}): AssistantSpendMeter {
  const job = jobMeter()
  return {
    conversation_id: 'conv-1',
    as_of: '2026-10-01T10:00:00.000Z',
    enforcement: 'job_spend_envelope',
    balance: { spendable_credits: 812.5, plan_credits: 1000 },
    threshold: {
      auto_ask_at_credits: 500,
      base_credits: 1000,
      ratio_bps: 5000,
      floor_credits: 100,
      ceiling_credits: 1000,
      user_min_credits: null,
    },
    job_cap: { credits: null, source: null },
    job,
    jobs: [job],
    ...patch,
  }
}

export function disabledSpendMeter(): AssistantSpendMeter {
  return spendMeter({ enforcement: 'disabled', balance: null, threshold: null, job: null, jobs: [] })
}

export function spendReceipt(patch: Partial<AssistantSpendReceipt> = {}): AssistantSpendReceipt {
  return {
    run_id: 'run-1',
    job_id: 'run-1',
    conversation_id: 'conv-1',
    envelope_id: 'env_1',
    final: true,
    spent_credits: 41.2,
    outstanding_credits: 0,
    approved_ceiling_credits: 120,
    overrun_credits: 0,
    balance_after_credits: 958.8,
    as_of: '2026-10-01T10:05:00.000Z',
    lines: [
      { kind: 'planning', credits: 1.2, status: 'settled' },
      { kind: 'preparation', credits: 12, status: 'settled' },
      { kind: 'production', credits: 28, status: 'settled' },
    ],
    lines_truncated: false,
    ...patch,
  }
}

export function spendPolicy(patch: Partial<AssistantSpendPolicy> = {}): AssistantSpendPolicy {
  return {
    policy_version: 2,
    enforcement: 'job_spend_envelope',
    auto_ask_min_credits: null,
    job_max_credits: null,
    auto_threshold: { ratio_bps: 5000, floor_credits: 100, ceiling_credits: 1000, effective_floor_credits: 100 },
    tenant_job_cap_credits: null,
    effective_job_cap_credits: null,
    ...patch,
  }
}
