'use client'

import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ComposerTrigger } from './composer-trigger'
import {
  COMPOSER_RESOURCES_QUERY_KEY,
  composerResourceMenuGroups,
  searchComposerResources,
  type ComposerResourceCandidate,
  type ComposerResourceKind,
} from './resource-mentions'
import type { TypedComposerMenuGroup } from './use-typed-composer'

const SEARCH_DEBOUNCE_MS = 150

/**
 * P03-02 `@` menu data: typed resource candidates for the current mention query (server data, debounced). Each result
 * is offered to `onCandidates` so chips of the same exact identity pick up a renamed label.
 */
export function useMentionMenuGroups(input: {
  channelId: string | null
  trigger: ComposerTrigger | null
  enabled: boolean
  locale: 'tr' | 'en'
  describe: (candidate: ComposerResourceCandidate) => string
  onCandidates?: (candidates: ComposerResourceCandidate[]) => void
}): { groups: TypedComposerMenuGroup[]; loading: boolean; error: boolean; failedKinds: ComposerResourceKind[] } {
  const mentionOpen = Boolean(input.enabled && input.channelId && input.trigger?.kind === 'mention')
  const query = mentionOpen ? input.trigger?.query ?? '' : null
  const [debounced, setDebounced] = React.useState<string | null>(query)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])
  const onCandidatesRef = React.useRef(input.onCandidates)
  React.useEffect(() => {
    onCandidatesRef.current = input.onCandidates
  }, [input.onCandidates])

  const search = useQuery({
    queryKey: [...COMPOSER_RESOURCES_QUERY_KEY, input.channelId, debounced, input.locale],
    queryFn: async ({ signal }) => {
      const result = await searchComposerResources({ channelId: input.channelId!, query: debounced ?? '', locale: input.locale }, { signal })
      onCandidatesRef.current?.(result.candidates)
      return result
    },
    enabled: mentionOpen && debounced !== null,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  const { describe } = input
  const groups = React.useMemo(
    () => (mentionOpen ? composerResourceMenuGroups(search.data?.candidates ?? [], describe) : []),
    [describe, mentionOpen, search.data?.candidates],
  )
  return {
    groups,
    loading: mentionOpen && (search.isLoading || debounced !== query),
    error: mentionOpen && search.isError,
    failedKinds: mentionOpen ? search.data?.failedKinds ?? [] : [],
  }
}
