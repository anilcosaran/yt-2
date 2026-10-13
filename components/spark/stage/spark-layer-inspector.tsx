'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { SparkCompositionState } from '@/lib/spark/composition-session'
import { isPreviewOnlyLayer } from '@/lib/spark/preview-only'
import { motionLayerViewOf } from '@/lib/spark/motion-layers'
import { layerViewOf, sceneLayerViews } from '@/lib/spark/stage/document-layers'
import { singleLayerId } from '@/lib/spark/stage/stage-selection'
import {
  clampFontSize,
  clampGainDb,
  colorChanged,
  colorInputValue,
  controlSet,
  currentFont,
  fontForFamilyChoice,
  normaliseRotation,
  opacityOfPercent,
  opacityPercent,
  scaleFromPercent,
  toolboxKind,
  weightOptionKey,
  type ToolboxKind,
} from '@/lib/spark/stage/toolbox-model'

import { StudioIcon } from '../studio-icon'
import { SparkAnimationSection } from './spark-animation-section'
import { ColorInput, NumberField } from './stage-fields'
import { SparkMotionInspector } from './spark-motion-inspector'
import type { SparkStageBinding } from './use-spark-stage'
import { useStageState } from './use-stage-state'

const KIND_ICON: Record<ToolboxKind, string> = { text: 'type', shape: 'shapes', image: 'image', video: 'video' }
const ALIGNS = [
  { value: 'start', icon: 'al' },
  { value: 'center', icon: 'ac' },
  { value: 'end', icon: 'ar' },
] as const

/**
 * Properties of the selected layer (design `renderProps` with a selection), DRIVEN by the inspector schema: each control
 * is shown only when `composition_inspector_schema_v1` lists it for the layer's kind, so nothing is offered that no typed
 * op can write. Text: content, font, size, colour, alignment; shape: fill; video: sound; every layer: position, scale,
 * rotation (rotation is a numeric field only, V3), order, centre/reset, delete, Ask AI. Every change is ONE command
 * through the stage controller (one undo group). The glyph hint for the text sits under the text controls (V13).
 */
export function SparkLayerInspector({
  binding,
  composition,
  canWrite,
  writeTitle,
  animationsEnabled = false,
}: {
  binding: SparkStageBinding
  composition: SparkCompositionState
  canWrite: boolean
  writeTitle?: string
  /** Spark effects WP2: the "Animation" section (`SPARK_ANIMATIONS_PANEL_ENABLED`). */
  animationsEnabled?: boolean
}) {
  const t = useTranslations('Spark.editor.stage')
  const tEditor = useTranslations('Spark.editor')
  const { controller, schema } = binding
  const state = useStageState(binding)
  const document = composition.workingCopy?.document ?? null
  const selection = state.selection
  const layerId = singleLayerId(selection)
  const view = layerViewOf(document, selection?.sceneId ?? null, layerId ?? '')
  if (!document || !selection || !layerId || !view) return null
  // E1-D: a Motion overlay has its own Properties (the exposed fields of the pinned Motion, its start, order, structure).
  if (view.kind === 'motion_instance') {
    const motion = motionLayerViewOf(document, selection.sceneId, layerId)
    return motion ? <SparkMotionInspector binding={binding} composition={composition} view={motion} sceneId={selection.sceneId} canWrite={canWrite} writeTitle={writeTitle} /> : null
  }
  const kind = toolboxKind(view)
  if (!kind) return null

  const controls = controlSet(schema, view)
  const disabled = !canWrite
  const { family, face } = currentFont(schema, view)
  const basis = controller.selectedBasis()
  const order = sceneLayerViews(document, selection.sceneId).map((candidate) => candidate.layerId)
  const index = order.indexOf(layerId)
  const atTop = index === order.length - 1
  const atBottom = index === 0
  const sceneNumber = document.scene_sequence.scene_ids.indexOf(selection.sceneId) + 1
  const hint = state.textHint && state.textHint.layerId === layerId ? state.textHint : null
  const none = !Object.values(controls).some(Boolean)

  return (
    <>
      <div className="pp-head">
        <span className="ic">
          <StudioIcon name={KIND_ICON[kind]} />
        </span>
        <div>
          <b>{t(`kinds.${kind}`)}</b>
          <small>{tEditor('sceneName', { n: sceneNumber })}</small>
        </div>
        {isPreviewOnlyLayer(view) ? (
          // D1: the export cannot draw video yet; the preview plays it.
          <span className="po-b" title={tEditor('previewOnlyHint')}>
            {tEditor('previewOnly')}
          </span>
        ) : null}
      </div>

      {none ? (
        <section className="pp-sec">
          <p className="pp-hint">{t('inspector.notEditable')}</p>
        </section>
      ) : null}

      {kind === 'text' && controls.content && view.text !== undefined ? (
        <section className="pp-sec">
          <div className="pp-label">{t('inspector.content')}</div>
          <TextContent
            key={`${layerId}:${view.text}`}
            value={view.text}
            disabled={disabled}
            title={writeTitle}
            label={t('inspector.content')}
            onCommit={(text) => controller.setSelectedText(text)}
          />
          {hint ? (
            <p className="pp-hint warn" role="status">
              {t(`inspector.glyph.${hint.status}`, { count: hint.missingCount })}
            </p>
          ) : null}
        </section>
      ) : null}

      {kind === 'text' && (controls.family || controls.weight || controls.size) && schema ? (
        <section className="pp-sec">
          <div className="pp-label">{t('inspector.font')}</div>
          {controls.family ? (
            <label className="field" title={writeTitle}>
              <select
                aria-label={t('toolbox.fontFamily')}
                disabled={disabled}
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
              <StudioIcon name="down" className="sm" />
            </label>
          ) : null}
          <div className="row">
            {controls.weight && family ? (
              <label className="field" title={writeTitle}>
                <select
                  aria-label={t('inspector.weight')}
                  disabled={disabled}
                  value={face?.font.sha256 ?? ''}
                  onChange={(event) => {
                    const next = family.faces.find((candidate) => candidate.font.sha256 === event.target.value)
                    if (next) void controller.setTextStyle({ font: next.font })
                  }}
                >
                  {family.faces.map((candidate) => {
                    const { weight, italic } = weightOptionKey(candidate)
                    return (
                      <option key={candidate.font.sha256} value={candidate.font.sha256}>
                        {t(`inspector.weights.${Math.min(900, Math.max(100, weight))}`)}
                        {italic ? ` ${t('inspector.italic')}` : ''}
                      </option>
                    )
                  })}
                </select>
                <StudioIcon name="down" className="sm" />
              </label>
            ) : null}
            {controls.size && view.style ? (
              <NumberField
                label={t('toolbox.fontSize')}
                unit="px"
                value={view.style.sizePx}
                format={(value) => String(Math.round(value))}
                disabled={disabled}
                title={writeTitle}
                onCommit={(value) => void controller.setTextStyle({ sizePx: clampFontSize(value) })}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {kind === 'text' && (controls.color || controls.align) && view.style ? (
        <section className="pp-sec">
          <div className="pp-label">{t('inspector.style')}</div>
          {controls.color ? (
            <ColorRow
              label={t('toolbox.color')}
              value={view.style.color}
              disabled={disabled}
              title={writeTitle}
              onPreview={(color) => controller.previewColor('text', color)}
              onCommit={(color) => void controller.setTextStyle({ color })}
            />
          ) : null}
          {controls.align ? (
            <div className="iseg" role="group" aria-label={t('inspector.align')}>
              {ALIGNS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={(view.style?.align ?? 'start') === option.value ? 'on' : undefined}
                  aria-pressed={(view.style?.align ?? 'start') === option.value}
                  aria-label={t(`toolbox.align.${option.value}`)}
                  title={writeTitle ?? t(`toolbox.align.${option.value}`)}
                  disabled={disabled}
                  onClick={() => void controller.setTextStyle({ align: option.value })}
                >
                  <StudioIcon name={option.icon} />
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {kind === 'shape' && (controls.fill || controls.cornerRadius) ? (
        <section className="pp-sec">
          <div className="pp-label">{t('inspector.fill')}</div>
          {controls.fill ? (
            <ColorRow
              label={t('toolbox.fill')}
              value={view.fill}
              disabled={disabled}
              title={writeTitle}
              onPreview={(color) => controller.previewColor('fill', color)}
              onCommit={(color) => void controller.setShapeFill(color)}
            />
          ) : null}
          {controls.cornerRadius ? (
            <NumberField
              label={t('inspector.cornerRadius')}
              unit="R"
              value={view.cornerRadiusPx ?? 0}
              format={(value) => String(Math.round(value))}
              disabled={disabled}
              title={writeTitle}
              onCommit={(value) => void controller.setShapeCornerRadius(value <= 0 ? null : value)}
            />
          ) : null}
        </section>
      ) : null}

      {kind === 'video' && (controls.mute || controls.gain) ? (
        <section className="pp-sec">
          <div className="pp-label">{t('inspector.sound')}</div>
          {controls.mute ? (
            <div className="tgl">
              <span>{t('inspector.muted')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={view.audio?.muted === true}
                aria-label={t('inspector.muted')}
                className={`sw-t${view.audio?.muted ? ' on' : ''}`}
                disabled={disabled}
                title={writeTitle}
                onClick={() => void controller.setClipAudio({ muted: view.audio?.muted !== true })}
              />
            </div>
          ) : null}
          {controls.gain ? (
            <NumberField
              label={t('inspector.gain')}
              unit="dB"
              value={view.audio?.gainDb ?? 0}
              format={(value) => String(Math.round(value * 10) / 10)}
              disabled={disabled}
              title={writeTitle}
              onCommit={(value) => void controller.setClipAudio({ gainDb: clampGainDb(value) })}
            />
          ) : null}
        </section>
      ) : null}

      {animationsEnabled ? (
        <SparkAnimationSection binding={binding} document={document} sceneId={selection.sceneId} layerId={layerId} canWrite={canWrite} writeTitle={writeTitle} />
      ) : null}

      {controls.position && basis ? (
        <section className="pp-sec">
          <div className="pp-label">{t('inspector.position')}</div>
          <div className="pp-grid">
            <NumberField
              label={t('inspector.x')}
              unit="X"
              value={basis.x}
              format={(value) => String(Math.round(value))}
              disabled={disabled}
              title={writeTitle}
              onCommit={(value) => void controller.setTransformField({ x: Math.round(value) })}
            />
            <NumberField
              label={t('inspector.y')}
              unit="Y"
              value={basis.y}
              format={(value) => String(Math.round(value))}
              disabled={disabled}
              title={writeTitle}
              onCommit={(value) => void controller.setTransformField({ y: Math.round(value) })}
            />
            {controls.boxSize ? (
              <NumberField
                label={t('inspector.width')}
                unit="W"
                value={basis.width}
                format={(value) => String(Math.round(value))}
                disabled={disabled}
                title={writeTitle}
                onCommit={(value) => void controller.setShapeSize({ widthPx: value })}
              />
            ) : null}
            {controls.boxSize ? (
              <NumberField
                label={t('inspector.height')}
                unit="H"
                value={basis.height}
                format={(value) => String(Math.round(value))}
                disabled={disabled}
                title={writeTitle}
                onCommit={(value) => void controller.setShapeSize({ heightPx: value })}
              />
            ) : null}
            <NumberField
              label={t('inspector.scale')}
              unit="%"
              value={basis.scale * 100}
              format={(value) => String(Math.round(value * 10) / 10)}
              disabled={disabled}
              title={writeTitle}
              onCommit={(value) => void controller.setTransformField({ scale: scaleFromPercent(value) })}
            />
            <NumberField
              label={t('inspector.rotation')}
              unit="°"
              value={basis.rotationDeg}
              format={(value) => String(Math.round(value * 10) / 10)}
              disabled={disabled}
              title={writeTitle}
              onCommit={(value) => void controller.setTransformField({ rotationDeg: normaliseRotation(value) })}
            />
          </div>
          <div className="pp-actions">
            <button type="button" className="btn sm" disabled={disabled} title={writeTitle} onClick={() => void controller.centreSelected()}>
              <StudioIcon name="center-h" className="sm" />
              {t('menu.centre')}
            </button>
            {view.transform ? (
              <button type="button" className="btn sm" disabled={disabled} title={writeTitle} onClick={() => void controller.resetSelected()}>
                <StudioIcon name="refresh" className="sm" />
                {t('menu.reset')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {controls.arrange ? (
        <section className="pp-sec">
          <div className="pp-label">{t('inspector.order')}</div>
          <div className="pp-actions">
            <button type="button" className="btn sm" disabled={disabled || atTop} title={writeTitle} onClick={() => void controller.arrangeSelected('front')}>
              <StudioIcon name="front" className="sm" />
              {t('menu.front')}
            </button>
            <button type="button" className="btn sm" disabled={disabled || atTop} title={writeTitle} onClick={() => void controller.arrangeSelected('forward')}>
              {t('menu.forward')}
            </button>
            <button type="button" className="btn sm" disabled={disabled || atBottom} title={writeTitle} onClick={() => void controller.arrangeSelected('backward')}>
              {t('menu.backward')}
            </button>
            <button type="button" className="btn sm" disabled={disabled || atBottom} title={writeTitle} onClick={() => void controller.arrangeSelected('back')}>
              <StudioIcon name="back" className="sm" />
              {t('menu.back')}
            </button>
          </div>
        </section>
      ) : null}

      {controls.opacity || controls.lock ? (
        // Spark styling round: the layer's opacity and the editor's lock. A locked layer is edited here; the canvas only shows it.
        <section className="pp-sec">
          <div className="pp-label">{t('inspector.layer')}</div>
          {controls.opacity ? (
            <NumberField
              label={t('inspector.opacity')}
              unit="%"
              value={opacityPercent(view.opacity)}
              format={(value) => String(Math.round(value))}
              disabled={disabled}
              title={writeTitle}
              onCommit={(value) => void controller.setLayerOpacity(opacityOfPercent(value))}
            />
          ) : null}
          {controls.lock ? (
            <div className="tgl">
              <span>{t('inspector.locked')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={view.locked === true}
                aria-label={t('inspector.locked')}
                className={`sw-t${view.locked ? ' on' : ''}`}
                disabled={disabled}
                title={writeTitle}
                onClick={() => void controller.setLayerLocked(view.locked !== true)}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="pp-sec">
        <div className="pp-actions">
          <button type="button" className="btn sm" disabled={disabled} title={writeTitle} onClick={() => controller.askAi()}>
            <StudioIcon name="sparkles" className="sm spark" />
            {t('toolbox.askAi')}
          </button>
          {controls.remove ? (
            <button type="button" className="btn sm" disabled={disabled} title={writeTitle} onClick={() => void controller.deleteSelected()}>
              <StudioIcon name="trash" className="sm" />
              {t('menu.delete')}
            </button>
          ) : null}
        </div>
      </section>
    </>
  )
}

/** A colour row: the swatch picker and the stored value as text (design `.field` with `.sw`). */
function ColorRow({
  label,
  value,
  disabled,
  title,
  onCommit,
  onPreview,
}: {
  label: string
  value: string | undefined
  disabled: boolean
  title?: string
  onCommit: (color: string) => void
  /** The colour under the picker shown on the canvas before it is committed (`null`: put the drawn colour back). */
  onPreview?: (color: string | null) => void
}) {
  const shown = colorInputValue(value)
  return (
    <div className="pp-color">
      <ColorInput
        value={shown}
        label={label}
        disabled={disabled}
        title={title}
        onPreview={onPreview}
        onCommit={(color) => {
          // A committed colour keeps its preview until the redraw replaces it; an unchanged one puts the drawn colour back.
          if (colorChanged(value, color)) onCommit(color)
          else onPreview?.(null)
        }}
      />
      <span className="pp-hint" style={{ margin: 0 }}>
        {shown}
      </span>
    </div>
  )
}

/**
 * The text content field: a local draft, committed when the field loses focus (the same commit as the canvas editor), Esc
 * restores. A rejected commit (too long) keeps the draft and says why; empty or unchanged text sends nothing. The parent
 * re-keys the field when the stored text changes, so a command's result replaces the draft.
 */
function TextContent({
  value,
  label,
  disabled,
  title,
  onCommit,
}: {
  value: string
  label: string
  disabled: boolean
  title?: string
  onCommit: (text: string) => Promise<'applied' | 'unchanged' | 'empty' | 'too_long' | 'failed'>
}) {
  const t = useTranslations('Spark.editor.stage')
  const [draft, setDraft] = React.useState(value)
  const [tooLong, setTooLong] = React.useState(false)
  const skip = React.useRef(false)

  const commit = () => {
    if (skip.current) {
      skip.current = false
      return
    }
    if (draft === value) return
    void onCommit(draft).then((result) => {
      setTooLong(result === 'too_long')
      if (result === 'empty') setDraft(value)
    })
  }

  return (
    <>
      <textarea
        className="pp-text"
        aria-label={label}
        value={draft}
        disabled={disabled}
        title={title}
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value)
          if (tooLong) setTooLong(false)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(value)
            setTooLong(false)
            // Leaving the field must not commit the draft that was just thrown away.
            if (event.currentTarget.ownerDocument.activeElement === event.currentTarget) {
              skip.current = true
              event.currentTarget.blur()
            }
          }
        }}
      />
      {tooLong ? (
        <p className="pp-hint warn" role="alert">
          {t('edit.tooLong')}
        </p>
      ) : null}
    </>
  )
}

