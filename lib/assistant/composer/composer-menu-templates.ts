import { insertMcpTemplateText, type McpTemplateConnection } from '@/lib/connectors/mcp-catalog-api'

import { normalizeMenuSearch, rankMatch } from './composer-menu'

/**
 * QA-172 (coordinator decision 2026-09-28) — the MCP prompts of the user's active MCP connections (P01C-26) as a
 * separate "Şablonlar" group of the `/` menu. A template is not a command and never a chip: choosing it inserts the
 * server-rendered text in place of the `/query` token (one undo step), after a small form when it has required
 * arguments. Nothing is sent automatically. The list is empty while `CONNECTOR_MCP_PROMPTS_RESOURCES_ENABLED` is off
 * (the server answers `feature: disabled`).
 */

export type ComposerTemplateArgument = { name: string; description: string | null; required: boolean }

/** What choosing a template item asks the host to do (render on the server, then insert as text). */
export type ComposerTemplateInsertAction = {
  kind: 'mcp_template'
  connectionId: string
  name: string
  label: string
  connectorLabel: string
  arguments: ComposerTemplateArgument[]
}

export type ComposerTemplateMenuItem = {
  id: string
  group: 'templates'
  label: string
  description: string
  insert: ComposerTemplateInsertAction
  search: string
}

/** Templates per connection in server order; the label is the template title (else its name). */
export function slashTemplateItems(
  connections: readonly McpTemplateConnection[],
  normalize: (value: string) => string,
): ComposerTemplateMenuItem[] {
  const seen = new Set<string>()
  const items: ComposerTemplateMenuItem[] = []
  for (const connection of connections) {
    for (const template of connection.templates) {
      const id = `mcp_template:${connection.connection_id}:${template.name}`
      if (seen.has(id)) continue
      seen.add(id)
      const label = template.title?.trim() || template.name
      items.push({
        id,
        group: 'templates',
        label,
        description: connection.connector_label,
        insert: {
          kind: 'mcp_template',
          connectionId: connection.connection_id,
          name: template.name,
          label,
          connectorLabel: connection.connector_label,
          arguments: template.arguments.map((argument) => ({ name: argument.name, description: argument.description, required: argument.required })),
        },
        search: normalize(`${label} ${template.name} ${connection.connector_label}`),
      })
    }
  }
  return items
}

const MAX_TEMPLATE_ITEMS = 8

/** The "Şablonlar" group for a `/` query (same ranking as the other groups), or null when nothing matches. */
export function filterTemplateItems(
  items: readonly ComposerTemplateMenuItem[],
  query: string,
): { id: 'templates'; items: ComposerTemplateMenuItem[] } | null {
  const needle = normalizeMenuSearch(query)
  const matches = items
    .map((item) => ({ item, rank: rankMatch(item.search, needle) }))
    .filter((entry) => entry.rank !== null)
    .sort((left, right) => (left.rank! - right.rank!) || left.item.label.localeCompare(right.item.label))
    .slice(0, MAX_TEMPLATE_ITEMS)
    .map((entry) => entry.item)
  return matches.length > 0 ? { id: 'templates', items: matches } : null
}

/**
 * The composer text after a rendered template arrives: it replaces the `/query` token it was chosen from, or — when
 * the user changed that text meanwhile — goes in at the caret. The caller commits it as ONE undo step.
 */
export function applyTemplateInsert(
  text: string,
  range: { start: number; end: number; token: string },
  insert: string,
  caret: number,
): { text: string; caret: number } {
  if (text.slice(range.start, range.end) === range.token) return insertMcpTemplateText(text, range, insert)
  const position = Math.min(Math.max(caret, 0), text.length)
  // At the caret the text starts a new word (the token it replaced is gone).
  const separated = position > 0 && !/\s$/u.test(text.slice(0, position)) ? ` ${insert}` : insert
  return insertMcpTemplateText(text, { start: position, end: position }, separated)
}

/** A template with a required argument asks for its arguments first; otherwise it is rendered at once. */
export function templateNeedsArguments(action: ComposerTemplateInsertAction): boolean {
  return action.arguments.some((argument) => argument.required)
}

/** The arguments a form sends: trimmed, empty optional ones left out (the server checks names and limits). */
export function templateArgumentValues(action: ComposerTemplateInsertAction, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const argument of action.arguments) {
    const value = (values[argument.name] ?? '').trim()
    if (value) out[argument.name] = value.slice(0, 1000)
  }
  return out
}

export function templateArgumentsComplete(action: ComposerTemplateInsertAction, values: Record<string, string>): boolean {
  return action.arguments.every((argument) => !argument.required || (values[argument.name] ?? '').trim().length > 0)
}
