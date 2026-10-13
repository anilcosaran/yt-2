import { AVATAR_CARD_KIND, avatarLookFromDragData } from '@/lib/spark/avatar-insert'

import { AvatarToolDrawer } from '../avatar-drawer'
import { insertAvatarLook } from '../avatar-insert-flow'
import type { SparkToolEntry } from '../spark-tool-types'

/**
 * Rail "Avatar" (E1-J, D6): a drawer with the stock and the workspace's avatars; adding one places the look's IMAGE as
 * a layer at the playhead (free; talking avatars are a later round). It works through the stage (placement, one command),
 * so without the stage the tool stays "coming soon"; a viewer or an empty project cannot add. Feature Control
 * `avatar_enabled` is read by the drawer, which then explains why it is disabled. A card dropped on the canvas or the
 * timeline (D14) is placed at the drop by the same path as the "+" click.
 */
export const avatarTool: SparkToolEntry = {
  id: 'avatar',
  icon: 'user',
  labelKey: 'tools.avatar',
  availability: (ctx) => {
    if (!ctx.stage) return { enabled: false, titleKey: 'comingSoon' }
    if (!ctx.stageCanWrite) return { enabled: false, titleKey: 'readOnly' }
    if (!ctx.hasScene) return { enabled: false, titleKey: 'stage.needsScene' }
    return { enabled: true }
  },
  Drawer: AvatarToolDrawer,
  onDrop: async (ctx, drop, target) => {
    if (drop.kind !== 'card' || drop.drag.kind !== AVATAR_CARD_KIND) return false
    const look = avatarLookFromDragData(drop.drag.data)
    return look ? insertAvatarLook(ctx, look, target) : false
  },
}
