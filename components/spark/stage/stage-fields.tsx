'use client'

import * as React from 'react'

import { parseFieldNumber } from '@/lib/spark/stage/toolbox-model'

/**
 * Small controls shared by the floating toolbox and the Properties inspector. Both commit ONE value when the user is done
 * (a picker closes, Enter, blur), never per keystroke or per colour-picker move: one change = one typed command = one undo
 * group, and the working copy is never flooded while the user is still choosing.
 */

/**
 * `<input type="color">` that commits on the NATIVE `change` event (the picker closing). React's `onChange` for a colour
 * input is the native `input` event, which fires continuously while the picker is dragged; that would write a command per
 * pixel of movement.
 */
export function ColorInput({
  value,
  label,
  disabled,
  title,
  onCommit,
  onPreview,
}: {
  value: string
  label: string
  disabled?: boolean
  title?: string
  onCommit: (color: string) => void
  /**
   * While the picker is open: the colour under the pointer (the canvas shows it without writing anything), then `null` when
   * the picker is left without a choice. The commit still happens once, on `change`.
   */
  onPreview?: (color: string | null) => void
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  const commit = React.useRef(onCommit)
  const preview = React.useRef(onPreview)
  React.useEffect(() => {
    commit.current = onCommit
    preview.current = onPreview
  })

  React.useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    let previewing = false
    const onChange = () => {
      previewing = false
      commit.current(element.value)
    }
    const onInput = () => {
      if (!preview.current) return
      previewing = true
      preview.current(element.value)
    }
    const onBlur = () => {
      if (!previewing) return
      previewing = false
      preview.current?.(null)
    }
    element.addEventListener('change', onChange)
    element.addEventListener('input', onInput)
    element.addEventListener('blur', onBlur)
    return () => {
      element.removeEventListener('change', onChange)
      element.removeEventListener('input', onInput)
      element.removeEventListener('blur', onBlur)
    }
  }, [])

  // Follows the stored value unless the user is in the picker.
  React.useEffect(() => {
    const element = ref.current
    if (element && element.ownerDocument.activeElement !== element && element.value !== value) element.value = value
  }, [value])

  return <input ref={ref} type="color" defaultValue={value} aria-label={label} title={title} disabled={disabled} />
}

/**
 * Spark styling round: an `<input type="range">` with the same contract as `ColorInput`: `onPreview` follows the thumb (the
 * canvas shows it, nothing is written), `onCommit` runs once on the NATIVE `change` event (the thumb released, or one arrow key
 * press), and `onPreview(null)` when the field is left without a change. The shown number follows the thumb.
 */
export function RangeField({
  value,
  min,
  max,
  step = 1,
  label,
  disabled,
  format = (number) => String(number),
  onCommit,
  onPreview,
}: {
  value: number
  min: number
  max: number
  step?: number
  label: string
  disabled?: boolean
  format?: (value: number) => string
  onCommit: (value: number) => void
  onPreview?: (value: number | null) => void
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [live, setLive] = React.useState<number | null>(null)
  const commit = React.useRef(onCommit)
  const preview = React.useRef(onPreview)
  React.useEffect(() => {
    commit.current = onCommit
    preview.current = onPreview
  })

  React.useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    let previewing = false
    const onChange = () => {
      previewing = false
      setLive(null)
      commit.current(Number(element.value))
    }
    const onInput = () => {
      previewing = true
      setLive(Number(element.value))
      preview.current?.(Number(element.value))
    }
    const onBlur = () => {
      if (!previewing) return
      previewing = false
      setLive(null)
      preview.current?.(null)
    }
    element.addEventListener('change', onChange)
    element.addEventListener('input', onInput)
    element.addEventListener('blur', onBlur)
    return () => {
      element.removeEventListener('change', onChange)
      element.removeEventListener('input', onInput)
      element.removeEventListener('blur', onBlur)
    }
  }, [])

  // Follows the stored value unless the user is dragging the thumb.
  React.useEffect(() => {
    const element = ref.current
    if (element && live === null && Number(element.value) !== value) element.value = String(value)
  }, [value, live])

  return (
    <>
      <input ref={ref} type="range" min={min} max={max} step={step} defaultValue={value} aria-label={label} aria-valuetext={format(live ?? value)} disabled={disabled} />
      <output>{format(live ?? value)}</output>
    </>
  )
}

/**
 * A numeric text field: the draft is local, Enter or blur commits when it parses and differs, Escape restores. A value the
 * parent changes meanwhile (after a command) replaces the draft unless the user is typing.
 */
export function NumberField({
  value,
  label,
  unit,
  disabled,
  title,
  variant = 'field',
  format = (number) => String(number),
  onCommit,
}: {
  value: number
  label: string
  unit?: string
  disabled?: boolean
  title?: string
  /** `field`: the panel's bordered `.field` (Properties). `bare`: the toolbox's compact `.num` input. */
  variant?: 'field' | 'bare'
  format?: (value: number) => string
  onCommit: (value: number) => void
}) {
  const shown = format(value)
  const [draft, setDraftState] = React.useState<string | null>(null)
  // The ref is the synchronous truth: Enter commits and then blurs, and the blur must not commit the same draft again.
  const draftRef = React.useRef<string | null>(null)
  const setDraft = (next: string | null) => {
    draftRef.current = next
    setDraftState(next)
  }
  const text = draft ?? shown

  const finish = (commitDraft: boolean) => {
    const current = draftRef.current
    setDraft(null)
    if (!commitDraft || current === null) return
    const parsed = parseFieldNumber(current)
    if (parsed !== null && format(parsed) !== shown) onCommit(parsed)
  }

  const input = (
    <input
      className={variant === 'bare' ? 'num' : undefined}
      inputMode="decimal"
      aria-label={label}
      title={variant === 'bare' ? title : undefined}
      value={text}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(true)
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          finish(false)
          event.currentTarget.blur()
        }
      }}
    />
  )
  if (variant === 'bare') return input
  return (
    <label className="field" title={title}>
      {input}
      {unit ? <span className="unit">{unit}</span> : null}
    </label>
  )
}
