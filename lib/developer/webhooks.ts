'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * DEV-07 Settings > Developer > Webhooks (workspace owner/admin): the webhook subscriptions of the workspace's
 * connected apps and API keys, their recent deliveries and a resend of a finished delivery; the app owner's manifest
 * signing key. Server state only: a signing secret appears once in the command response and is never stored.
 */

export const DEVELOPER_WEBHOOK_SUBSCRIPTIONS_QUERY_KEY = ['developer', 'webhooks', 'subscriptions'] as const
export const DEVELOPER_WEBHOOK_DELIVERIES_QUERY_KEY = ['developer', 'webhooks', 'deliveries'] as const

const data = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })

const subscriptionSchema = z.object({
  id: z.string(),
  origin: z.enum(['manifest', 'api']),
  url: z.string(),
  event_types: z.array(z.string()),
  status: z.enum(['active', 'disabled']),
  disabled_reason: z.string().nullable(),
  description: z.string().nullable(),
  environment: z.enum(['test', 'production']),
  principal_kind: z.enum(['developer_app', 'mcp_client', 'personal_key']),
  version: z.number().int(),
  created_at: z.string(),
}).passthrough()
export type DeveloperWebhookSubscription = z.infer<typeof subscriptionSchema>

const deliverySchema = z.object({
  id: z.string(),
  event_id: z.string(),
  event_type: z.string(),
  subscription_id: z.string(),
  resource: z.object({ kind: z.string(), id: z.string() }).nullable(),
  status: z.enum(['pending', 'delivering', 'delivered', 'dead', 'suppressed']),
  attempts: z.number().int(),
  replays: z.number().int(),
  next_attempt_at: z.string().nullable(),
  last_attempt_at: z.string().nullable(),
  last_status_code: z.number().int().nullable(),
  last_error: z.string().nullable(),
  outcome_reason: z.string().nullable(),
  delivered_at: z.string().nullable(),
  created_at: z.string(),
}).passthrough()
export type DeveloperWebhookDelivery = z.infer<typeof deliverySchema>

const issuedKeySchema = z.object({ key_id: z.string(), signing_secret: z.string(), retiring_key_id: z.string().nullable() })
export type DeveloperWebhookIssuedKey = z.infer<typeof issuedKeySchema>

export async function listDeveloperWebhookSubscriptions(options: { signal?: AbortSignal } = {}): Promise<DeveloperWebhookSubscription[]> {
  const response = await gatewayRequest('/api/v1/developer-webhooks/subscriptions', { schema: data(z.object({ items: z.array(subscriptionSchema) })), signal: options.signal })
  return response.data.items
}

export async function listDeveloperWebhookDeliveries(options: { signal?: AbortSignal } = {}): Promise<{ items: DeveloperWebhookDelivery[]; next_cursor: string | null }> {
  const response = await gatewayRequest('/api/v1/developer-webhooks/deliveries?limit=20', {
    schema: data(z.object({ items: z.array(deliverySchema), next_cursor: z.string().nullable() })),
    signal: options.signal,
  })
  return response.data
}

export async function resendDeveloperWebhookDelivery(deliveryId: string): Promise<DeveloperWebhookDelivery> {
  const response = await gatewayRequest(`/api/v1/developer-webhooks/deliveries/${encodeURIComponent(deliveryId)}/replay`, {
    method: 'POST', csrf: true, body: {}, schema: data(deliverySchema),
  })
  return response.data
}

export async function rotateDeveloperAppWebhookKey(appId: string): Promise<DeveloperWebhookIssuedKey> {
  const response = await gatewayRequest(`/api/v1/developer-webhooks/apps/${encodeURIComponent(appId)}/signing-key-rotation`, {
    method: 'POST', csrf: true, body: {}, schema: data(issuedKeySchema),
  })
  return response.data
}
