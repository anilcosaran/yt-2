'use client'

import * as React from 'react'
import { NodeResizer, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react'
import { Trash2, Type, Ungroup } from 'lucide-react'

import './chain-annotations.css'

// Plan › Üretim's notes on its canvas (`plan-chain.tsx`), beside the nodes that make things: a frame that groups nodes
// (each scene of the video starts as one; the user can wrap a selection in one too), a sticky note and a free text (a
// heading or a line of description, without a box). None makes anything nor links to anything, so they have no ports. The canvas owns their data and moves a frame's nodes with it;
// these views only draw them and say what the user changed.

/**
 * The class of a frame's head (its name above the box). A frame moves by its head alone (React Flow's `dragHandle`);
 * its box lets every press through, so the canvas pans, selects and adds nodes inside it as if it were not there.
 */
export const FRAME_HANDLE = 'lb-an-frame-head'

/** The colours a frame can take; `none` is the canvas's own hairline. */
export const FRAME_COLORS = [
  { id: 'none', label: 'Renksiz', value: '' },
  { id: 'blue', label: 'Mavi', value: '#3b82f6' },
  { id: 'green', label: 'Yeşil', value: '#22a06b' },
  { id: 'yellow', label: 'Sarı', value: '#d9a106' },
  { id: 'orange', label: 'Turuncu', value: '#ea7a1f' },
  { id: 'pink', label: 'Pembe', value: '#e0457b' },
  { id: 'purple', label: 'Mor', value: '#8b5cf6' },
] as const
export type FrameColor = (typeof FRAME_COLORS)[number]['id']

export type FrameData = {
  title: string
  color: FrameColor
  onTitle: (text: string) => void
  onColor: (color: FrameColor) => void
  /** Removes the frame only; the nodes in it stay. */
  onRemove: () => void
}
export type FrameNode = Node<FrameData, 'frame'>

export type NoteData = { text: string; onText: (text: string) => void; onRemove: () => void }
export type NoteNode = Node<NoteData, 'note'>

/** A free text on the canvas: a heading, or a line of description. */
export type LabelData = { text: string; size: 'title' | 'body'; onText: (text: string) => void; onSize: (size: 'title' | 'body') => void; onRemove: () => void }
export type LabelNode = Node<LabelData, 'label'>

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

/**
 * A group of nodes: a soft rounded box, in a colour of the user's if they gave it one, its name above it. Any edge or
 * corner resizes it at any time (the corners show while it is selected); its name moves it.
 */
export function FrameNodeView({ data, selected }: NodeProps<FrameNode>) {
  const [editing, setEditing] = React.useState(false)
  const color = FRAME_COLORS.find((entry) => entry.id === data.color) ?? FRAME_COLORS[0]
  return (
    <div
      className={`lb-an-frame${selected ? ' selected' : ''}${color.value ? ' tinted' : ''}`}
      style={color.value ? ({ '--fc': color.value } as React.CSSProperties) : undefined}
    >
      <NodeResizer isVisible minWidth={260} minHeight={180} handleClassName="lb-an-handle" lineClassName="lb-an-line" />
      <div className={FRAME_HANDLE}>
        {color.value ? <i className="lb-an-frame-dot" aria-hidden /> : null}
        {editing ? (
          <FrameField
            className="lb-an-frame-t"
            value={data.title}
            placeholder="Çerçeve adı"
            label="Çerçeve adı"
            onKeep={(text) => {
              // A frame always keeps a name: its head is what moves it.
              if (text && text !== data.title) data.onTitle(text)
            }}
            onClose={() => setEditing(false)}
          />
        ) : (
          <span className="lb-an-frame-t" onDoubleClick={() => setEditing(true)} title="Adını değiştirmek için çift tıkla">{data.title || 'Çerçeve'}</span>
        )}
      </div>
      <NodeToolbar position={Position.Top} offset={40} align="start" className="lb-cv-bar">
        <span className="lb-an-swatches" role="radiogroup" aria-label="Çerçevenin rengi">
          {FRAME_COLORS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={entry.id === color.id}
              aria-label={entry.label}
              title={entry.label}
              className={`lb-an-swatch${entry.id === color.id ? ' on' : ''}${entry.value ? '' : ' none'}`}
              style={entry.value ? ({ '--fc': entry.value } as React.CSSProperties) : undefined}
              onClick={() => data.onColor(entry.id)}
            />
          ))}
        </span>
        <i className="lb-an-sep" aria-hidden />
        <button type="button" onClick={data.onRemove} title="Çerçeveyi kaldır: içindeki düğümler yerinde kalır">
          <Ungroup aria-hidden />
          Çerçeveyi kaldır
        </button>
      </NodeToolbar>
    </div>
  )
}

/** A frame's name, edited in place: Enter or a click away keeps it (trimmed), Escape leaves it as it was. */
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
        <GrowField value={data.text} onText={data.onText} placeholder="Not yaz…" label="Not" />
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

// ---- free text ------------------------------------------------------------------------------------------------

/** A heading or a line of description, straight on the canvas: it drags from anywhere until selected, then it is written in. */
export function LabelNodeView({ data, selected }: NodeProps<LabelNode>) {
  const placeholder = data.size === 'title' ? 'Başlık yaz…' : 'Açıklama yaz…'
  return (
    <div className={`lb-an-label ${data.size}${selected ? ' selected' : ''}`}>
      {selected ? (
        <GrowField value={data.text} onText={data.onText} placeholder={placeholder} label="Yazı" />
      ) : (
        <div className="lb-an-note-field" data-value={data.text}>
          <p className={data.text ? undefined : 'empty'}>{data.text || placeholder}</p>
        </div>
      )}
      <NodeToolbar position={Position.Top} offset={10} align="start" className="lb-cv-bar">
        {(['title', 'body'] as const).map((size) => (
          <button key={size} type="button" className={size === data.size ? 'on' : ''} aria-pressed={size === data.size} onClick={() => data.onSize(size)}>
            {size === 'title' ? <Type aria-hidden /> : null}
            {size === 'title' ? 'Başlık' : 'Metin'}
          </button>
        ))}
        <i className="lb-an-sep" aria-hidden />
        <button type="button" className="lb-an-icon" onClick={data.onRemove} title="Yazıyı sil" aria-label="Yazıyı sil">
          <Trash2 aria-hidden />
        </button>
      </NodeToolbar>
    </div>
  )
}

/**
 * A selected note's (or free text's) words as a field that grows with them (a hidden copy of the text sizes it where
 * `field-sizing` is missing). It keeps what was typed when it is left; Escape leaves it too. A brand-new, empty one
 * takes the caret.
 */
function GrowField({ value, onText, placeholder, label }: { value: string; onText: (text: string) => void; placeholder: string; label: string }) {
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
        placeholder={placeholder}
        aria-label={label}
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
