'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Code2, Gauge, KeyRound, Plus, Unplug } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  DEVELOPER_APPS_QUERY_KEY,
  DEVELOPER_INSTALLATIONS_QUERY_KEY,
  DEVELOPER_SCOPES_QUERY_KEY,
  DEVELOPER_STATUS_QUERY_KEY,
  activateDeveloperApp,
  enableDeveloperAppTesting,
  getDeveloperPlatformStatus,
  listDeveloperApps,
  listDeveloperInstallations,
  listDeveloperScopes,
  registerDeveloperApp,
  revokeDeveloperInstallation,
  rotateDeveloperClientSecret,
  type DeveloperApp,
  type DeveloperInstallation,
  type DeveloperIssuedSecret,
} from '@/lib/developer/api'
import { DeveloperApiKeys } from './developer-api-keys'
import { DeveloperInstallationLimitsDialog } from './developer-installation-limits-dialog'
import { DeveloperAppWebhookKeyButton, DeveloperWebhooks } from './developer-webhooks'

/**
 * DEV-01 Settings > Developer: "Connected apps" (the workspace's installations, revoke) and, behind the partner-apps
 * switch, "My OAuth apps" (register, test a version, go live, new secret). Server state only: nothing is kept in
 * browser storage; a client secret is shown once from the command response and dropped when the dialog closes.
 */

export function scopeMessageKey(scope: string): string {
  return `developer.scope.${scope.replace(/\./g, '_')}`
}

function GroupTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
    </div>
  )
}

function ConnectedAppRow({ installation }: { installation: DeveloperInstallation }) {
  const t = useTranslations('Settings')
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = React.useState(false)
  const [limitsOpen, setLimitsOpen] = React.useState(false)
  const revoke = useMutation({
    mutationFn: () => revokeDeveloperInstallation(installation.id, installation.version),
    onSettled: async () => {
      setConfirm(false)
      await queryClient.invalidateQueries({ queryKey: DEVELOPER_INSTALLATIONS_QUERY_KEY })
    },
  })
  const name = installation.app.display_name
  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between" data-testid="developer-installation-row">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          {installation.environment === 'test' && <Badge variant="secondary">{t('developer.connectedApps.testEnvironment')}</Badge>}
          {!installation.app_available && <Badge variant="outline">{t('developer.connectedApps.unavailable')}</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {installation.app.verified_domain}
          {' · '}
          {installation.principal_kind === 'service' ? t('developer.connectedApps.actsForWorkspace') : t('developer.connectedApps.actsForYou')}
          {' · '}
          {t('developer.connectedApps.permissions', { count: installation.effective_scopes.length })}
          {' · '}
          {t('developer.connectedApps.items', { count: installation.resources.length })}
        </p>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {installation.effective_scopes.map((scope) => (
            <li key={scope}><Badge variant="outline" className="font-normal">{t(scopeMessageKey(scope))}</Badge></li>
          ))}
        </ul>
        {revoke.isError && <p className="mt-1 text-xs text-destructive" role="alert">{t('developer.connectedApps.revokeFailed')}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* QA-194: the app's per-job / monthly credit limits. */}
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-lg" onClick={() => setLimitsOpen(true)}>
          <Gauge className="size-4" />
          {t('developer.connectedApps.limits.open')}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-lg" disabled={revoke.isPending} onClick={() => setConfirm(true)}>
          <Unplug className="size-4" />
          {t('developer.connectedApps.revoke')}
        </Button>
      </div>
      <DeveloperInstallationLimitsDialog installationId={installation.id} appName={name} open={limitsOpen} onOpenChange={setLimitsOpen} />
      <AppAlertDialog
        open={confirm}
        tone="destructive"
        title={t('developer.connectedApps.revokeTitle', { name })}
        description={t('developer.connectedApps.revokeDescription', { name })}
        confirmLabel={t('developer.connectedApps.revoke')}
        busy={revoke.isPending}
        onOpenChange={setConfirm}
        onConfirm={() => revoke.mutate()}
      />
    </div>
  )
}

function ConnectedApps() {
  const t = useTranslations('Settings')
  const query = useQuery({ queryKey: DEVELOPER_INSTALLATIONS_QUERY_KEY, queryFn: ({ signal }) => listDeveloperInstallations({ signal }) })
  return (
    <section className="mt-2" aria-busy={query.isLoading}>
      <GroupTitle icon={Unplug}>{t('developer.connectedApps.title')}</GroupTitle>
      {query.isLoading ? (
        <div className="space-y-3"><Skeleton className="h-[68px] rounded-2xl" /><Skeleton className="h-[68px] rounded-2xl" /></div>
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">{t('developer.connectedApps.loadFailed')}</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('developer.connectedApps.empty')}</p>
      ) : (
        <div>{(query.data ?? []).map((installation) => <ConnectedAppRow key={installation.id} installation={installation} />)}</div>
      )}
    </section>
  )
}

function IssuedSecretDialog({ issued, onClose }: { issued: DeveloperIssuedSecret | null; onClose: () => void }) {
  const t = useTranslations('Settings')
  // Keyed by the secret itself: a newly issued secret always starts as "not copied".
  const [copiedSecret, setCopiedSecret] = React.useState<string | null>(null)
  const copied = issued !== null && copiedSecret === issued.client_secret
  return (
    <AppAlertDialog
      open={issued !== null}
      tone="warning"
      title={t('developer.apps.secretTitle')}
      description={t('developer.apps.secretDescription')}
      confirmLabel={t('developer.apps.done')}
      showCancel={false}
      onOpenChange={(open) => { if (!open) onClose() }}
      onConfirm={onClose}
    >
      {issued && (
        <div className="space-y-2">
          <Input readOnly value={issued.client.client_id} aria-label="client_id" className="font-mono text-xs" />
          <div className="flex items-center gap-2">
            <Input readOnly value={issued.client_secret} aria-label="client_secret" className="font-mono text-xs" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { void navigator.clipboard?.writeText(issued.client_secret).then(() => setCopiedSecret(issued.client_secret)) }}
            >
              {copied ? t('developer.apps.copied') : t('developer.apps.copy')}
            </Button>
          </div>
        </div>
      )}
    </AppAlertDialog>
  )
}

function RegisterAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('Settings')
  const queryClient = useQueryClient()
  const scopes = useQuery({ queryKey: DEVELOPER_SCOPES_QUERY_KEY, queryFn: ({ signal }) => listDeveloperScopes({ signal }), staleTime: 5 * 60_000, enabled: open })
  const [form, setForm] = React.useState({ name: '', purpose: '', domain: '', homepage: '', support: '', privacy: '', redirects: '' })
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>([])
  const [access, setAccess] = React.useState<string[]>(['delegated'])
  const register = useMutation({
    mutationFn: () => registerDeveloperApp({
      display_name: form.name,
      purpose: form.purpose,
      verified_domain: form.domain,
      homepage_url: form.homepage,
      support_url: form.support,
      privacy_url: form.privacy,
      redirect_uris: form.redirects.split('\n').map((line) => line.trim()).filter(Boolean),
      requested_scopes: selectedScopes,
      principal_kinds: access,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DEVELOPER_APPS_QUERY_KEY })
      onOpenChange(false)
    },
  })
  const field = (key: keyof typeof form, label: string, multiline = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={`developer-app-${key}`}>{label}</Label>
      {multiline
        ? <Textarea id={`developer-app-${key}`} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} rows={2} />
        : <Input id={`developer-app-${key}`} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
    </div>
  )
  const toggle = (list: string[], value: string, checked: boolean) => (checked ? [...new Set([...list, value])] : list.filter((item) => item !== value))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('developer.apps.registerTitle')}</DialogTitle>
          <DialogDescription>{t('developer.apps.registerDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {field('name', t('developer.apps.fieldName'))}
          {field('purpose', t('developer.apps.fieldPurpose'), true)}
          {field('domain', t('developer.apps.fieldDomain'))}
          {field('homepage', t('developer.apps.fieldHomepage'))}
          {field('support', t('developer.apps.fieldSupport'))}
          {field('privacy', t('developer.apps.fieldPrivacy'))}
          {field('redirects', t('developer.apps.fieldRedirects'), true)}
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t('developer.apps.fieldAccess')}</legend>
            {(['delegated', 'service'] as const).map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-sm">
                <Checkbox checked={access.includes(kind)} onCheckedChange={(checked) => setAccess(toggle(access, kind, checked === true))} />
                {kind === 'delegated' ? t('developer.apps.accessDelegated') : t('developer.apps.accessService')}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t('developer.apps.fieldPermissions')}</legend>
            {scopes.isLoading ? <Skeleton className="h-24 rounded-xl" /> : (scopes.data ?? []).map((definition) => (
              <label key={definition.scope} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedScopes.includes(definition.scope)}
                  onCheckedChange={(checked) => setSelectedScopes(toggle(selectedScopes, definition.scope, checked === true))}
                />
                {t(scopeMessageKey(definition.scope))}
              </label>
            ))}
          </fieldset>
          {register.isError && <p className="text-sm text-destructive" role="alert">{t('developer.apps.failed')}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('developer.apps.cancel')}</Button>
          <Button type="button" disabled={register.isPending || selectedScopes.length === 0 || access.length === 0} onClick={() => register.mutate()}>
            {t('developer.apps.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeveloperAppRow({ app, onIssued, webhooksEnabled = false }: { app: DeveloperApp; onIssued: (issued: DeveloperIssuedSecret) => void; webhooksEnabled?: boolean }) {
  const t = useTranslations('Settings')
  const queryClient = useQueryClient()
  const latest = app.revisions[0]
  const approved = app.revisions.find((revision) => revision.review_state === 'approved' && revision.id !== app.active_revision_id)
  const refresh = () => queryClient.invalidateQueries({ queryKey: DEVELOPER_APPS_QUERY_KEY })
  const command = useMutation({
    mutationFn: async (kind: 'test' | 'live') => (kind === 'test'
      ? enableDeveloperAppTesting(app.id, { revisionId: latest!.id, expectedVersion: app.version })
      : activateDeveloperApp(app.id, { revisionId: approved!.id, expectedVersion: app.version })),
    onSuccess: (result) => { if (result.issued) onIssued(result.issued) },
    onSettled: refresh,
  })
  const rotate = useMutation({
    mutationFn: (client: DeveloperApp['clients'][number]) => rotateDeveloperClientSecret(app.id, client.client_id, client.version),
    onSuccess: onIssued,
    onSettled: refresh,
  })
  const busy = command.isPending || rotate.isPending
  return (
    <div className="border-b border-border py-4" data-testid="developer-app-row">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{app.display_name}</p>
        <Badge variant="secondary">{t(`developer.apps.status.${app.status}`)}</Badge>
        {latest && (
          <span className="text-xs text-muted-foreground">
            {t('developer.apps.version', { number: latest.revision_number })} · {t(`developer.apps.review.${latest.review_state}`)}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {latest && latest.review_state !== 'rejected' && latest.id !== app.test_revision_id && app.status !== 'suspended' && (
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy} onClick={() => command.mutate('test')}>
            {t('developer.apps.enableTesting')}
          </Button>
        )}
        {approved && app.status !== 'suspended' && (
          <Button type="button" size="sm" className="h-8 rounded-lg" disabled={busy} onClick={() => command.mutate('live')}>
            {t('developer.apps.activate')}
          </Button>
        )}
        {webhooksEnabled && latest?.webhook_url && <DeveloperAppWebhookKeyButton appId={app.id} disabled={busy} />}
      </div>
      {app.clients.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {app.clients.map((client) => (
            <li key={client.client_id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <KeyRound className="size-3.5" />
              <span>{client.environment === 'test' ? t('developer.apps.clientTest') : t('developer.apps.clientLive')}</span>
              <code className="font-mono">{client.client_id}</code>
              <span>{t('developer.apps.secretHint', { hint: client.secret_hint })}</span>
              <Button type="button" size="sm" variant="ghost" className="h-7 rounded-lg" disabled={busy} onClick={() => rotate.mutate(client)}>
                {t('developer.apps.rotateSecret')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {(command.isError || rotate.isError) && <p className="mt-1 text-xs text-destructive" role="alert">{t('developer.apps.failed')}</p>}
    </div>
  )
}

function MyApps({ webhooksEnabled = false }: { webhooksEnabled?: boolean }) {
  const t = useTranslations('Settings')
  const [registerOpen, setRegisterOpen] = React.useState(false)
  const [issued, setIssued] = React.useState<DeveloperIssuedSecret | null>(null)
  const query = useQuery({ queryKey: DEVELOPER_APPS_QUERY_KEY, queryFn: ({ signal }) => listDeveloperApps({ signal }) })
  return (
    <section className="mt-8" aria-busy={query.isLoading}>
      <div className="flex items-center justify-between gap-3">
        <GroupTitle icon={Code2}>{t('developer.apps.title')}</GroupTitle>
        <Button type="button" size="sm" variant="outline" className="mb-3 h-8 rounded-lg" onClick={() => setRegisterOpen(true)}>
          <Plus className="size-4" />
          {t('developer.apps.register')}
        </Button>
      </div>
      {query.isLoading ? (
        <Skeleton className="h-[68px] rounded-2xl" />
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">{t('developer.apps.loadFailed')}</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('developer.apps.empty')}</p>
      ) : (
        <div>{(query.data ?? []).map((app) => <DeveloperAppRow key={app.id} app={app} onIssued={setIssued} webhooksEnabled={webhooksEnabled} />)}</div>
      )}
      <RegisterAppDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <IssuedSecretDialog issued={issued} onClose={() => setIssued(null)} />
    </section>
  )
}

export function DeveloperSettingsSection() {
  const t = useTranslations('Settings')
  const status = useQuery({ queryKey: DEVELOPER_STATUS_QUERY_KEY, queryFn: ({ signal }) => getDeveloperPlatformStatus({ signal }), staleTime: 60_000 })
  return (
    <div className="w-full" data-testid="developer-settings-section">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">{t('developer.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('developer.description')}</p>
      </div>
      {status.isLoading ? (
        <Skeleton className="h-[68px] rounded-2xl" />
      ) : status.data?.enabled ? (
        <>
          {status.data.personal_keys_enabled && <DeveloperApiKeys />}
          <ConnectedApps />
          {status.data.partner_apps_enabled && <MyApps webhooksEnabled={status.data.webhooks_enabled === true} />}
          {status.data.webhooks_enabled && <DeveloperWebhooks />}
        </>
      ) : null}
    </div>
  )
}
