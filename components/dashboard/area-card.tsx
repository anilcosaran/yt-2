'use client'

import { cn } from '@/lib/utils'
import { ChevronDown, Folder } from 'lucide-react'
import type { Area } from '@/lib/types'
import { useTranslations } from 'next-intl'

interface AreaCardProps {
  area: Area
  className?: string
}

export function AreaCard({ area, className }: AreaCardProps) {
  const tDashboard = useTranslations('Dashboard')
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-4 transition-shadow hover:shadow-md',
        className
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded"
          style={{ backgroundColor: area.color + '20' }}
        >
          <Folder className="h-5 w-5" style={{ color: area.color }} />
        </div>
        <div className="flex-1">
          <span className="font-medium text-foreground">
            {area.name}
          </span>
          <p className="text-xs text-muted-foreground">{area.description}</p>
        </div>
      </div>

      {/* Quick Links */}
      {area.quickLinks && area.quickLinks.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {area.type === 'support' ? tDashboard('areas.recentQueues') : tDashboard('areas.quickLinks')}
          </p>
          {area.quickLinks.map((link) => (
            <div
              key={link.href}
              className="flex items-center justify-between text-sm text-muted-foreground"
            >
              <span>{link.label}</span>
              {link.count !== undefined && (
                <span className="text-muted-foreground">{link.count}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {area.viewCount !== undefined ? (
            <>{tDashboard('areas.views', { count: area.viewCount })}</>
          ) : area.queueCount !== undefined ? (
            <>{tDashboard('areas.queues', { count: area.queueCount })}</>
          ) : (
            <>{tDashboard('areas.boards', { count: 1 })}</>
          )}
          <ChevronDown className="h-3 w-3" />
        </div>
      </div>
    </div>
  )
}
