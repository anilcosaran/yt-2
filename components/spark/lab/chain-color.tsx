'use client'

import * as React from 'react'

import './chain-color.css'

// The colour picker of Plan › Üretim's canvas toolbars (`chain-annotations.tsx`): a frame's colour, a text's colour and
// its background. In the toolbar it is one small swatch (or an icon with the colour under it); a press opens a popover
// under it with a colour wheel (hue around, saturation outward), a brightness slider, the colours used lately and the
// value in hex. Every move on the wheel or the slider is said at once, so what is coloured follows the pointer.

/** A colour by hue (0–360), saturation (0–1) and brightness (0–1): what the wheel and the slider move. */
export type Hsv = { h: number; s: number; v: number }

/** Where the colours used lately are kept, most recent first, in this browser only. */
const RECENTS_KEY = 'yt2.canvas.colors'
const RECENTS_MAX = 8

/** The colour shown when the picker opens on no colour at all: the canvas's blue. */
const START: Hsv = { h: 217, s: 0.76, v: 0.96 }

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

/** A hex colour (`#abc`, `abc`, `#aabbcc`…) as `#aabbcc`, or null if it is not one. */
export function normalizeHex(input: string | null | undefined): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((input ?? '').trim())
  if (!match) return null
  const digits = match[1].toLowerCase()
  return `#${digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits}`
}

/** A hex colour on the wheel; null if it is not one. A grey keeps hue 0, as it has none. */
export function hexToHsv(hex: string): Hsv | null {
  const norm = normalizeHex(hex)
  if (!norm) return null
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(norm.slice(at, at + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const span = max - Math.min(r, g, b)
  let h = 0
  if (span) {
    if (max === r) h = ((g - b) / span) % 6
    else if (max === g) h = (b - r) / span + 2
    else h = (r - g) / span + 4
    h = (h * 60 + 360) % 360
  }
  return { h, s: max ? span / max : 0, v: max }
}

/** A point of the wheel (and the slider) as `#aabbcc`. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6
    const value = v - v * s * clamp(Math.min(k, 4 - k))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}

/** A text colour that reads on a background of this colour: near-black on a light one, near-white on a dark one. */
export function contrastText(background: string): string {
  const norm = normalizeHex(background)
  if (!norm) return 'inherit'
  const [r, g, b] = [1, 3, 5].map((at) => {
    const c = parseInt(norm.slice(at, at + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? '#1f1e1d' : '#f5f5f4'
}

/** The colours used lately; nothing if the browser keeps none or will not say. */
function readRecents(): string[] {
  try {
    const list: unknown = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? '[]')
    if (!Array.isArray(list)) return []
    const colors = list.map((entry) => (typeof entry === 'string' ? normalizeHex(entry) : null)).filter((entry): entry is string => !!entry)
    return [...new Set(colors)].slice(0, RECENTS_MAX)
  } catch {
    return []
  }
}

/** Puts a colour first among those used lately (once), keeping the few most recent. */
function rememberColor(color: string) {
  try {
    const list = [color, ...readRecents().filter((entry) => entry !== color)].slice(0, RECENTS_MAX)
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list))
  } catch {
    // A browser that keeps nothing (a private window, blocked storage) only loses the row of recent colours.
  }
}

/**
 * Closes a popover on Escape or on a press anywhere outside `box` (the popover and the button that opens it, so a press
 * on that button is left to it). Captured, so a press React Flow keeps to itself (on the pane, a node) still closes it.
 */
export function useDismiss(open: boolean, box: React.RefObject<HTMLElement | null>, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && box.current?.contains(target)) return
      onClose()
    }
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('keydown', esc)
    }
  }, [open, box, onClose])
}

/**
 * A colour in a toolbar: a small round swatch (a diagonal hairline when there is none), or `icon` with the colour as a
 * bar under it. A press opens the picker under it; a colour changed there joins the recent ones when it closes.
 */
export function ColorButton({ value, onChange, label, allowNone = false, icon, noneLabel = 'Yok' }: {
  value: string | null
  onChange: (value: string | null) => void
  label: string
  /** Offers "no colour" (null) beside the others. */
  allowNone?: boolean
  icon?: React.ReactNode
  /** What "no colour" is called, e.g. "Varsayılan" where none means the usual text colour. */
  noneLabel?: string
}) {
  // The colour the picker opened on, so closing it knows whether the user changed it; null while it is closed.
  const [opened, setOpened] = React.useState<{ value: string | null } | null>(null)
  const box = React.useRef<HTMLSpanElement>(null)
  const hex = normalizeHex(value)
  const open = opened !== null

  const close = () => {
    if (opened && hex && hex !== normalizeHex(opened.value)) rememberColor(hex)
    setOpened(null)
  }
  useDismiss(open, box, close)

  return (
    <span ref={box} className="lb-cc">
      <button
        type="button"
        className={`lb-cc-btn${icon ? ' icon' : ''}${open ? ' on' : ''}`}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpened({ value }))}
      >
        {icon ? (
          <>
            {icon}
            <i className={`lb-cc-bar${hex ? '' : ' none'}`} style={hex ? { background: hex } : undefined} aria-hidden />
          </>
        ) : (
          <i className={`lb-cc-dot${hex ? '' : ' none'}`} style={hex ? { background: hex } : undefined} aria-hidden />
        )}
      </button>
      {open ? <ColorPanel value={hex} onChange={onChange} label={label} allowNone={allowNone} noneLabel={noneLabel} /> : null}
    </span>
  )
}

/** The picker itself, under its button: the wheel, the brightness slider, the recent colours, the hex field and "none". */
function ColorPanel({ value, onChange, label, allowNone, noneLabel }: {
  value: string | null
  onChange: (value: string | null) => void
  label: string
  allowNone: boolean
  noneLabel: string
}) {
  // The wheel's own position, kept apart from the hex so a grey or black keeps the hue it was dragged to.
  const [hsv, setHsv] = React.useState<Hsv>(() => (value ? hexToHsv(value) : null) ?? START)
  const [recents] = React.useState(readRecents)
  // The hex being typed, until Enter or a click away applies it.
  const [draft, setDraft] = React.useState<string | null>(null)

  const set = (next: Hsv) => {
    setHsv(next)
    const hex = hsvToHex(next)
    if (hex !== value) onChange(hex)
  }
  const pick = (hex: string) => {
    setHsv(hexToHsv(hex) ?? START)
    if (hex !== value) onChange(hex)
  }

  // The wheel: hue is the angle clockwise from the top (as the conic gradient draws it), saturation the distance out.
  const fromWheel = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const radius = rect.width / 2
    const dx = event.clientX - rect.left - radius
    const dy = event.clientY - rect.top - radius
    set({ h: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360, s: clamp(Math.hypot(dx, dy) / radius), v: hsv.v })
  }
  const fromSlider = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    set({ ...hsv, v: clamp((event.clientX - rect.left) / rect.width) })
  }
  // A drag keeps the pointer, so it goes on past the wheel's (or the slider's) edge.
  const drag = (apply: (event: React.PointerEvent<HTMLDivElement>) => void) => ({
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.focus({ preventScroll: true })
      apply(event)
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) apply(event)
    },
  })

  const angle = (hsv.h * Math.PI) / 180
  const current = value ?? hsvToHex(hsv)
  const applyDraft = () => {
    const hex = draft === null ? null : normalizeHex(draft)
    if (hex) pick(hex)
    setDraft(null)
  }

  return (
    <div className="lb-cc-pop lb-cc-panel nodrag nopan nowheel nokey" role="dialog" aria-label={label}>
      <div
        className="lb-cc-wheel"
        role="slider"
        tabIndex={0}
        aria-label="Renk tonu ve doygunluk"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={value ?? noneLabel}
        style={{ '--cc-dim': 1 - hsv.v } as React.CSSProperties}
        {...drag(fromWheel)}
        onKeyDown={(event) => {
          // Left and right turn the hue, up and down move toward the edge or the centre; Shift takes bigger steps.
          const step = event.shiftKey ? 10 : 2
          const turn = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
          const out = event.key === 'ArrowUp' ? step / 100 : event.key === 'ArrowDown' ? -step / 100 : 0
          if (!turn && !out) return
          event.preventDefault()
          set({ ...hsv, h: (hsv.h + turn + 360) % 360, s: clamp(hsv.s + out) })
        }}
      >
        <i
          className={`lb-cc-thumb${value ? '' : ' idle'}`}
          style={{ left: `${50 + Math.sin(angle) * hsv.s * 50}%`, top: `${50 - Math.cos(angle) * hsv.s * 50}%`, background: current }}
          aria-hidden
        />
      </div>

      <div
        className="lb-cc-value"
        role="slider"
        tabIndex={0}
        aria-label="Parlaklık"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.v * 100)}
        style={{ '--cc-full': hsvToHex({ ...hsv, v: 1 }) } as React.CSSProperties}
        {...drag(fromSlider)}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.02
          const steps: Record<string, number> = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, Home: -1, End: 1 }
          if (!(event.key in steps)) return
          event.preventDefault()
          set({ ...hsv, v: clamp(hsv.v + steps[event.key]) })
        }}
      >
        <i className={`lb-cc-thumb${value ? '' : ' idle'}`} style={{ left: `${hsv.v * 100}%`, background: current }} aria-hidden />
      </div>

      {recents.length ? (
        <div className="lb-cc-recent" role="group" aria-label="Son kullanılan renkler">
          {recents.map((color) => (
            <button
              key={color}
              type="button"
              className={`lb-cc-chip${color === value ? ' on' : ''}`}
              style={{ background: color }}
              title={color.toUpperCase()}
              aria-label={color.toUpperCase()}
              aria-pressed={color === value}
              onClick={() => pick(color)}
            />
          ))}
        </div>
      ) : null}

      <div className="lb-cc-foot">
        <label className="lb-cc-hex">
          <i style={value ? { background: value } : undefined} className={value ? undefined : 'none'} aria-hidden />
          <span aria-hidden>#</span>
          <input
            value={draft ?? (value ? value.slice(1).toUpperCase() : '')}
            placeholder={noneLabel}
            aria-label="Renk kodu"
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              setDraft(event.target.value)
              // A whole six-digit code applies as it is typed, so a press outside (which closes the picker) keeps it.
              const hex = normalizeHex(event.target.value)
              if (hex && event.target.value.replace('#', '').trim().length === 6) pick(hex)
            }}
            onBlur={applyDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) applyDraft()
            }}
          />
        </label>
        {allowNone ? (
          <button type="button" className={`lb-cc-none${value === null ? ' on' : ''}`} aria-pressed={value === null} onClick={() => onChange(null)}>
            <i aria-hidden />
            {noneLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
