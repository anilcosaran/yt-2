import type {
  Workflow,
  WorkflowDefinitionEdge,
  WorkflowDefinitionNode,
  WorkflowNodePort,
  WorkflowNodePortType,
  WorkflowRunStatus,
  WorkflowStatus,
} from '@/lib/types'
import {
  getWorkflowNodeDescription,
  getWorkflowNodeProvider,
  getWorkflowNodeSubtitle,
  getWorkflowNodeTitle,
  humanizeNodeType,
} from '@/lib/workflows/node-display'

export type AssistantWorkflowDraftStatus =
  | 'drafting'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'correction_requested'
  | 'executed'
  | 'superseded'

export type WorkflowDraftPreviewSource = {
  id: string
  approvalTargetHash?: string | null
  goal: string
  status: AssistantWorkflowDraftStatus | string
  plannedSteps?: unknown[]
  missingSlots?: unknown[]
  dslJson: Record<string, unknown>
  estimateJson?: Record<string, unknown>
  providerStrategy?: string | null
}

type DslNode = {
  uid: string
  type: string
  alias?: string
  inputs: Record<string, unknown>
  index: number
  raw: Record<string, unknown>
}

type DslWire = {
  from: string
  to: string
  port: string
  input: string
}

export function workflowFromAssistantDraft(source: WorkflowDraftPreviewSource): Workflow {
  const dslId = getString(source.dslJson.id) ?? source.id
  const dslNodes = readDslNodes(source.dslJson)
  const nodesSource = dslNodes.length > 0 ? dslNodes : readPlannedStepNodes(source.plannedSteps)
  const wires = dslNodes.length > 0 ? readDslWires(source.dslJson) : buildSequentialWires(nodesSource)
  const inputMap = buildWireLabelMap(wires, 'to', 'input')
  const outputMap = buildWireLabelMap(wires, 'from', 'port')
  const nodes = nodesSource.map((node, index) => mapDslNode({
    node,
    index,
    inputMap,
    outputMap,
    estimateJson: source.estimateJson ?? {},
  }))

  const edges: WorkflowDefinitionEdge[] = wires.map((wire, index) => ({
    id: `wire-${index}-${wire.from}-${wire.to}`,
    source: wire.from,
    target: wire.to,
    sourceHandle: `output:${normalizePortName(wire.port)}`,
    targetHandle: `input:${normalizePortName(wire.input)}`,
    sourcePort: normalizePortName(wire.port),
    targetInput: normalizePortName(wire.input),
    label: `${wire.port}->${wire.input}`,
  }))

  const averageCost = formatCreditCost(totalEstimatedCredits(source.estimateJson ?? {}, nodes))
  const status = mapDraftStatus(source.status)
  const providerStrategyLabel = publicProviderStrategyLabel(source.providerStrategy)
  return {
    id: source.id || dslId,
    name: source.goal || humanizeToken(dslId),
    description: describeDraft(source, nodes.length),
    channel: 'Chat draft',
    owner: 'Youtorch',
    status,
    triggerType: 'manual',
    triggerLabel: providerStrategyLabel ?? 'Manual start',
    schedule: 'Not scheduled',
    lastRunAt: status === 'active' ? 'Recently started' : 'Never run',
    lastRunStatus: mapDraftRunStatus(source.status),
    nextRunAt: status === 'draft' ? 'Draft' : 'On demand',
    runCount24h: 0,
    averageCost,
    successRate: status === 'failed' ? 0 : 100,
    nodesCount: nodes.length,
    updatedAt: 'Now',
    metrics: [
      { label: 'Nodes', value: String(nodes.length), tone: 'info' },
      { label: 'Cost', value: averageCost },
      { label: 'Status', value: humanizeToken(String(source.status)) },
    ],
    nodes,
    edges,
  }
}

function mapDslNode(input: {
  node: DslNode
  index: number
  inputMap: Map<string, string[]>
  outputMap: Map<string, string[]>
  estimateJson: Record<string, unknown>
}): WorkflowDefinitionNode {
  const { node, index, inputMap, outputMap, estimateJson } = input
  const kind = nodeTypeToKind(node.type)
  return {
    id: node.uid,
    title: getWorkflowNodeTitle(node.type, node.alias ?? getString(node.inputs.title)),
    subtitle: getWorkflowNodeSubtitle(node.type),
    kind,
    provider: inferProvider(node.type),
    status: 'never',
    cost: formatCreditCost(estimatedNodeCredits(estimateJson, node.uid)),
    description: describeNode(node),
    position: readNodePosition(node, index),
    inputs: (inputMap.get(node.uid) ?? ['input']).map(normalizePortName),
    outputs: (outputMap.get(node.uid) ?? ['output']).map(normalizePortName),
    inputPorts: toWorkflowPorts(inputMap.get(node.uid) ?? ['input'], 'input'),
    outputPorts: toWorkflowPorts(outputMap.get(node.uid) ?? ['output'], 'output'),
  }
}

function readDslNodes(dslJson: Record<string, unknown>): DslNode[] {
  const rawNodes = Array.isArray(dslJson.nodes) ? dslJson.nodes : []
  return rawNodes
    .map((value, index) => {
      const raw = readRecord(value)
      const uid = getString(raw.uid) ?? getString(raw.id) ?? `node-${index + 1}`
      const type = getString(raw.type) ?? 'workflow.node'
      return {
        uid,
        type,
        alias: getString(raw.alias) ?? getString(raw.label) ?? undefined,
        inputs: readRecord(raw.inputs),
        index: getNumber(raw.index) ?? index,
        raw,
      }
    })
    .sort((a, b) => a.index - b.index)
}

function readPlannedStepNodes(plannedSteps: unknown[] | undefined): DslNode[] {
  if (!Array.isArray(plannedSteps)) return []
  return plannedSteps.map((value, index) => {
    const raw = readRecord(value)
    const title = getString(raw.title)
      ?? getString(raw.name)
      ?? getString(raw.label)
      ?? getString(raw.step)
      ?? getString(raw.description)
      ?? (typeof value === 'string' ? value : null)
      ?? `Step ${index + 1}`
    const description = getString(raw.description)
      ?? getString(raw.prompt)
      ?? getString(raw.task)
      ?? getString(raw.summary)
      ?? title
    const type = getString(raw.type)
      ?? getString(raw.kind)
      ?? inferPlannedStepType(`${title} ${description}`)
    return {
      uid: getString(raw.uid) ?? getString(raw.id) ?? `planned-step-${index + 1}`,
      type,
      alias: title,
      inputs: {
        ...raw,
        title,
        description,
      },
      index,
      raw,
    }
  })
}

function buildSequentialWires(nodes: DslNode[]): DslWire[] {
  return nodes.slice(1).map((node, index) => ({
    from: nodes[index]?.uid ?? '',
    to: node.uid,
    port: 'output',
    input: 'input',
  })).filter((wire) => wire.from && wire.to)
}

function inferPlannedStepType(value: string) {
  const normalized = normalize(value)
  if (/(trigger|input|brief|request|başlat|baslat)/.test(normalized)) return 'workflow.trigger'
  if (/(render|video|clip|short|reel|edit)/.test(normalized)) return 'video.render'
  if (/(publish|upload|schedule|post|youtube)/.test(normalized)) return 'youtube.publish'
  if (/(branch|condition|approval|review|onay|kontrol)/.test(normalized)) return 'logic.review'
  if (/(analytics|metric|watch|izle|rapor)/.test(normalized)) return 'analytics.watch'
  return 'ai.step'
}

function readDslWires(dslJson: Record<string, unknown>): DslWire[] {
  const rawWires = Array.isArray(dslJson.wires) ? dslJson.wires : []
  return rawWires.map((value) => {
    const raw = readRecord(value)
    return {
      from: getString(raw.from) ?? '',
      to: getString(raw.to) ?? '',
      port: getString(raw.port) ?? 'output',
      input: getString(raw.input) ?? 'input',
    }
  }).filter((wire) => wire.from && wire.to)
}

function buildWireLabelMap(wires: DslWire[], key: 'from' | 'to', label: 'port' | 'input') {
  const map = new Map<string, string[]>()
  for (const wire of wires) {
    const current = map.get(wire[key]) ?? []
    if (!current.includes(wire[label])) current.push(wire[label])
    map.set(wire[key], current)
  }
  return map
}

function nodeTypeToKind(type: string): WorkflowDefinitionNode['kind'] {
  const normalized = normalize(type)
  if (/(trigger|input|webhook|youtube)/.test(normalized)) return 'trigger'
  if (/(image_generate|image.generate)/.test(normalized)) return 'image'
  if (/(render|video|ffmpeg|caption|transform|clip|magic)/.test(normalized)) return 'render'
  if (/(publish|upload|schedule|post)/.test(normalized)) return 'publish'
  if (/(router|branch|condition|gate|review|approval)/.test(normalized)) return 'logic'
  if (/(analytics|metric|watch|retention|ctr)/.test(normalized)) return 'analytics'
  if (/(llm|ai|prompt|script|gpt|veo)/.test(normalized)) return 'ai'
  return 'provider'
}

function inferProvider(type: string) {
  return getWorkflowNodeProvider(type)
}

function toWorkflowPorts(values: string[], direction: 'input' | 'output'): WorkflowNodePort[] {
  return values.map((value) => {
    const id = normalizePortName(value)
    return {
      id,
      label: humanizeToken(id),
      type: inferPortType(id, direction),
    }
  })
}

function normalizePortName(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLocaleLowerCase('en-US') || 'port'
}

function inferPortType(value: string, direction: 'input' | 'output'): WorkflowNodePortType {
  const normalized = normalize(value)
  if (normalized.includes('image') || normalized.includes('thumbnail')) return 'image'
  if (normalized.includes('video') || normalized.includes('mp4')) return 'video'
  if (normalized.includes('audio')) return 'audio'
  if (normalized.includes('count') || normalized.includes('width') || normalized.includes('height')) return 'integer'
  if (normalized.includes('duration') || normalized.includes('score')) return 'float'
  if (normalized.includes('enabled') || normalized.includes('flag')) return 'boolean'
  if (normalized.includes('transcript')) return 'transcript'
  if (normalized.includes('segments')) return 'segments'
  if (normalized.includes('metadata') || normalized.includes('json')) return 'dict'
  if (normalized.includes('list') || normalized.includes('items') || normalized.includes('variants')) return 'list'
  return direction === 'output' ? 'any' : 'string'
}

function readNodePosition(node: DslNode, index: number) {
  const position = readRecord(node.raw.position)
  const inputPosition = readRecord(node.inputs.position)
  const x = getNumber(position.x) ?? getNumber(inputPosition.x)
  const y = getNumber(position.y) ?? getNumber(inputPosition.y)
  if (x !== null && y !== null) return { x, y }
  const row = Math.floor(index / 4)
  const column = index % 4
  return {
    x: 80 + column * 340,
    y: 140 + row * 190,
  }
}

function describeDraft(source: WorkflowDraftPreviewSource, nodeCount: number) {
  const missingSlots = source.missingSlots?.length ?? 0
  if (missingSlots > 0) return `${nodeCount} node draft with ${missingSlots} missing slot.`
  if (source.plannedSteps?.length) return `${source.plannedSteps.length} planned step workflow draft.`
  return `${nodeCount} node workflow draft.`
}

function describeNode(node: DslNode) {
  return getWorkflowNodeDescription(
    node.type,
    getString(node.inputs.description)
    ?? getString(node.inputs.prompt)
    ?? getString(node.inputs.task)
    ?? getString(node.inputs.goal),
  )
}

function mapDraftStatus(status: string): WorkflowStatus {
  if (status === 'executed' || status === 'approved') return 'active'
  if (status === 'rejected' || status === 'correction_requested' || status === 'superseded') return 'paused'
  return 'draft'
}

function mapDraftRunStatus(status: string): WorkflowRunStatus {
  if (status === 'executed' || status === 'approved') return 'running'
  if (status === 'rejected') return 'failed'
  return 'never'
}

function estimatedNodeCredits(estimateJson: Record<string, unknown>, nodeId: string) {
  const nodes = Array.isArray(estimateJson.nodes) ? estimateJson.nodes : []
  for (const value of nodes) {
    const node = readRecord(value)
    const key = getString(node.node_key) ?? getString(node.nodeKey) ?? getString(node.uid)
    if (key !== nodeId) continue
    return getNumber(node.estimated_credits) ?? getNumber(node.estimatedCredits) ?? 0
  }
  return 0
}

function totalEstimatedCredits(estimateJson: Record<string, unknown>, nodes: WorkflowDefinitionNode[]) {
  return getNumber(estimateJson.total_credits_estimated)
    ?? getNumber(estimateJson.totalCreditsEstimated)
    ?? nodes.reduce((total, node) => total + Number.parseFloat(node.cost ?? '0'), 0)
}

function formatCreditCost(value: number | null) {
  const credits = Math.max(0, Math.round(value ?? 0))
  return `${credits}c`
}

function humanizeToken(value: string) {
  return humanizeNodeType(value)
}

function publicProviderStrategyLabel(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase('en-US')
  if (
    normalized !== 'cheap' &&
    normalized !== 'fast' &&
    normalized !== 'balanced' &&
    normalized !== 'quality'
  ) {
    return null
  }
  return `${humanizeToken(normalized)} strategy`
}

function normalize(value: string) {
  return value.toLocaleLowerCase('en-US')
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
