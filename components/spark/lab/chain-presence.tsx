'use client'

import * as React from 'react'
import { useReactFlow, useStore, type InternalNode } from '@xyflow/react'

import {
  PRESENCE_SEND_MS,
  demoPresence,
  initialsOf,
  peersOf,
  presenceTransport,
  type Peer,
  type PresencePeer,
  type PresenceRoom,
  type PresenceSpot,
  type PresenceState,
  type PresenceUser,
} from '@/lib/canvas/presence'
import { CursorMark } from './lab-parts'
import './chain-presence.css'

// Who else works on the canvas (`lib/canvas/presence.ts`): each one's pointer with their short name, in their colour, a
// ring of that colour round the node they work on, and their faces at the top right. Every colour in the room is a
// different one. This person's own pointer wears the same arrow in their colour, drawn by the browser as the cursor
// (`pointerOf`), so it never lags the hand; it is sent to the others, never drawn here.

const MAX_FACES = 4

/** The node an element is in, if any. */
const nodeOf = (target: EventTarget | null) => (target instanceof Element ? (target.closest('.react-flow__node')?.getAttribute('data-id') ?? null) : null)

/** Where a node is on the canvas and how big: as measured, else the size it was given (React Flow measures only the rest). */
function boxOf(node: InternalNode | undefined) {
  const width = node?.measured.width ?? node?.width
  const height = node?.measured.height ?? node?.height
  return node && width && height ? { ...node.internals.positionAbsolute, width, height } : null
}

/** This person's pointer as a CSS cursor: the arrow of `CursorMark`, in their colour, its point where the press lands. */
export function pointerOf(color: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity=".35"/></filter>` +
    `<path d="M3 2.5 17.4 9.4 11 11.4 8.7 18.4z" fill="${color}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" filter="url(#s)"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 2, default`
}

/**
 * Joins the canvas's room (`room`, its run's key; none, no one else) and keeps who else is there, and this person's own
 * colour. Sends this person's pointer over the canvas (`wrap`), at most once every PRESENCE_SEND_MS, and the node they
 * work on: the one they type in, else the one node they picked (`picked`).
 */
export function useCanvasPresence(room: string | null, wrap: React.RefObject<HTMLElement | null>, picked: string | null): { peers: Peer[]; color: string | null } {
  const flow = useReactFlow()
  const [seen, setSeen] = React.useState<{ self: PresenceUser; list: PresencePeer[] } | null>(null)
  const joined = React.useRef<PresenceRoom | null>(null)
  const sent = React.useRef<PresenceState>({ cursor: null, focus: null })
  const pending = React.useRef(0)
  const typing = React.useRef<string | null>(null)
  const pickedNow = React.useRef(picked)

  const send = React.useCallback((change: Partial<PresenceState>) => {
    sent.current = { ...sent.current, ...change }
    if (pending.current) return
    pending.current = window.setTimeout(() => {
      pending.current = 0
      joined.current?.update(sent.current)
    }, PRESENCE_SEND_MS)
  }, [])

  React.useEffect(() => {
    if (!room) return
    const spots = (): PresenceSpot[] =>
      flow.getNodes().flatMap((node) => {
        const box = node.type === 'step' ? boxOf(flow.getInternalNode(node.id)) : null
        return box ? [{ id: node.id, x: box.x, y: box.y, w: box.width, h: box.height }] : []
      })
    const entered = (presenceTransport() ?? demoPresence(spots)).join(room)
    joined.current = entered
    const stop = entered.subscribe((list) => setSeen({ self: entered.self, list }))
    return () => {
      stop()
      entered.leave()
      joined.current = null
      window.clearTimeout(pending.current)
      pending.current = 0
      setSeen(null)
    }
  }, [room, flow])

  React.useEffect(() => {
    const root = wrap.current
    if (!room || !root) return
    const move = (event: PointerEvent) => send({ cursor: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }) })
    const leave = () => send({ cursor: null })
    const focusIn = (event: FocusEvent) => {
      typing.current = nodeOf(event.target)
      send({ focus: typing.current ?? pickedNow.current })
    }
    const focusOut = (event: FocusEvent) => {
      typing.current = nodeOf(event.relatedTarget)
      send({ focus: typing.current ?? pickedNow.current })
    }
    root.addEventListener('pointermove', move)
    root.addEventListener('pointerleave', leave)
    root.addEventListener('focusin', focusIn)
    root.addEventListener('focusout', focusOut)
    return () => {
      root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerleave', leave)
      root.removeEventListener('focusin', focusIn)
      root.removeEventListener('focusout', focusOut)
    }
  }, [room, wrap, flow, send])

  React.useEffect(() => {
    pickedNow.current = picked
    if (room) send({ focus: typing.current ?? picked })
  }, [room, picked, send])

  return React.useMemo(() => (seen ? peersOf(seen.list, seen.self) : { peers: [], color: null }), [seen])
}

/**
 * The others' pointers and rings, inside the canvas: layers that move with the view, so a pointer stands on the same
 * spot of the canvas for everyone and keeps its size at any zoom. Between two sends a pointer glides. The rings lie
 * under the nodes (what opens from a node covers them), the pointers over everything.
 */
export function PresenceLayer({ peers }: { peers: Peer[] }) {
  const [x, y, zoom] = useStore((store) => store.transform)
  const focus = peers.map((peer) => peer.focus)
  // Each ring as "x,y,w,h" (empty when the node is not on the canvas), as one string, so the layer draws again only
  // when a ring moves, not with every change to the canvas.
  const rings = useStore((store) =>
    focus
      .map((id) => {
        const box = boxOf(id ? store.nodeLookup.get(id) : undefined)
        return box ? `${box.x},${box.y},${box.width},${box.height}` : ''
      })
      .join(';'),
  ).split(';')
  if (!peers.length) return null
  const view = { transform: `translate(${x}px, ${y}px) scale(${zoom})`, '--z': zoom } as React.CSSProperties
  return (
    <>
      <div className="lb-pr rings" style={view} aria-hidden>
        {peers.map((peer, index) => {
          const [left, top, width, height] = (rings[index] ?? '').split(',').map(Number)
          return rings[index] ? <div key={peer.id} className="lb-pr-ring" style={{ left, top, width, height, '--lb-cursor': peer.color } as React.CSSProperties} /> : null
        })}
      </div>
      <div className="lb-pr" style={view} aria-hidden>
        {peers.map((peer) =>
          peer.cursor ? (
            <div key={peer.id} className="lb-pr-at" style={{ transform: `translate(${peer.cursor.x}px, ${peer.cursor.y}px)` }}>
              <CursorMark name={peer.short} color={peer.color} />
            </div>
          ) : null,
        )}
      </div>
    </>
  )
}

/** The others' faces, each in their colour; one takes the view to the node that person works on, else to their pointer. */
export function PresenceFaces({ peers }: { peers: Peer[] }) {
  const flow = useReactFlow()
  if (!peers.length) return null
  const shown = peers.slice(0, MAX_FACES)
  const more = peers.length - shown.length
  const goTo = (peer: Peer) => {
    const box = boxOf(peer.focus ? flow.getInternalNode(peer.focus) : undefined)
    const at = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : peer.cursor
    if (at) flow.setCenter(at.x, at.y, { zoom: Math.max(flow.getZoom(), 0.8), duration: 500 })
  }
  return (
    <div className="lb-pr-faces nodrag nowheel nopan" role="group" aria-label="Tuvalde çalışanlar">
      {shown.map((peer) => (
        <button key={peer.id} type="button" style={{ '--lb-cursor': peer.color } as React.CSSProperties} onClick={() => goTo(peer)} title={peer.name} aria-label={`${peer.name}: yanına git`}>
          {initialsOf(peer.name)}
        </button>
      ))}
      {more > 0 ? <span className="more" title={peers.slice(MAX_FACES).map((peer) => peer.name).join(', ')}>+{more}</span> : null}
    </div>
  )
}
