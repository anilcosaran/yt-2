'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { AgentScope, AgentSuggestions, AgentThinking, AgentTurn } from '@/components/spark/agent/agent-thread'
import { ClosingQuestion } from '@/components/spark/lab/lab-ask'
import { JobCard, RunSend, draftThoughts } from '@/components/spark/lab/lab-parts'
import { closingChoices, useLabRun } from '@/components/spark/lab/use-lab-run'
import { PRODUCTION_LAUNCH_QUERY_KEY, decideProductionPlan, type ProductionPlanPresentation } from '@/lib/assistant/production-launch-api'
import { jobProjectIdFromProgress } from '@/lib/assistant/script-review/script-review-api'

import { useProductionLaunchState } from './production-g1-card'
import { sameScriptReviewTarget, useScriptReviewHost } from './script-review/script-review-host'

type Translator = (key: string, values?: Record<string, string | number>) => string

/** A run event as the chat keeps it; `created_at` dates the planning for the reasoning line. */
export interface ProductionFlowEvent {
  event_type: string
  payload: Record<string, unknown>
  sequence: number
  run_id: string
  created_at?: string
}

/**
 * The job's Spark run, shared with the plan canvas and the Spark project (keyed by the project): it waits at the plan
 * while the job's plan waits, and production runs in it once the plan is decided. `approve` decides the job's plan
 * (G1) and starts the run; `sync` (the chat's flow, which is always mounted) keeps the two in step when the plan was
 * decided somewhere else — in the chat by a written "tamam", or in Spark by its own "Bu planla üret".
 */
export function useJobLabRun({ jobId, projectId, title, sync = false }: { jobId: string; projectId: string; title?: string; sync?: boolean }) {
  const queryClient = useQueryClient()
  const launch = useProductionLaunchState(jobId)
  const presentation = launch.data?.presentation ?? null
  const decided = presentation?.state === 'approved' || Boolean(launch.data?.progress.launch.started)
  const waiting = presentation?.state === 'presented'
  const run = useLabRun({ phase: decided ? 'building' : waiting ? 'plan' : 'empty', ratio: '9:16', autonomy: 'ask', title }, projectId)
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: [...PRODUCTION_LAUNCH_QUERY_KEY, jobId] }),
    [queryClient, jobId],
  )

  const decide = React.useCallback(async (target: ProductionPlanPresentation, decision: 'approve' | 'reject') => {
    setPending(true)
    setFailed(false)
    try {
      await decideProductionPlan(target, decision)
      return true
    } catch {
      setFailed(true)
      return false
    } finally {
      setPending(false)
      void refresh()
    }
  }, [refresh])

  const { phase } = run.state
  const { approve: startRun, jump } = run
  const syncing = React.useRef(false)
  React.useEffect(() => {
    if (!sync) return
    if (decided) {
      if (phase === 'plan') startRun()
      else if (phase === 'empty' || phase === 'drafting') jump('building')
      return
    }
    if (!waiting || !presentation) return
    if (phase === 'empty' || phase === 'drafting') jump('plan')
    // Spark started production from its own Plan view: the job's plan is decided the same way.
    if ((phase === 'building' || phase === 'done') && !syncing.current) {
      syncing.current = true
      void decide(presentation, 'approve').finally(() => { syncing.current = false })
    }
  }, [sync, decided, waiting, presentation, phase, startRun, jump, decide])

  const approve = React.useCallback(async () => {
    if (pending) return
    if (waiting && presentation && !(await decide(presentation, 'approve'))) return
    startRun()
  }, [pending, waiting, presentation, decide, startRun])

  const reject = React.useCallback(async () => {
    if (pending || !waiting || !presentation) return
    await decide(presentation, 'reject')
  }, [pending, waiting, presentation, decide])

  return { run, launch, presentation, decided, waiting, pending, failed, approve, reject }
}

/** The job's project in Spark's editor, where taking over leads. */
const sparkEditorHref = (projectId: string) => `/spark/${encodeURIComponent(projectId)}?v=a`

/** The job's estimate as the plan card and the canvas say it ("~280–320 kredi"). */
export function useEstimateText(presentation: ProductionPlanPresentation | null) {
  const t = useTranslations('Chat') as unknown as Translator
  const estimate = presentation?.estimate
  if (!estimate) return undefined
  const min = Math.round(estimate.min_credits)
  const max = Math.round(estimate.max_credits)
  return min === max ? t('productionFlow.creditsPoint', { value: min }) : t('productionFlow.credits', { min, max })
}

/**
 * P03-20 the job in the chat once it has a plan, as Spark's chat shows it (the same parts): Spark's turn with what it
 * worked through (folded to "6 sn düşündü"), its reply, and the job card — the plan's parts, "Planı gör" (the plan
 * beside the chat), "Yeniden planla", "Vazgeç"; once production runs, its steps as tasks, one per scene, with what
 * each makes side by side. The plan is approved on the canvas or in Spark, or by writing "tamam, devam et". Production
 * is paused from the composer's send button (`ProductionRunSend`).
 */
export function ProductionFlow({ jobId, projectId, runEvents, reply, onAsk }: {
  jobId: string
  projectId: string
  runEvents: readonly ProductionFlowEvent[]
  /** The agent's message that presented the plan, shown in this turn (Spark's order: thinking, words, card). */
  reply?: string
  onAsk?: (text: string) => void
}) {
  const t = useTranslations('Chat') as unknown as Translator
  const host = useScriptReviewHost()
  const flow = useJobLabRun({ jobId, projectId, sync: true })
  const { run, presentation } = flow
  const credits = useEstimateText(presentation)
  const target = React.useMemo(() => ({ projectId, jobId }), [projectId, jobId])

  // A plan that is ready opens beside the chat by itself once, like Spark's screen.
  const autoOpen = host?.autoOpen
  const ready = flow.waiting
  React.useEffect(() => {
    if (ready && autoOpen) autoOpen(target)
  }, [ready, autoOpen, target])

  if (!presentation) return null
  const open = host ? sameScriptReviewTarget(host.target, target) : false
  const toggleCanvas = host ? () => (open ? host.requestClose() : host.open(target)) : undefined
  const seconds = planningSeconds(runEvents.filter((event) => event.run_id === jobId && event.created_at))

  return (
    <AgentScope className="w-full max-w-[620px]">
      <AgentTurn>
        <AgentThinking
          working={false}
          label={t('aiElements.reasoning.thought')}
          doneLabel={seconds ? t('aiElements.reasoning.thoughtFor', { duration: thinkingDuration(t, seconds) }) : t('aiElements.reasoning.thought')}
          lines={draftThoughts(run)}
        />
        {reply ? <div className="ai-text">{boldText(reply)}</div> : null}
        <JobCard
          run={run}
          credits={credits}
          planOpen={open}
          onOpenPlan={toggleCanvas}
          actions={flow.waiting ? (
            <>
              {onAsk ? <button type="button" className="btn sm" disabled={flow.pending} onClick={() => onAsk(t('planCanvas.fixPrompt'))}>{t('planCanvas.replan')}</button> : null}
              <button type="button" className="btn sm ghost" disabled={flow.pending} onClick={() => void flow.reject()}>{t('productionG1.reject')}</button>
            </>
          ) : null}
        />
        {flow.failed ? <p className="lb-job-note">{t('productionG1.decisionFailed')}</p> : null}
      </AgentTurn>
    </AgentScope>
  )
}

/**
 * The composer's send button while the job's video is being made: it pauses Spark and starts it again, as in Spark's
 * own chat (`RunSend`); taking over opens the project's editor. At any other time, and for a job without a plan, it
 * is the composer's own button (`children`).
 */
export function ProductionRunSend({ jobId, children }: { jobId: string | null; children: React.ReactNode }) {
  const launch = useProductionLaunchState(jobId)
  const projectId = jobProjectIdFromProgress(launch.data?.progress)
  if (!jobId || !launch.data?.presentation || !projectId) return <>{children}</>
  return <JobRunSend jobId={jobId} projectId={projectId}>{children}</JobRunSend>
}

function JobRunSend({ jobId, projectId, children }: { jobId: string; projectId: string; children: React.ReactNode }) {
  const router = useRouter()
  const { run } = useJobLabRun({ jobId, projectId })
  if (run.state.phase !== 'building') return <>{children}</>
  return <RunSend run={run} onTakeOver={() => router.push(sparkEditorHref(projectId))} />
}

/**
 * Over the composer while the job has a plan: suggestion chips for what the user may want next at this point (the
 * plan waits, the video is being made, it is done), and, once the video is made, Spark's closing question first
 * (final render, keep for the channel, open the editor). A chip or an answer puts its words into the composer.
 */
export function ProductionSuggestions({ jobId, onPick }: { jobId: string; onPick: (text: string) => void }) {
  const launch = useProductionLaunchState(jobId)
  const projectId = jobProjectIdFromProgress(launch.data?.progress)
  if (!launch.data?.presentation || !projectId) return null
  return <JobSuggestions jobId={jobId} projectId={projectId} onPick={onPick} />
}

function JobSuggestions({ jobId, projectId, onPick }: { jobId: string; projectId: string; onPick: (text: string) => void }) {
  const t = useTranslations('Chat') as unknown as Translator
  const router = useRouter()
  const { run, presentation } = useJobLabRun({ jobId, projectId })
  const stage = run.state.phase === 'done' ? 'done' : run.state.phase === 'building' ? 'producing' : presentation?.state === 'presented' ? 'plan' : null
  if (!stage) return null
  if (closingChoices(run.state)) {
    return (
      <AgentScope>
        <ClosingQuestion
          run={run}
          onAsk={(choice) => onPick(t(`productionFlow.closing.${choice}`))}
          onEdit={() => router.push(sparkEditorHref(projectId))}
        />
      </AgentScope>
    )
  }
  const items = [1, 2, 3].map((n) => ({ id: `${stage}-${n}`, label: t(`productionFlow.suggestions.${stage}.${n}`) }))
  return (
    <AgentScope>
      <AgentSuggestions items={items} label={t('productionFlow.suggestions.label')} onPick={(item) => onPick(item.label)} />
    </AgentScope>
  )
}

/**
 * How long the agent worked on the plan: from the first event after the user last spoke (a message or an answer)
 * to the plan's presentation. Waiting for the user's answer is not thinking.
 */
function planningSeconds(events: readonly ProductionFlowEvent[]) {
  const presented = events.findIndex((event) => event.event_type === 'assistant.production_plan.presented')
  if (presented < 0) return undefined
  let start = presented
  while (start > 0 && !['message.created', 'run.waiting_for_user'].includes(events[start - 1]!.event_type)) start -= 1
  const from = events[start === presented ? Math.max(0, presented - 1) : start]?.created_at
  const to = events[presented]?.created_at
  const seconds = from && to ? (Date.parse(to) - Date.parse(from)) / 1000 : undefined
  return seconds && seconds > 0 ? seconds : undefined
}

function thinkingDuration(t: Translator, seconds: number) {
  const whole = Math.max(1, Math.round(seconds))
  if (whole < 60) return t('aiElements.reasoning.seconds', { count: whole })
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return rest === 0 ? t('aiElements.reasoning.minutes', { count: minutes }) : t('aiElements.reasoning.minutesSeconds', { minutes, seconds: rest })
}

/** The reply as Spark writes it: plain lines with **bold** words. */
function boldText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
    part.startsWith('**') && part.endsWith('**') ? <b key={index}>{part.slice(2, -2)}</b> : <React.Fragment key={index}>{part.replace(/\*([^*]+)\*/g, '$1')}</React.Fragment>
  ))
}
