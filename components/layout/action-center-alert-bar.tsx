'use client'

import * as React from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export type ActionCenterAlertTone = 'neutral' | 'critical' | 'warning' | 'info'

export type ActionCenterAlert = {
  id: string
  title: string
  description?: string
  ctaLabel?: string
  href?: string
  target?: React.HTMLAttributeAnchorTarget
  rel?: string
  tone?: ActionCenterAlertTone
  icon?: LucideIcon
}

interface ActionCenterAlertBarProps {
  alerts: ActionCenterAlert[]
  className?: string
}

const toneStyles: Record<ActionCenterAlertTone, {
  container: string
  icon: string
  title: string
  description: string
  nav: string
  action: string
}> = {
  neutral: {
    container: 'border-border bg-card text-foreground',
    icon: 'text-muted-foreground',
    title: 'text-foreground',
    description: 'text-muted-foreground',
    nav: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    action: 'bg-foreground text-background hover:bg-foreground/90',
  },
  critical: {
    container: 'border-destructive/80 bg-destructive/5 text-foreground dark:bg-destructive/10',
    icon: 'text-destructive',
    title: 'text-foreground',
    description: 'text-muted-foreground',
    nav: 'text-destructive hover:bg-destructive/10 hover:text-destructive',
    action: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  },
  warning: {
    container: 'border-warning/80 bg-warning/10 text-foreground',
    icon: 'text-warning',
    title: 'text-foreground',
    description: 'text-muted-foreground',
    nav: 'text-warning hover:bg-warning/15 hover:text-warning',
    action: 'bg-warning text-warning-foreground hover:bg-warning/90',
  },
  info: {
    container: 'border-primary/60 bg-accent/70 text-foreground dark:bg-accent/35',
    icon: 'text-primary',
    title: 'text-foreground',
    description: 'text-muted-foreground',
    nav: 'text-primary hover:bg-primary/10 hover:text-primary',
    action: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
}

export function ActionCenterAlertBar({
  alerts,
  className,
}: ActionCenterAlertBarProps) {
  const tAuto = useTranslations('Auto')
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(alerts.length - 1, 0)))
  }, [alerts.length])

  if (alerts.length === 0) return null

  const activeAlert = alerts[activeIndex] ?? alerts[0]
  const tone = activeAlert.tone ?? 'neutral'
  const styles = toneStyles[tone]
  const Icon = activeAlert.icon ?? AlertCircle
  const hasMultipleAlerts = alerts.length > 1

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + alerts.length) % alerts.length)
  }

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % alerts.length)
  }

  return (
    <div className={cn('shrink-0 border-b border-border bg-background px-2 py-2 md:px-4', className)}>
      <div
        className={cn(
          'flex min-h-12 flex-col gap-3 rounded-md border px-3 py-2 shadow-sm',
          'sm:flex-row sm:items-center sm:px-4',
          styles.container,
        )}
        role={tone === 'critical' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {hasMultipleAlerts && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn('h-7 w-7', styles.nav)}
              aria-label={tAuto('onceki_uyari_6303bd3a')}
              onClick={showPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className={cn('min-w-10 text-center text-xs font-medium', styles.description)}>
              {activeIndex + 1} / {alerts.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn('h-7 w-7', styles.nav)}
              aria-label={tAuto('sonraki_uyari_cf62268a')}
              onClick={showNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0 sm:mt-0', styles.icon)} aria-hidden="true" />

          <div className="min-w-0 flex-1 text-sm leading-5">
            <span className={cn('font-semibold', styles.title)}>{activeAlert.title}</span>
            {activeAlert.description && (
              <span className={styles.description}> - {activeAlert.description}</span>
            )}
          </div>
        </div>

        {activeAlert.href && activeAlert.ctaLabel && (
          <Button asChild size="sm" className={cn('h-8 shrink-0 px-3 shadow-sm', styles.action)}>
            <Link href={activeAlert.href} target={activeAlert.target} rel={activeAlert.rel ?? undefined}>
              {activeAlert.ctaLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
