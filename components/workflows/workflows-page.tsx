'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckCircle2,
  BarChart3,
  CalendarClock,
  CircleAlert,
  Compass,
  Copy,
  ExternalLink,
  History,
  Loader2,
  Mail,
  MessageSquareWarning,
  MoreHorizontal,
  Play,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AuthClientError, isAuthClientError } from '@/lib/auth/errors'
import type {
  WorkflowCanvasImageModel,
  WorkflowCanvasProps,
  WorkflowCanvasSnapshot,
} from '@/components/workflows/workflow-canvas'
import { WorkflowList, WorkflowListLoading } from '@/components/workflows/workflow-list'
import { workflows as initialWorkflows } from '@/lib/mock-data'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { WorkspaceChannelRequired } from '@/components/channel/workspace-channel-required'
import { getStoragePlaybackUrl } from '@/lib/storage/api'
import { ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY } from '@/lib/action-center/api'
import {
  ASSISTANT_COMPOSER_CATALOG_QUERY_KEY,
  getAssistantComposerCatalog,
} from '@/lib/assistant/api'
import { getReviewInboxEventsUrl } from '@/lib/review/api'
import {
  archiveWorkflowDefinition,
  buildWorkflowDefinitionPayload,
  cancelWorkflowRun,
  buildWorkflowRevisionPayload,
  createWorkflowActionIdempotencyKey,
  createWorkflowDefinition,
  createWorkflowRevision,
  estimateWorkflowRevision,
  executeWorkflowRevision,
  getWorkflow,
  getWorkflowStatus,
  getWorkflowWorkspaceBootstrap,
  getWorkflowDefinition,
  getWorkflowEditableRevision,
  getWorkflowOutput,
  getWorkflowPublishedRevision,
  listWorkflowDefinitionRuns,
  listWorkflowDefinitions,
  listWorkflowNodeCatalog,
  mapWorkflowDefinitionDetailToWorkflow,
  mapWorkflowDefinitionRecordToWorkflow,
  publishWorkflowRevision,
  resumeWorkflowRun,
  updateWorkflowDefinition,
  updateWorkflowRevision,
  workflowDefinitionsQueryKey,
  WORKFLOW_DEFINITIONS_QUERY_KEY,
  WORKFLOW_NODE_CATALOG_QUERY_KEY,
  type WorkflowDefinitionDetail,
  type WorkflowDefinitionRevision,
  type WorkflowNodeCatalogItem,
  type WorkflowOutputResult,
  type WorkflowRunProjection,
  type WorkflowRuntimeDetail,
  type WorkflowRuntimeStatus,
  type ViralClipsQuotaSnapshot,
} from '@/lib/workflows/api'
import { clearFlowDraftHandoff, readFlowDraftHandoff, saveFlowDraftHandoff } from '@/lib/workflows/flow-draft-handoff'
import { closeWorkTab, openWorkTab, replaceWorkTab } from '@/lib/work-tabs'
import { useAssistantDraftHandoff } from '@/components/workflows/use-assistant-draft-handoff'
import { getViralClipsLaunchConfirmationPlan } from '@/lib/workflows/viral-clips-launch-confirmation'
import { isWorkflowSettlementPending, retryWorkflowSettlementOutput, workflowSettlementRetryDelay } from '@/lib/workflows/output-query'
import {
  isAmbiguousMutationError,
  LatestValueRequestQueue,
} from '@/lib/idempotency/client-mutation-control'
import { InFlightRequestRegistry } from '@/lib/workflows/in-flight-request-registry'
import { withRunEventsSafetyPoll, type WorkflowRunEventMessage } from '@/lib/workflows/run-events'
import { useWorkflowRunEvents } from '@/lib/workflows/use-workflow-run-events'
import { isActiveRunStatus, isCancellableRunStatus, isCancellationLifecycleStatus, isFailedRunStatus, isQueuedRunStatus, isRunningRunStatus, isTerminalRunStatus, overlayCancelRequestedStatus } from '@/lib/workflows/run-status'
import { findEarlyNodeOutput, isEarlyOutputFinishing, type EarlyNodeOutput } from '@/lib/workflows/node-output-ready'
import { getWorkflowNodeProvider, getWorkflowNodeTitle } from '@/lib/workflows/node-display'
import { publicWorkflowByline } from '@/lib/public-model-display'
import { localizeWorkflowDisplayText } from '@/lib/workflows/display-i18n'
import {
  createWorkflowRunAttemptStore,
  getWorkflowRunAttemptFingerprint,
  getWorkflowRunAttemptScope,
} from '@/lib/workflows/run-attempt'
import { grantInstantVoiceCloneConsent } from '@/lib/voice/api'
import { catalogNodeTypeName } from '@/lib/workflows/flow-node-icons'
import { workflowHasYoutubePublishUpload } from '@/lib/workflows/flow-node-profiles'
import { getNextRunResultReuseSource } from '@/lib/workflows/result-reuse'
import {
  applyYoutubeUploadIntent,
  getYoutubeUploadIntentStorageObjectId,
} from '@/lib/workflows/youtube-upload-intent'
import { cn } from '@/lib/utils'
import type { Workflow, WorkflowProjectOption, WorkflowRunStatus } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

type WorkflowView = 'workflows' | 'explore' | 'usage' | 'scheduled'
type WorkflowTranslator = (key: string, values?: Record<string, string | number>) => string
type WorkflowFormatter = ReturnType<typeof useFormatter>
type WorkflowActionMessage = {
  tone: 'info' | 'success' | 'danger'
  text: string
}

type WorkflowRevisionConflict = {
  definitionId: string
  localWorkflow: Workflow
  serverWorkflow: Workflow
  expectedVersion?: number
  serverVersion?: number
}

type WorkflowQuotaLimitDialogState = {
  monthlyLimit: number | null
  quotaRemaining: number | null
}

type WorkflowRunHistoryPage = Awaited<ReturnType<typeof listWorkflowDefinitionRuns>>
type WorkflowRunLaunchOptions = {
  projectId?: string | null
  userInputs?: Record<string, unknown>
  /** PIPE-05: earlier run of the same workflow whose finished, unchanged steps are reused. */
  resultReuseSourceWorkflowId?: string | null
}

const WORKFLOW_DEFINITIONS_PAGE_SIZE = 100
const WORKFLOW_RUN_HISTORY_PAGE_SIZE = 5
const WORKFLOW_ACTIVE_STATUS_POLL_INTERVAL_MS = 5_000
const WORKFLOW_CANCELLING_STATUS_POLL_INTERVAL_MS = 1_500
const WORKFLOW_PAUSED_STATUS_POLL_INTERVAL_MS = 45_000
const WORKFLOW_BACKGROUND_ACTIVE_HISTORY_POLL_INTERVAL_MS = 30_000
const WORKFLOW_BACKGROUND_PAUSED_HISTORY_POLL_INTERVAL_MS = 60_000
const WORKFLOW_TERMINAL_DETAIL_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const
const REVIEW_INBOX_INVALIDATION_COALESCE_MS = 500
const DEFAULT_WORKFLOW_PROJECT_ID = 'default-project'
const WORKFLOW_MONTHLY_RUNS_QUOTA_KEY = 'workflow:monthly_runs'
const WORKFLOW_QUOTA_SUPPORT_EMAIL = 'limit@youtorch.io'
const WorkflowCanvas = dynamic<WorkflowCanvasProps>(
  () => import('@/components/workflows/workflow-canvas').then((mod) => mod.WorkflowCanvas),
  {
    ssr: false,
    loading: () => <WorkflowCanvasLoading />,
  },
)

export function WorkflowsPage() {
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const tErrors = useTranslations('Errors')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeParams = useParams<{ workflowId?: string | string[] }>()
  const routeWorkflowId = getWorkflowRouteParam(routeParams.workflowId)
  const queryClient = useQueryClient()
  const { activeChannel, activeChannelId, isLoading: channelLoading } = useActiveChannel()
  const [localDrafts, setLocalDrafts] = React.useState<Workflow[]>([])
  const [draftProjectIds, setDraftProjectIds] = React.useState<Record<string, string | null>>({})
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<Workflow | null>(null)
  const [workflowActionMessage, setWorkflowActionMessage] = React.useState<WorkflowActionMessage | null>(null)
  const [pendingWorkflowId, setPendingWorkflowId] = React.useState<string | null>(null)
  const [pendingRunWorkflowId, setPendingRunWorkflowId] = React.useState<string | null>(null)
  const [cancelRequestedWorkflowIds, setCancelRequestedWorkflowIds] = React.useState<string[]>([])
  const [selectedRunWorkflowId, setSelectedRunWorkflowId] = React.useState<string | null>(null)
  const [hiddenRunWorkflowIds, setHiddenRunWorkflowIds] = React.useState<string[]>([])
  const [pendingDraftExit, setPendingDraftExit] = React.useState<Workflow | null>(null)
  const [workflowQuotaDialog, setWorkflowQuotaDialog] = React.useState<WorkflowQuotaLimitDialogState | null>(null)
  const [saveSuccessSignal, setSaveSuccessSignal] = React.useState(0)
  const [canvasResetSignal, setCanvasResetSignal] = React.useState(0)
  const [preservedCanvasWorkflows, setPreservedCanvasWorkflows] = React.useState<Record<string, Workflow>>({})
  const [revisionConflict, setRevisionConflict] = React.useState<WorkflowRevisionConflict | null>(null)
  const activeView = routeWorkflowId ? 'workflows' : getWorkflowView(searchParams.get('view'))
  const workflowIdParam = routeWorkflowId ?? searchParams.get('workflowId')
  const draftId = searchParams.get('draftId') ?? (workflowIdParam && isLocalDraft(workflowIdParam) ? workflowIdParam : null)
  const continueWorkflowId = searchParams.get('continueWorkflowId')
  const youtubeUploadIntentStorageObjectId = getYoutubeUploadIntentStorageObjectId(
    searchParams.get('intent'),
    searchParams.get('storage_object_id'),
  )
  const handledContinueWorkflowIdRef = React.useRef<string | null>(null)
  const handledYoutubeUploadIntentRef = React.useRef<string | null>(null)
  const openingWorkflowIdRef = React.useRef<string | null>(null)
  const bootstrappedChannelIdsRef = React.useRef(new Set<string>())
  const selectedRuntimeWorkflowIdRef = React.useRef<string | null>(null)
  const inFlightWorkflowActionsRef = React.useRef(new InFlightRequestRegistry())
  const workflowRunAttemptStoreRef = React.useRef(createWorkflowRunAttemptStore())
  const workflowRenameQueueRef = React.useRef(new LatestValueRequestQueue<string, string>())
  const reviewInboxEventContextRef = React.useRef<{
    activeChannelId: string | null
    selectedWorkflowId: string | null
    selectedRunWorkflowId: string | null
  }>({
    activeChannelId: null,
    selectedWorkflowId: null,
    selectedRunWorkflowId: null,
  })
  const definitionListInput = React.useMemo(() => ({
    limit: WORKFLOW_DEFINITIONS_PAGE_SIZE,
    offset: 0,
  }), [])
  const runHistoryInput = React.useMemo(() => ({
    limit: WORKFLOW_RUN_HISTORY_PAGE_SIZE,
    offset: 0,
  }), [])
  const invalidateWorkflowDefinitionsList = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: workflowDefinitionsQueryKey(activeChannelId, definitionListInput),
    })
  }, [activeChannelId, definitionListInput, queryClient])
  const definitionsQuery = useQuery({
    queryKey: workflowDefinitionsQueryKey(activeChannelId, definitionListInput),
    queryFn: async ({ signal }) => {
      const channelId = activeChannelId!
      if (bootstrappedChannelIdsRef.current.has(channelId)) {
        return listWorkflowDefinitions(channelId, definitionListInput, { signal })
      }

      let bootstrap: Awaited<ReturnType<typeof getWorkflowWorkspaceBootstrap>>
      try {
        bootstrap = await getWorkflowWorkspaceBootstrap(channelId, { signal })
      } catch (error) {
        if (!(error instanceof AuthClientError) || error.status !== 404) throw error
        bootstrappedChannelIdsRef.current.add(channelId)
        return listWorkflowDefinitions(channelId, definitionListInput, { signal })
      }
      bootstrappedChannelIdsRef.current.add(channelId)
      if (bootstrap.composer_catalog) {
        queryClient.setQueryData(ASSISTANT_COMPOSER_CATALOG_QUERY_KEY, bootstrap.composer_catalog)
      }
      if (bootstrap.node_catalog) {
        queryClient.setQueryData(WORKFLOW_NODE_CATALOG_QUERY_KEY, bootstrap.node_catalog)
      }
      return { items: bootstrap.definitions, meta: bootstrap.definitions_meta }
    },
    enabled: activeView === 'workflows' && Boolean(activeChannelId),
    staleTime: 60_000,
  })
  const composerCatalogQuery = useQuery({
    queryKey: ASSISTANT_COMPOSER_CATALOG_QUERY_KEY,
    queryFn: getAssistantComposerCatalog,
    enabled: activeView === 'workflows' && Boolean(activeChannelId) && definitionsQuery.isSuccess,
    staleTime: 60_000,
  })
  const workflowNodeCatalogQuery = useQuery({
    queryKey: WORKFLOW_NODE_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => listWorkflowNodeCatalog({ signal }),
    enabled: activeView === 'workflows' && Boolean(activeChannelId) && definitionsQuery.isSuccess,
    staleTime: 60_000,
  })
  const selectedDefinitionQuery = useQuery({
    queryKey: workflowDefinitionDetailQueryKey(activeChannelId, selectedWorkflow?.id),
    queryFn: ({ signal }) => getWorkflowDefinition(activeChannelId!, selectedWorkflow!.id, { signal }),
    enabled: activeView === 'workflows'
      && Boolean(activeChannelId)
      && Boolean(selectedWorkflow)
      && !isLocalDraft(selectedWorkflow!.id),
    staleTime: 60_000,
  })
  const selectedRunHistoryQuery = useQuery({
    queryKey: workflowDefinitionRunsQueryKey(activeChannelId, selectedWorkflow?.id, runHistoryInput),
    queryFn: ({ signal }) => listWorkflowDefinitionRuns(
      activeChannelId!,
      selectedWorkflow!.id,
      runHistoryInput,
      { signal },
    ),
    enabled: activeView === 'workflows'
      && Boolean(activeChannelId)
      && Boolean(selectedWorkflow)
      && !isLocalDraft(selectedWorkflow!.id),
    staleTime: 30_000,
    refetchInterval: (query) => {
      if (activeView !== 'workflows' || !selectedWorkflow) return false
      const runs = query.state.data?.items ?? []
      return getBackgroundRunHistoryPollInterval(runs, selectedRuntimeWorkflowIdRef.current)
    },
  })
  const hiddenRunWorkflowIdSet = React.useMemo(() => new Set(hiddenRunWorkflowIds), [hiddenRunWorkflowIds])
  const selectedRunHistory = React.useMemo(() => {
    return sortWorkflowRunsNewestFirst(selectedRunHistoryQuery.data?.items ?? [])
      .filter((run) => !hiddenRunWorkflowIdSet.has(run.workflow_id))
  }, [hiddenRunWorkflowIdSet, selectedRunHistoryQuery.data?.items])
  React.useEffect(() => {
    for (const run of selectedRunHistoryQuery.data?.items ?? []) {
      if (run.idempotency_key) {
        workflowRunAttemptStoreRef.current.clearByIdempotencyKey(run.idempotency_key)
      }
    }
  }, [selectedRunHistoryQuery.data?.items])
  const selectedRun = React.useMemo(() => {
    if (selectedRunWorkflowId) {
      const matchingRun = selectedRunHistory.find((run) => run.workflow_id === selectedRunWorkflowId)
      if (matchingRun) return matchingRun
    }
    return selectedRunHistory[0] ?? null
  }, [selectedRunHistory, selectedRunWorkflowId])
  const runtimeWorkflowId = selectedRun?.workflow_id ?? null
  const runtimeProjectionStatus = selectedRun?.status
  React.useEffect(() => {
    selectedRuntimeWorkflowIdRef.current = runtimeWorkflowId
  }, [runtimeWorkflowId])
  const selectedRunRuntimeDetailQuery = useQuery({
    queryKey: workflowRuntimeDetailQueryKey(runtimeWorkflowId),
    queryFn: ({ signal }) => getWorkflow(runtimeWorkflowId!, { signal }),
    enabled: activeView === 'workflows' && Boolean(runtimeWorkflowId),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const selectedRunStatusPollable = activeView === 'workflows'
    && Boolean(runtimeWorkflowId)
    && shouldPollRunStatus(selectedRunRuntimeDetailQuery.data?.status ?? runtimeProjectionStatus)
  // LAT-03: a hint for the selected run refetches its status at once; the poll becomes a safety net.
  const handleSelectedRunEvent = React.useCallback((event: WorkflowRunEventMessage) => {
    if (event.workflowId !== selectedRuntimeWorkflowIdRef.current) return
    void queryClient.invalidateQueries({ queryKey: workflowRuntimeStatusQueryKey(event.workflowId), exact: true })
  }, [queryClient])
  const handleSelectedRunEventsReady = React.useCallback(() => {
    const workflowId = selectedRuntimeWorkflowIdRef.current
    if (workflowId) void queryClient.invalidateQueries({ queryKey: workflowRuntimeStatusQueryKey(workflowId), exact: true })
  }, [queryClient])
  const { connected: runEventsConnected } = useWorkflowRunEvents({
    enabled: selectedRunStatusPollable,
    onEvent: handleSelectedRunEvent,
    onReady: handleSelectedRunEventsReady,
  })
  const selectedRunRuntimeStatusQuery = useQuery({
    queryKey: workflowRuntimeStatusQueryKey(runtimeWorkflowId),
    queryFn: ({ signal }) => getWorkflowStatus(runtimeWorkflowId!, { signal }),
    enabled: selectedRunStatusPollable,
    retry: false,
    staleTime: 2_000,
    refetchInterval: (query) => withRunEventsSafetyPoll(getSelectedRunStatusPollInterval(
      query.state.data?.status ?? runtimeProjectionStatus,
    ), runEventsConnected && !query.state.error),
  })
  React.useEffect(() => {
    const status = selectedRunRuntimeStatusQuery.data
    const selectedDefinitionId = selectedWorkflow?.id
    if (
      !status
      || !runtimeWorkflowId
      || status.workflowId !== runtimeWorkflowId
      || !activeChannelId
      || !selectedDefinitionId
      || isLocalDraft(selectedDefinitionId)
    ) {
      return
    }

    queryClient.setQueryData<WorkflowRunHistoryPage>(
      workflowDefinitionRunsQueryKey(activeChannelId, selectedDefinitionId, runHistoryInput),
      (current) => patchWorkflowRunHistoryStatus(current, status),
    )
  }, [
    activeChannelId,
    queryClient,
    runHistoryInput,
    runtimeWorkflowId,
    selectedRunRuntimeStatusQuery.data,
    selectedWorkflow?.id,
  ])
  React.useEffect(() => {
    const confirmedIds = new Set<string>()
    for (const workflowId of cancelRequestedWorkflowIds) {
      const polledStatus = workflowId === runtimeWorkflowId
        ? selectedRunRuntimeStatusQuery.data?.status
        : undefined
      const historyStatus = selectedRunHistory.find((run) => run.workflow_id === workflowId)?.status
      const current = polledStatus ?? historyStatus
      if (isCancellationLifecycleStatus(current) || isTerminalRunStatus(current)) {
        confirmedIds.add(workflowId)
      }
    }
    if (confirmedIds.size === 0) return
    setCancelRequestedWorkflowIds((current) => current.filter((id) => !confirmedIds.has(id)))
  }, [
    cancelRequestedWorkflowIds,
    runtimeWorkflowId,
    selectedRunHistory,
    selectedRunRuntimeStatusQuery.data?.status,
  ])
  const terminalDetailRefreshKeyRef = React.useRef<string | null>(null)
  const terminalDetailRefreshInFlightKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const workflowId = runtimeWorkflowId
    const polledStatus = selectedRunRuntimeStatusQuery.data?.status
    if (!workflowId || !polledStatus || !isTerminalRunStatus(polledStatus)) {
      terminalDetailRefreshKeyRef.current = null
      terminalDetailRefreshInFlightKeyRef.current = null
      return
    }

    const refreshKey = `${workflowId}:${polledStatus.toLowerCase()}`
    if (
      terminalDetailRefreshKeyRef.current === refreshKey
      || terminalDetailRefreshInFlightKeyRef.current === refreshKey
    ) return

    terminalDetailRefreshInFlightKeyRef.current = refreshKey
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const refreshTerminalDetail = async (attempt: number) => {
      try {
        await queryClient.refetchQueries(
          { queryKey: workflowRuntimeDetailQueryKey(workflowId), exact: true },
          { throwOnError: true },
        )
        terminalDetailRefreshKeyRef.current = refreshKey
        terminalDetailRefreshInFlightKeyRef.current = null
      } catch {
        if (cancelled) return
        const retryDelay = WORKFLOW_TERMINAL_DETAIL_RETRY_DELAYS_MS[attempt]
        if (retryDelay === undefined) {
          terminalDetailRefreshInFlightKeyRef.current = null
          return
        }
        retryTimer = setTimeout(() => {
          retryTimer = null
          void refreshTerminalDetail(attempt + 1)
        }, retryDelay)
      }
    }

    void refreshTerminalDetail(0)
    if (activeChannelId && selectedWorkflow && !isLocalDraft(selectedWorkflow.id)) {
      void queryClient.invalidateQueries({
        queryKey: workflowDefinitionRunsQueryKey(activeChannelId, selectedWorkflow.id, runHistoryInput),
        exact: true,
      })
      invalidateWorkflowDefinitionsList()
    }

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (terminalDetailRefreshInFlightKeyRef.current === refreshKey) {
        terminalDetailRefreshInFlightKeyRef.current = null
      }
    }
  }, [
    activeChannelId,
    invalidateWorkflowDefinitionsList,
    queryClient,
    runHistoryInput,
    runtimeWorkflowId,
    selectedRunRuntimeStatusQuery.data?.status,
    selectedWorkflow?.id,
  ])
  const selectedRunRuntimeDetail = React.useMemo(() => {
    const merged = mergeWorkflowRuntimeStatus(
      selectedRunRuntimeDetailQuery.data ?? null,
      selectedRunRuntimeStatusQuery.data ?? null,
    )
    if (!merged) return merged
    if (
      cancelRequestedWorkflowIds.includes(merged.workflowId)
      && !isCancellationLifecycleStatus(merged.status)
      && !isTerminalRunStatus(merged.status)
    ) {
      return { ...merged, status: 'cancelling' }
    }
    return merged
  }, [
    cancelRequestedWorkflowIds,
    selectedRunRuntimeDetailQuery.data,
    selectedRunRuntimeStatusQuery.data,
  ])
  // PIPE-05: after a review gate asked for changes (edit, then Run) or after a failed run (Run = retry), the next
  // run of this workflow reuses that run's finished steps whose inputs did not change; only the rest runs and is charged.
  const nextRunReuseSourceRef = React.useRef<{ definitionId: string | null; workflowId: string } | null>(null)
  React.useEffect(() => {
    const workflowId = selectedRun
      ? getNextRunResultReuseSource({
        workflowId: selectedRun.workflow_id,
        status: selectedRunRuntimeDetail?.workflowId === selectedRun.workflow_id
          ? selectedRunRuntimeDetail.status
          : selectedRun.status,
        reviewStopAction: getReviewDecisionStopAction(
          selectedRunRuntimeDetail?.workflowId === selectedRun.workflow_id ? selectedRunRuntimeDetail : null,
          selectedRun.status,
          selectedRun.error_message,
        ),
      })
      : null
    nextRunReuseSourceRef.current = selectedRun && workflowId
      ? { definitionId: selectedRun.definition_id ?? null, workflowId }
      : null
  }, [selectedRun, selectedRunRuntimeDetail])
  const runRuntimeByWorkflowId = React.useMemo(() => {
    const map = new Map<string, WorkflowRuntimeDetail>()
    if (runtimeWorkflowId && selectedRunRuntimeDetail?.workflowId === runtimeWorkflowId) {
      map.set(runtimeWorkflowId, selectedRunRuntimeDetail)
    }
    return map
  }, [runtimeWorkflowId, selectedRunRuntimeDetail])
  const runOutputQueryInputs = React.useMemo(() => {
    if (!selectedRun) return []
    const runtime = runRuntimeByWorkflowId.get(selectedRun.workflow_id)
    return [{
      workflowId: selectedRun.workflow_id,
      // LAT-01: committed outputs are shown while the finance settlement is still closing.
      enabled: canReadWorkflowOutput(runtime?.status ?? selectedRun.status) || runtime?.outputReady === true,
    }]
  }, [runRuntimeByWorkflowId, selectedRun])
  const runOutputQueries = useQueries({
    queries: runOutputQueryInputs.map((run) => ({
      queryKey: workflowOutputQueryKey(run.workflowId),
      queryFn: ({ signal }: { signal?: AbortSignal }) => getWorkflowOutput(run.workflowId, { signal }),
      enabled: activeView === 'workflows' && run.enabled,
      retry: retryWorkflowSettlementOutput,
      retryDelay: workflowSettlementRetryDelay,
      staleTime: 30_000,
    })),
  })
  const runOutputByWorkflowId = React.useMemo(() => {
    const map = new Map<string, WorkflowOutputResult>()
    runOutputQueries.forEach((query, index) => {
      const workflowId = runOutputQueryInputs[index]?.workflowId
      if (workflowId && query.data?.workflowId === workflowId) {
        map.set(workflowId, query.data)
      }
    })
    return map
  }, [runOutputQueries, runOutputQueryInputs])
  const createDefinitionMutation = useMutation({
    mutationFn: (input: { channelId: string; workflow: Workflow; projectId?: string | null }) =>
      createWorkflowDefinition(input.channelId, buildWorkflowDefinitionPayload(input.workflow, {
        projectId: input.projectId,
      })),
  })
  const createRevisionMutation = useMutation({
    mutationFn: (input: { channelId: string; definitionId: string; workflow: Workflow; sourceRevisionId?: string | null }) =>
      createWorkflowRevision(
        input.channelId,
        input.definitionId,
        buildWorkflowRevisionPayload(input.workflow, {
          sourceRevisionId: input.sourceRevisionId,
          patchSource: 'ui',
        }),
      ),
  })
  const updateRevisionMutation = useMutation({
    mutationFn: (input: { channelId: string; definitionId: string; revisionId: string; workflow: Workflow; expectedVersion?: number }) =>
      updateWorkflowRevision(
        input.channelId,
        input.definitionId,
        input.revisionId,
        buildWorkflowRevisionPayload(input.workflow, { expectedVersion: input.expectedVersion }),
      ),
  })
  const estimateRevisionMutation = useMutation({
    mutationFn: (input: {
      channelId: string
      definitionId: string
      revisionId: string
      projectId?: string | null
      userInputs?: Record<string, unknown>
    }) =>
      estimateWorkflowRevision(input.channelId, input.definitionId, input.revisionId, {
        projectId: input.projectId,
        userInputs: input.userInputs ?? {},
      }),
  })
  const publishRevisionMutation = useMutation({
    mutationFn: (input: {
      channelId: string
      definitionId: string
      revisionId: string
      estimateId?: string | null
      userInputs?: Record<string, unknown>
    }) =>
      publishWorkflowRevision(input.channelId, input.definitionId, input.revisionId, {
        estimateId: input.estimateId,
        userInputs: input.userInputs ?? {},
      }),
  })
  const executeRevisionMutation = useMutation({
    mutationFn: (input: {
      channelId: string
      definitionId: string
      revisionId: string
      projectId: string
      estimateId: string
      idempotencyKey: string
      userInputs?: Record<string, unknown>
      expectedViralClipsQuota?: ViralClipsQuotaSnapshot
      resultReuseSourceWorkflowId?: string | null
    }) =>
      executeWorkflowRevision(input.channelId, input.definitionId, input.revisionId, {
        projectId: input.projectId,
        estimateId: input.estimateId,
        idempotencyKey: input.idempotencyKey,
        userInputs: input.userInputs ?? {},
        expectedViralClipsQuota: input.expectedViralClipsQuota,
        resultReuseSourceWorkflowId: input.resultReuseSourceWorkflowId,
      }),
  })
  const { mutateAsync: archiveDefinition } = useMutation({
    mutationFn: (input: { channelId: string; workflowId: string }) =>
      archiveWorkflowDefinition(input.channelId, input.workflowId),
  })
  const cancelRunMutation = useMutation({
    mutationFn: (workflowId: string) => cancelWorkflowRun(workflowId),
  })
  const resumeRunMutation = useMutation({
    mutationFn: (workflowId: string) => resumeWorkflowRun(workflowId),
  })
  const apiWorkflows = React.useMemo(() => {
    return (definitionsQuery.data?.items ?? []).map((definition) =>
      mapWorkflowDefinitionRecordToWorkflow(definition, {
        channelName: activeChannel?.name ?? activeChannelId,
        locale,
      })
    )
  }, [activeChannel?.name, activeChannelId, definitionsQuery.data?.items, locale])
  const localDraftsWithProjectIds = React.useMemo(
    () => localDrafts.map((workflow) => ({
      ...workflow,
      projectId: draftProjectIds[workflow.id] ?? workflow.projectId ?? null,
    })),
    [draftProjectIds, localDrafts],
  )
  const workflows = React.useMemo(
    () => mergeLocalDrafts(localDraftsWithProjectIds, apiWorkflows),
    [apiWorkflows, localDraftsWithProjectIds],
  )
  const selectedWorkflowWithDetail = React.useMemo(() => {
    if (!selectedWorkflow) return null
    const preservedWorkflow = preservedCanvasWorkflows[selectedWorkflow.id]
    if (preservedWorkflow) return preservedWorkflow
    if (isLocalDraft(selectedWorkflow.id)) return selectedWorkflow
    if (!selectedDefinitionQuery.data) return null
    return mapWorkflowDefinitionDetailToWorkflow(selectedDefinitionQuery.data, {
      channelName: activeChannel?.name ?? activeChannelId,
    })
  }, [activeChannel?.name, activeChannelId, preservedCanvasWorkflows, selectedDefinitionQuery.data, selectedWorkflow])
  // A saved Flow open at its own address is a tab of the shell, named after it (`lib/work-tabs.ts`).
  const openedFlow = activeView === 'workflows'
    && routeWorkflowId
    && !isLocalDraft(routeWorkflowId)
    && selectedWorkflowWithDetail?.id === routeWorkflowId
    ? selectedWorkflowWithDetail
    : null
  const openedFlowId = openedFlow?.id ?? null
  const openedFlowName = openedFlow?.name ?? ''
  React.useEffect(() => {
    if (openedFlowId) openWorkTab({ kind: 'flow', id: openedFlowId, title: openedFlowName })
  }, [openedFlowId, openedFlowName])
  const selectedWorkflowProjectId = React.useMemo(() => {
    if (!selectedWorkflow) return null
    if (!isLocalDraft(selectedWorkflow.id) && selectedDefinitionQuery.data) {
      return selectedDefinitionQuery.data.definition.project_id
    }
    return draftProjectIds[selectedWorkflow.id] ?? selectedWorkflow.projectId ?? null
  }, [draftProjectIds, selectedDefinitionQuery.data, selectedWorkflow])
  const projectOptions = React.useMemo(
    () => buildWorkflowProjectOptions(workflows, selectedWorkflowProjectId),
    [selectedWorkflowProjectId, workflows],
  )
  const savePending = createDefinitionMutation.isPending
    || createRevisionMutation.isPending
    || updateRevisionMutation.isPending
  const runPending = estimateRevisionMutation.isPending
    || publishRevisionMutation.isPending
    || executeRevisionMutation.isPending

  React.useEffect(() => {
    if (!workflowActionMessage || workflowActionMessage.tone === 'danger') return undefined
    const timeout = window.setTimeout(() => setWorkflowActionMessage(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [workflowActionMessage])

  React.useEffect(() => {
    if (activeView !== 'workflows') setSelectedWorkflow(null)
  }, [activeView])

  React.useEffect(() => {
    if (!workflowIdParam) return
    if (openingWorkflowIdRef.current === workflowIdParam) {
      openingWorkflowIdRef.current = null
    }
  }, [workflowIdParam])

  React.useEffect(() => {
    if (
      activeView !== 'workflows'
      || !activeChannelId
      || !youtubeUploadIntentStorageObjectId
      || handledYoutubeUploadIntentRef.current === youtubeUploadIntentStorageObjectId
    ) return
    handledYoutubeUploadIntentRef.current = youtubeUploadIntentStorageObjectId
    const baseDraft = createDraftWorkflow(
      activeChannel?.name ?? activeChannelId,
      tWorkflows('library.saveToAssetsTitle'),
    )
    const draft = applyYoutubeUploadIntent(baseDraft, youtubeUploadIntentStorageObjectId, {
      workflowName: tWorkflows('library.saveToAssetsTitle'),
      workflowDescription: tWorkflows('library.saveToAssetsDescription'),
      videoTitle: tWorkflows('library.videoTitle'),
      videoSubtitle: tWorkflows('library.videoSubtitle'),
      videoDescription: tWorkflows('library.videoDescription'),
      inputProvider: tWorkflows('library.inputProvider'),
      uploadTitle: tWorkflows('library.saveToAssetsTitle'),
      uploadSubtitle: tWorkflows('library.saveToAssetsSubtitle'),
      uploadDescription: tWorkflows('library.saveToAssetsDescription'),
    })
    saveFlowDraftHandoff(draft)
    setLocalDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)])
    openingWorkflowIdRef.current = draft.id
    setSelectedWorkflow(draft)
    router.replace(buildWorkflowDraftHref(draft.id))
  }, [
    activeChannel?.name,
    activeChannelId,
    activeView,
    router,
    tWorkflows,
    youtubeUploadIntentStorageObjectId,
  ])

  React.useEffect(() => {
    if (activeView !== 'workflows' || workflowIdParam || draftId || openingWorkflowIdRef.current || !selectedWorkflow) return
    setSelectedWorkflow(null)
  }, [activeView, draftId, selectedWorkflow, workflowIdParam])

  React.useEffect(() => {
    if (activeView !== 'workflows' || !workflowIdParam) return
    if (selectedWorkflow?.id === workflowIdParam) return
    const workflow = workflows.find((item) => item.id === workflowIdParam)
    if (workflow) setSelectedWorkflow(workflow)
  }, [activeView, selectedWorkflow?.id, workflowIdParam, workflows])

  React.useEffect(() => {
    if (activeView !== 'workflows' || !selectedWorkflow) {
      setSelectedRunWorkflowId(null)
      return
    }

    if (selectedRunWorkflowId && selectedRunHistory.some((run) => run.workflow_id === selectedRunWorkflowId)) {
      return
    }

    setSelectedRunWorkflowId(selectedRunHistory[0]?.workflow_id ?? null)
  }, [activeView, selectedRunHistory, selectedRunWorkflowId, selectedWorkflow])

  // P03-16: a Chat draft opened by its server refs (never from browser storage), as an unsaved local draft.
  useAssistantDraftHandoff({
    enabled: activeView === 'workflows',
    onLoaded: (draft) => {
      setLocalDrafts((current) => [draft, ...current.filter((workflow) => workflow.id !== draft.id)])
      setSelectedWorkflow(draft)
    },
    onUnavailable: () => {
      toast.error(tWorkflows('page.assistantDraftUnavailable'))
      router.replace('/workflows')
    },
  })

  React.useEffect(() => {
    if (activeView !== 'workflows' || !draftId) return
    const draft = readFlowDraftHandoff(draftId)
    if (!draft) {
      if (workflowIdParam && isLocalDraft(workflowIdParam)) {
        router.replace('/workflows')
      }
      return
    }
    setLocalDrafts((current) => {
      const withoutExisting = current.filter((workflow) => workflow.id !== draft.id)
      return [draft, ...withoutExisting]
    })
    const isFreshDraftOpen = openingWorkflowIdRef.current === draft.id
    if (workflowIdParam && isLocalDraft(workflowIdParam)) {
      router.replace(buildWorkflowDraftHref(draft.id))
    }
    if (isFreshDraftOpen) {
      openingWorkflowIdRef.current = null
    } else if (selectedWorkflow?.id !== draft.id) {
      toast.info(tWorkflows('page.recovered'))
    }
    setSelectedWorkflow(draft)
  }, [activeView, draftId, router, selectedWorkflow?.id, tWorkflows, workflowIdParam])

  React.useEffect(() => {
    if (activeView !== 'workflows' || !continueWorkflowId) return
    if (handledContinueWorkflowIdRef.current === continueWorkflowId) return
    handledContinueWorkflowIdRef.current = continueWorkflowId

    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.delete('continueWorkflowId')
    const suffix = nextSearchParams.toString()

    setPendingRunWorkflowId(continueWorkflowId)
    setWorkflowActionMessage({ tone: 'info', text: 'Resuming run...' })
    void resumeRunMutation.mutateAsync(continueWorkflowId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY })
        void queryClient.invalidateQueries({ queryKey: workflowRuntimeDetailQueryKey(continueWorkflowId) })
        void queryClient.invalidateQueries({ queryKey: workflowOutputQueryKey(continueWorkflowId) })
        setWorkflowActionMessage({ tone: 'success', text: 'Resume signal sent.' })
      })
      .catch((error) => {
        setWorkflowActionMessage({ tone: 'danger', text: getWorkflowActionErrorMessage(error) })
      })
      .finally(() => {
        setPendingRunWorkflowId(null)
        router.replace(`/workflows${suffix ? `?${suffix}` : ''}`)
      })
  }, [
    activeView,
    continueWorkflowId,
    queryClient,
    resumeRunMutation,
    router,
    searchParams,
  ])

  React.useEffect(() => {
    reviewInboxEventContextRef.current = {
      activeChannelId: activeChannelId ?? null,
      selectedWorkflowId: selectedWorkflow?.id ?? null,
      selectedRunWorkflowId: runtimeWorkflowId,
    }
  }, [activeChannelId, runtimeWorkflowId, selectedWorkflow?.id])

  React.useEffect(() => {
    if (activeView !== 'workflows' || typeof window.EventSource === 'undefined') return undefined

    const source = new EventSource(getReviewInboxEventsUrl(), { withCredentials: true })
    let invalidationTimer: number | null = null
    let dirtyWhileHidden = false

    const flushInvalidations = () => {
      invalidationTimer = null
      const {
        activeChannelId: currentChannelId,
        selectedWorkflowId,
        selectedRunWorkflowId,
      } = reviewInboxEventContextRef.current
      if (!currentChannelId) return

      void queryClient.invalidateQueries({
        queryKey: workflowDefinitionsQueryKey(currentChannelId, definitionListInput),
      })
      if (selectedWorkflowId && !isLocalDraft(selectedWorkflowId)) {
        void queryClient.invalidateQueries({
          queryKey: workflowDefinitionRunsQueryKey(currentChannelId, selectedWorkflowId),
        })
      }
      if (selectedRunWorkflowId) {
        void queryClient.invalidateQueries({
          queryKey: workflowRuntimeStatusQueryKey(selectedRunWorkflowId),
          exact: true,
        })
      }
    }
    const scheduleInvalidations = () => {
      if (document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        return
      }
      if (invalidationTimer !== null) return
      invalidationTimer = window.setTimeout(flushInvalidations, REVIEW_INBOX_INVALIDATION_COALESCE_MS)
    }
    const handleInboxEvent = (event: Event) => {
      if (!shouldRefreshWorkflowsForInboxEvent(event)) return
      scheduleInvalidations()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !dirtyWhileHidden) return
      dirtyWhileHidden = false
      scheduleInvalidations()
    }

    source.addEventListener('inbox', handleInboxEvent)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (invalidationTimer !== null) window.clearTimeout(invalidationTimer)
      source.removeEventListener('inbox', handleInboxEvent)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      source.close()
    }
  }, [activeView, definitionListInput, queryClient])

  const renameWorkflow = React.useCallback((workflowId: string, name: string) => {
    const nextName = name.trim()
    if (!nextName) return

    setSelectedWorkflow((current) =>
      current?.id === workflowId ? { ...current, name: nextName } : current
    )
    setPreservedCanvasWorkflows((current) => {
      const workflow = current[workflowId]
      if (!workflow) return current
      return {
        ...current,
        [workflowId]: { ...workflow, name: nextName },
      }
    })
    if (isLocalDraft(workflowId) || !activeChannelId) {
      setLocalDrafts((current) =>
        current.map((workflow) =>
          workflow.id === workflowId ? { ...workflow, name: nextName } : workflow
        )
      )
      return
    }

    const channelId = activeChannelId
    workflowRenameQueueRef.current.enqueue(
      workflowId,
      nextName,
      async (queuedName) => {
        try {
          await updateWorkflowDefinition(channelId, workflowId, { name: queuedName })
        } catch (renameError) {
          showWorkflowToast({ tone: 'danger', text: getWorkflowActionErrorMessage(renameError) })
        }
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: workflowDefinitionsQueryKey(channelId, definitionListInput),
          }),
          queryClient.invalidateQueries({
            queryKey: workflowDefinitionDetailQueryKey(channelId, workflowId),
          }),
        ])
      },
    )
  }, [activeChannelId, definitionListInput, queryClient])

  const mapDetailToWorkflow = React.useCallback((detail: WorkflowDefinitionDetail) =>
    mapWorkflowDefinitionDetailToWorkflow(detail, {
      channelName: activeChannel?.name ?? activeChannelId,
    }), [activeChannel?.name, activeChannelId])

  const refreshDefinitionDetail = React.useCallback(async (channelId: string, definitionId: string) => {
    const detail = await getWorkflowDefinition(channelId, definitionId)
    queryClient.setQueryData(workflowDefinitionDetailQueryKey(channelId, definitionId), detail)
    return detail
  }, [queryClient])

  const ensureWorkflowDefinitionDetail = React.useCallback(async (workflowId: string) => {
    if (!activeChannelId) throw new Error('Select a channel first.')
    if (selectedWorkflow?.id === workflowId && selectedDefinitionQuery.data) {
      return selectedDefinitionQuery.data
    }
    return queryClient.fetchQuery({
      queryKey: workflowDefinitionDetailQueryKey(activeChannelId, workflowId),
      queryFn: ({ signal }) => getWorkflowDefinition(activeChannelId, workflowId, { signal }),
      staleTime: 60_000,
    })
  }, [activeChannelId, queryClient, selectedDefinitionQuery.data, selectedWorkflow?.id])

  const persistWorkflowSnapshotOnce = React.useCallback(async (
    workflow: Workflow,
    options: { successMessage?: string | null } = {},
  ) => {
    if (options.successMessage !== null) {
      setWorkflowActionMessage(null)
    }

    if (!activeChannelId) {
      const error = new Error('Select a channel first.')
      showWorkflowToast({ tone: 'danger', text: error.message })
      throw error
    }

    try {
      if (isLocalDraft(workflow.id)) {
        const detail = await createDefinitionMutation.mutateAsync({
          channelId: activeChannelId,
          workflow,
          projectId: draftProjectIds[workflow.id] ?? workflow.projectId ?? DEFAULT_WORKFLOW_PROJECT_ID,
        })
        const mappedWorkflow = mapDetailToWorkflow(detail)
        const savedWorkflow = preserveWorkflowCanvasAfterPersistence(workflow, mappedWorkflow)

        setLocalDrafts((current) => current.filter((draft) => draft.id !== workflow.id))
        setDraftProjectIds((current) => {
          const next = { ...current }
          delete next[workflow.id]
          return next
        })
        clearFlowDraftHandoff(workflow.id)
        openingWorkflowIdRef.current = savedWorkflow.id
        setPreservedCanvasWorkflows((current) => ({
          ...current,
          [savedWorkflow.id]: savedWorkflow,
        }))
        setSelectedWorkflow(savedWorkflow)
        // Saved, the draft is an automation: its tab takes the new tab's spot (or opens), then the address is its own.
        replaceWorkTab({ kind: 'flow', id: savedWorkflow.id, title: savedWorkflow.name })
        replaceWorkflowUrlWithoutNavigation(buildWorkflowDetailHref(savedWorkflow.id))
        queryClient.setQueryData(workflowDefinitionDetailQueryKey(activeChannelId, detail.definition.id), detail)
        invalidateWorkflowDefinitionsList()
        setSaveSuccessSignal((current) => current + 1)
        if (options.successMessage !== null) {
          showWorkflowToast({ tone: 'success', text: options.successMessage ?? 'Saved.' })
        }
        return detail
      }

      const detail = await ensureWorkflowDefinitionDetail(workflow.id)
      const editableRevision = getWorkflowEditableRevision(detail)
      const sourceRevision = editableRevision?.status === 'published'
        ? editableRevision
        : getWorkflowPublishedRevision(detail)

      if (editableRevision?.status === 'draft') {
        try {
          await updateRevisionMutation.mutateAsync({
            channelId: activeChannelId,
            definitionId: detail.definition.id,
            revisionId: editableRevision.id,
            workflow,
            expectedVersion: editableRevision.version,
          })
        } catch (error) {
          if (isAuthClientError(error) && error.status === 409) {
            setPreservedCanvasWorkflows((current) => ({ ...current, [workflow.id]: workflow }))
            const currentDetail = await refreshDefinitionDetail(activeChannelId, detail.definition.id)
            const currentEditableRevision = getWorkflowEditableRevision(currentDetail)
            setRevisionConflict({
              definitionId: detail.definition.id,
              localWorkflow: workflow,
              serverWorkflow: mapDetailToWorkflow(currentDetail),
              expectedVersion: editableRevision.version,
              serverVersion: currentEditableRevision?.version,
            })
            throw error
          }
          if (!isNonDraftRevisionUpdateError(error)) throw error

          const currentDetail = await refreshDefinitionDetail(activeChannelId, detail.definition.id)
          const currentEditableRevision = getWorkflowEditableRevision(currentDetail)
          if (currentEditableRevision?.status === 'draft') {
            await updateRevisionMutation.mutateAsync({
              channelId: activeChannelId,
              definitionId: currentDetail.definition.id,
              revisionId: currentEditableRevision.id,
              workflow,
              expectedVersion: currentEditableRevision.version,
            })
          } else {
            const currentPublishedRevision = getWorkflowPublishedRevision(currentDetail)
            await createRevisionMutation.mutateAsync({
              channelId: activeChannelId,
              definitionId: currentDetail.definition.id,
              workflow,
              sourceRevisionId: currentPublishedRevision?.id ?? currentEditableRevision?.id ?? sourceRevision?.id ?? null,
            })
          }
        }
      } else {
        await createRevisionMutation.mutateAsync({
          channelId: activeChannelId,
          definitionId: detail.definition.id,
          workflow,
          sourceRevisionId: sourceRevision?.id ?? null,
        })
      }

      const refreshed = await refreshDefinitionDetail(activeChannelId, detail.definition.id)
      const mappedWorkflow = mapDetailToWorkflow(refreshed)
      const savedWorkflow = preserveWorkflowCanvasAfterPersistence(workflow, mappedWorkflow)
      setPreservedCanvasWorkflows((current) => ({
        ...current,
        [savedWorkflow.id]: savedWorkflow,
      }))
      setSelectedWorkflow(savedWorkflow)
      setRevisionConflict(null)
      invalidateWorkflowDefinitionsList()
      setSaveSuccessSignal((current) => current + 1)
      if (options.successMessage !== null) {
        showWorkflowToast({ tone: 'success', text: options.successMessage ?? 'Saved.' })
      }
      return refreshed
    } catch (error) {
      if (options.successMessage !== null) {
        showWorkflowToast({ tone: 'danger', text: getWorkflowActionErrorMessage(error) })
      }
      throw error
    }
  }, [
    activeChannelId,
    createDefinitionMutation,
    createRevisionMutation,
    draftProjectIds,
    ensureWorkflowDefinitionDetail,
    invalidateWorkflowDefinitionsList,
    mapDetailToWorkflow,
    queryClient,
    refreshDefinitionDetail,
    router,
    updateRevisionMutation,
  ])

  const persistWorkflowSnapshot = React.useCallback((
    workflow: Workflow,
    options: { successMessage?: string | null } = {},
  ) => inFlightWorkflowActionsRef.current.run(
    `persist:${workflow.id}`,
    () => persistWorkflowSnapshotOnce(workflow, options),
  ), [persistWorkflowSnapshotOnce])

  const saveWorkflowSnapshot = React.useCallback((workflow: Workflow) => {
    void persistWorkflowSnapshot(workflow).catch(() => undefined)
  }, [persistWorkflowSnapshot])

  const runPersistedWorkflowDetailOnce = React.useCallback(async (
    detail: WorkflowDefinitionDetail,
    options: WorkflowRunLaunchOptions = {},
  ) => {
    if (!activeChannelId) throw new Error('Select a channel before running this workflow.')

    const revision = getWorkflowEditableRevision(detail)
    if (!revision) throw new Error('No runnable workflow revision was found.')
    const projectId = (options.projectId !== undefined ? options.projectId : detail.definition.project_id)
      ?? DEFAULT_WORKFLOW_PROJECT_ID
    const userInputs = options.userInputs ?? {}
    const attemptScope = getWorkflowRunAttemptScope(activeChannelId, detail.definition.id)
    const attemptFingerprint = getWorkflowRunAttemptFingerprint({
      dslHash: revision.dsl_hash,
      projectId,
      userInputs,
    })
    let attempt = workflowRunAttemptStoreRef.current.find(attemptScope, attemptFingerprint)
    if (attempt && (
      attempt.payload.channelId !== activeChannelId
      || attempt.payload.definitionId !== detail.definition.id
      || attempt.payload.projectId !== projectId
    )) {
      workflowRunAttemptStoreRef.current.clear(attemptScope, attempt.idempotencyKey)
      attempt = null
    }

    if (!attempt) {
      const estimate = await estimateRevisionMutation.mutateAsync({
        channelId: activeChannelId,
        definitionId: detail.definition.id,
        revisionId: revision.id,
        projectId,
        userInputs,
      })
      const viralClipsQuota = estimate.viral_clips_quota
      if (workflowRevisionContainsViralClips(revision) && !viralClipsQuota) {
        throw new Error(tWorkflows('runs.viralClipsQuotaUnavailable'))
      }
      const confirmationPlan = getViralClipsLaunchConfirmationPlan(
        viralClipsQuota,
        estimate.total_estimated_credits,
      )
      if (confirmationPlan && !window.confirm(tWorkflows(
        confirmationPlan.messageKey,
        confirmationPlan.values,
      ))) {
        return null
      }

      let executableRevisionId = revision.id
      if (revision.status === 'draft') {
        const published = await publishRevisionMutation.mutateAsync({
          channelId: activeChannelId,
          definitionId: detail.definition.id,
          revisionId: revision.id,
          estimateId: estimate.id,
          userInputs,
        })
        executableRevisionId = published.id
        const refreshed = await refreshDefinitionDetail(activeChannelId, detail.definition.id)
        const mappedWorkflow = mapDetailToWorkflow(refreshed)
        setPreservedCanvasWorkflows((current) => {
          const preservedWorkflow = current[detail.definition.id]
          if (!preservedWorkflow) return current
          return {
            ...current,
            [detail.definition.id]: preserveWorkflowCanvasAfterPersistence(preservedWorkflow, mappedWorkflow),
          }
        })
        setSelectedWorkflow((current) =>
          current?.id === detail.definition.id
            ? preserveWorkflowCanvasAfterPersistence(current, mappedWorkflow)
            : current
        )
        invalidateWorkflowDefinitionsList()
      }

      attempt = workflowRunAttemptStoreRef.current.save({
        scope: attemptScope,
        fingerprint: attemptFingerprint,
        idempotencyKey: createWorkflowActionIdempotencyKey('workflow-run'),
        payload: {
          channelId: activeChannelId,
          definitionId: detail.definition.id,
          sourceRevisionId: revision.id,
          executableRevisionId,
          estimateId: estimate.id,
          projectId,
          expectedViralClipsQuota: viralClipsQuota,
        },
      })
    }

    let run: WorkflowRunProjection
    try {
      run = await executeRevisionMutation.mutateAsync({
        channelId: activeChannelId,
        definitionId: detail.definition.id,
        revisionId: attempt.payload.executableRevisionId,
        projectId,
        estimateId: attempt.payload.estimateId,
        idempotencyKey: attempt.idempotencyKey,
        userInputs,
        expectedViralClipsQuota: attempt.payload.expectedViralClipsQuota,
        resultReuseSourceWorkflowId: options.resultReuseSourceWorkflowId ?? null,
      })
      workflowRunAttemptStoreRef.current.clear(attemptScope, attempt.idempotencyKey)
    } catch (executeError) {
      if (!isAmbiguousMutationError(executeError)) {
        workflowRunAttemptStoreRef.current.clear(attemptScope, attempt.idempotencyKey)
      } else {
        void queryClient.invalidateQueries({
          queryKey: workflowDefinitionRunsQueryKey(activeChannelId, detail.definition.id),
        })
      }
      throw executeError
    }

    setSelectedRunWorkflowId(run.workflow_id)
    queryClient.setQueryData<Awaited<ReturnType<typeof listWorkflowDefinitionRuns>>>(
      workflowDefinitionRunsQueryKey(activeChannelId, detail.definition.id, {
        limit: WORKFLOW_RUN_HISTORY_PAGE_SIZE,
        offset: 0,
      }),
      (current) => {
        const existingItems = current?.items ?? []
        const items = sortWorkflowRunsNewestFirst([
          run,
          ...existingItems.filter((item) => item.workflow_id !== run.workflow_id),
        ]).slice(0, WORKFLOW_RUN_HISTORY_PAGE_SIZE)
        return {
          items,
          meta: current?.meta ?? {
            total: items.length,
            limit: WORKFLOW_RUN_HISTORY_PAGE_SIZE,
            offset: 0,
            hasMore: false,
          },
        }
      },
    )
    void queryClient.invalidateQueries({
      queryKey: workflowDefinitionRunsQueryKey(activeChannelId, detail.definition.id),
    })
    invalidateWorkflowDefinitionsList()
    void queryClient.invalidateQueries({ queryKey: workflowRuntimeDetailQueryKey(run.workflow_id) })
    void queryClient.invalidateQueries({ queryKey: workflowOutputQueryKey(run.workflow_id) })
    return run
  }, [
    activeChannelId,
    estimateRevisionMutation,
    executeRevisionMutation,
    invalidateWorkflowDefinitionsList,
    mapDetailToWorkflow,
    publishRevisionMutation,
    queryClient,
    refreshDefinitionDetail,
    tWorkflows,
  ])

  const runPersistedWorkflowDetail = React.useCallback((
    detail: WorkflowDefinitionDetail,
    options: WorkflowRunLaunchOptions = {},
  ) => inFlightWorkflowActionsRef.current.run(
    `run:${detail.definition.id}`,
    () => runPersistedWorkflowDetailOnce(detail, options),
  ), [runPersistedWorkflowDetailOnce])

  const refreshWorkflowRuns = React.useCallback((definitionId: string | null | undefined) => {
    if (!activeChannelId || !definitionId) return
    void queryClient.invalidateQueries({
      queryKey: workflowDefinitionRunsQueryKey(activeChannelId, definitionId),
    })
    invalidateWorkflowDefinitionsList()
  }, [activeChannelId, invalidateWorkflowDefinitionsList, queryClient])

  const refreshRunDetail = React.useCallback((workflowId: string) => {
    void queryClient.invalidateQueries({ queryKey: workflowRuntimeDetailQueryKey(workflowId) })
    void queryClient.invalidateQueries({ queryKey: workflowRuntimeStatusQueryKey(workflowId) })
    void queryClient.invalidateQueries({ queryKey: workflowOutputQueryKey(workflowId) })
  }, [queryClient])

  const cancelRun = React.useCallback((run: WorkflowRunProjection) => {
    const actionKey = `lifecycle:${run.workflow_id}`
    if (inFlightWorkflowActionsRef.current.has(actionKey)) return
    void inFlightWorkflowActionsRef.current.run(actionKey, async () => {
      setPendingRunWorkflowId(run.workflow_id)
      setCancelRequestedWorkflowIds((current) => (
        current.includes(run.workflow_id) ? current : [...current, run.workflow_id]
      ))
      queryClient.setQueryData<WorkflowRuntimeStatus>(
        workflowRuntimeStatusQueryKey(run.workflow_id),
        (current) => current && current.workflowId === run.workflow_id
          ? { ...current, status: 'cancelling', cancelMode: current.cancelMode ?? 'user_drain' }
          : current,
      )
      queryClient.setQueryData<WorkflowRuntimeDetail>(
        workflowRuntimeDetailQueryKey(run.workflow_id),
        (current) => current && current.workflowId === run.workflow_id
          ? { ...current, status: 'cancelling', cancelMode: current.cancelMode ?? 'user_drain' }
          : current,
      )
      if (activeChannelId && run.definition_id) {
        queryClient.setQueryData<WorkflowRunHistoryPage>(
          workflowDefinitionRunsQueryKey(activeChannelId, run.definition_id, runHistoryInput),
          (current) => current
            ? {
              ...current,
              items: current.items.map((item) => (
                item.workflow_id === run.workflow_id ? { ...item, status: 'cancelling' } : item
              )),
            }
            : current,
        )
      }
      const receivedMessage: WorkflowActionMessage = {
        tone: 'info',
        text: tWorkflows('runs.cancelReceived'),
      }
      setWorkflowActionMessage(receivedMessage)
      showWorkflowToast(receivedMessage)
      try {
        const cancellation = await cancelRunMutation.mutateAsync(run.workflow_id)
        refreshWorkflowRuns(run.definition_id)
        refreshRunDetail(run.workflow_id)
        if (!cancellation.accepted && ['completed', 'failed'].includes(cancellation.current_status ?? '')) {
          setCancelRequestedWorkflowIds((current) => current.filter((id) => id !== run.workflow_id))
          queryClient.setQueryData<WorkflowRuntimeStatus>(
            workflowRuntimeStatusQueryKey(run.workflow_id),
            (current) => current ? { ...current, status: cancellation.current_status! } : current,
          )
          queryClient.setQueryData<WorkflowRuntimeDetail>(
            workflowRuntimeDetailQueryKey(run.workflow_id),
            (current) => current ? { ...current, status: cancellation.current_status! } : current,
          )
          const noopMessage: WorkflowActionMessage = {
            tone: 'info',
            text: tWorkflows('runs.cancelAlreadyTerminal'),
          }
          setWorkflowActionMessage(noopMessage)
          showWorkflowToast(noopMessage)
          return
        }
        if (!cancellation.accepted) {
          setCancelRequestedWorkflowIds((current) => current.filter((id) => id !== run.workflow_id))
          const failureMessage: WorkflowActionMessage = {
            tone: 'danger',
            text: cancellation.message ?? tWorkflows('runs.cancelUnconfirmed'),
          }
          setWorkflowActionMessage(failureMessage)
          showWorkflowToast(failureMessage)
          return
        }
        const acceptedStatus = cancellation.current_status?.trim() || (cancellation.cancelled ? 'cancelled' : 'cancelling')
        queryClient.setQueryData<WorkflowRuntimeStatus>(
          workflowRuntimeStatusQueryKey(run.workflow_id),
          (current) => current && current.workflowId === run.workflow_id
            ? { ...current, status: acceptedStatus, cancelMode: current.cancelMode ?? 'user_drain' }
            : current,
        )
        const acceptedMessage: WorkflowActionMessage = {
          tone: 'success',
          text: cancellation.cancelled
            ? tWorkflows('runs.cancelSettled')
            : tWorkflows('runs.cancelProviderDrain'),
        }
        setWorkflowActionMessage(acceptedMessage)
        showWorkflowToast(acceptedMessage)
      } catch (error) {
        setCancelRequestedWorkflowIds((current) => current.filter((id) => id !== run.workflow_id))
        refreshWorkflowRuns(run.definition_id)
        refreshRunDetail(run.workflow_id)
        const failureMessage: WorkflowActionMessage = {
          tone: 'danger',
          text: getWorkflowActionErrorMessage(error, tWorkflows),
        }
        setWorkflowActionMessage(failureMessage)
        showWorkflowToast(failureMessage)
      } finally {
        setPendingRunWorkflowId((current) => current === run.workflow_id ? null : current)
      }
    })
  }, [activeChannelId, cancelRunMutation, queryClient, refreshRunDetail, refreshWorkflowRuns, runHistoryInput, tWorkflows])

  const resumeRun = React.useCallback((run: WorkflowRunProjection) => {
    const actionKey = `lifecycle:${run.workflow_id}`
    if (inFlightWorkflowActionsRef.current.has(actionKey)) return
    void inFlightWorkflowActionsRef.current.run(actionKey, async () => {
      setPendingRunWorkflowId(run.workflow_id)
      setWorkflowActionMessage({ tone: 'info', text: 'Sending resume signal...' })
      try {
        await resumeRunMutation.mutateAsync(run.workflow_id)
        refreshWorkflowRuns(run.definition_id)
        refreshRunDetail(run.workflow_id)
        setWorkflowActionMessage({ tone: 'success', text: 'Run resumed.' })
      } catch (error) {
        setWorkflowActionMessage({ tone: 'danger', text: getWorkflowActionErrorMessage(error) })
      } finally {
        setPendingRunWorkflowId((current) => current === run.workflow_id ? null : current)
      }
    })
  }, [refreshRunDetail, refreshWorkflowRuns, resumeRunMutation])

  const hideRunFromHistory = React.useCallback((run: WorkflowRunProjection) => {
    setHiddenRunWorkflowIds((current) =>
      current.includes(run.workflow_id) ? current : [...current, run.workflow_id]
    )
    setSelectedRunWorkflowId((current) => current === run.workflow_id ? null : current)
    setWorkflowActionMessage({ tone: 'success', text: 'Run history item removed.' })
  }, [])

  const discardLocalDraft = React.useCallback((workflowId: string) => {
    setLocalDrafts((current) => current.filter((draft) => draft.id !== workflowId))
    setDraftProjectIds((current) => {
      const next = { ...current }
      delete next[workflowId]
      return next
    })
    clearFlowDraftHandoff(workflowId)
  }, [])

  const openWorkflow = React.useCallback((workflow: Workflow) => {
    if (isLocalDraft(workflow.id)) {
      saveFlowDraftHandoff(workflow)
    } else {
      setPreservedCanvasWorkflows((current) => {
        if (!current[workflow.id]) return current
        const next = { ...current }
        delete next[workflow.id]
        return next
      })
    }
    openingWorkflowIdRef.current = workflow.id
    setSelectedWorkflow(workflow)
    router.push(buildWorkflowHref(workflow))
  }, [router])

  const closeWorkflow = React.useCallback((workflowSnapshot?: Workflow) => {
    const workflow = workflowSnapshot ?? selectedWorkflow
    if (workflow && isLocalDraft(workflow.id)) {
      if (isPristineLocalDraft(workflow)) {
        discardLocalDraft(workflow.id)
        openingWorkflowIdRef.current = null
        setSelectedWorkflow(null)
        router.push('/workflows')
        return
      }

      saveFlowDraftHandoff(workflow)
      setLocalDrafts((current) => {
        const withoutExisting = current.filter((draft) => draft.id !== workflow.id)
        return [workflow, ...withoutExisting]
      })
      setSelectedWorkflow(workflow)
      setPendingDraftExit(workflow)
      return
    }

    openingWorkflowIdRef.current = null
    setSelectedWorkflow(null)
    router.push('/workflows')
  }, [discardLocalDraft, router, selectedWorkflow])

  const keepEditingDraft = React.useCallback(() => {
    setPendingDraftExit(null)
  }, [])

  const discardPendingDraft = React.useCallback(() => {
    if (!pendingDraftExit) return
    discardLocalDraft(pendingDraftExit.id)
    setPendingDraftExit(null)
    openingWorkflowIdRef.current = null
    setSelectedWorkflow(null)
    router.push('/workflows')
  }, [discardLocalDraft, pendingDraftExit, router])

  const savePendingDraft = React.useCallback(() => {
    if (!pendingDraftExit) return
    void persistWorkflowSnapshot(pendingDraftExit, { successMessage: 'Draft saved.' })
      .then(() => setPendingDraftExit(null))
      .catch(() => undefined)
  }, [pendingDraftExit, persistWorkflowSnapshot])

  const openNewWorkflow = React.useCallback(() => {
    const draft = createDraftWorkflow(
      activeChannel?.name ?? activeChannelId ?? undefined,
      tWorkflows('canvas.untitledWorkflow'),
    )

    setLocalDrafts((current) => [draft, ...current])
    openWorkflow(draft)
  }, [activeChannel?.name, activeChannelId, openWorkflow, setLocalDrafts, tWorkflows])

  // `?new=1` (the new tab's "Yeni otomasyon"): a new Flow draft once the channel is known. The entry leaves the
  // history, so going back lands on the list instead of making another draft.
  const newWorkflowRequested = activeView === 'workflows' && !routeWorkflowId && searchParams.get('new') === '1'
  const handledNewWorkflowRef = React.useRef(false)
  React.useEffect(() => {
    if (!newWorkflowRequested) {
      handledNewWorkflowRef.current = false
      return
    }
    if (handledNewWorkflowRef.current || channelLoading || !activeChannelId) return
    handledNewWorkflowRef.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete('new')
    replaceWorkflowUrlWithoutNavigation(`${url.pathname}${url.search}`)
    openNewWorkflow()
  }, [activeChannelId, channelLoading, newWorkflowRequested, openNewWorkflow])

  const openWorkflowQuotaDialog = React.useCallback((error: unknown) => {
    const dialog = getWorkflowQuotaLimitDialogState(error)
    if (!dialog) return false
    setWorkflowQuotaDialog(dialog)
    return true
  }, [setWorkflowQuotaDialog])

  const showContractDriftAction = React.useCallback((error: unknown, workflow: Workflow) => {
    if (!isAuthClientError(error) || error.code !== 'WORKFLOW_NODE_CONTRACT_DRIFT') return false
    toast.error(tWorkflows('runs.contractDrift'), {
      duration: Infinity,
      action: {
        label: tWorkflows('runs.updateWorkflow'),
        onClick: () => {
          void queryClient.invalidateQueries({ queryKey: WORKFLOW_NODE_CATALOG_QUERY_KEY })
          openWorkflow(workflow)
        },
      },
    })
    return true
  }, [openWorkflow, queryClient, tWorkflows])

  const runWorkflowSnapshot = React.useCallback(async (workflow: Workflow) => {
    if (!activeChannelId) {
      showWorkflowToast({ tone: 'danger', text: 'Select a channel before running this workflow.' })
      return null
    }
    if (workflowHasYoutubePublishUpload(workflow.nodes) && activeChannel?.status !== 'connected') {
      showWorkflowToast({ tone: 'danger', text: tErrors('channelNotConnected') })
      return null
    }

    try {
      const runnable = await prepareWorkflowVoiceCloneConsents(workflow, activeChannelId, tWorkflows)
      const detail = await persistWorkflowSnapshot(runnable, { successMessage: null })
      const reuseSource = nextRunReuseSourceRef.current
      const run = await runPersistedWorkflowDetail(detail, {
        projectId: workflow.projectId ?? DEFAULT_WORKFLOW_PROJECT_ID,
        userInputs: buildWorkflowUserInputs(workflow),
        resultReuseSourceWorkflowId: reuseSource?.definitionId === detail.definition.id ? reuseSource.workflowId : null,
      })
      return run
    } catch (error) {
      if (showContractDriftAction(error, workflow)) return null
      if (openWorkflowQuotaDialog(error)) return null
      showWorkflowToast({ tone: 'danger', text: getWorkflowRunQueueErrorMessage(error, tErrors, tWorkflows) })
      return null
    }
  }, [
    activeChannel?.status,
    activeChannelId,
    openWorkflowQuotaDialog,
    showContractDriftAction,
    persistWorkflowSnapshot,
    runPersistedWorkflowDetail,
    tErrors,
    tWorkflows,
  ])

  const runWorkflowFromList = React.useCallback((workflow: Workflow) => {
    void (async () => {
      if (!activeChannelId) {
        showWorkflowToast({ tone: 'danger', text: 'Select a channel before running this workflow.' })
        return
      }
      if (workflowHasYoutubePublishUpload(workflow.nodes) && activeChannel?.status !== 'connected') {
        showWorkflowToast({ tone: 'danger', text: tErrors('channelNotConnected') })
        return
      }
      if (isLocalDraft(workflow.id)) {
        openWorkflow(workflow)
        showWorkflowToast({ tone: 'info', text: 'Save the draft before running it.' })
        return
      }

      setPendingWorkflowId(workflow.id)
      try {
        const detail = await ensureWorkflowDefinitionDetail(workflow.id)
        const mapped = mapDetailToWorkflow(detail)
        const runnableWorkflow = await prepareWorkflowVoiceCloneConsents(mapped, activeChannelId, tWorkflows)
        const persisted = await persistWorkflowSnapshot(runnableWorkflow, { successMessage: null })
        await runPersistedWorkflowDetail(persisted, {
          projectId: runnableWorkflow.projectId ?? DEFAULT_WORKFLOW_PROJECT_ID,
          userInputs: buildWorkflowUserInputs(runnableWorkflow),
        })
      } catch (error) {
        if (showContractDriftAction(error, workflow)) return
        if (openWorkflowQuotaDialog(error)) return
        showWorkflowToast({ tone: 'danger', text: getWorkflowRunQueueErrorMessage(error, tErrors, tWorkflows) })
      } finally {
        setPendingWorkflowId(null)
      }
    })()
  }, [activeChannel?.status, activeChannelId, ensureWorkflowDefinitionDetail, mapDetailToWorkflow, openWorkflow, openWorkflowQuotaDialog, showContractDriftAction, persistWorkflowSnapshot, runPersistedWorkflowDetail, tErrors, tWorkflows])

  const archiveWorkflow = React.useCallback((workflow: Workflow) => {
    void (async () => {
      if (isLocalDraft(workflow.id)) {
        setLocalDrafts((current) => current.filter((draft) => draft.id !== workflow.id))
        setDraftProjectIds((current) => {
          const next = { ...current }
          delete next[workflow.id]
          return next
        })
        clearFlowDraftHandoff(workflow.id)
        setSelectedWorkflow((current) => current?.id === workflow.id ? null : current)
        setWorkflowActionMessage({ tone: 'success', text: 'Draft removed.' })
        return
      }
      if (!activeChannelId) {
        setWorkflowActionMessage({ tone: 'danger', text: 'Select a channel first.' })
        return
      }

      const actionKey = `archive:${workflow.id}`
      if (inFlightWorkflowActionsRef.current.has(actionKey)) return

      await inFlightWorkflowActionsRef.current.run(actionKey, async () => {
        setPendingWorkflowId(workflow.id)
        setWorkflowActionMessage({ tone: 'info', text: 'Archiving workflow...' })
        try {
          await archiveDefinition({ channelId: activeChannelId, workflowId: workflow.id })
          closeWorkTab('flow', workflow.id)
          setSelectedWorkflow((current) => current?.id === workflow.id ? null : current)
          invalidateWorkflowDefinitionsList()
          void queryClient.invalidateQueries({ queryKey: workflowDefinitionDetailQueryKey(activeChannelId, workflow.id) })
          setWorkflowActionMessage({ tone: 'success', text: 'Workflow archived.' })
        } catch (error) {
          setWorkflowActionMessage({ tone: 'danger', text: getWorkflowActionErrorMessage(error) })
        } finally {
          setPendingWorkflowId((current) => current === workflow.id ? null : current)
        }
      })
    })()
  }, [
    activeChannelId,
    archiveDefinition,
    invalidateWorkflowDefinitionsList,
    queryClient,
    setDraftProjectIds,
    setLocalDrafts,
    setPendingWorkflowId,
    setSelectedWorkflow,
    setWorkflowActionMessage,
  ])

  if (channelLoading && activeView === 'workflows' && selectedWorkflow) {
    return (
      <div className="relative h-full">
        <WorkflowEditorLoading
          workflowName={selectedWorkflow.name}
          errorMessage={null}
          onBack={closeWorkflow}
        />
      </div>
    )
  }

  if (!channelLoading && !activeChannelId) {
    return <WorkspaceChannelRequired />
  }

  // An open Flow fills the page panel under the top bar, where it is a tab (`lib/work-tabs.ts`).
  if (activeView === 'workflows' && selectedWorkflowWithDetail) {
    return (
      <div className="relative h-full">
        {runOutputQueries.some((query) => isWorkflowSettlementPending(query.failureReason ?? query.error)) ? (
          <div role="status" className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-muted-foreground">
            <span>{tWorkflows('runs.outputSettlementPending')}</span>
            <Button variant="ghost" size="sm" disabled={runOutputQueries.some((query) => query.isFetching)} onClick={() => {
              runOutputQueries.forEach((query) => {
                if (isWorkflowSettlementPending(query.error)) void query.refetch()
              })
            }}>{tWorkflows('runs.retryOutput')}</Button>
          </div>
        ) : null}
        <WorkflowEditor
          key={`${selectedWorkflowWithDetail.id}:${canvasResetSignal}`}
          workflow={selectedWorkflowWithDetail}
          onBack={closeWorkflow}
          onRename={(name) => renameWorkflow(selectedWorkflowWithDetail.id, name)}
          onSave={saveWorkflowSnapshot}
          onRun={runWorkflowSnapshot}
          runHistory={selectedRunHistory}
          runHistoryLoading={selectedRunHistoryQuery.isLoading}
          runHistoryError={selectedRunHistoryQuery.error instanceof Error ? selectedRunHistoryQuery.error.message : null}
          selectedRunWorkflowId={selectedRun?.workflow_id ?? null}
          onSelectRun={(run) => setSelectedRunWorkflowId(run.workflow_id)}
          runRuntimeByWorkflowId={runRuntimeByWorkflowId}
          selectedRunRuntimeDetail={selectedRunRuntimeDetail}
          selectedRunRuntimeLoading={selectedRunRuntimeDetailQuery.isLoading}
          selectedRunRuntimeError={selectedRunRuntimeDetailQuery.error instanceof Error
            ? selectedRunRuntimeDetailQuery.error.message
            : null}
          runOutputByWorkflowId={runOutputByWorkflowId}
          pendingRunWorkflowId={pendingRunWorkflowId}
          cancelRequestedWorkflowIds={cancelRequestedWorkflowIds}
          onCancelRun={cancelRun}
          onResumeRun={resumeRun}
          onHideRun={hideRunFromHistory}
          savePending={savePending}
          saveSuccessSignal={saveSuccessSignal}
          runPending={runPending}
          runDisabled={!activeChannelId || selectedWorkflowWithDetail.status === 'archived'}
          imageModels={composerCatalogQuery.data?.image_models ?? []}
          chatModels={composerCatalogQuery.data?.chat_models ?? []}
          nodeCatalog={workflowNodeCatalogQuery.data?.nodes ?? []}
        />
        {revisionConflict?.definitionId === selectedWorkflowWithDetail.id ? (
          <WorkflowRevisionConflictBanner
            conflict={revisionConflict}
            onKeepLocal={() => setRevisionConflict(null)}
            onLoadServer={() => {
              setPreservedCanvasWorkflows((current) => {
                const next = { ...current }
                delete next[revisionConflict.definitionId]
                return next
              })
              setSelectedWorkflow(revisionConflict.serverWorkflow)
              setCanvasResetSignal((current) => current + 1)
              setRevisionConflict(null)
            }}
          />
        ) : null}
        <UnsavedDraftExitDialog
          open={Boolean(pendingDraftExit)}
          savePending={savePending}
          onSave={savePendingDraft}
          onDiscard={discardPendingDraft}
          onKeepEditing={keepEditingDraft}
        />
        <WorkflowActionToast actionMessage={workflowActionMessage} />
        <WorkflowQuotaLimitDialog
          state={workflowQuotaDialog}
          onOpenChange={(open) => {
            if (!open) setWorkflowQuotaDialog(null)
          }}
          onContactSupport={() => {
            const href = buildWorkflowQuotaSupportMailto(workflowQuotaDialog)
            setWorkflowQuotaDialog(null)
            window.location.href = href
          }}
          onViewPlans={() => {
            setWorkflowQuotaDialog(null)
            router.push('/offer-plan?next=/workflows')
          }}
        />
      </div>
    )
  }

  if (activeView === 'workflows' && selectedWorkflow) {
    return (
      <div className="relative h-full">
        <WorkflowEditorLoading
          workflowName={selectedWorkflow.name}
          errorMessage={
            selectedDefinitionQuery.error instanceof Error
              ? selectedDefinitionQuery.error.message
              : !activeChannelId
                ? tAuto('select_a_channel_first_ab71fe9a')
                : null
          }
          onBack={closeWorkflow}
        />
      </div>
    )
  }

  if (
    activeView === 'workflows'
    && workflows.length === 0
    && (channelLoading || definitionsQuery.isLoading)
  ) {
    return <WorkflowListLoading />
  }

  return activeView === 'workflows' ? (
    <>
      <WorkflowList
        workflows={workflows}
        projectOptions={projectOptions}
        errorMessage={definitionsQuery.error instanceof Error ? definitionsQuery.error.message : null}
        emptyMessage={activeChannelId ? tAuto('no_workflows_saved_for_this_channel_ab205c6d') : tAuto('select_a_channel_first_ab71fe9a')}
        onCreateWorkflow={openNewWorkflow}
        onOpenWorkflow={openWorkflow}
        onRunWorkflow={runWorkflowFromList}
        onArchiveWorkflow={archiveWorkflow}
        isWorkflowActionPending={(workflow) => workflow.id === pendingWorkflowId}
      />
      <WorkflowActionToast actionMessage={workflowActionMessage} />
      <WorkflowQuotaLimitDialog
        state={workflowQuotaDialog}
        onOpenChange={(open) => {
          if (!open) setWorkflowQuotaDialog(null)
        }}
        onContactSupport={() => {
          const href = buildWorkflowQuotaSupportMailto(workflowQuotaDialog)
          setWorkflowQuotaDialog(null)
          window.location.href = href
        }}
        onViewPlans={() => {
          setWorkflowQuotaDialog(null)
          router.push('/offer-plan?next=/workflows')
        }}
      />
    </>
  ) : (
    <WorkflowSubpage view={activeView} workflows={workflows} />
  )
}

function getWorkflowView(view: string | null): WorkflowView {
  if (view === 'explore' || view === 'usage' || view === 'scheduled') return view
  return 'workflows'
}

function getWorkflowRouteParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value
  const workflowId = rawValue?.trim()
  return workflowId || null
}

function buildWorkflowDetailHref(workflowId: string) {
  return `/workflows/${encodeURIComponent(workflowId)}`
}

function replaceWorkflowUrlWithoutNavigation(href: string) {
  if (typeof window === 'undefined') return
  window.history.replaceState(window.history.state, '', href)
}

function buildWorkflowDraftHref(workflowId: string) {
  return `/workflows?draftId=${encodeURIComponent(workflowId)}`
}

function buildWorkflowHref(workflow: Workflow) {
  return isLocalDraft(workflow.id)
    ? buildWorkflowDraftHref(workflow.id)
    : buildWorkflowDetailHref(workflow.id)
}

function WorkflowSubpage({ view, workflows }: { view: Exclude<WorkflowView, 'workflows'>; workflows: Workflow[] }) {
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows')
  if (view === 'usage') {
    const runCount = workflows.reduce((total, workflow) => total + workflow.runCount24h, 0)
    const activeCount = workflows.filter((workflow) => workflow.status === 'active').length
    const averageSuccess = workflows.length
      ? Math.round(workflows.reduce((total, workflow) => total + workflow.successRate, 0) / workflows.length)
      : 0

    return (
      <div className="theme-page-surface mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
        <PageHeader
          breadcrumbs={[
            { label: tWorkflows('page.automation') },
            { label: tWorkflows('page.usage'), icon: BarChart3 },
          ]}
          icon={BarChart3}
          title={tAuto('usage_0bb18642')}
          badge={tWorkflows('page.runCount', { count: runCount })}
          description={tAuto('workflow_activity_and_cost_signals_7524eaa8')}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <MetricTile label={tAuto('24s_run_57192433')} value={String(runCount)} />
          <MetricTile label={tAuto('active_workflows_b85656cf')} value={String(activeCount)} />
          <MetricTile label={tAuto('average_success_d31cb928')} value={`${averageSuccess}%`} />
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-border">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="grid gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_120px_120px]">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{localizeWorkflowDisplayText(workflow.name, tWorkflows)}</div>
                <div className="truncate text-xs text-muted-foreground">{workflow.channel}</div>
              </div>
              <div className="text-muted-foreground">{tWorkflows('page.runCount', { count: workflow.runCount24h })}</div>
              <div className="text-muted-foreground">{workflow.averageCost}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (view === 'scheduled') {
    const scheduledWorkflows = workflows.filter((workflow) => workflow.triggerType === 'schedule' || workflow.nextRunAt !== 'Draft')

    return (
      <div className="theme-page-surface mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
        <PageHeader
          breadcrumbs={[
            { label: tWorkflows('page.automation') },
            { label: tWorkflows('page.scheduled'), icon: CalendarClock },
          ]}
          icon={CalendarClock}
          title={tAuto('scheduled_1cd1bdad')}
          badge={tWorkflows('page.plannedCount', { count: scheduledWorkflows.length })}
          description={tAuto('upcoming_channel_workflow_runs_9d5b7ef9')}
        />

        <div className="overflow-hidden rounded-md border border-border">
          {scheduledWorkflows.map((workflow) => (
            <div key={workflow.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{localizeWorkflowDisplayText(workflow.name, tWorkflows)}</div>
                <div className="truncate text-xs text-muted-foreground">{localizeWorkflowDisplayText(workflow.schedule, tWorkflows)}</div>
              </div>
              <div className="text-sm text-muted-foreground">{localizeWorkflowDisplayText(workflow.nextRunAt, tWorkflows)}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const templates = [
    { name: tWorkflows('page.shortsFactory'), channel: 'Youtorch Labs', detail: tWorkflows('page.nodeCount', { count: 7 }) },
    { name: tWorkflows('page.weeklyRadar'), channel: 'Youtorch Labs', detail: tWorkflows('page.nodeCount', { count: 4 }) },
    { name: tWorkflows('page.commentEscalation'), channel: tWorkflows('page.founderNotes'), detail: tWorkflows('page.nodeCount', { count: 3 }) },
  ]

  return (
    <div className="theme-page-surface mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        breadcrumbs={[
          { label: tWorkflows('page.automation') },
          { label: tWorkflows('page.explore'), icon: Compass },
        ]}
        icon={Compass}
        title={tAuto('explore_b965ae66')}
        badge={tWorkflows('page.templateCount', { count: templates.length })}
        description={tAuto('starter_workflows_for_channel_operations_1bff10ff')}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {templates.map((template) => (
          <div key={template.name} className="rounded-md border border-border bg-card p-4">
            <div className="text-sm font-medium text-foreground">{template.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{template.channel}</div>
            <div className="mt-4 text-xs text-muted-foreground">{template.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  )
}

function WorkflowEditor({
  workflow,
  onBack,
  onRename,
  onSave,
  onRun,
  runHistory,
  runHistoryLoading,
  runHistoryError,
  selectedRunWorkflowId,
  onSelectRun,
  runRuntimeByWorkflowId,
  selectedRunRuntimeDetail,
  selectedRunRuntimeLoading,
  selectedRunRuntimeError,
  runOutputByWorkflowId,
  pendingRunWorkflowId,
  cancelRequestedWorkflowIds,
  onCancelRun,
  onResumeRun,
  onHideRun,
  savePending,
  saveSuccessSignal,
  runPending,
  runDisabled,
  imageModels,
  chatModels,
  nodeCatalog,
}: {
  workflow: Workflow
  onBack: (workflow?: WorkflowCanvasSnapshot) => void
  onRename: (name: string) => void
  onSave: (workflow: Workflow) => void
  onRun: (workflow: Workflow) => Promise<WorkflowRunProjection | null>
  runHistory: WorkflowRunProjection[]
  runHistoryLoading: boolean
  runHistoryError: string | null
  selectedRunWorkflowId: string | null
  onSelectRun: (run: WorkflowRunProjection) => void
  runRuntimeByWorkflowId: ReadonlyMap<string, WorkflowRuntimeDetail>
  selectedRunRuntimeDetail: WorkflowRuntimeDetail | null
  selectedRunRuntimeLoading: boolean
  selectedRunRuntimeError: string | null
  runOutputByWorkflowId: ReadonlyMap<string, WorkflowOutputResult>
  pendingRunWorkflowId: string | null
  cancelRequestedWorkflowIds: string[]
  onCancelRun: (run: WorkflowRunProjection) => void
  onResumeRun: (run: WorkflowRunProjection) => void
  onHideRun: (run: WorkflowRunProjection) => void
  savePending: boolean
  saveSuccessSignal: number
  runPending: boolean
  runDisabled: boolean
  imageModels: WorkflowCanvasImageModel[]
  chatModels: WorkflowCanvasImageModel[]
  nodeCatalog: WorkflowNodeCatalogItem[]
}) {
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const [runHistoryOpen, setRunHistoryOpen] = React.useState(false)
  const [runHistoryPinned, setRunHistoryPinned] = React.useState(false)
  const [launchRequestPending, setLaunchRequestPending] = React.useState(false)
  const [pendingSubmittedRunId, setPendingSubmittedRunId] = React.useState<string | null>(null)
  const runHistoryVisible = runHistoryOpen
  const localRunPending = runPending || launchRequestPending || Boolean(pendingSubmittedRunId)
  const pendingSubmittedRunVisible = Boolean(pendingSubmittedRunId && !runHistory.some((run) => run.workflow_id === pendingSubmittedRunId))
  const runHistoryLaunchPending = launchRequestPending || pendingSubmittedRunVisible
  const cancelRequestedWorkflowIdSet = React.useMemo(
    () => new Set(cancelRequestedWorkflowIds),
    [cancelRequestedWorkflowIds],
  )
  const selectedRunCancelStatus = overlayCancelRequestedStatus(
    selectedRunRuntimeDetail?.status
      ?? runHistory.find((run) => run.workflow_id === selectedRunWorkflowId)?.status,
    Boolean(selectedRunWorkflowId && cancelRequestedWorkflowIdSet.has(selectedRunWorkflowId)),
  )
  const showCancelBanner = Boolean(
    selectedRunWorkflowId
    && (
      cancelRequestedWorkflowIdSet.has(selectedRunWorkflowId)
      || isCancellationLifecycleStatus(selectedRunCancelStatus)
    )
    && !isTerminalRunStatus(selectedRunCancelStatus),
  )
  const cancelBannerDetail = selectedRunCancelStatus?.toLowerCase() === 'settlement_pending'
    ? tWorkflows('runs.settling')
    : selectedRunCancelStatus?.toLowerCase() === 'draining'
      ? tWorkflows('runs.draining')
      : tWorkflows('runs.cancelProviderDrain')
  const runHistoryBadgeCount = React.useMemo(() => {
    const activeRuns = runHistory.filter((run) => {
      const runtimeStatus = runRuntimeByWorkflowId.get(run.workflow_id)?.status
      return isActiveRunStatus(runtimeStatus ?? run.status)
    }).length
    return activeRuns + (runHistoryLaunchPending ? 1 : 0)
  }, [runHistory, runHistoryLaunchPending, runRuntimeByWorkflowId])
  const hasInFlightRun = runHistoryBadgeCount > 0 || localRunPending
  const dismissedInFlightHistoryRef = React.useRef(false)

  React.useEffect(() => {
    if (hasInFlightRun) {
      if (!dismissedInFlightHistoryRef.current) setRunHistoryOpen(true)
      return
    }
    dismissedInFlightHistoryRef.current = false
    if (!runHistoryPinned) setRunHistoryOpen(false)
  }, [hasInFlightRun, runHistoryPinned])
  const nodeRunState = React.useMemo(
    () => createWorkflowNodeRunState(workflow, selectedRunRuntimeDetail),
    [selectedRunRuntimeDetail, workflow],
  )

  React.useEffect(() => {
    if (!pendingSubmittedRunId) return
    if (!runHistory.some((run) => run.workflow_id === pendingSubmittedRunId)) return
    const timeout = window.setTimeout(() => setPendingSubmittedRunId(null), 0)
    return () => window.clearTimeout(timeout)
  }, [pendingSubmittedRunId, runHistory])

  const handleRun = React.useCallback((nextWorkflow: Workflow) => {
    void (async () => {
      if (localRunPending) return
      dismissedInFlightHistoryRef.current = false
      setRunHistoryOpen(true)
      setLaunchRequestPending(true)
      try {
        const run = await onRun(nextWorkflow)
        if (run?.workflow_id) {
          setPendingSubmittedRunId(run.workflow_id)
        }
      } finally {
        setLaunchRequestPending(false)
      }
    })()
  }, [localRunPending, onRun])

  return (
    <div className="workflow-flow-surface absolute inset-0 z-10 overflow-hidden">
      <WorkflowCanvas
        workflow={workflow}
        locale={locale}
        onBack={onBack}
        onRename={onRename}
        onSave={(snapshot: WorkflowCanvasSnapshot) => onSave(snapshot)}
        onRun={handleRun}
        runtimeNodeStatuses={nodeRunState.statuses}
        runtimeActiveNodeId={nodeRunState.activeNodeId}
        savePending={savePending}
        saveLabel={tWorkflows('canvas.save')}
        saveSuccessSignal={saveSuccessSignal}
        runPending={localRunPending || savePending}
        runDisabled={runDisabled}
        imageModels={imageModels}
        chatModels={chatModels}
        nodeCatalog={nodeCatalog}
        runOutput={selectedRunWorkflowId ? runOutputByWorkflowId.get(selectedRunWorkflowId) ?? null : null}
        toolbarAccessory={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              'relative h-9 w-9 cursor-pointer rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground',
              runHistoryVisible && 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary',
            )}
            onClick={() => {
              setRunHistoryOpen((current) => {
                const next = !current
                setRunHistoryPinned(next)
                dismissedInFlightHistoryRef.current = !next && hasInFlightRun
                return next
              })
            }}
            aria-label={tAuto('run_history_476489cf')}
            aria-pressed={runHistoryVisible}
            title={tAuto('run_history_476489cf')}
          >
            {runHistoryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
            {runHistoryBadgeCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                {runHistoryBadgeCount > 9 ? '9+' : runHistoryBadgeCount}
              </span>
            )}
          </Button>
        }
      />
      {showCancelBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-20 z-[66] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-warning/40 bg-background/95 px-3 py-2 text-center text-sm text-foreground shadow-lg backdrop-blur"
        >
          <div className="font-medium">{tWorkflows('runs.cancelReceived')}</div>
          <div className="text-muted-foreground">{cancelBannerDetail}</div>
        </div>
      ) : null}
      {runHistoryVisible && (
        <WorkflowRunHistoryPanel
          workflowName={localizeWorkflowDisplayText(workflow.name, tWorkflows)}
          runs={runHistory}
          loading={runHistoryLoading}
          errorMessage={runHistoryError}
          launchPending={runHistoryLaunchPending}
          selectedRunWorkflowId={selectedRunWorkflowId}
          onSelectRun={onSelectRun}
          runRuntimeByWorkflowId={runRuntimeByWorkflowId}
          selectedRunRuntimeDetail={selectedRunRuntimeDetail}
          selectedRunRuntimeLoading={selectedRunRuntimeLoading}
          selectedRunRuntimeError={selectedRunRuntimeError}
          runOutputByWorkflowId={runOutputByWorkflowId}
          pendingRunWorkflowId={pendingRunWorkflowId}
          cancelRequestedWorkflowIds={cancelRequestedWorkflowIds}
          onCancelRun={onCancelRun}
          onResumeRun={onResumeRun}
          onHideRun={onHideRun}
          onClose={() => {
            setRunHistoryPinned(false)
            setRunHistoryOpen(false)
          }}
        />
      )}
    </div>
  )
}

function UnsavedDraftExitDialog({
  open,
  savePending,
  onSave,
  onDiscard,
  onKeepEditing,
}: {
  open: boolean
  savePending: boolean
  onSave: () => void
  onDiscard: () => void
  onKeepEditing: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !savePending) onKeepEditing()
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle><UiText id="save_this_draft_fd3f380d" /></DialogTitle>
          <DialogDescription>
            <UiText id="this_workflow_is_only_saved_locally_save_it_as_a_36f7083c" /></DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onDiscard}
            disabled={savePending}
          >
            <UiText id="discard_36fff63c" /></Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onKeepEditing}
              disabled={savePending}
            >
              <UiText id="keep_editing_d4d9e382" /></Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={savePending}
            >
              {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <UiText id="save_efc007a3" /></Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WorkflowRevisionConflictBanner({
  conflict,
  onKeepLocal,
  onLoadServer,
}: {
  conflict: WorkflowRevisionConflict
  onKeepLocal: () => void
  onLoadServer: () => void
}) {
  const t = useTranslations('Workflows.errors')
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-2xl border border-amber-400/40 bg-background/95 p-4 shadow-2xl backdrop-blur sm:bottom-5 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">{t('revisionConflictTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('revisionConflictDescription')}</p>
          <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground">
            {t('revisionConflictComparison', {
              localNodes: conflict.localWorkflow.nodes.length,
              serverNodes: conflict.serverWorkflow.nodes.length,
              expectedVersion: conflict.expectedVersion ?? '?',
              serverVersion: conflict.serverVersion ?? '?',
            })}
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onLoadServer}>
              {t('loadServerCopy')}
            </Button>
            <Button type="button" size="sm" onClick={onKeepLocal}>
              {t('keepLocalDraft')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function WorkflowActionToast({ actionMessage }: { actionMessage: WorkflowActionMessage | null }) {
  if (!actionMessage) return null

  return (
    <div className={cn(
      'pointer-events-none fixed bottom-4 right-4 z-[60] max-w-[min(360px,calc(100vw-2rem))] rounded-md border bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur',
      actionMessage.tone === 'success' && 'border-success/40 text-success',
      actionMessage.tone === 'danger' && 'border-destructive/45 text-destructive',
      actionMessage.tone === 'info' && 'border-border text-foreground',
    )}>
      {actionMessage.text}
    </div>
  )
}

function WorkflowQuotaLimitDialog({
  state,
  onOpenChange,
  onContactSupport,
  onViewPlans,
}: {
  state: WorkflowQuotaLimitDialogState | null
  onOpenChange: (open: boolean) => void
  onContactSupport: () => void
  onViewPlans: () => void
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const monthlyLimitLabel = state?.monthlyLimit != null
    ? formatWorkflowRunCount(state.monthlyLimit, tWorkflows)
    : tWorkflows('runs.planLimit')
  const remainingLabel = formatWorkflowRunCount(state?.quotaRemaining ?? 0, tWorkflows)

  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-md border-white/20 bg-background/78 p-0 shadow-[0_28px_90px_rgba(15,23,42,0.28)] ring-1 ring-white/12 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:max-w-[440px]">
        <DialogHeader className="border-b border-white/12 bg-white/8 px-5 py-4 pr-12">
          <div className="flex items-start gap-3">
            <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-[#C2410C]" />
            <div className="min-w-0">
              <DialogTitle className="text-base leading-6"><UiText id="monthly_workflow_limit_reached_0f875d0e" /></DialogTitle>
              <DialogDescription className="mt-1 leading-5">
                {tWorkflows('runs.quotaSummary', { remaining: remainingLabel, limit: monthlyLimitLabel })}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="px-5 py-4">
          <p className="text-sm leading-5 text-muted-foreground">
            <UiText id="contact_us_to_increase_this_limit_or_upgrade_you_bff902d6" /></p>
        </div>
        <DialogFooter className="border-t border-white/12 bg-white/6 px-5 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={onViewPlans}>
            <ExternalLink className="h-4 w-4" />
            <UiText id="upgrade_plan_e80fe7c8" /></Button>
          <Button type="button" onClick={onContactSupport}>
            <Mail className="h-4 w-4" />
            <UiText id="contact_b37456c4" /></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WorkflowRunHistoryPanel({
  workflowName,
  runs,
  loading,
  errorMessage,
  launchPending,
  selectedRunWorkflowId,
  onSelectRun,
  runRuntimeByWorkflowId,
  selectedRunRuntimeDetail,
  selectedRunRuntimeLoading,
  selectedRunRuntimeError,
  runOutputByWorkflowId,
  pendingRunWorkflowId,
  cancelRequestedWorkflowIds,
  onCancelRun,
  onResumeRun,
  onHideRun,
  onClose,
}: {
  workflowName: string
  runs: WorkflowRunProjection[]
  loading: boolean
  errorMessage: string | null
  launchPending: boolean
  selectedRunWorkflowId: string | null
  onSelectRun: (run: WorkflowRunProjection) => void
  runRuntimeByWorkflowId: ReadonlyMap<string, WorkflowRuntimeDetail>
  selectedRunRuntimeDetail: WorkflowRuntimeDetail | null
  selectedRunRuntimeLoading: boolean
  selectedRunRuntimeError: string | null
  runOutputByWorkflowId: ReadonlyMap<string, WorkflowOutputResult>
  pendingRunWorkflowId: string | null
  cancelRequestedWorkflowIds: string[]
  onCancelRun: (run: WorkflowRunProjection) => void
  onResumeRun: (run: WorkflowRunProjection) => void
  onHideRun: (run: WorkflowRunProjection) => void
  onClose: () => void
}) {
  const cancelRequestedWorkflowIdSet = React.useMemo(
    () => new Set(cancelRequestedWorkflowIds),
    [cancelRequestedWorkflowIds],
  )
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const formatter = useFormatter()
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [detailPreview, setDetailPreview] = React.useState<{ workflowId: string; top: number } | null>(null)
  const visibleRuns = runs.slice(0, WORKFLOW_RUN_HISTORY_PAGE_SIZE)
  const groupedRuns = React.useMemo(
    () => groupRunsByDate(visibleRuns, formatter, tWorkflows),
    [formatter, tWorkflows, visibleRuns],
  )
  const selectedRun = selectedRunWorkflowId
    ? runs.find((run) => run.workflow_id === selectedRunWorkflowId) ?? visibleRuns[0] ?? null
    : visibleRuns[0] ?? null
  const detailRun = detailPreview
    ? visibleRuns.find((run) => run.workflow_id === detailPreview.workflowId) ?? null
    : null
  const previewWorkflowId = detailRun?.workflow_id ?? null
  const shouldLoadPreviewRuntime = Boolean(
    previewWorkflowId && previewWorkflowId !== selectedRun?.workflow_id,
  )
  const previewRuntimeQuery = useQuery({
    queryKey: workflowRuntimeDetailQueryKey(previewWorkflowId),
    queryFn: ({ signal }) => getWorkflow(previewWorkflowId!, { signal }),
    enabled: shouldLoadPreviewRuntime,
    retry: false,
    staleTime: 30_000,
  })
  const previewRuntimeDetail = previewRuntimeQuery.data ?? null
  const previewOutputQuery = useQuery({
    queryKey: workflowOutputQueryKey(previewWorkflowId ?? ''),
    queryFn: ({ signal }) => getWorkflowOutput(previewWorkflowId!, { signal }),
    enabled: shouldLoadPreviewRuntime && canReadWorkflowOutput(
      previewRuntimeDetail?.status ?? detailRun?.status,
    ),
    retry: retryWorkflowSettlementOutput,
    retryDelay: workflowSettlementRetryDelay,
    staleTime: 30_000,
  })
  const detailRuntime = detailRun
    ? runRuntimeByWorkflowId.get(detailRun.workflow_id)
      ?? (detailRun.workflow_id === selectedRun?.workflow_id ? selectedRunRuntimeDetail : previewRuntimeDetail)
    : null
  const detailRuntimeLoading = detailRun?.workflow_id === selectedRun?.workflow_id
    ? selectedRunRuntimeLoading
    : previewRuntimeQuery.isLoading
  const detailRuntimeError = detailRun?.workflow_id === selectedRun?.workflow_id
    ? selectedRunRuntimeError
    : previewRuntimeQuery.error
      ? getWorkflowActionErrorMessage(previewRuntimeQuery.error)
      : null
  const queueSummary = launchPending && runs.length === 0
    ? tWorkflows('runs.starting')
    : loading
      ? tWorkflows('runs.loading')
      : tWorkflows('page.runCount', { count: runs.length })
  const previewRun = React.useCallback((workflowId: string, target: HTMLElement) => {
    const panelRect = panelRef.current?.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const rawTop = panelRect ? targetRect.top - panelRect.top : 0
    const maxTop = panelRect ? Math.max(0, window.innerHeight - panelRect.top - 280) : rawTop
    setDetailPreview({ workflowId, top: Math.max(0, Math.min(rawTop, maxTop)) })
  }, [])

  return (
    <div
      ref={panelRef}
      className="pointer-events-auto fixed right-4 top-16 z-[65] w-[min(356px,calc(100vw-2rem))] text-xs"
      onMouseLeave={() => setDetailPreview(null)}
    >
      {detailRun && (
        <>
          <div
            aria-hidden
            className="absolute right-full hidden h-[300px] w-2 lg:block"
            style={{ top: detailPreview?.top ?? 0 }}
          />
          <div
            className="absolute right-[calc(100%+8px)] hidden w-[min(344px,calc(100vw-404px))] lg:block"
            style={{ top: detailPreview?.top ?? 0 }}
          >
            <WorkflowRunDetailsCard
              workflowName={workflowName}
              run={detailRun}
              runtimeDetail={detailRuntime}
              runtimeLoading={detailRuntimeLoading}
              runtimeError={detailRuntimeError}
              cancelRequested={cancelRequestedWorkflowIdSet.has(detailRun.workflow_id)}
            />
          </div>
        </>
      )}

      <div className="overflow-hidden rounded-[10px] border border-white/22 bg-[#1f1f1f]/95 shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex h-11 items-center justify-between gap-3 border-b border-border/80 px-3.5">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-4 text-foreground"><UiText id="run_history_476489cf" /></div>
            <div className="text-[11px] leading-4 text-muted-foreground">{queueSummary}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            onClick={onClose}
            aria-label={tAuto('close_run_history_4e3d55d1')}
            title={tAuto('close_run_history_4e3d55d1')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="youtorch-thin-scrollbar max-h-[calc(100vh-5rem)] overflow-y-auto px-1.5 py-1.5">
          {errorMessage ? (
            <div className="truncate px-2 py-2 text-[13px] text-destructive">{errorMessage}</div>
          ) : loading && !launchPending ? (
            <div className="grid gap-1.5">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-11" />
              ))}
              <Skeleton className="h-28" />
            </div>
          ) : visibleRuns.length > 0 || launchPending ? (
            <div className="grid content-start gap-1">
              {detailRun && (
                <div className="lg:hidden">
                  <WorkflowRunDetailsCard
                    workflowName={workflowName}
                    run={detailRun}
                    runtimeDetail={detailRuntime}
                    runtimeLoading={detailRuntimeLoading}
                    runtimeError={detailRuntimeError}
                    cancelRequested={cancelRequestedWorkflowIdSet.has(detailRun.workflow_id)}
                  />
                </div>
              )}
              {launchPending && <WorkflowRunLaunchPendingRow />}
              {groupedRuns.map((group) => (
                <div key={group.key} className="grid gap-0.5 py-1">
                  <div className="px-2 pb-1 pt-2 text-[11px] font-semibold leading-4 text-muted-foreground">{group.label}</div>
                  {group.runs.map((run) => (
                    <WorkflowRunHistoryRow
                      key={run.id}
                      run={run}
                      active={selectedRun?.workflow_id === run.workflow_id}
                      runtimeDetail={runRuntimeByWorkflowId.get(run.workflow_id)
                        ?? (previewWorkflowId === run.workflow_id ? previewRuntimeDetail : null)}
                      output={runOutputByWorkflowId.get(run.workflow_id)
                        ?? (previewWorkflowId === run.workflow_id ? previewOutputQuery.data ?? null : null)}
                      pending={pendingRunWorkflowId === run.workflow_id}
                      cancelRequested={cancelRequestedWorkflowIdSet.has(run.workflow_id)}
                      onPreviewRun={previewRun}
                      onSelectRun={onSelectRun}
                      onCancelRun={onCancelRun}
                      onResumeRun={onResumeRun}
                      onHideRun={onHideRun}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-2 text-[13px] text-muted-foreground"><UiText id="no_runs_yet_578f60a8" /></div>
          )}
        </div>
      </div>
    </div>
  )
}

function WorkflowRunDetailsCard({
  workflowName,
  run,
  runtimeDetail,
  runtimeLoading,
  runtimeError,
  cancelRequested = false,
}: {
  workflowName: string
  run: WorkflowRunProjection
  runtimeDetail: WorkflowRuntimeDetail | null
  runtimeLoading: boolean
  runtimeError: string | null
  cancelRequested?: boolean
}) {
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const formatter = useFormatter()
  const [copied, setCopied] = React.useState(false)
  const reviewStopAction = getReviewDecisionStopAction(runtimeDetail, run.status, run.error_message)
  const status = reviewStopAction
    ? `review_${reviewStopAction}`
    : overlayCancelRequestedStatus(runtimeDetail?.status ?? run.status, cancelRequested) ?? run.status
  const startedAt = run.started_at ?? runtimeDetail?.startedAt ?? run.created_at
  const duration = formatRunDuration(run, status, runtimeDetail, formatter, tWorkflows)
  const failureDetail = reviewStopAction ? null : getRunFailureDetail(runtimeDetail) ?? runtimeError
  const nodeSummaries = React.useMemo(
    () => buildRunNodeSummaries(runtimeDetail, formatter, tWorkflows),
    [formatter, runtimeDetail, tWorkflows],
  )
  // GEN-04: a node's result is already stored while the run is still finishing.
  const earlyOutput = findEarlyNodeOutput(runtimeDetail)
  const earlyOutputFinishing = Boolean(earlyOutput)
    && !isFailedRunStatus(status)
    && isEarlyOutputFinishing(runtimeDetail, earlyOutput)

  const copyRunId = React.useCallback(() => {
    void (async () => {
      try {
        await navigator.clipboard?.writeText(run.workflow_id)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      } catch {
        setCopied(false)
      }
    })()
  }, [run.workflow_id])

  return (
    <section className="overflow-hidden rounded-[10px] border border-white/22 bg-[#1f1f1f]/95 shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex h-11 items-center border-b border-border/80 px-3.5">
        <div className="truncate text-[13px] font-semibold leading-4 text-foreground"><UiText id="is_detaylar_79916d0b" /></div>
      </div>
      <div className="grid gap-3.5 p-3.5">
        <DetailRow label={tAuto('cal_sma_ak_s_ac264311')} value={workflowName || run.definition_id || '-'} />
        <DetailRow
          label={tAuto('is_kimligi_7306a936')}
          value={shortRunId(run.workflow_id)}
          title={run.workflow_id}
          action={(
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 shrink-0 text-muted-foreground opacity-70 hover:bg-background hover:text-foreground"
              onClick={copyRunId}
              aria-label={tAuto('copy_run_id_8925d24b')}
              title={tAuto('copy_run_id_8925d24b')}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          hint={copied ? tAuto('copied_8e3df45a') : null}
        />
        <DetailRow label={tAuto('uretildigi_zaman_f5e53881')} value={formatRunTime(startedAt, formatter)} />
        <DetailRow label={tAuto('durum_1f8de55f')} value={runtimeLoading ? tAuto('refreshing_5b7bdb61') : formatRunStatus(status, runtimeDetail?.pausedReason, tWorkflows, run)} />
        {reviewStopAction ? <DetailRow label={tAuto('decision_7f59a1f1')} value={formatReviewDecisionStopDetail(reviewStopAction, tWorkflows)} /> : null}
        <DetailRow label={tAuto('toplam_uretim_suresi_ad0e5262')} value={duration} />
        <DetailRow label={tAuto('kullan_lan_hesaplama_saati_acc0afeb')} value={formatComputeHours(run, runtimeDetail, formatter, tWorkflows)} />
        {runtimeDetail?.creditReservation ? (
          <>
            <DetailRow label={tAuto('estimated_credits_7dbeefda')} value={formatCredits(runtimeDetail.creditReservation.estimatedCredits, formatter)} />
            <DetailRow label={tAuto('reserved_credits_41445b46')} value={formatCredits(runtimeDetail.creditReservation.reservedCredits, formatter)} />
            <DetailRow label={tAuto('spent_credits_c615bc47')} value={formatCredits(runtimeDetail.creditReservation.spentCredits, formatter)} />
            <DetailRow label={tAuto('expected_refund_6cca87a2')} value={formatCredits(runtimeDetail.creditReservation.refundableCredits, formatter)} />
            <DetailRow label={tAuto('refunded_credits_6f817b75')} value={formatCredits(runtimeDetail.creditReservation.refundedCredits, formatter)} />
            <DetailRow label={tAuto('waived_debt_40c9d825')} value={formatCredits(runtimeDetail.creditReservation.waivedDebtCredits, formatter)} />
            <DetailRow label={tAuto('net_charged_credits_f8d59846')} value={formatCredits(runtimeDetail.creditReservation.netChargedCredits, formatter)} />
            <DetailRow
              label={tAuto('settlement_45eaad8b')}
              value={formatSettlementStatus(
                runtimeDetail.settlementStatus ?? runtimeDetail.creditReservation.status,
                runtimeDetail.settlementPendingReason,
                tWorkflows,
              )}
            />
          </>
        ) : null}
        {runtimeDetail?.financeSettlement ? (
          <DetailRow
            label={tWorkflows('runDelivery.billingLabel')}
            value={tWorkflows(`runDelivery.finance.${runtimeDetail.financeSettlement}`)}
            tone={runtimeDetail.financeSettlement === 'attention' ? 'danger' : undefined}
          />
        ) : null}
        {runtimeDetail?.artifactDelivery ? (
          <DetailRow
            label={tWorkflows('runDelivery.outputLabel')}
            value={tWorkflows(`runDelivery.delivery.${runtimeDetail.artifactDelivery}`)}
          />
        ) : null}
        {earlyOutputFinishing ? (
          <DetailRow label={tWorkflows('earlyOutput.label')} value={tWorkflows('earlyOutput.finishing')} />
        ) : null}
        {nodeSummaries.length > 0 ? <DetailRow label={tAuto('nodes_9e325452')} value={<RunNodeSummaryList nodes={nodeSummaries} />} /> : null}
        {failureDetail ? <DetailRow label={tAuto('hata_detay_478c7c73')} value={compactHoverDetail(failureDetail)} tone="danger" /> : null}
      </div>
    </section>
  )
}

function DetailRow({
  label,
  value,
  title,
  action,
  hint,
  tone,
}: {
  label: string
  value: React.ReactNode
  title?: string
  action?: React.ReactNode
  hint?: string | null
  tone?: 'danger'
}) {
  const textValue = typeof value === 'string' ? value : null

  return (
    <div className="grid grid-cols-[124px_minmax(0,1fr)] items-start gap-3">
      <div className="text-[13px] font-semibold leading-5 text-foreground">{label}</div>
      <div className="flex min-w-0 items-center justify-start gap-1.5 text-left">
        {textValue !== null ? (
          <span
            className={cn(
              'min-w-0 truncate text-[13px] leading-5 text-muted-foreground',
              tone === 'danger' && 'text-destructive',
            )}
            title={title ?? textValue}
          >
            {textValue}
          </span>
        ) : value}
        {hint ? <span className="text-[10px] text-success">{hint}</span> : null}
        {action}
      </div>
    </div>
  )
}

type RunNodeSummary = {
  id: string
  title: string
  provider: string
  cost: string
  status: string
}

const RUN_NODE_SUMMARY_LIMIT = 3

function RunNodeSummaryList({ nodes }: { nodes: RunNodeSummary[] }) {
  const tWorkflows = useTranslations('Workflows')
  const [expanded, setExpanded] = React.useState(false)
  const visibleNodes = expanded ? nodes : nodes.slice(0, RUN_NODE_SUMMARY_LIMIT)
  const extraCount = Math.max(0, nodes.length - RUN_NODE_SUMMARY_LIMIT)
  const title = nodes.map(formatRunNodeSummaryTitle).join('\n')

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" title={title}>
      {visibleNodes.map((node) => (
        <span
          key={node.id}
          className="inline-flex max-w-[164px] items-center gap-1 rounded border border-border/70 bg-muted/45 px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
        >
          <span className="min-w-0 truncate">{publicWorkflowByline(node.provider)} / {node.title}</span>
          <span className="shrink-0 text-muted-foreground/70">{node.cost}</span>
        </span>
      ))}
      {extraCount > 0 ? (
        <button
          type="button"
          className="rounded border border-border/70 px-1.5 py-0.5 text-[11px] leading-4 text-foreground transition-colors hover:bg-muted"
          onClick={() => setExpanded((current) => !current)}
          aria-label={expanded ? tWorkflows('runs.showFewerNodes') : tWorkflows('runs.showMoreNodes', { count: extraCount })}
        >
          {expanded ? tWorkflows('runs.less') : tWorkflows('runs.more', { count: extraCount })}
        </button>
      ) : null}
    </div>
  )
}

function RunOutputThumb({
  preview,
  channelId,
  status,
  open,
  onOpenChange,
}: {
  preview: WorkflowOutputPreview | null
  channelId: string
  status: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tWorkflows = useTranslations('Workflows')
  if (!preview?.mediaUrl || !preview.mediaKind) {
    return <RunStatusIcon status={status} />
  }
  const mediaUrl = preview.mediaKind === 'video' && preview.storageObjectId
    ? getStoragePlaybackUrl({ channelId, objectId: preview.storageObjectId })
    : preview.mediaUrl

  return (
    <>
      <button
        type="button"
        className="group relative mt-0.5 flex h-8 w-8 overflow-hidden rounded-md border border-border/80 bg-background/80 outline-none ring-offset-background transition-colors hover:border-foreground/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={tWorkflows('runs.openMediaOutput', { media: preview.mediaKind === 'image' ? tWorkflows('runs.image') : tWorkflows('runs.video') })}
        onClick={(event) => {
          event.stopPropagation()
          onOpenChange(true)
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <RunOutputMediaThumb
          key={mediaUrl}
          mediaKind={preview.mediaKind}
          mediaUrl={mediaUrl}
        />
      </button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader className="border-b border-border/80 px-4 py-3 pr-12">
            <DialogTitle className="text-[13px] leading-5">
              {preview.mediaKind === 'image' ? tWorkflows('runs.imageOutput') : tWorkflows('runs.videoOutput')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[78vh] min-h-[260px] items-center justify-center bg-black">
            {preview.mediaKind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt=""
                className="h-auto max-h-[78vh] max-w-full object-contain"
              />
            ) : (
              <video
                src={mediaUrl}
                controls
                preload="metadata"
                className="max-h-[78vh] max-w-full bg-black"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RunOutputMediaThumb({
  mediaKind,
  mediaUrl,
}: {
  mediaKind: 'image' | 'video'
  mediaUrl: string
}) {
  const [loaded, setLoaded] = React.useState(false)

  return (
    <>
      {!loaded ? <Skeleton aria-hidden="true" className="absolute inset-0 rounded-none" /> : null}
      {mediaKind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt=""
          className="relative z-10 h-full w-full object-cover"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      ) : (
        <span className="absolute inset-0 z-10 grid place-items-center bg-black text-white/80">
          <Play className="h-3.5 w-3.5 fill-current" />
        </span>
      )}
      {loaded && mediaKind === 'video' ? (
        <span className="absolute inset-0 z-20 grid place-items-center bg-black/18 text-white">
          <Play className="h-3.5 w-3.5 fill-current" />
        </span>
      ) : null}
    </>
  )
}

function WorkflowRunLaunchPendingRow() {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-left">
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/75 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold leading-5 text-foreground"><UiText id="queueing_run_ab554fb9" /></div>
        <div className="truncate text-[12px] leading-4 text-muted-foreground"><UiText id="sending_to_queue_b177e82f" /></div>
      </div>
      <span aria-hidden="true" className="h-7 w-7" />
    </div>
  )
}

function WorkflowRunHistoryRow({
  run,
  active,
  runtimeDetail,
  output,
  pending,
  cancelRequested,
  onPreviewRun,
  onSelectRun,
  onCancelRun,
  onResumeRun,
  onHideRun,
}: {
  run: WorkflowRunProjection
  active: boolean
  runtimeDetail?: WorkflowRuntimeDetail | null
  output?: WorkflowOutputResult | null
  pending: boolean
  cancelRequested: boolean
  onPreviewRun: (workflowId: string, target: HTMLElement) => void
  onSelectRun: (run: WorkflowRunProjection) => void
  onCancelRun: (run: WorkflowRunProjection) => void
  onResumeRun: (run: WorkflowRunProjection) => void
  onHideRun: (run: WorkflowRunProjection) => void
}) {
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const formatter = useFormatter()
  const reviewStopAction = getReviewDecisionStopAction(runtimeDetail, run.status, run.error_message)
  const displayStatus = reviewStopAction
    ? `review_${reviewStopAction}`
    : overlayCancelRequestedStatus(runtimeDetail?.status?.trim() || run.status, cancelRequested) ?? run.status
  const status = displayStatus.toLowerCase()
  const canCancel = isCancellableRunStatus(status) && !cancelRequested
  const canResume = status === 'paused'
  const canHide = !isActiveRunStatus(status)
  const duration = formatRunDuration(run, displayStatus, runtimeDetail, formatter, tWorkflows)
  const hoverSummary = buildRunHoverSummary(run, displayStatus, runtimeDetail, formatter, tWorkflows)
  // GEN-04: a node's stored result is shown while the run is still finishing; the committed output wins once read.
  const earlyOutput = findEarlyNodeOutput(runtimeDetail)
  const outputPreview = selectRunOutputPreview(
    createWorkflowOutputPreview(output),
    createEarlyNodeOutputPreview(earlyOutput, run.channel_id),
  )
  const hasMediaOutput = Boolean(outputPreview?.mediaUrl && outputPreview.mediaKind)
  const earlyOutputFinishing = Boolean(earlyOutput)
    && !isFailedRunStatus(status)
    && isEarlyOutputFinishing(runtimeDetail, earlyOutput)
  const [outputDialogOpen, setOutputDialogOpen] = React.useState(false)
  const suppressRowActivationRef = React.useRef(false)
  const rowTitle = shortRunId(run.workflow_id)
  const statusMeta = formatRunHistoryRowMeta(displayStatus, duration, runtimeDetail?.pausedReason, tWorkflows, run)
  const rowMeta = earlyOutputFinishing ? `${statusMeta} · ${tWorkflows('earlyOutput.finishing')}` : statusMeta
  const failureDetail = reviewStopAction ? null : getRunFailureDetail(runtimeDetail)
  const handleOutputDialogOpenChange = (open: boolean) => {
    if (!open) {
      suppressRowActivationRef.current = true
      window.setTimeout(() => {
        suppressRowActivationRef.current = false
      }, 120)
    }
    setOutputDialogOpen(open)
  }
  const activateRow = () => {
    if (suppressRowActivationRef.current) {
      suppressRowActivationRef.current = false
      return
    }
    if (hasMediaOutput) {
      setOutputDialogOpen(true)
      return
    }
    onSelectRun(run)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group grid cursor-pointer grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-muted/80',
        active && 'bg-muted/90 ring-1 ring-border',
      )}
      onMouseEnter={(event) => onPreviewRun(run.workflow_id, event.currentTarget)}
      onFocus={(event) => onPreviewRun(run.workflow_id, event.currentTarget)}
      onClick={activateRow}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          activateRow()
        }
      }}
      aria-label={hoverSummary.replace(/\n/g, ', ')}
    >
      <RunOutputThumb
        preview={outputPreview}
        channelId={run.channel_id}
        status={displayStatus}
        open={outputDialogOpen}
        onOpenChange={handleOutputDialogOpenChange}
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-[13px] font-semibold leading-5 text-foreground">{rowTitle}</span>
          {isCancellationLifecycleStatus(status) ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-warning" aria-hidden="true" />
          ) : null}
        </div>
        <div className={cn(
          'min-w-0 truncate text-[12px] leading-4',
          isCancellationLifecycleStatus(status) ? 'text-warning' : 'text-muted-foreground',
        )}>
          {rowMeta}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {isCancellationLifecycleStatus(status) ? (
          <span
            className="flex h-7 w-7 items-center justify-center text-warning"
            aria-label={formatRunStatusLabel(displayStatus, runtimeDetail?.pausedReason, tWorkflows, run)}
            title={formatRunStatusLabel(displayStatus, runtimeDetail?.pausedReason, tWorkflows, run)}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </span>
        ) : null}
        {canCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:bg-background hover:text-foreground"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation()
              onCancelRun(run)
            }}
            aria-label={tAuto('cancel_run_83dc24e1')}
            title={tAuto('cancel_run_83dc24e1')}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
        {canResume && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:bg-background hover:text-foreground"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation()
              onResumeRun(run)
            }}
            aria-label={tAuto('resume_run_b3367239')}
            title={tAuto('resume_run_b3367239')}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        {canHide ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation()
              onHideRun(run)
            }}
            aria-label={tAuto('remove_run_history_item_5d47a545')}
            title={tAuto('remove_run_history_item_5d47a545')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={tAuto('run_actions_7e79ba5a')}
              title={tAuto('run_actions_7e79ba5a')}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem
              disabled={!run.definition_id}
              onSelect={() => {
                if (run.definition_id) openWorkflowInNewTab(run.definition_id)
              }}
            >
              <ExternalLink className="h-4 w-4" />
              <UiText id="cal_sma_ak_s_n_yeni_sekmede_ac_98b132b4" /></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => copyText(run.workflow_id, tWorkflows('page.copyRunSuccess'), tWorkflows('page.copyFailed'))}>
              <Copy className="h-4 w-4" />
              <UiText id="is_kimligini_kopyala_9605f54e" /></DropdownMenuItem>
            <DropdownMenuItem
              disabled={!failureDetail}
              onSelect={() => {
                if (failureDetail) copyText(failureDetail, tWorkflows('page.copyErrorSuccess'), tWorkflows('page.copyFailed'))
              }}
            >
              <Copy className="h-4 w-4" />
              <UiText id="hata_mesaj_n_kopyala_607ebf6f" /></DropdownMenuItem>
            <DropdownMenuItem
              disabled={!isFailedRunStatus(status) || Boolean(reviewStopAction)}
              onSelect={() => toast.message(tWorkflows('page.reportReady'))}
            >
              <MessageSquareWarning className="h-4 w-4" />
              <UiText id="hata_bildir_9e082488" /></DropdownMenuItem>
            {canHide ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onHideRun(run)}>
                  <Trash2 className="h-4 w-4" />
                  <UiText id="gecmisten_kald_r_eed9986b" /></DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function copyText(value: string, successMessage: string, failureMessage: string) {
  void (async () => {
    try {
      await navigator.clipboard?.writeText(value)
      toast.success(successMessage)
    } catch {
      toast.error(failureMessage)
    }
  })()
}

function openWorkflowInNewTab(definitionId: string) {
  if (!definitionId) return
  window.open(buildWorkflowDetailHref(definitionId), '_blank', 'noopener,noreferrer')
}

function RunStatusIcon({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const className = 'h-3.5 w-3.5'

  if (isQueuedRunStatus(normalized)) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/75 text-muted-foreground">
        <Loader2 className={cn(className, 'animate-spin')} />
      </span>
    )
  }

  if (isCancellationLifecycleStatus(normalized)) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-warning/20 bg-warning/10 text-warning">
        <Loader2 className={cn(className, 'animate-spin')} />
      </span>
    )
  }

  if (isActiveRunStatus(status)) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-info/20 bg-info/10 text-info">
        <Loader2 className={cn(className, 'animate-spin')} />
      </span>
    )
  }

  if (normalized === 'completed' || normalized === 'success' || normalized === 'succeeded') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-success/20 bg-success/10 text-success">
        <CheckCircle2 className={className} />
      </span>
    )
  }

  if (isReviewDecisionStopStatus(normalized)) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-warning/20 bg-warning/10 text-warning">
        <CircleAlert className={className} />
      </span>
    )
  }

  if (normalized === 'failed' || normalized === 'cancelled') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/80 text-destructive">
        <CircleAlert className={className} />
      </span>
    )
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/80 text-muted-foreground">
      <CalendarClock className={className} />
    </span>
  )
}

type WorkflowOutputPreview = {
  mediaKind: 'image' | 'video' | null
  mediaUrl: string | null
  storageObjectId: string | null
  text: string | null
}

function createWorkflowOutputPreview(output: WorkflowOutputResult | null | undefined) {
  const candidates = [
    output?.finalOutput,
    ...(output?.finalOutputs ?? []),
    ...(output?.outputs ?? []).slice().reverse(),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))
  let fallback: WorkflowOutputPreview | null = null
  for (const candidate of candidates) {
    const preview = createOutputPreview(candidate.outputData)
    if (preview?.mediaKind && preview.mediaUrl) return preview
    fallback ??= preview
  }
  return fallback
}

/** GEN-04: the stored video of a still-finishing node, played through the Storage playback endpoint. */
function createEarlyNodeOutputPreview(
  early: EarlyNodeOutput | null,
  channelId: string | null | undefined,
): WorkflowOutputPreview | null {
  if (!early || early.mediaKind !== 'video' || !channelId) return null
  return {
    mediaKind: 'video',
    mediaUrl: getStoragePlaybackUrl({ channelId, objectId: early.storageObjectId }),
    storageObjectId: early.storageObjectId,
    text: null,
  }
}

/** The committed run output wins once it carries media; until then a stored early node output fills in. */
function selectRunOutputPreview(
  committed: WorkflowOutputPreview | null,
  early: WorkflowOutputPreview | null,
): WorkflowOutputPreview | null {
  if (committed?.mediaKind && committed.mediaUrl) return committed
  return early ?? committed
}

function createOutputPreview(value: unknown): WorkflowOutputPreview | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (isImageUrl(trimmed)) return { mediaKind: 'image', mediaUrl: trimmed, storageObjectId: null, text: null }
    if (isVideoUrl(trimmed)) return { mediaKind: 'video', mediaUrl: trimmed, storageObjectId: null, text: null }
    return { mediaKind: null, mediaUrl: null, storageObjectId: null, text: trimmed }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { mediaKind: null, mediaUrl: null, storageObjectId: null, text: String(value) }
  }

  const records = collectOutputRecords(value)
  const mediaUrl = findOutputString(records, [
    'image_url',
    'imageUrl',
    'image',
    'images',
    'video_url',
    'videoUrl',
    'video',
    'videos',
    'cdn_url',
    'cdnUrl',
    'media_url',
    'mediaUrl',
    'artifact_url',
    'artifactUrl',
    'asset_url',
    'assetUrl',
    'file_url',
    'fileUrl',
    'output_url',
    'outputUrl',
    'download_url',
    'downloadUrl',
    'public_url',
    'publicUrl',
    'signed_url',
    'signedUrl',
    'thumbnail_url',
    'thumbnailUrl',
    'src',
    'href',
    'url',
  ])
  const mediaKind = mediaUrl && isImageUrl(mediaUrl)
    ? 'image'
    : mediaUrl && isVideoUrl(mediaUrl)
      ? 'video'
      : null
  const storageObjectId = findOutputString(records, [
    'storage_object_id',
    'storageObjectId',
    'object_id',
    'objectId',
  ])
  const text = findOutputString(records, [
    'prompt',
    'enhanced_prompt',
    'enhancedPrompt',
    'text',
    'answer',
    'response',
    'summary',
    'description',
    'message',
    'transcript',
    'content',
  ])

  return {
    mediaKind,
    mediaUrl: mediaKind ? mediaUrl : null,
    storageObjectId,
    text: text ?? (mediaKind ? null : truncateOutputJson(value)),
  }
}

function collectOutputRecords(value: unknown): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = []
  const visit = (candidate: unknown, depth: number) => {
    if (depth > 4) return
    if (Array.isArray(candidate)) {
      candidate.slice(0, 12).forEach((item) => visit(item, depth + 1))
      return
    }
    const record = asOutputRecord(candidate)
    if (!record) return
    records.push(record)
    for (const key of ['result', 'output', 'data', 'metadata', 'image', 'images', 'video', 'videos', 'file', 'files', 'artifact', 'artifacts', 'asset', 'assets', 'items']) {
      visit(record[key], depth + 1)
    }
  }
  visit(value, 0)
  return records
}

function findOutputString(records: Array<Record<string, unknown>>, keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return null
}

function asOutputRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function isImageUrl(value: string) {
  return /^https?:\/\//i.test(value)
    && (/\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(value) || /image/i.test(value))
}

function isVideoUrl(value: string) {
  return /^https?:\/\//i.test(value)
    && (/\.(mp4|mov|webm|m4v|ogg)(?:[?#].*)?$/i.test(value) || /video/i.test(value) || /stream/i.test(value))
}

function truncateOutputJson(value: unknown) {
  const text = JSON.stringify(value, null, 2) ?? ''
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text
}

export function WorkflowsPageLoading() {
  return <WorkflowListLoading />
}

function WorkflowCanvasLoading() {
  const tAuto = useTranslations('Auto')
  return (
    <div className="workflow-flow-surface h-screen overflow-hidden p-4" aria-busy="true" aria-label={tAuto('loading_workflow_canvas_bbd9cd59')}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-panel/30">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="ml-auto h-9 w-28 rounded-xl" />
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden p-8">
          <Skeleton className="absolute left-[8%] top-[18%] h-28 w-56 rounded-2xl" />
          <Skeleton className="absolute left-[39%] top-[38%] h-28 w-56 rounded-2xl" />
          <Skeleton className="absolute right-[8%] top-[21%] h-28 w-56 rounded-2xl" />
          <Skeleton className="absolute bottom-6 left-6 h-10 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function WorkflowEditorLoading({
  workflowName,
  errorMessage,
  onBack,
}: {
  workflowName: string
  errorMessage: string | null
  onBack: () => void
}) {
  const tWorkflows = useTranslations('Workflows') as unknown as WorkflowTranslator
  const displayName = localizeWorkflowDisplayText(workflowName, tWorkflows)
  return (
    <div className="workflow-flow-surface absolute inset-0 z-10 overflow-hidden" aria-label={tWorkflows('starter.loadingWorkflow', { name: displayName })}>
      {errorMessage ? (
        <>
          <div className="absolute left-4 top-4 z-[2]">
            <Button type="button" variant="ghost" size="sm" className="h-9 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onBack}>
              <X className="h-4 w-4" />
              <UiText id="back_b52b36b7" /></Button>
          </div>
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
            {errorMessage}
          </div>
        </>
      ) : (
        <WorkflowCanvasLoading />
      )}
    </div>
  )
}

function createDraftWorkflow(channelName?: string, name = 'Untitled workflow'): Workflow {
  const base = initialWorkflows[0]
  const draftId = createDraftWorkflowId()

  return {
    ...base,
    id: draftId,
    name,
    description: '',
    channel: channelName ?? base.channel,
    projectId: DEFAULT_WORKFLOW_PROJECT_ID,
    status: 'draft',
    triggerType: 'manual',
    triggerLabel: 'Manual run',
    schedule: 'Not scheduled',
    lastRunAt: 'Never run',
    lastRunStatus: 'never',
    nextRunAt: 'Draft',
    runCount24h: 0,
    averageCost: '0c',
    successRate: 0,
    nodesCount: 0,
    updatedAt: '22 Nis 2026',
    metrics: [
      { label: 'Draft', value: '0 nodes' },
      { label: 'Success', value: '-' },
      { label: 'Avg. cost', value: '0c' },
    ],
    nodes: [],
    edges: [],
  }
}

function createDraftWorkflowId() {
  const randomSuffix = Math.random().toString(36).slice(2, 8)
  return `wf-draft-${Date.now()}-${randomSuffix}`
}

function isPristineLocalDraft(workflow: Workflow) {
  if (!isLocalDraft(workflow.id)) return false
  return workflow.nodes.length === 0
    && workflow.edges.length === 0
    && workflow.description === ''
    && workflow.triggerType === 'manual'
    && (workflow.name === 'Untitled workflow' || workflow.name === 'Adsız iş akışı')
}

function buildWorkflowUserInputs(workflow: Workflow): Record<string, unknown> {
  const userInputs: Record<string, unknown> = {}

  workflow.nodes.forEach((node) => {
    if (node.kind !== 'input') return
    const value = node.settings?.helper_value
    if (typeof value !== 'string' || !value.trim()) return
    const outputPort = node.outputPorts?.[0]?.id ?? node.outputs?.[0]
    if (!outputPort) return
    userInputs[outputPort] = value.trim()
  })

  return userInputs
}

async function prepareWorkflowVoiceCloneConsents(
  workflow: Workflow,
  channelId: string,
  tWorkflows: WorkflowTranslator,
): Promise<Workflow> {
  const nodes = await Promise.all(workflow.nodes.map(async (node) => {
    const typeName = catalogNodeTypeName(String(node.settings?.node_type ?? node.settings?.workflow_node_type ?? ''))
    if (typeName !== 'voice_clone') return node
    const settings = { ...(node.settings ?? {}) }
    const referenceStorageObjectId = String(settings.reference_storage_object_id ?? '').trim()
    if (!referenceStorageObjectId) return node
    if (settings.consent_accepted !== true) {
      throw new Error(tWorkflows('errors.voiceCloneConsentRequired'))
    }
    const targetSpeechModelId = String(
      settings.target_speech_model_id ?? settings.model_id ?? '',
    ).trim()
    const language = String(settings.language ?? '').trim() || 'en'
    if (!targetSpeechModelId) {
      throw new Error(tWorkflows('errors.voiceCloneModelRequired'))
    }
    const consent = await grantInstantVoiceCloneConsent({
      channelId,
      referenceStorageObjectId,
      subjectType: 'self',
      targetSpeechModelId,
      language,
      accepted: true,
      idempotencyKey: `flow-voice-clone:${workflow.id}:${node.id}:${referenceStorageObjectId}:${targetSpeechModelId}`,
    })
    if (
      consent.status !== 'granted'
      || consent.reference_storage_object_id !== referenceStorageObjectId
    ) {
      throw new Error(tWorkflows('errors.voiceCloneConsentFailed'))
    }
    return {
      ...node,
      settings: {
        ...settings,
        target_speech_model_id: targetSpeechModelId,
        consent_record_id: consent.consent_id,
      },
    }
  }))
  return { ...workflow, nodes }
}

function isLocalDraft(workflowId: string) {
  return workflowId.startsWith('wf-draft-')
}

function workflowDefinitionDetailQueryKey(
  channelId: string | null | undefined,
  workflowId: string | null | undefined,
) {
  return [
    ...WORKFLOW_DEFINITIONS_QUERY_KEY,
    channelId ?? 'none',
    workflowId ?? 'none',
    'detail',
  ] as const
}

function workflowDefinitionRunsQueryKey(
  channelId: string | null | undefined,
  workflowId: string | null | undefined,
  input?: { limit?: number; offset?: number },
) {
  const base = [
    ...WORKFLOW_DEFINITIONS_QUERY_KEY,
    channelId ?? 'none',
    workflowId ?? 'none',
    'runs',
  ] as const
  if (!input) return base
  return [
    ...base,
    input.limit ?? 20,
    input.offset ?? 0,
  ] as const
}

function workflowRuntimeDetailQueryKey(workflowId: string | null | undefined) {
  return ['workflows', 'runtime-detail', workflowId ?? 'none'] as const
}

function workflowRuntimeStatusQueryKey(workflowId: string | null | undefined) {
  return ['workflows', 'runtime-status', workflowId ?? 'none'] as const
}

function mergeWorkflowRuntimeStatus(
  detail: WorkflowRuntimeDetail | null,
  status: WorkflowRuntimeStatus | null,
): WorkflowRuntimeDetail | null {
  if (!detail || !status || detail.workflowId !== status.workflowId) return detail
  return {
    ...detail,
    status: status.status,
    progress: status.progress,
    totalCreditsEstimated: status.totalCreditsEstimated,
    totalCreditsCharged: status.totalCreditsCharged,
    errorMessage: status.errorMessage,
    pausedReason: status.pausedReason !== undefined ? status.pausedReason : detail.pausedReason,
    currentNodeKey: status.currentNodeKey !== undefined ? status.currentNodeKey : detail.currentNodeKey,
    runType: status.runType ?? detail.runType,
    invocationSource: status.invocationSource ?? detail.invocationSource,
    cancelMode: status.cancelMode ?? detail.cancelMode,
    cancelRequestedAt: status.cancelRequestedAt ?? detail.cancelRequestedAt,
    settlementStatus: status.settlementStatus ?? detail.settlementStatus,
    settlementPendingReason: status.settlementPendingReason ?? detail.settlementPendingReason,
    creditReservation: status.creditReservation ?? detail.creditReservation,
    // The live poll is the only source of the payment-review hold; it also fences GEN-04 early outputs.
    deliveryStatus: status.deliveryStatus,
    runtimeTerminal: status.runtimeTerminal ?? detail.runtimeTerminal,
    financeSettlement: status.financeSettlement ?? detail.financeSettlement,
    artifactDelivery: status.artifactDelivery ?? detail.artifactDelivery,
    outputReady: status.outputReady ?? detail.outputReady,
    nodes: status.nodes.length > 0 ? status.nodes : detail.nodes,
  }
}

function workflowOutputQueryKey(workflowId: string | null | undefined) {
  return ['workflows', 'output', workflowId ?? 'none'] as const
}

function canReadWorkflowOutput(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return normalized === 'completed' || normalized === 'success' || normalized === 'succeeded'
}

function mergeLocalDrafts(localDrafts: Workflow[], apiWorkflows: Workflow[]) {
  const draftIds = new Set(localDrafts.map((workflow) => workflow.id))
  return [
    ...localDrafts,
    ...apiWorkflows.filter((workflow) => !draftIds.has(workflow.id)),
  ]
}

function buildWorkflowProjectOptions(
  workflows: Workflow[],
  selectedProjectId: string | null,
): WorkflowProjectOption[] {
  const counts = new Map<string, number>()

  workflows.forEach((workflow) => {
    const projectId = workflow.projectId?.trim()
    if (!projectId) return
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1)
  })

  if (!counts.has(DEFAULT_WORKFLOW_PROJECT_ID)) {
    counts.set(DEFAULT_WORKFLOW_PROJECT_ID, 0)
  }

  if (selectedProjectId?.trim() && !counts.has(selectedProjectId.trim())) {
    counts.set(selectedProjectId.trim(), 0)
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, workflowCount]) => ({
      id,
      label: id,
      workflowCount,
    }))
}

function showWorkflowToast(message: WorkflowActionMessage) {
  if (message.tone === 'danger') {
    toast.error(message.text)
    return
  }
  if (message.tone === 'success') {
    toast.success(message.text)
    return
  }
  toast.message(message.text)
}

function createWorkflowNodeRunState(
  workflow: Workflow,
  runtimeDetail: WorkflowRuntimeDetail | null,
): { statuses: Record<string, WorkflowRunStatus>; activeNodeId: string | null } {
  const statuses: Record<string, WorkflowRunStatus> = {}
  if (!runtimeDetail) return { statuses, activeNodeId: null }

  const normalizedRunStatus = runtimeDetail.status.toLowerCase()
  if (!shouldPollRunStatus(normalizedRunStatus)) {
    return { statuses, activeNodeId: null }
  }

  const runtimeNodeStatuses = new Map<string, WorkflowRunStatus>()
  const cancellingRun = isCancellationLifecycleStatus(normalizedRunStatus)
  const inFlightStatus: WorkflowRunStatus = cancellingRun ? 'warning' : 'running'

  runtimeDetail.nodes.forEach((node) => {
    runtimeNodeStatuses.set(node.nodeKey, mapRuntimeNodeStatus(node.status, normalizedRunStatus))
  })

  const explicitActiveNodeId = runtimeDetail.currentNodeKey ?? null
  const activeRun = isActiveRunStatus(normalizedRunStatus)

  workflow.nodes.forEach((node, index) => {
    const runtimeStatus = runtimeNodeStatuses.get(node.id)
    if (runtimeStatus) {
      statuses[node.id] = runtimeStatus
      return
    }

    if (normalizedRunStatus === 'completed' || normalizedRunStatus === 'success' || normalizedRunStatus === 'succeeded') {
      statuses[node.id] = 'success'
      return
    }

    if (normalizedRunStatus === 'failed' || normalizedRunStatus === 'cancelled') {
      statuses[node.id] = explicitActiveNodeId === node.id ? 'failed' : node.status
      return
    }

    if (runtimeDetail.totalNodes <= 0) {
      statuses[node.id] = activeRun && index === 0 ? inFlightStatus : node.status
      return
    }

    if (index < runtimeDetail.completedNodes) {
      statuses[node.id] = 'success'
      return
    }

    if (activeRun && (explicitActiveNodeId === node.id || index === runtimeDetail.completedNodes)) {
      statuses[node.id] = inFlightStatus
      return
    }

    statuses[node.id] = node.status
  })

  const activeNodeId = explicitActiveNodeId
    ?? workflow.nodes.find((node) => statuses[node.id] === 'running' || statuses[node.id] === 'warning')?.id
    ?? null

  return { statuses, activeNodeId }
}

function mapRuntimeNodeStatus(status: string, runStatus?: string): WorkflowRunStatus {
  const normalized = status.toLowerCase()
  if (normalized === 'completed' || normalized === 'success' || normalized === 'succeeded') return 'success'
  if (isReviewDecisionStopStatus(normalized)) return 'warning'
  if (normalized === 'failed' || normalized === 'error') return 'failed'
  if (normalized === 'cancelled' || normalized === 'canceled' || isCancellationLifecycleStatus(normalized)) return 'warning'
  if (normalized === 'running' || normalized === 'started' || normalized === 'in_process' || normalized === 'in_progress' || normalized === 'processing' || normalized === 'executing') {
    return isCancellationLifecycleStatus(runStatus) ? 'warning' : 'running'
  }
  if (normalized === 'paused' || normalized === 'waiting' || normalized === 'skipped' || normalized === 'blocked') return 'warning'
  return 'never'
}

function sortWorkflowRunsNewestFirst<T extends WorkflowRunProjection>(runs: T[]) {
  return [...runs].sort((left, right) => getRunTimestamp(right) - getRunTimestamp(left))
}

function getRunTimestamp(run: WorkflowRunProjection) {
  const value = run.created_at ?? run.started_at ?? run.completed_at
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function isParkPromotingCancelError(error: unknown) {
  if (!isAuthClientError(error) || error.status !== 409) return false
  const context = toWorkflowErrorContext(error.details)
  return context.park_state === 'promoting' || /promoting/i.test(error.message)
}

function getWorkflowActionErrorMessage(error: unknown, t?: WorkflowTranslator) {
  if (isParkPromotingCancelError(error)) {
    return t?.('runs.cancelPromoting') ?? 'Launch is finishing, try again'
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Workflow action could not be completed.'
}

function preserveWorkflowCanvasAfterPersistence(snapshot: Workflow, persisted: Workflow): Workflow {
  return {
    ...persisted,
    name: snapshot.name,
    description: snapshot.description,
    channel: snapshot.channel || persisted.channel,
    projectId: snapshot.projectId ?? persisted.projectId,
    triggerType: snapshot.triggerType,
    triggerLabel: snapshot.triggerLabel,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    nodesCount: snapshot.nodes.length,
  }
}

function isNonDraftRevisionUpdateError(error: unknown) {
  return error instanceof Error
    && error.message.toLowerCase().includes('only draft workflow revisions can be updated')
}

function getWorkflowRunQueueErrorMessage(
  error: unknown,
  tErrors?: (key: string) => string,
  tWorkflows?: WorkflowTranslator,
) {
  if (tErrors && isAuthClientError(error) && error.code === 'CHANNEL_NOT_CONNECTED') {
    return tErrors('channelNotConnected')
  }
  if (tWorkflows && isAuthClientError(error)) {
    if (error.code === 'VIRAL_CLIPS_MONTHLY_QUOTA_EXHAUSTED') {
      return tWorkflows('runs.viralClipsQuotaExhausted')
    }
    if (error.code === 'WORKFLOW_ESTIMATE_CONFLICT') {
      const context = toWorkflowErrorContext(error.details)
      if (context.revalidation_required === true) return tWorkflows('runs.viralClipsQuotaChanged')
    }
  }
  const validationDetail = getWorkflowValidationDetail(error)
  if (validationDetail) return validationDetail

  const rawMessage = error instanceof Error ? error.message.trim() : ''
  const normalized = rawMessage.toLowerCase()
  if (normalized.includes('validation')) {
    return 'Check node inputs and connections.'
  }
  if (rawMessage) return rawMessage
  return 'Check workflow setup and try again.'
}

function workflowRevisionContainsViralClips(revision: WorkflowDefinitionRevision) {
  const nodes = Array.isArray(revision.dsl_json.nodes) ? revision.dsl_json.nodes : []
  return nodes.some((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const nodeType = (value as Record<string, unknown>).type
    return typeof nodeType === 'string'
      && ['viral_clips', 'viral_shorts'].includes(nodeType.split('@')[0]?.toLowerCase() ?? '')
  })
}

function getWorkflowQuotaLimitDialogState(error: unknown): WorkflowQuotaLimitDialogState | null {
  if (!isAuthClientError(error)) return null

  const context = toWorkflowErrorContext(error.details)
  const admissionDecision = getWorkflowContextString(context, 'admission_decision')
  const quotaKey = getWorkflowContextString(context, 'quota_key')
  const normalizedMessage = error.message.toLowerCase()
  const isWorkflowQuotaError = error.code === 'WORKFLOW_QUOTA_EXCEEDED' || admissionDecision === 'rejected_quota'
  const isMonthlyRunQuota = quotaKey === WORKFLOW_MONTHLY_RUNS_QUOTA_KEY
    || normalizedMessage.includes('workflow monthly quota')

  if (!isWorkflowQuotaError || !isMonthlyRunQuota) return null

  return {
    monthlyLimit: getWorkflowContextNumber(context, 'monthly_limit'),
    quotaRemaining: getWorkflowContextNumber(context, 'quota_remaining')
      ?? getWorkflowContextNumber(context, 'quota_available'),
  }
}

function buildWorkflowQuotaSupportMailto(state: WorkflowQuotaLimitDialogState | null) {
  const subject = 'Workflow limit increase'
  const bodyLines = [
    'Hi Youtorch team,',
    '',
    'Please increase our monthly workflow run limit.',
    '',
    `Remaining runs: ${state?.quotaRemaining ?? 0}`,
    `Monthly limit: ${state?.monthlyLimit ?? 'unknown'}`,
  ]
  return `mailto:${WORKFLOW_QUOTA_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`
}

function formatWorkflowRunCount(value: number, t: WorkflowTranslator) {
  return t('page.runCount', { count: Math.max(0, Math.floor(value)) })
}

function toWorkflowErrorContext(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getWorkflowContextString(context: Record<string, unknown>, key: string) {
  const value = context[key]
  return typeof value === 'string' ? value : null
}

function getWorkflowContextNumber(context: Record<string, unknown>, key: string) {
  const value = context[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function getWorkflowValidationDetail(error: unknown) {
  if (!isAuthClientError(error) || error.code !== 'VALIDATION_ERROR') return null
  const details = error.details
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const errors = (details as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return null
  const first = errors.find((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return first?.trim() ?? null
}

function formatRunDate(value: string | null | undefined, formatter: WorkflowFormatter) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return formatter.dateTime(date, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRunTime(value: string | null | undefined, formatter: WorkflowFormatter) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return formatter.dateTime(date, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
}

function formatRunGroupDate(
  value: string | null | undefined,
  formatter: WorkflowFormatter,
  t: WorkflowTranslator,
) {
  if (!value) return t('runs.unknownDate')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t('runs.unknownDate')
  return formatter.dateTime(date, {
    day: 'numeric',
    month: 'short',
  })
}

function groupRunsByDate(runs: WorkflowRunProjection[], formatter: WorkflowFormatter, t: WorkflowTranslator) {
  const groups: Array<{ key: string; label: string; runs: WorkflowRunProjection[] }> = []
  const byKey = new Map<string, { key: string; label: string; runs: WorkflowRunProjection[] }>()

  for (const run of runs) {
    const date = new Date(run.created_at)
    const key = Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString().slice(0, 10)
    const existing = byKey.get(key)
    if (existing) {
      existing.runs.push(run)
      continue
    }
    const group = { key, label: formatRunGroupDate(run.created_at, formatter, t), runs: [run] }
    byKey.set(key, group)
    groups.push(group)
  }

  return groups
}

function buildRunNodeSummaries(
  runtimeDetail: WorkflowRuntimeDetail | null | undefined,
  formatter: WorkflowFormatter,
  t: WorkflowTranslator,
): RunNodeSummary[] {
  if (!runtimeDetail?.nodes.length) return []

  return runtimeDetail.nodes.map((node, index) => {
    const nodeType = node.nodeType || node.nodeKey || 'workflow.node'
    const reviewStopAction = getReviewDecisionStopActionFromValues(node.status, node.errorMessage)
    const nodeStatus = (
      isCancellationLifecycleStatus(runtimeDetail.status)
      && isRunningRunStatus(node.status)
      && !isCancellationLifecycleStatus(node.status)
    ) ? runtimeDetail.status : node.status
    return {
      id: node.nodeKey || `${nodeType}-${index}`,
      title: getWorkflowNodeTitle(nodeType),
      provider: getWorkflowNodeProvider(nodeType),
      cost: formatCredits(node.creditsCharged, formatter),
      status: reviewStopAction
        ? formatReviewDecisionStopLabel(reviewStopAction, t)
        : formatRunStatus(nodeStatus, null, t),
    }
  })
}

function formatRunNodeSummaryTitle(node: RunNodeSummary) {
  return `${publicWorkflowByline(node.provider)} / ${node.title} - ${node.cost} - ${node.status}`
}

function formatRunDuration(
  run: WorkflowRunProjection,
  statusOverride: string | null | undefined,
  runtimeDetail: WorkflowRuntimeDetail | null | undefined,
  formatter: WorkflowFormatter,
  t: WorkflowTranslator,
) {
  const startedAt = run.started_at ?? runtimeDetail?.startedAt
  const completedAt = run.completed_at ?? runtimeDetail?.finishedAt
  const started = startedAt ? new Date(startedAt).getTime() : null
  const completed = completedAt ? new Date(completedAt).getTime() : null
  const status = statusOverride ?? run.status
  if (isPausedRunStatus(status)) return formatPausedRunStatus(runtimeDetail?.pausedReason ?? status, t)
  if (isCancellationLifecycleStatus(status)) {
    const normalized = status.toLowerCase()
    if (normalized === 'draining') return t('runs.draining')
    if (normalized === 'settlement_pending') return t('runs.settling')
    return t('runs.cancelling')
  }
  if (isActiveRunStatus(status) && started !== null && completed === null) return t('runs.running')
  if (started !== null && completed !== null && !Number.isNaN(started) && !Number.isNaN(completed)) {
    return formatDurationMs(completed - started, formatter, t)
  }
  if (runtimeDetail?.durationMs != null && !isActiveRunStatus(status)) return formatDurationMs(runtimeDetail.durationMs, formatter, t)
  return formatQueuedRunLabel(status, run, t)
}

function formatRunHistoryRowMeta(
  status: string,
  duration: string,
  pausedReason: string | null | undefined,
  t: WorkflowTranslator,
  run?: WorkflowRunProjection | null,
) {
  const label = formatRunStatusLabel(status, pausedReason, t, run)
  if (
    !duration
    || duration === t('runs.queued')
    || duration === t('runs.running')
    || duration === label
    || duration.startsWith(`${t('runs.queued')} ·`)
  ) {
    return label
  }
  return `${formatRunHistoryDuration(duration)} ${label}`
}

function formatRunHistoryDuration(duration: string) {
  return duration.replace(/\s+s\b/g, 's')
}

function formatRunStatusLabel(status: string, pausedReason: string | null | undefined, t: WorkflowTranslator, run?: WorkflowRunProjection | null) {
  const normalized = status.toLowerCase()
  const reviewStopAction = getReviewDecisionActionFromStatus(normalized)
  if (reviewStopAction) return formatReviewDecisionStopLabel(reviewStopAction, t)
  if (isPausedRunStatus(normalized)) return formatPausedRunStatus(pausedReason ?? normalized, t)
  if (normalized === 'completed' || normalized === 'success' || normalized === 'succeeded') return t('runs.completed')
  if (normalized === 'expired') return t('runs.expired')
  if (isFailedRunStatus(normalized)) return t('runs.failed')
  if (normalized === 'cancelled' || normalized === 'canceled') return t('runs.cancelled')
  if (normalized === 'cancelling') return t('runs.cancelling')
  if (normalized === 'draining') return t('runs.draining')
  if (normalized === 'settlement_pending') return t('runs.settling')
  if (isQueuedRunStatus(normalized)) return formatQueuedRunLabel(normalized, run, t)
  if (isRunningRunStatus(normalized)) return t('runs.running')
  return formatRunStatus(status, pausedReason, t, run)
}

function formatComputeHours(
  run: WorkflowRunProjection,
  runtimeDetail: WorkflowRuntimeDetail | null | undefined,
  formatter: WorkflowFormatter,
  t: WorkflowTranslator,
) {
  const durationMs = getRunDurationMs(run, runtimeDetail)
  if (durationMs === null) return '-'
  const hours = durationMs / 3_600_000
  return t('runs.hours', {
    hours: formatter.number(hours, {
      minimumFractionDigits: hours > 0 && hours < 0.01 ? 3 : 2,
      maximumFractionDigits: 3,
    }),
  })
}

function getRunDurationMs(run: WorkflowRunProjection, runtimeDetail?: WorkflowRuntimeDetail | null) {
  if (runtimeDetail?.durationMs != null && Number.isFinite(runtimeDetail.durationMs)) {
    return Math.max(0, runtimeDetail.durationMs)
  }
  const startedAt = runtimeDetail?.startedAt ?? run.started_at
  const completedAt = runtimeDetail?.finishedAt ?? run.completed_at
  const started = startedAt ? new Date(startedAt).getTime() : null
  const completed = completedAt ? new Date(completedAt).getTime() : null
  if (!started || !completed || Number.isNaN(started) || Number.isNaN(completed)) return null
  return Math.max(0, completed - started)
}

function getRunFailureDetail(runtimeDetail?: WorkflowRuntimeDetail | null) {
  if (getReviewDecisionStopAction(runtimeDetail)) return null
  if (runtimeDetail?.errorMessage) return runtimeDetail.errorMessage
  const failedNode = runtimeDetail?.nodes.find((node) => isFailedRunStatus(node.status))
  if (!failedNode?.errorMessage) return null
  return `${failedNode.nodeKey}: ${failedNode.errorMessage}`
}

function buildRunHoverSummary(
  run: WorkflowRunProjection,
  status: string,
  runtimeDetail: WorkflowRuntimeDetail | null | undefined,
  formatter: WorkflowFormatter,
  t: WorkflowTranslator,
) {
  const reviewStopAction = getReviewDecisionStopAction(runtimeDetail, status)
  const failureDetail = getRunFailureDetail(runtimeDetail)
  const chargedCredits = runtimeDetail?.totalCreditsCharged ?? run.total_actual_credits ?? 0
  const estimatedCredits = runtimeDetail?.totalCreditsEstimated ?? run.total_estimated_credits
  const parts = [
    t('runs.hoverRun', { value: run.workflow_id }),
    t('runs.hoverStatus', { value: formatRunStatus(status, runtimeDetail?.pausedReason, t, run) }),
    t('runs.hoverStarted', { value: formatRunDate(run.started_at ?? runtimeDetail?.startedAt ?? run.created_at, formatter) }),
    t('runs.hoverUpdated', { value: formatRunDate(runtimeDetail?.updatedAt ?? run.updated_at ?? run.created_at, formatter) }),
    t('runs.hoverDuration', { value: formatRunDuration(run, status, runtimeDetail, formatter, t) }),
  ]
  if (chargedCredits > 0) {
    parts.push(t('runs.hoverCharged', { value: formatCredits(chargedCredits, formatter) }))
  } else if (estimatedCredits > 0) {
    parts.push(t('runs.hoverEstimate', { value: formatCredits(estimatedCredits, formatter) }))
  }
  if (reviewStopAction) {
    parts.push(t('runs.hoverDecision', { value: formatReviewDecisionStopDetail(reviewStopAction, t) }))
  }
  if (failureDetail) {
    parts.push(t('runs.hoverDetail', { value: compactHoverDetail(failureDetail) }))
  }
  return parts.join('\n')
}

function formatCredits(value: number, formatter: WorkflowFormatter) {
  return `${formatter.number(value, { maximumFractionDigits: 2 })}c`
}

function compactHoverDetail(value: string) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > 180 ? `${text.slice(0, 180)}...` : text
}

function shortRunId(value: string) {
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

type ReviewDecisionStopAction = 'reject' | 'request_changes'

function getReviewDecisionStopAction(
  runtimeDetail?: WorkflowRuntimeDetail | null,
  ...values: Array<string | null | undefined>
): ReviewDecisionStopAction | null {
  const directAction = getReviewDecisionStopActionFromValues(...values, runtimeDetail?.status, runtimeDetail?.errorMessage)
  if (directAction) return directAction

  for (const node of runtimeDetail?.nodes ?? []) {
    const nodeAction = getReviewDecisionStopActionFromValues(node.status, node.errorMessage)
    if (nodeAction) return nodeAction
  }
  return null
}

function getReviewDecisionStopActionFromValues(...values: Array<string | null | undefined>): ReviewDecisionStopAction | null {
  for (const value of values) {
    const statusAction = getReviewDecisionActionFromStatus(value)
    if (statusAction) return statusAction

    const textAction = getReviewDecisionActionFromText(value)
    if (textAction) return textAction
  }
  return null
}

function getReviewDecisionActionFromStatus(status: string | null | undefined): ReviewDecisionStopAction | null {
  const normalized = status?.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'rejected' || normalized === 'review_reject' || normalized === 'review_rejected') return 'reject'
  if (
    normalized === 'changes_requested'
    || normalized === 'request_changes'
    || normalized === 'review_request_changes'
    || normalized === 'review_changes_requested'
  ) {
    return 'request_changes'
  }
  return null
}

function getReviewDecisionActionFromText(value: string | null | undefined): ReviewDecisionStopAction | null {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return null
  const match = normalized.match(/review decision stopped workflow:\s*([a-z_]+)/)
  if (match) return getReviewDecisionActionFromStatus(`review_${match[1]}`)
  return null
}

function isReviewDecisionStopStatus(status: string | null | undefined) {
  return Boolean(getReviewDecisionActionFromStatus(status))
}

function formatReviewDecisionStopLabel(action: ReviewDecisionStopAction, t: WorkflowTranslator) {
  return action === 'request_changes' ? t('runs.reviewChangesRequested') : t('runs.reviewRejected')
}

function formatReviewDecisionStopDetail(action: ReviewDecisionStopAction, t: WorkflowTranslator) {
  return action === 'request_changes' ? t('runs.reviewChangesDetail') : t('runs.reviewRejectedDetail')
}

function isParkedLaunchMetadata(run?: {
  metadata?: {
    parked?: boolean
    admission_decision?: string
    park_state?: string
  } | null
  admission?: { decision?: string; state?: string } | null
} | null) {
  const metadata = run?.metadata
  const admission = run?.admission
  return metadata?.parked === true
    || metadata?.admission_decision === 'parked'
    || metadata?.park_state === 'parked'
    || metadata?.park_state === 'failed_balance'
    || metadata?.park_state === 'promoting'
    || admission?.decision === 'parked'
}

function formatQueuedRunLabel(
  status: string,
  run: {
    metadata?: {
      parked?: boolean
      admission_decision?: string
      park_state?: string
      park_expires_at?: string
      queue_position?: number
    } | null
    admission?: { state?: string; park_expires_at?: string | null; queue_position?: number | null } | null
  } | null | undefined,
  t: WorkflowTranslator,
) {
  const parkState = run?.admission?.state ?? run?.metadata?.park_state
  const queuePosition = run?.admission?.queue_position ?? run?.metadata?.queue_position
  const expiresAt = run?.admission?.park_expires_at ?? run?.metadata?.park_expires_at
  if (parkState === 'failed_balance' || status === 'waiting_for_credit' || status === 'failed_balance') {
    return formatParkLabel(t('runs.waitingForCredit'), queuePosition, expiresAt, t)
  }
  if (parkState === 'promoting' || status === 'promoting') {
    return formatParkLabel(t('runs.promoting'), queuePosition, expiresAt, t)
  }
  if (isParkedLaunchMetadata(run) && isQueuedRunStatus(status)) {
    return formatParkLabel(t('runs.parked'), queuePosition, expiresAt, t)
  }
  return t('runs.queued')
}

function formatParkLabel(
  label: string,
  queuePosition: number | null | undefined,
  expiresAt: string | null | undefined,
  t: WorkflowTranslator,
) {
  const parts = [label]
  if (typeof queuePosition === 'number' && Number.isFinite(queuePosition) && queuePosition > 0) {
    parts.push(t('runs.queuePosition', { position: queuePosition }))
  }
  if (expiresAt) {
    parts.push(t('runs.parkExpires', { time: expiresAt }))
  }
  return parts.join(' · ')
}

function formatRunStatus(status: string, pausedReason: string | null | undefined, t: WorkflowTranslator, run?: WorkflowRunProjection | null) {
  const normalized = status.toLowerCase()
  const reviewStopAction = getReviewDecisionActionFromStatus(normalized)
  if (reviewStopAction) return formatReviewDecisionStopLabel(reviewStopAction, t)
  if (isPausedRunStatus(normalized)) return formatPausedRunStatus(pausedReason ?? normalized, t)
  if (normalized === 'expired') return t('runs.expired')
  if (normalized === 'waiting_for_credit' || normalized === 'failed_balance') return t('runs.waitingForCredit')
  if (normalized === 'promoting') return t('runs.promoting')
  if (normalized === 'parked') return formatQueuedRunLabel(normalized, run, t)
  if (normalized === 'launching' || normalized === 'pending') return formatQueuedRunLabel(normalized, run, t)
  if (normalized === 'running' || normalized === 'started' || normalized === 'in_process' || normalized === 'in_progress' || normalized === 'processing' || normalized === 'executing') return t('runs.running')
  if (normalized === 'completed' || normalized === 'success' || normalized === 'succeeded') return t('runs.completed')
  if (isFailedRunStatus(normalized)) return t('runs.failed')
  if (normalized === 'cancelled' || normalized === 'canceled') return t('runs.cancelled')
  if (normalized === 'cancelling') return t('runs.cancelling')
  if (normalized === 'draining') return t('runs.draining')
  if (normalized === 'settlement_pending') return t('runs.settling')
  if (normalized === 'queued') return formatQueuedRunLabel(normalized, run, t)
  if (!normalized) return t('runs.unknown')
  return t('runs.unknown')
}

function isPausedRunStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  return normalized === 'paused'
    || normalized === 'waiting'
    || normalized === 'waiting_for_review'
    || normalized === 'review_required'
    || normalized === 'requires_review'
    || normalized === 'awaiting_review'
    || normalized === 'waiting_for_payment'
    || normalized === 'credit_exhausted'
    || normalized === 'payment_required'
    || normalized === 'insufficient_balance'
    || normalized === 'billing_failed'
}

function formatPausedRunStatus(reason: string | null | undefined, t: WorkflowTranslator) {
  const normalized = reason?.trim().toLowerCase()
  if (normalized === 'payment_risk_pending') return t('runs.paymentReview')
  if (!normalized) return t('runs.paused')
  if (normalized.includes('review') || normalized.includes('approval')) return t('runs.reviewWaiting')
  if (
    normalized.includes('credit')
    || normalized.includes('balance')
    || normalized.includes('payment')
    || normalized.includes('insufficient')
  ) {
    return t('runs.needsCredits')
  }
  if (normalized.includes('billing')) return t('runs.billingPaused')
  return t('runs.paused')
}

function shouldPollRunStatus(status: string | null | undefined) {
  return isActiveRunStatus(status) || isPausedRunStatus(status)
}

function getSelectedRunStatusPollInterval(status: string | null | undefined) {
  if (isPausedRunStatus(status)) return WORKFLOW_PAUSED_STATUS_POLL_INTERVAL_MS
  if (isCancellationLifecycleStatus(status)) return WORKFLOW_CANCELLING_STATUS_POLL_INTERVAL_MS
  return isActiveRunStatus(status) ? WORKFLOW_ACTIVE_STATUS_POLL_INTERVAL_MS : false
}

function getBackgroundRunHistoryPollInterval(
  runs: WorkflowRunProjection[],
  selectedRunWorkflowId: string | null,
) {
  let hasPausedRun = false
  for (const run of runs) {
    if (run.workflow_id === selectedRunWorkflowId) continue
    if (isActiveRunStatus(run.status)) return WORKFLOW_BACKGROUND_ACTIVE_HISTORY_POLL_INTERVAL_MS
    if (isPausedRunStatus(run.status)) hasPausedRun = true
  }
  return hasPausedRun ? WORKFLOW_BACKGROUND_PAUSED_HISTORY_POLL_INTERVAL_MS : false
}

function patchWorkflowRunHistoryStatus(
  current: WorkflowRunHistoryPage | undefined,
  status: WorkflowRuntimeStatus,
) {
  if (!current) return current
  let changed = false
  const items = current.items.map((run) => {
    if (run.workflow_id !== status.workflowId) return run
    const nextErrorMessage = status.errorMessage ?? run.error_message
    const nextActualCredits = status.totalCreditsCharged ?? run.total_actual_credits
    if (
      run.status === status.status
      && run.error_message === nextErrorMessage
      && run.total_actual_credits === nextActualCredits
    ) {
      return run
    }
    changed = true
    return {
      ...run,
      status: status.status,
      error_message: nextErrorMessage,
      total_actual_credits: nextActualCredits,
    }
  })
  return changed ? { ...current, items } : current
}

function shouldRefreshWorkflowsForInboxEvent(event: Event) {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return true
  try {
    const parsed: unknown = JSON.parse(event.data)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return true
    const payload = parsed as { item_type?: unknown; reason?: unknown }
    if (payload.item_type === 'message') return false
    return payload.reason !== 'message_available' && payload.reason !== 'welcome_available'
  } catch {
    return true
  }
}

function formatSettlementStatus(
  status: string | null | undefined,
  reason: string | null | undefined,
  t: WorkflowTranslator,
) {
  const normalized = status?.trim().toLowerCase()
  if (normalized === 'settled' || normalized === 'released') return t('runs.completed')
  if (normalized === 'debt_pending') return t('runs.settlementDebt')
  if (normalized === 'draining') return t('runs.settlementDraining')
  if (normalized === 'reconciliation_required') return t('runs.failed')
  if (normalized === 'settlement_pending') {
    return reason
      ? t('runs.settlementPending', { reason: reason.replaceAll('_', ' ') })
      : t('runs.settlementRefund')
  }
  return normalized ? t('runs.unknown') : t('runs.settlementNotStarted')
}

function formatDurationMs(
  value: number | null | undefined,
  formatter: WorkflowFormatter,
  t: WorkflowTranslator,
) {
  if (!value || value < 0) return '-'
  if (value < 1000) return t('runs.durationMilliseconds', { value: formatter.number(Math.round(value)) })
  const seconds = value / 1000
  if (seconds < 60) {
    return t('runs.durationSeconds', {
      value: formatter.number(seconds, {
        minimumFractionDigits: seconds >= 10 ? 0 : 1,
        maximumFractionDigits: seconds >= 10 ? 0 : 1,
      }),
    })
  }
  return t('runs.durationMinutes', {
    minutes: formatter.number(Math.floor(seconds / 60)),
    seconds: formatter.number(Math.round(seconds % 60)),
  })
}

export const __workflowsPageTestHooks = {
  WorkflowRunDetailsCard,
  WorkflowRunHistoryRow,
  mergeWorkflowRuntimeStatus,
}
