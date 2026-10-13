'use client'

import * as React from 'react'
import { ArrowUp, ChevronDown, Loader2, Pause, Play, Square } from 'lucide-react'

import { cn } from '@/lib/utils'

import './prompt-box.css'

/**
 * The prompt box, one for every place the user writes to an agent or a generator: the Spark project's chat, the main
 * Chat (New Video) and the avatar shot dock. Spark's composer: the field, then one bar of quiet chips with the send
 * button at its end. The parts are slots; each place fills the bar with its own controls, drawn as `PromptBoxChip`s.
 * Its look lives in `prompt-box.css` (Spark's tokens inside Spark, the same values from the app theme elsewhere).
 */

type PromptBoxProps = {
  /** `form` when the box submits itself (Enter in the field, the send button). */
  as?: 'div' | 'form'
  /** `big`: the start screen's box, a taller field. */
  size?: 'default' | 'big'
  /** Positioned over the box (a menu that opens above it); outside the flow. */
  overlay?: React.ReactNode
  /** Above the field, inside the frame: attachments, chips. Collapses when it renders nothing. */
  top?: React.ReactNode
  /** The bar under the field. */
  bar?: React.ReactNode
  children?: React.ReactNode
  className?: string
  onSubmit?: React.FormEventHandler<HTMLFormElement>
} & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'onSubmit'>

export const PromptBox = React.forwardRef<HTMLElement, PromptBoxProps>(function PromptBox(
  { as = 'div', size = 'default', overlay, top, bar, children, className, ...props },
  ref,
) {
  return React.createElement(
    as,
    { ref, className: cn('pb', size === 'big' && 'pb-big', className), ...props },
    overlay ?? null,
    top ? <div className="pb-top">{top}</div> : null,
    <div className="pb-field">{children}</div>,
    bar ? <div className="pb-bar">{bar}</div> : null,
  )
})

/** The field: grows with the text up to a few lines, then scrolls (without a visible bar). */
export const PromptBoxInput = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Enter sends (Shift+Enter is a new line); not while an IME is composing. */
  onSend?: () => void
}>(function PromptBoxInput({ className, onSend, onKeyDown, rows = 1, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn('pb-input', className)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || !onSend) return
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault()
          onSend()
        }
      }}
      {...props}
    />
  )
})

/** The gap that pushes what follows to the end of the bar. */
export function PromptBoxSpacer() {
  return <span className="pb-grow" />
}

/**
 * A quiet chip of the bar: an icon, a short value, a caret when it opens a menu. Also the `asChild` trigger of a
 * menu or popover (their props reach the button). `collapse`: the value hides when the box is narrow.
 */
export const PromptBoxChip = React.forwardRef<HTMLButtonElement, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon?: React.ReactNode
  label?: React.ReactNode
  /** Read by screen readers when the visible label is hidden or absent. */
  srLabel?: string
  caret?: boolean
  collapse?: boolean
  active?: boolean
  children?: React.ReactNode
}>(function PromptBoxChip({ icon, label, srLabel, caret, collapse, active, className, children, type = 'button', ...props }, ref) {
  return (
    <button ref={ref} type={type} className={cn('pb-chip', collapse && 'pb-fold', active && 'pb-on', className)} {...props}>
      {icon}
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
      {label ? <span className="pb-label">{label}</span> : null}
      {children}
      {caret ? <ChevronDown className="pb-caret" aria-hidden /> : null}
    </button>
  )
})

/** What a send costs, quiet beside the send button (`≈ 12 kredi`). */
export function PromptBoxNote({ children, title, icon }: { children: React.ReactNode; title?: string; icon?: React.ReactNode }) {
  return <span className="pb-note" title={title}>{icon}{children}</span>
}

const RUN_GLYPH = { stop: Square, pause: Pause, resume: Play }

/**
 * Send, or what stands in its place while a run is going: stop it, pause it, or start it again (`resume`); a spinner
 * while the send is on its way.
 */
export const PromptBoxSend = React.forwardRef<HTMLButtonElement, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  mode?: 'send' | 'stop' | 'pause' | 'resume'
  busy?: boolean
}>(function PromptBoxSend({ label, mode = 'send', busy, className, type, ...props }, ref) {
  const Glyph = mode === 'send' ? null : RUN_GLYPH[mode]
  return (
    <button
      ref={ref}
      type={type ?? (mode === 'send' ? 'submit' : 'button')}
      aria-label={label}
      title={props.title ?? label}
      className={cn('pb-send', Glyph && 'pb-run', className)}
      {...props}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : Glyph ? <Glyph className="fill-current" aria-hidden /> : <ArrowUp aria-hidden />}
    </button>
  )
})
