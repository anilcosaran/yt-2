import { listBrandMotions, type BrandMotionListItem } from '@/lib/brand-kit/motions-api'

import {
  createMotionDraft,
  listMotionDrafts,
  listOwnMotionRevisions,
  listVideoStylePresetOptions,
  newMotionDraftClientRequestId,
  type MotionDraftListItem,
  type MotionRevision,
  type VideoStylePresetOption,
} from './api'
import { classifyMotionEditorError, type MotionResourceFailure } from './resource'

/**
 * P06-02 state of the Motion library screen: the platform Motion catalogue (Brand's single typed library), the user's own
 * drafts and the VideoStyle presets a copy may be tested with. "Customize" forks one exact revision into a private draft
 * (one create intent per Motion, so a retry after an unknown outcome replays the same draft). The server is the only
 * source of truth; nothing is cached in browser storage. While the authoring gate is closed the screen says so instead of
 * offering copies (403 `BRAND_MOTION_AUTHORING_UNAVAILABLE`). E1-D: the user's saved Motions (the immutable revisions
 * "Save as Motion" published, newest first) are listed too; a failed read of them is its own state, never an empty list.
 */

export type MotionLibraryStatus = 'loading' | 'ready' | 'unavailable' | 'error'

export type MotionLibraryState = {
  status: MotionLibraryStatus
  /** The platform catalogue; empty with `catalogue: 'unavailable'` while the typed-seeds gate is closed. */
  motions: readonly BrandMotionListItem[]
  catalogue: 'ok' | 'unavailable'
  drafts: readonly MotionDraftListItem[]
  /** E1-D "My Motions": the user's saved Motion revisions; `revisionsStatus: 'error'` when their read failed. */
  revisions: readonly MotionRevision[]
  revisionsStatus: 'ok' | 'error'
  styles: readonly VideoStylePresetOption[]
  /** The Motion being copied (its create intent is in flight). */
  creatingMotionId: string | null
  createFailure: { motionId: string; kind: MotionResourceFailure; reason: string | null } | null
}

export type MotionLibraryApi = {
  listMotions: typeof listBrandMotions
  listDrafts: typeof listMotionDrafts
  listRevisions: typeof listOwnMotionRevisions
  listStyles: typeof listVideoStylePresetOptions
  createDraft: typeof createMotionDraft
}

const DEFAULT_API: MotionLibraryApi = {
  listMotions: listBrandMotions,
  listDrafts: listMotionDrafts,
  listRevisions: listOwnMotionRevisions,
  listStyles: listVideoStylePresetOptions,
  createDraft: createMotionDraft,
}

const INITIAL_STATE: MotionLibraryState = {
  status: 'loading',
  motions: [],
  catalogue: 'ok',
  drafts: [],
  revisions: [],
  revisionsStatus: 'ok',
  styles: [],
  creatingMotionId: null,
  createFailure: null,
}

export class MotionLibrarySession {
  private state: MotionLibraryState = INITIAL_STATE
  private readonly listeners = new Set<() => void>()
  private readonly api: MotionLibraryApi
  private readonly createId: () => string
  /** The create intent of each Motion until a creation succeeds. */
  private readonly intents = new Map<string, string>()
  private controller: AbortController | null = null
  private generation = 0

  constructor(options: { api?: Partial<MotionLibraryApi>; createId?: () => string } = {}) {
    this.api = { ...DEFAULT_API, ...options.api }
    this.createId = options.createId ?? (() => newMotionDraftClientRequestId())
    this.load = this.load.bind(this)
    this.abort = this.abort.bind(this)
    this.customize = this.customize.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  async load(): Promise<void> {
    this.abort()
    const generation = this.generation
    const controller = new AbortController()
    this.controller = controller
    this.set({ ...INITIAL_STATE })
    const options = { signal: controller.signal }
    const [motions, drafts, styles, revisions] = await Promise.allSettled([
      this.api.listMotions(options),
      this.api.listDrafts({}, options),
      this.api.listStyles(options),
      this.api.listRevisions(options),
    ])
    if (generation !== this.generation || controller.signal.aborted) return
    if (this.controller === controller) this.controller = null

    if (drafts.status === 'rejected') {
      const failure = classifyMotionEditorError(drafts.reason)
      this.set({ ...INITIAL_STATE, status: failure.kind === 'unavailable' || failure.kind === 'forbidden' ? 'unavailable' : 'error' })
      return
    }
    // A closed catalogue gate (403) means no platform Motion to copy; any other catalogue failure is a load error.
    const catalogueClosed = motions.status === 'rejected' && classifyMotionEditorError(motions.reason).kind === 'forbidden'
    if (motions.status === 'rejected' && !catalogueClosed) {
      this.set({ ...INITIAL_STATE, status: 'error' })
      return
    }
    if (styles.status === 'rejected') {
      this.set({ ...INITIAL_STATE, status: 'error' })
      return
    }
    this.set({
      ...INITIAL_STATE,
      status: 'ready',
      motions: motions.status === 'fulfilled' ? motions.value.data : [],
      catalogue: catalogueClosed ? 'unavailable' : 'ok',
      drafts: drafts.value.data,
      revisions: revisions.status === 'fulfilled' ? revisions.value : [],
      revisionsStatus: revisions.status === 'fulfilled' ? 'ok' : 'error',
      styles: styles.value,
    })
  }

  abort(): void {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
  }

  /**
   * Forks one exact revision into a private draft tested with the named VideoStyle; returns the draft id to open, or
   * null when the server refused (the failure is on the state, nothing is opened).
   */
  async customize(item: Pick<BrandMotionListItem, 'motion_id' | 'head_revision'>, videoStyleRef: string): Promise<string | null> {
    if (this.state.status !== 'ready' || this.state.creatingMotionId) return null
    const intentKey = `${item.motion_id}|${item.head_revision.ref.manifest_sha256}|${videoStyleRef}`
    let clientRequestId = this.intents.get(intentKey)
    if (!clientRequestId) {
      clientRequestId = this.createId()
      this.intents.set(intentKey, clientRequestId)
    }
    const generation = this.generation
    this.set({ ...this.state, creatingMotionId: item.motion_id, createFailure: null })
    try {
      const { draft } = await this.api.createDraft({
        source: {
          motion_id: item.head_revision.ref.motion_id,
          motion_revision_id: item.head_revision.ref.motion_revision_id,
          manifest_sha256: item.head_revision.ref.manifest_sha256,
        },
        videoStyleRef,
        clientRequestId,
      })
      this.intents.delete(intentKey)
      if (generation !== this.generation) return null
      this.set({ ...this.state, creatingMotionId: null })
      return draft.draft_id
    } catch (error) {
      if (generation !== this.generation) return null
      const failure = classifyMotionEditorError(error)
      this.set({ ...this.state, creatingMotionId: null, createFailure: { motionId: item.motion_id, kind: failure.kind, reason: failure.reason } })
      return null
    }
  }

  private set(next: MotionLibraryState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}
