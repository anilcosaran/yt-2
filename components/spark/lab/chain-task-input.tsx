'use client'

import * as React from 'react'

import { PromptBoxInput } from '../agent/prompt-box'
import { STAGE_KIND, type StageKind } from './lab-chain'
import { Icon } from './lab-parts'
import './chain-task.css'

/** A node an @ can name: its id, its name on the canvas and its kind (for its mark). */
export type MentionOption = { id: string; name: string; kind?: StageKind }

const MAX_SHOWN = 6

/**
 * A Görev's field: the shared prompt box field, where "@" lists the canvas's nodes, narrowed as a name is typed after it.
 * One picked goes into the words as "@Görsel 2 " and is linked in (`onMention`). Up and down move through the list,
 * Enter or Tab picks, Escape closes it; a press on a row picks it without taking the caret from the field.
 */
export function MentionInput({
  value,
  options,
  onChange,
  onMention,
  onSend,
  onBlur,
  ...field
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  options: MentionOption[]
  onChange: (value: string) => void
  onMention: (id: string) => void
  onSend: () => void
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  // The "@" being typed: where it is in the words and what follows it up to the caret.
  const [query, setQuery] = React.useState<{ at: number; text: string } | null>(null)
  const [index, setIndex] = React.useState(0)
  const shown = query
    ? options.filter((option) => option.name.toLocaleLowerCase('tr').includes(query.text.toLocaleLowerCase('tr'))).slice(0, MAX_SHOWN)
    : []

  /** Opens the list when the caret is just past an "@" and what is typed after it (a name may hold spaces). */
  const look = (text: string, caret: number) => {
    const match = /(?:^|\s)@([^@\n]{0,24})$/.exec(text.slice(0, caret))
    if (!match) return setQuery(null)
    setQuery({ at: caret - match[1]!.length - 1, text: match[1]! })
    setIndex(0)
  }
  const pick = (option: MentionOption) => {
    if (!query) return
    const caret = ref.current?.selectionStart ?? value.length
    const token = `@${option.name} `
    const next = `${value.slice(0, query.at)}${token}${value.slice(caret)}`
    onChange(next)
    onMention(option.id)
    setQuery(null)
    const place = query.at + token.length
    window.requestAnimationFrame(() => ref.current?.setSelectionRange(place, place))
  }

  return (
    <div className="lb-tk-field">
      {shown.length ? (
        <div className="lb-tk-at nodrag nowheel" role="listbox" aria-label="Düğümler">
          {shown.map((option, at) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={at === index}
              className={at === index ? 'on' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
            >
              {option.kind ? <span className={`lb-cv-glyph k-${option.kind}`}><Icon name={STAGE_KIND[option.kind].icon} size="sm" /></span> : null}
              <span>{option.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <PromptBoxInput
        {...field}
        ref={ref}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          look(event.target.value, event.target.selectionStart)
        }}
        onSelect={(event) => look(event.currentTarget.value, event.currentTarget.selectionStart)}
        onBlur={(event) => {
          setQuery(null)
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          if (!shown.length) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setIndex((index + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length)
          } else if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            pick(shown[index] ?? shown[0]!)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setQuery(null)
          }
        }}
        onSend={onSend}
      />
    </div>
  )
}
