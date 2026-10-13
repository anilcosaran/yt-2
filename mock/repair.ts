// Fixes a generated value in place at the paths zod rejected (wrong enum member, too short, unknown keys…).

import type { ZodIssue, ZodTypeAny } from 'zod'

export function safeParse(schema: ZodTypeAny, value: unknown):
  | { success: true; data: unknown }
  | { success: false; issues: ZodIssue[] } {
  try {
    const result = schema.safeParse(value)
    return result.success ? { success: true, data: result.data } : { success: false, issues: result.error.issues }
  } catch (error) {
    return {
      success: false,
      issues: [{ code: 'custom', path: [], message: error instanceof Error ? error.message : String(error) }],
    }
  }
}

/** Patches the generated value at the paths zod complained about. Returns false when nothing could be fixed. */
export function repair(root: unknown, issues: ZodIssue[]): boolean {
  let changed = false
  for (const issue of issues) {
    const path = issue.path
    if (path.length === 0) continue
    const parent = getAt(root, path.slice(0, -1))
    const last = path[path.length - 1]
    if (!isObject(parent) && !Array.isArray(parent)) continue
    const container = parent as Record<string | number, unknown>
    const current = container[last]

    switch (issue.code) {
      case 'invalid_enum_value':
        container[last] = issue.options[0]
        changed = true
        break
      case 'invalid_literal':
        container[last] = issue.expected
        changed = true
        break
      case 'unrecognized_keys':
        if (isObject(current)) {
          for (const key of issue.keys) delete current[key]
          changed = true
        }
        break
      case 'too_small':
        if (Array.isArray(current) && current.length > 0) {
          while (current.length < Number(issue.minimum)) current.push(structuredClone(current[current.length - 1]))
          changed = true
        } else if (typeof current === 'string') {
          container[last] = current.padEnd(Number(issue.minimum), 'x')
          changed = true
        } else if (typeof current === 'number') {
          container[last] = Number(issue.minimum) + (issue.inclusive ? 0 : 1)
          changed = true
        } else {
          changed = removeAt(container, last) || changed
        }
        break
      case 'too_big':
        if (Array.isArray(current)) current.length = Number(issue.maximum)
        else if (typeof current === 'string') container[last] = current.slice(0, Number(issue.maximum))
        else if (typeof current === 'number') container[last] = Number(issue.maximum) - (issue.inclusive ? 0 : 1)
        changed = true
        break
      case 'invalid_type':
        if (issue.expected === 'null') container[last] = null
        else if (issue.expected === 'undefined') delete container[last]
        else if (issue.expected === 'array') container[last] = []
        else if (issue.expected === 'boolean') container[last] = false
        else if (issue.expected === 'number') container[last] = 0
        else if (issue.expected === 'string') container[last] = ''
        else break
        changed = true
        break
      default:
        changed = removeAt(container, last) || changed
    }
  }
  return changed
}

function removeAt(container: Record<string | number, unknown>, key: string | number) {
  if (Array.isArray(container) && typeof key === 'number') {
    if (container.length <= 1) return false
    container.splice(key, 1)
    return true
  }
  if (!(key in container)) return false
  delete container[key]
  return true
}

function getAt(root: unknown, path: Array<string | number>): unknown {
  let current = root
  for (const key of path) {
    if (!isObject(current) && !Array.isArray(current)) return undefined
    current = (current as Record<string | number, unknown>)[key]
  }
  return current
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}


