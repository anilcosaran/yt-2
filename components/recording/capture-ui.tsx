'use client'

import * as React from 'react'
import { Check, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/*
 * Minimal black & white building blocks for the avatar capture pages. They deliberately use
 * explicit neutral colors instead of theme tokens so the capture always renders in a light
 * appearance, even when the surrounding app runs in dark mode.
 */

export type CaptureLayout = 'fullscreen' | 'embedded'

export function CaptureSurface({
  layout,
  children,
  className,
  brand,
}: {
  layout: CaptureLayout
  children: React.ReactNode
  className?: string
  /** Optional small wordmark shown at the top of the fullscreen layout. */
  brand?: React.ReactNode
}) {
  const fullscreen = layout === 'fullscreen'
  useLightFullscreenDocument(fullscreen)

  if (!fullscreen) {
    return (
      <div
        data-theme="light"
        style={{ colorScheme: 'light' }}
        className={cn(
          'light relative w-full rounded-[28px] border border-neutral-200 bg-white px-5 py-6 text-neutral-950 antialiased sm:px-8 sm:py-8',
          className,
        )}
      >
        <div className="mx-auto flex w-full max-w-md flex-col">{children}</div>
      </div>
    )
  }

  return (
    <div
      data-theme="light"
      style={{ colorScheme: 'light' }}
      className={cn(
        'light fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-white text-neutral-950 antialiased touch-manipulation',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex min-h-full w-full max-w-md flex-col',
          'pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]',
          'pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]',
        )}
      >
        {brand ? <div className="mb-6 flex h-8 shrink-0 items-center">{brand}</div> : null}
        <div className="flex min-h-0 flex-1 flex-col sm:justify-center">{children}</div>
      </div>
    </div>
  )
}

/** While a fullscreen capture is mounted, paint the document white and stop body scrolling. */
function useLightFullscreenDocument(active: boolean) {
  React.useEffect(() => {
    if (!active) return
    const html = document.documentElement
    const body = document.body
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      htmlBackground: html.style.backgroundColor,
      bodyBackground: body.style.backgroundColor,
      htmlColorScheme: html.style.colorScheme,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    html.style.backgroundColor = '#ffffff'
    body.style.backgroundColor = '#ffffff'
    html.style.colorScheme = 'light'
    return () => {
      html.style.overflow = previous.htmlOverflow
      body.style.overflow = previous.bodyOverflow
      html.style.overscrollBehavior = previous.htmlOverscroll
      html.style.backgroundColor = previous.htmlBackground
      body.style.backgroundColor = previous.bodyBackground
      html.style.colorScheme = previous.htmlColorScheme
    }
  }, [active])
}

export function CaptureWordmark() {
  return <span className="text-sm font-semibold tracking-tight text-neutral-950">Youtorch</span>
}

type CaptureButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  busy?: boolean
}

export const CaptureButton = React.forwardRef<HTMLButtonElement, CaptureButtonProps>(
  function CaptureButton({ variant = 'primary', busy = false, className, children, disabled, type, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={cn(
          'inline-flex h-14 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-base font-medium transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          'active:scale-[0.985] disabled:cursor-not-allowed disabled:active:scale-100',
          variant === 'primary'
            ? 'bg-neutral-950 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-white'
            : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 disabled:text-neutral-400',
          className,
        )}
        {...props}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    )
  },
)

export function CaptureIconButton({
  label,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-900 transition',
        'hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function CaptureStepHeader({
  step,
  total,
  stepLabel,
  title,
  description,
}: {
  step: number
  total: number
  stepLabel: string
  title: string
  description?: string
}) {
  return (
    <header className="shrink-0">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn('h-1 flex-1 rounded-full', index < step ? 'bg-neutral-950' : 'bg-neutral-200')}
          />
        ))}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">{stepLabel}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">{title}</h1>
      {description ? <p className="mt-1.5 text-sm leading-6 text-neutral-500">{description}</p> : null}
    </header>
  )
}

export function CaptureNotice({
  children,
  help,
  tone = 'error',
}: {
  children: React.ReactNode
  help?: React.ReactNode
  tone?: 'error' | 'info'
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm leading-6',
        tone === 'error' ? 'border-neutral-950 text-neutral-950' : 'border-neutral-200 text-neutral-600',
      )}
    >
      <p className="font-medium">{children}</p>
      {help ? <p className="mt-1 text-neutral-500">{help}</p> : null}
    </div>
  )
}

export function CaptureSuccess({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center" role="status">
      <span className="flex size-20 items-center justify-center rounded-full bg-neutral-950 text-white">
        <Check className="size-10" strokeWidth={2.5} aria-hidden />
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-neutral-950">{title}</h1>
      {description ? <p className="mt-2 max-w-xs text-base leading-7 text-neutral-500">{description}</p> : null}
    </div>
  )
}

export function CaptureMessage({
  title,
  description,
  hint,
  busy = false,
  children,
}: {
  title: string
  description?: string | null
  hint?: string | null
  busy?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center" role={busy ? 'status' : undefined}>
      {busy ? <Loader2 className="mb-4 size-6 animate-spin text-neutral-400" aria-hidden /> : null}
      <p className={cn('text-neutral-950', busy ? 'text-sm text-neutral-500' : 'text-xl font-semibold tracking-tight')}>
        {title}
      </p>
      {description ? <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-500">{description}</p> : null}
      {hint ? <p className="mt-4 max-w-xs text-xs leading-5 text-neutral-400">{hint}</p> : null}
      {children}
    </div>
  )
}

export function CaptureProgress({
  value,
  title,
  hint,
}: {
  value: number
  title: string
  hint?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center" role="status" aria-live="polite">
      <p className="text-4xl font-semibold tabular-nums tracking-tight text-neutral-950">{clamped}%</p>
      <div
        className="mt-5 h-1 w-full max-w-60 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={title}
      >
        <div
          className="h-full origin-left rounded-full bg-neutral-950 transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      </div>
      <p className="mt-5 text-base font-medium text-neutral-950">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-sm leading-6 text-neutral-500">{hint}</p> : null}
    </div>
  )
}
