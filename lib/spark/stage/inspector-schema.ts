import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Client and reader of `composition_inspector_schema_v1` (P02-11, `GET /api/v1/composition/inspector-schema`): per layer
 * kind the controls the inspector may show, the typed op and parameter that write each, and the `unavailable` list. The
 * Properties inspector and the toolbox are DRIVEN by it: a control the server does not list is not shown (KARAR-MINIMAL
 * section 1, "controls that cannot be applied are hidden"), so the UI cannot offer what no op writes.
 */

const fontRefSchema = z.object({ font_id: z.string(), font_revision: z.string(), sha256: z.string() })

const controlSchema = z
  .object({
    control: z.string(),
    section: z.string(),
    fields: z.array(z.string()),
    op: z.string(),
    param: z.string().nullable(),
    write: z.enum(['partial', 'replace', 'action']),
    options: z.enum(['font_families', 'font_family_faces']).optional(),
    requires: z.array(z.string()).optional(),
  })
  .passthrough()

const targetSchema = z
  .object({
    target: z.string(),
    editable: z.boolean(),
    reason: z.string().nullable(),
    controls: z.array(controlSchema),
    unavailable: z.array(z.object({ control: z.string(), reason: z.string(), owner: z.string().nullable() }).passthrough()),
  })
  .passthrough()

export const inspectorSchemaResponseSchema = z.object({
  data: z
    .object({
      schema_version: z.literal('composition_inspector_schema_v1'),
      text: z.object({ max_codepoints: z.number(), normalization: z.string() }).passthrough(),
      fonts: z
        .object({
          catalog_revision: z.number(),
          families: z.array(
            z.object({
              family: z.string(),
              faces: z.array(z.object({ font: fontRefSchema, weight: z.number(), style: z.enum(['normal', 'italic']) })),
            }),
          ),
        })
        .passthrough(),
      targets: z.array(targetSchema),
    })
    .passthrough(),
})

export type InspectorSchema = z.output<typeof inspectorSchemaResponseSchema>['data']
export type InspectorTargetView = InspectorSchema['targets'][number]
export type InspectorControlView = InspectorTargetView['controls'][number]

let cached: Promise<InspectorSchema> | null = null

/** One read per page (the schema changes only with a deploy). A failed read may be retried by the next caller. */
export function loadInspectorSchema(options: { signal?: AbortSignal; request?: typeof gatewayRequest } = {}): Promise<InspectorSchema> {
  if (cached) return cached
  const request = options.request ?? gatewayRequest
  const task = request('/api/v1/composition/inspector-schema', { schema: inspectorSchemaResponseSchema, signal: options.signal }).then((result) => result.data)
  cached = task
  task.catch(() => {
    if (cached === task) cached = null
  })
  return task
}

export function resetInspectorSchemaCacheForTests(): void {
  cached = null
}

/** The target of a layer kind (`text`, `clip`, `shape`, `motion_instance`, ...), or null. */
export function inspectorTarget(schema: InspectorSchema | null, kind: string): InspectorTargetView | null {
  return schema?.targets.find((target) => target.target === kind) ?? null
}

/** The control with this id on this layer kind, or null when the server does not offer it. */
export function inspectorControl(schema: InspectorSchema | null, kind: string, control: string): InspectorControlView | null {
  return inspectorTarget(schema, kind)?.controls.find((candidate) => candidate.control === control) ?? null
}

/** Whether any control of the kind is written by `op` (e.g. `layer.arrange` once the server lists it). */
export function inspectorHasOp(schema: InspectorSchema | null, kind: string, op: string): boolean {
  return inspectorTarget(schema, kind)?.controls.some((candidate) => candidate.op === op) ?? false
}

/** Faces of the family a face belongs to (the weight picker), by the face's pin. */
export function familyOfFace(schema: InspectorSchema | null, sha256: string): InspectorSchema['fonts']['families'][number] | null {
  return schema?.fonts.families.find((family) => family.faces.some((face) => face.font.sha256 === sha256)) ?? null
}

/**
 * The face of `family` nearest the current one (same weight and style when the family has it, else the nearest weight
 * of the same style, else any face): switching family keeps the look as close as the catalogue allows.
 */
export function faceForFamily(
  family: InspectorSchema['fonts']['families'][number],
  current: { weight: number; style: 'normal' | 'italic' } | null,
): InspectorSchema['fonts']['families'][number]['faces'][number] | null {
  const faces = family.faces
  if (faces.length === 0) return null
  if (!current) return faces[0]!
  const sameStyle = faces.filter((face) => face.style === current.style)
  const pool = sameStyle.length > 0 ? sameStyle : faces
  return [...pool].sort((a, b) => Math.abs(a.weight - current.weight) - Math.abs(b.weight - current.weight))[0]!
}
