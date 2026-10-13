'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getSafeAssetHref } from '@/lib/markdown/safe-asset-href'
import { useTranslations } from 'next-intl'

type ChatMarkdownVariant = 'assistant' | 'user'

type ChatMarkdownProps = {
  content: string
  streaming?: boolean
  variant?: ChatMarkdownVariant
}

export function ChatMarkdown({
  content,
  streaming = false,
  variant = 'assistant',
}: ChatMarkdownProps) {
  const blocks = React.useMemo(
    () => renderMarkdownBlocks(prepareMarkdownContent(content, streaming), streaming),
    [content, streaming],
  )

  return (
    <div
      className={cn(
        'chat-markdown min-w-0 text-[16px] leading-7',
        variant === 'assistant' ? 'text-foreground dark:text-white' : 'text-inherit',
      )}
    >
      {blocks}
    </div>
  )
}

function prepareMarkdownContent(content: string, streaming: boolean) {
  const normalized = content.replace(/\r\n?/g, '\n')
  if (!streaming) return normalized

  const parts = normalized.split(/(```[\s\S]*?(?:```|$))/g)
  return parts.map((part) => part.startsWith('```') ? part : repairStreamingText(part)).join('')
}

function repairStreamingText(text: string) {
  return text
    .replace(/([^\n#])(\s*#{1,6}\s+)/g, '$1\n\n$2')
    .replace(/(\*\*[^*\n]+?\*\*)(?=[\p{L}\p{N}])/gu, '$1 ')
    .replace(/([:;!?])(?=[^\s*])/gu, '$1 ')
    .replace(/([\p{L}\p{N}])\(/gu, '$1 (')
    .replace(/([\p{L}])(?=\d[\p{L}])/gu, '$1 ')
    .replace(/(\d)(?=\p{Lu})/gu, '$1 ')
    .replace(/(\d)(?=(?:dk|sn|saniye|dakika)\b)/giu, '$1 ')
    .replace(/([\p{Ll}])(?=\p{Lu})/gu, '$1 ')
    .replace(/([)\]*:])-(?=\*\*|[\p{L}\p{N}])/gu, '$1\n- ')
    .replace(/([\p{Ll}\p{N}])-(?=\p{Lu})/gu, '$1\n- ')
    .replace(/([^\n])---(?=\S)/g, '$1\n\n---\n\n')
    .replace(/\|{2,}(?=\s*\d+\s*\|)/g, '|\n| ')
    .replace(/^\s*\|\s*$\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
}

function renderMarkdownBlocks(content: string, streaming: boolean) {
  const nodes: React.ReactNode[] = []
  const fencePattern = /```([A-Za-z0-9_-]*)[ \t]*\n?([\s\S]*?)(?:```|$)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(content)) !== null) {
    if (match.index > cursor) {
      nodes.push(...renderTextBlocks(content.slice(cursor, match.index), nodes.length, streaming))
    }
    nodes.push(renderCodeBlock(match[2] ?? '', match[1] ?? '', nodes.length))
    cursor = match.index + match[0].length
  }

  if (cursor < content.length) {
    nodes.push(...renderTextBlocks(content.slice(cursor), nodes.length, streaming))
  }

  return nodes.length ? nodes : null
}

function renderTextBlocks(text: string, offset: number, streaming: boolean) {
  const nodes: React.ReactNode[] = []
  const lines = text.replace(/\n{3,}/g, '\n\n').split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (!trimmed || isBlankTablePlaceholder(trimmed)) {
      index += 1
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (heading) {
      const level = Math.min(heading[1].length, 4)
      const HeadingTag = level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
      nodes.push(
        <HeadingTag
          key={`heading-${offset}-${index}`}
          className={cn(
            'mb-2 mt-4 font-semibold leading-snug first:mt-0',
            level === 1 && 'text-xl',
            level === 2 && 'text-lg',
            level >= 3 && 'text-base',
          )}
        >
          {renderInline(heading[2], `heading-${offset}-${index}`)}
        </HeadingTag>,
      )
      index += 1
      continue
    }

    if (isHorizontalRule(trimmed)) {
      nodes.push(<hr key={`hr-${offset}-${index}`} className="my-4 border-border dark:border-white/12" />)
      index += 1
      continue
    }

    if (isTableStart(lines, index, streaming)) {
      const table = readTable(lines, index)
      nodes.push(renderTable(table.rows, offset, index))
      index = table.nextIndex
      continue
    }

    if (isListLine(trimmed)) {
      const list = readList(lines, index)
      nodes.push(renderList(list.items, list.ordered, offset, index))
      index = list.nextIndex
      continue
    }

    if (trimmed.startsWith('>')) {
      const quote = readBlockquote(lines, index)
      nodes.push(
        <blockquote key={`quote-${offset}-${index}`} className="my-3 border-l-2 border-primary/30 pl-4 text-muted-foreground dark:border-white/20 dark:text-white/70">
          {renderInlineWithBreaks(quote.text, `quote-${offset}-${index}`)}
        </blockquote>,
      )
      index = quote.nextIndex
      continue
    }

    const paragraph = readParagraph(lines, index, streaming)
    nodes.push(
      <p key={`p-${offset}-${index}`} className="my-3 first:mt-0 last:mb-0">
        {renderInlineWithBreaks(paragraph.text, `p-${offset}-${index}`)}
      </p>,
    )
    index = paragraph.nextIndex
  }

  return nodes
}

function renderCodeBlock(code: string, language: string, key: number) {
  return <CodeBlock key={`code-${key}`} code={code} language={language} />
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const tAuto = useTranslations('Auto')
  const [copied, setCopied] = React.useState(false)
  const label = language.trim() || 'Text'
  const highlighted = React.useMemo(() => {
    const lines = (code || ' ').replace(/\n$/, '').split('\n')
    return lines.map((line, index) => (
      <React.Fragment key={`line-${index}`}>
        {highlightCodeLine(line, `${label}-${index}`)}
        {index < lines.length - 1 ? '\n' : null}
      </React.Fragment>
    ))
  }, [code, label])

  async function copyCode() {
    await navigator.clipboard?.writeText(code).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="my-4 overflow-hidden rounded-[18px] border border-border bg-muted/55 shadow-[0_14px_36px_rgba(15,23,42,0.08)] dark:border-[#2b2b2b] dark:bg-[#191919] dark:shadow-[0_18px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex h-12 items-center justify-between border-b border-border/80 px-4 dark:border-white/8">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[13px] font-semibold text-foreground dark:text-white/92">&lt;/&gt;</span>
          <span className="truncate text-sm font-semibold text-foreground dark:text-white">{label}</span>
        </div>
        <button
          type="button"
          aria-label={tAuto('copy_code_6c106927')}
          title={tAuto('copy_code_6c106927')}
          onClick={() => void copyCode()}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-white/72 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/25"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[14px] leading-6 text-foreground dark:text-white/88">
        <code>{highlighted}</code>
      </pre>
    </div>
  )
}

function highlightCodeLine(line: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = []
  const tokenPattern = /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:async|await|break|case|catch|class|const|continue|default|else|export|false|finally|for|from|function|if|import|in|interface|let|null|return|switch|true|try|type|undefined|while)\b|\b\d+(?:\.\d+)?\b|[{}()[\].,:;])/g
  let cursor = 0
  let tokenIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(line)) !== null) {
    if (match.index > cursor) nodes.push(line.slice(cursor, match.index))
    const token = match[0]
    nodes.push(
      <span key={`${keyPrefix}-${tokenIndex}`} className={getCodeTokenClass(token)}>
        {token}
      </span>,
    )
    cursor = match.index + token.length
    tokenIndex += 1
  }

  if (cursor < line.length) nodes.push(line.slice(cursor))
  return nodes.length ? nodes : ' '
}

function getCodeTokenClass(token: string) {
  if (token.startsWith('//') || token.startsWith('/*')) return 'text-emerald-700 dark:text-[#7aa06f]'
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) return 'text-green-700 dark:text-[#7ee787]'
  if (/^\d/.test(token)) return 'text-purple-700 dark:text-[#d2a8ff]'
  if (/^[{}()[\].,:;]$/.test(token)) return 'text-muted-foreground dark:text-white/52'
  return 'text-red-700 dark:text-[#ff8a80]'
}

function renderTable(rows: string[][], offset: number, index: number) {
  const [head = [], ...body] = normalizeTableRows(rows)
  return (
    <div key={`table-${offset}-${index}`} className="my-4 overflow-x-auto rounded-[14px] border border-border bg-card dark:border-white/12 dark:bg-[#151515]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[15px] leading-6">
        <thead className="bg-muted text-foreground dark:bg-white/[0.075] dark:text-white/84">
          <tr>
            {head.map((cell, cellIndex) => (
              <th key={`head-${cellIndex}`} className="border-b border-border px-3.5 py-2.5 font-semibold dark:border-white/10">
                {renderInline(cell, `table-head-${offset}-${index}-${cellIndex}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="animate-in border-t border-border/70 fade-in slide-in-from-bottom-1 duration-200 dark:border-white/8">
              {row.map((cell, cellIndex) => (
                <td key={`cell-${cellIndex}`} className="px-3.5 py-2.5 align-top text-foreground/80 dark:text-white/76">
                  {renderInline(cell, `table-cell-${offset}-${index}-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderList(items: string[], ordered: boolean, offset: number, index: number) {
  const ListTag = ordered ? 'ol' : 'ul'
  return (
    <ListTag
      key={`list-${offset}-${index}`}
      className={cn(
        'my-3 space-y-1.5 pl-6',
        ordered ? 'list-decimal' : 'list-disc',
      )}
    >
      {items.map((item, itemIndex) => (
        <li key={`item-${itemIndex}`} className="pl-1">
          {renderInlineWithBreaks(item, `list-${offset}-${index}-${itemIndex}`)}
        </li>
      ))}
    </ListTag>
  )
}

function renderInlineWithBreaks(text: string, keyPrefix: string) {
  const lines = text.split('\n')
  return lines.flatMap((line, index) => {
    const rendered = renderInline(line, `${keyPrefix}-${index}`)
    if (index === lines.length - 1) return rendered
    return [...rendered, <br key={`${keyPrefix}-br-${index}`} />]
  })
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const tokenPattern = /(!\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|<u>([\s\S]*?)<\/u>|\+\+([\s\S]+?)\+\+|\[([^\]]+)\]\(([^)]+)\)|\*([^*\n]+)\*)/gi
  let cursor = 0
  let tokenIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))

    const key = `${keyPrefix}-inline-${tokenIndex}`
    if (match[2] !== undefined) {
      const src = getSafeAssetHref(match[3] ?? '')
      nodes.push(src ? (
        <span key={key} className="my-3 block overflow-hidden rounded-lg border border-border bg-muted/30 dark:border-white/12 dark:bg-white/[0.03]">
          <img
            src={src}
            alt={match[2] || 'Generated image'}
            loading="lazy"
            className="max-h-[560px] w-full object-contain"
          />
        </span>
      ) : (
        <span
          key={key}
          role="note"
          className="my-3 block rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-sm text-muted-foreground"
          title="External image blocked"
        >
          Image not loaded: {match[2] || 'untrusted external image'}
        </span>
      ))
    } else if (match[4] !== undefined) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground dark:bg-white/10 dark:text-white/86">
          {match[4]}
        </code>,
      )
    } else if (match[5] !== undefined) {
      nodes.push(<strong key={key} className="font-semibold text-inherit">{renderInline(match[5], key)}</strong>)
    } else if (match[6] !== undefined || match[7] !== undefined) {
      nodes.push(<u key={key} className="underline underline-offset-4">{renderInline(match[6] ?? match[7] ?? '', key)}</u>)
    } else if (match[8] !== undefined && match[9] !== undefined) {
      const href = getSafeHref(match[9])
      nodes.push(href ? (
        <a
          key={key}
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noreferrer' : undefined}
          className="font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary/70 dark:text-white dark:decoration-white/35 dark:hover:decoration-white/70"
        >
          {renderInline(match[8], key)}
        </a>
      ) : match[8])
    } else if (match[10] !== undefined) {
      nodes.push(<em key={key} className="italic">{renderInline(match[10], key)}</em>)
    }

    cursor = match.index + match[0].length
    tokenIndex += 1
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function readParagraph(lines: string[], startIndex: number, streaming: boolean) {
  const parts: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const current = lines[index] ?? ''
    const trimmed = current.trim()
    if (!trimmed) break
    if (index !== startIndex && startsBlock(lines, index, streaming)) break
    parts.push(trimmed)
    index += 1
  }

  return { text: parts.join('\n'), nextIndex: index }
}

function readList(lines: string[], startIndex: number) {
  const items: string[] = []
  const first = (lines[startIndex] ?? '').trim()
  const ordered = /^\d+[.)]\s+/.test(first)
  let index = startIndex

  while (index < lines.length) {
    const current = (lines[index] ?? '').trim()
    if (!isListLine(current)) break
    if (/^\d+[.)]\s+/.test(current) !== ordered) break
    items.push(current.replace(ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/, ''))
    index += 1
  }

  return { items, ordered, nextIndex: index }
}

function readBlockquote(lines: string[], startIndex: number) {
  const parts: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const current = (lines[index] ?? '').trim()
    if (!current.startsWith('>')) break
    parts.push(current.replace(/^>\s?/, ''))
    index += 1
  }

  return { text: parts.join('\n'), nextIndex: index }
}

function readTable(lines: string[], startIndex: number) {
  const rows: string[][] = []
  let index = startIndex

  while (index < lines.length) {
    const current = (lines[index] ?? '').trim()
    if (!current || isBlankTablePlaceholder(current)) {
      const nextIndex = findNextTableContentLine(lines, index + 1)
      const next = nextIndex === -1 ? '' : (lines[nextIndex] ?? '').trim()
      if (next && (isTableRowLine(next) || isTableSeparator(next))) {
        index = nextIndex
        continue
      }
      break
    }
    if (!isTableRowLine(current) && !isTableSeparator(current)) break
    if (isTableRowLine(current) && !isTableSeparator(current)) {
      rows.push(splitTableRow(current))
    }
    index += 1
  }

  return { rows, nextIndex: index }
}

function normalizeTableRows(rows: string[][]) {
  const visibleRows = rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean))
  if (visibleRows.length === 0) return [['']]

  const header = visibleRows[0] ?? []
  const columnCount = Math.max(2, header.length, ...visibleRows.slice(1).map((row) => Math.min(row.length, header.length || row.length)))
  const normalized = [fitTableRow(header, columnCount)]

  for (const row of visibleRows.slice(1)) {
    if (row.length <= columnCount) {
      normalized.push(fitTableRow(row, columnCount))
      continue
    }

    for (let index = 0; index < row.length; index += columnCount) {
      normalized.push(fitTableRow(row.slice(index, index + columnCount), columnCount))
    }
  }

  return normalized
}

function fitTableRow(row: string[], columnCount: number) {
  return Array.from({ length: columnCount }, (_, index) => row[index] ?? '')
}

function splitTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function startsBlock(lines: string[], index: number, streaming: boolean) {
  const current = (lines[index] ?? '').trim()
  return Boolean(
    /^(#{1,4})\s+/.test(current)
    || isHorizontalRule(current)
    || isListLine(current)
    || current.startsWith('>')
    || isTableStart(lines, index, streaming)
  )
}

function isListLine(line: string) {
  return /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)
}

function isHorizontalRule(line: string) {
  return /^-{3,}$/.test(line) || /^\*{3,}$/.test(line)
}

function isTableStart(lines: string[], index: number, streaming: boolean) {
  const current = lines[index]?.trim() ?? ''
  const nextIndex = findNextTableContentLine(lines, index + 1)
  const next = nextIndex === -1 ? '' : lines[nextIndex]?.trim() ?? ''
  if (!isTableRowLine(current)) return false
  return streaming || isTableSeparator(next) || isTableRowLine(next)
}

function isTableRowLine(line: string) {
  if (!line.startsWith('|')) return false
  return splitTableRow(line).filter(Boolean).length >= 2
}

function isTableSeparator(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)
}

function isBlankTablePlaceholder(line: string) {
  return /^\|\s*$/.test(line)
}

function findNextTableContentLine(lines: string[], startIndex: number) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim()
    if (line && !isBlankTablePlaceholder(line)) return index
  }
  return -1
}

function getSafeHref(value: string) {
  const href = value.trim()
  if (href.startsWith('/') && !href.startsWith('//')) return href
  if (/^https?:\/\//i.test(href)) return href
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) return href
  return null
}

export const __chatMarkdownTestHooks = { getSafeAssetHref }
