export const CARTESIA_CLONE_LANGUAGES = [
  'en', 'fr', 'de', 'es', 'pt', 'zh', 'ja', 'hi', 'it', 'ko', 'nl', 'pl', 'ru', 'sv',
  'tr', 'tl', 'bg', 'ro', 'ar', 'cs', 'el', 'fi', 'hr', 'ms', 'sk', 'da', 'ta', 'uk',
  'hu', 'no', 'vi', 'bn', 'th', 'he', 'ka', 'id', 'te', 'gu', 'kn', 'ml', 'mr', 'pa',
] as const

export function voiceCloneLanguagesForModel(_modelId: string): string[] {
  return [...CARTESIA_CLONE_LANGUAGES]
}