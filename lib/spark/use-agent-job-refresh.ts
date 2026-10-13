'use client'

import * as React from 'react'

import type { ConversationJobs } from '@/lib/assistant/composer/conversation-jobs'

import { AgentJobRefreshWatcher } from './agent-job-refresh'

/**
 * Calls `refresh` once per batch of agent jobs of the project's conversation that end while the editor is open
 * (see `AgentJobRefreshWatcher`). `enabled` is true once the conversation is known.
 */
export function useRefreshOnAgentJobEnd(jobs: ConversationJobs, enabled: boolean, refresh: (() => void | Promise<void>) | undefined): void {
  const [watcher] = React.useState(() => new AgentJobRefreshWatcher())
  React.useEffect(() => {
    watcher.setRefresh(() => refresh?.())
  }, [watcher, refresh])
  React.useEffect(() => {
    watcher.observe(jobs, enabled)
  }, [watcher, jobs, enabled])
}
