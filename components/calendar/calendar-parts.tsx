'use client'

import * as React from 'react'
import Image from 'next/image'
import { Check, CircleCheck, CircleDashed, Clock, Scissors, Sparkles, Workflow, type LucideIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import type { CalendarSource, CalendarStatus, StrongSlot } from '@/lib/calendar/store'
import { cn } from '@/lib/utils'

// Pieces the calendar page and the schedule dialog share.

export type ShownStatus = Exclude<CalendarStatus, 'approved'>

/** The statuses the calendar shows, in the legend's order. */
export const STATUS_ORDER: readonly ShownStatus[] = ['live', 'scheduled', 'review']

/**
 * Monochrome status marks: an icon and a word, coloured from the text tokens. The one accent is the review state's
 * icon (amber): it is the only one that waits on the user.
 */
const STATUS_MARK: Record<CalendarStatus, { icon: LucideIcon; iconClass: string }> = {
  live: { icon: CircleCheck, iconClass: 'text-foreground' },
  scheduled: { icon: Clock, iconClass: 'text-muted-foreground' },
  review: { icon: CircleDashed, iconClass: 'text-amber-500' },
  approved: { icon: Check, iconClass: 'text-foreground' },
}

export function StatusIcon({ status, className }: { status: CalendarStatus; className?: string }) {
  const { icon: StatusGlyph, iconClass } = STATUS_MARK[status]
  return <StatusGlyph aria-hidden className={cn('size-3.5 shrink-0', iconClass, className)} />
}

/** "Yayında", "Planlandı", "Onay bekliyor", "Onaylandı" as a small labelled chip. */
export function StatusChip({ status, className }: { status: CalendarStatus; className?: string }) {
  const labels = useCalendarLabels()
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-[12px] font-medium leading-4 text-foreground', className)}>
      <StatusIcon status={status} />
      <span className="truncate">{labels.status(status)}</span>
    </span>
  )
}

const SOURCE_ICON: Record<CalendarSource, LucideIcon> = {
  spark: Sparkles,
  short: Scissors,
  flow: Workflow,
}

/** A 16:9 thumbnail; the source's icon on a muted tile when there is no image (or it fails to load). */
export function CalendarThumb({
  src,
  source,
  sizes = '48px',
  className,
}: {
  src: string | null | undefined
  source: CalendarSource
  sizes?: string
  className?: string
}) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const local = Boolean(src?.startsWith('/'))
  const usable = Boolean(src) && failedSrc !== src && (local || /^https?:\/\//.test(src ?? ''))
  const SourceIcon = SOURCE_ICON[source]
  return (
    <span className={cn('relative block aspect-video shrink-0 overflow-hidden rounded-[5px] bg-muted', className)}>
      {usable ? (
        <Image
          src={src!}
          alt=""
          fill
          sizes={sizes}
          unoptimized={!local}
          draggable={false}
          onError={() => setFailedSrc(src ?? null)}
          className="object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <SourceIcon className="size-3.5" />
        </span>
      )}
    </span>
  )
}

/** The calendar's labels, formatted in the app's wall-clock convention (see `lib/calendar/store.ts`). */
export function useCalendarLabels() {
  const t = useTranslations('Calendar')
  const format = useFormatter()
  return React.useMemo(() => ({
    time: (date: Date) => format.dateTime(date, { hour: '2-digit', minute: '2-digit' }),
    when: (date: Date) => format.dateTime(date, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    /** "Cuma 21:00 · en aktif saat", or "21:00 · en aktif saat" inside its own day. */
    slot: (slot: StrongSlot, withDay = true) => t('suggestedSlot', {
      slot: format.dateTime(slot.at, withDay ? { weekday: 'long', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' }),
      reason: t(`slotReason.${slot.reason}`),
    }),
    status: (status: CalendarStatus) => t(`status.${status}`),
    source: (source: CalendarSource) => t(`source.${source}`),
    views: (views: number) => t('views', { count: format.number(views, 'compact') }),
  }), [format, t])
}
