'use client'

import * as React from 'react'
import localFont from 'next/font/local'
import { useTheme } from 'next-themes'
import { useLocale, useTranslations } from 'next-intl'

import type { SparkAspectRatio, SparkProject } from '@/lib/spark/api'
import {
  orderedScenes,
  sceneDurationSeconds,
  type CompositionDocument,
} from '@/lib/spark/composition-client'
import type { SparkCompositionActions, SparkCompositionState, SparkNotice } from '@/lib/spark/composition-session'
import { NEW_SCENE_SECONDS } from '@/lib/spark/composition-session'
import { afterSceneIdForDrop, listWindow, scrollTopFor, stripKeyAction } from '@/lib/spark/scene-strip'
import { sceneStatus, type SceneStatus } from '@/lib/spark/scene-status'
import { ScenePosterBoard, resolveScenePosters, type ScenePosterUrlResolver } from '@/lib/spark/scene-posters'
import {
  blockCss,
  stripAxis,
  stripCss,
  stripX,
  timelineTracks,
  type StripAxis,
  type TimelineTrackBlock,
} from '@/lib/spark/timeline-tracks'
import { effectiveTimelineDensity } from '@/lib/spark/view-preference'
import { createEntrySequence, createSparkQuickAiSession } from '@/lib/spark/quick-ai-session'
import {
  chatLayerIdsOf,
  chatPlayheadOf,
  chatTimeRangeOf,
  planAskAi,
  playheadForScene,
  withoutLayers,
  withoutTimeRange,
  type SparkAskAiState,
} from '@/lib/spark/ask-ai'
import {
  formatFrameRangeLabel,
  layerChipsOf,
  sceneNumberOf,
  textLayerView,
  type SparkAskAi,
  type SparkElementSelection,
  type SparkPlaybackReader,
} from '@/lib/spark/spark-selection'
import { sparkAddSceneMode, sparkAddSceneReasonKey } from '@/lib/spark/template-policy'
import { frameAtStrip, seekTargetAtX, stripPlayhead, type StripCardRect } from '@/lib/spark/stage/playhead-map'
import { formatFrameTime, framesToSeconds } from '@/lib/spark/stage/scene-plan'
import { acceptsToolDrop, readToolDrop, type PlacementTarget, type SparkToolDrop } from '@/lib/spark/stage/placement'
import { singleLayerId } from '@/lib/spark/stage/stage-selection'
import { buildSparkMessageContext, sparkComposerContext } from '@/lib/spark/spark-chat-context'
import type { ComposerChip } from '@/lib/assistant/composer/composer-state'
import { undoMotionPlacement, type MotionUndoOutcome } from '@/lib/spark/motion-placement-undo'
import { motionLayerViewOf } from '@/lib/spark/motion-layers'
import type { RevertMemory } from '@/lib/spark/motion-code/motion-revert'
import type { MotionSource } from '@/lib/spark/motion-code/motion-source'
import { createSparkSideChatSession, openSparkChatQuestion } from '@/lib/spark/spark-side-chat'
import { sparkChatJobStatus } from '@/lib/spark/side-chat-job-notice'
import { useConversationJobs } from '@/lib/assistant/composer/use-conversation-jobs'
import { useRefreshOnAgentJobEnd } from '@/lib/spark/use-agent-job-refresh'
import { useSparkExport } from '@/lib/spark/use-spark-export'
import { SPARK_EFFECTS_OFF, type SparkEffectsSwitches } from '@/lib/spark/effects/effects-switches'
import { sceneClearTransitionSpec, sceneSetTransitionSpec } from '@/lib/spark/composition-typed-edits'
import { OutlineThumbnails, storageThumbnailResolver } from '@/lib/spark/outline/outline-thumbnails'
import { createTimelineMediaPreviews, type TimelineMediaPreviews } from '@/lib/spark/timeline/timeline-media-previews'
import { findScriptJob, projectHasScript } from '@/lib/spark/script-job'
import { useScriptReviewHost } from '@/components/chat/script-review/script-review-host'

import { SceneChapterList } from './scene-chapter-list'
import { SparkScriptReviewCover } from './spark-script-review-cover'
import { SparkAssistantPane } from './spark-assistant-pane'
import { SparkOpenInChat } from './spark-open-in-chat'
import { SparkExportDialog } from './spark-export-dialog'
import { useStockAvailability } from './spark-stock-drawer'
import { SparkTextLayerMenu, clampMenuPosition, type SparkLayerMenuAnchor } from './spark-quick-ai'
import { SparkLayerInspector } from './stage/spark-layer-inspector'
import { SparkMotionCodeTab, type SparkMotionCodeResult } from './stage/spark-motion-code-tab'
import { SparkStage } from './stage/spark-stage'
import { useSparkStage, type SparkStageBinding, type SparkStageOverrides } from './stage/use-spark-stage'
import { useMotionSource } from './stage/use-motion-source'
import { usePlaybackFrame, usePlaybackSnapshot, useStageSelection, useStageState } from './stage/use-stage-state'
import { useAssistantMotionApply } from './use-assistant-motion-apply'
import { useHistoryShortcuts } from './use-history-shortcuts'
import { STUDIO_ICON_SPRITE } from './studio/studio-icons'
import { ScenePanel } from './tools/scene-panel'
import { mediaLibraryOf } from './tools/media/media-services'
import { SceneVoiceJobs } from './tools/scene-voice-jobs'
import { sparkToolById, sparkToolForDrop, visibleSparkTools } from './tools/spark-tool-registry'
import type { SparkToolContext, SparkToolId, TimelineScene } from './tools/spark-tool-types'
import { EmptyNote, Icon, formatDuration, formatSeconds } from './tools/studio-parts'
import { SparkToolBridge } from './tools/tool-bridge'
import { SparkSaveChip } from './spark-save-chip'
import { ToolToast, type ToolNotice } from './tools/tool-toast'
import { TransitionChips } from './tools/transition-chips'
import { applyTransitionKind, applyTransitionLength, applyTransitionToAll, previewCut } from './tools/transition-actions'
import { SparkTimelineDock } from './timeline/spark-timeline-dock'
import './studio/studio.css'
import './tools/tools.css'

// Display face of the Spark design; used for headings on the canvas. Self-hosted (latin +
// latin-ext, see app/fonts/THIRD_PARTY_FONTS.md) so that `next build` never downloads from Google Fonts.
const instrumentSans = localFont({
  src: '../../app/fonts/InstrumentSans-Variable.woff2',
  weight: '400 600',
  style: 'normal',
  variable: '--font-instrument-sans',
  display: 'swap',
})

/** What the drawer shows: the shell's own scene list, or a tool of the registry (`components/spark/tools`). */
type DrawerTool = 'scenes' | SparkToolId

const BRAND_ICON = 'palette'

const RATIO: Record<SparkAspectRatio, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 }
// Matches the design's viewport padding (40px top, 48px sides, 64px bottom).
const FRAME_PADDING = { x: 96, y: 104 }
// The design shows a notice for 2.2 s.
const NOTICE_MS = 2200

/**
 * Spark editor for one server-side project. Scenes, the timeline and the canvas show the
 * project's Composition working copy; adding, deleting and reordering scenes and undo are
 * composition commands (P02-01). The scene panel's music switch and the captions drawer turn
 * existing audio/captions off with P02-06 typed edits. Layers are edited through canvas selection
 * in the design and the canvas does not draw layers yet; media, avatar, assistant and export are
 * not connected either, so their controls stay visible but disabled as "coming soon".
 */
export function SparkEditorShell({
  project,
  composition,
  actions,
  backLabel,
  onBack,
  posterUrl,
  stockStatus,
  playback: playbackProp,
  onOpenChat,
  exportEnabled = false,
  stageEnabled = false,
  motionEnabled = false,
  stageOverrides,
  effects = SPARK_EFFECTS_OFF,
  contextMeterEnabled = false,
  contextToolbarEnabled = false,
  timelineEditing = false,
  liveFx = false,
  motionCodeEnabled = false,
}: {
  project: SparkProject
  composition: SparkCompositionState
  actions: SparkCompositionActions
  backLabel: string
  onBack: () => void
  /**
   * P02-16 scene card posters (P02-13 cache). Poster delivery is P06-46; until a resolver exists
   * the cards keep the design's empty thumbnail and no poster is requested.
   */
  posterUrl?: ScenePosterUrlResolver
  /** P06-16: reads the platform Stock gate (the Media tool stays disabled until it is available, F26). */
  stockStatus?: () => Promise<{ source_status: string }>
  /**
   * Y1-07 W8: a playback clock supplied from outside (tests, a host that owns playback). Every chat message carries its
   * CURRENT frame as the playhead; with the stage on, the stage's own clock is used instead. Without either, the playhead
   * is the start of the selected scene (or the frame of the last "Ask AI" click).
   */
  playback?: SparkPlaybackReader
  /** Y1-07 W9: opens the project's linked chat on the Chat page (`/chat?id=…`); absent = no "Open in Chat" button. */
  onOpenChat?: (path: string) => void
  /**
   * Y1-07 W10: the UI switch of the export dialog (`SPARK_EXPORT_ENABLED` of the UI pod, default off). Off keeps the
   * design's `Generate` button passive ("coming soon"); on, it opens the export dialog, which shows the server's price,
   * state and refusals honestly (the render itself is gated by the gateway).
   */
  exportEnabled?: boolean
  /**
   * Y1-08: the WYSIWYG stage (the compiled scene, playback, selection and gestures, toolbox, context menu, layer
   * Properties, rail "add text" / "add media"). The `SPARK_STAGE_ENABLED` switch, read by the editor page; off (default)
   * the editor keeps its empty frame and its disabled controls.
   */
  stageEnabled?: boolean
  /**
   * E1-D: the UI switch of the Motion tool (`MOTION_UI_ENABLED` of the UI pod, default off). On (with the stage), the rail
   * "Motion" opens the Motion drawer and a selected Motion layer shows its fields in Properties.
   */
  motionEnabled?: boolean
  /** Replaces the stage's server collaborators (tests); by default the stage reads Y1-07's preview store. */
  stageOverrides?: SparkStageOverrides
  /**
   * Spark effects: the UI switches of the Transitions browser (`SPARK_TRANSITIONS_BROWSER_ENABLED`) and the Animations panel
   * (`SPARK_ANIMATIONS_PANEL_ENABLED`), both off by default.
   */
  effects?: SparkEffectsSwitches
  /** The side chat's context ring (`SPARK_CONTEXT_METER_ENABLED` of the UI pod, default off); it replaces the spend chip. */
  contextMeterEnabled?: boolean
  /**
   * The stage's contextual toolbar (`SPARK_CONTEXT_TOOLBAR_ENABLED`, default off): the per-kind floating toolbar, Ctrl/Cmd+D /
   * C / V and the "?" sheet, media that covers the canvas when added, and the canvas format switch.
   */
  contextToolbarEnabled?: boolean
  /**
   * Timeline v2 / v3 (`SPARK_TIMELINE_EDITING_ENABLED` of the UI pod, default off): the CapCut-like timeline replaces the
   * scene strip and the expanded rows of the dock (`components/spark/timeline`), and the left Scenes list shows its scenes
   * under their chapter headings (`scene-chapter-list.tsx`; the v2 Outline is no longer shown).
   */
  timelineEditing?: boolean
  /**
   * Live FX preview (`SPARK_LIVE_FX_PREVIEW_ENABLED` of the UI pod, default off): the stage blends transitions and compiles
   * animations itself and applies their edits at once (`lib/spark/stage/live-fx-switch.ts`).
   */
  liveFx?: boolean
  /**
   * The Code tab (`SPARK_MOTION_CODE_TAB_ENABLED` of the UI pod, default off; owner decision 2026-10-04): a third tab next to
   * Assistant | Properties that shows the readable source of the selected Motion layer's pinned revision (editable with
   * `motionEnabled`), and the Assistant's revision of the selected Motion layer applied to it at once with an Undo in the chat.
   * Needs the stage. Off, the right panel has exactly its two tabs.
   */
  motionCodeEnabled?: boolean
}) {
  const t = useTranslations('Spark.editor')
  const { resolvedTheme, setTheme } = useTheme()
  const sceneListScrollRef = React.useRef<HTMLDivElement>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(true)
  const [drawerTool, setDrawerTool] = React.useState<DrawerTool>('scenes')
  const [rightOpen, setRightOpen] = React.useState(true)
  const [rightTab, setRightTab] = React.useState<'assistant' | 'props' | 'code'>('assistant')
  const comingSoon = t('comingSoon')
  const stockAvailability = useStockAvailability(stockStatus)
  const placementT = useTranslations('Spark.editor.placement')
  const [toolNotice, setToolNotice] = React.useState<ToolNotice | null>(null)
  // What a tool's `await` continuation reads (the session state and context RIGHT NOW) and the per-editor tool services
  // (an upload queue, a library cache) that outlive the drawer: see `tools/tool-bridge.ts`.
  const [toolBridge] = React.useState(() => new SparkToolBridge())
  React.useEffect(() => toolBridge.mount(), [toolBridge])

  const document = composition.workingCopy?.document ?? null
  const timeline = React.useMemo(() => (document ? timelineOf(document) : []), [document])
  const axis = React.useMemo(() => (document ? stripAxis(document, NEW_SCENE_SECONDS) : null), [document])
  const selected = timeline.find((entry) => entry.scene.scene_id === composition.selectedSceneId) ?? null
  // P02-16 / S14: the saved compact/expanded choice, or the SAHNE §2 default when there is none.
  const expanded = effectiveTimelineDensity(composition.timelineDensity, document) === 'expanded'
  const dockRef = React.useRef<HTMLDivElement>(null)
  const lane = useStripLane(dockRef, expanded)
  // E1-N: with optimistic writes an edit never waits for a save: further edits queue behind it and show at once.
  const canWrite = !composition.readOnly && (composition.optimistic === true || !composition.saving)
  const writeTitle = composition.readOnly ? t('readOnly') : undefined
  // P06-03: a template-bound project's `+` follows the pinned extension policy (passive + reason when not freeform).
  const addSceneReasonKey = sparkAddSceneReasonKey(sparkAddSceneMode(document))
  const addSceneTitle = writeTitle ?? (addSceneReasonKey ? t(addSceneReasonKey) : undefined)
  const canAddScene = canWrite && addSceneReasonKey === null
  const ratio = document?.canvas.aspect_ratio ?? project.aspectRatio
  // The stage's own controls follow the session's role, not its "saving" flag: a gesture queues behind a save (Y1-07).
  const stageCanWrite = !composition.readOnly
  const hasScene = timeline.length > 0

  // QA-068: the text layer the user picked (local view state; it follows the selected scene) and the quick AI lane.
  // QA-081: the side chat shares the Assistant tab's arrival order with the quick AI cards.
  const [entrySequence] = React.useState(() => createEntrySequence())
  const quickAi = useSparkQuickAi(project.id, composition, actions, entrySequence)
  const sideChat = useSparkSideChat(project, entrySequence, actions.refresh)
  const locale = useLocale()
  // Y1-07 W10: the export dialog and its session (a running export survives closing the dialog).
  const exporter = useSparkExport(project.id)
  const [exportOpen, setExportOpen] = React.useState(false)
  const promptRef = React.useRef<HTMLTextAreaElement>(null)
  const [elementSelection, setElementSelection] = React.useState<SparkElementSelection | null>(null)
  const [layerMenu, setLayerMenu] = React.useState<SparkLayerMenuAnchor | null>(null)
  const focusedText = elementSelection?.sceneId === composition.selectedSceneId ? textLayerView(document, elementSelection) : null
  // QA-081: a scene the user picks on the timeline or in the scene list becomes the side chat's selection (removable
  // for a general request); the initial selection of an opened project is not a pick, so it is not sent.
  const [chatSceneId, setChatSceneId] = React.useState<string | null>(null)
  const chatScene = chatSceneId !== null && chatSceneId === composition.selectedSceneId ? chatSceneId : null
  // Y1-07 W8: what "Ask AI" (canvas toolbox, timeline block menu) added to the next message next to the scene: the
  // layers, the marked time range and the playhead of the click. Local view state like the scene pick.
  const [askSelection, setAskSelection] = React.useState<SparkAskAiState | null>(null)
  const openAssistant = (focusPrompt: boolean) => {
    setRightOpen(true)
    setRightTab('assistant')
    if (focusPrompt) window.requestAnimationFrame(() => promptRef.current?.focus())
  }
  const pickText = (selection: SparkElementSelection) => {
    actions.select(selection.sceneId)
    setChatSceneId(selection.sceneId)
    setElementSelection(selection)
    setAskSelection(null)
  }
  const pickActions: SparkCompositionActions = {
    ...actions,
    select: (sceneId) => {
      actions.select(sceneId)
      setChatSceneId(sceneId)
      setAskSelection(null)
    },
  }
  /**
   * W8 "Ask AI": opens the Assistant tab (also when the panel is closed), focuses the prompt and points the next
   * message at the selection: its scene, its layers (a single text layer is also the quick lane's focus), the marked
   * range and the playhead of the click. Called by the canvas toolbox / context menu and the timeline block menu.
   */
  const askAi: SparkAskAi = (target) => {
    const plan = planAskAi(document, target)
    if (plan.sceneId) {
      actions.select(plan.sceneId)
      setChatSceneId(plan.sceneId)
      setElementSelection(plan.focusText)
    }
    setAskSelection(plan.state)
    openAssistant(true)
  }
  // The layers of the next message: the focused text plus the layers Ask AI added, inside the scene the message is
  // about. The time range travels without a scene too.
  const chatLayerIds = chatLayerIdsOf(chatScene, focusedText?.layerId ?? null, askSelection)
  const chatTimeRange = chatTimeRangeOf(askSelection)
  const removeChatLayers = (layerIds: readonly string[]) => {
    setElementSelection((current) => (current && layerIds.includes(current.layerId) ? null : current))
    setAskSelection((current) => withoutLayers(current, layerIds))
  }
  // Y1-08: the stage (null while the switch is off). Its toolbox / context menu "Ask AI" is Y1-07's `askAi`: the selection
  // (scene, layers) and the playhead of the click travel with the next message.
  const stage = useSparkStage({
    enabled: stageEnabled,
    contextToolbar: contextToolbarEnabled,
    historyKeys: composition.redoEnabled === true,
    liveFx,
    project,
    composition,
    actions,
    overrides: stageOverrides,
    onAskAi: askAi,
  })
  // The stage's clock is the real playhead of every chat message; `playback` (prop) only serves a host without a stage.
  const playback: SparkPlaybackReader | undefined = stage?.playback ?? playbackProp
  const stageSelection = useStageSelection(stage)
  const selectedLayerId = singleLayerId(stageSelection)
  const layerSelected = selectedLayerId !== null
  // Code tab: the selected layer when it is a document v2 Motion instance; its pinned revision's source decides whether the tab
  // is there (readable = shown, anything else = hidden). Without the switch or the stage nothing is read.
  const codeTabOn = motionCodeEnabled && stage !== null
  const selectedMotion = codeTabOn && stageSelection && selectedLayerId ? motionLayerViewOf(document, stageSelection.sceneId, selectedLayerId) : null
  const motionSource = useMotionSource(selectedMotion?.v2 ? selectedMotion.motionRef : null)
  const codeTabVisible = selectedMotion !== null && motionSource?.status === 'ready'
  // While another revision's source loads (right after an apply, an Undo or an Assistant revision) the tab keeps showing the last
  // source read-only instead of unmounting, so its notice and its text state survive the repoint.
  const [lastMotionSource, setLastMotionSource] = React.useState<MotionSource | null>(null)
  if (motionSource?.status === 'ready' && motionSource.source !== lastMotionSource) setLastMotionSource(motionSource.source)
  const codeSource = motionSource?.status === 'ready' ? motionSource.source : motionSource?.status === 'loading' ? lastMotionSource : null
  const codeTabLoading = selectedMotion !== null && motionSource?.status === 'loading'
  // The way back of a repointed layer (the revision it pinned before): view state of this editor session, keyed by the new layer.
  const [revertMemory] = React.useState<RevertMemory>(() => new Map())
  const [codeResult, setCodeResult] = React.useState<SparkMotionCodeResult | null>(null)
  // Spark effects WP0: a cut's chip selects the incoming scene (not a layer of it) and opens Properties on its Transition
  // section; the effect below scrolls the section into view and focuses its kind picker once the panel shows it.
  const rightPaneRef = React.useRef<HTMLDivElement>(null)
  const [transitionFocus, setTransitionFocus] = React.useState<{ sceneId: string; nonce: number } | null>(null)
  const openTransitionProperties = (sceneId: string) => {
    pickActions.select(sceneId)
    stage?.controller.selection.selectScene(sceneId)
    setRightOpen(true)
    setRightTab('props')
    setTransitionFocus((current) => ({ sceneId, nonce: (current?.nonce ?? 0) + 1 }))
  }
  React.useEffect(() => {
    if (!transitionFocus) return undefined
    const handle = window.requestAnimationFrame(() => {
      const section = rightPaneRef.current?.querySelector<HTMLElement>(`[data-transition-section="${transitionFocus.sceneId}"]`)
      if (!section) return
      section.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      section.querySelector<HTMLElement>('select:not(:disabled)')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(handle)
  }, [transitionFocus])
  // The Code tab leaves with its layer: no Motion layer selected, or its source turned out not to be readable.
  React.useEffect(() => {
    if (rightTab === 'code' && (selectedMotion === null || motionSource?.status === 'unavailable')) setRightTab('props')
  }, [rightTab, selectedMotion, motionSource?.status])
  // E1-D: a Motion overlay picked on the expanded timeline is the stage's layer selection; Properties shows its fields.
  const pickMotion = (sceneId: string, layerId: string) => {
    if (!stage) return
    actions.select(sceneId)
    stage.controller.selection.selectLayer(sceneId, layerId)
    setRightOpen(true)
    setRightTab('props')
  }
  // Code tab, Assistant direct apply: a revision the Assistant made from the selected Motion layer is applied to that layer at once
  // (no approval step), its card shows the applied action with the usual Undo, and the layer's new source is in the Code tab.
  const assistantApply = useAssistantMotionApply({
    enabled: codeTabOn,
    projectId: project.id,
    ready: sideChat.state.status === 'ready',
    entries: sideChat.state.entries,
    document,
    apply: actions.apply,
    onApplied: (outcome) => {
      revertMemory.set(outcome.layerId, outcome.previousRef)
      stage?.controller.selection.selectLayer(outcome.sceneId, outcome.layerId)
    },
    onNotice: () => toast(t('motionCode.assistantNotApplied'), 'error'),
  })
  const sendChat = (text: string, chips: readonly ComposerChip[] = []) => {
    const copy = composition.workingCopy
    if (!copy) return Promise.resolve(false)
    assistantApply.noteTarget(
      selectedMotion?.v2 ? { sceneId: selectedMotion.sceneId, layerId: selectedMotion.layerId, revisionId: selectedMotion.motionRef.motion_revision_id } : null,
    )
    const context = buildSparkMessageContext({
      projectId: project.id,
      workingCopyVersion: copy.workingCopyVersion,
      document: copy.document,
      selectedSceneId: chatScene,
      layerIds: chatLayerIds,
      timeRange: chatTimeRange,
      playheadFrame: chatPlayheadOf(playback, askSelection, copy.document, chatScene),
      locale,
    })
    return sideChat.session.send({ text, chips, sparkContext: sparkComposerContext(context), locale })
  }
  // E1-H: the "Motion ready" card's Undo undoes exactly the undo group of the AI's placement, then re-reads the working copy.
  const undoMotion = async (placement: { projectId: string; undoGroupId: string }): Promise<MotionUndoOutcome> => {
    if (placement.projectId !== project.id) return 'failed'
    const outcome = await undoMotionPlacement({ projectId: project.id, undoGroupId: placement.undoGroupId })
    if (outcome === 'undone') await actions.refresh?.()
    return outcome
  }

  // Design `setTool`: the open tool's button closes the drawer, another tool switches to it.
  const selectTool = (tool: DrawerTool) => {
    if (drawerOpen && drawerTool === tool) {
      setDrawerOpen(false)
      return
    }
    setDrawerTool(tool)
    setDrawerOpen(true)
  }

  // E1-A: what a tool of the registry reads and calls (`components/spark/tools/spark-tool-registry.ts`).
  const toast = (text: string, tone: 'ok' | 'error' = 'ok') => setToolNotice((current) => ({ id: (current?.id ?? 0) + 1, text, tone }))
  const toolContext: SparkToolContext = {
    project,
    composition,
    latest: toolBridge.latest,
    current: toolBridge.current,
    service: toolBridge.service,
    actions,
    document,
    stage,
    canWrite,
    stageCanWrite,
    writeTitle,
    hasScene,
    stockAvailability,
    ...(stockStatus && { stockStatus }),
    openDrawer: (id) => {
      setDrawerTool(id)
      setDrawerOpen(true)
    },
    closeDrawer: () => setDrawerOpen(false),
    toast,
    notify: (key, values, tone) => toast(t(key, values), tone),
    placementNotice: (notice) =>
      toast(
        notice.kind === 'sceneFollowsMedia'
          ? placementT('sceneFollowsMedia')
          : placementT(notice.kind === 'videoTrimmed' ? 'videoTrimmed' : 'audioTrimmed', { seconds: notice.seconds }),
      ),
    motionEnabled,
    locale,
    translate: (key, values) => t(key as never, values as never),
    effects,
    openTransitionProperties,
  }
  React.useLayoutEffect(() => {
    toolBridge.update(composition, toolContext)
  })
  const railTitle = (label: string, titleKey: string | undefined) =>
    titleKey === undefined ? undefined : titleKey === 'comingSoon' ? `${label} · ${comingSoon}` : t(titleKey)
  const activeTool = drawerTool === 'scenes' ? undefined : sparkToolById(drawerTool)
  const ActiveDrawer = activeTool?.Drawer
  // Timeline v3: the Scenes list shows its scenes under their chapter headings while timeline editing is on. The same
  // `timelineEditing` flag (`SPARK_TIMELINE_EDITING_ENABLED`, read by the page) swaps the dock for the timeline below, so
  // the chaptered list and the timeline always come and go together.
  const scenesLabel = t('scenes')
  const mediaNameOf = (storageObjectId: string) =>
    mediaLibraryOf(toolContext).getSnapshot().items.find((item) => item.id === storageObjectId)?.name ?? null
  // Delivery thumbnails of the scenes' media (timeline clips, scene cards): one board per editor, in memory only.
  const thumbnails = React.useMemo(
    () => (timelineEditing ? new OutlineThumbnails(storageThumbnailResolver(project.channelId)) : null),
    [timelineEditing, project.channelId],
  )
  // Timeline v3: the clips' filmstrips and waveforms (the `filmstrip` / `waveform` delivery variants), one in-memory store
  // per editor and channel; created in an effect so a remount (React strict mode) never keeps a disposed store.
  const [mediaPreviews, setMediaPreviews] = React.useState<TimelineMediaPreviews | null>(null)
  React.useEffect(() => {
    if (!timelineEditing) return undefined
    const store = createTimelineMediaPreviews({ channelId: project.channelId })
    setMediaPreviews(store)
    return () => {
      store.dispose()
      setMediaPreviews(null)
    }
  }, [timelineEditing, project.channelId])
  // Timeline v3 toolbar "Record" (the Record drawer) and "Script" (the project's script in the review cover).
  const recordTool = sparkToolById('record')
  const recordAvailability = recordTool ? recordTool.availability(toolContext) : { enabled: false, titleKey: 'comingSoon' }
  const scriptHost = useScriptReviewHost()
  const openScript =
    scriptHost && projectHasScript(document)
      ? () => {
          void findScriptJob({ projectId: project.id, jobIds: sideChat.jobIds }).then((jobId) => {
            if (jobId) scriptHost.open({ projectId: project.id, jobId })
            else toast(t('timelineV3.toolbar.scriptMissing'), 'error')
          })
        }
      : null

  // D14: a card of a tool (or files from the desktop) dropped on the canvas or the timeline is placed by that tool.
  const dropOnTarget = (drop: SparkToolDrop, target: PlacementTarget) => {
    const tool = sparkToolForDrop(drop)
    if (!tool?.onDrop || !stage || !stageCanWrite) return
    void tool.onDrop(toolContext, drop, target)
  }
  const [dockDropActive, setDockDropActive] = React.useState(false)
  // The absolute frame under a client x of the timeline: the strip's cards map the pointer to a scene and a fraction.
  const frameAtDockX = (clientX: number): number | null => {
    const plan = stage?.controller.presenter.plan
    const dock = dockRef.current
    if (!plan || !dock) return null
    const rects: StripCardRect[] = []
    for (const card of dock.querySelectorAll<HTMLElement>('.transport .track .seg-b[data-scene-id]')) {
      const rect = card.getBoundingClientRect()
      rects.push({ sceneId: card.dataset['sceneId'] ?? '', left: rect.left, right: rect.right })
    }
    const target = seekTargetAtX(rects, clientX)
    return target ? frameAtStrip(plan, target) : null
  }

  // Undo / redo (the header buttons and Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y): an arrow-key nudge burst still waiting for
  // its commit is committed first, so it is one undo step like a drag. With instant editing the result is drawn at once.
  const redoEnabled = composition.redoEnabled === true
  const canRedo = canWrite && composition.canRedo === true
  const undo = () => {
    stage?.controller.endNudge(true)
    void actions.undo()
  }
  const redo = () => {
    stage?.controller.endNudge(true)
    void actions.redo?.()
  }
  useHistoryShortcuts({ canWrite, redo: redoEnabled, onUndo: undo, onRedo: redo })

  // Timeline v2 (P1-B): replaces the strip dock below while its switch is on; every gesture is one command.
  const timelineDock =
    timelineEditing && document ? (
      <SparkTimelineDock
        stage={stage}
        document={document}
        selectedSceneId={composition.selectedSceneId}
        selectedLayerId={selectedLayerId}
        canWrite={stageCanWrite}
        writeTitle={writeTitle}
        apply={(specs, options) => actions.apply(specs, options)}
        transitions={
          effects.transitionsBrowser && stage
            ? {
                canWrite: stageCanWrite,
                onDropKind: (sceneId, kind) => {
                  pickActions.select(sceneId)
                  void applyTransitionKind(toolContext, [sceneId], kind, { preview: true })
                },
                onLength: (sceneId, frames) => void applyTransitionLength(toolContext, sceneId, frames),
                // The cut picker: one command per choice, then the stage plays about a second either side of the cut.
                onSet: (sceneId, transition, options) => {
                  const spec = transition ? sceneSetTransitionSpec(sceneId, transition) : sceneClearTransitionSpec(sceneId)
                  void actions.apply([spec], options?.coalesce ? { coalesceKey: `scene:${sceneId}:transition` } : undefined).then((applied) => {
                    if (applied && transition && !options?.coalesce) previewCut(toolContext, sceneId, transition.kind)
                  })
                },
                onApplyToAll: (transition) => void applyTransitionToAll(toolContext, transition),
              }
            : undefined
        }
        onSelectScene={(sceneId) => {
          pickActions.select(sceneId)
          stage?.controller.selection.selectScene(sceneId)
        }}
        onSelectLayer={(sceneId, layerId) => {
          pickActions.select(sceneId)
          stage?.controller.selection.selectLayer(sceneId, layerId)
        }}
        onOpenTransition={openTransitionProperties}
        onToolDrop={(drop, frame) => dropOnTarget(drop, { kind: 'timeline', frame, exact: true })}
        onNotice={(text, tone) => toast(text, tone)}
        thumbnails={thumbnails}
        {...(mediaPreviews && { mediaPreviews })}
        mediaName={mediaNameOf}
        record={
          recordTool && stage
            ? {
                onOpen: () => {
                  setDrawerTool('record')
                  setDrawerOpen(true)
                },
                disabled: !recordAvailability.enabled,
                ...(recordAvailability.titleKey && !recordAvailability.enabled && { title: railTitle(t(recordTool.labelKey), recordAvailability.titleKey) }),
              }
            : null
        }
        onOpenScript={openScript}
        // Media dropped on the main track covers the canvas like any media the contextual toolbar adds: the canvas's one
        // cover helper (`lib/spark/stage/cover-transform.ts`) through the stage, written in the drop's own command with the
        // size known now; the exact fit follows in the drop's undo step (timeline v3, `media-insert-fit.ts`).
        {...(contextToolbarEnabled &&
          stage && { coverTransform: ({ document: copy, sourceId }) => stage.controller.mediaInsertFitFor(sourceId, copy) })}
      />
    ) : null

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div className={`yt-studio ${instrumentSans.variable}`}>
        <div className="st-shell">
          <svg aria-hidden style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: STUDIO_ICON_SPRITE }} />
          <div className={`app${drawerOpen ? '' : ' no-drawer'}${rightOpen ? '' : ' no-right'}`}>
            <header className="top">
              <button type="button" className="logo" title={backLabel} aria-label={backLabel} onClick={onBack}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2 22 12 12 22 2 12z" /></svg>
              </button>
              <div className="crumb">
                <button type="button" className="crumb-back" onClick={onBack}>{backLabel}</button>
                <Icon name="right" size="sm" />
                <span className="title-in" title={project.title}>{project.title}</span>
              </div>
              <SparkSaveChip state={composition.saveState ?? (composition.saving ? 'saving' : 'saved')} onRetry={() => void actions.retrySave?.()} />
              <div className="vsep" />
              <button
                type="button"
                className="ib sm"
                id="undo"
                title={writeTitle ?? t('undo')}
                aria-label={t('undo')}
                disabled={!canWrite}
                onClick={undo}
              >
                <Icon name="undo" />
              </button>
              {redoEnabled ? (
                <button
                  type="button"
                  className="ib sm"
                  id="redo"
                  title={writeTitle ?? (composition.canRedo === true ? t('redo') : t('nothingToRedoTitle'))}
                  aria-label={t('redo')}
                  disabled={!canRedo}
                  onClick={redo}
                >
                  <Icon name="redo" />
                </button>
              ) : (
                <button type="button" className="ib sm" id="redo" title={`${t('redo')} · ${comingSoon}`} aria-label={t('redo')} disabled>
                  <Icon name="redo" />
                </button>
              )}
              <div className="grow" />
              {onOpenChat ? <SparkOpenInChat conversationId={sideChat.state.conversationId} onOpen={onOpenChat} /> : null}
              <button
                type="button"
                className="ib sm"
                title={t('toggleTheme')}
                aria-label={t('toggleTheme')}
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              >
                <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} />
              </button>
              <button
                type="button"
                className="btn primary sm"
                disabled={!exportEnabled || composition.readOnly}
                title={!exportEnabled ? comingSoon : (writeTitle ?? undefined)}
                onClick={() => {
                  setExportOpen(true)
                  void exporter.session.open({ workingCopyVersion: composition.workingCopy?.workingCopyVersion ?? null })
                }}
              >
                {t('generate')}
              </button>
              <div className="vsep" />
              <button
                type="button"
                className={`ib sm${rightOpen ? ' on' : ''}`}
                title={t('togglePanel')}
                aria-label={t('togglePanel')}
                aria-pressed={rightOpen}
                onClick={() => setRightOpen((open) => !open)}
              >
                <Icon name="panel" />
              </button>
            </header>

            <div className="main">
              <nav className="rail" aria-label={t('toolsLabel')}>
                <button
                  type="button"
                  className={`rail-btn${drawerOpen && drawerTool === 'scenes' ? ' on' : ''}`}
                  aria-pressed={drawerOpen && drawerTool === 'scenes'}
                  onClick={() => selectTool('scenes')}
                >
                  <Icon name="scenes" />
                  {scenesLabel}
                </button>
                {visibleSparkTools(toolContext).map((tool) => {
                  const label = t(tool.labelKey)
                  const availability = tool.availability(toolContext)
                  const title = railTitle(label, availability.titleKey)
                  if (!availability.enabled) {
                    return (
                      <button key={tool.id} type="button" className="rail-btn" disabled title={title}>
                        <Icon name={tool.icon} />
                        {label}
                      </button>
                    )
                  }
                  if (tool.Drawer) {
                    const on = drawerOpen && drawerTool === tool.id
                    return (
                      <button key={tool.id} type="button" className={`rail-btn${on ? ' on' : ''}`} aria-pressed={on} title={title} onClick={() => selectTool(tool.id)}>
                        <Icon name={tool.icon} />
                        {label}
                      </button>
                    )
                  }
                  return (
                    <button key={tool.id} type="button" className="rail-btn" title={title} onClick={() => tool.run?.(toolContext)}>
                      <Icon name={tool.icon} />
                      {label}
                    </button>
                  )
                })}
                <div className="grow" />
                <button type="button" className="rail-btn" disabled title={`${t('tools.brand')} · ${comingSoon}`}>
                  <Icon name={BRAND_ICON} />
                  {t('tools.brand')}
                </button>
              </nav>

              <aside className="drawer" aria-hidden={!drawerOpen}>
                <div className="drawer-inner">
                  <div className="dr-head">
                    <h2>{activeTool ? t(activeTool.labelKey) : scenesLabel}</h2>
                    <button type="button" className="ib sm" title={t('collapse')} aria-label={t('collapse')} onClick={() => setDrawerOpen(false)}>
                      <Icon name="left" />
                    </button>
                  </div>
                  {ActiveDrawer ? (
                    <ActiveDrawer ctx={toolContext} />
                  ) : (
                    <div className="dr-body" ref={sceneListScrollRef}>
                      {timeline.length === 0 ? (
                        <EmptyNote title={t('noScenesTitle')} body={t('noScenesBody')} />
                      ) : timelineEditing && document ? (
                        <SceneChapterList
                          document={document}
                          selectedSceneId={composition.selectedSceneId}
                          canWrite={canWrite}
                          writeTitle={writeTitle}
                          actions={pickActions}
                          thumbnails={thumbnails}
                          mediaName={mediaNameOf}
                          onNotice={(text) => toast(text, 'error')}
                        />
                      ) : (
                        <SceneList
                          timeline={timeline}
                          selectedSceneId={composition.selectedSceneId}
                          canWrite={canWrite}
                          writeTitle={writeTitle}
                          actions={pickActions}
                          scrollRef={sceneListScrollRef}
                          projectId={project.id}
                          workingCopyVersion={composition.workingCopy?.workingCopyVersion ?? 0}
                          posterUrl={posterUrl}
                        />
                      )}
                      <button
                        type="button"
                        className="add-scene"
                        disabled={!canAddScene}
                        title={addSceneTitle}
                        onClick={() => void actions.addScene()}
                      >
                        <Icon name="plus" size="sm" />
                        {t('addScene')}
                      </button>
                    </div>
                  )}
                </div>
              </aside>

              <section className="center">
                {stage ? (
                  <SparkStage
                    binding={stage}
                    composition={composition}
                    ratio={ratio}
                    emptyLabel={t('emptyCanvas')}
                    sceneLabel={selected ? t('sceneName', { n: selected.number }) : null}
                    aspectLabel={ratio}
                    canWrite={stageCanWrite}
                    writeTitle={writeTitle}
                    onToolDrop={(drop, point) => dropOnTarget(drop, { kind: 'canvas', point })}
                    contextToolbar={
                      contextToolbarEnabled
                        ? {
                            animations: effects.animationsPanel,
                            onReplaceMedia: () => {
                              // "Replace" opens the Media drawer; a pick there replaces the selected clip's source.
                              setDrawerOpen(true)
                              setDrawerTool('media')
                            },
                          }
                        : undefined
                    }
                  />
                ) : (
                  <StageFrame
                    ratio={ratio}
                    label={t('emptyCanvas')}
                    sceneLabel={selected ? t('sceneName', { n: selected.number }) : null}
                  />
                )}
                {timelineDock ?? (
                <div
                  className={`dock${expanded ? ' expanded' : ''}${dockDropActive ? ' drop-ready' : ''}`}
                  ref={dockRef}
                  onDragOver={
                    stage && stageCanWrite
                      ? (event) => {
                          if (!acceptsToolDrop(event.dataTransfer)) return
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'copy'
                          setDockDropActive(true)
                        }
                      : undefined
                  }
                  onDragLeave={(event) => {
                    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDockDropActive(false)
                  }}
                  onDrop={
                    stage && stageCanWrite
                      ? (event) => {
                          setDockDropActive(false)
                          if (!acceptsToolDrop(event.dataTransfer)) return
                          event.preventDefault()
                          const drop = readToolDrop(event.dataTransfer)
                          const frame = frameAtDockX(event.clientX)
                          if (drop && frame !== null) dropOnTarget(drop, { kind: 'timeline', frame })
                        }
                      : undefined
                  }
                >
                  <div className="transport">
                    {stage ? (
                      <StagePlayButton stage={stage} />
                    ) : (
                      <button type="button" className="play" disabled title={comingSoon} aria-label={t('play')}>
                        <Icon name="play" />
                      </button>
                    )}
                    {stage ? (
                      <StageTime stage={stage} fallbackCurrent={formatTenths(selected?.start ?? 0)} fallbackTotal={formatTotal(timeline)} />
                    ) : (
                      <div className="time">
                        <span>{formatTenths(selected?.start ?? 0)}</span>{' '}
                        <span className="tt">/ {formatTotal(timeline)}</span>
                      </div>
                    )}
                    <Track
                      document={document}
                      timeline={timeline}
                      selected={selected}
                      axis={axis}
                      canWrite={canWrite}
                      actions={pickActions}
                      stage={stage}
                      onOpenTransition={openTransitionProperties}
                      transitionBrowser={
                        effects.transitionsBrowser && stage
                          ? {
                              canWrite: stageCanWrite,
                              onDropKind: (sceneId, kind) => {
                                pickActions.select(sceneId)
                                void applyTransitionKind(toolContext, [sceneId], kind, { preview: true })
                              },
                              onLength: (sceneId, frames) => void applyTransitionLength(toolContext, sceneId, frames),
                            }
                          : undefined
                      }
                    />
                    {/* S16: the strip's `+` (SAHNE §2 `[+]`), the same action as the drawer's "Add scene". */}
                    <button
                      type="button"
                      className="ib sm"
                      title={addSceneTitle ?? t('addScene')}
                      aria-label={t('addScene')}
                      disabled={!canAddScene}
                      onClick={() => void actions.addScene()}
                    >
                      <Icon name="plus" />
                    </button>
                    {/* Design "Expand timeline" (`i-expand`): compact ⇅ expanded, a server-side view preference. */}
                    <button
                      type="button"
                      className={`ib sm${expanded ? ' on' : ''}`}
                      title={expanded ? t('timeline.collapse') : t('timeline.expand')}
                      aria-label={expanded ? t('timeline.collapse') : t('timeline.expand')}
                      aria-pressed={expanded}
                      onClick={() => void actions.setTimelineDensity(expanded ? 'compact' : 'expanded')}
                    >
                      <Icon name="expand" />
                    </button>
                  </div>
                  {expanded && document && axis ? (
                    <TimelineTracks
                      document={document}
                      axis={axis}
                      selected={selected}
                      lane={lane}
                      focusedLayerId={focusedText?.layerId ?? null}
                      onSelectText={pickText}
                      onTextMenu={setLayerMenu}
                      selectedMotionLayerId={selectedLayerId}
                      onSelectMotion={pickMotion}
                      stage={stage}
                    />
                  ) : (
                    <div className="script">
                      <div className="script-scroll">
                        <p className="spark-muted">{timeline.length === 0 ? t('scriptEmpty') : t('scriptPending')}</p>
                      </div>
                    </div>
                  )}
                </div>
                )}
                {/* P03-20: "Script'i aç" covers preview + timeline; both stay mounted underneath. */}
                <SparkScriptReviewCover />
              </section>

              <aside className="right" aria-hidden={!rightOpen}>
                <div className="right-inner" ref={rightPaneRef}>
                  <div className="rp-head">
                    <div className={`seg${stage && layerSelected ? ' has-sel' : ''}`} role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={rightTab === 'assistant'}
                        className={rightTab === 'assistant' ? 'on' : undefined}
                        onClick={() => setRightTab('assistant')}
                      >
                        <Icon name="sparkles" />
                        {t('assistant')}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={rightTab === 'props'}
                        className={rightTab === 'props' ? 'on' : undefined}
                        onClick={() => setRightTab('props')}
                      >
                        <Icon name="sliders" />
                        {t('properties')}
                        {stage ? <span className="dot" aria-hidden /> : null}
                      </button>
                      {codeTabVisible || (rightTab === 'code' && codeTabLoading) ? (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={rightTab === 'code'}
                          className={rightTab === 'code' ? 'on' : undefined}
                          data-right-tab="code"
                          onClick={() => setRightTab('code')}
                        >
                          <Icon name="code" />
                          {t('motionCode.tab')}
                        </button>
                      ) : null}
                    </div>
                    <button type="button" className="ib sm" title={t('togglePanel')} aria-label={t('togglePanel')} onClick={() => setRightOpen(false)}>
                      <Icon name="panel" />
                    </button>
                  </div>
                  {rightTab === 'assistant' ? (
                    <SparkAssistantPane
                      cards={quickAi.state.cards}
                      quickAi={quickAi.session}
                      onRewrite={(instruction) => {
                        if (focusedText) quickAi.session.requestRewrite({ selection: focusedText, instruction })
                      }}
                      focus={focusedText}
                      onClearFocus={() => removeChatLayers(focusedText ? [focusedText.layerId] : [])}
                      sceneNumber={sceneNumberOf(document, chatScene)}
                      onClearScene={() => {
                        setChatSceneId(null)
                        setElementSelection(null)
                        setAskSelection(null)
                      }}
                      layers={layerChipsOf(document, chatScene ? { sceneId: chatScene, layerIds: chatLayerIds, timeRange: null } : null).filter(
                        (chip) => chip.layerId !== focusedText?.layerId,
                      )}
                      onRemoveLayers={removeChatLayers}
                      rangeLabel={document && chatTimeRange ? formatFrameRangeLabel(document.canvas.fps, chatTimeRange) : null}
                      onClearRange={() => setAskSelection(withoutTimeRange)}
                      chat={{
                        state: sideChat.state,
                        working: sideChat.working,
                        notice: sideChat.notice,
                        failureCode: sideChat.failureCode,
                        send: sendChat,
                        retryLoad: () => void sideChat.session.load(),
                        question: sideChat.question,
                        answer: sideChat.session.answer,
                      }}
                      canWrite={canWrite}
                      writeTitle={writeTitle}
                      promptRef={promptRef}
                      channelId={project.channelId}
                      fps={document ? document.canvas.fps.num / document.canvas.fps.den : undefined}
                      onUndoMotion={canWrite ? undoMotion : undefined}
                      motionOverrides={assistantApply.overrides}
                      contextMeterEnabled={contextMeterEnabled}
                    />
                  ) : rightTab === 'code' && selectedMotion && motionSource ? (
                    <div className="pane">
                      <div className="props-scroll">
                        {codeSource ? (
                          <SparkMotionCodeTab
                            view={selectedMotion}
                            source={codeSource}
                            stale={motionSource.status !== 'ready'}
                            controlled={{ result: codeResult, onResult: setCodeResult }}
                            projectId={project.id}
                            sceneNumber={document ? document.scene_sequence.scene_ids.indexOf(selectedMotion.sceneId) + 1 : 0}
                            editable={motionEnabled}
                            canWrite={stageCanWrite}
                            writeTitle={writeTitle}
                            getDocument={() => toolBridge.latest().workingCopy?.document ?? null}
                            apply={actions.apply}
                            onUndo={undo}
                            revertMemory={revertMemory}
                            onRepointed={(outcome) => {
                              stage?.controller.selection.selectLayer(outcome.sceneId, outcome.layerId)
                              setRightTab('code')
                            }}
                          />
                        ) : (
                          <p className="pp-hint" role="status" aria-busy="true">
                            {t('motionCode.loading')}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="pane">
                      <div className="props-scroll">
                        {stage && layerSelected ? (
                          <SparkLayerInspector
                            binding={stage}
                            composition={composition}
                            canWrite={stageCanWrite}
                            writeTitle={writeTitle}
                            animationsEnabled={effects.animationsPanel}
                          />
                        ) : document && selected ? (
                          <ScenePanel
                            document={document}
                            entry={selected}
                            canWrite={canWrite}
                            readOnly={composition.readOnly}
                            actions={actions}
                            tool={toolContext}
                          />
                        ) : (
                          <EmptyNote title={t('noSelectionTitle')} body={t('noSelectionBody')} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
        <Toast notice={composition.notice} />
        <ToolToast notice={toolNotice} />
        {/* E1-K: follows a scene voice change to its end while the editor is open (the scene panel comes and goes). */}
        <SceneVoiceJobs ctx={toolContext} />
        {exportEnabled && exportOpen ? (
          <SparkExportDialog
            state={exporter.state}
            channelId={project.channelId}
            projectTitle={project.title}
            onAccept={() => void exporter.session.accept()}
            onCancel={() => void exporter.session.cancel()}
            onRestart={() => void exporter.session.restart()}
            onClose={() => setExportOpen(false)}
          />
        ) : null}
        {layerMenu ? (
          <SparkTextLayerMenu
            anchor={layerMenu}
            canWrite={canWrite}
            writeTitle={writeTitle}
            onClose={() => setLayerMenu(null)}
            onRewrite={() => {
              const selection = { sceneId: layerMenu.sceneId, layerId: layerMenu.layerId }
              setLayerMenu(null)
              pickText(selection)
              if (quickAi.session.requestRewrite({ selection })) openAssistant(false)
            }}
            onAsk={() => {
              setLayerMenu(null)
              askAi({
                selection: { sceneId: layerMenu.sceneId, layerIds: [layerMenu.layerId], timeRange: null },
                playheadFrame: playheadForScene(playback, document, layerMenu.sceneId),
              })
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

/**
 * QA-068: the editor's quick AI lane. The session reads the working copy the user sees and applies an accepted
 * suggestion through `actions.apply` (the Composition command path: CAS + one undo group).
 */
function useSparkQuickAi(
  projectId: string,
  composition: SparkCompositionState,
  actions: SparkCompositionActions,
  sequence: () => number,
) {
  const [session] = React.useState(() => createSparkQuickAiSession({ projectId, sequence }))
  const workingCopy = composition.workingCopy
  React.useEffect(() => {
    session.setEditor({
      workingCopy: () => (workingCopy ? { version: workingCopy.workingCopyVersion, document: workingCopy.document } : null),
      apply: (specs) => actions.apply(specs),
    })
  }, [session, workingCopy, actions])
  React.useEffect(() => () => session.dispose(), [session])
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  return { session, state }
}

/**
 * QA-081: the project's side chat (linked conversation, P01-15 conversation stream). Every job event that changes the
 * transcript (an answer, a question, a job end) re-reads it; a running job shows the design's thinking row.
 */
function useSparkSideChat(project: SparkProject, sequence: () => number, refreshWorkingCopy?: () => void | Promise<void>) {
  const [session] = React.useState(() =>
    createSparkSideChatSession({ project: { id: project.id, title: project.title, channelId: project.channelId }, sequence }),
  )
  React.useEffect(() => {
    void session.load()
    return () => session.dispose()
  }, [session])
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const jobs = useConversationJobs({
    conversationId: state.conversationId,
    enabled: state.status === 'ready',
    focusedJobId: null,
    onBackgroundEvent: session.refresh,
  })
  // Y1-07 W7: an agent job of this project's conversation ended, so the working copy may have changed (the agent edits
  // through the Composition command path): re-read it instead of showing a stale canvas.
  useRefreshOnAgentJobEnd(jobs, state.status === 'ready', refreshWorkingCopy)
  // FIX-DEV-3: a job waiting for the user's approval or payment is not "working", and a failed one is no longer silent.
  const { working, notice, failureCode } = sparkChatJobStatus(jobs)
  // QA-081: a P03-23 chip question of a job that waits for the user is answered from the pane.
  const waitingRunIds = new Set([...jobs.values()].filter((job) => job.state === 'waiting_for_user').map((job) => job.jobId))
  const question = openSparkChatQuestion(state.entries, waitingRunIds)
  // Timeline v3 "Script": the conversation's jobs, newest first (the script's job is looked up among them on click).
  const jobIds = [...jobs.values()].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).map((job) => job.jobId)
  return { session, state, working, notice, failureCode, question, jobIds }
}

/** Scenes in strip order with their real duration and start time; unknown durations stay null. */
function timelineOf(document: CompositionDocument): TimelineScene[] {
  let start = 0
  return orderedScenes(document).map((scene, index) => {
    const seconds = sceneDurationSeconds(document, scene)
    const entry = { scene, number: index + 1, seconds, start }
    start += seconds ?? 0
    return entry
  })
}

function totalSeconds(timeline: TimelineScene[]): number | null {
  if (timeline.some((entry) => entry.seconds === null)) return null
  return timeline.reduce((sum, entry) => sum + (entry.seconds ?? 0), 0)
}

/** Rows beyond which the drawer renders only the scene items in view (P02-16, K240). */
const SCENE_LIST_WINDOW_FROM = 30

/**
 * Keeps the drawer's scroll window: which scene items to render for the `.dr-body` scroll
 * position. Rows have one height in the design; it is measured from the first rendered item.
 * Until a height is known (first paint) every row renders.
 */
function useSceneListWindow(scrollRef: React.RefObject<HTMLDivElement | null>, count: number, selectedIndex: number) {
  const [rowHeight, setRowHeight] = React.useState(0)
  const [viewport, setViewport] = React.useState({ scrollTop: 0, height: 0 })
  const windowed = count > SCENE_LIST_WINDOW_FROM

  React.useEffect(() => {
    const element = scrollRef.current
    if (!element || !windowed) return undefined
    const read = () => setViewport({ scrollTop: element.scrollTop, height: element.clientHeight })
    read()
    element.addEventListener('scroll', read, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read)
    observer?.observe(element)
    return () => {
      element.removeEventListener('scroll', read)
      observer?.disconnect()
    }
  }, [scrollRef, windowed])

  // A selection made elsewhere (strip keys, a new scene) scrolls its row into view.
  React.useEffect(() => {
    const element = scrollRef.current
    if (!element || !windowed || rowHeight <= 0 || selectedIndex < 0) return
    const next = scrollTopFor({ index: selectedIndex, rowHeight, scrollTop: element.scrollTop, viewportHeight: element.clientHeight })
    if (next !== element.scrollTop) element.scrollTop = next
  }, [scrollRef, windowed, rowHeight, selectedIndex])

  const measure = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    const height = element.offsetHeight
    if (height > 0) setRowHeight((current) => (current === height ? current : height))
  }, [])

  const range = windowed
    ? listWindow({ count, rowHeight, scrollTop: viewport.scrollTop, viewportHeight: viewport.height })
    : { start: 0, end: count, before: 0, after: 0 }
  return { range, measure }
}

/**
 * Posters of the scene items in view (P02-13 cache, one bounded request per change of the visible
 * set or of the working copy). Late answers never replace newer ones (K240). Without a resolver
 * (poster delivery, P06-46) nothing is requested.
 */
function useScenePosterUrls(
  projectId: string,
  sceneIds: readonly string[],
  workingCopyVersion: number,
  posterUrl: ScenePosterUrlResolver | undefined,
) {
  const board = React.useMemo(() => new ScenePosterBoard(), [])
  const [, setRevision] = React.useState(0)
  const key = sceneIds.join('|')

  React.useEffect(() => {
    if (!posterUrl || sceneIds.length === 0) return undefined
    const controller = new AbortController()
    const seq = board.begin()
    resolveScenePosters(projectId, sceneIds, { signal: controller.signal })
      .then((items) => {
        if (board.apply(seq, items)) setRevision((value) => value + 1)
      })
      .catch(() => undefined)
    return () => controller.abort()
    // `key` stands for sceneIds; the version re-resolves after an edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, projectId, key, workingCopyVersion, posterUrl])

  return (sceneId: string): string | null => {
    if (!posterUrl) return null
    const poster = board.poster(sceneId)
    return poster ? posterUrl(poster) : null
  }
}

/** Scene list of the drawer (design `.scene-item`); drag and drop reorders it with one command. */
function SceneList({
  timeline,
  selectedSceneId,
  canWrite,
  writeTitle,
  actions,
  scrollRef,
  projectId,
  workingCopyVersion,
  posterUrl,
}: {
  timeline: TimelineScene[]
  selectedSceneId: string | null
  canWrite: boolean
  writeTitle: string | undefined
  actions: SparkCompositionActions
  scrollRef: React.RefObject<HTMLDivElement | null>
  projectId: string
  workingCopyVersion: number
  posterUrl: ScenePosterUrlResolver | undefined
}) {
  const t = useTranslations('Spark.editor')
  const statusLabel = useSceneStatusLabel()
  const comingSoon = t('comingSoon')
  const [dragFrom, setDragFrom] = React.useState<string | null>(null)
  const [dropAt, setDropAt] = React.useState<{ sceneId: string; after: boolean } | null>(null)
  const selectedIndex = timeline.findIndex((entry) => entry.scene.scene_id === selectedSceneId)
  const { range, measure } = useSceneListWindow(scrollRef, timeline.length, selectedIndex)
  const visible = timeline.slice(range.start, range.end)
  const posterFor = useScenePosterUrls(
    projectId,
    visible.map((entry) => entry.scene.scene_id),
    workingCopyVersion,
    posterUrl,
  )

  const clearDrag = () => {
    setDragFrom(null)
    setDropAt(null)
  }

  const drop = (targetSceneId: string, after: boolean) => {
    const from = dragFrom
    clearDrag()
    if (!from) return
    const afterSceneId = afterSceneIdForDrop(timeline.map((entry) => entry.scene.scene_id), from, targetSceneId, after)
    if (afterSceneId !== undefined) void actions.moveScene(from, afterSceneId)
  }

  return (
    <>
      {range.before > 0 ? <div aria-hidden style={{ height: range.before }} /> : null}
      {visible.map((entry, offset) => {
        const sceneId = entry.scene.scene_id
        const on = sceneId === selectedSceneId
        const poster = posterFor(sceneId)
        const classes = ['scene-item']
        if (on) classes.push('on')
        if (dragFrom === sceneId) classes.push('dragging')
        if (dropAt?.sceneId === sceneId) classes.push(dropAt.after ? 'drop-after' : 'drop-before')
        const name = t('sceneName', { n: entry.number })
        const status = sceneStatus(entry.scene)
        const statusText = status ? statusLabel(status) : null
        const cardLabel = t('sceneCardLabel', { n: entry.number, total: timeline.length, duration: formatDuration(entry.seconds) })
        return (
          <div
            key={sceneId}
            ref={offset === 0 ? measure : undefined}
            className={classes.join(' ')}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={statusText ? t('sceneStatus.cardLabel', { label: cardLabel, status: statusText }) : cardLabel}
            draggable={canWrite}
            title={canWrite ? t('dragToReorder') : undefined}
            onClick={() => actions.select(sceneId)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
              event.preventDefault()
              actions.select(sceneId)
            }}
            onDragStart={(event) => {
              if (!canWrite) return
              setDragFrom(sceneId)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', sceneId)
            }}
            onDragOver={(event) => {
              if (!dragFrom) return
              event.preventDefault()
              const rect = event.currentTarget.getBoundingClientRect()
              const after = event.clientY >= rect.top + rect.height / 2
              if (dropAt?.sceneId !== sceneId || dropAt.after !== after) setDropAt({ sceneId, after })
            }}
            onDrop={(event) => {
              if (!dragFrom) return
              event.preventDefault()
              drop(sceneId, dropAt?.sceneId === sceneId ? dropAt.after : false)
            }}
            onDragEnd={clearDrag}
          >
            <div className="si-num">{entry.number}</div>
            <div>
              {/* A cached poster frame, never a live video or iframe (K240). */}
              <div className="thumb">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed poster URL, not a static asset
                  <img src={poster} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              <div className="si-meta">
                <span className="si-name">{name}</span>
                <span className="si-dur">
                  {status && statusText ? <StatusDot status={status} label={statusText} /> : null}
                  {formatDuration(entry.seconds)}
                </span>
              </div>
            </div>
            <div className="si-tools">
              <button type="button" disabled title={`${t('duplicateScene')} · ${comingSoon}`} aria-label={t('duplicateScene')}>
                <Icon name="dup" size="sm" />
              </button>
              <button
                type="button"
                disabled={!canWrite}
                title={writeTitle ?? t('deleteScene')}
                aria-label={t('deleteScene')}
                onClick={(event) => {
                  event.stopPropagation()
                  void actions.removeScene(sceneId)
                }}
              >
                <Icon name="trash" size="sm" />
              </button>
            </div>
          </div>
        )
      })}
      {range.after > 0 ? <div aria-hidden style={{ height: range.after }} /> : null}
    </>
  )
}

/**
 * Bottom timeline (design `.track`): second ticks, one segment per scene and the playhead. The
 * segments are the scene strip (P02-16): ←/→ selects, Alt+←/→ moves the scene one place (one
 * command), Delete removes it (Ctrl+Z undoes); each card announces "Scene n of total, duration".
 */
function Track({
  document: workingDocument,
  timeline,
  selected,
  axis,
  canWrite,
  actions,
  stage,
  onOpenTransition,
  transitionBrowser,
}: {
  /** E1-L: the working copy, for the transition chips between the cards. */
  document: CompositionDocument | null
  timeline: TimelineScene[]
  selected: TimelineScene | null
  axis: StripAxis | null
  canWrite: boolean
  actions: SparkCompositionActions
  /** Y1-08: with the stage on the strip is also the seek bar (click a card, drag the ruler or the playhead). */
  stage: SparkStageBinding | null
  /** Spark effects WP0: a chip opens Properties on the incoming scene's Transition section. */
  onOpenTransition: (sceneId: string) => void
  /** Spark effects WP1: chips take dropped Transitions cards and carry a duration handle (`SPARK_TRANSITIONS_BROWSER_ENABLED`). */
  transitionBrowser?: React.ComponentProps<typeof TransitionChips>['browser']
}) {
  const t = useTranslations('Spark.editor')
  const statusLabel = useSceneStatusLabel()
  const cards = React.useRef(new Map<string, HTMLDivElement>())
  // S16: dragging a strip card reorders it (one `scene.reorder`); the drop marker is the drawer's
  // accent line turned vertical.
  const [dragFrom, setDragFrom] = React.useState<string | null>(null)
  const [dropAt, setDropAt] = React.useState<{ sceneId: string; after: boolean } | null>(null)
  const [scrubbing, setScrubbing] = React.useState(false)
  // Focus follows a keyboard selection, move or delete once the strip shows the result.
  const pendingFocus = React.useRef<string | null>(null)
  React.useEffect(() => {
    const sceneId = pendingFocus.current
    const card = sceneId ? cards.current.get(sceneId) : undefined
    if (!card) return
    pendingFocus.current = null
    if (document.activeElement !== card) card.focus()
  })
  const setFocusSceneId = (sceneId: string) => {
    pendingFocus.current = sceneId
    const card = cards.current.get(sceneId)
    if (card && document.activeElement !== card) card.focus()
  }
  if (timeline.length === 0) return <div className="track" aria-hidden />
  const order = timeline.map((entry) => entry.scene.scene_id)

  const clearDrag = () => {
    setDragFrom(null)
    setDropAt(null)
  }
  const drop = (targetSceneId: string, after: boolean) => {
    const from = dragFrom
    clearDrag()
    if (!from) return
    const afterSceneId = afterSceneIdForDrop(order, from, targetSceneId, after)
    if (afterSceneId !== undefined) void actions.moveScene(from, afterSceneId)
  }

  // Y1-08 seek: the cards' measured rectangles map a pointer x to a scene and a fraction of it, the plan maps that to a frame.
  const seekAtX = (clientX: number) => {
    const plan = stage?.controller.presenter.plan
    if (!stage || !plan) return
    const rects: StripCardRect[] = []
    for (const sceneId of order) {
      const rect = cards.current.get(sceneId)?.getBoundingClientRect()
      if (rect) rects.push({ sceneId, left: rect.left, right: rect.right })
    }
    const target = seekTargetAtX(rects, clientX)
    const frame = target ? frameAtStrip(plan, target) : null
    if (frame !== null) stage.playback.seek(frame)
  }
  const seekInCard = (sceneId: string, clientX: number) => {
    const plan = stage?.controller.presenter.plan
    const rect = cards.current.get(sceneId)?.getBoundingClientRect()
    if (!stage || !plan || !rect || rect.width <= 0) return
    const frame = frameAtStrip(plan, { sceneId, fraction: (clientX - rect.left) / rect.width })
    if (frame !== null) stage.playback.seek(frame)
  }
  const beginScrub = (event: React.PointerEvent<HTMLElement>) => {
    if (!stage || event.button !== 0) return
    event.preventDefault()
    stage.playback.pause()
    seekAtX(event.clientX)
    setScrubbing(true)
    const move = (moved: PointerEvent) => seekAtX(moved.clientX)
    const done = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
      setScrubbing(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)
  }

  const onStripKey = (event: React.KeyboardEvent<HTMLDivElement>, sceneId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      actions.select(sceneId)
      return
    }
    const action = stripKeyAction(order, sceneId, event, canWrite)
    if (!action) return
    event.preventDefault()
    if (action.kind === 'select') {
      actions.select(action.sceneId)
      setFocusSceneId(action.sceneId)
    } else if (action.kind === 'move') {
      setFocusSceneId(action.sceneId)
      void actions.moveScene(action.sceneId, action.afterSceneId)
    } else {
      const index = order.indexOf(action.sceneId)
      const next = order[index + 1] ?? order[index - 1] ?? null
      void actions.removeScene(action.sceneId).then(() => {
        if (next) setFocusSceneId(next)
      })
    }
  }

  const total = totalSeconds(timeline)
  const ticks: React.ReactNode[] = []
  if (total !== null && total > 0) {
    for (let second = 0; second <= Math.floor(total); second += 1) {
      const left = `${(second / total) * 100}%`
      const major = second % 5 === 0
      ticks.push(<span key={`t${second}`} className={major ? 'major' : undefined} style={{ left }} />)
      if (major && second < total - 1.5) ticks.push(<b key={`l${second}`} style={{ left }}>{formatSeconds(second)}</b>)
    }
  }
  // The playhead sits on the selected card's left edge (the same axis as the expanded rows).
  const playhead = axis && selected ? stripCss(axis, stripX(axis, selected.number - 1, 0)) : '0%'

  return (
    <div className={`track${scrubbing ? ' scrub' : ''}`}>
      <div className="ticks" onPointerDown={stage ? beginScrub : undefined}>
        {ticks}
      </div>
      <div className="segs">
        {timeline.map((entry) => {
          const on = entry.scene.scene_id === selected?.scene.scene_id
          const name = t('sceneName', { n: entry.number })
          const sceneId = entry.scene.scene_id
          const status = sceneStatus(entry.scene)
          const statusText = status ? statusLabel(status) : null
          const cardLabel = t('sceneCardLabel', { n: entry.number, total: timeline.length, duration: formatDuration(entry.seconds) })
          const classes = ['seg-b']
          if (on) classes.push('on')
          if (dragFrom === sceneId) classes.push('dragging')
          if (dropAt?.sceneId === sceneId) classes.push(dropAt.after ? 'drop-after' : 'drop-before')
          return (
            <div
              key={sceneId}
              ref={(element) => {
                if (element) cards.current.set(sceneId, element)
                else cards.current.delete(sceneId)
              }}
              className={classes.join(' ')}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={statusText ? t('sceneStatus.cardLabel', { label: cardLabel, status: statusText }) : cardLabel}
              aria-keyshortcuts="ArrowLeft ArrowRight Alt+ArrowLeft Alt+ArrowRight Delete"
              draggable={canWrite}
              style={{ flex: `${entry.seconds ?? NEW_SCENE_SECONDS} 1 0` }}
              data-scene-id={sceneId}
              onClick={(event) => {
                // Seek first: selecting the scene afterwards finds the playhead already inside it (no jump to its start).
                if (stage) seekInCard(sceneId, event.clientX)
                actions.select(sceneId)
              }}
              onKeyDown={(event) => onStripKey(event, sceneId)}
              onDragStart={(event) => {
                if (!canWrite) return
                setDragFrom(sceneId)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', sceneId)
              }}
              onDragOver={(event) => {
                if (!dragFrom) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const after = event.clientX >= rect.left + rect.width / 2
                if (dropAt?.sceneId !== sceneId || dropAt.after !== after) setDropAt({ sceneId, after })
              }}
              onDrop={(event) => {
                if (!dragFrom) return
                event.preventDefault()
                drop(sceneId, dropAt?.sceneId === sceneId ? dropAt.after : false)
              }}
              onDragEnd={clearDrag}
            >
              <span className="n">{entry.number}</span>
              <span className="nm">{name}</span>
              {status && statusText ? <StatusDot status={status} label={statusText} /> : null}
              <span className="d">{formatDuration(entry.seconds)}</span>
            </div>
          )
        })}
        {workingDocument && axis ? (
          <TransitionChips
            document={workingDocument}
            axis={axis}
            timeline={timeline}
            selectedSceneId={selected?.scene.scene_id ?? null}
            stage={stage}
            onOpen={onOpenTransition}
            {...(transitionBrowser && { browser: transitionBrowser })}
          />
        ) : null}
      </div>
      {stage && axis ? (
        <StagePlayhead axis={axis} selected={selected} stage={stage} onGrab={beginScrub} />
      ) : (
        <div className="ph" style={{ left: playhead }} />
      )}
    </div>
  )
}

/**
 * Y1-08 playhead (`.ph`) of the strip and of the expanded rows: at the live playback frame, inside the card of the scene the
 * frame is in; before the plan is read it sits on the selected card's start like the static playhead. With `onGrab` it also
 * carries the drag handle (`.ph-grab`). Only this small component follows the frame, never the whole strip.
 */
function StagePlayhead({
  axis,
  selected,
  stage,
  onGrab,
}: {
  axis: StripAxis
  selected: TimelineScene | null
  stage: SparkStageBinding
  onGrab?: (event: React.PointerEvent<HTMLElement>) => void
}) {
  const frame = usePlaybackFrame(stage)
  const plan = useStageState(stage).presenter.plan
  const target = plan ? stripPlayhead(plan, frame) : null
  const index = target ? axis.scenes.findIndex((scene) => scene.sceneId === target.sceneId) : selected ? selected.number - 1 : -1
  const left = index >= 0 ? stripCss(axis, stripX(axis, index, target?.fraction ?? 0)) : '0%'
  return (
    <>
      <div className="ph" style={{ left }} />
      {onGrab ? <div className="ph-grab" style={{ left }} onPointerDown={onGrab} /> : null}
    </>
  )
}

/** Y1-08 play / pause (design `.play`): toggles the playback clock; disabled until the plan holds a playable scene. */
function StagePlayButton({ stage }: { stage: SparkStageBinding }) {
  const t = useTranslations('Spark.editor')
  const { playing, totalFrames } = usePlaybackSnapshot(stage)
  return (
    <button
      type="button"
      className="play"
      disabled={totalFrames === 0}
      title={playing ? t('pause') : t('play')}
      aria-label={playing ? t('pause') : t('play')}
      aria-keyshortcuts="Space"
      onClick={() => stage.playback.toggle()}
    >
      <Icon name={playing ? 'pause' : 'play'} />
    </button>
  )
}

/** Y1-08 time label (design `.time`): the playback frame and the resolved total; the static label until the plan is read. */
function StageTime({ stage, fallbackCurrent, fallbackTotal }: { stage: SparkStageBinding; fallbackCurrent: string; fallbackTotal: string }) {
  const frame = usePlaybackFrame(stage)
  const { totalFrames, fps } = usePlaybackSnapshot(stage)
  const ready = totalFrames > 0
  return (
    <div className="time">
      <span>{ready ? formatFrameTime(frame, fps) : fallbackCurrent}</span>{' '}
      <span className="tt">/ {ready ? formatSeconds(framesToSeconds(totalFrames, fps)) : fallbackTotal}</span>
    </div>
  )
}

/** "In progress, audio out of date": the card status reasons as one phrase (S15). */
function useSceneStatusLabel() {
  const t = useTranslations('Spark.editor.sceneStatus')
  return (status: SceneStatus) => status.reasons.map((reason) => t(`reasons.${reason}`)).join(', ')
}

/**
 * Scene card status (P02-16, decision S15): the design's 6 px dot (as on the rail and panel tabs)
 * next to the duration; accent while an operation fills the scene, the warning colour when it needs
 * the user. The reason is the tooltip; the card's label carries it for screen readers.
 */
function StatusDot({ status, label }: { status: SceneStatus; label: string }) {
  return <span className={`st-dot${status.tone === 'attention' ? ' warn' : ''}`} title={label} aria-hidden />
}

/** Where the strip's `.track` sits inside the dock: the rows' lanes use the same x-range. */
type StripLane = { left: number; right: number } | null

/**
 * Measures the strip `.track` against the dock so every expanded row's lane is exactly under the
 * strip (the transport's play/time block and buttons change width with the dock). Before the
 * first measurement (static render) the CSS defaults of `.tracks` apply.
 */
function useStripLane(dockRef: React.RefObject<HTMLDivElement | null>, active: boolean): StripLane {
  const [lane, setLane] = React.useState<StripLane>(null)
  React.useEffect(() => {
    const dock = dockRef.current
    const track = dock?.querySelector<HTMLElement>('.transport .track')
    if (!active || !dock || !track) return undefined
    const read = () => {
      const outer = dock.getBoundingClientRect()
      const inner = track.getBoundingClientRect()
      const next = { left: Math.round(inner.left - outer.left), right: Math.round(outer.right - inner.right) }
      setLane((current) => (current && current.left === next.left && current.right === next.right ? current : next))
    }
    read()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read)
    observer?.observe(dock)
    observer?.observe(track)
    return () => observer?.disconnect()
  }, [dockRef, active])
  return lane
}

/**
 * Expanded timeline (P02-16, decision S14): under the strip, one row per derived track kind
 * (SAHNE §3: visual, overlay, caption, narration, music, sfx) drawn with the strip's own `.seg-b`
 * blocks on the strip's time axis, with one playhead through every row. A view of the document
 * only: nothing here is a command.
 */
function TimelineTracks({
  document,
  axis,
  selected,
  lane,
  focusedLayerId,
  onSelectText,
  onTextMenu,
  selectedMotionLayerId,
  onSelectMotion,
  stage,
}: {
  document: CompositionDocument
  axis: StripAxis
  selected: TimelineScene | null
  lane: StripLane
  /** QA-068: the text layer picked as the element selection (its block is shown selected). */
  focusedLayerId: string | null
  onSelectText: (selection: SparkElementSelection) => void
  onTextMenu: (anchor: SparkLayerMenuAnchor) => void
  /** E1-D: the stage's selected layer (a Motion block is shown selected) and the pick of a Motion block (opens its Properties). */
  selectedMotionLayerId: string | null
  onSelectMotion: (sceneId: string, layerId: string) => void
  /** Y1-08: the playhead follows playback when the stage is on. */
  stage: SparkStageBinding | null
}) {
  const t = useTranslations('Spark.editor.timeline')
  const rows = React.useMemo(() => timelineTracks(document, axis), [document, axis])
  const laneStyle = lane
    ? ({ '--lane-left': `${lane.left}px`, '--lane-right': `${lane.right}px` } as React.CSSProperties)
    : undefined
  const time = (frame: number) => formatSeconds(frame / axis.fps)
  const tEditor = useTranslations('Spark.editor')
  const blockLabel = (block: TimelineTrackBlock) =>
    t('blockLabel', { kind: t(`blocks.${block.kind}`), start: time(block.startFrame), end: time(block.endFrame) }) +
    (block.previewOnly ? `, ${tEditor('previewOnly')}` : '')

  return (
    <div className="tracks" role="region" aria-label={t('tracksLabel')} style={laneStyle}>
      {rows.map((row) => (
        <div key={row.kind} className="trk-row" role="group" aria-label={t(`tracks.${row.kind}`)}>
          <span className="trk-lbl">{t(`tracks.${row.kind}`)}</span>
          <div className="trk-lane">
            {row.blocks.map((block) => {
              const css = blockCss(axis, block)
              const label = blockLabel(block)
              if (block.kind === 'text' && block.sceneId) {
                const selection = { sceneId: block.sceneId, layerId: block.id }
                const openMenu = (x: number, y: number) =>
                  onTextMenu({ ...selection, ...clampMenuPosition(x, y, { width: window.innerWidth, height: window.innerHeight }) })
                return (
                  <div
                    key={block.id}
                    className={`seg-b${focusedLayerId === block.id ? ' on' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={focusedLayerId === block.id}
                    aria-haspopup="menu"
                    aria-label={label}
                    title={label}
                    style={{ left: css.left, width: css.width }}
                    onClick={() => onSelectText(selection)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      onSelectText(selection)
                      openMenu(event.clientX, event.clientY)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectText(selection)
                      } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                        event.preventDefault()
                        onSelectText(selection)
                        const rect = event.currentTarget.getBoundingClientRect()
                        openMenu(rect.left, rect.bottom + 4)
                      }
                    }}
                  >
                    <span className="nm">{t(`blocks.${block.kind}`)}</span>
                  </div>
                )
              }
              if (block.kind === 'motion_instance' && block.sceneId && stage) {
                const sceneId = block.sceneId
                const on = selectedMotionLayerId === block.id
                return (
                  <div
                    key={block.id}
                    className={`seg-b${on ? ' on' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={on}
                    aria-label={label}
                    title={label}
                    data-layer-id={block.id}
                    style={{ left: css.left, width: css.width }}
                    onClick={() => onSelectMotion(sceneId, block.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectMotion(sceneId, block.id)
                      }
                    }}
                  >
                    <span className="nm">{t(`blocks.${block.kind}`)}</span>
                  </div>
                )
              }
              return (
                <div key={block.id} className="seg-b" role="img" aria-label={label} title={label} style={{ left: css.left, width: css.width }}>
                  {block.kind === 'pending_slot' ? <span className="spin" aria-hidden /> : null}
                  <span className="nm">{t(`blocks.${block.kind}`)}</span>
                  {block.previewOnly ? <span className="po-b">{tEditor('previewOnly')}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {selected && axis.scenes.length > 0 ? (
        <div className="trk-axis" aria-hidden>
          {stage ? <StagePlayhead axis={axis} selected={selected} stage={stage} /> : <div className="ph" style={{ left: stripCss(axis, stripX(axis, selected.number - 1, 0)) }} />}
        </div>
      ) : null}
    </div>
  )
}

/** Fits an empty frame of the project's format inside the stage without scrolling. */
function StageFrame({ ratio, label, sceneLabel }: { ratio: SparkAspectRatio; label: string; sceneLabel: string | null }) {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)

  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const fit = () => {
      const availableWidth = Math.max(stage.clientWidth - FRAME_PADDING.x, 0)
      const availableHeight = Math.max(stage.clientHeight - FRAME_PADDING.y, 0)
      const width = Math.min(availableWidth, availableHeight * RATIO[ratio])
      setSize({ width: Math.floor(width), height: Math.floor(width / RATIO[ratio]) })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [ratio])

  return (
    <div className="stage" ref={stageRef}>
      <div className="spark-stage-center">
        {size ? (
          <div className="frame spark-empty-frame" style={{ width: size.width, height: size.height }} role="img" aria-label={label}>
            <span>{label}</span>
          </div>
        ) : null}
      </div>
      <div className="stage-foot">
        {sceneLabel ? (
          <div className="pill">
            <Icon name="scenes" size="sm" />
            <span>{sceneLabel}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="pill">{ratio}</div>
      </div>
    </div>
  )
}

/** The design's notice (`.toast`), shown for 2.2 s whenever the session raises a new notice. */
function Toast({ notice }: { notice: SparkNotice | null }) {
  const t = useTranslations('Spark.editor.notices')
  const [hiddenId, setHiddenId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setHiddenId(notice.id), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const show = notice !== null && hiddenId !== notice.id
  // WP4: a refused Motion write names the server's reason (a sentence per known reason, a general one otherwise).
  const motionKey = notice?.kind === 'motionRefused' ? `motionRefused.${notice.reason ?? 'other'}` : null
  const text = !notice ? '' : motionKey ? t(t.has(motionKey) ? motionKey : 'motionRefused.other') : t(notice.kind, notice.values)
  return (
    <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">
      <Icon name="check" />
      <span>{text}</span>
    </div>
  )
}

/** m:ss.t (design `fmtT`). */
function formatTenths(value: number) {
  const seconds = Math.max(0, value)
  return `${formatSeconds(seconds)}.${Math.floor((seconds % 1) * 10)}`
}

function formatTotal(timeline: TimelineScene[]) {
  const total = totalSeconds(timeline)
  return total === null ? '—' : formatSeconds(total)
}
