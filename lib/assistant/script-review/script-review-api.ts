'use client'

import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P03-20 Script panel client. Everything shown comes from the Composition owner (P04-15 video-preparation v1): the
 * job's package summary, exact-revision body pages of the script head, the shot plan, the plan (bindings and
 * estimate), the brief and the research pack. Opening reads only; it never runs inference, pricing or media. Edits
 * are typed patches on the exact script revision shown (`expected_revision`); nothing is kept in browser storage.
 */

export const SCRIPT_REVIEW_QUERY_KEY = ['composition', 'script-review'] as const
export const PRODUCTION_PLAN_SUMMARY_QUERY_KEY = ['composition', 'production-plan-summary'] as const

const PAGE_LIMIT = 50
/** Upper bound of pages per section (60 chapters, 500 shots, 200 sources, 500 claims fit well inside). */
const MAX_PAGES = 20

const artifactKindSchema = z.enum(['video_brief', 'research_pack', 'script', 'shot_plan', 'production_plan'])
const readinessSchema = z.enum(['draft', 'not_ready', 'ready', 'stale'])

const artifactRefSchema = z.object({
  artifact_kind: artifactKindSchema,
  artifact_id: z.string(),
  artifact_revision: z.number().int(),
  content_digest_sha256: z.string(),
})

const nullableCount = z.number().nullable().catch(null)

export const productionPlanSummarySchema = z.object({
  schema_version: z.literal('production_plan_summary_v1'),
  project_id: z.string(),
  job_id: z.string(),
  plan: z.object({
    artifact_ref: artifactRefSchema.nullable(),
    readiness: z.union([readinessSchema, z.literal('missing')]),
    g1_fingerprint_sha256: z.string().optional(),
    output_goal: z.enum(['final_video', 'preview_only', 'plan_only', 'script_only']).optional(),
  }).passthrough(),
  artifacts: z.array(z.object({
    artifact_kind: artifactKindSchema,
    artifact_id: z.string(),
    head_revision: z.number().int(),
    head_digest_sha256: z.string(),
    head_readiness: z.enum(['draft', 'not_ready', 'ready']),
    pinned_revision: z.number().int().nullable(),
    stale: z.boolean(),
  }).passthrough()),
  counts: z.object({
    target_seconds: nullableCount,
    planned_seconds: nullableCount,
    chapters_total: nullableCount,
    chapters_enabled: nullableCount,
    chapters_with_full_narration: nullableCount,
    beats_total: nullableCount,
    shots_total: nullableCount,
    new_image_outputs: nullableCount,
    new_video_outputs: nullableCount,
    new_audio_outputs: nullableCount,
    reused_unique_assets: nullableCount,
    generated_seconds: nullableCount,
  }).passthrough(),
  estimate_box: z.object({
    status: z.enum(['valid', 'computing', 'stale', 'unavailable', 'missing']),
    estimate_revision: z.number().optional(),
    point_credits: z.number().optional(),
    min_credits: z.number().optional(),
    max_credits: z.number().optional(),
    approved_max_credits: z.number().nullable(),
    includes_final_render: z.boolean().nullable(),
    expires_at: z.string().optional(),
  }).passthrough(),
  issues: z.array(z.object({ code: z.string() }).passthrough()).catch([]),
}).passthrough()

export type ProductionPlanSummary = z.infer<typeof productionPlanSummarySchema>

const beatSchema = z.object({
  beat_id: z.string(),
  narration: z.string(),
  summary: z.string().optional(),
  on_screen_texts: z.array(z.object({ text_id: z.string(), text: z.string(), quoted: z.boolean() })),
  claim_refs: z.array(z.string()),
  estimated_seconds: z.number(),
  word_count: z.number(),
}).passthrough()

export const scriptChapterSchema = z.object({
  chapter_id: z.string(),
  title: z.string(),
  section_role: z.enum(['intro', 'main', 'outro', 'cta']),
  enabled: z.boolean(),
  target_seconds: z.number().optional(),
  estimated_seconds: z.number(),
  beats: z.array(beatSchema),
}).passthrough()

export const scriptHeaderSchema = z.object({
  schema_version: z.literal('script_artifact_v1'),
  result_kind: z.enum(['full', 'outline']),
  title: z.string(),
  language: z.string(),
  angle: z.string(),
  hook: z.object({
    options: z.array(z.object({ hook_id: z.string(), text: z.string() })),
    selected_hook_id: z.string(),
  }),
  purpose: z.string(),
  key_message: z.string(),
  narrative_flow: z.string(),
  totals: z.object({
    estimated_seconds: z.number(),
    word_count: z.number(),
    speech_rate_wpm: z.number(),
    rate_basis: z.enum(['measured', 'assumed']),
  }),
}).passthrough()

export type ScriptBeat = z.infer<typeof beatSchema>
export type ScriptChapter = z.infer<typeof scriptChapterSchema>
export type ScriptHeader = z.infer<typeof scriptHeaderSchema>

const ownerResourceSchema = z.object({
  owner_bc: z.string(),
  resource_kind: z.string(),
  resource_id: z.string(),
  resource_revision: z.string().optional(),
}).passthrough()

const capabilitySchema = z.object({ node_type: z.string(), capability: z.string(), model_id: z.string().optional() }).passthrough()

/**
 * P04-19 (additive): the director's pinned source of a shot — the plan row's `Kaynak` chip. Written by the server
 * resolver only; read tolerantly (an unknown modality/reason from a newer server is shown generically, never dropped).
 */
const sourceSelectionSchema = z.object({
  modality: z.string(),
  model_id: z.string().optional(),
  selection_source: z.string(),
  rule_ref: z.string().optional(),
  reason: z.string(),
  responsibility: z.literal('user').optional(),
  cost: z.object({ status: z.enum(['free', 'priced', 'not_ready']), credits: z.number().optional() }).passthrough(),
}).passthrough()

const shotDirectionSchema = z.object({
  intent: z.object({ function: z.string(), description: z.string() }).passthrough(),
  selection: sourceSelectionSchema.optional(),
}).passthrough()

export const shotSchema = z.object({
  shot_id: z.string(),
  order: z.number(),
  chapter_id: z.string(),
  beat_ids: z.array(z.string()),
  section_role: z.string(),
  visual_intent: z.string(),
  media_path: z.enum(['native', 'existing_asset', 'stock', 'generate', 'avatar', 'motion']),
  capability: capabilitySchema.optional(),
  output_kind: z.enum(['image', 'video', 'audio', 'avatar_video']).optional(),
  planned_seconds: z.number(),
  generated_seconds: z.number().optional(),
  generation_parts: z.number().optional(),
  transition_in: z.string().optional(),
  prompt_detail: z.string().optional(),
  slot_kind: z.enum(['required', 'optional']),
  direction: shotDirectionSchema.optional(),
}).passthrough()

export type ScriptReviewShot = z.infer<typeof shotSchema>
export type ScriptReviewSourceSelection = z.infer<typeof sourceSelectionSchema>

/**
 * P04-22 (additive): one image of a Motion Film plan's asset inventory. A screenshot carries the server-written 0-8
 * score and the treatment of the plan (real / simplify / redraw); `screen_treatment_source: user` is the user's own
 * choice ("use the real screen"). Read tolerantly: an item this panel cannot read is dropped, never fatal.
 */
const inventoryItemSchema = z.object({
  asset: ownerResourceSchema,
  kind: z.enum(['screenshot', 'photo', 'logo', 'product_image', 'illustration', 'chart', 'video', 'other']),
  title: z.string(),
  usage: z.enum(['hero', 'detail', 'background', 'reference_only', 'do_not_use']),
  sensitive_data_warning: z.string().optional(),
  ui_score: z.object({
    current: z.number(),
    simple: z.number(),
    on_brand: z.number(),
    shows_proof: z.number(),
    total: z.number(),
  }).optional(),
  screen_treatment: z.enum(['real', 'simplify', 'redraw']).optional(),
  screen_treatment_source: z.enum(['score', 'user']).optional(),
}).passthrough()

export type PlanInventoryItem = z.infer<typeof inventoryItemSchema>
export type ScreenTreatment = 'real' | 'simplify' | 'redraw'

const shotPlanHeaderSchema = z.object({
  schema_version: z.literal('shot_plan_v1'),
  script_ref: artifactRefSchema,
  asset_inventory: z.array(z.unknown()).optional(),
}).passthrough()

/** The screenshots of a shot plan header's inventory (other images and unreadable items are not screens). */
export function readPlanScreens(inventory: readonly unknown[] | undefined): PlanInventoryItem[] {
  return (inventory ?? []).flatMap((item) => {
    const parsed = inventoryItemSchema.safeParse(item)
    return parsed.success && parsed.data.kind === 'screenshot' ? [parsed.data] : []
  })
}

export const planHeaderSchema = z.object({
  schema_version: z.literal('production_plan_v1'),
  estimate: z.object({
    status: z.enum(['valid', 'computing', 'stale', 'unavailable']),
    min_credits: z.number().optional(),
    max_credits: z.number().optional(),
    point_credits: z.number().optional(),
    preparation_spent_credits: z.number().optional(),
    includes_final_render: z.boolean(),
    line_items: z.array(z.object({
      item_id: z.string(),
      category: z.enum(['research', 'script', 'image', 'video', 'voice', 'avatar', 'stock', 'render', 'repair', 'other']),
      operation_count: z.number(),
      output_count: z.number().optional(),
      units_seconds: z.number().optional(),
      credits_min: z.number(),
      credits_max: z.number(),
      shot_ids: z.array(z.string()).optional(),
      capability: capabilitySchema.optional(),
    }).passthrough()),
  }).passthrough(),
  budget_policy: z.object({ approved_max_credits: z.number().nullable() }).passthrough(),
  bindings: z.array(z.object({
    role: z.enum(['avatar', 'voice', 'template', 'intro', 'outro', 'element', 'kit']),
    target: z.object({ scope: z.enum(['global', 'shot', 'slot']), shot_id: z.string().optional(), slot_id: z.string().optional() }),
    resource: ownerResourceSchema.nullable(),
    selection_source: z.enum(['explicit', 'job_selection', 'template', 'channel_default', 'personal_default', 'product_default', 'product_suggestion']),
  }).passthrough()),
}).passthrough()

export type PlanHeader = z.infer<typeof planHeaderSchema>
export type PlanBinding = PlanHeader['bindings'][number]
export type PlanLineItem = PlanHeader['estimate']['line_items'][number]

export const briefHeaderSchema = z.object({
  schema_version: z.literal('video_brief_v1'),
  title: z.string().optional(),
  audience: z.string(),
  locale: z.string(),
  target_duration_seconds: z.number(),
  aspect_ratio: z.enum(['16:9', '9:16', '1:1']),
  output_goal: z.enum(['final_video', 'preview_only', 'plan_only', 'script_only']),
  preferences: z.object({ media_profile: z.enum(['economy', 'balanced', 'quality']).optional() }).passthrough().optional(),
}).passthrough()

export type BriefHeader = z.infer<typeof briefHeaderSchema>

export const researchSourceSchema = z.object({
  source_id: z.string(),
  canonical_url: z.string().optional(),
  title: z.string().optional(),
  publisher: z.string().optional(),
  published_at: z.string().optional(),
  accessed_at: z.string().optional(),
  read_status: z.string(),
}).passthrough()

export const researchClaimSchema = z.object({
  claim_id: z.string(),
  text: z.string(),
  support: z.string(),
}).passthrough()

export type ResearchSource = z.infer<typeof researchSourceSchema>
export type ResearchClaim = z.infer<typeof researchClaimSchema>

const pageResponseSchema = z.object({
  data: z.object({
    schema_version: z.literal('preparation_body_page_v1'),
    artifact_ref: artifactRefSchema,
    section: z.enum(['header', 'chapters', 'shots', 'sources', 'claims']),
    items: z.array(z.unknown()),
    total_items: z.number().int(),
    next_cursor: z.string().nullable(),
  }),
})

const summaryResponseSchema = z.object({ data: productionPlanSummarySchema })

export interface ScriptReviewScript {
  artifactId: string
  revision: number
  digest: string
  readiness: 'draft' | 'not_ready' | 'ready'
  header: ScriptHeader
  chapters: ScriptChapter[]
}

export interface ScriptReviewData {
  projectId: string
  jobId: string
  summary: ProductionPlanSummary
  script: ScriptReviewScript | null
  /**
   * Shots of the shot plan head; `stale` when they were planned on another script revision than the head. `screens` are
   * the screenshots of a Motion Film plan's inventory (empty for any other plan).
   */
  shotPlan: { artifactId: string; revision: number; stale: boolean; shots: ScriptReviewShot[]; screens: PlanInventoryItem[] } | null
  plan: { revision: number; header: PlanHeader } | null
  brief: BriefHeader | null
  research: { sources: ResearchSource[]; claims: ResearchClaim[] } | null
}

type Section = 'header' | 'chapters' | 'shots' | 'sources' | 'claims'

function basePath(projectId: string) {
  return `/api/v1/composition/projects/${encodeURIComponent(projectId)}`
}

/** The job's package summary; null when the project or job is not readable (no card, no panel). */
export async function getProductionPlanSummary(projectId: string, jobId: string, options: { signal?: AbortSignal } = {}): Promise<ProductionPlanSummary | null> {
  try {
    const result = await gatewayRequest(`${basePath(projectId)}/production-plan?job_id=${encodeURIComponent(jobId)}`, {
      schema: summaryResponseSchema,
      signal: options.signal,
    })
    return result.data
  } catch (error) {
    if (error instanceof AuthClientError && (error.status === 404 || error.status === 403)) return null
    throw error
  }
}

/** Every item of one section of an exact revision (cursor pages, bounded). */
async function readSection(projectId: string, artifactId: string, revision: number, section: Section, signal?: AbortSignal): Promise<unknown[]> {
  const items: unknown[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ section })
    if (section !== 'header') params.set('limit', String(PAGE_LIMIT))
    if (cursor) params.set('cursor', cursor)
    const result: z.infer<typeof pageResponseSchema> = await gatewayRequest(
      `${basePath(projectId)}/preparation-artifacts/${encodeURIComponent(artifactId)}/revisions/${revision}/body?${params.toString()}`,
      { schema: pageResponseSchema, signal },
    )
    items.push(...result.data.items)
    cursor = result.data.next_cursor
    if (!cursor) return items
  }
  throw new Error('Preparation body has more pages than the panel reads.')
}

async function readHeader<S extends z.ZodTypeAny>(projectId: string, artifactId: string, revision: number, schema: S, signal?: AbortSignal): Promise<z.output<S>> {
  const [header] = await readSection(projectId, artifactId, revision, 'header', signal)
  return schema.parse(header)
}

/**
 * Everything the panel shows for one job. The script is its head revision (the one the user edits); the shot plan,
 * plan, brief and research pack are their heads too, and the summary tells which of them the plan pinned.
 */
export async function loadScriptReview(projectId: string, jobId: string, options: { signal?: AbortSignal } = {}): Promise<ScriptReviewData | null> {
  const signal = options.signal
  const summary = await getProductionPlanSummary(projectId, jobId, { signal })
  if (!summary) return null
  const head = (kind: z.infer<typeof artifactKindSchema>) => summary.artifacts.find((artifact) => artifact.artifact_kind === kind) ?? null
  const scriptHead = head('script')
  const shotHead = head('shot_plan')
  const planHead = head('production_plan')
  const briefHead = head('video_brief')
  const researchHead = head('research_pack')

  const [script, shotPlan, plan, brief, research] = await Promise.all([
    scriptHead
      ? Promise.all([
        readHeader(projectId, scriptHead.artifact_id, scriptHead.head_revision, scriptHeaderSchema, signal),
        readSection(projectId, scriptHead.artifact_id, scriptHead.head_revision, 'chapters', signal),
      ]).then(([header, chapters]): ScriptReviewScript => ({
        artifactId: scriptHead.artifact_id,
        revision: scriptHead.head_revision,
        digest: scriptHead.head_digest_sha256,
        readiness: scriptHead.head_readiness,
        header,
        chapters: chapters.map((chapter) => scriptChapterSchema.parse(chapter)),
      }))
      : Promise.resolve(null),
    shotHead
      ? Promise.all([
        readHeader(projectId, shotHead.artifact_id, shotHead.head_revision, shotPlanHeaderSchema, signal),
        readSection(projectId, shotHead.artifact_id, shotHead.head_revision, 'shots', signal),
      ]).then(([header, shots]) => ({
        artifactId: shotHead.artifact_id,
        revision: shotHead.head_revision,
        stale: !scriptHead || header.script_ref.artifact_id !== scriptHead.artifact_id || header.script_ref.artifact_revision !== scriptHead.head_revision,
        shots: shots.map((shot) => shotSchema.parse(shot)),
        screens: readPlanScreens(header.asset_inventory),
      }))
      : Promise.resolve(null),
    planHead
      ? readHeader(projectId, planHead.artifact_id, planHead.head_revision, planHeaderSchema, signal).then((header) => ({ revision: planHead.head_revision, header }))
      : Promise.resolve(null),
    briefHead ? readHeader(projectId, briefHead.artifact_id, briefHead.head_revision, briefHeaderSchema, signal) : Promise.resolve(null),
    researchHead
      ? Promise.all([
        readSection(projectId, researchHead.artifact_id, researchHead.head_revision, 'sources', signal),
        readSection(projectId, researchHead.artifact_id, researchHead.head_revision, 'claims', signal),
      ]).then(([sources, claims]) => ({
        sources: sources.map((source) => researchSourceSchema.parse(source)),
        claims: claims.map((claim) => researchClaimSchema.parse(claim)),
      }))
      : Promise.resolve(null),
  ])
  return { projectId, jobId, summary, script, shotPlan, plan, brief, research }
}

export interface VideoProductionCardData {
  summary: ProductionPlanSummary
  scriptHeader: ScriptHeader | null
  brief: BriefHeader | null
}

export const VIDEO_PRODUCTION_CARD_QUERY_KEY = ['composition', 'video-production-card'] as const

/** The Chat card's light read: the summary plus the script and brief headers (no chapters, shots or sources). */
export async function loadVideoProductionCard(projectId: string, jobId: string, options: { signal?: AbortSignal } = {}): Promise<VideoProductionCardData | null> {
  const signal = options.signal
  const summary = await getProductionPlanSummary(projectId, jobId, { signal })
  if (!summary) return null
  const script = summary.artifacts.find((artifact) => artifact.artifact_kind === 'script') ?? null
  if (!script) return { summary, scriptHeader: null, brief: null }
  const brief = summary.artifacts.find((artifact) => artifact.artifact_kind === 'video_brief') ?? null
  const [scriptHeader, briefHeader] = await Promise.all([
    readHeader(projectId, script.artifact_id, script.head_revision, scriptHeaderSchema, signal),
    brief ? readHeader(projectId, brief.artifact_id, brief.head_revision, briefHeaderSchema, signal) : Promise.resolve(null),
  ])
  return { summary, scriptHeader, brief: briefHeader }
}

export const SHOT_PLAN_ROWS_QUERY_KEY = ['composition', 'shot-plan-rows'] as const

/** SV: the shot list of the job's plan card — the shot plan head with the director's pinned sources and the server's prices. */
export interface ShotPlanRowsData {
  projectId: string
  jobId: string
  artifactId: string
  revision: number
  /** `storyboard_draft` only when the user asked for it in chat (the plan's own `production_mode`). */
  mode: 'final' | 'storyboard_draft'
  shots: ScriptReviewShot[]
}

/** Read-only: the shot plan head of a job (null: no readable project/job, or no shot plan yet). */
export async function loadShotPlanRows(projectId: string, jobId: string, options: { signal?: AbortSignal } = {}): Promise<ShotPlanRowsData | null> {
  const signal = options.signal
  const summary = await getProductionPlanSummary(projectId, jobId, { signal })
  const head = summary?.artifacts.find((artifact) => artifact.artifact_kind === 'shot_plan') ?? null
  if (!summary || !head) return null
  const [header, shots] = await Promise.all([
    readHeader(projectId, head.artifact_id, head.head_revision, shotPlanHeaderSchema, signal),
    readSection(projectId, head.artifact_id, head.head_revision, 'shots', signal),
  ])
  return {
    projectId,
    jobId,
    artifactId: head.artifact_id,
    revision: head.head_revision,
    mode: (header as { production_mode?: unknown }).production_mode === 'storyboard_draft' ? 'storyboard_draft' : 'final',
    shots: shots.map((shot) => shotSchema.parse(shot)),
  }
}

/** The Composition project of a job, from its P03-21 progress checkpoint (null: not bound to a project). */
export function jobProjectIdFromProgress(progress: unknown): string | null {
  const value = progress && typeof progress === 'object' ? (progress as { project_id?: unknown }).project_id : null
  return typeof value === 'string' && value.length > 0 ? value : null
}

// ------------------------------------------------------------------------------------------------ patch

export type ScriptPatchOp =
  | { op: 'set_title'; title: string }
  | { op: 'set_text_field'; field: 'angle' | 'purpose' | 'key_message' | 'narrative_flow'; value: string }
  | { op: 'select_hook'; hook_id: string }
  | { op: 'set_hook_text'; hook_id: string; text: string }
  | { op: 'set_chapter_title'; chapter_id: string; title: string }
  | { op: 'set_chapter_enabled'; chapter_id: string; enabled: boolean }
  | { op: 'set_beat_narration'; beat_id: string; narration: string }
  | { op: 'set_on_screen_text'; beat_id: string; text_id: string; text: string }

export const SCRIPT_PATCH_MAX_OPS = 50

const patchResponseSchema = z.object({
  data: z.object({
    outcome: z.enum(['created', 'unchanged', 'replayed']),
    revision: z.object({
      artifact_id: z.string(),
      revision: z.number().int(),
      content_digest_sha256: z.string(),
      readiness: readinessSchema,
    }).passthrough(),
    impact: z.object({
      header_changed: z.boolean(),
      changed_chapter_ids: z.array(z.string()),
      changed_beat_ids: z.array(z.string()),
      timing_changed: z.boolean(),
      estimate_affected: z.boolean(),
    }),
    script: z.object({
      header: scriptHeaderSchema,
      chapters: z.array(scriptChapterSchema),
    }),
  }).passthrough(),
})

export type ScriptPatchResult = z.infer<typeof patchResponseSchema>['data']

export interface ScriptPatchRequest {
  projectId: string
  jobId: string
  artifactId: string
  expectedRevision: number
  idempotencyKey: string
  ops: readonly ScriptPatchOp[]
}

export async function patchScript(request: ScriptPatchRequest): Promise<ScriptPatchResult> {
  const result = await gatewayRequest(
    `/api/v1/composition-script-review/projects/${encodeURIComponent(request.projectId)}/preparation-artifacts/${encodeURIComponent(request.artifactId)}/script-patches`,
    {
      method: 'POST',
      csrf: true,
      body: {
        job_id: request.jobId,
        expected_revision: request.expectedRevision,
        idempotency_key: request.idempotencyKey,
        ops: request.ops,
        change_summary: 'Script panel',
      },
      schema: patchResponseSchema,
    },
  )
  return result.data
}

/** Another tab or the assistant moved the script past the revision this panel edits (K198/K226). */
export function isScriptRevisionConflict(error: unknown): boolean {
  return error instanceof AuthClientError && error.status === 409 && error.code === 'COMPOSITION_PREPARATION_REVISION_CONFLICT'
}

// ------------------------------------------------------------------------------------- screen treatment

export type ScreenTreatmentChoice = ScreenTreatment | 'score'

const screenTreatmentResponseSchema = z.object({
  data: z.object({
    outcome: z.enum(['created', 'unchanged', 'replayed']),
    revision: z.object({
      artifact_id: z.string(),
      revision: z.number().int(),
      content_digest_sha256: z.string(),
      readiness: readinessSchema,
    }).passthrough(),
    screen: z.object({
      asset_id: z.string(),
      treatment: z.enum(['real', 'simplify', 'redraw']),
      source: z.enum(['score', 'user']),
      ui_score_total: z.number().nullable(),
      shown_in_shots: z.array(z.string()),
      replan_needed: z.boolean(),
    }),
  }).passthrough(),
})

export type ScreenTreatmentResult = z.infer<typeof screenTreatmentResponseSchema>['data']

export interface ScreenTreatmentRequest {
  projectId: string
  jobId: string
  /** The shot plan artifact whose exact head revision the panel shows. */
  artifactId: string
  expectedRevision: number
  idempotencyKey: string
  assetId: string
  treatment: ScreenTreatmentChoice
}

/**
 * P04-22 "use the real screen": the user's treatment of one screenshot of the plan, stored as a new shot plan revision on
 * the exact revision shown (CAS). It starts no inference, pricing, media or production.
 */
export async function setScreenTreatment(request: ScreenTreatmentRequest): Promise<ScreenTreatmentResult> {
  const result = await gatewayRequest(
    `/api/v1/composition-motion-film/projects/${encodeURIComponent(request.projectId)}/preparation-artifacts/${encodeURIComponent(request.artifactId)}/screen-treatments`,
    {
      method: 'POST',
      csrf: true,
      body: {
        job_id: request.jobId,
        expected_revision: request.expectedRevision,
        idempotency_key: request.idempotencyKey,
        asset_id: request.assetId,
        treatment: request.treatment,
      },
      schema: screenTreatmentResponseSchema,
    },
  )
  return result.data
}

/** The Motion Film plan is not enabled in this environment (gate closed). */
export function isMotionFilmUnavailable(error: unknown): boolean {
  return error instanceof AuthClientError && error.status === 503 && error.code === 'COMPOSITION_MOTION_FILM_UNAVAILABLE'
}
