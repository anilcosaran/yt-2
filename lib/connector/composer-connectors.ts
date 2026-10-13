import type { ConnectorCatalogEntry, ConnectorConnection } from './api'

/**
 * QA-131 (b) the "Connectors" group of the Chat composer's "+" menu: the user's connected accounts with the same state
 * words as the Connector page (P01C-13) and, in an existing conversation, "Off in this chat" for a connection switched
 * off there (P03-25 / QA-126). Server data only. The group's "Add" item opens the Connector page in a new tab.
 */

/** The Connector page route (`app/apps`), opened in a new browser tab from the composer. */
export const CONNECTOR_PAGE_PATH = '/apps'

export type ComposerConnectorStatus = 'active' | 'disabled' | 'reauth' | 'unhealthy' | 'inactive' | 'chat_off'

export type ComposerConnectorRow = {
  connectionId: string
  /** Service name from the server catalog (slug when the catalog does not list it). */
  name: string
  /** Account label ("ali@example.com", channel name); null when the connection has none. */
  account: string | null
  status: ComposerConnectorStatus
}

/** Same order of precedence as the Connector page's account rows. */
export function composerConnectorStatus(connection: Pick<ConnectorConnection, 'auth_state' | 'enabled' | 'health'>): Exclude<ComposerConnectorStatus, 'chat_off'> {
  if (connection.auth_state === 'reauth_required') return 'reauth'
  if (connection.auth_state !== 'active') return 'inactive'
  if (!connection.enabled) return 'disabled'
  if (connection.health === 'down' || connection.health === 'degraded') return 'unhealthy'
  return 'active'
}

export function composerConnectorRows(input: {
  connections: readonly ConnectorConnection[]
  catalog: readonly ConnectorCatalogEntry[]
  /** Connections switched off in this conversation (null: no conversation yet, nothing is switched). */
  disabledInConversation: ReadonlySet<string> | null
}): ComposerConnectorRow[] {
  const names = new Map(input.catalog.map((entry) => [entry.connector_slug, entry.display_name] as const))
  return input.connections
    .filter((connection) => connection.auth_state !== 'revoked')
    .map((connection) => {
      const status = composerConnectorStatus(connection)
      return {
        connectionId: connection.connection_id,
        name: names.get(connection.connector_slug)?.trim() || connection.connector_slug,
        account: connection.display_label,
        status: status === 'active' && input.disabledInConversation?.has(connection.connection_id) ? 'chat_off' : status,
      }
    })
}
