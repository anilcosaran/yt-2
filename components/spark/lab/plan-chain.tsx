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
import { ChevronRight, Copy, Hand, MousePointer2, Plus, Scan, Sparkles, Trash2 } from 'lucide-react'

import { PromptBox, PromptBoxChip, PromptBoxInput, PromptBoxNote, PromptBoxSend, PromptBoxSpacer } from '../agent/prompt-box'
import { CUT_FRAMES, STAGE_KIND, STAGE_KINDS, chainLanes, creditsOf, modelOf, stageStatuses, voiceName, type ChainLane, type ChainStage, type StageKind, type StageStatus } from './lab-chain'
import { LOOK_OPTIONS, MODELS, formatClock, type LabScene, type SceneArt } from './lab-model'
import { Icon, LockButton, SceneDot } from './lab-parts'
import { MediaThumb, useStorageMediaPicker } from './lab-source'
import { agentDriving, currentStep, pickOf, sceneStatus, type CanvasOwnNode, type LabRun, type LabRunState } from './use-lab-run'
import './lab-chain.css'

// Plan view, "Üretim": the plan as a canvas of nodes, each one a place to work. Spark puts the nodes there from the plan
// (a row per scene: its picture chain, then its line and voice) and makes them when the plan is approved; the user
// drags them, links one node's output to another, adds nodes (the "+" on a node's edge, the toolbar, a double click on
// the canvas) and makes any node on its own from its composer, which says what to do, with which model, at what cost.
// Making a node puts it in the queue ("Kuyruk"); nothing runs everything at once here. The engine is React Flow; the look
// is the lab's own, so it never reads as Flow, the automation product. See `lab-chain.ts` for the plan it is read from.

/** A node's box by kind, in canvas px. */
const SIZE: Record<StageKind | 'cut', { w: number; h: number }> = {
  image: { w: 280, h: 330 },
  video: { w: 280, h: 330 },
  frame: { w: 280, h: 330 },
  media: { w: 280, h: 300 },
  text: { w: 280, h: 230 },
  voice: { w: 280, h: 210 },
  music: { w: 280, h: 210 },
  cut: { w: 380, h: 250 },
}
/** A scene's row (the tallest node, its label above and the gap below), a column, and where the nodes start. */
const ROW = 450
const COL = 350
const X0 = 190
/** The gap between a scene's picture chain and its words. */
const WORDS_GAP = 60
/** The first look: the start of the plan, past the tools, at a size the nodes can be read at; the rest is a pan away. */
const FIRST_VIEW = { x: 76, y: 52, zoom: 0.85 }
/** How long making a node from the canvas takes (demo). */
const MAKE_MS: Record<StageKind, number> = { text: 1100, image: 1700, frame: 700, video: 2600, voice: 1300, music: 1300, media: 500 }
/** What a text node the user added writes, by how many times it was made (demo). */
const TEXT_SAMPLES = ['Sonbaharın en sıcak tabağı: balkabaklı risotto.', 'Bu tabak yalnızca ekimde.', 'Şefin sonbahar sırrı fırından çıkıyor.']

type NodeStatus = StageStatus | 'new'
const NODE_STATUS: Record<NodeStatus, string> = { writing: 'Yazılıyor', draft: 'Taslak', queued: 'Sırada', running: 'Üretiliyor', done: '', yours: 'Sende', new: '' }

type StepData = {
  stage: ChainStage
  /** The scene the node belongs to, by name (a planned node); empty for the user's own. */
  place: string
  status: NodeStatus
  /** How many times it was made since the plan (from its composer or a request to Spark). */
  made: number
  own: boolean
  /** What it shows: its own picture, else the one handed to it. */
  art?: SceneArt
  /** The text handed to it (a voice says it). */
  said?: string
  /** Spark's cursor target while Spark makes this node. */
  agent?: string
}
type StepNode = Node<StepData, 'step'>
type SceneNode = Node<{ lane: ChainLane }, 'scene'>
type CanvasNode = StepNode | SceneNode
type ChainEdge = Edge<{ passing: boolean }, 'chain'>

const sizeOf = (stage: ChainStage) => (stage.id === 'all/cut' ? SIZE.cut : SIZE[stage.kind])

/** A node the user added, as a step of the chain. */
function ownStage(state: LabRunState, node: CanvasOwnNode): ChainStage {
  const kind = (node.kind in STAGE_KIND ? node.kind : 'image') as StageKind
  const made = state.canvas.made[node.id] ?? 0
  const sample = TEXT_SAMPLES[(made - 1 + TEXT_SAMPLES.length) % TEXT_SAMPLES.length]!
  return {
    id: node.id,
    kind,
    title: STAGE_KIND[kind].name,
    how: kind === 'text' ? 'Spark yazar' : kind === 'voice' ? voiceName(state) : '',
    brief: '',
    briefKey: `brief:${node.id}`,
    credits: kind === 'image' ? 4 : kind === 'video' ? 12 : kind === 'voice' ? 2 : 0,
    seconds: kind === 'video' ? 5 : undefined,
    // A text node takes what the user types into it as it is; once made, Spark's text stands there until rewritten.
    text: kind === 'text' ? { value: state.edits[`text:${node.id}`] ?? (made ? sample : ''), key: `text:${node.id}` } : undefined,
  }
}

/** The model (or voice, or music) a node makes with, where it has a choice, and where the choice is kept. */
function choiceOf(state: LabRunState, stage: ChainStage, lane: string | null) {
  // A picture or clip a model makes: one the user added, or one the plan has a model make (not the user's own clip,
  // stock, the Brand Kit or a trim).
  const generated = !lane || stage.id === `${lane}/video` || MODELS.some((model) => stage.how.startsWith(model.title))
  if ((stage.kind === 'image' || stage.kind === 'video') && generated) {
    // A scene's clip shares its model with the scene's source tag in Senaryo.
    const key = stage.kind === 'video' && lane && stage.id === `${lane}/video` ? lane : stage.id
    const picked = state.picks[`model:${key}`]
    const options = MODELS.filter((model) => model.kind === stage.kind)
    const model = picked ? modelOf(state, key) : stage.kind === 'image' ? options.find((entry) => entry.id === 'flux-2-pro')! : modelOf(state, key)
    return { pick: `model:${key}`, value: model.id, label: model.title, credits: creditsOf(model.meta), options: options.map((entry) => ({ id: entry.id, label: entry.title, sub: entry.meta })) }
  }
  if (stage.kind === 'voice' && !stage.how.startsWith('Klib')) {
    const value = pickOf(state, 'voice') ?? 'ece'
    return { pick: 'voice', value, label: voiceName(state), credits: stage.credits, options: (LOOK_OPTIONS.voice ?? []).map((entry) => ({ id: entry.id, label: entry.title, sub: entry.sub ?? '' })) }
  }
  if (stage.kind === 'music') {
    const value = pickOf(state, 'music') ?? 'acoustic'
    const options = (LOOK_OPTIONS.music ?? []).filter((entry) => entry.id !== 'none')
    return { pick: 'music', value, label: options.find((entry) => entry.id === value)?.title ?? 'Müzik', credits: 0, options: options.map((entry) => ({ id: entry.id, label: entry.title, sub: entry.sub ?? '' })) }
  }
  return null
}

/** The canvas as React Flow nodes and edges: Spark's chain from the plan, under what the user did on it. */
function graphOf(state: LabRunState, lanes: ChainLane[], statuses: Map<string, StageStatus>) {
  const { canvas } = state
  const removed = new Set(canvas.removed)
  type Entry = { stage: ChainStage; lane: ChainLane | null; position: { x: number; y: number } }
  const steps = new Map<string, Entry>()
  const labels: SceneNode[] = []
  lanes.forEach((lane, row) => {
    const y = row * ROW
    const id = `scene:${lane.id}`
    labels.push({ id, type: 'scene', position: canvas.moved[id] ?? { x: 0, y: y + 30 }, data: { lane }, selectable: false, deletable: false, connectable: false, width: 150, height: 60 })
    lane.stages.forEach((stage, index) => {
      if (removed.has(stage.id)) return
      const x = X0 + index * COL + (index >= lane.pictures ? WORDS_GAP : 0)
      steps.set(stage.id, { stage, lane, position: canvas.moved[stage.id] ?? { x, y } })
    })
  })
  for (const own of canvas.added) steps.set(own.id, { stage: ownStage(state, own), lane: null, position: canvas.moved[own.id] ?? { x: own.x, y: own.y } })

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
    else status = madeOf(id) ? (state.phase === 'plan' || state.phase === 'drafting' ? 'draft' : 'done') : 'new'
    statusOf.set(id, status)
  }

  const sparkWorks = agentDriving(state) && currentStep(state) !== null
  const nodes: CanvasNode[] = [...labels]
  for (const [id, { stage, lane, position }] of steps) {
    const status = statusOf.get(id)!
    // Spark's own step (not a node the user had made) is where its cursor goes.
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
        place: lane?.n ? lane.role : lane?.id === 'all' ? 'Tüm video' : '',
        status,
        made: madeOf(id),
        own: !lane,
        art: artOf(stage),
        said: into(id).find((source) => source.kind === 'text')?.text?.value,
        agent: spark ? `card-${lane.id}` : undefined,
      },
    })
  }

  const shows = (status?: NodeStatus) => status === 'done' || status === 'draft' || status === 'yours'
  const edges: ChainEdge[] = links.map((link) => ({
    id: link.id,
    source: link.source,
    target: link.target,
    type: 'chain',
    data: { passing: statusOf.get(link.target) === 'running' && shows(statusOf.get(link.source)) },
  }))
  const agentNode = nodes.find((node) => node.type === 'step' && node.data.agent)?.id ?? null
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

const nodeTypes = { step: StepNodeView, scene: SceneNodeView }
const edgeTypes = { chain: ChainEdgeView }

export function ChainBoard(props: { run: LabRun; scenes: LabScene[]; onAsk?: () => void }) {
  return (
    <ReactFlowProvider>
      <ChainCanvas {...props} />
    </ReactFlowProvider>
  )
}

type Adding = { from?: string; left: number; top: number; at: { x: number; y: number } }

function ChainCanvas({ run, scenes, onAsk }: { run: LabRun; scenes: LabScene[]; onAsk?: () => void }) {
  const { state } = run
  const flow = useReactFlow<CanvasNode, ChainEdge>()
  const wrap = React.useRef<HTMLDivElement>(null)
  const [drag, setDrag] = React.useState<Record<string, { x: number; y: number }>>({})
  const [selected, setSelected] = React.useState<string[]>([])
  const [selectedEdges, setSelectedEdges] = React.useState<string[]>([])
  const [tool, setTool] = React.useState<'hand' | 'select'>('hand')
  const [adding, setAdding] = React.useState<Adding | null>(null)

  const fraction = useStepFraction(state)
  const lanes = chainLanes(state, scenes)
  const statuses = stageStatuses(state, lanes, fraction)
  const graph = graphOf(state, lanes, statuses)
  const nodes = graph.nodes.map((node) => ({ ...node, position: drag[node.id] ?? node.position, selected: selected.includes(node.id) }) as CanvasNode)
  const edges = graph.edges.map((edge) => ({ ...edge, selected: selectedEdges.includes(edge.id) }))
  const picked = selected.filter((id) => graph.steps.has(id))
  const nameOf = (id: string) => {
    const node = graph.nodes.find((entry) => entry.id === id)
    return node?.type === 'step' ? [node.data.place, node.data.stage.title].filter(Boolean).join(' · ') : id
  }

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

  const make = (ids: string[]) =>
    run.canvas.run(ids.flatMap((id) => {
      const step = graph.steps.get(id)
      return step ? [{ id, ms: MAKE_MS[step.stage.kind] }] : []
    }))
  const pick = (ids: string[]) => {
    const steps = ids.filter((id) => graph.steps.has(id))
    if (steps.length) run.select({ targets: steps, labels: steps.map(nameOf), noun: 'düğüm', from: 'chain' })
    else if (state.selection?.from === 'chain') run.select(null)
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
      const at = { x: node.position.x + (node.width ?? 280) + 90, y: node.position.y }
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

  const onNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    const moving: Record<string, { x: number; y: number }> = {}
    let settled = false
    let nextSelected: string[] | null = null
    const removing: string[] = []
    for (const change of changes) {
      if (change.type === 'position') {
        if (change.position) moving[change.id] = change.position
        if (change.dragging === false) settled = true
      } else if (change.type === 'select') {
        const list: string[] = nextSelected ?? selected
        nextSelected = change.selected ? [...new Set([...list, change.id])] : list.filter((id) => id !== change.id)
      } else if (change.type === 'remove' && graph.steps.has(change.id)) {
        removing.push(change.id)
      }
    }
    if (Object.keys(moving).length || settled) {
      const all = { ...drag, ...moving }
      if (settled) {
        run.canvas.move(all)
        setDrag({})
      } else {
        setDrag(all)
      }
    }
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
    setAdding({ from: connection.fromNode.id, left: point.clientX - box.left, top: point.clientY - box.top, at: { x: at.x, y: at.y - 150 } })
  }
  const addHere = (left: number, top: number) => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box) return
    const at = flow.screenToFlowPosition({ x: box.left + left, y: box.top + top })
    setAdding({ left, top, at: { x: at.x - 140, y: at.y - 150 } })
  }
  const add = (kind: StageKind) => {
    if (!adding) return
    run.canvas.add(kind, Math.round(adding.at.x), Math.round(adding.at.y), adding.from)
    setAdding(null)
  }
  const closeAdding = React.useCallback(() => setAdding(null), [])

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
          onMove={remeasure}
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
          <MiniMap
            className="lb-cv-map"
            position="bottom-left"
            pannable
            zoomable
            nodeBorderRadius={6}
            nodeStrokeWidth={0}
            nodeClassName={(node) => (node.type === 'scene' ? 'lb-cv-map-scene' : 'lb-cv-map-node')}
          />
          {picked.length > 1 ? (
            <NodeToolbar nodeId={picked} isVisible position={Position.Top} offset={40} className="lb-cv-bar">
              <span className="lb-cv-bar-t">{picked.length} düğüm</span>
              <button type="button" onClick={() => make([...picked].sort((a, b) => (flow.getNode(a)?.position.x ?? 0) - (flow.getNode(b)?.position.x ?? 0)))}>
                <Icon name="play" size="sm" />
                Hepsini üret
              </button>
              <button type="button" onClick={() => api.ask(picked)} title="Spark’a sor: ne değişeceğini sohbete yaz">
                <Icon name="sparkles" size="sm" />
                Spark’a sor
              </button>
              <button type="button" onClick={() => {
                run.canvas.remove(picked)
                setSelected([])
              }} title="Sil" aria-label="Seçilenleri sil">
                <Trash2 aria-hidden />
              </button>
            </NodeToolbar>
          ) : null}
        </ReactFlow>

        {lanes.length ? null : <p className="lb-cv-hint"><span className="spin" />Spark planı yazıyor; sahneler yazıldıkça düğümleri burada belirir.</p>}

        <nav className="lb-cv-tools" aria-label="Tuval araçları">
          <button type="button" className="primary" onClick={() => addHere((wrap.current?.clientWidth ?? 800) / 2, (wrap.current?.clientHeight ?? 600) / 2)} title="Düğüm ekle" aria-label="Düğüm ekle">
            <Plus aria-hidden />
          </button>
          <i />
          <button type="button" className={tool === 'select' ? 'on' : ''} onClick={() => setTool('select')} title="Seç: sürükleyerek birden çok düğüm seç" aria-pressed={tool === 'select'}>
            <MousePointer2 aria-hidden />
          </button>
          <button type="button" className={tool === 'hand' ? 'on' : ''} onClick={() => setTool('hand')} title="El: sürükleyerek tuvalde gez" aria-pressed={tool === 'hand'}>
            <Hand aria-hidden />
          </button>
          <i />
          <button type="button" onClick={() => flow.fitView({ padding: 0.08, duration: 400 })} title="Hepsini göster">
            <Scan aria-hidden />
          </button>
          <button type="button" className={state.follow ? 'on spark' : ''} onClick={run.toggleFollow} title={state.follow ? 'Spark’ı izliyorsun' : 'Spark’ı izle'} aria-pressed={state.follow}>
            <Sparkles aria-hidden />
          </button>
        </nav>

        <Queue run={run} nameOf={nameOf} />

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

/** "Kuyruk": what is being made and what waits, from the canvas and from requests to Spark. */
function Queue({ run, nameOf }: { run: LabRun; nameOf: (id: string) => string }) {
  const { state } = run
  const [open, setOpen] = React.useState(false)
  const box = React.useRef<HTMLDivElement>(null)
  const close = React.useCallback(() => setOpen(false), [])
  useDismiss(open, box, close)
  const asked = state.applying === null ? [] : state.applyingLeft.filter((id) => id.includes('/'))
  const items = [...state.canvas.queue.map((job) => job.id), ...asked]
  const spark = state.phase === 'building' && agentDriving(state) ? currentStep(state) : null
  const active = items.length + (spark ? 1 : 0)
  return (
    <div className="lb-cv-queue" ref={box}>
      {open ? (
        <div className="lb-cv-menu queue" role="dialog" aria-label="Kuyruk">
          {spark ? <p className="row"><i className="lb-cv-spin" /><span><b>Spark</b>{spark.doing}</span></p> : null}
          {items.map((id, index) => (
            <p key={id} className="row">
              {index === 0 ? <i className="lb-cv-spin" /> : <i className="lb-cv-wait" />}
              <span><b>{nameOf(id)}</b>{index === 0 ? 'Üretiliyor' : 'Sırada'}</span>
            </p>
          ))}
          {!active ? <p className="empty">Şu an üretilen bir şey yok.</p> : null}
          {state.canvas.queue.length ? <button type="button" className="stop" onClick={run.canvas.stop}>Kuyruğu durdur</button> : null}
        </div>
      ) : null}
      <button type="button" className={`lb-cv-queue-btn${active ? ' live' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <b>Kuyruk</b>
        <span>{active} aktif</span>
        <ChevronRight aria-hidden />
      </button>
    </div>
  )
}

// ---- nodes ----------------------------------------------------------------------------------------------------

/** A scene's name at the start of its row: it moves on its own and holds nothing. */
function SceneNodeView({ data }: NodeProps<SceneNode>) {
  const { run } = useCanvas()
  const { lane } = data
  return (
    <div className="lb-cv-scene">
      {lane.n ? <span className="lb-plan-n">{lane.n}</span> : <span className="lb-plan-n all"><Icon name="scenes" size="sm" /></span>}
      <span className="lb-cv-scene-t">
        <b>{lane.role}</b>
        <small>
          {formatClock(lane.seconds)}
          {lane.scene ? <SceneDot status={sceneStatus(run.state, lane.id)} /> : null}
        </small>
      </span>
      {lane.scene ? <span className="nodrag"><LockButton run={run} scene={lane.scene} /></span> : null}
    </div>
  )
}

function StepNodeView({ id, data, selected }: NodeProps<StepNode>) {
  const api = useCanvas()
  const { stage, status } = data
  const kind = STAGE_KIND[stage.kind]
  const label = NODE_STATUS[status] || (data.made ? `v${data.own ? data.made : data.made + 1}` : '')
  return (
    <div
      className={`lb-cv-node k-${stage.kind} ${status}${selected ? ' selected' : ''}${data.agent ? ' lb-agent-on' : ''}`}
      {...(data.agent && { 'data-agent-target': data.agent })}
    >
      <header className="lb-cv-label">
        <Icon name={kind.icon} size="sm" />
        <span>{stage.title}</span>
        {data.place ? <small>{data.place}</small> : null}
        {label ? <em>{status === 'running' ? <i className="lb-cv-spin" /> : null}{label}</em> : null}
      </header>
      <Handle type="target" position={Position.Left} className="lb-cv-port in" />
      <div className="lb-cv-box">
        <Output data={data} />
        <Composer id={id} data={data} />
      </div>
      <Handle type="source" position={Position.Right} className="lb-cv-port out" onClick={() => api.addAfter(id)} title="Bağlı düğüm ekle (ya da sürükleyip bir düğüme bağla)">
        <Plus aria-hidden />
      </Handle>
      <NodeToolbar position={Position.Top} offset={34} className="lb-cv-bar">
        <button type="button" onClick={() => api.ask([id])} title="Spark’a sor: ne değişeceğini sohbete yaz">
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

/** What a node made: the picture or clip, the frame, the text, the sound, the cut. */
function Output({ data }: { data: StepData }) {
  const { run } = useCanvas()
  const { stage, status } = data
  const shown = status === 'done' || status === 'draft' || status === 'yours' || status === 'running' || data.made > 0
  const sketch = status === 'draft' || status === 'running' || status === 'queued' || status === 'writing'

  if (stage.id === 'all/cut') {
    return (
      <div className="lb-cv-out cut">
        {CUT_FRAMES.map((art, index) => (
          <span key={index} className="lb-cv-pic"><span className={`lb-thumb${shown && !sketch ? '' : ' sketch'}`}><span className={`lb-art ${art}`} /></span></span>
        ))}
      </div>
    )
  }
  if (stage.kind === 'text') return <TextOutput data={data} />
  if (stage.kind === 'voice' || stage.kind === 'music') {
    return (
      <div className={`lb-cv-out wave${shown ? '' : ' empty'}`}>
        <span className="lb-cv-bars">{waveOf(stage.id).map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</span>
        <small>
          {data.said ? <q>{data.said}</q> : <span>{stage.how}</span>}
          {stage.seconds ? <span>{formatClock(stage.seconds)}</span> : null}
        </small>
      </div>
    )
  }
  if (stage.kind === 'media') return <MediaOutput data={data} />
  const art = data.art
  return (
    <div className={`lb-cv-out${shown && art ? '' : ' empty'}`}>
      {shown && art ? (
        <span className="lb-cv-pic">
          <span className={`lb-thumb${sketch ? ' sketch' : ''}`}><span className={`lb-art ${art}`} /></span>
          {stage.kind === 'video' ? <span className="lb-cv-play"><Icon name="play" size="sm" /></span> : null}
          {stage.seconds ? <span className="lb-cv-tag">{formatClock(stage.seconds)}</span> : null}
          {stage.kind === 'frame' ? <span className="lb-cv-tag start">{(run.state.picks[`end:${stage.id}`] ?? 'last') === 'first' ? 'ilk kare' : 'son kare'}</span> : null}
        </span>
      ) : (
        <span className="lb-cv-empty">
          <Icon name={STAGE_KIND[stage.kind].icon} />
          {stage.kind === 'frame'
            ? art ? 'Bağlı klipten alınır · ↑' : 'Bir klibe bağla'
            : stage.kind === 'video'
              ? art ? 'Bağlı kareden başlar · ne olsun?' : 'Bir görsele ya da kareye bağla, ya da anlat'
              : 'Ne istediğini aşağıya yaz'}
        </span>
      )}
    </div>
  )
}

/** A text node's text: what Spark wrote, rewritten in place (a scene's line is Senaryo's too). */
function TextOutput({ data }: { data: StepData }) {
  const { run } = useCanvas()
  const text = data.stage.text
  const value = text?.value ?? ''
  const [draft, setDraft] = React.useState<string | null>(null)
  const keep = () => {
    if (draft !== null && text && draft.trim() !== value) run.edit(text.key, draft.trim())
    setDraft(null)
  }
  if (data.status === 'writing') return <div className="lb-cv-out text"><span className="lb-cv-lines"><i /><i /><i /></span></div>
  return (
    <div className="lb-cv-out text">
      <textarea
        className="nodrag nowheel"
        value={draft ?? value}
        placeholder="Kendin yaz ya da Spark yazsın"
        aria-label={`${data.stage.title}: metin`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={keep}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDraft(null)
        }}
      />
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
        <button type="button" className="lb-cv-drop nodrag" onClick={picker.open}>
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
 * The node's composer, the shared prompt box: what to do, with which model (or voice, or music), what it costs, and
 * the button that puts the node in the queue. A frame chooses its end instead; the user's media changes its file.
 */
function Composer({ id, data }: { id: string; data: StepData }) {
  const { run, make } = useCanvas()
  const { state } = run
  const { stage, status } = data
  const lane = id.includes('/') && !id.startsWith('own/') ? id.split('/')[0]! : null
  const choice = choiceOf(state, stage, lane)
  const brief = state.edits[stage.briefKey] ?? stage.brief
  const [draft, setDraft] = React.useState<string | null>(null)
  const [menu, setMenu] = React.useState(false)
  const box = React.useRef<HTMLDivElement>(null)
  const close = React.useCallback(() => setMenu(false), [setMenu])
  useDismiss(menu, box, close)
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
  const credits = choice?.credits ?? stage.credits
  const verb = data.made || status === 'done' || status === 'draft' ? 'Yeniden üret' : 'Üret'

  if (stage.kind === 'media') {
    return null
  }

  return (
    <div className="lb-cv-compose nodrag nowheel" ref={box}>
      {menu && choice ? (
        <div className="lb-cv-menu models" role="listbox" aria-label="Model">
          {choice.options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === choice.value}
              className={option.id === choice.value ? 'on' : ''}
              onClick={() => {
                run.pick(choice.pick, option.id)
                setMenu(false)
              }}
            >
              <span><b>{option.label}</b><small>{option.sub}</small></span>
              {option.id === choice.value ? <Icon name="check" size="sm" /> : null}
            </button>
          ))}
        </div>
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
            <PromptBoxSpacer />
            {credits ? <PromptBoxNote title={`${verb}: ≈ ${credits} kredi`}>{credits} kr</PromptBoxNote> : null}
            <PromptBoxSend type="button" label={verb} onClick={go} disabled={blocked} busy={status === 'running'} title={blocked ? 'Üretiliyor' : `${verb}${credits ? ` · ≈ ${credits} kredi` : ''}`} />
          </>
        )}
      >
        {stage.kind === 'frame' ? null : (
          <PromptBoxInput
            value={draft ?? brief}
            placeholder={stage.kind === 'text' ? 'Spark ne yazsın?' : stage.id === 'all/cut' ? 'Kurguda ne olsun?' : 'Ne yapsın?'}
            aria-label={`${stage.title}: ne yapsın`}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={keep}
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
