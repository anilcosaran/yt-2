import {
  ClientMutationAttemptStore,
  stableClientFingerprint,
  type ClientKeyValueStorage,
} from '@/lib/idempotency/client-mutation-control'
import type { ViralClipsQuotaSnapshot } from '@/lib/workflows/api'

export type WorkflowRunAttemptPayload = {
  channelId: string
  definitionId: string
  sourceRevisionId: string
  executableRevisionId: string
  estimateId: string
  projectId: string
  expectedViralClipsQuota?: ViralClipsQuotaSnapshot
}

const WORKFLOW_RUN_ATTEMPT_STORAGE_KEY = 'youtorch:workflow-run-attempts:v1'

export function createWorkflowRunAttemptStore(storage?: ClientKeyValueStorage | null) {
  return new ClientMutationAttemptStore<WorkflowRunAttemptPayload>({
    storageKey: WORKFLOW_RUN_ATTEMPT_STORAGE_KEY,
    isPayload: isWorkflowRunAttemptPayload,
    ...(storage !== undefined ? { storage } : {}),
  })
}

export function getWorkflowRunAttemptScope(channelId: string, definitionId: string) {
  return `${channelId}:${definitionId}`
}

export function getWorkflowRunAttemptFingerprint(input: {
  dslHash: string
  projectId: string
  userInputs: Record<string, unknown>
}) {
  return stableClientFingerprint({
    dsl_hash: input.dslHash,
    project_id: input.projectId,
    user_inputs: input.userInputs,
  })
}

function isWorkflowRunAttemptPayload(value: unknown): value is WorkflowRunAttemptPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<WorkflowRunAttemptPayload>
  return typeof candidate.channelId === 'string'
    && typeof candidate.definitionId === 'string'
    && typeof candidate.sourceRevisionId === 'string'
    && typeof candidate.executableRevisionId === 'string'
    && typeof candidate.estimateId === 'string'
    && typeof candidate.projectId === 'string'
    && isOptionalViralClipsQuotaSnapshot(candidate.expectedViralClipsQuota)
}

function isOptionalViralClipsQuotaSnapshot(value: unknown): value is ViralClipsQuotaSnapshot | undefined {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ViralClipsQuotaSnapshot>
  return candidate.quota_key === 'workflow:monthly_viral_clips'
    && Number.isInteger(candidate.remaining_clips)
    && (candidate.remaining_clips ?? 0) >= 1
    && Number.isInteger(candidate.max_clips_this_run)
    && (candidate.max_clips_this_run ?? 0) >= 1
    && (candidate.max_clips_this_run ?? 0) <= 10
    && typeof candidate.limited === 'boolean'
}
