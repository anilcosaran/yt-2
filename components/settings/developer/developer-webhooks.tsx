'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, RotateCcw, Webhook } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DEVELOPER_WEBHOOK_DELIVERIES_QUERY_KEY,
  DEVELOPER_WEBHOOK_SUBSCRIPTIONS_QUERY_KEY,
  listDeveloperWebhookDeliveries,
  listDeveloperWebhookSubscriptions,
  resendDeveloperWebhookDelivery,
  rotateDeveloperAppWebhookKey,
  type DeveloperWebhookDelivery,
  type DeveloperWebhookIssuedKey,
  type DeveloperWebhookSubscription,
} from '@/lib/developer/webhooks'

/**
 * DEV-07 Settings > Developer > Webhooks: the workspace's webhook subscriptions (platform-installed from a connected
 * app's manifest, or created through the API) and the latest deliveries with their status, attempts and a resend of a
 * finished delivery. Built only from existing settings pieces (group title, rows, badges, the settings table). Server
 * state only; nothing is kept in browser storage.
 */

const KNOWN_REASONS = new Set([
  'endpoint_gone', 'max_attempts', 'max_age_exceeded', 'installation_revoked', 'key_revoked', 'key_suspended', 'scope_not_granted',
  'resource_not_granted', 'signing_key_missing', 'subscription_disabled', 'disabled_by_principal', 'manifest_removed', 'membership_lost',
])

function reasonKey(reason: string | null): string {
  return reason && KNOWN_REASONS.has(reason) ? `developer.webhooks.reason.${reason}` : 'developer.webhooks.reason.other'
}

function endpointLabel(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`
  } catch {
    return url
  }
}

function SubscriptionRow({ subscription }: { subscription: DeveloperWebhookSubscription }) {
  const t = useTranslations('Settings')
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3" data-testid="developer-webhook-subscription-row">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate font-mono text-xs text-foreground">{endpointLabel(subscription.url)}</p>
        <Badge variant="secondary">
          {subscription.origin === 'manifest' ? t('developer.webhooks.originManifest') : t('developer.webhooks.originApi')}
        </Badge>
        {subscription.environment === 'test' && <Badge variant="secondary">{t('developer.connectedApps.testEnvironment')}</Badge>}
        {subscription.status === 'disabled' && <Badge variant="outline">{t(reasonKey(subscription.disabled_reason))}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        {subscription.principal_kind === 'personal_key' ? t('developer.webhooks.ownerKey') : t('developer.webhooks.ownerApp')}
        {' · '}
        {t('developer.webhooks.events', { count: subscription.event_types.length })}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {subscription.event_types.map((type) => (
          <li key={type}><Badge variant="outline" className="font-mono font-normal">{type}</Badge></li>
        ))}
      </ul>
    </div>
  )
}

function DeliveryStatus({ delivery }: { delivery: DeveloperWebhookDelivery }) {
  const t = useTranslations('Settings')
  const label = delivery.status === 'delivered'
    ? t('developer.webhooks.status.delivered')
    : delivery.status === 'dead'
      ? t('developer.webhooks.status.failed')
      : delivery.status === 'suppressed'
        ? t('developer.webhooks.status.notSent')
        : delivery.attempts > 0 ? t('developer.webhooks.status.retrying') : t('developer.webhooks.status.sending')
  const detail = delivery.status === 'dead' || delivery.status === 'suppressed'
    ? t(reasonKey(delivery.outcome_reason))
    : delivery.status !== 'delivered' && delivery.last_status_code !== null
      ? t('developer.webhooks.lastResponse', { code: delivery.last_status_code })
      : delivery.status !== 'delivered' && delivery.last_error
        ? t(reasonKey(delivery.last_error))
        : null
  return (
    <div className="min-w-0">
      <Badge variant={delivery.status === 'delivered' ? 'secondary' : 'outline'}>{label}</Badge>
      {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function DeliveryRow({ delivery }: { delivery: DeveloperWebhookDelivery }) {
  const t = useTranslations('Settings')
  const format = useFormatter()
  const queryClient = useQueryClient()
  const resend = useMutation({
    mutationFn: () => resendDeveloperWebhookDelivery(delivery.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: DEVELOPER_WEBHOOK_DELIVERIES_QUERY_KEY }),
  })
  const finished = delivery.status === 'delivered' || delivery.status === 'dead' || delivery.status === 'suppressed'
  return (
    <TableRow data-testid="developer-webhook-delivery-row">
      <TableCell className="px-4 text-muted-foreground">{format.dateTime(new Date(delivery.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
      <TableCell>
        <p className="font-mono text-xs text-foreground">{delivery.event_type}</p>
        {delivery.resource && <p className="truncate font-mono text-xs text-muted-foreground">{delivery.resource.id}</p>}
      </TableCell>
      <TableCell><DeliveryStatus delivery={delivery} /></TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{t('developer.webhooks.attempts', { count: delivery.attempts })}</TableCell>
      <TableCell className="text-right">
        {finished && (
          <Button type="button" size="sm" variant="ghost" className="h-7 rounded-lg" disabled={resend.isPending} onClick={() => resend.mutate()}>
            <RotateCcw className="size-3.5" />
            {t('developer.webhooks.resend')}
          </Button>
        )}
        {resend.isError && <p className="text-xs text-destructive" role="alert">{t('developer.webhooks.resendFailed')}</p>}
      </TableCell>
    </TableRow>
  )
}

function Deliveries() {
  const t = useTranslations('Settings')
  const query = useQuery({ queryKey: DEVELOPER_WEBHOOK_DELIVERIES_QUERY_KEY, queryFn: ({ signal }) => listDeveloperWebhookDeliveries({ signal }) })
  if (query.isLoading) return <Skeleton className="h-[120px] rounded-2xl" />
  if (query.isError) return <p className="text-sm text-muted-foreground">{t('developer.webhooks.deliveriesLoadFailed')}</p>
  const items = query.data?.items ?? []
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="px-4">{t('developer.webhooks.columnDate')}</TableHead>
            <TableHead>{t('developer.webhooks.columnEvent')}</TableHead>
            <TableHead>{t('developer.webhooks.columnStatus')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('developer.webhooks.columnAttempts')}</TableHead>
            <TableHead className="text-right"><span className="sr-only">{t('developer.webhooks.resend')}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((delivery) => <DeliveryRow key={delivery.id} delivery={delivery} />)}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">{t('developer.webhooks.deliveriesEmpty')}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function DeveloperWebhooks() {
  const t = useTranslations('Settings')
  const query = useQuery({ queryKey: DEVELOPER_WEBHOOK_SUBSCRIPTIONS_QUERY_KEY, queryFn: ({ signal }) => listDeveloperWebhookSubscriptions({ signal }) })
  return (
    <section className="mt-8" aria-busy={query.isLoading} data-testid="developer-webhooks">
      <div className="mb-3 flex items-center gap-2">
        <Webhook className="size-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('developer.webhooks.title')}</h3>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{t('developer.webhooks.description')}</p>
      {query.isLoading ? (
        <Skeleton className="h-[68px] rounded-2xl" />
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">{t('developer.webhooks.loadFailed')}</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('developer.webhooks.empty')}</p>
      ) : (
        <>
          <div className="mb-4">{(query.data ?? []).map((subscription) => <SubscriptionRow key={subscription.id} subscription={subscription} />)}</div>
          <Deliveries />
        </>
      )}
    </section>
  )
}

/**
 * DEV-07 app owner: the signing key of the app's manifest webhook (every installation's fixed subscription signs with
 * it). Rendered in the My OAuth apps row of an app whose revision declares a webhook; the secret is shown once.
 */
export function DeveloperAppWebhookKeyButton({ appId, disabled }: { appId: string; disabled?: boolean }) {
  const t = useTranslations('Settings')
  const [issued, setIssued] = React.useState<DeveloperWebhookIssuedKey | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)
  const rotate = useMutation({ mutationFn: () => rotateDeveloperAppWebhookKey(appId), onSuccess: setIssued })
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={disabled || rotate.isPending} onClick={() => rotate.mutate()}>
        <KeyRound className="size-4" />
        {t('developer.webhooks.appKey')}
      </Button>
      {rotate.isError && <p className="text-xs text-destructive" role="alert">{t('developer.apps.failed')}</p>}
      <AppAlertDialog
        open={issued !== null}
        tone="warning"
        title={t('developer.webhooks.appKeyTitle')}
        description={t('developer.webhooks.appKeyDescription')}
        confirmLabel={t('developer.apps.done')}
        showCancel={false}
        onOpenChange={(open) => { if (!open) setIssued(null) }}
        onConfirm={() => setIssued(null)}
      >
        {issued && (
          <div className="flex items-center gap-2">
            <Input readOnly value={issued.signing_secret} aria-label={t('developer.webhooks.appKeyLabel')} className="font-mono text-xs" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { void navigator.clipboard?.writeText(issued.signing_secret).then(() => setCopied(issued.signing_secret)) }}
            >
              {copied === issued.signing_secret ? t('developer.apps.copied') : t('developer.apps.copy')}
            </Button>
          </div>
        )}
      </AppAlertDialog>
    </>
  )
}
