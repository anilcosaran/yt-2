'use client'

import * as React from 'react'
import { NodeResizer, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react'
import { Trash2, Ungroup } from 'lucide-react'

import './chain-annotations.css'

// Plan › Üretim's notes on its canvas (`plan-chain.tsx`), beside the nodes that make things: a frame that groups nodes
// (each scene of the video starts as one; the user can wrap a selection in one too) and a sticky note. Neither makes
// anything nor links to anything, so they have no ports. The canvas owns their data and moves a frame's nodes with it;
// these views only draw them and say what the user changed.

/**
 * The class of a frame's head (its name above the box). A frame moves by its head alone (React Flow's `dragHandle`);
 * its box lets every press through, so the canvas pans, selects and adds nodes inside it as if it were not there.
 */
export const FRAME_HANDLE = 'lb-an-frame-head'

export type FrameData = {
  title: string
  desc: string
  onTitle: (text: string) => void
  onDesc: (text: string) => void
  /** Removes the frame only; the nodes in it stay. */
  onRemove: () => void
}
export type FrameNode = Node<FrameData, 'frame'>

export type NoteData = { text: string; onText: (text: string) => void; onRemove: () => void }
export type NoteNode = Node<NoteData, 'note'>

/** Puts the caret in a field as it appears, without scrolling the canvas's frame, its text selected. */
function focusAndSelect(field: HTMLInputElement | null) {
  if (!field) return
  field.focus({ preventScroll: true })
  field.select()
}

/** Puts the caret in a field as it appears, without scrolling the canvas's frame. */
function focusQuietly(field: HTMLTextAreaElement | null) {
  field?.focus({ preventScroll: true })
}

// ---- frame ----------------------------------------------------------------------------------------------------

/** A group of nodes: a soft rounded box, its name and a line about it above, resizable while selected. */
export function FrameNodeView({ data, selected }: NodeProps<FrameNode>) {
  const [editing, setEditing] = React.useState<'title' | 'desc' | null>(null)
  const close = () => setEditing(null)
  // The description's place shows only when there is one, or while the frame is selected (to add one).
  const showDesc = Boolean(data.desc) || selected || editing === 'desc'
  return (
    <div className={`lb-an-frame${selected ? ' selected' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={260} minHeight={180} handleClassName="lb-an-handle" lineClassName="lb-an-line" />
      <div className={FRAME_HANDLE}>
        {editing === 'title' ? (
          <FrameField
            className="lb-an-frame-t"
            value={data.title}
            placeholder="Çerçeve adı"
            label="Çerçeve adı"
            onKeep={(text) => {
              // A frame always keeps a name: its head is what moves it.
              if (text && text !== data.title) data.onTitle(text)
            }}
            onClose={close}
          />
        ) : (
          <span className="lb-an-frame-t" onDoubleClick={() => setEditing('title')}>{data.title || 'Çerçeve'}</span>
        )}
        {showDesc ? (
          <>
            <i aria-hidden>·</i>
            {editing === 'desc' ? (
              <FrameField
                className="lb-an-frame-d"
                value={data.desc}
                placeholder="Açıklama ekle"
                label="Çerçeve açıklaması"
                onKeep={(text) => {
                  if (text !== data.desc) data.onDesc(text)
                }}
                onClose={close}
              />
            ) : (
              <span className={`lb-an-frame-d${data.desc ? '' : ' empty'}`} title={data.desc || undefined} onDoubleClick={() => setEditing('desc')}>
                {data.desc || 'Açıklama ekle'}
              </span>
            )}
          </>
        ) : null}
      </div>
      <NodeToolbar position={Position.Top} offset={40} align="start" className="lb-cv-bar">
        <button type="button" onClick={data.onRemove} title="Çerçeveyi kaldır: içindeki düğümler yerinde kalır">
          <Ungroup aria-hidden />
          Çerçeveyi kaldır
        </button>
      </NodeToolbar>
    </div>
  )
}

/** A frame's name or its line, edited in place: Enter or a click away keeps it (trimmed), Escape leaves it as it was. */
function FrameField({ className, value, placeholder, label, onKeep, onClose }: {
  className: string
  value: string
  placeholder: string
  label: string
  onKeep: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = React.useState(value)
  const cancelled = React.useRef(false)
  return (
    <input
      ref={focusAndSelect}
      className={`${className} lb-an-frame-in nodrag`}
      value={text}
      size={Math.max(text.length + 1, 8)}
      placeholder={placeholder}
      aria-label={label}
      spellCheck={false}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (!cancelled.current) onKeep(text.trim())
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelled.current = true
          event.currentTarget.blur()
        }
      }}
    />
  )
}

// ---- note -----------------------------------------------------------------------------------------------------

/** A sticky note: warm paper with the user's words; it drags from anywhere until selected, then it is written in. */
export function NoteNodeView({ data, selected }: NodeProps<NoteNode>) {
  return (
    <div className={`lb-an-note${selected ? ' selected' : ''}`}>
      {selected ? (
        <NoteField value={data.text} onText={data.onText} />
      ) : (
        <div className="lb-an-note-field" data-value={data.text}>
          <p className={data.text ? undefined : 'empty'}>{data.text || 'Not yaz…'}</p>
        </div>
      )}
      <NodeToolbar position={Position.Top} offset={12} align="end" className="lb-cv-bar">
        <button type="button" className="lb-an-icon" onClick={data.onRemove} title="Notu sil" aria-label="Notu sil">
          <Trash2 aria-hidden />
        </button>
      </NodeToolbar>
    </div>
  )
}

/**
 * A selected note's text as a field that grows with it (a hidden copy of the text sizes it where `field-sizing` is
 * missing). It keeps what was typed when it is left; Escape leaves it too. A brand-new, empty note takes the caret.
 */
function NoteField({ value, onText }: { value: string; onText: (text: string) => void }) {
  const [draft, setDraft] = React.useState<string | null>(null)
  // Whether the note was empty when it was selected, fixed for as long as it stays selected (so emptying it later
  // does not pull the caret back).
  const [fresh] = React.useState(() => !value)
  const text = draft ?? value
  return (
    <div className="lb-an-note-field" data-value={text}>
      <textarea
        ref={fresh ? focusQuietly : undefined}
        className="nodrag nowheel"
        rows={1}
        value={text}
        placeholder="Not yaz…"
        aria-label="Not"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== value) onText(draft)
          setDraft(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur()
        }}
      />
    </div>
  )
}
