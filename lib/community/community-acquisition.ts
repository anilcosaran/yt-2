'use client'

import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-22 Community → Spark acquisition client (`/api/v1/community/acquisitions`; login only). "Projeye ekle" (`project`)
 * and "Spark'ta aç" (`new_project`) both start ONE durable server operation per click (fresh intent key): the server
 * freezes the grant, reserves the user's own storage, copies the platform rendition at original quality and attaches it
 * to the user's own project. The client only follows the operation to `ready`; the clip insert stays a separate editor
 * command. No URL of the publisher's media is ever returned and product data is never kept in browser storage.
 */
const BASE = '/api/v1/community'

export const communityAcquisitionStates = ['requested', 'reserving', 'projecting', 'copying', 'attaching', 'ready', 'failed'] as const
export type CommunityAcquisitionState = (typeof communityAcquisitionStates)[number]
export type CommunityProjectAspectRatio = '16:9' | '9:16' | '1:1'

const acquisitionSchema = z
  .object({
    schema_version: z.literal('community_acquisition_v1'),
    acquisition_id: z.string().regex(/^cacq_[0-9a-f-]{36}$/),
    post_id: z.string(),
    revision: z.number().int().min(1),
    mode: z.enum(['project', 'new_project']),
    channel_id: z.string(),
    project_id: z.string().nullable(),
    state: z.enum(communityAcquisitionStates),
    reason_code: z.string().nullable(),
    asset: z.object({ ref_type: z.literal('storage_object'), storage_object_id: z.string(), checksum_sha256: z.string() }).nullable(),
    reused_copy: z.boolean(),
    source_id: z.string().nullable(),
    capabilities: z.object({ kind: z.string(), editable: z.boolean(), native_3d: z.boolean() }),
    version: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),
    completed_at: z.string().nullable(),
  })
  .passthrough()
export type CommunityAcquisition = z.output<typeof acquisitionSchema>

const startSchema = z.object({ data: z.object({ acquisition: acquisitionSchema, created: z.boolean() }) })
const acquisitionEnvelopeSchema = z.object({ data: z.object({ acquisition: acquisitionSchema }) })

/** "Projeye ekle" targets the user's existing project; "Spark'ta aç" creates the user's own new one (own creation intent). */
export type CommunityAcquisitionTarget =
  | { kind: 'project'; projectId: string; channelId?: string }
  | { kind: 'new_project'; channelId: string; title?: string; aspectRatio?: CommunityProjectAspectRatio }

export async function startCommunityAcquisition(input: {
  postId: string
  revision: number
  target: CommunityAcquisitionTarget
  intentKey: string
  /** Required for `new_project` (its own idempotency scope, distinct from the acquisition intent). */
  creationIntentId?: string
}): Promise<{ acquisition: CommunityAcquisition; created: boolean }> {
  const { target } = input
  const body =
    target.kind === 'project'
      ? {
          post_id: input.postId,
          revision: input.revision,
          project_id: target.projectId,
          ...(target.channelId && { channel_id: target.channelId }),
          intent_key: input.intentKey,
        }
      : {
          post_id: input.postId,
          revision: input.revision,
          channel_id: target.channelId,
          new_project: {
            creation_intent_id: input.creationIntentId,
            ...(target.title?.trim() && { title: target.title.trim() }),
            ...(target.aspectRatio && { aspect_ratio: target.aspectRatio }),
          },
          intent_key: input.intentKey,
        }
  const response = await gatewayRequest(`${BASE}/acquisitions`, { method: 'POST', csrf: true, body, schema: startSchema })
  return response.data
}

export async function getCommunityAcquisition(acquisitionId: string, options: { signal?: AbortSignal } = {}): Promise<CommunityAcquisition> {
  const response = await gatewayRequest(`${BASE}/acquisitions/${encodeURIComponent(acquisitionId)}`, {
    schema: acquisitionEnvelopeSchema,
    signal: options.signal,
  })
  return response.data.acquisition
}

export type CommunityAcquisitionTransport = {
  start: typeof startCommunityAcquisition
  get: typeof getCommunityAcquisition
}

export const communityAcquisitionGatewayTransport: CommunityAcquisitionTransport = {
  start: startCommunityAcquisition,
  get: getCommunityAcquisition,
}

/** Polling of one acquisition: quick at first, then every few seconds, bounded (the server job continues anyway). */
const POLL_DELAYS_MS = [700, 1000, 1500, 2000, 3000]
const POLL_BUDGET_MS = 3 * 60_000

export type CommunityAcquisitionOutcome =
  /** The copy is in the user's storage and attached to the user's project (`source_id` is the project source). */
  | { status: 'ready'; acquisition: CommunityAcquisition }
  /** Terminal, with a safe reason code (`notice` is the localized explanation to show). */
  | { status: 'failed'; acquisition: CommunityAcquisition; notice: CommunityAcquisitionNotice }
  /** The wait budget ended; the server keeps going and the source appears in the project when it is ready. */
  | { status: 'processing'; acquisition: CommunityAcquisition; notice: CommunityAcquisitionNotice }
  /** The caller stopped following (screen closed); nothing is undone on the server. */
  | { status: 'cancelled'; acquisition: CommunityAcquisition }

export type FollowCommunityAcquisitionOptions = {
  transport?: CommunityAcquisitionTransport
  /** Injected for tests; the real wait is a timer. */
  wait?: (ms: number) => Promise<void>
  /** Monotonic-ish wall clock for the wait budget (injected in tests). */
  now?: () => number
  budgetMs?: number
  isCancelled?: () => boolean
}

/** Follows one acquisition to a terminal state (or until the wait budget ends); it never starts a second operation. */
export async function followCommunityAcquisition(
  first: CommunityAcquisition,
  options: FollowCommunityAcquisitionOptions = {},
): Promise<CommunityAcquisitionOutcome> {
  const transport = options.transport ?? communityAcquisitionGatewayTransport
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const now = options.now ?? (() => Date.now())
  const budgetMs = options.budgetMs ?? POLL_BUDGET_MS
  const started = now()
  let acquisition = first
  let attempt = 0
  while (acquisition.state !== 'ready' && acquisition.state !== 'failed') {
    if (options.isCancelled?.()) return { status: 'cancelled', acquisition }
    if (now() - started > budgetMs) return { status: 'processing', acquisition, notice: { kind: 'stillProcessing' } }
    await wait(POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)]!)
    attempt += 1
    if (options.isCancelled?.()) return { status: 'cancelled', acquisition }
    acquisition = await transport.get(acquisition.acquisition_id)
  }
  if (acquisition.state === 'failed') return { status: 'failed', acquisition, notice: communityAcquisitionFailureNotice(acquisition) }
  return { status: 'ready', acquisition }
}

export type AcquireCommunityMediaOptions = FollowCommunityAcquisitionOptions & {
  postId: string
  revision: number
  target: CommunityAcquisitionTarget
  /** Fresh ids per click (tests inject fixed ones). */
  createId?: () => string
  /** Called once with the accepted operation so a screen can show its progress state. */
  onAccepted?: (acquisition: CommunityAcquisition) => void
}

/**
 * One click: start the durable operation (fresh intent per click; a replay of the same intent would answer the same
 * operation) and follow it. Transport errors are thrown as they are (`communityAcquisitionNotice` explains them).
 */
export async function acquireCommunityMedia(options: AcquireCommunityMediaOptions): Promise<CommunityAcquisitionOutcome> {
  const transport = options.transport ?? communityAcquisitionGatewayTransport
  const createId = options.createId ?? (() => crypto.randomUUID())
  const { acquisition } = await transport.start({
    postId: options.postId,
    revision: options.revision,
    target: options.target,
    intentKey: `community:${createId()}`,
    ...(options.target.kind === 'new_project' && { creationIntentId: createId() }),
  })
  options.onAccepted?.(acquisition)
  return followCommunityAcquisition(acquisition, options)
}

/** Explanations of a reuse that cannot proceed (everything else keeps the caller's generic handling). */
export type CommunityAcquisitionNotice =
  | { kind: 'reuseNotAllowed'; reason: 'license_unsupported' | 'project_use_not_granted' | 'unsupported_media_type' | 'size_limit_exceeded' }
  | { kind: 'targetUnavailable'; target: 'project' | 'channel' }
  | { kind: 'sourceUnavailable' }
  | { kind: 'unavailable' }
  | { kind: 'changed' }
  | { kind: 'limit'; retryAfterSeconds: number }
  | { kind: 'storageFull' }
  | { kind: 'purchaseRequired'; priceCredits: number }
  | { kind: 'stillProcessing' }
  | { kind: 'failed' }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

const REUSE_REASONS = new Set(['license_unsupported', 'project_use_not_granted', 'unsupported_media_type', 'size_limit_exceeded'])

/** The failed operation's safe reason code as a notice (the code itself is never shown). */
export function communityAcquisitionFailureNotice(acquisition: Pick<CommunityAcquisition, 'reason_code'>): CommunityAcquisitionNotice {
  switch (acquisition.reason_code) {
    case 'storage_quota_exceeded':
      return { kind: 'storageFull' }
    case 'publication_unavailable':
      return { kind: 'unavailable' }
    case 'revision_changed':
      return { kind: 'changed' }
    case 'project_unavailable':
      return { kind: 'targetUnavailable', target: 'project' }
    case 'channel_unavailable':
      return { kind: 'targetUnavailable', target: 'channel' }
    case 'unsupported_media_type':
      return { kind: 'reuseNotAllowed', reason: 'unsupported_media_type' }
    case 'size_limit_exceeded':
      return { kind: 'reuseNotAllowed', reason: 'size_limit_exceeded' }
    default:
      return { kind: 'failed' }
  }
}

/** A start/get request error as a notice, or `null` when the caller's generic handling should apply. */
export function communityAcquisitionNotice(error: unknown): CommunityAcquisitionNotice | null {
  if (!isAuthClientError(error)) return null
  const details = record(error.details)
  switch (error.code) {
    case 'COMMUNITY_REUSE_NOT_ALLOWED': {
      const reason = String(details?.['reason'] ?? '')
      return { kind: 'reuseNotAllowed', reason: (REUSE_REASONS.has(reason) ? reason : 'project_use_not_granted') as never }
    }
    case 'COMMUNITY_ACQUISITION_TARGET_UNAVAILABLE':
      return { kind: 'targetUnavailable', target: details?.['target'] === 'channel' ? 'channel' : 'project' }
    case 'COMMUNITY_ACQUISITION_SOURCE_UNAVAILABLE':
      return { kind: 'sourceUnavailable' }
    case 'COMMUNITY_ACQUISITION_LIMIT':
      return { kind: 'limit', retryAfterSeconds: Math.max(1, Number(details?.['retry_after_seconds']) || 30) }
    case 'COMMUNITY_REVISION_CHANGED':
      return { kind: 'changed' }
    // P06-24: a priced item needs a purchase first (the marketplace client explains and starts it).
    case 'COMMUNITY_PURCHASE_REQUIRED':
      return { kind: 'purchaseRequired', priceCredits: Math.max(1, Number(details?.['price_credits']) || 1) }
    case 'COMMUNITY_POST_NOT_FOUND':
    case 'COMMUNITY_UNAVAILABLE':
      return { kind: 'unavailable' }
    default:
      return null
  }
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/** The notice text from the `Community.acquisition` messages (no technical code ever reaches the user). */
export function communityAcquisitionMessage(notice: CommunityAcquisitionNotice, t: Translate): string {
  switch (notice.kind) {
    case 'reuseNotAllowed':
      return t(`reuseReasons.${notice.reason}`)
    case 'targetUnavailable':
      return t(`targetUnavailable.${notice.target}`)
    case 'sourceUnavailable':
      return t('sourceUnavailable')
    case 'unavailable':
      return t('unavailable')
    case 'changed':
      return t('changed')
    case 'limit':
      return t('limit', { seconds: notice.retryAfterSeconds })
    case 'storageFull':
      return t('storageFull')
    case 'purchaseRequired':
      return t('purchaseRequired', { price: notice.priceCredits })
    case 'stillProcessing':
      return t('stillProcessing')
    case 'failed':
      return t('failed')
  }
}

/** The short label of an operation's step (the step names are the server's states). */
export function communityAcquisitionProgressMessage(state: CommunityAcquisitionState, t: Translate): string {
  return t(`progress.${state}`)
}
