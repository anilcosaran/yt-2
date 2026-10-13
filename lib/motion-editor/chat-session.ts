import {
  addAssistantMessage,
  createAssistantConversation,
  listAssistantConversationMessages,
  type AssistantMessage,
} from '@/lib/assistant/api'
import { EMPTY_COMPOSER_STATE } from '@/lib/assistant/composer/composer-state'
import { buildComposerSubmission } from '@/lib/assistant/composer/message-context'

import { getMotionDraftConversationLink, setMotionDraftConversationLink } from './api'

/**
 * P06-02 Chat of the Motion screen: the same shared Assistant conversation API Spark and Dashboard Chat use (no second
 * agent, runtime or transcript store). The conversation is the draft's: its id is linked to the draft on the server
 * (`conversation-link`, once) and the conversation metadata names the draft, so the transcript survives a reload and the
 * Assistant side can bind draft tools to it. The transcript is read from the server; nothing is kept in browser storage.
 *
 * E1-H: messages travel on the `motion_authoring` surface (`surface_context {draft_id, seen_draft_version}`), so the
 * Assistant's Motion tools (`motion.draft.read` / `motion.draft.edit`) really edit THIS draft: the server binds the job to
 * the draft named by the message, every write names the draft version it read (CAS), and the screen reloads the draft when
 * the job ends. `seen_draft_version` is the version the screen showed when the user sent the message.
 */

export type MotionChatEntry = { id: string; role: 'user' | 'assistant'; content: string; pending: boolean }

export type MotionChatError = 'load_failed' | 'send_failed'

export type MotionChatState = {
  status: 'loading' | 'ready' | 'error'
  conversationId: string | null
  entries: readonly MotionChatEntry[]
  sending: boolean
  error: MotionChatError | null
}

export type MotionChatDeps = {
  getLink: typeof getMotionDraftConversationLink
  setLink: typeof setMotionDraftConversationLink
  createConversation: typeof createAssistantConversation
  listMessages: typeof listAssistantConversationMessages
  addMessage: typeof addAssistantMessage
}

const DEFAULT_DEPS: MotionChatDeps = {
  getLink: getMotionDraftConversationLink,
  setLink: setMotionDraftConversationLink,
  createConversation: createAssistantConversation,
  listMessages: listAssistantConversationMessages,
  addMessage: addAssistantMessage,
}

const PAGE_LIMIT = 50
const INITIAL_STATE: MotionChatState = { status: 'loading', conversationId: null, entries: [], sending: false, error: null }

function isChatMessage(message: AssistantMessage): boolean {
  return (message.role === 'user' || message.role === 'assistant') && !message.deleted_at && message.content.trim().length > 0
}

export class MotionChatSession {
  private state: MotionChatState = INITIAL_STATE
  private readonly listeners = new Set<() => void>()
  private readonly deps: MotionChatDeps
  private readonly createId: () => string
  private creationKey: string | null = null
  private creation: Promise<string> | null = null
  private disposed = false
  private seenDraftVersion: number | null = null

  constructor(private readonly options: {
    draftId: string
    title: string
    locale?: string | null
    /** The draft version the screen shows right now (the message's `seen_draft_version`); null/absent = not known yet. */
    getDraftVersion?: () => number | null
    deps?: Partial<MotionChatDeps>
    createId?: () => string
  }) {
    this.deps = { ...DEFAULT_DEPS, ...options.deps }
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.load = this.load.bind(this)
    this.refresh = this.refresh.bind(this)
    this.send = this.send.bind(this)
    this.dispose = this.dispose.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** The screen tells the session which draft version it shows now (the next message's `seen_draft_version`). */
  setDraftVersion(version: number | null): void {
    this.seenDraftVersion = version
  }

  /** Reads the draft's linked conversation and its newest messages; no link yet = an empty, ready chat. */
  async load(): Promise<void> {
    this.disposed = false
    this.set({ ...this.state, status: 'loading', error: null })
    try {
      const conversationId = await this.deps.getLink(this.options.draftId)
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

  async refresh(): Promise<void> {
    const conversationId = this.state.conversationId
    if (!conversationId || this.disposed) return
    try {
      await this.readMessages(conversationId)
    } catch {
      // The next message or refresh retries; the transcript keeps what it showed.
    }
  }

  /** Sends one text message; false when nothing was sent (empty text or a failed append: the caller keeps its text). */
  async send(text: string): Promise<boolean> {
    if (this.state.sending || this.state.status !== 'ready') return false
    const seen = this.seenDraftVersion ?? this.options.getDraftVersion?.() ?? null
    const submission = buildComposerSubmission({
      surface: 'motion_authoring',
      state: { ...EMPTY_COMPOSER_STATE, text },
      motionContext: seen === null ? null : { draftId: this.options.draftId, seenDraftVersion: seen },
      locale: this.options.locale ?? null,
    })
    if (!submission.ok) return false
    const localId = `local_${this.createId()}`
    const optimistic: MotionChatEntry = { id: localId, role: 'user', content: submission.content, pending: true }
    this.set({ ...this.state, sending: true, error: null, entries: [...this.state.entries, optimistic] })
    try {
      const conversationId = this.state.conversationId ?? (await this.ensureConversation())
      await this.deps.addMessage({
        conversationId,
        content: submission.content,
        contentJson: submission.contentJson,
        idempotencyKey: `motion-chat:${this.createId()}`,
      })
      this.set({ ...this.state, conversationId, entries: this.state.entries.filter((entry) => entry.id !== localId) })
      await this.readMessages(conversationId)
      return true
    } catch {
      this.set({ ...this.state, error: 'send_failed', entries: this.state.entries.filter((entry) => entry.id !== localId) })
      return false
    } finally {
      this.set({ ...this.state, sending: false })
    }
  }

  dispose(): void {
    this.disposed = true
  }

  /** One conversation per draft: the creation key is kept until a creation succeeds, so a retry replays the same chat. */
  private ensureConversation(): Promise<string> {
    if (this.creation) return this.creation
    this.creationKey ??= `motion-chat-conversation:${this.createId()}`
    const key = this.creationKey
    const promise = (async () => {
      const created = await this.deps.createConversation({
        title: this.options.title,
        metadata: { motion_draft_id: this.options.draftId },
        idempotencyKey: key,
      })
      // The link is the draft's conversation; one made meanwhile (another tab) wins.
      const linked = await this.deps.setLink(this.options.draftId, created.id).catch(async () => this.deps.getLink(this.options.draftId))
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
    if (this.disposed) return
    const confirmed: MotionChatEntry[] = [...page.messages]
      .filter(isChatMessage)
      // Oldest first, whatever order the page came in.
      .sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1))
      .map((message) => ({ id: message.id, role: message.role === 'user' ? ('user' as const) : ('assistant' as const), content: message.content.trim(), pending: false }))
    const pending = this.state.entries.filter((entry) => entry.pending)
    this.set({ ...this.state, entries: [...confirmed, ...pending] })
  }

  private set(next: MotionChatState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}
