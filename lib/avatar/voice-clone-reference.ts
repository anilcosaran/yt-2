import type { DiscoveryToolsCatalog } from '@/lib/discovery/api'

export const VOICE_CLONE_NODE_TYPE = 'voice_clone@1'

/**
 * Used until the discovery catalog loads (or when it has no voice clone tool): the public instant
 * clone model accepts a 5-10 s single-speaker reference.
 */
export const FALLBACK_VOICE_CLONE_REFERENCE_SCHEMA: Record<string, unknown> = {
  min_reference_audio_seconds: 5,
  max_reference_audio_seconds: 10,
  reference_content_types: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
}

type CatalogTool = DiscoveryToolsCatalog['tools'][number]
type CatalogModel = CatalogTool['models'][number]

function schemaHasReferenceWindow(schema: Record<string, unknown> | null | undefined) {
  return Boolean(schema && (
    'max_reference_audio_seconds' in schema
    || 'max_reference_duration_seconds' in schema
    || 'reference_audio_max_seconds' in schema
  ))
}

function defaultModel(tool: CatalogTool): CatalogModel | undefined {
  const byVisibility = tool.models.find((model) => (
    model.visibility.composer_default === true
    || model.visibility.assistant_default === true
    || model.visibility.default === true
  ))
  if (byVisibility) return byVisibility
  const defaultId = typeof tool.defaults.model_id === 'string' ? tool.defaults.model_id : ''
  return tool.models.find((model) => model.id === defaultId) ?? tool.models[0]
}

/**
 * The reference-audio window (min/max seconds, content types) of the default voice clone model, in
 * the same shape the Tools trim flow (`readVoiceReferenceTrimConstraints`) reads.
 */
export function resolveVoiceCloneReferenceSchema(
  catalog: DiscoveryToolsCatalog | null | undefined,
): Record<string, unknown> {
  const tool = catalog?.tools.find((item) => item.execution.node_type === VOICE_CLONE_NODE_TYPE)
  if (!tool) return FALLBACK_VOICE_CLONE_REFERENCE_SCHEMA
  const model = defaultModel(tool)
  const candidates = [
    model?.effective_input_contract?.input_schema,
    model?.input_schema,
    tool.input_contract.input_schema,
  ]
  return candidates.find(schemaHasReferenceWindow) ?? FALLBACK_VOICE_CLONE_REFERENCE_SCHEMA
}
