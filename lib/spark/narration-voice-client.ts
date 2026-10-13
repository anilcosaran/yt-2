import { z } from 'zod'

import { AuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * E1-K client of the scene voice change (`/api/v1/composition-narration`): what each scene's narration is and which voice
 * made it, the price of speaking scenes with another voice, starting it and the progress of a run. The text is the
 * scene's own script (never edited here); the speech is the paid `speech_generate@1` job the gateway launches through
 * Workflow after the user confirmed the price; the finished audio replaces the scene's narration on the server in one
 * undoable command, so the editor only re-reads the working copy (`refresh`) when a scene was applied.
 */

export const MAX_VOICE_SCENES_PER_REQUEST = 32
/** What one speech request can hold (the gateway refuses a longer scene text: `text_too_long`). */
export const MAX_VOICE_TEXT_CHARACTERS = 5000

const sceneStateSchema = z.enum([
  'quote',
  'up_to_date',
  'processing',
  'no_script',
  'script_unavailable',
  'text_too_long',
  'voice_unavailable',
  'scene_not_found',
])
export type NarrationVoiceSceneState = z.infer<typeof sceneStateSchema>

const sceneVoiceSchema = z.object({
  scene_id: z.string(),
  script: z.object({
    state: z.enum(['ready', 'too_long', 'none', 'unavailable']),
    language: z.string().nullable(),
    characters: z.number().nullable(),
  }),
  narration: z
    .object({
      placement_id: z.string(),
      source_mode: z.enum(['generated_speech', 'supplied_audio', 'unknown']),
      duration_seconds: z.number().nullable(),
    })
    .nullable(),
  voice: z.object({ voice_profile_id: z.string(), display_name: z.string(), language: z.string() }).nullable(),
  job: z.object({ production_run_id: z.string(), operation_id: z.string() }).nullable(),
})
export type SceneVoice = z.infer<typeof sceneVoiceSchema>

const stateSchema = z.object({
  data: z.object({
    schema: z.literal('composition_narration_voice_v1'),
    enabled: z.boolean(),
    model_id: z.string().nullable(),
    scenes: z.array(sceneVoiceSchema),
  }),
})
export type NarrationVoiceState = z.infer<typeof stateSchema>['data']

const quoteSchema = z.object({
  data: z.object({
    schema: z.literal('composition_narration_voice_quote_v1'),
    voice: z.object({ voice_profile_id: z.string(), display_name: z.string().nullable() }),
    model_id: z.string(),
    scenes: z.array(
      z.object({
        scene_id: z.string(),
        state: sceneStateSchema,
        characters: z.number().nullable(),
        estimated_credits: z.number(),
      }),
    ),
    billable_scenes: z.number().int(),
    total_credits: z.number(),
  }),
})
export type NarrationVoiceQuote = z.infer<typeof quoteSchema>['data']

const requestSchema = z.object({
  data: z.object({
    schema: z.literal('composition_narration_voice_request_v1'),
    production_run_id: z.string().nullable(),
    scenes: z.array(
      z.object({
        scene_id: z.string(),
        state: z.union([sceneStateSchema, z.literal('started'), z.literal('not_started')]),
        operation_id: z.string().nullable(),
        agent_id: z.string().nullable(),
        estimated_credits: z.number(),
        reason_code: z.string().optional(),
      }),
    ),
    started: z.number().int(),
    total_credits: z.number(),
  }),
})
export type NarrationVoiceRequestResult = z.infer<typeof requestSchema>['data']

const runStateSchema = z.enum(['generating', 'applying', 'applied', 'failed', 'needs_attention', 'superseded'])
export type NarrationVoiceRunSceneState = z.infer<typeof runStateSchema>

const runSchema = z.object({
  data: z.object({
    schema: z.literal('composition_narration_voice_run_v1'),
    production_run_id: z.string(),
    state: z.enum(['running', 'done']),
    scenes: z.array(
      z.object({
        scene_id: z.string(),
        operation_id: z.string(),
        voice: z.object({ voice_profile_id: z.string(), display_name: z.string() }),
        state: runStateSchema,
        reason: z.string().nullable(),
        scene_extended: z.boolean().nullable(),
      }),
    ),
  }),
})
export type NarrationVoiceRun = z.infer<typeof runSchema>['data']

const base = (projectId: string) => `/api/v1/composition-narration/projects/${encodeURIComponent(projectId)}/voice`

type Options = { signal?: AbortSignal }

export async function getNarrationVoice(projectId: string, options: Options = {}): Promise<NarrationVoiceState> {
  return (await gatewayRequest(base(projectId), { schema: stateSchema, signal: options.signal })).data
}

export async function quoteNarrationVoice(
  projectId: string,
  input: { sceneIds: readonly string[]; voiceProfileId: string },
  options: Options = {},
): Promise<NarrationVoiceQuote> {
  const response = await gatewayRequest(`${base(projectId)}/quote`, {
    method: 'POST',
    csrf: true,
    signal: options.signal,
    body: { scene_ids: [...input.sceneIds], voice_profile_id: input.voiceProfileId },
    schema: quoteSchema,
  })
  return response.data
}

export async function requestNarrationVoice(
  projectId: string,
  input: { sceneIds: readonly string[]; voiceProfileId: string; expectedCredits: number; idempotencyKey: string },
  options: Options = {},
): Promise<NarrationVoiceRequestResult> {
  const response = await gatewayRequest(`${base(projectId)}/requests`, {
    method: 'POST',
    csrf: true,
    signal: options.signal,
    body: {
      scene_ids: [...input.sceneIds],
      voice_profile_id: input.voiceProfileId,
      expected_credits: input.expectedCredits,
      idempotency_key: input.idempotencyKey,
    },
    schema: requestSchema,
  })
  return response.data
}

export async function getNarrationVoiceRun(projectId: string, productionRunId: string, options: Options = {}): Promise<NarrationVoiceRun> {
  return (await gatewayRequest(`${base(projectId)}/runs/${encodeURIComponent(productionRunId)}`, { schema: runSchema, signal: options.signal })).data
}

/** What the editor tells the user when a voice call fails; every kind has its own sentence (no silent fallback). */
export type NarrationVoiceFailure =
  | 'unavailable'
  | 'quote_changed'
  | 'insufficient_balance'
  | 'too_many_scenes'
  | 'model_unavailable'
  | 'forbidden'
  | 'not_found'
  | 'offline'
  | 'unknown'

export function classifyNarrationVoiceError(error: unknown): NarrationVoiceFailure {
  if (!(error instanceof AuthClientError)) return 'unknown'
  switch (error.code) {
    case 'COMPOSITION_NARRATION_VOICE_UNAVAILABLE':
      return 'unavailable'
    case 'COMPOSITION_NARRATION_VOICE_MODEL_UNAVAILABLE':
      return 'model_unavailable'
    case 'COMPOSITION_NARRATION_VOICE_QUOTE_CHANGED':
    // The project moved between the price and the confirmation (a concurrent write): the price is read again, never started on a stale read.
    case 'COMPOSITION_PRODUCTION_CONFLICT':
      return 'quote_changed'
    case 'COMPOSITION_NARRATION_VOICE_TOO_MANY_SCENES':
      return 'too_many_scenes'
    case 'INSUFFICIENT_BALANCE':
      return 'insufficient_balance'
    case 'GATEWAY_NETWORK_ERROR':
    case 'GATEWAY_REQUEST_TIMEOUT':
      return 'offline'
    default:
      break
  }
  if (error.status === 402) return 'insufficient_balance'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'not_found'
  return 'unknown'
}
