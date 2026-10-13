'use client'

import { z } from 'zod'
import { gatewayRequest } from '@/lib/gateway/client'
import { channelSlotSelectionSchema, parseChannelList } from '@/lib/channel/api'
import { actionCenterItemSchema } from '@/lib/action-center/api'
import { quotaUsageDataSchema } from '@/lib/billing/api'
import { accountProfileTenantPayloadSchema } from '@/components/account/browser-account-client'

export const WORKSPACE_BOOTSTRAP_QUERY_KEY = ['workspace', 'bootstrap'] as const

const workspaceBootstrapResponseSchema = z.object({
  data: z.object({
    tenant: accountProfileTenantPayloadSchema,
    channels: z.unknown(),
    pending_slot_selection: z.unknown().nullable().optional(),
    global_alerts: z.unknown().nullable().optional(),
    quota_usage: z.unknown().nullable().optional(),
    workspace_ready: z.boolean().optional(),
    degraded_sources: z.array(z.string()).catch([]),
  }).passthrough().transform((data) => {
    const channels = parseChannelList(data.channels)
    const pending = channelSlotSelectionSchema.nullable().safeParse(data.pending_slot_selection ?? null)
    const alerts = z.array(actionCenterItemSchema).nullable().safeParse(data.global_alerts ?? null)
    const quota = quotaUsageDataSchema.nullable().safeParse(data.quota_usage ?? null)
    return {
      tenant: data.tenant,
      channels,
      pending_slot_selection: pending.success ? pending.data : null,
      global_alerts: alerts.success ? alerts.data : null,
      quota_usage: quota.success ? quota.data : null,
      workspace_ready: data.workspace_ready ?? channels.length > 0,
      degraded_sources: data.degraded_sources,
    }
  }),
})

export async function getWorkspaceBootstrap(options: { signal?: AbortSignal } = {}) {
  const result = await gatewayRequest('/api/v1/workspace/bootstrap', {
    schema: workspaceBootstrapResponseSchema,
    signal: options.signal,
  })
  return result.data
}
