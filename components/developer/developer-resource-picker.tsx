'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  listDeveloperAuthorizationCandidates,
  type DeveloperConsentResource,
  type DeveloperResourceCandidate,
} from '@/lib/developer/authorization'

/**
 * DEV-03 typed resource picker of the consent screen: one group per resource kind the requested permissions can select,
 * listed by the owners on the server (channels, templates; projects and files of one chosen channel). Exact
 * selectors only — there is no "all" choice. Uses the Connector picker's pill buttons (pressed = selected).
 * Server state only; the selection lives in memory until Allow.
 */

const KIND_LABEL: Record<string, string> = { channel: 'kindChannel', template: 'kindTemplate', project: 'kindProject', asset: 'kindAsset' }

function keyOf(candidate: DeveloperConsentResource): string {
  return `${candidate.kind}:${candidate.id}:${candidate.revision_id ?? ''}:${candidate.channel_id ?? ''}`
}

function toSelector(candidate: DeveloperResourceCandidate): DeveloperConsentResource {
  return {
    kind: candidate.kind,
    id: candidate.id,
    ...(candidate.revision_id ? { revision_id: candidate.revision_id } : {}),
    ...(candidate.channel_id ? { channel_id: candidate.channel_id } : {}),
  }
}

function Pills({ label, items, selected, disabled, onToggle, pressedMode = 'multi' }: {
  label: string
  items: DeveloperResourceCandidate[]
  selected: (candidate: DeveloperResourceCandidate) => boolean
  disabled: boolean
  onToggle: (candidate: DeveloperResourceCandidate) => void
  pressedMode?: 'multi' | 'single'
}) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label} data-mode={pressedMode}>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((candidate) => {
          const pressed = selected(candidate)
          return (
            <Button
              key={keyOf(candidate)}
              type="button"
              variant={pressed ? 'default' : 'outline'}
              aria-pressed={pressed}
              className="h-9 rounded-full px-4 shadow-sm"
              disabled={disabled}
              onClick={() => onToggle(candidate)}
            >
              {candidate.display_label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

/** DEV-09: the personal-key dialog lists candidates from its own endpoint (default: the consent interaction's). */
export type DeveloperCandidateLoader = (input: { kind: string; channelId?: string | null; signal?: AbortSignal }) => Promise<{ items: DeveloperResourceCandidate[]; next_cursor: string | null }>

function CandidateGroup({ uid, kind, channelId, disabled, isSelected, onToggle, load }: {
  uid: string
  load: DeveloperCandidateLoader
  kind: string
  channelId: string | null
  disabled: boolean
  isSelected: (candidate: DeveloperResourceCandidate) => boolean
  onToggle: (candidate: DeveloperResourceCandidate) => void
}) {
  const t = useTranslations('DeveloperConsent')
  const query = useQuery({
    queryKey: ['developer', 'authorization', uid, 'candidates', kind, channelId],
    queryFn: ({ signal }) => load({ kind, channelId, signal }),
    staleTime: 30_000,
  })
  if (query.isLoading) return <Skeleton className="h-9 w-2/3 rounded-full" />
  if (query.isError) return <p className="text-sm text-destructive" role="alert">{t('candidatesFailed')}</p>
  const items = query.data?.items ?? []
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t('noCandidates')}</p>
  return <Pills label={t(KIND_LABEL[kind] ?? 'chooseItems')} items={items} selected={isSelected} disabled={disabled} onToggle={onToggle} />
}

export function DeveloperResourcePicker({ uid, resourceKinds, onChange, disabled, loadCandidates }: {
  uid: string
  loadCandidates?: DeveloperCandidateLoader
  resourceKinds: string[]
  onChange: (resources: DeveloperConsentResource[]) => void
  disabled: boolean
}) {
  const t = useTranslations('DeveloperConsent')
  const [selected, setSelected] = React.useState<Map<string, DeveloperConsentResource>>(new Map())
  const [channelId, setChannelId] = React.useState<string | null>(null)
  const needsChannel = resourceKinds.includes('project') || resourceKinds.includes('asset')
  const load: DeveloperCandidateLoader = loadCandidates ?? ((input) => listDeveloperAuthorizationCandidates(uid, input))
  const channelsQuery = useQuery({
    queryKey: ['developer', 'authorization', uid, 'candidates', 'channel-for-scope', null],
    queryFn: ({ signal }) => load({ kind: 'channel', signal }),
    enabled: needsChannel,
    staleTime: 30_000,
  })

  const toggle = (candidate: DeveloperResourceCandidate) => {
    const next = new Map(selected)
    const selector = toSelector(candidate)
    const key = keyOf(selector)
    if (next.has(key)) next.delete(key)
    else next.set(key, selector)
    setSelected(next)
    onChange([...next.values()])
  }
  const isSelected = (candidate: DeveloperResourceCandidate) => selected.has(keyOf(toSelector(candidate)))
  const channelScoped = resourceKinds.filter((kind) => kind === 'project' || kind === 'asset')

  return (
    <div className="space-y-3" data-testid="developer-resource-picker">
      <p className="text-sm font-medium text-foreground">{t('chooseItems')}</p>
      {resourceKinds.filter((kind) => kind === 'channel' || kind === 'template').map((kind) => (
        <CandidateGroup key={kind} uid={uid} kind={kind} channelId={null} disabled={disabled} isSelected={isSelected} onToggle={toggle} load={load} />
      ))}
      {channelScoped.length > 0 && (
        <>
          {channelsQuery.isLoading
            ? <Skeleton className="h-9 w-1/2 rounded-full" />
            : (
              <Pills
                label={t('chooseChannel')}
                items={channelsQuery.data?.items ?? []}
                selected={(candidate) => candidate.id === channelId}
                disabled={disabled}
                onToggle={(candidate) => setChannelId(candidate.id === channelId ? null : candidate.id)}
                pressedMode="single"
              />
            )}
          {channelId && channelScoped.map((kind) => (
            <CandidateGroup key={`${kind}:${channelId}`} uid={uid} kind={kind} channelId={channelId} disabled={disabled} isSelected={isSelected} onToggle={toggle} load={load} />
          ))}
        </>
      )}
    </div>
  )
}
