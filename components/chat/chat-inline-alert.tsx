import * as React from 'react'
import { Check, CircleAlert, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ChatInlineAlertTone = 'error' | 'warning' | 'info' | 'success'

export function ChatInlineAlert({
  tone,
  title,
  detail,
  className,
  action,
}: {
  tone: ChatInlineAlertTone
  title: string
  detail: string
  className?: string
  action?: React.ReactNode
}) {
  const toneClass = {
    error: {
      shell: 'border-destructive/22 bg-card shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-red-400/22 dark:bg-red-500/[0.07] dark:shadow-[0_16px_44px_rgba(0,0,0,0.22)]',
      accent: 'bg-destructive',
      icon: 'bg-destructive/10 text-destructive ring-destructive/15 dark:bg-red-400/12 dark:text-red-200 dark:ring-red-300/18',
      Icon: CircleAlert,
    },
    warning: {
      shell: 'border-amber-500/24 bg-card shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-amber-200/22 dark:bg-amber-300/[0.08] dark:shadow-[0_16px_44px_rgba(0,0,0,0.22)]',
      accent: 'bg-amber-500',
      icon: 'bg-amber-500/12 text-amber-700 ring-amber-500/18 dark:bg-amber-200/14 dark:text-amber-100 dark:ring-amber-200/16',
      Icon: CircleAlert,
    },
    info: {
      shell: 'border-info/24 bg-card shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-info/30 dark:bg-info/[0.08] dark:shadow-[0_16px_44px_rgba(0,0,0,0.22)]',
      accent: 'bg-info',
      icon: 'bg-info/12 text-info ring-info/18 dark:bg-info/14 dark:text-info dark:ring-info/18',
      Icon: Sparkles,
    },
    success: {
      shell: 'border-success/24 bg-card shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-success/30 dark:bg-success/[0.08] dark:shadow-[0_16px_44px_rgba(0,0,0,0.22)]',
      accent: 'bg-success',
      icon: 'bg-success/12 text-success ring-success/18 dark:bg-success/14 dark:text-success dark:ring-success/18',
      Icon: Check,
    },
  }[tone]
  const Icon = toneClass.Icon

  return (
    <div className={cn('relative overflow-hidden rounded-md border px-4 py-3 text-sm text-card-foreground', toneClass.shell, className)}>
      <span className={cn('absolute inset-y-0 left-0 w-1', toneClass.accent)} aria-hidden="true" />
      <div className="flex items-start gap-3 pl-1">
        <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1', toneClass.icon)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground dark:text-white">{title}</p>
          <p className="mt-1 break-words leading-6 text-muted-foreground dark:text-white/64">{detail}</p>
          {action ? <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}
