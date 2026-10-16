import type { Edge, Node, Viewport, XYPosition } from '@xyflow/react'
import {
  AudioLines,
  Clapperboard,
  FileText,
  ImageIcon,
  Link2,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'

/**
 * Canvas: a free board of cards. Every card works on its own — it holds what you asked for, runs it, and keeps what
 * came back on the card — so there is no flow to run end to end. Lines between cards are only marks the user draws
 * ("this belongs to that"); nothing travels along them.
 */

export const CANVAS_WORK_KINDS = ['text', 'image', 'video', 'voice', 'link'] as const
export type CanvasWorkKind = (typeof CANVAS_WORK_KINDS)[number]
export type CanvasNodeKind = CanvasWorkKind | 'note'
export const CANVAS_NODE_KINDS: readonly CanvasNodeKind[] = [...CANVAS_WORK_KINDS, 'note']

export const CANVAS_COLORS = ['slate', 'blue', 'violet', 'green', 'amber', 'rose'] as const
export type CanvasColor = (typeof CANVAS_COLORS)[number]

export type CanvasNodeStatus = 'idle' | 'running' | 'done' | 'error'
export type CanvasErrorCode = 'invalidUrl' | 'interrupted'

export type CanvasOptionSpec = {
  id: string
  values: readonly string[]
  fallback: string
}

export type CanvasKindSpec = {
  icon: LucideIcon
  color: CanvasColor
  /** Settings shown as chips under the card's prompt; labels live in `Canvas.options`. */
  options: readonly CanvasOptionSpec[]
  /** How long the (simulated) run takes. */
  runMs: number
}

export const CANVAS_KINDS: Record<CanvasNodeKind, CanvasKindSpec> = {
  text: {
    icon: FileText,
    color: 'blue',
    options: [
      { id: 'format', values: ['free', 'script', 'titles', 'description'], fallback: 'free' },
      { id: 'length', values: ['short', 'medium', 'long'], fallback: 'medium' },
    ],
    runMs: 1800,
  },
  image: {
    icon: ImageIcon,
    color: 'violet',
    options: [
      { id: 'ratio', values: ['landscape', 'square', 'portrait'], fallback: 'landscape' },
      { id: 'count', values: ['1', '2', '4'], fallback: '2' },
    ],
    runMs: 2600,
  },
  video: {
    icon: Clapperboard,
    color: 'rose',
    options: [
      { id: 'ratio', values: ['landscape', 'portrait'], fallback: 'landscape' },
      { id: 'duration', values: ['5', '10'], fallback: '5' },
    ],
    runMs: 4200,
  },
  voice: {
    icon: AudioLines,
    color: 'green',
    options: [
      { id: 'voice', values: ['deniz', 'ece', 'mert'], fallback: 'deniz' },
      { id: 'speed', values: ['slow', 'normal', 'fast'], fallback: 'normal' },
    ],
    runMs: 2000,
  },
  link: {
    icon: Link2,
    color: 'amber',
    options: [],
    runMs: 2200,
  },
  note: {
    icon: StickyNote,
    color: 'amber',
    options: [],
    runMs: 0,
  },
}

type ResultBase = { id: string; at: number; input: string }

export type CanvasResult =
  | (ResultBase & { type: 'text'; text: string })
  | (ResultBase & { type: 'images'; images: string[]; ratio: string })
  | (ResultBase & { type: 'video'; poster: string; seconds: number; ratio: string })
  | (ResultBase & { type: 'audio'; seconds: number; voice: string; script: string })
  | (ResultBase & { type: 'link'; url: string; host: string; title: string; summary: string; points: string[] })

/** At most this many results stay on a card; the newest is shown. */
export const CANVAS_RESULT_LIMIT = 6

export type CanvasNodeData = {
  kind: CanvasNodeKind
  title: string
  color: CanvasColor
  /** What the card works from: the prompt, the link, or the note's text. */
  input: string
  options: Record<string, string>
  status: CanvasNodeStatus
  error?: CanvasErrorCode
  /** Newest first. */
  results: CanvasResult[]
  /** The result shown on the card (index into `results`). */
  shown: number
  updatedAt: number
}

export type CanvasNodeType = 'work' | 'note'
export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>
export type CanvasEdge = Edge

export type CanvasBoard = {
  id: string
  title: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport?: Viewport
  createdAt: number
  updatedAt: number
}

export const WORK_NODE_WIDTH = 296
export const NOTE_DEFAULT_SIZE = { width: 220, height: 180 }
export const NOTE_MIN_SIZE = { width: 160, height: 110 }

export function canvasId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

export function isWorkKind(kind: CanvasNodeKind): kind is CanvasWorkKind {
  return kind !== 'note'
}

export function optionValue(data: Pick<CanvasNodeData, 'kind' | 'options'>, optionId: string) {
  const spec = CANVAS_KINDS[data.kind].options.find((option) => option.id === optionId)
  const value = data.options[optionId]
  if (!spec) return value ?? ''
  return value && spec.values.includes(value) ? value : spec.fallback
}

export function createCanvasNode(kind: CanvasNodeKind, position: XYPosition, patch: Partial<CanvasNodeData> = {}): CanvasNode {
  const spec = CANVAS_KINDS[kind]
  const data: CanvasNodeData = {
    kind,
    title: '',
    color: spec.color,
    input: '',
    options: Object.fromEntries(spec.options.map((option) => [option.id, option.fallback])),
    status: 'idle',
    results: [],
    shown: 0,
    updatedAt: Date.now(),
    ...patch,
  }
  if (kind === 'note') {
    return {
      id: canvasId('note'),
      type: 'note',
      position,
      data,
      width: NOTE_DEFAULT_SIZE.width,
      height: NOTE_DEFAULT_SIZE.height,
    }
  }
  return { id: canvasId('card'), type: 'work', position, data }
}

export function createCanvasBoard(title = ''): CanvasBoard {
  const now = Date.now()
  return { id: canvasId('canvas'), title, nodes: [], edges: [], createdAt: now, updatedAt: now }
}

/** The card's own size before it is measured, so a new card can be centred on a point. */
export function canvasNodeFootprint(kind: CanvasNodeKind) {
  return kind === 'note' ? NOTE_DEFAULT_SIZE : { width: WORK_NODE_WIDTH, height: 200 }
}

export function shownResult(data: CanvasNodeData): CanvasResult | null {
  return data.results[Math.min(Math.max(data.shown, 0), data.results.length - 1)] ?? null
}

export function hostOf(url: string) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function normalizeUrl(url: string) {
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
