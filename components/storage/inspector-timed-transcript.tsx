'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Loader2, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
  DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
  getDiscoveryToolsCatalog,
} from '@/lib/discovery/api'
import { cn } from '@/lib/utils'
import { publicModelLabel } from '@/lib/public-model-display'
import { isAmbiguousMutationError, type ClientMutationAttempt } from '@/lib/idempotency/client-mutation-control'
import {
  createWorkflowActionIdempotencyKey,
  getMediaTranscriptTimedText,
  getWorkflowAgentStatus,
  launchWorkflowAgent,
  listMediaTranscriptArtifacts,
  mediaTranscriptsQueryKey,
} from '@/lib/workflows/api'
import {
  clearTranscriptLaunchAttempt,
  getOrCreateTranscriptLaunchAttempt,
  type TranscriptLaunchIntent,
} from '@/lib/workflows/transcript-launch-control'
import {
  findActiveCueIndex,
  formatCueClock,
  parseTimedTranscript,
} from '@/lib/workflows/transcript-cues'
import {
  blocksTranscriptMutation,
  isStaleTranscriptArtifact,
} from '@/lib/workflows/transcript-artifact-state'

const TERMINAL_AGENT_STATUSES = new Set([
  'completed',
  'success',
  'succeeded',
  'failed',
  'cancelled',
  'canceled',
])

export function InspectorTimedTranscript({
  channelId,
  sourceObjectId,
  sourceReady,
  currentTime,
  onSeek,
}: {
  channelId: string
  sourceObjectId: string
  sourceReady: boolean
  currentTime: number
  onSeek: (seconds: number) => void
}) {
  const t = useTranslations('Storage')
  const queryClient = useQueryClient()
  const listKey = mediaTranscriptsQueryKey(channelId, sourceObjectId)
  const [modelId, setModelId] = React.useState('')
  const [agentId, setAgentId] = React.useState<string | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const activeRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    setModelId('')
    setAgentId(null)
  }, [sourceObjectId])

  const catalogQuery = useQuery({
    queryKey: DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => getDiscoveryToolsCatalog({ signal }),
    staleTime: DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })
  const transcriptTool = catalogQuery.data?.tools.find((tool) => (
    tool.execution.node_type === 'transcript@1' || tool.tool_id === 'transcript'
  ))
  const models = React.useMemo(() => transcriptTool?.models ?? [], [transcriptTool])
  const defaultModelId = (
    typeof transcriptTool?.defaults.model_id === 'string' && transcriptTool.defaults.model_id.trim()
      ? transcriptTool.defaults.model_id.trim()
      : models[0]?.id ?? ''
  )

  const artifactsQuery = useQuery({
    queryKey: listKey,
    queryFn: ({ signal }) => listMediaTranscriptArtifacts({ channelId, sourceObjectId }, { signal }),
    refetchInterval: (query) => (
      query.state.data?.some((artifact) => blocksTranscriptMutation(artifact))
        ? 3_000
        : false
    ),
  })
  const artifact = (artifactsQuery.data ?? []).find((item) => item.status === 'ready' && item.downloadable)
    ?? (artifactsQuery.data ?? []).find((item) => item.status === 'processing' || item.status === 'deleting')
    ?? (artifactsQuery.data ?? []).find((item) => item.status === 'failed')
    ?? null
  const staleArtifact = (artifactsQuery.data ?? []).find((item) => isStaleTranscriptArtifact(item))
  const activeArtifactExists = (artifactsQuery.data ?? []).some((item) => blocksTranscriptMutation(item))

  React.useEffect(() => {
    setModelId((current) => {
      if (current) return current
      if (artifact?.model_id && models.some((model) => model.id === artifact.model_id)) {
        return artifact.model_id
      }
      return defaultModelId
    })
  }, [artifact?.model_id, defaultModelId, models])

  const timedQuery = useQuery({
    queryKey: [...listKey, 'timed', artifact?.id],
    queryFn: ({ signal }) => getMediaTranscriptTimedText({
      channelId,
      sourceObjectId,
      artifactId: artifact!.id,
    }, { signal }),
    enabled: artifact?.status === 'ready' && Boolean(artifact.downloadable),
    retry: false,
  })
  const cues = React.useMemo(
    () => (timedQuery.data ? parseTimedTranscript(timedQuery.data) : []),
    [timedQuery.data],
  )
  const activeIndex = findActiveCueIndex(cues, currentTime)
  const agentQuery = useQuery({
    queryKey: ['workflow-agent', 'status', agentId],
    queryFn: ({ signal }) => getWorkflowAgentStatus(agentId!, { signal }),
    enabled: Boolean(agentId),
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status?.toLowerCase() ?? ''
      if (TERMINAL_AGENT_STATUSES.has(status)) return false
      return 2_500
    },
  })

  React.useEffect(() => {
    if (!agentId) return
    void queryClient.invalidateQueries({ queryKey: listKey })
  }, [agentId, agentQuery.dataUpdatedAt, listKey, queryClient])

  React.useEffect(() => {
    const container = listRef.current
    const active = activeRef.current
    if (!container || !active || activeIndex < 0 || currentTime <= 0) return
    const containerRect = container.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const offset = activeRect.top - containerRect.top - (container.clientHeight / 2) + (activeRect.height / 2)
    container.scrollTo({ top: container.scrollTop + offset, behavior: 'smooth' })
  }, [activeIndex, currentTime])

  const launchMutation = useMutation({
    mutationFn: async (attempt: ClientMutationAttempt<TranscriptLaunchIntent>) => {
      const params: Record<string, string> = { storage_object_id: attempt.payload.sourceObjectId }
      if (attempt.payload.modelId) params.model_id = attempt.payload.modelId
      if (attempt.payload.replacementArtifactId) {
        params.replacement_artifact_id = attempt.payload.replacementArtifactId
      }
      return launchWorkflowAgent({
        projectId: attempt.payload.channelId,
        channelId: attempt.payload.channelId,
        nodeType: 'transcript@1',
        params,
        idempotencyKey: attempt.idempotencyKey,
      })
    },
    onSuccess: (result, attempt) => {
      clearTranscriptLaunchAttempt(attempt)
      setAgentId(result.agent_id)
      void queryClient.invalidateQueries({ queryKey: listKey })
    },
    onError: (error, attempt) => {
      if (!isAmbiguousMutationError(error)) clearTranscriptLaunchAttempt(attempt)
    },
  })

  const launchTranscript = () => {
    if (activeArtifactExists) return
    const payload = {
      channelId,
      sourceObjectId,
      modelId,
      replacementArtifactId: artifact?.status === 'ready' ? artifact.id : undefined,
    }
    launchMutation.mutate(getOrCreateTranscriptLaunchAttempt(
      payload,
      () => createWorkflowActionIdempotencyKey('inspector-transcript'),
    ))
  }

  const agentStatus = (agentQuery.data?.status ?? '').toLowerCase()
  const processing = Boolean(
    launchMutation.isPending
    || activeArtifactExists
    || (agentId && !TERMINAL_AGENT_STATUSES.has(agentStatus)),
  )
  const error = launchMutation.error
    ? t('inspector.transcript.failed')
    : artifact?.status === 'failed'
      ? t('inspector.transcript.failed')
      : timedQuery.isError
        ? t('inspector.transcript.failed')
        : null
  const hasTranscript = Boolean(artifact?.status === 'ready' && cues.length > 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#FAFAFA]">{t('inspector.tabs.transcript')}</p>
        <div className="flex min-w-0 items-center gap-2">
          {models.length > 0 ? (
            <label className="flex items-center">
              <span className="sr-only">{t('inspector.transcript.model')}</span>
              <select
                value={modelId || defaultModelId}
                disabled={!sourceReady || processing}
                onChange={(event) => setModelId(event.target.value)}
                className="h-8 max-w-[9.5rem] rounded-full border border-[#2A2A2A] bg-transparent px-2.5 text-[12px] text-[#E6E6E6] outline-none hover:bg-[#111315]"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id} className="bg-[#111315] text-[#FAFAFA]">
                    {publicModelLabel(model.label)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!sourceReady || processing}
            title={staleArtifact ? t('inspector.transcript.reclaim') : undefined}
            onClick={launchTranscript}
            className="h-8 rounded-full border-[#2A2A2A] bg-transparent text-[#E6E6E6] hover:bg-[#111315] hover:text-white"
          >
            {processing ? <Loader2 className="size-3.5 animate-spin" /> : artifact ? <RefreshCw className="size-3.5" /> : <FileText className="size-3.5" />}
            {processing
              ? t('inspector.transcript.working')
              : artifact
                ? t('inspector.transcript.retry')
                : t('inspector.transcript.create')}
          </Button>
        </div>
      </div>
      {!sourceReady ? (
        <p className="text-[13px] leading-5 text-[#8F8F8F]">{t('inspector.transcript.notReady')}</p>
      ) : error && !hasTranscript ? (
        <p className="text-[13px] leading-5 text-[#F87171]">{error}</p>
      ) : artifactsQuery.isLoading
        || (artifact?.status === 'ready' && timedQuery.isLoading)
        || (!hasTranscript && processing) ? (
        <div className="flex min-h-32 items-center justify-center text-[#8F8F8F]">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !hasTranscript ? (
        <p className="text-[13px] leading-5 text-[#8F8F8F]">{t('inspector.transcript.empty')}</p>
      ) : (
        <div ref={listRef} className="tools-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {cues.map((cue, index) => {
            const active = index === activeIndex
            return (
              <button
                key={`${cue.start}:${cue.end}:${index}`}
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => onSeek(cue.start)}
                className={cn(
                  'flex w-full gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-300',
                  active ? 'bg-white/12 text-[#FAFAFA]' : 'text-[#8F8F8F] hover:bg-white/6 hover:text-[#E6E6E6]',
                )}
              >
                <span className={cn(
                  'w-10 shrink-0 pt-0.5 font-mono text-[11px] tabular-nums',
                  active ? 'text-[#FAFAFA]' : 'text-[#6F6F6F]',
                )}>
                  {formatCueClock(cue.start)}
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-5">{cue.text}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
