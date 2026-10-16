'use client'

import * as React from 'react'

import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** The floating bars over the board (tools, zoom, a card's own bar): one quiet surface. */
export const canvasDockClass =
  'pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-border bg-popover/95 p-1 text-popover-foreground shadow-[var(--cv-shadow-lift)] backdrop-blur-xl'

type CanvasDockButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  shortcut?: string
  active?: boolean
  tone?: 'default' | 'primary' | 'danger'
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
}

/** An icon button of a dock, with its name (and key) in a tooltip. */
export const CanvasDockButton = React.forwardRef<HTMLButtonElement, CanvasDockButtonProps>(function CanvasDockButton(
  { label, shortcut, active, tone = 'default', side = 'top', className, children, type = 'button', ...props },
  ref,
) {
  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type={type}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'nodrag nopan flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4',
            tone === 'default' && 'hover:bg-accent hover:text-foreground',
            tone === 'default' && active && 'bg-accent text-foreground',
            tone === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
            tone === 'danger' && 'hover:bg-destructive/10 hover:text-destructive',
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="flex items-center gap-2">
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  )
})

export function CanvasDockDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
}
