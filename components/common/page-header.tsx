import * as React from 'react'

import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  badge?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

/**
 * Every page's heading, the same on each: the title on the column's left edge (no icon tile or breadcrumb in front of
 * it; the tab above already names the page and the sidebar the channel), a quiet line under it, actions on the right.
 */
export function PageHeader({
  title,
  badge,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="min-w-0 truncate font-display text-2xl text-foreground md:text-[26px]">{title}</h1>
          {badge && <span className="shrink-0 text-sm text-muted-foreground">{badge}</span>}
        </div>
        {description && <p className="mt-1 max-w-2xl text-pretty text-[14px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
