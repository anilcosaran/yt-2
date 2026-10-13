'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { BILLING_QUOTA_USAGE_QUERY_KEY } from '@/lib/billing/api'
import { isAmbiguousMutationError } from '@/lib/idempotency/client-mutation-control'
import {
  storageUsageAggregateQueryKey,
  storageUsageQueryKey,
  type StorageObjectItem,
} from '@/lib/storage/api'
import {
  YOUTUBE_IMPORT_POLL_DEADLINE_MS,
  beginYoutubeImportJob,
  clearYoutubeImportJob,
  isYoutubeImportAbort,
  launchYoutubeImport,
  patchYoutubeImportJob,
  readYoutubeImportAgentSnapshot,
  readYoutubeImportJob,
  youtubeImportPollIntervalMs,
  YoutubeImportError,
  type YoutubeImportJob,
  type YoutubeImportMediaKind,
  type YoutubeImportParsedUrl,
  type YoutubeImportQuote,
} from '@/lib/storage/youtube-import'

export function useYoutubeImportJob(input: {
  channelId: string | null
  formatError: (error: unknown) => string
  timeoutMessage: string
  onCompleted?: (items: StorageObjectItem[]) => void
}) {
  const queryClient = useQueryClient()
  const formatErrorRef = React.useRef(input.formatError)
  const timeoutMessageRef = React.useRef(input.timeoutMessage)
  const onCompletedRef = React.useRef(input.onCompleted)
  const channelId = input.channelId
  const [trackedChannelId, setTrackedChannelId] = React.useState(channelId)
  const [job, setJob] = React.useState<YoutubeImportJob | null>(() => (
    channelId ? readYoutubeImportJob(channelId) : null
  ))
  const [launchRetrySignal, setLaunchRetrySignal] = React.useState(0)
  const launchRetryCountRef = React.useRef(0)

  if (trackedChannelId !== channelId) {
    setTrackedChannelId(channelId)
    setJob(channelId ? readYoutubeImportJob(channelId) : null)
  }

  React.useEffect(() => {
    formatErrorRef.current = input.formatError
    timeoutMessageRef.current = input.timeoutMessage
    onCompletedRef.current = input.onCompleted
  })

  const agentId = job?.agentId ?? null
  const failedMessage = job?.failedMessage ?? null
  const startedAt = job?.startedAt ?? 0
  const launchIdempotencyKey = job?.launchIdempotencyKey ?? null

  React.useEffect(() => {
    if (!channelId || !launchIdempotencyKey || failedMessage) return
    const pending = readYoutubeImportJob(channelId)
    if (!pending || pending.failedMessage) return
    if (pending.agentId) {
      if (pending.agentId !== agentId) setJob(pending)
      return
    }

    let cancelled = false
    let retryTimer: number | undefined
    void launchYoutubeImport({
      channelId: pending.channelId,
      url: pending.url,
      mediaKind: pending.mediaKind,
      quote: pending.quote,
      idempotencyKey: pending.launchIdempotencyKey,
      startedAt: pending.startedAt,
    }).then(() => {
      if (!cancelled) {
        launchRetryCountRef.current = 0
        setJob(readYoutubeImportJob(channelId))
      }
    }).catch((error) => {
      if (cancelled) return
      if (isAmbiguousMutationError(error)) {
        const retryNumber = launchRetryCountRef.current
        if (retryNumber < 5) {
          launchRetryCountRef.current += 1
          retryTimer = window.setTimeout(
            () => setLaunchRetrySignal((current) => current + 1),
            Math.min(10_000, 1_000 * (2 ** retryNumber)),
          )
        }
        return
      }
      const message = formatErrorRef.current(error)
      setJob(patchYoutubeImportJob(channelId, { failedMessage: message }) ?? null)
    })

    return () => {
      cancelled = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [agentId, channelId, failedMessage, launchIdempotencyKey, launchRetrySignal])

  React.useEffect(() => {
    if (!channelId || !agentId || failedMessage) return undefined
    const controller = new AbortController()
    let timer: number | undefined

    const failJob = (message: string) => {
      setJob(patchYoutubeImportJob(channelId, { failedMessage: message }) ?? null)
    }

    const finishCompleted = (items: StorageObjectItem[]) => {
      clearYoutubeImportJob(channelId)
      setJob(null)
      void queryClient.invalidateQueries({ queryKey: ['storage', 'objects', channelId] })
      void queryClient.invalidateQueries({ queryKey: storageUsageQueryKey(channelId) })
      void queryClient.invalidateQueries({ queryKey: storageUsageAggregateQueryKey })
      void queryClient.invalidateQueries({ queryKey: BILLING_QUOTA_USAGE_QUERY_KEY })
      onCompletedRef.current?.(items)
    }

    const tick = async () => {
      if (Date.now() - startedAt >= YOUTUBE_IMPORT_POLL_DEADLINE_MS) {
        if (controller.signal.aborted) return
        failJob(timeoutMessageRef.current)
        return
      }
      try {
        const snapshot = await readYoutubeImportAgentSnapshot({
          agentId,
          channelId,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (snapshot.status === 'running') {
          timer = window.setTimeout(() => void tick(), youtubeImportPollIntervalMs(Date.now() - startedAt))
          return
        }
        if (snapshot.status === 'completed') {
          finishCompleted(snapshot.items)
          return
        }
        failJob(snapshot.message)
      } catch (error) {
        if (isYoutubeImportAbort(error, controller.signal)) return
        if (error instanceof YoutubeImportError) {
          failJob(formatErrorRef.current(error))
          return
        }
        timer = window.setTimeout(() => void tick(), youtubeImportPollIntervalMs(Date.now() - startedAt))
      }
    }

    void tick()
    return () => {
      controller.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [agentId, channelId, failedMessage, queryClient, startedAt])

  const startImport = React.useCallback((start: {
    url: YoutubeImportParsedUrl
    mediaKind: YoutubeImportMediaKind
    quote?: YoutubeImportQuote | null
  }) => {
    if (!channelId) return null
    const next = beginYoutubeImportJob({
      channelId,
      url: start.url,
      mediaKind: start.mediaKind,
      quote: start.quote ?? null,
    })
    setJob(next)
    return next
  }, [channelId])

  return {
    job,
    startImport,
    dismissFailure: React.useCallback(() => {
      if (!channelId) return
      clearYoutubeImportJob(channelId)
      setJob(null)
    }, [channelId]),
  }
}
