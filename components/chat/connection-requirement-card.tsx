'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Link2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  connectorsForCapabilities,
  getConnectionRequirement,
  getConnectorConnection,
  listConnectorResourceCandidates,
  listConnectors,
  resolveConnectionRequirement,
  selectConnectorResources,
  setConnectorConnectionEnabled,
  type ConnectionRequirement,
  type ConnectorCatalogEntry,
  type ConnectorResourceCandidate,
} from '@/lib/connector/api'
import { subscribeConnectionRequirementEvents } from '@/lib/connector/requirement-events'
import { useConnectorAuthorization } from '@/lib/connector/use-connector-authorization'

const BUTTON_CLASS = 'h-10 cursor-pointer rounded-[10px] border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors hover:bg-muted dark:border-white/22 dark:bg-white/[0.035] dark:text-white dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] dark:hover:border-white/42 dark:hover:bg-white/[0.075] dark:hover:text-white'

type CardStatus =
  | 'loading'
  | 'waiting_owner'
  | 'closed'
  | 'satisfied'
  | 'unavailable'
  | 'popup_blocked'
  | 'not_connected'
  | 'failed'
  | 'checking'
  | 'last_attempt_failed'
  | 'reason'

/**
 * P03-18 small Chat connection card, rendered on the job's connection question. It uses the existing card shell of
 * the Chat result cards and the same Connector API as the management screen. One action at a time (connect / enable /
 * reconnect / add permission / pick the account resource / retry); the server decides which (P01C-10). Updates arrive
 * over the conversation's single SSE stream; the card re-reads the server state, it never keeps its own copy.
 * A closed popup or denied consent keeps the same job waiting; the card never shows "connected" by itself.
 */
export function ConnectionRequirementCard({ requirementId }: { requirementId: string }) {
  const t = useTranslations('Chat')
  const [view, setView] = React.useState<ConnectionRequirement | null>(null)
  const [catalog, setCatalog] = React.useState<ConnectorCatalogEntry[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState<CardStatus>('loading')
  const [picker, setPicker] = React.useState<{ connectionId: string; candidates: ConnectorResourceCandidate[] } | null>(null)
  const authorization = useConnectorAuthorization()

  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await getConnectionRequirement(requirementId, { signal })
      setView(next)
      setStatus(statusOf(next))
      return next
    } catch {
      if (!signal?.aborted) setStatus('failed')
      return null
    }
  }, [requirementId])

  React.useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const resetFlow = authorization.reset
  React.useEffect(() => subscribeConnectionRequirementEvents((event) => {
    if (event.requirementId !== requirementId) return
    // The server moved the requirement (attempt resolved, card changed): its state replaces the local flow.
    resetFlow()
    void refresh()
  }), [refresh, requirementId, resetFlow])

  React.useEffect(() => {
    if (!view || view.state !== 'open' || !view.actionable || view.card !== 'connect' || catalog) return
    const controller = new AbortController()
    listConnectors({ signal: controller.signal }).then(setCatalog).catch(() => setCatalog([]))
    return () => controller.abort()
  }, [catalog, view])

  async function runStep(step: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await step()
    } catch {
      setStatus('failed')
    } finally {
      setBusy(false)
    }
  }

  async function resolveNow(current: ConnectionRequirement) {
    setStatus('checking')
    const next = await resolveConnectionRequirement(current.connection_requirement_id, current.version)
    setView((previous) => (previous ? { ...previous, ...next } : next))
    setStatus(statusOf({ ...current, ...next }))
  }

  async function connect(slug: string, current: ConnectionRequirement, connectionId: string | null) {
    await authorization.start({
      connectorSlug: slug,
      capabilities: current.required_capabilities,
      connectionId,
      connectionRequirement: { ref: current.connection_requirement_id, version: current.version },
    })
  }

  async function act(current: ConnectionRequirement, slug?: string) {
    await runStep(async () => {
      const connectionId = current.candidate_connection_id ?? null
      switch (current.card) {
        case 'connect':
          if (slug) await connect(slug, current, null)
          return
        case 'reconnect':
        case 'add_permission': {
          if (!connectionId) return
          const connection = await getConnectorConnection(connectionId)
          await connect(connection.connector_slug, current, connectionId)
          return
        }
        case 'enable': {
          if (!connectionId) return
          const connection = await getConnectorConnection(connectionId)
          await setConnectorConnectionEnabled(connectionId, { enabled: true, expectedVersion: connection.version })
          await resolveNow(current)
          return
        }
        case 'select_account': {
          if (!connectionId) return
          const connection = await getConnectorConnection(connectionId)
          const kind = current.resource_constraints?.resource?.resource_kind
            ?? connection.bound_resources[0]?.resource_kind
          if (!kind) {
            setStatus('unavailable')
            return
          }
          const page = await listConnectorResourceCandidates(connectionId, { resourceKind: kind })
          setPicker({ connectionId, candidates: page.items })
          return
        }
        case 'retry_later':
          await resolveNow(current)
          return
        default:
      }
    })
  }

  async function pick(current: ConnectionRequirement, candidate: ConnectorResourceCandidate) {
    await runStep(async () => {
      if (!picker) return
      await selectConnectorResources(picker.connectionId, {
        capabilities: current.required_capabilities,
        resources: [{ resource_kind: candidate.resource_kind, resource_id: candidate.resource_id }],
      })
      setPicker(null)
      await resolveNow(current)
    })
  }

  const flow = authorization.flow
  const connectors = view && view.card === 'connect' && catalog ? connectorsForCapabilities(catalog, view.required_capabilities) : []
  const title = view && view.state === 'open' ? t(`connectionRequirement.title.${view.card}`) : t('connectionRequirement.title.none')
  const showActions = Boolean(view && view.state === 'open' && view.actionable && flow.phase !== 'popup' && flow.phase !== 'finishing')
  // The local popup flow speaks until the server moves the requirement (its SSE event resets the flow): a closed
  // popup is "not connected", and a finished consent is only "checking" — the Connector's attempt event decides.
  const flowStatus: CardStatus | null = flow.phase === 'error'
    ? (flow.reason === 'popup_blocked' ? 'popup_blocked' : flow.reason === 'closed' ? 'not_connected' : 'failed')
    : flow.phase === 'done' ? 'checking' : null
  // No available connector provides the capability: explained, never a fake Connect.
  const shownStatus: CardStatus = flowStatus
    ?? (view?.card === 'connect' && catalog && connectors.length === 0 && status === 'reason' ? 'unavailable' : status)

  return (
    <div
      data-testid="connection-requirement-card"
      className="flex w-[min(620px,92vw)] flex-col gap-3 rounded-[14px] border border-border/80 bg-card p-3 text-card-foreground shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-[0_16px_44px_rgba(0,0,0,0.24)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground ring-1 ring-border/80 dark:bg-white/10 dark:text-white dark:ring-white/8">
          {shownStatus === 'loading' || shownStatus === 'checking' || flow.phase === 'popup' || flow.phase === 'finishing'
            ? <Loader2 className="size-5 animate-spin" />
            : <Link2 className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground dark:text-white">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground dark:text-white/58" role="status">
            {flow.phase === 'popup'
              ? t('connectionRequirement.status.popup')
              : shownStatus === 'reason' && view
                ? t(`connectionRequirement.reason.${reasonKey(view.reason_code)}`)
                : t(`connectionRequirement.status.${shownStatus}`)}
          </p>
        </div>
        {showActions && view && (
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {view.card === 'connect'
              ? connectors.map((connector) => (
                <Button key={connector.connector_slug} type="button" variant="outline" size="sm" className={BUTTON_CLASS} disabled={busy} onClick={() => void act(view, connector.connector_slug)}>
                  {t('connectionRequirement.action.connectTo', { name: connector.display_name })}
                </Button>
              ))
              : view.card !== 'none' && !picker && (
                <Button type="button" variant="outline" size="sm" className={BUTTON_CLASS} disabled={busy} onClick={() => void act(view)}>
                  {t(`connectionRequirement.action.${view.card}`)}
                  {busy && <Loader2 className="size-4 animate-spin" />}
                </Button>
              )}
          </div>
        )}
      </div>
      {flow.phase === 'select' && (
        <CandidateList
          label={t('connectionRequirement.pickResource')}
          candidates={flow.candidates}
          disabled={busy}
          onPick={(candidate) => void authorization.select(candidate)}
        />
      )}
      {picker && view && (
        <CandidateList
          label={t('connectionRequirement.pickResource')}
          candidates={picker.candidates}
          disabled={busy}
          onPick={(candidate) => void pick(view, candidate)}
        />
      )}
    </div>
  )
}

function CandidateList({ label, candidates, disabled, onPick }: {
  label: string
  candidates: ConnectorResourceCandidate[]
  disabled: boolean
  onPick: (candidate: ConnectorResourceCandidate) => void
}) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <p className="text-xs font-medium text-muted-foreground dark:text-white/56">{label}</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <Button
            key={`${candidate.resource_kind}:${candidate.resource_id}`}
            type="button"
            variant="outline"
            size="sm"
            className={BUTTON_CLASS}
            disabled={disabled}
            onClick={() => onPick(candidate)}
          >
            {candidate.display_label ?? candidate.resource_id}
          </Button>
        ))}
      </div>
    </div>
  )
}

const REASON_KEYS = new Set([
  'needs_connection',
  'connection_disabled',
  'reauth_required',
  'scope_required',
  'resource_selection_required',
  'upstream_unavailable',
  'rate_limited',
])

function reasonKey(reason: string): string {
  return REASON_KEYS.has(reason) ? reason : 'other'
}

export function statusOf(view: ConnectionRequirement): CardStatus {
  if (view.state === 'satisfied') return 'satisfied'
  if (view.state !== 'open') return 'closed'
  if (!view.actionable) return 'waiting_owner'
  if (view.card === 'none') return 'unavailable'
  if (view.last_attempt_outcome && view.last_attempt_outcome !== 'connected') return 'last_attempt_failed'
  return 'reason'
}
