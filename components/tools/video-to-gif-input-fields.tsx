'use client'

import * as React from 'react'
import { mediaFrameCount } from '@/lib/tools/media-time'
import { Film, SlidersHorizontal } from 'lucide-react'

import { StorageMediaInput, type StorageMediaSelection } from '@/components/storage/storage-media-input'
import { getStoragePlaybackUrl } from '@/lib/storage/api'
import { Input } from '@/components/ui/input'
import {
  ToolField,
  ToolSelectField,
  type ToolChoice,
} from '@/components/tools/tool-primitives'
import type { MediaTransformSelectedMedia } from '@/components/tools/media-transform-input-fields'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'

type VideoToGifValues = Record<string, unknown>
export const MAX_GIF_PIXEL_FRAMES = 500_000_000

const MAX_GIF_DURATION_SECONDS = 30
export const DEFAULT_GIF_DURATION_SECONDS = 30
const TIMELINE_THUMBNAIL_COUNT = 8
const TIMELINE_THUMBNAIL_WIDTH = 144
const TIMELINE_THUMBNAIL_HEIGHT = 82

const FPS_OPTIONS: ToolChoice[] = [5, 8, 10, 12, 15, 20, 24, 30].map((value) => ({
  value: String(value),
  label: `${value} FPS`,
}))

const LOOP_OPTIONS: ToolChoice[] = [
  { value: '1', label: '1 time' },
  { value: '2', label: '2 times' },
  { value: '5', label: '5 times' },
  { value: '10', label: '10 times' },
]

const FIT_OPTIONS: ToolChoice[] = [
  { value: 'contain', label: 'Contain', description: 'Keep the whole frame.' },
  { value: 'cover', label: 'Cover', description: 'Fill the size and crop overflow.' },
  { value: 'stretch', label: 'Stretch', description: 'Force the requested width and height.' },
]

const QUALITY_OPTIONS: ToolChoice[] = [
  { value: 'draft', label: 'Draft', description: 'Smaller palette and faster conversion.' },
  { value: 'standard', label: 'Standard', description: 'Balanced colors and render time.' },
  { value: 'high', label: 'High', description: 'Best palette quality and a larger file.' },
]

export function VideoToGifInputFields({
  channelId,
  sourceMedia = null,
  values,
  onValueChange,
  onStorageMediaSelectionChange,
  onBusyChange,
}: {
  channelId: string | null
  sourceMedia?: MediaTransformSelectedMedia | null
  values: VideoToGifValues
  onValueChange: (name: string, value: unknown) => void
  onStorageMediaSelectionChange: (selection: MediaTransformSelectedMedia | null) => void
  onBusyChange: (busy: boolean) => void
}) {
  const tAuto = useTranslations('Auto')
  const [selectedMedia, setSelectedMedia] = React.useState<StorageMediaSelection | null>(null)
  const storageObjectId = stringValue(values.storage_object_id)
  const trim = objectValue(values.trim)
  const height = finiteNumber(values.height)
  const durationHint = finiteNumber(selectedMedia?.durationSeconds)
    ?? finiteNumber(values.duration_sec)
  const sourceDuration = durationHint !== null && durationHint >= 0.1 ? durationHint : null
  const normalizedTrim = normalizeTrimForTimeline(trim, sourceDuration)
  const loopCount = normalizeLoopCount(values.loop)
  const startSeconds = normalizedTrim.start
  const endSeconds = normalizedTrim.end
  const fps = finiteNumber(values.fps) ?? 10
  const width = finiteNumber(values.width) ?? 640
  const explicitPixelFrames = height !== null && endSeconds > startSeconds
    ? mediaFrameCount(endSeconds - startSeconds, fps) * width * height
    : null
  const workloadTooLarge = explicitPixelFrames !== null
    && explicitPixelFrames > MAX_GIF_PIXEL_FRAMES
  const activeSourceMedia: MediaTransformSelectedMedia | null = selectedMedia?.storageObjectId === storageObjectId
    ? {
      channelId,
      storageObjectId: selectedMedia.storageObjectId,
      name: selectedMedia.name,
      mimeType: selectedMedia.mimeType,
      durationSeconds: selectedMedia.durationSeconds,
      previewUrl: selectedMedia.previewUrl,
      width: selectedMedia.width,
      height: selectedMedia.height,
    }
    : sourceMedia?.storageObjectId === storageObjectId
      ? sourceMedia
      : null
  React.useEffect(() => {
    const currentStart = finiteNumber(trim.start_sec)
    const currentEnd = finiteNumber(trim.end_sec)
    if (currentStart === normalizedTrim.start && currentEnd === normalizedTrim.end) return
    onValueChange('trim', { start_sec: normalizedTrim.start, end_sec: normalizedTrim.end })
  }, [normalizedTrim.end, normalizedTrim.start, onValueChange, trim.end_sec, trim.start_sec])
  React.useEffect(() => {
    if (values.loop === undefined || values.loop === loopCount) return
    onValueChange('loop', loopCount)
  }, [loopCount, onValueChange, values.loop])

  return (
    <div className="space-y-5">
      <ToolField label={tAuto('media_0c77aeec')} hint={tAuto('required_eed6bfb4')}>
        <StorageMediaInput
          channelId={channelId}
          value={storageObjectId}
          selectedName={activeSourceMedia?.name ?? undefined}
          mediaKind="video"
          onBusyChange={onBusyChange}
          onChange={(selection) => {
            setSelectedMedia(selection)
            onValueChange('storage_object_id', selection?.storageObjectId)
            onValueChange('duration_sec', selection?.durationSeconds ?? undefined)
            onValueChange('media_ref', undefined)
            onValueChange('trim', defaultGifTrimRange(selection?.durationSeconds ?? null))
            onStorageMediaSelectionChange(selection ? {
              channelId,
              storageObjectId: selection.storageObjectId,
              name: selection.name,
              mimeType: selection.mimeType,
              durationSeconds: selection.durationSeconds,
              previewUrl: selection.previewUrl,
              width: selection.width,
              height: selection.height,
            } : null)
          }}
        />
      </ToolField>

      {activeSourceMedia ? (
        <VideoToGifSourcePreview
          sourceMedia={activeSourceMedia}
          values={values}
          onValueChange={onValueChange}
          compact
        />
      ) : null}

      <details className="group rounded-xl border border-border bg-panel/40">
        <summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1"><UiText id="advanced_settings_2e8bbf39" /></span>
        </summary>
        <div className="space-y-4 border-t border-border p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToolSelectField
              label={tAuto('loop_count_c65f52bf')}
              value={String(loopCount)}
              options={LOOP_OPTIONS}
              onValueChange={(value) => onValueChange('loop', Number(value))}
            />
            <ToolSelectField
              label={tAuto('frame_rate_a245d879')}
              value={String(integerValue(values.fps, 10))}
              options={FPS_OPTIONS}
              onValueChange={(value) => onValueChange('fps', Number(value))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label={tAuto('width_a58ddf50')}
              hint={tAuto('64_1920_px_d08619c0')}
              value={values.width ?? 640}
              min={64}
              max={1920}
              step={2}
              onValueChange={(value) => onValueChange('width', value)}
            />
            <NumberField
              label={tAuto('height_3f608b49')}
              hint="optional"
              value={values.height}
              min={64}
              max={1920}
              step={2}
              onValueChange={(value) => {
                onValueChange('height', value)
                if (value == null) onValueChange('fit', undefined)
              }}
            />
          </div>
          {height !== null ? (
            <ToolSelectField
              label={tAuto('fit_dab564d8')}
              value={stringValue(values.fit) || 'contain'}
              options={FIT_OPTIONS}
              onValueChange={(value) => onValueChange('fit', value)}
            />
          ) : null}
          {workloadTooLarge ? (
            <p role="alert" className="text-xs leading-5 text-destructive">
              <UiText id="this_gif_is_too_large_to_render_safely_reduce_cl_9490e633" /></p>
          ) : null}
          <ToolSelectField
            label={tAuto('quality_a60f2c73')}
            value={stringValue(values.quality) || 'standard'}
            options={QUALITY_OPTIONS}
            onValueChange={(value) => onValueChange('quality', value)}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            <UiText id="the_result_is_an_animated_image_without_audio_e8eace62" /></p>
        </div>
      </details>
    </div>
  )
}

export function VideoToGifSourcePreview({
  sourceMedia,
  values,
  onValueChange,
  compact = false,
}: {
  sourceMedia: MediaTransformSelectedMedia
  values: VideoToGifValues
  onValueChange: (name: string, value: unknown) => void
  compact?: boolean
}) {
  const tAuto = useTranslations('Auto')
  const [detectedDuration, setDetectedDuration] = React.useState<number | null>(null)
  const trim = objectValue(values.trim)
  const durationHint = finiteNumber(sourceMedia.durationSeconds)
    ?? finiteNumber(values.duration_sec)
    ?? detectedDuration
  const sourceDuration = durationHint !== null && durationHint >= 0.1 ? durationHint : null
  const normalizedTrim = normalizeTrimForTimeline(trim, sourceDuration)
  const startSeconds = normalizedTrim.start
  const endSeconds = normalizedTrim.end
  const timelineDuration = sourceDuration ?? Math.max(MAX_GIF_DURATION_SECONDS, endSeconds)
  const selectedDuration = Math.max(0, endSeconds - startSeconds)
  const [previewSeconds, setPreviewSeconds] = React.useState(startSeconds)
  const previewVideoRef = React.useRef<HTMLVideoElement | null>(null)
  const durationSecRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    durationSecRef.current = finiteNumber(values.duration_sec)
  }, [values.duration_sec])
  const deliveryUrl = sourceMedia.channelId && sourceMedia.storageObjectId
    ? getStoragePlaybackUrl({
        channelId: sourceMedia.channelId,
        objectId: sourceMedia.storageObjectId,
      })
    : null

  React.useEffect(() => {
    const currentStart = finiteNumber(trim.start_sec)
    const currentEnd = finiteNumber(trim.end_sec)
    if (currentStart === startSeconds && currentEnd === endSeconds) return
    onValueChange('trim', { start_sec: startSeconds, end_sec: endSeconds })
  }, [endSeconds, onValueChange, startSeconds, trim.end_sec, trim.start_sec])

  const updateTrim = React.useCallback((start: number, end: number) => {
    const next = normalizeTrimForTimeline({ start_sec: start, end_sec: end }, sourceDuration)
    onValueChange('trim', { start_sec: next.start, end_sec: next.end })
  }, [onValueChange, sourceDuration])

  const handleDurationDetected = React.useCallback((duration: number) => {
    const roundedDuration = roundTimelineSecond(duration)
    if (roundedDuration < 0.1) return
    setDetectedDuration(roundedDuration)
    const currentDuration = durationSecRef.current
    if (currentDuration === null || Math.abs(currentDuration - roundedDuration) >= 0.1) {
      onValueChange('duration_sec', roundedDuration)
    }
  }, [onValueChange])

  React.useEffect(() => {
    const video = previewVideoRef.current
    if (!video || !deliveryUrl) return
    const seekPreview = () => {
      if (video.seeking) {
        video.addEventListener('seeked', seekPreview, { once: true })
        return
      }
      if (!Number.isFinite(video.duration) || video.duration <= 0) return
      handleDurationDetected(video.duration)
      const nextTime = clampNumber(previewSeconds, 0, Math.max(0, video.duration - 0.05))
      if (Math.abs(video.currentTime - nextTime) >= 0.04) video.currentTime = nextTime
      video.pause()
    }
    const frame = video.readyState >= 1 ? window.requestAnimationFrame(seekPreview) : null
    if (frame === null) video.addEventListener('loadedmetadata', seekPreview, { once: true })
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      video.removeEventListener('loadedmetadata', seekPreview)
      video.removeEventListener('seeked', seekPreview)
    }
  }, [deliveryUrl, handleDurationDetected, previewSeconds])

  return (
    <div className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border border-border bg-panel/40">
        <div className={compact
          ? "relative flex min-h-44 items-center justify-center overflow-hidden bg-black"
          : "relative flex min-h-[300px] items-center justify-center overflow-hidden bg-black"}>
        {deliveryUrl ? (
          <video
            ref={previewVideoRef}
            key={`${sourceMedia.storageObjectId}:${deliveryUrl}`}
            src={deliveryUrl}
            poster={sourceMedia.previewUrl ?? undefined}
            controls
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => handleDurationDetected(event.currentTarget.duration)}
            className={compact
              ? "max-h-72 min-h-44 w-full object-contain"
              : "max-h-[min(54vh,620px)] min-h-[300px] w-full object-contain"}
          />
        ) : sourceMedia.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sourceMedia.previewUrl}
            alt=""
            className={compact
              ? "max-h-72 min-h-44 w-full object-contain"
              : "max-h-[min(54vh,620px)] min-h-[300px] w-full object-contain"}
          />
        ) : (
          <Film className="size-10 text-white/45" />
        )}
        </div>
      </div>
      <section className={compact
        ? "space-y-2.5 rounded-xl border border-border bg-panel/40 p-3.5"
        : "space-y-3 rounded-xl border border-border bg-panel/40 p-3.5"}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground"><UiText id="clip_range_5185cf1a" /></h3>
          <span className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs font-semibold tabular-nums text-emerald-400">
            {selectedDuration.toFixed(1)} {' '}<UiText id="sec_selected_ffb27b2d" /></span>
        </div>
        <GifVisualTimeline
          deliveryUrl={deliveryUrl}
          posterUrl={sourceMedia.previewUrl ?? null}
          timelineDuration={timelineDuration}
          startSeconds={startSeconds}
          endSeconds={endSeconds}
          onTrimChange={updateTrim}
          onPreviewTimeChange={setPreviewSeconds}
          onDurationDetected={handleDurationDetected}
          compact={compact}
        />
      </section>
    </div>
  )
}

function GifVisualTimeline({
  deliveryUrl,
  posterUrl,
  timelineDuration,
  startSeconds,
  endSeconds,
  onTrimChange,
  onPreviewTimeChange,
  onDurationDetected,
  compact = false,
}: {
  deliveryUrl: string | null
  posterUrl: string | null
  timelineDuration: number
  startSeconds: number
  endSeconds: number
  onTrimChange: (start: number, end: number) => void
  onPreviewTimeChange: (seconds: number) => void
  onDurationDetected: (duration: number) => void
  compact?: boolean
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const [thumbnails, setThumbnails] = React.useState<Array<string | null>>(
    () => Array.from({ length: TIMELINE_THUMBNAIL_COUNT }, () => null),
  )
  const [thumbnailState, setThumbnailState] = React.useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const [loadedFrameCount, setLoadedFrameCount] = React.useState(0)
  const timelineRef = React.useRef<HTMLDivElement | null>(null)
  const onDurationDetectedRef = React.useRef(onDurationDetected)
  const timelineDurationRef = React.useRef(timelineDuration)
  React.useEffect(() => {
    onDurationDetectedRef.current = onDurationDetected
    timelineDurationRef.current = timelineDuration
  }, [onDurationDetected, timelineDuration])
  const selectionDragRef = React.useRef<{
    pointerId: number
    originClientX: number
    originStart: number
    originEnd: number
    trackWidth: number
  } | null>(null)
  const startPercent = timelineDuration > 0 ? (startSeconds / timelineDuration) * 100 : 0
  const endPercent = timelineDuration > 0 ? (endSeconds / timelineDuration) * 100 : 0
  const selectionWidth = Math.max(0, endPercent - startPercent)
  const ticks = React.useMemo(() => buildTimelineTicks(timelineDuration), [timelineDuration])

  React.useEffect(() => {
    if (!deliveryUrl || typeof document === 'undefined') {
      setThumbnails(Array.from({ length: TIMELINE_THUMBNAIL_COUNT }, () => null))
      setLoadedFrameCount(0)
      setThumbnailState('idle')
      return
    }
    let cancelled = false
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      setThumbnailState('failed')
      return
    }
    const thumbnailContext = context

    const waitForVideoEvent = (eventName: string, timeoutMs = 8_000) => new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out waiting for ${eventName}`))
      }, timeoutMs)
      const cleanup = () => {
        window.clearTimeout(timeout)
        video.removeEventListener(eventName, handleSuccess)
        video.removeEventListener('error', handleError)
      }
      const handleSuccess = () => {
        cleanup()
        resolve()
      }
      const handleError = () => {
        cleanup()
        reject(new Error('Video preview failed'))
      }
      video.addEventListener(eventName, handleSuccess, { once: true })
      video.addEventListener('error', handleError, { once: true })
    })

    async function generateThumbnails() {
      setThumbnailState('loading')
      setThumbnails(Array.from({ length: TIMELINE_THUMBNAIL_COUNT }, () => null))
      setLoadedFrameCount(0)
      try {
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.playsInline = true
        video.preload = 'metadata'
        video.src = deliveryUrl!
        video.load()
        if (video.readyState < 1) await waitForVideoEvent('loadedmetadata')
        if (cancelled) return
        const duration = Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : timelineDurationRef.current
        onDurationDetectedRef.current(duration)
        if (video.readyState < 2) await waitForVideoEvent('loadeddata')
        canvas.width = TIMELINE_THUMBNAIL_WIDTH
        canvas.height = TIMELINE_THUMBNAIL_HEIGHT
        const lastFrameTime = Math.max(0, duration - 0.05)
        const frameTimes = Array.from({ length: TIMELINE_THUMBNAIL_COUNT }, (_, index) => {
          const ratio = (index + 0.5) / TIMELINE_THUMBNAIL_COUNT
          return clampNumber(ratio * duration, 0, lastFrameTime)
        })
        let completedFrames = 0
        for (const [index, frameTime] of frameTimes.entries()) {
          try {
            if (Math.abs(video.currentTime - frameTime) >= 0.025 || video.readyState < 2) {
              const seeked = waitForVideoEvent('seeked')
              video.currentTime = frameTime
              await seeked
            }
            if (cancelled) return
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
            drawVideoCoverFrame(thumbnailContext, video, TIMELINE_THUMBNAIL_WIDTH, TIMELINE_THUMBNAIL_HEIGHT)
            const frame = canvas.toDataURL('image/jpeg', 0.68)
            completedFrames += 1
            setThumbnails((current) => {
              const next = [...current]
              next[index] = frame
              return next
            })
            setLoadedFrameCount(completedFrames)
          } catch {
            if (cancelled) return
          }
        }
        if (!cancelled) setThumbnailState(completedFrames > 0 ? 'ready' : 'failed')
      } catch {
        if (!cancelled) {
          setThumbnailState('failed')
        }
      }
    }

    void generateThumbnails()
    return () => {
      cancelled = true
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [deliveryUrl])

  const handleSelectionPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const track = timelineRef.current
    if (!track) return
    const trackWidth = track.getBoundingClientRect().width
    if (trackWidth <= 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    selectionDragRef.current = {
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originStart: startSeconds,
      originEnd: endSeconds,
      trackWidth,
    }
  }, [endSeconds, startSeconds])

  const dragFrameRef = React.useRef<number | null>(null)
  const pendingRangeRef = React.useRef<{ start: number; end: number } | null>(null)
  const flushDrag = React.useCallback(() => {
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current)
    dragFrameRef.current = null
    const range = pendingRangeRef.current
    pendingRangeRef.current = null
    if (!range) return
    onTrimChange(range.start, range.end)
    onPreviewTimeChange(range.start)
  }, [onPreviewTimeChange, onTrimChange])
  React.useEffect(() => () => {
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current)
  }, [])

  const handleSelectionPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = selectionDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const selectedLength = drag.originEnd - drag.originStart
    const deltaSeconds = ((event.clientX - drag.originClientX) / drag.trackWidth) * timelineDuration
    const nextStart = roundTimelineSecond(clampNumber(
      drag.originStart + deltaSeconds,
      0,
      Math.max(0, timelineDuration - selectedLength),
    ))
    const nextEnd = roundTimelineSecond(nextStart + selectedLength)
    pendingRangeRef.current = { start: nextStart, end: nextEnd }
    if (dragFrameRef.current === null) dragFrameRef.current = window.requestAnimationFrame(flushDrag)
  }, [flushDrag, timelineDuration])

  const handleSelectionPointerEnd = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (selectionDragRef.current?.pointerId !== event.pointerId) return
    flushDrag()
    selectionDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [flushDrag])

  const handleSelectionKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const selectedLength = endSeconds - startSeconds
    const maxStart = Math.max(0, timelineDuration - selectedLength)
    let nextStart = startSeconds
    if (event.key === 'ArrowLeft') nextStart -= event.shiftKey ? 1 : 0.1
    else if (event.key === 'ArrowRight') nextStart += event.shiftKey ? 1 : 0.1
    else if (event.key === 'Home') nextStart = 0
    else if (event.key === 'End') nextStart = maxStart
    else return
    event.preventDefault()
    nextStart = roundTimelineSecond(clampNumber(nextStart, 0, maxStart))
    onTrimChange(nextStart, roundTimelineSecond(nextStart + selectedLength))
    onPreviewTimeChange(nextStart)
  }, [endSeconds, onPreviewTimeChange, onTrimChange, startSeconds, timelineDuration])

  return (
    <div className="space-y-2">
      <div
        ref={timelineRef}
        aria-busy={thumbnailState === 'loading'}
        className={compact
          ? "relative h-20 overflow-hidden rounded-lg border border-white/[0.12] bg-black shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_24px_rgba(0,0,0,0.16)]"
          : "relative h-24 overflow-hidden rounded-lg border border-white/[0.12] bg-black shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_24px_rgba(0,0,0,0.16)]"}
      >
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${TIMELINE_THUMBNAIL_COUNT}, minmax(0, 1fr))` }}>
          {thumbnails.map((thumbnail, index) => {
            const frame = thumbnail ?? posterUrl
            return (
            <div key={index} className="relative min-w-0 overflow-hidden border-r border-white/[0.06] last:border-r-0">
              {frame ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frame} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(24_24_27),rgb(9_9_11))]" />
              )}
            </div>
            )
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 bg-black/62" style={{ width: `${startPercent}%` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 bg-black/62" style={{ left: `${endPercent}%` }} />
        <div
          role="slider"
          aria-label={tAuto('move_gif_selection_a0e83cc4')}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, timelineDuration - (endSeconds - startSeconds))}
          aria-valuenow={startSeconds}
          aria-valuetext={tAuto('time_range_from_to', { start: formatTimelineTime(startSeconds), end: formatTimelineTime(endSeconds) })}
          tabIndex={0}
          onKeyDown={handleSelectionKeyDown}
          onPointerDown={handleSelectionPointerDown}
          onPointerMove={handleSelectionPointerMove}
          onPointerUp={handleSelectionPointerEnd}
          onPointerCancel={handleSelectionPointerEnd}
          className="absolute inset-y-0.5 z-10 cursor-grab touch-none rounded-[7px] border-2 border-white/75 bg-white/[0.055] shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_0_10px_rgba(255,255,255,0.08)] active:cursor-grabbing active:bg-white/[0.08]"
          style={{ left: `${startPercent}%`, width: `${selectionWidth}%` }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 z-20 flex h-11 w-2.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/90 bg-white/95 shadow-[0_1px_7px_rgba(0,0,0,0.4)]"
          style={{ left: `clamp(5px, ${startPercent}%, calc(100% - 5px))` }}
        >
          <span className="h-4 w-px rounded-full bg-slate-400/75" />
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 z-20 flex h-11 w-2.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/90 bg-white/95 shadow-[0_1px_7px_rgba(0,0,0,0.4)]"
          style={{ left: `clamp(5px, ${endPercent}%, calc(100% - 5px))` }}
        >
          <span className="h-4 w-px rounded-full bg-slate-400/75" />
        </span>
        <input
          aria-label={tAuto('gif_start_time_60f1d532')}
          type="range"
          min={0}
          max={timelineDuration}
          step={0.1}
          value={startSeconds}
          onChange={(event) => {
            const currentLength = Math.min(MAX_GIF_DURATION_SECONDS, Math.max(0.1, endSeconds - startSeconds))
            const nextStart = clampNumber(
              Number(event.target.value),
              0,
              Math.max(0, timelineDuration - currentLength),
            )
            onTrimChange(nextStart, nextStart + currentLength)
            onPreviewTimeChange(nextStart)
          }}
          className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-12 -translate-y-1/2 appearance-none bg-transparent opacity-0 accent-primary [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
        <input
          aria-label={tAuto('gif_end_time_1fb730c5')}
          type="range"
          min={0}
          max={timelineDuration}
          step={0.1}
          value={endSeconds}
          onChange={(event) => {
            const maxEnd = Math.min(timelineDuration, startSeconds + MAX_GIF_DURATION_SECONDS)
            const nextEnd = clampNumber(Number(event.target.value), startSeconds + 0.1, maxEnd)
            onTrimChange(startSeconds, nextEnd)
            onPreviewTimeChange(nextEnd)
          }}
          className="pointer-events-none absolute inset-x-0 top-1/2 z-40 h-12 -translate-y-1/2 appearance-none bg-transparent opacity-0 accent-primary [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
        {thumbnailState === 'loading' ? (
          <span className="pointer-events-none absolute right-2 top-2 z-50 rounded bg-black/68 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/78">
            {loadedFrameCount}/{TIMELINE_THUMBNAIL_COUNT}
          </span>
        ) : null}
      </div>
      <div className="relative h-6 text-[10px] tabular-nums text-muted-foreground">
        {ticks.map((tick, index) => (
          <span
            key={tick.value}
            className={`absolute top-0 flex flex-col gap-0.5 ${index === 0
              ? 'items-start'
              : index === ticks.length - 1
                ? '-translate-x-full items-end'
                : '-translate-x-1/2 items-center'}`}
            style={{ left: `${tick.percent}%` }}
          >
            <span className="h-1.5 w-px bg-border dark:bg-white/20" />
            <span>{toolCopy(tick.label)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function NumberField({ label, hint, value, min, max, step, onValueChange }: {
  label: string
  hint?: string
  value: unknown
  min: number
  max: number
  step: number
  onValueChange: (value: number | undefined) => void
}) {
  return (
    <ToolField label={label} hint={hint}>
      <Input
        type="number"
        value={finiteNumber(value) ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onValueChange(event.target.value === '' ? undefined : Number(event.target.value))}
        className="h-11 rounded-xl border-border bg-panel/40 shadow-none"
      />
    </ToolField>
  )
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function integerValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function normalizeLoopCount(value: unknown) {
  const loopCount = integerValue(value, 2)
  return LOOP_OPTIONS.some((option) => Number(option.value) === loopCount) ? loopCount : 2
}

export function defaultGifTrimRange(sourceDuration: number | null) {
  const duration = sourceDuration !== null && sourceDuration >= 0.1
    ? roundTimelineSecond(sourceDuration)
    : null
  const end = duration === null
    ? DEFAULT_GIF_DURATION_SECONDS
    : Math.min(DEFAULT_GIF_DURATION_SECONDS, Math.max(0.1, duration))
  return { start_sec: 0, end_sec: end }
}

function normalizeTrimForTimeline(
  trim: Record<string, unknown>,
  sourceDuration: number | null,
) {
  const timelineDuration = sourceDuration ?? Math.max(
    MAX_GIF_DURATION_SECONDS,
    finiteNumber(trim.end_sec) ?? DEFAULT_GIF_DURATION_SECONDS,
  )
  const maxStart = Math.max(0, timelineDuration - 0.1)
  const start = clampNumber(finiteNumber(trim.start_sec) ?? 0, 0, maxStart)
  const requestedEnd = finiteNumber(trim.end_sec) ?? start + DEFAULT_GIF_DURATION_SECONDS
  const maxEnd = Math.min(timelineDuration, start + MAX_GIF_DURATION_SECONDS)
  const end = clampNumber(requestedEnd, start + 0.1, maxEnd)
  return {
    start: roundTimelineSecond(start),
    end: roundTimelineSecond(end),
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

function roundTimelineSecond(value: number) {
  return Math.round(value * 10) / 10
}

function buildTimelineTicks(duration: number) {
  const tickCount = duration >= 45 ? 6 : 5
  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1)
    const value = roundTimelineSecond(duration * ratio)
    return {
      value,
      percent: ratio * 100,
      label: formatTimelineTime(value),
    }
  })
}

function drawVideoCoverFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const sourceWidth = video.videoWidth || width
  const sourceHeight = video.videoHeight || height
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const offsetX = (width - drawWidth) / 2
  const offsetY = (height - drawHeight) / 2
  context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight)
}

function formatTimelineTime(value: number) {
  const totalTenths = Math.max(0, Math.round(value * 10))
  const totalSeconds = Math.floor(totalTenths / 10)
  const tenths = totalTenths % 10
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}
