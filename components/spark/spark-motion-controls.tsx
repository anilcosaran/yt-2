'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'

import type { CompositionOpSpec } from '@/lib/spark/composition-client'
import {
  getMotionInstanceView,
  motionControlSpec,
  motionPatternOptions,
  type MotionControlChange,
  type MotionEnergy,
  type MotionInstanceView,
} from '@/lib/spark/motion-instance'

import { StudioIcon } from './studio-icon'

export type MotionControlsState =
  | { status: 'loading' }
  | { status: 'ready'; view: MotionInstanceView }
  | { status: 'unavailable' }

/**
 * P06-46 / QA-243 — the Spark scene panel's "Hareket" section body for a document v2 Motion scene: two existing
 * selects (Enerji, Kalıp). The options are the server's read of the instance; each change is one `motion.edit` command
 * (free recompile, one undo). While the read is in flight both selects show a loading state; nothing is guessed.
 */
export function SparkMotionControls({
  projectId,
  layerId,
  layerRev,
  canWrite,
  readOnly,
  apply,
  load = getMotionInstanceView,
}: {
  projectId: string
  layerId: string
  /** Re-reads the controls when the layer changes (after a command the working copy is reloaded). */
  layerRev: number
  canWrite: boolean
  readOnly: boolean
  apply: (specs: readonly CompositionOpSpec[]) => Promise<boolean>
  load?: typeof getMotionInstanceView
}) {
  // The result is keyed by the read it answers: a changed layer shows the loading state until its own read lands.
  const key = `${projectId}/${layerId}/${layerRev}`
  const [result, setResult] = React.useState<{ key: string; state: MotionControlsState } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const state: MotionControlsState = result?.key === key ? result.state : { status: 'loading' }

  React.useEffect(() => {
    const controller = new AbortController()
    load(projectId, layerId, { signal: controller.signal })
      .then((view) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'ready', view } })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, state: { status: 'unavailable' } })
      })
    return () => controller.abort()
  }, [key, projectId, layerId, load])

  const change = (next: MotionControlChange) => {
    if (state.status !== 'ready') return
    const spec = motionControlSpec(state.view, next)
    if (!spec) return
    setBusy(true)
    void apply([spec]).finally(() => setBusy(false))
  }

  return <MotionControlsView state={state} disabled={!canWrite || readOnly || busy} onChange={change} />
}

/** Presentational body (two `.field` selects like the Transition row). */
export function MotionControlsView({
  state,
  disabled,
  onChange,
}: {
  state: MotionControlsState
  disabled: boolean
  onChange: (change: MotionControlChange) => void
}) {
  const t = useTranslations('Spark.editor.motionSection')
  const locale = useLocale()
  const title = (value: { en: string; tr: string }) => (locale === 'tr' ? value.tr : value.en)

  if (state.status !== 'ready' || !state.view.controls) {
    const note = state.status === 'loading' ? t('loading') : t('unavailable')
    return (
      <div className="row" aria-busy={state.status === 'loading'}>
        {(['energy', 'pattern'] as const).map((control) => (
          <label key={control} className="field" title={note}>
            <select disabled aria-label={t(control)} value="">
              <option value="">{note}</option>
            </select>
            <StudioIcon name="down" className="sm" />
          </label>
        ))}
      </div>
    )
  }

  const { controls } = state.view
  return (
    <div className="row">
      <label className="field">
        <select
          aria-label={t('energy')}
          value={controls.energy.value}
          disabled={disabled}
          onChange={(event) => onChange({ kind: 'energy', energy: event.target.value as MotionEnergy })}
        >
          {controls.energy.options.map((energy) => (
            <option key={energy} value={energy}>
              {t(`energies.${energy}`)}
            </option>
          ))}
        </select>
        <StudioIcon name="down" className="sm" />
      </label>
      <label className="field">
        <select
          aria-label={t('pattern')}
          value={controls.pattern.value}
          disabled={disabled || controls.pattern.options.length === 0}
          onChange={(event) => onChange({ kind: 'pattern', blueprint_ref: event.target.value })}
        >
          {motionPatternOptions(state.view).map((option) => (
            <option key={option.blueprint_ref} value={option.blueprint_ref}>
              {title(option.title)}
            </option>
          ))}
        </select>
        <StudioIcon name="down" className="sm" />
      </label>
    </div>
  )
}
