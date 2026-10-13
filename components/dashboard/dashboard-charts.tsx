'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'

export type DashboardChannelDataPoint = {
  label: string
  views: number
  subscribers: number
  videos: number
}

export type DashboardChannelMetric = {
  label: string
  trendTone: 'up' | 'down' | 'neutral'
}

export function AnalyticsMultiLineChart({ data }: { data: DashboardChannelDataPoint[] }) {
  const format = useFormatter()
  const tDashboard = useTranslations('Dashboard')
  return (
    <ChartContainer
      config={{
        views: { label: tDashboard('metrics.views'), color: '#1f55ff' },
        subscribers: { label: tDashboard('metrics.subscribers'), color: '#6f2bd9' },
      }}
      className="h-[240px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground"
    >
      <LineChart data={data} margin={{ left: -12, right: 10, top: 8, bottom: 0 }}>
        <CartesianGrid horizontal vertical stroke="rgba(148,163,184,0.28)" strokeDasharray="0" />
        <XAxis dataKey="label" axisLine={false} interval="preserveStartEnd" minTickGap={26} tick={{ fontSize: 12, fontWeight: 400 }} tickLine={false} tickMargin={10} />
        <YAxis yAxisId="views" axisLine={false} tickLine={false} tickFormatter={(value) => formatCompactNumber(Number(value), format)} tick={{ fontSize: 12, fontWeight: 400 }} width={52} />
        <YAxis yAxisId="subscribers" orientation="right" hide />
        <ChartTooltip content={<AnalyticsChartTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.55)', strokeWidth: 1 }} />
        <Line yAxisId="views" type="linear" dataKey="views" stroke="var(--color-views)" strokeWidth={2.4} strokeLinecap="butt" strokeLinejoin="miter" dot={false} activeDot={{ r: 4, fill: 'var(--color-views)', stroke: 'var(--background)', strokeWidth: 2 }} />
        <Line yAxisId="subscribers" type="linear" dataKey="subscribers" stroke="var(--color-subscribers)" strokeWidth={2.2} strokeLinecap="butt" strokeLinejoin="miter" dot={false} activeDot={{ r: 4, fill: 'var(--color-subscribers)', stroke: 'var(--background)', strokeWidth: 2 }} />
      </LineChart>
    </ChartContainer>
  )
}

export function MetricSparkline({ metric }: { metric: DashboardChannelMetric }) {
  const color = metric.trendTone === 'down' ? 'var(--destructive)' : '#26a6d1'
  return (
    <ChartContainer config={{ value: { label: metric.label, color } }} className="h-[64px] w-[86px] self-center">
      <LineChart data={getMetricSparklineData(metric)} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
        <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} activeDot={false} />
      </LineChart>
    </ChartContainer>
  )
}

function AnalyticsChartTooltip({ active, label, payload }: {
  active?: boolean
  label?: string
  payload?: Array<{ payload?: DashboardChannelDataPoint; value?: number | string }>
}) {
  const point = payload?.[0]?.payload
  const format = useFormatter()
  const tDashboard = useTranslations('Dashboard')
  if (!active || !point) return null
  return (
    <div className="min-w-[140px] rounded-md border border-border/70 bg-background px-3 py-2 text-xs shadow-xl dark:border-white/10 dark:bg-[#151515]">
      <p className="font-medium text-foreground">{label}</p>
      <div className="mt-2 grid gap-1.5">
        <TooltipMetric label={tDashboard('metrics.views')} value={formatCompactNumber(point.views, format)} tone="primary" />
        <TooltipMetric label={tDashboard('metrics.subscribers')} value={format.number(point.subscribers, { notation: 'compact', maximumFractionDigits: 1, signDisplay: 'always' })} tone="secondary" />
        <TooltipMetric label={tDashboard('metrics.videos')} value={format.number(point.videos)} tone="muted" />
      </div>
    </div>
  )
}

function TooltipMetric({ label, value, tone }: {
  label: string
  value: string
  tone: 'primary' | 'secondary' | 'muted'
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className={cn('h-2 w-2 rounded-full', tone === 'primary' && 'bg-[#1f55ff]', tone === 'secondary' && 'bg-[#6f2bd9]', tone === 'muted' && 'bg-muted-foreground')} />
        {label}
      </span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  )
}

function getMetricSparklineData(metric: DashboardChannelMetric) {
  if (metric.trendTone === 'down') return [44, 40, 37, 35, 29, 26, 22].map((value, index) => ({ label: index + 1, value }))
  return [12, 16, 14, 20, 23, 22, 28].map((value, index) => ({ label: index + 1, value }))
}

function formatCompactNumber(value: number, format: ReturnType<typeof useFormatter>) {
  return format.number(value, { notation: 'compact', maximumFractionDigits: 1 })
}
