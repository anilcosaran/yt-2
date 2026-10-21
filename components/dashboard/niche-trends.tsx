'use client'

import Image from 'next/image'
import { Lightbulb, Radar } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { DashboardTranslator, TrendVideo } from './dashboard-model'
import { FooterLink, PanelHeader, SparkAction } from './dashboard-bits'
import { panel } from './dashboard-ui'

/** "Nişinde yükselenler": videos in the niche running far above their own channel's average, each one Spark can adapt. */
export function NicheTrends({ t, trends }: { t: DashboardTranslator; trends: TrendVideo[] }) {
  if (trends.length === 0) return null
  return (
    <section className={cn(panel, '@container p-6')}>
      <PanelHeader title={t('growth.trendsTitle')} subtitle={t('growth.trendsSubtitle')} count={trends.length} />
      <ul className="mt-4 grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
        {trends.map((trend) => (
          <li key={trend.id} className="group flex min-w-0 flex-col">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
              <Image src={trend.thumbnail} alt="" fill sizes="(min-width: 1280px) 240px, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute left-2 top-2 cursor-default rounded-md bg-black/70 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-white">
                    {trend.multiple}×
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[13px]">{t('growth.multipleHint', { value: trend.multiple })}</TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[14px] font-medium leading-snug text-foreground">{trend.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{trend.channel} · {trend.meta}</p>
                <p className="mt-1 flex items-start gap-1 text-[13px] leading-snug text-muted-foreground">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                  <span className="line-clamp-2">{trend.why}</span>
                </p>
              </div>
              <SparkAction href={`/spark/new?idea=${encodeURIComponent(`outlier:${trend.id}`)}`} label={t('growth.adaptInSpark')} />
            </div>
          </li>
        ))}
      </ul>
      <FooterLink href="/workflows" icon={Radar}>{t('growth.radar')}</FooterLink>
    </section>
  )
}
