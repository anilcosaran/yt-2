import {
  createSkillChip,
  createToolChip,
  type ComposerCommandChip,
} from './composer-state'
import type { ComposerServerCommand } from './composer-commands-api'
import { connectionItemRank, slashConnectionItems, type SlashConnectionSource } from './composer-menu-connections'
import {
  capabilityRefSchema,
  isCapabilityKey,
  skillRevisionRefSchema,
  type CapabilityRef,
  type SkillRevisionRef,
} from './owner-refs'

/**
 * P03-01 slash menu model. Groups stay separate: Youtorch tools, then the user's skills (USER_MANAGED), then (P03-25)
 * the approved tools of the user's connections (`composer-menu-connections.ts`). SYSTEM_INTERNAL guides are never listed. Items are keyed by their owner ref and
 * searched by public label only, so a raw engine node name (`image_generate`) matches nothing and typing it stays
 * plain text. Choosing an item only returns a chip; nothing here or in the caller executes it.
 */

export type ComposerSurface = 'dashboard_chat' | 'spark_chat'
export type ComposerMenuGroupId = 'tools' | 'skills' | 'connections'

export type ComposerMenuItem = {
  id: string
  group: ComposerMenuGroupId
  label: string
  description: string
  chip: ComposerCommandChip
  /** Normalized public label (and short title) used for search. */
  search: string
  /** P03-25 connector tools: the lower-case full tool name (`notion.search`), reachable by typing it. */
  fullName?: string
  /** QA-126 connector tools: the connection the tool belongs to (its per-chat switch row). */
  connectionId?: string
}

export type ComposerMenuGroup = { id: ComposerMenuGroupId; items: ComposerMenuItem[] }

/** Precedence of groups when names collide (K348: Youtorch > skill > connector). */
export const COMPOSER_MENU_GROUP_ORDER: readonly ComposerMenuGroupId[] = ['tools', 'skills', 'connections']
const MAX_ITEMS_PER_GROUP = 8

/** Structural slice of a Discovery catalog tool (`lib/discovery/api.ts`). */
export type SlashToolSource = {
  tool_id: string
  title: string
  short_title: string
  description: string
  status: 'active' | 'maintenance' | 'disabled'
  maintenance: boolean
  input_contract: { provider_requirement: Record<string, unknown> }
  ui: { sort_order: number }
}

/** Structural slice of a skill installation view (`lib/assistant/skills-api.ts`). */
export type SlashSkillSource = {
  installation: {
    status: 'installed' | 'disabled' | 'uninstalled'
    activation: { enabled: boolean; surfaces: readonly string[] }
  }
  revision: {
    skill_id: string
    skill_revision_id: string
    skill_scope: string
    name: string
    description: string
    body_digest_sha256: string
  }
  runtime: { usable: boolean }
}

const ACTIVATION_SURFACE: Record<ComposerSurface, string> = {
  dashboard_chat: 'chat',
  spark_chat: 'spark',
}

/** Owner of the Discovery tools: they run through the Workflow agent API. */
const DISCOVERY_TOOL_OWNER_BC = 'workflow' as const

export function buildSlashMenuItems(input: {
  surface: ComposerSurface
  tools: readonly SlashToolSource[]
  skills: readonly SlashSkillSource[]
  /** P03-25: the user's enabled connections and their approved tools. */
  connections?: readonly SlashConnectionSource[]
  /** P03-25: connections switched off in this conversation. */
  disabledConnectionIds?: ReadonlySet<string>
  /** E1-H: owner commands the server lists for this surface and tenant (`/motion`), shown in the tools group. */
  commands?: readonly ComposerServerCommand[]
  locale?: 'tr' | 'en'
}): ComposerMenuItem[] {
  return [
    ...slashCommandItems(input.commands ?? [], input.locale ?? 'en'),
    ...slashToolItems(input.tools),
    ...slashSkillItems(input.skills, input.surface),
    ...slashConnectionItems(input.connections ?? [], { disabledConnectionIds: input.disabledConnectionIds, normalize: normalizeMenuSearch }),
  ]
}

/**
 * E1-H: the server-provided owner commands (`GET /api/v1/assistant-composer/commands`). The label and description are the
 * owner's, in the user's language; the chip carries the capability ref the owner named, so nothing here knows `/motion`.
 * Choosing the item only returns the chip (the first leading command rule of the composer state still applies).
 */
export function slashCommandItems(commands: readonly ComposerServerCommand[], locale: 'tr' | 'en'): ComposerMenuItem[] {
  const items: ComposerMenuItem[] = []
  for (const command of commands) {
    const label = command.title[locale].trim() || command.title.en.trim()
    if (!label) continue
    const chip = createToolChip(command.capability, label)
    items.push({
      id: chip.key,
      group: 'tools',
      label,
      description: command.description[locale],
      chip,
      search: normalizeMenuSearch(`${command.title.en} ${command.title.tr} ${command.commandId}`),
    })
  }
  return items
}

/**
 * One item per capability: several catalog tools of the same capability name the same preferred tool, so the
 * first one in catalog order gives the label. A tool without a public capability key is not offered.
 */
function slashToolItems(tools: readonly SlashToolSource[]): ComposerMenuItem[] {
  const ordered = [...tools]
    .filter((tool) => tool.status === 'active' && !tool.maintenance)
    .sort((left, right) => left.ui.sort_order - right.ui.sort_order || left.title.localeCompare(right.title))
  const byCapability = new Map<string, ComposerMenuItem>()
  for (const tool of ordered) {
    const capability = readToolCapability(tool)
    if (!capability || byCapability.has(capability)) continue
    const parsed = capabilityRefSchema.safeParse({
      ref_type: 'capability',
      capability_key: capability,
      owner_bc: DISCOVERY_TOOL_OWNER_BC,
    } satisfies CapabilityRef)
    if (!parsed.success) continue
    const label = tool.title.trim() || tool.short_title.trim()
    if (!label) continue
    const chip = createToolChip(parsed.data, label)
    byCapability.set(capability, {
      id: chip.key,
      group: 'tools',
      label,
      description: tool.description,
      chip,
      search: normalizeMenuSearch(`${label} ${tool.short_title}`),
    })
  }
  return [...byCapability.values()]
}

function readToolCapability(tool: SlashToolSource): string | null {
  const value = tool.input_contract.provider_requirement['capability']
  return typeof value === 'string' && isCapabilityKey(value) ? value : null
}

/**
 * Usable USER_MANAGED skills enabled for this surface. Internal guides are not installable and are filtered again
 * here as a guard; a revoked/sunset/disabled installation is not offered.
 */
function slashSkillItems(skills: readonly SlashSkillSource[], surface: ComposerSurface): ComposerMenuItem[] {
  const seen = new Set<string>()
  const items: ComposerMenuItem[] = []
  for (const view of skills) {
    if (view.installation.status !== 'installed' || !view.installation.activation.enabled || !view.runtime.usable) continue
    if (!view.installation.activation.surfaces.includes(ACTIVATION_SURFACE[surface])) continue
    const revision = view.revision
    if (revision.skill_scope === 'system_internal' || seen.has(revision.skill_id)) continue
    const parsed = skillRevisionRefSchema.safeParse({
      ref_type: 'skill_revision',
      skill_id: revision.skill_id,
      skill_revision_id: revision.skill_revision_id,
      skill_scope: revision.skill_scope,
      body_digest_sha256: revision.body_digest_sha256,
    } satisfies Record<keyof SkillRevisionRef, unknown>)
    if (!parsed.success) continue
    const label = revision.name.trim()
    if (!label) continue
    seen.add(revision.skill_id)
    const chip = createSkillChip(parsed.data, label)
    items.push({
      id: chip.key,
      group: 'skills',
      label,
      description: revision.description,
      chip,
      search: normalizeMenuSearch(label),
    })
  }
  return items
}

/** Groups in precedence order; prefix matches before substring matches, bounded per group. */
export function filterComposerMenu(items: readonly ComposerMenuItem[], query: string): ComposerMenuGroup[] {
  const needle = normalizeMenuSearch(query)
  // K348: a name a Youtorch tool or a skill owns shadows the connectors' short names (full name still reaches them).
  const connectionQuery = {
    raw: query.trim().toLowerCase(),
    needle,
    shadowed: needle.length > 0 && items.some((item) => item.group !== 'connections' && normalizeMenuSearch(item.label) === needle),
  }
  return COMPOSER_MENU_GROUP_ORDER.flatMap((group) => {
    const matches = items
      .filter((item) => item.group === group)
      .map((item) => ({
        item,
        rank: group === 'connections' ? connectionItemRank(item, connectionQuery, rankMatch) : rankMatch(item.search, needle),
      }))
      .filter((entry) => entry.rank !== null)
      .sort((left, right) => (left.rank! - right.rank!) || left.item.label.localeCompare(right.item.label))
      .slice(0, MAX_ITEMS_PER_GROUP)
      .map((entry) => entry.item)
    return matches.length > 0 ? [{ id: group, items: matches }] : []
  })
}

export function rankMatch(haystack: string, needle: string): number | null {
  if (!needle) return 1
  if (haystack.startsWith(needle)) return 0
  if (haystack.split(' ').some((word) => word.startsWith(needle))) return 1
  if (haystack.includes(needle)) return 2
  return null
}

/** Case/diacritic-insensitive (TR/EN) search text. */
export function normalizeMenuSearch(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/ı/gu, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Flattened items of the visible groups in display order (keyboard navigation). */
export function flattenComposerMenu(groups: readonly ComposerMenuGroup[]): ComposerMenuItem[] {
  return groups.flatMap((group) => group.items)
}
