import { z } from 'zod'

/**
 * GEN-04: a long media node (avatar_generate, video_generate) stores its result in Storage before the node finishes
 * (catalog completion and provider settlement still run). The gateway reports it per status node as `outputReady`
 * (`storageObjectId`, `readyAt`, `mediaKind`); the UI shows that stored object at once as "ready, finishing up" through
 * the existing Storage preview/delivery helpers. The run-level LAT-01 `outputReady` / `artifactDelivery` are unchanged
 * (every output committed). Absent on older gateways or with the engine switch off; never removed once reported (B5).
 */
export const workflowNodeOutputReadySchema = z.object({
  storageObjectId: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/),
  readyAt: z.string().min(1),
  mediaKind: z.enum(['video', 'image', 'audio']),
}).strip()

export type WorkflowNodeOutputReady = z.infer<typeof workflowNodeOutputReadySchema>

/** Zod field for a status node: an invalid value degrades to "no early output", never to a parse failure. */
export const workflowNodeOutputReadyField = workflowNodeOutputReadySchema.nullable().optional().catch(undefined)

export interface EarlyNodeOutput extends WorkflowNodeOutputReady {
  nodeKey: string
  nodeType: string
}

type EarlyOutputStatusInput = {
  status?: string | null
  deliveryStatus?: string | null
  pausedReason?: string | null
  nodes?: ReadonlyArray<{
    nodeKey: string
    nodeType: string
    outputReady?: WorkflowNodeOutputReady | null
  }> | null
} | null | undefined

/**
 * The stored result to show early, or null. A payment-review hold fences every output, so nothing is shown then.
 * With several stored nodes the most recently stored one wins (the latest media in the run).
 */
export function findEarlyNodeOutput(status: EarlyOutputStatusInput): EarlyNodeOutput | null {
  if (!status) return null
  if (status.deliveryStatus === 'payment_review' || status.pausedReason === 'payment_risk_pending') return null
  let latest: EarlyNodeOutput | null = null
  let latestAt = Number.NEGATIVE_INFINITY
  for (const node of status.nodes ?? []) {
    const ready = node.outputReady
    if (!ready) continue
    const readyAtMs = Date.parse(ready.readyAt)
    const order = Number.isFinite(readyAtMs) ? readyAtMs : Number.NEGATIVE_INFINITY
    if (latest === null || order >= latestAt) {
      latest = { ...ready, nodeKey: node.nodeKey, nodeType: node.nodeType }
      latestAt = order
    }
  }
  return latest
}

/**
 * "Ready, finishing up": a stored result exists while the run has not reached its public `completed` state (it is
 * still running, settling or closing its output handoff). Once the run completes the normal output path takes over.
 */
export function isEarlyOutputFinishing(status: EarlyOutputStatusInput, early: EarlyNodeOutput | null = findEarlyNodeOutput(status)) {
  if (!early) return false
  const normalized = status?.status?.trim().toLowerCase()
  return normalized !== 'completed' && normalized !== 'success' && normalized !== 'succeeded'
}
