"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Check, Search, Waypoints, Zap, Loader2, RefreshCw, Unplug } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageContainer } from '@/components/common/page-container'
import { PageHeader } from '@/components/common/page-header'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'
import { AppAlertDialog } from "@/components/ui/app-alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ConnectorResourcePicker } from "@/components/connector/connector-resource-picker"
import { CustomMcpSection } from "@/components/connector/custom-mcp-section"
import {
  CONNECTOR_CONNECTIONS_QUERY_KEY,
  CONNECTORS_QUERY_KEY,
  listConnectorConnections,
  listConnectors,
  revokeConnectorConnection,
  setConnectorConnectionEnabled,
  type ConnectorCatalogEntry,
  type ConnectorConnection,
} from "@/lib/connector/api"
import { useConnectorAuthorization } from "@/lib/connector/use-connector-authorization"

type App = {
  slug: string
  name: string
  descKey: string
}

type Group = {
  id: string
  titleKey: string
  icon: React.ComponentType<{ className?: string }>
  apps: App[]
}

const logo = (slug: string) => `/connectors/${slug}.svg`
const YOUTUBE_SLUG = "youtube"

const groups: Group[] = [
  {
    id: 'publishing', titleKey: 'connectors.groups.publishing', icon: Waypoints,
    apps: [
      { slug: 'instagram', name: 'Instagram', descKey: 'connectors.descriptions.instagram' },
      { slug: 'tiktok', name: 'TikTok', descKey: 'connectors.descriptions.tiktok' },
      { slug: 'x', name: 'X', descKey: 'connectors.descriptions.x' },
      { slug: 'linkedin', name: 'LinkedIn', descKey: 'connectors.descriptions.linkedin' },
      { slug: 'threads', name: 'Threads', descKey: 'connectors.descriptions.threads' },
      { slug: 'facebook', name: 'Facebook', descKey: 'connectors.descriptions.facebook' },
    ],
  },
  {
    id: 'communication', titleKey: 'connectors.groups.communication', icon: Zap,
    apps: [
      { slug: 'telegram', name: 'Telegram', descKey: 'connectors.descriptions.telegram' },
      { slug: 'whatsapp', name: 'WhatsApp Business', descKey: 'connectors.descriptions.whatsapp' },
      { slug: 'slack', name: 'Slack', descKey: 'connectors.descriptions.slack' },
      { slug: 'discord', name: 'Discord', descKey: 'connectors.descriptions.discord' },
    ],
  },
  {
    id: 'email', titleKey: 'connectors.groups.email', icon: Zap,
    apps: [
      { slug: 'gmail', name: 'Gmail', descKey: 'connectors.descriptions.gmail' },
      { slug: 'google-calendar', name: 'Google Calendar', descKey: 'connectors.descriptions.googleCalendar' },
      { slug: 'microsoft-outlook', name: 'Microsoft Outlook', descKey: 'connectors.descriptions.outlook' },
    ],
  },
  {
    id: 'documents', titleKey: 'connectors.groups.documents', icon: Zap,
    apps: [
      { slug: 'google-drive', name: 'Google Drive', descKey: 'connectors.descriptions.googleDrive' },
      { slug: 'google-docs', name: 'Google Docs', descKey: 'connectors.descriptions.googleDocs' },
      { slug: 'notion', name: 'Notion', descKey: 'connectors.descriptions.notion' },
      { slug: 'dropbox', name: 'Dropbox', descKey: 'connectors.descriptions.dropbox' },
    ],
  },
]

/** Capabilities a management connect asks for: the connector's available ones (a gated capability is never asked). */
function availableCapabilities(entry: ConnectorCatalogEntry | undefined): string[] {
  return entry?.capabilities.filter((capability) => capability.available).map((capability) => capability.key) ?? []
}

function BrandLogo({ slug, name }: { slug: string; name: string }) {
  const tTheme = useTranslations('NewTheme')
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
      <img
        src={logo(slug) || "/placeholder.svg"}
        alt={tTheme('connectors.logoAlt', { name })}
        className="size-6 object-contain"
        crossOrigin="anonymous"
        loading="lazy"
      />
    </span>
  )
}

/**
 * One catalog entry. Only a connector the server catalog offers (P01C-05 provider gate, available capability) gets a
 * Connect button; everything else stays "Coming soon" — never a simulated connection.
 */
function AppCard({ app, entry }: { app: App; entry: ConnectorCatalogEntry | undefined }) {
  const tTheme = useTranslations('NewTheme')
  const queryClient = useQueryClient()
  const authorization = useConnectorAuthorization()
  const capabilities = availableCapabilities(entry)
  const flow = authorization.flow
  const busy = flow.phase === 'popup' || flow.phase === 'finishing'

  async function connect() {
    // Management connect: no Chat requirement, so it never continues a job (it stays idle).
    await authorization.start({ connectorSlug: app.slug, capabilities })
    await queryClient.invalidateQueries({ queryKey: CONNECTOR_CONNECTIONS_QUERY_KEY })
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-panel/40 p-3.5">
      <div className="flex items-center gap-3">
        <BrandLogo slug={app.slug} name={app.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{app.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {flow.phase === 'error' ? tTheme(`connectorAccounts.flow.${flow.reason}`) : tTheme(app.descKey)}
          </p>
        </div>
        {capabilities.length > 0 ? (
          <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-lg" disabled={busy} onClick={() => void connect()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {tTheme('connectorAccounts.connect')}
          </Button>
        ) : (
          <span className="shrink-0 rounded-md border border-border bg-panel px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <UiText id="coming_soon_e4115be2" />
          </span>
        )}
      </div>
      {flow.phase === 'select' && (
        <ConnectorResourcePicker
          label={tTheme('connectorAccounts.pickResource')}
          candidates={flow.candidates}
          disabled={busy}
          onPick={(candidate) => {
            void authorization.select(candidate).then(() => queryClient.invalidateQueries({ queryKey: CONNECTOR_CONNECTIONS_QUERY_KEY }))
          }}
        />
      )}
    </div>
  )
}

function connectionStatusKey(connection: ConnectorConnection): string {
  if (connection.auth_state === 'reauth_required') return 'reauth'
  if (connection.auth_state !== 'active') return 'inactive'
  if (!connection.enabled) return 'disabled'
  if (connection.health === 'down' || connection.health === 'degraded') return 'unhealthy'
  return 'active'
}

/** One connected account: real server state, enable/disable (version CAS), reconnect (same account) and revoke. */
function ConnectionRow({ connection, entry }: { connection: ConnectorConnection; entry: ConnectorCatalogEntry | undefined }) {
  const tTheme = useTranslations('NewTheme')
  const queryClient = useQueryClient()
  const authorization = useConnectorAuthorization()
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: CONNECTOR_CONNECTIONS_QUERY_KEY })
  const enableMutation = useMutation({
    mutationFn: (enabled: boolean) => setConnectorConnectionEnabled(connection.connection_id, { enabled, expectedVersion: connection.version }),
    onSettled: refresh,
  })
  const revokeMutation = useMutation({
    mutationFn: () => revokeConnectorConnection(connection.connection_id),
    onSettled: async () => {
      setConfirmRevoke(false)
      await refresh()
    },
  })
  const name = entry?.display_name ?? connection.connector_slug
  const status = connectionStatusKey(connection)
  const flow = authorization.flow
  const busy = flow.phase === 'popup' || flow.phase === 'finishing' || enableMutation.isPending || revokeMutation.isPending
  const resources = connection.bound_resources.map((resource) => resource.display_label ?? resource.resource_id)

  async function reconnect() {
    await authorization.start({
      connectorSlug: connection.connector_slug,
      capabilities: availableCapabilities(entry).length > 0 ? availableCapabilities(entry) : connection.granted_capabilities,
      connectionId: connection.connection_id,
    })
    await refresh()
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-panel/40 p-3.5" data-testid="connector-connection-row">
      <div className="flex flex-wrap items-center gap-3">
        <BrandLogo slug={connection.connector_slug} name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{connection.display_label ?? name}</p>
          <p className="truncate text-xs text-muted-foreground" role="status">
            {flow.phase === 'error'
              ? tTheme(`connectorAccounts.flow.${flow.reason}`)
              : tTheme(`connectorAccounts.status.${status}`)}
            {resources.length > 0 ? ` · ${resources.join(', ')}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {connection.auth_state === 'active' && (
            <Switch
              checked={connection.enabled}
              disabled={busy}
              aria-label={tTheme('connectorAccounts.enabledLabel', { name })}
              onCheckedChange={(checked) => enableMutation.mutate(checked)}
            />
          )}
          {(connection.auth_state === 'reauth_required' || connection.auth_state === 'active') && (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy} onClick={() => void reconnect()}>
              <RefreshCw className="size-4" />
              {tTheme('connectorAccounts.reconnect')}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy} onClick={() => setConfirmRevoke(true)}>
            <Unplug className="size-4" />
            {tTheme('connectorAccounts.revoke')}
          </Button>
        </div>
      </div>
      {flow.phase === 'select' && (
        <ConnectorResourcePicker
          label={tTheme('connectorAccounts.pickResource')}
          candidates={flow.candidates}
          disabled={busy}
          onPick={(candidate) => { void authorization.select(candidate).then(refresh) }}
        />
      )}
      <AppAlertDialog
        open={confirmRevoke}
        tone="destructive"
        title={tTheme('connectorAccounts.revokeTitle', { name })}
        description={tTheme('connectorAccounts.revokeDescription')}
        confirmLabel={tTheme('connectorAccounts.revoke')}
        busy={revokeMutation.isPending}
        onOpenChange={setConfirmRevoke}
        onConfirm={() => revokeMutation.mutate()}
      />
    </div>
  )
}

export function ConnectorView() {
  const tAuto = useTranslations('Auto')
  const tTheme = useTranslations('NewTheme')
  const router = useRouter()
  const [q, setQ] = useState("")
  // P01C-13: the catalog and the accounts come from the server (no local simulation, no browser storage).
  const catalogQuery = useQuery({ queryKey: CONNECTORS_QUERY_KEY, queryFn: ({ signal }) => listConnectors({ signal }), staleTime: 60_000 })
  const connectionsQuery = useQuery({ queryKey: CONNECTOR_CONNECTIONS_QUERY_KEY, queryFn: ({ signal }) => listConnectorConnections({ signal }) })

  const catalog = new Map((catalogQuery.data ?? []).map((entry) => [entry.connector_slug, entry]))
  const connections = (connectionsQuery.data ?? []).filter((connection) => connection.auth_state !== 'revoked')
  const youtubeConnected = connections.some((connection) => connection.connector_slug === YOUTUBE_SLUG && connection.auth_state === 'active')
  const loading = catalogQuery.isLoading || connectionsQuery.isLoading
  const knownSlugs = new Set(groups.flatMap((group) => group.apps.map((app) => app.slug)).concat(YOUTUBE_SLUG))
  const extraApps: App[] = (catalogQuery.data ?? [])
    .filter((entry) => !knownSlugs.has(entry.connector_slug))
    .map((entry) => ({ slug: entry.connector_slug, name: entry.display_name, descKey: 'connectorAccounts.serverConnector' }))
  const allGroups: Group[] = extraApps.length > 0
    ? [{ id: 'available', titleKey: 'connectorAccounts.availableGroup', icon: Zap, apps: extraApps }, ...groups]
    : groups

  return (
    <PageContainer>
      <PageHeader
        title={tAuto('connectors_4b1e9501')}
        description={tAuto('a_connector_links_one_of_your_apps_to_super_comp_867631cd')}
        className="mb-0"
      />

      {/* YouTube primary platform */}
      <section className="mt-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-red-600/25 via-rose-600/10 to-panel p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-lg">
                <img
                  src="/connectors/youtube.svg"
                  alt={tAuto('youtube_558865a1')}
                  className="size-8"
                />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl text-foreground"><UiText id="youtube_558865a1" /></h2>
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    <UiText id="primary_a9a96ec0" /></span>
                </div>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  <UiText id="your_main_channel_publish_long_form_videos_short_0f296959" /></p>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-11 w-44 rounded-xl" />
            ) : (
              <button
                type="button"
                onClick={() => router.push("/channels?view=connection")}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors",
                  youtubeConnected
                    ? "border border-primary/50 bg-primary/15 text-primary"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {youtubeConnected ? <Check className="size-4" /> : <Plus className="size-4" />}
                {youtubeConnected ? tAuto('connected_c2f9b7b4') : tAuto('connect_youtube_eeb0d8b5')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Connected accounts (server state) */}
      <section className="mt-7" aria-busy={loading}>
        <div className="mb-3 flex items-center gap-2">
          <Waypoints className="size-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tTheme('connectorAccounts.title')}</h3>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-[68px] rounded-2xl" />
            <Skeleton className="h-[68px] rounded-2xl" />
          </div>
        ) : connectionsQuery.isError ? (
          <p className="text-sm text-muted-foreground">{tTheme('connectorAccounts.loadFailed')}</p>
        ) : connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tTheme('connectorAccounts.empty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {connections.map((connection) => (
              <ConnectionRow key={connection.connection_id} connection={connection} entry={catalog.get(connection.connector_slug)} />
            ))}
          </div>
        )}
      </section>

      {/* QA-131: custom (private remote) MCP — shown only when the server lets this user register or list any */}
      <CustomMcpSection />

      {/* Search */}
      <div className="mt-7">
        <label className="relative flex h-11 w-full items-center sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tAuto('search_connectors_9ffb52f1')}
            className="h-full w-full rounded-xl border border-border bg-panel/50 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-ring/40"
          />
        </label>
      </div>

      {/* Categories */}
      <div className="mt-6 flex flex-col gap-8 pb-4">
        {allGroups.map((g) => {
          const apps = g.apps.filter(
            (a) => a.name.toLowerCase().includes(q.toLowerCase()) || tTheme(a.descKey).toLowerCase().includes(q.toLowerCase()),
          )
          if (apps.length === 0) return null
          return (
            <section key={g.id}>
              <div className="mb-3 flex items-center gap-2">
                <g.icon className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tTheme(g.titleKey)}</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {apps.map((a) => (
                  <AppCard key={a.slug} app={a} entry={catalog.get(a.slug)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </PageContainer>
  )
}
