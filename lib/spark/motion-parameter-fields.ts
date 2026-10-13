import type { MotionExposedParameter } from '@/lib/motion-editor/api'

import type { CompositionDocument } from './composition-client'
import type { CompositionMotionParameterInput } from './composition-typed-edits'
import { projectImageSources, type MotionLayerView, type ProjectImageSource } from './motion-layers'

/**
 * E1-D model of the Properties panel of a selected Motion layer: which exposed fields exist (the pinned revision's
 * `motion_exposure_v1`, only what Spark may edit: text, colour, image and length), what the document holds for each, and how
 * one edit becomes the value of ONE `motion.parameter.set`. The gateway validates every value again and recompiles the
 * instance before it writes (no silent clamp there); this model only refuses what the field itself can know, so a refused
 * edit never reaches the server.
 */

export type MotionTextField = { kind: 'text'; id: string; required: boolean; maxChars: number; value: string }
export type MotionColorField = { kind: 'color'; id: string; required: boolean; /** `#rrggbb` the document holds, or null while the Brand/revision default applies. */ value: string | null }
export type MotionMediaField = {
  kind: 'media'
  id: string
  required: boolean
  /** The project image the field holds, or null (unset). */
  value: { storageObjectId: string; sourceId: string | null } | null
  /** The images the project holds (a field takes one of them). */
  options: readonly ProjectImageSource[]
}
export type MotionDurationField = {
  kind: 'duration'
  id: string
  required: boolean
  /** Frames the document holds (the overlay's length). */
  frames: number
  minFrames: number
  /** The longest the Motion allows AND the scene still has room for after the overlay's start. */
  maxFrames: number
}

export type MotionParameterField = MotionTextField | MotionColorField | MotionMediaField | MotionDurationField

const ORDER: Record<MotionParameterField['kind'], number> = { text: 0, media: 1, color: 2, duration: 3 }

/** `title`, `items.2`, `lower_text` -> "Title", "Items 2", "Lower text": the id is all the exposure states about a field. */
export function parameterLabel(parameterId: string): string {
  const spaced = parameterId.replace(/[._-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const HEX6 = /^#[0-9a-fA-F]{6}$/

/**
 * The editable fields of one Motion layer in panel order (text, image, colour, length). `sceneFrames` is the scene's resolved
 * length: the overlay may not be made longer than the scene has room for after its start (never outside the scene range).
 */
export function motionParameterFields(input: {
  parameters: readonly MotionExposedParameter[]
  view: MotionLayerView
  document: CompositionDocument
  sceneFrames: number
}): MotionParameterField[] {
  const { view } = input
  const stored = new Map(view.values.map((entry) => [entry.parameterId, entry]))
  const images = projectImageSources(input.document)
  const fields: MotionParameterField[] = []
  for (const parameter of input.parameters) {
    if (!parameter.spark_editable) continue
    const entry = stored.get(parameter.parameter_id)
    switch (parameter.kind) {
      case 'text':
        fields.push({ kind: 'text', id: parameter.parameter_id, required: parameter.required, maxChars: parameter.text?.max_chars ?? 2000, value: typeof entry?.value === 'string' ? entry.value : '' })
        break
      case 'color':
        fields.push({ kind: 'color', id: parameter.parameter_id, required: parameter.required, value: typeof entry?.value === 'string' && HEX6.test(entry.value) ? entry.value.toLowerCase() : null })
        break
      case 'media': {
        const object = entry && typeof entry.value === 'object' ? entry.value.storage_object_id : null
        fields.push({
          kind: 'media',
          id: parameter.parameter_id,
          required: parameter.required,
          value: object ? { storageObjectId: object, sourceId: images.find((image) => image.storageObjectId === object)?.sourceId ?? null } : null,
          options: images,
        })
        break
      }
      case 'duration': {
        if (!parameter.duration || !view.range) break
        const frames = view.range.endFrame - view.range.startFrame
        const room = input.sceneFrames - view.range.startFrame
        fields.push({ kind: 'duration', id: parameter.parameter_id, required: parameter.required, frames, minFrames: parameter.duration.min_frames, maxFrames: Math.min(parameter.duration.max_frames, room) })
        break
      }
      default:
        break
    }
  }
  return fields.sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
}

export type MotionEdit<T = CompositionMotionParameterInput> = { ok: true; value: T } | { ok: false; reason: 'empty' | 'too_long' | 'unchanged' | 'invalid' | 'out_of_range' }

/** NFC text as the server stores it; empty, unchanged and over-long text is not sent. */
export function textEdit(field: MotionTextField, raw: string): MotionEdit<string> {
  const text = raw.normalize('NFC').trim()
  if (text.length === 0) return { ok: false, reason: 'empty' }
  if ([...text].length > field.maxChars) return { ok: false, reason: 'too_long' }
  if (text === field.value.normalize('NFC')) return { ok: false, reason: 'unchanged' }
  return { ok: true, value: text }
}

/** `#RRGGBB` (the colour picker's own value) in the case the server stores it; an unchanged colour is not sent. */
export function colorEdit(field: MotionColorField, raw: string): MotionEdit<string> {
  if (!HEX6.test(raw)) return { ok: false, reason: 'invalid' }
  if (field.value !== null && field.value.toLowerCase() === raw.toLowerCase()) return { ok: false, reason: 'unchanged' }
  return { ok: true, value: raw.toUpperCase() }
}

/** The image field takes a project source by its id; the value the server accepts is `{ source_id }`. */
export function mediaEdit(field: MotionMediaField, sourceId: string): MotionEdit<{ source_id: string }> {
  const option = field.options.find((candidate) => candidate.sourceId === sourceId)
  if (!option) return { ok: false, reason: 'invalid' }
  if (field.value?.storageObjectId === option.storageObjectId) return { ok: false, reason: 'unchanged' }
  return { ok: true, value: { source_id: sourceId } }
}

/** A length typed in seconds -> whole frames within the Motion's bounds AND the scene's room; out of range is refused, never clamped. */
export function durationEdit(field: MotionDurationField, seconds: number, fps: number): MotionEdit<number> {
  if (!Number.isFinite(seconds)) return { ok: false, reason: 'invalid' }
  const frames = Math.round(seconds * fps)
  if (frames < field.minFrames || frames > field.maxFrames) return { ok: false, reason: 'out_of_range' }
  if (frames === field.frames) return { ok: false, reason: 'unchanged' }
  return { ok: true, value: frames }
}

/** Seconds as the panel shows a length (one decimal). */
export const framesToSecondsLabel = (frames: number, fps: number): string => String(Math.round((frames / fps) * 10) / 10)
