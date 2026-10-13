import {
  archiveMotionDraft,
  getMotionDraft,
  newMotionPublishIntentKey,
  previewMotionDraft,
  publishMotionDraft,
  setMotionDraftTestData,
  updateMotionDraftSource,
  validateMotionDraft,
  type MotionDraft,
  type MotionDraftPreview,
  type MotionDraftTestData,
  type MotionEnergy,
  type MotionRatio,
} from './api'
import { classifyMotionEditorError, type ClassifiedMotionError, type MotionResourceFailure } from './resource'

/**
 * P06-02 editor state of one Motion draft. The server is the only source of truth: every write is one CAS command built
 * from the draft version the user saw, and the answer replaces the local copy; a conflict reloads the server state and
 * raises a notice (no merge, no silent overwrite). Product data is never cached in browser storage. The default view is
 * preview + Chat + parameters; the code panel is an opt-in view state (`codePanelOpen`, closed by default) and never a
 * write of its own. Framework-free so the React screen subscribes with `useSyncExternalStore`.
 */

export type MotionEditorStatus = 'loading' | 'ready' | 'forbidden' | 'not_found' | 'unavailable' | 'invalid' | 'error'

export type MotionPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; preview: MotionDraftPreview }
  | { status: 'failed'; failure: MotionResourceFailure; reason: string | null }

export type MotionEditorNoticeKind =
  | 'conflict'
  | 'sourceNotJson'
  | 'sourceRejected'
  | 'saveFailed'
  | 'validated'
  | 'archived'
  | 'published'
  | 'publishBlocked'
  | 'publishUnchanged'

export type MotionEditorNotice = { id: number; kind: MotionEditorNoticeKind; reason?: string }

export type MotionEditorState = {
  status: MotionEditorStatus
  draft: MotionDraft | null
  /** A write is in flight (writes run one at a time). */
  saving: boolean
  preview: MotionPreviewState
  /** View state only (never a write): the source panel opens on request; the default view is preview + Chat + parameters. */
  codePanelOpen: boolean
  notice: MotionEditorNotice | null
  failure: ClassifiedMotionError | null
}

export type MotionEditorApi = {
  getDraft: typeof getMotionDraft
  updateSource: typeof updateMotionDraftSource
  setTestData: typeof setMotionDraftTestData
  validate: typeof validateMotionDraft
  preview: typeof previewMotionDraft
  archive: typeof archiveMotionDraft
  publish: typeof publishMotionDraft
}

const DEFAULT_API: MotionEditorApi = {
  getDraft: getMotionDraft,
  updateSource: updateMotionDraftSource,
  setTestData: setMotionDraftTestData,
  validate: validateMotionDraft,
  preview: previewMotionDraft,
  archive: archiveMotionDraft,
  publish: publishMotionDraft,
}

const INITIAL_STATE: MotionEditorState = {
  status: 'loading',
  draft: null,
  saving: false,
  preview: { status: 'idle' },
  codePanelOpen: false,
  notice: null,
  failure: null,
}

const READ_FAILURE_STATUS: Record<MotionResourceFailure, MotionEditorStatus> = {
  forbidden: 'forbidden',
  not_found: 'not_found',
  unavailable: 'unavailable',
  invalid: 'invalid',
  // A conflict cannot happen on a read; anything else that is not an explicit resource state is a load error.
  conflict: 'error',
  // The draft names a style that no longer resolves: it is reported as its own state by the preview, never defaulted.
  video_style_unavailable: 'error',
  error: 'error',
}

export function motionPatternToText(pattern: Record<string, unknown>): string {
  return JSON.stringify(pattern, null, 2)
}

export class MotionEditorSession {
  private state: MotionEditorState = INITIAL_STATE
  private readonly listeners = new Set<() => void>()
  private readonly api: MotionEditorApi
  private loadController: AbortController | null = null
  private previewController: AbortController | null = null
  private generation = 0
  private noticeId = 0

  /** The publish intent of the draft version the user asked to save: an unknown outcome is retried with the same key. */
  private publishIntent: { version: number; key: string } | null = null

  constructor(private readonly options: { draftId: string; api?: Partial<MotionEditorApi>; newPublishKey?: () => string }) {
    this.api = { ...DEFAULT_API, ...options.api }
    this.load = this.load.bind(this)
    this.abort = this.abort.bind(this)
    this.openCodePanel = this.openCodePanel.bind(this)
    this.closeCodePanel = this.closeCodePanel.bind(this)
    this.saveSource = this.saveSource.bind(this)
    this.rename = this.rename.bind(this)
    this.setTestValues = this.setTestValues.bind(this)
    this.setViewpoint = this.setViewpoint.bind(this)
    this.validate = this.validate.bind(this)
    this.refreshPreview = this.refreshPreview.bind(this)
    this.archive = this.archive.bind(this)
    this.publish = this.publish.bind(this)
    this.dismissNotice = this.dismissNotice.bind(this)
    this.reloadDraft = this.reloadDraft.bind(this)
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** Reads the draft; the screen shows a loading state until it arrives. An unreadable draft stops at its explicit state. */
  async load(): Promise<void> {
    this.abort()
    const generation = this.generation
    const controller = new AbortController()
    this.loadController = controller
    this.set({ ...INITIAL_STATE })
    try {
      const draft = await this.api.getDraft(this.options.draftId, { signal: controller.signal })
      if (generation !== this.generation) return
      this.set({ ...INITIAL_STATE, status: 'ready', draft })
      void this.refreshPreview()
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return
      const failure = classifyMotionEditorError(error)
      this.set({ ...INITIAL_STATE, status: READ_FAILURE_STATUS[failure.kind], failure })
    } finally {
      if (this.loadController === controller) this.loadController = null
    }
  }

  /** Drops in-flight reads and every late result (route change or unmount). */
  abort(): void {
    this.generation += 1
    this.loadController?.abort()
    this.loadController = null
    this.previewController?.abort()
    this.previewController = null
  }

  openCodePanel(): void {
    if (this.state.status === 'ready' && !this.state.codePanelOpen) this.set({ ...this.state, codePanelOpen: true })
  }

  closeCodePanel(): void {
    if (this.state.codePanelOpen) this.set({ ...this.state, codePanelOpen: false })
  }

  dismissNotice(): void {
    if (this.state.notice) this.set({ ...this.state, notice: null })
  }

  /** The code panel's save: the whole typed source as JSON, under the version the user saw. Bad JSON is never sent. */
  async saveSource(text: string): Promise<boolean> {
    let pattern: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      pattern = parsed as Record<string, unknown>
    } catch {
      this.notify('sourceNotJson')
      return false
    }
    return this.write((draft) => this.api.updateSource(draft.draft_id, { expectedVersion: draft.draft.version, pattern }))
  }

  async rename(name: string): Promise<boolean> {
    return this.write((draft) => this.api.updateSource(draft.draft_id, { expectedVersion: draft.draft.version, name }))
  }

  /** Parameter panel: one Test Data write (the values the preview and the validation compile with). */
  async setTestValues(values: Record<string, string | number>): Promise<boolean> {
    return this.writeTestData((testData) => ({ ...testData, values }))
  }

  /** Ratio/energy switches of the preview: persisted Test Data (a preview never differs from what validation compiles). */
  async setViewpoint(view: { ratio?: MotionRatio; energy?: MotionEnergy }): Promise<boolean> {
    return this.writeTestData((testData) => ({ ...testData, ...view }))
  }

  async validate(): Promise<boolean> {
    return this.write((draft) => this.api.validate(draft.draft_id, { expectedVersion: draft.draft.version }), 'validated')
  }

  async archive(): Promise<boolean> {
    return this.write((draft) => this.api.archive(draft.draft_id, { expectedVersion: draft.draft.version }), 'archived')
  }

  /**
   * "Motion olarak kaydet": publishes the validated draft version as an immutable revision. The server decides whether
   * it can (`capabilities.actions.publish`); the answer's draft carries the new latest revision. The draft version does
   * not change, so the preview stays; a retry of an unknown outcome reuses the intent key of this version.
   */
  async publish(): Promise<boolean> {
    return this.write(async (draft) => {
      const version = draft.draft.version
      const key = this.publishIntent?.version === version ? this.publishIntent.key : (this.options.newPublishKey ?? newMotionPublishIntentKey)()
      this.publishIntent = { version, key }
      const result = await this.api.publish(draft.draft_id, { expectedVersion: version, publishIntentKey: key })
      this.publishIntent = null
      return result.draft
    }, 'published')
  }

  async refreshPreview(): Promise<void> {
    const draft = this.state.draft
    if (this.state.status !== 'ready' || !draft) return
    this.previewController?.abort()
    const controller = new AbortController()
    this.previewController = controller
    const version = draft.draft.version
    this.set({ ...this.state, preview: { status: 'loading' } })
    try {
      const preview = await this.api.preview(draft.draft_id, {}, { signal: controller.signal })
      if (controller.signal.aborted || this.state.draft?.draft.version !== version) return
      this.set({ ...this.state, preview: { status: 'ready', preview } })
    } catch (error) {
      if (controller.signal.aborted || this.state.draft?.draft.version !== version) return
      const failure = classifyMotionEditorError(error)
      this.set({ ...this.state, preview: { status: 'failed', failure: failure.kind, reason: failure.reason } })
    } finally {
      if (this.previewController === controller) this.previewController = null
    }
  }

  private writeTestData(change: (testData: MotionDraftTestData) => MotionDraftTestData): Promise<boolean> {
    return this.write((draft) =>
      this.api.setTestData(draft.draft_id, { expectedVersion: draft.draft.version, testData: change(draft.draft.test_data) }))
  }

  /**
   * One write at a time. The server's answer replaces the draft (its version is the next `expected_version`); a conflict
   * reloads the server state and says so; a refused write keeps the draft and names the server's reason.
   */
  private async write(send: (draft: MotionDraft) => Promise<MotionDraft>, success?: MotionEditorNoticeKind): Promise<boolean> {
    const draft = this.state.draft
    if (this.state.status !== 'ready' || !draft || this.state.saving) return false
    const generation = this.generation
    this.set({ ...this.state, saving: true })
    try {
      const next = await send(draft)
      if (generation !== this.generation) return false
      this.set({ ...this.state, draft: next, saving: false, notice: success ? this.makeNotice(success) : null })
      if (next.draft.version !== draft.draft.version) void this.refreshPreview()
      return true
    } catch (error) {
      if (generation !== this.generation) return false
      const failure = classifyMotionEditorError(error)
      if (failure.kind === 'conflict') {
        // "Nothing changed since the last saved revision" is the publish answer for an unchanged source, not a moved draft.
        this.set({ ...this.state, saving: false, notice: this.makeNotice(failure.reason === 'unchanged' ? 'publishUnchanged' : 'conflict', failure.reason) })
        await this.reloadDraftNow()
      } else if (failure.kind === 'invalid') {
        const kind = failure.code === 'BRAND_MOTION_NOT_PUBLISHABLE' ? 'publishBlocked' : 'sourceRejected'
        this.set({ ...this.state, saving: false, notice: this.makeNotice(kind, failure.reason) })
      } else if (failure.kind === 'forbidden' || failure.kind === 'not_found' || failure.kind === 'unavailable') {
        this.set({ ...INITIAL_STATE, status: READ_FAILURE_STATUS[failure.kind], failure })
      } else {
        this.set({ ...this.state, saving: false, notice: this.makeNotice('saveFailed', failure.reason) })
      }
      return false
    }
  }

  /**
   * Re-reads the draft from the server (replaces the local copy and refreshes the preview). Used after a conflict and, E1-H,
   * when the Assistant ended a job of this draft's chat: the chat may have edited the draft, and the screen must show what the
   * server holds, never a stale copy. A running write of the user's own is not interrupted.
   */
  async reloadDraft(): Promise<void> {
    if (this.state.status !== 'ready' || this.state.saving) return
    await this.reloadDraftNow()
  }

  private async reloadDraftNow(): Promise<void> {
    const generation = this.generation
    try {
      const draft = await this.api.getDraft(this.options.draftId)
      if (generation !== this.generation) return
      this.set({ ...this.state, draft })
      void this.refreshPreview()
    } catch {
      // The notice already told the user; a failed reload leaves the last server copy on screen.
    }
  }

  private makeNotice(kind: MotionEditorNoticeKind, reason?: string | null): MotionEditorNotice {
    this.noticeId += 1
    return { id: this.noticeId, kind, ...(reason ? { reason } : {}) }
  }

  private notify(kind: MotionEditorNoticeKind, reason?: string | null): void {
    this.set({ ...this.state, notice: this.makeNotice(kind, reason) })
  }

  private set(next: MotionEditorState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}
