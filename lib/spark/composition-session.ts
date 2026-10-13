import { AuthClientError } from '@/lib/auth/errors'

import { getSparkProject, type SparkProject } from './api'
import {
  CompositionStaleReadError,
  buildCompositionCommandFrom,
  chainCompositionRevIndex,
  classifyCompositionError,
  compositionGatewayTransport,
  compositionHistoryStackChanged,
  compositionRevIndex,
  framesForSeconds,
  newSceneId,
  orderedScenes,
  sceneInsertSpec,
  sceneRemoveSpec,
  sceneReorderSpec,
  withReplicaLagRetry,
  type CompositionCommandBody,
  type CompositionCommandReceipt,
  type CompositionDocument,
  type CompositionFailureKind,
  type CompositionOpSpec,
  type CompositionRedoReceipt,
  type CompositionRevIndex,
  type CompositionTransport,
  type CompositionUndoReceipt,
  type CompositionWorkingCopy,
} from './composition-client'
import { mergeCoalescedSpecs } from './composition-coalesce'
import { audioRemoveSpec, captionTrackIds, captionTrackRemoveSpec, sceneMusic, type CompositionTransform } from './composition-typed-edits'
import { motionRefusalOf, type MotionRefusalReason } from './motion-refusal'
import { applyOpsLocally, canApplyLocally } from './optimistic/document-ops'
import { rebaseDocumentChange } from './optimistic/history-rebase'
import { canonicalJson } from './stage/motion-core/ir/canonical'
import { stockClipPlacement } from './stock-placement'
import { sparkAddSceneMode } from './template-policy'
import type { SparkUndoGroup } from './undo-group'
import { viewPreferenceGatewayTransport, type TimelineDensity, type ViewPreferenceTransport } from './view-preference'

/** Seconds of a scene added with "Add scene" (F35 image hold default; fixed timing). */
export const NEW_SCENE_SECONDS = 3

export type SparkNoticeKind =
  | 'sceneDeleted'
  | 'sceneMoved'
  | 'musicRemoved'
  | 'captionsRemoved'
  | 'undone'
  | 'nothingToUndo'
  | 'conflict'
  | 'undoConflict'
  | 'forbidden'
  | 'notActive'
  | 'saveFailed'
  | 'saveStalled'
  | 'viewNotSaved'
  /** WP4: the gateway refused a Motion write and said why (`reason`); the latest version was loaded. */
  | 'motionRefused'
  /** Spark redo: applied again; nothing to redo; another edit changed it after the undo (the latest version was loaded). */
  | 'redone'
  | 'nothingToRedo'
  | 'redoConflict'
  /** Spark undo / redo: the project was changed elsewhere (another tab, an agent job); the latest version was loaded. */
  | 'historyChanged'

export type SparkNotice = { id: number; kind: SparkNoticeKind; values?: Record<string, number>; reason?: MotionRefusalReason }

/** E1-N: what the header's save chip shows. `error` = a change could not reach the server and waits for a retry. */
export type SparkSaveState = 'saved' | 'saving' | 'error'

export type SparkCompositionState = {
  status: 'loading' | 'ready' | 'not_found' | 'error'
  project: SparkProject | null
  /**
   * The copy the editor draws. With `optimistic` writes it is the server's copy with the edits the server has not
   * confirmed yet applied on top (`localRevision` > 0); `workingCopyVersion` is always the SERVER's version, so every
   * server-side flow that names a base revision keeps working on what the server actually holds.
   */
  workingCopy: CompositionWorkingCopy | null
  /** Viewer role, archived project or a refused write: every write control is disabled. */
  readOnly: boolean
  /** A command or undo is queued or in flight (or its result is being reloaded): `pendingWrites > 0`. */
  saving: boolean
  /**
   * Y1-07 W7: writes queued plus the one in flight. A second `apply()` while another write is running is queued, not
   * dropped, so gate gesture and toolbox writes on `!readOnly`, not on `!saving`.
   */
  pendingWrites?: number
  /** Y1-07 W7: a conditional re-read of the working copy (`refresh()`) is running. */
  refreshing?: boolean
  /** E1-N: the editor applies each typed edit to its own copy first and saves it in the background. */
  optimistic?: boolean
  /** E1-N: `saved` / `saving` / `error` (a change is waiting for a retry; nothing else is lost, edits keep working). */
  saveState?: SparkSaveState
  /** Spark redo is offered in this editor (`SPARK_REDO_ENABLED` and a gateway transport with redo). */
  redoEnabled?: boolean
  /**
   * Spark redo: the editor holds an undone group of its own that nothing has replaced since (a new edit, a change made
   * elsewhere and read back close the redo stack). Undo needs no such flag: the server keeps the user's undo history across
   * reloads and devices, so it is offered whenever the project can be edited.
   */
  canRedo?: boolean
  /** Local view state only; never sent as a command. */
  selectedSceneId: string | null
  /**
   * P02-16: the user's saved compact/expanded choice for this project (null: never chose, the
   * default applies). A server-side UI preference; never a command, revision or reload.
   */
  timelineDensity: TimelineDensity | null
  notice: SparkNotice | null
}

/** E1-N / WP1: what `onOptimistic` learns about the copy that carries the edit. */
export type SparkOptimisticInfo = {
  /** `localRevision` of the first published copy that carries the edit; every later local copy carries it too. */
  localRevision: number
}

export type SparkApplyOptions = {
  /**
   * Runs once the command was applied. When no further write is queued the working copy already contains the change (it
   * was re-read, or WP2 taken from the receipt: the editor's own copy the receipt confirmed), so e.g. a new layer can be
   * selected; when more writes are queued it runs right after the receipt and `receipt.working_copy_version` names the
   * version the document will catch up to.
   */
  onApplied?: (receipt: CompositionCommandReceipt) => void
  /**
   * E1-N: runs synchronously inside `apply()` when the edit was applied to the editor's own copy (an `optimistic`
   * session and ops it can apply locally): the new layer or scene is already in `workingCopy` and can be selected.
   */
  onOptimistic?: (info?: SparkOptimisticInfo) => void
  /**
   * Latest-wins key. A queued command that has NOT been sent yet and has the same key is replaced by this one (its
   * `apply()` resolves false). Use e.g. `layer:<id>:transform` for a drag or nudge burst; one gesture stays one command.
   * The replacing command takes the older one's place at the END of the line and keeps what only the older one carried
   * (`mergeCoalescedSpecs`: the other field of a partial patch, an op the newer command does not repeat), so a key
   * names a group of properties, never a way to drop a different edit. Use one key per group.
   */
  coalesceKey?: string
  /**
   * Legacy button semantics (add/remove/move scene, Stock insert): a second click while a write is still pending is
   * ignored instead of queued. Internal; gesture and toolbox writes leave it off. An `optimistic` session never drops.
   */
  dropWhileBusy?: boolean
  /**
   * Timeline v3 (instant media add): names the undo step this command opens (`createSparkUndoGroup()`), so that a later
   * command can join it (`joinUndoGroup`). The command itself is an ordinary one undo step; it is never coalesced away.
   */
  undoGroup?: SparkUndoGroup
  /**
   * Timeline v3: the "join undo group" option. The command JOINS the step opened by the command named with this handle
   * (`undoGroup`): it is its own command on the server, sent with the same `undo_group_id` (the gateway appends it to the
   * open group), and it stays ONE undo step in the editor (one undo, instant or not, reverts both). It joins only while that
   * step is still the newest of this editor (nothing written, undone or redone after it, the first command queued and not
   * refused); otherwise it is not applied at all and resolves false — e.g. the exact fit of added media after the user
   * already moved it. A joining command is never coalesced (`coalesceKey` is ignored) nor dropped by `dropWhileBusy`.
   */
  joinUndoGroup?: SparkUndoGroup
}

export type SparkCompositionActions = {
  select(sceneId: string | null): void
  addScene(): Promise<void>
  removeScene(sceneId: string): Promise<void>
  moveScene(sceneId: string, afterSceneId: string | null): Promise<void>
  /** Scene panel "Music" off: removes the scene's own music placements (project-wide music stays). */
  removeSceneMusic(sceneId: string): Promise<void>
  /** Captions drawer "Show captions" off: removes every caption track. */
  removeCaptions(): Promise<void>
  /**
   * Typed edit ops as one recorded command (one undo group); false when nothing was applied (refused, failed, replaced
   * by a newer command with the same `coalesceKey`, read-only). Commands are queued and sent one at a time in call
   * order; between queued commands there is no full re-read (receipt-chained CAS).
   */
  apply(specs: readonly CompositionOpSpec[], options?: SparkApplyOptions): Promise<boolean>
  /**
   * Y1-07 W7: conditional re-read of the working copy (ETag + read floor). Safe at any time — e.g. when an agent job of
   * the project's conversation ended. Resolves after the state was updated; a failed read leaves the held copy.
   */
  refresh?(options?: { minVersion?: number }): Promise<void>
  /**
   * WP5a: a source the server attached enters the held copy from the attach receipt (`source_media`), without a document
   * re-read when nothing else was written in between; otherwise a conditional re-read from the receipt's version.
   */
  adoptAttachedSource?(receipt: AttachedSourceReceipt): Promise<void>
  /** E1-N: sends again the changes that could not reach the server (the header's "Not saved — retry"). */
  retrySave?(): Promise<void>
  undo(): Promise<void>
  /** Spark redo: applies the newest group this editor undid again (instantly with optimistic writes). */
  redo?(): Promise<void>
  /** P02-16: saves the compact/expanded choice on the server (any role; no command, no reload). */
  setTimelineDensity(density: TimelineDensity): Promise<void>
  /**
   * P06-16: inserts one clip of a source the server already bound to the project (e.g. an acquired Stock item) as a
   * new scene after the selected one. Returns the new scene's number, or null when nothing was applied.
   */
  insertSourceClip(sourceId: string, kind: 'image' | 'video', options?: InsertSourceClipOptions): Promise<number | null>
}

/**
 * How `insertSourceClip` places the clip. Timeline v3: `fit` gives the clip's fit from the copy that holds the source at once
 * (`stage/media-insert-fit.ts`: the transform written with the insert, and the exact fit sent later in the same undo step);
 * `onLocal` runs when the clip is in the drawn copy (optimistic writes).
 */
export type InsertSourceClipOptions = {
  fit?: (document: CompositionDocument) => SourceClipFit | null
  onLocal?: () => void
}

/** The part of a `MediaInsertFit` (`stage/media-insert-fit.ts`) the session uses. */
export type SourceClipFit = {
  transform: CompositionTransform | null
  undoGroup: SparkUndoGroup
  settle(placed: { sceneId: string; layerId: string }): void
}

/** WP5a: what `adoptAttachedSource` reads of a `composition.artifact.attach` receipt in the `attached` state. */
export type AttachedSourceReceipt = {
  working_copy_version_before?: number
  working_copy_version: number
  source_media?: unknown
}

export type SparkCompositionSessionOptions = {
  projectId: string
  transport?: CompositionTransport
  viewPreferences?: ViewPreferenceTransport
  getProject?: typeof getSparkProject
  createId?: () => string
  /**
   * E1-N: apply every typed edit to the editor's own copy at once and send it in the background (the server copy and the
   * CAS stay the only authority; a refused edit is rolled back with a notice). Default off.
   */
  optimistic?: boolean
  /** E1-N: pauses (ms) before the automatic retries of a write that could not reach the server, then every 30 s. */
  retryDelaysMs?: readonly number[]
  /** E1-N: test seam for the retry timer. */
  timers?: { setTimeout(callback: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
  /**
   * WP2: idle time (ms) after which a copy taken from receipts (never read back) is read from the server in the background
   * and compared; null = no automatic check (the next `refresh()`, e.g. after an agent job, still does it). Default 2500.
   */
  verifyDelayMs?: number | null
  /** WP2: the server's copy differs from the copy the editor took from a receipt (default `console.warn`); the server's wins. */
  onReceiptMismatch?: (info: { workingCopyVersion: number }) => void
  /** Spark redo (`SPARK_REDO_ENABLED`): offer redo (Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y, the header button). Default off. */
  redo?: boolean
}

const INITIAL_STATE: SparkCompositionState = {
  status: 'loading',
  project: null,
  workingCopy: null,
  readOnly: true,
  saving: false,
  pendingWrites: 0,
  refreshing: false,
  saveState: 'saved',
  canRedo: false,
  selectedSceneId: null,
  timelineDensity: null,
  notice: null,
}

const DEFAULT_RETRY_DELAYS_MS = [3000, 8000, 20000] as const
const RETRY_REPEAT_MS = 30000
const DEFAULT_VERIFY_DELAY_MS = 2500
/** E1-N: server answers that mean "not reachable right now" (the command is kept and retried). */
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([502, 503, 504])

/**
 * E1-N review: per project, the closed editor sessions that are still sending the edits their user already saw. A new
 * editor for the same project reads the working copy only after that, so it never shows a copy without those edits.
 */
const closingFlushes = new Map<string, Promise<void>>()
/** The longest a new editor waits for that (every send has its own gateway timeout; this only bounds a stuck one). */
const CLOSING_FLUSH_WAIT_MS = 15000

/**
 * Spark undo / redo: one recorded command of this editor (one undo group on the server) and how the editor drew it. `before`
 * and `after` are the copies around the command the last time it was applied on top of the server's copy; an undo moves the
 * drawn copy from `after` to `before` in the parts the command changed, a redo back (`optimistic/history-rebase.ts`). null: the
 * editor never drew the command (written server-first), so its undo and redo wait for the server too.
 */
type HistoryEntry = {
  /** The command's undo group, fixed when it is first sent (the undo of a queued command is sent after it). */
  undoGroupId: string | null
  before: CompositionDocument | null
  after: CompositionDocument | null
  /**
   * Timeline v3: the later commands that joined this step (`SparkApplyOptions.joinUndoGroup`), oldest first, each with the copies
   * around it. An undo moves the drawn copy back through them newest first, then through the first command; a redo forwards.
   */
  joined?: HistoryStep[]
}

/** The copies around one command of an undo step (the step's first command is the entry itself). */
type HistoryStep = { before: CompositionDocument | null; after: CompositionDocument | null }

/** Every command of a step, oldest first. */
const stepsOf = (entry: HistoryEntry): HistoryStep[] => (entry.joined && entry.joined.length > 0 ? [entry, ...entry.joined] : [entry])

/** The editor drew every command of the step, so it can draw the step's undo and redo itself. */
const drawable = (entry: HistoryEntry): boolean => stepsOf(entry).every((step) => step.before !== null && step.after !== null)

/** The most undo / redo steps the editor keeps track of itself (the server keeps 100 groups per user and project). */
const HISTORY_LIMIT = 100

type CommandWrite = {
  kind: 'command'
  specs: readonly CompositionOpSpec[]
  options: SparkApplyOptions
  resolve: (applied: boolean) => void
  /** Spark undo / redo: the command's undo group as this editor's history knows it. */
  entry: HistoryEntry
  /**
   * The copies around THIS command: the entry itself for the step's first command, its own step in `entry.joined` for a
   * command that joined the step (timeline v3).
   */
  step: HistoryStep
  /** Timeline v3: the command joined the step of an earlier command (`SparkApplyOptions.joinUndoGroup`). */
  joins: boolean
  /** Timeline v3: the step's `undo_group_id`, fixed when a handle names the step (null: one is made at the first send). */
  groupId: string | null
  /** E1-N: the ops can be applied to the editor's own copy (and no undo / redo the editor cannot predict is ahead). */
  eligible: boolean
  /** E1-N: applied on top of the server copy right now (what the editor draws includes it). */
  local: boolean
  /** Fixed at the first send so a retry after a lost answer is the same command (idempotent). */
  keys: { idempotency: string; undoGroup: string } | null
  /**
   * E1-N review: the whole command as first sent, with the revisions it was built on. A retry after a pause resends it
   * unchanged: the gateway's idempotency fingerprint covers `base_revision` and the read set, so a body rebuilt on a newer
   * re-read would be refused as a different request even though the first one may have landed.
   */
  sent: { body: CompositionCommandBody; index: CompositionRevIndex } | null
  /** The working copy version the server gave this command; it is in the server's copy once a read reaches it. */
  receiptVersion: number | null
}
/**
 * Spark undo / redo in the same write queue as the commands (so it runs after the edits made before it). `entry` is the group the
 * editor expects on top of the server's stack (sent as `undo_group_id`); null: the editor does not know it (e.g. right after
 * loading), and the server's newest group is undone. `eligible`: the editor drew the result at once (instant undo / redo).
 */
type HistoryWrite = {
  kind: 'undo' | 'redo'
  resolve: (applied: boolean) => void
  entry: HistoryEntry | null
  eligible: boolean
  local: boolean
  /** Fixed at the first send so a retry after a lost answer is the same request (idempotent). */
  key: string | null
  receiptVersion: number | null
}
type QueuedWrite = CommandWrite | HistoryWrite

type SendResult = 'ok' | 'failed' | 'paused'

/**
 * Editor state of one Spark project backed by the Composition working copy. The server is the
 * only source of truth: every write is one composition command built from the state the user saw
 * (or chained from the previous receipt), and the working copy is read back after it. Commands run
 * one at a time in call order from a write queue (Y1-07 W7): a burst of gesture commands is sent
 * without re-reading the document between them, and a newer command with the same `coalesceKey`
 * replaces one that has not been sent yet. A conflict or a refused write reloads the server state,
 * raises a notice and drops the commands queued behind it. Product data is never cached in browser
 * storage. Framework-free so the React editor subscribes with useSyncExternalStore.
 *
 * E1-N optimistic writes (`options.optimistic`): the editor draws the edit the moment it is made. Each typed command is
 * applied to a copy of the server's document (`optimistic/document-ops.ts`, a parity-tested port of the gateway's op
 * application) and published as `workingCopy`; the real command goes through the same CAS queue in the background. The
 * server's copy stays the base of every command. When the server answers, the copy is re-read and replaces the local one;
 * a command the server refuses is rolled back with a notice and the commands behind it are rebased onto the re-read
 * document (those that no longer apply are dropped); a change that cannot reach the server (offline) stays in the queue,
 * the header says "Not saved — retry", and further edits keep working.
 *
 * WP2 receipt-only save: when a receipt confirms exactly the edit the editor applied (applied on the held server copy, the
 * version moved by one, the changed and removed entities with their revs match the local application), the editor's own
 * copy becomes the server copy: no `GET /document`. Such a copy is read back and compared in the background once the editor
 * is idle (and by any `refresh()`, e.g. after an agent job); any other receipt (someone else wrote in between, a replay, a
 * different result) falls back to the full re-read. CAS, conflicts and the rebase of pending edits are unchanged.
 *
 * Spark undo / redo: undo and redo go through the same queue as the commands. The editor remembers the groups it wrote
 * (`undoStack`) and undid (`redoStack`) with the copies around each, so with optimistic writes an undo or redo of its own edit
 * is drawn at once (`optimistic/history-rebase.ts`) and the server is asked for exactly that group (`undo_group_id`): the
 * server refuses when its newest group is another one (another tab, an agent job of this user) or when another edit changed
 * the group's entities since; the editor then rolls the drawn result back, reads the server's copy and says so. A new edit
 * closes the redo stack; a change made elsewhere that a read brings in clears both stacks (the editor no longer knows the top
 * of the user's server-side stack; the next undo is the server's newest group, as before). The result is always read back.
 */
export class SparkCompositionSession implements SparkCompositionActions {
  private state: SparkCompositionState = INITIAL_STATE
  private readonly listeners = new Set<() => void>()
  private readonly transport: CompositionTransport
  private readonly viewPreferences: ViewPreferenceTransport
  /** Orders density saves: only the newest toggle's failure may roll the view back. */
  private densityRequest = 0
  private readonly getProject: typeof getSparkProject
  private readonly createId: () => string
  private readonly optimistic: boolean
  private readonly retryDelays: readonly number[]
  private readonly timers: NonNullable<SparkCompositionSessionOptions['timers']>
  private loadController: AbortController | null = null
  private generation = 0
  private noticeId = 0
  /** Writes stay blocked after the server refused them (403 role, 409 archived). */
  private writeBlocked = false
  /** Writes waiting to be sent (the one in flight is not in here). */
  private queue: QueuedWrite[] = []
  private inFlight = false
  private draining = false
  /** CAS state chained from the last receipt of the current burst; null = build from the held document. */
  private chain: CompositionRevIndex | null = null
  /** What the server last gave the editor (the base of every command); `state.workingCopy` adds the local edits on top. */
  private serverCopy: CompositionWorkingCopy | null = null
  /** The write being sent right now. */
  private sending: QueuedWrite | null = null
  /** Writes the server applied whose result the held server copy does not include yet (no re-read since). */
  private confirmed: QueuedWrite[] = []
  /** The server copy with every unconfirmed local command applied; null when there is nothing to show on top. */
  private overlay: CompositionDocument | null = null
  private localRevision = 0
  /** A command could not reach the server: the queue is paused until a retry. */
  private saveStalled = false
  private retryHandle: unknown = null
  private retryAttempt = 0
  /** E1-N review: the editor went away while edits it drew were still unsent (`close()`); they are sent, nothing is shown. */
  private closed = false
  private onFlushed: (() => void) | null = null
  /** WP2: `serverCopy` was taken from receipts and not read back from the server yet. */
  private adopted = false
  private verifyHandle: unknown = null
  private readonly verifyDelay: number | null
  /** Spark undo / redo: groups this editor wrote (newest last) and groups it undid (most recent last). */
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  /** The newest working copy version whose every write the editor knows (its own receipts, its reads); null before a load. */
  private knownVersion: number | null = null
  private readonly redoEnabled: boolean
  /** Timeline v3: the first command of each named undo step (`SparkApplyOptions.undoGroup`). */
  private readonly undoGroups = new WeakMap<SparkUndoGroup, CommandWrite>()

  constructor(private readonly options: SparkCompositionSessionOptions) {
    this.transport = options.transport ?? compositionGatewayTransport
    this.viewPreferences = options.viewPreferences ?? viewPreferenceGatewayTransport
    this.getProject = options.getProject ?? getSparkProject
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.optimistic = options.optimistic === true
    this.retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
    this.verifyDelay = options.verifyDelayMs === undefined ? DEFAULT_VERIFY_DELAY_MS : options.verifyDelayMs
    this.redoEnabled = options.redo === true && typeof this.transport.redo === 'function'
    this.timers = options.timers ?? {
      setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
      clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    }
    // Actions are handed to components as plain callbacks.
    this.load = this.load.bind(this)
    this.abort = this.abort.bind(this)
    this.close = this.close.bind(this)
    this.select = this.select.bind(this)
    this.addScene = this.addScene.bind(this)
    this.removeScene = this.removeScene.bind(this)
    this.moveScene = this.moveScene.bind(this)
    this.removeSceneMusic = this.removeSceneMusic.bind(this)
    this.removeCaptions = this.removeCaptions.bind(this)
    this.apply = this.apply.bind(this)
    this.refresh = this.refresh.bind(this)
    this.adoptAttachedSource = this.adoptAttachedSource.bind(this)
    this.retrySave = this.retrySave.bind(this)
    this.undo = this.undo.bind(this)
    this.redo = this.redo.bind(this)
    this.setTimelineDensity = this.setTimelineDensity.bind(this)
    this.insertSourceClip = this.insertSourceClip.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** Reads the project and its working copy together; the editor shows a spinner until both arrive. */
  async load(): Promise<void> {
    this.abort()
    const generation = this.generation
    const controller = new AbortController()
    this.loadController = controller
    this.writeBlocked = false
    this.resetPending()
    this.set({ ...INITIAL_STATE, optimistic: this.optimistic, redoEnabled: this.redoEnabled })
    try {
      // E1-N review: an editor of this project that just closed may still be sending edits its user saw; read after them.
      const flushing = closingFlushes.get(this.options.projectId)
      if (flushing) {
        let wait: unknown = null
        await Promise.race([flushing, new Promise<void>((resolve) => {
          wait = this.timers.setTimeout(resolve, CLOSING_FLUSH_WAIT_MS)
        })])
        this.timers.clearTimeout(wait)
        if (generation !== this.generation) return
      }
      const [project, workingCopy, timelineDensity] = await Promise.all([
        // The project header read takes the same gateway read path as the working copy (P02-15), so it gets the
        // same bounded retry while the gateway answers a retryable replica-lag 503 (never a 404).
        withReplicaLagRetry(() => this.getProject(this.options.projectId, { signal: controller.signal }), {
          signal: controller.signal,
        }),
        this.transport.getWorkingCopy(this.options.projectId, { signal: controller.signal }),
        // A missing or failed preference read opens with the default view; it never blocks the editor.
        this.viewPreferences.get(this.options.projectId, { signal: controller.signal }).catch(() => null),
      ])
      if (generation !== this.generation) return
      if (project.lifecycleState && project.lifecycleState !== 'active') this.writeBlocked = true
      this.serverCopy = workingCopy
      this.knownVersion = workingCopy.workingCopyVersion
      this.set({
        ...INITIAL_STATE,
        optimistic: this.optimistic,
        redoEnabled: this.redoEnabled,
        status: 'ready',
        project,
        workingCopy,
        readOnly: this.isReadOnly(workingCopy),
        selectedSceneId: orderedScenes(workingCopy.document)[0]?.scene_id ?? null,
        timelineDensity,
      })
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return
      const missing = error instanceof AuthClientError && (error.status === 404 || error.status === 403)
      this.set({ ...INITIAL_STATE, optimistic: this.optimistic, redoEnabled: this.redoEnabled, status: missing ? 'not_found' : 'error' })
    } finally {
      if (this.loadController === controller) this.loadController = null
    }
  }

  /** Drops in-flight reads, queued writes and every late result (a reload; the editor page leaves through `close()`). */
  abort(): void {
    this.generation += 1
    this.loadController?.abort()
    this.loadController = null
    this.dropQueue()
    this.chain = null
    this.resetPending()
  }

  /**
   * E1-N review: the editor page went away (in-app navigation or unmount; `beforeunload` covers only closing the tab).
   * Without optimistic writes, or with nothing left to send, this is `abort()`. With optimistic writes the user already saw
   * every queued edit on the canvas, so the queue is still sent in call order with its keys; reads stop and nothing is
   * published any more. A paused queue (offline) is tried once more and then given up; a closed editor never keeps
   * retrying in the background. A new editor of the same project reads the working copy only after this has ended.
   */
  close(): void {
    const unsent = this.optimistic && this.state.status === 'ready' && !this.writeBlocked && this.pendingCount() > 0
    if (!unsent) {
      this.abort()
      return
    }
    this.closed = true
    this.loadController?.abort()
    this.loadController = null
    this.clearRetryTimer()
    this.clearVerifyTimer()
    const projectId = this.options.projectId
    const flushed = new Promise<void>((resolve) => {
      this.onFlushed = resolve
    })
    closingFlushes.set(projectId, flushed)
    void flushed.then(() => {
      if (closingFlushes.get(projectId) === flushed) closingFlushes.delete(projectId)
    })
    // A drain that is running goes on and settles the flush when it ends.
    if (this.saveStalled) void this.retrySave()
    else void this.drain()
  }

  /** A closed editor's flush has ended: everything was sent, or the server stayed unreachable after the last try. */
  private settleClosed(): void {
    if (!this.closed || this.inFlight || (this.queue.length > 0 && !this.saveStalled)) return
    this.clearRetryTimer()
    for (const item of this.queue.splice(0)) item.resolve(false)
    const done = this.onFlushed
    this.onFlushed = null
    done?.()
  }

  select(sceneId: string | null): void {
    const workingCopy = this.state.workingCopy
    if (sceneId !== null && !workingCopy?.document.scenes.some((scene) => scene.scene_id === sceneId)) return
    if (this.state.selectedSceneId === sceneId) return
    this.set({ ...this.state, selectedSceneId: sceneId })
  }

  /**
   * Adds an empty fixed scene after the selected one (at the start when nothing is selected). Timeline v3: the new scene
   * joins the chapter of the scene it follows (the first scene's when it goes first), so it never lands outside a chapter.
   */
  async addScene(): Promise<void> {
    const workingCopy = this.state.workingCopy
    if (!workingCopy) return
    // P06-03: a template-bound project adds scenes from its template (the server refuses a plain insert too).
    if (sparkAddSceneMode(workingCopy.document) !== 'freeform') return
    const sceneId = newSceneId(this.createId())
    const document = workingCopy.document
    const neighbourId = this.state.selectedSceneId ?? document.scene_sequence.scene_ids[0] ?? null
    const neighbourSection = neighbourId ? (document.scenes.find((scene) => scene.scene_id === neighbourId)?.section_id ?? null) : null
    const sectionId = neighbourSection !== null && document.sections.some((section) => section.section_id === neighbourSection) ? neighbourSection : null
    const spec = sceneInsertSpec({
      sceneId,
      afterSceneId: this.state.selectedSceneId,
      durationFrames: framesForSeconds(document, NEW_SCENE_SECONDS),
      sectionId,
    })
    // E1-N: with optimistic writes the new scene is in the copy at once, so it is picked at once.
    await this.apply([spec], {
      dropWhileBusy: true,
      onOptimistic: () => this.select(sceneId),
      // Picked again when the server answers only if it was not picked already: the user may have moved on meanwhile.
      onApplied: () => {
        if (!this.optimistic) this.select(sceneId)
      },
    })
  }

  async removeScene(sceneId: string): Promise<void> {
    const workingCopy = this.state.workingCopy
    if (!workingCopy) return
    if (!workingCopy.document.scene_sequence.scene_ids.includes(sceneId)) return
    // The reload keeps the selection on the scene that takes the deleted one's place.
    await this.apply([sceneRemoveSpec(sceneId)], {
      dropWhileBusy: true,
      onOptimistic: () => this.notify('sceneDeleted'),
      onApplied: () => {
        if (!this.optimistic) this.notify('sceneDeleted')
      },
    })
  }

  /** Moves a scene right after `afterSceneId` (`null` = first). */
  async moveScene(sceneId: string, afterSceneId: string | null): Promise<void> {
    const workingCopy = this.state.workingCopy
    if (!workingCopy || sceneId === afterSceneId) return
    const order = workingCopy.document.scene_sequence.scene_ids
    const from = order.indexOf(sceneId)
    if (from < 0) return
    const previous = from > 0 ? order[from - 1] : null
    if (previous === afterSceneId) return
    const announce = () => {
      const position = this.state.workingCopy?.document.scene_sequence.scene_ids.indexOf(sceneId) ?? -1
      if (position >= 0) this.notify('sceneMoved', { position: position + 1 })
    }
    await this.apply([sceneReorderSpec(sceneId, afterSceneId)], {
      dropWhileBusy: true,
      onOptimistic: announce,
      onApplied: () => {
        if (!this.optimistic) announce()
      },
    })
  }

  async removeSceneMusic(sceneId: string): Promise<void> {
    const document = this.state.workingCopy?.document
    const scene = document?.scenes.find((candidate) => candidate.scene_id === sceneId)
    if (!document || !scene) return
    const { scenePlacementIds } = sceneMusic(document, scene)
    if (scenePlacementIds.length === 0) return
    await this.apply(scenePlacementIds.map((id) => audioRemoveSpec(id)), {
      dropWhileBusy: true,
      onOptimistic: () => this.notify('musicRemoved'),
      onApplied: () => {
        if (!this.optimistic) this.notify('musicRemoved')
      },
    })
  }

  async removeCaptions(): Promise<void> {
    const document = this.state.workingCopy?.document
    if (!document) return
    const trackIds = captionTrackIds(document)
    if (trackIds.length === 0) return
    await this.apply(trackIds.map((id) => captionTrackRemoveSpec(id)), {
      dropWhileBusy: true,
      onApplied: () => this.notify('captionsRemoved'),
    })
  }

  /**
   * Queues typed ops as one recorded command (one undo group). The generic entry for typed edit
   * builders (P02-06): callers pass `CompositionOpSpec`s, this adds CAS, idempotency and undo.
   * Commands are sent strictly one at a time in call order; see `SparkApplyOptions`.
   */
  apply(specs: readonly CompositionOpSpec[], options: SparkApplyOptions = {}): Promise<boolean> {
    const workingCopy = this.state.workingCopy
    if (this.state.status !== 'ready' || !workingCopy || this.state.readOnly) return Promise.resolve(false)
    if (options.joinUndoGroup) {
      const leader = this.undoGroups.get(options.joinUndoGroup)
      return leader ? this.applyJoined(leader, specs, options) : Promise.resolve(false)
    }
    if (!this.optimistic && options.dropWhileBusy && this.pendingCount() > 0) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const entry: HistoryEntry = { undoGroupId: null, before: null, after: null }
      const item: CommandWrite = {
        kind: 'command',
        specs,
        options,
        resolve,
        entry,
        step: entry,
        joins: false,
        groupId: options.undoGroup ? `ug_${this.createId()}` : null,
        // A write behind a queued undo / redo the editor cannot predict waits for the server (that undo changes the copy).
        eligible: this.optimistic && !this.hasPendingUnpredicted() && canApplyLocally(specs.map((spec) => spec.op)),
        local: false,
        keys: null,
        sent: null,
        receiptVersion: null,
      }
      if (options.undoGroup) this.undoGroups.set(options.undoGroup, item)
      const key = options.coalesceKey
      // Only a command that was never sent may be replaced: a paused one (E1-N, kept at the head with its keys) may already
      // be on the server, so it is resent as it is and the newer edit queues behind it. Never across a queued undo / redo:
      // that undo is about the command before it, and the merged command would land after it.
      let floor = -1
      this.queue.forEach((queued, index) => {
        if (queued.kind !== 'command') floor = index
      })
      // A command of a named undo step (timeline v3) is never replaced: a later command may join its step.
      const replaced = key === undefined
        ? -1
        : this.queue.findIndex((queued, index) => index > floor && queued.kind === 'command' && queued.keys === null && queued.groupId === null && queued.options.coalesceKey === key)
      if (replaced >= 0) {
        // The newer command supersedes the older one: it goes to the end of the line (a command queued in between may
        // have been built from the older state, and the latest edit must be applied last) and carries the older
        // command's other fields (T1R-11); the replaced one never reaches the server. One gesture stays one undo step.
        const old = this.queue[replaced] as CommandWrite
        this.queue.splice(replaced, 1)
        item.specs = mergeCoalescedSpecs(old.specs, specs)
        // The merged ops decide whether the editor can draw the command itself (E1-N).
        item.eligible = item.eligible && canApplyLocally(item.specs.map((spec) => spec.op))
        this.queue.push(item)
        this.undoStack = this.undoStack.filter((entry) => entry !== old.entry)
        old.resolve(false)
      } else {
        this.queue.push(item)
      }
      // One command is one undo group; a new edit closes the redo stack (the server does the same when it lands).
      this.undoStack.push(item.entry)
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.splice(0, this.undoStack.length - HISTORY_LIMIT)
      this.redoStack = []
      if (item.eligible) {
        if (replaced >= 0) this.recomputeOverlay()
        else this.applyOnTop(item)
      } else if (replaced >= 0 && this.overlay) {
        this.recomputeOverlay()
      }
      this.publishPending()
      // The edit is in the copy the editor draws before anything is sent.
      if (item.local) item.options.onOptimistic?.({ localRevision: this.localRevision })
      void this.drain()
    })
  }

  /**
   * Timeline v3: a command that joins the undo step `leader` opened (`SparkApplyOptions.joinUndoGroup`). Only while that step is
   * still the newest of this editor: the server appends a command only to the actor's newest open group, and an edit made
   * after the step must never be folded into it (nor overwritten by it). Same queue, same local drawing as any command; the
   * step keeps one place on the undo stack and the redo stack stays as the step's first command left it.
   */
  private applyJoined(leader: CommandWrite, specs: readonly CompositionOpSpec[], options: SparkApplyOptions): Promise<boolean> {
    const entry = leader.entry
    if (this.undoStack[this.undoStack.length - 1] !== entry || leader.groupId === null) return Promise.resolve(false)
    const own: SparkApplyOptions = { ...options }
    delete own.coalesceKey
    delete own.dropWhileBusy
    delete own.undoGroup
    return new Promise<boolean>((resolve) => {
      const step: HistoryStep = { before: null, after: null }
      entry.joined = [...(entry.joined ?? []), step]
      const item: CommandWrite = {
        kind: 'command',
        specs,
        options: own,
        resolve,
        entry,
        step,
        joins: true,
        groupId: leader.groupId,
        eligible: this.optimistic && !this.hasPendingUnpredicted() && canApplyLocally(specs.map((spec) => spec.op)),
        local: false,
        keys: null,
        sent: null,
        receiptVersion: null,
      }
      this.queue.push(item)
      if (item.eligible) this.applyOnTop(item)
      this.publishPending()
      if (item.local) item.options.onOptimistic?.({ localRevision: this.localRevision })
      void this.drain()
    })
  }

  /**
   * A command that never landed (refused, dropped) is no undo step. A command that JOINED a step (timeline v3) only leaves
   * that step: the step's other commands stay on the server and on the stack.
   */
  private forgetCommand(item: CommandWrite): void {
    if (!item.joins) {
      this.forgetEntry(item.entry)
      return
    }
    item.entry.joined = (item.entry.joined ?? []).filter((step) => step !== item.step)
  }

  /**
   * Y1-07 W7: re-reads the working copy (ETag + read floor). The floor is the version the session's own last receipt
   * returned, so a lagging replica never hands back an older document. A failed read keeps the held copy.
   */
  async refresh(options: { minVersion?: number } = {}): Promise<void> {
    if (this.state.status !== 'ready') return
    const generation = this.generation
    // WP2: a copy taken from receipts is the floor too (a lagging replica must not answer with an older one).
    const minVersion = options.minVersion ?? this.chain?.baseRevision ?? (this.adopted ? this.serverCopy?.workingCopyVersion : undefined)
    this.set({ ...this.state, refreshing: true })
    try {
      await this.reload(minVersion)
    } catch (error) {
      if (generation !== this.generation) return
      if (classifyCompositionError(error) === 'not_found') {
        this.enterNotFound()
        return
      }
    } finally {
      if (generation === this.generation && this.state.status === 'ready') this.set({ ...this.state, refreshing: false })
    }
  }

  /**
   * WP5a: the server attached a source (`composition.artifact.attach`, state `attached`): its `source_media` entry is the
   * only change of that write (it bumps the version and touches no entity revision), so when the receipt follows the held
   * server copy directly and no write of this editor is pending, the entry joins the held copy and no document is re-read
   * (the media can be placed at once). Anything else (another write in between, a pending write, no entry, the classic
   * session) is the usual conditional re-read from the receipt's version.
   *
   * A copy taken this way is a copy taken from a receipt exactly like a WP2 receipt-only save: it is the read floor, an
   * older read (lagging, or started before the receipt) never replaces it, and it is read back and compared once the
   * editor is idle.
   */
  async adoptAttachedSource(receipt: AttachedSourceReceipt): Promise<void> {
    const server = this.serverCopy
    const entry = receipt.source_media as { source_id?: unknown } | null | undefined
    const sourceId = entry && typeof entry === 'object' && typeof entry.source_id === 'string' ? entry.source_id : null
    // The attach is this editor's own write (no undo group): it is not "a change made elsewhere".
    if (receipt.working_copy_version_before !== undefined) this.noteOwnWrite(receipt.working_copy_version_before, receipt.working_copy_version)
    const direct =
      this.optimistic &&
      this.state.status === 'ready' &&
      server !== null &&
      sourceId !== null &&
      !this.inFlight &&
      this.queue.length === 0 &&
      this.confirmed.length === 0 &&
      !this.saveStalled &&
      receipt.working_copy_version_before === server.workingCopyVersion &&
      receipt.working_copy_version === server.workingCopyVersion + 1 &&
      !server.document.source_media.some((source) => source.source_id === sourceId)
    if (!direct) {
      await this.refresh({ minVersion: receipt.working_copy_version })
      return
    }
    const document = {
      ...server.document,
      working_copy_version: receipt.working_copy_version,
      source_media: [...server.document.source_media, entry as CompositionDocument['source_media'][number]],
    }
    // The held ETag names the older body: the next read is unconditional and replaces this copy with the server's own.
    this.serverCopy = { ...server, workingCopyVersion: receipt.working_copy_version, document, etag: null }
    if (this.chain?.baseRevision === server.workingCopyVersion) this.chain = { ...this.chain, baseRevision: receipt.working_copy_version }
    // WP2: taken from a receipt (read floor, never replaced by an older read, read back when idle).
    this.adopted = true
    this.recomputeOverlay()
    this.publishPending()
    this.scheduleVerify()
  }

  /**
   * E1-N: the header's "Not saved — retry": sends again what could not reach the server (the same command with the same
   * idempotency key, so a command the server did apply is not applied twice). Resolves when the queue is drained again.
   */
  async retrySave(): Promise<void> {
    if (!this.saveStalled) return
    this.clearRetryTimer()
    this.saveStalled = false
    this.publishPending()
    await this.drain()
  }

  /**
   * P02-16: saves the user's compact/expanded choice. The view switches at once; the choice is
   * stored per user and project on the server (no browser storage). It is not a command: nothing is
   * sent to the composition log, the working copy is not re-read, the selection and the saving
   * state stay as they are, and a viewer or an archived project may still choose its view. When the
   * newest save fails the view goes back to what the server holds.
   */
  async setTimelineDensity(density: TimelineDensity): Promise<void> {
    if (this.state.status !== 'ready' || this.state.timelineDensity === density) return
    const generation = this.generation
    const previous = this.state.timelineDensity
    const request = ++this.densityRequest
    this.set({ ...this.state, timelineDensity: density })
    try {
      await this.viewPreferences.save(this.options.projectId, density)
    } catch {
      if (generation !== this.generation || request !== this.densityRequest) return
      this.set({ ...this.state, timelineDensity: previous })
      this.notify('viewNotSaved')
    }
  }

  /**
   * P06-16: the source was bound on the server after the editor loaded (Stock acquisition), so the working copy is read
   * back first; then one recorded command inserts a `follow_media` scene with the clip (one undo group). The clip insert
   * is always this explicit command — acquiring an item never changes the timeline by itself.
   */
  async insertSourceClip(sourceId: string, kind: 'image' | 'video', options: InsertSourceClipOptions = {}): Promise<number | null> {
    if (this.state.status !== 'ready' || this.state.readOnly) return null
    // Timeline v3: with optimistic writes a copy that already holds the source (the attach receipt brought it in) is not
    // read again: the clip is inserted at once.
    const held = this.state.workingCopy?.document
    if (!(this.optimistic && held?.source_media.some((source) => source.source_id === sourceId))) {
      try {
        await this.reload()
      } catch {
        this.notify('saveFailed')
        return null
      }
    }
    const document = this.state.workingCopy?.document
    if (!document) return null
    // The contextual toolbar's cover fit, decided on the copy that holds the source (null: the compiler's fit); the exact fit
    // follows in the same undo step (`settle`).
    const fit = options.fit?.(document) ?? null
    const placement = stockClipPlacement({
      document,
      sourceId,
      kind,
      afterSceneId: this.state.selectedSceneId,
      uuid: this.createId,
      transform: fit?.transform ?? null,
    })
    if (!placement) {
      this.notify('saveFailed')
      return null
    }
    const applying = this.apply(placement.specs, {
      dropWhileBusy: true,
      ...(fit && { undoGroup: fit.undoGroup }),
      onOptimistic: () => {
        this.select(placement.sceneId)
        options.onLocal?.()
      },
      onApplied: () => {
        if (!this.optimistic) this.select(placement.sceneId)
      },
    })
    // The insert was queued (not dropped as a second click): its exact fit may follow in its undo step.
    if (fit && this.undoGroups.has(fit.undoGroup)) fit.settle({ sceneId: placement.sceneId, layerId: placement.layerId })
    const applied = await applying
    if (!applied) return null
    const position = this.state.workingCopy?.document.scene_sequence.scene_ids.indexOf(placement.sceneId) ?? -1
    if (position >= 0) return position + 1
    // The copy catches up after the exact fit queued behind the insert (classic session): the place it was planned at.
    const after = placement.specs[0]?.op['after_scene_id']
    return typeof after === 'string' ? document.scene_sequence.scene_ids.indexOf(after) + 2 : 1
  }

  /**
   * Undoes the caller's newest undo group on the server (persistent across reload and devices, F28), after queued writes.
   * When that group is an edit this editor drew, the undo is drawn at once (optimistic writes) and the server is asked for
   * exactly that group; otherwise the server's newest group is undone and the result read back.
   */
  undo(): Promise<void> {
    if (this.state.status !== 'ready' || this.state.readOnly) return Promise.resolve()
    const entry = this.undoStack.pop() ?? null
    if (entry) this.redoStack.push(entry)
    return this.enqueueHistory('undo', entry)
  }

  /**
   * Spark redo: applies the newest group this editor undid again, after queued writes (drawn at once when the editor drew the
   * edit). Nothing to redo (a new edit closed the stack, or nothing was undone here): says so.
   */
  redo(): Promise<void> {
    if (this.state.status !== 'ready' || this.state.readOnly || !this.redoEnabled) return Promise.resolve()
    const entry = this.redoStack.pop()
    if (!entry) {
      this.notify('nothingToRedo')
      return Promise.resolve()
    }
    this.undoStack.push(entry)
    return this.enqueueHistory('redo', entry)
  }

  private enqueueHistory(kind: HistoryWrite['kind'], entry: HistoryEntry | null): Promise<void> {
    return new Promise<void>((resolve) => {
      const item: HistoryWrite = {
        kind,
        resolve: () => resolve(),
        entry,
        // Drawn at once only for an edit the editor drew itself, and only when nothing ahead waits for the server.
        eligible: this.optimistic && entry !== null && drawable(entry) && !this.hasPendingUnpredicted(),
        local: false,
        key: null,
        receiptVersion: null,
      }
      this.queue.push(item)
      if (item.eligible) this.applyOnTop(item)
      this.publishPending()
      if (item.local) this.notify(kind === 'undo' ? 'undone' : 'redone')
      void this.drain()
    })
  }

  // ------------------------------------------------------------------ optimistic copy (E1-N)

  /** An undo / redo the editor did not draw is queued or being sent: what comes after it cannot be predicted. */
  private hasPendingUnpredicted(): boolean {
    const unpredicted = (write: QueuedWrite | null) => write !== null && write.kind !== 'command' && !write.local
    return unpredicted(this.sending) || this.queue.some(unpredicted)
  }

  /** Writes the editor shows on top of the server copy, oldest first. */
  private localWrites(): QueuedWrite[] {
    return [...this.confirmed, ...(this.sending ? [this.sending] : []), ...this.queue].filter((item) => item.eligible)
  }

  /**
   * One write on top of `document`: a command's ops (its history entry learns the copies around it), or an undo / redo of an
   * entry the editor drew (null when the copy no longer matches that edit in the parts it changed: the server decides then).
   */
  private applyLocal(document: CompositionDocument, item: QueuedWrite): CompositionDocument | null {
    if (item.kind === 'command') {
      const result = applyOpsLocally(document, item.specs.map((spec) => spec.op))
      if (!result.ok) {
        // The editor cannot draw it on this copy any more: its undo waits for the server.
        item.step.before = null
        item.step.after = null
        return null
      }
      item.step.before = document
      item.step.after = result.document
      return result.document
    }
    const entry = item.entry
    if (!entry || !drawable(entry)) return null
    // Timeline v3: a step of several commands moves back through them newest first, and forward oldest first.
    const steps = stepsOf(entry)
    let drawn: CompositionDocument | null = document
    if (item.kind === 'undo') {
      for (let index = steps.length - 1; index >= 0 && drawn; index -= 1) drawn = rebaseDocumentChange(drawn, steps[index]!.after!, steps[index]!.before!)
    } else {
      for (let index = 0; index < steps.length && drawn; index += 1) drawn = rebaseDocumentChange(drawn, steps[index]!.before!, steps[index]!.after!)
    }
    return drawn
  }

  /** Applies a write that was just queued on top of what the editor draws now (no re-derivation of the others). */
  private applyOnTop(item: QueuedWrite): void {
    const base = this.overlay ?? this.serverCopy?.document
    if (!base) return
    const result = this.applyLocal(base, item)
    item.local = result !== null
    if (result) this.setOverlay(result)
  }

  /** Re-derives the overlay from the server copy and every unconfirmed write (a coalesced replace, a re-read, a rollback). */
  private recomputeOverlay(): void {
    const base = this.serverCopy?.document
    if (!base) {
      this.setOverlay(null)
      return
    }
    let document: CompositionDocument = base
    for (const item of this.localWrites()) {
      const result = this.applyLocal(document, item)
      item.local = result !== null
      if (result) document = result
    }
    this.setOverlay(document === base ? null : document)
  }

  /**
   * Spark undo / redo: a command that never landed (refused, dropped, replaced) is no undo step; an undo / redo queued for it
   * is dropped too.
   */
  private forgetEntry(entry: HistoryEntry): void {
    this.undoStack = this.undoStack.filter((candidate) => candidate !== entry)
    this.redoStack = this.redoStack.filter((candidate) => candidate !== entry)
    const dropped = this.queue.filter((queued) => queued.kind !== 'command' && queued.entry === entry)
    if (dropped.length === 0) return
    this.queue = this.queue.filter((queued) => !dropped.includes(queued))
    for (const item of dropped) item.resolve(false)
  }

  /** The editor no longer knows the user's server-side stacks (a change made elsewhere): undo goes to the server's newest. */
  private forgetHistory(): void {
    this.undoStack = []
    this.redoStack = []
  }

  private setOverlay(document: CompositionDocument | null): void {
    if (document === this.overlay) return
    this.overlay = document
    this.localRevision += 1
  }

  /** The copy the editor draws: the server's, or the server's with the local commands on top (one object per change). */
  private displayCopy(): CompositionWorkingCopy | null {
    const server = this.serverCopy
    if (!server) return null
    if (!this.overlay) return server
    const held = this.displayed
    if (held && held.server === server && held.overlay === this.overlay) return held.view
    const view = { ...server, document: this.overlay, localRevision: this.localRevision }
    this.displayed = { server, overlay: this.overlay, view }
    return view
  }

  private displayed: { server: CompositionWorkingCopy; overlay: CompositionDocument; view: CompositionWorkingCopy } | null = null

  /** Access was revoked or the project is gone: nothing is shown and nothing is kept. */
  private enterNotFound(): void {
    this.resetPending()
    this.set({ ...INITIAL_STATE, optimistic: this.optimistic, redoEnabled: this.redoEnabled, status: 'not_found' })
  }

  private resetPending(): void {
    this.serverCopy = null
    this.sending = null
    this.confirmed = []
    this.overlay = null
    this.saveStalled = false
    this.retryAttempt = 0
    this.adopted = false
    this.forgetHistory()
    this.knownVersion = null
    this.clearRetryTimer()
    this.clearVerifyTimer()
  }

  // ------------------------------------------------------------------ write queue

  private pendingCount(): number {
    return this.queue.length + (this.inFlight ? 1 : 0)
  }

  private saveStateNow(): SparkSaveState {
    if (this.saveStalled) return 'error'
    return this.pendingCount() > 0 ? 'saving' : 'saved'
  }

  /** Publishes the pending count, the save state and the copy the editor draws (one state change). */
  private publishPending(): void {
    const pendingWrites = this.pendingCount()
    const saveState = this.saveStateNow()
    const canRedo = this.redoEnabled && this.redoStack.length > 0
    const view = this.displayCopy()
    const copyChanged = view !== this.state.workingCopy
    if (
      !copyChanged &&
      this.state.pendingWrites === pendingWrites &&
      this.state.saving === pendingWrites > 0 &&
      this.state.saveState === saveState &&
      this.state.canRedo === canRedo
    ) return
    if (!copyChanged) {
      this.set({ ...this.state, pendingWrites, saving: pendingWrites > 0, saveState, canRedo })
      return
    }
    this.set({
      ...this.state,
      pendingWrites,
      saving: pendingWrites > 0,
      saveState,
      canRedo,
      workingCopy: view,
      selectedSceneId: this.selectionFor(view?.document ?? null),
    })
  }

  /** Keeps the selected scene when the copy still has it; otherwise the scene that takes its place. */
  private selectionFor(document: CompositionDocument | null): string | null {
    const selected = this.state.selectedSceneId
    if (!document) return selected
    const scenes = orderedScenes(document)
    if (selected && scenes.some((scene) => scene.scene_id === selected)) return selected
    if (scenes.length === 0) return null
    const previous = this.state.workingCopy ? orderedScenes(this.state.workingCopy.document) : []
    const index = selected ? Math.max(previous.findIndex((scene) => scene.scene_id === selected), 0) : 0
    return scenes[Math.min(index, scenes.length - 1)]!.scene_id
  }

  /** Resolves every queued write as not applied (abort, or the commands behind a failure that invalidated them). */
  private dropQueue(): void {
    const dropped = this.queue.splice(0)
    for (const item of dropped) {
      if (item.kind === 'command') this.forgetCommand(item)
      item.resolve(false)
    }
    // A dropped undo / redo never reached the server: the editor no longer knows where its stacks stand.
    if (dropped.some((item) => item.kind !== 'command')) this.forgetHistory()
    if (this.optimistic && dropped.length > 0 && this.serverCopy) this.recomputeOverlay()
  }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    const generation = this.generation
    try {
      while (this.queue.length > 0 && generation === this.generation && !this.saveStalled) {
        const item = this.queue.shift() as QueuedWrite
        this.inFlight = true
        this.sending = item
        this.publishPending()
        const result: SendResult = item.kind === 'command' ? await this.sendCommand(item, generation) : await this.sendHistory(item, generation)
        this.inFlight = false
        if (generation !== this.generation) {
          item.resolve(false)
          break
        }
        if (result === 'paused') {
          // The command stays at the head of the queue (same idempotency key) until a retry reaches the server.
          this.queue.unshift(item)
          this.publishPending()
          break
        }
        if (result === 'failed') {
          this.sending = null
          // A refused edit is no undo step (its undo / redo queued behind it goes too).
          if (item.kind === 'command') this.forgetCommand(item)
          if (this.optimistic && !this.writeBlocked && this.state.status === 'ready') {
            // The edit was rolled back and the server's copy re-read: the commands behind it are rebased onto it.
            this.rebaseQueue()
          } else {
            // A failed write reloaded the server state; commands queued behind it were built on the old one.
            this.dropQueue()
          }
        }
        // The pending count is published BEFORE the caller's promise resolves: `await apply()` sees `saving` settled.
        this.publishPending()
        item.resolve(result === 'ok')
        if (result === 'failed' && !(this.optimistic && !this.writeBlocked && this.state.status === 'ready')) break
      }
    } finally {
      this.inFlight = false
      this.draining = false
      this.chain = this.queue.length === 0 && this.confirmed.length === 0 ? null : this.chain
      if (generation === this.generation) this.publishPending()
      this.settleClosed()
    }
  }

  /** After a refused write: keeps the queued commands that still apply to the re-read copy, drops the rest. */
  private rebaseQueue(): void {
    const base = this.serverCopy?.document
    if (!base) {
      this.dropQueue()
      return
    }
    let document: CompositionDocument = base
    for (const item of this.confirmed) {
      const result = this.applyLocal(document, item)
      if (result) document = result
    }
    const kept: QueuedWrite[] = []
    const dropped: QueuedWrite[] = []
    for (const queued of this.queue) {
      if (queued.eligible) {
        const result = this.applyLocal(document, queued)
        if (!result) {
          dropped.push(queued)
          continue
        }
        document = result
      }
      kept.push(queued)
    }
    this.queue = kept
    for (const item of dropped) {
      if (item.kind === 'command') this.forgetCommand(item)
      item.resolve(false)
    }
    // An undo / redo the editor drew that no longer fits the server's copy never reached the server: the stacks are unknown.
    if (dropped.some((item) => item.kind !== 'command')) this.forgetHistory()
    this.recomputeOverlay()
  }

  private async sendCommand(item: CommandWrite, generation: number): Promise<SendResult> {
    try {
      const serverCopy = this.serverCopy
      if (!serverCopy) return 'failed'
      if (!item.sent) {
        const built = this.chain ?? compositionRevIndex(serverCopy.document)
        try {
          item.sent = {
            index: built,
            body: {
              ...buildCompositionCommandFrom(built, item.specs),
              // Timeline v3: every command of a named step carries the step's group (the gateway appends it to that group).
              idempotency_key: (item.keys ??= { idempotency: `ui_${this.createId()}`, undoGroup: item.groupId ?? `ug_${this.createId()}` }).idempotency,
              undo_policy: 'recorded',
              undo_group_id: item.keys.undoGroup,
            },
          }
          // Spark undo / redo: an undo of this command (queued after it) names this group.
          item.entry.undoGroupId = item.keys.undoGroup
        } catch (error) {
          if (!(error instanceof CompositionStaleReadError)) throw error
          this.chain = null
          this.sending = null
          await this.reload()
          this.notify('conflict')
          return 'failed'
        }
      }
      const { body, index } = item.sent
      const receipt = await this.withRetry(() => this.transport.executeCommand(this.options.projectId, body))
      if (generation !== this.generation) return 'failed'
      item.receiptVersion = receipt.working_copy_version
      this.confirm(item)
      this.noteReached()
      this.noteOwnWrite(receipt.working_copy_version_before, receipt.working_copy_version)
      if (receipt.working_copy_version !== index.baseRevision + 1) {
        // Someone else wrote in between (rebased): the chained revs cannot be trusted, read the server state.
        this.chain = null
        await this.catchUp(receipt.working_copy_version)
      } else {
        this.chain = chainCompositionRevIndex(index, receipt)
        if (this.adoptReceipt(item, receipt, index)) {
          // WP2: the receipt confirmed the very edit the editor drew: its copy is the server's, nothing is read back now.
          this.publishPending()
        } else if (this.queue.length === 0) {
          // Nothing more queued: catch the document up before `onApplied` (new layers/scenes exist for the caller).
          if (await this.catchUp(receipt.working_copy_version)) this.chain = null
        }
      }
      item.options.onApplied?.(receipt)
      return 'ok'
    } catch (error) {
      if (generation !== this.generation) return 'failed'
      const kind = classifyCompositionError(error)
      if (this.optimistic && item.receiptVersion === null && this.isTransient(error, kind)) {
        this.stall()
        return 'paused'
      }
      this.chain = null
      this.sending = null
      await this.recover(kind, motionRefusalOf(error))
      return 'failed'
    }
  }

  /**
   * WP2: takes the server's copy after `item` from its receipt instead of reading it: only when the command was applied on
   * exactly the copy the editor holds (`applied`, version moved by one from it) and applying the same ops to that copy here
   * gives exactly the entities and revs the receipt names. The result is the gateway's document by the op parity tests; it
   * is read back and compared when the editor is idle (`scheduleVerify`). false: the caller reads the server's copy.
   */
  private adoptReceipt(item: CommandWrite, receipt: CompositionCommandReceipt, index: CompositionRevIndex): boolean {
    const server = this.serverCopy
    if (!this.optimistic || !item.eligible || !item.sent || !server || receipt.outcome !== 'applied') return false
    if (server.workingCopyVersion !== index.baseRevision || receipt.working_copy_version_before !== index.baseRevision || receipt.working_copy_version !== index.baseRevision + 1) return false
    const result = applyOpsLocally(server.document, item.sent.body.ops)
    if (!result.ok || !sameEntities(result.changed, receipt.changed_entities) || !sameEntities(result.removed, receipt.removed_entities)) return false
    const version = receipt.working_copy_version
    // No ETag: the gateway's validator includes access state the editor cannot know; the next read is a full one.
    this.serverCopy = { ...server, workingCopyVersion: version, document: { ...result.document, working_copy_version: version }, etag: null }
    this.adopted = true
    this.confirmed = this.confirmed.filter((confirmed) => (confirmed.receiptVersion ?? Number.POSITIVE_INFINITY) > version)
    this.recomputeOverlay()
    this.scheduleVerify()
    return true
  }

  /** WP2: reads a copy taken from receipts back once the editor is idle (nothing queued, nothing in flight, not paused). */
  private scheduleVerify(): void {
    this.clearVerifyTimer()
    if (this.verifyDelay === null || this.closed) return
    this.verifyHandle = this.timers.setTimeout(() => {
      this.verifyHandle = null
      if (!this.adopted || this.closed || this.state.status !== 'ready') return
      if (this.pendingCount() > 0 || this.saveStalled || this.state.refreshing) {
        this.scheduleVerify()
        return
      }
      void this.refresh()
    }, this.verifyDelay)
  }

  private clearVerifyTimer(): void {
    if (this.verifyHandle !== null) this.timers.clearTimeout(this.verifyHandle)
    this.verifyHandle = null
  }

  /** The server applied the command: from now on it is in the server's copy once a read reaches its version. */
  private confirm(item: QueuedWrite): void {
    if (this.sending === item) this.sending = null
    // Only a write the editor drew locally has anything to drop from the overlay once the server's copy includes it.
    if (this.optimistic && item.eligible) this.confirmed.push(item)
  }

  /**
   * Spark undo / redo: the server answered one of this editor's writes. When something else was written in between (another
   * tab, an agent job, another user), the editor no longer knows the top of the user's server-side stack: it forgets its own.
   */
  private noteOwnWrite(versionBefore: number, version: number): void {
    if (this.knownVersion !== null && versionBefore > this.knownVersion) this.forgetHistory()
    if (this.knownVersion === null || version > this.knownVersion) this.knownVersion = version
  }

  /**
   * The re-read after a receipt. The command IS applied on the server, so a failed read must never turn it into a failure
   * (T1R-9: a caller that sees `false` repeats the command, and a recorded take would land twice). The document catches up
   * with the next read, which is started in the background here; the chained revisions stay valid meanwhile (E1-N), so
   * the caller keeps its chain when this answers false.
   */
  private async catchUp(minVersion: number): Promise<boolean> {
    try {
      await this.reload(minVersion)
      return true
    } catch {
      void this.refresh({ minVersion })
      return false
    }
  }

  /**
   * A lost connection, a timeout or a gateway/upstream outage (502/503/504) is waited out. Any other server error (a 500
   * from a bug on this document, say) would fail the same way on every retry and hold every later edit behind it, so it
   * takes the normal failure path: that one edit is rolled back with a notice and the queue behind it goes on.
   */
  private isTransient(error: unknown, kind: CompositionFailureKind): boolean {
    if (kind === 'unknown_outcome') return true
    return error instanceof AuthClientError && TRANSIENT_STATUSES.has(error.status)
  }

  /** A command could not reach the server: keep it, say so, retry on a timer (and on the header's button). */
  private stall(): void {
    const first = !this.saveStalled
    this.saveStalled = true
    this.sending = null
    this.scheduleRetry()
    if (first) this.notify('saveStalled')
  }

  private scheduleRetry(): void {
    this.clearRetryTimer()
    if (this.closed) return
    const delay = this.retryDelays[this.retryAttempt] ?? (this.retryDelays.length > 0 ? RETRY_REPEAT_MS : null)
    if (delay === null) return
    this.retryAttempt += 1
    this.retryHandle = this.timers.setTimeout(() => {
      this.retryHandle = null
      void this.retrySave()
    }, delay)
  }

  private clearRetryTimer(): void {
    if (this.retryHandle !== null) this.timers.clearTimeout(this.retryHandle)
    this.retryHandle = null
  }

  /** The server answered again: the next stall starts the retry schedule from the beginning. */
  private noteReached(): void {
    this.retryAttempt = 0
  }

  /**
   * Sends an undo or redo (the expected group when the editor knows it) and reads the server's result back: the server's copy
   * replaces what the editor drew (its revisions are the real ones). A refusal rolls the drawn result back with a notice; a
   * lost connection keeps it queued with its key (optimistic writes), like a command.
   */
  private async sendHistory(item: HistoryWrite, generation: number): Promise<SendResult> {
    const redo = item.kind === 'redo'
    try {
      const send = redo ? this.transport.redo : this.transport.undo
      if (!send) throw new Error('This transport has no redo')
      const key = (item.key ??= `${item.kind}_${this.createId()}`)
      const expected = item.entry?.undoGroupId ?? null
      const body = { idempotency_key: key, ...(expected !== null && { undo_group_id: expected }) }
      const receipt = await this.withRetry<CompositionUndoReceipt | CompositionRedoReceipt>(() => send(this.options.projectId, body))
      if (generation !== this.generation) return 'failed'
      this.chain = null
      this.noteReached()
      if (receipt.outcome === 'nothing_to_undo' || receipt.outcome === 'nothing_to_redo') {
        // Only without an expected group: the server holds nothing (more) to undo / redo for this user.
        this.sending = null
        if (this.knownVersion !== null && receipt.working_copy_version > this.knownVersion) {
          this.forgetHistory()
          this.knownVersion = receipt.working_copy_version
        }
        this.notify(redo ? 'nothingToRedo' : 'nothingToUndo')
        return 'ok'
      }
      item.receiptVersion = receipt.working_copy_version
      this.confirm(item)
      if (item.entry) {
        // The server undid / redid exactly the group the editor expected: no group of this user was opened elsewhere since,
        // so a write in between was someone else's and the editor's stacks still hold.
        if (this.knownVersion === null || receipt.working_copy_version > this.knownVersion) this.knownVersion = receipt.working_copy_version
      } else {
        this.noteOwnWrite(receipt.working_copy_version - 1, receipt.working_copy_version)
      }
      // An undo of a group the editor did not know (e.g. from before a reload) can still be redone from here.
      if (!item.entry && !redo && receipt.undo_group_id && this.redoEnabled) {
        this.redoStack.push({ undoGroupId: receipt.undo_group_id, before: null, after: null })
      }
      this.publishPending()
      await this.catchUp(receipt.working_copy_version)
      if (!item.local) this.notify(redo ? 'redone' : 'undone')
      return 'ok'
    } catch (error) {
      if (generation !== this.generation) return 'failed'
      let kind = classifyCompositionError(error)
      if (this.optimistic && item.receiptVersion === null && this.isTransient(error, kind)) {
        this.stall()
        return 'paused'
      }
      this.chain = null
      this.sending = null
      if (compositionHistoryStackChanged(error)) {
        // Another tab or an agent job of this user wrote a newer group (or closed the redo stack): the editor's stacks are stale.
        this.forgetHistory()
        await this.recover('history_changed')
        return 'failed'
      }
      if (item.entry) {
        // A conflict closed the group on the server; any other refusal leaves the editor unsure where its stacks stand.
        if (kind === 'undo_conflict' || kind === 'redo_conflict') this.forgetEntry(item.entry)
        else this.forgetHistory()
      }
      // No redo route on this gateway (a 404 without the project's own code) is a failed write, never "project not found".
      if (redo && kind === 'not_found' && !(error instanceof AuthClientError && error.code === 'COMPOSITION_PROJECT_NOT_FOUND')) kind = 'failed'
      await this.recover(kind)
      return 'failed'
    }
  }

  /** A lost response may still have been applied: retry once with the same idempotency key. */
  private async withRetry<T>(send: () => Promise<T>): Promise<T> {
    try {
      return await send()
    } catch (error) {
      if (classifyCompositionError(error) !== 'unknown_outcome') throw error
      return send()
    }
  }

  private async recover(kind: CompositionFailureKind | 'history_changed', motionRefusal: MotionRefusalReason | null = null): Promise<void> {
    if (kind === 'not_found') {
      this.enterNotFound()
      return
    }
    if (kind === 'forbidden' || kind === 'not_active') this.writeBlocked = true
    const reloaded = await this.reload().then(
      () => true,
      (error: unknown) => {
        if (classifyCompositionError(error) === 'not_found') {
          this.enterNotFound()
          return null
        }
        return false
      },
    )
    if (reloaded === null) return
    if (kind === 'conflict') this.notify(reloaded ? 'conflict' : 'saveFailed')
    else if (kind === 'undo_conflict') this.notify(reloaded ? 'undoConflict' : 'saveFailed')
    else if (kind === 'redo_conflict') this.notify(reloaded ? 'redoConflict' : 'saveFailed')
    else if (kind === 'history_changed') this.notify(reloaded ? 'historyChanged' : 'saveFailed')
    else if (kind === 'forbidden') this.notify('forbidden')
    else if (kind === 'not_active') this.notify('notActive')
    // WP4: a refused Motion write says why (an energy the Motion does not offer, a private revision, ...).
    else if (motionRefusal) this.notify('motionRefused', undefined, motionRefusal)
    else this.notify('saveFailed')
  }

  /**
   * Reads the server's working copy and keeps the selection when the scene still exists.
   * `minVersion` is the P02-15 read floor after the editor's own write (read-your-writes). The
   * copy the editor holds is revalidated with its ETag: when nothing changed (same version, role
   * and access) the gateway answers 304 and the held copy stays, without a document body.
   * With optimistic writes the commands the read includes leave the overlay, and the ones it does not are applied on
   * top of the new server copy again.
   */
  private async reload(minVersion?: number): Promise<void> {
    const generation = this.generation
    const held = this.serverCopy ?? this.state.workingCopy
    const workingCopy = await this.transport.getWorkingCopy(this.options.projectId, {
      ...(minVersion !== undefined && { minVersion }),
      ...(held && { revalidate: held }),
    })
    if (generation !== this.generation) return
    // Read now, not before the request: a receipt may have been taken meanwhile.
    const adopted = this.adopted ? this.serverCopy : null
    if (adopted) {
      // WP2: a copy taken from receipts is never replaced by an older one (a lagging read, or a read that started before
      // the receipt): the commands it confirmed are in no other copy the editor holds. It is checked again later.
      if (workingCopy.workingCopyVersion < adopted.workingCopyVersion) {
        this.scheduleVerify()
        return
      }
      if (workingCopy.workingCopyVersion === adopted.workingCopyVersion && canonicalJson(workingCopy.document) !== canonicalJson(adopted.document)) {
        // The editor's copy and the server's differ for the same version (a parity bug of the local op port): the server's wins.
        if (this.options.onReceiptMismatch) this.options.onReceiptMismatch({ workingCopyVersion: workingCopy.workingCopyVersion })
        else console.warn(`[spark] the copy taken from the receipt of version ${workingCopy.workingCopyVersion} differs from the server's; the server's copy is used`)
      }
    }
    this.adopted = false
    this.clearVerifyTimer()
    this.serverCopy = workingCopy
    // Spark undo / redo: a copy with writes the editor did not make (another tab, an agent job, another user) leaves it unsure
    // of the top of the user's server-side stack: the next undo is the server's newest group again, redo starts over.
    const readVersion = workingCopy.workingCopyVersion
    if (this.knownVersion === null) this.knownVersion = readVersion
    else if (readVersion > this.knownVersion && !this.awaitsOwnWrite(readVersion)) {
      this.forgetHistory()
      this.knownVersion = readVersion
    }
    if (this.optimistic) {
      // The server's copy at this version already holds every command with a receipt up to it.
      this.confirmed = this.confirmed.filter((item) => (item.receiptVersion ?? Number.POSITIVE_INFINITY) > workingCopy.workingCopyVersion)
      this.recomputeOverlay()
    }
    const display = this.displayCopy() ?? workingCopy
    const selectedSceneId = this.selectionFor(display.document)
    this.set({ ...this.state, workingCopy: display, readOnly: this.isReadOnly(workingCopy), selectedSceneId, canRedo: this.redoEnabled && this.redoStack.length > 0 })
  }

  /**
   * A read may already include a write of this editor whose answer has not arrived (in flight, or its answer was lost): the
   * versions up to the newest one it can explain are not someone else's.
   */
  private awaitsOwnWrite(version: number): boolean {
    const sending = this.sending
    if (this.knownVersion === null || !sending || sending.receiptVersion !== null) return false
    return version === this.knownVersion + 1
  }

  private isReadOnly(workingCopy: CompositionWorkingCopy): boolean {
    return this.writeBlocked || workingCopy.role === 'viewer'
  }

  private notify(kind: SparkNoticeKind, values?: Record<string, number>, reason?: MotionRefusalReason): void {
    this.noticeId += 1
    this.set({ ...this.state, notice: { id: this.noticeId, kind, ...(values && { values }), ...(reason && { reason }) } })
  }

  private set(next: SparkCompositionState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

/** WP2: the same entities (kind, id and, for changed ones, rev), in any order. */
function sameEntities(
  local: ReadonlyArray<{ entity_kind: string; entity_id: string; entity_rev?: number }>,
  receipt: ReadonlyArray<{ entity_kind: string; entity_id: string; entity_rev?: number }>,
): boolean {
  if (local.length !== receipt.length) return false
  const keyOf = (entity: { entity_kind: string; entity_id: string; entity_rev?: number }) => `${entity.entity_kind}:${entity.entity_id}:${entity.entity_rev ?? ''}`
  const keys = new Set(local.map(keyOf))
  return keys.size === local.length && receipt.every((entity) => keys.has(keyOf(entity)))
}

export function createSparkCompositionSession(options: SparkCompositionSessionOptions) {
  return new SparkCompositionSession(options)
}
