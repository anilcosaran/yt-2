const PUBLIC_ERROR_CODE_PATTERN = /\bE\d{4}\b/
// Retired tool-specific codes provide no reliable failure diagnosis.
const RETIRED_NODE_ERROR_CODES = new Set(['E3140', 'E3141', 'E3142', 'E3143', 'E3144', 'E3145', 'E3146', 'E3147', 'E3148', 'E3149', 'E3152', 'E3153'])
const MEDIA_RETRIEVAL_PUBLIC_ERROR_CODE = 'E3151'
const WORKFLOW_VIDEO_DURATION_LIMIT_PUBLIC_ERROR_CODE = 'E3160'
const WORKFLOW_STORAGE_DURATION_METADATA_PUBLIC_ERROR_CODE = 'E3161'
const WORKFLOW_CONCURRENCY_PUBLIC_ERROR_CODE = 'E3162'

export type PublicRuntimeError = {
  code: string
  message: string
}

export function toPublicRuntimeError(value: unknown): PublicRuntimeError | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const code = publicRuntimeErrorCodeForMessage(value)
  return { code, message: publicRuntimeErrorMessage(code) }
}

export function publicRuntimeErrorMessageForError(error: unknown, fallback: string): string {
  const rawMessage = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''
  return toPublicRuntimeError(rawMessage)?.message ?? fallback
}

export const publicRuntimeErrorKeys = {
  E3100: 'generic',
  E3101: 'serviceUnavailable',
  // ERR-03: E3102 also covers an ambiguous provider outcome the reconciler settles.
  E3102: 'resultReconciling',
  E3103: 'estimateUnavailable',
  E3104: 'inputInvalid',
  E3105: 'mediaUnreadable',
  E3106: 'providerRejected',
  E3107: 'providerEmptyOutput',
  E3108: 'outputDeliveryPending',
  E3120: 'audioRequired',
  E3138: 'moderated',
  E3150: 'queueBusy',
  E3151: 'downloadFailed',
  E3154: 'mediaSourceUrlInvalid',
  E3155: 'mediaSourceNotFound',
  E3156: 'mediaSourceUnavailable',
  E3160: 'durationLimit',
  E3161: 'durationMetadata',
  E3162: 'concurrencyLimit',
  E3949: 'capacity',
} as const

const PUBLIC_RUNTIME_ERROR_COPY: Record<string, string> = {
  E3100: "This request could not be completed. Try again. If it keeps failing, contact support with this code.",
  E3101: "This service is temporarily unavailable. Try another model or try again later.",
  E3102: "The result and credits of this request are being reconciled automatically. You will not be charged twice.",
  E3103: "The cost could not be calculated. Try another model or try again later.",
  E3104: "Check the required inputs and try again.",
  E3105: "This media file could not be read. Check that it plays correctly, or try a different file.",
  E3106: "The service rejected this request. Check the inputs and settings, then try again.",
  E3107: "The service returned an empty or incomplete result. Try again or choose another model.",
  E3108: "The result was created and is still being delivered. It appears automatically when delivery completes.",
  E3120: "Selected media has no audio track. Choose a file with audio.",
  E3138: "This content could not be processed under the safety policy. Revise the prompt or source media.",
  E3150: "This request could not be started because the service is busy. Try again shortly.",
  E3151: "The source media could not be retrieved. Check the source and try again.",
  E3154: "This video link is invalid or incomplete. Check the URL and try again.",
  E3155: "This video could not be found or has been removed. Check the URL or try a different video.",
  E3156: "This video is unavailable or access is restricted. Check that the link opens and the video is public.",
  E3160: "Selected video exceeds the duration allowed by your plan. Choose a shorter video or review your plan limits.",
  E3161: "We could not read this video's duration metadata. Reprocess or re-upload the video, then try again.",
  E3162: "Your concurrent workflow limit has been reached. Wait for a running workflow to finish, then try again.",
  E3949: "This service is at capacity. Try again shortly.",
}

export function publicRuntimeErrorMessage(code: string) {
  const normalized = normalizePublicRuntimeErrorCode(code)
  return `${PUBLIC_RUNTIME_ERROR_COPY[normalized] ?? PUBLIC_RUNTIME_ERROR_COPY.E3100} Error code: ${normalized}`
}

export function publicRuntimeErrorCodeForMessage(message: string) {
  const explicitCode = message.match(PUBLIC_ERROR_CODE_PATTERN)?.[0]
  if (explicitCode) return normalizePublicRuntimeErrorCode(explicitCode)

  const normalized = message.toLowerCase()
  if (
    normalized.includes('workflow_queue_depth_exceeded')
    || normalized.includes('pending workflow queue is full')
  ) return 'E3150'
  if (normalized.includes('cost_estimate_unavailable') || normalized.includes('missing pricing_rule')) return 'E3103'
  if (normalized.includes('input_invalid') || normalized.includes('nodeinputvalidationerror')) return 'E3104'
  if (
    normalized.includes('workflow concurrency')
    || normalized.includes('concurrent workflow')
    || normalized.includes('concurrency limit exceeded')
    || normalized.includes('workflow_concurrency_exceeded')
    || normalized.includes('rejected_concurrency')
    || normalized.includes('workflows running')
  ) {
    return WORKFLOW_CONCURRENCY_PUBLIC_ERROR_CODE
  }
  if (
    normalized.includes('media download failed')
    || normalized.includes('media download timed out')
    || normalized.includes('metadata resolve failed')
    || normalized.includes('metadata resolve timed out')
    || normalized.includes('no downloadable media items were resolved')
    || normalized.includes('social media downloads require a healthy proxy')
    || normalized.includes('media downloader proxy')
    || normalized.includes('no healthy proxy remained')
    || normalized.includes('timed out waiting for an available healthy proxy')
    || normalized.includes('dataimpulse')
    || normalized.includes('threads_exhausted')
    || normalized.includes('traffic_exhausted')
    || normalized.includes('proxy acquisition')
    || normalized.includes('gw.dataimpulse.com')
    || normalized.includes('observed_ip')
    || normalized.includes('sessid')
    || normalized.includes('vendor_cost')
  ) {
    return MEDIA_RETRIEVAL_PUBLIC_ERROR_CODE
  }
  if (
    normalized.includes('workflow_storage_duration_metadata_unavailable')
    || normalized.includes('storage duration metadata unavailable')
    || normalized.includes('source duration metadata is required')
  ) {
    return WORKFLOW_STORAGE_DURATION_METADATA_PUBLIC_ERROR_CODE
  }
  if (
    normalized.includes('max_video_duration_seconds')
    || normalized.includes('max_transcript_duration_minutes')
    || normalized.includes('max_viral_clips_source_duration_minutes')
    || normalized.includes('max_magic_clips_source_duration_minutes')
    || normalized.includes('max_caption_duration_minutes')
    || normalized.includes('video duration limit')
    || normalized.includes('source duration limit')
  ) {
    return WORKFLOW_VIDEO_DURATION_LIMIT_PUBLIC_ERROR_CODE
  }
  if (
    normalized.includes('media_audio_track_missing')
    || normalized.includes('media has no audio track')
    || normalized.includes('no audio track')
    || normalized.includes('audio track required')
  ) {
    return 'E3120'
  }
  if (
    normalized.includes('request moderated')
    || normalized.includes('moderation')
    || normalized.includes('moderated')
    || normalized.includes('content policy')
    || normalized.includes('safety policy')
    || normalized.includes('safety system')
  ) {
    return 'E3138'
  }
  if (
    normalized.includes('provider_outcome_unknown')
    || normalized.includes('provider outcome requires reconciliation')
    || normalized.includes('reconciliation is required')
  ) {
    return 'E3102'
  }
  if (
    normalized.includes('invalid data found when processing input')
    || normalized.includes('moov atom not found')
    || normalized.includes('could not find codec parameters')
    || normalized.includes('error while decoding')
  ) {
    return 'E3105'
  }
  if (
    normalized.includes('no choices')
    || normalized.includes('empty response')
    || normalized.includes('empty output')
    || normalized.includes('empty completion')
  ) {
    return 'E3107'
  }
  if (
    normalized.includes('provider_busy')
    || normalized.includes('provider capacity')
    || normalized.includes('provider key capacity')
    || normalized.includes('provider key exhausted')
    || normalized.includes('provider key pool exhausted')
    || normalized.includes('key pool exhausted')
    || normalized.includes('key retry exhausted')
    || normalized.includes('api keys exhausted')
    || normalized.includes('all api keys exhausted')
  ) {
    return 'E3949'
  }
  if (
    normalized.includes('provider_model_not_available')
    || normalized.includes('provider_model_resolution_failed')
    || normalized.includes('provider model is not available')
    || normalized.includes('provider model route is unavailable')
    || normalized.includes('api key')
    || normalized.includes('credential')
    || normalized.includes('rate limit')
    || normalized.includes('maintenance')
    || normalized.includes('disabled')
    || normalized.includes('key exhausted')
    || normalized.includes('service unavailable')
    || normalized.includes('timeout')
    || normalized.includes('timed out')
  ) {
    return 'E3101'
  }
  if (
    normalized.includes('billing release')
    || normalized.includes('funds locked')
    || normalized.includes('settlement')
  ) {
    return 'E3102'
  }
  return 'E3100'
}

function normalizePublicRuntimeErrorCode(code: string): string {
  const normalized = code.match(PUBLIC_ERROR_CODE_PATTERN)?.[0] ?? 'E3100'
  return RETIRED_NODE_ERROR_CODES.has(normalized) ? 'E3100' : normalized
}
