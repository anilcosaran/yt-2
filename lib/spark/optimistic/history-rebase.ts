import type { CompositionDocument } from '../composition-client'

/**
 * Spark instant undo / redo: the editor's prediction of what the server's undo (or redo) of one of its own commands does to
 * the copy it draws now, without the gateway's typed inverse ops (the UI port has none).
 *
 * The editor keeps, per command it drew, the copy before and the copy after (`HistoryEntry`). Undo moves the drawn copy from
 * `after` back to `before`, redo from `before` to `after` - but only in the parts that command changed: everything else of the
 * drawn copy (an edit queued later, another actor's edit a re-read brought in) is kept as it is. This is the client side of the
 * server's rule (F28 undo, Spark redo): the undo is a CAS over the entities the group changed, another actor's work is never
 * reverted. When the drawn copy no longer matches `from` in a part the change touched, there is no prediction (null) and the
 * editor waits for the server, exactly like an op the port cannot apply.
 *
 * Revisions and the working copy version are bookkeeping, never content: they are ignored in every comparison and the drawn
 * copy keeps its own (the server's answer, read back right after, carries the real ones). Lists of objects with an id
 * (scenes, layers, sections, audio placements, caption tracks, template instances, sources) are matched by id, so a change to
 * one scene and an edit of another scene meet without a conflict; any other list is one value.
 *
 * Pure: the inputs are never mutated, and every part the change did not touch is the very object of `doc` (copy on write).
 */
export function rebaseDocumentChange(
  doc: CompositionDocument,
  from: CompositionDocument,
  to: CompositionDocument,
): CompositionDocument | null {
  const result = merge(doc, from, to)
  if (result === CONFLICT || !isRecord(result)) return null
  return result as CompositionDocument
}

/** Whether two copies hold the same content (revisions and the working copy version aside). */
export function sameDocumentContent(left: CompositionDocument, right: CompositionDocument): boolean {
  return sameContent(left, right)
}

const CONFLICT: unique symbol = Symbol('history-rebase-conflict')
type Merged = unknown | typeof CONFLICT

/** Keys that are bookkeeping, not content: a touched entity gets a new rev on the server, the copy a new version. */
const BOOKKEEPING_KEYS: ReadonlySet<string> = new Set(['rev', 'working_copy_version'])

/** The id field of each kind of list element the document holds (first match wins; it must be a unique string). */
const ID_KEYS = ['scene_id', 'layer_id', 'section_id', 'placement_id', 'caption_track_id', 'instance_id', 'source_id'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameContent(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) if (!sameContent(left[index], right[index])) return false
    return true
  }
  if (isRecord(left)) {
    if (!isRecord(right)) return false
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    for (const key of keys) {
      if (BOOKKEEPING_KEYS.has(key)) continue
      if (!sameContent(left[key], right[key])) return false
    }
    return true
  }
  return Number.isNaN(left) && Number.isNaN(right)
}

/**
 * Three-way merge of one value: `doc` gets the change `from` → `to`. Untouched (`from` equals `to`): `doc` as it is. `doc` still
 * as `from`: `to`. Otherwise the parts are merged key by key (objects) or id by id (lists of identified objects); anything else
 * is a conflict.
 */
function merge(doc: unknown, from: unknown, to: unknown): Merged {
  if (from === to || sameContent(from, to)) return doc
  if (sameContent(doc, from)) return keepBookkeeping(doc, to)
  if (isRecord(doc) && isRecord(from) && isRecord(to)) return mergeRecord(doc, from, to)
  if (Array.isArray(doc) && Array.isArray(from) && Array.isArray(to)) {
    const idKey = sharedIdKey(doc, from, to)
    if (idKey) return mergeIdentified(doc, from, to, idKey)
  }
  return CONFLICT
}

/** `to` in place of `doc` (the same content as `from`); `doc`'s own revisions stay where both have the entity. */
function keepBookkeeping(doc: unknown, to: unknown): unknown {
  if (!isRecord(doc) || !isRecord(to)) return to
  let changed = false
  const out: Record<string, unknown> = { ...to }
  for (const key of BOOKKEEPING_KEYS) {
    if (key in doc && key in to && doc[key] !== to[key]) {
      out[key] = doc[key]
      changed = true
    }
  }
  return changed ? out : to
}

function mergeRecord(doc: Record<string, unknown>, from: Record<string, unknown>, to: Record<string, unknown>): Merged {
  let out: Record<string, unknown> | null = null
  const keys = new Set([...Object.keys(doc), ...Object.keys(from), ...Object.keys(to)])
  for (const key of keys) {
    if (BOOKKEEPING_KEYS.has(key)) continue
    const merged = merge(doc[key], from[key], to[key])
    if (merged === CONFLICT) return CONFLICT
    if (merged === doc[key] && (key in doc || merged === undefined)) continue
    out ??= { ...doc }
    if (merged === undefined) delete out[key]
    else out[key] = merged
  }
  return out ?? doc
}

function idOf(value: unknown, idKey: string): string | null {
  if (!isRecord(value)) return null
  const id = value[idKey]
  return typeof id === 'string' ? id : null
}

/** The id field every element of the three lists has, unique in each list; null when there is none. */
function sharedIdKey(...lists: unknown[][]): string | null {
  const sample = lists.find((list) => list.length > 0)?.[0]
  if (!isRecord(sample)) return null
  for (const key of ID_KEYS) {
    if (!(key in sample)) continue
    const fits = lists.every((list) => {
      const ids = list.map((element) => idOf(element, key))
      return ids.every((id) => id !== null) && new Set(ids).size === ids.length
    })
    if (fits) return key
  }
  return null
}

function mergeIdentified(doc: unknown[], from: unknown[], to: unknown[], idKey: string): Merged {
  const byId = (list: unknown[]) => new Map(list.map((element) => [idOf(element, idKey)!, element]))
  const docById = byId(doc)
  const fromById = byId(from)
  const toById = byId(to)
  const fromIds = from.map((element) => idOf(element, idKey)!)
  const toIds = to.map((element) => idOf(element, idKey)!)
  const docIds = doc.map((element) => idOf(element, idKey)!)
  const sameOrder = fromIds.length === toIds.length && fromIds.every((id, index) => id === toIds[index])

  const mergeElement = (id: string): Merged => {
    const inDoc = docById.has(id)
    const inFrom = fromById.has(id)
    const inTo = toById.has(id)
    if (inFrom && inTo) {
      // Kept by the change: merged in place; gone from the drawn copy only if the change did not touch it either.
      if (!inDoc) return sameContent(fromById.get(id), toById.get(id)) ? undefined : CONFLICT
      return merge(docById.get(id), fromById.get(id), toById.get(id))
    }
    if (inTo) return inDoc ? (sameContent(docById.get(id), toById.get(id)) ? docById.get(id) : CONFLICT) : toById.get(id)
    // Removed by the change: the drawn copy must still hold it as the change found it.
    if (!inDoc) return undefined
    return sameContent(docById.get(id), fromById.get(id)) ? undefined : CONFLICT
  }

  if (sameOrder) {
    // The change kept the list's members and order: the drawn copy keeps its own (another edit may have added or moved some).
    let changed = false
    const out: unknown[] = []
    for (const id of docIds) {
      if (!fromById.has(id)) {
        out.push(docById.get(id))
        continue
      }
      const merged = mergeElement(id)
      if (merged === CONFLICT) return CONFLICT
      if (merged !== docById.get(id)) changed = true
      if (merged !== undefined) out.push(merged)
    }
    for (const id of fromIds) {
      if (docById.has(id)) continue
      const merged = mergeElement(id)
      if (merged === CONFLICT) return CONFLICT
    }
    return changed ? out : doc
  }

  // The change inserted, removed or moved members: the drawn copy must have exactly the members and order the change found.
  if (docIds.length !== fromIds.length || docIds.some((id, index) => id !== fromIds[index])) return CONFLICT
  const out: unknown[] = []
  for (const id of toIds) {
    const merged = mergeElement(id)
    if (merged === CONFLICT) return CONFLICT
    if (merged !== undefined) out.push(merged)
  }
  for (const id of fromIds) {
    if (toById.has(id)) continue
    if (mergeElement(id) === CONFLICT) return CONFLICT
  }
  return out
}
