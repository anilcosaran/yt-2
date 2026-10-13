import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'
import { motionExposedParameterSchema, type MotionExposedParameter } from '@/lib/motion-editor/api'

import type { CompositionMotionEnergy, CompositionMotionRevisionRef } from './composition-typed-edits'

/**
 * E1-D: the exposed fields (`motion_exposure_v1`) of the exact Motion revision an instance pins: the Properties panel shows
 * exactly these (text, colour, image, length) and nothing the revision does not expose. A platform revision is read from the
 * typed library (`GET /api/v1/brand/motions/:id/revisions/:rev`, behind `BRAND_MOTION_TYPED_SEEDS_ENABLED`); a saved Motion
 * from the user's own revisions (`GET /api/v1/brand/motion-revisions/:id`, behind `BRAND_MOTION_AUTHORING_ENABLED`, owner
 * only). The pin is compared by its manifest digest: a revision that does not match the pin is never shown in its place.
 *
 * The same read answers whether the Motion can sit over other layers (E1-C): a Motion that drives a camera (`world` /
 * `camera` nodes, `camera_phase` tracks) or draws content the scene compiler does not stage (video, kit and code components,
 * media windows) is its own scene only. The gateway refuses such an overlay at compile time with a per-layer warning; this
 * scan lets the drawer say so BEFORE anything is written.
 */

const patternBodySchema = z
  .object({ nodes: z.array(z.unknown()).default([]), tracks: z.array(z.unknown()).default([]) })
  .passthrough()

/** The energies the typed pattern offers (`manifest.energy_variants`): what `motion.instance.insert` accepts. */
const patternManifestSchema = z
  .object({ energy_variants: z.array(z.object({ energy: z.string() }).passthrough()).optional() })
  .passthrough()

const libraryRevisionSchema = z.object({
  data: z.object({
    ref: z.object({ manifest_sha256: z.string() }).passthrough(),
    exposure: z.object({ parameters: z.array(motionExposedParameterSchema) }).passthrough(),
    sample_values: z.record(z.union([z.string(), z.number()])).optional(),
    pattern: z.object({ body: patternBodySchema, manifest: patternManifestSchema.optional() }).passthrough().optional(),
  }),
})

const ownedRevisionSchema = z.object({
  data: z.object({
    ref: z.object({ manifest_sha256: z.string() }).passthrough(),
    parameters: z.array(motionExposedParameterSchema),
    revision: z
      .object({ pattern: z.object({ body: patternBodySchema, manifest: patternManifestSchema.optional() }).passthrough().optional() })
      .passthrough()
      .optional(),
  }),
})

/**
 * T1R-5: what a workspace that BOUGHT a Motion reads about it (`GET /api/v1/motion-market/library`): the exposed fields to edit in its
 * projects and the overlay fact. Never the pattern: the source stays with the seller.
 */
const licensedLibrarySchema = z.object({
  data: z.object({
    items: z.array(
      z
        .object({
          motion_id: z.string(),
          motion_revision_id: z.string(),
          ref: z.object({ manifest_sha256: z.string() }).passthrough(),
          parameters: z.array(motionExposedParameterSchema),
          overlay_block: z.enum(['camera', 'content']).nullable().optional(),
        })
        .passthrough(),
    ),
  }),
})

/** Why a Motion cannot be a scene overlay: it moves a camera, or draws content the scene compiler does not stage. */
export type MotionOverlayBlock = 'camera' | 'content'

export type MotionExposure = {
  parameters: MotionExposedParameter[]
  sampleValues: Record<string, string | number>
  /** Null when nothing in the typed source rules the overlay out (or the source was not part of the read). */
  overlayBlock: MotionOverlayBlock | null
  /**
   * WP4: the energies the revision offers (its `manifest.energy_variants`); null or absent when the typed source was not part
   * of the read (a Motion this workspace bought). A saved Motion may offer only Calm or Lively: the insert must not name another.
   */
  energies?: CompositionMotionEnergy[] | null
}

const ENERGIES: readonly string[] = ['sakin', 'dengeli', 'canli']

/** The pattern's energies, or null when the read carried no manifest (nothing is guessed). */
export function energiesOfManifest(manifest: { energy_variants?: ReadonlyArray<{ energy: string }> } | undefined): CompositionMotionEnergy[] | null {
  if (!manifest?.energy_variants) return null
  return manifest.energy_variants.map((variant) => variant.energy).filter((energy): energy is CompositionMotionEnergy => ENERGIES.includes(energy))
}

const CAMERA_NODES: ReadonlySet<string> = new Set(['world', 'camera'])
const UNSTAGED_NODES: ReadonlySet<string> = new Set(['video', 'kit_component', 'code_component'])

function visitNodes(nodes: readonly unknown[], visit: (kind: string) => void): void {
  for (const node of nodes) {
    if (typeof node !== 'object' || node === null) continue
    const { kind, children } = node as { kind?: unknown; children?: unknown }
    if (typeof kind === 'string') visit(kind)
    if (Array.isArray(children)) visitNodes(children, visit)
  }
}

function visitTracks(tracks: readonly unknown[], visit: (kind: string) => void): void {
  for (const track of tracks) {
    if (typeof track !== 'object' || track === null) continue
    const { kind, tracks: inner } = track as { kind?: unknown; tracks?: unknown }
    if (typeof kind === 'string') visit(kind)
    if (kind === 'timeline' && Array.isArray(inner)) visitTracks(inner, visit)
  }
}

/** The gateway's own rule (`overlayRefusal` of the scene compiler) applied to the typed source: camera first, then unstaged content. */
export function overlayBlockOfPattern(body: { nodes: readonly unknown[]; tracks: readonly unknown[] } | undefined): MotionOverlayBlock | null {
  if (!body) return null
  let camera = false
  let content = false
  visitNodes(body.nodes, (kind) => {
    if (CAMERA_NODES.has(kind)) camera = true
    else if (UNSTAGED_NODES.has(kind)) content = true
  })
  visitTracks(body.tracks, (kind) => {
    if (kind === 'camera_phase') camera = true
    else if (kind === 'media_window') content = true
  })
  return camera ? 'camera' : content ? 'content' : null
}

export type MotionExposureRequest = typeof gatewayRequest

/** Saved Motions are `bmot_u_…`; everything else is the platform library. */
export const isOwnedMotionId = (motionId: string) => motionId.startsWith('bmot_u_')

export class MotionExposureMismatchError extends Error {
  constructor() {
    super('The Motion revision does not match the one the project pins.')
    this.name = 'MotionExposureMismatchError'
  }
}

const cache = new Map<string, Promise<MotionExposure>>()

/**
 * `loadMotionExposure` shared per exact revision: a revision is immutable by its manifest digest, so the one read serves the
 * Properties fields and the overlay scan alike (and every later selection of an instance that pins it). A failed read is not
 * kept, so the next ask tries again.
 */
export function loadMotionExposureShared(ref: CompositionMotionRevisionRef, options: { request?: MotionExposureRequest } = {}): Promise<MotionExposure> {
  const key = `${ref.motion_id}/${ref.motion_revision_id}/${ref.manifest_sha256}`
  let read = cache.get(key)
  if (!read) {
    read = loadMotionExposure(ref, options)
    cache.set(key, read)
    read.catch(() => {
      if (cache.get(key) === read) cache.delete(key)
    })
  }
  return read
}

export function resetMotionExposureCacheForTests(): void {
  cache.clear()
}

export async function loadMotionExposure(
  ref: CompositionMotionRevisionRef,
  options: { signal?: AbortSignal; request?: MotionExposureRequest } = {},
): Promise<MotionExposure> {
  const request = options.request ?? gatewayRequest
  if (isOwnedMotionId(ref.motion_id)) {
    let result
    try {
      result = await request(`/api/v1/brand/motion-revisions/${encodeURIComponent(ref.motion_revision_id)}`, { schema: ownedRevisionSchema, signal: options.signal })
    } catch (error) {
      // Not the author's revision (another member's, or a Motion this workspace bought): the owner route answers 404.
      if (!isAuthClientError(error) || error.status !== 404) throw error
      return loadLicensedExposure(ref, request, options.signal, error)
    }
    if (result.data.ref.manifest_sha256 !== ref.manifest_sha256) throw new MotionExposureMismatchError()
    const pattern = result.data.revision?.pattern
    return { parameters: result.data.parameters, sampleValues: {}, overlayBlock: overlayBlockOfPattern(pattern?.body), energies: energiesOfManifest(pattern?.manifest) }
  }
  const result = await request(`/api/v1/brand/motions/${encodeURIComponent(ref.motion_id)}/revisions/${encodeURIComponent(ref.motion_revision_id)}`, {
    schema: libraryRevisionSchema,
    signal: options.signal,
  })
  if (result.data.ref.manifest_sha256 !== ref.manifest_sha256) throw new MotionExposureMismatchError()
  return {
    parameters: result.data.exposure.parameters,
    sampleValues: result.data.sample_values ?? {},
    overlayBlock: overlayBlockOfPattern(result.data.pattern?.body),
    energies: energiesOfManifest(result.data.pattern?.manifest),
  }
}

/** The exposure of a Motion this workspace holds a licence for, from its library; the owner route's own answer when it is not in it. */
async function loadLicensedExposure(ref: CompositionMotionRevisionRef, request: MotionExposureRequest, signal: AbortSignal | undefined, notOwned: unknown): Promise<MotionExposure> {
  const library = await request('/api/v1/motion-market/library', { schema: licensedLibrarySchema, signal })
  const item = library.data.items.find((entry) => entry.motion_revision_id === ref.motion_revision_id)
  if (!item) throw notOwned
  if (item.ref.manifest_sha256 !== ref.manifest_sha256) throw new MotionExposureMismatchError()
  return { parameters: item.parameters, sampleValues: {}, overlayBlock: item.overlay_block ?? null, energies: null }
}
