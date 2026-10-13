import type { Workflow } from '@/lib/types'

const FLOW_DRAFT_HANDOFF_STORAGE_KEY = 'youtorch:flow-draft-handoffs'

type FlowDraftHandoffRecord = {
  savedAt: string
  workflow: Workflow
}

export function saveFlowDraftHandoff(workflow: Workflow) {
  if (typeof window === 'undefined') return
  try {
    const records = readFlowDraftHandoffRecords()
    records[workflow.id] = {
      savedAt: new Date().toISOString(),
      workflow,
    }
    window.localStorage.setItem(FLOW_DRAFT_HANDOFF_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Best-effort handoff for opening chat drafts in the full Flows editor.
  }
}

export function readFlowDraftHandoff(workflowId: string | null) {
  if (typeof window === 'undefined' || !workflowId) return null
  try {
    return readFlowDraftHandoffRecords()[workflowId]?.workflow ?? null
  } catch {
    return null
  }
}

export function clearFlowDraftHandoff(workflowId: string | null) {
  if (typeof window === 'undefined' || !workflowId) return
  try {
    const records = readFlowDraftHandoffRecords()
    if (!(workflowId in records)) return
    delete records[workflowId]
    window.localStorage.setItem(FLOW_DRAFT_HANDOFF_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Best-effort cleanup for local-only workflow drafts.
  }
}

function readFlowDraftHandoffRecords() {
  const raw = window.localStorage.getItem(FLOW_DRAFT_HANDOFF_STORAGE_KEY)
  if (!raw) return {} as Record<string, FlowDraftHandoffRecord>
  const parsed = JSON.parse(raw)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, FlowDraftHandoffRecord>
    : {}
}
