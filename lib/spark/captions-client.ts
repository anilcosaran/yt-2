import { z } from 'zod'

import { isAuthClientError } from '@/lib/auth/errors'
import { gatewayRequest } from '@/lib/gateway/client'

/**
 * E1-G client of "Turn on captions" (`/api/v1/composition-captions`): the captionable sources of a project with the state
 * of their transcripts and caption tracks, the price of transcribing one, starting it, the four platform looks and the
 * binding of an existing transcript. Server state only: the job, the transcript and the track are read back from the
 * gateway; nothing is kept in browser storage. The transcription is the paid `transcript@1` job: the price is shown
 * first (`quoteCaptions`), the launch re-checks it (`expectedCredits`), a source that already has a usable transcript is
 * bound at no charge.
 */

const kitRefSchema = z.object({
  ref_type: z.literal('brand_revision'),
  brand_asset_kind: z.enum(['kit', 'element', 'template', 'motion']),
  brand_asset_id: z.string(),
  brand_revision_id: z.string(),
  brand_revision_digest_sha256: z.string(),
})
export type CaptionKitRef = z.output<typeof kitRefSchema>

const sourceSchema = z.object({
  source_id: z.string(),
  kind: z.enum(['narration', 'voice_over', 'video']),
  scene_ids: z.array(z.string()),
  duration_seconds: z.number().nullable(),
  transcript: z.object({
    state: z.enum(['none', 'processing', 'ready', 'failed']),
    artifact_id: z.string().optional(),
    artifact_revision: z.number().int().optional(),
    language: z.string().optional(),
  }),
  track: z.object({ caption_track_id: z.string(), style_ref: kitRefSchema.nullable() }).nullable(),
})
export type CaptionSource = z.output<typeof sourceSchema>
export type CaptionSourceKind = CaptionSource['kind']

const sourcesSchema = z.object({
  schema: z.literal('composition_caption_sources_v1'),
  enabled: z.boolean(),
  language_support: z.object({ languages: z.array(z.string()), auto_detect: z.boolean() }),
  /** The document holds at most `max` caption tracks (`used` now). */
  track_limit: z.object({ max: z.number().int(), used: z.number().int() }),
  sources: z.array(sourceSchema),
})
export type CaptionSources = z.output<typeof sourcesSchema>

const quoteSchema = z.object({
  schema: z.literal('composition_caption_quote_v1'),
  source_id: z.string(),
  state: z.enum(['transcript_ready', 'processing', 'quote']),
  source_language: z.string(),
  estimated_credits: z.number(),
  transcript: z.object({ artifact_id: z.string(), artifact_revision: z.number().int(), language: z.string().nullable() }).nullable(),
})
export type CaptionQuote = z.output<typeof quoteSchema>

const requestSchema = z.object({
  schema: z.literal('composition_caption_request_v1'),
  source_id: z.string(),
  state: z.enum(['bound', 'processing']),
  caption_track_id: z.string().nullable(),
  action: z.enum(['added', 'rebound', 'unchanged']).nullable(),
  agent_id: z.string().nullable(),
  estimated_credits: z.number(),
})
export type CaptionRequestResult = z.output<typeof requestSchema>

const stylesSchema = z.object({
  schema: z.literal('composition_caption_styles_v1'),
  enabled: z.boolean(),
  styles: z.array(
    z.object({
      preset_id: z.enum(['classic', 'bold', 'karaoke', 'minimal']),
      name: z.string(),
      colors: z.object({ text: z.string(), highlight: z.string(), effect: z.string() }),
      kit_ref: kitRefSchema,
    }),
  ),
})
export type CaptionStyles = z.output<typeof stylesSchema>
export type CaptionStyle = CaptionStyles['styles'][number]

const bindSchema = z.object({
  caption_track_id: z.string(),
  action: z.enum(['added', 'rebound', 'unchanged']),
  language: z.string().nullable(),
})

const envelope = <S extends z.ZodTypeAny>(schema: S) => z.object({ data: schema })
const base = (projectId: string) => `/api/v1/composition-captions/projects/${encodeURIComponent(projectId)}`

type Options = { signal?: AbortSignal }

export async function listCaptionSources(projectId: string, options: Options = {}): Promise<CaptionSources> {
  const response = await gatewayRequest(`${base(projectId)}/sources`, { schema: envelope(sourcesSchema), signal: options.signal })
  return response.data
}

export async function listCaptionStyles(options: Options = {}): Promise<CaptionStyles> {
  const response = await gatewayRequest('/api/v1/composition-captions/styles', { schema: envelope(stylesSchema), signal: options.signal })
  return response.data
}

/** The price of transcribing the source (or: a usable transcript exists / a transcription already runs). Starts nothing. */
export async function quoteCaptions(
  projectId: string,
  input: { sourceId: string; sourceLanguage?: string },
  options: Options = {},
): Promise<CaptionQuote> {
  const response = await gatewayRequest(`${base(projectId)}/requests/quote`, {
    method: 'POST',
    csrf: true,
    body: { source_id: input.sourceId, ...(input.sourceLanguage && { source_language: input.sourceLanguage }) },
    schema: envelope(quoteSchema),
    signal: options.signal,
  })
  return response.data
}

/**
 * The user confirmed the price: binds a usable transcript at once (`bound`) or launches the transcription (`processing`);
 * the track appears when the job ends. The same idempotency key replays; a changed price answers `COMPOSITION_CAPTION_QUOTE_CHANGED`.
 */
export async function requestCaptions(
  projectId: string,
  input: { sourceId: string; sourceLanguage?: string; expectedCredits?: number; idempotencyKey: string },
  options: Options = {},
): Promise<CaptionRequestResult> {
  const response = await gatewayRequest(`${base(projectId)}/requests`, {
    method: 'POST',
    csrf: true,
    body: {
      source_id: input.sourceId,
      ...(input.sourceLanguage && { source_language: input.sourceLanguage }),
      ...(input.expectedCredits !== undefined && { expected_credits: input.expectedCredits }),
      idempotency_key: input.idempotencyKey,
    },
    schema: envelope(requestSchema),
    signal: options.signal,
  })
  return response.data
}

/** Binds a finished, word-timed transcript of the source to its caption track (idempotent; free). */
export async function bindCaptionTranscript(
  projectId: string,
  input: { sourceId: string; artifactId: string; artifactRevision: number; idempotencyKey: string },
  options: Options = {},
) {
  const response = await gatewayRequest(`${base(projectId)}/tracks`, {
    method: 'POST',
    csrf: true,
    body: {
      source_id: input.sourceId,
      transcript: { artifact_id: input.artifactId, artifact_revision: input.artifactRevision },
      idempotency_key: input.idempotencyKey,
    },
    schema: envelope(bindSchema),
    signal: options.signal,
  })
  return response.data
}

export type CaptionFailure =
  | 'quote_changed'
  | 'insufficient_balance'
  | 'unavailable'
  | 'language_unsupported'
  | 'not_captionable'
  | 'track_limit'
  | 'word_timing'
  | 'conflict'
  | 'forbidden'
  | 'unknown'

/** The user-facing cause of a failed caption call (the drawer maps it to a sentence). */
export function captionFailureOf(error: unknown): CaptionFailure {
  if (!isAuthClientError(error)) return 'unknown'
  switch (error.code) {
    case 'COMPOSITION_CAPTION_QUOTE_CHANGED':
      return 'quote_changed'
    case 'INSUFFICIENT_BALANCE':
      return 'insufficient_balance'
    case 'COMPOSITION_CAPTIONS_UNAVAILABLE':
      return 'unavailable'
    case 'COMPOSITION_CAPTION_LANGUAGE_UNSUPPORTED':
      return 'language_unsupported'
    case 'COMPOSITION_CAPTION_SOURCE_NOT_CAPTIONABLE':
      return 'not_captionable'
    case 'COMPOSITION_CAPTION_TRACK_LIMIT':
      return 'track_limit'
    case 'COMPOSITION_CAPTION_WORD_TIMING_UNAVAILABLE':
      return 'word_timing'
    default:
      break
  }
  if (error.status === 403) return 'forbidden'
  if (error.status === 409) return 'conflict'
  return 'unknown'
}

/** The new price a `quote_changed` refusal carries, when the gateway sent it. */
export function changedQuoteCredits(error: unknown): number | null {
  if (!isAuthClientError(error)) return null
  const details = error.details as { estimated_credits?: unknown } | undefined
  return typeof details?.estimated_credits === 'number' ? details.estimated_credits : null
}
