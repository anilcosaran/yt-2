'use client'

import * as React from 'react'
import { Handle, NodeResizer, NodeToolbar, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import { AlertCircle, Copy, Maximize2, PenLine, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { useCanvasBoard } from './canvas-context'
import { CanvasDockButton, CanvasDockDivider, canvasDockClass } from './canvas-dock'
import {
  CANVAS_COLORS,
  NOTE_MIN_SIZE,
  WORK_NODE_WIDTH,
  isWorkKind,
  shownResult,
  type CanvasNode,
  type CanvasNodeData,
} from './canvas-model'
import {
  CanvasKindTile,
  CanvasResultView,
  CanvasRunningView,
  CanvasStatusBadge,
  useCanvasAgo,
  useCanvasNodeTitle,
  useCanvasOptionSummary,
} from './canvas-node-parts'
import { useCanvasStore } from './canvas-store'

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const

/** Points to draw a line from, on every side; any point joins any other (the board's connection mode is loose). */
function CanvasHandles() {
  return SIDES.map((side) => (
    <Handle key={side.id} id={side.id} type="source" position={side.position} className="cv-handle" />
  ))
}

/**
 * A work card: it keeps what was asked (the prompt or link), runs on its own, and shows what it made. It opens in a
 * popup for writing and for every version it made.
 */
function CanvasWorkNode({ id, data }: NodeProps<CanvasNode>) {
  const t = useTranslations('Canvas')
  const { openNode, runNode, boardId } = useCanvasBoard()
  const stopNode = useCanvasStore((state) => state.stopNode)
  const title = useCanvasNodeTitle(data)
  const summary = useCanvasOptionSummary(data)
  const result = shownResult(data)
  const running = data.status === 'running'
  const hasInput = data.input.trim().length > 0

  return (
    <>
      <CanvasNodeToolbar id={id} data={data} />
      <CanvasHandles />
      <article
        data-cv-color={data.color}
        data-status={data.status}
        className="cv-card relative overflow-hidden rounded-2xl border border-border bg-card"
        style={{ width: WORK_NODE_WIDTH }}
      >
        {/* The same thin line as a page on its way (NavigationProgress): this card is working. */}
        {running && <div aria-hidden className="nav-progress pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5" />}

        <header className="flex items-start gap-2.5 px-3.5 pb-2 pt-3">
          <CanvasKindTile kind={data.kind} color={data.color} />
          <div className="min-w-0 flex-1 pt-px">
            <p className="truncate text-sm font-semibold leading-5 text-foreground">{title}</p>
            <p className="truncate text-[11px] leading-4 text-muted-foreground">{summary || t(`kinds.${data.kind}.name`)}</p>
          </div>
          <CanvasStatusBadge status={data.status} className="mt-px" />
        </header>

        <div className="space-y-2.5 px-3.5 pb-3">
          {hasInput ? (
            <p className="line-clamp-2 text-[12.5px] leading-[18px] text-muted-foreground">{data.input}</p>
          ) : (
            <button
              type="button"
              onClick={() => openNode(id)}
              className="nodrag w-full rounded-xl border border-dashed border-border px-3 py-3 text-left text-[13px] leading-5 text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              {t(`kinds.${data.kind}.placeholder`)}
            </button>
          )}

          {running ? (
            <CanvasRunningView kind={data.kind} compact />
          ) : data.status === 'error' && data.error ? (
            <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12.5px] leading-5 text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {t(`errors.${data.error}`)}
            </p>
          ) : result ? (
            <CanvasResultView result={result} color={data.color} compact />
          ) : null}
        </div>

        {hasInput && (
          <footer className="flex items-center gap-2 border-t border-border/70 px-3.5 py-2">
            <CardMeta data={data} />
            {running ? (
              <button
                type="button"
                onClick={() => stopNode(boardId, id)}
                className="nodrag flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Square className="size-3 fill-current" />
                {t('card.stop')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runNode(id)}
                className={cn(
                  'nodrag flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors',
                  data.results.length > 0
                    ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {data.results.length > 0 ? <RotateCcw className="size-3" /> : <Play className="size-3 fill-current" />}
                {data.results.length > 0 ? t('card.runAgain') : t(`kinds.${data.kind}.run`)}
              </button>
            )}
          </footer>
        )}
      </article>
    </>
  )
}

function CardMeta({ data }: { data: CanvasNodeData }) {
  const t = useTranslations('Canvas.card')
  const ago = useCanvasAgo()
  const latest = data.results[0]
  return (
    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
      {latest
        ? [ago(latest.at), data.results.length > 1 ? t('versions', { count: data.results.length }) : null].filter(Boolean).join(' · ')
        : t('notRun')}
    </span>
  )
}

/** A note to organise the board: written in place, sized by its corners. */
function CanvasNoteNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const t = useTranslations('Canvas.note')
  const { boardId, editingNoteId, stopEditingNote } = useCanvasBoard()
  const updateNodeData = useCanvasStore((state) => state.updateNodeData)
  const beginChange = useCanvasStore((state) => state.beginChange)
  const endChange = useCanvasStore((state) => state.endChange)
  const editing = editingNoteId === id

  return (
    <>
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={NOTE_MIN_SIZE.width}
        minHeight={NOTE_MIN_SIZE.height}
        onResizeStart={() => beginChange(boardId)}
        onResizeEnd={() => endChange(boardId)}
      />
      <CanvasNodeToolbar id={id} data={data} />
      <CanvasHandles />
      <div data-cv-color={data.color} className="cv-note size-full overflow-hidden rounded-xl">
        {editing ? (
          <textarea
            autoFocus
            value={data.input}
            onChange={(event) => updateNodeData(boardId, id, { input: event.target.value })}
            onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
            onBlur={stopEditingNote}
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.currentTarget.blur()
            }}
            aria-label={t('label')}
            placeholder={t('placeholder')}
            className="nodrag nowheel nopan block size-full resize-none bg-transparent p-3.5 text-sm leading-6 text-foreground outline-none placeholder:text-foreground/40"
          />
        ) : (
          <div className={cn('size-full whitespace-pre-wrap break-words p-3.5 text-sm leading-6', data.input ? 'text-foreground' : 'text-foreground/45')}>
            {data.input || t('placeholder')}
          </div>
        )}
      </div>
    </>
  )
}

/** The picked card's own bar above it: run, open, colour, copy, delete. */
function CanvasNodeToolbar({ id, data }: { id: string; data: CanvasNodeData }) {
  const t = useTranslations('Canvas')
  const { boardId, openNode, runNode } = useCanvasBoard()
  const stopNode = useCanvasStore((state) => state.stopNode)
  const editNode = useCanvasStore((state) => state.editNode)
  const duplicateNodes = useCanvasStore((state) => state.duplicateNodes)
  const removeElements = useCanvasStore((state) => state.removeElements)
  const work = isWorkKind(data.kind)
  const running = data.status === 'running'

  return (
    <NodeToolbar position={Position.Top} offset={10}>
      <div className={canvasDockClass}>
        {work && (running ? (
          <CanvasDockButton label={t('card.stop')} onClick={() => stopNode(boardId, id)}>
            <Square className="fill-current" />
          </CanvasDockButton>
        ) : (
          <CanvasDockButton label={t(`kinds.${data.kind}.run`)} disabled={!data.input.trim()} onClick={() => runNode(id)}>
            <Play />
          </CanvasDockButton>
        ))}
        <CanvasDockButton label={work ? t('toolbar.open') : t('toolbar.write')} shortcut="↵" onClick={() => openNode(id)}>
          {work ? <Maximize2 /> : <PenLine />}
        </CanvasDockButton>
        <Popover>
          <PopoverTrigger asChild>
            <CanvasDockButton label={t('toolbar.color')}>
              <span data-cv-color={data.color} className="cv-swatch size-3.5 rounded-full ring-2 ring-background" />
            </CanvasDockButton>
          </PopoverTrigger>
          <PopoverContent side="top" sideOffset={10} className="flex w-auto gap-1.5 rounded-xl p-2">
            {CANVAS_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t(`colors.${color}`)}
                aria-pressed={data.color === color}
                onClick={() => editNode(boardId, id, { color })}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110',
                  data.color === color && 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover',
                )}
              >
                <span data-cv-color={color} className="cv-swatch size-5 rounded-full" />
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <CanvasDockDivider />
        <CanvasDockButton label={t('toolbar.duplicate')} shortcut="Ctrl D" onClick={() => duplicateNodes(boardId, [id])}>
          <Copy />
        </CanvasDockButton>
        <CanvasDockButton label={t('toolbar.delete')} shortcut="Del" tone="danger" onClick={() => removeElements(boardId, [id])}>
          <Trash2 />
        </CanvasDockButton>
      </div>
    </NodeToolbar>
  )
}

export const canvasNodeTypes: NodeTypes = {
  work: React.memo(CanvasWorkNode),
  note: React.memo(CanvasNoteNode),
}
