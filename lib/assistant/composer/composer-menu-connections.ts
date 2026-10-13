import { createToolChip } from './composer-state'
import type { ComposerMenuItem } from './composer-menu'
import { connectorToolRefSchema, type ConnectorToolRef } from './owner-refs'

/**
 * P03-25 "Connections" group of the `/` menu (connectors/MIMARI §7, K348). Each approved tool of each connection that
 * is on (account `enabled` — the server lists only those — ∩ not switched off in this conversation) becomes one item:
 * its label is the tool's full name (`notion.search`), its description the service and account. Selecting it adds a
 * `connector_tool` chip that the message sends as `preferred_tools`; nothing executes. The account itself is picked
 * with `@` (or asked by the server when ambiguous), so two accounts of one service give the same chip.
 */

/** Structural slice of a connection from `GET /api/v1/connector-slash-tools` (`lib/connectors/slash-tools-api.ts`). */
export type SlashConnectionSource = {
  connection_id: string
  connector_definition_id: string
  connector_slug: string
  display_name: string
  account_label: string | null
  tools: ReadonlyArray<{ tool_name: string; tool_revision_id: string }>
}

export function slashConnectionItems(
  connections: readonly SlashConnectionSource[],
  options: { disabledConnectionIds?: ReadonlySet<string>; normalize: (value: string) => string },
): ComposerMenuItem[] {
  const items: ComposerMenuItem[] = []
  for (const connection of connections) {
    // Switched off in this conversation: never offered (and never called — the Connector applies the same switch).
    if (options.disabledConnectionIds?.has(connection.connection_id)) continue
    const service = connection.display_name.trim() || connection.connector_slug
    for (const tool of connection.tools) {
      const parsed = connectorToolRefSchema.safeParse({
        ref_type: 'connector_tool',
        connector_definition_id: connection.connector_definition_id,
        tool_name: tool.tool_name,
        tool_revision_id: tool.tool_revision_id,
      } satisfies ConnectorToolRef)
      if (!parsed.success) continue
      const chip = createToolChip(parsed.data, tool.tool_name)
      items.push({
        id: `${chip.key}|${connection.connection_id}`,
        group: 'connections',
        label: tool.tool_name,
        description: connection.account_label ? `${service} · ${connection.account_label}` : service,
        chip,
        search: options.normalize(`${service} ${connection.connector_slug} ${tool.tool_name}`),
        fullName: tool.tool_name.toLowerCase(),
        connectionId: connection.connection_id,
      })
    }
  }
  return items
}

/**
 * K348 name collision: Youtorch tool > user skill > connector. When the typed name is exactly a Youtorch tool's or a
 * skill's name, connector tools are reachable only by their full name (`/notion.search`).
 */
export function connectionItemRank(
  item: ComposerMenuItem,
  query: { raw: string; needle: string; shadowed: boolean },
  rank: (haystack: string, needle: string) => number | null,
): number | null {
  if (query.raw.includes('.')) return item.fullName?.startsWith(query.raw) ? 0 : null
  if (query.shadowed) return null
  return rank(item.search, query.needle)
}
