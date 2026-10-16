'use client'

import * as React from 'react'

import { Icon } from '../tools/studio-parts'
import './lab-notes.css'

/**
 * A text the user may rewrite, in place. It reads as plain text; a click on it (or on the pencil that shows when its
 * row is pointed at) makes the text itself editable where it stands: same size, same lines, growing with what is
 * typed, no box around it. Enter keeps, Shift+Enter breaks the line, Esc leaves it as it was, a click elsewhere keeps.
 * `startEditing` opens it already editing (a scene just added); `onEnter` hears that Enter kept the text.
 */
export function EditableText({
  value,
  onChange,
  label,
  placeholder,
  startEditing = false,
  onEnter,
}: {
  value: string
  onChange: (text: string) => void
  /** What is being edited, for the pencil's and the field's name. */
  label: string
  placeholder?: string
  startEditing?: boolean
  onEnter?: () => void
}) {
  const [draft, setDraft] = React.useState<string | null>(startEditing ? value : null)
  const area = React.useRef<HTMLTextAreaElement>(null)
  const left = React.useRef(false)

  // The field is as tall as its text, on every browser.
  React.useLayoutEffect(() => {
    const field = area.current
    if (!field) return
    field.style.height = '0px'
    field.style.height = `${field.scrollHeight}px`
  }, [draft])

  if (draft === null) {
    return (
      <span className="lb-edit">
        <span className={`lb-edit-text${value ? '' : ' muted'}`} onClick={() => setDraft(value)}>{value || placeholder}</span>
        <button type="button" className="lb-edit-btn" onClick={() => setDraft(value)} aria-label={`${label}: düzenle`} title="Düzenle">
          <Icon name="edit" size="sm" />
        </button>
      </span>
    )
  }

  const keep = () => {
    // Esc already closed the field; the blur that follows must not keep what was typed.
    if (left.current) {
      left.current = false
      return
    }
    const next = draft.trim()
    if (next !== value) onChange(next)
    setDraft(null)
  }

  return (
    <textarea
      ref={area}
      className="lb-edit-area"
      autoFocus
      rows={1}
      value={draft}
      aria-label={label}
      placeholder={placeholder}
      title="Enter kaydeder · Esc vazgeçer"
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
      onBlur={keep}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          keep()
          onEnter?.()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          left.current = true
          setDraft(null)
        }
      }}
    />
  )
}
