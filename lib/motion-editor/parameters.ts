import type { MotionExposedParameter } from './api'

/**
 * P06-02 parameter panel model. The parameters are the draft's `motion_exposure_v1` (derived by the server from the
 * typed source); the panel edits the draft's Test Data values, the ones the preview and the validation compile with.
 * Text/colour/duration/number are edited here; media is bound in a project, never a Test Data value.
 */

export type ParameterFieldKind = 'text' | 'color' | 'duration' | 'number' | 'media' | 'other'

export function parameterFieldKind(parameter: Pick<MotionExposedParameter, 'kind'>): ParameterFieldKind {
  switch (parameter.kind) {
    case 'text':
    case 'color':
    case 'duration':
    case 'number':
    case 'media':
      return parameter.kind
    default:
      return 'other'
  }
}

/** Preview samples from the source's demo shot (text, list items and numbers); the placeholder of an empty field. */
export function sampleValuesOf(pattern: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  const meta = pattern['meta']
  const slots = meta && typeof meta === 'object' ? ((meta as { demo?: { slots?: unknown } }).demo?.slots ?? null) : null
  if (!Array.isArray(slots)) return out
  for (const slot of slots as Array<{ slot_id?: unknown; kind?: unknown; value?: unknown }>) {
    if (typeof slot.slot_id !== 'string') continue
    if (slot.kind === 'text' && typeof slot.value === 'string') out[slot.slot_id] = slot.value
    else if (slot.kind === 'number' && typeof slot.value === 'number') out[slot.slot_id] = slot.value
    else if (slot.kind === 'list' && Array.isArray(slot.value)) {
      slot.value.forEach((item, index) => {
        if (typeof item === 'string') out[`${slot.slot_id}.${index + 1}`] = item
      })
    }
  }
  return out
}

export type ParameterFormResult = { values: Record<string, string | number>; invalid: string[] }

/**
 * The panel's form → Test Data values. An empty field is left out (the source's own sample applies); a number or
 * duration that is not a finite number is reported, never coerced. Media parameters are never part of the values.
 */
export function valuesFromForm(form: Pick<FormData, 'get'>, parameters: readonly Pick<MotionExposedParameter, 'parameter_id' | 'kind'>[]): ParameterFormResult {
  const values: Record<string, string | number> = {}
  const invalid: string[] = []
  for (const parameter of parameters) {
    const kind = parameterFieldKind(parameter)
    if (kind === 'media' || kind === 'other') continue
    const raw = form.get(parameter.parameter_id)
    if (typeof raw !== 'string') continue
    const text = raw.trim()
    if (text === '') continue
    if (kind === 'duration' || kind === 'number') {
      const value = Number(text)
      if (!Number.isFinite(value) || (kind === 'duration' && !Number.isInteger(value))) invalid.push(parameter.parameter_id)
      else values[parameter.parameter_id] = value
    } else {
      values[parameter.parameter_id] = text
    }
  }
  return { values, invalid }
}
