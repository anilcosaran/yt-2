'use client'

import { cn } from '@/lib/utils'
import { Users } from 'lucide-react'

interface SegmentBadgeProps {
  count: number
  label: string
  className?: string
}

export function SegmentBadge({ count, label, className }: SegmentBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs text-muted-foreground',
        className
      )}
    >
      <Users className="h-3 w-3" />
      <span className="font-medium">{count}</span>
      <span>{label}</span>
    </span>
  )
}
