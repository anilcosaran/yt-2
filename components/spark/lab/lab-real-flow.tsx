'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'

import type { WorkflowCanvasProps } from '@/components/workflows/workflow-canvas'
import { ActiveChannelProvider, type ActiveChannelContextValue } from '@/lib/channel/active-channel'
import type { Workflow, WorkflowDefinitionEdge, WorkflowDefinitionNode, WorkflowRunStatus } from '@/lib/types'

import { LabOverlayContext } from './lab-context'
import { BRIEF, SCENES, SKILL, STEPS, TOTAL_SECONDS, assetById, formatClock, type LabScene } from './lab-model'
import { sceneFrameUrl } from './scene-frame'
import { currentStep, isAdded, projectTitle, sceneStatus, type LabRun, type LabRunState } from './use-lab-run'

// Plan view, "Akış": the plan on the real Flow canvas. This mounts the Flow editor's own component
// (`components/workflows/workflow-canvas.tsx`) with a workflow built from the plan, so the nodes, ports, edges,
// zoom dock and toolbelt are the Flow product's, not a drawing of them. The run reaches it the way a Flow run
// does: node statuses and the active node through the canvas props, node media through its field-change event.
// It is a board of the project, not a Flow inside it: the canvas comes without the Flow editor's top bar (back,
// Save, AI, Run), and the Plan's own approval bar ("Bu planla üret") starts the run.

// The canvas is client-only on the Flow page too.
const WorkflowCanvas = dynamic<WorkflowCanvasProps>(
  () => import('@/components/workflows/workflow-canvas').then((mod) => mod.WorkflowCanvas),
  { ssr: false, loading: () => <div className="lb-flow-loading">Flow tuvali açılıyor…</div> },
)

// The Flow canvas publishes node edits on this window event (`dispatchNodeFieldsChange` in workflow-canvas.tsx).
const NODE_FIELDS_EVENT = 'youtorch:workflow-node-fields-change'

// Outside the workspace shell there is no channel provider; the canvas only needs an id for its asset picker.
const LAB_CHANNEL: ActiveChannelContextValue = {
  channels: [],
  activeChannel: null,
  activeChannelId: 'spark-lab',
  workspaceReady: true,
  setActiveChannelId: () => undefined,
  isLoading: false,
  error: null,
  refreshChannels: async () => undefined,
}

const sceneNode = (scene: LabScene) => `scene-${scene.id}`

/** The frame a scene shows right now: dimmed while it is only planned, with the layers placed so far. */
function frameOf(state: LabRunState, scene: LabScene) {
  const built = isAdded(state, `${scene.id}:media`)
  const placed = scene.layers
    .filter((layer) => (STEPS.some((step) => step.adds === `${scene.id}:${layer.key}`) ? isAdded(state, `${scene.id}:${layer.key}`) : built))
    .map((layer) => layer.key)
  return { url: sceneFrameUrl(scene, state.ratio, built, placed), key: `${scene.id}:${built ? 1 : 0}:${placed.join('+')}` }
}

/** Two staggered columns of scene nodes keep five branches apart at the canvas's node size (344 × 440). */
const COLUMN = { brief: 0, script: 430, sceneA: 860, sceneB: 1290, compose: 1730, preview: 2160 }
const ROW = 236

/**
 * The plan as a Flow workflow, with the canvas's own node kinds: the brief (prompt input) feeds the script, the
 * script and one media node per scene feed the edit (render), the edit feeds the preview.
 */
function planWorkflow(state: LabRunState, title: string): Workflow {
  const message = BRIEF.find((field) => field.id === 'message')?.value ?? ''
  const middle = ((SCENES.length - 1) * ROW) / 2
  const base = { provider: 'Spark', status: 'never' as WorkflowRunStatus, description: '' }

  const scenes: WorkflowDefinitionNode[] = SCENES.map((scene, index) => {
    const asset = assetById(scene.assetId)
    const frame = frameOf(state, scene).url
    return {
      ...base,
      id: sceneNode(scene),
      title: `${scene.n} · ${scene.role}`,
      subtitle: `${scene.end - scene.start} sn`,
      kind: 'input',
      description: scene.narration,
      position: { x: index % 2 ? COLUMN.sceneB : COLUMN.sceneA, y: index * ROW },
      inputPorts: [],
      outputPorts: [{ id: 'image', label: 'Sahne', type: 'image' }],
      settings: {
        helper_input: 'image',
        helper_preview_url: frame,
        helper_value: frame,
        helper_file_name: asset ? `${asset.id} · ${asset.title}` : 'Brand Kit · metin',
      },
    }
  })

  const nodes: WorkflowDefinitionNode[] = [
    {
      ...base,
      id: 'brief',
      title: 'Brief',
      subtitle: 'Tek cümle',
      kind: 'input',
      description: message,
      position: { x: COLUMN.brief, y: middle + 117 },
      inputPorts: [],
      outputPorts: [{ id: 'prompt', label: 'Brief', type: 'string' }],
      settings: { helper_input: 'prompt', helper_value: state.prompt },
    },
    {
      ...base,
      id: 'script',
      title: 'Senaryo ve plan',
      subtitle: SKILL.name,
      kind: 'ai',
      description: message,
      position: { x: COLUMN.script, y: middle + 79 },
      inputPorts: [{ id: 'brief', label: 'Brief', type: 'string' }],
      outputPorts: [{ id: 'plan', label: 'Plan', type: 'string' }],
      settings: { node_type: 'llm@1' },
    },
    ...scenes,
    {
      ...base,
      id: 'compose',
      title: 'Kurgu · Spark',
      subtitle: `${formatClock(TOTAL_SECONDS)} · ${state.ratio}`,
      kind: 'render',
      position: { x: COLUMN.compose, y: middle + 12 },
      inputPorts: [{ id: 'plan', label: 'Plan', type: 'string' as const }, ...SCENES.map((scene) => ({ id: scene.id, label: `Sahne ${scene.n}`, type: 'image' as const }))],
      outputPorts: [{ id: 'video', label: 'Video', type: 'video' }],
    },
    {
      ...base,
      id: 'preview',
      title: 'Önizleme',
      subtitle: title,
      kind: 'render',
      position: { x: COLUMN.preview, y: middle + 143 },
      inputPorts: [{ id: 'video', label: 'Video', type: 'video' }],
      outputPorts: [],
      settings: { helper_preview: true },
    },
  ]

  const edge = (source: string, sourcePort: string, target: string, targetInput: string): WorkflowDefinitionEdge => ({
    id: `${source}:${sourcePort}→${target}:${targetInput}`,
    source,
    target,
    sourcePort,
    targetInput,
  })
  const edges = [
    edge('brief', 'prompt', 'script', 'brief'),
    edge('script', 'plan', 'compose', 'plan'),
    ...SCENES.map((scene) => edge(sceneNode(scene), 'image', 'compose', scene.id)),
    edge('compose', 'video', 'preview', 'video'),
  ]

  return {
    id: `spark-lab-plan-${state.ratio}`,
    name: title,
    description: message,
    channel: 'Yt-2 Studio',
    owner: 'Spark',
    status: 'draft',
    triggerType: 'manual',
    triggerLabel: 'Manuel',
    schedule: '',
    lastRunAt: '',
    lastRunStatus: 'never',
    nextRunAt: '',
    runCount24h: 0,
    averageCost: '',
    successRate: 0,
    nodesCount: nodes.length,
    updatedAt: '',
    metrics: [],
    nodes,
    edges,
  }
}

/** What a Flow run reports per node, read from the agent's run. */
function runtimeOf(state: LabRunState) {
  const planned = state.phase !== 'empty' && state.phase !== 'drafting'
  const step = currentStep(state)
  const statuses: Record<string, WorkflowRunStatus> = { brief: 'success', script: planned ? 'success' : 'running' }
  for (const scene of SCENES) {
    const status = sceneStatus(state, scene.id)
    statuses[sceneNode(scene)] = status === 'ready' ? 'success' : status === 'yours' ? 'warning' : step?.sceneId === scene.id ? 'running' : 'never'
  }
  if (step && !step.sceneId) statuses.compose = 'running'
  if (state.phase === 'done') Object.assign(statuses, { compose: 'success', preview: 'success' })
  const working = state.phase === 'drafting' ? 'script' : step ? (step.sceneId ? `scene-${step.sceneId}` : 'compose') : null
  return { statuses, active: state.paused || state.driver === 'user' ? null : working, key: JSON.stringify(statuses) }
}

type Box = { left: number; top: number; width: number; height: number }

export function RealFlowBoard({ run, onBack }: { run: LabRun; onBack: () => void }) {
  const { state } = run
  const overlay = React.useContext(LabOverlayContext)
  const slot = React.useRef<HTMLDivElement>(null)
  const [box, setBox] = React.useState<Box | null>(null)
  // Built once: afterwards the run reaches the canvas through its runtime props and its field event, like a Flow run.
  const [workflow] = React.useState(() => planWorkflow(state, projectTitle(run)))

  React.useEffect(() => {
    const element = slot.current
    if (!element) return
    // The box is the slot's place in the overlay, which covers the workspace: the window when the workspace is
    // full-screen, the page panel when it is a tab in the shell.
    const measure = () => {
      const rect = element.getBoundingClientRect()
      const origin = overlay?.getBoundingClientRect()
      setBox({ left: rect.left - (origin?.left ?? 0), top: rect.top - (origin?.top ?? 0), width: rect.width, height: rect.height })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (overlay) observer.observe(overlay)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [overlay])

  const runtime = runtimeOf(state)
  const statuses = React.useMemo(() => JSON.parse(runtime.key) as Record<string, WorkflowRunStatus>, [runtime.key])

  const frames = SCENES.map((scene) => ({ node: sceneNode(scene), ...frameOf(state, scene) }))
  const shown = state.phase === 'done' ? frames[frames.length - 2] : undefined
  const frameKey = `${frames.map((frame) => frame.key).join('|')}|${shown?.key ?? ''}`
  const pending = React.useRef(frames)
  React.useEffect(() => {
    pending.current = frames
  })
  React.useEffect(() => {
    const push = () => {
      const patch = (nodeId: string, url: string) =>
        window.dispatchEvent(new CustomEvent(NODE_FIELDS_EVENT, { detail: { nodeId, patch: { settings: { helper_preview_url: url, helper_value: url } } } }))
      pending.current.forEach((frame) => patch(frame.node, frame.url))
      patch('preview', state.phase === 'done' ? (pending.current[pending.current.length - 2]?.url ?? '') : '')
    }
    push()
    // The canvas loads lazily: a frame that changed before it mounted is sent again once it is there.
    const late = window.setTimeout(push, 1500)
    return () => window.clearTimeout(late)
  }, [frameKey, state.phase])

  return (
    <>
      <div className="lb-b-board lb-flow-slot" ref={slot} />
      {overlay && box
        ? createPortal(
            <div className="lb-flow-host workflow-flow-surface" style={box}>
              <ActiveChannelProvider value={LAB_CHANNEL}>
                <WorkflowCanvas
                  workflow={workflow}
                  onBack={onBack}
                  chrome="embedded"
                  runtimeNodeStatuses={statuses}
                  runtimeActiveNodeId={runtime.active}
                />
              </ActiveChannelProvider>
            </div>,
            overlay,
          )
        : null}
    </>
  )
}
