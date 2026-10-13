'use client'

import * as React from 'react'

import { Icon } from '../tools/studio-parts'

/**
 * A text the user may rewrite. It reads as plain text; a small pencil shows when its row is pointed at or it has
 * the focus, and only a click on it turns the text into a field: a proper box, Enter keeps, Esc leaves it as it
 * was. Nothing becomes a box by being clicked on.
 */
export function EditableText({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (text: string) => void
  /** What is being edited, for the pencil's and the field's name. */
  label: string
  placeholder?: string
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const left = React.useRef(false)

  if (draft === null) {
    return (
      <span className="lb-edit">
        <span className={value ? undefined : 'muted'}>{value || placeholder}</span>
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
    <span className="lb-field">
      <textarea
        autoFocus
        rows={1}
        value={draft}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
        onBlur={keep}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            keep()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            left.current = true
            setDraft(null)
          }
        }}
      />
      <small>Enter kaydeder · Esc vazgeçer</small>
    </span>
  )
}
