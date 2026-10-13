'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

const WORKFLOW_NODE_FAVORITES_CLIENT_TTL_MS = 5 * 60 * 1000
const WORKFLOW_NODE_FAVORITES_SESSION_CACHE_KEY = 'youtorch:workflow-node-favorites:v1'

const workflowNodeFavoritesResponseSchema = z.object({
  data: z.object({
    favorite_node_types: z.array(z.string()).catch([]),
    total: z.number().catch(0),
  }),
})

const workflowNodeFavoriteMutationResponseSchema = z.object({
  data: z.object({
    node_type: z.string(),
    favorite: z.boolean(),
  }),
})

let favoritesCache: { nodeTypes: string[]; expiresAt: number } | null = readFavoritesSessionCache()
let favoritesRequest: Promise<string[]> | null = null
let favoritesRevision = 0
const favoriteMutationRequests = new Map<string, { favorite: boolean; promise: Promise<string[]> }>()
let favoriteMutationTail: Promise<unknown> = Promise.resolve()

export function peekWorkflowNodeFavoriteTypes() {
  return favoritesCache?.nodeTypes ?? []
}

export async function listWorkflowNodeFavoriteTypes(options: { signal?: AbortSignal; force?: boolean } = {}) {
  const now = Date.now()
  if (!options.force && favoritesCache && favoritesCache.expiresAt > now) return favoritesCache.nodeTypes
  if (!options.force && favoritesRequest) return observeRequestWithAbort(favoritesRequest, options.signal)

  const requestRevision = favoritesRevision
  const request = gatewayRequest('/api/v1/workflows/nodes/favorites', {
    schema: workflowNodeFavoritesResponseSchema,
    signal: options.force ? options.signal : undefined,
  }).then((response) => {
    const nodeTypes = uniqueNodeTypes(response.data.favorite_node_types)
    if (requestRevision === favoritesRevision) {
      writeFavoritesCache(nodeTypes)
      return nodeTypes
    }
    return favoritesCache?.nodeTypes ?? nodeTypes
  }).finally(() => {
    if (favoritesRequest === request) favoritesRequest = null
  })

  if (!options.force) favoritesRequest = request
  return options.force ? request : observeRequestWithAbort(request, options.signal)
}

export async function setWorkflowNodeFavorite(nodeType: string, favorite: boolean) {
  const normalized = nodeType.trim()
  if (!normalized) return peekWorkflowNodeFavoriteTypes()

  const existing = favoriteMutationRequests.get(normalized)
  if (existing?.favorite === favorite) return existing.promise

  const baselineRequest = favoritesCache
    ? Promise.resolve(favoritesCache.nodeTypes)
    : favoritesRequest ?? listWorkflowNodeFavoriteTypes()
  favoritesRevision += 1
  const request = favoriteMutationTail.catch(() => undefined).then(async () => {
    const baselineNodeTypes = favoritesCache?.nodeTypes ?? await baselineRequest
    const response = await mutateWorkflowNodeFavorite(normalized, favorite)

    const resolvedNodeType = response.data.node_type.trim() || normalized
    const current = new Set(favoritesCache?.nodeTypes ?? baselineNodeTypes)
    if (response.data.favorite) {
      current.add(resolvedNodeType)
    } else {
      for (const key of workflowFavoriteLookupKeys(normalized)) current.delete(key)
      for (const key of workflowFavoriteLookupKeys(resolvedNodeType)) current.delete(key)
    }
    const nodeTypes = [...current]
    writeFavoritesCache(nodeTypes)
    return nodeTypes
  })
  favoriteMutationTail = request
  favoriteMutationRequests.set(normalized, { favorite, promise: request })
  const cleanup = () => {
    if (favoriteMutationRequests.get(normalized)?.promise === request) favoriteMutationRequests.delete(normalized)
  }
  void request.then(cleanup, cleanup)
  return request
}

function observeRequestWithAbort<T>(request: Promise<T>, signal: AbortSignal | undefined) {
  if (!signal) return request
  if (signal.aborted) return Promise.reject(createAbortError())

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      cleanup()
      reject(createAbortError())
    }
    const cleanup = () => signal.removeEventListener('abort', handleAbort)
    signal.addEventListener('abort', handleAbort, { once: true })
    request.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error)
      },
    )
  })
}

function createAbortError() {
  return new DOMException('The operation was aborted.', 'AbortError')
}

async function mutateWorkflowNodeFavorite(nodeType: string, favorite: boolean) {
  try {
    return await gatewayRequest('/api/v1/workflows/nodes/favorites', {
      method: 'PUT',
      csrf: true,
      body: { node_type: nodeType, favorite },
      schema: workflowNodeFavoriteMutationResponseSchema,
    })
  } catch (error) {
    if (!isMissingFavoriteCollectionRoute(error)) throw error
    return await gatewayRequest(`/api/v1/workflows/nodes/${encodeWorkflowNodeTypePath(nodeType)}/favorite`, {
      method: favorite ? 'PUT' : 'DELETE',
      csrf: true,
      schema: workflowNodeFavoriteMutationResponseSchema,
    })
  }
}

function encodeWorkflowNodeTypePath(nodeType: string) {
  return encodeURIComponent(nodeType).replace(/%40/g, '@')
}

function isMissingFavoriteCollectionRoute(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: unknown; code?: unknown }
  return candidate.status === 404 && candidate.code !== 'NOT_FOUND'
}

export function workflowFavoriteLookupKeys(nodeType: string): string[] {
  const trimmed = nodeType.trim()
  if (!trimmed) return []
  const at = trimmed.lastIndexOf('@')
  const base = at > 0 ? trimmed.slice(0, at) : trimmed
  const version = at > 0 ? trimmed.slice(at + 1) : '1'
  return [...new Set([trimmed, base, `${base}@${version}`].filter(Boolean))]
}

function uniqueNodeTypes(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function writeFavoritesCache(nodeTypes: string[]) {
  favoritesCache = {
    nodeTypes: uniqueNodeTypes(nodeTypes),
    expiresAt: Date.now() + WORKFLOW_NODE_FAVORITES_CLIENT_TTL_MS,
  }
  writeFavoritesSessionCache(favoritesCache)
}

function readFavoritesSessionCache(): { nodeTypes: string[]; expiresAt: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(WORKFLOW_NODE_FAVORITES_SESSION_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const expiresAt = typeof parsed?.expiresAt === 'number' ? parsed.expiresAt : 0
    if (expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(WORKFLOW_NODE_FAVORITES_SESSION_CACHE_KEY)
      return null
    }
    return {
      nodeTypes: Array.isArray(parsed?.nodeTypes) ? uniqueNodeTypes(parsed.nodeTypes) : [],
      expiresAt,
    }
  } catch {
    return null
  }
}

function writeFavoritesSessionCache(cache: { nodeTypes: string[]; expiresAt: number }) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(WORKFLOW_NODE_FAVORITES_SESSION_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Session storage is a UX acceleration only; API/Redis/DB remain the durable source.
  }
}
