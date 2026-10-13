'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileAudio, Film, Folder, ImageIcon, Loader2, Play, X } from 'lucide-react'

import { UiText } from '@/components/i18n/ui-text'

import {
  StorageMediaPickerDialog,
  uploadStorageMedia,
  type StorageMediaKind,
  type StorageMediaSelection,
} from '@/components/storage/storage-media-input'
import { openFileInput } from '@/lib/storage/open-file-picker'
import {
  pickDefaultPublicVoiceProfile,
  VoiceProfilePickerDialog,
} from '@/components/tools/voice-profile-picker-dialog'
import { VoiceReferenceAudioInput } from '@/components/tools/voice-reference-audio-input'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  listVoiceProfiles,
  voiceProfilesQueryKey,
  type VoiceProfile,
} from '@/lib/voice/api'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { getStoragePlaybackUrl, storageUsageAggregateQueryKey, storageUsageQueryKey } from '@/lib/storage/api'
import {
  isStorageGifPreview,
  useStorageThumbnailUrl,
} from '@/lib/storage/use-storage-thumbnail-url'
import { cn } from '@/lib/utils'

export const workflowOpenAssetsEvent = 'youtorch:workflow-open-assets'

export type WorkflowOpenAssetsDetail = {
  nodeId: string
  mediaKind: StorageMediaKind
  settingKey?: string
}

export function dispatchWorkflowOpenAssets(detail: WorkflowOpenAssetsDetail) {
  window.dispatchEvent(new CustomEvent<WorkflowOpenAssetsDetail>(workflowOpenAssetsEvent, { detail }))
}

export function FlowCompactMediaField({
  label = 'Media',
  value,
  fileName,
  previewUrl,
  mediaKind = 'video',
  readOnly,
  nodeId,
  settingKey,
  onChange,
}: {
  label?: string
  value: string
  fileName?: string
  previewUrl?: string
  mediaKind?: StorageMediaKind
  readOnly?: boolean
  nodeId?: string
  settingKey?: string
  onChange: (patch: {
    storage_object_id?: string
    media_file_name?: string
    media_preview_url?: string
    duration_sec?: number
    media_ref?: undefined
  }) => void
}) {
  const { activeChannelId } = useActiveChannel()
  const queryClient = useQueryClient()
  const uploadInputRef = React.useRef<HTMLInputElement>(null)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [uploadState, setUploadState] = React.useState<{
    fileName: string
    phase: 'preparing' | 'uploading'
    progress: number
  } | null>(null)
  const kind: StorageMediaKind = mediaKind === 'audio' || mediaKind === 'image' || mediaKind === 'video'
    ? mediaKind
    : 'video'
  const displayName = fileName || (value ? `Media ${value.slice(0, 8)}` : '')
  const busy = Boolean(uploadState)
  const preview = useFlowStoragePreview({
    storageObjectId: value,
    mediaKind: kind,
    fileName,
    fallbackUrl: previewUrl,
  })

  const useCanvasPicker = Boolean(nodeId)

  const openPicker = React.useCallback(() => {
    if (readOnly || !activeChannelId) return
    if (nodeId) {
      dispatchWorkflowOpenAssets({ nodeId, mediaKind: kind, settingKey })
      return
    }
    setPickerOpen(true)
  }, [activeChannelId, kind, nodeId, readOnly, settingKey])

  const invalidateStorage = React.useCallback(() => {
    if (!activeChannelId) return
    void queryClient.invalidateQueries({ queryKey: ['storage', 'objects', activeChannelId] })
    void queryClient.invalidateQueries({ queryKey: storageUsageQueryKey(activeChannelId) })
    void queryClient.invalidateQueries({ queryKey: storageUsageAggregateQueryKey })
  }, [activeChannelId, queryClient])

  const applySelection = React.useCallback((selection: StorageMediaSelection | null) => {
    onChange({
      storage_object_id: selection?.storageObjectId,
      media_file_name: selection?.name,
      media_preview_url: selection?.previewUrl ?? undefined,
      duration_sec: selection?.durationSeconds ?? undefined,
      media_ref: undefined,
    })
  }, [onChange])

  const uploadFiles = React.useCallback(async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || !activeChannelId || busy) return
    setUploadState({ fileName: file.name, phase: 'preparing', progress: 0 })
    try {
      const selection = await uploadStorageMedia(activeChannelId, file, kind, undefined, (progress) => {
        setUploadState({ fileName: file.name, phase: 'uploading', progress })
      })
      invalidateStorage()
      applySelection(selection)
      setPickerOpen(false)
    } finally {
      setUploadState(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }, [activeChannelId, applySelection, busy, invalidateStorage, kind])

  return (
    <div className="nodrag nopan space-y-1" onPointerDown={(event) => event.stopPropagation()}>
      <span className="block text-[10px] font-medium uppercase tracking-normal text-muted-foreground">{label}</span>
      <div className="flex h-9 min-w-0 items-center gap-1.5 overflow-hidden rounded-[10px] border border-border/80 bg-muted/40">
        <button
          type="button"
          disabled={readOnly || !activeChannelId}
          onClick={openPicker}
          className="flex min-w-0 flex-1 items-center gap-2 px-1.5 text-left disabled:opacity-50"
        >
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {preview.thumbUrl && (kind === 'image' || kind === 'video') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.thumbUrl} alt="" className="size-7 object-contain" />
            ) : kind === 'audio' ? (
              <FileAudio className="size-3.5 text-muted-foreground" />
            ) : kind === 'image' ? (
              <ImageIcon className="size-3.5 text-muted-foreground" />
            ) : (
              <Film className="size-3.5 text-muted-foreground" />
            )}
          </span>
          <span className={cn('min-w-0 truncate text-[11px] font-medium', displayName ? 'text-foreground' : 'text-muted-foreground')}>
            {busy ? uploadState?.fileName : displayName || <UiText id="choose_media_7c2482b1" />}
          </span>
          {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" /> : null}
        </button>
        <button
          type="button"
          disabled={readOnly || !activeChannelId}
          aria-label="Choose from Assets"
          title="Choose from Assets"
          onClick={openPicker}
          className="flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Folder className="size-3.5" />
        </button>
        {value ? (
          <button
            type="button"
            disabled={readOnly}
            aria-label="Clear selected media"
            onClick={() => applySelection(null)}
            className="flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        accept={kind === 'image' ? 'image/*' : kind === 'audio' ? 'audio/*' : 'video/*'}
        className="hidden"
        onChange={(event) => void uploadFiles(event.target.files)}
      />
      {!useCanvasPicker && (
        <StorageMediaPickerDialog
          open={pickerOpen}
          channelId={activeChannelId}
          selectedObjectId={value || undefined}
          mediaKind={kind}
          uploadState={uploadState}
          onOpenChange={setPickerOpen}
          onUpload={() => openFileInput(uploadInputRef.current)}
          onSelect={(selection) => {
            applySelection(selection)
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}

export function isUsableFlowMediaUrl(value?: string | null): value is string {
  const url = value?.trim() ?? ''
  if (!url) return false
  return /^(https?:|data:|blob:)/i.test(url) || url.startsWith('/api/storage/')
}

function useFlowStoragePreview(input: {
  storageObjectId?: string
  mediaKind: StorageMediaKind
  fileName?: string
  fallbackUrl?: string
  preferOriginal?: boolean
}) {
  const { activeChannelId } = useActiveChannel()
  const storageObjectId = input.storageObjectId?.trim() ?? ''
  const kind = input.mediaKind === 'audio' || input.mediaKind === 'image' || input.mediaKind === 'video'
    ? input.mediaKind
    : 'video'
  const gif = isStorageGifPreview({ name: input.fileName })
  const wantsThumbnail = Boolean(activeChannelId && storageObjectId) && kind !== 'audio'
  const thumbnailQuery = useStorageThumbnailUrl({
    channelId: activeChannelId,
    objectId: storageObjectId,
    enabled: wantsThumbnail,
    preferOriginalDelivery: Boolean(input.preferOriginal) || (kind === 'image' && gif),
    allowOriginalImageFallback: kind === 'image',
  })
  const fallbackUrl = isUsableFlowMediaUrl(input.fallbackUrl) ? input.fallbackUrl.trim() : ''
  const playbackUrl = activeChannelId && storageObjectId && (kind === 'video' || kind === 'audio')
    ? getStoragePlaybackUrl({ channelId: activeChannelId, objectId: storageObjectId })
    : ''
  const thumbUrl = thumbnailQuery.data?.url || (kind === 'image' ? fallbackUrl : '')
  const mediaUrl = kind === 'image'
    ? (thumbUrl || fallbackUrl)
    : (playbackUrl || fallbackUrl)
  const loading = wantsThumbnail && !thumbUrl && (thumbnailQuery.isPending || thumbnailQuery.isFetching)

  return {
    kind,
    thumbUrl,
    mediaUrl,
    loading,
  }
}

export function FlowHelperMediaPreview({
  storageObjectId,
  fileName,
  mediaKind,
  fallbackUrl,
}: {
  storageObjectId?: string
  fileName?: string
  mediaKind: 'image' | 'video' | 'audio'
  fallbackUrl?: string
}) {
  const preview = useFlowStoragePreview({
    storageObjectId,
    mediaKind,
    fileName,
    fallbackUrl,
    preferOriginal: mediaKind === 'image',
  })

  if (preview.kind === 'audio') {
    if (!preview.mediaUrl) return null
    return <audio className="h-8 w-full" controls src={preview.mediaUrl} preload="metadata" />
  }

  if (!preview.mediaUrl && !preview.thumbUrl && !preview.loading) return null

  return (
    <div className="relative flex max-h-64 min-h-[132px] items-center justify-center overflow-hidden rounded-[10px] border border-border/80 bg-black">
      {preview.loading && !preview.thumbUrl && !preview.mediaUrl ? (
        <div className="h-32 w-full animate-pulse bg-muted" />
      ) : preview.kind === 'video' && preview.mediaUrl ? (
        <video
          className="max-h-64 w-full bg-black object-contain"
          src={preview.mediaUrl}
          poster={preview.thumbUrl || undefined}
          muted
          playsInline
          preload="metadata"
        />
      ) : preview.thumbUrl || preview.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="max-h-64 w-full bg-black object-contain"
          src={preview.thumbUrl || preview.mediaUrl}
          alt={fileName || ''}
        />
      ) : null}
      {preview.kind === 'video' && (preview.thumbUrl || preview.mediaUrl) ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-sm">
            <Play className="size-4 fill-current" />
          </span>
        </span>
      ) : null}
    </div>
  )
}

export function FlowVoiceProfileField({
  label = 'Voice',
  value,
  readOnly,
  modelId,
  language,
  autoSelectPublicVoice = false,
  onChange,
}: {
  label?: string
  value: string
  readOnly?: boolean
  modelId?: string
  language?: string
  autoSelectPublicVoice?: boolean
  onChange: (voiceProfileId: string) => void
}) {
  const { activeChannelId } = useActiveChannel()
  const resolvedModelId = modelId?.trim() || 'speech-natural-v1'
  const resolvedLanguage = language?.trim() || 'en'
  const stockInput = React.useMemo(() => ({
    channelId: activeChannelId ?? undefined,
    modelId: resolvedModelId,
    language: resolvedLanguage,
    origin: 'stock' as const,
    status: 'ready' as const,
    limit: 100,
    offset: 0,
  }), [activeChannelId, resolvedLanguage, resolvedModelId])
  const customInput = React.useMemo(() => ({
    channelId: activeChannelId ?? undefined,
    modelId: resolvedModelId,
    language: resolvedLanguage,
    origin: 'instant_clone' as const,
    status: 'ready' as const,
    limit: 100,
    offset: 0,
  }), [activeChannelId, resolvedLanguage, resolvedModelId])
  const enabled = Boolean(activeChannelId)
  const stockQuery = useQuery({
    queryKey: voiceProfilesQueryKey(stockInput),
    queryFn: ({ signal }) => listVoiceProfiles(stockInput, { signal }),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const customQuery = useQuery({
    queryKey: voiceProfilesQueryKey(customInput),
    queryFn: ({ signal }) => listVoiceProfiles(customInput, { signal }),
    enabled,
    staleTime: 5_000,
    retry: 1,
  })
  const profiles = React.useMemo(() => {
    const merged = new Map<string, VoiceProfile>()
    for (const profile of [...(stockQuery.data?.data ?? []), ...(customQuery.data?.data ?? [])]) {
      merged.set(profile.id, profile)
    }
    return [...merged.values()]
  }, [customQuery.data?.data, stockQuery.data?.data])
  const autoSelectedPublicVoiceId = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!autoSelectPublicVoice || readOnly) return
    if (value && value !== 'default') return
    const next = pickDefaultPublicVoiceProfile(profiles)
    if (!next || next.id === value) return
    if (autoSelectedPublicVoiceId.current === next.id) return
    autoSelectedPublicVoiceId.current = next.id
    onChange(next.id)
  }, [autoSelectPublicVoice, onChange, profiles, readOnly, value])

  return (
    <div className="nodrag nopan space-y-1" onPointerDown={(event) => event.stopPropagation()}>
      <span className="block text-[10px] font-medium uppercase tracking-normal text-muted-foreground">{label}</span>
      <VoiceProfilePickerDialog
        channelId={activeChannelId}
        modelId={resolvedModelId}
        modelLanguages={[resolvedLanguage]}
        defaultLanguage={resolvedLanguage}
        profiles={profiles}
        value={value || 'default'}
        compact
        disabled={readOnly || !enabled}
        stockLoading={stockQuery.isLoading}
        customLoading={customQuery.isLoading}
        stockError={stockQuery.isError}
        customError={customQuery.isError}
        onRetryStock={() => { void stockQuery.refetch() }}
        onRetryCustom={() => { void customQuery.refetch() }}
        onValueChange={onChange}
      />
    </div>
  )
}

export function FlowVoiceReferenceField({
  value,
  readOnly,
  inputSchema,
  onChange,
}: {
  value: string
  readOnly?: boolean
  inputSchema?: Record<string, unknown>
  onChange: (storageObjectId: string | null) => void
}) {
  const { activeChannelId } = useActiveChannel()
  return (
    <div className="nodrag nopan space-y-1" onPointerDown={(event) => event.stopPropagation()}>
      <span className="block text-[10px] font-medium uppercase tracking-normal text-muted-foreground">Reference voice</span>
      <VoiceReferenceAudioInput
        channelId={activeChannelId}
        value={value}
        disabled={readOnly}
        inputSchema={inputSchema}
        uploadMetadata={{
          asset_kind: 'voice_reference',
          origin_node_type: 'voice_clone@1',
          memory_indexing: 'disabled',
        }}
        onChange={onChange}
      />
    </div>
  )
}

export function FlowWarningField({ message }: { message: string }) {
  return (
    <p role="alert" className="nodrag rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] leading-4 text-destructive">
      {message}
    </p>
  )
}

export function FlowIndexStripField({
  selectedIndex,
  min,
  max,
  readOnly,
  onSelect,
}: {
  selectedIndex: number
  min: number
  max: number
  readOnly?: boolean
  onSelect: (index: number) => void
}) {
  const start = Number.isFinite(min) ? min : 0
  const end = Number.isFinite(max) ? Math.max(start, max) : start
  const chips = Array.from({ length: end - start + 1 }, (_, offset) => start + offset)
  return (
    <div className="nodrag nopan flex flex-wrap gap-1" role="listbox" aria-label="Frames">
      {chips.map((index) => {
        const selected = index === selectedIndex
        return (
          <button
            key={index}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={readOnly}
            className={cn(
              'flex size-7 items-center justify-center rounded-md border text-[11px] font-medium',
              selected
                ? 'border-foreground bg-foreground text-background'
                : 'border-border/80 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            onClick={() => onSelect(index)}
          >
            {index + 1}
          </button>
        )
      })}
    </div>
  )
}

export function FlowFrameGalleryField({
  items,
  selectedIndex,
  selectedIndexes,
  readOnly,
  multi,
  onSelect,
}: {
  items: Array<{ url: string; label?: string; kind?: 'image' | 'video' | 'audio' }>
  selectedIndex: number
  selectedIndexes?: number[]
  readOnly?: boolean
  multi?: boolean
  onSelect: (index: number) => void
}) {
  const [detailOpen, setDetailOpen] = React.useState(false)
  const selected = new Set(
    selectedIndexes && selectedIndexes.length > 0 ? selectedIndexes : [selectedIndex],
  )
  const primarySelected = [...selected][selected.size - 1] ?? selectedIndex
  if (items.length === 0) return null
  const visibleIndexes = items.length <= 3
    ? items.map((_, index) => index)
    : primarySelected >= 3
      ? [0, 1, primarySelected]
      : [0, 1, 2]
  const overflow = Math.max(0, items.length - 3)
  return (
    <div className="nodrag nopan space-y-1">
      <div className="grid grid-cols-4 gap-1" role="listbox" aria-label="Items" aria-multiselectable={multi}>
        {visibleIndexes.map((index) => {
          const item = items[index]
          if (!item) return null
          const isSelected = selected.has(index)
          return (
            <button
              key={`${item.url}-${index}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              title={item.label || `Item ${index + 1}`}
              className={cn(
                'aspect-square overflow-hidden rounded-md border bg-black',
                isSelected ? 'border-foreground ring-1 ring-foreground' : 'border-border/80 hover:border-foreground/60',
              )}
              onClick={() => {
                if (!readOnly) onSelect(index)
              }}
            >
              <FlowGalleryThumb item={item} />
            </button>
          )
        })}
        {overflow > 0 ? (
          <button
            type="button"
            className="flex aspect-square items-center justify-center rounded-md border border-border/80 bg-muted/50 text-[11px] font-semibold text-foreground"
            onClick={() => setDetailOpen(true)}
          >
            +{overflow}
          </button>
        ) : null}
      </div>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{readOnly ? 'Preview items' : multi ? 'Choose items' : 'Choose item'}</DialogTitle>
          <div className="grid max-h-[min(24rem,60vh)] grid-cols-4 gap-1.5 overflow-y-auto">
            {items.map((item, index) => {
              const isSelected = selected.has(index)
              return (
                <button
                  key={`all-${item.url}-${index}`}
                  type="button"
                  title={item.label || `Item ${index + 1}`}
                  className={cn(
                    'aspect-square overflow-hidden rounded-md border bg-black',
                    isSelected ? 'border-foreground ring-1 ring-foreground' : 'border-border/80',
                  )}
                  onClick={() => {
                    if (!readOnly) onSelect(index)
                    if (!multi) setDetailOpen(false)
                  }}
                >
                  <FlowGalleryThumb item={item} />
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FlowGalleryThumb({
  item,
}: {
  item: { url: string; label?: string; kind?: 'image' | 'video' | 'audio' }
}) {
  if (item.kind === 'audio') {
    return (
      <span className="flex size-full items-center justify-center text-muted-foreground">
        <FileAudio className="size-4" />
      </span>
    )
  }
  if (item.kind === 'video') {
    return <video src={item.url} muted playsInline className="size-full object-cover" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.url} alt={item.label || 'Item'} className="size-full object-cover" />
  )
}

function resolveAngleFieldChoice(
  raw: string | undefined,
  options: string[],
  optionLabels?: Record<string, string>,
) {
  if (raw && options.includes(raw)) return raw
  const fromLabel = options.find((option) => optionLabels?.[option] === raw)
  if (fromLabel) return fromLabel
  return 'custom'
}

export function FlowAngleIntentField({
  value,
  options,
  optionLabels,
  selectedAngles,
  readOnly,
  onChange,
  onSelectPreset,
}: {
  value: string
  options: string[]
  optionLabels?: Record<string, string>
  selectedAngles: string[]
  readOnly?: boolean
  onChange: (value: string) => void
  onSelectPreset?: (preset: string) => void
}) {
  const selectedChoice = resolveAngleFieldChoice(selectedAngles[0], options, optionLabels)
  const isCustom = selectedChoice === 'custom'
  return (
    <div className="nodrag nopan space-y-1.5">
      <label className="grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[11px] text-muted-foreground">Angle</span>
        <select
          disabled={readOnly}
          value={selectedChoice}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => (onSelectPreset ?? onChange)(event.target.value)}
          className="h-8 min-w-0 rounded-[10px] border border-border/80 bg-muted/40 px-2.5 text-[12px] font-medium text-foreground outline-none disabled:appearance-none"
          aria-label="Angle"
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-card text-foreground">
              {optionLabels?.[option] ?? option.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>
      {isCustom ? (
        <textarea
          value={value}
          disabled={readOnly}
          rows={3}
          maxLength={600}
          aria-label="Angle prompt"
          placeholder="Standing from the right, from behind, 45 degrees…"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[4.5rem] w-full resize-none rounded-[10px] border border-border/80 bg-muted/40 px-2 py-1.5 text-[12px] text-foreground outline-none"
        />
      ) : null}
    </div>
  )
}

export function FlowMediaPreview({
  previewUrl,
  fileName,
  kind,
}: {
  previewUrl?: string
  fileName?: string
  kind?: 'image' | 'video' | 'audio'
}) {
  if (!previewUrl) return null
  return (
    <div className="nodrag overflow-hidden rounded-[10px] border border-border/80 bg-black">
      {kind === 'audio' ? (
        <audio className="w-full" src={previewUrl} controls />
      ) : kind === 'video' ? (
        <video className="aspect-video h-auto w-full bg-black object-contain" src={previewUrl} controls playsInline />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="h-full w-full bg-black object-contain" src={previewUrl} alt={fileName || 'Inbound media'} />
      )}
    </div>
  )
}
