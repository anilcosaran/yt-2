'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'
import { useQueries, type UseQueryOptions } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Film,
  Loader2,
  Maximize2,
  MoreHorizontal,
  PenLine,
  PencilLine,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  Workflow as WorkflowIcon,
  X,
} from 'lucide-react'

import { ChatMarkdown } from '@/components/chat/chat-markdown'
import { hasSparkOpenableResult, useOpenChatResultInSpark } from '@/components/chat/open-in-spark'
import { SparkContinueCard } from '@/components/chat/spark-continue-card'
import { SparkCandidateCard, sparkCandidateCount } from '@/components/chat/spark-candidate-card'
import { ConnectionRequirementCard } from '@/components/chat/connection-requirement-card'
import { readConnectionRequirementMessage } from '@/lib/connector/api'
import { publishConnectionRequirementEvent } from '@/lib/connector/requirement-events'
import { readSparkHandoff } from '@/lib/spark/spark-entry'
import { SkillAuthoringCards } from '@/components/chat/skill-authoring-cards'
import { useProductionG1Open, useProductionPlanShown } from '@/components/chat/production-g1-card'
import { ProductionRunSend, ProductionSuggestions } from '@/components/chat/production-flow'
import { PromptBoxSend } from '@/components/spark/agent/prompt-box'
import { AgentChain, AgentMedia, AgentQuestion, AgentScope, AgentSprite, AgentThinking, AgentTurn, type AgentChainStep, type AgentStepState } from '@/components/spark/agent/agent-thread'
import { VideoProductionCard } from '@/components/chat/video-production-card'
import { ScriptReviewHostProvider, type ScriptReviewHost } from '@/components/chat/script-review/script-review-host'
import { ScriptReviewSidePanel } from '@/components/chat/script-review/script-review-side-panel'
import { FinalRenderJobCard } from '@/components/chat/final-render-card'
import { FullAccessLimitNote } from '@/components/chat/full-access-warning-card'
import { findFullAccessLimitAsk } from '@/lib/assistant/full-access-flow'
import { isProductionG1Reply } from '@/lib/assistant/production-launch-api'
import { readInteractionQuestionOptions } from '@/lib/assistant/interaction-api'
import { readSkillAuthoringCards } from '@/lib/assistant/skill-authoring'
import { classifyAssistantRunFailure, findRunTriggerMessage } from '@/lib/assistant/run-failure'
import { answeredModelLabel, readAnsweredModelId } from '@/lib/assistant/answered-model'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import type { WorkflowCanvasImageModel, WorkflowCanvasSnapshot } from '@/components/workflows/workflow-canvas'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ASSISTANT_CONVERSATIONS_UPDATED_EVENT,
  addAssistantMessage,
  answerAssistantRun,
  continueAssistantRun,
  createAssistantIdempotencyKey,
  createAssistantConversation,
  createAssistantEventSource,
  getAssistantConversation,
  getAssistantRunStatus,
  inferAssistantRunState,
  listAssistantConversationMessages,
  listAssistantRunEvents,
  listAssistantConversations,
  parseAssistantRunEvent,
  parseAssistantRunState,
  resumeAssistantRun,
  shouldApplyAssistantRunEvent,
  shouldApplyAssistantRunStatus,
  stopAssistantRun,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantRunEvent,
  type AssistantRunState,
} from '@/lib/assistant/api'
import {
  readAssistantApprovalTarget,
  type AssistantApprovalTarget,
} from '@/lib/assistant/approval-target'
import { useConversationJobs } from '@/lib/assistant/composer/use-conversation-jobs'
import {
  isTerminalJobState,
  jobLabelFromMessages,
  jobTargetForChoice,
  readAmbiguousJobTarget,
  resolveComposerJobFocus,
  resolveSteerJobTarget,
  type AmbiguousJobCandidate,
  type AmbiguousJobTarget,
  type ComposerJobFocus,
} from '@/lib/assistant/composer/conversation-jobs'
import type { ComposerJobTarget, ComposerReplyTo } from '@/lib/assistant/composer/message-context'
import { ComposerJobFocusChip, JobTargetChoicePanel, type ComposerJobOption } from '@/components/chat/composer/job-target-parts'
import { prepareChatComposerMessage } from '@/lib/assistant/composer/chat-submit'
import { ChatStartGallery, type ChatStartExample, type ChatStartMode } from '@/components/chat/chat-start-gallery'
import { ChatComposer, ChatComposerDialogs } from '@/components/chat/composer/chat-composer'
import { appendComposerToken, useChatComposer } from '@/components/chat/composer/use-chat-composer'
import { clampVideoDurationSeconds, serializeComposerSelection, toWorkflowCanvasImageModel } from '@/components/chat/composer/composer-settings'
import {
  AttachmentKindIcon,
  formatAttachmentMeta,
  getMediaThumbnailUrl,
  inferAttachmentKind,
  isEmbeddableVideoUrl,
  isHlsVideoUrl,
  isImageMediaUrl,
  isVideoMediaUrl,
  isVisualAttachment,
  looksLikeYoutorchMediaUrl,
  type ChatAssetAttachment,
  type ChatAssetKind,
} from '@/components/chat/composer/chat-attachments'
import { getChatCopy, useChatCopy, type ChatCopy, type ChatLocale, type ChatTranslator } from '@/components/chat/chat-copy'
import { ChatInlineAlert } from '@/components/chat/chat-inline-alert'
import { takeNewChatHandoff, type NewChatHandoff } from '@/lib/assistant/composer/new-chat-handoff'
import {
  buildAssistantConversationIdempotencyKey,
  createAssistantMessageAttemptStore,
  createAssistantMessageIdempotencyKey,
  createNewChatIntentId,
  getAssistantMessageAttemptFingerprint,
  getAssistantMessageAttemptScope,
  NEW_CHAT_QUERY_PARAM,
} from '@/lib/assistant/client-intents'
import { isAmbiguousMutationError } from '@/lib/idempotency/client-mutation-control'
import {
  decideReviewRequest,
  getReviewDisplayMessage,
  getReviewDisplayTitle,
  getReviewInboxEventsUrl,
  listReviewItems,
  type ReviewItem,
} from '@/lib/review/api'
import { registerBrowserPrincipalLifecycleResetter } from '@/lib/auth/browser-principal-storage'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { buildWorkflowDefinitionPayload } from '@/lib/workflows/api'
import { buildAssistantDraftFlowsHref, rememberAssistantDraftEdits } from '@/lib/assistant/light-view/assistant-draft-handoff'
import {
  workflowFromAssistantDraft,
  type WorkflowDraftPreviewSource,
} from '@/lib/workflows/dsl-mapper'
import {
  getStorageDeliveryUrls,
  getStorageDownloadUrl,
  getStoragePlaybackUrl,
  storageDeliveryRefreshDelay,
  type DeliveryUrlsBatchResult,
} from '@/lib/storage/api'
import { cn } from '@/lib/utils'
import type { Workflow } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { useLocale, useTranslations } from 'next-intl'


type LiveAssistantDraft = {
  runId: string
  messageDraftId: string | null
  content: string
  lastChunkIndex: number | null
}

type DraftStreamState = {
  runId: string | null
  messageDraftId: string | null
  displayedContent: string
  targetContent: string
  lastChunkIndex: number | null
}

type PaymentWaitInfo = {
  message: string | null
  reason: string | null
}


type WorkflowDraftAttachment = WorkflowDraftPreviewSource & {
  messageId: string
  runId: string | null
  approvalTarget: AssistantApprovalTarget | null
}

type ChatWorkspacePanelContent = {
  kind: 'workflow-draft'
  workflowDraft: WorkflowDraftAttachment
}

type ChatWorkspacePanelState = {
  open: boolean
  width: number
  content: ChatWorkspacePanelContent
}

type MediaPreviewState = {
  assets: ChatAssetAttachment[]
  index: number
}

type QuickQuestionOption = {
  label: string
  value: string
  /** What choosing it means, one line under the label. */
  hint?: string
  recommended?: boolean
}

type PendingQuickQuestion = {
  messageId: string
  prompt: string
  /** The topic of a typed question ("Anlatıcı"), for its chip. */
  chip: string | null
  options: QuickQuestionOption[]
  requiredSlots: string[]
  waitingReason: string | null
}

type PendingRunAction = {
  messageId: string
  prompt: string
  reason: string | null
  toolId: string
  approvalTarget: AssistantApprovalTarget
}

type ActiveRunVisualKind = 'image' | 'video' | 'workflow' | 'agent'

type ActiveRunVisualStep = {
  label: string
  status: 'pending' | 'active' | 'completed' | 'failed'
}

type ActiveRunVisual = {
  kind: ActiveRunVisualKind
  /** How many images / videos the run makes (the frames shown side by side). */
  outputs: number
  title: string
  detail: string | null
  promptPreview: string | null
  aspectRatio: string | null
  providerStrategy: string | null
  progress: number | null
  retryLabel: string | null
  steps: ActiveRunVisualStep[]
}



const TERMINAL_RUN_STATES = new Set<AssistantRunState>(['completed', 'failed', 'cancelled'])
const ACTIVE_RUN_STATES = new Set<AssistantRunState>([
  'created',
  'running',
  'waiting_for_user',
  'waiting_for_approval',
  'waiting_for_payment',
  'waiting_on_agent',
  'waiting_on_workflow',
  'cancelling',
  'draining',
  'cancellation_attention_required',
])
const RUN_POLL_FALLBACK_INTERVAL_MS = 2_500
const RUN_POLL_RECONCILE_INTERVAL_MS = 30_000
const INLINE_REVIEW_POLL_FALLBACK_INTERVAL_MS = 5_000
const INLINE_REVIEW_RECONCILE_INTERVAL_MS = 30_000
const TERMINAL_CONVERSATION_REFRESH_RETRY_DELAYS_MS = [2_500, 5_000, 10_000] as const
const INLINE_REVIEW_EVENT_DEBOUNCE_MS = 250
const DRAFT_REVEAL_INTERVAL_MS = 48
const CHAT_QUERY_PARAM = 'id'
const LEGACY_CHAT_QUERY_PARAM = 'chat'
const CHAT_STORAGE_DELIVERY_BATCH_SIZE = 64
const CHAT_STORAGE_DELIVERY_REFERENCE_LIMIT = 1_024
const CHAT_STORAGE_DELIVERY_PENDING_POLL_MAX_MS = 20 * 60_000
const MEDIA_URL_PATTERN = /https?:\/\/[^\s<>)"']+/gi
const WORKSPACE_PANEL_DEFAULT_WIDTH = 1040
const WORKSPACE_PANEL_MIN_WIDTH = 420
const WORKSPACE_PANEL_MAX_WIDTH = 1280
const WorkflowCanvas = dynamic(
  () => import('@/components/workflows/workflow-canvas').then((mod) => mod.WorkflowCanvas),
  {
    ssr: false,
    loading: () => <WorkflowCanvasLoading />,
  },
)



export default function ChatPage() {
  return (
    <React.Suspense fallback={<ChatWorkspaceLoading />}>
      <ChatWorkspace />
    </React.Suspense>
  )
}

function ChatWorkspaceLoading() {
  return <WorkspaceRouteLoading />
}

function ChatWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeLocale = useLocale()
  const locale: ChatLocale = activeLocale === 'tr' ? 'tr' : 'en'
  const tChat = useTranslations('Chat') as unknown as ChatTranslator
  const copy = React.useMemo(() => getChatCopy(tChat), [tChat])
  const localizeError = useLocalizedError()
  const { activeChannel, activeChannelId, isLoading } = useActiveChannel()
  const [conversation, setConversation] = React.useState<AssistantConversation | null>(null)
  const [messages, setMessages] = React.useState<AssistantMessage[]>([])
  const [optimisticMessages, setOptimisticMessages] = React.useState<AssistantMessage[]>([])
  const [runEvents, setRunEvents] = React.useState<AssistantRunEvent[]>([])
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null)
  const [runState, setRunState] = React.useState<AssistantRunState | null>(null)
  const [liveDraft, setLiveDraft] = React.useState<LiveAssistantDraft | null>(null)
  const [isDraftAnimating, setIsDraftAnimating] = React.useState(false)
  const [liveProgressEvent, setLiveProgressEvent] = React.useState<AssistantRunEvent | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [runConnectionError, setRunConnectionError] = React.useState<string | null>(null)
  const [nextMessageCursor, setNextMessageCursor] = React.useState<string | null>(null)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = React.useState(false)
  const [olderMessagesError, setOlderMessagesError] = React.useState<string | null>(null)
  const [isBooting, setIsBooting] = React.useState(false)
  const [isSending, setIsSending] = React.useState(false)
  const [isActing, setIsActing] = React.useState(false)
  const [pendingInlineReview, setPendingInlineReview] = React.useState<ReviewItem | null>(null)
  const [workspacePanelsByChat, setWorkspacePanelsByChat] = React.useState<Record<string, ChatWorkspacePanelState>>({})
  const messagePageAbortRef = React.useRef<AbortController | null>(null)
  const conversationIdRef = React.useRef<string | null>(null)
  const conversationLoadGenerationRef = React.useRef(0)
  const conversationCreationRef = React.useRef<{
    contextKey: string
    promise: Promise<AssistantConversation>
  } | null>(null)
  const fallbackNewChatIntentIdRef = React.useRef<string | null>(null)
  const sendInFlightRef = React.useRef(false)
  const assistantMessageAttemptStoreRef = React.useRef(createAssistantMessageAttemptStore())
  const stopRunIdempotencyKeysRef = React.useRef(new Map<string, string>())
  const streamRef = React.useRef<EventSource | null>(null)
  const runStreamConnectedRef = React.useRef(false)
  const rescheduleRunPollRef = React.useRef<(() => void) | null>(null)
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const latestRunSequenceRef = React.useRef(0)
  const draftStreamRef = React.useRef<DraftStreamState>(createEmptyDraftStream())
  const draftRevealTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasReceivedLiveDraftDeltaRef = React.useRef(false)
  const requestedConversationId = searchParams.get(CHAT_QUERY_PARAM) ?? searchParams.get(LEGACY_CHAT_QUERY_PARAM)
  const requestedNewChatId = searchParams.get(NEW_CHAT_QUERY_PARAM)
  const conversationChannelId = getString(conversation?.metadata.channel_id)
    ?? getString(conversation?.metadata.channelId)
    ?? activeChannelId
  const conversationContextReady = !isBooting
    && (!requestedConversationId || conversation?.id === requestedConversationId)
  const composerContextKey = requestedConversationId
    ? `conversation:${requestedConversationId}`
    : `new:${requestedNewChatId ?? 'latest'}:${conversationChannelId ?? 'none'}`
  const composerContextKeyRef = React.useRef(composerContextKey)
  // P03-14: the composer's job focus (the live job by default) and a pending ambiguous-target choice, per context.
  const [jobFocusState, setJobFocusState] = React.useState<{ key: string; focus: ComposerJobFocus }>({ key: composerContextKey, focus: { mode: 'auto' } })
  const jobFocus: ComposerJobFocus = jobFocusState.key === composerContextKey ? jobFocusState.focus : { mode: 'auto' }
  const [jobTargetChoiceState, setJobTargetChoiceState] = React.useState<{ key: string; target: AmbiguousJobTarget } | null>(null)
  const jobTargetChoice = jobTargetChoiceState?.key === composerContextKey ? jobTargetChoiceState.target : null
  const backgroundJobEventRef = React.useRef<(() => void) | null>(null)
  const handleBackgroundJobEvent = React.useCallback(() => backgroundJobEventRef.current?.(), [])
  const conversationJobs = useConversationJobs({
    conversationId: conversation?.id ?? null,
    enabled: conversationContextReady,
    focusedJobId: activeRunId,
    onBackgroundEvent: handleBackgroundJobEvent,
  })
  const workspaceKey = requestedConversationId ?? requestedNewChatId ?? conversation?.id ?? 'new'
  const activeWorkspacePanel = workspacePanelsByChat[workspaceKey] ?? null
  const activeWorkflowDraftPreview = activeWorkspacePanel?.content.kind === 'workflow-draft'
    ? activeWorkspacePanel.content.workflowDraft
    : null
  const isWorkspacePanelOpen = Boolean(activeWorkspacePanel?.open && activeWorkflowDraftPreview)

  React.useEffect(() => {
    if (composerContextKeyRef.current === composerContextKey) return
    composerContextKeyRef.current = composerContextKey
    conversationCreationRef.current = null
  }, [composerContextKey])

  React.useEffect(() => () => {
    messagePageAbortRef.current?.abort()
    messagePageAbortRef.current = null
  }, [])

  // The composer resets its own part (text, chips, files, uploads) on the same principal change.
  React.useEffect(() => registerBrowserPrincipalLifecycleResetter(() => {
    messagePageAbortRef.current?.abort()
    messagePageAbortRef.current = null
    streamRef.current?.close()
    streamRef.current = null
    runStreamConnectedRef.current = false
    draftStreamRef.current = createEmptyDraftStream()
    hasReceivedLiveDraftDeltaRef.current = false
    conversationIdRef.current = null
    conversationCreationRef.current = null
    sendInFlightRef.current = false
    assistantMessageAttemptStoreRef.current = createAssistantMessageAttemptStore()
    stopRunIdempotencyKeysRef.current = new Map()
    setWorkspacePanelsByChat({})
    setLiveDraft(null)
    setIsDraftAnimating(false)
    setLiveProgressEvent(null)
    setConversation(null)
    setMessages([])
    setOptimisticMessages([])
    setRunEvents([])
    setActiveRunId(null)
    setRunState(null)
    setError(null)
    setRunConnectionError(null)
  }), [])

  // P03-20: one right panel at a time; the Script panel closes (after its save) when the workflow canvas opens.
  const scriptReviewRef = React.useRef<ScriptReviewHost | null>(null)
  const openWorkflowDraftWorkspace = React.useCallback((workflowDraft: WorkflowDraftAttachment) => {
    scriptReviewRef.current?.requestClose()
    setWorkspacePanelsByChat((current) => {
      const existing = current[workspaceKey]
      return {
        ...current,
        [workspaceKey]: {
          open: true,
          width: existing?.width ?? WORKSPACE_PANEL_DEFAULT_WIDTH,
          content: {
            kind: 'workflow-draft',
            workflowDraft,
          },
        },
      }
    })
  }, [workspaceKey])

  const closeWorkspacePanel = React.useCallback(() => {
    setWorkspacePanelsByChat((current) => {
      const existing = current[workspaceKey]
      if (!existing) return current
      return {
        ...current,
        [workspaceKey]: {
          ...existing,
          open: false,
        },
      }
    })
  }, [workspaceKey])

  const setWorkspacePanelWidth = React.useCallback((width: number) => {
    setWorkspacePanelsByChat((current) => {
      const existing = current[workspaceKey]
      if (!existing) return current
      return {
        ...current,
        [workspaceKey]: {
          ...existing,
          width: clampWorkspacePanelWidth(width),
        },
      }
    })
  }, [workspaceKey])

  // P01A-11: the server-committed planner model of this conversation and of its active job (job id = run id).
  // P03-14: model/mode commands target the composer's focused job (+ new jobs); without one only new jobs change.
  const liveJobId = activeRunId && runState && ACTIVE_RUN_STATES.has(runState) ? activeRunId : null
  const composerJobFocus = resolveComposerJobFocus(jobFocus, { activeJobId: liveJobId, jobs: conversationJobs })
  const plannerSelectedJobId = composerJobFocus.selectedJobId
  const composerJobOptions = React.useMemo<ComposerJobOption[]>(() => {
    const jobs = [...conversationJobs.values()].filter((job) => !isTerminalJobState(job.state))
    if (liveJobId && runState && !jobs.some((job) => job.jobId === liveJobId)) {
      jobs.unshift({ jobId: liveJobId, state: runState, waitingReason: null, updatedAt: null })
    }
    return jobs.map((job) => ({ jobId: job.jobId, state: job.state, label: jobLabelFromMessages(job.jobId, messages) }))
  }, [conversationJobs, liveJobId, messages, runState])

  // P03-01: the composer (text + typed chips, files, settings, the model and the mode); this page adds its run.
  const composer = useChatComposer({
    channelId: conversationChannelId,
    conversationId: conversation?.id ?? null,
    contextKey: composerContextKey,
    ready: conversationContextReady,
    selectedJobId: plannerSelectedJobId,
    onNotice: setError,
  })
  const {
    typedComposer,
    draft,
    setDraft,
    selectedAssets,
    setSelectedAssets,
    appendSelectedAsset,
    outputCount,
    memoryUpload,
    refetchConversationSettings,
    plannerModel,
    commitInitialPlannerModel,
    minVideoDurationSeconds,
    maxVideoDurationSeconds,
  } = composer
  const composerSettings = composer.settings
  const setComposerSettings = composer.setSettings
  const composerCatalog = composer.catalog
  const composerOptions = composer.options
  const composerMode = composer.mode
  const composerTextareaRef = composer.textareaRef
  const composerFormRef = composer.formRef
  const answeredModelLabels = React.useMemo(
    () => new Map(composerOptions.chatModels.map((option) => [option.id, option.label] as const)),
    [composerOptions.chatModels],
  )
  const workflowCanvasImageModels = React.useMemo(
    () => composerOptions.imageModels.map(toWorkflowCanvasImageModel),
    [composerOptions.imageModels],
  )
  const lastModelSwitchEventId = React.useMemo(
    () => [...runEvents].reverse().find((event) => event.event_type.startsWith('assistant.model_switch.'))?.id ?? null,
    [runEvents],
  )
  React.useEffect(() => {
    // The job's boundary activated or refused a switch: re-read the server state.
    if (lastModelSwitchEventId) void refetchConversationSettings()
  }, [lastModelSwitchEventId, refetchConversationSettings])

  const clearDraftRevealTimer = React.useCallback(() => {
    if (!draftRevealTimerRef.current) return
    clearTimeout(draftRevealTimerRef.current)
    draftRevealTimerRef.current = null
  }, [])

  const resetDraftStream = React.useCallback(() => {
    clearDraftRevealTimer()
    draftStreamRef.current = createEmptyDraftStream()
    hasReceivedLiveDraftDeltaRef.current = false
    setLiveDraft(null)
    setIsDraftAnimating(false)
  }, [clearDraftRevealTimer])

  const scheduleDraftReveal = React.useCallback(() => {
    const stream = draftStreamRef.current
    const hasPendingText = hasPendingDraftText(stream)
    setIsDraftAnimating(hasPendingText)
    if (!hasPendingText || draftRevealTimerRef.current) return

    const revealNext = () => {
      draftRevealTimerRef.current = null
      const current = draftStreamRef.current
      if (!current.runId || !hasPendingDraftText(current)) {
        setIsDraftAnimating(false)
        return
      }

      const remaining = current.targetContent.slice(current.displayedContent.length)
      current.displayedContent += takeDraftRevealSlice(remaining)
      setLiveDraft({
        runId: current.runId,
        messageDraftId: current.messageDraftId,
        content: current.displayedContent,
        lastChunkIndex: current.lastChunkIndex,
      })

      if (hasPendingDraftText(current)) {
        setIsDraftAnimating(true)
        draftRevealTimerRef.current = setTimeout(revealNext, DRAFT_REVEAL_INTERVAL_MS)
      } else {
        setIsDraftAnimating(false)
      }
    }

    draftRevealTimerRef.current = setTimeout(revealNext, 0)
  }, [])

  const enqueueDraftDelta = React.useCallback((event: AssistantRunEvent) => {
    const delta = getRawString(event.payload.delta)
    if (delta === null || delta.length === 0) return
    hasReceivedLiveDraftDeltaRef.current = true

    const messageDraftId = getString(event.payload.message_draft_id)
    const chunkIndex = getNumber(event.payload.chunk_index)
    const stream = draftStreamRef.current
    if (isDifferentDraftStream(stream, event.run_id, messageDraftId)) {
      clearDraftRevealTimer()
      draftStreamRef.current = createEmptyDraftStream()
    }

    const current = draftStreamRef.current
    if (chunkIndex !== null && current.lastChunkIndex !== null && chunkIndex <= current.lastChunkIndex) return

    current.runId = event.run_id
    current.messageDraftId = messageDraftId ?? current.messageDraftId
    current.targetContent += delta
    current.lastChunkIndex = chunkIndex ?? current.lastChunkIndex
    scheduleDraftReveal()
  }, [clearDraftRevealTimer, scheduleDraftReveal])

  const syncDraftSnapshot = React.useCallback((event: AssistantRunEvent) => {
    const content = getRawString(event.payload.content_snapshot)
    if (content === null || content.length === 0) return

    const messageDraftId = getString(event.payload.message_draft_id)
    const chunkIndex = getNumber(event.payload.chunk_index)
    const stream = draftStreamRef.current
    if (isDifferentDraftStream(stream, event.run_id, messageDraftId)) {
      clearDraftRevealTimer()
      draftStreamRef.current = createEmptyDraftStream()
    }

    const current = draftStreamRef.current
    if (
      chunkIndex !== null
      && current.lastChunkIndex !== null
      && chunkIndex <= current.lastChunkIndex
      && content.length <= current.targetContent.length
    ) {
      return
    }

    current.runId = event.run_id
    current.messageDraftId = messageDraftId ?? current.messageDraftId
    current.lastChunkIndex = chunkIndex ?? current.lastChunkIndex

    if (hasReceivedLiveDraftDeltaRef.current) {
      current.targetContent = content.length >= current.targetContent.length ? content : current.targetContent
      scheduleDraftReveal()
      return
    }

    current.displayedContent = content.length >= current.displayedContent.length ? content : current.displayedContent
    current.targetContent = current.displayedContent
    clearDraftRevealTimer()
    setLiveDraft({
      runId: current.runId,
      messageDraftId: current.messageDraftId,
      content: current.displayedContent,
      lastChunkIndex: current.lastChunkIndex,
    })
    setIsDraftAnimating(false)
  }, [clearDraftRevealTimer, scheduleDraftReveal])

  React.useEffect(() => {
    conversationIdRef.current = conversation?.id ?? null
  }, [conversation?.id])

  React.useEffect(() => {
    return () => clearDraftRevealTimer()
  }, [clearDraftRevealTimer])

  React.useEffect(() => {
    latestRunSequenceRef.current = runEvents.reduce((max, event) => Math.max(max, event.sequence), 0)
  }, [runEvents])

  const refreshConversation = React.useCallback(async (
    conversationId: string,
    options: { signal?: AbortSignal; generation?: number; replaceMessages?: boolean } = {},
  ) => {
    const detail = await getAssistantConversation(conversationId, { signal: options.signal })
    if (
      options.signal?.aborted
      || (options.generation !== undefined && options.generation !== conversationLoadGenerationRef.current)
    ) return detail
    conversationIdRef.current = detail.conversation.id
    setConversation(detail.conversation)
    if (options.replaceMessages) {
      setMessages(detail.messages)
      setNextMessageCursor(detail.next_message_cursor)
    } else {
      setMessages((current) => mergeMessages(current, detail.messages))
    }
    notifyConversationListChanged()
    return detail
  }, [])

  // P03-14: another job's end, question or message refreshes the transcript (debounced); the focus never moves.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    backgroundJobEventRef.current = () => {
      const conversationId = conversationIdRef.current
      if (!conversationId || timer) return
      timer = setTimeout(() => {
        timer = null
        void refreshConversation(conversationId).catch(() => undefined)
      }, 400)
    }
    return () => {
      if (timer) clearTimeout(timer)
      backgroundJobEventRef.current = null
    }
  }, [refreshConversation])

  React.useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const generation = conversationLoadGenerationRef.current + 1
    conversationLoadGenerationRef.current = generation
    if (requestedConversationId && conversationIdRef.current === requestedConversationId) {
      setIsBooting(false)
      return () => {
        cancelled = true
        controller.abort()
      }
    }

    streamRef.current?.close()
    streamRef.current = null
    messagePageAbortRef.current?.abort()
    messagePageAbortRef.current = null
    conversationIdRef.current = null
    setConversation(null)
    setMessages([])
    setNextMessageCursor(null)
    setIsLoadingOlderMessages(false)
    setOlderMessagesError(null)
    setOptimisticMessages([])
    setRunEvents([])
    latestRunSequenceRef.current = 0
    setActiveRunId(null)
    setRunState(null)
    resetDraftStream()
    setLiveProgressEvent(null)
    setError(null)
    setRunConnectionError(null)

    if (requestedNewChatId) {
      setIsBooting(false)
      return () => {
        cancelled = true
        controller.abort()
      }
    }

    async function hydrateLatestRun(detail: Awaited<ReturnType<typeof refreshConversation>>) {
      const latestRunId = findLatestRunId(detail.messages)
      if (!latestRunId || cancelled) return
      const [status, events] = await Promise.all([
        getAssistantRunStatus(latestRunId, { signal: controller.signal }),
        listAssistantRunEvents({ runId: latestRunId, limit: 500 }, { signal: controller.signal }),
      ])
      if (cancelled || generation !== conversationLoadGenerationRef.current) return
      latestRunSequenceRef.current = events.reduce((max, event) => Math.max(max, event.sequence), 0)
      setRunEvents(events)
      setRunState(status.state)
      setActiveRunId(latestRunId)
    }

    async function loadConversation() {
      setIsBooting(true)
      try {
        if (requestedConversationId) {
          const detail = await refreshConversation(requestedConversationId, {
            signal: controller.signal,
            generation,
            replaceMessages: true,
          })
          if (!cancelled) await hydrateLatestRun(detail)
          return
        }

        if (!activeChannelId) return
        const list = await listAssistantConversations(
          { channelId: activeChannelId, limit: 50, offset: 0 },
          { signal: controller.signal },
        )
        if (cancelled || generation !== conversationLoadGenerationRef.current) return
        const latest = list.conversations
          .filter((item) => {
            const metadataChannelId = getString(item.metadata.channel_id) ?? getString(item.metadata.channelId)
            return metadataChannelId === activeChannelId
          })
          .sort(compareConversationRecency)[0]
        if (!latest) return
        router.replace(chatHref(latest.id))
        const detail = await refreshConversation(latest.id, {
          signal: controller.signal,
          generation,
          replaceMessages: true,
        })
        if (!cancelled) await hydrateLatestRun(detail)
      } catch (loadError) {
        if (!cancelled && !controller.signal.aborted && generation === conversationLoadGenerationRef.current) {
          setError(localizeError(loadError))
        }
      } finally {
        if (!cancelled && generation === conversationLoadGenerationRef.current) setIsBooting(false)
      }
    }

    if (requestedConversationId || activeChannelId) {
      void loadConversation()
    } else {
      setIsBooting(false)
    }

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [activeChannelId, refreshConversation, requestedConversationId, requestedNewChatId, resetDraftStream, router])

  React.useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    if (distanceFromBottom > 160) return
    const frameId = window.requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: liveDraft?.content ? 'auto' : 'smooth' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [messages.length, optimisticMessages.length, runEvents.length, liveDraft?.content, liveProgressEvent?.id])

  React.useEffect(() => {
    resetDraftStream()
    setLiveProgressEvent(null)
  }, [activeRunId, resetDraftStream])

  React.useEffect(() => {
    if (!activeRunId) return
    streamRef.current?.close()
    const source = createAssistantEventSource(activeRunId)
    const refreshController = new AbortController()
    const refreshGeneration = conversationLoadGenerationRef.current
    streamRef.current = source
    runStreamConnectedRef.current = false

    const handleStreamOpen = () => {
      if (streamRef.current !== source) return
      if (runStreamConnectedRef.current) return
      runStreamConnectedRef.current = true
      setRunConnectionError(null)
      rescheduleRunPollRef.current?.()
    }

    const handleStreamError = () => {
      if (streamRef.current !== source) return
      runStreamConnectedRef.current = false
      setRunConnectionError('Live run updates are temporarily unavailable. Status polling will keep trying.')
      rescheduleRunPollRef.current?.()
    }

    const handleDurableRunEvent = (event: Event) => {
      const runEvent = parseAssistantRunEvent((event as MessageEvent).data)
      if (!runEvent || runEvent.run_id !== activeRunId) return
      if (!shouldApplyAssistantRunEvent(latestRunSequenceRef.current, runEvent)) return
      if (runEvent.sequence > 0) latestRunSequenceRef.current = runEvent.sequence
      setRunEvents((current) => mergeRunEvents(current, [runEvent]))
      setLiveProgressEvent(null)

      if (runEvent.event_type === 'message.draft.updated') {
        syncDraftSnapshot(runEvent)
      }
      // P03-18: the connection card re-reads its server state on its run event (single conversation stream).
      if (runEvent.event_type === 'assistant.connection_requirement.updated') publishConnectionRequirementEvent(runEvent.payload)
      const nextState = inferAssistantRunState(runEvent)
      if (nextState) setRunState(nextState)

      if (shouldRefreshConversation(runEvent)) {
        const conversationId = conversationIdRef.current ?? getString(runEvent.payload.conversation_id)
        if (conversationId) {
          void refreshConversation(conversationId, {
            signal: refreshController.signal,
            generation: refreshGeneration,
          }).catch((refreshError) => {
            if (!refreshController.signal.aborted && refreshGeneration === conversationLoadGenerationRef.current) {
              setError(localizeError(refreshError))
            }
          })
        }
      }

      if (nextState && TERMINAL_RUN_STATES.has(nextState)) {
        source.close()
        if (streamRef.current === source) {
          streamRef.current = null
          runStreamConnectedRef.current = false
        }
      }
    }

    const handleTransientRunEvent = (event: Event) => {
      const runEvent = parseAssistantRunEvent((event as MessageEvent).data)
      if (!runEvent || runEvent.run_id !== activeRunId) return
      if (runEvent.event_type === 'assistant.token.delta') {
        enqueueDraftDelta(runEvent)
        return
      }
      setLiveProgressEvent(runEvent)
    }

    source.addEventListener('open', handleStreamOpen)
    source.addEventListener('error', handleStreamError)
    source.addEventListener('run_event', handleDurableRunEvent)
    source.addEventListener('assistant.status.updated', handleDurableRunEvent)
    source.addEventListener('message.draft.updated', handleDurableRunEvent)
    source.addEventListener('message.created', handleDurableRunEvent)
    source.addEventListener('run.started', handleDurableRunEvent)
    source.addEventListener('run.completed', handleDurableRunEvent)
    source.addEventListener('run.failed', handleDurableRunEvent)
    source.addEventListener('run.cancelled', handleDurableRunEvent)
    source.addEventListener('run.cancel_requested', handleDurableRunEvent)
    source.addEventListener('run.cancellation_attention_required', handleDurableRunEvent)
    source.addEventListener('run.waiting_for_user', handleDurableRunEvent)
    source.addEventListener('run.waiting_for_approval', handleDurableRunEvent)
    source.addEventListener('run.waiting_for_payment', handleDurableRunEvent)
    source.addEventListener('run.waiting_on_agent', handleDurableRunEvent)
    source.addEventListener('run.waiting_on_workflow', handleDurableRunEvent)
    source.addEventListener('payment.waiting', handleDurableRunEvent)
    source.addEventListener('payment.resume_failed', handleDurableRunEvent)
    source.addEventListener('workflow_handoff.created', handleDurableRunEvent)
    source.addEventListener('assistant.connection_requirement.updated', handleDurableRunEvent)
    source.addEventListener('assistant.token.delta', handleTransientRunEvent)
    source.addEventListener('assistant.workflow.progress', handleTransientRunEvent)

    return () => {
      refreshController.abort()
      source.removeEventListener('open', handleStreamOpen)
      source.removeEventListener('error', handleStreamError)
      source.close()
      if (streamRef.current === source) {
        streamRef.current = null
        runStreamConnectedRef.current = false
      }
    }
  }, [activeRunId, enqueueDraftDelta, refreshConversation, syncDraftSnapshot])

  React.useEffect(() => {
    if (!runState || !TERMINAL_RUN_STATES.has(runState)) return
    if (activeRunId) stopRunIdempotencyKeysRef.current.delete(activeRunId)
    streamRef.current?.close()
    streamRef.current = null
    runStreamConnectedRef.current = false
  }, [activeRunId, runState])

  React.useEffect(() => {
    if (!activeRunId || !runState || !TERMINAL_RUN_STATES.has(runState)) return
    const conversationId = conversation?.id ?? conversationIdRef.current ?? requestedConversationId
    if (!conversationId) return

    let cancelled = false
    const controller = new AbortController()
    const refreshGeneration = conversationLoadGenerationRef.current
    let retryIndex = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const refreshTerminalConversation = async () => {
      try {
        await refreshConversation(conversationId, {
          signal: controller.signal,
          generation: refreshGeneration,
        })
      } catch (refreshError) {
        if (cancelled || controller.signal.aborted || refreshGeneration !== conversationLoadGenerationRef.current) return
        const retryDelay = TERMINAL_CONVERSATION_REFRESH_RETRY_DELAYS_MS[retryIndex]
        retryIndex += 1
        if (retryDelay === undefined) {
          setError(localizeError(refreshError))
          return
        }
        timeoutId = setTimeout(() => {
          timeoutId = null
          void refreshTerminalConversation()
        }, retryDelay)
      }
    }

    void refreshTerminalConversation()
    return () => {
      cancelled = true
      controller.abort()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [activeRunId, conversation?.id, refreshConversation, requestedConversationId, runState])

  React.useEffect(() => {
    if (!activeRunId || (runState && TERMINAL_RUN_STATES.has(runState))) return
    let cancelled = false
    const controller = new AbortController()
    const refreshGeneration = conversationLoadGenerationRef.current
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let polling = false
    let pollQueued = false

    const clearScheduledPoll = () => {
      if (!timeoutId) return
      clearTimeout(timeoutId)
      timeoutId = null
    }

    const nextPollDelay = () => (
      runStreamConnectedRef.current
        ? RUN_POLL_RECONCILE_INTERVAL_MS
        : RUN_POLL_FALLBACK_INTERVAL_MS
    )

    const schedulePoll = () => {
      clearScheduledPoll()
      if (cancelled || document.visibilityState !== 'visible') return
      timeoutId = setTimeout(() => {
        timeoutId = null
        void pollRun()
      }, nextPollDelay())
    }

    async function pollRun() {
      if (!activeRunId || cancelled || document.visibilityState !== 'visible') return
      if (polling) {
        pollQueued = true
        return
      }

      polling = true
      let terminal = false
      try {
        const afterSequence = latestRunSequenceRef.current
        const [status, events] = await Promise.all([
          getAssistantRunStatus(activeRunId, { signal: controller.signal }),
          listAssistantRunEvents(
            { runId: activeRunId, afterSequence, limit: 500 },
            { signal: controller.signal },
          ),
        ])
        if (cancelled || controller.signal.aborted || refreshGeneration !== conversationLoadGenerationRef.current) return

        setRunConnectionError(null)
        const statusSequenceFenceIntact = shouldApplyAssistantRunStatus(
          afterSequence,
          latestRunSequenceRef.current,
        )
        if (statusSequenceFenceIntact) setRunState(status.state)
        const freshEvents = events.filter((event) => {
          if (event.run_id !== activeRunId) return false
          if (!shouldApplyAssistantRunEvent(latestRunSequenceRef.current, event)) return false
          if (event.sequence > 0) latestRunSequenceRef.current = event.sequence
          return true
        })
        if (freshEvents.length > 0) {
          setRunEvents((current) => mergeRunEvents(current, freshEvents))
          for (const event of freshEvents) {
            if (event.event_type === 'message.draft.updated') {
              syncDraftSnapshot(event)
            }
          }
        }

        const shouldRefresh = freshEvents.some(shouldRefreshConversation) || TERMINAL_RUN_STATES.has(status.state)
        terminal = TERMINAL_RUN_STATES.has(status.state)
        if (shouldRefresh) {
          await refreshConversation(status.conversation_id, {
            signal: controller.signal,
            generation: refreshGeneration,
          })
        }
      } catch {
        // The active transport decides whether the next attempt is a fast fallback or a slow reconciliation.
        if (!cancelled && !controller.signal.aborted) {
          setRunConnectionError('Run status is temporarily unavailable. Retrying with bounded backoff.')
        }
      } finally {
        polling = false
        if (cancelled || terminal || document.visibilityState !== 'visible') return
        if (pollQueued) {
          pollQueued = false
          void pollRun()
          return
        }
        schedulePoll()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        pollQueued = false
        clearScheduledPoll()
        return
      }
      void pollRun()
    }

    const rescheduleForTransport = () => {
      if (!polling) schedulePoll()
    }

    rescheduleRunPollRef.current = rescheduleForTransport
    document.addEventListener('visibilitychange', handleVisibilityChange)
    schedulePoll()

    return () => {
      cancelled = true
      controller.abort()
      clearScheduledPoll()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (rescheduleRunPollRef.current === rescheduleForTransport) {
        rescheduleRunPollRef.current = null
      }
    }
  }, [activeRunId, refreshConversation, runState, syncDraftSnapshot])

  React.useEffect(() => {
    if (!activeRunId) return
    const latestDraftEvent = findLatestDraftSnapshotEvent(runEvents, activeRunId)
    if (latestDraftEvent) syncDraftSnapshot(latestDraftEvent)
  }, [activeRunId, runEvents, syncDraftSnapshot])

  const visibleMessages = React.useMemo(() => mergeMessages(messages, optimisticMessages), [messages, optimisticMessages])
  const chatContentReady = !isLoading && !isBooting
  const rawActiveRun = Boolean(activeRunId && runState && ACTIVE_RUN_STATES.has(runState))
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('youtorch:assistant-active-run-updated', {
      detail: {
        conversationId: conversation?.id ?? conversationIdRef.current ?? requestedConversationId,
        active: rawActiveRun,
      },
    }))
  }, [conversation?.id, rawActiveRun, requestedConversationId])
  const pendingQuestion = React.useMemo(
    () => findPendingQuickQuestion(visibleMessages, runState, locale, copy),
    [copy, locale, runState, visibleMessages],
  )
  const pendingRunAction = React.useMemo(
    () => findPendingRunAction(visibleMessages, runState),
    [runState, visibleMessages],
  )

  const paymentWait = React.useMemo(() => {
    if (runState !== 'waiting_for_payment') return null
    return findLatestPaymentWait(runEvents)
  }, [runEvents, runState])

  const refreshPendingInlineReview = React.useCallback(async () => {
    const conversationId = conversation?.id ?? conversationIdRef.current ?? requestedConversationId
    const threadIds = buildAssistantReviewThreadIds(activeRunId, conversationId)
    if (threadIds.length === 0) {
      setPendingInlineReview(null)
      return
    }

    for (const threadId of threadIds) {
      const response = await listReviewItems({
        type: 'request',
        status: 'pending',
        visibility: 'active',
        // Surface-independent resume (P01-12, PR #313): include_hidden + thread_id is
        // enough to find a request even after the watchdog promoted it to the inbox.
        includeHidden: true,
        threadId,
        limit: 5,
      })
      const match = response.data.find((item) => isAssistantInlineReviewItem(item, activeRunId, conversationId))
      if (match) {
        setPendingInlineReview(match)
        return
      }
    }

    setPendingInlineReview(null)
  }, [activeRunId, conversation?.id, requestedConversationId])

  React.useEffect(() => {
    const conversationId = conversation?.id ?? conversationIdRef.current ?? requestedConversationId
    const shouldPoll = Boolean(
      buildAssistantReviewThreadIds(activeRunId, conversationId).length > 0
      && runState
      && !TERMINAL_RUN_STATES.has(runState),
    )
    if (!shouldPoll) {
      setPendingInlineReview(null)
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let scheduledKind: 'event' | 'reconcile' | null = null
    let pollInFlight = false
    let pollQueued = false
    let dirtyWhileHidden = false
    let reviewStreamConnected = false
    let reviewSource: EventSource | null = null

    const clearScheduledRefresh = () => {
      if (!timeoutId) return
      clearTimeout(timeoutId)
      timeoutId = null
      scheduledKind = null
    }

    const nextReconcileDelay = () => (
      reviewStreamConnected
        ? INLINE_REVIEW_RECONCILE_INTERVAL_MS
        : INLINE_REVIEW_POLL_FALLBACK_INTERVAL_MS
    )

    const scheduleRefresh = (delay: number, kind: 'event' | 'reconcile') => {
      clearScheduledRefresh()
      if (cancelled || document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        return
      }
      scheduledKind = kind
      timeoutId = setTimeout(() => {
        timeoutId = null
        scheduledKind = null
        void pollReview()
      }, delay)
    }

    async function pollReview() {
      if (cancelled) return
      if (document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        clearScheduledRefresh()
        return
      }
      if (pollInFlight) {
        pollQueued = true
        return
      }

      pollInFlight = true
      let refreshFailed = false
      try {
        await refreshPendingInlineReview()
      } catch {
        refreshFailed = true
        // Review polling is a secondary surface; the normal run poll remains authoritative.
      } finally {
        pollInFlight = false
        if (cancelled || document.visibilityState !== 'visible') return
        if (pollQueued) {
          pollQueued = false
          scheduleRefresh(INLINE_REVIEW_EVENT_DEBOUNCE_MS, 'event')
          return
        }
        scheduleRefresh(
          refreshFailed ? INLINE_REVIEW_POLL_FALLBACK_INTERVAL_MS : nextReconcileDelay(),
          'reconcile',
        )
      }
    }

    const requestEventRefresh = () => {
      if (document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        clearScheduledRefresh()
        return
      }
      if (pollInFlight) {
        pollQueued = true
        return
      }
      if (scheduledKind === 'event') return
      scheduleRefresh(INLINE_REVIEW_EVENT_DEBOUNCE_MS, 'event')
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        pollQueued = false
        clearScheduledRefresh()
        return
      }
      if (!dirtyWhileHidden) return
      dirtyWhileHidden = false
      scheduleRefresh(0, 'event')
    }

    const handleReviewStreamOpen = () => {
      if (reviewStreamConnected) return
      reviewStreamConnected = true
      if (!pollInFlight && scheduledKind !== 'event') {
        scheduleRefresh(INLINE_REVIEW_RECONCILE_INTERVAL_MS, 'reconcile')
      }
    }

    const handleReviewStreamError = () => {
      const wasConnected = reviewStreamConnected
      reviewStreamConnected = false
      if (wasConnected && !pollInFlight && scheduledKind !== 'event') {
        scheduleRefresh(INLINE_REVIEW_POLL_FALLBACK_INTERVAL_MS, 'reconcile')
      }
    }

    if (typeof window.EventSource !== 'undefined') {
      reviewSource = new EventSource(getReviewInboxEventsUrl(), { withCredentials: true })
      reviewSource.addEventListener('open', handleReviewStreamOpen)
      reviewSource.addEventListener('error', handleReviewStreamError)
      reviewSource.addEventListener('inbox', requestEventRefresh)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    void pollReview()

    return () => {
      cancelled = true
      clearScheduledRefresh()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      reviewSource?.removeEventListener('open', handleReviewStreamOpen)
      reviewSource?.removeEventListener('error', handleReviewStreamError)
      reviewSource?.removeEventListener('inbox', requestEventRefresh)
      reviewSource?.close()
    }
  }, [activeRunId, conversation?.id, refreshPendingInlineReview, requestedConversationId, runState])

  const activeDraftContent = React.useMemo(() => {
    return liveDraft?.runId === activeRunId ? liveDraft.content : ''
  }, [activeRunId, liveDraft])

  const hasFinalAssistantMessage = React.useMemo(() => {
    if (!activeRunId) return false
    return messages.some((message) => (
      message.role === 'assistant'
      && message.run_id === activeRunId
      && !isAssistantControlMessage(message)
    ))
  }, [activeRunId, messages])

  const activeRun = rawActiveRun && !hasFinalAssistantMessage
  const productionG1Open = useProductionG1Open(activeRunId)
  // Once the job has a plan its flow (plan card, then tasks) tells what the run does; no second narration line.
  const productionPlanShown = useProductionPlanShown(activeRunId)
  // The composer's own conditions (a channel, a loaded context, content, no upload, a known committed model).
  const canSubmit = composer.canSubmit && !isSending

  // A new chat started on the new tab (`/chat?new=<intent>`): its composer comes back here and is sent once, through
  // the usual send, as the first message; a send that fails puts the content back in the composer as always.
  const restoreComposer = composer.restore
  const handoffSendRef = React.useRef<{ intentId: string; state: NewChatHandoff['state'] } | null>(null)
  React.useEffect(() => {
    if (!requestedNewChatId || !conversationChannelId) return
    const handoff = takeNewChatHandoff(requestedNewChatId)
    if (!handoff) return
    restoreComposer(handoff)
    handoffSendRef.current = { intentId: requestedNewChatId, state: handoff.state }
  }, [conversationChannelId, requestedNewChatId, restoreComposer])
  const composerState = typedComposer.state
  React.useEffect(() => {
    const pending = handoffSendRef.current
    if (!requestedNewChatId || pending?.intentId !== requestedNewChatId) return
    // Only once the restored content is the rendered one: the submit sends what this render holds.
    if (composerState !== pending.state) return
    if (!conversationContextReady || !composerCatalog || !canSubmit) return
    handoffSendRef.current = null
    composerFormRef.current?.requestSubmit()
  }, [canSubmit, composerCatalog, composerFormRef, composerState, conversationContextReady, requestedNewChatId])

  const showDraftMessage = Boolean(
    activeRunId
    && activeDraftContent.trim().length > 0
    && (!hasFinalAssistantMessage || isDraftAnimating),
  )
  const renderedMessages = React.useMemo(() => {
    const baseMessages = showDraftMessage && activeRunId
      ? visibleMessages.filter((message) => !(message.role === 'assistant' && message.run_id === activeRunId))
      : visibleMessages
    return baseMessages.filter((message) => !isAssistantControlMessage(message))
  }, [activeRunId, showDraftMessage, visibleMessages])
  // Y1-02: the messages that end a turn carry that turn's receipt line; a limit question names the user's own Full access limit.
  const fullAccessLimitAsk = React.useMemo(() => findFullAccessLimitAsk(messages, activeRunId, runState), [activeRunId, messages, runState])
  const chatAttachmentDeliveryUrls = useChatAttachmentDeliveryUrls(
    renderedMessages,
    conversationChannelId,
  )
  const latestNarrationEvent = React.useMemo(
    () => findLatestNarrationEvent(runEvents, liveProgressEvent, activeRunId, tChat),
    [activeRunId, liveProgressEvent, runEvents, tChat],
  )
  const activeRunVisual = React.useMemo(
    () => buildActiveRunVisual({
      events: runEvents,
      liveEvent: liveProgressEvent,
      activeRunId,
      messages: visibleMessages,
      t: tChat,
    }),
    [activeRunId, liveProgressEvent, runEvents, tChat, visibleMessages],
  )
  const progressCopy = React.useMemo(
    () => getProgressCopy({ state: runState, event: latestNarrationEvent, t: tChat, hasDraft: showDraftMessage }),
    [latestNarrationEvent, runState, showDraftMessage, tChat],
  )
  const runFailure = React.useMemo(() => {
    if (runState !== 'failed' || !activeRunId || hasFinalAssistantMessage) return null
    return getRunFailureCopy(runEvents, activeRunId, tChat)
  }, [activeRunId, hasFinalAssistantMessage, runEvents, runState, tChat])
  const [replanPending, setReplanPending] = React.useState(false)

  /**
   * S12: "prepare the plan again without this skill" — the failed job's own request is sent again as a new job. The
   * server's runtime selection already leaves the revoked/disabled skill out; the new plan is a normal, visible turn in
   * the conversation's mode (no silent server re-plan, no second hidden paid call).
   */
  async function replanWithoutRemovedSkill() {
    if (!activeRunId || replanPending) return
    const trigger = findRunTriggerMessage(messages, activeRunId)
    if (!trigger) return
    setReplanPending(true)
    try {
      await sendUserMessage({
        content: trigger.content,
        attachments: hydrateChatAttachments(extractMessageAttachments(trigger), conversationChannelId, chatAttachmentDeliveryUrls),
        restoreComposerOnError: false,
      })
    } finally {
      setReplanPending(false)
    }
  }

  function ensureConversation(initialMessage?: string): Promise<AssistantConversation> {
    if (conversation) return Promise.resolve(conversation)
    if (requestedConversationId) return Promise.reject(new Error('Conversation is still loading. Please try again.'))
    if (!activeChannelId) return Promise.reject(new Error(copy.channelMissing))

    const newChatIntentId = requestedNewChatId
      ?? fallbackNewChatIntentIdRef.current
      ?? createNewChatIntentId()
    fallbackNewChatIntentIdRef.current = newChatIntentId
    const creationContextKey = `${activeChannelId}:${newChatIntentId}`
    const existingRequest = conversationCreationRef.current
    if (existingRequest?.contextKey === creationContextKey) return existingRequest.promise

    const request = createAssistantConversation({
      title: createConversationTitle(initialMessage, activeChannel?.name),
      metadata: {
        channel_id: activeChannelId,
        channel_name: activeChannel?.name ?? null,
      },
      idempotencyKey: buildAssistantConversationIdempotencyKey(newChatIntentId, activeChannelId),
    }).then((created) => {
      if (conversationCreationRef.current?.promise !== request) return created
      conversationIdRef.current = created.id
      setConversation(created)
      notifyConversationListChanged()
      router.replace(chatHref(created.id))
      return created
    })
    conversationCreationRef.current = { contextKey: creationContextKey, promise: request }
    void request.catch(() => {
      if (conversationCreationRef.current?.promise === request) {
        conversationCreationRef.current = null
      }
    })
    return request
  }

  async function sendUserMessage(input: {
    content: string
    attachments?: ChatAssetAttachment[]
    restoreComposerOnError?: boolean
    /** P03-14: an explicit target (a choice after an ambiguous reply); otherwise the server resolves it. */
    jobTarget?: ComposerJobTarget | null
    replyTo?: ComposerReplyTo | null
  }) {
    const trimmedContent = input.content.trim()
    const attachments = input.attachments ?? []
    // P03-01: the typed chips travel with the text; on failure the exact composer state (same chip refs) comes back.
    const composerSnapshot = typedComposer.state
    const targetChannelId = conversationChannelId
    if (
      (!trimmedContent && attachments.length === 0 && composerSnapshot.chips.length === 0)
      || !targetChannelId
      || !conversationContextReady
      || sendInFlightRef.current
      || isSending
    ) return
    const content = trimmedContent || tChat('prompts.attachedMedia')
    const composerSelection = serializeComposerSelection(
      composerSettings,
      composerCatalog,
      composerOptions,
      conversation ? plannerModel.selectedModelId : null,
    )
    sendInFlightRef.current = true
    // QA-078: the chosen (or message-named) count travels once, with this message; the pick clears like the chips.
    const outputCountPick = outputCount.pick
    const requestedCount = outputCount.resolveFor(trimmedContent).requestedCount

    const optimisticMessage = createOptimisticUserMessage({
      conversationId: conversation?.id ?? requestedConversationId,
      content,
      attachments,
    })
    typedComposer.reset()
    outputCount.restore(null)
    setSelectedAssets([])
    memoryUpload.clearSummary()
    setOptimisticMessages((current) => mergeMessages(current, [optimisticMessage]))
    setIsSending(true)
    setError(null)
    resetDraftStream()
    setLiveProgressEvent(null)
    let messageAttemptScope: string | null = null
    let messageAttemptIdempotencyKey: string | null = null
    let composerRejection: string | null = null
    try {
      // QA-081 "Düzelt": the message steers the focused running job, fenced with its current version; no new job.
      const steer = !input.jobTarget && composerJobFocus.steerJobId
        ? await resolveSteerJobTarget({
          jobId: composerJobFocus.steerJobId,
          knownVersion: conversationJobs.get(composerJobFocus.steerJobId)?.jobVersion,
          readStatus: (jobId) => getAssistantRunStatus(jobId),
        })
        : null
      if (steer && !steer.ok) {
        composerRejection = tChat(steer.reason === 'job_ended' ? 'typedComposer.jobs.fixEnded' : 'typedComposer.jobs.fixUnknown')
        throw new Error(composerRejection)
      }
      // P03-01 normalized submit: one assistant_message_context_v1 payload (attachments as Storage refs).
      const prepared = await prepareChatComposerMessage({
        surface: 'dashboard_chat',
        channelId: targetChannelId,
        locale: detectTextLocale(content),
        state: { ...composerSnapshot, text: trimmedContent },
        attachments,
        selection: composerSelection,
        mode: composerMode.value,
        requestedCount,
        // P03-14: a new message is never a global supersede; only an explicit choice names a job.
        jobTarget: input.jobTarget ?? (steer?.ok ? steer.jobTarget : null) ?? (composerJobFocus.explicitNewJob ? { relation: 'new_job' } : null),
        replyTo: input.replyTo ?? null,
        fallbackContent: tChat('prompts.attachedMedia'),
        t: tChat,
      })
      if (!prepared.ok) {
        composerRejection = prepared.message
        throw new Error(prepared.message)
      }
      const createsConversation = !conversation
      const targetConversation = await ensureConversation(content)
      if (createsConversation && composerSelection.model_id) {
        await commitInitialPlannerModel(targetConversation.id, composerSelection.model_id)
      }
      if (createsConversation) {
        const committedMode = await composerMode.commitInitialMode(targetConversation.id)
        prepared.bodySelection.mode = committedMode
        if (prepared.contentJson.composer_selection) prepared.contentJson.composer_selection.mode = committedMode
      }
      const contentJson = prepared.contentJson
      messageAttemptScope = getAssistantMessageAttemptScope(targetConversation.id)
      const messageAttemptFingerprint = getAssistantMessageAttemptFingerprint({
        content: prepared.content,
        contentJson,
        modelId: composerSelection.model_id,
        composerSelection: prepared.bodySelection,
      })
      const existingAttempt = assistantMessageAttemptStoreRef.current.find(
        messageAttemptScope,
        messageAttemptFingerprint,
      )
      const messageAttempt = existingAttempt ?? assistantMessageAttemptStoreRef.current.save({
        scope: messageAttemptScope,
        fingerprint: messageAttemptFingerprint,
        idempotencyKey: createAssistantMessageIdempotencyKey(),
        payload: { conversationId: targetConversation.id },
      })
      messageAttemptIdempotencyKey = messageAttempt.idempotencyKey
      const append = await addAssistantMessage({
        conversationId: targetConversation.id,
        content: prepared.content,
        contentJson,
        modelId: composerSelection.model_id,
        composerSelection: prepared.bodySelection,
        idempotencyKey: messageAttempt.idempotencyKey,
      })
      assistantMessageAttemptStoreRef.current.clear(messageAttemptScope, messageAttempt.idempotencyKey)
      setOptimisticMessages((current) => current.filter((message) => message.id !== optimisticMessage.id))
      // P03-09: the message answered the open G1 plan (no new job); the job's card shows the echo or the question.
      if (isProductionG1Reply(append)) return
      setMessages((current) => mergeMessages(current, [append.message]))
      setRunEvents([append.event])
      setActiveRunId(append.run.id)
      setRunState(append.run.state)
      setJobTargetChoiceState(null)
      // QA-081: a sent correction returns the composer to following the live (steered) job.
      if (steer?.ok) setJobFocusState({ key: composerContextKey, focus: { mode: 'auto' } })
      notifyConversationListChanged()
    } catch (sendError) {
      if (
        messageAttemptScope
        && messageAttemptIdempotencyKey
        && !isAmbiguousMutationError(sendError)
      ) {
        assistantMessageAttemptStoreRef.current.clear(messageAttemptScope, messageAttemptIdempotencyKey)
      }
      setOptimisticMessages((current) => current.filter((message) => message.id !== optimisticMessage.id))
      if (input.restoreComposerOnError !== false) {
        typedComposer.reset(composerSnapshot)
        outputCount.restore(outputCountPick)
        setSelectedAssets(attachments)
      }
      const ambiguousTarget = composerRejection ? null : readAmbiguousJobTarget(sendError)
      if (ambiguousTarget) setJobTargetChoiceState({ key: composerContextKey, target: ambiguousTarget })
      else setError(composerRejection ?? localizeError(sendError))
    } finally {
      sendInFlightRef.current = false
      setIsSending(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // A question waits on the composer: what is written here is the user's own answer to it ("Kendi cevabım").
    if (pendingQuestion && pendingQuestion.requiredSlots.length < 2 && draft.trim() && selectedAssets.length === 0) {
      const answer = draft.trim()
      setDraft('')
      await submitQuickQuestionReply(pendingQuestion, answer, { own_answer: true })
      return
    }
    await sendUserMessage({
      content: draft,
      attachments: selectedAssets,
    })
  }

  /** P03-14: the user picked the job an ambiguous message belongs to; the same composer content is resent to it. */
  async function handleJobTargetChoice(choice: AmbiguousJobCandidate | 'new_job') {
    const target = jobTargetForChoice(choice)
    setJobTargetChoiceState(null)
    await sendUserMessage({ content: draft, attachments: selectedAssets, jobTarget: target.jobTarget, replyTo: target.replyTo })
  }

  function jobChoiceLabel(candidate: AmbiguousJobCandidate) {
    const prompt = messages.find((message) => message.id === candidate.promptMessageId)?.content.replace(/\s+/gu, ' ').trim()
    if (prompt) return prompt.length > 48 ? `${prompt.slice(0, 47).trimEnd()}…` : prompt
    return jobLabelFromMessages(candidate.jobId, messages)
  }

  async function submitQuickQuestionReply(
    question: PendingQuickQuestion,
    content: string,
    extraContentJson: Record<string, unknown>,
  ) {
    if (!activeRunId || sendInFlightRef.current || isSending) return
    const contentJson = {
      quick_question: {
        question_message_id: question.messageId,
        required_slots: question.requiredSlots,
        waiting_reason: question.waitingReason,
        ...extraContentJson,
      },
    }
    const scope = `assistant-answer:${activeRunId}:${question.messageId}`
    const fingerprint = getAssistantMessageAttemptFingerprint({
      content,
      contentJson,
    })
    const existingAttempt = assistantMessageAttemptStoreRef.current.find(scope, fingerprint)
    const attempt = existingAttempt ?? assistantMessageAttemptStoreRef.current.save({
      scope,
      fingerprint,
      idempotencyKey: createAssistantMessageIdempotencyKey(),
      payload: { conversationId: conversation?.id ?? requestedConversationId ?? '' },
    })
    const optimisticMessage = createOptimisticUserMessage({
      conversationId: conversation?.id ?? requestedConversationId,
      content,
      attachments: [],
    })
    sendInFlightRef.current = true
    setIsSending(true)
    setError(null)
    setOptimisticMessages((current) => mergeMessages(current, [optimisticMessage]))
    try {
      const answered = await answerAssistantRun({
        runId: activeRunId,
        questionMessageId: question.messageId,
        content,
        contentJson,
        idempotencyKey: attempt.idempotencyKey,
      })
      assistantMessageAttemptStoreRef.current.clear(scope, attempt.idempotencyKey)
      setOptimisticMessages((current) => current.filter((message) => message.id !== optimisticMessage.id))
      setMessages((current) => mergeMessages(current, [answered.message]))
      setRunEvents((current) => mergeRunEvents(current, [answered.event]))
      setRunState(answered.run.state)
    } catch (answerError) {
      if (!isAmbiguousMutationError(answerError)) {
        assistantMessageAttemptStoreRef.current.clear(scope, attempt.idempotencyKey)
      }
      setOptimisticMessages((current) => current.filter((message) => message.id !== optimisticMessage.id))
      setError(localizeError(answerError))
    } finally {
      sendInFlightRef.current = false
      setIsSending(false)
    }
  }

  async function handleQuickQuestionAnswer(question: PendingQuickQuestion, option: QuickQuestionOption) {
    await submitQuickQuestionReply(question, option.value, { selected_label: option.label })
  }

  // TK-37: every missing required field is asked together, once, in a single multi-field
  // form; this sends all of them back in one reply instead of one question per field/turn.
  async function handleRequiredFieldsSubmit(question: PendingQuickQuestion, answers: Record<string, string>) {
    const content = question.requiredSlots
      .map((key) => `${humanizeRequiredFieldKey(key)}: ${answers[key]?.trim() ?? ''}`)
      .join('; ')
    await submitQuickQuestionReply(question, content, { answers })
  }

  async function handleContinueRunAction() {
    if (!activeRunId || !pendingRunAction || isActing) return
    setIsActing(true)
    setError(null)
    try {
      const continued = await continueAssistantRun({
        runId: activeRunId,
        approvalTargetType: pendingRunAction.approvalTarget.type,
        approvalTargetId: pendingRunAction.approvalTarget.id,
        approvalTargetHash: pendingRunAction.approvalTarget.hash,
      })
      setRunState(continued.state)
      const event = continued.event
      if (event) setRunEvents((current) => mergeRunEvents(current, [event]))
    } catch (continueError) {
      setError(localizeError(continueError))
    } finally {
      setIsActing(false)
    }
  }

  const handleRunWorkflowDraft = React.useCallback(async (workflowDraft: WorkflowDraftAttachment) => {
    const targetRunId = workflowDraft.runId ?? activeRunId
    const approvalTarget = workflowDraft.approvalTarget
    if (!targetRunId || !approvalTarget || isActing) return
    setIsActing(true)
    setError(null)
    try {
      const continued = await continueAssistantRun({
        runId: targetRunId,
        approvalTargetType: approvalTarget.type,
        approvalTargetId: approvalTarget.id,
        approvalTargetHash: approvalTarget.hash,
      })
      setActiveRunId(targetRunId)
      setRunState(continued.state)
      const event = continued.event
      if (event) setRunEvents((current) => mergeRunEvents(current, [event]))
      closeWorkspacePanel()
    } catch (continueError) {
      setError(localizeError(continueError))
    } finally {
      setIsActing(false)
    }
  }, [activeRunId, closeWorkspacePanel, isActing])

  function handleOpenWorkflowDraftInFlows(workflowDraft: WorkflowDraftAttachment) {
    // P03-16: server-ref handoff (conversation + message); unsaved canvas edits travel only in this tab's memory.
    const conversationId = conversation?.id ?? conversationIdRef.current
    if (!conversationId) return
    const ref = { conversationId, messageId: workflowDraft.messageId }
    rememberAssistantDraftEdits(ref, workflowFromAssistantDraft(workflowDraft))
    router.push(buildAssistantDraftFlowsHref(ref))
  }

  /** SV: a card action puts its typed message into the composer; the user reads it, completes it and sends it. */
  const askInComposer = React.useCallback((text: string) => {
    setDraft(text)
    window.requestAnimationFrame(() => composerTextareaRef.current?.focus())
  }, [composerTextareaRef, setDraft])

  const handleEditMediaAsset = React.useCallback((asset: ChatAssetAttachment) => {
    // P03-01: only a Storage object can be attached (owner ref); a bare media URL goes into the text the user sends.
    const bareUrl = asset.objectId ? null : persistableChatUrl(asset.url)
    const label = bareUrl ? null : appendSelectedAsset(asset, { insertToken: false })
    setDraft((current) => {
      const base = current.trim() ? current : tChat('prompts.editImage')
      const withUrl = bareUrl && !base.includes(bareUrl) ? `${base} ${bareUrl}` : base
      return label ? appendComposerToken(withUrl, `@${label}`) : withUrl
    })
    window.requestAnimationFrame(() => composerTextareaRef.current?.focus())
  }, [appendSelectedAsset, composerTextareaRef, setDraft, tChat])

  async function handleStop() {
    if (!activeRunId || isActing || isCancellationRunState(runState)) return
    const idempotencyKey = stopRunIdempotencyKeysRef.current.get(activeRunId)
      ?? createAssistantIdempotencyKey('assistant-stop')
    stopRunIdempotencyKeysRef.current.set(activeRunId, idempotencyKey)
    setIsActing(true)
    setError(null)
    try {
      const stopped = await stopAssistantRun({ runId: activeRunId, idempotencyKey })
      setRunState(stopped.state)
      const runEvent = stopped.event
      if (runEvent) setRunEvents((current) => mergeRunEvents(current, [runEvent]))
    } catch (stopError) {
      setError(localizeError(stopError))
    } finally {
      setIsActing(false)
    }
  }

  async function handleResume() {
    if (!activeRunId || isActing) return
    setIsActing(true)
    setError(null)
    try {
      const resumed = await resumeAssistantRun({ runId: activeRunId })
      const nextState = parseAssistantRunState(resumed.state)
      if (nextState) setRunState(nextState)
      setRunEvents((current) => mergeRunEvents(current, resumed.events))
    } catch (resumeError) {
      setError(localizeError(resumeError))
    } finally {
      setIsActing(false)
    }
  }

  async function handleLoadOlderMessages() {
    const conversationId = conversation?.id ?? conversationIdRef.current ?? requestedConversationId
    const cursor = nextMessageCursor
    if (!conversationId || !cursor || isLoadingOlderMessages) return

    messagePageAbortRef.current?.abort()
    const controller = new AbortController()
    const generation = conversationLoadGenerationRef.current
    const viewport = scrollViewportRef.current
    const previousHeight = viewport?.scrollHeight ?? 0
    const previousTop = viewport?.scrollTop ?? 0
    messagePageAbortRef.current = controller
    setIsLoadingOlderMessages(true)
    setOlderMessagesError(null)

    try {
      const page = await listAssistantConversationMessages(
        { conversationId, limit: 100, before: cursor },
        { signal: controller.signal },
      )
      if (controller.signal.aborted || generation !== conversationLoadGenerationRef.current) return
      if (page.next_cursor === cursor) {
        throw new Error('Message history did not advance. Please retry.')
      }
      setMessages((current) => mergeMessages(page.messages, current))
      setNextMessageCursor(page.next_cursor)
      window.requestAnimationFrame(() => {
        const currentViewport = scrollViewportRef.current
        if (!currentViewport || generation !== conversationLoadGenerationRef.current) return
        currentViewport.scrollTop = previousTop + Math.max(0, currentViewport.scrollHeight - previousHeight)
      })
    } catch (pageError) {
      if (!controller.signal.aborted && generation === conversationLoadGenerationRef.current) {
        setOlderMessagesError(localizeError(pageError))
      }
    } finally {
      if (messagePageAbortRef.current === controller) messagePageAbortRef.current = null
      if (!controller.signal.aborted && generation === conversationLoadGenerationRef.current) {
        setIsLoadingOlderMessages(false)
      }
    }
  }

  async function handleInlineReviewDecision(action: 'approve' | 'reject' | 'request_changes') {
    if (!pendingInlineReview || isActing) return
    setIsActing(true)
    setError(null)
    try {
      await decideReviewRequest({
        requestId: pendingInlineReview.id,
        action,
        comment: action === 'request_changes' ? 'Revision requested from chat.' : null,
        responsePayload: {
          assistant_inline: true,
          assistant_run_id: activeRunId,
          assistant_conversation_id: conversation?.id ?? conversationIdRef.current ?? requestedConversationId,
        },
      })
      setPendingInlineReview(null)
    } catch (reviewError) {
      setError(localizeError(reviewError))
    } finally {
      setIsActing(false)
    }
  }

  // A new chat: the hero and the composer sit together near the top of the page (like Spark's start) with the
  // inspiration gallery below; the composer moves to the bottom once the conversation has messages.
  const isWelcome = chatContentReady && renderedMessages.length === 0 && !activeRun && Boolean(activeChannel)
  // Once the job has a plan, its flow (Spark's turn: thinking, the words, the job card) takes the place of the agent's
  // latest message of that job, in Spark's order.
  const planReplyId = React.useMemo(() => {
    if (!productionPlanShown || !activeRunId) return null
    for (let index = renderedMessages.length - 1; index >= 0; index -= 1) {
      const message = renderedMessages[index]
      if (message?.role === 'assistant' && message.run_id === activeRunId && !isAssistantControlMessage(message)) return message.id
    }
    return null
  }, [productionPlanShown, activeRunId, renderedMessages])

  // Content that grows by itself (a job's tasks filling in, a card opening) keeps the end in view, as long as the
  // reader is at the end; scrolling up to read stops it.
  React.useEffect(() => {
    const viewport = scrollViewportRef.current
    const content = viewport?.firstElementChild
    if (!viewport || !content || isWelcome) return
    let atEnd = true
    const measure = () => {
      atEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 160
    }
    measure()
    const observer = new ResizeObserver(() => {
      if (atEnd) viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
    })
    observer.observe(content)
    viewport.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', measure)
    }
  }, [isWelcome, chatContentReady])

  // Agent / Senaryo is the composer's approval mode: Senaryo writes the script and plan and waits for approval
  // before producing ('ask'); Agent decides from the request ('autonomous').
  const startMode: ChatStartMode = composerSettings.approvalMode === 'ask' ? 'script' : 'agent'
  function setStartMode(mode: ChatStartMode) {
    setComposerSettings((current) => ({ ...current, approvalMode: mode === 'script' ? 'ask' : 'autonomous' }))
  }

  // A gallery card fills the composer (prompt, format, length, mode); the user still reviews and sends it.
  function applyStartExample(example: ChatStartExample) {
    setDraft(example.prompt)
    setComposerSettings((current) => ({
      ...current,
      aspectRatio: example.aspectRatio,
      durationSeconds: example.durationSeconds === undefined
        ? current.durationSeconds
        : maxVideoDurationSeconds === null
          ? example.durationSeconds
          : clampVideoDurationSeconds(example.durationSeconds, maxVideoDurationSeconds, minVideoDurationSeconds),
      approvalMode: example.mode === 'script' ? 'ask' : 'autonomous',
    }))
    composerFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => composerTextareaRef.current?.focus({ preventScroll: true }), 300)
  }

  return (
    <ScriptReviewHostProvider resetKey={workspaceKey} onOpen={closeWorkspacePanel} handleRef={scriptReviewRef}>
    <TooltipProvider delayDuration={150}>
      <div className="relative flex h-full min-h-full flex-col bg-background text-foreground">
        {isWelcome && (
          <div className="chat-welcome-glow" aria-hidden="true" />
        )}
        <div className="flex min-h-0 w-full flex-1 overflow-hidden">
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col',
              // The welcome page scrolls as one column; its blocks keep their height (an alert is never squeezed).
              isWelcome && 'hover-scrollbar overflow-y-auto [&>*]:shrink-0',
              isWorkspacePanelOpen && 'lg:min-w-[420px]',
            )}
          >
          {error && (
            <ChatInlineAlert
              tone="error"
              title={copy.loadErrorTitle}
              detail={error}
              className="mx-auto mt-4 w-full max-w-[820px]"
            />
          )}
          {runConnectionError && !error ? (
            <div className="mx-auto mt-4 flex w-full max-w-[820px] items-center gap-2 px-4">
              <ChatInlineAlert
                tone="warning"
                title="Connection interrupted"
                detail={runConnectionError}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRunConnectionError(null)
                  rescheduleRunPollRef.current?.()
                }}
              >
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </div>
          ) : null}

          {isWelcome && <div className="h-[13vh] shrink-0" aria-hidden="true" />}
          <div ref={scrollViewportRef} className={cn('hover-scrollbar min-h-0', isWelcome ? 'shrink-0' : 'flex-1 overflow-y-auto')}>
            <div className={cn('relative mx-auto flex w-full max-w-[820px] flex-col gap-10 px-4 sm:px-6', isWelcome ? 'pb-6 pt-0' : 'pb-10 pt-8')}>
              <AgentSprite />
              {/* Only an existing conversation has something to sketch while it loads; a new chat opens on its welcome. */}
              {!chatContentReady && requestedConversationId && (
                <div className="route-in space-y-6">
                  <Skeleton className="ml-auto h-12 w-64 rounded-full bg-muted dark:bg-white/12" />
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-2/3 rounded-full bg-muted dark:bg-white/10" />
                    <Skeleton className="h-4 w-1/2 rounded-full bg-muted/70 dark:bg-white/8" />
                  </div>
                </div>
              )}

              {chatContentReady && renderedMessages.length === 0 && !activeRun && !activeChannel && (
                <div className="flex min-h-[45vh] items-center justify-center text-center text-sm text-muted-foreground dark:text-white/42">
                  {copy.channelMissing}
                </div>
              )}

              {isWelcome && activeChannel && (
                <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-out">
                  <ChatWelcome channelName={activeChannel.name} mode={startMode} onModeChange={setStartMode} />
                </div>
              )}

              {chatContentReady && (
                <>
                  {nextMessageCursor || isLoadingOlderMessages || olderMessagesError ? (
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoadingOlderMessages || !nextMessageCursor}
                        onClick={() => { void handleLoadOlderMessages() }}
                      >
                        {isLoadingOlderMessages ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        {isLoadingOlderMessages ? 'Loading earlier messages…' : 'Load earlier messages'}
                      </Button>
                      {olderMessagesError ? (
                        <p role="alert" className="text-center text-xs text-destructive">{olderMessagesError}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {renderedMessages.map((message, index) => (
                    <React.Fragment key={message.id}>
                    {message.id === planReplyId && activeRunId ? (
                      <VideoProductionCard jobId={activeRunId} runEvents={runEvents} onAsk={askInComposer} reply={message.content} />
                    ) : (
                    <MemoizedChatMessageBubble
                      message={message}
                      containOffscreen={index < renderedMessages.length - 2}
                      locale={locale}
                      channelId={conversationChannelId}
                      deliveryUrls={chatAttachmentDeliveryUrls}
                      onEditAttachment={handleEditMediaAsset}
                      activeRunId={activeRunId}
                      runState={runState}
                      isActing={isActing}
                      onOpenWorkflowDraft={openWorkflowDraftWorkspace}
                      onRunWorkflowDraft={handleRunWorkflowDraft}
                      answeredModelLabels={answeredModelLabels}
                      suppressWorkflowDraftRun={productionG1Open && message.run_id === activeRunId}
                    />
                    )}
                    </React.Fragment>
                  ))}

                  {showDraftMessage && (
                    <AssistantDraftMessage content={activeDraftContent} />
                  )}

                  {chatContentReady && activeRunId && !planReplyId && <VideoProductionCard jobId={activeRunId} runEvents={runEvents} onAsk={askInComposer} />}
                  {chatContentReady && activeRunId && <FinalRenderJobCard jobId={activeRunId} runEvents={runEvents} />}

                  {activeRun && !paymentWait && !pendingInlineReview && !showDraftMessage && !productionPlanShown && !pendingQuestion && (
                    <ActiveRunNarration
                      copy={progressCopy}
                      compact={showDraftMessage}
                      visual={activeRunVisual}
                    />
                  )}

                  {runFailure && (
                    <RunFailureMessage
                      title={runFailure.title}
                      detail={runFailure.detail}
                      action={runFailure.replanWithoutSkill && activeRunId && findRunTriggerMessage(messages, activeRunId)
                        ? {
                          label: tChat('failure.replanWithoutSkill'),
                          pending: replanPending,
                          disabled: isSending || !conversationContextReady,
                          onClick: () => void replanWithoutRemovedSkill(),
                        }
                        : null}
                    />
                  )}
                </>
              )}

              <div aria-hidden="true" />
            </div>
          </div>

          <div className={cn('relative mx-auto w-full max-w-[820px] shrink-0 px-4 pb-4 sm:px-6 sm:pb-5', isWelcome && 'animate-in fade-in-0 slide-in-from-bottom-2 delay-75 duration-500 ease-out fill-mode-both')}>
            {chatContentReady && paymentWait && (
              <PendingPaymentCard
                info={paymentWait}
                locale={locale}
                isActing={isActing}
                onResume={() => void handleResume()}
              />
            )}
            {chatContentReady && pendingInlineReview && !paymentWait && (
              <PendingInlineReviewCard
                item={pendingInlineReview}
                locale={locale}
                isActing={isActing}
                onDecision={(action) => void handleInlineReviewDecision(action)}
              />
            )}
            {chatContentReady && fullAccessLimitAsk !== null && !paymentWait && !pendingInlineReview && (
              <FullAccessLimitNote limitCredits={fullAccessLimitAsk} />
            )}
            {chatContentReady && pendingRunAction && !paymentWait && !pendingInlineReview && (
              <PendingRunActionCard
                action={pendingRunAction}
                locale={locale}
                isActing={isActing}
                onContinue={() => void handleContinueRunAction()}
                onCancel={() => void handleStop()}
              />
            )}
            {chatContentReady && pendingQuestion && !paymentWait && !pendingInlineReview && !pendingRunAction && (
              pendingQuestion.requiredSlots.length >= 2 ? (
                <RequiredFieldsForm
                  question={pendingQuestion}
                  locale={locale}
                  disabled={isSending}
                  onSubmit={(answers) => void handleRequiredFieldsSubmit(pendingQuestion, answers)}
                />
              ) : (
                <ChatQuestionCard
                  key={pendingQuestion.messageId}
                  question={pendingQuestion}
                  disabled={isSending}
                  onChoose={(option) => void handleQuickQuestionAnswer(pendingQuestion, option)}
                  onOwn={() => composerTextareaRef.current?.focus()}
                />
              )
            )}

            {chatContentReady && activeRunId && !pendingQuestion && !paymentWait ? (
              <ProductionSuggestions jobId={activeRunId} onPick={askInComposer} />
            ) : null}

            {chatContentReady && jobTargetChoice ? (
              <JobTargetChoicePanel
                candidates={jobTargetChoice.candidates}
                newJobAllowed={jobTargetChoice.newJobAllowed}
                labelFor={jobChoiceLabel}
                disabled={isSending}
                onChoose={(choice) => void handleJobTargetChoice(choice)}
                onDismiss={() => setJobTargetChoiceState(null)}
              />
            ) : null}
            <ChatComposer
              composer={composer}
              size={isWelcome ? 'big' : 'default'}
              onSubmit={handleSubmit}
              sending={isSending}
              placeholder={!conversationChannelId ? copy.selectChannel : pendingQuestion ? tChat('questionWidget.ownPlaceholder') : copy.placeholder}
              dialogs={false}
              leading={composerJobOptions.length > 1 || composerJobFocus.explicitNewJob || composerJobFocus.steerJobId !== null ? (
                <ComposerJobFocusChip
                  jobs={composerJobOptions}
                  selectedJobId={composerJobFocus.selectedJobId}
                  explicitNewJob={composerJobFocus.explicitNewJob}
                  disabled={isSending}
                  onSelectJob={(jobId) => setJobFocusState({ key: composerContextKey, focus: { mode: 'job', jobId } })}
                  onSelectNewJobs={() => setJobFocusState({ key: composerContextKey, focus: { mode: 'new_jobs' } })}
                  onFollowLive={() => setJobFocusState({ key: composerContextKey, focus: { mode: 'auto' } })}
                  fixing={composerJobFocus.steerJobId !== null}
                  onFixJob={(jobId) => setJobFocusState({ key: composerContextKey, focus: { mode: 'fix', jobId } })}
                />
              ) : null}
              send={(
                /* With nothing to send while the job's video is being made, the button pauses the production. */
                <ProductionRunSend jobId={chatContentReady && !canSubmit ? activeRunId : null}>
                  {activeRun && !canSubmit ? (
                    <PromptBoxSend
                      mode="stop"
                      label={isCancellationRunState(runState) ? copy.stoppingRun : copy.stopRun}
                      disabled={isActing || isCancellationRunState(runState)}
                      busy={isActing || isCancellationRunState(runState)}
                      onClick={() => void handleStop()}
                    />
                  ) : (
                    <PromptBoxSend label={copy.sendMessage} disabled={!canSubmit} busy={isSending} />
                  )}
                </ProductionRunSend>
              )}
            />
            {isWelcome && <ChatWelcomeSuggestions onSuggestion={setDraft} />}
          </div>
          {isWelcome && (
            <div className="w-full shrink-0 pb-10 pt-28 animate-in fade-in-0 slide-in-from-bottom-3 delay-150 duration-700 ease-out fill-mode-both">
              <ChatStartGallery onUse={applyStartExample} />
            </div>
          )}
          </div>
          <WorkflowDraftCanvasPanel
            workflowDraft={activeWorkflowDraftPreview}
            locale={locale}
            imageModels={workflowCanvasImageModels}
            activeRunId={activeRunId}
            runState={runState}
            isActing={isActing}
            open={isWorkspacePanelOpen}
            width={activeWorkspacePanel?.width ?? WORKSPACE_PANEL_DEFAULT_WIDTH}
            onClose={closeWorkspacePanel}
            onWidthChange={setWorkspacePanelWidth}
            onOpenInFlows={handleOpenWorkflowDraftInFlows}
            onRun={handleRunWorkflowDraft}
          />
          <ScriptReviewSidePanel onAsk={askInComposer} />
        </div>
        <ChatComposerDialogs composer={composer} />
      </div>
    </TooltipProvider>
    </ScriptReviewHostProvider>
  )
}

const CHAT_WELCOME_SUGGESTIONS = [
  '60s YouTube intro about AI tools',
  'Product explainer with an avatar',
  'News brief with b-roll and captions',
]

function ChatWelcome({
  channelName,
  mode,
  onModeChange,
}: {
  channelName: string
  mode: ChatStartMode
  onModeChange: (mode: ChatStartMode) => void
}) {
  const t = useTranslations('Chat.startGallery')
  const options = [
    { id: 'agent' as const, icon: Bot, label: <UiText id="agent_5ce2e6f4" /> },
    { id: 'script' as const, icon: PenLine, label: <UiText id="script_ee6d6afa" /> },
  ]
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div role="radiogroup" aria-label={t('mode.label')} className="mb-6 flex items-center gap-1 rounded-full border border-border bg-panel/50 p-1">
        {options.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => onModeChange(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              mode === id ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      <h1 className="text-balance font-display text-3xl text-foreground md:text-4xl"><UiText id="what_are_we_creating_today_bc459020" /></h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <UiText id="describe_your_video_for_4bb29e54" />{' '}{channelName} {' '}<UiText id="and_pick_your_models_voice_and_length_ed39ea55" /></p>
      <p className="mt-1 text-xs text-muted-foreground/80">{t(mode === 'script' ? 'mode.scriptHint' : 'mode.agentHint')}</p>
    </div>
  )
}

function ChatWelcomeSuggestions({ onSuggestion }: { onSuggestion: (value: string) => void }) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {CHAT_WELCOME_SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSuggestion(suggestion)}
          className="flex items-center gap-1.5 rounded-full border border-border bg-panel/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          {suggestion}
        </button>
      ))}
    </div>
  )
}

function ChatMessageBubble({
  message,
  containOffscreen,
  locale,
  channelId,
  deliveryUrls,
  onEditAttachment,
  activeRunId,
  runState,
  isActing,
  onOpenWorkflowDraft,
  onRunWorkflowDraft,
  answeredModelLabels,
  suppressWorkflowDraftRun = false,
}: {
  message: AssistantMessage
  containOffscreen: boolean
  locale: ChatLocale
  channelId: string | null
  deliveryUrls: ReadonlyMap<string, string>
  onEditAttachment: (asset: ChatAssetAttachment) => void
  activeRunId: string | null
  runState: AssistantRunState | null
  isActing: boolean
  onOpenWorkflowDraft: (workflowDraft: WorkflowDraftAttachment) => void
  onRunWorkflowDraft: (workflowDraft: WorkflowDraftAttachment) => void
  /** Chat model id -> public catalog label (S8). */
  answeredModelLabels: ReadonlyMap<string, string>
  /** P03-09: the job's G1 card owns the approval of this draft (the plan-bound decision). */
  suppressWorkflowDraftRun?: boolean
}) {
  const [previewState, setPreviewState] = React.useState<MediaPreviewState | null>(null)
  // QA-090: the candidate card of a result with several media (choose + order before opening in Spark).
  const [sparkCandidatesOpen, setSparkCandidatesOpen] = React.useState(false)
  const answeredModelId = readAnsweredModelId(message)
  const sparkOpen = useOpenChatResultInSpark({ activeChannelId: channelId })
  const tChat = useTranslations('Chat')
  const attachments = hydrateChatAttachments(
    extractMessageAttachments(message),
    channelId,
    deliveryUrls,
  )
  if (message.role === 'system' || message.role === 'tool') return null
  const isUser = message.role === 'user'
  const workflowDraft = extractMessageWorkflowDraft(message)
  // P01D-11: saved/diff/result cards of the Chat skill authoring tools.
  const skillCards = isUser ? [] : readSkillAuthoringCards(message.content_json)
  // P03-13: a result carrying the Chat → Spark handoff contract shows the "Continue in Spark" card.
  const sparkHandoff = isUser ? null : readSparkHandoff(message.content_json)
  // P03-18: the job's connection question shows the small connection card.
  const connectionRequirement = isUser ? null : readConnectionRequirementMessage(message.content_json, message.id)
  const visibleContent = isUser ? message.content.trim() : getAssistantVisibleContent(message.content, attachments)
  const hasVisibleContent = visibleContent.length > 0
  if (!hasVisibleContent && attachments.length === 0 && !workflowDraft && skillCards.length === 0 && !sparkHandoff && !connectionRequirement) return null

  function openPreview(asset: ChatAssetAttachment, group: ChatAssetAttachment[] = attachments) {
    const previewableGroup = group.filter(isVisualAttachment)
    const assets = previewableGroup.length > 0 ? previewableGroup : [asset]
    const index = Math.max(0, assets.findIndex((item) => item.id === asset.id))
    setPreviewState({ assets, index: index === -1 ? 0 : index })
  }

  return (
    <div className={cn(
      'flex animate-in flex-col gap-2 fade-in slide-in-from-bottom-2 duration-300',
      containOffscreen && 'youtorch-chat-message-containment',
      isUser ? 'items-end' : 'items-start',
    )}>
      {hasVisibleContent && (
        <div
          className={cn(
            'max-w-[min(640px,80%)]',
            // A quiet grey bubble, as in ChatGPT's dark mode; the agent's side has no bubble.
            isUser
              ? 'rounded-3xl bg-muted px-4 py-2.5 text-foreground dark:bg-[#2f2f2f] dark:text-white/95'
              : 'text-foreground dark:text-white',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{visibleContent}</p>
          ) : (
            <ChatMarkdown content={visibleContent} />
          )}
        </div>
      )}
      {attachments.length > 0 && (
        <MessageAttachments
          attachments={attachments}
          isUser={isUser}
          locale={locale}
          onPreview={openPreview}
          onEdit={onEditAttachment}
        />
      )}
      {workflowDraft && (
        <WorkflowDraftCard
          workflowDraft={workflowDraft}
          locale={locale}
          runnable={!suppressWorkflowDraftRun && isWorkflowDraftRunnable(workflowDraft, activeRunId, runState)}
          isActing={isActing}
          onOpen={() => onOpenWorkflowDraft(workflowDraft)}
          onRun={() => onRunWorkflowDraft(workflowDraft)}
        />
      )}
      {skillCards.length > 0 && <SkillAuthoringCards cards={skillCards} messageId={message.id} />}
      {sparkHandoff && <SparkContinueCard handoff={sparkHandoff} />}
      {sparkCandidatesOpen && (
        <SparkCandidateCard
          message={message}
          thumbnails={new Map(attachments.flatMap((asset) => (asset.objectId ? [[asset.objectId, getMediaThumbnailUrl(asset)] as const] : [])))}
          activeChannelId={channelId}
          onClose={() => setSparkCandidatesOpen(false)}
        />
      )}
      {connectionRequirement && <ConnectionRequirementCard requirementId={connectionRequirement.requirementId} />}
      <ChatMessageActions
        content={message.content}
        align={isUser ? 'end' : 'start'}
        answeredModelLabel={answeredModelId ? answeredModelLabel(answeredModelId, answeredModelLabels) : null}
        extraActions={!isUser && hasSparkOpenableResult(message) ? (
          <MessageActionButton
            label={sparkOpen.pendingMessageId === message.id ? tChat('sparkEntry.opening') : tChat('sparkEntry.open')}
            onClick={() => {
              if (sparkCandidateCount(message) > 1) setSparkCandidatesOpen((open) => !open)
              else if (!sparkOpen.pendingMessageId) void sparkOpen.open(message)
            }}
          >
            <Sparkles className="size-4" />
          </MessageActionButton>
        ) : null}
      />
      {previewState && (
        <MediaLightbox
          assets={previewState.assets}
          activeIndex={previewState.index}
          locale={locale}
          onClose={() => setPreviewState(null)}
          onEdit={onEditAttachment}
          onIndexChange={(index) => setPreviewState((current) => current ? { ...current, index } : current)}
        />
      )}
    </div>
  )
}

function useChatAttachmentDeliveryUrls(
  messages: AssistantMessage[],
  fallbackChannelId: string | null,
) {
  const batches = React.useMemo(
    () => getChatStorageDeliveryBatches(messages, fallbackChannelId),
    [fallbackChannelId, messages],
  )
  const batchKey = batches.map((batch) => batch.key).join('\u001e')
  const pollStartedAtRef = React.useRef(new Map<string, number>())
  const [deliveryUrls, setDeliveryUrls] = React.useState<ReadonlyMap<string, string>>(new Map())
  React.useEffect(() => {
    const now = Date.now()
    const activeKeys = new Set(batches.map((batch) => batch.key))
    const starts = pollStartedAtRef.current
    for (const key of [...starts.keys()]) {
      if (!activeKeys.has(key)) starts.delete(key)
    }
    for (const key of activeKeys) {
      if (!starts.has(key)) starts.set(key, now)
    }
  }, [batchKey, batches])

  const queries = useQueries({
    queries: batches.map((batch): UseQueryOptions<DeliveryUrlsBatchResult> => ({
        queryKey: ['chat', 'storage-deliveries', batch.channelId, batch.objectIds],
        queryFn: () => getStorageDeliveryUrls({
          channelId: batch.channelId,
          items: batch.objectIds.map((objectId) => ({
            objectId,
            expiresInSeconds: 3_600,
            variant: 'original' as const,
          })),
        }),
        staleTime: 45 * 60_000,
        refetchInterval: (query) => getChatStorageDeliveryRefreshDelay(
          query.state.data,
          pollStartedAtRef.current.get(batch.key) ?? Date.now(),
          Boolean(query.state.error),
        ),
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        retry: 1,
      })),
  })

  React.useEffect(() => {
    const urls = new Map<string, string>()
    queries.forEach((query, index) => {
      const channelId = batches[index]?.channelId
      if (!channelId) return
      for (const item of query.data?.items ?? []) {
        if (item.status === 'ok') urls.set(chatStorageDeliveryKey(channelId, item.object_id), item.url)
      }
    })
    setDeliveryUrls((current) => areChatDeliveryUrlMapsEqual(current, urls) ? current : urls)
  }, [batches, queries])
  return deliveryUrls
}

function areChatDeliveryUrlMapsEqual(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
) {
  if (left.size !== right.size) return false
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false
  }
  return true
}

function getChatStorageDeliveryBatches(
  messages: AssistantMessage[],
  fallbackChannelId: string | null,
) {
  const grouped = new Map<string, Set<string>>()
  let referenceCount = 0
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex]
    if (!message) continue
    for (const asset of extractMessageAttachments(message)) {
      if (asset.kind === 'video') continue
      const channelId = asset.channelId ?? fallbackChannelId
      const objectId = asset.objectId?.trim()
      if (!channelId || !objectId) continue
      const objectIds = grouped.get(channelId) ?? new Set<string>()
      if (objectIds.has(objectId)) continue
      if (referenceCount >= CHAT_STORAGE_DELIVERY_REFERENCE_LIMIT) continue
      objectIds.add(objectId)
      grouped.set(channelId, objectIds)
      referenceCount += 1
    }
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).flatMap(([channelId, objectIds]) => {
    const sortedObjectIds = [...objectIds].sort()
    const batches: Array<{ key: string; channelId: string; objectIds: string[] }> = []
    for (let offset = 0; offset < sortedObjectIds.length; offset += CHAT_STORAGE_DELIVERY_BATCH_SIZE) {
      const batchObjectIds = sortedObjectIds.slice(offset, offset + CHAT_STORAGE_DELIVERY_BATCH_SIZE)
      batches.push({
        key: `${channelId}\u001f${batchObjectIds.join('\u001f')}`,
        channelId,
        objectIds: batchObjectIds,
      })
    }
    return batches
  })
}

function getChatStorageDeliveryRefreshDelay(
  data: DeliveryUrlsBatchResult | undefined,
  pollingStartedAt: number,
  failed: boolean,
) {
  if (failed) return false
  const hasPending = data?.items.some((item) => (
    item.status === 'error' && isChatStorageDeliveryPendingCode(item.error.code)
  )) ?? false
  if (hasPending) {
    const elapsedMs = Math.max(0, Date.now() - pollingStartedAt)
    if (elapsedMs >= CHAT_STORAGE_DELIVERY_PENDING_POLL_MAX_MS) return false
    return elapsedMs < 2 * 60_000 ? 10_000 : 30_000
  }
  return storageDeliveryRefreshDelay(data?.items)
}

function isChatStorageDeliveryPendingCode(value: string) {
  const code = value.trim().toUpperCase()
  return code === 'STORAGE_DELIVERY_NOT_READY'
    || code === 'STORAGE_OBJECT_NOT_READY'
    || code.includes('PROCESSING')
}

function hydrateChatAttachments(
  attachments: ChatAssetAttachment[],
  fallbackChannelId: string | null,
  deliveryUrls: ReadonlyMap<string, string>,
) {
  return attachments.map((asset) => {
    const channelId = asset.channelId ?? fallbackChannelId
    const objectId = asset.objectId?.trim() || null
    const deliveryUrl = channelId && objectId
      ? deliveryUrls.get(chatStorageDeliveryKey(channelId, objectId)) ?? null
      : null
    const stableDownloadUrl = channelId && objectId
      ? getStorageDownloadUrl({ channelId, objectId, fileName: asset.name })
      : null
    const stablePlaybackUrl = channelId && objectId && asset.kind === 'video'
      ? getStoragePlaybackUrl({ channelId, objectId })
      : null
    const currentUrl = getChatStorageObjectIdFromUri(asset.url) ? stableDownloadUrl : asset.url
    const currentPreviewUrl = getChatStorageObjectIdFromUri(asset.previewUrl)
      ? stableDownloadUrl
      : asset.previewUrl
    return {
      ...asset,
      channelId,
      url: stablePlaybackUrl ?? deliveryUrl ?? currentUrl ?? stableDownloadUrl,
      previewUrl: deliveryUrl && asset.kind === 'image'
        ? deliveryUrl
        : asset.kind === 'video'
          ? isStorageDownloadUrl(currentPreviewUrl) ? null : currentPreviewUrl
          : currentPreviewUrl ?? (asset.kind === 'image' ? stableDownloadUrl : null),
    }
  })
}

function chatStorageDeliveryKey(channelId: string, objectId: string) {
  return `${channelId}\u001f${objectId}`
}

function isStorageDownloadUrl(value: string | null | undefined) {
  return Boolean(value?.startsWith('/api/storage/download?'))
}

const MemoizedChatMessageBubble = React.memo(ChatMessageBubble)

function getAssistantVisibleContent(content: string, attachments: ChatAssetAttachment[]) {
  if (attachments.length === 0) return content.trim()
  if (isJsonLike(content) || isMediaUrlOnlyContent(content)) return ''
  return stripAttachmentUrls(content, attachments).trim()
}

function WorkflowDraftCard({
  workflowDraft,
  locale,
  runnable,
  isActing,
  onOpen,
  onRun,
}: {
  workflowDraft: WorkflowDraftAttachment
  locale: ChatLocale
  runnable: boolean
  isActing: boolean
  onOpen: () => void
  onRun: () => void
}) {
  const workflow = React.useMemo(() => workflowFromAssistantDraft(workflowDraft), [workflowDraft])
  const copy = useWorkflowDraftCopy()
  const missingSlots = workflowDraft.missingSlots?.length ?? 0
  const plannedSteps = workflowDraft.plannedSteps?.length ?? workflow.nodesCount
  return (
    <div className="flex w-[min(620px,92vw)] items-center gap-3 rounded-[14px] border border-border/80 bg-card p-3 text-card-foreground shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-[0_16px_44px_rgba(0,0,0,0.24)]">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground ring-1 ring-border/80 dark:bg-white/10 dark:text-white dark:ring-white/8">
        <WorkflowIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground dark:text-white">{workflow.name}</p>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground dark:text-white/58">{copy.openPreview}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground dark:text-white/44">
          <span className="rounded-full border border-border px-2 py-0.5 font-medium text-muted-foreground dark:border-white/12 dark:text-white/56">{copy.draft}</span>
          <span aria-hidden="true">/</span>
          <span>{copy.nodeCount(workflow.nodesCount)}</span>
          <span aria-hidden="true">/</span>
          <span>{copy.stepCount(plannedSteps)}</span>
          <span aria-hidden="true">/</span>
          <span>{workflow.averageCost}</span>
          {missingSlots > 0 && (
            <>
              <span aria-hidden="true">/</span>
              <span className="text-amber-700 dark:text-amber-100">{copy.missingCount(missingSlots)}</span>
            </>
          )}
        </div>
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
        {runnable && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-full border-border bg-background text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.10)] hover:bg-muted dark:border-white/24 dark:bg-white/12 dark:text-white dark:shadow-[0_8px_24px_rgba(0,0,0,0.22)] dark:hover:border-white/36 dark:hover:bg-white/18 dark:hover:text-white"
            onClick={onRun}
            disabled={isActing}
            aria-label={copy.run}
          >
            {isActing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 cursor-pointer rounded-[10px] border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors hover:bg-muted dark:border-white/22 dark:bg-white/[0.035] dark:text-white dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] dark:hover:border-white/42 dark:hover:bg-white/[0.075] dark:hover:text-white"
          onClick={onOpen}
        >
          {copy.openInCanvas}
          <ArrowUpRight className="size-4 text-muted-foreground dark:text-white/82" />
        </Button>
      </div>
    </div>
  )
}

function WorkflowDraftCanvasPanel({
  workflowDraft,
  locale,
  imageModels,
  activeRunId,
  runState,
  isActing,
  open,
  width,
  onClose,
  onWidthChange,
  onOpenInFlows,
  onRun,
}: {
  workflowDraft: WorkflowDraftAttachment | null
  locale: ChatLocale
  imageModels: WorkflowCanvasImageModel[]
  activeRunId: string | null
  runState: AssistantRunState | null
  isActing: boolean
  open: boolean
  width: number
  onClose: () => void
  onWidthChange: (width: number) => void
  onOpenInFlows: (workflowDraft: WorkflowDraftAttachment) => void
  onRun: (workflowDraft: WorkflowDraftAttachment) => void
}) {
  const workflow = React.useMemo(
    () => workflowDraft ? workflowFromAssistantDraft(workflowDraft) : null,
    [workflowDraft],
  )
  const copy = useWorkflowDraftCopy()
  if (!open || !workflowDraft || !workflow) return null
  const runnable = isWorkflowDraftRunnable(workflowDraft, activeRunId, runState)

  function handleResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function handleMove(moveEvent: PointerEvent) {
      onWidthChange(startWidth - (moveEvent.clientX - startX))
    }

    function handleEnd() {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
  }

  return (
    <aside
      aria-label={`${copy.workspace}: ${workflow.name}`}
      style={{ '--workspace-panel-width': `${width}px` } as React.CSSProperties}
      className="youtorch-thin-scrollbar fixed inset-x-0 bottom-0 z-40 h-[78vh] min-h-[420px] overflow-hidden border-t border-border bg-background text-foreground shadow-[0_-24px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_-28px_90px_rgba(0,0,0,0.55)] lg:relative lg:inset-auto lg:z-auto lg:h-auto lg:min-h-0 lg:w-[var(--workspace-panel-width)] lg:min-w-[420px] lg:max-w-[72vw] lg:shrink-0 lg:border-l lg:border-t-0 lg:shadow-[0_0_54px_rgba(15,23,42,0.10)] lg:dark:shadow-[0_0_80px_rgba(0,0,0,0.38)]"
    >
      <button
        type="button"
        aria-label={copy.resizeWorkspace}
        title={copy.resizeWorkspace}
        onPointerDown={handleResizeStart}
        className="absolute inset-y-0 left-0 z-30 hidden w-3 cursor-col-resize items-center justify-center outline-none transition-colors hover:bg-muted focus-visible:bg-muted dark:hover:bg-white/6 dark:focus-visible:bg-white/8 lg:flex"
      >
        <span className="h-12 w-px rounded-full bg-border" />
      </button>
      <WorkflowCanvas
        workflow={workflow}
        mode="editor"
        locale={locale}
        headerBackIcon="panel"
        showHeaderTitle={false}
        // P03-16: the Chat canvas is a light view; the durable copy is the server draft, saving happens in Flows.
        showSave={false}
        allowAiPrompt={false}
        onOpenInFlows={(snapshot: WorkflowCanvasSnapshot) => onOpenInFlows(mergeWorkflowDraftSnapshot(workflowDraft, snapshot))}
        onBack={onClose}
        onRun={(snapshot: WorkflowCanvasSnapshot) => onRun(mergeWorkflowDraftSnapshot(workflowDraft, snapshot))}
        runLabel={copy.run}
        runDisabled={!runnable}
        runPending={isActing}
        imageModels={imageModels}
      />
    </aside>
  )
}

function WorkflowCanvasLoading() {
  const tAuto = useTranslations('Auto')
  return (
    <div className="relative h-full min-h-[420px] overflow-hidden bg-background p-4" aria-busy="true" aria-label={tAuto('loading_workflow_canvas_bbd9cd59')}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-panel/30">
        <div className="flex h-12 items-center gap-3 border-b border-border px-4">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-8 w-24 rounded-xl" />
        </div>
        <div className="relative min-h-0 flex-1">
          <Skeleton className="absolute left-[8%] top-[18%] h-24 w-48 rounded-2xl" />
          <Skeleton className="absolute right-[9%] top-[42%] h-24 w-48 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

function useWorkflowDraftCopy() {
  const t = useTranslations('Chat') as unknown as ChatTranslator
  return {
    workspace: t('workflowDraft.workspace'),
    resizeWorkspace: t('workflowDraft.resizeWorkspace'),
    draft: t('workflowDraft.draft'),
    preview: t('workflowDraft.preview'),
    openPreview: t('workflowDraft.openPreview'),
    openInCanvas: t('workflowDraft.openInCanvas'),
    openInFlows: t('workflowDraft.openInFlows'),
    run: t('workflowDraft.run'),
    previewHint: t('workflowDraft.previewHint'),
    closeCanvas: t('workflowDraft.closeCanvas'),
    nodeCount: (count: number) => t('workflowDraft.nodeCount', { count }),
    stepCount: (count: number) => t('workflowDraft.stepCount', { count }),
    missingCount: (count: number) => t('workflowDraft.missingCount', { count }),
  }
}

function stripAttachmentUrls(content: string, attachments: ChatAssetAttachment[]) {
  const knownUrls = attachments.flatMap((asset) => [asset.url, asset.previewUrl]).filter((url): url is string => Boolean(url))
  const withoutKnownUrls = knownUrls.reduce((current, url) => current.split(url).join(''), content)
  return withoutKnownUrls
    .replace(MEDIA_URL_PATTERN, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

function isMediaUrlOnlyContent(content: string) {
  const withoutUrls = content.replace(MEDIA_URL_PATTERN, '').replace(/[\s.,;:()[\]{}'"`_-]/g, '')
  return withoutUrls.length === 0
}

function MediaLightbox({
  assets,
  activeIndex,
  locale,
  onClose,
  onEdit,
  onIndexChange,
}: {
  assets: ChatAssetAttachment[]
  activeIndex: number
  locale: ChatLocale
  onClose: () => void
  onEdit: (asset: ChatAssetAttachment) => void
  onIndexChange: (index: number) => void
}) {
  const tAuto = useTranslations('Auto')
  const safeAssets = assets.length > 0 ? assets : []
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(safeAssets.length - 1, 0))
  const asset = safeAssets[safeIndex]
  const copy = useChatCopy()
  if (!asset) return null
  const src = asset.url ?? asset.previewUrl
  const canEdit = asset.kind === 'image'
  const hasMany = safeAssets.length > 1
  const contentWidthClass = asset.kind === 'image'
    ? 'w-[min(92vw,86vh,920px)]'
    : asset.kind === 'video'
      ? 'w-[min(96vw,1120px)]'
      : 'w-[min(92vw,680px)]'
  const frameClass = asset.kind === 'image'
    ? 'aspect-square'
    : asset.kind === 'video'
      ? 'aspect-video'
      : 'min-h-[220px]'
  const actionClass = 'flex size-9 items-center justify-center rounded-full bg-black/62 text-white/82 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur transition-colors hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45'

  function goToIndex(index: number) {
    if (!hasMany) return
    const nextIndex = (index + safeAssets.length) % safeAssets.length
    onIndexChange(nextIndex)
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'max-h-[96vh] max-w-none gap-0 overflow-visible border-0 bg-transparent p-0 text-white shadow-none sm:max-w-none',
          contentWidthClass,
        )}
      >
        <DialogTitle className="sr-only">{asset.name}</DialogTitle>
        <DialogDescription className="sr-only">{copy.openMedia}</DialogDescription>
        <div
          className={cn(
            'relative flex w-full items-center justify-center overflow-hidden rounded-[18px] bg-black shadow-[0_28px_120px_rgba(0,0,0,0.84)] ring-1 ring-white/12',
            frameClass,
          )}
        >
          {src && asset.kind === 'image' ? (
            <img src={src} alt={asset.name} className="h-full w-full object-contain" />
          ) : src && asset.kind === 'video' ? (
            <VideoAssetPlayer asset={asset} autoPlay className="h-full w-full" />
          ) : src && asset.kind === 'audio' ? (
            <audio src={src} controls className="w-[min(620px,86vw)]" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/58">
              <AttachmentKindIcon kind={asset.kind} className="size-12" />
              <span className="text-sm font-medium">{asset.name}</span>
            </div>
          )}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                aria-label={copy.generatedEdit}
                title={copy.generatedEdit}
                onClick={() => {
                  onEdit(asset)
                  onClose()
                }}
                className={actionClass}
              >
                <PencilLine className="size-4" />
              </button>
            )}
            {src && (
              <>
                <a
                  href={src}
                  download={asset.name}
                  className={actionClass}
                  aria-label={copy.downloadMedia}
                  title={copy.downloadMedia}
                >
                  <Download className="size-4" />
                </a>
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className={actionClass}
                  aria-label={copy.openOriginal}
                  title={copy.openOriginal}
                >
                  <ExternalLink className="size-4" />
                </a>
              </>
            )}
            <button
              type="button"
              aria-label={copy.mediaPickerClose}
              title={copy.mediaPickerClose}
              onClick={onClose}
              className={actionClass}
            >
              <X className="size-5" />
            </button>
          </div>
          {hasMany && (
            <>
              <button
                type="button"
                aria-label={tAuto('previous_media_9da8769e')}
                onClick={() => goToIndex(safeIndex - 1)}
                className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/62 text-white/82 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur transition-colors hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label={tAuto('next_media_9578922c')}
                onClick={() => goToIndex(safeIndex + 1)}
                className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/62 text-white/82 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur transition-colors hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-center gap-2">
                {safeAssets.slice(0, 8).map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`${copy.openMedia} ${index + 1}`}
                    onClick={() => goToIndex(index)}
                    className={cn(
                      'relative size-12 overflow-hidden rounded-md bg-black/70 ring-1 ring-white/14 transition-all hover:ring-white/58',
                      index === safeIndex && 'scale-105 ring-2 ring-white',
                    )}
                  >
                    <MediaThumbnail asset={item} className="h-full w-full" />
                  </button>
                ))}
                {safeAssets.length > 8 && (
                  <span className="flex h-12 min-w-12 items-center justify-center rounded-md bg-black/70 px-3 text-xs font-semibold text-white/86 ring-1 ring-white/14">
                    +{safeAssets.length - 8}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChatMessageActions({
  content,
  align,
  answeredModelLabel,
  extraActions = null,
}: {
  content: string
  align: 'start' | 'end'
  /** S8: the public label of the model that wrote this assistant reply (server-stamped), or null. */
  answeredModelLabel?: string | null
  /** P03-07: result actions of this message (e.g. "Open in Spark"), before "More". */
  extraActions?: React.ReactNode
}) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  async function copyMessage() {
    await navigator.clipboard?.writeText(content).catch(() => undefined)
  }

  async function shareMessage() {
    if (navigator.share) {
      await navigator.share({ text: content }).catch(() => undefined)
      return
    }
    await copyMessage()
  }

  return (
    <div className={cn('flex items-center gap-1 text-muted-foreground dark:text-white/58', align === 'end' && 'justify-end')}>
      <MessageActionButton label={tAuto('copy_af74f7c5')} onClick={() => void copyMessage()}>
        <Copy className="size-4" />
      </MessageActionButton>
      <MessageActionButton label={tAuto('share_09ca55ca')} onClick={() => void shareMessage()}>
        <Upload className="size-4" />
      </MessageActionButton>
      {extraActions}
      <MessageActionButton label={tAuto('more_4bab2d8f')}>
        <MoreHorizontal className="size-4" />
      </MessageActionButton>
      {answeredModelLabel ? (
        <span
          className="ml-1 min-w-0 truncate text-xs text-muted-foreground dark:text-white/44"
          title={tChat('messageMeta.answeredBy', { model: answeredModelLabel })}
          aria-label={tChat('messageMeta.answeredBy', { model: answeredModelLabel })}
        >
          {answeredModelLabel}
        </span>
      ) : null}
    </div>
  )
}

function MessageActionButton({
  label,
  children,
  onClick,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={onClick}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-white/58 dark:hover:bg-white/8 dark:hover:text-white dark:focus-visible:ring-white/25"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function AssistantDraftMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[min(760px,92%)] animate-in text-foreground fade-in slide-in-from-bottom-2 duration-300 dark:text-white">
        <ChatMarkdown content={content} streaming />
      </div>
    </div>
  )
}

function ActiveRunNarration({
  copy,
  compact,
  visual,
}: {
  copy: { title: string; detail: string | null; progress: number | null }
  compact: boolean
  visual: ActiveRunVisual | null
}) {
  return (
    <div className={cn('mb-6 flex animate-in justify-start fade-in slide-in-from-bottom-2 duration-300', compact ? '-mt-4' : '')} aria-live="polite">
      {/* Spark's turn, as in the Spark project: the reasoning line while it works, then what it makes. */}
      <AgentScope className="w-full max-w-[620px]">
        <AgentTurn>
          <AgentThinking working label={copy.title} lines={copy.detail ? [copy.detail] : []} />
          {visual && <ActiveRunWidget visual={visual} />}
        </AgentTurn>
      </AgentScope>
    </div>
  )
}

const VISUAL_STEP_STATE: Record<ActiveRunVisualStep['status'], AgentStepState> = {
  completed: 'done',
  active: 'current',
  failed: 'failed',
  pending: 'pending',
}

/**
 * What the run is making right now (images, a video, a workflow) as a Chain of Thought folded to one line (the step it
 * is on, shimmering), with the outputs side by side under it in their format while they render (four images: four
 * frames); its steps and a retry note open from the line.
 */
function ActiveRunWidget({ visual }: { visual: ActiveRunVisual }) {
  const media = visual.kind === 'image' || visual.kind === 'video'
  const ratio = (visual.aspectRatio ?? (visual.kind === 'image' ? '1:1' : '16:9')).replace(':', ' / ')
  const steps: AgentChainStep[] = [
    ...visual.steps.map((step, index) => ({ id: `step-${index}`, label: step.label, state: VISUAL_STEP_STATE[step.status] })),
    ...(visual.retryLabel ? [{ id: 'retry', label: visual.retryLabel, state: 'waiting' as const }] : []),
  ]
  const active = visual.steps.find((step) => step.status === 'active')?.label ?? visual.detail ?? visual.title
  return (
    <AgentChain
      title={visual.title}
      working
      current={active}
      steps={steps}
      preview={media ? <AgentMedia ratio={ratio} tiles={Array.from({ length: visual.outputs }, (_, index) => ({ id: String(index), content: null }))} /> : undefined}
    />
  )
}

function RunFailureMessage({
  title,
  detail,
  action,
}: {
  title: string
  detail: string
  action?: { label: string; pending: boolean; disabled: boolean; onClick: () => void } | null
}) {
  return (
    <div className="flex justify-start" aria-live="polite">
      <ChatInlineAlert
        tone="error"
        title={title}
        detail={detail}
        className="max-w-[620px]"
        action={action ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 cursor-pointer rounded-[10px] border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors hover:bg-muted dark:border-white/22 dark:bg-white/[0.035] dark:text-white dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] dark:hover:border-white/42 dark:hover:bg-white/[0.075] dark:hover:text-white"
            onClick={action.onClick}
            disabled={action.disabled || action.pending}
          >
            {action.pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {action.label}
          </Button>
        ) : null}
      />
    </div>
  )
}


/** A thin progress line under the running step, only when the run reports a percentage. */
function classifyFundingReason(reason: string | null): 'balance' | 'grant' {
  // Matches the P00-10 spend-envelope outcomes this can become (job-status-transitions.json
  // spend_decision_mapping): wait_ceiling, rejected_principal_period_cap, grant_insufficient.
  if (reason && /grant|approval|ceiling|principal|approved_max/i.test(reason)) return 'grant'
  return 'balance'
}

function PendingPaymentCard({
  info,
  locale,
  isActing,
  onResume,
}: {
  info: PaymentWaitInfo
  locale: ChatLocale
  isActing: boolean
  onResume: () => void
}) {
  const copy = useChatCopy()
  const kind = classifyFundingReason(info.reason)
  const isGrant = kind === 'grant'
  const Icon = isGrant ? ShieldCheck : CreditCard
  const title = isGrant ? copy.amountApprovalTitle : copy.creditTitle
  const description = info.message ?? (isGrant ? copy.amountApprovalDescription : copy.creditDescription)
  return (
    <div className="mb-3 rounded-md border border-amber-300/35 bg-amber-100/55 p-4 text-amber-950 shadow-[0_16px_48px_rgba(15,23,42,0.08)] dark:border-amber-200/22 dark:bg-amber-300/10 dark:text-white dark:shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-300/35 text-amber-700 dark:bg-amber-200/18 dark:text-amber-100">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-amber-900/75 dark:text-white/66">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isGrant ? (
              <Button
                type="button"
                disabled={isActing}
                onClick={onResume}
                className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                {isActing ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {copy.approveHigherAmount}
              </Button>
            ) : (
              <>
                <Button asChild className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90">
                  <Link href="/settings/top-up">
                    <CreditCard className="size-4" />
                    {copy.topUp}
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isActing}
                  onClick={onResume}
                  className="h-9 rounded-full border-amber-600/25 bg-transparent px-4 text-sm font-semibold text-amber-900 hover:bg-amber-200/50 hover:text-amber-950 dark:border-white/18 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {isActing ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {copy.continueAfterTopUp}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PendingInlineReviewCard({
  item,
  locale,
  isActing,
  onDecision,
}: {
  item: ReviewItem
  locale: ChatLocale
  isActing: boolean
  onDecision: (action: 'approve' | 'reject' | 'request_changes') => void
}) {
  const title = getReviewDisplayTitle(item)
  const message = getReviewDisplayMessage(item)
  const tChat = useTranslations('Chat') as unknown as ChatTranslator
  const detail = getInlineReviewDetail(item, tChat)
  const approveLabel = tChat('review.approveContinue')
  const reviseLabel = tChat('review.requestChanges')
  const rejectLabel = tChat('review.reject')
  const eyebrow = tChat('review.eyebrow')

  return (
    <div className="mb-3 rounded-md border border-border/80 bg-card p-4 text-card-foreground shadow-[0_16px_48px_rgba(15,23,42,0.08)] dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-300/16 dark:text-emerald-100">
          <CircleAlert className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-white/44">{eyebrow}</p>
          <p className="mt-1 text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground dark:text-white/66">{message}</p>
          {detail && <p className="mt-2 text-sm leading-6 text-muted-foreground/80 dark:text-white/52">{detail}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {item.allowed_actions.includes('approve') && (
              <Button
                type="button"
                disabled={isActing}
                onClick={() => onDecision('approve')}
                className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                <Check className="size-4" />
                {approveLabel}
              </Button>
            )}
            {item.allowed_actions.includes('request_changes') && (
              <Button
                type="button"
                variant="outline"
                disabled={isActing}
                onClick={() => onDecision('request_changes')}
                className="h-9 rounded-full border-border bg-transparent px-4 text-sm font-semibold text-foreground hover:bg-muted dark:border-white/18 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
              >
                <PencilLine className="size-4" />
                {reviseLabel}
              </Button>
            )}
            {item.allowed_actions.includes('reject') && (
              <Button
                type="button"
                variant="outline"
                disabled={isActing}
                onClick={() => onDecision('reject')}
                className="h-9 rounded-full border-border bg-transparent px-4 text-sm font-semibold text-foreground hover:bg-muted dark:border-white/18 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="size-4" />
                {rejectLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PendingRunActionCard({
  action,
  locale,
  isActing,
  onContinue,
  onCancel,
}: {
  action: PendingRunAction
  locale: ChatLocale
  isActing: boolean
  onContinue: () => void
  onCancel: () => void
}) {
  const copy = useChatCopy()
  return (
    <div className="mb-3 rounded-md border border-border/80 bg-card p-4 text-card-foreground shadow-[0_16px_48px_rgba(15,23,42,0.08)] dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:shadow-[0_16px_48px_rgba(0,0,0,0.24)]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-white/10 dark:text-white/82">
          <CircleAlert className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{copy.actionPendingTitle}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground dark:text-white/62">{action.prompt || copy.actionPendingDescription}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isActing}
              onClick={onContinue}
              className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {isActing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {copy.startApproved}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isActing}
              onClick={onCancel}
              className="h-9 rounded-full border-border bg-transparent px-4 text-sm font-semibold text-foreground hover:bg-muted dark:border-white/18 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Square className="size-4" />
              {copy.reject}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * TK-37: all missing required fields are asked together, once, in a single multi-field form
 * (never one field per turn, never guessed). Rendered instead of QuickQuestionPanel whenever
 * the pending question names two or more required_slots (assistant-runtime v1
 * pending-invocation.schema.json required_field_keys is the backend-normative shape this maps
 * to once P01-04 emits it as a real waiting_input pending invocation).
 */
function RequiredFieldsForm({
  question,
  locale,
  disabled,
  onSubmit,
}: {
  question: PendingQuickQuestion
  locale: ChatLocale
  disabled: boolean
  onSubmit: (answers: Record<string, string>) => void
}) {
  const copy = useChatCopy()
  const [values, setValues] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    setValues({})
  }, [question.messageId])

  const allFilled = question.requiredSlots.every((key) => (values[key] ?? '').trim().length > 0)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || !allFilled) return
    onSubmit(values)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 rounded-md border border-border/80 bg-card p-3 text-card-foreground shadow-[0_16px_48px_rgba(15,23,42,0.08)] dark:border-white/12 dark:bg-[#202020] dark:text-white dark:shadow-[0_16px_48px_rgba(0,0,0,0.24)]"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-white/45">
        <Sparkles className="size-3.5" />
        {copy.requiredFieldsTitle}
      </div>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground dark:text-white/74">{question.prompt}</p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {question.requiredSlots.map((key) => (
          <label key={`${question.messageId}:${key}`} className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground dark:text-white/56">{humanizeRequiredFieldKey(key)}</span>
            <input
              value={values[key] ?? ''}
              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
              disabled={disabled}
              placeholder={copy.requiredFieldsPlaceholder}
              className="h-9 min-w-0 rounded-[10px] border border-border bg-input px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:bg-background dark:border-white/12 dark:bg-white/7 dark:text-white dark:placeholder:text-white/36 dark:focus:border-white/24 dark:focus:bg-white/10"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end border-t border-border pt-3 dark:border-white/10">
        <Button
          type="submit"
          disabled={disabled || !allFilled}
          className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-45 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          <Check className="size-4" />
          {copy.requiredFieldsSubmit}
        </Button>
      </div>
    </form>
  )
}

/**
 * A question before the plan, docked on the composer: Spark's question card (`AgentQuestion`), the same one the Spark
 * project asks with. The options are the question's (recommendation first); "Kendi cevabım" puts the cursor in the
 * composer, whose text then answers it; "Atla" leaves the call to the agent.
 */
function ChatQuestionCard({
  question,
  disabled,
  onChoose,
  onOwn,
}: {
  question: PendingQuickQuestion
  disabled: boolean
  onChoose: (option: QuickQuestionOption) => void
  onOwn: () => void
}) {
  const copy = useChatCopy()
  const tChat = useTranslations('Chat')
  // "Sen belirle" is the card's "Atla"; the rows are the real choices.
  const choices = question.options.filter((option) => option.label !== copy.quickDecisionDefault)
  const chip = question.chip
    ? (tChat.has(`questionWidget.chip.${question.chip}`) ? tChat(`questionWidget.chip.${question.chip}`) : question.chip)
    : tChat('questionWidget.chip.default')
  return (
    <AgentScope className="mb-3">
      <AgentQuestion
        chip={chip}
        text={question.prompt}
        options={choices.map((option, index) => ({ id: String(index), label: option.label, hint: option.hint, recommended: option.recommended }))}
        disabled={disabled}
        onAnswer={(picked) => {
          const option = choices[Number(picked.id)]
          if (option) onChoose(option)
        }}
        onSkip={() => onChoose({ label: copy.quickDecisionDefault, value: copy.quickDecisionDefaultValue })}
        onOwn={onOwn}
        copy={{
          skip: tChat('questionWidget.skip'),
          skipTitle: tChat('questionWidget.skipTitle'),
          own: tChat('questionWidget.own'),
          ownHint: tChat('questionWidget.ownHint'),
          recommended: tChat('questionWidget.recommended'),
        }}
      />
    </AgentScope>
  )
}







function MessageAttachments({
  attachments,
  isUser,
  locale,
  onPreview,
  onEdit,
}: {
  attachments: ChatAssetAttachment[]
  isUser: boolean
  locale: ChatLocale
  onPreview: (asset: ChatAssetAttachment, group?: ChatAssetAttachment[]) => void
  onEdit: (asset: ChatAssetAttachment) => void
}) {
  if (isUser) {
    return (
      <UserAttachmentList
        attachments={attachments}
        onPreview={onPreview}
      />
    )
  }

  const visualAttachments = attachments.filter(isVisualAttachment)
  const fileAttachments = attachments.filter((asset) => !isVisualAttachment(asset))

  return (
    <div className="flex max-w-[min(560px,92vw)] flex-col gap-2">
      {visualAttachments.length > 0 && (
        <AssistantMediaGallery
          attachments={visualAttachments}
          locale={locale}
          onPreview={onPreview}
          onEdit={onEdit}
        />
      )}
      {fileAttachments.length > 0 && (
        <AssistantFileAttachmentList
          attachments={fileAttachments}
          onPreview={onPreview}
        />
      )}
    </div>
  )
}

function UserAttachmentList({
  attachments,
  onPreview,
}: {
  attachments: ChatAssetAttachment[]
  onPreview: (asset: ChatAssetAttachment, group?: ChatAssetAttachment[]) => void
}) {
  return (
    <div className="flex max-w-[min(560px,88vw)] flex-wrap justify-end gap-2">
      {attachments.map((asset) => (
        <CompactAttachmentPill
          key={asset.id}
          asset={asset}
          tone="user"
          onPreview={() => onPreview(asset, attachments)}
        />
      ))}
    </div>
  )
}

function AssistantFileAttachmentList({
  attachments,
  onPreview,
}: {
  attachments: ChatAssetAttachment[]
  onPreview: (asset: ChatAssetAttachment, group?: ChatAssetAttachment[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((asset) => (
        <CompactAttachmentPill
          key={asset.id}
          asset={asset}
          tone="assistant"
          onPreview={() => onPreview(asset, attachments)}
        />
      ))}
    </div>
  )
}

function CompactAttachmentPill({
  asset,
  tone,
  onPreview,
}: {
  asset: ChatAssetAttachment
  tone: 'user' | 'assistant'
  onPreview: () => void
}) {
  const href = asset.url ?? asset.previewUrl
  const previewable = Boolean(href && isVisualAttachment(asset))
  const className = cn(
    'flex h-14 max-w-[280px] items-center gap-2 rounded-[14px] border px-2 pr-3 text-left shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-colors dark:shadow-[0_12px_32px_rgba(0,0,0,0.18)]',
    tone === 'user'
      ? 'border-foreground/10 bg-foreground text-background hover:bg-foreground/90 dark:border-white/10 dark:bg-white/8 dark:text-white dark:hover:bg-white/12'
      : 'border-border/80 bg-card text-card-foreground hover:bg-muted dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:hover:bg-white/10',
  )
  const content = (
    <>
      <AttachmentThumb asset={asset} compact />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-current">{asset.name}</p>
        <p className="truncate text-xs capitalize text-current opacity-60">{formatAttachmentMeta(asset) || asset.kind}</p>
      </div>
    </>
  )

  if (previewable) {
    return (
      <button type="button" onClick={onPreview} className={className}>
        {content}
      </button>
    )
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    )
  }

  return (
    <div className={className}>
      {content}
    </div>
  )
}

function AssistantMediaGallery({
  attachments,
  locale,
  onPreview,
  onEdit,
}: {
  attachments: ChatAssetAttachment[]
  locale: ChatLocale
  onPreview: (asset: ChatAssetAttachment, group?: ChatAssetAttachment[]) => void
  onEdit: (asset: ChatAssetAttachment) => void
}) {
  const copy = useChatCopy()
  const visibleAttachments = attachments.slice(0, 4)
  const firstAsset = attachments[0]
  const multi = visibleAttachments.length > 1
  if (!firstAsset) return null

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[26px] bg-card shadow-[0_18px_46px_rgba(15,23,42,0.10)] ring-1 ring-border/80 dark:bg-white/[0.045] dark:shadow-[0_24px_70px_rgba(0,0,0,0.36)] dark:ring-white/8',
        multi ? 'grid aspect-square w-[min(520px,92vw)] grid-cols-2 gap-1 p-1' : 'w-[min(520px,92vw)]',
      )}
    >
      {visibleAttachments.map((asset, index) => {
        const hiddenCount = attachments.length - visibleAttachments.length
        const showOverflow = hiddenCount > 0 && index === visibleAttachments.length - 1

        return (
          <button
            key={asset.id}
            type="button"
            onClick={() => onPreview(asset, attachments)}
            className={cn(
              'relative block min-h-0 overflow-hidden bg-black text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50 dark:focus-visible:ring-white/50',
              multi ? 'aspect-square rounded-[20px]' : 'aspect-square rounded-[26px]',
            )}
            aria-label={copy.openMedia}
          >
            <MediaThumbnail asset={asset} className="h-full w-full" />
            {showOverflow && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/58 text-3xl font-semibold text-white">
                +{hiddenCount}
              </span>
            )}
          </button>
        )
      })}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        {firstAsset.kind === 'image' ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(firstAsset)
            }}
            className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full bg-black/62 px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.32)] backdrop-blur transition-colors hover:bg-white hover:text-black"
          >
            <PencilLine className="size-4" />
            {copy.generatedEdit}
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={() => onPreview(firstAsset, attachments)}
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/62 text-white shadow-[0_10px_30px_rgba(0,0,0,0.32)] backdrop-blur transition-colors hover:bg-white hover:text-black"
          aria-label={copy.openMedia}
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

function MediaThumbnail({
  asset,
  className,
}: {
  asset: ChatAssetAttachment
  className?: string
}) {
  const thumb = getMediaThumbnailUrl(asset)
  if (thumb) {
    return (
      <span className={cn('relative block overflow-hidden bg-black', className)}>
        <img src={thumb} alt={asset.name} className="h-full w-full object-cover" />
        {asset.kind === 'video' && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/12">
            <span className="flex size-10 items-center justify-center rounded-full bg-black/62 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur">
              <Play className="ml-0.5 size-4 fill-current" />
            </span>
          </span>
        )}
      </span>
    )
  }
  return (
    <span className={cn('flex items-center justify-center bg-muted text-muted-foreground dark:bg-black dark:text-white/48', className)}>
      <AttachmentKindIcon kind={asset.kind} className="size-10" />
    </span>
  )
}

function VideoAssetPlayer({
  asset,
  autoPlay = false,
  className,
}: {
  asset: ChatAssetAttachment
  autoPlay?: boolean
  className?: string
}) {
  const src = getPlayableMediaUrl(asset)
  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-muted text-muted-foreground dark:bg-black dark:text-white/48', className)}>
        <Film className="size-12" />
      </div>
    )
  }
  if (isEmbeddableVideoUrl(src)) {
    return (
      <iframe
        src={src}
        title={asset.name}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={cn('border-0 bg-black', className)}
      />
    )
  }
  return (
    <video
      src={src}
      controls
      autoPlay={autoPlay}
      playsInline
      preload="metadata"
      poster={getMediaThumbnailUrl(asset) ?? undefined}
      className={cn('bg-black object-contain', className)}
    />
  )
}

function AttachmentPreview({ asset }: { asset: ChatAssetAttachment }) {
  const src = getPlayableMediaUrl(asset)
  if (src && asset.kind === 'image') {
    return <img src={src} alt={asset.name} className="h-full w-full object-cover" />
  }
  if (src && asset.kind === 'video') {
    return <VideoAssetPlayer asset={asset} className="h-full w-full" />
  }
  if (src && asset.kind === 'audio') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <audio src={src} controls className="w-full" />
      </div>
    )
  }
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground dark:text-white/48">
      <AttachmentKindIcon kind={asset.kind} className="size-9" />
    </div>
  )

}

function AttachmentThumb({ asset, compact = false }: { asset: ChatAssetAttachment; compact?: boolean }) {
  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground dark:bg-black/35 dark:text-white/58', compact ? 'size-12' : 'size-16')}>
      {isVisualAttachment(asset) ? (
        <MediaThumbnail asset={asset} className="h-full w-full" />
      ) : (
        <AttachmentKindIcon kind={asset.kind} className={compact ? 'size-5' : 'size-7'} />
      )}
    </div>
  )
}



function findPendingQuickQuestion(messages: AssistantMessage[], runState: AssistantRunState | null, locale: ChatLocale, copy: ChatCopy): PendingQuickQuestion | null {
  if (runState !== 'waiting_for_user') return null
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message || message.role !== 'assistant') {
      if (message?.role === 'user') return null
      continue
    }
    if (!isQuickQuestionMessage(message)) return null
    return buildPendingQuickQuestion(message, locale, copy)
  }
  return null
}

function findPendingRunAction(messages: AssistantMessage[], runState: AssistantRunState | null): PendingRunAction | null {
  if (runState !== 'waiting_for_user') return null
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message || message.role !== 'assistant') {
      if (message?.role === 'user') return null
      continue
    }
    const contentJson = readRecord(message.content_json)
    const type = getString(contentJson.type)
    if (type !== 'assistant.approval_required_message') return null
    const toolId = getString(contentJson.tool_id)
    if (!toolId) return null
    const approvalTarget = readAssistantApprovalTarget(contentJson, { type: 'tool', id: toolId })
    if (!approvalTarget) return null
    return {
      messageId: message.id,
      prompt: cleanQuestionPrompt(message.content),
      reason: getString(contentJson.reason),
      toolId,
      approvalTarget,
    }
  }
  return null
}

function isQuickQuestionMessage(message: AssistantMessage) {
  if (message.role !== 'assistant') return false
  const type = getString(readRecord(message.content_json)?.type)
  return type === 'assistant.requirements_question'
}

function isAssistantControlMessage(message: AssistantMessage) {
  if (message.role !== 'assistant') return false
  const type = getString(readRecord(message.content_json)?.type)
  return type === 'assistant.requirements_question'
    || type === 'assistant.approval_required_message'
}

function isWorkflowDraftRunnable(
  workflowDraft: WorkflowDraftAttachment,
  activeRunId: string | null,
  runState: AssistantRunState | null,
) {
  const sameRun = Boolean(workflowDraft.runId && activeRunId && workflowDraft.runId === activeRunId)
  return sameRun
    && workflowDraft.approvalTarget?.type === 'draft'
    && workflowDraft.approvalTarget.id === workflowDraft.id
    && runState === 'waiting_for_user'
    && (workflowDraft.status === 'awaiting_approval' || workflowDraft.status === 'approved')
}

function buildPendingQuickQuestion(message: AssistantMessage, locale: ChatLocale, copy: ChatCopy): PendingQuickQuestion {
  const contentJson = readRecord(message.content_json)
  const requiredSlots = readStringArray(contentJson.required_slots)
  const waitingReason = getString(contentJson.waiting_reason) ?? getString(contentJson.reason)
  // P03-23: a server-sent B question carries its typed chip options (recommendation first).
  const options = readInteractionQuestionOptions(contentJson) ?? inferQuickQuestionOptions(message.content, locale, copy)
  const typed = readRecord(contentJson.question)
  return {
    messageId: message.id,
    prompt: cleanQuestionPrompt(message.content),
    chip: getString(typed.chip) ?? getString(typed.field_key),
    options,
    requiredSlots,
    waitingReason,
  }
}

function inferQuickQuestionOptions(content: string, locale: ChatLocale, copy: ChatCopy): QuickQuestionOption[] {
  const normalized = content.replace(/\s+/g, ' ').trim()
  const options: QuickQuestionOption[] = []
  const letterMatches = [...normalized.matchAll(/\(([A-D])\)\s*([^()]{2,80}?)(?=\s*\([A-D]\)|$)/gi)]
  for (const match of letterMatches) {
    const key = match[1]?.toUpperCase()
    const label = match[2]?.replace(/[?.:,;]+$/g, '').trim()
    if (key && label) options.push({ label: `${key}: ${label}`, value: label })
  }

  if (options.length === 0 && /(evet\s*\/\s*hay[ıi]r|yes\s*\/\s*no|ja\s*\/\s*nein)/i.test(normalized)) {
    options.push({ label: copy.yes, value: copy.yes }, { label: copy.no, value: copy.no })
  }
  if (options.length === 0 && /ayn[ıi]\s*\/\s*farkl[ıi]/i.test(normalized)) {
    options.push({ label: copy.same, value: copy.sameValue }, { label: copy.different, value: copy.differentValue })
  }

  const defaultValue = copy.quickDecisionDefaultValue
  const fallbackValue = copy.quickDecisionContinueValue
  const withDefault = [{ label: copy.quickDecisionDefault, value: defaultValue }, ...dedupeQuickOptions(options)]
  return withDefault.length > 1
    ? withDefault.slice(0, 4)
    : [...withDefault, { label: copy.quickDecisionContinue, value: fallbackValue }]
}

function dedupeQuickOptions(options: QuickQuestionOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = option.label.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cleanQuestionPrompt(content: string) {
  return content
    .replace(/\s+/g, ' ')
    .replace(/\(([A-D])\)\s*/gi, '$1: ')
    .trim()
    .slice(0, 280)
}

// The planner emits arbitrary snake_case field keys (required_slots, e.g. "duration_seconds");
// there is no per-field label/type schema yet (P00-13 assistant "question object" is not in
// contracts/agentic-spark yet), so this only humanizes the key itself rather than inventing copy.
function humanizeRequiredFieldKey(key: string) {
  const spaced = key.replace(/_/g, ' ').trim()
  return spaced.length > 0 ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key
}

function extractMessageAttachments(message: AssistantMessage): ChatAssetAttachment[] {
  const fromContentJson = [
    ...readAttachmentArray(readRecord(message.content_json).attachments, message),
    ...readAttachmentArray(readRecord(message.content_json).media_refs, message),
  ]
  const fromContent = message.role === 'assistant' ? extractGeneratedMediaAttachments(message.content) : []
  return dedupeAttachments([...fromContentJson, ...fromContent])
}

function readAttachmentArray(value: unknown, message: AssistantMessage): ChatAssetAttachment[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 256)
    .map((item, index) => attachmentFromUnknown(item, message, index))
    .filter((item): item is ChatAssetAttachment => Boolean(item))
}

function attachmentFromUnknown(value: unknown, message: AssistantMessage, index: number): ChatAssetAttachment | null {
  const record = readRecord(value)
  const rawUrl = readMediaRecordUrl(record)
  const explicitPreviewUrl = readMediaRecordPreviewUrl(record)
  const rawPreviewUrl = explicitPreviewUrl ?? rawUrl
  const objectId = getString(record.storage_object_id)
    ?? getString(record.storageObjectId)
    ?? getString(record.object_id)
    ?? getString(record.objectId)
    ?? getChatStorageObjectIdFromUri(rawUrl)
    ?? getChatStorageObjectIdFromUri(rawPreviewUrl)
  const channelId = getString(record.storage_channel_id)
    ?? getString(record.storageChannelId)
    ?? getString(record.channel_id)
    ?? getString(record.channelId)
  const name = getString(record.name) ?? getString(record.file_name) ?? getString(record.image_id) ?? getString(record.video_id) ?? `asset-${index + 1}`
  const mimeType = getString(record.mime_type) ?? getString(record.content_type)
  const kind = readAttachmentKind(record.kind) ?? inferAttachmentKind({ url: rawUrl, mimeType, name })
  if (!rawUrl && !rawPreviewUrl && !objectId) return null
  const stableDownloadUrl = channelId && objectId
    ? getStorageDownloadUrl({ channelId, objectId, fileName: name })
    : null
  const stablePlaybackUrl = channelId && objectId && kind === 'video'
    ? getStoragePlaybackUrl({ channelId, objectId })
    : null
  const url = stablePlaybackUrl ?? (getChatStorageObjectIdFromUri(rawUrl) ? stableDownloadUrl : rawUrl)
  const previewUrl = kind === 'video' && !explicitPreviewUrl
    ? null
    : getChatStorageObjectIdFromUri(rawPreviewUrl) ? stableDownloadUrl : rawPreviewUrl
  return {
    id: getString(record.id) ?? objectId ?? `${message.id}:asset:${index}`,
    objectId,
    channelId,
    kind,
    name,
    url: url ?? stableDownloadUrl ?? previewUrl,
    previewUrl: previewUrl ?? (kind === 'image' ? stableDownloadUrl : null),
    mimeType,
    source: readAttachmentSource(record.source) ?? 'storage',
    sizeBytes: getString(record.size_bytes) ?? null,
    status: getString(record.status) ?? null,
    metadata: readRecord(record.metadata),
  }
}

function extractMessageWorkflowDraft(message: AssistantMessage): WorkflowDraftAttachment | null {
  if (message.role !== 'assistant') return null
  const contentJson = readRecord(message.content_json)
  if (getString(contentJson.type) !== 'assistant.workflow_draft') return null
  const dslJson = readRecord(contentJson.dsl_json)
  if (Object.keys(dslJson).length === 0) return null
  const draftId = getString(contentJson.draft_id) ?? `${message.id}:workflow-draft`
  return {
    id: draftId,
    messageId: message.id,
    runId: message.run_id,
    approvalTarget: readAssistantApprovalTarget(contentJson, { type: 'draft', id: draftId }),
    goal: getString(contentJson.goal) ?? 'Workflow draft',
    status: getString(contentJson.status) ?? 'drafting',
    plannedSteps: readUnknownArray(contentJson.planned_steps),
    missingSlots: readUnknownArray(contentJson.missing_slots),
    dslJson,
    estimateJson: readRecord(contentJson.estimate_json),
    providerStrategy: getString(contentJson.provider_strategy),
  }
}

function readMediaRecordUrl(record: Record<string, unknown>) {
  return getString(record.cdn_url)
    ?? getString(record.video_url)
    ?? getString(record.playback_url)
    ?? getString(record.player_url)
    ?? getString(record.stream_url)
    ?? getString(record.embed_url)
    ?? getString(record.image_url)
    ?? getString(record.artifact_url)
    ?? getString(record.download_url)
    ?? getString(record.url)
}

function readMediaRecordPreviewUrl(record: Record<string, unknown>) {
  return getString(record.preview_url)
    ?? getString(record.previewUrl)
    ?? getString(record.thumbnail_url)
    ?? getString(record.thumbnailUrl)
    ?? getString(record.poster_url)
    ?? getString(record.posterUrl)
}

function extractGeneratedMediaAttachments(content: string): ChatAssetAttachment[] {
  const parsed = parseJsonMaybe(content)
  const records = parsed
    ? collectGeneratedMediaRecords(parsed)
    : extractPlainMediaUrlRecords(content)
  return records.map((record, index) => {
    const url = readMediaRecordUrl(record)
    const name = getString(record.image_id) ?? getString(record.video_id) ?? getString(record.name) ?? `generated-media-${index + 1}`
    const mimeType = getString(record.content_type) ?? getString(record.mime_type) ?? inferMimeTypeFromUrl(url) ?? 'image/png'
    const previewUrl = readMediaRecordPreviewUrl(record) ?? url
    return {
      id: getString(record.image_id) ?? getString(record.video_id) ?? url ?? `generated:${index}`,
      kind: inferAttachmentKind({ url, mimeType, name }),
      name,
      url,
      previewUrl,
      mimeType,
      source: 'generated' as const,
      metadata: readRecord(record),
    }
  }).filter((asset) => Boolean(asset.url))
}

function extractPlainMediaUrlRecords(content: string): Record<string, unknown>[] {
  return [...content.matchAll(MEDIA_URL_PATTERN)]
    .slice(0, 64)
    .map((match) => normalizeExtractedUrl(match[0] ?? ''))
    .filter((url): url is string => Boolean(url && looksLikeRenderableMediaUrl(url)))
    .map((url, index) => ({
      url,
      name: inferFileNameFromUrl(url) ?? `generated-media-${index + 1}`,
    }))
}

function collectGeneratedMediaRecords(value: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = []
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }]
  let visited = 0
  while (stack.length > 0 && visited < 5_000 && records.length < 64) {
    const current = stack.pop()!
    visited += 1
    if (current.depth > 8 || !current.value || typeof current.value !== 'object') continue
    if (Array.isArray(current.value)) {
      for (let index = Math.min(current.value.length, 256) - 1; index >= 0; index -= 1) {
        stack.push({ value: current.value[index], depth: current.depth + 1 })
      }
      continue
    }
    const record = current.value as Record<string, unknown>
    const directUrl = readMediaRecordUrl(record)
    if (directUrl && looksLikeRenderableMediaUrl(directUrl)) records.push(record)
    for (const key of ['result', 'image', 'images', 'video', 'videos', 'media', 'media_refs', 'artifacts', 'files', 'outputs', 'output']) {
      const child = record[key]
      if (child && typeof child === 'object') {
        stack.push({ value: child, depth: current.depth + 1 })
      }
    }
  }
  return records
}

function serializeChatAttachments(attachments: ChatAssetAttachment[]) {
  return attachments.map((asset) => {
    const objectId = asset.objectId ?? getChatStorageObjectIdFromUri(asset.url)
    const canonicalUrl = objectId ? `storage://${objectId}` : persistableChatUrl(asset.url)
    return {
      id: asset.id,
      object_id: objectId ?? undefined,
      storage_object_id: objectId ?? undefined,
      channel_id: asset.channelId ?? undefined,
      storage_channel_id: asset.channelId ?? undefined,
      kind: asset.kind,
      name: asset.name,
      url: canonicalUrl ?? undefined,
      preview_url: objectId ? canonicalUrl : persistableChatUrl(asset.previewUrl) ?? undefined,
      mime_type: asset.mimeType ?? undefined,
      source: asset.source,
      size_bytes: asset.sizeBytes ?? undefined,
      status: asset.status ?? undefined,
      metadata: sanitizePersistedChatValue(asset.metadata) ?? undefined,
    }
  })
}

const CHAT_DELIVERY_CAPABILITY_QUERY_KEYS = new Set([
  'auth',
  'authorization',
  'authorizationexpire',
  'exp',
  'expiration',
  'expires',
  'sig',
  'signature',
  'token',
  'x-amz-credential',
  'x-amz-expires',
  'x-amz-signature',
])

function persistableChatUrl(value: string | null | undefined) {
  if (!value || value.startsWith('blob:') || value.length > 8_000) return null
  if (!/^https?:\/\//i.test(value)) return value
  try {
    const url = new URL(value)
    return [...url.searchParams.keys()].some((key) => CHAT_DELIVERY_CAPABILITY_QUERY_KEYS.has(key.toLowerCase()))
      ? null
      : value
  } catch {
    return null
  }
}

function getChatStorageObjectIdFromUri(value: string | null | undefined) {
  if (!value) return null
  const match = /^storage:\/\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/.exec(value.trim())
  return match?.[1] ?? null
}

function sanitizePersistedChatValue(
  value: unknown,
  depth = 0,
  state: { seen: WeakSet<object>; visited: number } = { seen: new WeakSet<object>(), visited: 0 },
): unknown {
  if (typeof value === 'string') return persistableChatUrl(value)
  if (!value || typeof value !== 'object') return value
  if (depth >= 16 || state.visited >= 2_000 || state.seen.has(value)) return null
  state.seen.add(value)
  state.visited += 1
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePersistedChatValue(item, depth + 1, state))
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (['delivery_url_expires_at', 'deliveryUrlExpiresAt'].includes(key)) return []
    return [[key, sanitizePersistedChatValue(child, depth + 1, state)]]
  }))
}

function dedupeAttachments(attachments: ChatAssetAttachment[]) {
  const seen = new Set<string>()
  return attachments.filter((asset) => {
    const key = asset.objectId ?? asset.url ?? asset.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 256)
}



function readAttachmentKind(value: unknown): ChatAssetKind | null {
  return value === 'image' || value === 'video' || value === 'audio' || value === 'document' || value === 'file' ? value : null
}

function readAttachmentSource(value: unknown): ChatAssetAttachment['source'] | null {
  return value === 'storage' || value === 'upload' || value === 'generated' ? value : null
}


function looksLikeRenderableMediaUrl(value: string) {
  if (/^\s*data:/i.test(value)) return false
  return value.startsWith('/api/storage/download')
    || looksLikeYoutorchMediaUrl(value)
    || isVideoMediaUrl(value)
    || /\/(png|jpe?g|gif|webp|svg|bmp|ico|tiff|mp4|webm|mov|m3u8)(?:[?#].*)?$/i.test(value)
    || /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff|mp4|webm|mov|m3u8)(?:[?#].*)?$/i.test(value)
}

function getPlayableMediaUrl(asset: ChatAssetAttachment) {
  return asset.url ?? asset.previewUrl ?? null
}


function inferMimeTypeFromUrl(value: string | null | undefined) {
  if (!value) return null
  if (isVideoMediaUrl(value)) return isHlsVideoUrl(value) ? 'application/vnd.apple.mpegurl' : 'video/mp4'
  if (isImageMediaUrl(value)) return 'image/png'
  return null
}


function normalizeExtractedUrl(value: string) {
  return value.trim().replace(/[.,;:!?]+$/g, '').replace(/\)+$/g, '')
}

function inferFileNameFromUrl(value: string) {
  try {
    const parsed = new URL(value)
    const fileName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '')
    if (/^(png|jpe?g|gif|webp|svg|bmp|ico|tiff|mp4|webm|mov|m3u8)$/i.test(fileName)) return null
    return fileName || null
  } catch {
    return null
  }
}

function isJsonLike(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

function parseJsonMaybe(value: string): unknown {
  if (!isJsonLike(value)) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function readUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}


function mergeMessages(current: AssistantMessage[], incoming: AssistantMessage[]) {
  const map = new Map<string, AssistantMessage>()
  for (const message of current) map.set(message.id, message)
  for (const message of incoming) map.set(message.id, message)
  return Array.from(map.values()).sort((left, right) => {
    const diff = Date.parse(left.created_at) - Date.parse(right.created_at)
    return diff === 0 ? left.id.localeCompare(right.id) : diff
  })
}

function mergeRunEvents(current: AssistantRunEvent[], incoming: AssistantRunEvent[]) {
  const map = new Map<string, AssistantRunEvent>()
  for (const event of current) map.set(eventKey(event), event)
  for (const event of incoming) {
    if (event.transient || event.sequence <= 0) continue
    map.set(eventKey(event), event)
  }
  return Array.from(map.values()).sort((left, right) => left.sequence - right.sequence)
}



function createOptimisticUserMessage(input: {
  conversationId?: string | null
  content: string
  attachments?: ChatAssetAttachment[]
}): AssistantMessage {
  const now = new Date().toISOString()
  const id = globalThis.crypto?.randomUUID
    ? `optimistic:${globalThis.crypto.randomUUID()}`
    : `optimistic:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`

  return {
    id,
    conversation_id: input.conversationId ?? 'optimistic',
    run_id: null,
    role: 'user',
    content: input.content,
    content_json: input.attachments && input.attachments.length > 0
      ? {
        attachments: serializeChatAttachments(input.attachments),
        media_refs: serializeChatAttachments(input.attachments),
      }
      : {},
    status: 'sending',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
}

function createEmptyDraftStream(): DraftStreamState {
  return {
    runId: null,
    messageDraftId: null,
    displayedContent: '',
    targetContent: '',
    lastChunkIndex: null,
  }
}

function hasPendingDraftText(stream: DraftStreamState) {
  return stream.targetContent.length > stream.displayedContent.length
}

function isDifferentDraftStream(stream: DraftStreamState, runId: string, messageDraftId: string | null) {
  return (
    (stream.runId !== null && stream.runId !== runId)
    || Boolean(stream.messageDraftId && messageDraftId && stream.messageDraftId !== messageDraftId)
  )
}

function takeDraftRevealSlice(remaining: string) {
  if (remaining.length <= 0) return ''
  const characters = Array.from(remaining)
  const revealCount = getDraftRevealCount(characters.length)
  return characters.slice(0, revealCount).join('')
}

function getDraftRevealCount(remainingLength: number) {
  if (remainingLength > 1600) return 72
  if (remainingLength > 900) return 56
  if (remainingLength > 420) return 36
  if (remainingLength > 180) return 20
  if (remainingLength > 64) return 10
  return 4
}

function eventKey(event: AssistantRunEvent) {
  return `${event.run_id}:${event.sequence}`
}

function findLatestRunId(messages: AssistantMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const runId = getString(messages[index]?.run_id)
    if (runId) return runId
  }
  return null
}

function isCancellationRunState(state: AssistantRunState | null) {
  return state === 'cancelling' || state === 'draining' || state === 'cancellation_attention_required'
}

function shouldRefreshConversation(event: AssistantRunEvent) {
  return (
    event.event_type === 'message.created'
    || event.event_type === 'conversation.title.updated'
    || event.event_type === 'run.completed'
    || event.event_type === 'run.failed'
    || event.event_type === 'run.cancelled'
  )
}

function findLatestDraftSnapshotEvent(events: AssistantRunEvent[], runId: string) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event || event.run_id !== runId || event.event_type !== 'message.draft.updated') continue
    const content = getRawString(event.payload.content_snapshot)
    if (content === null || content.length === 0) continue
    return event
  }
  return null
}

function findLatestPaymentWait(events: AssistantRunEvent[]): PaymentWaitInfo {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event) continue
    if (event.event_type !== 'payment.waiting' && event.event_type !== 'payment.resume_failed') continue
    return {
      message: getString(event.payload.message),
      reason: getString(event.payload.reason),
    }
  }
  return { message: null, reason: null }
}

function buildAssistantReviewThreadIds(runId: string | null, conversationId: string | null): string[] {
  const ids: string[] = []
  if (runId) ids.push(`assistant:run:${runId}`)
  if (conversationId) ids.push(`assistant:conversation:${conversationId}`)
  return Array.from(new Set(ids))
}

function isAssistantInlineReviewItem(item: ReviewItem, runId: string | null, conversationId: string | null) {
  if (item.item_type !== 'request' || item.status !== 'pending') return false
  // P03-09: a G1 plan request's chat view is the job's production card, not the generic inline Review card.
  if (item.payload.production_g1 === true) return false
  // Surface-independent (P01-12, PR #313): a request bound to this run/conversation thread
  // is found on reopen whether its delivery_surface is still chat_inline or was promoted to
  // inbox by the watchdog; the thread/run/conversation match below is what identifies it.
  const assistant = readRecord(item.payload.assistant)
  const payloadRunId = getString(item.payload.assistant_run_id) ?? getString(assistant.run_id) ?? getString(assistant.runId)
  const payloadConversationId = getString(item.payload.assistant_conversation_id)
    ?? getString(assistant.conversation_id)
    ?? getString(assistant.conversationId)

  if (runId && (payloadRunId === runId || item.thread_id === `assistant:run:${runId}`)) return true
  if (conversationId && (payloadConversationId === conversationId || item.thread_id === `assistant:conversation:${conversationId}`)) return true
  return false
}

function getInlineReviewDetail(item: ReviewItem, t: ChatTranslator) {
  const nodeInputs = readRecord(item.payload.node_inputs)
  const reason = getString(item.payload.reason)
    ?? getString(item.payload.approval_reason)
    ?? getString(nodeInputs.reason)
    ?? getString(nodeInputs.description)
  const impact = getString(item.payload.approval_impact)
  const workflowId = getString(item.payload.workflow_id)
  const nodeKey = getString(item.payload.node_key)
  const target = nodeKey && workflowId ? `${workflowId} / ${nodeKey}` : workflowId ?? nodeKey

  if (reason && impact) return t('review.reasonImpact', { reason, impact })
  if (impact) return impact
  if (reason && target) return t('review.reasonTarget', { reason, target })
  if (reason) return t('review.reason', { reason })
  if (target) return t('review.target', { target })
  return t('review.fallback')
}

function buildActiveRunVisual({
  events,
  liveEvent,
  activeRunId,
  messages,
  t,
}: {
  events: AssistantRunEvent[]
  liveEvent: AssistantRunEvent | null
  activeRunId: string | null
  messages: AssistantMessage[]
  t: ChatTranslator
}): ActiveRunVisual | null {
  if (!activeRunId) return null
  const scopedEvents = [
    ...events.filter((event) => event.run_id === activeRunId),
    ...(liveEvent && liveEvent.run_id === activeRunId ? [liveEvent] : []),
  ]
  const latestPayload = findLatestVisualPayload(scopedEvents, t)
  // Nothing is being made yet (the agent reads and plans): no media task, only the reasoning line.
  if (!latestPayload.nodeType && !latestPayload.artifactKind && latestPayload.progress === null) return null
  const lastUserMessage = findLastUserMessage(messages)
  const textSignal = `${latestPayload.nodeType ?? ''} ${latestPayload.artifactKind ?? ''} ${lastUserMessage ?? ''}`.toLowerCase()
  const kind = inferActiveVisualKind(textSignal, latestPayload)
  if (!kind) return null

  const progress = latestPayload.progress
  const retryLabel = buildRetryLabel(scopedEvents, t)
  const steps = buildVisualSteps(scopedEvents, latestPayload, kind, t)
  const title = visualTitle(kind, t)
  const detail = visualDetail(kind, progress, t)
  return {
    kind,
    outputs: Math.min(4, Math.max(1, Math.round(latestPayload.outputs ?? 1))),
    title,
    detail,
    promptPreview: latestPayload.promptPreview ?? lastUserMessage,
    aspectRatio: latestPayload.aspectRatio,
    providerStrategy: latestPayload.providerStrategy,
    progress,
    retryLabel,
    steps,
  }
}

function findLatestVisualPayload(events: AssistantRunEvent[], t: ChatTranslator) {
  let nodeType: string | null = null
  let artifactKind: string | null = null
  let aspectRatio: string | null = null
  let providerStrategy: string | null = null
  let promptPreview: string | null = null
  let plannedSteps: ActiveRunVisualStep[] = []
  let progress: number | null = null
  let outputs: number | null = null
  for (const event of events) {
    outputs = getNumber(event.payload.output_count) ?? getNumber(event.payload.count) ?? getNumber(event.payload.num_outputs) ?? outputs
    nodeType = getString(event.payload.node_type) ?? nodeType
    artifactKind = getString(event.payload.artifact_kind) ?? artifactKind
    aspectRatio = getString(event.payload.aspect_ratio) ?? aspectRatio
    providerStrategy = getString(event.payload.provider_strategy) ?? providerStrategy
    promptPreview = getString(event.payload.prompt_preview) ?? getString(event.payload.goal) ?? promptPreview
    progress = getNumber(event.payload.progress) ?? progress
    const steps = normalizeVisualSteps(event.payload.planned_steps, t)
    if (steps.length > 0) plannedSteps = steps
    const milestone = getString(event.payload.milestone)
    if (milestone?.startsWith('image.')) artifactKind = 'image'
    if (milestone?.startsWith('video.')) artifactKind = 'video'
    if (event.event_type === 'workflow_draft.created') artifactKind = 'workflow'
  }
  return { nodeType, artifactKind, aspectRatio, providerStrategy, promptPreview, plannedSteps, progress, outputs }
}

function inferActiveVisualKind(
  textSignal: string,
  payload: ReturnType<typeof findLatestVisualPayload>,
): ActiveRunVisualKind | null {
  if (payload.artifactKind === 'image' || /image|gorsel|görsel|resim|mock|sneaker/.test(textSignal)) return 'image'
  if (payload.artifactKind === 'video' || /video|render|film|shorts|reels/.test(textSignal)) return 'video'
  if (payload.artifactKind === 'workflow' || payload.plannedSteps.length > 0 || /workflow|dsl|ak[ıi]s|akış/.test(textSignal)) return 'workflow'
  if (/agent|tool/.test(textSignal)) return 'agent'
  return null
}

function buildVisualSteps(
  events: AssistantRunEvent[],
  payload: ReturnType<typeof findLatestVisualPayload>,
  kind: ActiveRunVisualKind,
  t: ChatTranslator,
): ActiveRunVisualStep[] {
  if (payload.plannedSteps.length > 0) return payload.plannedSteps
  const latestEvent = events[events.length - 1]
  const hasFailure = events.some((event) => event.event_type === 'run.failed' || /failed$/.test(event.event_type))
  if (kind === 'image') {
    return [
      { label: t('visual.prompt'), status: 'completed' },
      { label: t('visual.imageGeneration'), status: hasFailure ? 'failed' : latestEvent?.event_type === 'workflow_handoff.created' ? 'active' : 'pending' },
      { label: t('visual.attachResult'), status: 'pending' },
    ]
  }
  if (kind === 'video') {
    return [
      { label: t('visual.planScenes'), status: 'completed' },
      { label: t('visual.render'), status: hasFailure ? 'failed' : 'active' },
      { label: t('visual.attachVideo'), status: 'pending' },
    ]
  }
  if (kind === 'workflow') {
    return [
      { label: t('visual.buildDsl'), status: 'completed' },
      { label: t('visual.estimateValidate'), status: 'active' },
      { label: t('visual.waitApproval'), status: 'pending' },
    ]
  }
  return [
    { label: t('visual.startTool'), status: latestEvent?.event_type === 'tool_call.started' ? 'active' : 'completed' },
    { label: t('visual.trackResult'), status: hasFailure ? 'failed' : 'pending' },
  ]
}

function normalizeVisualSteps(value: unknown, t: ChatTranslator): ActiveRunVisualStep[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 6).flatMap((item, index) => {
    const record = readRecord(item)
    const label = getString(record.label)
      ?? getString(record.name)
      ?? getString(record.node_type)
      ?? getString(record.type)
      ?? getString(record.node_key)
      ?? t('visual.step', { number: index + 1 })
    const rawStatus = getString(record.status)
    return [{
      label,
      status: normalizeVisualStepStatus(rawStatus, index),
    }]
  })
}

function normalizeVisualStepStatus(value: string | null, index: number): ActiveRunVisualStep['status'] {
  if (value === 'completed' || value === 'done' || value === 'success') return 'completed'
  if (value === 'failed' || value === 'error') return 'failed'
  if (value === 'running' || value === 'active' || value === 'processing') return 'active'
  return index === 0 ? 'active' : 'pending'
}

function buildRetryLabel(events: AssistantRunEvent[], t: ChatTranslator) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.event_type !== 'run.retry_scheduled') continue
    const retryCount = getNumber(event.payload.retry_count)
    const maxRetries = getNumber(event.payload.max_retries)
    return retryCount && maxRetries
      ? t('visual.retryCount', { retryCount, maxRetries })
      : t('visual.retrying')
  }
  return null
}

function visualTitle(kind: ActiveRunVisualKind, t: ChatTranslator) {
  if (kind === 'image') return t('visual.imageTitle')
  if (kind === 'video') return t('visual.videoTitle')
  if (kind === 'workflow') return t('visual.workflowTitle')
  return t('visual.agentTitle')
}

function visualDetail(kind: ActiveRunVisualKind, progress: number | null, t: ChatTranslator) {
  if (kind === 'image') return progress === null
    ? t('visual.imageDetail')
    : t('visual.imageProgress', { progress })
  if (kind === 'video') return progress === null
    ? t('visual.videoDetail')
    : t('visual.videoProgress', { progress })
  if (kind === 'workflow') return t('visual.workflowDetail')
  return t('visual.agentDetail')
}

function findLastUserMessage(messages: AssistantMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === 'user' && message.content.trim()) return message.content.trim()
  }
  return null
}

function getRunFailureCopy(events: AssistantRunEvent[], activeRunId: string, t: ChatTranslator) {
  const failure = classifyAssistantRunFailure(events, activeRunId)
  if (failure.kind === 'credits') {
    return { title: t('failure.creditsTitle'), detail: t('failure.creditsDetail'), replanWithoutSkill: false }
  }
  if (failure.kind === 'service') {
    return { title: t('failure.serviceTitle'), detail: t('failure.serviceDetail'), replanWithoutSkill: false }
  }
  if (failure.kind === 'skill_removed') {
    // S12/S26: nothing was started; the user decides whether a new (paid) plan is prepared without the skill.
    return {
      title: t('failure.skillRemovedTitle'),
      detail: failure.reasonCode === 'skill_revoked' ? t('failure.skillRevokedDetail') : t('failure.skillUnavailableDetail'),
      replanWithoutSkill: true,
    }
  }
  return { title: t('failure.replyTitle'), detail: t('failure.replyDetail'), replanWithoutSkill: false }
}

function findLatestNarrationEvent(
  events: AssistantRunEvent[],
  liveEvent: AssistantRunEvent | null,
  activeRunId: string | null,
  t: ChatTranslator,
) {
  if (liveEvent && (!activeRunId || liveEvent.run_id === activeRunId) && eventHasNarration(liveEvent, t)) {
    return liveEvent
  }
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event) continue
    if (activeRunId && event.run_id !== activeRunId) continue
    if (eventHasNarration(event, t)) return event
  }
  return null
}

function eventHasNarration(event: AssistantRunEvent, t: ChatTranslator) {
  return getEventNarration(event, t) !== null
}

function getProgressCopy({
  state,
  event,
  t,
  hasDraft,
}: {
  state: AssistantRunState | null
  event: AssistantRunEvent | null
  t: ChatTranslator
  hasDraft: boolean
}) {
  const eventNarration = event ? getEventNarration(event, t) : null
  if (eventNarration) {
    return {
      title: hasDraft ? t('copy.finishing') : eventNarration.title,
      detail: hasDraft ? eventNarration.title : eventNarration.detail,
      progress: eventNarration.progress,
    }
  }
  if (state === 'waiting_on_workflow') {
    return { title: t('progress.workflowTitle'), detail: t('progress.workflowDetail'), progress: null }
  }
  if (state === 'waiting_on_agent') {
    return { title: t('progress.agentTitle'), detail: t('progress.agentDetail'), progress: null }
  }
  if (state === 'cancelling' || state === 'draining') {
    return {
      title: t('progress.cancelTitle'),
      detail: t(state === 'draining' ? 'progress.cancelDraining' : 'progress.cancelCleaning'),
      progress: null,
    }
  }
  if (state === 'cancellation_attention_required') {
    return { title: t('progress.cancelReviewTitle'), detail: t('progress.cancelReviewDetail'), progress: null }
  }
  return { title: t('copy.thinking'), detail: t('progress.thinkingDetail'), progress: null }
}

function getEventNarration(event: AssistantRunEvent, t: ChatTranslator): { title: string; detail: string | null; progress: number | null } | null {
  if (event.payload.delivery_status === 'payment_review') return {
    title: t('progress.paymentReviewTitle'), detail: t('progress.paymentReviewDetail'), progress: null,
  }
  const progress = getNumber(event.payload.progress)
  const milestone = getString(event.payload.milestone)
  if (event.event_type === 'assistant.status.updated') {
    return statusStageNarration(getString(event.payload.stage), t)
  }
  if (event.event_type === 'assistant.workflow.progress') {
    const fromMilestone = milestone ? milestoneNarration(milestone, t, progress) : null
    if (fromMilestone) return fromMilestone
    return {
      title: t('progress.productionTitle'),
      detail: progress === null ? t('progress.productionTracking') : t('progress.productionPercent', { progress }),
      progress,
    }
  }
  const fromMilestone = milestoneNarration(event.event_type, t, progress)
  if (fromMilestone) return fromMilestone
  if (event.event_type === 'tool_call.started') {
    const isAgent = getString(event.payload.handoff_type) === 'agent'
    return {
      title: t(isAgent ? 'progress.toolStartingTitle' : 'progress.workflowCreatingTitle'),
      detail: t(isAgent ? 'progress.toolStartingDetail' : 'progress.workflowCreatingDetail'),
      progress: null,
    }
  }
  if (event.event_type === 'workflow_handoff.created') {
    const isAgent = getString(event.payload.handoff_type) === 'agent'
    return {
      title: t(isAgent ? 'progress.agentTrackingTitle' : 'progress.workflowTrackingTitle'),
      detail: t('progress.trackingDetail'),
      progress: null,
    }
  }
  if (event.event_type === 'workflow_draft.created') {
    return { title: t('progress.draftTitle'), detail: t('progress.draftDetail'), progress: null }
  }
  if (event.event_type === 'run.retry_scheduled') {
    const retryCount = getNumber(event.payload.retry_count)
    const maxRetries = getNumber(event.payload.max_retries)
    return {
      title: t('progress.retryTitle'),
      detail: retryCount && maxRetries
        ? t('progress.retryAttempt', { retryCount, maxRetries })
        : t('progress.retryDetail'),
      progress: null,
    }
  }
  if (event.event_type === 'tool_call.completed') {
    return { title: t('progress.toolStartedTitle'), detail: t('progress.toolStartedDetail'), progress: null }
  }
  if (event.event_type === 'payment.waiting') {
    return { title: t('progress.creditsWaitingTitle'), detail: t('progress.creditsWaitingDetail'), progress: null }
  }
  if (event.event_type === 'payment.resume_requested' || event.event_type === 'payment.resumed') {
    return { title: t('progress.creditsResumeTitle'), detail: t('progress.creditsResumeDetail'), progress: null }
  }
  if (event.event_type === 'run.started') {
    return { title: t('progress.requestTitle'), detail: t('progress.requestDetail'), progress: null }
  }
  if (event.event_type === 'run.waiting_on_workflow') {
    return { title: t('progress.workflowTitle'), detail: t('progress.workflowWaitingDetail'), progress: null }
  }
  if (event.event_type === 'run.waiting_on_agent') {
    return { title: t('progress.agentWaitingTitle'), detail: t('progress.agentWaitingDetail'), progress: null }
  }
  if (event.event_type === 'run.failed') {
    return { title: t('failure.taskTitle'), detail: t('progress.failureFallback'), progress: null }
  }
  return null
}

function statusStageNarration(stage: string | null, t: ChatTranslator) {
  const keys: Record<string, [string, string]> = {
    memory_context: ['stages.memoryContextTitle', 'stages.memoryContextDetail'],
    planning: ['stages.planningTitle', 'stages.planningDetail'],
    planning_replay: ['stages.planningReplayTitle', 'stages.planningReplayDetail'],
    autonomy_defaulting: ['stages.defaultsTitle', 'stages.defaultsDetail'],
    tool_execution: ['stages.toolExecutionTitle', 'stages.toolExecutionDetail'],
    approval_required: ['stages.approvalTitle', 'stages.approvalDetail'],
    finalizing: ['stages.finalizingTitle', 'stages.finalizingDetail'],
  }
  const keysForStage = stage ? keys[stage] : undefined
  return {
    title: t(keysForStage?.[0] ?? 'stages.fallbackTitle'),
    detail: t(keysForStage?.[1] ?? 'stages.fallbackDetail'),
    progress: null,
  }
}

function milestoneNarration(milestone: string, t: ChatTranslator, progress: number | null) {
  const keys: Record<string, [string, string]> = {
    'workflow.started': ['milestones.workflowStartedTitle', 'milestones.workflowStartedDetail'],
    'workflow.queued': ['milestones.workflowQueuedTitle', 'milestones.workflowQueuedDetail'],
    'workflow.step.started': ['milestones.workflowStepStartedTitle', 'milestones.workflowStepStartedDetail'],
    'workflow.step.completed': ['milestones.workflowStepCompletedTitle', 'milestones.workflowStepCompletedDetail'],
    'workflow.failed': ['milestones.workflowFailedTitle', 'milestones.workflowFailedDetail'],
    'agent.started': ['milestones.agentStartedTitle', 'milestones.agentStartedDetail'],
    'agent.queued': ['milestones.agentQueuedTitle', 'milestones.agentQueuedDetail'],
    'agent.step.started': ['milestones.agentStepStartedTitle', 'milestones.agentStepStartedDetail'],
    'agent.step.completed': ['milestones.agentStepCompletedTitle', 'milestones.agentStepCompletedDetail'],
    'agent.failed': ['milestones.agentFailedTitle', 'milestones.agentFailedDetail'],
    'image.batch.started': ['milestones.imagesStartedTitle', 'milestones.imagesStartedDetail'],
    'image.batch.completed': ['milestones.imagesCompletedTitle', 'milestones.imagesCompletedDetail'],
    'video.render.started': ['milestones.videoStartedTitle', 'milestones.videoStartedDetail'],
    'video.render.completed': ['milestones.videoCompletedTitle', 'milestones.videoCompletedDetail'],
  }
  const item = keys[milestone]
  return item ? { title: t(item[0]), detail: t(item[1]), progress } : null
}

function detectTextLocale(value: string): ChatLocale {
  const text = value.toLowerCase()
  const trScore = scorePattern(text, TURKISH_WORD_PATTERN) + (TURKISH_CHAR_PATTERN.test(value) ? 2 : 0)
  const enScore = scorePattern(text, ENGLISH_WORD_PATTERN)
  return trScore > 0 && trScore >= enScore ? 'tr' : 'en'
}

const TURKISH_CHAR_PATTERN = /[\u00c7\u00d6\u00dc\u011e\u0130\u015e\u00e7\u00f6\u00fc\u011f\u0131\u015f]/
const TURKISH_WORD_PATTERN = /\b(basit|bir|icin|ile|ve|veya|bunu|bana|merhaba|selam|lutfen|yapalim|yapar|yap|istiyorum|olustur|olusturuyor|kredi|yok|degil|bekle|surdurmek|sonra|kaldigimiz|icerik|gorsel|resim|kanalim|videosu|hazirla|hazirliyorum|sohbet|chatten|onay|onayla|reddet|duzenle|indir|goster|gosteriyor|tikla|tikladigimda|beklerken|surec|calisiyor|taslak|adim|dugum)\b/gi
const ENGLISH_WORD_PATTERN = /\b(create|make|generate|please|workflow|continue|credit|payment|approve|reject|need|want|render|image|video|start|finish|prepare)\b/gi

function scorePattern(text: string, pattern: RegExp) {
  pattern.lastIndex = 0
  let score = 0
  while (pattern.exec(text)) score += 1
  pattern.lastIndex = 0
  return score
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getRawString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function chatHref(conversationId: string) {
  return `/chat?${CHAT_QUERY_PARAM}=${encodeURIComponent(conversationId)}`
}

function createConversationTitle(message: string | undefined, fallbackName?: string | null) {
  const cleaned = (message ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[`*_#>\[\]{}()]/g, '')
    .trim()
  if (!cleaned) return fallbackName ? `${fallbackName} chat` : 'New chat'

  const words = cleaned.split(' ').filter(Boolean)
  const title = words.slice(0, 8).join(' ')
  return title.length > 64 ? `${title.slice(0, 61).trim()}...` : title
}

function notifyConversationListChanged() {
  window.dispatchEvent(new CustomEvent(ASSISTANT_CONVERSATIONS_UPDATED_EVENT))
}

function clampWorkspacePanelWidth(width: number) {
  const viewportMax = typeof window === 'undefined'
    ? WORKSPACE_PANEL_MAX_WIDTH
    : Math.max(WORKSPACE_PANEL_MIN_WIDTH, Math.floor(window.innerWidth * 0.72))
  const maxWidth = Math.min(WORKSPACE_PANEL_MAX_WIDTH, viewportMax)
  return Math.min(Math.max(Math.round(width), WORKSPACE_PANEL_MIN_WIDTH), maxWidth)
}

function mergeWorkflowDraftSnapshot(
  workflowDraft: WorkflowDraftAttachment,
  workflow: Workflow,
): WorkflowDraftAttachment {
  return {
    ...workflowDraft,
    id: workflow.id,
    goal: workflow.name,
    dslJson: buildWorkflowDefinitionPayload(workflow).dsl_json,
  }
}

function compareConversationRecency(left: AssistantConversation, right: AssistantConversation) {
  return conversationTime(right) - conversationTime(left)
}

function conversationTime(conversation: AssistantConversation) {
  return Date.parse(conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at) || 0
}

export const __chatPageTestHooks = {
  classifyFundingReason,
  humanizeRequiredFieldKey,
}
