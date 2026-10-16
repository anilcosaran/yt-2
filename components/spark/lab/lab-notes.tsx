'use client'

import * as React from 'react'

import { Icon } from '../tools/studio-parts'
import { lastBatchTargets, type LabRun } from './use-lab-run'
import './lab-notes.css'

// Notes for Spark. What the user wants changed is picked first (scenes of the plan, clips of the timeline), and a
// toolbar opens on the pick with one line for Spark and two ways on: "Düzelt" fixes this pick now, "Listeye ekle"
// keeps the note on the list, and the notes bar fixes the whole list at once ("Hepsini düzelt"). Every sending is one
// edit: only the scenes and clips it names are made again, each shows as soon as it is ready, and it can be taken back.

/** What the toolbar works on: the targets (scene ids, or clips as `<lane>:<sceneId>`), named for the user. */
export type NoteSelection = { targets: string[]; labels: string[]; noun: string }

/**
 * The toolbar that opens on a pick: a near-black pill with the field, "Listeye ekle" (once something is written),
 * "Düzelt" and ✕. "Düzelt" (Enter) fixes this pick now and leaves the list as it is; with nothing written it reads
 * "Yeniden üret" and makes the pick again as it is. "Listeye ekle" (⌘ Enter) keeps the note for "Hepsini düzelt".
 * Escape, ✕ or a click elsewhere closes it. `keep` names what may be clicked without closing it.
 */
export function NoteToolbar({
  run,
  selection,
  onClose,
  focusSignal = 0,
  keep,
  className = '',
  style,
}: {
  run: LabRun
  selection: NoteSelection
  onClose: () => void
  /** Moves the focus to the field each time it changes. */
  focusSignal?: number
  keep?: string
  className?: string
  style?: React.CSSProperties
}) {
  const { notes, applying } = run.state
  const key = selection.targets.join('|')
  // The note already written for exactly this pick, if any: the field opens on it and saving changes it.
  const existing = notes.find((note) => note.targets.join('|') === key)
  const [text, setText] = React.useState(existing?.text ?? '')
  const [shownFor, setShownFor] = React.useState(key)
  if (shownFor !== key) {
    setShownFor(key)
    setText(existing?.text ?? '')
  }
  const box = React.useRef<HTMLDivElement>(null)
  const field = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (focusSignal) field.current?.focus()
  }, [focusSignal])
  React.useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target || box.current?.contains(target) || (keep && target.closest(keep))) return
      onClose()
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [keep, onClose])

  const note = { id: existing?.id, targets: selection.targets, labels: selection.labels, text }
  const written = Boolean(text.trim())
  const listIt = () => {
    if (!written) return
    run.saveNote(note)
    onClose()
  }
  const fixNow = () => {
    run.sendNotes(note, { only: true })
    onClose()
  }
  const name = selection.labels.length === 1 ? selection.labels[0] : `${selection.labels.length} ${selection.noun}`

  return (
    <div ref={box} className={`lb-ntb ${className}`} style={style} role="toolbar" aria-label={`${name}: Spark’a söyle`}>
      <span className="lb-ntb-mark" title={selection.labels.join(', ')}>
        <Icon name="sparkles" size="sm" />
        {selection.labels.length > 1 ? <b>{selection.labels.length}</b> : null}
      </span>
      <input
        ref={field}
        autoFocus
        value={text}
        placeholder="Spark’a ne değişsin?"
        aria-label={`${name}: Spark’a söyle`}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            listIt()
          } else if (event.key === 'Enter') {
            event.preventDefault()
            if (written) fixNow()
          } else if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
      />
      {written ? (
        <button type="button" className="lb-ntb-list" onClick={listIt} title="Notu listeye ekle, sonra hepsini birlikte düzelt (⌘ Enter)">
          <Icon name="plus" size="sm" />
          {existing ? 'Listede güncelle' : 'Listeye ekle'}
        </button>
      ) : null}
      <button type="button" className="lb-ntb-go" onClick={fixNow} disabled={applying !== null} title={written ? 'Spark bunu şimdi düzeltsin (Enter)' : 'Spark bunu olduğu gibi yeniden üretsin'}>
        <Icon name={written ? 'sparkles' : 'refresh'} size="sm" />
        {written ? 'Düzelt' : 'Yeniden üret'}
      </button>
      <button type="button" className="lb-ntb-close" onClick={onClose} title="Kapat (Esc)" aria-label="Kapat"><Icon name="x" size="sm" /></button>
    </div>
  )
}

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
