import type { SparkExport, SparkExportQuote } from './export-client'

/** Wire fixtures of the export routes (shape of `composition_export_quote_v1` / `composition_export_v1`), for tests. */
export const EXPORT_PROJECT_ID = 'cprj_00000000-0000-4000-8000-000000000001'
export const EXPORT_QUOTE_SHA = 'a'.repeat(64)

export function exportQuote(overrides: Partial<SparkExportQuote> = {}): SparkExportQuote {
  return {
    schema_version: 'composition_export_quote_v1',
    project_id: EXPORT_PROJECT_ID,
    working_copy_version: 7,
    document_sha256: 'b'.repeat(64),
    output_profile: 'spark-export-v1',
    renderer_pin: { renderer_id: 'frame-stage', renderer_revision: 'sha256:1', profile_revision: '1' },
    canvas: { width: 1920, height: 1080, fps: { num: 30, den: 1 } },
    output_frames: 1260,
    output_seconds: 42,
    billable_output_seconds: 42,
    credits_per_output_second: 0.002,
    estimated_credits: 0.084,
    credit_billed_seconds: 42,
    max_output_seconds: 1800,
    pricing_version: 'export-pricing-v1',
    renderer: { available: true, reason: null },
    render_plan: { lane: 'fast', queue: 'q-composition-render-fast', classification_reason: 'fast_profile', inputs: { output_seconds: 42, scene_count: 4, inline_asset_bytes: 1048576, video_layer_count: 0 } },
    quote_sha256: EXPORT_QUOTE_SHA,
    ...overrides,
  }
}

export function exportJob(overrides: Partial<SparkExport> = {}): SparkExport {
  return {
    schema_version: 'composition_export_v1',
    export_id: 'cexp_00000000-0000-4000-8000-000000000001',
    project_id: EXPORT_PROJECT_ID,
    revision_id: 'rev_1',
    attempt: 1,
    status: 'authorizing',
    output_profile: 'spark-export-v1',
    canvas: { width: 1920, height: 1080, fps: { num: 30, den: 1 } },
    output_frames: 1260,
    price: {
      output_seconds: 42,
      billable_output_seconds: 42,
      credits_per_output_second: 0.002,
      estimated_credits: 0.084,
      credit_billed_seconds: 42,
      quote_sha256: EXPORT_QUOTE_SHA,
    },
    queue: null,
    render_lane: null,
    progress_percent: null,
    cancel_requested: false,
    error: null,
    output: null,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

export function completedExport(overrides: Partial<SparkExport> = {}): SparkExport {
  return exportJob({
    status: 'completed',
    render_lane: 'fast',
    progress_percent: null,
    output: {
      storage_object_id: 'obj_mp4_1',
      url: 'https://cdn.invalid/video.mp4',
      checksum_sha256: 'c'.repeat(64),
      size_bytes: 5_242_880,
      total_frames: 1260,
      output_seconds: 42,
    },
    completed_at: '2026-10-01T10:02:00.000Z',
    ...overrides,
  })
}
