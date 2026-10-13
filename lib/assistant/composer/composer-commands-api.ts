import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import { capabilityRefSchema, type CapabilityRef } from './owner-refs'

/**
 * E1-H client of `GET /api/v1/assistant-composer/commands`: the slash commands the composer's `/` menu gets from the
 * SERVER (owner tools such as Brand's `/motion`, tenant gated by their owners), so the menu is data driven and the client
 * names no command. Server data only; a malformed entry is dropped, never repaired. Listing executes nothing: a selected
 * command is only a `preferred_tools` capability chip, the server decides what the job may do.
 */

const localizedSchema = z.object({ en: z.string().min(1).max(200), tr: z.string().min(1).max(200) })

const commandSchema = z.object({
  command_id: z.string().min(1).max(64),
  capability: capabilityRefSchema,
  title: localizedSchema,
  description: localizedSchema,
  surfaces: z.array(z.enum(['dashboard_chat', 'spark_chat'])).min(1),
  sort_order: z.number().int(),
})

const responseSchema = z.object({
  data: z.object({
    schema_version: z.literal('composer_commands_v1'),
    surface: z.enum(['dashboard_chat', 'spark_chat']),
    commands: z.array(z.unknown()).catch([]),
  }),
})

export type ComposerCommandSurface = 'dashboard_chat' | 'spark_chat'

/** One owner-provided slash command with its capability chip ref and its texts in both locales. */
export type ComposerServerCommand = {
  commandId: string
  capability: CapabilityRef
  title: { en: string; tr: string }
  description: { en: string; tr: string }
  sortOrder: number
}

export const COMPOSER_COMMANDS_QUERY_KEY = ['assistant', 'composer-commands'] as const

export function parseComposerCommands(raw: readonly unknown[], surface: ComposerCommandSurface): ComposerServerCommand[] {
  const commands: ComposerServerCommand[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    const parsed = commandSchema.safeParse(entry)
    if (!parsed.success || !parsed.data.surfaces.includes(surface) || seen.has(parsed.data.command_id)) continue
    seen.add(parsed.data.command_id)
    commands.push({
      commandId: parsed.data.command_id,
      capability: parsed.data.capability,
      title: parsed.data.title,
      description: parsed.data.description,
      sortOrder: parsed.data.sort_order,
    })
  }
  return commands.sort((left, right) => left.sortOrder - right.sortOrder || left.commandId.localeCompare(right.commandId))
}

export async function getComposerCommands(
  surface: ComposerCommandSurface,
  options: { signal?: AbortSignal } = {},
): Promise<ComposerServerCommand[]> {
  const params = new URLSearchParams({ surface })
  const result = await gatewayRequest(`/api/v1/assistant-composer/commands?${params.toString()}`, {
    schema: responseSchema,
    signal: options.signal,
  })
  return parseComposerCommands(result.data.commands, surface)
}
