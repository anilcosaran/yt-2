import type { CompositionDocument, CompositionOpSpec } from './composition-client'
import { textSetSpec } from './composition-typed-edits'
import {
  SPARK_QUICK_AI_INSTRUCTION_MAX_CHARS,
  SPARK_QUICK_AI_TEXT_MAX_CHARS,
  SparkQuickAiRejectedError,
  approveSparkQuickAiSession,
  streamSparkQuickAi,
  type SparkQuickAiEvent,
  type SparkQuickAiSuggestion,
  type SparkQuickAiTextRewriteRequest,
} from './quick-ai-client'
import { textLayerView, type SparkElementSelection } from './spark-selection'

/**
 * QA-068 Spark quick AI suggestions (P03-24 lane B in the editor). "Rewrite with AI" / "Ask AI about this" on a
 * text layer asks the quick lane for a rewrite; the answer becomes one `wand` card with a before/after diff in the
 * right panel's Assistant tab. "Apply" sends the suggestion's `text.set` draft through the editor's normal
 * Composition command path (CAS + one undo group, so Ctrl+Z undoes it); "Dismiss" drops the card. Nothing is
 * applied without the user's click and nothing is kept in browser storage. Framework-free so the editor subscribes
 * with useSyncExternalStore and tests drive it without a DOM.
 */

export type SparkQuickAiCardStatus =
  | 'running'
  | 'ready'
  | 'applying'
  | 'applied'
  | 'stale'
  | 'failed'
  | 'approval_required'
  | 'funding_required'
  | 'handoff'

export type SparkQuickAiCard = {
  /** The request's idempotency key: a retry or the resend after the session approval never charges twice. */
  id: string
  /** Position in the Assistant tab among this editor session's entries (shared counter, no clock). */
  seq: number
  target: SparkElementSelection
  sceneNumber: number
  /** The text the suggestion was made for; Apply refuses when the layer no longer shows it. */
  before: string
  instruction: string | null
  baseRevision: number
  status: SparkQuickAiCardStatus
  after: string | null
  summary: string | null
  receivedChars: number
  error: { code: string; retryable: boolean } | null
  approval: { reviewRequestId: string; requestedMaxCredits: number } | null
}

export type SparkQuickAiState = { cards: readonly SparkQuickAiCard[] }

/** What the quick AI lane needs from the editor: the working copy the user sees and the command path. */
export type SparkQuickAiEditor = {
  workingCopy(): { version: number; document: CompositionDocument } | null
  apply(specs: readonly CompositionOpSpec[]): Promise<boolean>
}

export type SparkQuickAiSessionOptions = {
  projectId: string
  /** The editor this lane works on; the React editor attaches it after render with `setEditor`. */
  editor?: SparkQuickAiEditor
  stream?: typeof streamSparkQuickAi
  approve?: typeof approveSparkQuickAiSession
  createId?: () => string
  /** Orders cards among the other entries of the Assistant tab (the side chat shares it). */
  sequence?: () => number
}

/** A counter shared by the Assistant tab's entry sources: arrival order in this editor session. */
export function createEntrySequence(): () => number {
  let next = 0
  return () => {
    next += 1
    return next
  }
}

/** Cards kept in the panel; older ones fall off (the requests stay on the server). */
const MAX_CARDS = 20

export class SparkQuickAiSession {
  private state: SparkQuickAiState = { cards: [] }
  private readonly listeners = new Set<() => void>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly stream: typeof streamSparkQuickAi
  private readonly approveSession: typeof approveSparkQuickAiSession
  private readonly createId: () => string
  private readonly sequence: () => number
  private editor: SparkQuickAiEditor | null
  /** The TK-14 `edit_session` subject: one per opened editor. */
  readonly editSessionId: string

  constructor(private readonly options: SparkQuickAiSessionOptions) {
    this.stream = options.stream ?? streamSparkQuickAi
    this.approveSession = options.approve ?? approveSparkQuickAiSession
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.sequence = options.sequence ?? createEntrySequence()
    this.editor = options.editor ?? null
    this.editSessionId = `sedit_${this.createId()}`
    this.requestRewrite = this.requestRewrite.bind(this)
    this.retry = this.retry.bind(this)
    this.approve = this.approve.bind(this)
    this.apply = this.apply.bind(this)
    this.dismiss = this.dismiss.bind(this)
    this.dispose = this.dispose.bind(this)
    this.setEditor = this.setEditor.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** Attaches the editor (its working copy and command path); the latest one is used by every later action. */
  setEditor(editor: SparkQuickAiEditor): void {
    this.editor = editor
  }

  /**
   * Asks for a rewrite of the selected text layer, optionally following the user's instruction. Returns false when
   * the selection is no longer a text layer of the working copy (nothing is sent).
   */
  requestRewrite(input: { selection: SparkElementSelection; instruction?: string | null }): boolean {
    const copy = this.editor?.workingCopy() ?? null
    const layer = textLayerView(copy?.document ?? null, input.selection)
    if (!copy || !layer || layer.text.length > SPARK_QUICK_AI_TEXT_MAX_CHARS) return false
    const instruction = input.instruction?.trim().slice(0, SPARK_QUICK_AI_INSTRUCTION_MAX_CHARS) || null
    const card: SparkQuickAiCard = {
      id: `sqa_${this.createId()}`,
      seq: this.sequence(),
      target: { sceneId: layer.sceneId, layerId: layer.layerId },
      sceneNumber: layer.sceneNumber,
      before: layer.text,
      instruction,
      baseRevision: copy.version,
      status: 'running',
      after: null,
      summary: null,
      receivedChars: 0,
      error: null,
      approval: null,
    }
    this.set({ cards: [...this.state.cards, card].slice(-MAX_CARDS) })
    void this.run(card.id)
    return true
  }

  /** A retryable failure asks again with the same key (the server starts one new attempt, P03-24 §6). */
  retry(cardId: string): void {
    const card = this.card(cardId)
    if (!card || card.status !== 'failed' || !card.error?.retryable) return
    this.patch(cardId, { status: 'running', error: null, receivedChars: 0 })
    void this.run(cardId)
  }

  /** Gives the one Ask-mode approval of this edit session, then sends the same request again. */
  async approve(cardId: string): Promise<void> {
    const card = this.card(cardId)
    if (!card || card.status !== 'approval_required' || !card.approval) return
    this.patch(cardId, { status: 'running', error: null })
    try {
      await this.approveSession({
        editSessionId: this.editSessionId,
        projectId: this.options.projectId,
        reviewRequestId: card.approval.reviewRequestId,
        approvedMaxCredits: card.approval.requestedMaxCredits,
      })
    } catch {
      this.patch(cardId, { status: 'approval_required', error: { code: 'quick_ai_approval_failed', retryable: true } })
      return
    }
    this.patch(cardId, { approval: null })
    await this.run(cardId)
  }

  /**
   * Applies a ready suggestion through the editor's command path. When the layer's text changed since the
   * suggestion was made (another edit, undo or a collaborator), the card turns stale instead of overwriting it.
   */
  async apply(cardId: string): Promise<void> {
    const card = this.card(cardId)
    if (!card || card.status !== 'ready' || card.after === null) return
    const editor = this.editor
    const current = textLayerView(editor?.workingCopy()?.document ?? null, card.target)
    if (!editor || !current || current.text !== card.before) {
      this.patch(cardId, { status: 'stale' })
      return
    }
    this.patch(cardId, { status: 'applying' })
    const applied = await editor.apply([textSetSpec(card.target.sceneId, card.target.layerId, card.after)])
    if (this.card(cardId)) this.patch(cardId, { status: applied ? 'applied' : 'ready' })
  }

  /** Drops the card; a request still streaming is cancelled (the server settles it at once). */
  dismiss(cardId: string): void {
    this.controllers.get(cardId)?.abort()
    this.controllers.delete(cardId)
    this.set({ cards: this.state.cards.filter((card) => card.id !== cardId) })
  }

  /** Cancels every open request (editor closed). */
  dispose(): void {
    for (const controller of this.controllers.values()) controller.abort()
    this.controllers.clear()
  }

  private async run(cardId: string): Promise<void> {
    const card = this.card(cardId)
    if (!card) return
    this.controllers.get(cardId)?.abort()
    const controller = new AbortController()
    this.controllers.set(cardId, controller)
    const request: SparkQuickAiTextRewriteRequest = {
      schema: 'spark_quick_ai_request.v1',
      idempotency_key: card.id,
      operation: 'text_rewrite',
      project_id: this.options.projectId,
      edit_session_id: this.editSessionId,
      model_id: null,
      input: {
        text: card.before,
        instruction: card.instruction,
        target: { scene_id: card.target.sceneId, layer_id: card.target.layerId },
        base_revision: card.baseRevision,
        candidate_count: 1,
      },
    }
    try {
      await this.stream(request, { signal: controller.signal, onEvent: (event) => this.onEvent(cardId, event) })
      const settled = this.card(cardId)
      if (settled?.status === 'running') this.patch(cardId, { status: 'failed', error: { code: 'quick_ai_failed', retryable: true } })
    } catch (error) {
      if (controller.signal.aborted || !this.card(cardId)) return
      const rejected = error instanceof SparkQuickAiRejectedError
      this.patch(cardId, {
        status: 'failed',
        error: rejected ? { code: error.code, retryable: error.retryable } : { code: 'quick_ai_failed', retryable: true },
      })
    } finally {
      if (this.controllers.get(cardId) === controller) this.controllers.delete(cardId)
    }
  }

  private onEvent(cardId: string, event: SparkQuickAiEvent): void {
    if (!this.card(cardId)) return
    switch (event.type) {
      case 'progress':
        this.patch(cardId, { receivedChars: event.received_chars })
        return
      case 'suggestion': {
        const after = rewriteOf(event.suggestion, this.card(cardId)!)
        if (after === null) this.patch(cardId, { status: 'failed', error: { code: 'quick_ai_output_invalid', retryable: false } })
        else this.patch(cardId, { status: 'ready', after, summary: event.suggestion.summary })
        return
      }
      case 'handoff':
        this.patch(cardId, { status: 'handoff' })
        return
      case 'approval_required':
        this.patch(cardId, {
          status: 'approval_required',
          approval: { reviewRequestId: event.review_request_id, requestedMaxCredits: event.requested_max_credits },
        })
        return
      case 'funding_required':
        this.patch(cardId, { status: 'funding_required' })
        return
      case 'error':
        this.patch(cardId, { status: 'failed', error: { code: event.code, retryable: event.retryable } })
        return
      default:
        return
    }
  }

  private card(cardId: string): SparkQuickAiCard | undefined {
    return this.state.cards.find((card) => card.id === cardId)
  }

  private patch(cardId: string, patch: Partial<SparkQuickAiCard>): void {
    this.set({ cards: this.state.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)) })
  }

  private set(next: SparkQuickAiState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

/**
 * The rewritten text of a suggestion, only when its command draft is exactly the `text.set` of the card's layer
 * with the first candidate (the lane's contract for `text_rewrite`); anything else is not applied.
 */
function rewriteOf(suggestion: SparkQuickAiSuggestion, card: SparkQuickAiCard): string | null {
  const candidates = suggestion.result.candidates
  const first = Array.isArray(candidates) && typeof candidates[0] === 'string' ? candidates[0] : null
  const op = suggestion.command?.ops.length === 1 ? suggestion.command.ops[0] : null
  if (!first || !first.trim() || !op) return null
  if (op.op !== 'text.set' || op.scene_id !== card.target.sceneId || op.layer_id !== card.target.layerId || op.text !== first) return null
  return first
}

export function createSparkQuickAiSession(options: SparkQuickAiSessionOptions) {
  return new SparkQuickAiSession(options)
}
