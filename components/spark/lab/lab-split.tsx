'use client'

import * as React from 'react'

// Pane sizes set by dragging a pane's edge. The handle is the editor's own (`.rz` in studio.css): nothing to see
// until the pointer is on the edge, then the resize cursor and a line. A size is kept per browser; `null` is the
// layout's own size (a double click on the edge goes back to it).

const listeners = new Set<() => void>()
const sizes = new Map<string, number | null>()
const storageKey = (id: string) => `yt2_spark_split_${id}`

function read(id: string): number | null {
  if (!sizes.has(id)) {
    let stored: number | null = null
    try {
      const raw = window.localStorage.getItem(storageKey(id))
      const value = raw === null ? Number.NaN : Number(raw)
      stored = Number.isFinite(value) && value > 0 ? value : null
    } catch {
      // Without storage the layout simply starts from its own sizes.
    }
    sizes.set(id, stored)
  }
  return sizes.get(id) ?? null
}

function write(id: string, size: number | null, keep: boolean) {
  sizes.set(id, size)
  if (keep) {
    try {
      if (size === null) window.localStorage.removeItem(storageKey(id))
      else window.localStorage.setItem(storageKey(id), String(size))
    } catch {
      // The size still holds for this visit.
    }
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The size the user set for a pane, in px, or `null` for the layout's own. */
export function useSplitSize(id: string) {
  return React.useSyncExternalStore(
    subscribe,
    () => read(id),
    () => null,
  )
}

const KEY_STEP = 16

/**
 * The edge of a pane, to drag. It sits on the `edge` of its parent, which is the pane it sizes: `start` is the
 * left edge (or the top, for `axis="y"`), `end` the right edge. `max` may depend on the room there is.
 */
export function Splitter({
  id,
  axis,
  edge,
  min,
  max,
  label,
}: {
  id: string
  axis: 'x' | 'y'
  edge: 'start' | 'end'
  min: number
  max: number | ((pane: HTMLElement) => number)
  label: string
}) {
  const [dragging, setDragging] = React.useState(false)
  const drag = React.useRef<{ from: number; size: number; top: number } | null>(null)
  // Dragging away from the pane's body makes it larger.
  const outward = edge === 'start' ? -1 : 1
  const sizeOf = (pane: HTMLElement) => (axis === 'x' ? pane.getBoundingClientRect().width : pane.getBoundingClientRect().height)
  const topOf = (pane: HTMLElement) => Math.max(typeof max === 'function' ? max(pane) : max, min)
  const within = (size: number, top: number) => Math.round(Math.min(Math.max(size, min), top))

  const stop = (handle: HTMLElement) => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    handle.closest('.app')?.classList.remove('resizing')
    write(id, read(id), true)
  }

  return (
    <div
      className={`rz ${axis === 'x' ? 'rz-x' : 'rz-y'}${axis === 'x' && edge === 'end' ? ' rz-l' : ''}${dragging ? ' on' : ''}`}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      title={`${label}: sürükle · çift tıkla, eski haline dönsün`}
      tabIndex={0}
      onPointerDown={(event) => {
        const pane = event.currentTarget.parentElement
        if (event.button !== 0 || !pane) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { from: axis === 'x' ? event.clientX : event.clientY, size: sizeOf(pane), top: topOf(pane) }
        setDragging(true)
        // The editor's own switch: no layout transition and no text selection while a pane is being sized.
        event.currentTarget.closest('.app')?.classList.add('resizing')
      }}
      onPointerMove={(event) => {
        const start = drag.current
        if (!start) return
        const moved = (axis === 'x' ? event.clientX : event.clientY) - start.from
        write(id, within(start.size + moved * outward, start.top), false)
      }}
      onPointerUp={(event) => stop(event.currentTarget)}
      onPointerCancel={(event) => stop(event.currentTarget)}
      onDoubleClick={() => write(id, null, true)}
      onKeyDown={(event) => {
        const pane = event.currentTarget.parentElement
        if (!pane) return
        if (event.key === 'Home') return write(id, null, true)
        const grow = axis === 'x' ? (edge === 'start' ? 'ArrowLeft' : 'ArrowRight') : 'ArrowUp'
        const shrink = axis === 'x' ? (edge === 'start' ? 'ArrowRight' : 'ArrowLeft') : 'ArrowDown'
        if (event.key !== grow && event.key !== shrink) return
        event.preventDefault()
        write(id, within(sizeOf(pane) + (event.key === grow ? KEY_STEP : -KEY_STEP), topOf(pane)), true)
      }}
    />
  )
}
