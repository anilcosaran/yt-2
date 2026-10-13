import { isShapeFill, isShapeKind } from '@/lib/spark/stage/shape-model'

import { ShapesToolDrawer, shapeAddBlocker } from '../shapes-drawer'
import type { SparkToolEntry } from '../spark-tool-types'

/**
 * Rail "Shape" (E1-B, D4): the drawer of the five kinds (square, rectangle, circle, ellipse, pill) and a colour row. Needs
 * the stage (`SPARK_STAGE_ENABLED`) and a scene to put the shape in; without the stage it stays "coming soon". A card
 * (`kind: 'shape'`, `data: { shape, fill }`) dropped on the canvas lands at the drop point, on the timeline at that second.
 */
export const shapeTool: SparkToolEntry = {
  id: 'shape',
  icon: 'shapes',
  labelKey: 'tools.shape',
  availability: (ctx) => {
    const blocker = shapeAddBlocker(ctx)
    if (blocker === null) return { enabled: true }
    return { enabled: false, titleKey: blocker === 'stageOff' ? 'comingSoon' : blocker === 'readOnly' ? 'readOnly' : 'stage.needsScene' }
  },
  Drawer: ShapesToolDrawer,
  onDrop: async (ctx, drop, target) => {
    if (!ctx.stage || drop.kind !== 'card' || drop.drag.kind !== 'shape') return false
    const { shape, fill } = drop.drag.data
    if (!isShapeKind(shape)) return false
    return ctx.stage.controller.addShape(shape, { ...(isShapeFill(fill) && { fill }), target })
  },
}
