import type { ChannelBrandOverlayPreset } from '@/lib/channel/api'

import type {
  BrandFontRef,
  BrandKitDetail,
  BrandKitDraftContent,
  PlatformFontFace,
} from './api'

/**
 * P06-01: the Brand Kit screen's form state. It is loaded from the server draft (`brand_kit_content_v1`)
 * and only lives in React state until "Save" writes the draft and cuts a revision; it is never
 * persisted in the browser. The watermark is the channel overlay (Channel BC), edited next to the Kit.
 */

export const BRAND_COLOR_KEYS = ['primary', 'secondary', 'tertiary', 'accent'] as const
export type BrandColorKey = (typeof BRAND_COLOR_KEYS)[number]

export const BRAND_LOGO_SLOTS = ['primary', 'horizontal', 'mark'] as const
export type BrandLogoSlot = (typeof BRAND_LOGO_SLOTS)[number]

export const BRAND_OVERLAY_ANCHORS = [
  'auto_safe',
  'top_left',
  'top_center',
  'top_right',
  'middle_left',
  'center',
  'middle_right',
  'bottom_left',
  'bottom_center',
  'bottom_right',
] as const
export type BrandOverlayAnchor = (typeof BRAND_OVERLAY_ANCHORS)[number]

export const BRAND_OVERLAY_ANIMATIONS = ['static', 'corner_cycle', 'fade_corner_cycle'] as const
export type BrandOverlayAnimation = (typeof BRAND_OVERLAY_ANIMATIONS)[number]

/** A Storage image picked for a logo slot; `name` is only known for a selection made in this session. */
export type BrandAssetRef = {
  storageObjectId: string
  name: string | null
  mimeType: string | null
  width: number | null
  height: number | null
}

export type BrandFontToken = { family: string; weight: number; fontRef: BrandFontRef | null }

export type BrandKitEditor = {
  kitId: string
  name: string
  draftVersion: number
  colors: Record<BrandColorKey, string>
  fonts: { title: BrandFontToken; body: BrandFontToken }
  captions: { styleName: string; fontColor: string; highlightColor: string; effectColor: string }
  logos: Record<BrandLogoSlot, BrandAssetRef | null>
}

export type BrandWatermarkEditor = {
  enabled: boolean
  enforce: boolean
  source: 'primary_logo' | 'custom_asset'
  asset: BrandAssetRef | null
  anchor: BrandOverlayAnchor
  widthRatio: number
  opacity: number
  marginRatio: number
  animationMode: BrandOverlayAnimation
  intervalSeconds: number
  fadeSeconds: number
}

export function assetRefOf(storageObjectId: string): BrandAssetRef {
  return { storageObjectId, name: null, mimeType: null, width: null, height: null }
}

/** Editor state of the owner's draft. Throws when the detail carries no draft (a shared reader's view). */
export function editorFromDraft(detail: BrandKitDetail): BrandKitEditor {
  if (!detail.draft) throw new Error('Only the Kit owner edits its draft')
  const content = detail.draft.content
  return {
    kitId: detail.kit_id,
    name: detail.name,
    draftVersion: detail.draft.version,
    colors: { ...content.colors },
    fonts: {
      title: { family: content.fonts.title.family, weight: content.fonts.title.weight, fontRef: content.fonts.title.font_ref },
      body: { family: content.fonts.body.family, weight: content.fonts.body.weight, fontRef: content.fonts.body.font_ref },
    },
    captions: {
      styleName: content.captions.style_name,
      fontColor: content.captions.font_color,
      highlightColor: content.captions.highlight_color,
      effectColor: content.captions.effect_color,
    },
    logos: {
      primary: content.logos.primary ? assetRefOf(content.logos.primary.storage_object_id) : null,
      horizontal: content.logos.horizontal ? assetRefOf(content.logos.horizontal.storage_object_id) : null,
      mark: content.logos.mark ? assetRefOf(content.logos.mark.storage_object_id) : null,
    },
  }
}

/** The draft body to PUT: the editor's tokens over the loaded draft (VideoStyle travels unchanged). */
export function draftContentFromEditor(editor: BrandKitEditor, base: BrandKitDraftContent): BrandKitDraftContent {
  const font = (token: BrandFontToken) => ({ family: token.family, weight: token.weight, font_ref: token.fontRef })
  const logo = (slot: BrandLogoSlot) => {
    const asset = editor.logos[slot]
    return asset ? { storage_object_id: asset.storageObjectId } : null
  }
  return {
    schema_version: base.schema_version,
    colors: { ...editor.colors },
    fonts: { title: font(editor.fonts.title), body: font(editor.fonts.body) },
    captions: {
      style_name: editor.captions.styleName,
      font_color: editor.captions.fontColor,
      highlight_color: editor.captions.highlightColor,
      effect_color: editor.captions.effectColor,
    },
    logos: { primary: logo('primary'), horizontal: logo('horizontal'), mark: logo('mark') },
    video_style: base.video_style,
  }
}

/** Canonical JSON (sorted keys) so a changed key order is not a change. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function draftContentChanged(next: BrandKitDraftContent, base: BrandKitDraftContent): boolean {
  return canonical(next) !== canonical(base)
}

const DEFAULT_WATERMARK: Omit<BrandWatermarkEditor, 'enabled' | 'enforce' | 'source' | 'asset'> = {
  anchor: 'auto_safe',
  widthRatio: 0.12,
  opacity: 0.85,
  marginRatio: 0.03,
  animationMode: 'static',
  intervalSeconds: 5,
  fadeSeconds: 0.3,
}

/**
 * The channel watermark overlay as the watermark section edits it. A stored asset equal to the Kit's
 * primary logo is shown as "primary logo"; any other stored asset is a custom watermark image.
 */
export function watermarkFromOverlay(
  overlay: ChannelBrandOverlayPreset | null,
  primaryLogoId: string | null,
): BrandWatermarkEditor {
  const assetId = overlay?.assetStorageObjectId ?? null
  const usesPrimary = assetId === null || (primaryLogoId !== null && assetId === primaryLogoId)
  return {
    enabled: Boolean(overlay && overlay.applyPolicy !== 'off'),
    enforce: overlay?.applyPolicy === 'required',
    source: usesPrimary ? 'primary_logo' : 'custom_asset',
    asset: !usesPrimary && assetId ? assetRefOf(assetId) : null,
    anchor: overlay?.anchor ?? DEFAULT_WATERMARK.anchor,
    widthRatio: overlay?.widthRatio ?? DEFAULT_WATERMARK.widthRatio,
    opacity: overlay?.opacity ?? DEFAULT_WATERMARK.opacity,
    marginRatio: overlay?.marginRatio ?? DEFAULT_WATERMARK.marginRatio,
    animationMode: overlay?.animationMode ?? DEFAULT_WATERMARK.animationMode,
    intervalSeconds: overlay?.intervalSeconds ?? DEFAULT_WATERMARK.intervalSeconds,
    fadeSeconds: overlay?.fadeSeconds ?? DEFAULT_WATERMARK.fadeSeconds,
  }
}

/** The watermark image the overlay would use: the Kit's primary logo or the custom image. */
export function resolveWatermarkAsset(watermark: BrandWatermarkEditor, logos: BrandKitEditor['logos']): BrandAssetRef | null {
  return watermark.source === 'primary_logo' ? logos.primary : watermark.asset
}

export function overlayFromWatermark(
  watermark: BrandWatermarkEditor,
  logos: BrandKitEditor['logos'],
): ChannelBrandOverlayPreset {
  const asset = resolveWatermarkAsset(watermark, logos)
  return {
    applyPolicy: watermark.enabled ? (watermark.enforce ? 'required' : 'default') : 'off',
    assetStorageObjectId: asset?.storageObjectId ?? null,
    anchor: watermark.anchor,
    widthRatio: watermark.widthRatio,
    opacity: watermark.opacity,
    marginRatio: watermark.marginRatio,
    animationMode: watermark.animationMode,
    intervalSeconds: watermark.intervalSeconds,
    fadeSeconds: watermark.fadeSeconds,
  }
}

export function watermarkChanged(
  watermark: BrandWatermarkEditor,
  logos: BrandKitEditor['logos'],
  overlay: ChannelBrandOverlayPreset | null,
): boolean {
  const next = overlayFromWatermark(watermark, logos)
  if (!overlay) return next.applyPolicy !== 'off'
  return canonical(next) !== canonical(overlay)
}

/** One family of the platform font catalogue with its pinned faces (P06-64). */
export type BrandFontFamilyOption = {
  family: string
  /** Browser face of the same file (`app/globals.css` "<Family> Caption"). */
  cssFamily: string
  italic: boolean
  faces: Array<{ weight: number; fontRef: BrandFontRef }>
}

export function fontFamilyOptions(faces: PlatformFontFace[]): BrandFontFamilyOption[] {
  const byFamily = new Map<string, BrandFontFamilyOption>()
  for (const face of faces) {
    const option = byFamily.get(face.family) ?? {
      family: face.family,
      cssFamily: `"${face.family} Caption", "${face.family}", sans-serif`,
      italic: face.style === 'italic',
      faces: [],
    }
    if (!option.faces.some((entry) => entry.weight === face.weight)) option.faces.push({ weight: face.weight, fontRef: face.font })
    byFamily.set(face.family, option)
  }
  for (const option of byFamily.values()) option.faces.sort((a, b) => a.weight - b.weight)
  return [...byFamily.values()]
}

/** The face of `family` closest to `weight` (a family change keeps the nearest weight). */
export function nearestFontToken(option: BrandFontFamilyOption, weight: number): BrandFontToken {
  const face = option.faces.reduce((best, candidate) =>
    Math.abs(candidate.weight - weight) < Math.abs(best.weight - weight) ? candidate : best, option.faces[0]!)
  return { family: option.family, weight: face.weight, fontRef: face.fontRef }
}

export function normalizeHexColor(value: string, fallback = '#FFFFFF') {
  const normalized = value.trim().toUpperCase()
  if (/^#[0-9A-F]{6}$/.test(normalized)) return normalized
  if (/^[0-9A-F]{6}$/.test(normalized)) return `#${normalized}`
  return fallback
}
