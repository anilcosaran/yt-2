'use client'

import * as React from 'react'

import {
  estimateWorkflowAgent,
} from '@/lib/workflows/api'
import {
  MEDIA_DOWNLOADER_QUOTE_DEBOUNCE_MS,
  MEDIA_DOWNLOADER_QUOTE_TIMEOUT_MS,
  canLaunchMediaDownloaderQuote,
  parseMediaDownloaderVideoUrl,
  mediaDownloaderQuoteFingerprint,
  resolveMediaDownloaderCreditEligibility,
  mediaDownloaderQuoteLaunchFields,
  parseMediaDownloaderQuoteSnapshot,
  publicMediaDownloaderQuoteError,
  selectVariantFromSnapshot,
  selectedQuoteVariant,
  snapshotForPlanMaxResolution,
  withQuoteTimeoutSignal,
  type MediaDownloaderQuoteRequest,
  type MediaDownloaderQuoteSnapshot,
  type MediaDownloaderQuoteVariant,
} from '@/lib/workflows/media-downloader-quote'

export function useMediaDownloaderQuote(input: {
  channelId: string | null
  url: string
  availableCredits?: number | null
  creditEligibilityFailed?: boolean
  creditEligibilityRetrying?: boolean
  onRetryCreditEligibility?: () => void
  nodeType?: string
  downloadVariant?: string
  startTime?: number | null
  endTime?: number | null
  maxHeight?: number | null
  enabled: boolean
}) {
  const urlKey = parseMediaDownloaderVideoUrl(input.url)?.url ?? ''
  const creditEligibility = resolveMediaDownloaderCreditEligibility(
    input.availableCredits,
    input.creditEligibilityFailed,
  )
  const creditEligible = creditEligibility === 'not_required' || creditEligibility === 'eligible'
  const request = React.useMemo<MediaDownloaderQuoteRequest>(() => ({
    url: urlKey,
    downloadVariant: input.downloadVariant,
    startTime: input.startTime,
    endTime: input.endTime,
  }), [urlKey, input.downloadVariant, input.endTime, input.startTime])
  const creditUiActive = input.enabled && Boolean(request.url)
  const fingerprint = mediaDownloaderQuoteFingerprint(request)
  const sourceScopeKey = `${input.channelId ?? ''}|${urlKey}`
  const [snapshot, setSnapshot] = React.useState<MediaDownloaderQuoteSnapshot | null>(null)
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [estimateCount, setEstimateCount] = React.useState(0)
  const fingerprintRef = React.useRef(fingerprint)
  const sourceScopeRef = React.useRef(sourceScopeKey)

  React.useEffect(() => {
    fingerprintRef.current = fingerprint
  }, [fingerprint])

  React.useEffect(() => {
    if (!input.enabled || !creditEligible || !input.channelId || !request.url) {
      setSnapshot(null)
      setStatus('idle')
      setError(null)
      return
    }
    if (sourceScopeRef.current !== sourceScopeKey) {
      // A different source must show the metadata skeleton; output/range requotes
      // keep the current title and thumbnail to avoid unnecessary layout shifts.
      setSnapshot(null)
    }
    sourceScopeRef.current = sourceScopeKey
    const currentFingerprint = fingerprint
    const controller = new AbortController()
    setStatus('loading')
    setError(null)
    const timer = window.setTimeout(() => {
      setEstimateCount((count) => count + 1)
      void estimateWorkflowAgent({
        channelId: input.channelId,
        nodeType: input.nodeType ?? 'media_downloader@1',
        params: mediaDownloaderEstimateParams(request),
        idempotencyKey: `md-quote:${currentFingerprint}`,
      }, {
        signal: withQuoteTimeoutSignal(controller.signal),
        timeoutMs: MEDIA_DOWNLOADER_QUOTE_TIMEOUT_MS,
      }).then((raw) => {
        if (fingerprintRef.current !== currentFingerprint) return
        const parsed = parseMediaDownloaderQuoteSnapshot(raw, request, null)
        if (!parsed || parsed.fingerprint !== currentFingerprint) {
          setSnapshot(null)
          setStatus('error')
          setError('This video could not be quoted. Try a different link or try again later. Error code: E3151')
          return
        }
        setSnapshot(parsed)
        setStatus('ready')
        setError(null)
      }).catch((caught) => {
        if (fingerprintRef.current !== currentFingerprint) return
        if (controller.signal.aborted) return
        setSnapshot(null)
        setStatus('error')
        setError(publicMediaDownloaderQuoteError(
          caught,
          'This video could not be quoted. Try a different link or try again later. Error code: E3151',
        ))
      })
    }, MEDIA_DOWNLOADER_QUOTE_DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [creditEligible, fingerprint, input.channelId, input.enabled, input.nodeType, request, sourceScopeKey])

  const visibleSnapshot = React.useMemo(
    () => snapshotForPlanMaxResolution(snapshot, input.maxHeight ?? null),
    [input.maxHeight, snapshot],
  )
  const selected = selectedQuoteVariant(visibleSnapshot)

  const selectVariant = React.useCallback((variantId: string) => {
    setSnapshot((current) => {
      if (!current) return current
      return selectVariantFromSnapshot(current, variantId) ?? current
    })
  }, [])

  const displayedCredits = selected?.estimatedCredits ?? null
  const canLaunch = canLaunchMediaDownloaderQuote({
    snapshot: visibleSnapshot,
    fingerprint,
    displayedCredits,
  })

  return {
    status,
    error,
    fingerprint,
    snapshot: visibleSnapshot,
    selectedVariant: selected,
    variants: visibleSnapshot?.variants ?? [],
    displayedCredits,
    estimateCount,
    blockedByCredits: creditUiActive && creditEligibility === 'insufficient',
    creditEligibilityPending: creditUiActive && creditEligibility === 'pending',
    creditEligibilityFailed: creditUiActive && creditEligibility === 'failed',
    creditEligibilityRetrying: creditUiActive && Boolean(input.creditEligibilityRetrying),
    onRetryCreditEligibility: input.onRetryCreditEligibility ?? null,
    quoting: status === 'loading',
    canLaunch,
    launchFields: canLaunch ? mediaDownloaderQuoteLaunchFields(visibleSnapshot) : null,
    selectVariant,
  }
}

export function mediaDownloaderEstimateParams(request: MediaDownloaderQuoteRequest): Record<string, unknown> {
  const url = parseMediaDownloaderVideoUrl(request.url)?.url ?? ''
  const params: Record<string, unknown> = {
    mode: 'download',
  }
  if (request.downloadVariant) params.download_variant = request.downloadVariant
  if (url) params.url = url
  if (request.startTime != null) params.start_time = request.startTime
  if (request.endTime != null) params.end_time = request.endTime
  return params
}

export type { MediaDownloaderQuoteVariant }
