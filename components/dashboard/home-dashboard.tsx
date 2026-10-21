'use client'

import * as React from 'react'
import { useFormatter, useNow, useTranslations } from 'next-intl'

import { useOptionalActiveChannel } from '@/lib/channel/active-channel'
import { getDashboardData, type DashboardTranslator, type RangeId } from './dashboard-model'
import { GrowthPanel } from './growth-panel'
import { Signals, VideoIdeas } from './growth-suggestions'
import { NicheTrends } from './niche-trends'
import { SetupProgress } from './setup-progress'
import { ShortsShelf } from './shorts-shelf'
import { TopVideos } from './top-videos'

/**
 * The home page, most important first. Left: how the channel is growing, the videos
 * behind it, Shorts to cut from its long videos, what is rising in the niche. Right: what to make next and the
 * signals in the numbers. Every suggestion ends in one action into Spark, Viral Clips or the calendar.
 */
export function HomeDashboard() {
  const tDashboard = useTranslations('Dashboard') as unknown as DashboardTranslator
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })
  const activeChannel = useOptionalActiveChannel()?.activeChannel ?? null
  const data = getDashboardData(tDashboard, format, now)
  const [range, setRange] = React.useState<RangeId>('7d')
  const setupDone = data.setupSteps.map((_, index) => index === 0 && activeChannel?.status === 'connected')

  return (
    <div className="hg-scrollbar relative h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-6 md:px-8 md:pt-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl text-foreground md:text-[28px]">{tDashboard('title')}</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">{tDashboard('growth.description')}</p>
          </div>
          <SetupProgress t={tDashboard} steps={data.setupSteps} done={setupDone} />
        </header>

        {/* Two independent columns: each stacks its own blocks, so a tall side never stretches the other. */}
        <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <GrowthPanel
              t={tDashboard}
              format={format}
              overview={data.overviewByRange[range]}
              range={range}
              rangeOptions={data.rangeOptions}
              onRange={setRange}
            />
            <TopVideos t={tDashboard} format={format} videos={data.topVideos} />
            <ShortsShelf t={tDashboard} clips={data.clips} />
            <NicheTrends t={tDashboard} trends={data.trends} />
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            <VideoIdeas t={tDashboard} format={format} ideas={data.ideas} />
            <Signals t={tDashboard} groups={data.moveGroups} />
          </aside>
        </div>
      </div>
    </div>
  )
}
