export const MAX_ANGLE_SELECTIONS = 5
export const MAX_ANGLE_PROMPT_CHARS = 600

export type AngleGalleryItem = {
  id: string
  preset?: string
  labelKey: string
  degree: string
  prompt: string
  imageSrc: string
  azimuthDeg?: number
  elevationDeg?: number
  zoom?: number
}

export type AnglePrompt = {
  id: string
  label: string
  prompt: string
  preset?: string
  azimuth_deg?: number
  elevation_deg?: number
  zoom?: number
}

const ENGINE_CAMERA_PRESETS = new Set([
  'front',
  'three_quarter_right',
  'right_profile',
  'three_quarter_left',
  'left_profile',
  'slight_up',
  'slight_down',
  'high_angle',
  'low_angle',
  'bird_eye',
])

const ANGLE_ASSET = (name: string) => `/tools/angle/${name}.jpg`

export const ANGLE_GALLERY_ITEMS: readonly AngleGalleryItem[] = [
  {
    id: 'back',
    labelKey: 'back_angle_e2af83ca',
    degree: '180°',
    prompt: 'Back view, eye-level shot, medium shot.',
    imageSrc: ANGLE_ASSET('back'),
    azimuthDeg: 180,
    elevationDeg: 0,
    zoom: 1,
  },
  {
    id: 'side',
    preset: 'right_profile',
    labelKey: 'side_26528381',
    degree: '90°',
    prompt: 'Right side profile view, eye-level shot, medium shot.',
    imageSrc: ANGLE_ASSET('side'),
    azimuthDeg: 90,
    elevationDeg: 0,
    zoom: 1,
  },
  {
    id: 'back_side',
    labelKey: 'back_side_a1e4852d',
    degree: '135°',
    prompt: 'Back-right three-quarter view, eye-level shot, medium shot.',
    imageSrc: ANGLE_ASSET('back-side'),
    azimuthDeg: 135,
    elevationDeg: 0,
    zoom: 1,
  },
  {
    id: 'front_side',
    preset: 'three_quarter_right',
    labelKey: 'front_side_ddc565af',
    degree: '45°',
    prompt: 'Front-right three-quarter view, eye-level shot, medium shot.',
    imageSrc: ANGLE_ASSET('front-side'),
    azimuthDeg: 45,
    elevationDeg: 0,
    zoom: 1,
  },
  {
    id: 'front',
    preset: 'front',
    labelKey: 'front_dd19f988',
    degree: '0°',
    prompt: 'Front view, eye-level shot, medium shot.',
    imageSrc: ANGLE_ASSET('front'),
    azimuthDeg: 0,
    elevationDeg: 0,
    zoom: 1,
  },
  {
    id: 'top_down',
    labelKey: 'top_down_a609942a',
    degree: '0° / 55°',
    prompt: 'Front view from a high camera angle looking down, medium shot.',
    imageSrc: ANGLE_ASSET('top-down'),
    azimuthDeg: 0,
    elevationDeg: 55,
    zoom: 1,
  },
  {
    id: 'bottom_up',
    preset: 'low_angle',
    labelKey: 'bottom_up_e8442acc',
    degree: '0° / -30°',
    prompt: 'Front view from a low camera angle looking up, medium shot.',
    imageSrc: ANGLE_ASSET('bottom-up'),
    azimuthDeg: 0,
    elevationDeg: -30,
    zoom: 1,
  },
  {
    id: 'front_elevated',
    preset: 'slight_down',
    labelKey: 'front_elevated_858c089c',
    degree: '0° / 20°',
    prompt: 'Front view from slightly above eye level, looking mildly downward, medium shot.',
    imageSrc: ANGLE_ASSET('front-elevated'),
    azimuthDeg: 0,
    elevationDeg: 20,
    zoom: 1,
  },
  {
    id: 'front_closeup',
    labelKey: 'front_close_up_11594cd2',
    degree: '0°',
    prompt: 'Front view, eye-level shot, close-up.',
    imageSrc: ANGLE_ASSET('front-closeup'),
    azimuthDeg: 0,
    elevationDeg: 0,
    zoom: 1.55,
  },
] as const

export const DEFAULT_ANGLE_GALLERY_ID = ANGLE_GALLERY_ITEMS[0]!.id

const ITEMS_BY_ID = new Map(ANGLE_GALLERY_ITEMS.map((item) => [item.id, item]))
const ITEMS_BY_PRESET = new Map(
  ANGLE_GALLERY_ITEMS.flatMap((item) => (item.preset ? [[item.preset, item] as const] : [])),
)

export function getAngleGalleryItem(id: string): AngleGalleryItem | undefined {
  return ITEMS_BY_ID.get(id)
}

export function anglePromptFromGalleryItem(item: AngleGalleryItem, index: number): AnglePrompt {
  const enginePreset = item.preset && ENGINE_CAMERA_PRESETS.has(item.preset) ? item.preset : undefined
  const camera = item.azimuthDeg != null && item.elevationDeg != null && item.zoom != null
    ? {
        azimuth_deg: item.azimuthDeg,
        elevation_deg: item.elevationDeg,
        zoom: item.zoom,
      }
    : {}
  return {
    id: `angle-${index + 1}`,
    label: galleryFallbackLabel(item),
    prompt: item.prompt,
    ...(enginePreset ? { preset: enginePreset } : camera),
  }
}

export function defaultAnglePrompts(): AnglePrompt[] {
  const item = ITEMS_BY_ID.get(DEFAULT_ANGLE_GALLERY_ID)!
  return [anglePromptFromGalleryItem(item, 0)]
}

export function selectedGalleryIdsFromPrompts(prompts: AnglePrompt[]): string[] {
  const ids: string[] = []
  for (const prompt of prompts) {
    const item = matchGalleryItem(prompt)
    if (item && !ids.includes(item.id)) ids.push(item.id)
  }
  return ids
}

export function matchGalleryItem(prompt: AnglePrompt): AngleGalleryItem | undefined {
  if (prompt.preset && ENGINE_CAMERA_PRESETS.has(prompt.preset)) {
    const byPreset = ITEMS_BY_PRESET.get(prompt.preset)
    if (byPreset) return byPreset
  }
  const normalized = normalizePrompt(prompt.prompt)
  if (normalized) {
    const byPrompt = ANGLE_GALLERY_ITEMS.find((item) => normalizePrompt(item.prompt) === normalized)
    if (byPrompt) return byPrompt
  }
  if (prompt.azimuth_deg == null || prompt.elevation_deg == null || prompt.zoom == null) return undefined
  return ANGLE_GALLERY_ITEMS.find((item) => (
    item.azimuthDeg === prompt.azimuth_deg
    && item.elevationDeg === prompt.elevation_deg
    && item.zoom === prompt.zoom
  ))
}

export function toggleAngleGallerySelection(
  selectedIds: readonly string[],
  id: string,
  max = MAX_ANGLE_SELECTIONS,
): { next: string[]; blocked: boolean; unchanged: boolean } {
  if (!ITEMS_BY_ID.has(id)) {
    return { next: [...selectedIds], blocked: false, unchanged: true }
  }
  const already = selectedIds.includes(id)
  if (already) {
    if (selectedIds.length <= 1) {
      return { next: [...selectedIds], blocked: false, unchanged: true }
    }
    return { next: selectedIds.filter((item) => item !== id), blocked: false, unchanged: false }
  }
  if (selectedIds.length >= max) {
    return { next: [...selectedIds], blocked: true, unchanged: true }
  }
  return { next: [...selectedIds, id], blocked: false, unchanged: false }
}

export function promptsFromGalleryIds(ids: readonly string[]): AnglePrompt[] {
  return ids
    .map((id) => ITEMS_BY_ID.get(id))
    .filter((item): item is AngleGalleryItem => Boolean(item))
    .slice(0, MAX_ANGLE_SELECTIONS)
    .map((item, index) => anglePromptFromGalleryItem(item, index))
}

export function mergeCustomPrompt(
  prompts: AnglePrompt[],
  custom: AnglePrompt,
): AnglePrompt[] {
  const galleryPrompts = prompts.filter((item) => Boolean(matchGalleryItem(item)))
  const next = [...galleryPrompts, custom].slice(0, MAX_ANGLE_SELECTIONS)
  return next.map((item, index) => ({ ...item, id: `angle-${index + 1}` }))
}

export function samePrompt(left: string, right: string) {
  return normalizePrompt(left) === normalizePrompt(right)
}

export function normalizePrompt(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
}

function galleryFallbackLabel(item: AngleGalleryItem) {
  if (item.id === 'front') return 'Front'
  if (item.id === 'back') return 'Back'
  if (item.id === 'side') return 'Side'
  if (item.id === 'back_side') return 'Back Side'
  if (item.id === 'front_side') return 'Front Side'
  if (item.id === 'top_down') return 'Top Down'
  if (item.id === 'bottom_up') return 'Bottom Up'
  if (item.id === 'front_elevated') return 'Front Elevated'
  return 'Front Close-up'
}
