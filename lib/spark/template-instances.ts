import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import { SCENE_SEQUENCE_REF, type CompositionEntityRef, type CompositionOpSpec, type CompositionRawOp } from './composition-client'

/**
 * P06-03/P06-04 template instance client for Spark (server-side state only; nothing is kept in browser storage).
 *
 * - Section disable/enable, remove repeat and project variants are ordinary composition ops (`CompositionOpSpec`) the
 *   editor sends through its single command path, so CAS, undo and the template policy are the same as every edit.
 * - `previewTemplateEdit` shows the impact of those ops before they are sent (parked/restored scenes, timeline length,
 *   refusal reason); `listTemplateInstances` is the instance/policy view (the `+` mode, section states).
 * The visible controls (section toggle, parked scene card, Scene Library picker) wait for the design decisions in
 * docs/plans/agentic-spark/teslim/P06-04.md; this module is their non-visual part.
 */

const instanceRef = (instanceId: string): CompositionEntityRef => ({ entity_kind: 'template_instance', entity_id: instanceId })

/** Disable (park, content kept, not rendered or counted) or enable (restore at the section position) a section. */
export function templateSectionEnabledSpec(instanceId: string, sectionId: string, enabled: boolean): CompositionOpSpec {
  return {
    op: { op: 'template_instance.set_section_enabled', instance_id: instanceId, section_local_id: sectionId, enabled },
    reads: [SCENE_SEQUENCE_REF, instanceRef(instanceId)],
    targets: [SCENE_SEQUENCE_REF, instanceRef(instanceId)],
  }
}

/** Remove one repeat of a repeatable section (a delete, undoable; never below the section's minimum). */
export function templateRemoveRepeatSpec(instanceId: string, sectionId: string, repeatIndex: number): CompositionOpSpec {
  return {
    op: { op: 'template_instance.remove_repeat', instance_id: instanceId, section_local_id: sectionId, repeat_index: repeatIndex },
    reads: [SCENE_SEQUENCE_REF, instanceRef(instanceId)],
    targets: [SCENE_SEQUENCE_REF, instanceRef(instanceId)],
  }
}

export type TemplateLockProperty = 'structure' | 'content' | 'style' | 'position' | 'timing'

/** K309: an explicit project variant lifts one lock for one entity and property (the saved template never changes). */
export function templateVariantSpec(input: {
  instanceId: string
  lockId: string
  entityId: string
  property: TemplateLockProperty
  enabled: boolean
}): CompositionOpSpec {
  return {
    op: {
      op: 'template_instance.set_variant',
      instance_id: input.instanceId,
      lock_id: input.lockId,
      entity_id: input.entityId,
      property: input.property,
      enabled: input.enabled,
    },
    reads: [instanceRef(input.instanceId)],
    targets: [instanceRef(input.instanceId)],
  }
}

// ---------------------------------------------------------------- impact preview

const impactSchema = z
  .object({
    allowed: z.boolean(),
    refusal: z.object({ code: z.string(), reason: z.string().nullable() }).passthrough().nullable(),
    base_working_copy_version: z.number().int(),
    scenes: z.array(
      z.object({
        scene_id: z.string(),
        change: z.enum(['added', 'removed', 'parked', 'restored', 'resized', 'moved']),
        before_frames: z.number().int().nullable(),
        after_frames: z.number().int().nullable(),
      }),
    ),
    total_frames: z.object({ before: z.number().int().nullable(), after: z.number().int().nullable() }),
  })
  .passthrough()

export type TemplateEditImpact = z.infer<typeof impactSchema>

export async function previewTemplateEdit(projectId: string, ops: CompositionRawOp[]): Promise<TemplateEditImpact> {
  const response = await gatewayRequest(`/api/v1/composition-templates/projects/${encodeURIComponent(projectId)}/impact`, {
    method: 'POST',
    csrf: true,
    body: { ops },
    schema: z.object({ data: impactSchema }),
  })
  return response.data
}

// ---------------------------------------------------------------- instance view

const addSceneModes = ['freeform', 'library', 'template', 'locked'] as const

const instancesViewSchema = z
  .object({
    project_id: z.string(),
    working_copy_version: z.number().int(),
    extension_policy: z.enum(['freeform', 'approved_scene_only', 'current_template_only', 'locked_sequence']),
    add_scene: z.object({ mode: z.enum(addSceneModes), reason: z.string().nullable() }),
    instances: z.array(
      z
        .object({
          instance_id: z.string(),
          sections: z.array(
            z
              .object({
                section_local_id: z.string(),
                presence: z.enum(['required', 'optional', 'conditional', 'repeatable']),
                state: z.enum(['enabled', 'disabled', 'condition_false']),
                scene_ids: z.array(z.string()),
                parked_scene_count: z.number().int(),
              })
              .passthrough(),
          ),
          add_scene: z.object({ mode: z.enum(addSceneModes), blueprint_local_ids: z.array(z.string()) }),
        })
        .passthrough(),
    ),
  })
  .passthrough()

export type TemplateInstancesView = z.infer<typeof instancesViewSchema>

export async function listTemplateInstances(projectId: string, options: { signal?: AbortSignal } = {}): Promise<TemplateInstancesView> {
  const response = await gatewayRequest(`/api/v1/composition-templates/projects/${encodeURIComponent(projectId)}/instances`, {
    schema: z.object({ data: instancesViewSchema }),
    signal: options.signal,
  })
  return response.data
}
