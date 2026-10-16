'use client'

import '@xyflow/react/dist/style.css'
import './canvas.css'

import * as React from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type XYPosition,
} from '@xyflow/react'
import { ClipboardPaste, Copy, Maximize, Maximize2, PenLine, Play, Plus, SquareDashedMousePointer, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { CanvasBoardContext, type CanvasBoardActions } from './canvas-context'
import { CanvasEmptyState } from './canvas-empty-state'
import { createCanvasProducer, createExampleContent, type CanvasTranslator } from './canvas-mock'
import {
  CANVAS_KINDS,
  CANVAS_NODE_KINDS,
  CANVAS_WORK_KINDS,
  canvasNodeFootprint,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeKind,
} from './canvas-model'
import { CanvasKindTile } from './canvas-node-parts'
import { CanvasNodeDialog } from './canvas-node-dialog'
import { canvasNodeTypes } from './canvas-nodes'
import { CANVAS_KIND_KEYS, CANVAS_KIND_MIME, CanvasPalette, isCanvasNodeKind } from './canvas-palette'
import { useCanvasHistory, useCanvasStore } from './canvas-store'
import { CanvasToolbelt, CanvasZoomDock, type CanvasPointerMode } from './canvas-toolbar'
import { CanvasTopBar } from './canvas-top-bar'

/** The add menu, opened at a point of the screen; new cards land at `flow` (or the middle of the view). */
type PaletteState = { x: number; y: number; side: 'top' | 'bottom'; align: 'start' | 'center'; flow: XYPosition | null }
/** The right-click menu: where it opened and what it is about. */
type MenuState = { x: number; y: number; flow: XYPosition } & ({ type: 'pane' } | { type: 'node'; ids: string[] } | { type: 'edge'; id: string })

const FIT_VIEW = { padding: 0.2, maxZoom: 1 }
const KIND_BY_KEY = Object.fromEntries(CANVAS_NODE_KINDS.map((kind) => [CANVAS_KIND_KEYS[kind].toLowerCase(), kind])) as Record<string, CanvasNodeKind>

export function CanvasEditor({ boardId, onOpenBoard }: { boardId: string; onOpenBoard: (boardId: string) => void }) {
  return (
    <ReactFlowProvider>
      <CanvasBoardEditor boardId={boardId} onOpenBoard={onOpenBoard} />
    </ReactFlowProvider>
  )
}

function CanvasBoardEditor({ boardId, onOpenBoard }: { boardId: string; onOpenBoard: (boardId: string) => void }) {
  const t = useTranslations('Canvas')
  const locale = useLocale()
  const { resolvedTheme } = useTheme()
  const flow = useReactFlow<CanvasNode, CanvasEdge>()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pointerRef = React.useRef<{ x: number; y: number } | null>(null)

  const nodes = useCanvasStore((state) => state.boards[boardId]?.nodes ?? EMPTY_NODES)
  const edges = useCanvasStore((state) => state.boards[boardId]?.edges ?? EMPTY_EDGES)
  // Read once: the board opens where it was left.
  const [initialViewport] = React.useState(() => useCanvasStore.getState().boards[boardId]?.viewport)
  const hasClipboard = useCanvasStore((state) => Boolean(state.clipboard?.nodes.length))
  const { canUndo, canRedo } = useCanvasHistory(boardId)
  const store = useCanvasStore.getState

  const [mode, setMode] = React.useState<CanvasPointerMode>('select')
  const [minimapOpen, setMinimapOpen] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)
  const [palette, setPalette] = React.useState<PaletteState | null>(null)
  const [menu, setMenu] = React.useState<MenuState | null>(null)
  const [dialogNodeId, setDialogNodeId] = React.useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null)

  const produce = React.useMemo(() => createCanvasProducer(t as unknown as CanvasTranslator, locale), [locale, t])

  const openNode = React.useCallback((nodeId: string) => {
    const node = store().boards[boardId]?.nodes.find((entry) => entry.id === nodeId)
    if (!node) return
    // Writing in a card or a note is one step of undo, however much is typed.
    store().beginChange(boardId)
    if (node.type === 'note') setEditingNoteId(nodeId)
    else setDialogNodeId(nodeId)
  }, [boardId, store])

  const closeDialog = React.useCallback(() => {
    setDialogNodeId(null)
    store().endChange(boardId)
  }, [boardId, store])

  const stopEditingNote = React.useCallback(() => {
    setEditingNoteId(null)
    store().endChange(boardId)
  }, [boardId, store])

  const runNode = React.useCallback((nodeId: string) => store().runNode(boardId, nodeId, produce), [boardId, produce, store])

  const boardActions = React.useMemo<CanvasBoardActions>(
    () => ({ boardId, openNode, runNode, editingNoteId, stopEditingNote }),
    [boardId, editingNoteId, openNode, runNode, stopEditingNote],
  )

  /** The middle of what is on screen, in board coordinates. */
  const viewCenter = React.useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }, [flow])

  /**
   * A new card: centred on the point the user picked, or in the free space nearest the middle of the view. It opens
   * at once, on a blank prompt (a note starts editing).
   */
  const addNodeAt = React.useCallback((kind: CanvasNodeKind, point?: XYPosition | null) => {
    const size = canvasNodeFootprint(kind)
    const center = point ?? viewCenter()
    const start = { x: Math.round(center.x - size.width / 2), y: Math.round(center.y - size.height / 2) }
    const position = point ? start : nearestFreeSpot(start, size, store().boards[boardId]?.nodes ?? [])
    const nodeId = store().addNode(boardId, kind, position)
    setPalette(null)
    openNode(nodeId)
  }, [boardId, openNode, store, viewCenter])

  const pointerFlowPosition = React.useCallback(() => {
    const pointer = pointerRef.current
    return pointer ? flow.screenToFlowPosition(pointer) : null
  }, [flow])

  const openPaletteAt = React.useCallback((x: number, y: number) => {
    setMenu(null)
    setPalette({ x, y, side: 'bottom', align: 'start', flow: flow.screenToFlowPosition({ x, y }) })
  }, [flow])

  const loadExample = React.useCallback(() => {
    const { nodes: exampleNodes, edges: exampleEdges } = createExampleContent(t as unknown as CanvasTranslator, locale)
    store().replaceContent(boardId, exampleNodes, exampleEdges)
    if (!store().boards[boardId]?.title.trim()) store().renameBoard(boardId, t('example.boardTitle'))
    window.setTimeout(() => void flow.fitView({ ...FIT_VIEW, duration: 400 }), 60)
  }, [boardId, flow, locale, store, t])

  const selectedIds = React.useCallback(() => {
    const board = store().boards[boardId]
    return {
      nodes: board?.nodes.filter((node) => node.selected).map((node) => node.id) ?? [],
      edges: board?.edges.filter((edge) => edge.selected).map((edge) => edge.id) ?? [],
    }
  }, [boardId, store])

  // The board's keys, while the board (not a field, a menu or a popup) has the focus.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const active = document.activeElement
      const onBoard = !active || active === document.body || Boolean(rootRef.current?.contains(active))
      if (!onBoard || isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()
      const mod = event.ctrlKey || event.metaKey
      const selection = selectedIds()

      if (mod) {
        if (key === 'z') store()[event.shiftKey ? 'redo' : 'undo'](boardId)
        else if (key === 'y') store().redo(boardId)
        else if (key === 'd') store().duplicateNodes(boardId, selection.nodes)
        else if (key === 'c') {
          if (selection.nodes.length === 0) return
          store().copyNodes(boardId, selection.nodes)
        } else if (key === 'v') store().pasteNodes(boardId, pointerFlowPosition() ?? undefined)
        else if (key === 'a') store().selectNodes(boardId, 'all')
        else return
        event.preventDefault()
        return
      }
      if (event.altKey) return

      if (key === 'delete' || key === 'backspace') store().removeElements(boardId, selection.nodes, selection.edges)
      else if (key === 'enter' && selection.nodes.length === 1) openNode(selection.nodes[0])
      else if (key === 'escape') {
        setPalette(null)
        store().selectNodes(boardId, [])
      } else if (key === '/') {
        const rect = rootRef.current?.getBoundingClientRect()
        if (rect) setPalette({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3, side: 'bottom', align: 'center', flow: null })
      } else if (key === 'v') setMode('select')
      else if (key === 'h') setMode('hand')
      else if (event.shiftKey && (event.code === 'Digit1' || key === '1' || key === '!')) void flow.fitView({ ...FIT_VIEW, duration: 300 })
      else if (key === '+' || key === '=') void flow.zoomIn({ duration: 160 })
      else if (key === '-') void flow.zoomOut({ duration: 160 })
      else if (KIND_BY_KEY[key] && !event.shiftKey) addNodeAt(KIND_BY_KEY[key], pointerFlowPosition())
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addNodeAt, boardId, flow, openNode, pointerFlowPosition, selectedIds, store])

  const menuNodes = menu?.type === 'node' ? nodes.filter((node) => menu.ids.includes(node.id)) : []
  const menuSingle = menuNodes.length === 1 ? menuNodes[0] : null

  return (
    <CanvasBoardContext.Provider value={boardActions}>
      <div
        ref={rootRef}
        className={cn('cv-root @container h-full min-h-0 overflow-hidden', mode === 'hand' && 'cv-hand', connecting && 'cv-connecting')}
        onPointerMove={(event) => {
          pointerRef.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerLeave={() => {
          pointerRef.current = null
        }}
      >
        <ReactFlow<CanvasNode, CanvasEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={canvasNodeTypes}
          onNodesChange={(changes) => store().onNodesChange(boardId, changes)}
          onEdgesChange={(changes) => store().onEdgesChange(boardId, changes)}
          onConnect={(connection) => store().connect(boardId, connection)}
          onConnectStart={() => setConnecting(true)}
          onConnectEnd={() => setConnecting(false)}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={28}
          onNodeDragStart={() => store().beginChange(boardId)}
          onNodeDragStop={() => store().endChange(boardId)}
          onSelectionDragStart={() => store().beginChange(boardId)}
          onSelectionDragStop={() => store().endChange(boardId)}
          onNodeDoubleClick={(_, node) => openNode(node.id)}
          onPaneClick={(event) => {
            setMenu(null)
            if (event.detail >= 2) openPaletteAt(event.clientX, event.clientY)
          }}
          onPaneContextMenu={(event) => {
            event.preventDefault()
            setPalette(null)
            setMenu({ type: 'pane', x: event.clientX, y: event.clientY, flow: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }) })
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault()
            setPalette(null)
            const selection = selectedIds().nodes
            const ids = node.selected && selection.length > 1 ? selection : [node.id]
            if (!node.selected) store().selectNodes(boardId, [node.id])
            setMenu({ type: 'node', ids, x: event.clientX, y: event.clientY, flow: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }) })
          }}
          onSelectionContextMenu={(event, picked) => {
            event.preventDefault()
            setMenu({ type: 'node', ids: picked.map((node) => node.id), x: event.clientX, y: event.clientY, flow: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }) })
          }}
          onEdgeContextMenu={(event, edge) => {
            event.preventDefault()
            setMenu({ type: 'edge', id: edge.id, x: event.clientX, y: event.clientY, flow: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }) })
          }}
          onMoveStart={() => setMenu(null)}
          onMoveEnd={(_, viewport) => store().setViewport(boardId, viewport)}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(CANVAS_KIND_MIME)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(event) => {
            const kind = event.dataTransfer.getData(CANVAS_KIND_MIME)
            if (!isCanvasNodeKind(kind)) return
            event.preventDefault()
            addNodeAt(kind, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }))
          }}
          defaultViewport={initialViewport}
          fitView={!initialViewport && nodes.length > 0}
          fitViewOptions={FIT_VIEW}
          minZoom={0.2}
          maxZoom={2}
          snapToGrid
          snapGrid={[12, 12]}
          deleteKeyCode={null}
          selectionKeyCode="Shift"
          multiSelectionKeyCode={MULTI_SELECT_KEYS}
          selectionOnDrag={mode === 'select'}
          selectionMode={SelectionMode.Partial}
          panOnDrag={mode === 'hand' ? true : MIDDLE_BUTTON}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          panActivationKeyCode="Space"
          colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
          proOptions={PRO_OPTIONS}
          aria-label={t('board.ariaLabel')}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} color="var(--cv-dot)" />
          {minimapOpen && (
            <MiniMap<CanvasNode>
              pannable
              zoomable
              position="bottom-right"
              nodeBorderRadius={12}
              nodeColor={(node) => `color-mix(in oklab, var(--cv-${node.data.color}) 55%, var(--card))`}
              nodeStrokeWidth={0}
              ariaLabel={t('toolbar.minimap')}
              style={{ width: 176, height: 116, marginBottom: 68, marginRight: 16 }}
            />
          )}
        </ReactFlow>

        {nodes.length === 0 && <CanvasEmptyState onAdd={(kind) => addNodeAt(kind)} onExample={loadExample} />}

        <CanvasTopBar boardId={boardId} onOpenBoard={onOpenBoard} />
        <CanvasZoomDock minimapOpen={minimapOpen} onToggleMinimap={() => setMinimapOpen((value) => !value)} />
        <CanvasToolbelt
          mode={mode}
          onModeChange={setMode}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => store().undo(boardId)}
          onRedo={() => store().redo(boardId)}
          onAddNote={() => addNodeAt('note')}
          paletteOpen={palette !== null && palette.side === 'top'}
          onTogglePalette={(anchor) => setPalette((current) => (current?.side === 'top'
            ? null
            : { x: anchor.left + anchor.width / 2, y: anchor.top, side: 'top', align: 'center', flow: null }))}
        />
      </div>

      <Popover open={palette !== null} onOpenChange={(open) => !open && setPalette(null)}>
        <PopoverAnchor asChild>
          <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: palette?.x ?? 0, top: palette?.y ?? 0 }} />
        </PopoverAnchor>
        <PopoverContent
          side={palette?.side ?? 'bottom'}
          align={palette?.align ?? 'start'}
          sideOffset={10}
          collisionPadding={12}
          className="w-80 overflow-hidden rounded-xl p-0 shadow-xl"
          onPointerDownOutside={(event) => {
            // The add button toggles the menu itself.
            if ((event.target as HTMLElement | null)?.closest('[data-cv-palette-toggle]')) event.preventDefault()
          }}
        >
          <CanvasPalette onPick={(kind) => addNodeAt(kind, palette?.flow)} />
        </PopoverContent>
      </Popover>

      <DropdownMenu open={menu !== null} onOpenChange={(open) => !open && setMenu(null)} modal={false}>
        <DropdownMenuTrigger asChild>
          <span aria-hidden className="pointer-events-none fixed size-0" style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2} className="w-60 p-1.5">
          {menu?.type === 'pane' && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Plus className="size-4" />
                  {t('menu.addHere')}
                </DropdownMenuSubTrigger>
                {/* In a portal: the menu scrolls, and would clip a submenu drawn inside it. */}
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-56 p-1.5">
                    {[...CANVAS_WORK_KINDS, 'note' as const].map((kind) => (
                      <DropdownMenuItem key={kind} className="gap-2.5" onSelect={() => addNodeAt(kind, menu.flow)}>
                        <CanvasKindTile kind={kind} color={CANVAS_KINDS[kind].color} className="size-6 rounded-md [&_svg]:size-3.5" />
                        {t(`kinds.${kind}.name`)}
                        <DropdownMenuShortcut>{CANVAS_KIND_KEYS[kind]}</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuItem className="gap-2" disabled={!hasClipboard} onSelect={() => store().pasteNodes(boardId, menu.flow)}>
                <ClipboardPaste className="size-4" />
                {t('menu.paste')}
                <DropdownMenuShortcut>Ctrl V</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" disabled={nodes.length === 0} onSelect={() => store().selectNodes(boardId, 'all')}>
                <SquareDashedMousePointer className="size-4" />
                {t('menu.selectAll')}
                <DropdownMenuShortcut>Ctrl A</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" disabled={nodes.length === 0} onSelect={() => void flow.fitView({ ...FIT_VIEW, duration: 300 })}>
                <Maximize className="size-4" />
                {t('toolbar.fit')}
                <DropdownMenuShortcut>⇧ 1</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )}
          {menu?.type === 'node' && (
            <>
              {menuSingle && (menuSingle.type === 'note' ? (
                <DropdownMenuItem className="gap-2" onSelect={() => openNode(menuSingle.id)}>
                  <PenLine className="size-4" />
                  {t('toolbar.write')}
                  <DropdownMenuShortcut>↵</DropdownMenuShortcut>
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem className="gap-2" onSelect={() => openNode(menuSingle.id)}>
                    <Maximize2 className="size-4" />
                    {t('toolbar.open')}
                    <DropdownMenuShortcut>↵</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2"
                    disabled={!menuSingle.data.input.trim() || menuSingle.data.status === 'running'}
                    onSelect={() => runNode(menuSingle.id)}
                  >
                    <Play className="size-4" />
                    {t(`kinds.${menuSingle.data.kind}.run`)}
                  </DropdownMenuItem>
                </>
              ))}
              {!menuSingle && menuNodes.some((node) => node.type === 'work') && (
                <DropdownMenuItem
                  className="gap-2"
                  disabled={!menuNodes.some((node) => node.type === 'work' && node.data.input.trim() && node.data.status !== 'running')}
                  onSelect={() => {
                    for (const node of menuNodes) if (node.type === 'work') runNode(node.id)
                  }}
                >
                  <Play className="size-4" />
                  {t('menu.runEach', { count: menuNodes.filter((node) => node.type === 'work').length })}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="gap-2" onSelect={() => store().duplicateNodes(boardId, menu.ids)}>
                <Copy className="size-4" />
                {t('toolbar.duplicate')}
                <DropdownMenuShortcut>Ctrl D</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => store().copyNodes(boardId, menu.ids)}>
                <ClipboardPaste className="size-4" />
                {t('menu.copy')}
                <DropdownMenuShortcut>Ctrl C</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="gap-2" onSelect={() => store().removeElements(boardId, menu.ids)}>
                <Trash2 className="size-4" />
                {menu.ids.length > 1 ? t('menu.deleteMany', { count: menu.ids.length }) : t('toolbar.delete')}
                <DropdownMenuShortcut>Del</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )}
          {menu?.type === 'edge' && (
            <DropdownMenuItem variant="destructive" className="gap-2" onSelect={() => store().removeElements(boardId, [], [menu.id])}>
              <Trash2 className="size-4" />
              {t('menu.deleteLink')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CanvasNodeDialog nodeId={dialogNodeId} onClose={closeDialog} />
    </CanvasBoardContext.Provider>
  )
}

const EMPTY_NODES: CanvasNode[] = []
const EMPTY_EDGES: CanvasEdge[] = []
const MIDDLE_BUTTON = [1]
const MULTI_SELECT_KEYS = ['Shift', 'Meta', 'Control']
const PRO_OPTIONS = { hideAttribution: true }

const PLACE_GAP = 32
const PLACE_STEP = 48

/** The spot nearest `start` where a card of `size` touches no other card. */
function nearestFreeSpot(start: XYPosition, size: { width: number; height: number }, nodes: CanvasNode[]) {
  const boxes = nodes.map((node) => ({
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? size.width,
    height: node.measured?.height ?? node.height ?? size.height,
  }))
  const free = (spot: XYPosition) => boxes.every((box) => spot.x + size.width + PLACE_GAP <= box.x
    || box.x + box.width + PLACE_GAP <= spot.x
    || spot.y + size.height + PLACE_GAP <= box.y
    || box.y + box.height + PLACE_GAP <= spot.y)
  const offsets: XYPosition[] = []
  for (let dx = -10; dx <= 10; dx += 1) for (let dy = -8; dy <= 8; dy += 1) offsets.push({ x: dx * PLACE_STEP, y: dy * PLACE_STEP })
  offsets.sort((left, right) => Math.hypot(left.x, left.y * 1.4) - Math.hypot(right.x, right.y * 1.4))
  const offset = offsets.find((candidate) => free({ x: start.x + candidate.x, y: start.y + candidate.y }))
  return offset ? { x: start.x + offset.x, y: start.y + offset.y } : start
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
