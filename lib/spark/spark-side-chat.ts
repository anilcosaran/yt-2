import {
  addAssistantMessage,
  answerAssistantRun,
  createAssistantConversation,
  listAssistantConversationMessages,
  type AssistantMessage,
} from '@/lib/assistant/api'
import { readInteractionQuestionOptions } from '@/lib/assistant/interaction-api'
import { EMPTY_COMPOSER_STATE, type ComposerChip } from '@/lib/assistant/composer/composer-state'
import { buildComposerSubmission, type ComposerSparkContext } from '@/lib/assistant/composer/message-context'

import { readMotionResult, type MotionResult } from './motion-result'
import { getSparkConversationLink, setSparkConversationLink } from './spark-entry'

/**
 * QA-081 Spark side chat (first slice of the P03-07/QA-092 panel): the right panel's Assistant tab talks to the
 * project's linked conversation (F34 `conversation-link`) through the shared P03-01 submission. Every message carries
 * the workspace snapshot the user saw — project, working copy version and, when the user picked one, the selected
 * scene as `surface_context.edit_context` — so "müziği burada kıs" targets the selected scene and a message without a
 * selection is a general request. The first message creates the project chat and links it. The transcript is read
 * from the server (no browser storage); new answers arrive through the conversation stream (P01-15).
 */

export type SparkChatEntry = {
  id: string
  /** Position in the Assistant tab (shared with the quick AI cards): arrival order in this editor session. */
  seq: number
  role: 'user' | 'assistant'
  content: string
  /** Sent by this editor and not yet confirmed by the server. */
  pending: boolean
  /** The job the message belongs to (a question is answered on it). */
  runId?: string | null
  /**
   * A P03-23 B question's typed chip options (recommendation first), e.g. "Hangi müzik?" → Giriş / Sahne 3 / Kapanış
   * (QA-081). The chip sends the option's label: that is what the user said.
   */
  questionOptions?: ReadonlyArray<{ label: string; value: string }> | null
  /** E1-H: the "Motion ready" card of an answer that closed a `/motion` job (derived by the server from the job's own state). */
  motionResult?: MotionResult | null
}

export type SparkSideChatError = 'load_failed' | 'send_failed' | 'stale_selection' | 'ambiguous_target' | 'job_limit'

export type SparkSideChatState = {
  status: 'loading' | 'ready' | 'error'
  conversationId: string | null
  entries: readonly SparkChatEntry[]
  sending: boolean
  error: SparkSideChatError | null
}

export type SparkSideChatDeps = {
  getLink: typeof getSparkConversationLink
  setLink: typeof setSparkConversationLink
  createConversation: typeof createAssistantConversation
  listMessages: typeof listAssistantConversationMessages
  addMessage: typeof addAssistantMessage
  answerRun: typeof answerAssistantRun
}

export type SparkSideChatOptions = {
  project: { id: string; title: string; channelId: string }
  sequence: () => number
  deps?: Partial<SparkSideChatDeps>
  createId?: () => string
}

/** Messages kept in the panel (the newest page of the conversation). */
const PAGE_LIMIT = 50

const DEFAULT_DEPS: SparkSideChatDeps = {
  getLink: getSparkConversationLink,
  setLink: setSparkConversationLink,
  createConversation: createAssistantConversation,
  listMessages: listAssistantConversationMessages,
  addMessage: addAssistantMessage,
  answerRun: answerAssistantRun,
}

const INITIAL_STATE: SparkSideChatState = { status: 'loading', conversationId: null, entries: [], sending: false, error: null }

export class SparkSideChatSession {
  private state: SparkSideChatState = INITIAL_STATE
  private readonly listeners = new Set<() => void>()
  private readonly deps: SparkSideChatDeps
  private readonly createId: () => string
  /** Server message id → its place in the tab (assigned once, when the message is first seen). */
  private readonly seqById = new Map<string, number>()
  /**
   * One conversation per project chat: the creation key is kept until a creation succeeds, so a retry after an
   * unknown outcome replays the same conversation instead of creating a second one.
   */
  private creationKey: string | null = null
  private creation: Promise<string> | null = null
  private refreshing: Promise<void> | null = null
  private refreshAgain = false
  private disposed = false

  constructor(private readonly options: SparkSideChatOptions) {
    this.deps = { ...DEFAULT_DEPS, ...options.deps }
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.load = this.load.bind(this)
    this.refresh = this.refresh.bind(this)
    this.send = this.send.bind(this)
    this.answer = this.answer.bind(this)
    this.clearError = this.clearError.bind(this)
    this.dispose = this.dispose.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** Reads the project's linked chat and its newest messages; no link yet = an empty, ready chat. */
  async load(): Promise<void> {
    this.disposed = false
    this.set({ ...this.state, status: 'loading', error: null })
    try {
      const conversationId = await this.deps.getLink(this.options.project.id)
      if (this.disposed) return
      if (!conversationId) {
        this.set({ ...this.state, status: 'ready', conversationId: null })
        return
      }
      this.set({ ...this.state, conversationId })
      await this.readMessages(conversationId)
      if (!this.disposed) this.set({ ...this.state, status: 'ready' })
    } catch {
      if (!this.disposed) this.set({ ...this.state, status: 'error', error: 'load_failed' })
    }
  }

  /** Re-reads the transcript after a stream event (answers, questions, job ends); overlapping calls coalesce. */
  async refresh(): Promise<void> {
    const conversationId = this.state.conversationId
    if (!conversationId || this.disposed) return
    if (this.refreshing) {
      this.refreshAgain = true
      return this.refreshing
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false
        try {
          await this.readMessages(conversationId)
        } catch {
          // The next stream event or message retries; the transcript keeps what it showed.
        }
      } while (this.refreshAgain && !this.disposed)
    })()
    try {
      await this.refreshing
    } finally {
      this.refreshing = null
    }
  }

  /**
   * Sends one message with the workspace snapshot. Returns false when nothing was sent (the caller keeps the draft):
   * an empty text, a snapshot that does not match the version it names, or a refused/failed append.
   */
  async send(input: {
    text: string
    /** E1-H: the typed composer's chips (a `/motion` command chip, `@` mentions); they travel as typed refs, never as text. */
    chips?: readonly ComposerChip[]
    sparkContext: ComposerSparkContext
    locale?: string | null
  }): Promise<boolean> {
    if (this.state.sending || this.state.status !== 'ready') return false
    const submission = buildComposerSubmission({
      surface: 'spark_chat',
      state: { ...EMPTY_COMPOSER_STATE, text: input.text, chips: input.chips ?? [] },
      sparkContext: input.sparkContext,
      channelId: this.options.project.channelId,
      locale: input.locale ?? null,
    })
    if (!submission.ok) {
      if (submission.issues.some((issue) => issue.code === 'spark_edit_context_mismatch' || issue.code === 'spark_context_missing')) {
        this.set({ ...this.state, error: 'stale_selection' })
      }
      return false
    }
    const localId = `local_${this.createId()}`
    const optimistic: SparkChatEntry = { id: localId, seq: this.options.sequence(), role: 'user', content: submission.content, pending: true }
    this.set({ ...this.state, sending: true, error: null, entries: [...this.state.entries, optimistic] })
    try {
      const conversationId = this.state.conversationId ?? (await this.ensureConversation())
      const result = await this.deps.addMessage({
        conversationId,
        content: submission.content,
        contentJson: submission.contentJson,
        idempotencyKey: `spark-chat:${this.createId()}`,
      })
      if ('message' in result && result.message) {
        // The confirmed message keeps the optimistic entry's place.
        this.seqById.set(result.message.id, optimistic.seq)
      }
      this.set({ ...this.state, conversationId, entries: this.state.entries.filter((entry) => entry.id !== localId) })
      await this.readMessages(conversationId)
      return true
    } catch (error) {
      this.set({
        ...this.state,
        error: sendErrorKind(error),
        entries: this.state.entries.filter((entry) => entry.id !== localId),
      })
      return false
    } finally {
      this.set({ ...this.state, sending: false })
    }
  }

  /**
   * QA-081: answers the open chip question of `entryId` with one of its options, as the job's bound reply (the same
   * P01-13 answer path as the Chat's quick decision). Returns false when nothing was sent.
   */
  async answer(entryId: string, option: { label: string; value: string }): Promise<boolean> {
    const question = this.state.entries.find((entry) => entry.id === entryId)
    const conversationId = this.state.conversationId
    if (this.state.sending || !question?.runId || !question.questionOptions || !conversationId) return false
    const localId = `local_${this.createId()}`
    const optimistic: SparkChatEntry = { id: localId, seq: this.options.sequence(), role: 'user', content: option.value, pending: true }
    this.set({ ...this.state, sending: true, error: null, entries: [...this.state.entries, optimistic] })
    try {
      const answered = await this.deps.answerRun({
        runId: question.runId,
        questionMessageId: question.id,
        content: option.value,
        contentJson: { quick_question: { question_message_id: question.id, selected_label: option.label } },
        idempotencyKey: `spark-chat-answer:${this.createId()}`,
      })
      this.seqById.set(answered.message.id, optimistic.seq)
      this.set({ ...this.state, entries: this.state.entries.filter((entry) => entry.id !== localId) })
      await this.readMessages(conversationId)
      return true
    } catch (error) {
      this.set({ ...this.state, error: sendErrorKind(error), entries: this.state.entries.filter((entry) => entry.id !== localId) })
      return false
    } finally {
      this.set({ ...this.state, sending: false })
    }
  }

  clearError(): void {
    if (this.state.error) this.set({ ...this.state, error: null })
  }

  dispose(): void {
    this.disposed = true
  }

  private ensureConversation(): Promise<string> {
    if (this.creation) return this.creation
    this.creationKey ??= `spark-chat-conversation:${this.createId()}`
    const key = this.creationKey
    const promise = (async () => {
      const { project } = this.options
      const created = await this.deps.createConversation({
        title: project.title,
        metadata: { channel_id: project.channelId, spark_project_id: project.id },
        idempotencyKey: key,
      })
      // The link is the project's F34 conversation; a link made meanwhile (another tab) wins.
      const linked = await this.deps.setLink(project.id, created.id)
      return linked ?? created.id
    })()
    this.creation = promise
    promise.catch(() => {
      if (this.creation === promise) this.creation = null
    })
    return promise
  }

  private async readMessages(conversationId: string): Promise<void> {
    const page = await this.deps.listMessages({ conversationId, limit: PAGE_LIMIT })
    if (this.disposed || (this.state.conversationId !== null && this.state.conversationId !== conversationId)) return
    const confirmed = page.messages.filter(isChatMessage).map((message) => this.entryOf(message))
    const pending = this.state.entries.filter((entry) => entry.pending)
    this.set({ ...this.state, entries: [...confirmed, ...pending].sort((a, b) => a.seq - b.seq) })
  }

  private entryOf(message: AssistantMessage): SparkChatEntry {
    let seq = this.seqById.get(message.id)
    if (seq === undefined) {
      seq = this.options.sequence()
      this.seqById.set(message.id, seq)
    }
    const questionOptions = message.role === 'assistant' ? readInteractionQuestionOptions(message.content_json) : null
    const motionResult = message.role === 'assistant' ? readMotionResult(message.content_json) : null
    return {
      id: message.id,
      seq,
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.content.trim(),
      pending: false,
      runId: message.run_id,
      ...(questionOptions ? { questionOptions } : {}),
      ...(motionResult ? { motionResult } : {}),
    }
  }

  private set(next: SparkSideChatState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

function isChatMessage(message: AssistantMessage): boolean {
  return (message.role === 'user' || message.role === 'assistant') && !message.deleted_at && message.content.trim().length > 0
}

function sendErrorKind(error: unknown): SparkSideChatError {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
  if (code === 'ASSISTANT_JOB_TARGET_AMBIGUOUS') return 'ambiguous_target'
  if (code === 'ASSISTANT_CONVERSATION_JOB_LIMIT_REACHED') return 'job_limit'
  const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined
  const message = error instanceof Error ? error.message : ''
  if (status === 400 && /edit_context|surface_context/.test(message)) return 'stale_selection'
  return 'send_failed'
}

/**
 * The chip question the user can answer now: the newest message is an assistant question with typed options and its
 * job waits for the user. Anything newer (the user's own reply) closes it.
 */
export function openSparkChatQuestion(
  entries: readonly SparkChatEntry[],
  waitingRunIds: ReadonlySet<string>,
): SparkChatEntry | null {
  const last = [...entries].sort((a, b) => a.seq - b.seq).at(-1)
  if (!last || last.role !== 'assistant' || !last.questionOptions?.length || !last.runId) return null
  return waitingRunIds.has(last.runId) ? last : null
}

export function createSparkSideChatSession(options: SparkSideChatOptions) {
  return new SparkSideChatSession(options)
}
