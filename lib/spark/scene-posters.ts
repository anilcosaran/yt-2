import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P02-16 scene card posters from the P02-13 dependency-hash poster cache. The strip never plays a
 * live video or iframe in a card: it shows the cached poster frame of the scene's current content,
 * or its previous poster while the new one renders. Only the scenes on screen are resolved, in one
 * bounded request.
 */

/** P02-13 limit: scenes per resolve request. */
export const SCENE_POSTER_BATCH_LIMIT = 200

const posterSchema = z.object({
  asset_ref: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  dependency_hash: z.string().min(1),
})

const resolveResponseSchema = z.object({
  data: z.object({
    project_id: z.string().min(1),
    working_copy_version: z.number().int(),
    poster_profile: z.string(),
    items: z.array(z.object({
      scene_id: z.string().min(1),
      dependency_hash: z.string().min(1),
      status: z.string(),
      poster: posterSchema.nullable(),
      previous_poster: posterSchema.nullable(),
      failure_code: z.string().nullable(),
    })),
  }),
})

export type ScenePoster = z.output<typeof posterSchema>
export type ScenePosterItem = z.output<typeof resolveResponseSchema>['data']['items'][number]

export async function resolveScenePosters(
  projectId: string,
  sceneIds: readonly string[],
  options: { signal?: AbortSignal } = {},
): Promise<ScenePosterItem[]> {
  const ids = [...new Set(sceneIds)].slice(0, SCENE_POSTER_BATCH_LIMIT)
  if (ids.length === 0) return []
  const response = await gatewayRequest(
    `/api/v1/composition/projects/${encodeURIComponent(projectId)}/scene-posters/resolve`,
    { method: 'POST', csrf: true, body: { scene_ids: ids }, schema: resolveResponseSchema, signal: options.signal },
  )
  return response.data.items
}

/**
 * Posters per scene, fenced by request order (K240): a late answer to an older request never
 * replaces what a newer request already delivered for the same scene.
 */
export class ScenePosterBoard {
  private sequence = 0
  private readonly entries = new Map<string, { seq: number; item: ScenePosterItem }>()

  /** Starts a request; pass the returned sequence to `apply` with its answer. */
  begin(): number {
    this.sequence += 1
    return this.sequence
  }

  /** Applies an answer; returns true when anything visible changed. */
  apply(seq: number, items: readonly ScenePosterItem[]): boolean {
    let changed = false
    for (const item of items) {
      const current = this.entries.get(item.scene_id)
      if (current && current.seq > seq) continue
      if (!current || current.item.dependency_hash !== item.dependency_hash || displayPoster(current.item) !== displayPoster(item)) {
        changed = true
      }
      this.entries.set(item.scene_id, { seq, item })
    }
    return changed
  }

  /** The poster to show: the current one when ready, else the previous one; null shows the empty card. */
  poster(sceneId: string): ScenePoster | null {
    const entry = this.entries.get(sceneId)
    return entry ? displayPoster(entry.item) : null
  }
}

function displayPoster(item: ScenePosterItem): ScenePoster | null {
  return item.poster ?? item.previous_poster
}

/**
 * Turns a poster's frame-service `asset_ref` into an image URL. Poster delivery (asset_ref to a
 * signed/proxied URL) belongs to P06-46; until it exists the editor has no resolver and shows the
 * design's empty card instead of requesting posters it cannot display.
 */
export type ScenePosterUrlResolver = (poster: ScenePoster) => string | null
