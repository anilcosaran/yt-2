import type { AvatarShot } from '@/lib/avatar/api'

import { layerSetTransformSpec, newLayerId, type CompositionTransform } from './composition-typed-edits'
import { classifySceneMedia } from './scene-media-policy'
import { containFit } from './stage/geometry'
import { centredTransformAt, type CanvasPoint, type StagePlacement } from './stage/placement'
import { clipInsertSequenceSpec } from './stage/stage-edits'
import type { PlacedLayers } from './stage/stage-controller'
import type { NaturalSize } from './image-size'

/**
 * E1-J Avatar (D6): v1 inserts the IMAGE of an avatar look as an ordinary image layer (free; talking avatars are a later
 * round). Pure parts of that: what a dragged avatar card carries, where the picture goes (default: the right third of
 * the canvas, centred in it; at the drop point for a canvas drop) and the one command that adds it.
 */

/** The card kind an avatar card carries while it is dragged (`writeCardDrag`, tool `avatar`). */
export const AVATAR_CARD_KIND = 'avatar_look'

/**
 * A look the user picked. `own`: a look of the workspace's avatar (`/api/v1/avatars`); its image is a Storage object of
 * the project's channel, bound to the project as it is. `public`: a stock avatar of `/api/v1/public-avatars`: the catalogue
 * keeps only a platform preview (no Storage object of the workspace), so the picture is copied into the workspace's
 * Storage folder "Spark" first.
 */
export type AvatarLook =
  | { source: 'own'; avatarId: string; name: string; storageObjectId: string | null; primaryShotId: string | null; previewObjectId: string | null }
  | { source: 'public'; templateId: string; name: string; previewUrl: string }

/** JSON-safe payload of a dragged card (ids and the card's own preview URL, nothing else). */
export function avatarLookToDragData(look: AvatarLook): Record<string, unknown> {
  return look.source === 'own'
    ? {
        source: 'own',
        avatarId: look.avatarId,
        name: look.name,
        storageObjectId: look.storageObjectId,
        primaryShotId: look.primaryShotId,
        previewObjectId: look.previewObjectId,
      }
    : { source: 'public', templateId: look.templateId, name: look.name, previewUrl: look.previewUrl }
}

export function avatarLookFromDragData(data: Record<string, unknown>): AvatarLook | null {
  const name = typeof data['name'] === 'string' ? data['name'] : ''
  if (data['source'] === 'own' && typeof data['avatarId'] === 'string' && data['avatarId']) {
    return {
      source: 'own',
      avatarId: data['avatarId'],
      name,
      storageObjectId: typeof data['storageObjectId'] === 'string' ? data['storageObjectId'] : null,
      primaryShotId: typeof data['primaryShotId'] === 'string' ? data['primaryShotId'] : null,
      previewObjectId: typeof data['previewObjectId'] === 'string' ? data['previewObjectId'] : null,
    }
  }
  if (data['source'] === 'public' && typeof data['templateId'] === 'string' && data['templateId'] && typeof data['previewUrl'] === 'string' && data['previewUrl']) {
    return { source: 'public', templateId: data['templateId'], name, previewUrl: data['previewUrl'] }
  }
  return null
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  // `+ 0` turns a rounded -0 into 0 (a layer never carries a negative zero).
  return Math.round(value * factor) / factor + 0
}

/**
 * The transform of an avatar picture of `natural` pixels. The compiler fits an image inside the canvas (contain) and a
 * transform's x/y is the TOP-LEFT of that box, scaled about the corner. Default: the box shrunk to fit the right third
 * of the canvas and centred in it (never enlarged past its fitted size). With a drop point (canvas drop): the same size,
 * centred on the point and kept inside the canvas. Null when the size is unknown (then the picture stays fitted and
 * centred, never placed from a guess).
 */
export function avatarTransform(
  canvas: { width: number; height: number },
  natural: NaturalSize | null,
  dropPoint: CanvasPoint | null = null,
): CompositionTransform | null {
  if (!natural || !(natural.width > 0 && natural.height > 0)) return null
  const box = containFit(canvas, natural.width, natural.height)
  const region = { width: canvas.width / 3, height: canvas.height }
  // Rounded DOWN so the scaled box never leaves the region.
  const scale = Math.floor(Math.min(1, region.width / box.width, region.height / box.height) * 1e4) / 1e4
  if (dropPoint) return centredTransformAt(dropPoint, box, canvas, scale)
  return {
    x: round(canvas.width - region.width + (region.width - box.width * scale) / 2, 2),
    y: round((canvas.height - box.height * scale) / 2, 2),
    scale,
    rotation_deg: 0,
  }
}

/**
 * The command that adds an avatar picture at a resolved placement (scene, start frame, drop point): one
 * `clip.insert_sequence` on top of the scene, held until the scene ends, and its transform: ONE command, one undo group.
 * `layerId` is the new layer (selected once it is drawn).
 */
export function avatarPlacement(input: {
  placement: StagePlacement
  sourceId: string
  naturalSize: NaturalSize | null
  uuid: () => string
}): PlacedLayers {
  const { placement } = input
  const layerId = newLayerId(input.uuid())
  const transform = avatarTransform(placement.canvas, input.naturalSize, placement.dropPoint)
  return {
    specs: [
      clipInsertSequenceSpec({
        sceneId: placement.sceneId,
        afterLayerId: placement.afterLayerId,
        startFrame: placement.startFrame,
        // The look stays for the rest of the scene (a stock photo holds 3 s, a presenter belongs to the whole scene).
        imageHoldFrames: Math.max(1, placement.sceneFrames - placement.startFrame),
        items: [{ layerId, sourceId: input.sourceId }],
      }),
      ...(transform ? [layerSetTransformSpec(placement.sceneId, layerId, transform)] : []),
    ],
    selectLayerId: layerId,
  }
}

// ---------------------------------------------------------------- reading a look

/**
 * The Storage object of an own avatar's look: the primary completed look with an image, else the first completed one,
 * else the avatar's own preview object (null when it has none).
 */
export function pickOwnLookObject(shots: readonly AvatarShot[], primaryShotId: string | null, previewObjectId: string | null): string | null {
  const usable = shots.filter((shot) => shot.status === 'completed' && shot.storage_object_id)
  const primary = usable.find((shot) => shot.id === primaryShotId) ?? usable.find((shot) => shot.is_primary) ?? usable[0]
  return primary?.storage_object_id ?? previewObjectId
}

// ---------------------------------------------------------------- copying a stock avatar's picture

export type AvatarImportFailure = 'fetch_failed' | 'unsupported_type' | 'too_large'

export class AvatarImportError extends Error {
  constructor(readonly reason: AvatarImportFailure) {
    super(`avatar image import failed: ${reason}`)
    this.name = 'AvatarImportError'
  }
}

/** A stock avatar's picture is a portrait, a few MB at most; anything larger is not an avatar image. */
export const AVATAR_IMPORT_MAX_BYTES = 25 * 1024 * 1024

const EXTENSION_OF: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' }

function fileBaseName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 48)
  return slug || 'avatar'
}

/**
 * Reads a stock avatar's preview picture (its signed URL, public to the page that shows it) into a `File`. The picture
 * must be PNG, JPEG or WebP (D10) and not larger than `AVATAR_IMPORT_MAX_BYTES`; no credentials are sent to the CDN.
 */
export async function fetchPublicAvatarFile(input: {
  url: string
  name: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}): Promise<File> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis)
  let response: Response
  try {
    response = await fetchImpl(input.url, { credentials: 'omit', ...(input.signal && { signal: input.signal }) })
  } catch (error) {
    if (input.signal?.aborted) throw error
    throw new AvatarImportError('fetch_failed')
  }
  if (!response.ok) throw new AvatarImportError('fetch_failed')
  const blob = await response.blob()
  const mimeType = (blob.type || response.headers.get('content-type') || '').split(';', 1)[0]!.trim().toLowerCase()
  const kind = classifySceneMedia({ mimeType })
  if (!kind.ok || kind.kind !== 'image') throw new AvatarImportError('unsupported_type')
  if (blob.size === 0 || blob.size > AVATAR_IMPORT_MAX_BYTES) throw new AvatarImportError(blob.size === 0 ? 'fetch_failed' : 'too_large')
  const extension = EXTENSION_OF[mimeType] ?? 'png'
  return new File([blob], `${fileBaseName(input.name)}.${extension}`, { type: mimeType })
}
