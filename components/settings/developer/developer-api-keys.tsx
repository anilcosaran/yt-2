'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { DeveloperResourcePicker } from '@/components/developer/developer-resource-picker'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { DEVELOPER_SCOPES_QUERY_KEY, listDeveloperScopes } from '@/lib/developer/api'
import type { DeveloperConsentResource } from '@/lib/developer/authorization'
import {
  DEVELOPER_PERSONAL_KEYS_QUERY_KEY,
  createDeveloperPersonalKey,
  listDeveloperPersonalKeyCandidates,
  listDeveloperPersonalKeys,
  revokeDeveloperPersonalKey,
  revokeDeveloperPersonalKeySecret,
  rotateDeveloperPersonalKey,
  type DeveloperIssuedPersonalKey,
  type DeveloperPersonalKey,
} from '@/lib/developer/personal-keys'

/** Same scope label keys as the Settings > Developer section (kept local: that section renders this one). */
function scopeMessageKey(scope: string): string {
  return `developer.scope.${scope.replace(/\./g, '_')}`
}

/**
 * DEV-09 Settings > Developer > API keys: owner/admin personal keys with mandatory permissions, exact items and
 * per-job/monthly credit caps (defaults 50/500), optional IP allowlist. Built only from the existing settings pieces
 * (group title, rows, Dialog form, AppAlertDialog one-time secret, the DEV-03 item picker). Server state only: the
 * secret is shown once from the command response and dropped when the dialog closes.
 */

function IssuedKeyDialog({ issued, onClose }: { issued: DeveloperIssuedPersonalKey | null; onClose: () => void }) {
  const t = useTranslations('Settings')
  const [copied, setCopied] = React.useState<string | null>(null)
  return (
    <AppAlertDialog
      open={issued !== null}
      tone="warning"
      title={t('developer.keys.secretTitle')}
      description={t('developer.keys.secretDescription')}
      confirmLabel={t('developer.apps.done')}
      showCancel={false}
      onOpenChange={(open) => { if (!open) onClose() }}
      onConfirm={onClose}
    >
      {issued && (
        <div className="flex items-center gap-2">
          <Input readOnly value={issued.secret} aria-label={t('developer.keys.secretLabel')} className="font-mono text-xs" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { void navigator.clipboard?.writeText(issued.secret).then(() => setCopied(issued.secret)) }}
          >
            {copied === issued.secret ? t('developer.apps.copied') : t('developer.apps.copy')}
          </Button>
        </div>
      )}
    </AppAlertDialog>
  )
}

function CreateKeyDialog({ open, onOpenChange, onIssued }: { open: boolean; onOpenChange: (open: boolean) => void; onIssued: (issued: DeveloperIssuedPersonalKey) => void }) {
  const t = useTranslations('Settings')
  const queryClient = useQueryClient()
  const scopes = useQuery({ queryKey: DEVELOPER_SCOPES_QUERY_KEY, queryFn: ({ signal }) => listDeveloperScopes({ signal }), staleTime: 5 * 60_000, enabled: open })
  const [name, setName] = React.useState('')
  const [testKey, setTestKey] = React.useState(false)
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>([])
  const [resources, setResources] = React.useState<DeveloperConsentResource[]>([])
  const [perJob, setPerJob] = React.useState('50')
  const [monthly, setMonthly] = React.useState('500')
  const [ips, setIps] = React.useState('')
  const resourceKinds = [...new Set((scopes.data ?? []).filter((definition) => selectedScopes.includes(definition.scope)).flatMap((definition) => definition.resource_kinds))]
  const create = useMutation({
    mutationFn: () => createDeveloperPersonalKey({
      name,
      environment: testKey ? 'test' : 'production',
      scopes: selectedScopes,
      resources,
      caps: { per_job_credits: Number(perJob), monthly_credits: Number(monthly) },
      ip_allowlist: ips.split('\n').map((line) => line.trim()).filter(Boolean),
    }),
    onSuccess: async (issued) => {
      await queryClient.invalidateQueries({ queryKey: DEVELOPER_PERSONAL_KEYS_QUERY_KEY })
      onOpenChange(false)
      onIssued(issued)
    },
  })
  const capsValid = Number.isInteger(Number(perJob)) && Number.isInteger(Number(monthly)) && Number(perJob) >= 1 && Number(perJob) <= Number(monthly)
  const toggle = (scope: string, checked: boolean) => setSelectedScopes(checked ? [...new Set([...selectedScopes, scope])] : selectedScopes.filter((item) => item !== scope))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('developer.keys.createTitle')}</DialogTitle>
          <DialogDescription>{t('developer.keys.createDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="developer-key-name">{t('developer.keys.fieldName')}</Label>
            <Input id="developer-key-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={testKey} onCheckedChange={(checked) => setTestKey(checked === true)} />
            {t('developer.keys.fieldTest')}
          </label>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t('developer.apps.fieldPermissions')}</legend>
            {scopes.isLoading ? <Skeleton className="h-24 rounded-xl" /> : (scopes.data ?? []).map((definition) => (
              <label key={definition.scope} className="flex items-center gap-2 text-sm">
                <Checkbox checked={selectedScopes.includes(definition.scope)} onCheckedChange={(checked) => toggle(definition.scope, checked === true)} />
                {t(scopeMessageKey(definition.scope))}
              </label>
            ))}
          </fieldset>
          {resourceKinds.length > 0 && (
            <DeveloperResourcePicker
              key={resourceKinds.join(',')}
              uid={`personal-key:${selectedScopes.join(',')}`}
              resourceKinds={resourceKinds}
              onChange={setResources}
              disabled={create.isPending}
              loadCandidates={(input) => listDeveloperPersonalKeyCandidates(selectedScopes, input)}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="developer-key-per-job">{t('developer.keys.fieldPerJob')}</Label>
              <Input id="developer-key-per-job" inputMode="numeric" value={perJob} onChange={(event) => setPerJob(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="developer-key-monthly">{t('developer.keys.fieldMonthly')}</Label>
              <Input id="developer-key-monthly" inputMode="numeric" value={monthly} onChange={(event) => setMonthly(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="developer-key-ips">{t('developer.keys.fieldIps')}</Label>
            <Textarea id="developer-key-ips" value={ips} onChange={(event) => setIps(event.target.value)} rows={2} placeholder="203.0.113.0/24" />
          </div>
          {create.isError && <p className="text-sm text-destructive" role="alert">{t('developer.keys.failed')}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('developer.apps.cancel')}</Button>
          <Button type="button" disabled={create.isPending || !name.trim() || selectedScopes.length === 0 || !capsValid} onClick={() => create.mutate()}>
            {t('developer.keys.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KeyRow({ apiKey, onIssued }: { apiKey: DeveloperPersonalKey; onIssued: (issued: DeveloperIssuedPersonalKey) => void }) {
  const t = useTranslations('Settings')
  const format = useFormatter()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = React.useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: DEVELOPER_PERSONAL_KEYS_QUERY_KEY })
  const rotate = useMutation({ mutationFn: () => rotateDeveloperPersonalKey(apiKey.id, apiKey.version), onSuccess: onIssued, onSettled: refresh })
  const endSecret = useMutation({ mutationFn: (secretId: string) => revokeDeveloperPersonalKeySecret(apiKey.id, secretId, apiKey.version), onSettled: refresh })
  const revoke = useMutation({ mutationFn: () => revokeDeveloperPersonalKey(apiKey.id, apiKey.version), onSettled: async () => { setConfirm(false); await refresh() } })
  const busy = rotate.isPending || endSecret.isPending || revoke.isPending
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' })
  const active = apiKey.status === 'active'
  return (
    <div className="border-b border-border py-4" data-testid="developer-api-key-row">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{apiKey.name}</p>
        {apiKey.environment === 'test' && <Badge variant="secondary">{t('developer.connectedApps.testEnvironment')}</Badge>}
        {apiKey.status === 'suspended' && <Badge variant="outline">{t('developer.keys.suspended')}</Badge>}
        {apiKey.status === 'revoked' && <Badge variant="outline">{t('developer.keys.revoked')}</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t('developer.keys.caps', { perJob: apiKey.caps.per_job_credits, monthly: apiKey.caps.monthly_credits })}
        {' · '}
        {apiKey.last_used_at
          ? t('developer.keys.lastUsed', { date: date(apiKey.last_used_at), ip: apiKey.last_used_ip ?? '—' })
          : t('developer.keys.neverUsed')}
        {apiKey.ip_allowlist.length > 0 && <>{' · '}{t('developer.keys.ipRestricted', { count: apiKey.ip_allowlist.length })}</>}
      </p>
      <ul className="mt-2 space-y-1.5">
        {apiKey.secrets.map((secret, index) => (
          <li key={secret.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <KeyRound className="size-3.5" />
            <code className="font-mono">{`${secret.prefix}…${secret.hint}`}</code>
            <span>{t('developer.keys.expires', { date: date(secret.expires_at) })}</span>
            {active && apiKey.secrets.length > 1 && index > 0 && (
              <Button type="button" size="sm" variant="ghost" className="h-7 rounded-lg" disabled={busy} onClick={() => endSecret.mutate(secret.id)}>
                {t('developer.keys.endOldSecret')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {active && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy || apiKey.secrets.length > 1} onClick={() => rotate.mutate()}>
            <RefreshCw className="size-4" />
            {t('developer.keys.rotate')}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy} onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" />
            {t('developer.keys.revoke')}
          </Button>
        </div>
      )}
      {(rotate.isError || endSecret.isError || revoke.isError) && <p className="mt-1 text-xs text-destructive" role="alert">{t('developer.keys.failed')}</p>}
      <AppAlertDialog
        open={confirm}
        tone="destructive"
        title={t('developer.keys.revokeTitle', { name: apiKey.name })}
        description={t('developer.keys.revokeDescription')}
        confirmLabel={t('developer.keys.revoke')}
        busy={revoke.isPending}
        onOpenChange={setConfirm}
        onConfirm={() => revoke.mutate()}
      />
    </div>
  )
}

export function DeveloperApiKeys() {
  const t = useTranslations('Settings')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [issued, setIssued] = React.useState<DeveloperIssuedPersonalKey | null>(null)
  const query = useQuery({ queryKey: DEVELOPER_PERSONAL_KEYS_QUERY_KEY, queryFn: ({ signal }) => listDeveloperPersonalKeys({ signal }) })
  return (
    <section className="mb-8 mt-2" aria-busy={query.isLoading} data-testid="developer-api-keys">
      <div className="flex items-center justify-between gap-3">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('developer.keys.title')}</h3>
        </div>
        <Button type="button" size="sm" variant="outline" className="mb-3 h-8 rounded-lg" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('developer.keys.create')}
        </Button>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{t('developer.keys.description')}</p>
      {query.isLoading ? (
        <Skeleton className="h-[68px] rounded-2xl" />
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">{t('developer.keys.loadFailed')}</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('developer.keys.empty')}</p>
      ) : (
        <div>{(query.data ?? []).map((apiKey) => <KeyRow key={apiKey.id} apiKey={apiKey} onIssued={setIssued} />)}</div>
      )}
      <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} onIssued={setIssued} />
      <IssuedKeyDialog issued={issued} onClose={() => setIssued(null)} />
    </section>
  )
}
