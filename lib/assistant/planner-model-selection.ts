import type {
  AssistantConversationSettings,
  AssistantSettingsCommandOutcome,
} from '@/lib/assistant/api'

/**
 * P01A-11: what the composer shows for the chat (planner) model. Only server-committed settings count: the checked
 * model is the job's (or the conversation's) requested model after the server applied the command, never a local
 * click. During an active job a committed switch is shown as applying from the next step until the server reports
 * it effective. A Fast/Pro/Max profile is not a model identity; the picker lists exact catalog models.
 */
export type PlannerModelView = {
  /** Committed model: the selected job's requested model, else the conversation's new-job default. */
  selectedModelId: string | null
  /** The model answering the selected job now (null without a selected job). */
  effectiveModelId: string | null
  /** Committed switch waiting for the selected job's next safe step. */
  pendingModelId: string | null
  /** Committed for the selected job but refused at its boundary; the effective model continues. */
  unavailableModelId: string | null
}

export type PlannerModelHint = 'current_step' | 'next_step' | 'unavailable'

export function plannerModelView(settings: AssistantConversationSettings | null | undefined): PlannerModelView {
  if (!settings) return { selectedModelId: null, effectiveModelId: null, pendingModelId: null, unavailableModelId: null }
  const job = settings.job
  if (!job) {
    return {
      selectedModelId: settings.defaults.default_planner_model_id,
      effectiveModelId: null,
      pendingModelId: null,
      unavailableModelId: null,
    }
  }
  const pending = job.pending_model_switch?.target_model_id ?? null
  const differs = job.requested_planner_model_id !== job.effective_planner_model_id
  return {
    selectedModelId: job.requested_planner_model_id,
    effectiveModelId: job.effective_planner_model_id,
    pendingModelId: pending && pending !== job.effective_planner_model_id ? pending : null,
    unavailableModelId: differs && !pending ? job.requested_planner_model_id : null,
  }
}

export function plannerModelHint(modelId: string, view: PlannerModelView): PlannerModelHint | null {
  if (view.pendingModelId) {
    if (modelId === view.pendingModelId) return 'next_step'
    if (modelId === view.effectiveModelId) return 'current_step'
    return null
  }
  if (view.unavailableModelId) {
    if (modelId === view.unavailableModelId) return 'unavailable'
    if (modelId === view.effectiveModelId) return 'current_step'
  }
  return null
}

/**
 * `forbidden`: only the person who started a job changes its model. `defaults_owner_only`: only the conversation owner
 * changes the new-job default. `job_only`: S9 — in a shared conversation a member changed the model of their own job;
 * the new-job default stays the owner's.
 */
export type PlannerModelCommandResult =
  | 'applied'
  | 'job_only'
  | 'stale'
  | 'target_gone'
  | 'unsupported'
  | 'forbidden'
  | 'defaults_owner_only'
  | 'failed'

/** Every non-applied outcome leaves the settings unchanged; the composer re-reads the server state. */
export function classifyPlannerModelCommand(outcome: AssistantSettingsCommandOutcome): PlannerModelCommandResult {
  switch (outcome) {
    case 'applied':
    case 'replayed':
      return 'applied'
    case 'conflict':
      return 'stale'
    case 'rejected_target_not_found':
    case 'rejected_target_terminal':
    case 'rejected_missing_target':
      return 'target_gone'
    case 'rejected_unsupported_model':
      return 'unsupported'
    case 'rejected_forbidden':
      return 'forbidden'
    case 'rejected_defaults_owner_only':
      return 'defaults_owner_only'
    default:
      return 'failed'
  }
}

/**
 * S9 (decision 2026-09-27): a job+future command refused only because the new-job default is the owner's means the
 * actor passed the job authority check (P01-11 checks the job initiator first) — the change is then retried for that
 * exact job alone (`selected_job_only`, narrower, never wider). A member never changes another member's job.
 */
export function shouldRetryPlannerModelForJobOnly(outcome: AssistantSettingsCommandOutcome, hadSelectedJob: boolean): boolean {
  return hadSelectedJob && outcome === 'rejected_defaults_owner_only'
}
