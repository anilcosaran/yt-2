'use client'

import * as React from 'react'

import { STEPS, type LabVariant } from './lab-model'
import { AgentCursor, Chat, Composer, DriveButtons, Icon, LabDock, LabStage, StartHero, TopBar } from './lab-parts'
import { Splitter, useSplitSize } from './lab-split'
import { currentStep, progress, stepStatus, type LabRun } from './use-lab-run'

// The "Sohbet" view (`?v=c`): the project's conversation, and where a project starts (the centered start
// screen). You say what you want and read what Spark did; the
// plan, its approval and the agent's own decisions arrive as cards in the thread. Once production starts,
// Spark's screen opens beside the thread so the work can be watched. Hands-on editing is the Editör view:
// taking over, or opening the finished video, goes there.

export function VariantChat({ run, onView }: { run: LabRun; onView: (view: LabVariant) => void }) {
  const { state } = run
  const watching = state.phase === 'building' || state.phase === 'done'

  const side = useSplitSize('chat-side')

  if (state.phase === 'empty') {
    return (
      <div className="app lb-c">
        <TopBar run={run} />
        <StartHero run={run} />
      </div>
    )
  }

  return (
    <div className={`app lb-c${watching ? ' watching' : ''}`}>
      <TopBar run={run} />
      <div className="lb-c-main" style={side ? ({ '--lb-c-side': `${side}px` } as React.CSSProperties) : undefined}>
        <section className="lb-c-page">
          <div className="lb-c-thread">
            <Chat run={run} onOpenPlan={() => onView('b')} controls={false} detail />
          </div>
          <div className="lb-c-compose">
            <Composer run={run} onEdit={() => onView('a')} />
          </div>
        </section>

        {watching ? (
          <aside className="lb-c-side lb-in">
            <Splitter id="chat-side" axis="x" edge="start" min={360} max={(pane) => (pane.parentElement?.clientWidth ?? 1280) - 440} label="Spark’ın ekranının genişliği" />
            <SparkScreen run={run} onEdit={() => onView('a')} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Spark's screen: the stage, the timeline under it and the run as a strip of steps, with the agent's cursor on
 * what it touches. The Sohbet view shows it beside the thread; the main Chat shows it in its plan canvas.
 */
export function SparkScreen({ run, onEdit, dockKey = 'chat-dock', head = true }: {
  run: LabRun
  onEdit: () => void
  dockKey?: string
  /** Off where the host's own bar says who drives and holds the controls (the main Chat's canvas). */
  head?: boolean
}) {
  const screen = React.useRef<HTMLDivElement>(null)
  return (
    <div className={`lb-screen${head ? '' : ' no-head'}`}>
      {head ? <ScreenHead run={run} onEdit={onEdit} /> : null}
      <div className="lb-screen-body" ref={screen}>
        <LabStage run={run} />
        <LabDock run={run} compact sizeKey={dockKey} />
        <AgentCursor scope={screen} run={run} />
      </div>
      <Scrubber run={run} />
    </div>
  )
}

/** Who drives Spark's screen right now, in a few words ("Kanca metni yerleştiriliyor", "Duraklatıldı"). */
export function ScreenLine({ run }: { run: LabRun }) {
  const { state } = run
  const step = currentStep(state)
  const live = state.phase === 'building'
  const line = !live ? '' : state.driver === 'user' ? 'Sen sürüyorsun; Spark bekliyor' : state.paused ? 'Duraklatıldı' : step?.doing
  return (
    <>
      <span className={`lb-live${live && !state.paused && state.driver === 'agent' ? ' on' : ''}`}><i />Spark’ın ekranı</span>
      <span className="lb-screen-step">{line}</span>
    </>
  )
}

/** The screen's own bar: who drives, and taking over. Pausing is the send button of the chat beside it. */
function ScreenHead({ run, onEdit }: { run: LabRun; onEdit: () => void }) {
  const live = run.state.phase === 'building'
  return (
    <div className="lb-screen-head">
      <ScreenLine run={run} />
      <span className="grow" />
      {live ? (
        <DriveButtons run={run} small pause={false} onTakeOver={onEdit} />
      ) : (
        <button type="button" className="btn sm" onClick={onEdit}><Icon name="expand" size="sm" />Editörde aç</button>
      )}
    </div>
  )
}

/** One tick per step: the run as a strip you can read back; a tick opens the scene that step touched. */
function Scrubber({ run }: { run: LabRun }) {
  const { state } = run
  const { done, total } = progress(state)
  return (
    <div className="lb-scrub">
      <div className="lb-scrub-ticks">
        {STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={stepStatus(state, index)}
            title={`${index + 1}. ${step.label}`}
            aria-label={step.label}
            disabled={!step.sceneId}
            onClick={() => step.sceneId && run.view(step.sceneId)}
          />
        ))}
      </div>
      <span className="lb-scrub-count">{done}/{total} adım</span>
    </div>
  )
}
