'use client'

import * as React from 'react'
import { ChevronDown, Map as MapIcon, Minus, Plus, Scan } from 'lucide-react'

import { STAGE_KIND, type StageKind } from './lab-chain'
import { Icon } from './lab-parts'
import './chain-chrome.css'

// Plan › Üretim's floating chrome: the queue ("Kuyruk", top right) and the zoom pill (bottom left). They draw themselves
// and nothing else: the canvas places them (absolutely, inside its frame) and hands them what to show. Every root carries
// `nodrag nowheel nopan`, so a press or a scroll on them never reaches React Flow. Spark's violet marks what is being made.

/** A fraction held to 0..1; anything that is not a number reads as unknown. */
const fractionOf = (value: number | undefined) => (value === undefined || !Number.isFinite(value) ? null : Math.min(1, Math.max(0, value)))

/** A circular progress mark: a ring filling to `value` (0..1), or a spinning arc when `value` is undefined. */
export function ProgressRing({ value, size = 14, stroke = 1.75, className }: { value?: number; size?: number; stroke?: number; className?: string }) {
  const fraction = fractionOf(value)
  const center = size / 2
  const radius = Math.max(0, (size - stroke) / 2)
  const round = 2 * Math.PI * radius
  // Unknown: a quarter of the ring, turning.
  const shown = fraction ?? 0.25
  return (
    <svg
      className={`lb-cc-ring${fraction === null ? ' spin' : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <circle className="track" cx={center} cy={center} r={radius} strokeWidth={stroke} />
      {/* At 0 the arc is left out: a round cap on nothing still draws a dot. */}
      {shown > 0 ? (
        <circle
          className="arc"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={round}
          strokeDashoffset={round * (1 - shown)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      ) : null}
    </svg>
  )
}

export type QueueItem = { id: string; title: string; kind: StageKind; status: 'running' | 'queued'; progress?: number }

/** Closes a popup on a press outside `box` or on Escape (saying which, so Escape can hand focus back). */
function useDismiss(open: boolean, box: React.RefObject<HTMLElement | null>, close: (how: 'away' | 'escape') => void) {
  React.useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) close('away')
    }
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close('escape')
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open, box, close])
}

/**
 * "Kuyruk", top-right of the canvas: a pill that shows a spinning/progress ring and the count while anything is being made
 * (and a quiet "Kuyruk · 0" otherwise); a press opens a panel below it listing what is being made and what waits.
 */
export function QueuePill({
  items,
  spark,
  onFocus,
  onStop,
}: {
  items: QueueItem[]
  /** Spark's own step while it builds the plan, shown first ("Spark · <doing>"), indeterminate. */
  spark?: { doing: string } | null
  /** A press on an item: the canvas moves to that node. */
  onFocus: (id: string) => void
  /** Empties the queue (shown only when items exist). */
  onStop?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const box = React.useRef<HTMLDivElement>(null)
  const button = React.useRef<HTMLButtonElement>(null)
  const panel = React.useId()
  const close = React.useCallback((how: 'away' | 'escape') => {
    // Escape from inside the panel returns to the pill; an Escape meant for something else leaves focus where it is.
    if (how === 'escape' && box.current?.contains(document.activeElement)) button.current?.focus()
    setOpen(false)
  }, [])
  useDismiss(open, box, close)

  const count = items.length + (spark ? 1 : 0)
  // The ring fills only when one thing is being made and it says how far it is; otherwise it turns.
  const running = items.filter((item) => item.status === 'running')
  const [only] = running
  const ring = !spark && running.length === 1 ? only?.progress : undefined

  return (
    <div className="lb-cc-queue nodrag nowheel nopan" ref={box}>
      <button
        ref={button}
        type="button"
        className={`lb-cc-queue-btn${count ? ' live' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panel : undefined}
      >
        {count ? <ProgressRing value={ring} /> : null}
        <b>Kuyruk</b>
        <span className="lb-cc-n">{count}</span>
        <ChevronDown className="lb-cc-chev" aria-hidden />
      </button>
      {open ? (
        <div className="lb-cc-panel" id={panel} role="dialog" aria-label="Kuyruk">
          {spark ? (
            <div className="lb-cc-row spark">
              <span className="lb-cc-glyph spark"><Icon name="sparkles" size="sm" /></span>
              <span className="lb-cc-row-t">
                <b>Spark</b>
                <small>{spark.doing}</small>
                <span className="lb-cc-bar busy" aria-hidden><i /></span>
              </span>
            </div>
          ) : null}
          {items.map((item) => (
            <QueueRow key={item.id} item={item} onFocus={onFocus} />
          ))}
          {count ? null : <p className="lb-cc-empty">Şu an üretilen bir şey yok.</p>}
          {onStop && items.length ? (
            <button type="button" className="lb-cc-stop" onClick={onStop}>Kuyruğu durdur</button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** One thing in the queue: its kind, its name, where it is; a press takes the canvas to it. */
function QueueRow({ item, onFocus }: { item: QueueItem; onFocus: (id: string) => void }) {
  const fraction = item.status === 'running' ? fractionOf(item.progress) : null
  const percent = fraction === null ? null : Math.round(fraction * 100)
  const status = item.status === 'queued' ? 'Sırada' : percent === null ? 'Üretiliyor' : `Üretiliyor · %${percent}`
  return (
    <button type="button" className={`lb-cc-row ${item.status}`} onClick={() => onFocus(item.id)} title={item.title}>
      <span className={`lb-cc-glyph k-${item.kind}`}><Icon name={STAGE_KIND[item.kind].icon} size="sm" /></span>
      <span className="lb-cc-row-t">
        <b>{item.title}</b>
        <small>{status}</small>
        {item.status === 'running' ? (
          <span className={`lb-cc-bar${percent === null ? ' busy' : ''}`} aria-hidden>
            <i style={percent === null ? undefined : { width: `${percent}%` }} />
          </span>
        ) : null}
      </span>
    </button>
  )
}

/** Bottom-left: zoom out, the zoom (a press resets to 100%), zoom in, fit everything, and the minimap switch. */
export function ZoomPill({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
  onFit,
  mapOpen,
  onToggleMap,
}: {
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onReset: () => void
  onFit: () => void
  mapOpen: boolean
  onToggleMap: () => void
}) {
  const percent = Number.isFinite(zoom) ? Math.round(zoom * 100) : 100
  const map = mapOpen ? 'Haritayı gizle' : 'Haritayı göster'
  return (
    <div className="lb-cc-zoom nodrag nowheel nopan" role="group" aria-label="Yakınlık">
      <button type="button" onClick={onZoomOut} title="Uzaklaştır" aria-label="Uzaklaştır">
        <Minus aria-hidden />
      </button>
      <button type="button" className="lb-cc-pct" onClick={onReset} title="%100'e dön" aria-label={`${percent}% · %100'e dön`}>
        {percent}%
      </button>
      <button type="button" onClick={onZoomIn} title="Yakınlaştır" aria-label="Yakınlaştır">
        <Plus aria-hidden />
      </button>
      <i aria-hidden />
      <button type="button" onClick={onFit} title="Hepsini göster" aria-label="Hepsini göster">
        <Scan aria-hidden />
      </button>
      <button type="button" className={mapOpen ? 'on' : ''} onClick={onToggleMap} title={map} aria-label={map} aria-pressed={mapOpen}>
        <MapIcon aria-hidden />
      </button>
    </div>
  )
}
