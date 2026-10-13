'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { loadShapePalette, studioAccentHex, studioPalette, type ShapePalette } from '@/lib/spark/shape-palette'
import { layerViewOf } from '@/lib/spark/stage/document-layers'
import { writeCardDrag } from '@/lib/spark/stage/placement'
import { SHAPE_KINDS, isShapeFill, type ShapeKind } from '@/lib/spark/stage/shape-model'
import { singleLayerId } from '@/lib/spark/stage/stage-selection'
import { colorChanged } from '@/lib/spark/stage/toolbox-model'

import { ColorInput } from '../stage/stage-fields'
import { useStageSelection } from '../stage/use-stage-state'
import './shapes-drawer.css'
import type { SparkToolContext, SparkToolDrawerProps } from './spark-tool-types'

/** Icons of the five kinds (the design's shape tiles: one filled glyph per tile, `currentColor`). */
const GLYPHS: Record<ShapeKind, React.ReactNode> = {
  square: <rect x="3" y="3" width="18" height="18" rx="1" />,
  rectangle: <rect x="2" y="6" width="20" height="12" rx="1" />,
  circle: <circle cx="12" cy="12" r="9" />,
  ellipse: <ellipse cx="12" cy="12" rx="10" ry="6.5" />,
  pill: <rect x="2" y="8" width="20" height="8" rx="4" />,
}

/** Why the cards cannot add a shape right now, or null: the stage is off, the project is read-only, or there is no scene. */
export function shapeAddBlocker(ctx: Pick<SparkToolContext, 'stage' | 'stageCanWrite' | 'hasScene'>): 'stageOff' | 'readOnly' | 'needsScene' | null {
  if (!ctx.stage) return 'stageOff'
  if (!ctx.stageCanWrite) return 'readOnly'
  if (!ctx.hasScene) return 'needsScene'
  return null
}

/**
 * The Shapes drawer (E1-B, D4): a grid of the five kinds (square, rectangle, circle, ellipse, pill) and a colour row. A press
 * adds the shape at the playhead, centred on the canvas (the "+" of a card); a card can be dragged onto the canvas (D14: at
 * the drop point) or onto the timeline (at that second). The new shape is selected, so its handles, toolbox and Width /
 * Height / Corner radius fields are right there. One gesture = one `shape.insert` = one undo group.
 */
export function ShapesToolDrawer({ ctx }: SparkToolDrawerProps) {
  const t = useTranslations('Spark.editor.shapes')
  const tEditor = useTranslations('Spark.editor')
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [palette, setPalette] = React.useState<ShapePalette | null>(null)
  const [picked, setPicked] = React.useState<string | null>(null)
  const projectId = ctx.project.id

  React.useEffect(() => {
    const controller = new AbortController()
    const accent = studioAccentHex(rootRef.current)
    void loadShapePalette(projectId, { signal: controller.signal, accent }).then((next) => {
      if (!controller.signal.aborted) setPalette(next)
    })
    return () => controller.abort()
  }, [projectId])

  const active = palette ?? studioPalette(null)
  const fill = picked ?? active.defaultFill
  const blocker = shapeAddBlocker(ctx)
  // Owner report 2026-10-03 ("I add a shape and cannot change its colour"): with a shape selected on the canvas, a colour of
  // this row recolours THAT shape (one `shape.set_fill`), and is also the colour of the next new shape.
  const selection = useStageSelection(ctx.stage)
  const selectedLayerId = singleLayerId(selection)
  const selectedShape = selection && selectedLayerId ? layerViewOf(ctx.document, selection.sceneId, selectedLayerId) : null
  const recolours = selectedShape?.kind === 'shape' && ctx.stageCanWrite
  const pick = (colour: string) => {
    setPicked(colour)
    if (recolours && colorChanged(selectedShape.fill, colour)) void ctx.stage?.controller.setShapeFill(colour)
  }
  const blockedTitle = blocker === null ? undefined : blocker === 'stageOff' ? tEditor('comingSoon') : blocker === 'readOnly' ? tEditor('readOnly') : tEditor('stage.needsScene')
  const swatches = isShapeFill(fill) && !active.swatches.includes(fill.toLowerCase()) ? [...active.swatches, fill.toLowerCase()] : active.swatches
  // The pressed swatch is the selected shape's colour while one is selected, else the next shape's.
  const current = (recolours && selectedShape.fill ? selectedShape.fill : fill).toLowerCase()

  return (
    <div className="dr-body" ref={rootRef} data-shapes-drawer>
      <div className="dr-label">
        {t('basic')} <span>{t('hint')}</span>
      </div>
      <div className="grid4 shape-grid">
        {SHAPE_KINDS.map((kind) => {
          const label = t(`kinds.${kind}`)
          return (
            <button
              key={kind}
              type="button"
              className="shape"
              data-shape-kind={kind}
              draggable={blocker === null}
              disabled={blocker !== null}
              aria-label={t('add', { shape: label })}
              title={blockedTitle ?? t('addTitle', { shape: label })}
              onClick={() => void ctx.stage?.controller.addShape(kind, { fill })}
              onDragStart={(event) => {
                if (blocker !== null) {
                  event.preventDefault()
                  return
                }
                writeCardDrag(event.dataTransfer, { tool: 'shape', kind: 'shape', data: { shape: kind, fill } })
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                {GLYPHS[kind]}
              </svg>
              <span className="shape-name">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="dr-label">
        {t('colour')} {recolours ? <span>{t('appliesToSelected')}</span> : active.source === 'kit' ? <span>{t('fromKit')}</span> : null}
      </div>
      <div className="shape-swatches" role="group" aria-label={t('colour')}>
        {swatches.map((colour) => (
          <button
            key={colour}
            type="button"
            aria-pressed={colour === current}
            aria-label={t('swatch', { colour: colour.toUpperCase() })}
            title={colour.toUpperCase()}
            className={`shape-swatch${colour === current ? ' on' : ''}`}
            style={{ background: colour }}
            onClick={() => pick(colour)}
          />
        ))}
        <span className="shape-swatch-custom" title={t('custom')}>
          <ColorInput
            value={isShapeFill(fill) ? fill.toLowerCase() : '#000000'}
            label={t('custom')}
            onPreview={recolours ? (colour) => ctx.stage?.controller.previewColor('fill', colour) : undefined}
            onCommit={(colour) => pick(colour.toLowerCase())}
          />
        </span>
      </div>
    </div>
  )
}
