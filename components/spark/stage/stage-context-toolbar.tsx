'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { ANIMATION_PRESETS, animationPreset, offeredPresets, presetFitsSlot, presetFitsTarget, type AnimationSlot } from '@/lib/spark/animations/animation-catalog'
import { animationTarget } from '@/lib/spark/animations/animation-target'
import { choiceForPreset, choiceOf, type SlotChoice } from '@/lib/spark/animations/layer-animations'
import type { SparkCompositionState } from '@/lib/spark/composition-session'
import { motionParameterSetSpec } from '@/lib/spark/composition-typed-edits'
import { loadMotionExposureShared } from '@/lib/spark/motion-exposure'
import { motionLayerViewOf, type MotionLayerView } from '@/lib/spark/motion-layers'
import { durationEdit, motionParameterFields, type MotionDurationField } from '@/lib/spark/motion-parameter-fields'
import { layerViewOf, sceneLayerViews } from '@/lib/spark/stage/document-layers'
import { motionControlSet } from '@/lib/spark/stage/motion-controls'
import type { StageOverlay } from '@/lib/spark/stage/stage-controller'
import {
  LINE_HEIGHT_CHOICES,
  NOT_YET_CONTROLS,
  clampFontSize,
  clampLineHeight,
  colorChanged,
  colorInputValue,
  contextKind,
  controlSet,
  currentFont,
  defaultOutline,
  fontForFamilyChoice,
  lockAvailable,
  nextAlign,
  opacityOfPercent,
  opacityPercent,
  outlineWidthOrNull,
  stepFontSize,
  styleToggle,
  toolboxPlacement,
  type ContextKind,
  type NotYetControl,
} from '@/lib/spark/stage/toolbox-model'

import { SparkMotionControls } from '../spark-motion-controls'
import { StudioIcon } from '../studio-icon'
import { applyAnimationSlot, type SlotOutcome } from '../tools/animation-actions'
import { useMotionExposure } from './spark-motion-inspector'
import { ColorInput, NumberField, RangeField } from './stage-fields'
import type { SparkStageBinding } from './use-spark-stage'
import { usePlaybackSnapshot, useStageState } from './use-stage-state'

/** The design pads the selection frame by 3 px around the element; the toolbar sits against that frame. */
const SEL_PAD = 3
const KIND_ICON: Record<ContextKind, string> = { text: 'type', shape: 'shapes', image: 'image', video: 'video', motion: 'motion' }
const ALIGN_ICON = { start: 'al', center: 'ac', end: 'ar' } as const
const NOT_YET_ICON: Record<NotYetControl, string> = {
  stroke: 'stroke',
  opacity: 'opacity',
  crop: 'crop',
}
const QUICK_SLOTS: readonly AnimationSlot[] = ['in', 'out']

/** The toolbar's popovers: one open at a time (Escape closes it). */
type ToolbarPanel = 'animate' | 'lineHeight' | 'outline' | 'opacity' | null

export type ContextToolbarOptions = {
  /** The animation quick picker (`SPARK_ANIMATIONS_PANEL_ENABLED`: the presets the inspector schema lists). */
  animations: boolean
  /** "Replace" of an image or video: the shell opens the Media tool; the pick replaces the armed clip's source. */
  onReplaceMedia?: () => void
}

/**
 * The contextual floating toolbar (`SPARK_CONTEXT_TOOLBAR_ENABLED`, Canva / CapCut style): above the selected layer, hidden
 * while dragging and while the clip plays, with the controls of that layer kind, then the common actions.
 *
 * - text: edit, font family (platform catalogue), size (field and -/+), colour (shown on the canvas while picking), bold,
 *   italic, alignment, underline (Ctrl/Cmd+U), strikethrough (Ctrl/Cmd+Shift+X), line spacing, outline colour and width;
 * - shape: fill (shown while picking), corner radius of a rectangle;
 * - image / video: Fill (cover the canvas) / Fit (contain), Replace, the video's sound;
 * - Motion: energy and pattern, length;
 * - text, shape, image: opacity (shown on the canvas while sliding);
 * - every kind: the In / Out animation quick picker, duplicate, order, lock (the stage then neither selects nor drags the
 *   layer; the panels still edit it), delete, Ask AI, More.
 * What the document cannot store or the export cannot draw yet (a shape's outline, a video's opacity, crop) is shown disabled
 * with the reason. Every change is ONE typed command through the stage controller (a burst of -/+ presses is coalesced into
 * one by the write queue's key).
 */
export function StageContextToolbar({
  binding,
  overlay,
  origin,
  stageRef,
  composition,
  canWrite,
  writeTitle,
  options,
  onMenu,
}: {
  binding: SparkStageBinding
  overlay: StageOverlay
  origin: { x: number; y: number }
  stageRef: React.RefObject<HTMLDivElement | null>
  composition: SparkCompositionState
  canWrite: boolean
  writeTitle?: string
  options: ContextToolbarOptions
  onMenu: (x: number, y: number) => void
}) {
  const t = useTranslations('Spark.editor.stage')
  const tc = useTranslations('Spark.editor.stage.ctb')
  const { controller, schema } = binding
  const playback = usePlaybackSnapshot(binding)
  const state = useStageState(binding)
  const ref = React.useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = React.useState<{ left: number; top: number } | null>(null)
  const [openPanel, setOpenPanel] = React.useState<ToolbarPanel>(null)

  const document = composition.workingCopy?.document ?? null
  const sceneId = controller.selection.getSnapshot()?.sceneId ?? null
  const stored = layerViewOf(document, sceneId, overlay.layerId)
  // Y1R-EDITOR-3: the toolbar shows and builds on the style already sent; the document catches up after the redraw.
  const latest = () => (stored ? controller.withPendingStyle(stored) : null)
  const view = latest()
  const kind = view ? contextKind(view) : null

  // Above the selection frame, inside the stage. Measured after every render (its width follows its content); the equality
  // guard stops a loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    const element = ref.current
    const stage = stageRef.current
    if (!element || !stage) return
    const next = toolboxPlacement({
      selection: {
        x: origin.x + overlay.rect.x - SEL_PAD,
        y: origin.y + overlay.rect.y - SEL_PAD,
        width: overlay.rect.width + SEL_PAD * 2,
        height: overlay.rect.height + SEL_PAD * 2,
      },
      toolbox: { width: element.offsetWidth, height: element.offsetHeight },
      stage: { width: stage.clientWidth, height: stage.clientHeight },
    })
    setPlacement((current) => (current && current.left === next.left && current.top === next.top ? current : next))
  })

  if (!view || !kind || !sceneId || !document || playback.playing) return null

  const disabled = !canWrite
  const controls = controlSet(schema, view)
  const motion = kind === 'motion' ? motionLayerViewOf(document, sceneId, view.layerId) : null
  const motionControls = motion ? motionControlSet(schema, motion.v2) : null
  const arrange = kind === 'motion' ? (motionControls?.arrange ?? false) : controls.arrange
  const remove = kind === 'motion' ? (motionControls?.remove ?? false) : controls.remove
  const order = sceneLayerViews(document, sceneId).map((candidate) => candidate.layerId)
  const index = order.indexOf(view.layerId)
  const atTop = index === order.length - 1
  const atBottom = index === 0
  const notYet = NOT_YET_CONTROLS[kind] as readonly NotYetControl[]
  const canLock = lockAvailable(schema, view)
  const locked = view.locked === true

  return (
    <div
      className="ftb on ctb"
      ref={ref}
      role="toolbar"
      aria-label={t('toolbox.label')}
      data-context-kind={kind}
      style={{ left: placement?.left ?? 0, top: placement?.top ?? 0, visibility: placement ? 'visible' : 'hidden' }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // Keys typed in the toolbar's fields never reach the canvas shortcuts.
        event.stopPropagation()
        if (event.key === 'Escape') setOpenPanel(null)
      }}
    >
      <div className="tag">
        <StudioIcon name={KIND_ICON[kind]} className="sm" />
        {t(`kinds.${kind === 'motion' ? 'motion_instance' : kind}`)}
      </div>
      <div className="fsep" />

      {kind === 'text' ? <TextControls binding={binding} latest={latest} disabled={disabled} writeTitle={writeTitle} panel={openPanel} onPanel={setOpenPanel} /> : null}
      {kind === 'shape' ? <ShapeControls binding={binding} latest={latest} disabled={disabled} writeTitle={writeTitle} /> : null}
      {kind === 'image' || kind === 'video' ? (
        <MediaControls binding={binding} latest={latest} kind={kind} disabled={disabled} writeTitle={writeTitle} replacing={state.replacing?.layerId === view.layerId} onReplace={options.onReplaceMedia} />
      ) : null}
      {kind === 'motion' && motion ? <MotionControls binding={binding} composition={composition} view={motion} sceneId={sceneId} canWrite={canWrite} writeTitle={writeTitle} /> : null}
      {controls.opacity ? (
        <OpacityControl binding={binding} latest={latest} disabled={disabled} writeTitle={writeTitle} open={openPanel === 'opacity'} onOpen={(open) => setOpenPanel(open ? 'opacity' : null)} />
      ) : null}

      {notYet.length > 0 ? (
        <span className="ctb-soon" role="group" aria-label={tc('notYet.group')}>
          {notYet.map((control) => (
            <button key={control} type="button" className="ib sm" disabled aria-disabled title={`${tc(`notYet.${control}`)} · ${tc('notYet.reason')}`} aria-label={tc(`notYet.${control}`)} data-not-yet={control}>
              <StudioIcon name={NOT_YET_ICON[control]} />
            </button>
          ))}
        </span>
      ) : null}

      {options.animations && kind !== 'motion' ? (
        <>
          <div className="fsep" />
          <button
            type="button"
            className={`dd${openPanel === 'animate' ? ' on' : ''}`}
            aria-expanded={openPanel === 'animate'}
            aria-haspopup="dialog"
            title={tc('animate')}
            onClick={() => setOpenPanel((current) => (current === 'animate' ? null : 'animate'))}
          >
            <StudioIcon name="animate" className="sm" />
            {tc('animate')}
          </button>
          {openPanel === 'animate' ? <AnimationQuickPicker binding={binding} composition={composition} sceneId={sceneId} layerId={view.layerId} canWrite={canWrite} writeTitle={writeTitle} /> : null}
        </>
      ) : null}

      <div className="fsep" />
      <button
        type="button"
        className="ib sm"
        disabled={disabled || kind === 'motion'}
        title={kind === 'motion' ? tc('duplicateMotion') : (writeTitle ?? tc('duplicate'))}
        aria-label={tc('duplicate')}
        aria-keyshortcuts="Control+D"
        onClick={() => void controller.duplicateSelected()}
      >
        <StudioIcon name="dup" />
      </button>
      {arrange ? (
        <>
          <button type="button" className="ib sm" disabled={disabled || atTop} title={writeTitle ?? t('menu.forward')} aria-label={t('menu.forward')} onClick={() => void controller.arrangeSelected('forward')}>
            <StudioIcon name="front" />
          </button>
          <button type="button" className="ib sm" disabled={disabled || atBottom} title={writeTitle ?? t('menu.backward')} aria-label={t('menu.backward')} onClick={() => void controller.arrangeSelected('backward')}>
            <StudioIcon name="back" />
          </button>
        </>
      ) : null}
      {canLock ? (
        <button
          type="button"
          className={`ib sm${locked ? ' on' : ''}`}
          aria-pressed={locked}
          disabled={disabled}
          title={writeTitle ?? (locked ? tc('lockedHint') : tc('lockHint'))}
          aria-label={locked ? tc('unlock') : tc('lock')}
          data-lock
          onClick={() => void controller.setLayerLocked(!locked)}
        >
          <StudioIcon name={locked ? 'locked' : 'lock'} />
        </button>
      ) : null}
      {remove ? (
        <button type="button" className="ib sm" disabled={disabled} title={writeTitle ?? t('menu.delete')} aria-label={t('menu.delete')} aria-keyshortcuts="Delete" onClick={() => void controller.deleteSelected()}>
          <StudioIcon name="trash" />
        </button>
      ) : null}

      <div className="fsep" />
      <button type="button" className="ask" disabled={disabled} title={writeTitle} aria-keyshortcuts="Control+K" onClick={() => controller.askAi()}>
        <StudioIcon name="sparkles" className="sm" />
        {t('toolbox.askAi')}
      </button>
      <button
        type="button"
        className="ib sm"
        aria-haspopup="menu"
        title={t('toolbox.more')}
        aria-label={t('toolbox.more')}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          onMenu(rect.left, rect.bottom + 4)
        }}
      >
        <StudioIcon name="more" />
      </button>
    </div>
  )
}

type LatestView = () => ReturnType<SparkStageBinding['controller']['withPendingStyle']> | null

function TextControls({
  binding,
  latest,
  disabled,
  writeTitle,
  panel,
  onPanel,
}: {
  binding: SparkStageBinding
  latest: LatestView
  disabled: boolean
  writeTitle?: string
  panel: ToolbarPanel
  onPanel: (panel: ToolbarPanel) => void
}) {
  const t = useTranslations('Spark.editor.stage')
  const tc = useTranslations('Spark.editor.stage.ctb')
  const { controller, schema } = binding
  const view = latest()
  if (!view?.style) return null
  const decoration = view.style.decoration
  const controls = controlSet(schema, view)
  const { family, face } = currentFont(schema, view)
  const bold = styleToggle(family, face, 'bold')
  const italic = styleToggle(family, face, 'italic')
  const align = view.style.align ?? 'start'
  // Read at the click: a second quick press must build on the first one, not on what was rendered before it.
  const faceTarget = (which: 'bold' | 'italic') => {
    const current = latest()
    const font = current ? currentFont(schema, current) : { family: null, face: null }
    return styleToggle(font.family, font.face, which).target
  }
  const step = (direction: 1 | -1) => {
    const size = latest()?.style?.sizePx
    if (size !== undefined) void controller.setTextStyle({ sizePx: stepFontSize(size, direction) })
  }
  return (
    <>
      {controls.content ? (
        <button type="button" className="ib sm" disabled={disabled} title={writeTitle ?? t('toolbox.editText')} aria-label={t('toolbox.editText')} aria-keyshortcuts="Enter" onClick={() => controller.startTextEdit()}>
          <StudioIcon name="edit" />
        </button>
      ) : null}
      {controls.family && schema ? (
        <select
          className="dd ctb-font"
          aria-label={t('toolbox.fontFamily')}
          disabled={disabled}
          title={writeTitle ?? t('toolbox.fontFamily')}
          value={family?.family ?? ''}
          style={family ? { fontFamily: `'${family.family}', sans-serif` } : undefined}
          onChange={(event) => {
            const font = fontForFamilyChoice(schema, view, event.target.value)
            if (font) void controller.setTextStyle({ font })
          }}
        >
          {family ? null : <option value="">—</option>}
          {schema.fonts.families.map((candidate) => (
            <option key={candidate.family} value={candidate.family}>
              {candidate.family}
            </option>
          ))}
        </select>
      ) : null}
      {controls.size ? (
        <span className="ctb-size" role="group" aria-label={t('toolbox.fontSize')}>
          <button type="button" className="ib sm" disabled={disabled} title={writeTitle ?? tc('smaller')} aria-label={tc('smaller')} onClick={() => step(-1)}>
            −
          </button>
          <NumberField
            variant="bare"
            label={t('toolbox.fontSize')}
            value={view.style.sizePx}
            format={(value) => String(Math.round(value))}
            disabled={disabled}
            title={writeTitle}
            onCommit={(value) => void controller.setTextStyle({ sizePx: clampFontSize(value) })}
          />
          <button type="button" className="ib sm" disabled={disabled} title={writeTitle ?? tc('larger')} aria-label={tc('larger')} onClick={() => step(1)}>
            +
          </button>
        </span>
      ) : null}
      {controls.color ? (
        <span className="swatch-input" title={writeTitle ?? t('toolbox.color')}>
          <span className="swatch" style={{ background: colorInputValue(view.style.color) }} />
          <ColorInput
            value={colorInputValue(view.style.color)}
            label={t('toolbox.color')}
            disabled={disabled}
            onPreview={(color) => controller.previewColor('text', color)}
            onCommit={(color) => {
              const current = latest()?.style?.color
              if (colorChanged(current, color)) void controller.setTextStyle({ color })
              else controller.previewColor('text', null)
            }}
          />
        </span>
      ) : null}
      {controls.weight && (bold.target || bold.on) ? (
        <button
          type="button"
          className={`ib sm${bold.on ? ' on' : ''}`}
          aria-pressed={bold.on}
          disabled={disabled || !bold.target}
          title={writeTitle ?? t('toolbox.bold')}
          aria-label={t('toolbox.bold')}
          onClick={() => {
            const target = faceTarget('bold')
            if (target) void controller.setTextStyle({ font: target.font })
          }}
        >
          <StudioIcon name="bold" />
        </button>
      ) : null}
      {controls.weight && (italic.target || italic.on) ? (
        <button
          type="button"
          className={`ib sm${italic.on ? ' on' : ''}`}
          aria-pressed={italic.on}
          disabled={disabled || !italic.target}
          title={writeTitle ?? t('toolbox.italic')}
          aria-label={t('toolbox.italic')}
          onClick={() => {
            const target = faceTarget('italic')
            if (target) void controller.setTextStyle({ font: target.font })
          }}
        >
          <StudioIcon name="italic" />
        </button>
      ) : null}
      {controls.align ? (
        <button
          type="button"
          className="ib sm"
          disabled={disabled}
          title={writeTitle ?? t(`toolbox.align.${align}`)}
          aria-label={t(`toolbox.align.${align}`)}
          onClick={() => void controller.setTextStyle({ align: nextAlign(latest()?.style?.align ?? 'start') })}
        >
          <StudioIcon name={ALIGN_ICON[align]} />
        </button>
      ) : null}
      {controls.decoration ? (
        <>
          <button
            type="button"
            className={`ib sm${decoration?.underline ? ' on' : ''}`}
            aria-pressed={decoration?.underline === true}
            disabled={disabled}
            title={writeTitle ?? tc('underlineHint')}
            aria-label={tc('underline')}
            aria-keyshortcuts="Control+U"
            data-decoration="underline"
            onClick={() => void controller.toggleTextDecoration('underline')}
          >
            <StudioIcon name="underline" />
          </button>
          <button
            type="button"
            className={`ib sm${decoration?.strikethrough ? ' on' : ''}`}
            aria-pressed={decoration?.strikethrough === true}
            disabled={disabled}
            title={writeTitle ?? tc('strikethroughHint')}
            aria-label={tc('strikethrough')}
            aria-keyshortcuts="Control+Shift+X"
            data-decoration="strikethrough"
            onClick={() => void controller.toggleTextDecoration('strikethrough')}
          >
            <StudioIcon name="strike" />
          </button>
        </>
      ) : null}
      {controls.lineHeight ? (
        <LineHeightControl binding={binding} latest={latest} disabled={disabled} writeTitle={writeTitle} open={panel === 'lineHeight'} onOpen={(open) => onPanel(open ? 'lineHeight' : null)} />
      ) : null}
      {controls.stroke ? (
        <OutlineControl binding={binding} latest={latest} disabled={disabled} writeTitle={writeTitle} open={panel === 'outline'} onOpen={(open) => onPanel(open ? 'outline' : null)} />
      ) : null}
    </>
  )
}

type PopoverProps = {
  binding: SparkStageBinding
  latest: LatestView
  disabled: boolean
  writeTitle?: string
  open: boolean
  onOpen: (open: boolean) => void
}

const formatLineHeight = (value: number) => String(Math.round(value * 100) / 100)

/** Line spacing of a text: the face's own ("Default") or a multiple of the size; ONE command per choice. */
function LineHeightControl({ binding, latest, disabled, writeTitle, open, onOpen }: PopoverProps) {
  const tc = useTranslations('Spark.editor.stage.ctb')
  const { controller } = binding
  const current = latest()?.style?.lineHeight
  const choose = (value: number | null) => {
    const stored = latest()?.style?.lineHeight
    if ((value ?? undefined) !== stored) void controller.setTextStyle({ lineHeight: value })
  }
  return (
    <span className="ctb-anchor">
      <button
        type="button"
        className={`ib sm${open || current !== undefined ? ' on' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        title={writeTitle ?? tc('lineHeight')}
        aria-label={tc('lineHeight')}
        data-line-height
        onClick={() => onOpen(!open)}
      >
        <StudioIcon name="line-height" />
      </button>
      {open ? (
        <div className="ctb-pop" role="dialog" aria-label={tc('lineHeight')}>
          <div className="ctb-chips" role="group" aria-label={tc('lineHeight')}>
            <button type="button" aria-pressed={current === undefined} onClick={() => choose(null)}>
              {tc('lineHeightDefault')}
            </button>
            {LINE_HEIGHT_CHOICES.map((choice) => (
              <button key={choice} type="button" aria-pressed={current === choice} onClick={() => choose(choice)}>
                {formatLineHeight(choice)}
              </button>
            ))}
          </div>
          <label className="ctb-pop-row">
            <span>{tc('lineHeightCustom')}</span>
            <NumberField variant="bare" label={tc('lineHeightCustom')} value={current ?? 1.2} format={formatLineHeight} onCommit={(value) => choose(clampLineHeight(value))} />
          </label>
        </div>
      ) : null}
    </span>
  )
}

/** The outline of a text: on/off, its colour and its width outside the glyphs (canvas px); ONE command per change. */
function OutlineControl({ binding, latest, disabled, writeTitle, open, onOpen }: PopoverProps) {
  const tc = useTranslations('Spark.editor.stage.ctb')
  const { controller } = binding
  const style = latest()?.style
  if (!style) return null
  const stroke = style.stroke
  const write = (next: { color: string; widthPx: number } | null) => void controller.setTextStyle({ stroke: next ? { color: next.color, width_px: next.widthPx } : null })
  return (
    <span className="ctb-anchor">
      <button
        type="button"
        className={`ib sm${open || stroke ? ' on' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        title={writeTitle ?? tc('outline')}
        aria-label={tc('outline')}
        data-outline
        onClick={() => onOpen(!open)}
      >
        <StudioIcon name="stroke" />
      </button>
      {open ? (
        <div className="ctb-pop" role="dialog" aria-label={tc('outline')}>
          <div className="ctb-chips" role="group" aria-label={tc('outline')}>
            <button type="button" aria-pressed={!stroke} onClick={() => stroke && write(null)}>
              {tc('outlineOff')}
            </button>
            <button type="button" aria-pressed={Boolean(stroke)} onClick={() => !stroke && write(defaultOutline(style.sizePx, style.color))}>
              {tc('outlineOn')}
            </button>
          </div>
          {stroke ? (
            <>
              <label className="ctb-pop-row">
                <span>{tc('outlineColor')}</span>
                <ColorInput
                  value={colorInputValue(stroke.color)}
                  label={tc('outlineColor')}
                  onCommit={(color) => {
                    const current = latest()?.style?.stroke
                    if (current && colorChanged(current.color, color)) write({ ...current, color })
                  }}
                />
              </label>
              <label className="ctb-pop-row">
                <span>{tc('outlineWidth')}</span>
                <NumberField
                  variant="bare"
                  label={tc('outlineWidth')}
                  value={stroke.widthPx}
                  format={(value) => String(Math.round(value * 10) / 10)}
                  onCommit={(value) => {
                    const current = latest()?.style?.stroke
                    if (!current) return
                    const width = outlineWidthOrNull(value)
                    write(width === null ? null : { ...current, widthPx: width })
                  }}
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}
    </span>
  )
}

/** Opacity of a text, shape or image: a slider shown on the canvas while it moves, ONE command when it is released. */
function OpacityControl({ binding, latest, disabled, writeTitle, open, onOpen }: PopoverProps) {
  const tc = useTranslations('Spark.editor.stage.ctb')
  const { controller } = binding
  const percent = opacityPercent(latest()?.opacity)
  return (
    <span className="ctb-anchor">
      <button
        type="button"
        className={`ib sm${open || percent < 100 ? ' on' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        title={writeTitle ?? tc('opacityValue', { percent })}
        aria-label={tc('opacity')}
        data-opacity
        onClick={() => onOpen(!open)}
      >
        <StudioIcon name="opacity" />
      </button>
      {open ? (
        <div className="ctb-pop" role="dialog" aria-label={tc('opacity')}>
          <label className="ctb-pop-row">
            <span>{tc('opacity')}</span>
            <span className="pp-row">
              <RangeField
                value={percent}
                min={0}
                max={100}
                label={tc('opacity')}
                disabled={disabled}
                format={(value) => tc('opacityValue', { percent: value })}
                onPreview={(value) => controller.previewOpacity(value === null ? null : opacityOfPercent(value))}
                onCommit={(value) => void controller.setLayerOpacity(opacityOfPercent(value))}
              />
            </span>
          </label>
        </div>
      ) : null}
    </span>
  )
}

function ShapeControls({ binding, latest, disabled, writeTitle }: { binding: SparkStageBinding; latest: LatestView; disabled: boolean; writeTitle?: string }) {
  const t = useTranslations('Spark.editor.stage')
  const { controller, schema } = binding
  const view = latest()
  if (!view) return null
  const controls = controlSet(schema, view)
  return (
    <>
      {controls.fill ? (
        <span className="swatch-input" title={writeTitle ?? t('toolbox.fill')}>
          <span className="swatch" style={{ background: colorInputValue(view.fill) }} />
          <ColorInput
            value={colorInputValue(view.fill)}
            label={t('toolbox.fill')}
            disabled={disabled}
            onPreview={(color) => controller.previewColor('fill', color)}
            onCommit={(color) => {
              if (colorChanged(latest()?.fill, color)) void controller.setShapeFill(color)
              else controller.previewColor('fill', null)
            }}
          />
        </span>
      ) : null}
      {controls.cornerRadius ? (
        <label className="ctb-num" title={writeTitle ?? t('inspector.cornerRadius')}>
          <StudioIcon name="corner" className="sm" />
          <NumberField
            variant="bare"
            label={t('inspector.cornerRadius')}
            value={view.cornerRadiusPx ?? 0}
            format={(value) => String(Math.round(value))}
            disabled={disabled}
            onCommit={(value) => void controller.setShapeCornerRadius(value <= 0 ? null : value)}
          />
        </label>
      ) : null}
    </>
  )
}

function MediaControls({
  binding,
  latest,
  kind,
  disabled,
  writeTitle,
  replacing,
  onReplace,
}: {
  binding: SparkStageBinding
  latest: LatestView
  kind: 'image' | 'video'
  disabled: boolean
  writeTitle?: string
  replacing: boolean
  onReplace?: () => void
}) {
  const t = useTranslations('Spark.editor.stage')
  const tc = useTranslations('Spark.editor.stage.ctb')
  const { controller, schema } = binding
  const view = latest()
  if (!view) return null
  const controls = controlSet(schema, view)
  const fit = controller.selectedMediaFit()
  return (
    <>
      {controls.position ? (
        <span className="iseg ctb-fit" role="group" aria-label={tc('fit.label')}>
          <button
            type="button"
            className={fit === 'cover' ? 'on' : undefined}
            aria-pressed={fit === 'cover'}
            disabled={disabled}
            title={writeTitle ?? tc('fit.coverHint')}
            onClick={() => void controller.fitSelected('cover')}
          >
            <StudioIcon name="fit-cover" className="sm" />
            {tc('fit.cover')}
          </button>
          <button
            type="button"
            className={fit === 'contain' ? 'on' : undefined}
            aria-pressed={fit === 'contain'}
            disabled={disabled}
            title={writeTitle ?? tc('fit.containHint')}
            onClick={() => void controller.fitSelected('contain')}
          >
            <StudioIcon name="fit-contain" className="sm" />
            {tc('fit.contain')}
          </button>
        </span>
      ) : null}
      {onReplace ? (
        <button
          type="button"
          className={`dd${replacing ? ' on' : ''}`}
          aria-pressed={replacing}
          disabled={disabled}
          title={writeTitle ?? tc(kind === 'video' ? 'replaceVideoHint' : 'replaceImageHint')}
          onClick={() => {
            if (replacing) {
              controller.cancelReplace()
              return
            }
            if (controller.armReplace()) onReplace()
          }}
        >
          <StudioIcon name="refresh" className="sm" />
          {tc('replace')}
        </button>
      ) : null}
      {kind === 'video' && controls.mute ? (
        <button
          type="button"
          className={`ib sm${view.audio?.muted ? ' on' : ''}`}
          aria-pressed={view.audio?.muted === true}
          disabled={disabled}
          title={writeTitle ?? (view.audio?.muted ? t('toolbox.unmute') : t('toolbox.mute'))}
          aria-label={view.audio?.muted ? t('toolbox.unmute') : t('toolbox.mute')}
          onClick={() => void controller.setClipAudio({ muted: view.audio?.muted !== true })}
        >
          <StudioIcon name={view.audio?.muted ? 'mute' : 'music'} />
        </button>
      ) : null}
    </>
  )
}

function MotionControls({
  binding,
  composition,
  view,
  sceneId,
  canWrite,
  writeTitle,
}: {
  binding: SparkStageBinding
  composition: SparkCompositionState
  view: MotionLayerView
  sceneId: string
  canWrite: boolean
  writeTitle?: string
}) {
  const tm = useTranslations('Spark.editor.motionProps')
  const { controller, schema } = binding
  const state = useStageState(binding)
  const controls = motionControlSet(schema, view.v2)
  const exposure = useMotionExposure(view, loadMotionExposureShared)
  const document = composition.workingCopy?.document ?? null
  const plan = state.presenter.plan
  const fps = plan ? plan.canvas.fps.num / plan.canvas.fps.den : 30
  const sceneFrames = plan?.scenes.find((scene) => scene.sceneId === sceneId)?.durationFrames ?? 0
  const duration =
    exposure.status === 'ready' && document && controls.duration
      ? (motionParameterFields({ parameters: exposure.exposure.parameters, view, document, sceneFrames }).find((field) => field.kind === 'duration') as MotionDurationField | undefined)
      : undefined
  return (
    <>
      {controls.look && document ? (
        <span className="ctb-motion">
          <SparkMotionControls
            projectId={document.project_id}
            layerId={view.layerId}
            layerRev={view.rev}
            canWrite={canWrite}
            readOnly={composition.readOnly}
            apply={(specs) => controller.applyMotionEdit([...specs])}
          />
        </span>
      ) : null}
      {duration ? (
        <label className="ctb-num" title={writeTitle ?? tm('length')}>
          <StudioIcon name="clock" className="sm" />
          <NumberField
            variant="bare"
            label={tm('length')}
            value={duration.frames / fps}
            format={(value) => String(Math.round(value * 10) / 10)}
            disabled={!canWrite || duration.maxFrames < duration.minFrames}
            onCommit={(seconds) => {
              const result = durationEdit(duration, seconds, fps)
              if (result.ok) void controller.applyMotionEdit([motionParameterSetSpec({ layerId: view.layerId, instanceId: view.instanceId, parameterId: duration.id, value: result.value })])
            }}
          />
        </label>
      ) : null}
    </>
  )
}

/**
 * The toolbar's animation quick picker: the In and Out presets of the layer (the presets the inspector schema lists for its
 * kind), each change ONE command through the same planner as the Animations panel (`applyAnimationSlot`). Length, direction,
 * Combo and Effect stay in Properties.
 */
function AnimationQuickPicker({
  binding,
  composition,
  sceneId,
  layerId,
  canWrite,
  writeTitle,
}: {
  binding: SparkStageBinding
  composition: SparkCompositionState
  sceneId: string
  layerId: string
  canWrite: boolean
  writeTitle?: string
}) {
  const t = useTranslations('Spark.editor.effects.animations')
  const tc = useTranslations('Spark.editor.stage.ctb')
  const document = composition.workingCopy?.document ?? null
  const target = animationTarget(document, sceneId, layerId)
  const [outcome, setOutcome] = React.useState<SlotOutcome | null>(null)
  if (!document || target.status === 'none' || target.status === 'unsupported') return null
  const fps = document.canvas.fps
  const offered = target.status === 'ready' ? offeredPresets(binding.schema, target.kind) : new Set<string>()
  const change = (slot: AnimationSlot, choice: SlotChoice | null) => {
    void applyAnimationSlot({ apply: (specs) => binding.controller.session.apply(specs), document, sceneId, layerId, slot, choice, stage: binding }).then(setOutcome)
  }
  return (
    <div className="ctb-pop" role="dialog" aria-label={tc('animate')} data-animation-quick>
      {target.status === 'video' ? (
        <p className="pp-hint warn" role="note">
          {t('videoNotExported')}
        </p>
      ) : null}
      {QUICK_SLOTS.map((slot) => {
        const stored = target.slots[slot]
        const current = stored ? choiceOf(stored) : null
        // A count up only on a text that is one number (a stored one stays shown).
        const options = ANIMATION_PRESETS.filter(
          (preset) => offered.has(preset.id) && presetFitsSlot(preset, slot) && (target.status !== 'ready' || presetFitsTarget(preset, target.layer) || preset.id === current?.presetId),
        )
        const label = t(`slots.${slot}`)
        return (
          <label key={slot} className="ctb-pop-row" title={writeTitle}>
            <span>{label}</span>
            <select
              aria-label={t('presetFor', { slot: label })}
              value={current?.presetId ?? ''}
              disabled={!canWrite || (target.status === 'video' && !current)}
              onChange={(event) => {
                const next = event.target.value
                change(slot, next ? choiceForPreset(next, slot, fps, current) : null)
              }}
            >
              <option value="">{t('none')}</option>
              {current && !options.some((option) => option.id === current.presetId) ? (
                <option value={current.presetId}>{animationPreset(current.presetId) ? t(`presets.${current.presetId}`) : current.presetId}</option>
              ) : null}
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(`presets.${option.id}`)}
                </option>
              ))}
            </select>
          </label>
        )
      })}
      {outcome === 'no_room' ? (
        <p className="pp-hint warn" role="status">
          {t('noRoom')}
        </p>
      ) : outcome === 'failed' ? (
        <p className="pp-hint warn" role="status">
          {t('failed')}
        </p>
      ) : null}
    </div>
  )
}
