'use client'

import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'

import {
  ANIMATION_DIRECTIONS,
  ANIMATION_PRESETS,
  ANIMATION_SLOTS,
  animationPreset,
  offeredPresets,
  presetFitsSlot,
  presetFitsTarget,
  type AnimationDirection,
  type AnimationSlot,
} from '@/lib/spark/animations/animation-catalog'
import { animationTarget, type AnimationTarget } from '@/lib/spark/animations/animation-target'
import { choiceForPreset, choiceOf, type SlotChoice, type StoredAnimation } from '@/lib/spark/animations/layer-animations'
import type { CompositionDocument } from '@/lib/spark/composition-client'
import { animationRemoveSpec } from '@/lib/spark/composition-typed-edits'

import { StudioIcon } from '../studio-icon'
import { applyAnimationSlot, type SlotOutcome } from '../tools/animation-actions'
import '../tools/effects.css'
import { NumberField } from './stage-fields'
import type { SparkStageBinding } from './use-spark-stage'

/**
 * Spark effects WP2 — the "Animation" section of the selected layer's Properties: In / Out / Combo / Effect, each with its
 * preset, length and (where the preset travels) direction, and a remove button. The animations the AI put on a title
 * (fade in, fade out) show here like any other and can be changed or removed. Every change is ONE command through the
 * stage session (the other slots move so the four never overlap). A video clip's animations are not exported yet: the
 * section says so and only offers to remove them. Behind `SPARK_ANIMATIONS_PANEL_ENABLED`.
 */
export function SparkAnimationSection({
  binding,
  document,
  sceneId,
  layerId,
  canWrite,
  writeTitle,
}: {
  binding: SparkStageBinding
  document: CompositionDocument
  sceneId: string
  layerId: string
  canWrite: boolean
  writeTitle?: string
}) {
  const t = useTranslations('Spark.editor.effects.animations')
  const target = animationTarget(document, sceneId, layerId)
  const [outcome, setOutcome] = React.useState<{ key: string; value: SlotOutcome } | null>(null)
  if (target.status === 'none' || target.status === 'unsupported') return null
  const key = `${sceneId}:${layerId}`
  const apply = (slot: AnimationSlot, choice: SlotChoice | null) => {
    void applyAnimationSlot({ apply: (specs) => binding.controller.session.apply(specs), document, sceneId, layerId, slot, choice, stage: binding }).then((value) =>
      setOutcome({ key, value }),
    )
  }
  const removeExtra = (animation: StoredAnimation) => {
    void binding.controller.session.apply([animationRemoveSpec(sceneId, layerId, animation.animation_id)])
  }
  const shown = outcome && outcome.key === key ? outcome.value : null

  return (
    <section className="pp-sec anim-sec" data-animation-section>
      <div className="pp-label">{t('section')}</div>
      {target.status === 'video' ? (
        <p className="pp-hint warn" role="note" data-video-note>
          {t('videoNotExported')}
        </p>
      ) : null}
      {ANIMATION_SLOTS.map((slot) => (
        <SlotRow key={slot} slot={slot} target={target} binding={binding} document={document} canWrite={canWrite} writeTitle={writeTitle} onChange={apply} />
      ))}
      {target.slots.extra.length > 0 ? (
        <div className="anim-extra">
          <span className="pp-hint">{t('extra', { count: target.slots.extra.length })}</span>
          {target.slots.extra.map((animation) => (
            <button
              key={animation.animation_id}
              type="button"
              className="btn sm"
              disabled={!canWrite}
              title={writeTitle}
              aria-label={t('removeNamed', { name: presetName(t, animation.preset_ref.preset_id) })}
              onClick={() => removeExtra(animation)}
            >
              <StudioIcon name="x" className="sm" />
              {presetName(t, animation.preset_ref.preset_id)}
            </button>
          ))}
        </div>
      ) : null}
      {shown === 'no_room' ? (
        <p className="pp-hint warn" role="status">
          {t('noRoom')}
        </p>
      ) : shown === 'failed' ? (
        <p className="pp-hint warn" role="status">
          {t('failed')}
        </p>
      ) : null}
    </section>
  )
}

/** The preset's name in the UI language; an id this editor does not know is shown as it is stored. */
function presetName(t: (key: string) => string, presetId: string): string {
  return animationPreset(presetId) ? t(`presets.${presetId}`) : presetId
}

function SlotRow({
  slot,
  target,
  binding,
  document,
  canWrite,
  writeTitle,
  onChange,
}: {
  slot: AnimationSlot
  target: Extract<AnimationTarget, { status: 'ready' | 'video' }>
  binding: SparkStageBinding
  document: CompositionDocument
  canWrite: boolean
  writeTitle?: string
  onChange(slot: AnimationSlot, choice: SlotChoice | null): void
}) {
  const t = useTranslations('Spark.editor.effects.animations')
  const locale = useLocale()
  const stored = target.slots[slot]
  const current = stored ? choiceOf(stored) : null
  const fps = document.canvas.fps
  const fpsValue = fps.num / fps.den
  const offered = target.status === 'ready' ? offeredPresets(binding.schema, target.kind) : new Set<string>()
  // A preset that does not fit the layer (a count up on a text that is not one number) is not offered; a stored one stays shown.
  const options = ANIMATION_PRESETS.filter(
    (preset) => offered.has(preset.id) && presetFitsSlot(preset, slot) && (target.status !== 'ready' || presetFitsTarget(preset, target.layer) || preset.id === current?.presetId),
  )
  const preset = current ? animationPreset(current.presetId) : null
  const slotLabel = t(`slots.${slot}`)
  const editable = canWrite && target.status === 'ready'
  const seconds = (frames: number) => Math.round((frames / fpsValue) * 10) / 10

  return (
    <div className="anim-row" data-slot={slot}>
      <span className="anim-slot">{slotLabel}</span>
      <label className="field anim-preset" title={writeTitle}>
        <select
          aria-label={t('presetFor', { slot: slotLabel })}
          value={current?.presetId ?? ''}
          disabled={!canWrite || (target.status === 'video' && !current)}
          onChange={(event) => {
            const next = event.target.value
            onChange(slot, next ? choiceForPreset(next, slot, fps, current) : null)
          }}
        >
          <option value="">{t('none')}</option>
          {current && !options.some((option) => option.id === current.presetId) ? <option value={current.presetId}>{presetName(t, current.presetId)}</option> : null}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {t(`presets.${option.id}`)}
            </option>
          ))}
        </select>
        <StudioIcon name="down" className="sm" />
      </label>
      {current && preset ? (
        <>
          <NumberField
            label={t('lengthFor', { slot: slotLabel })}
            unit={t('seconds')}
            value={seconds(current.durationFrames)}
            format={(value) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}
            disabled={!editable || slot === 'effect'}
            title={slot === 'effect' ? t('effectLength') : writeTitle}
            onCommit={(value) => {
              if (!(value > 0)) return
              const frames = Math.max(1, Math.round(value * fpsValue))
              if (frames !== current.durationFrames) onChange(slot, { ...current, durationFrames: frames })
            }}
          />
          {preset.direction === 'required' ? (
            <label className="field anim-direction" title={writeTitle}>
              <select
                aria-label={t('directionFor', { slot: slotLabel })}
                value={current.direction ?? 'right'}
                disabled={!editable}
                onChange={(event) => onChange(slot, { ...current, direction: event.target.value as AnimationDirection })}
              >
                {ANIMATION_DIRECTIONS.map((direction) => (
                  <option key={direction} value={direction}>
                    {t(`directions.${direction}`)}
                  </option>
                ))}
              </select>
              <StudioIcon name="down" className="sm" />
            </label>
          ) : null}
        </>
      ) : null}
      {stored ? (
        <button type="button" className="ib sm" disabled={!canWrite} title={writeTitle ?? t('removeFor', { slot: slotLabel })} aria-label={t('removeFor', { slot: slotLabel })} onClick={() => onChange(slot, null)}>
          <StudioIcon name="x" className="sm" />
        </button>
      ) : null}
    </div>
  )
}
