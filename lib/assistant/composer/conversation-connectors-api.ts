import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P03-25 client of the Assistant's per-conversation connector switches (`/api/v1/assistant-conversation-connectors`).
 * Only switched connections are listed; a connection without an entry is on. The switch lives on the server
 * (never in browser storage) and the Connector applies it at every dispatch decision of this conversation.
 */

const switchSchema = z.object({
  connection_id: z.string().min(1).max(128),
  enabled: z.boolean(),
  version: z.number().int().min(0),
  updated_at: z.string(),
})

const scopeResponseSchema = z.object({
  data: z.object({
    schema_version: z.literal('assistant_conversation_connector_scope_v1'),
    conversation_id: z.string(),
    connections: z.array(switchSchema).catch([]),
  }),
})

const switchResponseSchema = z.object({ data: switchSchema })

export type ConversationConnectorSwitch = z.infer<typeof switchSchema>

export type ConversationConnectorScope = {
  conversationId: string
  switches: ConversationConnectorSwitch[]
  /** Connections switched off in this conversation. */
  disabledConnectionIds: ReadonlySet<string>
}

export function conversationConnectorsQueryKey(conversationId: string | null) {
  return ['assistant', 'conversation-connectors', conversationId] as const
}

export function toConversationConnectorScope(conversationId: string, switches: readonly ConversationConnectorSwitch[]): ConversationConnectorScope {
  return {
    conversationId,
    switches: [...switches],
    disabledConnectionIds: new Set(switches.filter((entry) => !entry.enabled).map((entry) => entry.connection_id)),
  }
}

export async function getConversationConnectorScope(
  conversationId: string,
  options: { signal?: AbortSignal } = {},
): Promise<ConversationConnectorScope> {
  const result = await gatewayRequest(`/api/v1/assistant-conversation-connectors/${encodeURIComponent(conversationId)}`, {
    schema: scopeResponseSchema,
    signal: options.signal,
  })
  return toConversationConnectorScope(result.data.conversation_id, result.data.connections)
}

export async function setConversationConnectorEnabled(input: {
  conversationId: string
  connectionId: string
  enabled: boolean
  /** Version of the switch the user saw (0 = never switched); a newer switch answers 409. */
  expectedVersion?: number
}): Promise<ConversationConnectorSwitch> {
  const result = await gatewayRequest(
    `/api/v1/assistant-conversation-connectors/${encodeURIComponent(input.conversationId)}/connections/${encodeURIComponent(input.connectionId)}`,
    {
      method: 'POST',
      csrf: true,
      body: { enabled: input.enabled, ...(input.expectedVersion !== undefined ? { expected_version: input.expectedVersion } : {}) },
      schema: switchResponseSchema,
    },
  )
  return result.data
}
