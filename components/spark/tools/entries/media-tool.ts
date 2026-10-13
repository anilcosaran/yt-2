import type { PlacementTarget } from '@/lib/spark/stage/placement'

import { STOCK_CARD_KIND } from '../../spark-stock-drawer'
import { insertProjectSource } from '../insert-source'
import { MediaToolDrawer, stockDropHolderOf } from '../media-drawer'
import { LIBRARY_CARD_KIND } from '../media/media-library-tab'
import { mediaAdderOf, uploadAndPlace } from '../media/media-services'
import type { SparkToolContext, SparkToolEntry } from '../spark-tool-types'

const isMediaKind = (value: unknown): value is 'image' | 'video' | 'audio' => value === 'image' || value === 'video' || value === 'audio'

/**
 * Desktop files dropped on the canvas or the timeline (D10, D14): each accepted file is uploaded to the Storage folder
 * "Spark", bound to the project and placed at the drop as soon as it is ready; the refused ones (GIF, SVG, other types)
 * are named in a notice and never uploaded. The files of one drop all go to the same drop target.
 */
function dropFiles(ctx: SparkToolContext, files: File[], target: PlacementTarget): boolean {
  // WP5a: with instant editing the stage shows each image or video at once (an upload / processing placeholder).
  const result = uploadAndPlace(ctx, files, target)
  for (const file of result.refused) ctx.notify(`media.upload.refused.${file.reason}`, { name: file.name }, 'error')
  if (result.accepted.length > 0) ctx.notify('media.notices.uploading', { count: result.accepted.length })
  return result.accepted.length > 0
}

/**
 * Rail "Media". Enabled whenever the stage is on (uploads and "My media" need no platform catalogue); only the Stock TAB
 * of the drawer depends on the Stock gate. Without the stage the legacy rule stays: the tool opens when the Stock gate is
 * available (a new scene with the clip). Cards of this tool dropped on the canvas or the timeline are placed at the drop
 * (D14): a card of "My media" (`storage_object`), a Stock card (`stock_item`), a project source (`project_source`), or files
 * from the desktop.
 */
export const mediaTool: SparkToolEntry = {
  id: 'media',
  icon: 'image',
  labelKey: 'tools.media',
  availability: (ctx) => (ctx.stage || ctx.stockAvailability === 'available' ? { enabled: true } : { enabled: false, titleKey: 'comingSoon' }),
  Drawer: MediaToolDrawer,
  onDrop: async (ctx, drop, target) => {
    if (drop.kind === 'files') return dropFiles(ctx, drop.files, target)
    const { kind, data } = drop.drag
    if (kind === 'project_source') {
      const { sourceId, mediaKind } = data
      if (typeof sourceId !== 'string' || !isMediaKind(mediaKind)) return false
      return mediaAdderOf(ctx).addSource(sourceId, sourceId, mediaKind, target)
    }
    if (kind === LIBRARY_CARD_KIND) {
      const { storageObjectId, checksum, mediaKind, ready, name } = data
      if (typeof storageObjectId !== 'string' || !isMediaKind(mediaKind)) return false
      return mediaAdderOf(ctx).addObject(
        { id: storageObjectId, checksum: typeof checksum === 'string' ? checksum : null, kind: mediaKind, ready: ready === true, ...(typeof name === 'string' && { name }) },
        target,
      )
    }
    if (kind === STOCK_CARD_KIND) {
      const { itemId, revision } = data
      const handler = stockDropHolderOf(ctx).handler
      if (typeof itemId !== 'string' || typeof revision !== 'number' || !handler) return false
      return handler({ itemId, revision }, (sourceId, mediaKind) => insertProjectSource(ctx.current(), sourceId, mediaKind, target))
    }
    return false
  },
}
