import {
  getAssistantConversation,
  listAssistantConversationMessages,
  type AssistantMessage,
} from '@/lib/assistant/api'
import { registerBrowserPrincipalLifecycleResetter } from '@/lib/auth/browser-principal-storage'
import { workflowFromAssistantDraft, type WorkflowDraftPreviewSource } from '@/lib/workflows/dsl-mapper'
import type { Workflow } from '@/lib/types'

/**
 * P03-16 light view handoff for an Assistant workflow draft. The durable source is the server: the draft lives in the
 * Assistant message that proposed it, and "Open in Flows" passes only its server refs (conversation + message) in the
 * URL. Unsaved canvas edits travel in this tab's memory (client-side navigation) and are gone on reload; nothing is
 * written to browser storage. Opening never continues, launches, regenerates or schedules anything.
 */

export type AssistantDraftRef = { conversationId: string; messageId: string }

export const ASSISTANT_DRAFT_PARAMS = {
  conversation: 'assistant_conversation',
  message: 'assistant_message',
} as const

const REF_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
const MAX_MESSAGE_PAGES = 5
const LOCAL_DRAFT_PREFIX = 'wf-draft-assistant-'

const editedDrafts = new Map<string, Workflow>()
registerBrowserPrincipalLifecycleResetter(() => editedDrafts.clear())

function refKey(ref: AssistantDraftRef) {
  return `${ref.conversationId}\u0000${ref.messageId}`
}

/** Deterministic Flows local-draft id of one Assistant draft (a Flows save turns it into a real definition). */
export function assistantDraftLocalWorkflowId(ref: AssistantDraftRef): string {
  return `${LOCAL_DRAFT_PREFIX}${ref.messageId.replace(/[^A-Za-z0-9_-]/gu, '_')}`
}

export function buildAssistantDraftFlowsHref(ref: AssistantDraftRef): string {
  const params = new URLSearchParams({
    draftId: assistantDraftLocalWorkflowId(ref),
    [ASSISTANT_DRAFT_PARAMS.conversation]: ref.conversationId,
    [ASSISTANT_DRAFT_PARAMS.message]: ref.messageId,
  })
  return `/workflows?${params.toString()}`
}

export function readAssistantDraftRef(params: { get(name: string): string | null } | null | undefined): AssistantDraftRef | null {
  const conversationId = params?.get(ASSISTANT_DRAFT_PARAMS.conversation)?.trim() ?? ''
  const messageId = params?.get(ASSISTANT_DRAFT_PARAMS.message)?.trim() ?? ''
  if (!REF_ID.test(conversationId) || !REF_ID.test(messageId)) return null
  return { conversationId, messageId }
}

/** Keeps the canvas edits of this tab for the handoff (memory only; never persisted in the browser). */
export function rememberAssistantDraftEdits(ref: AssistantDraftRef, workflow: Workflow) {
  editedDrafts.set(refKey(ref), workflow)
}

export function readAssistantDraftEdits(ref: AssistantDraftRef): Workflow | null {
  return editedDrafts.get(refKey(ref)) ?? null
}

/** The draft an Assistant message proposed (same reading as the Chat card). */
export function readAssistantWorkflowDraftSource(message: AssistantMessage): WorkflowDraftPreviewSource | null {
  if (message.role !== 'assistant') return null
  const json = message.content_json
  if (json.type !== 'assistant.workflow_draft') return null
  const dslJson = json.dsl_json
  if (!dslJson || typeof dslJson !== 'object' || Array.isArray(dslJson) || Object.keys(dslJson).length === 0) return null
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  return {
    id: text(json.draft_id) ?? `${message.id}:workflow-draft`,
    goal: text(json.goal) ?? 'Workflow draft',
    status: text(json.status) ?? 'drafting',
    plannedSteps: Array.isArray(json.planned_steps) ? json.planned_steps : [],
    missingSlots: Array.isArray(json.missing_slots) ? json.missing_slots : [],
    dslJson: dslJson as Record<string, unknown>,
    estimateJson: json.estimate_json && typeof json.estimate_json === 'object' && !Array.isArray(json.estimate_json)
      ? json.estimate_json as Record<string, unknown>
      : {},
    providerStrategy: text(json.provider_strategy),
  }
}

type DraftLoaderDeps = {
  getConversation: typeof getAssistantConversation
  listMessages: typeof listAssistantConversationMessages
}

/**
 * Reads the draft from the server by its refs (bounded paging to find an older message). The tab's unsaved canvas
 * edits for the same refs win over the server copy. Null when the message is gone, not visible or not a draft.
 */
export async function loadAssistantWorkflowDraft(
  ref: AssistantDraftRef,
  deps: DraftLoaderDeps = { getConversation: getAssistantConversation, listMessages: listAssistantConversationMessages },
  options: { signal?: AbortSignal } = {},
): Promise<Workflow | null> {
  const detail = await deps.getConversation(ref.conversationId, { signal: options.signal })
  let message = detail.messages.find((item) => item.id === ref.messageId) ?? null
  let cursor = detail.next_message_cursor
  for (let page = 0; !message && cursor && page < MAX_MESSAGE_PAGES; page += 1) {
    const older = await deps.listMessages({ conversationId: ref.conversationId, before: cursor }, { signal: options.signal })
    message = older.messages.find((item) => item.id === ref.messageId) ?? null
    cursor = older.next_cursor
  }
  const source = message ? readAssistantWorkflowDraftSource(message) : null
  if (!source) return null
  const workflow = readAssistantDraftEdits(ref) ?? workflowFromAssistantDraft(source)
  return { ...workflow, id: assistantDraftLocalWorkflowId(ref) }
}
