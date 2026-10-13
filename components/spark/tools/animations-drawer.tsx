'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import {
  ANIMATION_PRESETS,
  ANIMATION_SLOTS,
  animationPreset,
  offeredPresets,
  presetFitsSlot,
  presetFitsTarget,
  slotPhase,
  type AnimatableKind,
  type AnimationSlot,
} from '@/lib/spark/animations/animation-catalog'
import { animationTarget } from '@/lib/spark/animations/animation-target'
import { choiceForPreset, choiceOf } from '@/lib/spark/animations/layer-animations'
import { singleLayerId } from '@/lib/spark/stage/stage-selection'

import { useStageSelection } from '../stage/use-stage-state'
import type { SparkStageBinding } from '../stage/use-spark-stage'
import { applyAnimationSlot, type SlotOutcome } from './animation-actions'
import { AnimationThumb } from './effect-thumbs'
import './effects.css'
import type { SparkToolContext, SparkToolDrawerProps } from './spark-tool-types'

/**
 * Spark effects WP2 — rail "Animations": the selected layer's In / Out / Combo / Effect as preset cards with animated hover
 * previews (the shared preset recipes sampled in the browser: a sample word, a shape or the sample picture, by the layer's
 * kind; a count up counts a sample number). A click sets the slot (ONE `animation.set` command; the other slots move so they
 * never overlap), "None" removes it; the stage then plays the animated part. Only the presets the gateway's inspector schema
 * lists for the layer's kind are offered, and of them only those that fit the layer (a count up needs a text that is one
 * number). Behind `SPARK_ANIMATIONS_PANEL_ENABLED`.
 */
export function AnimationsToolDrawer({ ctx }: SparkToolDrawerProps) {
  return ctx.stage ? <AnimationsBrowser ctx={ctx} stage={ctx.stage} /> : null
}

const SAMPLE: Record<AnimatableKind, 'text' | 'shape' | 'image'> = { text: 'text', shape: 'shape', clip: 'image' }

function AnimationsBrowser({ ctx, stage }: { ctx: SparkToolContext; stage: SparkStageBinding }) {
  const t = useTranslations('Spark.editor.effects.animations')
  const selection = useStageSelection(stage)
  const layerId = singleLayerId(selection)
  const target = animationTarget(ctx.document, selection?.sceneId ?? null, layerId)
  const [slot, setSlot] = React.useState<AnimationSlot>('in')
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [outcome, setOutcome] = React.useState<{ key: string; value: SlotOutcome } | null>(null)
  const outcomeKey = `${selection?.sceneId ?? ''}:${layerId ?? ''}:${slot}`

  if (target.status === 'none') {
    return (
      <div className="dr-body fx-drawer">
        <p className="fx-note" role="note">
          {t('selectLayer')}
        </p>
      </div>
    )
  }
  if (target.status === 'unsupported') {
    return (
      <div className="dr-body fx-drawer">
        <p className="fx-note" role="note">
          {t('motionLayer')}
        </p>
      </div>
    )
  }

  const document = ctx.document!
  const fps = document.canvas.fps
  const offered = target.status === 'ready' ? offeredPresets(stage.schema, target.kind) : new Set<string>()
  const current = target.slots[slot]
  const currentChoice = current ? choiceOf(current) : null
  const writable = ctx.stageCanWrite
  const run = (choice: ReturnType<typeof choiceForPreset> | null) => {
    void applyAnimationSlot({
      apply: (specs) => ctx.actions.apply(specs),
      document,
      sceneId: target.sceneId,
      layerId: target.layerId,
      slot,
      choice,
      stage,
    }).then((value) => setOutcome({ key: outcomeKey, value }))
  }
  // A preset that does not fit the layer (a count up on a text that is not one number) is not offered; a stored one stays shown.
  const presets = ANIMATION_PRESETS.filter(
    (preset) => offered.has(preset.id) && presetFitsSlot(preset, slot) && (target.status !== 'ready' || presetFitsTarget(preset, target.layer) || preset.id === current?.preset_ref.preset_id),
  )
  const shownOutcome = outcome && outcome.key === outcomeKey ? outcome.value : null

  return (
    <div className="dr-body fx-drawer">
      {target.status === 'video' ? (
        <p className="fx-note warn" role="note" data-video-note>
          {t('videoNotExported')}
        </p>
      ) : null}
      <div className="fx-tabs" role="tablist" aria-label={t('slotsLabel')}>
        {ANIMATION_SLOTS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={slot === candidate}
            className={slot === candidate ? 'on' : undefined}
            onClick={() => setSlot(candidate)}
          >
            {t(`slots.${candidate}`)}
            {target.slots[candidate] ? <span className="dot" aria-hidden /> : null}
          </button>
        ))}
      </div>
      <p className="fx-hint">{t(`slotHints.${slot}`)}</p>
      <div className="fx-grid" role="list" aria-label={t(`slots.${slot}`)}>
        <div role="listitem">
          <button
            type="button"
            className={`fx-card${current ? '' : ' on'}`}
            aria-pressed={!current}
            aria-label={t('none')}
            disabled={!writable || !current}
            data-animation-preset="none"
            onClick={() => run(null)}
          >
            <AnimationThumb presetId={null} phase={slotPhase(slot)} easing="linear" sample={target.status === 'ready' ? SAMPLE[target.kind] : 'image'} active={false} word={t('sampleWord')} />
            <span className="fx-name">{t('none')}</span>
          </button>
        </div>
        {target.status === 'ready'
          ? presets.map((preset) => {
              const on = current?.preset_ref.preset_id === preset.id
              const choice = choiceForPreset(preset.id, slot, fps, currentChoice)
              return (
                <div key={preset.id} role="listitem">
                  <button
                    type="button"
                    className={`fx-card${on ? ' on' : ''}`}
                    aria-pressed={on}
                    aria-label={t('presetLabel', { name: t(`presets.${preset.id}`), slot: t(`slots.${slot}`) })}
                    title={ctx.writeTitle}
                    disabled={!writable}
                    data-animation-preset={preset.id}
                    onClick={() => run(choice)}
                    onMouseEnter={() => setHovered(preset.id)}
                    onMouseLeave={() => setHovered((value) => (value === preset.id ? null : value))}
                    onFocus={() => setHovered(preset.id)}
                    onBlur={() => setHovered((value) => (value === preset.id ? null : value))}
                  >
                    <AnimationThumb
                      presetId={preset.id}
                      phase={slotPhase(slot)}
                      direction={choice.direction}
                      easing={choice.easing}
                      sample={SAMPLE[target.kind]}
                      active={hovered === preset.id}
                      word={preset.id === 'count_up' ? t('sampleNumber') : t('sampleWord')}
                    />
                    <span className="fx-name">{t(`presets.${preset.id}`)}</span>
                  </button>
                </div>
              )
            })
          : null}
      </div>
      {current && !animationPreset(current.preset_ref.preset_id) ? <p className="fx-hint">{t('unknownPreset', { id: current.preset_ref.preset_id })}</p> : null}
      {shownOutcome === 'no_room' ? (
        <p className="fx-note warn" role="status">
          {t('noRoom')}
        </p>
      ) : shownOutcome === 'failed' ? (
        <p className="fx-note warn" role="status">
          {t('failed')}
        </p>
      ) : null}
      <p className="fx-hint">{t('fineTune')}</p>
    </div>
  )
}
