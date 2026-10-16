'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'

import { listSkillInstallations, skillInstallationsQueryKey } from '@/lib/assistant/skills-api'
import { CONNECTOR_SLASH_TOOLS_QUERY_KEY, getConnectorSlashTools } from '@/lib/connectors/slash-tools-api'
import { getMcpTemplates, MCP_TEMPLATES_QUERY_KEY } from '@/lib/connectors/mcp-catalog-api'
import { DISCOVERY_TOOLS_CATALOG_QUERY_KEY, getDiscoveryToolsCatalog } from '@/lib/discovery/api'

import { COMPOSER_COMMANDS_QUERY_KEY, getComposerCommands } from './composer-commands-api'
import { buildSlashMenuItems, filterComposerMenu, normalizeMenuSearch, type ComposerSurface } from './composer-menu'
import { filterTemplateItems, slashTemplateItems } from './composer-menu-templates'
import { arrangeConnectionSwitchRows, type ComposerConnectionSwitchRow } from './composer-menu-connection-switches'
import type { ComposerTrigger } from './composer-trigger'
import type { TypedComposerMenuGroup } from './use-typed-composer'
import { useConversationConnectors } from './use-conversation-connectors'

/**
 * P03-01 slash menu data: Youtorch tools from the Discovery projection and the user's installed skills from the
 * Assistant skill facade (server data only). Loaded when the slash menu first opens, never to execute anything.
 */
export function useSlashMenuGroups(input: {
  surface: ComposerSurface
  channelId: string | null
  trigger: ComposerTrigger | null
  enabled: boolean
  /** P03-25: the conversation whose connector switches apply (null before the first message: all on). */
  conversationId?: string | null
}): { groups: TypedComposerMenuGroup[]; loading: boolean; error: boolean; connectionSwitches: SlashConnectionSwitches | null } {
  const [requested, setRequested] = React.useState(false)
  const slashOpen = input.enabled && input.trigger?.kind === 'slash'
  // Remember that the menu was opened once (render-time update, no effect): the lists stay loaded afterwards.
  if (slashOpen && !requested) setRequested(true)
  const active = input.enabled && (requested || slashOpen)

  const tools = useQuery({
    queryKey: DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => getDiscoveryToolsCatalog({ signal }),
    enabled: active,
    staleTime: 5 * 60_000,
  })
  const skills = useQuery({
    queryKey: skillInstallationsQueryKey(input.channelId),
    queryFn: ({ signal }) => listSkillInstallations({ channelId: input.channelId }, { signal }),
    enabled: active,
    staleTime: 60_000,
  })

  // P03-25: the "Connections" group — approved tools of the user's enabled connections minus this conversation's
  // switched-off ones (server data; the Connector applies the same switch at dispatch).
  // E1-H: owner commands the server offers this tenant on this surface; a failed read offers none.
  const commands = useQuery({
    queryKey: [...COMPOSER_COMMANDS_QUERY_KEY, input.surface],
    queryFn: ({ signal }) => getComposerCommands(input.surface, { signal }),
    enabled: active,
    staleTime: 60_000,
  })
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const connections = useQuery({
    queryKey: CONNECTOR_SLASH_TOOLS_QUERY_KEY,
    queryFn: ({ signal }) => getConnectorSlashTools({ signal }),
    enabled: active,
    staleTime: 60_000,
  })
  const conversationConnectors = useConversationConnectors({ conversationId: input.conversationId ?? null, enabled: active })
  // QA-172: MCP prompts as the "Şablonlar" group (empty while the P01C-26 gate is off); they insert text, never run.
  const templates = useQuery({
    queryKey: MCP_TEMPLATES_QUERY_KEY,
    queryFn: ({ signal }) => getMcpTemplates({ signal }),
    enabled: active,
    staleTime: 60_000,
  })
  const templateItems = React.useMemo(() => slashTemplateItems(templates.data ?? [], normalizeMenuSearch), [templates.data])

  const items = React.useMemo(() => buildSlashMenuItems({
    surface: input.surface,
    tools: tools.data?.tools ?? [],
    skills: skills.data ?? [],
    connections: connections.data ?? [],
    commands: commands.data ?? [],
    locale,
    ...(conversationConnectors.scope ? { disabledConnectionIds: conversationConnectors.scope.disabledConnectionIds } : {}),
  }), [commands.data, connections.data, conversationConnectors.scope, input.surface, locale, skills.data, tools.data?.tools])

  const query = slashOpen ? input.trigger?.query ?? '' : null
  const filtered = React.useMemo(
    () => (query === null ? [] : filterComposerMenu(items, query)),
    [items, query],
  )
  // QA-126: an existing conversation shows a switch row per connection (a brand-new one has nothing to switch yet).
  const switchScope = input.conversationId ? conversationConnectors.scope : null
  const layout = React.useMemo(() => (query === null || !switchScope ? null : arrangeConnectionSwitchRows({
    connections: connections.data ?? [],
    disabledConnectionIds: switchScope.disabledConnectionIds,
    groups: filtered,
    query,
  })), [connections.data, filtered, query, switchScope])
  const templateGroup = React.useMemo(() => (query === null ? null : filterTemplateItems(templateItems, query)), [query, templateItems])
  const baseGroups = layout?.groups ?? filtered
  const groups = React.useMemo(() => (templateGroup ? [...baseGroups, templateGroup] : baseGroups), [baseGroups, templateGroup])
  const { pending, setEnabled } = conversationConnectors
  const connectionSwitches = React.useMemo<SlashConnectionSwitches | null>(
    () => (layout && layout.rows.length > 0 ? { rows: layout.rows, pending, setEnabled } : null),
    [layout, pending, setEnabled],
  )
  return {
    groups,
    connectionSwitches,
    // The connection group waits for its server data too (no switched-off connection is ever shown as on).
    loading: slashOpen && (tools.isLoading || skills.isLoading || commands.isLoading || connections.isLoading || conversationConnectors.loading),
    error: slashOpen && (tools.isError || skills.isError || connections.isError || conversationConnectors.error),
  }
}

/** QA-126: the per-conversation switch rows of the "Connections" group and the server command behind them. */
export type SlashConnectionSwitches = {
  rows: ComposerConnectionSwitchRow[]
  pending: boolean
  setEnabled: (connectionId: string, enabled: boolean) => Promise<boolean>
}
