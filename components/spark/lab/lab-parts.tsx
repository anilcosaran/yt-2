'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { MousePointer2 } from 'lucide-react'

import { ScheduleDialog } from '@/components/calendar/schedule-dialog'
import { AgentChain, AgentMedia, AgentQueue, AgentStepIcon, AgentSuggestions, AgentThinking, type AgentChainStep, type AgentQueueItem, type AgentStepState } from '../agent/agent-thread'
import { PromptBox, PromptBoxChip, PromptBoxInput, PromptBoxSend, PromptBoxSpacer } from '../agent/prompt-box'
import { Icon } from '../tools/studio-parts'
import { ViewSwitchContext } from './lab-context'
import {
  ASSETS,
  ASSUMPTIONS,
  AUTONOMY,
  BRIEF,
  CHANNEL,
  CHANNEL_LAYER,
  CONTEXT,
  DRAFT_END,
  ESTIMATE,
  LAB_RATIOS,
  PROMPT_IDEAS,
  SCENES,
  SKILL,
  STEPS,
  SUGGESTIONS,
  TOTAL_SECONDS,
  assetById,
  formatClock,
  ratioOf,
  sceneById,
  type AgentStep,
  type LabScene,
} from './lab-model'
import { ClosingQuestion, QuestionCard } from './lab-ask'
import { fixedOrigin } from './lab-place'
import { usePaneOpen } from './lab-split'
import {
  agentDriving,
  askedQuestions,
  assumptionsOf,
  closingChoices,
  currentStep,
  keptForChannel,
  pendingQuestion,
  projectTitle,
  sayOf,
  isAdded,
  progress,
  revealed,
  sceneStatus,
  shownSceneId,
  stepStatus,
  type LabRun,
  type SceneStatus,
} from './use-lab-run'

// Spark lab: the pieces the three workspace prototypes share. Everything renders inside `.yt-studio`, so the
// Spark design classes (`studio.css`) apply as they are; `lab.css` adds the `lb-` rules.

const SCENE_STATUS: Record<SceneStatus, string> = {
  draft: 'Taslak',
  queued: 'Sırada',
  working: 'Spark çalışıyor',
  ready: 'Hazır',
  yours: 'Sende',
}

/**
 * The channel layer every video inherits, in one line. It leads to the channel's Memory page, or, inside a
 * plan (`onOpen`), to the part of the plan that lists what this video took from it.
 */
export function ChannelLayer({ compact, onOpen }: { compact?: boolean; onOpen?: () => void }) {
  const className = `lb-inherit${compact ? ' compact' : ''}`
  const body = (
    <>
      <span className="lb-av">{CHANNEL.initials}</span>
      <b>{CHANNEL.name}</b>
      <span className="lb-inherit-meta">
        {CHANNEL_LAYER.rules} kural · {CHANNEL_LAYER.knowledge} bilgi · {CHANNEL_LAYER.skills} yetenek · {CHANNEL_LAYER.kit}
      </span>
      <Icon name="right" size="sm" />
    </>
  )
  if (onOpen) return <button type="button" className={className} onClick={onOpen} title="Bu videoda bellekten kullanılanlar">{body}</button>
  return <Link className={className} href="/memory" title="Kanal belleğini aç">{body}</Link>
}

/**
 * The project's output format. It belongs to the brief: Spark reads it from the sentence ("Reels" → 9:16) and
 * it is changed here, in place. The value opens into the three formats and closes on a choice.
 */
export function FormatPicker({ run }: { run: LabRun }) {
  const [open, setOpen] = React.useState(false)
  const current = ratioOf(run.state.ratio)
  if (!open) {
    return (
      <button type="button" className="lb-format" onClick={() => setOpen(true)} title="Biçimi değiştir">
        {current.format}
        <Icon name="down" size="sm" />
      </button>
    )
  }
  return (
    <span className="seg lb-format-seg" role="group" aria-label="Biçim">
      {LAB_RATIOS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={entry.id === current.id ? 'on' : ''}
          onClick={() => {
            run.setRatio(entry.id)
            setOpen(false)
          }}
        >
          {entry.name} · {entry.id}
        </button>
      ))}
    </span>
  )
}

/** Before the first sentence the format sits in the composer: Spark infers it unless it is set here. */
function FormatCycle({ run }: { run: LabRun }) {
  const index = LAB_RATIOS.findIndex((entry) => entry.id === run.state.ratio)
  const current = LAB_RATIOS[index]!
  return (
    <PromptBoxChip
      title="Çıktı biçimi"
      icon={<Icon name="aspect" size="sm" />}
      label={`${current.name} ${current.id}`}
      caret
      onClick={() => run.setRatio(LAB_RATIOS[(index + 1) % LAB_RATIOS.length]!.id)}
    />
  )
}

/** CSS-drawn stand-in for a scene's picture, with the on-screen layers that are already placed. */
export function SceneThumb({ scene, run, planned, targets }: { scene: LabScene; run: LabRun; planned?: boolean; targets?: boolean }) {
  const { state } = run
  const built = isAdded(state, `${scene.id}:media`)
  const step = currentStep(state)
  const driving = agentDriving(state)
  return (
    <div className={`lb-thumb${built ? '' : ' sketch'}`}>
      {built || planned ? <div className={`lb-art ${scene.art}`} /> : null}
      {scene.layers.map((layer) => {
        const own = STEPS.some((entry) => entry.adds === `${scene.id}:${layer.key}`)
        const placed = own ? isAdded(state, `${scene.id}:${layer.key}`) : built
        const arriving = step?.adds === `${scene.id}:${layer.key}`
        if (!placed && !arriving && !planned) return null
        const active = driving && arriving
        return (
          <span
            key={layer.key}
            className={`lb-layer k-${layer.kind}${placed ? '' : ' ghost'}${active ? ' lb-agent-on' : ''}`}
            {...(targets && { 'data-agent-target': `layer-${layer.key}` })}
          >
            {layer.text}
          </span>
        )
      })}
      {built && sayOf(state, scene) && isAdded(state, 'all:captions') ? <span className="lb-layer k-caption">{sayOf(state, scene)}</span> : null}
    </div>
  )
}

/** "Varsayımlarım": the small calls the agent made instead of asking, each one reversible. */
export function AssumptionList({ run }: { run: LabRun }) {
  const items = assumptionsOf(run.state)
  return (
    <ul className="lb-assume">
      {items.map((item) => {
        const dropped = run.state.dropped.includes(item.id)
        return (
          <li key={item.id} className={`lb-in${dropped ? ' dropped' : ''}`}>
            <span>{item.text}</span>
            <button type="button" className="btn sm ghost" onClick={() => run.dropAssumption(item.id)}>
              {dropped ? 'Geri getir' : 'Geri al'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function EstimateLine() {
  return (
    <span className="lb-est" title={ESTIMATE.lines.map((line) => `${line.label}: ${line.credits} kredi`).join('\n')}>
      <Icon name="key" size="sm" />≈ {ESTIMATE.credits} kredi
    </span>
  )
}

/**
 * The plan as rows: one line per scene, by its picture, with its state. Pointing at the picture shows it larger,
 * beside the list.
 */
export function PlanList({ run, onPick }: { run: LabRun; onPick?: (sceneId: string) => void }) {
  const { state } = run
  const shown = shownSceneId(state)
  const [peek, setPeek] = React.useState<{ scene: LabScene; left: number; top: number } | null>(null)
  const look = (scene: LabScene, picture: HTMLElement) => {
    const box = picture.getBoundingClientRect()
    const origin = fixedOrigin(picture)
    setPeek({ scene, left: box.right + 14 - origin.left, top: box.top + box.height / 2 - origin.top })
  }
  return (
    <>
    <ol className="lb-plan">
      {SCENES.filter((scene) => revealed(state, scene.at)).map((scene) => {
        const status = sceneStatus(state, scene.id)
        return (
          <li key={scene.id} className={`lb-plan-row lb-in ${status}${shown === scene.id && state.phase !== 'plan' ? ' on' : ''}`}>
            <button type="button" onClick={() => onPick?.(scene.id)}>
              <span className="lb-plan-pic" onMouseEnter={(event) => look(scene, event.currentTarget)} onMouseLeave={() => setPeek(null)}>
                <span className="lb-plan-frame"><SceneThumb scene={scene} run={run} planned /></span>
                <i>{scene.n}</i>
              </span>
              <span className="lb-plan-text">
                <b>{scene.role}</b>
                <span>{sayOf(state, scene) || scene.layers[0]?.text}</span>
              </span>
              <span className="lb-plan-dur">{scene.end - scene.start} sn</span>
              <span className={`lb-dot ${status}`} title={SCENE_STATUS[status]} />
            </button>
          </li>
        )
      })}
    </ol>
    {peek ? (
      <div className="lb-peek" style={{ left: peek.left, top: peek.top }} aria-hidden>
        <div className="lb-peek-frame"><SceneThumb scene={peek.scene} run={run} planned /></div>
        <span>{peek.scene.n}. {peek.scene.role} · {peek.scene.end - peek.scene.start} sn</span>
      </div>
    ) : null}
    </>
  )
}

/** Whether the agent is on this scene right now, the step it is on, and the scene's state. */
export function presenceOf(run: LabRun, scene: LabScene) {
  const step = currentStep(run.state)
  const here = agentDriving(run.state) && step?.sceneId === scene.id
  return { here, doing: here ? step?.doing : undefined, status: sceneStatus(run.state, scene.id) }
}

/** Holding a scene: the agent leaves it to the user and goes on with the rest. Shown on hover, kept while held. */
export function LockButton({ run, scene }: { run: LabRun; scene: LabScene }) {
  const locked = run.state.locked.includes(scene.id)
  const label = locked ? 'Spark’a geri ver' : 'Bu sahneyi devral'
  return (
    <button type="button" className={`ib xs lb-lock${locked ? ' on' : ''}`} onClick={() => run.toggleLock(scene.id)} title={label} aria-label={label}>
      <Icon name={locked ? 'lock' : 'pointer'} size="sm" />
    </button>
  )
}

/** A scene's state as one dot: nothing while it is only planned, a pulse while the agent is on it, then done. */
export function SceneDot({ status }: { status: SceneStatus }) {
  if (status === 'draft') return null
  return <i className={`lb-dot ${status}`} role="img" aria-label={SCENE_STATUS[status]} title={SCENE_STATUS[status]} />
}

/** Pace bar of the plan: one coloured segment per scene, proportional to its length. */
export function PaceBar({ run }: { run: LabRun }) {
  return (
    <div className="lb-pace">
      {SCENES.filter((scene) => revealed(run.state, scene.at)).map((scene) => (
        <i key={scene.id} className={sceneStatus(run.state, scene.id)} style={{ flexGrow: scene.end - scene.start }} title={`${scene.n}. ${scene.role}`} />
      ))}
    </div>
  )
}

/** Cycles Ask → Auto → Full access (the Assistant's existing modes). */
export function AutonomyPicker({ run }: { run: LabRun }) {
  const index = AUTONOMY.findIndex((mode) => mode.id === run.state.autonomy)
  const mode = AUTONOMY[index]!
  return (
    <PromptBoxChip
      title={mode.hint}
      icon={<Icon name="shield" size="sm" />}
      label={mode.label}
      caret
      onClick={() => run.setAutonomy(AUTONOMY[(index + 1) % AUTONOMY.length]!.id)}
    />
  )
}

/**
 * The composer's send button while Spark makes the video: it pauses Spark and starts it again. Once paused, "Devral"
 * sits beside it (the user edits by hand, Spark waits); while the user drives, the button hands the work back.
 */
export function RunSend({ run, onTakeOver }: { run: LabRun; onTakeOver?: () => void }) {
  const { state } = run
  if (state.driver === 'user') return <PromptBoxSend mode="resume" label="Spark’a geri ver" onClick={run.handBack} />
  if (!state.paused) return <PromptBoxSend mode="pause" label="Duraklat" onClick={run.pause} />
  return (
    <>
      <PromptBoxChip
        title="Düzenlemeyi sen sürdür; Spark bekler"
        icon={<MousePointer2 aria-hidden />}
        label="Devral"
        onClick={() => {
          run.takeOver()
          onTakeOver?.()
        }}
      />
      <PromptBoxSend mode="resume" label="Sürdür" onClick={run.resume} />
    </>
  )
}

/** `onEdit` opens the editor, where the view has one to go to: taking over leads there, and so does the closing question. */
export function Composer({ run, big, onEdit }: { run: LabRun; big?: boolean; onEdit?: () => void }) {
  const fresh = run.state.phase === 'empty'
  const building = run.state.phase === 'building'
  // A question from Spark is answered here: with one of its options, or in the user's own words below it.
  const asking = pendingQuestion(run.state)
  // Once the video is made Spark asks what comes next the same way (render, keep for the channel).
  const closing = closingChoices(run.state) !== null
  // Before production the estimate lives on the plan itself (job card, approval line).
  const estimated = run.state.phase === 'building' || run.state.phase === 'done'
  const [text, setText] = React.useState('')
  const input = React.useRef<HTMLTextAreaElement>(null)
  const send = () => {
    if (asking) {
      if (text.trim()) run.answer(asking.id, text.trim())
    } else if (fresh) {
      run.submit(text)
    } else {
      return
    }
    setText('')
  }
  const suggesting = !asking && !closing && (run.state.phase === 'plan' || run.state.phase === 'done')
  return (
    <div className="lb-compose">
      {asking ? <QuestionCard run={run} question={asking} onOwn={() => input.current?.focus()} /> : null}
      {closing ? <ClosingQuestion run={run} onEdit={onEdit} /> : null}
      {suggesting ? (
        <AgentSuggestions
          items={NEXT_STEPS}
          label="Öneriler"
          onPick={(item) => {
            setText(item.label)
            input.current?.focus()
          }}
        />
      ) : null}
      <PromptBox
        size={big ? 'big' : 'default'}
        className="lb-composer"
        bar={(
          <>
            <AutonomyPicker run={run} />
            {fresh ? <FormatCycle run={run} /> : null}
            <PromptBoxSpacer />
            {estimated ? <EstimateLine /> : null}
            {building ? (
              <RunSend run={run} onTakeOver={onEdit} />
            ) : (
              <PromptBoxSend
                type="button"
                label="Gönder"
                onClick={send}
                disabled={asking ? !text.trim() : !fresh}
                title={asking ? 'Cevabını gönder' : fresh ? 'Gönder' : 'Prototipte yalnız ilk istek canlandırılır'}
              />
            )}
          </>
        )}
      >
        <PromptBoxInput
          ref={input}
          rows={big ? 2 : 1}
          value={text}
          placeholder={asking ? 'Kendi cevabını yaz…' : fresh ? 'Tek cümleyle anlat: ne yapıyoruz?' : 'Spark’a söyle: “4. sahnede fiyatı büyüt”…'}
          onChange={(event) => setText(event.target.value)}
          onSend={send}
        />
      </PromptBox>
    </div>
  )
}

/** What the user may want next, once there is a plan (Suggestion chips over the composer). */
const NEXT_STEPS = [
  { id: 'price', label: '4. sahnede fiyatı büyüt' },
  { id: 'music', label: 'Müziği daha enerjik yap' },
  { id: 'wide', label: 'Yatay sürümünü de çıkar' },
]

/** Starter prompts for an empty project. */
export function PromptIdeas({ run }: { run: LabRun }) {
  return (
    <div className="lb-ideas">
      <AgentSuggestions items={PROMPT_IDEAS.map((idea) => ({ id: idea, label: idea }))} onPick={(item) => run.submit(item.label)} />
    </div>
  )
}

/**
 * The start of a project, centered: one question, the composer, a few openers, and the channel memory the
 * agent will draw on. A project starts here and nowhere else. Behind it, a quiet backdrop (`.lb-start-bg`): a dot
 * grid fading out from the middle, a slow drifting light, and the grid lit in the agent's colour around the pointer.
 */
export function StartHero({ run }: { run: LabRun }) {
  const root = React.useRef<HTMLDivElement>(null)
  const frame = React.useRef(0)
  React.useEffect(() => () => cancelAnimationFrame(frame.current), [])
  // The pointer's light follows it once a frame; it fades when the pointer leaves.
  const light = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    const { clientX, clientY } = event
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const element = root.current
      if (!element) return
      const box = element.getBoundingClientRect()
      element.style.setProperty('--mx', `${clientX - box.left}px`)
      element.style.setProperty('--my', `${clientY - box.top + element.scrollTop}px`)
      element.style.setProperty('--spot', '1')
    })
  }
  return (
    <div ref={root} className="lb-start" onPointerMove={light} onPointerLeave={() => root.current?.style.setProperty('--spot', '0')}>
      <div className="lb-start-bg" aria-hidden><span className="lb-start-glow" /></div>
      <div className="lb-start-in">
        <span className="lb-start-orb"><Icon name="sparkles" /></span>
        <h1>Ne yapıyoruz?</h1>
        <p>Tek cümle yaz. Brief’i, planı ve sahneleri Spark kanal belleğinden kurar; sen izler, düzeltir ya da olduğu gibi üretirsin.</p>
        <Composer run={run} big />
        <PromptIdeas run={run} />
        <ChannelLayer />
      </div>
    </div>
  )
}

const DRAFT_PARTS = [
  { label: 'Brief', from: BRIEF[0]!.at, to: BRIEF[BRIEF.length - 1]!.at },
  { label: 'Plan · 5 sahne', from: SCENES[0]!.at, to: SCENES[SCENES.length - 1]!.at },
  { label: 'Bağlam · kanal belleğinden', from: CONTEXT[0]!.at, to: CONTEXT[CONTEXT.length - 1]!.at },
  { label: 'Varlıklar ve varsayımlar', from: ASSETS[0]!.at, to: ASSUMPTIONS[ASSUMPTIONS.length - 1]!.at },
]

/** What a scene's media step makes, as frames: the close-up of the hook is made in three takes, Spark keeps one. */
const STEP_TAKES: Record<string, number> = { t2: 3 }

function stepMedia(run: LabRun, step: AgentStep, status: AgentStepState) {
  if (!step.adds?.endsWith(':media') || !step.sceneId || (status !== 'done' && status !== 'current')) return undefined
  const scene = sceneById(step.sceneId)
  if (!scene) return undefined
  const takes = STEP_TAKES[step.id] ?? 1
  return (
    <AgentMedia
      ratio={ratioOf(run.state.ratio).css}
      tiles={Array.from({ length: takes }, (_, index) => ({
        id: `${step.id}-${index}`,
        label: takes > 1 ? `${scene.role} · ${index + 1}. çekim` : scene.role,
        chosen: takes > 1 && status === 'done' && index === 0,
        content: status === 'done' ? <div className="lb-thumb"><div className={`lb-art ${scene.art}${index ? ` v${index + 1}` : ''}`} /></div> : null,
      }))}
    />
  )
}

/** A step's state as the shared parts mark it. */
function stepState(run: LabRun, index: number): AgentStepState {
  const st = stepStatus(run.state, index)
  return st === 'done' ? 'done' : st === 'current' ? 'current' : st === 'undone' ? 'undone' : st === 'skipped' ? 'skipped' : 'pending'
}

/**
 * The job card: the plan as to-dos (Queue) — while Spark drafts, the parts of the project as it writes them; then the
 * scenes, each struck through once it is made — and, once production runs, the steps Spark takes (Chain of Thought):
 * only what it has done and is doing, one under the other, with what a step makes side by side and "Geri al" on
 * each. There is no status badge: the marks are the status. A plan that waits for approval is opened from here
 * ("Planı gör"). The card does not pause the run or ask what comes after it: pausing is the composer's send button
 * (`RunSend`) and the closing question sits on the composer (`ClosingQuestion`). The main Chat shows this same card
 * for its job: `credits` puts the job's own estimate in, `actions` its own buttons, `planOpen` says the plan is
 * already open beside the chat.
 */
export function JobCard({ run, onOpenPlan, controls = true, credits, actions, planOpen = false }: {
  run: LabRun
  onOpenPlan?: () => void
  /** Off where the card's own buttons would repeat the view's (the plan is a tab away). */
  controls?: boolean
  credits?: string
  actions?: React.ReactNode
  planOpen?: boolean
}) {
  const { state } = run
  const { done, total } = progress(state)
  const working = state.phase === 'building'
  const producing = working || state.phase === 'done'
  const drafting = state.phase === 'drafting'
  const asking = pendingQuestion(state)
  const awaitsApproval = state.phase === 'plan' && state.autonomy === 'ask'
  const writing = DRAFT_PARTS.findIndex((part) => state.tick <= part.to)
  const estimate = credits ? <span className="lb-est"><Icon name="key" size="sm" />{credits}</span> : <EstimateLine />
  const planButton = onOpenPlan ? (
    <button type="button" className={`btn sm${awaitsApproval && !planOpen ? ' primary' : ''}`} onClick={onOpenPlan}>{planOpen ? 'Planı kapat' : 'Planı gör'}</button>
  ) : null

  const draftItems: AgentQueueItem[] = DRAFT_PARTS.map((part, index) => {
    const ready = state.tick > part.to
    // One part is being written at a time: the first that is not done.
    const active = !ready && index === writing
    const waits = active && asking !== null
    return { id: part.label, text: part.label, state: ready ? 'done' : waits ? 'waiting' : active ? 'current' : 'pending', meta: waits ? 'Yanıtını bekliyor' : undefined }
  })
  const sceneItems: AgentQueueItem[] = SCENES.map((scene) => {
    const status = sceneStatus(state, scene.id)
    return {
      id: scene.id,
      text: scene.role,
      meta: `${scene.end - scene.start} sn`,
      state: !producing ? 'pending' : status === 'ready' ? 'done' : status === 'working' ? 'current' : status === 'yours' ? 'skipped' : 'pending',
      onClick: producing ? () => run.view(scene.id) : undefined,
    }
  })

  const planFooter = state.phase === 'plan' ? (
    <>
      <span className="lb-queue-state"><AgentStepIcon state={awaitsApproval ? 'waiting' : 'current'} />{awaitsApproval ? 'Plan hazır, onayını bekliyor' : 'Plan hazır, üretim başlıyor'}</span>
      <span className="grow" />
      {awaitsApproval ? null : <span className="lb-autostart">Otomatik başlıyor<i /></span>}
      {actions}
      {planButton}
    </>
  ) : null

  // What Spark has done and is doing; what is still to come is one quiet line.
  const reached = STEPS.map((step, index) => ({ step, state: stepState(run, index) })).filter((entry) => entry.state !== 'pending')
  const ahead = STEPS.length - reached.length
  const chainSteps: AgentChainStep[] = reached.map(({ step, state: st }) => {
    const scene = step.sceneId ? sceneById(step.sceneId) : null
    return {
      id: step.id,
      state: st,
      label: st === 'skipped' ? `${step.label} · sende` : st === 'current' ? step.doing : step.label,
      badges: scene ? [`Sahne ${scene.n} · ${scene.role}`] : undefined,
      media: stepMedia(run, step, st),
      onClick: step.sceneId ? () => run.view(step.sceneId!) : undefined,
      action: st === 'done' || st === 'undone' ? (
        <button
          type="button"
          className="lb-step-undo"
          onClick={(event) => {
            event.stopPropagation()
            run.undoStep(step.id)
          }}
        >
          {st === 'undone' ? 'Yinele' : 'Geri al'}
        </button>
      ) : undefined,
    }
  })
  if (ahead > 0) chainSteps.push({ id: 'ahead', state: 'pending', label: `Sırada ${ahead} adım` })
  // Under the folded line: the frames of the latest step that makes some (the takes while they render, then the kept).
  const latestMedia = [...chainSteps].reverse().find((step) => step.media)?.media
  const now = currentStep(state)
  // While Spark works the folded line already counts the steps: a footer then only for the card's own buttons.
  const chainFooter = !working ? (
    <>
      <span className="lb-job-count">{done} adım · her biri geri alınabilir</span>
      <span className="grow" />
      {actions}
      {planButton}
    </>
  ) : controls && (actions || planButton) ? (
    <>
      <span className="grow" />
      {actions}
      {planButton}
    </>
  ) : null

  return (
    <div className="lb-job-flow">
      <AgentQueue
        sections={[drafting
          ? { id: 'draft', count: DRAFT_PARTS.length, label: 'parça yazılıyor', items: draftItems }
          : { id: 'plan', count: `${SCENES.length} sahne`, label: `· ${formatClock(TOTAL_SECONDS)}`, meta: estimate, items: sceneItems }]}
        footer={planFooter}
      />
      {producing ? (
        <AgentChain
          title={state.phase === 'done' ? `${done} adımda video hazır` : 'Spark üretiyor'}
          working={working}
          current={state.driver === 'user' ? 'Sen sürüyorsun; Spark bekliyor' : state.paused ? 'Duraklatıldı' : now?.doing}
          meta={working ? `${done}/${total}` : undefined}
          preview={working ? latestMedia : undefined}
          steps={chainSteps}
          footer={chainFooter}
        />
      ) : null}
    </div>
  )
}

/** What Spark worked through while it drafted, for the reasoning line (`AgentThinking`). */
export function draftThoughts(run: LabRun) {
  const { state } = run
  const reached = (at: number) => state.phase !== 'drafting' || state.tick > at
  const lines: string[] = []
  if (reached(BRIEF[BRIEF.length - 1]!.at)) lines.push('İsteği bir brief’e çevirdim: amaç, kitle, ana mesaj, format, ton.')
  if (reached(CONTEXT[CONTEXT.length - 1]!.at)) lines.push('Kanal belleğinden 3 kural ve 3 bilgi aldım.')
  if (reached(SCENES[SCENES.length - 1]!.at)) lines.push(`${SKILL.name} yeteneğiyle 5 sahnelik bir plan çıkardım.`)
  if (reached(ASSUMPTIONS[ASSUMPTIONS.length - 1]!.at)) lines.push('Sormadan verdiğim küçük kararları Varsayımlarım’a yazdım.')
  return lines
}

/** How long the draft took, as the reasoning line says it when it is done. */
export const DRAFT_SECONDS = Math.round((DRAFT_END * 190) / 1000)

/**
 * Pause / take over while the agent drives; hand back while the user does. `pause` is off beside a chat, whose send
 * button pauses the run (`RunSend`).
 */
export function DriveButtons({ run, small, pause = true, onTakeOver }: { run: LabRun; small?: boolean; pause?: boolean; onTakeOver?: () => void }) {
  const { state } = run
  const size = small ? ' sm' : ''
  if (state.driver === 'user') {
    return (
      <button type="button" className={`btn${size} primary`} onClick={run.handBack}>
        <Icon name="sparkles" size="sm" />
        Spark’a geri ver
      </button>
    )
  }
  return (
    <>
      {pause ? (
        <button type="button" className={`btn${size}`} onClick={state.paused ? run.resume : run.pause}>
          <Icon name={state.paused ? 'play' : 'pause'} size="sm" />
          {state.paused ? 'Sürdür' : 'Duraklat'}
        </button>
      ) : null}
      <button
        type="button"
        className={`btn${size}`}
        onClick={() => {
          run.takeOver()
          onTakeOver?.()
        }}
      >
        <Icon name="pointer" size="sm" />
        Devral
      </button>
    </>
  )
}

/** The bar that says who is driving the editor right now. */
export function AgentBar({ run }: { run: LabRun }) {
  const { state } = run
  if (state.phase !== 'building') return null
  const step = currentStep(state)
  const { done, total } = progress(state)
  const user = state.driver === 'user'
  return (
    <div className={`lb-bar${user ? ' user' : state.paused ? ' paused' : ''}`}>
      <span className="lb-bar-who">
        <i />
        {user ? 'Sen sürüyorsun' : state.paused ? 'Spark duraklatıldı' : 'Spark düzenliyor'}
      </span>
      <span className="lb-bar-step">
        {user ? 'Spark bekliyor; yaptığın değişikliklerin üstüne yazmaz.' : step?.doing}
      </span>
      <span className="lb-bar-meter" aria-hidden>
        <i style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="lb-bar-count">{done}/{total}</span>
      {user ? null : (
        <button type="button" className={`btn sm ghost lb-follow${state.follow ? ' on' : ''}`} onClick={run.toggleFollow} title="Görünüm Spark’ın çalıştığı yeri izler">
          <Icon name="monitor" size="sm" />
          <span>Takip {state.follow ? 'açık' : 'kapalı'}</span>
        </button>
      )}
      <DriveButtons run={run} small />
    </div>
  )
}

/** The final render once it is asked for (the closing question): a line while it is taken, then that it is ready. */
function RenderLine({ run }: { run: LabRun }) {
  const { render } = run.state
  if (render === 'none') return null
  return (
    <span className="lb-queue-state lb-in">
      <AgentStepIcon state={render === 'rendering' ? 'current' : 'done'} />
      {render === 'rendering' ? <span className="lb-shimmer">Son render alınıyor…</span> : `Son render hazır · 1080p MP4 · ${formatClock(TOTAL_SECONDS)}`}
    </span>
  )
}

/** What this video taught and the channel now keeps (the closing question's "Kanal için sakla"); each can be taken back. */
export function ClosingSuggestions({ run }: { run: LabRun }) {
  return (
    <div className="card lb-closing">
      <div className="card-h">
        <span className="ic"><Icon name="up" /></span>
        Kanal için saklananlar
        <span className="meta">Geri alınabilir</span>
      </div>
      <ul className="lb-closing-list">
        {SUGGESTIONS.map((item) => {
          const saved = run.state.promoted.includes(item.id)
          return (
            <li key={item.id}>
              <span>{item.text}</span>
              <button type="button" className={`btn sm${saved ? ' ghost' : ''}`} onClick={() => run.promote(item.id)}>
                {saved ? <Icon name="check" size="sm" /> : null}
                {saved ? 'Kaydedildi' : item.action}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const COUNT_WORD = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş']

/**
 * The conversation: the user's one sentence, what Spark asked and was told, the agent's account of what it did,
 * and the job card. With `detail` (the Sohbet view, where the thread is the whole page) the agent's own
 * decisions follow as a card. A question that is still open is not in the thread: it sits on the composer.
 */
export function Chat({ run, onOpenPlan, controls, detail }: { run: LabRun; onOpenPlan?: () => void; controls?: boolean; detail?: boolean }) {
  const { state } = run
  if (state.phase === 'empty') {
    return (
      <div className="msgs">
        <div className="empty">
          <div className="big"><Icon name="sparkles" /></div>
          <h3>Ne yapıyoruz?</h3>
          <p>Tek cümle yaz. Brief’i, planı ve varlıkları Spark kanal belleğinden doldurur.</p>
          <PromptIdeas run={run} />
        </div>
      </div>
    )
  }
  const own = assumptionsOf(state).length
  return (
    <div className="msgs">
      <div className="m-user"><div className="bubble">{state.prompt}</div></div>
      {askedQuestions(state).map((question) => (
        <React.Fragment key={question.id}>
          <div className="m-ai lb-in">
            <div className="ai-who"><span className="orb"><Icon name="sparkles" /></span>Spark</div>
            <div className="ai-text">{question.text}</div>
          </div>
          <div className="m-user lb-in"><div className="bubble">{state.answers[question.id] ?? 'Sen karar ver.'}</div></div>
        </React.Fragment>
      ))}
      <div className="m-ai">
        <div className="ai-who"><span className="orb"><Icon name="sparkles" /></span>Spark</div>
        <AgentThinking
          working={state.phase === 'drafting'}
          label={pendingQuestion(state) ? 'Bir şeyi sana sormam gerekiyor…' : 'Kanal belleğini okuyorum, projeyi yazıyorum…'}
          doneLabel={`${DRAFT_SECONDS} sn düşündü`}
          lines={draftThoughts(run)}
        />
        {state.phase === 'drafting' ? null : (
          <div className="ai-text">
            Kanal belleğinden <b>3 kural</b> ve <b>3 bilgi</b> kullandım; <b>{SKILL.name}</b> yeteneğiyle 5 sahnelik bir plan çıkardım.
            {own ? <> {COUNT_WORD[own] ?? own} küçük kararı kendim verdim, <b>Varsayımlarım</b>’da duruyor.</> : null}
          </div>
        )}
        <JobCard run={run} onOpenPlan={onOpenPlan} controls={controls} />
        {detail && own ? (
          <div className="card lb-assume-card">
            <div className="card-h">
              <span className="ic"><Icon name="history" /></span>
              Varsayımlarım
              <span className="meta">Sormadan verdiğim kararlar · geri alınabilir</span>
            </div>
            <AssumptionList run={run} />
          </div>
        ) : null}
      </div>
      {state.phase === 'done' ? (
        <div className="m-ai">
          <div className="ai-text">30 saniyelik video tamam; 4 kuralın 4’ü sağlandı. Beğenmediğin adımı kartından geri alabilirsin.</div>
          <RenderLine run={run} />
          {keptForChannel(state).length ? <ClosingSuggestions run={run} /> : null}
        </div>
      ) : null}
    </div>
  )
}

// ---- the editor surface ------------------------------------------------------------------------------------

/** The stage: the scene on screen, with the layers placed so far. */
export function LabStage({ run }: { run: LabRun }) {
  const { state } = run
  const scene = sceneById(shownSceneId(state)) ?? SCENES[0]!
  const live = state.phase === 'building' || state.phase === 'done'
  const step = currentStep(state)
  const onFrame = agentDriving(state) && step?.target === 'frame' && state.follow
  const generating = live && !isAdded(state, `${scene.id}:media`)
  return (
    <div className="stage lb-stage">
      <div className="lb-stage-in">
        <div className={`frame lb-frame${onFrame ? ' lb-agent-on' : ''}`} data-agent-target="frame">
          {/* Before production the frame stays empty and says nothing: the chat is the one place that says how to start. */}
          {live ? <SceneThumb scene={scene} run={run} targets /> : null}
          {generating ? <span className="lb-frame-empty shimmer">{assetById(scene.assetId)?.kind === 'generate' ? 'Üretiliyor…' : 'Yerleştiriliyor…'}</span> : null}
        </div>
      </div>
      <div className="stage-foot">
        {live ? <span className="pill">Sahne {scene.n} · {scene.role}</span> : <span />}
        <span className="pill">{state.ratio}</span>
      </div>
    </div>
  )
}

/**
 * The agent's cursor: a named pointer that travels to the element the current step changes. `targetOf` lets a
 * variant point at its own elements (a scene card instead of a timeline clip).
 */
export function AgentCursor({ scope, run, targetOf }: { scope: React.RefObject<HTMLElement | null>; run: LabRun; targetOf?: (step: AgentStep) => string }) {
  const { state } = run
  const step = currentStep(state)
  const target = step ? (targetOf ? targetOf(step) : step.target) : null
  const [spot, setSpot] = React.useState<{ x: number; y: number } | null>(null)
  const shown = shownSceneId(state)

  const follow = state.follow && Boolean(targetOf)
  React.useEffect(() => {
    const root = scope.current
    if (!root || !target) return
    // Following: the board scrolls to the scene the agent is on (scene-level targets only).
    if (follow) root.querySelector(`[data-agent-target="${target}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    const measure = () => {
      const element = root.querySelector<HTMLElement>(`[data-agent-target="${target}"]`)
      // Not following: the agent works on a scene that is not on screen, so there is nothing to point at.
      if (!element) return setSpot(null)
      const box = element.getBoundingClientRect()
      const origin = root.getBoundingClientRect()
      setSpot({ x: box.left - origin.left + box.width * 0.6, y: box.top - origin.top + box.height * 0.55 })
    }
    // The target may be rendered by this same update (a layer arriving on the stage): measure after paint, and
    // again once fonts and late layout have settled.
    const frame = window.requestAnimationFrame(measure)
    const settle = [250, 900].map((delay) => window.setTimeout(measure, delay))
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    // A side panel opening or closing moves the target without resizing the root: watch the work it sits in.
    const element = root.querySelector<HTMLElement>(`[data-agent-target="${target}"]`)
    const work = element?.closest('section')
    if (work) observer.observe(work)
    window.addEventListener('resize', measure)
    root.addEventListener('scroll', measure, true)
    return () => {
      window.cancelAnimationFrame(frame)
      settle.forEach((timer) => window.clearTimeout(timer))
      observer.disconnect()
      window.removeEventListener('resize', measure)
      root.removeEventListener('scroll', measure, true)
    }
  }, [scope, target, shown, follow])

  if (!step || !spot || state.driver === 'user') return null
  return (
    <div className={`lb-cursor${state.paused ? ' paused' : ''}`} style={{ transform: `translate(${spot.x}px, ${spot.y}px)` }} aria-hidden>
      <svg viewBox="0 0 16 16"><path d="M2 1.5 13.5 7 8.4 8.6 6.6 14z" /></svg>
      <span>Spark</span>
    </div>
  )
}

/** The tools on the rail, after the view's own lead (Scenes). */
const TOOLS = [
  { id: 'media', icon: 'image', label: 'Medya' },
  { id: 'text', icon: 'type', label: 'Metin' },
  { id: 'captions', icon: 'captions', label: 'Altyazı' },
]
/** The tools behind "Daha fazla". */
const MORE_TOOLS = [
  { id: 'avatar', icon: 'user', label: 'Avatar' },
  { id: 'shape', icon: 'shapes', label: 'Şekil' },
  { id: 'motion', icon: 'motion', label: 'Hareket' },
  { id: 'record', icon: 'record', label: 'Kayıt' },
]

/**
 * The editor's tool rail. `lead` is the first tool (Scenes), which the view wires to its drawer. Three tools follow
 * it; the rest open from "Daha fazla" as a small menu beside the rail.
 */
export function ToolRail({ lead }: { lead?: React.ReactNode }) {
  const trigger = React.useRef<HTMLButtonElement>(null)
  const [more, setMore] = React.useState<{ left: number; top: number; shell: Element } | null>(null)
  const toggleMore = () => {
    const button = trigger.current
    const shell = button?.closest('.st-shell')
    if (more || !button || !shell) return setMore(null)
    const box = button.getBoundingClientRect()
    const origin = fixedOrigin(shell)
    setMore({ left: box.right - origin.left + 6, top: box.top - origin.top, shell })
  }
  const close = () => {
    setMore(null)
    trigger.current?.focus()
  }
  return (
    <nav className="rail">
      {lead}
      {TOOLS.map((tool) => (
        <button key={tool.id} type="button" className="rail-btn">
          <Icon name={tool.icon} />
          {tool.label}
        </button>
      ))}
      <button ref={trigger} type="button" className={`rail-btn lb-rail-more${more ? ' on' : ''}`} aria-haspopup="menu" aria-expanded={Boolean(more)} onClick={toggleMore}>
        <Icon name="more" />
        Daha fazla
      </button>
      {more
        ? createPortal(
            <>
              <div className="lb-menu-veil" onPointerDown={() => setMore(null)} />
              <div className="lb-menu lb-rail-menu" role="menu" aria-label="Diğer araçlar" style={{ left: more.left, top: more.top }} onKeyDown={(event) => event.key === 'Escape' && close()}>
                {MORE_TOOLS.map((tool, index) => (
                  <button key={tool.id} type="button" role="menuitem" autoFocus={index === 0} onClick={close}>
                    <Icon name={tool.icon} />
                    {tool.label}
                  </button>
                ))}
              </div>
            </>,
            more.shell,
          )
        : null}
    </nav>
  )
}

/** Whether `scope` is at most `px` wide: where a side panel stops being a column and covers the work instead. */
export function useNarrow(scope: React.RefObject<HTMLElement | null>, px: number) {
  const [narrow, setNarrow] = React.useState(false)
  React.useEffect(() => {
    const element = scope.current
    if (!element) return
    const observer = new ResizeObserver(() => setNarrow(element.clientWidth <= px))
    observer.observe(element)
    return () => observer.disconnect()
  }, [scope, px])
  return narrow
}

/**
 * A moment Spark cannot go on without the user: the first sentence of an empty project, a question it asked, and
 * (where `approval`) a plan waiting for "Bu planla üret".
 */
function blockingMoment(state: LabRun['state'], approval: boolean): string | null {
  if (state.phase === 'empty') return 'start'
  const asking = pendingQuestion(state)
  if (asking) return `question:${asking.id}`
  if (approval && state.phase === 'plan' && state.autonomy === 'ask') return 'plan'
  return null
}

export type SparkPanel = { id: string; open: boolean; narrow: boolean; waiting: boolean; setOpen: (open: boolean) => void }

/**
 * Spark's panel beside the work (Plan, Editör): closed unless the user opened it, which is kept per browser (`id`).
 * It opens by itself when Spark cannot go on without the user (`blockingMoment`), once per moment, and stays open
 * until it is closed. Where it covers the work (`narrowAt` and narrower) it never opens from the kept choice, so a
 * small window never starts with the work hidden. Closed, `waiting` says something is waiting for the user there.
 */
export function useSparkPanel(
  run: LabRun,
  id: string,
  { scope, narrowAt, approval = false }: { scope: React.RefObject<HTMLElement | null>; narrowAt: number; approval?: boolean },
): SparkPanel {
  const [kept, keep] = usePaneOpen(id, false)
  const narrow = useNarrow(scope, narrowAt)
  // Opened on a narrow window: for this visit only.
  const [here, setHere] = React.useState(false)
  const moment = blockingMoment(run.state, approval)
  const [openedFor, setOpenedFor] = React.useState<string | null>(null)
  const [opened, setOpened] = React.useState(false)
  // A new blocking moment opens the panel (during render, so it is open in the same paint as the question).
  if (moment && moment !== openedFor) {
    setOpenedFor(moment)
    setOpened(true)
  }
  const open = (narrow ? here : kept) || opened
  const setOpen = (next: boolean) => {
    setOpened(false)
    if (narrow) setHere(next)
    else keep(next)
  }
  const waiting = !open && (moment !== null || closingChoices(run.state) !== null || run.state.paused)
  return { id, open, narrow, waiting, setOpen }
}

/** Spark's panel switch at the end of the top bar, over the panel it opens; a dot while something waits there. */
export function SparkPanelToggle({ panel }: { panel: SparkPanel }) {
  return (
    <button
      type="button"
      className={`btn sm ghost lb-spark-toggle${panel.open ? ' on' : ''}`}
      aria-pressed={panel.open}
      aria-controls={panel.id}
      title={panel.open ? 'Spark panelini kapat' : panel.waiting ? 'Spark seni bekliyor' : 'Spark panelini aç'}
      onClick={() => panel.setOpen(!panel.open)}
    >
      <Icon name="sparkles" size="sm" />
      Spark
      {panel.waiting ? <i className="lb-views-dot" aria-hidden /> : null}
    </button>
  )
}

/** Closes a panel that covers the work (`active`) with Escape. */
export function useEscapeToClose(active: boolean, close: () => void) {
  const latest = React.useRef(close)
  React.useEffect(() => {
    latest.current = close
  })
  React.useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}

/**
 * Save state as one icon: it spins while a change is being written and settles into a check. Every change of
 * the run is a new revision, so the mark is remounted and plays again; while the agent keeps writing it keeps
 * spinning.
 */
function SaveMark({ run }: { run: LabRun }) {
  const { state } = run
  const revision = [state.phase, state.tick, state.step, state.ratio, state.undone.length, state.dropped.length, state.promoted.length, state.locked.length].join(':')
  return (
    <span key={revision} className="lb-save" role="status" aria-label="Kaydedildi" title="Değişiklikler kaydedildi">
      <Icon name="refresh" size="sm" />
      <Icon name="check-c" size="sm" />
    </span>
  )
}

/**
 * The project's top bar, the same in every view: the project by its name (the mark leads back to the projects)
 * and its save mark, the view switch in the exact middle, the actions. "Dışa aktar" opens the shared schedule
 * dialog (Şimdi yayınla / Planla); the project stays on screen, the toast leads to the calendar. `panel` (Spark's
 * panel switch) comes last, over the panel it opens.
 */
export function TopBar({ run, children, panel }: { run: LabRun; children?: React.ReactNode; panel?: React.ReactNode }) {
  const fresh = run.state.phase === 'empty'
  const views = React.useContext(ViewSwitchContext)
  const [exporting, setExporting] = React.useState(false)
  const title = projectTitle(run)
  return (
    <header className="top lb-top">
      <div className="lb-top-l">
      <Link className="logo" href="/spark" title="Projelere dön" aria-label="Projelere dön">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2 22 12 12 22 2 12z" /></svg>
      </Link>
        <input className="title-in" aria-label="Proje adı" key={projectTitle(run)} defaultValue={projectTitle(run)} />
        {fresh ? null : <SaveMark run={run} />}
      </div>
      {views}
      <div className="lb-top-r">
        {children}
        <button type="button" className="btn primary" disabled={run.state.phase !== 'done'} aria-haspopup="dialog" onClick={() => setExporting(true)}>Dışa aktar</button>
        {panel}
      </div>
      <ScheduleDialog
        open={exporting}
        onOpenChange={setExporting}
        item={{ id: `spark:${title}`, title, thumbnail: '/flows/tips.png', source: 'spark' }}
      />
    </header>
  )
}

export { Icon }
export { LabDock } from './lab-timeline'
