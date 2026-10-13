import {
  CONTEXT_SECTION_KEYS,
  type AssistantContextUsage,
  type AssistantContextUsageTotals,
  type ContextSectionKey,
} from './context-meter-api'

/**
 * Spark context meter: what the ring and its card show, as a pure projection of the gateway's context usage (nothing is
 * counted in the browser). The ring is the share of the input budget (never above the model's window) the newest
 * assistant call used; the card lists what was in that context by section, the skills by name, the headroom before the
 * server starts trimming older context, and the chat's totals.
 */

/** From this share of the limit the ring turns amber, and from the next one red. */
export const CONTEXT_METER_HIGH_RATIO = 0.7
export const CONTEXT_METER_CRITICAL_RATIO = 0.9

export type ContextMeterTone = 'idle' | 'normal' | 'high' | 'critical'

export type ContextMeterSkill = {
  id: string
  /** The skill's own name (user skills), else a readable form of its id (Youtorch guides). */
  label: string
  tokens: number
  /** Loaded by the server's pre-router (not chosen by the user or the assistant). */
  auto: boolean
}

export type ContextMeterRow = { key: ContextSectionKey; tokens: number }

export type ContextMeterTrimNote =
  | { kind: 'omitted_messages'; count: number }
  | { kind: 'compacted_messages'; count: number }
  | { kind: 'memory_matches'; count: number }
  | { kind: 'skill_index' }
  | { kind: 'guides_withdrawn' }
  | { kind: 'older_turns' }

export type ContextMeterModel = {
  /** False until the conversation's first measured assistant call; the ring then shows empty. */
  recorded: boolean
  tone: ContextMeterTone
  /** 0–100, whole percent of `limit` (a used context never shows 0 %). */
  percent: number
  ratio: number
  used: number
  limit: number
  kind: 'counted' | 'estimated' | null
  untilTrim: number | null
  /** Where the trim point sits on the bar, as a share of `limit` (null: unknown or past the bar). */
  trimRatio: number | null
  window: number | null
  inputBudget: number | null
  outputBudget: { tokens: number; kind: 'final_answer' | 'job_draft' | null } | null
  cacheRead: number | null
  /** Non-empty sections in display order. */
  rows: ContextMeterRow[]
  skills: ContextMeterSkill[]
  /** What was left out or shortened to make the call fit; empty when nothing was. */
  trimmed: ContextMeterTrimNote[]
  conversation: AssistantContextUsageTotals
  job: AssistantContextUsageTotals | null
}

const EMPTY_TOTALS: AssistantContextUsageTotals = { planner_calls: 0, input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, credits: 0 }
const SECTION_KEYS = new Set<string>(CONTEXT_SECTION_KEYS)

export function contextMeterTone(ratio: number): Exclude<ContextMeterTone, 'idle'> {
  if (ratio >= CONTEXT_METER_CRITICAL_RATIO) return 'critical'
  if (ratio >= CONTEXT_METER_HIGH_RATIO) return 'high'
  return 'normal'
}

/** `youtorch.guide.youtube_shorts` → `Youtube shorts`; a user skill keeps its own name. */
export function contextSkillLabel(skill: { skill_id: string; name: string | null }): string {
  const name = skill.name?.trim()
  if (name) return name
  const parts = skill.skill_id.replace(/^youtorch\.guide\./u, '').split('.').filter(Boolean)
  // A trailing version (`.v1`) is not part of the name.
  while (parts.length > 1 && /^v\d+$/iu.test(parts.at(-1)!)) parts.pop()
  const tail = parts.at(-1) ?? skill.skill_id
  const words = tail.replace(/[_-]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : skill.skill_id
}

export function buildContextMeterModel(usage: AssistantContextUsage | null | undefined): ContextMeterModel {
  const turn = usage?.last_turn ?? null
  if (!usage || usage.status !== 'recorded' || !turn) {
    return {
      recorded: false,
      tone: 'idle',
      percent: 0,
      ratio: 0,
      used: 0,
      limit: 0,
      kind: null,
      untilTrim: null,
      trimRatio: null,
      window: null,
      inputBudget: null,
      outputBudget: null,
      cacheRead: null,
      rows: [],
      skills: [],
      trimmed: [],
      conversation: usage?.conversation_totals ?? EMPTY_TOTALS,
      job: null,
    }
  }
  const limit = Math.max(1, turn.limit_tokens)
  const ratio = clamp(turn.input_tokens / limit)
  let percent = Math.round(ratio * 100)
  if (percent === 0 && turn.input_tokens > 0) percent = 1
  let tone = contextMeterTone(ratio)
  // Close to the trim point counts as high even below 70 % of the limit.
  if (tone === 'normal' && turn.until_trim_tokens !== null && turn.until_trim_tokens < limit * 0.05) tone = 'high'
  const trimAt = turn.until_trim_tokens !== null ? turn.input_tokens + turn.until_trim_tokens : null
  const rows = turn.sections
    .filter((section): section is ContextMeterRow => SECTION_KEYS.has(section.key) && section.tokens > 0)
  return {
    recorded: true,
    tone,
    percent,
    ratio,
    used: turn.input_tokens,
    limit,
    kind: turn.input_token_kind,
    untilTrim: turn.until_trim_tokens,
    trimRatio: trimAt !== null && trimAt < limit ? clamp(trimAt / limit) : null,
    window: turn.context_window_tokens,
    inputBudget: turn.max_input_tokens,
    outputBudget: turn.output_budget
      ? { tokens: turn.output_budget.tokens, kind: turn.output_budget.kind === 'final_answer' || turn.output_budget.kind === 'job_draft' ? turn.output_budget.kind : null }
      : null,
    cacheRead: turn.cache_read_input_tokens !== null && turn.cache_read_input_tokens > 0 ? turn.cache_read_input_tokens : null,
    rows,
    skills: turn.skills
      .filter((skill) => skill.tokens > 0)
      .map((skill) => ({ id: skill.skill_id, label: contextSkillLabel(skill), tokens: skill.tokens, auto: skill.selected_by === 'pre_router' })),
    trimmed: trimNotes(turn.trimming),
    conversation: usage.conversation_totals,
    job: usage.job_totals,
  }
}

function trimNotes(trimming: NonNullable<AssistantContextUsage['last_turn']>['trimming']): ContextMeterTrimNote[] {
  if (!trimming.applied) return []
  const notes: ContextMeterTrimNote[] = []
  if (trimming.omitted_messages > 0) notes.push({ kind: 'omitted_messages', count: trimming.omitted_messages })
  if (trimming.compacted_messages > 0) notes.push({ kind: 'compacted_messages', count: trimming.compacted_messages })
  if (trimming.memory_matches_omitted > 0) notes.push({ kind: 'memory_matches', count: trimming.memory_matches_omitted })
  if (trimming.user_skill_index_trimmed) notes.push({ kind: 'skill_index' })
  if (trimming.steps.includes('withdraw_pre_routed_guides')) notes.push({ kind: 'guides_withdrawn' })
  const shortened = trimming.steps.some((step) => step === 'reduce_recent_messages' || step === 'reduce_plan_observations' || step === 'reduce_workflow_catalog')
  if (shortened && !notes.some((note) => note.kind === 'omitted_messages')) notes.push({ kind: 'older_turns' })
  return notes
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}
