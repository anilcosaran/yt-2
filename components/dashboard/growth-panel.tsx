'use client'

import * as React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import type {
  DashboardFormatter,
  DashboardTranslator,
  MetricId,
  OverviewRange,
  RangeId,
} from './dashboard-model'
import { panel, segItem, segTrack, trendTone } from './dashboard-ui'
import { PanelHeader } from './dashboard-bits'

type ChartPoint = { label: string; current: number; previous: number; published?: string }

/** The previous period, for the dashed comparison line: the current values less the change, with a little drift. */
function previousOf(value: number, change: number, metric: MetricId, index: number) {
  const drift = 1 + Math.sin(index * 1.7 + 0.6) * 0.06
  return metric === 'ctr' ? (value - change) * drift : (value / (1 + change)) * drift
}

export function GrowthPanel({ t, format, overview, range, rangeOptions, onRange }: {
  t: DashboardTranslator
  format: DashboardFormatter
  overview: OverviewRange
  range: RangeId
  rangeOptions: Array<{ id: RangeId; label: string }>
  onRange: (range: RangeId) => void
}) {
  const [metricId, setMetricId] = React.useState<MetricId>('views')
  const metric = overview.metrics.find((entry) => entry.id === metricId) ?? overview.metrics[0]!
  const chart: ChartPoint[] = overview.trend.map((point, index) => ({
    label: point.label,
    current: point[metric.id],
    previous: previousOf(point[metric.id], metric.change, metric.id, index),
    published: point.published,
  }))

  const formatValue = (value: number) => {
    if (metric.id === 'ctr') return format.number(value, { style: 'percent', maximumFractionDigits: 1 })
    if (metric.id === 'watchTime') return t('metrics.hours', { value: format.number(value, { notation: 'compact', maximumFractionDigits: 1 }) })
    return format.number(value, { notation: 'compact', maximumFractionDigits: 1 })
  }

  return (
    <section className={cn(panel, '@container min-w-0 p-6')}>
      <PanelHeader
        title={t('channelOverview')}
        subtitle={overview.summary}
        right={(
          <div className={segTrack} role="group" aria-label={t('channelOverview')}>
            {rangeOptions.map((option) => (
              <button key={option.id} type="button" aria-pressed={range === option.id} onClick={() => onRange(option.id)} className={segItem(range === option.id)}>
                {option.label}
              </button>
            ))}
          </div>
        )}
      />

      {/* The metrics are the chart's tabs: the chosen one sits on a soft fill, no ruled cells. */}
      <div role="tablist" aria-label={t('channelOverview')} className="mt-4 grid grid-cols-2 gap-1.5 @2xl:grid-cols-4">
        {overview.metrics.map((entry) => {
          const selected = entry.id === metric.id
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMetricId(entry.id)}
              className={cn(
                'min-w-0 rounded-xl px-4 py-3 text-left transition-colors',
                selected ? 'bg-foreground/[0.06]' : 'hover:bg-foreground/[0.03]',
              )}
            >
              <span className={cn('block text-[13px]', selected ? 'text-foreground' : 'text-muted-foreground')}>{entry.label}</span>
              <span className="mt-1 block truncate text-[28px] font-semibold leading-8 tracking-tight tabular-nums text-foreground">{entry.value}</span>
              <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px]">
                <span className={cn('inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-px font-medium tabular-nums', trendTone(entry.up), entry.up ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
                  {entry.up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  {entry.delta}
                </span>
                <span className="truncate text-muted-foreground">{t('growth.vsPrevious')}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-end gap-4 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-foreground" />{t('growth.thisPeriod')}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-muted-foreground" />{t('growth.previousPeriod')}</span>
        </div>
        <div className="-mx-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="growth-current" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={formatValue} />
              <Tooltip
                cursor={{ stroke: 'var(--border)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0]!.payload as ChartPoint
                  return (
                    <div className="min-w-40 rounded-xl border border-border bg-popover px-3 py-2 text-[13px] text-popover-foreground shadow-lg">
                      <p className="mb-1 font-medium">{label}</p>
                      <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t('growth.thisPeriod')}</span><span className="tabular-nums">{formatValue(point.current)}</span></p>
                      <p className="flex justify-between gap-4"><span className="text-muted-foreground">{t('growth.previousPeriod')}</span><span className="tabular-nums">{formatValue(point.previous)}</span></p>
                      {point.published ? <p className="mt-1.5 text-muted-foreground">{t('growth.publishedMarker', { title: point.published })}</p> : null}
                    </div>
                  )
                }}
              />
              {chart.filter((point) => point.published).map((point) => (
                <ReferenceLine key={point.label} x={point.label} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="2 3" />
              ))}
              <Line type="monotone" dataKey="previous" stroke="var(--muted-foreground)" strokeWidth={1.25} strokeDasharray="3 3" dot={false} activeDot={false} />
              <Area type="monotone" dataKey="current" stroke="var(--foreground)" strokeWidth={1.5} fill="url(#growth-current)" activeDot={{ r: 3, fill: 'var(--foreground)', stroke: 'var(--card)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </section>
  )
}
