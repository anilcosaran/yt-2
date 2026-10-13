'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  conversationConnectorsQueryKey,
  getConversationConnectorScope,
  setConversationConnectorEnabled,
  toConversationConnectorScope,
  type ConversationConnectorScope,
} from './conversation-connectors-api'

/**
 * P03-25 per-conversation connector switches (server state only). Before the conversation exists every connection
 * is on (nothing to switch yet). `setEnabled` sends the version the user saw; on a conflict the scope is re-read and
 * the latest server state is shown.
 */
export function useConversationConnectors(input: { conversationId: string | null; enabled: boolean }): {
  scope: ConversationConnectorScope | null
  loading: boolean
  error: boolean
  pending: boolean
  setEnabled: (connectionId: string, enabled: boolean) => Promise<boolean>
} {
  const queryClient = useQueryClient()
  const key = conversationConnectorsQueryKey(input.conversationId)
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getConversationConnectorScope(input.conversationId!, { signal }),
    enabled: input.enabled && Boolean(input.conversationId),
    staleTime: 30_000,
  })
  const mutation = useMutation({
    mutationFn: setConversationConnectorEnabled,
    onSuccess: (saved) => {
      queryClient.setQueryData<ConversationConnectorScope>(key, (current) => {
        if (!current) return current
        const switches = [...current.switches.filter((entry) => entry.connection_id !== saved.connection_id), saved]
        return toConversationConnectorScope(current.conversationId, switches)
      })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
  const scope = query.data ?? null
  const { mutateAsync } = mutation
  const setEnabled = React.useCallback(async (connectionId: string, enabled: boolean) => {
    if (!input.conversationId) return false
    const seen = scope?.switches.find((entry) => entry.connection_id === connectionId)?.version ?? 0
    try {
      await mutateAsync({ conversationId: input.conversationId, connectionId, enabled, expectedVersion: seen })
      return true
    } catch {
      return false
    }
  }, [input.conversationId, mutateAsync, scope])
  return {
    scope,
    loading: query.isLoading,
    error: query.isError,
    pending: mutation.isPending,
    setEnabled,
  }
}
