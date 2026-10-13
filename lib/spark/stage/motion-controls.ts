import { inspectorControl, inspectorTarget, type InspectorSchema } from './inspector-schema'

/**
 * Which Properties controls a selected Motion layer offers (E1-D). The server's inspector schema DRIVES it like it does for
 * text, shape and clip: a control the schema does not list for `motion_instance` is not shown, so the panel never offers what
 * no typed op writes. With no schema yet (loading, or the read failed) only the core actions whose ops always exist stay.
 * `motion.structure` and `motion.source_code` are listed as unavailable with `structural_edit_opens_motion_draft`: the
 * panel's "Edit structure" button is that route (a private draft in the Motion area), never an inline edit.
 */

export type MotionControlSet = {
  /** Exposed text / colour / image values (`motion.parameter.set`); only for a document v2 instance. */
  parameters: boolean
  /** The overlay's length (`motion.parameter.set` of `duration`; the schema lists it as `motion.duration` since E1-C). */
  duration: boolean
  /** Position, scale and rotation (`layer.set_transform`). */
  position: boolean
  /** Start second (`layer.move`). */
  move: boolean
  arrange: boolean
  remove: boolean
  /** Energy and pattern (`motion.edit`); a v2 instance only. */
  look: boolean
}

export function motionControlSet(schema: InspectorSchema | null, v2: boolean): MotionControlSet {
  if (!schema) return { parameters: false, duration: false, position: false, move: false, arrange: true, remove: true, look: v2 }
  const target = inspectorTarget(schema, 'motion_instance')
  if (!target || !target.editable) return { parameters: false, duration: false, position: false, move: false, arrange: false, remove: false, look: false }
  const has = (control: string) => inspectorControl(schema, 'motion_instance', control) !== null
  return {
    parameters: v2 && has('motion.parameter'),
    // A server before E1-C lists only the general `motion.parameter` (the length was one of its values): both open the field.
    duration: v2 && (has('motion.duration') || has('motion.parameter')),
    position: has('motion.position'),
    move: has('motion.move'),
    arrange: true,
    remove: has('motion.remove'),
    look: v2,
  }
}
