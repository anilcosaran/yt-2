export const VOICE_REFERENCE_RECORDER_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const

export function selectVoiceReferenceRecorderMimeType(
  isTypeSupported: ((mimeType: string) => boolean) | undefined,
): string | undefined {
  if (!isTypeSupported) return undefined
  return VOICE_REFERENCE_RECORDER_MIME_TYPES.find((mimeType) => {
    try {
      return isTypeSupported(mimeType)
    } catch {
      return false
    }
  })
}

export function voiceReferenceRecordingFileExtension(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized.startsWith('audio/mp4')) return 'm4a'
  if (normalized.startsWith('audio/ogg')) return 'ogg'
  if (normalized.startsWith('audio/webm')) return 'webm'
  if (normalized.startsWith('audio/wav')) return 'wav'
  return 'audio'
}
