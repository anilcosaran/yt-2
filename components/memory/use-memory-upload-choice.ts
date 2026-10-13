'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { getMemorySettings, memorySettingsQueryKey } from '@/lib/memory/api'
import {
  memoryIngestionRequestFor,
  memoryUploadAvailability,
  previewMemoryUploadOutcome,
  type MemoryUploadSource,
  type MemoryUploadSummary,
} from '@/lib/memory/upload-memory-choice'

/**
 * S19: state of the single "Belleğe de ekle" choice of one upload surface (Chat composer + media picker share
 * one instance). Component memory only; availability comes from the channel's existing Memory settings.
 */
export function useMemoryUploadChoice(channelId: string | null, source: MemoryUploadSource) {
  const [checked, setChecked] = React.useState(true)
  // The summary belongs to the channel of its batch; a channel switch hides it without an effect.
  const [summaryState, setSummaryState] = React.useState<{ channelId: string; summary: MemoryUploadSummary | null } | null>(null)
  const settingsQuery = useQuery({
    queryKey: memorySettingsQueryKey(channelId),
    queryFn: ({ signal }) => getMemorySettings(channelId!, { signal }),
    enabled: Boolean(channelId),
    staleTime: 60_000,
    retry: false,
  })
  const availability = memoryUploadAvailability(settingsQuery.data)

  /** Request field for the next upload; call once per batch and pass it to every file of the batch. */
  const beginBatch = React.useCallback((batchChannelId: string, files: ReadonlyArray<File>) => {
    const addToMemory = checked && availability.available
    setSummaryState(null)
    if (availability.available) {
      void previewMemoryUploadOutcome({ channelId: batchChannelId, source, checked: addToMemory, files })
        .then((summary) => setSummaryState({ channelId: batchChannelId, summary }))
    }
    return availability.available ? memoryIngestionRequestFor(addToMemory, source) : memoryIngestionRequestFor(true, source)
  }, [availability.available, checked, source])

  return {
    checked,
    setChecked,
    availability,
    summary: summaryState && summaryState.channelId === channelId ? summaryState.summary : null,
    clearSummary: React.useCallback(() => setSummaryState(null), []),
    beginBatch,
  }
}

export type MemoryUploadChoice = ReturnType<typeof useMemoryUploadChoice>
