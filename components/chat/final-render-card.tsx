'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Clapperboard, Loader2, Play, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  FINAL_RENDER_QUERY_KEY,
  buildFinalRenderCardModel,
  decideFinalRender,
  getFinalRenderState,
  isFinalRenderEvent,
  type FinalRenderCardModel,
  type FinalRenderDecisionKind,
} from '@/lib/assistant/final-render-api'

import {
  CARD_FRAME,
  OUTLINE_BUTTON,
  PRIMARY_BUTTON,
  RunCardFooter,
  RunCardHeader,
  RunCardNote,
  RunCardNotes,
} from './production-g1-card'

/**
 * P03-10 G2 card: the final render decision for the exact previewed revision. Same run card frame and buttons as the
 * G1 card (Spark job card): the state in the header's muted line, revision and credits in the footer line, the
 * decision right-aligned in the footer. Ask and `auto` show the decision; under Tam erişim the card only reports the
 * automatic render. State always comes from the server.
 */

type Translator = (key: string, values?: Record<string, string | number>) => string

export function FinalRenderJobCard({ jobId, runEvents }: {
  jobId: string
  runEvents: ReadonlyArray<{ event_type: string; sequence: number; run_id: string }>
}) {
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(() => [...FINAL_RENDER_QUERY_KEY, jobId] as const, [jobId])
  const eventMark = React.useMemo(
    () => runEvents.filter((event) => event.run_id === jobId && isFinalRenderEvent(event.event_type)).at(-1)?.sequence ?? 0,
    [jobId, runEvents],
  )
  const state = useQuery({
    queryKey,
    queryFn: ({ signal }) => getFinalRenderState(jobId, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  React.useEffect(() => {
    if (eventMark > 0) void queryClient.invalidateQueries({ queryKey })
  }, [eventMark, queryClient, queryKey])
  const [pending, setPending] = React.useState<FinalRenderDecisionKind | null>(null)
  const [failed, setFailed] = React.useState(false)
  const model = buildFinalRenderCardModel(state.data ?? null)

  const decide = React.useCallback(async (kind: FinalRenderDecisionKind) => {
    if (!model || !model.canDecide || pending) return
    setPending(kind)
    setFailed(false)
    try {
      await decideFinalRender(model.decision, kind)
    } catch {
      setFailed(true)
    } finally {
      setPending(null)
      void queryClient.invalidateQueries({ queryKey })
    }
  }, [model, pending, queryClient, queryKey])

  if (!model) return null
  return <FinalRenderCardView model={model} pending={pending} failed={failed} onDecide={(kind) => void decide(kind)} />
}

export function FinalRenderCardView({ model, pending, failed, onDecide }: {
  model: FinalRenderCardModel
  pending: FinalRenderDecisionKind | null
  failed: boolean
  onDecide: (kind: FinalRenderDecisionKind) => void
}) {
  const t = useTranslations('Chat') as unknown as Translator
  const meta = [
    t('finalRender.revision', { version: model.revision }),
    t('finalRender.estimate', { value: formatCredits(model.estimatedCredits) }),
    model.includedInPlan ? t('finalRender.included') : t('finalRender.separate'),
  ]
  if (model.automatic) meta.push(t('finalRender.automatic'))
  const busy = pending !== null
  return (
    <div className={CARD_FRAME} data-final-render-status={model.status}>
      <RunCardHeader icon={<Clapperboard className="size-4" />} title={t('finalRender.title')} subtitle={t(`finalRender.status.${model.status}`)} />
      {failed && (
        <RunCardNotes>
          <RunCardNote tone="attention">{t('finalRender.decisionFailed')}</RunCardNote>
        </RunCardNotes>
      )}
      <RunCardFooter meta={meta.join(' · ')}>
        {model.canDecide && (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onDecide('reject')} className={OUTLINE_BUTTON}>
              {pending === 'reject' ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              {t('finalRender.reject')}
            </Button>
            <Button type="button" disabled={busy} onClick={() => onDecide('approve')} className={PRIMARY_BUTTON}>
              {pending === 'approve' ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              {t('finalRender.render')}
            </Button>
          </>
        )}
      </RunCardFooter>
    </div>
  )
}

function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}
