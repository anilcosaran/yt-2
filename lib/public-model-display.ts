// Catalog copy may come from an older cached response. Keep infrastructure out
// of customer-facing labels even before the next catalog refresh completes.
const INFRASTRUCTURE_MARKERS = /\b(?:openrouter|comfy(?:ui|cloud|api)?|runpod|vast\.ai|fal\.ai|replicate|dataforseo|dataimpulse|ffmpeg|temporal|kubernetes)\b|\bvast\s+(?:ai|runtime|provider|endpoint|instance)\b|\b(?:provider|api)[_\s-]*(?:slug|key|route)|\b(?:runtime[_\s-]*adapter|execution[_\s-]*backend|backend|credential|serving vendor)\b|\b(?:via|through|powered by)\s+(?:openai|anthropic|google|cartesia|lmnt)\b|https?:\/\//i
const MODEL_NAMESPACE = /^(?:youtorch|openrouter|openai|google|anthropic|black[\s_.-]*forest[\s_.-]*labs|comfy(?:ui|cloud|api)?|cartesia|lmnt|fal(?:\.ai)?|replicate)\s*[:/_-]\s*/i

export function publicCatalogText(value: string | null | undefined, fallback = ''): string {
  const text = value?.trim()
  return text && !INFRASTRUCTURE_MARKERS.test(text) ? text : fallback
}

const PUBLIC_MODEL_QUALITIES = ['Standard', 'Highest', 'High', 'Draft', 'Balanced', 'Frontier', 'Good', 'Natural', 'Expressive', 'Instant']
const PUBLIC_MODEL_SPEEDS = ['Standard', 'Medium', 'Fast', 'Slow', 'Fastest', 'Very fast']

export function publicModelQuality(value: unknown): string {
  return publicVocabulary(value, PUBLIC_MODEL_QUALITIES) ?? 'Standard'
}

export function publicModelSpeed(value: unknown): string {
  return publicVocabulary(value, PUBLIC_MODEL_SPEEDS) ?? 'Standard'
}

export function publicModelEstimatedCredits(value: unknown, costLabel: unknown): number | null {
  if (typeof costLabel === 'string' && /[$€£]|\b(?:usd|eur|gbp)\b/i.test(costLabel)) return null
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function publicModelCostLabel(value: string, estimatedCredits: number | null): string {
  const label = value.trim()
  if (/^(?:Pricing missing - model not runnable|Pricing missing — model not runnable|Estimate unavailable|Usage based|Auto|(?:Image|Transcript|Video|Speech|Voice|Audio) credits)$/i.test(label)
    || /^\d+(?:\.\d+)? credits?(?: avg|\s*\/\s*(?:generated )?(?:second|minute|image|character|job|request|token)s?)?$/i.test(label)) return label
  const publicEstimate = publicModelEstimatedCredits(estimatedCredits, value)
  return publicEstimate !== null
    ? `${publicEstimate} credits avg`
    : 'Estimate unavailable'
}

export function publicModelLabel(value: string | null | undefined, fallback = 'Model'): string {
  let label = value?.trim() ?? ''
  // Legacy model ids sometimes have both reseller and original model namespaces.
  while (MODEL_NAMESPACE.test(label)) label = label.replace(MODEL_NAMESPACE, '').trim()
  // A published product label may include its creator; that is not evidence
  // of which supplier executes the request. Only legacy routing namespaces are removed.
  if (!publicCatalogText(label)) return fallback
  if (/^flux[\s_.-]*2[\s_.-]*klein[\s_.-]*4b$/i.test(label)) return 'FLUX.2 Klein 4B'
  if (/^auto(?:[-_](?:image|llm|video))?$/i.test(label)) return 'Auto'
  if (label.includes(' ') && /[A-Z]/.test(label)) return label
  if (/^gpt[-_]image[-_]/i.test(label)) return label.replace(/^gpt[-_]image[-_]/i, 'GPT Image ').replace(/[-_]/g, ' ').replace(/\bmini\b/i, 'Mini')
  if (/^(?:gpt|gemini|kling|claude|qwen|veo|sora|flux)[\s_.-]/i.test(label)) {
    return label.replace(/_/g, ' ').replace(/^(gpt|flux)/i, (name) => name.toUpperCase())
      .replace(/^(gemini|kling|claude|qwen|veo|sora)/i, (name) => name[0].toUpperCase() + name.slice(1).toLowerCase())
  }
  return label.split(/[-_\s]+/).filter(Boolean).map((part) => (
    /^\d+[a-z]+$/i.test(part) ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)
  )).join(' ') || fallback
}

export function publicModelFamily(label: string): string {
  const safeLabel = publicModelLabel(label).replace(/^(?:OpenAI|Anthropic|Google|Black[\s_.-]*Forest[\s_.-]*Labs)\s+/i, '')
  return /^(GPT|Gemini|Kling|Claude|Qwen|Veo|Sora|FLUX)(?=[\s.-]|$)/i.exec(safeLabel)?.[1] ?? 'Youtorch'
}

export function publicWorkflowByline(value: string | null | undefined): string {
  const label = value?.trim().replace(/^by\s+/i, '')
  if (!label) return ''
  // A provider field is never evidence that a serving vendor is public branding.
  if (/^(?:Youtorch(?: AI)?|YouTube(?: Analytics| Studio)?|Input|Note|Render|Review|Rules|Storage|Publisher|Studio)$/i.test(label)) return label
  return 'Youtorch'
}


const PRIVATE_METADATA_KEYS = new Set([
  'providerid', 'providerslug', 'providermodelid', 'providermodel', 'providermodelresolution',
  'sourceprovider', 'generatorprovider', 'toolprovider', 'selectedproviderslug',
  'resolvedmodelid', 'resolvedmodellabel', 'resolvedmodelconfig', 'backend', 'backends',
  'backendmodel', 'backendmodelid', 'apimodel', 'baseurl', 'apibaseurl', 'sdk', 'adapter',
  'providercostusd', 'measuredprovidercostusd', 'pricingmetadata', 'pricingsource',
  'costmetadata', 'selectedmodelcostmetadata', 'internalcostmetadata', 'vendorcost',
  'margincredits', 'marginratio', 'routingmetadata', 'routingpolicy', 'fallbackpolicy',
  'selectionstrategy', 'fallbackstrategy', 'executionmetadata', 'executionlineage',
  'runtimecapacity', 'runtimecapacityroute', 'runtimerequirement', 'taskqueue', 'queue',
  'temporal', 'temporaluiurl', 'workerid', 'podid', 'podname', 'namespace',
  'traceback', 'stacktrace', 'stack', 'cause', 'upstreammessage', 'upstreambody',
  'apikey', 'apisecret', 'accesstoken', 'refreshtoken', 'bearertoken', 'token',
  'secret', 'credentials', 'credential', 'credentialref', 'keyref', 'accountref',
  'providerjobid', 'providerresponse', 'rawproviderresponse', 'proxyurl', 'sessid', 'observedip',
])
const SCHEMA_LITERAL_KEYS = new Set(['default', 'const', 'enum', 'allowedvalues', 'values', 'examples'])
const PROVIDER_LABEL_KEYS = new Set(['provider', 'providername'])

export function isPrivatePublicMetadataKey(key: string): boolean {
  const normalized = normalizeMetadataKey(key)
  return PRIVATE_METADATA_KEYS.has(normalized)
    || /^(?:provider(?:account|credential|key|token|secret|endpoint|url|response|job)|supplier|servingprovider|hostingprovider|executionprovider|endpoint|runtimeendpoint|vendor|upstream|runtimeadapter|executionbackend|deployment|routing)/.test(normalized)
    || /(?:apikey|apisecret|credential)/.test(normalized)
}

// The browser also reads older caches and SSE payloads. Keep structured execution
// metadata out while preserving user text, request IDs, URLs and schema literals.
export function sanitizePublicMetadata(value: unknown, schema = false): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizePublicMetadata(item, schema))
  if (!isMetadataRecord(value)) return value
  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeMetadataKey(key)
    if (schema && SCHEMA_LITERAL_KEYS.has(normalized)) {
      result[key] = child
      continue
    }
    if (schema && (key === '$defs' || key === 'definitions') && isMetadataRecord(child)) {
      result[key] = Object.fromEntries(Object.entries(child).map(([name, definition]) => [name, sanitizePublicMetadata(definition, true)]))
      continue
    }
    if (isPrivatePublicMetadataKey(key)) continue
    if (PROVIDER_LABEL_KEYS.has(normalized)) {
      if (!schema) result[key] = 'Youtorch'
      continue
    }
    if (normalized === 'providerrequirement') {
      result[key] = publicProviderRequirement(child)
      continue
    }
    if (schema && normalized === 'required' && Array.isArray(child)) {
      result[key] = child.filter((field) => typeof field !== 'string' || (!isPrivatePublicMetadataKey(field) && !PROVIDER_LABEL_KEYS.has(normalizeMetadataKey(field))))
      continue
    }
    const requestedModelId = !schema && normalized === 'modelid'
      ? publicRequestedModelId(value)
      : null
    result[key] = typeof requestedModelId === 'string' && requestedModelId.trim()
      ? requestedModelId
      : sanitizePublicMetadata(child, schema || normalized === 'inputschema' || normalized === 'outputschema')
  }
  return result
}

export function publicRequestedModelId(value: Record<string, unknown>): string | null {
  for (const key of ['requested_model_id', 'requestedModelId', 'selected_model_id', 'selectedModelId']) {
    const id = value[key]
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

export function publicMetadataRecord(value: unknown): Record<string, unknown> {
  const sanitized = sanitizePublicMetadata(value)
  return isMetadataRecord(sanitized) ? sanitized : {}
}

export function publicInputSchema(value: unknown): Record<string, unknown> {
  const sanitized = sanitizePublicMetadata(value, true)
  return isMetadataRecord(sanitized) ? sanitized : {}
}

export function publicProviderRequirement(value: unknown): Record<string, unknown> {
  return Object.fromEntries(Object.entries(pickPublicMetadata(value, ['capability', 'selected_model_id', 'selected_model_capability']))
    .filter(([, child]) => typeof child === 'string'))
}

export function publicModelVisibility(value: unknown): Record<string, unknown> {
  const visibility = pickPublicMetadata(value, [
    'default', 'tools_default', 'composer_default', 'assistant_default', 'public',
    'discovery_badge', 'discovery_sort_order', 'discovery_spotlight', 'discovery_latest', 'latest',
  ])
  return Object.fromEntries(Object.entries(visibility).flatMap<[string, unknown]>(([key, child]) => {
    if (key === 'discovery_badge') return typeof child === 'string' && ['New', 'Latest', 'Popular', 'Featured', 'Recommended', 'Beta', 'Preview', 'Coming soon'].includes(child) ? [[key, child]] : []
    if (key === 'discovery_sort_order') return typeof child === 'number' && Number.isFinite(child) ? [[key, child]] : []
    return typeof child === 'boolean' ? [[key, child]] : []
  }))
}

const PUBLIC_CREDIT_RULE_NUMBERS = new Set([
  'version', 'base_credits', 'minimum_credits', 'min_credits', 'default_credits',
  'input_image_credit', 'per_image_credits', 'unit_credits', 'credits_per_image',
  'credits_per_minute', 'credits_per_second', 'credits_per_character',
  'credits', 'price_credits', 'flat_credits', 'minimum_minutes', 'default_duration_minutes', 'default_image_count',
])
const PUBLIC_CREDIT_ITEM_NUMBERS = new Set([
  'units', 'unit_size', 'per_units', 'min_units', 'minimum_units', 'round_up_to',
  'credits_per_unit', 'credits', 'amount', 'factor', 'multiplier', 'minimum_credits',
])
const PUBLIC_PRICING_MODES = ['line_items', 'metered', 'generic', 'duration_minutes', 'image_option_matrix', 'input_based', 'fixed', 'flat', 'legacy_image', 'per_unit']
const PUBLIC_PRICING_OPERATIONS = ['add', 'add_once', 'add_per_run', 'add_per_unit', 'add_metered', 'multiply', 'multiplier', 'multiply_total', 'set_minimum', 'minimum', 'set_total', 'override_total']
const PUBLIC_PRICING_FIELDS = new Set([
  'duration_seconds', 'input_tokens', 'output_tokens', 'image_count', 'video_count', 'audio_count',
  'media_ref_count', 'vertex_count', 'frame_count', 'step_count', 'compute_seconds', 'requests', 'byte_size', 'units_used', 'text_to_3d_units',
  'billable_characters', 'clone_jobs', 'task', 'variant', 'variant_id', 'tier', 'resolution', 'quality', 'size', 'output_format', 'count',
])

export function publicModelPricingRule(value: unknown): Record<string, unknown> {
  if (!isMetadataRecord(value)) return {}
  const rule = pickPublicNumbers(value, PUBLIC_CREDIT_RULE_NUMBERS)
  const mode = publicVocabulary(value['mode'], PUBLIC_PRICING_MODES)
  if (mode) rule['mode'] = mode
  const unit = publicVocabulary(value['unit'], ['image', 'second', 'minute', 'character', 'job', 'request', 'token', 'credit'])
  if (unit) rule['unit'] = unit
  const rounding = publicVocabulary(value['rounding'], ['ceil', 'floor', 'round', 'none'])
  if (rounding) rule['rounding'] = rounding
  for (const key of ['line_items', 'adjustments']) {
    if (Array.isArray(value[key])) rule[key] = value[key].map(publicCreditItem).filter((item) => item !== null)
  }
  for (const key of ['matrix', 'option_adjustments']) {
    if (isMetadataRecord(value[key])) rule[key] = publicNumericTree(value[key], key === 'matrix' ? 'matrix' : 'options')
  }
  return rule
}

function publicCreditItem(value: unknown): Record<string, unknown> | null {
  if (!isMetadataRecord(value)) return null
  const result = pickPublicNumbers(value, PUBLIC_CREDIT_ITEM_NUMBERS)
  for (const key of ['meter', 'field', 'path']) {
    const child = value[key]
    if (child === undefined) continue
    if (typeof child !== 'string' || !/^(?:input|selection|output|usage|params)\.[a-z_]+$/.test(child)
      || !PUBLIC_PRICING_FIELDS.has(child.split('.')[1] ?? '')) return null
    result[key] = child
  }
  for (const key of ['operation', 'type']) {
    if (value[key] === undefined) continue
    const operation = publicVocabulary(value[key], PUBLIC_PRICING_OPERATIONS)
    if (!operation) return null
    result[key] = operation
  }
  if (typeof value['optional'] === 'boolean') result['optional'] = value['optional']
  // These are literal values of public selection conditions, not display metadata.
  for (const key of ['equals', 'value', 'in', 'one_of']) {
    if (value[key] === undefined) continue
    if (!result['field'] && !result['path']) return null
    const child = value[key]
    const values = Array.isArray(child) ? child : [child]
    if (!values.every((item) => typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))
      || (typeof item === 'string' && /^[a-z0-9_.:-]+$/i.test(item) && Boolean(publicCatalogText(item))))) return null
    result[key] = child
  }
  return Object.keys(result).length ? result : null
}

function pickPublicNumbers(value: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key, child]) => keys.has(key)
    && typeof child === 'number' && Number.isFinite(child) && child >= 0))
}

function publicVocabulary(value: unknown, values: string[]): string | null {
  return typeof value === 'string' ? values.find((item) => item.toLowerCase() === value.trim().toLowerCase()) ?? null : null
}

function publicNumericTree(value: Record<string, unknown>, kind: 'matrix' | 'options' | 'values'): Record<string, unknown> {
  const publicValues = new Set(['default', 'auto', 'low', 'medium', 'high', 'standard', 'draft', '1k', '2k', '4k', '8k', 'image_to_image', 'text_to_image', 'first_last_frame'])
  return Object.fromEntries(Object.entries(value)
    .filter(([key, child]) => {
      const publicKey = kind === 'matrix' ? /^(?:\d+x\d+|default|auto)$/.test(key)
        : kind === 'options' ? PUBLIC_PRICING_FIELDS.has(key) : publicValues.has(key)
      return publicKey && ((typeof child === 'number' && Number.isFinite(child) && child >= 0) || isMetadataRecord(child))
    })
    .map(([key, child]) => [key, isMetadataRecord(child) ? publicNumericTree(child, 'values') : child]))
}

function pickPublicMetadata(value: unknown, keys: string[]): Record<string, unknown> {
  if (!isMetadataRecord(value)) return {}
  return Object.fromEntries(keys.filter((key) => Object.prototype.hasOwnProperty.call(value, key)).map((key) => [key, value[key]]))
}

function normalizeMetadataKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function isMetadataRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isPricingMissingLabel(value: unknown): boolean {
  return typeof value === 'string' && /^pricing missing [\u2014-] model not runnable$/i.test(value.trim())
}
