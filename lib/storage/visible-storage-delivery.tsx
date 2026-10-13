'use client'

import * as React from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  fetchStorageDeliveryUrlsInChunks,
  storageDeliveryRefreshDelay,
  type DeliveryUrlsBatchResult,
  type StorageObjectItem,
} from '@/lib/storage/api'
import {
  isStorageGifPreview,
  isStorageOriginalImagePreviewFallbackEligible,
  isStorageOriginalWithinPreviewBudget,
  storageThumbnailQueryKey,
} from '@/lib/storage/use-storage-thumbnail-url'

export type VisibleStorageDeliveryItem = DeliveryUrlsBatchResult['items'][number]

export type VisibleStorageDeliveryPlanItem = {
  objectId: string
  variant: 'original' | 'thumbnail'
  expiresInSeconds: 3600
  revision: string
  allowOriginalFallback?: boolean
}

export type VisibleDeliveryCacheEntry = {
  revision: string
  variant: 'original' | 'thumbnail'
  value: VisibleStorageDeliveryItem
  notReadyAttempts: number
  remintFrozenUntilMs?: number
  terminalForRevision?: boolean
  previewRecoveryAttempts?: number
  forceRemint?: boolean
}

type VisibleStorageDeliveryContextValue = {
  byObjectId: Map<string, VisibleStorageDeliveryItem>
  isPending: boolean
  isFetching: boolean
  retryPreview: (objectId: string, failedUrl: string) => void
}

const VISIBLE_DELIVERY_QUERY_PREFIX = 'visible-delivery-urls'
const STORAGE_DELIVERY_REMIND_SKEW_MS = 5 * 60_000
export const STORAGE_DELIVERY_NOT_READY_RETRY_MS = 15_000
export const STORAGE_DELIVERY_NOT_READY_RETRY_CAP = 8
export const STORAGE_DELIVERY_SLOW_RETRY_MS = 5 * 60_000
export const STORAGE_DELIVERY_RATE_LIMIT_COOLDOWN_MS = 60_000

function isRecoverableDeliveryError(code: string) {
  return code === 'STORAGE_DELIVERY_NOT_READY' || code === 'STORAGE_THUMBNAIL_NOT_AVAILABLE'
}

/** Admission answers (I/O cap, P02-14 backpressure): cool down, then remint; never terminal. */
function isDeliveryCooldownError(code: string) {
  return code === 'STORAGE_IO_LIMIT_EXCEEDED' || code === 'STORAGE_DELIVERY_BACKPRESSURE'
}

const VisibleStorageDeliveryContext = React.createContext<VisibleStorageDeliveryContextValue | null>(null)

export function isVisibleStorageThumbnailCandidate(item: Pick<StorageObjectItem, 'type' | 'status' | 'mime_type'>) {
  const mimeType = item.mime_type?.trim().toLowerCase() ?? ''
  return item.type === 'file'
    && (item.status === 'active' || item.status === 'processing')
    && (mimeType.startsWith('image/') || mimeType.startsWith('video/'))
}

export function planVisibleStorageDeliveryItem(
  item: Pick<StorageObjectItem, 'id' | 'type' | 'status' | 'mime_type' | 'extension' | 'name' | 'size_bytes' | 'updated_at'>,
): VisibleStorageDeliveryPlanItem | null {
  if (!isVisibleStorageThumbnailCandidate(item)) return null

  const mimeType = item.mime_type?.trim().toLowerCase() ?? ''
  const gif = isStorageGifPreview({
    mimeType: item.mime_type,
    extension: item.extension,
    name: item.name,
  })
  // P02-14 (K140/K158): a grid never decodes an original above the preview budget. Small GIFs
  // keep their animation; larger GIFs and images use the derivative, and a missing derivative
  // shows the placeholder instead of an unbounded original fallback.
  const withinPreviewBudget = isStorageOriginalWithinPreviewBudget({ sizeBytes: item.size_bytes })
  const originalEligible = (gif && withinPreviewBudget) || isStorageOriginalImagePreviewFallbackEligible({
    mimeType: item.mime_type,
    sizeBytes: item.size_bytes,
  })

  return {
    objectId: item.id,
    variant: originalEligible ? 'original' : 'thumbnail',
    expiresInSeconds: 3_600,
    revision: `${item.status}:${item.updated_at}`,
    allowOriginalFallback: !originalEligible && mimeType.startsWith('image/') && withinPreviewBudget,
  }
}

function deliveryModeForPlan(item: VisibleStorageDeliveryPlanItem) {
  return item.variant === 'original' ? 'original-delivery' as const : 'thumbnail-only' as const
}

function perObjectThumbnailQueryKey(channelId: string, item: VisibleStorageDeliveryPlanItem) {
  return storageThumbnailQueryKey({
    channelId,
    objectId: item.objectId,
    revision: item.revision,
    preferOriginalDelivery: item.variant === 'original',
    allowOriginalImageFallback: item.variant === 'original',
  })
}

export function isUsableCachedDeliveryItem(
  value: VisibleStorageDeliveryItem | undefined,
  nowMs = Date.now(),
) {
  if (!value || value.status !== 'ok') return false
  const expiresAt = Date.parse(value.expires_at)
  if (!Number.isFinite(expiresAt)) return false
  return expiresAt - nowMs > STORAGE_DELIVERY_REMIND_SKEW_MS
}

export function isVisibleDeliveryCacheEntry(value: unknown): value is VisibleDeliveryCacheEntry {
  return Boolean(
    value
    && typeof value === 'object'
    && 'revision' in value
    && 'variant' in value
    && 'value' in value
    && 'notReadyAttempts' in value,
  )
}

export function isMatchingCachedDeliveryEntry(
  entry: VisibleDeliveryCacheEntry | undefined,
  plan: VisibleStorageDeliveryPlanItem,
): entry is VisibleDeliveryCacheEntry {
  return Boolean(entry && entry.revision === plan.revision && entry.variant === plan.variant)
}

export function isDeliveryRemintFrozen(
  entry: VisibleDeliveryCacheEntry | undefined,
  nowMs = Date.now(),
) {
  return Boolean(entry?.remintFrozenUntilMs && entry.remintFrozenUntilMs > nowMs)
}

export function shouldMintVisibleDeliveryItem(
  entry: VisibleDeliveryCacheEntry | undefined,
  plan: VisibleStorageDeliveryPlanItem,
  nowMs = Date.now(),
) {
  if (!isMatchingCachedDeliveryEntry(entry, plan)) return true
  if (entry.forceRemint) return true
  if (entry.terminalForRevision
    && !(entry.value.status === 'error' && isRecoverableDeliveryError(entry.value.error.code))) return false
  if (isDeliveryRemintFrozen(entry, nowMs)) return false
  if (entry.value.status === 'ok') return !isUsableCachedDeliveryItem(entry.value, nowMs)
  return isRecoverableDeliveryError(entry.value.error.code)
    || isDeliveryCooldownError(entry.value.error.code)
}

export function partitionVisibleDeliveryPlan(input: {
  plan: VisibleStorageDeliveryPlanItem[]
  lookup: Map<string, VisibleDeliveryCacheEntry>
  nowMs?: number
}) {
  const nowMs = input.nowMs ?? Date.now()
  const reuse = new Map<string, VisibleDeliveryCacheEntry>()
  const missing: VisibleStorageDeliveryPlanItem[] = []

  for (const item of input.plan) {
    const entry = input.lookup.get(item.objectId)
    if (!shouldMintVisibleDeliveryItem(entry, item, nowMs) && entry) {
      reuse.set(item.objectId, entry)
      continue
    }
    missing.push(item)
  }

  return { reuse, missing }
}

export function createVisibleDeliveryCacheEntry(
  plan: VisibleStorageDeliveryPlanItem,
  value: VisibleStorageDeliveryItem,
  previous: VisibleDeliveryCacheEntry | undefined,
  nowMs = Date.now(),
): VisibleDeliveryCacheEntry {
  const recoverable = value.status === 'error' && isRecoverableDeliveryError(value.error.code)
  const rateLimited = value.status === 'error' && isDeliveryCooldownError(value.error.code)
  const notReadyAttempts = recoverable
    ? (isMatchingCachedDeliveryEntry(previous, plan) ? previous.notReadyAttempts + 1 : 1)
    : 0
  return {
    revision: plan.revision,
    variant: plan.variant,
    value,
    notReadyAttempts,
    remintFrozenUntilMs: rateLimited
      ? nowMs + STORAGE_DELIVERY_RATE_LIMIT_COOLDOWN_MS
      : notReadyAttempts >= STORAGE_DELIVERY_NOT_READY_RETRY_CAP
        ? nowMs + STORAGE_DELIVERY_SLOW_RETRY_MS
        : undefined,
    previewRecoveryAttempts: isMatchingCachedDeliveryEntry(previous, plan)
      ? previous.previewRecoveryAttempts
      : 0,
    terminalForRevision: value.status === 'error' && !recoverable && !rateLimited,
  }
}

export function visibleDeliveryRefetchInterval(input: {
  plan: VisibleStorageDeliveryPlanItem[]
  data: Map<string, VisibleDeliveryCacheEntry> | undefined
  error: unknown
  nowMs?: number
}): number | false {
  if (input.error) return false
  const nowMs = input.nowMs ?? Date.now()
  let retryNotReady = false
  let earliestFrozenUntilMs: number | undefined
  const okItems: VisibleStorageDeliveryItem[] = []

  for (const planItem of input.plan) {
    const entry = input.data?.get(planItem.objectId)
    if (!entry || !isMatchingCachedDeliveryEntry(entry, planItem)) continue
    if (isDeliveryRemintFrozen(entry, nowMs)) {
      earliestFrozenUntilMs = earliestFrozenUntilMs === undefined
        ? entry.remintFrozenUntilMs
        : Math.min(earliestFrozenUntilMs, entry.remintFrozenUntilMs!)
      continue
    }
    if (entry.terminalForRevision
      && !(entry.value.status === 'error' && isRecoverableDeliveryError(entry.value.error.code))) continue
    if (entry.value.status === 'ok') {
      okItems.push(entry.value)
      continue
    }
    if (isRecoverableDeliveryError(entry.value.error.code)
      || isDeliveryCooldownError(entry.value.error.code)) {
      retryNotReady = true
    }
  }

  if (retryNotReady) return STORAGE_DELIVERY_NOT_READY_RETRY_MS
  if (earliestFrozenUntilMs !== undefined) return Math.max(1_000, earliestFrozenUntilMs - nowMs)
  return storageDeliveryRefreshDelay(okItems, nowMs)
}

export function shouldRemintVisibleDeliveryOnFocus(input: {
  plan: VisibleStorageDeliveryPlanItem[]
  data: Map<string, VisibleDeliveryCacheEntry> | undefined
  error: unknown
  nowMs?: number
}) {
  if (input.error || !input.data) return false
  const nowMs = input.nowMs ?? Date.now()
  return input.plan.some((planItem) => {
    const entry = input.data!.get(planItem.objectId)
    return isMatchingCachedDeliveryEntry(entry, planItem)
      && (!entry.terminalForRevision
        || (entry.value.status === 'error' && isRecoverableDeliveryError(entry.value.error.code)))
      && !isDeliveryRemintFrozen(entry, nowMs)
      && (entry.value.status === 'ok'
        ? !isUsableCachedDeliveryItem(entry.value, nowMs)
        : isRecoverableDeliveryError(entry.value.error.code)
          || isDeliveryCooldownError(entry.value.error.code))
  })
}

function visibleDeliveryItemsByObjectId(
  data: Map<string, VisibleDeliveryCacheEntry> | undefined,
) {
  const byObjectId = new Map<string, VisibleStorageDeliveryItem>()
  if (!data) return byObjectId
  for (const [objectId, entry] of data) byObjectId.set(objectId, entry.value)
  return byObjectId
}

function collectPreviousDeliveryEntries(
  queryClient: QueryClient,
  channelId: string,
) {
  const byObjectId = new Map<string, VisibleDeliveryCacheEntry>()
  for (const [, data] of queryClient.getQueriesData<Map<string, VisibleDeliveryCacheEntry>>({
    queryKey: ['storage', VISIBLE_DELIVERY_QUERY_PREFIX, channelId],
  })) {
    if (!data) continue
    for (const [objectId, entry] of data) {
      if (!isVisibleDeliveryCacheEntry(entry)) continue
      byObjectId.set(objectId, entry)
    }
  }
  return byObjectId
}

function writeCachedDeliveryItem(
  queryClient: QueryClient,
  channelId: string,
  item: VisibleStorageDeliveryPlanItem,
  value: VisibleStorageDeliveryItem,
) {
  if (value.status !== 'ok') return
  queryClient.setQueryData(perObjectThumbnailQueryKey(channelId, item), value)
}

function getHttpStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = Number((error as { status: unknown }).status)
  return Number.isFinite(status) ? status : null
}

function isAbortError(error: unknown) {
  return (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError')
}

export async function buildVisibleStorageDeliveryMap(input: {
  channelId: string
  plan: VisibleStorageDeliveryPlanItem[]
  lookup: Map<string, VisibleDeliveryCacheEntry>
  signal?: AbortSignal
  nowMs?: number
  persistChunk?: (next: Map<string, VisibleDeliveryCacheEntry>) => void
  onOkItem?: (item: VisibleStorageDeliveryPlanItem, value: VisibleStorageDeliveryItem) => void
}) {
  const nowMs = input.nowMs ?? Date.now()
  const { reuse, missing } = partitionVisibleDeliveryPlan({
    plan: input.plan,
    lookup: input.lookup,
    nowMs,
  })
  const next = new Map(reuse)
  for (const item of missing) {
    const previous = input.lookup.get(item.objectId)
    if (previous?.value.status === 'ok') next.set(item.objectId, previous)
  }
  input.persistChunk?.(new Map(next))

  if (missing.length === 0) return next

  const missingById = new Map(missing.map((item) => [item.objectId, item] as const))
  const committedThisFetch = new Set<string>()
  const persist = () => input.persistChunk?.(new Map(next))

  const commit = (planItem: VisibleStorageDeliveryPlanItem, value: VisibleStorageDeliveryItem) => {
    committedThisFetch.add(planItem.objectId)
    const entry = createVisibleDeliveryCacheEntry(
      planItem,
      value,
      next.get(planItem.objectId) ?? input.lookup.get(planItem.objectId),
      nowMs,
    )
    next.set(planItem.objectId, entry)
    if (value.status === 'ok') input.onOkItem?.(planItem, value)
    persist()
  }

  const retainDisplay = (
    planItem: VisibleStorageDeliveryPlanItem,
    extra: Pick<VisibleDeliveryCacheEntry, 'notReadyAttempts' | 'remintFrozenUntilMs' | 'terminalForRevision'>,
  ) => {
    const current = next.get(planItem.objectId) ?? input.lookup.get(planItem.objectId)
    if (current?.value.status !== 'ok') return false
    next.set(planItem.objectId, {
      revision: planItem.revision,
      variant: planItem.variant,
      value: current.value,
      notReadyAttempts: extra.notReadyAttempts,
      previewRecoveryAttempts: current.previewRecoveryAttempts,
      remintFrozenUntilMs: extra.remintFrozenUntilMs,
      terminalForRevision: extra.terminalForRevision,
    })
    persist()
    return true
  }

  try {
    await fetchStorageDeliveryUrlsInChunks({
      channelId: input.channelId,
      items: missing.map((item) => ({
        objectId: item.objectId,
        variant: item.variant,
        expiresInSeconds: item.expiresInSeconds,
        purpose: 'grid' as const,
      })),
      signal: input.signal,
      onChunk: (items) => {
        for (const value of items) {
          const planItem = missingById.get(value.object_id)
          if (!planItem) continue
          commit(planItem, value)
        }
      },
    })

    const originalFallback = missing.filter((planItem) => {
      if (!planItem.allowOriginalFallback || planItem.variant === 'original') return false
      if (!committedThisFetch.has(planItem.objectId)) return true
      const entry = next.get(planItem.objectId)
      if (!entry || entry.value.status !== 'error') return false
      return entry.value.error.code === 'STORAGE_DELIVERY_NOT_READY'
        || entry.value.error.code === 'STORAGE_THUMBNAIL_NOT_AVAILABLE'
    })
    if (originalFallback.length > 0) {
      const fallbackById = new Map(originalFallback.map((item) => [item.objectId, item] as const))
      await fetchStorageDeliveryUrlsInChunks({
        channelId: input.channelId,
        items: originalFallback.map((item) => ({
          objectId: item.objectId,
          variant: 'original',
          expiresInSeconds: item.expiresInSeconds,
          purpose: 'grid' as const,
        })),
        signal: input.signal,
        onChunk: (items) => {
          for (const value of items) {
            const planItem = fallbackById.get(value.object_id)
            if (!planItem || value.status !== 'ok') continue
            commit(planItem, value)
          }
        },
      })
    }

    for (const planItem of missing) {
      if (committedThisFetch.has(planItem.objectId)) continue
      if (retainDisplay(planItem, {
        notReadyAttempts: 0,
        terminalForRevision: true,
      })) continue
      commit(planItem, {
        object_id: planItem.objectId,
        status: 'error',
        error: {
          code: 'STORAGE_THUMBNAIL_NOT_AVAILABLE',
          message: 'Storage delivery omitted this object.',
        },
      })
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    const status = getHttpStatus(error)
    if (status === 429 || (status !== null && status >= 400 && status < 500)) {
      const frozenUntil = nowMs + STORAGE_DELIVERY_RATE_LIMIT_COOLDOWN_MS
      for (const planItem of missing) {
        if (committedThisFetch.has(planItem.objectId)) continue
        if (retainDisplay(planItem, {
          notReadyAttempts: STORAGE_DELIVERY_NOT_READY_RETRY_CAP,
          remintFrozenUntilMs: frozenUntil,
        })) continue
        next.set(planItem.objectId, {
          revision: planItem.revision,
          variant: planItem.variant,
          value: {
            object_id: planItem.objectId,
            status: 'error',
            error: {
              code: 'STORAGE_IO_LIMIT_EXCEEDED',
              message: 'Storage delivery rate limited.',
            },
          },
          notReadyAttempts: STORAGE_DELIVERY_NOT_READY_RETRY_CAP,
          remintFrozenUntilMs: frozenUntil,
        })
        persist()
      }
      return next
    }
    for (const planItem of missing) {
      if (committedThisFetch.has(planItem.objectId)) continue
      const previous = next.get(planItem.objectId) ?? input.lookup.get(planItem.objectId)
      const attempts = (
        isMatchingCachedDeliveryEntry(previous, planItem) ? previous.notReadyAttempts : 0
      ) + 1
      if (retainDisplay(planItem, {
        notReadyAttempts: attempts,
        remintFrozenUntilMs: nowMs + (attempts >= STORAGE_DELIVERY_NOT_READY_RETRY_CAP
          ? STORAGE_DELIVERY_SLOW_RETRY_MS : STORAGE_DELIVERY_NOT_READY_RETRY_MS),
        terminalForRevision: false,
      })) continue
      commit(planItem, {
        object_id: planItem.objectId,
        status: 'error',
        error: {
          code: 'STORAGE_DELIVERY_NOT_READY',
          message: 'Storage delivery interrupted.',
        },
      })
    }
    if (next.size === 0) throw error
  }

  return next
}

export function useVisibleStorageDeliveryUrls(input: {
  channelId: string | null | undefined
  items: Array<Pick<StorageObjectItem, 'id' | 'type' | 'status' | 'mime_type' | 'extension' | 'name' | 'size_bytes' | 'updated_at'>>
  enabled?: boolean
}) {
  const queryClient = useQueryClient()
  const plan = React.useMemo(
    () => input.items.flatMap((item) => {
      const planned = planVisibleStorageDeliveryItem(item)
      return planned ? [planned] : []
    }),
    [input.items],
  )
  const planIdentity = plan.map((item) => `${item.objectId}:${item.variant}:${item.revision}`).join('|')
  const channelQueryKey = input.channelId ?? 'none'
  const queryKey = ['storage', VISIBLE_DELIVERY_QUERY_PREFIX, channelQueryKey, planIdentity] as const

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const channelId = input.channelId!
      return buildVisibleStorageDeliveryMap({
        channelId,
        plan,
        lookup: collectPreviousDeliveryEntries(queryClient, channelId),
        signal,
        persistChunk: (next) => {
          queryClient.setQueryData(queryKey, next)
        },
        onOkItem: (item, value) => {
          writeCachedDeliveryItem(queryClient, channelId, item, value)
        },
      })
    },
    enabled: Boolean(input.channelId && (input.enabled ?? true) && plan.length > 0),
    staleTime: 45 * 60_000,
    gcTime: 60 * 60_000,
    placeholderData: (previousData, previousQuery) => (
      previousQuery?.queryKey[2] === channelQueryKey ? previousData : undefined
    ),
    refetchInterval: (query) => visibleDeliveryRefetchInterval({
      plan,
      data: query.state.data,
      error: query.state.error,
    }),
    refetchOnWindowFocus: (query) => shouldRemintVisibleDeliveryOnFocus({
      plan,
      data: query.state.data,
      error: query.state.error,
    }),
    refetchOnReconnect: (query) => shouldRemintVisibleDeliveryOnFocus({
      plan,
      data: query.state.data,
      error: query.state.error,
    }),
    retry: (failureCount, error) => {
      const status = getHttpStatus(error)
      if (status === 429 || (status !== null && status < 500)) return false
      return failureCount < 1
    },
  })
}

export function VisibleStorageDeliveryProvider({
  channelId,
  items,
  enabled = true,
  children,
}: {
  channelId: string | null | undefined
  items: Array<Pick<StorageObjectItem, 'id' | 'type' | 'status' | 'mime_type' | 'extension' | 'name' | 'size_bytes' | 'updated_at'>>
  enabled?: boolean
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const recoveryTimers = React.useRef(new Set<ReturnType<typeof setTimeout>>())
  React.useEffect(() => {
    const timers = recoveryTimers.current
    return () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    }
  }, [channelId])
  const retryPreview = React.useCallback((objectId: string, failedUrl: string) => {
    if (!channelId || !markVisibleStoragePreviewForRecovery(queryClient, channelId, objectId, failedUrl)) return
    // Token expiry has second precision. Avoid minting an identical URL, and
    // coalesce simultaneous image failures into the existing page-level batch.
    if (recoveryTimers.current.size > 0) return
    const timer = setTimeout(() => {
      recoveryTimers.current.delete(timer)
      void queryClient.invalidateQueries({ queryKey: ['storage', VISIBLE_DELIVERY_QUERY_PREFIX, channelId] })
    }, 1_100)
    recoveryTimers.current.add(timer)
  }, [channelId, queryClient])
  const query = useVisibleStorageDeliveryUrls({ channelId, items, enabled })
  const value = React.useMemo<VisibleStorageDeliveryContextValue>(() => ({
    byObjectId: visibleDeliveryItemsByObjectId(query.data),
    isPending: query.isPending || query.isFetching,
    isFetching: query.isFetching,
    retryPreview,
  }), [query.data, query.isFetching, query.isPending, retryPreview])

  return (
    <VisibleStorageDeliveryContext.Provider value={value}>
      {children}
    </VisibleStorageDeliveryContext.Provider>
  )
}

export function useVisibleStorageDeliveryItem(objectId: string) {
  const context = React.useContext(VisibleStorageDeliveryContext)
  if (!context) return null
  return {
    item: context.byObjectId.get(objectId) ?? null,
    isPending: context.isPending && !context.byObjectId.has(objectId),
    isFetching: context.isFetching,
    retryPreview: (failedUrl: string) => context.retryPreview(objectId, failedUrl),
  }
}

export function markVisibleStoragePreviewForRecovery(
  queryClient: QueryClient,
  channelId: string,
  objectId: string,
  failedUrl: string,
) {
  let marked = false
  queryClient.setQueriesData<Map<string, VisibleDeliveryCacheEntry>>({
    queryKey: ['storage', VISIBLE_DELIVERY_QUERY_PREFIX, channelId],
  }, (data) => {
    const current = data?.get(objectId)
    if (!data || !current || current.value.status !== 'ok'
      || current.value.url !== failedUrl || (current.previewRecoveryAttempts ?? 0) >= 1) return data
    marked = true
    const next = new Map(data)
    next.set(objectId, { ...current, previewRecoveryAttempts: 1, forceRemint: true })
    return next
  })
  return marked
}

export async function refreshVisibleStoragePreviews(queryClient: QueryClient, channelId: string) {
  const queryKey = ['storage', VISIBLE_DELIVERY_QUERY_PREFIX, channelId] as const
  await queryClient.cancelQueries({ queryKey })
  queryClient.setQueriesData<Map<string, VisibleDeliveryCacheEntry>>({ queryKey }, (data) => (
    data ? new Map([...data].map(([objectId, entry]) => [objectId, {
      ...entry,
      forceRemint: true,
      previewRecoveryAttempts: 0,
      terminalForRevision: false,
      notReadyAttempts: 0,
      remintFrozenUntilMs: undefined,
    }])) : data
  ))
  await queryClient.invalidateQueries({ queryKey })
}

export const __visibleStorageDeliveryTestHooks = {
  planVisibleStorageDeliveryItem,
  isVisibleStorageThumbnailCandidate,
  deliveryModeForPlan,
  isUsableCachedDeliveryItem,
  partitionVisibleDeliveryPlan,
  shouldMintVisibleDeliveryItem,
  visibleDeliveryRefetchInterval,
  shouldRemintVisibleDeliveryOnFocus,
  createVisibleDeliveryCacheEntry,
  isDeliveryRemintFrozen,
}
