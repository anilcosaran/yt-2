'use client'

import type * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, type LucideIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** The score's colour says how strongly the data backs it. */
export function scoreTone(score: number) {
  if (score >= 80) return { text: 'text-emerald-600 dark:text-emerald-400', stroke: 'stroke-emerald-500' }
  if (score >= 60) return { text: 'text-amber-600 dark:text-amber-400', stroke: 'stroke-amber-500' }
  return { text: 'text-muted-foreground', stroke: 'stroke-muted-foreground' }
}

/** A score out of 100 as a small ring and its number; `hint` (why) shows on hover. */
export function ScoreRing({ score, label, hint }: { score: number; label: string; hint?: string }) {
  const tone = scoreTone(score)
  const radius = 6
  const length = 2 * Math.PI * radius
  const ring = (
    <span className="inline-flex items-center gap-1" aria-label={`${label}: ${score}/100`}>
      <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
        <circle cx="8" cy="8" r={radius} fill="none" strokeWidth="2" className="stroke-foreground/10" />
        <circle
          cx="8"
          cy="8"
          r={radius}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * length} ${length}`}
          className={tone.stroke}
        />
      </svg>
      <span className={cn('font-semibold tabular-nums', tone.text)}>{score}</span>
    </span>
  )
  if (!hint) return ring
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default">{ring}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-[13px]">{hint}</TooltipContent>
    </Tooltip>
  )
}

/** An icon and a value, no fill: the quiet metric chips of a row. */
export function MetaChip({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" title={label} aria-label={label}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  )
}

/** The one action of a row, as an icon: Spark's sparkles on a soft orange tile, named by its tooltip. */
export function SparkAction({ href, label, icon: Icon = Sparkles }: { href: string; label: string; icon?: LucideIcon }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-orange-500/10 text-orange-500 transition-colors hover:bg-orange-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          <Icon className="size-4" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-[13px]">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Every home panel's header: the title (with an optional count), an optional one-line subtitle, and an optional
 * control on the right — one height and one type scale, so panels line up side by side.
 */
export function PanelHeader({ title, subtitle, count, right }: { title: string; subtitle?: string; count?: number; right?: React.ReactNode }) {
  return (
    <header className="flex min-h-9 flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h2 className="flex items-baseline gap-1.5 font-display text-[16px] leading-6 text-foreground">
          {title}
          {count !== undefined ? <span className="font-sans text-[14px] font-normal tabular-nums tracking-normal text-muted-foreground">· {count}</span> : null}
        </h2>
        {subtitle ? <p className="mt-0.5 text-[14px] leading-5 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  )
}

/** A panel's way onward: a pill on a dashed rule. */
export function FooterLink({ href, icon: Icon, children }: { href: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
        {Icon ? <Icon className="size-3.5" /> : null}
        {children}
        <ArrowRight className="size-3.5" />
      </Link>
      <span className="h-px flex-1 border-t border-dashed border-border" />
    </div>
  )
}
