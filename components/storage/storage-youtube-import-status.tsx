'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'

import { TableCell, TableRow } from '@/components/ui/table'
import { youtubeImportErrorText, YoutubeImportError, type YoutubeImportPhase } from '@/lib/storage/youtube-import'
import { toPublicRuntimeError } from '@/lib/public-runtime-error'
import { cn } from '@/lib/utils'

type StorageCopy = (key: string, values?: Record<string, string | number>) => string

export function youtubeImportStatusLabel(
  tStorage: StorageCopy,
  phase: YoutubeImportPhase | null,
) {
  if (!phase) return ''
  if (phase === 'failed') return tStorage('picker.youtubeFailed')
  if (phase === 'starting') return tStorage('picker.youtubeStarting')
  return tStorage('picker.youtubeProcessing')
}

export function youtubeImportUserMessage(
  error: unknown,
  tStorage: StorageCopy,
  localizeRuntimeError: (value: unknown) => string,
) {
  if (error instanceof YoutubeImportError) {
    if (error.code === 'invalid_url') return tStorage('picker.youtubeInvalid')
    if (error.code === 'too_long') return tStorage('picker.youtubeTooLong')
    if (error.code === 'timeout') return tStorage('picker.youtubeTimedOut')
    if (error.code === 'missing_output') return tStorage('picker.youtubeMissingOutput')
  }
  const raw = youtubeImportErrorText(error)
  const publicError = toPublicRuntimeError(raw)
  return publicError && publicError.code !== 'E3100' ? localizeRuntimeError(raw) : raw
}

export function YoutubeImportFailureAlert({
  message,
  videoId,
  extraCount,
  extraLabel,
  dismissLabel,
  onDismiss,
}: {
  message: string
  videoId: string | null
  extraCount: number
  extraLabel: string
  dismissLabel: string
  onDismiss: () => void
}) {
  const meta = [videoId, extraCount > 0 ? extraLabel : null].filter(Boolean).join(' · ')
  return (
    <div
      role="alert"
      className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        {meta ? <p className="mt-0.5 truncate text-[12px] text-destructive/80">{meta}</p> : null}
      </div>
      <button
        type="button"
        aria-label={dismissLabel}
        title={dismissLabel}
        onClick={onDismiss}
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export function YoutubeImportPlaceholderCard({
  label,
  statusLabel,
  failed,
  detail,
  thumbnailUrl,
}: {
  label: string
  statusLabel: string
  failed: boolean
  detail: string | null
  thumbnailUrl?: string | null
}) {
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string | null>(null)
  const visibleThumbnailUrl = thumbnailUrl && thumbnailUrl !== failedThumbnailUrl ? thumbnailUrl : null
  return (
    <div className={cn(
      'overflow-hidden rounded-xl border bg-background/40',
      failed ? 'border-destructive/40' : 'border-border',
    )}>
      <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-accent to-panel">
        {visibleThumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={visibleThumbnailUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={() => setFailedThumbnailUrl(visibleThumbnailUrl)}
          />
        ) : null}
        <span className="relative flex size-10 items-center justify-center rounded-full bg-background/80">
          {failed
            ? <AlertCircle className="size-6 text-destructive" />
            : <Loader2 className="size-6 animate-spin text-foreground" />}
        </span>
      </div>
      <div className="p-2">
        <p className={cn('truncate text-xs font-medium', failed ? 'text-destructive' : 'text-foreground')}>
          {statusLabel}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{detail && failed ? detail : label}</p>
      </div>
    </div>
  )
}

export function YoutubeImportPlaceholderListRow({
  label,
  statusLabel,
  failed,
  detail,
  selectionMode,
}: {
  label: string
  statusLabel: string
  failed: boolean
  detail: string | null
  selectionMode: boolean
}) {
  return (
    <TableRow className="h-12">
      {selectionMode ? <TableCell /> : null}
      <TableCell>
        <div className="flex max-w-full items-center gap-2">
          {failed
            ? <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          <span className={cn('truncate text-sm font-medium', failed ? 'text-destructive' : 'text-foreground')}>
            {statusLabel}
          </span>
          <span className="truncate text-sm text-muted-foreground">{detail && failed ? detail : label}</span>
        </div>
      </TableCell>
      <TableCell />
      <TableCell />
    </TableRow>
  )
}
