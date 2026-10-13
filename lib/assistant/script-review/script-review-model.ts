import type {
  BriefHeader,
  PlanBinding,
  PlanHeader,
  PlanInventoryItem,
  ProductionPlanSummary,
  ScreenTreatment,
  ScriptChapter,
  ScriptHeader,
  ScriptPatchOp,
  ScriptReviewShot,
} from './script-review-api'

/**
 * P03-20 pure view models of the Script panel and the Chat card. Every number comes from the owner projections
 * (P04-15 summary counters, stored ShotPlan and plan estimate); nothing here prices, estimates cost or invents a
 * value: unknown stays unknown (never 0), and an estimate of an older plan is labelled as the previous one (8G).
 */

// ------------------------------------------------------------------------------------------ estimate box

export type EstimateBoxState =
  /** A valid quote for the current plan. */
  | 'current'
  /** The plan (or its quote) is older than the script: shown as the previous estimate until a new one exists. */
  | 'previous'
  | 'computing'
  | 'unavailable'
  /** Script-only job: no production estimate is needed to deliver the script (8D). */
  | 'script_only'
  | 'missing'

export interface EstimateBoxModel {
  state: EstimateBoxState
  range: { min: number; max: number; point: number | null } | null
  ceiling: number | null
  includesFinalRender: boolean | null
  counts: {
    shots: number | null
    newImages: number | null
    newVideos: number | null
    reusedAssets: number | null
    /** Provider parts of the generated shots (a clip-length limit can need several per shot, 8F); null without shots. */
    generationParts: number | null
  }
}

export function buildEstimateBoxModel(summary: ProductionPlanSummary, shots: readonly ScriptReviewShot[] | null = null): EstimateBoxModel {
  const box = summary.estimate_box
  const range = box.min_credits !== undefined && box.max_credits !== undefined
    ? { min: box.min_credits, max: box.max_credits, point: box.point_credits ?? null }
    : null
  const planStale = summary.plan.readiness === 'stale'
  let state: EstimateBoxState
  switch (box.status) {
    case 'valid':
      state = planStale ? 'previous' : 'current'
      break
    case 'stale':
      state = 'previous'
      break
    case 'computing':
      state = 'computing'
      break
    case 'unavailable':
      state = 'unavailable'
      break
    case 'missing':
      state = summary.plan.output_goal === 'script_only' ? 'script_only' : 'missing'
      break
  }
  const counts = summary.counts
  return {
    state,
    range: state === 'current' || state === 'previous' ? range : null,
    ceiling: box.approved_max_credits,
    includesFinalRender: box.includes_final_render,
    counts: {
      shots: counts.shots_total,
      newImages: counts.new_image_outputs,
      newVideos: counts.new_video_outputs,
      reusedAssets: counts.reused_unique_assets,
      generationParts: shots ? generationParts(shots) : null,
    },
  }
}

/** Provider parts of the generated shots (media_path generate/avatar); a shot without a split counts as one. */
export function generationParts(shots: readonly ScriptReviewShot[]): number {
  return shots
    .filter((shot) => shot.media_path === 'generate' || shot.media_path === 'avatar')
    .reduce((total, shot) => total + (shot.generation_parts ?? 1), 0)
}

// --------------------------------------------------------------------------------------------- bindings

export type BindingSourceLabel = 'thisVideo' | 'template' | 'savedPreference' | 'suggested'

export interface BindingRow {
  role: 'avatar' | 'voice' | 'template' | 'intro' | 'outro' | 'kit'
  /** `none` is an explicit choice ("Avatar yok / yalnız seslendirme"); `unset` has no global binding at all. */
  state: 'selected' | 'none' | 'unset'
  source: BindingSourceLabel | null
  /** Shot-level overrides of the same role (8E: a global change never overwrites them). */
  shotOverrides: number
}

const BINDING_ROLES: ReadonlyArray<BindingRow['role']> = ['avatar', 'voice', 'template', 'intro', 'outro', 'kit']

export function bindingSourceLabel(source: PlanBinding['selection_source']): BindingSourceLabel {
  switch (source) {
    case 'explicit':
    case 'job_selection':
      return 'thisVideo'
    case 'template':
      return 'template'
    case 'channel_default':
    case 'personal_default':
      return 'savedPreference'
    case 'product_default':
    case 'product_suggestion':
      return 'suggested'
  }
}

/** Avatar, voice, template, intro/outro and kit as the plan pinned them; roles the plan does not mention are omitted. */
export function buildBindingRows(plan: PlanHeader | null): BindingRow[] {
  if (!plan) return []
  return BINDING_ROLES.flatMap((role) => {
    const bindings = plan.bindings.filter((binding) => binding.role === role)
    if (bindings.length === 0) return []
    const global = bindings.find((binding) => binding.target.scope === 'global') ?? null
    return [{
      role,
      state: global ? (global.resource ? 'selected' : 'none') : 'unset',
      source: global ? bindingSourceLabel(global.selection_source) : null,
      shotOverrides: bindings.filter((binding) => binding.target.scope !== 'global').length,
    }]
  })
}

// ------------------------------------------------------------------------------------------------ shots

/** Shots by the beat they cover (a shot covering several beats is listed under each). */
export function shotsByBeat(shots: readonly ScriptReviewShot[] | null): Map<string, ScriptReviewShot[]> {
  const index = new Map<string, ScriptReviewShot[]>()
  for (const shot of [...(shots ?? [])].sort((left, right) => left.order - right.order)) {
    for (const beatId of shot.beat_ids) {
      const list = index.get(beatId)
      if (list) list.push(shot)
      else index.set(beatId, [shot])
    }
  }
  return index
}

/** Real catalog models named by the shot plan (8F); duplicates collapse, order of first use. */
export function shotModels(shots: readonly ScriptReviewShot[] | null): string[] {
  const models: string[] = []
  for (const shot of shots ?? []) {
    const model = shot.capability?.model_id ?? shot.capability?.node_type
    if (model && !models.includes(model)) models.push(model)
  }
  return models
}

/** P04-19 source modalities the Kaynak chip names; anything else (a newer server) is shown as `other`. */
export const SHOT_SOURCE_MODALITIES = [
  'typed_scene', 'brand_motion', 'own_media', 'youtorch_stock', 'ai_image', 'llm_motion', 'ai_video', 'stock_create', 'omitted', 'none',
] as const
export type ShotSourceModalityKey = (typeof SHOT_SOURCE_MODALITIES)[number] | 'other'
export type ShotSourceReasonKey =
  | 'requested' | 'requestedUnavailable' | 'stockOnlyNoMatch' | 'noSource' | 'stock' | 'ownMedia' | 'brandMotion' | 'typedScene' | 'generated' | 'other'

export interface ShotSourceChip {
  modality: ShotSourceModalityKey
  /** Server price only: free, priced (credits) or not ready yet (never shown as 0). */
  cost: { kind: 'free' } | { kind: 'priced'; credits: number } | { kind: 'not_ready' }
  reason: ShotSourceReasonKey
  model: string | null
  /** The pin follows the user's saved rule (PersonalInstruction/EditStyle/channel default). */
  fromRule: boolean
  /** An explicit photoreal request of a real person/event, produced under the user's responsibility (Q26). */
  userResponsibility: boolean
}

function sourceReasonKey(reason: string): ShotSourceReasonKey {
  if (reason === 'user_requested_route') return 'requested'
  if (reason === 'requested_route_unavailable') return 'requestedUnavailable'
  if (reason === 'stock_only_no_match') return 'stockOnlyNoMatch'
  if (reason === 'no_source') return 'noSource'
  if (reason.startsWith('stock_')) return 'stock'
  if (reason.startsWith('own_media')) return 'ownMedia'
  if (reason.startsWith('brand_motion')) return 'brandMotion'
  if (reason.startsWith('typed_scene')) return 'typedScene'
  if (reason.startsWith('ai_image') || reason.startsWith('ai_video') || reason.startsWith('stock_create')) return 'generated'
  return 'other'
}

/** The plan row's `Kaynak` chip of one shot (null until the director resolved its source). */
export function shotSourceChip(shot: ScriptReviewShot): ShotSourceChip | null {
  const selection = shot.direction?.selection
  if (!selection) return null
  const modality = (SHOT_SOURCE_MODALITIES as readonly string[]).includes(selection.modality) ? selection.modality as ShotSourceModalityKey : 'other'
  const cost: ShotSourceChip['cost'] = selection.cost.status === 'free'
    ? { kind: 'free' }
    : selection.cost.status === 'priced' && typeof selection.cost.credits === 'number'
      ? { kind: 'priced', credits: selection.cost.credits }
      : { kind: 'not_ready' }
  return {
    modality,
    cost,
    reason: sourceReasonKey(selection.reason),
    model: selection.model_id ?? null,
    fromRule: Boolean(selection.rule_ref) && (selection.selection_source === 'personal_default' || selection.selection_source === 'channel_default'),
    userResponsibility: selection.responsibility === 'user',
  }
}

// -------------------------------------------------------------------------------------- local overlay

export interface DisplayScript {
  header: ScriptHeader
  chapters: ScriptChapter[]
}

/**
 * The script as the user sees it: the server revision with the local edits that are not acknowledged yet
 * (pending, sending or in doubt). Derived timing stays the server's until the patch is acknowledged.
 */
export function overlayScript(header: ScriptHeader, chapters: readonly ScriptChapter[], localOp: (key: string) => ScriptPatchOp | undefined): DisplayScript {
  const title = localOp('title')
  const hook = localOp('hook')
  const field = (name: 'angle' | 'purpose' | 'key_message' | 'narrative_flow') => {
    const op = localOp(`field:${name}`)
    return op?.op === 'set_text_field' ? op.value : header[name]
  }
  const nextHeader: ScriptHeader = {
    ...header,
    title: title?.op === 'set_title' ? title.title : header.title,
    angle: field('angle'),
    purpose: field('purpose'),
    key_message: field('key_message'),
    narrative_flow: field('narrative_flow'),
    hook: {
      selected_hook_id: hook?.op === 'select_hook' ? hook.hook_id : header.hook.selected_hook_id,
      options: header.hook.options.map((option) => {
        const op = localOp(`hook_text:${option.hook_id}`)
        return op?.op === 'set_hook_text' ? { ...option, text: op.text } : option
      }),
    },
  }
  const nextChapters = chapters.map((chapter) => {
    const titleOp = localOp(`chapter_title:${chapter.chapter_id}`)
    const enabledOp = localOp(`chapter_enabled:${chapter.chapter_id}`)
    return {
      ...chapter,
      title: titleOp?.op === 'set_chapter_title' ? titleOp.title : chapter.title,
      enabled: enabledOp?.op === 'set_chapter_enabled' ? enabledOp.enabled : chapter.enabled,
      beats: chapter.beats.map((beat) => {
        const narrationOp = localOp(`narration:${beat.beat_id}`)
        return {
          ...beat,
          narration: narrationOp?.op === 'set_beat_narration' ? narrationOp.narration : beat.narration,
          on_screen_texts: beat.on_screen_texts.map((text) => {
            const op = localOp(`on_screen:${beat.beat_id}:${text.text_id}`)
            return op?.op === 'set_on_screen_text' ? { ...text, text: op.text } : text
          }),
        }
      }),
    }
  })
  return { header: nextHeader, chapters: nextChapters }
}

/** Replaces the acknowledged chapters with the server's version (the patch response carries them in full). */
export function mergeSavedChapters(chapters: readonly ScriptChapter[], saved: readonly ScriptChapter[]): ScriptChapter[] {
  const byId = new Map(saved.map((chapter) => [chapter.chapter_id, chapter]))
  return chapters.map((chapter) => byId.get(chapter.chapter_id) ?? chapter)
}

/** An op the panel keeps local: a full script cannot hold an empty narration (the server would refuse it, 422). */
export function isScriptOpInvalid(op: ScriptPatchOp, resultKind: ScriptHeader['result_kind']): boolean {
  switch (op.op) {
    case 'set_beat_narration':
      return resultKind === 'full' && op.narration.trim().length === 0
    case 'set_title':
      return op.title.trim().length === 0
    case 'set_text_field':
      return op.value.trim().length === 0
    case 'set_hook_text':
      return op.text.trim().length === 0
    case 'set_chapter_title':
      return op.title.trim().length === 0
    case 'set_on_screen_text':
      return op.text.trim().length === 0
    default:
      return false
  }
}

export const OPTIONAL_SECTION_ROLES: ReadonlySet<ScriptChapter['section_role']> = new Set(['intro', 'outro', 'cta'])

// ------------------------------------------------------------------------------------------ formatting

/** m:ss (h:mm:ss above an hour); null for unknown. */
export function formatClock(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`
}

export function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

// ------------------------------------------------------------------------------------------- chat card

export type VideoPreparationStatus =
  /** The plan is ready for its G1 card (the G1 card shows the decision). */
  | 'plan_ready'
  /** The script changed after the plan: a new plan/estimate is needed before approval. */
  | 'plan_stale'
  | 'plan_draft'
  | 'plan_not_ready'
  /** Script exists, no plan yet (or a script-only job). */
  | 'script_only'
  | 'script_ready'

export interface VideoPreparationCardModel {
  title: string | null
  status: VideoPreparationStatus
  scriptRevision: number
  planRevision: number | null
  targetSeconds: number | null
  plannedSeconds: number | null
  language: string | null
  aspectRatio: string | null
  chapters: number | null
  shots: number | null
  estimate: EstimateBoxModel
}

export function buildVideoPreparationCardModel(input: {
  summary: ProductionPlanSummary
  scriptHeader: Pick<ScriptHeader, 'title' | 'language'> | null
  brief: Pick<BriefHeader, 'title' | 'aspect_ratio' | 'locale'> | null
}): VideoPreparationCardModel | null {
  const script = input.summary.artifacts.find((artifact) => artifact.artifact_kind === 'script') ?? null
  if (!script) return null
  const plan = input.summary.plan
  const status: VideoPreparationStatus = plan.readiness === 'missing'
    ? (plan.output_goal === 'script_only' ? 'script_only' : 'script_ready')
    : plan.readiness === 'stale'
      ? 'plan_stale'
      : plan.readiness === 'ready' ? 'plan_ready' : plan.readiness === 'draft' ? 'plan_draft' : 'plan_not_ready'
  const counts = input.summary.counts
  return {
    title: input.scriptHeader?.title ?? input.brief?.title ?? null,
    status,
    scriptRevision: script.head_revision,
    planRevision: plan.artifact_ref?.artifact_revision ?? null,
    targetSeconds: counts.target_seconds,
    plannedSeconds: counts.planned_seconds,
    language: input.scriptHeader?.language ?? input.brief?.locale ?? null,
    aspectRatio: input.brief?.aspect_ratio ?? null,
    chapters: counts.chapters_enabled,
    shots: counts.shots_total,
    estimate: buildEstimateBoxModel(input.summary),
  }
}

// ---------------------------------------------------------------------------------------------- screens

/** The score is 0-8 (four criteria of 0-2; KARAR-PREMIUM-MOTION 8.1). */
export const SCREEN_SCORE_MAX = 8

export interface ScreenRow {
  assetId: string
  title: string
  treatment: ScreenTreatment
  /** `user` = the user's own choice, the authority until they change it; `score` = what the score derives; null = never scored. */
  source: 'score' | 'user' | null
  /** The server-written 0-8 total; null for a screen nobody scored (the user's own label). */
  score: number | null
  /** Film order numbers (S1, S2...) of the shots that show this screenshot as pixels. */
  shownInShots: number[]
  /** The plan may not show this screen at all (sensitive or broken). */
  unusable: boolean
  /**
   * `redrawShown`: the plan redraws it but a scene still shows the screenshot; `notShown`: the user chose to show it but
   * no scene does. Both are for the planner's in-place re-plan, which this panel does not start.
   */
  notice: 'redrawShown' | 'notShown' | null
  /** What one click can do: the real screen, and the way back to the score's own decision. */
  actions: { useReal: boolean; followScore: boolean }
}

/** The shots whose media slots name the asset (`asset:<id>`), in film order. */
export function shotsShowingScreen(shots: readonly ScriptReviewShot[] | null, assetId: string): number[] {
  return [...(shots ?? [])]
    .filter((shot) => shot.media_path === 'motion' && motionSlots(shot).some((slot) => slot.kind === 'media' && slot.value === `asset:${assetId}`))
    .map((shot) => shot.order)
    .sort((left, right) => left - right)
}

function motionSlots(shot: ScriptReviewShot): Array<{ kind?: unknown; value?: unknown }> {
  const motion = (shot as { motion?: { shot_spec?: { slots?: unknown } } }).motion
  const slots = motion?.shot_spec?.slots
  return Array.isArray(slots) ? slots.filter((slot): slot is { kind?: unknown; value?: unknown } => typeof slot === 'object' && slot !== null) : []
}

/** The treatment a total derives: 7-8 real, 4-6 simplify, 0-3 redraw (mirrors the server rule; the panel never writes it). */
export function screenTreatmentOfScore(total: number): ScreenTreatment {
  return total >= 7 ? 'real' : total >= 4 ? 'simplify' : 'redraw'
}

/** One row per screenshot of the plan: its decision, why, where it is shown and what a click can do. */
export function buildScreenRows(screens: readonly PlanInventoryItem[], shots: readonly ScriptReviewShot[] | null): ScreenRow[] {
  return screens.map((item) => {
    const score = item.ui_score ? item.ui_score.total : null
    const source: ScreenRow['source'] = item.screen_treatment_source ?? (score === null ? null : 'score')
    const treatment: ScreenTreatment = source === 'user' && item.screen_treatment
      ? item.screen_treatment
      : score !== null ? screenTreatmentOfScore(score) : item.screen_treatment ?? 'real'
    const shownInShots = shotsShowingScreen(shots, item.asset.resource_id)
    const unusable = item.usage === 'do_not_use'
    const notice: ScreenRow['notice'] = treatment === 'redraw' && shownInShots.length > 0
      ? 'redrawShown'
      : source === 'user' && treatment !== 'redraw' && shownInShots.length === 0 && !unusable ? 'notShown' : null
    return {
      assetId: item.asset.resource_id,
      title: item.title,
      treatment,
      source,
      score,
      shownInShots,
      unusable,
      notice,
      actions: { useReal: treatment !== 'real' && !unusable, followScore: source === 'user' && score !== null },
    }
  })
}

/** The rows after the server acknowledged one choice: only that screen changes (the answer is the truth). */
export function applyScreenResult(
  screens: readonly PlanInventoryItem[],
  result: { asset_id: string; treatment: ScreenTreatment; source: 'score' | 'user' },
): PlanInventoryItem[] {
  return screens.map((item) => (item.asset.resource_id === result.asset_id
    ? { ...item, screen_treatment: result.treatment, screen_treatment_source: result.source }
    : item))
}
