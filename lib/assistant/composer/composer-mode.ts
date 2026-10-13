/**
 * P03-01 / Q74: the composer mode chip has three levels — Ask, Auto, Tam erişim (`auto_full`). The chip is a view of
 * server settings (P00-11/P01-11 settings commands are the only authority); the `mode` inside a message's
 * `composer_selection` is only a hint. `auto_full` needs the user's one-time full-access consent; without it the
 * server answers `rejected_full_access_consent_required` and the chip stays on the committed mode.
 */

export const COMPOSER_MODES = ['ask', 'auto', 'auto_full'] as const
export type ComposerMode = (typeof COMPOSER_MODES)[number]

/** Q62: a new conversation starts in `auto`. */
export const COMPOSER_DEFAULT_MODE: ComposerMode = 'auto'

export function isComposerMode(value: unknown): value is ComposerMode {
  return typeof value === 'string' && (COMPOSER_MODES as readonly string[]).includes(value)
}

/** Legacy `approval_mode` spelling (`autonomous` = `auto`) read into the canonical mode. */
export function composerModeFromLegacy(value: unknown): ComposerMode | null {
  if (value === 'autonomous') return 'auto'
  return isComposerMode(value) ? value : null
}

/** Legacy mirror for clients/fields that still carry `approval_mode` (`auto_full` has no legacy spelling). */
export function legacyApprovalModeOf(mode: ComposerMode): 'ask' | 'autonomous' {
  return mode === 'ask' ? 'ask' : 'autonomous'
}

/** The chip cycles through the modes the catalog offers, in Q74 order. */
export function nextComposerMode(current: ComposerMode, available: readonly ComposerMode[] = COMPOSER_MODES): ComposerMode {
  const ordered = COMPOSER_MODES.filter((mode) => available.includes(mode))
  if (ordered.length === 0) return current
  const index = ordered.indexOf(current)
  return ordered[(index + 1) % ordered.length] ?? current
}

type ModeSettingsSnapshot = {
  defaults: { default_mode: ComposerMode }
  job: { requested_mode?: ComposerMode | null; effective_mode?: ComposerMode | null } | null
} | null | undefined

export type ComposerModeView = {
  /** Committed mode: the selected job's requested mode, else the conversation's new-job default. */
  selectedMode: ComposerMode | null
  /** The mode the selected job runs with now (null without a selected job). */
  effectiveMode: ComposerMode | null
  /** The selected job asked for Tam erişim but runs as Auto (consent missing or not yet effective). */
  fullAccessPending: boolean
}

export function composerModeView(settings: ModeSettingsSnapshot): ComposerModeView {
  if (!settings) return { selectedMode: null, effectiveMode: null, fullAccessPending: false }
  const job = settings.job
  const requested = job?.requested_mode ?? null
  if (!job || !requested) {
    return { selectedMode: settings.defaults.default_mode, effectiveMode: null, fullAccessPending: false }
  }
  const effective = job.effective_mode ?? requested
  return {
    selectedMode: requested,
    effectiveMode: effective,
    fullAccessPending: requested === 'auto_full' && effective !== 'auto_full',
  }
}

export type ComposerModeCommandResult =
  | 'applied'
  | 'stale'
  | 'target_gone'
  | 'consent_required'
  | 'forbidden'
  | 'failed'

/** Every non-applied outcome leaves settings unchanged; the chip re-reads the server state. */
export function classifyComposerModeCommand(outcome: string): ComposerModeCommandResult {
  switch (outcome) {
    case 'applied':
    case 'replayed':
      return 'applied'
    case 'conflict':
      return 'stale'
    case 'rejected_target_not_found':
    case 'rejected_target_terminal':
    case 'rejected_missing_target':
      return 'target_gone'
    case 'rejected_full_access_consent_required':
      return 'consent_required'
    case 'rejected_forbidden':
    case 'rejected_defaults_owner_only':
      return 'forbidden'
    default:
      return 'failed'
  }
}
