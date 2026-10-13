'use client'

import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ToolRunningIndicator({
  label = 'Running',
  ariaLabel,
  compact = false,
  className,
}: {
  label?: string
  ariaLabel?: string
  compact?: boolean
  className?: string
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={ariaLabel ?? label}
      data-testid="tool-running-indicator"
      className={cn(
        'relative isolate inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full border-0 bg-[#0b3554] font-semibold text-[#72c4ff] shadow-none',
        compact ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 -z-[1] w-1/2 animate-[research-progress-scan_2.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-[#72c4ff]/20 to-transparent motion-reduce:hidden"
      />
      <LoaderCircle
        aria-hidden="true"
        className="size-3.5 shrink-0 animate-spin text-[#72c4ff] motion-reduce:animate-none"
      />
      <span>{label}</span>
    </span>
  )
}
