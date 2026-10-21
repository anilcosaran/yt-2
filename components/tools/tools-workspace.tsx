'use client'

import { collectStatusPollTargets, hasProviderBusyQueue, hasTenantNodeQueue, isRuntimeTerminal, type TenantNodeQueueStatus } from '@/components/tools/tenant-node-concurrency'
import { CensorReviewPanel } from '@/components/tools/censor-review-panel'
import { ToolAdmissionSummary } from '@/components/tools/tool-admission-summary'
import { CreditActionFrame, CreditPill } from '@/components/billing/credit-action-button'
import { normalizeViralClipsParams, RETIRED_VIRAL_CLIPS_FIELDS } from '@/lib/workflows/viral-clips-params'
import { withRunEventsSafetyPoll, type WorkflowRunEventMessage } from '@/lib/workflows/run-events'
import { useWorkflowRunEvents } from '@/lib/workflows/use-workflow-run-events'
import { findEarlyNodeOutput, isEarlyOutputFinishing } from '@/lib/workflows/node-output-ready'


import * as React from 'react'
import { mediaRangeExceeds, mediaFrameCount } from '@/lib/tools/media-time'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import {
  AudioLines,
  ArrowRight,
  Bot,
  Captions,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  CircleDollarSign,
  Copy,
  Crop,
  Download,
  Eye,
  FileText,
  FileVideo,
  Film,
  Frame,
  Heart,
  History,
  Image as ImageIcon,
  Info,
  Link2,
  LoaderCircle,
  Mic,
  Mic2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Shuffle,
  Type,
  UploadCloud,
  Upload,
  Video,
  Volume2,
  Wand2,
  WandSparkles,
  Workflow as WorkflowIcon,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
  DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
  getCachedDiscoveryToolsCatalog,
  getDiscoveryToolsCatalog,
  type DiscoveryToolCatalogItem,
  type DiscoveryToolsCatalog,
} from '@/lib/discovery/api'
import {
  BILLING_QUOTA_USAGE_QUERY_KEY,
  getBillingQuotaUsage,
  type BillingQuotaUsage,
} from '@/lib/billing/api'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { AddToCalendarButton } from '@/components/calendar/schedule-dialog'
import { WorkspaceChannelRequired } from '@/components/channel/workspace-channel-required'
import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { isAuthClientError } from '@/lib/auth/errors'
import { getLanguageDisplay, isLanguageSelectionFieldName } from '@/lib/i18n/language-display'
import { publicRuntimeErrorMessage, toPublicRuntimeError } from '@/lib/public-runtime-error'
import { isPricingMissingLabel, isPrivatePublicMetadataKey, publicCatalogText, publicModelLabel } from '@/lib/public-model-display'
import {
  buildTranscriptionLanguageOptions,
  isPublishedTranscriptionLanguage,
  resolvePublishedTranscriptionLanguage,
} from '@/lib/transcription/language-options'
import {
  completeStorageUpload,
  fetchStorageDeliveryUrlsInChunks,
  getStorageDeliveryUrl,
  getStorageDownloadUrl,
  getStorageObject,
  getStoragePlaybackUrl,
  getStorageThumbnailUrl,
  initiateStorageUpload,
  resolveStorageUploadTransport,
  storageDeliveryRefreshDelay,
  uploadDirectContent,
  uploadProxyContent,
  uploadTusContent,
  type StorageObjectItem,
} from '@/lib/storage/api'
import { openFileInput } from '@/lib/storage/open-file-picker'
import { cn } from '@/lib/utils'
import {
  VOICE_PROFILES_QUERY_KEY,
  grantInstantVoiceCloneConsent,
  listVoiceProfiles,
  voiceProfilesQueryKey,
} from '@/lib/voice/api'
import {
  mergeCompatibleVoiceProfiles,
  resolveExactVoiceProfileCompatibility,
} from '@/lib/voice/compatibility'
import {
  getCanonicalVoiceLanguageRouteParam,
  getOpaqueVoiceRouteParam,
} from '@/lib/voice/tool-route-params'
import {
  buildVoiceLanguageOptions,
  chooseVoiceLanguageDefault,
} from '@/lib/voice/language-options'
import {
  StorageMediaInspector,
  type StorageInspectorTaskDetails,
} from '@/components/storage/storage-media-inspector'
import { StorageMediaInput, type StorageMediaSelection } from '@/components/storage/storage-media-input'
import { VoiceReferenceAudioInput } from '@/components/tools/voice-reference-audio-input'
import { VoiceProfilePickerDialog } from '@/components/tools/voice-profile-picker-dialog'
import { ToolMediaLoadingIndicator } from '@/components/tools/tool-media-loading-indicator'
import {
  getMediaDownloaderPreviewGeometry,
  MediaDownloaderMetadataPreview,
} from '@/components/tools/media-downloader-metadata-preview'
import { ToolRunningIndicator } from '@/components/tools/tool-running-indicator'
import {
  CAPTION_STYLE_NAMES,
  CaptionVideoPreview,
  normalizeCaptionFontScale,
  resolveCaptionPreviewPosition,
  resolveCaptionPreviewStyleName,
  type CaptionBilingualOrder,
  type CaptionPreviewMedia,
  type CaptionSubtitleMode,
  type CaptionVisibilityOverrides,
} from '@/components/tools/caption-style-preview-field'
import { CaptionStylePicker } from '@/components/tools/caption-style-picker'
import {
  CaptionAdvancedSettings,
  CaptionDualLanguageSettings,
  readCaptionVisibilityOverrides,
} from '@/components/tools/caption-advanced-settings'
import {
  MediaTransformInputFields,
  type MediaTransformSelectedMedia,
} from '@/components/tools/media-transform-input-fields'
import { AngleInputFields } from '@/components/tools/angle-input-fields'
import { ToolExampleSurface } from '@/components/tools/tool-example-surface'
import { ToolOutputViewSwitch, type ToolOutputView } from '@/components/tools/tool-output-view-switch'
import { getDefaultToolOutputView } from '@/lib/tools/tool-example-catalog'
import { ToolModelPicker, filterToolModels, type ToolModel } from '@/components/tools/tool-model-picker'
import {
  VIRAL_CLIPS_MIN_SOURCE_DURATION_SEC,
  getMagicClipAllowedOutputFormats,
  MagicClipsInputFields,
  type MagicClipsEstimateState,
} from '@/components/tools/magic-clips-input-fields'
import {
  DEFAULT_GIF_DURATION_SECONDS,
  MAX_GIF_PIXEL_FRAMES,
  VideoToGifInputFields,
  VideoToGifSourcePreview,
} from '@/components/tools/video-to-gif-input-fields'
import {
  FrameExtractAdvancedSettings,
  FrameExtractInputFields,
  MAX_FRAME_EXTRACT_PIXEL_FRAMES,
} from '@/components/tools/frame-extract-input-fields'
import { GuideMarkdownPreview } from '@/components/workflows/guide-markdown'
import { isAmbiguousMutationError, type ClientMutationAttempt } from '@/lib/idempotency/client-mutation-control'
import {
  clearToolLaunchAttempt,
  getOrCreateToolLaunchAttempt,
  type ToolLaunchIntent,
} from '@/lib/tools/tool-launch-attempt'
import {
  createTextToolFastLaneIdempotencyKey,
  listTextToolFastRuns,
  mergeTextToolFastRunItems,
  runTextToolFastLane,
  textToolFastRunsQueryKey,
  toTextToolFastLaneNodeType,
  upsertTextToolFastRunPage,
  type TextToolFastLaneNodeType,
  type TextToolFastLaneOutcome,
  type TextToolFastRunPage,
} from '@/lib/tools/text-tool-fast-lane'
import {
  createWorkflowActionIdempotencyKey,
  estimateWorkflowAgent,
  getWorkflowAgentStatus,
  launchWorkflowAgent,
  listMediaTranscriptArtifacts,
  listRecentWorkflowOutputs,
  validWorkflowAgentLaunchQuote,
  type RecentWorkflowOutputItem,
  type RecentWorkflowOutputsResult,
  type WorkflowAgentEstimateResult,
  type WorkflowAgentLaunchResult,
  type WorkflowAgentOutputResult,
  type WorkflowAgentStatusResult,
  type ViralClipsQuotaSnapshot,
} from '@/lib/workflows/api'
import { getMyFeatureLimits, MY_FEATURE_LIMITS_QUERY_KEY } from '@/lib/feature-control/api'
import {
  applyMediaDownloaderQuoteLaunchParams,
  formatEstimatedMediaSize,
  formatQuoteCredits,
  parseMediaDownloaderPlanLimits,
  parseMediaDownloaderVideoUrl,
  type MediaDownloaderQuoteVariant,
} from '@/lib/workflows/media-downloader-quote'
import { useMediaDownloaderQuote } from '@/lib/workflows/use-media-downloader-quote'
import {
  listWorkflowNodeFavoriteTypes,
  setWorkflowNodeFavorite,
} from '@/lib/workflows/node-favorites'

import {
  ToolField,
  ToolModeSelect,
  ToolPanel,
  ToolPanelHeader,
  ToolPromptArea,
  ToolRatioPicker,
  ToolSeedInput,
  ToolSelectField,
  ToolSearchableSelectField,
  ToolSliderField,
  ToolToggleRow,
  type ToolChoice,
  type ToolMode,
} from './tool-primitives'
import { UiText } from '@/components/i18n/ui-text'
import { useFormatter, useTranslations } from 'next-intl'
import { resumeWorkflowRun } from '@/lib/workflows/api'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'
import { useLocalizedRuntimeError } from '@/lib/i18n/use-localized-runtime-error'

function PaymentReviewOutputNotice({ workflowId, canResume = false }: { workflowId?: string; canResume?: boolean }) {
  const t = useTranslations('PaymentRisk')
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const resume = async () => {
    if (!workflowId || busy) return
    setBusy(true); setFailed(false)
    try { await resumeWorkflowRun(workflowId) }
    catch { setFailed(true) }
    finally { setBusy(false) }
  }
  return <div className="rounded-md border border-amber-500/30 bg-panel p-4 text-sm" role="status">
    <p>{t(canResume ? 'resumeRequired' : 'deliveryHeld')}</p><p className="mt-2 text-muted-foreground">{t('deliveryHeldDetail')}</p>
    {canResume && workflowId ? <Button className="mt-3" disabled={busy} onClick={() => void resume()}>{t('resume')}</Button> : null}
    {failed ? <p role="alert" className="mt-2">{t('resumeFailed')}</p> : null}
  </div>
}

type ToolId = string

class ToolLaunchConfirmationCancelledError extends Error {}
class ToolViralClipsQuotaUnavailableError extends Error {}

type ToolAutoErrorTranslator = (
  key: 'viral_clips_quota_exhausted' | 'viral_clips_quota_unavailable'
) => string

type ToolFavoriteControls = {
  favoriteNodeTypes: Set<string>
  favoriteBusyNodeType: string | null
  onToggleFavorite: (nodeType: string, favorite: boolean) => void
}

type ToolConfig = {
  id: ToolId
  title: string
  shortTitle: string
  description: string
  badge: string
  icon: LucideIcon
  accentClassName: string
  modes: ToolMode[]
  prompt: string
  promptPlaceholder: string
  uploadTitle: string
  uploadDescription: string
  outputTitle: string
  outputMeta: string
  outputImage: string
  outputVideoUrl?: string
  modelKind: 'video' | 'voice' | 'image' | 'agent'
}

type ToolSchemaValues = Record<string, unknown>

type StandardToolFieldKey =
  | 'mode'
  | 'prompt'
  | 'model'
  | 'duration'
  | 'resolution'
  | 'ratio'
  | 'motion'
  | 'seed'
  | 'audio'

type StandardToolFieldBinding = {
  name: string
  source: 'node' | 'model'
  required: boolean
  has_allowed_values: boolean
}

type StandardToolFieldSupport = Partial<Record<StandardToolFieldKey, StandardToolFieldBinding>>

type ToolOutputMediaKind = 'image' | 'video' | 'audio'

type ToolOutputMedia = {
  censor?: { status: string; detected_count: number; applied_count: number }
  censorReviewObjectId?: string

  kind: ToolOutputMediaKind
  url: string
  label: string
  socialCaption?: string | null
  description?: string | null
  hashtags?: string[]
  titleAlternatives?: string[]
  captionAlternatives?: string[]
  tone?: string | null
  viralPotentialScore?: number | null
  editorialSummary?: string | null
  selectionReason?: string | null
  storageObjectId?: string | null
  /**
   * K7: a lighter Storage object shown instead of `storageObjectId` (Video to GIF's animated WebP preview). Downloads
   * and the open action keep `storageObjectId`: a GIF rendered on download is produced when it is downloaded.
   */
  previewStorageObjectId?: string | null
  storageStatus?: string | null
  workflowReady?: boolean | null
  fileName?: string | null
}

type StoragePresentationReadiness = 'ready' | 'processing' | 'unavailable' | null

function getStoragePresentationReadiness(
  value: { storageStatus?: string | null; workflowReady?: boolean | null } | null | undefined,
): StoragePresentationReadiness {
  const status = value?.storageStatus?.trim().toLowerCase()
  if (status && ['failed', 'quarantined', 'deleted'].includes(status)) return 'unavailable'
  if (value?.workflowReady === true) return 'ready'
  if (value?.workflowReady === false || status === 'processing') return 'processing'
  return null
}

type ToolTextOutput = {
  kind: 'markdown' | 'json'
  content: string
}

type ToolTranscriptSegment = {
  id: string
  start: number
  end: number
  text: string
}

type ToolTranscriptOutput = {
  text: string
  segments: ToolTranscriptSegment[]
  totalSegmentCount: number
  segmentsTruncated: boolean
  language: string | null
  durationSeconds: number | null
  modelId: string | null
  artifactId: string | null
  cacheHit: boolean
  sourceStorageObjectId: string | null
  sourceContentType: string | null
}

type ToolRunSourceMedia = Pick<
  StorageMediaSelection,
  'storageObjectId' | 'name' | 'mimeType' | 'durationSeconds' | 'previewUrl' | 'width' | 'height' | 'dimensionSource'
> & {
  channelId: string | null
}

type ToolRecentWorkflowOutputState = {
  items: RecentWorkflowOutputItem[]
  loading: boolean
  initialSnapshotPending?: boolean
  refreshing?: boolean
  loadingMore: boolean
  hasMore: boolean
  errorMessage: string | null
  onLoadMore: () => void
}

type ToolOutputStatusTone = 'ready' | 'processing' | 'failed'

type ToolRenderableOutputView = {
  kind: ToolOutputMediaKind
  label: string
  prompt: string | null
  modelLabel: string
  provider: string
  createdAt: string
  statusLabel: string
  statusTone: ToolOutputStatusTone
  failureMessage: string | null
  mediaUrl: string | null
  previewUrl: string | null
  downloadUrl: string | null
  storageObjectId?: string | null
  /** K7: the object to display (the GIF's WebP preview); downloads keep `storageObjectId`. */
  displayStorageObjectId?: string | null
  fileName?: string | null
  canDownload: boolean
  detail?: string
  identifier?: string
}

type ToolWorkflowOutputView = ToolRenderableOutputView & {
  item: RecentWorkflowOutputItem
}

type ToolAgentRunState = {
  id?: string
  idempotencyKey?: string
  estimate: WorkflowAgentEstimateResult | null
  launch: WorkflowAgentLaunchResult | null
  status: WorkflowAgentStatusResult | null
  output: WorkflowAgentOutputResult | null
  prompt?: string
  modelLabel?: string
  provider?: string
  sourceMedia?: ToolRunSourceMedia | null
  sourceLinks?: string[]
  captionPreview?: CaptionRunPreview | null
  requestedAt?: string
  estimatedCredits?: number | null
  activityLabel?: string
  voiceProfileId?: string | null
  mediaDownloaderSubmission?: MediaDownloaderSubmission | null
  started: boolean
  loading: boolean
  restoring?: boolean
  outputRefreshFailed?: boolean
  retryOutput?: () => void
  statusConnectionError?: string | null
  retryStatus?: () => void
  errorMessage: string | null
  /** LLM-03: the fast-lane answer text as it streams in (never stored in the browser). */
  streamText?: string | null
}

/**
 * LLM-03 progress of one tool run on the text tool fast lane, kept in React state only: the server's run history is
 * the source of truth and replaces the live card once it lists `fastRunId`.
 */
type ToolFastLaneRunProgress = {
  fastRunId: string | null
  text: string
  /** The stream ended (answer, failure or a dropped connection); the run is waiting for the history to list it. */
  finished: boolean
}

type ToolFastLaneLaunchResult = {
  lane: 'fast'
  channelId: string
  nodeType: TextToolFastLaneNodeType
  outcome: Exclude<TextToolFastLaneOutcome, { kind: 'fallback' }>
}

type ToolAgentRunRecord = {
  id: string
  idempotencyKey?: string
  estimate: WorkflowAgentEstimateResult | null
  launch: WorkflowAgentLaunchResult | null
  prompt: string
  modelLabel: string
  provider: string
  sourceMedia: ToolRunSourceMedia | null
  sourceLinks: string[]
  captionPreview: CaptionRunPreview | null
  requestedAt: string
  estimatedCredits: number | null
  activityLabel: string
  voiceProfileId: string | null
  mediaDownloaderSubmission?: MediaDownloaderSubmission | null
  loading: boolean
  errorMessage: string | null
}

type MediaDownloaderSubmission = {
  idempotencyKey: string
  nodeType: string
  params: Record<string, unknown>
  state: 'submitting' | 'failed'
}

type CaptionRunPreview = {
  styleName: string
  fontSize: number
  position: string
  subtitleMode?: CaptionSubtitleMode
  targetLanguage?: string
  bilingualOrder?: CaptionBilingualOrder
  sourceStyleName?: string
  translationStyleName?: string
  sourceFontScale?: number
  translationFontScale?: number
  visibilityOverrides?: CaptionVisibilityOverrides
}

type ToolParamValidationIssue = {
  field: string
  code: 'required' | 'invalid_type' | 'invalid_value' | 'below_min_value' | 'above_max_value' | 'unknown_field' | 'not_public_config'
  expected?: string
  allowedValues?: unknown[]
  minValue?: number
  maxValue?: number
}

type CatalogCategory = 'Video' | 'Image' | 'Audio' | 'Flow'
type CatalogViewId = 'trends' | 'models' | 'workflows'

type ToolCatalogMeta = {
  category: CatalogCategory
  creator: string
  description: string
  thumbnail: string
  iconBackground: string
  iconForeground: string
  iconShape: string
  iconCss: string
  iconAssetUrl: string
  models: string[]
  tags: string[]
  featured?: boolean
  isNew?: boolean
}

const catalogViews: Array<{
  id: CatalogViewId
  label: string
  title: string
  description: string
  ctaLabel: string
}> = [
  {
    id: 'trends',
    label: 'Trends',
    title: 'Haftanin populer tool akislari.',
    description: 'Kisa video, image edit ve sosyal format araclarini trend kullanimlara gore tara.',
    ctaLabel: 'Open trending flow',
  },
  {
    id: 'models',
    label: 'Models',
    title: 'Yeni modellerle uygun araci bul.',
    description: 'Image, video ve voice model ailelerine gore calisan araclari kesfet.',
    ctaLabel: 'Choose a model',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    title: 'Tek tool yerine hazir uretim akisina gir.',
    description: 'Brief, asset, sahne, altyazi ve final polish adimlarini birbirine baglayan workflow baslangiclari.',
    ctaLabel: 'Start workflow',
  },
]

type SpotlightModelCardData = {
  id: string
  name: string
  provider: string
  description: string
  toolId: ToolId
  modelId: string
  href: string
  toolShortTitle: string
  badge?: string
  thumbnail: string
  tone: string
  icon: LucideIcon
  iconBackground: string
  iconForeground: string
  iconShape: string
  iconCss: string
  iconAssetUrl: string
  spotlight: boolean
  sortOrder: number
  tags: string[]
}

type WorkflowTemplateCategory = 'Top picks' | 'Faceless videos' | 'Repurpose' | 'Commerce'

const subscribeToToolsWorkspaceHydration = () => () => undefined
const getToolsWorkspaceClientHydrationSnapshot = () => true
const getToolsWorkspaceServerHydrationSnapshot = () => false
const TOOL_RECENT_OUTPUT_PAGE_SIZE = 20
const TOOL_OUTPUT_PROMPT_CACHE_KEY = 'youtorch:tool-output-prompts:v1'
const TOOL_OUTPUT_PROMPT_CACHE_LIMIT = 240
const TOOL_AGENT_RUN_SESSION_KEY_PREFIX = 'youtorch:tool-agent-runs:v1'
const TOOL_AGENT_RUN_DURABLE_KEY_PREFIX = 'youtorch:tool-agent-runs:durable:v1'
const TOOL_AGENT_RUN_SESSION_MAX_AGE_MS = 24 * 60 * 60_000
/** In-tab fallback when session/local storage is blocked (private mode / quota). */
const TOOL_AGENT_RUN_MEMORY_STORE = new Map<string, string>()
const MEDIA_DOWNLOADER_REFRESH_RECONCILIATION_WINDOW_MS = 2 * 60_000
const MEDIA_DOWNLOADER_SUBMISSION_RESUME_WINDOW_MS = 5 * 60_000
const MEDIA_DOWNLOADER_FAILED_SUBMISSION_MAX_AGE_MS = 30 * 60_000
const TOOL_AGENT_FINAL_HANDOFF_POLL_INTERVAL_MS = 2_000
const TOOL_AGENT_FINAL_HANDOFF_POLL_WINDOW_MS = 30_000
const TOOL_AGENT_FAST_POLL_INTERVAL_MS = 5_000
const TOOL_AGENT_WARM_POLL_INTERVAL_MS = 10_000
const TOOL_AGENT_SLOW_POLL_INTERVAL_MS = 15_000
const TOOL_AGENT_LONG_POLL_INTERVAL_MS = 60_000
const TOOL_AGENT_FAST_POLL_WINDOW_MS = 30_000
const TOOL_RECENT_OUTPUT_HANDOFF_MAX_ATTEMPTS = 8
const TOOL_RECENT_OUTPUT_HANDOFF_RETRY_BASE_MS = 500
const TOOL_RECENT_OUTPUT_HANDOFF_RETRY_MAX_MS = 15_000
const TOOL_AGENT_WARM_POLL_WINDOW_MS = 3 * 60_000
const TOOL_AGENT_SLOW_POLL_WINDOW_MS = 8 * 60_000
const TOOL_RECENT_OUTPUT_COMPLETION_BATCH_MS = 150
const TOOL_GENERATE_COOLDOWN_MS = 3_000
const DEFAULT_CAPTION_FONT_SIZE = 44
const CAPTION_FONT_SIZE_PORT = {
  name: 'font_size',
  type: 'integer',
  required: false,
  default: DEFAULT_CAPTION_FONT_SIZE,
  min_value: 18,
  max_value: 96,
  description: 'Caption font size; 44 matches the default 1080x1920 Shorts preset',
}

type WorkflowTemplateCard = {
  templateKey: string
  title: string
  category: WorkflowTemplateCategory
  description: string
  steps: string[]
  examples: string[]
  estimatedCost: string
  nodes: string[]
  toolId: ToolId
  tone: string
  coverType: 'image' | 'video'
  foregroundImage?: string
  previewVideo?: string
}

const workflowSpotlightCards: WorkflowTemplateCard[] = [
  {
    templateKey: 'ugc-ad-with-human-actor',
    title: 'UGC Ad with human actor',
    category: 'Top picks',
    description: 'Create a creator-style ad from a product brief with actor direction, hook structure, caption polish, and export-ready short video framing.',
    steps: ['Actor brief', 'Hook script', 'Caption polish', 'Short export'],
    examples: ['Founder testimonial', 'Product reaction', 'Problem-solution ad'],
    estimatedCost: '18-32 credits',
    nodes: ['Brief intake', 'Actor direction', 'Hook writer', 'Caption polish', 'Short export'],
    toolId: 'viral-clips',
    tone: 'from-[#ff6a7a] via-[#ee405f] to-[#8f1d37]',
    coverType: 'video',
  },
  {
    templateKey: 'short-video',
    title: 'Short video',
    category: 'Top picks',
    description: 'Turn a quick idea, image, or product moment into a fast social short with motion, pacing, and platform-friendly output.',
    steps: ['Scene idea', 'Motion plan', 'Video draft', 'Export'],
    examples: ['Launch teaser', 'Before-after clip', 'Product reveal'],
    estimatedCost: '12-24 credits',
    nodes: ['Prompt intake', 'Motion planner', 'Video draft', 'Format export'],
    toolId: 'video',
    tone: 'from-[#ff9a3d] via-[#f15f35] to-[#9b2d21]',
    coverType: 'video',
  },
  {
    templateKey: 'explainer-video',
    title: 'Explainer video',
    category: 'Top picks',
    description: 'Break a complex topic into a clear explainer with narrative beats, supporting scenes, and a concise final script.',
    steps: ['Topic brief', 'Scene outline', 'Voice direction', 'Final draft'],
    examples: ['Feature walkthrough', 'Tutorial intro', 'Concept explainer'],
    estimatedCost: '8-16 credits',
    nodes: ['Topic brief', 'Outline builder', 'Voice direction', 'Final script'],
    toolId: 'agent',
    tone: 'from-[#55d6a5] via-[#19a979] to-[#0c5f49]',
    coverType: 'video',
  },
  {
    templateKey: 'use-my-script',
    title: 'Use my script',
    category: 'Top picks',
    description: 'Paste a script and get a structured video flow with captions, scene suggestions, timing, and publish-ready edits.',
    steps: ['Script import', 'Scene split', 'Caption timing', 'Review'],
    examples: ['Talking head script', 'Ad read', 'Lesson outline'],
    estimatedCost: '5-11 credits',
    nodes: ['Script import', 'Scene splitter', 'Caption timing', 'Review pass'],
    toolId: 'captions',
    tone: 'from-[#c7f36c] via-[#73c94a] to-[#2f7a34]',
    coverType: 'image',
  },
  {
    templateKey: 'animated-video',
    title: 'Animated video',
    category: 'Top picks',
    description: 'Build a stylized animated presenter or character-led clip for education, product storytelling, or social posts.',
    steps: ['Character style', 'Scene direction', 'Voice pass', 'Animation draft'],
    examples: ['Mascot explainer', 'Animated pitch', 'Character intro'],
    estimatedCost: '16-30 credits',
    nodes: ['Character style', 'Scene direction', 'Voice pass', 'Animation draft'],
    toolId: 'avatar',
    tone: 'from-[#7db5ff] via-[#4d78ef] to-[#273b9a]',
    coverType: 'video',
  },
  {
    templateKey: 'faceless-short-video',
    title: 'Faceless short video',
    category: 'Faceless videos',
    description: 'Create a faceless short using stock-like visuals, dynamic captions, and pacing that works for evergreen channels.',
    steps: ['Topic angle', 'Visual plan', 'Caption layer', 'Final polish'],
    examples: ['Travel fact', 'Finance tip', 'Motivational short'],
    estimatedCost: '10-18 credits',
    nodes: ['Topic angle', 'Visual planner', 'Caption layer', 'Final polish'],
    toolId: 'media-transform',
    tone: 'from-[#67d7ff] via-[#2e9cdf] to-[#126082]',
    coverType: 'video',
  },
  {
    templateKey: 'script-to-video',
    title: 'Script to video',
    category: 'Faceless videos',
    description: 'Convert a written script into scene cards, b-roll prompts, subtitle timing, and a draftable video structure.',
    steps: ['Script parse', 'B-roll map', 'Scene order', 'Draft'],
    examples: ['Top 5 list', 'How-to script', 'Story narration'],
    estimatedCost: '7-14 credits',
    nodes: ['Script parser', 'B-roll mapper', 'Scene order', 'Draft builder'],
    toolId: 'b-roll',
    tone: 'from-[#92e85f] via-[#47b96a] to-[#176b54]',
    coverType: 'image',
  },
  {
    templateKey: 'listicle-video',
    title: 'Listicle video',
    category: 'Faceless videos',
    description: 'Produce a list-style video with ranked beats, recurring visual rhythm, caption emphasis, and a clear ending CTA.',
    steps: ['List structure', 'Beat visuals', 'Caption style', 'CTA'],
    examples: ['Top 10 tools', 'Best habits', 'Mistakes to avoid'],
    estimatedCost: '8-15 credits',
    nodes: ['List structure', 'Beat visuals', 'Caption style', 'CTA polish'],
    toolId: 'ai-polish',
    tone: 'from-[#5ee6d7] via-[#23b9a3] to-[#0d6b67]',
    coverType: 'video',
  },
  {
    templateKey: 'educational-video',
    title: 'Educational video',
    category: 'Repurpose',
    description: 'Shape a lesson, tutorial, or guide into a structured education workflow with visuals, notes, and explanation beats.',
    steps: ['Lesson goal', 'Chapter beats', 'Visual references', 'Review'],
    examples: ['Mini course', 'Product training', 'Explained simply'],
    estimatedCost: '6-13 credits',
    nodes: ['Lesson goal', 'Chapter planner', 'Visual references', 'Review pass'],
    toolId: 'mockup',
    tone: 'from-[#b18cff] via-[#7c5cff] to-[#44319a]',
    coverType: 'image',
  },
  {
    templateKey: 'blog-to-video',
    title: 'Blog to video',
    category: 'Repurpose',
    description: 'Turn a blog, notes, or article into a compact video plan with narration, scene prompts, and social-ready captions.',
    steps: ['Article import', 'Summary beats', 'Narration', 'Video plan'],
    examples: ['Newsletter recap', 'SEO article', 'Case study'],
    estimatedCost: '6-12 credits',
    nodes: ['Article import', 'Summary beats', 'Narration plan', 'Video plan'],
    toolId: 'voice-changer',
    tone: 'from-[#ffc15a] via-[#f1882f] to-[#9c4d18]',
    coverType: 'image',
  },
]

const workflowCategories: WorkflowTemplateCategory[] = ['Top picks', 'Faceless videos', 'Repurpose', 'Commerce']

const heroTileLayouts: Array<{
  left: string
  top: string
  rotate: string
  large?: boolean
}> = [
  { left: '50%', top: '8%', rotate: '-8deg', large: true },
  { left: '66%', top: '6%', rotate: '8deg' },
  { left: '80%', top: '14%', rotate: '-10deg', large: true },
  { left: '58%', top: '46%', rotate: '10deg' },
  { left: '74%', top: '48%', rotate: '-6deg' },
  { left: '90%', top: '42%', rotate: '8deg' },
  { left: '44%', top: '58%', rotate: '7deg' },
  { left: '68%', top: '72%', rotate: '9deg' },
  { left: '84%', top: '72%', rotate: '-9deg' },
]

const TOOL_OUTPUT_PREVIEW_EVENT = 'youtorch:tool-output-preview'
const VOICE_CLONE_SELF_ATTESTATION_DRAFT_KEY = '__voice_clone_self_attestation'
const VOICE_CLONE_ESTIMATE_CONSENT_SENTINEL = 'server-consent-pending'
const DEFAULT_VOICE_PROFILE_ID = 'default'

type ToolOutputPreviewPayload = {
  url: string
  kind: ToolOutputMediaKind
  label?: string
  prompt?: string
  downloadUrl?: string | null
  replayable?: boolean
  taskDetails?: StorageInspectorTaskDetails
  metadata?: Pick<
    ToolOutputMedia,
    | 'socialCaption'
    | 'description'
    | 'hashtags'
    | 'titleAlternatives'
    | 'captionAlternatives'
    | 'tone'
    | 'viralPotentialScore'
    | 'editorialSummary'
    | 'selectionReason'
  >
}

export function ToolsWorkspace() {
  const searchParams = useSearchParams()
  const requestedToolId = searchParams.get('tool')
  const routeToolId = getToolId(requestedToolId)
  const queryClient = useQueryClient()
  const [outputPreview, setOutputPreview] = React.useState<ToolOutputPreviewPayload | null>(null)
  const hasHydrated = React.useSyncExternalStore(
    subscribeToToolsWorkspaceHydration,
    getToolsWorkspaceClientHydrationSnapshot,
    getToolsWorkspaceServerHydrationSnapshot,
  )
  const discoveryCatalogQuery = useQuery({
    queryKey: DISCOVERY_TOOLS_CATALOG_QUERY_KEY,
    queryFn: ({ signal }) => getDiscoveryToolsCatalog({ signal }),
    staleTime: DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })
  // A client-side navigation can already have this query cached while the
  // server render still emits the loading state. Keep the first client render
  // aligned with the server and reveal cached data immediately after hydration.
  const discoveryCatalog = hasHydrated ? discoveryCatalogQuery.data : undefined

  React.useEffect(() => {
    if (requestedToolId !== 'viral-shorts' && requestedToolId !== 'magic-clips') return
    const canonicalUrl = new URL(window.location.href)
    canonicalUrl.searchParams.set('tool', 'viral-clips')
    window.history.replaceState(window.history.state, '', canonicalUrl)
  }, [requestedToolId])

  React.useEffect(() => {
    const cached = getCachedDiscoveryToolsCatalog(Date.now(), { allowStale: true })
    if (!cached) return
    queryClient.setQueryData(DISCOVERY_TOOLS_CATALOG_QUERY_KEY, cached.data, { updatedAt: cached.updatedAt })
  }, [queryClient])

  React.useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<ToolOutputPreviewPayload>).detail
      if (!detail?.url) return
      setOutputPreview({
        ...detail,
        kind: detail.kind ?? inferOutputKindFromUrl(detail.url),
      })
    }
    window.addEventListener(TOOL_OUTPUT_PREVIEW_EVENT, handlePreview)
    return () => window.removeEventListener(TOOL_OUTPUT_PREVIEW_EVENT, handlePreview)
  }, [])

  return (
    <>
      {routeToolId ? (
        <ToolRunner toolId={routeToolId} discoveryCatalog={discoveryCatalog} />
      ) : (
        <ToolsCatalog
          discoveryCatalog={discoveryCatalog}
          catalogUnavailable={hasHydrated && discoveryCatalogQuery.isError && !discoveryCatalog}
          catalogRefreshing={!hasHydrated || discoveryCatalogQuery.isFetching}
          onRetryCatalog={() => discoveryCatalogQuery.refetch()}
        />
      )}
      <ToolOutputPreviewDialog
        preview={outputPreview}
        onOpenChange={(open) => {
          if (!open) setOutputPreview(null)
        }}
      />
    </>
  )
}

function ToolOutputPreviewDialog({
  preview,
  onOpenChange,
}: {
  preview: ToolOutputPreviewPayload | null
  onOpenChange: (open: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [replayToken, setReplayToken] = React.useState(0)
  const title = preview?.label?.trim() || (
    preview?.kind === 'video'
      ? 'Generated video'
      : preview?.kind === 'audio'
        ? 'Generated speech'
        : 'Generated image'
  )
  const promptText = preview?.prompt?.trim() ?? ''
  const promptPreview = formatCompactPromptText(promptText, 9)
  const downloadUrl = preview
    ? preview.downloadUrl === undefined ? preview.url : preview.downloadUrl
    : null
  const previewUrl = preview?.replayable && replayToken > 0
    ? appendGifReplayParam(preview.url, replayToken)
    : preview?.url
  const publishingMetadata = preview?.metadata
  const hasPublishingMetadata = Boolean(
    publishingMetadata?.socialCaption
    || publishingMetadata?.description
    || publishingMetadata?.editorialSummary
    || publishingMetadata?.selectionReason
    || publishingMetadata?.viralPotentialScore != null
    || publishingMetadata?.tone
    || publishingMetadata?.hashtags?.length
    || publishingMetadata?.titleAlternatives?.length
    || publishingMetadata?.captionAlternatives?.length,
  )

  React.useEffect(() => {
    setReplayToken(0)
  }, [preview?.url])

  const hideEditPanel = isInspectorSidePanelSuppressedTool(searchParams.get('tool'))
  const isGifOutput = Boolean(
    preview?.replayable
    || (preview?.kind === 'image' && /\.gif(?:$|[?#])/i.test(preview.url)),
  )
  const storageObjectId = getStorageObjectIdFromToolOutputUrl(downloadUrl ?? preview?.url ?? null)

  if (!hasPublishingMetadata) {
    return (
      <StorageMediaInspector
        open={Boolean(preview)}
        title={title}
        subtitle={promptPreview || undefined}
        storageObjectId={storageObjectId}
        kind={preview?.kind === 'audio' ? 'audio' : preview?.kind === 'video' ? 'video' : 'image'}
        isGif={isGifOutput}
        isVoice={false}
        isAvatar={false}
        canDownload={Boolean(downloadUrl)}
        showSidePanel={!hideEditPanel}
        taskDetails={preview?.taskDetails}
        media={preview ? (
          preview.kind === 'video' && isEmbeddableVideoUrl(preview.url) ? (
            <iframe
              src={preview.url}
              title={title}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0 bg-black"
            />
          ) : preview.kind === 'video' ? (
            <video
              data-tool-output-video-player
              src={preview.url}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="h-full max-h-full w-full object-contain"
            />
          ) : preview.kind === 'audio' ? (
            <div className="flex w-full max-w-md flex-col items-center gap-5 px-6 py-8">
              <span className="flex size-20 items-center justify-center rounded-full bg-[#111315] text-[#E6E6E6]">
                <AudioLines className="size-9" />
              </span>
              <audio src={preview.url} controls autoPlay preload="metadata" className="w-full" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={title}
              onClick={preview.replayable ? () => setReplayToken((current) => current + 1) : undefined}
              className={cn(
                'block h-full max-h-full w-full max-w-full object-contain',
                preview.replayable && 'cursor-pointer',
              )}
            />
          )
        ) : null}
        onOpenChange={onOpenChange}
        onDownload={() => downloadOutputUrl(downloadUrl)}
        onShare={async () => {
          if (preview?.url) await copyTextToClipboard(preview.url)
        }}
        onOpenHref={(href) => router.push(href)}
      />
    )
  }

  return (
    <Dialog open={Boolean(preview)} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'tools-studio max-h-[92vh] overflow-hidden border-white/10 bg-black/92 p-0 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]',
          hasPublishingMetadata ? 'sm:max-w-[min(96vw,1360px)]' : 'sm:max-w-[min(94vw,1120px)]',
        )}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          <UiText id="output_preview_26e3c9dc" /></DialogDescription>
        <div className="absolute right-3 top-3 z-30 flex items-center rounded-md border border-white/16 bg-white/[0.10] p-1 text-white shadow-[0_14px_34px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tAuto('close_preview_baa55035')}
              title={tAuto('close_preview_baa55035')}
              className="size-8 rounded-md border border-white/18 bg-white/[0.16] text-white shadow-sm hover:bg-white/[0.26] hover:text-white focus-visible:ring-white/60"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>
        <div className="flex h-[min(82vh,820px)] w-full flex-col bg-black">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {preview?.kind === 'video' && isEmbeddableVideoUrl(preview.url) ? (
              <iframe
                src={preview.url}
                title={title}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full border-0 bg-black"
              />
            ) : preview?.kind === 'video' ? (
              <video
                data-tool-output-video-player
                src={preview.url}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
              />
            ) : preview?.kind === 'audio' ? (
              <div className="flex w-full max-w-2xl flex-col items-center gap-6 px-8">
                <span className="flex size-24 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-white/82 shadow-[0_20px_60px_rgba(0,0,0,0.36)]">
                  <AudioLines className="size-10" />
                </span>
                <audio
                  src={preview.url}
                  controls
                  autoPlay
                  preload="metadata"
                  className="w-full"
                />
              </div>
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={title}
                onClick={preview.replayable ? () => setReplayToken((current) => current + 1) : undefined}
                className={cn(
                  'max-h-full max-w-full object-contain',
                  preview.replayable && 'cursor-pointer',
                )}
              />
            ) : null}
            </div>
            {hasPublishingMetadata && publishingMetadata ? (
              <MagicClipPreviewMetadataPanel
                title={title}
                metadata={publishingMetadata}
                taskDetails={preview?.taskDetails}
              />
            ) : null}
          </div>
          {promptText || downloadUrl ? (
            <div
              data-tool-output-preview-footer
              className="relative z-20 flex shrink-0 items-center gap-2 border-t border-white/12 bg-white/[0.075] px-3 py-2 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:px-4"
            >
              {promptText ? (
                <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-4 text-white/82" title={promptText}>
                  {promptPreview}
                </span>
              ) : (
                <span className="min-w-0 flex-1 text-xs font-semibold leading-4 text-white/66">
                  {title}
                </span>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {promptText ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tAuto('copy_prompt_dcf5b41b')}
                        title={promptText}
                        onClick={() => copyTextToClipboard(promptText)}
                        className="size-8 rounded-md border border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.16] hover:text-white"
                      >
                        <PromptCopyIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{promptPreview || tAuto('copy_prompt_dcf5b41b')}</TooltipContent>
                  </Tooltip>
                ) : null}
                {downloadUrl ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tAuto('download_a479c9c3')}
                        title={tAuto('download_a479c9c3')}
                        onClick={() => downloadOutputUrl(downloadUrl)}
                        className="size-8 rounded-md border border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.16] hover:text-white"
                      >
                        <Download className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><UiText id="download_a479c9c3" /></TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MagicClipPreviewMetadataPanel({
  title,
  metadata,
  taskDetails,
}: {
  title: string
  metadata: NonNullable<ToolOutputPreviewPayload['metadata']>
  taskDetails?: StorageInspectorTaskDetails
}) {
  const tAuto = useTranslations('Auto')
  const score = metadata.viralPotentialScore == null
    ? null
    : Math.max(0, Math.min(100, Math.round(metadata.viralPotentialScore)))
  const socialCaption = metadata.socialCaption ?? metadata.description
  const copyBlock = [
    title,
    socialCaption,
    metadata.hashtags?.join(' '),
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join('\n\n')

  return (
    <aside
      data-magic-clip-metadata-panel
      className="tools-scrollbar max-h-[38vh] w-full shrink-0 overflow-auto border-t border-white/12 bg-[#0b0b0d] px-5 py-5 text-white lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0"
    >
      <div className="flex items-start justify-between gap-3 pr-8 lg:pr-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45"><UiText id="magic_clips_26a739d2" /></p>
            {metadata.tone ? (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-medium capitalize text-white/55">
                {metadata.tone}
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-base font-semibold leading-6 text-white">{title}</h3>
        </div>
        {copyBlock ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={tAuto('copy_clip_publishing_metadata_31629af8')}
            title={tAuto('copy_title_social_caption_and_hashtags_c701b6d7')}
            onClick={() => copyTextToClipboard(copyBlock)}
            className="size-8 shrink-0 border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.14] hover:text-white"
          >
            <Copy className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {score != null ? (
        <section
          aria-label={tAuto('viral_score_out_of', { score })}
          className="mt-5 overflow-hidden rounded-xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.12] via-emerald-300/[0.055] to-cyan-300/[0.08] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-100/60">
                <UiText id="viral_score_55b07dcb" /></p>
              <p className="mt-1 text-xs text-white/45"><UiText id="short_form_potential_1e18564a" /></p>
            </div>
            <p className="flex items-baseline text-emerald-100">
              <span className="text-3xl font-bold tracking-[-0.04em]">{score}</span>
              <span className="ml-1 text-sm font-semibold text-emerald-100/55">/100</span>
            </p>
          </div>
          <div
            role="progressbar"
            aria-label={tAuto('viral_score_55b07dcb')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300 shadow-[0_0_12px_rgba(110,231,183,0.35)]"
              style={{ width: `${score}%` }}
            />
          </div>
        </section>
      ) : null}

      {metadata.editorialSummary ? (
        <section className="mt-5 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/42">
            {tAuto('viral_clips_editorial_summary_label')}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-white/76">{metadata.editorialSummary}</p>
        </section>
      ) : null}

      {metadata.selectionReason ? (
        <section className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/42">
            {tAuto('viral_clips_selection_reason_label')}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-white/68">{metadata.selectionReason}</p>
        </section>
      ) : null}

      {socialCaption ? (
        <section className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/42"><UiText id="social_caption_cf771d47" /></p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-white/76">{socialCaption}</p>
        </section>
      ) : null}
      {metadata.hashtags?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {metadata.hashtags.map((hashtag) => (
            <span key={hashtag} className="rounded-full bg-sky-300/10 px-2 py-1 text-[10px] font-medium text-sky-200/80">{hashtag}</span>
          ))}
        </div>
      ) : null}
      {(metadata.titleAlternatives?.length || metadata.captionAlternatives?.length) ? (
        <details open className="group/alternatives mt-5 border-t border-white/10 pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between select-none text-[10px] font-semibold uppercase tracking-[0.15em] text-white/48 [&::-webkit-details-marker]:hidden">
            <span><UiText id="alternatives_3a4be715" /></span>
            <ChevronDown className="size-3.5 transition-transform group-open/alternatives:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2">
            {metadata.titleAlternatives?.map((value) => (
              <MagicClipAlternativeRow key={`title:${value}`} label={tAuto('title_768e0c1c')} value={value} />
            ))}
            {metadata.captionAlternatives?.map((value) => (
              <MagicClipAlternativeRow key={`caption:${value}`} label={tAuto('social_caption_cf771d47')} value={value} />
            ))}
          </div>
        </details>
      ) : null}
      {taskDetails ? <ToolPreviewTaskDetails details={taskDetails} /> : null}
    </aside>
  )
}

function MagicClipAlternativeRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const copyLabel = `Copy alternative ${label.toLowerCase()}`

  return (
    <div className="group/alternative relative rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 pr-11 transition-colors hover:border-white/[0.13] hover:bg-white/[0.05] focus-within:border-white/[0.13] focus-within:bg-white/[0.05]">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-white/35">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-4 text-white/68">{value}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copyLabel}
        title={copyLabel}
        onClick={() => copyTextToClipboard(value)}
        className="absolute right-1.5 top-1/2 size-7 -translate-y-1/2 border border-white/10 bg-black/30 text-white/65 opacity-70 transition-opacity hover:bg-white/[0.12] hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover/alternative:opacity-100"
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  )
}

function ToolPreviewTaskDetails({ details }: { details: StorageInspectorTaskDetails }) {
  const tStorage = useTranslations('Storage')
  const formatOutputDateTime = useLocalizedOutputDateTime()
  const elapsed = formatToolTaskCompletionDuration(details.createdAt, details.completedAt)
  const rows = [
    details.tool?.trim()
      ? { label: tStorage('inspector.info.tool'), value: details.tool.trim() }
      : null,
    details.node?.trim()
      ? { label: tStorage('inspector.info.node'), value: formatPublicNodeType(details.node) }
      : null,
    details.action?.trim()
      ? { label: tStorage('inspector.info.action'), value: details.action.trim() }
      : null,
    details.model?.trim()
      ? { label: tStorage('inspector.info.model'), value: publicModelLabel(details.model) }
      : null,
    Number.isFinite(details.creditsUsed)
      ? {
          label: tStorage('inspector.info.creditsUsed'),
          value: tStorage('inspector.info.creditsValue', {
            value: Math.max(0, Number(details.creditsUsed)),
          }),
        }
      : null,
    elapsed
      ? { label: tStorage('inspector.info.elapsed'), value: elapsed }
      : null,
    details.completedAt?.trim()
      ? { label: tStorage('inspector.info.completed'), value: formatOutputDateTime(details.completedAt) }
      : null,
    details.taskId?.trim()
      ? { label: tStorage('inspector.info.taskId'), value: details.taskId.trim() }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row?.value))

  if (rows.length === 0) return null
  return (
    <section className="mt-5 border-t border-white/10 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/42">
        {tStorage('inspector.info.taskDetails')}
      </p>
      <dl className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={`${row.label}:${row.value}`} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-xs leading-4">
            <dt className="text-white/42">{row.label}</dt>
            <dd className="break-words text-right font-medium text-white/76">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function formatPublicNodeType(value: string) {
  return value
    .trim()
    .replace(/@\d+(?:\.\d+)*$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function ToolRunner({
  toolId,
  discoveryCatalog,
}: {
  toolId: ToolId
  discoveryCatalog?: DiscoveryToolsCatalog
}) {
  const discoveryTool = getDiscoveryTool(discoveryCatalog, toolId)
  const { activeChannelId, isLoading: channelLoading } = useActiveChannel()

  if (channelLoading) {
    return <WorkspaceRouteLoading />
  }

  if (!activeChannelId) {
    return <WorkspaceChannelRequired compact />
  }

  if (!discoveryTool) {
    return (
      <ToolRunnerCatalogState
        toolId={toolId}
        loading={!discoveryCatalog}
      />
    )
  }

  return (
    <CatalogBackedToolRunner
      key={`${toolId}:${activeChannelId ?? 'none'}`}
      toolId={toolId}
      discoveryTool={discoveryTool}
    />
  )
}

function CatalogBackedToolRunner({
  toolId,
  discoveryTool,
}: {
  toolId: ToolId
  discoveryTool: DiscoveryToolCatalogItem
}) {
  const tAuto = useTranslations('Auto')
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { activeChannelId, isLoading: activeChannelLoading } = useActiveChannel()
  const tool = React.useMemo(() => getEffectiveToolConfig(toolId, discoveryTool), [discoveryTool, toolId])
  const sourceUrl = React.useMemo(() => getSourceUrlParam(searchParams.get('source_url')), [searchParams])
  const routeModelId = React.useMemo(
    () => getOpaqueVoiceRouteParam(searchParams.get('model')) ?? '',
    [searchParams],
  )
  const routeVoiceProfileId = React.useMemo(
    () => getOpaqueVoiceRouteParam(searchParams.get('voice_profile_id')),
    [searchParams],
  )
  const routeReferenceStorageObjectId = React.useMemo(
    () => getOpaqueVoiceRouteParam(searchParams.get('reference_storage_object_id')),
    [searchParams],
  )
  const routeVoiceLanguage = React.useMemo(
    () => getCanonicalVoiceLanguageRouteParam(searchParams.get('language')),
    [searchParams],
  )
  const routeStorageObjectId = React.useMemo(
    () => getOpaqueVoiceRouteParam(searchParams.get('storage_object_id')),
    [searchParams],
  )
  const sourceUrlAppliedRef = React.useRef<string | null>(null)
  const voiceRouteParamsAppliedRef = React.useRef<string | null>(null)
  const seededStorageQuery = useQuery({
    queryKey: ['storage', 'object', activeChannelId ?? 'none', routeStorageObjectId ?? 'none', 'tool-seed'],
    queryFn: ({ signal }) => getStorageObject({
      channelId: activeChannelId!,
      objectId: routeStorageObjectId!,
    }, { signal }),
    enabled: Boolean(activeChannelId && routeStorageObjectId),
    staleTime: 30_000,
    retry: false,
  })
  const models = React.useMemo(() => getModelsForTool(tool, discoveryTool), [discoveryTool, tool])
  const defaultModelId = React.useMemo(() => getDefaultToolModelId(discoveryTool, models), [discoveryTool, models])
  const [mode, setMode] = React.useState('')
  const [prompt, setPrompt] = React.useState('')
  const [model, setModel] = React.useState(defaultModelId)
  const [duration, setDuration] = React.useState('')
  const [resolution, setResolution] = React.useState('')
  const [ratio, setRatio] = React.useState('')
  const [motion, setMotion] = React.useState(7)
  const [seed, setSeed] = React.useState('123456')
  const [audio, setAudio] = React.useState(false)
  const [schemaValues, setSchemaValues] = React.useState<ToolSchemaValues>({})
  const handleSchemaValueChange = React.useCallback((name: string, value: unknown) => {
    setSchemaValues((current) => Object.is(current[name], value) ? current : { ...current, [name]: value })
  }, [])
  const [agentRunRecords, setAgentRunRecords] = React.useState<ToolAgentRunRecord[]>([])
  const [fastLaneRuns, setFastLaneRuns] = React.useState<Readonly<Record<string, ToolFastLaneRunProgress>>>({})
  const [restoredAgentRunIds, setRestoredAgentRunIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const agentRunSessionKey = React.useMemo(
    () => getToolAgentRunSessionKey(activeChannelId, tool.id),
    [activeChannelId, tool.id],
  )
  const [hydratedAgentRunSessionKey, setHydratedAgentRunSessionKey] = React.useState<string | null>(null)
  const [selectedStorageMedia, setSelectedStorageMedia] = React.useState<ToolRunSourceMedia | null>(null)
  const [generateCooldownActive, setGenerateCooldownActive] = React.useState(false)
  const generateSubmissionLockRef = React.useRef(false)
  const lastGenerateAtRef = React.useRef(0)
  const generateCooldownTimerRef = React.useRef<number | null>(null)
  const resumedMediaDownloaderRunIdsRef = React.useRef(new Set<string>())
  const agentFinalHandoffPollStartedAtRef = React.useRef(new Map<string, number>())
  const recentWorkflowRefreshTimerRef = React.useRef<number | null>(null)
  const recentWorkflowRefreshAttemptRef = React.useRef(new Map<string, number>())
  const recentWorkflowRefreshPendingRef = React.useRef(new Set<string>())
  const recentWorkflowRefreshAcknowledgedRef = React.useRef(new Set<string>())
  const recentWorkflowRefreshInFlightRef = React.useRef<number | null>(null)
  const recentWorkflowRefreshGenerationRef = React.useRef(0)
  const [recentWorkflowHandoffFailedAgentIds, setRecentWorkflowHandoffFailedAgentIds] = React.useState<string[]>([])
  const [recentWorkflowManualRetryNonce, setRecentWorkflowManualRetryNonce] = React.useState(0)
  const selectedModel = getRunnableToolModel(models, model, defaultModelId)
  const selectedDiscoveryModel = getDiscoveryModel(discoveryTool, selectedModel?.id ?? model)
  const effectiveInputContract = getEffectiveToolInputContract(discoveryTool, selectedDiscoveryModel)
  const selectedSourceThumbnailQuery = useStorageObjectThumbnailUrl({
    channelId: activeChannelId,
    storageObjectId: selectedStorageMedia?.storageObjectId ?? null,
    enabled: Boolean(
      (isCaptionToolConfig(tool) || isAngleToolCatalogItem(discoveryTool))
      && selectedStorageMedia
      && !selectedStorageMedia.previewUrl,
    ),
  })
  const selectedStorageMediaWithPreview = React.useMemo(() => {
    return withToolSourceMediaPreview(
      selectedStorageMedia,
      selectedSourceThumbnailQuery.data?.url,
    )
  }, [selectedSourceThumbnailQuery.data?.url, selectedStorageMedia])
  const effectiveInputSchema = React.useMemo(
    () => getEffectiveToolInputSchema(discoveryTool, selectedDiscoveryModel),
    [discoveryTool, selectedDiscoveryModel],
  )
  const speechGenerateTool = isSpeechGenerateInputContract(
    effectiveInputContract,
  )
  const instantVoiceCloneRun = isInstantVoiceCloneInputContract(effectiveInputContract)
  const standardFields = React.useMemo(
    () => getStandardToolFieldSupport(discoveryTool, selectedDiscoveryModel),
    [discoveryTool, selectedDiscoveryModel],
  )
  const toolStandardFields = React.useMemo(
    () => getToolStandardFieldSupport(tool, discoveryTool, selectedDiscoveryModel, standardFields),
    [discoveryTool, selectedDiscoveryModel, standardFields, tool],
  )
  const modeOptions = React.useMemo(
    () => getToolModeOptions(tool, discoveryTool, effectiveInputSchema, toolStandardFields.mode),
    [discoveryTool, effectiveInputSchema, tool, toolStandardFields.mode],
  )
  const avatarDurationAutoLabel = tAuto('avatar_duration_auto_speech')
  const effectiveDurationOptions = React.useMemo(
    () => isAvatarGenerateInputContract(discoveryTool?.input_contract)
      ? getAvatarDurationOptions(
        effectiveInputSchema,
        toolStandardFields.duration,
        avatarDurationAutoLabel,
        discoveryTool?.input_contract.input_schema,
      )
      : getSchemaChoiceOptions(
        effectiveInputSchema,
        toolStandardFields.duration,
        'seconds',
        discoveryTool?.input_contract.input_schema,
      ),
    [avatarDurationAutoLabel, discoveryTool, effectiveInputSchema, toolStandardFields.duration],
  )
  const effectiveResolutionOptions = React.useMemo(
    () => getSchemaChoiceOptions(
      effectiveInputSchema,
      toolStandardFields.resolution,
      undefined,
      discoveryTool?.input_contract.input_schema,
    ),
    [discoveryTool, effectiveInputSchema, toolStandardFields.resolution],
  )
  const effectiveRatioOptions = React.useMemo(
    () => getSchemaChoiceOptions(
      effectiveInputSchema,
      toolStandardFields.ratio,
      undefined,
      discoveryTool?.input_contract.input_schema,
    ),
    [discoveryTool, effectiveInputSchema, toolStandardFields.ratio],
  )
  const unavailableReason = getToolUnavailableReason(discoveryTool)
  const schemaDefaults = React.useMemo(
    () => collectInitialSchemaValues(discoveryTool, selectedDiscoveryModel),
    [discoveryTool, selectedDiscoveryModel],
  )
  const promptDefault = React.useMemo(
    () => getSchemaFieldDefaultString(effectiveInputSchema, toolStandardFields.prompt),
    [effectiveInputSchema, toolStandardFields.prompt],
  )
  const resolutionDefault = React.useMemo(
    () => getSchemaFieldDefaultString(effectiveInputSchema, toolStandardFields.resolution),
    [effectiveInputSchema, toolStandardFields.resolution],
  )
  const agentParams = React.useMemo(() => buildToolAgentParams({
    tool,
    discoveryTool,
    selectedModel: selectedDiscoveryModel,
    prompt,
    selectedModelId: selectedModel?.id ?? model,
    mode,
    duration,
    resolution,
    ratio,
    motion,
    seed,
    audio,
    standardFields: toolStandardFields,
    schemaValues,
  }), [
    audio,
    discoveryTool,
    duration,
    mode,
    model,
    motion,
    prompt,
    ratio,
    resolution,
    schemaValues,
    seed,
    selectedDiscoveryModel,
    selectedModel?.id,
    toolStandardFields,
    tool,
  ])
  const requiredInputReason = React.useMemo(
    () => getMissingRequiredInputReason(discoveryTool, selectedDiscoveryModel, agentParams),
    [agentParams, discoveryTool, selectedDiscoveryModel],
  )
  const paramValidationIssues = React.useMemo(
    () => validateToolAgentParams(discoveryTool, selectedDiscoveryModel, agentParams),
    [agentParams, discoveryTool, selectedDiscoveryModel],
  )
  const paramValidationReason = paramValidationIssues.length > 0
    ? formatToolParamValidationIssue(paramValidationIssues[0]!)
    : null
  const anglePromptValidationReason = React.useMemo(
    () => getAnglePromptValidationReason(isAngleToolCatalogItem(discoveryTool), agentParams.angles),
    [agentParams.angles, discoveryTool],
  )
  const voiceCloneSelfAttestationAccepted = schemaValues[VOICE_CLONE_SELF_ATTESTATION_DRAFT_KEY] === true
  const voiceCloneConsentPreflightReason = getVoiceCloneConsentPreflightReason({
    discoveryTool,
    selectedModel: selectedDiscoveryModel,
    params: agentParams,
    selfAttestationAccepted: voiceCloneSelfAttestationAccepted,
  })
  const modelCatalogReason = getToolModelAvailabilityReason(Boolean(getToolRegistryCapability(discoveryTool) || toolStandardFields.model), models, selectedModel)
  const estimateAgentParams = React.useMemo(
    () => withVoiceCloneEstimateConsentSentinel(
      discoveryTool,
      selectedDiscoveryModel,
      agentParams,
      voiceCloneSelfAttestationAccepted,
    ),
    [agentParams, discoveryTool, selectedDiscoveryModel, voiceCloneSelfAttestationAccepted],
  )
  const [sourceImageUploadNames, setSourceImageUploadNames] = React.useState<Set<string>>(() => new Set())
  const sourceImageUploading = sourceImageUploadNames.size > 0
  const handleSourceImageUploadStateChange = React.useCallback((name: string, uploading: boolean) => {
    setSourceImageUploadNames((current) => {
      const next = new Set(current)
      if (uploading) {
        next.add(name)
      } else {
        next.delete(name)
      }
      if (next.size === current.size && next.has(name) === current.has(name)) return current
      return next
    })
  }, [])
  const pricingEstimateParams = React.useMemo(() => omitNonBillablePromptParams(agentParams), [agentParams])
  const mediaDownloaderToolActive = isMediaDownloaderToolConfig(tool)
  const viralClipsToolActive = isMagicClipsToolConfig(tool)
  const featureLimitsQuery = useQuery({
    queryKey: MY_FEATURE_LIMITS_QUERY_KEY,
    queryFn: getMyFeatureLimits,
    enabled: mediaDownloaderToolActive,
    staleTime: 60_000,
  })
  const mediaDownloaderCreditQuery = useQuery({
    queryKey: BILLING_QUOTA_USAGE_QUERY_KEY,
    queryFn: getBillingQuotaUsage,
    enabled: mediaDownloaderToolActive,
    staleTime: 30_000,
  })
  const mediaDownloaderPlan = React.useMemo(
    () => parseMediaDownloaderPlanLimits(featureLimitsQuery.data?.features ?? []),
    [featureLimitsQuery.data?.features],
  )
  const mediaDownloaderAvailableCredits = getMediaDownloaderAvailableCredits(mediaDownloaderCreditQuery.data)
  const mediaDownloaderSourceUrl = mediaDownloaderToolActive
    ? getMediaDownloaderInputUrl(schemaValues)
    : ''
  const mediaDownloaderQuote = useMediaDownloaderQuote({
    channelId: activeChannelId,
    url: mediaDownloaderSourceUrl,
    availableCredits: mediaDownloaderAvailableCredits,
    creditEligibilityFailed: mediaDownloaderCreditQuery.isError,
    creditEligibilityRetrying: mediaDownloaderCreditQuery.isFetching,
    onRetryCreditEligibility: () => {
      void mediaDownloaderCreditQuery.refetch()
    },
    nodeType: discoveryTool.execution.node_type,
    downloadVariant: stringifySchemaValue(schemaValues.download_variant) || 'video_with_audio',
    startTime: getMediaDownloaderClipMode(schemaValues) === 'clip' ? getFiniteNumber(schemaValues.start_time) : null,
    endTime: getMediaDownloaderClipMode(schemaValues) === 'clip' ? getFiniteNumber(schemaValues.end_time) : null,
    maxHeight: mediaDownloaderPlan.maxResolution,
    enabled: mediaDownloaderToolActive && Boolean(activeChannelId) && Boolean(mediaDownloaderSourceUrl),
  })
  const estimateParamsHash = React.useMemo(() => stableObjectHash(estimateAgentParams), [estimateAgentParams])
  const inputDraftHashRef = React.useRef(estimateParamsHash)
  React.useEffect(() => {
    inputDraftHashRef.current = estimateParamsHash
  }, [estimateParamsHash])
  const estimateEnabled = Boolean(
    activeChannelId
      && !unavailableReason
      && !modelCatalogReason
      && !sourceImageUploading
      && !requiredInputReason
      && !paramValidationReason
      && !anglePromptValidationReason
      && !voiceCloneConsentPreflightReason,
  )
  const [settledEstimateHash, setSettledEstimateHash] = React.useState(estimateParamsHash)
  React.useEffect(() => {
    if (!isVideoToGifToolConfig(tool)) return
    const timer = window.setTimeout(() => setSettledEstimateHash(estimateParamsHash), 250)
    return () => window.clearTimeout(timer)
  }, [estimateParamsHash, tool])
  const estimateDraftSettled = !isVideoToGifToolConfig(tool) || settledEstimateHash === estimateParamsHash
  const agentEstimateQuery = useQuery({
    queryKey: [
      'workflow-agent',
      'estimate',
      activeChannelId ?? 'none',
      discoveryTool?.execution.node_type ?? 'none',
      estimateParamsHash,
    ],
    queryFn: ({ signal }) => {
      return estimateWorkflowAgent({
        channelId: activeChannelId,
        nodeType: discoveryTool.execution.node_type,
        params: estimateAgentParams,
        idempotencyKey: `tool-estimate:${estimateParamsHash}`,
      }, { signal })
    },
    enabled: estimateEnabled && !mediaDownloaderToolActive && estimateDraftSettled,
    retry: false,
    staleTime: 120_000,
  })
  const captionRenderEstimatedCredits = React.useMemo(
    () => isCaptionToolConfig(tool)
      ? estimateCaptionRenderCredits(discoveryTool, pricingEstimateParams)
      : null,
    [discoveryTool, pricingEstimateParams, tool],
  )
  const localEstimatedCredits = React.useMemo(
    () => captionRenderEstimatedCredits
      ?? estimateLocalToolCredits(selectedDiscoveryModel, pricingEstimateParams),
    [captionRenderEstimatedCredits, pricingEstimateParams, selectedDiscoveryModel],
  )
  const displayedEstimatedCredits = modelCatalogReason ? null : mediaDownloaderToolActive
    ? mediaDownloaderQuote.displayedCredits
    : resolveDisplayedToolCredits(
      tool,
      localEstimatedCredits,
      agentEstimateQuery.data?.total_credits_estimated ?? null,
    )
  const viralClipsEstimateState = React.useMemo<MagicClipsEstimateState | null>(() => {
    if (!viralClipsToolActive) return null
    const currentCredits = agentEstimateQuery.data?.total_credits_estimated ?? null
    return {
      estimatedCredits: currentCredits,
      quotaSnapshot: agentEstimateQuery.data?.viral_clips_quota ?? null,
      estimateErrorMessage: getToolAgentEstimateBlockingReason(agentEstimateQuery.error, tAuto)
        ?? (agentEstimateQuery.data && !agentEstimateQuery.data.viral_clips_quota
          ? tAuto('viral_clips_quota_unavailable')
          : null),
    }
  }, [
    agentEstimateQuery.data,
    agentEstimateQuery.error,
    tAuto,
    viralClipsToolActive,
  ])
  const creditLabel = displayedEstimatedCredits !== null
    ? formatCreditLabel(displayedEstimatedCredits)
    : getToolCreditLabel(discoveryTool, selectedModel)
  const creditPending = mediaDownloaderToolActive
    ? mediaDownloaderQuote.quoting || mediaDownloaderQuote.creditEligibilityPending
    : Boolean(estimateEnabled && agentEstimateQuery.isFetching && localEstimatedCredits === null)
  const mediaDownloaderCreditBlockedReason = mediaDownloaderQuote.creditEligibilityFailed
    ? tAuto('media_downloader_credit_check_failed')
    : mediaDownloaderQuote.blockedByCredits
    ? tAuto('media_downloader_credit_required')
    : null
  const mediaDownloaderPreflightReason = getMediaDownloaderQuotePreflightReason({
    active: mediaDownloaderToolActive,
    error: mediaDownloaderQuote.error,
    quoting: mediaDownloaderQuote.quoting,
    status: mediaDownloaderQuote.status,
    canLaunch: mediaDownloaderQuote.canLaunch,
    sourceCount: mediaDownloaderSourceUrl ? 1 : 0,
    blockedReason: mediaDownloaderCreditBlockedReason,
  })
  const workflowLimitPreflightReason = getToolAgentEstimateBlockingReason(agentEstimateQuery.error, tAuto)
  const viralClipsEstimatePreflightReason = viralClipsToolActive
    && estimateEnabled
    && (
      !agentEstimateQuery.data
      || !agentEstimateQuery.data.viral_clips_quota
    )
    ? workflowLimitPreflightReason
      ?? (agentEstimateQuery.data && !agentEstimateQuery.data.viral_clips_quota
        ? tAuto('viral_clips_quota_unavailable')
        : tAuto('viral_clips_estimate_required'))
    : null
  const generateDisabledReason = unavailableReason
    ?? (!activeChannelId ? 'Select channel' : null)
    ?? modelCatalogReason
    ?? (sourceImageUploading ? 'Preparing asset' : null)
    ?? requiredInputReason
    ?? anglePromptValidationReason
    ?? paramValidationReason
    ?? voiceCloneConsentPreflightReason
    ?? workflowLimitPreflightReason
    ?? viralClipsEstimatePreflightReason
    ?? mediaDownloaderPreflightReason
  const recentWorkflowKind = React.useMemo(
    () => getToolRecentWorkflowOutputKind(tool, discoveryTool.input_contract),
    [tool, discoveryTool.input_contract],
  )
  const recentWorkflowNodeType = React.useMemo(() => getRecentWorkflowNodeType(
    tool,
    getEffectiveToolInputContract(discoveryTool, selectedDiscoveryModel),
    discoveryTool.execution.node_type,
  ), [discoveryTool, selectedDiscoveryModel, tool])
  const recentWorkflowEnabled = Boolean(activeChannelId && recentWorkflowNodeType)
  const recentWorkflowOutputsQueryKey = React.useMemo(() => [
    'workflow-agent',
    'recent-outputs',
    activeChannelId ?? 'none',
    recentWorkflowNodeType,
    recentWorkflowKind ?? 'all',
  ] as const, [activeChannelId, recentWorkflowKind, recentWorkflowNodeType])
  const recentWorkflowOutputsQuery = useInfiniteQuery({
    queryKey: recentWorkflowOutputsQueryKey,
    queryFn: ({ pageParam, signal }) => listRecentWorkflowOutputs({
      channelId: activeChannelId,
      nodeType: recentWorkflowNodeType,
      kind: recentWorkflowKind,
      limit: TOOL_RECENT_OUTPUT_PAGE_SIZE,
      cursor: typeof pageParam === 'string' ? pageParam : null,
    }, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined
    ),
    enabled: recentWorkflowEnabled,
    refetchInterval: (query) => query.state.data?.pages.some((page) => page.items.some((item) => item.deliveryStatus === 'payment_review'))
      ? 60_000 : query.state.data?.pages.some((page) => page.items.some((item) => shouldPollAgentStatus(item.status))) ? 10_000 : false,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: true,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })
  const recentWorkflowRunItems = React.useMemo(
    () => recentWorkflowOutputsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [recentWorkflowOutputsQuery.data],
  )
  // LLM-03: prompt_generate / prompt_enhance / openai_text_test runs that took the fast lane have no workflow; the
  // gateway lists them separately with the same item fields, and the history shows both lists merged.
  const textToolFastLaneNodeType = React.useMemo(
    () => toTextToolFastLaneNodeType(discoveryTool.execution.node_type),
    [discoveryTool.execution.node_type],
  )
  const textToolFastRunsEnabled = Boolean(activeChannelId && textToolFastLaneNodeType)
  const textToolFastRunsKey = React.useMemo(
    () => textToolFastRunsQueryKey(activeChannelId, textToolFastLaneNodeType),
    [activeChannelId, textToolFastLaneNodeType],
  )
  const textToolFastRunsAwaitingHistory = agentRunRecords.some((run) => (
    Boolean(fastLaneRuns[run.id]?.finished && fastLaneRuns[run.id]?.fastRunId)
  ))
  const textToolFastRunsQuery = useInfiniteQuery({
    queryKey: textToolFastRunsKey,
    queryFn: ({ pageParam, signal }) => listTextToolFastRuns(activeChannelId!, textToolFastLaneNodeType!, {
      limit: TOOL_RECENT_OUTPUT_PAGE_SIZE,
      before: typeof pageParam === 'string' ? pageParam : null,
      signal,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: TextToolFastRunPage) => (
      lastPage.hasMore && lastPage.nextBefore ? lastPage.nextBefore : undefined
    ),
    enabled: textToolFastRunsEnabled,
    // A run whose stream ended without its answer (a dropped connection) is polled until the history lists it.
    refetchInterval: textToolFastRunsAwaitingHistory ? 5_000 : false,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: true,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })
  const textToolFastRunItems = React.useMemo(
    () => (textToolFastRunsEnabled ? textToolFastRunsQuery.data?.pages.flatMap((page) => page.items) ?? [] : []),
    [textToolFastRunsEnabled, textToolFastRunsQuery.data],
  )
  const textToolFastRunsPending = textToolFastRunsEnabled
    && !textToolFastRunsQuery.isFetched
    && !textToolFastRunsQuery.error
  const recentWorkflowItems = React.useMemo(
    () => mergeTextToolFastRunItems(recentWorkflowRunItems, textToolFastRunItems),
    [recentWorkflowRunItems, textToolFastRunItems],
  )
  const handedOffFastLaneRunIds = React.useMemo(
    () => getHandedOffFastLaneRunIds(fastLaneRuns, textToolFastRunItems),
    [fastLaneRuns, textToolFastRunItems],
  )
  const completedRecentAgentIds = React.useMemo(() => new Set(
    recentWorkflowRunItems.flatMap((item) => (
      item.agentId
        && isRecentWorkflowOutputReadyForRunHandoff(item, recentWorkflowKind)
        ? [item.agentId]
        : []
    )),
  ), [recentWorkflowRunItems, recentWorkflowKind])
  const completedRecentAgentIdSignal = React.useMemo(
    () => [...completedRecentAgentIds].sort().join('|'),
    [completedRecentAgentIds],
  )
  const sessionScopedAgentRunRecords = React.useMemo(() => (
    hydratedAgentRunSessionKey === agentRunSessionKey ? agentRunRecords : []
  ), [agentRunRecords, agentRunSessionKey, hydratedAgentRunSessionKey])
  const reconciledAgentRunRecords = React.useMemo(() => sessionScopedAgentRunRecords.filter((run) => (
    (!run.launch?.agent_id || !completedRecentAgentIds.has(run.launch.agent_id))
    && !handedOffFastLaneRunIds.has(run.id)
  )), [sessionScopedAgentRunRecords, completedRecentAgentIds, handedOffFastLaneRunIds])

  React.useEffect(() => {
    // The history lists these fast runs now: drop their live cards and progress.
    if (handedOffFastLaneRunIds.size === 0) return
    setAgentRunRecords((current) => {
      const next = current.filter((run) => !handedOffFastLaneRunIds.has(run.id))
      return next.length === current.length ? current : next
    })
    setFastLaneRuns((current) => omitFastLaneRunProgress(current, handedOffFastLaneRunIds))
  }, [handedOffFastLaneRunIds])
  const recentWorkflowSnapshotReady = hasUsableRecentWorkflowSnapshot(
    recentWorkflowEnabled,
    recentWorkflowOutputsQuery.isFetched,
    Boolean(recentWorkflowOutputsQuery.error),
  )

  React.useEffect(() => {
    if (
      !completedRecentAgentIdSignal
      || hydratedAgentRunSessionKey !== agentRunSessionKey
    ) return
    setAgentRunRecords((current) => {
      const next = current.filter((run) => (
        !run.launch?.agent_id || !completedRecentAgentIds.has(run.launch.agent_id)
      ))
      return next.length === current.length ? current : next
    })
  }, [
    agentRunSessionKey,
    completedRecentAgentIdSignal,
    completedRecentAgentIds,
    hydratedAgentRunSessionKey,
  ])

  React.useEffect(() => {
    resumedMediaDownloaderRunIdsRef.current.clear()
  }, [agentRunSessionKey])

  React.useLayoutEffect(() => {
    const restoredRecords = agentRunSessionKey
      ? readToolAgentRunSession(agentRunSessionKey)
      : []
    setRestoredAgentRunIds(new Set(restoredRecords.map((record) => record.id)))
    setAgentRunRecords(restoredRecords)
    setHydratedAgentRunSessionKey(agentRunSessionKey)
  }, [agentRunSessionKey])

  React.useEffect(() => {
    if (!agentRunSessionKey || hydratedAgentRunSessionKey !== agentRunSessionKey) return
    writeToolAgentRunSession(agentRunSessionKey, agentRunRecords)
  }, [agentRunRecords, agentRunSessionKey, hydratedAgentRunSessionKey])

  React.useEffect(() => {
    setMode(modeOptions[0]?.value ?? '')
  }, [modeOptions])

  React.useEffect(() => {
    setPrompt(promptDefault)
  }, [promptDefault])

  React.useEffect(() => {
    setSchemaValues(schemaDefaults)
  }, [schemaDefaults])

  React.useEffect(() => {
    if (!sourceUrl) return
    const applyKey = `${tool.id}:${selectedDiscoveryModel?.id ?? ''}:${sourceUrl}`
    if (sourceUrlAppliedRef.current === applyKey) return

    const preferredMode = getSourceUrlPreferredMode(tool, modeOptions)
    if (preferredMode && preferredMode !== mode) setMode(preferredMode)
    setSchemaValues((current) => applySourceUrlToSchemaValues(current, effectiveInputSchema, sourceUrl))
    sourceUrlAppliedRef.current = applyKey
  }, [effectiveInputSchema, mode, modeOptions, selectedDiscoveryModel?.id, sourceUrl, tool])

  React.useEffect(() => {
    if (!routeStorageObjectId) return
    const seeded = seededStorageQuery.data?.id === routeStorageObjectId ? seededStorageQuery.data : null
    setSchemaValues((current) => {
      const currentId = stringifySchemaValue(current.storage_object_id)
      if (currentId && currentId !== routeStorageObjectId) return current
      return applyStorageObjectIdToSchemaValues(current, effectiveInputSchema, routeStorageObjectId, {
        durationSeconds: seeded?.duration_seconds ?? null,
        width: readStorageObjectDimension(seeded?.metadata.width),
        height: readStorageObjectDimension(seeded?.metadata.height),
      })
    })
    if (!activeChannelId || !seeded) return
    setSelectedStorageMedia((current) => {
      if (current && current.storageObjectId !== routeStorageObjectId) return current
      return toolSourceMediaFromStorageObject(activeChannelId, seeded)
    })
  }, [
    activeChannelId,
    effectiveInputSchema,
    routeStorageObjectId,
    schemaDefaults,
    seededStorageQuery.data,
  ])

  React.useEffect(() => {
    const routeValues = getVoiceRouteSchemaValues(effectiveInputSchema, {
      voiceProfileId: routeVoiceProfileId,
      referenceStorageObjectId: routeReferenceStorageObjectId,
      language: routeVoiceLanguage,
    })
    if (Object.keys(routeValues).length === 0) return

    const applyKey = `${tool.id}:${selectedDiscoveryModel?.id ?? ''}:${JSON.stringify(routeValues)}`
    if (voiceRouteParamsAppliedRef.current === applyKey) return
    setSchemaValues((current) => ({ ...current, ...routeValues }))
    voiceRouteParamsAppliedRef.current = applyKey
  }, [
    effectiveInputSchema,
    routeReferenceStorageObjectId,
    routeVoiceLanguage,
    routeVoiceProfileId,
    selectedDiscoveryModel?.id,
    tool.id,
  ])

  React.useEffect(() => {
    if (routeModelId && models.some((item) => item.id === routeModelId)) {
      if (model !== routeModelId) setModel(routeModelId)
      return
    }
    if (models.some((item) => item.id === model)) return
    setModel(defaultModelId)
  }, [defaultModelId, model, models, routeModelId])

  React.useEffect(() => {
    if (modeOptions.length === 0) {
      if (mode) setMode('')
      return
    }
    if (modeOptions.some((item) => item.value === mode)) return
    setMode(modeOptions[0]?.value ?? '')
  }, [mode, modeOptions])

  React.useEffect(() => {
    if (effectiveDurationOptions.length === 0) {
      if (duration) setDuration('')
      return
    }
    if (effectiveDurationOptions.some((item) => item.value === duration)) return
    setDuration(effectiveDurationOptions[0]?.value ?? '')
  }, [duration, effectiveDurationOptions])

  React.useEffect(() => {
    if (effectiveResolutionOptions.length === 0) {
      if (resolution) setResolution('')
      return
    }
    if (effectiveResolutionOptions.some((item) => item.value === resolution)) return
    const nextResolution = effectiveResolutionOptions.some((item) => item.value === resolutionDefault)
      ? resolutionDefault
      : effectiveResolutionOptions[0]?.value ?? ''
    setResolution(nextResolution)
  }, [effectiveResolutionOptions, resolution, resolutionDefault])

  React.useEffect(() => {
    if (effectiveRatioOptions.length === 0) {
      if (ratio) setRatio('')
      return
    }
    if (effectiveRatioOptions.some((item) => item.value === ratio)) return
    setRatio(effectiveRatioOptions[0]?.value ?? '')
  }, [effectiveRatioOptions, ratio])

  const randomizeSeed = React.useCallback(() => {
    setSeed(String(Math.floor(100000 + Math.random() * 900000)))
  }, [])

  const resetInputDraft = React.useCallback(() => {
    setMode(modeOptions[0]?.value ?? '')
    setPrompt(promptDefault)
    setModel(defaultModelId)
    setDuration(effectiveDurationOptions[0]?.value ?? '')
    setResolution(
      effectiveResolutionOptions.some((item) => item.value === resolutionDefault)
        ? resolutionDefault
        : effectiveResolutionOptions[0]?.value ?? '',
    )
    setRatio(effectiveRatioOptions[0]?.value ?? '')
    setMotion(7)
    setSeed('123456')
    setAudio(false)
    setSchemaValues(schemaDefaults)
    setSelectedStorageMedia(null)
  }, [
    defaultModelId,
    effectiveDurationOptions,
    effectiveRatioOptions,
    effectiveResolutionOptions,
    resolutionDefault,
    modeOptions,
    promptDefault,
    schemaDefaults,
  ])

  const releaseGenerateGuard = React.useCallback(() => {
    const released = releaseToolGenerateSubmission({
      submissionLocked: generateSubmissionLockRef.current,
      lastGenerateAtMs: lastGenerateAtRef.current,
    })
    generateSubmissionLockRef.current = released.submissionLocked
    lastGenerateAtRef.current = released.lastGenerateAtMs
  }, [])

  const updateFastLaneRun = React.useCallback((
    runId: string,
    update: (current: ToolFastLaneRunProgress) => ToolFastLaneRunProgress,
  ) => {
    setFastLaneRuns((current) => ({
      ...current,
      [runId]: update(current[runId] ?? { fastRunId: null, text: '', finished: false }),
    }))
  }, [])

  /**
   * LLM-03: the fast-lane stream ended. A completed answer goes into the cached history at once (the live card hands
   * over to it in the same render); a failure stays on the live card until the refetched history lists the stored
   * failed run; an interrupted stream keeps its card loading while the history is polled.
   */
  const settleFastLaneRun = React.useCallback((runId: string, result: ToolFastLaneLaunchResult) => {
    const { outcome } = result
    const queryKey = textToolFastRunsQueryKey(result.channelId, result.nodeType)
    if (outcome.kind === 'completed') {
      queryClient.setQueryData<InfiniteData<TextToolFastRunPage, string | null>>(
        queryKey,
        (current) => upsertTextToolFastRunPage(current, outcome.run),
      )
    }
    updateFastLaneRun(runId, (current) => ({
      fastRunId: outcome.runId,
      text: outcome.kind === 'failed' ? current.text : outcome.text || current.text,
      finished: true,
    }))
    setAgentRunRecords((current) => current.map((run) => (
      run.id === runId
        ? {
            ...run,
            loading: outcome.kind === 'interrupted',
            errorMessage: outcome.kind === 'failed' ? outcome.message : null,
          }
        : run
    )))
    void queryClient.invalidateQueries({ queryKey, exact: true })
  }, [queryClient, updateFastLaneRun])

  const launchAgentMutation = useMutation({
    mutationFn: async (input: {
      runId: string
      idempotencyKey: string
      draftHash: string | null
      channelId: string
      nodeType: string
      params: Record<string, unknown>
      displayedEstimate: WorkflowAgentEstimateResult | null
      selfAttestationAccepted: boolean
      attempt?: ClientMutationAttempt<ToolLaunchIntent>
    }) => {
      const launchParams = await prepareToolLaunchParams({
        discoveryTool,
        selectedModel: selectedDiscoveryModel,
        channelId: input.channelId,
        params: input.params,
        selfAttestationAccepted: input.selfAttestationAccepted,
        consentIdempotencyKey: voiceConsentIdempotencyKey(input.idempotencyKey),
      })
      // LLM-03 (S2-A): the three single-call text tools try the fast lane first. A refusal before the stream
      // (`fallback`) ran and charged nothing, so the normal workflow launch below continues unchanged.
      const fastLaneNodeType = toTextToolFastLaneNodeType(input.nodeType)
      if (fastLaneNodeType) {
        const outcome = await runTextToolFastLane({
          idempotencyKey: createTextToolFastLaneIdempotencyKey(),
          channelId: input.channelId,
          nodeType: fastLaneNodeType,
          params: launchParams,
        }, {
          onAccepted: ({ runId }) => updateFastLaneRun(input.runId, (current) => ({ ...current, fastRunId: runId })),
          onDelta: (_delta, text) => updateFastLaneRun(input.runId, (current) => ({ ...current, text })),
        })
        if (outcome.kind !== 'fallback') {
          const fastLaneResult: ToolFastLaneLaunchResult = {
            lane: 'fast',
            channelId: input.channelId,
            nodeType: fastLaneNodeType,
            outcome,
          }
          return fastLaneResult
        }
      }
      const quotedParams = isMediaDownloaderToolConfig(tool)
        ? applyMediaDownloaderQuoteLaunchParams(launchParams, mediaDownloaderQuote.snapshot)
        : launchParams
      // LAT-04 / Y11: the displayed estimate's launch quote, while it stays valid. The server skips its second
      // validation when the launch request is exactly the quoted one and refuses (409) a price the user did not see.
      const displayedLaunchQuote = validWorkflowAgentLaunchQuote(input.displayedEstimate)
      const revalidateBeforeLaunch = async (displayedCredits: number | null) => {
        const revalidatedEstimate = await estimateWorkflowAgent({
          channelId: input.channelId,
          nodeType: input.nodeType,
          params: quotedParams,
          idempotencyKey: `tool-launch-estimate:${input.idempotencyKey}`,
        })
        if (
          hasWorkflowEstimateChanged(displayedCredits, revalidatedEstimate.total_credits_estimated)
          && !window.confirm(tAuto('viral_clips_price_changed_confirmation', {
            previous: displayedCredits ?? 0,
            next: revalidatedEstimate.total_credits_estimated,
          }))
        ) {
          throw new ToolLaunchConfirmationCancelledError()
        }
        const quotaSnapshot = revalidatedEstimate.viral_clips_quota
        if (!quotaSnapshot) throw new ToolViralClipsQuotaUnavailableError()
        confirmViralClipsQuota(quotaSnapshot, revalidatedEstimate.total_credits_estimated)
        return {
          expectedViralClipsQuota: quotaSnapshot,
          launchQuoteId: validWorkflowAgentLaunchQuote(revalidatedEstimate)?.quote_id ?? null,
        }
      }
      const confirmViralClipsQuota = (quotaSnapshot: ViralClipsQuotaSnapshot, credits: number) => {
        if (shouldConfirmViralClipsQuota(quotaSnapshot) && !window.confirm(tAuto('viral_clips_quota_limited_confirmation', {
          remaining: quotaSnapshot.remaining_clips,
          max: quotaSnapshot.max_clips_this_run,
          credits,
        }))) {
          throw new ToolLaunchConfirmationCancelledError()
        }
      }
      let expectedViralClipsQuota: ViralClipsQuotaSnapshot | undefined
      let launchQuoteId: string | null = displayedLaunchQuote?.quote_id ?? null
      if (shouldRevalidateAgentEstimateBeforeLaunch(tool)) {
        const displayedQuota = input.displayedEstimate?.viral_clips_quota
        if (displayedLaunchQuote && displayedQuota && input.displayedEstimate) {
          // The displayed price and quota are still quoted: no second estimate round trip before the launch.
          expectedViralClipsQuota = displayedQuota
          confirmViralClipsQuota(displayedQuota, input.displayedEstimate.total_credits_estimated)
        } else {
          const revalidated = await revalidateBeforeLaunch(input.displayedEstimate?.total_credits_estimated ?? null)
          expectedViralClipsQuota = revalidated.expectedViralClipsQuota
          launchQuoteId = revalidated.launchQuoteId
        }
      }
      const launch = (quoteId: string | null, viralClipsQuota: ViralClipsQuotaSnapshot | undefined) => launchWorkflowAgent({
        projectId: input.channelId,
        channelId: input.channelId,
        nodeType: input.nodeType,
        params: quotedParams,
        idempotencyKey: input.idempotencyKey,
        expectedViralClipsQuota: viralClipsQuota,
        launchQuoteId: quoteId,
      })
      try {
        return await launch(launchQuoteId, expectedViralClipsQuota)
      } catch (error) {
        if (!launchQuoteId || !isLaunchQuotePriceChangedError(error)) throw error
        // The quoted price no longer holds (nothing was held or charged): re-estimate and confirm as before.
        if (shouldRevalidateAgentEstimateBeforeLaunch(tool)) {
          const revalidated = await revalidateBeforeLaunch(input.displayedEstimate?.total_credits_estimated ?? null)
          return launch(null, revalidated.expectedViralClipsQuota)
        }
        return launch(null, expectedViralClipsQuota)
      }
    },
    onSuccess: (result, variables) => {
      if (variables.attempt) clearToolLaunchAttempt(variables.attempt)
      if (isToolFastLaneLaunchResult(result)) {
        settleFastLaneRun(variables.runId, result)
        if (
          variables.draftHash
          && shouldResetToolInputAfterLaunch(tool)
          && inputDraftHashRef.current === variables.draftHash
        ) {
          resetInputDraft()
        }
        releaseGenerateGuard()
        return
      }
      setAgentRunRecords((current) => {
        const next = current.map((run) => (
          run.id === variables.runId
            ? {
                ...run,
                launch: result,
                mediaDownloaderSubmission: null,
                loading: false,
                errorMessage: null,
              }
            : run
        ))
        if (agentRunSessionKey) writeToolAgentRunSession(agentRunSessionKey, next)
        return next
      })
      // Do not erase newer edits made while the launch request was in flight.
      if (
        variables.draftHash
        && shouldResetToolInputAfterLaunch(tool)
        && inputDraftHashRef.current === variables.draftHash
      ) {
        resetInputDraft()
      }
      // The launch has been accepted and protected by its idempotency key. Let
      // the user prepare another run while this one continues in the queue.
      releaseGenerateGuard()
    },
    onError: (error, variables) => {
      releaseGenerateGuard()
      setFastLaneRuns((current) => omitFastLaneRunProgress(current, new Set([variables.runId])))
      if (error instanceof ToolLaunchConfirmationCancelledError) {
        if (variables.attempt) clearToolLaunchAttempt(variables.attempt)
        setAgentRunRecords((current) => {
          const next = current.filter((run) => run.id !== variables.runId)
          if (agentRunSessionKey) writeToolAgentRunSession(agentRunSessionKey, next)
          return next
        })
        return
      }
      if (variables.attempt && !isAmbiguousMutationError(error)) clearToolLaunchAttempt(variables.attempt)
      const nextSubmissionState: MediaDownloaderSubmission['state'] = isRetryableWorkflowRequestError(error)
        ? 'submitting'
        : 'failed'
      setAgentRunRecords((current) => {
        const next = current.map((run) => (
          run.id === variables.runId
            ? {
                ...run,
                mediaDownloaderSubmission: run.mediaDownloaderSubmission
                  ? {
                      ...run.mediaDownloaderSubmission,
                      state: nextSubmissionState,
                    }
                  : null,
                loading: false,
                errorMessage: error instanceof ToolViralClipsQuotaUnavailableError
                  ? tAuto('viral_clips_quota_unavailable')
                  : getToolAgentRequestErrorMessage(error, tAuto) ?? 'Request failed',
              }
            : run
        ))
        if (agentRunSessionKey) writeToolAgentRunSession(agentRunSessionKey, next)
        return next
      })
    },
  })
  React.useEffect(() => {
    if (
      !activeChannelId
      || !agentRunSessionKey
      || hydratedAgentRunSessionKey !== agentRunSessionKey
      || launchAgentMutation.isPending
      || !isMediaDownloaderToolConfig(tool)
    ) return

    const pendingRun = agentRunRecords.find((run) => (
      restoredAgentRunIds.has(run.id)
      && !run.launch
      && run.mediaDownloaderSubmission?.state === 'submitting'
      && run.mediaDownloaderSubmission.nodeType === discoveryTool.execution.node_type
      && !resumedMediaDownloaderRunIdsRef.current.has(run.id)
    ))
    const submission = pendingRun?.mediaDownloaderSubmission
    if (!pendingRun || !submission) return

    const timeoutId = window.setTimeout(() => {
      if (resumedMediaDownloaderRunIdsRef.current.has(pendingRun.id)) return
      resumedMediaDownloaderRunIdsRef.current.add(pendingRun.id)
      setAgentRunRecords((current) => current.map((run) => (
        run.id === pendingRun.id
          ? { ...run, loading: true, errorMessage: null }
          : run
      )))
      launchAgentMutation.mutate({
        runId: pendingRun.id,
        idempotencyKey: submission.idempotencyKey,
        draftHash: null,
        channelId: activeChannelId,
        nodeType: submission.nodeType,
        params: submission.params,
        displayedEstimate: null,
        selfAttestationAccepted: false,
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [
    activeChannelId,
    agentRunRecords,
    agentRunSessionKey,
    discoveryTool.execution.node_type,
    hydratedAgentRunSessionKey,
    launchAgentMutation.isPending,
    launchAgentMutation.mutate,
    restoredAgentRunIds,
    tool,
  ])
  const statusPollTargets = React.useMemo(
    () => collectStatusPollTargets(reconciledAgentRunRecords, recentWorkflowRunItems),
    [reconciledAgentRunRecords, recentWorkflowRunItems],
  )
  // LAT-03: a run change hint refetches that run's status at once; polling stays a long safety net.
  const watchedAgentIds = React.useMemo(() => new Set(statusPollTargets.flatMap((run) => (
    run.launch?.agent_id ? [run.launch.agent_id] : []
  ))), [statusPollTargets])
  const watchedAgentIdsRef = React.useRef(watchedAgentIds)
  React.useEffect(() => {
    watchedAgentIdsRef.current = watchedAgentIds
  }, [watchedAgentIds])
  const handleRunEvent = React.useCallback((event: WorkflowRunEventMessage) => {
    if (!watchedAgentIdsRef.current.has(event.workflowId)) return
    void queryClient.invalidateQueries({ queryKey: ['workflow-agent', 'status', event.workflowId], exact: true })
  }, [queryClient])
  const handleRunEventsReady = React.useCallback(() => {
    // Hints sent while the stream was down are lost: refresh every watched run once.
    for (const agentId of watchedAgentIdsRef.current) {
      void queryClient.invalidateQueries({ queryKey: ['workflow-agent', 'status', agentId], exact: true })
    }
  }, [queryClient])
  const { connected: runEventsConnected } = useWorkflowRunEvents({
    enabled: watchedAgentIds.size > 0,
    onEvent: handleRunEvent,
    onReady: handleRunEventsReady,
  })
  const agentStatusQueries = useQueries({
    queries: statusPollTargets.map((run) => ({
      queryKey: ['workflow-agent', 'status', run.launch?.agent_id ?? run.id],
      queryFn: ({ signal }: { signal?: AbortSignal }) => getWorkflowAgentStatus(run.launch!.agent_id, { signal }),
      enabled: Boolean(run.launch?.agent_id)
        && hydratedAgentRunSessionKey === agentRunSessionKey
        && recentWorkflowSnapshotReady
        && (queryClient.getQueryData<WorkflowAgentStatusResult>(
          ['workflow-agent', 'status', run.launch?.agent_id ?? run.id],
        )?.deliveryStatus === 'payment_review' || shouldPollAgentStatus(
          queryClient.getQueryData<WorkflowAgentStatusResult>(
            ['workflow-agent', 'status', run.launch?.agent_id ?? run.id],
          )?.status,
        )),
      retry: false,
      staleTime: 2_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
      refetchInterval: (query: { state: { data?: WorkflowAgentStatusResult; error?: unknown; fetchFailureCount?: number } }) => {
        if (query.state.data?.deliveryStatus === 'payment_review') return 60_000;
        const nowMs = Date.now()
        const agentId = run.launch?.agent_id ?? run.id
        const finalHandoffSignal = isToolAgentFinalHandoffPollingSignal(query.state.data)
        let finalHandoffStartedAtMs = agentFinalHandoffPollStartedAtRef.current.get(agentId)
        if (finalHandoffSignal && finalHandoffStartedAtMs === undefined) {
          finalHandoffStartedAtMs = nowMs
          agentFinalHandoffPollStartedAtRef.current.set(agentId, nowMs)
        } else if (!finalHandoffSignal) {
          agentFinalHandoffPollStartedAtRef.current.delete(agentId)
        }
        // The short final-handoff window keeps its fast poll: Storage presentation readiness sends no hint.
        return withRunEventsSafetyPoll(getToolAgentStatusPollInterval(
          query.state.data?.status,
          run.requestedAt,
          nowMs,
          query.state.error,
          query.state.fetchFailureCount,
          {
            progress: query.state.data?.progress,
            settlementStatus: query.state.data?.settlementStatus,
            finalHandoffStartedAtMs,
          },
        ), runEventsConnected && !finalHandoffSignal && !query.state.error)
      },
    })),
  })
  const agentStatusById = React.useMemo(() => new Map(
    statusPollTargets.map((run, index) => [run.launch.agent_id, agentStatusQueries[index]]),
  ), [statusPollTargets, agentStatusQueries])
  const handleRetryRecentWorkflowHandoff = React.useCallback((agentId: string) => {
    const normalizedAgentId = agentId.trim()
    if (!normalizedAgentId) return
    recentWorkflowRefreshAcknowledgedRef.current.delete(normalizedAgentId)
    recentWorkflowRefreshPendingRef.current.add(normalizedAgentId)
    recentWorkflowRefreshAttemptRef.current.delete(normalizedAgentId)
    setRecentWorkflowHandoffFailedAgentIds((current) => (
      current.filter((candidate) => candidate !== normalizedAgentId)
    ))
    setRecentWorkflowManualRetryNonce((current) => current + 1)
  }, [])
  const agentRuns = React.useMemo<ToolAgentRunState[]>(() => (
    reconciledAgentRunRecords.map((run, index) => {
      const statusQuery = agentStatusById.get(run.launch?.agent_id ?? run.id)
      const runtimeStatus = statusQuery?.data ?? null
      const agentId = run.launch?.agent_id?.trim() ?? ''
      const outputRefreshFailed = Boolean(
        agentId && recentWorkflowHandoffFailedAgentIds.includes(agentId),
      )
      const awaitingRecentOutputHandoff = canReadAgentOutput(runtimeStatus?.status)
        && runtimeStatus?.deliveryStatus !== 'payment_review'
        && !outputRefreshFailed
      const status = runtimeStatus && awaitingRecentOutputHandoff
        ? { ...runtimeStatus, status: 'processing' }
        : runtimeStatus
      const output = null
      // A persisted launch error belongs only to a run that never received an
      // agent id. Once the id exists, the reconciled workflow status is the
      // authority; otherwise a stale error briefly flashes after navigation.
      const launchErrorMessage = run.launch ? null : run.errorMessage
      const effectiveErrorMessage = launchErrorMessage
        ?? status?.errorMessage
        ?? null
      const restoring = isToolAgentRunReconciliationPending({
        restored: restoredAgentRunIds.has(run.id),
        launch: run.launch,
        status,
        output,
        errorMessage: effectiveErrorMessage,
      })
      const discardAfterRestore = isRestoredToolAgentRunDiscardable({
        restored: restoredAgentRunIds.has(run.id),
        status: null,
        errorMessage: launchErrorMessage,
        preserveSubmissionFailure: run.mediaDownloaderSubmission?.state === 'failed',
      })

      return {
        id: run.id,
        estimate: run.estimate,
        idempotencyKey: run.idempotencyKey,
        launch: run.launch,
        status,
        output,
        prompt: run.prompt,
        modelLabel: run.modelLabel,
        provider: run.provider,
        sourceMedia: run.sourceMedia,
        sourceLinks: run.sourceLinks,
        captionPreview: run.captionPreview,
        requestedAt: run.requestedAt,
        estimatedCredits: run.estimatedCredits,
        activityLabel: run.activityLabel,
        voiceProfileId: run.voiceProfileId,
        mediaDownloaderSubmission: run.mediaDownloaderSubmission,
        // Only launch failures without an agent id are discardable. Runtime
        // terminal states stay visible until Recent Outputs replaces the card.
        started: !discardAfterRestore,
        loading: run.loading
          || Boolean(statusQuery?.isFetching)
          || awaitingRecentOutputHandoff,
        restoring,
        outputRefreshFailed,
        retryOutput: outputRefreshFailed
          ? () => handleRetryRecentWorkflowHandoff(agentId)
          : undefined,
        statusConnectionError: statusQuery?.isError
          ? 'Run status is temporarily unavailable. The task may still be running.'
          : null,
        retryStatus: statusQuery?.isError
          ? () => { void statusQuery.refetch() }
          : undefined,
        errorMessage: effectiveErrorMessage,
        streamText: fastLaneRuns[run.id]?.text || null,
      }
    })
  ), [
    agentStatusById,
    fastLaneRuns,
    handleRetryRecentWorkflowHandoff,
    recentWorkflowHandoffFailedAgentIds,
    reconciledAgentRunRecords,
    restoredAgentRunIds,
  ])
  const discardedRestoredRunIdSignal = React.useMemo(() => agentRuns
    .flatMap((run) => (
      run.id && !run.started && restoredAgentRunIds.has(run.id) ? [run.id] : []
    ))
    .sort()
    .join('|'), [agentRuns, restoredAgentRunIds])

  React.useEffect(() => {
    if (!discardedRestoredRunIdSignal) return
    const discardedIds = new Set(discardedRestoredRunIdSignal.split('|'))
    setAgentRunRecords((current) => {
      const next = current.filter((run) => !discardedIds.has(run.id))
      return next.length === current.length ? current : next
    })
    setRestoredAgentRunIds((current) => {
      const next = new Set([...current].filter((id) => !discardedIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [discardedRestoredRunIdSignal])
  React.useEffect(() => {
    const entries = agentRuns.flatMap((run) => {
      const promptText = run.prompt?.trim()
      if (!promptText) return []
      return collectAgentOutputMedia(
        run.output,
        formatModelKindLabel(tool.modelKind),
        getToolOutputFallbackKind(tool),
      ).map((media) => ({
        prompt: promptText,
        url: media.storageObjectId ? `storage://${media.storageObjectId}` : media.url,
      }))
    })
    cacheToolOutputPrompts(entries)
  }, [agentRuns, tool.modelKind])
  const completedRunSignal = React.useMemo(() => (
    reconciledAgentRunRecords
      .flatMap((run, index) => (
        run.launch?.agent_id && agentStatusById.get(run.launch.agent_id)?.data?.deliveryStatus !== 'payment_review'
          && (
            isRecentWorkflowHandoffTerminalStatus(agentStatusById.get(run.launch.agent_id)?.data?.status)
            // LAT-01: committed output is shown while the finance settlement is still closing.
            || agentStatusById.get(run.launch.agent_id)?.data?.outputReady === true
          )
          ? [run.launch.agent_id]
          : []
      ))
      .sort()
      .join('|')
  ), [agentStatusById, reconciledAgentRunRecords])
  React.useEffect(() => {
    agentFinalHandoffPollStartedAtRef.current.clear()
    recentWorkflowRefreshGenerationRef.current += 1
    recentWorkflowRefreshPendingRef.current.clear()
    recentWorkflowRefreshAcknowledgedRef.current.clear()
    recentWorkflowRefreshAttemptRef.current.clear()
    setRecentWorkflowHandoffFailedAgentIds([])
    if (recentWorkflowRefreshTimerRef.current !== null) {
      window.clearTimeout(recentWorkflowRefreshTimerRef.current)
      recentWorkflowRefreshTimerRef.current = null
    }
  }, [agentRunSessionKey])

  React.useEffect(() => {
    if (!recentWorkflowEnabled || !activeChannelId || !recentWorkflowNodeType || !completedRunSignal) return
    for (const agentId of completedRunSignal.split('|')) {
      if (agentId && !recentWorkflowRefreshAcknowledgedRef.current.has(agentId)) {
        recentWorkflowRefreshPendingRef.current.add(agentId)
      }
    }

    const generation = recentWorkflowRefreshGenerationRef.current
    const flushPendingCompletions = async () => {
      if (
        recentWorkflowRefreshGenerationRef.current !== generation
        || recentWorkflowRefreshInFlightRef.current === generation
        || recentWorkflowRefreshPendingRef.current.size === 0
      ) return

      const attemptedAgentIds = [...recentWorkflowRefreshPendingRef.current]
      let retryDelayMs: number | null = null
      const retainForRetry = (agentId: string) => {
        const attempt = (recentWorkflowRefreshAttemptRef.current.get(agentId) ?? 0) + 1
        recentWorkflowRefreshAttemptRef.current.set(agentId, attempt)
        const delay = getRecentWorkflowHandoffRetryDelay(attempt)
        if (delay === null) return false
        retryDelayMs = retryDelayMs === null ? delay : Math.min(retryDelayMs, delay)
        return true
      }

      recentWorkflowRefreshInFlightRef.current = generation
      try {
        await queryClient.cancelQueries({ queryKey: recentWorkflowOutputsQueryKey, exact: true })
        const firstPage = await listRecentWorkflowOutputs({
          channelId: activeChannelId,
          nodeType: recentWorkflowNodeType,
          kind: recentWorkflowKind,
          limit: TOOL_RECENT_OUTPUT_PAGE_SIZE,
          cursor: null,
        })
        if (recentWorkflowRefreshGenerationRef.current !== generation) return

        queryClient.setQueryData<InfiniteData<RecentWorkflowOutputsResult, string | null>>(
          recentWorkflowOutputsQueryKey,
          (current) => mergeRecentWorkflowOutputFirstPage(current, firstPage),
        )
        const readyAgentIds = new Set(firstPage.items.flatMap((item) => (
          item.agentId && isRecentWorkflowOutputReadyForRunHandoff(item, recentWorkflowKind)
            ? [item.agentId]
            : []
        )))
        const exhaustedAgentIds: string[] = []
        for (const agentId of attemptedAgentIds) {
          if (readyAgentIds.has(agentId)) {
            recentWorkflowRefreshPendingRef.current.delete(agentId)
            recentWorkflowRefreshAcknowledgedRef.current.add(agentId)
            recentWorkflowRefreshAttemptRef.current.delete(agentId)
          } else if (!retainForRetry(agentId)) {
            recentWorkflowRefreshPendingRef.current.delete(agentId)
            recentWorkflowRefreshAcknowledgedRef.current.add(agentId)
            recentWorkflowRefreshAttemptRef.current.delete(agentId)
            exhaustedAgentIds.push(agentId)
          }
        }
        for (const agentId of [...recentWorkflowRefreshPendingRef.current]) {
          if (!readyAgentIds.has(agentId)) continue
          recentWorkflowRefreshPendingRef.current.delete(agentId)
          recentWorkflowRefreshAcknowledgedRef.current.add(agentId)
          recentWorkflowRefreshAttemptRef.current.delete(agentId)
        }
        setRecentWorkflowHandoffFailedAgentIds((current) => {
          const next = new Set(current.filter((agentId) => !readyAgentIds.has(agentId)))
          exhaustedAgentIds.forEach((agentId) => next.add(agentId))
          return [...next]
        })
      } catch (error) {
        if (recentWorkflowRefreshGenerationRef.current === generation) {
          const failedAgentIds: string[] = []
          const retryable = isRetryableWorkflowRequestError(error)
          for (const agentId of attemptedAgentIds) {
            if (retryable && retainForRetry(agentId)) continue
            recentWorkflowRefreshPendingRef.current.delete(agentId)
            recentWorkflowRefreshAcknowledgedRef.current.add(agentId)
            recentWorkflowRefreshAttemptRef.current.delete(agentId)
            failedAgentIds.push(agentId)
          }
          if (failedAgentIds.length > 0) {
            setRecentWorkflowHandoffFailedAgentIds((current) => [
              ...new Set([...current, ...failedAgentIds]),
            ])
          }
        }
      } finally {
        if (recentWorkflowRefreshInFlightRef.current === generation) {
          recentWorkflowRefreshInFlightRef.current = null
        }
        if (
          recentWorkflowRefreshGenerationRef.current === generation
          && recentWorkflowRefreshPendingRef.current.size > 0
          && recentWorkflowRefreshTimerRef.current === null
        ) {
          recentWorkflowRefreshTimerRef.current = window.setTimeout(() => {
            recentWorkflowRefreshTimerRef.current = null
            void flushPendingCompletions()
          }, retryDelayMs ?? TOOL_RECENT_OUTPUT_COMPLETION_BATCH_MS)
        }
      }
    }

    if (
      recentWorkflowRefreshInFlightRef.current !== generation
      && recentWorkflowRefreshTimerRef.current === null
    ) {
      recentWorkflowRefreshTimerRef.current = window.setTimeout(() => {
        recentWorkflowRefreshTimerRef.current = null
        void flushPendingCompletions()
      }, TOOL_RECENT_OUTPUT_COMPLETION_BATCH_MS)
    }
    return () => {
      if (recentWorkflowRefreshTimerRef.current !== null) {
        window.clearTimeout(recentWorkflowRefreshTimerRef.current)
        recentWorkflowRefreshTimerRef.current = null
      }
    }
  }, [
    activeChannelId,
    completedRunSignal,
    queryClient,
    recentWorkflowEnabled,
    recentWorkflowKind,
    recentWorkflowManualRetryNonce,
    recentWorkflowNodeType,
    recentWorkflowOutputsQueryKey,
  ])

  const completedVoiceCloneRefreshRef = React.useRef('')
  React.useEffect(() => {
    if (
      !instantVoiceCloneRun
      || !activeChannelId
      || !completedRunSignal
      || completedVoiceCloneRefreshRef.current === completedRunSignal
    ) return
    completedVoiceCloneRefreshRef.current = completedRunSignal
    void queryClient.invalidateQueries({
      queryKey: voiceProfilesQueryKey({
        channelId: activeChannelId,
        origin: 'instant_clone',
      }),
    })
  }, [activeChannelId, completedRunSignal, instantVoiceCloneRun, queryClient])

  const handleLoadRecentWorkflowOutputs = React.useCallback(() => {
    if (recentWorkflowOutputsQuery.hasNextPage && !recentWorkflowOutputsQuery.isFetchingNextPage) {
      void recentWorkflowOutputsQuery.fetchNextPage()
    }
    if (textToolFastRunsQuery.hasNextPage && !textToolFastRunsQuery.isFetchingNextPage) {
      void textToolFastRunsQuery.fetchNextPage()
    }
  }, [recentWorkflowOutputsQuery, textToolFastRunsQuery])

  const recentOutputInitialSnapshotPending = Boolean(
    (recentWorkflowNodeType || textToolFastRunsEnabled)
    && (
      activeChannelLoading
      || (
        recentWorkflowEnabled
        && (
          !recentWorkflowSnapshotReady
          || hydratedAgentRunSessionKey !== agentRunSessionKey
        )
      )
      // The server is the source of truth for fast-lane runs too: wait for their first page.
      || textToolFastRunsPending
    ),
  )
  const textToolFastRunsHasMore = textToolFastRunsEnabled && Boolean(textToolFastRunsQuery.hasNextPage)

  const recentWorkflowOutputState = React.useMemo<ToolRecentWorkflowOutputState>(() => ({
    items: recentWorkflowItems,
    loading: (recentWorkflowOutputsQuery.isLoading || textToolFastRunsQuery.isLoading || recentOutputInitialSnapshotPending)
      && recentWorkflowItems.length === 0,
    initialSnapshotPending: recentOutputInitialSnapshotPending,
    refreshing: (recentWorkflowOutputsQuery.isRefetching && !recentWorkflowOutputsQuery.isFetchingNextPage)
      || (textToolFastRunsQuery.isRefetching && !textToolFastRunsQuery.isFetchingNextPage),
    loadingMore: recentWorkflowOutputsQuery.isFetchingNextPage || textToolFastRunsQuery.isFetchingNextPage,
    hasMore: Boolean(recentWorkflowOutputsQuery.hasNextPage) || textToolFastRunsHasMore,
    errorMessage: getErrorMessage(recentWorkflowOutputsQuery.error),
    onLoadMore: handleLoadRecentWorkflowOutputs,
  }), [
    handleLoadRecentWorkflowOutputs,
    recentWorkflowItems,
    recentWorkflowOutputsQuery.error,
    recentWorkflowOutputsQuery.hasNextPage,
    recentWorkflowOutputsQuery.isFetchingNextPage,
    recentWorkflowOutputsQuery.isLoading,
    recentWorkflowOutputsQuery.isRefetching,
    recentOutputInitialSnapshotPending,
    textToolFastRunsHasMore,
    textToolFastRunsQuery.isFetchingNextPage,
    textToolFastRunsQuery.isLoading,
    textToolFastRunsQuery.isRefetching,
  ])

  React.useEffect(() => () => {
    generateSubmissionLockRef.current = false
    recentWorkflowRefreshGenerationRef.current += 1
    recentWorkflowRefreshPendingRef.current.clear()
    recentWorkflowRefreshAttemptRef.current.clear()
    if (generateCooldownTimerRef.current !== null) {
      window.clearTimeout(generateCooldownTimerRef.current)
    }
    if (recentWorkflowRefreshTimerRef.current !== null) {
      window.clearTimeout(recentWorkflowRefreshTimerRef.current)
    }
  }, [])

  const generationBlocked = launchAgentMutation.isPending
    || generateCooldownActive

  const handleGenerate = React.useCallback(() => {
    const now = Date.now()
    if (isMediaDownloaderToolConfig(tool) && !mediaDownloaderQuote.canLaunch) return
    if (!activeChannelId || generateSubmissionLockRef.current || generateDisabledReason || shouldBlockToolGenerate({
      mutationPending: launchAgentMutation.isPending,
      cooldownActive: generateCooldownActive,
      lastGenerateAtMs: lastGenerateAtRef.current,
      nowMs: now,
    })) return
    // React state updates are asynchronous. This ref closes the same-tick gap
    // so a rapid double click cannot create a second paid run/idempotency key.
    generateSubmissionLockRef.current = true
    lastGenerateAtRef.current = now
    setGenerateCooldownActive(true)
    if (generateCooldownTimerRef.current !== null) {
      window.clearTimeout(generateCooldownTimerRef.current)
    }
    generateCooldownTimerRef.current = window.setTimeout(() => {
      generateSubmissionLockRef.current = false
      setGenerateCooldownActive(false)
      generateCooldownTimerRef.current = null
    }, TOOL_GENERATE_COOLDOWN_MS)
    const attempt = getOrCreateToolLaunchAttempt({
      channelId: activeChannelId,
      toolId: tool.id,
      nodeType: discoveryTool.execution.node_type,
      params: agentParams,
      selfAttestationAccepted: voiceCloneSelfAttestationAccepted,
    }, () => createWorkflowActionIdempotencyKey('tool-agent'))
    const idempotencyKey = attempt.idempotencyKey
    const runId = `tool-run:${idempotencyKey}`
    const estimate = isMediaDownloaderToolConfig(tool)
      ? mediaDownloaderQuote.displayedCredits
      : resolveDisplayedToolCredits(
        tool,
        localEstimatedCredits,
        agentEstimateQuery.data?.total_credits_estimated ?? null,
      )
    const mediaDownloaderSubmission = isMediaDownloaderToolConfig(tool)
      ? createMediaDownloaderSubmission({
          idempotencyKey,
          nodeType: discoveryTool.execution.node_type,
          params: agentParams,
        })
      : null
    const nextRun: ToolAgentRunRecord = {
      id: runId,
      idempotencyKey,
      estimate: agentEstimateQuery.data ?? null,
      launch: null,
      prompt: prompt.trim(),
      modelLabel: selectedModel?.label ?? model,
      provider: selectedModel?.provider ?? 'Youtorch',
      sourceMedia: selectedStorageMediaWithPreview,
      sourceLinks: isMediaDownloaderToolConfig(tool)
        ? [mediaDownloaderSourceUrl].flatMap((sourceUrl) => {
          const normalized = normalizeMediaDownloaderSourceForSession(sourceUrl)
          return normalized ? [normalized] : []
        })
        : [],
      captionPreview: isCaptionToolConfig(tool) ? buildCaptionRunPreview(schemaValues) : null,
      requestedAt: new Date().toISOString(),
      estimatedCredits: estimate,
      activityLabel: getToolRunActivityLabel(tool, agentParams),
      voiceProfileId: speechGenerateTool
        ? stringifySchemaValue(agentParams.voice_profile_id) || DEFAULT_VOICE_PROFILE_ID
        : null,
      mediaDownloaderSubmission,
      loading: true,
      errorMessage: null,
    }

    setAgentRunRecords((current) => {
      const next = [nextRun, ...current.filter((run) => run.id !== nextRun.id)].slice(0, 12)
      // Persist before the launch request completes so an immediate refresh
      // cannot make an accepted downloader submission appear to vanish.
      if (agentRunSessionKey) writeToolAgentRunSession(agentRunSessionKey, next)
      return next
    })
    launchAgentMutation.mutate({
      runId,
      idempotencyKey,
      draftHash: estimateParamsHash,
      channelId: activeChannelId,
      nodeType: discoveryTool.execution.node_type,
      params: agentParams,
      displayedEstimate: agentEstimateQuery.data ?? null,
      selfAttestationAccepted: voiceCloneSelfAttestationAccepted,
      attempt,
    })
  }, [
    activeChannelId,
    agentRunSessionKey,
    agentEstimateQuery.data,
    agentParams,
    discoveryTool.execution.node_type,
    estimateParamsHash,
    generateCooldownActive,
    generateDisabledReason,
    launchAgentMutation,
    localEstimatedCredits,
    mediaDownloaderQuote.canLaunch,
    mediaDownloaderQuote.displayedCredits,
    mediaDownloaderSourceUrl,
    model,
    prompt,
    selectedModel?.label,
    selectedModel?.provider,
    selectedStorageMediaWithPreview,
    speechGenerateTool,
    schemaValues,
    tool,
    voiceCloneSelfAttestationAccepted,
  ])

  const handleReset = resetInputDraft

  return (
    <div className="tools-studio hg-scrollbar h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-6 pl-4 pr-4 py-6 md:pl-6 md:pr-8 md:py-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <ToolInputPanel
          tool={tool}
          modeOptions={modeOptions}
          mode={mode}
          onModeChange={setMode}
          prompt={prompt}
          onPromptChange={setPrompt}
          models={models}
          selectedModelId={model}
          onModelChange={setModel}
          duration={duration}
          onDurationChange={setDuration}
          durationOptions={effectiveDurationOptions}
          resolution={resolution}
          onResolutionChange={setResolution}
          resolutionOptions={effectiveResolutionOptions}
          ratio={ratio}
          onRatioChange={setRatio}
          ratioOptions={effectiveRatioOptions}
          motion={motion}
          onMotionChange={setMotion}
          seed={seed}
          onSeedChange={setSeed}
          onRandomizeSeed={randomizeSeed}
          audio={audio}
          onAudioChange={setAudio}
          discoveryTool={discoveryTool}
          selectedDiscoveryModel={selectedDiscoveryModel}
          activeChannelId={activeChannelId}
          standardFields={toolStandardFields}
          schemaValues={schemaValues}
          sourceMedia={selectedStorageMediaWithPreview}
          mediaDownloaderQuote={mediaDownloaderQuote}
          viralClipsEstimateState={viralClipsEstimateState}
          onSchemaValueChange={handleSchemaValueChange}
          onStorageMediaSelectionChange={setSelectedStorageMedia}
          onSourceImageUploadStateChange={handleSourceImageUploadStateChange}
          onReset={handleReset}
          onGenerate={handleGenerate}
          generating={generationBlocked}
          creditLabel={creditLabel}
          creditPending={creditPending}
          unavailableReason={generateDisabledReason}
        />
        <div className="min-w-0 space-y-3">
          <TenantNodeQueueSummary status={agentStatusQueries.find((query) => hasTenantNodeQueue(query.data))?.data} />
          <ProviderBusyQueueNotice status={agentStatusQueries.find((query) => hasProviderBusyQueue(query.data))?.data} />
          <ToolAdmissionSummary runs={agentRuns} />
          <ToolOutputPanel
            tool={tool}
            angleTool={isAngleToolCatalogItem(discoveryTool)}
            speechGenerate={speechGenerateTool}
            channelId={activeChannelId}
            agentRuns={agentRuns}
            recentWorkflowOutputs={recentWorkflowOutputState}
            sourcePreview={(isMediaTransformInputContract(discoveryTool.input_contract)
              || isFrameExtractTool(tool, discoveryTool.input_contract)
              || isMagicClipsTool(tool, discoveryTool.input_contract))
              ? selectedStorageMediaWithPreview
              : null}
            captionPreview={isCaptionToolConfig(tool) ? {
              media: selectedStorageMediaWithPreview,
              ...buildCaptionRunPreview(schemaValues),
            } : undefined}
          />
        </div>
      </div>
    </div>
  )
}

function ToolRunnerCatalogState({
  toolId,
  loading,
}: {
  toolId: ToolId
  loading: boolean
}) {
  const tAuto = useTranslations('Auto')
  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label={tAuto('loading_tool_8f189cfe')}
        className="tools-studio flex h-full min-h-full items-center justify-center bg-background px-6 text-foreground"
      >
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="tools-studio flex min-h-[640px] items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-[6px] border border-dashed border-border p-8 text-center dark:border-white/[0.11]">
        <Search className="mx-auto size-7 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold"><UiText id="tool_bulunamadi_61da9e6b" /></h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {tAuto('unavailable_tool', { tool: toolId })}
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/tools"><UiText id="araclara_don_195b13b2" /></Link>
        </Button>
      </div>
    </div>
  )
}

function ToolsCatalog({
  discoveryCatalog,
  catalogUnavailable = false,
  catalogRefreshing = false,
  onRetryCatalog,
}: {
  discoveryCatalog?: DiscoveryToolsCatalog
  catalogUnavailable?: boolean
  catalogRefreshing?: boolean
  onRetryCatalog?: () => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const searchParams = useSearchParams()
  const routeView = getCatalogViewId(searchParams.get('view'))
  const query = ''
  const [activeView, setActiveView] = React.useState<CatalogViewId>(routeView ?? 'trends')
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<WorkflowTemplateCard | null>(null)
  const [clonedWorkflowKey, setClonedWorkflowKey] = React.useState<string | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const activeViewConfig = catalogViews.find((view) => view.id === activeView) ?? catalogViews[0]!
  const isModelView = activeView === 'models'
  const isWorkflowView = activeView === 'workflows'
  const catalogToolIds = React.useMemo(() => getCatalogToolIds(discoveryCatalog), [discoveryCatalog])
  const catalogModelCards = React.useMemo(() => getCatalogModelCards(discoveryCatalog), [discoveryCatalog])
  const effectiveCatalogSections = React.useMemo(() => getCatalogSections(discoveryCatalog, activeView), [activeView, discoveryCatalog])
  const heroSlides = React.useMemo(
    () => getEffectiveCatalogHeroSlides(discoveryCatalog, activeView),
    [activeView, discoveryCatalog],
  )
  const [heroSlideIndexByView, setHeroSlideIndexByView] = React.useState<Record<CatalogViewId, number>>({
    trends: 0,
    models: 0,
    workflows: 0,
  })
  const [favoriteNodeTypes, setFavoriteNodeTypes] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [favoriteBusyNodeType, setFavoriteBusyNodeType] = React.useState<string | null>(null)
  const [favoriteError, setFavoriteError] = React.useState<string | null>(null)
  const [heroInteractionPaused, setHeroInteractionPaused] = React.useState(false)
  const [documentVisible, setDocumentVisible] = React.useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)
  const catalogLoading = !discoveryCatalog && !catalogUnavailable
  const heroPaused = heroInteractionPaused || !documentVisible || prefersReducedMotion

  React.useEffect(() => {
    if (routeView) setActiveView(routeView)
  }, [routeView])

  React.useEffect(() => {
    const controller = new AbortController()
    listWorkflowNodeFavoriteTypes({ signal: controller.signal })
      .then((nodeTypes) => {
        setFavoriteNodeTypes(new Set(nodeTypes))
        setFavoriteError(null)
      })
      .catch((error: unknown) => {
        if (isAbortLikeError(error)) return
        setFavoriteError(tAuto('favorite_tools_load_failed'))
      })
    return () => controller.abort()
  }, [tAuto])

  React.useEffect(() => {
    const syncVisibility = () => setDocumentVisible(!document.hidden)
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches)
    syncMotionPreference()
    mediaQuery.addEventListener('change', syncMotionPreference)
    return () => mediaQuery.removeEventListener('change', syncMotionPreference)
  }, [])

  const heroSlideIndex = heroSlideIndexByView[activeView] ?? 0
  const setActiveHeroSlideIndex = React.useCallback((nextIndex: number | ((current: number) => number)) => {
    setHeroSlideIndexByView((current) => {
      const previousIndex = current[activeView] ?? 0
      const resolvedIndex = typeof nextIndex === 'function' ? nextIndex(previousIndex) : nextIndex
      return { ...current, [activeView]: Math.max(0, resolvedIndex) }
    })
  }, [activeView])

  React.useEffect(() => {
    if (heroSlides.length === 0) return
    if (heroSlideIndex < heroSlides.length) return
    setActiveHeroSlideIndex(0)
  }, [heroSlideIndex, heroSlides.length, setActiveHeroSlideIndex])

  React.useEffect(() => {
    if (heroSlides.length <= 1 || heroPaused) return
    const activeSlide = heroSlides[heroSlideIndex % heroSlides.length]
    const timeout = window.setTimeout(() => {
      setActiveHeroSlideIndex((current) => (current + 1) % heroSlides.length)
    }, activeSlide?.durationMs ?? 6000)
    return () => window.clearTimeout(timeout)
  }, [heroPaused, heroSlideIndex, heroSlides, setActiveHeroSlideIndex])

  const refinedToolIds = React.useMemo(() => {
    return catalogToolIds.filter((toolId) => {
      const discoveryTool = getDiscoveryTool(discoveryCatalog, toolId)
      if (!discoveryTool) return false
      const tool = getEffectiveToolConfig(toolId, discoveryTool)
      const meta = getEffectiveToolCatalogMeta(toolId, discoveryTool)
      const queryMatches =
        !normalizedQuery
        || [
          tool.title,
          tool.shortTitle,
          tool.description,
          meta.description,
          meta.creator,
          meta.category,
          ...meta.models,
          ...meta.tags,
          discoveryTool.execution.node_type,
        ].join(' ').toLowerCase().includes(normalizedQuery)

      return queryMatches
    })
  }, [catalogToolIds, discoveryCatalog, normalizedQuery])
  const refinedModelCards = React.useMemo(() => {
    if (!normalizedQuery) return catalogModelCards

    return catalogModelCards.filter((model) => {
      return [
        model.name,
        model.provider,
        model.description,
        model.toolShortTitle,
        ...model.tags,
      ].join(' ').toLowerCase().includes(normalizedQuery)
    })
  }, [catalogModelCards, normalizedQuery])
  const refinedWorkflowCards = React.useMemo(() => {
    const availableWorkflows = getWorkflowTemplateCards(discoveryCatalog)
      .filter((workflow) => {
        const discoveryTool = getDiscoveryTool(discoveryCatalog, workflow.toolId)
        return discoveryTool && discoveryTool.status !== 'disabled'
      })
    if (!normalizedQuery) return availableWorkflows

    return availableWorkflows.filter((workflow) => {
      const discoveryTool = getDiscoveryTool(discoveryCatalog, workflow.toolId)
      const toolText = discoveryTool ? [
        discoveryTool.title,
        discoveryTool.short_title,
        discoveryTool.description,
        discoveryTool.category,
        discoveryTool.execution.node_type,
      ] : []

      return [
        workflow.title,
        workflow.category,
        workflow.description,
        workflow.estimatedCost,
        ...workflow.steps,
        ...workflow.examples,
        ...workflow.nodes,
        ...toolText,
      ].join(' ').toLowerCase().includes(normalizedQuery)
    })
  }, [discoveryCatalog, normalizedQuery])
  const trendWorkflowCards = React.useMemo(() => {
    const topPicks = refinedWorkflowCards.filter((workflow) => workflow.category === 'Top picks')
    return (topPicks.length > 0 ? topPicks : refinedWorkflowCards).slice(0, 4)
  }, [refinedWorkflowCards])
  const favoriteToolIds = React.useMemo(() => {
    if (!discoveryCatalog || favoriteNodeTypes.size === 0) return []
    return discoveryCatalog.tools
      .filter((tool) => tool.status !== 'disabled')
      .filter((tool) => favoriteNodeTypes.has(tool.execution.node_type.trim()))
      .sort((left, right) => {
        const orderDelta = left.ui.sort_order - right.ui.sort_order
        if (orderDelta !== 0) return orderDelta
        return left.title.localeCompare(right.title)
      })
      .map((tool) => tool.tool_id.trim())
      .filter(Boolean)
  }, [discoveryCatalog, favoriteNodeTypes])
  const hasRefinement = normalizedQuery.length > 0
  const primaryCatalogToolId = catalogToolIds[0]
  const activeHeroSlide = heroSlides.length > 0 ? heroSlides[heroSlideIndex % heroSlides.length] : null
  const heroBadge = activeHeroSlide?.badge || 'Youtorch Tool Deck'
  const heroTitle = activeHeroSlide?.title || activeViewConfig.title
  const heroDescription = activeHeroSlide?.subtitle || activeViewConfig.description
  const primaryHeroCtaHref = activeHeroSlide
    ? normalizeDiscoveryCtaHref(activeHeroSlide.ctaHref)
    : primaryCatalogToolId ? getToolHref(primaryCatalogToolId) : null
  const primaryHeroCtaLabel = activeHeroSlide
    ? (activeHeroSlide.ctaLabel || 'Daha fazla bilgi al')
    : activeViewConfig.ctaLabel
  const secondaryHeroCtaHref = normalizeDiscoveryCtaHref(activeHeroSlide?.secondaryCtaHref)
  const secondaryHeroCtaLabel = activeHeroSlide?.secondaryCtaLabel || 'Detaylar'
  const heroScrimStyle = activeHeroSlide ? { background: buildHeroScrimBackground(activeHeroSlide) } : undefined
  const primaryHeroButtonStyle = activeHeroSlide ? buildHeroButtonStyle(activeHeroSlide) : undefined
  const showHeroLoading = catalogLoading && heroSlides.length === 0
  const toggleFavorite = React.useCallback(async (nodeType: string, favorite: boolean) => {
    const previous = favoriteNodeTypes
    const optimistic = new Set(previous)
    if (favorite) {
      optimistic.add(nodeType)
    } else {
      optimistic.delete(nodeType)
    }
    setFavoriteNodeTypes(optimistic)
    setFavoriteBusyNodeType(nodeType)
    setFavoriteError(null)

    try {
      const nodeTypes = await setWorkflowNodeFavorite(nodeType, favorite)
      setFavoriteNodeTypes(new Set(nodeTypes))
    } catch {
      setFavoriteNodeTypes(previous)
      setFavoriteError(favorite ? tAuto('favorite_tool_save_failed') : tAuto('favorite_tool_remove_failed'))
    } finally {
      setFavoriteBusyNodeType((current) => current === nodeType ? null : current)
    }
  }, [favoriteNodeTypes, tAuto])
  const favoriteControls = React.useMemo<ToolFavoriteControls>(() => ({
    favoriteNodeTypes,
    favoriteBusyNodeType,
    onToggleFavorite: toggleFavorite,
  }), [favoriteBusyNodeType, favoriteNodeTypes, toggleFavorite])

  return (
    <div className="tools-studio hg-scrollbar relative min-h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-[1200px] flex-col px-4 py-6 md:px-8 md:py-8">
        <section className="mb-5 flex w-fit items-center gap-1 rounded-xl border border-border bg-panel/40 p-1">
          {catalogViews.map((view) => {
            const active = view.id === activeView

            return (
              <button
                key={view.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveView(view.id)}
                className={cn(
                  'shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {toolCopy(view.label)}
              </button>
            )
          })}
        </section>

        <section
          className="relative mb-8 min-h-[240px] overflow-hidden rounded-3xl border border-border bg-card md:min-h-[280px]"
          aria-roledescription="carousel"
          aria-label={tAuto('youtorch_arac_vitrini_483875e2')}
          onMouseEnter={() => setHeroInteractionPaused(true)}
          onMouseLeave={() => setHeroInteractionPaused(false)}
          onFocusCapture={() => setHeroInteractionPaused(true)}
          onBlurCapture={(event) => {
            const nextFocus = event.relatedTarget
            if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) {
              setHeroInteractionPaused(false)
            }
          }}
        >
          {heroSlides.length > 0 ? (
            <ToolHeroMediaBackdrop
              slides={heroSlides}
              activeIndex={heroSlideIndex}
              playing={!heroPaused}
            />
          ) : (
            <ToolHeroBackdrop
              spotlightToolIds={catalogToolIds}
              discoveryCatalog={discoveryCatalog}
            />
          )}
          <div className="tools-hero-scrim absolute inset-0" style={heroScrimStyle} />
          <div className="relative z-10 flex min-h-[240px] max-w-[780px] flex-col justify-center p-6 md:min-h-[280px] md:p-10">
            {showHeroLoading ? (
              <HeroLoadingState />
            ) : (
              <>
                <Badge variant="outline" className="w-fit rounded-md border-0 bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                  {toolCopy(heroBadge)}
                </Badge>
                <h1 className="mt-4 max-w-2xl text-balance font-display text-3xl leading-[1.03] text-foreground md:text-5xl">
                  {toolCopy(heroTitle)}
                </h1>
                <p className="mt-3 max-w-md text-pretty text-sm text-muted-foreground md:text-base">
                  {toolCopy(heroDescription)}
                </p>

                {(primaryHeroCtaHref || secondaryHeroCtaHref) ? (
                  <div className="mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row">
                    {primaryHeroCtaHref ? (
                      <Link
                        href={primaryHeroCtaHref}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={primaryHeroButtonStyle}
                      >
                        {toolCopy(primaryHeroCtaLabel)}
                        <ArrowRight className="size-4" />
                      </Link>
                    ) : null}
                    {secondaryHeroCtaHref ? (
                      <Link
                        href={secondaryHeroCtaHref}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-panel/60 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {toolCopy(secondaryHeroCtaLabel)}
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
          {heroSlides.length > 1 && !showHeroLoading ? (
            <HeroSlideControls
              slides={heroSlides}
              activeIndex={heroSlideIndex}
              onSelect={setActiveHeroSlideIndex}
            />
          ) : null}
        </section>

        {catalogUnavailable ? (
          <section
            role="alert"
            className="mb-8 flex flex-col gap-3 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:text-amber-100"
          >
            <div>
              <p className="font-semibold"><UiText id="arac_vitrini_su_anda_yenilenemiyor_758af45c" /></p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-100/70"><UiText id="baglant_geri_geldiginde_admin_taraf_ndan_yonetil_47244d49" /></p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onRetryCatalog} disabled={catalogRefreshing}>
              <RefreshCw className={cn('size-4', catalogRefreshing && 'animate-spin')} />
              <UiText id="yeniden_dene_7ba41f54" /></Button>
          </section>
        ) : null}

        {catalogLoading ? (
          <ToolCatalogLoadingGrid />
        ) : isModelView ? (
          <div className="space-y-8">
            <SpotlightStrip
              variant="models"
              title={tAuto('son_cikan_modeller_b974a3b1')}
              subtitle={tAuto('catalog_model_spotlight_subtitle')}
              models={refinedModelCards}
              showViewAll={false}
              emptyTitle="Model not found"
            />
            {effectiveCatalogSections.map((section) => (
              <ToolCatalogShelf
                key={section.id}
                title={toolCopy(section.title)}
                subtitle={toolCopy(section.subtitle)}
                toolIds={section.toolIds}
                discoveryCatalog={discoveryCatalog}
                favoriteControls={favoriteControls}
              />
            ))}
          </div>
        ) : isWorkflowView ? (
          <div className="space-y-8">
            {favoriteToolIds.length > 0 ? (
              <ToolCatalogShelf
                title={tAuto('favori_workflow_araclari_5118b66d')}
                subtitle={tAuto('catalog_favorite_workflow_subtitle')}
                toolIds={favoriteToolIds}
                discoveryCatalog={discoveryCatalog}
                favoriteControls={favoriteControls}
              />
            ) : null}
            <SpotlightStrip
              variant="workflows"
              title={tAuto('trend_workflowlar_f8657975')}
              subtitle={tAuto('catalog_trending_workflow_subtitle')}
              workflows={trendWorkflowCards}
              showViewAll={false}
              onOpenWorkflow={setSelectedWorkflow}
              emptyTitle="Workflow not found"
            />
            {effectiveCatalogSections.map((section) => (
              <ToolCatalogShelf
                key={section.id}
                title={toolCopy(section.title)}
                subtitle={toolCopy(section.subtitle)}
                toolIds={section.toolIds}
                discoveryCatalog={discoveryCatalog}
                favoriteControls={favoriteControls}
              />
            ))}
            <WorkflowGallery
              workflows={refinedWorkflowCards}
              onOpenWorkflow={setSelectedWorkflow}
            />
          </div>
        ) : (
          <>
            {hasRefinement ? (
              <ToolCatalogGrid
                toolIds={refinedToolIds}
                discoveryCatalog={discoveryCatalog}
                favoriteControls={favoriteControls}
              />
            ) : effectiveCatalogSections.length > 0 ? (
              <div className="space-y-8">
                {effectiveCatalogSections.map((section) => (
                <ToolCatalogShelf
                  key={section.id}
                  title={toolCopy(section.title)}
                  subtitle={toolCopy(section.subtitle)}
                  toolIds={section.toolIds}
                  discoveryCatalog={discoveryCatalog}
                  favoriteControls={favoriteControls}
                />
                ))}
              </div>
            ) : (
              <ToolCatalogGrid
                toolIds={[]}
                discoveryCatalog={discoveryCatalog}
                favoriteControls={favoriteControls}
              />
            )}
            {favoriteError ? (
              <p className="-mt-3 text-xs font-medium text-destructive" role="status">
                {favoriteError}
              </p>
            ) : null}
          </>
        )}
        {!catalogLoading && (isModelView || isWorkflowView) && favoriteError ? (
          <p className="-mt-3 text-xs font-medium text-destructive" role="status">
            {favoriteError}
          </p>
        ) : null}
      </div>
      <WorkflowDetailsDialog
        workflow={selectedWorkflow}
        discoveryCatalog={discoveryCatalog}
        clonedWorkflowKey={clonedWorkflowKey}
        onClone={(workflow) => setClonedWorkflowKey(workflow.templateKey)}
        onOpenChange={(open) => {
          if (!open) setSelectedWorkflow(null)
        }}
      />
    </div>
  )
}

function SpotlightStrip({
  variant,
  title,
  subtitle,
  models = [],
  workflows = [],
  showViewAll,
  onOpenWorkflow,
  emptyTitle,
  emptyDescription,
}: {
  variant: 'models' | 'workflows'
  title: string
  subtitle: string
  models?: SpotlightModelCardData[]
  workflows?: typeof workflowSpotlightCards
  showViewAll?: boolean
  onOpenWorkflow?: (workflow: WorkflowTemplateCard) => void
  emptyTitle?: string
  emptyDescription?: string
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const railRef = React.useRef<HTMLDivElement>(null)
  const [page, setPage] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(1)
  const isModels = variant === 'models'
  const itemCount = isModels ? models.length : workflows.length

  const syncPage = React.useCallback(() => {
    const rail = railRef.current
    if (!rail) return

    const visibleWidth = Math.max(1, rail.clientWidth)
    const nextPageCount = Math.max(1, Math.ceil(rail.scrollWidth / visibleWidth))
    const nextPage = Math.min(
      nextPageCount - 1,
      Math.max(0, Math.round(rail.scrollLeft / visibleWidth)),
    )

    setPage(nextPage)
    setPageCount(nextPageCount)
  }, [])

  React.useEffect(() => {
    setPage(0)
    const rail = railRef.current
    if (rail) rail.scrollTo({ left: 0 })
    window.requestAnimationFrame(syncPage)
  }, [itemCount, syncPage, variant])

  React.useEffect(() => {
    syncPage()
    const rail = railRef.current
    if (!rail) return

    rail.addEventListener('scroll', syncPage, { passive: true })
    window.addEventListener('resize', syncPage)
    return () => {
      rail.removeEventListener('scroll', syncPage)
      window.removeEventListener('resize', syncPage)
    }
  }, [itemCount, syncPage])

  const goToPage = React.useCallback((nextPage: number) => {
    const rail = railRef.current
    if (!rail) return

    const targetPage = Math.min(pageCount - 1, Math.max(0, nextPage))
    rail.scrollTo({
      left: targetPage * rail.clientWidth,
      behavior: 'smooth',
    })
    setPage(targetPage)
  }, [pageCount])
  const canPage = itemCount > 0 && pageCount > 1

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-normal text-foreground">{toolCopy(title)}</h2>
          {isModels ? <p className="mt-1 text-sm text-muted-foreground">{toolCopy(subtitle)}</p> : null}
        </div>
        <div className="flex shrink-0 items-center">
          {showViewAll ? (
            <Link
              href="/tools?view=workflows"
              className="inline-flex h-9 items-center rounded-[5px] border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:border-white/[0.09] dark:hover:border-white/[0.18]"
            >
              <UiText id="tumunu_gor_9f232b78" /></Link>
          ) : null}
        </div>
      </div>
      {itemCount === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-[6px] border border-dashed border-border px-6 text-center dark:border-white/[0.11]">
          <Search className="size-7 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold text-foreground">{emptyTitle ? toolCopy(emptyTitle) : tAuto('no_results_found')}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {emptyDescription ? toolCopy(emptyDescription) : tAuto('try_another_keyword')}
          </p>
        </div>
      ) : (
        isModels ? (
          <div className="group/spotlight relative">
            {canPage ? (
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page === 0}
                className="absolute left-0 top-1/2 z-10 hidden h-14 w-8 -translate-y-1/2 items-center justify-center text-white/58 opacity-0 transition-all hover:text-cyan-100 group-hover/spotlight:opacity-100 disabled:pointer-events-none disabled:opacity-0 md:flex lg:left-1"
                aria-label={tAuto('previous_page_for', { title: toolCopy(title) })}
              >
                <ChevronLeft className="size-7 stroke-[2.4]" />
              </button>
            ) : null}
            <div
              ref={railRef}
              className="tools-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
            >
              {models.map((model) => (
                <SpotlightModelCard key={model.id} model={model} />
              ))}
            </div>
            {canPage ? (
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= pageCount - 1}
                className="absolute right-0 top-1/2 z-10 hidden h-14 w-8 -translate-y-1/2 items-center justify-center text-white/58 opacity-0 transition-all hover:text-cyan-100 group-hover/spotlight:opacity-100 disabled:pointer-events-none disabled:opacity-0 md:flex lg:right-1"
                aria-label={tAuto('next_page_for', { title: toolCopy(title) })}
              >
                <ChevronRight className="size-7 stroke-[2.4]" />
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workflows.map((workflow) => (
              <SpotlightWorkflowCard
                key={workflow.templateKey}
                workflow={workflow}
                onOpen={() => onOpenWorkflow?.(workflow)}
              />
            ))}
          </div>
        )
      )}
    </section>
  )
}

function WorkflowGallery({
  workflows,
  onOpenWorkflow,
}: {
  workflows: WorkflowTemplateCard[]
  onOpenWorkflow: (workflow: WorkflowTemplateCard) => void
}) {
  const groupedWorkflows = workflowCategories
    .map((category) => ({
      category,
      workflows: workflows.filter((workflow) => workflow.category === category),
    }))
    .filter((group) => group.workflows.length > 0)

  if (workflows.length === 0) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-[6px] border border-dashed border-white/[0.11] px-6 text-center">
        <Search className="size-7 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold text-foreground"><UiText id="workflow_bulunamadi_f79f2afb" /></h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          <UiText id="baska_bir_workflow_kategori_veya_kullanim_tipi_a_490c3716" /></p>
      </div>
    )
  }

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-foreground"><UiText id="workflow_templates_8576443e" /></h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            <UiText id="hazir_akis_sec_detaylarini_incele_ve_ui_seviyesi_c788be66" /></p>
        </div>
        <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground dark:border-white/[0.09] dark:bg-white/[0.055]">
          {workflows.length} flow
        </span>
      </div>

      <div className="space-y-7">
        {groupedWorkflows.map((group) => (
          <section key={group.category} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-normal text-foreground">{group.category}</h3>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.workflows.map((workflow) => (
                <SpotlightWorkflowCard
                  key={workflow.templateKey}
                  workflow={workflow}
                  onOpen={() => onOpenWorkflow(workflow)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function WorkflowDetailsDialog({
  workflow,
  discoveryCatalog,
  clonedWorkflowKey,
  onClone,
  onOpenChange,
}: {
  workflow: WorkflowTemplateCard | null
  discoveryCatalog?: DiscoveryToolsCatalog
  clonedWorkflowKey: string | null
  onClone: (workflow: WorkflowTemplateCard) => void
  onOpenChange: (open: boolean) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const discoveryTool = workflow ? getDiscoveryTool(discoveryCatalog, workflow.toolId) : undefined
  const tool = workflow && discoveryTool ? getEffectiveToolConfig(workflow.toolId, discoveryTool) : null
  const coverImage = workflow?.foregroundImage ?? null
  const isCloned = Boolean(workflow && clonedWorkflowKey === workflow.templateKey)

  return (
    <Dialog open={Boolean(workflow)} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-hidden rounded-[10px] border-white/[0.1] bg-[#171717] p-0 text-white sm:max-w-[980px]"
        showCloseButton={false}
      >
        {workflow && tool ? (
          <>
            <DialogClose asChild>
              <button
                type="button"
                aria-label={tAuto('close_workflow_details_32f87688')}
                className="absolute right-4 top-4 z-40 flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/[0.14] bg-black/50 text-white/75 shadow-[0_12px_32px_rgba(0,0,0,0.34)] backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <X className="size-4" />
              </button>
            </DialogClose>
            <div className="tools-dialog-scrollbar grid max-h-[92vh] overflow-y-auto">
            <div className={cn('relative min-h-[260px] overflow-hidden bg-gradient-to-br', workflow.tone, 'md:min-h-[312px]')}>
              {workflow.previewVideo ? (
                <video
                  src={workflow.previewVideo}
                  poster={coverImage ?? undefined}
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : coverImage ? (
                <img
                  src={coverImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <WorkflowCanvasPreview workflow={workflow} />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.28)_100%)]" />
              <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70', workflow.tone)} />
            </div>

            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 max-w-2xl gap-4">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.12] bg-white/[0.08] text-white">
                    <WorkflowIcon className="size-7" />
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="text-3xl font-semibold leading-[1.06] tracking-normal text-white md:text-4xl">
                      {toolCopy(workflow.title)}
                    </DialogTitle>
                    <DialogDescription className="mt-3 max-w-2xl text-sm leading-6 text-white/68 md:text-base">
                      {toolCopy(workflow.description)}
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <button
                    type="button"
                    aria-label={tAuto('favorilere_ekle_360ac512')}
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-white/70 transition-colors hover:bg-white hover:text-black"
                  >
                    <Heart className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onClone(workflow)}
                    className={cn(
                      'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
                      isCloned
                        ? 'bg-white/[0.12] text-white/76'
                        : 'bg-white text-black hover:bg-cyan-100',
                    )}
                  >
                    {isCloned ? <Check className="size-4" /> : <Plus className="size-4" />}
                    {isCloned ? tAuto('cloned_36011bbd') : tAuto('clone_d8cdb573')}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-info/25 bg-info/15 px-5 text-sm font-semibold text-info transition-colors hover:bg-info hover:text-info-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/45"
                  >
                    <Play className="size-4 fill-current" />
                    <UiText id="playground_a68eb230" /></button>
                </div>
              </div>

              <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_330px]">
                <section className="min-w-0 space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/[0.075] px-3 py-1 text-xs font-semibold text-white/52">
                        {toolCopy(workflow.category)}
                      </span>
                      {workflow.coverType === 'video' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.075] px-3 py-1 text-xs font-semibold text-white/52">
                          <Play className="size-3.5 fill-white/52" />
                          <UiText id="video_ready_99cab3ce" /></span>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-normal text-white"><UiText id="workflow_overview_d5c6fd64" /></h3>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62 md:text-[15px]">
                        {toolCopy(getWorkflowPurpose(workflow))}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {workflow.steps.map((step, index) => (
                      <div key={step} className="flex items-center gap-3 rounded-[8px] bg-white/[0.045] px-3 py-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.1] text-xs font-semibold text-white/82">
                          {index + 1}
                        </span>
                        <span className="min-w-0 text-sm font-medium text-white/76">{toolCopy(step)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="space-y-4 rounded-[10px] bg-white/[0.045] p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[8px] bg-black/20 p-3">
                      <CircleDollarSign className="size-4 text-cyan-100/72" />
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-normal text-white/42">
                        <UiText id="estimated_cost_516cbee2" /></p>
                      <p className="mt-1 text-sm font-semibold text-white">{workflow.estimatedCost}</p>
                    </div>
                    <div className="rounded-[8px] bg-black/20 p-3">
                      <WorkflowIcon className="size-4 text-cyan-100/72" />
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-normal text-white/42">
                        <UiText id="used_nodes_18a0b135" /></p>
                      <p className="mt-1 text-sm font-semibold text-white">{workflow.nodes.length} nodes</p>
                    </div>
                    <div className="col-span-2 flex items-center justify-between rounded-[8px] bg-black/20 px-3 py-2.5 text-sm">
                      <span className="text-white/48"><UiText id="starter_tool_eaab190d" /></span>
                      <span className="font-semibold text-white/82">{tool.shortTitle}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white"><UiText id="nodes_in_this_flow_bb8b6cf7" /></h3>
                    <div className="space-y-1.5">
                      {workflow.nodes.map((node, index) => (
                        <div key={node} className="flex items-center gap-2 rounded-[7px] bg-black/18 px-3 py-2 text-sm text-white/70">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-[11px] font-semibold text-white/58">
                            {index + 1}
                          </span>
                          <span className="min-w-0 truncate">{node}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white"><UiText id="examples_eb01bf04" /></h3>
                    <div className="flex flex-wrap gap-2">
                      {workflow.examples.map((example) => (
                        <span
                          key={example}
                          className="rounded-full bg-black/22 px-3 py-1.5 text-xs font-semibold text-white/62"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>

                  {isCloned ? (
                    <p className="rounded-[8px] bg-success/10 px-3 py-2 text-xs font-medium text-success">
                      <UiText id="ui_state_workflow_my_workflows_alanina_eklendi_08892703" /></p>
                  ) : null}
                </aside>
              </div>

            </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function getWorkflowPurpose(workflow: WorkflowTemplateCard) {
  if (workflow.category === 'Faceless videos') {
    return 'Yuz veya kamera kullanmadan, konu fikrini sahne planina, ritme ve yayina hazir video taslagina cevirir. Evergreen kanal, liste icerigi ve hizli sosyal formatlar icin iyi bir baslangic verir.'
  }

  if (workflow.category === 'Repurpose') {
    return 'Var olan script, blog, not veya egitim icerigini daha kisa, izlenebilir ve platforma uygun bir video akisina donusturur. Elindeki icerigi yeniden paketlemek istediginde tercih edilir.'
  }

  if (workflow.title.toLowerCase().includes('ugc')) {
    return 'Urun briefini insan anlatimli reklam akisina cevirir. Hook, aktor yonlendirmesi, caption ve kisa video teslimini birlikte dusunerek performans odakli UGC taslagi baslatir.'
  }

  return 'Fikri tek tek arac secmeden, brief toplama, sahne kurma ve son taslak adimlarina boler. Hizli deneme yapmak, ekip icin net bir baslangic cikarmak veya ilk kreatif yonu gormek icin kullanilir.'
}

function SpotlightModelCard({
  model,
}: {
  model: SpotlightModelCardData
}) {
  const toolCopy = useToolCopy()
  const Icon = model.icon

  return (
    <Link
      href={model.href}
      className="group relative min-h-[150px] w-[min(340px,82vw)] shrink-0 snap-start overflow-hidden rounded-[6px] border border-border bg-card outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:w-[calc((100%_-_64px)/5)] dark:border-white/[0.085] dark:hover:border-cyan-200/[0.24]"
    >
      <img
        src={model.thumbnail}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-[0.72] saturate-[0.88] transition-transform duration-300 group-hover:scale-[1.018]"
        draggable={false}
      />
      <div className={cn('absolute inset-0 bg-gradient-to-r', model.tone)} />
      <div className="relative z-10 flex h-full min-h-[150px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-normal text-white/[0.62]">
              {model.provider}
            </span>
            <h3 className="mt-1 text-xl font-semibold leading-6 text-white">{model.name}</h3>
          </div>
          {model.badge ? (
            <span className="rounded-[5px] border border-white/[0.18] bg-white/[0.11] px-2 py-1 text-[11px] font-semibold text-white/86">
              {model.badge}
            </span>
          ) : null}
          <span
            className="relative isolate flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-black/10 ring-1 ring-white/10 dark:border-white/[0.12] dark:ring-black/20"
            style={getIconSurfaceStyle(model.iconBackground, model.iconForeground, parseSafeIconCss(model.iconCss))}
          >
            <span className="pointer-events-none absolute inset-px rounded-[6px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_48%)]" />
            {model.iconAssetUrl ? (
              <img
                src={model.iconAssetUrl}
                alt=""
                className="absolute inset-0 z-10 size-full object-cover"
                draggable={false}
              />
            ) : (
              <ToolIconGlyph
                shape={model.iconShape}
                Icon={Icon}
                className="relative z-10 size-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.28)]"
              />
            )}
          </span>
        </div>
        <div className="flex items-end justify-between gap-5">
          <p className="max-w-[360px] text-sm leading-5 text-white/[0.74]">{toolCopy(model.description)}</p>
          <span className="shrink-0 rounded-[5px] border border-white/[0.18] bg-white/[0.11] px-2.5 py-1 text-xs font-semibold text-white">
            {model.toolShortTitle}
          </span>
        </div>
      </div>
    </Link>
  )
}

function SpotlightWorkflowCard({
  workflow,
  onOpen,
}: {
  workflow: WorkflowTemplateCard
  onOpen: () => void
}) {
  const toolCopy = useToolCopy()
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative block h-[152px] w-full min-w-0 overflow-hidden rounded-[8px] border border-white/[0.12] bg-gradient-to-br text-left text-white outline-none saturate-[0.88] transition-[border-color,filter] hover:border-white/[0.28] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        workflow.tone,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.24)_36%,rgba(0,0,0,0.06)_72%,rgba(0,0,0,0)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.03)_44%,rgba(0,0,0,0.18)_100%)]" />
      <div className="absolute right-0 top-0 h-full w-[44%] translate-x-7 -skew-x-12 bg-white/[0.09]" />
      <WorkflowMiniCanvas nodes={workflow.nodes} />
      {workflow.foregroundImage ? (
        <img
          src={workflow.foregroundImage}
          alt=""
          className="absolute bottom-0 right-1 z-10 h-[112px] w-[44%] object-contain object-bottom opacity-95 drop-shadow-[0_14px_22px_rgba(0,0,0,0.22)]"
          draggable={false}
        />
      ) : null}
      <span className="absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-[7px] border border-white/[0.18] bg-white/[0.16] text-white shadow-none">
        <WorkflowIcon className="size-5" />
      </span>
      <div
        className={cn(
          'relative z-20 flex h-full min-h-[152px] flex-col p-3.5 pt-4',
          workflow.foregroundImage ? 'pr-[48%]' : 'pr-[4.25rem]',
        )}
      >
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[18px] font-semibold leading-[1.14] text-white md:text-[19px] xl:text-[17px] 2xl:text-[19px]">
            {toolCopy(workflow.title)}
          </h3>
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-white/70">
            {toolCopy(workflow.description)}
          </p>
        </div>
      </div>
      <span className="absolute bottom-3 right-3 z-20 inline-flex h-7 items-center rounded-full border border-white/[0.22] bg-white/[0.16] px-3 text-xs font-semibold text-white/92 transition-colors group-hover:bg-white group-hover:text-black">
        <UiText id="use_flow_f67844b2" /></span>
      <WorkflowNodeIconRail nodes={workflow.nodes} />
    </button>
  )
}

function WorkflowMiniCanvas({ nodes }: { nodes: string[] }) {
  const visibleNodes = nodes.length > 0 ? nodes.slice(0, 5) : ['Input', 'Plan', 'Generate', 'Publish']

  return (
    <div className="pointer-events-none absolute inset-y-5 right-12 z-10 hidden w-[48%] items-center md:flex">
      <div className="relative flex w-full items-center justify-between gap-2 opacity-70">
        <span className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-white/26" />
        {visibleNodes.map((node, index) => {
          const Icon = getWorkflowNodeIcon(node)
          return (
            <span
              key={`${node}-${index}`}
              className="relative flex size-8 items-center justify-center rounded-[6px] border border-white/24 bg-white/14 text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md"
            >
              <Icon className="size-4" />
            </span>
          )
        })}
      </div>
    </div>
  )
}

function WorkflowNodeIconRail({ nodes }: { nodes: string[] }) {
  const visibleNodes = nodes.slice(0, 5)
  if (visibleNodes.length === 0) return null

  return (
    <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
      {visibleNodes.map((node, index) => {
        const Icon = getWorkflowNodeIcon(node)
        return (
          <Tooltip key={`${node}-${index}`}>
            <TooltipTrigger asChild>
              <span className="flex size-7 items-center justify-center rounded-[6px] border border-white/[0.18] bg-black/22 text-white/78 backdrop-blur-sm">
                <Icon className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{node}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

function WorkflowCanvasPreview({ workflow }: { workflow: WorkflowTemplateCard }) {
  const nodes = workflow.nodes.length > 0 ? workflow.nodes : workflow.steps
  const visibleNodes = nodes.length > 0 ? nodes.slice(0, 8) : ['Trigger', 'Idea', 'Generate', 'Review', 'Publish']

  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.16),rgba(255,255,255,0.02)_45%,rgba(0,0,0,0.24)_100%)]">
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(135deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:12px_12px]" />
      <div className="absolute left-[7%] right-[7%] top-1/2 flex -translate-y-1/2 items-center justify-between gap-3">
        <span className="absolute left-7 right-7 top-1/2 h-px -translate-y-1/2 bg-white/24" />
        {visibleNodes.map((node, index) => {
          const Icon = getWorkflowNodeIcon(node)
          return (
            <div
              key={`${node}-${index}`}
              className="relative z-10 flex min-w-[78px] max-w-[118px] flex-col items-center gap-2 rounded-[8px] border border-white/20 bg-white/14 px-3 py-3 text-center text-white shadow-[0_14px_34px_rgba(0,0,0,0.2)] backdrop-blur-md"
            >
              <span className="flex size-8 items-center justify-center rounded-[7px] bg-white/16">
                <Icon className="size-4" />
              </span>
              <span className="line-clamp-2 text-[11px] font-semibold leading-3 text-white/78">{node}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getWorkflowNodeIcon(node: string): LucideIcon {
  const token = node.toLowerCase()
  if (token.includes('caption') || token.includes('subtitle')) return Captions
  if (token.includes('image') || token.includes('visual')) return ImageIcon
  if (token.includes('video') || token.includes('render')) return Clapperboard
  if (token.includes('upload')) return UploadCloud
  if (token.includes('review') || token.includes('gate')) return Check
  if (token.includes('prompt') || token.includes('text') || token.includes('script')) return Type
  if (token.includes('voice') || token.includes('audio')) return Mic2
  if (token.includes('agent') || token.includes('plan')) return Bot
  return WorkflowIcon
}

function ToolHeroBackdrop({
  spotlightToolIds,
  discoveryCatalog,
}: {
  spotlightToolIds: ToolId[]
  discoveryCatalog?: DiscoveryToolsCatalog
}) {
  const displayedTiles = spotlightToolIds.length > 0
    ? heroTileLayouts.map((layout, index) => ({
        ...layout,
        toolId: spotlightToolIds[index % spotlightToolIds.length]!,
      }))
    : []

  return (
    <div className="absolute inset-0 overflow-hidden bg-muted/70 dark:bg-[#121212]" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.24] dark:opacity-[0.1]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(23,43,77,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(23,43,77,0.14) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />
      <div className="absolute right-0 top-0 h-full w-[72%] min-w-[720px]">
        <div className="absolute right-8 top-7 h-9 w-[62%] rounded-[5px] border border-border/70 bg-background/55 dark:border-white/[0.08] dark:bg-white/[0.045]" />
        <div className="absolute right-16 top-[72px] h-px w-[72%] bg-border dark:bg-white/[0.11]" />
        <div className="absolute right-28 top-[124px] h-px w-[58%] bg-primary/20 dark:bg-cyan-300/[0.18]" />
        <div className="absolute bottom-8 right-10 h-12 w-[70%] rounded-[5px] border border-border/70 bg-background/40 dark:border-white/[0.075] dark:bg-[#121212]/70" />
        {displayedTiles.map((tile, index) => {
          const discoveryTool = getDiscoveryTool(discoveryCatalog, tile.toolId)
          if (!discoveryTool) return null
          const tool = getEffectiveToolConfig(tile.toolId, discoveryTool)

          return (
            <div
              key={`${tile.toolId}-${tile.left}-${tile.top}-${index}`}
              className={cn(
                'absolute flex items-center gap-2 rounded-[7px] border border-border/80 bg-background/70 p-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.14)] backdrop-blur-sm dark:border-white/[0.12] dark:bg-[#121212]/75 dark:shadow-[0_18px_42px_rgba(0,0,0,0.34)]',
                tile.large ? 'pr-3' : 'pr-2',
              )}
              style={{
                left: tile.left,
                top: tile.top,
                transform: `rotate(${tile.rotate})`,
              }}
            >
              <ToolIconTile
                toolId={tile.toolId}
                discoveryTool={discoveryTool}
                className={cn(tile.large ? 'size-16' : 'size-[52px]', 'rounded-[12px]')}
                iconClassName={tile.large ? 'size-8' : 'size-6'}
              />
              <span className="hidden max-w-20 truncate text-xs font-semibold text-foreground/72 dark:text-white/[0.72] xl:block">
                {tool.shortTitle}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ToolHeroMediaBackdrop({
  slides,
  activeIndex,
  playing,
}: {
  slides: CatalogHeroSlide[]
  activeIndex: number
  playing: boolean
}) {
  const toolCopy = useToolCopy()
  const currentIndex = slides.length ? activeIndex % slides.length : 0

  return (
    <div className="absolute inset-0 overflow-hidden bg-muted dark:bg-[#121212]" aria-hidden>
      {slides.map((slide, index) => {
        const active = index === currentIndex
        const loading = getHeroMediaLoadingStrategy(index, currentIndex, slides.length)
        return (
          <div
            key={slide.id}
            className={cn(
              'tools-hero-media-panel transition-[opacity,transform] duration-700 ease-out',
              active ? 'opacity-100' : 'opacity-0',
              slide.transition === 'zoom' && (active ? 'scale-100' : 'scale-[1.035]'),
            )}
          >
            {slide.kind === 'video' ? (
              <ToolHeroVideoAsset
                slide={slide}
                active={active}
                playing={playing}
                preload={loading.preload}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.url}
                alt={toolCopy(slide.alt)}
                className="tools-hero-media-asset h-full w-full"
                style={buildHeroMediaStyle(slide)}
                draggable={false}
                decoding="async"
                loading={loading.preload === 'none' ? 'lazy' : 'eager'}
                fetchPriority={active ? 'high' : 'low'}
              />
            )}
          </div>
        )
      })}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(255,255,255,0.18),transparent_36%),linear-gradient(180deg,rgba(0,0,0,0.03),rgba(0,0,0,0.12))] dark:bg-[radial-gradient(circle_at_78%_22%,rgba(255,255,255,0.1),transparent_36%),linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.16))]" />
    </div>
  )
}

function HeroLoadingState() {
  const tAuto = useTranslations('Auto')
  return (
    <div className="max-w-xl" aria-busy="true" aria-label={tAuto('discovery_slider_yukleniyor_4026d2e4')}>
      <Skeleton className="h-7 w-36 rounded-md" />
      <Skeleton className="mt-5 h-10 w-full max-w-[520px]" />
      <Skeleton className="mt-4 h-4 w-full max-w-[440px]" />
      <Skeleton className="mt-2 h-4 w-full max-w-[360px]" />
      <Skeleton className="mt-6 h-11 w-40 rounded-xl" />
    </div>
  )
}

function HeroSlideControls({
  slides,
  activeIndex,
  onSelect,
}: {
  slides: CatalogHeroSlide[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const currentIndex = slides.length ? activeIndex % slides.length : 0

  return (
    <div className="absolute bottom-4 right-6 z-20 flex items-center gap-2" role="group" aria-label={tAuto('slider_kontrolleri_1f40b8ba')}>
      {slides.map((slide, index) => {
        const active = index === currentIndex
        return (
          <button
            key={slide.id + '-control'}
            type="button"
            aria-label={tAuto('go_to_slide', { title: toolCopy(slide.title) })}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(index)}
            className={cn(
              'h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'w-6 bg-primary' : 'w-1.5 bg-white/30 hover:bg-white/50',
            )}
          />
        )
      })}
    </div>
  )
}

function ToolCatalogLoadingGrid() {
  const tAuto = useTranslations('Auto')
  return (
    <section
      aria-busy="true"
      aria-label={tAuto('loading_tools_3534999e')}
      className="grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[6px] border border-border bg-card dark:border-white/[0.085]"
        >
          <Skeleton className="aspect-[1.9] rounded-none" />
          <div className="space-y-3 px-4 py-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </section>
  )
}

function ToolCatalogShelf({
  title,
  subtitle,
  toolIds,
  discoveryCatalog,
  favoriteControls,
}: {
  title: string
  subtitle: string
  toolIds: ToolId[]
  discoveryCatalog?: DiscoveryToolsCatalog
  favoriteControls?: ToolFavoriteControls
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {toolIds.map((toolId) => (
          <ToolCatalogCard
            key={toolId}
            toolId={toolId}
            discoveryCatalog={discoveryCatalog}
            favoriteControls={favoriteControls}
          />
        ))}
      </div>
    </section>
  )
}

type CatalogSection = {
  id: string
  title: string
  subtitle: string
  toolIds: ToolId[]
}

type CatalogSectionMedia = {
  url: string
  kind: 'image' | 'video'
  alt: string
  fit: 'cover' | 'contain'
  position: 'left' | 'center' | 'right'
  durationMs: number
  transition: 'fade' | 'zoom'
  scrimColor?: string
  scrimOpacity?: number
  buttonColor?: string
  buttonTextColor?: string
  badge?: string
  ctaLabel?: string
  ctaHref?: string
  secondaryCtaLabel?: string
  secondaryCtaHref?: string
}

type CatalogHeroSlide = CatalogSectionMedia & {
  id: string
  title: string
  subtitle: string
  sortOrder: number
}

function ToolCatalogGrid({
  toolIds,
  discoveryCatalog,
  favoriteControls,
  emptyTitle,
  emptyDescription,
}: {
  toolIds: ToolId[]
  discoveryCatalog?: DiscoveryToolsCatalog
  favoriteControls?: ToolFavoriteControls
  emptyTitle?: string
  emptyDescription?: string
}) {
  const tAuto = useTranslations('Auto')
  if (toolIds.length === 0) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center rounded-[6px] border border-dashed border-border px-6 text-center dark:border-white/[0.11]">
        <Search className="size-7 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold text-foreground">{emptyTitle ?? tAuto('no_results_found')}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {emptyDescription ?? tAuto('try_another_keyword')}
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-normal text-foreground"><UiText id="sonuclar_d1a79137" /></h2>
        <span className="text-sm font-semibold text-muted-foreground">
          {toolIds.length} tool
        </span>
      </div>
      <div
        className={cn(
          'grid gap-x-7 gap-y-10',
          toolIds.length === 1
            ? 'grid-cols-[minmax(min(300px,100%),440px)]'
            : 'auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
        )}
      >
        {toolIds.map((toolId) => (
          <ToolCatalogCard
            key={toolId}
            toolId={toolId}
            discoveryCatalog={discoveryCatalog}
            favoriteControls={favoriteControls}
          />
        ))}
      </div>
    </section>
  )
}

function ToolCatalogCard({
  toolId,
  discoveryCatalog,
  favoriteControls,
}: {
  toolId: ToolId
  discoveryCatalog?: DiscoveryToolsCatalog
  favoriteControls?: ToolFavoriteControls
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const discoveryTool = getDiscoveryTool(discoveryCatalog, toolId)
  if (!discoveryTool) return null

  const tool = getEffectiveToolConfig(toolId, discoveryTool)
  const meta = getEffectiveToolCatalogMeta(toolId, discoveryTool)
  const favoriteNodeType = discoveryTool.execution.node_type.trim()
  const isFavorite = favoriteNodeType ? favoriteControls?.favoriteNodeTypes.has(favoriteNodeType) ?? false : false
  const isFavoriteBusy = favoriteNodeType ? favoriteControls?.favoriteBusyNodeType === favoriteNodeType : false

  return (
      <article className="group relative overflow-hidden rounded-2xl border border-border bg-panel/40 text-left transition-colors hover:border-primary/40">
        <Link
          href={getToolHref(toolId)}
          className="absolute inset-0 z-10 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="sr-only">{toolCopy(tool.title)}</span>
        </Link>
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-accent to-panel">
          <img
            src={meta.thumbnail}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {meta.featured ? (
              <Badge variant="outline" className="rounded-md border-0 bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary backdrop-blur">
                <UiText id="trend_dae07c6e" /></Badge>
            ) : null}
            {meta.isNew ? (
              <Badge variant="outline" className="rounded-md border-0 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300 backdrop-blur">
                <UiText id="new_6403f2b7" /></Badge>
            ) : null}
          </div>
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-3">
            <span className="truncate text-[10px] font-bold uppercase tracking-wide text-white/80">
              {meta.category} module
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 p-3.5">
          <ToolIconTile
            toolId={toolId}
            discoveryTool={discoveryTool}
            className="size-9 rounded-full border-0 shadow"
            iconClassName="size-[18px]"
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {toolCopy(tool.title)}
            </h3>
            <span className="text-xs text-muted-foreground">{tAuto('created_by', { creator: meta.creator })}</span>
          </div>
          {favoriteNodeType && favoriteControls ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'relative z-20 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-rose-400 disabled:pointer-events-none disabled:opacity-60',
                    isFavorite && 'bg-accent text-rose-400',
                  )}
                  onClick={(event) => {
                    event.stopPropagation()
                    favoriteControls.onToggleFavorite(favoriteNodeType, !isFavorite)
                  }}
                  disabled={isFavoriteBusy}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite
                    ? tAuto('remove_from_favorites_named', { name: toolCopy(tool.title) })
                    : tAuto('add_to_favorites_named', { name: toolCopy(tool.title) })}
                >
                  {isFavoriteBusy ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Heart className={cn('size-4', isFavorite && 'fill-current')} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isFavorite ? tAuto('favorilerden_kaldir_57c6550b') : tAuto('favorilere_ekle_360ac512')}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <p className="col-span-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {toolCopy(meta.description)}
          </p>
        </div>
      </article>
  )
}

function ToolIconTile({
  toolId,
  discoveryTool,
  className,
  iconClassName,
  style,
}: {
  toolId: ToolId
  discoveryTool: DiscoveryToolCatalogItem
  className?: string
  iconClassName?: string
  style?: React.CSSProperties
}) {
  const tool = getEffectiveToolConfig(toolId, discoveryTool)
  const Icon = tool.icon

  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-105',
        getNewThemeToolGradient(tool),
        className,
      )}
      style={style}
    >
      <Icon className={cn('size-[18px]', iconClassName)} />
    </span>
  )
}

function getNewThemeToolGradient(tool: ToolConfig) {
  const id = tool.id.trim().toLowerCase().replace(/_/g, '-')
  if (id.includes('media-transform') || id.includes('transform')) return 'from-sky-500 to-blue-600'
  if (id.includes('video-gif') || id.includes('gif')) return 'from-emerald-500 to-green-600'
  if (id.includes('frame')) return 'from-rose-500 to-red-600'
  if (id.includes('magic-clip') || id.includes('clip')) return 'from-amber-500 to-yellow-600'
  if (id.includes('transcript')) return 'from-cyan-500 to-teal-600'
  if (id.includes('caption')) return 'from-violet-500 to-purple-600'
  if (id.includes('text-to-speech') || id === 'tts' || id.includes('speech-generate')) return 'from-teal-500 to-emerald-600'
  if (id.includes('voice-clone')) return 'from-sky-500 to-blue-600'
  if (id.includes('brand-overlay') || id.includes('overlay')) return 'from-fuchsia-500 to-pink-600'
  if (id.includes('downloader') || id.includes('download')) return 'from-emerald-500 to-green-600'
  if (id.includes('prompt-enhance') || id.includes('enhance')) return 'from-amber-500 to-orange-600'
  if (id.includes('prompt-generate')) return 'from-violet-500 to-purple-600'
  if (id.includes('research')) return 'from-cyan-500 to-teal-600'
  if (id.includes('upload')) return 'from-teal-500 to-emerald-600'
  if (tool.modelKind === 'image') return 'from-fuchsia-500 to-pink-600'
  if (tool.modelKind === 'voice') return 'from-teal-500 to-emerald-600'
  if (tool.modelKind === 'agent') return 'from-cyan-500 to-teal-600'
  return 'from-amber-500 to-orange-600'
}

function getNewThemeToolCategory(tool: ToolConfig) {
  if (tool.modelKind === 'image') return 'Image'
  if (tool.modelKind === 'voice') return 'Speech'
  if (tool.modelKind === 'agent') return 'Agent'
  return 'Video'
}

function ToolIconGlyph({
  shape,
  Icon,
  className,
}: {
  shape?: string
  Icon: LucideIcon
  className?: string
}) {
  const normalized = shape?.trim().toLowerCase()
  if (!normalized || normalized === 'auto' || normalized === 'lucide') {
    return <Icon className={className} />
  }

  if (normalized === 'media-transform') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute left-[10%] top-[18%] h-[48%] w-[58%] rounded-[3px] border-[2px] border-current/95" />
        <span className="absolute bottom-[14%] right-[8%] h-[48%] w-[58%] rounded-[3px] border-[2px] border-current/70" />
        <span className="absolute left-[42%] top-[42%] h-[16%] w-[16%] rounded-full bg-current" />
      </span>
    )
  }

  if (normalized === 'captions') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute inset-x-[10%] bottom-[12%] h-[56%] rounded-[4px] border-[2px] border-current/80" />
        <span className="absolute left-[20%] top-[42%] h-[10%] w-[60%] rounded-full bg-current" />
        <span className="absolute left-[20%] top-[62%] h-[10%] w-[42%] rounded-full bg-current/80" />
      </span>
    )
  }

  if (normalized === 'motion') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute left-[38%] top-[9%] h-[18%] w-[18%] rounded-full bg-current" />
        <span className="absolute left-[42%] top-[29%] h-[30%] w-[13%] rotate-[-12deg] rounded-full bg-current" />
        <span className="absolute left-[22%] top-[44%] h-[12%] w-[34%] rotate-[-28deg] rounded-full bg-current/85" />
        <span className="absolute left-[48%] top-[55%] h-[12%] w-[34%] rotate-[42deg] rounded-full bg-current/85" />
        <span className="absolute left-[20%] bottom-[12%] h-[12%] w-[30%] rotate-[38deg] rounded-full bg-current" />
      </span>
    )
  }

  if (normalized === 'cube') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute left-[18%] top-[28%] h-[44%] w-[44%] rotate-45 rounded-[3px] border-[2px] border-current/90" />
        <span className="absolute left-[40%] top-[18%] h-[44%] w-[44%] rotate-45 rounded-[3px] border-[2px] border-current/60" />
        <span className="absolute left-[40%] top-[40%] h-[28%] w-[28%] rotate-45 bg-current/28" />
      </span>
    )
  }

  if (normalized === 'spark') {
    return (
      <span className={cn('relative block', className)} aria-hidden="true">
        <span className="absolute left-[44%] top-[8%] h-[84%] w-[12%] rounded-full bg-current" />
        <span className="absolute left-[8%] top-[44%] h-[12%] w-[84%] rounded-full bg-current" />
        <span className="absolute left-[20%] top-[20%] h-[60%] w-[12%] rotate-45 rounded-full bg-current/70" />
        <span className="absolute right-[20%] top-[20%] h-[60%] w-[12%] -rotate-45 rounded-full bg-current/70" />
      </span>
    )
  }

  return <Icon className={className} />
}

function getIconSurfaceStyle(baseColor: string, foregroundColor: string, override?: React.CSSProperties): React.CSSProperties {
  const base = hexToRgb(baseColor) ?? { r: 91, g: 140, b: 255 }
  const deep = mixRgb(base, { r: 0, g: 0, b: 0 }, 0.22)

  return {
    background: `linear-gradient(135deg, ${rgbCss(base)} 0%, ${rgbCss(deep)} 100%)`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.28)',
    color: foregroundColor,
    ...override,
  }
}

function parseSafeIconCss(value: string | null | undefined): React.CSSProperties | undefined {
  const normalized = value?.trim()
  if (!normalized) return undefined

  const allowedProperties: Record<string, keyof React.CSSProperties> = {
    background: 'background',
    'background-color': 'backgroundColor',
    'border-radius': 'borderRadius',
    border: 'border',
    'box-shadow': 'boxShadow',
    color: 'color',
  }
  const style: React.CSSProperties = {}

  for (const declaration of normalized.split(';')) {
    const [rawKey, ...rawValue] = declaration.split(':')
    const key = rawKey?.trim().toLowerCase()
    const cssKey = key ? allowedProperties[key] : undefined
    if (!cssKey) continue

    const cssValue = rawValue.join(':').trim()
    if (!cssValue || cssValue.length > 220 || /url\s*\(|expression\s*\(|javascript:|[<>{}]/i.test(cssValue)) continue
    const target = style as Record<string, string>
    target[cssKey] = cssValue
  }

  return Object.keys(style).length > 0 ? style : undefined
}

function getToolHref(toolId: ToolId, options: { modelId?: string | null } = {}) {
  const params = new URLSearchParams({ tool: toolId })
  if (options.modelId) params.set('model', options.modelId)
  return `/tools?${params.toString()}`
}

function ToolInputPanel({
  tool,
  modeOptions,
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  models,
  selectedModelId,
  onModelChange,
  duration,
  onDurationChange,
  durationOptions,
  resolution,
  onResolutionChange,
  resolutionOptions,
  ratio,
  onRatioChange,
  ratioOptions,
  motion,
  onMotionChange,
  seed,
  onSeedChange,
  onRandomizeSeed,
  audio,
  onAudioChange,
  discoveryTool,
  selectedDiscoveryModel,
  activeChannelId,
  standardFields,
  schemaValues,
  sourceMedia,
  mediaDownloaderQuote = null,
  viralClipsEstimateState = null,
  onSchemaValueChange,
  onStorageMediaSelectionChange,
  onSourceImageUploadStateChange,
  onReset,
  onGenerate,
  generating,
  creditLabel,
  creditPending,
  unavailableReason,
  className,
}: {
  tool: ToolConfig
  modeOptions: ToolMode[]
  mode: string
  onModeChange: (value: string) => void
  prompt: string
  onPromptChange: (value: string) => void
  models: ToolModel[]
  selectedModelId: string
  onModelChange: (value: string) => void
  duration: string
  onDurationChange: (value: string) => void
  durationOptions: ToolChoice[]
  resolution: string
  onResolutionChange: (value: string) => void
  resolutionOptions: ToolChoice[]
  ratio: string
  onRatioChange: (value: string) => void
  ratioOptions: ToolChoice[]
  motion: number
  onMotionChange: (value: number) => void
  seed: string
  onSeedChange: (value: string) => void
  onRandomizeSeed: () => void
  audio: boolean
  onAudioChange: (value: boolean) => void
  discoveryTool?: DiscoveryToolCatalogItem
  selectedDiscoveryModel?: DiscoveryToolCatalogItem['models'][number]
  activeChannelId: string | null
  standardFields: StandardToolFieldSupport
  schemaValues: ToolSchemaValues
  sourceMedia?: ToolRunSourceMedia | null
  mediaDownloaderQuote?: ReturnType<typeof useMediaDownloaderQuote> | null
  viralClipsEstimateState?: MagicClipsEstimateState | null
  onSchemaValueChange: (name: string, value: unknown) => void
  onStorageMediaSelectionChange: (selection: ToolRunSourceMedia | null) => void
  onSourceImageUploadStateChange: (name: string, uploading: boolean) => void
  onReset: () => void
  onGenerate: () => void
  generating: boolean
  creditLabel: string
  creditPending: boolean
  unavailableReason?: string | null
  className?: string
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const selectedModel = getRunnableToolModel(models, selectedModelId, '')
  const isImageTool = tool.modelKind === 'image'
  const isVideoTool = tool.modelKind === 'video'
  const isVoiceTool = tool.modelKind === 'voice'
  const isAgentTool = tool.modelKind === 'agent'
  const inputContract = discoveryTool
    ? getEffectiveToolInputContract(discoveryTool, selectedDiscoveryModel)
    : undefined
  const instantVoiceCloneTool = Boolean(inputContract && isInstantVoiceCloneInputContract(inputContract))
  const mediaDownloaderTool = Boolean(inputContract && isMediaDownloaderTool(tool, inputContract))
  const angleTool = isAngleToolCatalogItem(discoveryTool)
  const primaryActionLabel = getToolPrimaryActionLabel(tool, inputContract)
  const researchAgentTool = Boolean(inputContract && isResearchAgentTool(tool, inputContract))
  const magicClipsTool = Boolean(inputContract && isMagicClipsTool(tool, inputContract))
  const showResolutionField = Boolean(
    standardFields.resolution
    && !mediaDownloaderTool,
  )
  const advancedFields = React.useMemo(
    () => getAdvancedSchemaFields(tool, discoveryTool, selectedDiscoveryModel, standardFields, mode),
    [discoveryTool, mode, selectedDiscoveryModel, standardFields, tool],
  )
  const captionTool = Boolean(inputContract && isCaptionTool(tool, inputContract))
  const frameExtractTool = Boolean(inputContract && isFrameExtractTool(tool, inputContract))
  const hasAdvancedSettings = Boolean(
    inputContract && (captionTool || frameExtractTool || advancedFields.length > 0),
  )
  const captionStyleName = resolveCaptionAdvancedStyleName(
    stringifySchemaValue(schemaValues.style_name) || 'auto',
    captionTool ? sourceMedia : null,
  )

  return (
    <ToolPanel className={className}>
      <ToolPanelHeader
        backHref="/tools"
        icon={tool.icon}
        iconContent={discoveryTool ? (
          <ToolIconTile
            toolId={tool.id}
            discoveryTool={discoveryTool}
            className="size-11 rounded-2xl"
            iconClassName="size-5"
          />
        ) : undefined}
        title={toolCopy(tool.title)}
        description={magicClipsTool
          ? tAuto('viral_clips_header_description')
          : toolCopy(tool.description)}
        badge={getNewThemeToolCategory(tool)}
        actions={<Info className="mt-1 size-4 text-muted-foreground" />}
      />

      <div>
        <div className="space-y-5">
          {shouldShowToolModeSelect(tool, inputContract, standardFields.mode, modeOptions) ? (
            <ToolModeSelect
              modes={modeOptions}
              value={mode}
              onValueChange={onModeChange}
              label={mediaDownloaderTool ? tAuto('mode_a7b93d21') : researchAgentTool ? tAuto('research_depth_2e139b30') : tAuto('input_type_61bbcbfa')}
            />
          ) : null}

          {instantVoiceCloneTool && models.length <= 1 ? (
            <VoiceCloneTypeField modelCatalogAvailable={models.length > 0} />
          ) : standardFields.model && !magicClipsTool ? (
            <ToolModelPicker
              models={models}
              selectedModelId={selectedModel?.id ?? selectedModelId}
              onModelChange={onModelChange}
            />
          ) : null}

          {standardFields.prompt && !angleTool ? (
            <ToolField
              label={tAuto('prompt_a817d7eb')}
              icon={Info}
              action={
                <Button type="button" variant="outline" size="sm">
                  <Sparkles className="size-4" />
                  <UiText id="suggestions_861edba0" /></Button>
              }
            >
              <ToolPromptArea
                value={prompt}
                onChange={onPromptChange}
                placeholder={tool.promptPlaceholder}
              />
            </ToolField>
          ) : null}

          {standardFields.resolution && isImageTool ? (
            <ToolSelectField
              label={getStandardFieldLabel('resolution', standardFields.resolution)}
              value={resolution}
              options={resolutionOptions}
              onValueChange={onResolutionChange}
            />
          ) : null}

          {(standardFields.duration || showResolutionField) && !isImageTool && !isAgentTool ? (
            <div className="grid gap-4 md:grid-cols-2">
              {standardFields.duration ? (
                <ToolSelectField
                  label={tAuto('duration_1370004d')}
                  value={duration}
                  options={durationOptions}
                  onValueChange={onDurationChange}
                />
              ) : null}
              {showResolutionField ? (
                <ToolSelectField
                  label={tAuto('resolution_516aae52')}
                  value={resolution}
                  options={resolutionOptions}
                  onValueChange={onResolutionChange}
                />
              ) : null}
            </div>
          ) : null}

          {standardFields.ratio && !isAgentTool ? (
            <ToolRatioPicker
              value={ratio}
              options={ratioOptions}
              onValueChange={onRatioChange}
            />
          ) : null}

          {standardFields.motion && isVideoTool ? (
            <ToolSliderField
              label={tAuto('motion_level_45aecf8e')}
              value={motion}
              min={1}
              max={10}
              suffix=" / 10"
              onValueChange={onMotionChange}
            />
          ) : null}

          {standardFields.seed && (isImageTool || isVideoTool || isVoiceTool) ? (
            <ToolSeedInput
              value={seed}
              onChange={onSeedChange}
              onRandomize={onRandomizeSeed}
            />
          ) : null}

          {standardFields.audio && (isVideoTool || isVoiceTool) ? (
            <ToolToggleRow
              icon={AudioLines}
              label={isVoiceTool ? tAuto('noise_cleanup_c7dab8fc') : tAuto('audio_acdac205')}
              description={audio ? tAuto('on_e0049a66') : tAuto('off_e3de5ab0')}
              checked={audio}
              onCheckedChange={onAudioChange}
            />
          ) : null}

          <SchemaDrivenInputFields
            tool={tool}
            discoveryTool={discoveryTool}
            selectedModel={selectedDiscoveryModel}
            activeChannelId={activeChannelId}
            standardFields={standardFields}
            mode={mode}
            values={schemaValues}
            sourceMedia={sourceMedia}
            mediaDownloaderQuote={mediaDownloaderQuote}
            viralClipsEstimateState={viralClipsEstimateState}
            onValueChange={onSchemaValueChange}
            onStorageMediaSelectionChange={onStorageMediaSelectionChange}
            onSourceImageUploadStateChange={onSourceImageUploadStateChange}
          />

          {hasAdvancedSettings ? (
            <>
              <button
                type="button"
                aria-expanded={advancedOpen}
                onClick={() => setAdvancedOpen((current) => !current)}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-panel/40 px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-muted-foreground" />
                  <UiText id="advanced_settings_2e8bbf39" /></span>
                <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', advancedOpen && 'rotate-180')} />
              </button>

              {advancedOpen ? (
                <AdvancedToolInputFields
                  tool={tool}
                  discoveryTool={discoveryTool}
                  selectedModel={selectedDiscoveryModel}
                  fields={advancedFields}
                  values={schemaValues}
                  captionStyleName={captionStyleName}
                  onValueChange={onSchemaValueChange}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <CreditActionFrame
        className="mt-6 border-t border-border pt-4"
        leading={(
          <Button type="button" variant="outline" className="h-10 rounded-xl px-4" onClick={onReset}>
            <RefreshCw className="size-4" />
            <UiText id="reset_44c57abd" /></Button>
        )}
        disabled={Boolean(unavailableReason) || generating || (mediaDownloaderTool && creditPending)}
        onClick={onGenerate}
        title={unavailableReason ? toolCopy(unavailableReason) : (generating ? 'Queued' : primaryActionLabel)}
        icon={generating
          ? <LoaderCircle className="size-4 animate-spin" />
          : mediaDownloaderTool
            ? <Download className="size-4" />
            : <Sparkles className="size-4" />}
        label={primaryActionLabel}
        pill={<ToolCreditPill label={creditLabel} pending={creditPending} />}
        statusId="tool-generate-blocked-reason"
        status={unavailableReason ? toolCopy(unavailableReason) : null}
      />
    </ToolPanel>
  )
}

function SchemaDrivenInputFields({
  tool,
  discoveryTool,
  selectedModel,
  activeChannelId,
  standardFields,
  mode,
  values,
  sourceMedia = null,
  mediaDownloaderQuote = null,
  viralClipsEstimateState = null,
  onValueChange,
  onStorageMediaSelectionChange,
  onSourceImageUploadStateChange,
}: {
  tool: ToolConfig
  discoveryTool?: DiscoveryToolCatalogItem
  selectedModel?: DiscoveryToolCatalogItem['models'][number]
  activeChannelId: string | null
  standardFields: StandardToolFieldSupport
  mode: string
  values: ToolSchemaValues
  sourceMedia?: ToolRunSourceMedia | null
  mediaDownloaderQuote?: ReturnType<typeof useMediaDownloaderQuote> | null
  viralClipsEstimateState?: MagicClipsEstimateState | null
  onValueChange: (name: string, value: unknown) => void
  onStorageMediaSelectionChange: (selection: ToolRunSourceMedia | null) => void
  onSourceImageUploadStateChange: (name: string, uploading: boolean) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const fields = React.useMemo(
    () => getSchemaDrivenFields(tool, discoveryTool, selectedModel, standardFields, mode),
    [discoveryTool, mode, selectedModel, standardFields, tool],
  )
  const effectiveSchema = React.useMemo(
    () => getEffectiveToolInputSchema(discoveryTool, selectedModel),
    [discoveryTool, selectedModel],
  )
  const transcriptionLanguageOptions = React.useMemo(
    () => buildTranscriptionLanguageOptions([
      effectiveSchema,
      selectedModel?.input_schema,
      discoveryTool?.input_contract.input_schema,
    ]),
    [discoveryTool, effectiveSchema, selectedModel],
  )
  const sourceImageFieldNames = React.useMemo(
    () => getSchemaImageSourceFieldNames(effectiveSchema, tool, mode),
    [effectiveSchema, mode, tool],
  )
  const handleSourceImageValueChange = React.useCallback((name: string, value: unknown) => {
    const fieldNames = new Set([...sourceImageFieldNames, name])
    IMAGE_SOURCE_INPUT_FIELDS.forEach((fieldName) => fieldNames.add(fieldName))
    fieldNames.forEach((fieldName) => onValueChange(fieldName, fieldName === name ? value : undefined))
  }, [onValueChange, sourceImageFieldNames])
  const [selectedMedia, setSelectedMedia] = React.useState<{
    id: string
    name: string
    previewUrl: string | null
    width: number | null
    height: number | null
    dimensionSource?: 'source' | 'preview'
    durationSeconds: number | null
  } | null>(null)
  const [voiceCompatibilityNotice, setVoiceCompatibilityNotice] = React.useState<string | null>(null)
  const lastRejectedVoiceSelectionRef = React.useRef<string | null>(null)
  const lastVoiceCloneConsentScopeRef = React.useRef<string | null>(null)
  const voiceConsentCheckboxId = React.useId()
  const inputContract = discoveryTool ? getEffectiveToolInputContract(discoveryTool, selectedModel) : undefined
  const voiceTool = tool.modelKind === 'voice'
  const instantVoiceCloneTool = Boolean(inputContract && isInstantVoiceCloneInputContract(inputContract))
  const speechGenerateTool = Boolean(inputContract && isSpeechGenerateInputContract(inputContract))
  const voiceLanguageOptions = React.useMemo(
    () => buildVoiceLanguageOptions(effectiveSchema).map((option) => ({
      value: option.value,
      label: option.languageLabel,
      flagRegion: option.flagRegion,
      code: getLanguageDisplay(option.value, option.languageLabel).code,
    })),
    [effectiveSchema],
  )
  const voiceLanguageEntry = getSchemaEntry(effectiveSchema, 'language')
  const selectedVoiceReferenceId = stringifySchemaValue(values.reference_storage_object_id)
  const selectedVoiceCloneTargetModelId = stringifySchemaValue(
    values.target_speech_model_id
      ?? getSchemaEntry(effectiveSchema, 'target_speech_model_id')?.port.default,
  )
  const selectedVoiceLanguage = stringifySchemaValue(
    values.language ?? voiceLanguageEntry?.port.default,
  )
  const voiceCloneSelfAttestationAccepted = values[VOICE_CLONE_SELF_ATTESTATION_DRAFT_KEY] === true
  const voiceCloneConsentScope = instantVoiceCloneTool
    ? buildVoiceCloneConsentScope(
        activeChannelId,
        selectedVoiceReferenceId,
        selectedVoiceCloneTargetModelId,
        selectedVoiceLanguage,
      )
    : null
  const hasVoiceProfileField = Boolean(getSchemaEntry(effectiveSchema, 'voice_profile_id'))
  const selectedVoiceProfileId = stringifySchemaValue(values.voice_profile_id)
  const selectedVoiceModelId = selectedModel?.id ?? stringifySchemaValue(values.model_id)
  const voiceCompatibilityScope = JSON.stringify([
    activeChannelId,
    selectedVoiceModelId,
    selectedVoiceLanguage,
  ])
  const stockVoiceProfileListInput = React.useMemo(() => ({
    channelId: activeChannelId ?? undefined,
    modelId: selectedVoiceModelId || undefined,
    language: selectedVoiceLanguage || undefined,
    origin: 'stock' as const,
    status: 'ready' as const,
    limit: 100,
    offset: 0,
  }), [activeChannelId, selectedVoiceLanguage, selectedVoiceModelId])
  const customVoiceProfileListInput = React.useMemo(() => ({
    channelId: activeChannelId ?? undefined,
    modelId: selectedVoiceModelId || undefined,
    language: selectedVoiceLanguage || undefined,
    origin: 'instant_clone' as const,
    status: 'ready' as const,
    limit: 100,
    offset: 0,
  }), [activeChannelId, selectedVoiceLanguage, selectedVoiceModelId])
  const exactVoiceProfileListInput = React.useMemo(() => ({
    channelId: activeChannelId ?? undefined,
    modelId: selectedVoiceModelId || undefined,
    language: selectedVoiceLanguage || undefined,
    profileId: selectedVoiceProfileId || undefined,
    status: 'ready' as const,
    limit: 1,
  }), [activeChannelId, selectedVoiceLanguage, selectedVoiceModelId, selectedVoiceProfileId])
  const canQueryCompatibleVoiceProfiles = Boolean(
    hasVoiceProfileField
    && activeChannelId
    && selectedVoiceModelId
    && selectedVoiceLanguage,
  )
  const stockVoiceProfilesQuery = useQuery({
    queryKey: voiceProfilesQueryKey(stockVoiceProfileListInput),
    queryFn: ({ signal }) => listVoiceProfiles(stockVoiceProfileListInput, { signal }),
    enabled: canQueryCompatibleVoiceProfiles,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const customVoiceProfilesQuery = useQuery({
    queryKey: voiceProfilesQueryKey(customVoiceProfileListInput),
    queryFn: ({ signal }) => listVoiceProfiles(customVoiceProfileListInput, { signal }),
    enabled: canQueryCompatibleVoiceProfiles,
    staleTime: 5_000,
    refetchOnMount: 'always',
    retry: 1,
  })
  const exactVoiceProfileQuery = useQuery({
    queryKey: voiceProfilesQueryKey(exactVoiceProfileListInput),
    queryFn: ({ signal }) => listVoiceProfiles(exactVoiceProfileListInput, { signal }),
    enabled: Boolean(
      canQueryCompatibleVoiceProfiles
      && selectedVoiceProfileId
      && selectedVoiceProfileId !== 'default',
    ),
    staleTime: 30_000,
    retry: false,
  })
  const exactVoiceProfileCompatibility = React.useMemo(
    () => resolveExactVoiceProfileCompatibility(
      exactVoiceProfileQuery.data?.data ?? [],
      selectedVoiceProfileId,
      exactVoiceProfileQuery.isSuccess,
    ),
    [exactVoiceProfileQuery.data, exactVoiceProfileQuery.isSuccess, selectedVoiceProfileId],
  )
  const compatibleVoiceProfiles = React.useMemo(
    () => mergeCompatibleVoiceProfiles(
      [
        ...(stockVoiceProfilesQuery.data?.data ?? []),
        ...(customVoiceProfilesQuery.data?.data ?? []),
      ],
      exactVoiceProfileCompatibility.profile,
    ),
    [
      customVoiceProfilesQuery.data,
      exactVoiceProfileCompatibility.profile,
      stockVoiceProfilesQuery.data,
    ],
  )
  React.useEffect(() => {
    const previousScope = lastVoiceCloneConsentScopeRef.current
    lastVoiceCloneConsentScopeRef.current = voiceCloneConsentScope
    if (
      previousScope === null
      || voiceCloneConsentScope === null
      || previousScope === voiceCloneConsentScope
      || !voiceCloneSelfAttestationAccepted
    ) return
    const timeoutId = window.setTimeout(() => {
      onValueChange(VOICE_CLONE_SELF_ATTESTATION_DRAFT_KEY, false)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [onValueChange, voiceCloneConsentScope, voiceCloneSelfAttestationAccepted])
  React.useEffect(() => {
    if (!voiceTool || !voiceLanguageEntry || voiceLanguageOptions.length === 0) return
    const nextLanguage = chooseVoiceLanguageDefault(
      voiceLanguageOptions.map((option) => option.value),
      selectedVoiceLanguage,
    )
    if (!nextLanguage || nextLanguage === selectedVoiceLanguage) return
    const timeoutId = window.setTimeout(() => {
      onValueChange(voiceLanguageEntry.name, nextLanguage)
      onValueChange(
        'voice_profile_id',
        speechGenerateTool ? DEFAULT_VOICE_PROFILE_ID : undefined,
      )
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [
    onValueChange,
    selectedVoiceLanguage,
    voiceLanguageEntry,
    voiceLanguageOptions,
    speechGenerateTool,
    voiceTool,
  ])
  React.useEffect(() => {
    if (!speechGenerateTool) return
    const outputFormat = stringifySchemaValue(values.output_format || getSchemaEntry(effectiveSchema, 'output_format')?.port.default)
    const bitRateEntry = getSchemaEntry(effectiveSchema, 'bit_rate')
    const encodingEntry = getSchemaEntry(effectiveSchema, 'encoding')
    const currentBitRate = values.bit_rate
    const currentEncoding = values.encoding
    const timeoutId = window.setTimeout(() => {
      if (bitRateEntry && outputFormat === 'mp3' && isBlankValue(currentBitRate)) {
        onValueChange(bitRateEntry.name, 128_000)
      } else if (bitRateEntry && outputFormat !== 'mp3' && !isBlankValue(currentBitRate)) {
        onValueChange(bitRateEntry.name, undefined)
      }
      if (encodingEntry && outputFormat !== 'wav' && !isBlankValue(currentEncoding)) {
        onValueChange(encodingEntry.name, undefined)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [effectiveSchema, onValueChange, speechGenerateTool, values.bit_rate, values.encoding, values.output_format])
  React.useEffect(() => {
    if (!hasVoiceProfileField) {
      lastRejectedVoiceSelectionRef.current = null
      const timeoutId = window.setTimeout(() => setVoiceCompatibilityNotice(null), 0)
      return () => window.clearTimeout(timeoutId)
    }
    if (!selectedVoiceProfileId) {
      lastRejectedVoiceSelectionRef.current = null
      return
    }
    if (selectedVoiceProfileId === 'default') {
      lastRejectedVoiceSelectionRef.current = null
      const timeoutId = window.setTimeout(() => setVoiceCompatibilityNotice(null), 0)
      return () => window.clearTimeout(timeoutId)
    }
    if (exactVoiceProfileCompatibility.status === 'unverified') return

    const validationKey = JSON.stringify([voiceCompatibilityScope, selectedVoiceProfileId])
    if (exactVoiceProfileCompatibility.status === 'compatible') {
      lastRejectedVoiceSelectionRef.current = null
      const timeoutId = window.setTimeout(() => setVoiceCompatibilityNotice(null), 0)
      return () => window.clearTimeout(timeoutId)
    }

    if (lastRejectedVoiceSelectionRef.current === validationKey) return
    lastRejectedVoiceSelectionRef.current = validationKey
    const timeoutId = window.setTimeout(() => {
      setVoiceCompatibilityNotice('The selected voice is not available for this model and language.')
      onValueChange(
        'voice_profile_id',
        speechGenerateTool ? DEFAULT_VOICE_PROFILE_ID : undefined,
      )
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [
    exactVoiceProfileCompatibility.status,
    hasVoiceProfileField,
    onValueChange,
    selectedVoiceProfileId,
    speechGenerateTool,
    voiceCompatibilityScope,
  ])
  const transcriptTool = Boolean(inputContract && isTranscriptTool(tool, inputContract))
  const captionTool = Boolean(inputContract && isCaptionTool(tool, inputContract))
  const mediaDownloaderTool = Boolean(inputContract && isMediaDownloaderTool(tool, inputContract))
  const mediaTransformTool = Boolean(inputContract && isMediaTransformTool(tool, inputContract))
  const angleTool = isAngleToolCatalogItem(discoveryTool)
  const magicClipsTool = Boolean(inputContract && isMagicClipsTool(tool, inputContract))
  const videoToGifTool = Boolean(inputContract && isVideoToGifInputContract(inputContract))
  const frameExtractTool = isFrameExtractTool(tool, inputContract)
  const hasStorageMediaField = !magicClipsTool
    && (transcriptTool || captionTool)
    && Boolean(getSchemaEntry(effectiveSchema, 'storage_object_id'))
  const selectedStorageObjectId = stringifySchemaValue(values.storage_object_id)
  const activeSelectedMedia = selectedMedia?.id === selectedStorageObjectId ? selectedMedia : null
  const selectedMediaName = activeSelectedMedia?.name ?? ''
  const captionTranscriptQuery = useQuery({
    queryKey: ['caption-tool', 'transcript-artifacts', activeChannelId ?? 'none', selectedStorageObjectId || 'none'],
    queryFn: ({ signal }) => listMediaTranscriptArtifacts({
      channelId: activeChannelId!,
      sourceObjectId: selectedStorageObjectId,
    }, { signal }),
    enabled: Boolean(captionTool && activeChannelId && selectedStorageObjectId),
    staleTime: 30_000,
    retry: false,
  })
  const hiddenStorageFields = captionTool
    ? [
        'storage_object_id',
        'media_ref',
        'video_url',
        'transcript_segments',
        'transcript_artifact_storage_object_id',
        'translated_segments',
        'subtitle_bundle_storage_object_id',
        'video_duration',
        'video_width',
        'video_height',
        'overrides',
      ]
    : ['storage_object_id', 'media_ref']
  const baseVisibleFields = mediaTransformTool || angleTool || magicClipsTool || videoToGifTool || frameExtractTool
    ? []
    : mediaDownloaderTool
    ? fields.filter(([name]) => !MEDIA_DOWNLOADER_CUSTOM_SCHEMA_FIELDS.has(normalizeToolInputName(name)))
    : transcriptTool || captionTool
      ? fields.filter(([name]) => !hiddenStorageFields.includes(normalizeToolInputName(name)))
      : fields
  const captionSubtitleMode = normalizeCaptionSubtitleMode(
    values.subtitle_mode ?? getSchemaEntry(effectiveSchema, 'subtitle_mode')?.port.default,
  )
  const captionTranslationPricingNote = captionSubtitleMode === 'original'
    ? ''
    : ' Translation is a separately priced step included in the total estimate.'
  const visibleFields = captionTool
    ? baseVisibleFields.filter(([name]) => (
        !CAPTION_DUAL_LAYOUT_SCHEMA_FIELDS.has(normalizeToolInputName(name))
        && isCaptionLanguageFieldVisible(name, captionSubtitleMode)
      ))
    : baseVisibleFields
  const orderedVisibleFields = captionTool
    ? orderCaptionVisibleFields(visibleFields)
    : voiceTool
      ? orderVoiceVisibleFields(visibleFields, instantVoiceCloneTool)
      : visibleFields
  const hasMediaDownloaderSourceField = mediaDownloaderTool
    && Boolean(getSchemaEntry(effectiveSchema, 'url'))
  const hasMediaDownloaderDownloadFields = mediaDownloaderTool && mode !== 'metadata'
  if (
    orderedVisibleFields.length === 0
    && !hasStorageMediaField
    && !hasMediaDownloaderSourceField
    && !hasMediaDownloaderDownloadFields
    && !mediaTransformTool
    && !angleTool
    && !magicClipsTool
    && !videoToGifTool
    && !frameExtractTool
  ) return null

  return (
    <div className="space-y-4">
      {angleTool ? (
        <AngleInputFields
          channelId={activeChannelId}
          sourceMedia={sourceMedia}
          values={values}
          onValueChange={onValueChange}
          onStorageMediaSelectionChange={(selection: MediaTransformSelectedMedia | null) => {
            onStorageMediaSelectionChange(selection)
          }}
          onBusyChange={(busy) => onSourceImageUploadStateChange('source_image', busy)}
        />
      ) : null}
      {magicClipsTool ? (
        <MagicClipsInputFields
          channelId={activeChannelId}
          values={values}
          captionStyleValues={getSchemaOptionValues(
            getSchemaEntry(effectiveSchema, 'caption_style')?.port ?? {},
          )}
          sourceLanguageOptions={transcriptionLanguageOptions.map((option) => ({
            ...option,
            ...getLanguageDisplay(option.value, option.label),
          }))}
          estimateState={viralClipsEstimateState}
          censorBeepEnabled={getSchemaOptionValues(getSchemaEntry(effectiveSchema, 'censor_audio_mode')?.port ?? {}).includes('beep')}
          onValueChange={onValueChange}
          onStorageMediaSelectionChange={(selection: MediaTransformSelectedMedia | null) => {
            onStorageMediaSelectionChange(selection)
          }}
          onBusyChange={(busy) => onSourceImageUploadStateChange('storage_object_id', busy)}
        />
      ) : null}
      {mediaTransformTool ? (
        <MediaTransformInputFields
          channelId={activeChannelId}
          values={values}
          onValueChange={onValueChange}
          onStorageMediaSelectionChange={(selection: MediaTransformSelectedMedia | null) => {
            onStorageMediaSelectionChange(selection)
          }}
          onBusyChange={(busy) => onSourceImageUploadStateChange('storage_object_id', busy)}
        />
      ) : null}
      {videoToGifTool ? (
        <VideoToGifInputFields
          channelId={activeChannelId}
          sourceMedia={sourceMedia}
          values={values}
          onValueChange={onValueChange}
          onStorageMediaSelectionChange={(selection: MediaTransformSelectedMedia | null) => {
            onStorageMediaSelectionChange(selection)
          }}
          onBusyChange={(busy) => onSourceImageUploadStateChange('storage_object_id', busy)}
        />
      ) : null}
      {frameExtractTool ? (
        <FrameExtractInputFields
          channelId={activeChannelId}
          values={values}
          onValueChange={onValueChange}
          onStorageMediaSelectionChange={(selection: MediaTransformSelectedMedia | null) => {
            onStorageMediaSelectionChange(selection)
          }}
          onBusyChange={(busy) => onSourceImageUploadStateChange('storage_object_id', busy)}
        />
      ) : null}
      {hasStorageMediaField ? (
        <ToolField label={tAuto('media_0c77aeec')} hint={tAuto('required_eed6bfb4')}>
          <StorageMediaInput
            channelId={activeChannelId}
            value={stringifySchemaValue(values.storage_object_id)}
            selectedName={selectedMediaName}
            mediaKind={captionTool ? 'video' : 'audio-video'}
            onBusyChange={(busy) => onSourceImageUploadStateChange('storage_object_id', busy)}
            onChange={(selection: StorageMediaSelection | null) => {
              onStorageMediaSelectionChange(selection ? {
                channelId: activeChannelId,
                storageObjectId: selection.storageObjectId,
                name: selection.name,
                mimeType: selection.mimeType,
                durationSeconds: selection.durationSeconds,
                previewUrl: selection.previewUrl,
                width: selection.width,
                height: selection.height,
                dimensionSource: selection.dimensionSource,
              } : null)
              setSelectedMedia(selection ? {
                id: selection.storageObjectId,
                name: selection.name,
                previewUrl: selection.previewUrl,
                width: selection.width,
                height: selection.height,
                dimensionSource: selection.dimensionSource,
                durationSeconds: selection.durationSeconds,
              } : null)
              onValueChange('storage_object_id', selection?.storageObjectId)
              onValueChange('media_ref', undefined)
              if (captionTool) {
                onValueChange('video_url', undefined)
                onValueChange('video_duration', selection?.durationSeconds ?? undefined)
                onValueChange(
                  'video_width',
                  selection?.dimensionSource === 'source' ? selection.width ?? undefined : undefined,
                )
                onValueChange(
                  'video_height',
                  selection?.dimensionSource === 'source' ? selection.height ?? undefined : undefined,
                )
              }
            }}
          />
          {captionTool && selectedStorageObjectId ? (
            <p className="mt-1.5 text-xs text-muted-foreground" role="status">
              {captionTranscriptQuery.isLoading
                ? tAuto('checking_transcript_cache_aca0fee6')
                : captionTranscriptQuery.isError
                  ? tAuto('transcript_cache_could_not_be_checked_here_the_w_d41574ef')
                : captionTranscriptQuery.data?.some((artifact) => artifact.status === 'ready')
                  ? `Ready transcript found: reused at zero transcript credits. Caption render is 0.02 credits/sec based on video duration.${captionTranslationPricingNote}`
                  : `No reusable transcript found: video audio is transcribed first and priced separately. Caption render is 0.02 credits/sec based on video duration.${captionTranslationPricingNote}`}
            </p>
          ) : null}
        </ToolField>
      ) : null}
      {hasMediaDownloaderSourceField ? (
        <MediaDownloaderSourceField
          url={stringifySchemaValue(values.url)}
          onUrlChange={(value) => {
            onValueChange('url', value)
            onValueChange('urls', undefined)
            onValueChange('allow_playlist', undefined)
          }}
        />
      ) : null}
      {hasMediaDownloaderDownloadFields && inputContract ? (
        <MediaDownloaderDownloadFields
          inputContract={inputContract}
          schema={effectiveSchema}
          values={values}
          quote={mediaDownloaderQuote}
          onValueChange={onValueChange}
        />
      ) : null}
      {orderedVisibleFields.map(([name, rawPort]) => {
        const port = getPortRecord(rawPort)
        const normalizedName = normalizeToolInputName(name)
        const voiceNameField = instantVoiceCloneTool && normalizedName === 'display_name'
        const voiceStyleField = instantVoiceCloneTool && normalizedName === 'target_speech_model_id'
        const label = voiceStyleField ? 'Voice style' : formatToolInputFieldLabel(name)
        const required = readPortBoolean(port, 'required')
        const requiredForUi = required || voiceNameField
        const hint = requiredForUi
          ? voiceNameField
            ? 'Required · up to 100 characters'
            : 'Required'
          : captionTool && normalizedName === 'target_language'
            ? 'Required'
          : mediaDownloaderTool && normalizedName === 'url'
            ? 'Required'
            : captionTool && normalizedName === 'font_size'
              ? 'Shorts default: 44'
              : getStringValue(port.type)
        const allowedValues = getToolSchemaOptionValues(
          tool,
          inputContract,
          effectiveSchema,
          name,
          port,
          discoveryTool?.input_contract.input_schema,
        )
        const value = values[name] ?? port.default ?? ''

        if (isToolModelSchemaField(name) && allowedValues.length > 0) {
          return (
            <ToolModelPicker
              key={name}
              label={label}
              hint={voiceStyleField ? tAuto('choose_natural_or_expressive_cfd5f1e8') : undefined}
              models={getToolRegistryCapability(discoveryTool)
                && name === (discoveryTool?.input_contract.form_contract.standard_fields.model?.name ?? 'model_id')
                ? getModelsForTool(tool, discoveryTool)
                : getToolSchemaModels(name, allowedValues, discoveryTool?.models)}
              selectedModelId={stringifySchemaValue(value)}
              onModelChange={(nextValue) => onValueChange(name, nextValue)}
            />
          )
        }

        if (normalizedName === 'language' && voiceTool) {
          const placeholder = selectedModel
            ? voiceLanguageOptions.length > 0
              ? 'Select a language'
              : 'No supported languages published for this model'
            : 'Select a model first'
          return (
            <ToolSelectField
              key={name}
              label={tAuto('language_89b86ab0')}
              hint={required ? tAuto('required_supported_by_the_selected_model_255d2b13') : tAuto('selected_model_languages_8faad570')}
              value={stringifySchemaValue(value)}
              options={voiceLanguageOptions}
              placeholder={placeholder}
              disabled={!selectedModel || voiceLanguageOptions.length === 0}
              onValueChange={(nextValue) => {
                setVoiceCompatibilityNotice(null)
                onValueChange(name, nextValue)
                onValueChange(
                  'voice_profile_id',
                  speechGenerateTool ? DEFAULT_VOICE_PROFILE_ID : undefined,
                )
              }}
            />
          )
        }

        if (normalizedName === 'voice_profile_id') {
          return (
            <div key={name} className="space-y-1.5">
              <ToolField label={label} hint={tAuto('model_and_language_compatible_defaults_automatic_851018be')}>
                <VoiceProfilePickerDialog
                  channelId={activeChannelId}
                  modelId={selectedVoiceModelId}
                  modelLanguages={voiceLanguageOptions.map((option) => option.value)}
                  defaultLanguage={selectedVoiceLanguage || null}
                  profiles={compatibleVoiceProfiles}
                  value={stringifySchemaValue(value) || 'default'}
                  disabled={!canQueryCompatibleVoiceProfiles}
                  stockLoading={stockVoiceProfilesQuery.isLoading}
                  customLoading={customVoiceProfilesQuery.isLoading}
                  stockError={stockVoiceProfilesQuery.isError}
                  customError={customVoiceProfilesQuery.isError}
                  onRetryStock={() => { void stockVoiceProfilesQuery.refetch() }}
                  onRetryCustom={() => { void customVoiceProfilesQuery.refetch() }}
                  onValueChange={(nextValue) => {
                    setVoiceCompatibilityNotice(null)
                    onValueChange(name, nextValue)
                  }}
                />
              </ToolField>
              {voiceCompatibilityNotice ? (
                <p role="status" className="text-xs leading-5 text-amber-700 dark:text-amber-300">
                  {voiceCompatibilityNotice}
                </p>
              ) : null}
            </div>
          )
        }

        if (normalizedName === 'reference_storage_object_id') {
          const referenceId = stringifySchemaValue(value)
          return (
            <ToolField key={name} label={tAuto('reference_recording_9aff77b2')} hint={required ? tAuto('required_5_10_second_recording_7d425695') : undefined}>
              <VoiceReferenceAudioInput
                channelId={activeChannelId}
                value={referenceId}
                inputSchema={effectiveSchema}
                disabled={!selectedModel}
                uploadMetadata={{
                  asset_kind: 'voice_reference',
                  origin_node_type: 'voice_clone@1',
                  memory_indexing: 'disabled',
                }}
                onBusyChange={(busy) => onSourceImageUploadStateChange(name, busy)}
                onChange={(storageObjectId) => {
                  onValueChange(name, storageObjectId ?? undefined)
                  onValueChange(VOICE_CLONE_SELF_ATTESTATION_DRAFT_KEY, false)
                  onStorageMediaSelectionChange(storageObjectId ? {
                    channelId: activeChannelId,
                    storageObjectId,
                    name: 'Trimmed voice reference',
                    mimeType: 'audio/wav',
                    durationSeconds: null,
                    previewUrl: null,
                    width: null,
                    height: null,
                  } : null)
                }}
              />
            </ToolField>
          )
        }

        if (isImageSourceSchemaEntry(tool, name, port, mode)) {
          return (
            <ToolSourceImageField
              key={name}
              name={name}
              port={port}
              value={getSourceImageFieldDisplayValue(values, sourceImageFieldNames, name) ?? value}
              required={required || isImageSourceTask(mode)}
              activeChannelId={activeChannelId}
              onValueChange={handleSourceImageValueChange}
              onUploadStateChange={onSourceImageUploadStateChange}
            />
          )
        }

        if (shouldRenderToolSchemaSelect(allowedValues, captionTool, normalizedName)) {
          const rawSelectValue = stringifySchemaValue(value)
          const selectedCaptionStyle = stringifySchemaValue(values.style_name) || 'auto'
          const resolvedCaptionStyle = activeSelectedMedia
            ? resolveCaptionPreviewStyleName(
              selectedCaptionStyle,
              activeSelectedMedia.width,
              activeSelectedMedia.height,
              activeSelectedMedia.durationSeconds,
            )
            : selectedCaptionStyle
          const resolvedDefaultPosition = activeSelectedMedia
            ? resolveCaptionPreviewPosition(
              selectedCaptionStyle,
              activeSelectedMedia.width,
              activeSelectedMedia.height,
              activeSelectedMedia.durationSeconds,
            )
            : 'bottom'
          const captionStyleField = captionTool && normalizedName === 'style_name'
          const captionPositionField = captionTool && normalizedName === 'position'
          const selectValue = captionStyleField && rawSelectValue === 'auto' && activeSelectedMedia
            ? resolvedCaptionStyle
            : captionPositionField && rawSelectValue === 'style_default' && activeSelectedMedia
              ? resolvedDefaultPosition
              : rawSelectValue
          const effectiveAllowedValues = captionStyleField
            ? Array.from(new Set(['auto', ...CAPTION_STYLE_NAMES, ...allowedValues.map(stringifySchemaValue)]))
            : allowedValues
          const languageField = isLanguageCodeToolField(normalizedName)
          const selectOptions = effectiveAllowedValues.map((option) => {
            const optionValue = stringifySchemaValue(option)
            const optionLabel = captionStyleField && stringifySchemaValue(option) === 'auto' && activeSelectedMedia
              ? `Auto · ${formatSchemaOptionLabel(resolvedCaptionStyle)}`
              : captionPositionField && stringifySchemaValue(option) === 'style_default' && activeSelectedMedia
                ? `Default · ${formatSchemaOptionLabel(resolvedDefaultPosition)}`
                : formatSchemaOptionLabelForField(name, optionValue) || 'Option'
            return {
              value: optionValue,
              label: optionLabel,
              ...(languageField ? getLanguageDisplay(optionValue, optionLabel) : {}),
            }
          })
          const captionFieldHelp = captionTool
            ? getCaptionSchemaFieldHelp(normalizeToolInputName(name), rawSelectValue, selectValue)
            : null
          const selectField = captionStyleField ? (
            <CaptionStylePicker
              label={label}
              hint={`${Math.max(0, selectOptions.length - 1)} styles + Auto`}
              value={rawSelectValue}
              options={selectOptions}
              resolvedStyleName={resolvedCaptionStyle}
              onValueChange={(nextValue) => onValueChange(name, nextValue)}
            />
          ) : (
            <ToolSelectField
              label={label}
              hint={voiceStyleField
                  ? tAuto('choose_natural_or_expressive_cfd5f1e8')
                  : undefined}
              value={selectValue}
              placeholder={tAuto('select_85982229')}
              options={selectOptions}
              onValueChange={(nextValue) => onValueChange(name, nextValue)}
            />
          )
          const captionDualSettings = captionStyleField && captionSubtitleMode === 'bilingual' ? (
            <CaptionDualLanguageSettings
              fontSize={getNumberValue(
                values.font_size ?? getSchemaEntry(effectiveSchema, 'font_size')?.port.default,
              ) ?? DEFAULT_CAPTION_FONT_SIZE}
              bilingualOrder={normalizeCaptionBilingualOrder(
                values.bilingual_order ?? getSchemaEntry(effectiveSchema, 'bilingual_order')?.port.default,
              )}
              sourceStyleName={normalizeCaptionDualStyleName(
                values.source_style_name ?? getSchemaEntry(effectiveSchema, 'source_style_name')?.port.default,
              )}
              translationStyleName={normalizeCaptionDualStyleName(
                values.translation_style_name ?? getSchemaEntry(effectiveSchema, 'translation_style_name')?.port.default,
              )}
              sourceFontScale={normalizeCaptionFontScale(
                values.source_font_scale ?? getSchemaEntry(effectiveSchema, 'source_font_scale')?.port.default,
                0.8,
              )}
              translationFontScale={normalizeCaptionFontScale(
                values.translation_font_scale ?? getSchemaEntry(effectiveSchema, 'translation_font_scale')?.port.default,
                1,
              )}
              styleOptions={selectOptions}
              onBilingualOrderChange={(order) => onValueChange('bilingual_order', order)}
              onSourceStyleNameChange={(styleName) => onValueChange('source_style_name', styleName)}
              onTranslationStyleNameChange={(styleName) => onValueChange('translation_style_name', styleName)}
              onSourceFontScaleChange={(scale) => onValueChange('source_font_scale', scale)}
              onTranslationFontScaleChange={(scale) => onValueChange('translation_font_scale', scale)}
            />
          ) : null
          return (
            <div key={name} className="space-y-3">
              {selectField}
              {captionFieldHelp ? (
                <p className="text-xs leading-5 text-muted-foreground">{captionFieldHelp}</p>
              ) : null}
              {captionDualSettings}
            </div>
          )
        }

        if (isBooleanPort(port)) {
          return (
            <ToolToggleRow
              key={name}
              icon={SlidersHorizontal}
              label={label}
              description={toBoolean(value) ? tAuto('on_e0049a66') : tAuto('off_e3de5ab0')}
              checked={toBoolean(value)}
              onCheckedChange={(checked) => onValueChange(name, checked)}
            />
          )
        }

        if (isNumberPort(port)) {
          if (captionTool && normalizedName === 'font_size') {
            const min = getNumberValue(port.min_value) ?? 18
            const max = getNumberValue(port.max_value) ?? 96
            const currentValue = clampNumber(getFiniteNumber(value) ?? DEFAULT_CAPTION_FONT_SIZE, min, max)
            return (
              <div key={name} className="space-y-1.5">
                <ToolSliderField
                  label={label}
                  value={currentValue}
                  min={min}
                  max={max}
                  suffix=" px"
                  presets={[28, 36, 44, 56, 68]}
                  onValueChange={(nextValue) => onValueChange(name, nextValue)}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  <UiText id="responsive_output_size_the_preview_uses_the_same_95c8d28a" /></p>
              </div>
            )
          }
          return (
            <ToolField key={name} label={label} hint={hint ?? undefined}>
              <Input
                type="number"
                value={value === undefined || value === null ? '' : String(value)}
                min={getNumberValue(port.min_value) ?? undefined}
                max={getNumberValue(port.max_value) ?? undefined}
                onChange={(event) => {
                  const nextValue = event.target.value
                  onValueChange(name, nextValue === '' ? undefined : Number(nextValue))
                }}
                className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
              />
            </ToolField>
          )
        }

        if (isListPort(port)) {
          return (
            <ToolField key={name} label={label} hint={tAuto('one_item_per_line_1a3b90f7')}>
              <Textarea
                value={formatSchemaListEditorValue(value)}
                onChange={(event) => onValueChange(name, event.target.value)}
                placeholder={getTranslatedToolCopy(toolCopy, port.description) ?? label}
                className="min-h-24 resize-y rounded-xl border-border bg-panel/40 shadow-none"
              />
            </ToolField>
          )
        }

        if (isObjectPort(port)) {
          return (
            <ToolField key={name} label={label} hint={tAuto('json_object_6b9e9002')}>
              <Textarea
                value={formatSchemaObjectEditorValue(value)}
                onChange={(event) => onValueChange(name, event.target.value)}
                placeholder={getTranslatedToolCopy(toolCopy, port.description) ?? label}
                className="min-h-32 resize-y rounded-xl border-border bg-panel/40 font-mono text-xs shadow-none"
              />
            </ToolField>
          )
        }

        return (
          <ToolField key={name} label={label} hint={hint ?? undefined}>
            <Input
              type={isUrlToolSchemaField(name) ? 'url' : 'text'}
              value={value === undefined || value === null ? '' : String(value)}
              onChange={(event) => onValueChange(name, event.target.value)}
              placeholder={voiceNameField ? tAuto('name_this_voice_344cd966') : getTranslatedToolCopy(toolCopy, port.description) ?? label}
              maxLength={voiceNameField ? 100 : undefined}
              required={requiredForUi}
              aria-required={requiredForUi}
              className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
            />
          </ToolField>
        )
      })}
      {instantVoiceCloneTool ? (
        <ToolField label={tAuto('voice_consent_f751b1ed')} hint={tAuto('required_eed6bfb4')}>
          <div className="rounded-xl border border-border bg-panel/40 p-3.5">
            <label
              htmlFor={voiceConsentCheckboxId}
              className={cn(
                'flex items-start gap-3 text-sm leading-5',
                (!activeChannelId || !selectedVoiceReferenceId) && 'cursor-not-allowed opacity-60',
              )}
            >
              <Checkbox
                id={voiceConsentCheckboxId}
                checked={voiceCloneSelfAttestationAccepted}
                disabled={!activeChannelId || !selectedVoiceReferenceId}
                onCheckedChange={(checked) => {
                  onValueChange(VOICE_CLONE_SELF_ATTESTATION_DRAFT_KEY, checked === true)
                }}
                className="mt-0.5"
              />
              <span>
                <UiText id="i_confirm_this_recording_is_my_own_voice_and_aut_56fd464b" /></span>
            </label>
            <p className="mt-2 pl-7 text-xs leading-5 text-muted-foreground">
              <UiText id="changing_the_recording_voice_style_language_or_c_ce6cbf88" /></p>
          </div>
        </ToolField>
      ) : null}
    </div>
  )
}

function MediaDownloaderSourceField({
  url,
  onUrlChange,
}: {
  url: string
  onUrlChange: (value: string) => void
}) {
  const tAuto = useTranslations('Auto')
  const validationError = getMediaDownloaderSourceValidationError(url)
  const localizedError = validationError === MEDIA_DOWNLOADER_URL_TOO_LONG_ERROR
    ? tAuto('media_downloader_url_too_long')
    : validationError
      ? tAuto('media_downloader_video_url_invalid')
      : null

  return (
    <ToolField label={tAuto('media_downloader_source_url')} hint={tAuto('required_eed6bfb4')}>
      <div className="space-y-1.5">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            aria-label={tAuto('media_url_89d43962')}
            aria-invalid={Boolean(localizedError)}
            aria-describedby={localizedError ? 'media-downloader-single-url-error' : 'media-downloader-supported-sources'}
            className={cn(
              'h-12 rounded-xl bg-panel/40 pl-10 shadow-none',
              localizedError
                ? 'border-destructive focus-visible:ring-destructive'
                : 'border-border',
            )}
          />
        </div>
        {localizedError ? (
          <p id="media-downloader-single-url-error" role="alert" className="text-xs font-medium text-destructive">
            {localizedError}
          </p>
        ) : (
          <p id="media-downloader-supported-sources" className="text-[11px] leading-4 text-muted-foreground">
            {tAuto('media_downloader_supported_video_sources')}
          </p>
        )}
      </div>
    </ToolField>
  )
}

function getMediaDownloaderQualityLabel(
  variant: Pick<MediaDownloaderQuoteVariant, 'downloadVariant' | 'height' | 'label'>,
  bestAvailableAudioLabel: string,
) {
  return variant.downloadVariant === 'audio_only' && variant.height === null
    ? bestAvailableAudioLabel
    : variant.label
}

function MediaDownloaderDownloadFields({
  inputContract,
  schema,
  values,
  quote = null,
  onValueChange,
}: {
  inputContract: DiscoveryToolCatalogItem['input_contract']
  schema: Record<string, unknown>
  values: ToolSchemaValues
  quote?: ReturnType<typeof useMediaDownloaderQuote> | null
  onValueChange: (name: string, value: unknown) => void
}) {
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const outputEntry = getSchemaEntry(schema, 'download_variant')
  const outputValue = stringifySchemaValue(
    values.download_variant ?? outputEntry?.port.default ?? 'video_with_audio',
  )
  const clipMode = getMediaDownloaderClipMode(values)
  const startSeconds = getFiniteNumber(values.start_time)
  const endSeconds = getFiniteNumber(values.end_time)
  const snapshot = quote?.snapshot ?? null
  const durationLimit = snapshot?.durationSeconds != null && snapshot.durationSeconds > 0
    ? Math.floor(snapshot.durationSeconds)
    : null
  const variants = quote?.variants ?? []
  const selectedVariant = quote?.selectedVariant ?? null
  const outputLabels: Record<string, string> = {
    video_with_audio: tAuto('media_downloader_output_video_with_audio'),
    audio_only: tAuto('media_downloader_output_audio_only'),
    video_only: tAuto('media_downloader_output_video_only'),
  }

  return (
    <div className="space-y-4">
      {quote?.blockedByCredits && getMediaDownloaderInputUrl(values) ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-3.5 py-3 text-xs leading-5 text-amber-900 dark:text-amber-100" role="status">
          <div className="flex items-start gap-2">
            <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <span>{tAuto('media_downloader_credit_required')}</span>
          </div>
        </div>
      ) : null}
      {quote?.creditEligibilityFailed && getMediaDownloaderInputUrl(values) ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3.5 py-3" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-xs font-medium leading-5 text-destructive">
              {tAuto('media_downloader_credit_check_failed')}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={quote.creditEligibilityRetrying}
              onClick={() => quote.onRetryCreditEligibility?.()}
              className="h-8 shrink-0 rounded-lg"
            >
              {quote.creditEligibilityRetrying
                ? <LoaderCircle className="size-3.5 animate-spin" />
                : <RefreshCw className="size-3.5" />}
              {tAuto('retry_9f5cd8a2')}
            </Button>
          </div>
        </div>
      ) : null}
      {quote?.error ? (
        <p role="alert" className="text-xs font-medium text-destructive">{localizeRuntimeError(quote.error)}</p>
      ) : null}
      {snapshot || quote?.quoting || quote?.creditEligibilityPending ? (
        <div className="space-y-4 rounded-2xl border bg-panel/40 p-3 sm:p-4">
          <MediaDownloaderMetadataPreview
            {...(snapshot
              ? { state: 'ready' as const, metadata: snapshot, refreshing: Boolean(quote?.quoting) }
              : { state: 'loading' as const })}
            footer={snapshot ? (
              <ToolField label={tAuto('download_range_cf66c09e')}>
                <div className="space-y-3">
                  <div className="grid h-10 grid-cols-2 rounded-md bg-muted p-1" role="group" aria-label={tAuto('download_range_cf66c09e')}>
                    {([
                      { value: 'full' as const, label: tAuto('media_downloader_full_video') },
                      { value: 'clip' as const, label: tAuto('clip_range_5185cf1a') },
                    ]).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={clipMode === option.value}
                        onClick={() => {
                          onValueChange(MEDIA_DOWNLOADER_CLIP_MODE_FIELD, option.value)
                          if (option.value === 'full') {
                            onValueChange('start_time', undefined)
                            onValueChange('end_time', undefined)
                          } else {
                            if (startSeconds === null) onValueChange('start_time', 0)
                            if (endSeconds === null) {
                              onValueChange('end_time', durationLimit == null ? 60 : Math.max(1, Math.min(60, durationLimit)))
                            }
                          }
                        }}
                        className={cn(
                          'flex min-w-0 items-center justify-center rounded px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          clipMode === option.value
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {clipMode === 'clip' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <ToolField label={tAuto('start_952f3754')} hint={tAuto('media_downloader_seconds')}>
                          <Input
                            type="number"
                            min={0}
                            max={durationLimit == null ? undefined : Math.max(0, durationLimit - 1)}
                            step={1}
                            value={startSeconds ?? ''}
                            onChange={(event) => onValueChange(
                              'start_time',
                              event.target.value === '' ? undefined : Math.min(
                                durationLimit == null ? Number.MAX_SAFE_INTEGER : Math.max(0, durationLimit - 1),
                                Math.max(0, Math.trunc(Number(event.target.value))),
                              ),
                            )}
                            className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
                          />
                        </ToolField>
                        <ToolField label={tAuto('end_a2bb9d34')} hint={tAuto('media_downloader_seconds')}>
                          <Input
                            type="number"
                            min={Math.max(1, (startSeconds ?? 0) + 1)}
                            max={durationLimit ?? undefined}
                            step={1}
                            value={endSeconds ?? ''}
                            onChange={(event) => onValueChange(
                              'end_time',
                              event.target.value === '' ? undefined : Math.min(
                                durationLimit ?? Number.MAX_SAFE_INTEGER,
                                Math.max(0, Math.trunc(Number(event.target.value))),
                              ),
                            )}
                            className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
                          />
                        </ToolField>
                      </div>
                      <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2.5 text-[11px] leading-4 text-amber-950 dark:text-amber-100" role="note">
                        <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                        <p>{tAuto('media_downloader_clip_billing_notice')}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </ToolField>
            ) : null}
          >
            {snapshot ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {outputEntry ? (
                    <ToolSelectField
                      label={tAuto('media_downloader_media_type')}
                      value={outputValue}
                      options={getAdvancedFieldOptionValues(inputContract, outputEntry.name, outputEntry.port)
                        .filter((option) => stringifySchemaValue(option) !== 'metadata_only')
                        .map((option) => {
                          const value = stringifySchemaValue(option)
                          return { value, label: outputLabels[value] ?? formatSchemaOptionLabel(value) }
                        })}
                      onValueChange={(value) => onValueChange('download_variant', value)}
                    />
                  ) : null}
                  {variants.length > 0 ? (
                    <ToolSelectField
                      label={tAuto('quality_a60f2c73')}
                      value={selectedVariant?.variantId ?? ''}
                      disabled={Boolean(quote?.quoting)}
                      options={variants.map((variant: MediaDownloaderQuoteVariant) => ({
                        value: variant.variantId,
                        label: getMediaDownloaderQualityLabel(variant, tAuto('media_downloader_best_available_audio')),
                        description: tAuto('media_downloader_quality_option', {
                          label: getMediaDownloaderQualityLabel(variant, tAuto('media_downloader_best_available_audio')),
                          size: formatEstimatedMediaSize(variant.estimatedMediaBytes),
                          credits: formatQuoteCredits(variant.estimatedCredits),
                        }),
                      }))}
                      onValueChange={(value) => quote?.selectVariant(value)}
                    />
                  ) : null}
                </div>
                <dl className="grid grid-cols-2 gap-3" aria-busy={Boolean(quote?.quoting)}>
                  {[
                    {
                      label: tAuto('media_downloader_estimated_size'),
                      value: selectedVariant ? formatEstimatedMediaSize(selectedVariant.estimatedMediaBytes) : '—',
                    },
                    {
                      label: tAuto('estimated_credits_7dbeefda'),
                      value: selectedVariant ? formatQuoteCredits(selectedVariant.estimatedCredits) : '—',
                    },
                  ].map((estimate) => (
                    <div key={estimate.label} className="min-w-0 space-y-1.5">
                      <dt className="text-[11px] leading-4 text-muted-foreground">{estimate.label}</dt>
                      <dd className="text-sm font-medium tabular-nums leading-4">
                        {quote?.quoting
                          ? <Skeleton aria-hidden="true" className="h-4 w-16 max-w-full rounded-full" />
                          : estimate.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </MediaDownloaderMetadataPreview>
        </div>
      ) : null}
    </div>
  )
}

function ToolSourceImageField({
  name,
  port,
  value,
  required,
  activeChannelId,
  onValueChange,
  onUploadStateChange,
}: {
  name: string
  port: Record<string, unknown>
  value: unknown
  required: boolean
  activeChannelId: string | null
  onValueChange: (name: string, value: unknown) => void
  onUploadStateChange: (name: string, uploading: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const queryClient = useQueryClient()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const uploadingRef = React.useRef(false)
  const uploadAbortRef = React.useRef<AbortController | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const currentUrl = getToolSourceImageUrl(value)
  const currentStorageObjectId = getStorageObjectIdFromUri(currentUrl)
  const editableSourceUrl = getEditableToolSourceImageUrl(currentUrl)
  const storedPreviewQuery = useQuery({
    queryKey: ['tool-source-image-delivery', activeChannelId ?? 'none', currentStorageObjectId ?? 'none'],
    queryFn: () => getStorageDeliveryUrl({
      channelId: activeChannelId!,
      objectId: currentStorageObjectId!,
      expiresInSeconds: 900,
    }),
    enabled: Boolean(activeChannelId && currentStorageObjectId && !localPreviewUrl),
    staleTime: 10 * 60_000,
    retry: false,
    refetchInterval: (query) => query.state.error
      ? false
      : storageDeliveryRefreshDelay(query.state.data),
    refetchOnWindowFocus: true,
  })
  const previewUrl = localPreviewUrl
    ?? storedPreviewQuery.data?.url
    ?? (currentStorageObjectId ? null : currentUrl)

  React.useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
    }
  }, [localPreviewUrl])

  const setSourceUrl = React.useCallback((url: string) => {
    onValueChange(name, formatSourceImageValueForPort(url, port))
  }, [name, onValueChange, port])

  const setUploadState = React.useCallback((nextUploading: boolean) => {
    uploadingRef.current = nextUploading
    setUploading(nextUploading)
    onUploadStateChange(name, nextUploading)
  }, [name, onUploadStateChange])

  React.useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort()
      uploadAbortRef.current = null
      if (uploadingRef.current) onUploadStateChange(name, false)
    }
  }, [name, onUploadStateChange])

  React.useEffect(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    if (uploadingRef.current) setUploadState(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [activeChannelId, setUploadState])

  const handleFile = React.useCallback(async (file: File | null | undefined) => {
    if (uploading) return
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please choose an image file.')
      return
    }
    if (!activeChannelId) {
      setErrorMessage('Select an active channel before uploading an image.')
      return
    }

    const nextPreviewUrl = URL.createObjectURL(file)
    setLocalPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return nextPreviewUrl
    })
    setFileName(file.name)
    setErrorMessage(null)
    setSourceUrl('')
    uploadAbortRef.current?.abort()
    const uploadController = new AbortController()
    uploadAbortRef.current = uploadController
    setUploadState(true)
    setProgress(0)

    try {
      const url = await uploadToolSourceImage(activeChannelId, file, (nextProgress) => {
        if (uploadAbortRef.current === uploadController && !uploadController.signal.aborted) {
          setProgress(nextProgress)
        }
      }, uploadController.signal)
      if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) return
      setSourceUrl(url)
      setProgress(100)
      void queryClient.invalidateQueries({ queryKey: ['storage', 'objects', activeChannelId] })
    } catch (error) {
      if (!isAbortLikeError(error)) {
        setErrorMessage(getToolAgentRequestErrorMessage(error))
      }
    } finally {
      if (uploadAbortRef.current !== uploadController) return
      uploadAbortRef.current = null
      setUploadState(false)
    }
  }, [activeChannelId, queryClient, setSourceUrl, setUploadState, uploading])

  return (
    <ToolField label={tAuto('source_image_3bd67df1')} hint={required ? tAuto('required_eed6bfb4') : undefined}>
      <div className="space-y-2.5">
        <button
          type="button"
          disabled={uploading}
          onClick={() => openFileInput(inputRef.current)}
          onDragOver={(event) => {
            event.preventDefault()
          }}
          onDrop={(event) => {
            event.preventDefault()
            void handleFile(event.dataTransfer.files.item(0))
          }}
          className={cn(
            'group flex min-h-24 w-full items-center gap-3 rounded-xl border border-dashed border-border bg-panel/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 disabled:cursor-wait disabled:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            errorMessage && 'border-destructive/45',
          )}
        >
          <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary text-muted-foreground">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : uploading ? (
              <LoaderCircle className="size-5 animate-spin text-primary" />
            ) : (
              <ImageIcon className="size-5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {fileName || getToolSourceImageFileName(editableSourceUrl) || tAuto('choose_image_6c406be5')}
            </span>
            <span className="mt-1 block truncate text-xs leading-5 text-muted-foreground">
              {uploading ? `Uploading ${progress}%` : currentUrl ? tAuto('source_image_ready_63fcb934') : tAuto('upload_or_drop_an_image_e8eddbb6')}
            </span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm transition-colors group-hover:text-foreground dark:bg-white/[0.06]">
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.item(0))
            event.currentTarget.value = ''
          }}
        />
        <Input
          value={editableSourceUrl}
          disabled={uploading}
          onChange={(event) => {
            setLocalPreviewUrl((current) => {
              if (current) URL.revokeObjectURL(current)
              return null
            })
            setFileName('')
            setErrorMessage(null)
            setSourceUrl(event.target.value.trim())
          }}
          placeholder={tAuto('image_url_35c80f96')}
          className="h-10 rounded-xl border-border bg-panel/40 text-sm shadow-none"
        />
        {errorMessage ? (
          <p className="text-xs font-medium text-destructive">{errorMessage}</p>
        ) : null}
      </div>
    </ToolField>
  )
}

function AdvancedToolInputFields({
  tool,
  discoveryTool,
  selectedModel,
  fields,
  values,
  captionStyleName,
  onValueChange,
}: {
  tool: ToolConfig
  discoveryTool?: DiscoveryToolCatalogItem
  selectedModel?: DiscoveryToolCatalogItem['models'][number]
  fields: Array<[string, unknown]>
  values: ToolSchemaValues
  captionStyleName?: string
  onValueChange: (name: string, value: unknown) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const inputContract = React.useMemo(
    () => discoveryTool ? getEffectiveToolInputContract(discoveryTool, selectedModel) : undefined,
    [discoveryTool, selectedModel],
  )
  const visibleFields = React.useMemo(
    () => inputContract ? getVisibleAdvancedToolFields(tool, inputContract, fields, values) : fields,
    [fields, inputContract, tool, values],
  )

  const transcriptTool = Boolean(inputContract && isTranscriptTool(tool, inputContract))
  const transcriptionLanguageOptions = React.useMemo(
    () => transcriptTool ? buildTranscriptionLanguageOptions([
      inputContract?.input_schema,
      selectedModel?.input_schema,
      discoveryTool?.input_contract.input_schema,
    ]) : [],
    [discoveryTool, inputContract, selectedModel, transcriptTool],
  )
  const sourceLanguageEntry = transcriptTool
    ? getSchemaEntry(inputContract?.input_schema ?? {}, 'source_language')
    : undefined
  const requestedSourceLanguage = sourceLanguageEntry
    ? stringifySchemaValue(values[sourceLanguageEntry.name] ?? sourceLanguageEntry.port.default) || 'auto'
    : 'auto'
  const resolvedSourceLanguage = resolvePublishedTranscriptionLanguage(
    requestedSourceLanguage,
    transcriptionLanguageOptions,
  )
  const fallbackSourceLanguage = transcriptionLanguageOptions.find((option) => option.value === 'auto')?.value
    ?? transcriptionLanguageOptions[0]?.value
    ?? 'auto'
  const fallbackSourceLanguageLabel = transcriptionLanguageOptions.find(
    (option) => option.value === fallbackSourceLanguage,
  )?.label ?? fallbackSourceLanguage
  const [sourceLanguageNotice, setSourceLanguageNotice] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!sourceLanguageEntry) return
    if (resolvedSourceLanguage) {
      if (resolvedSourceLanguage !== requestedSourceLanguage) {
        onValueChange(sourceLanguageEntry.name, resolvedSourceLanguage)
      }
      return
    }
    onValueChange(sourceLanguageEntry.name, fallbackSourceLanguage)
    queueMicrotask(() => setSourceLanguageNotice(
      `The previous source language is not supported by this model and was reset to ${fallbackSourceLanguageLabel}.`,
    ))
  }, [fallbackSourceLanguage, fallbackSourceLanguageLabel, onValueChange, requestedSourceLanguage, resolvedSourceLanguage, sourceLanguageEntry])
  if (inputContract && isCaptionTool(tool, inputContract)) {
    return (
      <CaptionAdvancedSettings
        quality={stringifySchemaValue(values.quality) || 'standard'}
        position={stringifySchemaValue(values.position) || 'bottom'}
        styleName={(captionStyleName ?? stringifySchemaValue(values.style_name)) || 'auto'}
        overrides={readCaptionVisibilityOverrides(values.overrides)}
        onQualityChange={(quality) => onValueChange('quality', quality)}
        onOverridesChange={(overrides) => onValueChange('overrides', overrides)}
      />
    )
  }

  if (inputContract && isFrameExtractTool(tool, inputContract)) {
    return (
      <FrameExtractAdvancedSettings
        values={values}
        onValueChange={onValueChange}
      />
    )
  }

  if (fields.length === 0 || !inputContract) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground dark:border-white/[0.08]">
        <UiText id="no_advanced_settings_for_this_model_ded734bb" /></div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-panel/40 p-3.5">
      {visibleFields.map(([name, rawPort]) => {
        const port = getPortRecord(rawPort)
        const label = formatToolInputFieldLabel(name)
        const hint = getResearchAdvancedFieldHint(inputContract, name)
          ?? getVoiceAdvancedFieldHint(inputContract, name, values)
          ?? getStringValue(port.type)
        const allowedValues = getAdvancedFieldOptionValues(inputContract, name, port)
        const value = values[name] ?? port.default ?? ''
        if (isToolModelSchemaField(name) && allowedValues.length > 0) {
          return (
            <ToolModelPicker
              key={name}
              label={label}
              models={getToolRegistryCapability(discoveryTool)
                && name === (discoveryTool?.input_contract.form_contract.standard_fields.model?.name ?? 'model_id')
                ? getModelsForTool(tool, discoveryTool)
                : getToolSchemaModels(name, allowedValues, discoveryTool?.models)}
              selectedModelId={stringifySchemaValue(value)}
              onModelChange={(nextValue) => onValueChange(name, nextValue)}
            />
          )
        }
        if (transcriptTool && normalizeToolInputName(name) === 'source_language') {
          const selectValue = resolvedSourceLanguage ?? fallbackSourceLanguage
          const explicitHintCount = transcriptionLanguageOptions.filter((option) => option.value !== 'auto').length
          return (
            <div key={name} className="space-y-1.5">
              <ToolSearchableSelectField
                label={tAuto('source_language_c951fe11')}
                hint={explicitHintCount > 0
                  ? `Auto + ${explicitHintCount} language hints supported by this model`
                  : tAuto('automatic_detection_this_model_publishes_no_expl_e5839db0')}
                value={selectValue}
                options={transcriptionLanguageOptions.map((option) => ({
                  ...option,
                  ...getLanguageDisplay(option.value, option.label),
                }))}
                placeholder={tAuto('auto_c614ba7c')}
                searchPlaceholder={tAuto('search_language_or_code_dd825b6c')}
                emptyMessage={tAuto('no_supported_language_matches_your_search_bee84336')}
                disabled={transcriptionLanguageOptions.length === 0}
                onValueChange={(nextValue) => {
                  setSourceLanguageNotice(null)
                  onValueChange(name, nextValue)
                }}
              />
              {sourceLanguageNotice ? (
                <p role="status" className="text-xs leading-5 text-amber-700 dark:text-amber-300">{sourceLanguageNotice}</p>
              ) : null}
            </div>
          )
        }

        if (allowedValues.length > 0) {
          const selectValue = stringifySchemaValue(value)
          return (
            <ToolSelectField
              key={name}
              label={label}
              value={selectValue}
              placeholder={tAuto('select_85982229')}
              options={allowedValues.map((option) => {
                const optionValue = stringifySchemaValue(option)
                const optionLabel = formatSchemaOptionLabelForField(name, optionValue)
                return {
                  value: optionValue,
                  label: optionLabel,
                  ...(isLanguageCodeToolField(name)
                    ? getLanguageDisplay(optionValue, optionLabel)
                    : {}),
                }
              })}
              onValueChange={(nextValue) => onValueChange(name, nextValue)}
            />
          )
        }

        if (isBooleanPort(port)) {
          return (
            <ToolToggleRow
              key={name}
              icon={SlidersHorizontal}
              label={label}
              description={toBoolean(value) ? tAuto('on_e0049a66') : tAuto('off_e3de5ab0')}
              checked={toBoolean(value)}
              onCheckedChange={(checked) => onValueChange(name, checked)}
            />
          )
        }

        if (isNumberPort(port)) {
          return (
            <ToolField key={name} label={label} hint={hint ?? undefined}>
              <Input
                type="number"
                value={value === undefined || value === null ? '' : String(value)}
                min={getNumberValue(port.min_value) ?? undefined}
                max={getNumberValue(port.max_value) ?? undefined}
                onChange={(event) => {
                  const nextValue = event.target.value
                  onValueChange(name, nextValue === '' ? undefined : Number(nextValue))
                }}
                className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
              />
            </ToolField>
          )
        }

        if (isListPort(port)) {
          return (
            <ToolField key={name} label={label} hint={normalizeToolInputName(name) === 'keywords' ? tAuto('up_to_5_one_per_line_17f78744') : isUrlToolSchemaField(name) ? tAuto('one_url_per_line_4d0dab24') : tAuto('one_value_per_line_41f6ca4b')}>
              <Textarea
                value={formatSchemaListEditorValue(value)}
                onChange={(event) => onValueChange(name, event.target.value)}
                placeholder={getTranslatedToolCopy(toolCopy, port.description) ?? label}
                className="min-h-28 resize-y rounded-xl border-border bg-panel/40 shadow-none"
              />
            </ToolField>
          )
        }


        if (isObjectPort(port)) {
          return (
            <ToolField key={name} label={label} hint={tAuto('json_object_6b9e9002')}>
              <Textarea
                value={formatSchemaObjectEditorValue(value)}
                onChange={(event) => onValueChange(name, event.target.value)}
                placeholder={getTranslatedToolCopy(toolCopy, port.description) ?? label}
                className="min-h-32 resize-y rounded-xl border-border bg-panel/40 font-mono text-xs shadow-none"
              />
            </ToolField>
          )
        }

        return (
          <ToolField key={name} label={label} hint={hint ?? undefined}>
            <Input
              type={isUrlToolSchemaField(name) ? 'url' : 'text'}
              value={value === undefined || value === null ? '' : String(value)}
              onChange={(event) => onValueChange(name, event.target.value)}
              placeholder={getTranslatedToolCopy(toolCopy, port.description) ?? label}
              className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
            />
          </ToolField>
        )
      })}
    </div>
  )
}

function getVisibleAdvancedToolFields(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  fields: Array<[string, unknown]>,
  values: ToolSchemaValues,
) {
  if (isSpeechGenerateInputContract(inputContract)) {
    return fields.filter(([name]) => isVoiceControlVisible(inputContract.input_schema, name, values))
  }
  if (!isResearchAgentTool(tool, inputContract)) return fields
  const executionPort = getPortRecord(fields.find(([name]) => normalizeToolInputName(name) === 'execution')?.[1])
  const execution = stringifySchemaValue(values.execution ?? executionPort.default) || 'research'
  const operation = stringifySchemaValue(values.operation)
  const targetOperations = new Set(['youtube_comments', 'youtube_video_info', 'youtube_subtitles'])
  const keywordOperations = new Set([
    'google_trends',
    'keyword_expand',
    'keyword_metrics',
    'trend_compare',
    'trend_related_queries',
    'trend_related_topics',
  ])
  const trendOperations = new Set([
    'google_trends',
    'trend_compare',
    'trend_related_queries',
    'trend_related_topics',
  ])
  return fields.filter(([name]) => {
    const normalizedName = normalizeToolInputName(name)
    if (normalizedName === 'execution') return true
    if (normalizedName === 'operation') return execution === 'operation'
    if (normalizedName === 'use_case') return execution !== 'operation'
    if (normalizedName === 'target') return execution === 'operation' && targetOperations.has(operation)
    if (normalizedName === 'keywords') {
      return (execution === 'operation' && keywordOperations.has(operation))
        || execution !== 'operation'
    }
    if (normalizedName === 'time_range') {
      return execution !== 'operation' || trendOperations.has(operation)
    }
    return true
  })
}

function getResearchAdvancedFieldHint(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  name: string,
) {
  if (!inputContract.node_type.toLowerCase().startsWith('research_agent')) return null
  return {
    execution: 'Full research or one exact capability',
    operation: 'Charged only for the selected operation',
    use_case: 'Chooses the source preset automatically',
    target: 'Required only for video detail operations',
    keywords: 'Google Trends comparison terms',
    location_code: 'Search market code',
    language_code: 'Result language',
    time_range: 'Trend observation window',
    max_credits: 'Optional hard ceiling · not an extra charge',
    output_format: 'Report is recommended',
  }[normalizeToolInputName(name)] ?? null
}

function ToolCreditPill({ label, pending }: { label: string; pending: boolean }) {
  const tAuto = useTranslations('Auto')
  return <CreditPill label={label} pending={pending} pendingLabel={tAuto('credits_bfac50d6')} />
}

function isVoiceControlVisible(
  schema: Record<string, unknown>,
  name: string,
  values: ToolSchemaValues,
) {
  const requirements = getPortRecord(getPortRecord(schema.control_requirements)[normalizeToolInputName(name)])
  const supportedWhen = getPortRecord(requirements.supported_when)
  if (Object.keys(supportedWhen).length > 0 && !matchesToolFieldConditions(supportedWhen, values, schema)) {
    return false
  }
  const unsupportedWhen = getPortRecord(requirements.unsupported_when)
  return Object.keys(unsupportedWhen).length === 0
    || !matchesToolFieldConditions(unsupportedWhen, values, schema)
}

function matchesToolFieldConditions(
  conditions: Record<string, unknown>,
  values: ToolSchemaValues,
  schema: Record<string, unknown>,
) {
  return Object.entries(conditions).every(([fieldName, expected]) => {
    const current = stringifySchemaValue(
      values[fieldName] ?? getSchemaEntry(schema, fieldName)?.port.default,
    )
    const accepted = Array.isArray(expected) ? expected : [expected]
    return accepted.some((value) => stringifySchemaValue(value) === current)
  })
}

function getVoiceAdvancedFieldHint(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  name: string,
  values: ToolSchemaValues,
) {
  if (!isSpeechGenerateInputContract(inputContract)) return null
  const normalizedName = normalizeToolInputName(name)
  const outputFormat = stringifySchemaValue(
    values.output_format ?? getSchemaEntry(inputContract.input_schema, 'output_format')?.port.default,
  )
  if (normalizedName === 'bit_rate' && outputFormat === 'mp3') return 'Required for MP3 · defaults to 128 kbps'
  if (normalizedName === 'encoding') return 'PCM encoding for WAV output'
  if (normalizedName === 'sample_rate') return 'Supported by the selected model'
  return null
}

function isToolModelSchemaField(name: string) {
  return /(?:^|_)model(?:_id)?$/.test(normalizeToolInputName(name)) && !isPrivateToolFieldName(name)
}

function getToolSchemaModels(
  name: string,
  allowedValues: unknown[],
  catalogModels: DiscoveryToolCatalogItem['models'] = [],
): ToolModel[] {
  return allowedValues.map(stringifySchemaValue).filter(Boolean).map((id) => {
    const catalogModel = catalogModels.find((model) => model.id === id)
    if (catalogModel) return toToolModel(catalogModel)
    return {
      id,
      label: publicModelLabel(formatSchemaOptionLabelForField(name, id)),
      description: '',
      provider: 'Youtorch',
      mark: 'Y',
    }
  })
}

function VoiceCloneTypeField({ modelCatalogAvailable }: { modelCatalogAvailable: boolean }) {
  const tAuto = useTranslations('Auto')
  return (
    <ToolSelectField
      label={tAuto('voice_creation_type_3ddeb326')}
      hint={modelCatalogAvailable
        ? tAuto('standard_is_available_now_f67b0719')
        : tAuto('voice_catalog_unavailable_c276f846')}
      value="standard"
      options={[{ value: 'standard', label: 'Standard' }]}
      disabled
      onValueChange={() => {}}
    />
  )
}

function VideoFrameFields() {
  const tAuto = useTranslations('Auto')
  return (
    <ToolField label={tAuto('start_end_frame_51be3799')}>
      <div className="grid gap-3 md:grid-cols-2">
        <FrameDropzone label={tAuto('first_frame_1e0df64d')} description={tAuto('add_the_first_frame_c91f4925')} />
        <FrameDropzone label={tAuto('last_frame_9f8d0585')} description={tAuto('add_the_last_frame_415338c5')} muted />
      </div>
    </ToolField>
  )
}

function FrameDropzone({
  label,
  description,
  muted = false,
}: {
  label: string
  description: string
  muted?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel/40 px-4 py-5 text-center transition-colors',
        'hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        muted && 'opacity-70',
      )}
    >
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <ImageIcon className="size-5" />
      </span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="mt-1 text-xs text-muted-foreground">{description}</span>
    </button>
  )
}

type ToolOutputPanelProps = {
  tool: ToolConfig
  angleTool?: boolean
  speechGenerate?: boolean
  channelId?: string | null
  agentRun?: ToolAgentRunState
  agentRuns?: ToolAgentRunState[]
  recentOutputs?: WorkflowAgentOutputResult[]
  recentWorkflowOutputs?: ToolRecentWorkflowOutputState
  sourcePreview?: ToolRunSourceMedia | null
  captionPreview?: CaptionRunPreview & {
    media: (CaptionPreviewMedia & Pick<ToolRunSourceMedia, 'storageObjectId'>) | null
  }
  className?: string
}

function ToolOutputPanel(props: ToolOutputPanelProps) {
  const runs = props.agentRuns ?? (props.agentRun ? [props.agentRun] : [])
  if (props.speechGenerate) {
    return <SpeechToolOutputPanel {...props} />
  }

  const hasImmediateOutput = runs.some((run) => run.started)
    || Boolean(props.recentWorkflowOutputs?.items.length)
  if (props.recentWorkflowOutputs?.initialSnapshotPending && !hasImmediateOutput) {
    return <ToolRecentOutputInitialLoader className={props.className} />
  }

  if (props.captionPreview) {
    return (
      <CaptionOutputPanel
        channelId={props.channelId ?? null}
        agentRuns={props.agentRuns ?? (props.agentRun ? [props.agentRun] : [])}
        recentWorkflowOutputs={props.recentWorkflowOutputs}
        className={props.className}
      />
    )
  }

  if (isResearchToolConfig(props.tool)) {
    return <ResearchToolOutputPanel {...props} />
  }

  if (isMediaDownloaderToolConfig(props.tool)) {
    return <MediaDownloaderOutputPanel {...props} />
  }

  return <StandardToolOutputPanel {...props} />
}

type SpeechOutputEntry = {
  key: string
  prompt: string
  modelLabel: string
  voiceProfileId: string | null
  voiceDisplayName: string | null
  language: string | null
  outputFormat: string | null
  durationSeconds: number | null
  taskId: string | null
  createdAt: string | null
  statusTone: ToolOutputStatusTone
  statusLabel: string
  failureMessage: string | null
  creditLabel: string
  creditLabelTitle: 'Credits used' | 'Estimated credits'
  view: ToolRenderableOutputView
}

type SpeechOutputMetadata = {
  voiceProfileId: string | null
  voiceDisplayName: string | null
  modelId: string | null
  language: string | null
  outputFormat: string | null
  durationSeconds: number | null
}

const SPEECH_WAVEFORM_PATTERN = [
  26, 44, 33, 66, 48, 82, 57, 38, 72, 52, 91, 64,
  41, 76, 55, 87, 46, 69, 35, 61, 84, 49, 73, 42,
  63, 92, 58, 37, 79, 51, 68, 31, 74, 56, 88, 47,
  71, 39, 62, 81, 53, 34, 67, 45, 77, 59, 40, 70,
] as const
const SPEECH_WAVEFORM_HEIGHTS = Array.from({ length: 96 }, (_, index) => {
  const source = SPEECH_WAVEFORM_PATTERN[index % SPEECH_WAVEFORM_PATTERN.length]!
  const variation = ((index * 17) % 15) - 7
  return Math.min(92, Math.max(24, source + variation))
})

function collectKnownVoiceProfileDisplayNames(queryClient: QueryClient) {
  const displayNames = new Map<string, string>()
  const visit = (value: unknown, depth = 0) => {
    if (!value || depth > 3) return
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1))
      return
    }
    if (typeof value !== 'object') return
    const record = value as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const displayName = typeof record.display_name === 'string' ? record.display_name.trim() : ''
    if (id && displayName) displayNames.set(id, displayName.slice(0, 120))
    if (record.data !== undefined) visit(record.data, depth + 1)
  }

  queryClient
    .getQueriesData({ queryKey: VOICE_PROFILES_QUERY_KEY })
    .forEach(([, value]) => visit(value))
  return displayNames
}

function useKnownVoiceProfileDisplayNames() {
  const queryClient = useQueryClient()
  const [displayNames, setDisplayNames] = React.useState(
    () => collectKnownVoiceProfileDisplayNames(queryClient),
  )

  React.useEffect(() => {
    let active = true
    let synchronizeTimer: number | null = null
    const synchronize = () => {
      if (synchronizeTimer !== null) return
      synchronizeTimer = window.setTimeout(() => {
        synchronizeTimer = null
        if (!active) return
        const nextDisplayNames = collectKnownVoiceProfileDisplayNames(queryClient)
        setDisplayNames((current) => areStringMapsEqual(current, nextDisplayNames) ? current : nextDisplayNames)
      }, 0)
    }
    synchronize()
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const queryKey = event.query.queryKey
      if (
        queryKey[0] !== VOICE_PROFILES_QUERY_KEY[0]
        || queryKey[1] !== VOICE_PROFILES_QUERY_KEY[1]
      ) return
      synchronize()
    })
    return () => {
      active = false
      if (synchronizeTimer !== null) window.clearTimeout(synchronizeTimer)
      unsubscribe()
    }
  }, [queryClient])

  return displayNames
}

function areStringMapsEqual(left: Map<string, string>, right: Map<string, string>) {
  if (left.size !== right.size) return false
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false
  }
  return true
}

function SpeechToolOutputPanel({
  channelId = null,
  agentRun,
  agentRuns,
  recentWorkflowOutputs,
  className,
}: ToolOutputPanelProps) {
  const tAuto = useTranslations('Auto')
  const runs = (agentRuns ?? (agentRun ? [agentRun] : [])).filter((run) => run.started)
  const liveIdentifiers = getToolRunIdentifiers(runs)
  const liveEntries = runs.map((run, index) => getSpeechRunOutputEntry(run, index))
  const historyEntries = (recentWorkflowOutputs?.items ?? [])
    .filter((item) => !isRecentWorkflowOutputHidden(item, liveIdentifiers))
    .filter((item) => item.nodeType.toLowerCase().startsWith('speech_generate'))
    .map(getSpeechWorkflowOutputEntry)
  const entries = [...liveEntries, ...historyEntries]
  const knownVoiceDisplayNames = useKnownVoiceProfileDisplayNames()
  const loading = Boolean(
    (recentWorkflowOutputs?.initialSnapshotPending || recentWorkflowOutputs?.loading)
    && entries.length === 0,
  )

  return (
    <ToolPanel className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-display text-xl text-foreground"><UiText id="recent_output_73c5c034" /></h2>
            <span className="truncate text-xs text-muted-foreground"><UiText id="speech_d00d8594" /></span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {entries.length > 0
              ? `${entries.length} ${entries.length === 1 ? 'recording' : 'recordings'}`
              : tAuto('generated_speech_will_appear_here_6494a5cc')}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
          <AudioLines className="size-4" />
        </span>
      </div>

      <div>
        <div className="space-y-2.5" data-speech-output-list>
          {loading ? (
            <>
              <SpeechOutputSkeleton />
              <SpeechOutputSkeleton />
            </>
          ) : entries.map((entry) => (
            <SpeechOutputRow
              key={entry.key}
              entry={entry}
              channelId={channelId}
              voiceDisplayName={
                entry.voiceDisplayName
                ?? (entry.voiceProfileId ? knownVoiceDisplayNames.get(entry.voiceProfileId) : undefined)
                ?? null
              }
            />
          ))}

          {!loading && entries.length === 0 && recentWorkflowOutputs?.errorMessage ? (
            <div className="flex min-h-32 items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 text-sm text-destructive">
              <X className="size-4 shrink-0" />
              <UiText id="recent_speech_outputs_could_not_be_loaded_259ef8e3" /></div>
          ) : null}

          {!loading && entries.length === 0 && !recentWorkflowOutputs?.errorMessage ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <AudioLines className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground"><UiText id="no_speech_yet_40a12093" /></p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                <UiText id="run_text_to_speech_to_create_your_first_recordin_9a4bc126" /></p>
            </div>
          ) : null}

          {recentWorkflowOutputs?.loadingMore ? <SpeechOutputSkeleton /> : null}
          {recentWorkflowOutputs?.hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={recentWorkflowOutputs.onLoadMore}
                disabled={recentWorkflowOutputs.loadingMore}
              >
                {recentWorkflowOutputs.loadingMore ? <LoaderCircle className="size-4 animate-spin" /> : null}
                <UiText id="load_more_dfe60ca9" /></Button>
            </div>
          ) : null}
        </div>
      </div>
    </ToolPanel>
  )
}

function SpeechOutputRow({
  entry,
  channelId,
  voiceDisplayName,
}: {
  entry: SpeechOutputEntry
  channelId: string | null
  voiceDisplayName: string | null
}) {
  const tAuto = useTranslations('Auto')
  const formatOutputDateTime = useLocalizedOutputDateTime()
  const [deliveryRetryToken, setDeliveryRetryToken] = React.useState(0)
  const delivery = useToolStorageOutputDelivery(channelId, entry.view, deliveryRetryToken)
  const [failedAudioUrl, setFailedAudioUrl] = React.useState<string | null>(null)
  const storageBacked = Boolean(entry.view.storageObjectId?.trim())
  const audioUrl = delivery.data?.url
    ?? (storageBacked ? null : entry.view.mediaUrl)
    ?? entry.view.previewUrl
  const downloadUrl = getToolStorageOutputDownloadUrl(channelId, entry.view)
    ?? (storageBacked ? null : entry.view.downloadUrl)
    ?? audioUrl
  const voiceLabel = getSpeechVoiceLabel(entry.voiceProfileId, voiceDisplayName)
  const audioUnavailable = entry.statusTone === 'ready' && (
    delivery.isError
    || (Boolean(audioUrl) && failedAudioUrl === audioUrl)
    || (storageBacked && !channelId && !audioUrl)
    || (!storageBacked && !audioUrl)
  )
  const visualStatusTone: ToolOutputStatusTone = audioUnavailable ? 'failed' : entry.statusTone
  const visualStatusLabel = audioUnavailable ? 'Failed' : entry.statusLabel
  const visualFailureMessage = audioUnavailable
    ? 'Audio output could not be loaded.'
    : entry.failureMessage
  const retryableAudioUnavailable = audioUnavailable && Boolean(
    (storageBacked && channelId)
    || failedAudioUrl,
  )

  if (visualStatusTone === 'failed') {
    return (
      <SpeechOutputFailureCard
        entry={entry}
        voiceLabel={voiceLabel}
        failureMessage={visualFailureMessage}
        retryable={retryableAudioUnavailable}
        onRetry={() => {
          setFailedAudioUrl(null)
          setDeliveryRetryToken((current) => current + 1)
        }}
      />
    )
  }

  return (
    <article
      data-speech-output-card
      data-speech-output-status={visualStatusTone}
      className="overflow-hidden rounded-2xl border border-border bg-panel/40 transition-colors hover:border-border/90"
    >
      <div className="flex min-w-0 items-start gap-3 px-3.5 pb-1.5 pt-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-1 text-sm font-semibold leading-5 text-foreground"
            title={entry.prompt}
          >
            {entry.prompt || tAuto('generated_speech_8586bf88')}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {[voiceLabel, entry.modelLabel, formatOutputDateTime(entry.createdAt ?? undefined)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <ToolOutputStateBadge
            state={visualStatusTone}
            label={visualStatusLabel}
          />
          <SpeechOutputInfo entry={entry} voiceLabel={voiceLabel} />
          {visualStatusTone === 'ready' && downloadUrl ? (
            <button
              type="button"
              aria-label={tAuto('download_speech_3c44f7c7')}
              title={tAuto('download_speech_3c44f7c7')}
              onClick={() => downloadOutputUrl(downloadUrl)}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Download className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <SpeechWaveformPlayer
        key={`${entry.key}:${deliveryRetryToken}:${audioUrl ?? 'pending'}:${entry.durationSeconds ?? 0}`}
        src={audioUrl}
        durationSeconds={entry.durationSeconds}
        processing={visualStatusTone === 'processing'}
        onPlaybackError={() => {
          if (audioUrl) setFailedAudioUrl(audioUrl)
        }}
      />
    </article>
  )
}

function SpeechOutputFailureCard({
  entry,
  voiceLabel,
  failureMessage,
  retryable,
  onRetry,
}: {
  entry: SpeechOutputEntry
  voiceLabel: string
  failureMessage: string | null
  retryable: boolean
  onRetry: () => void
}) {
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const localizedFailureMessage = failureMessage
    ? localizeRuntimeError(failureMessage)
    : tAuto('speech_could_not_be_generated_8ef53d65')
  return (
    <article
      data-speech-output-card
      data-speech-output-status="failed"
      className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border border-destructive/25 bg-card px-3.5 py-3 shadow-sm dark:border-destructive/30 sm:px-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <X className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" title={entry.prompt}>
          {entry.prompt || tAuto('generated_speech_8586bf88')}
        </p>
        <p
          className="mt-0.5 truncate text-xs text-destructive/90"
          title={localizedFailureMessage}
        >
          {localizedFailureMessage}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {retryable ? (
          <button
            type="button"
            aria-label={tAuto('retry_speech_audio_9902a3d0')}
            title={tAuto('retry_audio_48fa696d')}
            onClick={onRetry}
            className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-3.5" />
            <UiText id="retry_9f5cd8a2" /></button>
        ) : null}
        <ToolOutputStateBadge
          state="failed"
          label="Failed"
        />
        <SpeechOutputInfo entry={entry} voiceLabel={voiceLabel} />
      </div>
    </article>
  )
}

function SpeechWaveformPlayer({
  src,
  durationSeconds,
  processing,
  onPlaybackError,
}: {
  src: string | null
  durationSeconds: number | null
  processing: boolean
  onPlaybackError: () => void
}) {
  const tAuto = useTranslations('Auto')
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [currentSeconds, setCurrentSeconds] = React.useState(0)
  const [resolvedDuration, setResolvedDuration] = React.useState(durationSeconds ?? 0)
  const [failed, setFailed] = React.useState(false)

  const duration = resolvedDuration > 0 ? resolvedDuration : durationSeconds ?? 0
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentSeconds / duration)) : 0
  const waitingForAudio = !processing && !failed && !src

  const togglePlayback = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio || failed || processing) return
    if (audio.paused) {
      void audio.play().catch(() => {
        setFailed(true)
        onPlaybackError()
      })
    } else {
      audio.pause()
    }
  }, [failed, onPlaybackError, processing])

  const seek = React.useCallback((value: number) => {
    const audio = audioRef.current
    if (!audio || duration <= 0) return
    const nextSeconds = Math.max(0, Math.min(duration, (value / 100) * duration))
    audio.currentTime = nextSeconds
    setCurrentSeconds(nextSeconds)
  }, [duration])

  return (
    <div className="flex min-h-[4.5rem] items-center gap-3 px-3.5 pb-3 sm:px-4">
      <button
        type="button"
        aria-label={playing ? tAuto('pause_speech_d559b41e') : tAuto('play_speech_56cd933c')}
        title={playing ? tAuto('pause_781961bc') : tAuto('play_5d12bd53')}
        onClick={togglePlayback}
        disabled={!src || processing || failed}
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          src && !processing && !failed
            ? 'bg-[#315f36] text-white hover:bg-[#397041]'
            : 'cursor-not-allowed bg-muted text-muted-foreground',
        )}
      >
        {processing || waitingForAudio ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="ml-0.5 size-4 fill-current" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative flex h-8 min-w-0 flex-1 items-center justify-between gap-px overflow-hidden rounded-md focus-within:ring-2 focus-within:ring-ring/70 focus-within:ring-offset-2 focus-within:ring-offset-background sm:gap-0.5">
          {SPEECH_WAVEFORM_HEIGHTS.map((height, index) => {
            const played = (index + 1) / SPEECH_WAVEFORM_HEIGHTS.length <= progress
            return (
              <span
                key={`${height}:${index}`}
                aria-hidden="true"
                className={cn(
                  'w-px shrink-0 origin-center rounded-full transition-colors sm:w-0.5',
                  played ? 'bg-[#70a979]' : 'bg-foreground/16 dark:bg-white/20',
                  processing && 'motion-safe:animate-[voice-wave_1.05s_ease-in-out_infinite] motion-reduce:animate-none',
                )}
                style={{
                  height: `${height}%`,
                  ...(processing ? {
                    animationDelay: `${-(index % 12) * 55}ms`,
                    animationDuration: `${900 + (index % 5) * 70}ms`,
                  } : {}),
                }}
              />
            )
          })}
          {!processing && src && duration > 0 ? (
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress * 100}
              onChange={(event) => seek(Number(event.currentTarget.value))}
              aria-label={tAuto('seek_speech_327cbc41')}
              aria-valuetext={`${formatTranscriptTimestamp(currentSeconds)} / ${formatTranscriptTimestamp(duration)}`}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          ) : null}
        </div>
        <span className="min-w-[5.25rem] shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
          {processing
            ? '--:--'
            : failed
              ? tAuto('unavailable_2c9c1f79')
              : waitingForAudio
                ? tAuto('loading_8f26c652')
                : `${formatTranscriptTimestamp(currentSeconds)} / ${duration > 0 ? formatTranscriptTimestamp(duration) : '--:--'}`}
        </span>
      </div>

      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setCurrentSeconds(0)
          }}
          onTimeUpdate={(event) => setCurrentSeconds(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const nextDuration = event.currentTarget.duration
            if (Number.isFinite(nextDuration) && nextDuration > 0) setResolvedDuration(nextDuration)
          }}
          onError={() => {
            setPlaying(false)
            setFailed(true)
            onPlaybackError()
          }}
          className="hidden"
        />
      ) : null}
    </div>
  )
}

function SpeechOutputInfo({
  entry,
  voiceLabel,
}: {
  entry: SpeechOutputEntry
  voiceLabel: string
}) {
  const tAuto = useTranslations('Auto')
  const detailTitle = [
    `Voice: ${voiceLabel}`,
    entry.voiceProfileId ? `Voice ID: ${entry.voiceProfileId}` : null,
    entry.taskId ? `Task ID: ${entry.taskId}` : null,
    `${entry.creditLabelTitle}: ${entry.creditLabel}`,
  ].filter(Boolean).join(' · ')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={tAuto('speech_details_55673472')}
          title={detailTitle}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={tAuto('speech_details_55673472')}
        className="w-80 space-y-3 p-3.5"
      >
        <div>
          <p className="text-sm font-semibold text-foreground"><UiText id="speech_details_55673472" /></p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <UiText id="provider_routing_stays_private_these_are_your_pu_f00b94dd" /></p>
        </div>
        <dl className="space-y-2 text-xs">
          <SpeechOutputInfoRow label={tAuto('voice_3091c844')} value={voiceLabel} />
          <SpeechOutputInfoRow
            label={tAuto('voice_id_20b8e0f4')}
            value={entry.voiceProfileId || 'default'}
            copyValue={entry.voiceProfileId || 'default'}
            mono
          />
          <SpeechOutputInfoRow label={tAuto('model_68c2cc7f')} value={entry.modelLabel} />
          {entry.language ? <SpeechOutputInfoRow label={tAuto('language_89b86ab0')} value={formatTranscriptLanguage(entry.language)} /> : null}
          {entry.outputFormat ? <SpeechOutputInfoRow label={tAuto('format_041a5dec')} value={entry.outputFormat.toUpperCase()} /> : null}
          <SpeechOutputInfoRow label={entry.creditLabelTitle} value={entry.creditLabel} />
          {entry.durationSeconds != null ? (
            <SpeechOutputInfoRow label={tAuto('duration_1370004d')} value={formatTranscriptTimestamp(entry.durationSeconds)} />
          ) : null}
          {entry.taskId ? (
            <SpeechOutputInfoRow label={tAuto('task_id_0491c6d4')} value={entry.taskId} copyValue={entry.taskId} mono />
          ) : null}
        </dl>
      </PopoverContent>
    </Popover>
  )
}

function SpeechOutputInfoRow({
  label,
  value,
  copyValue,
  mono = false,
}: {
  label: string
  value: string
  copyValue?: string
  mono?: boolean
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('flex min-w-0 items-center justify-end gap-1.5 text-right font-medium text-foreground', mono && 'font-mono text-[10px]')}>
        <span className="truncate" title={value}>{value}</span>
        {copyValue ? (
          <button
            type="button"
            aria-label={tAuto('copy_named', { name: label })}
            title={tAuto('copy_named', { name: label })}
            onClick={() => copyTextToClipboard(copyValue)}
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy className="size-3" />
          </button>
        ) : null}
      </dd>
    </div>
  )
}

function SpeechOutputSkeleton() {
  const tAuto = useTranslations('Auto')
  return (
    <div
      aria-busy="true"
      aria-label={tAuto('loading_speech_output_4d6f9914')}
      className="rounded-xl border border-border bg-card px-4 py-3.5 dark:border-white/[0.08]"
    >
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  )
}

function getSpeechRunOutputEntry(run: ToolAgentRunState, index: number): SpeechOutputEntry {
  const status = run.status?.status ?? (run.launch ? 'queued' : 'starting')
  const failureMessage = run.errorMessage
    ? formatToolRunErrorMessage(run.errorMessage, run.status?.nodes ?? [])
    : null
  const failed = Boolean(failureMessage) || isFailedRunStatus(status) || status?.toLowerCase() === 'insufficient_balance'
  const metadata = getSpeechOutputMetadata(run.output?.output)
  const media = collectAgentOutputMedia(run.output, 'Generated speech', 'audio')
    .find((item) => item.kind === 'audio') ?? null
  const mediaReadiness = getStoragePresentationReadiness(media)
  const statusTone: ToolOutputStatusTone = failed || mediaReadiness === 'unavailable'
    ? 'failed'
    : canReadAgentOutput(status) && Boolean(run.output) && mediaReadiness !== 'processing'
      ? 'ready'
      : 'processing'
  const mediaUrl = media?.url && isUsableOutputUrl(media.url) ? media.url : null
  const storageObjectId = media?.storageObjectId ?? getAgentOutputStorageObjectId(run.output)
  const estimatedCredits = run.status?.totalCreditsEstimated
    ?? run.launch?.total_credits_estimated
    ?? run.estimate?.total_credits_estimated
    ?? run.estimatedCredits
    ?? 0
  const chargedCredits = getRunChargedCredits(run)
  const settled = statusTone !== 'processing'
  const creditValue = chargedCredits > 0 ? chargedCredits : settled ? 0 : estimatedCredits
  const taskId = getToolAgentRunIdentifier(run)
  const modelLabel = formatPublicModelLabel(run.modelLabel ?? metadata.modelId, 'Natural')
  const createdAt = run.output?.createdAt ?? run.requestedAt ?? null
  const statusLabel = statusTone === 'failed'
    ? 'Failed'
    : statusTone === 'processing'
      ? getRunProgressStatusLabel(status, {
          settlementStatus: run.status?.settlementStatus,
          progress: run.status?.progress,
          outputPending: mediaReadiness === 'processing',
        })
      : 'Ready'
  const view: ToolRenderableOutputView = {
    kind: 'audio',
    label: 'Generated speech',
    prompt: run.prompt?.trim() || null,
    modelLabel,
    provider: 'Youtorch',
    createdAt: createdAt ?? '',
    statusLabel,
    statusTone,
    failureMessage,
    mediaUrl,
    previewUrl: mediaUrl,
    downloadUrl: mediaUrl,
    storageObjectId,
    fileName: media?.fileName ?? null,
    canDownload: statusTone === 'ready' && Boolean(mediaUrl || storageObjectId),
    detail: formatCreditLabel(creditValue),
    identifier: taskId ?? undefined,
  }

  return {
    key: getSpeechOutputCardKey(taskId, run.id ?? `speech-run:${index}`),
    prompt: run.prompt?.trim() || 'Generated speech',
    modelLabel,
    voiceProfileId: run.voiceProfileId ?? metadata.voiceProfileId,
    voiceDisplayName: metadata.voiceDisplayName,
    language: metadata.language,
    outputFormat: metadata.outputFormat,
    durationSeconds: metadata.durationSeconds,
    taskId,
    createdAt,
    statusTone,
    statusLabel,
    failureMessage,
    creditLabel: formatCreditLabel(creditValue),
    creditLabelTitle: settled ? 'Credits used' : 'Estimated credits',
    view,
  }
}

function getSpeechWorkflowOutputEntry(item: RecentWorkflowOutputItem): SpeechOutputEntry {
  const view = getToolWorkflowOutputView(item, 'voice')
  const metadata = getSpeechOutputMetadata(item.outputPreview)
  const primaryAudio = item.media.find((media) => (
    getRecentWorkflowMediaKind(media.kind, media.mimeType, media.url, 'voice') === 'audio'
  ))
  const chargedCredits = item.nodeCreditsCharged || item.totalCreditsCharged
  const settled = view.statusTone !== 'processing'
  const creditValue = chargedCredits > 0 ? chargedCredits : settled ? 0 : item.totalCreditsEstimated
  const taskId = getToolWorkflowOutputIdentifier(item)

  return {
    key: getSpeechOutputCardKey(taskId, item.id),
    prompt: item.prompt?.trim() || 'Generated speech',
    modelLabel: formatPublicModelLabel(item.modelLabel ?? item.modelId, 'Natural'),
    voiceProfileId: metadata.voiceProfileId,
    voiceDisplayName: metadata.voiceDisplayName,
    language: metadata.language,
    outputFormat: item.outputFormat ?? metadata.outputFormat,
    durationSeconds: primaryAudio?.durationSeconds ?? metadata.durationSeconds,
    taskId,
    createdAt: item.completedAt ?? item.createdAt ?? item.updatedAt,
    statusTone: view.statusTone,
    statusLabel: view.statusLabel,
    failureMessage: view.failureMessage,
    creditLabel: formatCreditLabel(creditValue),
    creditLabelTitle: settled ? 'Credits used' : 'Estimated credits',
    view,
  }
}

function getSpeechOutputMetadata(value: unknown): SpeechOutputMetadata {
  const metadata: SpeechOutputMetadata = {
    voiceProfileId: null,
    voiceDisplayName: null,
    modelId: null,
    language: null,
    outputFormat: null,
    durationSeconds: null,
  }
  const seen = new Set<object>()

  const visit = (candidate: unknown, depth: number) => {
    if (!candidate || typeof candidate !== 'object' || depth > 6 || seen.has(candidate)) return
    seen.add(candidate)
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, depth + 1))
      return
    }
    const record = candidate as Record<string, unknown>
    metadata.voiceProfileId ??= getStringValue(record.voice_profile_id)
      ?? getStringValue(record.voiceProfileId)
    metadata.voiceDisplayName ??= getStringValue(record.voice_profile_display_name)
      ?? getStringValue(record.voice_display_name)
      ?? getStringValue(record.voiceProfileDisplayName)
      ?? getStringValue(record.voiceDisplayName)
    metadata.modelId ??= getStringValue(record.model_id)
      ?? getStringValue(record.public_model_id)
      ?? getStringValue(record.modelId)
    metadata.language ??= getStringValue(record.language)
    metadata.outputFormat ??= getStringValue(record.output_format)
      ?? getStringValue(record.outputFormat)
    metadata.durationSeconds ??= getFiniteNumber(record.duration_seconds ?? record.durationSeconds)

    for (const key of ['result', 'metadata', 'output', 'data']) {
      visit(record[key], depth + 1)
    }
  }

  visit(value, 0)
  return metadata
}

function getSpeechVoiceLabel(voiceProfileId: string | null, voiceDisplayName: string | null = null) {
  const knownDisplayName = voiceDisplayName?.trim()
  if (knownDisplayName) return knownDisplayName.slice(0, 120)
  const normalized = voiceProfileId?.trim()
  if (!normalized || normalized === DEFAULT_VOICE_PROFILE_ID) return 'System default voice'
  return `Voice ${formatShortIdentifier(normalized)}`
}

function ToolRecentOutputInitialLoader({ className }: { className?: string }) {
  return (
    <ToolPanel className={className}>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="truncate font-display text-xl text-foreground"><UiText id="recent_output_73c5c034" /></h2>
      </div>
      <div>
        <ToolStorageOutputSkeleton compact={false} />
      </div>
    </ToolPanel>
  )
}

type MediaDownloaderTileView = {
  key: string
  downloadId: string | null
  taskId: string | null
  title: string
  sourceUrl: string | null
  storageObjectId: string | null
  kind: ToolOutputMediaKind
  openUrl: string | null
  downloadUrl: string | null
  previewUrl: string | null
  sizeBytes: number | null
  durationSeconds: number | null
  downloadElapsedSeconds: number | null
  processingElapsedSeconds: number | null
  storageStatus: string | null
  workflowReady: boolean | null
  progress: number | null
  statusTone: ToolOutputStatusTone
  statusLabel: string
  showStatus: boolean
  errorMessage: string | null
  createdAt: string | null
  detail: string | null
  taskDetails?: StorageInspectorTaskDetails
}

function MediaDownloaderOutputPanel({
  channelId = null,
  agentRun,
  agentRuns,
  recentOutputs = [],
  recentWorkflowOutputs,
  className,
}: ToolOutputPanelProps) {
  const runs = (agentRuns ?? (agentRun ? [agentRun] : [])).filter((run) => run.started)
  const recentItems = recentWorkflowOutputs?.items ?? []
  const heldRuns = runs.filter((run) => run.status?.deliveryStatus === 'payment_review'
    || run.status?.pausedReason === 'payment_risk_pending')
  const heldRunIds = getToolRunIdentifiers(heldRuns)
  const heldItems = recentItems.filter((item) => item.deliveryStatus === 'payment_review'
    && !isRecentWorkflowOutputHidden(item, heldRunIds))
  const heldHistoryIds = new Set(heldItems.flatMap((item) => [item.agentId, item.workflowId]))
  const unresolvedRuns = runs.filter((run) => !heldRuns.includes(run)
    && ![...getToolRunIdentifiers([run])].some((id) => heldHistoryIds.has(id))
    && !isMediaDownloaderRunSupersededByHistory(run, recentItems))
  const liveAgentIds = getToolRunIdentifiers([...unresolvedRuns, ...heldRuns])
  const liveTiles = unresolvedRuns.flatMap((run, index) => getMediaDownloaderRunTiles(run, index))
  const historyTiles = recentItems
    .filter((item) => item.deliveryStatus !== 'payment_review' && !isRecentWorkflowOutputHidden(item, liveAgentIds))
    .flatMap((item) => getMediaDownloaderHistoryTiles(item))
  const legacyTiles = agentRuns || heldRuns.length > 0 || heldItems.length > 0
    ? []
    : collectRecentOutputMedia(recentOutputs, runs[0]?.output?.agentId, 'video').map((media, index) => {
      const safeDirectUrl = isMediaDownloaderDirectUrlSafe(media.url, media.kind) ? media.url : null
      return {
        key: `legacy:${media.url}`,
        downloadId: null,
        taskId: null,
        title: media.label || `Downloaded video ${index + 1}`,
        sourceUrl: null,
        storageObjectId: null,
        kind: media.kind,
        openUrl: safeDirectUrl,
        downloadUrl: safeDirectUrl,
        previewUrl: null,
        sizeBytes: null,
        durationSeconds: null,
        downloadElapsedSeconds: null,
        processingElapsedSeconds: null,
        storageStatus: null,
        workflowReady: null,
        progress: null,
        statusTone: safeDirectUrl ? 'ready' as const : 'processing' as const,
        statusLabel: safeDirectUrl ? 'Ready' : 'Running',
        showStatus: !safeDirectUrl,
        errorMessage: null,
        createdAt: null,
        detail: null,
      }
    })
  const tiles = sortMediaDownloaderTilesNewestFirst(
    dedupeMediaDownloaderTiles([...liveTiles, ...legacyTiles, ...historyTiles]),
  )
  const storageHydration = useMediaDownloaderStorageReadinessBatch({ channelId, views: tiles })
  const visibleCount = tiles.length + heldRuns.length + heldItems.length
  const loading = Boolean(recentWorkflowOutputs?.loading && visibleCount === 0)

  return (
    <ToolPanel className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl text-foreground"><UiText id="downloads_a862c2b2" /></h2>
          {visibleCount > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {visibleCount} {visibleCount === 1 ? 'item' : 'items'}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <div className="space-y-2">
          {heldRuns.map((run, index) => <PaymentReviewOutputNotice key={getToolAgentRunCardKey(run, index)}
            workflowId={run.status?.workflowId}
            canResume={run.status?.pausedReason === 'payment_risk_pending' && !run.status?.deliveryStatus} />)}
          {heldItems.map((item) => <PaymentReviewOutputNotice key={item.id} />)}
          {!loading ? tiles.map((tile, index) => (
            <MediaDownloaderOutputTile
              key={tile.key}
              channelId={channelId}
              view={tile}
              storageState={tile.storageObjectId ? storageHydration.items.get(tile.storageObjectId) ?? null : null}
              onMarkStorageProcessing={storageHydration.markProcessing}
              eagerThumbnail={index < 4}
              onMarkStorageUnavailable={storageHydration.markUnavailable}
            />
          )) : null}
          {loading ? <MediaDownloaderOutputSkeleton /> : null}
          {recentWorkflowOutputs?.errorMessage && visibleCount === 0 ? (
            <div className="rounded-xl border border-border bg-panel/40 px-3 py-3 text-sm text-muted-foreground">
              <UiText id="downloads_could_not_be_loaded_58c265cf" /></div>
          ) : null}
          {!loading && visibleCount === 0 && !recentWorkflowOutputs?.errorMessage ? (
            <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-muted-foreground">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                <Download className="size-4" />
              </span>
              <p className="text-sm"><UiText id="no_downloads_yet_9647c16c" /></p>
            </div>
          ) : null}
          {recentWorkflowOutputs?.loadingMore ? <MediaDownloaderOutputSkeleton /> : null}
          {recentWorkflowOutputs?.hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={recentWorkflowOutputs.onLoadMore}
                disabled={recentWorkflowOutputs.loadingMore}
              >
                {recentWorkflowOutputs.loadingMore ? <LoaderCircle className="size-4 animate-spin" /> : null}
                <UiText id="load_more_dfe60ca9" /></Button>
            </div>
          ) : null}
        </div>
      </div>
    </ToolPanel>
  )
}

function MediaDownloaderOutputTile({
  channelId,
  view,
  storageState,
  eagerThumbnail = false,
  onMarkStorageProcessing,
  onMarkStorageUnavailable,
}: {
  channelId: string | null
  view: MediaDownloaderTileView
  storageState: MediaDownloaderStorageState | null
  eagerThumbnail?: boolean
  onMarkStorageProcessing: (storageObjectId: string) => void
  onMarkStorageUnavailable: (storageObjectId: string) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const formatOutputDateTime = useLocalizedOutputDateTime()
  const storageBacked = Boolean(channelId && view.storageObjectId)
  const storageGateEnabled = view.statusTone === 'ready' && storageBacked
  const projectedReadiness = getMediaDownloaderProjectedStorageReadiness(view)
  const storageReadiness = storageGateEnabled
    ? storageState?.readiness ?? projectedReadiness ?? null
    : null
  const storageReadinessLoading = storageGateEnabled && storageReadiness === null
  const directUrl = !storageBacked
    && view.statusTone === 'ready'
    && isMediaDownloaderDirectUrlSafe(view.openUrl, view.kind)
    ? view.openUrl
    : null
  const directDownloadUrl = directUrl && isMediaDownloaderDirectUrlSafe(view.downloadUrl, view.kind)
    ? view.downloadUrl
    : null
  const storageFileName = storageState?.object?.name?.trim() || view.title
  const storageDownloadUrl = storageReadiness === 'ready'
    && channelId
    && view.storageObjectId
    ? getStorageDownloadUrl({ channelId, objectId: view.storageObjectId, fileName: storageFileName })
    : null
  const safeDownloadUrl = storageDownloadUrl ?? directDownloadUrl
  const [opening, setOpening] = React.useState(false)
  const taskDetails = getMediaDownloaderInspectorTaskDetails(view, storageState?.object ?? null)
  const unresolvedDirectOutput = view.statusTone === 'ready' && !storageBacked && !directUrl
  const effectiveTone: ToolOutputStatusTone = view.statusTone === 'failed' || storageReadiness === 'unavailable'
    ? 'failed'
    : view.statusTone
  const previewPending = storageReadinessLoading
    || storageReadiness === 'processing'
    || unresolvedDirectOutput
  const openingLabel = tAuto(view.kind === 'audio' ? 'opening_audio_8b6f9e5f' : 'opening_preview_059a33f0')
  const previewStatusLabel = opening
    ? openingLabel
    : storageReadinessLoading
      ? tAuto('media_downloader_checking_availability')
      : tAuto('media_downloader_preparing_preview')
  const requestedStatusLabel = effectiveTone === 'failed'
    ? 'Failed'
    : view.statusTone === 'processing'
      ? view.statusLabel
      : effectiveTone === 'processing'
      ? 'Running'
      : view.statusLabel
  const effectiveStatusLabel = getPublicToolStatusLabel(effectiveTone, requestedStatusLabel)
  const canOpen = effectiveTone === 'ready' && !previewPending && Boolean(storageReadiness === 'ready' || directUrl)
  const canDownload = effectiveTone === 'ready' && !previewPending && Boolean(safeDownloadUrl)
  const actionLabel = view.kind === 'audio' ? 'Play audio' : view.kind === 'video' ? 'Play video' : 'Open file'
  const safeSourceUrl = normalizeMediaDownloaderSourceForSession(view.sourceUrl)
  const showEffectiveStatus = view.showStatus
    || effectiveTone === 'failed'
  const inactiveActionLabel = previewPending
    ? previewStatusLabel
    : effectiveTone === 'processing'
      ? 'Download is still processing'
      : effectiveStatusLabel
  const effectiveErrorMessage = view.errorMessage
    ? localizeRuntimeError(view.errorMessage)
    : storageReadiness === 'unavailable'
      ? tAuto('downloaded_storage_unavailable')
      : null
  const canonicalThumbnail = useStorageObjectThumbnailUrl({
    channelId,
    storageObjectId: view.storageObjectId,
    enabled: storageGateEnabled && storageReadiness === 'ready' && view.kind === 'video',
  })
  const thumbnailCandidates = getMediaDownloaderThumbnailCandidates(
    view,
    canonicalThumbnail.data?.url ?? null,
  )
  const [failedThumbnailUrls, setFailedThumbnailUrls] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const visibleThumbnailUrl = getNextMediaDownloaderThumbnailUrl(
    thumbnailCandidates,
    failedThumbnailUrls,
  )
  const handleThumbnailError = () => {
    if (!visibleThumbnailUrl) return
    const failedCandidates = new Set(failedThumbnailUrls)
    failedCandidates.add(visibleThumbnailUrl)
    setFailedThumbnailUrls(failedCandidates)
  }

  const handleOpen = async () => {
    if (!canOpen || opening) return
    if (storageReadiness === 'ready' && channelId && view.storageObjectId) {
      setOpening(true)
      try {
        const delivery = await getStorageDeliveryUrl({
          channelId,
          objectId: view.storageObjectId,
          expiresInSeconds: 3_600,
          variant: getMediaDownloaderDeliveryVariant(storageState?.object),
        })
        if (!isHttpMediaUrl(delivery.url)) throw new Error('Storage returned an invalid media URL')
        openOutputUrl(delivery.url, view.kind, view.title, {
          downloadUrl: delivery.variant === 'original'
            ? getStorageDownloadUrl({ channelId, objectId: view.storageObjectId, fileName: storageFileName })
            : null,
          taskDetails,
        })
      } catch (error) {
        if (isStorageDeliveryTemporarilyUnavailable(error)) {
          if (view.storageObjectId) onMarkStorageProcessing(view.storageObjectId)
        } else {
          if (view.storageObjectId) onMarkStorageUnavailable(view.storageObjectId)
        }
      } finally {
        setOpening(false)
      }
      return
    }
    if (directUrl) {
      openOutputUrl(directUrl, view.kind, view.title, {
        downloadUrl: directDownloadUrl,
        taskDetails,
      })
    }
  }

  return (
    <article className="group relative grid min-h-24 grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-panel/40 transition-colors">
      <button
        type="button"
        disabled={!canOpen || opening}
        aria-busy={opening || previewPending || undefined}
        aria-label={opening ? openingLabel : canOpen ? actionLabel : inactiveActionLabel}
        onClick={() => void handleOpen()}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring enabled:cursor-pointer enabled:hover:bg-accent/30 disabled:cursor-default"
      />

      <div className="pointer-events-none relative z-[1] flex min-h-24 items-center justify-center overflow-hidden border-r border-border bg-accent/40 text-muted-foreground">
        {effectiveTone === 'ready' && visibleThumbnailUrl ? (
          <Image
            src={visibleThumbnailUrl}
            alt=""
            fill
            unoptimized
            sizes="120px"
            className="object-cover"
            loading={eagerThumbnail ? 'eager' : 'lazy'}
            onError={handleThumbnailError}
          />
        ) : null}
        {effectiveTone === 'failed' ? (
          <X className="size-5" />
        ) : effectiveTone === 'processing' ? (
          <ToolMediaLoadingIndicator
            label={effectiveStatusLabel}
            size="md"
            className="text-white"
          />
        ) : opening || previewPending ? (
          <span
            role="status"
            aria-label={previewStatusLabel}
            className="relative z-[1] flex size-9 items-center justify-center rounded-full bg-black/75 text-white ring-1 ring-white/30"
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          </span>
        ) : view.kind === 'audio' ? (
          <AudioLines className="size-5" />
        ) : view.kind === 'video' && canOpen ? (
          <span
            data-media-downloader-play-icon="true"
            className="relative z-[1] flex size-9 items-center justify-center rounded-full bg-black/75 text-white shadow-sm ring-1 ring-white/45"
          >
            <Play className="ml-0.5 size-4 fill-current" />
          </span>
        ) : (
          <Film className="size-5" />
        )}
      </div>

      <div className="pointer-events-none relative z-[1] flex min-w-0 flex-col justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-foreground" title={toolCopy(view.title)}>{toolCopy(view.title)}</p>
            {showEffectiveStatus ? <MediaDownloaderInlineStatus tone={effectiveTone} label={effectiveStatusLabel} /> : null}
          </div>
          {safeSourceUrl ? (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={safeSourceUrl}>
              {formatMediaDownloaderSource(safeSourceUrl)}
            </p>
          ) : null}
          {effectiveErrorMessage ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{effectiveErrorMessage}</p>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">
            {[view.detail, formatOutputDateTime(view.createdAt ?? undefined)].filter(Boolean).join(' / ')}
          </p>
          {safeSourceUrl || canDownload ? (
            <div className="flex shrink-0 items-center gap-1">
              {safeSourceUrl ? (
                <a
                  href={safeSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tAuto('open_source_for', { name: toolCopy(view.title) })}
                  title={tAuto('open_source_link_cb4521ac')}
                  className="pointer-events-auto relative z-10 inline-flex size-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Link2 className="size-3.5" />
                </a>
              ) : null}
              {canDownload ? (
                <button
                  type="button"
                  aria-label={tAuto('download_named', { name: toolCopy(view.title) })}
                  title={tAuto('download_named', { name: toolCopy(view.title) })}
                  onClick={() => downloadOutputUrl(safeDownloadUrl)}
                  className="pointer-events-auto relative z-10 hidden size-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
                >
                  <Download className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function MediaDownloaderInlineStatus({ tone, label }: { tone: ToolOutputStatusTone; label: string }) {
  return (
    <ToolOutputStateBadge
      state={tone}
      label={label}
    />
  )
}

function getMediaDownloaderInspectorTaskDetails(
  view: MediaDownloaderTileView,
  storageObject: StorageObjectItem | null,
): StorageInspectorTaskDetails {
  const storageSize = storageObject ? Number(storageObject.size_bytes) : Number.NaN
  const sizeBytes = view.sizeBytes
    ?? (Number.isFinite(storageSize) && storageSize >= 0 ? storageSize : null)
  const durationSeconds = view.durationSeconds ?? storageObject?.duration_seconds ?? null
  return {
    ...view.taskDetails,
    mediaSizeBytes: sizeBytes,
    mediaDurationSeconds: durationSeconds,
  }
}

function formatMediaDownloaderSeconds(value: number) {
  if (!Number.isFinite(value) || value < 0) return ''
  const rounded = Math.round(value)
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`
}

type MediaDownloaderStorageReadiness = 'processing' | 'ready' | 'unavailable'

type MediaDownloaderStorageState = {
  readiness: MediaDownloaderStorageReadiness
  object: StorageObjectItem | null
}

const MEDIA_DOWNLOADER_STORAGE_READ_CONCURRENCY = 6
const MEDIA_DOWNLOADER_STORAGE_POLL_BASE_MS = 5_000
const MEDIA_DOWNLOADER_STORAGE_POLL_MAX_MS = 30_000
const MEDIA_DOWNLOADER_STORAGE_POLL_DEADLINE_MS = 20 * 60_000

async function mapMediaDownloaderStorageReads<T>(
  storageObjectIds: string[],
  mapper: (storageObjectId: string) => Promise<T>,
) {
  const results = new Array<T>(storageObjectIds.length)
  let cursor = 0
  const workerCount = Math.min(MEDIA_DOWNLOADER_STORAGE_READ_CONCURRENCY, storageObjectIds.length)
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < storageObjectIds.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(storageObjectIds[index]!)
    }
  })
  await Promise.all(workers)
  return results
}

function getMediaDownloaderStorageReadFailure(
  error: unknown,
  retryNotFound: boolean,
): MediaDownloaderStorageReadiness {
  if (!isAuthClientError(error)) return 'unavailable'
  if (
    retryNotFound
    && (error.status === 404 || error.code === 'STORAGE_OBJECT_NOT_FOUND')
  ) {
    return 'processing'
  }
  if (
    error.status === 401
    || error.status === 403
    || error.status === 404
    || error.status >= 500
    || error.code === 'STORAGE_OBJECT_NOT_FOUND'
  ) {
    return 'unavailable'
  }
  return 'unavailable'
}

function shouldRetryMediaDownloaderStorageRead(
  error: unknown,
  retryNotFound: boolean,
) {
  if (!isAuthClientError(error)) return true
  if (error.status >= 500) return true
  return retryNotFound && (
    error.status === 404 || error.code === 'STORAGE_OBJECT_NOT_FOUND'
  )
}

function useMediaDownloaderStorageReadinessBatch({
  channelId,
  views,
}: {
  channelId: string | null
  views: MediaDownloaderTileView[]
}) {
  const baseTargetIds = getMediaDownloaderStorageHydrationTargetIds(views)
  const [forcedTargets, setForcedTargets] = React.useState<{
    channelId: string | null
    ids: string[]
  }>({ channelId: null, ids: [] })
  const forcedTargetIds = forcedTargets.channelId === channelId ? forcedTargets.ids : []
  const targetKey = Array.from(new Set([...baseTargetIds, ...forcedTargetIds])).sort().join('\u001f')
  const targetIds = React.useMemo(
    () => targetKey ? targetKey.split('\u001f') : [],
    [targetKey],
  )
  const publicationDeadlineKey = views
    .map((view) => {
      const storageObjectId = view.storageObjectId?.trim()
      const createdAtMs = view.createdAt ? Date.parse(view.createdAt) : Number.NaN
      if (!storageObjectId || !Number.isFinite(createdAtMs)) return null
      return `${storageObjectId}\u001e${createdAtMs + MEDIA_DOWNLOADER_STORAGE_POLL_DEADLINE_MS}`
    })
    .filter((value): value is string => Boolean(value))
    .sort()
    .join('\u001f')
  const publicationDeadlines = React.useMemo(() => new Map(
    publicationDeadlineKey
      ? publicationDeadlineKey.split('\u001f').map((entry) => {
          const [storageObjectId, deadline] = entry.split('\u001e')
          return [storageObjectId!, Number(deadline)] as const
        })
      : [],
  ), [publicationDeadlineKey])
  const [snapshot, setSnapshot] = React.useState<{
    channelId: string | null
    items: Map<string, MediaDownloaderStorageState>
  }>({ channelId: null, items: new Map() })
  const [retry, setRetry] = React.useState(0)

  React.useEffect(() => {
    if (!channelId || targetIds.length === 0) return undefined
    const controller = new AbortController()
    let active = true
    let pollTimer: number | null = null
    let refreshInFlight = false
    let pendingTargetIds = [...targetIds]
    const pollingStartedAt = Date.now()

    const finishTimedOutTargets = (storageObjectIds: string[]) => {
      pendingTargetIds = pendingTargetIds.filter((objectId) => !storageObjectIds.includes(objectId))
      setSnapshot((current) => {
        const items = current.channelId === channelId
          ? new Map(current.items)
          : new Map<string, MediaDownloaderStorageState>()
        storageObjectIds.forEach((storageObjectId) => {
          items.set(storageObjectId, { readiness: 'unavailable', object: null })
        })
        return { channelId, items }
      })
      setForcedTargets((current) => ({
        channelId,
        ids: current.channelId === channelId
          ? current.ids.filter((storageObjectId) => !storageObjectIds.includes(storageObjectId))
          : [],
      }))
    }

    const refresh = async (storageObjectIds: string[], pollAttempt = 0) => {
      if (!active || controller.signal.aborted || refreshInFlight) return
      if (document.visibilityState !== 'visible') return
      if (Date.now() - pollingStartedAt >= MEDIA_DOWNLOADER_STORAGE_POLL_DEADLINE_MS) {
        finishTimedOutTargets(storageObjectIds)
        return
      }
      refreshInFlight = true
      const results = await mapMediaDownloaderStorageReads(storageObjectIds, async (storageObjectId) => {
        try {
          const object = await getStorageObject(
            { channelId, objectId: storageObjectId },
            { signal: controller.signal },
          )
          const readiness = getMediaDownloaderStorageReadiness(object)
          return {
            storageObjectId,
            state: {
              readiness,
              object,
            } satisfies MediaDownloaderStorageState,
            retryable: readiness === 'processing',
          }
        } catch (error) {
          if (controller.signal.aborted) return null
          const retryNotFound = Date.now() < (publicationDeadlines.get(storageObjectId) ?? 0)
          return {
            storageObjectId,
            state: {
              readiness: getMediaDownloaderStorageReadFailure(
                error,
                retryNotFound,
              ),
              object: null,
            } satisfies MediaDownloaderStorageState,
            retryable: shouldRetryMediaDownloaderStorageRead(error, retryNotFound),
          }
        }
      })
      refreshInFlight = false
      if (!active || controller.signal.aborted) return
      const resultItems = new Map<string, MediaDownloaderStorageState>()
      results.forEach((result) => {
        if (result) resultItems.set(result.storageObjectId, result.state)
      })
      setSnapshot((current) => {
        const items = current.channelId === channelId
          ? new Map(current.items)
          : new Map<string, MediaDownloaderStorageState>()
        resultItems.forEach((value, storageObjectId) => items.set(storageObjectId, value))
        return { channelId, items }
      })
      setForcedTargets((current) => ({
        channelId,
        ids: current.channelId === channelId
          ? current.ids.filter((storageObjectId) => (
            results.some((result) => result?.storageObjectId === storageObjectId && result.retryable)
          ))
          : [],
      }))
      const retryTargetIds = results
        .filter((result): result is NonNullable<typeof result> => Boolean(result?.retryable))
        .map((result) => result.storageObjectId)
      pendingTargetIds = retryTargetIds
      if (retryTargetIds.length > 0) {
        const remainingMs = MEDIA_DOWNLOADER_STORAGE_POLL_DEADLINE_MS
          - (Date.now() - pollingStartedAt)
        if (remainingMs <= 0) {
          finishTimedOutTargets(retryTargetIds)
          return
        }
        const delayMs = Math.min(
          remainingMs,
          MEDIA_DOWNLOADER_STORAGE_POLL_MAX_MS,
          MEDIA_DOWNLOADER_STORAGE_POLL_BASE_MS * (2 ** Math.min(pollAttempt, 3)),
        )
        pollTimer = window.setTimeout(
          () => {
            pollTimer = null
            void refresh(retryTargetIds, pollAttempt + 1)
          },
          delayMs,
        )
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && pollTimer === null && pendingTargetIds.length > 0) {
        void refresh(pendingTargetIds)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    void refresh(targetIds)
    return () => {
      active = false
      controller.abort()
      if (pollTimer !== null) window.clearTimeout(pollTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [channelId, publicationDeadlines, retry, targetIds, targetKey])

  const items = snapshot.channelId === channelId
    ? snapshot.items
    : new Map<string, MediaDownloaderStorageState>()
  const markProcessing = React.useCallback((storageObjectId: string) => {
    setForcedTargets((current) => {
      const ids = current.channelId === channelId ? current.ids : []
      return {
        channelId,
        ids: ids.includes(storageObjectId) ? ids : [...ids, storageObjectId],
      }
    })
    setSnapshot((current) => {
      const next = current.channelId === channelId
        ? new Map(current.items)
        : new Map<string, MediaDownloaderStorageState>()
      next.set(storageObjectId, {
        readiness: 'processing',
        object: next.get(storageObjectId)?.object ?? null,
      })
      return { channelId, items: next }
    })
    setRetry((current) => current + 1)
  }, [channelId])
  const markUnavailable = React.useCallback((storageObjectId: string) => {
    setForcedTargets((current) => ({
      channelId,
      ids: current.channelId === channelId
        ? current.ids.filter((candidate) => candidate !== storageObjectId)
        : [],
    }))
    setSnapshot((current) => {
      const next = current.channelId === channelId
        ? new Map(current.items)
        : new Map<string, MediaDownloaderStorageState>()
      next.set(storageObjectId, {
        readiness: 'unavailable',
        object: null,
      })
      return { channelId, items: next }
    })
  }, [channelId])

  return {
    items,
    loading: baseTargetIds.length > 0 && snapshot.channelId !== channelId,
    markProcessing,
    markUnavailable,
  }
}

function getMediaDownloaderStorageReadiness(
  object: StorageObjectItem,
): MediaDownloaderStorageReadiness {
  if (['failed', 'quarantined', 'deleted'].includes(object.status)) return 'unavailable'
  return object.workflow_ready ? 'ready' : 'processing'
}

function getMediaDownloaderProjectedStorageReadiness(
  view: MediaDownloaderTileView,
): MediaDownloaderStorageReadiness | null {
  return getStoragePresentationReadiness(view)
}

function getMediaDownloaderStorageHydrationTargetIds(
  views: Array<Pick<
    MediaDownloaderTileView,
    'statusTone' | 'storageObjectId' | 'storageStatus' | 'workflowReady' | 'kind' | 'previewUrl' | 'sourceUrl'
  >>,
): string[] {
  return Array.from(new Set(
    views
      .filter((view) => (
        view.statusTone === 'ready'
        && (
          getStoragePresentationReadiness(view) === null
        )
      ))
      .map((view) => view.storageObjectId?.trim() ?? '')
      .filter(Boolean),
  )).sort()
}

function getMediaDownloaderDeliveryVariant(
  _object: StorageObjectItem | null | undefined,
): 'original' {
  void _object
  return 'original'
}

function getMediaDownloaderThumbnailCandidates(
  view: Pick<MediaDownloaderTileView, 'kind' | 'previewUrl' | 'sourceUrl'>,
  canonicalThumbnailUrl: string | null | undefined,
): string[] {
  if (view.kind !== 'video') return []
  const canonical = canonicalThumbnailUrl?.trim()
  return canonical && isHttpMediaUrl(canonical) ? [canonical] : []
}

function getNextMediaDownloaderThumbnailUrl(
  candidates: string[],
  failedCandidates: ReadonlySet<string>,
): string | null {
  return candidates.find((candidate) => !failedCandidates.has(candidate)) ?? null
}

function isMediaDownloaderDirectUrlSafe(
  value: string | null | undefined,
  expectedKind?: ToolOutputMediaKind,
): value is string {
  if (!value || !isHttpMediaUrl(value) || isEmbeddableVideoUrl(value)) return false
  if (expectedKind !== 'video' && expectedKind !== 'audio') return true
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    if (host === 'i.ytimg.com' || host.endsWith('.ytimg.com')) return false
    if (/\.(?:png|jpe?g|webp|gif|avif)$/.test(path)) return false
    if (expectedKind === 'audio' && /\.(?:mp4|m4v|mov|webm)$/.test(path)) return false
    return true
  } catch {
    return false
  }
}

function MediaDownloaderOutputSkeleton() {
  const tAuto = useTranslations('Auto')
  return (
    <div aria-busy="true" aria-label={tAuto('loading_downloads_7ede4f72')} className="grid min-h-24 grid-cols-[7.5rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-panel/40">
      <div className="relative flex items-center justify-center overflow-hidden border-r border-border bg-accent/20">
        <Skeleton className="absolute inset-0 rounded-none" />
        <ToolMediaLoadingIndicator
          label={tAuto('loading_downloads_7ede4f72')}
          size="sm"
          className="relative z-10 text-foreground/60 dark:text-white/70"
        />
      </div>
      <div className="flex flex-col justify-center gap-2 px-3">
        <Skeleton className="h-3 w-40 max-w-full" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  )
}

function dedupeMediaDownloaderTiles(tiles: MediaDownloaderTileView[]) {
  const seen = new Set<string>()
  return tiles.filter((tile) => {
    const identity = getMediaDownloaderTileIdentity(tile)
    if (!identity) return true
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function sortMediaDownloaderTilesNewestFirst(tiles: MediaDownloaderTileView[]) {
  return tiles
    .map((tile, index) => ({
      tile,
      index,
      timestamp: tile.createdAt ? Date.parse(tile.createdAt) : Number.NaN,
    }))
    .sort((left, right) => {
      const leftTimestamp = Number.isFinite(left.timestamp) ? left.timestamp : Number.NEGATIVE_INFINITY
      const rightTimestamp = Number.isFinite(right.timestamp) ? right.timestamp : Number.NEGATIVE_INFINITY
      return rightTimestamp - leftTimestamp || left.index - right.index
    })
    .map(({ tile }) => tile)
}

function getMediaDownloaderTileIdentity(tile: MediaDownloaderTileView) {
  const storageObjectId = tile.storageObjectId?.trim()
  if (storageObjectId) return `storage:${storageObjectId}`
  const directUrl = [tile.openUrl, tile.downloadUrl]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    ?.trim()
  return directUrl ? `url:${directUrl}` : null
}

function getFirstMediaDownloaderString(...values: unknown[]) {
  for (const value of values) {
    const normalized = getStringValue(value)
    if (normalized) return normalized
  }
  return null
}

function getFirstMediaDownloaderNumber(...values: unknown[]) {
  for (const value of values) {
    const normalized = getFiniteNumber(value)
    if (normalized !== null && normalized >= 0) return normalized
  }
  return null
}

function getFirstMediaDownloaderBoolean(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'boolean') return value
  }
  return null
}

function normalizeMediaDownloaderProgress(value: unknown) {
  const parsed = getFirstMediaDownloaderNumber(value)
  if (parsed === null) return null
  const percentage = parsed <= 1 ? parsed * 100 : parsed
  return percentage > 0 ? Math.min(100, percentage) : null
}

function getMediaDownloaderRunTiles(run: ToolAgentRunState, runIndex: number): MediaDownloaderTileView[] {
  const status = run.status?.status ?? (run.launch ? 'queued' : 'submitting')
  const failed = Boolean(run.errorMessage) || isFailedRunStatus(status) || status.toLowerCase() === 'insufficient_balance'
  const statusTone: ToolOutputStatusTone = failed ? 'failed' : canReadAgentOutput(status) ? 'ready' : 'processing'
  const showStatus = failed || Boolean(run.status?.status) || !run.restoring
  const media = collectAgentOutputMedia(run.output, 'Downloaded video', 'video')
    .filter((output) => output.kind === 'video' || output.kind === 'audio')
  const outputRecord = getPortRecord(run.output?.output)
  const resultRecord = getPortRecord(outputRecord.result)
  const itemRecords = Array.isArray(resultRecord.items)
    ? resultRecord.items.map((value) => getPortRecord(value))
    : []
  const rawMediaRefs = Array.isArray(outputRecord.media_refs)
    ? outputRecord.media_refs
    : Array.isArray(resultRecord.media_refs) ? resultRecord.media_refs : []
  const mediaRefRecords = rawMediaRefs.map((value) => getPortRecord(value))
  const storageObjectIds = getAgentOutputStorageObjectIds(run.output)
  const sourceLinks = run.sourceLinks ?? []
  const declaredItemCount = getMediaDownloaderDeclaredItemCount(run.output)
  const chargedCredits = getRunChargedCredits(run)
  const fallbackItemCount = media.length > 0 ? media.length : Math.max(1, sourceLinks.length)
  const billedItemCap = chargedCredits >= 1 ? Math.max(1, Math.floor(chargedCredits)) : null
  const itemCount = declaredItemCount ?? (
    billedItemCap === null ? fallbackItemCount : Math.min(fallbackItemCount, billedItemCap)
  )
  const errorMessage = run.errorMessage
    ? formatToolRunErrorMessage(run.errorMessage, run.status?.nodes ?? [])
    : null

  return Array.from({ length: itemCount }, (_, index) => {
    const output = media[index] ?? null
    const itemRecord = itemRecords[index] ?? {}
    const itemBilling = getPortRecord(itemRecord.billing)
    const itemChargedCredits = getFirstMediaDownloaderNumber(
      itemBilling.charged_credits,
      itemBilling.chargedCredits,
    )
    const itemMediaRef = getPortRecord(itemRecord.media_ref)
    const outputMediaRef = mediaRefRecords[index] ?? {}
    const outputMetadata = getPortRecord(outputMediaRef.metadata)
    const storageObjectId = getFirstMediaDownloaderString(
      itemMediaRef.storage_object_id,
      outputMetadata.storage_object_id,
      outputMediaRef.storage_object_id,
      output?.storageObjectId,
      storageObjectIds[index],
      storageObjectIds[0],
    )
    const contentType = getFirstMediaDownloaderString(
      itemMediaRef.content_type,
      outputMediaRef.content_type,
      outputMetadata.mime_type,
      itemRecord.content_type,
    )
    const mediaUrl = output?.url ?? getFirstMediaDownloaderString(outputMediaRef.url)
    const kind = output?.kind ?? getRecentWorkflowMediaKind(
      getFirstMediaDownloaderString(itemMediaRef.kind),
      contentType,
      mediaUrl,
      'video',
    )
    const title = getFirstMediaDownloaderString(
      itemRecord.title,
      itemMediaRef.file_name,
      outputMetadata.file_name,
      output?.label !== 'Downloaded video' ? output?.label : null,
    ) ?? (itemCount > 1
      ? `Downloaded ${kind === 'audio' ? 'audio' : 'video'} ${index + 1}`
      : `Downloaded ${kind === 'audio' ? 'audio' : 'video'}`)
    const statusProgress = normalizeMediaDownloaderProgress(run.status?.progress)
    return {
      key: getMediaDownloaderOutputTileKey(
        run.launch?.agent_id ?? run.output?.agentId ?? run.status?.workflowId ?? run.id,
        index,
        statusTone,
        run.id ?? `download-run:${runIndex}`,
      ),
      downloadId: getPublicToolDisplayIdentifier(getFirstMediaDownloaderString(
        itemRecord.download_id,
        itemMediaRef.download_id,
        outputMetadata.download_id,
      )),
      taskId: getToolAgentRunIdentifier(run),
      title,
      sourceUrl: getFirstMediaDownloaderString(
        itemRecord.source_url,
        outputMetadata.source_url,
        sourceLinks[index],
        sourceLinks[0],
      ),
      storageObjectId,
      kind,
      openUrl: mediaUrl,
      downloadUrl: mediaUrl,
      previewUrl: getFirstMediaDownloaderString(
        itemRecord.thumbnail_url,
        outputMetadata.thumbnail_url,
      ),
      sizeBytes: getFirstMediaDownloaderNumber(
        itemRecord.file_size_bytes,
        outputMediaRef.size_bytes,
      ),
      durationSeconds: getFirstMediaDownloaderNumber(
        itemMediaRef.duration_seconds,
        itemRecord.duration_seconds,
        outputMetadata.duration_seconds,
      ),
      downloadElapsedSeconds: getFirstMediaDownloaderNumber(
        itemRecord.download_elapsed_seconds,
        outputMetadata.download_elapsed_seconds,
      ),
      processingElapsedSeconds: getFirstMediaDownloaderNumber(
        itemRecord.processing_elapsed_seconds,
        outputMetadata.processing_elapsed_seconds,
      ),
      storageStatus: getFirstMediaDownloaderString(
        outputMetadata.storage_status,
        outputMediaRef.storage_status,
        itemMediaRef.storage_status,
        output?.storageStatus,
      ),
      workflowReady: getFirstMediaDownloaderBoolean(
        outputMetadata.workflow_ready,
        outputMediaRef.workflow_ready,
        itemMediaRef.workflow_ready,
        output?.workflowReady,
      ),
      progress: statusTone === 'ready' ? null : statusProgress,
      statusTone,
      statusLabel: getMediaDownloaderStatusLabel(status, statusTone),
      showStatus,
      errorMessage,
      createdAt: run.requestedAt ?? null,
      detail: statusTone === 'ready'
        ? itemCount === 1
          ? formatCreditLabel(chargedCredits)
          : itemChargedCredits !== null
            ? formatCreditLabel(itemChargedCredits)
            : null
        : null,
      taskDetails: {
        tool: 'Media Downloader',
        node: run.output?.nodeType ?? run.status?.nodes[0]?.nodeType ?? 'media_downloader@1',
        action: 'Download media',
        model: run.modelLabel ?? null,
        provider: run.provider ?? null,
        taskId: getToolAgentRunIdentifier(run),
        creditsUsed: statusTone === 'ready' ? chargedCredits : null,
        createdAt: run.requestedAt ?? null,
        completedAt: statusTone === 'ready' ? run.output?.createdAt ?? null : null,
      },
    }
  })
}

function isMediaDownloaderRunSupersededByHistory(
  run: ToolAgentRunState,
  recentItems: RecentWorkflowOutputItem[],
) {
  const identifiers = getToolRunIdentifiers([run])
  if (identifiers.size > 0) {
    return recentItems.some((item) => {
      if (!identifiers.has(item.agentId) && !identifiers.has(item.workflowId)) return false
      if (isFailedRunStatus(item.status) || item.status.toLowerCase() === 'insufficient_balance') return true
      return canReadAgentOutput(item.status) && getMediaDownloaderHistoryTiles(item).length > 0
    })
  }

  // A refresh can happen after the optimistic row is shown but before the
  // launch response (and its ag-* id) reaches the browser. Reconcile that
  // short-lived row by source and time once durable history catches up.
  const requestedAtMs = Date.parse(run.requestedAt ?? '')
  const runSources = new Set((run.sourceLinks ?? []).flatMap((value) => {
    const sourceIdentity = getMediaDownloaderSourceIdentity(value)
    return sourceIdentity ? [sourceIdentity] : []
  }))
  if (!Number.isFinite(requestedAtMs) || runSources.size === 0) return false

  return recentItems.some((item) => {
    const itemCreatedAtMs = Date.parse(item.createdAt ?? item.updatedAt ?? '')
    if (
      !Number.isFinite(itemCreatedAtMs)
      || Math.abs(itemCreatedAtMs - requestedAtMs) > MEDIA_DOWNLOADER_REFRESH_RECONCILIATION_WINDOW_MS
    ) return false
    const historySources = new Set([
      ...(item.sourceUrls ?? []),
      item.prompt,
      ...item.media.map((media) => media.sourceUrl),
    ].flatMap((value) => {
      const sourceIdentity = getMediaDownloaderSourceIdentity(value)
      return sourceIdentity ? [sourceIdentity] : []
    }))
    return [...runSources].every((source) => historySources.has(source))
  })
}

function getMediaDownloaderHistoryTiles(item: RecentWorkflowOutputItem): MediaDownloaderTileView[] {
  const view = getToolWorkflowOutputView(item, 'video')
  const taskId = getToolWorkflowOutputIdentifier(item)
  if (view.statusTone === 'failed') {
    return [{
      key: getMediaDownloaderOutputTileKey(
        taskId || item.id,
        0,
        'failed',
        item.id,
      ),
      downloadId: null,
      taskId,
      title: 'Download failed',
      sourceUrl: (item.sourceUrls ?? []).find((value) => getSafeMediaDownloaderSourceUrl(value))
        ?? (item.prompt && getSafeMediaDownloaderSourceUrl(item.prompt) ? item.prompt : null),
      storageObjectId: null,
      kind: 'video',
      openUrl: null,
      downloadUrl: null,
      previewUrl: null,
      sizeBytes: null,
      durationSeconds: null,
      downloadElapsedSeconds: null,
      processingElapsedSeconds: null,
      storageStatus: null,
      workflowReady: null,
      progress: null,
      statusTone: 'failed',
      statusLabel: 'Failed',
      showStatus: true,
      errorMessage: formatMediaDownloaderFailureReason(item.errorMessage),
      createdAt: item.completedAt ?? item.createdAt,
      detail: null,
    }]
  }
  if (view.statusTone === 'processing') {
    const sourceUrls = Array.from(new Set(
      (item.sourceUrls ?? [])
        .map((value) => getSafeMediaDownloaderSourceUrl(value))
        .filter((value): value is string => Boolean(value)),
    ))
    const promptSourceUrl = item.prompt && getSafeMediaDownloaderSourceUrl(item.prompt)
      ? item.prompt
      : null
    const placeholderSources: Array<string | null> = sourceUrls.length > 0
      ? sourceUrls
      : [promptSourceUrl]
    const itemCount = placeholderSources.length

    return placeholderSources.map((sourceUrl, index) => ({
      key: getMediaDownloaderOutputTileKey(
        taskId || item.id,
        index,
        'processing',
        item.id,
      ),
      downloadId: null,
      taskId,
      title: itemCount > 1 ? `Downloaded video ${index + 1}` : 'Downloaded video',
      sourceUrl,
      storageObjectId: null,
      kind: 'video',
      openUrl: null,
      downloadUrl: null,
      previewUrl: null,
      sizeBytes: null,
      durationSeconds: null,
      downloadElapsedSeconds: null,
      processingElapsedSeconds: null,
      storageStatus: null,
      workflowReady: null,
      progress: null,
      statusTone: 'processing',
      statusLabel: getMediaDownloaderStatusLabel(item.status, 'processing'),
      showStatus: true,
      errorMessage: null,
      createdAt: item.createdAt,
      detail: null,
    }))
  }
  const seen = new Set<string>()
  const media = item.media.flatMap((entry) => {
    const storageObjectId = entry.storageObjectId?.trim()
    const kindSourceUrl = entry.url ?? entry.downloadUrl ?? ''
    const kind = getRecentWorkflowMediaKind(entry.kind, entry.mimeType, kindSourceUrl, 'video')
    if (kind !== 'video' && kind !== 'audio') return []
    const openUrl = [entry.url, entry.downloadUrl]
      .find((candidate): candidate is string => isMediaDownloaderDirectUrlSafe(candidate, kind)) ?? null
    const downloadUrl = [entry.downloadUrl, entry.url]
      .find((candidate): candidate is string => isMediaDownloaderDirectUrlSafe(candidate, kind)) ?? null
    if (!storageObjectId && !openUrl) return []
    const identity = storageObjectId ? `storage:${storageObjectId}` : `url:${openUrl}`
    if (seen.has(identity)) return []
    seen.add(identity)
    return [{ entry, openUrl, downloadUrl, kind, storageObjectId: storageObjectId ?? null }]
  })
  const chargedCredits = item.nodeCreditsCharged || item.totalCreditsCharged
  const billedItemCap = chargedCredits >= 1 ? Math.max(1, Math.floor(chargedCredits)) : null
  const visibleMedia = billedItemCap === null ? media : media.slice(0, billedItemCap)
  const itemCount = visibleMedia.length
  return Array.from({ length: itemCount }, (_, index) => {
    const output = visibleMedia[index]
    const title = output.entry.fileName?.trim()
      || (itemCount > 1 ? `Downloaded video ${index + 1}` : 'Downloaded video')
    return {
      key: getMediaDownloaderOutputTileKey(
        taskId || item.id,
        index,
        view.statusTone,
        item.id,
      ),
      downloadId: getPublicToolDisplayIdentifier(output.entry.downloadId),
      taskId,
      title,
      sourceUrl: output.entry.sourceUrl
        ?? (item.prompt && isHttpMediaUrl(item.prompt) ? item.prompt : null),
      storageObjectId: output.storageObjectId,
      kind: output.kind,
      openUrl: output.openUrl,
      downloadUrl: output.downloadUrl,
      previewUrl: output.entry.previewUrl,
      sizeBytes: output.entry.sizeBytes,
      durationSeconds: output.entry.durationSeconds,
      downloadElapsedSeconds: output.entry.downloadElapsedSeconds,
      processingElapsedSeconds: output.entry.processingElapsedSeconds,
      storageStatus: output.entry.storageStatus,
      workflowReady: output.entry.workflowReady,
      progress: null,
      statusTone: view.statusTone,
      statusLabel: getMediaDownloaderStatusLabel(item.status, view.statusTone),
      showStatus: view.statusTone !== 'ready',
      errorMessage: null,
      createdAt: item.completedAt ?? item.createdAt,
      detail: itemCount === 1
        ? formatToolWorkflowCreditDetail(item, view.statusTone) ?? null
        : output.entry.creditsCharged !== null
          ? formatCreditLabel(output.entry.creditsCharged)
          : null,
      taskDetails: {
        tool: 'Media Downloader',
        node: item.nodeType,
        action: 'Download media',
        model: item.modelLabel,
        provider: view.provider,
        taskId,
        creditsUsed: chargedCredits,
        createdAt: item.createdAt,
        completedAt: item.completedAt ?? item.updatedAt,
      },
    }
  })
}

function getMediaDownloaderStatusLabel(status: string | null | undefined, tone: ToolOutputStatusTone) {
  if (tone === 'ready') return 'Ready'
  if (tone === 'failed') return 'Failed'
  return getRunProgressStatusLabel(status)
}

function formatMediaDownloaderFailureReason(message: string | null | undefined) {
  const errorCode = message?.match(/\bE\d{4}\b/)?.[0]
  if (errorCode === 'E3101') {
    return 'The media source is temporarily unavailable. Please retry in a few minutes. Error code: E3101'
  }
  if (errorCode === 'E3102') {
    return 'The download was not charged because billing could not be settled. Error code: E3102'
  }
  if (errorCode === 'E3100') {
    return 'The download did not complete. Retry it; if it fails again, share the task ID. Error code: E3100'
  }
  return message ?? 'The download did not complete.'
}

function formatMediaDownloaderSource(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'YouTube source'
    if (host.endsWith('tiktok.com')) return 'TikTok source'
    if (host.endsWith('instagram.com')) return 'Instagram source'
    if (host.endsWith('facebook.com') || host === 'fb.watch') return 'Facebook source'
    return host
  } catch {
    return 'Media source'
  }
}

function getSafeMediaDownloaderSourceUrl(value: string | null | undefined): string | null {
  return parseMediaDownloaderVideoUrl(value ?? '')?.url ?? null
}

const MEDIA_DOWNLOADER_PUBLIC_YOUTUBE_QUERY_KEYS = new Set(['v'])
const MEDIA_DOWNLOADER_PUBLIC_FACEBOOK_QUERY_KEYS = new Set(['v'])

function getMediaDownloaderYouTubeVideoId(value: string | null | undefined): string | null {
  const sourceUrl = getSafeMediaDownloaderSourceUrl(value)
  if (!sourceUrl) return null
  try {
    const parsed = new URL(sourceUrl)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    let videoId: string | null = null
    if (hostname === 'youtu.be') {
      videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? null
    } else if (
      hostname === 'youtube.com'
      || hostname.endsWith('.youtube.com')
      || hostname === 'youtube-nocookie.com'
      || hostname.endsWith('.youtube-nocookie.com')
    ) {
      videoId = parsed.searchParams.get('v')
      if (!videoId) {
        const segments = parsed.pathname.split('/').filter(Boolean)
        if (['embed', 'shorts', 'live'].includes(segments[0] ?? '')) videoId = segments[1] ?? null
      }
    }
    const normalizedId = videoId?.trim() ?? ''
    return /^[A-Za-z0-9_-]{6,32}$/.test(normalizedId) ? normalizedId : null
  } catch {
    return null
  }
}

function normalizeMediaDownloaderSourceForSession(
  value: string | null | undefined,
): string | null {
  const sourceUrl = getSafeMediaDownloaderSourceUrl(value)
  if (!sourceUrl) return null
  try {
    const parsed = new URL(sourceUrl)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const youtube = hostname === 'youtu.be'
      || hostname === 'youtube.com'
      || hostname.endsWith('.youtube.com')
      || hostname === 'youtube-nocookie.com'
      || hostname.endsWith('.youtube-nocookie.com')
    const facebook = hostname === 'facebook.com'
      || hostname.endsWith('.facebook.com')
    if (youtube) {
      for (const key of [...parsed.searchParams.keys()]) {
        if (!MEDIA_DOWNLOADER_PUBLIC_YOUTUBE_QUERY_KEYS.has(key)) parsed.searchParams.delete(key)
      }
    } else if (facebook) {
      for (const key of [...parsed.searchParams.keys()]) {
        if (!MEDIA_DOWNLOADER_PUBLIC_FACEBOOK_QUERY_KEYS.has(key)) parsed.searchParams.delete(key)
      }
    } else {
      parsed.search = ''
    }
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function sanitizeMediaDownloaderSubmissionSourceUrl(value: string | null | undefined): string | null {
  const sourceUrl = getSafeMediaDownloaderSourceUrl(value)
  if (!sourceUrl) return null
  try {
    const parsed = new URL(sourceUrl)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const youtube = hostname === 'youtu.be'
      || hostname === 'youtube.com'
      || hostname.endsWith('.youtube.com')
      || hostname === 'youtube-nocookie.com'
      || hostname.endsWith('.youtube-nocookie.com')
    const facebook = hostname === 'facebook.com'
      || hostname.endsWith('.facebook.com')
    if (youtube || facebook) return normalizeMediaDownloaderSourceForSession(sourceUrl)
    for (const key of [...parsed.searchParams.keys()]) {
      if (TOOL_RUN_SESSION_CAPABILITY_QUERY_KEYS.has(key.toLowerCase())) parsed.searchParams.delete(key)
    }
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function getMediaDownloaderSourceIdentity(value: string | null | undefined): string | null {
  const youtubeVideoId = getMediaDownloaderYouTubeVideoId(value)
  if (youtubeVideoId) return `youtube:${youtubeVideoId}`
  return normalizeMediaDownloaderSourceForSession(value)
}

const MEDIA_DOWNLOADER_URL_TOO_LONG_ERROR = 'The URL is too long. Use a URL with 4,096 characters or fewer.'
const MEDIA_DOWNLOADER_VIDEO_URL_INVALID_ERROR = 'Enter a valid YouTube, TikTok, Instagram, or Facebook video URL.'

function getMediaDownloaderSourceValidationError(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  if (normalized.length > 4_096) return MEDIA_DOWNLOADER_URL_TOO_LONG_ERROR
  if (!getSafeMediaDownloaderSourceUrl(normalized)) {
    return MEDIA_DOWNLOADER_VIDEO_URL_INVALID_ERROR
  }
  return null
}

function StandardToolOutputPanel({
  tool,
  angleTool = false,
  channelId = null,
  agentRun,
  agentRuns,
  recentOutputs = [],
  recentWorkflowOutputs,
  sourcePreview = null,
  className,
}: ToolOutputPanelProps) {
  const tAuto = useTranslations('Auto')
  const runs = agentRuns ?? (agentRun ? [agentRun] : [])
  // Restored session runs stay visible as Processing cards. Hiding them while
  // /status loads made active tasks appear 2–3s after older completed history.
  const startedRuns = runs.filter((run) => run.started)
  const runCards = startedRuns.map((run, index) => {
    const key = getToolAgentRunCardKey(run, index)
    return {
      run,
      key,
      transcriptKey: getToolAgentRunTranscriptKey(run, key),
    }
  })
  const videoToGifGrid = isVideoToGifToolConfig(tool)
  const liveAgentIds = getToolRunIdentifiers(startedRuns)
  const visibleHistoryItems = (recentWorkflowOutputs?.items ?? []).filter((item) => (
    !isRecentWorkflowOutputHidden(item, liveAgentIds)
  ))
  const handoffEntries = [
    ...runCards.map((card) => ({ kind: 'run' as const, ...card })),
    ...visibleHistoryItems.map((item) => ({
      kind: 'history' as const,
      key: getToolWorkflowOutputCardKey(item),
      item,
      transcriptKey: getRecentWorkflowTranscriptKey(item),
    })),
  ]
  const compactHistory = shouldCompactToolHistory(runCards.length, visibleHistoryItems.length)
  const firstHistoryHandoffKey = handoffEntries.find((entry) => entry.kind === 'history')?.key
  const twoColumnRunGrid = isMediaTransformToolConfig(tool) && handoffEntries.length > 1
  const primaryRun = startedRuns[0]
  const primaryTranscriptOutput = primaryRun ? getAgentTranscriptOutput(primaryRun.output) : null
  const transcriptTool = isTranscriptToolConfig(tool)
  const transcriptOutputPanel = Boolean(
    transcriptTool
    || primaryTranscriptOutput
    || recentWorkflowOutputs?.items.some((item) => isTranscriptNodeType(item.nodeType)),
  )
  const recentMedia = agentRuns
    ? []
    : collectRecentOutputMedia(
      recentOutputs,
      primaryRun?.output?.agentId,
      getToolOutputFallbackKind(tool),
    )
  const hasWorkflowHistory = Boolean(recentWorkflowOutputs && (
    visibleHistoryItems.length > 0
    || recentWorkflowOutputs.loading
  ))
  const hasOutputContent = startedRuns.length > 0
    || recentMedia.length > 0
    || hasWorkflowHistory
  const primaryVisibleWorkflowOutput = recentWorkflowOutputs?.items
    .find((item) => !isRecentWorkflowOutputHidden(item, liveAgentIds))
  const primaryRecentRunUsesSelectedSource = Boolean(
    sourcePreview
    && startedRuns.length === 0
    && primaryVisibleWorkflowOutput
    && getToolWorkflowStatusTone(primaryVisibleWorkflowOutput.status) === 'processing',
  )
  const defaultRunTranscriptKey = runCards
    .find(({ run }) => Boolean(getAgentTranscriptOutput(run.output)))
    ?.transcriptKey
  const defaultHistoryTranscript = recentWorkflowOutputs?.items
    .filter((item) => !isRecentWorkflowOutputHidden(item, liveAgentIds))
    .find((item) => Boolean(getRecentWorkflowTranscriptOutput(item)))
  const defaultExpandedTranscriptKey = defaultRunTranscriptKey
    ?? (defaultHistoryTranscript ? getRecentWorkflowTranscriptKey(defaultHistoryTranscript) : null)
  const [selectedTranscriptKey, setSelectedTranscriptKey] = React.useState<string | null | undefined>(undefined)
  const [outputViewOverride, setOutputViewOverride] = React.useState<ToolOutputView | null>(null)
  const expandedTranscriptKey = selectedTranscriptKey === undefined
    ? defaultExpandedTranscriptKey
    : selectedTranscriptKey
  const outputView = outputViewOverride ?? getDefaultToolOutputView(hasOutputContent)

  React.useEffect(() => {
    if (hasOutputContent) setOutputViewOverride('history')
  }, [hasOutputContent])

  return (
    <ToolPanel className={className}>
      <div
        data-output-view={outputView}
        className={cn(
        'mb-4 flex items-center justify-between gap-3',
      )}>
        <div className="min-w-0 space-y-2">
          <ToolOutputViewSwitch
            value={outputView}
            onValueChange={setOutputViewOverride}
          />
          <h2 className="font-display text-xl text-foreground">
            {tAuto('recent_output_73c5c034')}
          </h2>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
          <tool.icon className="size-4" />
        </span>
      </div>

      {outputView === 'example' ? (
        <ToolExampleSurface toolId={tool.id} />
      ) : null}

      <div className={cn(
        'tools-scrollbar min-h-0 flex-1',
        transcriptOutputPanel ? 'overflow-x-hidden' : '',
        outputView === 'example' && 'hidden',
      )}>
        <div
          data-transcript-output-surface={transcriptOutputPanel ? 'flat' : undefined}
          className={cn(
            transcriptOutputPanel
              ? 'min-w-0 overflow-hidden'
              : videoToGifGrid
                ? 'grid grid-cols-2 items-start gap-3'
                : twoColumnRunGrid
                  ? 'grid gap-3 lg:grid-cols-2'
                  : 'space-y-4',
          )}
        >
          {handoffEntries.map((entry) => (
            entry.kind === 'run' ? (
              <ToolAgentRunCard
                key={entry.key}
                run={entry.run}
                tool={tool}
                angleTool={angleTool}
                channelId={channelId}
                compactMedia={videoToGifGrid || twoColumnRunGrid}
                transcriptExpanded={expandedTranscriptKey === entry.transcriptKey}
                onTranscriptExpandedChange={(expanded) => setSelectedTranscriptKey(expanded ? entry.transcriptKey : null)}
              />
            ) : (
              <ToolWorkflowOutputCard
                key={entry.key}
                item={entry.item}
                tool={tool}
                angleTool={angleTool}
                channelId={channelId}
                compact={compactHistory || videoToGifGrid || twoColumnRunGrid}
                sourcePreview={entry.key === firstHistoryHandoffKey
                  ? (primaryRecentRunUsesSelectedSource ? sourcePreview : null)
                  : null}
                transcriptExpanded={expandedTranscriptKey === entry.transcriptKey}
                onTranscriptExpandedChange={(expanded) => setSelectedTranscriptKey(expanded ? entry.transcriptKey : null)}
              />
            )
          ))}
          {recentMedia.length > 0 ? (
            <ToolMediaOutputList title={startedRuns.length > 0 ? tAuto('recent_outputs_46e2a627') : tAuto('last_outputs_54b6bdb8')} media={recentMedia} />
          ) : null}
          {recentWorkflowOutputs ? (
            <ToolWorkflowOutputList
              tool={tool}
              channelId={channelId}
              recentWorkflowOutputs={recentWorkflowOutputs}
              compact={compactHistory}
              hiddenAgentIds={liveAgentIds}
              sourcePreview={primaryRecentRunUsesSelectedSource ? sourcePreview : null}
              expandedTranscriptKey={expandedTranscriptKey}
              onTranscriptExpandedChange={(key, expanded) => setSelectedTranscriptKey(expanded ? key : null)}
              mergeIntoParentGrid={videoToGifGrid || twoColumnRunGrid}
              pagerOnly
            />
          ) : null}
          {!hasOutputContent ? <ToolEmptyOutputState tool={tool} /> : null}
        </div>
      </div>
    </ToolPanel>
  )
}

function ResearchToolOutputPanel({
  tool,
  agentRun,
  agentRuns,
  recentWorkflowOutputs,
  className,
}: ToolOutputPanelProps) {
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const runs = agentRuns ?? (agentRun ? [agentRun] : [])
  const visibleRuns = runs.filter((run) => run.started)
  const currentRun = visibleRuns[0] ?? null
  const currentAgentId = currentRun?.launch?.agent_id
  const historyItems = (recentWorkflowOutputs?.items ?? []).filter((item) => item.agentId !== currentAgentId)
  const [researchSelection, setResearchSelection] = React.useState<{ runId: string | null; view: string }>({
    runId: currentRun?.id ?? null,
    view: 'current',
  })
  const researchView = researchSelection.runId === (currentRun?.id ?? null)
    ? researchSelection.view
    : 'current'
  const setResearchView = React.useCallback((view: string) => {
    setResearchSelection({ runId: currentRun?.id ?? null, view })
  }, [currentRun?.id])
  const historySelectionRequested = typeof researchView === 'string' && !['current', 'history'].includes(researchView)
  const selectedHistory = historySelectionRequested
    ? historyItems.find((item) => item.id === researchView) ?? null
    : !currentRun && researchView === 'current'
      ? historyItems[0] ?? null
      : null
  const activeResearchView = historySelectionRequested && !selectedHistory ? 'history' : researchView

  const currentStatus = currentRun?.status?.status
    ?? (currentRun?.started ? (currentRun.launch ? 'queued' : 'starting') : null)
  const currentError = currentRun?.errorMessage
    ? localizeRuntimeError(formatToolRunErrorMessage(currentRun.errorMessage, currentRun.status?.nodes ?? []))
    : null
  const currentOutput = currentRun ? getAgentTextOutput(currentRun.output) : null
  const currentDetail = currentRun ? getResearchRunCreditLabel(currentRun, currentStatus) : null
  const historyCount = historyItems.length
  const headerTitle = activeResearchView === 'current'
    ? 'Research result'
    : activeResearchView === 'history'
      ? 'Research history'
      : 'Previous research'

  return (
    <ToolPanel className={className}>
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-xl text-foreground">{headerTitle}</h2>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {activeResearchView === 'history'
              ? tAuto('open_a_previous_run_in_this_same_canvas_999af58a')
              : tAuto('evidence_backed_report_canvas_06928bea')}
          </p>
        </div>
        {activeResearchView !== 'current' ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setResearchView('current')}>
            <ChevronLeft className="size-4" />
            <UiText id="current_4fc0e2bc" /></Button>
        ) : null}
        <Button
          type="button"
          variant={activeResearchView === 'history' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setResearchView('history')}
        >
          <History className="size-4" />
          <UiText id="history_90ccd649" />{historyCount > 0 ? ` ${historyCount}` : ''}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeResearchView === 'history' ? (
          <ResearchHistoryBrowser
            items={historyItems}
            loading={Boolean(recentWorkflowOutputs?.loading)}
            loadingMore={Boolean(recentWorkflowOutputs?.loadingMore)}
            hasMore={Boolean(recentWorkflowOutputs?.hasMore)}
            onLoadMore={recentWorkflowOutputs?.onLoadMore}
            onSelect={(item) => setResearchView(item.id)}
          />
        ) : selectedHistory ? (
          <ResearchHistoryCanvas item={selectedHistory} />
        ) : currentRun ? (
          currentError ? (
            <div className="h-full min-h-[440px] overflow-hidden rounded-xl border border-destructive/20">
              <ToolRunErrorCanvas message={currentError} />
            </div>
          ) : currentOutput ? (
            <ResearchReportCanvas
              output={currentOutput}
              prompt={currentRun.prompt}
              modelLabel={currentRun.modelLabel ?? tAuto('gpt_5_6_sol_0c25a29e')}
              detail={currentDetail ?? undefined}
              duration={getResearchOutputDurationLabel(currentRun.output?.output) ?? undefined}
              runId={getToolAgentRunIdentifier(currentRun) ?? undefined}
              status={formatRunStatus(currentStatus)}
              timestamp={currentRun.requestedAt}
              research={getResearchResultRecord(currentRun.output?.output)}
            />
          ) : (
            <ResearchRunningCanvas
              prompt={currentRun.prompt}
              modelLabel={currentRun.modelLabel ?? tAuto('gpt_5_6_sol_0c25a29e')}
              status={currentStatus}
              detail={currentDetail ?? undefined}
              runId={getToolAgentRunIdentifier(currentRun) ?? undefined}
              recentItems={historyItems.slice(0, 4)}
              onSelectRecent={(item) => setResearchView(item.id)}
            />
          )
        ) : (
          <ResearchEmptyCanvas tool={tool} hasHistory={historyCount > 0} onOpenHistory={() => setResearchView('history')} />
        )}
      </div>
    </ToolPanel>
  )
}

function ResearchHistoryBrowser({
  items,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onSelect,
}: {
  items: RecentWorkflowOutputItem[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore?: () => void
  onSelect: (item: RecentWorkflowOutputItem) => void
}) {
  if (loading && items.length === 0) return <ToolStorageOutputSkeleton compact={false} />
  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[440px] flex-col items-center justify-center px-6 text-center">
        <History className="size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-foreground"><UiText id="no_previous_research_yet_1170b254" /></p>
        <p className="mt-1 text-sm text-muted-foreground"><UiText id="completed_runs_will_be_available_here_ac54c935" /></p>
      </div>
    )
  }
  return (
    <div className="tools-scrollbar h-full min-h-[440px] overflow-auto px-4 py-2 sm:px-5">
      <div className="divide-y divide-border dark:divide-white/[0.07]">
        {items.map((item) => (
          <ResearchHistoryRow
            key={`${item.id}:${item.outputHash ?? item.updatedAt}`}
            item={item}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hasMore ? (
        <div className="flex justify-center pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? <LoaderCircle className="size-4 animate-spin" /> : null}
            <UiText id="load_more_dfe60ca9" /></Button>
        </div>
      ) : null}
    </div>
  )
}

function ResearchHistoryRow({
  item,
  onSelect,
  compact = false,
}: {
  item: RecentWorkflowOutputItem
  onSelect: (item: RecentWorkflowOutputItem) => void
  compact?: boolean
}) {
  const tAuto = useTranslations('Auto')
  const toolCopy = useToolCopy()
  const formatOutputDateTime = useLocalizedOutputDateTime()
  const tone = getToolWorkflowStatusTone(item.status)
  const research = getResearchResultRecord(item.outputPreview)
  const duration = getResearchHistoryDurationLabel(item, tone)
  const identifier = getToolWorkflowOutputIdentifier(item)
  return (
    <div
      className={cn(
        'group relative grid w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-muted/35',
        compact ? 'py-2.5' : 'py-3.5',
      )}
    >
      <button
        type="button"
        aria-label={tAuto('open_research_run', { name: item.prompt?.trim() || tAuto('research_run_44ba322b') })}
        onClick={() => onSelect(item)}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <span className="pointer-events-none relative z-[1] min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {item.prompt?.trim() || tAuto('research_run_44ba322b')}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span>{formatOutputDateTime(item.completedAt ?? item.updatedAt ?? item.createdAt ?? '')}</span>
          {research.mode ? <><span aria-hidden="true">·</span><span>{toolCopy(formatResearchModeLabel(research.mode))}</span></> : null}
          {duration ? <><span aria-hidden="true">·</span><span title={tAuto('total_research_duration_48273bdc')}>{duration}</span></> : null}
          <span aria-hidden="true">·</span>
          <span>{formatToolWorkflowCreditDetail(item, tone) ?? tAuto('no_charge_cb049862')}</span>
          {identifier ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="pointer-events-auto inline-flex min-w-0 items-center gap-0.5 font-mono text-[10px]" title={identifier}>
                <span className="max-w-28 truncate">ID {formatShortIdentifier(identifier)}</span>
                <button
                  type="button"
                  aria-label={tAuto('copy_research_run_id_177fe498')}
                  title={tAuto('copy_research_run_id_177fe498')}
                  onClick={() => copyTextToClipboard(identifier)}
                  className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Copy className="size-3" />
                </button>
              </span>
            </>
          ) : null}
        </span>
      </span>
      <span className="pointer-events-none relative z-[1]"><ToolRunStatusBadge status={item.status} error={item.errorMessage} compact appearance="plain" /></span>
      <ChevronRight className="pointer-events-none relative z-[1] size-4 shrink-0 text-muted-foreground/55 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </div>
  )
}

function ResearchHistoryCanvas({ item }: { item: RecentWorkflowOutputItem }) {
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const output = getRecentWorkflowTextOutput(item)
  const tone = getToolWorkflowStatusTone(item.status)
  if (item.deliveryStatus === 'payment_review') return <PaymentReviewOutputNotice />;
  if (tone === 'failed') {
    const message = item.errorMessage?.trim()
      ? localizeRuntimeError(item.errorMessage)
      : tAuto('this_research_run_failed_28fd4752')
    return (
      <div className="h-full min-h-[440px] overflow-hidden rounded-xl border border-destructive/20">
        <ToolRunErrorCanvas message={message} />
      </div>
    )
  }
  if (!output) {
    return <ResearchRunningCanvas prompt={item.prompt ?? undefined} modelLabel={item.modelLabel ?? tAuto('gpt_5_6_sol_0c25a29e')} status={item.status} />
  }
  return (
    <ResearchReportCanvas
      output={output}
      prompt={item.prompt ?? undefined}
      modelLabel={item.modelLabel ?? item.modelId ?? tAuto('gpt_5_6_sol_0c25a29e')}
      detail={formatToolWorkflowCreditDetail(item, tone)}
      duration={getResearchHistoryDurationLabel(item, tone) ?? undefined}
      runId={getToolWorkflowOutputIdentifier(item) || undefined}
      status={getToolWorkflowStatusLabel(item.status, tone)}
      timestamp={item.completedAt ?? item.updatedAt ?? item.createdAt ?? undefined}
      research={getResearchResultRecord(item.outputPreview)}
    />
  )
}

function ResearchReportCanvas({
  output,
  prompt,
  modelLabel,
  detail,
  duration,
  runId,
  status,
  timestamp,
  research,
}: {
  output: ToolTextOutput
  prompt?: string
  modelLabel: string
  detail?: string
  duration?: string
  runId?: string
  status?: string
  timestamp?: string
  research: Record<string, string>
}) {
  const tAuto = useTranslations('Auto')
  const toolCopy = useToolCopy()
  const formatOutputDateTime = useLocalizedOutputDateTime()
  const fallbackReport = research.report_engine === 'deterministic_fallback'
  const visibleStatusLabel = status && !canReadAgentOutput(status)
    ? getRunProgressStatusLabel(status)
    : null
  return (
    <div
      className="flex h-full min-h-[440px] flex-col overflow-hidden bg-background"
      title={prompt?.trim() || undefined}
    >
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border px-4 dark:border-white/[0.07]">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {[toolCopy(formatResearchModeLabel(research.mode)), formatPublicModelLabel(modelLabel, 'GPT-5.6 Sol'), duration, detail, formatOutputDateTime(timestamp)]
            .filter(Boolean).join(' / ')}
        </p>
        {runId ? (
          <button
            type="button"
            aria-label={tAuto('copy_research_run_id_177fe498')}
            title={tAuto('copy_research_run_id', { id: runId })}
            onClick={() => copyTextToClipboard(runId)}
            className="flex h-7 max-w-36 shrink-0 items-center gap-1 rounded-md px-1.5 font-mono text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">ID {formatShortIdentifier(runId)}</span>
            <Copy className="size-3 shrink-0" />
          </button>
        ) : null}
        {fallbackReport ? (
          <Badge
            variant="outline"
            className="h-6 border-amber-500/25 bg-amber-500/8 px-2 text-[11px] text-amber-500"
            title={tAuto('managed_report_synthesis_was_unavailable_only_ev_426eb463')}
          >
            <UiText id="evidence_summary_65ed5916" /></Badge>
        ) : visibleStatusLabel ? (
          <Badge variant="outline" className="h-6 px-2 text-[11px]">{visibleStatusLabel}</Badge>
        ) : null}
        <button
          type="button"
          aria-label={tAuto('copy_report_4ed2589d')}
          title={tAuto('copy_report_4ed2589d')}
          onClick={() => copyTextToClipboard(output.content)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <div className="tools-scrollbar min-h-0 flex-1 overflow-auto px-5 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[1040px]">
          <article>
            {output.kind === 'markdown' ? (
              <GuideMarkdownPreview
                content={output.content}
                className="text-[14px] leading-7 [&_h1]:mb-6 [&_h1]:text-[30px] [&_h1]:tracking-[-0.03em] [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:tracking-[-0.025em] [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-[17px] [&_h3]:font-bold [&_h4]:mt-6 [&_p]:text-foreground/82 [&_table]:text-[12px]"
              />
            ) : (
              <pre className="whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs leading-5 text-foreground">{output.content}</pre>
            )}
          </article>
        </div>
      </div>
    </div>
  )
}

function ResearchRunningCanvas({
  prompt,
  modelLabel,
  status,
  detail,
  runId,
  recentItems = [],
  onSelectRecent,
}: {
  prompt?: string
  modelLabel: string
  status?: string | null
  detail?: string
  runId?: string
  recentItems?: RecentWorkflowOutputItem[]
  onSelectRecent?: (item: RecentWorkflowOutputItem) => void
}) {
  const tAuto = useTranslations('Auto')
  const normalizedStatus = status?.toLowerCase()
  const statusLabel = getRunProgressStatusLabel(normalizedStatus)
  return (
    <div className="tools-scrollbar h-full overflow-auto p-4 sm:p-5" aria-busy="true" aria-label={statusLabel}>
      <div
        className="overflow-hidden rounded-xl border border-border bg-panel/40 p-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{statusLabel}</p>
            {prompt?.trim() ? <p className="mt-1 line-clamp-2 text-sm leading-5 text-foreground/75">{prompt.trim()}</p> : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{[formatPublicModelLabel(modelLabel, 'GPT-5.6 Sol'), detail].filter(Boolean).join(' / ')}</span>
              {runId ? (
                <button
                  type="button"
                  aria-label={tAuto('copy_research_run_id_177fe498')}
                  title={tAuto('copy_research_run_id', { id: runId })}
                  onClick={() => copyTextToClipboard(runId)}
                  className="inline-flex h-5 max-w-36 items-center gap-1 rounded px-1 font-mono text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate">ID {formatShortIdentifier(runId)}</span>
                  <Copy className="size-3 shrink-0" />
                </button>
              ) : null}
            </div>
          </div>
          <ToolRunStatusBadge status={status ?? 'running'} compact appearance="plain" className="min-w-fit" />
        </div>
        <div className="relative mt-3 h-[3px] overflow-hidden rounded-full bg-[#2f6c98]/45">
          <span className="absolute inset-y-0 left-0 w-1/4 min-w-14 animate-[research-progress-scan_2.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-[#72c4ff] to-transparent motion-reduce:animate-none" />
        </div>
      </div>
      {recentItems.length > 0 && onSelectRecent ? (
        <section className="mt-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><UiText id="previous_research_ab6f3f45" /></h3>
            <span className="text-right text-xs text-muted-foreground"><UiText id="available_while_this_run_works_06804b0b" /></span>
          </div>
          <div className="divide-y divide-border dark:divide-white/[0.07]">
            {recentItems.map((item) => (
              <ResearchHistoryRow
                key={`${item.id}:${item.outputHash ?? item.updatedAt}`}
                item={item}
                onSelect={onSelectRecent}
                compact
              />
            ))}
          </div>
        </section>
      ) : (
        <p className="px-1 pt-4 text-xs text-muted-foreground"><UiText id="this_run_keeps_working_in_the_background_and_wil_ce74f509" /></p>
      )}
    </div>
  )
}

function ResearchEmptyCanvas({ tool, hasHistory, onOpenHistory }: { tool: ToolConfig; hasHistory: boolean; onOpenHistory: () => void }) {
  const EmptyIcon = tool.icon
  return (
    <div className="flex h-full min-h-[440px] flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><EmptyIcon className="size-5" /></span>
      <p className="mt-4 text-sm font-semibold text-foreground"><UiText id="your_next_research_report_will_open_here_05e598b0" /></p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground"><UiText id="the_active_run_stays_focused_in_this_canvas_prev_fb2acbc1" /></p>
      {hasHistory ? <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onOpenHistory}><History className="size-4" /><UiText id="open_history_1dabfe7d" /></Button> : null}
    </div>
  )
}

function getResearchRunCreditLabel(run: ToolAgentRunState, status: string | null) {
  const estimatedCredits = run.status?.totalCreditsEstimated
    ?? run.launch?.total_credits_estimated
    ?? run.estimate?.total_credits_estimated
    ?? run.estimatedCredits
    ?? 0
  const chargedCredits = getRunChargedCredits(run)
  return formatRunCreditLabel({ status, estimatedCredits, chargedCredits, refundedCredits: getRunRefundedCredits(run.status) })
}

function getResearchHistoryDurationLabel(item: RecentWorkflowOutputItem, tone: ToolOutputStatusTone) {
  const startedAt = item.createdAt
  const finishedAt = item.completedAt ?? (tone === 'processing' ? null : item.updatedAt)
  if (!startedAt || !finishedAt) return null
  return formatResearchDurationRange(startedAt, finishedAt)
}

function getResearchOutputDurationLabel(value: unknown) {
  const root = getPortRecord(value)
  const metadata = getPortRecord(root.metadata)
  return formatResearchDurationMilliseconds(metadata.duration_ms)
}

function formatResearchDurationRange(startedAt: string, finishedAt: string) {
  const startedAtMs = Date.parse(startedAt)
  const finishedAtMs = Date.parse(finishedAt)
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(finishedAtMs) || finishedAtMs < startedAtMs) return null
  return formatResearchDurationMilliseconds(finishedAtMs - startedAtMs)
}

function formatResearchDurationMilliseconds(value: unknown) {
  const milliseconds = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null
  const totalSeconds = Math.max(1, Math.round(milliseconds / 1_000))
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return `${seconds}s`
}

function getResearchResultRecord(value: unknown): Record<string, string> {
  const root = getPortRecord(value)
  const nested = getPortRecord(root.result)
  const result = Object.keys(nested).length > 0 ? nested : root
  const research = getPortRecord(result.research)
  return Object.fromEntries(
    Object.entries(research).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function formatResearchModeLabel(mode: string | null | undefined) {
  return {
    fast: 'Fast · quick scan',
    medium: 'Medium · broad scan',
    high: 'High · deep research',
    ultra: 'Ultra · maximum evidence',
  }[mode?.toLowerCase() ?? ''] ?? ''
}

function CaptionOutputPanel({
  channelId,
  agentRuns,
  recentWorkflowOutputs,
  className,
}: {
  channelId: string | null
  agentRuns: ToolAgentRunState[]
  recentWorkflowOutputs?: ToolRecentWorkflowOutputState
  className?: string
}) {
  const visibleRuns = agentRuns.filter((run) => run.started)

  return (
    <ToolPanel className={className}>
      <h2 className="mb-4 font-display text-xl text-foreground">
        <UiText id="recent_output_73c5c034" />
      </h2>
      <CaptionRecentVideoGrid
        channelId={channelId}
        agentRuns={visibleRuns}
        dedupeAgentRuns={visibleRuns}
        recentWorkflowOutputs={recentWorkflowOutputs}
        hideEmpty
      />
    </ToolPanel>
  )
}

function CaptionRenderedVideoPlayer({
  run,
  channelId,
  sourceMedia,
  autoPlay = true,
}: {
  run: ToolAgentRunState
  channelId: string | null
  sourceMedia: CaptionPreviewMedia
  autoPlay?: boolean
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const media = collectAgentOutputMedia(run.output, 'Captioned video', 'video')[0] ?? null
  const mediaUrl = media?.url ?? null
  const storageObjectId = getAgentOutputStorageObjectId(run.output)
  const mediaReadiness = getStoragePresentationReadiness(media)
  const deliveryChannelId = getCaptionPlaybackChannelId(run, channelId)
  const [deliveryRetry, setDeliveryRetry] = React.useState(0)
  const streamFrameRef = React.useRef<HTMLIFrameElement | null>(null)
  const [readyPlaybackUrl, setReadyPlaybackUrl] = React.useState<string | null>(null)
  const [failedPlaybackUrl, setFailedPlaybackUrl] = React.useState<string | null>(null)
  const [streamFallbackObjectId, setStreamFallbackObjectId] = React.useState<string | null>(null)
  const useStreamFallback = Boolean(storageObjectId && streamFallbackObjectId === storageObjectId)
  const deliveryKey = `${deliveryChannelId ?? 'none'}:${storageObjectId ?? 'none'}:${useStreamFallback ? 'stream' : 'original'}:${deliveryRetry}`
  const [delivery, setDelivery] = React.useState<{
    key: string
    url: string | null
    variant: 'original' | 'stream' | null
    error: string | null
  } | null>(null)

  React.useEffect(() => {
    if (
      !deliveryChannelId
      || !storageObjectId
      || mediaReadiness === 'processing'
      || mediaReadiness === 'unavailable'
    ) return undefined
    let active = true
    let retryTimer: number | null = null

    const scheduleResolve = (delayMs: number) => {
      if (!active) return
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        if (document.visibilityState === 'visible') void resolveDelivery()
      }, delayMs)
    }

    const resolveDelivery = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const result = await resolveSharedCaptionMediaDelivery({
          channelId: deliveryChannelId,
          objectId: storageObjectId,
          expiresInSeconds: 3_600,
          variants: useStreamFallback ? ['stream'] : undefined,
        })
        if (!active) return
        setDelivery({
          key: deliveryKey,
          url: result.url,
          variant: result.variant,
          error: null,
        })
        const refreshDelay = storageDeliveryRefreshDelay(result)
        if (refreshDelay !== false) scheduleResolve(refreshDelay)
      } catch (error) {
        if (!active) return
        setDelivery({
          key: deliveryKey,
          url: null,
          variant: null,
          error: isStorageDeliveryTemporarilyUnavailable(error)
            ? 'Captioned video is still processing. Please try again.'
            : 'Captioned video could not be loaded. Please try again.',
        })
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && retryTimer === null) {
        void resolveDelivery()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    void resolveDelivery()
    return () => {
      active = false
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [deliveryChannelId, deliveryKey, mediaReadiness, storageObjectId, useStreamFallback])

  const activeDelivery = delivery?.key === deliveryKey ? delivery : null
  const fallbackUrl = mediaUrl && !storageObjectId ? mediaUrl : null
  const playbackUrl = activeDelivery?.url ?? fallbackUrl
  const playbackVariant = activeDelivery?.variant
    ?? (fallbackUrl && isEmbeddableVideoUrl(fallbackUrl) ? 'stream' : 'original')
  const playbackReady = Boolean(playbackUrl && readyPlaybackUrl === playbackUrl)
  const playbackError = mediaReadiness === 'unavailable'
    ? 'Captioned video is unavailable in Storage.'
    : activeDelivery?.error
    ?? (playbackUrl && failedPlaybackUrl === playbackUrl
      ? 'Video player could not load the rendered output.'
      : null)
  const streamPlaybackUrl = playbackUrl && playbackVariant === 'stream' && isEmbeddableVideoUrl(playbackUrl)
    ? playbackUrl
    : null

  const markPlaybackReady = React.useCallback((url: string) => {
    setFailedPlaybackUrl((current) => current === url ? null : current)
    setReadyPlaybackUrl(url)
  }, [])

  const handleNativePlaybackError = React.useCallback((url: string) => {
    if (deliveryChannelId && storageObjectId) {
      setDelivery(null)
      setReadyPlaybackUrl(null)
      setFailedPlaybackUrl(null)
      setStreamFallbackObjectId(storageObjectId)
      return
    }
    setFailedPlaybackUrl(url)
  }, [deliveryChannelId, storageObjectId])

  React.useEffect(() => {
    if (!streamPlaybackUrl) return undefined
    const frame = streamFrameRef.current
    if (!frame?.contentWindow) return undefined
    const origin = getUrlOrigin(streamPlaybackUrl)
    if (!origin) return undefined

    const readyListener = `caption-player:${storageObjectId ?? 'direct'}:ready`
    let readyTimer: number | null = window.setTimeout(() => {
      setFailedPlaybackUrl(streamPlaybackUrl)
    }, 15_000)
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin) return
      const message = parsePlayerJsMessage(event.data)
      if (!message) return
      if (message.event === 'ready') {
        if (readyTimer !== null) window.clearTimeout(readyTimer)
        readyTimer = null
        markPlaybackReady(streamPlaybackUrl)
      } else if (message.event === 'error') {
        setFailedPlaybackUrl(streamPlaybackUrl)
      }
    }
    const registerReady = () => {
      frame.contentWindow?.postMessage(JSON.stringify({
        context: 'player.js',
        version: '0.0.11',
        method: 'addEventListener',
        value: 'ready',
        listener: readyListener,
      }), origin)
    }

    window.addEventListener('message', handleMessage)
    registerReady()
    return () => {
      if (readyTimer !== null) window.clearTimeout(readyTimer)
      window.removeEventListener('message', handleMessage)
    }
  }, [markPlaybackReady, storageObjectId, streamPlaybackUrl])

  const retryPlayback = React.useCallback(() => {
    setDelivery(null)
    setReadyPlaybackUrl(null)
    setFailedPlaybackUrl(null)
    setStreamFallbackObjectId(null)
    setDeliveryRetry((value) => value + 1)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        {streamPlaybackUrl ? (
          <iframe
            ref={streamFrameRef}
            src={streamPlaybackUrl}
            title={toolCopy(media?.label) ?? tAuto('captioned_video_b6995db7')}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className={cn(
              'absolute inset-0 size-full border-0 bg-black transition-opacity duration-200',
              playbackReady ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          />
        ) : playbackUrl ? (
          <video
            src={playbackUrl}
            controls
            autoPlay={autoPlay}
            playsInline
            preload="metadata"
            onCanPlay={() => markPlaybackReady(playbackUrl)}
            onError={() => handleNativePlaybackError(playbackUrl)}
            className={cn(
              'size-full object-contain transition-opacity duration-200',
              playbackReady ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          />
        ) : null}

        {!playbackReady && !playbackError ? (
          <CaptionPlaybackPendingCanvas sourceMedia={sourceMedia} />
        ) : null}

        {playbackError ? (
          <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-sm text-white/70" role="alert">
            <p>{playbackError}</p>
            <Button type="button" variant="secondary" size="sm" onClick={retryPlayback}>
              <UiText id="try_again_042c862e" /></Button>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-xs">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{toolCopy(media?.label) ?? sourceMedia.name}</p>
          <p className="mt-0.5 text-muted-foreground"><UiText id="captioned_output_secure_storage_playback_4290a14b" /></p>
        </div>
        {run.output?.creditsCharged ? (
          <p className="shrink-0 text-muted-foreground">{formatCreditLabel(run.output.creditsCharged)}</p>
        ) : null}
      </div>
    </div>
  )
}

function getCaptionPlaybackChannelId(run: ToolAgentRunState, fallbackChannelId: string | null) {
  return run.sourceMedia?.channelId ?? fallbackChannelId
}

function CaptionPlaybackPendingCanvas({ sourceMedia }: { sourceMedia: CaptionPreviewMedia }) {
  const tAuto = useTranslations('Auto')
  return (
    <div
      aria-label={tAuto('preparing_captioned_video_d71bdabd')}
      aria-busy="true"
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black"
    >
      {sourceMedia.previewUrl ? (
        <Image
          src={sourceMedia.previewUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 92vw, 760px"
          unoptimized
          className="scale-[1.035] object-contain opacity-45 blur-md"
        />
      ) : null}
      <Skeleton className="absolute inset-0 rounded-none bg-accent/25" />
      <ToolMediaLoadingIndicator
        label={tAuto('preparing_captioned_video_d71bdabd')}
        className="absolute inset-0 z-10"
      />
    </div>
  )
}

function CaptionRecentVideoGrid({
  channelId,
  agentRuns,
  dedupeAgentRuns,
  recentWorkflowOutputs,
  hideEmpty = false,
}: {
  channelId: string | null
  agentRuns: ToolAgentRunState[]
  dedupeAgentRuns?: ToolAgentRunState[]
  recentWorkflowOutputs?: ToolRecentWorkflowOutputState
  hideEmpty?: boolean
}) {
  const tAuto = useTranslations('Auto')
  const liveAgentIds = getToolRunIdentifiers(dedupeAgentRuns ?? agentRuns)
  const history = (recentWorkflowOutputs?.items ?? [])
    .filter((item) => !isRecentWorkflowOutputHidden(item, liveAgentIds))
    .map((item) => ({
      view: getToolWorkflowOutputView(item, 'video'),
      storageObjectId: getToolWorkflowPrimaryMedia(item, 'video')?.storageObjectId ?? null,
    }))
    .filter(({ view, storageObjectId }) => (
      view.item.deliveryStatus === 'payment_review'
      || (view.kind === 'video'
      && view.statusTone === 'ready'
      && Boolean(view.mediaUrl || storageObjectId))
    ))
    .slice(0, 8)
  const hasContent = agentRuns.length > 0 || history.length > 0

  if (!hasContent && hideEmpty) return null

  if (!hasContent && recentWorkflowOutputs?.loading) {
    return (
      <div className="flex min-h-64 items-center justify-center" aria-busy="true" aria-label={tAuto('loading_captioned_videos_b085e7ab')}>
        <ToolMediaLoadingIndicator
          label={tAuto('loading_captioned_videos_b085e7ab')}
          className="text-foreground/60 dark:text-white/70"
        />
      </div>
    )
  }

  if (!hasContent) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
        <Captions className="size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-foreground"><UiText id="no_captioned_videos_yet_85bb7638" /></p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          <UiText id="choose_a_video_on_the_left_its_first_frame_and_c_d7ec4d54" /></p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        ...agentRuns.slice(0, 6).map((run, index) => ({
          kind: 'run' as const,
          key: getCaptionOutputCardKey(getToolAgentRunIdentifier(run), run.id ?? `caption-run:${index}`),
          run,
        })),
        ...history.map((entry) => ({
          kind: 'history' as const,
          key: getCaptionOutputCardKey(entry.view.identifier, entry.view.item.id),
          ...entry,
        })),
      ].map((entry) => {
        if (entry.kind === 'run') {
          return (
            <CaptionSessionRunCard
              key={entry.key}
              run={entry.run}
              channelId={channelId}
            />
          )
        }
        return (
          entry.view.item.deliveryStatus === 'payment_review' ? <PaymentReviewOutputNotice key={entry.key} /> : <CaptionHistoryTile
            key={entry.key}
            view={entry.view}
            channelId={channelId}
            storageObjectId={entry.storageObjectId}
          />
        )
      })}
    </div>
  )
}

function CaptionSessionRunCard({
  run,
  channelId,
}: {
  run: ToolAgentRunState
  channelId: string | null
}) {
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const toolCopy = useToolCopy()
  const formatOutputDateTime = useLocalizedOutputDateTime()
  const status = run.status?.status ?? (run.launch ? 'queued' : 'starting')
  const paymentReview = run.status?.deliveryStatus === 'payment_review'
    || run.status?.pausedReason === 'payment_risk_pending'
  const media = collectAgentOutputMedia(run.output, 'Captioned video', 'video')[0] ?? null
  const presentationStatus = getStoragePresentationReadiness(media) === 'processing'
    && canReadAgentOutput(status)
    ? 'running'
    : status
  const error = run.errorMessage
    ? localizeRuntimeError(formatToolRunErrorMessage(run.errorMessage, run.status?.nodes ?? []))
    : null
  const rawSourceMedia = run.sourceMedia ?? null
  const sourceThumbnailQuery = useStorageObjectThumbnailUrl({
    channelId: rawSourceMedia?.channelId ?? channelId,
    storageObjectId: rawSourceMedia?.storageObjectId ?? null,
    enabled: Boolean(rawSourceMedia && !rawSourceMedia.previewUrl),
  })
  const sourceMedia = React.useMemo(() => {
    return withToolSourceMediaPreview(rawSourceMedia, sourceThumbnailQuery.data?.url)
  }, [rawSourceMedia, sourceThumbnailQuery.data?.url])
  const preview = run.captionPreview ?? {
    styleName: 'auto',
    fontSize: DEFAULT_CAPTION_FONT_SIZE,
    position: 'style_default',
    subtitleMode: 'original' as const,
    targetLanguage: 'en',
    bilingualOrder: 'source_above' as const,
  }
  const identifier = getToolAgentRunIdentifier(run)
  const visibleStatusLabel = paymentReview ? null : error
    ? tAuto('failed_09fef5d8')
    : canReadAgentOutput(presentationStatus)
      ? null
      : getRunProgressStatusLabel(presentationStatus)
  const ownsRunningIndicator = !paymentReview && !error
    && !media
    && !isFailedRunStatus(status)
    && (Boolean(sourceMedia) || shouldPollAgentStatus(status) || run.loading)

  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-panel/40 transition hover:border-primary/35">
      <div className="relative aspect-video overflow-hidden bg-black">
        {!paymentReview && !ownsRunningIndicator ? (
          <ToolRunStatusBadge
            status={presentationStatus}
            error={error}
            settlementStatus={run.status?.settlementStatus}
            stage={run.status?.stage}
            progress={run.status?.progress}
            outputPending={presentationStatus === 'running' && canReadAgentOutput(status)}
            className="absolute left-2.5 top-2.5 z-20"
          />
        ) : null}
        {paymentReview ? (
          <PaymentReviewOutputNotice workflowId={run.status?.workflowId}
            canResume={run.status?.pausedReason === 'payment_risk_pending' && !run.status?.deliveryStatus} />
        ) : error ? (
          <CaptionRunFailureCanvas message={error} identifier={identifier} />
        ) : (media || getAgentOutputStorageObjectId(run.output)) && sourceMedia ? (
          <CaptionRenderedVideoPlayer
            run={run}
            channelId={sourceMedia.channelId ?? channelId}
            sourceMedia={sourceMedia}
            autoPlay={false}
          />
        ) : sourceMedia ? (
          <CaptionVideoPreview
            media={sourceMedia}
            styleName={preview.styleName}
            fontSize={preview.fontSize}
            captionPosition={preview.position}
            subtitleMode={preview.subtitleMode}
            targetLanguage={preview.targetLanguage}
            bilingualOrder={preview.bilingualOrder}
            sourceStyleName={preview.sourceStyleName}
            translationStyleName={preview.translationStyleName}
            sourceFontScale={preview.sourceFontScale}
            translationFontScale={preview.translationFontScale}
            visibilityOverrides={preview.visibilityOverrides}
            processing
            showDetails={false}
          />
        ) : shouldPollAgentStatus(status) || run.loading ? (
          <ToolGeneratingMediaPreview modelKind="video" />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">
            <Film className="size-8" />
          </div>
        )}
      </div>
      <div className="min-w-0 px-2.5 py-2">
        <p className="truncate text-xs font-semibold text-foreground">{sourceMedia?.name ?? tAuto('captioned_video_b6995db7')}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {[visibleStatusLabel ? toolCopy(visibleStatusLabel) : null, formatOutputDateTime(run.requestedAt)]
            .filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}

function CaptionRunFailureCanvas({
  message,
  identifier,
}: {
  message: string
  identifier: string | null
}) {
  const tAuto = useTranslations('Auto')
  const rawErrorCode = message.match(/\bE\d{4}\b/i)?.[0]?.toUpperCase()
  const errorCode = rawErrorCode ? toPublicRuntimeError(rawErrorCode)?.code : null
  const failureLabel = message.split('.').find(Boolean)?.trim() || tAuto('captioning_failed')

  return (
    <div
      data-caption-run-failure="true"
      className="relative flex h-full items-center justify-center overflow-hidden bg-destructive/5 px-4"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(222_53_11_/_0.12),rgb(255_255_255_/_0.02),transparent)]" />
      <div
        role="alert"
        aria-label={message}
        title={message}
        className="relative z-10 flex max-w-[85%] items-center gap-2 rounded-full border border-destructive/20 bg-background/75 px-3 py-2 text-destructive shadow-sm backdrop-blur-[2px]"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <X className="size-3.5" />
        </span>
        <span className="min-w-0 truncate text-xs font-medium">{failureLabel}</span>
        {errorCode ? (
          <code className="shrink-0 font-mono text-[10px] text-destructive/75">{errorCode}</code>
        ) : null}
      </div>
      {identifier ? (
        <button
          type="button"
          aria-label={tAuto('copy_agent_id_e1704fd9')}
          title={tAuto('copy_agent_id_value', { id: identifier })}
          onClick={() => copyTextToClipboard(identifier)}
          className="absolute bottom-2.5 right-2.5 z-20 flex h-7 max-w-44 items-center gap-1.5 rounded-md bg-background/80 px-2 text-[10px] text-muted-foreground backdrop-blur-sm transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <code className="min-w-0 truncate font-mono">{formatShortIdentifier(identifier)}</code>
          <Copy className="size-3 shrink-0" />
        </button>
      ) : null}
    </div>
  )
}

function CaptionHistoryTile({
  view,
  channelId,
  storageObjectId,
}: {
  view: ToolWorkflowOutputView
  channelId: string | null
  storageObjectId: string | null
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const formatOutputDateTime = useLocalizedOutputDateTime()
  const [opening, setOpening] = React.useState(false)
  const [failedThumbnailUrl, setFailedThumbnailUrl] = React.useState<string | null>(null)
  const [openUnavailable, setOpenUnavailable] = React.useState(false)
  const storageBacked = Boolean(storageObjectId)
  const thumbnailQuery = useStorageObjectThumbnailUrl({
    channelId,
    storageObjectId,
    enabled: Boolean(channelId && storageObjectId),
  })
  const storageThumbnailUrl = thumbnailQuery.data?.url ?? null
  const outputThumbnailUrl = view.previewUrl
    && view.previewUrl !== view.mediaUrl
    && !isEmbeddableVideoUrl(view.previewUrl)
    ? view.previewUrl
    : null
  const thumbnailUrl = storageThumbnailUrl ?? (storageBacked ? null : outputThumbnailUrl)
  const visibleThumbnailUrl = thumbnailUrl && failedThumbnailUrl !== thumbnailUrl
    ? thumbnailUrl
    : null
  const directMediaUrl = !storageBacked ? view.mediaUrl : null
  const resolvingPreview = storageBacked
    && !visibleThumbnailUrl
    && !thumbnailQuery.isError
    && (thumbnailQuery.isPending || thumbnailQuery.isFetching)
  const previewUnavailable = openUnavailable
    || (storageBacked && (!channelId || thumbnailQuery.isError || failedThumbnailUrl === thumbnailUrl))


  const handleThumbnailError = (failedUrl: string) => {
    setFailedThumbnailUrl(failedUrl)
  }

  const handleOpen = async () => {
    if (opening || (!storageBacked && !directMediaUrl)) return
    setOpening(true)
    try {
      if (storageObjectId) {
        if (!channelId) {
          setOpenUnavailable(true)
          return
        }
        const delivery = await resolveSharedCaptionMediaDelivery({
          channelId,
          objectId: storageObjectId,
          expiresInSeconds: 3_600,
        })
        openOutputUrl(delivery.url, 'video', view.label, {
          prompt: view.prompt ?? undefined,
        })
        return
      }
      if (directMediaUrl) {
        openOutputUrl(directMediaUrl, 'video', view.label, {
          prompt: view.prompt ?? undefined,
          downloadUrl: view.downloadUrl,
        })
      }
    } catch {
      setOpenUnavailable(true)
    } finally {
      setOpening(false)
    }
  }

  return (
    <button
      type="button"
      disabled={opening || (storageBacked ? !channelId : !directMediaUrl)}
      onClick={() => void handleOpen()}
      data-caption-history-delivery={storageBacked ? 'storage' : 'direct'}
      className="group overflow-hidden rounded-lg border border-border bg-card text-left transition enabled:hover:border-primary/35 disabled:cursor-default"
    >
      <span className="relative flex aspect-video items-center justify-center overflow-hidden bg-black text-white/75">
        {visibleThumbnailUrl ? (
          <Image
            key={visibleThumbnailUrl}
            src={visibleThumbnailUrl}
            alt=""
            fill
            sizes="260px"
            unoptimized
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => handleThumbnailError(visibleThumbnailUrl)}
            className="object-contain opacity-90 transition group-hover:opacity-100"
          />
) : directMediaUrl ? (
          <video
            src={directMediaUrl}
            aria-hidden="true"
            tabIndex={-1}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 size-full object-contain"
          />
        ) : resolvingPreview ? (
          <ToolMediaLoadingIndicator label={tAuto('preparing_captioned_video_preview_cb125c0b')} />
        ) : previewUnavailable ? (
          <span className="flex flex-col items-center gap-2 text-[10px] text-white/55">
            <Film className="size-5" />
            <UiText id="preview_unavailable_36d31d45" /></span>
        ) : (
          <Film className="size-6" />
        )}
        {opening || !resolvingPreview ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/25">
            <span className="flex size-8 items-center justify-center rounded-full bg-black/65 opacity-0 transition group-hover:opacity-100">
              {opening ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
            </span>
          </span>
        ) : null}
      </span>
      <span className="block min-w-0 px-2.5 py-2">
        <span className="block truncate text-xs font-semibold text-foreground">{toolCopy(view.label)}</span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{formatOutputDateTime(view.createdAt)}</span>
      </span>
    </button>
  )
}


function ToolAgentRunCard({
  run,
  tool,
  angleTool = false,
  channelId,
  compactMedia = false,
  transcriptExpanded = true,
  onTranscriptExpandedChange,
}: {
  run: ToolAgentRunState
  tool: ToolConfig
  angleTool?: boolean
  channelId: string | null
  compactMedia?: boolean
  transcriptExpanded?: boolean
  onTranscriptExpandedChange?: (expanded: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  if (!run.started) return null

  // LLM-03: a fast-lane run has no workflow; its answer streams into the card while the call runs.
  const streamedTextOutput: ToolTextOutput | null = !run.launch && run.streamText
    ? { kind: 'json', content: run.streamText }
    : null
  const status = run.status?.status ?? (run.launch ? 'queued' : streamedTextOutput && run.loading ? 'running' : 'starting')
  const estimatedCredits = run.status?.totalCreditsEstimated
    ?? run.launch?.total_credits_estimated
    ?? run.estimate?.total_credits_estimated
    ?? run.estimatedCredits
    ?? 0
  const chargedCredits = getRunChargedCredits(run)
  const refundedCredits = getRunRefundedCredits(run.status)
  const magicClipsRun = isMagicClipsToolConfig(tool)
  const creditLabel = magicClipsRun
    ? undefined
    : formatRunCreditLabel({ status, estimatedCredits, chargedCredits, refundedCredits })
  const transcriptOutput = getAgentTranscriptOutput(run.output)
  const transcriptRun = Boolean(transcriptOutput) || isTranscriptToolConfig(tool)
  const textOutput = getAgentTextOutput(run.output)
  const mediaOutputs = isVideoToGifToolConfig(tool)
    ? collectVideoToGifOutputMedia(run.output)
    : isMediaTransformToolConfig(tool)
      ? collectMediaTransformOutputMedia(run.output)
      : collectAgentOutputMedia(
        run.output,
        formatModelKindLabel(tool.modelKind),
        getToolOutputFallbackKind(tool),
      )
  const frameOutputs = isFrameExtractToolConfig(tool)
    ? collectFrameExtractOutputMedia(run.output)
    : []
  const angleOutputs = angleTool
    ? collectAngleOutputMedia(run.output?.output)
    : []
  const magicClipOutputs = magicClipsRun
    ? collectMagicClipOutputMedia(run.output)
    : []
  const magicClipRunSummary = magicClipsRun
    ? getMagicClipRunSummary(run.output?.output, magicClipOutputs.length)
    : null
  const magicClipsEmpty = magicClipsRun
    && canReadAgentOutput(status)
    && isEmptyMagicClipPayload(run.output?.output)
  const outputRefreshFailed = Boolean(run.outputRefreshFailed)
  const primaryMedia = mediaOutputs[0]
  // GEN-04: the node's result is already stored while the node/run is still finishing (shown, never taken back).
  const earlyOutputMedia = primaryMedia ? null : getToolEarlyOutputMedia(run.status, formatModelKindLabel(tool.modelKind))
  const mediaPublicationPending = [...mediaOutputs, ...frameOutputs, ...magicClipOutputs]
    .some((media) => getStoragePresentationReadiness(media) === 'processing')
  const presentationStatus = mediaPublicationPending && canReadAgentOutput(status)
    ? 'running'
    : status
  const identifier = getToolAgentRunIdentifier(run)
  const taskDetails: StorageInspectorTaskDetails = {
    tool: tool.title,
    node: run.output?.nodeType ?? run.status?.nodes[0]?.nodeType ?? null,
    action: isMediaTransformToolConfig(tool) ? run.activityLabel ?? null : null,
    model: run.modelLabel ?? null,
    provider: run.provider ?? null,
    taskId: identifier,
    creditsUsed: chargedCredits,
    createdAt: run.requestedAt ?? null,
    completedAt: run.output?.createdAt ?? null,
  }

  const errorMessage = run.errorMessage
    ? localizeRuntimeError(formatToolRunErrorMessage(
        run.errorMessage,
        run.status?.nodes ?? [],
        [tAuto('viral_clips_quota_exhausted'), tAuto('viral_clips_quota_unavailable')],
      ))
    : null
  const showGeneratingPreview = !errorMessage
    && run.status?.deliveryStatus !== 'payment_review'
    && !outputRefreshFailed
    && frameOutputs.length === 0
    && magicClipOutputs.length === 0
    && !primaryMedia
    && !earlyOutputMedia
    && !transcriptOutput
    && !textOutput
    && !transcriptRun
    && (tool.modelKind === 'image' || tool.modelKind === 'video' || tool.modelKind === 'voice')
    && (run.loading || shouldPollAgentStatus(status) || (canReadAgentOutput(status) && !run.output))
  // A failed run keeps its failure badge over the stored result; otherwise the result reads "ready, finishing up".
  const earlyOutputFinishing = Boolean(earlyOutputMedia)
    && !errorMessage
    && !isFailedRunStatus(status)
    && isEarlyOutputFinishing(run.status)
  const showStatusBadge = !transcriptRun
    && !earlyOutputFinishing
    && !(isVideoToGifToolConfig(tool) && canReadAgentOutput(status) && Boolean(primaryMedia))

  return (
    <div className={cn(
      'overflow-hidden rounded-md border',
      transcriptRun
        ? 'border-border/80 bg-panel/40'
        : 'border-border bg-panel/40',
    )}>
      <TenantNodeQueueSummary status={run.status} />
      {run.statusConnectionError ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-background/65 px-3 py-2 text-xs">
          <div className="min-w-0 flex-1" role="alert">
            {run.statusConnectionError ? <p className="text-amber-700 dark:text-amber-300">{run.statusConnectionError}</p> : null}
          </div>
          {run.retryStatus ? (
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-md px-2" onClick={run.retryStatus}>
              <RefreshCw className="size-3.5" />
              <UiText id="try_again_042c862e" />
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="group/output-card group relative">
        {showStatusBadge ? (
          <ToolRunStatusBadge
            status={presentationStatus}
            error={errorMessage}
            settlementStatus={run.status?.settlementStatus}
            stage={run.status?.stage}
            progress={run.status?.progress}
            outputPending={mediaPublicationPending}
            className="absolute left-3 top-3 z-20"
          />
        ) : null}
        {run.status?.deliveryStatus === 'payment_review' || run.status?.pausedReason === 'payment_risk_pending' ? (
          <PaymentReviewOutputNotice workflowId={run.status?.workflowId}
            canResume={run.status?.pausedReason === 'payment_risk_pending' && !run.status?.deliveryStatus} />
        ) : earlyOutputMedia ? (
          // GEN-04 / B5: a stored result stays visible even if the run later fails or needs settlement attention.
          <div data-tool-early-output={earlyOutputFinishing ? 'finishing' : 'stored'}>
            <ToolRunMediaPreview
              item={earlyOutputMedia}
              prompt={run.prompt}
              channelId={channelId}
              compact={compactMedia}
              taskDetails={taskDetails}
            />
            {earlyOutputFinishing ? (
              <ToolRunningIndicator
                label={tAuto('early_output_finishing')}
                ariaLabel={tAuto('early_output_finishing_detail')}
                compact
                className="absolute left-3 top-3 z-20"
              />
            ) : null}
          </div>
        ) : errorMessage ? (
          transcriptRun ? (
            <ToolTranscriptOutputPlaceholder
              sourceMedia={run.sourceMedia ?? null}
              modelLabel={run.modelLabel ?? null}
              detail={creditLabel}
              status={status}
              errorMessage={errorMessage}
              identifier={identifier}
            />
          ) : magicClipsRun ? (
            <ToolMagicClipsFailedResult message={errorMessage} taskId={identifier} />
          ) : <ToolRunErrorCanvas message={errorMessage} compact={compactMedia} />
        ) : outputRefreshFailed ? (
          <ToolOutputRefreshFailedResult
            taskId={identifier}
            onRetry={run.retryOutput}
          />
        ) : angleOutputs.length > 1 ? (
          <ToolFrameOutputGallery
            items={angleOutputs}
            channelId={channelId}
            taskDetails={taskDetails}
          />
        ) : frameOutputs.length > 0 ? (
          <ToolFrameOutputGallery items={frameOutputs} channelId={channelId} taskDetails={taskDetails} />
        ) : magicClipOutputs.length > 0 ? (
          <ToolClipOutputGallery
            items={magicClipOutputs}
            channelId={channelId}
            taskId={identifier}
            actualCredits={chargedCredits}
            startedAt={run.requestedAt}
            completedAt={run.output?.createdAt}
            sourceMedia={run.sourceMedia ?? null}
            taskDetails={taskDetails}
            summary={magicClipRunSummary}
          />
        ) : magicClipsEmpty ? (
          <ToolMagicClipsEmptyResult
            taskId={identifier}
            reason={magicClipRunSummary?.partialReason}
          />
        ) : primaryMedia ? (
          <ToolRunMediaPreview
            item={{
              ...primaryMedia,
              storageObjectId: primaryMedia.storageObjectId ?? getAgentOutputStorageObjectId(run.output),
            }}
            prompt={run.prompt}
            channelId={channelId}
            compact={compactMedia}
            replayGif={isVideoToGifToolConfig(tool)}
            posterOnlyVideo={isMediaTransformToolConfig(tool)}
            taskDetails={taskDetails}
          />
        ) : transcriptOutput ? (
          <ToolTranscriptOutputCanvas
            transcript={transcriptOutput}
            sourceMedia={run.sourceMedia ?? null}
            modelLabel={run.modelLabel ?? null}
            detail={creditLabel}
            identifier={identifier}
            offsetForStatusBadge={showStatusBadge}
            expanded={transcriptExpanded}
            onExpandedChange={onTranscriptExpandedChange}
          />
        ) : transcriptRun ? (
          <ToolTranscriptOutputPlaceholder
            sourceMedia={run.sourceMedia ?? null}
            modelLabel={run.modelLabel ?? null}
            detail={creditLabel}
            status={status}
            identifier={identifier}
          />
        ) : textOutput ? (
          <ToolTextOutputCanvas
            output={textOutput}
            title={textOutput.kind === 'markdown' ? tAuto('research_report_22a57348') : tAuto('json_output_669f62b8')}
            detail={creditLabel}
          />
        ) : streamedTextOutput ? (
          <div data-tool-stream-output aria-live="polite" aria-busy={run.loading}>
            <ToolTextOutputCanvas
              output={streamedTextOutput}
              title={tAuto('text_tool_fast_lane_streaming')}
              detail={creditLabel}
            />
          </div>
        ) : showGeneratingPreview ? (
          <ToolGeneratingMediaPreview
            modelKind={tool.modelKind}
            label={isFrameExtractToolConfig(tool)
              ? getRunProgressStatusLabel(status, {
                  settlementStatus: run.status?.settlementStatus,
                  stage: run.status?.stage,
                  progress: run.status?.progress,
                  outputPending: mediaPublicationPending,
                })
              : run.activityLabel}
            sourceMedia={run.sourceMedia}
            heightClassName={compactMedia ? getToolStorageMediaHeightClassName(true) : undefined}
          />
        ) : (
          <div className={cn(
            'bg-muted',
            compactMedia
              ? getToolStorageMediaHeightClassName(true)
              : 'h-[clamp(16rem,40vh,30rem)]',
          )} />
        )}
        {!transcriptRun ? (
          <>
        {frameOutputs.length === 0
          && magicClipOutputs.length === 0
          && !magicClipsEmpty
          && !outputRefreshFailed
          && !primaryMedia ? (
          <ToolOutputTopActions
            media={null}
            outputKind={getToolOutputKindForTool(tool)}
            prompt={run.prompt}
          />
        ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function ToolHeroVideoAsset({
  slide,
  active,
  playing,
  preload,
}: {
  slide: CatalogHeroSlide
  active: boolean
  playing: boolean
  preload: 'auto' | 'metadata' | 'none'
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!active || !playing) {
      video.pause()
      return
    }
    void video.play().catch(() => {
      // Browser autoplay policies can block playback; visibility and interaction changes retry it.
    })
  }, [active, playing])

  return (
    <video
      ref={videoRef}
      src={slide.url}
      className="tools-hero-media-asset h-full w-full"
      style={buildHeroMediaStyle(slide)}
      muted
      loop
      playsInline
      autoPlay={active && playing}
      preload={preload}
    />
  )
}

function getHeroMediaLoadingStrategy(index: number, currentIndex: number, slideCount: number) {
  const active = index === currentIndex
  const next = slideCount > 1 && index === (currentIndex + 1) % slideCount
  return {
    active,
    preload: active ? 'auto' as const : next ? 'metadata' as const : 'none' as const,
  }
}

function ToolFrameOutputGallery({
  items,
  channelId,
  taskDetails,
}: {
  items: ToolOutputMedia[]
  channelId: string | null
  taskDetails?: StorageInspectorTaskDetails
}) {
  return (
    <ToolBatchOutputGallery
      items={items}
      channelId={channelId}
      taskDetails={taskDetails}
      presentation="unified-frame-grid"
    />
  )
}

function ToolClipOutputGallery({
  items,
  channelId,
  taskId,
  actualCredits,
  startedAt,
  completedAt,
  sourceMedia,
  taskDetails,
  hydratePreviewItem,
  summary,
}: {
  items: ToolOutputMedia[]
  channelId: string | null
  taskId?: string | null
  actualCredits?: number | null
  startedAt?: string | null
  completedAt?: string | null
  sourceMedia?: ToolRunSourceMedia | null
  taskDetails?: StorageInspectorTaskDetails
  hydratePreviewItem?: (item: ToolOutputMedia) => Promise<ToolOutputMedia>
  summary?: MagicClipRunSummary | null
}) {
  const producedClipCount = summary?.producedClipCount ?? items.length
  return (
    <ToolBatchOutputGallery
      items={items}
      channelId={channelId}
      taskDetails={taskDetails}
      runInfo={{
        producedClipCount,
        requestedClipCount: summary?.requestedClipCount ?? null,
        taskId: taskId ?? null,
        actualCredits: actualCredits ?? null,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        sourceMedia: sourceMedia ?? null,
      }}
      presentation="shorts"
      hydratePreviewItem={hydratePreviewItem}
    />
  )
}

type MagicClipRunSummary = {
  requestedClipCount: number | null
  producedClipCount: number
  unmetClipCount: number | null
  partialReason: string | null
  effectiveEditingStyle: string | null
  effectiveRemoveSilence: boolean | null
  effectiveContextMontage: string | null
  effectiveTransition: string | null
  appliedSilenceCutCount: number | null
  appliedTransitionCount: number | null
  appliedContextMontageClipCount: number | null
  appliedDisplayPatchCount: number | null
}

function getMagicClipRunSummary(
  value: unknown,
  fallbackProducedClipCount = 0,
): MagicClipRunSummary {
  const envelope = findMagicClipPayloadEnvelope(value)
  const payload = envelope?.payload ?? {}
  const metadata = envelope?.metadata ?? {}
  const clips = Array.isArray(payload.clips) ? payload.clips : []
  const hasCensorContract = clips.some((clip) => Boolean(getPortRecord(clip).censor))
  const declaredProducedClipCount = getNonNegativeInteger(
    payload.produced_clip_count ?? payload.clip_count,
  )
  const producedClipCount = declaredProducedClipCount
    ?? (clips.length > 0 ? clips.length : fallbackProducedClipCount)
  const requestedClipCount = getNonNegativeInteger(
    payload.requested_clip_count ?? metadata.requested_clip_count,
  )
  const unmetClipCount = getNonNegativeInteger(payload.unmet_clip_count)
    ?? (requestedClipCount === null ? null : Math.max(0, requestedClipCount - producedClipCount))
  const effectiveSettings = getPortRecord(
    payload.effective_settings
    ?? payload.effective_options
    ?? metadata.effective_settings
    ?? metadata.editorial_options,
  )
  const explicitEditSummary = getPortRecord(
    payload.applied_edit_summary
    ?? payload.applied_edits
    ?? metadata.applied_edit_summary,
  )
  const timelineCounts = collectMagicClipAppliedTimelineCounts(clips)

  return {
    requestedClipCount,
    producedClipCount,
    unmetClipCount,
    partialReason: getStringValue(
      payload.empty_reason
      ?? payload.reason_code
      ?? payload.zero_output_reason
      ?? payload.partial_reason
      ?? metadata.empty_reason
      ?? metadata.zero_output_reason
      ?? metadata.partial_reason,
    ),
    effectiveEditingStyle: hasCensorContract ? null : getStringValue(
      effectiveSettings.editing_style ?? effectiveSettings.editingStyle,
    ),
    effectiveRemoveSilence: getOptionalBoolean(
      effectiveSettings.remove_silence ?? effectiveSettings.removeSilence,
    ),
    effectiveContextMontage: hasCensorContract ? null : getStringValue(
      effectiveSettings.context_montage ?? effectiveSettings.contextMontage,
    ),
    effectiveTransition: hasCensorContract ? null : getStringValue(effectiveSettings.transition),
    appliedSilenceCutCount: getNonNegativeInteger(
      explicitEditSummary.applied_silence_cut_count
      ?? explicitEditSummary.silence_cut_count,
    ) ?? timelineCounts.silenceCutCount,
    appliedTransitionCount: getNonNegativeInteger(
      explicitEditSummary.applied_transition_count
      ?? explicitEditSummary.transition_count,
    ) ?? timelineCounts.transitionCount,
    appliedContextMontageClipCount: getNonNegativeInteger(
      explicitEditSummary.context_montage_clip_count,
    ),
    appliedDisplayPatchCount: getNonNegativeInteger(
      explicitEditSummary.display_patch_count,
    ),
  }
}

function findMagicClipPayloadEnvelope(
  value: unknown,
  depth = 0,
): { payload: Record<string, unknown>; metadata: Record<string, unknown> } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 5) return null
  const record = value as Record<string, unknown>
  if (
    Array.isArray(record.clips)
    || record.requested_clip_count !== undefined
    || record.produced_clip_count !== undefined
    || record.zero_output_reason !== undefined
    || record.effective_options !== undefined
    || record.applied_edits !== undefined
  ) {
    return { payload: record, metadata: getPortRecord(record.metadata) }
  }
  for (const key of ['result', 'output', 'data']) {
    const nested = findMagicClipPayloadEnvelope(record[key], depth + 1)
    if (!nested) continue
    const metadata = getPortRecord(record.metadata)
    return {
      payload: nested.payload,
      metadata: Object.keys(metadata).length > 0 ? metadata : nested.metadata,
    }
  }
  return null
}

function collectMagicClipAppliedTimelineCounts(clips: unknown[]) {
  let silenceCutCount = 0
  let transitionCount = 0
  let hasSilenceCutContract = false
  let hasTransitionContract = false
  for (const value of clips) {
    const clip = getPortRecord(value)
    const metadata = getPortRecord(clip.metadata)
    const transform = getPortRecord(metadata.transform)
    const timeline = getPortRecord(transform.edit_timeline ?? clip.edit_timeline)
    if (Array.isArray(timeline.silence_cuts)) {
      hasSilenceCutContract = true
      silenceCutCount += timeline.silence_cuts.length
    }
    if (Array.isArray(timeline.transition_plan)) {
      hasTransitionContract = true
      transitionCount += timeline.transition_plan.length
    }
  }
  return {
    silenceCutCount: hasSilenceCutContract ? silenceCutCount : null,
    transitionCount: hasTransitionContract ? transitionCount : null,
  }
}

type MagicClipRunSummaryCopy = {
  silenceCutsApplied: (count: number) => string
  noSafeSilenceCutsApplied: string
  zeroSilenceCutsApplied: string
  contextMontageApplied: (count: number) => string
  captionPatchesApplied: (count: number) => string
  transitionsApplied: (count: number) => string
  noTransitionsApplied: string
  removeSilence: (status: string) => string
  on: string
  off: string
  contextMontage: (value: string) => string
  editingStyle: (value: string) => string
  transition: (value: string) => string
}

function formatMagicClipRunSummary(
  summary: MagicClipRunSummary | null | undefined,
  copy: MagicClipRunSummaryCopy,
) {
  if (!summary) return undefined
  const facts: string[] = []
  if (summary.appliedSilenceCutCount !== null) {
    if (summary.appliedSilenceCutCount > 0) {
      facts.push(copy.silenceCutsApplied(summary.appliedSilenceCutCount))
    } else if (summary.effectiveRemoveSilence === true) {
      facts.push(copy.noSafeSilenceCutsApplied)
    } else if (summary.effectiveRemoveSilence === null) {
      facts.push(copy.zeroSilenceCutsApplied)
    }
  }
  if (
    summary.appliedContextMontageClipCount !== null
    && summary.appliedContextMontageClipCount > 0
  ) {
    facts.push(copy.contextMontageApplied(summary.appliedContextMontageClipCount))
  }
  if (summary.appliedDisplayPatchCount !== null && summary.appliedDisplayPatchCount > 0) {
    facts.push(copy.captionPatchesApplied(summary.appliedDisplayPatchCount))
  }
  if (summary.appliedTransitionCount !== null) {
    facts.push(
      summary.appliedTransitionCount > 0
        ? copy.transitionsApplied(summary.appliedTransitionCount)
        : copy.noTransitionsApplied,
    )
  }
  if (summary.effectiveRemoveSilence !== null) {
    facts.push(copy.removeSilence(summary.effectiveRemoveSilence ? copy.on : copy.off))
  }
  if (summary.effectiveContextMontage) {
    facts.push(copy.contextMontage(formatMagicClipSetting(summary.effectiveContextMontage)))
  }
  if (summary.effectiveEditingStyle) {
    facts.push(copy.editingStyle(formatMagicClipSetting(summary.effectiveEditingStyle)))
  }
  if (summary.effectiveTransition) {
    facts.push(copy.transition(formatMagicClipSetting(summary.effectiveTransition)))
  }
  return facts.length > 0 ? facts.join(' · ') : undefined
}

function formatMagicClipSetting(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getNonNegativeInteger(value: unknown) {
  const numberValue = getFiniteNumber(value)
  return numberValue !== null && numberValue >= 0 && Number.isInteger(numberValue)
    ? numberValue
    : null
}

function getOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

type MagicClipRunInfo = {
  producedClipCount: number
  requestedClipCount: number | null
  taskId: string | null
  actualCredits: number | null
  startedAt: string | null
  completedAt: string | null
  sourceMedia: ToolRunSourceMedia | null
}

type ToolBatchOutputGalleryProps = {
  items: ToolOutputMedia[]
  title?: string
  help?: string
  taskId?: string | null
  taskDetails?: StorageInspectorTaskDetails
  runInfo?: MagicClipRunInfo | null
  presentation?: 'cards' | 'shorts' | 'unified-frame-grid'
  channelId?: string | null
  hydratePreviewItem?: (item: ToolOutputMedia) => Promise<ToolOutputMedia>
}

const EMPTY_TOOL_OUTPUT_DELIVERY_URLS: ReadonlyMap<string, string> = new Map()
const TOOL_BATCH_THUMBNAIL_READINESS_RETRY_LIMIT = 2

type ToolBatchStorageDeliveryPlanItem = {
  objectId: string
  variant?: 'thumbnail'
}

function isCensorDeliveryBlocked(item: ToolOutputMedia) {
  return ['needs_review', 'failed'].includes(item.censor?.status ?? '')
}

function getToolBatchStorageDeliveryPlan(
  items: ToolOutputMedia[],
  presentation: ToolBatchOutputGalleryProps['presentation'],
) {
  const plan = new Map<string, ToolBatchStorageDeliveryPlanItem>()
  for (const item of items) {
    const storageObjectId = item.storageObjectId?.trim()
    if (
      !storageObjectId
      || isCensorDeliveryBlocked(item)
      || getStoragePresentationReadiness(item) === 'processing'
      || getStoragePresentationReadiness(item) === 'unavailable'
    ) continue
    if (item.kind === 'video') {
      if (presentation === 'shorts') {
        plan.set(`${storageObjectId}:thumbnail`, {
          objectId: storageObjectId,
          variant: 'thumbnail',
        })
      }
      continue
    }
    plan.set(`${storageObjectId}:original`, { objectId: storageObjectId })
  }
  return [...plan.values()]
}

function getToolBatchPendingThumbnailRetrySignature(
  items: ReadonlyArray<{
    object_id: string
    status: string
    error?: { code?: string }
  }> | undefined,
) {
  if (!items) return ''
  return items
    .flatMap((item) => (
      item.status === 'error'
      && (
        item.error?.code === 'STORAGE_DELIVERY_NOT_READY'
        || item.error?.code === 'STORAGE_THUMBNAIL_NOT_AVAILABLE'
      )
        ? [item.object_id]
        : []
    ))
    .sort()
    .join('|')
}

type ToolBatchThumbnailReadinessRetryState = {
  planIdentity: string
  attempts: number
  dataUpdatedAt: number
}

function scheduleToolBatchThumbnailReadinessRetry({
  state,
  planIdentity,
  pendingSignature,
  dataUpdatedAt,
  isFetching,
  refetch,
  schedule,
}: {
  state: ToolBatchThumbnailReadinessRetryState
  planIdentity: string
  pendingSignature: string
  dataUpdatedAt: number
  isFetching: boolean
  refetch: () => void
  schedule: (callback: () => void, delayMs: number) => () => void
}) {
  if (state.planIdentity !== planIdentity) {
    state.planIdentity = planIdentity
    state.attempts = 0
    state.dataUpdatedAt = 0
  }
  if (
    !pendingSignature
    || isFetching
    || state.attempts >= TOOL_BATCH_THUMBNAIL_READINESS_RETRY_LIMIT
    || state.dataUpdatedAt === dataUpdatedAt
  ) return undefined

  const retryDelayMs = Math.min(600 * (2 ** state.attempts), 1_500)
  return schedule(() => {
    if (state.planIdentity !== planIdentity) return
    state.attempts += 1
    state.dataUpdatedAt = dataUpdatedAt
    refetch()
  }, retryDelayMs)
}

function ToolBatchOutputGallery(props: ToolBatchOutputGalleryProps) {
  const { items, channelId = null, presentation } = props
  const hasHydrated = React.useSyncExternalStore(
    subscribeToToolsWorkspaceHydration,
    getToolsWorkspaceClientHydrationSnapshot,
    getToolsWorkspaceServerHydrationSnapshot,
  )
  const storageDeliveryPlan = React.useMemo(
    () => getToolBatchStorageDeliveryPlan(items, presentation),
    [items, presentation],
  )

  if (hasHydrated && channelId && storageDeliveryPlan.length > 0) {
    return (
      <ToolBatchOutputGalleryWithDelivery
        {...props}
        channelId={channelId}
        storageDeliveryPlan={storageDeliveryPlan}
      />
    )
  }

  return (
    <ToolBatchOutputGalleryContent
      {...props}
      channelId={channelId}
      deliveryUrls={EMPTY_TOOL_OUTPUT_DELIVERY_URLS}
      thumbnailUrls={EMPTY_TOOL_OUTPUT_DELIVERY_URLS}
      thumbnailDeliverySettled={!hasHydrated || !channelId || storageDeliveryPlan.length === 0}
    />
  )
}

function ToolBatchOutputGalleryWithDelivery({
  storageDeliveryPlan,
  ...props
}: ToolBatchOutputGalleryProps & {
  channelId: string
  storageDeliveryPlan: ToolBatchStorageDeliveryPlanItem[]
}) {
  const deliveryPlanIdentity = JSON.stringify([
    props.channelId,
    storageDeliveryPlan.map((item) => `${item.objectId}:${item.variant ?? 'original'}`),
  ])
  const deliveryQuery = useQuery({
    queryKey: [
      'tool-batch-output-delivery',
      props.channelId,
      storageDeliveryPlan.map((item) => `${item.objectId}:${item.variant ?? 'original'}`).join(':'),
    ],
    queryFn: ({ signal }) => fetchStorageDeliveryUrlsInChunks({
      channelId: props.channelId,
      items: storageDeliveryPlan.map((item) => ({
        ...item,
        expiresInSeconds: 3_600,
      })),
      signal,
    }),
    staleTime: 45 * 60_000,
    refetchInterval: (query) => query.state.error
      ? false
      : storageDeliveryRefreshDelay(query.state.data?.items),
    refetchOnWindowFocus: (query) => Boolean(query.state.data) && !query.state.error,
    retry: (failureCount, error) => {
      const status = error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: unknown }).status)
        : null
      if (status === 429 || (status !== null && Number.isFinite(status) && status < 500)) return false
      return failureCount < 1
    },
  })
  const pendingThumbnailRetrySignature = React.useMemo(
    () => getToolBatchPendingThumbnailRetrySignature(deliveryQuery.data?.items),
    [deliveryQuery.data?.items],
  )
  const thumbnailReadinessRetryRef = React.useRef({
    planIdentity: '',
    attempts: 0,
    dataUpdatedAt: 0,
  })
  const refetchDelivery = deliveryQuery.refetch
  React.useEffect(() => scheduleToolBatchThumbnailReadinessRetry({
    state: thumbnailReadinessRetryRef.current,
    planIdentity: deliveryPlanIdentity,
    pendingSignature: pendingThumbnailRetrySignature,
    dataUpdatedAt: deliveryQuery.dataUpdatedAt,
    isFetching: deliveryQuery.isFetching,
    refetch: () => {
      void refetchDelivery()
    },
    schedule: (callback, delayMs) => {
      const timeoutId = window.setTimeout(callback, delayMs)
      return () => window.clearTimeout(timeoutId)
    },
  }), [
    deliveryPlanIdentity,
    deliveryQuery.dataUpdatedAt,
    deliveryQuery.isFetching,
    pendingThumbnailRetrySignature,
    refetchDelivery,
  ])
  const deliveryUrls = React.useMemo(() => new Map(
    (deliveryQuery.data?.items ?? []).flatMap((entry) => (
      entry.status === 'ok' && entry.variant !== 'thumbnail'
        ? [[entry.object_id, entry.url] as const]
        : []
    )),
  ), [deliveryQuery.data?.items])
  const thumbnailUrls = React.useMemo(() => new Map(
    (deliveryQuery.data?.items ?? []).flatMap((entry) => (
      entry.status === 'ok' && entry.variant === 'thumbnail'
        ? [[entry.object_id, entry.url] as const]
        : []
    )),
  ), [deliveryQuery.data?.items])

  return (
    <ToolBatchOutputGalleryContent
      {...props}
      deliveryUrls={deliveryUrls}
      thumbnailUrls={thumbnailUrls}
      thumbnailDeliverySettled={!deliveryQuery.isPending && !deliveryQuery.isFetching}
    />
  )
}

function ToolBatchOutputGalleryContent({
  items: originalItems,
  title,
  help,
  taskId,
  taskDetails,
  runInfo,
  presentation = 'cards',
  channelId = null,
  hydratePreviewItem,
  deliveryUrls,
  thumbnailUrls,
  thumbnailDeliverySettled = false,
}: ToolBatchOutputGalleryProps & {
  deliveryUrls: ReadonlyMap<string, string>
  thumbnailUrls: ReadonlyMap<string, string>
  thumbnailDeliverySettled?: boolean
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const tWorkflows = useTranslations('Workflows')
  const unifiedFrameGrid = presentation === 'unified-frame-grid'
  const shortsGrid = presentation === 'shorts'
  const [censorReplacements, setCensorReplacements] = React.useState<Record<string, { objectId: string; status: string; count: number }>>({})
  const items = originalItems.map((item) => {
    const root = item.censorReviewObjectId ?? item.storageObjectId ?? ''
    const replacement = censorReplacements[root]
    return replacement ? { ...item, censorReviewObjectId: root, storageObjectId: replacement.objectId,
      url: `storage://${replacement.objectId}`, censor: { ...item.censor!, status: replacement.status, applied_count: replacement.count } } : item
  })
  const showHeader = Boolean(runInfo || title || help || taskId)
  const [openingObjectId, setOpeningObjectId] = React.useState<string | null>(null)
  const openingObjectIdRef = React.useRef<string | null>(null)
  const [deliveryError, setDeliveryError] = React.useState<string | null>(null)
  const [failedThumbnailUrls, setFailedThumbnailUrls] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const handleThumbnailFailure = React.useCallback((url: string) => {
    setFailedThumbnailUrls((current) => {
      if (current.has(url)) return current
      const next = new Set(current)
      next.add(url)
      return next
    })
  }, [])

  const handlePreview = React.useCallback(async (
    item: ToolOutputMedia,
    resolvedUrl: string | null,
  ) => {
    const storageObjectId = item.storageObjectId?.trim() || null
    if (openingObjectIdRef.current || isCensorDeliveryBlocked(item)) return
    if (storageObjectId) {
      openingObjectIdRef.current = storageObjectId
      setOpeningObjectId(storageObjectId)
    }
    setDeliveryError(null)
    try {
      let previewItem = item
      if (hydratePreviewItem) {
        try {
          previewItem = await hydratePreviewItem(item)
        } catch {
          setDeliveryError('Could not load this clip publishing details. Try opening it again.')
        }
      }
      if (!storageObjectId || !channelId) {
        if (resolvedUrl) {
          openOutputUrl(resolvedUrl, previewItem.kind, previewItem.label, {
            metadata: previewItem,
            taskDetails,
          })
        }
        return
      }
      const previewUrl = previewItem.kind === 'video'
        ? getStoragePlaybackUrl({ channelId, objectId: storageObjectId })
        : (await getStorageDeliveryUrl({
            channelId,
            objectId: storageObjectId,
            expiresInSeconds: 900,
          })).url
      if (!isUsableOutputUrl(previewUrl)) {
        throw new Error('Storage returned an invalid media URL')
      }
      openOutputUrl(previewUrl, previewItem.kind, previewItem.label, {
        downloadUrl: getToolBatchOutputDownloadUrl(previewItem, previewUrl, channelId),
        metadata: previewItem,
        taskDetails,
      })
    } catch {
      setDeliveryError('Could not refresh this media URL. Try opening it again.')
    } finally {
      if (openingObjectIdRef.current === storageObjectId) {
        openingObjectIdRef.current = null
      }
      setOpeningObjectId(null)
    }
  }, [channelId, hydratePreviewItem, taskDetails])

  return (
    <div
      data-frame-gallery-count={unifiedFrameGrid ? items.length : undefined}
      data-magic-clips-gallery-count={shortsGrid ? items.length : undefined}
      className={cn(
        shortsGrid ? 'overflow-visible' : 'overflow-auto',
        shortsGrid
          ? 'p-3'
          : (!unifiedFrameGrid || showHeader) && 'p-3 pt-12',
        unifiedFrameGrid
          ? 'max-h-[clamp(24rem,72vh,52rem)] bg-muted/20'
          : shortsGrid
            ? 'bg-muted/35'
          : 'h-[clamp(20rem,52vh,42rem)] bg-muted/35',
      )}
    >
      {showHeader ? (
        runInfo ? (
          <MagicClipRunInfoBar info={runInfo} />
        ) : <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          {title || help ? (
            <div className="min-w-0">
              {title ? <p className="text-sm font-semibold text-foreground">{title}</p> : null}
              {help ? <p className="mt-0.5 text-xs text-muted-foreground">{help}</p> : null}
            </div>
          ) : null}
          {taskId ? (
            <div
              data-magic-clips-task-id={taskId ?? undefined}
              className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
            >
              {taskId ? (
                <>
                  <span className="shrink-0 font-medium"><UiText id="task_id_0491c6d4" /></span>
                  <code className="min-w-0 truncate font-mono text-[11px]" title={taskId}>
                    {formatShortIdentifier(taskId)}
                  </code>
                  <button
                    type="button"
                    aria-label={tAuto('copy_task_id_9b3cceb4')}
                    title={tAuto('copy_task_id_9b3cceb4')}
                    onClick={() => copyTextToClipboard(taskId)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {deliveryError ? (
        <p role="alert" className="mb-3 text-xs text-destructive">{deliveryError}</p>
      ) : null}
      <div className={cn(
        'grid',
        unifiedFrameGrid
          ? cn(
            'gap-px overflow-hidden bg-border dark:bg-white/[0.08]',
            showHeader && 'rounded-xl border border-border',
          )
          : 'gap-2',
        unifiedFrameGrid
          ? getUnifiedFrameGridColumns(items.length)
          : shortsGrid
            ? 'grid-cols-1 sm:grid-cols-3'
          : items.length === 1
            ? 'max-w-xl grid-cols-1'
            : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
      )}>
        {items.map((item, index) => {
          const storageObjectId = item.storageObjectId?.trim() || null
          const storageReadiness = getStoragePresentationReadiness(item)
          const storageReadyForDelivery = !isCensorDeliveryBlocked(item) && storageReadiness !== 'processing'
            && storageReadiness !== 'unavailable'
          const resolvedUrl = !storageReadyForDelivery ? null : storageObjectId && item.kind === 'video' && channelId
            ? getStoragePlaybackUrl({ channelId, objectId: storageObjectId })
            : storageObjectId
            ? storageReadyForDelivery
              ? deliveryUrls.get(storageObjectId)
              ?? (isHttpMediaUrl(item.url) ? item.url : null)
              : null
            : item.url
          const playable = Boolean(resolvedUrl && isUsableOutputUrl(resolvedUrl))
          const previewable = playable || Boolean(storageReadyForDelivery && storageObjectId && channelId)
          const downloadUrl = storageReadyForDelivery
            ? getToolBatchOutputDownloadUrl(item, resolvedUrl, channelId)
            : null
          const opening = Boolean(storageObjectId && openingObjectId === storageObjectId)
          const thumbnailCandidateUrl = storageObjectId && item.kind === 'video'
            ? thumbnailUrls.get(storageObjectId) ?? null
            : null
          const thumbnailUrl = thumbnailCandidateUrl && !failedThumbnailUrls.has(thumbnailCandidateUrl)
            ? thumbnailCandidateUrl
            : null
          const thumbnailExpected = Boolean(
            shortsGrid
            && item.kind === 'video'
            && storageReadyForDelivery
            && storageObjectId
            && channelId,
          )
          return (
          <div
            key={`${storageObjectId ?? item.url}:${index}`}
            data-frame-gallery-item={unifiedFrameGrid ? index + 1 : undefined}
            className={cn(
              'group/frame relative min-w-0 overflow-hidden bg-card',
              !unifiedFrameGrid && 'rounded-xl border border-border',
            )}
          >
            <button
              type="button"
              aria-label={tAuto('preview_named', { name: toolCopy(item.label) })}
              onClick={() => {
                void handlePreview(item, resolvedUrl)
              }}
              disabled={!previewable || Boolean(openingObjectId)}
              className={cn(
                'relative block w-full overflow-hidden bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                shortsGrid ? 'aspect-[9/16]' : 'aspect-video',
              )}
            >
              {opening ? (
                <ToolMediaLoadingIndicator label={tAuto('refreshing_media_2b2a5c01')} size="sm" className="h-full w-full" />
              ) : item.kind === 'video' && thumbnailUrl ? (
                <>
                  {/* Storage creates this derivative server-side; the grid never decodes the MP4. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnailUrl}
                    alt={tAuto('preview_named', { name: toolCopy(item.label) })}
                    loading="lazy"
                    decoding="async"
                    onError={() => handleThumbnailFailure(thumbnailUrl)}
                    className="pointer-events-none h-full w-full object-cover transition-transform duration-200 group-hover/frame:scale-[1.02]"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <span className="flex size-9 items-center justify-center rounded-full bg-background/88 text-foreground shadow-sm backdrop-blur-sm">
                      <Play className="ml-0.5 size-4 fill-current" />
                    </span>
                  </span>
                </>
              ) : item.kind === 'video' && thumbnailExpected && !thumbnailDeliverySettled ? (
                <ToolMediaLoadingIndicator
                  label={tAuto('preparing_selected_clip_preview_b490b367')}
                  size="sm"
                  className="h-full w-full"
                />
              ) : item.kind === 'video' && playable ? (
                <span className="pointer-events-none flex h-full w-full items-center justify-center bg-black">
                  <Clapperboard className="size-8 text-white/35" />
                  <span className="absolute flex size-9 items-center justify-center rounded-full bg-background/88 text-foreground shadow-sm backdrop-blur-sm">
                    <Play className="ml-0.5 size-4 fill-current" />
                  </span>
                </span>
              ) : item.kind !== 'video' && playable ? (
                <Image
                  src={resolvedUrl!}
                  alt={toolCopy(item.label)}
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 14vw, (min-width: 640px) 22vw, 44vw"
                  className="object-contain transition-transform duration-200 group-hover/frame:scale-[1.02]"
                />
              ) : (
                <ToolMediaLoadingIndicator label={tAuto('preparing_media_b45681a2')} size="sm" className="h-full w-full" />
              )}
            </button>
            {unifiedFrameGrid ? (
              <>
                <span
                  data-frame-overlay-label={index + 1}
                  className="pointer-events-none absolute left-2 top-2 z-10 max-w-[70%] truncate rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-md"
                  title={toolCopy(item.label)}
                >
                  {toolCopy(item.label)}
                </span>
                <button
                  type="button"
                  data-frame-download-action={index + 1}
                  aria-label={tAuto('download_named', { name: toolCopy(item.label) })}
                  title={tAuto('download_named', { name: toolCopy(item.label) })}
                  onClick={() => {
                    if (downloadUrl) downloadOutputUrl(downloadUrl)
                  }}
                  disabled={!downloadUrl}
                  className="absolute right-2 top-2 z-20 flex size-8 items-center justify-center rounded-md border border-white/15 bg-black/45 text-white shadow-sm backdrop-blur-md transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <Download className="size-3.5" />
                </button>
              </>
            ) : (
            <div data-batch-tile-footer className="border-t border-border/70">
              <div className="min-w-0 px-2.5 py-2">
                <p className="line-clamp-2 min-h-8 text-xs font-semibold leading-4 text-foreground" title={toolCopy(item.label)}>{toolCopy(item.label)}</p>
                {item.socialCaption ?? toolCopy(item.description) ? (
                  <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground" title={item.socialCaption ?? toolCopy(item.description) ?? undefined}>
                    {item.socialCaption ?? toolCopy(item.description)}
                  </p>
                ) : null}
              </div>
              {shortsGrid && channelId && storageObjectId && item.censor ? (
                <CensorReviewPanel channelId={channelId} objectId={item.censorReviewObjectId ?? storageObjectId}
                  status={item.censor.status} count={item.censor.applied_count}
                  onCompleted={(objectId, status, count) => setCensorReplacements((current) => ({ ...current,
                    [item.censorReviewObjectId ?? storageObjectId]: { objectId, status, count } }))} />
              ) : null}
              <div className="flex items-center justify-end gap-1 border-t border-border/60 px-2 py-1.5">
                {shortsGrid && storageObjectId && storageReadyForDelivery ? (
                  <Link
                    href={`/tools?tool=media-transform&storage_object_id=${encodeURIComponent(storageObjectId)}`}
                    aria-label={tAuto('viral_clips_edit_clip')}
                    title={tAuto('viral_clips_edit_clip')}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Crop className="size-3.5" />
                  </Link>
                ) : null}
                {shortsGrid && storageObjectId && storageReadyForDelivery ? (
                  <Link
                    href={`/workflows?intent=youtube-upload&storage_object_id=${encodeURIComponent(storageObjectId)}`}
                    aria-label={tWorkflows('library.uploadToYoutubeTitle')}
                    title={tWorkflows('library.uploadToYoutubeDescription')}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Upload className="size-3.5" />
                  </Link>
                ) : null}
                {shortsGrid && storageObjectId && storageReadyForDelivery ? (
                  <AddToCalendarButton
                    item={{ id: `short:${storageObjectId}`, title: toolCopy(item.label), thumbnail: thumbnailUrl, source: 'short' }}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : null}
                <button
                  type="button"
                  aria-label={tAuto('download_named', { name: toolCopy(item.label) })}
                  title={tAuto('download_named', { name: toolCopy(item.label) })}
                  onClick={() => {
                    if (downloadUrl) downloadOutputUrl(downloadUrl)
                  }}
                  disabled={!downloadUrl}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Download className="size-3.5" />
                </button>
              </div>
            </div>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}

function MagicClipRunInfoBar({ info }: { info: MagicClipRunInfo }) {
  const tAuto = useTranslations('Auto')
  const elapsed = formatToolTaskCompletionDuration(info.startedAt, info.completedAt)
  const sourceDuration = info.sourceMedia?.durationSeconds != null
    ? formatTranscriptDuration(info.sourceMedia.durationSeconds)
    : null
  const sourceResolution = info.sourceMedia?.width && info.sourceMedia.height
    ? `${info.sourceMedia.width}×${info.sourceMedia.height}`
    : null
  const compactFacts = [
    tAuto('viral_clips_info_clip_count', { count: info.producedClipCount }),
    elapsed,
    info.sourceMedia?.name?.trim() || null,
  ].filter((value): value is string => Boolean(value))
  const detailRows = [
    elapsed ? { label: tAuto('viral_clips_info_elapsed'), value: elapsed } : null,
    info.sourceMedia?.name?.trim()
      ? { label: tAuto('viral_clips_info_source'), value: info.sourceMedia.name.trim() }
      : null,
    sourceDuration
      ? { label: tAuto('viral_clips_info_duration'), value: sourceDuration }
      : null,
    sourceResolution
      ? { label: tAuto('viral_clips_info_resolution'), value: sourceResolution }
      : null,
    info.sourceMedia?.mimeType?.trim()
      ? { label: tAuto('viral_clips_info_mime'), value: info.sourceMedia.mimeType.trim() }
      : null,
    info.requestedClipCount != null
      ? { label: tAuto('viral_clips_info_requested'), value: String(info.requestedClipCount) }
      : null,
    Number.isFinite(info.actualCredits)
      ? { label: tAuto('viral_clips_info_credits'), value: formatCreditLabel(Math.max(0, Number(info.actualCredits))) }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row?.value))

  return (
    <details
      data-magic-clips-run-info
      data-magic-clips-task-id={info.taskId ?? undefined}
      className="group/run-info mb-3 overflow-hidden rounded-xl border border-border/70 bg-background/45"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground marker:hidden">
        <Info className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {compactFacts.join(' · ')}
        </span>
        <ChevronDown className="size-3.5 shrink-0 transition-transform group-open/run-info:rotate-180" />
      </summary>
      <div className="border-t border-border/70 px-3 py-3">
        {detailRows.length > 0 ? (
          <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
            {detailRows.map((row) => (
              <div key={`${row.label}:${row.value}`} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{row.label}</dt>
                <dd className="mt-0.5 truncate text-xs font-medium text-foreground" title={row.value}>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {info.taskId ? (
          <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
            <span className="shrink-0 font-medium">{tAuto('viral_clips_info_task_id')}</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[11px]" title={info.taskId}>{info.taskId}</code>
            <button type="button" aria-label={tAuto('copy_task_id_9b3cceb4')} title={tAuto('copy_task_id_9b3cceb4')} onClick={() => copyTextToClipboard(info.taskId!)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Copy className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </details>
  )
}


function formatToolTaskCompletionDuration(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
) {
  if (!startedAt || !completedAt) return null
  const startedAtMs = Date.parse(startedAt)
  const completedAtMs = Date.parse(completedAt)
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs) || completedAtMs < startedAtMs) return null
  return formatResearchDurationMilliseconds(completedAtMs - startedAtMs)
}

function getToolBatchOutputDownloadUrl(
  item: ToolOutputMedia,
  resolvedUrl: string | null,
  channelId: string | null,
) {
  const storageObjectId = item.storageObjectId?.trim()
  if (isCensorDeliveryBlocked(item)) return null
  if (!storageObjectId || !channelId) return resolvedUrl
  const fallbackExtension = item.kind === 'image' ? 'jpg' : item.kind === 'audio' ? 'mp3' : 'mp4'
  return getStorageDownloadUrl({
    channelId,
    objectId: storageObjectId,
    fileName: item.fileName?.trim() || `${item.label}.${fallbackExtension}`,
  })
}

function getUnifiedFrameGridColumns(itemCount: number) {
  if (itemCount <= 1) return 'grid-cols-1'
  if (itemCount === 2) return 'grid-cols-2'
  if (itemCount === 3) return 'grid-cols-2 sm:grid-cols-3'
  return 'grid-cols-2 sm:grid-cols-4'
}

function TenantNodeQueueSummary({ status }: { status?: TenantNodeQueueStatus | null }) {
  const t = useTranslations('Auto')
  if (!hasTenantNodeQueue(status)) return null
  return (
    <div role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <p>{typeof status?.queueConcurrencyLimit === 'number' && typeof status.queueActiveCount === 'number'
        ? t('tenant_node_slot_wait', { active: status.queueActiveCount, limit: status.queueConcurrencyLimit })
        : t('tenant_node_slot_wait_unknown')}</p>
      {typeof status?.queueReservedCount === 'number' && typeof status.queueWaitingCount === 'number'
        ? <p>{t('tenant_node_slot_counts', { reserved: status.queueReservedCount, waiting: status.queueWaitingCount })}</p>
        : null}
      <Link href="/settings?tab=billing" className="underline underline-offset-2">{t('tenant_node_slot_plan_link')}</Link>
    </div>
  )
}

/** ERR-05: a busy provider (E3949) keeps the job queued instead of failing it. */
function ProviderBusyQueueNotice({ status }: { status?: TenantNodeQueueStatus | null }) {
  const t = useTranslations('Auto')
  if (!hasProviderBusyQueue(status)) return null
  return (
    <div role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <p>{t('provider_busy_wait')}</p>
    </div>
  )
}

function ToolRunStatusBadge({
  status,
  error,
  settlementStatus,
  stage,
  progress,
  outputPending = false,
  compact = false,
  appearance = 'badge',
  className,
}: {
  status: string | null | undefined
  error?: string | null
  settlementStatus?: string | null
  stage?: string | null
  progress?: number | null
  outputPending?: boolean
  compact?: boolean
  appearance?: 'badge' | 'plain'
  className?: string
}) {
  const reconciliationRequired = !isRuntimeTerminal(status) && (status?.toLowerCase() === 'reconciliation_required'
    || settlementStatus?.toLowerCase() === 'reconciliation_required')
  const failed = Boolean(error)
    || reconciliationRequired
    || isFailedRunStatus(status)
    || status?.toLowerCase() === 'insufficient_balance'
  const running = !failed && (
    shouldPollAgentStatus(status)
    || outputPending
    || (!isRuntimeTerminal(status) && settlementStatus?.toLowerCase() === 'settlement_pending')
  )
  if (!failed && !running) return null
  const label = failed
    ? 'Failed'
    : running
      ? getRunProgressStatusLabel(status, { settlementStatus, stage, progress, outputPending })
      : formatRunStatus(status)
  return (
    <ToolOutputStateBadge
      state={failed ? 'failed' : running ? 'processing' : 'ready'}
      label={label}
      compact={compact || appearance === 'plain'}
      className={className}
    />
  )
}

function PromptCopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" />
    </svg>
  )
}

function ToolOutputTopActions({
  media,
  outputKind,
  prompt,
  taskDetails,
  openUrl,
  downloadUrl,
  canDownload,
  showOpen = true,
}: {
  media: ToolOutputMedia | null
  outputKind: ToolOutputMediaKind
  prompt?: string | null
  taskDetails?: StorageInspectorTaskDetails
  openUrl?: string | null
  downloadUrl?: string | null
  canDownload?: boolean
  showOpen?: boolean
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const resolvedOpenUrl = openUrl ?? media?.url ?? null
  const resolvedDownloadUrl = downloadUrl ?? media?.url ?? null
  const allowDownload = canDownload ?? Boolean(
    media && resolvedDownloadUrl && !isEmbeddableVideoUrl(resolvedDownloadUrl),
  )
  const hasActions = Boolean(
    (showOpen && resolvedOpenUrl)
    || media
    || (allowDownload && resolvedDownloadUrl),
  )
  if (!hasActions) return null

  return (
    <div className="absolute right-3 top-3 z-20 flex translate-y-[-2px] items-center gap-1.5 rounded-md border border-white/10 bg-[#202327]/78 p-1 text-white opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-150 group-hover/output-card:translate-y-0 group-hover/output-card:opacity-100 group-focus-within/output-card:translate-y-0 group-focus-within/output-card:opacity-100">
      {showOpen && resolvedOpenUrl ? (
        <ToolIconButton
          label={tAuto('open_output_0cf65e4c')}
          onClick={() => openOutputUrl(resolvedOpenUrl, media?.kind ?? outputKind, toolCopy(media?.label) ?? undefined, {
            prompt: prompt ?? undefined,
            downloadUrl: resolvedDownloadUrl,
            taskDetails,
          })}
        >
          <ToolOpenOutputIcon kind={media?.kind ?? outputKind} />
        </ToolIconButton>
      ) : null}
      {media && media.kind !== 'audio' ? <ToolOutputUseMenu media={media} /> : null}
      {allowDownload && resolvedDownloadUrl ? (
        <ToolIconButton label={tAuto('download_a479c9c3')} onClick={() => downloadOutputUrl(resolvedDownloadUrl)}>
          <Download className="size-4" />
        </ToolIconButton>
      ) : null}
    </div>
  )
}

function ToolOutputUseMenu({ media }: { media: ToolOutputMedia }) {
  const tAuto = useTranslations('Auto')
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tAuto('use_output_39fddd68')}
              className="size-8 rounded-md border border-white/10 bg-white/[0.055] text-white/86 hover:bg-white/[0.14] hover:text-white"
            >
              <WandSparkles className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent><UiText id="use_output_39fddd68" /></TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label={tAuto('use_output_39fddd68')}
        className="tools-studio w-52 border-border bg-background p-1 text-foreground shadow-xl dark:border-white/[0.08]"
      >
        {media.kind === 'image' ? (
          <button
            type="button"
            onClick={() => openToolShortcut('image-editor', media.url)}
            className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium hover:bg-accent"
          >
            <ImageIcon className="size-4 text-muted-foreground" />
            <UiText id="image_to_image_93b333f5" /></button>
        ) : null}
        <button
          type="button"
          onClick={() => openToolShortcut('video', media.url)}
          className="mt-1 flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium hover:bg-accent"
        >
          <Clapperboard className="size-4 text-muted-foreground" />
          {media.kind === 'image' ? tAuto('create_video_7f5ae026') : tAuto('use_in_video_7a73fdb8')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

function ToolIconButton({
  label,
  children,
  onClick,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          title={label}
          onClick={onClick}
          className="size-8 rounded-md border border-white/10 bg-white/[0.055] text-white/86 hover:bg-white/[0.14] hover:text-white"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolOpenOutputIcon({ kind }: { kind: ToolOutputMediaKind }) {
  if (kind === 'video') return <Play className="size-4" />
  if (kind === 'audio') return <AudioLines className="size-4" />
  return <Eye className="size-4" />
}

function formatToolRunErrorMessage(
  message: string,
  nodes: WorkflowAgentStatusResult['nodes'] = [],
  translatedMessagesToPreserve: readonly string[] = [],
) {
  const failedNode = nodes.find((node) => node.errorMessage || node.status.toLowerCase() === 'failed')
  const rawMessage = failedNode?.errorMessage ?? message
  if (translatedMessagesToPreserve.includes(rawMessage)) return rawMessage
  const publicMessage = toPublicRuntimeError(rawMessage)?.message
    ?? 'Something went wrong. Error code: E3100'
  const nodeType = failedNode?.nodeType.toLowerCase() ?? ''
  if (nodeType.startsWith('transcript')) return `Transcript step failed. ${publicMessage}`
  if (nodeType.startsWith('subtitle_translate')) return `Translation step failed. ${publicMessage}`
  if (nodeType.startsWith('caption')) return `Caption render failed. ${publicMessage}`
  return publicMessage
}

function ToolImageGeneratingPlaceholder() {
  return <ToolGeneratingMediaPreview modelKind="image" />
}

function ToolGeneratingMediaPreview({
  modelKind,
  label,
  sourceMedia,
  heightClassName = 'h-[clamp(16rem,40vh,30rem)]',
}: {
  modelKind: ToolConfig['modelKind']
  label?: string
  sourceMedia?: ToolRunSourceMedia | null
  heightClassName?: string
}) {
  const tAuto = useTranslations('Auto')
  const accessibleLabel = label
    ?? tAuto(modelKind === 'video' ? 'generating_video' : modelKind === 'voice' ? 'generating_audio' : 'generating_image')
  const previewUrl = sourceMedia?.previewUrl?.trim() || null
  const [failedPreviewUrl, setFailedPreviewUrl] = React.useState<string | null>(null)
  const visiblePreviewUrl = previewUrl && previewUrl !== failedPreviewUrl ? previewUrl : null
  return (
    <div
      aria-busy="true"
      aria-label={accessibleLabel}
      className="relative overflow-hidden bg-[#111317]"
    >
      <div className={cn('relative flex w-full items-center justify-center', heightClassName)}>
        {visiblePreviewUrl ? (
          <Image
            src={visiblePreviewUrl}
            alt={tAuto('media_first_frame_alt', { name: sourceMedia?.name ?? tAuto('selected_video') })}
            fill
            sizes="(max-width: 1024px) 100vw, 62vw"
            unoptimized
            onError={() => setFailedPreviewUrl(visiblePreviewUrl)}
            className="scale-[1.055] object-cover opacity-55 blur-xl saturate-75 transition duration-500"
          />
        ) : (
          <Skeleton
            data-testid="media-processing-color-fallback"
            className="absolute inset-0 rounded-none bg-accent/30"
          />
        )}
        <div className="absolute inset-0 bg-black/38" />
        <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(to_right,rgb(255_255_255_/_0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255_/_0.05)_1px,transparent_1px)] [background-size:28px_28px]" />
        <Skeleton className="absolute inset-0 rounded-none bg-accent/20 opacity-70" />
        <ToolMediaLoadingIndicator
          label={accessibleLabel}
          className="absolute inset-0 z-10"
        />
      </div>
    </div>
  )
}

function ToolRunErrorCanvas({
  message,
  compact = false,
}: {
  message: string
  compact?: boolean
}) {
  return (
    <div className={cn(
      'relative overflow-hidden bg-destructive/5',
      compact ? 'h-[clamp(14rem,30vh,23rem)]' : 'h-[clamp(16rem,40vh,30rem)]',
    )}>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(222_53_11_/_0.16),rgb(255_255_255_/_0.03),transparent)]" />
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,rgb(255_255_255_/_0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255_/_0.04)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative flex h-full items-center justify-center px-4 pb-16">
        <div className="flex max-w-lg items-start gap-2.5 rounded-md border border-destructive/20 bg-background/72 px-3 py-2.5 text-destructive shadow-sm backdrop-blur-[2px]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <X className="size-4" />
          </span>
          <p className="min-w-0 text-xs leading-5 sm:text-sm">{message}</p>
        </div>
      </div>
    </div>
  )
}

function ToolMagicClipsFailedResult({
  message,
  taskId,
}: {
  message: string
  taskId: string | null
}) {
  const tAuto = useTranslations('Auto')
  const toolCopy = useToolCopy()
  return (
    <div
      data-magic-clips-failed-result
      className="relative min-h-28 overflow-hidden bg-destructive/5 px-3 pb-3 pt-12"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(222_53_11_/_0.12),transparent_62%)]" />
      <div className="relative flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-destructive/20 bg-background/72 px-3 py-2 text-destructive shadow-sm backdrop-blur-[2px]">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <X className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 text-xs leading-5 sm:text-sm">{toolCopy(message)}</p>
        {taskId ? (
          <div
            data-magic-clips-task-id={taskId}
            className="flex min-w-0 shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
          >
            <code className="max-w-40 truncate font-mono" title={taskId}>
              {formatShortIdentifier(taskId)}
            </code>
            <button
              type="button"
              aria-label={tAuto('copy_task_id_9b3cceb4')}
              title={tAuto('copy_task_id_9b3cceb4')}
              onClick={() => copyTextToClipboard(taskId)}
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ToolOutputRefreshFailedResult({
  taskId,
  onRetry,
}: {
  taskId: string | null
  onRetry?: () => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div
      data-output-refresh-failed
      role="alert"
      className="relative min-h-28 overflow-hidden bg-amber-400/5 px-3 pb-3 pt-12"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(250_204_21_/_0.12),transparent_62%)]" />
      <div className="relative flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-amber-400/25 bg-background/72 px-3 py-2 text-foreground shadow-sm backdrop-blur-[2px]">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-500">
          <RefreshCw className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 text-xs leading-5 sm:text-sm">
          <UiText id="the_task_completed_but_its_output_could_not_be_r_091eeabc" />
        </p>
        {taskId ? (
          <code className="max-w-40 truncate font-mono text-[11px] text-muted-foreground" title={taskId}>
            {formatShortIdentifier(taskId)}
          </code>
        ) : null}
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            <UiText id="retry_output_cbd7cb49" />
          </Button>
        ) : null}
        {taskId ? (
          <button
            type="button"
            aria-label={tAuto('copy_task_id_9b3cceb4')}
            title={tAuto('copy_task_id_9b3cceb4')}
            onClick={() => copyTextToClipboard(taskId)}
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function useGifReplayUrl(mediaUrl: string | null, replayable: boolean) {
  const [replayToken, setReplayToken] = React.useState(0)
  const replayCounterRef = React.useRef(0)
  const displayUrl = mediaUrl && replayable && replayToken > 0
    ? appendGifReplayParam(mediaUrl, replayToken)
    : mediaUrl
  const restart = React.useCallback(() => {
    if (!mediaUrl || !replayable) return mediaUrl
    replayCounterRef.current += 1
    const nextToken = replayCounterRef.current
    setReplayToken(nextToken)
    return appendGifReplayParam(mediaUrl, nextToken)
  }, [mediaUrl, replayable])

  return { displayUrl, restart }
}

function ToolRunMediaPreview({
  item,
  prompt,
  channelId,
  taskDetails,
  compact = false,
  replayGif = false,
  posterOnlyVideo = false,
}: {
  item: ToolOutputMedia
  prompt?: string | null
  channelId: string | null
  taskDetails?: StorageInspectorTaskDetails
  compact?: boolean
  replayGif?: boolean
  posterOnlyVideo?: boolean
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const isVideo = item.kind === 'video'
  const isAudio = item.kind === 'audio'
  const storageObjectId = item.storageObjectId?.trim()
  const storageBacked = Boolean(storageObjectId)
  const storageReadiness = getStoragePresentationReadiness(item)
  const storageReadyForDelivery = storageReadiness !== 'processing'
    && storageReadiness !== 'unavailable'
  // K7: show the light preview object when there is one; the download keeps the GIF object.
  const displayObjectId = item.previewStorageObjectId?.trim() || storageObjectId
  const deliveryQuery = useStorageObjectDeliveryUrl({
    channelId,
    storageObjectId: displayObjectId ?? null,
    enabled: Boolean(channelId && displayObjectId && storageReadyForDelivery),
    kind: item.kind,
  })
  const directRunUrl = isUsableOutputUrl(item.url)
    && storageReadyForDelivery
    && (!storageBacked || isSignedEmbeddableVideoUrl(item.url))
    ? item.url
    : null
  const resolvedUrl = deliveryQuery.data?.variant === 'original'
    && storageObjectId
    && channelId
    && (isVideo || isAudio)
    ? getStoragePlaybackUrl({ channelId, objectId: storageObjectId })
    : deliveryQuery.data?.url
    ?? directRunUrl
  const thumbnailQuery = useStorageObjectThumbnailUrl({
    channelId,
    storageObjectId: storageObjectId ?? null,
    enabled: Boolean(
      isVideo
      && channelId
      && storageObjectId
      && storageReadyForDelivery
    ),
  })
  const thumbnailEnabled = Boolean(isVideo && channelId && storageObjectId && storageReadyForDelivery)
  const [failedPosterUrl, setFailedPosterUrl] = React.useState<string | null>(null)
  const [failedPosterVideoUrl, setFailedPosterVideoUrl] = React.useState<string | null>(null)
  const videoPosterUrl = thumbnailQuery.data?.url
    && thumbnailQuery.data.url !== failedPosterUrl
    ? thumbnailQuery.data.url
    : null
  const videoPosterSourceUrl = !storageBacked
    && resolvedUrl
    && !isEmbeddableVideoUrl(resolvedUrl)
    ? resolvedUrl
    : null
  const usableVideoPosterSourceUrl = videoPosterSourceUrl !== failedPosterVideoUrl
    ? videoPosterSourceUrl
    : null
  const downloadUrl = storageReadyForDelivery && channelId && storageObjectId
    ? getStorageDownloadUrl({
      channelId,
      objectId: storageObjectId,
      fileName: item.fileName?.trim() || item.label || 'output',
    })
    : storageBacked ? null : resolvedUrl
  const [imageLoading, setImageLoading] = React.useState(!isVideo && !isAudio)
  const [imageFailed, setImageFailed] = React.useState(false)
  const gifReplayable = replayGif && item.kind === 'image'
  const gifReplay = useGifReplayUrl(resolvedUrl, gifReplayable)
  const heightClassName = compact
    ? 'h-[clamp(14rem,30vh,23rem)]'
    : 'h-[clamp(16rem,40vh,30rem)]'
  const actionMedia = resolvedUrl && !storageBacked
    ? { ...item, url: resolvedUrl }
    : null

  return (
    <div className={cn('relative overflow-hidden bg-muted', heightClassName)}>
      {!resolvedUrl ? (
        <div className="flex h-full items-center justify-center">
          {deliveryQuery.isError
            ? <ToolMediaLoadIssue kind={item.kind} onRetry={() => { void deliveryQuery.refetch() }} />
            : <ToolMediaLoadingOverlay label={tAuto('loading_kind', { kind: tAuto('media_kind', { kind: item.kind }) })} />}
        </div>
      ) : isVideo ? (
        <button
          type="button"
          onClick={() => openOutputUrl(resolvedUrl, item.kind, toolCopy(item.label), {
            prompt: prompt ?? undefined,
            downloadUrl,
            taskDetails,
          })}
          className="group relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          {videoPosterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={videoPosterUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFailedPosterUrl(videoPosterUrl)}
              className="pointer-events-none h-full w-full object-contain"
            />
          ) : thumbnailEnabled && (thumbnailQuery.isPending || thumbnailQuery.isFetching) ? (
            <span className="flex h-full w-full items-center justify-center bg-black">
              <ToolMediaLoadingIndicator label={tAuto('loading_recent_output_1a2091fb')} className="text-white/70" />
            </span>
          ) : posterOnlyVideo && usableVideoPosterSourceUrl ? (
            <ToolVideoMidpointPoster
              src={usableVideoPosterSourceUrl}
              onFailed={() => setFailedPosterVideoUrl(usableVideoPosterSourceUrl)}
              className="h-full w-full"
            />
          ) : posterOnlyVideo && isEmbeddableVideoUrl(resolvedUrl) ? (
            videoPosterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={videoPosterUrl}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setFailedPosterUrl(videoPosterUrl)}
                className="pointer-events-none h-full w-full object-contain"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-black">
                <Clapperboard className="size-10 text-white/35" />
              </span>
            )
          ) : isEmbeddableVideoUrl(resolvedUrl) ? (
            <iframe
              src={resolvedUrl}
              title={toolCopy(item.label)}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="pointer-events-none h-full w-full border-0 bg-black"
            />
          ) : (
            <video
              src={resolvedUrl}
              aria-hidden="true"
              tabIndex={-1}
              muted
              playsInline
              preload="metadata"
              className="pointer-events-none h-full w-full object-contain transition duration-200"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/10">
            <span className="flex size-12 items-center justify-center rounded-full bg-background/88 text-foreground shadow-sm backdrop-blur-sm">
              <Play className="ml-0.5 size-5 fill-current" />
            </span>
          </span>
        </button>
      ) : isAudio ? (
        <div className="flex h-full flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_center,rgb(16_185_129_/_0.16),transparent_58%)] px-8 pb-12">
          <span className="flex size-20 items-center justify-center rounded-full border border-border/60 bg-background/72 text-primary shadow-sm backdrop-blur-sm">
            <AudioLines className="size-9" />
          </span>
          <audio
            src={resolvedUrl}
            controls
            preload="metadata"
            className="w-full max-w-xl"
          />
        </div>
      ) : (
        <button
          type="button"
          onMouseEnter={() => void gifReplay.restart()}
          onFocus={() => void gifReplay.restart()}
          onClick={() => {
            const openUrl = gifReplayable ? gifReplay.restart() : resolvedUrl
            openOutputUrl(openUrl, item.kind, toolCopy(item.label), {
              prompt: prompt ?? undefined,
              downloadUrl,
              replayable: gifReplayable,
              taskDetails,
            })
          }}
          className="relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <Image
            src={gifReplay.displayUrl ?? resolvedUrl}
            alt={toolCopy(item.label)}
            fill
            unoptimized
            sizes="(min-width: 1280px) 42vw, (min-width: 768px) 54vw, 92vw"
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false)
              setImageFailed(true)
            }}
            className={cn(
              'object-contain transition duration-200',
              imageLoading || imageFailed ? 'invisible opacity-0' : 'visible opacity-100',
            )}
          />
          {imageLoading ? <ToolMediaLoadingOverlay label={tAuto('loading_image_3c498688')} /> : null}
          {imageFailed ? <ToolMediaLoadIssue kind="image" /> : null}
        </button>
      )}
      <ToolOutputTopActions
        media={actionMedia}
        outputKind={item.kind}
        prompt={prompt}
        taskDetails={taskDetails}
        openUrl={resolvedUrl}
        downloadUrl={downloadUrl}
        canDownload={Boolean(downloadUrl)}
        showOpen={!posterOnlyVideo}
      />
    </div>
  )
}

function ToolVideoMidpointPoster({
  src,
  onReady,
  onFailed,
  className,
}: {
  src: string
  onReady?: () => void
  onFailed?: () => void
  className?: string
}) {
  const targetSecondsRef = React.useRef(0)
  const [readySrc, setReadySrc] = React.useState<string | null>(null)
  const markReady = () => {
    setReadySrc(src)
    onReady?.()
  }

  return (
    <video
      src={src}
      aria-hidden="true"
      tabIndex={-1}
      muted
      playsInline
      preload="metadata"
      data-tool-video-poster-position="middle"
      onLoadedMetadata={(event) => {
        const targetSeconds = getVideoPosterSeekSeconds(event.currentTarget.duration)
        targetSecondsRef.current = targetSeconds
        if (targetSeconds > 0) {
          event.currentTarget.currentTime = targetSeconds
          return
        }
        markReady()
      }}
      onLoadedData={() => {
        if (targetSecondsRef.current === 0) markReady()
      }}
      onSeeked={markReady}
      onError={onFailed}
      className={cn(
        'pointer-events-none object-contain transition-opacity duration-150',
        readySrc === src ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  )
}

function getVideoPosterSeekSeconds(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  return Math.round(durationSeconds * 500) / 1_000
}

function ToolMediaLoadingOverlay({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      data-tool-media-loading-overlay="true"
      className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black"
    >
      <Skeleton className="absolute inset-0 rounded-none bg-accent/25" />
      <ToolMediaLoadingIndicator label={label} className="relative z-10" />
    </div>
  )
}

function ToolMediaLoadIssue({
  kind,
  onRetry,
}: {
  kind: 'audio' | 'image' | 'video'
  onRetry?: () => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted px-4 text-center">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/78 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm dark:border-white/[0.08]">
        <span>
          {kind === 'video'
            ? tAuto('video_preview_is_still_unavailable_17abd431')
            : kind === 'audio'
              ? tAuto('audio_preview_is_still_unavailable_379f916e')
              : tAuto('image_preview_is_still_unavailable_e4318960')}
        </span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            aria-label={tAuto('retry_kind_preview', { kind: tAuto('media_kind', { kind }) })}
            title={tAuto('retry_kind_preview', { kind: tAuto('media_kind', { kind }) })}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

type TranscriptMediaDelivery = {
  objectId: string
  url: string
  variant: 'original' | 'stream'
}

type TranscriptPlayerCommand = (method: 'play' | 'setCurrentTime', value?: number) => void

const TRANSCRIPT_PLAYER_REFERRER_POLICY = 'origin' as const

function ToolTranscriptOutputCanvas({
  transcript,
  sourceMedia,
  modelLabel,
  detail,
  status,
  identifier,
  offsetForStatusBadge = false,
  expanded = true,
  onExpandedChange,
}: {
  transcript: ToolTranscriptOutput
  sourceMedia: ToolRunSourceMedia | null
  modelLabel: string | null
  detail?: string
  status?: string
  identifier?: string | null
  offsetForStatusBadge?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const mediaRef = React.useRef<HTMLMediaElement | null>(null)
  const streamFrameRef = React.useRef<HTMLIFrameElement | null>(null)
  const streamCommandRef = React.useRef<TranscriptPlayerCommand | null>(null)
  const timelineRef = React.useRef<HTMLDivElement | null>(null)
  const segmentRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const playerInstanceId = React.useId()
  const playablePreviewUrl = getPlayableStorageMediaPreviewUrl(sourceMedia?.previewUrl)
  const audioOnly = sourceMedia?.mimeType?.toLowerCase().startsWith('audio/') === true
  const [delivery, setDelivery] = React.useState<TranscriptMediaDelivery | null>(null)
  const [deliveryRetry, setDeliveryRetry] = React.useState(0)
  const [mediaLoadState, setMediaLoadState] = React.useState<'loading' | 'ready' | 'failed'>(
    playablePreviewUrl || sourceMedia?.channelId ? 'loading' : 'failed',
  )
  const [activeSegmentIndex, setActiveSegmentIndex] = React.useState(() => (
    getActiveTranscriptSegmentIndex(transcript.segments, 0)
  ))
  const [playbackSeconds, setPlaybackSeconds] = React.useState(0)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const activeDelivery = delivery && delivery.objectId === sourceMedia?.storageObjectId
    ? delivery
    : playablePreviewUrl
      ? { objectId: sourceMedia?.storageObjectId ?? '', url: playablePreviewUrl, variant: 'original' as const }
      : null
  const streamMediaUrl = activeDelivery?.variant === 'stream'
    ? addPlayerInstanceToUrl(activeDelivery.url, playerInstanceId)
    : null
  const nativeMediaUrl = activeDelivery?.variant === 'original'
    ? sourceMedia?.channelId && sourceMedia.storageObjectId
      ? getStoragePlaybackUrl({
          channelId: sourceMedia.channelId,
          objectId: sourceMedia.storageObjectId,
        })
      : activeDelivery.url
    : null
  const mediaAvailable = Boolean(streamMediaUrl || nativeMediaUrl)
  const mediaReady = mediaAvailable && mediaLoadState === 'ready'
  const duration = transcript.durationSeconds ?? sourceMedia?.durationSeconds ?? null
  const normalizedStatus = status?.trim().toLowerCase()
  const visibleStatus = status
    && !canReadAgentOutput(status)
    && normalizedStatus !== 'ready'
    ? status
    : null
  const visibleStatusLabel = visibleStatus
    ? getRunProgressStatusLabel(visibleStatus)
    : undefined
  const showStatusBadge = Boolean(visibleStatusLabel)
  const summary = [
    sourceMedia?.name?.trim() || null,
    formatTranscriptLanguage(transcript.language),
    duration != null ? formatTranscriptDuration(duration) : null,
    transcript.segmentsTruncated
      ? `${transcript.segments.length} of ${transcript.totalSegmentCount} segments`
      : `${transcript.totalSegmentCount} segment${transcript.totalSegmentCount === 1 ? '' : 's'}`,
    modelLabel ? formatPublicModelLabel(modelLabel, 'Transcript') : null,
  ].filter(Boolean).join(' / ')

  const updateActiveSegment = React.useCallback((seconds: number) => {
    const safeSeconds = Math.max(0, seconds)
    setPlaybackSeconds((currentSeconds) => (
      Math.abs(currentSeconds - safeSeconds) < 0.05 ? currentSeconds : safeSeconds
    ))
    const nextIndex = getActiveTranscriptSegmentIndex(transcript.segments, safeSeconds)
    setActiveSegmentIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex)
  }, [transcript.segments])

  const seekToSegment = React.useCallback((seconds: number) => {
    if (!Number.isFinite(seconds)) return
    const targetSeconds = Math.max(0, seconds)
    if (streamMediaUrl && streamCommandRef.current) {
      streamCommandRef.current('setCurrentTime', targetSeconds)
      streamCommandRef.current('play')
      updateActiveSegment(targetSeconds)
      return
    }

    const media = mediaRef.current
    if (!media) return
    media.currentTime = targetSeconds
    updateActiveSegment(media.currentTime)
    void media.play().catch(() => undefined)
  }, [streamMediaUrl, updateActiveSegment])

  const syncActiveSegment = React.useCallback((event: React.SyntheticEvent<HTMLMediaElement>) => {
    updateActiveSegment(event.currentTarget.currentTime)
  }, [updateActiveSegment])

  React.useEffect(() => {
    if (activeSegmentIndex < 0) return
    const timeline = timelineRef.current
    const segment = segmentRefs.current[activeSegmentIndex]
    if (!timeline || !segment) return

    const timelineRect = timeline.getBoundingClientRect()
    const segmentRect = segment.getBoundingClientRect()
    const segmentCenter = timeline.scrollTop
      + (segmentRect.top - timelineRect.top)
      + (segmentRect.height / 2)
    const targetTop = Math.min(
      Math.max(0, segmentCenter - (timeline.clientHeight / 2)),
      Math.max(0, timeline.scrollHeight - timeline.clientHeight),
    )
    if (Math.abs(timeline.scrollTop - targetTop) < 8) return
    timeline.scrollTo({ top: targetTop, behavior: 'smooth' })
  }, [activeSegmentIndex])

  React.useEffect(() => {
    if (!expanded) return
    if (!sourceMedia?.channelId || !sourceMedia.storageObjectId) return
    let cancelled = false
    let refreshTimer: number | null = null

    const refreshDeliveryUrl = async () => {
      try {
        const result = await resolveTranscriptMediaDelivery({
          channelId: sourceMedia.channelId!,
          objectId: sourceMedia.storageObjectId,
          expiresInSeconds: 3_600,
          audioOnly,
        })
        if (cancelled) return
        setMediaLoadState('loading')
        setDelivery({ objectId: sourceMedia.storageObjectId, ...result })
        const refreshDelay = storageDeliveryRefreshDelay(result)
        if (refreshDelay !== false) {
          refreshTimer = window.setTimeout(refreshDeliveryUrl, refreshDelay)
        }
      } catch {
        if (!cancelled && !playablePreviewUrl) setMediaLoadState('failed')
      }
    }

    void refreshDeliveryUrl()
    return () => {
      cancelled = true
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
    }
  }, [audioOnly, deliveryRetry, expanded, playablePreviewUrl, sourceMedia?.channelId, sourceMedia?.storageObjectId])

  React.useEffect(() => {
    if (!expanded || !streamMediaUrl) {
      streamCommandRef.current = null
      return
    }
    const frame = streamFrameRef.current
    if (!frame?.contentWindow) return

    const origin = getUrlOrigin(streamMediaUrl)
    if (!origin) return

    const readyListener = `${playerInstanceId}:ready`
    const timeListener = `${playerInstanceId}:timeupdate`
    const seekListener = `${playerInstanceId}:seeked`
    const errorListener = `${playerInstanceId}:error`
    const playListener = `${playerInstanceId}:play`
    const pauseListener = `${playerInstanceId}:pause`
    const endedListener = `${playerInstanceId}:ended`
    const currentTimeListener = `${playerInstanceId}:current-time`
    let playerReady = false
    let registrationTimer: number | null = null
    let clockSyncTimer: number | null = null
    let readyTimer: number | null = window.setTimeout(() => setMediaLoadState('failed'), 15_000)

    const postPlayerMessage = (method: string, value?: unknown, listener?: string) => {
      frame.contentWindow?.postMessage(JSON.stringify({
        context: 'player.js',
        version: '0.0.11',
        method,
        ...(value !== undefined ? { value } : {}),
        ...(listener ? { listener } : {}),
      }), origin)
    }
    const send: TranscriptPlayerCommand = (method, value) => {
      postPlayerMessage(method, value)
    }
    const registerEvent = (event: string, listener: string) => {
      postPlayerMessage('addEventListener', event, listener)
    }
    const registerPlaybackEvents = () => {
      registerEvent('timeupdate', timeListener)
      registerEvent('seeked', seekListener)
      registerEvent('error', errorListener)
      registerEvent('play', playListener)
      registerEvent('pause', pauseListener)
      registerEvent('ended', endedListener)
    }
    const registerPlayerEvents = () => {
      registerEvent('ready', readyListener)
      registerPlaybackEvents()
    }
    const requestCurrentTime = () => {
      postPlayerMessage('getCurrentTime', undefined, currentTimeListener)
    }
    const startClockSync = () => {
      requestCurrentTime()
      if (clockSyncTimer === null) {
        clockSyncTimer = window.setInterval(requestCurrentTime, 500)
      }
    }
    const stopClockSync = () => {
      if (clockSyncTimer !== null) window.clearInterval(clockSyncTimer)
      clockSyncTimer = null
    }
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin) return
      const message = parsePlayerJsMessage(event.data)
      if (!message) return

      if (message.event === 'ready') {
        playerReady = true
        if (readyTimer !== null) window.clearTimeout(readyTimer)
        readyTimer = null
        if (registrationTimer !== null) window.clearInterval(registrationTimer)
        registrationTimer = null
        setMediaLoadState('ready')
        registerPlaybackEvents()
        requestCurrentTime()
        return
      }
      if (message.event === 'error') {
        stopClockSync()
        setMediaLoadState('failed')
        setIsPlaying(false)
        return
      }
      if (message.event === 'play') {
        startClockSync()
        setIsPlaying(true)
        return
      }
      if (message.event === 'pause' || message.event === 'ended') {
        stopClockSync()
        setIsPlaying(false)
        return
      }
      if (message.event === 'timeupdate' || message.event === 'seeked') {
        const seconds = getPlayerJsEventSeconds(message.value)
        if (seconds !== null) updateActiveSegment(seconds)
        return
      }
      if (
        message.event === 'getCurrentTime'
        && (!message.listener || message.listener === currentTimeListener)
      ) {
        const seconds = getPlayerJsEventSeconds(message.value)
        if (seconds !== null) updateActiveSegment(seconds)
      }
    }
    const handleFrameLoad = () => {
      registerPlayerEvents()
    }

    streamCommandRef.current = send
    window.addEventListener('message', handleMessage)
    frame.addEventListener('load', handleFrameLoad)
    registerPlayerEvents()
    registrationTimer = window.setInterval(() => {
      if (!playerReady) registerPlayerEvents()
    }, 1_000)
    return () => {
      if (readyTimer !== null) window.clearTimeout(readyTimer)
      if (registrationTimer !== null) window.clearInterval(registrationTimer)
      stopClockSync()
      window.removeEventListener('message', handleMessage)
      frame.removeEventListener('load', handleFrameLoad)
      if (streamCommandRef.current === send) streamCommandRef.current = null
    }
  }, [expanded, playerInstanceId, streamMediaUrl, updateActiveSegment])

  const retryMedia = React.useCallback(() => {
    setMediaLoadState('loading')
    setDelivery(null)
    setDeliveryRetry((current) => current + 1)
  }, [])

  const toggleExpanded = React.useCallback(() => {
    const nextExpanded = !expanded
    if (nextExpanded) {
      setMediaLoadState(playablePreviewUrl || sourceMedia?.channelId ? 'loading' : 'failed')
      setIsPlaying(false)
      setPlaybackSeconds(0)
      setActiveSegmentIndex(getActiveTranscriptSegmentIndex(transcript.segments, 0))
    }
    onExpandedChange?.(nextExpanded)
  }, [expanded, onExpandedChange, playablePreviewUrl, sourceMedia?.channelId, transcript.segments])

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden bg-transparent',
        expanded ? 'h-[clamp(18rem,44vh,32rem)]' : 'h-auto',
      )}
      title={identifier ? `Output ${identifier}` : undefined}
    >
      <div className={cn(
        'grid min-h-14 shrink-0 items-center gap-x-1.5 px-3 transition-colors hover:bg-muted/30',
        showStatusBadge
          ? 'grid-cols-[minmax(0,1fr)_2rem_2rem_auto] sm:grid-cols-[minmax(0,1fr)_2rem_auto_2rem_auto]'
          : 'grid-cols-[minmax(0,1fr)_2rem_2rem] sm:grid-cols-[minmax(0,1fr)_2rem_auto_2rem]',
        expanded && 'bg-muted/45 dark:bg-white/[0.055]',
        expanded && 'border-b border-border dark:border-white/[0.08]',
        offsetForStatusBadge && 'pl-14 sm:pl-28',
      )}>
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-label={sourceMedia?.name
            ? tAuto(expanded ? 'collapse_transcript_for' : 'open_transcript_for', { name: sourceMedia.name })
            : tAuto(expanded ? 'collapse_transcript' : 'open_transcript')}
          className="group/transcript-header col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem] items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-foreground"><UiText id="transcript_5bcd6022" /></span>
            <span className="block truncate text-[11px] text-muted-foreground">{summary}</span>
          </span>
          <span className="flex size-8 shrink-0 items-center justify-center">
            <ChevronDown className={cn(
              'size-4 text-muted-foreground transition-transform duration-200 group-hover/transcript-header:text-foreground',
              expanded && 'rotate-180',
            )} />
          </span>
        </button>
        <span className="hidden truncate text-right text-[11px] text-muted-foreground sm:block">
          {detail}
        </span>
        {identifier ? (
          <button
            type="button"
            aria-label={tAuto('copy_job_id_cb0df918')}
            title={tAuto('copy_job_id_value', { id: identifier })}
            onClick={() => copyTextToClipboard(identifier)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy className="size-3.5" />
          </button>
        ) : <span aria-hidden="true" className="size-8 shrink-0" />}
        {showStatusBadge ? (
          <span className="flex min-w-0 items-center justify-end">
            <ToolOutputStateBadge
              state={visibleStatus && isFailedRunStatus(visibleStatus) ? 'failed' : 'processing'}
              label={visibleStatusLabel}
            />
          </span>
        ) : null}
      </div>

      {expanded ? <div className={cn(
        'grid min-h-0 min-w-0 flex-1 animate-in fade-in-0 slide-in-from-top-1 duration-200',
        sourceMedia
          ? 'grid-rows-[11rem_minmax(0,1fr)] lg:grid-cols-[minmax(16rem,44%)_minmax(0,1fr)] lg:grid-rows-1'
          : 'grid-cols-1',
      )}>
        {sourceMedia ? (
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-border bg-muted/20 lg:border-b-0 lg:border-r dark:border-white/[0.08]">
            <div className={cn(
              'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden',
              audioOnly ? 'bg-muted/30 px-5' : 'bg-black',
            )}>
              {streamMediaUrl ? (
                // Player.js derives its allowed parent origin from document.referrer.
                <iframe
                  ref={streamFrameRef}
                  src={streamMediaUrl}
                  title={sourceMedia.name}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy={TRANSCRIPT_PLAYER_REFERRER_POLICY}
                  className={cn(
                    'h-full min-h-0 w-full border-0 bg-black transition-opacity',
                    mediaLoadState !== 'ready' && 'opacity-0',
                  )}
                />
              ) : nativeMediaUrl ? (
                audioOnly ? (
                  <audio
                    ref={(element) => { mediaRef.current = element }}
                    src={nativeMediaUrl}
                    controls
                    preload="metadata"
                    onCanPlay={() => setMediaLoadState('ready')}
                    onError={() => setMediaLoadState('failed')}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onLoadedMetadata={syncActiveSegment}
                    onSeeked={syncActiveSegment}
                    onTimeUpdate={syncActiveSegment}
                    className="w-full"
                  />
                ) : (
                  <video
                    ref={(element) => { mediaRef.current = element }}
                    src={nativeMediaUrl}
                    poster={sourceMedia.previewUrl ?? undefined}
                    controls
                    preload="metadata"
                    playsInline
                    onCanPlay={() => setMediaLoadState('ready')}
                    onError={() => setMediaLoadState('failed')}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onLoadedMetadata={syncActiveSegment}
                    onSeeked={syncActiveSegment}
                    onTimeUpdate={syncActiveSegment}
                    className="h-full min-h-0 w-full bg-black object-contain"
                  />
                )
              ) : mediaLoadState !== 'loading' ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground">
                  <Film className="size-7" />
                  <span className="max-w-full truncate text-xs font-medium">{sourceMedia.name}</span>
                </div>
              ) : null}
              {mediaLoadState === 'loading' ? (
                <ToolMediaLoadingOverlay label={tAuto('loading_kind', { kind: tAuto('media_kind', { kind: audioOnly ? 'audio' : 'video' }) })} />
              ) : null}
              {mediaLoadState === 'failed' ? (
                <ToolMediaLoadIssue kind={audioOnly ? 'audio' : 'video'} onRetry={retryMedia} />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex min-h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3 dark:border-white/[0.08]">
            <span className="text-xs font-semibold text-foreground"><UiText id="timeline_018514a3" /></span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">
                {mediaReady ? `${formatTranscriptTimestamp(playbackSeconds)} / ` : ''}{formatTranscriptDuration(duration ?? 0)}
              </span>
              <button
                type="button"
                aria-label={tAuto('copy_transcript_58df7ed9')}
                title={tAuto('copy_transcript_58df7ed9')}
                onClick={() => copyTextToClipboard(transcript.text)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Copy className="size-3.5" />
              </button>
            </span>
          </div>
          <div ref={timelineRef} className="tools-scrollbar min-h-0 flex-1 overflow-auto scroll-smooth">
            {transcript.segments.length > 0 ? transcript.segments.map((segment, index) => {
              const active = activeSegmentIndex === index
              const segmentProgress = active
                ? getTranscriptSegmentPlaybackProgress(segment, playbackSeconds)
                : 0
              return (
              <button
                type="button"
                key={segment.id}
                ref={(element) => { segmentRefs.current[index] = element }}
                data-transcript-segment-index={index}
                aria-current={active ? 'true' : undefined}
                aria-label={tAuto('play_transcript_at', { time: formatTranscriptTimestamp(segment.start), text: segment.text })}
                disabled={!mediaReady}
                onClick={() => seekToSegment(segment.start)}
                className={cn(
                  'relative isolate grid w-full min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] gap-2 overflow-hidden border-b border-border/70 px-3 py-2 text-left transition-colors duration-300 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default sm:grid-cols-[5.5rem_minmax(0,1fr)] dark:border-white/[0.06]',
                  active && 'bg-muted/65 dark:bg-white/[0.035]',
                  mediaReady && !active && 'hover:bg-accent/55',
                )}
              >
                {active ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-foreground/[0.035] transition-[width] duration-300 ease-linear"
                      style={{ width: `${segmentProgress * 100}%` }}
                    />
                    <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-foreground/60" />
                  </>
                ) : null}
                <span className={cn(
                  'relative z-10 flex h-7 items-center justify-center gap-1 rounded-md border bg-muted px-1.5 font-mono text-[10px] font-semibold transition-colors',
                  active ? 'border-foreground/20 bg-background text-foreground' : 'border-border text-muted-foreground dark:border-white/[0.08]',
                )}>
                  {mediaReady ? (active && isPlaying
                    ? <AudioLines className="size-3 animate-pulse" />
                    : <Play className="size-2.5 fill-current" />) : null}
                  {formatTranscriptTimestamp(segment.start)}
                </span>
                <span className="relative z-10 min-w-0">
                  <p className={cn(
                    'break-words text-xs leading-5 transition-colors duration-300',
                    active ? 'font-medium text-foreground' : 'text-foreground/90',
                  )}>{segment.text}</p>
                  <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">
                    {formatTranscriptTimestamp(segment.start)} - {formatTranscriptTimestamp(segment.end)}
                  </span>
                </span>
              </button>
              )
            }) : (
              <p className="whitespace-pre-wrap px-5 py-5 text-sm leading-7 text-foreground">
                {transcript.text || tAuto('transcript_is_empty_e44543a6')}
              </p>
            )}
          </div>
        </div>
      </div> : null}
    </div>
  )
}

function ToolTranscriptOutputPlaceholder({
  sourceMedia,
  modelLabel,
  detail,
  status,
  errorMessage,
  identifier,
}: {
  sourceMedia: ToolRunSourceMedia | null
  modelLabel: string | null
  detail?: string
  status?: string | null
  errorMessage?: string | null
  identifier?: string | null
}) {
  const tAuto = useTranslations('Auto')
  const failed = Boolean(errorMessage) || isFailedRunStatus(status)
  const executionComplete = canReadAgentOutput(status)
  // This component is rendered only while there is no presentable transcript
  // payload. Keep a processing status visible even when the runtime execution
  // is already terminal; "completed" belongs to the output the user can
  // actually open, not to an empty placeholder waiting for projection.
  const statusLabel = failed
    ? 'Failed'
    : getRunProgressStatusLabel(status, { outputPending: executionComplete })
  const statusSummary = failed ? formatTranscriptFailureSummary(errorMessage) : null
  const summary = [
    sourceMedia?.name?.trim() || null,
    statusSummary,
    modelLabel ? formatPublicModelLabel(modelLabel, 'Transcript') : null,
  ].filter(Boolean).join(' / ')

  return (
    <div
      data-transcript-output-tile="true"
      data-transcript-output-state={failed ? 'failed' : 'processing'}
      className={cn(
        'relative grid min-h-14 min-w-0 items-center gap-x-1.5 overflow-hidden px-3 py-2',
        'grid-cols-[minmax(0,1fr)_2rem_2rem_auto] sm:grid-cols-[minmax(0,1fr)_2rem_auto_2rem_auto]',
      )}
      title={identifier ? `Output ${identifier}` : undefined}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          <UiText id="transcript_5bcd6022" /></span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {summary}
        </span>
      </span>
      <span aria-hidden="true" className="size-8 shrink-0" />
      <span className="hidden truncate text-right text-[11px] text-muted-foreground sm:block">
        {detail}
      </span>
      {identifier ? (
        <button
          type="button"
          aria-label={tAuto('copy_job_id_cb0df918')}
          title={tAuto('copy_job_id_value', { id: identifier })}
          onClick={() => copyTextToClipboard(identifier)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy className="size-3.5" />
        </button>
      ) : <span aria-hidden="true" className="size-8 shrink-0" />}
      <span className="flex min-w-0 items-center justify-end text-[11px] text-muted-foreground">
        <ToolOutputStateBadge
          state={failed ? 'failed' : 'processing'}
          label={statusLabel}
        />
      </span>
      {!failed ? <TranscriptRunningRail /> : null}
    </div>
  )
}

function ToolOutputStateBadge({
  state,
  label,
  compact = true,
  className,
}: {
  state: ToolOutputStatusTone
  label?: string
  ariaLabel?: string
  compact?: boolean
  className?: string
}) {
  const tAuto = useTranslations('Auto')
  const toolCopy = useToolCopy()
  const visibleLabel = toolCopy(getPublicToolStatusLabel(state, label))
  const accessibleLabel = tAuto('status_with_label', { status: visibleLabel })
  if (state === 'ready') return null

  if (state === 'processing') {
    return (
      <ToolRunningIndicator
        label={visibleLabel}
        ariaLabel={accessibleLabel}
        compact={compact}
        className={className}
      />
    )
  }

  return (
    <span
      role="status"
      aria-label={accessibleLabel}
      data-tool-output-status="failed"
      data-transcript-status="failed"
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-semibold',
        compact ? 'h-6 px-2.5 text-[11px]' : 'h-7 px-2.5 text-xs',
        'bg-[#4a1f24] text-[#ff9f9f]',
        className,
      )}
    >
      {visibleLabel}
    </span>
  )
}

function TranscriptRunningRail() {
  return (
    <span
      aria-hidden="true"
      data-transcript-running-indicator="true"
      className="pointer-events-none absolute inset-x-4 bottom-0 h-[3px] overflow-hidden rounded-full bg-[#2f6c98]/45"
    >
      <span className="absolute inset-y-0 left-0 w-1/3 min-w-20 animate-[research-progress-scan_2.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-[#72c4ff] to-transparent motion-reduce:left-1/2 motion-reduce:-translate-x-1/2 motion-reduce:animate-none" />
    </span>
  )
}

function formatTranscriptFailureSummary(errorMessage: string | null | undefined) {
  const rawErrorCode = errorMessage?.match(/\bE\d{4}\b/i)?.[0]?.toUpperCase()
  const errorCode = rawErrorCode ? toPublicRuntimeError(rawErrorCode)?.code : null
  return errorCode ? `Error code ${errorCode}` : 'Transcript could not be created.'
}

function ToolTextOutputCanvas({
  output,
  title,
  detail,
  status,
}: {
  output: ToolTextOutput
  title: string
  detail?: string
  status?: string
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div className="flex h-[clamp(19rem,48vh,38rem)] min-h-0 flex-col bg-background">
      <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border bg-muted/35 px-3 pl-12 dark:border-white/[0.08]">
        <FileText className="size-4 text-primary" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{title}</span>
        {status ? <ToolRunStatusBadge status={status} compact /> : null}
        {detail ? <span className="text-[11px] text-muted-foreground">{detail}</span> : null}
        <button
          type="button"
          aria-label={tAuto('copy_output_944a2cd1')}
          title={tAuto('copy_output_944a2cd1')}
          onClick={() => copyTextToClipboard(output.content)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <div className="tools-scrollbar min-h-0 flex-1 overflow-auto px-5 py-5 pb-20 sm:px-7">
        {output.kind === 'markdown' ? (
          <GuideMarkdownPreview content={output.content} className="mx-auto max-w-3xl" />
        ) : (
          <pre className="mx-auto max-w-4xl whitespace-pre-wrap break-words rounded-md border border-border bg-muted/45 p-4 font-mono text-xs leading-5 text-foreground dark:border-white/[0.08]">
            {output.content}
          </pre>
        )}
      </div>
    </div>
  )
}

function ToolWorkflowOutputList({
  tool,
  channelId,
  recentWorkflowOutputs,
  compact,
  hiddenAgentIds,
  sourcePreview = null,
  expandedTranscriptKey,
  onTranscriptExpandedChange,
  mergeIntoParentGrid = false,
  pagerOnly = false,
}: {
  tool: ToolConfig
  channelId: string | null
  recentWorkflowOutputs: ToolRecentWorkflowOutputState
  compact: boolean
  hiddenAgentIds: Set<string>
  sourcePreview?: ToolRunSourceMedia | null
  expandedTranscriptKey?: string | null
  onTranscriptExpandedChange?: (key: string, expanded: boolean) => void
  mergeIntoParentGrid?: boolean
  pagerOnly?: boolean
}) {
  const tAuto = useTranslations('Auto')
  const visibleItems = React.useMemo(
    () => recentWorkflowOutputs.items.filter((item) => !isRecentWorkflowOutputHidden(item, hiddenAgentIds)),
    [hiddenAgentIds, recentWorkflowOutputs.items],
  )
  const transcriptList = visibleItems.length > 0
    && visibleItems.every((item) => isTranscriptNodeType(item.nodeType))
  const gifGrid = isVideoToGifToolConfig(tool)
  const mediaTransformGrid = isMediaTransformToolConfig(tool) && visibleItems.length > 1
  const autoLoadMore = gifGrid || transcriptList || (pagerOnly && isTranscriptToolConfig(tool))
  const autoLoadMoreRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (
      !autoLoadMore
      || !recentWorkflowOutputs.hasMore
      || recentWorkflowOutputs.loadingMore
      || recentWorkflowOutputs.loading
      || recentWorkflowOutputs.initialSnapshotPending
    ) return
    if (typeof IntersectionObserver === 'undefined') return
    const marker = autoLoadMoreRef.current
    if (!marker) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) recentWorkflowOutputs.onLoadMore()
    }, { rootMargin: '80px 0px' })
    observer.observe(marker)
    return () => observer.disconnect()
  }, [
    autoLoadMore,
    recentWorkflowOutputs.hasMore,
    recentWorkflowOutputs.initialSnapshotPending,
    recentWorkflowOutputs.loading,
    recentWorkflowOutputs.loadingMore,
    recentWorkflowOutputs.onLoadMore,
  ])

  if (recentWorkflowOutputs.loading && visibleItems.length === 0) {
    return <ToolStorageOutputSkeleton compact={compact} />
  }

  if (pagerOnly && !recentWorkflowOutputs.hasMore && !recentWorkflowOutputs.loadingMore) return null
  if (!pagerOnly && recentWorkflowOutputs.errorMessage && visibleItems.length === 0) return null
  if (!pagerOnly && visibleItems.length === 0) return null

  return (
    <div className={mergeIntoParentGrid ? 'contents' : transcriptList ? 'space-y-0' : 'space-y-3'}>
      {pagerOnly ? null : (
      <div className={cn(
        mergeIntoParentGrid
          ? 'contents'
          : transcriptList
            ? 'space-y-0'
            : 'space-y-3',
        gifGrid && !mergeIntoParentGrid && 'grid gap-3 space-y-0 sm:grid-cols-2',
        mediaTransformGrid && 'grid gap-3 space-y-0 lg:grid-cols-2',
      )}>
        {visibleItems.map((item, index) => {
          const transcriptKey = getRecentWorkflowTranscriptKey(item)
          return (
          <ToolWorkflowOutputCard
            key={getToolWorkflowOutputCardKey(item)}
            item={item}
            tool={tool}
            channelId={channelId}
            compact={compact || gifGrid || mediaTransformGrid}
            sourcePreview={index === 0 ? sourcePreview : null}
            transcriptExpanded={expandedTranscriptKey === transcriptKey}
            onTranscriptExpandedChange={(expanded) => onTranscriptExpandedChange?.(transcriptKey, expanded)}
          />
          )
        })}
      </div>
      )}
      {recentWorkflowOutputs.loadingMore ? (
        <div className={cn('flex justify-center', mergeIntoParentGrid && 'col-span-full')}>
          <ToolMediaLoadingIndicator
            label={tAuto('loading_more_outputs_f620814f')}
            size="sm"
            className="text-foreground/60 dark:text-white/70"
          />
        </div>
      ) : null}
      {recentWorkflowOutputs.hasMore ? (
        <div
          ref={autoLoadMore ? autoLoadMoreRef : undefined}
          data-tool-output-auto-load={autoLoadMore ? 'true' : undefined}
          className={cn(
            'flex justify-center',
            autoLoadMore && 'h-px',
            mergeIntoParentGrid && 'col-span-full',
          )}
        >
          {!autoLoadMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={recentWorkflowOutputs.onLoadMore}
              disabled={recentWorkflowOutputs.loadingMore}
            >
              {recentWorkflowOutputs.loadingMore ? <LoaderCircle className="size-4 animate-spin" /> : null}
              <UiText id="load_more_dfe60ca9" /></Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ToolWorkflowOutputCard({
  item,
  tool,
  angleTool = false,
  channelId,
  compact,
  sourcePreview = null,
  transcriptExpanded = true,
  onTranscriptExpandedChange,
}: {
  item: RecentWorkflowOutputItem
  tool: ToolConfig
  angleTool?: boolean
  channelId: string | null
  compact: boolean
  sourcePreview?: ToolRunSourceMedia | null
  transcriptExpanded?: boolean
  onTranscriptExpandedChange?: (expanded: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const workflowView = getToolWorkflowOutputView(item, getToolWorkflowFallbackKind(tool))
  const view = isVideoToGifToolConfig(tool)
    ? { ...workflowView, fileName: getGifDownloadFileName(workflowView.fileName) }
    : workflowView
  const taskDetails: StorageInspectorTaskDetails = {
    tool: tool.title,
    node: item.nodeType,
    action: isMediaTransformToolConfig(tool)
      ? getMediaTransformOutputActionLabel(item.outputPreview)
      : null,
    model: view.modelLabel,
    provider: view.provider,
    taskId: getToolWorkflowOutputIdentifier(item),
    creditsUsed: item.totalCreditsCharged,
    createdAt: item.createdAt,
    completedAt: item.completedAt ?? item.updatedAt,
  }
  const transcriptOutput = getRecentWorkflowTranscriptOutput(item)
  const transcriptSourceMedia = getTranscriptSourceMedia(transcriptOutput, channelId)
  const textOutput = getRecentWorkflowTextOutput(item)
  const frameOutputs = isFrameExtractToolConfig(tool)
    ? collectRecentFrameOutputMedia(item)
    : []
  const angleOutputs = angleTool
    ? collectRecentAngleOutputMedia(item)
    : []
  const magicClipOutputs = isMagicClipsToolConfig(tool)
    ? collectRecentMagicClipOutputMedia(item)
    : []
  const magicClipRunSummary = isMagicClipsToolConfig(tool)
    ? getMagicClipRunSummary(item.outputPreview, magicClipOutputs.length)
    : null
  const magicClipsEmpty = isMagicClipsToolConfig(tool)
    && view.statusTone === 'ready'
    && isEmptyMagicClipPayload(item.outputPreview)
  const magicClipsFailed = isMagicClipsToolConfig(tool) && view.statusTone === 'failed'
  const media = view.mediaUrl && isUsableOutputUrl(view.mediaUrl)
    ? { kind: view.kind, url: view.mediaUrl, label: view.label }
    : null
  const previewSource = view.mediaUrl ?? view.previewUrl
  const storageBackedPreview = Boolean(view.storageObjectId?.trim())
  const expectsMediaLoad = frameOutputs.length === 0
    && magicClipOutputs.length === 0
    && view.statusTone === 'ready'
    && Boolean(previewSource || storageBackedPreview)
  const [mediaLoadState, setMediaLoadState] = React.useState<'idle' | 'loading' | 'loaded' | 'failed'>(
    expectsMediaLoad ? 'loading' : 'idle',
  )
  const markMediaLoaded = React.useCallback(() => setMediaLoadState('loaded'), [])
  const markMediaFailed = React.useCallback(() => setMediaLoadState('failed'), [])
  const markMediaLoading = React.useCallback(() => setMediaLoadState('loading'), [])


  const mediaLoading = mediaLoadState === 'loading'
  const mediaLoaded = mediaLoadState === 'loaded'
  const showChrome = !mediaLoading && (
    mediaLoaded
    || mediaLoadState === 'failed'
    || view.statusTone === 'failed'
    || (!expectsMediaLoad && view.statusTone === 'ready')
  )

  if (item.deliveryStatus === 'payment_review') return <PaymentReviewOutputNotice />;

  if (isTranscriptNodeType(item.nodeType)) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-panel/40">
        {transcriptOutput ? (
          <ToolTranscriptOutputCanvas
            transcript={transcriptOutput}
            sourceMedia={transcriptSourceMedia}
            modelLabel={item.modelLabel}
            detail={formatToolWorkflowCreditDetail(item, view.statusTone)}
            status={view.statusLabel}
            identifier={getToolWorkflowOutputIdentifier(item)}
            expanded={transcriptExpanded}
            onExpandedChange={onTranscriptExpandedChange}
          />
        ) : (
          <ToolTranscriptOutputPlaceholder
            sourceMedia={transcriptSourceMedia}
            modelLabel={item.modelLabel}
            detail={formatToolWorkflowCreditDetail(item, view.statusTone)}
            status={item.status}
            errorMessage={item.errorMessage}
            identifier={getToolWorkflowOutputIdentifier(item)}
          />
        )}
      </div>
    )
  }

  if (
    textOutput
    && frameOutputs.length === 0
    && magicClipOutputs.length === 0
    && !magicClipsEmpty
    && !media
    && !storageBackedPreview
    && view.statusTone !== 'failed'
  ) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-panel/40">
        <ToolTextOutputCanvas
          output={textOutput}
          title={textOutput.kind === 'markdown' ? tAuto('research_report_22a57348') : tAuto('json_output_669f62b8')}
          detail={formatToolWorkflowCreditDetail(item, view.statusTone)}
          status={view.statusLabel}
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel/40">
      <div className="group/output-card group relative">
        {view.statusTone === 'processing' || view.statusTone === 'failed' ? (
          <ToolStorageStatusBadge
            view={view}
            className="absolute left-3 top-3 z-20"
          />
        ) : null}
        {angleOutputs.length > 1 ? (
          <ToolFrameOutputGallery
            items={angleOutputs}
            channelId={channelId}
            taskDetails={taskDetails}
          />
        ) : frameOutputs.length > 0 ? (
          <ToolFrameOutputGallery items={frameOutputs} channelId={channelId} taskDetails={taskDetails} />
        ) : magicClipOutputs.length > 0 ? (
          <ToolClipOutputGallery
            items={magicClipOutputs}
            channelId={channelId}
            taskId={getToolWorkflowOutputIdentifier(item)}
            actualCredits={item.totalCreditsCharged}
            startedAt={item.createdAt}
            completedAt={item.completedAt ?? item.updatedAt}
            sourceMedia={sourcePreview}
            taskDetails={taskDetails}
            summary={magicClipRunSummary}
          />
        ) : magicClipsFailed ? (
          <ToolMagicClipsFailedResult
            message={localizeRuntimeError(formatToolRunErrorMessage(
              view.failureMessage ?? tAuto('viral_clips_failed_fallback'),
              [],
              [tAuto('viral_clips_quota_exhausted'), tAuto('viral_clips_quota_unavailable')],
            ))}
            taskId={getToolWorkflowOutputIdentifier(item)}
          />
        ) : magicClipsEmpty ? (
          <ToolMagicClipsEmptyResult
            taskId={getToolWorkflowOutputIdentifier(item)}
            reason={magicClipRunSummary?.partialReason}
          />
        ) : view.statusTone === 'processing' ? (
          <ToolGeneratingMediaPreview
            modelKind={tool.modelKind}
            label={view.statusLabel}
            sourceMedia={sourcePreview}
            heightClassName={getToolStorageMediaHeightClassName(compact)}
          />
        ) : (
          <ToolStorageMediaPreview
            view={view}
            channelId={channelId}
            compact={compact}
            replayGif={isVideoToGifToolConfig(tool)}
            posterOnlyVideo={isMediaTransformToolConfig(tool)}
            taskDetails={taskDetails}
            mediaLoadState={mediaLoadState}
            onMediaLoaded={markMediaLoaded}
            onMediaFailed={markMediaFailed}
            onMediaLoading={markMediaLoading}
          />
        )}
        {frameOutputs.length > 0 ? null : magicClipOutputs.length > 0 || magicClipsEmpty || magicClipsFailed ? null : showChrome ? (
          <>
            <ToolStorageActionRail
              view={view}
              media={media}
              channelId={channelId}
              taskDetails={taskDetails}
              showOpen={!isMediaTransformToolConfig(tool)}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

function ToolStorageOutputSkeleton({ compact }: { compact: boolean }) {
  const tAuto = useTranslations('Auto')
  const heightClassName = getToolStorageMediaHeightClassName(compact)

  return (
    <div
      aria-busy="true"
      aria-label={tAuto('loading_recent_output_1a2091fb')}
      className={cn('relative flex items-center justify-center overflow-hidden', heightClassName)}
    >
      <Skeleton className="absolute inset-0 rounded-none" />
      <ToolMediaLoadingIndicator
        label={tAuto('loading_recent_output_1a2091fb')}
        className="relative z-10 text-foreground/60 dark:text-white/70"
      />
    </div>
  )
}

function getToolStorageMediaHeightClassName(compact: boolean) {
  return compact ? 'h-[clamp(14rem,30vh,23rem)]' : 'h-[clamp(17rem,42vh,31rem)]'
}

function ToolStorageMediaPreview({
  view,
  channelId,
  compact,
  taskDetails,
  replayGif = false,
  posterOnlyVideo = false,
  mediaLoadState,
  onMediaLoaded,
  onMediaFailed,
  onMediaLoading,
}: {
  view: ToolRenderableOutputView
  channelId: string | null
  compact: boolean
  taskDetails?: StorageInspectorTaskDetails
  replayGif?: boolean
  posterOnlyVideo?: boolean
  mediaLoadState: 'idle' | 'loading' | 'loaded' | 'failed'
  onMediaLoaded: () => void
  onMediaFailed: () => void
  onMediaLoading: () => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const heightClassName = getToolStorageMediaHeightClassName(compact)
  const deliveryQuery = useToolStorageOutputDelivery(channelId, view)
  const storageDownloadUrl = getToolStorageOutputDownloadUrl(channelId, view)
  const storageBacked = Boolean(view.storageObjectId?.trim())
  const deliveryEnabled = Boolean(channelId && view.storageObjectId?.trim() && view.statusTone === 'ready')
  const mediaUrl = getToolStoragePreviewMediaUrl({
    kind: view.kind,
    storageBacked,
    channelId,
    storageObjectId: view.storageObjectId ?? null,
    deliveryUrl: deliveryQuery.data?.url ?? null,
    deliveryVariant: deliveryQuery.data?.variant,
    mediaUrl: view.mediaUrl,
    previewUrl: view.previewUrl,
  })
  const downloadUrl = storageDownloadUrl ?? (storageBacked ? null : view.downloadUrl) ?? mediaUrl
  const thumbnailQuery = useStorageObjectThumbnailUrl({
    channelId,
    storageObjectId: view.storageObjectId ?? null,
    enabled: Boolean(
      view.kind === 'video'
      && channelId
      && view.storageObjectId?.trim()
    ),
  })
  const [failedPosterUrl, setFailedPosterUrl] = React.useState<string | null>(null)
  const [failedPosterVideoUrl, setFailedPosterVideoUrl] = React.useState<string | null>(null)
  const rasterPreviewUrl = view.kind === 'video' && isRasterImageOutputUrl(view.previewUrl)
    ? view.previewUrl
    : null
  const videoPosterUrl = thumbnailQuery.data?.url
    && thumbnailQuery.data.url !== failedPosterUrl
    ? thumbnailQuery.data.url
    : null
  const usablePosterImageUrl = videoPosterUrl
    ?? (rasterPreviewUrl && rasterPreviewUrl !== failedPosterUrl ? rasterPreviewUrl : null)
  const videoPosterSourceUrl = !storageBacked
    && mediaUrl
    && !isEmbeddableVideoUrl(mediaUrl)
    ? mediaUrl
    : null
  const usableVideoPosterSourceUrl = videoPosterSourceUrl !== failedPosterVideoUrl
    ? videoPosterSourceUrl
    : null
  const posterOnlyStreamVideo = Boolean(
    posterOnlyVideo
    && view.kind === 'video'
    && mediaUrl
    && isEmbeddableVideoUrl(mediaUrl),
  )
  const posterOnlyStorageVideo = Boolean(posterOnlyVideo && view.kind === 'video' && storageBacked)
  const deliveryPending = deliveryEnabled && (deliveryQuery.isPending || deliveryQuery.isFetching)
  const thumbnailEnabled = Boolean(
    view.kind === 'video'
    && channelId
    && view.storageObjectId?.trim()
  )
  const thumbnailPending = thumbnailEnabled
    && !videoPosterUrl
    && !thumbnailQuery.isError
    && (thumbnailQuery.isPending || thumbnailQuery.isFetching)
  const deferPreviewFailure = deliveryPending || thumbnailPending
  const isMediaLoading = mediaLoadState === 'loading'
  const isMediaFailed = mediaLoadState === 'failed'
  const gifReplayable = replayGif && view.kind === 'image'
  const gifReplay = useGifReplayUrl(mediaUrl, gifReplayable)

  React.useEffect(() => {
    if (!deferPreviewFailure || mediaLoadState !== 'failed') return
    onMediaLoading()
  }, [deferPreviewFailure, mediaLoadState, onMediaLoading])

  React.useEffect(() => {
    if (!posterOnlyStorageVideo && !posterOnlyStreamVideo) return
    if (usablePosterImageUrl) return
    if (deferPreviewFailure) return
    if (mediaUrl && !isEmbeddableVideoUrl(mediaUrl) && !posterOnlyStreamVideo) return
    if (!channelId || thumbnailQuery.isError || failedPosterUrl) {
      onMediaLoaded()
    }
  }, [
    channelId,
    deferPreviewFailure,
    failedPosterUrl,
    mediaUrl,
    onMediaLoaded,
    posterOnlyStorageVideo,
    posterOnlyStreamVideo,
    thumbnailQuery.isError,
    usablePosterImageUrl,
  ])

  React.useEffect(() => {
    if (!storageBacked || mediaUrl || usablePosterImageUrl) return
    if (deferPreviewFailure) return
    if (deliveryEnabled && deliveryQuery.isError) onMediaFailed()
  }, [
    deferPreviewFailure,
    deliveryEnabled,
    deliveryQuery.isError,
    mediaUrl,
    onMediaFailed,
    storageBacked,
    usablePosterImageUrl,
  ])

  const handleMediaFailed = () => {
    if (deferPreviewFailure) return
    if (posterOnlyStorageVideo) return
    onMediaFailed()
  }

  if (view.statusTone === 'failed') {
    return (
      <div className={cn('relative overflow-hidden bg-destructive/5', heightClassName)}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(222_53_11_/_0.14),rgb(255_255_255_/_0.03),transparent)]" />
        <div className="relative flex h-full items-center justify-center px-4 pb-10">
          <div className="flex max-w-lg items-start gap-2.5 rounded-md border border-destructive/20 bg-background/72 px-3 py-2.5 text-destructive shadow-sm backdrop-blur-[2px]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <X className="size-4" />
            </span>
            <p className="min-w-0 text-xs leading-5 sm:text-sm">
              {view.failureMessage
                ? localizeRuntimeError(view.failureMessage)
                : tAuto('output_failed_before_a_usable_media_file_was_cre_1695c4a5')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden bg-muted', heightClassName)}>
      {view.kind === 'video' && (mediaUrl || usablePosterImageUrl) ? (
        <button
          type="button"
          disabled={!mediaUrl}
          onClick={() => {
            if (!mediaUrl) return
            openOutputUrl(mediaUrl, view.kind, toolCopy(view.label), {
              prompt: view.prompt ?? undefined,
              downloadUrl,
              taskDetails,
            })
          }}
          className="group relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-default"
        >
          {usablePosterImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={usablePosterImageUrl}
              alt=""
              loading={compact ? 'lazy' : 'eager'}
              decoding="async"
              onLoad={onMediaLoaded}
              onError={() => setFailedPosterUrl(usablePosterImageUrl)}
              className={cn(
                'pointer-events-none h-full w-full object-contain transition duration-200',
                isMediaLoading ? 'opacity-0' : 'opacity-100',
              )}
            />
          ) : thumbnailPending ? (
            <span className="flex h-full w-full items-center justify-center bg-black">
              <ToolMediaLoadingIndicator label={tAuto('loading_recent_output_1a2091fb')} className="text-white/70" />
            </span>
          ) : posterOnlyVideo && usableVideoPosterSourceUrl ? (
            <ToolVideoMidpointPoster
              src={usableVideoPosterSourceUrl}
              onReady={onMediaLoaded}
              onFailed={() => setFailedPosterVideoUrl(usableVideoPosterSourceUrl)}
              className={cn(
                'h-full w-full transition duration-200',
                isMediaLoading ? 'opacity-0' : 'opacity-100',
              )}
            />
          ) : posterOnlyStreamVideo ? (
            <span className="flex h-full w-full items-center justify-center bg-black">
              <Clapperboard className="size-10 text-white/35" />
            </span>
          ) : mediaUrl && isEmbeddableVideoUrl(mediaUrl) ? (
            <iframe
              src={mediaUrl}
              title={toolCopy(view.label)}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={onMediaLoaded}
              onError={handleMediaFailed}
              className={cn(
                'pointer-events-none h-full w-full border-0 bg-black transition duration-200',
                isMediaLoading ? 'opacity-0' : 'opacity-100',
              )}
            />
          ) : mediaUrl ? (
            <video
              src={mediaUrl}
              aria-hidden="true"
              tabIndex={-1}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={onMediaLoaded}
              onCanPlay={onMediaLoaded}
              onError={handleMediaFailed}
              className={cn(
                'pointer-events-none h-full w-full object-contain transition duration-200',
                isMediaLoading ? 'opacity-0' : 'opacity-100',
              )}
            />
          ) : null}
          {mediaUrl && !isMediaLoading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
              <span className="flex size-11 items-center justify-center rounded-full bg-background/88 text-foreground shadow-sm backdrop-blur-sm">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </span>
          ) : null}
        </button>
      ) : view.kind === 'audio' && mediaUrl ? (
        <div className="flex h-full flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_center,rgb(16_185_129_/_0.16),transparent_58%)] px-8 pb-12">
          <span className="flex size-20 items-center justify-center rounded-full border border-border/60 bg-background/72 text-primary shadow-sm backdrop-blur-sm">
            <AudioLines className="size-9" />
          </span>
          <audio
            src={mediaUrl}
            controls
            preload="metadata"
            onLoadedMetadata={onMediaLoaded}
            onCanPlay={onMediaLoaded}
            onError={handleMediaFailed}
            className={cn(
              'w-full max-w-xl transition duration-200',
              isMediaLoading ? 'opacity-0' : 'opacity-100',
            )}
          />
        </div>
      ) : mediaUrl ? (
        <button
          type="button"
          onMouseEnter={() => void gifReplay.restart()}
          onFocus={() => void gifReplay.restart()}
          onClick={() => {
            const openUrl = gifReplayable ? gifReplay.restart() : mediaUrl
            openOutputUrl(openUrl, view.kind, toolCopy(view.label), {
              prompt: view.prompt ?? undefined,
              downloadUrl,
              replayable: gifReplayable,
              taskDetails,
            })
          }}
          className="relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <ToolRetryingStorageImage
            src={gifReplay.displayUrl ?? mediaUrl}
            alt={toolCopy(view.label)}
            loading={compact ? 'lazy' : 'eager'}
            isLoading={isMediaLoading}
            onLoaded={onMediaLoaded}
            onFailed={handleMediaFailed}
          />
          {view.kind === 'video' ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
              <span className="flex size-11 items-center justify-center rounded-full bg-background/88 text-foreground shadow-sm backdrop-blur-sm">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </span>
          ) : null}
        </button>
      ) : (
        <div className="flex h-full items-center justify-center">
          {!isMediaLoading ? (
            view.kind === 'video' ? (
              <Clapperboard className="size-10 text-muted-foreground" />
            ) : view.kind === 'audio' ? (
              <AudioLines className="size-10 text-muted-foreground" />
            ) : (
              <ImageIcon className="size-10 text-muted-foreground" />
            )
          ) : null}
        </div>
      )}
      {view.statusTone === 'ready' && isMediaLoading ? (
        <ToolMediaLoadingOverlay label={tAuto('loading_kind', { kind: tAuto('media_kind', { kind: view.kind }) })} />
      ) : null}
      {view.statusTone === 'ready' && isMediaFailed && !deferPreviewFailure ? (
        <ToolMediaLoadIssue kind={view.kind} onRetry={() => { void deliveryQuery.refetch() }} />
      ) : null}
      {view.statusTone === 'processing' ? (
        <ToolMediaLoadingOverlay label={tAuto('processing_kind', { kind: tAuto('media_kind', { kind: view.kind }) })} />
      ) : null}
    </div>
  )
}

function ToolRetryingStorageImage({
  src,
  alt,
  loading,
  isLoading,
  onLoaded,
  onFailed,
}: {
  src: string
  alt: string
  loading: 'eager' | 'lazy'
  isLoading: boolean
  onLoaded: () => void
  onFailed: () => void
}) {
  const [attempt, setAttempt] = React.useState(0)
  const retryTimeoutRef = React.useRef<number | null>(null)
  const maxAttempts = 4
  const displaySrc = attempt > 0 ? appendPreviewRetryParam(src, attempt) : src

  React.useEffect(() => () => {
    if (retryTimeoutRef.current !== null) window.clearTimeout(retryTimeoutRef.current)
  }, [])

  const handleError = React.useCallback(() => {
    if (attempt >= maxAttempts) {
      onFailed()
      return
    }
    const retryDelayMs = Math.min(900 + attempt * 650, 2800)
    retryTimeoutRef.current = window.setTimeout(() => {
      retryTimeoutRef.current = null
      setAttempt((value) => value + 1)
    }, retryDelayMs)
  }, [attempt, onFailed])

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displaySrc}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => {
          onLoaded()
        }}
        onError={handleError}
        className={cn(
          'h-full w-full object-contain transition duration-200',
          isLoading ? 'invisible opacity-0' : 'visible opacity-100',
        )}
      />
    </>
  )
}

function appendPreviewRetryParam(url: string, attempt: number) {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  const [baseAndQuery, hash = ''] = url.split('#')
  const separator = baseAndQuery.includes('?') ? '&' : '?'
  return `${baseAndQuery}${separator}yt_preview_retry=${attempt}${hash ? `#${hash}` : ''}`
}

function appendGifReplayParam(url: string, replayToken: number) {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  const [baseAndQuery, hash = ''] = url.split('#')
  const separator = baseAndQuery.includes('?') ? '&' : '?'
  return `${baseAndQuery}${separator}yt_gif_replay=${replayToken}${hash ? `#${hash}` : ''}`
}

function ToolStorageStatusBadge({
  view,
  mediaFailed = false,
  className,
}: {
  view: ToolRenderableOutputView
  mediaFailed?: boolean
  className?: string
}) {
  const running = view.statusTone === 'processing'
  const failed = view.statusTone === 'failed' || mediaFailed
  const label = failed ? 'Failed' : view.statusLabel

  return (
    <ToolOutputStateBadge
      state={failed ? 'failed' : running ? 'processing' : 'ready'}
      label={label}
      compact={false}
      className={className}
    />
  )
}

function ToolStorageActionRail({
  view,
  media,
  channelId,
  taskDetails,
  showOpen = true,
}: {
  view: ToolRenderableOutputView
  media: ToolOutputMedia | null
  channelId: string | null
  taskDetails?: StorageInspectorTaskDetails
  showOpen?: boolean
}) {
  const deliveryQuery = useToolStorageOutputDelivery(channelId, view)
  const refreshedMediaUrl = deliveryQuery.data?.url ?? null
  const storageBacked = Boolean(view.storageObjectId?.trim())
  const downloadUrl = getToolStorageOutputDownloadUrl(channelId, view) ?? (storageBacked ? null : view.downloadUrl)
  const openUrl = refreshedMediaUrl
    ?? (storageBacked ? null : view.mediaUrl)
    ?? view.previewUrl
    ?? (storageBacked ? null : view.downloadUrl)

  return (
    <ToolOutputTopActions
      media={media}
      outputKind={view.kind}
      openUrl={openUrl}
      downloadUrl={downloadUrl ?? openUrl}
      canDownload={view.canDownload || Boolean(downloadUrl)}
      prompt={view.prompt}
      taskDetails={taskDetails}
      showOpen={showOpen}
    />
  )
}

function isRasterImageOutputUrl(value: string | null | undefined) {
  if (!value || !isUsableOutputUrl(value)) return false
  if (isEmbeddableVideoUrl(value)) return false
  const pathname = value.split('?')[0]?.split('#')[0]?.toLowerCase() ?? ''
  return /\.(avif|bmp|gif|jpe?g|png|webp)$/.test(pathname)
}

function getToolStoragePreviewMediaUrl(input: {
  kind: ToolOutputMediaKind
  storageBacked: boolean
  channelId: string | null
  storageObjectId: string | null
  deliveryUrl: string | null
  deliveryVariant?: 'original' | 'stream'
  mediaUrl: string | null
  previewUrl: string | null
}) {
  if (input.deliveryUrl) {
    if (
      input.deliveryVariant === 'original'
      && (input.kind === 'video' || input.kind === 'audio')
      && input.channelId
      && input.storageObjectId
    ) {
      return getStoragePlaybackUrl({
        channelId: input.channelId,
        objectId: input.storageObjectId,
      })
    }
    return input.deliveryUrl
  }
  if (input.storageBacked) {
    if (input.kind === 'video' || input.kind === 'audio') return null
    return input.previewUrl
  }
  if (input.kind === 'video' && isRasterImageOutputUrl(input.previewUrl)) {
    return input.mediaUrl
  }
  return input.mediaUrl ?? input.previewUrl
}

function useToolStorageOutputDelivery(
  channelId: string | null,
  view: Pick<ToolRenderableOutputView, 'storageObjectId' | 'displayStorageObjectId' | 'statusTone' | 'kind'>,
  retryToken = 0,
) {
  const storageObjectId = view.displayStorageObjectId?.trim() || view.storageObjectId?.trim() || ''
  return useStorageObjectDeliveryUrl({
    channelId,
    storageObjectId,
    enabled: Boolean(channelId && storageObjectId && view.statusTone === 'ready'),
    kind: view.kind,
    retryToken,
  })
}

function shouldRetryStoragePreview(failureCount: number, error: unknown) {
  return failureCount < 24 && isRetryableStorageDeliveryError(error)
}

function useStorageObjectDeliveryUrl({
  channelId,
  storageObjectId,
  enabled,
  kind,
  retryToken = 0,
}: {
  channelId: string | null
  storageObjectId: string | null
  enabled: boolean
  kind: ToolOutputMediaKind
  retryToken?: number
}) {
  const normalizedObjectId = storageObjectId?.trim() || ''
  return useQuery({
    queryKey: [
      'storage-output-delivery',
      channelId ?? 'none',
      normalizedObjectId,
      kind,
      retryToken,
    ],
    queryFn: () => resolveToolStorageOutputDelivery({
      channelId: channelId!,
      objectId: normalizedObjectId,
      expiresInSeconds: 3_600,
      kind,
    }),
    enabled: Boolean(enabled && channelId && normalizedObjectId),
    staleTime: 45 * 60_000,
    refetchInterval: (query) => query.state.error
      ? false
      : storageDeliveryRefreshDelay(query.state.data),
    refetchOnWindowFocus: true,
    retry: shouldRetryStoragePreview,
    retryDelay: (attemptIndex) => Math.min(600 * (2 ** attemptIndex), 4_000),
  })
}

function useStorageObjectThumbnailUrl({
  channelId,
  storageObjectId,
  enabled,
}: {
  channelId: string | null
  storageObjectId: string | null
  enabled: boolean
}) {
  const normalizedObjectId = storageObjectId?.trim() || ''
  return useQuery({
    queryKey: ['storage-output-thumbnail', channelId ?? 'none', normalizedObjectId],
    queryFn: () => getStorageThumbnailUrl({
      channelId: channelId!,
      objectId: normalizedObjectId,
      expiresInSeconds: 3_600,
    }),
    enabled: Boolean(enabled && channelId && normalizedObjectId),
    staleTime: 45 * 60_000,
    refetchInterval: (query) => query.state.error
      ? false
      : storageDeliveryRefreshDelay(query.state.data),
    refetchOnWindowFocus: false,
    retry: shouldRetryStoragePreview,
    retryDelay: (attemptIndex) => Math.min(600 * (2 ** attemptIndex), 5_000),
  })
}

function getToolStorageOutputDownloadUrl(
  channelId: string | null,
  view: Pick<ToolRenderableOutputView, 'storageObjectId' | 'fileName' | 'label'>,
) {
  const storageObjectId = view.storageObjectId?.trim()
  if (!channelId || !storageObjectId) return null
  return getStorageDownloadUrl({
    channelId,
    objectId: storageObjectId,
    fileName: view.fileName?.trim() || view.label || 'output',
  })
}

function ToolEmptyOutputState({ tool }: { tool: ToolConfig }) {
  const tAuto = useTranslations('Auto')
  if (isVideoToGifToolConfig(tool) || isFrameExtractToolConfig(tool) || isMediaTransformToolConfig(tool)) return null
  return (
    <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {tool.modelKind === 'voice'
        ? tAuto('generated_speech_and_voice_profiles_will_appear__177cf654')
        : tAuto(tool.modelKind === 'video' ? 'generated_videos_will_appear' : 'generated_images_will_appear')}
    </p>
  )
}

function ToolMagicClipsEmptyResult({
  taskId,
  reason,
}: {
  taskId: string | null
  reason?: string | null
}) {
  const tAuto = useTranslations('Auto')
  const emptyCopy = getMagicClipsEmptyResultCopy(reason, {
    noSpeechDetected: {
      title: tAuto('magic_clips_empty_no_speech_title'),
      description: tAuto('magic_clips_empty_no_speech_description'),
    },
    insufficientSpeech: {
      title: tAuto('magic_clips_empty_insufficient_speech_title'),
      description: tAuto('magic_clips_empty_insufficient_speech_description'),
    },
    musicOnly: {
      title: tAuto('magic_clips_empty_music_only_title'),
      description: tAuto('magic_clips_empty_music_only_description'),
    },
    noCompleteUtterance: {
      title: tAuto('magic_clips_empty_no_complete_utterance_title'),
      description: tAuto('magic_clips_empty_no_complete_utterance_description'),
    },
    noSafeEditorialMoment: {
      title: tAuto('magic_clips_empty_no_safe_editorial_title'),
      description: tAuto('magic_clips_empty_no_safe_editorial_description'),
    },
    default: {
      title: tAuto('magic_clips_empty_default_title'),
      description: tAuto('magic_clips_empty_default_description'),
    },
  })
  return (
    <div
      data-magic-clips-empty-result
      className="relative flex h-[clamp(17rem,42vh,31rem)] flex-col items-center justify-center overflow-hidden bg-muted/30 px-6 text-center"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.22)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.22)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="relative flex size-12 items-center justify-center rounded-full border border-border/80 bg-background shadow-sm">
        <Clapperboard className="size-5 text-muted-foreground" />
      </div>
      <p className="relative mt-4 text-sm font-semibold text-foreground">
        {emptyCopy.title}
      </p>
      <p className="relative mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {emptyCopy.description}
      </p>
      {taskId ? (
        <div
          data-magic-clips-task-id={taskId}
          className="relative mt-4 flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur"
        >
          <span className="truncate"><UiText id="task_7bb0ddf9" />{' '}{taskId}</span>
          <button
            type="button"
            aria-label={tAuto('copy_task_id_9b3cceb4')}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => void copyTextToClipboard(taskId)}
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

type MagicClipsEmptyResultCopySet = {
  noSpeechDetected: { title: string; description: string }
  insufficientSpeech: { title: string; description: string }
  musicOnly: { title: string; description: string }
  noCompleteUtterance: { title: string; description: string }
  noSafeEditorialMoment: { title: string; description: string }
  default: { title: string; description: string }
}

function getMagicClipsEmptyResultCopy(
  reason: string | null | undefined,
  copy: MagicClipsEmptyResultCopySet,
) {
  switch (reason?.trim().toLowerCase()) {
    case 'no_speech_detected':
      return copy.noSpeechDetected
    case 'insufficient_usable_speech_duration':
      return copy.insufficientSpeech
    case 'music_only_or_non_dialogue':
      return copy.musicOnly
    case 'no_complete_utterance_candidates':
      return copy.noCompleteUtterance
    case 'editorial_no_safe_candidates':
    case 'editorial_selection_returned_fewer_safe_candidates':
    case 'planner_no_safe_candidate':
    case 'planner_quality_threshold':
      return copy.noSafeEditorialMoment
    default:
      return copy.default
  }
}

function ToolMediaOutputList({ title, media }: { title: string; media: ToolOutputMedia[] }) {
  const toolCopy = useToolCopy()
  if (media.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="space-y-2">
        {media.map((item) => (
          <ToolMediaOutputItem key={`${item.kind}:${toolCopy(item.label)}:${item.url}`} item={item} />
        ))}
      </div>
    </div>
  )
}

function ToolMediaOutputItem({ item }: { item: ToolOutputMedia }) {
  const toolCopy = useToolCopy()
  const origin = getOutputUrlOrigin(item.url)

  if (item.kind === 'video') {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-panel/40">
        <div className="flex gap-3 p-2">
          <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded bg-secondary">
            {isEmbeddableVideoUrl(item.url) ? (
              <iframe
                src={item.url}
                title={toolCopy(item.label)}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full border-0 bg-black"
              />
            ) : (
              <video
                src={item.url}
                controls
                preload="metadata"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1 py-1">
            <p className="truncate text-sm font-medium text-foreground">{toolCopy(item.label)}</p>
            {origin ? <p className="mt-1 truncate text-xs text-muted-foreground">{origin}</p> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
            onClick={() => openOutputUrl(item.url, item.kind, toolCopy(item.label))}
            >
              <Play className="size-4" />
              <UiText id="preview_f1fbb2b4" /></Button>
          </div>
        </div>
      </div>
    )
  }

  if (item.kind === 'audio') {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-panel/40 p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
            <AudioLines className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{toolCopy(item.label)}</p>
            {origin ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{origin}</p> : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadOutputUrl(item.url)}>
            <Download className="size-4" />
            <UiText id="download_a479c9c3" /></Button>
        </div>
        <audio src={item.url} controls preload="metadata" className="mt-3 w-full" />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel/40">
      <button
        type="button"
        onClick={() => openOutputUrl(item.url, item.kind, toolCopy(item.label))}
        className="group relative block h-[clamp(14rem,32vh,24rem)] w-full overflow-hidden bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <Image
          src={item.url}
          alt={toolCopy(item.label)}
          fill
          unoptimized
          sizes="(min-width: 1280px) 42vw, (min-width: 768px) 54vw, 92vw"
          className="object-contain transition-transform duration-200"
        />
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-background/65 px-3 py-2 dark:border-white/[0.08]">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{toolCopy(item.label)}</p>
          {origin ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{origin}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openOutputUrl(item.url, item.kind, toolCopy(item.label))}>
            <Eye className="size-4" />
            <UiText id="preview_f1fbb2b4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadOutputUrl(item.url)}>
            <Download className="size-4" />
            <UiText id="download_a479c9c3" /></Button>
        </div>
      </div>
    </div>
  )
}

function collectRecentOutputMedia(
  outputs: WorkflowAgentOutputResult[],
  currentAgentId?: string | null,
  fallbackKind: ToolOutputMedia['kind'] | null = null,
) {
  const media: ToolOutputMedia[] = []
  outputs.forEach((output) => {
    if (currentAgentId && output.agentId === currentAgentId) return
    media.push(...collectAgentOutputMedia(output, `Run ${media.length + 1}`, fallbackKind))
  })
  return dedupeOutputMedia(media).slice(0, 6)
}

function collectAgentOutputMedia(
  output: WorkflowAgentOutputResult | null,
  fallbackLabel = 'Output',
  fallbackKind: ToolOutputMedia['kind'] | null = null,
) {
  if (!output?.output) return []
  const storageObjectIds = getAgentOutputStorageObjectIds(output)
  return dedupeOutputMedia(
    collectMediaUrls(output.output, [], fallbackLabel, fallbackKind)
      .map((item, index) => ({
        ...item,
        storageObjectId: item.storageObjectId ?? storageObjectIds[index] ?? null,
      })),
  ).slice(0, 12)
}

function collectAngleOutputMedia(value: unknown): ToolOutputMedia[] {
  const records = findAngleOutputRecords(value)
  return dedupeOutputMedia(records.flatMap((record, index) => {
    const rawUrl = getStringValue(record.image_url)
      ?? getStringValue(record.cdn_url)
      ?? getStringValue(record.artifact_url)
      ?? getStringValue(record.url)
    const storageObjectId = getStringValue(record.storage_object_id)
      ?? getStringValue(record.storageObjectId)
      ?? getStorageObjectIdFromUri(rawUrl)
    const url = rawUrl && isUsableOutputUrl(rawUrl)
      ? rawUrl
      : storageObjectId
        ? `storage://${storageObjectId}`
        : null
    if (!url) return []
    const angle = getPortRecord(record.angle)
    return [{
      kind: 'image' as const,
      url,
      label: getStringValue(angle.label) ?? `Angle ${index + 1}`,
      storageObjectId,
      ...getOutputRecordStorageProjection(record),
      fileName: getStringValue(record.file_name) ?? getStringValue(record.filename),
    }]
  })).slice(0, 6)
}

function collectRecentAngleOutputMedia(item: RecentWorkflowOutputItem): ToolOutputMedia[] {
  const projected = collectRecentFrameOutputMedia(item).slice(0, 6)
  const payload = collectAngleOutputMedia(item.outputPreview)
  if (projected.length === 0) return payload
  return projected.map((media, index) => ({
    ...media,
    label: payload[index]?.label ?? `Angle ${index + 1}`,
  }))
}

function findAngleOutputRecords(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 5) return []
  const record = value as Record<string, unknown>
  if (Array.isArray(record.images)) {
    return record.images.filter((image): image is Record<string, unknown> => (
      Boolean(image) && typeof image === 'object' && !Array.isArray(image)
    ))
  }
  for (const key of ['result', 'output', 'data']) {
    const found = findAngleOutputRecords(record[key], depth + 1)
    if (found.length > 0) return found
  }
  return []
}

function collectVideoToGifOutputMedia(output: WorkflowAgentOutputResult | null): ToolOutputMedia[] {
  if (!output?.output) return []
  const root = getPortRecord(output.output)
  const result = getPortRecord(root.result)
  const rawUrl = getStringValue(result.image_url)
  const resultStorageObjectId = getStringValue(result.storage_object_id)
  const storageObjectId = resultStorageObjectId ?? getStorageObjectIdFromUri(rawUrl)
  const previewStorageObjectId = getGifPreviewStorageObjectId(result)
  const url = rawUrl && isUsableOutputUrl(rawUrl)
    ? rawUrl
    : storageObjectId
      ? `storage://${storageObjectId}`
      : null

  if (url) {
    return [{
      kind: 'image',
      url,
      label: 'Generated GIF',
      storageObjectId,
      ...(previewStorageObjectId ? { previewStorageObjectId } : {}),
      ...getOutputRecordStorageProjection(result),
      fileName: getGifDownloadFileName(
        getStringValue(result.file_name) ?? getStringValue(result.filename),
      ),
    }]
  }

  return collectAgentOutputMedia(output, 'Generated GIF', 'image')
    .filter((item) => item.kind === 'image')
    .slice(0, 1)
}

function collectMediaTransformOutputMedia(output: WorkflowAgentOutputResult | null): ToolOutputMedia[] {
  if (!output?.output) return []
  const root = getPortRecord(output.output)
  const result = getPortRecord(root.result)
  const rawUrl = getStringValue(result.video_url)
  const resultStorageObjectId = getStringValue(result.storage_object_id)
  const storageObjectId = resultStorageObjectId ?? getStorageObjectIdFromUri(rawUrl)
  const url = rawUrl && isUsableOutputUrl(rawUrl)
    ? rawUrl
    : storageObjectId
      ? `storage://${storageObjectId}`
      : null

  if (url) {
    const metadata = getPortRecord(result.metadata)
    return [{
      kind: 'video',
      url,
      label: 'Transformed video',
      storageObjectId,
      ...getOutputRecordStorageProjection(result),
      fileName: getStringValue(metadata.file_name) ?? getStringValue(metadata.filename),
    }]
  }

  return dedupeOutputMedia(
    collectMediaUrls(root.media_refs, [], 'Transformed video', 'video')
      .filter((item) => item.kind === 'video')
      .filter((item) => !resultStorageObjectId || item.storageObjectId === resultStorageObjectId),
  ).slice(0, 1)
}

/**
 * K7: Video to GIF r3's animated WebP preview of the GIF frames (`preview_storage_object_id`, or a `storage://` id in
 * `preview_url`). The output is shown through it; with `gif_delivery: on_download` the real GIF is rendered only when
 * it is downloaded, so displaying the GIF object itself would start that render.
 */
function getGifPreviewStorageObjectId(result: Record<string, unknown>): string | null {
  return getStringValue(result.preview_storage_object_id)?.trim()
    || getStorageObjectIdFromUri(getStringValue(result.preview_url) ?? null)
    || null
}

function getRecentGifPreviewStorageObjectId(item: RecentWorkflowOutputItem): string | null {
  if (!item.nodeType.toLowerCase().startsWith('video_to_gif')) return null
  const root = getPortRecord(item.outputPreview)
  for (const candidate of [getPortRecord(root.result), getPortRecord(getPortRecord(root.output).result), root]) {
    const previewId = getGifPreviewStorageObjectId(candidate)
    if (previewId) return previewId
  }
  return null
}

function getGifDownloadFileName(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return 'generated.gif'
  const baseName = normalized.replace(/\.[^./\\]+$/, '').trim()
  return `${baseName || 'generated'}.gif`
}

function collectMagicClipOutputMedia(output: WorkflowAgentOutputResult | null): ToolOutputMedia[] {
  if (!output?.output) return []
  return collectMagicClipPayloadMedia(output.output)
}

function collectMagicClipPayloadMedia(value: unknown): ToolOutputMedia[] {
  const rawClips = findMagicClipRecords(value)

  const clips = rawClips.slice(0, 10).flatMap((value, index) => {
    const clip = getPortRecord(value)
    if (Object.keys(clip).length === 0) return []
    const kind = getOutputRecordMediaKind(clip) ?? 'video'
    if (kind !== 'video') return []

    const rawUrl = [clip.url, clip.video_url, clip.cdn_url, clip.download_url]
      .find((candidate): candidate is string => typeof candidate === 'string' && Boolean(candidate.trim()))
      ?.trim() ?? null
    const storageObjectId = [clip.storage_object_id, clip.storageObjectId]
      .find((candidate): candidate is string => typeof candidate === 'string' && Boolean(candidate.trim()))
      ?.trim()
      ?? getStorageObjectIdFromUri(rawUrl)
    const directUrl = rawUrl && isUsableOutputUrl(rawUrl) ? rawUrl : null
    if (!storageObjectId && !directUrl) return []

    const fileName = [clip.file_name, clip.fileName, clip.filename, clip.name]
      .find((candidate): candidate is string => typeof candidate === 'string' && Boolean(candidate.trim()))
      ?.trim() ?? null
    const metadata = getPortRecord(clip.metadata)
    const selection = getPortRecord(metadata.selection)
    const censor = getPortRecord(clip.censor ?? getPortRecord(metadata.transform).censor)
    const title = [selection.title, clip.title]
      .find((candidate): candidate is string => typeof candidate === 'string' && Boolean(candidate.trim()))
      ?.trim() ?? `Viral Clip ${index + 1}`
    const socialCaption = [
      selection.social_caption,
      selection.socialCaption,
      clip.social_caption,
      clip.socialCaption,
      selection.description,
      clip.description,
    ]
      .find((candidate): candidate is string => typeof candidate === 'string' && Boolean(candidate.trim()))
      ?.trim() ?? null
    return [{
      kind: 'video' as const,
      url: directUrl ?? `storage://${storageObjectId}`,
      label: title,
      socialCaption,
      ...(typeof censor.status === 'string' ? { censor: { status: censor.status,
        detected_count: getFiniteNumber(censor.detected_count) ?? 0, applied_count: getFiniteNumber(censor.applied_count) ?? 0 } } : {}),
      description: socialCaption,
      hashtags: getMetadataStringList(
        Array.isArray(selection.hashtags) ? selection.hashtags : clip.hashtags,
        5,
      ),
      titleAlternatives: getMetadataStringList(
        Array.isArray(selection.title_alternatives) ? selection.title_alternatives : clip.title_alternatives,
        2,
      ),
      captionAlternatives: getMetadataStringList(
        Array.isArray(selection.caption_alternatives)
          ? selection.caption_alternatives
          : clip.caption_alternatives,
        2,
      ),
      tone: getStringValue(selection.tone) ?? getStringValue(clip.tone),
      viralPotentialScore: getFiniteNumber(
        selection.viral_potential_score ?? selection.score ?? clip.viral_potential_score ?? clip.score,
      ),
      editorialSummary: getStringValue(
        selection.editorial_summary
        ?? selection.editorialSummary
        ?? metadata.editorial_summary
        ?? metadata.editorialSummary
        ?? clip.editorial_summary
        ?? clip.editorialSummary,
      ),
      selectionReason: getStringValue(
        selection.selection_reason
        ?? selection.selectionReason
        ?? metadata.selection_reason
        ?? metadata.selectionReason
        ?? clip.selection_reason
        ?? clip.selectionReason,
      ),
      storageObjectId: storageObjectId ?? null,
      ...getOutputRecordStorageProjection(clip),
      fileName,
    }]
  })
  return dedupeOutputMedia(clips)
}

function findMagicClipRecords(value: unknown, depth = 0): unknown[] {
  const payload = findMagicClipPayload(value, depth)
  return payload && Array.isArray(payload.clips) ? payload.clips : []
}

const MAGIC_CLIPS_COMPLETED_EMPTY_REASONS = new Set([
  'no_speech_detected',
  'insufficient_usable_speech_duration',
  'music_only_or_non_dialogue',
  'no_complete_utterance_candidates',
  'editorial_no_safe_candidates',
])

function isExplicitMagicClipsCompletedEmpty(value: unknown): boolean {
  const payload = findMagicClipPayloadEnvelope(value)?.payload
  const reason = getStringValue(payload?.zero_output_reason)?.trim().toLowerCase() ?? ''
  return payload?.completed_empty === true
    && getNonNegativeInteger(payload.produced_clip_count ?? payload.clip_count) === 0
    && MAGIC_CLIPS_COMPLETED_EMPTY_REASONS.has(reason)
}

function isEmptyMagicClipPayload(value: unknown): boolean {
  const payload = findMagicClipPayloadEnvelope(value)?.payload ?? findMagicClipPayload(value)
  if (!payload) return false
  const emptyClipManifest = Array.isArray(payload.clips)
    && payload.clips.length === 0
    && getFiniteNumber(payload.clip_count) === 0
  return isExplicitMagicClipsCompletedEmpty(payload) || emptyClipManifest
}

function findMagicClipPayload(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || depth > 4 || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Array.isArray(record.clips)) return record
  for (const key of ['result', 'output', 'data']) {
    const found = findMagicClipPayload(record[key], depth + 1)
    if (found) return found
  }
  return null
}

function getMetadataStringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return []
  const items = value.flatMap((item) => (
    typeof item === 'string' && item.trim() ? [item.trim()] : []
  ))
  return [...new Set(items)].slice(0, limit)
}

function getStorageObjectIdFromUri(value: string | null) {
  if (!value?.toLowerCase().startsWith('storage://')) return null
  const objectId = value.slice('storage://'.length).replace(/^\/+/, '').trim()
  return objectId || null
}

function collectFrameExtractOutputMedia(output: WorkflowAgentOutputResult | null): ToolOutputMedia[] {
  const frames = findFrameExtractRecords(output?.output, 0)
  const mode = findFrameExtractMode(output?.output, 0)
  return frames.slice(0, 120).flatMap((frame, position) => {
    const directUrl = getStringValue(frame.image_url)
    const storageObjectId = getStringValue(frame.storage_object_id)
    const fileName = getStringValue(frame.file_name) ?? getStringValue(frame.filename)
    const url = directUrl && isUsableOutputUrl(directUrl)
      ? directUrl
      : storageObjectId
        ? `storage://${storageObjectId}`
        : null
    if (!url) return []
    const index = getFiniteNumber(frame.index)
    const timestamp = getFiniteNumber(frame.timestamp_sec)
    const ordinal = index !== null ? Math.max(1, Math.round(index) + 1) : position + 1
    const frameName = mode === 'first'
      ? 'First frame'
      : mode === 'last'
        ? 'Last frame'
        : mode === 'first_last' && position === 0
          ? 'First frame'
          : mode === 'first_last' && position === frames.length - 1
            ? 'Last frame'
            : `Frame ${ordinal}`
    const label = timestamp !== null
      ? `${frameName} · ${formatFrameTimestamp(timestamp)}`
      : frameName
    return [{
      kind: 'image' as const,
      url,
      label,
      storageObjectId,
      ...getOutputRecordStorageProjection(frame),
      fileName,
    }]
  })
}

function collectRecentFrameOutputMedia(item: RecentWorkflowOutputItem): ToolOutputMedia[] {
  const frames = item.media.flatMap((media, index) => {
    const storageObjectId = media.storageObjectId?.trim() || null
    const directUrl = [media.url, media.previewUrl, media.downloadUrl]
      .find((candidate): candidate is string => Boolean(candidate && isUsableOutputUrl(candidate)))
    const url = directUrl ?? (storageObjectId ? `storage://${storageObjectId}` : null)
    if (!url) return []
    const kind = getRecentWorkflowMediaKind(media.kind, media.mimeType, url, 'image')
    if (kind !== 'image') return []
    return [{
      kind: 'image' as const,
      url,
      label: media.fileName?.trim() || `Frame ${index + 1}`,
      storageObjectId,
      storageStatus: media.storageStatus,
      workflowReady: media.workflowReady,
      fileName: media.fileName,
    }]
  })
  return dedupeOutputMedia(frames).slice(0, 120)
}

function collectRecentMagicClipOutputMedia(
  item: RecentWorkflowOutputItem,
  fullOutput: WorkflowAgentOutputResult | null = null,
): ToolOutputMedia[] {
  const projectedClips = item.media.flatMap((media, index) => {
    const storageObjectId = media.storageObjectId?.trim() || null
    const url = [media.url, media.previewUrl, media.downloadUrl]
      .find((candidate): candidate is string => Boolean(candidate && isUsableOutputUrl(candidate)))
      ?? (storageObjectId ? `storage://${storageObjectId}` : null)
    if (!url) return []
    const kind = getRecentWorkflowMediaKind(media.kind, media.mimeType, url, 'video')
    if (kind !== 'video') return []
    return [{
      kind: 'video' as const,
      url,
      label: media.title?.trim() || `Viral Clip ${index + 1}`,
      socialCaption: media.socialCaption ?? media.description,
      description: media.description ?? media.socialCaption,
      hashtags: media.hashtags,
      titleAlternatives: media.titleAlternatives,
      captionAlternatives: media.captionAlternatives,
      tone: media.tone,
      viralPotentialScore: media.viralPotentialScore,
      editorialSummary: media.editorialSummary,
      selectionReason: media.selectionReason,
      storageObjectId,
      storageStatus: media.storageStatus,
      workflowReady: media.workflowReady,
      fileName: media.fileName,
    }]
  })
  const fullOutputClips = collectMagicClipOutputMedia(fullOutput)
  const manifestClips = fullOutputClips.length > 0
    ? fullOutputClips
    : collectMagicClipPayloadMedia(item.outputPreview)
  if (manifestClips.length === 0) return dedupeOutputMedia(projectedClips).slice(0, 10)
  if (projectedClips.length === 0) return manifestClips.slice(0, 10)

  const projectedByStorageObjectId = new Map(
    projectedClips.flatMap((clip) => (
      clip.storageObjectId ? [[clip.storageObjectId, clip] as const] : []
    )),
  )
  const usedProjectedClips = new Set<ToolOutputMedia>()
  const mergedClips = manifestClips.map((manifestClip, index) => {
    const projectedClip = (
      manifestClip.storageObjectId
        ? projectedByStorageObjectId.get(manifestClip.storageObjectId)
        : undefined
    ) ?? projectedClips[index]
    if (!projectedClip) return manifestClip
    usedProjectedClips.add(projectedClip)
    return {
      ...manifestClip,
      url: projectedClip.url,
      storageObjectId: projectedClip.storageObjectId ?? manifestClip.storageObjectId,
      storageStatus: projectedClip.storageStatus ?? manifestClip.storageStatus,
      workflowReady: projectedClip.workflowReady ?? manifestClip.workflowReady,
      fileName: projectedClip.fileName ?? manifestClip.fileName,
    }
  })
  mergedClips.push(...projectedClips.filter((clip) => !usedProjectedClips.has(clip)))
  return dedupeOutputMedia(mergedClips).slice(0, 10)
}

function findFrameExtractRecords(value: unknown, depth: number): Array<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || depth > 6) return []
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFrameExtractRecords(item, depth + 1)
      if (found.length > 0) return found
    }
    return []
  }

  const record = value as Record<string, unknown>
  if (Array.isArray(record.frames)) {
    const frames = record.frames.filter((item): item is Record<string, unknown> => (
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      && typeof (item as Record<string, unknown>).image_url === 'string'
    ))
    if (frames.length > 0) return frames
  }
  for (const nested of Object.values(record)) {
    const found = findFrameExtractRecords(nested, depth + 1)
    if (found.length > 0) return found
  }
  return []
}

function findFrameExtractMode(value: unknown, depth: number): string {
  if (!value || typeof value !== 'object' || depth > 6) return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFrameExtractMode(item, depth + 1)
      if (found) return found
    }
    return ''
  }

  const record = value as Record<string, unknown>
  const mode = stringifySchemaValue(record.mode)
  if (Array.isArray(record.frames) && ['first', 'last', 'first_last'].includes(mode)) return mode
  for (const nested of Object.values(record)) {
    const found = findFrameExtractMode(nested, depth + 1)
    if (found) return found
  }
  return ''
}

function getAgentOutputStorageObjectId(output: WorkflowAgentOutputResult | null) {
  return getAgentOutputStorageObjectIds(output)[0] ?? null
}

/** GEN-04: the stored node result of a running/settling run as a Storage-backed preview item, or null. */
function getToolEarlyOutputMedia(
  status: WorkflowAgentStatusResult | null | undefined,
  label: string,
): ToolOutputMedia | null {
  const early = findEarlyNodeOutput(status)
  if (!early) return null
  return { kind: early.mediaKind, url: '', label, storageObjectId: early.storageObjectId }
}

function getAgentOutputStorageObjectIds(output: WorkflowAgentOutputResult | null) {
  const objectIds: string[] = []
  collectStorageObjectIds(output?.output, 0, new Set<string>(), objectIds)
  return objectIds
}

function collectStorageObjectIds(
  value: unknown,
  depth: number,
  seen: Set<string>,
  objectIds: string[],
) {
  if (typeof value === 'string') {
    const objectId = getStorageObjectIdFromUri(value)
    if (!objectId || seen.has(objectId)) return
    seen.add(objectId)
    objectIds.push(objectId)
    return
  }
  if (!value || typeof value !== 'object' || depth > 6) return
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStorageObjectIds(item, depth + 1, seen, objectIds)
    }
    return
  }

  const record = value as Record<string, unknown>
  for (const [key, item] of Object.entries(record)) {
    const normalizedKey = key.replace(/[_-]+/g, '').toLowerCase()
    if (normalizedKey !== 'storageobjectid') continue
    if (typeof item !== 'string') continue
    const objectId = item.trim()
    if (!objectId || seen.has(objectId)) continue
    seen.add(objectId)
    objectIds.push(objectId)
  }
  for (const item of Object.values(record)) {
    collectStorageObjectIds(item, depth + 1, seen, objectIds)
  }
}

function collectMediaUrls(
  value: unknown,
  path: string[],
  fallbackLabel: string,
  fallbackKind: ToolOutputMedia['kind'] | null,
): ToolOutputMedia[] {
  if (typeof value === 'string') {
    const storageObjectId = getStorageObjectIdFromUri(value)
    if (storageObjectId && fallbackKind) {
      return [{
        kind: fallbackKind,
        url: `storage://${storageObjectId}`,
        label: mediaLabelFromPath(
          path,
          fallbackLabel,
          fallbackKind === 'video' ? 'Video' : fallbackKind === 'audio' ? 'Audio' : 'Image',
        ),
        storageObjectId,
      }]
    }
    if (isLikelyAudioUrl(value, path)) {
      return [{ kind: 'audio', url: value, label: mediaLabelFromPath(path, fallbackLabel, 'Audio') }]
    }
    if (isLikelyVideoUrl(value, path)) {
      return [{ kind: 'video', url: value, label: mediaLabelFromPath(path, fallbackLabel, 'Video') }]
    }
    if (isLikelyImageUrl(value, path)) {
      return [{ kind: 'image', url: value, label: mediaLabelFromPath(path, fallbackLabel, 'Image') }]
    }
    if (fallbackKind && isGenericMediaUrl(value, path)) {
      return [{
        kind: fallbackKind,
        url: value,
        label: mediaLabelFromPath(
          path,
          fallbackLabel,
          fallbackKind === 'video' ? 'Video' : fallbackKind === 'audio' ? 'Audio' : 'Image',
        ),
      }]
    }
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => (
      collectMediaUrls(item, [...path, String(index + 1)], fallbackLabel, fallbackKind)
    ))
  }

  if (!value || typeof value !== 'object') return []

  const record = value as Record<string, unknown>
  const recordKind = getOutputRecordMediaKind(record) ?? fallbackKind
  const storageObjectId = [record.storage_object_id, record.storageObjectId]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    ?.trim() ?? null
  const storageProjection = getOutputRecordStorageProjection(record)
  const collected = Object.entries(record).flatMap(([key, item]) =>
    collectMediaUrls(item, [...path, key], fallbackLabel, recordKind),
  )
  if (!storageObjectId) return collected
  if (collected.length > 0) {
    return collected.map((item) => ({
      ...item,
      storageObjectId: item.storageObjectId ?? storageObjectId,
      storageStatus: item.storageStatus ?? storageProjection.storageStatus,
      workflowReady: item.workflowReady ?? storageProjection.workflowReady,
    }))
  }
  if (!recordKind) return []
  return [{
    kind: recordKind,
    url: `storage://${storageObjectId}`,
    label: mediaLabelFromPath(
      path,
      fallbackLabel,
      recordKind === 'video' ? 'Video' : recordKind === 'audio' ? 'Audio' : 'Image',
    ),
    storageObjectId,
    ...storageProjection,
  }]
}

function getOutputRecordStorageProjection(record: Record<string, unknown>) {
  const workflowReadyValue = record.workflow_ready ?? record.workflowReady
  const storageStatus = getStringValue(record.storage_status) ?? getStringValue(record.storageStatus)
  return {
    ...(storageStatus ? { storageStatus } : {}),
    ...(typeof workflowReadyValue === 'boolean' ? { workflowReady: workflowReadyValue } : {}),
  }
}

function isLikelyAudioUrl(value: string, path: string[]) {
  if (!/^https?:\/\//i.test(value)) return false
  const normalizedPath = path.join('_').toLowerCase()
  if (/(^|_)(audio|audio_url|speech|speech_url|voice|voice_url|sound|sound_url)(_|$)/.test(normalizedPath)) return true
  return /\.(mp3|wav|m4a|aac|flac|opus|oga|ogg)(\?|#|$)/i.test(value)
}

function isLikelyVideoUrl(value: string, path: string[]) {
  if (!/^https?:\/\//i.test(value)) return false
  if (isEmbeddableVideoUrl(value)) return true
  if (/\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(value)) return true
  const normalizedPath = path.join('_').toLowerCase()
  return /(^|_)(video|videos|video_url|clip|clips|movie|render_url|playback_url)(_|$)/.test(normalizedPath)
}

function isLikelyImageUrl(value: string, path: string[]) {
  if (!/^https?:\/\//i.test(value)) return false
  const normalizedPath = path.join('_').toLowerCase()
  if (/(^|_)(image|images|image_url|thumbnail|thumbnail_url)(_|$)/.test(normalizedPath)) return true
  return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(value)
}

function isGenericMediaUrl(value: string, path: string[]) {
  if (!/^https?:\/\//i.test(value)) return false
  const fieldName = path[path.length - 1]?.toLowerCase() ?? ''
  return [
    'url',
    'cdn_url',
    'cdnurl',
    'artifact_url',
    'artifacturl',
    'media_url',
    'mediaurl',
    'output_url',
    'outputurl',
    'download_url',
    'downloadurl',
  ].includes(fieldName)
}

function getOutputRecordMediaKind(record: Record<string, unknown>): ToolOutputMedia['kind'] | null {
  const kind = [record.kind, record.media_type, record.mediaType, record.type]
    .find((value): value is string => typeof value === 'string')
    ?.toLowerCase()
  if (kind === 'video' || kind === 'image' || kind === 'audio') return kind

  const mimeType = [record.content_type, record.contentType, record.mime_type, record.mimeType]
    .find((value): value is string => typeof value === 'string')
    ?.toLowerCase()
  if (mimeType?.startsWith('video/')) return 'video'
  if (mimeType?.startsWith('image/')) return 'image'
  if (mimeType?.startsWith('audio/')) return 'audio'
  return null
}

function getToolMediaFallbackKind(modelKind: ToolConfig['modelKind']): ToolOutputMedia['kind'] | null {
  if (modelKind === 'voice') return 'audio'
  return modelKind === 'video' || modelKind === 'image' ? modelKind : null
}

function getToolOutputFallbackKind(tool: ToolConfig): ToolOutputMedia['kind'] | null {
  if (isVideoToGifToolConfig(tool) || isFrameExtractToolConfig(tool)) return 'image'
  return getToolMediaFallbackKind(tool.modelKind)
}

function getToolOutputKindForTool(tool: ToolConfig): ToolOutputMediaKind {
  return getToolOutputFallbackKind(tool) ?? 'image'
}

function getToolWorkflowFallbackKind(tool: ToolConfig): ToolConfig['modelKind'] {
  if (isVideoToGifToolConfig(tool) || isFrameExtractToolConfig(tool)) return 'image'
  return tool.modelKind
}

function mediaLabelFromPath(path: string[], fallbackLabel: string, defaultLabel: string) {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const part = path[index]
    if (part && /^\d+$/.test(part)) return `${fallbackLabel} ${part}`
  }
  return fallbackLabel || defaultLabel
}

function dedupeOutputMedia(media: ToolOutputMedia[]) {
  const seen = new Set<string>()
  return media.filter((item) => {
    const key = item.storageObjectId?.trim()
      ? `${item.kind}:storage:${item.storageObjectId.trim()}`
      : `${item.kind}:${item.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getOutputUrlOrigin(url: string) {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

function getRunRefundedCredits(status: WorkflowAgentStatusResult | null) {
  if (status?.creditReservation) {
    return Math.max(0, status.creditReservation.refundedCredits)
  }
  const record = getPortRecord(status)
  return getFiniteNumber(
    record.totalCreditsRefunded
    ?? record.total_credits_refunded
    ?? record.refundedCredits
    ?? record.refunded_credits,
  )
}

function getRunChargedCredits(run: ToolAgentRunState) {
  const creditReservation = run.status?.creditReservation
  if (creditReservation) return Math.max(0, creditReservation.netChargedCredits)
  if (run.output && run.output.creditsCharged > 0) return run.output.creditsCharged
  return Math.max(0, run.status?.totalCreditsCharged ?? 0)
}

function formatRunCreditLabel({
  status,
  estimatedCredits,
  chargedCredits,
  refundedCredits,
}: {
  status: string | null | undefined
  estimatedCredits: number
  chargedCredits: number
  refundedCredits: number | null
}) {
  if (refundedCredits !== null && refundedCredits > 0) return `Refunded ${formatCreditLabel(refundedCredits)}`
  if (chargedCredits > 0) return formatCreditLabel(chargedCredits)
  if (isFailedRunStatus(status)) return '0 credits'
  // A terminal status is settled before customer output is exposed. Zero is
  // therefore an authoritative cache-hit/no-charge value, not a missing value
  // that should fall back to the launch estimate.
  if (canReadAgentOutput(status)) return '0 credits'
  return `~${formatCreditLabel(estimatedCredits)}`
}

function getToolAgentRunIdentifier(run: ToolAgentRunState) {
  return getPublicToolDisplayIdentifier(
    run.output?.agentId,
    run.launch?.agent_id,
    run.status?.workflowId,
  )
}

function getToolWorkflowOutputIdentifier(item: RecentWorkflowOutputItem) {
  return getPublicToolDisplayIdentifier(item.agentId, item.workflowId)
}

function getPublicToolDisplayIdentifier(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim()
    if (!normalized) continue
    if (/^(?:tool-run|tool-agent|tool-estimate|tool-source-image):/i.test(normalized)) continue
    return normalized
  }
  return null
}

function getTranscriptExpansionKey(identifier: string | null | undefined, fallback: string) {
  const normalized = identifier?.trim()
  return normalized ? `transcript:${normalized}` : fallback
}

function getToolAgentRunTranscriptKey(run: ToolAgentRunState, fallback: string) {
  return getTranscriptExpansionKey(getToolAgentRunIdentifier(run), fallback)
}

function getRecentWorkflowTranscriptKey(item: RecentWorkflowOutputItem) {
  return getTranscriptExpansionKey(getToolWorkflowOutputIdentifier(item), `history:${item.id}`)
}

function formatShortIdentifier(value: string) {
  const normalized = value.trim()
  if (normalized.length <= 14) return normalized
  const first = normalized.slice(0, 6)
  const last = normalized.slice(-6)
  return `${first}...${last}`
}

function useLocalizedOutputDateTime() {
  const formatter = useFormatter()
  const tAuto = useTranslations('Auto')
  return React.useCallback((value: string | undefined) => {
    if (!value) return tAuto('now_e3b82040')
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return tAuto('now_e3b82040')
    return formatter.dateTime(date, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [formatter, tAuto])
}

function copyTextToClipboard(value: string) {
  if (!value.trim()) return
  void navigator.clipboard?.writeText(value).catch(() => undefined)
}

function formatCompactPromptText(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return value.trim()
  return `${words.slice(0, maxWords).join(' ')}...`
}

function getToolAgentRunSessionKey(channelId: string | null, toolId: string) {
  if (!channelId || !toolId) return null
  return `${TOOL_AGENT_RUN_SESSION_KEY_PREFIX}:${channelId}:${toolId}`
}

function getToolAgentRunDurableStorageKey(sessionKey: string) {
  return sessionKey.replace(TOOL_AGENT_RUN_SESSION_KEY_PREFIX, TOOL_AGENT_RUN_DURABLE_KEY_PREFIX)
}

function resetToolAgentRunMemoryStore() {
  TOOL_AGENT_RUN_MEMORY_STORE.clear()
}

function serializeToolAgentRunSession(records: ToolAgentRunRecord[]) {
  return JSON.stringify(records.slice(0, 12).map((record) => ({
    ...record,
    sourceMedia: sanitizeToolRunSourceMediaForSession(record.sourceMedia),
    sourceLinks: record.sourceLinks.flatMap((value) => {
      const sanitized = sanitizeToolRunSessionUrl(value)
      return sanitized ? [sanitized] : []
    }),
    mediaDownloaderSubmission: sanitizeMediaDownloaderSubmission(record.mediaDownloaderSubmission),
  })))
}

function readBrowserStorageItem(storage: Storage | null | undefined, key: string) {
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    // Private mode / disabled storage must not break Tools.
    return null
  }
}

function writeBrowserStorageItem(storage: Storage | null | undefined, key: string, value: string | null) {
  if (!storage) return false
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function getBrowserWebStorage(kind: 'session' | 'local'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

type ToolAgentRunStorageBackend = {
  getSessionStorage: () => Storage | null
  getLocalStorage: () => Storage | null
}

let toolAgentRunStorageBackend: ToolAgentRunStorageBackend = {
  getSessionStorage: () => getBrowserWebStorage('session'),
  getLocalStorage: () => getBrowserWebStorage('local'),
}

function setToolAgentRunStorageBackendForTests(backend: Partial<ToolAgentRunStorageBackend> | null) {
  toolAgentRunStorageBackend = {
    getSessionStorage: backend?.getSessionStorage ?? (() => getBrowserWebStorage('session')),
    getLocalStorage: backend?.getLocalStorage ?? (() => getBrowserWebStorage('local')),
  }
}

function readToolAgentRunSession(key: string) {
  const durableKey = getToolAgentRunDurableStorageKey(key)
  const candidates = [
    TOOL_AGENT_RUN_MEMORY_STORE.get(key) ?? null,
    readBrowserStorageItem(toolAgentRunStorageBackend.getSessionStorage(), key),
    readBrowserStorageItem(toolAgentRunStorageBackend.getLocalStorage(), durableKey),
  ]
  for (const raw of candidates) {
    const parsed = parseToolAgentRunSession(raw)
    if (parsed.length > 0) {
      // Keep memory warm so SPA navigations survive when web storage is blocked.
      TOOL_AGENT_RUN_MEMORY_STORE.set(key, raw!)
      return parsed
    }
  }
  return []
}

function writeToolAgentRunSession(key: string, records: ToolAgentRunRecord[]) {
  const durableKey = getToolAgentRunDurableStorageKey(key)
  if (records.length === 0) {
    TOOL_AGENT_RUN_MEMORY_STORE.delete(key)
    writeBrowserStorageItem(toolAgentRunStorageBackend.getSessionStorage(), key, null)
    writeBrowserStorageItem(toolAgentRunStorageBackend.getLocalStorage(), durableKey, null)
    return
  }

  const payload = serializeToolAgentRunSession(records)
  TOOL_AGENT_RUN_MEMORY_STORE.set(key, payload)
  // sessionStorage: same-tab F5. localStorage: tab close / session wipe / private
  // mode when sessionStorage throws. Memory covers fully blocked storage.
  writeBrowserStorageItem(toolAgentRunStorageBackend.getSessionStorage(), key, payload)
  writeBrowserStorageItem(toolAgentRunStorageBackend.getLocalStorage(), durableKey, payload)
}

function parseToolAgentRunSession(
  value: string | null,
  nowMs = Date.now(),
): ToolAgentRunRecord[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((candidate): ToolAgentRunRecord[] => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return []
      const record = candidate as Record<string, unknown>
      const id = typeof record.id === 'string' ? record.id.trim() : ''
      const idempotencyKey = typeof record.idempotencyKey === 'string'
        ? record.idempotencyKey.trim() || undefined
        : undefined
      const requestedAt = typeof record.requestedAt === 'string' ? record.requestedAt : ''
      const requestedAtMs = Date.parse(requestedAt)
      if (!id || !Number.isFinite(requestedAtMs)) return []
      if (nowMs - requestedAtMs > TOOL_AGENT_RUN_SESSION_MAX_AGE_MS) return []

      const launchRecord = record.launch && typeof record.launch === 'object' && !Array.isArray(record.launch)
        ? record.launch as Record<string, unknown>
        : null
      const launch = launchRecord && typeof launchRecord.agent_id === 'string' && launchRecord.agent_id.trim()
        ? launchRecord as WorkflowAgentLaunchResult
        : null
      let errorMessage = typeof record.errorMessage === 'string' && record.errorMessage.trim()
        ? record.errorMessage
        : null
      const sourceLinks = Array.isArray(record.sourceLinks)
        ? record.sourceLinks.flatMap((item) => {
            const sanitized = typeof item === 'string' ? sanitizeToolRunSessionUrl(item) : null
            return sanitized ? [sanitized] : []
          })
        : []
      let mediaDownloaderSubmission = launch
        ? null
        : sanitizeMediaDownloaderSubmission(record.mediaDownloaderSubmission)
      const preLaunchAgeMs = nowMs - requestedAtMs

      if (
        mediaDownloaderSubmission?.state === 'submitting'
        && preLaunchAgeMs > MEDIA_DOWNLOADER_SUBMISSION_RESUME_WINDOW_MS
      ) {
        mediaDownloaderSubmission = { ...mediaDownloaderSubmission, state: 'failed' }
        errorMessage ??= 'Download submission was interrupted before it was accepted. Please try again.'
      }
      if (
        !launch
        && mediaDownloaderSubmission?.state === 'failed'
        && preLaunchAgeMs > MEDIA_DOWNLOADER_FAILED_SUBMISSION_MAX_AGE_MS
      ) return []
      if (!launch && sourceLinks.length === 0) return []
      // Media Downloader displays an optimistic row before the launch returns.
      // A resumable submission carries the original idempotency key and safe
      // public params, so the exact launch can be reconciled after a refresh.
      // Legacy pre-launch rows remain bounded and are never replayed.
      if (!launch && !mediaDownloaderSubmission && (
        errorMessage
        || nowMs - requestedAtMs > MEDIA_DOWNLOADER_REFRESH_RECONCILIATION_WINDOW_MS
      )) return []

      const sourceRecord = record.sourceMedia && typeof record.sourceMedia === 'object' && !Array.isArray(record.sourceMedia)
        ? record.sourceMedia as Record<string, unknown>
        : null
      const sourceMedia = parseToolRunSourceMediaSession(sourceRecord)
      const captionPreview = record.captionPreview
        && typeof record.captionPreview === 'object'
        && !Array.isArray(record.captionPreview)
        ? record.captionPreview as CaptionRunPreview
        : null
      const estimate = record.estimate && typeof record.estimate === 'object' && !Array.isArray(record.estimate)
        ? record.estimate as WorkflowAgentEstimateResult
        : null

      return [{
        id,
        estimate,
        idempotencyKey,
        launch,
        prompt: typeof record.prompt === 'string' ? record.prompt : '',
        modelLabel: typeof record.modelLabel === 'string' ? publicModelLabel(record.modelLabel) : '',
        provider: 'Youtorch',
        sourceMedia,
        sourceLinks,
        captionPreview,
        requestedAt,
        estimatedCredits: typeof record.estimatedCredits === 'number' && Number.isFinite(record.estimatedCredits)
          ? record.estimatedCredits
          : null,
        activityLabel: typeof record.activityLabel === 'string' && record.activityLabel.trim()
          ? record.activityLabel
          : 'Running',
        voiceProfileId: typeof record.voiceProfileId === 'string' && record.voiceProfileId.trim()
          ? record.voiceProfileId.trim()
          : null,
        mediaDownloaderSubmission,
        loading: !errorMessage,
        errorMessage,
      }]
    }).slice(0, 12)
  } catch {
    return []
  }
}

function createMediaDownloaderSubmission(input: {
  idempotencyKey: string
  nodeType: string
  params: Record<string, unknown>
}): MediaDownloaderSubmission | null {
  return sanitizeMediaDownloaderSubmission({
    ...input,
    state: 'submitting',
  })
}

function sanitizeMediaDownloaderSubmission(value: unknown): MediaDownloaderSubmission | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const idempotencyKey = typeof record.idempotencyKey === 'string'
    ? record.idempotencyKey.trim()
    : ''
  const nodeType = typeof record.nodeType === 'string' ? record.nodeType.trim() : ''
  const state = record.state === 'failed' ? 'failed' : record.state === 'submitting' ? 'submitting' : null
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/.test(idempotencyKey)
    || !/^media_downloader(?:@[A-Za-z0-9._-]+)?$/i.test(nodeType)
    || !state
  ) return null

  const paramsRecord = record.params && typeof record.params === 'object' && !Array.isArray(record.params)
    ? record.params as Record<string, unknown>
    : null
  const params = sanitizeMediaDownloaderSubmissionParams(paramsRecord)
  if (!params) return null
  return { idempotencyKey, nodeType, params, state }
}

function sanitizeMediaDownloaderSubmissionParams(
  params: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!params) return null
  const legacyUrls = Array.isArray(params.urls)
    ? params.urls
    : typeof params.urls === 'string'
      ? params.urls.split(/[\r\n,]+/)
      : []
  const rawSourceUrls = [params.url, ...legacyUrls].flatMap((value) => (
    typeof value === 'string' && value.trim() ? [value.trim()] : []
  ))
  if (rawSourceUrls.length !== 1) return null
  const sourceUrl = sanitizeMediaDownloaderSubmissionSourceUrl(rawSourceUrls[0])
  if (!sourceUrl) return null

  const result: Record<string, unknown> = { url: sourceUrl }
  if (typeof params.metadata === 'boolean') result.metadata = params.metadata

  const mode = stringifySchemaValue(params.mode).toLowerCase()
  if (mode === 'download' || mode === 'metadata') result.mode = mode
  const downloadVariant = stringifySchemaValue(params.download_variant).toLowerCase()
  if (['audio_only', 'video_with_audio', 'video_only'].includes(downloadVariant)) {
    result.download_variant = downloadVariant
  }
  const quality = stringifySchemaValue(params.quality).toLowerCase()
  if (quality && quality !== 'standard' && quality !== 'best_available') result.quality = quality
  if (typeof params.snapshot_id === 'string' && params.snapshot_id.trim()) result.snapshot_id = params.snapshot_id.trim()
  if (typeof params.variant_id === 'string' && params.variant_id.trim()) result.variant_id = params.variant_id.trim()
  const displayed = getFiniteNumber(params.displayed_estimated_credits)
  if (displayed != null) result.displayed_estimated_credits = displayed

  for (const key of ['start_time', 'end_time'] as const) {
    const seconds = getFiniteNumber(params[key])
    if (seconds !== null && seconds >= 0) result[key] = Math.floor(seconds)
  }
  return result
}

function isRetryableWorkflowRequestError(error: unknown) {
  if (!isAuthClientError(error)) return false
  if (error.code === 'GATEWAY_NETWORK_ERROR' || error.code === 'GATEWAY_REQUEST_TIMEOUT') return true
  return error.status === 408
    || error.status === 425
    || error.status === 429
    || error.status >= 500
}

function isRetryableStorageDeliveryError(error: unknown) {
  if (!isAuthClientError(error)) return false
  if (error.code === 'GATEWAY_NETWORK_ERROR' || error.code === 'GATEWAY_REQUEST_TIMEOUT') return true
  return error.status === 404
    || error.status === 408
    || error.status === 409
    || error.status === 425
    || error.status === 429
    || error.status >= 500
}

function sanitizeToolRunSourceMediaForSession(
  sourceMedia: ToolRunSourceMedia | null,
): ToolRunSourceMedia | null {
  if (!sourceMedia) return null
  return {
    channelId: sourceMedia.channelId?.trim() || null,
    storageObjectId: sourceMedia.storageObjectId.trim(),
    name: sourceMedia.name.slice(0, 512),
    mimeType: sourceMedia.mimeType?.slice(0, 255) ?? null,
    durationSeconds: finiteToolRunSessionNumber(sourceMedia.durationSeconds),
    previewUrl: sanitizeToolRunSessionPreview(sourceMedia.previewUrl),
    width: finiteToolRunSessionNumber(sourceMedia.width),
    height: finiteToolRunSessionNumber(sourceMedia.height),
    dimensionSource: sourceMedia.dimensionSource === 'source' || sourceMedia.dimensionSource === 'preview'
      ? sourceMedia.dimensionSource
      : undefined,
  }
}

function parseToolRunSourceMediaSession(
  sourceRecord: Record<string, unknown> | null,
): ToolRunSourceMedia | null {
  if (!sourceRecord) return null
  const storageObjectId = typeof sourceRecord.storageObjectId === 'string'
    ? sourceRecord.storageObjectId.trim()
    : ''
  const name = typeof sourceRecord.name === 'string' ? sourceRecord.name.trim() : ''
  if (!storageObjectId || !name) return null
  return sanitizeToolRunSourceMediaForSession({
    channelId: typeof sourceRecord.channelId === 'string' ? sourceRecord.channelId : null,
    storageObjectId,
    name,
    mimeType: typeof sourceRecord.mimeType === 'string' ? sourceRecord.mimeType : null,
    durationSeconds: finiteToolRunSessionNumber(sourceRecord.durationSeconds),
    previewUrl: typeof sourceRecord.previewUrl === 'string' ? sourceRecord.previewUrl : null,
    width: finiteToolRunSessionNumber(sourceRecord.width),
    height: finiteToolRunSessionNumber(sourceRecord.height),
    dimensionSource: sourceRecord.dimensionSource === 'source' || sourceRecord.dimensionSource === 'preview'
      ? sourceRecord.dimensionSource
      : undefined,
  })
}

function finiteToolRunSessionNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sanitizeToolRunSessionPreview(value: string | null | undefined) {
  if (!value || value.length > 90_000) return null
  return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null
}

const TOOL_RUN_SESSION_CAPABILITY_QUERY_KEYS = new Set([
  'auth',
  'authorization',
  'authorizationexpire',
  'exp',
  'expiration',
  'expires',
  'policy',
  'sig',
  'signature',
  'token',
  'x-amz-credential',
  'x-amz-expires',
  'x-amz-security-token',
  'x-amz-signature',
])

function sanitizeToolRunSessionUrl(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized.length > 8_000 || !/^https?:\/\//i.test(normalized)) return null
  const mediaDownloaderSource = normalizeMediaDownloaderSourceForSession(normalized)
  if (mediaDownloaderSource) return mediaDownloaderSource
  try {
    const url = new URL(normalized)
    if (url.username || url.password) return null
    const hasCapability = [...url.searchParams.keys()].some((key) => (
      TOOL_RUN_SESSION_CAPABILITY_QUERY_KEYS.has(key.toLowerCase())
    ))
    if (hasCapability) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function cacheToolOutputPrompts(entries: Array<{ url: string; prompt: string }>) {
  if (typeof window === 'undefined' || entries.length === 0) return
  const now = Date.now()
  const cache = readToolOutputPromptCache()

  entries.forEach((entry) => {
    const prompt = entry.prompt.trim()
    if (!prompt) return
    getToolOutputPromptCacheKeys(entry.url).forEach((key) => {
      cache[key] = { prompt, updatedAt: now }
    })
  })

  const prunedEntries = Object.entries(cache)
    .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
    .slice(0, TOOL_OUTPUT_PROMPT_CACHE_LIMIT)
  try {
    window.localStorage.setItem(TOOL_OUTPUT_PROMPT_CACHE_KEY, JSON.stringify(Object.fromEntries(prunedEntries)))
  } catch {
    // Prompt cache is a UX enhancement only; storage failures should not affect generation.
  }
}

function getCachedToolOutputPrompt(urls: Array<string | null | undefined>) {
  if (typeof window === 'undefined') return null
  const cache = readToolOutputPromptCache()
  for (const url of urls) {
    for (const key of getToolOutputPromptCacheKeys(url)) {
      const cachedPrompt = cache[key]?.prompt?.trim()
      if (cachedPrompt) return cachedPrompt
    }
  }
  return null
}

function readToolOutputPromptCache(): Record<string, { prompt: string; updatedAt: number }> {
  if (typeof window === 'undefined') return {}
  try {
    const rawCache = window.localStorage.getItem(TOOL_OUTPUT_PROMPT_CACHE_KEY)
    if (!rawCache) return {}
    const parsedCache = JSON.parse(rawCache)
    if (!parsedCache || typeof parsedCache !== 'object' || Array.isArray(parsedCache)) return {}
    const cache: Record<string, { prompt: string; updatedAt: number }> = {}
    let removedUnsafeKey = false
    Object.entries(parsedCache as Record<string, unknown>).forEach(([key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return
      const record = value as Record<string, unknown>
      const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : ''
      const updatedAt = typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : 0
      const normalizedKey = normalizeToolOutputPromptCacheKey(key)
      if (key && key === normalizedKey && prompt) {
        cache[key] = { prompt, updatedAt }
      } else if (key !== normalizedKey) {
        removedUnsafeKey = true
      }
    })
    if (removedUnsafeKey) {
      window.localStorage.setItem(TOOL_OUTPUT_PROMPT_CACHE_KEY, JSON.stringify(cache))
    }
    return cache
  } catch {
    return {}
  }
}

function getToolOutputPromptCacheKeys(value: string | null | undefined) {
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return []
  const normalizedKey = normalizeToolOutputPromptCacheKey(value)
  return normalizedKey ? [normalizedKey] : []
}

function normalizeToolOutputPromptCacheKey(value: string) {
  const storageObjectId = getStorageObjectIdFromUri(value)
  if (storageObjectId) return `storage://${storageObjectId}`
  if (typeof window === 'undefined') return value
  try {
    const url = new URL(value, window.location.origin)
    url.searchParams.delete('yt_preview_retry')
    url.searchParams.delete('yt_gif_replay')
    if (/\/api\/storage\/download$/i.test(url.pathname)) {
      const params = new URLSearchParams()
      ;['channelId', 'objectId', 'fileName'].forEach((name) => {
        const param = url.searchParams.get(name)
        if (param) params.set(name, param)
      })
      const query = params.toString()
      return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`
    }
    return `${url.origin}${url.pathname}`
  } catch {
    return value
  }
}

function openOutputUrl(
  url: string | null,
  kind?: ToolOutputMediaKind,
  label?: string,
  options: {
    prompt?: string | null
    downloadUrl?: string | null
    replayable?: boolean
    taskDetails?: StorageInspectorTaskDetails
    metadata?: ToolOutputPreviewPayload['metadata']
  } = {},
) {
  if (!url) return
  const hasExplicitDownloadUrl = Object.prototype.hasOwnProperty.call(options, 'downloadUrl')
  window.dispatchEvent(new CustomEvent<ToolOutputPreviewPayload>(TOOL_OUTPUT_PREVIEW_EVENT, {
    detail: {
      url,
      kind: kind ?? inferOutputKindFromUrl(url),
      label,
      prompt: options.prompt?.trim() ? options.prompt.trim() : undefined,
      downloadUrl: hasExplicitDownloadUrl ? options.downloadUrl ?? null : url,
      replayable: options.replayable,
      taskDetails: options.taskDetails,
      metadata: options.metadata,
    },
  }))
}

function downloadOutputUrl(url: string | null) {
  if (!url) return
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = ''
  anchor.rel = 'noopener noreferrer'
  if (!url.startsWith('/api/storage/download?')) anchor.target = '_blank'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function isInspectorSidePanelSuppressedTool(toolId: string | null | undefined) {
  const token = (toolId ?? '').trim().toLowerCase()
  return token.includes('research')
}

function getStorageObjectIdFromToolOutputUrl(url: string | null | undefined) {
  if (!url) return null
  try {
    const parsed = new URL(url, typeof window === 'undefined' ? 'https://youtorch.local' : window.location.origin)
    return parsed.searchParams.get('objectId')
  } catch {
    return null
  }
}

function inferOutputKindFromUrl(url: string): ToolOutputMediaKind {
  if (isEmbeddableVideoUrl(url)) return 'video'
  const cleanUrl = url.split('?')[0]?.split('#')[0]?.toLowerCase() ?? ''
  if (/\.(mp3|wav|m4a|aac|flac|opus|oga|ogg)$/.test(cleanUrl)) return 'audio'
  return /\.(mp4|m4v|mov|webm|avi|mkv)$/.test(cleanUrl) ? 'video' : 'image'
}

function isEmbeddableVideoUrl(value: string) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    return (host === 'video.bunnycdn.com' && path.includes('/play/'))
      || (host === 'iframe.mediadelivery.net' && path.includes('/embed/'))
      || (host === 'player.mediadelivery.net' && path.includes('/embed/'))
  } catch {
    return false
  }
}

function isSignedEmbeddableVideoUrl(value: string) {
  if (!isEmbeddableVideoUrl(value)) return false
  try {
    const parsed = new URL(value)
    return Boolean(parsed.searchParams.get('token') && parsed.searchParams.get('expires'))
  } catch {
    return false
  }
}

function getRecentWorkflowOutputKind(modelKind: ToolConfig['modelKind']) {
  if (modelKind === 'voice') return 'audio'
  if (modelKind === 'image' || modelKind === 'video') return modelKind
  return null
}

function getToolRecentWorkflowOutputKind(
  tool: ToolConfig,
  inputContract?: Pick<DiscoveryToolCatalogItem['input_contract'], 'artifact_output_type'>,
) {
  const declaredMediaKinds = new Set((inputContract?.artifact_output_type ?? '').toLowerCase()
    .split(/[,|\s]+/).filter((kind) => ['image', 'video', 'audio'].includes(kind)))
  if (declaredMediaKinds.size > 1) return null
  // Downloader batches can contain both video and audio variants.
  if (isMediaDownloaderToolConfig(tool)) return null
  const fallbackKind = getToolOutputFallbackKind(tool)
  return fallbackKind === 'image' || fallbackKind === 'video' || fallbackKind === 'audio'
    ? fallbackKind
    : getRecentWorkflowOutputKind(tool.modelKind)
}

function getRecentWorkflowNodeType(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  executionNodeType: string,
) {
  return isMagicClipsTool(tool, inputContract) ? 'clip_manifest@1' : executionNodeType
}

function getToolWorkflowOutputView(
  item: RecentWorkflowOutputItem,
  fallbackKind: ToolConfig['modelKind'],
): ToolWorkflowOutputView {
  const media = getToolWorkflowPrimaryMedia(item, fallbackKind)
  const kind = getToolWorkflowOutputKind(item, media, fallbackKind)
  const workflowStatusTone = getToolWorkflowStatusTone(item.status)
  const mediaUrl = media?.url && isUsableOutputUrl(media.url) ? media.url : null
  const storageBacked = Boolean(media?.storageObjectId?.trim())
  const storageReadiness = storageBacked ? getStoragePresentationReadiness(media) : null
  const statusTone: ToolOutputStatusTone = workflowStatusTone === 'failed'
    || storageReadiness === 'unavailable'
    ? 'failed'
    : workflowStatusTone === 'ready' && storageReadiness === 'processing'
      ? 'processing'
      : workflowStatusTone
  const previewUrl = media?.previewUrl && isUsableOutputUrl(media.previewUrl)
    ? media.previewUrl
    : storageBacked ? null : mediaUrl
  const downloadUrl = media?.downloadUrl && isUsableOutputUrl(media.downloadUrl)
    ? media.downloadUrl
    : storageBacked ? null : mediaUrl
  const storageUri = media?.storageObjectId ? `storage://${media.storageObjectId}` : null
  const prompt = item.prompt?.trim() || getCachedToolOutputPrompt([storageUri, mediaUrl, previewUrl, downloadUrl])
  const label = media?.fileName?.trim()
    || prompt
    || (kind === 'video'
      ? 'Generated video'
      : kind === 'audio'
        ? item.nodeType.toLowerCase().startsWith('voice_clone') ? 'Voice profile' : 'Generated speech'
        : 'Generated image')

  return {
    item,
    kind,
    label,
    prompt,
    modelLabel: formatPublicModelLabel(item.modelLabel ?? item.modelId, formatModelKindLabel(fallbackKind)),
    provider: item.provider?.trim() ? formatProviderName(item.provider) : 'Youtorch',
    createdAt: item.completedAt ?? item.createdAt ?? item.updatedAt ?? '',
    statusLabel: getToolWorkflowStatusLabel(item.status, statusTone, {
      outputPending: storageReadiness === 'processing',
    }),
    statusTone,
    failureMessage: statusTone === 'failed'
      ? item.errorMessage?.trim()
        || (storageReadiness === 'unavailable' ? 'The generated media is unavailable in Storage.' : null)
      : null,
    mediaUrl,
    previewUrl,
    downloadUrl,
    storageObjectId: media?.storageObjectId ?? null,
    displayStorageObjectId: getRecentGifPreviewStorageObjectId(item),
    fileName: media?.fileName ?? null,
    canDownload: Boolean(
      downloadUrl && statusTone === 'ready' && !isEmbeddableVideoUrl(downloadUrl),
    ),
    detail: formatToolWorkflowCreditDetail(item, statusTone),
    identifier: getToolWorkflowOutputIdentifier(item) ?? undefined,
  }
}

function hasPendingRecentWorkflowStoragePublication(
  item: Pick<RecentWorkflowOutputItem, 'media'>,
) {
  return item.media.some((media) => (
    Boolean(media.storageObjectId?.trim())
    && getStoragePresentationReadiness(media) === 'processing'
  ))
}

function isRecentWorkflowOutputReadyForRunHandoff(
  item: RecentWorkflowOutputItem,
  requiredMediaKind: ToolOutputMediaKind | null = null,
) {
  if (item.deliveryStatus === 'payment_review') return false
  if (shouldPollAgentStatus(item.status) || hasPendingRecentWorkflowStoragePublication(item)) return false
  const normalizedStatus = item.status.trim().toLowerCase()
  if (isFailedRunStatus(normalizedStatus) || normalizedStatus === 'insufficient_balance') return true
  if (
    item.nodeType.trim().toLowerCase().split('@', 1)[0] === 'clip_manifest'
    && canReadAgentOutput(item.status)
    && isExplicitMagicClipsCompletedEmpty(item.outputPreview)
  ) return true
  if (isTranscriptNodeType(item.nodeType)) {
    return getRecentWorkflowTranscriptOutput(item) !== null
  }
  if (isMediaDownloaderNodeType(item.nodeType)) {
    return getMediaDownloaderHistoryTiles(item).length > 0
  }
  if (isResearchAgentNodeType(item.nodeType)) {
    return getRecentWorkflowTextOutput(item) !== null
  }
  return !isRecentWorkflowMediaProjectionPending(item, requiredMediaKind)
}

function mergeRecentWorkflowOutputFirstPage(
  current: InfiniteData<RecentWorkflowOutputsResult, string | null> | undefined,
  firstPage: RecentWorkflowOutputsResult,
): InfiniteData<RecentWorkflowOutputsResult, string | null> {
  if (!current?.pages.length || !firstPage.hasMore) {
    return { pages: [firstPage], pageParams: [null] }
  }

  const seenOutputIds = new Set(firstPage.items.map((item) => item.id))
  const pages: RecentWorkflowOutputsResult[] = [firstPage]
  const pageParams: Array<string | null> = [null]
  const oldFirstPageExtras = current.pages[0]!.items.filter((item) => {
    if (seenOutputIds.has(item.id)) return false
    seenOutputIds.add(item.id)
    return true
  })

  for (let index = 1; index < current.pages.length; index += 1) {
    const page = current.pages[index]!
    const filtered = page.items.filter((item) => {
      if (seenOutputIds.has(item.id)) return false
      seenOutputIds.add(item.id)
      return true
    })
    const items = index === 1 ? [...oldFirstPageExtras, ...filtered] : filtered
    if (items.length === 0) continue
    pages.push({ ...page, items })
    pageParams.push(current.pageParams[index] ?? null)
  }

  if (pages.length === 1 && oldFirstPageExtras.length > 0) {
    const previousTail = current.pages[current.pages.length - 1]!
    pages.push({
      items: oldFirstPageExtras,
      nextCursor: previousTail.nextCursor,
      hasMore: previousTail.hasMore,
      limit: previousTail.limit,
    })
    pageParams.push(current.pageParams[current.pageParams.length - 1] ?? firstPage.nextCursor)
  }

  return { pages, pageParams }
}

function hasUsableRecentWorkflowSnapshot(
  enabled: boolean,
  isFetched: boolean,
  hasError: boolean,
) {
  return !enabled || isFetched || hasError
}

function isRecentWorkflowMediaProjectionPending(
  item: Pick<RecentWorkflowOutputItem, 'status' | 'media'>,
  requiredMediaKind: ToolOutputMediaKind | null,
) {
  if (!requiredMediaKind || !canReadAgentOutput(item.status)) return false
  return !item.media.some((media) => (
    getRecentWorkflowMediaKind(
      media.kind,
      media.mimeType,
      media.url,
      requiredMediaKind === 'audio' ? 'voice' : requiredMediaKind,
    ) === requiredMediaKind
    && (
      isUsableOutputUrl(media.url)
      || isUsableOutputUrl(media.previewUrl)
      || isUsableOutputUrl(media.downloadUrl)
      || Boolean(media.storageObjectId?.trim())
    )
  ))
}

function getToolWorkflowPrimaryMedia(
  item: RecentWorkflowOutputItem,
  fallbackKind: ToolConfig['modelKind'],
) {
  const targetKind = fallbackKind === 'voice'
    ? 'audio'
    : fallbackKind === 'video' || fallbackKind === 'image'
      ? fallbackKind
      : null
  const candidates = item.media.filter((media) => (
    isUsableOutputUrl(media.url)
    || isUsableOutputUrl(media.previewUrl)
    || Boolean(media.storageObjectId?.trim())
  ))
  if (targetKind) {
    const matching = candidates.find((media) => getRecentWorkflowMediaKind(media.kind, media.mimeType, media.url, fallbackKind) === targetKind)
    if (matching) return matching
  }
  return candidates.find((media) => {
    const kind = getRecentWorkflowMediaKind(media.kind, media.mimeType, media.url, fallbackKind)
    return kind === 'image' || kind === 'video' || kind === 'audio'
  }) ?? null
}

function getToolWorkflowOutputKind(
  item: RecentWorkflowOutputItem,
  media: ReturnType<typeof getToolWorkflowPrimaryMedia>,
  fallbackKind: ToolConfig['modelKind'],
): ToolOutputMediaKind {
  if (media) return getRecentWorkflowMediaKind(media.kind, media.mimeType, media.url, fallbackKind)
  if (fallbackKind === 'video') return 'video'
  if (fallbackKind === 'image') return 'image'
  if (fallbackKind === 'voice') return 'audio'
  const nodeType = item.nodeType.toLowerCase()
  if (nodeType.includes('speech') || nodeType.includes('voice') || nodeType.includes('audio')) return 'audio'
  return nodeType.includes('video') ? 'video' : 'image'
}

function getRecentWorkflowMediaKind(
  kind: string | null | undefined,
  mimeType: string | null | undefined,
  url: string | null | undefined,
  fallbackKind: ToolConfig['modelKind'],
): ToolOutputMediaKind {
  const normalizedKind = kind?.toLowerCase()
  if (normalizedKind === 'video') return 'video'
  if (normalizedKind === 'image') return 'image'
  if (normalizedKind === 'audio') return 'audio'
  const normalizedMime = mimeType?.toLowerCase() ?? ''
  if (normalizedMime.startsWith('video/')) return 'video'
  if (normalizedMime.startsWith('image/')) return 'image'
  if (normalizedMime.startsWith('audio/')) return 'audio'
  if (url && isEmbeddableVideoUrl(url)) return 'video'
  const path = (url ?? '').split('?', 1)[0]!.toLowerCase()
  if (['.mp3', '.wav', '.m4a', '.aac', '.flac', '.opus', '.oga', '.ogg'].some((extension) => path.endsWith(extension))) return 'audio'
  if (['.mp4', '.mov', '.webm', '.m4v'].some((extension) => path.endsWith(extension))) return 'video'
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'].some((extension) => path.endsWith(extension))) return 'image'
  if (fallbackKind === 'voice') return 'audio'
  return fallbackKind === 'video' ? 'video' : 'image'
}

function getToolWorkflowStatusTone(status: string | null | undefined): ToolOutputStatusTone {
  if (canReadAgentOutput(status)) return 'ready'
  if (isFailedRunStatus(status) || status?.toLowerCase() === 'insufficient_balance') return 'failed'
  return 'processing'
}

function getToolWorkflowStatusLabel(
  status: string | null | undefined,
  tone: ToolOutputStatusTone,
  options: RunProgressStatusOptions = {},
) {
  const progressLabel = getRunProgressStatusLabel(status, options)
  if (tone === 'failed') return 'Failed'
  if (tone === 'ready') return 'Success'
  return progressLabel
}

function formatToolWorkflowCreditDetail(item: RecentWorkflowOutputItem, tone: ToolOutputStatusTone) {
  const chargedCredits = item.nodeCreditsCharged || item.totalCreditsCharged
  if (chargedCredits > 0) return formatCreditLabel(chargedCredits)
  // Recent output is only public after billing_committed=true, so a successful
  // zero is an actual cache hit/no-charge result. Previously this incorrectly
  // fell back to the estimate and displayed "1 credit" as if it were spent.
  if (tone === 'ready') return '0 credits'
  if (tone === 'failed') return '0 credits'
  if (item.totalCreditsEstimated > 0) return `~${formatCreditLabel(item.totalCreditsEstimated)}`
  return undefined
}

function isUsableOutputUrl(value: string | null | undefined) {
  if (!value || value.startsWith('data:') || value.startsWith('blob:') || value.length > 8_000) {
    return false
  }
  return /^https?:\/\//i.test(value) || value.startsWith('/')
}

type TranscriptMediaDeliveryResolver = (input: {
  channelId: string
  objectId: string
  expiresInSeconds?: number
  variant?: 'original' | 'stream'
}) => Promise<{ url: string; variant: 'original' | 'stream'; expires_at?: string }>

type PlayerJsEventMessage = {
  event: string
  value?: unknown
  listener?: string
}

const inFlightCaptionDeliveryRequests = new Map<
  string,
  Promise<{ url: string; variant: 'original' | 'stream'; expires_at?: string }>
>()

function resolveSharedCaptionMediaDelivery(input: {
  channelId: string
  objectId: string
  expiresInSeconds: number
  variants?: ReadonlyArray<'original' | 'stream'>
}) {
  const variantKey = input.variants?.join(',') || 'original,stream'
  const key = `${input.channelId}:${input.objectId}:${input.expiresInSeconds}:${variantKey}`
  const existing = inFlightCaptionDeliveryRequests.get(key)
  if (existing) return existing

  const request = resolveCaptionMediaDelivery(input)
  inFlightCaptionDeliveryRequests.set(key, request)
  void request.finally(() => {
    if (inFlightCaptionDeliveryRequests.get(key) === request) {
      inFlightCaptionDeliveryRequests.delete(key)
    }
  }).catch(() => undefined)
  return request
}

async function resolveCaptionMediaDelivery(
  input: {
    channelId: string
    objectId: string
    expiresInSeconds: number
    variants?: ReadonlyArray<'original' | 'stream'>
  },
  resolveDelivery: TranscriptMediaDeliveryResolver = getStorageDeliveryUrl,
): Promise<{ url: string; variant: 'original' | 'stream'; expires_at?: string }> {
  let lastError: unknown = null
  const variants = input.variants?.length ? input.variants : ['original', 'stream'] as const

  for (const variant of variants) {
    try {
      const delivery = await resolveDelivery({
        channelId: input.channelId,
        objectId: input.objectId,
        expiresInSeconds: input.expiresInSeconds,
        variant,
      })
      if (!isHttpMediaUrl(delivery.url)) throw new Error('Storage returned an invalid media URL')
      if (delivery.variant === 'stream' && !isEmbeddableVideoUrl(delivery.url)) {
        throw new Error('Storage returned an unsupported stream player URL')
      }
      return { url: delivery.url, variant: delivery.variant, expires_at: delivery.expires_at }
    } catch (error) {
      if (variant === 'original' && isStorageDeliveryTemporarilyUnavailable(error)) throw error
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Captioned video delivery is unavailable')
}

function isStorageDeliveryTemporarilyUnavailable(error: unknown) {
  if (!isAuthClientError(error)) return false
  if (error.code === 'STORAGE_OBJECT_NOT_FOUND' || error.status === 404) return true
  if (error.code !== 'STORAGE_DELIVERY_NOT_READY') return false
  const details = error.details
  const status = details && typeof details === 'object' && 'status' in details
    ? String((details as { status: unknown }).status)
    : ''
  return status === 'malware_scan_pending'
    || status === 'upload_incomplete'
    || status === 'checksum_missing'
    || status === 'playback_processing'
    || status === 'pending'
    || status === 'processing'
}

async function resolveTranscriptMediaDelivery(
  input: {
    channelId: string
    objectId: string
    expiresInSeconds: number
    audioOnly: boolean
    preferOriginal?: boolean
  },
  resolveDelivery: TranscriptMediaDeliveryResolver = getStorageDeliveryUrl,
): Promise<Pick<TranscriptMediaDelivery, 'url' | 'variant'> & { expires_at?: string }> {
  const variants: Array<'original' | 'stream'> = input.audioOnly
    ? ['original']
    : input.preferOriginal
      ? ['original', 'stream']
      : ['stream', 'original']
  let lastError: unknown = null

  for (const variant of variants) {
    try {
      const delivery = await resolveDelivery({
        channelId: input.channelId,
        objectId: input.objectId,
        expiresInSeconds: input.expiresInSeconds,
        variant,
      })
      if (!isHttpMediaUrl(delivery.url)) throw new Error('Storage returned an invalid media URL')
      if (delivery.variant === 'stream' && !isEmbeddableVideoUrl(delivery.url)) {
        throw new Error('Storage returned an unsupported stream player URL')
      }
      return { url: delivery.url, variant: delivery.variant, expires_at: delivery.expires_at }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Media delivery is unavailable')
}

async function resolveToolStorageOutputDelivery(
  input: {
    channelId: string
    objectId: string
    expiresInSeconds: number
    kind: ToolOutputMediaKind
  },
  resolveDelivery: TranscriptMediaDeliveryResolver = getStorageDeliveryUrl,
): Promise<{ url: string; variant: 'original' | 'stream'; expires_at?: string }> {
  if (input.kind === 'video') {
    const delivery = await resolveDelivery({
      channelId: input.channelId,
      objectId: input.objectId,
      expiresInSeconds: input.expiresInSeconds,
    })
    if (!isHttpMediaUrl(delivery.url)) {
      throw new Error('Storage returned an invalid output video URL')
    }
    if (delivery.variant === 'stream' && !isSignedEmbeddableVideoUrl(delivery.url)) {
      throw new Error('Storage returned an invalid signed output stream URL')
    }
    return { url: delivery.url, variant: delivery.variant, expires_at: delivery.expires_at }
  }

  const delivery = await resolveDelivery({
    channelId: input.channelId,
    objectId: input.objectId,
    expiresInSeconds: input.expiresInSeconds,
    variant: 'original',
  })
  if (!isHttpMediaUrl(delivery.url)) throw new Error('Storage returned an invalid media URL')
  return { url: delivery.url, variant: delivery.variant, expires_at: delivery.expires_at }
}

function isHttpMediaUrl(value: string) {
  if (!isUsableOutputUrl(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function addPlayerInstanceToUrl(value: string, instanceId: string) {
  try {
    const url = new URL(value)
    const safeInstanceId = instanceId.replace(/[^a-zA-Z0-9_-]/g, '') || 'transcript'
    url.searchParams.set('youtorch_player', safeInstanceId)
    url.searchParams.set('autoplay', 'false')
    url.searchParams.set('preload', 'true')
    url.searchParams.set('rememberPosition', 'false')
    url.searchParams.set('compactControls', 'true')
    return url.toString()
  } catch {
    return value
  }
}

function getUrlOrigin(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

function parsePlayerJsMessage(value: unknown): PlayerJsEventMessage | null {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }

  const message = getPortRecord(parsed)
  if (message.context !== 'player.js' || typeof message.event !== 'string' || !message.event.trim()) {
    return null
  }
  const listener = typeof message.listener === 'string' && message.listener.trim()
    ? message.listener
    : undefined
  return {
    event: message.event,
    value: message.value !== undefined ? message.value : message.data,
    ...(listener ? { listener } : {}),
  }
}

function getPlayerJsEventSeconds(value: unknown) {
  const directValue = getFiniteNumber(value)
  if (directValue !== null) return directValue >= 0 ? directValue : null

  const payload = getPortRecord(value)
  for (const key of ['seconds', 'currentTime', 'current_time']) {
    const seconds = getFiniteNumber(payload[key])
    if (seconds !== null && seconds >= 0) return seconds
  }
  return null
}

function getPlayableStorageMediaPreviewUrl(value: string | null | undefined) {
  if (!value || value.length > 8_000) return null
  if (/^data:(audio|video)\//i.test(value)) return value
  if (/^blob:/i.test(value)) return value
  try {
    const pathname = new URL(value, 'https://local.youtorch.io').pathname.toLowerCase()
    return /\.(aac|flac|m4a|mkv|mov|mp3|mp4|mpeg|mpg|ogg|opus|wav|webm)$/i.test(pathname)
      ? value
      : null
  } catch {
    return null
  }
}

function openToolShortcut(toolId: ToolId, sourceUrl: string) {
  const params = new URLSearchParams({ tool: toolId, source_url: sourceUrl })
  window.location.assign(`/tools?${params.toString()}`)
}

function getToolId(value: string | null): ToolId | null {
  const normalized = value?.trim()
  if (!normalized) return null
  return normalized === 'viral-shorts' || normalized === 'magic-clips'
    ? 'viral-clips'
    : normalized
}

function getCatalogViewId(value: string | null): CatalogViewId | null {
  if (value && catalogViews.some((view) => view.id === value)) return value as CatalogViewId
  return null
}

function getCatalogToolIds(catalog?: DiscoveryToolsCatalog) {
  if (!catalog) return []

  const seen = new Set<string>()
  return catalog.tools
    .filter((tool) => tool.status !== 'disabled')
    .map((tool) => ({ tool, toolId: tool.tool_id.trim() }))
    .filter(({ toolId }) => {
      if (!toolId || seen.has(toolId)) return false
      seen.add(toolId)
      return true
    })
    .sort((left, right) => {
      const orderDelta = left.tool.ui.sort_order - right.tool.ui.sort_order
      if (orderDelta !== 0) return orderDelta
      return left.tool.title.localeCompare(right.tool.title)
    })
    .map(({ toolId }) => toolId)
}

function getWorkflowTemplateCards(catalog?: DiscoveryToolsCatalog): WorkflowTemplateCard[] {
  const configured = (catalog?.workflow_templates ?? [])
    .flatMap((template): WorkflowTemplateCard[] => {
      const toolId = template.tool_id?.trim()
      if (!toolId) return []
      const discoveryTool = getDiscoveryTool(catalog, toolId)
      if (!discoveryTool || discoveryTool.status === 'disabled') return []
      return [{
        templateKey: template.template_key || template.title || toolId,
        title: template.title || template.template_key,
        category: toWorkflowTemplateCategory(template.category),
        description: template.description,
        steps: template.steps,
        examples: template.examples,
        estimatedCost: template.estimated_cost_label ?? 'Estimate varies',
        nodes: template.nodes,
        toolId,
        tone: template.tone ?? 'from-[#55d6a5] via-[#19a979] to-[#0c5f49]',
        coverType: template.cover_type === 'video' || template.preview_video_url ? 'video' : 'image',
        ...(template.foreground_image_url ? { foregroundImage: template.foreground_image_url } : {}),
        ...(template.preview_video_url ? { previewVideo: template.preview_video_url } : {}),
      }]
    })

  return configured.length > 0 ? configured : workflowSpotlightCards
}

function toWorkflowTemplateCategory(value: string): WorkflowTemplateCategory {
  if (value === 'Top picks' || value === 'Faceless videos' || value === 'Repurpose' || value === 'Commerce') return value
  return 'Top picks'
}

function getCatalogSections(catalog: DiscoveryToolsCatalog | undefined, view: CatalogViewId): CatalogSection[] {
  if (!catalog) return []

  const activeToolIds = new Set(catalog.tools
    .filter((tool) => tool.status !== 'disabled')
    .map((tool) => tool.tool_id.trim())
    .filter(Boolean))
  const configuredSections = (catalog.sections ?? [])
    .filter((section) => isCatalogSectionForView(section.view_key, view))
    .filter((section) => !isCatalogSectionExpired(section.metadata))
    .filter((section) => !isHeroOnlyCatalogSection(section.metadata))
    .filter((section) => section.items.some((item) => item.item_type === 'tool' && activeToolIds.has(item.item_key)))
    .sort((left, right) => left.sort_order - right.sort_order || left.section_key.localeCompare(right.section_key))
    .map((section) => ({
      id: section.section_key,
      title: section.title || section.section_key,
      subtitle: section.subtitle ?? '',
      toolIds: uniqueCompact(section.items
        .filter((item) => item.item_type === 'tool' && activeToolIds.has(item.item_key))
        .sort((left, right) => left.sort_order - right.sort_order || left.item_key.localeCompare(right.item_key))
        .map((item) => item.item_key)),
    }))

  if (configuredSections.length > 0) return configuredSections
  if (view !== 'trends') return []

  const activeTools = catalog.tools
    .filter((tool) => tool.status !== 'disabled')
    .map((tool) => ({ tool, toolId: tool.tool_id.trim() }))
    .filter(({ toolId }) => Boolean(toolId))
    .sort((left, right) => {
      const orderDelta = left.tool.ui.sort_order - right.tool.ui.sort_order
      if (orderDelta !== 0) return orderDelta
      return left.tool.title.localeCompare(right.tool.title)
    })

  const sections: CatalogSection[] = []
  const featuredToolIds = uniqueCompact(activeTools
    .filter(({ tool }) => tool.ui.featured)
    .map(({ toolId }) => toolId))

  if (featuredToolIds.length > 0) {
    sections.push({
      id: 'featured',
      title: 'Featured',
      subtitle: 'En cok kullanilan araclar.',
      toolIds: featuredToolIds,
    })
  }

  const byCategory = new Map<string, { order: number; toolIds: ToolId[] }>()
  activeTools.forEach(({ tool, toolId }) => {
    const title = normalizeCatalogCategory(tool.category, tool.model_kind)
    const current = byCategory.get(title) ?? { order: tool.ui.sort_order, toolIds: [] }
    current.order = Math.min(current.order, tool.ui.sort_order)
    if (!current.toolIds.includes(toolId)) current.toolIds.push(toolId)
    byCategory.set(title, current)
  })

  Array.from(byCategory.entries())
    .sort((left, right) => {
      const orderDelta = left[1].order - right[1].order
      if (orderDelta !== 0) return orderDelta
      return left[0].localeCompare(right[0])
    })
    .forEach(([title, group]) => {
      sections.push({
        id: `category-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        subtitle: `${title} araclari.`,
        toolIds: group.toolIds,
      })
    })

  return sections
}

function getCatalogHeroSlides(catalog: DiscoveryToolsCatalog | undefined, view: CatalogViewId): CatalogHeroSlide[] {
  if (!catalog) return []

  return (catalog.sections ?? [])
    .filter((section) => isCatalogSectionForView(section.view_key, view))
    .filter((section) => !isCatalogSectionExpired(section.metadata))
    .map((section) => {
      const media = readCatalogSectionMedia(section.metadata)
      if (!media) return null
      return {
        ...media,
        id: section.section_key,
        title: section.title || section.section_key,
        subtitle: section.subtitle ?? '',
        sortOrder: section.sort_order,
      }
    })
    .filter((slide): slide is CatalogHeroSlide => slide !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
}

const defaultCatalogHeroMedia = [
  {
    key: 'create',
    url: '/auth/ai-video-workspace.png',
    alt: 'Youtorch AI video oluşturma çalışma alanı',
    transition: 'fade' as const,
  },
  {
    key: 'plan',
    url: '/auth/storyboard-timeline.png',
    alt: 'Youtorch storyboard ve timeline çalışma alanı',
    transition: 'zoom' as const,
  },
  {
    key: 'publish',
    url: '/auth/campaign-publishing.png',
    alt: 'Youtorch kampanya yayınlama çalışma alanı',
    transition: 'fade' as const,
  },
]

const defaultCatalogHeroCopy: Record<CatalogViewId, Array<{
  title: string
  subtitle: string
  badge: string
  ctaLabel: string
  ctaHref: string
}>> = {
  trends: [
    {
      title: 'AI ile üretime hemen başla.',
      subtitle: 'Görsel, video ve ses araçlarını tek çalışma alanında kullan.',
      badge: 'Youtorch Studio',
      ctaLabel: 'Video aracını aç',
      ctaHref: '/tools?tool=video',
    },
    {
      title: 'Bir fikri sahnelere dönüştür.',
      subtitle: 'Storyboard, timeline ve üretim adımlarını kesintisiz bir akışta planla.',
      badge: 'Akıllı üretim akışı',
      ctaLabel: 'Agent aracını aç',
      ctaHref: '/tools?tool=agent',
    },
    {
      title: 'İçeriğini yayına hazırla.',
      subtitle: 'Son dokunuşları tamamla, çıktıları kontrol et ve kampanyanı yayına taşı.',
      badge: 'Publish-ready',
      ctaLabel: 'AI polish aç',
      ctaHref: '/tools?tool=ai-polish',
    },
  ],
  models: [
    {
      title: 'İşin için doğru modeli seç.',
      subtitle: 'Görsel ve video üretim modellerini yeteneklerine göre karşılaştır.',
      badge: 'Model kataloğu',
      ctaLabel: 'Video modellerini aç',
      ctaHref: '/tools?tool=video',
    },
    {
      title: 'Model çıktısını akışa bağla.',
      subtitle: 'Üretimden düzenlemeye kadar aynı asset üzerinde çalışmaya devam et.',
      badge: 'Bağlantılı üretim',
      ctaLabel: 'Media Transform aç',
      ctaHref: '/tools?tool=media-transform',
    },
    {
      title: 'Tekrar kullanılabilir sonuçlar üret.',
      subtitle: 'Model çıktılarından sosyal formatlara uygun yeni içerikler hazırla.',
      badge: 'Çoklu format',
      ctaLabel: 'Viral Clips aç',
      ctaHref: '/tools?tool=viral-clips',
    },
  ],
  workflows: [
    {
      title: 'Brief’ten videoya tek akış.',
      subtitle: 'Fikri al, sahneleri planla ve üretimi hazır bir workflow ile başlat.',
      badge: 'Workflow',
      ctaLabel: 'Agent ile başla',
      ctaHref: '/tools?tool=agent',
    },
    {
      title: 'Storyboard ve timeline birlikte.',
      subtitle: 'Sahne sırasını, medyayı ve anlatım yapısını aynı üretim akışında yönet.',
      badge: 'Planla',
      ctaLabel: 'B-roll aracını aç',
      ctaHref: '/tools?tool=b-roll',
    },
    {
      title: 'Üret, kontrol et, yayınla.',
      subtitle: 'Son kalite dokunuşlarını tamamlayıp içeriği yayınlanabilir hale getir.',
      badge: 'Yayın akışı',
      ctaLabel: 'AI polish aç',
      ctaHref: '/tools?tool=ai-polish',
    },
  ],
}

function getEffectiveCatalogHeroSlides(
  catalog: DiscoveryToolsCatalog | undefined,
  view: CatalogViewId,
): CatalogHeroSlide[] {
  const managedSlides = getCatalogHeroSlides(catalog, view)
  if (managedSlides.length > 0) return managedSlides

  return defaultCatalogHeroMedia.map((media, index) => {
    const copy = defaultCatalogHeroCopy[view][index]!
    return {
      ...media,
      ...copy,
      id: `default-${view}-${media.key}`,
      kind: 'image' as const,
      fit: 'cover' as const,
      position: 'right' as const,
      durationMs: 6_500,
      scrimColor: '#121212',
      scrimOpacity: 92,
      sortOrder: index * 10,
    }
  })
}

function isCatalogSectionForView(value: string | null | undefined, view: CatalogViewId) {
  const normalized = catalogViews.some((item) => item.id === value) ? value : 'trends'
  return normalized === view
}

function isCatalogSectionExpired(metadata: Record<string, unknown>) {
  const expiresAt = readMetadataString(metadata, 'discovery_expires_at') ?? readMetadataString(metadata, 'expires_at')
  if (!expiresAt) return false
  const expiresAtMs = Date.parse(expiresAt)
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()
}

function isHeroOnlyCatalogSection(metadata: Record<string, unknown>) {
  const hasHeroMedia = Boolean(readMetadataString(metadata, 'discovery_media_url') ?? readMetadataString(metadata, 'media_url'))
  if (!hasHeroMedia) return false

  const showInShelves = readMetadataBoolean(metadata, 'discovery_show_in_shelves') ?? readMetadataBoolean(metadata, 'show_in_shelves')
  if (showInShelves !== null) return !showInShelves

  const heroOnly = readMetadataBoolean(metadata, 'discovery_hero_only') ?? readMetadataBoolean(metadata, 'hero_only')
  if (heroOnly !== null) return heroOnly

  return true
}

function getCatalogModelCards(catalog?: DiscoveryToolsCatalog): SpotlightModelCardData[] {
  if (!catalog) return []

  const cards = catalog.tools
    .filter((tool) => tool.status !== 'disabled')
    .flatMap((discoveryTool) => {
      const tool = getEffectiveToolConfig(discoveryTool.tool_id, discoveryTool)
      const meta = getEffectiveToolCatalogMeta(discoveryTool.tool_id, discoveryTool)
      return discoveryTool.models.map((model, index) => {
        const creditLabel = getModelCreditLabel(model)
        const badge = cleanCatalogToken(readModelVisibilityString(model.visibility, 'discovery_badge'))
        const spotlight = model.visibility.discovery_spotlight === true
          || model.visibility.discovery_latest === true
          || model.visibility.latest === true
        const sortOrder = readModelVisibilityNumber(model.visibility, 'discovery_sort_order') ?? index
        const description = cleanCatalogToken(model.description)
          ?? cleanCatalogToken(model.quality)
          ?? cleanCatalogToken(model.speed)
          ?? `${tool.shortTitle} model`

        return {
          id: `${discoveryTool.tool_id}:${model.id}`,
          name: publicModelLabel(model.label, 'Model'),
          provider: 'Youtorch',
          description,
          toolId: discoveryTool.tool_id,
          modelId: model.id,
          href: getToolHref(discoveryTool.tool_id, { modelId: model.id }),
          toolShortTitle: tool.shortTitle,
          badge,
          thumbnail: meta.thumbnail,
          tone: getCatalogModelTone(discoveryTool.model_kind),
          icon: tool.icon,
          iconBackground: meta.iconBackground,
          iconForeground: meta.iconForeground,
          iconShape: meta.iconShape,
          iconCss: meta.iconCss,
          iconAssetUrl: meta.iconAssetUrl,
          spotlight,
          sortOrder,
          tags: uniqueCompact([
            model.id,
            model.capability,
            model.quality,
            model.speed,
            creditLabel,
            discoveryTool.title,
            discoveryTool.short_title,
            discoveryTool.category,
            discoveryTool.execution.node_type,
          ]),
        }
      })
    })

  const spotlightCards = cards.filter((model) => model.spotlight)
  return (spotlightCards.length > 0 ? spotlightCards : cards)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
      return left.name.localeCompare(right.name)
    })
}

function getCatalogModelTone(modelKind: DiscoveryToolCatalogItem['model_kind']) {
  if (modelKind === 'image') return 'from-fuchsia-500/70 via-rose-400/30 to-black'
  if (modelKind === 'video') return 'from-blue-500/70 via-cyan-400/25 to-black'
  if (modelKind === 'voice') return 'from-teal-400/65 via-emerald-400/25 to-black'
  return 'from-emerald-400/60 via-sky-400/25 to-black'
}

function getDiscoveryTool(catalog: DiscoveryToolsCatalog | undefined, toolId: ToolId) {
  return catalog?.tools.find((tool) => tool.tool_id === toolId)
    ?? BUILT_IN_VIDEO_UTILITY_TOOLS[toolId]
}

const BUILT_IN_VIDEO_UTILITY_TOOLS: Partial<Record<ToolId, DiscoveryToolCatalogItem>> = {
  'video-to-gif': createBuiltInVideoUtilityTool({
    toolId: 'video-to-gif',
    nodeType: 'video_to_gif@1',
    title: 'Video to GIF',
    shortTitle: 'GIF',
    description: 'Turn a selected video range into a compact animated GIF.',
    badge: 'GIF',
    sortOrder: 31,
    schemaHash: 'builtin-video-to-gif-v1',
    defaults: {
      trim: { start_sec: 0, end_sec: DEFAULT_GIF_DURATION_SECONDS },
      fps: 10,
      width: 640,
      fit: 'contain',
      loop: 2,
      quality: 'standard',
    },
    inputSchema: {
      storage_object_id: builtInPort('storage_object_id', 'string', { required: true }),
      media_ref: builtInPort('media_ref', 'any'),
      trim: builtInPort('trim', 'dict', { default: { start_sec: 0, end_sec: DEFAULT_GIF_DURATION_SECONDS } }),
      fps: builtInPort('fps', 'float', { default: 10, min_value: 1, max_value: 30 }),
      width: builtInPort('width', 'integer', { default: 640, min_value: 64, max_value: 1920 }),
      height: builtInPort('height', 'integer', { min_value: 64, max_value: 1920 }),
      fit: builtInPort('fit', 'string', { default: 'contain', allowed_values: ['contain', 'cover', 'stretch'] }),
      loop: builtInPort('loop', 'integer', { default: 2, min_value: 0, max_value: 65_535 }),
      quality: builtInPort('quality', 'string', { default: 'standard', allowed_values: ['draft', 'high', 'standard'] }),
      duration_sec: builtInPort('duration_sec', 'float', { min_value: 0, max_value: 86_400 }),
    },
    outputSchema: {
      image_url: builtInPort('image_url', 'image'),
      storage_object_id: builtInPort('storage_object_id', 'string'),
      metadata: builtInPort('metadata', 'dict'),
    },
  }),
  'frame-extract': createBuiltInVideoUtilityTool({
    toolId: 'frame-extract',
    nodeType: 'frame_extract@1',
    title: 'Extract Frames',
    shortTitle: 'Frames',
    description: 'Extract first, last, timed, evenly spaced, or sampled images from a video.',
    badge: 'Frames',
    sortOrder: 32,
    schemaHash: 'builtin-frame-extract-v1',
    defaults: {
      mode: 'first',
      timestamps: [],
      count: 1,
      sampling_fps: 1,
      max_frames: 120,
      resize: {},
      output_format: 'jpg',
    },
    inputSchema: {
      storage_object_id: builtInPort('storage_object_id', 'string'),
      media_ref: builtInPort('media_ref', 'any'),
      mode: builtInPort('mode', 'string', {
        default: 'first',
        allowed_values: ['evenly_spaced', 'first', 'first_last', 'interval', 'last', 'sample_fps', 'timestamp', 'timestamps'],
      }),
      timestamp_sec: builtInPort('timestamp_sec', 'float', { min_value: 0, max_value: 86_400 }),
      timestamps: builtInPort('timestamps', 'list', { default: [] }),
      interval_sec: builtInPort('interval_sec', 'float', { min_value: 0.1, max_value: 86_400 }),
      count: builtInPort('count', 'integer', { default: 1, min_value: 1, max_value: 120 }),
      sampling_fps: builtInPort('sampling_fps', 'float', { default: 1, min_value: 0.01, max_value: 60 }),
      start_sec: builtInPort('start_sec', 'float', { min_value: 0, max_value: 86_400 }),
      end_sec: builtInPort('end_sec', 'float', { min_value: 0, max_value: 86_400 }),
      max_frames: builtInPort('max_frames', 'integer', { default: 120, min_value: 1, max_value: 120 }),
      duration_sec: builtInPort('duration_sec', 'float', { min_value: 0, max_value: 86_400 }),
      resize: builtInPort('resize', 'dict', { default: {} }),
      output_format: builtInPort('output_format', 'string', {
        default: 'jpg',
        allowed_values: ['jpeg', 'jpg', 'png', 'webp'],
      }),
    },
    outputSchema: {
      primary_image: builtInPort('primary_image', 'image'),
      frames: builtInPort('frames', 'list'),
    },
  }),
}

function builtInPort(
  name: string,
  type: string,
  options: Record<string, unknown> = {},
) {
  return { name, type, required: false, ...options }
}

function createBuiltInVideoUtilityTool(input: {
  toolId: string
  nodeType: string
  title: string
  shortTitle: string
  description: string
  badge: string
  sortOrder: number
  schemaHash: string
  defaults: Record<string, unknown>
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
}): DiscoveryToolCatalogItem {
  return {
    tool_id: input.toolId,
    title: input.title,
    short_title: input.shortTitle,
    description: input.description,
    category: 'Video',
    badge: input.badge,
    model_kind: 'image',
    status: 'active',
    maintenance: false,
    execution: {
      mode: 'agent_api',
      node_type: input.nodeType,
      agent_api_path: '/api/v1/workflows/agents/execute',
    },
    input_contract: {
      node_type: input.nodeType,
      schema_hash: input.schemaHash,
      pricing_hash: null,
      input_schema: input.inputSchema,
      form_contract: { standard_fields: {} },
      input_classification: {
        storage_object_id: 'tenant_storage_media',
        media_ref: 'tenant_storage_media',
      },
      output_schema: input.outputSchema,
      cost_estimate: { pricing_estimate_kind: 'runtime_metered' },
      pricing_metadata: { pricing_owner: 'workflow_engine' },
      provider_requirement: { capability: input.nodeType === 'video_to_gif@1' ? 'video.to_gif' : 'video.extract_frames' },
      artifact_output_type: 'image',
    },
    models: [],
    defaults: input.defaults,
    ui: {
      icon: 'clapperboard',
      accent: 'primary',
      icon_shape: '',
      icon_css: '',
      icon_asset_url: '',
      thumbnail: '/auth/ai-video-workspace.png',
      featured: false,
      is_new: false,
      sort_order: input.sortOrder,
      prompt_placeholder: 'Choose a source video and conversion settings...',
      upload_title: 'Source video',
      upload_description: 'MP4, MOV, WEBM from Storage',
    },
  }
}

function getDiscoveryModel(discoveryTool: DiscoveryToolCatalogItem | undefined, modelId: string | undefined) {
  if (!discoveryTool || !modelId) return undefined
  const capability = getToolRegistryCapability(discoveryTool)
  return discoveryTool.models.find((model) => model.id === modelId && (!capability || model.capability === capability))
}

function getEffectiveToolConfig(toolId: ToolId, discoveryTool: DiscoveryToolCatalogItem): ToolConfig {
  const magicClipsTool = isMagicClipsDiscoveryTool(discoveryTool)
  const modelKind = magicClipsTool ? 'video' : discoveryTool.model_kind
  const title = cleanCatalogToken(discoveryTool.title) ?? formatToolIdLabel(toolId)
  const shortTitle = cleanCatalogToken(discoveryTool.short_title) ?? title
  const description = cleanCatalogToken(discoveryTool.description) ?? 'AI tool'
  const promptPlaceholder = cleanCatalogToken(discoveryTool.ui.prompt_placeholder)
    ?? 'Describe the result you want...'

  return {
    id: toolId,
    title,
    shortTitle,
    description,
    badge: magicClipsTool
      ? 'Viral Clips'
      : cleanCatalogToken(discoveryTool.badge) ?? formatModelKindLabel(modelKind),
    icon: magicClipsTool ? Clapperboard : getCatalogIcon(discoveryTool),
    accentClassName: getCatalogAccentClassName(discoveryTool),
    modes: [],
    prompt: '',
    promptPlaceholder,
    uploadTitle: cleanCatalogToken(discoveryTool.ui.upload_title) ?? 'Source',
    uploadDescription: cleanCatalogToken(discoveryTool.ui.upload_description) ?? 'Upload supported media',
    outputTitle: `${title} output`,
    outputMeta: '',
    outputImage: magicClipsTool
      ? getDefaultToolOutputImage('video')
      : normalizeCatalogAssetUrl(discoveryTool.ui.thumbnail) || getDefaultToolOutputImage(modelKind),
    outputVideoUrl: undefined,
    modelKind,
  }
}

function getEffectiveToolCatalogMeta(_toolId: ToolId, discoveryTool: DiscoveryToolCatalogItem): ToolCatalogMeta {
  const magicClipsTool = isMagicClipsDiscoveryTool(discoveryTool)
  const modelKind = magicClipsTool ? 'video' : discoveryTool.model_kind
  const category = magicClipsTool ? 'Video' : normalizeCatalogCategory(discoveryTool.category, modelKind)
  const modelLabels = discoveryTool.models.map((model) => publicModelLabel(model.label)).filter(Boolean)

  return {
    category,
    creator: 'Youtorch',
    description: cleanCatalogToken(discoveryTool.description) ?? 'AI tool',
    thumbnail: getNewThemeToolThumbnail(discoveryTool),
    iconBackground: getCatalogIconBackground(discoveryTool),
    iconForeground: getCatalogIconForeground(discoveryTool),
    iconShape: cleanCatalogToken(discoveryTool.ui.icon_shape) ?? 'auto',
    iconCss: cleanCatalogToken(discoveryTool.ui.icon_css) ?? '',
    iconAssetUrl: normalizeCatalogAssetUrl(discoveryTool.ui.icon_asset_url),
    models: modelLabels,
    tags: uniqueCompact([
      discoveryTool.execution.node_type,
      modelKind,
      discoveryTool.category,
    ]),
    featured: discoveryTool.ui.featured,
    isNew: discoveryTool.ui.is_new,
  }
}

function getNewThemeToolThumbnail(discoveryTool: DiscoveryToolCatalogItem) {
  const token = `${discoveryTool.tool_id} ${discoveryTool.title} ${discoveryTool.category} ${discoveryTool.model_kind}`.toLowerCase()
  if (token.includes('video') || token.includes('magic') || token.includes('clip')) return '/tools/video-module.png'
  if (token.includes('image') || token.includes('caption') || token.includes('prompt')) return '/tools/image-module.png'
  return '/tools/media-module.png'
}

function getCatalogIcon(discoveryTool?: DiscoveryToolCatalogItem): LucideIcon {
  const token = `${discoveryTool?.ui.icon ?? ''} ${discoveryTool?.tool_id ?? ''} ${discoveryTool?.title ?? ''} ${discoveryTool?.model_kind ?? ''} ${discoveryTool?.category ?? ''}`.toLowerCase()
  if (token.includes('magic') || token.includes('clip')) return Clapperboard
  if (token.includes('gif')) return FileVideo
  if (token.includes('frame')) return Frame
  if (token.includes('download')) return Download
  if (token.includes('brand') || token.includes('overlay')) return Stamp
  if (token.includes('caption')) return Captions
  if (token.includes('transcript') || token.includes('transcribe')) return FileText
  if (token.includes('voice clone')) return Mic
  if (token.includes('speech') || token.includes('tts')) return Volume2
  if (token.includes('research') || token.includes('agent')) return Bot
  if (token.includes('prompt generate')) return Sparkles
  if (token.includes('prompt') || token.includes('enhance')) return Wand2
  if (token.includes('transform')) return Shuffle
  if (token.includes('upload')) return Upload
  if (token.includes('image')) return ImageIcon
  if (token.includes('video') || token.includes('clapper')) return Video
  if (token.includes('crop') || token.includes('transform')) return Crop
  if (token.includes('workflow') || token.includes('flow')) return WorkflowIcon
  if (token.includes('text') || token.includes('prompt')) return Type
  if (token.includes('spark') || token.includes('enhance') || token.includes('magic')) return Sparkles
  if (token.includes('voice') || token.includes('audio') || token.includes('mic')) return Mic2
  if (token.includes('agent') || token.includes('bot')) return Bot
  return WandSparkles
}

function getCatalogAccentClassName(discoveryTool?: DiscoveryToolCatalogItem) {
  const accent = cleanCatalogToken(discoveryTool?.ui.accent)?.toLowerCase()
  if (accent === 'fuchsia') return 'text-fuchsia-300'
  if (accent === 'emerald') return 'text-emerald-300'
  if (accent === 'amber') return 'text-amber-300'
  if (accent === 'primary') return 'text-primary'
  if (accent === 'info') return 'text-info'
  if (accent === 'warning') return 'text-warning'
  if (accent === 'destructive') return 'text-destructive'
  return 'text-primary'
}

function getCatalogIconBackground(discoveryTool?: DiscoveryToolCatalogItem) {
  const token = `${discoveryTool?.ui.icon ?? ''} ${discoveryTool?.tool_id ?? ''} ${discoveryTool?.title ?? ''} ${discoveryTool?.category ?? ''} ${discoveryTool?.model_kind ?? ''}`.toLowerCase()
  if (token.includes('magic') || token.includes('clip')) return '#F59E0B'
  if (token.includes('gif') || token.includes('download')) return '#10B981'
  if (token.includes('frame')) return '#F43F5E'
  if (token.includes('caption')) return '#8B5CF6'
  if (token.includes('transform') || token.includes('crop')) return '#0EA5E9'
  if (token.includes('voice clone')) return '#0EA5E9'
  if (token.includes('voice') || token.includes('speech') || token.includes('tts')) return '#14B8A6'
  if (token.includes('transcript') || token.includes('transcribe') || token.includes('research')) return '#06B6D4'
  if (token.includes('prompt enhance')) return '#F59E0B'
  if (token.includes('prompt') || token.includes('brand')) return '#8B5CF6'
  if (token.includes('upload')) return '#14B8A6'
  if (token.includes('image')) return '#D946EF'
  if (token.includes('video')) return '#F59E0B'

  const accent = cleanCatalogToken(discoveryTool?.ui.accent)?.toLowerCase()
  const hexAccent = normalizeHexColor(accent)
  if (hexAccent) return hexAccent
  if (accent === 'fuchsia') return '#D946EF'
  if (accent === 'emerald') return '#10B981'
  if (accent === 'amber') return '#F59E0B'
  if (accent === 'info') return '#00B8D9'
  if (accent === 'warning') return '#F59E0B'
  if (accent === 'destructive') return '#EF4444'
  if (token.includes('motion')) return '#C6FF00'
  if (token.includes('3d') || token.includes('three')) return '#9AA3AF'
  if (token.includes('caption')) return '#7C3AED'
  if (token.includes('transform') || token.includes('crop')) return '#168CFF'
  if (token.includes('render')) return '#4F7DFF'
  if (token.includes('image')) return '#22BDF2'
  if (token.includes('transcript') || token.includes('transcribe')) return '#252C3A'
  if (token.includes('voice') || token.includes('audio') || token.includes('mic')) return '#252C3A'
  if (token.includes('flow') || token.includes('agent') || token.includes('prompt')) return '#FFA70B'
  if (token.includes('video') || token.includes('clapper')) return '#FFB31A'
  return '#6E5BFF'
}

function getCatalogIconForeground(discoveryTool: DiscoveryToolCatalogItem) {
  const rgb = hexToRgb(getCatalogIconBackground(discoveryTool))
  if (!rgb) return '#ffffff'
  const luminance = getRelativeLuminance(rgb)
  return luminance > 0.58 ? '#17130A' : '#ffffff'
}

function getDefaultToolOutputImage(modelKind: ToolConfig['modelKind']) {
  if (modelKind === 'image') return '/auth/storyboard-timeline.png'
  if (modelKind === 'video') return '/auth/ai-video-workspace.png'
  return '/auth/campaign-publishing.png'
}

function normalizeCatalogCategory(value: string | undefined, modelKind: ToolConfig['modelKind']): CatalogCategory {
  const normalized = value?.toLowerCase()
  if (normalized?.includes('image')) return 'Image'
  if (normalized?.includes('audio') || normalized?.includes('voice')) return 'Audio'
  if (normalized?.includes('flow') || normalized?.includes('agent')) return 'Flow'
  if (normalized?.includes('video')) return 'Video'
  if (modelKind === 'image') return 'Image'
  if (modelKind === 'voice') return 'Audio'
  if (modelKind === 'agent') return 'Flow'
  return 'Video'
}

function formatModelKindLabel(modelKind: ToolConfig['modelKind']) {
  return modelKind.slice(0, 1).toUpperCase() + modelKind.slice(1)
}

function formatToolIdLabel(toolId: string) {
  return toolId
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getToolRegistryCapability(discoveryTool: DiscoveryToolCatalogItem | undefined) {
  const contract = discoveryTool?.input_contract
  if (!contract) return null
  const modelField = contract.form_contract.standard_fields.model?.name ?? 'model_id'
  if (!getSchemaEntry(contract.input_schema, modelField)) return null
  return getStringValue(contract.provider_requirement?.capability)?.trim() || null
}

function getModelsForTool(tool: ToolConfig, discoveryTool?: DiscoveryToolCatalogItem) {
  const capability = getToolRegistryCapability(discoveryTool)
  if (capability && discoveryTool) {
    // The current registry list is authoritative, including an empty list.
    // Schema enums/defaults may still name a model that has been disabled.
    return discoveryTool.models.filter((model) => model.capability === capability).map(toToolModel)
  }
  if (discoveryTool?.models.length) {
    return discoveryTool.models.map(toToolModel)
  }
  if (discoveryTool && !isMagicClipsTool(tool, discoveryTool.input_contract)) {
    const modelFieldName = discoveryTool.input_contract.form_contract.standard_fields.model?.name ?? 'model_id'
    const modelEntry = getSchemaEntry(discoveryTool.input_contract.input_schema, modelFieldName)
    const modelIds = modelEntry && isPublicToolConfigInput(modelEntry.name, modelEntry.port, discoveryTool.input_contract.input_classification)
      ? getAllowedValues(modelEntry.port).map(stringifySchemaValue).filter(Boolean) : []
    if (!isResearchAgentTool(tool, discoveryTool.input_contract)) return getToolSchemaModels(modelFieldName, modelIds)
    return modelIds.map((modelId) => ({
      id: modelId,
      label: formatResearchModelLabel(modelId),
      description: formatResearchModelDescription(modelId),
      provider: 'Youtorch',
      mark: 'Y',
      badges: modelId === stringifySchemaValue(modelEntry?.port.default) ? ['Default'] : undefined,
      features: modelId === 'gpt-5.6-luna' ? ['Efficient'] : ['Deep reasoning'],
      featureTags: modelId === 'gpt-5.6-luna' ? ['Efficient'] : ['Deep reasoning'],
    }))
  }
  return []
}

function formatResearchModelLabel(modelId: string) {
  return {
    'gpt-5.6-sol': 'GPT-5.6 Sol',
    'gpt-5.6-terra': 'GPT-5.6 Terra',
    'gpt-5.6-luna': 'GPT-5.6 Luna',
    'auto-llm': 'Auto',
  }[modelId] ?? formatSchemaOptionLabel(modelId)
}

function formatResearchModelDescription(modelId: string) {
  return {
    'gpt-5.6-sol': 'Strongest report synthesis and research judgment.',
    'gpt-5.6-terra': 'High-quality reasoning with a lower cost envelope.',
    'gpt-5.6-luna': 'Default · balanced speed and cost for routine research.',
    'auto-llm': 'Automatically selects a suitable model for your research.',
  }[modelId] ?? 'Research orchestration model.'
}

function getRunnableToolModel(models: ToolModel[], selectedId: string, defaultId: string) {
  const selected = models.find((candidate) => candidate.id === selectedId)
  if (selectedId && (!selected || isPricingMissingLabel(selected.creditLabel))) return undefined
  const runnable = models.filter((candidate) => !isPricingMissingLabel(candidate.creditLabel))
  return runnable.find((candidate) => candidate.id === selectedId)
    ?? runnable.find((candidate) => candidate.id === defaultId)
    ?? runnable[0]
}

function getToolModelAvailabilityReason(requiresModel: boolean, models: ToolModel[], selectedModel: ToolModel | undefined) {
  if (!requiresModel || selectedModel) return null
  return models.some((candidate) => isPricingMissingLabel(candidate.creditLabel))
    ? 'Pricing missing - model not runnable'
    : models.length ? 'Choose a model' : 'No compatible model available'
}

function getDefaultToolModelId(discoveryTool: DiscoveryToolCatalogItem | undefined, models: ToolModel[]) {
  models = models.filter((model) => !isPricingMissingLabel(model.creditLabel))
  const visibilityDefault = discoveryTool?.models.find((model) => (
    model.visibility.composer_default === true
    || model.visibility.assistant_default === true
    || model.visibility.default === true
  ))
  if (visibilityDefault && models.some((model) => model.id === visibilityDefault.id)) return visibilityDefault.id

  const defaultModelId = typeof discoveryTool?.defaults.model_id === 'string'
    ? discoveryTool.defaults.model_id
    : ''
  if (defaultModelId && models.some((model) => model.id === defaultModelId)) return defaultModelId

  return models[0]?.id ?? ''
}

function toToolModel(model: DiscoveryToolCatalogItem['models'][number]): ToolModel {
  const creditLabel = getModelCreditLabel(model)
  const provider = 'Youtorch'
  const publicLabel = formatPublicModelLabel(model.label, 'Model')
  const features = uniqueCompact([
    cleanCatalogToken(model.quality),
    cleanCatalogToken(model.speed),
  ])
  const featureTags = uniqueCompact([
    ...features,
    ...getSchemaArrayValues(model.input_schema, 'tasks').map(formatSchemaOptionLabel),
  ])

  return {
    id: model.id,
    label: publicLabel,
    description: publicCatalogText(model.description, 'AI model'),
    provider,
    mark: getProviderMark(provider),
    quality: cleanCatalogToken(model.quality),
    speed: cleanCatalogToken(model.speed),
    creditLabel,
    badges: model.visibility.composer_default === true || model.visibility.default === true ? ['Default'] : undefined,
    features: features.length > 0 ? features : undefined,
    featureTags: featureTags.length > 0 ? featureTags : undefined,
  }
}

function getToolUnavailableReason(tool: DiscoveryToolCatalogItem | undefined, catalog?: DiscoveryToolsCatalog) {
  if (!tool && catalog) return 'Unavailable'
  if (!tool) return null
  if (tool.maintenance || tool.status === 'maintenance') return 'Maintenance'
  if (tool.status === 'disabled') return 'Disabled'
  const capability = getToolRegistryCapability(tool)
  if (capability && !tool.models.some((model) => model.capability === capability)) return 'No compatible model available'
  return null
}

function getToolCreditLabel(tool: DiscoveryToolCatalogItem | undefined, selectedModel?: ToolModel) {
  if (selectedModel?.creditLabel) return selectedModel.creditLabel

  const estimate = readCreditValue(tool?.input_contract.cost_estimate)
  if (tool && isMagicClipsDiscoveryTool(tool) && (estimate === null || estimate <= 0)) return 'Estimate'
  if (estimate !== null) return formatCreditLabel(estimate)
  return 'Estimate'
}

function estimateLocalToolCredits(
  model: DiscoveryToolCatalogItem['models'][number] | undefined,
  params: Record<string, unknown>,
) {
  if (!model || isPricingMissingLabel(model.cost_label)) return null
  const pricingParams = omitNonBillablePromptParams(params)
  const angleCount = Array.isArray(pricingParams.angles) ? pricingParams.angles.length : null
  const count = Math.max(1, Math.trunc(
    angleCount ?? getFiniteNumber(pricingParams.count) ?? 1,
  ))
  const pricingRule = getPortRecord(model.pricing_rule)
  const ruleEstimate = estimateLocalPricingRuleCredits(pricingRule, pricingParams, count)
  if (ruleEstimate !== null) return ruleEstimate

  const knownEstimate = getKnownImageModelCreditEstimate(model.id, count)
  if (knownEstimate !== null) return knownEstimate

  if (model.estimated_credits !== null) return roundCredits(model.estimated_credits * count)
  return null
}

const CAPTION_FALLBACK_CREDITS_PER_SECOND = 0.02
const CAPTION_FALLBACK_MINIMUM_SECONDS = 5
const CAPTION_QUALITY_MULTIPLIERS: Record<string, number> = {
  economy: 0.85,
  standard: 1,
  high: 1.25,
}

function estimateCaptionRenderCredits(
  tool: DiscoveryToolCatalogItem | undefined,
  params: Record<string, unknown>,
) {
  const duration = getFiniteNumber(params.video_duration ?? params.duration_seconds)
  if (duration === null || duration <= 0) return null

  const pricing = getPortRecord(tool?.input_contract.cost_estimate)
  const creditsPerSecond = getFiniteNumber(pricing.credits_per_unit)
    ?? CAPTION_FALLBACK_CREDITS_PER_SECOND
  const minimumSeconds = getFiniteNumber(pricing.min_charge_units)
    ?? CAPTION_FALLBACK_MINIMUM_SECONDS
  const width = getFiniteNumber(params.video_width) ?? 1920
  const height = getFiniteNumber(params.video_height) ?? 1080
  const pixels = Math.max(1, width) * Math.max(1, height)
  const resolutionMultiplier = pixels <= 1280 * 720
    ? 0.8
    : pixels <= 1920 * 1080
      ? 1
      : pixels <= 2560 * 1440
        ? 1.5
        : 3
  const qualityMultiplier = CAPTION_QUALITY_MULTIPLIERS[String(params.quality ?? 'standard')] ?? 1

  return roundCredits(
    Math.max(duration, minimumSeconds) * creditsPerSecond * resolutionMultiplier * qualityMultiplier,
  )
}

const NON_BILLABLE_PROMPT_PARAM_NAMES = new Set([
  'generation_prompt',
  'image_prompt',
  'input_prompt',
  'positive_prompt',
  'prompt',
  'prompt_text',
  'request_prompt',
  'source_prompt',
  'text_prompt',
  'user_prompt',
  'video_prompt',
  'workflow_prompt',
])

function omitNonBillablePromptParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([name]) => !NON_BILLABLE_PROMPT_PARAM_NAMES.has(normalizeToolInputName(name))),
  )
}

function getKnownImageModelCreditEstimate(modelId: string, count: number) {
  if (isFluxKleinModelId(modelId)) return roundCredits(2 * count)
  return null
}

function estimateLocalPricingRuleCredits(
  rule: Record<string, unknown>,
  params: Record<string, unknown>,
  count: number,
) {
  if (Object.keys(rule).length === 0) return null
  const matrixEstimate = estimateLocalImageOptionMatrixCredits(rule, params, count)
  if (matrixEstimate !== null) return matrixEstimate
  if (Array.isArray(rule.line_items)) return null

  const hasBase = getFiniteNumber(rule.base_credits) !== null
  const hasAdjustments = Array.isArray(rule.adjustments) && rule.adjustments.length > 0
  if (!hasBase && !hasAdjustments) return null

  let total = getFiniteNumber(rule.base_credits) ?? 0
  const adjustments = Array.isArray(rule.adjustments) ? rule.adjustments : []
  const context = {
    input: { ...params, count, image_count: count },
    params: { ...params, count, image_count: count },
    selection: { ...params },
    output: { count, image_count: count, images: count },
    usage: { requests: count, image_count: count, images: count },
  }

  for (const adjustment of adjustments) {
    const record = getPortRecord(adjustment)
    if (!localPricingAdjustmentMatches(record, context)) continue
    const operation = String(record.operation ?? record.type ?? 'add_per_run')
    const credits = getFiniteNumber(record.credits ?? record.amount)
    if (credits === null) continue
    if (operation === 'set_total' || operation === 'override_total') {
      total = credits
    } else if (operation === 'add' || operation === 'add_once' || operation === 'add_per_run') {
      total += credits
    } else if (operation === 'multiply' || operation === 'multiplier' || operation === 'multiply_total') {
      total *= credits
    }
  }

  const minimum = getFiniteNumber(rule.minimum_credits ?? rule.min_credits)
  return roundCredits(Math.max(minimum ?? 0, total))
}

function estimateLocalImageOptionMatrixCredits(
  rule: Record<string, unknown>,
  params: Record<string, unknown>,
  count: number,
) {
  if (rule.mode !== 'image_option_matrix') return null
  const matrix = getPortRecord(rule.matrix)
  if (Object.keys(matrix).length === 0) return null
  const size = String(params.size ?? 'auto')
  const quality = String(params.quality ?? 'auto')
  const sizePrices = getPortRecord(matrix[size])
  const defaultPrices = getPortRecord(matrix.default)
  const prices = Object.keys(sizePrices).length > 0 ? sizePrices : defaultPrices
  let perImage = getFiniteNumber(prices[quality])
  if (perImage === null && quality === 'auto') perImage = getFiniteNumber(prices.medium)
  if (perImage === null) perImage = getFiniteNumber(prices.default)
  if (perImage === null) perImage = getFiniteNumber(rule.default_credits)
  if (perImage === null) return null

  const inputImageCredit = getFiniteNumber(rule.input_image_credit) ?? 0
  const inputImageCount = Array.isArray(params.image_urls)
    ? params.image_urls.length
    : typeof params.image_urls === 'string' && params.image_urls.trim()
      ? 1
      : 0
  const minimum = getFiniteNumber(rule.minimum_credits ?? rule.min_credits)
  return roundCredits(Math.max(minimum ?? 0, (perImage * count) + (inputImageCredit * inputImageCount)))
}

function localPricingAdjustmentMatches(adjustment: Record<string, unknown>, context: Record<string, unknown>) {
  const field = typeof adjustment.field === 'string'
    ? adjustment.field
    : typeof adjustment.path === 'string'
      ? adjustment.path
      : ''
  if (!field.trim()) return true
  const actual = localPricingContextValue(context, field)
  if (Object.prototype.hasOwnProperty.call(adjustment, 'equals')) {
    return String(actual) === String(adjustment.equals)
  }
  if (Object.prototype.hasOwnProperty.call(adjustment, 'value')) {
    return String(actual) === String(adjustment.value)
  }
  const allowedValues = Array.isArray(adjustment.in)
    ? adjustment.in
    : Array.isArray(adjustment.one_of)
      ? adjustment.one_of
      : null
  if (allowedValues) return allowedValues.some((value) => String(actual) === String(value))
  return actual !== undefined && actual !== null && actual !== ''
}

function localPricingContextValue(context: Record<string, unknown>, path: string) {
  return path.split('.').filter(Boolean).reduce<unknown>((current, part) => {
    const record = getPortRecord(current)
    return record[part]
  }, context)
}

function roundCredits(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100
}

function getModelCreditLabel(model: DiscoveryToolCatalogItem['models'][number]) {
  if (isPricingMissingLabel(model.cost_label)) return model.cost_label
  const knownEstimate = getKnownImageModelCreditEstimate(model.id, 1)
  if (knownEstimate !== null) return formatCreditLabel(knownEstimate)

  if (model.estimated_credits !== null) return formatCreditLabel(model.estimated_credits)

  const explicit = cleanCreditLabel(model.cost_label)
  return explicit
}

function readCreditValue(record: Record<string, unknown> | undefined) {
  if (!record) return null
  for (const key of ['estimated_credits', 'estimated_unit_cost_credits', 'unit_cost_credits', 'cost_credits', 'average_credits']) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
  }
  return null
}

function formatCreditLabel(value: number) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  const precision = safeValue > 0 && safeValue < 0.01 ? 4 : 2
  const rounded = Number.isInteger(safeValue)
    ? String(safeValue)
    : safeValue.toFixed(precision).replace(/\.?0+$/, '')
  return `${rounded} credit${safeValue === 1 ? '' : 's'}`
}

export const __toolWorkspaceTestHooks = {
  MediaDownloaderOutputPanel,
  CaptionRecentVideoGrid,
  CaptionSessionRunCard,
  buildToolAgentParams,
  getAvatarDurationOptions,
  cleanCreditLabel,
  collectInitialSchemaValues,
  estimateCaptionRenderCredits,
  estimateLocalToolCredits,
  formatToolInputFieldLabel,
  formatToolRunErrorMessage,
  getToolAgentEstimateBlockingReason,
  getRunnableToolModel,
  getModelsForTool,
  getToolUnavailableReason,
  getDiscoveryModel,
  getToolModelAvailabilityReason,
  getDefaultToolModelId,
  getToolAgentRequestErrorMessage,
  resolveDisplayedToolCredits,
  buildCaptionRunPreview,
  filterToolModels,
  getAdvancedSchemaFields,
  getMissingRequiredInputReason,
  getVoiceCloneConsentPreflightReason,
  buildVoiceCloneConsentScope,
  getVoiceRouteSchemaValues,
  withToolSourceMediaPreview,
  isAngleToolCatalogItem,
  getDefaultToolOutputView,
  applyStorageObjectIdToSchemaValues,
  isServerManagedToolFieldName,
  withVoiceCloneEstimateConsentSentinel,
  withServerIssuedVoiceCloneConsent,
  withoutServerManagedToolParams,
  voiceConsentIdempotencyKey,
  getCaptionSchemaFieldHelp,
  resolveCaptionAdvancedStyleName,
  getModelCreditLabel,
  getSchemaDrivenFields,
  getToolSchemaOptionValues,
  shouldRenderToolSchemaSelect,
  getToolStandardFieldSupport,
  getStandardToolFieldSupport,
  omitNonBillablePromptParams,
  orderVoiceVisibleFields,
  orderCaptionVisibleFields,
  isCaptionLanguageFieldVisible,
  isLanguageCodeToolField,
  formatCompactPromptText,
  formatProviderName,
  formatPublicModelLabel,
  formatCreditLabel,
  getCatalogModelCards,
  getDiscoveryTool,
  getToolId,
  getEffectiveCatalogHeroSlides,
  getHeroMediaLoadingStrategy,
  getToolAgentStatusPollInterval,
  getToolAgentRunSessionKey,
  parseToolAgentRunSession,
  readToolAgentRunSession,
  writeToolAgentRunSession,
  resetToolAgentRunMemoryStore,
  setToolAgentRunStorageBackendForTests,
  getToolAgentRunCardKey,
  getToolWorkflowOutputCardKey,
  getSpeechOutputCardKey,
  getCaptionOutputCardKey,
  getMediaDownloaderOutputTileKey,
  shouldCompactToolHistory,
  getToolModeOptions,
  getRunProgressStatusLabel,
  getPublicToolStatusLabel,
  getRecentWorkflowHandoffRetryDelay,
  isRetryableWorkflowRequestError,
  isRetryableStorageDeliveryError,
  shouldRetryStoragePreview,
  getToolWorkflowStatusLabel,
  getToolAgentRunIdentifier,
  getToolWorkflowOutputIdentifier,
  getPublicToolDisplayIdentifier,
  getEditableToolSourceImageUrl,
  getRecentWorkflowNodeType,
  getToolRecentWorkflowOutputKind,
  getToolWorkflowStatusTone,
  getToolWorkflowOutputView,
  hasPendingRecentWorkflowStoragePublication,
  isRecentWorkflowOutputReadyForRunHandoff,
  mergeRecentWorkflowOutputFirstPage,
  hasUsableRecentWorkflowSnapshot,
  getToolAgentRunTranscriptKey,
  getRecentWorkflowTranscriptKey,
  getSpeechVoiceLabel,
  getToolHref,
  getActiveTranscriptSegmentIndex,
  getTranscriptSegmentPlaybackProgress,
  getAgentTranscriptOutput,
  getAgentOutputStorageObjectId,
  getAgentOutputStorageObjectIds,
  getCaptionPlaybackChannelId,
  getTranscriptSourceMedia,
  getPlayableStorageMediaPreviewUrl,
  resolveCaptionMediaDelivery,
  resolveTranscriptMediaDelivery,
  resolveToolStorageOutputDelivery,
  isRasterImageOutputUrl,
  getToolStoragePreviewMediaUrl,
  getVideoPosterSeekSeconds,
  isStorageDeliveryTemporarilyUnavailable,
  TRANSCRIPT_PLAYER_REFERRER_POLICY,
  addPlayerInstanceToUrl,
  parsePlayerJsMessage,
  getPlayerJsEventSeconds,
  getRecentWorkflowTranscriptOutput,
  inferOutputKindFromUrl,
  isEmbeddableVideoUrl,
  appendGifReplayParam,
  isMediaDownloaderToolConfig,
  getMediaDownloaderPreviewGeometry,
  getMediaDownloaderQualityLabel,
  getMediaDownloaderQuotePreflightReason,
  getToolPrimaryActionLabel,
  getMediaDownloaderHistoryTiles,
  getMediaDownloaderSourceValidationError,
  sortMediaDownloaderTilesNewestFirst,
  isMediaDownloaderRunSupersededByHistory,
  getMediaDownloaderDeclaredItemCount,
  getMediaDownloaderDeliveryVariant,
  mapMediaDownloaderStorageReads,
  getMediaDownloaderStorageReadiness,
  getMediaDownloaderProjectedStorageReadiness,
  getMediaDownloaderStorageHydrationTargetIds,
  getMediaDownloaderStorageReadFailure,
  shouldRetryMediaDownloaderStorageRead,
  getMediaDownloaderThumbnailCandidates,
  getNextMediaDownloaderThumbnailUrl,
  isMediaDownloaderDirectUrlSafe,
  normalizeCatalogAssetUrl,
  normalizeMediaDownloaderSourceForSession,
  releaseToolGenerateSubmission,
  shouldBlockToolGenerate,
  shouldResetToolInputAfterLaunch,
  shouldRevalidateAgentEstimateBeforeLaunch,
  isLaunchQuotePriceChangedError,
  hasWorkflowEstimateChanged,
  shouldConfirmViralClipsQuota,
  coerceSchemaValue,
  getToolRunActivityLabel,
  getMediaTransformOutputActionLabel,
  isToolAgentRunReconciliationPending,
  getToolRunIdentifiers,
  isRecentWorkflowOutputHidden,
  isToolFastLaneLaunchResult,
  getHandedOffFastLaneRunIds,
  omitFastLaneRunProgress,
  ToolCreditPill,
  ToolImageGeneratingPlaceholder,
  ToolOutputPanel,
  SpeechOutputFailureCard,
  MagicClipPreviewMetadataPanel,
  ResearchRunningCanvas,
  ResearchHistoryRow,
  ToolTranscriptOutputCanvas,
  MediaTransformInputFields,
  MagicClipsInputFields,
  SchemaDrivenInputFields,
  ToolAgentRunCard,
  VideoToGifInputFields,
  VideoToGifSourcePreview,
  FrameExtractAdvancedSettings,
  FrameExtractInputFields,
  getMagicClipAllowedOutputFormats,
  MediaDownloaderDownloadFields,
  MediaDownloaderOutputTile,
  collectAgentOutputMedia,
  collectMediaTransformOutputMedia,
  collectVideoToGifOutputMedia,
  getRecentGifPreviewStorageObjectId,
  shouldUseSchemaDrivenToolField,
  collectMagicClipOutputMedia,
  collectFrameExtractOutputMedia,
  collectAngleOutputMedia,
  collectRecentAngleOutputMedia,
  collectRecentFrameOutputMedia,
  getToolBatchOutputDownloadUrl,
  getUnifiedFrameGridColumns,
  collectRecentMagicClipOutputMedia,
  getToolBatchStorageDeliveryPlan,
  getToolBatchPendingThumbnailRetrySignature,
  scheduleToolBatchThumbnailReadinessRetry,
  ToolBatchOutputGalleryContent,
  ToolClipOutputGallery,
  getMagicClipRunSummary,
  formatMagicClipRunSummary,
  getMagicClipsEmptyResultCopy,
  isExplicitMagicClipsCompletedEmpty,
  isEmptyMagicClipPayload,
  getToolsWorkspaceClientHydrationSnapshot,
  getToolsWorkspaceServerHydrationSnapshot,
  toToolModel,
  validateToolAgentParams,
  validateVideoToGifParams,
  validateFrameExtractParams,
  shouldShowToolModeSelect,
}

function formatProviderName(_sourceLabel: string | null) {
  return 'Youtorch'
}

function formatPublicModelLabel(value: string | null | undefined, fallback: string) {
  return publicModelLabel(value, fallback)
}

function getProviderMark(provider: string) {
  const base = provider || 'Youtorch'
  return base.trim().slice(0, 1).toUpperCase() || 'M'
}

function cleanCatalogToken(value: string | undefined) {
  if (!value) return undefined
  const normalized = publicCatalogText(value)
  if (!normalized || normalized.toLowerCase() === 'catalog') return undefined
  return normalized
}

function normalizeCatalogAssetUrl(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return ''
  if (normalized.startsWith('/')) return normalized
  if (/^https:\/\/[^<>"'\s]+$/i.test(normalized)) return normalized
  if (/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/[^<>"'\s]*$/i.test(normalized)) return normalized
  return ''
}

function readModelVisibilityString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readModelVisibilityNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readCatalogSectionMedia(metadata: Record<string, unknown>): CatalogSectionMedia | null {
  const url = readMetadataString(metadata, 'discovery_media_url') ?? readMetadataString(metadata, 'media_url')
  if (!url) return null
  const rawKind = readMetadataString(metadata, 'discovery_media_kind') ?? readMetadataString(metadata, 'media_kind')
  const durationSeconds = clampNumber(
    readMetadataNumber(metadata, 'discovery_slide_duration_seconds')
      ?? readMetadataNumber(metadata, 'slide_duration_seconds')
      ?? 6,
    2,
    30,
  )
  return {
    url,
    kind: rawKind === 'video' ? 'video' : 'image',
    alt: readMetadataString(metadata, 'discovery_media_alt') ?? readMetadataString(metadata, 'media_alt') ?? '',
    fit: readMediaFit(metadata, 'discovery_media_fit') ?? readMediaFit(metadata, 'media_fit') ?? 'cover',
    position: readMediaPosition(metadata, 'discovery_media_position') ?? readMediaPosition(metadata, 'media_position') ?? 'right',
    durationMs: durationSeconds * 1000,
    transition: readSlideTransition(metadata, 'discovery_slide_transition') ?? readSlideTransition(metadata, 'slide_transition') ?? 'fade',
    scrimColor: readHexColor(metadata, 'discovery_scrim_color') ?? readHexColor(metadata, 'scrim_color') ?? undefined,
    scrimOpacity: clampNumber(readMetadataNumber(metadata, 'discovery_scrim_opacity') ?? readMetadataNumber(metadata, 'scrim_opacity') ?? 82, 0, 100),
    buttonColor: readHexColor(metadata, 'discovery_button_color') ?? readHexColor(metadata, 'button_color') ?? undefined,
    buttonTextColor: readHexColor(metadata, 'discovery_button_text_color') ?? readHexColor(metadata, 'button_text_color') ?? undefined,
    badge: readMetadataString(metadata, 'discovery_badge') ?? readMetadataString(metadata, 'badge') ?? undefined,
    ctaLabel: readMetadataString(metadata, 'discovery_cta_label') ?? readMetadataString(metadata, 'cta_label') ?? undefined,
    ctaHref: normalizeDiscoveryCtaHref(readMetadataString(metadata, 'discovery_cta_href') ?? readMetadataString(metadata, 'cta_href')),
    secondaryCtaLabel: readMetadataString(metadata, 'discovery_secondary_cta_label') ?? readMetadataString(metadata, 'secondary_cta_label') ?? undefined,
    secondaryCtaHref: normalizeDiscoveryCtaHref(readMetadataString(metadata, 'discovery_secondary_cta_href') ?? readMetadataString(metadata, 'secondary_cta_href')),
  }
}

function readSlideTransition(metadata: Record<string, unknown>, key: string): CatalogSectionMedia['transition'] | null {
  const value = readMetadataString(metadata, key)
  return value === 'zoom' || value === 'fade' ? value : null
}

function buildHeroMediaStyle(slide: CatalogSectionMedia): React.CSSProperties {
  return {
    objectFit: slide.fit,
    objectPosition: slide.position === 'left' ? 'center left' : slide.position === 'center' ? 'center center' : 'center right',
  }
}

function buildHeroScrimBackground(slide: CatalogSectionMedia) {
  const rgb = hexToRgb(slide.scrimColor) ?? { r: 18, g: 18, b: 18 }
  const opacity = clampNumber(slide.scrimOpacity ?? 82, 0, 100) / 100
  const color = (alpha: number) => `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${clampNumber(alpha, 0, 1)})`
  return `linear-gradient(90deg, ${color(opacity)} 0%, ${color(opacity * 0.82)} 24%, ${color(opacity * 0.55)} 38%, ${color(opacity * 0.24)} 54%, ${color(0)} 72%)`
}

function buildHeroButtonStyle(slide: CatalogSectionMedia): React.CSSProperties | undefined {
  if (!slide.buttonColor && !slide.buttonTextColor) return undefined
  return {
    backgroundColor: slide.buttonColor,
    borderColor: slide.buttonColor,
    color: slide.buttonTextColor,
  }
}

function readMediaFit(metadata: Record<string, unknown>, key: string): CatalogSectionMedia['fit'] | null {
  const value = readMetadataString(metadata, key)
  return value === 'cover' || value === 'contain' ? value : null
}

function readMediaPosition(metadata: Record<string, unknown>, key: string): CatalogSectionMedia['position'] | null {
  const value = readMetadataString(metadata, key)
  return value === 'left' || value === 'center' || value === 'right' ? value : null
}

function readHexColor(metadata: Record<string, unknown>, key: string) {
  return normalizeHexColor(readMetadataString(metadata, key))
}

function normalizeHexColor(value: string | null | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized && /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : undefined
}

function hexToRgb(value: string | null | undefined) {
  const normalized = normalizeHexColor(value)
  if (!normalized) return null
  const int = Number.parseInt(normalized.slice(1), 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

function mixRgb(
  color: { r: number; g: number; b: number },
  mix: { r: number; g: number; b: number },
  amount: number,
) {
  const ratio = clampNumber(amount, 0, 1)
  return {
    r: Math.round(color.r + (mix.r - color.r) * ratio),
    g: Math.round(color.g + (mix.g - color.g) * ratio),
    b: Math.round(color.b + (mix.b - color.b) * ratio),
  }
}

function rgbCss(color: { r: number; g: number; b: number }, alpha?: number) {
  if (typeof alpha === 'number') {
    return `rgb(${color.r} ${color.g} ${color.b} / ${clampNumber(alpha, 0, 1)})`
  }
  return `rgb(${color.r} ${color.g} ${color.b})`
}

function getRelativeLuminance(color: { r: number; g: number; b: number }) {
  const toLinear = (channel: number) => {
    const normalized = clampNumber(channel, 0, 255) / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return (0.2126 * toLinear(color.r)) + (0.7152 * toLinear(color.g)) + (0.0722 * toLinear(color.b))
}

function readMetadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function readMetadataBoolean(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return null
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isAbortLikeError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const maybe = error as { name?: unknown; code?: unknown }
  return maybe.name === 'AbortError' || maybe.code === 'ERR_CANCELED'
}

function normalizeDiscoveryCtaHref(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized || /[\u0000-\u001F\u007F]/.test(normalized)) return undefined
  if (normalized.startsWith('/')) {
    return normalized.startsWith('//') || normalized.includes('\\') ? undefined : normalized
  }

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return undefined
  }

  if (parsed.protocol !== 'https:') return undefined
  const hostname = parsed.hostname.toLowerCase()
  return hostname === 'youtorch.io' || hostname.endsWith('.youtorch.io')
    ? parsed.toString()
    : undefined
}

function cleanCreditLabel(value: string | undefined) {
  const normalized = cleanCatalogToken(value)
  if (!normalized) return undefined
  const lower = normalized.toLowerCase()
  if (lower === 'provider image pricing' || lower === 'provider video pricing') return undefined
  if (lower.includes('provider') && lower.includes('pricing')) return undefined
  if (lower.includes('resolution-based') && lower.includes('credits')) return undefined
  if (lower.includes('output cost') || lower.includes('input cost')) return undefined
  if (/\b(gbp|usd|eur|fx)\b/i.test(normalized)) return undefined
  return normalized
}

function uniqueCompact(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function collectInitialSchemaValues(
  discoveryTool?: DiscoveryToolCatalogItem,
  selectedModel?: DiscoveryToolCatalogItem['models'][number],
): ToolSchemaValues {
  const initialValues: ToolSchemaValues = {}
  if (!discoveryTool) return initialValues

  Object.entries(discoveryTool.defaults ?? {}).forEach(([name, value]) => {
    if (value !== undefined && value !== null) initialValues[name] = value
  })
  const inputContract = getEffectiveToolInputContract(discoveryTool, selectedModel)
  const initialSchema = withCaptionFontSizePort(
    getEffectiveToolInputSchema(discoveryTool, selectedModel),
    inputContract,
  )
  Object.entries(initialSchema).forEach(([name, rawPort]) => {
    if (isTranscriptInputContract(discoveryTool.input_contract) && isDeprecatedTranscriptField(name)) return
    const port = getPortRecord(rawPort)
    if (port.default !== undefined && port.default !== null) initialValues[name] = port.default
  })
  if (isVideoToGifInputContract(inputContract)) {
    initialValues.loop = 2
    initialValues.trim = { start_sec: 0, end_sec: DEFAULT_GIF_DURATION_SECONDS }
  }
  if (isMagicClipsInputContract(inputContract)) {
    delete initialValues.clip_count
    delete initialValues.min_duration_sec
    delete initialValues.max_duration_sec
    delete initialValues.tone
    delete initialValues.social_tone
    for (const field of RETIRED_VIRAL_CLIPS_FIELDS) delete initialValues[field]
    initialValues.censor = 'off'
    delete initialValues.censor_audio_mode
    delete initialValues.censor_sound
    initialValues.captions_enabled = false
    initialValues.caption_language = 'original'
  }
  if (isSpeechGenerateInputContract(inputContract)) {
    const voiceProfileEntry = getSchemaEntry(initialSchema, 'voice_profile_id')
    if (voiceProfileEntry) {
      initialValues[voiceProfileEntry.name] = stringifySchemaValue(
        initialValues[voiceProfileEntry.name],
      ) || DEFAULT_VOICE_PROFILE_ID
    }
  }

  return initialValues
}

function getSourceUrlParam(value: string | null) {
  const normalized = value?.trim()
  if (!normalized || normalized.length > 8_000) return null
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized
  return null
}

function getVoiceRouteSchemaValues(
  schema: Record<string, unknown>,
  input: {
    voiceProfileId: string | null
    referenceStorageObjectId: string | null
    language: string | null
  },
): ToolSchemaValues {
  const values: ToolSchemaValues = {}
  const voiceProfileEntry = getSchemaEntry(schema, 'voice_profile_id')
  if (input.voiceProfileId && voiceProfileEntry) {
    values[voiceProfileEntry.name] = input.voiceProfileId
  }

  const referenceEntry = getSchemaEntry(schema, 'reference_storage_object_id')
  if (input.referenceStorageObjectId && referenceEntry) {
    values[referenceEntry.name] = input.referenceStorageObjectId
  }

  const languageEntry = getSchemaEntry(schema, 'language')
  if (!input.language || !languageEntry) return values

  const directLanguages = getAllowedValues(languageEntry.port)
    .map((value) => stringifySchemaValue(value))
    .filter(Boolean)
  const metadataLanguages = directLanguages.length > 0
    ? []
    : ['languages', 'supported_languages'].flatMap((key) => {
      const candidates = schema[key]
      return Array.isArray(candidates)
        ? candidates.map((value) => stringifySchemaValue(value)).filter(Boolean)
        : []
    })
  const supportedLanguages = directLanguages.length > 0 ? directLanguages : metadataLanguages
  if (supportedLanguages.length === 0) {
    values[languageEntry.name] = input.language
    return values
  }

  const matchingLanguage = supportedLanguages.find(
    (language) => getCanonicalVoiceLanguageRouteParam(language) === input.language,
  )
  if (matchingLanguage) values[languageEntry.name] = matchingLanguage
  return values
}

function getSourceUrlPreferredMode(tool: ToolConfig, modeOptions: ToolMode[]) {
  const preferredTasks = tool.modelKind === 'video'
    ? ['image_to_video', 'image-video', 'frame-video', 'first_last_frame', 'video_to_video', 'video-video']
    : ['image_to_image', 'image-image', 'image-edit', 'image_edit', 'reference_image']

  for (const task of preferredTasks) {
    const match = modeOptions.find((option) => option.value === task || mapToolModeToNodeTask(option.value) === task)
    if (match) return match.value
  }
  return null
}

function applyStorageObjectIdToSchemaValues(
  current: ToolSchemaValues,
  schema: Record<string, unknown>,
  storageObjectId: string,
  media?: {
    durationSeconds?: number | null
    width?: number | null
    height?: number | null
  },
): ToolSchemaValues {
  const next: ToolSchemaValues = { ...current, storage_object_id: storageObjectId }
  if (media?.durationSeconds != null) next.duration_sec = media.durationSeconds
  const assign = (name: string, value: unknown) => {
    const entry = getSchemaEntry(schema, name)
    if (!entry || value === undefined || value === null || value === '') return
    next[entry.name] = value
  }
  assign('storage_object_id', storageObjectId)
  assign('duration_sec', media?.durationSeconds)
  assign('video_duration', media?.durationSeconds)
  assign('video_width', media?.width)
  assign('video_height', media?.height)
  return next
}

function readStorageObjectDimension(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function toolSourceMediaFromStorageObject(
  channelId: string,
  item: StorageObjectItem,
): ToolRunSourceMedia {
  const width = readStorageObjectDimension(item.metadata.width)
  const height = readStorageObjectDimension(item.metadata.height)
  return {
    channelId,
    storageObjectId: item.id,
    name: item.name,
    mimeType: item.mime_type,
    durationSeconds: item.duration_seconds,
    previewUrl: item.thumbnail_url,
    width,
    height,
    dimensionSource: width && height ? 'source' : undefined,
  }
}

function withToolSourceMediaPreview(
  media: ToolRunSourceMedia | null,
  previewUrl: string | null | undefined,
) {
  if (!media || media.previewUrl) return media
  const normalizedPreviewUrl = previewUrl?.trim() ?? ''
  return normalizedPreviewUrl ? { ...media, previewUrl: normalizedPreviewUrl } : media
}

function applySourceUrlToSchemaValues(
  current: ToolSchemaValues,
  schema: Record<string, unknown>,
  sourceUrl: string,
): ToolSchemaValues {
  const sourceFieldCandidates = [
    'image_urls',
    'reference_image_urls',
    'input_references',
    'source_image_url',
    'input_image_url',
    'first_frame_url',
    'init_image_url',
    'video_url',
    'source_video_url',
    'media_url',
    'source_media_url',
    'url',
  ]

  for (const fieldName of sourceFieldCandidates) {
    const entry = getSchemaEntry(schema, fieldName)
    if (!entry) continue
    const type = getPortType(entry.port)
    return {
      ...current,
      [entry.name]: type === 'array' || type === 'list' ? [sourceUrl] : sourceUrl,
    }
  }

  return current
}

async function uploadToolSourceImage(
  channelId: string,
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
) {
  const session = await initiateStorageUpload({
    channelId,
    file,
    idempotencyKey: `tool-source-image:${createClientId()}`,
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

  return `storage://${session.object_id}`
}

function getToolSourceImageUrl(value: unknown) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim())
    return typeof first === 'string' ? first : ''
  }
  return ''
}

function getEditableToolSourceImageUrl(url: string) {
  return getStorageObjectIdFromUri(url) ? '' : url
}

function getToolSourceImageFileName(url: string) {
  if (!url) return ''
  try {
    const pathname = new URL(url, 'https://local.youtorch.io').pathname
    const fileName = pathname.split('/').filter(Boolean).pop()
    return fileName ? decodeURIComponent(fileName) : ''
  } catch {
    return ''
  }
}

function formatSourceImageValueForPort(url: string, port: Record<string, unknown>) {
  const normalizedUrl = url.trim()
  if (!normalizedUrl) return undefined
  const type = getPortType(port)
  return type === 'array' || type === 'list' ? [normalizedUrl] : normalizedUrl
}

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function buildToolAgentParams(input: {
  tool: ToolConfig
  discoveryTool?: DiscoveryToolCatalogItem
  selectedModel?: DiscoveryToolCatalogItem['models'][number]
  prompt: string
  selectedModelId: string
  mode: string
  duration: string
  resolution: string
  ratio: string
  motion: number
  seed: string
  audio: boolean
  standardFields: StandardToolFieldSupport
  schemaValues: ToolSchemaValues
}) {
  const effectiveSchema = getEffectiveToolInputSchema(input.discoveryTool, input.selectedModel)
  const effectiveContract = input.discoveryTool
    ? getEffectiveToolInputContract(input.discoveryTool, input.selectedModel)
    : undefined
  const nodeContract = input.discoveryTool?.input_contract
  const nodeSchema = withCaptionFontSizePort(
    nodeContract?.input_schema ?? effectiveSchema,
    effectiveContract,
  )
  const params: Record<string, unknown> = {}
  const transcriptContract = Boolean(effectiveContract && isTranscriptTool(input.tool, effectiveContract))

  Object.entries(input.discoveryTool?.defaults ?? {}).forEach(([name, value]) => {
    if (transcriptContract && isDeprecatedTranscriptField(name)) return
    const entry = getSchemaEntry(nodeSchema, name)
    if (!entry || value === undefined || value === null) return
    if (!isToolAgentParamAllowed(input.tool, effectiveContract, entry.name, entry.port, input.standardFields, input.mode)) return
    params[entry.name] = value
  })

  Object.entries(input.schemaValues).forEach(([name, value]) => {
    if (transcriptContract && isDeprecatedTranscriptField(name)) return
    const port = getPortRecord(nodeSchema[name])
    const mediaDownloaderSourceField = Boolean(
      effectiveContract
      && isMediaDownloaderTool(input.tool, effectiveContract)
      && normalizeToolInputName(name) === 'url',
    )
    const advancedField = effectiveContract
      ? isAdvancedToolSchemaField(input.tool, effectiveContract, name, port, input.standardFields, input.mode)
      : false
    if (
      effectiveContract
      && !mediaDownloaderSourceField
      && !shouldUseSchemaDrivenToolField(input.tool, effectiveContract, name, port, input.standardFields, input.mode)
      && !advancedField
    ) {
      return
    }
    const schemaValue = effectiveContract
      && isAngleInputContract(effectiveContract)
      && normalizeToolInputName(name) === 'angles'
      && typeof value === 'string'
        ? [value]
        : value
    const coercedValue = coerceSchemaValue(schemaValue, port)
    if (advancedField && isSchemaDefaultValue(coercedValue, port)) return
    if (!isBlankValue(coercedValue)) params[name] = coercedValue
  })

  if (effectiveContract && isAngleInputContract(effectiveContract) && isBlankValue(params.source_image)) {
    const storageObjectId = getStringValue(input.schemaValues.storage_object_id)?.trim()
    if (storageObjectId) params.source_image = { storage_object_id: storageObjectId }
  }

  if (effectiveContract && isCaptionTool(input.tool, effectiveContract) && isBlankValue(params.font_size)) {
    params.font_size = getNumberValue(input.schemaValues.font_size)
      ?? getNumberValue(getPortRecord(nodeSchema.font_size).default)
      ?? DEFAULT_CAPTION_FONT_SIZE
  }

  setBoundParam(params, nodeSchema, input.standardFields.prompt, normalizePrompt(input.prompt))
  setBoundParam(params, nodeSchema, input.standardFields.model, input.selectedModelId)
  const frameExtractTool = isFrameExtractTool(input.tool, effectiveContract)
  if (frameExtractTool) {
    const dedicatedMode = stringifySchemaValue(input.schemaValues.mode)
    const modeEntry = getSchemaEntry(nodeSchema, 'mode')
      ?? getBoundSchemaField(nodeSchema, input.standardFields.mode)
    if (dedicatedMode && modeEntry) {
      params[modeEntry.name] = coerceSchemaValue(dedicatedMode, modeEntry.port)
    }
  } else if (!transcriptContract) {
    setBoundParam(params, nodeSchema, input.standardFields.mode, mapToolModeToNodeTask(input.mode))
  }
  // Avatar "Auto (speech length)" sends no duration: the node follows the speech track instead of a 5 s default.
  const avatarDurationAuto = isAvatarGenerateInputContract(nodeContract)
    && (input.duration === TOOL_AVATAR_DURATION_AUTO || isBlankValue(input.duration))
  if (avatarDurationAuto) {
    const durationEntry = getBoundSchemaField(nodeSchema, input.standardFields.duration)
    if (durationEntry) delete params[durationEntry.name]
  } else {
    setBoundParam(params, nodeSchema, input.standardFields.duration, parseOptionalNumber(input.duration))
  }
  setBoundParam(params, nodeSchema, input.standardFields.resolution, input.resolution)
  setBoundParam(params, nodeSchema, input.standardFields.ratio, input.ratio)
  setBoundParam(params, nodeSchema, input.standardFields.motion, input.motion)
  setBoundParam(params, nodeSchema, input.standardFields.audio, input.audio)

  const seedValue = input.seed.trim()
  if (seedValue) {
    setBoundParam(params, nodeSchema, input.standardFields.seed, Number.isNaN(Number(seedValue)) ? seedValue : Number(seedValue))
  }

  if (effectiveContract && isMediaTransformTool(input.tool, effectiveContract)) {
    const actionModeEntry = getSchemaEntry(nodeSchema, 'action_mode')
    const actionMode = stringifySchemaValue(
      input.schemaValues.action_mode ?? input.schemaValues.__media_transform_purpose,
    )
    if (actionModeEntry && actionMode) {
      params[actionModeEntry.name] = coerceSchemaValue(actionMode, actionModeEntry.port)
    }
    delete params.__media_transform_purpose
  }

  const sanitizedParams = sanitizeToolAgentParams(
    sanitizeAgentParams(params, nodeSchema, nodeContract?.input_classification),
    input.tool,
    effectiveContract,
    input.standardFields,
    input.mode,
  )
  if (effectiveContract && isMagicClipsTool(input.tool, effectiveContract)) {
    // Viral Clips editorial routing is server-owned even while an older
    // cached node catalog still advertises the former model_id field.
    delete sanitizedParams.model_id
    const canonical = normalizeViralClipsParams(sanitizedParams)
    for (const key of Object.keys(sanitizedParams)) delete sanitizedParams[key]
    Object.assign(sanitizedParams, canonical)
  }
  if (effectiveContract && isVideoToGifInputContract(effectiveContract)) {
    sanitizeVideoToGifLaunchParams(sanitizedParams)
    // K7: the Tools result shows the WebP preview; the real GIF is rendered when it is downloaded.
    if (getSchemaEntry(nodeSchema, 'gif_delivery')) sanitizedParams.gif_delivery = 'on_download'
  }
  if (
    effectiveContract
    && isMediaTransformTool(input.tool, effectiveContract)
    && sanitizedParams.framing !== undefined
  ) {
    sanitizedParams.framing = normalizePublicMediaTransformFraming(sanitizedParams.framing)
  }
  if (
    effectiveContract
    && isCaptionTool(input.tool, effectiveContract)
    && getSchemaEntry(nodeSchema, 'quality')
  ) {
    sanitizedParams.quality = stringifySchemaValue(input.schemaValues.quality) === 'high'
      ? 'high'
      : 'standard'
  }
  if (effectiveContract && isCaptionTool(input.tool, effectiveContract)) {
    const subtitleMode = normalizeCaptionSubtitleMode(
      sanitizedParams.subtitle_mode
        ?? input.schemaValues.subtitle_mode
        ?? getSchemaEntry(nodeSchema, 'subtitle_mode')?.port.default,
    )
    if (getSchemaEntry(nodeSchema, 'subtitle_mode')) sanitizedParams.subtitle_mode = subtitleMode
    if (subtitleMode === 'original') {
      delete sanitizedParams.target_language
      CAPTION_DUAL_LAYOUT_SCHEMA_FIELDS.forEach((field) => delete sanitizedParams[field])
    } else if (subtitleMode === 'translated') {
      CAPTION_DUAL_LAYOUT_SCHEMA_FIELDS.forEach((field) => delete sanitizedParams[field])
    } else {
      if (getSchemaEntry(nodeSchema, 'bilingual_order')) {
        sanitizedParams.bilingual_order = normalizeCaptionBilingualOrder(
          sanitizedParams.bilingual_order
            ?? input.schemaValues.bilingual_order
            ?? getSchemaEntry(nodeSchema, 'bilingual_order')?.port.default,
        )
      }
      if (getSchemaEntry(nodeSchema, 'source_style_name')) {
        sanitizedParams.source_style_name = normalizeCaptionDualStyleName(
          sanitizedParams.source_style_name
            ?? input.schemaValues.source_style_name
            ?? getSchemaEntry(nodeSchema, 'source_style_name')?.port.default,
        )
      }
      if (getSchemaEntry(nodeSchema, 'translation_style_name')) {
        sanitizedParams.translation_style_name = normalizeCaptionDualStyleName(
          sanitizedParams.translation_style_name
            ?? input.schemaValues.translation_style_name
            ?? getSchemaEntry(nodeSchema, 'translation_style_name')?.port.default,
        )
      }
      if (getSchemaEntry(nodeSchema, 'source_font_scale')) {
        sanitizedParams.source_font_scale = normalizeCaptionFontScale(
          sanitizedParams.source_font_scale
            ?? input.schemaValues.source_font_scale
            ?? getSchemaEntry(nodeSchema, 'source_font_scale')?.port.default,
          0.8,
        )
      }
      if (getSchemaEntry(nodeSchema, 'translation_font_scale')) {
        sanitizedParams.translation_font_scale = normalizeCaptionFontScale(
          sanitizedParams.translation_font_scale
            ?? input.schemaValues.translation_font_scale
            ?? getSchemaEntry(nodeSchema, 'translation_font_scale')?.port.default,
          1,
        )
      }
    }
  }
  if (effectiveContract && isMediaDownloaderTool(input.tool, effectiveContract)) {
    const parsedSource = parseMediaDownloaderVideoUrl(stringifySchemaValue(input.schemaValues.url))
    if (parsedSource) sanitizedParams.url = parsedSource.url
    delete sanitizedParams.urls
    delete sanitizedParams.allow_playlist
    if (getMediaDownloaderClipMode(input.schemaValues) === 'full') {
      delete sanitizedParams.start_time
      delete sanitizedParams.end_time
    }
    delete sanitizedParams.quality
    delete sanitizedParams.resolution
    if (sanitizedParams.download_variant === 'metadata_only') {
      sanitizedParams.download_variant = 'video_with_audio'
    }
    if (sanitizedParams.mode === 'metadata') {
      sanitizedParams.mode = 'download'
    }
    delete sanitizedParams.metadata
    delete sanitizedParams.platform
    delete sanitizedParams.max_items
  }
  if (effectiveContract && isResearchAgentTool(input.tool, effectiveContract)) {
    delete sanitizedParams.operations
    delete sanitizedParams.sources
    delete sanitizedParams.targets
    const execution = stringifySchemaValue(sanitizedParams.execution || input.schemaValues.execution) || 'research'
    const operation = stringifySchemaValue(sanitizedParams.operation || input.schemaValues.operation)
    sanitizedParams.execution = execution
    if (execution === 'operation') {
      delete sanitizedParams.use_case
      if (!['youtube_comments', 'youtube_video_info', 'youtube_subtitles'].includes(operation)) {
        delete sanitizedParams.target
      }
      const keywordOperations = new Set([
        'google_trends',
        'keyword_expand',
        'keyword_metrics',
        'trend_compare',
        'trend_related_queries',
        'trend_related_topics',
      ])
      const trendOperations = new Set([
        'google_trends',
        'trend_compare',
        'trend_related_queries',
        'trend_related_topics',
      ])
      if (!keywordOperations.has(operation)) {
        delete sanitizedParams.keywords
      }
      if (!trendOperations.has(operation)) {
        delete sanitizedParams.time_range
      }
    } else {
      delete sanitizedParams.operation
      delete sanitizedParams.target
      sanitizedParams.use_case = stringifySchemaValue(
        sanitizedParams.use_case
        || input.schemaValues.use_case
        || getPortRecord(nodeSchema.use_case).default,
      ) || 'auto'
    }
  }
  if (getToolRegistryCapability(input.discoveryTool)) {
    const modelField = nodeContract?.form_contract.standard_fields.model?.name ?? 'model_id'
    if (!getDiscoveryModel(input.discoveryTool, stringifySchemaValue(sanitizedParams[modelField]))) {
      delete sanitizedParams[modelField]
    }
  }
  return sanitizedParams
}

function getMissingRequiredInputReason(
  discoveryTool: DiscoveryToolCatalogItem | undefined,
  selectedModel: DiscoveryToolCatalogItem['models'][number] | undefined,
  params: Record<string, unknown>,
) {
  if (!discoveryTool) return null
  const inputContract = getEffectiveToolInputContract(discoveryTool, selectedModel)
  if (isInstantVoiceCloneInputContract(inputContract) && getSchemaEntry(inputContract.input_schema, 'display_name')) {
    const displayName = stringifySchemaValue(params.display_name).trim()
    if (!displayName) return 'Voice name required'
    if (displayName.length > 100) return 'Voice name must be 100 characters or fewer'
  }
  const transcriptToken = [
    inputContract.node_type,
    inputContract.artifact_output_type,
    getStringValue(getPortRecord(inputContract.provider_requirement).capability) ?? '',
  ].join(' ').toLowerCase()
  if (
    (transcriptToken.includes('transcript') || transcriptToken.includes('audio.transcribe'))
    && isBlankValue(params.storage_object_id)
  ) {
    return 'Media required'
  }
  if (
    (transcriptToken.includes('caption') || transcriptToken.includes('subtitle'))
    && isBlankValue(params.storage_object_id)
    && isBlankValue(params.video_url)
  ) {
    return 'Video required'
  }
  if (
    isMediaDownloaderInputContract(inputContract)
    && isBlankValue(params.url)
  ) {
    return 'Media URL required'
  }
  if (
    (isMediaTransformInputContract(inputContract)
      || isVideoToGifInputContract(inputContract)
      || isFrameExtractInputContract(inputContract))
    && isBlankValue(params.storage_object_id)
    && isBlankValue(params.media_ref)
  ) {
    return 'Video required'
  }
  const task = stringifySchemaValue(params.task)
  const imageSourceFieldNames = getImageSourceSchemaFieldNames(inputContract.input_schema, task)
  const imageSourceProvided = hasImageSourceParamValue(inputContract.input_schema, params, task)

  for (const [name, rawPort] of Object.entries(inputContract.input_schema)) {
    const port = getPortRecord(rawPort)
    if (!readPortBoolean(port, 'required')) continue
    if (!isSchemaFieldVisible(inputContract, name, port)) continue
    if (!isBlankValue(params[name])) continue
    if (isImageSourceSchemaName(name, port, task) && imageSourceProvided) continue
    return `${formatToolInputFieldLabel(name)} required`
  }

  if (imageSourceFieldNames.length > 0 && !imageSourceProvided) return 'Source image required'

  return null
}

function getSchemaDrivenFields(
  tool: ToolConfig,
  discoveryTool?: DiscoveryToolCatalogItem,
  selectedModel?: DiscoveryToolCatalogItem['models'][number],
  standardFields?: StandardToolFieldSupport,
  mode = '',
): Array<[string, unknown]> {
  if (!discoveryTool) return []

  const inputContract = getEffectiveToolInputContract(discoveryTool, selectedModel)
  const schema = withCaptionFontSizePort(
    getEffectiveToolInputSchema(discoveryTool, selectedModel),
    inputContract,
  )
  const fields = Object.entries(schema)
    .filter(([name, rawPort]) => shouldUseSchemaDrivenToolField(
      tool,
      inputContract,
      name,
      getPortRecord(rawPort),
      standardFields,
      mode,
    ))
  return dedupeSchemaDrivenImageSourceFields(fields, tool, mode)
}

function dedupeSchemaDrivenImageSourceFields(
  fields: Array<[string, unknown]>,
  tool: ToolConfig,
  mode: string,
) {
  const sourceFields = fields.filter(([name, rawPort]) => isImageSourceSchemaEntry(
    tool,
    name,
    getPortRecord(rawPort),
    mode,
  ))
  if (sourceFields.length <= 1) return fields

  const preferredName = selectPreferredImageSourceFieldName(sourceFields.map(([name]) => name), mode)
  return fields.filter(([name, rawPort]) => {
    if (!isImageSourceSchemaEntry(tool, name, getPortRecord(rawPort), mode)) return true
    return name === preferredName
  })
}

function getSchemaImageSourceFieldNames(
  schema: Record<string, unknown>,
  tool: ToolConfig,
  mode: string,
) {
  return Object.entries(schema)
    .filter(([name, rawPort]) => isImageSourceSchemaEntry(tool, name, getPortRecord(rawPort), mode))
    .map(([name]) => name)
}

function getImageSourceSchemaFieldNames(schema: Record<string, unknown>, mode: string) {
  return Object.entries(schema)
    .filter(([name, rawPort]) => isImageSourceSchemaName(name, getPortRecord(rawPort), mode))
    .map(([name]) => name)
}

function getSourceImageFieldDisplayValue(
  values: ToolSchemaValues,
  sourceFieldNames: string[],
  preferredName: string,
) {
  const preferredValue = values[preferredName]
  if (!isBlankValue(preferredValue)) return preferredValue

  for (const fieldName of sourceFieldNames) {
    const value = values[fieldName]
    if (!isBlankValue(value)) return value
  }

  for (const fieldName of IMAGE_SOURCE_INPUT_FIELDS) {
    const value = values[fieldName]
    if (!isBlankValue(value)) return value
  }

  return preferredValue
}

function getAdvancedSchemaFields(
  tool: ToolConfig,
  discoveryTool?: DiscoveryToolCatalogItem,
  selectedModel?: DiscoveryToolCatalogItem['models'][number],
  standardFields?: StandardToolFieldSupport,
  mode = '',
): Array<[string, unknown]> {
  if (!discoveryTool) return []

  const inputContract = getEffectiveToolInputContract(discoveryTool, selectedModel)
  if (
    isMediaTransformTool(tool, inputContract)
    || isMagicClipsTool(tool, inputContract)
    || isVideoToGifInputContract(inputContract)
  ) return []
  return Object.entries(getEffectiveToolInputSchema(discoveryTool, selectedModel))
    .filter(([name, rawPort]) => isAdvancedToolSchemaField(
      tool,
      inputContract,
      name,
      getPortRecord(rawPort),
      standardFields,
      mode,
    ))
}

function getEffectiveToolInputContract(
  discoveryTool: DiscoveryToolCatalogItem,
  selectedModel?: DiscoveryToolCatalogItem['models'][number],
): DiscoveryToolCatalogItem['input_contract'] {
  return selectedModel?.effective_input_contract ?? discoveryTool.input_contract
}

function isInstantVoiceCloneInputContract(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
) {
  const nodeType = inputContract.node_type.trim().toLowerCase()
  return nodeType === 'voice_clone' || nodeType.startsWith('voice_clone@')
}

function isSpeechGenerateInputContract(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
) {
  const nodeType = inputContract.node_type.trim().toLowerCase()
  if (nodeType === 'speech_generate' || nodeType.startsWith('speech_generate@')) return true
  return getStringValue(getPortRecord(inputContract.provider_requirement).capability) === 'audio.generate.speech'
}

function getVoiceCloneConsentPreflightReason(input: {
  discoveryTool: DiscoveryToolCatalogItem | undefined
  selectedModel: DiscoveryToolCatalogItem['models'][number] | undefined
  params: Record<string, unknown>
  selfAttestationAccepted: boolean
}) {
  if (!input.discoveryTool) return null
  const inputContract = getEffectiveToolInputContract(input.discoveryTool, input.selectedModel)
  if (!isInstantVoiceCloneInputContract(inputContract)) return null
  if (isBlankValue(input.params.reference_storage_object_id)) return null
  return input.selfAttestationAccepted ? null : 'Confirm voice consent'
}

function buildVoiceCloneConsentScope(
  channelId: string | null | undefined,
  referenceStorageObjectId: string,
  targetSpeechModelId: string,
  language: string,
) {
  return JSON.stringify([
    channelId ?? '',
    referenceStorageObjectId,
    targetSpeechModelId,
    language,
  ])
}

function withVoiceCloneEstimateConsentSentinel(
  discoveryTool: DiscoveryToolCatalogItem,
  selectedModel: DiscoveryToolCatalogItem['models'][number] | undefined,
  params: Record<string, unknown>,
  selfAttestationAccepted: boolean,
) {
  const inputContract = getEffectiveToolInputContract(discoveryTool, selectedModel)
  if (!isInstantVoiceCloneInputContract(inputContract) || !selfAttestationAccepted) return params
  return {
    ...withoutServerManagedToolParams(params),
    consent_record_id: VOICE_CLONE_ESTIMATE_CONSENT_SENTINEL,
  }
}

async function prepareToolLaunchParams(input: {
  discoveryTool: DiscoveryToolCatalogItem
  selectedModel: DiscoveryToolCatalogItem['models'][number] | undefined
  channelId: string
  params: Record<string, unknown>
  selfAttestationAccepted: boolean
  consentIdempotencyKey: string
}) {
  const inputContract = getEffectiveToolInputContract(input.discoveryTool, input.selectedModel)
  if (isSpeechGenerateInputContract(inputContract)) {
    return {
      ...input.params,
      voice_profile_id: stringifySchemaValue(input.params.voice_profile_id)
        || DEFAULT_VOICE_PROFILE_ID,
    }
  }
  if (!isInstantVoiceCloneInputContract(inputContract)) return input.params

  const launchParams = withoutServerManagedToolParams(input.params)
  const referenceStorageObjectId = stringifySchemaValue(launchParams.reference_storage_object_id)
  const targetSpeechModelId = stringifySchemaValue(launchParams.target_speech_model_id)
  const language = stringifySchemaValue(launchParams.language)
  if (!referenceStorageObjectId) throw new Error('Select a reference recording first.')
  if (!targetSpeechModelId) throw new Error('Select the target speech model first.')
  if (!language) throw new Error('Select the voice language first.')
  if (!input.selfAttestationAccepted) throw new Error('Confirm that the reference recording is your own voice.')

  const consent = await grantInstantVoiceCloneConsent({
    channelId: input.channelId,
    referenceStorageObjectId,
    subjectType: 'self',
    targetSpeechModelId,
    language,
    accepted: true,
    idempotencyKey: input.consentIdempotencyKey,
  })
  if (
    consent.status !== 'granted'
    || consent.reference_storage_object_id !== referenceStorageObjectId
  ) {
    throw new Error('Voice consent could not be verified for the selected recording.')
  }

  return withServerIssuedVoiceCloneConsent(launchParams, consent.consent_id)
}

function withServerIssuedVoiceCloneConsent(
  params: Record<string, unknown>,
  consentId: string,
) {
  if (
    consentId === VOICE_CLONE_ESTIMATE_CONSENT_SENTINEL
    || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/.test(consentId)
  ) {
    throw new Error('Voice consent service returned an invalid record.')
  }
  return {
    ...withoutServerManagedToolParams(params),
    consent_record_id: consentId,
  }
}

function withoutServerManagedToolParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([name]) => !isServerManagedToolFieldName(name)),
  )
}

function voiceConsentIdempotencyKey(launchIdempotencyKey: string) {
  return `voice-consent:${launchIdempotencyKey}`
}

function getEffectiveToolInputSchema(
  discoveryTool?: DiscoveryToolCatalogItem,
  selectedModel?: DiscoveryToolCatalogItem['models'][number],
) {
  if (discoveryTool && selectedModel?.effective_input_contract) {
    return selectedModel.effective_input_contract.input_schema
  }

  return discoveryTool?.input_contract.input_schema ?? {}
}

function getStandardToolFieldSupport(
  discoveryTool: DiscoveryToolCatalogItem | undefined,
  selectedModel: DiscoveryToolCatalogItem['models'][number] | undefined,
): StandardToolFieldSupport {
  const fields = {
    ...(discoveryTool?.input_contract.form_contract.standard_fields ?? {}),
    ...(selectedModel?.effective_input_contract?.form_contract.standard_fields ?? {}),
  }
  return {
    mode: fields.mode,
    prompt: fields.prompt,
    model: fields.model,
    duration: fields.duration,
    resolution: fields.resolution,
    ratio: fields.ratio,
    motion: fields.motion,
    seed: fields.seed,
    audio: fields.audio,
  }
}

function getToolStandardFieldSupport(
  tool: ToolConfig,
  discoveryTool: DiscoveryToolCatalogItem | undefined,
  selectedModel: DiscoveryToolCatalogItem['models'][number] | undefined,
  standardFields: StandardToolFieldSupport,
): StandardToolFieldSupport {
  if (!discoveryTool) return standardFields

  const inputContract = getEffectiveToolInputContract(discoveryTool, selectedModel)
  let supportedFields = { ...standardFields }
  const effectiveSchema = getEffectiveToolInputSchema(discoveryTool, selectedModel)
  Object.entries(supportedFields).forEach(([field, binding]) => {
    if (!binding) return
    const bindingSchema = binding.source === 'node'
      ? discoveryTool.input_contract.input_schema
      : effectiveSchema
    if (!getSchemaEntry(bindingSchema, binding.name)) {
      delete supportedFields[field as StandardToolFieldKey]
    }
  })
  if (tool.modelKind === 'voice') delete supportedFields.seed
  if (
    tool.modelKind === 'voice'
    && !isTranscriptTool(tool, inputContract)
    && !supportedFields.model
  ) {
    const modelEntry = getSchemaEntry(discoveryTool.input_contract.input_schema, 'model_id')
    if (modelEntry) {
      supportedFields.model = {
        name: modelEntry.name,
        source: 'node',
        required: modelEntry.port.required === true,
        has_allowed_values: getAllowedValues(modelEntry.port).length > 0,
      }
    }
  }
  if (selectedModel && isTranscriptTool(tool, inputContract) && !supportedFields.model) {
    const modelEntry = getSchemaEntry(inputContract.input_schema, 'model_id')
      ?? getSchemaEntry(discoveryTool.input_contract.input_schema, 'model_id')
    if (modelEntry) {
      supportedFields = {
        ...supportedFields,
        model: {
          name: modelEntry.name,
          source: 'node',
          required: modelEntry.port.required === true,
          has_allowed_values: getAllowedValues(modelEntry.port).length > 0,
        },
      }
    }
  }

  if (tool.modelKind !== 'image') return supportedFields

  const supportsProviderParams = hasProviderSupportedParameters(inputContract)
  const supportsSize = isProviderToolInputSupported(inputContract, 'size')
    || isProviderToolInputSupported(inputContract, 'resolution')
  const supportsRatio = isProviderToolInputSupported(inputContract, 'aspect_ratio')

  if (supportsProviderParams && !supportsSize && !supportsRatio) {
    return {
      ...supportedFields,
      resolution: undefined,
      ratio: undefined,
    }
  }

  const nextFields = { ...supportedFields }
  if (supportsProviderParams && !supportsRatio) nextFields.ratio = undefined
  if (supportsProviderParams && !supportsSize) {
    return {
      ...nextFields,
      resolution: undefined,
    }
  }

  const nodeSchema = discoveryTool.input_contract.input_schema
  const sizeOptions = getImageDimensionOptionValues(effectiveSchema, nodeSchema, 'size')
  const resolutionOptions = getImageDimensionOptionValues(effectiveSchema, nodeSchema, 'resolution')
  const hasSizeChoices = sizeOptions.length > 0 && hasSchemaField(nodeSchema, 'size')
  const hasResolutionChoices = resolutionOptions.length > 0 && hasSchemaField(nodeSchema, 'resolution')

  if (hasResolutionChoices && getSchemaArrayValues(effectiveSchema, 'resolutions').length > 0) {
    return {
      ...nextFields,
      resolution: {
        name: 'resolution',
        source: 'node',
        required: false,
        has_allowed_values: true,
      },
    }
  }

  if (hasSizeChoices) {
    return {
      ...nextFields,
      resolution: {
        name: 'size',
        source: 'node',
        required: false,
        has_allowed_values: true,
      },
    }
  }

  if (hasResolutionChoices) {
    return {
      ...nextFields,
      resolution: {
        name: 'resolution',
        source: 'node',
        required: false,
        has_allowed_values: true,
      },
    }
  }

  return {
    ...nextFields,
    resolution: undefined,
  }
}

function getSchemaModeOptions(
  schema: Record<string, unknown>,
  binding: StandardToolFieldBinding | undefined,
  fallbackSchema?: Record<string, unknown>,
): ToolMode[] {
  const entry = getBoundSchemaField(schema, binding) ?? getBoundSchemaField(fallbackSchema ?? {}, binding)
  if (!entry) return []

  return getTaskOptionValues(schema, entry.name, entry.port)
    .map((value) => ({
      value,
      label: ['fast', 'medium', 'high', 'ultra'].includes(value)
        ? formatResearchModeLabel(value)
        : formatSchemaOptionLabel(value),
      icon: getModeIcon(value),
    }))
}

function getToolModeOptions(
  tool: ToolConfig,
  discoveryTool: DiscoveryToolCatalogItem | undefined,
  schema: Record<string, unknown>,
  binding: StandardToolFieldBinding | undefined,
): ToolMode[] {
  const inputContract = discoveryTool?.input_contract
  const options = getSchemaModeOptions(schema, binding, inputContract?.input_schema)
  if (!inputContract || !isMediaDownloaderTool(tool, inputContract)) return options
  return options.filter((option) => option.value !== 'metadata')
}

function getSchemaChoiceOptions(
  schema: Record<string, unknown>,
  binding: StandardToolFieldBinding | undefined,
  unit?: string,
  fallbackSchema?: Record<string, unknown>,
) {
  if (!binding?.name) return []
  const entry = getBoundSchemaField(schema, binding) ?? getBoundSchemaField(fallbackSchema ?? {}, binding)
  if (!entry) return []

  return getSchemaOptionValuesForField(schema, entry.name, entry.port)
    .map((value) => ({
      value,
      label: unit ? `${value} ${unit}` : formatSchemaOptionLabel(value),
    }))
}

function getTaskOptionValues(
  schema: Record<string, unknown>,
  fieldName: string,
  port: Record<string, unknown>,
) {
  const modelTaskValues = getSchemaArrayValues(schema, 'tasks')
  const values = modelTaskValues.length > 0
    ? modelTaskValues
    : getSchemaOptionValuesForField(schema, fieldName, port)
  return orderTaskOptionValues(values, stringifySchemaValue(schema.default_task))
}

function orderTaskOptionValues(values: string[], defaultTask: string) {
  const originalIndex = new Map(values.map((value, index) => [value, index]))
  const preferredOrder = ['text_to_image', 'image_to_image', 'reference_image', 'image_edit', 'first_last_frame']
  return Array.from(new Set(values)).sort((left, right) => {
    if (defaultTask) {
      if (left === defaultTask) return -1
      if (right === defaultTask) return 1
    }
    const leftPreferred = preferredOrder.indexOf(left)
    const rightPreferred = preferredOrder.indexOf(right)
    if (leftPreferred !== -1 || rightPreferred !== -1) {
      if (leftPreferred === -1) return 1
      if (rightPreferred === -1) return -1
      return leftPreferred - rightPreferred
    }
    return (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0)
  })
}

function getImageDimensionOptionValues(
  effectiveSchema: Record<string, unknown>,
  nodeSchema: Record<string, unknown>,
  fieldName: 'size' | 'resolution',
) {
  const binding: StandardToolFieldBinding = {
    name: fieldName,
    source: 'node',
    required: false,
    has_allowed_values: true,
  }
  const entry = getBoundSchemaField(effectiveSchema, binding) ?? getBoundSchemaField(nodeSchema, binding)
  if (!entry) return []
  return getSchemaOptionValuesForField(effectiveSchema, entry.name, entry.port)
}

function getSchemaArrayValues(schema: Record<string, unknown>, key: string) {
  const value = schema[key]
  if (!Array.isArray(value)) return []
  return value.map((item) => stringifySchemaValue(item)).filter(Boolean)
}

function getSchemaFieldDefaultString(
  schema: Record<string, unknown>,
  binding: StandardToolFieldBinding | undefined,
) {
  const entry = getBoundSchemaField(schema, binding)
  if (!entry) return ''
  return stringifySchemaValue(readPortDefaultValue(entry.port))
}

function getBoundSchemaField(
  schema: Record<string, unknown>,
  binding: StandardToolFieldBinding | undefined,
): { name: string; port: Record<string, unknown> } | null {
  if (!binding?.name) return null
  const direct = schema[binding.name]
  if (direct !== undefined) return { name: binding.name, port: getPortRecord(direct) }

  const normalizedName = normalizeSchemaFieldName(binding.name)
  const entry = Object.entries(schema).find(([name, rawPort]) => {
    const port = getPortRecord(rawPort)
    return normalizeSchemaFieldName(name) === normalizedName
      || normalizeSchemaFieldName(getStringValue(port.name) ?? '') === normalizedName
  })
  return entry ? { name: entry[0], port: getPortRecord(entry[1]) } : null
}

function setBoundParam(
  params: Record<string, unknown>,
  schema: Record<string, unknown>,
  binding: StandardToolFieldBinding | undefined,
  value: unknown,
) {
  if (isBlankValue(value)) return
  const entry = getBoundSchemaField(schema, binding)
  if (!entry) return

  params[entry.name] = coerceSchemaValue(value, entry.port)
}

function sanitizeAgentParams(
  params: Record<string, unknown>,
  schema: Record<string, unknown>,
  inputClassification: Record<string, unknown> | undefined,
) {
  const sanitized: Record<string, unknown> = {}

  Object.entries(params).forEach(([name, value]) => {
    const entry = getSchemaEntry(schema, name)
    if (!entry) return
    if (!isPublicToolConfigInput(entry.name, entry.port, inputClassification)) return
    const coercedValue = coerceSchemaValue(value, entry.port)
    if (!isBlankValue(coercedValue)) sanitized[entry.name] = coercedValue
  })

  return sanitized
}

function sanitizeToolAgentParams(
  params: Record<string, unknown>,
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'] | undefined,
  standardFields: StandardToolFieldSupport,
  mode: string,
) {
  if (!inputContract) return params
  const sanitized: Record<string, unknown> = {}
  const inputSchema = withCaptionFontSizePort(inputContract.input_schema, inputContract)

  Object.entries(params).forEach(([name, value]) => {
    const entry = getSchemaEntry(inputSchema, name)
    if (!entry) return
    if (!isToolAgentParamAllowed(tool, inputContract, entry.name, entry.port, standardFields, mode)) return
    if (getToolParamTypeError(value, entry.port)) return
    sanitized[entry.name] = value
  })

  return dedupeToolImageSourceParams(sanitized, tool, inputContract, mode)
}

function dedupeToolImageSourceParams(
  params: Record<string, unknown>,
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  mode: string,
) {
  const sourceParamNames = Object.keys(params).filter((name) => {
    const entry = getSchemaEntry(inputContract.input_schema, name)
    return isImageSourceSchemaEntry(tool, entry?.name ?? name, entry?.port ?? {}, mode)
  })
  if (sourceParamNames.length <= 1) return params

  const preferredName = selectPreferredImageSourceFieldName(sourceParamNames, mode)
  return Object.fromEntries(
    Object.entries(params).filter(([name]) => !sourceParamNames.includes(name) || name === preferredName),
  )
}

function isToolAgentParamAllowed(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'] | undefined,
  name: string,
  port: Record<string, unknown>,
  standardFields: StandardToolFieldSupport,
  mode: string,
) {
  if (!inputContract) return true
  if (
    isMediaTransformTool(tool, inputContract)
    && normalizeToolInputName(name) === 'action_mode'
  ) return true
  if (isStandardToolSchemaField(tool, name, standardFields)) return true
  if (
    isMediaDownloaderTool(tool, inputContract)
    && ['url', 'urls'].includes(normalizeToolInputName(name))
  ) return true
  if (shouldUseSchemaDrivenToolField(tool, inputContract, name, port, standardFields, mode)) return true
  return isAdvancedToolSchemaField(tool, inputContract, name, port, standardFields, mode)
}

function validateToolAgentParams(
  discoveryTool: DiscoveryToolCatalogItem | undefined,
  selectedModel: DiscoveryToolCatalogItem['models'][number] | undefined,
  params: Record<string, unknown>,
): ToolParamValidationIssue[] {
  if (!discoveryTool) return []

  const inputContract = getEffectiveToolInputContract(discoveryTool, selectedModel)
  const schema = withCaptionFontSizePort(inputContract.input_schema, inputContract)
  const inputClassification = inputContract.input_classification
  const issues: ToolParamValidationIssue[] = []
  if (getToolRegistryCapability(discoveryTool)) {
    const modelField = discoveryTool.input_contract.form_contract.standard_fields.model?.name ?? 'model_id'
    const modelId = stringifySchemaValue(params[modelField])
    if (!modelId) issues.push({ field: modelField, code: 'required' })
    else if (!getDiscoveryModel(discoveryTool, modelId)) issues.push({ field: modelField, code: 'invalid_value' })
  }
  const allowedParamKeys = new Set<string>()
  const privateParamKeys = new Set<string>()
  const task = stringifySchemaValue(params.task)
  const imageSourceFieldNames = getImageSourceSchemaFieldNames(schema, task)
  const imageSourceProvided = hasImageSourceParamValue(schema, params, task)
  let missingImageSourceReported = false

  Object.entries(schema).forEach(([schemaName, rawPort]) => {
    const port = getPortRecord(rawPort)
    const aliases = uniqueCompact([schemaName, getStringValue(port.name) ?? undefined])
    const publicConfigurable = isPublicToolConfigInput(schemaName, port, inputClassification)

    if (!publicConfigurable) {
      aliases.forEach((alias) => privateParamKeys.add(alias))
      if (aliases.some((alias) => Object.prototype.hasOwnProperty.call(params, alias))) {
        issues.push({ field: schemaName, code: 'not_public_config' })
      }
      return
    }

    aliases.forEach((alias) => allowedParamKeys.add(alias))
    const paramName = aliases.find((alias) => Object.prototype.hasOwnProperty.call(params, alias))
    const value = paramName ? params[paramName] : undefined

    if (isBlankValue(value)) {
      if (readPortBoolean(port, 'required')) {
        if (isImageSourceSchemaName(schemaName, port, task)) {
          if (imageSourceProvided || missingImageSourceReported) return
          missingImageSourceReported = true
        }
        issues.push({ field: schemaName, code: 'required' })
      }
      return
    }

    const typeError = getToolParamTypeError(value, port)
    if (typeError) {
      issues.push({ field: schemaName, code: 'invalid_type', expected: typeError })
      return
    }

    const numericValue = getFiniteNumber(value)
    if (numericValue !== null) {
      const minValue = getPortNumberConstraint(port, 'min_value', 'minimum', 'min')
      if (minValue !== null && numericValue < minValue) {
        issues.push({ field: schemaName, code: 'below_min_value', minValue })
        return
      }

      const maxValue = getPortNumberConstraint(port, 'max_value', 'maximum', 'max')
      if (maxValue !== null && numericValue > maxValue) {
        issues.push({ field: schemaName, code: 'above_max_value', maxValue })
        return
      }
    }

    const allowedValues = getAllowedValues(port)
    const normalizedSchemaName = normalizeToolInputName(schemaName)
    const knownCaptionStyle = typeof value === 'string'
      && (value === 'auto' || value === 'inherit' || CAPTION_STYLE_NAMES.includes(value))
      && (
        (isCaptionInputContract(inputContract) && ['style_name', 'source_style_name', 'translation_style_name'].includes(normalizedSchemaName))
        || (isMagicClipsInputContract(inputContract) && normalizedSchemaName === 'caption_style')
      )
    if (allowedValues.length > 0 && !knownCaptionStyle && !allowedValues.some((allowed) => Object.is(value, allowed) || String(value) === String(allowed))) {
      if (isImageSourceSchemaName(schemaName, port, task)) return
      issues.push({ field: schemaName, code: 'invalid_value', allowedValues })
    }
  })

  if (isTranscriptInputContract(inputContract) || isMagicClipsInputContract(inputContract)) {
    const sourceLanguage = params.source_language
    const languageOptions = buildTranscriptionLanguageOptions([
      inputContract.input_schema,
      selectedModel?.input_schema,
      discoveryTool.input_contract.input_schema,
    ])
    if (
      !isBlankValue(sourceLanguage)
      && !isPublishedTranscriptionLanguage(sourceLanguage, languageOptions)
      && !issues.some((issue) => normalizeToolInputName(issue.field) === 'source_language')
    ) {
      issues.push({
        field: 'source_language',
        code: 'invalid_value',
        allowedValues: languageOptions.map((option) => option.value),
      })
    }
  }
  if (isCaptionInputContract(inputContract)) {
    const subtitleMode = stringifySchemaValue(
      params.subtitle_mode ?? getSchemaEntry(schema, 'subtitle_mode')?.port.default,
    ) || 'original'
    if (
      (subtitleMode === 'translated' || subtitleMode === 'bilingual')
      && isBlankValue(params.target_language)
      && !issues.some((issue) => normalizeToolInputName(issue.field) === 'target_language')
    ) {
      issues.push({ field: 'target_language', code: 'required' })
    }
  }

  if (imageSourceFieldNames.length > 0 && !imageSourceProvided && !missingImageSourceReported) {
    issues.push({
      field: selectPreferredImageSourceFieldName(imageSourceFieldNames, task),
      code: 'required',
    })
  }

  if (
    isMediaDownloaderInputContract(inputContract)
    && Boolean(getMediaDownloaderSourceValidationError(stringifySchemaValue(params.url)))
  ) {
    issues.push({ field: 'url', code: 'invalid_value' })
  }
  if (isMediaDownloaderInputContract(inputContract)) {
    const startSeconds = getFiniteNumber(params.start_time)
    const endSeconds = getFiniteNumber(params.end_time)
    if (startSeconds !== null && endSeconds !== null && endSeconds <= startSeconds) {
      issues.push({ field: 'end_time', code: 'invalid_value' })
    }
  }
  if (isMediaTransformInputContract(inputContract)) {
    validateMediaTransformParams(params, issues)
  }
  if (isMagicClipsInputContract(inputContract)) {
    validateMagicClipsParams(params, issues)
    validateMediaTransformParams(params, issues)
  }
  if (isVideoToGifInputContract(inputContract)) {
    validateVideoToGifParams(params, issues)
  }
  if (isFrameExtractDiscoveryTool(discoveryTool) || isFrameExtractInputContract(inputContract)) {
    validateFrameExtractParams(params, issues)
  }

  Object.keys(params).forEach((name) => {
    if (!allowedParamKeys.has(name) && !privateParamKeys.has(name)) {
      issues.push({ field: name, code: 'unknown_field' })
    }
  })

  return issues
}

function validateMagicClipsParams(
  params: Record<string, unknown>,
  issues: ToolParamValidationIssue[],
) {
  const sourceDuration = getFiniteNumber(params.duration_sec)
  if (sourceDuration !== null && sourceDuration < VIRAL_CLIPS_MIN_SOURCE_DURATION_SEC) {
    issues.push({ field: 'duration_sec', code: 'invalid_value' })
  }
  const clipFocus = getStringValue(params.clip_focus)
  if (clipFocus && clipFocus.length > 200) {
    issues.push({ field: 'clip_focus', code: 'invalid_value' })
  }
}

function sanitizeVideoToGifLaunchParams(params: Record<string, unknown>) {
  const trim = getPortRecord(params.trim)
  const start = getFiniteNumber(trim.start_sec) ?? 0
  const end = getFiniteNumber(trim.end_sec) ?? start + DEFAULT_GIF_DURATION_SECONDS
  params.trim = { start_sec: start, end_sec: end }

  const width = coerceIntegerLaunchParam(params.width)
  if (width === undefined) delete params.width
  else params.width = width

  if (params.height !== undefined && params.height !== null) {
    const height = coerceIntegerLaunchParam(params.height)
    if (height === undefined) delete params.height
    else params.height = height
  }

  const loop = coerceIntegerLaunchParam(params.loop)
  params.loop = loop ?? 2
}

function coerceIntegerLaunchParam(value: unknown) {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN
  if (!Number.isFinite(numberValue)) return undefined
  const rounded = Math.round(numberValue)
  if (Math.abs(numberValue - rounded) > 1e-6) return undefined
  return rounded
}

function validateVideoToGifParams(
  params: Record<string, unknown>,
  issues: ToolParamValidationIssue[],
) {
  const trim = getPortRecord(params.trim)
  const startSeconds = getFiniteNumber(trim.start_sec) ?? 0
  const endSeconds = getFiniteNumber(trim.end_sec)
  const sourceDuration = getFiniteNumber(params.duration_sec)
  if (
    startSeconds < 0
    || (sourceDuration !== null && startSeconds >= sourceDuration)
    || (endSeconds !== null && (
      endSeconds <= startSeconds
      || mediaRangeExceeds(startSeconds, endSeconds, 30)
      || (sourceDuration !== null && endSeconds > sourceDuration + 0.5)
    ))
  ) {
    issues.push({ field: 'trim', code: 'invalid_value' })
  }
  const fps = getFiniteNumber(params.fps) ?? 10
  const width = getFiniteNumber(params.width) ?? 640
  const height = getFiniteNumber(params.height)
  const requestedDuration = endSeconds !== null ? endSeconds - startSeconds : 5
  if (
    height !== null
    && requestedDuration > 0
    && fps > 0
    && width > 0
    && mediaFrameCount(requestedDuration, fps) * width * height > MAX_GIF_PIXEL_FRAMES
  ) {
    issues.push({ field: 'height', code: 'invalid_value' })
  }
}

function validateFrameExtractParams(
  params: Record<string, unknown>,
  issues: ToolParamValidationIssue[],
) {
  const hasStorageObject = !isBlankValue(params.storage_object_id)
  const hasMediaReference = !isBlankValue(params.media_ref)
  if (!hasStorageObject && !hasMediaReference) {
    issues.push({ field: 'storage_object_id', code: 'required' })
  } else if (hasStorageObject && hasMediaReference) {
    issues.push({ field: 'storage_object_id', code: 'invalid_value' })
  }
  const mode = stringifySchemaValue(params.mode) || 'first'
  const sourceDuration = getFiniteNumber(params.duration_sec)
  const timestamp = getFiniteNumber(params.timestamp_sec)
  if (mode === 'timestamp') {
    if (timestamp === null) {
      issues.push({ field: 'timestamp_sec', code: 'required' })
    } else if (sourceDuration !== null && timestamp > sourceDuration + 0.5) {
      issues.push({ field: 'timestamp_sec', code: 'invalid_value' })
    }
  }
  const timestamps = Array.isArray(params.timestamps) ? params.timestamps : null
  if (mode === 'timestamps' && (!timestamps || timestamps.length === 0)) {
    issues.push({ field: 'timestamps', code: 'required' })
  } else if (
    mode === 'timestamps'
    && timestamps
    && (
      timestamps.length > 120
      || timestamps.some((value) => {
        const seconds = getFiniteNumber(value)
        return seconds === null
          || seconds < 0
          || seconds > 86_400
          || (sourceDuration !== null && seconds > sourceDuration + 0.5)
      })
    )
  ) {
    issues.push({ field: 'timestamps', code: 'invalid_value' })
  }
  if (mode === 'interval' && getFiniteNumber(params.interval_sec) === null) {
    issues.push({ field: 'interval_sec', code: 'required' })
  }
  const resize = getPortRecord(params.resize)
  const hasResizeWidth = Object.prototype.hasOwnProperty.call(resize, 'width')
  const hasResizeHeight = Object.prototype.hasOwnProperty.call(resize, 'height')
  const resizeWidth = getFiniteNumber(resize.width)
  const resizeHeight = getFiniteNumber(resize.height)
  if (
    hasResizeWidth !== hasResizeHeight
    || (hasResizeWidth && (resizeWidth === null || !Number.isInteger(resizeWidth) || resizeWidth < 16 || resizeWidth > 4096))
    || (hasResizeHeight && (resizeHeight === null || !Number.isInteger(resizeHeight) || resizeHeight < 16 || resizeHeight > 4096))
  ) {
    issues.push({ field: 'resize', code: 'invalid_value' })
  }
  if (
    resizeWidth !== null
    && resizeHeight !== null
    && Number.isInteger(resizeWidth)
    && Number.isInteger(resizeHeight)
    && resizeWidth >= 16
    && resizeWidth <= 4096
    && resizeHeight >= 16
    && resizeHeight <= 4096
    && estimateFrameExtractCount(params, mode, sourceDuration) * resizeWidth * resizeHeight
      > MAX_FRAME_EXTRACT_PIXEL_FRAMES
  ) {
    issues.push({ field: 'resize', code: 'invalid_value' })
  }
  if (mode !== 'sample_fps') return

  const startSeconds = getFiniteNumber(params.start_sec) ?? 0
  const endSeconds = getFiniteNumber(params.end_sec) ?? sourceDuration
  const samplingFps = getFiniteNumber(params.sampling_fps) ?? 1
  const maxFrames = getFiniteNumber(params.max_frames) ?? 120
  if (endSeconds !== null && endSeconds <= startSeconds) {
    issues.push({ field: 'end_sec', code: 'invalid_value' })
    return
  }
  if (sourceDuration !== null && (startSeconds >= sourceDuration || (endSeconds !== null && endSeconds > sourceDuration + 0.5))) {
    issues.push({ field: 'end_sec', code: 'invalid_value' })
    return
  }
  if (endSeconds !== null && mediaFrameCount(endSeconds - startSeconds, samplingFps) > maxFrames) {
    issues.push({ field: 'max_frames', code: 'invalid_value' })
  }
}

function estimateFrameExtractCount(
  params: Record<string, unknown>,
  mode: string,
  sourceDuration: number | null,
) {
  if (mode === 'first_last') return 2
  if (mode === 'timestamps' && Array.isArray(params.timestamps)) {
    return Math.max(1, Math.min(params.timestamps.length, 120))
  }
  if (mode === 'interval' || mode === 'evenly_spaced') {
    return Math.max(1, Math.min(Math.round(getFiniteNumber(params.count) ?? 1), 120))
  }
  if (mode !== 'sample_fps') return 1
  const startSeconds = getFiniteNumber(params.start_sec) ?? 0
  const endSeconds = getFiniteNumber(params.end_sec) ?? sourceDuration
  const samplingFps = getFiniteNumber(params.sampling_fps) ?? 1
  const maxFrames = Math.max(1, Math.min(Math.round(getFiniteNumber(params.max_frames) ?? 120), 120))
  if (endSeconds === null || endSeconds <= startSeconds || samplingFps <= 0) return maxFrames
  return Math.max(1, Math.min(mediaFrameCount(endSeconds - startSeconds, samplingFps), maxFrames))
}

function validateMediaTransformParams(
  params: Record<string, unknown>,
  issues: ToolParamValidationIssue[],
) {
  const trim = getPortRecord(params.trim)
  const hasStart = Object.prototype.hasOwnProperty.call(trim, 'start_sec')
  const hasEnd = Object.prototype.hasOwnProperty.call(trim, 'end_sec')
  const startSeconds = getFiniteNumber(trim.start_sec)
  const endSeconds = getFiniteNumber(trim.end_sec)
  const sourceDuration = getFiniteNumber(params.duration_sec)
  if (hasStart && (startSeconds === null || startSeconds < 0)) {
    issues.push({ field: 'trim', code: 'invalid_value' })
  }
  if (hasEnd && (endSeconds === null || endSeconds <= 0)) {
    issues.push({ field: 'trim', code: 'invalid_value' })
  }
  if (startSeconds !== null && endSeconds !== null && endSeconds <= startSeconds) {
    issues.push({ field: 'trim', code: 'invalid_value' })
  }
  if (
    sourceDuration !== null
    && ((startSeconds !== null && startSeconds >= sourceDuration)
      || (endSeconds !== null && endSeconds > sourceDuration + 0.5))
  ) {
    issues.push({ field: 'trim', code: 'invalid_value' })
  }

  const canvas = getPortRecord(params.canvas)
  const width = getFiniteNumber(canvas.width)
  const height = getFiniteNumber(canvas.height)
  const hasWidth = Object.prototype.hasOwnProperty.call(canvas, 'width')
  const hasHeight = Object.prototype.hasOwnProperty.call(canvas, 'height')
  const dimensionsMissing = hasWidth !== hasHeight
    || (stringifySchemaValue(canvas.aspect_ratio) === 'custom' && (!hasWidth || !hasHeight))
  const dimensionsInvalid = (hasWidth && (width === null || !Number.isInteger(width) || width < 64 || width > 4096))
    || (hasHeight && (height === null || !Number.isInteger(height) || height < 64 || height > 4096))
  if (dimensionsMissing || dimensionsInvalid) {
    issues.push({ field: 'canvas', code: 'invalid_value' })
  }

  const output = getPortRecord(params.output)
  const volumePercent = getFiniteNumber(output.volume_percent)
  if (volumePercent !== null && (volumePercent < 0 || volumePercent > 200)) {
    issues.push({ field: 'output', code: 'invalid_value' })
  }
}

function normalizePublicMediaTransformFraming(value: unknown) {
  const framing = getPortRecord(value)
  const mode = getStringValue(framing.mode)?.trim().toLowerCase()
  if (mode === 'face_track' || mode === 'smart_layout') {
    return { mode: 'face_track', tracking_profile: 'steady_face_v2' }
  }
  if (mode === 'none') return { mode: 'none' }
  return framing
}

function getToolParamTypeError(value: unknown, port: Record<string, unknown>) {
  const type = getPortType(port)
  if (!type || type === 'any') return null
  if (type === 'string') return typeof value === 'string' ? null : 'string'
  if (type === 'integer' || type === 'int') return isIntegerLike(value) ? null : 'integer'
  if (type === 'number' || type === 'float') return getFiniteNumber(value) === null ? 'number' : null
  if (type === 'boolean' || type === 'bool') return isBooleanLike(value) ? null : 'boolean'
  if (type === 'array' || type === 'list') return Array.isArray(value) ? null : 'array'
  if (type === 'object' || type === 'dict') return value && typeof value === 'object' && !Array.isArray(value) ? null : 'object'
  return null
}

function formatToolParamValidationIssue(issue: ToolParamValidationIssue) {
  const label = formatToolInputFieldLabel(issue.field)
  if (issue.code === 'required') return `${label} required`
  if (issue.code === 'invalid_type') return `${label} must be ${issue.expected ?? 'valid'}`
  if (issue.code === 'invalid_value') return `${label} not supported`
  if (issue.code === 'below_min_value') return `${label} min ${issue.minValue}`
  if (issue.code === 'above_max_value') return `${label} max ${issue.maxValue}`
  return `${label} invalid`
}

function hasSchemaField(schema: Record<string, unknown>, name: string) {
  return Boolean(getSchemaEntry(schema, name))
}

function getSchemaEntry(
  schema: Record<string, unknown>,
  name: string,
): { name: string; port: Record<string, unknown> } | null {
  if (Object.prototype.hasOwnProperty.call(schema, name)) {
    return { name, port: getPortRecord(schema[name]) }
  }

  const normalizedName = normalizeToolInputName(name)
  const entry = Object.entries(schema).find(([schemaName, rawPort]) => {
    const port = getPortRecord(rawPort)
    return normalizeToolInputName(schemaName) === normalizedName
      || normalizeToolInputName(getStringValue(port.name) ?? '') === normalizedName
  })

  return entry ? { name: entry[0], port: getPortRecord(entry[1]) } : null
}

function isPublicToolConfigInput(
  name: string,
  port: Record<string, unknown>,
  inputClassification: Record<string, unknown> | undefined,
) {
  if (isServerManagedToolFieldName(name)) return false
  if (isPrivateToolFieldName(name)) return false
  if (port.secret === true || port.internal === true || port.sensitive === true) return false

  const classification = getPortRecord(inputClassification?.[name])
  if (classification.exposed_to_assistant === false) return false
  if (classification.accepts_config === false) return false

  const exposure = [
    classification.exposure,
    classification.visibility,
    classification.scope,
    classification.kind,
    classification.classification,
  ].map(getStringValue).filter(Boolean).join(' ').toLowerCase()
  return !/\b(internal|secret|credential|system|hidden)\b/.test(exposure)
}

function isServerManagedToolFieldName(name: string) {
  return normalizeToolInputName(name) === 'consent_record_id'
}

function isPrivateToolFieldName(name: string) {
  const normalizedName = normalizeToolInputName(name)
  return /^(?:provider(?:_|$)|vendor(?:_|$)|upstream(?:_|$)|runtime(?:_|$)|deployment(?:_|$)|endpoint(?:_|$)|routing(?:_|$))/.test(normalizedName)
    || ['backend_model_id', 'api_model', 'base_url', 'api_base_url'].includes(normalizedName)
    || normalizedName === 'api_key'
    || normalizedName.endsWith('_api_key')
    || normalizedName.includes('secret')
    || normalizedName.includes('credential')
    || isPrivatePublicMetadataKey(normalizedName)
    || /(?:^|_)(?:access|refresh|bearer|session)_?token$/.test(normalizedName)
    || normalizedName === 'token'
}

function isStandardToolSchemaField(
  tool: ToolConfig,
  name: string,
  standardFields?: StandardToolFieldSupport,
) {
  const normalizedName = normalizeSchemaFieldName(name)
  const controlledFields = new Set<string>()

  Object.values(standardFields ?? {}).forEach((binding) => {
    if (binding?.name) controlledFields.add(normalizeSchemaFieldName(binding.name))
  })

  return controlledFields.has(normalizedName)
}

const MODEL_METADATA_SCHEMA_FIELDS = new Set([
  'aspect_ratios',
  'backgrounds',
  'custom_size_rule',
  'custom_size_supported',
  'default_aspect_ratio',
  'default_background',
  'default_input_fidelity',
  'default_output_compression',
  'default_output_format',
  'default_output_language',
  'default_quality',
  'default_resolution',
  'default_size',
  'default_style',
  'default_task',
  'default_response_format',
  'default_source_language',
  'default_timestamp_granularity',
  'first_frame_supported',
  'image_input_supported',
  'image_size_map',
  'input_fidelities',
  'input_fidelity_supported',
  'last_frame_supported',
  'max_images_per_run',
  'output_compression_formats',
  'output_compression_supported',
  'output_formats',
  'output_languages',
  'qualities',
  'reference_image_fields',
  'reference_image_supported',
  'response_formats',
  'resolutions',
  'settings',
  'sizes',
  'source_languages',
  'styles',
  'supported_audio_formats',
  'timestamp_granularities',
  'tasks',
])

const ADVANCED_QUICK_TOOL_FIELDS = new Set([
  'background',
  'first_frame_url',
  'input_fidelity',
  'last_frame_url',
  'output_compression',
  'output_format',
  'reference_image_urls',
  'style',
])

const RESEARCH_AGENT_ADVANCED_SCHEMA_FIELDS = new Set([
  'execution',
  'operation',
  'use_case',
  'target',
  'keywords',
  'location_code',
  'language_code',
  'time_range',
  'max_credits',
  'output_format',
])

const HIDDEN_QUICK_IMAGE_AGENT_FIELDS = new Set([
  'background',
  'first_frame_url',
  'input_fidelity',
  'last_frame_url',
  'output_compression',
  'output_format',
  'reference_image_urls',
  'style',
])

const IMAGE_SOURCE_INPUT_FIELDS = new Set([
  'image_urls',
  'input_image_url',
  'input_references',
  'init_image_url',
  'reference_image_urls',
  'source_image_url',
])

const FLUX_KLEIN_UNSUPPORTED_FIELDS = new Set([
  'aspect_ratio',
  'background',
  'input_fidelity',
  'output_compression',
  'quality',
  'resolution',
  'size',
  'style',
])

const PROVIDER_PARAMETER_ALIASES_BY_FIELD: Record<string, string[]> = {
  aspect_ratio: ['aspect_ratio'],
  background: ['background'],
  count: ['n', 'count'],
  image_urls: ['input_references', 'image_urls', 'reference_image_urls'],
  input_fidelity: ['input_fidelity'],
  output_compression: ['output_compression'],
  output_format: ['output_format'],
  quality: ['quality'],
  reference_image_urls: ['input_references', 'reference_image_urls', 'image_urls'],
  resolution: ['resolution', 'size'],
  seed: ['seed'],
  size: ['size', 'resolution'],
  style: ['style'],
}

const PROVIDER_PARAMETER_RESTRICTED_FIELDS = new Set(Object.keys(PROVIDER_PARAMETER_ALIASES_BY_FIELD))

const QUICK_SCHEMA_FIELDS_BY_KIND: Record<ToolConfig['modelKind'], Set<string>> = {
  image: new Set(['aspect_ratio', 'count', 'quality', 'resolution']),
  video: new Set(['duration', 'motion', 'resolution']),
  voice: new Set([]),
  agent: new Set([]),
}

function isCaptionToolConfig(tool: ToolConfig) {
  return [tool.id, tool.title, tool.shortTitle, tool.badge].join(' ').toLowerCase().includes('caption')
}

function resolveDisplayedToolCredits(
  _tool: ToolConfig,
  localEstimatedCredits: number | null,
  serverEstimatedCredits: number | null,
) {
  // The query key binds this quote to the current model and complete params
  // fingerprint. Local catalog hints are only placeholders until it arrives.
  return serverEstimatedCredits ?? localEstimatedCredits
}

function normalizeCaptionSubtitleMode(value: unknown): CaptionSubtitleMode {
  const normalized = stringifySchemaValue(value).toLowerCase()
  if (normalized === 'translated' || normalized === 'bilingual') return normalized
  return 'original'
}

function normalizeCaptionBilingualOrder(value: unknown): CaptionBilingualOrder {
  return stringifySchemaValue(value).toLowerCase() === 'translation_above'
    ? 'translation_above'
    : 'source_above'
}

function normalizeCaptionDualStyleName(value: unknown) {
  const normalized = stringifySchemaValue(value).trim()
  return normalized || 'inherit'
}

function buildCaptionRunPreview(values: ToolSchemaValues): CaptionRunPreview {
  return {
    styleName: stringifySchemaValue(values.style_name) || 'auto',
    fontSize: getNumberValue(values.font_size) ?? DEFAULT_CAPTION_FONT_SIZE,
    position: stringifySchemaValue(values.position) || 'style_default',
    subtitleMode: normalizeCaptionSubtitleMode(values.subtitle_mode),
    targetLanguage: stringifySchemaValue(values.target_language) || 'en',
    bilingualOrder: normalizeCaptionBilingualOrder(values.bilingual_order),
    sourceStyleName: normalizeCaptionDualStyleName(values.source_style_name),
    translationStyleName: normalizeCaptionDualStyleName(values.translation_style_name),
    sourceFontScale: normalizeCaptionFontScale(values.source_font_scale, 0.8),
    translationFontScale: normalizeCaptionFontScale(values.translation_font_scale, 1),
    visibilityOverrides: readCaptionVisibilityOverrides(values.overrides),
  }
}

function resolveCaptionAdvancedStyleName(
  styleName: string,
  sourceMedia?: Pick<ToolRunSourceMedia, 'width' | 'height' | 'durationSeconds'> | null,
) {
  if (!sourceMedia) return styleName
  return resolveCaptionPreviewStyleName(
    styleName,
    sourceMedia.width,
    sourceMedia.height,
    sourceMedia.durationSeconds,
  )
}

const TRANSCRIPT_QUICK_SCHEMA_FIELDS = new Set([
  'storage_object_id',
])

const TRANSCRIPT_ADVANCED_SCHEMA_FIELDS = new Set([
  'source_language',
  'timestamps',
])

const DEPRECATED_TRANSCRIPT_FIELDS = new Set([
  'target_language',
  'output_language',
  'task',
])

const MEDIA_DOWNLOADER_QUICK_SCHEMA_FIELDS = new Set([
  'url',
  'download_variant',
  'quality',
  'start_time',
  'end_time',
])

const MEDIA_DOWNLOADER_ADVANCED_SCHEMA_FIELDS = new Set<string>()

const MEDIA_DOWNLOADER_CUSTOM_SCHEMA_FIELDS = new Set([
  'url',
  'urls',
  'allow_playlist',
  'download_variant',
  'quality',
  'start_time',
  'end_time',
])

const MEDIA_DOWNLOADER_DOWNLOAD_ONLY_SCHEMA_FIELDS = new Set([
  'download_variant',
  'quality',
  'start_time',
  'end_time',
])

type MediaDownloaderClipMode = 'full' | 'clip'

const MEDIA_DOWNLOADER_MAX_OUTPUT_ITEMS = 100
const MEDIA_DOWNLOADER_CLIP_MODE_FIELD = '__media_downloader_clip_mode'

function isDeprecatedTranscriptField(name: string) {
  return DEPRECATED_TRANSCRIPT_FIELDS.has(normalizeToolInputName(name))
}

const CAPTION_SOURCE_SCHEMA_FIELDS = new Set([
  'storage_object_id',
  'media_ref',
  'video_url',
  'video_duration',
  'video_width',
  'video_height',
])

const CAPTION_QUICK_SCHEMA_FIELDS = new Set([
  'source_language',
  'style_name',
  'subtitle_mode',
  'target_language',
  'bilingual_order',
  'source_style_name',
  'translation_style_name',
  'source_font_scale',
  'translation_font_scale',
  'font_size',
  'position',
])

const CAPTION_DUAL_LAYOUT_SCHEMA_FIELDS = new Set([
  'bilingual_order',
  'source_style_name',
  'translation_style_name',
  'source_font_scale',
  'translation_font_scale',
])

const MAGIC_CLIPS_QUICK_SCHEMA_FIELDS = new Set([
  'storage_object_id',
  'duration_sec',
  'source_language',
  'clip_focus',
  'editorial_quality',
  'remove_silence',
  'censor',
  'censor_audio_mode',
  'censor_sound',
  'layout',
  'model_id',
  'captions_enabled',
  'caption_language',
  'caption_style',
  'caption_position',
  'caption_font_size',
  'caption_quality',
])

const CAPTION_FIELD_ORDER = new Map([
  ['source_language', 0],
  ['subtitle_mode', 1],
  ['target_language', 2],
  ['bilingual_order', 3],
  ['style_name', 4],
  ['position', 5],
  ['font_size', 6],
])

function orderCaptionVisibleFields(fields: Array<[string, unknown]>) {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((left, right) => {
      const leftPriority = CAPTION_FIELD_ORDER.get(normalizeToolInputName(left.field[0])) ?? 100
      const rightPriority = CAPTION_FIELD_ORDER.get(normalizeToolInputName(right.field[0])) ?? 100
      return leftPriority - rightPriority || left.index - right.index
    })
    .map(({ field }) => field)
}

function isCaptionLanguageFieldVisible(name: string, subtitleMode: string) {
  const normalizedName = normalizeToolInputName(name)
  if (normalizedName === 'target_language') return subtitleMode !== 'original'
  if (CAPTION_DUAL_LAYOUT_SCHEMA_FIELDS.has(normalizedName)) return subtitleMode === 'bilingual'
  return true
}

const SPEECH_QUICK_SCHEMA_FIELDS = new Set([
  'language',
  'voice_profile_id',
  'emotion',
  'speed',
  'volume',
])

const SPEECH_ADVANCED_SCHEMA_FIELDS = new Set([
  'output_format',
  'encoding',
  'bit_rate',
  'seed',
  'pronunciation_dictionary_id',
])

const VOICE_CLONE_QUICK_SCHEMA_FIELDS = new Set([
  'target_speech_model_id',
  'language',
  'display_name',
  'reference_storage_object_id',
])

function orderVoiceVisibleFields(
  fields: Array<[string, unknown]>,
  instantClone: boolean,
) {
  const priorities = instantClone
    ? new Map([
        ['reference_storage_object_id', 10],
        ['display_name', 20],
        ['target_speech_model_id', 30],
        ['language', 40],
      ])
    : new Map([
        ['language', 10],
        ['voice_profile_id', 20],
        ['emotion', 30],
        ['speed', 40],
        ['volume', 50],
      ])
  return fields
    .map((field, index) => ({ field, index }))
    .sort((left, right) => {
      const leftPriority = priorities.get(normalizeToolInputName(left.field[0])) ?? 100
      const rightPriority = priorities.get(normalizeToolInputName(right.field[0])) ?? 100
      return leftPriority - rightPriority || left.index - right.index
    })
    .map(({ field }) => field)
}

function getCaptionSchemaFieldHelp(name: string, value: string, displayedValue = value) {
  if (name === 'quality') {
    const descriptions: Record<string, string> = {
      economy: 'Fastest CPU encode (CRF 23 / veryfast), smaller and slightly softer output; caption render credits ×0.85 (about 15% less).',
      standard: 'Balanced CPU encode (CRF 20 / faster) and file size; caption render credits ×1.0.',
      high: 'Slowest CPU encode (CRF 18 / fast), sharper and usually larger output; caption render credits ×1.25 (25% more).',
    }
    return `${descriptions[value] ?? descriptions.standard} Video duration and source resolution still drive most of the processing time; transcript accuracy is unchanged.`
  }
  if (name === 'position') {
    return value === 'style_default'
      ? `${formatSchemaOptionLabel(displayedValue)} is the selected style's default placement.`
      : `Overrides the selected style and places captions at the ${value}.`
  }
  return null
}

function shouldUseSchemaDrivenToolField(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  name: string,
  port: Record<string, unknown>,
  standardFields?: StandardToolFieldSupport,
  mode = '',
) {
  if (!isSchemaFieldVisible(inputContract, name, port)) return false
  const normalizedName = normalizeToolInputName(name)
  if (
    isAngleInputContract(inputContract)
    && ['source_image', 'angles', 'prompt', 'model_id'].includes(normalizedName)
  ) return true
  if (isStandardToolSchemaField(tool, name, standardFields)) return false

  if (isUnsupportedQuickModelField(inputContract, normalizedName)) return false
  if (normalizedName === 'count' && getModelMaxImagesPerRun(inputContract) <= 1) return false
  if (isImageSourceSchemaEntry(tool, name, port, mode)) return true
  if (isMediaDownloaderTool(tool, inputContract)) {
    if (mode === 'metadata' && MEDIA_DOWNLOADER_DOWNLOAD_ONLY_SCHEMA_FIELDS.has(normalizedName)) return false
    return MEDIA_DOWNLOADER_QUICK_SCHEMA_FIELDS.has(normalizedName) && hasBasicSchemaFieldEditor(port)
  }
  if (isTranscriptTool(tool, inputContract)) {
    return TRANSCRIPT_QUICK_SCHEMA_FIELDS.has(normalizedName) && hasBasicSchemaFieldEditor(port)
  }
  if (isCaptionTool(tool, inputContract) && CAPTION_SOURCE_SCHEMA_FIELDS.has(normalizedName)) {
    return true
  }
  if (isCaptionTool(tool, inputContract) && CAPTION_QUICK_SCHEMA_FIELDS.has(normalizedName)) {
    return hasBasicSchemaFieldEditor(port)
  }
  if (isMagicClipsTool(tool, inputContract)) {
    return MAGIC_CLIPS_QUICK_SCHEMA_FIELDS.has(normalizedName) && hasBasicSchemaFieldEditor(port)
  }
  if (isMediaTransformTool(tool, inputContract)) {
    return ['storage_object_id', 'duration_sec'].includes(normalizedName) && hasBasicSchemaFieldEditor(port)
  }
  if (isVideoToGifInputContract(inputContract) && normalizedName === normalizeToolInputName('gif_delivery')) {
    return false
  }
  if (isVideoToGifInputContract(inputContract) || isFrameExtractTool(tool, inputContract)) {
    return hasBasicSchemaFieldEditor(port)
  }
  if (isInstantVoiceCloneInputContract(inputContract)) {
    return VOICE_CLONE_QUICK_SCHEMA_FIELDS.has(normalizedName) && hasBasicSchemaFieldEditor(port)
  }
  if (isSpeechGenerateInputContract(inputContract)) {
    if (SPEECH_ADVANCED_SCHEMA_FIELDS.has(normalizedName)) return false
    return SPEECH_QUICK_SCHEMA_FIELDS.has(normalizedName)
      ? hasBasicSchemaFieldEditor(port)
      : readPortBoolean(port, 'required')
  }
  if (MODEL_METADATA_SCHEMA_FIELDS.has(normalizedName)) return false
  if (ADVANCED_QUICK_TOOL_FIELDS.has(normalizedName)) return false

  if (QUICK_SCHEMA_FIELDS_BY_KIND[tool.modelKind].has(normalizedName)) {
    return isNumberPort(port)
      || isBooleanPort(port)
      || getSchemaOptionValuesForField(inputContract.input_schema, name, port).length > 0
  }
  return readPortBoolean(port, 'required')
}

function hasBasicSchemaFieldEditor(port: Record<string, unknown>) {
  return isStringPort(port)
    || isListPort(port)
    || isNumberPort(port)
    || isBooleanPort(port)
    || getSchemaOptionValues(port).length > 0
}

function isMediaTransformTool(tool: ToolConfig, inputContract: DiscoveryToolCatalogItem['input_contract']) {
  if (isMediaTransformInputContract(inputContract)) return true
  const token = [tool.id, tool.title, inputContract.node_type].join(' ').toLowerCase()
  return token.includes('media_transform') || token.includes('media-transform')
}

function isMediaTransformInputContract(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const nodeType = inputContract.node_type.toLowerCase()
  return nodeType === 'media_transform' || nodeType.startsWith('media_transform@')
}

function isVideoToGifInputContract(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const nodeType = inputContract.node_type.toLowerCase()
  return nodeType === 'video_to_gif' || nodeType.startsWith('video_to_gif@')
}

function isFrameExtractInputContract(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const nodeType = inputContract.node_type.toLowerCase()
  return nodeType === 'frame_extract' || nodeType.startsWith('frame_extract@')
}

function isFrameExtractToolConfig(tool: ToolConfig) {
  const token = [tool.id, tool.title, tool.shortTitle].join(' ').toLowerCase()
  return token.includes('frame-extract') || token.includes('frame extract') || token.includes('frame_extract')
}

function isFrameExtractDiscoveryTool(tool: DiscoveryToolCatalogItem) {
  const token = [tool.tool_id, tool.title].join(' ').toLowerCase()
  return token.includes('frame-extract') || token.includes('frame extract') || token.includes('frame_extract')
}

function isFrameExtractTool(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'] | undefined,
) {
  return isFrameExtractToolConfig(tool)
    || Boolean(inputContract && isFrameExtractInputContract(inputContract))
}

function isMagicClipsToolConfig(tool: ToolConfig) {
  const token = [tool.id, tool.title, tool.shortTitle, tool.badge].join(' ').toLowerCase()
  return token.includes('viral-clips')
    || token.includes('viral clips')
    || token.includes('viral_clips')
    || token.includes('magic-clips')
    || token.includes('viral-shorts')
    || token.includes('magic clip')
    || token.includes('magic_clips')
}

function isMagicClipsDiscoveryTool(tool: DiscoveryToolCatalogItem) {
  if (isMagicClipsInputContract(tool.input_contract)) return true
  const token = [tool.tool_id, tool.title, tool.short_title, tool.execution.node_type].join(' ').toLowerCase()
  return token.includes('magic_clips')
    || token.includes('viral_clips')
    || token.includes('viral-clips')
    || token.includes('viral clips')
    || token.includes('magic-clips')
    || token.includes('magic clips')
    || token.includes('viral-shorts')
}

function isMagicClipsTool(tool: ToolConfig, inputContract: DiscoveryToolCatalogItem['input_contract']) {
  if (isMagicClipsInputContract(inputContract)) return true
  const token = [tool.id, tool.title, tool.shortTitle, inputContract.node_type].join(' ').toLowerCase()
  return token.includes('magic_clips')
    || token.includes('viral_clips')
    || token.includes('viral-clips')
    || token.includes('viral clips')
    || token.includes('magic-clips')
    || token.includes('magic clips')
    || token.includes('magic clip')
    || token.includes('viral-shorts')
}

function isMagicClipsInputContract(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const nodeType = inputContract.node_type.toLowerCase()
  return nodeType === 'viral_clips'
    || nodeType.startsWith('viral_clips@')
    || nodeType === 'magic_clips'
    || nodeType.startsWith('magic_clips@')
}

function isTranscriptTool(tool: ToolConfig, inputContract: DiscoveryToolCatalogItem['input_contract']) {
  if (isTranscriptInputContract(inputContract)) return true
  const providerRequirement = getPortRecord(inputContract.provider_requirement)
  const token = [
    tool.id,
    tool.title,
    tool.shortTitle,
    tool.badge,
    getStringValue(providerRequirement.capability) ?? '',
  ].join(' ').toLowerCase()
  return token.includes('transcript')
    || token.includes('transcribe')
    || token.includes('transcription')
    || token.includes('audio.transcribe')
    || token.includes('speech.to_text')
    || token.includes('speech-to-text')
    || token.includes('speech to text')
}

function isMediaDownloaderTool(tool: ToolConfig, inputContract: DiscoveryToolCatalogItem['input_contract']) {
  if (isMediaDownloaderInputContract(inputContract)) return true
  return isMediaDownloaderToolConfig(tool)
}

function isMediaDownloaderToolConfig(tool: ToolConfig) {
  const token = [tool.id, tool.title, tool.shortTitle, tool.badge].join(' ').toLowerCase()
  return token.includes('media_downloader')
    || token.includes('media-downloader')
    || token.includes('media downloader')
}

function getToolPrimaryActionLabel(
  tool: ToolConfig,
  inputContract?: DiscoveryToolCatalogItem['input_contract'],
) {
  if (inputContract && isInstantVoiceCloneInputContract(inputContract)) return 'Create voice'
  if (inputContract && isMediaDownloaderTool(tool, inputContract)) return 'Download'
  return 'Generate'
}

function isMediaDownloaderInputContract(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const nodeType = inputContract.node_type.toLowerCase()
  return nodeType === 'media_downloader' || nodeType.startsWith('media_downloader@')
}

function isTranscriptInputContract(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const providerRequirement = getPortRecord(inputContract.provider_requirement)
  const token = [
    inputContract.node_type,
    inputContract.artifact_output_type,
    getStringValue(providerRequirement.capability) ?? '',
  ].join(' ').toLowerCase()
  return token.includes('transcript')
    || token.includes('transcribe')
    || token.includes('transcription')
    || token.includes('audio.transcribe')
    || token.includes('speech.to_text')
    || token.includes('speech-to-text')
    || token.includes('speech to text')
}

function isCaptionInputContract(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const token = [
    inputContract.node_type,
    inputContract.artifact_output_type,
  ].join(' ').toLowerCase()
  return token.includes('caption') || token.includes('subtitle')
}

function withCaptionFontSizePort(
  schema: Record<string, unknown>,
  inputContract: DiscoveryToolCatalogItem['input_contract'] | undefined,
) {
  if (!inputContract || !isCaptionInputContract(inputContract) || getSchemaEntry(schema, 'font_size')) return schema
  const entries = Object.entries(schema)
  const styleIndex = entries.findIndex(([name]) => normalizeToolInputName(name) === 'style_name')
  entries.splice(styleIndex >= 0 ? styleIndex + 1 : entries.length, 0, ['font_size', CAPTION_FONT_SIZE_PORT])
  return Object.fromEntries(entries)
}

function isCaptionTool(tool: ToolConfig, inputContract: DiscoveryToolCatalogItem['input_contract']) {
  // Viral Clips can advertise optional caption burn-in in catalog labels, but
  // it owns a composite input form with exactly one media selector. Treating
  // that label as a standalone Caption contract renders a second selector.
  if (isMagicClipsInputContract(inputContract)) return false
  const token = [
    tool.id,
    tool.title,
    tool.shortTitle,
    tool.badge,
    inputContract.node_type,
    inputContract.artifact_output_type,
  ].join(' ').toLowerCase()
  return isCaptionInputContract(inputContract) || token.includes('caption') || token.includes('subtitle')
}

function isAdvancedToolSchemaField(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  name: string,
  port: Record<string, unknown>,
  standardFields?: StandardToolFieldSupport,
  mode = '',
) {
  if (!isSchemaFieldVisible(inputContract, name, port)) return false
  if (isStandardToolSchemaField(tool, name, standardFields)) return false
  const normalizedName = normalizeToolInputName(name)
  if (isResearchAgentTool(tool, inputContract)) {
    return RESEARCH_AGENT_ADVANCED_SCHEMA_FIELDS.has(normalizedName) && hasBasicSchemaFieldEditor(port)
  }
  if (isMediaDownloaderTool(tool, inputContract)) {
    if (!MEDIA_DOWNLOADER_ADVANCED_SCHEMA_FIELDS.has(normalizedName)) return false
    if (mode === 'metadata' && MEDIA_DOWNLOADER_DOWNLOAD_ONLY_SCHEMA_FIELDS.has(normalizedName)) return false
    return hasBasicSchemaFieldEditor(port)
  }
  if (isTranscriptTool(tool, inputContract) && TRANSCRIPT_ADVANCED_SCHEMA_FIELDS.has(normalizedName)) {
    return hasBasicSchemaFieldEditor(port)
  }
  if (isCaptionTool(tool, inputContract)) {
    if (normalizedName === 'quality') return hasBasicSchemaFieldEditor(port)
    return normalizedName === 'overrides' && isObjectPort(port)
  }
  if (isMagicClipsTool(tool, inputContract)) {
    return ['caption_overrides', 'canvas', 'output'].includes(normalizedName) && isObjectPort(port)
  }
  if (isMediaTransformTool(tool, inputContract)) {
    return ['trim', 'canvas', 'framing', 'output', 'effects'].includes(normalizedName) && isObjectPort(port)
  }
  if (isVideoToGifInputContract(inputContract)) {
    return normalizedName === 'trim' && isObjectPort(port)
  }
  if (isSpeechGenerateInputContract(inputContract)) {
    return SPEECH_ADVANCED_SCHEMA_FIELDS.has(normalizedName) && hasBasicSchemaFieldEditor(port)
  }
  if (!HIDDEN_QUICK_IMAGE_AGENT_FIELDS.has(normalizedName)) return false
  if (isUnsupportedQuickModelField(inputContract, normalizedName)) return false
  return hasAdvancedToolFieldSupport(tool, inputContract, normalizedName, port)
}

function hasAdvancedToolFieldSupport(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  normalizedName: string,
  port: Record<string, unknown>,
) {
  if (tool.modelKind !== 'image') return false
  const schema = inputContract.input_schema
  if (isFluxKleinInputContract(inputContract) && normalizedName === 'output_format') return true
  if (normalizedName === 'style') return getSchemaArrayValues(schema, 'styles').length > 0
  if (normalizedName === 'background') return getSchemaArrayValues(schema, 'backgrounds').length > 0
  if (normalizedName === 'output_format') {
    return getSchemaArrayValues(schema, 'output_formats').length > 0 || getSchemaOptionValues(port).length > 0
  }
  if (normalizedName === 'input_fidelity') {
    return schema.input_fidelity_supported === true || getSchemaArrayValues(schema, 'input_fidelities').length > 0
  }
  if (normalizedName === 'output_compression') return schema.output_compression_supported === true
  return false
}

function isUnsupportedQuickModelField(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  normalizedName: string,
) {
  if (isProviderToolInputUnsupported(inputContract, normalizedName)) return true
  if (hasProviderSupportedParameters(inputContract)) return false
  return isFluxKleinInputContract(inputContract)
    && FLUX_KLEIN_UNSUPPORTED_FIELDS.has(normalizedName)
}

function isProviderToolInputUnsupported(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  normalizedName: string,
) {
  if (!PROVIDER_PARAMETER_RESTRICTED_FIELDS.has(normalizedName)) return false
  if (!hasProviderSupportedParameters(inputContract)) return false
  return !isProviderToolInputSupported(inputContract, normalizedName)
}

function isProviderToolInputSupported(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  normalizedName: string,
) {
  const supported = getProviderSupportedParameters(inputContract)
  if (supported.size === 0) return true
  const aliases = PROVIDER_PARAMETER_ALIASES_BY_FIELD[normalizedName] ?? [normalizedName]
  return aliases.some((alias) => supported.has(alias))
}

function hasProviderSupportedParameters(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  return getProviderSupportedParameters(inputContract).size > 0
}

function getProviderSupportedParameters(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const schema = inputContract.input_schema
  const raw = schema.supported_parameters
  const supported = new Set<string>()

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      const value = typeof item === 'string'
        ? item
        : getStringValue(getPortRecord(item).name)
      if (value) supported.add(normalizeToolInputName(value))
    })
    return supported
  }

  if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach((key) => supported.add(normalizeToolInputName(key)))
  }

  return supported
}

function isFluxKleinInputContract(inputContract: DiscoveryToolCatalogItem['input_contract'] | undefined) {
  const providerRequirement = getPortRecord(inputContract?.provider_requirement)
  const modelId = String(inputContract?.model_id ?? providerRequirement.selected_model_id ?? '')
  return isFluxKleinModelId(modelId)
}

function isFluxKleinModelId(modelId: string | undefined) {
  return modelId === 'flux-2-klein-4b'
}

function getModelMaxImagesPerRun(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const maxImages = getFiniteNumber(inputContract.input_schema.max_images_per_run)
  return maxImages === null ? Number.POSITIVE_INFINITY : Math.max(1, Math.trunc(maxImages))
}

function isSchemaDefaultValue(value: unknown, port: Record<string, unknown>) {
  const defaultValue = readPortDefaultValue(port)
  if (defaultValue === undefined || defaultValue === null) return false
  if (typeof value === 'object' && typeof defaultValue === 'object') {
    return stableStringify(value) === stableStringify(defaultValue)
  }
  return String(value) === String(defaultValue)
}

function isImageSourceInputField(tool: ToolConfig, normalizedName: string, mode: string) {
  if (tool.modelKind !== 'image' || !IMAGE_SOURCE_INPUT_FIELDS.has(normalizedName)) return false
  return isImageSourceTask(mode)
}

function isImageSourceTask(mode: string) {
  const task = mapToolModeToNodeTask(mode || '')
  return task === 'image_to_image'
    || task === 'image_edit'
    || task === 'reference_image'
    || task === 'first_last_frame'
}

function isImageSourceSchemaEntry(
  tool: ToolConfig,
  name: string,
  port: Record<string, unknown>,
  mode: string,
) {
  return getImageSourceSchemaAliases(name, port)
    .some((fieldName) => isImageSourceInputField(tool, fieldName, mode))
}

function isImageSourceSchemaName(name: string, port: Record<string, unknown>, mode: string) {
  if (!isImageSourceTask(mode)) return false
  return getImageSourceSchemaAliases(name, port)
    .some((fieldName) => IMAGE_SOURCE_INPUT_FIELDS.has(fieldName))
}

function getImageSourceSchemaAliases(name: string, port: Record<string, unknown>) {
  return uniqueCompact([name, getStringValue(port.name) ?? undefined])
    .map((fieldName) => normalizeToolInputName(fieldName))
}

function selectPreferredImageSourceFieldName(fieldNames: string[], mode: string) {
  const byNormalizedName = new Map(fieldNames.map((fieldName) => [normalizeToolInputName(fieldName), fieldName]))
  for (const normalizedName of getImageSourceFieldPriority(mode)) {
    const fieldName = byNormalizedName.get(normalizedName)
    if (fieldName) return fieldName
  }
  return fieldNames[0] ?? ''
}

function getImageSourceFieldPriority(mode: string) {
  const task = mapToolModeToNodeTask(mode || '')
  if (task === 'reference_image') {
    return ['reference_image_urls', 'input_references', 'image_urls', 'input_image_url', 'source_image_url', 'init_image_url']
  }
  if (task === 'image_edit') {
    return ['image_urls', 'input_image_url', 'init_image_url', 'input_references', 'source_image_url', 'reference_image_urls']
  }
  return ['image_urls', 'input_image_url', 'input_references', 'init_image_url', 'source_image_url', 'reference_image_urls']
}

function hasImageSourceParamValue(
  schema: Record<string, unknown>,
  params: Record<string, unknown>,
  mode: string,
) {
  if (!isImageSourceTask(mode)) return false
  return Object.entries(params).some(([name, value]) => {
    if (isBlankValue(value)) return false
    const entry = getSchemaEntry(schema, name)
    return isImageSourceSchemaName(entry?.name ?? name, entry?.port ?? {}, mode)
  })
}

function isSchemaFieldVisible(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  name: string,
  port = getSchemaEntry(inputContract.input_schema, name)?.port ?? {},
) {
  if (isMagicClipsInputContract(inputContract) && RETIRED_VIRAL_CLIPS_FIELDS.has(normalizeToolInputName(name))) return false
  return isPublicToolConfigInput(name, port, inputContract.input_classification)
}

function coerceSchemaValue(value: unknown, port: Record<string, unknown>) {
  if (value === undefined || value === null) return value
  if (isNumberPort(port)) {
    if (typeof value === 'string' && value.trim() === '') return undefined
    const numberValue = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numberValue) ? numberValue : value
  }
  if (isBooleanPort(port)) return toBoolean(value)
  if ((getPortType(port) === 'array' || getPortType(port) === 'list') && typeof value === 'string') {
    return value.split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean)
  }
  if (isObjectPort(port) && typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : value
    } catch {
      return value
    }
  }
  return value
}

function formatSchemaObjectEditorValue(value: unknown) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function mapToolModeToNodeTask(mode: string) {
  switch (mode) {
    case 'frame-video':
    case 'image-video':
      return 'image_to_video'
    case 'image-image':
      return 'image_to_image'
    case 'video-video':
      return 'video_to_video'
    case 'text-video':
      return 'text_to_video'
    case 'image-edit':
      return 'image_edit'
    case 'text-image':
      return 'text_to_image'
    case 'compose':
      return 'compose'
    case 'auto-captions':
      return 'auto_captions'
    case 'style-captions':
      return 'style_captions'
    case 'translate':
      return 'translate'
    default:
      return mode.replace(/-/g, '_')
  }
}

function shouldPollAgentStatus(status: string | null | undefined) {
  const normalized = status?.toLowerCase()
  if (!normalized) return true
  return !isRecentWorkflowHandoffTerminalStatus(normalized)
}

function getToolAgentStatusPollInterval(
  status: string | null | undefined,
  requestedAt: string,
  nowMs = Date.now(),
  error: unknown = null,
  failureCount = error ? 1 : 0,
  finalHandoff: {
    progress?: number | null
    settlementStatus?: string | null
    finalHandoffStartedAtMs?: number | null
  } = {},
) {
  if (error && !isRetryableWorkflowRequestError(error)) return false
  if (!shouldPollAgentStatus(status)) return false
  const requestedAtMs = Date.parse(requestedAt)
  if (!Number.isFinite(requestedAtMs)) return false
  const ageMs = Math.max(0, nowMs - requestedAtMs)

  const normalized = status?.trim().toLowerCase()
  let interval: number
  const finalHandoffStartedAtMs = finalHandoff.finalHandoffStartedAtMs
  const withinFinalHandoffWindow = isToolAgentFinalHandoffPollingSignal({
    status: normalized ?? '',
    progress: finalHandoff.progress ?? 0,
    settlementStatus: finalHandoff.settlementStatus ?? undefined,
  }) && typeof finalHandoffStartedAtMs === 'number'
    && Number.isFinite(finalHandoffStartedAtMs)
    && nowMs - finalHandoffStartedAtMs < TOOL_AGENT_FINAL_HANDOFF_POLL_WINDOW_MS
  if (withinFinalHandoffWindow) {
    interval = TOOL_AGENT_FINAL_HANDOFF_POLL_INTERVAL_MS
  } else if (
    normalized === 'paused'
    || normalized === 'waiting'
    || normalized === 'waiting_for_review'
    || normalized === 'review_required'
    || normalized === 'requires_review'
    || normalized === 'awaiting_review'
    || normalized === 'waiting_for_payment'
    || normalized === 'credit_exhausted'
    || normalized === 'payment_required'
    || normalized === 'insufficient_balance'
  ) {
    interval = ageMs < TOOL_AGENT_SLOW_POLL_WINDOW_MS
      ? TOOL_AGENT_SLOW_POLL_INTERVAL_MS
      : TOOL_AGENT_LONG_POLL_INTERVAL_MS
  } else if (ageMs < TOOL_AGENT_FAST_POLL_WINDOW_MS) {
    interval = TOOL_AGENT_FAST_POLL_INTERVAL_MS
  } else if (ageMs < TOOL_AGENT_WARM_POLL_WINDOW_MS) {
    interval = TOOL_AGENT_WARM_POLL_INTERVAL_MS
  } else if (ageMs < TOOL_AGENT_SLOW_POLL_WINDOW_MS) {
    interval = TOOL_AGENT_SLOW_POLL_INTERVAL_MS
  } else {
    interval = TOOL_AGENT_LONG_POLL_INTERVAL_MS
  }
  if (!error) return interval
  const backoffMultiplier = 2 ** Math.min(Math.max(1, failureCount), 3)
  return Math.min(TOOL_AGENT_LONG_POLL_INTERVAL_MS, interval * backoffMultiplier)
}

function isAngleInputContract(inputContract: DiscoveryToolCatalogItem['input_contract']) {
  const nodeType = inputContract.node_type.trim().toLowerCase()
  return nodeType === 'angle' || nodeType.startsWith('angle@')
}

/** Avatar duration left to the speech track: the default choice, never sent as a `duration_seconds` value. */
const TOOL_AVATAR_DURATION_AUTO = 'auto'
const MAX_AVATAR_DURATION_CHOICES = 60

function isAvatarGenerateInputContract(inputContract: DiscoveryToolCatalogItem['input_contract'] | undefined) {
  const nodeType = inputContract?.node_type.trim().toLowerCase() ?? ''
  return nodeType === 'avatar_generate' || nodeType.startsWith('avatar_generate@')
}

/**
 * The avatar lip-syncs its whole speech track, so "Auto (speech length)" comes first and is selected by default; the
 * whole seconds of the port range (1-10 s) follow for a fixed length. The contract's 5 s default is not offered as the
 * preselected value because it would cut longer speech.
 */
function getAvatarDurationOptions(
  schema: Record<string, unknown>,
  binding: StandardToolFieldBinding | undefined,
  autoLabel: string,
  fallbackSchema?: Record<string, unknown>,
): ToolChoice[] {
  if (!binding?.name) return []
  const entry = getBoundSchemaField(schema, binding) ?? getBoundSchemaField(fallbackSchema ?? {}, binding)
  if (!entry) return []
  const min = Math.max(1, Math.ceil(getNumberValue(entry.port.min_value) ?? 1))
  const max = Math.min(
    Math.max(min, Math.floor(getNumberValue(entry.port.max_value) ?? 10)),
    min + MAX_AVATAR_DURATION_CHOICES - 1,
  )
  return [
    { value: TOOL_AVATAR_DURATION_AUTO, label: autoLabel },
    ...Array.from({ length: max - min + 1 }, (_, index) => {
      const value = String(min + index)
      return { value, label: `${value} seconds` }
    }),
  ]
}

const MAX_ANGLE_PROMPTS_PER_RUN = 5
const MAX_ANGLE_PROMPT_CHARS = 600

function getAnglePromptValidationReason(active: boolean, rawAngles: unknown) {
  if (!active) return null
  if (typeof rawAngles === 'string') {
    const prompt = rawAngles.trim()
    if (!prompt) return 'Add at least one angle prompt'
    return prompt.length > MAX_ANGLE_PROMPT_CHARS
      ? `Angle prompts can contain at most ${MAX_ANGLE_PROMPT_CHARS} characters`
      : null
  }
  if (!Array.isArray(rawAngles) || rawAngles.length === 0) return 'Add at least one angle prompt'
  if (rawAngles.length > MAX_ANGLE_PROMPTS_PER_RUN) return 'Use no more than 5 angle prompts'
  for (let index = 0; index < rawAngles.length; index += 1) {
    const item = rawAngles[index]
    if (typeof item === 'string') {
      if (!item.trim()) return `Angle ${index + 1} prompt is required`
      if (item.trim().length > MAX_ANGLE_PROMPT_CHARS) return `Angle ${index + 1} prompt is too long`
      continue
    }
    if (!item || typeof item !== 'object') return `Angle ${index + 1} prompt is required`
    const record = getPortRecord(item)
    if (!Object.prototype.hasOwnProperty.call(record, 'prompt')) {
      const legacyCameraKeys = ['azimuth_deg', 'horizontal', 'elevation_deg', 'vertical', 'zoom']
      if (!legacyCameraKeys.some((key) => Object.prototype.hasOwnProperty.call(record, key))) {
        return `Angle ${index + 1} prompt is required`
      }
      continue
    }
    if (typeof record.prompt !== 'string' || !record.prompt.trim()) return `Angle ${index + 1} prompt is required`
    if (record.prompt.trim().length > MAX_ANGLE_PROMPT_CHARS) return `Angle ${index + 1} prompt is too long`
  }
  return null
}

function isAngleToolCatalogItem(tool: DiscoveryToolCatalogItem | undefined) {
  if (!tool) return false
  const nodeType = (getStringValue(tool.execution?.node_type ?? tool.input_contract?.node_type) ?? '')
    .trim()
    .toLowerCase()
  if (nodeType === 'angle' || nodeType.startsWith('angle@')) return true
  const token = [tool.tool_id, tool.title, tool.input_contract?.node_type].join(' ').toLowerCase()
  return /(^|[\s_-])angle([\s_-]|$)/.test(token)
}

function isToolAgentFinalHandoffPollingSignal(
  status: Pick<WorkflowAgentStatusResult, 'status' | 'progress' | 'settlementStatus'> | null | undefined,
) {
  if (!status || !shouldPollAgentStatus(status.status)) return false
  const normalizedStatus = status.status?.trim().toLowerCase()
  const settlementStatus = status.settlementStatus?.trim().toLowerCase()
  return status.progress >= 100
    || normalizedStatus === 'settlement_pending'
    || settlementStatus === 'settlement_pending'
}

function isRecentWorkflowHandoffTerminalStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase()
  return canReadAgentOutput(normalized)
    || isFailedRunStatus(normalized)
    || normalized === 'insufficient_balance'
}

function canReadAgentOutput(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase()
  return normalized === 'completed'
    || normalized === 'success'
    || normalized === 'succeeded'
    || normalized === 'done'
}

function shouldBlockToolGenerate(input: {
  mutationPending: boolean
  cooldownActive: boolean
  lastGenerateAtMs: number
  nowMs: number
}) {
  if (input.mutationPending || input.cooldownActive) return true
  return input.lastGenerateAtMs > 0
    && input.nowMs - input.lastGenerateAtMs < TOOL_GENERATE_COOLDOWN_MS
}

function releaseToolGenerateSubmission(input: {
  submissionLocked: boolean
  lastGenerateAtMs: number
}) {
  return {
    ...input,
    submissionLocked: false,
  }
}

function shouldResetToolInputAfterLaunch(tool: ToolConfig) {
  void tool
  return true
}

/** LAT-04: the gateway refused a launch whose quoted price no longer holds (409, nothing held or charged). */
function isLaunchQuotePriceChangedError(error: unknown) {
  return isAuthClientError(error) && error.code === 'WORKFLOW_ESTIMATE_CONFLICT'
}

function shouldRevalidateAgentEstimateBeforeLaunch(tool: ToolConfig) {
  return isMagicClipsToolConfig(tool)
}

function hasWorkflowEstimateChanged(displayed: number | null, revalidated: number) {
  return displayed !== null && Math.abs(displayed - revalidated) >= 0.01
}

function shouldConfirmViralClipsQuota(
  snapshot: ViralClipsQuotaSnapshot | null | undefined,
): snapshot is ViralClipsQuotaSnapshot {
  return Boolean(snapshot?.limited && snapshot.max_clips_this_run < 10)
}

function getMediaDownloaderDeclaredItemCount(output: WorkflowAgentOutputResult | null) {
  const outputRecord = getPortRecord(output?.output)
  const result = getPortRecord(outputRecord.result)
  const declared = getFiniteNumber(result.item_count ?? result.itemCount)
  if (declared !== null && declared >= 0) {
    return Math.min(MEDIA_DOWNLOADER_MAX_OUTPUT_ITEMS, Math.floor(declared))
  }
  return Array.isArray(result.items)
    ? Math.min(MEDIA_DOWNLOADER_MAX_OUTPUT_ITEMS, result.items.length)
    : null
}

function isVideoToGifToolConfig(tool: ToolConfig) {
  const token = [tool.id, tool.title, tool.shortTitle].join(' ').toLowerCase()
  return token.includes('video-to-gif') || token.includes('video to gif') || token.includes('video_to_gif')
}

function isMediaTransformToolConfig(tool: ToolConfig) {
  const token = [tool.id, tool.title, tool.shortTitle].join(' ').toLowerCase()
  return token.includes('media-transform') || token.includes('media transform') || token.includes('media_transform')
}

function formatMediaTransformActionLabel(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase('en-US')
  const labels: Record<string, string> = {
    trim: 'Trim video',
    reframe: 'Resize or crop',
    smart_reframe: 'Smart reframe',
    camera: 'Manual camera',
    effects: 'Speed & effects',
    audio: 'Adjust audio',
    orientation: 'Rotate or flip',
    convert: 'Convert video',
    advanced: 'Multiple edits',
  }
  return normalized ? labels[normalized] ?? formatSchemaOptionLabel(normalized) : null
}

function getMediaTransformOutputActionLabel(value: unknown) {
  const preview = getPortRecord(value)
  const result = getPortRecord(preview.result)
  return formatMediaTransformActionLabel(
    getStringValue(preview.action) ?? getStringValue(result.action),
  )
}

function getToolRunIdentifiers(runs: ToolAgentRunState[]) {
  const identifiers = new Set<string>()
  for (const run of runs) {
    for (const value of [run.launch?.agent_id, run.status?.workflowId, run.output?.agentId]) {
      if (value) identifiers.add(value)
    }
  }
  return identifiers
}

function getToolAgentRunCardKey(run: ToolAgentRunState, index: number) {
  return getToolAgentRunIdentifier(run) ?? `run:${run.id ?? index}`
}

function getToolWorkflowOutputCardKey(item: RecentWorkflowOutputItem) {
  return getToolWorkflowOutputIdentifier(item) || item.id
}

function getToolHandoffIdentityKey(identifier: string | null | undefined, fallback: string) {
  const normalized = identifier?.trim()
  return normalized || fallback
}

function getSpeechOutputCardKey(identifier: string | null | undefined, fallback: string) {
  return getToolHandoffIdentityKey(identifier, fallback)
}

function getCaptionOutputCardKey(identifier: string | null | undefined, fallback: string) {
  return getToolHandoffIdentityKey(identifier, fallback)
}

function getMediaDownloaderOutputTileKey(
  identifier: string | null | undefined,
  index: number,
  tone: ToolOutputStatusTone = 'processing',
  fallback = 'download',
) {
  const identity = getToolHandoffIdentityKey(identifier, fallback)
  return tone === 'failed' ? `${identity}:failed` : `${identity}:${index}`
}

function shouldCompactToolHistory(liveCount: number, historyCount: number) {
  return liveCount + historyCount > 1
}

function isRecentWorkflowOutputHidden(item: RecentWorkflowOutputItem, hiddenIdentifiers: Set<string>) {
  return hiddenIdentifiers.has(item.agentId) || hiddenIdentifiers.has(item.workflowId)
}

function isToolFastLaneLaunchResult(value: unknown): value is ToolFastLaneLaunchResult {
  return Boolean(value && typeof value === 'object' && (value as { lane?: unknown }).lane === 'fast')
}

const EMPTY_FAST_LANE_RUN_IDS: ReadonlySet<string> = new Set()

/** Tool runs whose fast-lane run the history already lists (its card hands over to the history item). */
function getHandedOffFastLaneRunIds(
  progress: Readonly<Record<string, ToolFastLaneRunProgress>>,
  historyItems: readonly Pick<RecentWorkflowOutputItem, 'id'>[],
): ReadonlySet<string> {
  const entries = Object.entries(progress).filter(([, run]) => run.fastRunId)
  if (entries.length === 0) return EMPTY_FAST_LANE_RUN_IDS
  const listed = new Set(historyItems.map((item) => item.id))
  const handedOff = entries.flatMap(([runId, run]) => (run.fastRunId && listed.has(run.fastRunId) ? [runId] : []))
  return handedOff.length > 0 ? new Set(handedOff) : EMPTY_FAST_LANE_RUN_IDS
}

function omitFastLaneRunProgress(
  progress: Readonly<Record<string, ToolFastLaneRunProgress>>,
  runIds: ReadonlySet<string>,
): Readonly<Record<string, ToolFastLaneRunProgress>> {
  if (!Object.keys(progress).some((runId) => runIds.has(runId))) return progress
  return Object.fromEntries(Object.entries(progress).filter(([runId]) => !runIds.has(runId)))
}

function getToolRunActivityLabel(tool: ToolConfig, params: Record<string, unknown>) {
  if (isMediaTransformToolConfig(tool)) {
    return formatMediaTransformActionLabel(getStringValue(params.action_mode)) ?? 'Media Transform'
  }
  if (isFrameExtractToolConfig(tool)) {
    const mode = getStringValue(params.mode) || 'first'
    const labels: Record<string, string> = {
      first: 'Extracting the first frame',
      last: 'Extracting the last frame',
      first_last: 'Extracting first and last frames',
      timestamp: 'Extracting the selected frame',
      timestamps: 'Extracting selected frames',
      interval: 'Extracting frames by interval',
      evenly_spaced: 'Extracting evenly spaced frames',
      sample_fps: 'Sampling video frames',
    }
    return labels[mode] ?? 'Extracting video frames'
  }
  if (isMagicClipsToolConfig(tool)) {
    return 'Running'
  }
  if (isVideoToGifToolConfig(tool)) return 'Rendering GIF'
  if (tool.modelKind === 'video') return 'Generating video'
  if (tool.modelKind === 'voice') return 'Generating audio'
  return 'Generating image'
}

function isToolAgentRunReconciliationPending({
  restored,
  launch,
  status,
  output,
  errorMessage,
}: {
  restored: boolean
  launch: WorkflowAgentLaunchResult | null
  status: WorkflowAgentStatusResult | null
  output: WorkflowAgentOutputResult | null
  errorMessage: string | null
}) {
  if (!restored || !launch || errorMessage) return false
  if (!status) return true
  if (isFailedRunStatus(status.status) || status.status.toLowerCase() === 'insufficient_balance') return false
  return canReadAgentOutput(status.status) && !output
}

function isRestoredToolAgentRunDiscardable({
  restored,
  status,
  errorMessage,
  preserveSubmissionFailure = false,
}: {
  restored: boolean
  status: WorkflowAgentStatusResult | null
  errorMessage: string | null
  preserveSubmissionFailure?: boolean
}) {
  if (!restored) return false
  if (errorMessage) return !preserveSubmissionFailure
  const normalizedStatus = status?.status.trim().toLowerCase()
  return isFailedRunStatus(normalizedStatus) || normalizedStatus === 'insufficient_balance'
}

type RunProgressStatusOptions = {
  settlementStatus?: string | null
  stage?: string | null
  progress?: number | null
  outputPending?: boolean
}

function getRecentWorkflowHandoffRetryDelay(attempt: number) {
  if (!Number.isInteger(attempt) || attempt < 1) return TOOL_RECENT_OUTPUT_HANDOFF_RETRY_BASE_MS
  if (attempt >= TOOL_RECENT_OUTPUT_HANDOFF_MAX_ATTEMPTS) return null
  return Math.min(
    TOOL_RECENT_OUTPUT_HANDOFF_RETRY_BASE_MS * (2 ** (attempt - 1)),
    TOOL_RECENT_OUTPUT_HANDOFF_RETRY_MAX_MS,
  )
}


function getRunProgressStatusLabel(
  status: string | null | undefined,
  options: RunProgressStatusOptions = {},
) {
  const normalized = status?.trim().toLowerCase()
  const settlementStatus = options.settlementStatus?.trim().toLowerCase()
  if (['completed', 'succeeded', 'success', 'done'].includes(normalized ?? '') && !options.outputPending) return 'Ready'
  if (normalized === 'parked') return 'Parked'
  if (normalized === 'promoting') return 'Starting from park'
  if (normalized === 'waiting_for_credit' || normalized === 'failed_balance') return 'Waiting for credit'
  if (normalized === 'expired') return 'Park expired'
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled'
  if (normalized === 'reconciliation_required' || (!isRuntimeTerminal(normalized) && settlementStatus === 'reconciliation_required')) {
    return 'Failed'
  }
  if (isFailedRunStatus(normalized)) return 'Failed'
  if (normalized === 'settlement_pending' || (!isRuntimeTerminal(normalized) && settlementStatus === 'settlement_pending')) {
    return 'Settling credits'
  }
  const runningStatus = Boolean(normalized && [
    'running',
    'started',
    'in_process',
    'in_progress',
    'processing',
    'executing',
    'cancelling',
    'draining',
    'paused',
    'waiting',
    'waiting_for_review',
    'review_required',
    'requires_review',
    'awaiting_review',
    'waiting_for_payment',
  ].includes(normalized))
  if (options.outputPending || (runningStatus && (options.progress ?? 0) >= 100)) {
    return 'Running'
  }
  if (!normalized || [
    'launching',
    'starting',
    'submitting',
    'submitted',
    'queued',
    'in_queue',
    'pending',
  ].includes(normalized)) return 'Queued'
  if (runningStatus) return 'Running'
  return 'Running'
}

function getPublicToolStatusLabel(
  state: ToolOutputStatusTone,
  label: string | null | undefined,
) {
  if (state === 'ready') return 'Ready'
  if (state === 'failed') return 'Failed'
  return getRunProgressStatusLabel(label?.trim() || 'running')
}

function isFailedRunStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase()
  return normalized === 'failed'
    || normalized === 'error'
    || normalized === 'cancelled'
    || normalized === 'canceled'
    || normalized === 'skipped'
    || normalized === 'billing_failed'
    || normalized === 'reconciliation_required'
    || normalized === 'insufficient_balance'
    || normalized === 'credit_exhausted'
    || normalized === 'payment_required'
}

function formatRunStatus(status: string | null | undefined) {
  const normalized = status?.trim()
  if (!normalized) return 'Unknown'
  const normalizedLower = normalized.toLowerCase()
  if (canReadAgentOutput(normalizedLower)) {
    return 'Success'
  }
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getAgentTextOutput(output: WorkflowAgentOutputResult | null): ToolTextOutput | null {
  if (!output?.output) return null
  if (isTranscriptNodeType(output.nodeType)) return null
  const root = getPortRecord(output.output)
  const nestedResult = getPortRecord(root.result)
  const result = Object.keys(nestedResult).length > 0 ? nestedResult : root
  const metadata = getPortRecord(root.metadata)
  const outputFormat = typeof metadata.output_format === 'string' ? metadata.output_format : null
  const report = typeof result.report_markdown === 'string' ? result.report_markdown.trim() : ''
  if (report && outputFormat !== 'canonical_json') {
    return { kind: 'markdown', content: report }
  }
  return { kind: 'json', content: stringifyToolTextOutput(result) }
}

function isResearchAgentTool(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'],
) {
  const token = [
    tool.id,
    tool.title,
    tool.shortTitle,
    tool.badge,
    inputContract.node_type,
  ].join(' ').toLowerCase()
  return token.includes('research_agent') || token.includes('research agent')
}

function isResearchToolConfig(tool: ToolConfig) {
  const token = [tool.id, tool.title, tool.shortTitle, tool.badge].join(' ').toLowerCase()
  return token.includes('research_agent')
    || token.includes('research-agent')
    || token.includes('research agent')
}

function isTranscriptToolConfig(tool: ToolConfig) {
  const normalizedId = tool.id.trim().toLowerCase()
  if (normalizedId === 'transcript' || normalizedId.startsWith('transcript@')) return true
  return [tool.title, tool.shortTitle].some((value) => {
    const normalized = value.trim().toLowerCase()
    return normalized === 'transcript' || normalized === 'transcription'
  })
}

function getRecentWorkflowTextOutput(item: RecentWorkflowOutputItem): ToolTextOutput | null {
  if (isTranscriptNodeType(item.nodeType)) return null
  const report = item.reportMarkdown?.trim() ?? ''
  if (report && item.outputFormat !== 'canonical_json') {
    return { kind: 'markdown', content: report }
  }
  if (item.outputPreview != null) {
    return { kind: 'json', content: stringifyToolTextOutput(item.outputPreview) }
  }
  return null
}

function getAgentTranscriptOutput(output: WorkflowAgentOutputResult | null): ToolTranscriptOutput | null {
  if (!output?.output || !isTranscriptNodeType(output.nodeType)) return null
  return parseToolTranscriptOutput(output.output)
}

function getRecentWorkflowTranscriptOutput(item: RecentWorkflowOutputItem): ToolTranscriptOutput | null {
  if (!isTranscriptNodeType(item.nodeType) || item.outputPreview == null) return null
  return parseToolTranscriptOutput(item.outputPreview)
}

function parseToolTranscriptOutput(value: unknown): ToolTranscriptOutput | null {
  const root = getPortRecord(value)
  const nestedResult = getPortRecord(root.result)
  const result = Object.keys(nestedResult).length > 0 ? nestedResult : root
  const text = readTranscriptString(result, ['text', 'transcript']) ?? ''
  const rawSegments = Array.isArray(result.segments) ? result.segments : []
  const segments = rawSegments.flatMap((segment, index) => {
    const record = getPortRecord(segment)
    const segmentText = readTranscriptString(record, ['text', 'transcript'])
    const start = readTranscriptNumber(record, ['start', 'start_seconds', 'start_time'])
    const end = readTranscriptNumber(record, ['end', 'end_seconds', 'end_time'])
    if (!segmentText || start === null || end === null || end < start) return []
    const explicitId = record.id
    return [{
      id: typeof explicitId === 'string' || typeof explicitId === 'number'
        ? String(explicitId)
        : `${index}-${start}-${end}`,
      start,
      end,
      text: segmentText,
    }]
  }).sort((left, right) => left.start - right.start || left.end - right.end)
  if (!text && segments.length === 0) return null
  const totalSegmentCount = Math.max(
    segments.length,
    Math.floor(readTranscriptNumber(result, ['segment_count']) ?? segments.length),
  )

  return {
    text: text || segments.map((segment) => segment.text).join(' '),
    segments,
    totalSegmentCount,
    segmentsTruncated: readTranscriptBoolean(result, ['segments_truncated'])
      || totalSegmentCount > segments.length,
    language: readTranscriptString(result, ['detected_language', 'language', 'source_language']),
    durationSeconds: readTranscriptNumber(result, ['duration_seconds', 'duration']),
    modelId: readTranscriptString(result, ['model_id', 'model']),
    artifactId: readTranscriptString(result, ['artifact_id', 'transcript_artifact_id']),
    cacheHit: readTranscriptBoolean(result, ['cache_hit', 'cached']),
    sourceStorageObjectId: readTranscriptString(result, ['source_storage_object_id']),
    sourceContentType: readTranscriptString(result, ['source_content_type', 'source_mime_type']),
  }
}

function getTranscriptSourceMedia(
  transcript: ToolTranscriptOutput | null,
  channelId: string | null,
): ToolRunSourceMedia | null {
  if (!transcript?.sourceStorageObjectId || !channelId) return null
  const audioOnly = transcript.sourceContentType?.toLowerCase().startsWith('audio/') === true
  return {
    channelId,
    storageObjectId: transcript.sourceStorageObjectId,
    name: audioOnly ? 'Source audio' : 'Source video',
    mimeType: transcript.sourceContentType,
    durationSeconds: transcript.durationSeconds,
    previewUrl: null,
    width: null,
    height: null,
  }
}

function getActiveTranscriptSegmentIndex(
  segments: ToolTranscriptOutput['segments'],
  currentTime: number,
) {
  if (segments.length === 0 || !Number.isFinite(currentTime) || currentTime < 0) return -1

  let low = 0
  let high = segments.length - 1
  let candidate = -1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (segments[middle].start <= currentTime) {
      candidate = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  if (candidate < 0) return -1
  const segment = segments[candidate]
  return currentTime <= segment.end ? candidate : -1
}

function getMediaDownloaderClipMode(values: ToolSchemaValues): MediaDownloaderClipMode {
  const explicitMode = values[MEDIA_DOWNLOADER_CLIP_MODE_FIELD]
  if (explicitMode === 'full' || explicitMode === 'clip') return explicitMode
  return isBlankValue(values.start_time) && isBlankValue(values.end_time) ? 'full' : 'clip'
}

function getMediaDownloaderInputUrl(values: ToolSchemaValues) {
  return parseMediaDownloaderVideoUrl(stringifySchemaValue(values.url))?.url ?? ''
}


function getMediaDownloaderAvailableCredits(quotaUsage: BillingQuotaUsage | undefined): number | null {
  if (!quotaUsage) return null
  if (typeof quotaUsage.available_credits === 'number') {
    return Number.isFinite(quotaUsage.available_credits) ? Math.max(0, quotaUsage.available_credits) : 0
  }
  const topUpBalance = quotaUsage.top_up_balance_credits ?? quotaUsage.credit_balance
  const planRemaining = quotaUsage.plan_included_credits?.remaining ?? quotaUsage.quotas.reduce((sum, quota) => (
    quota.quota_key === 'billing:plan_included_credits'
      ? sum + Math.max(0, quota.remaining_quota)
      : sum
  ), 0)
  const total = Math.max(0, topUpBalance) + Math.max(0, planRemaining)
  return Number.isFinite(total) ? total : 0
}

function getMediaDownloaderQuotePreflightReason(input: {
  active: boolean
  error: string | null
  quoting: boolean
  status: 'idle' | 'loading' | 'ready' | 'error'
  canLaunch: boolean
  sourceCount: number
  blockedReason?: string | null
}) {
  if (!input.active) return null
  if (input.blockedReason) return input.blockedReason
  if (input.error) return input.error

  // The metadata card owns loading feedback. Keeping the loading copy out of
  // the button title avoids duplicating the metadata preview's localized progress state
  // surface while creditPending still keeps the action disabled.
  if (input.quoting) return null

  if (input.status !== 'ready' && input.sourceCount > 0) {
    return 'Wait for the quote before starting the download.'
  }
  if (input.status === 'ready' && !input.canLaunch) {
    return 'The quote expired or changed. Refresh the estimate before downloading.'
  }
  return null
}

function getTranscriptSegmentPlaybackProgress(
  segment: Pick<ToolTranscriptSegment, 'start' | 'end'>,
  currentTime: number,
) {
  if (!Number.isFinite(currentTime) || currentTime <= segment.start) return 0
  const duration = segment.end - segment.start
  if (!Number.isFinite(duration) || duration <= 0) return currentTime >= segment.end ? 1 : 0
  return Math.min(1, Math.max(0, (currentTime - segment.start) / duration))
}

function isTranscriptNodeType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ''
  return normalized === 'transcript' || normalized.startsWith('transcript@')
}

function isMediaDownloaderNodeType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().split('@', 1)[0] ?? ''
  return normalized === 'media_downloader' || normalized === 'media-downloader'
}

function isResearchAgentNodeType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().split('@', 1)[0] ?? ''
  return normalized === 'research_agent' || normalized === 'research-agent'
}

function readTranscriptString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readTranscriptNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed) && parsed >= 0) return parsed
    }
  }
  return null
}

function readTranscriptBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true' || normalized === '1') return true
      if (normalized === 'false' || normalized === '0') return false
    }
  }
  return false
}

function formatTranscriptTimestamp(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value))
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
  }
  return [minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function formatFrameTimestamp(value: number) {
  const totalMilliseconds = Math.max(0, Math.round(value * 1_000))
  const totalSeconds = Math.floor(totalMilliseconds / 1_000)
  const milliseconds = totalMilliseconds % 1_000
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const clock = hours > 0
    ? [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
    : [minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
  return `${clock}.${String(milliseconds).padStart(3, '0')}`
}

function formatTranscriptDuration(value: number) {
  return formatTranscriptTimestamp(value)
}

function formatTranscriptLanguage(value: string | null) {
  if (!value) return 'Language auto-detected'
  const normalized = value.trim().toLowerCase()
  const labels: Record<string, string> = {
    en: 'English',
    english: 'English',
    tr: 'Turkish',
    turkish: 'Turkish',
    de: 'German',
    german: 'German',
    es: 'Spanish',
    spanish: 'Spanish',
    fr: 'French',
    french: 'French',
    it: 'Italian',
    italian: 'Italian',
    pt: 'Portuguese',
    portuguese: 'Portuguese',
  }
  return labels[normalized] ?? normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function stringifyToolTextOutput(value: unknown) {
  try {
    return JSON.stringify(value, null, 2).slice(0, 60_000)
  } catch {
    return String(value).slice(0, 60_000)
  }
}

function stableObjectHash(value: unknown) {
  const text = stableStringify(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function getErrorMessage(error: unknown) {
  if (!error) return null
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function getToolAgentEstimateBlockingReason(error: unknown, tAuto?: ToolAutoErrorTranslator) {
  if (!isAuthClientError(error)) return null
  if (error.code === 'VIRAL_CLIPS_MONTHLY_QUOTA_EXHAUSTED') {
    return tAuto?.('viral_clips_quota_exhausted') ?? null
  }
  const details = getPortRecord(error.details)
  const featureKey = getStringValue(details.feature_key)
  const detailErrorCode = getStringValue(
    details.error_code
    ?? details.reason_code
    ?? details.code,
  )
  if (
    error.code === 'WORKFLOW_STORAGE_DURATION_METADATA_UNAVAILABLE'
    || detailErrorCode === 'WORKFLOW_STORAGE_DURATION_METADATA_UNAVAILABLE'
  ) {
    return getToolAgentRequestErrorMessage(error)
  }
  if (error.code !== 'VALIDATION_ERROR') return null
  if (
    featureKey !== 'max_video_duration_seconds'
    && !error.message.toLowerCase().includes('max_video_duration_seconds')
    && !error.message.toLowerCase().includes('source duration metadata is required')
  ) return null
  return getToolAgentRequestErrorMessage(error)
}

function getToolAgentRequestErrorMessage(error: unknown, tAuto?: ToolAutoErrorTranslator) {
  if (isAuthClientError(error)) {
    const details = getPortRecord(error.details)
    const nestedError = getPortRecord(details.error)
    const explicitPublicCode = [
      error.publicErrorCode,
      error.code,
      details.public_error_code,
      details.publicErrorCode,
      details.error_code,
      nestedError.public_error_code,
      nestedError.code,
    ].find((value): value is string => typeof value === 'string' && /^E\d{4}$/.test(value))
    const structuredMessage = getStructuredToolAgentRequestErrorMessage(
      error,
      details,
      nestedError,
      explicitPublicCode,
      tAuto,
    )
    if (structuredMessage) return structuredMessage

    if (explicitPublicCode && explicitPublicCode !== 'E3160') {
      return publicRuntimeErrorMessage(explicitPublicCode)
    }

    const rawMessage = getErrorMessage(error) ?? ''
    const featureKey = getStringValue(details.feature_key)
    if (
      featureKey === 'max_video_duration_seconds'
      || rawMessage.toLowerCase().includes('max_video_duration_seconds')
    ) {
      const actualSeconds = getFiniteNumber(details.actual)
      const limitSeconds = getFiniteNumber(details.limit)
      if (actualSeconds !== null && limitSeconds !== null) {
        return `Selected video is ${formatMediaDownloaderSeconds(actualSeconds)}, but your plan supports up to ${formatMediaDownloaderSeconds(limitSeconds)} per workflow. Choose a shorter video or review your plan limits. Error code: E3160`
      }
    }
    const detailErrorCode = getStringValue(
      details.error_code
      ?? details.reason_code
      ?? details.code,
    )
    if (
      error.code === 'WORKFLOW_STORAGE_DURATION_METADATA_UNAVAILABLE'
      || detailErrorCode === 'WORKFLOW_STORAGE_DURATION_METADATA_UNAVAILABLE'
      || rawMessage.toLowerCase().includes('source duration metadata is required')
      || rawMessage.toLowerCase().includes('storage duration metadata unavailable')
    ) {
      return 'We could not read this video\'s duration metadata. Reprocess or re-upload the video, then try again. Error code: E3161'
    }
    if (explicitPublicCode) {
      return publicRuntimeErrorMessage(explicitPublicCode)
    }
  }

  const rawMessage = getErrorMessage(error)
  if (!rawMessage) return 'Something went wrong. Error code: E3100'
  return toPublicRuntimeError(rawMessage)?.message
    ?? 'Something went wrong. Error code: E3100'
}

function getStructuredToolAgentRequestErrorMessage(
  error: { code: string; status: number },
  details: Record<string, unknown>,
  nestedError: Record<string, unknown>,
  explicitPublicCode: string | undefined,
  tAuto?: ToolAutoErrorTranslator,
) {
  const structuredCodes = new Set([
    error.code,
    details.code,
    details.error_code,
    details.upstream_code,
    details.reason,
    details.rejection_reason,
    nestedError.code,
    nestedError.error_code,
    nestedError.upstream_code,
    nestedError.reason,
    nestedError.rejection_reason,
  ].flatMap((value) => {
    const code = getStringValue(value)
    return code ? [code.toUpperCase()] : []
  }))

  if (structuredCodes.has('VIRAL_CLIPS_MONTHLY_QUOTA_EXHAUSTED')) {
    return tAuto?.('viral_clips_quota_exhausted') ?? null
  }

  if (structuredCodes.has('WORKFLOW_QUEUE_DEPTH_EXCEEDED')) {
    return publicRuntimeErrorMessage('E3150')
  }

  if ([
    'WORKFLOW_CONCURRENCY_EXCEEDED',
    'CONCURRENCY_LIMIT_EXCEEDED',
    'REJECTED_CONCURRENCY',
  ].some((code) => structuredCodes.has(code))) {
    const activeCount = getSafeWorkflowCapacityValue(
      details.active_count ?? nestedError.active_count,
    )
    const concurrencyLimit = getSafeWorkflowCapacityValue(
      details.concurrency_limit ?? details.limit
      ?? nestedError.concurrency_limit ?? nestedError.limit,
    )
    if (activeCount !== null && concurrencyLimit !== null && concurrencyLimit > 0) {
      return `You already have ${activeCount} of ${concurrencyLimit} workflows running. Wait for one to finish, then try again. Error code: E3162`
    }
    return 'Your concurrent workflow limit has been reached. Wait for a running workflow to finish, then try again. Error code: E3162'
  }

  if ([
    'WORKFLOW_ESTIMATE_CONFLICT',
    'ESTIMATE_CONFLICT',
  ].some((code) => structuredCodes.has(code))) {
    const errorCodeSuffix = explicitPublicCode ? ` Error code: ${explicitPublicCode}` : ''
    return `The current workflow estimate is no longer valid. Refresh the estimate and try again.${errorCodeSuffix}`
  }

  const serviceUnavailable = [
    'SERVICE_UNAVAILABLE',
    'GATEWAY_UNAVAILABLE',
    'GATEWAY_NETWORK_ERROR',
    'GATEWAY_REQUEST_TIMEOUT',
    'PROVIDER_MODEL_NOT_AVAILABLE',
    'PROVIDER_MODEL_RESOLUTION_FAILED',
    'WORKFLOW_PROVIDER_MODEL_RESOLUTION_FAILED',
  ].some((code) => structuredCodes.has(code))
    || [502, 503, 504].includes(error.status)
  if (serviceUnavailable) {
    const publicCode = explicitPublicCode ?? 'E3101'
    return `The workflow service is temporarily unavailable. If you just launched a run, check Recent before retrying. Error code: ${publicCode}`
  }

  return null
}

function getSafeWorkflowCapacityValue(value: unknown) {
  const parsed = getFiniteNumber(value)
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function getPortRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getAllowedValues(port: Record<string, unknown>) {
  for (const key of ['allowed_values', 'values', 'options', 'enum']) {
    const value = port[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function getSchemaOptionValues(port: Record<string, unknown>) {
  const allowedValues = getAllowedValues(port)
    .map((value) => stringifySchemaValue(value))
    .filter(Boolean)
  if (allowedValues.length > 0) return allowedValues

  const defaultValue = stringifySchemaValue(readPortDefaultValue(port))
  return defaultValue ? [defaultValue] : []
}

function shouldRenderToolSchemaSelect(
  allowedValues: string[],
  captionTool: boolean,
  normalizedName: string,
) {
  return allowedValues.length > 0 && !(captionTool && normalizedName === 'font_size')
}

function getSchemaOptionValuesForField(
  schema: Record<string, unknown>,
  fieldName: string,
  port: Record<string, unknown>,
) {
  const directValues = getSchemaOptionValues(port)
  if (directValues.length > 0) return directValues

  const normalizedName = normalizeToolInputName(fieldName)
  const optionKey = MODEL_OPTION_KEYS_BY_FIELD[normalizedName]
  const rawValues = optionKey ? schema[optionKey] : undefined
  if (Array.isArray(rawValues)) {
    const values = rawValues.map((value) => stringifySchemaValue(value)).filter(Boolean)
    if (values.length > 0) return values
  }

  const defaultKey = MODEL_DEFAULT_KEYS_BY_FIELD[normalizedName]
  const defaultValue = defaultKey ? stringifySchemaValue(schema[defaultKey]) : ''
  return defaultValue ? [defaultValue] : []
}

function getToolSchemaOptionValues(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'] | undefined,
  schema: Record<string, unknown>,
  fieldName: string,
  port: Record<string, unknown>,
  nodeSchema?: Record<string, unknown>,
) {
  if (
    inputContract
    && isCaptionTool(tool, inputContract)
    && normalizeToolInputName(fieldName) === 'style_name'
    && nodeSchema
  ) {
    const nodePort = getPortRecord(nodeSchema[fieldName])
    const nodeStyleValues = getAllowedValues(nodePort)
      .map((value) => stringifySchemaValue(value))
      .filter(Boolean)
    if (nodeStyleValues.length > 0) return nodeStyleValues
  }

  return getSchemaOptionValuesForField(schema, fieldName, port)
}

function shouldShowToolModeSelect(
  tool: ToolConfig,
  inputContract: DiscoveryToolCatalogItem['input_contract'] | undefined,
  binding: StandardToolFieldBinding | undefined,
  options: ToolMode[],
) {
  if (!binding || options.length <= 1) return false
  if (isFrameExtractTool(tool, inputContract)) {
    return false
  }
  return !inputContract || !isTranscriptTool(tool, inputContract)
}

function getAdvancedFieldOptionValues(
  inputContract: DiscoveryToolCatalogItem['input_contract'],
  fieldName: string,
  port: Record<string, unknown>,
) {
  const normalizedName = normalizeToolInputName(fieldName)
  if (isMediaDownloaderInputContract(inputContract) && normalizedName === 'download_variant') {
    return getSchemaOptionValues(port).filter((value) => value !== 'metadata_only')
  }
  if (isFluxKleinInputContract(inputContract) && normalizedName === 'output_format') {
    return ['png', 'jpeg']
  }
  const metadataValues = getModelMetadataOptionValues(inputContract.input_schema, normalizedName)
  if (metadataValues.length > 0) return metadataValues
  return getSchemaOptionValues(port)
}

function getModelMetadataOptionValues(schema: Record<string, unknown>, normalizedName: string) {
  const optionKey = MODEL_OPTION_KEYS_BY_FIELD[normalizedName]
  const rawValues = optionKey ? schema[optionKey] : undefined
  if (!Array.isArray(rawValues)) return []
  return rawValues.map((value) => stringifySchemaValue(value)).filter(Boolean)
}

const MODEL_OPTION_KEYS_BY_FIELD: Record<string, string> = {
  aspect_ratio: 'aspect_ratios',
  background: 'backgrounds',
  input_fidelity: 'input_fidelities',
  output_format: 'output_formats',
  quality: 'qualities',
  resolution: 'resolutions',
  size: 'sizes',
  style: 'styles',
  task: 'tasks',
}

const MODEL_DEFAULT_KEYS_BY_FIELD: Record<string, string> = {
  aspect_ratio: 'default_aspect_ratio',
  background: 'default_background',
  input_fidelity: 'default_input_fidelity',
  output_format: 'default_output_format',
  quality: 'default_quality',
  resolution: 'default_resolution',
  size: 'default_size',
  style: 'default_style',
  task: 'default_task',
}

function readPortDefaultValue(port: Record<string, unknown>) {
  return port.default ?? port.default_value
}

function isNumberPort(port: Record<string, unknown>) {
  const type = getPortType(port)
  return type === 'number' || type === 'integer' || type === 'float'
}

function isBooleanPort(port: Record<string, unknown>) {
  const type = getPortType(port)
  return type === 'boolean' || type === 'bool'
}

function isListPort(port: Record<string, unknown>) {
  const type = getPortType(port)
  return type === 'array' || type === 'list'
}

function isObjectPort(port: Record<string, unknown>) {
  const type = getPortType(port)
  return type === 'object' || type === 'dict'
}

function isStringPort(port: Record<string, unknown>) {
  const type = getPortType(port)
  return type === 'string' || type === 'text'
}

function getPortType(port: Record<string, unknown>) {
  return getStringValue(port.type)?.toLowerCase() ?? ''
}

function readPortBoolean(port: Record<string, unknown>, key: string) {
  return port[key] === true
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getTranslatedToolCopy(
  toolCopy: (value: string) => string,
  value: unknown,
) {
  const text = publicCatalogText(getStringValue(value))
  return text ? toolCopy(text) : null
}

function getNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getFiniteNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getPortNumberConstraint(port: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = getFiniteNumber(port[key])
    if (value !== null) return value
  }
  return null
}

function isIntegerLike(value: unknown) {
  if (typeof value === 'number') return Number.isInteger(value)
  if (typeof value !== 'string' || !value.trim()) return false
  return Number.isInteger(Number(value))
}

function isBooleanLike(value: unknown) {
  if (typeof value === 'boolean') return true
  if (typeof value !== 'string') return false
  return ['true', 'false', 'on', 'off', '1', '0'].includes(value.trim().toLowerCase())
}

function parseOptionalNumber(value: unknown) {
  if (isBlankValue(value)) return undefined
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : value
}

function stringifySchemaValue(value: unknown) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function formatSchemaListEditorValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join('\n')
  return stringifySchemaValue(value)
}

function isUrlToolSchemaField(name: string) {
  const normalizedName = normalizeToolInputName(name)
  return normalizedName === 'url' || normalizedName.endsWith('_url')
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
  return Boolean(value)
}

function isBlankValue(value: unknown) {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

function normalizeSchemaFieldName(name: string) {
  return name.trim().toLowerCase()
}

function isLanguageCodeToolField(name: string) {
  return isLanguageSelectionFieldName(normalizeToolInputName(name))
}

function normalizeToolInputName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function getStandardFieldLabel(field: StandardToolFieldKey, binding: StandardToolFieldBinding | undefined) {
  const normalizedName = normalizeToolInputName(binding?.name ?? '')
  if (field === 'resolution' && normalizedName === 'size') return 'Size'
  if (field === 'ratio') return 'Aspect ratio'
  return formatSchemaFieldLabel(field)
}

function formatToolInputFieldLabel(name: string) {
  const normalizedName = normalizeToolInputName(name)
  if (normalizedName === 'display_name') return 'Voice name'
  if (normalizedName === 'voice_profile_id') return 'Voice profile'
  if (normalizedName === 'pronunciation_dictionary_id') return 'Pronunciation dictionary ID'
  if (normalizedName === 'top_p') return 'Top P'
  if (normalizedName === 'bit_rate') return 'Bit rate'
  if (normalizedName === 'sample_rate') return 'Sample rate'
  if (IMAGE_SOURCE_INPUT_FIELDS.has(normalizedName)) return 'Source image'
  if (normalizedName === 'url') return 'Media URL'
  if (normalizedName === 'media_url') return 'Media URL'
  if (normalizedName === 'storage_object_id') return 'Storage object ID'
  if (normalizedName === 'download_variant') return 'Output'
  if (normalizedName === 'max_items') return 'Maximum items'
  if (normalizedName === 'start_time') return 'Clip start'
  if (normalizedName === 'end_time') return 'Clip end'
  if (normalizedName === 'source_language') return 'Source language'
  if (normalizedName === 'timestamps') return 'Timestamps'
  if (normalizedName === 'output_format') return 'Output format'
  if (normalizedName === 'execution') return 'Research type'
  if (normalizedName === 'operation') return 'Single operation'
  if (normalizedName === 'use_case') return 'Research goal'
  if (normalizedName === 'target') return 'YouTube video URL or ID'
  if (normalizedName === 'keywords') return 'Trend comparison keywords'
  if (normalizedName === 'location_code') return 'Market'
  if (normalizedName === 'language_code') return 'Language'
  if (normalizedName === 'time_range') return 'Time range'
  if (normalizedName === 'max_credits') return 'Spending limit (optional)'
  if (normalizedName === 'max_chunk_seconds') return 'Chunk length'
  if (normalizedName === 'style_name') return 'Caption Style'
  if (normalizedName === 'subtitle_mode') return 'Caption Language'
  if (normalizedName === 'target_language') return 'Translate To'
  if (normalizedName === 'bilingual_order') return 'Line Order'
  if (normalizedName === 'source_style_name') return 'Original Style'
  if (normalizedName === 'translation_style_name') return 'Translation Style'
  if (normalizedName === 'source_font_scale') return 'Original Line Size'
  if (normalizedName === 'translation_font_scale') return 'Translation Line Size'
  if (normalizedName === 'font_size') return 'Font Size'
  if (normalizedName === 'aspect_ratio') return 'Aspect ratio'
  if (normalizedName === 'count') return 'Images'
  return formatSchemaFieldLabel(name)
}

function formatSchemaFieldLabel(name: string) {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatSchemaOptionLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatSchemaOptionLabelForField(name: string, value: string) {
  const normalizedName = normalizeToolInputName(name)
  if (normalizedName === 'target_speech_model_id') {
    if (value === 'speech-natural-v1') return 'Natural'
    if (value === 'speech-expressive-v1') return 'Expressive'
  }
  const depthCaptionStyleLabels = {
    '3d_pop': '3D Pop',
    youtube_clean: 'YouTube Clean',
    candy_depth: 'Candy Depth',
    retro_offset: 'Retro Offset',
    chrome_lift: 'Chrome Lift',
    soft_clay: 'Soft Clay',
    acid_sticker: 'Acid Sticker',
  }
  const captionLabels: Record<string, Record<string, string>> = {
    style_name: depthCaptionStyleLabels,
    caption_style: depthCaptionStyleLabels,
    subtitle_mode: {
      original: 'Original',
      translated: 'Translated Only',
      bilingual: 'Dual Language',
    },
    bilingual_order: {
      source_above: 'Original Above · Translation Below',
      translation_above: 'Translation Above · Original Below',
    },
    source_style_name: { inherit: 'Same as Caption Style', ...depthCaptionStyleLabels },
    translation_style_name: { inherit: 'Same as Caption Style', ...depthCaptionStyleLabels },
    target_language: {
      cs: 'Czech',
      da: 'Danish',
      de: 'German',
      el: 'Greek',
      en: 'English',
      es: 'Spanish',
      fi: 'Finnish',
      fr: 'French',
      hu: 'Hungarian',
      id: 'Indonesian',
      it: 'Italian',
      ms: 'Malay',
      nl: 'Dutch',
      no: 'Norwegian',
      pl: 'Polish',
      pt: 'Portuguese',
      'pt-BR': 'Portuguese (Brazil)',
      ro: 'Romanian',
      ru: 'Russian',
      sv: 'Swedish',
      tr: 'Turkish',
      uk: 'Ukrainian',
      vi: 'Vietnamese',
    },
  }
  const captionLabel = captionLabels[normalizedName]?.[value]
  if (captionLabel) return captionLabel
  const researchLabels: Record<string, Record<string, string>> = {
    execution: {
      research: 'Full research',
      operation: 'Single operation',
    },
    operation: {
      youtube_search: 'YouTube search',
      youtube_comments: 'YouTube comments',
      youtube_video_info: 'YouTube video info',
      youtube_subtitles: 'YouTube subtitles',
      google_trends: 'Google Trends',
      keyword_expand: 'Keyword ideas',
      keyword_metrics: 'Keyword demand',
      trend_compare: 'Trend comparison',
      trend_related_queries: 'Related trend queries',
      trend_related_topics: 'Related trend topics',
      tiktok_signal: 'TikTok signal search',
      reddit_signal: 'Reddit signal search',
      x_signal: 'X signal search',
    },
    use_case: {
      auto: 'Automatic intent',
      niche_discovery: 'Niche discovery',
      trend_video_finder: 'Trending video finder',
      competitor_analysis: 'Competitor analysis',
      content_idea_research: 'Content idea research',
      keyword_validation: 'Keyword validation',
      social_pulse: 'Social pulse',
      custom: 'Custom research',
    },
    output_format: {
      report: 'Readable report',
      canonical_json: 'Structured JSON',
      llm_context: 'LLM context',
    },
  }
  const researchLabel = researchLabels[normalizedName]?.[value]
  if (researchLabel) return researchLabel
  return formatSchemaOptionLabel(value)
}

function getModeIcon(value: string): LucideIcon {
  const normalized = value.toLowerCase()
  if (normalized.includes('image')) return ImageIcon
  if (normalized.includes('video') || normalized.includes('frame')) return Clapperboard
  if (normalized.includes('voice') || normalized.includes('audio')) return AudioLines
  return Type
}

function normalizePrompt(prompt: string) {
  return prompt.trim().replace(/\s+/g, ' ')
}
