import { isAuthClientError } from '@/lib/auth/errors'

import {
  stockCreateGatewayTransport,
  stockCreateRatios,
  type StockCreateKind,
  type StockCreateKindAvailability,
  type StockCreateRatio,
  type StockCreateTransport,
  type StockCreation,
} from './stock-create-api'

/** Why Create is passive for a kind (server reasons; `loading`/`error` are the client's own). */
export type StockCreatePassiveReason =
  | 'create_disabled'
  | 'no_generation_node'
  | 'generation_node_unavailable'
  | 'no_enabled_model'
  | 'catalog_unavailable'
  | 'loading'
  | 'error'

export type StockCreateNoticeKind = 'created' | 'priceChanged' | 'createFailed' | 'createProcessing' | 'insufficientCredits'

export type StockCreateState = {
  /** Per kind: the catalogue model the tab uses, or the passive reason (no fake option, K272 d). */
  kinds: Record<StockCreateKind, { modelId: string; modelLabel: string } | { passive: StockCreatePassiveReason }>
  open: boolean
  kind: StockCreateKind
  ratio: StockCreateRatio
  prompt: string
  /** The Workflow price of exactly this request (never a client formula); null until known. */
  quote: { status: 'idle' | 'quoting' | 'ready' | 'error'; credits: number | null; key: string | null }
  creating: boolean
}

export type StockCreateOptions = {
  projectId: string
  transport?: StockCreateTransport
  createId?: () => string
  wait?: (ms: number) => Promise<void>
  now?: () => number
  /** The drawer's toast (the same notice area as "Add to scene"). */
  notify: (kind: StockCreateNoticeKind, values?: Record<string, number>) => void
  /** Inserts the created, project-bound source as a clip (returns the new scene number). */
  place: (input: { sourceId: string; kind: StockCreateKind }) => Promise<number | null>
}

const PROMPT_MIN = 3
const PROMPT_MAX = 2000
/** Generation runs longer than a Stock copy: follow it for a while, then leave it to the server. */
const POLL_DELAYS_MS = [1500, 2000, 3000, 5000]
const POLL_BUDGET_MS = 10 * 60_000

const INITIAL: StockCreateState = {
  kinds: { image: { passive: 'loading' }, video: { passive: 'loading' } },
  open: false,
  kind: 'image',
  ratio: '16:9',
  prompt: '',
  quote: { status: 'idle', credits: null, key: null },
  creating: false,
}

/**
 * P06-40 "Stock'ta Oluştur" in the Spark Stock panel (the design's "Generate with AI" row and box). Framework-free; React
 * subscribes with useSyncExternalStore. The kinds and their catalogue model come from the server (passive + reason when
 * the catalogue has none); the button shows the Workflow price of exactly the typed request, and a click creates with
 * that price (a changed price is shown again, never spent silently). The result is the user's own media; when it is
 * bound to the project it is inserted as a new scene like a Stock item.
 */
export class SparkStockCreate {
  private state: StockCreateState = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly transport: StockCreateTransport
  private readonly createId: () => string
  private readonly wait: (ms: number) => Promise<void>
  private readonly now: () => number
  private quoteGeneration = 0
  private disposed = false

  constructor(private readonly options: StockCreateOptions) {
    this.transport = options.transport ?? stockCreateGatewayTransport
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.now = options.now ?? (() => Date.now())
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): StockCreateState => this.state

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
  }

  async load(): Promise<void> {
    try {
      const kinds = await this.transport.availability()
      this.set({ ...this.state, kinds: { image: resolveKind(kinds, 'image'), video: resolveKind(kinds, 'video') } })
    } catch {
      this.set({ ...this.state, kinds: { image: { passive: 'error' }, video: { passive: 'error' } } })
    }
  }

  /** At least one kind can be created now (the row opens the box). */
  get enabled(): boolean {
    return Object.values(this.state.kinds).some((entry) => 'modelId' in entry)
  }

  toggle(): void {
    if (!this.enabled) return
    const open = !this.state.open
    const kind = 'modelId' in this.state.kinds[this.state.kind] ? this.state.kind : this.state.kind === 'image' ? 'video' : 'image'
    this.set({ ...this.state, open, kind })
  }

  /** The kind chip cycles through the creatable kinds only. */
  cycleKind(): void {
    const next: StockCreateKind = this.state.kind === 'image' ? 'video' : 'image'
    if (!('modelId' in this.state.kinds[next])) return
    this.set({ ...this.state, kind: next, quote: { status: 'idle', credits: null, key: null } })
  }

  cycleRatio(): void {
    const index = stockCreateRatios.indexOf(this.state.ratio)
    this.set({ ...this.state, ratio: stockCreateRatios[(index + 1) % stockCreateRatios.length]!, quote: { status: 'idle', credits: null, key: null } })
  }

  setPrompt(prompt: string): void {
    if (prompt === this.state.prompt) return
    this.set({ ...this.state, prompt: prompt.slice(0, PROMPT_MAX), quote: { status: 'idle', credits: null, key: null } })
  }

  /** The caller debounces typing; a late answer for an older request never overwrites a newer one. */
  async requestQuote(): Promise<void> {
    const request = this.request()
    if (!request) return
    const key = requestKey(request)
    if (this.state.quote.key === key && this.state.quote.status === 'ready') return
    const generation = ++this.quoteGeneration
    this.set({ ...this.state, quote: { status: 'quoting', credits: null, key } })
    try {
      const credits = await this.transport.quote(request)
      if (generation !== this.quoteGeneration) return
      this.set({ ...this.state, quote: { status: 'ready', credits, key } })
    } catch {
      if (generation !== this.quoteGeneration) return
      this.set({ ...this.state, quote: { status: 'error', credits: null, key } })
    }
  }

  /** Creates with the shown price (one intent per click), follows the run and inserts the bound result as a scene. */
  async create(): Promise<void> {
    const request = this.request()
    const quote = this.state.quote
    if (!request || this.state.creating || quote.status !== 'ready' || quote.credits === null || quote.key !== requestKey(request)) return
    this.set({ ...this.state, creating: true })
    try {
      let creation = await this.transport.start({ ...request, intentKey: `stock-create:${this.createId()}`, expectedCredits: quote.credits })
      const started = this.now()
      let attempt = 0
      while (creation.state !== 'ready' && creation.state !== 'failed') {
        if (this.disposed) return
        if (this.now() - started > POLL_BUDGET_MS) {
          this.options.notify('createProcessing')
          return
        }
        await this.wait(POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)]!)
        attempt += 1
        creation = await this.transport.get(creation.creation_id)
      }
      await this.finish(creation, request.kind)
    } catch (error) {
      if (isAuthClientError(error) && error.code === 'MEDIA_CATALOG_STOCK_CREATE_QUOTE_CHANGED') {
        const details = error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : {}
        const credits = typeof details['quoted_credits'] === 'number' ? details['quoted_credits'] : Number.NaN
        this.set({ ...this.state, quote: Number.isFinite(credits) ? { ...this.state.quote, credits, status: 'ready' } : { status: 'idle', credits: null, key: null } })
        this.options.notify('priceChanged')
      } else {
        this.options.notify('createFailed')
      }
    } finally {
      this.set({ ...this.state, creating: false })
    }
  }

  private async finish(creation: StockCreation, kind: StockCreateKind): Promise<void> {
    if (creation.state === 'failed') {
      this.options.notify(creation.reason_code === 'insufficient_credits' ? 'insufficientCredits' : 'createFailed')
      return
    }
    this.set({ ...this.state, prompt: '', quote: { status: 'idle', credits: null, key: null } })
    if (!creation.source_id) {
      // Ready as the user's own media, but not bound to this project (project closed meanwhile).
      this.options.notify('createProcessing')
      return
    }
    const scene = await this.options.place({ sourceId: creation.source_id, kind })
    if (scene !== null) this.options.notify('created', { n: scene })
  }

  private request(): { kind: StockCreateKind; modelId: string; prompt: string; ratio: StockCreateRatio; projectId: string } | null {
    const entry = this.state.kinds[this.state.kind]
    const prompt = this.state.prompt.replace(/\s+/g, ' ').trim()
    if (!('modelId' in entry) || prompt.length < PROMPT_MIN) return null
    return { kind: this.state.kind, modelId: entry.modelId, prompt, ratio: this.state.ratio, projectId: this.options.projectId }
  }

  private set(next: StockCreateState): void {
    if (this.disposed) return
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

function resolveKind(kinds: StockCreateKindAvailability[], kind: StockCreateKind): StockCreateState['kinds'][StockCreateKind] {
  const entry = kinds.find((candidate) => candidate.kind === kind)
  if (!entry) return { passive: 'catalog_unavailable' }
  if (!entry.available) return { passive: (entry.reason ?? 'catalog_unavailable') as StockCreatePassiveReason }
  const model = entry.models.find((candidate) => candidate.model_id === entry.default_model_id) ?? entry.models[0]
  return model ? { modelId: model.model_id, modelLabel: model.label } : { passive: 'no_enabled_model' }
}

function requestKey(request: { kind: string; modelId: string; prompt: string; ratio: string }): string {
  return JSON.stringify([request.kind, request.modelId, request.ratio, request.prompt])
}

export function createSparkStockCreate(options: StockCreateOptions): SparkStockCreate {
  return new SparkStockCreate(options)
}
