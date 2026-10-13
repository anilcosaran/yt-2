'use client'

// yt-2: no API connection. Every call that used to go to the Youtorch API Gateway is answered by the local
// mock layer (mock/gateway.ts). The exported surface is unchanged, so lib/*/api.ts modules and the
// components that use them work as before.

import { z } from 'zod'

import { mockGatewayResponse } from '@/mock/gateway'

const MOCK_CSRF_TOKEN = 'mock-csrf-token-0000000000000000000000'

export type GatewayRequestOptions<TSchema extends z.ZodTypeAny> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  schema: TSchema
  csrf?: boolean
  retryOnRateLimit?: boolean
  signal?: AbortSignal
  timeoutMs?: number
  headers?: Record<string, string>
  fetcher?: typeof fetch
}

/** Result of a conditional read: the mock layer always answers with a fresh body. */
export type GatewayConditionalResult<T> =
  | { notModified: true; etag: string | null }
  | { notModified: false; data: T; etag: string | null }

export function resetGatewayAuthTransport() {}

export function invalidateGatewayCsrfToken() {}

export async function gatewayRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  options: GatewayRequestOptions<TSchema>,
): Promise<z.output<TSchema>> {
  return (await mockGatewayResponse(path, {
    method: options.method,
    body: options.body,
    schema: options.schema,
    signal: options.signal,
  })) as z.output<TSchema>
}

export async function gatewayConditionalRequest<TSchema extends z.ZodTypeAny>(
  path: string,
  options: Omit<GatewayRequestOptions<TSchema>, 'method' | 'body' | 'csrf'> & { ifNoneMatch: string | null },
): Promise<GatewayConditionalResult<z.output<TSchema>>> {
  const data = await gatewayRequest(path, { ...options, method: 'GET' })
  return { notModified: false, data, etag: null }
}

export async function getGatewayCsrfToken(_signal?: AbortSignal, _fetcher?: typeof fetch) {
  return MOCK_CSRF_TOKEN
}
