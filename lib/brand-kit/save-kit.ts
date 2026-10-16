import type { ChannelBrandOverlayPreset } from '@/lib/channel/api'

import type { BrandKitDetail, BrandKitDraftContent, BrandKitRevision } from './api'
import {
  draftContentChanged,
  draftContentFromEditor,
  overlayFromWatermark,
  resolveWatermarkAsset,
  watermarkChanged,
  type BrandKitEditor,
  type BrandWatermarkEditor,
} from './editor-model'

export type SaveBrandKitDeps = {
  updateBrandKitDraft: (input: { kitId: string; expectedDraftVersion: number; content: BrandKitDraftContent; name?: string }) => Promise<BrandKitDetail>
  publishBrandKitRevision: (input: { kitId: string; expectedDraftVersion: number }) => Promise<BrandKitRevision>
  updateChannelSettings: (input: {
    channelId: string
    expectedBrandOverlayVersion: number
    brandOverlay: ChannelBrandOverlayPreset
  }) => Promise<unknown>
}

export class BrandWatermarkAssetRequiredError extends Error {
  constructor() {
    super('A watermark needs a logo or a custom image')
    this.name = 'BrandWatermarkAssetRequiredError'
  }
}

/**
 * P06-01 "Kaydet" of the Brand Kit screen, in order: (1) write the draft only when the Kit tokens or
 * its name changed (CAS on the draft version the screen loaded), (2) cut the usable revision of that exact
 * draft version (its idempotency key is derived from the version, so a retry never cuts a second
 * one), (3) write the channel watermark overlay only when it changed (Channel BC, CAS on its
 * version). A failure stops the sequence; nothing is kept in the browser.
 */
export async function saveBrandKit(
  input: {
    editor: BrandKitEditor
    baseContent: BrandKitDraftContent
    /** The Kit's name as loaded; a different, non-empty editor name is saved with the draft. */
    baseName?: string
    watermark: BrandWatermarkEditor
    channelId: string
    overlay: ChannelBrandOverlayPreset | null
    overlayVersion: number
  },
  deps: SaveBrandKitDeps,
): Promise<{ draftVersion: number; revision: BrandKitRevision; overlaySaved: boolean }> {
  const { editor, watermark } = input
  if (watermark.enabled && !resolveWatermarkAsset(watermark, editor.logos)) throw new BrandWatermarkAssetRequiredError()
  const content = draftContentFromEditor(editor, input.baseContent)
  let draftVersion = editor.draftVersion
  const name = editor.name.trim()
  const renamed = input.baseName !== undefined && name.length > 0 && name !== input.baseName
  if (draftContentChanged(content, input.baseContent) || renamed) {
    const updated = await deps.updateBrandKitDraft({
      kitId: editor.kitId,
      expectedDraftVersion: draftVersion,
      content,
      ...(renamed ? { name } : {}),
    })
    draftVersion = updated.draft?.version ?? draftVersion + 1
  }
  const revision = await deps.publishBrandKitRevision({ kitId: editor.kitId, expectedDraftVersion: draftVersion })
  let overlaySaved = false
  if (watermarkChanged(watermark, editor.logos, input.overlay)) {
    await deps.updateChannelSettings({
      channelId: input.channelId,
      expectedBrandOverlayVersion: input.overlayVersion,
      brandOverlay: overlayFromWatermark(watermark, editor.logos),
    })
    overlaySaved = true
  }
  return { draftVersion, revision, overlaySaved }
}
