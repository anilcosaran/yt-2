'use client'

import * as React from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { Hand, Map as MapIcon, Maximize, Minus, MousePointer2, Plus, Redo2, StickyNote, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

import { CanvasDockButton, CanvasDockDivider, canvasDockClass } from './canvas-dock'

export type CanvasPointerMode = 'select' | 'hand'

/** The tools along the bottom: pick or move the board, undo, a note, and the menu of everything that can be added. */
export function CanvasToolbelt({
  mode,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddNote,
  paletteOpen,
  onTogglePalette,
}: {
  mode: CanvasPointerMode
  onModeChange: (mode: CanvasPointerMode) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAddNote: () => void
  paletteOpen: boolean
  onTogglePalette: (anchor: DOMRect) => void
}) {
  const t = useTranslations('Canvas.toolbar')
  return (
    // A narrow board keeps the tools to the left, clear of the zoom on the right.
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-start px-4 @3xl:justify-center">
      <div className={canvasDockClass}>
        <CanvasDockButton label={t('select')} shortcut="V" active={mode === 'select'} onClick={() => onModeChange('select')}>
          <MousePointer2 />
        </CanvasDockButton>
        <CanvasDockButton label={t('hand')} shortcut="H" active={mode === 'hand'} onClick={() => onModeChange('hand')}>
          <Hand />
        </CanvasDockButton>
        <CanvasDockDivider />
        <CanvasDockButton label={t('undo')} shortcut="Ctrl Z" disabled={!canUndo} onClick={onUndo}>
          <Undo2 />
        </CanvasDockButton>
        <CanvasDockButton label={t('redo')} shortcut="Ctrl ⇧ Z" disabled={!canRedo} onClick={onRedo}>
          <Redo2 />
        </CanvasDockButton>
        <CanvasDockDivider />
        <CanvasDockButton label={t('addNote')} shortcut="N" onClick={onAddNote}>
          <StickyNote />
        </CanvasDockButton>
        <button
          type="button"
          data-cv-palette-toggle
          aria-expanded={paletteOpen}
          onClick={(event) => onTogglePalette(event.currentTarget.getBoundingClientRect())}
          className={cn(
            'ml-0.5 flex h-8 items-center gap-1.5 rounded-xl bg-primary pl-2.5 pr-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            paletteOpen && 'bg-primary/85',
          )}
        >
          <Plus className={cn('size-4 transition-transform', paletteOpen && 'rotate-45')} />
          {t('add')}
        </button>
      </div>
    </div>
  )
}

/**
 * Zoom out and in, the zoom itself (a click goes back to 100%), fit the board, and the map. On a narrow board only
 * the buttons stay.
 */
export function CanvasZoomDock({ minimapOpen, onToggleMinimap }: { minimapOpen: boolean; onToggleMinimap: () => void }) {
  const t = useTranslations('Canvas.toolbar')
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const zoom = useStore((state) => state.transform[2])
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex">
      <div className={canvasDockClass}>
        <CanvasDockButton label={t('zoomOut')} shortcut="−" onClick={() => void zoomOut({ duration: 160 })}>
          <Minus />
        </CanvasDockButton>
        <button
          type="button"
          onClick={() => void zoomTo(1, { duration: 200 })}
          title={t('zoomReset')}
          className="hidden h-8 w-12 rounded-lg text-center text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground @2xl:block"
        >
          {Math.round(zoom * 100)}%
        </button>
        <CanvasDockButton label={t('zoomIn')} shortcut="+" onClick={() => void zoomIn({ duration: 160 })}>
          <Plus />
        </CanvasDockButton>
        <CanvasDockDivider />
        <CanvasDockButton label={t('fit')} shortcut="⇧ 1" onClick={() => void fitView({ padding: 0.2, duration: 300, maxZoom: 1 })}>
          <Maximize />
        </CanvasDockButton>
        <CanvasDockButton label={t('minimap')} active={minimapOpen} onClick={onToggleMinimap} className="hidden @2xl:flex">
          <MapIcon />
        </CanvasDockButton>
      </div>
    </div>
  )
}
