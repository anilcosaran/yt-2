'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DashboardFormatter, DashboardTranslator, TopVideo } from './dashboard-model'
import { PanelHeader } from './dashboard-bits'
import { panel, pill, segItem, segTrack, softRow, trendTone } from './dashboard-ui'

type SortId = 'subscribers' | 'views' | 'dropping'

const SORTS: Array<{ id: SortId; labelKey: string }> = [
  { id: 'subscribers', labelKey: 'growth.sortSubs' },
  { id: 'views', labelKey: 'growth.sortViews' },
  { id: 'dropping', labelKey: 'growth.sortDropping' },
]

/** The videos behind the growth: what each brought in, how much of it people watched, and where it is heading. */
export function TopVideos({ t, format, videos }: { t: DashboardTranslator; format: DashboardFormatter; videos: TopVideo[] }) {
  const [sort, setSort] = React.useState<SortId>('subscribers')
  const sorted = [...videos].sort((a, b) =>
    sort === 'views' ? b.views - a.views : sort === 'dropping' ? a.change - b.change : b.subscribers - a.subscribers,
  )
  const compact = (value: number) => format.number(value, { notation: 'compact', maximumFractionDigits: 1 })
  const percent = (value: number, sign = false) => format.number(value, { style: 'percent', maximumFractionDigits: 0, signDisplay: sign ? 'always' : 'auto' })
  const columns = 'grid grid-cols-[minmax(0,1fr)_72px_84px] items-center gap-4 @xl:grid-cols-[minmax(0,1fr)_84px_72px_140px_84px]'

  return (
    <section className={cn(panel, '@container min-w-0 p-6')}>
      <PanelHeader
        title={t('growthVideos')}
        subtitle={t('last90Days')}
        right={(
          <div className={segTrack} role="group" aria-label={t('growthVideos')}>
            {SORTS.map((option) => (
              <button key={option.id} type="button" aria-pressed={sort === option.id} onClick={() => setSort(option.id)} className={segItem(sort === option.id)}>
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        )}
      />

      <div className={cn(columns, '-mx-2 mt-4 px-2 pb-1.5 text-[12px] text-muted-foreground')}>
        <span>{t('growth.colVideo')}</span>
        <span className="hidden text-right @xl:block">{t('metrics.views')}</span>
        <span className="text-right">{t('metrics.subscribers')}</span>
        <span className="hidden @xl:block">{t('growth.avgViewed')}</span>
        <span className="text-right">{t('growth.colChange')}</span>
      </div>

      <ul className="-mx-2 flex flex-col">
        {sorted.map((video) => (
          <li key={video.id}>
            <Link href="/channels?view=videos" className={cn(softRow, columns, 'px-2 py-2')}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="relative aspect-video w-[88px] shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image src={video.thumbnail} alt="" fill sizes="88px" className="object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-foreground">{video.title}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{video.format} · {video.age}</span>
                </span>
              </span>
              <span className="hidden text-right text-[14px] tabular-nums text-foreground @xl:block">{compact(video.views)}</span>
              <span className="text-right text-[14px] font-medium tabular-nums text-foreground">+{format.number(video.subscribers)}</span>
              <span className="hidden items-center gap-2 @xl:flex">
                <span className="w-9 text-[14px] font-medium tabular-nums text-foreground">{percent(video.retention)}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                  <span className="block h-full rounded-full bg-foreground/55" style={{ width: `${video.retention * 100}%` }} />
                </span>
              </span>
              <span className="flex justify-end">
                <span className={cn(pill, 'inline-flex items-center gap-0.5 px-2', trendTone(video.change >= 0))}>
                  {video.change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {percent(video.change, true)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
