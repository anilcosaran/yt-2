'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Link2, Loader2 } from 'lucide-react'

import { ConnectorResourcePicker } from '@/components/connector/connector-resource-picker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Channel } from '@/lib/channel/api'
import {
  bindYoutubeChannel,
  CONNECTORS_QUERY_KEY,
  connectorsForCapabilities,
  listConnectors,
  type ConnectorResourceCandidate,
} from '@/lib/connector/api'
import { useConnectorAuthorization } from '@/lib/connector/use-connector-authorization'

const YOUTUBE_SLUG = 'youtube'
const YOUTUBE_READ = 'social.read'

/**
 * P01C-13 "Google ile bağlan" for a workspace channel (replaces the token paste / Google Cloud secret form): the
 * P01C-03/05 Connector flow in a popup with Youtorch's own Google app, then the user's real YouTube channels to pick
 * from, then the Channel owner binding. Reconnect renews the same account's consent. No token ever touches the page.
 * Hidden behind an explanation when the server catalog does not offer YouTube (no fake Connect button).
 */
export function ChannelGoogleConnect({
  channel,
  onConnected,
  className,
}: {
  channel: Channel
  onConnected: () => Promise<void> | void
  className?: string
}) {
  const t = useTranslations('Channels')
  const authorization = useConnectorAuthorization()
  const [binding, setBinding] = React.useState(false)
  const [bindFailed, setBindFailed] = React.useState(false)
  const catalogQuery = useQuery({ queryKey: CONNECTORS_QUERY_KEY, queryFn: ({ signal }) => listConnectors({ signal }), staleTime: 60_000 })

  const reconnectId = channel.connector_connection?.reauth_required ? channel.connector_connection.connection_id : null
  const available = catalogQuery.data
    ? connectorsForCapabilities(catalogQuery.data, [YOUTUBE_READ]).some((entry) => entry.connector_slug === YOUTUBE_SLUG)
    : false
  const flow = authorization.flow
  const canBind = channel.status === 'setup' || channel.status === 'disconnected'

  async function connect() {
    setBindFailed(false)
    await authorization.start({ connectorSlug: YOUTUBE_SLUG, capabilities: [YOUTUBE_READ], connectionId: reconnectId })
  }

  async function pick(candidate: ConnectorResourceCandidate) {
    const completed = await authorization.select(candidate)
    if (!completed) return
    if (!canBind) {
      await onConnected()
      return
    }
    setBinding(true)
    try {
      await bindYoutubeChannel(completed.connectionId, { channelId: channel.id, resourceId: candidate.resource_id })
      await onConnected()
    } catch {
      setBindFailed(true)
    } finally {
      setBinding(false)
    }
  }

  if (catalogQuery.isLoading) {
    return <Skeleton className={className ? `h-9 w-48 rounded-full ${className}` : 'h-9 w-48 rounded-full'} />
  }
  if (!available) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('googleConnect.unavailableTitle')}</AlertTitle>
        <AlertDescription>{t('googleConnect.unavailableDescription')}</AlertDescription>
      </Alert>
    )
  }

  const errorKey = bindFailed
    ? 'bindFailed'
    : flow.phase === 'error'
      ? flow.reason === 'popup_blocked' ? 'popupBlocked' : flow.reason === 'closed' ? 'notCompleted' : flow.reason === 'no_resources' ? 'noChannels' : 'failed'
      : null
  const busy = flow.phase === 'popup' || flow.phase === 'finishing' || binding

  return (
    <div className={className ? `space-y-4 ${className}` : 'space-y-4'}>
      {errorKey && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('googleConnect.errorTitle')}</AlertTitle>
          <AlertDescription>{t(`googleConnect.${errorKey}`)}</AlertDescription>
        </Alert>
      )}
      {flow.phase === 'select' ? (
        <ConnectorResourcePicker
          label={t('googleConnect.pickChannel')}
          candidates={flow.candidates}
          disabled={busy}
          onPick={(candidate) => void pick(candidate)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="h-9 rounded-full px-4" disabled={busy} onClick={() => void connect()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {reconnectId ? t('googleConnect.reconnect') : t('googleConnect.connect')}
          </Button>
          <p className="text-sm text-muted-foreground" role="status">
            {flow.phase === 'popup' ? t('googleConnect.popupOpen') : t('googleConnect.hint')}
          </p>
        </div>
      )}
    </div>
  )
}
