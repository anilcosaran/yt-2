import { isTerminalJobState, type ConversationJob, type ConversationJobs } from '@/lib/assistant/composer/conversation-jobs'

/**
 * What the Spark side chat tells the user about the chat's jobs besides the answer text (FIX-DEV-3).
 *
 * The side chat shows the transcript and a "working" row while a job runs. Three job states produced neither an answer nor a
 * visible end, so the agent seemed to "do nothing" (DEV 2026-10-01): a job that FAILED left no message at all, and a job that
 * waits for the user's APPROVAL or for PAYMENT (a card only the Chat page renders) kept the working row spinning for ever.
 * Those states now name themselves and point to the Chat, where the card or the reason lives.
 */
export type SparkChatJobNotice = 'failed' | 'waiting_for_approval' | 'waiting_for_payment'

export type SparkChatJobStatus = {
  /** A job is running by itself: the design's thinking row. */
  working: boolean
  notice: SparkChatJobNotice | null
  /** With `failed`: the failed job's public error code when its `run.failed` event carried one, so the reason is shown. */
  failureCode: string | null
}

/** A job that only moves on by a user action is not "working" (a question has its own chips). */
function waitsForTheUser(job: ConversationJob): boolean {
  return job.state === 'waiting_for_user' || job.state === 'waiting_for_approval' || job.state === 'waiting_for_payment'
}

/** The job with the newest update (jobs without a time keep their arrival order, the later one wins a tie). */
function newestJob(jobs: ConversationJobs): ConversationJob | null {
  let newest: ConversationJob | null = null
  let newestAt = Number.NEGATIVE_INFINITY
  for (const job of jobs.values()) {
    const parsed = job.updatedAt ? Date.parse(job.updatedAt) : Number.NaN
    const at = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
    if (newest === null || at >= newestAt) {
      newest = job
      newestAt = at
    }
  }
  return newest
}

export function sparkChatJobStatus(jobs: ConversationJobs): SparkChatJobStatus {
  const all = [...jobs.values()]
  const working = all.some((job) => !isTerminalJobState(job.state) && !waitsForTheUser(job))
  // An action the user must take comes first; a failure is only news while it is the chat's latest job.
  if (all.some((job) => job.state === 'waiting_for_payment')) return { working, notice: 'waiting_for_payment', failureCode: null }
  if (all.some((job) => job.state === 'waiting_for_approval')) return { working, notice: 'waiting_for_approval', failureCode: null }
  const newest = newestJob(jobs)
  if (newest?.state !== 'failed') return { working, notice: null, failureCode: null }
  return { working, notice: 'failed', failureCode: newest.errorCode ?? null }
}
