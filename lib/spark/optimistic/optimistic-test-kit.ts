import { vi } from 'vitest'

import { AuthClientError } from '@/lib/auth/errors'

import type { SparkProject } from '../api'
import {
  indexCompositionRevs,
  type CompositionCommandBody,
  type CompositionCommandReceipt,
  type CompositionDocument,
  type CompositionRawOp,
  type CompositionRedoReceipt,
  type CompositionTransport,
  type CompositionUndoReceipt,
  type CompositionWorkingCopy,
} from '../composition-client'
import { SparkCompositionSession, type SparkCompositionSessionOptions } from '../composition-session'
import { PROJECT_ID, workingCopy } from '../composition-test-fixtures'
import { applyOpsLocally } from './document-ops'
import { rebaseDocumentChange } from './history-rebase'

/**
 * E1-N test kit: a fake Composition gateway that applies the typed ops of a command with the SAME port the editor uses for
 * its local copy (so the document the "server" returns is, by the parity test, what the real gateway would return), and
 * answers with real receipts (`changed_entities` carry the new revs, so receipt-chained commands work). Calls can be held
 * (`hold`), failed (`failNext`) or delayed (`latencyMs`) to prove what the editor shows before the server answers.
 *
 * Spark undo / redo: the fake keeps the gateway's rules per actor (the editor's user is `me`): one group per command, undo of
 * the newest applied group, redo of the most recently undone one, a new group of the actor closes the redo stack, the
 * expected group (`undo_group_id`) is checked, and the entities a group left (or its undo left) must still be at their revs
 * (another writer in between: a conflict). Its inverse is the copy before / after the group in the parts the group touched
 * (`rebaseDocumentChange`), a stand-in for the gateway's typed inverse ops. `writeAs` is another writer: an agent job of the
 * same user (`me-agent`: a group in the user's stack) or another user (`other`).
 */

export const KIT_PROJECT: SparkProject = {
  id: PROJECT_ID,
  channelId: 'ch_1',
  title: 'Instant editing',
  aspectRatio: '16:9',
  lifecycleState: 'active',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
}

export function refusal(status: number, code: string): AuthClientError {
  return new AuthClientError(code, 'refused', status)
}

export function networkError(): AuthClientError {
  return new AuthClientError('GATEWAY_NETWORK_ERROR', 'Gateway request failed before receiving a response.', 502)
}

export type KitOptions = {
  document: CompositionDocument
  role?: CompositionWorkingCopy['role']
  /** Simulated round trip of every gateway call (ms, real timers). 0 = instant. */
  latencyMs?: number
  session?: Partial<SparkCompositionSessionOptions>
}

type Held = { release: () => void; name: string }

export function createOptimisticKit(options: KitOptions) {
  const server = { copy: workingCopy(options.document, options.role ?? 'owner') as CompositionWorkingCopy }
  const commands: CompositionCommandBody[] = []
  const calls: Array<{ name: string; start: number; end: number }> = []
  const failures: Array<{ match: (body: CompositionCommandBody) => boolean; error: unknown; times: number }> = []
  // The gateway's idempotency (CAS order 1): a known key with the same payload replays its receipt; with a different
  // payload it is refused (`rejected_idempotency_conflict`), whatever the base revision says.
  const receipts = new Map<string, { fingerprint: string; receipt: CompositionCommandReceipt }>()
  let lostAnswers = 0
  /** The server's answer, unless it is lost on the way back (the command stays applied). */
  const answer = (receipt: CompositionCommandReceipt): CompositionCommandReceipt => {
    if (lostAnswers > 0) {
      lostAnswers -= 1
      throw networkError()
    }
    return receipt
  }
  const holds: Array<{ name: 'command' | 'read'; gate: Promise<void> }> = []
  type KitGroup = {
    id: string
    actor: string
    before: CompositionDocument
    after: CompositionDocument
    /** The entities the group changed (their content in `after` is the undo CAS, in `before` the redo CAS). */
    revs: Map<string, number>
    state: 'applied' | 'undone' | 'closed'
    undoneAt: number
  }
  const groups: KitGroup[] = []
  const historyFailures: Array<{ kind: 'undo' | 'redo'; error: unknown }> = []
  const entityKeys = (changed: ReadonlyArray<{ entity_kind: string; entity_id: string }>) => changed.map((ref) => `${ref.entity_kind}:${ref.entity_id}`)
  const revsOf = (document: CompositionDocument, keys: Iterable<string>) => {
    const index = indexCompositionRevs(document)
    return new Map([...keys].map((key) => [key, index.get(key) ?? -1]))
  }
  /** A new group of an actor: it closes that actor's redo stack (the gateway rule). */
  const recordGroup = (actor: string, id: string, before: CompositionDocument, after: CompositionDocument, changed: ReadonlyArray<{ entity_kind: string; entity_id: string }>) => {
    // Timeline v3: a command naming the actor's newest open group joins it (the gateway appends it to that group).
    const top = groups.filter((group) => group.actor === actor).at(-1)
    if (top && top.id === id && top.state === 'applied') {
      top.after = after
      top.revs = revsOf(after, new Set([...top.revs.keys(), ...entityKeys(changed)]))
      return
    }
    for (const group of groups) if (group.actor === actor && group.state === 'undone') group.state = 'closed'
    groups.push({ id, actor, before, after, revs: revsOf(after, entityKeys(changed)), state: 'applied', undoneAt: 0 })
  }
  /** The gateway refuses a command naming a group of the actor that is not its newest open one. */
  const assertJoinable = (actor: string, id: string) => {
    const named = groups.find((group) => group.actor === actor && group.id === id)
    const top = groups.filter((group) => group.actor === actor).at(-1)
    if (named && (named !== top || named.state !== 'applied')) throw refusal(409, 'COMPOSITION_UNDO_GROUP_CLOSED')
  }
  const writeServer = (document: CompositionDocument): number => {
    const version = server.copy.workingCopyVersion + 1
    server.copy = { ...server.copy, workingCopyVersion: version, document: { ...document, working_copy_version: version }, etag: `"v${version}"` }
    return version
  }
  const historyReceipt = <O extends string>(outcome: O, groupId: string | null) => ({
    command_id: `ccmd_${outcome}_${server.copy.workingCopyVersion}`,
    outcome,
    undo_group_id: groupId,
    working_copy_version: server.copy.workingCopyVersion,
    changed_entities: [],
    removed_entities: [],
    auto_checkpoint_revision_id: null,
    replayed: false,
  })
  const historyFailure = (kind: 'undo' | 'redo') => {
    const index = historyFailures.findIndex((failure) => failure.kind === kind)
    if (index < 0) return
    const [failure] = historyFailures.splice(index, 1)
    throw failure!.error
  }
  /** One entity's own content (revs aside; a scene's layers by id only: a layer is its own entity), null when it is gone. */
  const entityContent = (document: CompositionDocument, key: string): string | null => {
    const [kind, ...rest] = key.split(':')
    const id = rest.join(':')
    const plain = (value: unknown) => JSON.stringify(value, (name, child) => (name === 'rev' ? undefined : child))
    const layers = [...document.scenes.flatMap((scene) => scene.layers), ...document.project_overlays.layers]
    switch (kind) {
      case 'scene_sequence':
        return plain(document.scene_sequence)
      case 'section':
        return plain(document.sections.find((section) => section.section_id === id) ?? null)
      case 'scene': {
        const scene = document.scenes.find((candidate) => candidate.scene_id === id)
        return scene ? plain({ ...scene, layers: scene.layers.map((layer) => layer.layer_id) }) : null
      }
      case 'layer':
      case 'pending_slot':
        return plain(layers.find((layer) => layer.layer_id === id) ?? null)
      case 'audio':
        return id === 'audio' ? plain({ ...document.audio, placements: document.audio.placements.map((placement) => placement.placement_id) }) : plain(document.audio.placements.find((placement) => placement.placement_id === id) ?? null)
      default:
        return plain(document)
    }
  }
  /** The gateway's CAS, by content: every entity the group touched is still as `expected` holds it (nobody wrote it since). */
  const stillAs = (group: KitGroup, expected: CompositionDocument) =>
    [...group.revs.keys()].every((key) => entityContent(server.copy.document, key) === entityContent(expected, key))
  const latency = options.latencyMs ?? 0
  const sleep = (ms: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms))

  async function roundTrip<T>(name: string, work: () => T | Promise<T>): Promise<T> {
    const entry = { name, start: performance.now(), end: 0 }
    calls.push(entry)
    if (latency > 0) await sleep(latency / 2)
    const heldIndex = holds.findIndex((candidate) => (candidate.name === 'command') === name.startsWith('POST'))
    if (heldIndex >= 0) {
      const [held] = holds.splice(heldIndex, 1)
      await held!.gate
    }
    try {
      return await work()
    } finally {
      if (latency > 0) await sleep(latency / 2)
      entry.end = performance.now()
    }
  }

  const transport = {
    getWorkingCopy: vi.fn(async () => roundTrip('GET document', () => server.copy)),
    executeCommand: vi.fn(async (_projectId: string, body: CompositionCommandBody): Promise<CompositionCommandReceipt> =>
      roundTrip('POST commands', () => {
        const failure = failures.find((candidate) => candidate.times > 0 && candidate.match(body))
        if (failure) {
          failure.times -= 1
          throw failure.error
        }
        const fingerprint = JSON.stringify({ ...body, idempotency_key: null })
        const prior = receipts.get(body.idempotency_key)
        if (prior) {
          if (prior.fingerprint !== fingerprint) throw refusal(409, 'COMPOSITION_COMMAND_IDEMPOTENCY_CONFLICT')
          return answer({ ...prior.receipt, outcome: 'replayed' })
        }
        const applied = applyOpsLocally(server.copy.document, body.ops)
        if (!applied.ok) throw refusal(400, 'COMPOSITION_COMMAND_INVALID')
        assertJoinable('me', body.undo_group_id)
        commands.push(body)
        recordGroup('me', body.undo_group_id, server.copy.document, applied.document, applied.changed)
        const version = server.copy.workingCopyVersion + 1
        server.copy = { ...server.copy, workingCopyVersion: version, document: { ...applied.document, working_copy_version: version }, etag: `"v${version}"` }
        const receipt: CompositionCommandReceipt = {
          command_id: `ccmd_${version}`,
          outcome: 'applied',
          receipt_status: 'applied',
          base_revision: body.base_revision,
          working_copy_version_before: version - 1,
          working_copy_version: version,
          undo_group_id: body.undo_group_id,
          changed_entities: applied.changed as never,
          removed_entities: applied.removed as never,
          auto_checkpoint_revision_id: null,
        }
        receipts.set(body.idempotency_key, { fingerprint, receipt })
        return answer(receipt)
      }),
    ),
    undo: vi.fn(async (_projectId: string, body: { idempotency_key: string; undo_group_id?: string }): Promise<CompositionUndoReceipt> =>
      roundTrip('POST undo', () => {
        historyFailure('undo')
        const top = [...groups].reverse().find((group) => group.actor === 'me' && group.state === 'applied')
        if (body.undo_group_id !== undefined && top?.id !== body.undo_group_id) throw refusal(409, 'COMPOSITION_UNDO_STACK_CHANGED')
        if (!top) return historyReceipt('nothing_to_undo' as const, null)
        const reverted = stillAs(top, top.after) ? rebaseDocumentChange(server.copy.document, top.after, top.before) : null
        if (!reverted) {
          top.state = 'closed'
          throw refusal(409, 'COMPOSITION_UNDO_CONFLICT')
        }
        top.undoneAt = writeServer(reverted)
        top.state = 'undone'
        return historyReceipt('undone' as const, top.id)
      }),
    ),
    redo: vi.fn(async (_projectId: string, body: { idempotency_key: string; undo_group_id?: string }): Promise<CompositionRedoReceipt> =>
      roundTrip('POST redo', () => {
        historyFailure('redo')
        const top = groups.filter((group) => group.actor === 'me' && group.state === 'undone').sort((a, b) => b.undoneAt - a.undoneAt)[0]
        if (body.undo_group_id !== undefined && top?.id !== body.undo_group_id) throw refusal(409, 'COMPOSITION_REDO_STACK_CHANGED')
        if (!top) return historyReceipt('nothing_to_redo' as const, null)
        const reapplied = stillAs(top, top.before) ? rebaseDocumentChange(server.copy.document, top.before, top.after) : null
        if (!reapplied) {
          top.state = 'closed'
          throw refusal(409, 'COMPOSITION_REDO_CONFLICT')
        }
        writeServer(reapplied)
        top.state = 'applied'
        return historyReceipt('redone' as const, top.id)
      }),
    ),
  } satisfies CompositionTransport

  let n = 9000
  const session = new SparkCompositionSession({
    projectId: PROJECT_ID,
    transport,
    viewPreferences: { get: async () => null, save: async (_p: string, d) => d },
    getProject: async () => KIT_PROJECT,
    createId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    retryDelaysMs: [],
    // WP2: the idle read-back of a copy taken from receipts runs on a wall-clock timer; a test that is about it sets the delay.
    verifyDelayMs: null,
    ...options.session,
  })

  return {
    session,
    server,
    commands,
    calls,
    transport,
    /** The next command (or document read) waits until the returned function is called. */
    hold(name: 'command' | 'read' = 'command'): Held['release'] {
      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      holds.push({ name, gate })
      return release
    },
    /** The next `times` commands that match are refused with `error` (default: every command). */
    failNext(error: unknown, match: (body: CompositionCommandBody) => boolean = () => true, times = 1) {
      failures.push({ match, error, times })
    },
    /** The next `times` commands reach the server and are applied (or replayed), but their answers are lost (network error). */
    loseNextAnswers(times = 1) {
      lostAnswers += times
    },
    /** What the server holds (a test reads it to prove the background write landed). */
    serverDocument: () => server.copy.document,
    /** Spark undo / redo: the next undo (or redo) is refused with `error`. */
    failNextHistory(kind: 'undo' | 'redo', error: unknown) {
      historyFailures.push({ kind, error })
    },
    /**
     * Another writer on the server while the editor does not look: an agent job of this user (`me-agent`, a group in the
     * user's own stack, so it closes the user's redo stack) or another user (`other`). The editor learns it only by reading.
     */
    writeAs(actor: 'me-agent' | 'other', ops: CompositionRawOp[]) {
      const applied = applyOpsLocally(server.copy.document, ops)
      if (!applied.ok) throw new Error(`the kit could not apply ${ops.map((op) => op.op).join(', ')}: ${applied.reason}`)
      recordGroup(actor === 'me-agent' ? 'me' : 'other', `ug_${actor}_${server.copy.workingCopyVersion + 1}`, server.copy.document, applied.document, applied.changed)
      writeServer(applied.document)
    },
    /** The undo groups of the user on the fake server, oldest first (id and state). */
    serverGroups: () => groups.filter((group) => group.actor === 'me').map((group) => ({ id: group.id, state: group.state })),
  }
}

export type OptimisticKit = ReturnType<typeof createOptimisticKit>

/** Resolves after every pending microtask and timer-0 task (the gated calls have been entered). */
export async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}
