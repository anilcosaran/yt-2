'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { CalendarDays, CalendarPlus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  addCalendarItem,
  addDays,
  calendarHref,
  getCalendarItems,
  nextStrongSlots,
  startOfDay,
  wallNow,
  withTime,
  type CalendarItem,
  type CalendarSource,
} from '@/lib/calendar/store'
import { cn } from '@/lib/utils'

import { CalendarThumb, useCalendarLabels } from './calendar-parts'

export type ScheduleMode = 'now' | 'schedule'

export type ScheduleDialogItem = {
  /**
   * The calendar item this is: a clip waiting for review, or a video placed before (placing it again moves it).
   * Without one, or with one the calendar does not have yet, a new item is added (under this id when given).
   */
  id?: string
  title: string
  /** A local `/…` image or an http(s) URL; the source's icon otherwise. */
  thumbnail?: string | null
  source: CalendarSource
}

export type ScheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ScheduleDialogItem
  /** "Planla" (the next empty strong slot preselected) unless asked otherwise. */
  defaultMode?: ScheduleMode
  /** After the item is on the calendar (the dialog has closed itself). */
  onScheduled?: (item: CalendarItem) => void
}

/**
 * The one schedule dialog: "Şimdi yayınla" or "Planla" (a date and time, the next empty strong slot preselected).
 * It writes to the calendar store and says so in a toast that leads to the calendar; it never navigates by itself,
 * so a project tab stays where it is.
 */
export function ScheduleDialog({ open, onOpenChange, item, defaultMode = 'schedule', onScheduled }: ScheduleDialogProps) {
  const t = useTranslations('Calendar')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t('dialog.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('dialog.description')}</DialogDescription>
        </DialogHeader>
        {/* Mounted while open only, so every opening starts from the next strong slot again. */}
        <ScheduleForm
          item={item}
          defaultMode={defaultMode}
          onCancel={() => onOpenChange(false)}
          onDone={(placed) => {
            onOpenChange(false)
            onScheduled?.(placed)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

/** A small button that opens the schedule dialog for one video ("Takvime ekle"); an icon unless given children. */
export function AddToCalendarButton({
  item,
  defaultMode,
  className,
  children,
}: {
  item: ScheduleDialogItem
  defaultMode?: ScheduleMode
  className?: string
  children?: React.ReactNode
}) {
  const t = useTranslations('Calendar')
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={t('addToCalendar')}
        title={t('addToCalendar')}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children ?? <CalendarPlus className="size-3.5" />}
      </button>
      <ScheduleDialog open={open} onOpenChange={setOpen} item={item} defaultMode={defaultMode} />
    </>
  )
}

function ScheduleForm({
  item,
  defaultMode,
  onCancel,
  onDone,
}: {
  item: ScheduleDialogItem
  defaultMode: ScheduleMode
  onCancel: () => void
  onDone: (item: CalendarItem) => void
}) {
  const t = useTranslations('Calendar')
  const format = useFormatter()
  const labels = useCalendarLabels()
  const router = useRouter()
  const [now] = React.useState(wallNow)
  // The item's own slot does not count as taken: placing it again can keep it there.
  const [suggestions] = React.useState(() => nextStrongSlots(getCalendarItems().filter((entry) => entry.id !== item.id), now))
  const [mode, setMode] = React.useState<ScheduleMode>(defaultMode)
  const [day, setDay] = React.useState(() => startOfDay(suggestions[0]?.at ?? addDays(now, 1)))
  const [time, setTime] = React.useState(() => (suggestions[0] ? timeValue(suggestions[0].at) : '18:00'))
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const dateLabelId = React.useId()

  const planned = atTime(day, time)
  const at = mode === 'now' ? now : planned
  const invalid = mode === 'schedule' && (!planned || planned <= now)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!at || invalid) return
    const placed = addCalendarItem({
      id: item.id,
      title: item.title,
      thumbnail: item.thumbnail ?? null,
      source: item.source,
      status: mode === 'now' ? 'live' : 'scheduled',
      at,
    })
    toast.success(t('added'), {
      description: labels.when(at),
      action: { label: t('viewInCalendar'), onClick: () => router.push(calendarHref(placed)) },
    })
    onDone(placed)
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
        <CalendarThumb src={item.thumbnail} source={item.source} sizes="80px" className="w-20" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-foreground" title={item.title}>{item.title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{labels.source(item.source)}</p>
        </div>
      </div>

      <div role="radiogroup" aria-label={t('dialog.mode')} className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5">
        {(['now', 'schedule'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              mode === value ? 'bg-card text-foreground shadow-sm dark:bg-foreground/[0.12]' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {value === 'now' ? t('publishNow') : t('schedule')}
          </button>
        ))}
      </div>

      {mode === 'now' ? (
        <p className="text-[13px] text-muted-foreground">{t('dialog.nowAt', { time: labels.time(now) })}</p>
      ) : (
        <div className="grid gap-4">
          {suggestions.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-[12px] font-medium text-muted-foreground">{t('dialog.suggested')}</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((slot) => {
                  const on = planned?.getTime() === slot.at.getTime()
                  return (
                    <button
                      key={slot.at.toISOString()}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setDay(startOfDay(slot.at))
                        setTime(timeValue(slot.at))
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium text-foreground transition-colors',
                        on
                          ? 'border-foreground bg-muted'
                          : 'border-dashed border-border-strong bg-card hover:border-foreground hover:bg-muted',
                      )}
                    >
                      <Sparkles className="size-3.5 shrink-0 text-foreground" />
                      {labels.slot(slot)}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <span id={dateLabelId} className="text-[12px] font-medium text-muted-foreground">{t('dialog.date')}</span>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" aria-labelledby={`${dateLabelId} ${dateLabelId}-value`} className="h-9 min-w-44 justify-start gap-2 rounded-lg bg-card text-[13px] font-medium text-foreground hover:bg-muted hover:text-foreground">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <span id={`${dateLabelId}-value`}>{format.dateTime(day, { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto rounded-xl p-0">
                  <Calendar
                    mode="single"
                    selected={toPickerDate(day)}
                    defaultMonth={toPickerDate(day)}
                    disabled={{ before: toPickerDate(startOfDay(now)) }}
                    onSelect={(picked) => {
                      if (!picked) return
                      setDay(fromPickerDate(picked))
                      setPickerOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">{t('dialog.time')}</span>
              <Input
                type="time"
                step={300}
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-invalid={invalid || undefined}
                className="h-9 w-32 rounded-lg bg-card text-[13px] font-medium tabular-nums text-foreground"
              />
            </label>
          </div>
          {invalid && planned ? <p className="text-[12px] text-destructive">{t('dialog.pastTime')}</p> : null}
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-muted-foreground">{t('dialog.demoNote')}</p>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('dialog.cancel')}</Button>
        <Button type="submit" disabled={invalid}>{mode === 'now' ? t('publishNow') : t('schedule')}</Button>
      </DialogFooter>
    </form>
  )
}

/** `21:00` from a wall-clock date. */
function timeValue(date: Date) {
  return date.toISOString().slice(11, 16)
}

function atTime(day: Date, value: string): Date | null {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return withTime(day, hours, minutes)
}

/** The day picker works in the browser's local dates; the calendar keeps wall-clock ones. */
function toPickerDate(day: Date) {
  return new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
}

function fromPickerDate(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}
