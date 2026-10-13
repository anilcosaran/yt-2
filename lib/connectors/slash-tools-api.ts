import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P03-25 client of `GET /api/v1/connector-slash-tools`: the signed-in user's enabled connections and their approved
 * tools for the composer's `/` menu "Connections" group. Server data only; a malformed entry is dropped, never
 * repaired. Listing executes nothing: a selected tool is only a `preferred_tools` hint.
 */

const toolSchema = z.object({
  tool_name: z.string().min(1).max(128),
  tool_revision_id: z.string().min(1).max(128),
  capability_keys: z.array(z.string()).catch([]),
  effect: z.string(),
})

const connectionSchema = z.object({
  connection_id: z.string().min(1).max(128),
  connection_revision: z.number().int().min(0),
  connector_definition_id: z.string().min(1).max(128),
  connector_slug: z.string().min(1).max(128),
  display_name: z.string().min(1).max(255),
  account_label: z.string().max(255).nullable().catch(null),
  shared: z.boolean().catch(false),
  tools: z.array(z.unknown()).catch([]),
})

const responseSchema = z.object({
  data: z.object({
    schema_version: z.literal('connector_slash_tools_v1'),
    feature: z.enum(['enabled', 'disabled']).catch('disabled'),
    connections: z.array(z.unknown()).catch([]),
  }),
})

export type ConnectorSlashTool = z.infer<typeof toolSchema>
export type ConnectorSlashConnection = Omit<z.infer<typeof connectionSchema>, 'tools'> & { tools: ConnectorSlashTool[] }

export const CONNECTOR_SLASH_TOOLS_QUERY_KEY = ['connectors', 'slash-tools'] as const

export function parseConnectorSlashConnections(raw: readonly unknown[]): ConnectorSlashConnection[] {
  const connections: ConnectorSlashConnection[] = []
  for (const entry of raw) {
    const parsed = connectionSchema.safeParse(entry)
    if (!parsed.success) continue
    const tools: ConnectorSlashTool[] = []
    for (const tool of parsed.data.tools) {
      const parsedTool = toolSchema.safeParse(tool)
      if (parsedTool.success) tools.push(parsedTool.data)
    }
    connections.push({ ...parsed.data, tools })
  }
  return connections
}

export async function getConnectorSlashTools(options: { signal?: AbortSignal } = {}): Promise<ConnectorSlashConnection[]> {
  const result = await gatewayRequest('/api/v1/connector-slash-tools', { schema: responseSchema, signal: options.signal })
  return result.data.feature === 'enabled' ? parseConnectorSlashConnections(result.data.connections) : []
}
