'use client'

import * as React from 'react'
import Image from 'next/image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AudioLines,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Film,
  FolderOpen,
  HardDrive,
  ImageIcon,
  Link2,
  Loader2,
  Mic,
  Play,
  Plus,
  Scissors,
  Search,
  Shapes,
  Square,
  Upload,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  completeStorageUpload,
  getStorageObject,
  getStorageDeliveryUrl,
  initiateStorageUpload,
  listStorageObjects,
  storageDeliveryRefreshDelay,
  storageUsageAggregateQueryKey,
  storageUsageQueryKey,
  uploadProxyContent,
  uploadDirectContent,
  uploadTusContent,
  type StorageListInput,
  type StorageObjectItem,
  type StoragePreviewInput,
  isIndexedStorageAvatarRole,
} from '@/lib/storage/api'
import { BILLING_QUOTA_USAGE_QUERY_KEY, getBillingQuotaUsage } from '@/lib/billing/api'
import { getMyFeatureLimits, MY_FEATURE_LIMITS_QUERY_KEY } from '@/lib/feature-control/api'
import { publicRuntimeErrorMessageForError } from '@/lib/public-runtime-error'
import {
  getYoutubeImportPlanLimits,
  isYoutubeImportMediaKind,
  parseYoutubeImportUrl,
  youtubeImportCanConfirm,
  youtubeImportFailureNotice,
  youtubeImportJobIsInProgress,
  youtubeImportJobPhase,
  youtubeImportQuoteFromSnapshot,
  youtubeImportQuoteKey,
  youtubeImportMatchesPickerView,
  youtubeImportPickerView,
  type YoutubeImportPickerView,
  type YoutubeImportUrlError,
} from '@/lib/storage/youtube-import'
import { useMediaDownloaderQuote } from '@/lib/workflows/use-media-downloader-quote'
import {
  getVoiceProfilePreview,
  listVoiceProfiles,
  voiceProfilesQueryKey,
  type VoiceProfile,
} from '@/lib/voice/api'
import { useYoutubeImportJob } from '@/lib/storage/use-youtube-import-job'
import { useLocalizedRuntimeError } from '@/lib/i18n/use-localized-runtime-error'
import {
  getStoragePlayerOrigin,
  parseStoragePlayerEvent,
  registerStoragePlayerEvents,
  revealStoragePlayback,
  STORAGE_PLAYER_REFERRER_POLICY,
  STORAGE_PLAYER_REVEAL_TIMEOUT_MS,
} from '@/lib/storage/player'
import { storageUploadQueue } from '@/lib/storage/upload-queue'
import {
  groupMagicClipItems,
} from '@/lib/storage/magic-clip-groups'
import { openFileInput } from '@/lib/storage/open-file-picker'
import { isStorageGifPreview } from '@/lib/storage/use-storage-thumbnail-url'
import {
  VisibleStorageDeliveryProvider,
  useVisibleStorageDeliveryItem,
} from '@/lib/storage/visible-storage-delivery'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { StorageYoutubeImportPanel } from '@/components/storage/storage-youtube-import-field'
import {
  YoutubeImportFailureAlert,
  YoutubeImportPlaceholderCard,
  youtubeImportStatusLabel,
  youtubeImportUserMessage,
} from '@/components/storage/storage-youtube-import-status'
import { StorageClipGroupHeading } from '@/components/storage/storage-clip-group-heading'
import { useTranslations } from 'next-intl'

export type StorageMediaSelection = {
  storageObjectId: string
  name: string
  mimeType: string | null
  sizeBytes: string
  status: 'active' | 'processing'
  durationSeconds: number | null
  width: number | null
  height: number | null
  dimensionSource?: 'source' | 'preview'
  previewUrl: string | null
}

export type StorageMediaKind = 'audio-video' | 'audio' | 'video' | 'image' | 'all'
export type StorageMediaUploadOptions = {
  idempotencyKey?: string
  signal?: AbortSignal
  /** Storage folder (an existing path, no leading slash) the file goes into; absent = the root. */
  parentPath?: string
}
type UploadPhase = 'preparing' | 'uploading'
type MediaPickerView = YoutubeImportPickerView
const PICKER_ADD_BUTTON_CLASS = 'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:bg-primary/90 opacity-100 pointer-events-auto [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto'
const PICKER_GRID_CLASS = 'grid grid-cols-2 gap-3 md:grid-cols-3'

type UploadState = {
  fileName: string
  phase: UploadPhase
  progress: number
}

const SELECTED_MEDIA_INITIAL_POLL_INTERVAL_MS = 5_000
const SELECTED_MEDIA_SHORT_POLL_INTERVAL_MS = 10_000
const SELECTED_MEDIA_MEDIUM_POLL_INTERVAL_MS = 30_000
const SELECTED_MEDIA_LONG_POLL_INTERVAL_MS = 60_000
const SELECTED_MEDIA_READINESS_POLL_MAX_MS = 10 * 60_000
export const STORAGE_MEDIA_PICKER_SEARCH_DEBOUNCE_MS = 300
const PICKER_ACTION_BUTTON_CLASS = 'flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50'

export function StorageMediaInput({
  channelId,
  value,
  selectedName,
  onChange,
  onBusyChange,
  disabled = false,
  mediaKind = 'audio-video',
  uploadMetadata,
}: {
  channelId: string | null
  value: string
  selectedName?: string
  onChange: (selection: StorageMediaSelection | null) => void
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
  mediaKind?: StorageMediaKind
  uploadMetadata?: Record<string, string | number | boolean | null>
}) {
  const tAuto = useTranslations('Auto')
  const queryClient = useQueryClient()
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const uploadAbortRef = React.useRef<AbortController | null>(null)
  const onBusyChangeRef = React.useRef(onBusyChange)
  const onChangeRef = React.useRef(onChange)
  const selectedPollStartedAtRef = React.useRef<number | null>(null)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [uploadState, setUploadState] = React.useState<UploadState | null>(null)
  const [youtubeImportBusy, setYoutubeImportBusy] = React.useState(false)
  const [localSelection, setLocalSelection] = React.useState<{ id: string; name: string; status: 'active' | 'processing' } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const selectedObjectQuery = useQuery({
    queryKey: ['storage', 'object', channelId ?? 'none', value || 'none', 'media-readiness'],
    queryFn: ({ signal }) => getStorageObject({ channelId: channelId!, objectId: value }, { signal }),
    enabled: Boolean(channelId && value),
    staleTime: 5_000,
    retry: 2,
    refetchInterval: (query) => selectedMediaReadinessPollInterval(
      query.state.data,
      selectedPollStartedAtRef.current === null ? 0 : Date.now() - selectedPollStartedAtRef.current,
      Boolean(query.state.error),
    ),
    refetchIntervalInBackground: false,
  })
  const selectedObjectProcessing = Boolean(value && selectedObjectQuery.data?.id === value
    && isStorageMediaProcessing(selectedObjectQuery.data))
  const selectedObjectBlocking = Boolean(selectedObjectProcessing
    && selectedObjectQuery.data
    && !isStorageMediaSelectable(selectedObjectQuery.data))
  const busy = uploadState !== null || youtubeImportBusy || selectedObjectBlocking

  const invalidateStorage = React.useCallback(() => {
    if (!channelId) return
    void queryClient.invalidateQueries({ queryKey: ['storage', 'objects', channelId] })
    void queryClient.invalidateQueries({ queryKey: storageUsageQueryKey(channelId) })
    void queryClient.invalidateQueries({ queryKey: storageUsageAggregateQueryKey })
  }, [channelId, queryClient])

  React.useEffect(() => {
    onBusyChangeRef.current = onBusyChange
  }, [onBusyChange])

  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  React.useEffect(() => {
    selectedPollStartedAtRef.current = Date.now()
  }, [channelId, value])

  React.useEffect(() => {
    const item = selectedObjectQuery.data
    if (!item || item.id !== value) return
    if (isStorageMediaReady(item)) {
      if (localSelection?.id === item.id && localSelection.status === 'processing') {
        onChangeRef.current(selectionFromItem(item))
      }
      return
    }
    if (!isStorageMediaProcessing(item)) {
      let cancelled = false
      queueMicrotask(() => {
        if (cancelled) return
        setLocalSelection(null)
        setError(storageStatusLabel(item))
        onChangeRef.current(null)
      })
      return () => { cancelled = true }
    }
  }, [localSelection?.id, localSelection?.status, selectedObjectQuery.data, value])

  React.useEffect(() => {
    onBusyChangeRef.current?.(busy)
  }, [busy])

  React.useEffect(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setUploadState(null)
    if (uploadInputRef.current) uploadInputRef.current.value = ''
    onBusyChangeRef.current?.(false)
  }, [channelId])

  React.useEffect(() => () => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    onBusyChangeRef.current?.(false)
  }, [])

  function clearUploadState() {
    setUploadState(null)
  }

  async function upload(files: FileList | null) {
    const file = files?.[0]
    if (!file || !channelId || busy) return
    if (!isAcceptedFile(file, mediaKind)) {
      setError(
        mediaKind === 'image'
          ? 'Choose a PNG, JPEG, or WebP image.'
          : mediaKind === 'video'
          ? 'Choose a video file.'
          : mediaKind === 'audio'
            ? 'Choose an audio file.'
            : 'Choose an audio or video file.',
      )
      return
    }

    uploadAbortRef.current?.abort()
    const uploadController = new AbortController()
    uploadAbortRef.current = uploadController
    setUploadState({ fileName: file.name, phase: 'preparing', progress: 0 })
    setError(null)

    try {
      const selection = await uploadStorageMedia(channelId, file, mediaKind, uploadMetadata, (progress) => {
        if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) return
        setUploadState({ fileName: file.name, phase: 'uploading', progress })
      }, { signal: uploadController.signal })
      if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) return
      invalidateStorage()
      setLocalSelection({ id: selection.storageObjectId, name: selection.name, status: selection.status })
      onChange(selection)
      setPickerOpen(false)
    } catch (uploadError) {
      if (!isStorageMediaUploadAbort(uploadError, uploadController.signal)) {
        setError(publicRuntimeErrorMessageForError(
          uploadError,
          'The selected media could not be uploaded.',
        ))
      }
    } finally {
      if (uploadAbortRef.current !== uploadController) return
      uploadAbortRef.current = null
      setUploadState(null)
      invalidateStorage()
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  const localSelectedName = localSelection?.id === value ? localSelection.name : ''
  const fetchedName = selectedObjectQuery.data?.id === value ? selectedObjectQuery.data.name : ''
  const displayName = selectedName || (value ? localSelectedName || fetchedName || tAuto('selected_9a976fc2') : '')
  const displayStatus = value
    ? selectedObjectProcessing
      ? 'Uploaded · background checks continue'
      : 'Selected from Storage'
    : mediaKind === 'image' ? 'PNG, JPEG, WebP' : mediaKind === 'video' ? 'MP4, MOV, WebM' : mediaKind === 'audio' ? 'Audio recording' : 'Audio or video'

  return (
    <div className="space-y-2">
      <div className={cn(
        'flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-border bg-panel/40 p-3',
      )}>
        <button
          type="button"
          disabled={disabled || !channelId}
          onClick={() => setPickerOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
            {value
              ? <CheckCircle2 className="size-5 text-emerald-600" />
              : mediaKind === 'image'
                ? <ImageIcon className="size-5" />
                : mediaKind === 'audio'
                ? <AudioLines className="size-5" />
                : <Film className="size-5" />}
          </span>
          <span className="min-w-0">
            <span className={cn('block truncate text-sm font-semibold', displayName ? 'text-foreground' : 'text-muted-foreground')}>
              {displayName || tAuto('choose_media_7c2482b1')}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{displayStatus}</span>
          </span>
        </button>

        {value ? (
          <button
            type="button"
            aria-label={tAuto('clear_selected_media_7172d2f1')}
            title={tAuto('clear_selected_media_7172d2f1')}
            onClick={() => {
              uploadAbortRef.current?.abort()
              uploadAbortRef.current = null
              if (uploadInputRef.current) uploadInputRef.current.value = ''
              clearUploadState()
              setLocalSelection(null)
              onChange(null)
              setError(null)
            }}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="icon"
          title={tAuto('browse_storage_8c30e4c1')}
          aria-label={tAuto('browse_storage_8c30e4c1')}
          disabled={disabled || !channelId}
          onClick={() => setPickerOpen(true)}
          className="size-9 shrink-0 rounded-lg border-0 bg-transparent shadow-none hover:bg-accent"
        >
          <FolderOpen className="size-4" />
        </Button>
        <Button
          type="button"
          aria-label={tAuto('choose_file_eb7eb7a8')}
          title={tAuto('choose_file_eb7eb7a8')}
          disabled={disabled || !channelId || busy}
          onClick={() => openFileInput(uploadInputRef.current)}
          className="h-9 shrink-0 rounded-lg bg-foreground px-3.5 text-sm font-semibold text-background hover:bg-foreground/90"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          <span className="hidden sm:inline"><UiText id="choose_file_eb7eb7a8" /></span>
        </Button>
      </div>

      {uploadState ? <UploadProgress state={uploadState} /> : null}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}

      <input
        ref={uploadInputRef}
        type="file"
        accept={mediaKind === 'image' ? tAuto('image_png_image_jpeg_image_webp_d0cf88d0') : mediaKind === 'video' ? tAuto('video_67e30a63') : mediaKind === 'audio' ? tAuto('audio_283da71d') : tAuto('audio_video_c9dff2f1')}
        className="hidden"
        onChange={(event) => void upload(event.target.files)}
      />
      <StorageMediaPickerDialog
        open={pickerOpen}
        channelId={channelId}
        selectedObjectId={value || undefined}
        mediaKind={mediaKind}
        uploadState={uploadState}
        onOpenChange={setPickerOpen}
        onImportBusyChange={setYoutubeImportBusy}
        onUpload={() => openFileInput(uploadInputRef.current)}
        onSelect={(selection) => {
          clearUploadState()
          setLocalSelection({ id: selection.storageObjectId, name: selection.name, status: selection.status })
          onChange(selection)
          setError(null)
          setPickerOpen(false)
        }}
      />
    </div>
  )
}

function UploadProgress({ state }: { state: UploadState }) {
  const label = state.phase === 'preparing'
    ? 'Preparing upload'
    : `Uploading ${state.progress}%`
  return (
    <div className="rounded-xl border border-border bg-panel/40 px-3 py-2" role="status" aria-live="polite">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        <span className="min-w-0 flex-1 truncate">{state.fileName}</span>
        <span className="shrink-0 font-medium text-foreground">{label}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${state.phase === 'preparing' ? 4 : Math.max(4, state.progress)}%` }}
        />
      </div>
    </div>
  )
}

export function StorageMediaPickerDialog({
  open,
  channelId,
  selectedObjectId,
  onOpenChange,
  onSelect,
  onUpload,
  onImportBusyChange,
  uploadState,
  mediaKind = 'audio-video',
}: {
  open: boolean
  channelId: string | null
  selectedObjectId?: string
  onOpenChange: (open: boolean) => void
  onSelect: (selection: StorageMediaSelection) => void
  onUpload: () => void
  onImportBusyChange?: (busy: boolean) => void
  uploadState: UploadState | null
  mediaKind?: StorageMediaKind
}) {
  const tAuto = useTranslations('Auto')
  const tStorage = useTranslations('Storage')
  const localizeRuntimeError = useLocalizedRuntimeError()
  const onImportBusyChangeRef = React.useRef(onImportBusyChange)
  const viewRef = React.useRef<MediaPickerView>(defaultMediaPickerView(mediaKind))
  const [view, setView] = React.useState<MediaPickerView>(defaultMediaPickerView(mediaKind))
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebouncedValue(search, STORAGE_MEDIA_PICKER_SEARCH_DEBOUNCE_MS)
  const [items, setItems] = React.useState<StorageObjectItem[]>([])
  const [previewItem, setPreviewItem] = React.useState<StorageObjectItem | null>(null)
  const [previewVoice, setPreviewVoice] = React.useState<VoiceProfile | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [youtubeDraft, setYoutubeDraft] = React.useState('')
  const [youtubeError, setYoutubeError] = React.useState<string | null>(null)
  const [youtubeMode, setYoutubeMode] = React.useState(false)
  const [pinnedImportItems, setPinnedImportItems] = React.useState<StorageObjectItem[]>([])
  const youtubeImport = useYoutubeImportJob({
    channelId,
    timeoutMessage: tStorage('picker.youtubeTimedOut'),
    formatError: (importError) => youtubeImportUserMessage(importError, tStorage, localizeRuntimeError),
    onCompleted: (imported) => {
      if (imported.length === 0) return
      setPinnedImportItems(imported)
      setItems((current) => mergeYoutubeImportItems(imported, current))
      const first = imported[0]
      if (!first) return
      setPreviewItem(first)
      setPreviewVoice(null)
      const nextView = youtubeImportPickerView({
        mimeType: first.mime_type,
        currentView: viewRef.current,
      })
      if (nextView !== viewRef.current) setView(nextView)
    },
  })
  const youtubeJob = youtubeImport.job
  const uploadPhase = uploadState?.phase ?? null
  const youtubeImportSupported = isYoutubeImportMediaKind(mediaKind)
  const featureLimitsQuery = useQuery({
    queryKey: MY_FEATURE_LIMITS_QUERY_KEY,
    queryFn: getMyFeatureLimits,
    enabled: open && youtubeImportSupported,
    staleTime: 60_000,
  })
  const quotaUsageQuery = useQuery({
    queryKey: BILLING_QUOTA_USAGE_QUERY_KEY,
    queryFn: getBillingQuotaUsage,
    enabled: open && youtubeImportSupported,
    staleTime: 30_000,
  })
  const youtubeLimits = getYoutubeImportPlanLimits(featureLimitsQuery.data?.features ?? [])
  const showYoutubeImport = youtubeImportSupported && youtubeLimits.enabled
  const youtubeJobRunning = youtubeImportJobIsInProgress(youtubeJob)
  const parsedYoutubeUrl = parseYoutubeImportUrl(youtubeDraft)
  const youtubeAvailableCredits = youtubeImportAvailableCredits(quotaUsageQuery.data)
  const youtubeQuoteSession = useMediaDownloaderQuote({
    channelId,
    url: parsedYoutubeUrl.ok ? parsedYoutubeUrl.url : '',
    availableCredits: youtubeAvailableCredits,
    creditEligibilityFailed: quotaUsageQuery.isError,
    creditEligibilityRetrying: quotaUsageQuery.isFetching,
    onRetryCreditEligibility: () => {
      void quotaUsageQuery.refetch()
    },
    downloadVariant: isYoutubeImportMediaKind(mediaKind) ? (mediaKind === 'audio' ? 'audio_only' : 'video_with_audio') : 'video_with_audio',
    maxHeight: youtubeLimits.maxResolution,
    enabled: open
      && youtubeMode
      && parsedYoutubeUrl.ok
      && Boolean(channelId),
  })
  const youtubeMetadataLoading = open && youtubeMode && parsedYoutubeUrl.ok && Boolean(channelId)
    && (youtubeQuoteSession.quoting || youtubeQuoteSession.creditEligibilityPending)
  const youtubeQuote = parsedYoutubeUrl.ok
    ? youtubeImportQuoteFromSnapshot(
      parsedYoutubeUrl.url,
      youtubeQuoteSession.snapshot,
    )
    : null
  const canConfirmYoutubeImport = parsedYoutubeUrl.ok && youtubeQuote !== null && youtubeImportCanConfirm({
    key: youtubeQuote.key,
    quote: youtubeQuote,
    quoting: youtubeQuoteSession.quoting,
    availableCredits: youtubeAvailableCredits,
  })
  const youtubePlaceholderCount = youtubeJobRunning && youtubeJob ? 1 : 0
  const hasYoutubeJob = youtubeJobRunning
  const youtubePhase = youtubeJobRunning && youtubeJob ? youtubeImportJobPhase(youtubeJob) : null
  const youtubeFailure = youtubeImportFailureNotice(youtubeJob)
  const youtubeStatusText = youtubeImportStatusLabel(tStorage, youtubePhase)
  const pickerGroups = view === 'clips'
    ? groupMagicClipItems(items)
    : [{ key: 'all', kind: 'fallback' as const, runId: null, items }]

  React.useEffect(() => {
    viewRef.current = view
  }, [view])

  React.useEffect(() => {
    onImportBusyChangeRef.current = onImportBusyChange
  }, [onImportBusyChange])

  React.useEffect(() => {
    onImportBusyChangeRef.current?.(youtubeJobRunning)
    return () => onImportBusyChangeRef.current?.(false)
  }, [youtubeJobRunning])

  React.useEffect(() => {
    setYoutubeMode(false)
    setYoutubeDraft('')
    setYoutubeError(null)
    setPinnedImportItems([])
  }, [channelId])

  React.useEffect(() => {
    if (!open) {
      setYoutubeMode(false)
      return
    }
    setView(defaultMediaPickerView(mediaKind))
    setPreviewVoice(null)
  }, [channelId, mediaKind, open])

  React.useEffect(() => {
    if (showYoutubeImport) return
    setYoutubeMode(false)
  }, [showYoutubeImport])

  const youtubeQuoteCredits = youtubeQuote?.credits ?? null
  React.useEffect(() => {
    const insufficient = tStorage('picker.youtubeInsufficientCredits')
    setYoutubeError((current) => {
      if (youtubeAvailableCredits !== null && youtubeAvailableCredits <= 0) return insufficient
      if (youtubeQuoteCredits === null || youtubeAvailableCredits === null) {
        return current === insufficient ? null : current
      }
      if (youtubeQuoteCredits > youtubeAvailableCredits) return insufficient
      return current === insufficient ? null : current
    })
  }, [tStorage, youtubeAvailableCredits, youtubeQuoteCredits])

  function importYoutube() {
    if (!channelId || !isYoutubeImportMediaKind(mediaKind) || youtubeJobRunning) return
    const parsed = parseYoutubeImportUrl(youtubeDraft)
    if (!parsed.ok) {
      setYoutubeError(youtubeImportParseMessage(parsed.code, tStorage))
      return
    }
    const quote = youtubeQuote
    if (!youtubeImportCanConfirm({
      key: youtubeImportQuoteKey(parsed.url),
      quote,
      quoting: youtubeQuoteSession.quoting,
      availableCredits: youtubeAvailableCredits,
    })) {
      if (quote && youtubeAvailableCredits !== null && quote.credits > youtubeAvailableCredits) {
        setYoutubeError(tStorage('picker.youtubeInsufficientCredits'))
      } else if (youtubeQuoteSession.status === 'error') {
        setYoutubeError(youtubeQuoteSession.error ?? tStorage('picker.youtubeQuoteFailed'))
      } else {
        setYoutubeError(tStorage('picker.youtubeQuoteExpired'))
      }
      return
    }

    setYoutubeError(null)
    setError(null)
    if (!youtubeImport.startImport({ url: parsed, mediaKind, quote })) return
    setYoutubeMode(false)
    setYoutubeDraft('')
    if (view !== 'all' && view !== 'audio' && view !== 'video') {
      setView(mediaKind === 'audio' ? 'audio' : mediaKind === 'video' ? 'video' : 'all')
    }
  }

  function requestClose() {
    setYoutubeMode(false)
    onOpenChange(false)
  }

  const voiceListInput = React.useMemo(() => ({
    channelId: channelId ?? undefined,
    status: 'ready' as const,
    limit: 100,
    offset: 0,
  }), [channelId])
  const voiceQuery = useQuery({
    queryKey: voiceProfilesQueryKey(voiceListInput),
    queryFn: ({ signal }) => listVoiceProfiles(voiceListInput, { signal }),
    enabled: open && view === 'voice' && Boolean(channelId),
    staleTime: 30_000,
    retry: 1,
  })
  const voiceProfiles = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const profiles = voiceQuery.data?.data ?? []
    if (!query) return profiles
    return profiles.filter((profile) => (
      profile.display_name.toLocaleLowerCase().includes(query)
      || profile.default_language?.toLocaleLowerCase().includes(query)
      || profile.origin.toLocaleLowerCase().includes(query)
      || profile.catalog.description?.toLocaleLowerCase().includes(query)
    ))
  }, [search, voiceQuery.data?.data])

  React.useEffect(() => {
    if (view !== 'voice') return
    setPreviewItem(null)
    setPreviewVoice((current) => {
      if (current && voiceProfiles.some((profile) => profile.id === current.id)) {
        return voiceProfiles.find((profile) => profile.id === current.id) ?? current
      }
      return voiceProfiles[0] ?? null
    })
  }, [view, voiceProfiles])

  React.useEffect(() => {
    if (!open || !channelId) return undefined
    if (view === 'voice') {
      setItems([])
      setLoading(false)
      setError(null)
      return undefined
    }
    const controller = new AbortController()
    const pollingStartedAt = Date.now()
    let timer: number | undefined
    let firstLoad = true
    const listInput = pickerStorageListInput(view, debouncedSearch)

    const load = async () => {
      if (!listInput) return
      if (firstLoad && pinnedImportItems.length === 0 && !hasYoutubeJob) setLoading(true)
      setError(null)
      try {
        const result = await listStorageObjects(channelId, listInput, { signal: controller.signal })
        const nextItems = result.data.filter((item) => itemMatchesPickerView(item, view))
        const extras = pinnedImportItems.filter((item) => (
          youtubeImportMatchesPickerView(item, view)
          && itemMatchesPickerView(item, view)
          && !nextItems.some((candidate) => candidate.id === item.id)
        ))
        const pinned = extras.length > 0 ? [...extras, ...nextItems] : nextItems
        setItems(pinned)
        setPreviewVoice(null)
        setPreviewItem((current) => {
          const preferredId = current?.id ?? extras[0]?.id ?? selectedObjectId
          const refreshedCurrent = preferredId ? pinned.find((item) => item.id === preferredId) : null
          if (refreshedCurrent) return refreshedCurrent
          return pinned[0] ?? null
        })
        const pollInterval = storageMediaPickerPollInterval(
          pinned,
          Date.now() - pollingStartedAt,
          youtubeJobRunning,
        )
        if (pollInterval !== false) {
          timer = window.setTimeout(() => void load(), pollInterval)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setItems([])
          setPreviewItem(null)
          setError(publicRuntimeErrorMessageForError(
            loadError,
            'Storage media could not be loaded.',
          ))
        }
      } finally {
        firstLoad = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    timer = window.setTimeout(() => void load(), 150)
    return () => {
      controller.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [channelId, debouncedSearch, hasYoutubeJob, open, pinnedImportItems, selectedObjectId, uploadPhase, view, youtubeJobRunning])

  if (!open) return null

  const tabs: Array<{ id: MediaPickerView; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: tStorage('media.all'), icon: <HardDrive className="size-4" /> },
    { id: 'image', label: tStorage('media.images'), icon: <ImageIcon className="size-4" /> },
    { id: 'video', label: tStorage('media.videos'), icon: <Film className="size-4" /> },
    { id: 'clips', label: tStorage('media.clips'), icon: <Scissors className="size-4" /> },
    { id: 'audio', label: tStorage('media.audio'), icon: <AudioLines className="size-4" /> },
    { id: 'voice', label: tStorage('media.voice'), icon: <Mic className="size-4" /> },
    { id: 'gifs', label: tStorage('media.gifs'), icon: <ImageIcon className="size-4" /> },
    { id: 'elements', label: tStorage('media.elements'), icon: <Shapes className="size-4" /> },
    { id: 'documents', label: tStorage('media.documents'), icon: <FileText className="size-4" /> },
  ]

  const youtubePlaceholdersVisible = youtubePlaceholderCount > 0
    && (view === 'all' || view === 'video' || view === 'audio')
  const gridLoading = view === 'voice' ? voiceQuery.isPending : loading
  const selectedCompatible = previewItem ? isCompatibleWithMediaKind(previewItem, mediaKind) : false
  const selectedSelectable = Boolean(
    previewItem && selectedCompatible && isStorageMediaSelectable(previewItem),
  )
  const selectedProcessing = Boolean(
    previewItem && selectedCompatible && isStorageMediaProcessing(previewItem),
  )
  const emptyGrid = view === 'voice'
    ? !gridLoading && voiceProfiles.length === 0
    : items.length === 0 && !youtubePlaceholdersVisible
  const voiceError = view === 'voice' && voiceQuery.isError
  function renderYoutubeAction(idPrefix: string) {
    if (!showYoutubeImport) return null
    return (
      <button
        type="button"
        disabled={Boolean(uploadState) || youtubeJobRunning || !channelId}
        aria-pressed={youtubeMode}
        aria-label={tStorage('picker.youtubeActionLabel')}
        title={tStorage('picker.youtubeActionLabel')}
        data-youtube-action={idPrefix}
        onClick={() => {
          if (youtubeJobRunning) return
          setYoutubeMode(true)
          setYoutubeError(null)
        }}
        className={cn(PICKER_ACTION_BUTTON_CLASS, youtubeMode && 'bg-accent')}
      >
        <Link2 className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{tStorage('picker.youtubeAction')}</span>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 text-foreground sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-media-picker-title"
      aria-busy={youtubeJobRunning}
    >
      <div
        className="absolute inset-0 bg-background/55 backdrop-blur-2xl dark:bg-black/45"
        onMouseDown={requestClose}
      />
      <div
        className="relative z-10 flex h-[min(52rem,calc(100dvh-2.5rem))] w-full max-w-6xl min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="relative z-10 hidden w-52 shrink-0 flex-col border-r border-border p-4 md:flex">
          <div id="storage-media-picker-title" className="mb-4 truncate font-display text-lg text-foreground">
            {tStorage('picker.title')}
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setView(tab.id)
                  setYoutubeMode(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  view === tab.id && !youtubeMode
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-3 shrink-0 space-y-2">
            {renderYoutubeAction('storage-youtube-sidebar')}
            <button
              type="button"
              disabled={Boolean(uploadState) || !channelId}
              onClick={onUpload}
              className={PICKER_ACTION_BUTTON_CLASS}
            >
              {uploadState ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              <UiText id="upload_media_ef8a36f0" /></button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-3 border-b border-border p-4">
            {youtubeMode ? (
              <h2 className="min-w-0 flex-1 truncate font-display text-lg text-foreground">
                {tStorage('picker.youtubePanelTitle')}
              </h2>
            ) : (
              <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background/50 px-3.5 py-2.5">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tAuto('search_storage_6428d956')}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            )}
            {youtubeMode ? null : youtubeJobRunning && youtubeStatusText ? (
              <div
                className="hidden h-11 max-w-[240px] items-center gap-1.5 rounded-xl border border-border bg-background/50 px-3 text-sm text-muted-foreground sm:flex"
                role="status"
              >
                <Loader2 className="size-4 shrink-0 animate-spin" />
                <span className="truncate">{youtubeStatusText}</span>
              </div>
            ) : (
              <div className="hidden h-11 items-center gap-1.5 rounded-xl border border-border bg-background/50 px-3 text-sm text-muted-foreground sm:flex">
                <Clock3 className="size-4" />
                <UiText id="recent_76eec760" />
              </div>
            )}
            <button
              type="button"
              aria-label={tAuto('close_media_picker_d26b46f4')}
              title={tAuto('close_bbfa773e')}
              onClick={requestClose}
              className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          </div>

          {youtubeMode ? (
            <div className="flex min-h-0 flex-1">
              <StorageYoutubeImportPanel
                draft={youtubeDraft}
                error={youtubeError ?? (youtubeQuoteSession.status === 'error' ? youtubeQuoteSession.error : null)}
                quote={youtubeQuote}
                quoting={youtubeMetadataLoading}
                creditCheckFailed={youtubeQuoteSession.creditEligibilityFailed}
                creditCheckRetrying={youtubeQuoteSession.creditEligibilityRetrying}
                onRetryCreditCheck={() => youtubeQuoteSession.onRetryCreditEligibility?.()}
                canConfirm={canConfirmYoutubeImport}
                disabled={Boolean(uploadState) || youtubeJobRunning || !channelId}
                onDraftChange={(value) => {
                  setYoutubeDraft(value)
                  if (youtubeError) setYoutubeError(null)
                }}
                onVariantChange={(variantId) => youtubeQuoteSession.selectVariant(variantId)}
                onImport={() => void importYoutube()}
              />
            </div>
          ) : (
          <VisibleStorageDeliveryProvider
            channelId={channelId}
            items={items}
            enabled={open && view !== 'voice'}
          >
          <div className="flex min-h-0 flex-1">
            <div className="hg-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
              <div className="mb-3 flex gap-2 overflow-x-auto sm:hidden">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setView(tab.id)}
                    className={cn(
                      'flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm transition-colors',
                      view === tab.id
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {uploadState ? <div className="mb-3"><UploadProgress state={uploadState} /></div> : null}
              {error ? <div role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">{error}</div> : null}
              {voiceError ? (
                <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
                  {tStorage('voiceProfiles.notFound')}
                </div>
              ) : null}
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

              {gridLoading ? (
                <div className={PICKER_GRID_CLASS}>
                  {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-video rounded-xl" />)}
                </div>
              ) : emptyGrid ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-muted-foreground">
                  {view === 'voice' ? <Mic className="mb-3 size-12 text-muted-foreground/50" /> : <FolderOpen className="mb-3 size-12 text-muted-foreground/50" />}
                  <p className="text-base font-semibold">
                    {view === 'voice' ? tStorage('picker.emptyVoice') : <UiText id="no_media_found_1bdfc78e" />}
                  </p>
                  {view === 'voice' ? null : (
                  <div className="mt-4 flex w-full max-w-xs flex-col items-stretch gap-2 sm:max-w-none sm:flex-row sm:justify-center">
                    {showYoutubeImport ? (
                      <button
                        type="button"
                        aria-label={tStorage('picker.youtubeActionLabel')}
                        title={tStorage('picker.youtubeActionLabel')}
                        onClick={() => setYoutubeMode(true)}
                        disabled={!channelId || youtubeJobRunning}
                        className={cn(PICKER_ACTION_BUTTON_CLASS, 'sm:w-auto sm:px-4')}
                      >
                        <Link2 className="size-4" />
                        {tStorage('picker.youtubeAction')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={onUpload}
                      disabled={!channelId}
                      className={cn(PICKER_ACTION_BUTTON_CLASS, 'sm:w-auto sm:px-4')}
                    >
                      <Upload className="size-4" />
                      <UiText id="upload_media_ef8a36f0" />
                    </button>
                  </div>
                  )}
                </div>
              ) : view === 'voice' ? (
                <div className={PICKER_GRID_CLASS}>
                  {voiceProfiles.map((profile) => {
                    const selected = previewVoice?.id === profile.id
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => {
                          setPreviewItem(null)
                          setPreviewVoice(profile)
                        }}
                        className={cn(
                          'min-w-0 overflow-hidden rounded-xl border bg-background/40 p-3 text-left transition-colors hover:border-primary/40',
                          selected ? 'border-primary ring-1 ring-primary' : 'border-border',
                        )}
                      >
                        <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-accent to-panel">
                          <Mic className="size-8 text-muted-foreground" />
                        </div>
                        <p className="truncate text-xs font-medium text-foreground">{profile.display_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {profile.default_language ?? tAuto('multilingual_aaa850f7')} · {formatVoiceOriginLabel(profile.origin)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className={cn(view === 'clips' && 'space-y-4')}>
                  {youtubePlaceholdersVisible ? (
                    <div className={cn('mb-3', PICKER_GRID_CLASS)}>
                      {Array.from({ length: youtubePlaceholderCount }).map((_, index) => (
                        <YoutubeImportPlaceholderCard
                          key={`youtube-pending-${youtubeJob?.url.videoId ?? index}`}
                          label={youtubeJob?.url.videoId ?? youtubeStatusText}
                          statusLabel={youtubeStatusText}
                          failed={false}
                          detail={null}
                          thumbnailUrl={youtubeJob?.quote?.thumbnailUrl}
                        />
                      ))}
                    </div>
                  ) : null}
                  {pickerGroups.map((group) => (
                    <section key={group.key}>
                      {view === 'clips' ? (
                        <StorageClipGroupHeading group={group} className="mb-2" />
                      ) : null}
                      <div className={PICKER_GRID_CLASS}>
                  {group.items.map((item) => {
                    const selected = previewItem?.id === item.id
                    const ready = isStorageMediaReady(item)
                    const compatible = isCompatibleWithMediaKind(item, mediaKind)
                    const selectable = compatible && isStorageMediaSelectable(item)
                    const processing = compatible && isStorageMediaProcessing(item)
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'group min-w-0 overflow-hidden rounded-xl border bg-background/40 text-left transition-colors hover:border-primary/40',
                          selected ? 'border-primary ring-1 ring-primary' : 'border-border',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewVoice(null)
                            setPreviewItem(item)
                          }}
                          onDoubleClick={() => selectable && onSelect(selectionFromItem(item))}
                          className="block w-full min-w-0 text-left"
                        >
                          <div className={cn(
                            'relative overflow-hidden bg-black/40',
                            view === 'clips' ? 'aspect-[9/16]' : 'aspect-video bg-gradient-to-br from-accent to-panel',
                          )}>
                            <StorageMediaPreview item={item} channelId={channelId} />
                          </div>
                        </button>
                        <div className="flex items-center gap-2 p-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewVoice(null)
                              setPreviewItem(item)
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {ready ? formatBytes(item.size_bytes) : storageStatusLabel(item)}
                            </p>
                          </button>
                          {selectable ? (
                            <button
                              type="button"
                              aria-label={`Select ${item.name}`}
                              title={tAuto('select_85982229')}
                              onClick={() => onSelect(selectionFromItem(item))}
                              className={PICKER_ADD_BUTTON_CLASS}
                            >
                              <Plus className="size-4" />
                            </button>
                          ) : processing ? (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <aside className="hidden w-[20.5rem] shrink-0 flex-col border-l border-border p-4 lg:flex">
              <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-background">
                {view === 'voice' && previewVoice ? (
                  <PickerVoicePreview
                    profile={previewVoice}
                    channelId={channelId}
                    playLabel={tStorage('picker.voicePreview')}
                    stopLabel={tStorage('picker.voiceStopPreview')}
                  />
                ) : previewItem ? (
                  <>
                    <div className="min-h-0 flex-1">
                      <StorageMediaPreview item={previewItem} channelId={channelId} large />
                    </div>
                    <div className="border-t border-border p-4">
                      <p className="truncate text-sm font-medium text-foreground">{previewItem.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {previewItem.mime_type ?? 'media'} · {formatBytes(previewItem.size_bytes)} · {storageStatusLabel(previewItem)}
                      </p>
                      <Button
                        type="button"
                        disabled={!selectedSelectable}
                        onClick={() => selectedSelectable && onSelect(selectionFromItem(previewItem))}
                        className="mt-3 h-10 w-full rounded-xl"
                      >
                        {selectedSelectable ? <Check className="size-4" /> : selectedProcessing ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                        {selectedSelectable
                          ? tAuto('choose_media_7c2482b1')
                          : selectedProcessing
                            ? tAuto('preparing_media_b45681a2')
                            : selectedCompatible
                              ? tAuto('media_unavailable_da356f93')
                              : tStorage('picker.chooseIncompatible')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground"><Film className="size-10" /></div>
                )}
              </div>
            </aside>
          </div>
          </VisibleStorageDeliveryProvider>
          )}

          {youtubeMode ? null : (
          <div className="shrink-0 border-t border-border p-3 md:hidden">
            <div className="space-y-2">
              {renderYoutubeAction('storage-youtube-mobile')}
              <button
                type="button"
                disabled={Boolean(uploadState) || !channelId}
                onClick={onUpload}
                className={PICKER_ACTION_BUTTON_CLASS}
              >
                {uploadState ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                <UiText id="upload_media_ef8a36f0" />
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

function mergeYoutubeImportItems(incoming: StorageObjectItem[], current: StorageObjectItem[]) {
  const seen = new Set(incoming.map((item) => item.id))
  return [...incoming, ...current.filter((item) => !seen.has(item.id))]
}

function youtubeImportParseMessage(
  code: YoutubeImportUrlError,
  tStorage: ReturnType<typeof useTranslations<'Storage'>>,
) {
  if (code === 'too_long') return tStorage('picker.youtubeTooLong')
  return tStorage('picker.youtubeInvalid')
}

function StorageMediaPreview({
  item,
  channelId,
  large = false,
}: {
  item: StorageObjectItem
  channelId?: string | null
  large?: boolean
}) {
  const video = isStorageVideoItem(item)
  const image = isStorageImageItem(item)
  const thumbnailCandidate = isStorageMediaThumbnailCandidate(item)
  const deliveryLookup = useVisibleStorageDeliveryItem(item.id)
  const signedUrl = deliveryLookup?.item?.status === 'ok' ? deliveryLookup.item.url : null
  const deliveryErrorCode = deliveryLookup?.item?.status === 'error' ? deliveryLookup.item.error.code : null
  const waitingForDelivery = deliveryErrorCode === 'STORAGE_DELIVERY_NOT_READY'
    || deliveryErrorCode === 'STORAGE_IO_LIMIT_EXCEEDED'
  const fallbackGraceKey = `${item.id}:${item.status}:${item.updated_at}:${signedUrl ?? deliveryLookup?.item?.status ?? 'pending'}`
  const fallbackAllowed = useStorageThumbnailFallbackGrace(fallbackGraceKey, thumbnailCandidate)
  const previewUrls = [signedUrl]
  const thumbnailLoading = Boolean(
    thumbnailCandidate && !signedUrl && (deliveryLookup?.isPending || waitingForDelivery),
  )
  const fallback = <StorageMediaFallback item={item} image={image} large={large} />
  if (large && video && channelId && isStorageMediaReady(item)) {
    return <StoragePlayableVideoPreview key={item.id} item={item} channelId={channelId} posterUrls={previewUrls} onPreviewError={deliveryLookup?.retryPreview} />
  }

  if (thumbnailCandidate) {
    const videoOverlay = video ? (
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-black/42 text-white shadow-sm backdrop-blur-sm">
          <Play className="size-4 fill-current" />
        </span>
      </span>
    ) : null

    return (
      <StoragePreviewImage
        urls={previewUrls}
        onPreviewError={deliveryLookup?.retryPreview}
        sizes={large ? '460px' : '220px'}
        className="object-contain"
        loading={thumbnailLoading}
        fallbackAllowed={fallbackAllowed}
        fallback={fallback}
        overlay={videoOverlay}
      />
    )
  }

  return fallback
}

function StorageMediaFallback({ item, image, large }: {
  item: StorageObjectItem
  image: boolean
  large: boolean
}) {
  const audio = item.mime_type?.startsWith('audio/')
  const Icon = audio ? AudioLines : image ? ImageIcon : isPickerDocument(item) ? FileText : Film
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon className={large ? 'size-14' : 'size-8'} />
      {!isStorageMediaSelectable(item) && isStorageMediaProcessing(item) ? (
        <span className="flex items-center gap-1 text-xs font-medium"><Loader2 className="size-3 animate-spin" /><UiText id="processing_e63451d3" /></span>
      ) : !isStorageMediaSelectable(item) ? (
        <span className="text-xs font-medium"><UiText id="unavailable_2c9c1f79" /></span>
      ) : !isStorageMediaReady(item) ? (
        <span className="text-xs font-medium"><UiText id="uploaded_80c49489" /></span>
      ) : null}
    </div>
  )
}

function StoragePlayableVideoPreview({
  item,
  channelId,
  posterUrls,
  onPreviewError,
}: {
  item: StorageObjectItem
  channelId: string
  posterUrls: Array<string | null>
  onPreviewError?: (failedUrl: string) => void
}) {
  const [opened, setOpened] = React.useState(false)
  const [playbackState, setPlaybackState] = React.useState<{
    key: string
    status: 'loading' | 'ready' | 'error'
  }>({ key: 'none:0', status: 'loading' })
  const [playbackAttempt, setPlaybackAttempt] = React.useState(0)
  const streamFrameRef = React.useRef<HTMLIFrameElement | null>(null)
  const deliveryQuery = useQuery({
    queryKey: ['storage', 'playback-url', channelId, item.id, getStorageMediaDeliveryVariant(item)],
    queryFn: () => getStorageDeliveryUrl({
      channelId,
      objectId: item.id,
      expiresInSeconds: 3600,
      variant: getStorageMediaDeliveryVariant(item),
    }),
    enabled: opened,
    staleTime: 45 * 60_000,
    refetchInterval: (query) => query.state.error
      ? false
      : storageDeliveryRefreshDelay(query.state.data),
    refetchOnWindowFocus: (query) => Boolean(query.state.data) && !query.state.error,
    retry: (failureCount, error) => {
      const status = error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: unknown }).status)
        : null
      if (status === 429 || (status !== null && Number.isFinite(status) && status < 500)) return false
      return failureCount < 1
    },
  })
  const delivery = deliveryQuery.data ?? null
  const status = !opened
    ? 'idle'
    : deliveryQuery.isPending
      ? 'loading'
      : deliveryQuery.isError
        ? 'error'
        : 'ready'
  const streamPlayerUrl = delivery
    && (delivery.variant === 'stream' || isEmbeddableVideoUrl(delivery.url))
    ? delivery.url
    : null
  const nativePlaybackUrl = delivery && !streamPlayerUrl
    ? delivery.url
    : null
  const playbackKey = `${delivery?.url ?? 'none'}:${playbackAttempt}`
  const playbackStatus = playbackState.key === playbackKey ? playbackState.status : 'loading'
  const setCurrentPlaybackStatus = React.useCallback((nextStatus: 'loading' | 'ready' | 'error') => {
    setPlaybackState({ key: playbackKey, status: nextStatus })
  }, [playbackKey])
  const revealCurrentPlayback = React.useCallback(() => {
    setPlaybackState((current) => revealStoragePlayback(current, playbackKey))
  }, [playbackKey])
  const registerStreamPlayer = React.useCallback(() => {
    const frame = streamFrameRef.current
    if (!frame || !streamPlayerUrl) return
    registerStoragePlayerEvents(frame, streamPlayerUrl, `storage-picker:${item.id}:${playbackAttempt}`)
  }, [item.id, playbackAttempt, streamPlayerUrl])

  React.useEffect(() => {
    if (!streamPlayerUrl) return undefined
    const frame = streamFrameRef.current
    const origin = getStoragePlayerOrigin(streamPlayerUrl)
    if (!frame?.contentWindow || !origin) {
      setCurrentPlaybackStatus('error')
      return undefined
    }
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin) return
      const message = parseStoragePlayerEvent(event.data)
      if (!message) return
      if (message.event === 'ready') setCurrentPlaybackStatus('ready')
      else if (message.event === 'error') setCurrentPlaybackStatus('error')
    }
    window.addEventListener('message', handleMessage)
    registerStreamPlayer()
    return () => window.removeEventListener('message', handleMessage)
  }, [playbackAttempt, registerStreamPlayer, setCurrentPlaybackStatus, streamPlayerUrl])

  React.useEffect(() => {
    if (!delivery?.url || playbackStatus !== 'loading') return undefined
    const timeoutId = window.setTimeout(revealCurrentPlayback, STORAGE_PLAYER_REVEAL_TIMEOUT_MS)
    return () => window.clearTimeout(timeoutId)
  }, [delivery?.url, playbackAttempt, playbackStatus, revealCurrentPlayback])

  const retryPlayback = () => {
    setPlaybackAttempt((value) => value + 1)
    void deliveryQuery.refetch()
  }

  if (status === 'ready' && delivery) {
    return (
      <div className="relative size-full overflow-hidden bg-black">
        {streamPlayerUrl ? (
        <iframe
          key={`${delivery.url}:${playbackAttempt}`}
          ref={streamFrameRef}
          src={withStoragePlayerAutoplayDisabled(delivery.url)}
          title={item.name}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy={STORAGE_PLAYER_REFERRER_POLICY}
          onLoad={() => {
            registerStreamPlayer()
            revealCurrentPlayback()
          }}
          onError={() => setCurrentPlaybackStatus('error')}
          className={cn(
            'size-full border-0 bg-black transition-opacity',
            playbackStatus === 'ready' ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />
        ) : (
          <video
            key={`${nativePlaybackUrl}:${playbackAttempt}`}
            src={nativePlaybackUrl ?? undefined}
            poster={posterUrls.find(Boolean) ?? undefined}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={() => setCurrentPlaybackStatus('ready')}
            onLoadedData={() => setCurrentPlaybackStatus('ready')}
            onCanPlay={() => setCurrentPlaybackStatus('ready')}
            onError={(event) => {
              if (event.currentTarget.error) setCurrentPlaybackStatus('error')
            }}
            className={cn(
              'size-full bg-black object-contain transition-opacity',
              playbackStatus === 'ready' ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          />
        )}
        {playbackStatus !== 'ready' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/42 text-white">
            {playbackStatus === 'error' ? (
              <>
                <Film className="size-10" />
                <span className="text-xs font-semibold"><UiText id="video_preview_unavailable_08a54bd6" /></span>
                <Button type="button" variant="secondary" size="sm" onClick={retryPlayback}><UiText id="try_again_042c862e" /></Button>
              </>
            ) : (
              <>
                <Loader2 className="size-8 animate-spin" />
                <span className="text-xs font-semibold"><UiText id="opening_video_1b77c2c8" /></span>
              </>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative size-full overflow-hidden bg-muted dark:bg-black/22">
      <StoragePreviewImage urls={posterUrls} sizes="420px" className="object-contain" onPreviewError={onPreviewError} />
      <button
        type="button"
        onClick={() => {
          setOpened(true)
          if (status === 'error') void deliveryQuery.refetch()
        }}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/16 text-white transition-colors hover:bg-black/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="size-8 animate-spin" />
            <span className="text-xs font-semibold"><UiText id="opening_video_1b77c2c8" /></span>
          </>
        ) : status === 'error' ? (
          <>
            <Film className="size-10" />
            <span className="text-xs font-semibold"><UiText id="video_preview_unavailable_08a54bd6" /></span>
          </>
        ) : (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-black/48 shadow-sm backdrop-blur-sm">
              <Play className="size-6 fill-current" />
            </span>
            <span className="text-xs font-semibold"><UiText id="open_video_player_6e929a6e" /></span>
          </>
        )}
      </button>
    </div>
  )
}

function StoragePreviewImage({
  urls,
  onPreviewError,
  sizes,
  className,
  loading = false,
  fallbackAllowed = true,
  fallback = null,
  overlay = null,
}: {
  urls: Array<string | null>
  onPreviewError?: (failedUrl: string) => void
  sizes: string
  className: string
  loading?: boolean
  fallbackAllowed?: boolean
  fallback?: React.ReactNode
  overlay?: React.ReactNode
}) {
  const [failedUrls, setFailedUrls] = React.useState<ReadonlySet<string>>(() => new Set())
  const [loadedUrl, setLoadedUrl] = React.useState<string | null>(null)
  const providedUrls = urls.filter((candidate): candidate is string => candidate !== null)
  const url = providedUrls.find((candidate) => !failedUrls.has(candidate)) ?? null
  const ready = url !== null && loadedUrl === url
  const exhausted = providedUrls.length > 0 && url === null
  const imageFallbackAllowed = useStorageThumbnailFallbackGrace(`image:${failedUrls.size}`, providedUrls.length > 0)
  const exhaustedFallbackAllowed = fallbackAllowed && imageFallbackAllowed

  if (!url) {
    if (loading || (exhausted && !exhaustedFallbackAllowed)) return <StorageThumbnailSkeleton />
    return fallback
  }

  return (
    <div className="relative size-full overflow-hidden">
      {!ready ? <StorageThumbnailSkeleton overlay /> : null}
      <Image
        key={url}
        src={url}
        alt=""
        fill
        sizes={sizes}
        unoptimized
        onLoad={() => setLoadedUrl(url)}
        className={cn(
          className,
          'transition-opacity duration-200 motion-reduce:transition-none',
          ready ? 'opacity-100' : 'opacity-0',
        )}
        onError={() => {
          onPreviewError?.(url)
          setLoadedUrl((current) => current === url ? null : current)
          setFailedUrls((current) => {
            if (current.has(url)) return current
            const next = new Set(current)
            next.add(url)
            return next
          })
        }}
      />
      {ready ? overlay : null}
    </div>
  )
}

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

function StorageThumbnailSkeleton({ overlay = false }: { overlay?: boolean }) {
  const tAuto = useTranslations('Auto')
  return (
    <span
      role="status"
      aria-label={tAuto('loading_preview_52816ebc')}
      className={cn(
        'pointer-events-none z-20 flex h-full w-full items-center justify-center overflow-hidden',
        overlay ? 'absolute inset-0' : 'relative',
      )}
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

export async function uploadStorageMedia(
  channelId: string,
  file: File,
  _mediaKind: StorageMediaKind,
  metadata: Record<string, string | number | boolean | null> | undefined,
  onProgress: (progress: number) => void,
  options: StorageMediaUploadOptions = {},
): Promise<StorageMediaSelection> {
  return storageUploadQueue.run(
    () => uploadStorageMediaNow(channelId, file, metadata, onProgress, options),
    options.signal,
  )
}

async function uploadStorageMediaNow(
  channelId: string,
  file: File,
  metadata: Record<string, string | number | boolean | null> | undefined,
  onProgress: (progress: number) => void,
  options: StorageMediaUploadOptions,
): Promise<StorageMediaSelection> {
  const mediaMetadata = await probeLocalMedia(file)
  throwIfUploadAborted(options.signal)
  const session = await initiateStorageUpload({
    channelId,
    file,
    preview: mediaMetadata?.preview,
    metadata,
    idempotencyKey: options.idempotencyKey,
    signal: options.signal,
    ...(options.parentPath && { parentPath: options.parentPath }),
  })
  throwIfUploadAborted(options.signal)
  let status: 'active' | 'processing' = 'processing'
  if (session.upload_status === 'uploaded' || session.upload_status === 'completed') {
    const completed = await completeStorageUpload({
      channelId,
      uploadSessionId: session.upload_session_id,
      finalizeToken: session.finalize_token,
      signal: options.signal,
    })
    status = completed.status
    onProgress(100)
  } else if (session.upload_mode === 'direct') {
    await uploadDirectContent({ session, file, onProgress, signal: options.signal })
    throwIfUploadAborted(options.signal)
    const completed = await completeStorageUpload({
      channelId,
      uploadSessionId: session.upload_session_id,
      finalizeToken: session.finalize_token,
      signal: options.signal,
    })
    status = completed.status
  } else if (session.upload_protocol === 'tus') {
    await uploadTusContent({ session, file, onProgress, signal: options.signal })
    throwIfUploadAborted(options.signal)
    const completed = await completeStorageUpload({
      channelId,
      uploadSessionId: session.upload_session_id,
      finalizeToken: session.finalize_token,
      signal: options.signal,
    })
    status = completed.status
  } else {
    const uploaded = await uploadProxyContent({ session, file, onProgress, signal: options.signal })
    throwIfUploadAborted(options.signal)
    if (uploaded.completed && (uploaded.status === 'active' || uploaded.status === 'processing')) {
      status = uploaded.status
    } else {
      const completed = await completeStorageUpload({
        channelId,
        uploadSessionId: session.upload_session_id,
        finalizeToken: session.finalize_token,
        signal: options.signal,
      })
      status = completed.status
    }
  }
  return {
    storageObjectId: session.object_id,
    name: file.name,
    mimeType: file.type || null,
    sizeBytes: String(file.size),
    status,
    durationSeconds: mediaMetadata?.durationSeconds ?? null,
    width: mediaMetadata?.width ?? null,
    height: mediaMetadata?.height ?? null,
    dimensionSource: mediaMetadata?.width && mediaMetadata.height ? 'source' : undefined,
    previewUrl: mediaMetadata?.preview?.data_url ?? null,
  }
}

function throwIfUploadAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Upload aborted.', 'AbortError')
}

function isStorageMediaUploadAbort(error: unknown, signal: AbortSignal) {
  if (signal.aborted) return true
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; name?: unknown }
  return candidate.code === 'STORAGE_UPLOAD_ABORTED' || candidate.name === 'AbortError'
}

function isPickerLibraryItem(item: StorageObjectItem) {
  return item.type === 'file'
    && item.visibility !== 'internal'
    && item.status !== 'deleted'
    && item.status !== 'quarantined'
}

function isPickerGif(item: StorageObjectItem) {
  return isStorageGifPreview({
    mimeType: item.mime_type,
    extension: item.extension,
    name: item.name,
  })
}

function isPickerElement(item: StorageObjectItem) {
  const mime = item.mime_type?.toLowerCase() ?? ''
  const extension = (item.extension ?? '').replace(/^\./, '').toLowerCase()
  const fileName = (item.name ?? '').split(/[\\/]/).pop()?.split('?')[0]?.toLowerCase() ?? ''
  return mime === 'image/svg+xml' || extension === 'svg' || fileName.endsWith('.svg')
}

function isPickerDocument(item: StorageObjectItem) {
  const mime = item.mime_type?.toLowerCase() ?? ''
  return mime.startsWith('application/') || mime.startsWith('text/')
}

function itemMatchesPickerView(item: StorageObjectItem, view: MediaPickerView) {
  if (!isPickerLibraryItem(item)) return false
  if (isIndexedStorageAvatarRole(item.asset_role)) return false
  const mime = item.mime_type?.toLowerCase() ?? ''
  const gif = isPickerGif(item)
  if (view === 'all') return true
  if (view === 'image') return mime.startsWith('image/') && !gif && !isPickerElement(item)
  if (view === 'gifs') return gif
  if (view === 'video' || view === 'clips') return mime.startsWith('video/')
  if (view === 'audio') return mime.startsWith('audio/')
  if (view === 'documents') return isPickerDocument(item)
  if (view === 'elements') return isPickerElement(item)
  return false
}

function isCompatibleWithMediaKind(item: StorageObjectItem, mediaKind: StorageMediaKind) {
  const mime = item.mime_type?.toLowerCase() ?? ''
  if (mediaKind === 'image') return mime.startsWith('image/')
  if (mediaKind === 'video') return mime.startsWith('video/')
  if (mediaKind === 'audio') return mime.startsWith('audio/')
  if (mediaKind === 'all') {
    return mime.startsWith('audio/') || mime.startsWith('video/') || mime.startsWith('image/')
  }
  return mime.startsWith('audio/') || mime.startsWith('video/')
}

function pickerStorageListInput(view: MediaPickerView, search: string): StorageListInput | null {
  if (view === 'voice') return null
  const trimmed = search.trim() || undefined
  const shared: StorageListInput = {
    type: 'file',
    scope: 'descendants',
    search: trimmed,
    sortBy: 'created_at',
    sortOrder: 'desc',
    limit: 100,
    offset: 0,
  }
  if (view === 'all') return shared
  if (view === 'clips') return { ...shared, category: 'video', sourceTool: 'viral_clips@1' }
  if (view === 'video') return { ...shared, category: 'video' }
  if (view === 'audio') return { ...shared, category: 'audio' }
  if (view === 'documents') return { ...shared, category: 'document' }
  return { ...shared, category: 'image' }
}

function defaultMediaPickerView(mediaKind: StorageMediaKind): MediaPickerView {
  if (mediaKind === 'image') return 'image'
  if (mediaKind === 'video') return 'video'
  if (mediaKind === 'audio') return 'audio'
  return 'all'
}

function formatVoiceOriginLabel(origin: string) {
  return origin.replace(/[_-]+/g, ' ')
}

function PickerVoicePreview({
  profile,
  channelId,
  playLabel,
  stopLabel,
}: {
  profile: VoiceProfile
  channelId: string | null
  playLabel: string
  stopLabel: string
}) {
  const tAuto = useTranslations('Auto')
  const [playing, setPlaying] = React.useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const requestRef = React.useRef(0)

  React.useEffect(() => {
    requestRef.current += 1
    audioRef.current?.pause()
    audioRef.current = null
    setPlaying(false)
    return () => {
      requestRef.current += 1
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [profile.id])

  async function togglePreview() {
    if (!channelId || !profile.preview_available) return
    if (playing) {
      requestRef.current += 1
      audioRef.current?.pause()
      audioRef.current = null
      setPlaying(false)
      return
    }
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setPlaying(true)
    const preview = await getVoiceProfilePreview(profile.id, channelId).catch(() => null)
    if (!preview || requestRef.current !== requestId) {
      if (requestRef.current === requestId) setPlaying(false)
      return
    }
    const audio = new Audio(preview.url)
    audio.preload = 'metadata'
    audio.onended = () => setPlaying(false)
    audio.onerror = () => setPlaying(false)
    audioRef.current = audio
    void audio.play().catch(() => setPlaying(false))
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
        <span className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mic className="size-10" />
        </span>
      </div>
      <div className="border-t border-border p-4">
        <p className="truncate text-sm font-medium text-foreground">{profile.display_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {profile.default_language ?? tAuto('multilingual_aaa850f7')} · {formatVoiceOriginLabel(profile.origin)}
        </p>
        {profile.preview_available && channelId ? (
          <Button type="button" variant="outline" className="mt-3 h-10 w-full rounded-xl" onClick={() => void togglePreview()}>
            {playing ? <Square className="size-4" /> : <Play className="size-4" />}
            {playing ? stopLabel : playLabel}
          </Button>
        ) : null}
      </div>
    </>
  )
}

function selectionFromItem(item: StorageObjectItem): StorageMediaSelection {
  const dimensions = getStorageMediaDimensions(item)
  return {
    storageObjectId: item.id,
    name: item.name,
    mimeType: item.mime_type,
    sizeBytes: item.size_bytes,
    status: isStorageMediaReady(item) ? 'active' : 'processing',
    durationSeconds: item.duration_seconds,
    width: dimensions.width,
    height: dimensions.height,
    dimensionSource: dimensions.source,
    previewUrl: null,
  }
}

function getStorageMediaDimensions(item: StorageObjectItem): {
  width: number | null
  height: number | null
  source?: 'source'
} {
  const sourceWidth = readPositiveNumber(item.metadata.width)
  const sourceHeight = readPositiveNumber(item.metadata.height)
  if (sourceWidth && sourceHeight) {
    return { width: sourceWidth, height: sourceHeight, source: 'source' }
  }

  return { width: null, height: null }
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, value])

  return debouncedValue
}

export const __storageMediaInputTestHooks = {
  selectionFromItem,
  isStorageMediaThumbnailCandidate,
}

function isStorageMediaThumbnailCandidate(item: StorageObjectItem) {
  return item.type === 'file'
    && (isStorageVideoItem(item) || isStorageImageItem(item))
}

function isStorageVideoItem(item: StorageObjectItem) {
  return item.mime_type?.toLowerCase().startsWith('video/') ?? false
}

function isStorageImageItem(item: StorageObjectItem) {
  return item.mime_type?.toLowerCase().startsWith('image/') ?? false
}

function getStorageMediaDeliveryVariant(item: StorageObjectItem): 'original' | undefined {
  return isStorageStreamVideo(item) && !item.playback_ready && isBrowserPlayableStorageVideo(item)
    ? 'original'
    : undefined
}

function isStorageStreamVideo(item: StorageObjectItem) {
  return item.delivery_variant === 'stream'
    || item.provider_kind === 'stream'
    || item.storage_key.startsWith('stream/')
}

function isBrowserPlayableStorageVideo(item: StorageObjectItem) {
  const mimeType = item.mime_type?.toLowerCase().split(';')[0]?.trim() ?? ''
  return mimeType === 'video/mp4' || mimeType === 'video/webm' || mimeType === 'video/ogg'
}

function isEmbeddableVideoUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'iframe.mediadelivery.net' || hostname.endsWith('.mediadelivery.net')
  } catch {
    return false
  }
}

function withStoragePlayerAutoplayDisabled(value: string) {
  try {
    const url = new URL(value)
    url.searchParams.set('autoplay', 'false')
    url.searchParams.set('preload', 'true')
    return url.toString()
  } catch {
    return value
  }
}

function storageStatusLabel(item: StorageObjectItem) {
  if (isStorageMediaReady(item)) return item.adaptive_ready ? 'Ready' : 'Original ready for tools'
  if (item.status === 'failed') return 'Processing failed'
  if (item.security_status === 'rejected' || isStorageMediaWorkflowBlocked(item)) return 'Security scan rejected'
  if (item.transfer_complete && item.security_status === 'pending') return 'Security check in progress'
  if (isHeuristicStorageScan(item)) return 'Trusted security scan required'
  return 'Finishing upload'
}

function isStorageMediaReady(item: StorageObjectItem) {
  return item.original_ready
    && item.workflow_ready
    && item.status !== 'failed'
    && item.status !== 'quarantined'
    && item.status !== 'deleted'
}

export function isStorageMediaSelectable(item: StorageObjectItem) {
  return (isStorageMediaReady(item) || isStorageMediaPendingSecurity(item))
    && (item.status === 'active' || item.status === 'processing')
    && !isStorageMediaWorkflowBlocked(item)
}

function isStorageMediaPendingSecurity(item: StorageObjectItem) {
  return item.transfer_complete
    && item.integrity_verified
    && item.security_status === 'pending'
    && item.readiness_reason === 'malware_scan_pending'
    && item.status !== 'failed'
    && item.status !== 'quarantined'
    && item.status !== 'deleted'
}

function isStorageMediaProcessing(item: StorageObjectItem) {
  return !isStorageMediaReady(item) && (isStorageMediaPendingSecurity(item)
    || item.status === 'processing'
    || item.status === 'pending'
    || (item.status === 'active' && storageMalwareStatus(item) === 'pending'))
}

export function selectedMediaReadinessPollInterval(
  item: StorageObjectItem | undefined,
  elapsedMs: number,
  failed: boolean,
): number | false {
  if (failed || elapsedMs >= SELECTED_MEDIA_READINESS_POLL_MAX_MS) return false
  if (!item || isStorageMediaProcessing(item)) {
    if (elapsedMs < 30_000) return SELECTED_MEDIA_INITIAL_POLL_INTERVAL_MS
    if (elapsedMs < 2 * 60_000) return SELECTED_MEDIA_SHORT_POLL_INTERVAL_MS
    if (elapsedMs < 5 * 60_000) return SELECTED_MEDIA_MEDIUM_POLL_INTERVAL_MS
    return SELECTED_MEDIA_LONG_POLL_INTERVAL_MS
  }
  return false
}

export function storageMediaPickerPollInterval(
  items: StorageObjectItem[],
  elapsedMs: number,
  forcePoll = false,
): number | false {
  const processingItem = items.find(isStorageMediaProcessing)
  if (processingItem) return selectedMediaReadinessPollInterval(processingItem, elapsedMs, false)
  if (forcePoll) return selectedMediaReadinessPollInterval(undefined, elapsedMs, false)
  return false
}

function storageMalwareStatus(item: StorageObjectItem) {
  return storageMalwareScan(item)?.status ?? null
}

function isStorageMediaWorkflowBlocked(item: StorageObjectItem) {
  const scan = storageMalwareScan(item)
  return scan?.status === 'failed'
}

function storageMalwareScan(item: StorageObjectItem) {
  const malwareScan = item.metadata.malware_scan
  if (typeof malwareScan !== 'object' || malwareScan === null || Array.isArray(malwareScan)) return null
  const record = malwareScan as Record<string, unknown>
  return {
    status: typeof record.status === 'string' ? record.status : null,
    scanMode: typeof record.scan_mode === 'string' ? record.scan_mode : null,
    heuristicOnly: record.heuristic_only === true,
  }
}

function isHeuristicStorageScan(item: StorageObjectItem) {
  const scan = storageMalwareScan(item)
  return scan?.scanMode === 'heuristic_clean' || scan?.heuristicOnly === true
}

function isAcceptedFile(file: File, mediaKind: StorageMediaKind) {
  return mediaKind === 'image'
    ? ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    : mediaKind === 'video'
    ? file.type.startsWith('video/')
    : mediaKind === 'audio'
      ? file.type.startsWith('audio/')
    : mediaKind === 'all'
      ? file.type.startsWith('audio/') || file.type.startsWith('video/') || file.type.startsWith('image/')
    : file.type.startsWith('audio/') || file.type.startsWith('video/')
}

async function probeLocalVideo(file: File): Promise<{
  durationSeconds: number | null
  width: number | null
  height: number | null
  preview: StoragePreviewInput | null
}> {
  const objectUrl = URL.createObjectURL(file)
  const fallback = { durationSeconds: null, width: null, height: null, preview: null }
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = objectUrl

  try {
    await waitForMediaEvent(video, 'loadedmetadata', 6000)
    if (video.readyState < 2) {
      await waitForMediaEvent(video, 'loadeddata', 6000).catch(() => undefined)
    }
    const durationSeconds = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null
    const previewTime = getVideoPreviewTime(video.duration)
    if (previewTime > 0.05) {
      video.currentTime = previewTime
      await waitForMediaEvent(video, 'seeked', 6000).catch(() => undefined)
    }
    const width = video.videoWidth > 0 ? video.videoWidth : null
    const height = video.videoHeight > 0 ? video.videoHeight : null
    const dataUrl = width && height ? await drawMediaPreview(video, 640, 640) : null
    return {
      durationSeconds,
      width,
      height,
      preview: dataUrl && width && height ? {
        source: 'client_generated',
        kind: 'video',
        data_url: dataUrl.dataUrl,
        width: dataUrl.width,
        height: dataUrl.height,
        duration_seconds: durationSeconds,
        generated_at: new Date().toISOString(),
      } : null,
    }
  } catch {
    return fallback
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

async function probeLocalMedia(file: File): Promise<{
  durationSeconds: number | null
  width: number | null
  height: number | null
  preview: StoragePreviewInput | null
} | null> {
  if (file.type.startsWith('video/')) return probeLocalVideo(file)
  if (file.type.startsWith('image/')) return probeLocalImage(file)
  return null
}

async function probeLocalImage(file: File): Promise<{
  durationSeconds: number | null
  width: number | null
  height: number | null
  preview: StoragePreviewInput | null
}> {
  const objectUrl = URL.createObjectURL(file)
  const fallback = { durationSeconds: null, width: null, height: null, preview: null }
  try {
    const image = await loadLocalImage(objectUrl)
    const width = image.naturalWidth > 0 ? image.naturalWidth : null
    const height = image.naturalHeight > 0 ? image.naturalHeight : null
    const dataUrl = width && height ? await drawMediaPreview(image, 640, 640) : null
    return {
      durationSeconds: null,
      width,
      height,
      preview: dataUrl && width && height ? {
        source: 'client_generated',
        kind: 'image',
        data_url: dataUrl.dataUrl,
        width: dataUrl.width,
        height: dataUrl.height,
        duration_seconds: null,
        generated_at: new Date().toISOString(),
      } : null,
    }
  } catch {
    return fallback
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadLocalImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function waitForMediaEvent(target: HTMLMediaElement, eventName: string, timeoutMs: number) {
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

async function drawMediaPreview(source: CanvasImageSource, maxWidth: number, maxHeight: number) {
  const sourceWidth = getCanvasSourceWidth(source)
  const sourceHeight = getCanvasSourceHeight(source)
  if (!sourceWidth || !sourceHeight) return null

  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1)
  const baseWidth = Math.max(1, Math.round(sourceWidth * scale))
  const baseHeight = Math.max(1, Math.round(sourceHeight * scale))
  const attempts = [
    { scale: 1, quality: 0.82, type: 'image/webp' },
    { scale: 1, quality: 0.68, type: 'image/webp' },
    { scale: 0.85, quality: 0.62, type: 'image/webp' },
    { scale: 0.7, quality: 0.56, type: 'image/webp' },
    { scale: 0.55, quality: 0.5, type: 'image/jpeg' },
    { scale: 0.42, quality: 0.45, type: 'image/jpeg' },
  ]
  for (const attempt of attempts) {
    const width = Math.max(1, Math.round(baseWidth * attempt.scale))
    const height = Math.max(1, Math.round(baseHeight * attempt.scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(source, 0, 0, width, height)
    const dataUrl = await canvasToDataUrl(canvas, attempt.type, attempt.quality).catch(() => null)
    if (!dataUrl) continue
    if (dataUrl.length <= 40_000) return { dataUrl, width, height }
  }
  return null
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

function getCanvasSourceWidth(source: CanvasImageSource) {
  if (source instanceof HTMLVideoElement) return source.videoWidth
  if (source instanceof HTMLImageElement) return source.naturalWidth
  if (source instanceof SVGImageElement) return source.width.baseVal.value
  if ('width' in source && typeof source.width === 'number') return source.width
  return 0
}

function getCanvasSourceHeight(source: CanvasImageSource) {
  if (source instanceof HTMLVideoElement) return source.videoHeight
  if (source instanceof HTMLImageElement) return source.naturalHeight
  if (source instanceof SVGImageElement) return source.height.baseVal.value
  if ('height' in source && typeof source.height === 'number') return source.height
  return 0
}

function getVideoPreviewTime(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0.25
  if (duration <= 1) return Math.max(0, duration / 2)
  return Math.min(Math.max(duration * 0.2, 0.5), 2)
}

function readPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function formatBytes(value: string) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function youtubeImportAvailableCredits(quotaUsage?: {
  available_credits?: number
  credit_balance?: number
} | null) {
  if (!quotaUsage) return null
  if (typeof quotaUsage.available_credits === 'number') return quotaUsage.available_credits
  if (typeof quotaUsage.credit_balance === 'number') return quotaUsage.credit_balance
  return null
}
