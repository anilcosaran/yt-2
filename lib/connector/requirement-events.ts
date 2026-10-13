'use client'

/**
 * In-memory fan-out of `assistant.connection_requirement.updated` run events from the conversation's single SSE
 * stream to the connection cards on screen (P03-18: no per-card polling or stream). Nothing is persisted: a card
 * that mounts later reads the server state itself.
 */
type Listener = (event: { requirementId: string; version: number; state: string }) => void

const listeners = new Set<Listener>()

export function subscribeConnectionRequirementEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Called by the chat stream handler with a parsed run event payload. */
export function publishConnectionRequirementEvent(payload: Record<string, unknown> | null | undefined): void {
  const requirement = payload?.connection_requirement
  if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) return
  const record = requirement as Record<string, unknown>
  const requirementId = typeof record.connection_requirement_id === 'string' ? record.connection_requirement_id : null
  const version = typeof record.version === 'number' ? record.version : null
  const state = typeof record.state === 'string' ? record.state : null
  if (!requirementId || version === null || !state) return
  for (const listener of [...listeners]) listener({ requirementId, version, state })
}
