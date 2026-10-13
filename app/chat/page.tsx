'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import * as React from 'react'
import { useQueries, useQuery, type UseQueryOptions } from '@tanstack/react-query'
import {
  ArrowUpRight,
  AtSign,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Copy,
  Cpu,
  CreditCard,
  Download,
  ExternalLink,
  File as FileIcon,
  Film,
  Image as ImageIcon,
  Images as ImagesIcon,
  LayoutTemplate,
  Loader2,
  Lock,
  Maximize2,
  Mic,
  MoreHorizontal,
  PenLine,
  PencilLine,
  Play,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Type as TypeIcon,
  Upload,
  UserRound,
  Workflow as WorkflowIcon,
  X,
} from 'lucide-react'

import { ChatMarkdown } from '@/components/chat/chat-markdown'
import { hasSparkOpenableResult, useOpenChatResultInSpark } from '@/components/chat/open-in-spark'
import { MotionResultCard } from '@/components/chat/motion-result-card'
import { SparkContinueCard } from '@/components/chat/spark-continue-card'
import { SparkCandidateCard, sparkCandidateCount } from '@/components/chat/spark-candidate-card'
import { ConnectionRequirementCard } from '@/components/chat/connection-requirement-card'
import { readConnectionRequirementMessage } from '@/lib/connector/api'
import { publishConnectionRequirementEvent } from '@/lib/connector/requirement-events'
import { readMotionResult } from '@/lib/spark/motion-result'
import { readSparkHandoff } from '@/lib/spark/spark-entry'
import { SkillAuthoringCards } from '@/components/chat/skill-authoring-cards'
import { useProductionG1Open, useProductionPlanShown } from '@/components/chat/production-g1-card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { ProductionRunSend, ProductionSuggestions } from '@/components/chat/production-flow'
import { PromptBox, PromptBoxChip, PromptBoxInput, PromptBoxSend, PromptBoxSpacer } from '@/components/spark/agent/prompt-box'
import { AgentChain, AgentMedia, AgentQuestion, AgentScope, AgentSprite, AgentThinking, AgentTurn, type AgentChainStep, type AgentStepState } from '@/components/spark/agent/agent-thread'
import { VideoProductionCard } from '@/components/chat/video-production-card'
import { ScriptReviewHostProvider, type ScriptReviewHost } from '@/components/chat/script-review/script-review-host'
import { ScriptReviewSidePanel } from '@/components/chat/script-review/script-review-side-panel'
import { FinalRenderJobCard } from '@/components/chat/final-render-card'
import { FullAccessLimitNote, FullAccessWarningCard } from '@/components/chat/full-access-warning-card'
import { findFullAccessLimitAsk } from '@/lib/assistant/full-access-flow'
import { isProductionG1Reply } from '@/lib/assistant/production-launch-api'
import { readInteractionQuestionOptions } from '@/lib/assistant/interaction-api'
import { readSkillAuthoringCards } from '@/lib/assistant/skill-authoring'
import { classifyAssistantRunFailure, findRunTriggerMessage } from '@/lib/assistant/run-failure'
import { answeredModelLabel, readAnsweredModelId } from '@/lib/assistant/answered-model'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { isStorageMediaSelectable } from '@/components/storage/storage-media-input'
import type { WorkflowCanvasImageModel, WorkflowCanvasSnapshot } from '@/components/workflows/workflow-canvas'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ASSISTANT_COMPOSER_CATALOG_QUERY_KEY,
  ASSISTANT_CONVERSATION_SETTINGS_QUERY_KEY,
  ASSISTANT_CONVERSATIONS_UPDATED_EVENT,
  addAssistantMessage,
  answerAssistantRun,
  continueAssistantRun,
  createAssistantIdempotencyKey,
  createAssistantConversation,
  createAssistantEventSource,
  getAssistantComposerCatalog,
  getAssistantConversation,
  getAssistantConversationSettings,
  issueAssistantPlannerModelCommand,
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
  type AssistantComposerCatalog,
  type AssistantComposerSelection,
  type AssistantMessage,
  type AssistantRunEvent,
  type AssistantRunState,
} from '@/lib/assistant/api'
import {
  classifyPlannerModelCommand,
  plannerModelHint,
  plannerModelView,
  shouldRetryPlannerModelForJobOnly,
  type PlannerModelCommandResult,
  type PlannerModelView,
} from '@/lib/assistant/planner-model-selection'
import {
  readAssistantApprovalTarget,
  type AssistantApprovalTarget,
} from '@/lib/assistant/approval-target'
import { composerMentionToken, useTypedComposer, type TypedComposerMenuGroup, type TypedComposerMenuItem } from '@/lib/assistant/composer/use-typed-composer'
import { isCommandChip, type ComposerMentionChip } from '@/lib/assistant/composer/composer-state'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useSlashMenuGroups } from '@/lib/assistant/composer/use-slash-menu'
import { useMentionMenuGroups } from '@/lib/assistant/composer/use-mention-menu'
import { relabelFromCandidates, type ComposerResourceCandidate } from '@/lib/assistant/composer/resource-mentions'
import { useComposerResourceDescribe } from '@/components/chat/composer/resource-describe'
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
import { useComposerModeControl } from '@/lib/assistant/composer/use-composer-mode'
import { prepareChatComposerMessage } from '@/lib/assistant/composer/chat-submit'
import { ComposerModeChip, TypedComposerChips, TypedComposerMenu, menuItemDomId } from '@/components/chat/composer/typed-composer-parts'
import { ChatStartGallery, type ChatStartExample, type ChatStartMode } from '@/components/chat/chat-start-gallery'
import { readComposerOutputCountMax } from '@/lib/assistant/composer/composer-output-count'
import { useComposerOutputCount, type ComposerOutputCountControl } from '@/lib/assistant/composer/use-composer-output-count'
import { ComposerOutputCountSection, composerOutputCountButtonValue } from '@/components/chat/composer/composer-output-count-section'
import { connectionSwitchGroupBody } from '@/components/chat/composer/connection-switch-rows'
import { useMcpTemplateInsert } from '@/components/chat/composer/mcp-template-insert'
import { buildComposerMenuStops, effectiveComposerMenuIndex } from '@/lib/assistant/composer/composer-menu-stops'
import { ComposerAddConnectors } from '@/components/chat/composer/composer-add-connectors'
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
  completeStorageUpload,
  getStorageDeliveryUrls,
  getStorageDownloadUrl,
  getStoragePlaybackUrl,
  initiateStorageUpload,
  listStorageObjects,
  resolveStorageUploadTransport,
  storageDeliveryRefreshDelay,
  uploadDirectContent,
  uploadProxyContent,
  uploadTusContent,
  type DeliveryUrlsBatchResult,
  type InitiateUploadResult,
  type StorageListInput,
  type StorageObjectItem,
} from '@/lib/storage/api'
import { useStorageThumbnailUrl } from '@/lib/storage/use-storage-thumbnail-url'
import { cn } from '@/lib/utils'
import type { Workflow } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { MemoryIngestionCheckbox, MemoryUploadSummaryLine } from '@/components/memory/memory-ingestion-checkbox'
import { useMemoryUploadChoice, type MemoryUploadChoice } from '@/components/memory/use-memory-upload-choice'
import type { StorageMemoryIngestionRequest } from '@/lib/storage/api'
import { useLocale, useTranslations } from 'next-intl'

type ChatLocale = 'tr' | 'en'

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

type ChatAssetKind = 'image' | 'video' | 'audio' | 'document' | 'file'

type ChatAssetAttachment = {
  id: string
  objectId?: string | null
  channelId?: string | null
  kind: ChatAssetKind
  name: string
  url: string | null
  previewUrl?: string | null
  mimeType?: string | null
  source: 'storage' | 'upload' | 'generated'
  sizeBytes?: string | null
  status?: string | null
  metadata?: Record<string, unknown>
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

type MediaPickerView = 'image' | 'video' | 'uploads'
type ComposerChatProfile = AssistantComposerSelection['chat_profile']
type ComposerApprovalMode = AssistantComposerSelection['approval_mode']
type ComposerAspectRatio = AssistantComposerSelection['aspect_ratio']

type ComposerSettings = {
  chatProfile: ComposerChatProfile
  /** P01A-11: exact chat model picked before the conversation exists; committed on the first send. */
  chatModelId: string | null
  approvalMode: ComposerApprovalMode
  durationSeconds: number
  aspectRatio: ComposerAspectRatio
  imageModelId: string | null
  videoModelId: string | null
  imageTask: string
  imageSize: string
  imageResolution: string
  imageQuality: string
  imageOutputFormat: string
}

type ComposerProfileOption = {
  id: ComposerChatProfile
  label: string
  detail: string
  credits: number | null
  modelId: string
  modelLabel: string
}

type ComposerAspectOption = {
  id: ComposerAspectRatio
  label: string
  detail: string
  icon: React.ComponentType<{ className?: string }>
}

type ComposerModelOption = {
  id: string
  label: string
  description: string
  quality: string
  cost: string
  speed: string
  estimatedCredits: number | null
  inputSchema: Record<string, unknown>
  pricingRule: Record<string, unknown>
  rateLimit: Record<string, unknown>
  capacityLimit: Record<string, unknown>
}

type ComposerInputOption = {
  id: string
  label: string
  detail: string
}

type ComposerApprovalOption = {
  id: ComposerApprovalMode
  label: string
  detail: string
}

type ComposerOptions = {
  chatProfiles: ComposerProfileOption[]
  /** P01A-11: exact supported chat models of the catalog (a Fast/Pro/Max profile is not a model identity). */
  chatModels: ComposerModelOption[]
  approvalModes: ComposerApprovalOption[]
  aspectRatios: ComposerAspectOption[]
  imageModels: ComposerModelOption[]
  videoModels: ComposerModelOption[]
}

const FALLBACK_IMAGE_SCHEMA: Record<string, unknown> = {
  tasks: ['text_to_image', 'image_to_image', 'reference_image', 'first_last_frame'],
  default_task: 'text_to_image',
  sizes: ['auto', '1024x1024', '1536x1024', '1024x1536'],
  default_size: 'auto',
  qualities: ['auto', 'low', 'medium', 'high'],
  default_quality: 'auto',
  backgrounds: ['auto', 'opaque', 'transparent'],
  default_background: 'auto',
  output_formats: ['png', 'jpeg', 'webp'],
  default_output_format: 'png',
  output_compression_supported: true,
  output_compression_formats: ['jpeg', 'webp'],
  default_output_compression: 100,
  input_fidelity_supported: true,
  input_fidelities: ['low', 'high'],
  default_input_fidelity: 'low',
  max_images_per_run: 10,
}

function getFallbackComposerImageModels(t: ChatTranslator): ComposerModelOption[] {
  return [
  {
    id: 'flux-2-klein-4b',
    label: 'FLUX.2 Klein 4B',
    description: t('composer.fluxDescription'),
    quality: t('composer.high'),
    cost: t('composer.resolutionCredits'),
    speed: t('composer.fastSpeed'),
    estimatedCredits: null,
    inputSchema: {
      tasks: ['text_to_image'],
      default_task: 'text_to_image',
      aspect_ratios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
      default_aspect_ratio: '1:1',
      resolutions: ['1k', '2k', '4k'],
      default_resolution: '1k',
      styles: ['auto', 'natural', 'vivid', 'cinematic', 'anime'],
      default_style: 'auto',
      max_images_per_run: 1,
    },
    pricingRule: {},
    rateLimit: {},
    capacityLimit: {},
  },
  createFallbackComposerImageModel(t, 'gpt-image-2', 'GPT Image 2', {
    quality: t('composer.highest'),
    description: t('composer.defaultImageDescription'),
    inputSchema: {
      ...FALLBACK_IMAGE_SCHEMA,
      tasks: ['text_to_image', 'image_to_image', 'reference_image'],
      input_fidelity_supported: false,
    },
  }),
]
}

function createFallbackComposerImageModel(
  t: ChatTranslator,
  id: string,
  label: string,
  overrides: Partial<Pick<ComposerModelOption, 'description' | 'quality' | 'speed' | 'inputSchema'>> = {},
): ComposerModelOption {
  return {
    id,
    label,
    description: overrides.description ?? t('composer.genericImageDescription', { model: label }),
    quality: overrides.quality ?? t('composer.high'),
    cost: t('composer.imagePricing'),
    speed: overrides.speed ?? t('composer.mediumSpeed'),
    estimatedCredits: null,
    inputSchema: overrides.inputSchema ?? FALLBACK_IMAGE_SCHEMA,
    // Prices come from the current server catalog, including the retail tariff.
    pricingRule: {},
    rateLimit: {},
    capacityLimit: {},
  }
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
const CHAT_COMPOSER_MENU_ID = 'chat-composer-menu'
const LEGACY_CHAT_QUERY_PARAM = 'chat'
const CHAT_MEDIA_UPLOAD_ACCEPT = 'image/*,video/*,audio/*,.pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.csv,.json'
const CHAT_STORAGE_DELIVERY_BATCH_SIZE = 64
const CHAT_STORAGE_DELIVERY_REFERENCE_LIMIT = 1_024
const CHAT_STORAGE_DELIVERY_PENDING_POLL_MAX_MS = 20 * 60_000
const MEDIA_URL_PATTERN = /https?:\/\/[^\s<>)"']+/gi
const COMPOSER_VIDEO_DURATION_MIN_SECONDS = 5
const IMAGE_GENERATE_CAPABILITY = 'image.generate'
const VIDEO_GENERATE_CAPABILITY = 'video.generate'
const DEFAULT_IMAGE_MODEL_ID = 'flux-2-klein-4b'
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

const COMPOSER_DURATION_PRESETS = [15, 30, 60, 180, 300] as const

const COMPOSER_DURATION_SLIDER_STEP_SECONDS = 1
type ComposerDurationUnit = 'seconds' | 'minutes'
const COMPOSER_DEFAULT_SETTINGS: ComposerSettings = {
  chatProfile: 'fast',
  chatModelId: null,
  // Q62: a new conversation starts in Auto (legacy spelling 'autonomous').
  approvalMode: 'autonomous',
  durationSeconds: 30,
  aspectRatio: '16:9',
  imageModelId: null,
  videoModelId: null,
  imageTask: 'text_to_image',
  imageSize: '',
  imageResolution: '',
  imageQuality: 'auto',
  imageOutputFormat: 'png',
}

function getFallbackComposerProfileOptions(t: ChatTranslator): ComposerProfileOption[] {
  return [
    { id: 'fast', label: t('composer.fast'), detail: t('composer.fastDetail'), credits: null, modelId: 'auto-llm', modelLabel: 'Auto LLM' },
    { id: 'pro', label: t('composer.pro'), detail: t('composer.proDetail'), credits: null, modelId: 'auto-llm', modelLabel: 'Auto LLM' },
    { id: 'max', label: t('composer.max'), detail: t('composer.maxDetail'), credits: null, modelId: 'auto-llm', modelLabel: 'Auto LLM' },
  ]
}

function getFallbackComposerApprovalOptions(t: ChatTranslator): ComposerApprovalOption[] {
  return [
    { id: 'ask', label: t('composer.ask'), detail: t('composer.askDetail') },
    { id: 'autonomous', label: t('composer.auto'), detail: t('composer.autoDetail') },
  ]
}

function getFallbackComposerAspectOptions(t: ChatTranslator): ComposerAspectOption[] {
  return [
    { id: '16:9', label: t('composer.landscape'), detail: t('composer.landscapeDetail'), icon: RectangleHorizontal },
    { id: '9:16', label: t('composer.short'), detail: t('composer.shortDetail'), icon: RectangleVertical },
    { id: '1:1', label: t('composer.square'), detail: t('composer.squareDetail'), icon: Square },
  ]
}

type ChatTranslator = (key: string, values?: Record<string, string | number>) => string

function getChatCopy(t: ChatTranslator) {
  return {
    ready: t('copy.ready'),
    channelMissing: t('copy.channelMissing'),
    noMessages: t('copy.noMessages'),
    selectChannel: t('copy.selectChannel'),
    placeholder: t('copy.placeholder'),
    thinking: t('copy.thinking'),
    finishing: t('copy.finishing'),
    stopRun: t('copy.stopRun'),
    stoppingRun: t('copy.stoppingRun'),
    sendMessage: t('copy.sendMessage'),
    addContext: t('copy.addContext'),
    voice: t('copy.voice'),
    model: t('copy.model'),
    creditTitle: t('copy.creditTitle'),
    creditDescription: t('copy.creditDescription'),
    topUp: t('copy.topUp'),
    continueAfterTopUp: t('copy.continueAfterTopUp'),
    amountApprovalTitle: t('copy.amountApprovalTitle'),
    amountApprovalDescription: t('copy.amountApprovalDescription'),
    approveHigherAmount: t('copy.approveHigherAmount'),
    approvalTitle: t('copy.approvalTitle'),
    approvalDescription: t('copy.approvalDescription'),
    approve: t('copy.approve'),
    approvalProcessing: t('copy.approvalProcessing'),
    startApproved: t('copy.startApproved'),
    actionPendingTitle: t('copy.actionPendingTitle'),
    actionPendingDescription: t('copy.actionPendingDescription'),
    reject: t('copy.reject'),
    revise: t('copy.revise'),
    loadErrorTitle: t('copy.loadErrorTitle'),
    newChat: t('copy.newChat'),
    quickDecisionTitle: t('copy.quickDecisionTitle'),
    quickDecisionDefault: t('copy.quickDecisionDefault'),
    quickDecisionContinue: t('copy.quickDecisionContinue'),
    quickDecisionCustomPlaceholder: t('copy.quickDecisionCustomPlaceholder'),
    quickDecisionCustomSend: t('copy.quickDecisionCustomSend'),
    requiredFieldsTitle: t('copy.requiredFieldsTitle'),
    requiredFieldsPlaceholder: t('copy.requiredFieldsPlaceholder'),
    requiredFieldsSubmit: t('copy.requiredFieldsSubmit'),
    attachmentsTitle: t('copy.attachmentsTitle'),
    addMenuUpload: t('copy.addMenuUpload'),
    addMenuAssets: t('copy.addMenuAssets'),
    uploadingMedia: t('copy.uploadingMedia'),
    generatedEdit: t('copy.generatedEdit'),
    openMedia: t('copy.openMedia'),
    downloadMedia: t('copy.downloadMedia'),
    openOriginal: t('copy.openOriginal'),
    mediaPickerTitle: t('copy.mediaPickerTitle'),
    mediaPickerSearch: t('copy.mediaPickerSearch'),
    mediaPickerRecent: t('copy.mediaPickerRecent'),
    mediaPickerImages: t('copy.mediaPickerImages'),
    mediaPickerVideos: t('copy.mediaPickerVideos'),
    mediaPickerUploads: t('copy.mediaPickerUploads'),
    mediaPickerUpload: t('copy.mediaPickerUpload'),
    mediaPickerEmpty: t('copy.mediaPickerEmpty'),
    mediaPickerSelect: t('copy.mediaPickerSelect'),
    mediaPickerClose: t('copy.mediaPickerClose'),
    yes: t('copy.yes'),
    no: t('copy.no'),
    same: t('copy.same'),
    different: t('copy.different'),
    sameValue: t('copy.sameValue'),
    differentValue: t('copy.differentValue'),
    quickDecisionDefaultValue: t('copy.quickDecisionDefaultValue'),
    quickDecisionContinueValue: t('copy.quickDecisionContinueValue'),
  }
}

type ChatCopy = ReturnType<typeof getChatCopy>

function useChatCopy() {
  const t = useTranslations('Chat') as unknown as ChatTranslator
  return React.useMemo(() => getChatCopy(t), [t])
}

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
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false)
  const [pendingInlineReview, setPendingInlineReview] = React.useState<ReviewItem | null>(null)
  const [isMediaPickerOpen, setIsMediaPickerOpen] = React.useState(false)
  const [workspacePanelsByChat, setWorkspacePanelsByChat] = React.useState<Record<string, ChatWorkspacePanelState>>({})
  const [isComposerUploading, setIsComposerUploading] = React.useState(false)
  const [composerUploadProgress, setComposerUploadProgress] = React.useState<number | null>(null)
  const [composerSettings, setComposerSettings] = React.useState<ComposerSettings>(COMPOSER_DEFAULT_SETTINGS)
  const [selectedAssets, setSelectedAssets] = React.useState<ChatAssetAttachment[]>([])
  // Short names of the attached files (`image1`); see appendSelectedAsset.
  const selectedAssetsRef = React.useRef<ChatAssetAttachment[]>([])
  const assetLabelsRef = React.useRef<Record<string, string>>({})
  const [assetLabels, setAssetLabels] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    selectedAssetsRef.current = selectedAssets
  }, [selectedAssets])
  const composerUploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const composerUploadAbortRef = React.useRef<AbortController | null>(null)
  const messagePageAbortRef = React.useRef<AbortController | null>(null)
  const composerTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const composerFormRef = React.useRef<HTMLFormElement | null>(null)
  const composerMirrorRef = React.useRef<HTMLDivElement | null>(null)
  const composerInputWrapRef = React.useRef<HTMLDivElement | null>(null)
  const [composerTokenHover, setComposerTokenHover] = React.useState<{ token: string; left: number; bottom: number } | null>(null)
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
  // S19: one shared "Belleğe de ekle" choice for the composer and the media picker uploads.
  const memoryUpload = useMemoryUploadChoice(conversationContextReady ? conversationChannelId : null, 'chat_upload')
  // P03-01: shared typed composer (text + typed chips with one undo history); `draft`/`setDraft` are its text view.
  // QA-172: an MCP template chosen in the `/` menu is rendered and inserted as text (never sent).
  const mcpTemplates = useMcpTemplateInsert({ onNotice: setError })
  const typedComposer = useTypedComposer({ resetKey: composerContextKey, textareaRef: composerTextareaRef, onInsertAction: mcpTemplates.onInsertAction, mentionTokens: true })
  const draft = typedComposer.text
  const setDraft = typedComposer.setText
  const resetComposer = typedComposer.reset
  const slashMenu = useSlashMenuGroups({
    surface: 'dashboard_chat',
    channelId: conversationChannelId,
    trigger: typedComposer.trigger,
    enabled: Boolean(conversationChannelId && conversationContextReady),
    conversationId: conversation?.id ?? null,
  })
  // P03-02: `@` resource mentions from the owners' projections; a result relabels chips of the exact same identity.
  const describeComposerResource = useComposerResourceDescribe()
  const relabelComposer = typedComposer.relabel
  const handleMentionCandidates = React.useCallback(
    (candidates: ComposerResourceCandidate[]) => relabelComposer(relabelFromCandidates(candidates)),
    [relabelComposer],
  )
  const mentionMenu = useMentionMenuGroups({
    channelId: conversationChannelId,
    trigger: typedComposer.trigger,
    enabled: Boolean(conversationChannelId && conversationContextReady),
    locale,
    describe: describeComposerResource,
    onCandidates: handleMentionCandidates,
  })
  const mentionTrigger = typedComposer.trigger?.kind === 'mention' ? typedComposer.trigger : null
  const attachedFilesGroup = React.useMemo<TypedComposerMenuGroup | null>(() => {
    if (!mentionTrigger) return null
    const query = mentionTrigger.query.trim().toLocaleLowerCase()
    const items: TypedComposerMenuItem[] = selectedAssets
      .map((asset) => ({ id: `file:${asset.id}`, group: 'attachedFiles', label: `@${assetLabels[asset.id] ?? asset.kind}`, description: asset.name }))
      .filter((item) => !query || item.label.toLocaleLowerCase().includes(query) || item.description.toLocaleLowerCase().includes(query))
    items.push({ id: 'file:pick', group: 'attachedFiles', label: tChat('typedComposer.pickFromLibrary'), description: tChat('typedComposer.pickFromLibraryHint') })
    return { id: 'attachedFiles', items }
  }, [assetLabels, mentionTrigger, selectedAssets, tChat])
  const activeComposerMenu = mentionTrigger
    ? { ...mentionMenu, groups: attachedFilesGroup ? [attachedFilesGroup, ...mentionMenu.groups] : mentionMenu.groups }
    : slashMenu
  // QA-140: the keyboard stops include the connection header rows of the slash menu (Space turns their switch).
  const slashSwitchRows = typedComposer.trigger?.kind === 'slash' ? slashMenu.connectionSwitches?.rows ?? null : null
  const composerMenuItems = React.useMemo(() => buildComposerMenuStops(activeComposerMenu.groups, slashSwitchRows), [activeComposerMenu.groups, slashSwitchRows])
  const composerMenuOpen = typedComposer.trigger !== null
  const activeComposerMenuItemId = composerMenuItems[effectiveComposerMenuIndex(composerMenuItems, typedComposer.activeIndex, typedComposer.activeExplicit)]?.id ?? null
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
    composerUploadAbortRef.current?.abort()
    composerUploadAbortRef.current = null
    setIsComposerUploading(false)
    setComposerUploadProgress(null)
    setSelectedAssets([])
    setIsMediaPickerOpen(false)
    if (composerUploadInputRef.current) composerUploadInputRef.current.value = ''
  }, [composerContextKey])

  React.useEffect(() => () => {
    composerUploadAbortRef.current?.abort()
    composerUploadAbortRef.current = null
    messagePageAbortRef.current?.abort()
    messagePageAbortRef.current = null
  }, [])

  React.useEffect(() => registerBrowserPrincipalLifecycleResetter(() => {
    composerUploadAbortRef.current?.abort()
    composerUploadAbortRef.current = null
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
    resetComposer()
    setWorkspacePanelsByChat({})
    setSelectedAssets([])
    setLiveDraft(null)
    setIsDraftAnimating(false)
    setLiveProgressEvent(null)
    setIsComposerUploading(false)
    setComposerUploadProgress(null)
    setIsMediaPickerOpen(false)
    setConversation(null)
    setMessages([])
    setOptimisticMessages([])
    setRunEvents([])
    setActiveRunId(null)
    setRunState(null)
    setError(null)
    setRunConnectionError(null)
    if (composerUploadInputRef.current) composerUploadInputRef.current.value = ''
  }), [resetComposer])

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

  const composerCatalogQuery = useQuery({
    queryKey: ASSISTANT_COMPOSER_CATALOG_QUERY_KEY,
    queryFn: getAssistantComposerCatalog,
    enabled: Boolean(conversationChannelId && conversationContextReady),
    staleTime: 60_000,
  })
  const composerCatalog = composerCatalogQuery.data ?? null
  const composerOptions = React.useMemo(() => buildComposerOptions(composerCatalog, tChat), [composerCatalog, tChat])
  const answeredModelLabels = React.useMemo(
    () => new Map(composerOptions.chatModels.map((option) => [option.id, option.label] as const)),
    [composerOptions.chatModels],
  )
  const workflowCanvasImageModels = React.useMemo(
    () => composerOptions.imageModels.map(toWorkflowCanvasImageModel),
    [composerOptions.imageModels],
  )
  const minVideoDurationSeconds = composerCatalog?.duration.min_seconds ?? COMPOSER_VIDEO_DURATION_MIN_SECONDS
  const maxVideoDurationSeconds = composerCatalog?.duration.max_seconds ?? null
  const durationScaleMaxSeconds = composerCatalog?.duration.scale_max_seconds ?? maxVideoDurationSeconds
  // QA-078: "Adet" of the canvas popover — up to the selected image model's max; the server re-checks it at dispatch.
  const outputCount = useComposerOutputCount({
    contextKey: composerContextKey,
    text: draft,
    modelMax: readComposerOutputCountMax(selectedComposerImageModel(composerSettings, composerCatalog, composerOptions)?.inputSchema),
  })

  React.useEffect(() => {
    if (!composerCatalog) return
    setComposerSettings((current) => {
      const next = reconcileComposerSettings(current, composerCatalog, tChat)
      return areComposerSettingsEqual(current, next) ? current : next
    })
  }, [composerCatalog, tChat])

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
  const conversationSettingsQuery = useQuery({
    queryKey: [...ASSISTANT_CONVERSATION_SETTINGS_QUERY_KEY, conversation?.id ?? null, plannerSelectedJobId],
    queryFn: ({ signal }) => getAssistantConversationSettings(
      { conversationId: conversation!.id, jobId: plannerSelectedJobId },
      { signal },
    ),
    enabled: Boolean(conversation?.id),
  })
  const conversationSettings = conversationSettingsQuery.data ?? null
  const refetchConversationSettings = conversationSettingsQuery.refetch
  const plannerModel = React.useMemo(() => plannerModelView(conversationSettings), [conversationSettings])
  // P03-01 (Q74): three-level mode chip over the same settings command authority as the planner model.
  const composerMode = useComposerModeControl({
    conversationId: conversation?.id ?? null,
    settings: conversationSettings,
    selectedJobId: plannerSelectedJobId,
    catalog: composerCatalog,
    refetchSettings: refetchConversationSettings,
    t: tChat,
    onNotice: setError,
  })
  const [plannerModelCommandPending, setPlannerModelCommandPending] = React.useState(false)
  // A notice belongs to the conversation it was raised in; switching conversations never shows another one's.
  const [plannerModelNoticeState, setPlannerModelNoticeState] = React.useState<{ conversationId: string | null; result: PlannerModelCommandResult } | null>(null)
  const plannerModelNotice = plannerModelNoticeState && plannerModelNoticeState.conversationId === (conversation?.id ?? null)
    ? plannerModelNoticeState.result
    : null
  const lastModelSwitchEventId = React.useMemo(
    () => [...runEvents].reverse().find((event) => event.event_type.startsWith('assistant.model_switch.'))?.id ?? null,
    [runEvents],
  )
  React.useEffect(() => {
    // The job's boundary activated or refused a switch: re-read the server state.
    if (lastModelSwitchEventId) void refetchConversationSettings()
  }, [lastModelSwitchEventId, refetchConversationSettings])
  async function selectPlannerModel(modelId: string) {
    if (!conversation) {
      // No conversation yet: the pick is only the first message's request; it is committed on send.
      setComposerSettings((current) => ({ ...current, chatModelId: modelId }))
      return
    }
    if (!conversationSettings || plannerModelCommandPending || modelId === plannerModel.selectedModelId) return
    const job = conversationSettings.job && conversationSettings.job.job_id === plannerSelectedJobId ? conversationSettings.job : null
    setPlannerModelCommandPending(true)
    setPlannerModelNoticeState(null)
    try {
      const selectedJob = job ? { jobId: job.job_id, expectedJobSettingsVersion: job.job_settings_version } : null
      const result = await issueAssistantPlannerModelCommand({
        conversationId: conversation.id,
        plannerModelId: modelId,
        expectedConversationDefaultsVersion: conversationSettings.defaults.defaults_version,
        selectedJob,
      })
      if (shouldRetryPlannerModelForJobOnly(result.outcome, Boolean(selectedJob))) {
        // S9: a member of a shared conversation changes the model of the job they started; the default stays the owner's.
        const jobOnly = await issueAssistantPlannerModelCommand({
          conversationId: conversation.id,
          plannerModelId: modelId,
          expectedConversationDefaultsVersion: conversationSettings.defaults.defaults_version,
          selectedJob,
          jobOnly: true,
        })
        const jobOnlyOutcome = classifyPlannerModelCommand(jobOnly.outcome)
        setPlannerModelNoticeState({ conversationId: conversation.id, result: jobOnlyOutcome === 'applied' ? 'job_only' : jobOnlyOutcome })
        return
      }
      const outcome = classifyPlannerModelCommand(result.outcome)
      if (outcome !== 'applied') setPlannerModelNoticeState({ conversationId: conversation.id, result: outcome })
    } catch {
      setPlannerModelNoticeState({ conversationId: conversation.id, result: 'failed' })
    } finally {
      // Whatever happened, the composer shows the server's state, never the click.
      await refetchConversationSettings()
      setPlannerModelCommandPending(false)
    }
  }

  /** A brand-new conversation's first message: the picked model becomes its committed new-job default first. */
  async function commitInitialPlannerModel(conversationId: string, modelId: string) {
    const current = await getAssistantConversationSettings({ conversationId })
    if (current.defaults.default_planner_model_id === modelId) return
    const result = await issueAssistantPlannerModelCommand({
      conversationId,
      plannerModelId: modelId,
      expectedConversationDefaultsVersion: current.defaults.defaults_version,
    })
    const outcome = classifyPlannerModelCommand(result.outcome)
    if (outcome !== 'applied') {
      setPlannerModelNoticeState({ conversationId, result: outcome })
      throw new Error(tChat(plannerModelNoticeKey(outcome)))
    }
  }

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
  const canSubmit = Boolean(
    conversationChannelId
      && conversationContextReady
      && (draft.trim() || selectedAssets.length > 0 || typedComposer.chips.length > 0)
      && !isSending
      && !isComposerUploading
      // P01A-11: an existing conversation sends only after its committed model is known (no local guess).
      && !(conversation && !conversationSettings)
      && !plannerModelCommandPending,
  )

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

  // Each attached file gets a short name (`image1`, `video2`) that is written into the text as `@image1`; the file
  // itself shows as a small token next to "+" (hover to preview) instead of a box above the composer.

  const appendSelectedAsset = React.useCallback((asset: ChatAssetAttachment, options: { insertToken?: boolean } = {}) => {
    const current = selectedAssetsRef.current
    const existing = current.find((item) => item.id === asset.id)
    if (existing) return assetLabelsRef.current[existing.id] ?? null
    const label = nextComposerAssetLabel(asset.kind, current.map((item) => assetLabelsRef.current[item.id]).filter(Boolean))
    assetLabelsRef.current = { ...assetLabelsRef.current, [asset.id]: label }
    selectedAssetsRef.current = [...current, asset]
    setAssetLabels(assetLabelsRef.current)
    setSelectedAssets((items) => (items.some((item) => item.id === asset.id) ? items : [...items, asset]))
    if (options.insertToken !== false) setDraft((text) => appendComposerToken(text, `@${label}`))
    return label
  }, [setDraft])

  function handleSelectMediaAsset(asset: ChatAssetAttachment) {
    appendSelectedAsset(asset)
    setIsMediaPickerOpen(false)
    // Typing goes on after the new `@image1` token (the caret was still where `@` was typed, before the token).
    window.requestAnimationFrame(() => {
      const textarea = composerTextareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
  }

  function handleRemoveMediaAsset(assetId: string) {
    const label = assetLabelsRef.current[assetId]
    setSelectedAssets((current) => current.filter((asset) => asset.id !== assetId))
    if (label) setDraft((text) => removeComposerToken(text, `@${label}`))
  }

  /** `@` menu rows of attached files: an attached file writes its `@image1` token; "Kütüphaneden seç" opens the picker. */
  function handleAttachedFileMenuItem(item: TypedComposerMenuItem) {
    if (!item.id.startsWith('file:')) return false
    const trigger = typedComposer.trigger
    if (!trigger) return true
    const range = { start: trigger.start, end: trigger.end, token: draft.slice(trigger.start, trigger.end) }
    if (item.id === 'file:pick') {
      typedComposer.insertText(range, '')
      setIsMediaPickerOpen(true)
      return true
    }
    const label = assetLabelsRef.current[item.id.slice('file:'.length)]
    if (label) typedComposer.insertText(range, `@${label} `)
    return true
  }

  function selectComposerMenuItem(item: TypedComposerMenuItem) {
    if (!handleAttachedFileMenuItem(item)) typedComposer.selectMenuItem(item)
  }

  // `@image1` / `@Ece_Avatar` tokens of this message: the inline layer draws them as pills with their picture.
  const composerTokens = new Map<string, ComposerTokenRef>()
  for (const asset of selectedAssets) {
    const label = assetLabels[asset.id]
    if (label) composerTokens.set(`@${label}`, { kind: 'asset', asset })
  }
  for (const chip of typedComposer.chips) {
    if (chip.kind === 'mention') composerTokens.set(composerMentionToken(chip.label), { kind: 'mention', chip })
  }
  const inlineTokens = [...composerTokens.keys()].filter((token) => hasComposerToken(draft, token))
  // A reference whose token is not in the text (e.g. the text was replaced) stays visible next to "+".
  const orphanAssets = selectedAssets.filter((asset) => !inlineTokens.includes(`@${assetLabels[asset.id] ?? ''}`))
  const orphanMentions = typedComposer.chips.filter((chip): chip is ComposerMentionChip => chip.kind === 'mention' && !inlineTokens.includes(composerMentionToken(chip.label)))

  /** Typing away a token removes what it refers to (the attached file or the `@` resource). */
  function handleComposerTextChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    typedComposer.handleChange(event)
    const next = event.target.value
    const gone = (token: string) => hasComposerToken(draft, token) && !hasComposerToken(next, token)
    const removedAssetIds = selectedAssets.filter((asset) => assetLabels[asset.id] && gone(`@${assetLabels[asset.id]}`)).map((asset) => asset.id)
    if (removedAssetIds.length > 0) setSelectedAssets((current) => current.filter((asset) => !removedAssetIds.includes(asset.id)))
    for (const chip of typedComposer.chips) {
      if (chip.kind === 'mention' && gone(composerMentionToken(chip.label))) typedComposer.removeChip(chip.key)
    }
  }

  /** The preview card of the token under the pointer (the layer sits under the textarea, so hit-test its pills). */
  function handleComposerPointer(event: React.MouseEvent<HTMLTextAreaElement>) {
    const mirror = composerMirrorRef.current
    const wrap = composerInputWrapRef.current
    if (!mirror || !wrap || inlineTokens.length === 0) {
      if (composerTokenHover) setComposerTokenHover(null)
      return
    }
    for (const element of mirror.querySelectorAll<HTMLElement>('[data-token]')) {
      const rect = element.getBoundingClientRect()
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        const token = element.dataset.token ?? ''
        if (composerTokenHover?.token !== token) {
          const box = wrap.getBoundingClientRect()
          setComposerTokenHover({ token, left: rect.left - box.left, bottom: box.bottom - rect.top + 6 })
        }
        return
      }
    }
    if (composerTokenHover) setComposerTokenHover(null)
  }

  function handleRemoveMentionChip(chip: ComposerMentionChip) {
    typedComposer.removeChip(chip.key)
    setDraft((text) => removeComposerToken(text, composerMentionToken(chip.label)))
  }

  /** SV: a card action puts its typed message into the composer; the user reads it, completes it and sends it. */
  const askInComposer = React.useCallback((text: string) => {
    setDraft(text)
    window.requestAnimationFrame(() => composerTextareaRef.current?.focus())
  }, [setDraft])

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
  }, [appendSelectedAsset, setDraft, tChat])

  function openComposerUploadPicker() {
    setIsAddMenuOpen(false)
    if (!composerUploadInputRef.current) return
    composerUploadInputRef.current.value = ''
    composerUploadInputRef.current.click()
  }

  async function handleComposerUpload(files: FileList | null) {
    const targetChannelId = conversationChannelId
    if (
      !files
      || files.length === 0
      || !targetChannelId
      || !conversationContextReady
      || isComposerUploading
    ) return
    const selectedFiles = Array.from(files).filter((file) => file.size > 0)
    if (selectedFiles.length === 0) return
    composerUploadAbortRef.current?.abort()
    const uploadController = new AbortController()
    composerUploadAbortRef.current = uploadController
    setIsComposerUploading(true)
    setComposerUploadProgress(0)
    setError(null)
    const memoryIngestion = memoryUpload.beginBatch(targetChannelId, selectedFiles)
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        if (uploadController.signal.aborted) break
        const file = selectedFiles[index]!
        const uploaded = await uploadChatMediaFile(targetChannelId, file, (progress) => {
          if (composerUploadAbortRef.current !== uploadController || uploadController.signal.aborted) return
          const base = (index / selectedFiles.length) * 100
          setComposerUploadProgress(Math.round(base + (progress / selectedFiles.length)))
        }, uploadController.signal, memoryIngestion)
        if (composerUploadAbortRef.current !== uploadController || uploadController.signal.aborted) break
        appendSelectedAsset(uploaded)
      }
    } catch (uploadError) {
      if (!isChatUploadAbort(uploadError, uploadController.signal)) {
        setError(localizeError(uploadError))
      }
    } finally {
      if (composerUploadAbortRef.current !== uploadController) return
      composerUploadAbortRef.current = null
      setIsComposerUploading(false)
      setComposerUploadProgress(null)
      if (composerUploadInputRef.current) composerUploadInputRef.current.value = ''
    }
  }

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
            {isComposerUploading && (
              <ComposerUploadProgress progress={composerUploadProgress} locale={locale} />
            )}
            {(selectedAssets.length > 0 || isComposerUploading) && (
              <MemoryUploadSummaryLine summary={memoryUpload.summary} className="-mt-1 mb-2 px-1" />
            )}

            <PromptBox
              as="form"
              ref={composerFormRef}
              size={isWelcome ? 'big' : 'default'}
              className="@container scroll-mt-24"
              onSubmit={handleSubmit}
              overlay={composerMenuOpen && typedComposer.trigger ? (
                <TypedComposerMenu
                  id={CHAT_COMPOSER_MENU_ID}
                  kind={typedComposer.trigger.kind}
                  groups={activeComposerMenu.groups}
                  activeItemId={activeComposerMenuItemId}
                  loading={activeComposerMenu.loading}
                  error={activeComposerMenu.error}
                  notice={typedComposer.trigger.kind === 'mention' && mentionMenu.failedKinds.length > 0 ? tChat('typedComposer.resourcesPartial') : null}
                  onSelect={selectComposerMenuItem}
                  renderGroupBody={typedComposer.trigger.kind === 'slash' ? connectionSwitchGroupBody(slashMenu.connectionSwitches, { menuId: CHAT_COMPOSER_MENU_ID, activeStopId: activeComposerMenuItemId }) : undefined}
                />
              ) : null}
              top={(
                <>
              <TypedComposerChips
                chips={typedComposer.chips.filter(isCommandChip)}
                disabled={isSending}
                onRemove={typedComposer.removeChip}
                onCopy={typedComposer.copyChips}
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
              />
                </>
              )}
              bar={(
                <>
                  <ComposerAddMenu
                    copy={copy}
                    open={isAddMenuOpen}
                    disabled={!conversationChannelId || !conversationContextReady || isComposerUploading}
                    onOpenChange={setIsAddMenuOpen}
                    onUpload={openComposerUploadPicker}
                    onAssets={() => {
                      setIsAddMenuOpen(false)
                      setIsMediaPickerOpen(true)
                    }}
                    memoryUpload={memoryUpload}
                    connectors={<ComposerAddConnectors active={isAddMenuOpen} conversationId={conversation?.id ?? null} onAdd={() => setIsAddMenuOpen(false)} />}
                  />
                  <ComposerReferenceTokens
                    assets={orphanAssets}
                    labels={assetLabels}
                    mentions={orphanMentions}
                    disabled={isSending}
                    onRemoveAsset={handleRemoveMediaAsset}
                    onRemoveMention={handleRemoveMentionChip}
                  />
                  <ComposerSettingsChips
                    settings={composerSettings}
                    options={composerOptions}
                    minVideoDurationSeconds={minVideoDurationSeconds}
                    maxVideoDurationSeconds={maxVideoDurationSeconds}
                    durationScaleMaxSeconds={durationScaleMaxSeconds}
                    disabled={!conversationChannelId || !conversationContextReady}
                    modelsDisabled={!conversationChannelId || !conversationContextReady}
                    plannerModel={{
                      serverBacked: Boolean(conversation),
                      loaded: Boolean(conversationSettings),
                      pending: plannerModelCommandPending,
                      view: plannerModel,
                      notice: plannerModelNotice,
                      onSelect: (modelId) => void selectPlannerModel(modelId),
                    }}
                    outputCount={outputCount}
                    onChange={setComposerSettings}
                  />
                  <PromptBoxSpacer />
                  <ComposerModeChip
                    value={composerMode.value}
                    options={composerMode.options}
                    pending={composerMode.pending}
                    disabled={!conversationChannelId || !conversationContextReady || (Boolean(conversation) && !conversationSettings)}
                    onSelect={(mode) => void composerMode.select(mode)}
                  />
                  {composerMode.fullAccessConsent && (
                    <FullAccessWarningCard
                      prompt={composerMode.fullAccessConsent.prompt}
                      onConfirm={composerMode.fullAccessConsent.confirm}
                      onDismiss={composerMode.fullAccessConsent.dismiss}
                    />
                  )}
                  {/* With nothing to send while the job's video is being made, the button pauses the production. */}
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
                </>
              )}
            >
              <div ref={composerInputWrapRef} className="relative">
              {inlineTokens.length > 0 && (
                <ComposerTokenMirror mirrorRef={composerMirrorRef} text={draft} tokens={composerTokens} inline={inlineTokens} />
              )}
              <PromptBoxInput
                ref={composerTextareaRef}
                value={draft}
                onChange={handleComposerTextChange}
                onSelect={typedComposer.handleSelect}
                onScroll={(event) => {
                  if (composerMirrorRef.current) composerMirrorRef.current.scrollTop = event.currentTarget.scrollTop
                }}
                onMouseMove={handleComposerPointer}
                onMouseLeave={() => setComposerTokenHover(null)}
                onPaste={(event) => { typedComposer.handlePaste(event) }}
                aria-controls={composerMenuOpen ? CHAT_COMPOSER_MENU_ID : undefined}
                aria-activedescendant={composerMenuOpen && activeComposerMenuItemId ? menuItemDomId(CHAT_COMPOSER_MENU_ID, activeComposerMenuItemId) : undefined}
                onKeyDown={(event) => {
                  // An attached-file row of the `@` menu is handled here (it adds text, not a chip).
                  if (composerMenuOpen && (event.key === 'Enter' || event.key === 'Tab') && activeComposerMenuItemId?.startsWith('file:')) {
                    const item = activeComposerMenu.groups.flatMap((group) => group.items).find((entry) => entry.id === activeComposerMenuItemId)
                    if (item && handleAttachedFileMenuItem(item)) {
                      event.preventDefault()
                      return
                    }
                  }
                  // P03-01: menu keys (select only adds a chip) and the composer's own undo history come first.
                  if (typedComposer.handleKeyDown(event, composerMenuOpen ? composerMenuItems : [], {
                    onToggleSwitch: (stop) => { if (!slashMenu.connectionSwitches?.pending) void slashMenu.connectionSwitches?.setEnabled(stop.connectionId, !stop.enabled) },
                  })) return
                  if (event.key !== 'Enter' || event.shiftKey) return
                  if (!canSubmit) return
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }}
                placeholder={!conversationChannelId ? copy.selectChannel : pendingQuestion ? tChat('questionWidget.ownPlaceholder') : copy.placeholder}
                disabled={!conversationChannelId || !conversationContextReady || isSending}
                rows={isWelcome ? 2 : 1}
                // With tokens in the text the layer underneath draws the words; the textarea keeps caret and selection.
                className={cn('relative', inlineTokens.length > 0 && 'pb-ghost selection:bg-primary/25')}
              />
              {composerTokenHover && composerTokens.get(composerTokenHover.token) && (
                <ComposerTokenPreview
                  reference={composerTokens.get(composerTokenHover.token)!}
                  token={composerTokenHover.token}
                  style={{ left: composerTokenHover.left, bottom: composerTokenHover.bottom }}
                />
              )}
              </div>

            </PromptBox>
            {isWelcome && <ChatWelcomeSuggestions onSuggestion={setDraft} />}
            {mcpTemplates.dialog}
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
        <MediaPickerDialog
          open={isMediaPickerOpen}
          channelId={conversationContextReady ? conversationChannelId : null}
          locale={locale}
          onClose={() => setIsMediaPickerOpen(false)}
          onSelect={handleSelectMediaAsset}
          memoryUpload={memoryUpload}
        />
        <input
          ref={composerUploadInputRef}
          type="file"
          multiple
          accept={CHAT_MEDIA_UPLOAD_ACCEPT}
          className="hidden"
          onChange={(event) => void handleComposerUpload(event.currentTarget.files)}
        />
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
  // E1-H: a `/motion` job's closing answer shows the "Motion draft ready - Open in Motion" card (the Dashboard has no project).
  const motionResult = isUser ? null : readMotionResult(message.content_json)
  // P03-18: the job's connection question shows the small connection card.
  const connectionRequirement = isUser ? null : readConnectionRequirementMessage(message.content_json, message.id)
  const visibleContent = isUser ? message.content.trim() : getAssistantVisibleContent(message.content, attachments)
  const hasVisibleContent = visibleContent.length > 0
  if (!hasVisibleContent && attachments.length === 0 && !workflowDraft && skillCards.length === 0 && !sparkHandoff && !motionResult && !connectionRequirement) return null

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
      {motionResult && <MotionResultCard result={motionResult} />}
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

type ChatInlineAlertTone = 'error' | 'warning' | 'info' | 'success'

function ChatInlineAlert({
  tone,
  title,
  detail,
  className,
  action,
}: {
  tone: ChatInlineAlertTone
  title: string
  detail: string
  className?: string
  action?: React.ReactNode
}) {
  const toneClass = {
    error: {
      shell: 'border-destructive/22 bg-card shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-red-400/22 dark:bg-red-500/[0.07] dark:shadow-[0_16px_44px_rgba(0,0,0,0.22)]',
      accent: 'bg-destructive',
      icon: 'bg-destructive/10 text-destructive ring-destructive/15 dark:bg-red-400/12 dark:text-red-200 dark:ring-red-300/18',
      Icon: CircleAlert,
    },
    warning: {
      shell: 'border-amber-500/24 bg-card shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-amber-200/22 dark:bg-amber-300/[0.08] dark:shadow-[0_16px_44px_rgba(0,0,0,0.22)]',
      accent: 'bg-amber-500',
      icon: 'bg-amber-500/12 text-amber-700 ring-amber-500/18 dark:bg-amber-200/14 dark:text-amber-100 dark:ring-amber-200/16',
      Icon: CircleAlert,
    },
    info: {
      shell: 'border-info/24 bg-card shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-info/30 dark:bg-info/[0.08] dark:shadow-[0_16px_44px_rgba(0,0,0,0.22)]',
      accent: 'bg-info',
      icon: 'bg-info/12 text-info ring-info/18 dark:bg-info/14 dark:text-info dark:ring-info/18',
      Icon: Sparkles,
    },
    success: {
      shell: 'border-success/24 bg-card shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-success/30 dark:bg-success/[0.08] dark:shadow-[0_16px_44px_rgba(0,0,0,0.22)]',
      accent: 'bg-success',
      icon: 'bg-success/12 text-success ring-success/18 dark:bg-success/14 dark:text-success dark:ring-success/18',
      Icon: Check,
    },
  }[tone]
  const Icon = toneClass.Icon

  return (
    <div className={cn('relative overflow-hidden rounded-md border px-4 py-3 text-sm text-card-foreground', toneClass.shell, className)}>
      <span className={cn('absolute inset-y-0 left-0 w-1', toneClass.accent)} aria-hidden="true" />
      <div className="flex items-start gap-3 pl-1">
        <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1', toneClass.icon)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground dark:text-white">{title}</p>
          <p className="mt-1 break-words leading-6 text-muted-foreground dark:text-white/64">{detail}</p>
          {action ? <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      </div>
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

function ComposerSettingsChips({
  settings,
  options,
  minVideoDurationSeconds,
  maxVideoDurationSeconds,
  durationScaleMaxSeconds,
  disabled,
  modelsDisabled,
  plannerModel,
  outputCount,
  onChange,
}: {
  settings: ComposerSettings
  options: ComposerOptions
  minVideoDurationSeconds: number
  maxVideoDurationSeconds: number | null
  durationScaleMaxSeconds: number | null
  disabled: boolean
  /** P01A-11: the models control stays usable during an active job (a switch applies from its next step). */
  modelsDisabled: boolean
  plannerModel: ComposerPlannerModelControl
  /** QA-078: the "Adet" section of the canvas popover. */
  outputCount: ComposerOutputCountControl
  onChange: React.Dispatch<React.SetStateAction<ComposerSettings>>
}) {
  const selectedImageModel = selectComposerImageModelForTask(settings.imageModelId, settings.imageTask, options.imageModels)
  const compatibleImageModels = options.imageModels.filter((option) => composerModelSupportsImageTask(option, settings.imageTask))
  const imageModelOptions = compatibleImageModels.length > 0 ? compatibleImageModels : options.imageModels
  const imageTaskOptions = composerImageTaskOptions(options.imageModels)
  const imageSizeOptions = modelInputOptions(selectedImageModel, 'sizes')
  const imageResolutionOptions = modelInputOptions(selectedImageModel, 'resolutions')
  const imageQualityOptions = modelInputOptions(selectedImageModel, 'qualities')
  const imageFormatOptions = modelInputOptions(selectedImageModel, 'output_formats')

  return (
    <>
      <ComposerModelsControl
        settings={settings}
        options={options}
        imageModels={imageModelOptions}
        disabled={modelsDisabled}
        mediaDisabled={disabled}
        plannerModel={plannerModel}
        onChange={onChange}
      />
      <ComposerOutputControl
        aspectRatio={settings.aspectRatio}
        aspectOptions={options.aspectRatios}
        imageTask={settings.imageTask}
        imageTaskOptions={imageTaskOptions}
        imageModels={options.imageModels}
        disabled={disabled}
        onChange={onChange}
      />
      <ComposerDurationChip
        value={settings.durationSeconds}
        minSeconds={minVideoDurationSeconds}
        maxSeconds={maxVideoDurationSeconds}
        scaleMaxSeconds={durationScaleMaxSeconds}
        disabled={disabled || maxVideoDurationSeconds === null}
        onChange={(durationSeconds) => onChange((current) => ({ ...current, durationSeconds }))}
      />
      <ComposerCanvasControl
        settings={settings}
        imageSizeOptions={imageSizeOptions}
        imageResolutionOptions={imageResolutionOptions}
        imageQualityOptions={imageQualityOptions}
        imageFormatOptions={imageFormatOptions}
        outputCount={outputCount}
        disabled={disabled}
        onChange={onChange}
      />
    </>
  )
}

type ComposerControlOption = {
  id: string
  label: string
  hint: string
}

/** P01A-11 chat model control: server-backed for an existing conversation, a local first-message pick otherwise. */
type ComposerPlannerModelControl = {
  serverBacked: boolean
  loaded: boolean
  pending: boolean
  view: PlannerModelView
  notice: PlannerModelCommandResult | null
  onSelect: (modelId: string) => void
}

const PLANNER_MODEL_HINT_KEYS: Record<NonNullable<ReturnType<typeof plannerModelHint>>, string> = {
  current_step: 'composer.modelCurrentStep',
  next_step: 'composer.modelNextStep',
  unavailable: 'composer.modelUnavailable',
}

const PLANNER_MODEL_NOTICE_KEYS: Record<PlannerModelCommandResult, string> = {
  applied: 'composer.modelNextStep',
  job_only: 'composer.modelChangeJobOnly',
  stale: 'composer.modelChangeStale',
  target_gone: 'composer.modelChangeTargetGone',
  unsupported: 'composer.modelChangeUnsupported',
  forbidden: 'composer.modelChangeForbidden',
  defaults_owner_only: 'composer.modelChangeDefaultsOwnerOnly',
  failed: 'composer.modelChangeFailed',
}

function plannerModelNoticeKey(result: PlannerModelCommandResult): string {
  return PLANNER_MODEL_NOTICE_KEYS[result]
}

/**
 * A composer bar popover: it opens under its button when there is room below (the centered start screen) and flips
 * above it otherwise (the composer at the bottom of a conversation); with room on neither side it scrolls.
 */
function ComposerPopoverContent({ className, ...props }: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      side="bottom"
      align="start"
      sideOffset={8}
      collisionPadding={12}
      className={cn('youtorch-thin-scrollbar max-h-(--radix-popover-content-available-height) overflow-y-auto rounded-xl border-border bg-popover shadow-xl shadow-black/40', className)}
      {...props}
    />
  )
}

/**
 * The composer menus' look (the model picker's): sections split by a rule (`divide-y` on the popover), a quiet label,
 * one-line rows. Shared by the "+", output, duration and canvas menus.
 */
function ComposerMenuSection({ label, className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className={cn('p-1.5', className)}>
      {label ? <p className="px-2.5 pb-1 pt-1 text-xs text-muted-foreground">{label}</p> : null}
      {children}
    </div>
  )
}

/** A menu row: icon, name, an optional quiet value (`16:9`) and, for a choice, ✓ when it is the selected one. */
function ComposerMenuRow({
  icon,
  label,
  meta,
  selected,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & {
  icon?: React.ReactNode
  label: React.ReactNode
  meta?: React.ReactNode
  /** Set for a choice (✓ when true); left out for an action row. */
  selected?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        'flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      {icon ? <span className={cn('flex size-[18px] shrink-0 items-center justify-center [&>svg]:size-[18px]', selected ? 'text-foreground' : 'text-muted-foreground')}>{icon}</span> : null}
      <span className={cn('min-w-0 flex-1 truncate', selected ? 'font-semibold text-foreground' : 'text-foreground/75')}>{label}</span>
      {meta ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
      {selected === undefined ? null : selected ? <Check strokeWidth={1.75} className="size-4 shrink-0 text-foreground" /> : <span className="size-4 shrink-0" />}
    </button>
  )
}

/** A composer bar button; also the `asChild` trigger of its popover (the trigger's props reach the button). */
function ComposerControlButton({
  icon: Icon,
  label,
  value,
  open,
  ...props
}: Omit<React.ComponentProps<'button'>, 'value'> & {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string
  open: boolean
  /** A ⌄ after the value (the model picker, like a select). */
  caret?: boolean
}) {
  return (
    <PromptBoxChip
      title={value ? `${label}: ${value}` : label}
      aria-expanded={open}
      {...props}
      icon={<Icon />}
      srLabel={label}
      label={value}
      collapse
    />
  )
}

/** A choice row of a composer menu (also the "Adet" section's row); the hint is the quiet value at its end. */
function ComposerControlOptionRow({
  option,
  selected,
  disabled = false,
  onClick,
}: {
  option: ComposerControlOption
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return <ComposerMenuRow label={option.label} meta={option.hint || undefined} selected={selected} disabled={disabled} onClick={onClick} />
}

function ComposerModelsControl({
  settings,
  options,
  imageModels,
  disabled,
  mediaDisabled,
  plannerModel,
  onChange,
}: {
  settings: ComposerSettings
  options: ComposerOptions
  imageModels: ComposerModelOption[]
  disabled: boolean
  /** Video/image picks keep their previous rule (locked while a job runs); only the chat model stays switchable. */
  mediaDisabled: boolean
  plannerModel: ComposerPlannerModelControl
  onChange: React.Dispatch<React.SetStateAction<ComposerSettings>>
}) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  // Model Selector (AI Elements): a searchable palette, models grouped by what they do.
  const [open, setOpen] = React.useState(false)
  // P01A-11: exact catalog models; the checked one is the server-committed model (or the unsent first-message pick).
  const plannerModelValue = plannerModel.serverBacked ? plannerModel.view.selectedModelId : settings.chatModelId
  const groups = [
    {
      key: 'orchestration' as const,
      icon: Cpu,
      title: tChat('composer.orchestration'),
      value: plannerModelValue,
      options: options.chatModels.map((option) => {
        const hint = plannerModel.serverBacked ? plannerModelHint(option.id, plannerModel.view) : null
        return { id: option.id, label: option.label, hint: hint ? tChat(PLANNER_MODEL_HINT_KEYS[hint]) : option.description }
      }),
    },
    {
      key: 'video' as const,
      icon: Film,
      title: tChat('composer.video'),
      value: settings.videoModelId,
      options: options.videoModels.map((option) => ({ id: option.id, label: option.label, hint: option.description })),
    },
    {
      key: 'image' as const,
      icon: ImageIcon,
      title: tChat('composer.image'),
      value: settings.imageModelId,
      options: imageModels.map((option) => ({ id: option.id, label: option.label, hint: option.description })),
    },
  ]

  function selectModel(group: (typeof groups)[number]['key'], id: string) {
    if (group === 'orchestration') {
      plannerModel.onSelect(id)
      return
    }
    if (group === 'video') {
      onChange((current) => ({ ...current, videoModelId: id }))
      return
    }
    onChange((current) => {
      const model = options.imageModels.find((option) => option.id === id) ?? null
      return { ...current, imageModelId: id, ...reconcileImageModelInputs(current, model) }
    })
  }

  const plannerLabel = options.chatModels.find((option) => option.id === plannerModelValue)?.label

  return (
    <Popover open={open && !disabled} onOpenChange={(nextOpen) => setOpen(disabled ? false : nextOpen)}>
      <PopoverTrigger asChild>
        <ComposerControlButton
          icon={Cpu}
          label={tAuto('models_f3798f81')}
          value={plannerLabel}
          open={open}
          disabled={disabled}
          caret
        />
      </PopoverTrigger>
      {/* A quiet select: search on top, one line per model (its kind's icon, name, ✓ / lock), groups split by rules. */}
      <ComposerPopoverContent aria-label={tChat('modelSelector.title')} className="w-72 overflow-hidden p-0">
        <Command className="bg-transparent **:data-[slot=command-input-wrapper]:h-11 **:data-[slot=command-input-wrapper]:gap-2.5 **:data-[slot=command-input-wrapper]:px-3.5 [&_[cmdk-group-heading]]:sr-only">
          <CommandInput placeholder={tChat('modelSelector.search')} />
          <CommandList className="youtorch-thin-scrollbar max-h-[min(22rem,calc(var(--radix-popover-content-available-height,100vh)_-_3rem))]">
            <CommandEmpty>{tChat('modelSelector.empty')}</CommandEmpty>
            {groups.map((group, index) => (
              <React.Fragment key={group.key}>
                {index > 0 ? <CommandSeparator className="mx-0" /> : null}
                <CommandGroup heading={group.title} className="p-1.5">
                  {group.key === 'orchestration' && plannerModel.notice ? (
                    <p role="status" className="px-2.5 py-1.5 text-xs text-muted-foreground">{tChat(PLANNER_MODEL_NOTICE_KEYS[plannerModel.notice])}</p>
                  ) : null}
                  {group.key === 'orchestration' && plannerModel.serverBacked && !plannerModel.loaded ? (
                    <p className="px-2.5 py-1.5 text-xs text-muted-foreground">{tChat('composer.modelSettingsLoading')}</p>
                  ) : group.options.map((option) => {
                    const selected = option.id === group.value
                    const locked = group.key === 'orchestration' ? plannerModel.pending : mediaDisabled
                    return (
                      <CommandItem
                        key={option.id}
                        value={`${group.title} ${option.label} ${option.id}`}
                        disabled={locked}
                        title={option.hint || undefined}
                        onSelect={() => {
                          selectModel(group.key, option.id)
                          setOpen(false)
                        }}
                        className="h-9 gap-3 rounded-lg px-2.5"
                      >
                        <group.icon className={cn('!size-[18px]', selected ? 'text-foreground' : 'text-muted-foreground')} />
                        <span className={cn('min-w-0 flex-1 truncate text-sm', selected ? 'font-semibold text-foreground' : 'text-foreground/75')}>{option.label}</span>
                        {selected
                          ? <Check strokeWidth={1.75} className="!size-4 text-foreground" />
                          : locked ? <Lock className="!size-3.5 text-muted-foreground" /> : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </ComposerPopoverContent>
    </Popover>
  )
}

/** The icon of an image generation mode in the output menu (an unknown mode gets the sparkles). */
const IMAGE_TASK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text_to_image: TypeIcon,
  image_to_image: ImageIcon,
  reference_image: ImagesIcon,
  image_edit: PencilLine,
}

function ComposerOutputControl({
  aspectRatio,
  aspectOptions,
  imageTask,
  imageTaskOptions,
  imageModels,
  disabled,
  onChange,
}: {
  aspectRatio: ComposerAspectRatio
  aspectOptions: ComposerAspectOption[]
  imageTask: string
  imageTaskOptions: ComposerInputOption[]
  imageModels: ComposerModelOption[]
  disabled: boolean
  onChange: React.Dispatch<React.SetStateAction<ComposerSettings>>
}) {
  const tAuto = useTranslations('Auto')
  const [open, setOpen] = React.useState(false)
  const selectedAspect = aspectOptions.find((option) => option.id === aspectRatio) ?? aspectOptions[0]

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ComposerControlButton
          icon={SlidersHorizontal}
          label={tAuto('output_4bed3361')}
          value={selectedAspect?.id === '9:16' ? tAuto('short_0fe7d82f') : selectedAspect?.label}
          open={open}
          disabled={disabled}
        />
      </PopoverTrigger>
      <ComposerPopoverContent className="w-64 divide-y divide-border p-0">
        <ComposerMenuSection label={tAuto('frame_size_b4062689')}>
          {aspectOptions.map((option) => (
            <ComposerMenuRow
              key={option.id}
              icon={<option.icon />}
              label={option.id === '9:16' ? tAuto('short_0fe7d82f') : option.label}
              meta={option.id}
              selected={option.id === aspectRatio}
              onClick={() => onChange((current) => ({ ...current, aspectRatio: option.id }))}
            />
          ))}
        </ComposerMenuSection>
        {imageTaskOptions.length > 0 && (
          <ComposerMenuSection label={tAuto('generation_mode_d4e81c05')}>
            {imageTaskOptions.map((option) => {
              const TaskIcon = IMAGE_TASK_ICONS[option.id] ?? Sparkles
              return (
                <ComposerMenuRow
                  key={option.id}
                  icon={<TaskIcon />}
                  label={option.label}
                  title={option.detail}
                  selected={option.id === imageTask}
                  onClick={() => onChange((current) => {
                    const model = selectComposerImageModelForTask(current.imageModelId, option.id, imageModels)
                    const nextInputs = reconcileImageModelInputs({ ...current, imageTask: option.id }, model)
                    return { ...current, imageModelId: model?.id ?? current.imageModelId, ...nextInputs }
                  })}
                />
              )
            })}
          </ComposerMenuSection>
        )}
      </ComposerPopoverContent>
    </Popover>
  )
}

function ComposerDurationChip({
  value,
  minSeconds,
  maxSeconds,
  scaleMaxSeconds,
  disabled,
  onChange,
}: {
  value: number
  minSeconds: number
  maxSeconds: number | null
  scaleMaxSeconds: number | null
  disabled: boolean
  onChange: (value: number) => void
}) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  const formatLocalizedDurationLabel = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.round(seconds))
    if (safeSeconds < 60) return tChat('composer.durationSeconds', { seconds: safeSeconds })
    const minutes = Math.floor(safeSeconds / 60)
    const remainingSeconds = safeSeconds % 60
    if (minutes < 60) return remainingSeconds === 0
      ? tChat('composer.durationMinutes', { minutes })
      : tChat('composer.durationMinutesSeconds', { minutes, seconds: remainingSeconds })
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes === 0
      ? tChat('composer.durationHours', { hours })
      : tChat('composer.durationHoursMinutes', { hours, minutes: remainingMinutes })
  }
  const [open, setOpen] = React.useState(false)
  const [customValue, setCustomValue] = React.useState('')
  const [customUnit, setCustomUnit] = React.useState<ComposerDurationUnit>('minutes')
  const resolvedMinSeconds = Math.max(COMPOSER_VIDEO_DURATION_MIN_SECONDS, Math.round(minSeconds))
  const planMaxSeconds = Math.max(resolvedMinSeconds, Math.round(maxSeconds ?? resolvedMinSeconds))
  const clampedValue = clampVideoDurationSeconds(value, planMaxSeconds, resolvedMinSeconds)
  const sliderStepSeconds = COMPOSER_DURATION_SLIDER_STEP_SECONDS
  const sliderScaleMaxSeconds = getComposerDurationScaleMax(planMaxSeconds, scaleMaxSeconds)
  const upgradeAvailable = sliderScaleMaxSeconds > planMaxSeconds
  const [sliderValue, setSliderValue] = React.useState(clampedValue)
  const normalizedSliderValue = clampVideoDurationSeconds(sliderValue, sliderScaleMaxSeconds, resolvedMinSeconds)
  const planLimitProgress = Math.min((planMaxSeconds / sliderScaleMaxSeconds) * 100, 100)
  const progress = Math.min((Math.min(normalizedSliderValue, planMaxSeconds) / sliderScaleMaxSeconds) * 100, 100)
  const isPastPlanLimit = normalizedSliderValue > planMaxSeconds
  const customDurationSeconds = parseComposerDurationInteger(customValue, customUnit)
  const customExceedsPlan = customDurationSeconds !== null && customDurationSeconds > planMaxSeconds

  const commitDuration = React.useCallback((candidateSeconds: number) => {
    const committedSeconds = clampVideoDurationSeconds(candidateSeconds, planMaxSeconds, resolvedMinSeconds)
    setSliderValue(committedSeconds)
    onChange(committedSeconds)
    setOpen(false)
  }, [onChange, planMaxSeconds, resolvedMinSeconds])

  // Opening starts from the committed duration with an empty custom field; closing drops an uncommitted slider value.
  const handleOpenChange = (nextOpen: boolean) => {
    setSliderValue(clampedValue)
    if (nextOpen) setCustomValue('')
    setOpen(nextOpen)
  }

  const commitCustomDuration = () => {
    if (customDurationSeconds === null) return
    commitDuration(customDurationSeconds)
  }

  return (
    <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <PromptBoxChip
          disabled={disabled}
          aria-expanded={open}
          icon={<Clock />}
          label={<span className="tabular-nums">{maxSeconds === null ? tAuto('length_3bade34e') : formatLocalizedDurationLabel(clampedValue)}</span>}
        />
      </PopoverTrigger>

      <ComposerPopoverContent className="w-72 divide-y divide-border p-0">
        <div className="px-4 pb-3 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground"><UiText id="duration_1370004d" /></span>
            <span className={cn('text-sm font-semibold tabular-nums', isPastPlanLimit ? 'text-rose-400' : 'text-foreground')}>
              {formatLocalizedDurationLabel(normalizedSliderValue)}
            </span>
          </div>

          <div className="relative mt-3 flex h-4 items-center">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-accent">
              {upgradeAvailable && (
                <div
                  className="absolute inset-y-0 right-0 bg-rose-500/25"
                  style={{ width: (100 - planLimitProgress) + '%' }}
                />
              )}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-foreground/80 transition-[width] duration-150 ease-out"
                style={{ width: progress + '%' }}
              />
            </div>
            <input
              type="range"
              min={resolvedMinSeconds}
              max={sliderScaleMaxSeconds}
              step={sliderStepSeconds}
              value={normalizedSliderValue}
              onChange={(event) => setSliderValue(Number(event.currentTarget.value))}
              onPointerUp={(event) => commitDuration(Number(event.currentTarget.value))}
              onPointerCancel={(event) => commitDuration(Number(event.currentTarget.value))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setSliderValue(clampedValue)
                  setOpen(false)
                }
              }}
              onKeyUp={(event) => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter'].includes(event.key)) {
                  commitDuration(Number(event.currentTarget.value))
                }
              }}
              className={cn(
                'absolute inset-0 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-popover [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110',
                isPastPlanLimit
                  ? '[&::-webkit-slider-thumb]:bg-rose-400'
                  : '[&::-webkit-slider-thumb]:bg-foreground',
              )}
              aria-label={tAuto('video_duration_72347bc5')}
              aria-valuetext={isPastPlanLimit
                ? tChat('composer.planLimitExceededSelection', { duration: formatLocalizedDurationLabel(planMaxSeconds) })
                : formatLocalizedDurationLabel(normalizedSliderValue)}
            />
          </div>

          <div className="relative mt-1 h-4 whitespace-nowrap text-[11px] text-muted-foreground">
            <span className="absolute left-0">{formatLocalizedDurationLabel(resolvedMinSeconds)}</span>
            <span
              className="absolute -translate-x-full text-foreground/75"
              style={{ left: planLimitProgress + '%' }}
            >
              {formatLocalizedDurationLabel(planMaxSeconds)}
            </span>
            {upgradeAvailable && <span className="absolute right-0 text-rose-400"><UiText id="maks_sure_fc0583c5" /></span>}
          </div>

          {(isPastPlanLimit || customExceedsPlan) && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-4 text-rose-400">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {isPastPlanLimit
                  ? tChat('composer.planMaximumWillBeSelected', { duration: formatLocalizedDurationLabel(planMaxSeconds) })
                  : customExceedsPlan
                    ? tChat('composer.planMaximumWillBeApplied', { duration: formatLocalizedDurationLabel(planMaxSeconds) })
                    : tChat('composer.planMaximum', { duration: formatLocalizedDurationLabel(planMaxSeconds) })}
              </span>
            </p>
          )}
        </div>

        <div className="grid auto-cols-fr grid-flow-col gap-1 p-1.5">
          {COMPOSER_DURATION_PRESETS.map((preset) => {
            const locked = preset < resolvedMinSeconds || preset > planMaxSeconds
            const selected = clampedValue === preset
            return (
              <button
                key={preset}
                type="button"
                disabled={locked}
                aria-pressed={selected}
                title={locked ? tChat('composer.planMaximum', { duration: formatLocalizedDurationLabel(planMaxSeconds) }) : undefined}
                onClick={() => commitDuration(preset)}
                className={cn(
                  'h-8 whitespace-nowrap rounded-lg px-1 text-[13px] tabular-nums transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-35',
                  selected ? 'bg-accent font-semibold text-foreground' : 'text-foreground/75',
                )}
              >
                {formatLocalizedDurationLabel(preset)}
              </button>
            )
          })}
        </div>

        <div className="p-1.5">
          <div className="flex h-9 items-center gap-3 rounded-lg px-2.5 focus-within:bg-accent/60">
            <Clock className={cn('size-[18px] shrink-0', customExceedsPlan ? 'text-rose-400' : 'text-muted-foreground')} />
            <input
              value={customValue}
              inputMode="numeric"
              pattern="[0-9]*"
              onChange={(event) => {
                const digits = event.currentTarget.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                setCustomValue(digits)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                commitCustomDuration()
              }}
              placeholder="3"
              aria-label={tAuto('custom_video_duration_796a41ab')}
              className="min-w-0 flex-1 bg-transparent text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="relative shrink-0">
              <select
                value={customUnit}
                onChange={(event) => setCustomUnit(event.currentTarget.value as ComposerDurationUnit)}
                aria-label={tAuto('duration_unit_0af43a1a')}
                className="h-7 appearance-none rounded-md bg-transparent py-0 pl-2 pr-6 text-xs text-foreground/75 outline-none transition hover:bg-accent focus-visible:bg-accent"
              >
                <option value="seconds">{tChat('composer.secondsShort')}</option>
                <option value="minutes">{tChat('composer.minutesShort')}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            </div>
            <button
              type="button"
              disabled={customDurationSeconds === null}
              title={customExceedsPlan ? tChat('composer.maximumApplied', { duration: formatLocalizedDurationLabel(planMaxSeconds) }) : tAuto('sureyi_uygula_59d32ccd')}
              onClick={commitCustomDuration}
              aria-label={tAuto('apply_custom_duration_36683753')}
              className={cn(
                '-mr-1 grid size-7 shrink-0 place-items-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30',
                customExceedsPlan
                  ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                  : 'bg-foreground text-background hover:bg-foreground/90',
              )}
            >
              <Check className="size-3.5" />
            </button>
          </div>
        </div>
      </ComposerPopoverContent>
    </Popover>
  )
}
function ComposerCanvasControl({
  settings,
  imageSizeOptions,
  imageResolutionOptions,
  imageQualityOptions,
  imageFormatOptions,
  outputCount,
  disabled,
  onChange,
}: {
  settings: ComposerSettings
  imageSizeOptions: ComposerInputOption[]
  imageResolutionOptions: ComposerInputOption[]
  imageQualityOptions: ComposerInputOption[]
  imageFormatOptions: ComposerInputOption[]
  outputCount: ComposerOutputCountControl
  disabled: boolean
  onChange: React.Dispatch<React.SetStateAction<ComposerSettings>>
}) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  const [open, setOpen] = React.useState(false)
  const groups = [
    { key: 'imageSize' as const, title: tChat('composer.canvasSize'), value: settings.imageSize, options: imageSizeOptions },
    { key: 'imageResolution' as const, title: tChat('composer.resolution'), value: settings.imageResolution, options: imageResolutionOptions },
    { key: 'imageQuality' as const, title: tChat('composer.quality'), value: settings.imageQuality, options: imageQualityOptions },
    { key: 'imageOutputFormat' as const, title: tChat('composer.format'), value: settings.imageOutputFormat, options: imageFormatOptions },
  ].filter((group) => group.options.length > 0)

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ComposerControlButton
          icon={LayoutTemplate}
          label={tAuto('canvas_a3f80b87')}
          value={composerOutputCountButtonValue(outputCount, tChat)}
          open={open}
          disabled={disabled}
        />
      </PopoverTrigger>
      <ComposerPopoverContent className="max-h-[min(24rem,var(--radix-popover-content-available-height,100vh))] w-60 divide-y divide-border p-0">
        <ComposerOutputCountSection view={outputCount} row={ComposerControlOptionRow} onSelect={outputCount.select} />
        {groups.length === 0 && outputCount.options.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground"><UiText id="no_canvas_settings_for_this_model_c1bf28da" /></p>
        ) : groups.map((group) => (
          <ComposerMenuSection key={group.key} label={group.title}>
            {group.options.map((option) => (
              <ComposerMenuRow
                key={option.id}
                label={option.label}
                title={option.detail}
                selected={option.id === group.value}
                onClick={() => onChange((current) => ({ ...current, [group.key]: option.id }))}
              />
            ))}
          </ComposerMenuSection>
        ))}
      </ComposerPopoverContent>
    </Popover>
  )
}

function ComposerUploadProgress({
  progress,
  locale,
}: {
  progress: number | null
  locale: ChatLocale
}) {
  const copy = useChatCopy()
  return (
    <div className="mb-3 rounded-[14px] border border-border/80 bg-background px-3 py-2 text-foreground shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-none">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 animate-spin text-muted-foreground dark:text-white/58" />
        <span>{copy.uploadingMedia}{progress === null ? '' : ` ${progress}%`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-white/8">
        <div className="h-full rounded-full bg-primary transition-all dark:bg-white/70" style={{ width: `${progress ?? 12}%` }} />
      </div>
    </div>
  )
}

/** Attached files and `@` resources as small tokens next to "+": thumbnail/icon + `@name`; hover shows a preview. */
function ComposerReferenceTokens({
  assets,
  labels,
  mentions,
  disabled,
  onRemoveAsset,
  onRemoveMention,
}: {
  assets: ChatAssetAttachment[]
  labels: Record<string, string>
  mentions: ComposerMentionChip[]
  disabled: boolean
  onRemoveAsset: (assetId: string) => void
  onRemoveMention: (chip: ComposerMentionChip) => void
}) {
  const tAuto = useTranslations('Auto')
  if (assets.length === 0 && mentions.length === 0) return null
  const token = 'flex h-9 max-w-44 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/40 pl-1 pr-1.5 text-xs font-medium text-foreground'
  const remove = 'flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-45'
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {assets.map((asset) => {
        const name = `@${labels[asset.id] ?? asset.kind}`
        return (
          <HoverCard key={asset.id} openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span className={token} tabIndex={0}>
                <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                  <ComposerTokenThumb asset={asset} iconClassName="size-3.5" />
                </span>
                <span className="truncate">{name}</span>
                <button type="button" disabled={disabled} aria-label={tAuto('remove_attachment_0fcc6594')} onClick={() => onRemoveAsset(asset.id)} className={remove}>
                  <X className="size-3" />
                </button>
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-64 p-2">
              <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                <ComposerTokenThumb asset={asset} iconClassName="size-8" />
              </div>
              <p className="mt-2 truncate px-1 text-sm font-medium text-foreground">{name}</p>
              <p className="truncate px-1 text-xs text-muted-foreground">{asset.name}</p>
            </HoverCardContent>
          </HoverCard>
        )
      })}
      {mentions.map((chip) => {
        const name = composerMentionToken(chip.label)
        return (
          <HoverCard key={chip.key} openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span className={token} tabIndex={0}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MentionKindIcon chip={chip} className="size-3.5" />
                </span>
                <span className="truncate">{name}</span>
                <button type="button" disabled={disabled} aria-label={tAuto('remove_attachment_0fcc6594')} onClick={() => onRemoveMention(chip)} className={remove}>
                  <X className="size-3" />
                </button>
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-56 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MentionKindIcon chip={chip} className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{chip.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{name}</span>
                </span>
              </div>
            </HoverCardContent>
          </HoverCard>
        )
      })}
    </div>
  )
}

type ComposerTokenRef = { kind: 'asset'; asset: ChatAssetAttachment } | { kind: 'mention'; chip: ComposerMentionChip }

function MentionKindIcon({ chip, className }: { chip: ComposerMentionChip; className?: string }) {
  if (chip.resourceKind === 'avatar') return <UserRound className={className} />
  if (chip.resourceKind === 'voice') return <Mic className={className} />
  if (chip.resourceKind.includes('template')) return <LayoutTemplate className={className} />
  return <AtSign className={className} />
}

/** Space (px) between a token's picture and its label in the composer text. */
const COMPOSER_TOKEN_PICTURE_GAP = 3

/**
 * Draws the composer text under the (transparent) textarea with the same box and wrapping, so `@image1` tokens show
 * as pills with their picture in place of the `@`, exactly where they are typed. Same characters, so the caret lines up.
 */
function ComposerTokenMirror({
  mirrorRef,
  text,
  tokens,
  inline,
}: {
  mirrorRef: React.Ref<HTMLDivElement>
  text: string
  tokens: Map<string, ComposerTokenRef>
  inline: string[]
}) {
  const alternatives = inline.map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')
  const pattern = new RegExp(`(?<=^|\\s)(${alternatives})(?=\\s|$)`, 'u')
  const parts = text.split(pattern)
  return (
    <div
      ref={mirrorRef}
      aria-hidden="true"
      className="pb-input pb-mirror"
    >
      {parts.map((part, index) => {
        const reference = index % 2 === 1 ? tokens.get(part) : undefined
        if (!reference) return <React.Fragment key={index}>{part}</React.Fragment>
        const label = part.slice(1)
        return (
          <span key={index} data-token={part} className="relative rounded-[5px] bg-primary/15 ring-[3px] ring-primary/15">
            <span className="text-transparent">@</span>
            <span className="absolute -left-px top-1/2 flex size-[14px] -translate-y-1/2 items-center justify-center overflow-hidden rounded-[4px] bg-muted text-muted-foreground">
              {reference.kind === 'asset' ? <ComposerTokenThumb asset={reference.asset} iconClassName="size-2.5" /> : <MentionKindIcon chip={reference.chip} className="size-2.5" />}
            </span>
            {/* A small gap after the picture; the label's tighter tracking gives the width back, so the token keeps its width. */}
            <span style={{ marginLeft: COMPOSER_TOKEN_PICTURE_GAP, letterSpacing: -COMPOSER_TOKEN_PICTURE_GAP / Array.from(label).length }}>{label}</span>
          </span>
        )
      })}
      {'\u200b'}
    </div>
  )
}

/** The preview card above a hovered token: the picture (or icon), the token and the file / resource name. */
function ComposerTokenPreview({ reference, token, style }: { reference: ComposerTokenRef; token: string; style: React.CSSProperties }) {
  return (
    <div style={style} className="pointer-events-none absolute z-30 w-60 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl shadow-black/30 duration-150 animate-in fade-in slide-in-from-bottom-1">
      {reference.kind === 'asset' ? (
        <>
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
            <ComposerTokenThumb asset={reference.asset} iconClassName="size-8" />
          </div>
          <p className="mt-2 truncate px-1 text-sm font-medium">{token}</p>
          <p className="truncate px-1 text-xs text-muted-foreground">{reference.asset.name}</p>
        </>
      ) : (
        <div className="flex items-center gap-2.5 p-1">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MentionKindIcon chip={reference.chip} className="size-5" /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{reference.chip.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{token}</span>
          </span>
        </div>
      )}
    </div>
  )
}

function hasComposerToken(text: string, token: string) {
  return composerTokenPattern(token).test(text)
}

/**
 * A token's picture: a Storage file's signed thumbnail (as in the media picker; a video has no image URL of its own),
 * else the file's preview image, else its kind icon (also when the image fails).
 */
function ComposerTokenThumb({ asset, iconClassName }: { asset: ChatAssetAttachment; iconClassName?: string }) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const storageThumbnail = useStorageThumbnailUrl({
    channelId: asset.channelId,
    objectId: asset.objectId ?? '',
    enabled: Boolean(asset.objectId) && isVisualAttachment(asset),
  })
  const src = storageThumbnail.data?.url ?? getMediaThumbnailUrl(asset) ?? (isVisualAttachment(asset) ? asset.previewUrl ?? null : null)
  if (!src || failedSrc === src) return <AttachmentKindIcon kind={asset.kind} className={iconClassName} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
}

/** `image1`, `image2`, `video1`…: the lowest free number for the kind among the files already attached. */
function nextComposerAssetLabel(kind: ChatAssetKind, taken: string[]) {
  const prefix = kind === 'document' ? 'file' : kind
  let index = 1
  while (taken.includes(`${prefix}${index}`)) index += 1
  return `${prefix}${index}`
}

function composerTokenPattern(token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'u')
}

/** Adds ` @image1 ` at the end of the text unless it is already there. */
function appendComposerToken(text: string, token: string) {
  if (composerTokenPattern(token).test(text)) return text
  const base = text.replace(/\s+$/u, '')
  return base ? `${base} ${token} ` : `${token} `
}

/** Removes the first `@image1` token from the text (and the extra space it leaves). */
function removeComposerToken(text: string, token: string) {
  return text.replace(composerTokenPattern(token), '$1').replace(/ {2,}/gu, ' ')
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
function StoragePickerPreview({
  item,
  channelId,
}: {
  item: StorageObjectItem
  channelId: string | null
}) {
  const kind = inferAttachmentKind({ url: item.name, mimeType: item.mime_type, name: item.name })
  const thumbnail = useStorageThumbnailUrl({
    channelId,
    objectId: item.id,
    enabled: kind === 'image' || kind === 'video',
  })
  if (thumbnail.data?.url && (kind === 'image' || kind === 'video')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnail.data.url}
        alt={item.name}
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full object-cover"
      />
    )
  }
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground dark:text-white/48">
      <AttachmentKindIcon kind={kind} className="size-9" />
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

function AttachmentKindIcon({ kind, className }: { kind: ChatAssetKind; className?: string }) {
  if (kind === 'image') return <ImageIcon className={className} />
  if (kind === 'video') return <Film className={className} />
  return <FileIcon className={className} />
}

function ComposerAddMenu({
  copy,
  open,
  disabled,
  onOpenChange,
  onUpload,
  onAssets,
  memoryUpload,
  connectors,
}: {
  copy: ChatCopy
  open: boolean
  disabled: boolean
  onOpenChange: (open: boolean) => void
  onUpload: () => void
  onAssets: () => void
  memoryUpload: MemoryUploadChoice
  /** QA-131: the "Connectors" group (connected connectors + "Add" in a new tab). */
  connectors?: React.ReactNode
}) {
  return (
    <Popover open={open && !disabled} onOpenChange={(nextOpen) => onOpenChange(disabled ? false : nextOpen)}>
      <PopoverTrigger asChild>
        <PromptBoxChip aria-label={copy.addContext} title={copy.addContext} disabled={disabled} icon={<Plus />} />
      </PopoverTrigger>
      <ComposerPopoverContent className="w-64 divide-y divide-border p-0">
        <ComposerMenuSection>
          <ComposerMenuRow icon={<Upload />} label={copy.addMenuUpload} onClick={onUpload} />
          <MemoryIngestionCheckbox
            checked={memoryUpload.checked}
            availability={memoryUpload.availability}
            onCheckedChange={memoryUpload.setChecked}
            className={cn('h-9 w-full gap-3 rounded-lg px-2.5 hover:bg-accent [&>button]:mx-px', memoryUpload.availability.available && 'text-foreground/75')}
          />
          <ComposerMenuRow icon={<ImageIcon />} label={copy.addMenuAssets} onClick={onAssets} />
        </ComposerMenuSection>
        {connectors}
      </ComposerPopoverContent>
    </Popover>
  )
}

function MediaPickerDialog({
  open,
  channelId,
  locale,
  onClose,
  onSelect,
  memoryUpload,
}: {
  open: boolean
  channelId: string | null
  locale: ChatLocale
  onClose: () => void
  onSelect: (asset: ChatAssetAttachment) => void
  memoryUpload: MemoryUploadChoice
}) {
  const copy = useChatCopy()
  const localizeError = useLocalizedError()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const uploadAbortRef = React.useRef<AbortController | null>(null)
  const [view, setView] = React.useState<MediaPickerView>('image')
  const [search, setSearch] = React.useState('')
  const [items, setItems] = React.useState<StorageObjectItem[]>([])
  const [previewItem, setPreviewItem] = React.useState<StorageObjectItem | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setUploading(false)
    setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [channelId])

  React.useEffect(() => () => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
  }, [])

  React.useEffect(() => {
    if (!open || !channelId) return undefined
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    const timeout = window.setTimeout(() => {
      const input = getChatMediaListInput(view, search)
      listStorageObjects(channelId, input, { signal: controller.signal })
        .then((result) => {
          if (cancelled) return
          const nextItems = result.data.filter((item) => item.type === 'file')
          setItems(nextItems)
          setPreviewItem((current) => current && nextItems.some((item) => item.id === current.id) ? current : nextItems[0] ?? null)
        })
        .catch((loadError) => {
          if (cancelled) return
          setError(localizeError(loadError))
          setItems([])
          setPreviewItem(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 180)
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [channelId, open, search, view])

  if (!open) return null

  async function refreshItems(signal?: AbortSignal) {
    if (!channelId) return
    const result = await listStorageObjects(
      channelId,
      getChatMediaListInput(view, search),
      { signal },
    )
    const nextItems = result.data.filter((item) => item.type === 'file')
    setItems(nextItems)
    setPreviewItem(nextItems[0] ?? null)
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !channelId || uploading) return
    const selectedFiles = Array.from(files).filter((file) => file.size > 0)
    if (selectedFiles.length === 0) return
    uploadAbortRef.current?.abort()
    const uploadController = new AbortController()
    uploadAbortRef.current = uploadController
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    const memoryIngestion = memoryUpload.beginBatch(channelId, selectedFiles)
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        if (uploadController.signal.aborted) break
        const file = selectedFiles[index]!
        const uploaded = await uploadChatMediaFile(channelId, file, (progress) => {
          if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) return
          const base = (index / selectedFiles.length) * 100
          setUploadProgress(Math.round(base + (progress / selectedFiles.length)))
        }, uploadController.signal, memoryIngestion)
        if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) break
        onSelect(uploaded)
      }
      if (!uploadController.signal.aborted) await refreshItems(uploadController.signal)
    } catch (uploadError) {
      if (!isChatUploadAbort(uploadError, uploadController.signal)) {
        setError(localizeError(uploadError))
      }
    } finally {
      if (uploadAbortRef.current !== uploadController) return
      uploadAbortRef.current = null
      setUploading(false)
      setUploadProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const tabs: Array<{ id: MediaPickerView; label: string; icon: React.ReactNode }> = [
    { id: 'image', label: copy.mediaPickerImages, icon: <ImageIcon className="size-4" /> },
    { id: 'video', label: copy.mediaPickerVideos, icon: <Film className="size-4" /> },
    { id: 'uploads', label: copy.mediaPickerUploads, icon: <Upload className="size-4" /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/24 p-3 text-foreground backdrop-blur-md dark:bg-black/54 dark:text-white sm:p-6">
      <div className="flex h-[min(720px,92vh)] w-full max-w-5xl overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-[0_34px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#202020] dark:shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
        <aside className="relative hidden w-40 shrink-0 border-r border-border/70 bg-muted/45 p-3 dark:border-white/6 dark:bg-black/12 sm:block">
          <div className="mb-4 truncate px-2 text-sm font-semibold text-muted-foreground dark:text-white/74">{copy.mediaPickerTitle}</div>
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cn(
                  'flex h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                  view === tab.id
                    ? 'bg-accent text-accent-foreground dark:bg-white/16 dark:text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground dark:text-white/48 dark:hover:bg-white/8 dark:hover:text-white/76',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="absolute bottom-8 flex flex-col items-start gap-1">
            <MemoryIngestionCheckbox
              checked={memoryUpload.checked}
              availability={memoryUpload.availability}
              disabled={uploading || !channelId}
              onCheckedChange={memoryUpload.setChecked}
              className="px-3 py-1 text-xs dark:text-white/74"
            />
            <button
              type="button"
              disabled={uploading || !channelId}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50 dark:text-white dark:hover:bg-white/8"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {copy.mediaPickerUpload}
            </button>
            <MemoryUploadSummaryLine summary={memoryUpload.summary} className="max-w-[8.5rem] whitespace-normal px-3" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/70 p-3 dark:border-white/6">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-border/70 bg-input px-3 dark:border-transparent dark:bg-white/7">
              <Search className="size-5 shrink-0 text-muted-foreground dark:text-white/46" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.mediaPickerSearch}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground dark:text-white dark:placeholder:text-white/42"
              />
            </div>
            <div className="hidden h-11 items-center gap-2 rounded-[14px] border border-border/70 bg-muted/50 px-4 text-sm font-semibold text-muted-foreground dark:border-transparent dark:bg-white/7 dark:text-white/64 sm:flex">
              {copy.mediaPickerRecent}
              <ChevronDown className="size-4 text-muted-foreground/80 dark:text-white/42" />
            </div>
            <button
              type="button"
              aria-label={copy.mediaPickerClose}
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground dark:text-white/58 dark:hover:bg-white/8 dark:hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_480px]">
            <div className="min-h-0 overflow-y-auto p-4">
              <div className="mb-3 flex gap-2 sm:hidden">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setView(tab.id)}
                    className={cn(
                      'flex h-9 items-center gap-1 rounded-full px-3 text-sm transition-colors',
                      view === tab.id
                        ? 'bg-accent text-accent-foreground dark:bg-white dark:text-black'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:bg-white/8 dark:text-white/62 dark:hover:bg-white/12 dark:hover:text-white',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {error && (
                <ChatInlineAlert
                  tone="error"
                  title={copy.loadErrorTitle}
                  detail={error}
                  className="mb-3"
                />
              )}

              {uploading && (
                <div className="mb-3 rounded-md border border-border/80 bg-muted/35 px-3 py-2 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.055] dark:text-white/72">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <UiText id="uploading_media_456f6114" />{uploadProgress === null ? '' : ` ${uploadProgress}%`}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-white/8">
                    <div className="h-full rounded-full bg-primary transition-all dark:bg-white/55" style={{ width: `${uploadProgress ?? 12}%` }} />
                  </div>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-video rounded-md bg-muted dark:bg-white/8" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-muted-foreground dark:text-white/62">
                  <ImageIcon className="mb-3 size-12 text-muted-foreground/50 dark:text-white/32" />
                  <p className="text-lg font-semibold">{copy.mediaPickerEmpty}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {items.map((item) => {
                    const asset = attachmentFromStorageItem(item, channelId)
                    const selected = previewItem?.id === item.id
                    const selectable = isStorageMediaSelectable(item)
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'overflow-hidden rounded-md border bg-card text-left transition-colors hover:border-primary/30 hover:bg-muted/45 dark:bg-white/[0.045] dark:hover:border-white/24 dark:hover:bg-white/[0.07]',
                          selected ? 'border-primary/45 dark:border-white/34' : 'border-border/80 dark:border-white/10',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          onDoubleClick={() => selectable && onSelect(asset)}
                          className="block w-full text-left"
                        >
                          <div className="aspect-video bg-muted dark:bg-black/36">
                            <StoragePickerPreview item={item} channelId={channelId} />
                          </div>
                        </button>
                        <div className="flex items-center gap-2 p-2">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-medium text-foreground dark:text-white/82">{item.name}</p>
                            <p className="text-xs text-muted-foreground dark:text-white/38">{formatAttachmentMeta(asset)}</p>
                          </button>
                          <button
                            type="button"
                            aria-label={copy.mediaPickerSelect}
                            disabled={!selectable}
                            onClick={() => selectable && onSelect(asset)}
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 dark:bg-white/10 dark:text-white dark:hover:bg-white dark:hover:text-black"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="hidden min-h-0 border-l border-border/70 p-4 dark:border-white/6 md:block">
              <div className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border/70 bg-muted/30 dark:border-transparent dark:bg-white/[0.045]">
                {previewItem ? (
                  <>
                    <div className="min-h-0 flex-1 bg-muted/60 dark:bg-black/22">
                      <StoragePickerPreview item={previewItem} channelId={channelId} />
                    </div>
                    <div className="border-t border-border/70 p-4 dark:border-white/8">
                      <p className="truncate text-sm font-semibold text-foreground dark:text-white/86">{previewItem.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground dark:text-white/42">{previewItem.mime_type ?? 'file'} · {formatBytesLabel(previewItem.size_bytes)}</p>
                      <Button
                        type="button"
                        disabled={!isStorageMediaSelectable(previewItem)}
                        onClick={() => isStorageMediaSelectable(previewItem)
                          && onSelect(attachmentFromStorageItem(previewItem, channelId))}
                        className="mt-4 h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                      >
                        <Plus className="size-4" />
                        {copy.mediaPickerSelect}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground dark:text-white/38">
                    <ImageIcon className="size-10" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-t border-border/70 p-3 dark:border-white/6 sm:hidden">
            <MemoryIngestionCheckbox
              checked={memoryUpload.checked}
              availability={memoryUpload.availability}
              disabled={uploading || !channelId}
              onCheckedChange={memoryUpload.setChecked}
              className="justify-center text-xs dark:text-white/74"
            />
            <Button
              type="button"
              disabled={uploading || !channelId}
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {copy.mediaPickerUpload}
            </Button>
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={CHAT_MEDIA_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => void handleUpload(event.currentTarget.files)}
      />
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

function getChatMediaListInput(view: MediaPickerView, search: string): StorageListInput {
  const base: StorageListInput = {
    type: 'file',
    scope: 'descendants',
    search: search.trim() || undefined,
    sortBy: 'updated_at',
    sortOrder: 'desc',
    limit: 60,
  }
  if (view === 'image') return { ...base, category: 'image' }
  if (view === 'video') return { ...base, category: 'video' }
  return base
}

async function uploadChatMediaFile(
  channelId: string,
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
  // S19: the shared "Belleğe de ekle" choice of the batch (default: the channel's chat-upload rules decide).
  memoryIngestion: StorageMemoryIngestionRequest = { source: 'chat_upload' },
): Promise<ChatAssetAttachment> {
  const session = await initiateStorageUpload({
    channelId,
    file,
    // P01B-04: the channel's chat-upload ingestion rules apply to composer uploads.
    memoryIngestion,
    idempotencyKey: `chat-media-upload:${createClientId()}`,
    signal,
  })
  const uploadTransport = resolveStorageUploadTransport(session)
  if (uploadTransport === 'direct') {
    await uploadDirectContent({ session, file, onProgress, signal })
    await completeStorageUpload({
      channelId,
      uploadSessionId: session.upload_session_id,
      finalizeToken: session.finalize_token,
      signal,
    })
  } else if (uploadTransport === 'tus') {
    await uploadTusContent({ session, file, onProgress, signal })
    await completeStorageUpload({
      channelId,
      uploadSessionId: session.upload_session_id,
      finalizeToken: session.finalize_token,
      signal,
    })
  } else {
    const result = await uploadProxyContent({ session, file, onProgress, signal })
    if (!result.completed) {
      await completeStorageUpload({
        channelId,
        uploadSessionId: session.upload_session_id,
        finalizeToken: session.finalize_token,
        signal,
      })
    }
  }
  return attachmentFromUploadSession(channelId, file, session)
}

function isChatUploadAbort(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return true
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; name?: unknown }
  return candidate.code === 'STORAGE_UPLOAD_ABORTED' || candidate.name === 'AbortError'
}

function attachmentFromUploadSession(channelId: string, file: File, session: InitiateUploadResult): ChatAssetAttachment {
  const kind = inferAttachmentKind({ url: file.name, mimeType: file.type, name: file.name })
  const url = getStorageDownloadUrl({
    channelId,
    objectId: session.object_id,
    fileName: file.name,
  })
  return {
    id: `storage:${session.object_id}`,
    objectId: session.object_id,
    channelId,
    kind,
    name: file.name,
    url,
    previewUrl: url,
    mimeType: file.type || null,
    source: 'upload',
    sizeBytes: String(file.size),
    status: 'uploaded',
    metadata: {
      upload_session_id: session.upload_session_id,
      storage_key: session.storage_key,
    },
  }
}

function attachmentFromStorageItem(item: StorageObjectItem, channelId: string | null): ChatAssetAttachment {
  const url = channelId
    ? getStorageDownloadUrl({ channelId, objectId: item.id, fileName: item.name })
    : null
  return {
    id: `storage:${item.id}`,
    objectId: item.id,
    channelId: channelId ?? item.channel_id,
    kind: inferAttachmentKind({ url: item.name, mimeType: item.mime_type, name: item.name }),
    name: item.name,
    url,
    previewUrl: null,
    mimeType: item.mime_type,
    source: 'storage',
    sizeBytes: item.size_bytes,
    status: item.status,
    metadata: {
      path: item.path,
      storage_key: item.storage_key,
      provider_kind: item.provider_kind,
      delivery_variant: item.delivery_variant,
      ...(item.checksum_sha256 ? { checksum_sha256: item.checksum_sha256 } : {}),
    },
  }
}


function formatAttachmentMeta(asset: ChatAssetAttachment) {
  return [asset.kind, formatBytesLabel(asset.sizeBytes)].filter(Boolean).join(' · ')
}

function formatBytesLabel(value: string | number | null | undefined) {
  const amount = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(amount) / Math.log(1024)), units.length - 1)
  const result = amount / 1024 ** index
  return `${result >= 10 || index === 0 ? result.toFixed(0) : result.toFixed(1)} ${units[index]}`
}

function inferAttachmentKind(input: { url?: string | null; mimeType?: string | null; name?: string | null }): ChatAssetKind {
  const mimeType = input.mimeType?.toLowerCase() ?? ''
  const value = `${input.url ?? ''} ${input.name ?? ''}`.toLowerCase()
  if (isVideoMimeType(mimeType) || isVideoMediaUrl(input.url ?? '') || /\.(mp4|webm|mov|avi|mkv|m3u8)(\?|$)/i.test(value) || /\/(mp4|webm|mov|avi|mkv|m3u8)([?#/]|$)/i.test(value)) return 'video'
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff)(\?|$)/i.test(value) || /\/(png|jpe?g|gif|webp|svg|bmp|ico|tiff)([?#/]|$)/i.test(value)) return 'image'
  if (looksLikeYoutorchMediaUrl(input.url ?? '')) {
    return 'image'
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac)(\?|$)/i.test(value)) return 'audio'
  if (mimeType.includes('pdf') || /\.(pdf|docx?|pptx?|txt|md|csv|json)(\?|$)/i.test(value)) return 'document'
  return 'file'
}

function readAttachmentKind(value: unknown): ChatAssetKind | null {
  return value === 'image' || value === 'video' || value === 'audio' || value === 'document' || value === 'file' ? value : null
}

function readAttachmentSource(value: unknown): ChatAssetAttachment['source'] | null {
  return value === 'storage' || value === 'upload' || value === 'generated' ? value : null
}

function isVisualAttachment(asset: ChatAssetAttachment) {
  return asset.kind === 'image' || asset.kind === 'video'
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

function getMediaThumbnailUrl(asset: ChatAssetAttachment) {
  if (asset.kind === 'image') return asset.previewUrl ?? asset.url
  if (asset.previewUrl && isImageMediaUrl(asset.previewUrl)) return asset.previewUrl
  return null
}

function inferMimeTypeFromUrl(value: string | null | undefined) {
  if (!value) return null
  if (isVideoMediaUrl(value)) return isHlsVideoUrl(value) ? 'application/vnd.apple.mpegurl' : 'video/mp4'
  if (isImageMediaUrl(value)) return 'image/png'
  return null
}

function isImageMediaUrl(value: string) {
  if (/^\s*data:/i.test(value)) return false
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff)(?:[?#].*)?$/i.test(value)
    || /\/(png|jpe?g|gif|webp|svg|bmp|ico|tiff)(?:[?#/]|$)/i.test(value)
}

function isVideoMediaUrl(value: string) {
  if (!value) return false
  return isEmbeddableVideoUrl(value)
    || isHlsVideoUrl(value)
    || /\.(mp4|webm|mov|avi|mkv)(?:[?#].*)?$/i.test(value)
    || /\/(mp4|webm|mov|avi|mkv)(?:[?#/]|$)/i.test(value)
    || /\b(video|render|stream|playback)\b/i.test(value)
}

function isHlsVideoUrl(value: string) {
  return /\.m3u8(?:[?#].*)?$/i.test(value) || /\/playlist\.m3u8(?:[?#].*)?$/i.test(value)
}

function isEmbeddableVideoUrl(value: string) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    return (host === 'video.bunnycdn.com' && path.includes('/play/'))
      || (host === 'iframe.mediadelivery.net' && path.includes('/embed/'))
  } catch {
    return false
  }
}

function isVideoMimeType(value: string) {
  return value.startsWith('video/')
    || value.includes('mpegurl')
    || value === 'application/vnd.apple.mpegurl'
    || value === 'application/x-mpegurl'
}

function looksLikeYoutorchMediaUrl(value: string) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    const isYoutorchHost = host === 'youtorch.io'
      || host.endsWith('.youtorch.io')
      || host.includes('youtorch')
    const isKnownMediaHost = host.startsWith('cdn.')
      || host.startsWith('media.')
      || host.startsWith('assets.')
      || host.includes('bunnycdn')
      || host.endsWith('.b-cdn.net')
      || host.includes('mediadelivery.net')
    const hasMediaPath = /\/(api\/storage|storage|uploads|media|generated|artifacts|files|objects|cdn)(?:\/|$)/.test(path)
    return isKnownMediaHost || (isYoutorchHost && hasMediaPath)
  } catch {
    return false
  }
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

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function buildComposerOptions(catalog: AssistantComposerCatalog | null, t: ChatTranslator): ComposerOptions {
  return {
    chatProfiles: catalog?.chat_profiles.length
      ? catalog.chat_profiles.map((profile) => ({
        id: profile.id,
        label: localizedProfileLabel(profile.id, profile.label, t),
        detail: localizedProfileDetail(profile.id, profile.detail, t),
        credits: profile.estimated_credits,
        modelId: profile.model_id,
        modelLabel: profile.model_label,
      }))
      : getFallbackComposerProfileOptions(t),
    chatModels: (catalog?.chat_models ?? []).map((model) => toComposerModelOption(model, t)),
    approvalModes: catalog?.approval_modes.length
      ? catalog.approval_modes.map((mode) => ({
        id: mode.id,
        label: mode.id === 'ask' ? t('composer.ask') : t('composer.auto'),
        detail: mode.id === 'ask' ? t('composer.askDetail') : t('composer.autoDetail'),
      }))
      : getFallbackComposerApprovalOptions(t),
    aspectRatios: catalog?.aspect_ratios.length
      ? catalog.aspect_ratios.map((aspect) => ({
        id: aspect.id,
        label: localizedAspectLabel(aspect.id, aspect.label, t),
        detail: localizedAspectDetail(aspect.id, aspect.detail, t),
        icon: iconForAspectRatio(aspect.id),
      }))
      : getFallbackComposerAspectOptions(t),
    imageModels: mergeComposerModelOptions(
      (catalog?.image_models ?? []).map((model) => toComposerModelOption(model, t)),
      getFallbackComposerImageModels(t),
    ),
    videoModels: (catalog?.video_models ?? []).map((model) => toComposerModelOption(model, t)),
  }
}

function localizedProfileLabel(id: ComposerChatProfile, fallback: string, t: ChatTranslator) {
  if (id === 'fast') return t('composer.fast')
  if (id === 'pro') return t('composer.pro')
  if (id === 'max') return t('composer.max')
  return fallback
}

function localizedProfileDetail(id: ComposerChatProfile, fallback: string, t: ChatTranslator) {
  if (id === 'fast') return t('composer.fastDetail')
  if (id === 'pro') return t('composer.proDetail')
  if (id === 'max') return t('composer.maxDetail')
  return fallback
}

function localizedAspectLabel(id: ComposerAspectRatio, fallback: string, t: ChatTranslator) {
  if (id === '16:9') return t('composer.landscape')
  if (id === '9:16') return t('composer.short')
  if (id === '1:1') return t('composer.square')
  return fallback
}

function localizedAspectDetail(id: ComposerAspectRatio, fallback: string, t: ChatTranslator) {
  if (id === '16:9') return t('composer.landscapeDetail')
  if (id === '9:16') return t('composer.shortDetail')
  if (id === '1:1') return t('composer.squareDetail')
  return fallback
}

function toComposerModelOption(model: AssistantComposerCatalog['image_models'][number], t: ChatTranslator): ComposerModelOption {
  const fallback = getFallbackComposerImageModels(t).find((option) => option.id === model.id)
  return {
    id: model.id,
    label: model.label,
    description: fallback?.description ?? model.description,
    quality: localizeModelRating(model.quality, t),
    cost: model.cost_label,
    speed: localizeModelSpeed(model.speed, t),
    estimatedCredits: model.estimated_credits,
    inputSchema: model.input_schema,
    pricingRule: model.pricing_rule,
    rateLimit: model.rate_limit,
    capacityLimit: model.capacity_limit,
  }
}

function localizeModelRating(value: string, t: ChatTranslator) {
  if (value.toLowerCase() === 'highest') return t('composer.highest')
  if (value.toLowerCase() === 'high') return t('composer.high')
  if (value.toLowerCase() === 'draft') return t('composer.draft')
  return value
}

function localizeModelSpeed(value: string, t: ChatTranslator) {
  if (value.toLowerCase() === 'fast') return t('composer.fastSpeed')
  if (value.toLowerCase() === 'medium') return t('composer.mediumSpeed')
  return value
}

function iconForAspectRatio(value: ComposerAspectRatio) {
  if (value === '9:16') return RectangleVertical
  if (value === '1:1') return Square
  return RectangleHorizontal
}

function reconcileComposerSettings(settings: ComposerSettings, catalog: AssistantComposerCatalog, t: ChatTranslator): ComposerSettings {
  const options = buildComposerOptions(catalog, t)
  const defaults = catalog.defaults
  const chatProfile = options.chatProfiles.some((option) => option.id === settings.chatProfile)
    ? settings.chatProfile
    : defaults.chat_profile
  const approvalMode = options.approvalModes.some((option) => option.id === settings.approvalMode)
    ? settings.approvalMode
    : defaults.approval_mode
  const aspectRatio = options.aspectRatios.some((option) => option.id === settings.aspectRatio)
    ? settings.aspectRatio
    : defaults.aspect_ratio
  const requestedImageModelId = selectCatalogModelId(settings.imageModelId, defaultImageModelId(defaults, options.imageModels), options.imageModels)
  const imageModel = selectComposerImageModelForTask(requestedImageModelId, settings.imageTask, options.imageModels)
  const imageModelId = imageModel?.id ?? requestedImageModelId
  const videoModelId = selectCatalogModelId(settings.videoModelId, getSelectedComposerModelId(defaults, VIDEO_GENERATE_CAPABILITY), options.videoModels)
  return {
    chatProfile,
    chatModelId: selectCatalogModelId(settings.chatModelId, defaults.model_id, options.chatModels),
    approvalMode,
    durationSeconds: clampVideoDurationSeconds(settings.durationSeconds || defaults.video_duration_seconds, catalog.duration.max_seconds, catalog.duration.min_seconds),
    aspectRatio,
    imageModelId,
    videoModelId,
    ...reconcileImageModelInputs(settings, imageModel),
  }
}

function areComposerSettingsEqual(left: ComposerSettings, right: ComposerSettings) {
  return left.chatProfile === right.chatProfile
    && left.chatModelId === right.chatModelId
    && left.approvalMode === right.approvalMode
    && left.durationSeconds === right.durationSeconds
    && left.aspectRatio === right.aspectRatio
    && left.imageModelId === right.imageModelId
    && left.videoModelId === right.videoModelId
    && left.imageTask === right.imageTask
    && left.imageSize === right.imageSize
    && left.imageResolution === right.imageResolution
    && left.imageQuality === right.imageQuality
    && left.imageOutputFormat === right.imageOutputFormat
}

function selectCatalogModelId(current: string | null, fallback: string | null, options: ComposerModelOption[]) {
  if (current && options.some((option) => option.id === current)) return current
  if (fallback && options.some((option) => option.id === fallback)) return fallback
  return options[0]?.id ?? null
}

function defaultImageModelId(defaults: AssistantComposerCatalog['defaults'] | null, options: ComposerModelOption[]) {
  if (options.some((option) => option.id === DEFAULT_IMAGE_MODEL_ID)) return DEFAULT_IMAGE_MODEL_ID
  return getSelectedComposerModelId(defaults, IMAGE_GENERATE_CAPABILITY)
}

function reconcileImageModelInputs(settings: ComposerSettings, model: ComposerModelOption | null): Pick<ComposerSettings, 'imageTask' | 'imageSize' | 'imageResolution' | 'imageQuality' | 'imageOutputFormat'> {
  return {
    imageTask: selectModelInputValue(settings.imageTask, model, 'tasks', readSchemaString(model, 'default_task') ?? 'text_to_image'),
    imageSize: selectModelInputValue(settings.imageSize, model, 'sizes', readSchemaString(model, 'default_size') ?? ''),
    imageResolution: selectModelInputValue(settings.imageResolution, model, 'resolutions', readSchemaString(model, 'default_resolution') ?? ''),
    imageQuality: selectModelInputValue(settings.imageQuality, model, 'qualities', readSchemaString(model, 'default_quality') ?? 'auto'),
    imageOutputFormat: selectModelInputValue(settings.imageOutputFormat, model, 'output_formats', readSchemaString(model, 'default_output_format') ?? 'png'),
  }
}

function selectModelInputValue(current: string, model: ComposerModelOption | null, key: string, fallback: string) {
  const values = schemaStringList(model, key)
  if (values.length === 0) return current || fallback
  if (current && values.includes(current)) return current
  if (fallback && values.includes(fallback)) return fallback
  return values[0] ?? fallback
}

function schemaStringList(model: ComposerModelOption | null, key: string): string[] {
  if (!model) return []
  const raw = model.inputSchema[key]
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function readSchemaString(model: ComposerModelOption | null, key: string) {
  const value = model?.inputSchema[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function composerModelSupportsImageTask(model: ComposerModelOption, task: string) {
  const tasks = schemaStringList(model, 'tasks')
  return tasks.length === 0 || tasks.includes(task)
}

function selectComposerImageModelForTask(
  modelId: string | null,
  task: string,
  models: ComposerModelOption[],
) {
  const selected = models.find((model) => model.id === modelId) ?? null
  if (selected && composerModelSupportsImageTask(selected, task)) return selected
  return models.find((model) => composerModelSupportsImageTask(model, task)) ?? selected ?? models[0] ?? null
}

function composerImageTaskOptions(models: ComposerModelOption[]): ComposerInputOption[] {
  const values = Array.from(new Set(models.flatMap((model) => schemaStringList(model, 'tasks'))))
  const tasks = values.length > 0 ? values : ['text_to_image']
  return tasks.map((value) => ({
    id: value,
    label: formatComposerInputLabel(value),
    detail: value,
  }))
}

function modelInputOptions(model: ComposerModelOption | null, key: string): ComposerInputOption[] {
  return schemaStringList(model, key).map((value) => ({
    id: value,
    label: formatComposerInputLabel(value),
    detail: value,
  }))
}

function formatComposerInputLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** QA-078: the image model the message will name (same choice as `serializeComposerSelection`). */
function selectedComposerImageModel(settings: ComposerSettings, catalog: AssistantComposerCatalog | null, options: ComposerOptions) {
  const requestedImageModelId = selectCatalogModelId(settings.imageModelId, defaultImageModelId(catalog?.defaults ?? null, options.imageModels), options.imageModels)
  return selectComposerImageModelForTask(requestedImageModelId, settings.imageTask, options.imageModels)
}

function serializeComposerSelection(
  settings: ComposerSettings,
  catalog: AssistantComposerCatalog | null,
  options: ComposerOptions,
  /** P01A-11: the server-committed planner model of an existing conversation (null before it exists). */
  committedPlannerModelId: string | null = null,
): AssistantComposerSelection {
  const maxSeconds = catalog?.duration.max_seconds ?? COMPOSER_VIDEO_DURATION_MIN_SECONDS
  const minSeconds = catalog?.duration.min_seconds ?? COMPOSER_VIDEO_DURATION_MIN_SECONDS
  const fallbackProfile = options.chatProfiles.find((option) => option.id === settings.chatProfile) ?? options.chatProfiles[0] ?? { id: 'fast', label: '', detail: '', credits: null, modelId: 'auto-llm', modelLabel: 'Auto LLM' }
  // The exact model is the identity; the profile field is kept only because composer_selection still carries it.
  const plannerModelId = committedPlannerModelId ?? settings.chatModelId ?? fallbackProfile.modelId
  const chatProfile = options.chatProfiles.find((option) => option.modelId === plannerModelId) ?? fallbackProfile
  const aspectRatio = options.aspectRatios.some((option) => option.id === settings.aspectRatio)
    ? settings.aspectRatio
    : catalog?.defaults.aspect_ratio ?? '16:9'
  const requestedImageModelId = selectCatalogModelId(settings.imageModelId, defaultImageModelId(catalog?.defaults ?? null, options.imageModels), options.imageModels)
  const imageModel = selectComposerImageModelForTask(requestedImageModelId, settings.imageTask, options.imageModels)
  return {
    chat_profile: chatProfile.id,
    model_id: plannerModelId,
    approval_mode: options.approvalModes.some((option) => option.id === settings.approvalMode)
      ? settings.approvalMode
      : catalog?.defaults.approval_mode ?? 'ask',
    video_duration_seconds: clampVideoDurationSeconds(settings.durationSeconds, maxSeconds, minSeconds),
    aspect_ratio: aspectRatio,
    selected_models: {
      [IMAGE_GENERATE_CAPABILITY]: imageModel?.id ?? requestedImageModelId,
      [VIDEO_GENERATE_CAPABILITY]: selectCatalogModelId(settings.videoModelId, getSelectedComposerModelId(catalog?.defaults ?? null, VIDEO_GENERATE_CAPABILITY), options.videoModels),
    },
    selected_model_inputs: {
      [IMAGE_GENERATE_CAPABILITY]: imageComposerInputs(settings, imageModel),
    },
  }
}

function imageComposerInputs(settings: ComposerSettings, model?: ComposerModelOption | null): Record<string, unknown> {
  return {
    task: settings.imageTask,
    ...(settings.imageSize ? { size: settings.imageSize } : {}),
    ...(settings.imageResolution ? { resolution: settings.imageResolution } : {}),
    quality: settings.imageQuality,
    output_format: settings.imageOutputFormat,
    ...implicitModelInput(model, 'background', 'default_background', 'auto'),
    ...implicitModelInput(model, 'input_fidelity', 'default_input_fidelity'),
  }
}

function mergeComposerModelOptions(
  suppliedModels: ComposerModelOption[],
  fallbackModels: ComposerModelOption[],
) {
  const byId = new Map<string, ComposerModelOption>()
  fallbackModels.forEach((model) => byId.set(model.id, model))
  suppliedModels.forEach((model) => byId.set(model.id, model))
  return Array.from(byId.values())
}

function toWorkflowCanvasImageModel(model: ComposerModelOption): WorkflowCanvasImageModel {
  return {
    id: model.id,
    label: model.label,
    estimated_credits: model.estimatedCredits,
    input_schema: model.inputSchema,
    pricing_rule: model.pricingRule,
  }
}

function implicitModelInput(model: ComposerModelOption | null | undefined, field: string, defaultField: string, fallback?: string): Record<string, string> {
  if (!model) return {}
  const settings = schemaStringList(model, 'settings')
  if (!settings.includes(field)) return {}
  const value = readSchemaString(model, defaultField) ?? fallback ?? null
  return value ? { [field]: value } : {}
}

function getSelectedComposerModelId(
  selection: Pick<AssistantComposerSelection, 'selected_models'> | null,
  capability: typeof IMAGE_GENERATE_CAPABILITY | typeof VIDEO_GENERATE_CAPABILITY,
) {
  const selected = selection?.selected_models?.[capability]
  if (typeof selected === 'string' && selected.trim()) return selected
  return null
}

function clampVideoDurationSeconds(value: number, maxSeconds: number, minSeconds = COMPOSER_VIDEO_DURATION_MIN_SECONDS) {
  if (!Number.isFinite(value)) return minSeconds
  return Math.min(Math.max(Math.round(value), minSeconds), maxSeconds)
}

function getComposerDurationScaleMax(planMaxSeconds: number, scaleMaxSeconds: number | null) {
  if (!Number.isFinite(scaleMaxSeconds)) return planMaxSeconds
  return Math.max(planMaxSeconds, Math.round(scaleMaxSeconds ?? planMaxSeconds))
}

function parseComposerDurationInteger(value: string, unit: ComposerDurationUnit) {
  const normalizedValue = value.trim()
  if (!/^\d+$/.test(normalizedValue)) return null
  const integerValue = Number.parseInt(normalizedValue, 10)
  if (!Number.isSafeInteger(integerValue) || integerValue <= 0) return null
  const seconds = unit === 'minutes' ? integerValue * 60 : integerValue
  return Number.isSafeInteger(seconds) ? seconds : null
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
