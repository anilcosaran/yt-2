// A skill as one Markdown file: the name and the one-sentence description in the front matter, the method as the
// body (the SKILL.md shape). The editor shows the three parts apart; a file upload or download joins them.

export type SkillDocument = { name: string; description: string; body: string }

const FRONT_MATTER = /^﻿?---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.+)$/
const BULLET_ITEM = /^\s*[-*]\s+(.+)$/

/**
 * Reads an uploaded `.md`. Without front matter the name is the first `# heading` (else `fallbackName`, the file
 * name) and the description is the first plain paragraph.
 */
export function parseSkillMarkdown(text: string, fallbackName = ''): SkillDocument {
  const source = text.replace(/\r\n?/g, '\n')
  const match = FRONT_MATTER.exec(source)
  const fields = match ? readFrontMatter(match[1]) : {}
  let body = (match ? source.slice(match[0].length) : source.replace(/^﻿/, '')).trim()

  // The name is shown as the page title, so a leading `# heading` that repeats it leaves the body.
  const heading = /^#[ \t]+(.+?)[ \t]*(?:\n|$)/.exec(body)
  let name = (fields.name ?? fields.title ?? '').trim()
  if (heading && (!name || sameText(heading[1], name))) {
    name = name || plainText(heading[1])
    body = body.slice(heading[0].length).trim()
  }

  return {
    name: name || fallbackName,
    description: (fields.description ?? '').replace(/\s+/g, ' ').trim() || firstParagraph(body),
    body,
  }
}

export function skillToMarkdown(skill: SkillDocument): string {
  return `---\nname: ${yamlScalar(skill.name)}\ndescription: ${yamlScalar(skill.description)}\n---\n\n${skill.body.trim()}\n`
}

/** The steps of a method: its numbered list items, or its bullets when nothing is numbered. */
export function stepsFromBody(body: string): string[] {
  const lines = body.replace(/```[\s\S]*?(?:```|$)/g, '').split('\n')
  const items = (pattern: RegExp) => lines.flatMap((line) => {
    const item = pattern.exec(line)?.[1]
    return item ? [plainText(item)] : []
  })
  const ordered = items(ORDERED_ITEM)
  return ordered.length ? ordered : items(BULLET_ITEM)
}

/** The method of a skill that only has steps (the built-in ones, and what AI drafts). */
export function bodyFromSteps(steps: string[], heading: string): string {
  if (steps.length === 0) return ''
  return `## ${heading}\n\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
}

/** `Ürün tanıtımı.md` → `Ürün tanıtımı`; a bare `SKILL.md` names nothing. */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  if (!base || /^(skill|readme)$/i.test(base)) return ''
  return base.charAt(0).toLocaleUpperCase() + base.slice(1)
}

/** A file name for the download: lower case, dashes, the letters of any language kept. */
export function skillFileName(name: string): string {
  const slug = name.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'skill'}.md`
}

function readFrontMatter(block: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const lines = block.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(lines[index])
    if (!match) continue
    let value = match[2].trim()
    if (/^[>|][+-]?$/.test(value)) {
      // A block scalar: the indented lines under the key.
      const parts: string[] = []
      while (index + 1 < lines.length && /^(?:[ \t]+.*|)$/.test(lines[index + 1])) {
        index += 1
        parts.push(lines[index].trim())
      }
      value = parts.join(value.startsWith('|') ? '\n' : ' ').trim()
    } else {
      value = unquote(value)
    }
    fields[match[1].toLowerCase()] = value
  }
  return fields
}

function unquote(value: string) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return String(JSON.parse(value))
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'")
  return value
}

/** One line; quoted when YAML would read the plain text as something else. */
function yamlScalar(value: string) {
  const flat = value.replace(/\s+/g, ' ').trim()
  return !flat || /[:#"'[\]{}|>&*!%@`,]/.test(flat) || /^[-?]/.test(flat) ? JSON.stringify(flat) : flat
}

function firstParagraph(body: string) {
  const blocks = body.replace(/```[\s\S]*?(?:```|$)/g, '').split(/\n{2,}/)
  const paragraph = blocks.map((block) => block.trim()).find((block) => block && !/^(#{1,6}\s|[-*]\s|\d+[.)]\s|>|\||-{3,}$)/.test(block))
  const text = plainText((paragraph ?? '').replace(/\n/g, ' '))
  return text.length > 200 ? `${text.slice(0, 199).trimEnd()}…` : text
}

/** Inline Markdown marks off: `**kalın** [metin](adres)` → `kalın metin`. */
function plainText(value: string) {
  return value
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, '$2')
    .trim()
}

function sameText(left: string, right: string) {
  return plainText(left).toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}
