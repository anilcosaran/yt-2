// Builds mock/data/tools-catalog.json: the /api/v1/discovery/tools-catalog response of Youtorch, produced by the
// gateway's own GetDiscoveryToolsCatalogUseCase (imported read-only) from the real node contracts
// (contracts/node-contracts/*.lock.json). Only the model list is hand-curated (see MODELS).
//
//   YOUTORCH_REPO=C:/Users/Anil/Desktop/Youtorch node mock/generators/generate-tools-catalog.cjs
//
// Nothing is written to the Youtorch repo.

const fs = require('node:fs')
const path = require('node:path')

const REPO = (process.env.YOUTORCH_REPO || 'C:/Users/Anil/Desktop/Youtorch').replace(/\\/g, '/')
const OUT = path.join(__dirname, '..', 'data', 'tools-catalog.json')
const { createJiti } = require(path.join(__dirname, '..', '..', 'node_modules', 'jiti'))
const jiti = createJiti(__filename, { fsCache: false, moduleCache: false })

// node type -> provider capability (absent = the node needs no model) and curated description
const NODES = {
  'image_generate@1': ['image.generate', 'Generate or edit images from a prompt and optional reference images.'],
  'video_generate@1': ['video.generate', 'Generate videos from text, images or a first and last frame.'],
  'media_transform@1': [null, 'Trim, crop, resize, reframe and convert video and audio files.'],
  'video_to_gif@1': [null, 'Turn a video segment into a looping GIF.'],
  'frame_extract@1': [null, 'Extract still frames from a video at chosen times or intervals.'],
  'viral_clips@1': [null, 'Find the strongest moments in a long video and cut them into short clips.'],
  'caption@1': [null, 'Add styled, animated captions to a video.'],
  'media_downloader@1': [null, 'Download a video or audio file from a link into your storage.'],
  'transcript@1': ['audio.transcribe', 'Transcribe speech from video or audio into text with timestamps.'],
  'speech_generate@1': ['audio.generate.speech', 'Turn text into natural speech with a chosen voice.'],
  'voice_clone@1': ['voice.clone.instant', 'Clone a voice from a short reference recording.'],
  'angle@1': ['image.angle.generate', 'Re-render a subject from a new camera angle.'],
  'background_remove@1': [null, 'Remove the background from an image or video.'],
}

const INTERNAL_FIELDS = /^(cdn_url|delay_seconds)$|(^|_)(provider|internal|secret|credential|api_key|backend|debug|smoke|test)(_|$)/

const field = (name, type, extra = {}) => ({
  allowed_values: null, default: null, form_role: null, max_duration: null, max_size_mb: null,
  max_value: null, mime_types: null, min_value: null, name, required: false, type, ...extra,
})

const MODELS = {
  'image.generate': [
    ['image-pro', 'Image Pro', 'High', 'Standard', 8.5],
    ['image-fast', 'Image Fast', 'Standard', 'Fast', 3],
    ['image-studio', 'Image Studio', 'High', 'Standard', 12],
  ],
  'video.generate': [
    ['video-pro', 'Video Pro', 'High', 'Standard', 42],
    ['video-fast', 'Video Fast', 'Standard', 'Fast', 18],
    ['video-cinema', 'Video Cinema', 'Premium', 'Slow', 85],
  ],
  'audio.transcribe': [
    ['transcribe-accurate', 'Transcribe Accurate', 'High', 'Standard', 2],
    ['transcribe-fast', 'Transcribe Fast', 'Standard', 'Fast', 1],
  ],
  'audio.generate.speech': [
    ['speech-natural', 'Speech Natural', 'High', 'Standard', 4],
    ['speech-expressive', 'Speech Expressive', 'Premium', 'Standard', 7],
  ],
  'voice.clone.instant': [['voice-clone-instant', 'Voice Clone Instant', 'High', 'Fast', 10]],
  'image.angle.generate': [['angle-pro', 'Angle Pro', 'High', 'Standard', 6]],
}

const MODEL_INPUTS = {
  'video.generate': {
    resolution: field('resolution', 'string', { allowed_values: ['720p', '1080p'], default: '1080p', form_role: 'resolution' }),
    duration_seconds: field('duration_seconds', 'integer', { allowed_values: [5, 8, 10], default: 5, form_role: 'duration' }),
    aspect_ratio: field('aspect_ratio', 'string', { allowed_values: ['16:9', '9:16', '1:1'], default: '16:9', form_role: 'ratio' }),
    generate_audio: field('generate_audio', 'boolean', { default: false, form_role: 'audio' }),
  },
  'image.generate': {
    aspect_ratio: field('aspect_ratio', 'string', { allowed_values: ['1:1', '16:9', '9:16', '4:3', '3:4'], default: '1:1', form_role: 'ratio' }),
    resolution: field('resolution', 'string', { allowed_values: ['1K', '2K'], default: '1K', form_role: 'resolution' }),
  },
  'voice.clone.instant': {
    language: field('language', 'string', { allowed_values: ['en', 'tr', 'de', 'es', 'fr', 'it', 'pt', 'ar'], default: 'en', required: true }),
  },
  'audio.generate.speech': {
    language: field('language', 'string', { allowed_values: ['en', 'tr', 'de', 'es', 'fr', 'it', 'pt', 'ar'], default: 'en', required: true }),
    speed: field('speed', 'float', { default: 1, min_value: 0.5, max_value: 2 }),
    emotion: field('emotion', 'string', { allowed_values: ['neutral', 'happy', 'serious', 'excited'], default: 'neutral' }),
  },
}

function lockInputs(nodeType) {
  const lock = JSON.parse(fs.readFileSync(`${REPO}/contracts/node-contracts/${nodeType.replace('@', '@')}.lock.json`, 'utf8'))
  const revision = lock.impl_revisions.find((r) => r.impl_revision === lock.default_stable_revision) ?? lock.impl_revisions.at(-1)
  const clean = (ports) => Object.fromEntries(Object.entries(ports ?? {}).filter(([name]) => !INTERNAL_FIELDS.test(name)))
  return { inputs: clean(revision.contract_schema.inputs), outputs: revision.contract_schema.outputs ?? {}, hash: revision.schema_hash }
}

function modelRefs(capability) {
  return (MODELS[capability] ?? []).map(([id, label, quality, speed, credits], index) => ({
    id,
    label,
    provider_slug: 'youtorch',
    capability,
    model_type: 'concrete',
    description: `${label} for ${capability.split('.').slice(0, 2).join(' ')}.`,
    quality,
    speed,
    cost_label: `${credits} credits`,
    estimated_credits: credits,
    input_schema: MODEL_INPUTS[capability] ?? {},
    form_contract: { standard_fields: {} },
    pricing_rule: {},
    visibility: { tools_default: index === 0, public: true },
    cost_metadata: {},
  }))
}

async function main() {
  const { GetDiscoveryToolsCatalogUseCase } = await jiti.import(
    `${REPO}/api-gateway/src/discovery/application/use-cases/get-discovery-tools-catalog.use-case.ts`,
  )

  const nodes = Object.entries(NODES).map(([nodeType, [capability, description]]) => {
    const { inputs, outputs, hash } = lockInputs(nodeType)
    return {
      node_type: nodeType,
      description,
      input_schema: inputs,
      input_classification: {},
      form_contract: { standard_fields: {} },
      output_schema: outputs,
      schema_hash: hash ?? '',
      capability: capability ?? '',
      cost_estimate: {},
      pricing_metadata: {},
      provider_requirement: capability
        ? { required: true, capability, model_source: 'provider_model_registry' }
        : { required: false },
      artifact_output_type: '',
      disabled: false,
      maintenance: false,
      ui_visibility: 'standalone_tool',
      status: 'active',
    }
  })

  const all = Object.keys(MODELS).flatMap((capability) => modelRefs(capability))
  const byKind = (prefixes) => all.filter((m) => prefixes.some((p) => m.capability === p || m.capability.startsWith(`${p}.`)))
  const useCase = new GetDiscoveryToolsCatalogUseCase(
    { listPublicNodes: async () => ({ nodes, total: nodes.length }) },
    {
      listCapabilityModels: async () => ({
        image_models: byKind(['image.generate', 'image.angle.generate']),
        video_models: byKind(['video.generate', 'video.avatar.generate']),
        audio_models: byKind(['audio.transcribe', 'audio.generate.speech', 'voice.clone.instant']),
        cache_scope: 'public',
      }),
    },
  )
  const result = await useCase.execute({ tenantId: 'tenant_yt2_demo' })
  if (!result.ok) throw result.error
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify({ data: result.value }, null, 1)}\n`)
  const tools = result.value.tools
  console.log(`wrote ${OUT}: ${tools.length} tools`)
  for (const tool of tools) {
    console.log(`  ${tool.tool_id.padEnd(16)} models=${tool.models.length} inputs=${Object.keys(tool.input_contract.input_schema).length}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
