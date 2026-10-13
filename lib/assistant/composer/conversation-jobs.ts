import { z } from 'zod'

import { inferAssistantRunState, parseAssistantRunState, type AssistantRunEvent, type AssistantRunState } from '@/lib/assistant/api'

import type { ComposerJobTarget, ComposerReplyTo } from './message-context'

/**
 * P03-14 same-conversation independent jobs (P01-13 job = run). The composer keeps one focused job (the one whose
 * live card is shown and whose next steps a model/mode change touches) while other jobs keep running in the
 * background. A new message is never a global supersede: without an explicit target the server resolves it (new job,
 * or the author's single open question); two open questions come back as a short choice. Late completion of another
 * job only refreshes the transcript; it never moves the focus.
 */

const TERMINAL_STATES = new Set<AssistantRunState>(['completed', 'failed', 'cancelled'])

export type ConversationJob = {
  jobId: string
  state: AssistantRunState
  waitingReason: string | null
  updatedAt: string | null
  /**
   * QA-081: the job version of the latest snapshot (P01-15 `job_version`); null when unknown. Every run update
   * advances it, so a steer reads the fresh version just before sending (`resolveSteerJobTarget`).
   */
  jobVersion?: number | null
  /** The public error code of a failed job's `run.failed` event (e.g. `E3101`); null/absent when unknown. */
  errorCode?: string | null
}

export type ConversationJobs = ReadonlyMap<string, ConversationJob>

const snapshotRunSchema = z.object({
  run_id: z.string().min(1),
  state: z.string(),
  waiting_reason: z.string().nullable().catch(null),
  updated_at: z.union([z.string(), z.null()]).catch(null),
  job_version: z.number().int().min(0).nullable().optional().catch(null),
})

/** Jobs of the conversation stream snapshot (P01-15): the reconnect point of every job's state. */
export function conversationJobsFromSnapshot(payload: unknown): Map<string, ConversationJob> {
  const jobs = new Map<string, ConversationJob>()
  const runs = payload && typeof payload === 'object' && Array.isArray((payload as { runs?: unknown }).runs)
    ? (payload as { runs: unknown[] }).runs
    : []
  for (const raw of runs) {
    const parsed = snapshotRunSchema.safeParse(raw)
    if (!parsed.success) continue
    const state = parseAssistantRunState(parsed.data.state)
    if (!state) continue
    jobs.set(parsed.data.run_id, {
      jobId: parsed.data.run_id,
      state,
      waitingReason: parsed.data.waiting_reason,
      updatedAt: parsed.data.updated_at,
      jobVersion: parsed.data.job_version ?? null,
    })
  }
  return jobs
}

/** Applies one durable run event; returns the same map when nothing changed. */
export function applyConversationJobEvent(jobs: ConversationJobs, event: AssistantRunEvent): ConversationJobs {
  const state = inferAssistantRunState(event)
  if (!state) return jobs
  const current = jobs.get(event.run_id)
  if (current?.state === state) return jobs
  const next = new Map(jobs)
  next.set(event.run_id, {
    jobId: event.run_id,
    state,
    waitingReason: typeof event.payload.waiting_reason === 'string' ? event.payload.waiting_reason : current?.waitingReason ?? null,
    updatedAt: event.created_at,
    jobVersion: current?.jobVersion ?? null,
    ...(state === 'failed' && typeof event.payload.error_code === 'string' ? { errorCode: event.payload.error_code } : {}),
  })
  return next
}

export function isTerminalJobState(state: AssistantRunState): boolean {
  return TERMINAL_STATES.has(state)
}

/** Non-terminal jobs other than the focused one. */
export function backgroundJobs(jobs: ConversationJobs, focusedJobId: string | null): ConversationJob[] {
  return [...jobs.values()].filter((job) => job.jobId !== focusedJobId && !isTerminalJobState(job.state))
}

/**
 * An event of another (background) job that changes what the transcript shows: its end, a question or approval it
 * now waits for, or a message it wrote. The focused job has its own live stream.
 */
export function isBackgroundTranscriptEvent(event: AssistantRunEvent, focusedJobId: string | null): boolean {
  if (event.run_id === focusedJobId || event.transient) return false
  const state = inferAssistantRunState(event)
  if (state && (isTerminalJobState(state) || state === 'waiting_for_user' || state === 'waiting_for_approval' || state === 'waiting_for_payment')) {
    return true
  }
  return event.event_type === 'message.created' || event.event_type === 'assistant.message.created'
}

// --- Composer focus -------------------------------------------------------------------------------------------------

/**
 * `auto`: the composer follows the live job (as before); `job`: the user pinned a job; `new_jobs`: the user cleared the
 * focus, so settings change only the new-job default (`future_jobs_only`) and the next message opens a new job;
 * `fix` (QA-081 "Düzelt"): the next message is sent to the pinned running job as a steer — no new job is opened.
 */
export type ComposerJobFocus = { mode: 'auto' } | { mode: 'job'; jobId: string } | { mode: 'new_jobs' } | { mode: 'fix'; jobId: string }

export function resolveComposerJobFocus(
  focus: ComposerJobFocus,
  input: { activeJobId: string | null; jobs: ConversationJobs },
): { selectedJobId: string | null; explicitNewJob: boolean; steerJobId: string | null } {
  if (focus.mode === 'new_jobs') return { selectedJobId: null, explicitNewJob: true, steerJobId: null }
  if (focus.mode === 'job' || focus.mode === 'fix') {
    const job = input.jobs.get(focus.jobId)
    // A pinned job that ended (or is unknown to the stream) is no longer a target: no silent fallback to another job.
    if (!job || isTerminalJobState(job.state)) return { selectedJobId: null, explicitNewJob: false, steerJobId: null }
    const steer = focus.mode === 'fix' && isSteerableJobState(job.state)
    return { selectedJobId: focus.jobId, explicitNewJob: false, steerJobId: steer ? focus.jobId : null }
  }
  return { selectedJobId: input.activeJobId, explicitNewJob: false, steerJobId: null }
}

// --- "Fix this job" (QA-081) ------------------------------------------------------------------------------------

/** States a steer can target: the job is still a foreground job (not ended, not being stopped). */
const STEERABLE_STATES = new Set<AssistantRunState>([
  'created',
  'running',
  'waiting_for_user',
  'waiting_for_approval',
  'waiting_for_payment',
  'waiting_on_workflow',
  'waiting_on_agent',
])

export function isSteerableJobState(state: AssistantRunState): boolean {
  return STEERABLE_STATES.has(state)
}

export type SteerJobTargetResult =
  | { ok: true; jobTarget: { relation: 'steer'; job_id: string; expected_job_version: number } }
  | { ok: false; reason: 'job_ended' | 'version_unknown' }

/**
 * The `job_target` of a "Fix" message: `steer` to the focused job, fenced with the job version read just before
 * sending (the snapshot's version is only a fallback when that read fails). A job that ended or is being stopped is
 * never steered: the message stays in the composer and nothing opens a new job instead.
 */
export async function resolveSteerJobTarget(input: {
  jobId: string
  knownVersion: number | null | undefined
  readStatus: (jobId: string) => Promise<{ state: AssistantRunState; job_version?: number | null }>
}): Promise<SteerJobTargetResult> {
  let version = input.knownVersion ?? null
  try {
    const status = await input.readStatus(input.jobId)
    if (!isSteerableJobState(status.state)) return { ok: false, reason: 'job_ended' }
    if (typeof status.job_version === 'number') version = status.job_version
  } catch {
    // Keep the snapshot's version: the server's version fence still refuses a stale one.
  }
  if (version === null) return { ok: false, reason: 'version_unknown' }
  return { ok: true, jobTarget: { relation: 'steer', job_id: input.jobId, expected_job_version: version } }
}

// --- Ambiguous target (409 ASSISTANT_JOB_TARGET_AMBIGUOUS) -----------------------------------------------------------

export type AmbiguousJobCandidate = {
  jobId: string
  expectedJobVersion: number
  pendingInvocationId: string
  expectedPendingVersion: number
  promptMessageId: string
}

export type AmbiguousJobTarget = { candidates: AmbiguousJobCandidate[]; newJobAllowed: boolean }

const ambiguousDetailsSchema = z.object({
  candidates: z.array(z.object({
    job_id: z.string().min(1),
    expected_job_version: z.number().int().min(0),
    pending_invocation_id: z.string().min(1),
    expected_pending_version: z.number().int().min(1),
    prompt_message_id: z.string().min(1),
  })).min(1).max(16),
  new_job_allowed: z.boolean().catch(true),
})

/** Reads the server's ambiguous-target choice from a failed append (nothing was written). */
export function readAmbiguousJobTarget(error: unknown): AmbiguousJobTarget | null {
  if (!error || typeof error !== 'object') return null
  const { code, details } = error as { code?: unknown; details?: unknown }
  if (code !== 'ASSISTANT_JOB_TARGET_AMBIGUOUS') return null
  const parsed = ambiguousDetailsSchema.safeParse(details)
  if (!parsed.success) return null
  return {
    newJobAllowed: parsed.data.new_job_allowed,
    candidates: parsed.data.candidates.map((candidate) => ({
      jobId: candidate.job_id,
      expectedJobVersion: candidate.expected_job_version,
      pendingInvocationId: candidate.pending_invocation_id,
      expectedPendingVersion: candidate.expected_pending_version,
      promptMessageId: candidate.prompt_message_id,
    })),
  }
}

/** The explicit target the user's choice resends with: an exact reply binding, or a new job. */
export function jobTargetForChoice(choice: AmbiguousJobCandidate | 'new_job'): { jobTarget: ComposerJobTarget; replyTo: ComposerReplyTo | null } {
  if (choice === 'new_job') return { jobTarget: { relation: 'new_job' }, replyTo: null }
  return {
    jobTarget: { relation: 'reply', job_id: choice.jobId, expected_job_version: choice.expectedJobVersion },
    replyTo: { pending_invocation_id: choice.pendingInvocationId, expected_pending_version: choice.expectedPendingVersion },
  }
}

/** A short, human label of a job: the user's own words that started it (never a technical id). */
export function jobLabelFromMessages(
  jobId: string,
  messages: ReadonlyArray<{ run_id: string | null; role: string; content: string }>,
  maxLength = 48,
): string | null {
  const trigger = messages.find((message) => message.run_id === jobId && message.role === 'user')
  const text = trigger?.content.replace(/\s+/gu, ' ').trim()
  if (!text) return null
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
}
