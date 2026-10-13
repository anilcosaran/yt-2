export const RECORDING_LANGUAGES = ['en', 'tr'] as const

export type RecordingLanguage = (typeof RECORDING_LANGUAGES)[number]

/** Mirrors the gateway's `RECORDING_CONSENT_SCRIPTS`; used only when a session carries no script. */
export const RECORDING_CONSENT_SCRIPTS: Record<RecordingLanguage, string> = {
  en: "I confirm that I am the person in this photo and voice recording, that I have the right to clone this likeness and voice, and that I consent to Youtorch creating a digital avatar from this photo and voice recording.",
  tr: "Bu fotoğraftaki ve ses kaydındaki kişinin ben olduğumu, bu görünüm ve sesi klonlama hakkına sahip olduğumu ve Youtorch'un bu fotoğraf ve ses kaydından dijital avatar oluşturmasına izin verdiğimi onaylıyorum.",
}

/**
 * Short texts read aloud for the voice sample. Each one has 18-22 words, roughly 8-10 seconds at
 * a natural pace (the capture window), and mixes statements, a question and varied sounds so the
 * sample covers a natural range of the speaker's voice.
 */
export const RECORDING_READING_TEXTS: Record<RecordingLanguage, readonly string[]> = {
  en: [
    'On Sunday mornings I walk along the river. The air is cool, the water is calm, and the birds are busy.',
    'My grandfather kept a small shop full of old clocks and faded maps. I still remember the quiet ticking inside.',
    'Have you ever cooked without a recipe? Last week I made pumpkin soup with ginger and chili, and it was surprisingly good.',
    'Traveling by train is my favorite way to see a new country. Villages, fields and mountains roll past the window.',
  ],
  tr: [
    'Pazar sabahları şehir uyanmadan önce nehir kenarında yürürüm. Hava serin, su sakin olur ve birkaç kuş çoktan işe koyulmuştur.',
    'Dedemin eski saatler ve solmuş haritalarla dolu küçük bir dükkânı vardı. O sessiz tıkırtıyı ve sedir kokusunu hâlâ hatırlıyorum.',
    'Hiç tarifsiz yeni bir yemek denediniz mi? Geçen hafta balkabağı ve zencefille bir çorba yaptım, şaşırtıcı derecede güzeldi.',
    'Yeni bir ülkeyi görmenin en sevdiğim yolu trenle yolculuktur. Pencereden köyler, tarlalar ve dağlar birer birer akıp gider.',
  ],
}

/** `tr`/`tr-TR`/`TR` map to Turkish; everything else (including empty values) maps to English. */
export function normalizeRecordingLanguage(language?: string | null): RecordingLanguage {
  return (language ?? '').trim().toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

/**
 * Picks the reading language from the device/browser language list (usually
 * `navigator.language` followed by `navigator.languages`). The first non-empty entry wins.
 */
export function detectRecordingLanguage(
  languages?: string | ReadonlyArray<string | null | undefined> | null,
): RecordingLanguage {
  const list = typeof languages === 'string' ? [languages] : (languages ?? [])
  const first = list.find((value) => typeof value === 'string' && value.trim().length > 0)
  return normalizeRecordingLanguage(first)
}

export function deviceRecordingLanguage(): RecordingLanguage {
  if (typeof navigator === 'undefined') return 'en'
  return detectRecordingLanguage([navigator.language, ...(navigator.languages ?? [])])
}

export function toggleRecordingLanguage(language: RecordingLanguage): RecordingLanguage {
  return language === 'tr' ? 'en' : 'tr'
}

export function readingTextCount(language: RecordingLanguage): number {
  return RECORDING_READING_TEXTS[language].length
}

/** Wraps any integer index (including negative values) onto the language's text list. */
export function readingTextFor(language: RecordingLanguage, index: number): string {
  const texts = RECORDING_READING_TEXTS[language]
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0
  return texts[((safeIndex % texts.length) + texts.length) % texts.length] ?? texts[0] ?? ''
}

export function nextReadingTextIndex(index: number, count: number): number {
  if (!Number.isFinite(count) || count <= 1) return 0
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0
  return (((safeIndex + 1) % count) + count) % count
}

export function recordingCopyForLanguage(language?: string | null) {
  const normalized = normalizeRecordingLanguage(language)
  return {
    language: normalized,
    consent_script: RECORDING_CONSENT_SCRIPTS[normalized],
    reading_texts: RECORDING_READING_TEXTS[normalized],
    /** @deprecated The scrolling prompter was removed; kept for callers that still read one text. */
    prompter_text: readingTextFor(normalized, 0),
  } as const
}
