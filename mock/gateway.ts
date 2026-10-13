// The only "backend" of yt-2. lib/gateway/client.ts sends every API call here instead of over the network:
// a matching fixture (mock/fixtures.ts) answers first, otherwise a schema-valid response is generated.

import type { ZodTypeAny } from 'zod'

import { findFixture, type MockRequest } from './fixtures'
import { deepMerge, generateRaw, generateValid, safeParse } from './generate'

const GET_LATENCY_MS = Number(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS ?? 120)

export async function mockGatewayResponse(
  path: string,
  options: { method?: string; body?: unknown; schema: ZodTypeAny; signal?: AbortSignal },
): Promise<unknown> {
  const method = options.method ?? 'GET'
  const [pathname, search = ''] = path.split('?')
  const request: MockRequest = { path: pathname, method, body: options.body, query: new URLSearchParams(search) }

  await delay(method === 'GET' ? GET_LATENCY_MS : GET_LATENCY_MS * 2, options.signal)

  const found = findFixture(request)
  if (found) {
    const payload = await found.fixture.handler(request, found.match)
    const candidate = found.fixture.merge
      ? deepMerge(generateRaw(options.schema, { method, path, body: options.body }), payload)
      : payload
    const parsed = safeParse(options.schema, candidate)
    if (parsed.success) return parsed.data
    console.warn(`[yt-2 mock] fixture for ${method} ${pathname} does not match the schema; using generated data`, parsed.issues)
  }

  return generateValid(options.schema, { method, path, body: options.body })
}

function delay(ms: number, signal?: AbortSignal) {
  if (!ms) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
