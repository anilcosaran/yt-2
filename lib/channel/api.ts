'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

export const CHANNELS_QUERY_KEY = ['channels'] as const
export const CHANNEL_SLOT_SELECTION_QUERY_KEY = ['channels', 'slot-selection', 'pending'] as const
export const CHANNEL_SLOT_SELECTION_CHECK_EVENT = 'youtorch:channel-slot-selection-check'

const channelStatusSchema = z.enum([
  'setup',
  'connected',
  'disconnected',
  'plan_paused',
  'removing',
  'removed',
])

const jsonTimestampSchema = z.preprocess((value) => {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value < 1e12 ? value * 1000 : value).toISOString()
  }
  return value
}, z.string())

export const brandOverlayPresetSchema = z.object({
  applyPolicy: z.enum(['off', 'default', 'required']),
  assetStorageObjectId: z.string().nullable(),
  anchor: z.enum(['auto_safe', 'top_left', 'top_center', 'top_right', 'middle_left', 'center', 'middle_right', 'bottom_left', 'bottom_center', 'bottom_right']),
  widthRatio: z.number(),
  opacity: z.number(),
  marginRatio: z.number(),
  animationMode: z.enum(['static', 'corner_cycle', 'fade_corner_cycle']),
  intervalSeconds: z.number(),
  fadeSeconds: z.number(),
})

export const channelSchema = z.object({
  id: z.string(),
  platform: z.string().catch('youtube'),
  platform_channel_id: z.string().nullable().catch(null),
  name: z.string().catch(''),
  status: channelStatusSchema.catch('setup'),
  status_before_plan_pause: channelStatusSchema.nullable().catch(null),
  settings: z.object({
    logoUrl: z.string().nullable().catch(null),
    brandOverlay: brandOverlayPresetSchema.nullable().catch(null),
    brandOverlayVersion: z.number().int().nonnegative().catch(0),
  }).catch({ logoUrl: null, brandOverlay: null, brandOverlayVersion: 0 }),
  connected_at: jsonTimestampSchema.nullable().catch(null),
  disconnected_at: jsonTimestampSchema.nullable().catch(null),
  removal_requested_at: jsonTimestampSchema.nullable().catch(null),
  removed_at: jsonTimestampSchema.nullable().catch(null),
  created_at: jsonTimestampSchema,
  updated_at: jsonTimestampSchema,
  /** P01C-13: the Connector connection of a "Google ile bağlan" channel (null for a legacy/unbound channel). */
  connector_connection: z.object({
    connection_id: z.string(),
    auth_state: z.string().nullable(),
    enabled: z.boolean().nullable(),
    health: z.string().nullable(),
    reauth_required: z.boolean(),
  }).nullable().catch(null).optional(),
}).passthrough()

export function parseChannelList(value: unknown): Channel[] {
  if (!Array.isArray(value)) return []
  const channels: Channel[] = []
  for (const item of value) {
    const parsed = channelSchema.safeParse(item)
    if (parsed.success) channels.push(parsed.data)
  }
  return channels
}

const channelResponseSchema = z.object({
  data: channelSchema,
})

const channelsResponseSchema = z.object({
  data: z.unknown().transform(parseChannelList),
})

export const channelSlotSelectionSchema = z.object({
  selection_id: z.string(),
  old_plan: z.string(),
  new_plan: z.string(),
  channel_limit: z.number(),
  selectable_limit: z.number(),
  deleting_channel_ids: z.array(z.string()).catch([]),
  candidate_channel_ids: z.array(z.string()).catch([]),
  status: z.string(),
  selected_channel_ids: z.array(z.string()).nullable().catch(null),
  source: z.string(),
  reason: z.string(),
  finalized_at: jsonTimestampSchema.nullable().catch(null),
  created_at: jsonTimestampSchema,
  updated_at: jsonTimestampSchema,
}).passthrough()

const channelBootstrapResponseSchema = z.object({
  data: z.object({
    channels: z.unknown().transform(parseChannelList),
    pending_slot_selection: channelSlotSelectionSchema.nullable().catch(null),
  }),
})

const pendingChannelSlotSelectionResponseSchema = z.object({
  data: z.object({
    selection: channelSlotSelectionSchema.nullable(),
  }),
})

const confirmChannelSlotSelectionResponseSchema = z.object({
  data: z.object({
    selection: channelSlotSelectionSchema,
    reactivated_channel_ids: z.array(z.string()).catch([]),
    paused_channel_ids: z.array(z.string()).catch([]),
    idempotent: z.boolean().catch(false),
  }),
})

export type ChannelStatus = z.infer<typeof channelStatusSchema>
export type Channel = z.infer<typeof channelSchema>
export type ChannelSlotSelection = z.infer<typeof channelSlotSelectionSchema>
export type ChannelBrandOverlayPreset = z.infer<typeof brandOverlayPresetSchema>
type GatewayRequestOptions = { signal?: AbortSignal }

export type ChannelPlanInfo = {
  planType?: string | null
  channelLimit?: number | null
}

export async function listChannels(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/channels?platform=youtube', {
    schema: channelsResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getChannelBootstrap(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/channels/bootstrap?platform=youtube', {
    schema: channelBootstrapResponseSchema,
    signal: options.signal,
  })
  return result.data
}

export async function getPendingChannelSlotSelection(options: GatewayRequestOptions = {}) {
  const result = await gatewayRequest('/api/v1/channels/slot-selection/pending', {
    schema: pendingChannelSlotSelectionResponseSchema,
    signal: options.signal,
  })
  return result.data.selection
}

export async function confirmChannelSlotSelection(input: {
  selectionId: string
  channelIds: string[]
}) {
  const result = await gatewayRequest('/api/v1/channels/slot-selection/confirm', {
    method: 'POST',
    csrf: true,
    body: {
      selection_id: input.selectionId,
      channel_ids: input.channelIds,
    },
    schema: confirmChannelSlotSelectionResponseSchema,
  })
  return result.data
}

export async function addChannel(input: {
  name: string
  platform?: string
  memoryEnabled?: boolean
}) {
  const result = await gatewayRequest('/api/v1/channels', {
    method: 'POST',
    csrf: true,
    body: {
      id: createChannelId(),
      platform: input.platform ?? 'youtube',
      name: input.name,
      memory_enabled: input.memoryEnabled ?? true,
    },
    schema: channelResponseSchema,
  })
  return result.data
}

export async function disconnectChannel(channelId: string) {
  const result = await gatewayRequest(`/api/v1/channels/${encodeURIComponent(channelId)}/disconnect`, {
    method: 'POST',
    csrf: true,
    schema: channelResponseSchema,
  })
  return result.data
}

export async function connectChannel(input: {
  channelId: string
  platformChannelId: string
  accessToken: string
  refreshToken?: string | null
  tokenExpiresAt?: string | null
}) {
  const result = await gatewayRequest(`/api/v1/channels/${encodeURIComponent(input.channelId)}/connect`, {
    method: 'POST',
    csrf: true,
    body: {
      platform_channel_id: input.platformChannelId,
      access_token: input.accessToken,
      refresh_token: input.refreshToken || null,
      token_expires_at: input.tokenExpiresAt || null,
    },
    schema: channelResponseSchema,
  })
  return result.data
}

export async function updateChannelSettings(input: {
  channelId: string
  name?: string
  logoUrl?: string | null
  brandOverlay?: ChannelBrandOverlayPreset | null
  expectedBrandOverlayVersion?: number
}) {
  const result = await gatewayRequest(`/api/v1/channels/${encodeURIComponent(input.channelId)}/settings`, {
    method: 'PUT',
    csrf: true,
    body: {
      name: input.name,
      logo_url: input.logoUrl,
      brand_overlay: input.brandOverlay === undefined ? undefined : input.brandOverlay === null ? null : {
        apply_policy: input.brandOverlay.applyPolicy,
        asset_storage_object_id: input.brandOverlay.assetStorageObjectId,
        anchor: input.brandOverlay.anchor,
        width_ratio: input.brandOverlay.widthRatio,
        opacity: input.brandOverlay.opacity,
        margin_ratio: input.brandOverlay.marginRatio,
        animation_mode: input.brandOverlay.animationMode,
        interval_seconds: input.brandOverlay.intervalSeconds,
        fade_seconds: input.brandOverlay.fadeSeconds,
      },
      expected_brand_overlay_version: input.expectedBrandOverlayVersion,
    },
    schema: channelResponseSchema,
  })
  return result.data
}

export function getChannelActionErrorMessage(error: unknown) {
  if (isAuthClientError(error)) return error.message
  if (error instanceof Error) return error.message
  return 'Kanal islemi tamamlanamadi. Lutfen tekrar deneyin.'
}

export function getChannelCreateErrorMessage(error: unknown, planInfo?: ChannelPlanInfo) {
  if (isAuthClientError(error) && error.code === 'CHANNEL_LIMIT_EXCEEDED') {
    const details = error.details && typeof error.details === 'object'
      ? error.details as Record<string, unknown>
      : {}
    const limit = getNumber(details.plan_limit) ?? planInfo?.channelLimit
    const current = getNumber(details.current_count)
    const plan = planInfo?.planType ? formatPlanName(planInfo.planType) : 'aktif planiniz'

    return [
      `${plan} kanal limiti${limit !== undefined && limit !== null ? ` ${limit}` : ''}.`,
      current !== undefined ? `Su anda ${current} kanaliniz var.` : null,
      'Yeni kanal eklemek icin plani yukseltin veya ek kapasite icin ekiple iletisime gecin.',
    ].filter(Boolean).join(' ')
  }

  if (isAuthClientError(error)) return error.message
  if (error instanceof Error) return error.message
  return 'Kanal eklenemedi. Lutfen tekrar deneyin.'
}

export function formatChannelStatus(status: ChannelStatus) {
  if (status === 'setup') return 'Kurulum gerekli'
  if (status === 'connected') return 'Bagli'
  if (status === 'disconnected') return 'Bagli degil'
  if (status === 'plan_paused') return 'Plan nedeniyle duraklatildi'
  if (status === 'removing') return 'Kaldiriliyor'
  return 'Kaldirildi'
}

function createChannelId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function getNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function formatPlanName(planType: string) {
  return `${planType.charAt(0).toUpperCase()}${planType.slice(1)} planiniz`
}
