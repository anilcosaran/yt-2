'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { SparkCompositionState } from '@/lib/spark/composition-session'
import { layerViewOf } from '@/lib/spark/stage/document-layers'
import type { StageOverlay } from '@/lib/spark/stage/stage-controller'
import {
  clampFontSize,
  colorChanged,
  colorInputValue,
  controlSet,
  currentFont,
  fontForFamilyChoice,
  nextAlign,
  styleToggle,
  toolboxKind,
  toolboxPlacement,
  type ToolboxKind,
} from '@/lib/spark/stage/toolbox-model'

import { StudioIcon } from '../studio-icon'
import { ColorInput, NumberField } from './stage-fields'
import type { SparkStageBinding } from './use-spark-stage'
import { usePlaybackSnapshot } from './use-stage-state'

/** The design pads the selection frame by 3 px around the element; the toolbox sits against that frame. */
const SEL_PAD = 3
const KIND_ICON: Record<ToolboxKind, string> = { text: 'type', shape: 'shapes', image: 'image', video: 'video' }
const ALIGN_ICON = { start: 'al', center: 'ac', end: 'ar' } as const

/**
 * The contextual floating toolbox (design `.ftb`): above the selection, hidden while dragging (the stage's own
 * `.stage.dragging .ftb` rule) and while the clip plays. Per layer kind it shows only the controls the inspector schema
 * lists for it (text: font, size, bold/italic, align, colour, edit text; shape: fill; video: sound), then "Ask AI" and the
 * "More" menu. Every control is one typed command through the stage controller.
 */
export function StageToolbox({
  binding,
  overlay,
  origin,
  stageRef,
  composition,
  canWrite,
  writeTitle,
  onMenu,
}: {
  binding: SparkStageBinding
  overlay: StageOverlay
  origin: { x: number; y: number }
  stageRef: React.RefObject<HTMLDivElement | null>
  composition: SparkCompositionState
  canWrite: boolean
  writeTitle?: string
  onMenu: (x: number, y: number) => void
}) {
  const t = useTranslations('Spark.editor.stage')
  const { controller, schema } = binding
  const playback = usePlaybackSnapshot(binding)
  const ref = React.useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = React.useState<{ left: number; top: number } | null>(null)

  const sceneId = controller.selection.getSnapshot()?.sceneId ?? null
  const stored = layerViewOf(composition.workingCopy?.document ?? null, sceneId, overlay.layerId)
  // Y1R-EDITOR-3: the toolbox shows and builds on the style already sent; the document catches up after the redraw.
  const latest = () => (stored ? controller.withPendingStyle(stored) : null)
  const view = latest()
  const kind = view ? toolboxKind(view) : null
  const controls = view ? controlSet(schema, view) : null
  const { family, face } = view ? currentFont(schema, view) : { family: null, face: null }

  // Above the selection frame, inside the stage (the design's `positionSel`). Measured after every render: the toolbox's own
  // width changes with its content (schema read, font name, selection kind); the equality guard stops any loop.
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

  if (!view || !kind || !controls || playback.playing) return null

  const disabled = !canWrite
  const bold = styleToggle(family, face, 'bold')
  const italic = styleToggle(family, face, 'italic')
  const align = view.style?.align ?? 'start'
  // Read at the click: a second quick press must build on the first one, not on what was rendered before it.
  const faceTarget = (which: 'bold' | 'italic') => {
    const current = latest()
    const font = current ? currentFont(schema, current) : { family: null, face: null }
    return styleToggle(font.family, font.face, which).target
  }
  const askTitle = writeTitle

  return (
    <div
      className="ftb on"
      ref={ref}
      role="toolbar"
      aria-label={t('toolbox.label')}
      style={{ left: placement?.left ?? 0, top: placement?.top ?? 0, visibility: placement ? 'visible' : 'hidden' }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="tag">
        <StudioIcon name={KIND_ICON[kind]} className="sm" />
        {t(`kinds.${kind}`)}
      </div>
      <div className="fsep" />

      {kind === 'text' ? (
        <>
          {controls.content ? (
            <button type="button" className="ib sm" disabled={disabled} title={writeTitle ?? t('toolbox.editText')} aria-label={t('toolbox.editText')} onClick={() => controller.startTextEdit()}>
              <StudioIcon name="edit" />
            </button>
          ) : null}
          {controls.family && schema ? (
            <select
              className="dd"
              aria-label={t('toolbox.fontFamily')}
              disabled={disabled}
              title={writeTitle}
              value={family?.family ?? ''}
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
          {controls.size && view.style ? (
            <NumberField
              variant="bare"
              label={t('toolbox.fontSize')}
              value={view.style.sizePx}
              format={(value) => String(Math.round(value))}
              disabled={disabled}
              title={writeTitle}
              onCommit={(value) => void controller.setTextStyle({ sizePx: clampFontSize(value) })}
            />
          ) : null}
          {controls.weight && (bold.target || italic.target || bold.on || italic.on) ? <div className="fsep" /> : null}
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
          {controls.color && view.style ? (
            <span className="swatch-input" title={writeTitle ?? t('toolbox.color')}>
              <span className="swatch" style={{ background: colorInputValue(view.style.color) }} />
              <ColorInput
                value={colorInputValue(view.style.color)}
                label={t('toolbox.color')}
                disabled={disabled}
                onCommit={(color) => {
                  if (view.style && colorChanged(view.style.color, color)) void controller.setTextStyle({ color })
                }}
              />
            </span>
          ) : null}
        </>
      ) : null}

      {kind === 'shape' && controls.fill ? (
        <span className="swatch-input" title={writeTitle ?? t('toolbox.fill')}>
          <span className="swatch" style={{ background: colorInputValue(view.fill) }} />
          <ColorInput
            value={colorInputValue(view.fill)}
            label={t('toolbox.fill')}
            disabled={disabled}
            onCommit={(color) => {
              if (colorChanged(view.fill, color)) void controller.setShapeFill(color)
            }}
          />
        </span>
      ) : null}

      {kind === 'video' && controls.mute ? (
        <button
          type="button"
          className={`dd${view.audio?.muted ? ' on' : ''}`}
          aria-pressed={view.audio?.muted === true}
          disabled={disabled}
          title={writeTitle}
          onClick={() => void controller.setClipAudio({ muted: view.audio?.muted !== true })}
        >
          {view.audio?.muted ? t('toolbox.unmute') : t('toolbox.mute')}
        </button>
      ) : null}

      <div className="fsep" />
      <button type="button" className="ask" disabled={disabled} title={askTitle} aria-keyshortcuts="Control+K" onClick={() => controller.askAi()}>
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
