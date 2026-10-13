/**
 * P03-01 menu triggers of the shared composer. A trigger only opens a menu; it never executes and never turns text
 * into a command by itself. Only an explicit menu selection creates a typed chip.
 *
 * - Slash: the first scope is one leading command, so `/` opens the menu only as the first non-space character of
 *   the message. URLs (`https://a/b`), paths (`/usr/bin`), `//`, fractions (`1/2`), a slash inside a word and
 *   anything inside inline code or a code fence stay plain text.
 * - Mention: `@` at the start of a word (not an e-mail address, not inside code).
 */

export type ComposerTriggerKind = 'slash' | 'mention'

export type ComposerTrigger = {
  kind: ComposerTriggerKind
  /** Text typed after the trigger character (the menu search). */
  query: string
  /** Replace range of the trigger token (`/query` or `@query`) in the text. */
  start: number
  end: number
}

const MAX_QUERY_LENGTH = 40
const SLASH_TOKEN = /^\/([^\s/\\`@]*)$/u
const MENTION_TOKEN = /^@([^\s@`/\\]*)$/u
const MENTION_BOUNDARY = /[\s([{"'“‘]/u

export function detectComposerTrigger(text: string, caret: number): ComposerTrigger | null {
  const position = Math.max(0, Math.min(caret, text.length))
  const before = text.slice(0, position)
  if (isInsideCode(before)) return null
  const rest = /^[^\s]*/u.exec(text.slice(position))?.[0] ?? ''
  return detectSlash(before, position, rest) ?? detectMention(before, position, rest)
}

function detectSlash(before: string, caret: number, rest: string): ComposerTrigger | null {
  const leadingSpace = /^\s*/u.exec(before)?.[0].length ?? 0
  const token = before.slice(leadingSpace)
  if (!token.startsWith('/') || token.startsWith('//')) return null
  const match = SLASH_TOKEN.exec(token)
  if (!match) return null
  // The token continues after the caret: a second slash or a mention makes it a path/URL, not a command.
  if (/[/\\@`]/u.test(rest)) return null
  const query = `${match[1] ?? ''}${rest}`
  if (query.length > MAX_QUERY_LENGTH) return null
  return { kind: 'slash', query, start: leadingSpace, end: caret + rest.length }
}

function detectMention(before: string, caret: number, rest: string): ComposerTrigger | null {
  const at = before.lastIndexOf('@')
  if (at < 0) return null
  if (at > 0 && !MENTION_BOUNDARY.test(before[at - 1] ?? '')) return null
  const match = MENTION_TOKEN.exec(before.slice(at))
  if (!match) return null
  if (/[@/\\`]/u.test(rest)) return null
  const query = `${match[1] ?? ''}${rest}`
  if (query.length > MAX_QUERY_LENGTH) return null
  return { kind: 'mention', query, start: at, end: caret + rest.length }
}

/** True when the caret sits inside a fenced code block or an inline code span. */
export function isInsideCode(before: string): boolean {
  const fences = before.split('```').length - 1
  if (fences % 2 === 1) return true
  const withoutFences = before.split('```').filter((_, index) => index % 2 === 0).join('')
  const ticks = (withoutFences.match(/`/gu) ?? []).length
  return ticks % 2 === 1
}

/** Removes the trigger token from the text; the caret lands where the token started. */
export function removeTriggerText(text: string, trigger: ComposerTrigger): { text: string; caret: number } {
  const head = text.slice(0, trigger.start)
  let tail = text.slice(trigger.end)
  if (head.length === 0 || /\s$/u.test(head)) tail = tail.replace(/^ /u, '')
  return { text: `${head}${tail}`, caret: head.length }
}
