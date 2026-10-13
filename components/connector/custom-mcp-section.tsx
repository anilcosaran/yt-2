'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ListChecks, Loader2, Plus, RefreshCw, Unplug, Waypoints } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  describeMcpRegistrationError,
  disableMcpServerRegistration,
  getMcpRegistrationCapabilities,
  listMcpServerRegistrations,
  MCP_REGISTRATION_CAPABILITIES_QUERY_KEY,
  MCP_REGISTRATIONS_QUERY_KEY,
  registerMcpServer,
  scanMcpServerRegistration,
  type McpServerRegistration,
} from '@/lib/connector/mcp-registrations-api'
import { cn } from '@/lib/utils'

import { CustomMcpToolReviewDialog } from './custom-mcp-tool-review-dialog'

type Translator = ReturnType<typeof useTranslations>

/** Tools listed under a scanned registration before "+N more". */
const VISIBLE_TOOLS = 12

// Same chips the Connector page already uses ("Primary" and "Coming soon").
const PRIMARY_CHIP = 'rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary'
const NEUTRAL_CHIP = 'rounded-md border border-border bg-panel px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

/**
 * QA-131 (a) custom (private remote) MCP on the Connector page (P01C-06 API): a clearly visible "Add custom MCP" button
 * that only an actor the server lets register sees (tenant owner today), the owner's registrations with their status
 * (Draft · Private test · Disabled), a read-only "Scan" and the scanned tools with blocked ones marked. Nothing is shown
 * while the feature switch is off. Server state only; no tool is ever called from here.
 */
export function CustomMcpSection() {
  const t = useTranslations('NewTheme')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const capabilitiesQuery = useQuery({
    queryKey: MCP_REGISTRATION_CAPABILITIES_QUERY_KEY,
    queryFn: ({ signal }) => getMcpRegistrationCapabilities({ signal }),
    staleTime: 60_000,
  })
  const capabilities = capabilitiesQuery.data
  const enabled = capabilities?.feature === 'enabled'
  const registrationsQuery = useQuery({
    queryKey: MCP_REGISTRATIONS_QUERY_KEY,
    queryFn: ({ signal }) => listMcpServerRegistrations({ signal }),
    enabled,
  })
  const registrations = registrationsQuery.data ?? []
  const canRegister = Boolean(capabilities?.can_register)
  // Feature off, unknown capabilities, or someone who can neither add nor has any: no section (no fake button).
  if (!enabled || (!canRegister && registrations.length === 0)) return null
  const limit = capabilities?.registration_limit ?? 0

  return (
    <section className="mt-7" aria-busy={registrationsQuery.isLoading} data-testid="custom-mcp-section">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Waypoints className="size-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('customMcp.title')}</h3>
        {canRegister ? (
          <Button type="button" size="sm" className="ml-auto h-8 rounded-lg" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            {t('customMcp.add')}
          </Button>
        ) : null}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{t('customMcp.description')}</p>
      {registrationsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Skeleton className="h-[68px] rounded-2xl" />
        </div>
      ) : registrationsQuery.isError ? (
        <p className="text-sm text-muted-foreground">{t('customMcp.loadFailed')}</p>
      ) : registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('customMcp.empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {registrations.map((registration) => (
            <CustomMcpRow key={registration.id} registration={registration} limit={limit} />
          ))}
        </div>
      )}
      {canRegister ? <CustomMcpDialog open={dialogOpen} limit={limit} onOpenChange={setDialogOpen} /> : null}
    </section>
  )
}

export function customMcpName(registration: Pick<McpServerRegistration, 'publisher_label' | 'endpoint_url'>): string {
  if (registration.publisher_label) return registration.publisher_label
  try {
    return new URL(registration.endpoint_url).host
  } catch {
    return registration.endpoint_url
  }
}

export function customMcpErrorMessage(error: unknown, t: Translator, limit: number): string {
  const described = describeMcpRegistrationError(error)
  if (described.kind === 'cooldown') {
    return described.retryAfterSeconds === null
      ? t('customMcp.errors.cooldownNoTime')
      : t('customMcp.errors.cooldown', { seconds: described.retryAfterSeconds })
  }
  if (described.kind === 'limit_reached') return t('customMcp.errors.limit_reached', { limit })
  return t(`customMcp.errors.${described.kind}`)
}

function scanSummary(registration: McpServerRegistration, t: Translator): string {
  const scan = registration.scan
  if (!scan) return t('customMcp.outcome.none')
  if (scan.outcome === 'complete') return t('customMcp.outcome.complete', { count: scan.toolsTotal })
  if (scan.outcome === 'partial') return t('customMcp.outcome.partial', { count: scan.toolsTotal })
  return t(`customMcp.outcome.${scan.outcome}`)
}

/** One registration: status chip, last scan result, Scan / Disable and the scanned tools (blocked ones marked). */
export function CustomMcpRow({ registration, limit }: { registration: McpServerRegistration; limit: number }) {
  const t = useTranslations('NewTheme')
  const queryClient = useQueryClient()
  const [confirmDisable, setConfirmDisable] = React.useState(false)
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [commandError, setCommandError] = React.useState<string | null>(null)
  const replace = (next: McpServerRegistration) => {
    queryClient.setQueryData<McpServerRegistration[]>(MCP_REGISTRATIONS_QUERY_KEY, (current) =>
      current?.map((row) => (row.id === next.id ? next : row)) ?? current)
  }
  const scanMutation = useMutation({
    mutationFn: () => scanMcpServerRegistration(registration.id),
    onMutate: () => setCommandError(null),
    onSuccess: replace,
    onError: (error) => {
      setCommandError(customMcpErrorMessage(error, t, limit))
      void queryClient.invalidateQueries({ queryKey: MCP_REGISTRATIONS_QUERY_KEY })
    },
  })
  const disableMutation = useMutation({
    mutationFn: () => disableMcpServerRegistration(registration.id),
    onMutate: () => setCommandError(null),
    onSuccess: replace,
    onError: (error) => setCommandError(customMcpErrorMessage(error, t, limit)),
    onSettled: () => setConfirmDisable(false),
  })
  const name = customMcpName(registration)
  const busy = scanMutation.isPending || disableMutation.isPending
  const scannable = registration.status === 'draft' || registration.status === 'test'
  const tools = registration.scan?.tools ?? []
  const hiddenTools = Math.max(0, tools.length - VISIBLE_TOOLS)
  const primaryStage = registration.lifecycle_stage === 'private_test' || registration.lifecycle_stage === 'active'
  // QA-169: a scanned test or active server's tools are reviewed (and the server activated) in the review dialog.
  const reviewable = (registration.status === 'test' || registration.status === 'active') && registration.scan !== null

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-panel/40 p-3.5" data-testid="custom-mcp-row">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-panel">
          <Waypoints className="size-5 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <span className={cn('shrink-0', primaryStage ? PRIMARY_CHIP : NEUTRAL_CHIP)}>
              {t(`customMcp.status.${registration.lifecycle_stage}`)}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground" title={registration.endpoint_url}>{registration.endpoint_url}</p>
          <p className="truncate text-xs text-muted-foreground" role="status">
            {commandError ?? (scanMutation.isPending ? t('customMcp.scanning') : scanSummary(registration, t))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reviewable ? (
            <Button type="button" size="sm" className="h-8 rounded-lg" disabled={busy} onClick={() => setReviewOpen(true)}>
              <ListChecks className="size-4" />
              {t('customMcpReview.open')}
            </Button>
          ) : null}
          {scannable ? (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy} onClick={() => scanMutation.mutate()}>
              {scanMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {t('customMcp.scan')}
            </Button>
          ) : null}
          {registration.status !== 'disabled' ? (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy} onClick={() => setConfirmDisable(true)}>
              <Unplug className="size-4" />
              {t('customMcp.disable')}
            </Button>
          ) : null}
        </div>
      </div>
      {tools.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3" aria-label={t('customMcp.toolsLabel', { name })}>
          {tools.slice(0, VISIBLE_TOOLS).map((tool) => (
            <li key={tool.name} className="flex min-w-0 items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{tool.name}</span>
              {tool.policy_preview === 'block' ? (
                <Badge className="bg-warning/15 text-warning hover:bg-warning/15" title={t('customMcp.toolBlockedReason')}>
                  <AlertTriangle aria-hidden="true" />
                  {t('customMcp.toolBlocked')}
                </Badge>
              ) : null}
            </li>
          ))}
          {hiddenTools > 0 ? <li className="text-xs text-muted-foreground">{t('customMcp.moreTools', { count: hiddenTools })}</li> : null}
          {registration.scan && registration.scan.excludedTotal > 0 ? (
            <li className="text-xs text-muted-foreground">{t('customMcp.excluded', { count: registration.scan.excludedTotal })}</li>
          ) : null}
        </ul>
      ) : null}
      {reviewable ? <CustomMcpToolReviewDialog registration={registration} name={name} open={reviewOpen} onOpenChange={setReviewOpen} /> : null}
      <AppAlertDialog
        open={confirmDisable}
        tone="destructive"
        title={t('customMcp.disableTitle', { name })}
        description={t('customMcp.disableDescription')}
        confirmLabel={t('customMcp.disable')}
        busy={disableMutation.isPending}
        onOpenChange={setConfirmDisable}
        onConfirm={() => disableMutation.mutate()}
      />
    </div>
  )
}

/** The "Add custom MCP" form: endpoint URL + optional name; the server applies the egress and owner rules. */
export function CustomMcpDialog({ open, limit, onOpenChange }: { open: boolean; limit: number; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('NewTheme')
  const queryClient = useQueryClient()
  const [endpointUrl, setEndpointUrl] = React.useState('')
  const [publisherLabel, setPublisherLabel] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const registerMutation = useMutation({
    mutationFn: registerMcpServer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MCP_REGISTRATIONS_QUERY_KEY })
      close(false)
    },
    onError: (error) => setErrorMessage(customMcpErrorMessage(error, t, limit)),
  })

  function close(next: boolean) {
    if (!next) {
      setEndpointUrl('')
      setPublisherLabel('')
      setErrorMessage(null)
    }
    onOpenChange(next)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!endpointUrl.trim() || registerMutation.isPending) return
    setErrorMessage(null)
    registerMutation.mutate({ endpointUrl, publisherLabel })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t('customMcp.dialog.title')}</DialogTitle>
            <DialogDescription>{t('customMcp.dialog.description')}</DialogDescription>
          </DialogHeader>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('customMcp.dialog.failedTitle')}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="custom-mcp-endpoint">{t('customMcp.dialog.urlLabel')}</Label>
            <Input
              id="custom-mcp-endpoint"
              type="url"
              inputMode="url"
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
              placeholder={t('customMcp.dialog.urlPlaceholder')}
              maxLength={2048}
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-mcp-label">{t('customMcp.dialog.labelLabel')}</Label>
            <Input
              id="custom-mcp-label"
              value={publisherLabel}
              onChange={(event) => setPublisherLabel(event.target.value)}
              placeholder={t('customMcp.dialog.labelPlaceholder')}
              maxLength={120}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>{t('customMcp.dialog.cancel')}</Button>
            <Button type="submit" disabled={!endpointUrl.trim() || registerMutation.isPending}>
              {registerMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {registerMutation.isPending ? t('customMcp.dialog.submitting') : t('customMcp.dialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
