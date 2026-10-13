import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * P06-32 "Keşif'te paylaş" preview client (server-side state only): what a public publication of an exact saved
 * revision would carry (sanitized snapshot) and what blocks it. Publishing, the Template gallery and clone are
 * Community's (P06-17/19/20); the share dialog visuals wait for docs/plans/agentic-spark/teslim/P06-32.md. Behind
 * `BRAND_TEMPLATE_PUBLICATION_ENABLED` (403 when off).
 */

const blockerSchema = z.object({ rule: z.string(), path: z.string(), message: z.string() })
export type TemplatePublicationBlocker = z.infer<typeof blockerSchema>

const previewSchema = z.object({
  source: z.object({ template_id: z.string(), revision_id: z.string(), manifest_digest: z.string() }),
  snapshot: z
    .object({
      schema_version: z.literal('brand_template_publication_snapshot_v1'),
      manifest: z.record(z.unknown()),
      snapshot_digest: z.string(),
      placeholders: z.array(z.object({ slot_id: z.string(), reason: z.string() })),
      removed: z.array(z.object({ kind: z.string(), id: z.string(), reason: z.string() })),
    })
    .passthrough(),
  blockers: z.array(blockerSchema),
  publishable: z.boolean(),
})
export type TemplatePublicationPreview = z.infer<typeof previewSchema>

export async function getTemplatePublicationPreview(
  templateId: string,
  revisionId: string,
  options: { signal?: AbortSignal } = {},
): Promise<TemplatePublicationPreview> {
  const response = await gatewayRequest(
    `/api/v1/brand-video-templates/${encodeURIComponent(templateId)}/revisions/${encodeURIComponent(revisionId)}/publication-snapshot`,
    { schema: z.object({ data: previewSchema }), signal: options.signal },
  )
  return response.data
}

/**
 * The share dialog's summary: what must be fixed first (blockers, grouped by rule), what the snapshot leaves out and
 * which slots become placeholders the cloner fills.
 */
export function templatePublicationSummary(preview: TemplatePublicationPreview): {
  canPublish: boolean
  blockers: Array<{ rule: string; count: number }>
  removed: number
  placeholders: number
} {
  const counts = new Map<string, number>()
  for (const blocker of preview.blockers) counts.set(blocker.rule, (counts.get(blocker.rule) ?? 0) + 1)
  return {
    canPublish: preview.publishable && preview.blockers.length === 0,
    blockers: [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([rule, count]) => ({ rule, count })),
    removed: preview.snapshot.removed.length,
    placeholders: preview.snapshot.placeholders.length,
  }
}
