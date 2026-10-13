import { normalizeMenuSearch, type ComposerMenuGroup, type ComposerMenuItem } from './composer-menu'
import type { SlashConnectionSource } from './composer-menu-connections'

/**
 * QA-126 per-conversation connector switch rows of the `/` menu's "Connections" group (P03-25 server switch). Each
 * connection gets a header row ("YouTube · Ali Kanal") with the existing Switch; its approved tools follow it. A
 * connection switched off in this conversation keeps its header ("Off in this chat") and shows no tools. The rows exist
 * only for a conversation that already exists — a brand-new empty conversation has nothing to switch yet (all on).
 *
 * Tools are regrouped under their connection so the keyboard order (flattened items) matches what is on screen.
 */

export type ComposerConnectionSwitchRow = {
  connectionId: string
  /** Service and account, as the tool rows describe them. */
  label: string
  /** On in this conversation (account-level `enabled` is already applied by the server list). */
  enabled: boolean
  /** Visible tool items of this connection in display order (none when switched off). */
  itemIds: string[]
}

export type ComposerConnectionSwitchLayout = {
  groups: ComposerMenuGroup[]
  rows: ComposerConnectionSwitchRow[]
}

export function connectionSwitchLabel(connection: Pick<SlashConnectionSource, 'display_name' | 'connector_slug' | 'account_label'>): string {
  const service = connection.display_name.trim() || connection.connector_slug
  return connection.account_label ? `${service} · ${connection.account_label}` : service
}

/**
 * Header rows for the connections relevant to the typed query: every connection for a bare `/`, otherwise a
 * connection with a visible tool or whose name matches the query. A name a Youtorch tool or skill owns shadows the
 * connectors (K348): then only connections with visible tools (reached by full tool name) get a row.
 */
export function arrangeConnectionSwitchRows(input: {
  connections: readonly SlashConnectionSource[]
  disabledConnectionIds: ReadonlySet<string>
  groups: readonly ComposerMenuGroup[]
  query: string
}): ComposerConnectionSwitchLayout {
  const raw = input.query.trim().toLowerCase()
  const needle = normalizeMenuSearch(raw.includes('.') ? raw.split('.')[0]! : raw)
  const shadowed = needle.length > 0 && !raw.includes('.') && input.groups.some((group) => group.id !== 'connections'
    && group.items.some((item) => normalizeMenuSearch(item.label) === needle))
  const connectionGroup = input.groups.find((group) => group.id === 'connections')
  const ranked = connectionGroup?.items ?? []

  const itemsByConnection = new Map<string, ComposerMenuItem[]>()
  for (const item of ranked) {
    if (!item.connectionId) continue
    itemsByConnection.set(item.connectionId, [...(itemsByConnection.get(item.connectionId) ?? []), item])
  }

  const candidates = input.connections.flatMap((connection, serverIndex) => {
    const items = itemsByConnection.get(connection.connection_id) ?? []
    const haystack = normalizeMenuSearch(`${connection.display_name} ${connection.connector_slug} ${connection.account_label ?? ''}`)
    const nameMatch = needle.length === 0 || haystack.includes(needle)
    if (items.length === 0 && (shadowed || !nameMatch)) return []
    const firstRank = items.length > 0 ? ranked.indexOf(items[0]!) : Number.POSITIVE_INFINITY
    return [{ connection, items, firstRank, serverIndex }]
  })
  // Connections with matching tools first (best tool first), then the others in server order.
  candidates.sort((left, right) => (left.firstRank - right.firstRank) || (left.serverIndex - right.serverIndex))

  const rows: ComposerConnectionSwitchRow[] = candidates.map(({ connection, items }) => ({
    connectionId: connection.connection_id,
    label: connectionSwitchLabel(connection),
    enabled: !input.disabledConnectionIds.has(connection.connection_id),
    itemIds: items.map((item) => item.id),
  }))
  if (rows.length === 0 && !connectionGroup) return { groups: [...input.groups], rows }

  const placed = new Set(candidates.flatMap((candidate) => candidate.items))
  const regrouped: ComposerMenuGroup = {
    id: 'connections',
    items: [...candidates.flatMap((candidate) => candidate.items), ...ranked.filter((item) => !placed.has(item))],
  }
  // Same position as before (or appended: "Connections" is the last group by precedence).
  const groups = connectionGroup
    ? input.groups.map((group) => (group === connectionGroup ? regrouped : group))
    : [...input.groups, regrouped]
  return { groups, rows }
}
