import type { CompositionEntityRef, CompositionOpSpec } from './composition-client'

/**
 * What a newer queued command keeps of the older command it replaces (T1R-11). The write queue's coalescing used to
 * throw the older command away, which silently dropped its part whenever the newer command was a partial patch of the
 * same group (two text-style fields, mute and gain, width and then height) or carried fewer ops (a transform-only
 * command replacing a resize that also carried `shape.set_size`).
 *
 * An op is identified by its kind and every `*_id` field it names (scene, layer, ...). Ops with the same identity are
 * merged field by field, the newer field winning; an older op the newer command does not repeat is kept; newer ops
 * the older command did not have are appended. Every typed op is flat, so a shallow merge is exact: a full-value op
 * (`layer.set_transform`, `shape.set_size`) is fully overwritten, a partial patch (`text.set_style`, `clip.set_audio`)
 * keeps the fields only the older command carried.
 */
export function mergeCoalescedSpecs(
  older: readonly CompositionOpSpec[],
  newer: readonly CompositionOpSpec[],
): CompositionOpSpec[] {
  const newerByIdentity = new Map<string, CompositionOpSpec>()
  for (const spec of newer) newerByIdentity.set(opIdentity(spec), spec)
  const used = new Set<string>()
  const merged: CompositionOpSpec[] = []
  for (const spec of older) {
    const identity = opIdentity(spec)
    const replacement = newerByIdentity.get(identity)
    if (!replacement || used.has(identity)) {
      merged.push(spec)
      continue
    }
    used.add(identity)
    merged.push({
      op: { ...spec.op, ...replacement.op },
      reads: mergeRefs(spec.reads, replacement.reads),
      targets: mergeRefs(spec.targets, replacement.targets),
    })
  }
  for (const spec of newer) {
    if (!used.has(opIdentity(spec))) merged.push(spec)
  }
  return merged
}

function opIdentity(spec: CompositionOpSpec): string {
  const op = spec.op as Record<string, unknown>
  const ids = Object.keys(op)
    .filter((key) => key.endsWith('_id') && typeof op[key] === 'string')
    .sort()
    .map((key) => `${key}=${String(op[key])}`)
  return `${String(op['op'])}|${ids.join('|')}`
}

function mergeRefs(older: readonly CompositionEntityRef[], newer: readonly CompositionEntityRef[]): CompositionEntityRef[] {
  const seen = new Set<string>()
  const refs: CompositionEntityRef[] = []
  for (const ref of [...newer, ...older]) {
    const key = `${ref.entity_kind}:${ref.entity_id}`
    if (seen.has(key)) continue
    seen.add(key)
    refs.push(ref)
  }
  return refs
}
