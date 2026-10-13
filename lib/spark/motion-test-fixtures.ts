import { brandMotionListItemSchema, type BrandMotionListItem } from '@/lib/brand-kit/motions-api'
import { motionRevisionSchema, type MotionRevision } from '@/lib/motion-editor/api'

import type { CompositionDocument, CompositionScene } from './composition-client'
import { layerId, sceneId } from './composition-test-fixtures'

/** Fixtures of the Motion UI tests (E1-D): catalogue entries, saved Motions and a document with a Motion overlay. */

export const SHA = 'a'.repeat(64)
export const OTHER_SHA = 'b'.repeat(64)

type ListOverrides = Partial<BrandMotionListItem> & { motionId?: string }

export function catalogItem(overrides: ListOverrides = {}): BrandMotionListItem {
  const { motionId = 'bmot_alt_bant', ...rest } = overrides
  return brandMotionListItemSchema.parse({
    motion_id: motionId,
    origin: 'builtin',
    collection: 'brand_seed',
    source_kind: 'typed_seed',
    library_version: 'motion-library@1',
    blueprint_ref: 'alt-bant@1',
    title: { en: 'Lower third', tr: 'Alt bant' },
    summary: 'Name and role over footage',
    roles: ['overlay'],
    aspect_ratios: ['16:9', '9:16'],
    energies: ['sakin', 'dengeli', 'canli'],
    duration_range: { min_frames: 60, max_frames: 240 },
    timing: { enter: 'fixed', hold: 'stretch', exit: 'fixed' },
    parameters: [
      { parameter_id: 'name', kind: 'text', spark_editable: true, required: true, text: { max_chars: 40, overflow: 'fit' } },
      { parameter_id: 'role', kind: 'text', spark_editable: true, required: true, text: { max_chars: 40, overflow: 'fit' } },
      { parameter_id: 'accent', kind: 'color', spark_editable: true, required: false },
      { parameter_id: 'duration', kind: 'duration', spark_editable: true, required: false, duration: { min_frames: 60, max_frames: 240 } },
    ],
    sample_values: { name: 'Deniz Yılmaz', role: 'Ürün Direktörü' },
    alternatives: [],
    head_revision: {
      revision_id: `bmotrev_${motionId}_1`,
      revision_number: 1,
      ref: { motion_id: motionId, motion_revision_id: `bmotrev_${motionId}_1`, scope: 'library', manifest_sha256: SHA },
    },
    ...rest,
  })
}

export const premiumItem = (): BrandMotionListItem =>
  catalogItem({
    motionId: 'bmot_premium_kapak',
    collection: 'premium_film',
    blueprint_ref: 'premium-kapak@1',
    title: { en: 'Premium cover', tr: 'Premium kapak' },
    summary: 'A film cover title',
  })

export const imageItem = (): BrandMotionListItem =>
  catalogItem({
    motionId: 'bmot_foto_kart',
    blueprint_ref: 'foto-kart@1',
    title: { en: 'Photo card', tr: 'Fotoğraf kartı' },
    summary: 'A photo with a caption',
    parameters: [
      { parameter_id: 'caption', kind: 'text', spark_editable: true, required: true, text: { max_chars: 60, overflow: 'fit' } },
      { parameter_id: 'photo', kind: 'media', spark_editable: true, required: true, media: { media_kinds: ['image'] } },
      { parameter_id: 'duration', kind: 'duration', spark_editable: true, required: false, duration: { min_frames: 60, max_frames: 240 } },
    ],
    sample_values: { caption: 'Yaz tatili' },
  })

export function savedRevision(overrides: Record<string, unknown> = {}): MotionRevision {
  return motionRevisionSchema.parse({
    motion_id: 'bmot_u_0123456789abcdef01234567',
    motion_revision_id: 'bmotrev_u_0123456789abcdef01234567_2',
    revision_number: 2,
    draft_id: 'bmotd_0123456789abcdef0123456789abcdef',
    ref: { motion_id: 'bmot_u_0123456789abcdef01234567', motion_revision_id: 'bmotrev_u_0123456789abcdef01234567_2', scope: 'library', manifest_sha256: OTHER_SHA },
    blueprint_ref: 'u-0123456789abcdef01234567@2',
    title: { en: 'My lower third', tr: 'Benim alt bantım' },
    summary: 'My saved lower third',
    parameter_schema_hash: SHA,
    parameters: [
      { parameter_id: 'name', kind: 'text', spark_editable: true, required: true, text: { max_chars: 40, overflow: 'fit' } },
      { parameter_id: 'duration', kind: 'duration', spark_editable: true, required: false, duration: { min_frames: 45, max_frames: 180 } },
    ],
    aspect_ratios: ['16:9'],
    source_draft_version: 3,
    validation_receipt_id: 'bmotrcpt_1',
    published_at: '2026-10-06T08:00:00.000Z',
    ...overrides,
  })
}

export const MOTION_LAYER = layerId(9)
export const MOTION_INSTANCE = 'mi_00000000-0000-4000-8000-000000000001'

/** A document v2 Motion overlay layer body (what `motion.instance.insert` writes). */
export function motionLayerBody(overrides: { rev?: number; range?: { start_frame: number; end_frame: number }; values?: Array<{ parameter_id: string; kind: string; value: unknown }> } = {}) {
  return {
    layer_id: MOTION_LAYER,
    rev: overrides.rev ?? 1,
    layer_kind: 'motion_instance',
    instance: {
      instance_id: MOTION_INSTANCE,
      motion_ref: { motion_id: 'bmot_alt_bant', motion_revision_id: 'bmotrev_bmot_alt_bant_1', scope: 'library', manifest_sha256: SHA },
      parameter_schema_hash: SHA,
      parameter_values: overrides.values ?? [
        { parameter_id: 'name', kind: 'text', value: 'Deniz Yılmaz' },
        { parameter_id: 'role', kind: 'text', value: 'Ürün Direktörü' },
        { parameter_id: 'duration', kind: 'duration', value: 90 },
      ],
      dependency_snapshot_sha256: SHA,
      motion_state: {
        ir_version: 'motion-ir@1',
        blueprint_ref: 'alt-bant@1',
        energy: 'dengeli',
        ratio: '16:9',
        video_style: { preset_ref: 'keynote-siyah@1', snapshot_sha256: SHA, color_roles: {}, typography_roles: {} },
        overrides: [],
        handle_versions: [],
      },
    },
    scene_range: overrides.range ?? { start_frame: 30, end_frame: 120 },
  }
}

export const IMAGE_SOURCE = { source_id: 'src_photo', storage_object: { storage_object_id: 'obj_photo', media_kind: 'image' }, probe: { width: 1600, height: 900 } }

export function withMotionLayer(document: CompositionDocument, sceneIdValue = sceneId(1), body = motionLayerBody()): CompositionDocument {
  const next = structuredClone(document)
  const scene = next.scenes.find((candidate: CompositionScene) => candidate.scene_id === sceneIdValue)!
  scene.layers.push(body as never)
  return next
}
