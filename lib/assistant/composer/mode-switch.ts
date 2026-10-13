import { issueAssistantModeCommand } from '@/lib/assistant/api'
import { getFullAccessState, type FullAccessState } from '@/lib/assistant/full-access-api'
import { planFullAccessSwitch } from '@/lib/assistant/full-access-flow'

import { classifyComposerModeCommand, type ComposerMode, type ComposerModeCommandResult } from './composer-mode'

/**
 * Y1-02: the composer mode switch as one transport-injected flow. Ask and Auto go straight to the settings command.
 * Full access (`auto_full`) first asks the server for the user's Full access state: an effective consent id goes with
 * the command (the server requires it), a missing one opens the one-time warning card, a member of a workspace that
 * does not allow Full access is told so. A command the server refuses for consent (revoked in settings meanwhile)
 * opens the card again instead of failing.
 */

export type ModeNotice = Exclude<ComposerModeCommandResult, 'applied'> | 'members_not_allowed' | 'full_access_unavailable'

export type ModeSwitchResult =
  | { kind: 'applied' }
  | { kind: 'needs_consent'; state: FullAccessState }
  | { kind: 'notice'; notice: ModeNotice }

export type ModeSwitchDeps = {
  issueCommand: typeof issueAssistantModeCommand
  getState: typeof getFullAccessState
}

const DEFAULT_DEPS: ModeSwitchDeps = { issueCommand: issueAssistantModeCommand, getState: getFullAccessState }

type ConsentResolution =
  | { kind: 'ready'; consentId: string }
  | { kind: 'needs_consent'; state: FullAccessState }
  | { kind: 'notice'; notice: ModeNotice }

async function resolveFullAccessConsent(deps: ModeSwitchDeps): Promise<ConsentResolution> {
  let state: FullAccessState
  try {
    state = await deps.getState()
  } catch {
    return { kind: 'notice', notice: 'full_access_unavailable' }
  }
  const plan = planFullAccessSwitch(state)
  if (plan.kind === 'ready') return plan
  if (plan.kind === 'blocked') return { kind: 'notice', notice: 'members_not_allowed' }
  return plan
}

/**
 * Before a conversation exists: the picked mode is local until the first send. Full access needs the consent first
 * (`ready` carries the consent id the first send commits with).
 */
export async function planDraftComposerMode(
  mode: ComposerMode,
  deps: ModeSwitchDeps = DEFAULT_DEPS,
): Promise<{ kind: 'ready'; consentId: string | null } | { kind: 'needs_consent'; state: FullAccessState } | { kind: 'notice'; notice: ModeNotice }> {
  if (mode !== 'auto_full') return { kind: 'ready', consentId: null }
  return resolveFullAccessConsent(deps)
}

export type SwitchComposerModeInput = {
  mode: ComposerMode
  conversationId: string
  expectedConversationDefaultsVersion: number
  /** The selected job (applies to it and to new jobs); null changes only the new-job default. */
  selectedJob: { jobId: string; expectedJobSettingsVersion: number } | null
  /** A consent id the caller already holds (the card just recorded it, or the draft picked it up). */
  consentId?: string | null
}

export async function switchComposerMode(
  input: SwitchComposerModeInput,
  deps: ModeSwitchDeps = DEFAULT_DEPS,
): Promise<ModeSwitchResult> {
  let consentId = input.consentId ?? null
  if (input.mode === 'auto_full' && !consentId) {
    const resolution = await resolveFullAccessConsent(deps)
    if (resolution.kind !== 'ready') return resolution
    consentId = resolution.consentId
  }
  let outcome: ComposerModeCommandResult
  try {
    const result = await deps.issueCommand({
      conversationId: input.conversationId,
      mode: input.mode,
      expectedConversationDefaultsVersion: input.expectedConversationDefaultsVersion,
      selectedJob: input.selectedJob,
      fullAccessConsentId: input.mode === 'auto_full' ? consentId : null,
    })
    outcome = classifyComposerModeCommand(result.outcome)
  } catch {
    return { kind: 'notice', notice: 'failed' }
  }
  if (outcome === 'applied') return { kind: 'applied' }
  if (outcome !== 'consent_required') return { kind: 'notice', notice: outcome }
  // The consent is gone or outdated on the server (revoked in settings, new warning text): ask again.
  const again = await resolveFullAccessConsent(deps)
  return again.kind === 'ready' ? { kind: 'notice', notice: 'consent_required' } : again
}
