'use client'

// The Markdown editor of the skill popup: a quiet toolbar, the text, and a rendered preview. It has no frame of its
// own (the popup is the frame) and takes the height its column leaves. Toolbar edits go through the browser's own
// text editing, so undo and redo keep working.

import * as React from 'react'
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, TextQuote, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { GuideMarkdownPreview } from '@/components/workflows/guide-markdown'
import { cn } from '@/lib/utils'

import { Segmented } from './memory-list'

type Mode = 'write' | 'preview'
type Tool = 'heading' | 'bold' | 'italic' | 'bullets' | 'numbers' | 'quote' | 'code' | 'link'

const TOOLS: Array<{ id: Tool; icon: LucideIcon; shortcut?: string; gap?: boolean }> = [
  { id: 'heading', icon: Heading2 },
  { id: 'bold', icon: Bold, shortcut: 'B' },
  { id: 'italic', icon: Italic, shortcut: 'I' },
  { id: 'bullets', icon: List, gap: true },
  { id: 'numbers', icon: ListOrdered },
  { id: 'quote', icon: TextQuote },
  { id: 'code', icon: Code, gap: true },
  { id: 'link', icon: Link2, shortcut: 'K' },
]

const LINE_MARK = /^(#{1,6}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/
const LINE_MARKS: Record<'heading' | 'bullets' | 'numbers' | 'quote', RegExp> = {
  heading: /^#{1,6}\s+/,
  bullets: /^[-*]\s+/,
  numbers: /^\d+[.)]\s+/,
  quote: /^>\s?/,
}

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
  readOnly = false,
  busy = false,
  autoFocus = false,
  actions,
  textareaRef,
  className,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  /** Read-only shows the rendered text only: no toolbar, no source. */
  readOnly?: boolean
  /** Someone else is writing into the text (AI): it shows, but cannot be edited meanwhile. */
  busy?: boolean
  autoFocus?: boolean
  /** At the end of the toolbar, after the write/preview switch. */
  actions?: React.ReactNode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  className?: string
}) {
  const t = useTranslations('MemoryPage.skillEditor')
  const [mode, setMode] = React.useState<Mode>('write')
  const ownRef = React.useRef<HTMLTextAreaElement>(null)
  const field = textareaRef ?? ownRef
  const preview = readOnly || mode === 'preview'

  const run = (tool: Tool) => {
    const textarea = field.current
    if (!textarea) return
    if (tool === 'bold') wrapSelection(textarea, '**', t('sample.bold'))
    else if (tool === 'italic') wrapSelection(textarea, '*', t('sample.italic'))
    else if (tool === 'code') wrapSelection(textarea, '`', t('sample.code'))
    else if (tool === 'link') insertLink(textarea, t('sample.link'))
    else markLines(textarea, tool)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (busy) return
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      const tool = TOOLS.find((entry) => entry.shortcut?.toLowerCase() === event.key.toLowerCase())
      if (!tool) return
      event.preventDefault()
      run(tool.id)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.nativeEvent.isComposing && continueList(event.currentTarget)) {
      event.preventDefault()
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col border-t border-border', className)}>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-3 py-1.5">
          <div role="toolbar" aria-label={t('toolbar')} className={cn('flex flex-wrap items-center gap-0.5', (preview || busy) && 'pointer-events-none opacity-40')}>
            {TOOLS.map((tool) => {
              const name = t(`tool.${tool.id}`)
              const title = tool.shortcut ? `${name} (Ctrl+${tool.shortcut})` : name
              return (
                <button
                  key={tool.id}
                  type="button"
                  // The text keeps its selection: the button must not take the focus.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => run(tool.id)}
                  disabled={preview || busy}
                  aria-label={name}
                  title={title}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    tool.gap && 'ml-1.5',
                  )}
                >
                  <tool.icon className="size-4" />
                </button>
              )
            })}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[{ value: 'write', label: t('mode.write') }, { value: 'preview', label: t('mode.preview') }]}
            />
            {actions}
          </div>
        </div>
      )}

      {preview ? (
        <div className="hg-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {value.trim()
            ? <GuideMarkdownPreview content={value} className="text-sm leading-6" />
            : <p className="text-sm text-muted-foreground">{t('previewEmpty')}</p>}
        </div>
      ) : (
        <textarea
          ref={field}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          readOnly={busy}
          spellCheck={false}
          rows={12}
          aria-label={label}
          placeholder={placeholder}
          className="hg-scrollbar block min-h-0 w-full flex-1 resize-none bg-transparent px-5 py-4 font-mono text-[13px] leading-6 text-foreground outline-none placeholder:text-muted-foreground/60"
        />
      )}
    </div>
  )
}

/** Replaces `start…end` as a typed edit (one undo step), then selects `select`. */
function edit(textarea: HTMLTextAreaElement, start: number, end: number, text: string, select: [number, number]) {
  textarea.focus()
  textarea.setSelectionRange(start, end)
  const typed = text ? document.execCommand('insertText', false, text) : start === end || document.execCommand('delete')
  if (!typed) {
    textarea.setRangeText(text, start, end, 'end')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }
  textarea.setSelectionRange(select[0], select[1])
}

/** Bold, italic, code: wraps the selection (or a sample word), and unwraps a selection that is already wrapped. */
function wrapSelection(textarea: HTMLTextAreaElement, mark: string, sample: string) {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end)
  const before = value.slice(Math.max(0, start - mark.length), start)
  const after = value.slice(end, end + mark.length)
  // `*` next to `**` is the bold mark, not an italic one.
  const partOfBold = mark === '*' && (value.slice(Math.max(0, start - 2), start) === '**' || value.slice(end, end + 2) === '**')
  if (selected && before === mark && after === mark && !partOfBold) {
    edit(textarea, start - mark.length, end + mark.length, selected, [start - mark.length, end - mark.length])
    return
  }
  const inner = selected || sample
  edit(textarea, start, end, `${mark}${inner}${mark}`, [start + mark.length, start + mark.length + inner.length])
}

function insertLink(textarea: HTMLTextAreaElement, sample: string) {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end)
  if (/^https?:\/\/\S+$/.test(selected)) {
    edit(textarea, start, end, `[${sample}](${selected})`, [start + 1, start + 1 + sample.length])
    return
  }
  const text = selected || sample
  const address = 'https://'
  const at = start + text.length + 3
  edit(textarea, start, end, `[${text}](${address})`, [at, at + address.length])
}

/** Heading, lists, quote: marks the selected lines, or takes the mark off when they all have it. */
function markLines(textarea: HTMLTextAreaElement, kind: keyof typeof LINE_MARKS) {
  const { selectionStart, selectionEnd, value } = textarea
  const from = value.lastIndexOf('\n', selectionStart - 1) + 1
  // A selection that ends at the start of a line does not include that line.
  const last = selectionEnd > selectionStart && value[selectionEnd - 1] === '\n' ? selectionEnd - 1 : selectionEnd
  const next = value.indexOf('\n', last)
  const to = next === -1 ? value.length : next
  const lines = value.slice(from, to).split('\n')
  const written = lines.filter((line) => line.trim())
  const marked = written.length > 0 && written.every((line) => LINE_MARKS[kind].test(line))
  let number = 0
  const result = lines.map((line) => {
    if (marked) return line.replace(LINE_MARKS[kind], '')
    if (!line.trim() && lines.length > 1) return line
    const text = line.replace(LINE_MARK, '')
    if (kind === 'heading') return `## ${text}`
    if (kind === 'bullets') return `- ${text}`
    if (kind === 'quote') return `> ${text}`
    number += 1
    return `${number}. ${text}`
  }).join('\n')

  const caret = Math.max(from, selectionStart + result.length - (to - from))
  edit(textarea, from, to, result, selectionStart === selectionEnd ? [caret, caret] : [from, from + result.length])
}

/** Enter in a list item starts the next one; Enter in an empty item ends the list. Returns whether it handled it. */
function continueList(textarea: HTMLTextAreaElement) {
  const { selectionStart: caret, selectionEnd, value } = textarea
  if (caret !== selectionEnd) return false
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1
  const item = /^(\s*)(?:([-*])|(\d+)([.)]))(\s+)(.*)$/.exec(value.slice(lineStart, caret))
  if (!item) return false
  const [, indent, bullet, number, close, space, text] = item
  const lineEnd = value.indexOf('\n', caret)
  const rest = value.slice(caret, lineEnd === -1 ? value.length : lineEnd)
  if (!text.trim() && !rest.trim()) {
    edit(textarea, lineStart, caret, '', [lineStart, lineStart])
    return true
  }
  const mark = bullet ?? `${Number(number) + 1}${close}`
  const inserted = `\n${indent}${mark}${space}`
  edit(textarea, caret, caret, inserted, [caret + inserted.length, caret + inserted.length])
  return true
}
