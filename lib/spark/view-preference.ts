import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import type { CompositionDocument } from './composition-client'

/**
 * P02-16 timeline density (SAHNE §2, K238). The scene strip's compact height shows the strip and
 * the selected scene's narration; the expanded height shows the strip and every track. The choice
 * is an actor + project UI preference kept on the server: it is never a composition command,
 * revision, undo step or render input, and only the user's own toggle changes it.
 */
export const timelineDensities = ['compact', 'expanded'] as const
export type TimelineDensity = (typeof timelineDensities)[number]

const viewPreferenceResponseSchema = z.object({
  data: z.object({
    project_id: z.string().min(1),
    timeline_density: z.enum(timelineDensities).nullable(),
    updated_at: z.string().nullable(),
  }),
})

/** The saved choice, or null when the user never chose (the editor applies the default). */
export async function getTimelineDensityPreference(
  projectId: string,
  options: { signal?: AbortSignal } = {},
): Promise<TimelineDensity | null> {
  const response = await gatewayRequest(`/api/v1/composition/projects/${encodeURIComponent(projectId)}/view-preference`, {
    schema: viewPreferenceResponseSchema,
    signal: options.signal,
  })
  return response.data.timeline_density
}

export async function saveTimelineDensityPreference(projectId: string, density: TimelineDensity): Promise<TimelineDensity> {
  const response = await gatewayRequest(`/api/v1/composition/projects/${encodeURIComponent(projectId)}/view-preference`, {
    method: 'PUT',
    csrf: true,
    body: { timeline_density: density },
    schema: viewPreferenceResponseSchema,
  })
  return response.data.timeline_density ?? density
}

export type ViewPreferenceTransport = {
  get: typeof getTimelineDensityPreference
  save: typeof saveTimelineDensityPreference
}

export const viewPreferenceGatewayTransport: ViewPreferenceTransport = {
  get: getTimelineDensityPreference,
  save: saveTimelineDensityPreference,
}

/**
 * SAHNE §2 default: a project that has scene groups opens compact; a project without them (a
 * free, ungrouped project, whose narration/transcript area has nothing to show) opens expanded.
 */
export function defaultTimelineDensity(document: CompositionDocument | null): TimelineDensity {
  return document && document.scene_sequence.scene_ids.length > 0 ? 'compact' : 'expanded'
}

/** The user's saved choice wins; the default never overwrites it (AI completion does not change the view). */
export function effectiveTimelineDensity(saved: TimelineDensity | null, document: CompositionDocument | null): TimelineDensity {
  return saved ?? defaultTimelineDensity(document)
}
