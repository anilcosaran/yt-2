/**
 * WP4/WP5a: what the stage shows the moment the user adds something whose server write is still queued, before the
 * server's picture has it: a selected placeholder box for a Motion (the gateway compiles it), and the local file itself for
 * a picked image or video that is still uploading or being processed. Nothing here is part of the document or sent anywhere:
 * a placeholder is a picture of intent, removed when the real layer is drawn or the insert ends without one.
 *
 * One store per stage controller (`pendingInsertsFor(controller)`), so the tools that add and the stage that draws share it
 * without a new field on either. In memory only; the local preview URL is an object URL of the user's own file that its
 * owner (the media upload queue) creates and revokes.
 */

export type PendingInsertKind = 'motion' | 'image' | 'video' | 'audio'

/** `saving`: queued or sent to the server; `uploading` / `processing`: a media file on its way to becoming a source. */
export type PendingInsertStatus = 'saving' | 'uploading' | 'processing'

export type PendingInsert = {
  id: string
  kind: PendingInsertKind
  /** The card title or the file name. */
  label: string
  status: PendingInsertStatus
  /** 0-100 while uploading, else null. */
  progress: number | null
  /** An object URL of the local file (image or video) to show meanwhile; never a remote URL. */
  previewUrl: string | null
  /**
   * Timeline v3: a still of a Storage object being added from the drawer (the card's short-lived signed thumbnail the drawer
   * already shows), drawn when there is no local file. Never stored or sent anywhere.
   */
  posterUrl: string | null
  /** The scene it lands in when known (the stage shows it there only), else null: the scene under the playhead. */
  sceneId: string | null
}

export type PendingInsertInput = Omit<PendingInsert, 'id' | 'progress' | 'previewUrl' | 'posterUrl' | 'sceneId'> &
  Partial<Pick<PendingInsert, 'progress' | 'previewUrl' | 'posterUrl' | 'sceneId'>>

const EMPTY: readonly PendingInsert[] = []

export class PendingInsertStore {
  private items: readonly PendingInsert[] = EMPTY
  private readonly listeners = new Set<() => void>()
  private counter = 0

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = (): readonly PendingInsert[] => this.items

  add(input: PendingInsertInput): string {
    this.counter += 1
    const id = `pending_${this.counter}`
    this.set([...this.items, { progress: null, previewUrl: null, posterUrl: null, sceneId: null, ...input, id }])
    return id
  }

  update(id: string, patch: Partial<Omit<PendingInsert, 'id' | 'kind'>>): void {
    if (!this.items.some((item) => item.id === id)) return
    this.set(this.items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  remove(id: string): void {
    if (!this.items.some((item) => item.id === id)) return
    const next = this.items.filter((item) => item.id !== id)
    this.set(next.length === 0 ? EMPTY : next)
  }

  has(id: string): boolean {
    return this.items.some((item) => item.id === id)
  }

  private set(next: readonly PendingInsert[]): void {
    this.items = next
    for (const listener of [...this.listeners]) listener()
  }
}

const stores = new WeakMap<object, PendingInsertStore>()

/** The placeholder store of one stage (keyed by its controller). */
export function pendingInsertsFor(owner: object): PendingInsertStore {
  let store = stores.get(owner)
  if (!store) {
    store = new PendingInsertStore()
    stores.set(owner, store)
  }
  return store
}
