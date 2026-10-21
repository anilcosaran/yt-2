'use client'

import * as React from 'react'

import { STUDIO_ICON_SPRITE } from '../studio/studio-icons'
import { Icon } from '../tools/studio-parts'
import { LabOverlayContext, ViewSwitchContext } from './lab-context'
import { LAB_SYMBOLS, instrumentSans, useLabScrollbars } from './lab-frame'
import { LAB_VARIANTS, ratioOf, type LabBoard, type LabLook, type LabPhase, type LabRatio, type LabVariant } from './lab-model'
import { useLabRun } from './use-lab-run'
import { VariantChat } from './variant-chat'
import { VariantCopilot } from './variant-copilot'
import { VariantStoryboard } from './variant-storyboard'
import '../studio/studio.css'
import './lab.css'
import './lab-look.css'

/**
 * The Spark workspace: the agent workspace around the editor as three views of one project — Sohbet, Plan and
 * Editör. It is what a Spark project opens in (`/spark/<projectId>`, see `spark-workspace-page.tsx`); `/spark/lab`
 * shows the same without a project. The top bar carries nothing but the project and the view switch.
 *
 * What happens in it is still one scripted run: no gateway calls, the plan and the edits are the demo's, nothing
 * is saved, and its copy is not in the message files yet. A moment of the run is opened with the URL (`phase`,
 * `step`, `hold`), not from the page. `title` is the project's own name; `onStart` hears the first sentence and
 * `onPhase` how far the run has got.
 *
 * `look` picks the component shapes over the same markup (`calm`, or `spark` for the lab as it was before that
 * layer). Colours are not the lab's: they follow the app's theme setting (light, dark or paper).
 *
 * The project's canvas is Plan › Akış (`board=flow`). `contained` fills the parent (the shell's page panel, where a
 * project is a tab) instead of the window.
 */
export function SparkLab({
  variant: startVariant,
  board: startBoard = 'script',
  ratio: startRatio = '9:16',
  phase,
  step,
  hold,
  look = 'calm',
  title,
  runKey,
  onStart,
  onPhase,
  contained = false,
}: {
  variant: LabVariant
  board?: LabBoard
  ratio?: LabRatio
  phase?: LabPhase
  step?: number
  hold?: boolean
  look?: LabLook
  title?: string
  /** The project's shared run (its id): the main Chat's canvas and task list of the same job read the same run. */
  runKey?: string
  onStart?: (start: { prompt: string; ratio: LabRatio }) => void
  onPhase?: (phase: LabPhase) => void
  contained?: boolean
}) {
  // There is nothing to plan before the first request, so a link to the Plan view of an empty project opens Sohbet.
  const opening: LabVariant = startVariant === 'b' && (phase ?? 'empty') === 'empty' ? 'c' : startVariant
  const [variant, setVariant] = React.useState<LabVariant>(opening)
  // The address names the view the workspace opened on, so a tab left right away comes back to it.
  React.useEffect(() => {
    const url = new URL(window.location.href)
    if ((url.searchParams.get('v') ?? 'c') === opening) return
    url.searchParams.set('v', opening)
    window.history.replaceState(null, '', url)
  }, [opening])
  const [board, setBoard] = React.useState(startBoard)
  const [planSeen, setPlanSeen] = React.useState(variant === 'b')
  const [overlay, setOverlay] = React.useState<HTMLDivElement | null>(null)
  const run = useLabRun({ phase, step, hold, ratio: startRatio, title }, runKey)
  const livePhase = run.state.phase
  React.useEffect(() => onPhase?.(livePhase), [livePhase, onPhase])
  // The first sentence, once: the moment an empty project gets something in it.
  const wasEmpty = React.useRef(livePhase === 'empty')
  const { prompt: firstPrompt, ratio: startedRatio } = run.state
  React.useEffect(() => {
    if (livePhase === 'empty') {
      wasEmpty.current = true
    } else if (wasEmpty.current) {
      wasEmpty.current = false
      onStart?.({ prompt: firstPrompt, ratio: startedRatio })
    }
  }, [livePhase, firstPrompt, startedRatio, onStart])
  const ratio = ratioOf(run.state.ratio)
  // The Plan view opens once the agent starts writing a plan. The editor does open on an empty project: an
  // empty canvas is a place to start by hand.
  const started = run.state.phase !== 'empty'

  // Keep the link shareable without a navigation: the run goes on across views.
  const remember = (key: string, value: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set(key, value)
    window.history.replaceState(null, '', url)
  }
  const choose = (next: LabVariant) => {
    if (next === 'b' && !started) return
    if (next === 'b') setPlanSeen(true)
    setVariant(next)
    remember('v', next)
  }
  const chooseBoard = (next: LabBoard) => {
    setBoard(next)
    remember('board', next)
  }

  const showScrollbar = useLabScrollbars()

  const views = (
    <div className="seg lb-views" role="group" aria-label="Görünüm">
      {LAB_VARIANTS.map((entry) => {
        const waiting = entry.id === 'b' && !started
        // A plan the user has not looked at yet is marked on its tab.
        const unseen = entry.id === 'b' && variant !== 'b' && !planSeen && (run.state.phase === 'plan' || run.state.phase === 'building' || run.state.phase === 'done')
        return (
          <button
            key={entry.id}
            type="button"
            className={entry.id === variant ? 'on' : ''}
            aria-disabled={waiting}
            onClick={() => choose(entry.id)}
            title={waiting ? 'Plan, ilk isteğinden sonra oluşur' : entry.line}
          >
            <Icon name={entry.icon} size="sm" />
            {entry.name}
            {unseen ? <i className="lb-views-dot" /> : null}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className={`${contained ? 'absolute lb-contained' : 'fixed'} inset-0 overflow-hidden${look === 'calm' ? ' lb-calm' : ''}`}>
      <ViewSwitchContext.Provider value={views}>
        <LabOverlayContext.Provider value={overlay}>
          <div className={`yt-studio lb-root ${instrumentSans.variable}`} data-ratio={ratio.id} onScrollCapture={showScrollbar} style={{ '--lb-ar': ratio.css, '--lb-r': ratio.value } as React.CSSProperties}>
            <svg aria-hidden style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: STUDIO_ICON_SPRITE + LAB_SYMBOLS }} />
            <div className="st-shell lb-shell">
              {variant === 'a' ? (
                <VariantCopilot run={run} onOpenPlan={() => choose('b')} />
              ) : variant === 'b' ? (
                <VariantStoryboard run={run} board={board} onBoard={chooseBoard} />
              ) : (
                <VariantChat run={run} onView={choose} />
              )}
            </div>
          </div>
          <div className="lb-overlay" ref={setOverlay} />
        </LabOverlayContext.Provider>
      </ViewSwitchContext.Provider>
    </div>
  )
}
