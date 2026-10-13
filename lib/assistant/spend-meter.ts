import type { AssistantSpendMeter, AssistantSpendReceipt } from './spend-meter-api'

/**
 * Yol 1 / Y1-02: what the chat meter chip and the per-turn receipt line show, as pure projections of the server data
 * (nothing is computed from prices or balances in the browser). Credits are plain numbers; 1 credit = GBP 0.01.
 */

type Mode = 'ask' | 'auto' | 'auto_full'

export type SpendMeterChipModel = {
  /** attention: an approval waits or the job used most of its approved ceiling; blocked: the balance does not cover it. */
  tone: 'normal' | 'attention' | 'blocked'
  /** The mode the numbers belong to: the running job's mode, else the conversation's. */
  mode: Mode | null
  /** The shown job (not closed); null when no job is running or waiting. */
  job: {
    runId: string
    /** settled + dispatched-not-settled */
    committed: number
    ceiling: number | null
    remaining: number
    state: 'no_spend' | 'within_ceiling' | 'awaiting_approval' | 'funding_required'
    pendingApprovalMax: number | null
  } | null
  balance: number
  planCredits: number
  /** The Auto ask point T for this user; the popover shows it in Auto mode only. */
  autoAskAt: number | null
  jobCap: { credits: number; source: 'tenant' | 'user' | null } | null
}

/** Share of the approved ceiling from which the chip turns to "attention". */
export const SPEND_METER_ATTENTION_RATIO = 0.9

export function buildSpendMeterChipModel(meter: AssistantSpendMeter | null | undefined, conversationMode: Mode | null): SpendMeterChipModel | null {
  if (!meter || meter.enforcement !== 'job_spend_envelope' || !meter.balance) return null
  const active = meter.job && meter.job.envelope_status !== 'closed' && meter.job.state !== 'closed' ? meter.job : null
  const job: SpendMeterChipModel['job'] = active
    ? {
      runId: active.run_id,
      committed: roundCredits(active.spent_credits + active.outstanding_credits),
      ceiling: active.approved_ceiling_credits,
      remaining: active.remaining_credits,
      state: active.state === 'closed' ? 'no_spend' : active.state,
      pendingApprovalMax: active.pending_approval?.requested_max_credits ?? null,
    }
    : null
  let tone: SpendMeterChipModel['tone'] = 'normal'
  if (job?.state === 'funding_required') tone = 'blocked'
  else if (job?.state === 'awaiting_approval') tone = 'attention'
  else if (job && job.ceiling !== null && job.ceiling > 0 && job.committed / job.ceiling >= SPEND_METER_ATTENTION_RATIO) tone = 'attention'
  return {
    tone,
    mode: active?.mode ?? conversationMode,
    job,
    balance: meter.balance.spendable_credits,
    planCredits: meter.balance.plan_credits,
    autoAskAt: meter.threshold?.auto_ask_at_credits ?? null,
    jobCap: meter.job_cap.credits !== null ? { credits: meter.job_cap.credits, source: meter.job_cap.source } : null,
  }
}

/** P7/3: one Workflow node of a receipt kind (lines of the same node type merged, in receipt order). */
export type SpendReceiptNodePart = {
  /** `speech_generate`: the UI localizes the name with it; null when the server could not name the type. */
  baseType: string | null
  /** The server's English name, shown when there is no translation. */
  name: string
  credits: number
}

export type SpendReceiptPart = {
  kind: 'planning' | 'preparation' | 'production'
  credits: number
  /** The named nodes of the kind; their sum can be below `credits` when some lines are not named. */
  nodes: SpendReceiptNodePart[]
}

export type SpendReceiptModel = {
  /** false: the turn still runs and the total is a running one. */
  final: boolean
  total: number
  balanceAfter: number | null
  /** Credits per kind, in the order planning, preparation, production; kinds without cost are left out. */
  parts: SpendReceiptPart[]
  /**
   * P7/3: what paid for the turn — plan quota pools, plan credits, top-up credits — and what the ledger has not
   * settled yet. Null when the server did not say (older gateway, or the payment sources could not be read).
   */
  funding: { quota: number; plan: number; topUp: number; pending: number } | null
}

const RECEIPT_KIND_ORDER = ['planning', 'preparation', 'production'] as const

/** Null when the turn had no paid work (nothing to show). */
export function buildSpendReceiptModel(receipt: AssistantSpendReceipt | null | undefined): SpendReceiptModel | null {
  if (!receipt || receipt.envelope_id === null) return null
  const total = roundCredits(receipt.spent_credits + receipt.outstanding_credits)
  if (!(total > 0)) return null
  const byKind = new Map<string, number>()
  const nodesByKind = new Map<string, Map<string, SpendReceiptNodePart>>()
  for (const line of receipt.lines) {
    if (line.status === 'released') continue
    byKind.set(line.kind, (byKind.get(line.kind) ?? 0) + line.credits)
    if (!line.node || line.kind === 'planning' || !(line.credits > 0)) continue
    const nodes = nodesByKind.get(line.kind) ?? new Map<string, SpendReceiptNodePart>()
    const key = line.node.node_base_type ?? `name:${line.node.name}`
    const current = nodes.get(key)
    nodes.set(key, current
      ? { ...current, credits: current.credits + line.credits }
      : { baseType: line.node.node_base_type, name: line.node.name, credits: line.credits })
    nodesByKind.set(line.kind, nodes)
  }
  const parts = RECEIPT_KIND_ORDER
    .map((kind) => ({
      kind,
      credits: roundCredits(byKind.get(kind) ?? 0),
      nodes: [...(nodesByKind.get(kind)?.values() ?? [])].map((node) => ({ ...node, credits: roundCredits(node.credits) })),
    }))
    .filter((part) => part.credits > 0)
  const funding = receipt.funding
    ? {
      quota: roundCredits(receipt.funding.quota_credits),
      plan: roundCredits(receipt.funding.plan_credits),
      topUp: roundCredits(receipt.funding.top_up_credits),
      pending: roundCredits(receipt.funding.unattributed_credits),
    }
    : null
  return { final: receipt.final, total, balanceAfter: receipt.balance_after_credits, parts, funding }
}

/**
 * Y1R-MONEY-8: only a FINAL receipt is cached for good. A turn that ended while a sent clip is still rendering has a
 * receipt that is a running total (the clip is its allocated estimate); it keeps being read, slowly and for a bounded
 * time, until the server says it is final with the settled amount.
 */
export const RECEIPT_RUNNING_STALE_MS = 10_000
export const RECEIPT_POLL_WHILE_RUNNING_MS = 5_000
export const RECEIPT_POLL_WHILE_DRAINING_MS = 15_000
/** About 15 minutes of slow reads after the run ended; beyond that the next page load reads it again. */
export const RECEIPT_MAX_DRAINING_READS = 60

export function receiptStaleTimeMs(final: boolean | undefined): number {
  return final ? Number.POSITIVE_INFINITY : RECEIPT_RUNNING_STALE_MS
}

export function receiptRefetchIntervalMs(input: { final: boolean | undefined; runActive: boolean; reads: number }): number | false {
  if (input.final) return false
  if (input.runActive) return RECEIPT_POLL_WHILE_RUNNING_MS
  return input.reads < RECEIPT_MAX_DRAINING_READS ? RECEIPT_POLL_WHILE_DRAINING_MS : false
}

/** At most this many of the latest turns of a conversation get a receipt line (and a receipt read). */
export const SPEND_RECEIPT_MAX_TURNS = 8

/**
 * The messages that end a turn and carry its receipt line: the last visible assistant message of each of the latest
 * runs. `isControl` marks approval / question messages, which do not end a turn.
 */
export function selectReceiptMessageIds<T extends { id: string; role: string; run_id: string | null }>(
  messages: ReadonlyArray<T>,
  isControl: (message: T) => boolean,
  maxTurns = SPEND_RECEIPT_MAX_TURNS,
): Map<string, string> {
  const lastByRun = new Map<string, string>()
  for (const message of messages) {
    if (message.role !== 'assistant' || !message.run_id || isControl(message)) continue
    lastByRun.set(message.run_id, message.id)
  }
  const recent = [...lastByRun.entries()].slice(-maxTurns)
  return new Map(recent.map(([runId, messageId]) => [messageId, runId]))
}

function roundCredits(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
