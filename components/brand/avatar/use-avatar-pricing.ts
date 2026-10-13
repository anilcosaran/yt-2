'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAgentEstimate } from '@/components/billing/use-agent-estimate'
import {
  DEFAULT_AVATAR_LOOK_MODEL_ID,
  getAvatarEntitlement,
  type AvatarLookModelId,
} from '@/lib/avatar/api'
import {
  avatarEntitlementQueryKey,
  avatarEstimate,
  avatarRequiredCredits,
  type AvatarEntitlement,
} from '@/lib/avatar/entitlement'
import { creditPriceFromEstimate, type CreditPrice } from '@/lib/billing/credit-price'

export const AVATAR_IMAGE_NODE_TYPE = 'angle@1'
/** Placeholder prompt for price estimates: the price does not depend on the prompt text. */
const ESTIMATE_PROMPT = 'Avatar image estimate'

export function useAvatarEntitlement(channelId: string | null, enabled = true) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: avatarEntitlementQueryKey(channelId),
    queryFn: ({ signal }) => getAvatarEntitlement(channelId!, { signal }),
    enabled: Boolean(channelId) && enabled,
    staleTime: 30_000,
    retry: 1,
  })
  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: avatarEntitlementQueryKey(channelId) }),
    [channelId, queryClient],
  )
  return {
    entitlement: (query.data ?? null) as AvatarEntitlement | null,
    loading: query.isLoading,
    error: query.isError,
    refresh,
    refetch: query.refetch,
  }
}

export function buildAvatarImageEstimateParams(input: {
  sourceStorageObjectId?: string | null
  modelId?: AvatarLookModelId
  images?: number
}) {
  const count = Math.max(1, Math.min(8, Math.floor(input.images ?? 1)))
  return {
    ...(input.sourceStorageObjectId ? { source_image: { storage_object_id: input.sourceStorageObjectId } } : {}),
    angles: Array.from({ length: count }, () => ({ mode: 'scene', prompt: ESTIMATE_PROMPT })),
    model_id: input.modelId ?? DEFAULT_AVATAR_LOOK_MODEL_ID,
  }
}

/**
 * Price of one paid avatar image (new shot, edit, appearance, angle, virtual character).
 * Uses the exact agent estimate when it resolves and falls back to the entitlement display estimate.
 * Shots never use the free allowance.
 */
export function useAvatarImagePrice(input: {
  channelId: string | null
  entitlement: AvatarEntitlement | null
  sourceStorageObjectId?: string | null
  modelId?: AvatarLookModelId
  enabled?: boolean
  fallback?: 'shot_credits' | 'character_credits'
}): CreditPrice {
  const params = React.useMemo(
    () => buildAvatarImageEstimateParams({
      sourceStorageObjectId: input.sourceStorageObjectId,
      modelId: input.modelId,
    }),
    [input.modelId, input.sourceStorageObjectId],
  )
  const estimate = useAgentEstimate({
    channelId: input.channelId,
    nodeType: AVATAR_IMAGE_NODE_TYPE,
    params,
    enabled: input.enabled ?? true,
    keyPrefix: 'avatar-image-estimate',
  })
  return creditPriceFromEstimate({
    credits: estimate.credits,
    pending: estimate.pending,
    fallbackCredits: input.entitlement
      ? avatarEstimate(input.entitlement, input.fallback ?? 'shot_credits')
      : null,
    approximate: true,
    reserveCredits: avatarRequiredCredits(
      input.entitlement,
      input.fallback === 'character_credits' ? 'character_required_credits' : 'shot_required_credits',
    ),
  })
}
