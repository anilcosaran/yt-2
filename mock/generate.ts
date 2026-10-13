// Turns a zod schema into a value that passes it: generate (mock/schema-mock.ts), then patch whatever zod still
// rejects. Fixtures use `mockOf` to fill in parts of a response they do not want to write by hand.

import type { ZodIssue, ZodTypeAny } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'

import { repair, safeParse } from './repair'
import { generateFromSchema, type MockMode } from './schema-mock'

export { safeParse } from './repair'

const ATTEMPTS: Array<{ mode: MockMode; salt: string }> = [
  { mode: 'rich', salt: '' },
  { mode: 'rich', salt: '#2' },
  { mode: 'rich', salt: '#3' },
  { mode: 'minimal', salt: '' },
]

type GenerateRequest = { method: string; path: string; body?: unknown }

/** Parsed (post-transform) mock value for `schema`, i.e. what the UI receives. */
export function generateValid(schema: ZodTypeAny, request: GenerateRequest) {
  return schema.parse(generateRaw(schema, request))
}

/** Example data for any schema, e.g. `mockOf(channelSchema, 'my-channel')` inside a fixture. */
export function mockOf(schema: ZodTypeAny, seed = 'fixture'): unknown {
  return generateRaw(schema, { method: 'GET', path: `/fixture/${seed}` })
}

/** Raw (pre-transform) JSON that passes `schema`, i.e. what the API would have sent. */
export function generateRaw(schema: ZodTypeAny, request: GenerateRequest): unknown {
  let lastIssues: ZodIssue[] = []
  for (const attempt of ATTEMPTS) {
    const value = generateFromSchema(schema, {
      seed: `${request.method} ${request.path}${attempt.salt}`,
      mode: attempt.mode,
      path: request.path,
    })
    if (request.method !== 'GET') echoBody(value, request.body)
    for (let round = 0; round < 6; round += 1) {
      const parsed = safeParse(schema, value)
      if (parsed.success) return value
      lastIssues = parsed.issues
      if (!repair(value, parsed.issues)) break
    }
  }
  console.warn(`[yt-2 mock] could not build a valid response for ${request.method} ${request.path}`, lastIssues.slice(0, 6))
  throw new AuthClientError('GATEWAY_RESPONSE_INVALID', 'Mock data could not be generated for this endpoint.', 502, lastIssues.slice(0, 8))
}

/** Mutations answer with what was sent where the shapes overlap (a rename shows the new name, …). */
function echoBody(value: unknown, body: unknown) {
  if (!isObject(body) || !isObject(value)) return
  const target = isObject(value.data) ? value.data : value
  for (const [key, sent] of Object.entries(body)) {
    if (key in target && sent !== undefined && typeof sent === typeof target[key]) target[key] = sent
  }
}

/** Deep-merges `override` into `base` (objects merge, everything else replaces). */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (!isObject(base) || !isObject(override)) return override === undefined ? base : override
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) out[key] = deepMerge(base[key], value)
  return out
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
