'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { isStorageReadinessPending, mergeStorageListItem, storageReadinessPollInterval } from '@/lib/storage/readiness-cache'
import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import {
  ArrowUp,
  AudioLines,
  CheckCircle2,
  Copy,
  Download,
  File as FileIcon,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  Lightbulb,
  List,
  Loader2,
  Mic,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Scissors,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'

import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { StorageClipGroupHeading } from '@/components/storage/storage-clip-group-heading'
import { InspectorTimedTranscript } from '@/components/storage/inspector-timed-transcript'
import { StorageMediaInspector } from '@/components/storage/storage-media-inspector'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AppAlertDialog, type AppAlertTone } from '@/components/ui/app-alert-dialog'
import {
  avatarsQueryKey,
  listAvatars,
  type Avatar,
} from '@/lib/avatar/api'
import { isAuthClientError, type AuthClientError } from '@/lib/auth/errors'
import {
  readBrowserPrincipalScope,
  registerBrowserPrincipalLifecycleResetter,
} from '@/lib/auth/browser-principal-storage'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { WorkspaceChannelRequired } from '@/components/channel/workspace-channel-required'
import type { Channel } from '@/lib/channel/api'
import { getMemorySettings, memorySettingsQueryKey, requestStorageObjectMemoryIndexing } from '@/lib/memory/api'
import {
  memoryIngestionRequestFor,
  memoryUploadAvailability,
  previewMemoryUploadOutcome,
  type MemoryUploadAvailability,
  type MemoryUploadSummary,
} from '@/lib/memory/upload-memory-choice'
import { MemoryIngestionCheckbox, MemoryUploadSummaryLine } from '@/components/memory/memory-ingestion-checkbox'
import { getPublicPlanCatalog } from '@/lib/offer/api'
import {
  bulkDeleteStorageObjects,
  bulkMoveStorageObjects,
  completeStorageUpload,
  createStorageFolder,
  deleteStorageObject,
  getStorageObject,
  getStorageDeliveryUrl,
  getStorageDownloadUrl,
  getStorageOverview,
  getStorageUsage,
  getStorageUsageAggregate,
  initiateStorageUpload,
  listStorageObjects,
  moveStorageObject,
  resolveStorageUploadTransport,
  storageDeliveryRefreshDelay,
  storageObjectsQueryKey,
  storageUsageAggregateQueryKey,
  storageUsageQueryKey,
  updateStorageObject,
  uploadDirectContent,
  uploadProxyContent,
  uploadTusContent,
  type StorageObjectItem,
  type StorageAssetRole,
  type StorageListInput,
  type StoragePreviewInput,
  type StorageUsage,
  type StorageUsageAggregate,
  STORAGE_AVATAR_ASSET_ROLES,
  STORAGE_BULK_DELETE_MAX_ITEMS,
  isIndexedStorageAvatarRole,
} from '@/lib/storage/api'
import { openFileInput } from '@/lib/storage/open-file-picker'
import {
  groupMagicClipItems,
} from '@/lib/storage/magic-clip-groups'
import {
  getStoragePlayerOrigin,
  parseStoragePlayerEvent,
  readStoragePlayerTime,
  registerStoragePlayerEvents,
  seekStoragePlayer,
  STORAGE_PLAYER_REFERRER_POLICY,
  STORAGE_PLAYER_REVEAL_TIMEOUT_MS,
} from '@/lib/storage/player'
import { STORAGE_UPLOAD_CONCURRENCY, storageUploadQueue } from '@/lib/storage/upload-queue'
import { useLocalizedRuntimeError } from '@/lib/i18n/use-localized-runtime-error'
import { isStorageGifPreview } from '@/lib/storage/use-storage-thumbnail-url'
import {
  VisibleStorageDeliveryProvider,
  refreshVisibleStoragePreviews,
  useVisibleStorageDeliveryItem,
} from '@/lib/storage/visible-storage-delivery'
import { useYoutubeImportJob } from '@/lib/storage/use-youtube-import-job'
import { isAmbiguousMutationError, type ClientMutationAttempt } from '@/lib/idempotency/client-mutation-control'
import {
  youtubeImportFailureNotice,
  youtubeImportJobIsInProgress,
  youtubeImportJobPhase,
  youtubeImportVisibleInAssetView,
} from '@/lib/storage/youtube-import'
import { cn } from '@/lib/utils'
import {
  listVoiceProfiles,
  voiceProfilesQueryKey,
  type VoiceProfile,
} from '@/lib/voice/api'
import {
  getCanonicalVoiceLanguageRouteParam,
  getOpaqueVoiceRouteParam,
} from '@/lib/voice/tool-route-params'
import {
  createWorkflowActionIdempotencyKey,
  deleteMediaTranscriptArtifact,
  getMediaTranscriptDownloadUrl,
  getMediaTranscriptText,
  getWorkflowAgentStatus,
  launchWorkflowAgent,
  listMediaTranscriptArtifacts,
  mediaTranscriptsQueryKey,
  type MediaTranscriptArtifact,
  type MediaTranscriptDownloadFormat,
} from '@/lib/workflows/api'
import {
  clearTranscriptLaunchAttempt,
  getOrCreateTranscriptLaunchAttempt,
  type TranscriptLaunchIntent,
} from '@/lib/workflows/transcript-launch-control'
import {
  blocksTranscriptMutation,
  isStaleTranscriptArtifact,
} from '@/lib/workflows/transcript-artifact-state'
import { UiText } from '@/components/i18n/ui-text'
import {
  YoutubeImportFailureAlert,
  YoutubeImportPlaceholderCard,
  YoutubeImportPlaceholderListRow,
  youtubeImportStatusLabel,
  youtubeImportUserMessage,
} from '@/components/storage/storage-youtube-import-status'
import { useFormatter, useTranslations } from 'next-intl'

type ViewMode = 'grid' | 'list'
type StorageAssetView = 'default' | 'avatar' | 'voice' | 'image' | 'video' | 'clip' | 'document'
type VoiceAssetFilter = 'all' | 'generated' | 'reference'
type StorageVoiceAssetKind = 'generated' | 'reference' | 'preview' | 'audio'
type UploadTaskStatus = 'queued' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'failed' | 'cancelled'
type StorageStatusTone = 'queued' | 'uploading' | 'processing' | 'complete' | 'failed' | 'blocked' | 'deleting' | 'cancelled'
type StorageStatusBadgeModel = {
  label: string
  tone: StorageStatusTone
}
type YoutubeImportPlaceholderState = {
  labels: string[]
  statusLabel: string
  failed: boolean
  detail: string | null
  thumbnailUrl: string | null
}
type StorageTranslator = (key: string, values?: Record<string, string | number>) => string
type StorageFormatter = ReturnType<typeof useFormatter>
type StoragePreviewKind = 'image' | 'video' | 'audio' | 'text' | 'unsupported'
type StoragePreviewMediaStatus = 'loading' | 'ready' | 'error'
type StoragePreviewDialogState = {
  item: StorageObjectItem
  kind: StoragePreviewKind
  url: string | null
  variant: 'original' | 'stream' | null
  expiresAt: string | null
  status: 'loading' | 'ready' | 'processing' | 'error'
  error: string | null
}
type StorageAlertDialogState = {
  title: string
  description: string
  confirmLabel?: string
  tone?: AppAlertTone
}
type StorageLimitDialogState = {
  fileName: string
  fileSizeBytes: number
  singleFileLimitBytes: number | null
  totalStorageBytes: number | null
  totalStorageLoading: boolean
}
type StorageUsageDisplay = {
  label: string
  title: string
}
type StorageUploadPlan = {
  supported: File[]
  unsupported: File[]
}

type UploadTask = {
  id: string
  principalId: string
  channelId: string
  objectId?: string
  uploadSessionId?: string
  fileName: string
  size: number
  progress: number
  status: UploadTaskStatus
  createdAt: number
  abortController?: AbortController
  settledAt?: number
  error?: string
}

const STORAGE_LIMIT_UPGRADE_HREF = '/offer-plan?next=/storage'
const PREVIEW_DATA_URL_MAX_LENGTH = 38_000
const PREVIEW_MAX_BATCH_SIZE = 16
const PREVIEW_MAX_VIDEO_BATCH_SIZE = 8
const PREVIEW_MAX_IMAGE_BYTES = 10 * 1024 * 1024
const PREVIEW_MAX_VIDEO_BYTES = 96 * 1024 * 1024
const STORAGE_SEARCH_DEBOUNCE_MS = 300
const STORAGE_INVALIDATION_BATCH_MS = 800
const STORAGE_PROCESSING_REFRESH_MS = 8_000
const STORAGE_PROCESSING_MEDIUM_REFRESH_MS = 15_000
const STORAGE_PROCESSING_SLOW_REFRESH_MS = 30_000
const STORAGE_PROCESSING_POLL_MAX_MS = 10 * 60_000
const STORAGE_PREVIEW_DELIVERY_POLL_MAX_MS = 20 * 60_000
const STORAGE_PREVIEW_DELIVERY_RETRY_MAX_MS = 30_000
const STORAGE_PROCESSING_LIST_RECONCILE_MIN_MS = 30_000
const MEDIA_TRANSCRIPT_FAST_POLL_INTERVAL_MS = 5_000
const MEDIA_TRANSCRIPT_WARM_POLL_INTERVAL_MS = 10_000
const MEDIA_TRANSCRIPT_SLOW_POLL_INTERVAL_MS = 30_000
const MEDIA_TRANSCRIPT_LONG_POLL_INTERVAL_MS = 60_000
const MEDIA_TRANSCRIPT_FAST_POLL_WINDOW_MS = 30_000
const MEDIA_TRANSCRIPT_WARM_POLL_WINDOW_MS = 2 * 60_000
const MEDIA_TRANSCRIPT_SLOW_POLL_WINDOW_MS = 10 * 60_000
const MEDIA_TRANSCRIPT_POLL_DEADLINE_MS = 30 * 60_000
const UPLOAD_QUICK_RECOVERY_RETRY_DELAYS_MS = [400, 1_000, 2_000]
const UPLOAD_HISTORY_LIMIT = 10
const UPLOAD_COMPLETE_VISIBLE_MS = 30_000
const UPLOAD_FAILED_VISIBLE_MS = 90_000
const UPLOAD_CANCELLED_VISIBLE_MS = 12_000
const STORAGE_SELECT_CHECKBOX_CLASS = 'border-border bg-background shadow-sm data-[state=checked]:border-primary'
const storageOverviewDegradedQueryKey = (channelId: string | null) => [
  'storage',
  'overview-degraded',
  channelId,
] as const

type UploadTaskStore = {
  tasks: UploadTask[]
  activeTaskCount: number
  addTasks: (tasks: UploadTask[]) => void
  updateTask: (taskId: string, patch: Partial<UploadTask>) => void
  cancelTask: (taskId: string) => void
  dismissTask: (taskId: string) => void
  purgeTasks: () => void
  pruneSettledTasks: () => void
}

const useUploadTaskStore = create<UploadTaskStore>((set) => {
  const commitTasks = (tasks: UploadTask[]) => {
    const limited = limitUploadTasks(tasks)
    return {
      tasks: limited,
      activeTaskCount: limited.filter(isUploadTaskActive).length,
    }
  }

  return {
    tasks: [],
    activeTaskCount: 0,
    addTasks: (tasks) => set((state) => commitTasks([...tasks, ...state.tasks])),
    updateTask: (taskId, patch) => set((state) => commitTasks(state.tasks.map((task) => (
      task.id === taskId
        ? {
          ...task,
          ...patch,
          ...(patch.status && isUploadTaskSettledStatus(patch.status)
            ? { settledAt: Date.now() }
            : {}),
        }
        : task
    )))),
    cancelTask: (taskId) => set((state) => commitTasks(state.tasks.map((task) => {
      if (task.id !== taskId || !isUploadTaskCancelable(task)) return task
      task.abortController?.abort()
      return {
        ...task,
        status: 'cancelled',
        progress: task.status === 'queued' ? 0 : task.progress,
        settledAt: Date.now(),
        error: 'Upload cancelled.',
      }
    }))),
    dismissTask: (taskId) => set((state) => commitTasks(state.tasks.filter((task) => task.id !== taskId))),
    purgeTasks: () => set((state) => {
      state.tasks.forEach((task) => task.abortController?.abort())
      return commitTasks([])
    }),
    pruneSettledTasks: () => set((state) => commitTasks(state.tasks.filter((task) => {
      if (!task.settledAt || !isUploadTaskSettledStatus(task.status)) return true
      const visibleMs = getUploadTaskVisibleMs(task.status)
      return Date.now() - task.settledAt < visibleMs
    }))),
  }
})

registerBrowserPrincipalLifecycleResetter(() => useUploadTaskStore.getState().purgeTasks())

export function StoragePage() {
  return <StorageWorkspace />
}

export function StoragePageLoading() {
  return <WorkspaceRouteLoading />
}

function StorageWorkspace() {
  const tAuto = useTranslations('Auto')
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const localizeRuntimeError = useLocalizedRuntimeError()
  const format = useFormatter()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { activeChannel, activeChannelId, isLoading: channelLoading, workspaceReady } = useActiveChannel()
  const addUploadTasks = useUploadTaskStore((state) => state.addTasks)
  const updateUploadTask = useUploadTaskStore((state) => state.updateTask)
  const dismissUploadTask = useUploadTaskStore((state) => state.dismissTask)
  const allUploadTasks = useUploadTaskStore((state) => state.tasks)
  const browserPrincipalScope = readBrowserPrincipalScope()
  const uploadTasks = React.useMemo(
    () => allUploadTasks.filter((task) => isUploadTaskInScope(task, browserPrincipalScope, activeChannelId)),
    [activeChannelId, allUploadTasks, browserPrincipalScope],
  )
  const activeTaskCount = uploadTasks.filter(isUploadTaskActive).length
  const [currentPath, setCurrentPath] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid')
  const [assetView, setAssetView] = React.useState<StorageAssetView>('default')
  const [voiceAssetFilter, setVoiceAssetFilter] = React.useState<VoiceAssetFilter>('all')
  const [selectionMode, setSelectionMode] = React.useState(false)
  const [createFolderOpen, setCreateFolderOpen] = React.useState(false)
  const [deleteDialog, setDeleteDialog] = React.useState<{ open: boolean; items: StorageObjectItem[] }>({
    open: false,
    items: [],
  })
  const [moveDialog, setMoveDialog] = React.useState<{ open: boolean; items: StorageObjectItem[] }>({
    open: false,
    items: [],
  })
  const [renameDialog, setRenameDialog] = React.useState<{ open: boolean; item: StorageObjectItem | null }>({
    open: false,
    item: null,
  })
  const [previewDialog, setPreviewDialog] = React.useState<StoragePreviewDialogState | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set())
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(() => new Set())
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [storageAlert, setStorageAlert] = React.useState<StorageAlertDialogState | null>(null)
  const [memoryOverrideItem, setMemoryOverrideItem] = React.useState<StorageObjectItem | null>(null)
  // S19 "Belleğe de ekle": one shared choice for the next uploads (component memory only, no browser storage).
  const [addUploadsToMemory, setAddUploadsToMemory] = React.useState(true)
  const [memoryUploadSummary, setMemoryUploadSummary] = React.useState<MemoryUploadSummary | null>(null)
  const [storageLimitDialog, setStorageLimitDialog] = React.useState<StorageLimitDialogState | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const previewRequestRef = React.useRef(0)
  const invalidationTimerRef = React.useRef<number | null>(null)
  const processingSyncInFlightRef = React.useRef(false)
  const processingListReconciledRef = React.useRef<{ channelId: string; at: number } | null>(null)
  const storageLimitDialogOpenRef = React.useRef(false)
  const overviewLoadedChannelIdsRef = React.useRef(new Set<string>())
  const debouncedSearch = useDebouncedValue(search, STORAGE_SEARCH_DEBOUNCE_MS)
  const storageWriteDisabledReason = getStorageWriteDisabledReason(activeChannel)
  const storageReady = Boolean(activeChannelId) && workspaceReady
  const readActionsDisabled = !storageReady || channelLoading
  const writeActionsDisabled = readActionsDisabled || Boolean(storageWriteDisabledReason)

  React.useEffect(() => {
    router.prefetch(STORAGE_LIMIT_UPGRADE_HREF)
    void getPublicPlanCatalog().catch(() => undefined)
  }, [router])

  const listInput = React.useMemo(() => getStorageListInput({
    assetView,
    currentPath,
    search: debouncedSearch,
    voiceAssetFilter,
  }), [assetView, currentPath, debouncedSearch, voiceAssetFilter])

  const readinessFirstSeenRef = React.useRef(new Map<string, number>())
  const objectsQuery = useInfiniteQuery({
    queryKey: storageObjectsQueryKey(activeChannelId, listInput),
    queryFn: async ({ pageParam, signal }) => {
      const input = { ...listInput, limit: 100, offset: pageParam }
      const channelId = activeChannelId!
      if (pageParam !== 0 || overviewLoadedChannelIdsRef.current.has(channelId)) {
        return listStorageObjects(channelId, input, { signal })
      }

      overviewLoadedChannelIdsRef.current.add(channelId)
      try {
        const overview = await getStorageOverview(channelId, input, { signal })
        queryClient.setQueryData(storageOverviewDegradedQueryKey(channelId), overview.degraded_sources)
        if (overview.channel_usage) {
          queryClient.setQueryData(storageUsageQueryKey(channelId), overview.channel_usage)
        }
        if (overview.tenant_usage) {
          queryClient.setQueryData(storageUsageAggregateQueryKey, overview.tenant_usage)
        }
        return overview.objects
      } catch (error) {
        overviewLoadedChannelIdsRef.current.delete(channelId)
        throw error
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (
      lastPage.meta.hasMore ? lastPage.meta.offset + lastPage.meta.limit : undefined
    ),
    enabled: storageReady && assetView !== 'avatar',
    refetchInterval: (query) => query.state.error ? false : storageReadinessPollInterval(
      query.state.data?.pages.flatMap((page) => page.data) ?? [],
      readinessFirstSeenRef.current,
    ),
    staleTime: 30_000,
    retry: false,
  })

  const avatarsQuery = useQuery({
    queryKey: avatarsQueryKey({ channelId: activeChannelId ?? '', limit: 100 }),
    queryFn: ({ signal }) => listAvatars({ channelId: activeChannelId!, limit: 100 }, { signal }),
    enabled: storageReady && assetView === 'avatar',
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => (
      query.state.data?.data.some((avatar) => avatar.status === 'provisioning') ? 4_000 : false
    ),
  })

  const memorySettingsQuery = useQuery({
    queryKey: memorySettingsQueryKey(activeChannelId),
    queryFn: ({ signal }) => getMemorySettings(activeChannelId!, { signal }),
    enabled: storageReady,
    staleTime: 60_000,
    retry: false,
  })
  const memoryUploadState = memoryUploadAvailability(memorySettingsQuery.data)

  const overviewDegradedQuery = useQuery({
    queryKey: storageOverviewDegradedQueryKey(activeChannelId),
    queryFn: (): string[] => [],
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const degradedSources = overviewDegradedQuery.data ?? []

  const usageQuery = useQuery({
    queryKey: storageUsageQueryKey(activeChannelId),
    queryFn: () => getStorageUsage(activeChannelId!),
    enabled: storageReady && objectsQuery.isSuccess && degradedSources.includes('channel_usage'),
    staleTime: 60_000,
    retry: false,
  })

  const usageAggregateQuery = useQuery({
    queryKey: storageUsageAggregateQueryKey,
    queryFn: getStorageUsageAggregate,
    enabled: storageReady && objectsQuery.isSuccess && degradedSources.includes('tenant_usage'),
    staleTime: 60_000,
    retry: 1,
  })

  const voiceProfilesListInput = React.useMemo(() => ({
    channelId: activeChannelId ?? undefined,
    status: 'ready' as const,
    limit: 100,
    offset: 0,
  }), [activeChannelId])
  const voiceProfilesQuery = useQuery({
    queryKey: voiceProfilesQueryKey(voiceProfilesListInput),
    queryFn: ({ signal }) => listVoiceProfiles(voiceProfilesListInput, { signal }),
    enabled: storageReady && assetView === 'voice',
    staleTime: 30_000,
    retry: false,
  })

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => {
      if (storageWriteDisabledReason) throw new Error(storageWriteDisabledReason)
      return createStorageFolder({
        channelId: activeChannelId!,
        name,
        parentPath: currentPath || undefined,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['storage', 'objects', activeChannelId] })
      void queryClient.invalidateQueries({ queryKey: storageUsageQueryKey(activeChannelId) })
      void queryClient.invalidateQueries({ queryKey: storageUsageAggregateQueryKey })
      setCreateFolderOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (itemsToDelete: StorageObjectItem[]) => {
      if (!activeChannelId) return null
      if (storageWriteDisabledReason) throw new Error(storageWriteDisabledReason)
      if (itemsToDelete.length === 1) {
        return deleteStorageObject({
          channelId: activeChannelId,
          objectId: itemsToDelete[0]!.id,
        })
      }
      return bulkDeleteStorageObjects({
        channelId: activeChannelId,
        objectIds: itemsToDelete.map((item) => item.id),
      })
    },
    onMutate: (itemsToDelete) => {
      const ids = itemsToDelete.map((item) => item.id)
      setDeletingIds((current) => new Set([...current, ...ids]))
      setSelectedIds((current) => {
        const next = new Set(current)
        ids.forEach((id) => next.delete(id))
        return next
      })
    },
    onSuccess: async () => {
      setDeleteDialog({ open: false, items: [] })
      setSelectedIds(new Set())
      await invalidateStorageNow()
    },
    onError: (error) => {
      setActionError(getStorageActionErrorMessage(error))
    },
    onSettled: (_data, _error, itemsToDelete) => {
      const ids = itemsToDelete?.map((item) => item.id) ?? []
      setDeletingIds((current) => {
        const next = new Set(current)
        ids.forEach((id) => next.delete(id))
        return next
      })
    },
  })

  const moveMutation = useMutation({
    mutationFn: async (input: { items: StorageObjectItem[]; parentPath?: string }) => {
      if (!activeChannelId) return null
      if (storageWriteDisabledReason) throw new Error(storageWriteDisabledReason)
      if (input.items.length === 1) {
        return moveStorageObject({
          channelId: activeChannelId,
          objectId: input.items[0]!.id,
          parentPath: input.parentPath,
        })
      }
      return bulkMoveStorageObjects({
        channelId: activeChannelId,
        objectIds: input.items.map((item) => item.id),
        parentPath: input.parentPath,
      })
    },
    onSuccess: async () => {
      setMoveDialog({ open: false, items: [] })
      setSelectedIds(new Set())
      await invalidateStorageNow()
    },
  })

  const renameMutation = useMutation({
    mutationFn: async (input: { item: StorageObjectItem; name: string }) => {
      if (!activeChannelId) return null
      if (storageWriteDisabledReason) throw new Error(storageWriteDisabledReason)
      return updateStorageObject({
        channelId: activeChannelId,
        objectId: input.item.id,
        name: input.name,
      })
    },
    onSuccess: async () => {
      setRenameDialog({ open: false, item: null })
      setSelectedIds(new Set())
      await invalidateStorageNow()
    },
  })

  const memoryIndexingMutation = useMutation({
    mutationFn: async (item: StorageObjectItem) => {
      if (!activeChannelId) return null
      const action = getStorageMemoryAction(item)
      if (!action) return null
      // S20: "Approve" clears only the approval step; "Add anyway" (confirmed first) overrides a channel rule.
      return requestStorageObjectMemoryIndexing({
        channelId: activeChannelId,
        objectId: item.id,
        approve: action === 'approve' || undefined,
        force: action === 'add_anyway' || undefined,
      })
    },
    onSuccess: async () => {
      await invalidateStorageNow()
    },
    onError: (error) => {
      setActionError(getStorageActionErrorMessage(error))
    },
  })

  React.useEffect(() => {
    setCurrentPath('')
    setSearch('')
    setAssetView('default')
    setVoiceAssetFilter('all')
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [activeChannelId])

  React.useEffect(() => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [assetView, currentPath, search, voiceAssetFilter])

  const items = React.useMemo(() => objectsQuery.data?.pages.flatMap((page) => page.data) ?? [], [objectsQuery.data])
  const orderedItems = React.useMemo(() => {
    const folders = items.filter((item) => item.type === 'folder')
    const files = items.filter((item) => item.type === 'file')
    return [...folders, ...files]
  }, [items])
  const assetFilteredItems = React.useMemo(
    () => filterStorageItemsForAssetSearch(orderedItems, assetView, debouncedSearch),
    [assetView, debouncedSearch, orderedItems],
  )
  const visibleItems = assetFilteredItems
  const libraryAvatars = React.useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    const avatars = avatarsQuery.data?.data ?? []
    if (!query) return avatars
    return avatars.filter((avatar) => avatar.display_name.toLowerCase().includes(query))
  }, [avatarsQuery.data?.data, debouncedSearch])
  const avatarDeliveryItems = React.useMemo(
    () => avatarsToDeliveryItems(libraryAvatars),
    [libraryAvatars],
  )
  const loadMore = React.useCallback(() => {
    if (!objectsQuery.hasNextPage || objectsQuery.isFetchingNextPage) return
    void objectsQuery.fetchNextPage()
  }, [objectsQuery.fetchNextPage, objectsQuery.hasNextPage, objectsQuery.isFetchingNextPage])
  const processingUploadKey = React.useMemo(() => (
    uploadTasks
      .filter((task) => task.status === 'processing' && task.channelId === activeChannelId)
      .map((task) => `${task.id}:${task.uploadSessionId ?? ''}:${task.objectId ?? ''}`)
      .join('|')
  ), [activeChannelId, uploadTasks])
  const selectedItems = React.useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)),
    [selectedIds, visibleItems],
  )
  const isBusy = channelLoading || objectsQuery.isLoading
  const youtubeImport = useYoutubeImportJob({
    channelId: activeChannelId,
    timeoutMessage: tStorage('picker.youtubeTimedOut'),
    formatError: (error) => youtubeImportUserMessage(error, tStorage, localizeRuntimeError),
  })
  const youtubePlaceholder = youtubeImport.job
    && youtubeImportJobIsInProgress(youtubeImport.job)
    && youtubeImportVisibleInAssetView(youtubeImport.job, assetView)
    ? {
      labels: [youtubeImport.job.url.videoId],
      statusLabel: youtubeImportStatusLabel(tStorage, youtubeImportJobPhase(youtubeImport.job)),
      failed: false,
      detail: null,
      thumbnailUrl: youtubeImport.job.quote?.thumbnailUrl ?? null,
    } satisfies YoutubeImportPlaceholderState
    : null
  const youtubeFailure = youtubeImportFailureNotice(youtubeImport.job)
  const refreshStorage = () => Promise.all([
    objectsQuery.refetch(),
    activeChannelId ? refreshVisibleStoragePreviews(queryClient, activeChannelId) : Promise.resolve(),
  ])
  const canGoUp = assetView === 'default' && Boolean(currentPath)
  const usageDisplay = React.useMemo(
    () => getStorageUsageDisplay(usageQuery.data ?? null, usageAggregateQuery.data ?? null, format, tStorage),
    [format, tStorage, usageAggregateQuery.data, usageQuery.data],
  )

  const invalidateStorageNow = React.useCallback(async () => {
    if (activeChannelId) overviewLoadedChannelIdsRef.current.delete(activeChannelId)
    await queryClient.invalidateQueries({ queryKey: ['storage', 'objects', activeChannelId] })
  }, [activeChannelId, queryClient])

  const scheduleStorageInvalidation = React.useCallback(() => {
    if (invalidationTimerRef.current !== null) return
    invalidationTimerRef.current = window.setTimeout(() => {
      invalidationTimerRef.current = null
      void invalidateStorageNow()
    }, STORAGE_INVALIDATION_BATCH_MS)
  }, [invalidateStorageNow])

  const invalidateProcessingObjects = React.useCallback(() => (
    queryClient.invalidateQueries({ queryKey: ['storage', 'objects', activeChannelId] })
  ), [activeChannelId, queryClient])

  React.useEffect(() => {
    return () => {
      if (invalidationTimerRef.current === null) return
      window.clearTimeout(invalidationTimerRef.current)
      invalidationTimerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!activeChannelId) return
    const itemsById = new Map(orderedItems.map((item) => [item.id, item]))

    for (const task of uploadTasks) {
      if (task.status !== 'processing' || task.channelId !== activeChannelId || !task.objectId) continue
      const item = itemsById.get(task.objectId)
      if (!item) continue

      if (item.status === 'active') {
        updateUploadTask(task.id, { status: 'complete', progress: 100 })
      } else if (item.status === 'failed' || item.status === 'quarantined') {
        updateUploadTask(task.id, {
          status: 'failed',
          progress: 100,
          error: item.status === 'quarantined' ? 'Upload was blocked after processing.' : 'Upload processing failed.',
        })
      }
    }
  }, [activeChannelId, orderedItems, updateUploadTask, uploadTasks])

  React.useEffect(() => {
    if (!activeChannelId || !processingUploadKey) return undefined
    let cancelled = false
    let timeoutId: number | null = null
    const effectStartedAt = Date.now()

    const getNextRefreshMs = () => {
      const elapsedMs = Date.now() - effectStartedAt

      if (elapsedMs < 30_000) return STORAGE_PROCESSING_REFRESH_MS
      if (elapsedMs < 2 * 60_000) return STORAGE_PROCESSING_MEDIUM_REFRESH_MS
      if (elapsedMs < STORAGE_PROCESSING_POLL_MAX_MS) return STORAGE_PROCESSING_SLOW_REFRESH_MS
      return null
    }

    const scheduleNextSync = (delayMs?: number) => {
      if (cancelled || document.visibilityState !== 'visible') return
      const nextDelayMs = delayMs ?? getNextRefreshMs()
      if (nextDelayMs === null) return
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        timeoutId = null
        void syncProcessingUploads()
      }, nextDelayMs)
    }

    const syncProcessingUploads = async () => {
      if (Date.now() - effectStartedAt >= STORAGE_PROCESSING_POLL_MAX_MS) return
      if (document.visibilityState === 'hidden') {
        scheduleNextSync()
        return
      }
      if (processingSyncInFlightRef.current) {
        scheduleNextSync(1_000)
        return
      }
      processingSyncInFlightRef.current = true
      try {
        const tasksToCheck = useUploadTaskStore
          .getState()
          .tasks
          .filter((task) => (
            task.status === 'processing'
            && task.channelId === activeChannelId
            && Boolean(task.uploadSessionId)
          ))

        let completedAny = false
        await runWithConcurrency(tasksToCheck, STORAGE_UPLOAD_CONCURRENCY, async (task) => {
          try {
            const result = await completeStorageUpload({
              channelId: task.channelId!,
              uploadSessionId: task.uploadSessionId!,
            })
            if (cancelled) return
            if (result.status === 'active') {
              updateUploadTask(task.id, { status: 'complete', progress: 100 })
              completedAny = true
            }
          } catch {
            // The provider may still be transcoding or the session may already be reconciled by a webhook.
          }
        })

        if (!cancelled) {
          const now = Date.now()
          const lastListReconcile = processingListReconciledRef.current?.channelId === activeChannelId
            ? processingListReconciledRef.current.at
            : 0
          const listReconcileDue = tasksToCheck.length > 0
            && now - lastListReconcile >= STORAGE_PROCESSING_LIST_RECONCILE_MIN_MS

          if (completedAny) {
            processingListReconciledRef.current = { channelId: activeChannelId, at: now }
            scheduleStorageInvalidation()
          } else if (listReconcileDue) {
            await invalidateProcessingObjects()
            processingListReconciledRef.current = { channelId: activeChannelId, at: Date.now() }
          }
        }
      } finally {
        processingSyncInFlightRef.current = false
        scheduleNextSync()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - effectStartedAt >= STORAGE_PROCESSING_POLL_MAX_MS) return
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
      void syncProcessingUploads()
    }

    void syncProcessingUploads()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [
    activeChannelId,
    processingUploadKey,
    invalidateProcessingObjects,
    scheduleStorageInvalidation,
    updateUploadTask,
  ])

  const handleAssetViewChange = React.useCallback((nextView: StorageAssetView) => {
    setAssetView(nextView)
    setVoiceAssetFilter('all')
    setSearch('')
    setSelectedIds(new Set())
    setSelectionMode(false)
    if (nextView !== 'default') setCurrentPath('')
  }, [])

  const useVoiceAsset = React.useCallback((item: StorageObjectItem) => {
    const href = getStorageVoiceToolHref(item)
    if (href) router.push(href)
  }, [router])

  const toggleSelected = React.useCallback((itemId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked && !current.has(itemId) && current.size >= STORAGE_BULK_DELETE_MAX_ITEMS) {
        setActionError(tStorage('delete.selectionLimit', { count: STORAGE_BULK_DELETE_MAX_ITEMS }))
        return current
      }
      const next = new Set(current)
      if (checked) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }, [tStorage])

  const toggleAllSelected = React.useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set())
      return
    }
    const capped = visibleItems.slice(0, STORAGE_BULK_DELETE_MAX_ITEMS)
    if (visibleItems.length > STORAGE_BULK_DELETE_MAX_ITEMS) {
      setActionError(tStorage('delete.selectionLimit', { count: STORAGE_BULK_DELETE_MAX_ITEMS }))
    }
    setSelectedIds(new Set(capped.map((item) => item.id)))
  }, [tStorage, visibleItems])

  const copyDeliveryUrl = React.useCallback(async (item: StorageObjectItem) => {
    if (!activeChannelId || item.type !== 'file') return
    const delivery = await getStorageDeliveryUrl({
      channelId: activeChannelId,
      objectId: item.id,
      variant: getStoragePreviewDeliveryVariant(item),
    })
    await copyTextToClipboard(delivery.url)
  }, [activeChannelId])

  const downloadItem = React.useCallback(async (item: StorageObjectItem) => {
    if (!activeChannelId || item.type !== 'file') return
    if (item.delivery_variant === 'stream' || item.provider_kind === 'stream') {
      throw new Error('Stream videos can be played, but direct file download is not available yet.')
    }
    const link = document.createElement('a')
    link.href = getStorageDownloadUrl({
      channelId: activeChannelId,
      objectId: item.id,
      fileName: item.name,
    })
    link.download = item.name
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [activeChannelId])

  const downloadSelectedItems = React.useCallback(async (itemsToDownload: StorageObjectItem[]) => {
    const filesToDownload = itemsToDownload.filter((item) => item.type === 'file')
    if (filesToDownload.length === 0) {
      throw new Error('Select at least one file to download.')
    }

    for (const item of filesToDownload) {
      await downloadItem(item)
      await sleep(120)
    }
  }, [downloadItem])

  const closePreviewDialog = React.useCallback((open: boolean) => {
    if (open) return
    previewRequestRef.current += 1
    setPreviewDialog(null)
  }, [])

  const refreshPreviewReadiness = React.useCallback(async (objectId: string) => {
    if (!activeChannelId) return
    const latest = await getStorageObject({ channelId: activeChannelId, objectId })
    queryClient.setQueriesData<InfiniteData<Awaited<ReturnType<typeof listStorageObjects>>>>(
      { queryKey: ['storage', 'objects', activeChannelId] },
      (cached) => mergeStorageListItem(cached, latest),
    )
    setPreviewDialog((current) => current?.item.id === objectId
      && Date.parse(current.item.updated_at) <= Date.parse(latest.updated_at)
      ? { ...current, item: latest }
      : current)
  }, [activeChannelId, queryClient])

  const openItem = React.useCallback(async (item: StorageObjectItem) => {
    if (item.type === 'folder') {
      setCurrentPath(item.path)
      return
    }
    if (!activeChannelId) return
    if (!isStorageFileOpenable(item)) {
      setActionError('File is still processing and cannot be opened yet.')
      return
    }
    const kind = getStoragePreviewKind(item)
    const requestedVariant = getStoragePreviewDeliveryVariant(item)
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    setPreviewDialog({
      item,
      kind,
      url: null,
      variant: requestedVariant ?? (isStorageStreamVideo(item) ? 'stream' : 'original'),
      expiresAt: null,
      status: 'loading',
      error: null,
    })

    try {
      const delivery = await getStorageDeliveryUrl({
        channelId: activeChannelId,
        objectId: item.id,
        expiresInSeconds: 3600,
        variant: requestedVariant,
      })
      if (previewRequestRef.current !== requestId) return
      setPreviewDialog({
        item,
        kind,
        url: delivery.url,
        variant: delivery.variant,
        expiresAt: delivery.expires_at ?? null,
        status: 'ready',
        error: null,
      })
      void refreshPreviewReadiness(item.id).catch(() => scheduleStorageInvalidation())
    } catch (error) {
      if (previewRequestRef.current !== requestId) return
      if (isStorageDeliveryTemporarilyUnavailable(error)) {
        setPreviewDialog((current) => (
          current?.item.id === item.id
            ? {
              ...current,
              status: 'processing',
              error: null,
            }
            : current
        ))
        return
      }
      setPreviewDialog((current) => (
        current?.item.id === item.id
          ? {
            ...current,
            status: 'error',
            error: getStorageActionErrorMessage(error),
        }
        : current
      ))
      throw error
    }
  }, [activeChannelId, refreshPreviewReadiness, scheduleStorageInvalidation])

  const retryPreviewItem = React.useCallback(async (item: StorageObjectItem) => {
    if (!activeChannelId) return
    const latestItem = await getStorageObject({
      channelId: activeChannelId,
      objectId: item.id,
    })
    await openItem(latestItem)
  }, [activeChannelId, openItem])

  React.useEffect(() => {
    const preview = previewDialog
    if (!activeChannelId || !preview || preview.status !== 'processing') return

    const requestId = previewRequestRef.current
    let cancelled = false
    let retryTimer: number | null = null
    let retryAttempt = 0
    const retryStartedAt = Date.now()

    const scheduleRetry = (delayMs: number) => {
      if (cancelled) return
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        if (document.visibilityState === 'visible') void retryDelivery()
      }, delayMs)
    }

    const retryDelivery = async () => {
      if (document.visibilityState !== 'visible') return
      const remainingMs = STORAGE_PREVIEW_DELIVERY_POLL_MAX_MS - (Date.now() - retryStartedAt)
      if (remainingMs <= 0) {
        setPreviewDialog((current) => (
          current?.item.id === preview.item.id
            ? {
              ...current,
              status: 'error',
              error: 'Media is still processing. Close and reopen the preview to try again.',
            }
            : current
        ))
        return
      }
      try {
        const delivery = await getStorageDeliveryUrl({
          channelId: activeChannelId,
          objectId: preview.item.id,
          expiresInSeconds: 3600,
          variant: preview.variant === 'original' && isStorageStreamVideo(preview.item) ? 'original' : undefined,
        })
        if (cancelled || previewRequestRef.current !== requestId) return
        setPreviewDialog((current) => (
          current?.item.id === preview.item.id
            ? {
              ...current,
              url: delivery.url,
              variant: delivery.variant,
              expiresAt: delivery.expires_at ?? null,
              status: 'ready',
              error: null,
            }
            : current
        ))
        void refreshPreviewReadiness(preview.item.id).catch(() => scheduleStorageInvalidation())
      } catch (error) {
        if (cancelled || previewRequestRef.current !== requestId) return
        if (isStorageDeliveryTemporarilyUnavailable(error)) {
          try {
            const latestItem = await getStorageObject({
              channelId: activeChannelId,
              objectId: preview.item.id,
            })
            if (cancelled || previewRequestRef.current !== requestId) return
            if (
              latestItem.status === 'failed'
              || latestItem.status === 'quarantined'
              || latestItem.status === 'deleted'
            ) {
              setPreviewDialog((current) => (
                current?.item.id === latestItem.id
                  ? {
                    ...current,
                    item: latestItem,
                    status: 'error',
                    error: getStorageProcessingTerminalError(latestItem),
                  }
                  : current
              ))
              return
            }
          } catch {
            // Delivery retry remains the source of truth while object refresh is unavailable.
          }
          const delayMs = Math.min(
            remainingMs,
            STORAGE_PREVIEW_DELIVERY_RETRY_MAX_MS,
            retryAttempt === 0 ? 1_500 : 5_000 * (2 ** Math.min(retryAttempt - 1, 3)),
          )
          retryAttempt += 1
          scheduleRetry(delayMs)
          return
        }
        setPreviewDialog((current) => (
          current?.item.id === preview.item.id
            ? {
              ...current,
              status: 'error',
              error: getStorageActionErrorMessage(error),
            }
            : current
        ))
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && retryTimer === null) {
        void retryDelivery()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    scheduleRetry(1_500)
    return () => {
      cancelled = true
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [activeChannelId, previewDialog, refreshPreviewReadiness, scheduleStorageInvalidation])

  React.useEffect(() => {
    const preview = previewDialog
    if (!activeChannelId || !preview || preview.status !== 'ready' || !preview.expiresAt) return
    const refreshDelay = storageDeliveryRefreshDelay({ expires_at: preview.expiresAt })
    if (refreshDelay === false) return
    const requestId = previewRequestRef.current
    let cancelled = false
    let refreshTimer: number | null = null

    const refreshDelivery = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const delivery = await getStorageDeliveryUrl({
          channelId: activeChannelId,
          objectId: preview.item.id,
          expiresInSeconds: 3600,
          variant: preview.variant === 'original' && isStorageStreamVideo(preview.item) ? 'original' : undefined,
        })
        if (cancelled || previewRequestRef.current !== requestId) return
        setPreviewDialog((current) => current?.item.id === preview.item.id
          ? {
            ...current,
            url: delivery.url,
            variant: delivery.variant,
            expiresAt: delivery.expires_at ?? null,
            status: 'ready',
            error: null,
          }
          : current)
      } catch (error) {
        if (cancelled || previewRequestRef.current !== requestId) return
        setPreviewDialog((current) => current?.item.id === preview.item.id
          ? {
            ...current,
            status: isStorageDeliveryTemporarilyUnavailable(error) ? 'processing' : 'error',
            error: isStorageDeliveryTemporarilyUnavailable(error)
              ? null
              : getStorageActionErrorMessage(error),
          }
          : current)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && refreshTimer === null) {
        void refreshDelivery()
      }
    }
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null
      void refreshDelivery()
    }, refreshDelay)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [activeChannelId, previewDialog])

  const runStorageAction = React.useCallback(async (action: () => Promise<void>) => {
    try {
      setActionError(null)
      await action()
    } catch (error) {
      setActionError(getStorageActionErrorMessage(error))
    }
  }, [])

  React.useEffect(() => {
    if (!actionError) return undefined
    const timeout = window.setTimeout(() => setActionError(null), 6_000)
    return () => window.clearTimeout(timeout)
  }, [actionError])

  const openStorageAlert = React.useCallback((alert: StorageAlertDialogState) => {
    setStorageAlert(alert)
  }, [])

  const showUnsupportedUploadAlert = React.useCallback((files: File[]) => {
    if (files.length === 0) return
    openStorageAlert({
      title: tStorage('alerts.unsupportedTitle'),
      description: formatUnsupportedUploadDescription(files),
      confirmLabel: tStorage('alerts.ok'),
      tone: 'warning',
    })
  }, [openStorageAlert, tStorage])

  const closeStorageLimitDialog = React.useCallback(() => {
    storageLimitDialogOpenRef.current = false
    setStorageLimitDialog(null)
  }, [])

  const openStorageLimitDialog = React.useCallback((error: unknown, file: File) => {
    if (!isStorageHardLimitError(error) || storageLimitDialogOpenRef.current) return
    storageLimitDialogOpenRef.current = true
    const details = getStorageHardLimitDetails(error)
    setStorageLimitDialog({
      fileName: file.name,
      fileSizeBytes: file.size,
      singleFileLimitBytes: details.maxBytes,
      totalStorageBytes: getStorageIncludedBytes(usageAggregateQuery.data ?? null),
      totalStorageLoading: !usageAggregateQuery.data,
    })
    router.prefetch(STORAGE_LIMIT_UPGRADE_HREF)
    void getPublicPlanCatalog().catch(() => undefined)
    void getStorageUsageAggregate()
      .then((aggregate) => {
        setStorageLimitDialog((current) => (
          current?.fileName === file.name
            ? {
              ...current,
              totalStorageBytes: getStorageIncludedBytes(aggregate),
              totalStorageLoading: false,
            }
            : current
        ))
        queryClient.setQueryData(storageUsageAggregateQueryKey, aggregate)
      })
      .catch(() => {
        setStorageLimitDialog((current) => (
          current?.fileName === file.name
            ? { ...current, totalStorageLoading: false }
            : current
        ))
      })
    void queryClient.invalidateQueries({ queryKey: storageUsageAggregateQueryKey })
    if (activeChannelId) {
      void queryClient.invalidateQueries({ queryKey: storageUsageQueryKey(activeChannelId) })
    }
  }, [activeChannelId, queryClient, router, usageAggregateQuery.data])

  const uploadFiles = React.useCallback(async (selectedFiles: FileList | File[]) => {
    if (!activeChannelId) return
    const uploadPrincipalId = readBrowserPrincipalScope()
    if (!uploadPrincipalId) return
    const uploadChannelId = activeChannelId
    const uploadParentPath = currentPath || undefined
    if (storageWriteDisabledReason) {
      setActionError(storageWriteDisabledReason)
      return
    }
    const uploadPlan = buildStorageUploadPlan(Array.from(selectedFiles).filter((file) => file.size > 0))
    if (uploadPlan.unsupported.length > 0) showUnsupportedUploadAlert(uploadPlan.unsupported)
    const filesToUpload = uploadPlan.supported
    if (filesToUpload.length === 0) return

    const addToMemory = addUploadsToMemory && memoryUploadState.available
    const memoryIngestion = memoryUploadState.available ? memoryIngestionRequestFor(addToMemory, 'storage') : undefined
    setMemoryUploadSummary(null)
    if (memoryUploadState.available) {
      // Read-only preview in parallel with the upload: one summary line, never a gate.
      void previewMemoryUploadOutcome({
        channelId: uploadChannelId,
        source: 'storage',
        checked: addToMemory,
        files: filesToUpload,
        parentPath: uploadParentPath,
      }).then(setMemoryUploadSummary)
    }

    const uploadItems = filesToUpload.map((file) => ({
      file,
      taskId: createClientId(),
      abortController: new AbortController(),
      principalId: uploadPrincipalId,
      channelId: uploadChannelId,
    }))

    addUploadTasks(
      uploadItems.map(({ file, taskId, abortController, principalId, channelId }) => ({
        id: taskId,
        principalId,
        channelId,
        fileName: file.name,
        size: file.size,
        progress: 0,
        status: 'queued' as const,
        createdAt: Date.now(),
        abortController,
      })),
    )

    await Promise.all(uploadItems.map((uploadItem) => storageUploadQueue.run(async () => {
      const { file, taskId, abortController, principalId, channelId } = uploadItem
      if (abortController.signal.aborted || readBrowserPrincipalScope() !== principalId) {
        abortController.abort()
        updateUploadTask(taskId, { status: 'cancelled', progress: 0, error: 'Upload cancelled.' })
        return
      }

      updateUploadTask(taskId, { status: 'preparing', progress: 0 })

      try {
        const preview = await createPreviewMetadata(file, {
          batchSize: filesToUpload.length,
        })
        throwIfUploadCancelled(abortController.signal)
        const session = await initiateStorageUpload({
          channelId,
          file,
          parentPath: uploadParentPath,
          preview,
          memoryIngestion,
          signal: abortController.signal,
        })
        updateUploadTask(taskId, {
          channelId,
          objectId: session.object_id,
          uploadSessionId: session.upload_session_id,
        })
        throwIfUploadCancelled(abortController.signal)

        if (session.upload_status === 'uploaded' || session.upload_status === 'completed') {
          const completed = await completeStorageUpload({
            channelId,
            uploadSessionId: session.upload_session_id,
            finalizeToken: session.finalize_token,
            signal: abortController.signal,
          })
          updateUploadTask(taskId, {
            status: completed.status === 'active' ? 'complete' : 'processing',
            progress: 100,
          })
          scheduleStorageInvalidation()
          return
        }

        updateUploadTask(taskId, { status: 'uploading', progress: 2 })
        let lastProgress = 0
        const progressReporter = createUploadProgressReporter(taskId, updateUploadTask)
        const onProgress = (progress: number) => {
          if (abortController.signal.aborted) return
          lastProgress = Math.max(lastProgress, progress)
          progressReporter.report(progress)
        }

        const uploadTransport = resolveStorageUploadTransport(session)
        if (uploadTransport === 'direct') {
          await uploadDirectContent({ session, file, onProgress, signal: abortController.signal })
          progressReporter.dispose()
          const completed = await completeStorageUpload({
            channelId,
            uploadSessionId: session.upload_session_id,
            finalizeToken: session.finalize_token,
            signal: abortController.signal,
          })
          updateUploadTask(taskId, {
            status: completed.status === 'active' ? 'complete' : 'processing',
            progress: 100,
          })
        } else if (uploadTransport === 'tus') {
          await uploadTusContent({ session, file, onProgress, signal: abortController.signal })
          progressReporter.dispose()
          const completed = await recoverProxyUploadCompletion({
            channelId,
            uploadSessionId: session.upload_session_id,
            signal: abortController.signal,
          }, [0, ...UPLOAD_QUICK_RECOVERY_RETRY_DELAYS_MS])
          if (!completed) {
            updateUploadTask(taskId, { status: 'processing', progress: 100 })
            scheduleStorageInvalidation()
            return
          }
          updateUploadTask(taskId, {
            status: completed.status === 'active' ? 'complete' : 'processing',
            progress: 100,
          })
        } else {
          let completionStatus: 'active' | 'processing' | null = null
          try {
            const uploadResult = await uploadProxyContent({ session, file, onProgress, signal: abortController.signal })
            progressReporter.dispose()
            if (uploadResult.completed && (uploadResult.status === 'active' || uploadResult.status === 'processing')) {
              completionStatus = uploadResult.status
            } else {
              updateUploadTask(taskId, { status: 'processing', progress: 100 })
              scheduleStorageInvalidation()
              return
            }
          } catch (uploadError) {
            progressReporter.dispose()
            if (isUploadAbortError(uploadError) || abortController.signal.aborted) {
              throw uploadError
            }
            const recovered = await recoverProxyUploadCompletion({
              channelId,
              uploadSessionId: session.upload_session_id,
              signal: abortController.signal,
            }, [0, ...UPLOAD_QUICK_RECOVERY_RETRY_DELAYS_MS])
            if (!recovered) {
              if (isLikelyUploadFinalizeBreak(uploadError, lastProgress)) {
                updateUploadTask(taskId, { status: 'processing', progress: 100 })
                scheduleStorageInvalidation()
                return
              }
              throw uploadError
            }
            completionStatus = recovered.status
          }
          updateUploadTask(taskId, {
            status: completionStatus === 'active' ? 'complete' : 'processing',
            progress: 100,
          })
        }

        scheduleStorageInvalidation()
      } catch (error) {
        scheduleStorageInvalidation()
        if (isUploadAbortError(error) || abortController.signal.aborted) {
          updateUploadTask(taskId, {
            status: 'cancelled',
            error: 'Upload cancelled.',
          })
          return
        }
        if (isStorageUnsupportedUploadError(error)) {
          dismissUploadTask(taskId)
          showUnsupportedUploadAlert([file])
          return
        }
        if (isStorageHardLimitError(error)) {
          openStorageLimitDialog(error, file)
          dismissUploadTask(taskId)
          return
        }
        updateUploadTask(taskId, {
          status: 'failed',
          progress: 100,
          error: getStorageActionErrorMessage(error),
        })
      }
    }, uploadItem.abortController.signal).catch((error) => {
      if (isUploadAbortError(error) || uploadItem.abortController.signal.aborted) {
        updateUploadTask(uploadItem.taskId, {
          status: 'cancelled',
          progress: 0,
          error: 'Upload cancelled.',
        })
        return
      }
      throw error
    })))

    await invalidateStorageNow()
  }, [
    activeChannelId,
    addUploadTasks,
    addUploadsToMemory,
    currentPath,
    dismissUploadTask,
    invalidateStorageNow,
    openStorageLimitDialog,
    scheduleStorageInvalidation,
    showUnsupportedUploadAlert,
    storageWriteDisabledReason,
    memoryUploadState.available,
    updateUploadTask,
  ])

  return (
    <>
      <div className="hg-scrollbar relative h-full overflow-y-auto bg-background">
        <div className="relative mx-auto w-full max-w-[1680px] px-4 py-6 md:px-8 md:py-8 2xl:px-10">
        <StorageToolbar
          search={search}
          viewMode={viewMode}
          usageLabel={usageDisplay.label}
          usageTitle={usageDisplay.title}
          activeTaskCount={activeTaskCount}
          selectionMode={selectionMode}
          onSearchChange={setSearch}
          onViewModeChange={setViewMode}
          onSelectionModeChange={(next) => {
            setSelectionMode(next)
            if (!next) setSelectedIds(new Set())
          }}
          onUpload={() => {
            if (storageWriteDisabledReason) {
              setActionError(storageWriteDisabledReason)
              return
            }
            openFileInput(fileInputRef.current)
          }}
          addToMemory={addUploadsToMemory}
          memoryAvailability={memoryUploadState}
          onAddToMemoryChange={setAddUploadsToMemory}
          onRefresh={() => void refreshStorage()}
          onCreateFolder={() => {
            if (storageWriteDisabledReason) {
              setActionError(storageWriteDisabledReason)
              return
            }
            setCreateFolderOpen(true)
          }}
          onGoUp={() => setCurrentPath(parentPathOf(currentPath))}
          canGoUp={canGoUp}
          readDisabled={readActionsDisabled}
          writeDisabled={writeActionsDisabled}
          refreshing={objectsQuery.isFetching}
        />

        {storageWriteDisabledReason && (
          <div className="border-b border-[#FADDB8] bg-[#FFF7ED] px-3 py-2 text-xs font-medium text-[#9A3412] dark:border-[#7F5F01] dark:bg-[#332E1B] dark:text-[#F5CD47]">
            {storageWriteDisabledReason}
          </div>
        )}

        <StorageAssetShortcutBar
          activeView={assetView}
          readDisabled={readActionsDisabled}
          onViewChange={handleAssetViewChange}
        />

        {selectedItems.length > 0 && (
          <SelectionToolbar
            count={selectedItems.length}
            busy={deleteMutation.isPending || moveMutation.isPending || renameMutation.isPending}
            writeDisabled={writeActionsDisabled}
            onClear={() => {
              setSelectedIds(new Set())
              setSelectionMode(false)
            }}
            onDownload={() => void runStorageAction(() => downloadSelectedItems(selectedItems))}
            onDelete={() => {
              if (storageWriteDisabledReason) {
                setActionError(storageWriteDisabledReason)
                return
              }
              deleteMutation.reset()
              setDeleteDialog({ open: true, items: selectedItems })
            }}
            onRename={() => {
              if (storageWriteDisabledReason) {
                setActionError(storageWriteDisabledReason)
                return
              }
              renameMutation.reset()
              setRenameDialog({ open: true, item: selectedItems[0] ?? null })
            }}
            onMove={() => {
              if (storageWriteDisabledReason) {
                setActionError(storageWriteDisabledReason)
                return
              }
              setMoveDialog({ open: true, items: selectedItems })
            }}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={STORAGE_UPLOAD_ACCEPT}
          disabled={writeActionsDisabled}
          className="hidden"
          onChange={(event) => {
            const files = event.target.files
            if (files) void uploadFiles(files)
            event.currentTarget.value = ''
          }}
        />
        <div className="mt-5 px-1 py-1">
          {assetView === 'default' ? (
            <StorageBreadcrumb path={currentPath} onNavigate={setCurrentPath} />
          ) : (
            <StorageAssetScopeBreadcrumb
              activeView={assetView}
              onDefaultStorage={() => handleAssetViewChange('default')}
            />
          )}
        </div>

        {assetView === 'voice' && (
          <>
            <VoiceProfileShelf
              profiles={voiceProfilesQuery.data?.data ?? []}
              loading={voiceProfilesQuery.isLoading}
              unavailable={voiceProfilesQuery.isError}
              onCreateVoice={() => router.push('/tools?tool=voice-clone')}
              onCreateSpeech={(profile) => {
                const params = new URLSearchParams({
                  tool: 'speech-generate',
                  voice_profile_id: profile.id,
                })
                router.push(`/tools?${params.toString()}`)
              }}
            />
            <VoiceAssetFilterBar
              value={voiceAssetFilter}
              onChange={setVoiceAssetFilter}
            />
          </>
        )}

        <div className="mt-3 min-h-0 flex-1">
          {youtubeFailure ? (
            <YoutubeImportFailureAlert
              message={youtubeFailure.message || tStorage('picker.youtubeFailed')}
              videoId={youtubeFailure.videoId}
              extraCount={youtubeFailure.extraCount}
              extraLabel={tStorage('picker.youtubeFailedMore', { count: youtubeFailure.extraCount })}
              dismissLabel={tStorage('picker.youtubeFailedDismiss')}
              onDismiss={youtubeImport.dismissFailure}
            />
          ) : null}
          {storageReady ? (
            <VisibleStorageDeliveryProvider
              channelId={activeChannelId}
              items={assetView === 'avatar' ? avatarDeliveryItems : visibleItems}
              enabled={viewMode === 'grid'}
            >
              {assetView === 'avatar' ? (
                <StorageAvatarLibrary
                  avatars={libraryAvatars}
                  loading={channelLoading || avatarsQuery.isLoading}
                  error={avatarsQuery.error ? getStorageActionErrorMessage(avatarsQuery.error) : null}
                  emptyTitle={tStorage(getStorageAssetEmptyTitleKey('avatar'))}
                  emptyActionLabel={tStorage('avatarActions.createAvatar')}
                  onCreate={() => router.push('/tools?tool=avatar')}
                  onOpen={(avatar) => router.push(`/brand?section=avatars&avatar=${encodeURIComponent(avatar.id)}`)}
                  onRefresh={() => void avatarsQuery.refetch()}
                />
              ) : (
              <StorageContent
                items={visibleItems}
                youtubeImport={youtubePlaceholder}
                groupMagicClips={assetView === 'clip'}
                deletingIds={deletingIds}
                viewMode={viewMode}
                loading={isBusy && !youtubePlaceholder}
                error={objectsQuery.error ? getStorageActionErrorMessage(objectsQuery.error) : null}
                hasMore={Boolean(objectsQuery.hasNextPage)}
                loadingMore={objectsQuery.isFetchingNextPage}
                onLoadMore={loadMore}
                emptyTitle={tStorage(getStorageAssetEmptyTitleKey(assetView))}
                emptyAction={undefined}
                selectedIds={selectedIds}
                selectionMode={selectionMode}
                allSelected={visibleItems.length > 0 && selectedIds.size === visibleItems.length}
                onToggleSelected={toggleSelected}
                onToggleAllSelected={toggleAllSelected}
                canGoUp={canGoUp}
                writeDisabled={writeActionsDisabled}
                onGoUp={() => setCurrentPath(parentPathOf(currentPath))}
                onCopyUrl={(item) => void runStorageAction(() => copyDeliveryUrl(item))}
                onDownload={(item) => void runStorageAction(() => downloadItem(item))}
                onDelete={(item) => {
                  if (storageWriteDisabledReason) {
                    setActionError(storageWriteDisabledReason)
                    return
                  }
                  deleteMutation.reset()
                  setDeleteDialog({ open: true, items: [item] })
                }}
                onRename={(item) => {
                  if (storageWriteDisabledReason) {
                    setActionError(storageWriteDisabledReason)
                    return
                  }
                  renameMutation.reset()
                  setRenameDialog({ open: true, item })
                }}
                onMove={(item) => {
                  if (storageWriteDisabledReason) {
                    setActionError(storageWriteDisabledReason)
                    return
                  }
                  setMoveDialog({ open: true, items: [item] })
                }}
                onAddToMemory={(item) => {
                  if (memoryIndexingMutation.isPending) return
                  if (getStorageMemoryAction(item) === 'add_anyway') {
                    setMemoryOverrideItem(item)
                    return
                  }
                  memoryIndexingMutation.mutate(item)
                }}
                onUseVoiceAsset={assetView === 'voice' ? useVoiceAsset : undefined}
                onOpenItem={(item) => void runStorageAction(() => openItem(item))}
                onRefresh={() => void refreshStorage()}
              />
              )}
            </VisibleStorageDeliveryProvider>
          ) : channelLoading ? (
            <StorageSkeleton viewMode={viewMode} />
          ) : (
            <NoChannelState />
          )}

          <UploadProgressToastContainer
            principalId={browserPrincipalScope}
            channelId={activeChannelId}
            memorySummary={memoryUploadSummary}
          />
          {actionError && <StorageActionToast message={actionError} onDismiss={() => setActionError(null)} />}
        </div>
        </div>
      </div>

      <CreateFolderDialog
        open={createFolderOpen}
        busy={createFolderMutation.isPending}
        error={createFolderMutation.error ? getStorageActionErrorMessage(createFolderMutation.error) : null}
        onOpenChange={(open) => {
          if (open && storageWriteDisabledReason) {
            setActionError(storageWriteDisabledReason)
            return
          }
          setCreateFolderOpen(open)
        }}
        onSubmit={(name) => {
          if (!activeChannelId) return
          if (storageWriteDisabledReason) {
            setActionError(storageWriteDisabledReason)
            return
          }
          createFolderMutation.mutate(name)
        }}
      />
      {storageAlert && (
        <AppAlertDialog
          open={Boolean(storageAlert)}
          title={storageAlert.title}
          description={storageAlert.description}
          confirmLabel={storageAlert.confirmLabel ?? tAuto('ok_9ce3bd42')}
          showCancel={false}
          tone={storageAlert.tone ?? 'default'}
          onOpenChange={(open) => {
            if (!open) setStorageAlert(null)
          }}
          onConfirm={() => setStorageAlert(null)}
        />
      )}
      {storageLimitDialog && (
        <AppAlertDialog
          open={Boolean(storageLimitDialog)}
          title={tAuto('file_upload_limit_reached_9344901f')}
          description={tAuto('this_file_is_larger_than_your_current_plan_allow_c0fc7d84')}
          confirmLabel="Upgrade plan"
          cancelLabel="Not now"
          showCancel
          showClose
          tone="warning"
          onOpenChange={(open) => {
            if (!open) closeStorageLimitDialog()
          }}
          onCancel={closeStorageLimitDialog}
          onConfirm={() => {
            closeStorageLimitDialog()
            router.push(STORAGE_LIMIT_UPGRADE_HREF)
          }}
        >
          <StorageLimitDialogDetails limit={storageLimitDialog} />
        </AppAlertDialog>
      )}
      {memoryOverrideItem && (
        <AppAlertDialog
          open={Boolean(memoryOverrideItem)}
          title={tStorage('memoryActions.addAnywayTitle')}
          description={tStorage('memoryActions.addAnywayDescription', {
            name: memoryOverrideItem.name,
            reason: tStorage(`memoryActions.refusal.${storageMemoryRefusalKey(memoryOverrideItem)}`),
          })}
          confirmLabel={tStorage('memoryActions.addAnywayConfirm')}
          cancelLabel={tStorage('memoryActions.cancel')}
          showCancel
          tone="warning"
          busy={memoryIndexingMutation.isPending}
          onOpenChange={(open) => {
            if (!open) setMemoryOverrideItem(null)
          }}
          onCancel={() => setMemoryOverrideItem(null)}
          onConfirm={() => {
            const item = memoryOverrideItem
            setMemoryOverrideItem(null)
            if (item && !memoryIndexingMutation.isPending) memoryIndexingMutation.mutate(item)
          }}
        />
      )}
      <ConfirmDeleteDialog
        open={deleteDialog.open}
        items={deleteDialog.items}
        busy={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (deleteMutation.isPending) return
          if (!open) deleteMutation.reset()
          setDeleteDialog((current) => ({ open, items: open ? current.items : [] }))
        }}
        onConfirm={() => {
          if (deleteDialog.items.length === 0 || deleteMutation.isPending) return
          if (storageWriteDisabledReason) {
            setActionError(storageWriteDisabledReason)
            return
          }
          const itemsToDelete = deleteDialog.items
          setDeleteDialog({ open: false, items: [] })
          deleteMutation.mutate(itemsToDelete)
        }}
      />
      <MoveItemsDialog
        open={moveDialog.open}
        channelId={activeChannelId}
        busy={moveMutation.isPending}
        error={moveMutation.error ? getStorageActionErrorMessage(moveMutation.error) : null}
        items={moveDialog.items}
        onOpenChange={(open) => setMoveDialog((current) => ({ ...current, open }))}
        onSubmit={(parentPath) => {
          if (storageWriteDisabledReason) {
            setActionError(storageWriteDisabledReason)
            return
          }
          moveMutation.mutate({
            items: moveDialog.items,
            parentPath,
          })
        }}
      />
      <RenameItemDialog
        open={renameDialog.open}
        item={renameDialog.item}
        busy={renameMutation.isPending}
        error={renameMutation.error ? getStorageActionErrorMessage(renameMutation.error) : null}
        onOpenChange={(open) => {
          if (!open) renameMutation.reset()
          setRenameDialog((current) => ({ open, item: open ? current.item : null }))
        }}
        onSubmit={(name) => {
          if (!renameDialog.item) return
          if (storageWriteDisabledReason) {
            setActionError(storageWriteDisabledReason)
            return
          }
          renameMutation.mutate({ item: renameDialog.item, name })
        }}
      />
      <StoragePreviewDialog
        preview={previewDialog}
        channelId={activeChannelId}
        onOpenChange={closePreviewDialog}
        onDownload={(item) => void runStorageAction(() => downloadItem(item))}
        onShare={(item) => void runStorageAction(() => copyDeliveryUrl(item))}
        onRetry={(item) => void runStorageAction(() => retryPreviewItem(item))}
        onUseVoiceAsset={assetView === 'voice' ? useVoiceAsset : undefined}
      />
    </>
  )
}

type StorageAssetViewModel = {
  id: StorageAssetView
  labelKey: string
  descriptionKey: string
  icon: React.ComponentType<{ className?: string }>
}

const STORAGE_ASSET_VIEW_MODELS: StorageAssetViewModel[] = [
  { id: 'default', labelKey: 'assets.all', descriptionKey: 'assets.allDescription', icon: Folder },
  { id: 'avatar', labelKey: 'assets.avatar', descriptionKey: 'assets.avatarDescription', icon: UserRound },
  { id: 'voice', labelKey: 'assets.voice', descriptionKey: 'assets.voiceDescription', icon: Mic },
  { id: 'image', labelKey: 'assets.images', descriptionKey: 'assets.imagesDescription', icon: ImageIcon },
  { id: 'video', labelKey: 'assets.videos', descriptionKey: 'assets.videosDescription', icon: Play },
  { id: 'clip', labelKey: 'assets.clips', descriptionKey: 'assets.clipsDescription', icon: Scissors },
  { id: 'document', labelKey: 'assets.documents', descriptionKey: 'assets.documentsDescription', icon: FileIcon },
]

function StorageAssetShortcutBar({
  activeView,
  readDisabled,
  onViewChange,
}: {
  activeView: StorageAssetView
  readDisabled: boolean
  onViewChange: (view: StorageAssetView) => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  return (
    <div className="hg-scrollbar mt-4 overflow-x-auto pb-1">
      <div className="flex gap-2">
        {STORAGE_ASSET_VIEW_MODELS.map((item) => {
          const active = item.id === activeView
          return (
            <button
              key={item.id}
              type="button"
              disabled={readDisabled}
              aria-pressed={active}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                active
                  ? 'border-primary/60 bg-primary/10 text-foreground'
                  : 'border-border bg-panel/50 text-muted-foreground hover:text-foreground',
              )}
            >
              {tStorage(item.labelKey)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StorageAssetScopeBreadcrumb({
  activeView,
  onDefaultStorage,
}: {
  activeView: Exclude<StorageAssetView, 'default'>
  onDefaultStorage: () => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const model = getStorageAssetViewModel(activeView)
  const Icon = model.icon

  return (
    <div className="flex min-h-8 items-center gap-1 overflow-x-auto text-sm">
      <button
        type="button"
        onClick={onDefaultStorage}
        className="rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <UiText id="all_6a720856" /></button>
      <span className="text-muted-foreground">/</span>
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-medium text-foreground">
        <Icon className="h-3.5 w-3.5" />
        {tStorage(model.labelKey)}
      </span>
    </div>
  )
}

function VoiceAssetFilterBar({
  value,
  onChange,
}: {
  value: VoiceAssetFilter
  onChange: (value: VoiceAssetFilter) => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const options: Array<{ id: VoiceAssetFilter; label: string }> = [
    { id: 'all', label: tStorage('voiceFilters.all') },
    { id: 'generated', label: tStorage('voiceFilters.generated') },
    { id: 'reference', label: tStorage('voiceFilters.reference') },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border bg-muted/20 px-3 py-2">
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={value === option.id ? 'secondary' : 'ghost'}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className="shrink-0"
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function VoiceProfileShelf({
  profiles,
  loading,
  unavailable,
  onCreateVoice,
  onCreateSpeech,
}: {
  profiles: VoiceProfile[]
  loading: boolean
  unavailable: boolean
  onCreateVoice: () => void
  onCreateSpeech: (profile: VoiceProfile) => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const tAuto = useTranslations('Auto')
  return (
    <section className="border-b border-border bg-background px-3 py-3" aria-labelledby="voice-profiles-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 id="voice-profiles-title" className="text-sm font-semibold text-foreground"><UiText id="voice_profiles_e8735d7d" /></h2>
          <p className="text-xs text-muted-foreground"><UiText id="tenant_isolated_voices_available_to_compatible_s_ee525b90" /></p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onCreateVoice}>
          <Mic className="size-4" />
          <UiText id="new_voice_3b397609" /></Button>
      </div>
      {loading ? (
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 w-52 shrink-0 rounded-md" />)}
        </div>
      ) : profiles.length === 0 || unavailable ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          {tStorage('voiceProfiles.notFound')}
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {profiles.map((profile) => (
            <div key={profile.id} className="flex min-w-52 items-center gap-3 rounded-md border border-border bg-card p-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <Mic className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{profile.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile.default_language ?? tAuto('multilingual_aaa850f7')} · {formatSchemaLikeLabel(profile.origin)}
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title={`Create speech with ${profile.display_name}`}
                aria-label={`Create speech with ${profile.display_name}`}
                onClick={() => onCreateSpeech(profile)}
              >
                <Sparkles className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function StorageToolbar({
  search,
  viewMode,
  selectionMode,
  usageLabel,
  usageTitle,
  activeTaskCount,
  refreshing,
  canGoUp,
  readDisabled,
  writeDisabled,
  onSearchChange,
  onViewModeChange,
  onSelectionModeChange,
  onUpload,
  onRefresh,
  onCreateFolder,
  onGoUp,
  addToMemory,
  memoryAvailability,
  onAddToMemoryChange,
}: {
  search: string
  viewMode: ViewMode
  selectionMode: boolean
  usageLabel: string
  usageTitle: string
  activeTaskCount: number
  refreshing: boolean
  canGoUp: boolean
  readDisabled: boolean
  writeDisabled: boolean
  onSearchChange: (value: string) => void
  onViewModeChange: (value: ViewMode) => void
  onSelectionModeChange: (value: boolean) => void
  onUpload: () => void
  onRefresh: () => void
  onCreateFolder: () => void
  onGoUp: () => void
  addToMemory: boolean
  memoryAvailability: MemoryUploadAvailability
  onAddToMemoryChange: (checked: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ToolbarButton primary onClick={onUpload} icon={Upload} disabled={writeDisabled}>
          <UiText id="upload_8bdf057f" /></ToolbarButton>
        <MemoryIngestionCheckbox
          checked={addToMemory}
          availability={memoryAvailability}
          disabled={writeDisabled}
          onCheckedChange={onAddToMemoryChange}
          className="h-10 rounded-xl bg-panel/75 px-3.5 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]"
        />
        <ToolbarButton onClick={onRefresh} icon={RefreshCw} disabled={readDisabled || refreshing}>
          <UiText id="refresh_56e3badc" /></ToolbarButton>
        <ToolbarButton onClick={onCreateFolder} icon={FolderPlus} disabled={writeDisabled}>
          <UiText id="create_folder_97bafaba" /></ToolbarButton>
        <ToolbarButton onClick={onGoUp} icon={ArrowUp} disabled={readDisabled || !canGoUp}>
          <UiText id="folder_up_522cd05a" /></ToolbarButton>

        <div
          className="flex h-10 items-center gap-2 rounded-xl bg-panel/75 px-3.5 text-sm text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]"
          title={usageTitle}
        >
          <HardDrive className="size-4 text-primary" />
          <span>{usageLabel}</span>
        </div>
        {activeTaskCount > 0 && (
          <div className="flex h-9 items-center gap-2 rounded-md border border-[#C9E7D7] bg-[#F1FBF5] px-3 text-xs font-medium text-[#216E42] dark:border-[#216E4E] dark:bg-[#1C3329] dark:text-[#4BCE97]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{activeTaskCount} active</span>
          </div>
        )}
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 2xl:ml-auto 2xl:w-auto 2xl:flex-nowrap">
        <div className="relative min-w-[min(100%,14rem)] flex-1 2xl:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={tAuto('search_files_ec88257e')}
            disabled={readDisabled}
            className="h-10 rounded-xl border-transparent bg-panel/75 pl-9 shadow-none focus:border-primary/50 focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <Button
          type="button"
          variant={selectionMode ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={selectionMode}
          disabled={readDisabled}
          onClick={() => onSelectionModeChange(!selectionMode)}
          className="h-10 gap-2 rounded-xl border-transparent bg-panel/75 px-3.5 text-sm font-medium shadow-none"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="hidden sm:inline"><UiText id="select_85982229" /></span>
        </Button>

        <div className="flex h-10 rounded-xl bg-panel/75 p-0.5 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]">
          <Button
            type="button"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon-sm"
            title={tAuto('list_view_694bbd75')}
            aria-label={tAuto('list_view_694bbd75')}
            aria-pressed={viewMode === 'list'}
            onClick={() => onViewModeChange('list')}
            className="h-8 w-8"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon-sm"
            title={tAuto('grid_view_d44ec861')}
            aria-label={tAuto('grid_view_d44ec861')}
            aria-pressed={viewMode === 'grid'}
            onClick={() => onViewModeChange('grid')}
            className="h-8 w-8"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function SelectionToolbar({
  count,
  busy,
  writeDisabled,
  onClear,
  onDownload,
  onDelete,
  onRename,
  onMove,
}: {
  count: number
  busy: boolean
  writeDisabled: boolean
  onClear: () => void
  onDownload: () => void
  onDelete: () => void
  onRename: () => void
  onMove: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-accent/50 px-3 py-2 dark:bg-accent/40">
      <span className="text-sm font-medium text-foreground">{count} selected</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onRename} disabled={busy || writeDisabled || count !== 1}>
          <Pencil className="h-4 w-4" />
          <UiText id="rename_d3f4cb89" /></Button>
        <Button type="button" variant="outline" size="sm" onClick={onMove} disabled={busy || writeDisabled}>
          <Folder className="h-4 w-4" />
          <UiText id="move_76cdb950" /></Button>
        <Button type="button" variant="outline" size="sm" onClick={onDownload} disabled={busy}>
          <Download className="h-4 w-4" />
          <UiText id="download_a479c9c3" /></Button>
        <Button type="button" variant="outline" size="sm" onClick={onDelete} disabled={busy || writeDisabled}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={busy}>
          <UiText id="clear_719ea396" /></Button>
      </div>
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  children,
  primary = false,
  ...props
}: React.ComponentProps<typeof Button> & {
  icon: React.ComponentType<{ className?: string }>
  primary?: boolean
}) {
  const label = typeof children === 'string' ? children : undefined
  return (
    <Button
      type="button"
      variant={primary ? 'default' : 'outline'}
      size="sm"
      aria-label={props['aria-label'] ?? label}
      className={cn(
        'h-10 gap-2 rounded-xl px-3.5 text-sm shadow-none',
        primary ? 'font-semibold' : 'border-transparent bg-panel/75 font-medium hover:bg-accent',
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{children}</span>
    </Button>
  )
}

function StorageBreadcrumb({
  path,
  onNavigate,
}: {
  path: string
  onNavigate: (path: string) => void
}) {
  const segments = path ? path.split('/') : []

  return (
    <div className="flex min-h-8 items-center gap-1 overflow-x-auto text-sm">
      <button
        type="button"
        onClick={() => onNavigate('')}
        className={cn(
          'rounded-md px-2 py-1 font-medium text-foreground hover:bg-muted',
          !path && 'bg-muted',
        )}
      >
        <UiText id="all_assets_9d75961e" /></button>
      {segments.map((segment, index) => {
        const nextPath = segments.slice(0, index + 1).join('/')
        return (
          <React.Fragment key={nextPath}>
            <span className="text-muted-foreground">/</span>
            <button
              type="button"
              onClick={() => onNavigate(nextPath)}
              className="max-w-[180px] truncate rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {segment}
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}

function StorageContent({
  items,
  youtubeImport,
  groupMagicClips,
  deletingIds,
  viewMode,
  loading,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyTitle,
  emptyAction,
  selectedIds,
  selectionMode,
  allSelected,
  onToggleSelected,
  onToggleAllSelected,
  canGoUp,
  writeDisabled,
  onGoUp,
  onCopyUrl,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onAddToMemory,
  onUseVoiceAsset,
  onOpenItem,
  onRefresh,
}: {
  items: StorageObjectItem[]
  youtubeImport: YoutubeImportPlaceholderState | null
  groupMagicClips: boolean
  deletingIds: Set<string>
  viewMode: ViewMode
  loading: boolean
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  emptyTitle: string
  emptyAction?: { label: string; onClick: () => void }
  selectedIds: Set<string>
  selectionMode: boolean
  allSelected: boolean
  onToggleSelected: (itemId: string, checked: boolean) => void
  onToggleAllSelected: (checked: boolean) => void
  canGoUp: boolean
  writeDisabled: boolean
  onGoUp: () => void
  onCopyUrl: (item: StorageObjectItem) => void
  onDownload: (item: StorageObjectItem) => void
  onDelete: (item: StorageObjectItem) => void
  onRename: (item: StorageObjectItem) => void
  onMove: (item: StorageObjectItem) => void
  onAddToMemory: (item: StorageObjectItem) => void
  onUseVoiceAsset?: (item: StorageObjectItem) => void
  onOpenItem: (item: StorageObjectItem) => void
  onRefresh: () => void
}) {
  if (loading) return <StorageSkeleton viewMode={viewMode} />

  if (error) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl bg-panel/45 px-6 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]">
        <XCircle className="h-9 w-9 text-destructive" />
        <p className="mt-3 text-sm font-medium text-foreground"><UiText id="storage_yuklenemedi_069cda55" /></p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          <UiText id="refresh_56e3badc" /></Button>
      </div>
    )
  }

  if (items.length === 0 && !canGoUp && !youtubeImport) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl bg-panel/45 px-6 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]">
        <Folder className="h-10 w-10 fill-primary text-primary" />
        <p className="mt-3 text-sm font-medium text-foreground">{emptyTitle}</p>
        {emptyAction ? (
          <Button type="button" size="sm" className="mt-4" onClick={emptyAction.onClick}>
            <UserRound className="h-4 w-4" />
            {emptyAction.label}
          </Button>
        ) : null}
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <StorageLoadMoreFrame hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore}>
        <StorageList
          items={items}
          youtubeImport={youtubeImport}
          groupMagicClips={groupMagicClips}
          deletingIds={deletingIds}
          selectedIds={selectedIds}
          selectionMode={selectionMode}
          allSelected={allSelected}
          onToggleSelected={onToggleSelected}
          onToggleAllSelected={onToggleAllSelected}
          canGoUp={canGoUp}
          writeDisabled={writeDisabled}
          onGoUp={onGoUp}
          onCopyUrl={onCopyUrl}
          onDownload={onDownload}
          onDelete={onDelete}
          onRename={onRename}
          onMove={onMove}
          onAddToMemory={onAddToMemory}
          onUseVoiceAsset={onUseVoiceAsset}
          onOpenItem={onOpenItem}
        />
      </StorageLoadMoreFrame>
    )
  }

  return (
    <StorageLoadMoreFrame hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore}>
      <StorageGrid
        items={items}
        youtubeImport={youtubeImport}
        groupMagicClips={groupMagicClips}
        deletingIds={deletingIds}
        selectedIds={selectedIds}
        selectionMode={selectionMode}
        onToggleSelected={onToggleSelected}
        canGoUp={canGoUp}
        writeDisabled={writeDisabled}
        onGoUp={onGoUp}
        onCopyUrl={onCopyUrl}
        onDownload={onDownload}
        onDelete={onDelete}
        onRename={onRename}
        onMove={onMove}
        onAddToMemory={onAddToMemory}
        onUseVoiceAsset={onUseVoiceAsset}
        onOpenItem={onOpenItem}
      />
    </StorageLoadMoreFrame>
  )
}

function StorageLoadMoreFrame({
  children,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  children: React.ReactNode
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!hasMore || loadingMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const root = getOverflowParent(sentinel)
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
    }, { root, rootMargin: '480px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, onLoadMore])

  return (
    <div className="space-y-4">
      {children}
      {hasMore && (
        <div className="flex flex-col items-center gap-3">
          <div ref={sentinelRef} aria-hidden="true" className="h-1 w-full" />
          <Button type="button" variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            <UiText id="load_more_dfe60ca9" /></Button>
        </div>
      )}
    </div>
  )
}

function getOverflowParent(node: HTMLElement | null): Element | null {
  let current = node?.parentElement ?? null
  while (current) {
    const style = window.getComputedStyle(current)
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll')
      && current.scrollHeight > current.clientHeight + 8
    ) {
      return current
    }
    current = current.parentElement
  }
  return null
}

function StorageAvatarLibrary({
  avatars,
  loading,
  error,
  emptyTitle,
  emptyActionLabel,
  onCreate,
  onOpen,
  onRefresh,
}: {
  avatars: Avatar[]
  loading: boolean
  error: string | null
  emptyTitle: string
  emptyActionLabel: string
  onCreate: () => void
  onOpen: (avatar: Avatar) => void
  onRefresh: () => void
}) {
  if (loading) return <StorageSkeleton viewMode="grid" />

  if (error) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl bg-panel/45 px-6 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]">
        <XCircle className="h-9 w-9 text-destructive" />
        <p className="mt-3 text-sm font-medium text-foreground"><UiText id="storage_yuklenemedi_069cda55" /></p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          <UiText id="refresh_56e3badc" /></Button>
      </div>
    )
  }

  if (avatars.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl bg-panel/45 px-6 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]">
        <UserRound className="h-10 w-10 text-primary" />
        <p className="mt-3 text-sm font-medium text-foreground">{emptyTitle}</p>
        <Button type="button" size="sm" className="mt-4" onClick={onCreate}>
          <UserRound className="h-4 w-4" />
          {emptyActionLabel}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {avatars.map((avatar) => (
        <StorageAvatarCard key={avatar.id} avatar={avatar} onOpen={() => onOpen(avatar)} />
      ))}
    </div>
  )
}

function StorageAvatarCard({
  avatar,
  onOpen,
}: {
  avatar: Avatar
  onOpen: () => void
}) {
  const delivery = useVisibleStorageDeliveryItem(avatarStorageCover(avatar)?.objectId ?? '')
  const src = delivery?.item?.status === 'ok' ? delivery.item.url : null
  const waiting = Boolean(!src && (delivery?.isPending || delivery?.item?.status === 'error'))

  return (
    <div className="youtorch-storage-card-containment group min-w-0 text-left transition-transform duration-200 hover:-translate-y-0.5 hover:z-10">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-panel shadow-[inset_0_1px_0_rgb(255_255_255_/_0.07)] transition duration-200 group-hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.1),0_18px_32px_rgb(0_0_0_/_0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : waiting ? (
          <StorageThumbnailLoadingIndicator />
        ) : (
          <UserRound className="h-10 w-10 text-muted-foreground" />
        )}
        {avatar.status === 'provisioning' ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </span>
        ) : null}
      </button>
      <div className="space-y-1 px-1 pt-3">
        <p className="truncate text-sm font-semibold text-foreground">{avatar.display_name}</p>
      </div>
    </div>
  )
}

/**
 * Photo+voice capture sources are private (internal) Storage objects, so the card cover is the
 * primary shot preview; only legacy avatars fall back to their visible source object.
 */
function avatarStorageCover(avatar: Avatar): { objectId: string; kind: 'image' | 'video' } | null {
  const previewId = avatar.preview_storage_object_id?.trim()
  if (previewId) return { objectId: previewId, kind: 'image' }
  if (avatar.metadata?.capture_mode === 'photo_voice') return null
  const sourceId = avatar.source_storage_object_id?.trim()
  if (!sourceId) return null
  return { objectId: sourceId, kind: avatar.origin === 'human_clone' ? 'video' : 'image' }
}

function avatarsToDeliveryItems(avatars: Avatar[]): Array<Pick<StorageObjectItem, 'id' | 'type' | 'status' | 'mime_type' | 'extension' | 'name' | 'size_bytes' | 'updated_at'>> {
  return avatars.flatMap((avatar) => {
    const cover = avatarStorageCover(avatar)
    if (!cover) return []
    const video = cover.kind === 'video'
    return [{
      id: cover.objectId,
      type: 'file' as const,
      status: 'active' as const,
      mime_type: video ? 'video/mp4' : 'image/jpeg',
      extension: video ? 'mp4' : 'jpg',
      name: avatar.display_name,
      size_bytes: video ? '8000000' : '1',
      updated_at: avatar.updated_at,
    }]
  })
}

function StorageGrid({
  items,
  youtubeImport,
  groupMagicClips,
  deletingIds,
  selectedIds,
  selectionMode,
  onToggleSelected,
  canGoUp,
  writeDisabled,
  onGoUp,
  onCopyUrl,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onAddToMemory,
  onUseVoiceAsset,
  onOpenItem,
}: {
  items: StorageObjectItem[]
  youtubeImport: YoutubeImportPlaceholderState | null
  groupMagicClips: boolean
  deletingIds: Set<string>
  selectedIds: Set<string>
  selectionMode: boolean
  onToggleSelected: (itemId: string, checked: boolean) => void
  canGoUp: boolean
  writeDisabled: boolean
  onGoUp: () => void
  onCopyUrl: (item: StorageObjectItem) => void
  onDownload: (item: StorageObjectItem) => void
  onDelete: (item: StorageObjectItem) => void
  onRename: (item: StorageObjectItem) => void
  onMove: (item: StorageObjectItem) => void
  onAddToMemory: (item: StorageObjectItem) => void
  onUseVoiceAsset?: (item: StorageObjectItem) => void
  onOpenItem: (item: StorageObjectItem) => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const format = useFormatter()
  const groups = groupMagicClips
    ? groupMagicClipItems(items)
    : [{ key: 'all', kind: 'fallback' as const, runId: null, items }]

  return (
    <div className={cn(groupMagicClips && 'space-y-6')}>
      {groups.map((group, groupIndex) => (
        <section key={group.key}>
          {groupMagicClips ? (
            <StorageClipGroupHeading group={group} className="mb-3" />
          ) : null}
          <div className={cn(
            'grid gap-x-5 gap-y-7',
            groupMagicClips
              ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
          )}>
      {canGoUp && groupIndex === 0 && <StorageParentFolderGridItem onOpen={onGoUp} />}
      {groupIndex === 0 && youtubeImport ? youtubeImport.labels.map((label, index) => (
        <YoutubeImportPlaceholderCard
          key={`youtube-pending-${label}-${index}`}
          label={label}
          statusLabel={youtubeImport.statusLabel}
          failed={youtubeImport.failed}
          detail={youtubeImport.detail}
          thumbnailUrl={youtubeImport.thumbnailUrl}
        />
      )) : null}
      {group.items.map((item) => {
        const isDeleting = deletingIds.has(item.id)
        const badge = getStorageItemBadge(item, isDeleting, tStorage)
        const memoryBadge = getStorageMemoryBadge(item, tStorage)
        const processing = isStorageItemProcessing(item)
        const isSelected = selectedIds.has(item.id)
        const gifItem = isStorageGifItem(item)
        const isFolder = item.type === 'folder'
        const boxedMedia = !isFolder && (
          groupMagicClips
          || isStorageVisualMediaItem(item)
        )
        const isAudio = isStorageAudioItem(item)
        return (
        <div
          key={item.id}
          className={cn(
            'youtorch-storage-card-containment group min-w-0 text-left transition-transform duration-200 hover:-translate-y-0.5 hover:z-10',
            isDeleting && 'pointer-events-none opacity-45 saturate-50',
          )}
        >
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => {
              if (selectionMode) onToggleSelected(item.id, !isSelected)
              else onOpenItem(item)
            }}
            className={cn(
              'relative flex w-full items-center justify-center overflow-hidden transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              groupMagicClips
                ? 'aspect-[9/16] w-full rounded-2xl bg-muted/20 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] group-hover:bg-muted/30 group-hover:shadow-[0_10px_22px_rgb(0_0_0_/_0.08)]'
                : 'bg-gradient-to-br from-accent to-panel shadow-[inset_0_1px_0_rgb(255_255_255_/_0.07)] group-hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.1),0_18px_32px_rgb(0_0_0_/_0.16)]',
              groupMagicClips
                ? null
                : isFolder
                  ? 'aspect-[4/3] rounded-2xl'
                  : boxedMedia || isAudio
                    ? 'aspect-video rounded-2xl'
                    : 'aspect-[4/3] rounded-2xl',
            )}
          >
            {isFolder ? (
              <StorageFolderGlyph className={STORAGE_FOLDER_TILE_GLYPH_CLASS} />
            ) : boxedMedia ? (
              <StorageThumbnailPreview item={item} />
            ) : isAudio ? (
              <StorageAudioFilePreview />
            ) : (
              <StorageDocumentFilePreview item={item} />
            )}
            {processing && boxedMedia ? <StorageProcessingGlassLayer /> : null}
            {badge && <StorageStatusBadge badge={badge} className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)]" />}
            {gifItem && boxedMedia ? (
              <span className="absolute bottom-2 right-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                GIF
              </span>
            ) : null}
          </button>
          <div className="space-y-2 px-1 pt-3">
            <div className="flex items-start gap-2">
              {selectionMode && (
                <Checkbox
                  checked={isSelected}
                  aria-label={`Select ${item.name}`}
                  disabled={isDeleting}
                  onCheckedChange={(checked) => onToggleSelected(item.id, checked === true)}
                  className={cn('mt-0.5', STORAGE_SELECT_CHECKBOX_CLASS)}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'truncate text-sm font-semibold',
                  isFolder ? 'text-primary' : 'text-foreground',
                )}>
                  {item.name}
                </p>
                <div className="mt-1 flex items-center justify-start text-xs text-muted-foreground">
                  <span className="truncate">{formatDateTime(item.created_at, format)}</span>
                </div>
                {memoryBadge && (
                  <div className="mt-2">
                    <StorageStatusBadge badge={memoryBadge} className="h-5 max-w-full px-1.5 text-[10px]" />
                  </div>
                )}
              </div>
              <StorageItemActions
                item={item}
                disabled={isDeleting}
                writeDisabled={writeDisabled || isDeleting}
                onCopyUrl={onCopyUrl}
                onDownload={onDownload}
                onDelete={onDelete}
                onRename={onRename}
                onMove={onMove}
                onAddToMemory={onAddToMemory}
                onUseVoiceAsset={onUseVoiceAsset}
              />
            </div>
          </div>
        </div>
        )
      })}
          </div>
        </section>
      ))}
    </div>
  )
}

function StorageThumbnailPreview({ item }: { item: StorageObjectItem }) {
  const candidate = isStorageThumbnailCandidate(item)
  const delivery = useVisibleStorageDeliveryItem(item.id)
  const deliveryItem = delivery?.item ?? null
  const src = deliveryItem?.status === 'ok' ? deliveryItem.url : null
  const [loadedUrl, setLoadedUrl] = React.useState<string | null>(null)
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  const queryFetching = Boolean(!src && delivery?.isPending)
  const queryFailed = Boolean(!src && !queryFetching && deliveryItem?.status !== 'ok')
  const fallbackGraceKey = `${item.id}:${item.status}:${item.updated_at}:${src ?? 'pending'}:${failedUrl ?? 'pending'}`
  const fallbackAllowed = useStorageThumbnailFallbackGrace(fallbackGraceKey, candidate)
  const isVideo = item.mime_type?.trim().toLowerCase().startsWith('video/') === true
  const presentation = getStorageThumbnailPresentation({
    candidate,
    queryFetching,
    queryFailed,
    fallbackAllowed,
    src,
    loadedUrl,
    failedUrl,
  })

  if (presentation === 'fallback') {
    return <FilePreviewIcon item={item} className="h-10 w-10 text-muted-foreground" />
  }

  return (
    <>
      {presentation === 'loading' && <StorageThumbnailLoadingIndicator />}
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={src}
          src={src}
          alt=""
          loading="eager"
          decoding="async"
          onLoad={() => {
            setLoadedUrl(src)
          }}
          onError={() => {
            setFailedUrl(src)
            delivery?.retryPreview(src)
          }}
          className={cn(
            'h-full w-full object-contain transition-opacity duration-200 motion-reduce:transition-none',
            presentation === 'ready' ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      {isVideo && presentation === 'ready' && !isStorageAvatarAsset(item) && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </span>
        </span>
      )}
    </>
  )
}

type StorageThumbnailPresentation = 'loading' | 'ready' | 'fallback'

const STORAGE_THUMBNAIL_FALLBACK_GRACE_MS = 30_000

function useStorageThumbnailFallbackGrace(key: string, enabled: boolean) {
  const [expiredKey, setExpiredKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    const timeoutId = window.setTimeout(() => {
      setExpiredKey(key)
    }, STORAGE_THUMBNAIL_FALLBACK_GRACE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [enabled, key])

  return enabled && expiredKey === key
}

function StorageThumbnailLoadingIndicator() {
  const tAuto = useTranslations('Auto')
  return (
    <span
      role="status"
      aria-label={tAuto('loading_preview_52816ebc')}
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden"
    >
      <Skeleton
        aria-hidden="true"
        className="absolute inset-0 h-full w-full rounded-none motion-reduce:before:animate-none"
      />
      <span className="relative z-20 flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/55 shadow-lg backdrop-blur-md">
        <span aria-hidden="true" className="size-6 animate-spin rounded-full border-[3px] border-white/25 border-t-white motion-reduce:animate-none" />
      </span>
    </span>
  )
}

function getStorageThumbnailPresentation(input: {
  candidate: boolean
  queryFetching: boolean
  queryFailed: boolean
  fallbackAllowed: boolean
  src: string | null
  loadedUrl: string | null
  failedUrl: string | null
}): StorageThumbnailPresentation {
  if (!input.candidate) return 'fallback'
  if (!input.src) {
    return input.queryFailed && !input.queryFetching && input.fallbackAllowed ? 'fallback' : 'loading'
  }
  if (input.failedUrl === input.src) {
    return !input.queryFetching && input.fallbackAllowed ? 'fallback' : 'loading'
  }
  return input.loadedUrl === input.src ? 'ready' : 'loading'
}

const STORAGE_FOLDER_TILE_GLYPH_CLASS = 'h-[5.75rem] w-[6.75rem] sm:h-[6.25rem] sm:w-[7.25rem]'

function StorageFolderGlyph({
  muted = false,
  className,
}: {
  muted?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative block',
        muted ? 'text-muted-foreground/80' : 'text-primary',
        className,
      )}
    >
      <svg viewBox="0 0 96 80" aria-hidden="true" className="block h-full w-full">
        <path
          d="M10 20c0-3.6 2.9-6.5 6.5-6.5h16c2 0 3.9 1 5.1 2.6L41.4 20H79.5c3.6 0 6.5 2.9 6.5 6.5v37c0 3.6-2.9 6.5-6.5 6.5H16.5C12.9 70 10 67.1 10 63.5V20Z"
          className="fill-current"
        />
      </svg>
    </span>
  )
}

function StorageAudioFilePreview() {
  return <AudioLines className="size-10 text-muted-foreground" strokeWidth={1.75} />
}

function StorageDocumentFilePreview({ item }: { item: StorageObjectItem }) {
  return (
    <span className="relative h-[5.75rem] w-[4.4rem] rotate-[-4deg] drop-shadow-[0_12px_18px_rgb(0_0_0_/_0.28)]">
      <StorageDocumentSheet extension={getStorageItemExtension(item).toUpperCase()} className="h-full w-full" />
    </span>
  )
}

function StorageDocumentSheet({
  extension,
  className,
}: {
  extension?: string
  className?: string
}) {
  return (
    <span className={cn('relative block h-full w-full overflow-hidden bg-white', className)}>
      <span aria-hidden="true" className="absolute inset-x-[14%] top-[28%] flex flex-col gap-[12%]">
        <span className="block h-[6%] w-full rounded-full bg-zinc-200" />
        <span className="block h-[6%] w-[86%] rounded-full bg-zinc-200" />
        <span className="block h-[6%] w-[68%] rounded-full bg-zinc-200" />
      </span>
      {extension ? (
        <span className="absolute left-1 top-1 rounded-[2px] bg-zinc-800 px-1 py-px text-[7px] font-bold leading-none tracking-wide text-white">
          {extension.slice(0, 4)}
        </span>
      ) : null}
    </span>
  )
}

function StorageList({
  items,
  youtubeImport,
  groupMagicClips,
  deletingIds,
  selectedIds,
  selectionMode,
  allSelected,
  onToggleSelected,
  onToggleAllSelected,
  canGoUp,
  writeDisabled,
  onGoUp,
  onCopyUrl,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onAddToMemory,
  onUseVoiceAsset,
  onOpenItem,
}: {
  items: StorageObjectItem[]
  youtubeImport: YoutubeImportPlaceholderState | null
  groupMagicClips: boolean
  deletingIds: Set<string>
  selectedIds: Set<string>
  selectionMode: boolean
  allSelected: boolean
  onToggleSelected: (itemId: string, checked: boolean) => void
  onToggleAllSelected: (checked: boolean) => void
  canGoUp: boolean
  writeDisabled: boolean
  onGoUp: () => void
  onCopyUrl: (item: StorageObjectItem) => void
  onDownload: (item: StorageObjectItem) => void
  onDelete: (item: StorageObjectItem) => void
  onRename: (item: StorageObjectItem) => void
  onMove: (item: StorageObjectItem) => void
  onAddToMemory: (item: StorageObjectItem) => void
  onUseVoiceAsset?: (item: StorageObjectItem) => void
  onOpenItem: (item: StorageObjectItem) => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const format = useFormatter()
  const tAuto = useTranslations('Auto')
  const groups = groupMagicClips
    ? groupMagicClipItems(items)
    : [{ key: 'all', kind: 'fallback' as const, runId: null, items }]

  return (
    <div className="overflow-hidden rounded-2xl bg-panel/45 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)]">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/35">
            {selectionMode && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  aria-label={tAuto('select_all_913afff1')}
                  onCheckedChange={(checked) => onToggleAllSelected(checked === true)}
                  className={STORAGE_SELECT_CHECKBOX_CLASS}
                />
              </TableHead>
            )}
            <TableHead><UiText id="name_709a2322" /></TableHead>
            <TableHead className="w-[190px] text-right"><UiText id="date_created_dda2f80b" /></TableHead>
            <TableHead className="w-12 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {canGoUp && <StorageParentFolderListRow selectionMode={selectionMode} onOpen={onGoUp} />}
          {youtubeImport ? youtubeImport.labels.map((label, index) => (
            <YoutubeImportPlaceholderListRow
              key={`youtube-pending-${label}-${index}`}
              label={label}
              statusLabel={youtubeImport.statusLabel}
              failed={youtubeImport.failed}
              detail={youtubeImport.detail}
              selectionMode={selectionMode}
            />
          )) : null}
          {groups.map((group) => (
            <React.Fragment key={group.key}>
              {groupMagicClips ? (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={selectionMode ? 4 : 3} className="h-9 py-1.5">
                    <StorageClipGroupHeading group={group} />
                  </TableCell>
                </TableRow>
              ) : null}
          {group.items.map((item) => {
            const isDeleting = deletingIds.has(item.id)
            const badge = getStorageItemBadge(item, isDeleting, tStorage)
            const memoryBadge = getStorageMemoryBadge(item, tStorage)
            const isSelected = selectedIds.has(item.id)
            return (
            <TableRow
              key={item.id}
              className={cn('youtorch-storage-row-containment h-12', isDeleting && 'opacity-45 saturate-50')}
            >
              {selectionMode && (
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    aria-label={`Select ${item.name}`}
                    disabled={isDeleting}
                    onCheckedChange={(checked) => onToggleSelected(item.id, checked === true)}
                    className={STORAGE_SELECT_CHECKBOX_CLASS}
                  />
                </TableCell>
              )}
              <TableCell>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    if (selectionMode) onToggleSelected(item.id, !isSelected)
                    else onOpenItem(item)
                  }}
                  className="flex max-w-full items-center gap-2 text-left"
                >
                  {item.type === 'folder' ? (
                    <StorageFolderGlyph className="h-7 w-8 shrink-0" />
                  ) : (
                    <FilePreviewIcon item={item} className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(
                    'truncate text-sm font-medium',
                    item.type === 'folder' ? 'text-primary' : 'text-foreground',
                  )}>
                    {item.name}
                  </span>
                  {isStorageGifItem(item) && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      GIF
                    </span>
                  )}
                  {badge && <StorageStatusBadge badge={badge} />}
                  {memoryBadge && <StorageStatusBadge badge={memoryBadge} />}
                </button>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">{formatDateTime(item.created_at, format)}</TableCell>
              <TableCell className="text-right">
                <StorageItemActions
                  item={item}
                  disabled={isDeleting}
                  writeDisabled={writeDisabled || isDeleting}
                  onCopyUrl={onCopyUrl}
                  onDownload={onDownload}
                  onDelete={onDelete}
                  onRename={onRename}
                  onMove={onMove}
                  onAddToMemory={onAddToMemory}
                  onUseVoiceAsset={onUseVoiceAsset}
                />
              </TableCell>
            </TableRow>
            )
          })}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function StorageParentFolderGridItem({ onOpen }: { onOpen: () => void }) {
  const tAuto = useTranslations('Auto')
  return (
    <div className="group min-w-0 text-left transition-transform duration-200 hover:-translate-y-0.5">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-panel opacity-80 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.07)] transition duration-200 hover:opacity-100 group-hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.1),0_18px_32px_rgb(0_0_0_/_0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={tAuto('go_to_parent_folder_c0ee2a71')}
      >
        <StorageFolderGlyph muted className={STORAGE_FOLDER_TILE_GLYPH_CLASS} />
      </button>
      <div className="space-y-1 px-1 pt-3">
        <p className="truncate text-sm font-semibold text-muted-foreground">...</p>
        <p className="truncate text-xs text-muted-foreground"><UiText id="parent_folder_d8ed4c2a" /></p>
      </div>
    </div>
  )
}

function StorageParentFolderListRow({
  selectionMode,
  onOpen,
}: {
  selectionMode: boolean
  onOpen: () => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <TableRow className="h-12">
      {selectionMode && <TableCell />}
      <TableCell>
        <button
          type="button"
          onClick={onOpen}
          className="flex max-w-full items-center gap-2 text-left"
          aria-label={tAuto('go_to_parent_folder_c0ee2a71')}
        >
          <StorageFolderGlyph muted className="h-6 w-7 shrink-0" />
          <ArrowUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-muted-foreground">...</span>
        </button>
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground"><UiText id="parent_folder_d8ed4c2a" /></TableCell>
      <TableCell />
    </TableRow>
  )
}

function StorageProcessingGlassLayer() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.58),rgba(226,240,255,0.34))] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-[1.5px] dark:bg-[linear-gradient(135deg,rgba(29,33,37,0.72),rgba(87,157,255,0.16))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    />
  )
}

function StorageStatusBadge({
  badge,
  className,
}: {
  badge: StorageStatusBadgeModel
  className?: string
}) {
  const visual = getStorageStatusBadgeVisual(badge.tone)
  const Icon = visual.icon
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-0 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold leading-none shadow-sm backdrop-blur-md ring-1 ring-white/70 dark:ring-white/10',
        visual.className,
        className,
      )}
    >
      <Icon className={cn('h-3 w-3 shrink-0', visual.iconClassName)} />
      <span className="truncate">{badge.label}</span>
    </span>
  )
}

function getStorageStatusBadgeVisual(tone: StorageStatusTone): {
  icon: React.ComponentType<{ className?: string }>
  className: string
  iconClassName?: string
} {
  if (tone === 'processing') {
    return {
      icon: Loader2,
      className: 'border-primary/40 bg-background/80 text-primary shadow-[0_8px_22px_rgba(12,102,228,0.14)] dark:bg-card/80 dark:shadow-[0_8px_22px_rgba(0,0,0,0.28)]',
      iconClassName: 'animate-spin',
    }
  }
  if (tone === 'uploading' || tone === 'queued') {
    return {
      icon: Loader2,
      className: 'border-border bg-background/80 text-muted-foreground shadow-[0_8px_22px_rgba(65,80,102,0.10)] dark:bg-card/80 dark:shadow-[0_8px_22px_rgba(0,0,0,0.28)]',
      iconClassName: tone === 'uploading' ? 'animate-spin' : undefined,
    }
  }
  if (tone === 'complete') {
    return {
      icon: CheckCircle2,
      className: 'border-success/40 bg-background/80 text-success shadow-[0_8px_22px_rgba(46,139,87,0.12)] dark:bg-card/80 dark:shadow-[0_8px_22px_rgba(0,0,0,0.28)]',
    }
  }
  if (tone === 'failed' || tone === 'blocked' || tone === 'cancelled') {
    return {
      icon: XCircle,
      className: 'border-destructive/40 bg-background/80 text-destructive shadow-[0_8px_22px_rgba(180,35,24,0.12)] dark:bg-card/80 dark:shadow-[0_8px_22px_rgba(0,0,0,0.28)]',
    }
  }
  return {
    icon: Trash2,
    className: 'border-border bg-background/80 text-muted-foreground shadow-[0_8px_22px_rgba(71,84,103,0.10)] dark:bg-card/80 dark:shadow-[0_8px_22px_rgba(0,0,0,0.28)]',
  }
}

function StorageItemActions({
  item,
  disabled,
  writeDisabled,
  onCopyUrl,
  onDownload,
  onDelete,
  onRename,
  onMove,
  onAddToMemory,
  onUseVoiceAsset,
}: {
  item: StorageObjectItem
  disabled?: boolean
  writeDisabled?: boolean
  onCopyUrl: (item: StorageObjectItem) => void
  onDownload: (item: StorageObjectItem) => void
  onDelete: (item: StorageObjectItem) => void
  onRename: (item: StorageObjectItem) => void
  onMove: (item: StorageObjectItem) => void
  onAddToMemory: (item: StorageObjectItem) => void
  onUseVoiceAsset?: (item: StorageObjectItem) => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const tAuto = useTranslations('Auto')
  const router = useRouter()
  const canOpen = isStorageFileOpenable(item)
  const canDownload = canOpen && !isStorageStreamVideo(item)
  const canAddToMemory = isStorageItemMemoryIndexable(item)
  const memoryAction = getStorageMemoryAction(item)
  const voiceAction = onUseVoiceAsset ? getStorageVoiceAction(item) : null
  const avatarAction = isStorageAvatarAsset(item)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" title={tAuto('more_4bab2d8f')} aria-label={`More actions for ${item.name}`} disabled={disabled}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={voiceAction || avatarAction ? 'w-56' : 'w-40'}>
        {avatarAction && (
          <>
            <DropdownMenuItem disabled={disabled} onClick={() => router.push('/brand?section=avatars')}>
              <UserRound className="h-4 w-4" />
              {tStorage('avatarActions.openInBrand')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {voiceAction && (
          <>
            <DropdownMenuItem disabled={disabled} onClick={() => onUseVoiceAsset?.(item)}>
              <Mic className="h-4 w-4" />
              {tStorage(voiceAction.labelKey)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem disabled={disabled || !canOpen} onClick={() => onCopyUrl(item)}>
          <Copy className="h-4 w-4" />
          <UiText id="copy_url_1ad646dc" /></DropdownMenuItem>
        <DropdownMenuItem disabled={disabled || !canDownload} onClick={() => onDownload(item)}>
          <Download className="h-4 w-4" />
          <UiText id="download_a479c9c3" /></DropdownMenuItem>
        <DropdownMenuItem disabled={disabled || writeDisabled || !canAddToMemory} onClick={() => onAddToMemory(item)}>
          <Lightbulb className="h-4 w-4" />
          {memoryAction && memoryAction !== 'add'
            ? tStorage(`memoryActions.${memoryAction === 'add_anyway' ? 'addAnyway' : memoryAction}`)
            : <UiText id="add_to_memory_f4831d5c" />}</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled || writeDisabled} onClick={() => onRename(item)}>
          <Pencil className="h-4 w-4" />
          <UiText id="rename_d3f4cb89" /></DropdownMenuItem>
        <DropdownMenuItem disabled={disabled || writeDisabled} onClick={() => onMove(item)}>
          <Folder className="h-4 w-4" />
          <UiText id="move_76cdb950" /></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={disabled || writeDisabled} variant="destructive" onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UploadProgressToastContainer({
  principalId,
  channelId,
  memorySummary,
}: {
  principalId: string | null
  channelId: string | null
  memorySummary: MemoryUploadSummary | null
}) {
  const allTasks = useUploadTaskStore((state) => state.tasks)
  const tasks = React.useMemo(
    () => allTasks.filter((task) => isUploadTaskInScope(task, principalId, channelId)),
    [allTasks, channelId, principalId],
  )
  const dismissTask = useUploadTaskStore((state) => state.dismissTask)
  const cancelTask = useUploadTaskStore((state) => state.cancelTask)
  const pruneSettledTasks = useUploadTaskStore((state) => state.pruneSettledTasks)

  React.useEffect(() => {
    const settledTasks = tasks.filter((task) => task.settledAt && isUploadTaskSettledStatus(task.status))
    if (settledTasks.length === 0) return undefined

    const now = Date.now()
    const nextDelay = Math.max(250, Math.min(...settledTasks.map((task) => {
      const visibleMs = getUploadTaskVisibleMs(task.status)
      return visibleMs - (now - task.settledAt!)
    })))

    const timeout = window.setTimeout(pruneSettledTasks, nextDelay)
    return () => window.clearTimeout(timeout)
  }, [pruneSettledTasks, tasks])

  if (tasks.length === 0) return null

  return (
    <UploadProgressToast
      tasks={tasks}
      memorySummary={memorySummary}
      onDismiss={dismissTask}
      onCancel={cancelTask}
    />
  )
}

function UploadProgressToast({
  tasks,
  memorySummary,
  onDismiss,
  onCancel,
}: {
  tasks: UploadTask[]
  memorySummary: MemoryUploadSummary | null
  onDismiss: (taskId: string) => void
  onCancel: (taskId: string) => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const orderedTasks = orderUploadTasks(tasks)
  const activeTasks = orderedTasks.filter(isUploadTaskActive)
  const cancellableTasks = activeTasks.filter(isUploadTaskCancelable)
  const summary = formatUploadQueueSummary(orderedTasks, tStorage)
  const title = formatUploadToastTitle(orderedTasks, activeTasks, tStorage)
  const statusBadge = getUploadSummaryStatusBadge(orderedTasks, tStorage)
  const progress = getUploadSummaryProgress(orderedTasks)
  const failedTask = orderedTasks.find((task) => task.status === 'failed' && task.error)
  const actionLabel = cancellableTasks.length > 0 ? tStorage('uploads.cancelActive') : tStorage('uploads.dismiss')

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(330px,calc(100vw-2rem))] overflow-hidden rounded-md border border-border bg-popover/90 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-foreground"><UiText id="uploads_227cc640" /></p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{title}</p>
        </div>
        <StorageStatusBadge badge={statusBadge} className="h-6" />
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            if (cancellableTasks.length > 0) {
              cancellableTasks.forEach((task) => onCancel(task.id))
              return
            }
            orderedTasks.forEach((task) => onDismiss(task.id))
          }}
          aria-label={actionLabel}
          title={actionLabel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{summary}</span>
          <span className="shrink-0 tabular-nums">{progress}%</span>
        </div>
        <Progress
          value={progress}
          className={cn(
            'mt-2 h-1.5 bg-primary/15 [&_[data-slot=progress-indicator]]:bg-primary',
            statusBadge.tone === 'failed' && 'bg-destructive/15 [&_[data-slot=progress-indicator]]:bg-destructive',
            statusBadge.tone === 'cancelled' && 'bg-destructive/15 [&_[data-slot=progress-indicator]]:bg-destructive',
            statusBadge.tone === 'complete' && 'bg-success/15 [&_[data-slot=progress-indicator]]:bg-success',
          )}
        />
        {failedTask?.error && <p className="mt-2 line-clamp-2 text-xs text-destructive">{failedTask.error}</p>}
        <MemoryUploadSummaryLine summary={memorySummary} className="mt-2" />
      </div>
    </aside>
  )
}

function StorageActionToast({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-md border border-destructive/35 bg-popover/90 px-3 py-3 text-sm text-foreground shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-destructive/45 dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5 text-foreground"><UiText id="storage_action_failed_5f2a9809" /></p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{message}</p>
      </div>
      <button
        type="button"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onDismiss}
        aria-label={tAuto('dismiss_message_98f3b0e0')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function StorageLimitDialogDetails({ limit }: { limit: StorageLimitDialogState }) {
  const format = useFormatter()
  const tAuto = useTranslations('Auto')
  return (
    <div className="overflow-hidden rounded-md border border-[#FADDB8] bg-[#FFF7ED] dark:border-[#7F5F01] dark:bg-[#332E1B]">
      <div className="space-y-2 p-3">
        <StorageLimitDetailRow label={tAuto('selected_file_0aae1587')} value={`${limit.fileName} (${formatBytes(limit.fileSizeBytes, format)})`} />
        <StorageLimitDetailRow label={tAuto('maximum_file_size_66aa39a6')} value={limit.singleFileLimitBytes ? formatBytes(limit.singleFileLimitBytes, format) : tAuto('checking_494d0f68')} />
        <StorageLimitDetailRow label={tAuto('total_storage_space_58319ef2')} value={formatLimitStorageValue(limit, format)} />
      </div>
    </div>
  )
}

function formatLimitStorageValue(limit: StorageLimitDialogState, format: StorageFormatter) {
  if (limit.totalStorageBytes) return formatBytes(limit.totalStorageBytes, format)
  if (limit.totalStorageLoading) return 'Checking...'
  return 'Not available'
}

function StorageLimitDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-xs leading-5">
      <span className="text-[#9A3412] dark:text-[#F5CD47]">{label}</span>
      <span className="truncate text-right font-medium text-[#431407] dark:text-foreground" title={value}>{value}</span>
    </div>
  )
}

function StoragePreviewDialog({
  preview,
  channelId,
  onOpenChange,
  onDownload,
  onShare,
  onRetry,
  onUseVoiceAsset,
}: {
  preview: StoragePreviewDialogState | null
  channelId: string | null
  onOpenChange: (open: boolean) => void
  onDownload: (item: StorageObjectItem) => void
  onShare: (item: StorageObjectItem) => void
  onRetry: (item: StorageObjectItem) => void
  onUseVoiceAsset?: (item: StorageObjectItem) => void
}) {
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const router = useRouter()
  const voiceAction = preview && onUseVoiceAsset ? getStorageVoiceAction(preview.item) : null
  const supportsTranscript = Boolean(
    preview
      && channelId
      && (preview.kind === 'video' || preview.kind === 'audio'),
  )
  const overlayHint = preview?.variant === 'original' && isStorageStreamVideo(preview.item) && !preview.item.playback_ready
    ? <UiText id="original_preview_hd_processing_61c4ee38" />
    : null
  const [playbackTime, setPlaybackTime] = React.useState(0)
  const seekRef = React.useRef<((seconds: number) => void) | null>(null)

  React.useEffect(() => {
    setPlaybackTime(0)
  }, [preview?.item.id])

  return (
    <StorageMediaInspector
      open={Boolean(preview)}
      item={preview?.item ?? null}
      kind={preview?.kind ?? 'unsupported'}
      isGif={Boolean(preview && isStorageGifItem(preview.item))}
      isVoice={Boolean(preview && isStorageVoiceAsset(preview.item))}
      isAvatar={Boolean(preview && isStorageAvatarAsset(preview.item))}
      overlayHint={overlayHint}
      canDownload={Boolean(
        preview
          && preview.status === 'ready'
          && preview.kind !== 'unsupported'
          && !isStorageStreamVideo(preview.item),
      )}
      media={preview ? (
        <StoragePreviewDialogBody
          key={getStoragePreviewMediaStateKey(preview)}
          preview={preview}
          fill
          onDownload={onDownload}
          onRetry={onRetry}
          onTimeUpdate={setPlaybackTime}
          seekRef={seekRef}
        />
      ) : null}
      transcript={preview && channelId && supportsTranscript ? (
        <InspectorTimedTranscript
          key={preview.item.id}
          channelId={channelId}
          sourceObjectId={preview.item.id}
          sourceReady={isStorageWorkflowMediaReady(preview.item)}
          currentTime={playbackTime}
          onSeek={(seconds) => seekRef.current?.(seconds)}
        />
      ) : undefined}
      onOpenChange={onOpenChange}
      onDownload={() => { if (preview) onDownload(preview.item) }}
      onShare={() => { if (preview) onShare(preview.item) }}
      onOpenHref={(href) => router.push(href)}
      onUseVoiceAsset={onUseVoiceAsset && preview ? () => onUseVoiceAsset(preview.item) : undefined}
      voiceActionLabel={voiceAction ? tStorage(voiceAction.labelKey) : null}
    />
  )
}

function MediaTranscriptDialog({
  open,
  onOpenChange,
  channelId,
  sourceObjectId,
  sourceReady,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId: string
  sourceObjectId: string
  sourceReady: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] min-h-[min(620px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden rounded-2xl border-border/80 bg-popover p-0 shadow-2xl sm:max-w-[min(1020px,calc(100vw-2rem))]">
        <DialogHeader className="border-b border-border/80 bg-[radial-gradient(90%_120%_at_0%_0%,hsl(var(--primary)/0.13),transparent_62%)] px-5 py-5 pr-12 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_10px_28px_hsl(var(--primary)/0.12)]">
              <span className="absolute inset-1 rounded-lg border border-primary/15" />
              <FileText className="relative h-4 w-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold tracking-tight"><UiText id="transcript_5bcd6022" /></DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                <UiText id="review_download_or_recreate_a_transcript_without_ea1101c1" /></DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <MediaTranscriptPanel
          channelId={channelId}
          sourceObjectId={sourceObjectId}
          sourceReady={sourceReady}
        />
      </DialogContent>
    </Dialog>
  )
}

function MediaTranscriptPanel({
  channelId,
  sourceObjectId,
  sourceReady,
}: {
  channelId: string
  sourceObjectId: string
  sourceReady: boolean
}) {
  const tAuto = useTranslations('Auto')
  const tStorage = useTranslations('Storage') as unknown as StorageTranslator
  const queryClient = useQueryClient()
  const [selectedArtifactId, setSelectedArtifactId] = React.useState<string | null>(null)
  const [agentId, setAgentId] = React.useState<string | null>(null)
  const [agentPollStartedAtMs, setAgentPollStartedAtMs] = React.useState<number | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [confirmation, setConfirmation] = React.useState<{
    action: 'delete' | 'regenerate'
    artifact: MediaTranscriptArtifact
  } | null>(null)

  const artifactsQuery = useQuery({
    queryKey: mediaTranscriptsQueryKey(channelId, sourceObjectId),
    queryFn: ({ signal }) => listMediaTranscriptArtifacts({ channelId, sourceObjectId }, { signal }),
    refetchInterval: (query) => getMediaTranscriptArtifactsPollInterval(
      query.state.data ?? [],
      Date.now(),
      Boolean(query.state.error),
    ),
  })
  const agentStatusQuery = useQuery({
    queryKey: ['workflow-agent', 'status', agentId],
    queryFn: ({ signal }) => getWorkflowAgentStatus(agentId!, { signal }),
    enabled: Boolean(agentId),
    retry: false,
    refetchInterval: (query) => getMediaTranscriptAgentPollInterval(
      query.state.data?.status,
      agentPollStartedAtMs,
      Date.now(),
      Boolean(query.state.error),
    ),
  })
  const artifacts = React.useMemo(() => artifactsQuery.data ?? [], [artifactsQuery.data])
  const renderedAtMs = Math.max(
    artifactsQuery.dataUpdatedAt,
    agentStatusQuery.dataUpdatedAt,
    agentPollStartedAtMs ?? 0,
  )
  const agentPollingTimedOut = Boolean(
    agentId
      && agentPollStartedAtMs != null
      && renderedAtMs - agentPollStartedAtMs >= MEDIA_TRANSCRIPT_POLL_DEADLINE_MS
      && !isTranscriptAgentTerminal(agentStatusQuery.data?.status),
  )
  const staleArtifact = artifacts.find((artifact) => isMediaTranscriptArtifactPollingStale(artifact, renderedAtMs))
  const agentRunning = Boolean(agentId)
    && !agentStatusQuery.error
    && !agentPollingTimedOut
    && !isTranscriptAgentTerminal(agentStatusQuery.data?.status)
  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedArtifactId)
    ?? artifacts.find((artifact) => artifact.status === 'ready')
    ?? artifacts[0]
    ?? null

  React.useEffect(() => {
    if (!agentId) return
    void queryClient.invalidateQueries({ queryKey: mediaTranscriptsQueryKey(channelId, sourceObjectId) })
  }, [agentId, agentStatusQuery.dataUpdatedAt, channelId, queryClient, sourceObjectId])

  const transcriptTextQuery = useQuery({
    queryKey: ['workflow', 'media-transcript-text', channelId, sourceObjectId, selectedArtifact?.id],
    queryFn: ({ signal }) => getMediaTranscriptText({
      channelId,
      sourceObjectId,
      artifactId: selectedArtifact!.id,
    }, { signal }),
    enabled: selectedArtifact?.status === 'ready' && selectedArtifact.downloadable,
    retry: false,
  })

  const launchMutation = useMutation({
    mutationFn: async (attempt: ClientMutationAttempt<TranscriptLaunchIntent>) => {
      setActionError(null)
      if (!sourceReady) {
        throw new Error('Media is still processing. Create the transcript when Storage preparation is complete.')
      }
      return launchWorkflowAgent({
        projectId: attempt.payload.channelId,
        channelId: attempt.payload.channelId,
        nodeType: 'transcript@1',
        params: {
          storage_object_id: attempt.payload.sourceObjectId,
          ...(attempt.payload.replacementArtifactId
            ? { replacement_artifact_id: attempt.payload.replacementArtifactId }
            : {}),
        },
        idempotencyKey: attempt.idempotencyKey,
      })
    },
    onSuccess: (result, attempt) => {
      clearTranscriptLaunchAttempt(attempt)
      setAgentPollStartedAtMs(Date.now())
      setAgentId(result.agent_id)
      void queryClient.invalidateQueries({ queryKey: mediaTranscriptsQueryKey(channelId, sourceObjectId) })
    },
    onError: (error, attempt) => {
      if (!isAmbiguousMutationError(error)) clearTranscriptLaunchAttempt(attempt)
      setActionError(getStorageActionErrorMessage(error))
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (artifact: MediaTranscriptArtifact) => deleteMediaTranscriptArtifact({
      channelId,
      sourceObjectId,
      artifactId: artifact.id,
    }),
    onSuccess: () => {
      setSelectedArtifactId(null)
      void queryClient.invalidateQueries({ queryKey: mediaTranscriptsQueryKey(channelId, sourceObjectId) })
    },
    onError: (error) => setActionError(getStorageActionErrorMessage(error)),
  })
  const activeArtifactExists = artifacts.some((artifact) => blocksTranscriptMutation(artifact, renderedAtMs))
  const busy = launchMutation.isPending || deleteMutation.isPending || agentRunning
  const agentError = agentStatusQuery.data?.errorMessage ?? (agentStatusQuery.error
    ? getStorageActionErrorMessage(agentStatusQuery.error)
    : agentPollingTimedOut
      ? 'Transcript status refresh stopped after 30 minutes. Refresh the page to reconcile the latest state.'
      : null)
  const artifactPollingError = staleArtifact
    ? tStorage('transcript.stale')
    : null

  const runConfirmedAction = () => {
    if (!confirmation) return
    const current = confirmation
    setConfirmation(null)
    if (current.action === 'delete') deleteMutation.mutate(current.artifact)
    else runTranscriptLaunch(current.artifact.id)
  }

  const runTranscriptLaunch = (replacementArtifactId?: string) => {
    if (activeArtifactExists) return
    const payload = { channelId, sourceObjectId, modelId: '', replacementArtifactId }
    launchMutation.mutate(getOrCreateTranscriptLaunchAttempt(
      payload,
      () => createWorkflowActionIdempotencyKey('storage-transcript'),
    ))
  }

  const runPrimaryAction = () => {
    const artifactToReplace = selectedArtifact?.status === 'ready'
      ? selectedArtifact
      : artifacts.find((artifact) => artifact.status === 'ready') ?? null
    if (artifactToReplace) {
      setConfirmation({ action: 'regenerate', artifact: artifactToReplace })
      return
    }
    runTranscriptLaunch()
  }
  const canCreate = sourceReady && !busy && !activeArtifactExists

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background" aria-labelledby="media-transcript-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-muted/15 px-5 py-3 sm:px-6">
        <div className="min-w-0">
          <h3 id="media-transcript-heading" className="text-sm font-semibold text-foreground"><UiText id="transcript_versions_d2e7dc82" /></h3>
          <p className="text-xs text-muted-foreground">{artifacts.length === 0 ? tAuto('no_transcript_yet_3e886f96') : `${artifacts.length} saved version${artifacts.length === 1 ? '' : 's'}`}</p>
        </div>
        <Button
          type="button"
          size="sm"
          title={!sourceReady ? tAuto('transcript_is_available_after_media_processing_c_385d463e') : undefined}
          onClick={runPrimaryAction}
          disabled={!canCreate}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {!sourceReady ? tAuto('media_processing_9876c97d') : busy ? tAuto('working_13b7bfca') : artifacts.length > 0 ? tAuto('regenerate_transcript_16e248f1') : tAuto('create_transcript_16b0197e')}
        </Button>
      </div>

      {(actionError || agentError || artifactPollingError) && (
        <div className="flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/5 px-5 py-2 text-xs text-destructive sm:px-6">
          <span>{actionError ?? agentError ?? artifactPollingError}</span>
          {staleArtifact ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || activeArtifactExists}
              onClick={() => {
                if (staleArtifact.status === 'deleting') {
                  deleteMutation.mutate(staleArtifact)
                  return
                }
                const readyArtifact = artifacts.find((artifact) => artifact.status === 'ready')
                runTranscriptLaunch(readyArtifact?.id)
              }}
            >
              {staleArtifact.status === 'deleting'
                ? tStorage('transcript.retryCleanup')
                : tStorage('transcript.reclaim')}
            </Button>
          ) : null}
        </div>
      )}

      {artifactsQuery.isLoading ? (
        <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : artifactsQuery.isError ? (
        <div className="flex min-h-24 items-center justify-center px-4 text-sm text-destructive">
          {getStorageActionErrorMessage(artifactsQuery.error)}
        </div>
      ) : artifacts.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center px-4 text-sm text-muted-foreground">
          {!sourceReady
            ? tAuto('transcript_can_be_created_after_storage_finishes_222db167')
            : agentRunning ? tAuto('transcript_is_being_prepared_4a8bd24f') : tAuto('no_transcript_has_been_created_for_this_media_38248fe9')}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-border">
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className={cn('px-5 py-3 sm:px-6', selectedArtifact?.id === artifact.id && 'bg-primary/5')}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 text-left transition-opacity hover:opacity-80"
                  onClick={() => setSelectedArtifactId(artifact.id)}
                  aria-pressed={selectedArtifact?.id === artifact.id}
                >
                  <span className="block text-sm font-medium text-foreground">{formatTranscriptStatus(artifact.status)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {artifact.model_id} / {artifact.source_language === 'auto' ? tAuto('auto_language_5495bf07') : artifact.source_language}
                    {artifact.duration_seconds != null ? ` / ${formatTranscriptDuration(artifact.duration_seconds)}` : ''}
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  {artifact.downloadable && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={tAuto('download_transcript_c29d4c12')}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(['txt', 'srt', 'vtt'] as const).map((format) => (
                          <DropdownMenuItem key={format} onSelect={() => downloadTranscriptArtifact({ channelId, sourceObjectId, artifact, format })}>
                            {format.toUpperCase()}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tAuto('regenerate_transcript_16e248f1')}
                    disabled={busy || activeArtifactExists || artifact.status === 'processing' || artifact.status === 'deleting'}
                    onClick={() => setConfirmation({ action: 'regenerate', artifact })}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={tAuto('delete_transcript_47cd0e24')}
                    disabled={busy || (artifact.status === 'deleting' && !isStaleTranscriptArtifact(artifact, renderedAtMs))}
                    onClick={() => setConfirmation({ action: 'delete', artifact })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {selectedArtifact?.id === artifact.id && artifact.status === 'ready' && (
                <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-primary/15 bg-muted/20 p-4 text-[15px] leading-7 text-foreground/90">
                  {transcriptTextQuery.isLoading
                    ? <Loader2 className="my-2 h-4 w-4 animate-spin text-muted-foreground" />
                    : transcriptTextQuery.isError
                      ? <span className="text-destructive"><UiText id="transcript_text_could_not_be_loaded_ffd7cd8c" /></span>
                      : <p className="whitespace-pre-wrap">{transcriptTextQuery.data || tAuto('transcript_is_empty_e44543a6')}</p>}
                </div>
              )}
              {artifact.status === 'failed' && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground"><UiText id="this_transcript_could_not_be_completed_use_the_r_9f738447" /></p>
              )}
            </div>
          ))}
        </div>
      )}

      <AppAlertDialog
        open={Boolean(confirmation)}
        title={confirmation?.action === 'regenerate' ? tAuto('regenerate_transcript_a4acda54') : tAuto('delete_transcript_1819822f')}
        description={confirmation?.action === 'regenerate'
          ? tAuto('the_current_link_will_be_replaced_an_identical_c_45162bfc')
          : tAuto('the_transcript_artifact_and_its_downloads_will_b_4add2484')}
        confirmLabel={confirmation?.action === 'regenerate' ? tAuto('regenerate_b04c991e') : 'Delete'}
        tone={confirmation?.action === 'delete' ? 'destructive' : 'warning'}
        busy={launchMutation.isPending || deleteMutation.isPending}
        onOpenChange={(open) => { if (!open) setConfirmation(null) }}
        onConfirm={runConfirmedAction}
      />
    </section>
  )
}

function downloadTranscriptArtifact(input: {
  channelId: string
  sourceObjectId: string
  artifact: MediaTranscriptArtifact
  format: MediaTranscriptDownloadFormat
}) {
  const anchor = document.createElement('a')
  anchor.href = getMediaTranscriptDownloadUrl({
    channelId: input.channelId,
    sourceObjectId: input.sourceObjectId,
    artifactId: input.artifact.id,
    format: input.format,
  })
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function isTranscriptAgentTerminal(status: string | null | undefined) {
  if (!status) return false
  return ['completed', 'success', 'succeeded', 'failed', 'cancelled', 'canceled'].includes(status.toLowerCase())
}

function getBoundedMediaTranscriptPollInterval(elapsedMs: number) {
  const safeElapsedMs = Math.max(0, elapsedMs)
  if (safeElapsedMs >= MEDIA_TRANSCRIPT_POLL_DEADLINE_MS) return false
  if (safeElapsedMs < MEDIA_TRANSCRIPT_FAST_POLL_WINDOW_MS) return MEDIA_TRANSCRIPT_FAST_POLL_INTERVAL_MS
  if (safeElapsedMs < MEDIA_TRANSCRIPT_WARM_POLL_WINDOW_MS) return MEDIA_TRANSCRIPT_WARM_POLL_INTERVAL_MS
  if (safeElapsedMs < MEDIA_TRANSCRIPT_SLOW_POLL_WINDOW_MS) return MEDIA_TRANSCRIPT_SLOW_POLL_INTERVAL_MS
  return MEDIA_TRANSCRIPT_LONG_POLL_INTERVAL_MS
}

function getMediaTranscriptAgentPollInterval(
  status: string | null | undefined,
  startedAtMs: number | null,
  nowMs = Date.now(),
  failed = false,
) {
  if (failed || startedAtMs == null || isTranscriptAgentTerminal(status)) return false
  return getBoundedMediaTranscriptPollInterval(nowMs - startedAtMs)
}

function getMediaTranscriptArtifactsPollInterval(
  artifacts: MediaTranscriptArtifact[],
  nowMs = Date.now(),
  failed = false,
) {
  if (failed) return false
  const activeUpdatedAtMs = artifacts
    .filter((artifact) => artifact.status === 'processing' || artifact.status === 'deleting')
    .map((artifact) => Date.parse(artifact.updated_at))
    .filter(Number.isFinite)
  if (activeUpdatedAtMs.length === 0) return false
  return getBoundedMediaTranscriptPollInterval(nowMs - Math.max(...activeUpdatedAtMs))
}

function isMediaTranscriptArtifactPollingStale(
  artifact: MediaTranscriptArtifact,
  nowMs = Date.now(),
) {
  return isStaleTranscriptArtifact(artifact, nowMs)
}

function formatTranscriptStatus(status: MediaTranscriptArtifact['status']) {
  if (status === 'ready') return 'Ready'
  if (status === 'processing') return 'Processing'
  if (status === 'deleting') return 'Deleting'
  if (status === 'deleted') return 'Deleted'
  return 'Failed'
}

function formatTranscriptDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const remainingSeconds = rounded % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function getStoragePreviewStageClass(kind: StoragePreviewKind, portrait: boolean) {
  if (portrait) return 'mx-auto aspect-[9/16] w-full max-h-[min(70vh,calc(92vh-9rem))]'
  if (kind === 'video') return 'aspect-video w-full'
  if (kind === 'text') return 'h-[min(64vh,680px)] w-full'
  if (kind === 'image') return 'flex min-h-[min(40vh,320px)] max-h-[min(70vh,720px)] w-full items-center justify-center'
  return 'min-h-[16rem] w-full'
}

function StoragePreviewDialogBody({
  preview,
  fill = false,
  onDownload,
  onRetry,
  onTimeUpdate,
  seekRef,
}: {
  preview: StoragePreviewDialogState
  fill?: boolean
  onDownload: (item: StorageObjectItem) => void
  onRetry: (item: StorageObjectItem) => void
  onTimeUpdate?: (seconds: number) => void
  seekRef?: React.MutableRefObject<((seconds: number) => void) | null>
}) {
  const tAuto = useTranslations('Auto')
  const [mediaStatus, setMediaStatus] = React.useState<StoragePreviewMediaStatus>(() => (
    preview.status === 'ready' && preview.kind === 'unsupported' ? 'ready' : 'loading'
  ))
  const mediaRef = React.useRef<HTMLMediaElement | null>(null)
  const streamFrameRef = React.useRef<HTMLIFrameElement | null>(null)
  const setMediaElement = React.useCallback((node: HTMLMediaElement | null) => {
    mediaRef.current = node
    if (seekRef) {
      seekRef.current = node
        ? (seconds) => {
          node.currentTime = Math.max(0, seconds)
        }
        : null
    }
  }, [seekRef])
  const nativePlaybackUrl = preview.url
  React.useEffect(() => {
    if (
      preview.status !== 'ready'
      || !nativePlaybackUrl
      || (preview.kind !== 'video' && preview.kind !== 'audio')
      || (
        preview.kind === 'video'
        && (preview.variant === 'stream' || Boolean(preview.url && isEmbeddableVideoUrl(preview.url)))
      )
    ) {
      return undefined
    }

    const media = mediaRef.current
    if (!media) return undefined
    return attachStorageMediaSource(media, nativePlaybackUrl)
  }, [nativePlaybackUrl, preview.kind, preview.status, preview.url, preview.variant])

  const streamPlayerUrl = preview.status === 'ready'
    && preview.kind === 'video'
    && preview.url
    && (preview.variant === 'stream' || isEmbeddableVideoUrl(preview.url))
    ? preview.url
    : null
  const registerStreamPlayer = React.useCallback(() => {
    const frame = streamFrameRef.current
    if (!frame || !streamPlayerUrl) return
    registerStoragePlayerEvents(
      frame,
      streamPlayerUrl,
      `assets-preview:${preview.item.id}`,
      ['ready', 'error', 'timeupdate'],
    )
    if (seekRef) {
      seekRef.current = (seconds) => {
        seekStoragePlayer(frame, streamPlayerUrl, seconds)
      }
    }
  }, [preview.item.id, seekRef, streamPlayerUrl])

  React.useEffect(() => {
    if (!streamPlayerUrl) return undefined
    const frame = streamFrameRef.current
    const origin = getStoragePlayerOrigin(streamPlayerUrl)
    if (!frame?.contentWindow || !origin) {
      setMediaStatus('error')
      return undefined
    }
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin) return
      const message = parseStoragePlayerEvent(event.data)
      if (!message) return
      if (message.event === 'ready') setMediaStatus('ready')
      else if (message.event === 'error') setMediaStatus('error')
      else if (message.event === 'timeupdate') {
        const seconds = readStoragePlayerTime(message.value)
        if (seconds != null) onTimeUpdate?.(seconds)
      }
    }
    window.addEventListener('message', handleMessage)
    registerStreamPlayer()
    return () => window.removeEventListener('message', handleMessage)
  }, [onTimeUpdate, registerStreamPlayer, streamPlayerUrl])

  React.useEffect(() => {
    if (
      preview.status !== 'ready'
      || !preview.url
      || (preview.kind !== 'video' && preview.kind !== 'audio')
      || mediaStatus !== 'loading'
    ) {
      return undefined
    }
    const timeoutId = window.setTimeout(() => {
      setMediaStatus(getStorageMediaTimeoutStatus)
    }, STORAGE_PLAYER_REVEAL_TIMEOUT_MS)
    return () => window.clearTimeout(timeoutId)
  }, [mediaStatus, preview.kind, preview.status, preview.url])

  const portrait = isMagicClipStorageItem(preview.item)
  const compactFill = fill && (preview.kind === 'image' || preview.kind === 'text' || preview.kind === 'unsupported')
  const pending = (label?: string, error?: boolean) => (
    <StoragePreviewPending
      cinema
      label={label}
      error={error}
      onRetry={error ? () => onRetry(preview.item) : undefined}
      className="absolute inset-0 z-10"
    />
  )
  const stage = (content: React.ReactNode) => (
    <div className={cn(
      'relative overflow-hidden',
      compactFill ? 'bg-transparent' : 'bg-black',
      fill
        ? 'flex h-full min-h-[240px] w-full items-center justify-center'
        : getStoragePreviewStageClass(preview.kind, portrait),
    )}>
      {content}
    </div>
  )

  if (preview.status === 'loading') {
    return preview.kind === 'audio'
      ? <StoragePreviewPending className="min-h-[14rem]" />
      : stage(pending())
  }

  if (preview.status === 'processing') {
    return <StorageMediaProcessingState item={preview.item} />
  }

  if (preview.status === 'error' || !preview.url) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="max-w-md text-sm text-muted-foreground">{preview.error ?? tAuto('preview_could_not_be_loaded_ff921ee1')}</p>
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onRetry(preview.item)}>
          <RefreshCw className="h-4 w-4" />
          <UiText id="try_again_042c862e" />
        </Button>
      </div>
    )
  }

  if (preview.kind === 'image') {
    return stage(
      <>
        {mediaStatus !== 'ready' ? pending(
          mediaStatus === 'error' ? tAuto('preview_could_not_be_loaded_ff921ee1') : undefined,
          mediaStatus === 'error',
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.url}
          alt={preview.item.name}
          onLoad={() => setMediaStatus('ready')}
          onError={() => setMediaStatus('error')}
          className={cn(
            'object-contain transition-opacity duration-300',
            fill ? 'h-auto max-h-full w-auto max-w-full' : 'max-h-[min(70vh,720px)] w-full',
            mediaStatus !== 'ready' && 'opacity-0',
          )}
        />
      </>,
    )
  }

  if (preview.kind === 'video') {
    if (preview.variant === 'stream' || isEmbeddableVideoUrl(preview.url)) {
      return stage(
        <>
          {mediaStatus !== 'ready' ? pending(
            mediaStatus === 'error' ? tAuto('video_could_not_be_loaded_cf16d1c6') : undefined,
            mediaStatus === 'error',
          ) : null}
          <iframe
            ref={streamFrameRef}
            src={preview.url}
            title={preview.item.name}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy={STORAGE_PLAYER_REFERRER_POLICY}
            onLoad={() => {
              registerStreamPlayer()
              setMediaStatus((current) => current === 'loading' ? 'ready' : current)
            }}
            onError={() => setMediaStatus('error')}
            className={cn(
              'absolute inset-0 h-full w-full border-0 bg-black transition-opacity duration-300',
              mediaStatus !== 'ready' && 'opacity-0',
            )}
          />
        </>,
      )
    }

    return stage(
      <>
        {mediaStatus !== 'ready' ? pending(
          mediaStatus === 'error' ? tAuto('video_could_not_be_loaded_cf16d1c6') : undefined,
          mediaStatus === 'error',
        ) : null}
        <video
          ref={setMediaElement}
          controls
          playsInline
          preload="metadata"
          onTimeUpdate={(event) => onTimeUpdate?.(event.currentTarget.currentTime)}
          onLoadedMetadata={() => setMediaStatus('ready')}
          onLoadedData={() => setMediaStatus('ready')}
          onCanPlay={() => setMediaStatus('ready')}
          onError={(event) => {
            if (event.currentTarget.error) setMediaStatus('error')
          }}
          className={cn(
            'h-full w-full bg-black object-contain transition-opacity duration-300',
            mediaStatus !== 'ready' && 'opacity-0',
          )}
        />
      </>,
    )
  }

  if (preview.kind === 'audio') {
    return (
      <StoragePreviewAudioPlayer
        setMediaElement={setMediaElement}
        tone={fill ? 'dark' : 'default'}
        disabled={mediaStatus !== 'ready'}
        loading={mediaStatus === 'loading'}
        errorLabel={mediaStatus === 'error' ? tAuto('audio_could_not_be_loaded_57d9d81b') : undefined}
        onRetry={mediaStatus === 'error' ? () => onRetry(preview.item) : undefined}
        onReady={() => setMediaStatus('ready')}
        onError={() => setMediaStatus('error')}
        onTimeUpdate={onTimeUpdate}
      />
    )
  }

  if (preview.kind === 'text') {
    return stage(
      <>
        {mediaStatus !== 'ready' ? pending(
          mediaStatus === 'error' ? tAuto('text_preview_could_not_be_loaded_3d6eb933') : undefined,
          mediaStatus === 'error',
        ) : null}
        <iframe
          src={preview.url}
          title={preview.item.name}
          sandbox=""
          referrerPolicy="no-referrer"
          onLoad={() => setMediaStatus('ready')}
          onError={() => setMediaStatus('error')}
          className={cn(
            'h-full w-full border-0 bg-black transition-opacity duration-300',
            mediaStatus !== 'ready' && 'opacity-0',
          )}
        />
      </>,
    )
  }

  return (
    <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <FileIcon className="h-9 w-9 text-muted-foreground" />
      <p className="max-w-md text-sm text-muted-foreground"><UiText id="preview_unavailable_for_this_file_type_ca79ab43" /></p>
      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onDownload(preview.item)}>
        <Download className="h-4 w-4" />
        <UiText id="download_a479c9c3" />
      </Button>
    </div>
  )
}

function StoragePreviewAudioPlayer({
  setMediaElement,
  disabled,
  loading,
  errorLabel,
  onRetry,
  onReady,
  onError,
  onTimeUpdate,
  tone = 'default',
}: {
  setMediaElement: (node: HTMLMediaElement | null) => void
  disabled: boolean
  loading: boolean
  errorLabel?: string
  onRetry?: () => void
  onReady: () => void
  onError: () => void
  onTimeUpdate?: (seconds: number) => void
  tone?: 'default' | 'dark'
}) {
  const tAuto = useTranslations('Auto')
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)

  const bindAudio = React.useCallback((node: HTMLAudioElement | null) => {
    audioRef.current = node
    setMediaElement(node)
  }, [setMediaElement])

  const togglePlayback = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio || disabled) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }, [disabled])

  const seekTo = React.useCallback((next: number) => {
    const audio = audioRef.current
    setCurrentTime(next)
    onTimeUpdate?.(next)
    if (audio) audio.currentTime = next
  }, [onTimeUpdate])

  return (
    <div className="px-5 py-6 sm:px-6">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-border/80 bg-muted/30 px-5 py-7">
        <AudioLines className="size-10 text-primary" strokeWidth={1.75} />
        <div className="flex w-full items-center gap-3">
          <Button
            type="button"
            size="icon"
            disabled={disabled}
            aria-label={playing ? tAuto('pause_781961bc') : tAuto('play_5d12bd53')}
            onClick={togglePlayback}
            className="size-12 shrink-0 rounded-full"
          >
            {loading
              ? <Loader2 className="size-5 animate-spin" />
              : playing
                ? <Pause className="size-5 fill-current" />
                : <Play className="ml-0.5 size-5 fill-current" />}
          </Button>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Slider
              min={0}
              max={Math.max(duration, 0.001)}
              step={0.1}
              value={[Math.min(currentTime, duration || 0)]}
              disabled={disabled || duration <= 0}
              onValueChange={(value) => seekTo(value[0] ?? 0)}
            />
            <div className="flex justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
              <span>{formatTranscriptDuration(currentTime)}</span>
              <span>{formatTranscriptDuration(duration)}</span>
            </div>
          </div>
        </div>
        {errorLabel ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-destructive">{errorLabel}</p>
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" />
                <UiText id="try_again_042c862e" />
              </Button>
            ) : null}
          </div>
        ) : null}
        <audio
          ref={bindAudio}
          preload="metadata"
          className="sr-only"
          tabIndex={-1}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={(event) => {
            setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
            onReady()
          }}
          onCanPlay={onReady}
          onTimeUpdate={(event) => {
            const seconds = event.currentTarget.currentTime
            setCurrentTime(seconds)
            onTimeUpdate?.(seconds)
          }}
          onError={(event) => {
            if (event.currentTarget.error) onError()
          }}
        />
      </div>
    </div>
  )
}

function StoragePreviewPending({
  label,
  error,
  onRetry,
  className,
  cinema,
}: {
  label?: string
  error?: boolean
  onRetry?: () => void
  className?: string
  cinema?: boolean
}) {
  const tAuto = useTranslations('Auto')
  return (
    <div className={cn(
      'flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center',
      cinema ? 'min-h-0 bg-transparent text-white/70' : 'bg-muted/30 text-muted-foreground',
      className,
    )}>
      {error ? (
        <XCircle className="h-7 w-7 text-destructive" />
      ) : (
        <span role="status" aria-label={tAuto('loading_preview_52816ebc')} className="relative flex h-8 w-8 items-center justify-center">
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-0 animate-spin rounded-full border-2 motion-reduce:animate-none',
              cinema ? 'border-white/20 border-t-white' : 'border-muted-foreground/20 border-t-primary',
            )}
          />
        </span>
      )}
      {label ? <p className={cn('text-sm', error && 'text-destructive')}>{label}</p> : null}
      {error && onRetry ? (
        <Button type="button" variant="outline" size="sm" className={cn('rounded-xl', cinema && 'border-white/20 bg-white/10 text-white hover:bg-white/16 hover:text-white')} onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          <UiText id="try_again_042c862e" /></Button>
      ) : null}
    </div>
  )
}

function getStorageProcessingPresentation(item: StorageObjectItem) {
  const mimeType = item.mime_type?.toLowerCase() ?? ''
  const extension = item.extension?.toLowerCase() ?? ''
  const kind = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic'].includes(extension)
    ? 'image'
    : mimeType.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus'].includes(extension)
      ? 'audio'
      : mimeType.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'].includes(extension)
        ? 'video'
        : mimeType.startsWith('text/')
          || mimeType.includes('pdf')
          || mimeType.includes('document')
          || ['pdf', 'txt', 'md', 'rtf', 'doc', 'docx', 'csv', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)
          ? 'document'
          : 'file'
  const mediaLabel = kind === 'file' ? 'File' : `${kind[0]?.toUpperCase()}${kind.slice(1)}`

  if (!item.transfer_complete || item.readiness_reason === 'upload_incomplete') {
    return {
      phase: 'transfer' as const,
      kind,
      mediaLabel,
      uploadReceived: false,
      title: `${mediaLabel} upload is waiting`,
      detail: 'The file transfer has not completed yet. Retry the upload if it does not resume.',
    }
  }
  if (item.security_status === 'pending' || item.readiness_reason === 'malware_scan_pending') {
    return {
      phase: 'security' as const,
      kind,
      mediaLabel,
      uploadReceived: true,
      title: `${mediaLabel} is being checked`,
      detail: 'The upload is complete and its security check is still running.',
    }
  }
  if (kind === 'video' && (!item.playback_ready || !item.adaptive_ready)) {
    return {
      phase: 'video' as const,
      kind,
      mediaLabel,
      uploadReceived: true,
      title: 'Video is processing',
      detail: 'The original video is safe, but the player-ready stream is still being prepared.',
    }
  }
  return {
    phase: 'processing' as const,
    kind,
    mediaLabel,
    uploadReceived: true,
    title: `${mediaLabel} is processing`,
    detail: 'The uploaded file is still being prepared for preview.',
  }
}

function getStorageProcessingTerminalError(item: StorageObjectItem) {
  if (item.status === 'quarantined') return 'This upload was blocked by the security check.'
  if (item.status === 'deleted') return 'This file was deleted while its preview was being prepared.'
  return 'Upload processing failed. Retry the upload or choose another file.'
}

function StorageMediaProcessingState({ item }: { item: StorageObjectItem }) {
  const t = useTranslations('Storage')
  const presentation = getStorageProcessingPresentation(item)
  return (
    <StoragePreviewPending
      cinema
      className="h-full min-h-[240px] w-full"
      label={t(`preparing.${presentation.kind}`)}
    />
  )
}

function ConfirmDeleteDialog({
  open,
  items,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  items: StorageObjectItem[]
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const fileCount = items.filter((item) => item.type === 'file').length
  const folderCount = items.filter((item) => item.type === 'folder').length
  const itemCount = items.length
  const title = itemCount === 1 ? `Delete ${items[0]?.type ?? 'item'}?` : `Delete ${itemCount} items?`

  return (
    <AppAlertDialog
      open={open}
      title={title}
      description={formatDeleteDialogDescription({ itemCount, fileCount, folderCount })}
      cancelLabel="Cancel"
      confirmLabel="Delete"
      confirmVariant="destructive"
      tone="destructive"
      busy={busy}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    >
      <div className="space-y-3">
        {items.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-2">
            <div className="space-y-1">
              {items.slice(0, 4).map((item) => (
                <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  {item.type === 'folder' ? (
                    <StorageFolderGlyph className="h-5 w-6 shrink-0" />
                  ) : (
                    <FilePreviewIcon item={item} className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
            {items.length > 4 && (
              <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">+{items.length - 4} {' '}<UiText id="more_item_s_99ddec75" /></p>
            )}
          </div>
        )}
        {folderCount > 0 && (
          <div className="rounded-md border border-[#FEDF89] bg-[#FFFAEB] px-3 py-2 text-xs leading-5 text-[#7A5A00] dark:border-[#7F5F01] dark:bg-[#332E1B] dark:text-[#F5CD47]">
            <UiText id="folders_must_be_empty_before_they_can_be_deleted_c95d32ac" /></div>
        )}
      </div>
    </AppAlertDialog>
  )
}

function CreateFolderDialog({
  open,
  busy,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
}) {
  const tAuto = useTranslations('Auto')
  const [name, setName] = React.useState('')

  React.useEffect(() => {
    if (!open) setName('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-md">
        <DialogHeader>
          <DialogTitle><UiText id="create_folder_97bafaba" /></DialogTitle>
          <DialogDescription className="sr-only">
            <UiText id="create_a_folder_in_the_current_storage_location_401b99d0" /></DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim() || busy) return
            onSubmit(name.trim())
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={tAuto('folder_name_b2ce023b')}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <UiText id="cancel_77dfd213" /></Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              <UiText id="create_6e157c5d" /></Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameItemDialog({
  open,
  item,
  busy,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  item: StorageObjectItem | null
  busy: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
}) {
  const tAuto = useTranslations('Auto')
  const [name, setName] = React.useState(item?.name ?? '')
  const trimmedName = name.trim()
  const unchanged = Boolean(item && trimmedName === item.name)

  React.useEffect(() => {
    if (open) setName(item?.name ?? '')
  }, [item?.id, item?.name, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-md">
        <DialogHeader>
          <DialogTitle><UiText id="rename_item_f3576748" /></DialogTitle>
          <DialogDescription className="sr-only">
            <UiText id="rename_the_selected_storage_item_ef272200" /></DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!item || !trimmedName || unchanged || busy) return
            onSubmit(trimmedName)
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={tAuto('item_name_b56b71bb')}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <UiText id="cancel_77dfd213" /></Button>
            <Button type="submit" disabled={!item || !trimmedName || unchanged || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              <UiText id="rename_d3f4cb89" /></Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MoveItemsDialog({
  open,
  channelId,
  busy,
  error,
  items,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  channelId: string | null
  busy: boolean
  error: string | null
  items: StorageObjectItem[]
  onOpenChange: (open: boolean) => void
  onSubmit: (parentPath?: string) => void
}) {
  const tAuto = useTranslations('Auto')
  const [pickerPath, setPickerPath] = React.useState('')
  const listInput = React.useMemo(() => ({
    parentPath: pickerPath || undefined,
    limit: 100,
    offset: 0,
  }), [pickerPath])
  const foldersQuery = useQuery({
    queryKey: storageObjectsQueryKey(channelId, listInput),
    queryFn: () => listStorageObjects(channelId!, listInput),
    enabled: open && Boolean(channelId),
    staleTime: 30_000,
    retry: false,
  })
  const folders = React.useMemo(
    () => (foldersQuery.data?.data ?? []).filter((item) => item.type === 'folder'),
    [foldersQuery.data],
  )
  const invalidTarget = isInvalidMoveTarget(items, pickerPath)
  const alreadyInTarget = areAllItemsAlreadyInTarget(items, pickerPath)

  React.useEffect(() => {
    if (!open) setPickerPath('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-md sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle><UiText id="move_items_522fba6c" /></DialogTitle>
          <DialogDescription className="sr-only">
            <UiText id="move_selected_storage_items_to_another_folder_205c8ee3" /></DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (busy || invalidTarget || alreadyInTarget) return
            onSubmit(pickerPath)
          }}
        >
          <div className="rounded-md border border-border bg-background">
            <div className="border-b border-border px-3 py-2">
              <StorageBreadcrumb path={pickerPath} onNavigate={setPickerPath} />
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2">
              {pickerPath && (
                <button
                  type="button"
                  className="mb-1 flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
                  onClick={() => setPickerPath(parentPathOf(pickerPath))}
                >
                  <ArrowUp className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate"><UiText id="folder_up_522cd05a" /></span>
                </button>
              )}
              {foldersQuery.isLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : foldersQuery.error instanceof Error ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-destructive">
                  {foldersQuery.error.message}
                </div>
              ) : folders.length > 0 ? (
                <div className="space-y-1">
                  {folders.map((folder) => {
                    const disabled = isInvalidMoveTarget(items, folder.path)
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        className={cn(
                          'flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45',
                          pickerPath === folder.path && 'bg-muted',
                        )}
                        disabled={disabled}
                        onClick={() => setPickerPath(folder.path)}
                      >
                        <Folder className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                  <UiText id="no_folders_9415d841" /></div>
              )}
            </div>
          </div>
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{items.length} {' '}<UiText id="item_s_c0e2ec82" /></span>
            <span className={cn('max-w-full truncate', invalidTarget && 'text-destructive')}>
              {alreadyInTarget ? tAuto('already_here_5ce1f7f8') : pickerPath || tAuto('root_e96857c5')}
            </span>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <UiText id="cancel_77dfd213" /></Button>
            <Button type="submit" disabled={busy || invalidTarget || alreadyInTarget || !channelId}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              <UiText id="move_76cdb950" /></Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NoChannelState() {
  return <WorkspaceChannelRequired compact />
}

function StorageSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-2 rounded-md border border-border bg-background p-3">
        {[0, 1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-10 w-full rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(168px,100%),180px))] gap-2.5">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <Skeleton key={item} className="aspect-[4/3] rounded-md" />
      ))}
    </div>
  )
}

function FilePreviewIcon({
  item,
  className,
}: {
  item: StorageObjectItem
  className?: string
}) {
  if (item.mime_type?.startsWith('image/')) return <ImageIcon className={className} />
  if (item.mime_type?.startsWith('video/')) return <Play className={className} />
  if (isStorageAudioItem(item)) return <AudioLines className={className} />
  return <FileIcon className={className} />
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let nextIndex = 0
  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex]
      nextIndex += 1
      if (item === undefined) return
      await worker(item)
    }
  }))
}

function createUploadProgressReporter(
  taskId: string,
  updateTask: (taskId: string, patch: Partial<UploadTask>) => void,
) {
  let frame: number | null = null
  let latestProgress = 0
  let emittedProgress = 0

  const flush = () => {
    frame = null
    if (latestProgress <= emittedProgress && latestProgress < 99) return
    emittedProgress = latestProgress
    updateTask(taskId, { progress: latestProgress })
  }

  return {
    report(progress: number) {
      const normalized = Math.max(2, Math.min(Math.round(progress), 99))
      latestProgress = Math.max(latestProgress, normalized)
      if (latestProgress - emittedProgress < 2 && latestProgress < 99) return
      if (frame !== null) return
      frame = window.requestAnimationFrame(flush)
    },
    dispose() {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = null
      if (latestProgress > emittedProgress) {
        emittedProgress = latestProgress
        updateTask(taskId, { progress: latestProgress })
      }
    },
  }
}

async function recoverProxyUploadCompletion(input: {
  channelId: string
  uploadSessionId: string
  signal?: AbortSignal
}, retryDelaysMs: number[], onRecovered?: (result: Awaited<ReturnType<typeof completeStorageUpload>>) => void | Promise<void>) {
  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) await sleep(delayMs, input.signal)
    if (input.signal) throwIfUploadCancelled(input.signal)
    try {
      const result = await completeStorageUpload(input)
      await onRecovered?.(result)
      return result
    } catch {
      // The content request may still be finishing server-side after a proxy/network break.
    }
  }
  return null
}

function isLikelyUploadFinalizeBreak(error: unknown, lastProgress: number) {
  if (!(error instanceof Error)) return lastProgress >= 90
  const status = 'status' in error && typeof error.status === 'number'
    ? error.status
    : null
  return lastProgress >= 90 && (status === null || status === 0 || status >= 500)
}

function isUploadAbortError(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'STORAGE_UPLOAD_ABORTED'
}

function throwIfUploadCancelled(signal: AbortSignal) {
  if (signal.aborted) {
    throw new Error('Upload cancelled.')
  }
}

function limitUploadTasks(tasks: UploadTask[]) {
  const activeTasks = tasks.filter(isUploadTaskActive)
  const settledTasks = tasks.filter((task) => !isUploadTaskActive(task))
  return [...activeTasks, ...settledTasks.slice(0, Math.max(0, UPLOAD_HISTORY_LIMIT - activeTasks.length))]
}

function orderUploadTasks(tasks: UploadTask[]) {
  return [
    ...tasks.filter(isUploadTaskActive),
    ...tasks.filter((task) => !isUploadTaskActive(task)),
  ]
}

function isUploadTaskActive(task: UploadTask) {
  return task.status === 'queued'
    || task.status === 'preparing'
    || task.status === 'uploading'
    || task.status === 'processing'
}

function isUploadTaskInScope(
  task: UploadTask,
  principalId: string | null,
  channelId: string | null,
) {
  return Boolean(principalId && channelId)
    && task.principalId === principalId
    && task.channelId === channelId
}

function isUploadTaskCancelable(task: UploadTask) {
  return task.status === 'queued' || task.status === 'preparing' || task.status === 'uploading'
}

function isUploadTaskSettledStatus(status: UploadTaskStatus) {
  return status === 'complete' || status === 'failed' || status === 'cancelled'
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, value])

  return debouncedValue
}

async function createPreviewMetadata(file: File, policy: {
  batchSize: number
}): Promise<StoragePreviewInput | null> {
  if (!shouldCreateClientPreview(file, policy)) return null
  if (file.type.startsWith('image/')) return createImagePreview(file)
  if (file.type.startsWith('video/')) return createVideoPreview(file)
  return null
}

async function createImagePreview(file: File): Promise<StoragePreviewInput | null> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const { dataUrl, width, height } = await drawPreview(image, 320, 320)
    return {
      source: 'client_generated',
      kind: 'image',
      data_url: dataUrl,
      width,
      height,
      duration_seconds: null,
      generated_at: new Date().toISOString(),
    }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function createVideoPreview(file: File): Promise<StoragePreviewInput | null> {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = objectUrl

  try {
    await waitForEvent(video, 'loadedmetadata', 6000)
    if (video.readyState < 2) {
      await waitForEvent(video, 'loadeddata', 6000).catch(() => undefined)
    }
    const previewTime = getVideoPreviewTime(video.duration)
    if (previewTime > 0.05) {
      video.currentTime = previewTime
      await waitForEvent(video, 'seeked', 6000).catch(() => undefined)
    }
    const { dataUrl, width, height } = await drawPreview(video, 320, 180)
    const durationSeconds = Number.isFinite(video.duration) && video.duration > 0
      ? Math.max(1, Math.round(video.duration))
      : null
    return {
      source: 'client_generated',
      kind: 'video',
      data_url: dataUrl,
      width,
      height,
      duration_seconds: durationSeconds,
      generated_at: new Date().toISOString(),
    }
  } catch {
    return null
  } finally {
    cleanupMediaElement(video)
    URL.revokeObjectURL(objectUrl)
  }
}

function getVideoPreviewTime(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0.25
  if (duration <= 1) return Math.max(0, duration / 2)
  return Math.min(Math.max(duration * 0.2, 0.5), 2)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function waitForEvent(target: HTMLMediaElement, eventName: string, timeoutMs = 3000) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout)
      target.removeEventListener(eventName, handleEvent)
      target.removeEventListener('error', handleError)
    }
    const handleEvent = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('Preview failed'))
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Preview timeout'))
    }, timeoutMs)
    target.addEventListener(eventName, handleEvent, { once: true })
    target.addEventListener('error', handleError, { once: true })
  })
}

async function drawPreview(source: CanvasImageSource, maxWidth: number, maxHeight: number) {
  const sourceWidth = getSourceWidth(source)
  const sourceHeight = getSourceHeight(source)
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1)
  const baseWidth = Math.max(1, Math.round(sourceWidth * scale))
  const baseHeight = Math.max(1, Math.round(sourceHeight * scale))
  const attempts = [
    { size: 1, quality: 0.82, type: 'image/webp' },
    { size: 1, quality: 0.72, type: 'image/webp' },
    { size: 1, quality: 0.72, type: 'image/jpeg' },
    { size: 0.9, quality: 0.68, type: 'image/webp' },
    { size: 0.8, quality: 0.64, type: 'image/jpeg' },
    { size: 0.7, quality: 0.58, type: 'image/jpeg' },
  ]

  let fallback: { dataUrl: string; width: number; height: number } | null = null
  for (const attempt of attempts) {
    const width = Math.max(1, Math.round(baseWidth * attempt.size))
    const height = Math.max(1, Math.round(baseHeight * attempt.size))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(source, 0, 0, width, height)
    const dataUrl = await canvasToDataUrl(canvas, attempt.type, attempt.quality)
    fallback = { dataUrl, width, height }
    if (dataUrl.length <= PREVIEW_DATA_URL_MAX_LENGTH) return fallback
  }

  if (fallback) throw new Error('Preview exceeds metadata limit')
  throw new Error('Preview unavailable')
}

function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Preview encoding failed'))
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('Preview encoding failed'))
      }
      reader.onerror = () => reject(new Error('Preview encoding failed'))
      reader.readAsDataURL(blob)
    }, type, quality)
  })
}

function shouldCreateClientPreview(file: File, policy: { batchSize: number }) {
  if (policy.batchSize > PREVIEW_MAX_BATCH_SIZE) return false
  if (file.type.startsWith('image/')) return file.size <= PREVIEW_MAX_IMAGE_BYTES
  if (file.type.startsWith('video/')) {
    return policy.batchSize <= PREVIEW_MAX_VIDEO_BATCH_SIZE
      && file.size <= PREVIEW_MAX_VIDEO_BYTES
  }
  return false
}

function isStorageThumbnailCandidate(item: StorageObjectItem) {
  const mimeType = item.mime_type?.trim().toLowerCase() ?? ''
  return item.type === 'file'
    && (item.status === 'active' || item.status === 'processing')
    && (mimeType.startsWith('image/') || mimeType.startsWith('video/'))
}

function isStorageVisualMediaItem(item: StorageObjectItem) {
  return isStorageThumbnailCandidate(item) || isStorageGifItem(item)
}

function isStorageGifItem(item: StorageObjectItem) {
  return item.type === 'file' && isStorageGifPreview({
    mimeType: item.mime_type,
    extension: item.extension,
    name: item.name,
  })
}

function getStoragePreviewMediaStateKey(preview: StoragePreviewDialogState) {
  return JSON.stringify([preview.item.id, preview.url, preview.kind, preview.variant, preview.status])
}

function cleanupMediaElement(media: HTMLMediaElement) {
  media.pause()
  media.removeAttribute('src')
  media.load()
}

function attachStorageMediaSource(media: HTMLMediaElement, source: string) {
  media.setAttribute('src', source)
  media.load()
  return () => cleanupMediaElement(media)
}

function getStorageMediaTimeoutStatus(current: StoragePreviewMediaStatus): StoragePreviewMediaStatus {
  return current === 'loading' ? 'error' : current
}

function getStorageListInput(input: {
  assetView: StorageAssetView
  currentPath: string
  search: string
  voiceAssetFilter: VoiceAssetFilter
}): StorageListInput {
  const search = input.search.trim() || undefined

  if (input.assetView === 'default') {
    return {
      parentPath: input.currentPath || undefined,
      search,
      scope: 'children',
      sortBy: 'name',
      sortOrder: 'asc',
    }
  }

  const base: StorageListInput = {
    type: 'file',
    scope: 'descendants',
    search,
    sortBy: 'created_at',
    sortOrder: 'desc',
  }

  if (input.assetView === 'avatar') {
    return {
      ...base,
      assetRoles: [...STORAGE_AVATAR_ASSET_ROLES],
    }
  }
  if (input.assetView === 'voice') {
    return {
      ...base,
      category: 'audio',
      assetRoles: getStorageVoiceAssetRoles(input.voiceAssetFilter),
    }
  }
  if (input.assetView === 'image') return { ...base, category: 'image' }
  if (input.assetView === 'video') return { ...base, category: 'video' }
  if (input.assetView === 'clip') {
    return { ...base, category: 'video', sourceTool: 'viral_clips@1' }
  }
  if (input.assetView === 'document') return { ...base, category: 'document' }
  return base
}

function getStorageAssetViewModel(view: StorageAssetView) {
  return STORAGE_ASSET_VIEW_MODELS.find((item) => item.id === view) ?? STORAGE_ASSET_VIEW_MODELS[0]!
}

function filterStorageItemsForAssetSearch(
  items: StorageObjectItem[],
  view: StorageAssetView,
  search: string,
) {
  const query = search.trim().toLowerCase()
  return items.filter((item) => (
    storageItemMatchesAssetView(item, view)
    && (!query || storageItemMatchesSearch(item, query))
  ))
}

function getStorageVoiceAssetRoles(filter: VoiceAssetFilter): StorageAssetRole[] {
  if (filter === 'generated') return ['generated_speech']
  if (filter === 'reference') return ['voice_reference']
  return ['generated_speech', 'voice_reference', 'voice_preview']
}

function getStorageVoiceAssetKind(item: StorageObjectItem): StorageVoiceAssetKind {
  const assetKind = (
    item.asset_role
    ?? getStorageMetadataString(item, 'asset_kind')
    ?? getStorageMetadataString(item, 'asset_role')
    ?? getStorageMetadataString(item, 'role')
    ?? ''
  ).toLowerCase()
  const originNodeType = (getStorageMetadataString(item, 'origin_node_type') ?? '').toLowerCase()

  if (assetKind === 'generated_speech' || originNodeType.startsWith('speech_generate@')) {
    return 'generated'
  }
  if (['voice_reference', 'reference_recording', 'voice_clone_reference'].includes(assetKind)) {
    return 'reference'
  }
  if (assetKind === 'voice_preview') return 'preview'
  return 'audio'
}

function getStorageVoiceAction(item: StorageObjectItem) {
  if (item.type !== 'file' || !isStorageAudioItem(item)) return null
  const kind = getStorageVoiceAssetKind(item)
  const voiceProfileId = getOpaqueVoiceRouteParam(item.voice_profile_id)
    ?? getOpaqueVoiceRouteParam(getStorageMetadataString(item, 'voice_profile_id'))

  if (kind === 'generated' || kind === 'preview') {
    return voiceProfileId
      ? { labelKey: 'voiceActions.create', toolId: 'speech-generate', param: 'voice_profile_id', value: voiceProfileId }
      : null
  }
  return {
    labelKey: kind === 'reference' ? 'voiceActions.clone' : 'voiceActions.reference',
    toolId: 'voice-clone',
    param: 'reference_storage_object_id',
    value: item.id,
  }
}

function getStorageVoiceToolHref(item: StorageObjectItem) {
  const action = getStorageVoiceAction(item)
  if (!action) return null
  const params = new URLSearchParams({ tool: action.toolId, [action.param]: action.value })
  if (action.toolId === 'speech-generate') {
    const publicModelId = getOpaqueVoiceRouteParam(getStorageMetadataString(item, 'public_model_id'))
    const language = getCanonicalVoiceLanguageRouteParam(getStorageMetadataString(item, 'language'))
    if (publicModelId) params.set('model', publicModelId)
    if (language) params.set('language', language)
  }
  return `/tools?${params.toString()}`
}

export const __storagePageTestHooks = {
  attachStorageMediaSource,
  getStorageMediaTimeoutStatus,
  getStorageListInput,
  getStoragePreviewMediaStateKey,
  isStorageThumbnailCandidate,
  isStorageAvatarAsset,
  filterStorageItemsForAssetSearch,
  avatarsToDeliveryItems,
  groupMagicClipItems,
  getStorageVoiceAction,
  getStorageVoiceToolHref,
  getStorageProcessingPresentation,
  isStorageFileOpenable,
  getStorageProcessingTerminalError,
  getMediaTranscriptAgentPollInterval,
  getMediaTranscriptArtifactsPollInterval,
  isMediaTranscriptArtifactPollingStale,
  isUploadTaskInScope,
  getStorageMemoryAction,
  addUploadTasks: (tasks: UploadTask[]) => useUploadTaskStore.getState().addTasks(tasks),
  purgeUploadTasks: () => useUploadTaskStore.getState().purgeTasks(),
  getUploadTasks: () => useUploadTaskStore.getState().tasks,
}

function formatSchemaLikeLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function storageItemMatchesAssetView(item: StorageObjectItem, view: StorageAssetView) {
  if (view === 'default') return !isStorageAvatarAsset(item)
  if (item.type !== 'file') return false
  if (view !== 'avatar' && isStorageAvatarAsset(item)) return false

  if (view === 'avatar') return isStorageAvatarAsset(item)
  if (view === 'voice') return isStorageVoiceAsset(item)
  if (view === 'image') return item.mime_type?.startsWith('image/') || IMAGE_PREVIEW_EXTENSIONS.has(getStorageItemExtension(item))
  if (view === 'video') return item.mime_type?.startsWith('video/') || VIDEO_PREVIEW_EXTENSIONS.has(getStorageItemExtension(item))
  if (view === 'clip') return isMagicClipStorageItem(item)
  if (view === 'document') return DOCUMENT_PREVIEW_EXTENSIONS.has(getStorageItemExtension(item)) || item.mime_type?.startsWith('text/')

  return true
}

function isStorageAvatarAsset(item: StorageObjectItem) {
  const assetKind = (
    item.asset_role
    ?? getStorageMetadataString(item, 'asset_kind')
    ?? getStorageMetadataString(item, 'asset_role')
    ?? getStorageMetadataString(item, 'role')
    ?? ''
  ).toLowerCase()
  const originNodeType = (getStorageMetadataString(item, 'origin_node_type') ?? '').toLowerCase()

  return Boolean(
    isIndexedStorageAvatarRole(assetKind)
    || originNodeType.startsWith('angle@')
    || originNodeType.includes('avatar')
    || storageItemHasAssetTerm(item, ['avatar', 'avatars']),
  )
}

function isStorageAudioItem(item: StorageObjectItem) {
  return item.mime_type?.startsWith('audio/')
    || AUDIO_PREVIEW_EXTENSIONS.has(getStorageItemExtension(item))
}

function isMagicClipStorageItem(item: StorageObjectItem) {
  const sourceTool = getStorageMetadataString(item, 'source_tool')
  return (
    item.mime_type?.startsWith('video/')
    || VIDEO_PREVIEW_EXTENSIONS.has(getStorageItemExtension(item))
  ) && (sourceTool === 'viral_clips@1' || sourceTool === 'magic_clips@1')
}

function isStorageVoiceAsset(item: StorageObjectItem) {
  if (!isStorageAudioItem(item)) return false
  const assetKind = (
    item.asset_role
    ?? getStorageMetadataString(item, 'asset_kind')
    ?? getStorageMetadataString(item, 'asset_role')
    ?? getStorageMetadataString(item, 'role')
    ?? ''
  ).toLowerCase()
  const originNodeType = (getStorageMetadataString(item, 'origin_node_type') ?? '').toLowerCase()
  const voiceProfileId = item.voice_profile_id ?? getStorageMetadataString(item, 'voice_profile_id')

  return Boolean(
    voiceProfileId
    || [
      'generated_speech',
      'voice_reference',
      'reference_recording',
      'voice_clone_reference',
      'voice_preview',
      'localized_speech',
      'dubbed_speech',
    ].includes(assetKind)
    || /^(speech_generate|voice_clone|voice_design|voice_convert|speech_localize|audio_dub)@/.test(originNodeType)
    || storageItemHasAssetTerm(item, ['voice', 'voiceover', 'tts', 'speech', 'narration']),
  )
}

function storageItemHasAssetTerm(item: StorageObjectItem, terms: string[]) {
  const values = getStorageAssetSearchValues(item)
  return terms.some((term) => values.some((value) => value.includes(term)))
}

function storageItemMatchesSearch(item: StorageObjectItem, query: string) {
  const values = getStorageAssetSearchValues(item)
  return values.some((value) => value.includes(query))
}

function getStorageAssetSearchValues(item: StorageObjectItem) {
  return [
    item.name,
    item.path,
    item.mime_type ?? '',
    item.extension ?? '',
    item.asset_role ?? '',
    item.voice_profile_id ?? '',
    getStorageMetadataString(item, 'title') ?? '',
    getStorageMetadataString(item, 'asset_type') ?? '',
    getStorageMetadataString(item, 'asset_kind') ?? '',
    getStorageMetadataString(item, 'asset_role') ?? '',
    getStorageMetadataString(item, 'assetType') ?? '',
    getStorageMetadataString(item, 'category') ?? '',
    getStorageMetadataString(item, 'kind') ?? '',
    getStorageMetadataString(item, 'role') ?? '',
    getStorageMetadataString(item, 'tool') ?? '',
    getStorageMetadataString(item, 'source_tool') ?? '',
    getStorageMetadataString(item, 'storage_group_source_object_id') ?? '',
    getStorageMetadataString(item, 'storage_group_run_id') ?? '',
  ].map((value) => value.toLowerCase())
}

function getStorageAssetEmptyTitleKey(view: StorageAssetView) {
  switch (view) {
    case 'avatar':
      return 'empty.avatar'
    case 'voice':
      return 'empty.voice'
    case 'image':
      return 'empty.images'
    case 'video':
      return 'empty.videos'
    case 'clip':
      return 'empty.clips'
    case 'document':
      return 'empty.documents'
    case 'default':
    default:
      return 'empty.files'
  }
}

function getSourceWidth(source: CanvasImageSource) {
  if ('videoWidth' in source) return source.videoWidth || 320
  if ('naturalWidth' in source) return source.naturalWidth || 320
  if ('width' in source && typeof source.width === 'number') return source.width || 320
  return 320
}

function getSourceHeight(source: CanvasImageSource) {
  if ('videoHeight' in source) return source.videoHeight || 180
  if ('naturalHeight' in source) return source.naturalHeight || 180
  if ('height' in source && typeof source.height === 'number') return source.height || 180
  return 180
}

function parentPathOf(path: string) {
  const segments = path.split('/').filter(Boolean)
  segments.pop()
  return segments.join('/')
}

function isInvalidMoveTarget(items: StorageObjectItem[], targetPath: string) {
  if (!targetPath) return false
  return items.some((item) => (
    item.type === 'folder'
    && (targetPath === item.path || targetPath.startsWith(`${item.path}/`))
  ))
}

function areAllItemsAlreadyInTarget(items: StorageObjectItem[], targetPath: string) {
  if (items.length === 0) return false
  return items.every((item) => parentPathOf(item.path) === targetPath)
}

function formatBytes(value: number, format?: StorageFormatter) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** index
  const maximumFractionDigits = amount >= 10 || index === 0 ? 0 : 1
  const number = format ? format.number(amount, { maximumFractionDigits }) : amount.toFixed(maximumFractionDigits)
  return `${number} ${units[index]}`
}

function getStorageUsageDisplay(
  channelUsage: StorageUsage | null,
  aggregateUsage: StorageUsageAggregate | null,
  format: StorageFormatter,
  t: StorageTranslator,
): StorageUsageDisplay {
  const currentBytes = getStorageCurrentBytes(channelUsage, aggregateUsage)
  const pendingBytes = getStoragePendingBytes(channelUsage, aggregateUsage)
  const includedBytes = getStorageIncludedBytes(aggregateUsage)
  const visibleUsageBytes = currentBytes + pendingBytes

  if (includedBytes && includedBytes > 0) {
    return {
      label: `${formatBytes(visibleUsageBytes, format)} / ${formatBytes(includedBytes, format)}`,
      title: t('usage.plan', { used: formatBytes(visibleUsageBytes, format), total: formatBytes(includedBytes, format) }),
    }
  }

  return {
    label: formatBytes(visibleUsageBytes, format),
    title: t('usage.storage', { used: formatBytes(visibleUsageBytes, format) }),
  }
}

function getStorageCurrentBytes(
  channelUsage: StorageUsage | null,
  aggregateUsage: StorageUsageAggregate | null,
) {
  return parseStorageByteCount(aggregateUsage?.used_bytes)
    ?? parseStorageByteCount(channelUsage?.used_bytes)
    ?? 0
}

function getStoragePendingBytes(
  channelUsage: StorageUsage | null,
  aggregateUsage: StorageUsageAggregate | null,
) {
  return parseStorageByteCount(aggregateUsage?.pending_upload_bytes)
    ?? parseStorageByteCount(channelUsage?.pending_upload_bytes)
    ?? 0
}

function getStorageIncludedBytes(aggregateUsage: StorageUsageAggregate | null) {
  return parseStorageByteCount(aggregateUsage?.included_storage_bytes)
}

function formatDateTime(value: string, format: StorageFormatter) {
  return format.dateTime(new Date(value), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStoragePreviewKind(item: StorageObjectItem): StoragePreviewKind {
  const mimeType = item.mime_type?.toLowerCase() ?? ''
  const extension = getStorageItemExtension(item)

  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('text/')) return 'text'
  if (TEXT_PREVIEW_EXTENSIONS.has(extension)) return 'text'
  return 'unsupported'
}

function getStorageItemExtension(item: StorageObjectItem) {
  const explicitExtension = item.extension?.toLowerCase().replace(/^\./, '')
  if (explicitExtension) return explicitExtension
  const match = item.name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
}

function isEmbeddableVideoUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'iframe.mediadelivery.net' || hostname.endsWith('.mediadelivery.net')
  } catch {
    return false
  }
}

function isStorageFileOpenable(item: StorageObjectItem) {
  return item.type === 'file'
    && item.status !== 'deleted'
    && item.status !== 'failed'
    && item.status !== 'quarantined'
    && (!isStorageItemProcessing(item) || isStoragePreviewMedia(item) || getStoragePreviewKind(item) === 'image')
}

function isStorageItemProcessing(item: StorageObjectItem) {
  if (item.status === 'failed' || item.status === 'quarantined' || item.status === 'deleted') return false
  if (item.original_ready || isStorageOriginalPreviewReady(item)) return false
  return item.type === 'file'
    && (
      item.status === 'processing'
      || isStorageItemPendingSecurity(item)
      || (isStoragePreviewMedia(item) && !item.playback_ready)
    )
}

function isStorageItemPendingSecurity(item: StorageObjectItem) {
  return item.type === 'file'
    && item.transfer_complete
    && item.integrity_verified
    && item.security_status === 'pending'
    && item.readiness_reason === 'malware_scan_pending'
}

function isStoragePreviewMedia(item: StorageObjectItem) {
  return item.type === 'file'
    && (item.mime_type?.startsWith('video/') || item.mime_type?.startsWith('audio/'))
}

function isStorageWorkflowMediaReady(item: StorageObjectItem) {
  return item.type === 'file'
    && item.original_ready
    && item.workflow_ready
    && item.status !== 'failed'
    && item.status !== 'quarantined'
    && item.status !== 'deleted'
}

function isStorageStreamVideo(item: StorageObjectItem) {
  return item.type === 'file'
    && (
      item.delivery_variant === 'stream'
      || item.provider_kind === 'stream'
      || item.storage_key.startsWith('stream/')
    )
}

function getStoragePreviewDeliveryVariant(item: StorageObjectItem): 'original' | undefined {
  return isStorageStreamVideo(item) && !item.playback_ready && isBrowserPlayableStreamOriginal(item)
    ? 'original'
    : undefined
}

function isStorageOriginalPreviewReady(item: StorageObjectItem) {
  return isStoragePreviewMedia(item)
    && item.original_ready
    && item.workflow_ready
    && (!isStorageStreamVideo(item) || isBrowserPlayableStreamOriginal(item))
}

function getStorageMetadataString(item: StorageObjectItem, key: string) {
  const value = item.metadata[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function getStorageItemBadge(item: StorageObjectItem, isDeleting: boolean, t: StorageTranslator) {
  if (isDeleting) return { label: t('status.deleting'), tone: 'deleting' as const }
  if (item.type !== 'file') return null
  if (item.status === 'failed') return { label: t('status.failed'), tone: 'failed' as const }
  if (item.status === 'quarantined' || item.security_status === 'rejected') return { label: t('status.blocked'), tone: 'blocked' as const }
  if (isStorageReadinessPending(item)) return { label: t(`preparing.${getStorageProcessingPresentation(item).kind}`), tone: 'processing' as const }
  if (isStorageOriginalPreviewReady(item) && !item.adaptive_ready) return { label: t('status.originalReady'), tone: 'complete' as const }
  if (isStorageItemProcessing(item)) return { label: t('status.processing'), tone: 'processing' as const }
  return null
}

function getStorageMemoryBadge(item: StorageObjectItem, t: StorageTranslator): StorageStatusBadgeModel | null {
  if (item.type !== 'file') return null
  if (item.memory_status === 'added') return { label: t('status.memory'), tone: 'complete' }
  if (item.memory_status === 'queued') return { label: t('status.memoryPending'), tone: 'queued' }
  if (item.memory_status === 'processing') return { label: t('status.memoryProcessing'), tone: 'processing' }
  if (item.memory_status === 'approval_required') return { label: t('status.needsApproval'), tone: 'queued' }
  if (item.memory_status === 'failed') return { label: t('status.memoryFailed'), tone: 'failed' }
  return null
}

function isStorageItemMemoryIndexable(item: StorageObjectItem) {
  return item.type === 'file'
    && item.status === 'active'
    && (item.memory_status === 'not_added'
      || item.memory_status === 'approval_required'
      || item.memory_status === 'failed')
}

/** Channel ingestion rules that refused the object; only the owner/admin "add anyway" overrides them (S20). */
const STORAGE_MEMORY_RULE_REFUSALS = ['rule_off', 'max_size_exceeded', 'max_duration_exceeded', 'custom_rule_skip'] as const
type StorageMemoryRuleRefusal = (typeof STORAGE_MEMORY_RULE_REFUSALS)[number]
type StorageMemoryAction = 'add' | 'approve' | 'add_anyway' | 'retry'

/**
 * S20: which Memory action an object offers. `approve` clears only the approval step of an `approval_required`
 * object; `add_anyway` is the confirmed owner/admin override of a refusing channel rule (off/size/duration/skip);
 * a failed object is retried and a skipped upload is added under the current rules. None of them sends `force`
 * unless the user confirmed "add anyway".
 */
function getStorageMemoryAction(item: StorageObjectItem): StorageMemoryAction | null {
  if (!isStorageItemMemoryIndexable(item)) return null
  if (item.memory_status === 'approval_required') return 'approve'
  if (item.memory_status === 'failed') return 'retry'
  return isStorageMemoryRuleRefusal(item.memory_failure_code) ? 'add_anyway' : 'add'
}

function isStorageMemoryRuleRefusal(code: string | null): code is StorageMemoryRuleRefusal {
  return (STORAGE_MEMORY_RULE_REFUSALS as readonly string[]).includes(code ?? '')
}

function storageMemoryRefusalKey(item: StorageObjectItem): StorageMemoryRuleRefusal | 'other' {
  return isStorageMemoryRuleRefusal(item.memory_failure_code) ? item.memory_failure_code : 'other'
}

function formatUploadToastTitle(tasks: UploadTask[], activeTasks: UploadTask[], t: StorageTranslator) {
  if (tasks.length === 1) return tasks[0]?.fileName ?? t('uploads.upload')
  if (activeTasks.length > 0) return t('uploads.active', { count: activeTasks.length })
  return t('uploads.recent', { count: tasks.length })
}

function getUploadSummaryStatusBadge(tasks: UploadTask[], t: StorageTranslator): StorageStatusBadgeModel {
  const processingCount = tasks.filter((task) => task.status === 'processing').length
  const uploadingCount = tasks.filter((task) => task.status === 'uploading').length
  const queuedCount = tasks.filter((task) => task.status === 'queued' || task.status === 'preparing').length
  const failedCount = tasks.filter((task) => task.status === 'failed').length
  const cancelledCount = tasks.filter((task) => task.status === 'cancelled').length

  if (processingCount > 0) return { label: t('status.processing'), tone: 'processing' }
  if (uploadingCount > 0) return { label: t('status.uploading'), tone: 'uploading' }
  if (queuedCount > 0) return { label: t('status.queued'), tone: 'queued' }
  if (failedCount > 0) return { label: failedCount === 1 ? t('status.failed') : t('status.failedCount', { count: failedCount }), tone: 'failed' }
  if (cancelledCount > 0) return { label: cancelledCount === 1 ? t('status.cancelled') : t('status.cancelledCount', { count: cancelledCount }), tone: 'cancelled' }
  return { label: t('status.uploaded'), tone: 'complete' }
}

function getUploadSummaryProgress(tasks: UploadTask[]) {
  if (tasks.length === 0) return 0
  const total = tasks.reduce((sum, task) => sum + clampProgress(task.progress), 0)
  return Math.round(total / tasks.length)
}

function getUploadTaskVisibleMs(status: UploadTaskStatus) {
  if (status === 'failed') return UPLOAD_FAILED_VISIBLE_MS
  if (status === 'cancelled') return UPLOAD_CANCELLED_VISIBLE_MS
  if (status === 'complete') return UPLOAD_COMPLETE_VISIBLE_MS
  return Number.POSITIVE_INFINITY
}

function formatDeleteDialogDescription(input: {
  itemCount: number
  fileCount: number
  folderCount: number
}) {
  if (input.itemCount === 0) return 'No storage items selected.'
  if (input.itemCount === 1) return 'This item will be removed from storage.'
  const parts = [
    input.fileCount > 0 ? `${input.fileCount} file${input.fileCount === 1 ? '' : 's'}` : null,
    input.folderCount > 0 ? `${input.folderCount} folder${input.folderCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean)
  return `You are about to delete ${parts.join(' and ')} from storage.`
}

function buildStorageUploadPlan(files: File[]): StorageUploadPlan {
  return files.reduce<StorageUploadPlan>((plan, file) => {
    if (isStorageUploadFileSupported(file)) plan.supported.push(file)
    else plan.unsupported.push(file)
    return plan
  }, { supported: [], unsupported: [] })
}

function isStorageUploadFileSupported(file: File) {
  const extension = getStorageUploadFileExtension(file.name)
  return extension !== '' && STORAGE_ALLOWED_UPLOAD_EXTENSIONS.has(extension)
}

function getStorageUploadFileExtension(fileName: string) {
  const normalized = fileName.toLowerCase()
  if (normalized.endsWith('.tar.gz')) return '.tar.gz'
  const dotIndex = normalized.lastIndexOf('.')
  return dotIndex >= 0 ? normalized.slice(dotIndex) : ''
}

function formatUnsupportedUploadDescription(files: File[]) {
  const examples = files.slice(0, 3).map((file) => file.name)
  const examplesLabel = examples.length > 0
    ? ` (${examples.join(', ')}${files.length > examples.length ? ', ...' : ''})`
    : ''

  if (files.length === 1) {
    return `${files[0]?.name ?? 'This file'} is not a supported storage file type.`
  }

  return `${files.length} files were not uploaded because their file type is not supported${examplesLabel}.`
}

function isStorageUnsupportedUploadError(error: unknown) {
  return isAuthClientError(error)
    && (error.code === 'STORAGE_UNSUPPORTED_FILE_TYPE' || error.code === 'STORAGE_MIME_MISMATCH')
}

function isStorageHardLimitError(error: unknown): error is AuthClientError {
  return isAuthClientError(error) && error.code === 'STORAGE_HARD_LIMIT_EXCEEDED'
}

function getStorageHardLimitDetails(error: unknown) {
  if (!isStorageHardLimitError(error)) {
    return {
      projectedBytes: null,
      maxBytes: null,
    }
  }

  const details = error.details && typeof error.details === 'object'
    ? error.details as Record<string, unknown>
    : {}

  return {
    projectedBytes: parseStorageByteCount(details.projected_bytes),
    maxBytes: parseStorageByteCount(details.max_bytes),
  }
}

function getStorageLimitTaskError(error: unknown) {
  const details = getStorageHardLimitDetails(error)
  if (details.maxBytes && details.maxBytes > 0) {
    return `File upload limit reached. Maximum file size: ${formatBytes(details.maxBytes)}.`
  }
  return 'File upload limit reached. Upgrade your plan to upload larger files.'
}

function parseStorageByteCount(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const numericValue = typeof value === 'bigint' ? Number(value) : Number(value)
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null
}

const STORAGE_PLAN_PAUSED_MESSAGE = 'This channel is paused by your plan. Choose an active channel or upgrade your plan to upload or edit storage files.'
const STORAGE_READONLY_MESSAGE = 'This channel is read-only. Choose another channel to upload or edit storage files.'
const STORAGE_REMOVING_MESSAGE = 'This channel is being removed. Storage is read-only.'

function getStorageWriteDisabledReason(channel: Channel | null) {
  if (channel?.status === 'plan_paused') return STORAGE_PLAN_PAUSED_MESSAGE
  if (channel?.status === 'removing' || channel?.status === 'removed') return STORAGE_REMOVING_MESSAGE
  return null
}

function formatUploadQueueSummary(tasks: UploadTask[], t: StorageTranslator) {
  const queuedCount = tasks.filter((task) => task.status === 'queued' || task.status === 'preparing').length
  const uploadingCount = tasks.filter((task) => task.status === 'uploading').length
  const processingCount = tasks.filter((task) => task.status === 'processing').length
  const failedCount = tasks.filter((task) => task.status === 'failed').length
  const cancelledCount = tasks.filter((task) => task.status === 'cancelled').length
  const completeCount = tasks.filter((task) => task.status === 'complete').length
  const parts = [
    uploadingCount > 0 ? t('uploads.summaryUploading', { count: uploadingCount }) : null,
    queuedCount > 0 ? t('uploads.summaryQueued', { count: queuedCount }) : null,
    processingCount > 0 ? t('uploads.summaryProcessing', { count: processingCount }) : null,
    failedCount > 0 ? t('uploads.summaryFailed', { count: failedCount }) : null,
    cancelledCount > 0 ? t('uploads.summaryCancelled', { count: cancelledCount }) : null,
    completeCount > 0 ? t('uploads.summaryUploaded', { count: completeCount }) : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : t('uploads.summaryRecent', { count: tasks.length })
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0
  return Math.min(100, Math.max(0, Math.round(progress)))
}

function getStorageActionErrorMessage(error: unknown) {
  if (isStorageHardLimitError(error)) {
    return getStorageLimitTaskError(error)
  }
  if (isStorageChannelReadonlyError(error)) {
    return getStorageChannelReadonlyStatus(error) === 'plan_paused'
      ? STORAGE_PLAN_PAUSED_MESSAGE
      : STORAGE_READONLY_MESSAGE
  }
  if (isAuthClientError(error) && error.code === 'STORAGE_FOLDER_NOT_EMPTY') {
    const details = error.details
    const path = details && typeof details === 'object' && 'path' in details
      ? String((details as { path: unknown }).path)
      : null
    const descendantCount = details && typeof details === 'object' && 'descendant_count' in details
      ? Number((details as { descendant_count: unknown }).descendant_count)
      : null
    const countLabel = typeof descendantCount === 'number' && Number.isFinite(descendantCount) && descendantCount > 0
      ? `${descendantCount} item${descendantCount === 1 ? '' : 's'}`
      : 'items'
    return path
      ? `Folder "${path}" is not empty. Delete or move the ${countLabel} inside first.`
      : `Folder is not empty. Delete or move the ${countLabel} inside first.`
  }
  if (isAuthClientError(error)) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Storage action failed.'
}

function isBrowserPlayableStreamOriginal(item: StorageObjectItem) {
  const mimeType = item.mime_type?.toLowerCase().split(';')[0]?.trim() ?? ''
  return mimeType === 'video/mp4' || mimeType === 'video/webm' || mimeType === 'video/ogg'
}

function isStorageDeliveryTemporarilyUnavailable(error: unknown) {
  if (!isAuthClientError(error) || error.code !== 'STORAGE_DELIVERY_NOT_READY') return false
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

function isStorageChannelReadonlyError(error: unknown) {
  if (isAuthClientError(error) && error.code === 'CHANNEL_READONLY') return true
  const message = error instanceof Error ? error.message : ''
  return message.includes('CHANNEL_READONLY') || message.includes('Channel API returned 409')
}

function getStorageChannelReadonlyStatus(error: unknown) {
  if (isAuthClientError(error)) {
    const details = error.details
    if (details && typeof details === 'object' && 'status' in details) {
      return String((details as { status: unknown }).status)
    }
  }

  const message = error instanceof Error ? error.message : ''
  if (message.includes('"status":"plan_paused"') || message.includes('status":"plan_paused')) return 'plan_paused'
  return null
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText && document.hasFocus()) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Some browsers drop focus while Radix menus close; fall back to a selected textarea.
    }
  }

  const activeElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  try {
    window.focus()
    textarea.focus({ preventScroll: true })
    textarea.select()
    textarea.setSelectionRange(0, value.length)
    if (!document.execCommand('copy')) {
      throw new Error('Copy failed. Please copy the URL manually.')
    }
  } finally {
    textarea.remove()
    activeElement?.focus({ preventScroll: true })
  }
}

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)
    const handleAbort = () => {
      window.clearTimeout(timeout)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

const STORAGE_ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.tiff',
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.mp3',
  '.wav',
  '.ogg',
  '.aac',
  '.flac',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.zip',
  '.tar.gz',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.json',
  '.xml',
])

const STORAGE_UPLOAD_ACCEPT = Array.from(STORAGE_ALLOWED_UPLOAD_EXTENSIONS).join(',')

const TEXT_PREVIEW_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'tsv',
  'log',
  'xml',
  'yaml',
  'yml',
  'html',
  'css',
  'js',
  'jsx',
  'ts',
  'tsx',
])

const IMAGE_PREVIEW_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'tiff',
])

const VIDEO_PREVIEW_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'avi',
  'mkv',
])

const AUDIO_PREVIEW_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'aac',
  'flac',
])

const DOCUMENT_PREVIEW_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
])
