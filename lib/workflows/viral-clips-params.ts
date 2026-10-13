export const RETIRED_VIRAL_CLIPS_FIELDS = new Set(['context_montage', 'editing_style', 'transition'])

/** Used by hydrate, estimate, launch and relaunch; never touches stored DAGs. */
export function normalizeViralClipsParams(input: Record<string, unknown>): Record<string, unknown> {
  const result = { ...input }
  for (const field of RETIRED_VIRAL_CLIPS_FIELDS) delete result[field]
  const output = result.output as Record<string, unknown> | undefined
  if (result.censor !== 'profanity' || (output?.audio === 'mute' && result.captions_enabled !== true)) {
    result.censor = 'off'
    delete result.censor_audio_mode
    delete result.censor_sound
  } else {
    result.censor_audio_mode ??= 'mute'
    if (result.censor_audio_mode === 'beep') result.censor_sound ??= 'classic'
    else delete result.censor_sound
  }
  return result
}
