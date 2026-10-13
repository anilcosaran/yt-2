import { acceptsToolDrop, type SparkToolDrop } from '@/lib/spark/stage/placement'

import { animationsTool } from './entries/animations-tool'
import { avatarTool } from './entries/avatar-tool'
import { captionsTool } from './entries/captions-tool'
import { mediaTool } from './entries/media-tool'
import { motionTool } from './entries/motion-tool'
import { recordTool } from './entries/record-tool'
import { shapeTool } from './entries/shape-tool'
import { textTool } from './entries/text-tool'
import { transitionsTool } from './entries/transitions-tool'
import type { SparkToolContext, SparkToolEntry, SparkToolId } from './spark-tool-types'

/**
 * THE registry of the editor's left-rail tools (E1-A P0). The shell (`spark-editor-shell.tsx`) renders the rail, the
 * drawer frame and the drop zones from this list and knows no tool by name; a tool lives in its own files.
 *
 * ## How to add or connect a tool
 *
 * Each tool is ONE entry file `entries/<id>-tool.ts` exporting a `SparkToolEntry` (see `spark-tool-types.ts`), listed
 * below in rail order. The entries for `avatar`, `shape`, `motion` and `record` exist as DISABLED placeholders: the
 * package that connects a tool replaces the body of ITS OWN entry file only and touches nothing else here.
 *
 * 1. `id`        the tool id (`SparkToolId`); the rail order is the order of `SPARK_TOOLS` below.
 * 2. `icon`      a symbol of the icon sprite (`studio/studio-icons.ts`, without `i-`).
 * 3. `labelKey`  a message key under `Spark.editor` (the rail label and the drawer heading), e.g. `tools.shape`.
 * 4. `availability(ctx)`  the enable rule: `{ enabled: false, titleKey: 'comingSoon' }` while unconnected; a connected tool
 *                reads the context (`ctx.stage` on? `ctx.hasScene`? `ctx.stageCanWrite`?) and answers with a reason key.
 * 5. `Drawer`    the drawer body component, `({ ctx }) => ...`, rendered under the shell's heading. A tool without a
 *                drawer sets `run(ctx)` instead (the Text tool). Strings live in `messages/{en,tr}/Spark.<package>.json`.
 * 6. `onDrop`    optional: a card of this tool (or desktop files) dropped on the canvas or the timeline (D14).
 * 7. `visible`   optional: false hides the rail button (a tool behind a UI switch that is off, e.g. Transitions).
 *
 * ## What a tool gets: `SparkToolContext`
 * `ctx.stage.controller.placeLayer(build, target)` is the ONE way to add a layer: it resolves the scene, the start frame
 * and the drop point (`StagePlacement`), sends the specs `build` returns as one command (one undo group) and selects the
 * new layer. `ctx.actions.apply(specs)` is the generic write for everything else. `ctx.toast(text)` shows a notice.
 *
 * ## Dragging a card
 * Make the card `draggable` and call `writeCardDrag(event.dataTransfer, { tool: '<id>', kind, data })`
 * (`lib/spark/stage/placement.ts`). The canvas and the timeline accept it and call the entry's `onDrop(ctx, drop, target)`
 * with `target` = `{ kind: 'canvas', point }` (the playhead scene, positioned at the point; use `centredTransformAt`) or
 * `{ kind: 'timeline', frame }` (the scene and whole second under the pointer). The "+" button on the card calls the same
 * builder with `{ kind: 'playhead' }`.
 *
 * Compatibility: `SparkToolContext` and `SparkToolEntry` only ever grow additive optional members.
 */
export const SPARK_TOOLS: readonly SparkToolEntry[] = [
  avatarTool,
  textTool,
  mediaTool,
  shapeTool,
  motionTool,
  transitionsTool,
  animationsTool,
  captionsTool,
  recordTool,
]

/** The rail tools shown for this context (a tool behind a UI switch that is off is not listed). */
export function visibleSparkTools(ctx: SparkToolContext): readonly SparkToolEntry[] {
  return SPARK_TOOLS.filter((tool) => tool.visible?.(ctx) ?? true)
}

export function sparkToolById(id: string): SparkToolEntry | undefined {
  return SPARK_TOOLS.find((tool) => tool.id === id)
}

/** The tool that handles a drop: the owner of a dragged card; desktop files go to the Media tool. */
export function sparkToolForDrop(drop: SparkToolDrop): SparkToolEntry | undefined {
  return sparkToolById(drop.kind === 'card' ? drop.drag.tool : ('media' satisfies SparkToolId))
}

export { acceptsToolDrop }
