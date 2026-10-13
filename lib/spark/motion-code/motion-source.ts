import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'
import { motionPatternToText } from '@/lib/motion-editor/session'

import type { CompositionMotionRevisionRef } from '../composition-typed-edits'

/**
 * Code tab: the readable source of the exact Motion revision a layer pins. The source of a revision is its typed pattern
 * (`motion-library@1`, shown as JSON like the Motion editor's code panel). It is read by the revision's manifest digest, so the
 * one read serves every later selection of a layer that pins it (immutable), and a revision that does not match the pin is
 * never shown in its place.
 *
 * Where each kind of revision is read from (all existing endpoints):
 * - a platform revision (`bmot_…`, library): `GET /api/v1/brand/motions/:id/revisions/:rev` (`BRAND_MOTION_TYPED_SEEDS_ENABLED`);
 * - a saved Motion of the user (`bmot_u_…`): `GET /api/v1/brand/motion-revisions/:id` (`BRAND_MOTION_AUTHORING_ENABLED`, owner only);
 * - a Motion this workspace bought: its source stays with the seller, so there is no source to show.
 *
 * GAP (P06-35 "Kalan" 2): a project-private code revision (`scope: project_private`, an LLM-written scene, `cmrev_…`) has a use
 * case in Composition (`GetCompositionMotionCodeRevisionUseCase`) but NO HTTP route and no OpenAPI entry yet, and a
 * `motion_instance` layer cannot pin one yet either (`motion.instance.insert` / `upgrade` refuse `project_private`). Until the
 * route exists `loadMotionSource` answers `project_private_unreadable` and the tab stays hidden for such a layer; the wiring
 * point is the `project_private` branch of `loadMotionSource`. No URL or response shape is invented here.
 */

export type MotionSource = {
  format: 'motion-library@1'
  /** The pattern as the JSON the user reads and edits. */
  text: string
  pattern: Record<string, unknown>
  /** `saved`: the user's own Motion (editable through a draft); `library`: a platform revision (read-only until forked). */
  origin: 'library' | 'saved'
}

export type MotionSourceUnavailableReason =
  | 'project_private_unreadable'
  | 'licensed_source_hidden'
  | 'not_found'
  | 'mismatch'
  | 'unreadable'

export class MotionSourceUnavailableError extends Error {
  constructor(readonly reason: MotionSourceUnavailableReason) {
    super(`The Motion source is not readable (${reason}).`)
    this.name = 'MotionSourceUnavailableError'
  }
}

export type MotionSourceState =
  | { status: 'loading' }
  | { status: 'ready'; source: MotionSource }
  | { status: 'unavailable'; reason: MotionSourceUnavailableReason }

const patternSchema = z.record(z.unknown())
const libraryRevisionSchema = z.object({
  data: z.object({ ref: z.object({ manifest_sha256: z.string() }).passthrough(), pattern: patternSchema.optional() }).passthrough(),
})
const ownedRevisionSchema = z.object({
  data: z
    .object({
      ref: z.object({ manifest_sha256: z.string() }).passthrough(),
      revision: z.object({ pattern: patternSchema.optional() }).passthrough().optional(),
    })
    .passthrough(),
})

export type MotionSourceRequest = typeof gatewayRequest

/** Saved Motions are `bmot_u_…`; everything else is the platform library (the same rule as `motion-exposure.ts`). */
const isOwnedMotionId = (motionId: string) => motionId.startsWith('bmot_u_')

function sourceOf(pattern: Record<string, unknown> | undefined, origin: MotionSource['origin']): MotionSource {
  if (!pattern || Object.keys(pattern).length === 0) throw new MotionSourceUnavailableError('unreadable')
  return { format: 'motion-library@1', text: motionPatternToText(pattern), pattern, origin }
}

export async function loadMotionSource(
  ref: CompositionMotionRevisionRef,
  options: { signal?: AbortSignal; request?: MotionSourceRequest } = {},
): Promise<MotionSource> {
  const request = options.request ?? gatewayRequest
  if (ref.scope === 'project_private') throw new MotionSourceUnavailableError('project_private_unreadable')
  try {
    if (isOwnedMotionId(ref.motion_id)) {
      const result = await request(`/api/v1/brand/motion-revisions/${encodeURIComponent(ref.motion_revision_id)}`, { schema: ownedRevisionSchema, signal: options.signal })
      if (result.data.ref.manifest_sha256 !== ref.manifest_sha256) throw new MotionSourceUnavailableError('mismatch')
      return sourceOf(result.data.revision?.pattern, 'saved')
    }
    const result = await request(`/api/v1/brand/motions/${encodeURIComponent(ref.motion_id)}/revisions/${encodeURIComponent(ref.motion_revision_id)}`, {
      schema: libraryRevisionSchema,
      signal: options.signal,
    })
    if (result.data.ref.manifest_sha256 !== ref.manifest_sha256) throw new MotionSourceUnavailableError('mismatch')
    return sourceOf(result.data.pattern, 'library')
  } catch (error) {
    if (error instanceof MotionSourceUnavailableError) throw error
    // The owner route answers 404 for another member's revision or one this workspace bought (its source is not ours to show).
    if (isAuthClientError(error) && error.status === 404) throw new MotionSourceUnavailableError(isOwnedMotionId(ref.motion_id) ? 'licensed_source_hidden' : 'not_found')
    throw new MotionSourceUnavailableError('unreadable')
  }
}

const cache = new Map<string, Promise<MotionSource>>()

/** `loadMotionSource` shared per exact revision (immutable by digest). A failed read is not kept: the next ask tries again. */
export function loadMotionSourceShared(ref: CompositionMotionRevisionRef, options: { request?: MotionSourceRequest } = {}): Promise<MotionSource> {
  const key = `${ref.scope}/${ref.motion_id}/${ref.motion_revision_id}/${ref.manifest_sha256}`
  let read = cache.get(key)
  if (!read) {
    read = loadMotionSource(ref, options)
    cache.set(key, read)
    read.catch(() => {
      if (cache.get(key) === read) cache.delete(key)
    })
  }
  return read
}

export function resetMotionSourceCacheForTests(): void {
  cache.clear()
}

export function motionSourceStateOfError(error: unknown): MotionSourceState {
  return { status: 'unavailable', reason: error instanceof MotionSourceUnavailableError ? error.reason : 'unreadable' }
}
