'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { getSafeAssetHref } from '@/lib/markdown/safe-asset-href'
import { UiText } from '@/components/i18n/ui-text'

type GuideMarkdownPreviewProps = {
  content: string
  className?: string
}

export function GuideMarkdownPreview({ content, className }: GuideMarkdownPreviewProps) {
  const blocks = React.useMemo(() => renderMarkdownBlocks(normalizeMarkdownContent(content)), [content])

  return (
    <div className={cn('guide-markdown-preview min-w-0 text-[13px] leading-6 text-foreground', className)}>
      {blocks.length > 0 ? blocks : (
        <p className="m-0 text-[13px] leading-6 text-muted-foreground">
          <UiText id="no_guide_content_yet_2a2e85b6" /></p>
      )}
    </div>
  )
}

function normalizeMarkdownContent(content: string) {
  return content.replace(/\r\n?/g, '\n').trim()
}

function renderMarkdownBlocks(content: string) {
  const nodes: React.ReactNode[] = []
  const fencePattern = /```([A-Za-z0-9_-]*)[ \t]*\n?([\s\S]*?)(?:```|$)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(content)) !== null) {
    if (match.index > cursor) {
      nodes.push(...renderTextBlocks(content.slice(cursor, match.index), nodes.length))
    }
    nodes.push(renderCodeBlock(match[2] ?? '', match[1] ?? '', nodes.length))
    cursor = match.index + match[0].length
  }

  if (cursor < content.length) {
    nodes.push(...renderTextBlocks(content.slice(cursor), nodes.length))
  }

  return nodes
}

function renderTextBlocks(text: string, offset: number) {
  const nodes: React.ReactNode[] = []
  const lines = text.replace(/\n{3,}/g, '\n\n').split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (heading) {
      const level = Math.min(heading[1].length, 4)
      const HeadingTag = level === 1 ? 'h2' : level === 2 ? 'h3' : level === 3 ? 'h4' : 'h5'
      nodes.push(
        <HeadingTag
          key={`heading-${offset}-${index}`}
          className={cn(
            'mb-2 mt-4 font-semibold leading-snug tracking-normal first:mt-0',
            level === 1 && 'text-[18px]',
            level === 2 && 'text-[16px]',
            level >= 3 && 'text-[14px]',
          )}
        >
          {renderInline(heading[2], `heading-${offset}-${index}`)}
        </HeadingTag>,
      )
      index += 1
      continue
    }

    if (isHorizontalRule(trimmed)) {
      nodes.push(<hr key={`hr-${offset}-${index}`} className="my-4 border-border/80 dark:border-white/10" />)
      index += 1
      continue
    }

    if (isTableStart(lines, index)) {
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
        <blockquote
          key={`quote-${offset}-${index}`}
          className="my-3 border-l-2 border-primary/35 pl-3 text-muted-foreground dark:border-white/20 dark:text-white/70"
        >
          {renderInlineWithBreaks(quote.text, `quote-${offset}-${index}`)}
        </blockquote>,
      )
      index = quote.nextIndex
      continue
    }

    const paragraph = readParagraph(lines, index)
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
  const label = language.trim()

  return (
    <div
      key={`code-${key}`}
      className="my-4 overflow-hidden rounded-md border border-border/80 bg-muted/35 dark:border-white/10 dark:bg-white/[0.045]"
    >
      {label && (
        <div className="border-b border-border/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-normal text-muted-foreground dark:border-white/10">
          {label}
        </div>
      )}
      <pre className="youtorch-thin-scrollbar overflow-x-auto px-3 py-3 font-mono text-[12px] leading-5 text-foreground dark:text-white/88">
        <code>{code.replace(/\n$/, '') || ' '}</code>
      </pre>
    </div>
  )
}

function renderTable(rows: string[][], offset: number, index: number) {
  const [head = [], ...body] = normalizeTableRows(rows)

  return (
    <div
      key={`table-${offset}-${index}`}
      className="my-4 overflow-x-auto rounded-md border border-border/80 dark:border-white/10"
    >
      <table className="w-full min-w-[420px] border-collapse text-left text-[12px] leading-5">
        <thead className="bg-muted/60 text-foreground dark:bg-white/[0.07]">
          <tr>
            {head.map((cell, cellIndex) => (
              <th key={`head-${cellIndex}`} className="border-b border-border/80 px-3 py-2 font-semibold dark:border-white/10">
                {renderInline(cell, `table-head-${offset}-${index}-${cellIndex}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="border-t border-border/60 first:border-t-0 dark:border-white/8">
              {row.map((cell, cellIndex) => (
                <td key={`cell-${cellIndex}`} className="px-3 py-2 align-top text-foreground/80 dark:text-white/74">
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
      className={cn('my-3 space-y-1.5 pl-5', ordered ? 'list-decimal' : 'list-disc')}
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
  const tokenPattern = /(!\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)|\*([^*\n]+)\*)/g
  let cursor = 0
  let tokenIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))

    const key = `${keyPrefix}-inline-${tokenIndex}`
    if (match[2] !== undefined) {
      const src = getSafeAssetHref(match[3] ?? '')
      nodes.push(src ? (
        <span key={key} className="my-3 block overflow-hidden rounded-md border border-border/80 bg-muted/25 dark:border-white/10 dark:bg-white/[0.035]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={match[2] || 'Guide image'} loading="lazy" className="max-h-[420px] w-full object-contain" />
        </span>
      ) : match[0])
    } else if (match[4] !== undefined) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground dark:bg-white/10 dark:text-white/86">
          {match[4]}
        </code>,
      )
    } else if (match[5] !== undefined) {
      nodes.push(<strong key={key} className="font-semibold text-inherit">{renderInline(match[5], key)}</strong>)
    } else if (match[6] !== undefined && match[7] !== undefined) {
      const href = getSafeHref(match[7])
      nodes.push(href ? (
        <a
          key={key}
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noreferrer' : undefined}
          className="font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary/70 dark:text-white dark:decoration-white/35 dark:hover:decoration-white/70"
        >
          {renderInline(match[6], key)}
        </a>
      ) : match[6])
    } else if (match[8] !== undefined) {
      nodes.push(<em key={key} className="italic">{renderInline(match[8], key)}</em>)
    }

    cursor = match.index + match[0].length
    tokenIndex += 1
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function readParagraph(lines: string[], startIndex: number) {
  const parts: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const current = lines[index] ?? ''
    const trimmed = current.trim()
    if (!trimmed || (index !== startIndex && startsBlock(lines, index))) break
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
    items.push(current.replace(ordered ? /^\d+[.)]\s+/ : /^[-*+]\s+/, ''))
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
    if (!current || (!isTableRowLine(current) && !isTableSeparator(current))) break
    if (isTableRowLine(current) && !isTableSeparator(current)) rows.push(splitTableRow(current))
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
    normalized.push(fitTableRow(row, columnCount))
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

function startsBlock(lines: string[], index: number) {
  const current = (lines[index] ?? '').trim()
  return Boolean(
    /^(#{1,4})\s+/.test(current)
    || isHorizontalRule(current)
    || isListLine(current)
    || current.startsWith('>')
    || isTableStart(lines, index),
  )
}

function isListLine(line: string) {
  return /^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line)
}

function isHorizontalRule(line: string) {
  return /^-{3,}$/.test(line) || /^\*{3,}$/.test(line)
}

function isTableStart(lines: string[], index: number) {
  const current = lines[index]?.trim() ?? ''
  const next = lines[index + 1]?.trim() ?? ''
  return isTableRowLine(current) && (isTableSeparator(next) || isTableRowLine(next))
}

function isTableRowLine(line: string) {
  if (!line.startsWith('|')) return false
  return splitTableRow(line).filter(Boolean).length >= 2
}

function isTableSeparator(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)
}

function getSafeHref(value: string) {
  const href = value.trim()
  if (href.startsWith('/') && !href.startsWith('//')) return href
  if (/^https?:\/\//i.test(href)) return href
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) return href
  return null
}
