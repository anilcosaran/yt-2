'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { ScriptAutosaveSnapshot } from '@/lib/assistant/script-review/script-autosave'
import { scriptOpKey } from '@/lib/assistant/script-review/script-autosave'
import type {
  ProductionPlanSummary,
  ResearchSource,
  ScreenTreatmentChoice,
  ScriptPatchOp,
  ScriptReviewData,
  ScriptReviewShot,
} from '@/lib/assistant/script-review/script-review-api'
import {
  buildBindingRows,
  buildEstimateBoxModel,
  formatClock,
  formatCredits,
  OPTIONAL_SECTION_ROLES,
  shotModels,
  shotSourceChip,
  shotsByBeat,
  type BindingRow,
  type DisplayScript,
  type EstimateBoxModel,
  type ScreenRow,
} from '@/lib/assistant/script-review/script-review-model'

/**
 * P03-20 Plan view of one job (KARAR 8A, Motion Film §4.5 "tek Plan görünümü"): Summary / Script approach / Avatar,
 * voice and template / Script and scenes / Sources and cost; empty sections are not shown. It is the Spark design's
 * plan page (`.plan`, `.pl-head`, `.specs`, `.pl-sec`, `.shot`, `.kv`, studio.css) used by both hosts: the main Chat
 * right panel and the Spark cover of preview + timeline. There is no approve/produce button here: saving is not
 * approval; the Chat card and a written "tamam, devam et" carry the G1 decision (P03-09/21).
 */

type Translator = (key: string, values?: Record<string, string | number>) => string

/**
 * P04-22 the screens of a Motion Film plan and the one-click "use the real screen". Absent (or no rows): the section is
 * not shown. The click is a command on the exact shot plan revision; the panel keeps no local copy of the decision.
 */
export interface ScreenControls {
  rows: readonly ScreenRow[]
  /** The screen whose choice is being stored (one at a time: each choice is a compare-and-set on the plan revision). */
  pendingAssetId: string | null
  error: 'conflict' | 'failed' | 'unavailable' | null
  onChoose(assetId: string, choice: ScreenTreatmentChoice): void
}

export interface ScriptReviewViewProps {
  data: ScriptReviewData
  /** The script with the local, not yet acknowledged edits applied. */
  display: DisplayScript
  /** Latest owner summary (refreshed after each acknowledged save). */
  summary: ProductionPlanSummary
  save: ScriptAutosaveSnapshot
  closing: boolean
  locale: string
  screens?: ScreenControls
  /** P04-21 the "Yayın paketi" section (it loads and edits the job's package itself); null/absent: not shown. */
  publishSlot?: React.ReactNode
  onEdit(op: ScriptPatchOp): void
  onClose(): void
  onRetry(): void
  onConflictApply(): void
  onConflictDiscard(): void
}

const EDITABLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  border: 0,
  background: 'transparent',
  resize: 'none',
  font: 'inherit',
  color: 'inherit',
  fieldSizing: 'content',
  minHeight: '1.5em',
} as React.CSSProperties

export function ScriptReviewView(props: ScriptReviewViewProps) {
  const { data, display, summary, save, closing, onEdit, onClose } = props
  const t = useTranslations('Chat') as unknown as Translator
  const idPrefix = React.useId().replace(/:/g, '')
  const script = data.script!
  const header = display.header
  const shots = data.shotPlan?.shots ?? null
  const byBeat = React.useMemo(() => shotsByBeat(shots), [shots])
  const estimate = buildEstimateBoxModel(summary, shots)
  const bindings = buildBindingRows(data.plan?.header ?? null)
  const models = shotModels(shots)
  const enabledChapters = display.chapters.filter((chapter) => chapter.enabled)
  const voice = bindings.find((row) => row.role === 'voice') ?? null
  const planRevision = summary.plan.artifact_ref?.artifact_revision ?? null
  const invalid = (op: ScriptPatchOp) => save.invalidKeys.has(scriptOpKey(op))
  const jump = (sectionId: string) => {
    if (typeof document === 'undefined') return
    document.getElementById(sectionId)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const beatNumbers = new Map(display.chapters.flatMap((chapter) => chapter.beats).map((beat, index) => [beat.beat_id, index + 1]))
  return (
    <div
      className="plan"
      role="dialog"
      aria-modal={false}
      aria-label={t('scriptReview.panelLabel', { title: header.title || t('scriptReview.untitled') })}
      data-script-review-save={save.status}
    >
      <header className="pl-head">
        <div className="pl-tb">
          <div className="pl-trow">
            <input
              className="pl-title"
              value={header.title}
              maxLength={200}
              aria-label={t('scriptReview.fields.title')}
              aria-invalid={invalid({ op: 'set_title', title: '' }) || undefined}
              onChange={(event) => onEdit({ op: 'set_title', title: event.target.value })}
            />
            <span className="vpill">
              <i className={`sdot ${readinessDot(summary)}`} />
              {versionLabel(t, script.revision, planRevision, summary)}
            </span>
            <SaveStatus t={t} status={save.status} closing={closing} />
          </div>
        </div>
        <div className="pl-actions">
          {save.status === 'failed' ? (
            <button type="button" className="btn sm" onClick={props.onRetry}>{t('scriptReview.save.retry')}</button>
          ) : null}
          <button type="button" className="ib sm" title={t('scriptReview.closeHint')} aria-label={t('scriptReview.close')} disabled={closing} onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
      </header>

      <div className="pl-bodyw">
        <div className="pl-main">
          <div className="pl-wrap">
            <div className="specs">
              <div className="spec-r1">
                {data.brief ? <span className="spec" title={t('scriptReview.specs.ratio')}><Icon name="monitor" />{data.brief.aspect_ratio}</span> : null}
                <span className="spec" title={t('scriptReview.specs.language')}><Icon name="globe" />{header.language}</span>
                {voice ? (
                  <span className="spec" title={t('scriptReview.bindings.roles.voice')}>
                    <Icon name="mic" />
                    {bindingValue(t, voice)}
                  </span>
                ) : null}
                {models.length > 0 ? <span className="spec" title={t('scriptReview.specs.models')}><Icon name="video" />{models.join(', ')}</span> : null}
                <span className="spec cost" title={t('scriptReview.estimate.title')}>{estimateHeadline(t, estimate)}</span>
              </div>
              <div className="spec-r2">
                <div className="spec-pace">
                  {enabledChapters.map((chapter) => (
                    <button
                      key={chapter.chapter_id}
                      type="button"
                      style={{ flex: `${Math.max(chapter.estimated_seconds, 0.001)} 1 0` }}
                      title={`${chapter.title} · ${formatClock(chapter.estimated_seconds) ?? ''}`}
                      onClick={() => jump(`${idPrefix}-${chapter.chapter_id}`)}
                    >
                      <i />
                      <span>{chapter.title}</span>
                    </button>
                  ))}
                </div>
                <span className="spec ro">
                  <Icon name="clock" />
                  {durationLabel(t, summary.counts.planned_seconds ?? header.totals.estimated_seconds, summary.counts.target_seconds)}
                  {summary.counts.shots_total !== null ? (
                    <>
                      <span className="muted">·</span>
                      {t('scriptReview.specs.shots', { count: summary.counts.shots_total })}
                    </>
                  ) : null}
                </span>
              </div>
            </div>

            {save.status === 'conflict' ? (
              <div className="oldv" role="alert">
                <Icon name="history" size="sm" />
                <span style={{ flex: 1 }}>
                  <b>{t('scriptReview.conflict.title')}</b> {t('scriptReview.conflict.body')}
                </span>
                <button type="button" className="btn sm" onClick={props.onConflictDiscard}>{t('scriptReview.conflict.discard')}</button>
                <button type="button" className="btn primary sm" onClick={props.onConflictApply}>{t('scriptReview.conflict.apply')}</button>
              </div>
            ) : null}
            {script.header.result_kind === 'outline' ? (
              <div className="oldv"><Icon name="file" size="sm" /><span>{t('scriptReview.outline')}</span></div>
            ) : null}

            <section className="pl-sec" id={`${idPrefix}-summary`}>
              <h3><Icon name="file" />{t('scriptReview.sections.summary')}</h3>
              <div className="pl-card ov">
                <textarea
                  className="summary ed"
                  style={EDITABLE}
                  rows={2}
                  maxLength={1000}
                  value={header.angle}
                  aria-label={t('scriptReview.fields.angle')}
                  onChange={(event) => onEdit({ op: 'set_text_field', field: 'angle', value: event.target.value })}
                />
              </div>
            </section>

            <section className="pl-sec" id={`${idPrefix}-approach`}>
              <h3><Icon name="sparkles" />{t('scriptReview.sections.approach')}</h3>
              <div className="pl-card strat2">
                <StrategyField label={t('scriptReview.fields.purpose')} value={header.purpose} maxLength={1000} onChange={(value) => onEdit({ op: 'set_text_field', field: 'purpose', value })} />
                <StrategyField label={t('scriptReview.fields.keyMessage')} value={header.key_message} maxLength={1000} onChange={(value) => onEdit({ op: 'set_text_field', field: 'key_message', value })} />
                <div className="sf2">
                  <div className="sf2-l">{t('scriptReview.fields.hook')}</div>
                  {header.hook.options.length > 1 ? (
                    <div className="stags" style={{ marginTop: 0, marginBottom: 6 }}>
                      {header.hook.options.map((option, index) => (
                        <button
                          key={option.hook_id}
                          type="button"
                          className="stag"
                          aria-pressed={option.hook_id === header.hook.selected_hook_id}
                          style={option.hook_id === header.hook.selected_hook_id ? { borderColor: 'var(--st-accent-border)', color: 'var(--st-text)' } : undefined}
                          onClick={() => onEdit({ op: 'select_hook', hook_id: option.hook_id })}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {header.hook.options.filter((option) => option.hook_id === header.hook.selected_hook_id).map((option) => (
                    <textarea
                      key={option.hook_id}
                      className="v ed"
                      style={EDITABLE}
                      rows={1}
                      maxLength={1000}
                      value={option.text}
                      aria-label={t('scriptReview.fields.hook')}
                      onChange={(event) => onEdit({ op: 'set_hook_text', hook_id: option.hook_id, text: event.target.value })}
                    />
                  ))}
                </div>
                <StrategyField label={t('scriptReview.fields.narrativeFlow')} value={header.narrative_flow} maxLength={2000} onChange={(value) => onEdit({ op: 'set_text_field', field: 'narrative_flow', value })} />
                {data.brief ? (
                  <div className="sf2">
                    <div className="sf2-l">{t('scriptReview.fields.audience')}</div>
                    <div className="v">{data.brief.audience}</div>
                  </div>
                ) : null}
              </div>
            </section>

            {bindings.length > 0 ? (
              <section className="pl-sec" id={`${idPrefix}-resources`}>
                <h3><Icon name="user" />{t('scriptReview.sections.resources')}</h3>
                <div className="pl-card" style={{ overflow: 'hidden' }}>
                  {bindings.map((row) => (
                    <div key={row.role} className="voice-row">
                      <span className="sic"><Icon name={row.role === 'voice' ? 'mic' : row.role === 'avatar' ? 'user' : 'file'} size="sm" /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <b>{t(`scriptReview.bindings.roles.${row.role}`)}</b>
                          {row.source ? <span className="tagc">{t(`scriptReview.bindings.source.${row.source}`)}</span> : null}
                        </div>
                        <small className="muted">
                          {bindingValue(t, row)}
                          {row.shotOverrides > 0 ? ` · ${t('scriptReview.bindings.overrides', { count: row.shotOverrides })}` : ''}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="pl-sec" id={`${idPrefix}-script`}>
              <h3>
                <Icon name="scenes" />
                {t('scriptReview.sections.script')}
                <span className="r muted" style={{ fontWeight: 500, fontSize: 12 }}>
                  {formatClock(header.totals.estimated_seconds)}
                </span>
              </h3>
              {data.shotPlan?.stale ? <div className="oldv" style={{ marginBottom: 10 }}><Icon name="history" size="sm" /><span>{t('scriptReview.shot.stale')}</span></div> : null}
              {display.chapters.map((chapter) => {
                const optional = OPTIONAL_SECTION_ROLES.has(chapter.section_role)
                return (
                  <div key={chapter.chapter_id} style={chapter.enabled ? undefined : { opacity: 0.55 }}>
                    <div className="sec-h" id={`${idPrefix}-${chapter.chapter_id}`}>
                      <span className="dot" />
                      <input
                        className="ed"
                        style={{ ...EDITABLE, width: 'auto', flex: '0 1 auto', fontWeight: 600 }}
                        value={chapter.title}
                        maxLength={200}
                        aria-label={t('scriptReview.fields.chapterTitle')}
                        onChange={(event) => onEdit({ op: 'set_chapter_title', chapter_id: chapter.chapter_id, title: event.target.value })}
                      />
                      <small>
                        {t(`scriptReview.chapter.roles.${chapter.section_role}`)} · {t('scriptReview.chapter.beats', { count: chapter.beats.length, duration: formatClock(chapter.estimated_seconds) ?? '' })}
                      </small>
                      {!chapter.enabled ? <span className="tagc">{t('scriptReview.chapter.disabled')}</span> : null}
                      <span className="grow" />
                      {optional ? (
                        <button
                          type="button"
                          className="btn ghost sm"
                          aria-pressed={!chapter.enabled}
                          onClick={() => onEdit({ op: 'set_chapter_enabled', chapter_id: chapter.chapter_id, enabled: !chapter.enabled })}
                        >
                          {chapter.enabled ? t('scriptReview.chapter.disable') : t('scriptReview.chapter.enable')}
                        </button>
                      ) : null}
                    </div>
                    {chapter.beats.map((beat) => {
                      const beatShots = byBeat.get(beat.beat_id) ?? []
                      const narrationOp: ScriptPatchOp = { op: 'set_beat_narration', beat_id: beat.beat_id, narration: '' }
                      return (
                        <article key={beat.beat_id} className="pl-card shot">
                          <div className="sb"><span className="no">{t('scriptReview.beatNumber', { n: beatNumbers.get(beat.beat_id) ?? 0 })}</span></div>
                          <div style={{ minWidth: 0 }}>
                            <div className="shot-top">
                              <div className="vis">{beatShots.map((shot) => shot.visual_intent).join(' · ') || beat.summary || ''}</div>
                              <span className="durp" title={t('scriptReview.beatSeconds', { value: beat.estimated_seconds })}>
                                <Icon name="clock" size="sm" />
                                {t('scriptReview.beatSeconds', { value: beat.estimated_seconds })}
                              </span>
                            </div>
                            <div className="kv">
                              <label htmlFor={`${idPrefix}-n-${beat.beat_id}`}><Icon name="mic" />{t('scriptReview.fields.narration')}</label>
                              <div className="box">
                                <textarea
                                  id={`${idPrefix}-n-${beat.beat_id}`}
                                  className="ed"
                                  style={EDITABLE}
                                  rows={2}
                                  maxLength={20000}
                                  value={beat.narration}
                                  aria-invalid={invalid(narrationOp) || undefined}
                                  onChange={(event) => onEdit({ op: 'set_beat_narration', beat_id: beat.beat_id, narration: event.target.value })}
                                />
                                {invalid(narrationOp) ? <small className="muted">{t('scriptReview.invalidField')}</small> : null}
                              </div>
                            </div>
                            {beat.on_screen_texts.map((text) => (
                              <div key={text.text_id} className="kv">
                                <label htmlFor={`${idPrefix}-o-${beat.beat_id}-${text.text_id}`}><Icon name="type" />{t('scriptReview.fields.onScreen')}</label>
                                <div className="box ost">
                                  <input
                                    id={`${idPrefix}-o-${beat.beat_id}-${text.text_id}`}
                                    className="ed"
                                    style={EDITABLE}
                                    value={text.text}
                                    maxLength={500}
                                    onChange={(event) => onEdit({ op: 'set_on_screen_text', beat_id: beat.beat_id, text_id: text.text_id, text: event.target.value })}
                                  />
                                </div>
                              </div>
                            ))}
                            {beatShots.length > 0 ? (
                              <div className="stags">
                                {beatShots.map((shot) => (
                                  <React.Fragment key={shot.shot_id}>
                                    <ShotTag t={t} shot={shot} />
                                    <SourceTag t={t} shot={shot} />
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )
              })}
            </section>

            {props.screens && props.screens.rows.length > 0 ? (
              <section className="pl-sec" id={`${idPrefix}-screens`}>
                <h3><Icon name="image" />{t('scriptReview.sections.screens')}</h3>
                {props.screens.error ? (
                  <div className="oldv" role="alert" style={{ marginBottom: 10 }}>
                    <Icon name="history" size="sm" />
                    <span>{t(`scriptReview.screens.errors.${props.screens.error}`)}</span>
                  </div>
                ) : null}
                <div className="pl-card" style={{ overflow: 'hidden' }}>
                  {props.screens.rows.map((row) => (
                    <ScreenRowView
                      key={row.assetId}
                      t={t}
                      row={row}
                      saving={props.screens!.pendingAssetId === row.assetId}
                      locked={props.screens!.pendingAssetId !== null}
                      onChoose={props.screens!.onChoose}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {props.publishSlot}

            <section className="pl-sec" id={`${idPrefix}-sources-cost`}>
              <h3><Icon name="shield" />{t('scriptReview.sections.sourcesCost')}</h3>
              <EstimateCard t={t} estimate={estimate} lineItems={data.plan?.header.estimate.line_items ?? []} />
              {data.research && data.research.sources.length > 0 ? (
                <div className="pl-card" style={{ overflow: 'hidden', marginTop: 12 }}>
                  {data.research.sources.map((source) => (
                    <SourceRow key={source.source_id} t={t} source={source} locale={props.locale} />
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function StrategyField({ label, value, maxLength, onChange }: { label: string; value: string; maxLength: number; onChange(value: string): void }) {
  return (
    <div className="sf2">
      <div className="sf2-l">{label}</div>
      <textarea className="v ed" style={EDITABLE} rows={1} maxLength={maxLength} value={value} aria-label={label} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

/**
 * One screenshot of the plan: the decision (real / simplify / redraw) with its reason, where the film shows it and the
 * one-click answers. Same `voice-row` rows and `tagc` chips as the bindings; nothing here starts production.
 */
function ScreenRowView({ t, row, saving, locked, onChoose }: { t: Translator; row: ScreenRow; saving: boolean; locked: boolean; onChoose(assetId: string, choice: ScreenTreatmentChoice): void }) {
  const details = [
    row.score !== null ? t('scriptReview.screens.score', { total: row.score }) : null,
    row.shownInShots.length > 0
      ? t('scriptReview.screens.shownIn', { shots: row.shownInShots.map((order) => t('scriptReview.shot.label', { order })).join(', ') })
      : t('scriptReview.screens.notShown'),
  ].filter((part): part is string => Boolean(part)).join(' · ')
  return (
    <div className="voice-row" data-screen-asset={row.assetId} data-screen-treatment={row.treatment} data-screen-source={row.source ?? 'none'}>
      <span className="sic"><Icon name="image" size="sm" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>{row.title}</b>
          <span className="tagc" title={t(`scriptReview.screens.explain.${row.treatment}`)}>{t(`scriptReview.screens.treatment.${row.treatment}`)}</span>
          {row.source === 'user' ? <span className="tagc">{t('scriptReview.screens.chosenByYou')}</span> : null}
          {row.unusable ? <span className="tagc">{t('scriptReview.screens.unusable')}</span> : null}
        </div>
        <small className="muted">{details}</small>
        {row.notice ? <div><small className="muted" role="status">{t(`scriptReview.screens.notice.${row.notice}`)}</small></div> : null}
      </div>
      {saving ? (
        <span className="muted" role="status">{t('scriptReview.screens.saving')}</span>
      ) : (
        <>
          {row.actions.followScore ? (
            <button type="button" className="btn ghost sm" disabled={locked} onClick={() => onChoose(row.assetId, 'score')}>{t('scriptReview.screens.followScore')}</button>
          ) : null}
          {row.actions.useReal ? (
            <button type="button" className="btn sm" disabled={locked} onClick={() => onChoose(row.assetId, 'real')}>{t('scriptReview.screens.useReal')}</button>
          ) : null}
        </>
      )}
    </div>
  )
}

function SaveStatus({ t, status, closing }: { t: Translator; status: ScriptAutosaveSnapshot['status']; closing: boolean }) {
  if (closing) return <span className="edited" role="status">{t('scriptReview.save.closing')}</span>
  if (status === 'idle') return <span role="status" />
  return <span className="edited" role="status" aria-live="polite">{t(`scriptReview.save.${status}`)}</span>
}

function ShotTag({ t, shot }: { t: Translator; shot: ScriptReviewShot }) {
  const parts = [
    t('scriptReview.shot.label', { order: shot.order }),
    t(`scriptReview.shot.media.${shot.media_path}`),
    shot.capability ? (shot.capability.model_id ?? shot.capability.node_type) : null,
    t('scriptReview.shot.seconds', { value: shot.planned_seconds }),
    shot.generation_parts && shot.generation_parts > 1 ? t('scriptReview.shot.parts', { count: shot.generation_parts }) : null,
  ].filter((part): part is string => Boolean(part))
  return (
    <span className="stag" title={shot.prompt_detail ?? shot.visual_intent}>
      <Icon name={shot.media_path === 'generate' || shot.media_path === 'avatar' ? 'sparkles' : shot.media_path === 'motion' ? 'motion' : 'image'} />
      {parts.join(' · ')}
    </span>
  )
}

/**
 * P04-19 `Kaynak` chip of one shot: the director's pinned source with its reason (tooltip) and the server's cost
 * (free / credits / not priced yet — never 0 when unknown). Same `stag` chip as the shot tag; read-only here.
 */
function SourceTag({ t, shot }: { t: Translator; shot: ScriptReviewShot }) {
  const chip = shotSourceChip(shot)
  if (!chip) return null
  const cost = chip.cost.kind === 'priced'
    ? t('scriptReview.shot.source.cost.priced', { credits: formatCredits(chip.cost.credits) })
    : t(`scriptReview.shot.source.cost.${chip.cost.kind}`)
  const parts = [
    t('scriptReview.shot.source.label', { source: t(`scriptReview.shot.source.modality.${chip.modality}`) }),
    chip.model,
    cost,
  ].filter((part): part is string => Boolean(part))
  const reason = [
    t(`scriptReview.shot.source.reason.${chip.reason}`),
    chip.fromRule ? t('scriptReview.shot.source.fromRule') : null,
    chip.userResponsibility ? t('scriptReview.shot.source.userResponsibility') : null,
  ].filter((part): part is string => Boolean(part)).join(' ')
  const generated = chip.modality === 'ai_image' || chip.modality === 'ai_video' || chip.modality === 'stock_create'
  return (
    <span className="stag" title={reason} data-source-modality={chip.modality}>
      <Icon name={generated ? 'sparkles' : chip.modality === 'brand_motion' || chip.modality === 'llm_motion' ? 'motion' : 'image'} />
      {parts.join(' · ')}
    </span>
  )
}

function EstimateCard({ t, estimate, lineItems }: { t: Translator; estimate: EstimateBoxModel; lineItems: ReadonlyArray<{ item_id: string; category: string; operation_count: number; credits_min: number; credits_max: number }> }) {
  const counts = estimate.counts
  return (
    <div className="pl-card ov" data-estimate-state={estimate.state}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b>{t('scriptReview.estimate.title')}</b>
        {estimate.range ? <span>{rangeLabel(t, estimate.range)}</span> : null}
        <span className="muted">{t(`scriptReview.estimate.state.${estimate.state}`)}</span>
      </div>
      {counts.shots !== null && counts.newImages !== null && counts.newVideos !== null ? (
        <p className="muted" style={{ marginTop: 6 }}>
          {t('scriptReview.estimate.counts', { shots: counts.shots, images: counts.newImages, videos: counts.newVideos })}
          {counts.generationParts !== null && counts.generationParts > 0 ? ` · ${t('scriptReview.estimate.parts', { count: counts.generationParts })}` : ''}
          {counts.reusedAssets ? ` · ${t('scriptReview.estimate.reused', { count: counts.reusedAssets })}` : ''}
        </p>
      ) : null}
      {estimate.range ? <p className="muted" style={{ marginTop: 4 }}>{t('scriptReview.estimate.disclaimer')}</p> : null}
      {estimate.ceiling !== null || estimate.includesFinalRender !== null ? (
        <p className="muted" style={{ marginTop: 4 }}>
          {[
            estimate.ceiling !== null ? t('scriptReview.estimate.ceiling', { value: formatCredits(estimate.ceiling) }) : null,
            estimate.includesFinalRender === null ? null : estimate.includesFinalRender ? t('scriptReview.estimate.finalRenderIncluded') : t('scriptReview.estimate.finalRenderExcluded'),
          ].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {estimate.range && lineItems.length > 0 ? (
        <details style={{ marginTop: 10 }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>{t('scriptReview.estimate.lineItems')}</summary>
          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
            {lineItems.map((item) => (
              <div key={item.item_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{t(`scriptReview.estimate.categories.${item.category}`)}</span>
                <span className="muted">{t('scriptReview.estimate.lineItem', { operations: item.operation_count, min: formatCredits(item.credits_min), max: formatCredits(item.credits_max) })}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function SourceRow({ t, source, locale }: { t: Translator; source: ResearchSource; locale: string }) {
  const dates = [source.published_at, source.accessed_at].filter((value): value is string => Boolean(value)).map((value) => formatDate(value, locale))
  return (
    <div className="voice-row">
      <span className="sic"><Icon name="file" size="sm" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {source.canonical_url ? (
            <a href={source.canonical_url} target="_blank" rel="noreferrer noopener"><b>{source.title || source.publisher || source.canonical_url}</b></a>
          ) : (
            <b>{source.title || source.publisher || source.source_id}</b>
          )}
          <span className="tagc">{t(`scriptReview.sources.readStatus.${source.read_status}`)}</span>
        </div>
        <small className="muted">{[source.publisher, ...dates].filter(Boolean).join(' · ')}</small>
      </div>
    </div>
  )
}

function bindingValue(t: Translator, row: BindingRow): string {
  if (row.state === 'none') return row.role === 'avatar' ? t('scriptReview.bindings.noAvatar') : t('scriptReview.bindings.state.none')
  const state = t(`scriptReview.bindings.state.${row.state}`)
  return row.source ? `${state} · ${t(`scriptReview.bindings.source.${row.source}`)}` : state
}

function rangeLabel(t: Translator, range: NonNullable<EstimateBoxModel['range']>): string {
  return range.min === range.max
    ? t('scriptReview.estimate.point', { value: formatCredits(range.min) })
    : t('scriptReview.estimate.range', { min: formatCredits(range.min), max: formatCredits(range.max) })
}

function estimateHeadline(t: Translator, estimate: EstimateBoxModel): string {
  return estimate.range ? `${rangeLabel(t, estimate.range)} · ${t(`scriptReview.estimate.state.${estimate.state}`)}` : t(`scriptReview.estimate.state.${estimate.state}`)
}

function durationLabel(t: Translator, planned: number | null, target: number | null): string {
  const plannedText = formatClock(planned)
  const targetText = formatClock(target)
  if (plannedText && targetText) return t('scriptReview.specs.duration', { planned: plannedText, target: targetText })
  if (plannedText) return t('scriptReview.specs.durationPlanned', { planned: plannedText })
  return targetText ? t('scriptReview.specs.durationTarget', { target: targetText }) : ''
}

function readinessDot(summary: ProductionPlanSummary): 'draft' | 'approved' | 'viewing' {
  switch (summary.plan.readiness) {
    case 'ready':
      return 'approved'
    case 'missing':
      return 'viewing'
    default:
      return 'draft'
  }
}

function versionLabel(t: Translator, scriptRevision: number, planRevision: number | null, summary: ProductionPlanSummary): string {
  const parts = [t('scriptReview.scriptRevision', { revision: scriptRevision })]
  if (planRevision !== null) parts.push(t('scriptReview.planRevision', { revision: planRevision }))
  if (summary.plan.readiness !== 'missing') parts.push(t(`scriptReview.readiness.${summary.plan.readiness}`))
  return parts.join(' · ')
}

function formatDate(value: string, locale: string): string {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(time)
}

function Icon({ name, size }: { name: string; size?: 'sm' }) {
  return (
    <svg className={`i${size ? ` ${size}` : ''}`} aria-hidden>
      <use href={`#i-${name}`} />
    </svg>
  )
}
