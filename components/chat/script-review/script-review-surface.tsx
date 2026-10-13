'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { PRODUCTION_LAUNCH_QUERY_KEY } from '@/lib/assistant/production-launch-api'
import { PUBLISH_PACKAGE_QUERY_KEY, loadPublishPackage } from '@/lib/assistant/script-review/publish-package-api'
import { ScreenTreatmentController } from '@/lib/assistant/script-review/screen-treatment-controller'
import { ScriptAutosave } from '@/lib/assistant/script-review/script-autosave'
import {
  PRODUCTION_PLAN_SUMMARY_QUERY_KEY,
  SCRIPT_REVIEW_QUERY_KEY,
  VIDEO_PRODUCTION_CARD_QUERY_KEY,
  getProductionPlanSummary,
  loadScriptReview,
  patchScript,
  setScreenTreatment,
  type ScriptPatchOp,
  type ScriptPatchResult,
  type ScriptReviewData,
} from '@/lib/assistant/script-review/script-review-api'
import { rawVideoPlanState } from '@/lib/assistant/script-review/raw-video-plan'
import { buildScreenRows, isScriptOpInvalid, mergeSavedChapters, overlayScript } from '@/lib/assistant/script-review/script-review-model'

import { PublishPackageSlot } from './publish-package-section'
import { RawVideoPlanSurface } from './raw-video-plan-surface'
import { useScriptReviewHostInternal, type ScriptReviewTarget } from './script-review-host'
import { ScriptReviewView, type ScreenControls } from './script-review-view'

type Translator = (key: string, values?: Record<string, string | number>) => string

/**
 * P03-20 the Script panel of one job inside its host. It reads the owner data behind a loading state (no local copy),
 * autosaves typed patches with the expected revision, and closes only after the pending patch was acknowledged
 * (K226). A failed save keeps the draft open with "Tekrar dene"; a 409 asks the user to re-apply or drop the edits.
 * Opening or closing never starts inference, pricing, media or production.
 */
export function ScriptReviewSurface({ target }: { target: ScriptReviewTarget }) {
  const t = useTranslations('Chat') as unknown as Translator
  const review = useQuery({
    queryKey: [...SCRIPT_REVIEW_QUERY_KEY, target.projectId, target.jobId],
    queryFn: ({ signal }) => loadScriptReview(target.projectId, target.jobId, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
  const host = useScriptReviewHostInternal()
  // P04-21 slice 3: a raw video has no script; when the read succeeded and the job has a publish package, the plan is that
  // package alone (the same page, one section). It is read only when there is no script to show.
  const rawPackage = useQuery({
    queryKey: [...PUBLISH_PACKAGE_QUERY_KEY, target.projectId, target.jobId],
    queryFn: ({ signal }) => loadPublishPackage(target.projectId, target.jobId, { signal }),
    enabled: review.isSuccess && !review.data?.script,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })

  if (review.data?.script) return <ScriptReviewEditor key={review.data.script.artifactId} target={target} data={review.data} />
  const rawState = rawVideoPlanState({
    reviewSucceeded: review.isSuccess,
    hasScript: Boolean(review.data?.script),
    packageRead: rawPackage.isError ? 'error' : rawPackage.data ? rawPackage.data.status : rawPackage.isFetching ? 'pending' : 'idle',
  })
  if (rawState === 'raw_video') return <RawVideoPlanSurface target={target} />

  const close = () => host?.closed(target)
  return (
    <div className="plan" role="dialog" aria-modal={false} aria-label={t('scriptReview.untitled')} aria-busy={review.isPending}>
      <header className="pl-head">
        <div className="pl-tb"><div className="pl-trow"><span className="pl-title">{t('scriptReview.untitled')}</span></div></div>
        <div className="pl-actions">
          <button type="button" className="ib sm" title={t('scriptReview.closeHint')} aria-label={t('scriptReview.close')} onClick={close}>
            <svg className="i" aria-hidden><use href="#i-x" /></svg>
          </button>
        </div>
      </header>
      <div className="pl-bodyw">
        <div className="pl-main">
          <div className="pl-wrap" style={{ paddingTop: 48, justifyItems: 'center', textAlign: 'center' }} role="status" aria-live="polite">
            {review.isPending || rawState === 'loading' ? (
              <>
                <span className="spin" aria-hidden />
                <span className="muted">{t('scriptReview.loading')}</span>
              </>
            ) : review.isError ? (
              <>
                <span className="muted">{t('scriptReview.loadFailed')}</span>
                <button type="button" className="btn sm" onClick={() => void review.refetch()}>{t('scriptReview.retryLoad')}</button>
              </>
            ) : (
              <span className="muted">{t('scriptReview.noScript')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ScriptReviewEditor({ target, data }: { target: ScriptReviewTarget; data: ScriptReviewData }) {
  const queryClient = useQueryClient()
  const host = useScriptReviewHostInternal()
  const locale = useLocale()
  const script = data.script!
  const [server, setServer] = React.useState(() => ({ header: script.header, chapters: script.chapters }))
  const [closing, setClosing] = React.useState(false)
  const screens = useScreenTreatment(target, data)

  const summary = useQuery({
    queryKey: [...PRODUCTION_PLAN_SUMMARY_QUERY_KEY, target.projectId, target.jobId],
    queryFn: ({ signal }) => getProductionPlanSummary(target.projectId, target.jobId, { signal }),
    initialData: data.summary,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  const [autosave] = React.useState(() => new ScriptAutosave({
    initialRevision: script.revision,
    newIdempotencyKey: () => `script-panel:${script.artifactId}:${randomKey()}`,
    isInvalid: (op: ScriptPatchOp) => isScriptOpInvalid(op, script.header.result_kind),
    send: (request) => patchScript({ projectId: target.projectId, jobId: target.jobId, artifactId: script.artifactId, ...request }),
    onSaved: (result: ScriptPatchResult) => {
      setServer((current) => ({ header: result.script.header, chapters: mergeSavedChapters(current.chapters, result.script.chapters) }))
      if (result.outcome === 'created') {
        // The plan pinned to the previous script now reads stale: the Chat card and the G1 card re-read the owner.
        void queryClient.invalidateQueries({ queryKey: [...PRODUCTION_PLAN_SUMMARY_QUERY_KEY, target.projectId, target.jobId] })
        void queryClient.invalidateQueries({ queryKey: [...VIDEO_PRODUCTION_CARD_QUERY_KEY, target.projectId, target.jobId] })
        void queryClient.invalidateQueries({ queryKey: [...PRODUCTION_LAUNCH_QUERY_KEY, target.jobId] })
        // P04-21: the words of the publish package are bound to the script: a new script revision makes them stale.
        void queryClient.invalidateQueries({ queryKey: [...PUBLISH_PACKAGE_QUERY_KEY, target.projectId, target.jobId] })
      }
    },
  }))
  const save = React.useSyncExternalStore(autosave.subscribe, autosave.getSnapshot, autosave.getSnapshot)
  const display = overlayScript(server.header, server.chapters, (key) => autosave.localOp(key))

  // Leaving (another chat, route change): the pending patch is still sent; late answers are ignored.
  React.useEffect(() => () => {
    void autosave.flush()
    autosave.dispose()
  }, [autosave])

  const close = React.useCallback(async (): Promise<boolean> => {
    setClosing(true)
    const outcome = await autosave.flush()
    setClosing(false)
    if (outcome !== 'saved') return false
    host?.closed(target)
    return true
  }, [autosave, host, target])

  React.useEffect(() => host?.registerCloser(close), [host, close])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const element = event.target
      if (element instanceof HTMLElement && (element.isContentEditable || element.closest('input, textarea, select'))) return
      event.preventDefault()
      void close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  /** After a 409: read the newest revision, then re-apply the local edits on it or drop them (explicit choice). */
  const reload = React.useCallback(async (mode: 'apply' | 'discard') => {
    const fresh = await queryClient.fetchQuery({
      queryKey: [...SCRIPT_REVIEW_QUERY_KEY, target.projectId, target.jobId],
      queryFn: ({ signal }) => loadScriptReview(target.projectId, target.jobId, { signal }),
      staleTime: 0,
    })
    if (!fresh?.script || fresh.script.artifactId !== script.artifactId) return
    setServer({ header: fresh.script.header, chapters: fresh.script.chapters })
    void queryClient.invalidateQueries({ queryKey: [...PRODUCTION_PLAN_SUMMARY_QUERY_KEY, target.projectId, target.jobId] })
    void queryClient.invalidateQueries({ queryKey: [...PUBLISH_PACKAGE_QUERY_KEY, target.projectId, target.jobId] })
    if (mode === 'apply') autosave.rebase(fresh.script.revision)
    else autosave.discard(fresh.script.revision)
  }, [autosave, queryClient, script.artifactId, target])

  return (
    <ScriptReviewView
      data={data}
      display={display}
      summary={summary.data ?? data.summary}
      save={save}
      closing={closing}
      locale={locale}
      screens={screens}
      publishSlot={<PublishPackageSlot projectId={target.projectId} jobId={target.jobId} shots={data.shotPlan?.shots ?? null} />}
      onEdit={(op) => autosave.edit(op)}
      onClose={() => void close()}
      onRetry={() => void autosave.flush()}
      onConflictApply={() => void reload('apply')}
      onConflictDiscard={() => void reload('discard')}
    />
  )
}

/**
 * P04-22 "use the real screen": one click is one command on the exact shot plan revision the panel shows. The
 * controller keeps the plan's screens only as the owner last returned them; the new shot plan revision makes the
 * pinned production plan read stale, so the cards re-read the owner (see `ScreenTreatmentController`).
 */
function useScreenTreatment(target: ScriptReviewTarget, data: ScriptReviewData): ScreenControls | undefined {
  const queryClient = useQueryClient()
  const shotPlan = data.shotPlan
  const [controller] = React.useState(() => new ScreenTreatmentController({
    revision: shotPlan?.revision ?? 0,
    screens: shotPlan?.screens ?? [],
    newIdempotencyKey: () => `plan-screen:${shotPlan?.artifactId ?? 'none'}:${randomKey()}`,
    send: (request) => setScreenTreatment({ projectId: target.projectId, jobId: target.jobId, artifactId: shotPlan!.artifactId, ...request }),
    reload: async () => {
      const fresh = await queryClient.fetchQuery({
        queryKey: [...SCRIPT_REVIEW_QUERY_KEY, target.projectId, target.jobId],
        queryFn: ({ signal }) => loadScriptReview(target.projectId, target.jobId, { signal }),
        staleTime: 0,
      })
      return fresh?.shotPlan && fresh.shotPlan.artifactId === shotPlan?.artifactId ? { revision: fresh.shotPlan.revision, screens: fresh.shotPlan.screens } : null
    },
    onSaved: () => {
      void queryClient.invalidateQueries({ queryKey: [...PRODUCTION_PLAN_SUMMARY_QUERY_KEY, target.projectId, target.jobId] })
      void queryClient.invalidateQueries({ queryKey: [...VIDEO_PRODUCTION_CARD_QUERY_KEY, target.projectId, target.jobId] })
      void queryClient.invalidateQueries({ queryKey: [...PRODUCTION_LAUNCH_QUERY_KEY, target.jobId] })
    },
  }))
  const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  React.useEffect(() => () => controller.dispose(), [controller])
  const rows = React.useMemo(() => buildScreenRows(snapshot.screens, shotPlan?.shots ?? null), [shotPlan?.shots, snapshot.screens])
  if (!shotPlan || rows.length === 0) return undefined
  return { rows, pendingAssetId: snapshot.pendingAssetId, error: snapshot.error, onChoose: (assetId, choice) => void controller.choose(assetId, choice) }
}

function randomKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}
