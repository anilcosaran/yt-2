'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { PageContainer } from '@/components/common/page-container'
import { PageHeader } from '@/components/common/page-header'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  addDays,
  addMonths,
  approveCalendarItem,
  canMove,
  dayKey,
  findCalendarItem,
  itemDate,
  moveCalendarItem,
  parseDayKey,
  sameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  strongSlotsBetween,
  useCalendarItems,
  wallNow,
  type CalendarItem,
  type StrongSlot,
} from '@/lib/calendar/store'
import { cn } from '@/lib/utils'

import { CalendarThumb, STATUS_ORDER, StatusChip, useCalendarLabels, type ShownStatus } from './calendar-parts'
import { ScheduleDialog } from './schedule-dialog'

type View = 'week' | 'month'
type DayEntry =
  | { kind: 'item'; time: number; item: CalendarItem }
  | { kind: 'slot'; time: number; slot: StrongSlot }
type DragControls = {
  dragId: string | null
  onDragStart: (event: React.DragEvent, item: CalendarItem) => void
  onDragEnd: () => void
}

const DAY_MS = 86_400_000
/** Videos listed in a month cell before "+N daha". */
const MONTH_ROWS = 3
/** The calendar's surface: a solid card with a hairline, large radius. */
const panel = 'overflow-hidden rounded-2xl border border-border bg-card'
/** A quiet bordered control on the toolbar. */
const toolbarControl = 'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-[13px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * The channel's calendar: its videos only — published (thumbnail and views), scheduled (time and where it came
 * from), awaiting review (Shorts cut by Viral Clips land here) — and the strong slots still empty, each with
 * "Doldur". A month (default; `?view=week` opens the week); drag a video to another day to reschedule it.
 */
export function CalendarPage() {
  const t = useTranslations('Calendar')
  const items = useCalendarItems()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')
  const itemParam = searchParams.get('item')
  const viewParam: View = searchParams.get('view') === 'week' ? 'week' : 'month'

  return (
    <PageContainer>
      <PageHeader title={t('title')} description={t('subtitle')} className="mb-0" />
      {items ? (
        // A link into the calendar (`?date=`, `?item=`, `?view=`) starts it over at that day and that video.
        <CalendarBoard
          key={`${viewParam}|${dateParam ?? ''}|${itemParam ?? ''}`}
          items={items}
          initialView={viewParam}
          dateParam={dateParam}
          itemParam={itemParam}
        />
      ) : (
        <CalendarSkeleton />
      )}
    </PageContainer>
  )
}

function CalendarBoard({
  items,
  initialView,
  dateParam,
  itemParam,
}: {
  items: CalendarItem[]
  initialView: View
  dateParam: string | null
  itemParam: string | null
}) {
  const t = useTranslations('Calendar')
  const format = useFormatter()
  const labels = useCalendarLabels()
  const [now] = React.useState(wallNow)
  const today = startOfDay(now)
  const [initial] = React.useState(() => {
    const focused = itemParam ? findCalendarItem(itemParam) : null
    const focusedAt = focused ? itemDate(focused) : null
    const focusDay = parseDayKey(dateParam)
    return { anchor: startOfDay(focusDay ?? focusedAt ?? now), focusDay, focusId: focusedAt ? focused!.id : null }
  })
  const [view, setView] = React.useState<View>(initialView)
  const [anchor, setAnchor] = React.useState(initial.anchor)
  const [focusId, setFocusId] = React.useState<string | null>(initial.focusId)
  const [approving, setApproving] = React.useState<CalendarItem | null>(null)
  const [approveOpen, setApproveOpen] = React.useState(false)
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [dropKey, setDropKey] = React.useState<string | null>(null)

  const weekStart = startOfWeek(anchor)
  const monthStart = startOfMonth(anchor)
  const gridStart = view === 'week' ? weekStart : startOfWeek(monthStart)
  const daysInMonth = Math.round((addMonths(monthStart, 1).getTime() - monthStart.getTime()) / DAY_MS)
  const leading = Math.round((monthStart.getTime() - gridStart.getTime()) / DAY_MS)
  const dayCount = view === 'week' ? 7 : Math.ceil((leading + daysInMonth) / 7) * 7
  const days = Array.from({ length: dayCount }, (_, index) => addDays(gridStart, index))
  const rangeEnd = addDays(gridStart, dayCount)

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of items) {
      if (!item.at || item.status === 'approved') continue
      const key = item.at.slice(0, 10)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    for (const list of map.values()) list.sort((a, b) => a.at!.localeCompare(b.at!))
    return map
  }, [items])
  const approved = items.filter((item) => item.status === 'approved')
  const slots = strongSlotsBetween(gridStart, rangeEnd, items, now)
  const slotsOn = (day: Date) => slots.filter((slot) => sameDay(slot.at, day))
  const inView = (day: Date) => view === 'week' || day.getUTCMonth() === monthStart.getUTCMonth()
  const shownCount = days.reduce((count, day) => count + (inView(day) ? byDay.get(dayKey(day))?.length ?? 0 : 0), 0)

  // The video a link pointed at (or the one just placed) is scrolled into view.
  React.useEffect(() => {
    if (!focusId) return
    document.querySelector(`[data-calendar-item="${CSS.escape(focusId)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [focusId, view, anchor])

  const step = (direction: 1 | -1) => setAnchor(view === 'week' ? addDays(weekStart, direction * 7) : addMonths(monthStart, direction))
  const openWeek = (day: Date) => {
    setAnchor(day)
    setView('week')
  }
  const showPlaced = (placed: CalendarItem) => {
    setFocusId(placed.id)
    const at = itemDate(placed)
    if (at && (at < gridStart || at >= rangeEnd)) setAnchor(startOfDay(at))
  }
  const placeClip = (clip: CalendarItem, slot: StrongSlot) => {
    const placed = approveCalendarItem(clip.id, slot.at)
    if (!placed) return
    setFocusId(placed.id)
    toast.success(t('added'), { description: labels.when(slot.at) })
  }
  const approve = (item: CalendarItem) => {
    setApproving(item)
    setApproveOpen(true)
  }
  const endDrag = () => {
    setDragId(null)
    setDropKey(null)
  }
  const drag: DragControls = {
    dragId,
    onDragStart: (event, item) => {
      event.dataTransfer.setData('text/plain', item.id)
      event.dataTransfer.effectAllowed = 'move'
      setDragId(item.id)
    },
    onDragEnd: endDrag,
  }
  const dropOn = (day: Date, id: string) => {
    endDrag()
    const item = findCalendarItem(id)
    const from = item ? itemDate(item) : null
    if (!item || !from || !canMove(item) || sameDay(from, day)) return
    if (startOfDay(day).getTime() + (from.getTime() - startOfDay(from).getTime()) <= now.getTime()) {
      toast.error(t('pastDay'))
      return
    }
    if (moveCalendarItem(id, day)) setFocusId(id)
  }
  /** A day takes a dragged video when it is today or later. */
  const dropTarget = (day: Date) => {
    const key = dayKey(day)
    const open = Boolean(dragId) && day >= today
    return {
      onDragOver: (event: React.DragEvent) => {
        if (!open) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (dropKey !== key) setDropKey(key)
      },
      onDragLeave: (event: React.DragEvent) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDropKey((current) => (current === key ? null : current))
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault()
        const id = event.dataTransfer.getData('text/plain') || dragId
        if (id) dropOn(day, id)
      },
    }
  }

  const rangeLabel = view === 'week'
    ? format.dateTimeRange(weekStart, addDays(weekStart, 6), { day: 'numeric', month: 'long', year: 'numeric' })
    : format.dateTime(monthStart, { month: 'long', year: 'numeric' })

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" aria-label={view === 'week' ? t('previousWeek') : t('previousMonth')} title={view === 'week' ? t('previousWeek') : t('previousMonth')} onClick={() => step(-1)} className={cn(toolbarControl, 'w-8')}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label={view === 'week' ? t('nextWeek') : t('nextMonth')} title={view === 'week' ? t('nextWeek') : t('nextMonth')} onClick={() => step(1)} className={cn(toolbarControl, 'w-8')}>
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={() => setAnchor(today)} className={cn(toolbarControl, 'px-3')}>
            {t('today')}
          </button>
          <h2 className="ml-1 truncate text-[16px] font-semibold capitalize text-foreground" aria-live="polite">{rangeLabel}</h2>
        </div>
        <div className="flex items-center gap-3">
          <ul aria-label={t('legend')} className="hidden items-center gap-1.5 lg:flex">
            {STATUS_ORDER.map((status) => (
              <li key={status}><StatusChip status={status} /></li>
            ))}
          </ul>
          <div role="radiogroup" aria-label={t('viewLabel')} className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {(['month', 'week'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => setView(value)}
                className={cn(
                  'rounded-md px-3 py-1 text-[13px] font-medium transition-colors',
                  view === value ? 'bg-card text-foreground shadow-sm dark:bg-foreground/[0.12]' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(value)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <section className={cn(panel, 'mt-3')}>
          <div className="grid grid-cols-7 border-b border-border">
            {days.slice(0, 7).map((day) => (
              <span key={dayKey(day)} className="truncate px-2 py-2 text-[12px] font-medium capitalize text-muted-foreground">
                {format.dateTime(day, { weekday: 'short' })}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const key = dayKey(day)
              const list = byDay.get(key) ?? []
              const daySlots = slotsOn(day)
              const isToday = sameDay(day, today)
              return (
                // Clicking anywhere in the day opens its week; the day's number is the keyboard's way in.
                <div
                  key={key}
                  {...dropTarget(day)}
                  onClick={() => openWeek(day)}
                  className={cn(
                    'flex min-h-[104px] min-w-0 cursor-pointer flex-col gap-1.5 p-2 transition-colors hover:bg-muted/50 md:min-h-[128px]',
                    index % 7 !== 6 && 'border-r border-border',
                    index < dayCount - 7 && 'border-b border-border',
                    isToday && 'bg-foreground/[0.04]',
                    dropKey === key && 'bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      openWeek(day)
                    }}
                    aria-label={t('dayCount', { day: format.dateTime(day, { weekday: 'long', day: 'numeric', month: 'long' }), count: list.length })}
                    className="self-start rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <DayNumber day={day} today={isToday} muted={!inView(day)} focused={Boolean(initial.focusDay && sameDay(initial.focusDay, day))} />
                  </button>
                  {list.length > 0 ? (
                    <>
                      <ul className="hidden min-w-0 flex-col gap-0.5 md:flex">
                        {list.slice(0, MONTH_ROWS).map((item) => (
                          <MonthRow key={item.id} item={item} focused={focusId === item.id} drag={drag} />
                        ))}
                        {list.length > MONTH_ROWS ? (
                          <li className="px-1 text-[12px] font-medium text-muted-foreground">{t('more', { count: list.length - MONTH_ROWS })}</li>
                        ) : null}
                      </ul>
                      <span className="text-[12px] font-medium text-muted-foreground md:hidden">{t('videoCount', { count: list.length })}</span>
                    </>
                  ) : null}
                  {daySlots.map((slot) => (
                    <SlotChip key={slot.at.toISOString()} slot={slot} approved={approved} onPlace={placeClip} compact />
                  ))}
                </div>
              )
            })}
          </div>
          {shownCount === 0 ? <p className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">{t('emptyMonth')}</p> : null}
        </section>
      ) : (
        <section className={cn(panel, 'mt-3')}>
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-7 divide-x divide-border border-b border-border">
                {days.map((day) => {
                  const isToday = sameDay(day, today)
                  return (
                    <div key={dayKey(day)} className={cn('flex items-center gap-1.5 px-3 py-2', isToday && 'bg-foreground/[0.04]')}>
                      <span className={cn('text-[13px] font-medium capitalize', isToday ? 'text-foreground' : 'text-muted-foreground')}>
                        {format.dateTime(day, { weekday: 'short' })}
                      </span>
                      <DayNumber day={day} today={isToday} focused={Boolean(initial.focusDay && sameDay(initial.focusDay, day))} />
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-7 divide-x divide-border">
                {days.map((day) => {
                  const key = dayKey(day)
                  const entries: DayEntry[] = [
                    ...(byDay.get(key) ?? []).map((item) => ({ kind: 'item' as const, time: Date.parse(item.at!), item })),
                    ...slotsOn(day).map((slot) => ({ kind: 'slot' as const, time: slot.at.getTime(), slot })),
                  ].sort((a, b) => a.time - b.time)
                  return (
                    <div
                      key={key}
                      {...dropTarget(day)}
                      className={cn(
                        'flex min-h-[460px] min-w-0 flex-col gap-2 p-2 transition-colors',
                        sameDay(day, today) && 'bg-foreground/[0.04]',
                        dropKey === key && 'bg-muted',
                      )}
                    >
                      {entries.map((entry) => entry.kind === 'item' ? (
                        <WeekItem
                          key={entry.item.id}
                          item={entry.item}
                          focused={focusId === entry.item.id}
                          drag={drag}
                          onApprove={() => approve(entry.item)}
                        />
                      ) : (
                        <SlotChip key={`slot-${entry.time}`} slot={entry.slot} approved={approved} onPlace={placeClip} />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          {shownCount === 0 ? <p className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">{t('emptyWeek')}</p> : null}
        </section>
      )}

      {approving ? (
        <ScheduleDialog
          open={approveOpen}
          onOpenChange={setApproveOpen}
          item={{ id: approving.id, title: approving.title, thumbnail: approving.thumbnail, source: approving.source }}
          onScheduled={showPlaced}
        />
      ) : null}
    </>
  )
}

/** The day's number, 13px; today's semibold in a filled circle, a linked day (`?date=`) ringed. */
function DayNumber({ day, today, muted = false, focused = false }: { day: Date; today: boolean; muted?: boolean; focused?: boolean }) {
  const format = useFormatter()
  return (
    <span
      className={cn(
        'flex size-6 items-center justify-center rounded-full text-[13px] tabular-nums',
        today ? 'bg-foreground font-semibold text-background' : muted ? 'text-muted-foreground' : 'font-medium text-foreground',
        focused && !today && 'ring-1 ring-foreground',
      )}
    >
      {format.number(day.getUTCDate())}
    </span>
  )
}

function itemTitle(item: CalendarItem, labels: ReturnType<typeof useCalendarLabels>, hint: string | null) {
  return [labels.status(item.status), item.title, hint].filter(Boolean).join(' · ')
}

/** One video in a month cell: thumbnail, time, title. Its status is in its tooltip; the week shows the chip. */
function MonthRow({ item, focused, drag }: { item: CalendarItem; focused: boolean; drag: DragControls }) {
  const labels = useCalendarLabels()
  const movable = canMove(item)
  return (
    <li
      data-calendar-item={item.id}
      draggable={movable}
      onDragStart={movable ? (event) => drag.onDragStart(event, item) : undefined}
      onDragEnd={drag.onDragEnd}
      title={itemTitle(item, labels, null)}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted',
        movable && 'cursor-grab active:cursor-grabbing',
        drag.dragId === item.id && 'opacity-40',
        focused && 'ring-2 ring-ring',
      )}
    >
      <CalendarThumb src={item.thumbnail} source={item.source} sizes="40px" className="w-10" />
      <time dateTime={item.at ?? undefined} className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
        {item.at ? labels.time(new Date(item.at)) : null}
      </time>
      <span className="min-w-0 truncate text-[13px] text-foreground">{item.title}</span>
      <span className="sr-only">{labels.status(item.status)}</span>
    </li>
  )
}

/** One video in the week: thumbnail, time, title, its status chip and what it needs (views, its source, "Onayla"). */
function WeekItem({ item, focused, drag, onApprove }: { item: CalendarItem; focused: boolean; drag: DragControls; onApprove: () => void }) {
  const t = useTranslations('Calendar')
  const labels = useCalendarLabels()
  const status = item.status as ShownStatus
  const movable = canMove(item)
  const detail = status === 'live' && item.views != null
    ? labels.views(item.views)
    : item.automation
      ? `${labels.source(item.source)} · ${t('automation')}`
      : status === 'review' ? null : labels.source(item.source)
  return (
    <div
      data-calendar-item={item.id}
      draggable={movable}
      onDragStart={movable ? (event) => drag.onDragStart(event, item) : undefined}
      onDragEnd={drag.onDragEnd}
      title={itemTitle(item, labels, movable ? t('dragHint') : item.automation ? t('automationHint') : null)}
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-background p-2 transition-[opacity,box-shadow,border-color]',
        movable && 'cursor-grab hover:border-border-strong active:cursor-grabbing',
        drag.dragId === item.id && 'opacity-40',
        focused && 'ring-2 ring-ring',
      )}
    >
      <div className="flex gap-2">
        <CalendarThumb src={item.thumbnail} source={item.source} className="w-12 self-start" />
        <div className="min-w-0 flex-1">
          <time dateTime={item.at ?? undefined} className="block text-[12px] leading-4 tabular-nums text-muted-foreground">
            {item.at ? labels.time(new Date(item.at)) : null}
          </time>
          <p className="truncate text-[13px] font-medium leading-5 text-foreground">{item.title}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <StatusChip status={status} />
        {detail ? <span className="min-w-0 truncate text-[12px] text-muted-foreground">{detail}</span> : null}
      </div>
      {status === 'review' ? (
        <button
          type="button"
          onClick={onApprove}
          className="inline-flex h-7 w-full items-center justify-center rounded-md border border-border bg-card text-[12px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('approve')}
        </button>
      ) : null}
    </div>
  )
}

/**
 * An empty strong slot, read as an action: "21:00 · en aktif saat" and "Doldur", which lists the approved clips to
 * put there. `compact` is the month cell's one-line form.
 */
function SlotChip({
  slot,
  approved,
  onPlace,
  compact = false,
}: {
  slot: StrongSlot
  approved: CalendarItem[]
  onPlace: (clip: CalendarItem, slot: StrongSlot) => void
  compact?: boolean
}) {
  const t = useTranslations('Calendar')
  const labels = useCalendarLabels()
  const [open, setOpen] = React.useState(false)
  const label = labels.slot(slot, false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            title={labels.slot(slot)}
            // The month cell opens its week on a click; the slot opens its own list instead.
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="hidden w-full min-w-0 items-center gap-1.5 rounded-md border border-dashed border-border-strong px-1.5 py-1 text-left text-[12px] transition-colors hover:border-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-foreground md:flex"
          >
            <Sparkles className="size-3.5 shrink-0 text-foreground" />
            <span className="shrink-0 tabular-nums text-muted-foreground">{labels.time(slot.at)}</span>
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 font-medium text-foreground">
              <Plus className="size-3.5" />
              {t('fill')}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full flex-col gap-2 rounded-lg border border-dashed border-border-strong bg-card p-2 text-left transition-colors hover:border-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-foreground"
          >
            <span className="flex min-w-0 items-start gap-1.5 text-[12px] leading-4 text-foreground">
              <Sparkles className="size-3.5 shrink-0 text-foreground" />
              <span>{label}</span>
            </span>
            <span className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-foreground text-[12px] font-medium text-background">
              <Plus className="size-3.5" />
              {t('fill')}
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl p-1.5" onClick={(event) => event.stopPropagation()}>
        <div className="px-2 pb-2 pt-1.5">
          <p className="text-[13px] font-semibold text-foreground">{labels.slot(slot)}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{t('fillHint')}</p>
        </div>
        {approved.length > 0 ? (
          <ul className="grid gap-0.5">
            {approved.map((clip) => (
              <li key={clip.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onPlace(clip, slot)
                  }}
                  className="group/clip flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <CalendarThumb src={clip.thumbnail} source={clip.source} sizes="56px" className="w-14" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">{clip.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <StatusChip status="approved" />
                      {labels.source(clip.source)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-medium text-foreground">{t('placeHere')}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-2 pb-2">
            <p className="text-[13px] text-muted-foreground">{t('noApprovedClips')}</p>
            <Link
              href="/tools?tool=viral-clips"
              className="mt-2 inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t('makeClips')}
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function CalendarSkeleton() {
  return (
    <div aria-hidden className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className={cn(panel, 'mt-3 h-[560px]')} />
    </div>
  )
}
