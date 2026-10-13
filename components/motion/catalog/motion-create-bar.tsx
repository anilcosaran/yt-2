'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

const EXAMPLE_KEYS = ['lowerThird', 'counter', 'title', 'logo'] as const
export const MOTION_PROMPT_MAX_CHARS = 1000

/**
 * The "Create motion" bar at the top of the catalog: describe the Motion you want, and a new draft opens in the editor with
 * that sentence as the first message to the AI. `onSubmit` creates the draft and navigates; it answers false when nothing
 * was created (the bar keeps the text so nothing the user wrote is lost). A few example chips fill the box.
 */
export function MotionCreateBar({
  onSubmit,
  busy,
  failed,
  unavailable,
}: {
  onSubmit: (prompt: string) => Promise<boolean>
  busy: boolean
  failed: boolean
  /** The catalogue or looks the draft is forked from are not available: the bar says so and stays closed. */
  unavailable: boolean
}) {
  const t = useTranslations('Motion.catalog.create')
  const [text, setText] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const trimmed = text.trim()
  const disabled = busy || unavailable

  return (
    // `contents`: the form draws no box of its own, so the input row below sticks within the whole page while the example
    // chips scroll away with it (a tall sticky bar would cover the grid).
    <form
      aria-label={t('label')}
      className="contents"
      data-motion-create=""
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed === '' || disabled) return
        void onSubmit(trimmed).then((created) => {
          if (created) setText('')
        })
      }}
    >
      <div className="sticky top-0 z-20 -mx-6 border-b border-border bg-background/85 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-border bg-panel/60 p-1.5 pl-4 shadow-sm focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
          <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            maxLength={MOTION_PROMPT_MAX_CHARS}
            disabled={disabled}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <Button type="submit" size="sm" className="rounded-xl" disabled={disabled || trimmed === ''} aria-busy={busy || undefined}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? t('submitting') : t('submit')}
          </Button>
        </div>
      </div>
      <div className="mx-auto mt-3 mb-6 flex w-full max-w-3xl flex-wrap items-center justify-center gap-1.5">
        {unavailable ? (
          <p role="status" className="px-1 text-xs text-muted-foreground">{t('unavailable')}</p>
        ) : failed ? (
          <p role="alert" className="px-1 text-xs text-destructive">{t('failed')}</p>
        ) : (
          <div className="flex max-w-full min-w-0 flex-wrap items-center justify-center gap-1.5" role="group" aria-label={t('examplesLabel')}>
            {EXAMPLE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                className="max-w-full truncate rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                onClick={() => {
                  setText(t(`examples.${key}`))
                  inputRef.current?.focus()
                }}
              >
                {t(`examples.${key}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  )
}
