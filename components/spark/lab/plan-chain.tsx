'use client'

import * as React from 'react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Handle,
  MiniMap,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnConnectEnd,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { Copy, Frame as FrameIcon, Hand, History as HistoryIcon, MousePointer2, Plus, SlidersHorizontal, Sparkles, StickyNote, Trash2, Type } from 'lucide-react'

import { PromptBox, PromptBoxChip, PromptBoxInput, PromptBoxNote, PromptBoxSend, PromptBoxSpacer } from '../agent/prompt-box'
import { FRAME_HANDLE, FrameNodeView, LabelNodeView, NoteNodeView, type FrameColor, type FrameNode, type LabelNode, type NoteNode } from './chain-annotations'
import { ProgressRing, QueuePill, ZoomPill, type QueueItem } from './chain-chrome'
import { MODEL_METERS, ModelMenu, type ModelOption } from './chain-model-menu'
import { NODE_SETTINGS, SettingsPanel, settingKey, settingOf } from './chain-settings'
import { CUT_FRAMES, STAGE_KIND, STAGE_KINDS, chainLanes, creditsOf, stageStatuses, voiceName, type ChainLane, type ChainStage, type StageKind, type StageStatus } from './lab-chain'
import { LOOK_OPTIONS, MODELS, formatClock, type LabScene, type SceneArt } from './lab-model'
import { Icon } from './lab-parts'
import { MediaThumb, useStorageMediaPicker } from './lab-source'
import { agentDriving, currentStep, pickOf, type CanvasOwnNode, type LabRun, type LabRunState } from './use-lab-run'
import './lab-chain.css'

// Plan view, "Üretim": the plan as a canvas to work on. Spark lays the plan out as nodes, each scene in a frame of its
// own (its picture chain, then its line and voice), and makes them when the plan is approved. The user moves anything
// by grabbing it anywhere, links one node's output to another, adds nodes (a node's "+", the tools, a double click),
// notes and frames, and makes any node on its own from its composer: what to do, the model and the size at hand, the
// rest behind its settings button. A node made shows what it made in place; its other versions wait behind a history
// button on it, and the one picked is what it shows and hands on (a new making shows the newest). Making waits in the queue ("Kuyruk", top right); nothing runs everything at once here. The engine is
// React Flow; the look is the lab's own, so it never reads as Flow, the automation product.

/** A node's box by kind, in canvas px. */
const SIZE: Record<StageKind | 'cut', { w: number; h: number }> = {
  image: { w: 280, h: 350 },
  video: { w: 280, h: 350 },
  frame: { w: 280, h: 350 },
  media: { w: 280, h: 310 },
  text: { w: 280, h: 250 },
  voice: { w: 280, h: 230 },
  music: { w: 280, h: 230 },
  cut: { w: 380, h: 270 },
}
const NOTE_W = 240
/** Inside a scene's frame: room around its nodes and for their names above them. */
const PAD = { x: 32, top: 60, bottom: 32 }
/** A column (a node and the gap after it), the extra gap before a scene's words, the gap between frames. */
const COL = 340
const WORDS_GAP = 40
const FRAME_GAP = 80
/** The first look: the start of the plan, past the tools, at a size the nodes can be read at; the rest is a pan away. */
const FIRST_VIEW = { x: 84, y: 64, zoom: 0.85 }
/** How long making a node from the canvas takes (demo). */
const MAKE_MS: Record<StageKind, number> = { text: 1100, image: 1800, frame: 700, video: 2800, voice: 1300, music: 1300, media: 500 }
/** What a text node the user added writes, by how many times it was made (demo). */
const TEXT_SAMPLES = ['Sonbaharın en sıcak tabağı: balkabaklı risotto.', 'Bu tabak yalnızca ekimde.', 'Şefin sonbahar sırrı fırından çıkıyor.']

type NodeStatus = StageStatus | 'new'
const NODE_STATUS: Record<NodeStatus, string> = { writing: 'Yazılıyor', draft: '', queued: 'Sırada', running: 'Üretiliyor', done: '', yours: 'Sende', new: '' }

type StepData = {
  stage: ChainStage
  status: NodeStatus
  /** Whether it has something to show: its own media, what the plan wrote, or what was made. */
  shows: boolean
  /** How many outputs it has (each making adds as many as its count), and the one picked to go on. */
  variants: number
  active: number
  /** 0–1 while the queue makes it; undefined while Spark makes it (no measure). */
  progress?: number
  own: boolean
  /** What it shows: its own picture, else the one handed to it. */
  art?: SceneArt
  /** The text handed to it (a voice says it), and the kind of the first node that hands it something. */
  said?: string
  input?: StageKind
  /** Spark's cursor target while Spark makes this node. */
  agent?: string
}
type StepNode = Node<StepData, 'step'>
type CanvasNode = StepNode | FrameNode | NoteNode | LabelNode
type ChainEdge = Edge<{ passing: boolean }, 'chain'>

const sizeOf = (stage: ChainStage) => (stage.id === 'all/cut' ? SIZE.cut : SIZE[stage.kind])
const ANNOTATIONS = new Set(['frame', 'note', 'label'])
const LABEL_W = 320

/** What a model makes rather than what is already there (the user's media, the Brand Kit, a clip's own voice, the plan's text). */
function generated(stage: ChainStage) {
  if (stage.kind === 'media' || stage.kind === 'text') return false
  return !['Brand Kit', 'Klibin kendi sesi'].includes(stage.how)
}

/** The words a text node had at a version: what it started as, then what Spark wrote each time it was made (demo). */
function textVersion(stage: ChainStage, own: boolean, index: number) {
  if (!own && index === 0) return stage.text?.first ?? ''
  return TEXT_SAMPLES[(index - (own ? 0 : 1)) % TEXT_SAMPLES.length]!
}

/** A node the user added, as a step of the chain. */
function ownStage(state: LabRunState, node: CanvasOwnNode): ChainStage {
  const kind = (node.kind in STAGE_KIND ? node.kind : 'image') as StageKind
  return {
    id: node.id,
    kind,
    title: STAGE_KIND[kind].name,
    how: kind === 'text' ? 'Spark yazar' : kind === 'voice' ? voiceName(state) : '',
    brief: '',
    briefKey: `brief:${node.id}`,
    credits: kind === 'voice' ? 2 : 0,
    seconds: kind === 'video' ? 5 : undefined,
    // A text node takes what the user types into it as it is; making it puts Spark's words there.
    text: kind === 'text' ? { value: state.edits[`text:${node.id}`] ?? '', key: `text:${node.id}`, first: '' } : undefined,
  }
}

/** A scene's frame and its nodes, where Spark puts them: a frame per scene, one under the other. */
function seedLayout(lanes: ChainLane[]) {
  const frames = new Map<string, { x: number; y: number; w: number; h: number }>()
  const nodes = new Map<string, { x: number; y: number }>()
  let top = 0
  for (const lane of lanes) {
    let right = 0
    let tall = 0
    lane.stages.forEach((stage, index) => {
      const x = PAD.x + index * COL + (index >= lane.pictures ? WORDS_GAP : 0)
      nodes.set(stage.id, { x, y: top + PAD.top })
      right = x + sizeOf(stage).w
      tall = Math.max(tall, sizeOf(stage).h)
    })
    const h = PAD.top + tall + PAD.bottom
    frames.set(lane.id, { x: 0, y: top, w: right + PAD.x, h })
    top += h + FRAME_GAP
  }
  return { frames, nodes }
}

/** The model (or voice, or music) a node makes with, where it has a choice, and where the choice is kept. */
function choiceOf(state: LabRunState, stage: ChainStage, own: boolean) {
  const lane = own ? null : stage.id.split('/')[0]!
  // A picture or clip a model makes: one the user added, or one the plan has a model make (not stock, the Brand Kit or
  // a trim of the user's own clip).
  const modelled = own || stage.id === `${lane}/video` || MODELS.some((model) => stage.how.startsWith(model.title))
  if ((stage.kind === 'image' || stage.kind === 'video') && modelled) {
    // A scene's clip shares its model with the scene's source tag in Senaryo.
    const key = stage.kind === 'video' && lane && stage.id === `${lane}/video` ? lane : stage.id
    const models = MODELS.filter((model) => model.kind === stage.kind)
    const fallback = stage.kind === 'image' ? 'flux-2-pro' : 'kling-2-5'
    const value = state.picks[`model:${key}`] ?? fallback
    const model = models.find((entry) => entry.id === (value === 'auto' ? fallback : value)) ?? models[0]!
    const options: ModelOption[] = models.map((entry) => ({ id: entry.id, label: entry.title, sub: entry.meta.replace(/\s·\s~\d+\skredi$/, ''), meters: MODEL_METERS[entry.id] }))
    return { pick: `model:${key}`, value, label: value === 'auto' ? 'Otomatik' : model.title, credits: creditsOf(model.meta), options, auto: true }
  }
  if (stage.kind === 'voice' && generated(stage)) {
    const value = pickOf(state, 'voice') ?? 'ece'
    const options = (LOOK_OPTIONS.voice ?? []).map((entry) => ({ id: entry.id, label: entry.title, sub: [entry.sub, ...(entry.tags ?? [])].filter(Boolean).join(' · ') }))
    return { pick: 'voice', value, label: voiceName(state), credits: stage.credits, options, auto: false }
  }
  if (stage.kind === 'music') {
    const value = pickOf(state, 'music') ?? 'acoustic'
    const options = (LOOK_OPTIONS.music ?? []).filter((entry) => entry.id !== 'none').map((entry) => ({ id: entry.id, label: entry.title, sub: entry.sub ?? '' }))
    return { pick: 'music', value, label: options.find((entry) => entry.id === value)?.label ?? 'Müzik', credits: 0, options, auto: false }
  }
  return null
}

/** A node's settings as they stand, by row id. */
function settingsOf(state: LabRunState, stage: ChainStage) {
  const rows = NODE_SETTINGS[stage.kind] ?? []
  return { rows, values: Object.fromEntries(rows.map((row) => [row.id, row.id === 'aspect' && !(settingKey(stage.id, row.id) in state.picks) ? state.ratio : settingOf(state.picks, stage.id, row)])) }
}

/** What making a node costs: its model's price, by how many it makes, their quality and length. */
function costOf(state: LabRunState, stage: ChainStage, own: boolean) {
  const base = choiceOf(state, stage, own)?.credits ?? stage.credits
  const { values } = settingsOf(state, stage)
  const count = Number(values.count ?? 1)
  const quality = values.quality === 'Yüksek' ? 2 : values.quality === 'Taslak' ? 0.5 : 1
  const length = values.secs ? Number.parseInt(values.secs, 10) / 5 : 1
  return Math.round(base * count * quality * length)
}

/** The canvas as React Flow nodes and edges: Spark's plan, under what the user did on it. */
function graphOf(run: LabRun, lanes: ChainLane[], statuses: Map<string, StageStatus>, now: number) {
  const { state } = run
  const { canvas } = state
  const removed = new Set(canvas.removed)
  const seed = seedLayout(lanes)

  const annotations: (FrameNode | NoteNode | LabelNode)[] = []
  const frame = (id: string, at: { x: number; y: number }, size: { w: number; h: number }, title: string): FrameNode => ({
    id,
    type: 'frame',
    position: canvas.moved[id] ?? at,
    width: canvas.sizes[id]?.w ?? size.w,
    height: canvas.sizes[id]?.h ?? size.h,
    zIndex: -2000,
    dragHandle: `.${FRAME_HANDLE}`,
    connectable: false,
    data: {
      title: state.edits[`title:${id}`] ?? title,
      color: (state.picks[`color:${id}`] ?? 'none') as FrameColor,
      onTitle: (text) => run.edit(`title:${id}`, text),
      onColor: (color) => run.pick(`color:${id}`, color),
      onRemove: () => run.canvas.remove([id]),
    },
  })
  for (const lane of lanes) {
    const id = `frame:${lane.id}`
    const box = seed.frames.get(lane.id)!
    if (!removed.has(id)) annotations.push(frame(id, box, box, lane.role))
  }
  for (const own of canvas.added) {
    if (own.kind === 'frame') annotations.push(frame(own.id, own, { w: 560, h: 380 }, 'Çerçeve'))
    if (own.kind === 'label') {
      annotations.push({
        id: own.id,
        type: 'label',
        position: canvas.moved[own.id] ?? own,
        width: LABEL_W,
        connectable: false,
        data: {
          text: state.edits[`label:${own.id}`] ?? '',
          size: state.picks[`size:${own.id}`] === 'title' ? 'title' : 'body',
          onText: (text) => run.edit(`label:${own.id}`, text),
          onSize: (size) => run.pick(`size:${own.id}`, size),
          onRemove: () => run.canvas.remove([own.id]),
        },
      })
    }
    if (own.kind === 'note') {
      annotations.push({
        id: own.id,
        type: 'note',
        position: canvas.moved[own.id] ?? own,
        width: NOTE_W,
        connectable: false,
        data: { text: state.edits[`note:${own.id}`] ?? '', onText: (text) => run.edit(`note:${own.id}`, text), onRemove: () => run.canvas.remove([own.id]) },
      })
    }
  }

  type Entry = { stage: ChainStage; lane: ChainLane | null; position: { x: number; y: number } }
  const steps = new Map<string, Entry>()
  for (const lane of lanes) {
    for (const stage of lane.stages) {
      if (!removed.has(stage.id)) steps.set(stage.id, { stage, lane, position: canvas.moved[stage.id] ?? seed.nodes.get(stage.id)! })
    }
  }
  for (const own of canvas.added) {
    if (!ANNOTATIONS.has(own.kind)) steps.set(own.id, { stage: ownStage(state, own), lane: null, position: canvas.moved[own.id] ?? { x: own.x, y: own.y } })
  }

  const pairs = [...lanes.flatMap((lane) => lane.links.map(([source, target]) => ({ id: `${source}→${target}`, source, target }))), ...canvas.links]
  const links = pairs.filter((link) => !removed.has(link.id) && steps.has(link.source) && steps.has(link.target))
  const into = (id: string) => links.filter((link) => link.target === id).map((link) => steps.get(link.source)!.stage)
  // What a node shows when it has no picture of its own: the one handed to it, a step or two up.
  const artOf = (stage: ChainStage, depth = 0): SceneArt | undefined =>
    stage.art ?? (depth < 3 ? into(stage.id).map((source) => artOf(source, depth + 1)).find(Boolean) : undefined)
  const madeOf = (id: string) => (canvas.made[id] ?? 0) + (state.asks[id]?.length ?? 0)

  const statusOf = new Map<string, NodeStatus>()
  for (const [id, { lane }] of steps) {
    const job = canvas.queue.findIndex((entry) => entry.id === id)
    const ask = state.applying === null ? -1 : state.applyingLeft.indexOf(id)
    let status: NodeStatus
    if (job === 0 || ask === 0) status = 'running'
    else if (job > 0 || ask > 0) status = 'queued'
    else if (lane) status = statuses.get(id) ?? 'draft'
    else status = madeOf(id) ? 'done' : 'new'
    statusOf.set(id, status)
  }

  const sparkWorks = agentDriving(state) && currentStep(state) !== null
  const head = canvas.queue[0]
  // Frames lie under everything; notes and free texts over the nodes (React Flow draws in this order).
  const nodes: CanvasNode[] = annotations.filter((node) => node.type === 'frame')
  for (const [id, { stage, lane, position }] of steps) {
    const status = statusOf.get(id)!
    const made = madeOf(id)
    // Spark made it in its own run (the plan's version), then each making from the canvas adds its count.
    const byPlan = lane && (statuses.get(id) === 'done' || statuses.get(id) === 'yours') ? 1 : 0
    const count = Number(settingsOf(state, stage).values.count ?? 1)
    // A text has the words it started with (the plan's, or none) and one more each time it is made; what the user (or
    // the plan) already has, its original and each remake; what a model makes, as many as it was made.
    const variants = stage.kind === 'text' ? (lane ? 1 : 0) + made : generated(stage) ? byPlan + made * count : 1 + made
    // The version picked holds until the node is made again; then it shows the newest.
    const [picked, pickedAt] = (state.picks[`ver:${id}`] ?? '').split('@').map(Number)
    const spark = lane && sparkWorks && status === 'running' && statuses.get(id) === 'running'
    const size = sizeOf(stage)
    nodes.push({
      id,
      type: 'step',
      position,
      width: size.w,
      height: size.h,
      data: {
        stage,
        status,
        shows: !generated(stage) || variants > 0,
        variants,
        active: pickedAt === variants && picked! < variants ? picked! : Math.max(0, variants - 1),
        progress: head?.id === id && head.startedAt ? Math.min(1, Math.max(0, (now - head.startedAt) / head.ms)) : undefined,
        own: !lane,
        art: artOf(stage),
        said: into(id).find((source) => source.kind === 'text')?.text?.value,
        input: into(id)[0]?.kind,
        agent: spark ? `card-${lane.id}` : undefined,
      },
    })
  }

  const made = (status?: NodeStatus) => status === 'done' || status === 'draft' || status === 'yours'
  const edges: ChainEdge[] = links.map((link) => ({
    id: link.id,
    source: link.source,
    target: link.target,
    type: 'chain',
    data: { passing: statusOf.get(link.target) === 'running' && made(statusOf.get(link.source)) },
  }))
  const agentNode = nodes.find((node) => node.type === 'step' && node.data.agent)?.id ?? null
  nodes.push(...annotations.filter((node) => node.type !== 'frame'))
  return { nodes, edges, steps, agentNode }
}

/** How far Spark is into the step it is on (0–1), ticking while it works; it holds while paused. */
function useStepFraction(state: LabRunState) {
  const step = currentStep(state)
  const live = agentDriving(state) && !state.frozen && step !== null
  const key = `${state.phase}|${state.step}`
  const [clock, setClock] = React.useState({ key: '', fraction: 0 })
  React.useEffect(() => {
    if (!live || !step) return
    const start = Date.now()
    const timer = window.setInterval(() => setClock({ key, fraction: Math.min(1, (Date.now() - start) / step.ms) }), 120)
    return () => window.clearInterval(timer)
  }, [live, key, step])
  return clock.key === key ? clock.fraction : 0
}

/** The time, ticking while something is being made (for its progress). */
function useNow(active: boolean) {
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

/** Closes a popup on a press outside `box` or on Escape. */
function useDismiss(open: boolean, box: React.RefObject<HTMLElement | null>, close: () => void) {
  React.useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as globalThis.Node)) close()
    }
    const esc = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open, box, close])
}

/**
 * A field inside a node that does not hold the node still: a press and drag moves the node, a press puts the caret in
 * it, and once it has the caret a drag selects its text (React Flow's `nodrag`).
 */
function useHeldField() {
  const [focused, setFocused] = React.useState(false)
  return { className: focused ? 'nodrag nowheel' : '', onFocus: () => setFocused(true), onBlur: () => setFocused(false) }
}

/** What the nodes ask of the canvas around them. */
type CanvasApi = {
  run: LabRun
  /** Puts nodes in the queue, in the order given. */
  make: (ids: string[]) => void
  /** Hands nodes to Spark's chat (the composer's chip) and opens its panel. */
  ask: (ids: string[]) => void
  /** Opens the node menu to add a node linked from `from`, beside it. */
  addAfter: (from: string) => void
  duplicate: (id: string) => void
  remove: (id: string) => void
}
const CanvasContext = React.createContext<CanvasApi | null>(null)
const useCanvas = () => React.useContext(CanvasContext)!

const nodeTypes = { step: StepNodeView, frame: FrameNodeView, note: NoteNodeView, label: LabelNodeView }
const edgeTypes = { chain: ChainEdgeView }

export function ChainBoard(props: { run: LabRun; scenes: LabScene[]; onAsk?: () => void }) {
  return (
    <ReactFlowProvider>
      <ChainCanvas {...props} />
    </ReactFlowProvider>
  )
}

type Adding = { from?: string; left: number; top: number; at: { x: number; y: number } }
type Box = { x: number; y: number; w: number; h: number }

function ChainCanvas({ run, scenes, onAsk }: { run: LabRun; scenes: LabScene[]; onAsk?: () => void }) {
  const { state } = run
  const flow = useReactFlow<CanvasNode, ChainEdge>()
  const wrap = React.useRef<HTMLDivElement>(null)
  // While a frame is dragged, the nodes inside it at the start go with it.
  const carried = React.useRef<{ frame: string; from: { x: number; y: number }; nodes: { id: string; x: number; y: number }[] } | null>(null)
  const [drag, setDrag] = React.useState<Record<string, { x: number; y: number }>>({})
  const [resizing, setResizing] = React.useState<Record<string, { w: number; h: number }>>({})
  const [measured, setMeasured] = React.useState<Record<string, { width: number; height: number }>>({})
  const [selected, setSelected] = React.useState<string[]>([])
  const [selectedEdges, setSelectedEdges] = React.useState<string[]>([])
  const [tool, setTool] = React.useState<'hand' | 'select'>('hand')
  const [adding, setAdding] = React.useState<Adding | null>(null)
  const [mapOpen, setMapOpen] = React.useState(false)
  const [zoom, setZoom] = React.useState(state.canvas.view?.zoom ?? FIRST_VIEW.zoom)

  const fraction = useStepFraction(state)
  const now = useNow(state.canvas.queue.length > 0)
  const lanes = chainLanes(state, scenes)
  const statuses = stageStatuses(state, lanes, fraction)
  const graph = graphOf(run, lanes, statuses, now)
  const nodes = graph.nodes.map((node) => {
    const size = resizing[node.id]
    return { ...node, position: drag[node.id] ?? node.position, selected: selected.includes(node.id), measured: measured[node.id], ...(size && { width: size.w, height: size.h }) } as CanvasNode
  })
  const edges = graph.edges.map((edge) => ({ ...edge, selected: selectedEdges.includes(edge.id) }))
  const picked = selected.filter((id) => graph.steps.has(id))
  const nameOf = (id: string) => graph.steps.get(id)?.stage.title ?? id
  const boxOf = (node: CanvasNode): Box => ({ x: node.position.x, y: node.position.y, w: node.width ?? node.measured?.width ?? 0, h: node.height ?? node.measured?.height ?? 0 })

  // Spark's cursor measures again on a scroll; the canvas moves without one, so it says so (once a frame at most).
  const nudge = React.useRef(0)
  const remeasure = React.useCallback(() => {
    if (nudge.current) return
    nudge.current = window.requestAnimationFrame(() => {
      nudge.current = 0
      wrap.current?.dispatchEvent(new Event('scroll'))
    })
  }, [])
  React.useEffect(() => remeasure(), [graph.agentNode, remeasure])
  // Following Spark: the canvas glides to the node it is making.
  React.useEffect(() => {
    if (!state.follow || !graph.agentNode) return
    const node = flow.getNode(graph.agentNode)
    if (!node) return
    flow.setCenter(node.position.x + (node.width ?? 280) / 2, node.position.y + (node.height ?? 300) / 2, { zoom: flow.getZoom(), duration: 500 })
  }, [graph.agentNode, state.follow, flow])

  const make = (ids: string[]) => {
    // A text is rewritten by Spark: its new words take the field (the progress covers them until it is done).
    for (const id of ids) {
      const step = graph.steps.get(id)
      const node = graph.nodes.find((entry) => entry.id === id)
      if (step?.stage.text && node?.type === 'step') run.edit(step.stage.text.key, textVersion(step.stage, !step.lane, node.data.variants))
    }
    run.canvas.run(ids.flatMap((id) => {
      const step = graph.steps.get(id)
      return step ? [{ id, ms: MAKE_MS[step.stage.kind] }] : []
    }))
  }
  const pick = (ids: string[]) => {
    const steps = ids.filter((id) => graph.steps.has(id))
    if (steps.length) run.select({ targets: steps, labels: steps.map(nameOf), noun: 'düğüm', from: 'chain' })
    else if (state.selection?.from === 'chain') run.select(null)
  }
  const center = () => {
    const box = wrap.current?.getBoundingClientRect()
    return flow.screenToFlowPosition({ x: (box?.left ?? 0) + (box?.width ?? 800) / 2, y: (box?.top ?? 0) + (box?.height ?? 600) / 2 })
  }
  const api: CanvasApi = {
    run,
    make,
    ask: (ids) => {
      setSelected(ids)
      pick(ids)
      run.ask()
      onAsk?.()
    },
    addAfter: (from) => {
      const node = flow.getNode(from)
      const box = wrap.current?.getBoundingClientRect()
      if (!node || !box) return
      const at = { x: node.position.x + (node.width ?? 280) + 80, y: node.position.y }
      const screen = flow.flowToScreenPosition({ x: node.position.x + (node.width ?? 280) + 24, y: node.position.y + (node.height ?? 300) / 2 })
      setAdding({ from, left: screen.x - box.left, top: screen.y - box.top, at })
    },
    duplicate: (id) => {
      const step = graph.steps.get(id)
      const node = flow.getNode(id)
      if (step && node) run.canvas.add(step.stage.kind, node.position.x + 40, node.position.y + 40)
    },
    remove: (id) => {
      run.canvas.remove([id])
      setSelected((list) => list.filter((entry) => entry !== id))
    },
  }

  /** The nodes (and notes) whose middle is inside a frame, besides the ones already moving with the selection. */
  const insideOf = (frameId: string, moving: Set<string>) => {
    const frame = nodes.find((node) => node.id === frameId)
    if (!frame) return []
    const box = boxOf(frame)
    return nodes
      .filter((node) => node.type !== 'frame' && !moving.has(node.id))
      .filter((node) => {
        const inner = boxOf(node)
        const mx = inner.x + inner.w / 2
        const my = inner.y + inner.h / 2
        return mx > box.x && mx < box.x + box.w && my > box.y && my < box.y + box.h
      })
      .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }))
  }

  const onNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    const moving: Record<string, { x: number; y: number }> = {}
    let settled = false
    let nextSelected: string[] | null = null
    const removing: string[] = []
    const sizes: Record<string, { w: number; h: number }> = {}
    let sized = false
    const seen: Record<string, { width: number; height: number }> = {}
    for (const change of changes) {
      if (change.type === 'position') {
        if (change.position) {
          moving[change.id] = change.position
          const node = nodes.find((entry) => entry.id === change.id)
          if (node?.type === 'frame') {
            if (carried.current?.frame !== change.id) carried.current = { frame: change.id, from: node.position, nodes: insideOf(change.id, new Set(selected)) }
            const dx = change.position.x - carried.current.from.x
            const dy = change.position.y - carried.current.from.y
            for (const inner of carried.current.nodes) moving[inner.id] = { x: inner.x + dx, y: inner.y + dy }
          }
        }
        if (change.dragging === false) settled = true
      } else if (change.type === 'dimensions' && change.dimensions) {
        if (change.resizing !== undefined) {
          sizes[change.id] = { w: change.dimensions.width, h: change.dimensions.height }
          if (change.resizing === false) sized = true
        } else {
          seen[change.id] = change.dimensions
        }
      } else if (change.type === 'dimensions' && change.resizing === false) {
        sized = true
      } else if (change.type === 'select') {
        const list: string[] = nextSelected ?? selected
        nextSelected = change.selected ? [...new Set([...list, change.id])] : list.filter((id) => id !== change.id)
      } else if (change.type === 'remove') {
        removing.push(change.id)
      }
    }
    if (Object.keys(moving).length || settled) {
      const all = { ...drag, ...moving }
      if (settled) {
        run.canvas.move(all)
        setDrag({})
        carried.current = null
      } else {
        setDrag(all)
      }
    }
    if (Object.keys(sizes).length || sized) {
      const all = { ...resizing, ...sizes }
      if (sized) {
        Object.entries(all).forEach(([id, size]) => run.canvas.resize(id, Math.round(size.w), Math.round(size.h)))
        if (Object.keys(drag).length || Object.keys(moving).length) run.canvas.move({ ...drag, ...moving })
        setResizing({})
        setDrag({})
      } else {
        setResizing(all)
      }
    }
    if (Object.keys(seen).length) setMeasured((current) => ({ ...current, ...seen }))
    if (nextSelected) {
      setSelected(nextSelected)
      pick(nextSelected)
    }
    if (removing.length) run.canvas.remove(removing)
  }
  const onEdgesChange = (changes: EdgeChange<ChainEdge>[]) => {
    let next: string[] | null = null
    const removing: string[] = []
    for (const change of changes) {
      if (change.type === 'select') {
        const list: string[] = next ?? selectedEdges
        next = change.selected ? [...list, change.id] : list.filter((id) => id !== change.id)
      } else if (change.type === 'remove') {
        removing.push(change.id)
      }
    }
    if (next) setSelectedEdges(next)
    if (removing.length) run.canvas.unlink(removing)
  }
  const onConnect = (connection: Connection) => run.canvas.link(connection.source, connection.target)
  /** A link dropped on the canvas: the node menu opens there, and the new node takes the link. */
  const onConnectEnd: OnConnectEnd = (event, connection) => {
    if (connection.isValid || !connection.fromNode || connection.fromHandle?.type !== 'source') return
    const point = 'changedTouches' in event ? event.changedTouches[0] : event
    const box = wrap.current?.getBoundingClientRect()
    if (!point || !box) return
    const at = flow.screenToFlowPosition({ x: point.clientX, y: point.clientY })
    setAdding({ from: connection.fromNode.id, left: point.clientX - box.left, top: point.clientY - box.top, at: { x: at.x, y: at.y - 160 } })
  }
  const addHere = (left: number, top: number) => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box) return
    const at = flow.screenToFlowPosition({ x: box.left + left, y: box.top + top })
    setAdding({ left, top, at: { x: at.x - 140, y: at.y - 160 } })
  }
  const add = (kind: StageKind) => {
    if (!adding) return
    run.canvas.add(kind, Math.round(adding.at.x), Math.round(adding.at.y), adding.from)
    setAdding(null)
  }
  const closeAdding = React.useCallback(() => setAdding(null), [])
  const addNote = () => {
    const at = center()
    run.canvas.add('note', Math.round(at.x - NOTE_W / 2), Math.round(at.y - 60))
  }
  const addText = () => {
    const at = center()
    run.canvas.add('label', Math.round(at.x - LABEL_W / 2), Math.round(at.y - 20))
  }
  const addFrame = () => {
    const at = center()
    run.canvas.add('frame', Math.round(at.x - 280), Math.round(at.y - 190), undefined, { w: 560, h: 380 })
  }
  /** Puts a frame around the selected nodes and notes. */
  const frameSelection = () => {
    const boxes = nodes.filter((node) => selected.includes(node.id) && node.type !== 'frame').map(boxOf)
    if (!boxes.length) return
    const left = Math.min(...boxes.map((box) => box.x))
    const top = Math.min(...boxes.map((box) => box.y))
    const right = Math.max(...boxes.map((box) => box.x + box.w))
    const bottom = Math.max(...boxes.map((box) => box.y + box.h))
    run.canvas.add('frame', Math.round(left - PAD.x), Math.round(top - PAD.top), undefined, { w: Math.round(right - left + PAD.x * 2), h: Math.round(bottom - top + PAD.top + PAD.bottom) })
  }

  // The queue: what the canvas makes (the first one with its progress), then what Spark remakes for a request.
  const queueItems: QueueItem[] = [
    ...state.canvas.queue.map((job, index) => {
      const step = graph.steps.get(job.id)
      const progress = index === 0 && job.startedAt ? Math.min(1, Math.max(0, (now - job.startedAt) / job.ms)) : undefined
      return { id: job.id, title: step?.stage.title ?? job.id, kind: step?.stage.kind ?? 'image', status: index === 0 ? ('running' as const) : ('queued' as const), progress }
    }),
    ...(state.applying === null ? [] : state.applyingLeft.filter((id) => graph.steps.has(id))).map((id, index) => ({
      id,
      title: nameOf(id),
      kind: graph.steps.get(id)!.stage.kind,
      status: index === 0 ? ('running' as const) : ('queued' as const),
    })),
  ]
  const sparkStep = state.phase === 'building' && agentDriving(state) ? currentStep(state) : null
  const focus = (id: string) => {
    const node = flow.getNode(id)
    if (node) flow.setCenter(node.position.x + (node.width ?? 280) / 2, node.position.y + (node.height ?? 300) / 2, { zoom: Math.max(flow.getZoom(), 0.8), duration: 500 })
  }

  return (
    <CanvasContext.Provider value={api}>
      <div className={`lb-b-board lb-cv tool-${tool}`} ref={wrap}>
        <ReactFlow<CanvasNode, ChainEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onMove={(_, view) => {
            remeasure()
            setZoom(view.zoom)
          }}
          onMoveEnd={(_, view) => run.canvas.view(view)}
          onPaneClick={(event) => {
            if (event.detail === 2) {
              const box = wrap.current?.getBoundingClientRect()
              if (box) addHere(event.clientX - box.left, event.clientY - box.top)
            }
          }}
          defaultViewport={state.canvas.view ?? FIRST_VIEW}
          minZoom={0.15}
          maxZoom={1.6}
          panOnDrag={tool === 'hand' ? true : [1, 2]}
          selectionOnDrag={tool === 'select'}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          connectOnClick={false}
          multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
          deleteKeyCode={['Backspace', 'Delete']}
          connectionLineStyle={{ stroke: 'var(--cv-wire-on)', strokeWidth: 1.5, strokeDasharray: '5 5' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} />
          {mapOpen ? (
            <MiniMap
              className="lb-cv-map"
              position="bottom-left"
              pannable
              zoomable
              nodeBorderRadius={8}
              nodeStrokeWidth={0}
              nodeClassName={(node) => `lb-cv-map-${node.type}`}
            />
          ) : null}
          {selected.length > 1 ? (
            <NodeToolbar nodeId={selected} isVisible position={Position.Top} offset={40} className="lb-cv-bar">
              <span className="lb-cv-bar-t">{selected.length} öğe</span>
              {picked.length ? (
                <button type="button" onClick={() => make([...picked].sort((a, b) => (flow.getNode(a)?.position.x ?? 0) - (flow.getNode(b)?.position.x ?? 0)))}>
                  <Icon name="play" size="sm" />
                  Hepsini üret
                </button>
              ) : null}
              <button type="button" onClick={frameSelection} title="Seçilenleri bir çerçeveye al">
                <FrameIcon aria-hidden />
                Çerçeveye al
              </button>
              {picked.length ? (
                <button type="button" className="spark" onClick={() => api.ask(picked)} title="Spark’a sor: ne değişeceğini sohbete yaz">
                  <Icon name="sparkles" size="sm" />
                  Spark’a sor
                </button>
              ) : null}
              <button type="button" onClick={() => {
                run.canvas.remove(selected)
                setSelected([])
              }} title="Sil" aria-label="Seçilenleri sil">
                <Trash2 aria-hidden />
              </button>
            </NodeToolbar>
          ) : null}
        </ReactFlow>

        {lanes.length ? null : <p className="lb-cv-hint"><span className="spin" />Spark planı yazıyor; sahneler yazıldıkça burada belirir.</p>}

        <nav className="lb-cv-tools" aria-label="Tuval araçları">
          <button type="button" className="primary" onClick={() => addHere((wrap.current?.clientWidth ?? 800) / 2, (wrap.current?.clientHeight ?? 600) / 2)} title="Düğüm ekle" aria-label="Düğüm ekle">
            <Plus aria-hidden />
          </button>
          <button type="button" onClick={addNote} title="Not ekle" aria-label="Not ekle"><StickyNote aria-hidden /></button>
          <button type="button" onClick={addText} title="Yazı ekle: başlık ya da açıklama" aria-label="Yazı ekle"><Type aria-hidden /></button>
          <button type="button" onClick={addFrame} title="Çerçeve ekle" aria-label="Çerçeve ekle"><FrameIcon aria-hidden /></button>
          <i />
          <button type="button" className={tool === 'select' ? 'on' : ''} onClick={() => setTool('select')} title="Seç: sürükleyerek birden çok öğe seç" aria-pressed={tool === 'select'}>
            <MousePointer2 aria-hidden />
          </button>
          <button type="button" className={tool === 'hand' ? 'on' : ''} onClick={() => setTool('hand')} title="El: sürükleyerek tuvalde gez" aria-pressed={tool === 'hand'}>
            <Hand aria-hidden />
          </button>
          <i />
          <button type="button" className={state.follow ? 'on spark' : ''} onClick={run.toggleFollow} title={state.follow ? 'Spark’ı izliyorsun' : 'Spark’ı izle'} aria-pressed={state.follow}>
            <Sparkles aria-hidden />
          </button>
        </nav>

        <div className="lb-cv-queue">
          <QueuePill items={queueItems} spark={sparkStep ? { doing: sparkStep.doing } : null} onFocus={focus} onStop={state.canvas.queue.length ? run.canvas.stop : undefined} />
        </div>
        <div className="lb-cv-zoom">
          <ZoomPill
            zoom={zoom}
            onZoomOut={() => flow.zoomOut({ duration: 200 })}
            onZoomIn={() => flow.zoomIn({ duration: 200 })}
            onReset={() => flow.zoomTo(1, { duration: 200 })}
            onFit={() => flow.fitView({ padding: 0.08, duration: 400 })}
            mapOpen={mapOpen}
            onToggleMap={() => setMapOpen(!mapOpen)}
          />
        </div>

        {adding ? <AddMenu adding={adding} onAdd={add} onClose={closeAdding} /> : null}
      </div>
    </CanvasContext.Provider>
  )
}

/** The node menu: every kind of node, at the point it was opened. */
function AddMenu({ adding, onAdd, onClose }: { adding: Adding; onAdd: (kind: StageKind) => void; onClose: () => void }) {
  const box = React.useRef<HTMLDivElement>(null)
  useDismiss(true, box, onClose)
  return (
    <div className="lb-cv-menu add" ref={box} style={{ left: adding.left, top: adding.top }} role="menu" aria-label="Düğüm ekle">
      <small>{adding.from ? 'Bağlı düğüm ekle' : 'Düğüm ekle'}</small>
      {STAGE_KINDS.map((kind) => (
        <button key={kind} type="button" role="menuitem" onClick={() => onAdd(kind)}>
          <span className={`lb-cv-glyph k-${kind}`}><Icon name={STAGE_KIND[kind].icon} size="sm" /></span>
          <span><b>{STAGE_KIND[kind].name}</b><small>{STAGE_KIND[kind].hint}</small></span>
        </button>
      ))}
    </div>
  )
}

// ---- a node ---------------------------------------------------------------------------------------------------

function StepNodeView({ id, data, selected }: NodeProps<StepNode>) {
  const api = useCanvas()
  const { state } = api.run
  const { stage, status } = data
  const kind = STAGE_KIND[stage.kind]
  const [settings, setSettings] = React.useState(false)
  // The panel closes itself on a press outside it or Escape (it needs a steady callback for that).
  const closeSettings = React.useCallback(() => setSettings(false), [setSettings])
  const { rows, values } = settingsOf(state, stage)
  // Settings belong to what a model (or Spark) makes, not to the user's own clip, stock or the Brand Kit.
  const settable = rows.length > 0 && (stage.kind === 'text' || choiceOf(state, stage, data.own) !== null)
  const label = NODE_STATUS[status]
  return (
    <div className={`lb-cv-node k-${stage.kind} ${status}${selected ? ' selected' : ''}${data.agent ? ' lb-agent-on' : ''}`} {...(data.agent && { 'data-agent-target': data.agent })}>
      <header className="lb-cv-label">
        <Icon name={kind.icon} size="sm" />
        <span>{stage.title}</span>
        {label ? <em>{status === 'running' ? <ProgressRing value={data.progress} size={11} /> : null}{label}</em> : null}
      </header>
      <Handle type="target" position={Position.Left} className="lb-cv-port in" />
      <div className="lb-cv-box">
        <Output id={id} data={data} aspect={values.aspect} />
        <Composer id={id} data={data} settingsOpen={settings} onSettings={settable ? () => setSettings(!settings) : undefined} />
      </div>
      <Handle type="source" position={Position.Right} className="lb-cv-port out" onClick={() => api.addAfter(id)} title="Bağlı düğüm ekle (ya da sürükleyip bir düğüme bağla)">
        <Plus aria-hidden />
      </Handle>
      {settings ? (
        <div className="lb-cv-settings">
          <SettingsPanel rows={rows} values={values} onChange={(row, value) => api.run.pick(settingKey(id, row), value)} onClose={closeSettings} />
        </div>
      ) : null}
      <NodeToolbar position={Position.Top} offset={36} className="lb-cv-bar">
        <button type="button" className="spark" onClick={() => api.ask([id])} title="Spark’a sor: ne değişeceğini sohbete yaz">
          <Icon name="sparkles" size="sm" />
          Spark’a sor
        </button>
        <button type="button" onClick={() => api.duplicate(id)} title="Çoğalt" aria-label="Çoğalt"><Copy aria-hidden /></button>
        <button type="button" onClick={() => api.remove(id)} title="Sil" aria-label="Sil"><Trash2 aria-hidden /></button>
      </NodeToolbar>
    </div>
  )
}

/** Bar heights of a sound's waveform, the same for the same node. */
function waveOf(id: string, count = 34) {
  let seed = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 1103515245 + 12345) >>> 0
    const swell = Math.sin((index / count) * Math.PI)
    return 18 + Math.round(((seed % 1000) / 1000) * 66 * (0.4 + swell * 0.6))
  })
}

/** One output among a node's versions, drawn a little differently from the others (demo pictures). */
const variantStyle = (index: number): React.CSSProperties | undefined =>
  index ? { filter: `hue-rotate(${(index * 17) % 90}deg) saturate(${1 + (index % 3) * 0.14})`, transform: `scale(${1 + (index % 2) * 0.07})` } : undefined

/**
 * What a node made, in place: the picture or clip (with its versions under it, the picked one is what goes on), the
 * frame, the text, the sound, the cut. A model's node shows nothing until it is made; while it is made, its progress.
 */
function Output({ id, data, aspect }: { id: string; data: StepData; aspect?: string }) {
  const { run } = useCanvas()
  const { stage, status } = data
  const working = status === 'running'
  const ratio = aspect ? { aspectRatio: aspect.replace(':', ' / ') } : undefined
  const progress = working ? (
    <span className="lb-cv-progress">
      <ProgressRing value={data.progress} size={30} stroke={2} />
      <small>{data.progress === undefined ? 'Üretiliyor' : `%${Math.round(data.progress * 100)}`}</small>
    </span>
  ) : null

  if (stage.id === 'all/cut') {
    return (
      <div className={`lb-cv-out cut${data.shows ? '' : ' empty'}`}>
        {data.shows ? CUT_FRAMES.map((art, index) => <span key={index} className="lb-cv-pic"><span className="lb-thumb"><span className={`lb-art ${art}`} /></span></span>) : <Empty data={data} />}
        {progress}
      </div>
    )
  }
  if (stage.kind === 'text') return <TextOutput id={id} data={data} />
  if (stage.kind === 'media') return <MediaOutput data={data} />
  if (stage.kind === 'voice' || stage.kind === 'music') {
    return (
      <div className={`lb-cv-out wave${data.shows ? '' : ' empty'}`}>
        {data.shows || working ? <span className="lb-cv-bars">{waveOf(data.active ? `${stage.id}:${data.active}` : stage.id).map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</span> : <Empty data={data} />}
        {data.shows ? (
          <small>
            {data.said ? <q>{data.said}</q> : <span>{stage.how}</span>}
            {stage.seconds ? <span>{formatClock(stage.seconds)}</span> : null}
          </small>
        ) : null}
        <Versions id={id} data={data} />
        {progress}
      </div>
    )
  }
  const art = data.art
  return (
    <div className={`lb-cv-out${data.shows && art ? '' : ' empty'}`}>
      {data.shows && art ? (
        <span className="lb-cv-pic" style={ratio}>
          <span className="lb-thumb"><span className={`lb-art ${art}`} style={variantStyle(data.active)} /></span>
          {stage.kind === 'video' ? <span className="lb-cv-play"><Icon name="play" size="sm" /></span> : null}
          {stage.seconds && stage.kind === 'video' ? <span className="lb-cv-tag">{formatClock(stage.seconds)}</span> : null}
          {stage.kind === 'frame' ? <span className="lb-cv-tag start">{(run.state.picks[`end:${id}`] ?? 'last') === 'first' ? 'ilk kare' : 'son kare'}</span> : null}
        </span>
      ) : working ? null : (
        <Empty data={data} />
      )}
      <Versions id={id} data={data} ratio={ratio} />
      {progress}
    </div>
  )
}

/**
 * A node's outputs so far, behind one button on what it shows (only once there is more than one): pictures and clips
 * as thumbnails, sounds as their waves, texts as their lines. The one picked is what the node shows and hands on.
 */
function Versions({ id, data, ratio }: { id: string; data: StepData; ratio?: React.CSSProperties }) {
  const { run } = useCanvas()
  const [open, setOpen] = React.useState(false)
  const box = React.useRef<HTMLDivElement>(null)
  const close = React.useCallback(() => setOpen(false), [setOpen])
  useDismiss(open, box, close)
  if (data.variants < 2) return null
  const { stage } = data
  const picture = Boolean(data.art) && stage.kind !== 'voice' && stage.kind !== 'music' && stage.kind !== 'text'
  const newestFirst = Array.from({ length: data.variants }, (_, index) => data.variants - 1 - index)
  const choose = (index: number) => {
    run.pick(`ver:${id}`, `${index}@${data.variants}`)
    if (stage.text) run.edit(stage.text.key, textVersion(stage, data.own, index))
    setOpen(false)
  }
  return (
    <div className={`lb-cv-history${open ? ' open' : ''}`} ref={box}>
      <button type="button" className="lb-cv-history-btn" onClick={() => setOpen(!open)} aria-expanded={open} title="Sürümler">
        <HistoryIcon aria-hidden />
        {data.active + 1}/{data.variants}
      </button>
      {open ? (
        <div className={`lb-cv-menu history ${picture ? 'grid' : 'rows'}`} role="listbox" aria-label="Sürümler">
          <small>Sürümler · seçtiğin sonrakine geçer</small>
          <div className="lb-cv-history-list">
            {newestFirst.map((index) => (
              <button key={index} type="button" role="option" aria-selected={index === data.active} className={index === data.active ? 'on' : ''} onClick={() => choose(index)}>
                {picture ? (
                  <span className="lb-cv-pic" style={ratio}><span className="lb-thumb"><span className={`lb-art ${data.art}`} style={variantStyle(index)} /></span></span>
                ) : stage.kind === 'text' ? (
                  <span className="line">{textVersion(stage, data.own, index) || 'Boş'}</span>
                ) : (
                  <span className="lb-cv-bars">{waveOf(index ? `${stage.id}:${index}` : stage.id, 24).map((height, bar) => <i key={bar} style={{ height: `${height}%` }} />)}</span>
                )}
                <small>v{index + 1}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** A model's node before it is made: what it will take, quietly. */
function Empty({ data }: { data: StepData }) {
  const { stage, input } = data
  const line =
    data.status === 'writing' ? 'Spark yazıyor…'
    : stage.kind === 'frame' ? (input ? 'Bağlı klipten alınır' : 'Bir klibe bağla')
    : stage.kind === 'video' ? (input === 'frame' ? 'Bağlı kareden başlar' : input ? 'Bağlı görselden başlar' : 'Bir görsele bağla ya da anlat')
    : stage.kind === 'voice' ? (data.said ? 'Bağlı metni seslendirir' : 'Bir metne bağla')
    : 'Henüz üretilmedi'
  return (
    <span className="lb-cv-empty">
      <Icon name={STAGE_KIND[stage.kind].icon} />
      {line}
    </span>
  )
}

/** A text node's text: what Spark (or the user) wrote, rewritten in place (a scene's line is Senaryo's too). */
function TextOutput({ id, data }: { id: string; data: StepData }) {
  const { run } = useCanvas()
  const text = data.stage.text
  const value = text?.value ?? ''
  const [draft, setDraft] = React.useState<string | null>(null)
  const held = useHeldField()
  if (data.status === 'writing') return <div className="lb-cv-out text"><span className="lb-cv-lines"><i /><i /><i /></span></div>
  return (
    <div className="lb-cv-out text">
      <textarea
        className={held.className}
        value={draft ?? value}
        placeholder="Kendin yaz ya da Spark yazsın"
        aria-label={`${data.stage.title}: metin`}
        onFocus={held.onFocus}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          held.onBlur()
          if (draft !== null && text && draft.trim() !== value) run.edit(text.key, draft.trim())
          setDraft(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDraft(null)
        }}
      />
      <Versions id={id} data={data} />
      {data.status === 'running' ? <span className="lb-cv-progress"><ProgressRing value={data.progress} size={30} stroke={2} /></span> : null}
    </div>
  )
}

/** The user's own picture or clip: from Storage or a file dropped on it. */
function MediaOutput({ data }: { data: StepData }) {
  const { run } = useCanvas()
  const { stage } = data
  const own = run.state.media[stage.id]
  const [over, setOver] = React.useState(false)
  const picker = useStorageMediaPicker((media) => run.setMedia(stage.id, media))
  return (
    <div
      className={`lb-cv-out media${over ? ' over' : ''}${own || data.art ? '' : ' empty'}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        void picker.upload(event.dataTransfer.files[0])
      }}
    >
      {own ? (
        <span className="lb-cv-pic"><span className="lb-thumb"><MediaThumb media={own} /></span></span>
      ) : data.art ? (
        <span className="lb-cv-pic"><span className="lb-thumb"><span className={`lb-art ${data.art}`} /></span>{stage.seconds ? <span className="lb-cv-tag">{formatClock(stage.seconds)}</span> : null}</span>
      ) : (
        <button type="button" className="lb-cv-drop" onClick={picker.open}>
          <Icon name="upload" />
          <b>Görsel ya da klip bırak</b>
          <small>ya da depodan seç</small>
        </button>
      )}
      {picker.element}
    </div>
  )
}

/**
 * The node's composer, the shared prompt box: what to do; at hand the model (or voice, or music) and the size; the
 * settings button for the rest (they open under the node); what it costs, and the button that puts the node in the
 * queue. A frame chooses its end instead; the user's media has no composer.
 */
function Composer({ id, data, settingsOpen, onSettings }: { id: string; data: StepData; settingsOpen: boolean; onSettings?: () => void }) {
  const { run, make } = useCanvas()
  const { state } = run
  const { stage, status } = data
  const choice = choiceOf(state, stage, data.own)
  const { rows, values } = settingsOf(state, stage)
  const aspectRow = rows.find((row) => row.id === 'aspect')
  const brief = state.edits[stage.briefKey] ?? stage.brief
  const [draft, setDraft] = React.useState<string | null>(null)
  const [menu, setMenu] = React.useState(false)
  const held = useHeldField()
  const busy = status === 'running' || status === 'queued'
  const blocked = busy || status === 'writing' || status === 'yours'
  const keep = () => {
    if (draft !== null && draft.trim() !== brief) run.edit(stage.briefKey, draft.trim())
    setDraft(null)
  }
  const go = () => {
    keep()
    if (!blocked) make([id])
  }
  const credits = costOf(state, stage, data.own)
  const verb = data.variants || data.status === 'done' ? 'Yeniden üret' : 'Üret'
  if (stage.kind === 'media') return null

  return (
    <div className="lb-cv-compose">
      {/* In the composer itself: the menu counts a press on its chip as its own, so the chip toggles it. */}
      {menu && choice ? (
        <ModelMenu
          options={choice.options}
          value={choice.value}
          auto={choice.auto ? { sub: 'Her istekte uygun modeli seçer' } : undefined}
          onPick={(value) => run.pick(choice.pick, value)}
          onClose={() => setMenu(false)}
        />
      ) : null}
      <PromptBox
        className="lb-cv-pb"
        bar={(
          <>
            {stage.kind === 'frame' ? (
              (['first', 'last'] as const).map((end) => (
                <PromptBoxChip
                  key={end}
                  label={end === 'first' ? 'İlk kare' : 'Son kare'}
                  active={(state.picks[`end:${id}`] ?? 'last') === end}
                  onClick={() => run.pick(`end:${id}`, end)}
                />
              ))
            ) : choice ? (
              <PromptBoxChip label={choice.label} caret aria-expanded={menu} onClick={() => setMenu(!menu)} title="Model" />
            ) : (
              <PromptBoxChip label={stage.how || 'Spark'} disabled />
            )}
            {aspectRow && choice ? (
              <PromptBoxChip
                label={values.aspect}
                title="Boyut"
                onClick={() => {
                  const options = aspectRow.options
                  run.pick(settingKey(id, 'aspect'), options[(options.indexOf(values.aspect!) + 1) % options.length]!)
                }}
              />
            ) : null}
            <PromptBoxSpacer />
            {onSettings ? (
              <PromptBoxChip icon={<SlidersHorizontal aria-hidden />} srLabel="Ayarlar" title="Ayarlar" active={settingsOpen} aria-expanded={settingsOpen} onClick={onSettings} data-lb-ns-toggle="" />
            ) : null}
            {credits ? <PromptBoxNote title={`${verb}: ≈ ${credits} kredi`}>{credits} kr</PromptBoxNote> : null}
            <PromptBoxSend type="button" label={verb} onClick={go} disabled={blocked} busy={status === 'running'} title={blocked ? 'Üretiliyor' : `${verb}${credits ? ` · ≈ ${credits} kredi` : ''}`} />
          </>
        )}
      >
        {stage.kind === 'frame' ? null : (
          <PromptBoxInput
            className={held.className}
            value={draft ?? brief}
            placeholder={stage.kind === 'text' ? 'Spark ne yazsın?' : stage.id === 'all/cut' ? 'Kurguda ne olsun?' : 'Ne yapsın?'}
            aria-label={`${stage.title}: ne yapsın`}
            onFocus={held.onFocus}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              held.onBlur()
              keep()
            }}
            onSend={go}
          />
        )}
      </PromptBox>
    </div>
  )
}

/** A link: a soft curve from an output to an input; it carries a moving line while something is handed over. */
function ChainEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps<ChainEdge>) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.4 })
  return <BaseEdge id={id} path={path} className={`lb-cv-edge${data?.passing ? ' passing' : ''}${selected ? ' selected' : ''}`} interactionWidth={18} />
}
