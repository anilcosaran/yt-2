import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import type { CompositionOpSpec, CompositionScene } from './composition-client'

/**
 * P06-46 / QA-243 — the Spark "Hareket" section of a document v2 Motion scene: Enerji and Kalıp are two typed,
 * free recompiles (Q34). The controls come from the server's read of the instance
 * (`/api/v1/composition-motion-instances`); a change is one `motion.edit` op (P00-13 `setEnergy` / `swapBlueprint`)
 * on the scene handle with the version that read returned, sent as one recorded command (one undo group). Server
 * state only: nothing is kept in browser storage.
 */

export const motionEnergies = ['sakin', 'dengeli', 'canli'] as const
export type MotionEnergy = (typeof motionEnergies)[number]

const localized = z.object({ en: z.string(), tr: z.string() })

export const motionInstanceViewSchema = z.object({
  schema_version: z.literal('motion_instance_view_v1'),
  project_id: z.string(),
  working_copy_version: z.number().int(),
  scene_id: z.string(),
  layer_id: z.string(),
  layer_rev: z.number().int(),
  blueprint_ref: z.string(),
  energy: z.enum(motionEnergies),
  ratio: z.string(),
  duration_frames: z.number().int(),
  scene_handle: z.string().nullable(),
  scene_handle_version: z.number().int().nullable(),
  controls: z
    .object({
      energy: z.object({ value: z.enum(motionEnergies), options: z.array(z.enum(motionEnergies)) }),
      pattern: z.object({
        value: z.string(),
        title: localized,
        options: z.array(z.object({ blueprint_ref: z.string(), title: localized })),
      }),
    })
    .passthrough()
    .nullable(),
  look: z.record(z.unknown()),
})

export type MotionInstanceView = z.infer<typeof motionInstanceViewSchema>

const viewResponseSchema = z.object({ data: motionInstanceViewSchema })

export async function getMotionInstanceView(projectId: string, layerId: string, options: { signal?: AbortSignal } = {}) {
  const response = await gatewayRequest(
    `/api/v1/composition-motion-instances/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(layerId)}`,
    { schema: viewResponseSchema, signal: options.signal },
  )
  return response.data
}

type Layer = CompositionScene['layers'][number]

/** The scene's document v2 Motion instance layer (one that carries `motion_state`), if any. */
export function sceneMotionLayer(scene: CompositionScene): Layer | null {
  for (const layer of scene.layers) {
    if (layer.layer_kind !== 'motion_instance') continue
    const instance = (layer as Record<string, unknown>)['instance'] as Record<string, unknown> | undefined
    if (instance && typeof instance === 'object' && instance['motion_state'] !== undefined) return layer
  }
  return null
}

/** The Kalıp options in display order: the current pattern first, then its slot-compatible alternatives. */
export function motionPatternOptions(view: MotionInstanceView): { blueprint_ref: string; title: { en: string; tr: string } }[] {
  if (!view.controls) return []
  return [{ blueprint_ref: view.controls.pattern.value, title: view.controls.pattern.title }, ...view.controls.pattern.options]
}

export type MotionControlChange = { kind: 'energy'; energy: MotionEnergy } | { kind: 'pattern'; blueprint_ref: string }

/** One `motion.edit` op for a Hareket change, or null when the read gave no scene handle to address. */
export function motionControlSpec(view: MotionInstanceView, change: MotionControlChange): CompositionOpSpec | null {
  if (!view.scene_handle || view.scene_handle_version === null) return null
  const layer = { entity_kind: 'layer', entity_id: view.layer_id } as const
  const editOp = change.kind === 'energy'
    ? { op: 'setEnergy', params: { energy: change.energy } }
    : { op: 'swapBlueprint', params: { blueprint_ref: change.blueprint_ref } }
  return {
    op: {
      op: 'motion.edit',
      layer_id: view.layer_id,
      edit_op: {
        ...editOp,
        target_handle: view.scene_handle,
        expected_version: view.scene_handle_version,
        read_set: [view.scene_handle],
      },
    },
    reads: [layer],
    targets: [layer],
  }
}
