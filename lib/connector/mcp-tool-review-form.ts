import {
  MCP_OPEN_TOOL_EFFECTS,
  type McpOpenToolEffect,
  type McpReviewTool,
  type McpToolDecision,
  type McpToolReview,
  type McpToolReviewDecisionInput,
} from './mcp-tool-review-api'

/**
 * QA-169 — the pure state of the custom MCP tool review dialog (P01C-07 rules, the server re-checks everything):
 * - one Allow / Ask / Block choice per listed tool; a media-generation estimate or a spend/admin tool can only be
 *   blocked; a removed tool has no choice;
 * - Allow/Ask need an effect (read / write / send / delete) and a Connector capability (`<namespace>.<effect>`, the
 *   namespaces come from the server's review view);
 * - a new or changed tool needs an explicit choice; an unchanged reviewed tool keeps its decision unless edited;
 * - the primary button saves the review when something is to be reviewed, then activates a test registration
 *   ("Etkinleştir"); an active one is renewed by the server after the review (QA-171), or re-granted with activate
 *   when nothing changed ("Yeniden uygula").
 */

export interface McpToolFormEntry {
  decision: McpToolDecision | null
  effect: McpOpenToolEffect | null
  namespace: string | null
}

export type McpToolReviewForm = Record<string, McpToolFormEntry>

const GATED_EFFECTS: ReadonlySet<string> = new Set(['spend', 'admin'])

function isOpenEffect(value: string | null | undefined): value is McpOpenToolEffect {
  return typeof value === 'string' && (MCP_OPEN_TOOL_EFFECTS as readonly string[]).includes(value)
}

/** The choices the owner has for one tool (server's list, narrowed to Block for gated spend/admin tools). */
export function mcpToolDecisionChoices(tool: McpReviewTool): McpToolDecision[] {
  if (tool.change === 'removed') return []
  if (tool.media_generate.estimated || (tool.reviewed && GATED_EFFECTS.has(tool.reviewed.effect))) {
    return tool.allowed_decisions.includes('block') ? ['block'] : []
  }
  return tool.allowed_decisions
}

/** A tool whose only choice is Block (media generation, spend or admin). */
export function mcpToolBlockOnly(tool: McpReviewTool): boolean {
  const choices = mcpToolDecisionChoices(tool)
  return choices.length === 1 && choices[0] === 'block'
}

function reviewedNamespace(tool: McpReviewTool, namespaces: readonly string[]): string | null {
  const key = tool.reviewed?.capability_keys[0] ?? null
  const namespace = key ? key.split('.')[0] ?? null : null
  return namespace && namespaces.includes(namespace) ? namespace : null
}

/** Prefilled from the reviewed state; a new or changed tool starts without a decision (explicit choice). */
export function initialMcpToolReviewForm(review: McpToolReview): McpToolReviewForm {
  const form: McpToolReviewForm = {}
  for (const tool of review.tools) {
    if (tool.change === 'removed') continue
    const choices = mcpToolDecisionChoices(tool)
    const reviewedDecision = tool.reviewed && choices.includes(tool.reviewed.policy) ? tool.reviewed.policy : null
    form[tool.name] = {
      decision: tool.decision_required ? (choices.length === 1 ? choices[0]! : null) : reviewedDecision,
      effect: isOpenEffect(tool.reviewed?.effect) ? tool.reviewed!.effect as McpOpenToolEffect : null,
      namespace: reviewedNamespace(tool, review.capabilityNamespaces),
    }
  }
  return form
}

export function mcpToolCapabilityKey(entry: Pick<McpToolFormEntry, 'effect' | 'namespace'>): string | null {
  return entry.effect && entry.namespace ? `${entry.namespace}.${entry.effect}` : null
}

function entryComplete(entry: McpToolFormEntry | undefined): boolean {
  if (!entry?.decision) return false
  if (entry.decision === 'block') return true
  return Boolean(entry.effect && entry.namespace)
}

/** An unchanged reviewed tool is re-sent only when the owner edited it (so its revision is reused otherwise). */
function edited(tool: McpReviewTool, entry: McpToolFormEntry): boolean {
  const reviewed = tool.reviewed
  if (!reviewed) return entry.decision !== null
  if (entry.decision !== reviewed.policy) return true
  if (entry.decision === 'block') return false
  return mcpToolCapabilityKey(entry) !== (reviewed.capability_keys[0] ?? null) || entry.effect !== reviewed.effect
}

/** The decisions the review sends: every tool that needs one, plus the reviewed tools the owner changed. */
export function mcpToolReviewDecisions(review: McpToolReview, form: McpToolReviewForm): McpToolReviewDecisionInput[] {
  const decisions: McpToolReviewDecisionInput[] = []
  for (const tool of review.tools) {
    const entry = form[tool.name]
    if (tool.change === 'removed' || !entry?.decision) continue
    if (!tool.decision_required && !edited(tool, entry)) continue
    decisions.push(entry.decision === 'block'
      ? { tool_name: tool.name, decision: 'block' }
      : { tool_name: tool.name, decision: entry.decision, effect: entry.effect, capability_keys: [mcpToolCapabilityKey(entry)!] })
  }
  return decisions
}

/** Every required choice is made and every Allow/Ask carries its effect and capability. */
export function mcpToolReviewFormComplete(review: McpToolReview, form: McpToolReviewForm): boolean {
  return review.tools.every((tool) => {
    if (tool.change === 'removed') return true
    const entry = form[tool.name]
    if (tool.decision_required) return entryComplete(entry)
    return !entry?.decision || entryComplete(entry)
  })
}

export type McpToolReviewPrimaryKind = 'activate' | 'reapply'

export interface McpToolReviewSubmitPlan {
  kind: McpToolReviewPrimaryKind
  /** The review to save first (null: nothing to review). */
  decisions: McpToolReviewDecisionInput[] | null
  /** Call activate after the review (a test registration), or instead of it (an unchanged active one). */
  activate: boolean
}

export function planMcpToolReviewSubmit(
  review: McpToolReview,
  form: McpToolReviewForm,
  status: 'draft' | 'test' | 'active' | 'disabled',
): McpToolReviewSubmitPlan | null {
  if (status !== 'test' && status !== 'active') return null
  if (!review.snapshot?.reviewable || !mcpToolReviewFormComplete(review, form)) return null
  const decisions = mcpToolReviewDecisions(review, form)
  const reviewNeeded = review.reviewRequired || decisions.length > 0
  const kind: McpToolReviewPrimaryKind = status === 'active' ? 'reapply' : 'activate'
  return {
    kind,
    decisions: reviewNeeded ? decisions : null,
    // QA-171: the server renews an active registration's grant after its review itself.
    activate: status === 'test' || !reviewNeeded,
  }
}
