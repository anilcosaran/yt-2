import * as React from 'react'

import { cn } from '@/lib/utils'

type PageHeaderIcon = React.ComponentType<{ className?: string }>

type PageHeaderBreadcrumb = {
  label: string
  icon?: PageHeaderIcon
}

type PageHeaderProps = {
  title: string
  icon?: PageHeaderIcon
  badge?: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: PageHeaderBreadcrumb[]
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  icon: Icon,
  badge,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-3 flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={item.label + '-' + index}>
              {index > 0 && <span className="text-muted-foreground/50">/</span>}
              <span className={cn('min-w-0 truncate', index === breadcrumbs.length - 1 && 'text-foreground')}>
                {item.label}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {Icon && (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-panel/60">
              <Icon className="size-5 text-foreground" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="min-w-0 truncate font-display text-3xl text-foreground md:text-4xl">{title}</h1>
              {badge && <span className="shrink-0">{badge}</span>}
            </div>
            {description && <p className="mt-1 max-w-xl text-pretty text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}