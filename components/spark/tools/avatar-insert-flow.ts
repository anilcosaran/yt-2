import { listAvatarShots } from '@/lib/avatar/api'
import { attachPickedMedia, type PickedMedia } from '@/lib/spark/attach-picked-media'
import {
  AvatarImportError,
  avatarPlacement,
  fetchPublicAvatarFile,
  pickOwnLookObject,
  type AvatarLook,
} from '@/lib/spark/avatar-insert'
import { loadImageSize, type NaturalSize } from '@/lib/spark/image-size'
import type { PlacementTarget } from '@/lib/spark/stage/placement'
import { uploadToSparkFolder } from '@/lib/spark/spark-upload'
import { getStorageDeliveryUrl } from '@/lib/storage/api'

import type { SparkToolContext } from './spark-tool-types'

/**
 * E1-J "insert this avatar look" (D6), the one path of the Avatar drawer's "+", its drag and drop and the canvas /
 * timeline drop: the look's picture becomes a Storage object of the project's channel (an own look already is one; a
 * stock avatar's preview picture is copied into the "Spark" folder), is bound to the project as a source, and is placed
 * as an image layer through the stage (`placeLayer`: scene, start and drop point of the gesture, ONE command). Free:
 * nothing is generated or charged. Every failure is a sentence in the editor's toast; nothing is half-done silently.
 */

const say = (ctx: SparkToolContext, key: string, values?: Record<string, string | number>) => ctx.translate?.(key, values) ?? key

async function pickedMediaOf(ctx: SparkToolContext, look: AvatarLook): Promise<PickedMedia | 'no_look'> {
  const channelId = ctx.project.channelId
  if (look.source === 'own') {
    const objectId =
      look.storageObjectId ?? pickOwnLookObject(await listAvatarShots(look.avatarId, channelId), look.primaryShotId, look.previewObjectId)
    // The type is read from the Storage object itself (a look is an image the avatar BC produced).
    return objectId ? { storageObjectId: objectId, mimeType: null, name: look.name, width: null, height: null } : 'no_look'
  }
  const file = await fetchPublicAvatarFile({ url: look.previewUrl, name: look.name })
  return uploadToSparkFolder({ channelId, file })
}

/** The picture's pixel size when Storage did not record it: read it from the object's delivery URL. */
async function sizeFromStorage(ctx: SparkToolContext, objectId: string): Promise<NaturalSize | null> {
  try {
    const delivery = await getStorageDeliveryUrl({ channelId: ctx.project.channelId, objectId, variant: 'original' })
    return await loadImageSize(delivery.url)
  } catch {
    return null
  }
}

/** Resolves true when the avatar picture was placed. */
export async function insertAvatarLook(ctx: SparkToolContext, look: AvatarLook, target: PlacementTarget = { kind: 'playhead' }): Promise<boolean> {
  const stage = ctx.stage
  if (!stage || !ctx.stageCanWrite) return false
  const session = stage.controller.session
  try {
    const picked = await pickedMediaOf(ctx, look)
    if (picked === 'no_look') {
      ctx.toast(say(ctx, 'avatarTool.noLook'), 'error')
      return false
    }
    const attached = await attachPickedMedia({
      channelId: ctx.project.channelId,
      projectId: ctx.project.id,
      picked,
      baseRevision: () => session.workingCopyVersion(),
      refresh: () => session.refresh(),
    })
    if (attached.status === 'refused') {
      ctx.toast(say(ctx, 'avatarTool.unsupportedPicture'), 'error')
      return false
    }
    if (attached.status === 'processing') {
      ctx.toast(say(ctx, 'avatarTool.processing'), 'error')
      return false
    }
    if (attached.status === 'failed') {
      ctx.toast(say(ctx, attached.reason === 'unavailable' ? 'avatarTool.unavailable' : 'avatarTool.failed'), 'error')
      return false
    }
    if (attached.kind !== 'image') {
      ctx.toast(say(ctx, 'avatarTool.unsupportedPicture'), 'error')
      return false
    }
    const naturalSize = attached.naturalSize ?? (await sizeFromStorage(ctx, attached.storageObjectId))
    const placed = await stage.controller.placeLayer(
      (placement) => avatarPlacement({ placement, sourceId: attached.sourceId, naturalSize, uuid: () => globalThis.crypto.randomUUID() }),
      target,
    )
    if (placed.applied) ctx.toast(say(ctx, 'avatarTool.added', { name: look.name }))
    return placed.applied
  } catch (error) {
    if (error instanceof AvatarImportError) {
      ctx.toast(say(ctx, `avatarTool.import.${error.reason}`), 'error')
      return false
    }
    ctx.toast(say(ctx, 'avatarTool.failed'), 'error')
    return false
  }
}
