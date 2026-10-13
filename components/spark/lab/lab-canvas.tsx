'use client'

import Link from 'next/link'

import { LabFrame } from './lab-frame'
import { SCENES, TOTAL_SECONDS, formatClock } from './lab-model'
import { DriveButtons, Icon } from './lab-parts'
import { PlanScript } from './plan-script'
import { projectTitle, type LabRun } from './use-lab-run'
import { ScreenLine, SparkScreen } from './variant-chat'
import { PlanTimeline } from './variant-storyboard'

/**
 * Spark's workspace as the main Chat's canvas, from its own parts. While the plan waits it is the plan as a script
 * (Spark's Senaryo) with the timeline closed under it, and the decision sits in the top bar beside "Spark'ta aç":
 * "Bu planla üret" decides the job's plan (`onApprove`), "Yeniden planla" asks for a change in the chat (`onFix`).
 * Once production starts it is the editor as Spark drives it (Spark's screen: preview and the open timeline), with
 * who drives and "Devral" in the same one bar (pausing is the chat's send button). The run is the job's shared run,
 * so what happens here goes on in Spark, and back.
 */
export function LabCanvas({
  run,
  href,
  onApprove,
  onFix,
  credits,
  onEdit,
  onClose,
  closeLabel,
}: {
  run: LabRun
  /** The project in Spark ("Spark'ta aç"). */
  href?: string
  onApprove: () => void
  onFix?: () => void
  /** The job's estimate beside the plan's length. */
  credits?: string
  onEdit: () => void
  onClose: () => void
  closeLabel: string
}) {
  const planning = run.state.phase === 'plan'
  const building = run.state.phase === 'building'
  return (
    <LabFrame ratio={run.state.ratio}>
      <div className="app lb-canvas">
        <header className="top lb-top">
          <div className="lb-top-l">
            <b className="lb-canvas-title" title={projectTitle(run)}>{projectTitle(run)}</b>
            {planning ? (
              <span className="lb-canvas-meta">
                <b>Plan hazır</b> · {SCENES.length} sahne · {formatClock(TOTAL_SECONDS)}{credits ? ` · ${credits}` : ''}
              </span>
            ) : building ? (
              <span className="lb-canvas-meta lb-canvas-live"><ScreenLine run={run} /></span>
            ) : run.state.phase === 'done' ? (
              <span className="lb-canvas-meta">Video hazır · {formatClock(TOTAL_SECONDS)}</span>
            ) : null}
          </div>
          <div className="lb-top-r">
            {building ? <DriveButtons run={run} small pause={false} onTakeOver={onEdit} /> : null}
            {planning ? (
              <>
                {onFix ? (
                  <button type="button" className="btn sm" onClick={onFix} title="Yeniden planla">
                    <Icon name="refresh" size="sm" />
                    Yeniden planla
                  </button>
                ) : null}
                <button type="button" className="btn sm primary" onClick={onApprove}>Bu planla üret</button>
              </>
            ) : null}
            {href ? (
              <Link className="btn sm" href={href} title="Spark’ta aç">
                <Icon name="expand" size="sm" />
                Spark’ta aç
              </Link>
            ) : null}
            <button type="button" className="ib" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
              <Icon name="x" size="sm" />
            </button>
          </div>
        </header>
        <div className="lb-canvas-body">
          {planning ? (
            <>
              <PlanScript run={run} scenes={SCENES} />
              <PlanTimeline run={run} sizeKey="canvas-plan-dock" />
            </>
          ) : (
            <SparkScreen run={run} onEdit={onEdit} dockKey="canvas-dock" head={false} />
          )}
        </div>
      </div>
    </LabFrame>
  )
}
