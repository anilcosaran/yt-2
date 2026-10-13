import { motionCardFromDrag } from '@/lib/spark/motion-card-drag'

import { announceMotionInsert, insertMotion, watchOverlay } from '../insert-motion'
import { MotionToolDrawer } from '../motion-drawer'
import type { SparkToolEntry } from '../spark-tool-types'

/**
 * Rail "Motion" (E1-D, D13): the Motion drawer (Library, My Motions, Premium). It needs the WYSIWYG stage (the playhead and
 * the canvas the cards are put on) and the UI pod's `MOTION_UI_ENABLED` switch (code default off); without them the tool
 * stays "coming soon". A card dropped on the canvas or the timeline is placed like its "+" button: one overlay at the
 * playhead second or at the dropped second (D14), one command.
 */
export const motionTool: SparkToolEntry = {
  id: 'motion',
  icon: 'motion',
  labelKey: 'tools.motion',
  availability: (ctx) => (ctx.motionEnabled && ctx.stage ? { enabled: true } : { enabled: false, titleKey: 'comingSoon' }),
  Drawer: MotionToolDrawer,
  onDrop: async (ctx, drop, target) => {
    if (drop.kind !== 'card') return false
    const dropped = motionCardFromDrag(drop.drag)
    if (!dropped) return false
    const outcome = await insertMotion(ctx, dropped.card, target, dropped.videoStyleRef)
    announceMotionInsert(ctx, dropped.card, outcome)
    // The preview of the scene tells whether the gateway could draw the overlay (a camera Motion cannot, E1-C).
    void watchOverlay(ctx, dropped.card, outcome)
    return outcome.applied
  },
}
