import type { SparkToolEntry } from '../spark-tool-types'

/**
 * Rail "Text" (Y1-08): no drawer, a click adds a new text layer on top of the current scene through the stage. Without
 * the stage the tool stays "coming soon".
 */
export const textTool: SparkToolEntry = {
  id: 'text',
  icon: 'type',
  labelKey: 'tools.text',
  availability: (ctx) => {
    if (!ctx.stage) return { enabled: false, titleKey: 'comingSoon' }
    const title = ctx.stageCanWrite ? (ctx.hasScene ? 'stage.addTextTitle' : 'stage.needsScene') : 'readOnly'
    return ctx.stageCanWrite && ctx.stage.schema && ctx.hasScene ? { enabled: true, titleKey: title } : { enabled: false, titleKey: title }
  },
  run: (ctx) => {
    void ctx.stage?.controller.addText()
  },
}
