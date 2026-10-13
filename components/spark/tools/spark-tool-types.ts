import type * as React from 'react'

import type { SparkProject } from '@/lib/spark/api'
import type { CompositionDocument, CompositionScene } from '@/lib/spark/composition-client'
import type { SparkCompositionActions, SparkCompositionState } from '@/lib/spark/composition-session'
import type { SparkEffectsSwitches } from '@/lib/spark/effects/effects-switches'
import type { PlacementTarget, SparkToolDrop } from '@/lib/spark/stage/placement'
import type { PlacementNotice } from '@/lib/spark/stage/stage-controller'

import type { SparkStageBinding } from '../stage/use-spark-stage'

/**
 * Types of the editor's tool registry (`spark-tool-registry.ts`). The shell owns the rail and the drawer frame; a tool
 * owns its entry (`entries/<id>-tool.ts`) and its drawer component. Everything a tool may read or call arrives through
 * ONE `SparkToolContext` object, so adding a field there never breaks a tool.
 */

/** The rail tools of the design that open a drawer or act (the "Scenes" list is the shell's own drawer). */
export type SparkToolId = 'avatar' | 'text' | 'media' | 'shape' | 'motion' | 'transitions' | 'animations' | 'captions' | 'record'

/** A scene of the strip with its resolved length and start second (what the shell derives from the document). */
export type TimelineScene = {
  scene: CompositionScene
  number: number
  seconds: number | null
  start: number
}

export type StockAvailability = 'loading' | 'available' | 'unavailable'

export type SparkToolContext = {
  project: SparkProject
  /** The session state of this render (a long-running callback reads `latest()` instead). */
  composition: SparkCompositionState
  /** The session state RIGHT NOW (updated after every render): what an `await` continuation must read, never `composition`. */
  latest(): SparkCompositionState
  /** The newest context (updated after every render): an `await` continuation or a long-lived service reads this, never `ctx`. */
  current(): SparkToolContext
  /**
   * A per-editor service of a tool (an upload queue, a library cache), created on first use and kept while the editor is
   * open: it survives the drawer closing, so a running upload is not lost when the user switches to another tool.
   * `dispose()` is called when the editor goes away.
   */
  service<T extends { dispose(): void }>(key: string, create: () => T): T
  /** The session's actions: `apply(specs)` (one command, one undo group), `refresh()`, `insertSourceClip` (stage off). */
  actions: SparkCompositionActions
  document: CompositionDocument | null
  /** The WYSIWYG stage; null while `SPARK_STAGE_ENABLED` is off (then a tool falls back or stays disabled). */
  stage: SparkStageBinding | null
  /** The shell's write rule: not read-only and no write in flight (a button). */
  canWrite: boolean
  /** The stage's write rule: follows the role only (a gesture queues behind a save). */
  stageCanWrite: boolean
  /** "View only" title while the project is read-only, else undefined. */
  writeTitle: string | undefined
  /** The strip holds at least one scene. */
  hasScene: boolean
  /** The platform Stock gate (`MEDIA_CATALOG_PLATFORM_STOCK_ENABLED`); only the Stock TAB depends on it. */
  stockAvailability: StockAvailability
  /** Test seam of the Stock gate read (the shell's `stockStatus` prop). */
  stockStatus?: () => Promise<{ source_status: string }>
  /** Opens a tool's drawer (closes nothing else); `closeDrawer` collapses the drawer. */
  openDrawer(id: SparkToolId): void
  closeDrawer(): void
  /** A short notice in the editor's toast (a translated sentence). `error` shows the cross instead of the check. */
  toast(text: string, tone?: 'ok' | 'error'): void
  /** A notice from a message key under `Spark.editor` (the shell translates it): `notify('media.notices.notReady', undefined, 'error')`. */
  notify(key: string, values?: Record<string, string | number>, tone?: 'ok' | 'error'): void
  /** Tells the user what a placement did beyond the insert (a video trimmed to the scene, the scene following it; D11). */
  placementNotice(notice: PlacementNotice): void
  /** The UI pod's `MOTION_UI_ENABLED` switch (E1-D): the Motion tool opens only with it. Absent = off. */
  motionEnabled?: boolean
  /** The UI language (`en` or `tr`): a tool that shows a catalogue title picks its language. */
  locale?: string
  /** Translates a message key under `Spark.editor` for a notice raised outside React (a drop onto the canvas or the timeline). */
  translate?(key: string, values?: Record<string, string | number>): string
  /** Spark effects: the UI pod's Transitions browser / Animations panel switches. Absent = both off. */
  effects?: SparkEffectsSwitches
  /** Spark effects WP0: selects the incoming scene of a cut and opens Properties on its Transition section. */
  openTransitionProperties?(sceneId: string): void
}

/** What the rail button of a tool does: `titleKey` is a message key under `Spark.editor` (the shell translates it). */
export type SparkToolAvailability = { enabled: true; titleKey?: string } | { enabled: false; titleKey: string }

export type SparkToolDrawerProps = { ctx: SparkToolContext }

export type SparkToolEntry = {
  id: SparkToolId
  /** Symbol of the studio icon sprite without the `i-` prefix. */
  icon: string
  /** Rail label and drawer heading: a key under `Spark.editor` (e.g. `tools.media`). */
  labelKey: string
  /**
   * Whether the rail shows the tool at all (absent = always). A tool behind a UI switch that is off is not listed, instead
   * of a "coming soon" button (Spark effects: Transitions, Animations).
   */
  visible?(ctx: SparkToolContext): boolean
  /**
   * Whether the rail button works now. A tool that is not connected returns `{ enabled: false, titleKey: 'comingSoon' }`
   * (the shell shows "<label> · Coming soon"); a connected one reads the context (stage on, a scene exists, role).
   */
  availability(ctx: SparkToolContext): SparkToolAvailability
  /** The drawer body (rendered inside the shell's `.drawer-inner` under the heading); a tool with a drawer sets this. */
  Drawer?: React.ComponentType<SparkToolDrawerProps>
  /** A tool without a drawer acts on click (the Text tool adds a text layer). */
  run?(ctx: SparkToolContext): void
  /**
   * A card of this tool was dropped on the canvas or the timeline (D14), or desktop files were dropped (the Media tool
   * takes those). Resolve true when something was placed. One drop = one command.
   */
  onDrop?(ctx: SparkToolContext, drop: SparkToolDrop, target: PlacementTarget): Promise<boolean>
}
