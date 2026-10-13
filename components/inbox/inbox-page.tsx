'use client'

import * as React from 'react'
import Link from 'next/link'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Inbox,
  ListFilter,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  RefreshCw,
  Send,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { isAmbiguousMutationError } from '@/lib/idempotency/client-mutation-control'
import {
  addReviewMessage,
  archiveReviewItem,
  deleteReviewItem,
  decideReviewRequest,
  getReviewDisplayMessage,
  getReviewDisplayTitle,
  getReviewItem,
  getReviewInboxEventsUrl,
  listReviewItems,
  listReviewMessages,
  markReviewItemSeen,
  probeUnreadReviewItems,
  unarchiveReviewItem,
  type ReviewItem,
  type ReviewMessage,
} from '@/lib/review/api'
import {
  INBOX_NOTIFICATION_SOUND_CHANGED_EVENT,
  readInboxNotificationSoundEnabled,
} from '@/lib/review/notification-preferences'
import {
  clearReviewMutationAttempt,
  getOrCreateReviewMutationAttempt,
} from '@/lib/review/mutation-attempt'
import { cn } from '@/lib/utils'
import { WORKFLOWS_QUERY_KEY } from '@/lib/workflows/api'
import { UiText } from '@/components/i18n/ui-text'
import { useFormatter, useNow, useTranslations } from 'next-intl'
import { registerBrowserPrincipalLifecycleResetter } from '@/lib/auth/browser-principal-storage'
import { isLatestInboxOperation } from './inbox-operation-control'

const PAGE_SIZE = 25
const INBOX_DISCONNECTED_POLL_INTERVAL_MS = 45_000
const INBOX_HEALTHY_RECONCILE_INTERVAL_MS = 5 * 60_000
const INBOX_EVENT_DEBOUNCE_MS = 250
type InboxVisibility = 'active' | 'archived'
type InboxTranslator = (key: string, values?: Record<string, string | number>) => string
type InboxFormatter = ReturnType<typeof useFormatter>

export function InboxPage() {
  const tAuto = useTranslations('Auto')
  const tInbox = useTranslations('Inbox') as unknown as InboxTranslator
  const now = useNow({ updateInterval: 60_000 })
  const queryClient = useQueryClient()
  const [principalGeneration, setPrincipalGeneration] = React.useState(0)
  const principalGenerationRef = React.useRef(0)
  const signalAbortRef = React.useRef<AbortController | null>(null)
  const [items, setItems] = React.useState<ReviewItem[]>([])
  const [selectedItem, setSelectedItem] = React.useState<ReviewItem | null>(null)
  const [messages, setMessages] = React.useState<ReviewMessage[]>([])
  const [reply, setReply] = React.useState('')
  const [showUnreadOnly, setShowUnreadOnly] = React.useState(false)
  const [visibility, setVisibility] = React.useState<InboxVisibility>('active')
  const [listWidth, setListWidth] = React.useState(444)
  const [offset, setOffset] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [actionPending, setActionPending] = React.useState(false)
  const resizeStartRef = React.useRef({ x: 0, width: 444 })
  const loadingMoreRef = React.useRef(false)
  const listGenerationRef = React.useRef(0)
  const listAbortRef = React.useRef<AbortController | null>(null)
  const knownUnreadIdsRef = React.useRef<Set<string> | null>(null)
  const unreadProbeRef = React.useRef<{
    total: number
    newestId: string | null
    newestRevision: string | null
  } | null>(null)
  const notificationSoundEnabledRef = React.useRef(true)
  const selectionGenerationRef = React.useRef(0)
  const selectionAbortRef = React.useRef<AbortController | null>(null)
  const selectedIdRef = React.useRef<string | null>(null)
  const replyDraftsRef = React.useRef(new Map<string, string>())
  const actionPendingRef = React.useRef(false)
  const actionGenerationRef = React.useRef(0)
  const busyGenerationRef = React.useRef(0)

  React.useEffect(() => registerBrowserPrincipalLifecycleResetter(() => {
    principalGenerationRef.current += 1
    listGenerationRef.current += 1
    selectionGenerationRef.current += 1
    actionGenerationRef.current += 1
    busyGenerationRef.current += 1
    listAbortRef.current?.abort()
    selectionAbortRef.current?.abort()
    signalAbortRef.current?.abort()
    selectedIdRef.current = null
    replyDraftsRef.current.clear()
    knownUnreadIdsRef.current = null
    unreadProbeRef.current = null
    setItems([])
    setSelectedItem(null)
    setMessages([])
    setReply('')
    setBusy(false)
    actionPendingRef.current = false
    setActionPending(false)
    setPrincipalGeneration(principalGenerationRef.current)
  }), [])

  const unreadCount = items.filter((item) => item.read_state === 'unread').length
  const interactionBusy = busy || actionPending

  const beginBusyOperation = React.useCallback(() => {
    const generation = busyGenerationRef.current + 1
    busyGenerationRef.current = generation
    setBusy(true)
    return generation
  }, [])

  const finishBusyOperation = React.useCallback((generation: number) => {
    if (isLatestInboxOperation(generation, busyGenerationRef.current)) setBusy(false)
  }, [])

  const loadItems = React.useCallback(async (
    nextOffset = 0,
    append = false,
    options: { silent?: boolean; notifyOnNewUnread?: boolean } = {},
  ) => {
    if (append && loadingMoreRef.current) return
    const generation = listGenerationRef.current + 1
    listGenerationRef.current = generation
    listAbortRef.current?.abort()
    const controller = new AbortController()
    listAbortRef.current = controller
    if (append) {
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
      loadingMoreRef.current = false
      setLoadingMore(false)
      setLoading(!options.silent)
    }
    setLoadMoreError(null)
    if (!append && !options.silent) setLoadError(null)
    try {
      const response = await listReviewItems({
        limit: PAGE_SIZE,
        offset: nextOffset,
        readState: showUnreadOnly ? 'unread' : undefined,
        visibility,
      }, { signal: controller.signal })
      if (controller.signal.aborted || listGenerationRef.current !== generation) return
      if (!append) {
        trackUnreadItems(response.data, knownUnreadIdsRef, options.notifyOnNewUnread && notificationSoundEnabledRef.current)
      }
      setItems((current) => append ? mergeItems(current, response.data) : response.data)
      setOffset(response.meta.offset + response.meta.limit)
      setTotal(response.meta.total)
      setHasMore(response.meta.hasMore)
    } catch (err) {
      if (controller.signal.aborted || listGenerationRef.current !== generation) return
      if (append) {
        setLoadMoreError('Could not load more items.')
        return
      }
      if (!options.silent) setLoadError(err instanceof Error && err.message.trim() ? err.message : 'Could not load Inbox.')
    } finally {
      if (listGenerationRef.current !== generation) return
      if (listAbortRef.current === controller) listAbortRef.current = null
      if (append) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [showUnreadOnly, visibility, principalGeneration])

  React.useEffect(() => () => {
    listGenerationRef.current += 1
    listAbortRef.current?.abort()
  }, [])

  React.useEffect(() => {
    // This effect starts the external inbox synchronization when its filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loading state belongs to the request lifecycle.
    void loadItems(0, false)
  }, [loadItems])

  React.useEffect(() => {
    notificationSoundEnabledRef.current = readInboxNotificationSoundEnabled()

    const handleSoundPreferenceChange = (event: Event) => {
      notificationSoundEnabledRef.current = Boolean((event as CustomEvent<boolean>).detail)
    }

    window.addEventListener(INBOX_NOTIFICATION_SOUND_CHANGED_EVENT, handleSoundPreferenceChange)
    return () => window.removeEventListener(INBOX_NOTIFICATION_SOUND_CHANGED_EVENT, handleSoundPreferenceChange)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void probeUnreadReviewItems()
      .then((probe) => {
        if (!cancelled) unreadProbeRef.current = probe
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const refreshInboxForSignal = React.useCallback(async () => {
    const principal = principalGenerationRef.current
    const selection = selectionGenerationRef.current
    const selectedId = selectedIdRef.current
    signalAbortRef.current?.abort()
    const controller = new AbortController()
    signalAbortRef.current = controller
    const probe = await probeUnreadReviewItems()
    if (controller.signal.aborted || principalGenerationRef.current !== principal) return
    const previousProbe = unreadProbeRef.current
    unreadProbeRef.current = probe
    // Count/newest only describe unread arrivals. Any existing (or read) item
    // may change without moving them, so events and bounded polls reload state.
    await loadItems(0, false, { silent: true, notifyOnNewUnread: visibility === 'active' })
    if (controller.signal.aborted || principalGenerationRef.current !== principal) return
    if (visibility !== 'active' && previousProbe && notificationSoundEnabledRef.current && probe.total > previousProbe.total) {
      playInboxNotificationSound()
    }
    if (!selectedId || actionPendingRef.current) return
    const detail = await getReviewItem(selectedId, { signal: controller.signal })
    const nextMessages = detail.item_type === 'request'
      ? await listReviewMessages(selectedId, { signal: controller.signal })
      : []
    if (controller.signal.aborted || principalGenerationRef.current !== principal
      || selectionGenerationRef.current !== selection || selectedIdRef.current !== selectedId
      || actionPendingRef.current) return
    setSelectedItem(detail)
    setMessages(nextMessages)
  }, [loadItems, visibility])

  React.useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let scheduledKind: 'event' | 'reconcile' | null = null
    let refreshInFlight = false
    let refreshQueued = false
    let dirtyWhileHidden = false
    let streamConnected = false
    let disconnectedFallbackDeadline: number | null = null
    let source: EventSource | null = null

    const clearScheduledRefresh = () => {
      if (!timeoutId) return
      clearTimeout(timeoutId)
      timeoutId = null
      scheduledKind = null
    }

    const nextReconcileDelay = () => {
      const transportDelay = streamConnected
        ? INBOX_HEALTHY_RECONCILE_INTERVAL_MS
        : INBOX_DISCONNECTED_POLL_INTERVAL_MS
      if (disconnectedFallbackDeadline === null) return transportDelay
      return Math.max(0, Math.min(transportDelay, disconnectedFallbackDeadline - Date.now()))
    }

    const scheduleRefresh = (delay: number, kind: 'event' | 'reconcile') => {
      clearScheduledRefresh()
      if (cancelled || document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        return
      }
      scheduledKind = kind
      timeoutId = setTimeout(() => {
        timeoutId = null
        scheduledKind = null
        void performRefresh()
      }, delay)
    }

    async function performRefresh() {
      if (cancelled) return
      if (document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        clearScheduledRefresh()
        return
      }
      if (refreshInFlight) {
        refreshQueued = true
        return
      }

      refreshInFlight = true
      try {
        await refreshInboxForSignal()
        disconnectedFallbackDeadline = null
      } catch {
        disconnectedFallbackDeadline = Date.now() + INBOX_DISCONNECTED_POLL_INTERVAL_MS
        // Keep the current inbox snapshot; the next event or fallback reconcile will retry.
      } finally {
        refreshInFlight = false
        if (cancelled || document.visibilityState !== 'visible') return
        if (refreshQueued) {
          refreshQueued = false
          scheduleRefresh(INBOX_EVENT_DEBOUNCE_MS, 'event')
          return
        }
        scheduleRefresh(nextReconcileDelay(), 'reconcile')
      }
    }

    const requestEventRefresh = () => {
      if (document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        clearScheduledRefresh()
        return
      }
      if (refreshInFlight) {
        refreshQueued = true
        return
      }
      if (scheduledKind === 'event') return
      scheduleRefresh(INBOX_EVENT_DEBOUNCE_MS, 'event')
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        dirtyWhileHidden = true
        refreshQueued = false
        clearScheduledRefresh()
        return
      }
      if (!dirtyWhileHidden) return
      dirtyWhileHidden = false
      scheduleRefresh(0, 'event')
    }

    const handleStreamOpen = () => {
      if (streamConnected) return
      streamConnected = true
      if (!refreshInFlight && scheduledKind !== 'event') {
        scheduleRefresh(nextReconcileDelay(), 'reconcile')
      }
    }

    const handleStreamError = () => {
      const wasConnected = streamConnected
      streamConnected = false
      disconnectedFallbackDeadline ??= Date.now() + INBOX_DISCONNECTED_POLL_INTERVAL_MS
      if (wasConnected && !refreshInFlight && scheduledKind !== 'event') {
        scheduleRefresh(nextReconcileDelay(), 'reconcile')
      }
    }

    if (typeof window.EventSource !== 'undefined') {
      source = new EventSource(getReviewInboxEventsUrl(), { withCredentials: true })
      source.addEventListener('open', handleStreamOpen)
      source.addEventListener('error', handleStreamError)
      source.addEventListener('inbox', requestEventRefresh)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    scheduleRefresh(nextReconcileDelay(), 'reconcile')

    return () => {
      cancelled = true
      signalAbortRef.current?.abort()
      clearScheduledRefresh()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      source?.removeEventListener('open', handleStreamOpen)
      source?.removeEventListener('error', handleStreamError)
      source?.removeEventListener('inbox', requestEventRefresh)
      source?.close()
    }
  }, [refreshInboxForSignal])

  const handleSelect = React.useCallback(async (id: string) => {
    const generation = selectionGenerationRef.current + 1
    selectionGenerationRef.current = generation
    selectionAbortRef.current?.abort()
    const controller = new AbortController()
    selectionAbortRef.current = controller
    selectedIdRef.current = id
    setSelectedItem(null)
    setMessages([])
    setReply(replyDraftsRef.current.get(id) ?? '')
    setActionError(null)
    const busyGeneration = beginBusyOperation()
    try {
      const listItem = items.find((item) => item.id === id)
      const [detail, nextMessages] = await Promise.all([
        getReviewItem(id, { signal: controller.signal }),
        listItem?.item_type === 'request'
          ? listReviewMessages(id, { signal: controller.signal })
          : Promise.resolve([]),
      ])
      if (controller.signal.aborted || selectionGenerationRef.current !== generation) return
      void markReviewItemSeen(id).catch(() => null)
      const seenDetail = { ...detail, read_state: 'read' as const }
      setSelectedItem(seenDetail)
      setItems((current) => current.map((item) => item.id === id ? seenDetail : item))
      setMessages(detail.item_type === 'request' ? nextMessages : [])
    } catch (error) {
      if (!controller.signal.aborted && selectionGenerationRef.current === generation) {
        setActionError(error instanceof Error ? error.message : 'Could not load this Inbox item.')
      }
    } finally {
      if (selectionGenerationRef.current === generation) finishBusyOperation(busyGeneration)
    }
  }, [beginBusyOperation, finishBusyOperation, items])

  const handleReplyChange = React.useCallback((value: string) => {
    const selectedId = selectedIdRef.current
    if (selectedId) replyDraftsRef.current.set(selectedId, value)
    setReply(value)
  }, [])

  const handleDecision = React.useCallback(async (action: 'approve' | 'reject' | 'request_changes' | 'answer') => {
    if (
      !selectedItem
      || selectedItem.item_type !== 'request'
      || selectedIdRef.current !== selectedItem.id
      || actionPendingRef.current
    ) return
    const targetItem = selectedItem
    const comment = reply.trim()
    const attempt = getOrCreateReviewMutationAttempt(
      { action: 'decision', requestId: targetItem.id, decision: action, comment },
      () => createReviewUiIdempotencyKey('review-decision'),
    )
    const actionGeneration = actionGenerationRef.current + 1
    actionGenerationRef.current = actionGeneration
    const busyGeneration = beginBusyOperation()
    actionPendingRef.current = true
    setActionPending(true)
    setActionError(null)
    try {
      const result = await decideReviewRequest({
        requestId: targetItem.id,
        action,
        comment: comment || null,
        idempotencyKey: attempt.idempotencyKey,
      })
      clearReviewMutationAttempt(attempt)
      refreshWorkflowQueriesAfterDecision(queryClient, targetItem, result.item)
      setItems((current) => current.map((item) => item.id === result.item.id ? result.item : item))
      if (selectedIdRef.current !== targetItem.id) return
      if (visibility === 'active' && result.item.archived_at) {
        selectedIdRef.current = null
        setSelectedItem(null)
        setItems((current) => current.filter((item) => item.id !== result.item.id))
        setMessages([])
        setReply('')
        replyDraftsRef.current.delete(targetItem.id)
        return
      }
      setSelectedItem(result.item)
      setReply('')
      replyDraftsRef.current.delete(targetItem.id)
      try {
        const nextMessages = await listReviewMessages(result.item.id)
        if (selectedIdRef.current === targetItem.id) setMessages(nextMessages)
      } catch {
        if (selectedIdRef.current === targetItem.id) setActionError(tInbox('reconciliationFailed'))
      }
    } catch (error) {
      if (!isAmbiguousMutationError(error)) clearReviewMutationAttempt(attempt)
      if (selectedIdRef.current === targetItem.id) {
        setActionError(error instanceof Error ? error.message : 'The decision could not be saved.')
      }
    } finally {
      if (isLatestInboxOperation(actionGeneration, actionGenerationRef.current)) {
        actionPendingRef.current = false
        setActionPending(false)
      }
      finishBusyOperation(busyGeneration)
    }
  }, [beginBusyOperation, finishBusyOperation, queryClient, reply, selectedItem, tInbox, visibility])

  const handleSendReply = React.useCallback(async () => {
    if (
      !selectedItem
      || selectedItem.item_type !== 'request'
      || selectedIdRef.current !== selectedItem.id
      || !reply.trim()
      || actionPendingRef.current
    ) return
    const requestId = selectedItem.id
    const body = reply.trim()
    const attempt = getOrCreateReviewMutationAttempt(
      { action: 'reply', requestId, body },
      () => createReviewUiIdempotencyKey('review-message'),
    )
    const actionGeneration = actionGenerationRef.current + 1
    actionGenerationRef.current = actionGeneration
    const busyGeneration = beginBusyOperation()
    actionPendingRef.current = true
    setActionPending(true)
    setActionError(null)
    try {
      await addReviewMessage({ requestId, body, idempotencyKey: attempt.idempotencyKey })
      clearReviewMutationAttempt(attempt)
      if (selectedIdRef.current !== requestId) return
      if (replyDraftsRef.current.get(requestId)?.trim() === body) {
        replyDraftsRef.current.delete(requestId)
        setReply('')
      }
      try {
        const nextMessages = await listReviewMessages(requestId)
        if (selectedIdRef.current === requestId) setMessages(nextMessages)
      } catch {
        if (selectedIdRef.current === requestId) setActionError(tInbox('reconciliationFailed'))
      }
    } catch (error) {
      if (!isAmbiguousMutationError(error)) clearReviewMutationAttempt(attempt)
      if (selectedIdRef.current === requestId) {
        setActionError(error instanceof Error ? error.message : 'The reply could not be sent.')
      }
    } finally {
      if (isLatestInboxOperation(actionGeneration, actionGenerationRef.current)) {
        actionPendingRef.current = false
        setActionPending(false)
      }
      finishBusyOperation(busyGeneration)
    }
  }, [beginBusyOperation, finishBusyOperation, reply, selectedItem, tInbox])

  const handleVisibilityChange = React.useCallback((nextVisibility: InboxVisibility) => {
    if (nextVisibility === visibility) return
    setVisibility(nextVisibility)
    selectionGenerationRef.current += 1
    selectionAbortRef.current?.abort()
    listGenerationRef.current += 1
    listAbortRef.current?.abort()
    busyGenerationRef.current += 1
    setBusy(false)
    selectedIdRef.current = null
    setShowUnreadOnly(false)
    setSelectedItem(null)
    setMessages([])
    setReply('')
    setOffset(0)
  }, [visibility])

  const handleItemVisibilityAction = React.useCallback(async (action: 'archive' | 'unarchive' | 'delete') => {
    if (!selectedItem || selectedIdRef.current !== selectedItem.id) return
    if (action === 'delete' && !window.confirm(tInbox('deleteConfirm'))) return

    const targetItem = selectedItem
    const busyGeneration = beginBusyOperation()
    try {
      if (action === 'archive') await archiveReviewItem(targetItem.id)
      if (action === 'unarchive') await unarchiveReviewItem(targetItem.id)
      if (action === 'delete') await deleteReviewItem(targetItem.id)

      setItems((current) => current.filter((item) => item.id !== targetItem.id))
      if (selectedIdRef.current === targetItem.id) {
        selectedIdRef.current = null
        setSelectedItem(null)
        setMessages([])
        setReply('')
      }
      await loadItems(0, false, { silent: true })
    } finally {
      finishBusyOperation(busyGeneration)
    }
  }, [beginBusyOperation, finishBusyOperation, loadItems, selectedItem, tInbox])

  const handleResizeStart = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    resizeStartRef.current = { x: event.clientX, width: listWidth }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - resizeStartRef.current.x
      setListWidth(Math.min(520, Math.max(360, resizeStartRef.current.width + delta)))
    }
    const handlePointerUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }, [listWidth])

  if (loading && items.length === 0) return <InboxPageLoading />

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#fbfbfc] dark:bg-background">
      {(loadError || actionError) ? (
        <div role="alert" className="absolute inset-x-3 top-3 z-50 flex items-center gap-3 rounded-xl border border-destructive/30 bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
          <XCircle className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1 text-foreground">{actionError ?? loadError}</span>
          {loadError ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void loadItems(0, false)}>
              <UiText id="try_again_042c862e" />
            </Button>
          ) : (
            <Button type="button" size="icon" variant="ghost" aria-label="Dismiss" onClick={() => setActionError(null)}>
              <XCircle className="size-4" />
            </Button>
          )}
        </div>
      ) : null}
      <div
        className="hidden h-full min-h-0 md:grid"
        style={{ gridTemplateColumns: `${listWidth}px 1px minmax(0, 1fr)` }}
      >
        <InboxList
          items={items}
          now={now}
          unreadCount={unreadCount}
          selectedId={selectedItem?.id}
          total={total}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadMoreError={loadMoreError}
          busy={interactionBusy || loading}
          showUnreadOnly={showUnreadOnly}
          visibility={visibility}
          onUnreadOnlyChange={setShowUnreadOnly}
          onVisibilityChange={handleVisibilityChange}
          onRefresh={() => loadItems(0, false)}
          onLoadMore={() => loadItems(offset, true)}
          onSelect={handleSelect}
        />
        <div
          role="separator"
          aria-label={tAuto('inbox_liste_genisligi_60d10476')}
          aria-orientation="vertical"
          className="group relative cursor-col-resize bg-[#ececef] dark:bg-border"
          onPointerDown={handleResizeStart}
        >
          <span className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 transition-colors group-hover:bg-[#d9d9de]/60" />
        </div>
        <InboxDetail
          item={selectedItem}
          now={now}
          messages={messages}
          unreadCount={unreadCount}
          reply={reply}
          busy={interactionBusy}
          onReplyChange={handleReplyChange}
          onSendReply={handleSendReply}
          onDecision={handleDecision}
          onArchive={() => handleItemVisibilityAction('archive')}
          onUnarchive={() => handleItemVisibilityAction('unarchive')}
          onDelete={() => handleItemVisibilityAction('delete')}
        />
      </div>

      <div className="grid h-full min-h-0 grid-rows-[minmax(220px,42vh)_minmax(0,1fr)] md:hidden">
        <InboxList
          items={items}
          now={now}
          unreadCount={unreadCount}
          selectedId={selectedItem?.id}
          total={total}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadMoreError={loadMoreError}
          busy={interactionBusy || loading}
          showUnreadOnly={showUnreadOnly}
          visibility={visibility}
          onUnreadOnlyChange={setShowUnreadOnly}
          onVisibilityChange={handleVisibilityChange}
          onRefresh={() => loadItems(0, false)}
          onLoadMore={() => loadItems(offset, true)}
          onSelect={handleSelect}
        />
        <InboxDetail
          item={selectedItem}
          now={now}
          messages={messages}
          unreadCount={unreadCount}
          reply={reply}
          busy={interactionBusy}
          onReplyChange={handleReplyChange}
          onSendReply={handleSendReply}
          onDecision={handleDecision}
          onArchive={() => handleItemVisibilityAction('archive')}
          onUnarchive={() => handleItemVisibilityAction('unarchive')}
          onDelete={() => handleItemVisibilityAction('delete')}
        />
      </div>
    </div>
  )
}

function createReviewUiIdempotencyKey(prefix: string) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

export function InboxPageLoading() {
  return (
    <div className="h-full min-h-0 overflow-hidden bg-[#fbfbfc] dark:bg-background">
      <div className="hidden h-full min-h-0 md:grid md:grid-cols-[444px_1px_minmax(0,1fr)]">
        <InboxListLoading />
        <div className="bg-[#ececef] dark:bg-border" />
        <InboxDetailLoading />
      </div>
      <div className="grid h-full min-h-0 grid-rows-[minmax(220px,42vh)_minmax(0,1fr)] md:hidden">
        <InboxListLoading />
        <InboxDetailLoading />
      </div>
    </div>
  )
}

function InboxList({
  items,
  now,
  unreadCount,
  selectedId,
  total,
  hasMore,
  loadingMore,
  loadMoreError,
  busy,
  showUnreadOnly,
  visibility,
  onUnreadOnlyChange,
  onVisibilityChange,
  onRefresh,
  onLoadMore,
  onSelect,
}: {
  items: ReviewItem[]
  now: Date
  unreadCount: number
  selectedId?: string
  total: number
  hasMore: boolean
  loadingMore: boolean
  loadMoreError: string | null
  busy: boolean
  showUnreadOnly: boolean
  visibility: InboxVisibility
  onUnreadOnlyChange: (value: boolean) => void
  onVisibilityChange: (value: InboxVisibility) => void
  onRefresh: () => void
  onLoadMore: () => void
  onSelect: (id: string) => void
}) {
  const tAuto = useTranslations('Auto')
  const scrollRootRef = React.useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!hasMore || loadingMore || busy || loadMoreError) return
    const root = scrollRootRef.current
    const sentinel = loadMoreSentinelRef.current
    if (!root || !sentinel) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
    }, {
      root,
      rootMargin: '160px 0px',
      threshold: 0.01,
    })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [busy, hasMore, loadMoreError, loadingMore, onLoadMore])

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-[#fbfbfc] dark:bg-background">
      <div className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#ececef] px-5 dark:border-border">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[17px] font-medium leading-none text-[#222326] dark:text-foreground">
            {visibility === 'archived' ? tAuto('archived_eddc813f') : tAuto('inbox_44caf746')}
          </h1>
          <span className="rounded-md bg-[#ededf0] px-2 py-1 text-xs text-[#62666d] dark:bg-muted dark:text-muted-foreground">
            {total}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={showUnreadOnly ? 'secondary' : 'ghost'}
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => onUnreadOnlyChange(!showUnreadOnly)}
            disabled={visibility === 'archived'}
            aria-label={tAuto('okunmamis_itemlari_filtrele_65067e3c')}
          >
            <ListFilter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={visibility === 'archived' ? 'secondary' : 'ghost'}
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => onVisibilityChange(visibility === 'archived' ? 'active' : 'archived')}
            aria-label={visibility === 'archived' ? tAuto('inbox_itemlarini_goster_8553cda6') : tAuto('arsivlenen_itemlari_goster_18b3166e')}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={busy}
            aria-label={tAuto('inbox_yenile_aacc6f8e')}
          >
            <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {items.length > 0 ? (
          <div className="space-y-1.5" role="list">
            {items.map((item) => (
              <InboxListItem
                key={item.id}
                item={item}
                now={now}
                selected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
              />
            ))}
            <InboxListLoadMoreSentinel
              ref={loadMoreSentinelRef}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadMoreError={loadMoreError}
              busy={busy}
              onLoadMore={onLoadMore}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center px-8 text-center">
            <div>
              <Inbox className="mx-auto mb-4 h-16 w-16 text-[#6b6f76]" />
              <p className="text-sm font-medium text-[#5f6368] dark:text-muted-foreground">
                {visibility === 'archived' ? tAuto('arsiv_bos_3d624571') : unreadCount === 0 ? tAuto('yeni_review_yok_4fe70f52') : tAuto('filtre_bos_dc303db9')}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const InboxListLoadMoreSentinel = React.forwardRef<HTMLDivElement, {
  hasMore: boolean
  loadingMore: boolean
  loadMoreError: string | null
  busy: boolean
  onLoadMore: () => void
}>(function InboxListLoadMoreSentinel({
  hasMore,
  loadingMore,
  loadMoreError,
  busy,
  onLoadMore,
}, ref) {
  if (!hasMore) return null

  return (
    <div ref={ref} className="flex min-h-12 items-center justify-center py-2">
      {loadingMore ? (
        <span className="text-xs font-medium text-[#70747b] dark:text-muted-foreground" role="status">
          <UiText id="loading_b04ba49f" /></span>
      ) : loadMoreError ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-md text-xs"
          disabled={busy}
          onClick={onLoadMore}
        >
          <UiText id="try_again_042c862e" /></Button>
      ) : (
        <span className="h-1 w-1" aria-hidden="true" />
      )}
    </div>
  )
})

function InboxListItem({ item, now, selected, onSelect }: {
  item: ReviewItem
  now: Date
  selected: boolean
  onSelect: () => void
}) {
  const tInbox = useTranslations('Inbox') as unknown as InboxTranslator
  const format = useFormatter()
  const tone = getInboxItemTone(item, tInbox)
  const ItemIcon = item.item_type === 'request' ? MessageSquareText : Megaphone

  return (
    <button
      type="button"
      role="listitem"
      onClick={onSelect}
      className={cn(
        'grid h-[62px] w-full grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 rounded-[8px] px-2.5 py-2 text-left transition-colors',
        selected ? 'bg-[#f0f0f2] dark:bg-muted/60' : 'bg-[#f4f4f5] hover:bg-[#efeff1] dark:bg-muted/35 dark:hover:bg-muted/55',
      )}
    >
      <span className={cn('mt-1 flex h-8 w-8 items-center justify-center rounded-full text-white', tone.iconClassName)} style={{ background: tone.iconColor }}>
        <ItemIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="flex h-[17px] min-w-0 items-center gap-1.5">
          {item.read_state === 'unread' && <span className="h-2 w-2 shrink-0 rounded-full bg-[#6574df]" />}
          <span className="truncate text-[15px] font-medium leading-[17px] text-[#34363a] dark:text-foreground">
            {getReviewDisplayTitle(item)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[14px] leading-4 text-[#62666d] dark:text-muted-foreground">
          {getReviewDisplayMessage(item)}
        </span>
      </span>
      <span className="pt-[27px] text-[13px] leading-4 text-[#62666d] dark:text-muted-foreground">
        {formatRelativeTime(item.created_at, format, now)}
      </span>
    </button>
  )
}

function InboxDetail({
  item,
  now,
  messages,
  unreadCount,
  reply,
  busy,
  onReplyChange,
  onSendReply,
  onDecision,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  item: ReviewItem | null
  now: Date
  messages: ReviewMessage[]
  unreadCount: number
  reply: string
  busy: boolean
  onReplyChange: (value: string) => void
  onSendReply: () => void
  onDecision: (action: 'approve' | 'reject' | 'request_changes' | 'answer') => void
  onArchive: () => void
  onUnarchive: () => void
  onDelete: () => void
}) {
  const tAuto = useTranslations('Auto')
  const tInbox = useTranslations('Inbox') as unknown as InboxTranslator
  const format = useFormatter()
  if (!item) {
    return (
      <section className="flex h-full min-h-0 min-w-0 items-center justify-center bg-[#fbfbfc] p-8 text-center dark:bg-background">
        <div className="-mt-12">
          <Inbox className="mx-auto h-[120px] w-[120px] text-[#666a70]" />
          <p className="mt-3 text-[16px] font-medium text-[#696b70] dark:text-muted-foreground">
            {tInbox('unreadReviews', { count: unreadCount })}
          </p>
        </div>
      </section>
    )
  }

  const pending = item.item_type === 'request' && item.status === 'pending'
  const StatusIcon = item.status === 'approved' || item.status === 'answered' || item.status === 'read'
    ? CheckCircle2
    : item.status === 'rejected' || item.status === 'changes_requested' || item.status === 'cancelled' || item.status === 'expired'
      ? XCircle
      : Clock3
  const tone = getInboxItemTone(item, tInbox)
  const showStatusPill = item.item_type === 'request' || item.status !== 'read'
  const approvalRequest = isApprovalRequest(item)

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-[#fbfbfc] dark:bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#ececef] px-6 dark:border-border">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', getStatusDotClassName(item.status))} />
          <span className="truncate text-sm font-medium text-[#2f3135] dark:text-foreground">
            {item.item_type === 'request' ? item.request_kind ?? 'review' : tone.label}
          </span>
          <span className="text-sm text-[#777b82] dark:text-muted-foreground">
            {item.source_bc ? tInbox('from', { source: item.source_bc }) : tInbox('system')}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7" aria-label={tAuto('review_menu_c46a70b7')} disabled={busy}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {item.archived_at ? (
              <DropdownMenuItem onClick={onUnarchive} disabled={busy}>
                <ArchiveRestore className="h-4 w-4" />
                <UiText id="unarchive_35e71c29" /></DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onArchive} disabled={busy}>
                <Archive className="h-4 w-4" />
                <UiText id="archive_2621c6fd" /></DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} disabled={busy} variant="destructive">
              <Trash2 className="h-4 w-4" />
              {tInbox('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        <div className="mx-auto w-full max-w-4xl px-8 py-7">
          <div className="mb-6 flex items-start justify-between gap-5">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold leading-8 text-[#25272b] dark:text-foreground">
                {getReviewDisplayTitle(item)}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#70747b] dark:text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4" />
                  {item.thread_id ?? item.source_id ?? tAuto('inbox_44caf746')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4" />
                  {formatRelativeTime(item.created_at, format, now)}
                </span>
              </div>
            </div>
            {showStatusPill ? (
              <span className={cn('inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium', getStatusClassName(item.status))}>
                <StatusIcon className="h-3.5 w-3.5" />
                {getStatusLabel(item.status, tInbox)}
              </span>
            ) : null}
          </div>

          {approvalRequest ? (
            <InboxApprovalCard
              item={item}
              busy={busy}
              onDecision={onDecision}
            />
          ) : (
            <InboxMessageCard item={item} />
          )}

          {messages.length > 0 && (
            <div className="mt-5 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-xl border border-[#e8e8eb] bg-white p-4 text-sm shadow-[0_1px_2px_rgba(20,20,20,0.04)] dark:border-border dark:bg-card"
                >
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[#70747b]">
                    {message.author_type}
                  </div>
                  <p className="whitespace-pre-wrap leading-6 text-[#4b4f56] dark:text-muted-foreground">{message.body}</p>
                </div>
              ))}
            </div>
          )}

          {pending && !approvalRequest && (
            <div className="mt-5 flex flex-wrap gap-2">
              {item.allowed_actions.includes('approve') && (
                <Button type="button" size="sm" className="h-8 gap-1.5 rounded-md" disabled={busy} onClick={() => onDecision('approve')}>
                  <ThumbsUp className="h-4 w-4" />
                  <UiText id="approve_7b2c7f14" /></Button>
              )}
              {item.allowed_actions.includes('request_changes') && (
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-md bg-white dark:bg-background" disabled={busy} onClick={() => onDecision('request_changes')}>
                  <XCircle className="h-4 w-4" />
                  <UiText id="request_changes_bbd0717f" /></Button>
              )}
              {item.allowed_actions.includes('answer') && (
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-md bg-white dark:bg-background" disabled={busy || !reply.trim()} onClick={() => onDecision('answer')}>
                  <Send className="h-4 w-4" />
                  <UiText id="reply_6c2bb735" /></Button>
              )}
              {item.allowed_actions.includes('reject') && (
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-md bg-white dark:bg-background" disabled={busy} onClick={() => onDecision('reject')}>
                  <XCircle className="h-4 w-4" />
                  <UiText id="reject_2b03b592" /></Button>
              )}
            </div>
          )}
        </div>
      </div>

      {item.item_type === 'request' && pending && (
        <div className="shrink-0 border-t border-[#ececef] bg-[#fbfbfc] px-6 py-4 dark:border-border dark:bg-background">
          <div className="mx-auto flex w-full max-w-4xl items-end gap-2">
            <Textarea
              value={reply}
              onChange={(event) => onReplyChange(event.target.value)}
              placeholder={tAuto('write_a_short_reply_a743a2af')}
              className="min-h-10 flex-1 resize-none rounded-lg border-[#e2e2e5] bg-white text-sm shadow-none dark:border-border dark:bg-card"
            />
            <Button type="button" size="icon" className="h-10 w-10 shrink-0 rounded-lg" onClick={onSendReply} disabled={busy || !reply.trim()} aria-label={tAuto('send_message_c70a890d')}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function InboxApprovalCard({
  item,
  busy,
  onDecision,
}: {
  item: ReviewItem
  busy: boolean
  onDecision: (action: 'approve' | 'reject' | 'request_changes' | 'answer') => void
}) {
  const tInbox = useTranslations('Inbox') as unknown as InboxTranslator
  const format = useFormatter()
  const chatHref = getAssistantChatHref(item)
  const context = getApprovalContext(item, tInbox, format)
  const pending = item.status === 'pending'

  return (
    <div className="rounded-lg border border-[#dfe3f6] bg-white p-4 shadow-[0_1px_2px_rgba(20,20,20,0.04)] dark:border-border dark:bg-card">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef1ff] text-[#5665d9] dark:bg-primary/15 dark:text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#25272b] dark:text-foreground"><UiText id="pending_approval_25d1b4bb" /></p>
            {(item.delivery_surface === 'chat_inline' || item.payload.delivery_surface === 'chat_inline') && (
              <span className="rounded-md bg-[#eef1ff] px-2 py-1 text-xs font-medium text-[#5665d9] dark:bg-primary/15 dark:text-primary">
                <UiText id="chat_fallback_caae7eb3" /></span>
            )}
          </div>
          <h3 className="mt-2 text-xl font-semibold leading-7 text-[#25272b] dark:text-foreground">
            {getReviewDisplayTitle(item)}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4b4f56] dark:text-muted-foreground">
            {getReviewDisplayMessage(item)}
          </p>
          {context.brief ? (
            <p className="mt-2 text-sm font-medium leading-6 text-[#343942] dark:text-foreground">
              {context.brief}
            </p>
          ) : null}

          <ApprovalFlowSummary context={context} />
          <ApprovalDecisionImpact context={context} />
          <ApprovalContextPanel context={context} />

          <div className="mt-5 flex flex-wrap gap-2">
            {pending && item.allowed_actions.includes('approve') && (
              <Button type="button" size="sm" className="h-8 gap-1.5 rounded-md" disabled={busy} onClick={() => onDecision('approve')}>
                <ThumbsUp className="h-4 w-4" />
                <UiText id="approve_7b2c7f14" /></Button>
            )}
            {pending && item.allowed_actions.includes('request_changes') && (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-md bg-white dark:bg-background" disabled={busy} onClick={() => onDecision('request_changes')}>
                <XCircle className="h-4 w-4" />
                <UiText id="request_changes_bbd0717f" /></Button>
            )}
            {pending && item.allowed_actions.includes('reject') && (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-md bg-white dark:bg-background" disabled={busy} onClick={() => onDecision('reject')}>
                <XCircle className="h-4 w-4" />
                <UiText id="reject_2b03b592" /></Button>
            )}
            {chatHref && (
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-md">
                <Link href={chatHref}>
                  <UiText id="open_in_chat_756b7a12" /><ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type ApprovalMediaAsset = {
  id: string
  name: string
  kind: 'image' | 'video' | 'audio' | 'file'
  url: string | null
  previewUrl: string | null
  meta: string | null
}

type ApprovalContext = {
  prompt: string | null
  assets: ApprovalMediaAsset[]
  details: Array<{ label: string; value: string }>
  source: ApprovalFlowNode
  current: ApprovalFlowNode
  next: ApprovalFlowNode
  brief: string | null
  approveImpact: string
  stopImpact: string
}

type ApprovalFlowNode = {
  id: string | null
  label: string
  kind: string | null
}

function ApprovalFlowSummary({ context }: { context: ApprovalContext }) {
  const tInbox = useTranslations('Inbox') as unknown as InboxTranslator
  const steps = [
    { eyebrow: tInbox('flow.before'), node: context.source },
    { eyebrow: tInbox('flow.review'), node: context.current },
    { eyebrow: tInbox('flow.afterApproval'), node: context.next },
  ]

  return (
    <div className="mt-4 rounded-lg border border-[#e5e7f3] bg-[#fbfbfd] p-3 dark:border-border dark:bg-muted/20">
      <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {steps.map((step, index) => (
          <React.Fragment key={step.eyebrow}>
            <div className="min-w-0 rounded-md bg-white px-3 py-2.5 dark:bg-background">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#70747b]">{step.eyebrow}</p>
              <p className="mt-1 truncate text-sm font-semibold text-[#30333a] dark:text-foreground">{step.node.label}</p>
              {step.node.kind ? (
                <p className="mt-0.5 truncate text-xs text-[#70747b]">{formatReviewNodeKind(step.node.kind, tInbox)}</p>
              ) : null}
            </div>
            {index < steps.length - 1 ? (
              <div className="hidden items-center text-[#7b8190] md:flex">
                <ArrowRight className="h-4 w-4" />
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function ApprovalDecisionImpact({ context }: { context: ApprovalContext }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-success/20 bg-success/5 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-success"><UiText id="approve_7b2c7f14" /></p>
        <p className="mt-1 text-sm leading-5 text-[#3f434a] dark:text-muted-foreground">{context.approveImpact}</p>
      </div>
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-destructive"><UiText id="reject_request_changes_d850e555" /></p>
        <p className="mt-1 text-sm leading-5 text-[#3f434a] dark:text-muted-foreground">{context.stopImpact}</p>
      </div>
    </div>
  )
}

function ApprovalContextPanel({ context }: { context: ApprovalContext }) {
  const [previewAsset, setPreviewAsset] = React.useState<ApprovalMediaAsset | null>(null)
  if (!context.prompt && context.assets.length === 0 && context.details.length === 0) return null

  return (
    <>
      <div className="mt-4 rounded-lg border border-[#ececf1] bg-[#fbfbfd] p-4 dark:border-border dark:bg-muted/20">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#25272b] dark:text-foreground">
          <FileText className="h-4 w-4 text-[#6574df]" />
          <UiText id="decision_context_b59edd63" /></div>

        {context.prompt && (
          <div className="rounded-md border border-[#ececf1] bg-white p-3 dark:border-border dark:bg-background">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#70747b]"><UiText id="prompt_instruction_4a935b54" /></p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[#3f434a] dark:text-muted-foreground">{context.prompt}</p>
          </div>
        )}

        {context.assets.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#70747b]"><UiText id="materials_2402ea36" /></p>
            <div className="grid gap-3 sm:grid-cols-2">
              {context.assets.map((asset) => (
                <ApprovalAssetCard key={asset.id} asset={asset} onOpen={setPreviewAsset} />
              ))}
            </div>
          </div>
        )}

        {context.details.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {context.details.map((detail) => (
              <div key={`${detail.label}:${detail.value}`} className="rounded-md border border-[#ececf1] bg-white p-3 dark:border-border dark:bg-background">
                <p className="text-xs font-medium uppercase tracking-wide text-[#70747b]">{detail.label}</p>
                <p className="mt-1 break-words text-sm leading-5 text-[#4b4f56] dark:text-muted-foreground">{detail.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ApprovalAssetPreviewDialog
        asset={previewAsset}
        onOpenChange={(open) => {
          if (!open) setPreviewAsset(null)
        }}
      />
    </>
  )
}

function ApprovalAssetCard({
  asset,
  onOpen,
}: {
  asset: ApprovalMediaAsset
  onOpen: (asset: ApprovalMediaAsset) => void
}) {
  const icon = asset.kind === 'image'
    ? <ImageIcon className="h-5 w-5" />
    : asset.kind === 'video'
      ? <Film className="h-5 w-5" />
      : <FileText className="h-5 w-5" />
  const preview = asset.previewUrl ?? asset.url

  return (
    <button
      type="button"
      className="block w-full overflow-hidden rounded-md border border-[#e4e6f0] bg-white text-left transition hover:border-[#cfd5ee] hover:shadow-[0_6px_18px_rgba(20,20,20,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-border dark:bg-background dark:hover:border-primary/40"
      onClick={() => onOpen(asset)}
    >
      <div className="flex aspect-video items-center justify-center bg-[#f4f5fb] text-[#6574df] dark:bg-muted/40">
        {preview && asset.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={asset.name} className="h-full w-full object-cover" />
        ) : preview && asset.kind === 'video' ? (
          <video src={preview} muted playsInline preload="metadata" className="h-full w-full bg-black object-cover" />
        ) : (
          icon
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium text-[#25272b] dark:text-foreground">{asset.name}</p>
        {asset.meta && <p className="mt-1 truncate text-xs text-[#70747b]">{asset.meta}</p>}
      </div>
    </button>
  )
}

function ApprovalAssetPreviewDialog({
  asset,
  onOpenChange,
}: {
  asset: ApprovalMediaAsset | null
  onOpenChange: (open: boolean) => void
}) {
  const src = asset?.url ?? asset?.previewUrl ?? null

  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(1080px,calc(100vw-2rem))] overflow-hidden p-0" showCloseButton>
        {asset ? (
          <>
            <DialogHeader className="border-b border-border/70 px-5 py-4">
              <DialogTitle className="truncate pr-8 text-base">{asset.name}</DialogTitle>
              <DialogDescription className="sr-only">
                <UiText id="inbox_approval_material_preview_94c57759" /></DialogDescription>
            </DialogHeader>
            <div className="max-h-[calc(92vh-74px)] overflow-auto bg-[#0f1115]">
              {src && asset.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={asset.name} className="mx-auto max-h-[calc(92vh-74px)] w-auto max-w-full object-contain" />
              ) : src && asset.kind === 'video' ? (
                <video src={src} controls autoPlay playsInline className="max-h-[calc(92vh-74px)] w-full bg-black object-contain" />
              ) : src && asset.kind === 'audio' ? (
                <div className="flex min-h-[260px] items-center justify-center bg-background p-8">
                  <audio src={src} controls autoPlay className="w-full max-w-2xl" />
                </div>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 bg-background p-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground"><UiText id="no_visual_preview_is_available_for_this_material_f17732b5" /></p>
                  {src ? (
                    <Button type="button" onClick={() => window.location.assign(src)}>
                      <UiText id="open_file_f11b8781" /></Button>
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function InboxMessageCard({ item }: { item: ReviewItem }) {
  const tAuto = useTranslations('Auto')
  const tInbox = useTranslations('Inbox') as unknown as InboxTranslator
  const tone = getInboxItemTone(item, tInbox)
  const cta = getInboxCta(item)
  const creative = getInboxCreative(item)
  const MessageIcon = item.item_type === 'request' ? MessageSquareText : Megaphone

  return (
    <div
      className={cn(
        'rounded-xl border p-5 shadow-[0_1px_2px_rgba(20,20,20,0.04)]',
        item.item_type === 'request' ? 'border-[#e8e8eb] bg-white dark:border-border dark:bg-card' : tone.cardClassName,
      )}
      style={item.item_type === 'message' ? { borderColor: tone.borderColor } : undefined}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#2f3135] dark:text-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: tone.iconColor }}>
          <MessageIcon className="h-3.5 w-3.5" />
        </span>
        {item.item_type === 'request' ? tAuto('message_68f4145f') : tone.label}
      </div>
      {creative ? <InboxCreativeBlock creative={creative} /> : null}
      <p className="whitespace-pre-wrap text-sm leading-6 text-[#4b4f56] dark:text-muted-foreground">
        {getReviewDisplayMessage(item)}
      </p>
      {cta ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {cta.external ? (
            <Button asChild size="sm" className="h-8 gap-1.5" style={{ background: tone.iconColor }}>
              <a href={cta.href} target="_blank" rel="noreferrer">
                {cta.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : (
            <Button asChild size="sm" className="h-8" style={{ background: tone.iconColor }}>
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

type InboxCreative =
  | { mode: 'media'; mediaType: 'image' | 'video'; mediaUrl: string; mediaAlt: string; layout: 'card' | 'hero' | 'split' }
  | { mode: 'html'; html: string; css: string }

function InboxCreativeBlock({ creative }: { creative: InboxCreative }) {
  const tAuto = useTranslations('Auto')
  if (creative.mode === 'html') {
    return (
      <iframe
        title={tAuto('inbox_announcement_creative_3c55bd26')}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={buildCreativeSrcDoc(creative.html, creative.css)}
        className="mb-5 h-[320px] w-full rounded-lg border border-[#e8e8eb] bg-transparent dark:border-border"
      />
    )
  }

  return (
    <div className={cn(
      'mb-5 overflow-hidden rounded-lg border border-[#e8e8eb] bg-white dark:border-border dark:bg-card',
      creative.layout === 'hero' ? 'aspect-video' : 'aspect-[16/9]',
      creative.layout === 'split' && 'md:aspect-[21/9]',
    )}>
      {creative.mediaType === 'video' ? (
        <video src={creative.mediaUrl} controls playsInline className="h-full w-full bg-black object-contain" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={creative.mediaUrl} alt={creative.mediaAlt} className="h-full w-full object-cover" />
      )}
    </div>
  )
}

function InboxListLoading() {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-[#fbfbfc] dark:bg-background">
      <div className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#ececef] px-5 dark:border-border">
        <Skeleton className="h-5 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2">
        {[0, 1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="grid h-[62px] w-full grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 rounded-[8px] bg-[#f4f4f5] px-2.5 py-2 dark:bg-muted/35">
            <Skeleton className="mt-1 h-8 w-8 rounded-full" />
            <span className="min-w-0 space-y-2 pt-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </span>
            <Skeleton className="mt-[27px] h-3 w-10" />
          </div>
        ))}
      </div>
    </section>
  )
}

function InboxDetailLoading() {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-[#fbfbfc] dark:bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#ececef] px-6 dark:border-border">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        <div className="mx-auto w-full max-w-4xl px-8 py-7">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-5 h-32 w-full rounded-xl" />
        </div>
      </div>
    </section>
  )
}

function mergeItems(current: ReviewItem[], incoming: ReviewItem[]) {
  const map = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  return Array.from(map.values())
}

function trackUnreadItems(
  items: ReviewItem[],
  knownUnreadIdsRef: React.MutableRefObject<Set<string> | null>,
  notifyOnNewUnread?: boolean,
) {
  const unreadIds = new Set(items.filter((item) => item.read_state === 'unread').map((item) => item.id))
  const previousUnreadIds = knownUnreadIdsRef.current
  knownUnreadIdsRef.current = unreadIds

  if (!previousUnreadIds || !notifyOnNewUnread) return
  const hasNewUnread = Array.from(unreadIds).some((id) => !previousUnreadIds.has(id))
  if (hasNewUnread) playInboxNotificationSound()
}

function playInboxNotificationSound() {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    const audioContext = new AudioContextCtor()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, now)
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.14)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.2)
    window.setTimeout(() => {
      void audioContext.close().catch(() => undefined)
    }, 260)
  } catch {
    // Browsers can block audio until the user interacts with the page.
  }
}

function getInboxItemTone(item: ReviewItem, t: InboxTranslator) {
  const tone = getPayloadString(item.payload.message_tone)
  const accentColor = getAccentColor(item.payload.accent_color)

  if (item.item_type === 'request') {
    return {
      label: t('tone.review'),
      iconColor: '#6574df',
      borderColor: '#e8e8eb',
      iconClassName: '',
      cardClassName: 'border-[#e8e8eb] bg-white dark:border-border dark:bg-card',
    }
  }

  if (tone === 'product_update') {
    return {
      label: t('tone.productUpdate'),
      iconColor: accentColor ?? '#0f766e',
      borderColor: accentColor ?? '#0f766e',
      iconClassName: '',
      cardClassName: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20',
    }
  }

  if (tone === 'system') {
    return {
      label: t('tone.systemMessage'),
      iconColor: accentColor ?? '#475569',
      borderColor: accentColor ?? '#475569',
      iconClassName: '',
      cardClassName: 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/20',
    }
  }

  if (tone === 'review') {
    return {
      label: t('tone.reviewNotice'),
      iconColor: accentColor ?? '#4f46e5',
      borderColor: accentColor ?? '#4f46e5',
      iconClassName: '',
      cardClassName: 'border-indigo-200 bg-indigo-50/80 dark:border-indigo-900/60 dark:bg-indigo-950/20',
    }
  }

  return {
    label: t('tone.announcement'),
    iconColor: accentColor ?? '#2563eb',
    borderColor: accentColor ?? '#2563eb',
    iconClassName: '',
    cardClassName: 'border-sky-200 bg-sky-50/80 dark:border-sky-900/60 dark:bg-sky-950/20',
  }
}

function isApprovalRequest(item: ReviewItem) {
  return item.item_type === 'request' && (item.request_kind === 'approval' || item.request_kind === 'publish_approval')
}

function refreshWorkflowQueriesAfterDecision(queryClient: QueryClient, previousItem: ReviewItem, nextItem: ReviewItem) {
  if (!isWorkflowReviewItem(previousItem) && !isWorkflowReviewItem(nextItem)) return

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: WORKFLOWS_QUERY_KEY })
  }

  refresh()
  window.setTimeout(refresh, 1_200)
  window.setTimeout(refresh, 3_500)
  window.setTimeout(refresh, 7_000)
}

function isWorkflowReviewItem(item: ReviewItem) {
  return item.source_bc === 'workflow' || Boolean(getPayloadString(item.payload.workflow_id))
}

function getAssistantChatHref(item: ReviewItem) {
  const assistant = readPayloadRecord(item.payload.assistant)
  const conversationId = getPayloadString(item.payload.assistant_conversation_id)
    ?? getPayloadString(assistant.conversation_id)
    ?? getPayloadString(assistant.conversationId)
    ?? parseAssistantConversationThread(item.thread_id)
  return conversationId ? `/chat?id=${encodeURIComponent(conversationId)}` : null
}

function getApprovalContext(item: ReviewItem, t: InboxTranslator, format: InboxFormatter): ApprovalContext {
  const nodeInputs = readPayloadRecord(item.payload.node_inputs)
  const source = getApprovalFlowNode(item, 'source', t)
  const current = getApprovalFlowNode(item, 'current', t)
  const next = getApprovalFlowNode(item, 'next', t)
  const prompt = firstPayloadString(
    item.payload.prompt,
    item.payload.user_prompt,
    item.payload.image_prompt,
    item.payload.video_prompt,
    item.payload.approval_prompt,
    item.payload.instructions,
    nodeInputs.prompt,
    nodeInputs.user_prompt,
    nodeInputs.image_prompt,
    nodeInputs.video_prompt,
    nodeInputs.approval_prompt,
    nodeInputs.instructions,
    nodeInputs.task,
    nodeInputs.description,
  )
  const decisionImpact = getApprovalDecisionImpact(item, next.label, t)
  const brief = normalizeLegacyApprovalText(firstPayloadString(item.payload.approval_decision_brief), t)
    ?? buildApprovalBrief(item, source.label, next.label, t)

  const details: Array<{ label: string; value: string }> = []
  pushDetail(details, t('details.model'), firstPayloadString(item.payload.model_id, nodeInputs.model_id, nodeInputs.model))
  pushDetail(details, t('details.count'), firstPayloadString(item.payload.count, nodeInputs.count, nodeInputs.num_outputs, nodeInputs.n))
  pushDetail(details, t('details.duration'), firstPayloadString(item.payload.duration, nodeInputs.duration, nodeInputs.duration_seconds))
  pushDetail(details, t('details.size'), firstPayloadString(item.payload.aspect_ratio, nodeInputs.aspect_ratio, nodeInputs.size, nodeInputs.resolution))
  pushDetail(details, t('details.quality'), firstPayloadString(item.payload.quality, nodeInputs.quality))
  if (item.expires_at) pushDetail(details, t('details.deadline'), formatDateTime(item.expires_at, format))

  return {
    prompt,
    assets: collectApprovalAssets(item.payload),
    details,
    source,
    current,
    next,
    brief,
    approveImpact: decisionImpact.approveImpact,
    stopImpact: decisionImpact.stopImpact,
  }
}

function getApprovalFlowNode(item: ReviewItem, role: 'source' | 'current' | 'next', t: InboxTranslator): ApprovalFlowNode {
  const reviewContext = readPayloadRecord(item.payload.review_context)
  if (role === 'current') {
    const currentNode = readPayloadRecord(reviewContext.current_node)
    return {
      id: getPayloadString(currentNode.id) ?? getPayloadString(item.payload.node_key),
      label: normalizeReviewNodeLabel(firstPayloadString(currentNode.label), t) ?? t('flow.reviewGate'),
      kind: getPayloadString(currentNode.kind) ?? 'review',
    }
  }

  const primaryLabel = role === 'source'
    ? firstPayloadString(reviewContext.primary_source_label)
    : firstPayloadString(reviewContext.primary_next_label)
  const primaryKind = role === 'source'
    ? getPayloadString(reviewContext.primary_source_kind)
    : getPayloadString(reviewContext.primary_next_kind)
  const nodesKey = role === 'source' ? 'upstream_nodes' : 'downstream_nodes'
  const nodes = Array.isArray(reviewContext[nodesKey])
    ? reviewContext[nodesKey].map(readPayloadRecord)
    : []
  const firstNode = nodes[0] ?? {}
  const fallback = role === 'source' ? t('flow.previousStep') : t('flow.nextStep')

  return {
    id: getPayloadString(firstNode.id),
    label: formatReviewNodeListLabel(nodes, primaryLabel, fallback, t),
    kind: primaryKind ?? getPayloadString(firstNode.kind),
  }
}

function formatReviewNodeListLabel(
  nodes: Array<Record<string, unknown>>,
  primaryLabel: string | null,
  fallback: string,
  t: InboxTranslator,
) {
  const labels = nodes
    .map((node) => normalizeReviewNodeLabel(firstPayloadString(node.label, node.id), t))
    .filter((label): label is string => Boolean(label))
  const primary = normalizeReviewNodeLabel(primaryLabel, t)
  if (primary && primary.toLowerCase() !== fallback.toLowerCase()) {
    if (labels.length > 1) return t('flow.more', { label: primary, count: labels.length - 1 })
    return primary
  }
  if (labels.length > 1) return t('flow.more', { label: labels[0], count: labels.length - 1 })
  return labels[0] ?? fallback
}

function getApprovalDecisionImpact(item: ReviewItem, nextLabel: string, t: InboxTranslator) {
  const impact = normalizeLegacyApprovalText(firstPayloadString(item.payload.approval_impact), t)
  if (impact) {
    const parts = impact.split(/;\s*/)
    if (parts.length > 1) {
      return {
        approveImpact: ensurePeriod(parts[0]),
        stopImpact: ensurePeriod(parts.slice(1).join('; ')),
      }
    }
    return {
      approveImpact: ensurePeriod(impact),
      stopImpact: t('approval.stopImpact'),
    }
  }

  return {
    approveImpact: t('approval.continueImpact', { next: nextLabel }),
    stopImpact: t('approval.stopImpact'),
  }
}

function buildApprovalBrief(item: ReviewItem, sourceLabel: string, nextLabel: string, t: InboxTranslator) {
  const materialCount = collectApprovalAssets(item.payload).length
  if (materialCount > 0) {
    return t('approval.materialsBrief', { count: materialCount, source: sourceLabel, next: nextLabel })
  }
  return t('approval.handoffBrief', { source: sourceLabel, next: nextLabel })
}

function collectApprovalAssets(payload: Record<string, unknown>): ApprovalMediaAsset[] {
  const roots = [
    payload.media_refs,
    payload.assets,
    payload.images,
    payload.image_refs,
    payload.input_images,
    payload.source_images,
    payload.videos,
    payload.video_refs,
    payload.artifacts,
    payload.outputs,
    payload.output,
    payload.generated,
    payload.node_inputs,
    payload.upstream_outputs,
  ]
  const assets: ApprovalMediaAsset[] = []
  const seen = new Set<string>()
  for (const root of roots) collectApprovalAssetsFromValue(root, assets, seen, 0)
  return assets.slice(0, 12)
}

function collectApprovalAssetsFromValue(
  value: unknown,
  assets: ApprovalMediaAsset[],
  seen: Set<string>,
  depth: number,
) {
  if (assets.length >= 12 || depth > 4) return
  if (typeof value === 'string') {
    addApprovalAsset(approvalAssetFromScalar(value, assets.length), assets, seen)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectApprovalAssetsFromValue(item, assets, seen, depth + 1)
    return
  }
  const record = readPayloadRecord(value)
  if (Object.keys(record).length === 0) return

  addApprovalAsset(approvalAssetFromRecord(record, assets.length), assets, seen)

  for (const nested of Object.values(record)) {
    if (assets.length >= 12) return
    if (Array.isArray(nested) || (nested && typeof nested === 'object')) {
      collectApprovalAssetsFromValue(nested, assets, seen, depth + 1)
    }
  }
}

function addApprovalAsset(
  asset: ApprovalMediaAsset | null,
  assets: ApprovalMediaAsset[],
  seen: Set<string>,
) {
  if (!asset) return
  const dedupeKey = asset.url ?? asset.previewUrl ?? asset.id
  if (seen.has(dedupeKey)) return
  seen.add(dedupeKey)
  assets.push(asset)
}

function approvalAssetFromScalar(value: string, index: number): ApprovalMediaAsset | null {
  const url = value.trim()
  if (!isSafeCtaHref(url)) return null
  const kind = inferApprovalAssetKind(null, null, '', url)
  if (kind === 'file') return null

  return {
    id: url,
    name: approvalAssetName(kind, index),
    kind,
    url,
    previewUrl: url,
    meta: kind,
  }
}

function approvalAssetFromRecord(record: Record<string, unknown>, index: number): ApprovalMediaAsset | null {
  const url = firstPayloadString(record.url, record.cdn_url, record.image_url, record.video_url, record.artifact_url, record.download_url)
  const previewUrl = firstPayloadString(record.preview_url, record.previewUrl, record.thumbnail_url, record.thumbnailUrl, record.poster_url) ?? url
  const objectId = firstPayloadString(record.object_id, record.objectId, record.storage_object_id)
  if (!url && !previewUrl && !objectId) return null

  const mimeType = firstPayloadString(record.mime_type, record.mimeType, record.content_type, record.contentType)
  const name = firstPayloadString(record.name, record.file_name, record.filename, record.image_id, record.video_id, objectId) ?? `material-${index + 1}`
  const kind = inferApprovalAssetKind(firstPayloadString(record.kind, record.type, record.media_type), mimeType, name, url ?? previewUrl)
  const safeUrl = url && isSafeCtaHref(url) ? url : null
  const safePreviewUrl = previewUrl && isSafeCtaHref(previewUrl) ? previewUrl : null
  const meta = [kind, mimeType].filter(Boolean).join(' - ') || null

  return {
    id: firstPayloadString(record.id, objectId, safeUrl, safePreviewUrl) ?? `material-${index}`,
    name,
    kind,
    url: safeUrl,
    previewUrl: safePreviewUrl,
    meta,
  }
}

function inferApprovalAssetKind(
  rawKind: string | null,
  mimeType: string | null,
  name: string,
  url: string | null,
): ApprovalMediaAsset['kind'] {
  const value = `${rawKind ?? ''} ${mimeType ?? ''} ${name} ${url ?? ''}`.toLowerCase()
  if (value.includes('video') || /\.(mp4|mov|webm|m4v)(\?|$)/.test(value)) return 'video'
  if (value.includes('audio') || /\.(mp3|wav|m4a|aac)(\?|$)/.test(value)) return 'audio'
  if (value.includes('image') || /\.(png|jpe?g|webp|gif|avif)(\?|$)/.test(value)) return 'image'
  return 'file'
}

function approvalAssetName(kind: ApprovalMediaAsset['kind'], index: number) {
  if (kind === 'image') return `Image ${index + 1}`
  if (kind === 'video') return `Video ${index + 1}`
  if (kind === 'audio') return `Audio ${index + 1}`
  return `Material ${index + 1}`
}

function pushDetail(details: Array<{ label: string; value: string }>, label: string, value: string | null) {
  if (!value) return
  if (details.some((detail) => detail.label === label && detail.value === value)) return
  details.push({ label, value })
}

function firstPayloadString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    const text = getPayloadString(value)
    if (text) return text
  }
  return null
}

function normalizeReviewNodeLabel(value: string | null, t: InboxTranslator) {
  if (!value) return null
  const labels: Record<string, string> = {
    'sonraki adim': t('legacy.nextStep'),
    'gorsel uretimi': t('legacy.imageGeneration'),
    'video uretimi': t('legacy.videoGeneration'),
    yayin: t('legacy.publishing'),
    'metin uretimi': t('legacy.textGeneration'),
    'dosya islemi': t('legacy.fileOperation'),
  }
  return labels[value.trim().toLowerCase()] ?? value.trim()
}

function normalizeLegacyApprovalText(value: string | null, t: InboxTranslator) {
  if (!value) return null
  const text = value.trim()
  const legacyImpact = /^Onaylanirsa (.+?) calisir; red veya revizyon karari sonraki adimi durdurur\.?$/i.exec(text)
  if (legacyImpact) {
    const target = normalizeReviewNodeLabel(legacyImpact[1], t) ?? legacyImpact[1]
    return t('approval.legacyImpact', { target })
  }
  return text
    .replace(/\bsonraki adim\b/gi, t('legacy.nextStep'))
    .replace(/\bgorsel uretimi\b/gi, t('legacy.imageGeneration'))
    .replace(/\bvideo uretimi\b/gi, t('legacy.videoGeneration'))
    .replace(/\byayin\b/gi, t('legacy.publishing'))
    .replace(/\bmetin uretimi\b/gi, t('legacy.textGeneration'))
    .replace(/\bdosya islemi\b/gi, t('legacy.fileOperation'))
}

function formatReviewNodeKind(kind: string, t: InboxTranslator) {
  const normalized = kind.toLowerCase()
  if (normalized === 'review') return t('flow.reviewGate')
  if (normalized === 'image') return t('flow.imageNode')
  if (normalized === 'video') return t('flow.videoNode')
  if (normalized === 'publish') return t('flow.publishingNode')
  if (normalized === 'text') return t('flow.textNode')
  if (normalized === 'file') return t('flow.fileNode')
  return t('flow.workflowStep')
}

function ensurePeriod(value: string) {
  const text = value.trim()
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function formatDateTime(value: string, format: InboxFormatter) {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return value
  return format.dateTime(timestamp, { dateStyle: 'medium', timeStyle: 'short' })
}

function parseAssistantConversationThread(threadId: string | null) {
  const prefix = 'assistant:conversation:'
  return threadId?.startsWith(prefix) ? threadId.slice(prefix.length) || null : null
}

function getInboxCta(item: ReviewItem): { label: string; href: string; external: boolean } | null {
  const label = getPayloadString(item.payload.cta_label)
  const href = getPayloadString(item.payload.cta_href)
  if (!label || !href || !isSafeCtaHref(href)) return null
  return { label, href, external: /^https?:\/\//i.test(href) }
}

function getInboxCreative(item: ReviewItem): InboxCreative | null {
  if (item.item_type !== 'message') return null

  const mode = getPayloadString(item.payload.creative_mode)
  if (mode === 'html') {
    const html = getPayloadString(item.payload.creative_html)
    if (!html) return null
    return {
      mode: 'html',
      html,
      css: getPayloadString(item.payload.creative_css) ?? '',
    }
  }

  if (mode === 'media') {
    const mediaUrl = getPayloadString(item.payload.media_url)
    const mediaType = getPayloadString(item.payload.media_type)
    if (!mediaUrl || !isSafeCtaHref(mediaUrl) || (mediaType !== 'image' && mediaType !== 'video')) return null
    return {
      mode: 'media',
      mediaType,
      mediaUrl,
      mediaAlt: getPayloadString(item.payload.media_alt) ?? getReviewDisplayTitle(item),
      layout: getCreativeLayout(item.payload.creative_layout),
    }
  }

  return null
}

function getCreativeLayout(value: unknown): 'card' | 'hero' | 'split' {
  const layout = getPayloadString(value)
  if (layout === 'hero' || layout === 'split') return layout
  return 'card'
}

function buildCreativeSrcDoc(html: string, css: string): string {
  const safeHtml = sanitizeCreativeHtml(html)
  const safeCss = sanitizeCreativeCss(css)
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>:root{color-scheme:light dark}html,body{min-height:100%;margin:0;background:transparent;color:#111827;font-family:Inter,Arial,sans-serif;overflow-wrap:anywhere}body{padding:0}*{box-sizing:border-box}img,video{max-width:100%;height:auto}a{color:inherit}@media (prefers-color-scheme:dark){html,body{color:#f8fafc}}${safeCss}</style></head><body>${safeHtml}</body></html>`
}

function sanitizeCreativeHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|form|input|textarea|button|meta|link|base)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|form|input|textarea|button|meta|link|base)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
}

function sanitizeCreativeCss(value: string): string {
  return value
    .replace(/@import[^;]+;/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/expression\s*\(/gi, '')
}

function isSafeCtaHref(href: string) {
  return (href.startsWith('/') && !href.startsWith('//')) || /^https?:\/\/[^\s]+$/i.test(href)
}

function getPayloadString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readPayloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function getAccentColor(value: unknown) {
  const color = getPayloadString(value)
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null
  return color
}

function getStatusLabel(status: string, t: InboxTranslator) {
  const labels: Record<string, string> = {
    pending: t('status.pending'),
    approved: t('status.approved'),
    rejected: t('status.rejected'),
    changes_requested: t('status.changesRequested'),
    answered: t('status.answered'),
    cancelled: t('status.cancelled'),
    expired: t('status.expired'),
    scheduled: t('status.scheduled'),
    delivered: t('status.delivered'),
    read: t('status.read'),
  }
  return labels[status] ?? t('status.unknown')
}

function getStatusClassName(status: string) {
  if (status === 'approved' || status === 'answered' || status === 'read') return 'bg-success/10 text-success'
  if (status === 'rejected' || status === 'changes_requested' || status === 'cancelled' || status === 'expired') return 'bg-destructive/10 text-destructive'
  return 'bg-[#eef0ff] text-[#5968d8] dark:bg-primary/15 dark:text-primary'
}

function getStatusDotClassName(status: string) {
  if (status === 'approved' || status === 'answered' || status === 'read') return 'bg-success'
  if (status === 'rejected' || status === 'changes_requested' || status === 'cancelled' || status === 'expired') return 'bg-destructive'
  return 'bg-[#6574df]'
}

function formatRelativeTime(value: string, format: InboxFormatter, now: Date) {
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) return ''
  return format.relativeTime(timestamp, { now, style: 'narrow' })
}
