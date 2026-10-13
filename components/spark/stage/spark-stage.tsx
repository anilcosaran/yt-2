'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { SparkAspectRatio } from '@/lib/spark/api'
import { sceneLayerViews } from '@/lib/spark/stage/document-layers'
import type { StageOverlay, StageViewState } from '@/lib/spark/stage/stage-controller'
import type { StageRect } from '@/lib/spark/stage/stage-types'
import type { SparkCompositionState } from '@/lib/spark/composition-session'
import { pendingInsertsFor } from '@/lib/spark/stage/pending-inserts'
import { acceptsToolDrop, readToolDrop, type CanvasPoint, type SparkToolDrop } from '@/lib/spark/stage/placement'

import { StudioIcon } from '../studio-icon'
import { StageAspectPicker, StageNoticePill, StageShortcutsSheet } from './stage-canvas-extras'
import { StageContextMenu } from './stage-context-menu'
import { StageContextToolbar, type ContextToolbarOptions } from './stage-context-toolbar'
import { StageToolbox } from './stage-toolbox'
import type { SparkStageBinding } from './use-spark-stage'
import { useStageState } from './use-stage-state'
import './stage.css'

const RATIO: Record<SparkAspectRatio, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 }
// The design's viewport padding (40px top, 48px sides, 64px bottom).
const FRAME_PADDING = { x: 96, y: 104 }
/** The design pads the selection frame by 3 px around the element (`positionSel`). */
const SEL_PAD = 3

/**
 * The editor's canvas (design `.stage` > `.frame`): the compiled scene drawn by the pinned motion runtime, footage under
 * and between its layers, the selection frame with four corner handles, hover outline, snap guides, the position badge,
 * the floating toolbox, the context menu and the inline text editor. The frame scales the canvas to fit the stage. All
 * behaviour lives in `SparkStageController`; this component only places DOM and forwards events.
 */
export function SparkStage({
  binding,
  composition,
  ratio,
  emptyLabel,
  sceneLabel,
  aspectLabel,
  canWrite,
  writeTitle,
  onToolDrop,
  contextToolbar,
}: {
  binding: SparkStageBinding
  composition: SparkCompositionState
  ratio: SparkAspectRatio
  emptyLabel: string
  sceneLabel: string | null
  aspectLabel: string
  canWrite: boolean
  writeTitle?: string
  /**
   * E1-A D14: a card of an editor tool or files from the desktop dropped on the canvas, with the drop point in canvas
   * pixels (null when the pointer was not over the frame). Without it (or while read-only) the canvas accepts no drop.
   */
  onToolDrop?: (drop: SparkToolDrop, point: CanvasPoint | null) => void
  /**
   * `SPARK_CONTEXT_TOOLBAR_ENABLED`: the per-kind contextual toolbar instead of the toolbox, the canvas format picker, the "?"
   * shortcuts sheet and the canvas notices. Absent: the stage is exactly as before.
   */
  contextToolbar?: ContextToolbarOptions
}) {
  const t = useTranslations('Spark.editor.stage')
  const tTransition = useTranslations('Spark.editor.transition')
  const { controller } = binding
  const state = useStageState(binding)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const frameRef = React.useRef<HTMLDivElement>(null)
  const selRef = React.useRef<HTMLDivElement>(null)
  const badgeRef = React.useRef<HTMLDivElement>(null)
  const guideVRef = React.useRef<HTMLDivElement>(null)
  const guideHRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)
  const [stageHeight, setStageHeight] = React.useState(0)
  const [origin, setOrigin] = React.useState({ x: 0, y: 0 })
  const [dropActive, setDropActive] = React.useState(false)
  const acceptsDrops = canWrite && onToolDrop !== undefined
  const canvasRatio = state.presenter.plan ? state.presenter.plan.canvas.width / state.presenter.plan.canvas.height : RATIO[ratio]

  // Fit the frame inside the stage (design viewport padding) and tell the controller the frame's CSS width.
  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const fit = () => {
      const availableWidth = Math.max(stage.clientWidth - FRAME_PADDING.x, 0)
      const availableHeight = Math.max(stage.clientHeight - FRAME_PADDING.y, 0)
      const width = Math.floor(Math.min(availableWidth, availableHeight * canvasRatio))
      setSize({ width, height: Math.floor(width / canvasRatio) })
      setStageHeight(stage.clientHeight)
      controller.setFrameWidth(width)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [controller, canvasRatio])

  // The frame's offset inside the stage (overlays are positioned against the stage, like the design's `positionSel`).
  React.useLayoutEffect(() => {
    const stage = stageRef.current
    const frame = frameRef.current
    if (!stage || !frame) return
    const s = stage.getBoundingClientRect()
    const f = frame.getBoundingClientRect()
    setOrigin((current) => (current.x === f.left - s.left && current.y === f.top - s.top ? current : { x: f.left - s.left, y: f.top - s.top }))
  }, [size])

  // Bind the runtime host to the frame (the frame is an empty element React never renders children into). The frame exists
  // only once the stage has been measured (`size`), so the binding follows that, not just the controller.
  const hasFrame = size !== null
  React.useEffect(() => {
    const frame = frameRef.current
    if (!hasFrame || !frame) return undefined
    controller.attach(frame)
    return () => controller.detach()
  }, [controller, hasFrame])

  // A drag or playback moves the selection box, the position badge and the snap guides on the DOM only (`StageLive`): no
  // React render per pointer move or per frame. The frame's offset is read from a ref so the subscription stays put.
  const placement = React.useRef({ origin, stageHeight })
  React.useLayoutEffect(() => {
    placement.current = { origin, stageHeight }
  })
  React.useLayoutEffect(
    () =>
      controller.subscribeLive((live) => {
        const { origin: at, stageHeight: height } = placement.current
        const sel = selRef.current
        if (sel && live.overlay) {
          sel.style.left = `${at.x + live.overlay.x - SEL_PAD}px`
          sel.style.top = `${at.y + live.overlay.y - SEL_PAD}px`
          sel.style.width = `${live.overlay.width + SEL_PAD * 2}px`
          sel.style.height = `${live.overlay.height + SEL_PAD * 2}px`
        }
        const badge = badgeRef.current
        if (badge && live.badge) {
          badge.textContent = live.badge.text
          badge.style.left = `${at.x + live.badge.x}px`
          badge.style.top = `${Math.min(at.y + live.badge.y, (height || 9999) - 70)}px`
        }
        const guide = (element: HTMLDivElement | null, value: number | null | undefined, axis: 'v' | 'h') => {
          if (!element) return
          element.style.display = value == null ? 'none' : 'block'
          if (value == null) return
          if (axis === 'v') element.style.left = `${at.x + value}px`
          else element.style.top = `${at.y + value}px`
        }
        guide(guideVRef.current, live.guides?.v, 'v')
        guide(guideHRef.current, live.guides?.h, 'h')
      }),
    [controller],
  )

  const hasScenes = composition.workingCopy ? composition.workingCopy.document.scene_sequence.scene_ids.length > 0 : false
  const presenter = state.presenter
  const overlay = state.overlay
  const selectedKind = overlay ? selectedKindLabel(composition, state, t) : null

  return (
    <div
      className={`stage${state.dragging ? ' dragging' : ''}${dropActive ? ' drop-ready' : ''}`}
      ref={stageRef}
      tabIndex={0}
      aria-label={t('canvasLabel')}
      aria-keyshortcuts="Space ArrowLeft ArrowRight Delete Enter Control+K"
      onKeyDown={(event) => {
        // Y1R-EDITOR-5: the canvas shortcuts apply only while the canvas itself has the focus; the toolbox and menu buttons
        // inside the stage keep the browser's own Enter, Space and Tab.
        if (event.target !== event.currentTarget) return
        void controller.handleKeyDown(event)
      }}
      onDragOver={
        acceptsDrops
          ? (event) => {
              if (!acceptsToolDrop(event.dataTransfer)) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              setDropActive(true)
            }
          : undefined
      }
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropActive(false)
      }}
      onDrop={
        acceptsDrops
          ? (event) => {
              setDropActive(false)
              if (!acceptsToolDrop(event.dataTransfer)) return
              event.preventDefault()
              const drop = readToolDrop(event.dataTransfer)
              if (drop) onToolDrop(drop, controller.canvasPointAt({ x: event.clientX, y: event.clientY }))
            }
          : undefined
      }
    >
      <div className="stage-center">
        {size ? (
          <div
            className="frame"
            ref={frameRef}
            role="group"
            aria-label={t('frameLabel')}
            style={{ width: size.width, height: size.height }}
            onPointerDown={(event) => {
              stageRef.current?.focus({ preventScroll: true })
              controller.handlePointerDown(event)
            }}
            onPointerMove={(event) => controller.handlePointerMove(event)}
            onPointerLeave={() => controller.handlePointerLeave()}
            onDoubleClick={(event) => controller.handleDoubleClick(event)}
            onContextMenu={(event) => controller.openMenu(event)}
          />
        ) : null}
      </div>

      <StageStatus
        state={state}
        hasScenes={hasScenes}
        unresolved={composition.selectedSceneId !== null && (presenter.plan?.unresolvedSceneIds.includes(composition.selectedSceneId) ?? false)}
        emptyLabel={emptyLabel}
        size={size}
        origin={origin}
        onRetry={() => void controller.presenter.show(binding.playback.frame)}
      />

      <PendingInsertBoxes controller={controller} sceneId={presenter.sceneId} size={size} origin={origin} />

      {state.hover ? <div className="stage-hover" style={placed(state.hover, origin)} /> : null}
      {state.safeArea ? <div className="stage-safe" style={placed(state.safeArea, origin)} /> : null}
      {/* While dragging both guides exist (hidden when not snapping): the drag shows and moves them on the DOM only. */}
      {state.dragging || state.guides?.v != null ? (
        <div
          ref={guideVRef}
          className="guide v"
          style={{ display: state.guides?.v != null ? 'block' : 'none', left: origin.x + (state.guides?.v ?? 0), top: origin.y, height: size?.height ?? 0 }}
        />
      ) : null}
      {state.dragging || state.guides?.h != null ? (
        <div
          ref={guideHRef}
          className="guide h"
          style={{ display: state.guides?.h != null ? 'block' : 'none', top: origin.y + (state.guides?.h ?? 0), left: origin.x, width: size?.width ?? 0 }}
        />
      ) : null}
      {state.badge ? (
        <div ref={badgeRef} className="badge" style={{ left: origin.x + state.badge.x, top: Math.min(origin.y + state.badge.y, (stageHeight || 9999) - 70) }}>
          {state.badge.text}
        </div>
      ) : null}

      {overlay ? (
        <SelectionFrame
          ref={selRef}
          overlay={overlay}
          origin={origin}
          editing={state.editing !== null}
          canWrite={canWrite}
          onHandle={(event) => controller.handlePointerDown(event)}
        />
      ) : null}

      {overlay && !state.dragging && !state.editing && contextToolbar ? (
        <StageContextToolbar
          binding={binding}
          overlay={overlay}
          origin={origin}
          stageRef={stageRef}
          composition={composition}
          canWrite={canWrite}
          writeTitle={writeTitle}
          options={contextToolbar}
          onMenu={(x, y) => controller.openSelectionMenu({ x, y })}
        />
      ) : null}
      {overlay && !state.dragging && !state.editing && !contextToolbar ? (
        <StageToolbox
          binding={binding}
          overlay={overlay}
          origin={origin}
          stageRef={stageRef}
          composition={composition}
          canWrite={canWrite}
          writeTitle={writeTitle}
          onMenu={(x, y) => controller.openSelectionMenu({ x, y })}
        />
      ) : null}

      {state.editing ? <StageTextEditor binding={binding} origin={origin} /> : null}

      <div className="stage-foot">
        {sceneLabel ? (
          <div className="pill">
            <StudioIcon name="scenes" className="sm" />
            <span>{sceneLabel}</span>
          </div>
        ) : (
          <span />
        )}
        {contextToolbar ? (
          <span className="stage-foot-tools">
            <button
              type="button"
              className="pill ib-pill"
              title={t('shortcuts.open')}
              aria-label={t('shortcuts.open')}
              aria-keyshortcuts="Shift+Slash"
              onClick={() => controller.toggleShortcuts(true)}
            >
              <StudioIcon name="keyboard" className="sm" />
            </button>
            <StageAspectPicker binding={binding} ratio={ratio} label={aspectLabel} canWrite={canWrite && hasScenes} writeTitle={writeTitle} />
          </span>
        ) : (
          <div className="pill">{aspectLabel}</div>
        )}
      </div>

      {contextToolbar && state.replacing ? (
        <div className="stage-replace pill" role="status">
          <StudioIcon name="refresh" className="sm" />
          <span>{t('ctb.replacing')}</span>
          <button type="button" className="btn sm" onClick={() => controller.cancelReplace()}>
            {t('ctb.cancel')}
          </button>
        </div>
      ) : null}
      {contextToolbar ? <StageNoticePill binding={binding} /> : null}
      {contextToolbar && state.shortcuts ? <StageShortcutsSheet redo={controller.historyKeys} onClose={() => controller.toggleShortcuts(false)} /> : null}

      {presenter.sceneStatus === 'partial' && presenter.issues.length > 0 ? (
        <div className="stage-warn pill" role="status" title={presenter.issues.map((issue) => issue.message).join('\n')}>
          <StudioIcon name="sparkles" className="sm" />
          <span>{t('partial')}</span>
        </div>
      ) : null}

      {/* Live FX: a transition the stage blends that the export cannot render yet says so while it is on screen. */}
      {presenter.transition?.previewOnly ? (
        <div className="stage-preview-only pill" role="status" data-preview-only={presenter.transition.previewOnly}>
          <StudioIcon name="sparkles" className="sm" />
          <span>{tTransition(`previewOnlyBadge.${presenter.transition.previewOnly}`)}</span>
        </div>
      ) : null}

      {/* Timeline v3: playback waits a moment for a frame still loading (a transition) instead of skipping it. */}
      {state.waiting ? (
        <div className="stage-wait" data-stage-wait aria-hidden>
          <span className="spin" />
        </div>
      ) : null}

      <div className="sr-only" role="status" aria-live="polite">
        {selectedKind}
      </div>

      {state.menu ? (
        <StageContextMenu
          binding={binding}
          menu={state.menu}
          composition={composition}
          canWrite={canWrite}
          writeTitle={writeTitle}
          onClose={() => controller.closeMenu()}
        />
      ) : null}
    </div>
  )
}

/**
 * WP4/WP5a: what was just added and is not in the server's picture yet (`pending-inserts.ts`): a selected placeholder box for
 * a queued Motion, the local file with an upload / processing badge for a media file on its way. Not part of the document,
 * never interactive (the canvas under it keeps every gesture); shown on the scene it lands in (or any scene when unknown).
 */
function PendingInsertBoxes({
  controller,
  sceneId,
  size,
  origin,
}: {
  controller: object
  sceneId: string | null
  size: { width: number; height: number } | null
  origin: { x: number; y: number }
}) {
  const t = useTranslations('Spark.editor.stage.pending')
  const store = pendingInsertsFor(controller)
  const items = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const shown = items.filter((item) => item.sceneId === null || item.sceneId === sceneId)
  if (!size || shown.length === 0) return null
  return (
    <>
      {shown.map((item, index) => {
        // Timeline v3: a card being added from the drawer shows its thumbnail (`posterUrl`) when there is no local file.
        const poster = item.previewUrl === null && item.posterUrl !== null && (item.kind === 'image' || item.kind === 'video')
        const media = poster || (item.previewUrl !== null && (item.kind === 'image' || item.kind === 'video'))
        // A Motion placeholder sits inside the frame (stacked a little when several are queued); a media preview fills it.
        const inset = media ? 0 : Math.min(0.08 + index * 0.03, 0.2)
        const box = {
          left: origin.x + size.width * inset,
          top: origin.y + size.height * inset,
          width: size.width * (1 - inset * 2),
          height: size.height * (1 - inset * 2),
        }
        const badge =
          item.status === 'uploading'
            ? t('uploading', { percent: item.progress ?? 0 })
            : item.status === 'processing'
              ? t('processing')
              : t('adding', { title: item.label })
        return (
          <div key={item.id} className={`stage-pending ${item.kind}${media ? ' media' : ''}`} data-pending={item.kind} data-pending-status={item.status} style={box} aria-hidden>
            {poster ? <img src={item.posterUrl!} alt="" /> : null}
            {!poster && media && item.kind === 'image' ? <img src={item.previewUrl!} alt="" /> : null}
            {!poster && media && item.kind === 'video' ? <video src={item.previewUrl!} muted playsInline autoPlay loop /> : null}
            <span className="stage-pending-badge">
              <span className="spin" aria-hidden />
              <span>{badge}</span>
            </span>
          </div>
        )
      })}
      <div className="sr-only" role="status" aria-live="polite">
        {shown.map((item) => (item.status === 'saving' ? t('adding', { title: item.label }) : item.label)).join(', ')}
      </div>
    </>
  )
}

const placed = (rect: StageRect, origin: { x: number; y: number }): React.CSSProperties => ({
  left: origin.x + rect.x,
  top: origin.y + rect.y,
  width: rect.width,
  height: rect.height,
})

function selectedKindLabel(composition: SparkCompositionState, state: StageViewState, t: ReturnType<typeof useTranslations>): string {
  const overlay = state.overlay
  const sceneId = state.selection?.sceneId ?? null
  if (!overlay || !sceneId) return ''
  const view = sceneLayerViews(composition.workingCopy?.document ?? null, sceneId).find((candidate) => candidate.layerId === overlay.layerId)
  if (!view) return ''
  if (view.kind === 'clip') return t('selectedLabel', { kind: t(view.mediaKind === 'video' ? 'kinds.video' : 'kinds.image') })
  return t('selectedLabel', { kind: t(`kinds.${view.kind}`) })
}

/**
 * Selection frame (design `.sel`) with the four corner handles. A shape that resizes freely (E1-B, D4: not a square or a
 * circle) also has the four edge handles; every other layer scales, so it has corners only.
 */
function SelectionFrame({
  ref,
  overlay,
  origin,
  editing,
  canWrite,
  onHandle,
}: {
  overlay: StageOverlay
  origin: { x: number; y: number }
  editing: boolean
  canWrite: boolean
  onHandle: (event: React.PointerEvent<HTMLElement>) => void
  ref?: React.Ref<HTMLDivElement>
}) {
  const rect = { x: overlay.rect.x - SEL_PAD, y: overlay.rect.y - SEL_PAD, width: overlay.rect.width + SEL_PAD * 2, height: overlay.rect.height + SEL_PAD * 2 }
  // Spark styling round: a locked layer (selected from a panel) shows its frame without handles; the stage does not move it.
  return (
    <div
      ref={ref}
      className={`sel${overlay.isText ? ' textmode' : ''}${editing ? ' editing' : ''}${overlay.locked ? ' locked' : ''}`}
      data-layer={overlay.layerId}
      data-locked={overlay.locked ? '' : undefined}
      style={{ display: 'block', ...placed(rect, origin) }}
    >
      {canWrite && overlay.resizable
        ? (overlay.edgeHandles ? (['nw', 'ne', 'sw', 'se', 'n', 'e', 's', 'w'] as const) : (['nw', 'ne', 'sw', 'se'] as const)).map((handle) => (
            <i
              key={handle}
              data-h={handle}
              onPointerDown={(event) => {
                event.stopPropagation()
                onHandle(event)
              }}
            />
          ))
        : null}
    </div>
  )
}

function StageStatus({
  state,
  hasScenes,
  unresolved,
  emptyLabel,
  size,
  origin,
  onRetry,
}: {
  state: StageViewState
  hasScenes: boolean
  /** The selected scene has no resolved length yet: playback skips it, so the frame says so instead of showing another scene. */
  unresolved: boolean
  emptyLabel: string
  size: { width: number; height: number } | null
  origin: { x: number; y: number }
  onRetry: () => void
}) {
  const t = useTranslations('Spark.editor.stage')
  const { presenter } = state
  if (!size) return null
  const box = { left: origin.x, top: origin.y, width: size.width, height: size.height } as const
  let body: React.ReactNode = null
  if (!hasScenes) body = <span>{emptyLabel}</span>
  else if (unresolved) {
    return (
      <div className="stage-state cover" style={box}>
        <span role="status">{t('unavailable')}</span>
      </div>
    )
  } else if (presenter.error && (presenter.status === 'error' || presenter.sceneStatus === 'failed')) {
    body = (
      <>
        <span role="alert">{t(`errors.${presenter.error.code}`)}</span>
        <button type="button" className="btn sm" onClick={onRetry}>
          {t('retry')}
        </button>
      </>
    )
  } else if (presenter.sceneStatus === 'unavailable') body = <span>{t('unavailable')}</span>
  else if (presenter.status === 'idle' || presenter.status === 'loading' || (presenter.sceneStatus === 'loading' && presenter.sceneId === null)) {
    body = (
      <>
        <span className="spin" aria-hidden />
        <span role="status">{t('loading')}</span>
      </>
    )
  }
  if (!body) return null
  return (
    <div className="stage-state" style={box}>
      {body}
    </div>
  )
}

/** Inline text editor over the text box (D5): the pinned face at the canvas scale; Enter commits, Esc cancels, blur commits. */
function StageTextEditor({ binding, origin }: { binding: SparkStageBinding; origin: { x: number; y: number } }) {
  const t = useTranslations('Spark.editor.stage')
  const { controller } = binding
  const state = useStageState(binding)
  const editing = state.editing
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = React.useState(editing?.text ?? '')
  const done = React.useRef(false)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    element.focus()
    element.select()
  }, [])

  if (!editing) return null
  const commit = () => {
    if (done.current) return
    done.current = true
    void controller.commitTextEdit(value).then(() => {
      done.current = false
    })
  }
  return (
    <>
      <textarea
        ref={ref}
        className="stage-edit"
        aria-label={t('edit.label')}
        value={value}
        readOnly={editing.committing}
        spellCheck={false}
        style={{
          left: origin.x + editing.rect.x,
          top: origin.y + editing.rect.y,
          width: editing.rect.width,
          height: editing.rect.height,
          fontFamily: `'${editing.fontFamily}', sans-serif`,
          fontWeight: editing.fontWeight,
          fontStyle: editing.fontStyle,
          fontSize: editing.fontSizePx,
          lineHeight: `${editing.lineHeightPx}px`,
          color: editing.color,
          textAlign: editing.align,
        }}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.preventDefault()
            done.current = true
            controller.cancelTextEdit()
          } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            commit()
          }
        }}
        onBlur={commit}
      />
      {editing.tooLong ? (
        <div className="stage-edit-note" role="alert" style={{ left: origin.x + editing.rect.x + editing.rect.width / 2, top: origin.y + editing.rect.y + editing.rect.height + 6 }}>
          {t('edit.tooLong')}
        </div>
      ) : null}
    </>
  )
}
