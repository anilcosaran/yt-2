import {
  MEDIA_DOWNLOADER_QUOTE_DEBOUNCE_MS,
  MEDIA_DOWNLOADER_QUOTE_TIMEOUT_MS,
  canLaunchMediaDownloaderQuote,
  mediaDownloaderQuoteFingerprint,
  mediaDownloaderQuoteLaunchFields,
  parseMediaDownloaderQuoteSnapshot,
  publicMediaDownloaderQuoteError,
  selectVariantFromSnapshot,
  selectedQuoteVariant,
  withQuoteTimeoutSignal,
  type MediaDownloaderQuoteLaunchFields,
  type MediaDownloaderQuoteRequest,
  type MediaDownloaderQuoteSnapshot,
  type MediaDownloaderQuoteVariant,
} from '@/lib/workflows/media-downloader-quote'

export type MediaDownloaderQuoteStatus = 'idle' | 'loading' | 'ready' | 'error'

export type MediaDownloaderQuoteSessionState = {
  status: MediaDownloaderQuoteStatus
  fingerprint: string
  snapshot: MediaDownloaderQuoteSnapshot | null
  error: string | null
  estimateCount: number
}

export type MediaDownloaderQuoteEstimateFn = (
  request: MediaDownloaderQuoteRequest,
  options: { fingerprint: string; signal: AbortSignal },
) => Promise<unknown>

export function createMediaDownloaderQuoteSession(input: {
  estimate: MediaDownloaderQuoteEstimateFn
  debounceMs?: number
  timeoutMs?: number
  now?: () => number
  maxHeight?: number | null
  errorMessage?: string
}) {
  const debounceMs = input.debounceMs ?? MEDIA_DOWNLOADER_QUOTE_DEBOUNCE_MS
  const timeoutMs = input.timeoutMs ?? MEDIA_DOWNLOADER_QUOTE_TIMEOUT_MS
  const now = input.now ?? Date.now
  const errorMessage = input.errorMessage
    ?? 'This video could not be quoted. Try a different link or try again later. Error code: E3151'
  let maxHeight = input.maxHeight ?? null
  let timer: ReturnType<typeof setTimeout> | null = null
  let requestId = 0
  let controller: AbortController | null = null
  const listeners = new Set<(state: MediaDownloaderQuoteSessionState) => void>()
  let state: MediaDownloaderQuoteSessionState = {
    status: 'idle',
    fingerprint: '',
    snapshot: null,
    error: null,
    estimateCount: 0,
  }

  function getState() {
    return state
  }

  function subscribe(listener: (next: MediaDownloaderQuoteSessionState) => void) {
    listeners.add(listener)
    listener(state)
    return () => {
      listeners.delete(listener)
    }
  }

  function setState(patch: Partial<MediaDownloaderQuoteSessionState>) {
    state = { ...state, ...patch }
    for (const listener of listeners) listener(state)
  }

  function selectedVariant(): MediaDownloaderQuoteVariant | null {
    return selectedQuoteVariant(state.snapshot)
  }

  function request(request: MediaDownloaderQuoteRequest) {
    const fingerprint = mediaDownloaderQuoteFingerprint(request)
    if (!request.url.trim()) {
      cancelInFlight()
      setState({
        status: 'idle',
        fingerprint,
        snapshot: null,
        error: null,
      })
      return fingerprint
    }
    if (fingerprint === state.fingerprint && state.status !== 'idle') {
      return fingerprint
    }
    cancelInFlight()
    setState({
      status: 'loading',
      fingerprint,
      snapshot: state.fingerprint === fingerprint ? state.snapshot : null,
      error: null,
    })
    const currentRequest = ++requestId
    timer = setTimeout(() => {
      void runEstimate(request, fingerprint, currentRequest)
    }, debounceMs)
    return fingerprint
  }

  async function flush(request: MediaDownloaderQuoteRequest) {
    const fingerprint = mediaDownloaderQuoteFingerprint(request)
    if (!request.url.trim()) return getState()
    cancelInFlight()
    setState({
      status: 'loading',
      fingerprint,
      snapshot: null,
      error: null,
    })
    await runEstimate(request, fingerprint, ++requestId)
    return getState()
  }

  function applyEstimate(fingerprint: string, raw: unknown) {
    if (fingerprint !== state.fingerprint) return getState()
    const [url = '', downloadVariant = '', clip = ''] = fingerprint.split('|')
    const [startTime = '', endTime = ''] = clip.split(':')
    const snapshot = parseMediaDownloaderQuoteSnapshot(raw, {
      url, downloadVariant, startTime: startTime ? Number(startTime) : null, endTime: endTime ? Number(endTime) : null,
    }, maxHeight)
    if (!snapshot || snapshot.fingerprint !== fingerprint) {
      setState({ status: 'error', snapshot: null, error: errorMessage })
      return getState()
    }
    setState({ status: 'ready', snapshot, error: null })
    return getState()
  }

  function selectVariant(variantId: string) {
    if (!state.snapshot) return getState()
    const next = selectVariantFromSnapshot(state.snapshot, variantId)
    if (!next) return getState()
    setState({ snapshot: next })
    return getState()
  }

  function canLaunch(displayedCredits?: number | null) {
    const credits = displayedCredits ?? selectedVariant()?.estimatedCredits ?? null
    return canLaunchMediaDownloaderQuote({
      snapshot: state.snapshot,
      fingerprint: state.fingerprint,
      displayedCredits: credits,
      nowMs: now(),
    })
  }

  function launchFields(): MediaDownloaderQuoteLaunchFields | null {
    if (!canLaunch()) return null
    return mediaDownloaderQuoteLaunchFields(state.snapshot)
  }

  function setMaxHeight(next: number | null) {
    maxHeight = next
  }

  function dispose() {
    cancelInFlight()
    listeners.clear()
  }

  async function runEstimate(
    request: MediaDownloaderQuoteRequest,
    fingerprint: string,
    currentRequest: number,
  ) {
    controller = new AbortController()
    const signal = withQuoteTimeoutSignal(controller.signal, timeoutMs)
    setState({ estimateCount: state.estimateCount + 1 })
    try {
      const raw = await input.estimate(request, { fingerprint, signal })
      if (currentRequest !== requestId || fingerprint !== state.fingerprint) return
      const snapshot = parseMediaDownloaderQuoteSnapshot(raw, request, maxHeight)
      if (!snapshot || snapshot.fingerprint !== fingerprint) {
        setState({ status: 'error', snapshot: null, error: errorMessage })
        return
      }
      setState({ status: 'ready', snapshot, error: null })
    } catch (error) {
      if (currentRequest !== requestId || fingerprint !== state.fingerprint) return
      if (isAbortError(error)) {
        setState({ status: 'error', snapshot: null, error: errorMessage })
        return
      }
      setState({
        status: 'error',
        snapshot: null,
        error: publicMediaDownloaderQuoteError(error, errorMessage),
      })
    }
  }

  function cancelInFlight() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    controller?.abort()
    controller = null
  }

  return {
    getState,
    subscribe,
    request,
    flush,
    applyEstimate,
    selectVariant,
    selectedVariant,
    canLaunch,
    launchFields,
    setMaxHeight,
    dispose,
  }
}

function isAbortError(error: unknown) {
  return (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError')
}
