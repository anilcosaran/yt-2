'use client'

import * as React from 'react'

import { BRIEF, LAB_BOARDS, SCENES, TOTAL_SECONDS, formatClock, type AgentStep, type LabBoard, type LabScene } from './lab-model'
import { EditableText } from './lab-edit'
import {
  AgentCursor,
  ChannelLayer,
  Chat,
  Composer,
  EstimateLine,
  Icon,
  LabDock,
  LockButton,
  PaceBar,
  SceneDot,
  SceneThumb,
  SparkPanelToggle,
  TopBar,
  presenceOf,
  useEscapeToClose,
  useSparkPanel,
} from './lab-parts'
import { RealFlowBoard } from './lab-real-flow'
import { Splitter, useSplitSize } from './lab-split'
import { PlanScript } from './plan-script'
import { revealed, sayOf, type LabRun } from './use-lab-run'

// The "Plan" view (`?v=b`): what the video will be, before and while it is made. It opens once there is a plan
// to show; a project starts in Sohbet. The agent's presence shows on the scene it is working on, and holding a
// scene takes it over while the agent goes on with the others. The timeline is a detail opened from the bottom.
// A plan that waits for the user is approved here, on a bar under it: the chat only leads here ("Planı gör").
// Spark's panel ("Spark" at the end of the top bar) is shut unless opened, and opens by itself for its questions.
//
// The plan has three views (`board`). Senaryo is the plan in full and the default (`plan-script.tsx`). Şerit
// shows the frames side by side. Akış is the same plan on the Flow canvas.

const cardTarget = (step: AgentStep) => (step.sceneId ? `card-${step.sceneId}` : 'board-foot')
/** The container width at and under which Spark's panel covers the plan instead of standing beside it (lab.css). */
const PLAN_PANEL_OVER = 1020

export function VariantStoryboard({
  run,
  open = false,
  board = 'script',
  onBoard,
}: {
  run: LabRun
  open?: boolean
  board?: LabBoard
  onBoard: (board: LabBoard) => void
}) {
  const scope = React.useRef<HTMLDivElement>(null)
  const right = useSplitSize('plan-right')
  // Spark's panel is shut unless opened: the plan is worked on its own rows (notes, the approval bar), and Spark
  // opens the panel itself when it asks something.
  const spark = useSparkPanel(run, 'plan-chat', { scope, narrowAt: PLAN_PANEL_OVER })
  const covers = spark.narrow && spark.open
  useEscapeToClose(covers, () => spark.setOpen(false))

  return (
    <div className={`app lb-b${spark.open ? ' chat-open' : ''}`} ref={scope}>
      <TopBar run={run} panel={<SparkPanelToggle panel={spark} />} />
      <div className="lb-b-main" style={right ? ({ '--lb-b-right': `${right}px` } as React.CSSProperties) : undefined}>
        <PlanWork run={run} open={open} board={board} onBoard={onBoard} onPointerDown={covers ? () => spark.setOpen(false) : undefined} />

        {/* Mounted only while open: a hidden question must not take the number keys that answer it. */}
        {spark.open ? (
          <aside className="lb-b-right" id={spark.id}>
            <Splitter id="plan-right" axis="x" edge="start" min={300} max={(pane) => Math.min(620, (pane.parentElement?.clientWidth ?? 1280) - 520)} label="Spark panelinin genişliği" />
            <div className="pane">
              <Chat run={run} />
              <div className="composer-wrap"><Composer run={run} /></div>
            </div>
          </aside>
        ) : null}
      </div>
      <AgentCursor scope={scope} run={run} targetOf={cardTarget} />
    </div>
  )
}

/** The plan itself: the brief line with the board switch, the board, the approval bar and the timeline. */
function PlanWork({
  run,
  open = false,
  board = 'script',
  onBoard,
  onPointerDown,
}: {
  run: LabRun
  open?: boolean
  board?: LabBoard
  onBoard: (board: LabBoard) => void
  /** A press on the plan while Spark's panel covers it closes the panel. */
  onPointerDown?: () => void
}) {
  const { state } = run
  const work = React.useRef<HTMLElement>(null)
  const message = BRIEF.find((field) => field.id === 'message')!
  const scenes = SCENES.filter((scene) => revealed(state, scene.at))

  const openMemory = () => {
    onBoard('script')
    // The section may only be rendered by this change of view: wait for it, then bring it up.
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => work.current?.querySelector('[data-plan-section="rules"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })),
    )
  }

  return (
    <section className="lb-b-work" ref={work} onPointerDown={onPointerDown}>
      <header className="lb-b-brief">
        <div className="lb-b-line">
          <p>{revealed(state, message.at) ? message.value : <span className="lb-skel" />}</p>
          <div className="seg lb-view" role="group" aria-label="Plan görünümü">
            {LAB_BOARDS.map((entry) => (
              <button key={entry.id} type="button" className={entry.id === board ? 'on' : ''} onClick={() => onBoard(entry.id)} title={entry.good}>
                {entry.name}
              </button>
            ))}
          </div>
        </div>
        <ChannelLayer compact onOpen={openMemory} />
      </header>

      {board === 'flow' ? (
        <RealFlowBoard key={state.ratio} run={run} onBack={() => onBoard('script')} />
      ) : board === 'strip' ? (
        <StripBoard run={run} scenes={scenes} />
      ) : (
        <PlanScript run={run} scenes={scenes} />
      )}

      {state.phase === 'plan' ? <PlanApproveBar run={run} onApprove={run.approve} /> : null}

      <PlanTimeline run={run} open={open} />
    </section>
  )
}

/**
 * The timeline under a plan: closed, a strip with the play head and the pace of the scenes; opened, the full timeline.
 * The Plan view and the main Chat's canvas show it under the plan (closed until the user opens it).
 */
export function PlanTimeline({ run, open = false, sizeKey = 'plan-dock' }: { run: LabRun; open?: boolean; sizeKey?: string }) {
  const [timelineOpen, setTimelineOpen] = React.useState(open)
  return (
    <footer className={`lb-b-foot${timelineOpen ? ' open' : ''}`} data-agent-target="board-foot">
      {timelineOpen ? <LabDock run={run} compact sizeKey={sizeKey} notes={false} /> : (
        <div className="lb-b-strip">
          <button type="button" className="play" aria-label="Oynat"><Icon name="play" /></button>
          <span className="time">0:00<span className="tt"> / {formatClock(TOTAL_SECONDS)}</span></span>
          <PaceBar run={run} />
        </div>
      )}
      <button type="button" className="btn sm ghost lb-b-toggle" onClick={() => setTimelineOpen(!timelineOpen)}>
        <Icon name={timelineOpen ? 'down' : 'up'} size="sm" />
        {timelineOpen ? 'Zaman çizelgesini kapat' : 'Zaman çizelgesini aç'}
      </button>
    </footer>
  )
}

/** The bar under a plan that waits for the user: scenes, length and cost, then "Bu planla üret" (or the countdown). */
function PlanApproveBar({ run, onApprove }: { run: LabRun; onApprove: () => void }) {
  return (
    <div className="lb-approve lb-in">
      <span className="lb-approve-t"><b>Plan hazır</b>{SCENES.length} sahne · {formatClock(TOTAL_SECONDS)}</span>
      <EstimateLine />
      <span className="grow" />
      {run.state.autonomy === 'ask' ? (
        <button type="button" className="btn primary" onClick={onApprove}>Bu planla üret</button>
      ) : (
        <span className="lb-autostart">Otomatik başlıyor<i /></span>
      )}
    </div>
  )
}

type BoardProps = { run: LabRun; scenes: LabScene[] }

// ---- Şerit: frames side by side ----------------------------------------------------------------------------

/**
 * The frames in a row: number, role and length, the picture, the line that is spoken. Everything else about a
 * scene is in Senaryo. The card width follows the format and the strip wraps when the cards no longer fit; a
 * new scene is a frame-shaped slot.
 */
function StripBoard({ run, scenes }: BoardProps) {
  return (
    <div className="lb-b-board lb-strip-board" style={{ '--lb-n': scenes.length + 1 } as React.CSSProperties}>
      {scenes.map((scene) => <StripCard key={scene.id} scene={scene} run={run} />)}
      {run.state.phase === 'drafting' ? (
        <div className="lb-add-tile" aria-hidden><span className="lb-add-frame"><span className="spin" /></span></div>
      ) : (
        <button type="button" className="lb-add-tile"><span className="lb-add-frame"><Icon name="plus" />Sahne ekle</span></button>
      )}
    </div>
  )
}

function StripCard({ scene, run }: { scene: LabScene; run: LabRun }) {
  const { here, doing, status } = presenceOf(run, scene)
  return (
    <article className={`lb-card lb-in ${status}${here ? ' lb-agent-on' : ''}`} data-agent-target={`card-${scene.id}`}>
      <header>
        <span className="lb-plan-n">{scene.n}</span>
        <b>{scene.role}</b>
        <SceneDot status={status} />
        <span className="lb-card-dur">{scene.end - scene.start} sn</span>
        <LockButton run={run} scene={scene} />
      </header>
      <div className="lb-card-pic"><SceneThumb scene={scene} run={run} planned /></div>
      <p className="lb-card-say">
        <EditableText label={`${scene.role}: anlatım`} value={sayOf(run.state, scene)} placeholder="Anlatım yok" onChange={(text) => run.edit(`say:${scene.id}`, text)} />
      </p>
      {here ? <span className="lb-card-step">{doing}</span> : null}
      <button type="button" className="lb-insert" title="Araya sahne ekle" aria-label="Araya sahne ekle"><Icon name="plus" size="sm" /></button>
    </article>
  )
}
