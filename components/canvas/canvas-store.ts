'use client'

// Canvas boards (yt-2 mock): kept in this browser (localStorage), written a moment after the last change. A card's
// run is simulated with a timer; what it makes comes from `canvas-mock.ts`.

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
  type XYPosition,
} from '@xyflow/react'
import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'

import {
  CANVAS_KINDS,
  CANVAS_RESULT_LIMIT,
  canvasId,
  createCanvasBoard,
  createCanvasNode,
  isWorkKind,
  type CanvasBoard,
  type CanvasEdge,
  type CanvasErrorCode,
  type CanvasNode,
  type CanvasNodeData,
  type CanvasNodeKind,
  type CanvasResult,
} from './canvas-model'

type Snapshot = { nodes: CanvasNode[]; edges: CanvasEdge[] }
type History = { past: Snapshot[]; future: Snapshot[]; pending: Snapshot | null }

/** What a finished run made, from the card as it was when the run started. */
export type CanvasRunProducer = (
  data: CanvasNodeData,
  base: { id: string; at: number; input: string },
) => CanvasResult | { error: CanvasErrorCode }

type CanvasState = {
  boards: Record<string, CanvasBoard>
  /** Oldest first. */
  order: string[]
  lastBoardId: string | null
  /** Per board; not saved. */
  history: Record<string, History>
  clipboard: Snapshot | null

  createBoard: (title?: string) => string
  renameBoard: (boardId: string, title: string) => void
  /** Returns the board to open instead (a new empty one when it was the last). */
  deleteBoard: (boardId: string) => string
  openBoard: (boardId: string) => void
  setViewport: (boardId: string, viewport: Viewport) => void

  onNodesChange: (boardId: string, changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (boardId: string, changes: EdgeChange<CanvasEdge>[]) => void
  connect: (boardId: string, connection: Connection) => void
  addNode: (boardId: string, kind: CanvasNodeKind, position: XYPosition, patch?: Partial<CanvasNodeData>) => string
  /** A change the user makes in one go (colour, title): one step of undo. */
  editNode: (boardId: string, nodeId: string, patch: Partial<CanvasNodeData>) => void
  /** Typing and runs: no undo step of its own (the edit session around it makes one). */
  updateNodeData: (boardId: string, nodeId: string, patch: Partial<CanvasNodeData>) => void
  removeElements: (boardId: string, nodeIds: string[], edgeIds?: string[]) => void
  duplicateNodes: (boardId: string, nodeIds: string[]) => void
  copyNodes: (boardId: string, nodeIds: string[]) => void
  pasteNodes: (boardId: string, at?: XYPosition) => void
  selectNodes: (boardId: string, nodeIds: string[] | 'all') => void
  replaceContent: (boardId: string, nodes: CanvasNode[], edges: CanvasEdge[]) => void

  /** A drag, a resize or an edit session starts: the board as it is now becomes one undo step if anything changes. */
  beginChange: (boardId: string) => void
  endChange: (boardId: string) => void
  undo: (boardId: string) => void
  redo: (boardId: string) => void

  runNode: (boardId: string, nodeId: string, produce: CanvasRunProducer) => void
  stopNode: (boardId: string, nodeId: string) => void
}

type SavedState = Pick<CanvasState, 'boards' | 'order' | 'lastBoardId'>

const STORAGE_KEY = 'yt2.canvas.v1'
const SAVE_DELAY_MS = 400
const HISTORY_LIMIT = 60
const PASTE_OFFSET = 32
const EMPTY_HISTORY: History = { past: [], future: [], pending: null }

/** Runs on their way, by `board:node`. */
const liveRuns = new Map<string, ReturnType<typeof setTimeout>>()
const runKey = (boardId: string, nodeId: string) => `${boardId}:${nodeId}`

/** Whether the board is being written; the top bar shows it. */
export const useCanvasSaveState = create<{ saving: boolean }>(() => ({ saving: false }))

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => {
      const board = (boardId: string) => get().boards[boardId]

      const writeBoard = (boardId: string, patch: Partial<CanvasBoard> | ((current: CanvasBoard) => Partial<CanvasBoard>), touch = true) => {
        set((state) => {
          const current = state.boards[boardId]
          if (!current) return state
          const next = typeof patch === 'function' ? patch(current) : patch
          return {
            boards: {
              ...state.boards,
              [boardId]: { ...current, ...next, ...(touch ? { updatedAt: Date.now() } : null) },
            },
          }
        })
      }

      const historyOf = (boardId: string) => get().history[boardId] ?? EMPTY_HISTORY
      const writeHistory = (boardId: string, next: History) => {
        set((state) => ({ history: { ...state.history, [boardId]: next } }))
      }
      const snapshot = (boardId: string): Snapshot | null => {
        const current = board(boardId)
        return current ? { nodes: current.nodes, edges: current.edges } : null
      }
      /** The board as it is now becomes one undo step. */
      const record = (boardId: string) => {
        const current = snapshot(boardId)
        if (!current) return
        const history = historyOf(boardId)
        writeHistory(boardId, { past: [...history.past, current].slice(-HISTORY_LIMIT), future: [], pending: history.pending })
      }
      const restore = (boardId: string, target: Snapshot) => {
        writeBoard(boardId, { nodes: settleRuns(boardId, target.nodes), edges: target.edges })
      }

      const patchNode = (boardId: string, nodeId: string, patch: Partial<CanvasNodeData>) => {
        writeBoard(boardId, (current) => ({
          nodes: current.nodes.map((node) => (node.id === nodeId
            ? { ...node, data: { ...node.data, ...patch, updatedAt: Date.now() } }
            : node)),
        }))
      }

      const firstBoard = createCanvasBoard()

      return {
        boards: { [firstBoard.id]: firstBoard },
        order: [firstBoard.id],
        lastBoardId: firstBoard.id,
        history: {},
        clipboard: null,

        createBoard: (title = '') => {
          const next = createCanvasBoard(title)
          set((state) => ({
            boards: { ...state.boards, [next.id]: next },
            order: [...state.order, next.id],
            lastBoardId: next.id,
          }))
          return next.id
        },

        renameBoard: (boardId, title) => writeBoard(boardId, { title }),

        deleteBoard: (boardId) => {
          for (const node of board(boardId)?.nodes ?? []) get().stopNode(boardId, node.id)
          const { boards, order } = get()
          const rest = order.filter((id) => id !== boardId)
          const nextBoards = { ...boards }
          delete nextBoards[boardId]
          let nextId = rest.at(-1)
          if (!nextId) {
            const fresh = createCanvasBoard()
            nextBoards[fresh.id] = fresh
            rest.push(fresh.id)
            nextId = fresh.id
          }
          set((state) => {
            const history = { ...state.history }
            delete history[boardId]
            return { boards: nextBoards, order: rest, lastBoardId: nextId, history }
          })
          return nextId
        },

        openBoard: (boardId) => {
          if (get().boards[boardId] && get().lastBoardId !== boardId) set({ lastBoardId: boardId })
        },

        setViewport: (boardId, viewport) => writeBoard(boardId, { viewport }, false),

        onNodesChange: (boardId, changes) => {
          if (changes.some((change) => change.type === 'remove')) record(boardId)
          // Selecting and measuring are not edits: the board keeps its "last changed".
          const edits = changes.some((change) => change.type !== 'select' && (change.type !== 'dimensions' || change.resizing !== undefined))
          writeBoard(boardId, (current) => ({ nodes: applyNodeChanges(changes, current.nodes) }), edits)
        },

        onEdgesChange: (boardId, changes) => {
          if (changes.some((change) => change.type === 'remove')) record(boardId)
          const edits = changes.some((change) => change.type !== 'select')
          writeBoard(boardId, (current) => ({ edges: applyEdgeChanges(changes, current.edges) }), edits)
        },

        connect: (boardId, connection) => {
          if (!connection.source || !connection.target || connection.source === connection.target) return
          record(boardId)
          writeBoard(boardId, (current) => ({
            edges: addEdge({ ...connection, id: canvasId('link'), type: 'default' }, current.edges),
          }))
        },

        addNode: (boardId, kind, position, patch) => {
          const node = { ...createCanvasNode(kind, position, patch), selected: true }
          record(boardId)
          writeBoard(boardId, (current) => ({
            nodes: [...current.nodes.map((entry) => (entry.selected ? { ...entry, selected: false } : entry)), node],
          }))
          return node.id
        },

        editNode: (boardId, nodeId, patch) => {
          record(boardId)
          patchNode(boardId, nodeId, patch)
        },

        updateNodeData: (boardId, nodeId, patch) => patchNode(boardId, nodeId, patch),

        removeElements: (boardId, nodeIds, edgeIds = []) => {
          const current = board(boardId)
          if (!current || (nodeIds.length === 0 && edgeIds.length === 0)) return
          record(boardId)
          for (const id of nodeIds) get().stopNode(boardId, id)
          const removed = new Set(nodeIds)
          const removedEdges = new Set(edgeIds)
          writeBoard(boardId, {
            nodes: current.nodes.filter((node) => !removed.has(node.id)),
            edges: current.edges.filter((edge) => !removedEdges.has(edge.id) && !removed.has(edge.source) && !removed.has(edge.target)),
          })
        },

        duplicateNodes: (boardId, nodeIds) => {
          const current = board(boardId)
          if (!current || nodeIds.length === 0) return
          record(boardId)
          const picked = new Set(nodeIds)
          writeBoard(boardId, (latest) => {
            const { nodes, edges } = cloneSelection(latest.nodes.filter((node) => picked.has(node.id)), latest.edges, PASTE_OFFSET)
            return {
              nodes: [...latest.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)), ...nodes],
              edges: [...latest.edges, ...edges],
            }
          })
        },

        copyNodes: (boardId, nodeIds) => {
          const current = board(boardId)
          if (!current || nodeIds.length === 0) return
          const picked = new Set(nodeIds)
          set({
            clipboard: {
              nodes: current.nodes.filter((node) => picked.has(node.id)),
              edges: current.edges.filter((edge) => picked.has(edge.source) && picked.has(edge.target)),
            },
          })
        },

        pasteNodes: (boardId, at) => {
          const clipboard = get().clipboard
          if (!clipboard || clipboard.nodes.length === 0 || !board(boardId)) return
          record(boardId)
          const left = Math.min(...clipboard.nodes.map((node) => node.position.x))
          const top = Math.min(...clipboard.nodes.map((node) => node.position.y))
          const shift = at ? { x: at.x - left, y: at.y - top } : PASTE_OFFSET
          const { nodes, edges } = cloneSelection(clipboard.nodes, clipboard.edges, shift)
          writeBoard(boardId, (latest) => ({
            nodes: [...latest.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)), ...nodes],
            edges: [...latest.edges, ...edges],
          }))
          // The next paste lands a step further.
          if (!at) set({ clipboard: { nodes: clipboard.nodes.map((node) => ({ ...node, position: { x: node.position.x + PASTE_OFFSET, y: node.position.y + PASTE_OFFSET } })), edges: clipboard.edges } })
        },

        selectNodes: (boardId, nodeIds) => {
          const picked = nodeIds === 'all' ? null : new Set(nodeIds)
          writeBoard(boardId, (current) => ({
            nodes: current.nodes.map((node) => {
              const selected = picked ? picked.has(node.id) : true
              return Boolean(node.selected) === selected ? node : { ...node, selected }
            }),
            edges: current.edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
          }), false)
        },

        replaceContent: (boardId, nodes, edges) => {
          record(boardId)
          writeBoard(boardId, { nodes, edges })
        },

        beginChange: (boardId) => {
          const current = snapshot(boardId)
          if (!current) return
          writeHistory(boardId, { ...historyOf(boardId), pending: current })
        },

        endChange: (boardId) => {
          const history = historyOf(boardId)
          const before = history.pending
          const current = snapshot(boardId)
          if (!before || !current) return
          const changed = before.nodes.length !== current.nodes.length
            || before.edges !== current.edges
            || before.nodes.some((node, index) => !sameNodeContent(node, current.nodes[index]))
          writeHistory(boardId, changed
            ? { past: [...history.past, before].slice(-HISTORY_LIMIT), future: [], pending: null }
            : { ...history, pending: null })
        },

        undo: (boardId) => {
          const history = historyOf(boardId)
          const previous = history.past.at(-1)
          const current = snapshot(boardId)
          if (!previous || !current) return
          writeHistory(boardId, { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, HISTORY_LIMIT), pending: null })
          restore(boardId, previous)
        },

        redo: (boardId) => {
          const history = historyOf(boardId)
          const next = history.future[0]
          const current = snapshot(boardId)
          if (!next || !current) return
          writeHistory(boardId, { past: [...history.past, current].slice(-HISTORY_LIMIT), future: history.future.slice(1), pending: null })
          restore(boardId, next)
        },

        runNode: (boardId, nodeId, produce) => {
          const key = runKey(boardId, nodeId)
          const node = board(boardId)?.nodes.find((entry) => entry.id === nodeId)
          if (!node || liveRuns.has(key) || !isWorkKind(node.data.kind) || !node.data.input.trim()) return
          const startData = node.data
          patchNode(boardId, nodeId, { status: 'running', error: undefined })
          // A little spread, so runs started together do not all land at once.
          const duration = CANVAS_KINDS[startData.kind].runMs * (0.85 + Math.random() * 0.3)
          liveRuns.set(key, setTimeout(() => {
            liveRuns.delete(key)
            const latest = board(boardId)?.nodes.find((entry) => entry.id === nodeId)
            if (!latest) return
            const outcome = produce(startData, { id: canvasId('result'), at: Date.now(), input: startData.input.trim() })
            if ('error' in outcome) {
              patchNode(boardId, nodeId, { status: 'error', error: outcome.error })
              return
            }
            patchNode(boardId, nodeId, {
              status: 'done',
              error: undefined,
              results: [outcome, ...latest.data.results].slice(0, CANVAS_RESULT_LIMIT),
              shown: 0,
            })
          }, duration))
        },

        stopNode: (boardId, nodeId) => {
          const key = runKey(boardId, nodeId)
          const timer = liveRuns.get(key)
          if (!timer) return
          clearTimeout(timer)
          liveRuns.delete(key)
          const node = board(boardId)?.nodes.find((entry) => entry.id === nodeId)
          if (node) patchNode(boardId, nodeId, { status: node.data.results.length > 0 ? 'done' : 'idle' })
        },
      }
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createDeferredStorage<SavedState>(),
      partialize: (state): SavedState => ({ boards: state.boards, order: state.order, lastBoardId: state.lastBoardId }),
      merge: (saved, current) => {
        const state = saved as Partial<SavedState> | undefined
        if (!state?.boards || !Array.isArray(state.order)) return current
        const boards: Record<string, CanvasBoard> = {}
        for (const id of state.order) {
          const entry = state.boards[id]
          // A run cut off by closing the page does not come back as running.
          if (entry) boards[id] = { ...entry, nodes: entry.nodes.map(interruptedRun), edges: entry.edges ?? [] }
        }
        const order = state.order.filter((id) => boards[id])
        if (order.length === 0) return current
        const lastBoardId = state.lastBoardId && boards[state.lastBoardId] ? state.lastBoardId : order[order.length - 1]
        return { ...current, boards, order, lastBoardId }
      },
    },
  ),
)

export function useCanvasHistory(boardId: string) {
  const canUndo = useCanvasStore((state) => (state.history[boardId]?.past.length ?? 0) > 0)
  const canRedo = useCanvasStore((state) => (state.history[boardId]?.future.length ?? 0) > 0)
  return { canUndo, canRedo }
}

export function isCanvasNodeRunning(boardId: string, nodeId: string) {
  return liveRuns.has(runKey(boardId, nodeId))
}

/** Same place, size and content (selection aside): nothing to undo. */
function sameNodeContent(left: CanvasNode, right: CanvasNode | undefined) {
  if (!right) return false
  if (left === right) return true
  return left.id === right.id
    && left.data === right.data
    && left.position.x === right.position.x
    && left.position.y === right.position.y
    && left.width === right.width
    && left.height === right.height
}

/** An undo brings a card back as it was, but a run is only "running" while its timer is. */
function settleRuns(boardId: string, nodes: CanvasNode[]) {
  return nodes.map((node) => {
    const live = liveRuns.has(runKey(boardId, node.id))
    if (live && node.data.status !== 'running') return { ...node, data: { ...node.data, status: 'running' as const } }
    if (!live && node.data.status === 'running') {
      return { ...node, data: { ...node.data, status: node.data.results.length > 0 ? 'done' as const : 'idle' as const } }
    }
    return node
  })
}

function interruptedRun(node: CanvasNode): CanvasNode {
  if (node.data.status !== 'running') return node
  return { ...node, data: { ...node.data, status: 'error', error: 'interrupted' } }
}

/** Copies of the cards (new ids, selected, moved) and of the lines between them. */
function cloneSelection(nodes: CanvasNode[], edges: CanvasEdge[], shift: number | XYPosition) {
  const offset = typeof shift === 'number' ? { x: shift, y: shift } : shift
  const ids = new Map<string, string>()
  const clones = nodes.map((node) => {
    const id = canvasId(node.type === 'note' ? 'note' : 'card')
    ids.set(node.id, id)
    return {
      ...node,
      id,
      selected: true,
      dragging: false,
      position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
      data: { ...node.data, status: node.data.status === 'running' ? (node.data.results.length > 0 ? 'done' as const : 'idle' as const) : node.data.status, updatedAt: Date.now() },
    }
  })
  const cloneEdges = edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => ({ ...edge, id: canvasId('link'), source: ids.get(edge.source)!, target: ids.get(edge.target)!, selected: false }))
  return { nodes: clones, edges: cloneEdges }
}

/**
 * localStorage, written a moment after the last change (a drag changes the board on every frame) and at once when
 * the page is hidden. Selection is not saved.
 */
function createDeferredStorage<S extends SavedState>(): PersistStorage<S> {
  let pending: { name: string; value: StorageValue<S> } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let signature = ''

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    if (!pending) return
    const { name, value } = pending
    pending = null
    try {
      window.localStorage.setItem(name, JSON.stringify(value, (key, entry) => (
        key === 'selected' || key === 'dragging' || key === 'resizing' ? undefined : entry
      )))
    } catch {
      // Full or blocked storage: the board stays in this tab.
    }
    if (useCanvasSaveState.getState().saving) useCanvasSaveState.setState({ saving: false })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  return {
    getItem: (name) => {
      try {
        const raw = window.localStorage.getItem(name)
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      pending = { name, value }
      // Only an edit shows "saving"; selecting a card does not.
      const next = `${value.state.lastBoardId}|${value.state.order.map((id) => `${id}:${value.state.boards[id]?.updatedAt}`).join(',')}`
      if (next !== signature) {
        signature = next
        if (!useCanvasSaveState.getState().saving) useCanvasSaveState.setState({ saving: true })
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, SAVE_DELAY_MS)
    },
    removeItem: (name) => {
      pending = null
      try {
        window.localStorage.removeItem(name)
      } catch {
        // Nothing to remove.
      }
    },
  }
}
