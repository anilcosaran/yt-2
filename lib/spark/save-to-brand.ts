import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

import type { CompositionDocument } from './composition-client'
import {
  videoTemplateListItemSchema,
  videoTemplateNoteSchema,
  videoTemplateRefSchema,
  videoTemplateSchema,
  type VideoTemplate,
  type VideoTemplateListItem,
  type VideoTemplateType,
} from './template-authoring'

/**
 * P06-26 "Template/Element olarak kaydet" client (server-side state only: the private drafts and revisions live in
 * Brand, never in browser storage). One save = one `save_intent_key`: a retry returns the same draft/revision and
 * resumes a half-done save. The exact project revision the user saw travels as `expected_working_copy_version`; a
 * moved project is a 409 the dialog shows, never a silent re-read. The Save dialog visuals and entry point wait for the
 * decision in docs/plans/agentic-spark/teslim/P06-26.md; this module is their non-visual part.
 */

const TEMPLATES = '/api/v1/brand-video-templates'
const ELEMENTS = '/api/v1/brand/elements'

const issueSchema = z.object({ rule: z.string(), path: z.string(), message: z.string() })
export type BrandSaveIssue = z.infer<typeof issueSchema>
export type BrandSaveNote = z.infer<typeof videoTemplateNoteSchema>

const nameMatchSchema = z
  .object({
    template_id: z.string(),
    name: z.string(),
    lifecycle_state: z.enum(['active', 'archived']),
    template_type: z.string(),
    latest_revision: z.object({ revision_id: z.string(), revision_number: z.number().int() }).nullable(),
    updated_at: z.string(),
  })
  .passthrough()

const templateSaveResultSchema = z.object({
  status: z.enum(['saved', 'needs_attention']),
  template: videoTemplateSchema,
  revision: z
    .object({ revision_id: z.string(), revision_number: z.number().int(), ref: videoTemplateRefSchema, published_at: z.string() })
    .nullable(),
  issues: z.array(issueSchema),
  notes: z.array(videoTemplateNoteSchema),
  same_name: z.array(nameMatchSchema),
  replayed: z.boolean(),
})
export type TemplateSaveResult = z.infer<typeof templateSaveResultSchema>

export type TemplateSaveTextSlot = { layerId: string; label: string; required: boolean; maxLength: number }

export async function saveTemplateFromProject(input: {
  projectId: string
  expectedWorkingCopyVersion: number
  /** null = the whole strip. */
  sceneIds: string[] | null
  name: string
  templateType: VideoTemplateType
  locale: 'en' | 'tr'
  textSlots: TemplateSaveTextSlot[]
  saveIntentKey: string
}): Promise<TemplateSaveResult> {
  const response = await gatewayRequest(`${TEMPLATES}/from-composition`, {
    method: 'POST',
    csrf: true,
    body: {
      project_id: input.projectId,
      expected_working_copy_version: input.expectedWorkingCopyVersion,
      scene_ids: input.sceneIds,
      name: input.name,
      template_type: input.templateType,
      locale: input.locale,
      text_slots: input.textSlots.map((slot) => ({ layer_id: slot.layerId, label: slot.label, required: slot.required, max_length: slot.maxLength })),
      save_intent_key: input.saveIntentKey,
    },
    schema: z.object({ data: templateSaveResultSchema }),
  })
  return response.data
}

const elementSaveResultSchema = z.object({
  status: z.enum(['saved', 'needs_attention']),
  element: z.object({ element_id: z.string(), element_kind: z.string() }).passthrough(),
  revision: z.object({ revision_id: z.string(), revision_number: z.number().int() }).passthrough().nullable(),
  issues: z.array(issueSchema),
  notes: z.array(videoTemplateNoteSchema),
  replayed: z.boolean(),
})
export type ElementSaveResult = z.infer<typeof elementSaveResultSchema>

export type ElementSaveParameter = { layerId: string; parameterId: string; kind: 'text' | 'color' | 'media'; required: boolean }

export async function saveElementFromProject(input: {
  projectId: string
  expectedWorkingCopyVersion: number
  sceneId: string
  layerIds: string[]
  name: string
  parameters: ElementSaveParameter[]
  saveIntentKey: string
}): Promise<ElementSaveResult> {
  const response = await gatewayRequest(`${ELEMENTS}/from-composition`, {
    method: 'POST',
    csrf: true,
    body: {
      project_id: input.projectId,
      expected_working_copy_version: input.expectedWorkingCopyVersion,
      scene_id: input.sceneId,
      layer_ids: input.layerIds,
      name: input.name,
      parameters: input.parameters.map((parameter) => ({
        layer_id: parameter.layerId,
        parameter_id: parameter.parameterId,
        kind: parameter.kind,
        required: parameter.required,
      })),
      save_intent_key: input.saveIntentKey,
    },
    schema: z.object({ data: elementSaveResultSchema }),
  })
  return response.data
}

// ---------------------------------------------------------------- library (rename, duplicate, archive, same name)

const templatePath = (templateId: string) => `${TEMPLATES}/${encodeURIComponent(templateId)}`

export async function renameVideoTemplate(templateId: string, expectedVersion: number, name: string): Promise<VideoTemplate> {
  const response = await gatewayRequest(`${templatePath(templateId)}/rename`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: expectedVersion, name },
    schema: z.object({ data: videoTemplateSchema }),
  })
  return response.data
}

export async function duplicateVideoTemplate(
  templateId: string,
  input: { clientRequestId: string; revisionId?: string | null; name?: string | null },
): Promise<{ template: VideoTemplate; replayed: boolean }> {
  const response = await gatewayRequest(`${templatePath(templateId)}/duplicates`, {
    method: 'POST',
    csrf: true,
    body: { client_request_id: input.clientRequestId, revision_id: input.revisionId ?? null, name: input.name ?? null },
    schema: z.object({ data: z.object({ template: videoTemplateSchema, replayed: z.boolean() }) }),
  })
  return response.data
}

export async function archiveVideoTemplate(templateId: string, expectedVersion: number): Promise<{ template: VideoTemplate; changed: boolean }> {
  const response = await gatewayRequest(`${templatePath(templateId)}/archive`, {
    method: 'POST',
    csrf: true,
    body: { expected_version: expectedVersion },
    schema: z.object({ data: z.object({ template: videoTemplateSchema, changed: z.boolean() }) }),
  })
  return response.data
}

/** Same-name lookup: more than one match is `ambiguous` and the caller shows a picker (never the first match). */
export async function findVideoTemplatesByName(
  name: string,
  options: { includeArchived?: boolean; signal?: AbortSignal } = {},
): Promise<{ items: VideoTemplateListItem[]; ambiguous: boolean; truncated: boolean }> {
  const query = new URLSearchParams({ name, include_archived: options.includeArchived ? 'true' : 'false' })
  const response = await gatewayRequest(`${TEMPLATES}?${query.toString()}`, {
    schema: z.object({
      data: z.array(videoTemplateListItemSchema),
      meta: z.object({ ambiguous: z.boolean(), truncated: z.boolean() }).passthrough(),
    }),
    signal: options.signal,
  })
  return { items: response.data, ambiguous: response.meta.ambiguous, truncated: response.meta.truncated }
}

// ---------------------------------------------------------------- pure dialog helpers (mirror the server rules)

export type TemplateSaveTextCandidate = { layerId: string; sceneId: string; sceneIndex: number; text: string }

/** Text layers of the selected scenes (strip order): the fields the Save dialog can offer as changeable. */
export function templateSaveTextCandidates(document: CompositionDocument, sceneIds: string[] | null): TemplateSaveTextCandidate[] {
  const selected = sceneIds === null ? document.scene_sequence.scene_ids : document.scene_sequence.scene_ids.filter((id) => sceneIds.includes(id))
  const candidates: TemplateSaveTextCandidate[] = []
  selected.forEach((sceneId, index) => {
    const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
    for (const layer of scene?.layers ?? []) {
      if (layer.layer_kind !== 'text') continue
      candidates.push({ layerId: layer.layer_id, sceneId, sceneIndex: index, text: String((layer as { text?: unknown }).text ?? '') })
    }
  })
  return candidates
}

export type ElementSaveSelection =
  | { saveable: true; kind: 'native_fragment' | 'media_ref' | 'motion_ref'; parameterTargets: Array<{ layerId: string; kinds: Array<'text' | 'color' | 'media'> }> }
  | { saveable: false; reason: string }

/**
 * What "Element olarak kaydet" would make of a selection (the server decides again): one clip → rendered media, one
 * library Motion → its revision, a native group → a fragment; video in a group, a running placeholder or a
 * project-private Motion cannot be saved. A rendered image is never offered as a text parameter.
 */
export function elementSaveSelection(document: CompositionDocument, sceneId: string, layerIds: string[]): ElementSaveSelection {
  const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
  if (!scene) return { saveable: false, reason: 'scene_not_in_project' }
  const wanted = new Set(layerIds)
  const layers = scene.layers.filter((layer) => wanted.has(layer.layer_id))
  if (layers.length === 0) return { saveable: false, reason: 'no_layer_selected' }
  if (layers.length !== wanted.size) return { saveable: false, reason: 'layer_not_in_scene' }
  if (layers.length > 16) return { saveable: false, reason: 'too_many_layers' }
  if (layers.some((layer) => layer.layer_kind === 'pending_slot')) return { saveable: false, reason: 'pending_slot_not_saveable' }
  const mediaKind = (layer: (typeof layers)[number]) => {
    const sourceId = (layer as { placement?: { source_id?: string } }).placement?.source_id
    const source = document.source_media.find((candidate) => candidate.source_id === sourceId) as { storage_object?: { media_kind?: string } } | undefined
    return source?.storage_object?.media_kind ?? null
  }
  if (layers.length === 1) {
    const only = layers[0]!
    if (only.layer_kind === 'clip') {
      const kind = mediaKind(only)
      return kind === 'video' || kind === 'image'
        ? { saveable: true, kind: 'media_ref', parameterTargets: [] }
        : { saveable: false, reason: 'clip_media_not_visual' }
    }
    if (only.layer_kind === 'motion_instance') {
      const scope = (only as { instance?: { motion_ref?: { scope?: string } } }).instance?.motion_ref?.scope
      return scope === 'library' ? { saveable: true, kind: 'motion_ref', parameterTargets: [] } : { saveable: false, reason: 'motion_not_library_revision' }
    }
  }
  const targets: Array<{ layerId: string; kinds: Array<'text' | 'color' | 'media'> }> = []
  for (const layer of layers) {
    if (layer.layer_kind === 'text') targets.push({ layerId: layer.layer_id, kinds: ['text', 'color'] })
    else if (layer.layer_kind === 'shape') targets.push({ layerId: layer.layer_id, kinds: ['color'] })
    else if (layer.layer_kind === 'clip') {
      if (mediaKind(layer) !== 'image') return { saveable: false, reason: 'video_in_group_not_supported' }
      targets.push({ layerId: layer.layer_id, kinds: ['media'] })
    } else return { saveable: false, reason: 'motion_instance_in_group_not_supported' }
  }
  return { saveable: true, kind: 'native_fragment', parameterTargets: targets }
}
