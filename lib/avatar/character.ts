/**
 * Virtual character ("sanal karakter") form model: style cards, chip groups, the live prompt
 * preview and the `character` / `voice` payload for `POST /api/v1/avatars` (kind digital_human).
 */

export const CHARACTER_STYLES = ['realistic', 'cinematic', 'cartoon', 'anime', '3d', 'illustration'] as const
export type CharacterStyle = (typeof CHARACTER_STYLES)[number]

export const CHARACTER_FRAMINGS = ['close', 'waist', 'full'] as const
export type CharacterFraming = (typeof CHARACTER_FRAMINGS)[number]

export type CharacterOrientation = 'portrait' | 'landscape'
export type CharacterMode = 'detailed' | 'prompt'

export const CHARACTER_TEXT_FIELDS = [
  'gender',
  'age',
  'ethnicity',
  'body',
  'hair',
  'eyes',
  'facial_hair',
  'accessories',
  'outfit_style',
  'outfit',
  'background',
  'lighting',
  'expression',
] as const
export type CharacterTextField = (typeof CHARACTER_TEXT_FIELDS)[number]

export type CharacterChipOption = { id: string; value: string }

export type CharacterChipGroup = {
  field: CharacterTextField
  options: CharacterChipOption[]
  /** The group also accepts a short free-text value. */
  freeText: boolean
}

export type CharacterSection = {
  id: 'person' | 'look' | 'outfit' | 'scene'
  groups: CharacterChipGroup[]
}

const chips = (entries: Array<[string, string]>): CharacterChipOption[] =>
  entries.map(([id, value]) => ({ id, value }))

/** Chip groups per plan section 4.5 (values are the English phrases sent to the server). */
export const CHARACTER_SECTIONS: CharacterSection[] = [
  {
    id: 'person',
    groups: [
      { field: 'gender', freeText: false, options: chips([['female', 'woman'], ['male', 'man'], ['nonbinary', 'non-binary person']]) },
      { field: 'age', freeText: false, options: chips([['young', 'in their early 20s'], ['adult', 'in their 30s'], ['middle', 'in their 40s'], ['senior', 'in their 60s']]) },
      {
        field: 'ethnicity',
        freeText: true,
        options: chips([
          ['east_asian', 'East Asian'],
          ['south_asian', 'South Asian'],
          ['black', 'Black'],
          ['white', 'white'],
          ['latino', 'Latino'],
          ['middle_eastern', 'Middle Eastern'],
          ['mixed', 'mixed heritage'],
        ]),
      },
      { field: 'body', freeText: false, options: chips([['slim', 'slim build'], ['average', 'average build'], ['athletic', 'athletic build'], ['curvy', 'curvy build'], ['plus', 'plus-size build']]) },
    ],
  },
  {
    id: 'look',
    groups: [
      { field: 'hair', freeText: true, options: chips([['short', 'short hair'], ['long', 'long hair'], ['curly', 'curly hair'], ['straight', 'straight hair'], ['ponytail', 'hair in a ponytail'], ['bald', 'bald head']]) },
      { field: 'eyes', freeText: false, options: chips([['brown', 'brown eyes'], ['blue', 'blue eyes'], ['green', 'green eyes'], ['hazel', 'hazel eyes'], ['gray', 'gray eyes']]) },
      { field: 'facial_hair', freeText: false, options: chips([['none', 'clean-shaven'], ['stubble', 'light stubble'], ['beard', 'full beard'], ['mustache', 'mustache']]) },
      { field: 'accessories', freeText: true, options: chips([['glasses', 'glasses'], ['sunglasses', 'sunglasses'], ['earrings', 'earrings'], ['hat', 'a hat'], ['headphones', 'headphones']]) },
    ],
  },
  {
    id: 'outfit',
    groups: [
      { field: 'outfit_style', freeText: false, options: chips([['casual', 'casual'], ['business', 'business'], ['sport', 'sportswear'], ['costume', 'costume']]) },
      { field: 'outfit', freeText: true, options: [] },
    ],
  },
  {
    id: 'scene',
    groups: [
      { field: 'background', freeText: true, options: chips([['studio', 'plain studio backdrop'], ['office', 'modern office'], ['outdoor', 'outdoor setting'], ['transparent', 'plain transparent background']]) },
      { field: 'lighting', freeText: false, options: chips([['soft', 'soft light'], ['studio', 'studio lighting'], ['natural', 'natural daylight'], ['dramatic', 'dramatic lighting']]) },
      { field: 'expression', freeText: false, options: chips([['smile', 'friendly smile'], ['neutral', 'neutral expression'], ['confident', 'confident expression'], ['serious', 'serious expression']]) },
    ],
  },
]

export type CharacterFields = Partial<Record<CharacterTextField, string>>

export type CharacterDraft = {
  mode: CharacterMode
  style: CharacterStyle | null
  fields: CharacterFields
  framing: CharacterFraming | null
  orientation: CharacterOrientation
  /** Free prompt (prompt mode) or the edited preview (detailed mode). */
  prompt: string
  /** Detailed mode: the user edited the generated preview, so it is sent as the prompt. */
  promptEdited: boolean
  name: string
}

export const EMPTY_CHARACTER_DRAFT: CharacterDraft = {
  mode: 'detailed',
  style: null,
  fields: {},
  framing: null,
  orientation: 'portrait',
  prompt: '',
  promptEdited: false,
  name: '',
}

const STYLE_PHRASES: Record<CharacterStyle, string> = {
  realistic: 'Photorealistic portrait of',
  cinematic: 'Cinematic film still of',
  cartoon: 'Cartoon character illustration of',
  anime: 'Anime-style character art of',
  '3d': 'Stylized 3D character render of',
  illustration: 'Digital illustration of',
}

const FRAMING_PHRASES: Record<CharacterFraming, string> = {
  close: 'close-up head and shoulders framing',
  waist: 'waist-up framing',
  full: 'full-body framing',
}

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

/** Deterministic English preview built from the detailed fields (mirrors the server template). */
export function composeCharacterPrompt(draft: Pick<CharacterDraft, 'style' | 'fields' | 'framing' | 'orientation' | 'name'>) {
  const f = draft.fields
  const subjectParts = [clean(f.ethnicity), clean(f.gender) || 'person'].filter(Boolean)
  const lead = draft.style ? STYLE_PHRASES[draft.style] : 'Portrait of'
  const age = clean(f.age)
  const name = clean(draft.name)
  const sentences: string[] = []
  sentences.push(`${lead} a ${subjectParts.join(' ')}${age ? ` ${age}` : ''}${name ? ` named ${name}` : ''}.`)
  const features = [clean(f.body), clean(f.hair), clean(f.eyes), clean(f.facial_hair)].filter(Boolean)
  if (features.length) sentences.push(`${capitalize(features.join(', '))}.`)
  if (clean(f.accessories)) sentences.push(`Wearing ${clean(f.accessories)}.`)
  const outfit = [clean(f.outfit_style) ? `${clean(f.outfit_style)} outfit` : '', clean(f.outfit)].filter(Boolean)
  if (outfit.length) sentences.push(`Dressed in a ${outfit.join(': ')}.`)
  if (clean(f.expression)) sentences.push(`${capitalize(clean(f.expression))}, looking at the camera.`)
  const scene = [clean(f.background), clean(f.lighting)].filter(Boolean)
  if (scene.length) sentences.push(`${capitalize(scene.join(', '))}.`)
  sentences.push(`${capitalize(draft.framing ? FRAMING_PHRASES[draft.framing] : 'waist-up framing')}, ${draft.orientation} orientation.`)
  return sentences.join(' ')
}

export function hasCharacterDetail(draft: CharacterDraft) {
  return Boolean(draft.style || draft.framing || CHARACTER_TEXT_FIELDS.some((field) => clean(draft.fields[field])))
}

export function characterPreviewPrompt(draft: CharacterDraft) {
  if (draft.mode === 'prompt') return clean(draft.prompt)
  return draft.promptEdited ? clean(draft.prompt) : composeCharacterPrompt(draft)
}

/** At least one detailed field or a prompt, or a reference image, is required. */
export function canSubmitCharacter(draft: CharacterDraft, hasReference: boolean) {
  if (hasReference) return true
  if (draft.mode === 'prompt') return Boolean(clean(draft.prompt))
  return hasCharacterDetail(draft) || (draft.promptEdited && Boolean(clean(draft.prompt)))
}

export type AvatarCharacterPayload = {
  mode: CharacterMode
  prompt?: string
  style?: CharacterStyle
  framing?: CharacterFraming
  orientation: CharacterOrientation
  name?: string
} & Partial<Record<CharacterTextField, string>>

/** Sent when only a reference image is given (the server needs a prompt or at least one field). */
export const REFERENCE_ONLY_PROMPT = 'Create this character from the reference image, keeping the same person, face and style.'

export function buildCharacterPayload(
  draft: CharacterDraft,
  options: { hasReference?: boolean } = {},
): AvatarCharacterPayload {
  const name = clean(draft.name)
  if (!hasCharacterDetail(draft) && !clean(draft.prompt) && options.hasReference) {
    return {
      mode: 'prompt',
      prompt: REFERENCE_ONLY_PROMPT,
      orientation: draft.orientation,
      ...(name ? { name } : {}),
    }
  }
  if (draft.mode === 'prompt') {
    const prompt = clean(draft.prompt).slice(0, 2000)
    return {
      mode: 'prompt',
      ...(prompt ? { prompt } : {}),
      ...(draft.style ? { style: draft.style } : {}),
      orientation: draft.orientation,
      ...(name ? { name } : {}),
    }
  }
  const fields: Partial<Record<CharacterTextField, string>> = {}
  for (const field of CHARACTER_TEXT_FIELDS) {
    const value = clean(draft.fields[field])
    if (value) fields[field] = value.slice(0, 200)
  }
  const edited = draft.promptEdited ? clean(draft.prompt).slice(0, 2000) : ''
  return {
    mode: 'detailed',
    ...(edited ? { prompt: edited } : {}),
    ...(draft.style ? { style: draft.style } : {}),
    ...fields,
    ...(draft.framing ? { framing: draft.framing } : {}),
    orientation: draft.orientation,
    ...(name ? { name } : {}),
  }
}

export type AvatarVoiceChoice =
  | { mode: 'library'; voiceProfileId: string | null }
  | {
      mode: 'upload'
      /** Trimmed reference WAV (within the voice clone model's min/max window). */
      storageObjectId: string | null
      consentAccepted: boolean
      /** Optional checks for callers that did not go through the trim flow. */
      durationSeconds?: number | null
      mimeType?: string | null
      fileName?: string | null
    }
  | { mode: 'later' }

export type AvatarVoicePayload =
  | { mode: 'library'; voice_profile_id: string }
  | { mode: 'upload'; storage_object_id: string; consent_accepted: true }
  | { mode: 'later' }

/** Fallback reference window of the public instant voice clone model (schema values win). */
export const VOICE_UPLOAD_MIN_SECONDS = 5
export const VOICE_UPLOAD_MAX_SECONDS = 10

/** Upload types accepted without client-side conversion (the trim flow re-encodes to WAV). */
const VOICE_UPLOAD_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/ogg', 'application/ogg', 'audio/webm', 'video/webm', 'audio/opus'])
const VOICE_UPLOAD_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'oga', 'opus', 'webm'])

/** `true` when the file is MP3/WAV/OGG/WebM (by MIME type, or by extension when the type is unknown). */
export function isVoiceUploadTypeAllowed(mimeType: string | null | undefined, fileName?: string | null) {
  const mime = (mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (mime && mime !== 'application/octet-stream') return VOICE_UPLOAD_MIME_TYPES.has(mime)
  const ext = (fileName ?? '').trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  return ext ? VOICE_UPLOAD_EXTENSIONS.has(ext) : true
}

export function voiceUploadDurationIssue(
  durationSeconds: number | null | undefined,
  window: { minSeconds: number; maxSeconds: number } = { minSeconds: VOICE_UPLOAD_MIN_SECONDS, maxSeconds: VOICE_UPLOAD_MAX_SECONDS },
): 'too_short' | 'too_long' | null {
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null
  if (durationSeconds < window.minSeconds) return 'too_short'
  if (durationSeconds > window.maxSeconds + 0.05) return 'too_long'
  return null
}

/** `null` means the voice choice is incomplete (upload without file/consent, bad duration). */
export function buildVoicePayload(choice: AvatarVoiceChoice): AvatarVoicePayload | null {
  if (choice.mode === 'later') return { mode: 'later' }
  if (choice.mode === 'library') {
    return choice.voiceProfileId ? { mode: 'library', voice_profile_id: choice.voiceProfileId } : { mode: 'later' }
  }
  if (!choice.storageObjectId || !choice.consentAccepted) return null
  if (voiceUploadDurationIssue(choice.durationSeconds)) return null
  if (!isVoiceUploadTypeAllowed(choice.mimeType, choice.fileName)) return null
  return { mode: 'upload', storage_object_id: choice.storageObjectId, consent_accepted: true }
}

/** Suggested descriptions for the "Suggest a description" action in prompt mode. */
export const CHARACTER_PROMPT_SUGGESTIONS = [
  'A friendly tech presenter in her early 30s with short dark hair, round glasses and a navy blazer, standing in a bright modern studio, soft key light.',
  'A cheerful cartoon fox mascot wearing a yellow hoodie and headphones, big expressive eyes, clean pastel background.',
  'A calm documentary narrator in his 50s with a salt-and-pepper beard, wool coat, warm cinematic lighting, dark wood library behind him.',
  'An energetic anime-style fitness coach with a high ponytail, sporty outfit, bright gym background, dynamic lighting.',
  'A stylized 3D robot host with a rounded white shell and glowing blue eyes, friendly pose, minimal gradient backdrop.',
] as const

function capitalize(value: string) {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value
}

/** Seeds the form from a public template ("Create in this style") or a legacy brief. */
export function characterDraftFromBrief(brief: {
  prompt?: string | null
  style?: string | null
  gender?: string | null
  age?: string | null
  ethnicity?: string | null
  orientation?: string | null
  name?: string | null
} | null | undefined): CharacterDraft {
  if (!brief) return { ...EMPTY_CHARACTER_DRAFT, fields: {} }
  const styleMap: Record<string, CharacterStyle> = {
    realistic: 'realistic',
    cinematic: 'cinematic',
    cartoon: 'cartoon',
    anime: 'anime',
    '3d': '3d',
    illustration: 'illustration',
    illustrated: 'illustration',
  }
  const genderMap: Record<string, string> = { female: 'woman', male: 'man', nonbinary: 'non-binary person' }
  const ageMap: Record<string, string> = { young: 'in their early 20s', adult: 'in their 30s', mature: 'in their 40s' }
  const fields: CharacterFields = {}
  const gender = brief.gender ? genderMap[brief.gender] : undefined
  if (gender) fields.gender = gender
  const age = brief.age ? ageMap[brief.age] : undefined
  if (age) fields.age = age
  if (brief.ethnicity?.trim()) fields.ethnicity = brief.ethnicity.trim()
  const prompt = brief.prompt?.trim() ?? ''
  return {
    ...EMPTY_CHARACTER_DRAFT,
    mode: prompt ? 'prompt' : 'detailed',
    style: brief.style ? styleMap[brief.style.toLowerCase()] ?? null : null,
    fields,
    orientation: brief.orientation === 'landscape' ? 'landscape' : 'portrait',
    prompt,
    name: brief.name?.trim() ?? '',
  }
}
