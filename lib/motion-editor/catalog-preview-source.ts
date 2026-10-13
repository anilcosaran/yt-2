import { previewMotionDraft, type MotionDraftPreview } from './api'
import type { CatalogItem } from './catalog-model'

/**
 * Where a `/motion` card gets the picture it draws live. The runtime draws a COMPILED document (`motion-ir@1`), and the only
 * compile the gateway offers a browser is a draft's (`GET /api/v1/brand/motion-drafts/{id}/preview`): a draft, and a saved
 * Motion through the draft it was published from, have one. A platform catalogue Motion has none: there is no compile
 * endpoint for a library revision (and a forked draft per card would write state just for looking), so its card shows the
 * static poster until the gateway offers one. That is a single seam: give `DEFAULT_CATALOG_PREVIEW_SOURCE.load` an answer
 * for `item.kind === 'platform'` and every card and the dialog draw it live, nothing else changes.
 */

export type CatalogPreview = {
  ir: Record<string, unknown>
  sha: string
  durationFrames: number
  ratio: string
  fps: number
}

export type CatalogPreviewSource = {
  /** Whether this item can ever be drawn live (decides if the card asks for a player slot at all). */
  canPreview: (item: CatalogItem) => boolean
  /** Reads the compile; rejects when it cannot be read (the card keeps its poster). */
  load: (item: CatalogItem, options: { signal?: AbortSignal }) => Promise<CatalogPreview>
}

export function catalogPreviewFromDraft(preview: MotionDraftPreview): CatalogPreview {
  const fps = typeof preview.document['fps'] === 'number' && preview.document['fps'] > 0 ? preview.document['fps'] : 30
  return { ir: preview.document, sha: preview.document_sha256, durationFrames: preview.duration_frames, ratio: preview.ratio, fps }
}

export function createCatalogPreviewSource(
  read: typeof previewMotionDraft = previewMotionDraft,
): CatalogPreviewSource & { cached: (item: CatalogItem) => CatalogPreview | null } {
  // Held in memory for the life of the screen only, so a card that scrolls back into view does not read its compile again.
  const cache = new Map<string, CatalogPreview>()
  const inflight = new Map<string, Promise<CatalogPreview>>()
  const canPreview = (item: CatalogItem) => item.draftId !== null
  return {
    canPreview,
    cached: (item) => cache.get(item.id) ?? null,
    load: (item, options) => {
      const hit = cache.get(item.id)
      if (hit) return Promise.resolve(hit)
      if (!item.draftId) return Promise.reject(new Error('no_compile'))
      const pending = inflight.get(item.id)
      if (pending) return pending
      const request = read(item.draftId, {}, { signal: options.signal })
        .then((preview) => {
          const value = catalogPreviewFromDraft(preview)
          cache.set(item.id, value)
          return value
        })
        .finally(() => {
          inflight.delete(item.id)
        })
      inflight.set(item.id, request)
      return request
    },
  }
}
