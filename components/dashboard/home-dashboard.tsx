'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  Clapperboard,
  Home,
  Lightbulb,
  Link2,
  Play,
  Rocket,
  Sparkles,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useFormatter, useNow, useTranslations } from 'next-intl'

type RangeId = 'today' | '7d' | '30d' | 'all'
type ActivityTab = 'recent' | 'review' | 'scheduled' | 'suggested'
type DashboardTranslator = (key: string, values?: Record<string, string | number>) => string
type DashboardFormatter = ReturnType<typeof useFormatter>

type Metric = {
  label: string
  value: string
  detail: string
  delta: string
  up: boolean
}

type TrendPoint = {
  label: string
  views: number
  subscribers: number
}

type OverviewRange = {
  comparison: string
  summary: string
  metrics: Metric[]
  trend: TrendPoint[]
}

type ActivityItem = {
  icon: LucideIcon
  title: string
  description: string
  time: string
  href: string
}

function getDashboardData(t: DashboardTranslator, format: DashboardFormatter, now: Date) {
  const compact = (value: number) => format.number(value, { notation: 'compact', maximumFractionDigits: 1 })
  const signedNumber = (value: number) => format.number(value, { signDisplay: 'always', maximumFractionDigits: 1 })
  const percent = (value: number) => format.number(value, { style: 'percent', signDisplay: 'always', maximumFractionDigits: 0 })
  const hours = (value: number) => t('metrics.hours', { value: compact(value) })
  const dayLabel = (month: number, day: number) => format.dateTime(new Date(2026, month, day), { day: 'numeric', month: 'short' })
  const monthLabel = (month: number) => format.dateTime(new Date(2026, month, 1), { month: 'short' })
  const hourLabel = (hour: number) => format.dateTime(new Date(2026, 0, 1, hour), { hour: 'numeric', minute: '2-digit' })
  const nowMs = now.getTime()
  const ago = (milliseconds: number) => format.relativeTime(new Date(nowMs - milliseconds), { now, style: 'narrow' })
  const ahead = (milliseconds: number) => format.relativeTime(new Date(nowMs + milliseconds), { now, style: 'narrow' })

  const rangeOptions: Array<{ id: RangeId; label: string }> = [
    { id: 'today', label: t('ranges.today') },
    { id: '7d', label: t('ranges.days7') },
    { id: '30d', label: t('ranges.days30') },
    { id: 'all', label: t('ranges.all') },
  ]

  const overviewByRange: Record<RangeId, OverviewRange> = {
    today: {
      comparison: t('overview.todayComparison'),
      summary: t('overview.todaySummary'),
      metrics: [
        { label: t('metrics.views'), value: compact(2800), detail: t('metrics.today'), delta: percent(0.08), up: true },
        { label: t('metrics.subscribers'), value: signedNumber(42), detail: t('metrics.netGrowth'), delta: percent(0.11), up: true },
        { label: t('metrics.watchTime'), value: hours(116), detail: t('metrics.total'), delta: percent(0.06), up: true },
        { label: t('metrics.posts'), value: format.number(2), detail: t('metrics.publishedToday'), delta: signedNumber(1), up: true },
      ],
      trend: [
        { label: hourLabel(9), views: 180, subscribers: 120 },
        { label: hourLabel(10), views: 1260, subscribers: 980 },
        { label: hourLabel(11), views: 220, subscribers: 180 },
        { label: hourLabel(12), views: 90, subscribers: 70 },
        { label: hourLabel(13), views: 680, subscribers: 510 },
        { label: hourLabel(14), views: 240, subscribers: 190 },
        { label: hourLabel(15), views: 2140, subscribers: 1680 },
        { label: t('ranges.today'), views: 2800, subscribers: 2260 },
      ],
    },
    '7d': {
      comparison: t('overview.days7Comparison'),
      summary: t('overview.days7Summary'),
      metrics: [
        { label: t('metrics.views'), value: compact(18100), detail: t('metrics.last7Days'), delta: percent(0.14), up: true },
        { label: t('metrics.subscribers'), value: signedNumber(238), detail: t('metrics.netGrowth'), delta: percent(0.09), up: true },
        { label: t('metrics.watchTime'), value: hours(724), detail: t('metrics.total'), delta: percent(0.12), up: true },
        { label: t('metrics.posts'), value: format.number(7), detail: t('metrics.scheduledLive'), delta: signedNumber(-1), up: false },
      ],
      trend: [
        { label: dayLabel(5, 27), views: 4300, subscribers: 4100 },
        { label: dayLabel(5, 29), views: 400, subscribers: 350 },
        { label: dayLabel(5, 30), views: 900, subscribers: 800 },
        { label: dayLabel(6, 1), views: 5300, subscribers: 5000 },
        { label: dayLabel(6, 2), views: 200, subscribers: 180 },
        { label: dayLabel(6, 3), views: 2500, subscribers: 2300 },
        { label: dayLabel(6, 4), views: 1100, subscribers: 1000 },
        { label: dayLabel(6, 5), views: 300, subscribers: 260 },
        { label: dayLabel(6, 6), views: 900, subscribers: 820 },
        { label: t('ranges.today'), views: 3400, subscribers: 3200 },
      ],
    },
    '30d': {
      comparison: t('overview.days30Comparison'),
      summary: t('overview.days30Summary'),
      metrics: [
        { label: t('metrics.views'), value: compact(84600), detail: t('metrics.last30Days'), delta: percent(0.18), up: true },
        { label: t('metrics.subscribers'), value: signedNumber(1100), detail: t('metrics.netGrowth'), delta: percent(0.16), up: true },
        { label: t('metrics.watchTime'), value: hours(3400), detail: t('metrics.total'), delta: percent(0.13), up: true },
        { label: t('metrics.posts'), value: format.number(31), detail: t('metrics.scheduledLive'), delta: signedNumber(4), up: true },
      ],
      trend: [1, 2, 3, 4].map((week, index) => ({
        label: t('metrics.week', { count: week }),
        views: [14100, 18700, 22400, 29400][index],
        subscribers: [11900, 16200, 20100, 26200][index],
      })),
    },
    all: {
      comparison: t('overview.allComparison'),
      summary: t('overview.allSummary'),
      metrics: [
        { label: t('metrics.views'), value: compact(1400000), detail: t('metrics.allTime'), delta: percent(0.24), up: true },
        { label: t('metrics.subscribers'), value: compact(18700), detail: t('metrics.total'), delta: percent(0.21), up: true },
        { label: t('metrics.watchTime'), value: hours(42000), detail: t('metrics.total'), delta: percent(0.19), up: true },
        { label: t('metrics.posts'), value: format.number(286), detail: t('metrics.totalContent'), delta: signedNumber(12), up: true },
      ],
      trend: [0, 1, 2, 3, 4, 5, 6].map((month, index) => ({
        label: monthLabel(month),
        views: [78000, 91000, 142000, 126000, 198000, 244000, 312000][index],
        subscribers: [62000, 74000, 116000, 104000, 168000, 211000, 276000][index],
      })),
    },
  }

  const quickstart = [
    { step: t('quickstart.step', { count: 1 }), title: t('quickstart.connectTitle'), description: t('quickstart.connectDescription'), cta: t('quickstart.connectCta'), href: '/channels?view=connection', icon: Link2, active: true },
    { step: t('quickstart.step', { count: 2 }), title: t('quickstart.memoryTitle'), description: t('quickstart.memoryDescription'), cta: t('quickstart.memoryCta'), href: '/memory', icon: Lightbulb },
    { step: t('quickstart.step', { count: 3 }), title: t('quickstart.clipTitle'), description: t('quickstart.clipDescription'), cta: t('quickstart.clipCta'), href: '/tools?tool=viral-clips', icon: Clapperboard },
    { step: t('quickstart.step', { count: 4 }), title: t('quickstart.publishTitle'), description: t('quickstart.publishDescription'), cta: t('quickstart.publishCta'), href: '/workflows', icon: Rocket },
  ]

  const growers = [
    { title: t('growers.workflowTitle'), description: t('growers.workflowDescription'), rank: t('growers.high'), tone: 'text-emerald-400' },
    { title: t('growers.sceneTitle'), description: t('growers.sceneDescription'), rank: t('growers.medium'), tone: 'text-amber-400' },
    { title: t('growers.avatarTitle'), description: t('growers.avatarDescription'), rank: t('growers.low'), tone: 'text-muted-foreground' },
    { title: t('growers.productTitle'), description: t('growers.productDescription'), rank: t('growers.medium'), tone: 'text-amber-400' },
  ]

  const suggestions = [
    { icon: Wand2, title: t('suggestions.abTitle'), description: t('suggestions.abDescription'), impact: t('suggestions.abImpact'), href: '/chat?task=shorts-review' },
    { icon: Calendar, title: t('suggestions.slotTitle'), description: t('suggestions.slotDescription'), impact: t('suggestions.slotImpact'), href: '/workflows' },
    { icon: Clapperboard, title: t('suggestions.clipTitle'), description: t('suggestions.clipDescription'), impact: t('suggestions.clipImpact'), href: '/tools?tool=viral-clips' },
  ]

  const activityTabs: Array<{ id: ActivityTab; label: string }> = [
    { id: 'recent', label: t('tabs.recent') },
    { id: 'review', label: t('tabs.review') },
    { id: 'scheduled', label: t('tabs.scheduled') },
    { id: 'suggested', label: t('tabs.suggested') },
  ]
  const activities: Record<ActivityTab, ActivityItem[]> = {
    recent: [
      { icon: Clapperboard, title: t('activity.sceneTitle'), description: t('activity.sceneDescription'), time: ago(28 * 60_000), href: '/spark' },
      { icon: Wand2, title: t('activity.flowTitle'), description: t('activity.flowDescription'), time: ago(41 * 60_000), href: '/workflows' },
      { icon: Calendar, title: t('activity.scheduledTitle'), description: t('activity.scheduledDescription'), time: ago(60 * 60_000), href: '/workflows' },
      { icon: Play, title: t('activity.publishedTitle'), description: t('activity.publishedDescription'), time: ago(2 * 60 * 60_000), href: '/statistics' },
    ],
    review: [
      { icon: Clapperboard, title: t('activity.reviewTitle'), description: t('activity.reviewDescription'), time: format.relativeTime(now, { now, style: 'narrow' }), href: '/inbox' },
    ],
    scheduled: [
      { icon: Calendar, title: t('activity.futureTitle'), description: t('activity.futureDescription'), time: ahead(2 * 86_400_000), href: '/workflows' },
    ],
    suggested: [],
  }

  return { activities, activityTabs, growers, overviewByRange, quickstart, rangeOptions, suggestions }
}

function Delta({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', up ? 'text-emerald-400' : 'text-rose-400')}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {children}
    </span>
  )
}

function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  const sparkline = React.useMemo(
    () => Array.from({ length: 12 }, (_, point) => ({
      point,
      value: 20 + Math.sin((point + index) * 0.9) * 4 + (metric.up ? point : -point) * 0.7,
    })),
    [index, metric.up],
  )

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-panel/40 p-4">
      <p className="text-sm text-muted-foreground">{metric.label}</p>
      <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="whitespace-nowrap font-display text-2xl leading-none text-foreground">{metric.value}</span>
            <Delta up={metric.up}>{metric.delta}</Delta>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{metric.detail}</p>
        </div>
        <div className="h-10 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline}>
              <Line
                type="natural"
                dataKey="value"
                stroke={metric.up ? 'var(--chart-1)' : 'var(--destructive)'}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export function HomeDashboard() {
  const tDashboard = useTranslations('Dashboard') as unknown as DashboardTranslator
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })
  const { activities, activityTabs, growers, overviewByRange, quickstart, rangeOptions, suggestions } = getDashboardData(tDashboard, format, now)
  const [range, setRange] = React.useState<RangeId>('7d')
  const [activeTab, setActiveTab] = React.useState<ActivityTab>('recent')
  const overview = overviewByRange[range]

  return (
    <div className="hg-scrollbar relative h-full overflow-y-auto bg-background text-foreground">
      <div className="hg-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="relative mx-auto max-w-[1200px] px-4 pb-6 pt-8 md:px-8 md:pb-8 md:pt-10">
        <header className="mb-6 flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-panel/60">
            <Home className="size-5 text-foreground" />
          </span>
          <div>
            <h1 className="font-display text-3xl text-foreground md:text-4xl">{tDashboard('title')}</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {tDashboard('description')}
            </p>
          </div>
        </header>

        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Rocket className="size-4" />
            <span>{tDashboard('completeSetup')}</span>
            <span className="font-semibold text-foreground">0/4</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickstart.map((item) => (
              <article
                key={item.title}
                className={cn(
                  'flex flex-col rounded-2xl border bg-panel/40 p-4 transition-colors',
                  item.active ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border',
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={cn('flex size-9 items-center justify-center rounded-xl', item.active ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground')}>
                    <item.icon className="size-[18px]" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.step}</span>
                </div>
                <h2 className="font-display text-lg text-foreground">{item.title}</h2>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                <Link
                  href={item.href}
                  className={cn(
                    'mt-3 rounded-xl py-2 text-center text-sm font-semibold transition-transform hover:scale-[1.02]',
                    item.active ? 'bg-foreground text-background' : 'bg-accent text-foreground',
                  )}
                >
                  {item.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl text-foreground">{tDashboard('channelOverview')}</h2>
                <span className="text-xs text-emerald-400">• {overview.comparison}</span>
              </div>
              <p className="text-sm text-muted-foreground">{overview.summary}</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-panel/40 p-1">
              {rangeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setRange(option.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    range === option.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.metrics.map((metric, index) => (
              <MetricCard key={metric.label} metric={metric} index={index} />
            ))}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-2xl border border-border bg-panel/40 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg text-foreground">{tDashboard('viewsAndSubscribers')}</h3>
                  <p className="text-xs text-muted-foreground">{tDashboard('chartDescription')}</p>
                </div>
                <TrendingUp className="size-4 text-primary" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview.trend} margin={{ top: 6, right: 6, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="overview-views" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="overview-subscribers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={(value: number) => format.number(value, { notation: 'compact', maximumFractionDigits: 1 })} />
                    <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--foreground)' }} />
                    <Area type="monotone" dataKey="views" name={tDashboard('metrics.views')} stroke="var(--chart-1)" strokeWidth={2} fill="url(#overview-views)" />
                    <Area type="monotone" dataKey="subscribers" name={tDashboard('metrics.subscribers')} stroke="var(--chart-2)" strokeWidth={2} fill="url(#overview-subscribers)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-border bg-panel/40 p-4">
              <h3 className="font-display text-lg text-foreground">{tDashboard('growthVideos')}</h3>
              <p className="mb-3 text-xs text-muted-foreground">{tDashboard('last90Days')}</p>
              <div className="flex flex-col gap-2">
                {growers.map((item) => (
                  <Link key={item.title} href="/statistics" className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/30 p-2.5 transition-colors hover:border-primary/35">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-card text-muted-foreground">
                      <Play className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    <span className={cn('shrink-0 text-xs font-semibold', item.tone)}>{item.rank}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="font-display text-xl text-foreground">{tDashboard('agentSuggestions')}</h2>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{tDashboard('forGrowth')}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {suggestions.map((item) => (
              <Link key={item.title} href={item.href} className="group flex flex-col rounded-2xl border border-border bg-panel/40 p-4 text-left transition-colors hover:border-primary/40">
                <span className="mb-3 flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <item.icon className="size-[18px]" />
                </span>
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
                <span className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                <span className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400">{item.impact}</span>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="pb-4">
          <div className="mb-3 flex items-center gap-4 overflow-x-auto border-b border-border">
            {activityTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors',
                  activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
                {tab.id === 'review' && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary">
                    {activities.review.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {activities[activeTab].length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{tDashboard('empty')}</p>
            ) : (
              activities[activeTab].map((item) => (
                <Link key={item.title} href={item.href} className="flex items-center gap-3 rounded-xl border border-border bg-panel/40 p-3.5 transition-colors hover:border-primary/35">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                    <item.icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
