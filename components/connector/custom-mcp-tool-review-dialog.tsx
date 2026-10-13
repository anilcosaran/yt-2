'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MCP_REGISTRATIONS_QUERY_KEY, type McpServerRegistration } from '@/lib/connector/mcp-registrations-api'
import {
  activateMcpServerRegistration,
  describeMcpToolReviewError,
  getMcpToolReview,
  mcpActivationReasonKind,
  mcpToolReviewQueryKey,
  MCP_OPEN_TOOL_EFFECTS,
  submitMcpToolReview,
  type McpReviewTool,
  type McpToolChange,
  type McpToolDecision,
  type McpToolReview,
  type McpToolReviewErrorKind,
} from '@/lib/connector/mcp-tool-review-api'
import {
  initialMcpToolReviewForm,
  mcpToolBlockOnly,
  mcpToolDecisionChoices,
  planMcpToolReviewSubmit,
  type McpToolFormEntry,
  type McpToolReviewForm,
} from '@/lib/connector/mcp-tool-review-form'
import { cn } from '@/lib/utils'

type Translator = ReturnType<typeof useTranslations>

// The chips of the custom MCP row (custom-mcp-section.tsx) and its blocked-tool badge.
const PRIMARY_CHIP = 'rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary'
const NEUTRAL_CHIP = 'rounded-md border border-border bg-panel px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'
const WARNING_CHIP = 'rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning'
// The segmented control of the tools pages (tool-output-view-switch.tsx).
const SEGMENT_ITEM = 'h-7 rounded-full px-3 text-xs font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm'

const CHANGE_CHIP: Record<McpToolChange, string> = {
  added: PRIMARY_CHIP,
  changed: WARNING_CHIP,
  unchanged: NEUTRAL_CHIP,
  removed: NEUTRAL_CHIP,
}

const KNOWN_CAPABILITY_LABELS: ReadonlySet<string> = new Set(['ads', 'calendar', 'crm', 'docs', 'drive', 'email', 'messaging', 'publish', 'social'])

/**
 * QA-169 — the custom MCP tool review dialog opened from a custom-MCP row on the Connector page (P01C-07 review,
 * P01C-14 activation): a New / Changed / Same / Removed badge per tool, an Allow / Ask / Block choice, effect and
 * capability for Allow/Ask, Block only for generation/spend/admin tools; the primary button "Etkinleştir" (activate a
 * private test) or "Yeniden uygula" (an active server: the server renews the grant after the review, QA-171).
 */
export function CustomMcpToolReviewDialog({
  registration,
  name,
  open,
  onOpenChange,
}: {
  registration: McpServerRegistration
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('NewTheme')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t('customMcpReview.title', { name })}</DialogTitle>
          <DialogDescription>{t('customMcpReview.description')}</DialogDescription>
        </DialogHeader>
        {open ? <CustomMcpToolReviewBody registration={registration} name={name} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

/** Loads the server's review (no local draft is persisted) and applies the owner's choices. */
export function CustomMcpToolReviewBody({ registration, name, onDone }: { registration: McpServerRegistration; name: string; onDone: () => void }) {
  const t = useTranslations('NewTheme')
  const queryClient = useQueryClient()
  const reviewQuery = useQuery({
    queryKey: mcpToolReviewQueryKey(registration.id),
    queryFn: ({ signal }) => getMcpToolReview(registration.id, { signal }),
    staleTime: 0,
    // The owner's unsaved choices live in this dialog only; a background refetch must not reset them.
    refetchOnWindowFocus: false,
  })
  const review = reviewQuery.data ?? null
  const [errorKind, setErrorKind] = React.useState<McpToolReviewErrorKind | null>(null)
  // The owner's choices are keyed by the server state: another snapshot or registration version starts them again.
  const reviewKey = review ? `${review.registrationVersion}:${review.snapshot?.id ?? ''}` : null
  const [draft, setDraft] = React.useState<{ key: string; form: McpToolReviewForm } | null>(null)
  const form = review && reviewKey ? (draft?.key === reviewKey ? draft.form : initialMcpToolReviewForm(review)) : null

  const plan = review && form ? planMcpToolReviewSubmit(review, form, registration.status) : null
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!review || !plan || !review.snapshot) throw new Error('mcp_tool_review_not_ready')
      let version = review.registrationVersion
      if (plan.decisions) {
        const saved = await submitMcpToolReview(registration.id, { snapshotId: review.snapshot.id, expectedVersion: version, decisions: plan.decisions })
        queryClient.setQueryData(mcpToolReviewQueryKey(registration.id), saved)
        version = saved.registrationVersion
        const renewal = saved.grantRenewal
        if (renewal && (renewal.status === 'rejected' || renewal.status === 'failed')) {
          return { error: renewal.status === 'rejected' ? mcpActivationReasonKind(renewal.reason) : 'failed' as const }
        }
      }
      if (plan.activate) await activateMcpServerRegistration(registration.id, version)
      return { error: null }
    },
    onMutate: () => setErrorKind(null),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: MCP_REGISTRATIONS_QUERY_KEY })
      if (result.error) {
        setErrorKind(result.error)
        return
      }
      onDone()
    },
    onError: async (error) => {
      setErrorKind(describeMcpToolReviewError(error))
      await queryClient.invalidateQueries({ queryKey: mcpToolReviewQueryKey(registration.id) })
    },
  })

  if (reviewQuery.isLoading) return <CustomMcpToolReviewSkeleton label={t('customMcpReview.loading')} />
  if (reviewQuery.isError || !review || !form) {
    return <p className="text-sm text-muted-foreground" role="alert">{t('customMcpReview.loadFailed')}</p>
  }
  return (
    <CustomMcpToolReviewPanel
      review={review}
      form={form}
      name={name}
      status={registration.status}
      errorKind={errorKind}
      busy={applyMutation.isPending}
      onChange={(toolName, entry) => setDraft({ key: reviewKey!, form: { ...form, [toolName]: entry } })}
      onCancel={onDone}
      onApply={() => applyMutation.mutate()}
    />
  )
}

function CustomMcpToolReviewSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label={label}>
      <Skeleton className="h-[72px] rounded-xl" />
      <Skeleton className="h-[72px] rounded-xl" />
    </div>
  )
}

/** The review form itself (stateless: the owner's choices come in, changes go out). */
export function CustomMcpToolReviewPanel({
  review,
  form,
  name,
  status,
  errorKind,
  busy,
  onChange,
  onCancel,
  onApply,
}: {
  review: McpToolReview
  form: McpToolReviewForm
  name: string
  status: McpServerRegistration['status']
  errorKind: McpToolReviewErrorKind | null
  busy: boolean
  onChange: (toolName: string, entry: McpToolFormEntry) => void
  onCancel: () => void
  onApply: () => void
}) {
  const t = useTranslations('NewTheme')
  const plan = planMcpToolReviewSubmit(review, form, status)
  const reviewable = Boolean(review.snapshot?.reviewable)
  const primaryLabel = status === 'active' ? t('customMcpReview.reapply') : t('customMcpReview.activate')

  return (
    <div className="flex flex-col gap-4" data-testid="custom-mcp-tool-review">
      {errorKind ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('customMcpReview.failedTitle')}</AlertTitle>
          <AlertDescription>{t(`customMcpReview.errors.${errorKind}`)}</AlertDescription>
        </Alert>
      ) : null}
      {!reviewable ? (
        <p className="text-sm text-muted-foreground">{t('customMcpReview.notReviewable')}</p>
      ) : review.tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('customMcpReview.noTools')}</p>
      ) : (
        <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1" aria-label={t('customMcpReview.toolsLabel', { name })}>
          {review.tools.map((tool) => (
            <CustomMcpToolReviewRow
              key={tool.name}
              tool={tool}
              entry={form[tool.name] ?? null}
              namespaces={review.capabilityNamespaces}
              disabled={busy}
              onChange={(entry) => onChange(tool.name, entry)}
            />
          ))}
        </ul>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{t('customMcpReview.cancel')}</Button>
        <Button type="button" onClick={onApply} disabled={!plan || busy} data-testid="custom-mcp-tool-review-apply">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {busy ? t('customMcpReview.saving') : primaryLabel}
        </Button>
      </DialogFooter>
    </div>
  )
}

function CustomMcpToolReviewRow({
  tool,
  entry,
  namespaces,
  disabled,
  onChange,
}: {
  tool: McpReviewTool
  entry: McpToolFormEntry | null
  namespaces: readonly string[]
  disabled: boolean
  onChange: (entry: McpToolFormEntry) => void
}) {
  const t = useTranslations('NewTheme')
  const choices = mcpToolDecisionChoices(tool)
  const blockOnly = mcpToolBlockOnly(tool)
  const current: McpToolFormEntry = entry ?? { decision: null, effect: null, namespace: null }
  const open = current.decision === 'allow' || current.decision === 'ask'
  const label = tool.title && tool.title !== tool.name ? tool.title : null

  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-border bg-panel/40 p-3" data-testid="custom-mcp-tool-review-row">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={tool.name}>
          {tool.name}
          {label ? <span className="ml-2 text-xs font-normal text-muted-foreground">{label}</span> : null}
        </span>
        <span className={cn('shrink-0', CHANGE_CHIP[tool.change])}>{t(`customMcpReview.change.${tool.change}`)}</span>
        {tool.decision_required && !current.decision ? (
          <Badge className="bg-warning/15 text-warning hover:bg-warning/15">{t('customMcpReview.decisionRequired')}</Badge>
        ) : null}
      </div>
      {tool.change === 'removed' ? (
        <p className="text-xs text-muted-foreground">{t('customMcpReview.removedHint')}</p>
      ) : (
        <>
          <ToggleGroup
            type="single"
            value={current.decision ?? ''}
            onValueChange={(next) => {
              if (next === 'allow' || next === 'ask' || next === 'block') onChange({ ...current, decision: next as McpToolDecision })
            }}
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={t('customMcpReview.decision.label', { tool: tool.name })}
            className="h-8 rounded-full border border-border bg-muted/40 p-0.5"
          >
            {(['allow', 'ask', 'block'] as const).map((decision) => (
              <ToggleGroupItem key={decision} value={decision} disabled={!choices.includes(decision)} className={SEGMENT_ITEM}>
                {t(`customMcpReview.decision.${decision}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {blockOnly ? <p className="text-xs text-muted-foreground">{t('customMcpReview.blockOnly')}</p> : null}
          {open ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('customMcpReview.effect.label')}</Label>
                <Select
                  value={current.effect ?? undefined}
                  onValueChange={(next) => onChange({ ...current, effect: next as McpToolFormEntry['effect'] })}
                  disabled={disabled}
                >
                  <SelectTrigger size="sm" className="h-8 w-full shadow-none" aria-label={t('customMcpReview.effect.label')}>
                    <SelectValue placeholder={t('customMcpReview.effect.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MCP_OPEN_TOOL_EFFECTS.map((effect) => (
                      <SelectItem key={effect} value={effect}>{t(`customMcpReview.effect.${effect}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('customMcpReview.capability.label')}</Label>
                <Select
                  value={current.namespace ?? undefined}
                  onValueChange={(next) => onChange({ ...current, namespace: next })}
                  disabled={disabled || namespaces.length === 0}
                >
                  <SelectTrigger size="sm" className="h-8 w-full shadow-none" aria-label={t('customMcpReview.capability.label')}>
                    <SelectValue placeholder={t('customMcpReview.capability.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {namespaces.map((namespace) => (
                      <SelectItem key={namespace} value={namespace}>
                        {capabilityLabel(namespace, t)}
                        {current.effect ? <span className="ml-1 text-xs text-muted-foreground">{`${namespace}.${current.effect}`}</span> : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </>
      )}
    </li>
  )
}

function capabilityLabel(namespace: string, t: Translator): string {
  return KNOWN_CAPABILITY_LABELS.has(namespace) ? t(`customMcpReview.capability.${namespace}`) : namespace
}
