import { isTerminalJobState, type ConversationJobs } from '@/lib/assistant/composer/conversation-jobs'

/**
 * Y1-07 W7: which jobs of the project's conversation ended since the last look. The Spark editor re-reads the working
 * copy when an agent job ends (the agent may have edited the project through `composition.edit.propose`): without that
 * the canvas shows a stale version and the user's next own command is rebased or conflicts.
 *
 * `seen` holds the ids already accounted for. The first snapshot after the editor opened is taken as history (nothing
 * to refresh: the editor just read the project), every later job that is terminal and not yet seen counts once —
 * including one the stream first reported already finished (a reconnect snapshot after the tab slept).
 */
export function newlyEndedJobIds(seen: Set<string>, jobs: ConversationJobs, options: { initial: boolean }): string[] {
  const ended: string[] = []
  for (const job of jobs.values()) {
    if (!isTerminalJobState(job.state)) continue
    if (seen.has(job.jobId)) continue
    seen.add(job.jobId)
    if (!options.initial) ended.push(job.jobId)
  }
  return ended
}

/**
 * Watches the jobs map of the conversation stream and calls `refresh` once per batch of jobs that ended. The first
 * snapshot that holds any job is history; an empty map (stream not connected yet, or a conversation without jobs) is not
 * a snapshot of history, so the first job of a fresh conversation is watched from its start.
 */
export class AgentJobRefreshWatcher {
  private readonly seen = new Set<string>()
  private historyRead = false

  constructor(private refresh: () => void | Promise<void> = () => undefined) {}

  /** The callback may change between renders; the watcher keeps the newest one (set from an effect, never in render). */
  setRefresh(refresh: () => void | Promise<void>): void {
    this.refresh = refresh
  }

  observe(jobs: ConversationJobs, enabled: boolean): void {
    if (!enabled) return
    const initial = !this.historyRead
    if (jobs.size > 0) this.historyRead = true
    if (newlyEndedJobIds(this.seen, jobs, { initial }).length > 0) void this.refresh()
  }
}
