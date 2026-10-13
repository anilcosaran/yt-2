'use client'

import * as React from 'react'
import { FileVideo, LoaderCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatMediaDuration, type MediaDownloaderQuoteSnapshot } from '@/lib/workflows/media-downloader-quote'

import { MediaDownloaderLoadingWaves } from './media-downloader-loading-waves'
import styles from './media-downloader-metadata-preview.module.css'

type MediaDownloaderPreviewMetadata = Pick<
  MediaDownloaderQuoteSnapshot,
  'title' | 'thumbnailUrl' | 'durationSeconds' | 'width' | 'height'
>

type MediaDownloaderMetadataPreviewProps = (
  | { state: 'loading' }
  | { state: 'ready'; metadata: MediaDownloaderPreviewMetadata; refreshing: boolean }
) & { children?: React.ReactNode; footer?: React.ReactNode; loadingControls?: React.ReactNode }

export function getMediaDownloaderPreviewGeometry(width: number | null, height: number | null) {
  const hasDimensions = width !== null
    && height !== null
    && Number.isFinite(width)
    && Number.isFinite(height)
    && width > 0
    && height > 0
  if (!hasDimensions) {
    return { orientation: 'landscape' as const, aspectRatio: '16 / 9' }
  }
  const square = Math.abs(width - height) / Math.max(width, height) < 0.08
  const orientation = square ? 'square' as const : height > width ? 'portrait' as const : 'landscape' as const
  return { orientation, aspectRatio: `${width} / ${height}` }
}

export function MediaDownloaderMetadataPreview(props: MediaDownloaderMetadataPreviewProps) {
  const tAuto = useTranslations('Auto')
  const [failedThumbnailUrl, setFailedThumbnailUrl] = React.useState<string | null>(null)
  const [loadedThumbnail, setLoadedThumbnail] = React.useState<{
    url: string
    width: number
    height: number
  } | null>(null)
  const loading = props.state === 'loading'
  const metadata = props.state === 'ready' ? props.metadata : null
  const thumbnailUrl = metadata?.thumbnailUrl ?? null
  const showThumbnail = Boolean(thumbnailUrl) && failedThumbnailUrl !== thumbnailUrl
  const inferredThumbnail = loadedThumbnail?.url === thumbnailUrl ? loadedThumbnail : null
  const thumbnailReady = Boolean(inferredThumbnail)
  const thumbnailLoading = loading || (showThumbnail && !thumbnailReady)
  const metadataHasDimensions = Boolean(metadata?.width && metadata?.height && metadata.width > 0 && metadata.height > 0)
  const geometry = getMediaDownloaderPreviewGeometry(
    metadataHasDimensions ? metadata?.width ?? null : inferredThumbnail?.width ?? null,
    metadataHasDimensions ? metadata?.height ?? null : inferredThumbnail?.height ?? null,
  )
  const title = loading
    ? tAuto('media_downloader_metadata_loading')
    : metadata?.title || tAuto('media_downloader_quoted_media')
  const duration = formatMediaDuration(metadata?.durationSeconds ?? null)

  return (
    <>
      <div
        role={loading ? 'status' : undefined}
        aria-live={loading ? 'polite' : undefined}
        data-media-downloader-metadata-skeleton={loading || undefined}
        className={styles.row}
      >
        <div
          data-media-downloader-preview
          data-orientation={geometry.orientation}
          className="relative isolate flex aspect-[5/4] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black"
        >
          {thumbnailLoading ? <MediaDownloaderLoadingWaves /> : null}
          {showThumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbnailUrl ?? ''}
              alt={metadata?.title || tAuto('media_downloader_video_preview')}
              onLoad={(event) => {
                if (!thumbnailUrl || event.currentTarget.naturalWidth <= 0 || event.currentTarget.naturalHeight <= 0) return
                setLoadedThumbnail({
                  url: thumbnailUrl,
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }}
              onError={() => setFailedThumbnailUrl(thumbnailUrl)}
              className={cn('absolute inset-0 z-10 size-full object-contain transition-opacity duration-300 motion-reduce:transition-none', !thumbnailReady && 'opacity-0')}
            />
          ) : null}
          {thumbnailLoading || !showThumbnail ? (
            <span
              role={thumbnailLoading ? undefined : 'img'}
              aria-label={thumbnailLoading ? undefined : tAuto('preview_unavailable_36d31d45')}
              className="relative z-10 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground backdrop-blur-sm sm:size-12"
            >
              {thumbnailLoading
                ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none sm:size-6" />
                : <FileVideo aria-hidden="true" className="size-5 sm:size-6" />}
            </span>
          ) : null}
        </div>
        <div className={styles.details}>
          <div className="min-w-0 space-y-2 py-1">
            <div className="break-words text-sm font-semibold leading-5 [overflow-wrap:anywhere]">{title}</div>
            {duration ? (
              <div className="text-xs tabular-nums text-muted-foreground">{duration}</div>
            ) : loading ? (
              <Skeleton aria-hidden="true" className="h-3 w-20 max-w-full rounded-full bg-violet-200/10" />
            ) : null}
            {props.state === 'ready' && props.refreshing ? (
              <div role="status" aria-live="polite" className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
                <span>{tAuto('media_downloader_estimate_updating')}</span>
              </div>
            ) : null}
          </div>
          <div className={styles.controls}>
            {loading ? props.loadingControls ?? <MediaDownloaderDetailsSkeleton /> : props.children}
          </div>
        </div>
      </div>
      {props.state === 'ready' && !thumbnailLoading ? props.footer : null}
    </>
  )
}

function MediaDownloaderDetailsSkeleton() {
  const tAuto = useTranslations('Auto')
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[tAuto('media_downloader_media_type'), tAuto('quality_a60f2c73')].map((label) => (
          <div key={label} className="min-w-0 space-y-2">
            <div className="text-sm font-semibold">{label}</div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[tAuto('media_downloader_estimated_size'), tAuto('estimated_credits_7dbeefda')].map((label) => (
          <div key={label} className="min-w-0 space-y-1.5">
            <div className="text-[11px] leading-4 text-muted-foreground">{label}</div>
            <Skeleton className="h-4 w-16 max-w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
