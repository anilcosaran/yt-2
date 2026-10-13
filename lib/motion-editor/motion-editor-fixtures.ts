import { motionDraftSchema, motionRevisionSchema, type MotionDraft, type MotionDraftPreview, type MotionRevision } from './api'

/** Test fixtures of the P06-02 Motion screen: one server draft (a fork of `alt-bant@1`) and its compiled preview. */

export const DRAFT_ID = 'bmotd_0123456789abcdef0123456789abcdef'

export function draftFixture(
  overrides: {
    version?: number
    validation?: MotionDraft['draft']['validation']
    lifecycle_state?: 'active' | 'archived'
    returnTo?: MotionDraft['return_to']
    latestRevision?: MotionDraft['latest_revision']
    publish?: MotionDraft['capabilities']['actions']['publish']
  } = {},
): MotionDraft {
  const version = overrides.version ?? 1
  return motionDraftSchema.parse({
    draft_id: DRAFT_ID,
    name: 'Lower third (copy)',
    lifecycle_state: overrides.lifecycle_state ?? 'active',
    source: { kind: 'fork', origin: 'library', motion_id: 'bmot_alt_bant', motion_revision_id: 'bmotrev_alt_bant_1', manifest_sha256: 'a'.repeat(64), blueprint_ref: 'alt-bant@1' },
    return_to: overrides.returnTo ?? null,
    chat_conversation_id: null,
    latest_revision: overrides.latestRevision ?? null,
    draft: {
      version,
      pattern: {
        manifest: { id_revision: 'u-0123456789abcdef01234567@1', ratio_variants: ['16:9', '9:16'] },
        body: { nodes: [], tracks: [] },
        meta: { title: { en: 'Lower third (copy)', tr: 'Alt bant (kopya)' }, demo: { slots: [{ slot_id: 'name', kind: 'text', value: 'Deniz Yılmaz' }, { slot_id: 'role', kind: 'text', value: 'Ürün Direktörü' }] } },
      },
      test_data: { video_style_ref: 'keynote-siyah@1', ratio: '16:9', energy: 'dengeli', values: {} },
      validation: overrides.validation ?? null,
    },
    capabilities: {
      schema_version: 'motion_authoring_capabilities_v1',
      subject: 'motion_draft',
      role: 'owner',
      surfaces: {
        preview: { default_open: true },
        chat: { default_open: true },
        parameters: { default_open: true },
        code_panel: { default_open: false, opt_in: true, source_format: 'motion-library@1', source_editable: true },
      },
      code_authoring: { enabled: false, available: false, reason: 'isolated_runner_required' },
      actions: {
        edit_source: true,
        set_test_data: true,
        validate: true,
        archive: true,
        // A fresh, unvalidated draft cannot be saved as a Motion yet (the server names what is missing).
        publish: overrides.publish ?? { available: false, reason: 'validation_missing' },
      },
      parameters: [
        { parameter_id: 'name', kind: 'text', spark_editable: true, required: true, text: { max_chars: 40, overflow: 'fit' } },
        { parameter_id: 'role', kind: 'text', spark_editable: true, required: true, text: { max_chars: 40, overflow: 'fit' } },
        { parameter_id: 'accent', kind: 'color', spark_editable: true, required: false },
        { parameter_id: 'duration', kind: 'duration', spark_editable: true, required: false, duration: { min_frames: 60, max_frames: 240 } },
      ],
      spark_boundary: { spark_editable_kinds: ['text', 'color', 'media', 'duration'], structural_edit: 'motion_draft', returns_to_project: overrides.returnTo != null },
    },
    created_at: '2026-10-06T08:00:00.000Z',
    updated_at: '2026-10-06T08:00:00.000Z',
  })
}

/** A published revision (P06-12 "Motion olarak kaydet") of the fixture draft. */
export function revisionFixture(number = 1): MotionRevision {
  return motionRevisionSchema.parse({
    motion_id: 'bmot_u_0123456789abcdef01234567',
    motion_revision_id: `bmotrev_u_0123456789abcdef01234567_${number}`,
    revision_number: number,
    draft_id: DRAFT_ID,
    ref: { motion_id: 'bmot_u_0123456789abcdef01234567', motion_revision_id: `bmotrev_u_0123456789abcdef01234567_${number}`, scope: 'library', manifest_sha256: 'd'.repeat(64) },
    blueprint_ref: `u-0123456789abcdef01234567@${number}`,
    title: { en: 'Lower third (copy)', tr: 'Alt bant (kopya)' },
    summary: 'A lower third.',
    parameter_schema_hash: 'e'.repeat(64),
    aspect_ratios: ['16:9', '9:16'],
    source_draft_version: 1,
    validation_receipt_id: 'r1',
    published_at: '2026-10-06T08:00:02.000Z',
  })
}

export function previewFixture(version = 1): MotionDraftPreview {
  return {
    draft_id: DRAFT_ID,
    draft_version: version,
    ratio: '16:9',
    energy: 'dengeli',
    video_style_ref: 'keynote-siyah@1',
    video_style_sha256: 'b'.repeat(64),
    duration_frames: 90,
    exit_frame: 60,
    document: { nodes: [] },
    document_sha256: 'c'.repeat(64),
  }
}
