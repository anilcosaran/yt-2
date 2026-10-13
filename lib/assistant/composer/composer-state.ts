import { z } from 'zod'

import {
  invocationTargetRefSchema,
  ownerRefIdentityKey,
  ownerRefSchema,
  skillRevisionRefSchema,
  storageObjectRefSchema,
  type InvocationTargetRef,
  type OwnerRef,
  type SkillRevisionRef,
  type StorageObjectRef,
} from './owner-refs'

/**
 * P03-01 shared composer state (Dashboard Chat and Spark Chat use the same model). The composer holds plain text plus
 * typed chips. A chip's identity is its owner ref (`key`), never its label: paste, delete, undo and restore move the
 * exact chip object, so a rename or a same-name resource cannot swap what a message refers to.
 *
 * - `skill` / `tool`: the one leading command picked from the slash menu (first slash scope). Selecting it executes
 *   nothing; the sent message only names it (`selected_skill_refs` / `preferred_tools`) and the server applies policy.
 * - `mention`: an `@` resource (P03-02 fills the discovery and roles); `attachment`: a Storage object.
 */

export type ComposerCommandChip =
  | { kind: 'skill'; key: string; label: string; ref: SkillRevisionRef }
  | { kind: 'tool'; key: string; label: string; ref: InvocationTargetRef }

export type ComposerMentionChip = {
  kind: 'mention'
  key: string
  label: string
  ref: OwnerRef
  /** P03-02 resource kind (avatar, voice, brand_template, …); display and role rules only, never identity. */
  resourceKind: string
  /** P03-02 mention role (image_reference, first_frame, style, avatar); null when the kind has a single use. */
  role: string | null
}

export type ComposerAttachmentChip = { kind: 'attachment'; key: string; label: string; ref: StorageObjectRef }

export type ComposerChip = ComposerCommandChip | ComposerMentionChip | ComposerAttachmentChip

export type ComposerState = {
  text: string
  chips: readonly ComposerChip[]
}

/** First slash scope (P03-01): one leading command per message. */
export const MAX_LEADING_COMMANDS = 1
/** Contract bounds (assistant_message_context_v1). */
export const MAX_MENTIONS = 32
export const MAX_ATTACHMENTS = 32
const HISTORY_LIMIT = 100

export const EMPTY_COMPOSER_STATE: ComposerState = { text: '', chips: [] }

export function isCommandChip(chip: ComposerChip): chip is ComposerCommandChip {
  return chip.kind === 'skill' || chip.kind === 'tool'
}

export function commandChipKey(ref: SkillRevisionRef | InvocationTargetRef): string {
  return ownerRefIdentityKey(ref)
}

export function mentionChipKey(ref: OwnerRef, role: string | null): string {
  return `${ownerRefIdentityKey(ref)}|${role ?? '-'}`
}

export function attachmentChipKey(ref: StorageObjectRef): string {
  return ownerRefIdentityKey(ref)
}

export function createSkillChip(ref: SkillRevisionRef, label: string): ComposerCommandChip {
  return { kind: 'skill', key: commandChipKey(ref), label, ref }
}

export function createToolChip(ref: InvocationTargetRef, label: string): ComposerCommandChip {
  return { kind: 'tool', key: commandChipKey(ref), label, ref }
}

export function createMentionChip(input: { ref: OwnerRef; label: string; resourceKind: string; role: string | null }): ComposerMentionChip {
  return {
    kind: 'mention',
    key: mentionChipKey(input.ref, input.role),
    label: input.label,
    ref: input.ref,
    resourceKind: input.resourceKind,
    role: input.role,
  }
}

export function createAttachmentChip(ref: StorageObjectRef, label: string): ComposerAttachmentChip {
  return { kind: 'attachment', key: attachmentChipKey(ref), label, ref }
}

/**
 * Adds chips keeping identity: a chip already present (same key) is not duplicated, and a new leading command
 * replaces the previous one (one leading command). Bounds are enforced, never by silently dropping a different
 * chip: chips past a bound are returned in `rejected`.
 */
export function addComposerChips(
  state: ComposerState,
  chips: readonly ComposerChip[],
): { state: ComposerState; rejected: ComposerChip[] } {
  let next = [...state.chips]
  const rejected: ComposerChip[] = []
  for (const chip of chips) {
    if (next.some((existing) => existing.key === chip.key)) continue
    if (isCommandChip(chip)) {
      next = [...next.filter((existing) => !isCommandChip(existing)), chip]
      continue
    }
    const sameKind = next.filter((existing) => existing.kind === chip.kind).length
    const bound = chip.kind === 'mention' ? MAX_MENTIONS : MAX_ATTACHMENTS
    if (sameKind >= bound) {
      rejected.push(chip)
      continue
    }
    next.push(chip)
  }
  return { state: { ...state, chips: next }, rejected }
}

export function removeComposerChip(state: ComposerState, key: string): ComposerState {
  if (!state.chips.some((chip) => chip.key === key)) return state
  return { ...state, chips: state.chips.filter((chip) => chip.key !== key) }
}

/**
 * Relabels chips from a fresh owner projection after a reconnect/rename. Only the display label changes; the ref
 * (and so the identity) is kept, and a chip whose owner no longer lists it keeps its last label.
 */
export function relabelComposerChips(state: ComposerState, labelFor: (chip: ComposerChip) => string | null): ComposerState {
  let changed = false
  const chips = state.chips.map((chip) => {
    const label = labelFor(chip)
    if (!label || label === chip.label) return chip
    changed = true
    return { ...chip, label }
  })
  return changed ? { ...state, chips } : state
}

export function composerHasContent(state: ComposerState): boolean {
  return state.text.trim().length > 0 || state.chips.length > 0
}

// --- Undo / redo ------------------------------------------------------------------------------------------------

export type ComposerHistory = {
  past: readonly ComposerState[]
  present: ComposerState
  future: readonly ComposerState[]
  /** Typing into the same run of text coalesces into one undo step. */
  coalesceKey: string | null
}

export function createComposerHistory(initial: ComposerState = EMPTY_COMPOSER_STATE): ComposerHistory {
  return { past: [], present: initial, future: [], coalesceKey: null }
}

/**
 * Records `next` as the new present. With `coalesceKey` (typing), consecutive edits with the same key replace the
 * present instead of adding an undo step; chip edits never coalesce.
 */
export function commitComposerEdit(
  history: ComposerHistory,
  next: ComposerState,
  options: { coalesceKey?: string | null } = {},
): ComposerHistory {
  if (next === history.present) return history
  const coalesceKey = options.coalesceKey ?? null
  if (coalesceKey && coalesceKey === history.coalesceKey) {
    return { ...history, present: next, future: [] }
  }
  const past = [...history.past, history.present].slice(-HISTORY_LIMIT)
  return { past, present: next, future: [], coalesceKey }
}

export function undoComposerEdit(history: ComposerHistory): ComposerHistory {
  const previous = history.past[history.past.length - 1]
  if (!previous) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    coalesceKey: null,
  }
}

export function redoComposerEdit(history: ComposerHistory): ComposerHistory {
  const [next, ...rest] = history.future
  if (!next) return history
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
    coalesceKey: null,
  }
}

// --- Clipboard ---------------------------------------------------------------------------------------------------

/** Chips copied out of a composer keep their refs through this custom clipboard type; plain text never becomes a chip. */
export const COMPOSER_CLIPBOARD_MIME = 'application/x-youtorch-composer+json'
const COMPOSER_CLIPBOARD_VERSION = 1

const clipboardChipSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('skill'), label: z.string().min(1).max(120), ref: skillRevisionRefSchema }),
  z.object({ kind: z.literal('tool'), label: z.string().min(1).max(120), ref: invocationTargetRefSchema }),
  z.object({
    kind: z.literal('mention'),
    label: z.string().min(1).max(120),
    ref: ownerRefSchema,
    resource_kind: z.string().min(1).max(40),
    role: z.string().min(1).max(40).nullable(),
  }),
  z.object({ kind: z.literal('attachment'), label: z.string().min(1).max(255), ref: storageObjectRefSchema }),
])

const clipboardPayloadSchema = z.object({
  v: z.literal(COMPOSER_CLIPBOARD_VERSION),
  chips: z.array(z.unknown()).max(MAX_MENTIONS + MAX_ATTACHMENTS + MAX_LEADING_COMMANDS),
})

export function encodeComposerClipboard(chips: readonly ComposerChip[]): { json: string; text: string } {
  const payload = {
    v: COMPOSER_CLIPBOARD_VERSION,
    chips: chips.map((chip) => chip.kind === 'mention'
      ? { kind: chip.kind, label: chip.label, ref: chip.ref, resource_kind: chip.resourceKind, role: chip.role }
      : { kind: chip.kind, label: chip.label, ref: chip.ref }),
  }
  return {
    json: JSON.stringify(payload),
    text: chips.map((chip) => (chip.kind === 'mention' ? `@${chip.label}` : chip.label)).join(' '),
  }
}

/**
 * Restores chips from a composer clipboard payload with their exact refs. Invalid entries are dropped (a tampered or
 * foreign payload never becomes a ref); a label is never resolved to a resource here.
 */
export function decodeComposerClipboard(json: string): ComposerChip[] {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return []
  }
  const payload = clipboardPayloadSchema.safeParse(raw)
  if (!payload.success) return []
  const chips: ComposerChip[] = []
  for (const entry of payload.data.chips) {
    const parsed = clipboardChipSchema.safeParse(entry)
    if (!parsed.success) continue
    const chip = parsed.data
    if (chip.kind === 'skill') chips.push(createSkillChip(chip.ref, chip.label))
    else if (chip.kind === 'tool') chips.push(createToolChip(chip.ref, chip.label))
    else if (chip.kind === 'attachment') chips.push(createAttachmentChip(chip.ref, chip.label))
    else chips.push(createMentionChip({ ref: chip.ref, label: chip.label, resourceKind: chip.resource_kind, role: chip.role }))
  }
  return chips
}
