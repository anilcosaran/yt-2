'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { stableClientFingerprint } from '@/lib/idempotency/client-mutation-control'
import { estimateWorkflowAgent } from '@/lib/workflows/api'

export const AGENT_ESTIMATE_QUERY_KEY = ['workflow-agent', 'estimate'] as const

export function agentEstimateQueryKey(input: {
  channelId: string | null | undefined
  nodeType: string
  paramsHash: string
}) {
  return [...AGENT_ESTIMATE_QUERY_KEY, input.channelId ?? 'none', input.nodeType, input.paramsHash] as const
}

/**
 * Thin wrapper around `POST /api/v1/workflows/agents/estimate` for price pills.
 * The query is keyed by a stable hash of `params`, so callers should keep the params free of
 * values that do not change the price (for example the free-text prompt) to avoid refetching
 * on every keystroke.
 */
export function useAgentEstimate(input: {
  channelId: string | null | undefined
  nodeType: string
  params: Record<string, unknown>
  enabled?: boolean
  keyPrefix?: string
}) {
  const paramsHash = React.useMemo(() => stableClientFingerprint(input.params), [input.params])
  const enabled = Boolean((input.enabled ?? true) && input.channelId && input.nodeType)
  const query = useQuery({
    queryKey: agentEstimateQueryKey({ channelId: input.channelId, nodeType: input.nodeType, paramsHash }),
    queryFn: ({ signal }) => estimateWorkflowAgent({
      channelId: input.channelId,
      nodeType: input.nodeType,
      params: input.params,
      idempotencyKey: `${input.keyPrefix ?? 'credit-estimate'}:${paramsHash}`,
    }, { signal }),
    enabled,
    retry: false,
    staleTime: 120_000,
  })
  return {
    credits: query.data?.total_credits_estimated ?? null,
    pending: enabled && query.isFetching && !query.data,
    error: query.error,
    refetch: query.refetch,
  }
}
