'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../tools/studio-parts'
import { LOOK_OPTIONS, SCENES, STEPS, TOTAL_SECONDS, assetById, formatClock, sceneById, type AssetKind, type LabScene, type SceneLayer } from './lab-model'
import { Splitter, useSplitSize } from './lab-split'
import { agentDriving, currentStep, isAdded, pickOf, sayOf, shownSceneId, type LabRun } from './use-lab-run'

// The timeline of the workspace: a ruler, the scene strip, then one track per kind of thing. Pictures read as a
// slim bar led by the scene's picture; text, shapes, sound and captions are solid bars, each kind in its own colour.
// The track keeps its scale: a longer video makes a longer track, a shorter one leaves the end of it empty.
//
// Every clip is its own: taking a picture moves that picture, taking a text moves that text, and nothing on the
// other tracks comes along. Clips on one track never lie on each other. In open room a clip goes where it is
// put, up to its neighbours; carried over a neighbour by more than half of it, the neighbour steps over to the
// side the clip came from (see `makeRoom`). The pictures are the main track and it is kept closed, the way a phone
// editor's is: an end dragged makes the picture shorter or longer and the pictures after it move with it, deleting
// one closes the gap. Between two pictures there is the cut: its button opens the transitions. A picked clip
// offers its entrance animation. The playhead is dragged by its handle or along the ruler. All of this is the
// user's own layer over the agent's work, with its own undo.
//
// State classes are prefixed (`lb-picked`, `lb-held`): bare `sel` is the stage's selection box in studio.css and hides the element.

type LaneId = 'video' | 'text' | 'shape' | 'audio' | 'captions'
type ClipLane = Exclude<LaneId, 'audio'>

const LANES: { id: LaneId; label: string }[] = [
  { id: 'video', label: 'Görüntü' },
  { id: 'text', label: 'Metin' },
  { id: 'shape', label: 'Öğe' },
  { id: 'audio', label: 'Ses' },
  { id: 'captions', label: 'Altyazı' },
]
const CLIP_LANES: ClipLane[] = ['video', 'text', 'shape', 'captions']

const MEDIA_ICON: Record<AssetKind, string> = { library: 'video', stock: 'video', generate: 'wand', kit: 'palette' }
const LANE_ICON: Record<ClipLane, string> = { video: 'palette', text: 'type', shape: 'shapes', captions: 'cc' }
const MUSIC = 'audio:all'
const ZOOMS = [1, 1.5, 2, 3, 4]
const SHORTEST = 0.5
const LONGEST = 60
const DRAG_STARTS_AT = 3
/** Two ends that differ by less than this are the same end (seconds). */
const CLOSE = 1e-6

const TRANSITIONS = [['none', 'Yok'], ['fade', 'Yumuşak geçiş'], ['dip', 'Kararma'], ['slide', 'Kaydırma'], ['zoom', 'Yakınlaşma'], ['blur', 'Bulanıklaşma']] as const
const ANIMATIONS = [['none', 'Yok'], ['fade', 'Belirme'], ['slide', 'Kayarak gelme'], ['zoom', 'Yakınlaşma'], ['pop', 'Zıplama']] as const

type Span = { from: number; to: number }
/** A clip on a track. What it shows comes from its scene; where it sits is its own. (The music is not one of these.) */
type Item = Span & { id: string; lane: ClipLane; scene: string }
/** A clip as it is drawn. `floating` is a clip in the hand, drawn where the hand is rather than where it will land. */
type Clip = Span & { key: string; lane: LaneId; scene?: LabScene; label: string; icon: string; target?: string; arriving?: boolean; floating?: boolean }

/** What the user did by hand. */
type Edits = {
  /** Every clip but the music, in the order they came to be. Never re-sorted: see `laneClips`. */
  items: Item[]
  /** Names the next half a cut makes. */
  serial: number
  /** The music, once it is moved or trimmed; else it runs the length of the video. */
  music: Span | null
  noMusic: boolean
  /** The transition at a cut, by the picture before it. */
  transitions: Record<string, string>
  /** A clip's entrance animation, by clip. */
  animations: Record<string, string>
}
type EditHistory = { past: Edits[]; now: Edits; future: Edits[] }
const UNTOUCHED: Edits = {
  items: SCENES.flatMap((scene) => CLIP_LANES.map((lane) => ({ id: `${lane}:${scene.id}`, lane, scene: scene.id, from: scene.start, to: scene.end }))),
  serial: 1,
  music: null,
  noMusic: false,
  transitions: {},
  animations: {},
}

/** What is in the hand right now, before the drop makes it an edit. */
type Hand =
  /** The clips as they would be on a drop. `floating` is the one being carried, and where the hand has it. */
  | { kind: 'clips'; items: Item[]; floating?: { id: string; from: number } }
  | { kind: 'music'; from: number; to: number }
type Grab = { key: string; mode: 'move' | 'start' | 'end'; x: number; span: Span; moved: boolean }
type Menu = { kind: 'transition' | 'animation'; id: string; left: number; top: number; shell: Element }

const within = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high))
const byStart = (a: Span, b: Span) => a.from - b.from
const lengthOf = (span: Span) => span.to - span.from
const lengthsOf = (spans: Span[]) => spans.reduce((sum, span) => sum + lengthOf(span), 0)
const moved = (items: Item[], next: Map<string, Span>) => items.map((item) => (next.has(item.id) ? { ...item, ...next.get(item.id) } : item))
const pictures = (items: Item[]) => items.filter((item) => item.lane === 'video').sort(byStart)

/** The pictures closed up from the start, in the order they play; everything else as it is. */
function pack(items: Item[]) {
  const next = new Map<string, Span>()
  let at = 0
  for (const item of pictures(items)) {
    next.set(item.id, { from: at, to: at + lengthOf(item) })
    at += lengthOf(item)
  }
  return moved(items, next)
}

/**
 * A clip put down at `wish` on a track whose clips never lie on each other: where it lands, and which neighbours
 * move for it. A neighbour is passed once the clip's leading edge is over its middle. Between the neighbours it
 * has not passed and those it has, the clip lands where it is put if there is room. If there is not, the
 * neighbours move up just enough, first into the room the clip left behind, so a passed neighbour steps over to
 * the side the clip came from.
 */
function makeRoom(lane: Item[], held: Item, wish: number, limit: number) {
  const size = lengthOf(held)
  const from = within(wish, 0, limit - size)
  const others = lane.filter((item) => item.id !== held.id).sort(byStart)
  const passed = (item: Item) => (item.from >= held.from ? from + size > (item.from + item.to) / 2 : from >= (item.from + item.to) / 2)
  const before = others.filter(passed)
  const after = others.filter((item) => !passed(item))
  const left = before.length ? before[before.length - 1]!.to : 0
  const right = after.length ? after[0]!.from : Math.max(limit, left)
  const next = new Map<string, Span>()
  if (right - left >= size - CLOSE) {
    const at = within(from, left, right - size)
    return next.set(held.id, { from: at, to: at + size })
  }

  const need = size - (right - left)
  const roomBefore = left - lengthsOf(before)
  const roomAfter = Math.max(0, limit - right - lengthsOf(after))
  // The clip came from the left if a neighbour that stood after it is now before it; its old place is on that side.
  const fromBefore = before.some((item) => item.from >= held.from) ? Math.min(need, roomBefore) : within(need - roomAfter, 0, roomBefore)
  let bound = left - fromBefore
  next.set(held.id, { from: bound, to: bound + size })
  for (const item of [...before].reverse()) {
    const to = Math.min(item.to, bound)
    bound = to - lengthOf(item)
    if (to !== item.to) next.set(item.id, { from: bound, to })
  }
  let edge = right + need - fromBefore
  for (const item of after) {
    const start = Math.max(item.from, edge)
    edge = start + lengthOf(item)
    if (start !== item.from) next.set(item.id, { from: start, to: edge })
  }
  return next
}

/** Whether a layer is on the stage yet: with its own step when it has one, else with the scene's picture. */
function layerPlaced(state: LabRun['state'], scene: LabScene, layer: SceneLayer) {
  const key = `${scene.id}:${layer.key}`
  return STEPS.some((entry) => entry.adds === key) ? isAdded(state, key) : isAdded(state, `${scene.id}:media`)
}

export function LabDock({ run, compact, sizeKey }: { run: LabRun; compact?: boolean; sizeKey: string }) {
  const { state } = run
  const height = useSplitSize(sizeKey)
  const live = state.phase === 'building' || state.phase === 'done'
  const shown = sceneById(shownSceneId(state)) ?? SCENES[0]!
  const step = currentStep(state)
  const driving = agentDriving(state)
  const on = (target: string) => (driving && step?.target === target ? ' lb-agent-on' : '')
  const musicTitle = LOOK_OPTIONS.music?.find((option) => option.id === pickOf(state, 'music'))?.title

  const inner = React.useRef<HTMLDivElement>(null)
  const grab = React.useRef<Grab | null>(null)
  const [zoom, setZoom] = React.useState(1)
  const [snap, setSnap] = React.useState(true)
  const [history, setHistory] = React.useState<EditHistory>({ past: [], now: UNTOUCHED, future: [] })
  const [picked, setPicked] = React.useState<string | null>(null)
  const [hand, setHand] = React.useState<Hand | null>(null)
  const [menu, setMenu] = React.useState<Menu | null>(null)
  // The playhead sits at the start of the scene on screen until it is put somewhere by hand in that scene.
  const [placed, setPlaced] = React.useState<{ scene: string; at: number } | null>(null)
  const edits = history.now

  const change = (next: Edits) => setHistory({ past: [...history.past, history.now], now: next, future: [] })
  const undo = () => history.past.length && setHistory({ past: history.past.slice(0, -1), now: history.past[history.past.length - 1]!, future: [history.now, ...history.future] })
  const redo = () => history.future.length && setHistory({ past: [...history.past, history.now], now: history.future[0]!, future: history.future.slice(1) })

  /** What a clip shows right now. Nothing, until the agent has put it there. */
  const describe = (item: Item) => {
    const scene = sceneById(item.scene)
    if (!scene) return null
    const asset = assetById(scene.assetId)
    const label =
      item.lane === 'video' ? (isAdded(state, `${scene.id}:media`) ? (asset?.title ?? 'Marka rengi') : '')
      : item.lane === 'captions' ? (isAdded(state, 'all:captions') ? sayOf(state, scene) : '')
      : scene.layers.filter((layer) => (layer.kind === 'badge') === (item.lane === 'shape') && layerPlaced(state, scene, layer)).map((layer) => layer.text).join(' · ')
    return { scene, label, icon: item.lane === 'video' && asset ? MEDIA_ICON[asset.kind] : LANE_ICON[item.lane] }
  }
  /** Whether a clip takes room on its track: a picture always does (its place is kept open), anything else once it shows. */
  const present = (item: Item) => item.lane === 'video' || Boolean(describe(item)?.label)

  // ---- the clips as they stand, and as they are while something is in the hand
  const items = hand?.kind === 'clips' ? hand.items : edits.items
  const film = pictures(items)
  const settledFilm = pictures(edits.items)
  const total = film.length ? film[film.length - 1]!.to : 0
  const music: Span = hand?.kind === 'music' ? hand : (edits.music ?? { from: 0, to: total })
  // The seconds the track is wide: the plan's length, or as far as the clips now reach.
  const room = Math.max(total, TOTAL_SECONDS, ...items.filter(present).map((item) => item.to))
  const settledRoom = Math.max(TOTAL_SECONDS, ...edits.items.filter(present).map((item) => item.to))

  const startOf = (sceneId: string) => film.find((item) => item.scene === sceneId)?.from ?? 0
  const time = live ? within(placed?.scene === shown.id ? placed.at : startOf(shown.id), 0, total) : 0

  const onGrid = (seconds: number) => (snap ? Math.round(seconds * 2) / 2 : Math.round(seconds * 10) / 10)
  const secondsAt = (clientX: number) => {
    const box = inner.current?.getBoundingClientRect()
    return box ? within(((clientX - box.left) / box.width) * room, 0, total) : 0
  }

  // ---- the playhead: dragged by its handle, or along the ruler
  const seek = (clientX: number) => {
    const at = Math.min(onGrid(secondsAt(clientX)), total - 0.1)
    const sceneId = film.find((item) => at >= item.from && at < item.to)?.scene ?? shown.id
    if (sceneId !== shown.id) run.view(sceneId)
    setPlaced({ scene: sceneId, at })
  }
  const scrub = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      seek(event.clientX)
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event.clientX)
    },
  }

  // ---- the clips of a lane
  const laneClips = (lane: LaneId): Clip[] => {
    if (lane === 'audio') {
      const label = isAdded(state, 'all:audio') && !edits.noMusic ? (musicTitle ? `Müzik · ${musicTitle}` : 'Müzik') : ''
      return [{ key: MUSIC, lane, ...music, label, icon: 'music' }]
    }
    // Drawn in the order the clips came to be, not the order they play in: a clip that changed its place among its
    // siblings while it is in the hand would lose the pointer.
    return items.flatMap((item): Clip[] => {
      const about = item.lane === lane ? describe(item) : null
      if (!about) return []
      const carriedAt = hand?.kind === 'clips' && hand.floating?.id === item.id ? hand.floating.from : null
      const span = carriedAt === null ? { from: item.from, to: item.to } : { from: carriedAt, to: carriedAt + lengthOf(item) }
      const arriving = (lane === 'text' || lane === 'shape') && driving && about.scene.layers.some((layer) => (layer.kind === 'badge') === (lane === 'shape') && step?.adds === `${about.scene.id}:${layer.key}`)
      // The agent points at a scene's picture by the scene, so the picture it made (not a half cut from it) answers.
      const target = item.id === `video:${about.scene.id}` ? { target: `clip-${about.scene.id}` } : null
      return [{ key: item.id, lane, ...span, ...about, ...target, arriving, floating: carriedAt !== null }]
    })
  }
  const lanes = LANES.map((lane) => ({ ...lane, clips: laneClips(lane.id) }))
  const carried = hand?.kind === 'clips' ? hand.floating?.id : undefined
  const landing = carried ? items.find((item) => item.id === carried) : undefined

  // ---- the tools
  const pickedItem = edits.items.find((item) => item.id === picked) ?? null
  const cutsThrough = (item: Item) => time > item.from && time < item.to
  // The cut goes through the picked clip when the playhead is on it, else through the picture under the playhead.
  const under = (pickedItem && cutsThrough(pickedItem) ? pickedItem : null) ?? settledFilm.find(cutsThrough) ?? null
  const split = () => {
    if (!under) return
    const half = { ...under, id: `${under.lane}:${under.scene}~${edits.serial}`, from: time }
    change({ ...edits, serial: edits.serial + 1, items: [...edits.items.map((item) => (item.id === under.id ? { ...item, to: time } : item)), half] })
  }
  const pickedPicture = pickedItem?.lane === 'video' ? pickedItem.id : null
  const canRemove = picked !== null && (pickedPicture === null || settledFilm.length > 1)
  const remove = () => {
    if (!picked || !canRemove) return
    // A picture leaves the main track and the ones after it close the gap; anything else just goes.
    change(picked === MUSIC ? { ...edits, noMusic: true } : { ...edits, items: pack(edits.items.filter((item) => item.id !== picked)) })
    setPicked(null)
  }

  // ---- a clip in the hand
  const hold = (clip: Clip, mode: Grab['mode']) => ({
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      grab.current = { key: clip.key, mode, x: event.clientX, span: { from: clip.from, to: clip.to }, moved: false }
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const held = grab.current
      const box = inner.current?.getBoundingClientRect()
      if (!held || held.key !== clip.key || !box || !event.currentTarget.hasPointerCapture(event.pointerId)) return
      const travel = event.clientX - held.x
      if (!held.moved && Math.abs(travel) < DRAG_STARTS_AT) return
      held.moved = true
      const by = (travel / box.width) * room
      const size = lengthOf(held.span)

      if (clip.lane === 'audio') {
        if (held.mode === 'move') {
          const from = within(onGrid(held.span.from + by), 0, settledRoom - size)
          setHand({ kind: 'music', from, to: from + size })
        } else if (held.mode === 'start') {
          setHand({ kind: 'music', from: within(onGrid(held.span.from + by), 0, held.span.to - SHORTEST), to: held.span.to })
        } else {
          setHand({ kind: 'music', from: held.span.from, to: within(onGrid(held.span.to + by), held.span.from + SHORTEST, settledRoom) })
        }
        return
      }

      const item = edits.items.find((entry) => entry.id === held.key)
      if (!item) return
      const lane = edits.items.filter((entry) => entry.lane === item.lane && present(entry))
      if (held.mode === 'move') {
        // The pictures stay closed up, so one is carried within their length; anything else, as far as the track goes.
        const limit = item.lane === 'video' ? lengthsOf(lane) : settledRoom
        const wish = item.from + by
        setHand({ kind: 'clips', items: moved(edits.items, makeRoom(lane, item, item.lane === 'video' ? wish : onGrid(wish), limit)), floating: { id: item.id, from: within(wish, 0, limit - size) } })
      } else if (item.lane === 'video') {
        // Either end makes the picture shorter or longer; the pictures after it move with it.
        const length = within(onGrid(size + (held.mode === 'end' ? by : -by)), SHORTEST, LONGEST)
        setHand({ kind: 'clips', items: pack(edits.items.map((entry) => (entry.id === item.id ? { ...entry, to: entry.from + length } : entry))) })
      } else {
        // An end goes as far as the neighbour on that side.
        const others = lane.filter((entry) => entry.id !== item.id)
        const floor = Math.max(0, ...others.filter((entry) => entry.to <= item.from + CLOSE).map((entry) => entry.to))
        const ceiling = Math.min(settledRoom, ...others.filter((entry) => entry.from >= item.to - CLOSE).map((entry) => entry.from))
        const span = held.mode === 'start' ? { from: within(onGrid(item.from + by), floor, item.to - SHORTEST), to: item.to } : { from: item.from, to: within(onGrid(item.to + by), item.from + SHORTEST, ceiling) }
        setHand({ kind: 'clips', items: moved(edits.items, new Map([[item.id, span]])) })
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      const held = grab.current
      grab.current = null
      event.stopPropagation()
      if (!held || held.key !== clip.key) return
      if (!held.moved) {
        if (held.mode === 'move') setPicked(picked === clip.key ? null : clip.key)
      } else if (hand?.kind === 'clips') {
        // Put back where it was is not an edit.
        if (hand.items.some((item, index) => item.from !== edits.items[index]?.from || item.to !== edits.items[index]?.to)) change({ ...edits, items: hand.items })
      } else if (hand?.kind === 'music') {
        change({ ...edits, music: { from: hand.from, to: hand.to } })
      }
      setHand(null)
    },
    onPointerCancel: () => {
      grab.current = null
      setHand(null)
    },
    // The pointer got away without a release (after a release there is nothing left in the hand, so this does nothing).
    onLostPointerCapture: () => {
      if (grab.current?.key !== clip.key) return
      grab.current = null
      setHand(null)
    },
  })

  /** Opens the transitions of a cut, or the animations of a clip, above the thing that was clicked. */
  const open = (kind: Menu['kind'], id: string) => (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    const shell = event.currentTarget.closest('.st-shell')
    if (!shell) return
    // The shell is a size container, so a fixed box is placed from its corner, not the window's.
    const box = event.currentTarget.getBoundingClientRect()
    const frame = shell.getBoundingClientRect()
    setMenu({ kind, id, left: within(box.left + box.width / 2 - frame.left, 100, frame.width - 100), top: box.top - frame.top - 8, shell })
  }
  const choose = (value: string) => {
    if (!menu) return
    const book = menu.kind === 'transition' ? 'transitions' : 'animations'
    change({ ...edits, [book]: { ...edits[book], [menu.id]: value } })
    setMenu(null)
  }

  const place = (span: Span) => ({ left: `calc(${(span.from / room) * 100}% + 1px)`, width: `calc(${(lengthOf(span) / room) * 100}% - 2px)` })
  const every = zoom >= 3 ? 1 : zoom >= 1.5 ? 2 : 5
  const ticks = Array.from({ length: Math.floor(room / every) + 1 }, (_, index) => index * every)
  const zoomAt = ZOOMS.indexOf(zoom)
  const options = menu?.kind === 'transition' ? TRANSITIONS : ANIMATIONS
  const current = menu ? ((menu.kind === 'transition' ? edits.transitions : edits.animations)[menu.id] ?? 'none') : 'none'
  // While an end is dragged the clips follow the hand at once; carried, the ones that make room slide to it.
  const trimming = hand?.kind === 'clips' && !hand.floating

  return (
    <div className={`dock lb-dock${compact ? ' compact' : ''}${height ? ' sized' : ''}`} style={height ? { height } : undefined}>
      <Splitter id={sizeKey} axis="y" edge="start" min={112} max={() => Math.round(window.innerHeight * 0.56)} label="Zaman çizelgesinin yüksekliği" />
      {/* Play leads the row, as in any editor; the editing tools follow it, the view of the timeline is at the far end. */}
      <div className="transport lb-transport">
        <div className="lb-play">
          <button type="button" className="play" aria-label="Oynat"><Icon name="play" /></button>
          <span className="time">{formatClock(Math.floor(time))}<span className="tt"> / {formatClock(live ? Math.round(total) : 0)}</span></span>
        </div>
        {compact ? null : (
          <div className="lb-tools">
            <span className="vsep" />
            <button type="button" className="ib sm" onClick={undo} disabled={!history.past.length} title="Geri al" aria-label="Geri al"><Icon name="undo" /></button>
            <button type="button" className="ib sm" onClick={redo} disabled={!history.future.length} title="Yinele" aria-label="Yinele"><Icon name="redo" /></button>
            <span className="vsep" />
            <button type="button" className="ib sm" onClick={split} disabled={!under} title="Oynatma çizgisinden böl" aria-label="Böl"><Icon name="split" /></button>
            <button type="button" className="ib sm" onClick={remove} disabled={!canRemove} title="Seçili parçayı sil" aria-label="Sil"><Icon name="trash" /></button>
          </div>
        )}
        <span className="grow" />
        <div className="lb-tools end">
          {compact ? null : (
            <button type="button" className={`ib sm${snap ? ' on' : ''}`} onClick={() => setSnap(!snap)} aria-pressed={snap} title="Yapışma: yarım saniyeye oturur" aria-label="Yapışma"><Icon name="magnet" /></button>
          )}
          <button type="button" className="ib sm" onClick={() => setZoom(ZOOMS[zoomAt - 1]!)} disabled={zoomAt <= 0} title="Uzaklaş" aria-label="Uzaklaş"><Icon name="minus" /></button>
          <button type="button" className="lb-zoom" onClick={() => setZoom(1)} title="Tümünü sığdır">{Math.round(zoom * 100)}%</button>
          <button type="button" className="ib sm" onClick={() => setZoom(ZOOMS[zoomAt + 1]!)} disabled={zoomAt >= ZOOMS.length - 1} title="Yakınlaş" aria-label="Yakınlaş"><Icon name="plus" /></button>
        </div>
      </div>

      {live ? (
        <div className="lb-tlw">
          <div className="lb-tl-labels" aria-hidden>
            <span />
            <span>Sahneler</span>
            {LANES.map((lane) => <span key={lane.id}>{lane.label}</span>)}
          </div>
          <div className="lb-tl-scroll">
            <div className={`lb-tl-inner${trimming ? ' lb-trimming' : ''}`} ref={inner} style={{ width: `${(zoom * 100 * room) / TOTAL_SECONDS}%` }}>
              <div className="lb-ruler" {...scrub} title="Oynatma çizgisini sürükle">
                {ticks.map((tick) => <span key={tick} style={{ left: `${(tick / room) * 100}%` }}>{tick}s</span>)}
              </div>
              {/* The scenes, by the pictures as they now play. */}
              <div className="lb-trk strip">
                {film.map((item) => {
                  const scene = sceneById(item.scene)!
                  return (
                    <button key={item.id} type="button" className={`seg-b${shown.id === scene.id ? ' on' : ''}`} style={{ flexGrow: lengthOf(item) }} onClick={() => run.view(scene.id)}>
                      <span className="n">{scene.n}</span>
                      <span className="nm">{scene.role}</span>
                      <span className="d">{Math.round(lengthOf(item) * 10) / 10}s</span>
                    </button>
                  )
                })}
                {room > total ? <span style={{ flexGrow: room - total }} /> : null}
              </div>
              {lanes.map((lane) => {
                const whole = lane.id === 'audio' || lane.id === 'captions'
                return (
                  <div key={lane.id} className={`lb-trk ln-${lane.id}${whole ? on(`lane-${lane.id}`) : ''}`} {...(whole && { 'data-agent-target': `lane-${lane.id}` })}>
                    {lane.clips.map((clip) => {
                      // A picture that is not there yet keeps its place open; nothing else leaves a mark before it exists.
                      if (!clip.label) {
                        return lane.id === 'video' ? <span key={clip.key} className="lb-tl lb-slot" style={place(clip)} {...(clip.target && { 'data-agent-target': clip.target })} /> : null
                      }
                      const chosen = picked === clip.key
                      const held = clip.floating || (hand?.kind === 'music' && lane.id === 'audio')
                      const animated = edits.animations[clip.key] && edits.animations[clip.key] !== 'none'
                      const agent = clip.target ? on(clip.target) : clip.arriving ? ' lb-agent-on' : ''
                      return (
                        <button
                          key={clip.key}
                          type="button"
                          className={`lb-tl on${lane.id === 'video' ? ' lb-film' : ''}${lane.id === 'audio' ? ' lb-wave' : ''}${chosen ? ' lb-picked' : ''}${held ? ' lb-held' : ''}${agent}`}
                          style={place(clip)}
                          title={`${clip.label} · ${formatClock(Math.floor(clip.from))}–${formatClock(Math.ceil(clip.to))}`}
                          aria-pressed={chosen}
                          {...hold(clip, 'move')}
                          {...(clip.target && { 'data-agent-target': clip.target })}
                        >
                          {lane.id === 'video' && clip.scene ? <b className="lb-film-pic" aria-hidden><i className={`lb-art ${clip.scene.art}`} /></b> : null}
                          <span className="lb-tl-tag"><Icon name={clip.icon} />{clip.label}</span>
                          {chosen || animated ? (
                            <i
                              className={`lb-tl-fx${animated ? ' set' : ''}`}
                              role="button"
                              tabIndex={0}
                              title={animated ? `Giriş animasyonu: ${ANIMATIONS.find(([value]) => value === edits.animations[clip.key])?.[1]}` : 'Giriş animasyonu ekle'}
                              aria-label="Giriş animasyonu"
                              onPointerDown={(event) => event.stopPropagation()}
                              onPointerUp={(event) => event.stopPropagation()}
                              onClick={open('animation', clip.key)}
                            >
                              <Icon name="animate" />
                            </i>
                          ) : null}
                          <i className="lb-tl-h l" {...hold(clip, 'start')} />
                          <i className="lb-tl-h r" {...hold(clip, 'end')} />
                        </button>
                      )
                    })}
                    {/* Where the clip in the hand will land: the room its neighbours have made for it. */}
                    {landing?.lane === lane.id ? <i className="lb-drop" style={place(landing)} /> : null}
                    {/* The cuts of the main track: where one picture ends and the next begins, a transition can go. */}
                    {lane.id === 'video' && !hand
                      ? film.slice(0, -1).map((item, index) => {
                          // Beside a picked picture its ends are for trimming, so the cut stays out of the way.
                          if (pickedPicture && (item.id === pickedPicture || film[index + 1]?.id === pickedPicture)) return null
                          const set = edits.transitions[item.id] && edits.transitions[item.id] !== 'none'
                          return (
                            <button
                              key={`cut:${item.id}`}
                              type="button"
                              className={`lb-cut${set ? ' on' : ''}`}
                              style={{ left: `${(item.to / room) * 100}%` }}
                              title={set ? `Geçiş: ${TRANSITIONS.find(([value]) => value === edits.transitions[item.id])?.[1]}` : 'Geçiş ekle'}
                              aria-label="Geçiş"
                              onClick={open('transition', item.id)}
                            >
                              <Icon name="transition" />
                            </button>
                          )
                        })
                      : null}
                  </div>
                )
              })}
              <i className="lb-ph" style={{ left: `${(time / room) * 100}%` }} {...scrub} title="Sürükle"><b>{formatClock(Math.floor(time))}</b></i>
            </div>
          </div>
        </div>
      ) : (
        <p className="lb-dock-empty">Zaman çizelgesi boş. Plan onaylanınca Spark burayı sahne sahne doldurur; istediğin an devralabilirsin.</p>
      )}

      {menu
        ? createPortal(
            <>
              <div className="lb-menu-veil" onPointerDown={() => setMenu(null)} />
              <div className="lb-menu" role="menu" style={{ left: menu.left, top: menu.top }} onKeyDown={(event) => event.key === 'Escape' && setMenu(null)}>
                <b>{menu.kind === 'transition' ? 'Geçiş' : 'Giriş animasyonu'}</b>
                {options.map(([value, label], index) => (
                  <button key={value} type="button" role="menuitemradio" aria-checked={value === current} autoFocus={index === 0} onClick={() => choose(value)}>
                    {label}
                    {value === current ? <Icon name="check" size="sm" /> : null}
                  </button>
                ))}
              </div>
            </>,
            menu.shell,
          )
        : null}
    </div>
  )
}
