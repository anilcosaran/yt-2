import type { useFormatter } from 'next-intl'

export type DashboardTranslator = (key: string, values?: Record<string, string | number>) => string
export type DashboardFormatter = ReturnType<typeof useFormatter>

export type RangeId = 'today' | '7d' | '30d' | 'all'
export type MetricId = 'views' | 'subscribers' | 'watchTime' | 'ctr'

export type Metric = {
  id: MetricId
  label: string
  value: string
  delta: string
  up: boolean
  /** The change against the previous period: a ratio (0.14 = +14%), or points for CTR. */
  change: number
}

export type TrendPoint = {
  label: string
  /** A video published at this point, marked on the chart. */
  published?: string
} & Record<MetricId, number>

export type OverviewRange = {
  comparison: string
  summary: string
  metrics: Metric[]
  trend: TrendPoint[]
}

export type SetupStep = {
  title: string
  description: string
  cta: string
  href: string
}

export type TopVideo = {
  id: string
  title: string
  thumbnail: string
  format: string
  age: string
  views: number
  subscribers: number
  retention: number
  change: number
}

export type VideoIdea = {
  id: string
  thumbnail: string
  format: string
  title: string
  why: string
  /** How strongly the channel's data backs the idea, 0–100. */
  score: number
  /** Predicted views, as a range. */
  views: string
  /** Predicted average percentage viewed, 0–1. */
  viewed: number
}

export type MoveTone = 'opportunity' | 'risk' | 'working'

export type GrowthMove = {
  id: string
  title: string
  why: string
  impact: string
  impactTone: 'up' | 'down'
  action?: { label: string; href: string }
}

export type MoveGroup = { tone: MoveTone; label: string; moves: GrowthMove[] }

/** A Short to cut from one of the channel's long videos. */
export type ShortClip = {
  id: string
  /** A vertical frame from the moment. */
  thumbnail: string
  source: string
  /** "02:14–02:52" */
  range: string
  start: number
  end: number
  hook: string
  score: number
  /** Made and approved: ready to publish or schedule, at `slot` by default. */
  approved?: boolean
  slot?: string
}

/** A video rising in the channel's niche: how far above its own channel's average it runs. */
export type TrendVideo = {
  id: string
  thumbnail: string
  title: string
  channel: string
  meta: string
  why: string
  multiple: number
}

const DAY = 86_400_000

export function getDashboardData(t: DashboardTranslator, format: DashboardFormatter, now: Date) {
  const compact = (value: number) => format.number(value, { notation: 'compact', maximumFractionDigits: 1 })
  const signedNumber = (value: number) => format.number(value, { signDisplay: 'always', maximumFractionDigits: 1 })
  const percent = (value: number) => format.number(value, { style: 'percent', signDisplay: 'always', maximumFractionDigits: 0 })
  const rate = (value: number) => format.number(value, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const points = (value: number) => t('growth.points', { value: format.number(value, { signDisplay: 'always', maximumFractionDigits: 1 }) })
  const hours = (value: number) => t('metrics.hours', { value: compact(value) })
  const nowMs = now.getTime()
  const ago = (milliseconds: number) => format.relativeTime(new Date(nowMs - milliseconds), { now, style: 'narrow' })
  const dayLabel = (daysAgo: number) => format.dateTime(new Date(nowMs - daysAgo * DAY), { day: 'numeric', month: 'short' })
  const monthLabel = (monthsAgo: number) => format.dateTime(new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1), { month: 'short' })
  // Clock times and calendar days are built and shown in UTC, so the viewer's zone never shifts a 21:00 slot.
  const hourLabel = (hour: number) => format.dateTime(new Date(Date.UTC(2026, 0, 1, hour)), { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  const range = (low: number, high: number) => `${format.number(low)}–${compact(high * 1000)}`

  const metric = (id: MetricId, value: string, change: number): Metric => ({
    id,
    label: id === 'ctr' ? t('growth.ctr') : t(`metrics.${id}`),
    value,
    delta: id === 'ctr' ? points(change * 100) : percent(change),
    up: change >= 0,
    change,
  })

  const series = (labels: string[], values: Record<MetricId, number[]>, published: Record<number, string> = {}): TrendPoint[] =>
    labels.map((label, index) => ({
      label,
      views: values.views[index]!,
      subscribers: values.subscribers[index]!,
      watchTime: values.watchTime[index]!,
      ctr: values.ctr[index]!,
      published: published[index],
    }))

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
        metric('views', compact(2800), 0.08),
        metric('subscribers', signedNumber(42), 0.11),
        metric('watchTime', hours(116), 0.06),
        metric('ctr', rate(0.061), 0.004),
      ],
      trend: series(
        [9, 10, 11, 12, 13, 14, 15, 16].map(hourLabel),
        {
          views: [140, 260, 320, 380, 410, 460, 420, 410],
          subscribers: [2, 4, 5, 6, 6, 7, 6, 6],
          watchTime: [6, 11, 13, 16, 17, 19, 17, 17],
          ctr: [0.056, 0.059, 0.06, 0.062, 0.063, 0.064, 0.061, 0.06],
        },
      ),
    },
    '7d': {
      comparison: t('overview.days7Comparison'),
      summary: t('overview.days7Summary'),
      metrics: [
        metric('views', compact(18100), 0.14),
        metric('subscribers', signedNumber(238), 0.09),
        metric('watchTime', hours(724), 0.12),
        metric('ctr', rate(0.058), 0.006),
      ],
      trend: series(
        [6, 5, 4, 3, 2, 1, 0].map(dayLabel),
        {
          views: [2200, 2400, 3700, 2500, 2300, 2700, 2300],
          subscribers: [24, 27, 61, 31, 28, 36, 31],
          watchTime: [88, 96, 148, 100, 92, 108, 92],
          ctr: [0.054, 0.056, 0.066, 0.057, 0.055, 0.06, 0.058],
        },
        { 2: t('growers.workflowTitle'), 5: t('growers.productTitle') },
      ),
    },
    '30d': {
      comparison: t('overview.days30Comparison'),
      summary: t('overview.days30Summary'),
      metrics: [
        metric('views', compact(84600), 0.18),
        metric('subscribers', signedNumber(1100), 0.16),
        metric('watchTime', hours(3400), 0.13),
        metric('ctr', rate(0.054), 0.003),
      ],
      trend: series(
        [1, 2, 3, 4].map((week) => t('metrics.week', { count: week })),
        {
          views: [16800, 19400, 22300, 26100],
          subscribers: [210, 240, 290, 360],
          watchTime: [680, 780, 900, 1040],
          ctr: [0.051, 0.053, 0.055, 0.057],
        },
        { 2: t('growers.sceneTitle') },
      ),
    },
    all: {
      comparison: t('overview.allComparison'),
      summary: t('overview.allSummary'),
      metrics: [
        metric('views', compact(1_400_000), 0.24),
        metric('subscribers', compact(18700), 0.21),
        metric('watchTime', hours(42000), 0.19),
        metric('ctr', rate(0.049), 0.002),
      ],
      trend: series(
        [6, 5, 4, 3, 2, 1, 0].map(monthLabel),
        {
          views: [92000, 107000, 168000, 149000, 233000, 288000, 363000],
          subscribers: [1200, 1500, 2400, 2100, 3100, 3700, 4700],
          watchTime: [2700, 3200, 5100, 4500, 7000, 8700, 10800],
          ctr: [0.042, 0.045, 0.049, 0.047, 0.05, 0.052, 0.054],
        },
      ),
    },
  }

  const setupSteps: SetupStep[] = [
    { title: t('quickstart.connectTitle'), description: t('quickstart.connectDescription'), cta: t('quickstart.connectCta'), href: '/channels?view=connection' },
    { title: t('quickstart.memoryTitle'), description: t('quickstart.memoryDescription'), cta: t('quickstart.memoryCta'), href: '/memory' },
    { title: t('quickstart.clipTitle'), description: t('quickstart.clipDescription'), cta: t('quickstart.clipCta'), href: '/tools?tool=viral-clips' },
    { title: t('quickstart.publishTitle'), description: t('quickstart.publishDescription'), cta: t('quickstart.publishCta'), href: '/workflows' },
  ]

  const shorts = t('growth.formatShort')
  const long = (min: number, max: number) => t('growth.formatLong', { min, max })

  const topVideos: TopVideo[] = [
    { id: 'workflow', title: t('growers.workflowTitle'), thumbnail: '/flows/tips.png', format: shorts, age: ago(12 * DAY), views: 48200, subscribers: 412, retention: 0.71, change: 0.38 },
    { id: 'product', title: t('growers.productTitle'), thumbnail: '/flows/sales.png', format: shorts, age: ago(5 * DAY), views: 21600, subscribers: 188, retention: 0.64, change: 0.22 },
    { id: 'scene', title: t('growers.sceneTitle'), thumbnail: '/flows/educational.png', format: long(8, 10), age: ago(26 * DAY), views: 14100, subscribers: 96, retention: 0.42, change: 0.06 },
    { id: 'avatar', title: t('growers.avatarTitle'), thumbnail: '/flows/news.png', format: shorts, age: ago(40 * DAY), views: 6300, subscribers: 12, retention: 0.38, change: -0.14 },
  ]

  const ideas: VideoIdea[] = [
    { id: 'workflow-shorts', thumbnail: '/flows/tips.png', format: shorts, title: t('growth.idea1Title'), why: t('growth.idea1Why'), score: 86, views: range(12, 18), viewed: 0.68 },
    { id: 'demo-hooks', thumbnail: '/flows/sales.png', format: shorts, title: t('growth.idea4Title'), why: t('growth.idea4Why'), score: 78, views: range(8, 11), viewed: 0.62 },
    { id: 'scene-episode', thumbnail: '/flows/course.png', format: long(8, 10), title: t('growth.idea2Title'), why: t('growth.idea2Why'), score: 72, views: range(4, 6), viewed: 0.47 },
    { id: 'avatar-tones', thumbnail: '/flows/expert.png', format: shorts, title: t('growth.idea3Title'), why: t('growth.idea3Why'), score: 64, views: range(6, 9), viewed: 0.59 },
    { id: 'questions-episode', thumbnail: '/flows/news.png', format: long(10, 12), title: t('growth.idea5Title'), why: t('growth.idea5Why'), score: 61, views: range(3, 5), viewed: 0.44 },
  ]

  const utcDay = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day))
  const weekdayShort = (date: Date) => format.dateTime(date, { weekday: 'short', timeZone: 'UTC' })

  const clips: ShortClip[] = [
    { id: 'scene-moment', thumbnail: '/brand/avatars/presenter.jpg', source: t('growers.sceneTitle'), range: '02:14–02:52', start: 134, end: 172, hook: t('growth.clip1Hook'), score: 82 },
    { id: 'founder-rewind', thumbnail: '/brand/avatars/side.jpg', source: t('growth.clip2Source'), range: '08:40–09:15', start: 520, end: 555, hook: t('growth.clip2Hook'), score: 74 },
    { id: 'podcast-truth', thumbnail: '/brand/avatars/woman.jpg', source: t('growth.clip4Source'), range: '21:05–21:44', start: 1265, end: 1304, hook: t('growth.clip4Hook'), score: 69 },
    { id: 'edit-60', thumbnail: '/brand/avatars/character.jpg', source: t('growth.clip3Source'), range: '00:12–00:58', start: 12, end: 58, hook: t('growth.clip3Hook'), score: 88, approved: true, slot: `${weekdayShort(utcDay(2026, 9, 23))} ${hourLabel(21)}` },
  ]

  const moveGroups: MoveGroup[] = [
    {
      tone: 'opportunity',
      label: t('growth.groupOpportunity'),
      moves: [
        { id: 'slot', title: t('suggestions.slotTitle'), why: t('suggestions.slotDescription'), impact: t('suggestions.slotImpact'), impactTone: 'up', action: { label: t('growth.actionSchedule'), href: '/calendar' } },
        { id: 'ab', title: t('suggestions.abTitle'), why: t('suggestions.abDescription'), impact: t('growth.ctrImpact', { value: percent(0.08) }), impactTone: 'up', action: { label: t('growth.actionAskSpark'), href: '/chat?task=shorts-review' } },
      ],
    },
    {
      tone: 'risk',
      label: t('growth.groupRisk'),
      moves: [
        { id: 'retention', title: t('growth.retentionTitle'), why: t('growth.retentionWhy'), impact: points(-9), impactTone: 'down', action: { label: t('growth.actionReview'), href: '/chat?task=retention-review' } },
      ],
    },
    {
      tone: 'working',
      label: t('growth.groupWorking'),
      moves: [
        { id: 'shorts-subs', title: t('growth.shortsSubsTitle'), why: t('growth.shortsSubsWhy'), impact: percent(0.38), impactTone: 'up' },
        { id: 'returning', title: t('growth.returningTitle'), why: t('growth.returningWhy'), impact: percent(0.12), impactTone: 'up' },
      ],
    },
  ]

  const trends: TrendVideo[] = [
    { id: 'ai-10-shorts', thumbnail: '/brand/avatars/man.jpg', title: t('growth.trend1Title'), channel: t('growth.trend1Channel'), meta: t('growth.trendMeta', { subs: compact(9200), age: ago(3 * DAY) }), why: t('growth.trend1Why'), multiple: 23 },
    { id: 'five-mistakes', thumbnail: '/brand/avatars/studio.jpg', title: t('growth.trend2Title'), channel: t('growth.trend2Channel'), meta: t('growth.trendMeta', { subs: compact(41000), age: ago(5 * DAY) }), why: t('growth.trend2Why'), multiple: 11 },
    { id: 'phone-light', thumbnail: '/brand/avatars/anchor.jpg', title: t('growth.trend3Title'), channel: t('growth.trend3Channel'), meta: t('growth.trendMeta', { subs: compact(120000), age: ago(2 * DAY) }), why: t('growth.trend3Why'), multiple: 8 },
    { id: 'three-seconds', thumbnail: '/brand/avatars/closeup.jpg', title: t('growth.trend4Title'), channel: t('growth.trend4Channel'), meta: t('growth.trendMeta', { subs: compact(6800), age: ago(1 * DAY) }), why: t('growth.trend4Why'), multiple: 6 },
  ]

  return {
    rangeOptions,
    overviewByRange,
    setupSteps,
    topVideos,
    ideas,
    clips,
    moveGroups,
    trends,
  }
}

export type DashboardData = ReturnType<typeof getDashboardData>
