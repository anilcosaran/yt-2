'use client'

import * as React from 'react'

import { Icon } from './lab-parts'
import './chain-model-menu.css'

// The model menu a node's composer opens from its model chip on Plan › Üretim: one soft surface, a row per model with
// its letter, its name and a line about it, and, for models, three small meters (speed, quality, cost) under a header,
// so the choice reads at a glance. A voice or music has no meters: the same rows as a plain, narrower list. "Otomatik",
// when offered, comes last: Spark picks per request. Arrow keys move, Enter picks, Escape or a press outside closes.

/** How a model does on speed, quality and cost, each 1–5 (5: fastest, best, most expensive). */
export type ModelMeters = { speed: number; quality: number; cost: number }

/** A row of the menu: a model (or voice, or music) with a line about it; `letter` overrides its badge's letter. */
export type ModelOption = { id: string; label: string; sub: string; letter?: string; meters?: ModelMeters }

/** Meters for the lab's models, by id (from MODELS in `lab-model.ts`). */
export const MODEL_METERS: Record<string, ModelMeters> = {
  'kling-2-5': { speed: 4, quality: 3, cost: 2 },
  'seedance-1-pro': { speed: 3, quality: 4, cost: 3 },
  'sora-2': { speed: 1, quality: 5, cost: 5 },
  'flux-2-pro': { speed: 4, quality: 4, cost: 2 },
  'flux-2-klein': { speed: 5, quality: 2, cost: 1 },
}

/** The id of the "Otomatik" row. */
const AUTO = 'auto'
/** The three meters, in the header's order. */
const METERS = [
  { key: 'speed', head: 'HIZ', name: 'Hız' },
  { key: 'quality', head: 'KALİTE', name: 'Kalite' },
  { key: 'cost', head: 'MALİYET', name: 'Maliyet' },
] as const
/** Dashes in a meter. */
const STEPS = [0, 1, 2, 3, 4]

type Row = ModelOption & { auto?: boolean }

/** The menu itself; the parent mounts it while open, inside a positioned anchor (usually beside the chip). */
export function ModelMenu({ options, value, auto, onPick, onClose, placement = 'up' }: {
  options: ModelOption[]
  /** The selected option's id; 'auto' is Otomatik. */
  value: string
  /** When given, an "Otomatik" row at the end: picks per request; its meters column reads "Değişir". */
  auto?: { sub: string }
  onPick: (id: string) => void
  onClose: () => void
  /** Opens above (default) or below its anchor; the parent positions an absolutely placed wrapper. */
  placement?: 'up' | 'down'
}): React.JSX.Element {
  const root = React.useRef<HTMLDivElement>(null)
  const base = React.useId()
  const rows: Row[] = auto ? [...options, { id: AUTO, label: 'Otomatik', sub: auto.sub, auto: true }] : options
  const metered = options.some((option) => option.meters)
  // The row the keyboard (or the pointer) is on; none until either moves.
  const [active, setActive] = React.useState<number | null>(null)
  const idOf = (index: number) => `${base}-o${index}`

  // Keys go to the menu while it is open; when it closes, focus goes back to where it was (the chip), unless the
  // user has moved it somewhere else on purpose.
  React.useEffect(() => {
    const node = root.current
    if (!node) return
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    node.focus({ preventScroll: true })
    return () => {
      const now = document.activeElement
      if (before?.isConnected && (!now || now === document.body || node.contains(now))) before.focus({ preventScroll: true })
    }
  }, [])

  // A press outside closes it. A press inside its anchor does not count, so the chip beside it can toggle it.
  React.useEffect(() => {
    const away = (event: PointerEvent) => {
      const node = root.current
      const target = event.target as globalThis.Node | null
      if (!node || !target) return
      if (!(node.parentElement ?? node).contains(target)) onClose()
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [onClose])

  const pick = (id: string) => {
    onPick(id)
    onClose()
  }
  const start = () => {
    const at = rows.findIndex((row) => row.id === value)
    return at < 0 ? null : at
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = rows.length - 1
    if (last < 0 && event.key !== 'Escape') return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive(active === null ? (start() ?? 0) : Math.min(last, active + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(active === null ? (start() ?? last) : Math.max(0, active - 1))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(last)
        break
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const row = active === null ? undefined : rows[active]
        if (row) pick(row.id)
        else onClose()
        break
      }
      case 'Escape':
        // Only this menu closes, not the panel or popup around it that also listens for Escape.
        event.preventDefault()
        event.stopPropagation()
        onClose()
        break
      case 'Tab':
        onClose()
        break
    }
  }

  return (
    <div
      ref={root}
      className={`lb-mm ${placement}${metered ? ' metered' : ''} nodrag nowheel nokey`}
      role="listbox"
      aria-label={metered ? 'Model' : 'Seçenekler'}
      aria-activedescendant={active === null ? undefined : idOf(active)}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerLeave={() => setActive(null)}
    >
      {metered ? (
        <div className="lb-mm-head" aria-hidden>
          <span className="lb-mm-head-name">MODEL</span>
          {METERS.map((meter) => <span key={meter.key}>{meter.head}</span>)}
        </div>
      ) : null}
      {rows.map((row, index) => {
        const on = row.id === value
        const meters = metered ? row.meters : undefined
        return (
          <div
            key={row.id}
            id={idOf(index)}
            role="option"
            aria-selected={on}
            className={`lb-mm-row${index === active ? ' active' : ''}${on ? ' on' : ''}${row.auto ? ' auto' : ''}`}
            onPointerMove={() => {
              if (active !== index) setActive(index)
            }}
            onClick={() => pick(row.id)}
          >
            <span className="lb-mm-badge" aria-hidden>{row.auto ? <Icon name="sparkles" size="sm" /> : letterOf(row)}</span>
            <span className="lb-mm-text">
              <span className="lb-mm-name">
                <span className="lb-mm-label">{row.label}</span>
                {on ? <Icon name="check" size="sm" /> : null}
              </span>
              {row.sub ? <small className="lb-mm-sub">{row.sub}</small> : null}
            </span>
            {metered && row.auto ? <span className="lb-mm-varies">Değişir</span> : null}
            {meters ? METERS.map((meter) => <Meter key={meter.key} name={meter.name} value={meters[meter.key]} />) : null}
          </div>
        )
      })}
    </div>
  )
}

/** A row's badge letter: its own, else the first letter of its name. */
function letterOf(row: ModelOption) {
  return row.letter ?? row.label.trim().charAt(0).toLocaleUpperCase('tr')
}

/** One meter: five small dashes, as many filled as the value (1–5). */
function Meter({ name, value }: { name: string; value: number }) {
  const filled = Math.max(0, Math.min(STEPS.length, Math.round(value)))
  return (
    <span className="lb-mm-meter" role="img" aria-label={`${name}: ${filled}/${STEPS.length}`}>
      {STEPS.map((step) => <i key={step} className={step < filled ? 'on' : undefined} />)}
    </span>
  )
}
