'use client'

import { useQuery } from '@tanstack/react-query'

import {
  getCoalescedStorageDeliveryUrls,
  storageDeliveryRefreshDelay,
} from '@/lib/storage/api'

const STORAGE_THUMBNAIL_RETRY_LIMIT = 2
const STORAGE_ORIGINAL_IMAGE_PREVIEW_FALLBACK_MAX_BYTES = BigInt(256 * 1024)
/**
 * P02-14 (K140/K158): the largest original a grid preview may decode instead of a derivative,
 * GIF included (by bytes, never by extension). The gateway enforces the same budget for
 * `purpose: 'grid'` (STORAGE_PREVIEW_ORIGINAL_MAX_BYTES, default 2 MiB).
 */
export const STORAGE_PREVIEW_ORIGINAL_MAX_BYTES = BigInt(2 * 1024 * 1024)

export function useStorageThumbnailUrl(input: {
  channelId: string | null | undefined
  objectId: string
  enabled: boolean
  revision?: string | null
  allowOriginalImageFallback?: boolean
  preferOriginalDelivery?: boolean
}) {
  return useQuery({
    queryKey: storageThumbnailQueryKey(input),
    queryFn: async ({ signal }) => {
      const variant = input.preferOriginalDelivery ? 'original' : 'thumbnail'
      const response = await getCoalescedStorageDeliveryUrls({
        channelId: input.channelId!,
        items: [{
          objectId: input.objectId,
          variant,
          expiresInSeconds: 3_600,
        }],
      }, { signal })
      const result = response.items.find((item) => item.object_id === input.objectId)
      if (
        result?.status === 'error'
        && (
          result.error.code === 'STORAGE_DELIVERY_NOT_READY'
          || result.error.code === 'STORAGE_THUMBNAIL_NOT_AVAILABLE'
        )
        && input.allowOriginalImageFallback
        && variant !== 'original'
      ) {
        const originalResponse = await getCoalescedStorageDeliveryUrls({
          channelId: input.channelId!,
          items: [{
            objectId: input.objectId,
            variant: 'original',
            expiresInSeconds: 3_600,
          }],
        }, { signal })
        const originalResult = originalResponse.items.find((item) => item.object_id === input.objectId)
        if (originalResult?.status === 'ok') return originalResult
        throw new Error(originalResult?.error.code ?? 'STORAGE_ORIGINAL_PREVIEW_NOT_AVAILABLE')
      }
      if (!result || result.status === 'error') {
        throw new Error(result?.error.code ?? 'STORAGE_THUMBNAIL_NOT_AVAILABLE')
      }
      return result
    },
    enabled: Boolean(input.channelId && input.enabled),
    staleTime: 45 * 60_000,
    gcTime: 60 * 60_000,
    refetchInterval: (query) => query.state.error
      ? false
      : storageDeliveryRefreshDelay(query.state.data),
    refetchOnWindowFocus: (query) => Boolean(query.state.data) && !query.state.error,
    refetchOnReconnect: (query) => Boolean(query.state.data) && !query.state.error,
    retry: shouldRetryStorageThumbnailDelivery,
    retryDelay: (retryAttempt) => Math.min(600 * (2 ** retryAttempt), 1_500),
  })
}

export function storageThumbnailQueryPrefix(channelId: string | null | undefined) {
  return ['storage', 'thumbnail-url', channelId ?? 'none'] as const
}

export function storageThumbnailQueryKey(input: {
  channelId: string | null | undefined
  objectId: string
  revision?: string | null
  allowOriginalImageFallback?: boolean
  preferOriginalDelivery?: boolean
}) {
  return [
    ...storageThumbnailQueryPrefix(input.channelId),
    input.objectId,
    input.revision ?? 'stable',
    input.preferOriginalDelivery
      ? 'original-delivery'
      : input.allowOriginalImageFallback
        ? 'bounded-original-fallback'
        : 'thumbnail-only',
  ] as const
}

export function isStorageGifPreview(input: {
  mimeType?: string | null
  extension?: string | null
  name?: string | null
}) {
  const mimeType = input.mimeType?.toLowerCase().split(';', 1)[0]?.trim() ?? ''
  if (mimeType === 'image/gif') return true
  const extension = (input.extension ?? '').replace(/^\./, '').toLowerCase()
  if (extension === 'gif') return true
  const fileName = (input.name ?? '').split(/[\\/]/).pop()?.split('?')[0]?.toLowerCase() ?? ''
  return fileName.endsWith('.gif')
}

export function isStorageOriginalImagePreviewFallbackEligible(input: {
  mimeType: string | null | undefined
  sizeBytes: string | null | undefined
}) {
  const mimeType = input.mimeType?.toLowerCase().split(';', 1)[0]?.trim() ?? ''
  if (!['image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return false
  const rawSize = input.sizeBytes?.trim() ?? ''
  if (!/^\d+$/.test(rawSize)) return false
  const sizeBytes = BigInt(rawSize)
  return sizeBytes > BigInt(0) && sizeBytes <= STORAGE_ORIGINAL_IMAGE_PREVIEW_FALLBACK_MAX_BYTES
}

export function isStorageOriginalWithinPreviewBudget(input: {
  sizeBytes: string | null | undefined
}) {
  const rawSize = input.sizeBytes?.trim() ?? ''
  if (!/^\d+$/.test(rawSize)) return false
  const sizeBytes = BigInt(rawSize)
  return sizeBytes > BigInt(0) && sizeBytes <= STORAGE_PREVIEW_ORIGINAL_MAX_BYTES
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = Number((error as { status: unknown }).status)
  return Number.isFinite(status) ? status : null
}

function shouldRetryStorageThumbnailDelivery(failureCount: number, error: Error) {
  const status = getErrorStatus(error)
  if (status === 429 || (status !== null && status < 500 && status >= 400)) return false
  return failureCount < STORAGE_THUMBNAIL_RETRY_LIMIT
    && error.message === 'STORAGE_DELIVERY_NOT_READY'
}

export const __storageThumbnailUrlTestHooks = {
  shouldRetryStorageThumbnailDelivery,
  storageThumbnailQueryKey,
  isStorageOriginalImagePreviewFallbackEligible,
  isStorageGifPreview,
}
