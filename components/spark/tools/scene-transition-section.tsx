'use client'

import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'

import { orderedScenes, type CompositionDocument } from '@/lib/spark/composition-client'
import type { SparkCompositionActions } from '@/lib/spark/composition-session'
import { sceneClearTransitionSpec, sceneSetTransitionSpec } from '@/lib/spark/composition-typed-edits'
import { projectHasFootage } from '@/lib/spark/effects/transition-browser'
import {
  TRANSITION_CATALOG,
  TRANSITION_EASINGS,
  TRANSITION_MAX_FRAMES,
  TRANSITION_MIN_FRAMES,
  defaultTransitionFrames,
  offeredTransitionKinds,
  resolvedTransition,
  sceneTransitionOf,
  transitionWindowsOf,
  type SceneTransition,
  type TransitionDirection,
  type TransitionEasing,
  type TransitionKind,
} from '@/lib/spark/scene-transitions'
import type { StagePlanTransition } from '@/lib/spark/stage/stage-types'

import type { SparkStageBinding } from '../stage/use-spark-stage'
import { useStageState } from '../stage/use-stage-state'
import './scene-transition.css'
import type { TimelineScene } from './spark-tool-types'
import { Icon, PanelSection } from './studio-parts'

/** How the controls stand: the preview plan says whether the gateway draws transitions. */
type Availability = 'on' | 'off' | 'loading' | 'needs_preview'

type SectionProps = {
  document: CompositionDocument
  entry: TimelineScene
  canWrite: boolean
  readOnly: boolean
  actions: SparkCompositionActions
}

/**
 * E1-L (D8) scene panel "Transition": the transition INTO this scene from the previous one - a kind of the catalogue, its
 * length and the parameters the kind takes (direction, colour, easing). Every change is one `scene.set_transition` command
 * (one undo step; a typed length or a colour drag coalesces into one); "Cut" clears it. The gateway validates and shortens
 * what a scene cannot give frames for; this panel only shows the document, the rule's result and the reasons the preview
 * plays a boundary as a cut. Live with the stage on and while the gateway draws transitions; otherwise the controls stay
 * disabled with the reason written under them.
 */
export function SceneTransitionSection(props: SectionProps & { stage: SparkStageBinding | null }) {
  const { stage, ...rest } = props
  // Hooks cannot be conditional: with the stage on the plan is read in a child, without it nothing is previewed.
  return stage ? <StagedSection stage={stage} {...rest} /> : <TransitionControls {...rest} availability="needs_preview" planned={null} previewFailed={false} catalog={undefined} />
}

function StagedSection({ stage, ...rest }: SectionProps & { stage: SparkStageBinding }) {
  const { presenter } = useStageState(stage)
  const plan = presenter.plan
  const sceneId = rest.entry.scene.scene_id
  const availability: Availability = !plan ? 'loading' : plan.transitionsEnabled === true ? 'on' : 'off'
  const planned = plan?.transitions?.find((transition) => transition.toSceneId === sceneId) ?? null
  const previewFailed = presenter.issues.some((issue) => issue.code === 'transition_unavailable' && issue.sceneId === sceneId)
  return <TransitionControls {...rest} availability={availability} planned={planned} previewFailed={previewFailed} catalog={plan?.transitionCatalog} />
}

const roundTenth = (value: number) => Math.round(value * 10) / 10

function TransitionControls({
  document,
  entry,
  canWrite,
  readOnly,
  actions,
  availability,
  planned,
  previewFailed,
  catalog,
}: SectionProps & { availability: Availability; planned: StagePlanTransition | null; previewFailed: boolean; catalog: number | undefined }) {
  const t = useTranslations('Spark.editor.transition')
  const tFx = useTranslations('Spark.editor.effects.transitions')
  const locale = useLocale()
  const sceneId = entry.scene.scene_id
  const fps = document.canvas.fps
  const fpsValue = fps.num / fps.den
  const isFirst = orderedScenes(document)[0]?.scene_id === sceneId
  const stored = sceneTransitionOf(entry.scene)
  const resolved = stored ? resolvedTransition(stored) : null
  const window = React.useMemo(() => transitionWindowsOf(document).get(sceneId) ?? null, [document, sceneId])
  const live = availability === 'on' && canWrite && !isFirst
  const readOnlyTitle = readOnly ? t('off') : undefined
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(roundTenth(value))

  // The length being typed; it belongs to the stored length it was typed over, so a change from outside (undo, another scene) drops it.
  const lengthKey = `${sceneId}:${stored?.duration_frames ?? 'cut'}`
  const [typed, setTyped] = React.useState<{ key: string; value: string } | null>(null)
  const draft = typed && typed.key === lengthKey ? typed.value : null
  const setDraft = (value: string | null) => setTyped(value === null ? null : { key: lengthKey, value })
  const shownLength = draft ?? (stored ? String(roundTenth(stored.duration_frames / fpsValue)) : '')

  const write = (next: SceneTransition, coalesce = false): void => {
    void actions.apply([sceneSetTransitionSpec(sceneId, next)], coalesce ? { coalesceKey: `scene:${sceneId}:transition` } : undefined)
  }

  const chooseKind = (kind: TransitionKind | 'cut'): void => {
    if (kind === 'cut') {
      if (stored) void actions.apply([sceneClearTransitionSpec(sceneId)])
      return
    }
    const entryOf = TRANSITION_CATALOG[kind]
    const params: NonNullable<SceneTransition['params']> = {}
    // What still makes sense for the new kind carries over; the rest takes the catalogue's defaults (a kind with its own
    // fixed timing takes no easing).
    if (entryOf.easing && stored?.params?.easing) params.easing = stored.params.easing
    if (entryOf.directions && stored?.params?.direction && (entryOf.directions as readonly string[]).includes(stored.params.direction)) params.direction = stored.params.direction
    if (entryOf.color && stored?.params?.color) params.color = stored.params.color
    write({ kind, duration_frames: stored?.duration_frames ?? defaultTransitionFrames(fps), ...(Object.keys(params).length > 0 && { params }) })
  }

  const commitLength = (): void => {
    if (!stored || draft === null) return
    const seconds = Number(draft.replace(',', '.'))
    setDraft(null)
    if (!Number.isFinite(seconds) || seconds <= 0) return
    const frames = Math.min(TRANSITION_MAX_FRAMES, Math.max(TRANSITION_MIN_FRAMES, Math.round(seconds * fpsValue)))
    if (frames !== stored.duration_frames) write({ ...stored, duration_frames: frames })
  }

  const change = (patch: NonNullable<SceneTransition['params']>, coalesce = false): void => {
    if (stored) write({ ...stored, params: { ...stored.params, ...patch } }, coalesce)
  }

  const directions = stored ? TRANSITION_CATALOG[stored.kind].directions : null
  let note: string | null = null
  if (isFirst) note = t('firstScene')
  else if (availability === 'off') note = t('off')
  else if (availability === 'needs_preview') note = t('needsPreview')
  else if (availability === 'loading') note = t('loading')
  else if (stored && planned?.blend?.previewOnly === 'cut') note = t('previewOnlyCut')
  else if (stored && planned?.blend?.previewOnly === 'refused') note = t('previewOnlyRefused')
  else if (stored && planned?.reason === 'scene_has_video') note = t('videoCut')
  else if (stored && previewFailed) note = t('cannotPreview')
  else if (stored && window?.status === 'unavailable' && window.reason === 'scene_too_short') note = t('tooShort')
  else if (stored && window?.status === 'unavailable' && window.reason === 'scene_length_unresolved') note = t('unresolved')
  else if (stored && window?.status === 'ready' && window.clamped) note = t('shortened', { seconds: number(window.durationFrames / fpsValue) })

  // Spark effects WP1: footage elsewhere in the project still decides what the export does with this transition.
  const footageNote = stored && planned?.reason !== 'scene_has_video' && projectHasFootage(document) ? tFx('footageExport') : null

  return (
    <PanelSection label={t('section')} data={{ 'data-transition-section': sceneId }}>
      <div className="row">
        <label className="field" title={readOnlyTitle}>
          <select
            aria-label={t('kindLabel')}
            value={stored?.kind ?? 'cut'}
            disabled={!live}
            onChange={(event) => chooseKind(event.target.value as TransitionKind | 'cut')}
          >
            <option value="cut">{t('kinds.cut')}</option>
            {offeredTransitionKinds(catalog, stored?.kind ?? null).map((kind) => (
              <option key={kind} value={kind}>
                {t(`kinds.${kind}`)}
              </option>
            ))}
          </select>
          <Icon name="down" size="sm" />
        </label>
        <label className="field" title={readOnlyTitle}>
          <input
            inputMode="decimal"
            aria-label={t('duration')}
            value={shownLength}
            disabled={!live || !stored}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitLength}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              else if (event.key === 'Escape') setDraft(null)
            }}
          />
          <span className="unit">{t('seconds')}</span>
        </label>
      </div>
      {stored && directions ? (
        <div className="row">
          <label className="field">
            <select aria-label={t('direction')} value={resolved?.direction ?? ''} disabled={!live} onChange={(event) => change({ direction: event.target.value as TransitionDirection })}>
              {directions.map((direction) => (
                <option key={direction} value={direction}>
                  {t(`directions.${direction}`)}
                </option>
              ))}
            </select>
            <Icon name="down" size="sm" />
          </label>
        </div>
      ) : null}
      {stored && resolved?.color ? (
        <div className="row">
          <label className="field transition-color">
            <span className="sw" style={{ background: resolved.color }} aria-hidden />
            <input type="color" aria-label={t('color')} value={resolved.color} disabled={!live} onChange={(event) => change({ color: event.target.value }, true)} />
          </label>
        </div>
      ) : null}
      {stored && TRANSITION_CATALOG[stored.kind].easing ? (
        <div className="row">
          <label className="field">
            <select aria-label={t('easing')} value={resolved?.easing ?? 'linear'} disabled={!live} onChange={(event) => change({ easing: event.target.value as TransitionEasing })}>
              {TRANSITION_EASINGS.map((easing) => (
                <option key={easing} value={easing}>
                  {t(`easings.${easing}`)}
                </option>
              ))}
            </select>
            <Icon name="down" size="sm" />
          </label>
        </div>
      ) : null}
      {note ? (
        <p className="transition-note" role="note">
          {note}
        </p>
      ) : null}
      {footageNote ? (
        <p className="transition-note" role="note" data-footage-note>
          {footageNote}
        </p>
      ) : null}
    </PanelSection>
  )
}
