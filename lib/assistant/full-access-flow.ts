import { AuthClientError } from '@/lib/auth/errors'

import {
  acceptFullAccessConsent,
  getFullAccessState,
  type FullAccessState,
} from './full-access-api'

/**
 * Y1-02 Full access flow rules, kept pure and transport-injected so the card, the composer chip and the settings
 * page share one behaviour: switching needs the server's `effective` consent, otherwise the one-time warning card
 * asks; a changed warning text asks again with the new revision; members need the workspace switch.
 */

export type FullAccessSwitchPlan =
  /** The consent is effective: the settings command goes out with this consent id. */
  | { kind: 'ready'; consentId: string }
  /** Show the one-time warning card for `state.warning_revision`. */
  | { kind: 'needs_consent'; state: FullAccessState }
  /** A member of a workspace that has not allowed Full access for members. */
  | { kind: 'blocked'; reason: 'members_not_allowed' }

export function planFullAccessSwitch(state: FullAccessState): FullAccessSwitchPlan {
  if (!state.can_enable) return { kind: 'blocked', reason: state.ineligible_reason ?? 'members_not_allowed' }
  if (state.effective && state.consent && state.consent.revoked_at === null) {
    return { kind: 'ready', consentId: state.consent.consent_id }
  }
  return { kind: 'needs_consent', state }
}

export type FullAccessConsentOutcome =
  | { kind: 'accepted'; consentId: string }
  /** The warning text changed while the card was open: show the new revision and ask again. */
  | { kind: 'revision_changed'; state: FullAccessState }
  | { kind: 'blocked'; reason: 'members_not_allowed' }
  | { kind: 'failed' }

export type FullAccessConsentDeps = {
  accept: typeof acceptFullAccessConsent
  getState: typeof getFullAccessState
}

const DEFAULT_DEPS: FullAccessConsentDeps = { accept: acceptFullAccessConsent, getState: getFullAccessState }

/**
 * The card's "Turn on Full access": records the consent for exactly the revision the card showed. A 409 means the
 * revision is outdated (re-read and ask again), a 403 means the workspace does not allow members.
 */
export async function acceptFullAccessConsentFlow(
  input: { state: FullAccessState; shownAt: Date },
  deps: FullAccessConsentDeps = DEFAULT_DEPS,
): Promise<FullAccessConsentOutcome> {
  try {
    const result = await deps.accept({ warningRevision: input.state.warning_revision, shownAt: input.shownAt })
    return { kind: 'accepted', consentId: result.consent.consent_id }
  } catch (error) {
    if (!(error instanceof AuthClientError)) return { kind: 'failed' }
    if (error.status === 403) return { kind: 'blocked', reason: 'members_not_allowed' }
    if (error.status === 409) {
      try {
        const fresh = await deps.getState()
        return fresh.warning_revision !== input.state.warning_revision ? { kind: 'revision_changed', state: fresh } : { kind: 'failed' }
      } catch {
        return { kind: 'failed' }
      }
    }
    return { kind: 'failed' }
  }
}

/** The limit the warning card names: the amount in force, "off" when the user turned it off, unknown when not read. */
export type FullAccessLimitCopy =
  | { kind: 'amount'; credits: number }
  | { kind: 'off' }
  | { kind: 'unknown' }

export function fullAccessLimitCopy(state: FullAccessState): FullAccessLimitCopy {
  if (!state.limit) return { kind: 'unknown' }
  if (!state.limit.enabled || state.limit.effective_credits === null) return { kind: 'off' }
  return { kind: 'amount', credits: state.limit.effective_credits }
}

/** A credit amount typed into a settings field. */
export type CreditsInput = { ok: true; value: number } | { ok: false }

export const CREDITS_INPUT_MAX = 99_999_999

/**
 * Parses what a user typed as a credit amount (at most four decimals, `,` or `.` as the decimal mark). `allowZero` is
 * for "don't ask below N" (0 = always ask); limits and caps must be greater than zero.
 */
export function parseCreditsInput(text: string, options: { allowZero?: boolean } = {}): CreditsInput {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,4})?$/.test(normalized)) return { ok: false }
  const value = Number(normalized)
  if (!Number.isFinite(value) || value > CREDITS_INPUT_MAX) return { ok: false }
  if (value === 0 && !options.allowZero) return { ok: false }
  return { ok: true, value }
}

/** Credits as shown to people: grouped, at most two decimals. */
export function formatCredits(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.round(value * 100) / 100)
}

/**
 * The credit amount of the user's own Full access limit that the latest approval question named
 * (`content_json.full_access_limit_credits`, written by the server when a Full access job exceeded the limit), while the
 * run waits for the user. Null when the pending question is an ordinary one.
 */
export function findFullAccessLimitAsk(
  messages: ReadonlyArray<{ role: string; run_id: string | null; content_json: Record<string, unknown> }>,
  runId: string | null,
  runState: string | null,
): number | null {
  if (!runId || runState !== 'waiting_for_user') return null
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message) continue
    if (message.role === 'user') return null
    if (message.role !== 'assistant' || message.run_id !== runId) continue
    const type = message.content_json['type']
    if (type !== 'assistant.approval_required_message' && type !== 'assistant.workflow_draft') continue
    const credits = message.content_json['full_access_limit_credits']
    return typeof credits === 'number' && Number.isFinite(credits) && credits >= 0 ? credits : null
  }
  return null
}
