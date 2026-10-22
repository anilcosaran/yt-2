'use client'

import * as React from 'react'
import { useFormatter, useNow, useTranslations } from 'next-intl'

import { PageContainer } from '@/components/common/page-container'
import { PageHeader } from '@/components/common/page-header'
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
    <PageContainer className="@container">
      <PageHeader
        title={tDashboard('title')}
        description={tDashboard('growth.description')}
        actions={<SetupProgress t={tDashboard} steps={data.setupSteps} done={setupDone} />}
        className="mb-0"
      />

      {/* Two independent columns: each stacks its own blocks, so a tall side never stretches the other. They split
          on the page's own width, not the window's: a widened sidebar stacks them instead of squeezing the left one. */}
      <div className="mt-6 grid items-start gap-4 @min-[55rem]:grid-cols-[minmax(0,1fr)_380px]">
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
    </PageContainer>
  )
}
