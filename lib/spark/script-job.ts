import { getProductionPlanSummary, type ProductionPlanSummary } from '@/lib/assistant/script-review/script-review-api'

import type { CompositionDocument } from './composition-client'

/**
 * Timeline v3 toolbar "Script": the button shows only for a project made from a script (its sections carry the script's
 * chapter ids), and opens that script in the P03-20 review cover. The review is addressed by the job that prepared the
 * video; the editor knows the jobs of the project's linked conversation, so on click it asks, newest first, which of them
 * holds a script artifact for this project (the existing `production-plan?job_id=` read; a job of another kind answers
 * 404 and is skipped). Nothing is asked before the click, and nothing is stored.
 */

/** The project was made from a script (at least one section is bound to a script chapter). */
export function projectHasScript(document: CompositionDocument | null): boolean {
  return document?.sections.some((section) => typeof section.script_chapter_id === 'string' && section.script_chapter_id.length > 0) ?? false
}

/** At most this many jobs are asked (newest first). */
export const SCRIPT_JOB_PROBE_LIMIT = 8

type SummaryReader = (projectId: string, jobId: string) => Promise<Pick<ProductionPlanSummary, 'artifacts'> | null>

/** The newest of `jobIds` (given newest first) whose package holds a script for the project, or null. */
export async function findScriptJob(input: { projectId: string; jobIds: readonly string[]; read?: SummaryReader; limit?: number }): Promise<string | null> {
  const read: SummaryReader = input.read ?? ((projectId, jobId) => getProductionPlanSummary(projectId, jobId))
  for (const jobId of input.jobIds.slice(0, input.limit ?? SCRIPT_JOB_PROBE_LIMIT)) {
    let summary: Pick<ProductionPlanSummary, 'artifacts'> | null = null
    try {
      summary = await read(input.projectId, jobId)
    } catch {
      summary = null
    }
    if (summary?.artifacts.some((artifact) => artifact.artifact_kind === 'script')) return jobId
  }
  return null
}
