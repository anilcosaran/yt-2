'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  describeDeveloperCapsError,
  developerCapsInputProblem,
  developerInstallationCapsQueryKey,
  getDeveloperInstallationCaps,
  parseDeveloperCapsInput,
  updateDeveloperInstallationCaps,
  type DeveloperCapsErrorKind,
  type DeveloperInstallationCaps,
} from '@/lib/developer/installation-caps-api'

/**
 * QA-194 — the "Limitler" dialog of a Connected apps row (existing Dialog + Label/Input): the per-job and monthly
 * credit caps the app's API/MCP jobs run under. Owner/admin change them (the server checks bounds and role and audits
 * the change); everyone else reads them. The consent screen is not changed: new connections start on the defaults.
 */
export function DeveloperInstallationLimitsDialog({
  installationId,
  appName,
  open,
  onOpenChange,
}: {
  installationId: string
  appName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('Settings')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t('developer.connectedApps.limits.title', { name: appName })}</DialogTitle>
          <DialogDescription>{t('developer.connectedApps.limits.description')}</DialogDescription>
        </DialogHeader>
        {open ? <DeveloperInstallationLimitsBody installationId={installationId} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

export function DeveloperInstallationLimitsBody({ installationId, onDone }: { installationId: string; onDone: () => void }) {
  const t = useTranslations('Settings')
  const query = useQuery({
    queryKey: developerInstallationCapsQueryKey(installationId),
    queryFn: ({ signal }) => getDeveloperInstallationCaps(installationId, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  if (query.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={t('developer.connectedApps.limits.loading')}>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    )
  }
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground" role="alert">{t('developer.connectedApps.limits.loadFailed')}</p>
  }
  return <DeveloperInstallationLimitsForm key={`${query.data.version ?? 'defaults'}`} caps={query.data} installationId={installationId} onDone={onDone} />
}

/** Two number inputs prefilled from the server; nothing is kept outside this dialog. */
export function DeveloperInstallationLimitsForm({
  caps,
  installationId,
  onDone,
}: {
  caps: DeveloperInstallationCaps
  installationId: string
  onDone: () => void
}) {
  const t = useTranslations('Settings')
  const queryClient = useQueryClient()
  const [perJob, setPerJob] = React.useState(String(caps.per_job_credits))
  const [monthly, setMonthly] = React.useState(String(caps.monthly_credits))
  const [errorKind, setErrorKind] = React.useState<DeveloperCapsErrorKind | null>(null)
  const problem = developerCapsInputProblem({ perJob, monthly }, caps.bounds)
  const unchanged = parseDeveloperCapsInput(perJob) === caps.per_job_credits && parseDeveloperCapsInput(monthly) === caps.monthly_credits
  const save = useMutation({
    mutationFn: () => updateDeveloperInstallationCaps(installationId, {
      perJobCredits: parseDeveloperCapsInput(perJob),
      monthlyCredits: parseDeveloperCapsInput(monthly),
      expectedVersion: caps.version,
    }),
    onMutate: () => setErrorKind(null),
    onSuccess: (saved) => {
      queryClient.setQueryData(developerInstallationCapsQueryKey(installationId), saved)
      onDone()
    },
    onError: async (error) => {
      setErrorKind(describeDeveloperCapsError(error))
      await queryClient.invalidateQueries({ queryKey: developerInstallationCapsQueryKey(installationId) })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!caps.can_edit || problem || unchanged || save.isPending) return
    save.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="developer-installation-limits">
      {errorKind ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t(`developer.connectedApps.limits.errors.${errorKind}`)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`developer-limits-per-job-${installationId}`}>{t('developer.connectedApps.limits.perJob')}</Label>
        <Input
          id={`developer-limits-per-job-${installationId}`}
          type="number"
          inputMode="decimal"
          min={caps.bounds.min}
          max={caps.bounds.max}
          step="any"
          value={perJob}
          onChange={(event) => setPerJob(event.target.value)}
          disabled={!caps.can_edit || save.isPending}
          aria-invalid={problem === 'per_job_invalid' || undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`developer-limits-monthly-${installationId}`}>{t('developer.connectedApps.limits.monthly')}</Label>
        <Input
          id={`developer-limits-monthly-${installationId}`}
          type="number"
          inputMode="decimal"
          min={caps.bounds.min}
          max={caps.bounds.max}
          step="any"
          value={monthly}
          onChange={(event) => setMonthly(event.target.value)}
          disabled={!caps.can_edit || save.isPending}
          aria-invalid={problem === 'monthly_invalid' || problem === 'monthly_below_per_job' || undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {problem && caps.can_edit
          ? t(`developer.connectedApps.limits.problems.${problem}`, { min: caps.bounds.min, max: caps.bounds.max })
          : t('developer.connectedApps.limits.defaults', { perJob: caps.defaults.per_job_credits, monthly: caps.defaults.monthly_credits })}
      </p>
      {!caps.can_edit ? <p className="text-xs text-muted-foreground" role="note">{t('developer.connectedApps.limits.readOnly')}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>{t('developer.connectedApps.limits.cancel')}</Button>
        {caps.can_edit ? (
          <Button type="submit" disabled={Boolean(problem) || unchanged || save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {save.isPending ? t('developer.connectedApps.limits.saving') : t('developer.connectedApps.limits.save')}
          </Button>
        ) : null}
      </DialogFooter>
    </form>
  )
}
