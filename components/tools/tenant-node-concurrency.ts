export type TenantNodeQueueStatus = {
  status?: string | null
  queueReason?: string | null
  queueActiveCount?: number
  queueReservedCount?: number
  queueWaitingCount?: number
  queueConcurrencyLimit?: number
}

export function isRuntimeTerminal(status?: string | null) {
  return ['completed', 'succeeded', 'success', 'done', 'failed', 'error', 'cancelled', 'canceled', 'terminated', 'timed_out'].includes(status?.trim().toLowerCase() ?? '')
}

export function hasTenantNodeQueue(status?: TenantNodeQueueStatus | null) {
  return Boolean(status && !isRuntimeTerminal(status.status)
    && status.queueReason === 'tenant_node_concurrency_limit')
}

/** ERR-05: the provider is busy (E3949); the engine keeps the node queued and re-dispatches it. */
export function hasProviderBusyQueue(status?: TenantNodeQueueStatus | null) {
  return Boolean(status && !isRuntimeTerminal(status.status)
    && status.queueReason === 'provider_busy')
}

export function collectStatusPollTargets(
  records: readonly { id: string; launch?: { agent_id: string } | null; requestedAt: string }[],
  history: readonly { agentId: string; status: string; createdAt: string | null }[],
) {
  const targets = new Map<string, { id: string; launch: { agent_id: string }; requestedAt: string }>()
  for (const run of records) {
    if (run.launch?.agent_id) targets.set(run.launch.agent_id, { id: run.id, launch: run.launch, requestedAt: run.requestedAt })
  }
  for (const item of history) {
    if (item.agentId && !isRuntimeTerminal(item.status) && !targets.has(item.agentId)) {
      targets.set(item.agentId, { id: item.agentId, launch: { agent_id: item.agentId }, requestedAt: item.createdAt ?? new Date(0).toISOString() })
    }
  }
  return [...targets.values()]
}
