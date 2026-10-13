'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { SparkProject } from '@/lib/spark/api'
import type { SparkCompositionActions, SparkCompositionState } from '@/lib/spark/composition-session'
import { PlaybackStore } from '@/lib/spark/playback-store'
import { withLocalMedia } from '@/lib/spark/media/local-media'
import { setLiveFxLocalOps } from '@/lib/spark/optimistic/document-ops'
import { createLocalPreviewSource } from '@/lib/spark/optimistic/local-preview-source'
import { createSparkPreviewStore } from '@/lib/spark/preview-store'
import { createStageCoverageChecker } from '@/lib/spark/stage/coverage-client'
import { loadInspectorSchema, type InspectorSchema } from '@/lib/spark/stage/inspector-schema'
import { loadMotionRuntime, type MotionRuntimeModule } from '@/lib/spark/stage/runtime-api'
import { createMediaSizeResolver, type MediaSizeResolver } from '@/lib/spark/stage/media-size'
import { createStorageMediaResolver, previewSourceFromStore } from '@/lib/spark/stage/preview-source'
import { sceneAtFrame, sceneStartFrame } from '@/lib/spark/stage/scene-plan'
import { SparkStageController } from '@/lib/spark/stage/stage-controller'
import { stageSessionPort } from '@/lib/spark/stage/stage-session'
import type { StageSelection } from '@/lib/spark/stage/stage-selection'
import type { StageCoverageChecker, StagePreviewSource } from '@/lib/spark/stage/stage-types'

/**
 * Creates the stage controller for one project when the stage switch is on (`enabled`), keeps it in step with the
 * editor session (working copy in, commands out) and keeps the session's selected scene and the playhead together: a
 * scene picked on the strip or in the list moves the playhead to its start; playback or scrubbing into another scene
 * selects it. The hook does not subscribe to the stage state, so the shell re-renders only when the session does; the
 * components that show stage state subscribe themselves.
 */

type StageCore = { controller: SparkStageController; playback: PlaybackStore }

export type SparkStageBinding = {
  controller: SparkStageController
  playback: PlaybackStore
  /** The inspector schema once it is read (null while loading or when unavailable): Properties and toolbox follow it. */
  schema: InspectorSchema | null
}

export type AskAiHandler = (target: { selection: StageSelection | null; playheadFrame: number }) => void

/**
 * The server-side collaborators of the stage, each one replaceable: tests feed recorded fixtures. The default preview
 * source is Y1-07's `SparkPreviewStore` (manifest kept in step with the session, ETag revalidation, stale handling, pinned
 * font gate) behind the stage's interface (`previewSourceFromStore(store, media)`).
 */
export type SparkStageOverrides = {
  source?: StagePreviewSource
  loadRuntime?: () => Promise<MotionRuntimeModule>
  loadSchema?: () => Promise<InspectorSchema>
  coverage?: StageCoverageChecker | null
  /** WP2 test seam: the stage's idle check delay (`StageControllerOptions.verifyIdleMs`; null = no automatic check). */
  verifyIdleMs?: number | null
  /** The pixel size of a project source (tests feed fixed sizes; by default it is read from the picture). */
  mediaSize?: MediaSizeResolver
}

export function useSparkStage(input: {
  enabled: boolean
  /**
   * `SPARK_CONTEXT_TOOLBAR_ENABLED`: the canvas behaviour of the contextual toolbar (shortcuts, media that covers the canvas
   * when it is added). Read once, when the stage is created.
   */
  contextToolbar?: boolean
  /** `SPARK_REDO_ENABLED`: the editor owns the redo keys (read once, when the stage is created). */
  historyKeys?: boolean
  /**
   * `SPARK_LIVE_FX_PREVIEW_ENABLED`: the stage blends transitions and compiles animations itself, and their edits are applied
   * to the editor's own copy at once. Read once, when the stage is created.
   */
  liveFx?: boolean
  project: SparkProject
  composition: SparkCompositionState
  actions: SparkCompositionActions
  onAskAi: AskAiHandler
  overrides?: SparkStageOverrides
}): SparkStageBinding | null {
  const { enabled, project, composition, actions, onAskAi } = input
  const { overrides } = input
  const overridesRef = React.useRef(overrides)
  const contextToolbarRef = React.useRef(input.contextToolbar === true)
  const historyKeysRef = React.useRef(input.historyKeys === true)
  const liveFxRef = React.useRef(input.liveFx === true)
  const t = useTranslations('Spark.editor.stage')
  // What the long-lived controller reads at call time: refreshed after every render, never written during one.
  const newText = t('newText')
  const latest = React.useRef({ composition, actions, onAskAi, newText })
  React.useLayoutEffect(() => {
    latest.current = { composition, actions, onAskAi, newText }
    overridesRef.current = overrides
  })
  const schemaRef = React.useRef<InspectorSchema | null>(null)
  const [schema, setSchema] = React.useState<InspectorSchema | null>(null)

  // The controller and the clock are created once and outlive every render; `latest` and `schemaRef` are only read when the
  // controller calls back (an event, a frame, a response), never while rendering.
  const projectId = project.id
  const channelId = project.channelId
  const build = React.useCallback((): StageCore => {
    const playback = new PlaybackStore()
    const storageMedia = createStorageMediaResolver(channelId)
    // WP5a (instant editing): a file picked in this tab is drawn / played from the local file, not downloaded again.
    const media = latest.current.composition.optimistic === true ? withLocalMedia(storageMedia) : storageMedia
    const overrides = overridesRef.current
    // E1-N: with optimistic writes the source can also draw the editor's own copy of the document (see `local-preview-source.ts`).
    const store = overrides?.source ? null : createSparkPreviewStore({ projectId })
    const server = overrides?.source ?? previewSourceFromStore(store!, media)
    const controller = new SparkStageController({
      source: store && latest.current.composition.optimistic === true ? createLocalPreviewSource({ base: server, store, media, liveFx: liveFxRef.current }) : server,
      loadRuntime: () => (overridesRef.current?.loadRuntime ?? loadMotionRuntime)(),
      media,
      session: stageSessionPort(
        {
          apply: (specs, options) => latest.current.actions.apply(specs, options),
          select: (sceneId) => latest.current.actions.select(sceneId),
          refresh: (options) => latest.current.actions.refresh?.(options) ?? Promise.resolve(),
        },
        () => latest.current.composition,
      ),
      playback,
      doc: document,
      coverage: overrides && 'coverage' in overrides ? overrides.coverage : createStageCoverageChecker(),
      fonts: () => schemaRef.current?.fonts ?? null,
      schema: () => schemaRef.current ?? null,
      contextToolbar: contextToolbarRef.current,
      historyKeys: historyKeysRef.current,
      liveFx: liveFxRef.current,
      mediaSize: overrides?.mediaSize ?? createMediaSizeResolver(media, { timeoutMs: 1500 }),
      labels: {
        get newText() {
          return latest.current.newText
        },
      },
      onAskAi: (target) => latest.current.onAskAi(target),
      ...(overrides && 'verifyIdleMs' in overrides && { verifyIdleMs: overrides.verifyIdleMs }),
    })
    return { controller, playback }
  }, [projectId, channelId])

  // The stage draws into the DOM: it exists only in the browser (the editor opens client-side, after the project loads).
  // eslint-disable-next-line react-hooks/refs
  const [core, setCore] = React.useState<StageCore | null>(() => (enabled && typeof document !== 'undefined' ? build() : null))
  const coreRef = React.useRef(core)
  React.useEffect(() => {
    coreRef.current = core
  }, [core])

  // Lifecycle: the stage is disposed when the editor goes away. React StrictMode (`next dev`) runs every effect twice, and its
  // first cleanup disposes the controller, so the second run builds a fresh one instead of reviving a disposed object.
  React.useEffect(() => {
    if (!enabled) return undefined
    if (coreRef.current?.controller.isDisposed) {
      coreRef.current = build()
      setCore(coreRef.current)
    }
    return () => {
      coreRef.current?.controller.dispose()
      coreRef.current?.playback.dispose()
    }
  }, [enabled, build])

  // Live FX: the transition and animation edits are applied to the editor's own copy at once while the stage is on.
  const liveFxOps = enabled && input.liveFx === true
  React.useLayoutEffect(() => {
    setLiveFxLocalOps(liveFxOps)
    return () => setLiveFxLocalOps(false)
  }, [liveFxOps])

  // The inspector schema (controls per layer kind, the font catalogue for new text): one read per page.
  React.useEffect(() => {
    if (!core) return undefined
    let active = true
    ;(overridesRef.current?.loadSchema ?? loadInspectorSchema)().then(
      (value) => {
        if (!active) return
        schemaRef.current = value
        setSchema(value)
        // E1-N: the face of a new text is fetched now, so that "Text" needs no download when it is pressed.
        core.controller.prepareText()
      },
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [core])

  // Working copy in: every change of the session's copy reads and draws the new preview.
  const copy = composition.workingCopy
  // Layout effect: the copy of an edit (the new scene, text or shape) reaches the stage in the same commit as the click,
  // before the browser paints (E1-N); a plain effect would draw it a frame later.
  React.useLayoutEffect(() => {
    if (!core || !copy) return
    core.controller.setWorkingCopy({ version: copy.workingCopyVersion, document: copy.document, ...(copy.localRevision !== undefined && { localRevision: copy.localRevision }) })
  }, [core, copy])

  // Session selection <-> playhead. `wantedScene` is the scene that should hold the playhead: what the user picked, or the
  // scene playback just entered. It is a ref, set the moment either side moves, because React renders the session's new
  // selection later than playback reports a new frame: a presenter update in between must not read the old selection and
  // drag the playhead back into the scene it just left.
  const selectedSceneId = composition.selectedSceneId
  const wantedScene = React.useRef<string | null>(selectedSceneId)
  React.useEffect(() => {
    if (!core) return undefined
    wantedScene.current = selectedSceneId
    const { controller, playback } = core
    // Picking another scene (strip, list, playback entering it) leaves the layer selection of the old scene behind: the
    // selection is cleared to the scene itself, so Properties and the toolbox never show a layer the canvas no longer draws.
    const picked = controller.selection.getSnapshot()
    if (selectedSceneId && picked && picked.sceneId !== selectedSceneId) controller.selection.selectScene(selectedSceneId)
    const follow = () => {
      const wanted = wantedScene.current
      const plan = controller.presenter.plan
      if (!plan || !wanted || playback.playing) return
      const at = sceneAtFrame(plan, playback.frame)
      if (at?.scene.sceneId === wanted) return
      const start = sceneStartFrame(plan, wanted)
      // The clock learns a new plan one step after the plan is read (`configure`): a scene that starts past the clock's
      // current end (one just added) is reached once the clock has been configured. Seeking now would clamp the playhead
      // back into the scene it is already in, and playback entering that scene would select it again, undoing the pick.
      if (start === null || start >= playback.getSnapshot().totalFrames) return
      playback.seek(start)
    }
    follow()
    // A new plan (a scene picked before the plan was read, scenes reordered or resized) re-checks once. Not every presenter
    // update: scene loads publish synchronously inside a frame change, before the frame listener below has run.
    let seenPlan = controller.presenter.plan
    const stopPlan = controller.presenter.subscribe(() => {
      const plan = controller.presenter.plan
      if (plan === seenPlan) return
      seenPlan = plan
      follow()
    })
    // ...and once more when the clock has been configured for that plan (its length changed, so it now covers the wanted
    // scene). Only a change of length: every seek also notifies, and a scrub must not be pulled back to the picked scene.
    let seenTotal = playback.getSnapshot().totalFrames
    const stopClock = playback.subscribe(() => {
      const total = playback.getSnapshot().totalFrames
      if (total === seenTotal) return
      seenTotal = total
      follow()
    })
    return () => {
      stopPlan()
      stopClock()
    }
  }, [core, selectedSceneId])

  React.useEffect(() => {
    if (!core) return undefined
    const { controller, playback } = core
    return playback.subscribeFrame((frame) => {
      const plan = controller.presenter.plan
      if (!plan) return
      const at = sceneAtFrame(plan, frame)
      if (!at || at.scene.sceneId === wantedScene.current) return
      wantedScene.current = at.scene.sceneId
      latest.current.actions.select(at.scene.sceneId)
    })
  }, [core])

  return React.useMemo(() => (core ? { ...core, schema } : null), [core, schema])
}
