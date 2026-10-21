'use client'

import * as React from 'react'
import Image from 'next/image'
import { useFormatter } from 'next-intl'
import { CalendarClock, CircleCheck, Film, Scissors, Upload } from 'lucide-react'

import { ScheduleDialog, type ScheduleMode } from '@/components/calendar/schedule-dialog'
import type { CalendarItem } from '@/lib/calendar/store'
import { cn } from '@/lib/utils'
import type { DashboardTranslator, ShortClip } from './dashboard-model'
import { FooterLink, PanelHeader, SparkAction } from './dashboard-bits'
import { panel } from './dashboard-ui'

type ClipState = { kind: 'ready' } | { kind: 'live' } | { kind: 'scheduled'; slot: string }

function scoreDot(score: number) {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 60) return 'bg-amber-400'
  return 'bg-white/60'
}

/**
 * "Uzun videolarından Shorts": the strongest moments of the channel's long videos, shown the way they will play —
 * vertical, side by side, the hook over the frame. A suggestion's action cuts it in Viral Clips; a made and
 * approved one is published now or scheduled (the next strong slot first).
 */
export function ShortsShelf({ t, clips }: { t: DashboardTranslator; clips: ShortClip[] }) {
  const format = useFormatter()
  const [states, setStates] = React.useState<Record<string, ClipState>>({})
  const [dialog, setDialog] = React.useState<{ clip: ShortClip; mode: ScheduleMode } | null>(null)
  if (clips.length === 0) return null

  // The shared schedule dialog decides: live now, or a slot on the calendar (the next strong one preselected).
  const scheduled = (clip: ShortClip, item: CalendarItem) => {
    const next: ClipState = item.status === 'live' || !item.at
      ? { kind: 'live' }
      : { kind: 'scheduled', slot: format.dateTime(new Date(item.at), { weekday: 'short', hour: 'numeric', minute: '2-digit' }) }
    setStates((current) => ({ ...current, [clip.id]: next }))
  }

  return (
    <section className={cn(panel, 'min-w-0 p-6')}>
      <PanelHeader title={t('growth.clipsTitle')} subtitle={t('growth.clipsSubtitle')} count={clips.length} />
      <ul className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {clips.map((clip) => {
          const state = states[clip.id] ?? { kind: 'ready' }
          return (
            <li key={clip.id} className="group flex w-[188px] shrink-0 flex-col">
              <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-muted">
                <Image src={clip.thumbnail} alt="" fill sizes="188px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">{clip.range}</span>
                {clip.approved ? (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    <CircleCheck className="size-3.5" />
                    {t('growth.approved')}
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white" title={t('growth.score')}>
                    <span className={cn('size-2 rounded-full', scoreDot(clip.score))} />
                    {clip.score}
                  </span>
                )}
                <p className="absolute inset-x-2.5 bottom-2.5 line-clamp-3 text-[14px] font-semibold leading-snug text-white">{clip.hook}</p>
              </div>

              <div className="mt-2 flex min-h-9 items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-1 text-[13px] text-muted-foreground">
                  <Film className="size-3.5 shrink-0" />
                  <span className="truncate">{clip.source}</span>
                </span>
                {clip.approved ? null : (
                  <SparkAction
                    href={`/tools?tool=viral-clips&source=${encodeURIComponent(clip.id)}&start=${clip.start}&end=${clip.end}`}
                    label={t('growth.createShort')}
                    icon={Scissors}
                  />
                )}
              </div>

              {clip.approved ? (
                state.kind === 'ready' ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDialog({ clip, mode: 'now' })}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
                    >
                      <Upload className="size-3.5" />
                      {t('growth.publish')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ clip, mode: 'schedule' })}
                      aria-label={t('growth.schedule')}
                      title={t('growth.schedule')}
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground/[0.08] text-foreground transition-colors hover:bg-foreground/[0.12]"
                    >
                      <CalendarClock className="size-4" />
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                    {state.kind === 'live' ? t('growth.statusLive') : t('growth.scheduledFor', { time: state.slot })}
                  </p>
                )
              ) : null}
            </li>
          )
        })}
      </ul>
      <FooterLink href="/calendar" icon={CalendarClock}>{t('growth.calendar')}</FooterLink>
      {dialog ? (
        <ScheduleDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          item={{ id: `short:${dialog.clip.id}`, title: dialog.clip.hook, thumbnail: dialog.clip.thumbnail, source: 'short' }}
          defaultMode={dialog.mode}
          onScheduled={(item) => scheduled(dialog.clip, item)}
        />
      ) : null}
    </section>
  )
}
