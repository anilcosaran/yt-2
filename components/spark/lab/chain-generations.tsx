'use client'

import * as React from 'react'
import type { CSSProperties } from 'react'
import { Play, Type, X } from 'lucide-react'

import { ProgressRing } from './chain-chrome'
import type { StageKind } from './lab-chain'
import type { SceneArt } from './lab-model'
import './chain-generations.css'

// Plan › Üretim: what a node has made so far ("üretimler"), newest first. Under the node, a quiet row of small squares
// (the picked one ringed) with "Galeri" at its end; beside the node, on request, the gallery: every output large enough
// to choose from. A press on one picks it, and the picked one is what the node shows and hands on. Both draw themselves
// and nothing else: the canvas places them and keeps what is picked. Every root carries `nodrag nowheel nopan`, so React
// Flow leaves presses and scrolls on them alone. Spark's violet marks only what is being made.

/** One output of a node: made, being made, or waiting its turn. */
export type Generation = {
  /** Which making it is, from 0 (shown as v1). */
  index: number
  status: 'done' | 'running' | 'queued'
  /** 0..1 while it is made; undefined while that is not known (the ring turns). */
  progress?: number
  /** A picture's or clip's drawing. */
  art?: SceneArt
  /** This output's own look of the drawing (the demo's variants). */
  style?: CSSProperties
  /** A sound's bars, as heights in %. */
  wave?: number[]
  /** A clip's or sound's length. */
  seconds?: number
  /** What a text output says. */
  text?: string
}

type Shared = {
  kind: StageKind
  items: Generation[]
  /** The index of the picked output. */
  active: number
  /** The node's size, as '9:16'; pictures and clips take it in the gallery. */
  ratio?: string
  onPick: (index: number) => void
}

/** Squares in the strip, counting the "+N" one that stands for the rest. */
const STRIP_MAX = 6

type Shape = 'picture' | 'sound' | 'text'

/** How a kind's outputs are shown: pictures and clips as thumbnails, sounds as waves, texts as their words. */
const shapeOf = (kind: StageKind): Shape => (kind === 'voice' || kind === 'music' ? 'sound' : kind === 'text' ? 'text' : 'picture')

/** Newest first, whatever order they come in. */
const newestFirst = (items: Generation[]) => [...items].sort((a, b) => b.index - a.index)

/** How far a running output is, as a whole percent; null while that is not known. */
function percentOf(progress?: number) {
  if (progress === undefined || !Number.isFinite(progress)) return null
  return Math.round(Math.min(1, Math.max(0, progress)) * 100)
}

/** A length as the canvas writes it: 0:05, 1:12. */
function clockOf(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** '9:16' as CSS `aspect-ratio` ('9 / 16'); anything it cannot read stands upright at 9:16. */
function aspectOf(ratio = '9:16') {
  const match = /^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/.exec(ratio)
  return match && Number(match[1]) > 0 && Number(match[2]) > 0 ? `${match[1]} / ${match[2]}` : '9 / 16'
}

/** What an output's state says in words: how far it is, that it waits, or that it is the one picked. */
function statusOf(item: Generation, picked: boolean) {
  if (item.status === 'running') {
    const percent = percentOf(item.progress)
    return percent === null ? 'Üretiliyor' : `%${percent}`
  }
  if (item.status === 'queued') return 'Sırada'
  return picked ? 'Seçili' : null
}

/** A bar's height, kept tall enough to be seen and never past the top. */
const barHeight = (value: number) => `${Math.min(100, Math.max(16, Number.isFinite(value) ? value : 50))}%`

/** A sound's bars: its own, or a steady stand-in for one not made yet (worked out, never random, so it holds still). */
function barsOf(item: Generation, count: number) {
  if (item.wave?.length) return item.wave
  return Array.from({ length: count }, (_, bar) => 28 + Math.round(((Math.sin((bar + 1) * 1.3 + item.index * 2.1) + 1) / 2) * 60))
}

/** Five bars picked evenly from a sound's wave, for the strip's tiny glyph. */
function fiveOf(item: Generation) {
  const wave = item.wave?.length ? item.wave : [42, 78, 100, 64, 36]
  return Array.from({ length: 5 }, (_, bar) => wave[Math.min(wave.length - 1, Math.floor(((bar + 0.5) * wave.length) / 5))]!)
}

/** A picture's or clip's drawing, filling the positioned, clipping box it is put in. */
function Art({ item }: { item: Generation }) {
  if (!item.art) return null
  return (
    <span className="lb-thumb">
      <span className={`lb-art ${item.art}`} style={item.style} />
    </span>
  )
}

/**
 * Under a node: its outputs as small rounded squares, newest first, the picked one ringed; one being made shows its ring
 * over a dimmed square, one waiting a dashed outline. Past six, the oldest wait behind a "+N" square (the picked one
 * always keeps a place). "Galeri" at the end opens them all. Nothing when the node has made nothing yet.
 */
export function GenerationStrip({ kind, items, active, onPick, onOpenGallery }: Shared & { onOpenGallery: () => void }): React.JSX.Element | null {
  if (!items.length) return null
  const newest = newestFirst(items)
  let shown = newest
  if (newest.length > STRIP_MAX) {
    shown = newest.slice(0, STRIP_MAX - 1)
    const picked = newest.find((item) => item.index === active)
    if (picked && !shown.includes(picked)) shown = [...shown.slice(0, -1), picked]
  }
  const rest = newest.length - shown.length
  return (
    <div className="lb-gn-strip nodrag nowheel nopan">
      <div className="lb-gn-row" role="listbox" aria-label="Üretimler" aria-orientation="horizontal">
        {shown.map((item) => (
          <Square key={item.index} kind={kind} item={item} picked={item.index === active} onPick={onPick} />
        ))}
      </div>
      {rest ? (
        <button type="button" className="lb-gn-sq lb-gn-more" onClick={onOpenGallery} title="Galeride gör" aria-label={`${rest} üretim daha · Galeride gör`}>
          +{rest}
        </button>
      ) : null}
      <button type="button" className="lb-gn-all" onClick={onOpenGallery} aria-haspopup="dialog">
        Galeri
      </button>
    </div>
  )
}

/** One output in the strip: its drawing, a tiny wave for a sound, a "T" for a text; nothing yet while it waits. */
function Square({ kind, item, picked, onPick }: { kind: StageKind; item: Generation; picked: boolean; onPick: (index: number) => void }) {
  const shape = shapeOf(kind)
  const status = statusOf(item, picked)
  const label = status ? `v${item.index + 1} · ${status}` : `v${item.index + 1}`
  const face =
    item.status === 'queued' ? null
    : item.art ? <Art item={item} />
    : shape === 'sound' ? (
      <span className="lb-gn-mini" aria-hidden>
        {fiveOf(item).map((height, bar) => <i key={bar} style={{ height: barHeight(height) }} />)}
      </span>
    )
    : shape === 'text' ? <Type size={12} strokeWidth={2} aria-hidden />
    : null
  return (
    <button
      type="button"
      role="option"
      aria-selected={picked}
      className={`lb-gn-sq k-${kind} ${item.status}${picked ? ' on' : ''}`}
      onClick={() => onPick(item.index)}
      title={label}
      aria-label={label}
    >
      {face}
      {item.status === 'running' ? (
        <span className="lb-gn-veil">
          <ProgressRing value={item.progress} size={16} stroke={2} />
        </span>
      ) : null}
    </button>
  )
}

/**
 * Beside a node: all it has made, newest first. Pictures and clips as two columns of large thumbnails at the node's
 * size, sounds as rows with their waves, texts as cards of their first lines. A press picks one and the gallery stays
 * open; Escape, the close button or a press anywhere else closes it (a press on a node's strip does not: its squares
 * and its "Galeri" go with this). It takes focus as it opens and brings the picked one into view.
 */
export function GenerationGallery({ kind, items, active, ratio, onPick, onClose }: Shared & { onClose: () => void }): React.JSX.Element {
  const box = React.useRef<HTMLDivElement>(null)
  const body = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && box.current?.contains(target)) return
      if (target instanceof Element && target.closest('.lb-gn-strip')) return
      onClose()
    }
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  // Once, as it opens: focus on the panel (the canvas never scrolls for it), and the picked one scrolled into view.
  React.useEffect(() => {
    box.current?.focus({ preventScroll: true })
    const list = body.current
    const on = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !on) return
    if (on.offsetTop + on.offsetHeight > list.clientHeight) list.scrollTop = Math.max(0, on.offsetTop - 8)
  }, [])

  const shape = shapeOf(kind)
  const newest = newestFirst(items)
  const aspect = aspectOf(ratio)
  return (
    <div ref={box} className="lb-gn-gallery nodrag nowheel nopan" role="dialog" aria-label="Üretimler" tabIndex={-1}>
      <div className="lb-gn-head">
        <b>Üretimler</b>
        <span className="lb-gn-count">{items.length}</span>
        <button type="button" className="lb-gn-close" onClick={onClose} title="Kapat" aria-label="Kapat">
          <X size={14} aria-hidden />
        </button>
      </div>
      <div ref={body} className="lb-gn-body">
        {newest.length ? (
          <div className={`lb-gn-list ${shape}`} role="listbox" aria-label="Üretimler">
            {newest.map((item) => {
              const picked = item.index === active
              const pick = () => onPick(item.index)
              if (shape === 'sound') return <SoundItem key={item.index} kind={kind} item={item} picked={picked} onPick={pick} />
              if (shape === 'text') return <TextItem key={item.index} item={item} picked={picked} onPick={pick} />
              return <PictureItem key={item.index} kind={kind} item={item} picked={picked} aspect={aspect} onPick={pick} />
            })}
          </div>
        ) : (
          <p className="lb-gn-empty">Henüz bir üretim yok.</p>
        )}
      </div>
    </div>
  )
}

type ItemProps = { item: Generation; picked: boolean; onPick: () => void }

/** The line under an output: its version (with a sound's length), then its state when it has one to say. */
function Caption({ item, picked, length = false, ring = false }: { item: Generation; picked: boolean; length?: boolean; ring?: boolean }) {
  const status = statusOf(item, picked)
  const version = `v${item.index + 1}`
  return (
    <span className="lb-gn-cap">
      <span className="lb-gn-v">{length && item.seconds ? `${version} · ${clockOf(item.seconds)}` : version}</span>
      {status ? (
        <em className={`lb-gn-state ${item.status}`}>
          {ring && item.status === 'running' ? <ProgressRing value={item.progress} size={12} stroke={1.75} /> : null}
          {status}
        </em>
      ) : null}
    </span>
  )
}

/** A picture or clip: its thumbnail at the node's size (a clip marked with a play glyph and its length), its caption under it. */
function PictureItem({ kind, item, picked, aspect, onPick }: ItemProps & { kind: StageKind; aspect: string }) {
  const clip = kind === 'video' || Boolean(item.seconds)
  return (
    <button type="button" role="option" aria-selected={picked} className={`lb-gn-item pic ${item.status}${picked ? ' on' : ''}`} onClick={onPick}>
      <span className="lb-gn-pic" style={{ aspectRatio: aspect }}>
        {item.status === 'queued' ? null : <Art item={item} />}
        {clip && item.status === 'done' ? (
          <span className="lb-gn-chip">
            <Play size={9} strokeWidth={2.5} aria-hidden />
            {item.seconds ? clockOf(item.seconds) : null}
          </span>
        ) : null}
        {item.status === 'running' ? (
          <span className="lb-gn-veil">
            <ProgressRing value={item.progress} size={26} stroke={2} />
          </span>
        ) : null}
      </span>
      <Caption item={item} picked={picked} />
    </button>
  )
}

/** A sound: its wave across the row, its version and length at the end. */
function SoundItem({ kind, item, picked, onPick }: ItemProps & { kind: StageKind }) {
  return (
    <button type="button" role="option" aria-selected={picked} className={`lb-gn-item row k-${kind} ${item.status}${picked ? ' on' : ''}`} onClick={onPick}>
      <span className="lb-gn-wave" aria-hidden>
        {barsOf(item, 32).map((height, bar) => <i key={bar} style={{ height: barHeight(height) }} />)}
      </span>
      <Caption item={item} picked={picked} length ring />
    </button>
  )
}

/** A text: its first three lines (lines drawn while it is written), its version under them. */
function TextItem({ item, picked, onPick }: ItemProps) {
  const words = item.text?.trim()
  return (
    <button type="button" role="option" aria-selected={picked} className={`lb-gn-item card ${item.status}${picked ? ' on' : ''}`} onClick={onPick}>
      {words ? (
        <span className="lb-gn-text">{words}</span>
      ) : item.status === 'done' ? (
        <span className="lb-gn-text empty">Boş</span>
      ) : (
        <span className={`lb-gn-lines${item.status === 'running' ? ' busy' : ''}`} aria-hidden><i /><i /><i /></span>
      )}
      <Caption item={item} picked={picked} ring />
    </button>
  )
}
