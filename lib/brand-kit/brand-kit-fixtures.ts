import type { BrandKitDetail, BrandKitDraftContent, BrandKitListItem, PlatformFontFace } from './api'

/** Test fixtures shaped like the gateway's P02-02/P06-01 Brand Kit responses. */

export const VIDEO_STYLE = {
  preset_ref: 'neutral@1',
  color_roles: { canvas: '#FFFFFF', surface: '#F3F4F6', ink: '#111827', muted: '#6B7280', accent: '#2563EB', contrast_ratio_min: 4.5 },
  typography_roles: { display: { family: 'Montserrat', weight: 700 }, body: { family: 'Montserrat', weight: 700 } },
  ratio_ramps: [{ ratio: '16:9', scale_unit: 1 }],
  motion_temperament: { default_energy: 'dengeli', ease_family: 'power3.out', overshoot_allowed: false },
  rules: [],
  captions_and_logo: { caption_skin: 'neutral-caption@1', logo_safe_area: { margin_pct: 5 } },
  cut_grammar: 'flow',
}

export const MONTSERRAT_REF = { font_id: 'font_montserrat_700', font_revision: 'fontrev_montserrat_700_1', sha256: 'b'.repeat(64) }
export const ANTON_REF = { font_id: 'font_anton_400', font_revision: 'fontrev_anton_400_1', sha256: 'a'.repeat(64) }

export function draftContent(patch: Partial<BrandKitDraftContent> = {}): BrandKitDraftContent {
  return {
    schema_version: 1,
    colors: { primary: '#22D3EE', secondary: '#1B2430', tertiary: '#C6C8CC', accent: '#7C5CFF' },
    fonts: {
      title: { family: 'Montserrat', weight: 700, font_ref: MONTSERRAT_REF },
      body: { family: 'Montserrat', weight: 700, font_ref: null },
    },
    captions: { style_name: 'clean', font_color: '#FFFFFF', highlight_color: '#FFE600', effect_color: '#000000' },
    logos: { primary: { storage_object_id: 'sobj_logo_1' }, horizontal: null, mark: null },
    video_style: structuredClone(VIDEO_STYLE),
    ...patch,
  }
}

export function listItem(patch: Partial<BrandKitListItem> = {}): BrandKitListItem {
  return {
    kit_id: 'bkit_owner_1',
    origin: 'user',
    name: 'Kanal Mavi',
    lifecycle_state: 'active',
    draft_version: 2,
    head_revision: {
      revision_id: 'bkrev_1',
      revision_number: 1,
      ref: {
        ref_type: 'brand_revision',
        brand_asset_kind: 'kit',
        brand_asset_id: 'bkit_owner_1',
        brand_revision_id: 'bkrev_1',
        brand_revision_digest_sha256: 'c'.repeat(64),
      },
    },
    updated_at: '2026-09-29T10:00:00.000Z',
    access_role: 'owner',
    sharing: { acl_version: 0, shared_with_channel_members: false },
    preview: {
      colors: { primary: '#22D3EE', secondary: '#1B2430', tertiary: '#C6C8CC', accent: '#7C5CFF' },
      title_font: { family: 'Montserrat', weight: 700 },
      caption_style_name: 'clean',
    },
    ...patch,
  }
}

export function detail(patch: Partial<BrandKitDetail> = {}): BrandKitDetail {
  return {
    ...listItem(),
    channel_id: 'channel-1',
    visibility: 'private',
    draft: { version: 2, content: draftContent() },
    created_at: '2026-09-29T09:00:00.000Z',
    ...patch,
  }
}

export const PLATFORM_FACES: PlatformFontFace[] = [
  { font: ANTON_REF, family: 'Anton', weight: 400, style: 'normal', status: 'active' },
  { font: MONTSERRAT_REF, family: 'Montserrat', weight: 700, style: 'normal', status: 'active' },
  {
    font: { font_id: 'font_playfair_display_400_italic', font_revision: 'fontrev_pf_1', sha256: 'd'.repeat(64) },
    family: 'Playfair Display',
    weight: 400,
    style: 'italic',
    status: 'active',
  },
]
