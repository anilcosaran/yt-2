'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Eye, Plus, Timer, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DashboardFormatter, DashboardTranslator, MoveGroup, MoveTone, VideoIdea } from './dashboard-model'
import { FooterLink, MetaChip, PanelHeader, ScoreRing, SparkAction } from './dashboard-bits'
import { panel, pill, softRow } from './dashboard-ui'

/**
 * "Sıradaki videon": ideas from the channel's data — a thumbnail, the title, three icon numbers (score with its
 * why on hover, predicted views, predicted share watched) and one Spark action. Hidden when there is nothing to suggest.
 */
export function VideoIdeas({ t, format, ideas }: { t: DashboardTranslator; format: DashboardFormatter; ideas: VideoIdea[] }) {
  const [dismissed, setDismissed] = React.useState<string[]>([])
  const visible = ideas.filter((idea) => !dismissed.includes(idea.id))
  if (visible.length === 0) return null
  const percent = (value: number) => format.number(value, { style: 'percent', maximumFractionDigits: 0 })

  return (
    <section className={cn(panel, 'p-6')}>
      <PanelHeader title={t('growth.ideasTitle')} count={visible.length} />
      <ul className="-mx-2 mt-3 flex flex-col gap-0.5">
        {visible.map((idea) => (
          <li key={idea.id} className={cn(softRow, 'group flex items-center gap-3 p-2')}>
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
              <Image src={idea.thumbnail} alt="" fill sizes="112px" className="object-cover" />
              <span className="absolute bottom-1 left-1 rounded-[4px] bg-black/75 px-1 py-px text-[11px] font-medium leading-4 text-white">{idea.format}</span>
              <button
                type="button"
                onClick={() => setDismissed((current) => [...current, idea.id])}
                aria-label={t('growth.dismiss')}
                title={t('growth.dismiss')}
                className="absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[14px] font-medium leading-snug text-foreground">{idea.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                <ScoreRing score={idea.score} label={t('growth.score')} hint={idea.why} />
                <MetaChip icon={Eye} label={t('growth.estViews')}>{idea.views}</MetaChip>
                <MetaChip icon={Timer} label={t('growth.avgViewed')}>{percent(idea.viewed)}</MetaChip>
              </div>
            </div>
            <SparkAction href={`/spark/new?idea=${encodeURIComponent(idea.id)}`} label={t('growth.createInSpark')} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A group's round mark: a filled circle in its colour with a white sign. */
function GroupMark({ tone }: { tone: MoveTone }) {
  if (tone === 'opportunity') {
    return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-orange-500"><span className="size-2 rounded-full border-[1.5px] border-white" /></span>
  }
  if (tone === 'risk') {
    return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-rose-500 text-[12px] font-bold leading-none text-white">!</span>
  }
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Plus className="size-3.5" strokeWidth={3} /></span>
}

/**
 * "Sinyaller": what the channel's numbers say, grouped as opportunities, risks and what is working — each with the
 * reason from the data, its expected impact and, where there is one, the next step.
 */
export function Signals({ t, groups }: { t: DashboardTranslator; groups: MoveGroup[] }) {
  const count = groups.reduce((sum, group) => sum + group.moves.length, 0)

  return (
    <section className={cn(panel, 'p-6')}>
      <PanelHeader title={t('growth.movesTitle')} subtitle={t('growth.movesSubtitle', { count })} />
      <div className="mt-4 flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.tone}>
            <div className="mb-1 flex items-center gap-2 text-[14px]">
              <GroupMark tone={group.tone} />
              <span className="font-medium text-foreground">{group.label}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="tabular-nums text-muted-foreground">{group.moves.length}</span>
            </div>
            <ol className="-mx-2 flex flex-col">
              {group.moves.map((move, index) => (
                <li key={move.id} className={cn(softRow, 'group flex items-start gap-2.5 px-2 py-2')}>
                  <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-[12px] tabular-nums text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium leading-snug text-foreground">{move.title}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{move.why}</p>
                    {move.action ? (
                      <Link href={move.action.href} className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground group-hover:text-foreground">
                        {move.action.label}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    ) : null}
                  </div>
                  <span className={cn(pill, move.impactTone === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {move.impact}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <FooterLink href="/channels?view=statistics">{t('growth.allAnalytics')}</FooterLink>
    </section>
  )
}
