'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { createMotionDraft, newMotionDraftClientRequestId } from '@/lib/motion-editor/api'
import { classifyMotionEditorError } from '@/lib/motion-editor/resource'
import type { CompositionDocument, CompositionOpSpec } from '@/lib/spark/composition-client'
import { layerMoveSpec, motionParameterSetSpec } from '@/lib/spark/composition-typed-edits'
import { loadMotionExposureShared, MotionExposureMismatchError, type MotionExposure } from '@/lib/spark/motion-exposure'
import {
  colorEdit,
  durationEdit,
  framesToSecondsLabel,
  mediaEdit,
  motionParameterFields,
  parameterLabel,
  textEdit,
  type MotionColorField,
  type MotionDurationField,
  type MotionMediaField,
  type MotionTextField,
} from '@/lib/spark/motion-parameter-fields'
import type { MotionLayerView } from '@/lib/spark/motion-layers'
import { motionControlSet } from '@/lib/spark/stage/motion-controls'
import { normaliseRotation, scaleFromPercent } from '@/lib/spark/stage/toolbox-model'
import { sceneLayerViews } from '@/lib/spark/stage/document-layers'
import { colorInputValue } from '@/lib/spark/stage/toolbox-model'
import type { SparkCompositionState } from '@/lib/spark/composition-session'

import { SparkMotionControls } from '../spark-motion-controls'
import { StudioIcon } from '../studio-icon'
import { ColorInput, NumberField } from './stage-fields'
import type { SparkStageBinding } from './use-spark-stage'
import { useStageState } from './use-stage-state'

export type ExposureState = { status: 'loading' } | { status: 'ready'; exposure: MotionExposure } | { status: 'mismatch' } | { status: 'unavailable' }

/** The pinned revision's exposed fields, read once per pin (a changed pin shows the loading state until its own read lands). */
export function useMotionExposure(view: MotionLayerView, load: typeof loadMotionExposureShared): ExposureState {
  const { motionRef } = view
  const key = `${motionRef.motion_id}/${motionRef.motion_revision_id}/${motionRef.manifest_sha256}`
  const [result, setResult] = React.useState<{ key: string; state: ExposureState } | null>(null)
  React.useEffect(() => {
    const controller = new AbortController()
    load(motionRef)
      .then((exposure) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'ready', exposure } })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: error instanceof MotionExposureMismatchError ? 'mismatch' : 'unavailable' } })
      })
    return () => controller.abort()
    // The pin's parts are in the key; `motionRef` itself is a fresh object per document read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load])
  return result?.key === key ? result.state : { status: 'loading' }
}

/**
 * Properties of a selected Motion layer (E1-D, D2): the exposed fields of the pinned Motion (text, image, colour, length) each
 * one `motion.parameter.set`, the energy and pattern controls (`SparkMotionControls`), the start second (`layer.move`), the
 * position (`layer.set_transform`), the order, "Edit structure" (a private draft in the Motion area with the way back to this
 * project) and delete. DRIVEN by the inspector schema like the other kinds: what it does not list is not shown. Every change is
 * ONE command (one undo group) through the stage controller; the gateway validates the value and recompiles the instance before
 * it writes, a refused value shows the editor's "could not be saved" notice and changes nothing.
 */
export function SparkMotionInspector({
  binding,
  composition,
  view,
  sceneId,
  canWrite,
  writeTitle,
  loadExposure = loadMotionExposureShared,
}: {
  binding: SparkStageBinding
  composition: SparkCompositionState
  view: MotionLayerView
  sceneId: string
  canWrite: boolean
  writeTitle?: string
  loadExposure?: typeof loadMotionExposureShared
}) {
  const t = useTranslations('Spark.editor.motionProps')
  const tStage = useTranslations('Spark.editor.stage')
  const tEditor = useTranslations('Spark.editor')
  const { controller, schema } = binding
  const stage = useStageState(binding)
  const document = composition.workingCopy?.document ?? null
  const controls = motionControlSet(schema, view.v2)
  const exposure = useMotionExposure(view, loadExposure)
  const plan = stage.presenter.plan
  const fps = plan ? plan.canvas.fps.num / plan.canvas.fps.den : 30
  const sceneFrames = plan?.scenes.find((scene) => scene.sceneId === sceneId)?.durationFrames ?? 0
  const disabled = !canWrite
  const apply = (specs: CompositionOpSpec[]) => controller.applyMotionEdit(specs)
  const set = (parameterId: string, value: Parameters<typeof motionParameterSetSpec>[0]['value']) =>
    apply([motionParameterSetSpec({ layerId: view.layerId, instanceId: view.instanceId, parameterId, value })])

  const fields = React.useMemo(
    () =>
      exposure.status === 'ready' && document && (controls.parameters || controls.duration)
        ? motionParameterFields({ parameters: exposure.exposure.parameters, view, document, sceneFrames }).filter((field) => (field.kind === 'duration' ? controls.duration : controls.parameters))
        : [],
    [exposure, document, controls.parameters, controls.duration, view, sceneFrames],
  )
  const basis = controller.selectedBasis()
  const order = document ? sceneLayerViews(document, sceneId).map((candidate) => candidate.layerId) : []
  const index = order.indexOf(view.layerId)
  const atTop = index === order.length - 1
  const atBottom = index === 0
  const sceneNumber = document ? document.scene_sequence.scene_ids.indexOf(sceneId) + 1 : 0
  const length = view.range ? view.range.endFrame - view.range.startFrame : 0

  return (
    <>
      <div className="pp-head">
        <span className="ic">
          <StudioIcon name="motion" />
        </span>
        <div>
          <b>{tStage('kinds.motion_instance')}</b>
          <small>{tEditor('sceneName', { n: sceneNumber })}</small>
        </div>
      </div>

      {controls.look && document ? (
        <section className="pp-sec">
          <div className="pp-label">{t('look')}</div>
          <SparkMotionControls
            projectId={document.project_id}
            layerId={view.layerId}
            layerRev={view.rev}
            canWrite={canWrite}
            readOnly={composition.readOnly}
            apply={(specs) => apply([...specs])}
          />
        </section>
      ) : null}

      {controls.parameters || controls.duration ? (
        <section className="pp-sec" data-motion-parameters={exposure.status}>
          <div className="pp-label">{t('parameters')}</div>
          {exposure.status === 'loading' ? (
            <p className="pp-hint" role="status" aria-busy="true">
              {t('loading')}
            </p>
          ) : exposure.status === 'mismatch' || exposure.status === 'unavailable' ? (
            <p className="pp-hint warn" role="status">
              {t(exposure.status)}
            </p>
          ) : fields.length === 0 ? (
            <p className="pp-hint">{t('noFields')}</p>
          ) : (
            fields.map((field) => (
              // A text field is re-keyed by its stored value: a command's result replaces the draft (like the text layer's field).
              <div key={`${field.id}:${field.kind}:${field.kind === 'text' ? field.value : ''}`} className="pp-param" data-parameter={field.id}>
                {field.kind === 'text' ? (
                  <ParameterText field={field} disabled={disabled} title={writeTitle} onCommit={(value) => set(field.id, value)} />
                ) : field.kind === 'color' ? (
                  <ParameterColor field={field} disabled={disabled} title={writeTitle} onCommit={(value) => set(field.id, value)} />
                ) : field.kind === 'media' ? (
                  <ParameterMedia field={field} disabled={disabled} title={writeTitle} onCommit={(value) => set(field.id, value)} />
                ) : (
                  <ParameterDuration field={field} fps={fps} disabled={disabled} title={writeTitle} onCommit={(value) => set(field.id, value)} />
                )}
              </div>
            ))
          )}
        </section>
      ) : null}

      {controls.move && view.range ? (
        <section className="pp-sec">
          <div className="pp-label">{t('timing')}</div>
          <StartField
            startFrame={view.range.startFrame}
            lengthFrames={length}
            sceneFrames={sceneFrames}
            fps={fps}
            disabled={disabled}
            title={writeTitle}
            onCommit={(frame) => apply([layerMoveSpec(sceneId, view.layerId, frame)])}
          />
        </section>
      ) : null}

      {controls.position && basis ? (
        <section className="pp-sec">
          <div className="pp-label">{tStage('inspector.position')}</div>
          <div className="pp-grid">
            <NumberField label={tStage('inspector.x')} unit="X" value={basis.x} format={(value) => String(Math.round(value))} disabled={disabled} title={writeTitle} onCommit={(value) => void controller.setTransformField({ x: Math.round(value) })} />
            <NumberField label={tStage('inspector.y')} unit="Y" value={basis.y} format={(value) => String(Math.round(value))} disabled={disabled} title={writeTitle} onCommit={(value) => void controller.setTransformField({ y: Math.round(value) })} />
            <NumberField label={tStage('inspector.scale')} unit="%" value={basis.scale * 100} format={(value) => String(Math.round(value * 10) / 10)} disabled={disabled} title={writeTitle} onCommit={(value) => void controller.setTransformField({ scale: scaleFromPercent(value) })} />
            <NumberField label={tStage('inspector.rotation')} unit="°" value={basis.rotationDeg} format={(value) => String(Math.round(value * 10) / 10)} disabled={disabled} title={writeTitle} onCommit={(value) => void controller.setTransformField({ rotationDeg: normaliseRotation(value) })} />
          </div>
        </section>
      ) : null}

      {controls.arrange ? (
        <section className="pp-sec">
          <div className="pp-label">{tStage('inspector.order')}</div>
          <div className="pp-actions">
            <button type="button" className="btn sm" disabled={disabled || atTop} title={writeTitle} onClick={() => void controller.arrangeSelected('front')}>
              <StudioIcon name="front" className="sm" />
              {tStage('menu.front')}
            </button>
            <button type="button" className="btn sm" disabled={disabled || atTop} title={writeTitle} onClick={() => void controller.arrangeSelected('forward')}>
              {tStage('menu.forward')}
            </button>
            <button type="button" className="btn sm" disabled={disabled || atBottom} title={writeTitle} onClick={() => void controller.arrangeSelected('backward')}>
              {tStage('menu.backward')}
            </button>
            <button type="button" className="btn sm" disabled={disabled || atBottom} title={writeTitle} onClick={() => void controller.arrangeSelected('back')}>
              <StudioIcon name="back" className="sm" />
              {tStage('menu.back')}
            </button>
          </div>
        </section>
      ) : null}

      <EditStructure projectId={composition.project?.id ?? document?.project_id ?? ''} view={view} disabled={disabled || !view.v2} title={writeTitle} />

      <section className="pp-sec">
        <div className="pp-actions">
          <button type="button" className="btn sm" disabled={disabled} title={writeTitle} onClick={() => controller.askAi()}>
            <StudioIcon name="sparkles" className="sm spark" />
            {tStage('toolbox.askAi')}
          </button>
          {controls.remove ? (
            <button type="button" className="btn sm" disabled={disabled} title={writeTitle} onClick={() => void controller.deleteSelected()}>
              <StudioIcon name="trash" className="sm" />
              {tStage('menu.delete')}
            </button>
          ) : null}
        </div>
      </section>
    </>
  )
}

function ParameterLabel({ id, required }: { id: string; required: boolean }) {
  const t = useTranslations('Spark.editor.motionProps')
  return (
    <div className="pp-label sub">
      {parameterLabel(id)}
      {required ? <span className="sr-only"> ({t('required')})</span> : null}
    </div>
  )
}

/** A text field: a local draft, committed when the field loses focus; Escape restores; empty, unchanged and over-long text is not sent. */
function ParameterText({ field, disabled, title, onCommit }: { field: MotionTextField; disabled: boolean; title?: string; onCommit: (value: string) => void }) {
  const t = useTranslations('Spark.editor.motionProps')
  const [draft, setDraft] = React.useState(field.value)
  const [problem, setProblem] = React.useState<'empty' | 'too_long' | null>(null)
  const skip = React.useRef(false)
  const label = parameterLabel(field.id)

  const commit = () => {
    if (skip.current) {
      skip.current = false
      return
    }
    const result = textEdit(field, draft)
    if (result.ok) {
      setProblem(null)
      onCommit(result.value)
    } else if (result.reason === 'empty' || result.reason === 'too_long') {
      setProblem(result.reason)
      if (result.reason === 'empty') setDraft(field.value)
    } else {
      setProblem(null)
    }
  }

  return (
    <>
      <ParameterLabel id={field.id} required={field.required} />
      <textarea
        className="pp-text"
        rows={2}
        aria-label={label}
        value={draft}
        disabled={disabled}
        title={title}
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value)
          if (problem) setProblem(null)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(field.value)
            setProblem(null)
            if (event.currentTarget.ownerDocument.activeElement === event.currentTarget) {
              skip.current = true
              event.currentTarget.blur()
            }
          } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
      {problem === 'too_long' ? (
        <p className="pp-hint warn" role="alert">
          {t('tooLong', { max: field.maxChars })}
        </p>
      ) : problem === 'empty' ? (
        <p className="pp-hint warn" role="alert">
          {t('textEmpty')}
        </p>
      ) : null}
    </>
  )
}

function ParameterColor({ field, disabled, title, onCommit }: { field: MotionColorField; disabled: boolean; title?: string; onCommit: (value: string | null) => void }) {
  const t = useTranslations('Spark.editor.motionProps')
  const label = parameterLabel(field.id)
  const shown = colorInputValue(field.value ?? undefined)
  return (
    <>
      <ParameterLabel id={field.id} required={field.required} />
      <div className="pp-color">
        <ColorInput
          value={shown}
          label={label}
          disabled={disabled}
          title={title}
          onCommit={(color) => {
            const result = colorEdit(field, color)
            if (result.ok) onCommit(result.value)
          }}
        />
        <span className="pp-hint" style={{ margin: 0 }}>
          {field.value ?? t('colorDefault')}
        </span>
        {field.value !== null && !field.required ? (
          <button type="button" className="btn sm" disabled={disabled} title={title} onClick={() => onCommit(null)}>
            {t('useDefault')}
          </button>
        ) : null}
      </div>
    </>
  )
}

function ParameterMedia({ field, disabled, title, onCommit }: { field: MotionMediaField; disabled: boolean; title?: string; onCommit: (value: { source_id: string }) => void }) {
  const t = useTranslations('Spark.editor.motionProps')
  const label = parameterLabel(field.id)
  const selected = field.value?.sourceId ?? ''
  return (
    <>
      <ParameterLabel id={field.id} required={field.required} />
      {field.options.length === 0 ? (
        <p className="pp-hint">{t('noImages')}</p>
      ) : (
        <label className="field" title={title}>
          <select
            aria-label={label}
            disabled={disabled}
            value={selected}
            onChange={(event) => {
              const result = mediaEdit(field, event.target.value)
              if (result.ok) onCommit(result.value)
            }}
          >
            {selected === '' ? <option value="">{t('chooseImage')}</option> : null}
            {field.options.map((option, position) => (
              <option key={option.sourceId} value={option.sourceId}>
                {t('imageN', { n: position + 1 })}
              </option>
            ))}
          </select>
          <StudioIcon name="down" className="sm" />
        </label>
      )}
    </>
  )
}

function ParameterDuration({ field, fps, disabled, title, onCommit }: { field: MotionDurationField; fps: number; disabled: boolean; title?: string; onCommit: (value: number) => void }) {
  const t = useTranslations('Spark.editor.motionProps')
  const [problem, setProblem] = React.useState(false)
  const label = t('length')
  const range = { min: framesToSecondsLabel(field.minFrames, fps), max: framesToSecondsLabel(Math.max(field.minFrames, field.maxFrames), fps) }
  const roomLeft = field.maxFrames >= field.minFrames
  return (
    <>
      <div className="pp-label sub">{label}</div>
      <NumberField
        label={label}
        unit={t('seconds')}
        value={field.frames / fps}
        format={(value) => String(Math.round(value * 10) / 10)}
        disabled={disabled || !roomLeft}
        title={title}
        onCommit={(seconds) => {
          const result = durationEdit(field, seconds, fps)
          setProblem(!result.ok && result.reason !== 'unchanged')
          if (result.ok) onCommit(result.value)
        }}
      />
      <p className={`pp-hint${problem ? ' warn' : ''}`} role={problem ? 'alert' : undefined}>
        {roomLeft ? t(problem ? 'outOfRange' : 'lengthRange', range) : t('noRoom')}
      </p>
    </>
  )
}

/** Start second of the overlay: whole frames, the overlay keeps its length and must stay inside the scene (refused, never clamped). */
function StartField({
  startFrame,
  lengthFrames,
  sceneFrames,
  fps,
  disabled,
  title,
  onCommit,
}: {
  startFrame: number
  lengthFrames: number
  sceneFrames: number
  fps: number
  disabled: boolean
  title?: string
  onCommit: (frame: number) => void
}) {
  const t = useTranslations('Spark.editor.motionProps')
  const [outside, setOutside] = React.useState(false)
  const latest = Math.max(0, sceneFrames - lengthFrames)
  return (
    <>
      <NumberField
        label={t('start')}
        unit={t('seconds')}
        value={startFrame / fps}
        format={(value) => String(Math.round(value * 10) / 10)}
        disabled={disabled}
        title={title}
        onCommit={(seconds) => {
          const frame = Math.round(seconds * fps)
          const fits = frame >= 0 && frame <= latest
          setOutside(!fits)
          if (fits && frame !== startFrame) onCommit(frame)
        }}
      />
      {outside ? (
        <p className="pp-hint warn" role="alert">
          {t('startOutside', { max: framesToSecondsLabel(latest, fps) })}
        </p>
      ) : null}
    </>
  )
}

/**
 * "Edit structure": the structural edit of a Motion is the Motion area's (a private draft of the pinned revision; the
 * inspector lists `motion.structure` as unavailable with `structural_edit_opens_motion_draft`). The draft remembers this
 * project and layer so the Motion screen offers the way back. One create intent per layer revision: a retry replays it.
 */
function EditStructure({ projectId, view, disabled, title }: { projectId: string; view: MotionLayerView; disabled: boolean; title?: string }) {
  const t = useTranslations('Spark.editor.motionProps')
  const router = useRouter()
  const [state, setState] = React.useState<'idle' | 'opening' | 'failed'>('idle')
  const intent = React.useRef<{ key: string; id: string } | null>(null)

  const open = async () => {
    const key = `${view.layerId}/${view.instanceId}/${view.motionRef.manifest_sha256}`
    if (intent.current?.key !== key) intent.current = { key, id: newMotionDraftClientRequestId() }
    setState('opening')
    try {
      const { draft } = await createMotionDraft({
        source: { motion_id: view.motionRef.motion_id, motion_revision_id: view.motionRef.motion_revision_id, manifest_sha256: view.motionRef.manifest_sha256 },
        returnTo: { projectId, layerId: view.layerId },
        clientRequestId: intent.current.id,
      })
      intent.current = null
      router.push(`/motion/${encodeURIComponent(draft.draft_id)}`)
    } catch (error) {
      setState('failed')
      void classifyMotionEditorError(error)
    }
  }

  return (
    <section className="pp-sec">
      <div className="pp-actions">
        <button type="button" className="btn sm" disabled={disabled || state === 'opening'} aria-busy={state === 'opening' || undefined} title={title ?? t('editStructureHint')} onClick={() => void open()}>
          <StudioIcon name="sliders" className="sm" />
          {state === 'opening' ? t('opening') : t('editStructure')}
        </button>
      </div>
      <p className="pp-hint">{t('editStructureHint')}</p>
      {state === 'failed' ? (
        <p className="pp-hint warn" role="alert">
          {t('openFailed')}
        </p>
      ) : null}
    </section>
  )
}

export type { CompositionDocument }
