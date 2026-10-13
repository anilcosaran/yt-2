'use client'

import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ToolMediaLoadingIndicator({
  label,
  size = 'md',
  className,
}: {
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      data-testid="tool-media-loading-indicator"
      className={cn('inline-flex items-center justify-center text-white/75', className)}
    >
      <LoaderCircle
        aria-hidden="true"
        className={cn(
          'shrink-0 animate-spin motion-reduce:animate-none',
          size === 'sm' ? 'size-4' : 'size-6',
        )}
      />
    </span>
  )
}
