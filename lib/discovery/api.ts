'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'
import { isPrivatePublicMetadataKey, publicCatalogText, publicInputSchema, publicMetadataRecord, publicModelLabel, publicModelQuality, publicModelSpeed, publicModelEstimatedCredits, publicModelCostLabel, publicModelPricingRule, publicModelVisibility, publicProviderRequirement } from '@/lib/public-model-display'

type GatewayRequestOptions = { signal?: AbortSignal }

export const DISCOVERY_TOOLS_CATALOG_QUERY_KEY = ['discovery', 'tools-catalog'] as const
export const DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS = 5 * 60_000
export const DISCOVERY_TOOLS_CATALOG_STALE_RETENTION_MS = 7 * 24 * 60 * 60_000
const DISCOVERY_TOOLS_CATALOG_STORAGE_KEY = 'youtorch:discovery-tools-catalog:v3'
const LEGACY_DISCOVERY_TOOLS_CATALOG_STORAGE_KEY = 'youtorch:discovery-tools-catalog:v2'

const recordSchema = z.record(z.unknown()).catch({}).transform(publicMetadataRecord)

const discoveryToolStandardFieldBindingSchema = z.object({
  name: z.string(),
  source: z.enum(['node', 'model']).catch('node'),
  required: z.boolean().catch(false),
  has_allowed_values: z.boolean().catch(false),
}).strip()

const discoveryToolFormContractSchema = z.object({
  standard_fields: z.object({
    mode: discoveryToolStandardFieldBindingSchema.optional(),
    prompt: discoveryToolStandardFieldBindingSchema.optional(),
    model: discoveryToolStandardFieldBindingSchema.optional(),
    duration: discoveryToolStandardFieldBindingSchema.optional(),
    resolution: discoveryToolStandardFieldBindingSchema.optional(),
    ratio: discoveryToolStandardFieldBindingSchema.optional(),
    motion: discoveryToolStandardFieldBindingSchema.optional(),
    seed: discoveryToolStandardFieldBindingSchema.optional(),
    audio: discoveryToolStandardFieldBindingSchema.optional(),
  }).strip().catch({}),
}).strip().catch({ standard_fields: {} })

const discoveryToolInputContractSchema = z.object({
  node_type: z.string(),
  model_id: z.string().optional(),
  schema_hash: z.string().catch(''),
  pricing_hash: z.string().nullable().catch(null),
  input_schema: z.record(z.unknown()).catch({}).transform(publicInputSchema),
  form_contract: discoveryToolFormContractSchema,
  input_classification: recordSchema,
  output_schema: z.record(z.unknown()).catch({}).transform(publicInputSchema),
  cost_estimate: recordSchema,
  pricing_metadata: recordSchema.transform(() => ({})),
  provider_requirement: recordSchema.transform(publicProviderRequirement),
  artifact_output_type: z.string().catch(''),
}).strip()

const discoveryToolEffectiveInputContractSchema = discoveryToolInputContractSchema.extend({
  model_id: z.string().catch(''),
  model_schema_hash: z.string().nullable().catch(null),
}).strip()

const discoveryToolModelSchema = z.object({
  id: z.string(),
  label: z.string().catch('Model').transform((value) => publicModelLabel(value)),
  capability: z.string().catch(''),
  model_type: z.string().catch(''),
  description: z.string().catch('').transform((value) => publicCatalogText(value)),
  quality: z.string().catch('Standard'),
  speed: z.string().catch('Standard'),
  cost_label: z.string().catch('Estimate unavailable'),
  estimated_credits: z.number().nullable().catch(null),
  input_schema: z.record(z.unknown()).catch({}).transform(publicInputSchema),
  form_contract: discoveryToolFormContractSchema,
  effective_input_contract: discoveryToolEffectiveInputContractSchema.optional(),
  pricing_rule: recordSchema.transform(publicModelPricingRule),
  visibility: recordSchema.transform(publicModelVisibility),
  cost_metadata: recordSchema.transform(() => ({})),
}).strip().transform((model) => ({
  ...model,
  description: publicCatalogText(model.description),
  quality: publicModelQuality(model.quality),
  speed: publicModelSpeed(model.speed),
  cost_label: publicModelCostLabel(model.cost_label, model.estimated_credits),
  estimated_credits: publicModelEstimatedCredits(model.estimated_credits, model.cost_label),
}))

const discoveryToolCatalogItemSchema = z.object({
  tool_id: z.string(),
  title: z.string().catch('Tool').transform((value) => publicCatalogText(value, 'Tool')),
  short_title: z.string().catch('Tool').transform((value) => publicCatalogText(value, 'Tool')),
  description: z.string().catch('').transform((value) => publicCatalogText(value)),
  category: z.string().catch(''),
  badge: z.string().catch(''),
  model_kind: z.enum(['image', 'video', 'voice', 'agent']).catch('agent'),
  status: z.enum(['active', 'maintenance', 'disabled']).catch('disabled'),
  maintenance: z.boolean().catch(false),
  execution: z.object({
    mode: z.literal('agent_api').catch('agent_api'),
    node_type: z.string(),
    agent_api_path: z.literal('/api/v1/workflows/agents/execute').catch('/api/v1/workflows/agents/execute'),
  }).strip(),
  input_contract: discoveryToolInputContractSchema,
  models: z.array(discoveryToolModelSchema).catch([]),
  defaults: z.record(z.unknown()).catch({}),
  ui: z.object({
    icon: z.string().catch(''),
    icon_foreground: z.string().regex(/^#[0-9a-f]{6}$/i).optional().catch(undefined),
    accent: z.string().catch(''),
    icon_shape: z.string().catch(''),
    icon_css: z.string().catch(''),
    icon_asset_url: z.string().catch(''),
    thumbnail: z.string().catch(''),
    featured: z.boolean().catch(false),
    is_new: z.boolean().catch(false),
    sort_order: z.number().catch(0),
    prompt_placeholder: z.string().catch('').transform((value) => publicCatalogText(value)),
    upload_title: z.string().catch('').transform((value) => publicCatalogText(value)),
    upload_description: z.string().catch('').transform((value) => publicCatalogText(value)),
  }).strip().catch({
    icon: '',
    accent: '',
    icon_shape: '',
    icon_css: '',
    icon_asset_url: '',
    thumbnail: '',
    featured: false,
    is_new: false,
    sort_order: 0,
    prompt_placeholder: '',
    upload_title: '',
    upload_description: '',
  }),
}).strip().transform((tool) => {
  const publicInputNames = new Set(['model_id'])
  const schemas = [tool.input_contract.input_schema, ...tool.models.flatMap((model) => [model.input_schema, model.effective_input_contract?.input_schema ?? {}])]
  for (const schema of schemas) {
    const fields = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? schema.properties : schema
    for (const [name, field] of Object.entries(fields)) {
      if (!isPrivatePublicMetadataKey(name)) publicInputNames.add(name)
      if (field && typeof field === 'object' && 'name' in field && typeof field.name === 'string'
        && !isPrivatePublicMetadataKey(field.name) && !/^(?:provider|provider_name)$/i.test(field.name)) publicInputNames.add(field.name)
    }
  }
  return { ...tool, defaults: Object.fromEntries(Object.entries(tool.defaults).filter(([key]) => publicInputNames.has(key))) }
})

const sectionNumberSchema = z.preprocess((value) => typeof value === 'string' ? Number(value.trim()) : value, z.number().finite())
const sectionBooleanSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return value
}, z.boolean())
const sectionColorSchema = z.string().trim().regex(/^#[0-9a-f]{6}$/i)

const sectionMediaFields = {
  expires_at: z.string(), show_in_shelves: sectionBooleanSchema, hero_only: sectionBooleanSchema,
  media_url: z.string(), media_kind: z.string().trim().pipe(z.enum(['image', 'video'])),
  media_alt: z.string().transform((value) => publicCatalogText(value)),
  media_fit: z.string().trim().pipe(z.enum(['cover', 'contain'])), media_position: z.string().trim().pipe(z.enum(['left', 'center', 'right'])),
  slide_duration_seconds: sectionNumberSchema, slide_transition: z.string().trim().pipe(z.enum(['zoom', 'fade'])),
  scrim_color: sectionColorSchema, scrim_opacity: sectionNumberSchema,
  button_color: sectionColorSchema, button_text_color: sectionColorSchema,
  badge: z.string().transform((value) => publicCatalogText(value)),
  cta_label: z.string().transform((value) => publicCatalogText(value)), cta_href: z.string(),
  secondary_cta_label: z.string().transform((value) => publicCatalogText(value)), secondary_cta_href: z.string(),
}
const sectionMetadataSchema = recordSchema.transform((value) => {
  const result: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(sectionMediaFields)) {
    for (const field of [key, `discovery_${key}`]) {
      const parsed = schema.safeParse(value[field])
      if (parsed.success) result[field] = parsed.data
    }
  }
  return result
})

const discoveryCatalogSectionItemSchema = z.object({
  item_type: z.literal('tool').catch('tool'),
  item_key: z.string().catch(''),
  sort_order: z.number().catch(0),
  metadata: recordSchema.transform(() => ({})),
}).strip()

const discoveryCatalogSectionSchema = z.object({
  section_key: z.string().catch(''),
  view_key: z.string().catch('trends'),
  title: z.string().catch(''),
  subtitle: z.string().nullable().catch(null),
  source_mode: z.enum(['manual', 'featured', 'category', 'model_kind', 'trending']).catch('manual'),
  sort_order: z.number().catch(0),
  item_limit: z.number().nullable().catch(null),
  items: z.array(discoveryCatalogSectionItemSchema).catch([]),
  metadata: sectionMetadataSchema,
}).strip()

const discoveryWorkflowTemplateSchema = z.object({
  template_key: z.string().catch(''),
  title: z.string().catch(''),
  category: z.string().catch('Top picks'),
  description: z.string().catch('').transform((value) => publicCatalogText(value)),
  steps: z.array(z.string()).catch([]),
  examples: z.array(z.string()).catch([]),
  estimated_cost_label: z.string().nullable().catch(null),
  nodes: z.array(z.string()).catch([]),
  tool_id: z.string().nullable().catch(null),
  tone: z.string().nullable().catch(null),
  cover_type: z.string().nullable().catch(null),
  foreground_image_url: z.string().nullable().catch(null),
  preview_video_url: z.string().nullable().catch(null),
  sort_order: z.number().catch(0),
  metadata: recordSchema.transform(() => ({})),
}).strip()

export const discoveryToolsCatalogDataSchema = z.object({
  tools: z.array(discoveryToolCatalogItemSchema).catch([]),
  sections: z.array(discoveryCatalogSectionSchema).catch([]),
  workflow_templates: z.array(discoveryWorkflowTemplateSchema).catch([]),
  total: z.number().catch(0),
  source: z.literal('discovery_projection').catch('discovery_projection'),
}).strip()

const discoveryToolsCatalogResponseSchema = z.object({
  data: discoveryToolsCatalogDataSchema,
})

const discoveryToolsCatalogCacheSchema = z.object({
  data: discoveryToolsCatalogDataSchema,
  updatedAt: z.number(),
  expiresAt: z.number(),
})

export type DiscoveryToolCatalogItem = z.infer<typeof discoveryToolCatalogItemSchema>
export type DiscoveryToolsCatalog = z.infer<typeof discoveryToolsCatalogResponseSchema>['data']
export type DiscoveryToolsCatalogCache = {
  data: DiscoveryToolsCatalog
  updatedAt: number
  stale: boolean
}

type StoredDiscoveryToolsCatalogCache = {
  data: DiscoveryToolsCatalog
  updatedAt: number
  expiresAt: number
}

let discoveryToolsCatalogMemoryCache: StoredDiscoveryToolsCatalogCache | null = null

export function getCachedDiscoveryToolsCatalog(
  now = Date.now(),
  options: { allowStale?: boolean } = {},
): DiscoveryToolsCatalogCache | null {
  const memoryCache = readUsableDiscoveryCache(discoveryToolsCatalogMemoryCache, now, options.allowStale === true)
  if (memoryCache) return memoryCache
  if (typeof window === 'undefined') return null

  try {
    window.localStorage.removeItem(LEGACY_DISCOVERY_TOOLS_CATALOG_STORAGE_KEY)
    const rawCache = window.localStorage.getItem(DISCOVERY_TOOLS_CATALOG_STORAGE_KEY)
    if (!rawCache) return null
    const parsedCache = discoveryToolsCatalogCacheSchema.parse(JSON.parse(rawCache))
    if (parsedCache.updatedAt + DISCOVERY_TOOLS_CATALOG_STALE_RETENTION_MS <= now) {
      window.localStorage.removeItem(DISCOVERY_TOOLS_CATALOG_STORAGE_KEY)
      discoveryToolsCatalogMemoryCache = null
      return null
    }
    discoveryToolsCatalogMemoryCache = parsedCache
    try { window.localStorage.setItem(DISCOVERY_TOOLS_CATALOG_STORAGE_KEY, JSON.stringify(parsedCache)) } catch { /* A readable cache can still be used when writes are blocked. */ }
    return readUsableDiscoveryCache(parsedCache, now, options.allowStale === true)
  } catch {
    try { window.localStorage.removeItem(DISCOVERY_TOOLS_CATALOG_STORAGE_KEY) } catch { /* Storage may be blocked. */ }
    discoveryToolsCatalogMemoryCache = null
    return null
  }
}

function readUsableDiscoveryCache(
  cache: StoredDiscoveryToolsCatalogCache | null,
  now: number,
  allowStale: boolean,
): DiscoveryToolsCatalogCache | null {
  if (!cache) return null
  const stale = cache.expiresAt <= now
  if (stale && (!allowStale || cache.updatedAt + DISCOVERY_TOOLS_CATALOG_STALE_RETENTION_MS <= now)) return null
  return {
    data: cache.data,
    updatedAt: cache.updatedAt,
    stale,
  }
}

function cacheDiscoveryToolsCatalog(data: DiscoveryToolsCatalog, now = Date.now()) {
  const cache = {
    data,
    updatedAt: now,
    expiresAt: now + DISCOVERY_TOOLS_CATALOG_CACHE_TTL_MS,
  }
  discoveryToolsCatalogMemoryCache = cache
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(LEGACY_DISCOVERY_TOOLS_CATALOG_STORAGE_KEY)
    window.localStorage.setItem(DISCOVERY_TOOLS_CATALOG_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Storage can be unavailable in private sessions; React Query still keeps the in-tab cache.
  }
}

export async function getDiscoveryToolsCatalog(options: GatewayRequestOptions = {}) {
  const response = await gatewayRequest('/api/v1/discovery/tools/catalog', {
    schema: discoveryToolsCatalogResponseSchema,
    signal: options.signal,
  })
  cacheDiscoveryToolsCatalog(response.data)
  return response.data
}
