import type { AssistantMessage, AssistantRunEvent } from '@/lib/assistant/api'

/**
 * What the chat shows for a failed job, read only from the server's `run.failed` event (never guessed from text).
 *
 * S12/S26 (decision 2026-09-27): `ASSISTANT_SKILL_REVOKED` means a skill the plan relied on was revoked or turned off
 * before its next step; nothing was started. The card offers one explicit action — prepare the plan again without that
 * skill — because a new plan is a new (visible, paid) planner call; the server never re-plans on its own.
 */
export type AssistantRunFailureKind = 'credits' | 'service' | 'skill_removed' | 'reply'

export type AssistantRunFailure = {
  kind: AssistantRunFailureKind
  /** Server cause under the error code (`skill_revoked` / `skill_unavailable` for a removed skill). */
  reasonCode: string | null
}

export const ASSISTANT_SKILL_REVOKED_ERROR_CODE = 'ASSISTANT_SKILL_REVOKED'

export function classifyAssistantRunFailure(events: readonly AssistantRunEvent[], runId: string): AssistantRunFailure {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event || event.run_id !== runId || event.event_type !== 'run.failed') continue
    const errorCode = readString(event.payload.error_code)
    const reasonCode = readString(event.payload.reason_code)
    if (errorCode === 'ASSISTANT_PAYMENT_REQUIRED') return { kind: 'credits', reasonCode }
    if (errorCode === 'SERVICE_UNAVAILABLE') return { kind: 'service', reasonCode }
    if (errorCode === ASSISTANT_SKILL_REVOKED_ERROR_CODE) return { kind: 'skill_removed', reasonCode }
    return { kind: 'reply', reasonCode }
  }
  return { kind: 'reply', reasonCode: null }
}

/** The user message that started the job (its first user message), or null when it is not loaded. */
export function findRunTriggerMessage(messages: readonly AssistantMessage[], runId: string): AssistantMessage | null {
  for (const message of messages) {
    if (message.role === 'user' && message.run_id === runId && !message.deleted_at && message.content.trim()) return message
  }
  return null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
