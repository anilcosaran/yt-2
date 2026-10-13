'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, RefreshCw, Waypoints } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useConversationConnectors } from '@/lib/assistant/composer/use-conversation-connectors'
import {
  CONNECTOR_CONNECTIONS_QUERY_KEY,
  CONNECTORS_QUERY_KEY,
  listConnectorConnections,
  listConnectors,
} from '@/lib/connector/api'
import {
  CONNECTOR_PAGE_PATH,
  composerConnectorRows,
  type ComposerConnectorRow,
} from '@/lib/connector/composer-connectors'

// The "+" menu's own row (the composer menus' one-line row), with the state as a quiet second line.
const ROW = 'flex min-h-9 w-full items-center gap-3 rounded-lg px-2.5 py-1 text-left text-sm text-foreground/75 outline-none transition-colors'
const ICON = 'flex size-[18px] shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-[18px]'

/**
 * QA-131 (b) "Connectors" group of the Chat composer's "+" menu: the user's connected connectors with their state and an
 * "Add" item that opens the Connector page in a new browser tab (the chat stays where it is). Loaded when the menu opens.
 */
export function ComposerAddConnectors({
  active,
  conversationId,
  onAdd,
}: {
  active: boolean
  conversationId: string | null
  /** Called after "Add" opened the Connector page (the host closes its menu). */
  onAdd?: () => void
}) {
  const connections = useQuery({
    queryKey: CONNECTOR_CONNECTIONS_QUERY_KEY,
    queryFn: ({ signal }) => listConnectorConnections({ signal }),
    enabled: active,
  })
  const catalog = useQuery({
    queryKey: CONNECTORS_QUERY_KEY,
    queryFn: ({ signal }) => listConnectors({ signal }),
    enabled: active,
    staleTime: 60_000,
  })
  const conversationSwitches = useConversationConnectors({ conversationId, enabled: active })
  const rows = React.useMemo(() => composerConnectorRows({
    connections: connections.data ?? [],
    catalog: catalog.data ?? [],
    disabledInConversation: conversationId ? conversationSwitches.scope?.disabledConnectionIds ?? null : null,
  }), [catalog.data, connections.data, conversationId, conversationSwitches.scope])
  return (
    <ComposerAddConnectorsGroup
      rows={rows}
      loading={connections.isLoading || catalog.isLoading || (Boolean(conversationId) && conversationSwitches.loading)}
      error={connections.isError}
      onAdd={onAdd}
    />
  )
}

export function ComposerAddConnectorsGroup({
  rows,
  loading,
  error,
  onAdd,
}: {
  rows: readonly ComposerConnectorRow[]
  loading: boolean
  error: boolean
  onAdd?: () => void
}) {
  const t = useTranslations('Chat')
  const tTheme = useTranslations('NewTheme')
  const statusText = (row: ComposerConnectorRow) => (row.status === 'chat_off'
    ? t('typedComposer.connectionSwitch.off')
    : tTheme(`connectorAccounts.status.${row.status}`))
  return (
    <div role="group" aria-label={t('composerConnectors.title')} data-testid="composer-add-connectors" className="p-1.5">
      <p className="px-2.5 pb-1 pt-1 text-xs text-muted-foreground">{t('composerConnectors.title')}</p>
      {loading ? (
        <p role="status" className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
          {t('composerConnectors.loading')}
        </p>
      ) : error ? (
        <p role="status" className="px-2.5 py-2 text-xs text-muted-foreground">{t('composerConnectors.failed')}</p>
      ) : rows.length === 0 ? (
        <p role="status" className="px-2.5 py-2 text-xs text-muted-foreground">{t('composerConnectors.empty')}</p>
      ) : rows.map((row) => (
        <div key={row.connectionId} className={ROW} data-connector-row={row.connectionId}>
          <span className={ICON}><Waypoints aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{row.account ? `${row.name} · ${row.account}` : row.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{statusText(row)}</span>
          </span>
        </div>
      ))}
      <a
        href={CONNECTOR_PAGE_PATH}
        target="_blank"
        rel="noopener noreferrer"
        title={t('composerConnectors.addTitle')}
        onClick={() => onAdd?.()}
        className={`${ROW} hover:bg-accent focus-visible:bg-accent`}
      >
        <span className={ICON}><Plus aria-hidden="true" /></span>
        <span className="min-w-0 flex-1 truncate">{t('composerConnectors.add')}</span>
      </a>
    </div>
  )
}
