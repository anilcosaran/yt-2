'use client'

import * as React from 'react'
import { UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import type { AvatarShot } from '@/lib/avatar/api'
import type { CropBox } from '@/lib/avatar/shot-actions'
import { useStorageThumbnailUrl } from '@/lib/storage/use-storage-thumbnail-url'
import { cn } from '@/lib/utils'

export function ShotPreview({
  channelId,
  shot,
  crop,
  cropInteractive,
  onCropChange,
  className,
}: {
  channelId: string | null
  shot: AvatarShot | null
  crop: CropBox | null
  cropInteractive: boolean
  onCropChange: (crop: CropBox) => void
  className?: string
}) {
  const t = useTranslations('BrandAvatar')
  const frameRef = React.useRef<HTMLDivElement | null>(null)
  const dragRef = React.useRef<{ startX: number; startY: number } | null>(null)
  const thumbnail = useStorageThumbnailUrl({
    channelId,
    objectId: shot?.storage_object_id ?? '',
    enabled: Boolean(channelId && shot?.storage_object_id),
    allowOriginalImageFallback: true,
  })
  const removed = shot?.background_mode === 'removed'
  const box = crop && crop.width > 0 && crop.height > 0 ? crop : null

  const pointerToPercent = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const node = frameRef.current
    if (!node) return null
    const rect = node.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  return (
    <div
      ref={frameRef}
      data-crop-mode={cropInteractive ? 'interactive-select' : 'idle'}
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-2xl border border-border',
        removed
          ? 'bg-[linear-gradient(45deg,#1f1f23_25%,transparent_25%),linear-gradient(-45deg,#1f1f23_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1f23_75%),linear-gradient(-45deg,transparent_75%,#1f1f23_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0]'
          : 'bg-panel',
        cropInteractive && thumbnail.data?.url ? 'cursor-crosshair' : '',
        className,
      )}
      onPointerDown={(event) => {
        if (!cropInteractive || !thumbnail.data?.url) return
        const point = pointerToPercent(event)
        if (!point) return
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = { startX: point.x, startY: point.y }
        onCropChange({ x: point.x, y: point.y, width: 0, height: 0 })
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag) return
        const point = pointerToPercent(event)
        if (!point) return
        const x = Math.min(drag.startX, point.x)
        const y = Math.min(drag.startY, point.y)
        onCropChange({
          x,
          y,
          width: Math.abs(point.x - drag.startX),
          height: Math.abs(point.y - drag.startY),
        })
      }}
      onPointerUp={() => {
        dragRef.current = null
      }}
    >
      {thumbnail.data?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail.data.url}
          alt=""
          className={cn('h-full w-full object-cover', removed && 'mix-blend-normal')}
        />
      ) : (
        <div className="text-center text-muted-foreground">
          <UserRound className="mx-auto size-8 opacity-60" />
          <p className="mt-2 text-sm">{shot ? t('selectShot') : t('noPreview')}</p>
        </div>
      )}
      {box ? (
        <div
          className="pointer-events-none absolute border-2 border-primary/80 bg-primary/10"
          style={{
            left: `${box.x}%`,
            top: `${box.y}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
          }}
        />
      ) : null}
    </div>
  )
}

export function ShotThumb({
  channelId,
  shot,
}: {
  channelId: string | null
  shot: AvatarShot
}) {
  const thumbnail = useStorageThumbnailUrl({
    channelId,
    objectId: shot.storage_object_id ?? '',
    enabled: Boolean(channelId && shot.storage_object_id),
    allowOriginalImageFallback: true,
  })
  return (
    <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-accent">
      {thumbnail.data?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail.data.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <UserRound className="absolute inset-0 m-auto size-6 text-muted-foreground" />
      )}
    </span>
  )
}

export function ShotStatusBadge({ status }: { status: AvatarShot['status'] }) {
  const t = useTranslations('BrandAvatar')
  const label = status === 'processing' ? t('shotProcessing') : status === 'failed' ? t('shotFailed') : t('shotCompleted')
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px]',
        status === 'processing' && 'border-amber-400/30 text-amber-300',
        status === 'failed' && 'border-destructive/40 text-destructive',
        status === 'completed' && 'border-emerald-400/30 text-emerald-300',
      )}
    >
      {label}
    </Badge>
  )
}
