'use client'

import * as React from 'react'

import { Icon } from '../tools/studio-parts'
import { lastBatchTargets, type LabRun } from './use-lab-run'
import './lab-notes.css'

// Notes for Spark. What the user wants changed is picked (scenes of the plan, clips of the timeline) and said in the
// chat, the pick riding on its composer as a chip. Notes kept on the list (a new source for a scene's picture) wait
// here until the notes bar fixes them all at once ("Hepsini düzelt"). Every sending is one edit: only the scenes and
// clips it names are made again, each shows as soon as it is ready, and it can be taken back.

/**
 * What waits and what Spark is doing with it: the notes kept so far and the button that makes them all again, then
 * each change as it gets ready, then the finished edit with the way to take it back. `float` sits over the bottom of
 * the plan, `inline` in the timeline's tool row.
 */
export function NotesBar({ run, variant }: { run: LabRun; variant: 'float' | 'inline' }) {
  const { notes, applying, applyingLeft, batches } = run.state
  const changed = lastBatchTargets(run.state)
  // The report of a finished edit can be put away; a new edit brings it back.
  const [closed, setClosed] = React.useState(0)

  let body: React.ReactNode = null
  let mode = ''
  if (applying !== null) {
    const ready = changed.length - applyingLeft.length
    mode = ' working'
    body = (
      <span className="lb-notes-msg" role="status">
        <span className="spin" />
        Spark düzeltiyor
        <span className="lb-notes-count">{ready}/{changed.length} hazır</span>
        <i className="lb-notes-meter"><i style={{ width: `${(ready / Math.max(1, changed.length)) * 100}%` }} /></i>
      </span>
    )
  } else if (notes.length) {
    const names = [...new Set(notes.flatMap((note) => note.labels))]
    const targets = new Set(notes.flatMap((note) => note.targets)).size
    mode = ' pending'
    body = (
      <>
        <span className="lb-notes-msg" title={names.join(', ')}>
          <Icon name="note" size="sm" />
          <b>{notes.length} değişiklik listede</b>
          {/* In the tool row there is room for how many, not for every name. */}
          {variant === 'float' ? <span className="lb-notes-names">{names.join(' · ')}</span> : null}
        </span>
        <button type="button" className="lb-act" onClick={run.clearNotes}>Temizle</button>
        <button type="button" className="btn sm primary" onClick={() => run.sendNotes()} title="Listedeki bütün notları tek seferde düzelt">
          <Icon name="sparkles" size="sm" />
          Hepsini düzelt{targets > 1 ? ` · ${targets}` : ''}
        </button>
      </>
    )
  } else if (changed.length && closed !== batches) {
    body = (
      <>
        <span className="lb-notes-msg done" role="status">
          <Icon name="check" size="sm" />
          {changed.length > 1 ? `${changed.length} düzeltme hazır` : 'Düzeltme hazır'}
        </span>
        <button type="button" className="lb-act" onClick={() => run.undoBatch(batches)}>
          <Icon name="undo" size="sm" />
          {changed.length > 1 ? 'Tümünü geri al' : 'Geri al'}
        </button>
        <button type="button" className="ib xs" onClick={() => setClosed(batches)} title="Kapat" aria-label="Kapat"><Icon name="x" size="sm" /></button>
      </>
    )
  }
  if (!body) return null
  return <div className={`lb-notes-bar ${variant}${mode}`}>{body}</div>
}
