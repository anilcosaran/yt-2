export const FLOW_ANGLE_PRESETS = [
  'front',
  'three_quarter_left',
  'three_quarter_right',
  'left_profile',
  'right_profile',
  'slight_up',
  'slight_down',
  'high_angle',
  'low_angle',
  'bird_eye',
] as const

export type FlowAnglePreset = (typeof FLOW_ANGLE_PRESETS)[number]
export const FLOW_ANGLE_CUSTOM = 'custom' as const
export type FlowAngleChoice = FlowAnglePreset | typeof FLOW_ANGLE_CUSTOM

export const FLOW_ANGLE_PRESET_LABELS: Record<FlowAngleChoice, string> = {
  front: 'Front',
  three_quarter_left: 'Three-quarter left',
  three_quarter_right: 'Three-quarter right',
  left_profile: 'Left profile',
  right_profile: 'Right profile',
  slight_up: 'Slight up',
  slight_down: 'Slight down',
  high_angle: 'High angle',
  low_angle: 'Low angle',
  bird_eye: "Bird's-eye",
  custom: 'Custom',
}

export const FLOW_ANGLE_PROMPTS: Record<FlowAnglePreset, string> = {
  front: 'Keep the same person and clothing. Recreate the portrait from a direct front-facing camera angle, eyes to camera, neutral head pose.',
  three_quarter_left: "Keep the same person and clothing. Recreate the portrait from a three-quarter camera angle to the subject's left.",
  three_quarter_right: "Keep the same person and clothing. Recreate the portrait from a three-quarter camera angle to the subject's right.",
  left_profile: 'Keep the same person and clothing. Recreate the portrait as a true left profile, camera at 90 degrees.',
  right_profile: 'Keep the same person and clothing. Recreate the portrait as a true right profile, camera at 90 degrees.',
  slight_up: 'Keep the same person and clothing. Recreate the portrait from a slightly low camera, looking mildly upward.',
  slight_down: 'Keep the same person and clothing. Recreate the portrait from a slightly high camera, looking mildly downward.',
  high_angle: 'Keep the same person and clothing. Recreate the portrait from a high camera looking down toward the subject.',
  low_angle: 'Keep the same person and clothing. Recreate the portrait from a low camera looking up toward the subject.',
  bird_eye: "Keep the same person and clothing. Recreate the scene from a bird's-eye overhead camera, looking straight down.",
}

const WORD_EDGE = String.raw`(?<![\p{L}\p{N}_])`
const WORD_END = String.raw`(?![\p{L}\p{N}_])`

const ANGLE_INTENT_RULES: Array<{ angle: FlowAnglePreset; pattern: RegExp }> = [
  { angle: 'bird_eye', pattern: new RegExp(`${WORD_EDGE}(bird['’]?s?[\\s-]*eye|overhead|top[\\s-]?down|aerial|nadir|kuş\\s*bak[ıi]ş[ıi]|tepeden|havadan)${WORD_END}`, 'iu') },
  { angle: 'high_angle', pattern: new RegExp(`${WORD_EDGE}(high\\s*angle|from\\s+above|looking\\s+down|üstten|yukar[ıi]dan)${WORD_END}`, 'iu') },
  { angle: 'low_angle', pattern: new RegExp(`${WORD_EDGE}(low\\s*angle|from\\s+below|looking\\s+up|alttan|a[sş]a[gğ][ıi]dan)${WORD_END}`, 'iu') },
  { angle: 'left_profile', pattern: new RegExp(`${WORD_EDGE}(left\\s*(profile|side)|profile\\s+left|true\\s+left|sol\\s*profil|sol\\s*yandan|soldan)${WORD_END}`, 'iu') },
  { angle: 'right_profile', pattern: new RegExp(`${WORD_EDGE}(right\\s*(profile|side)|profile\\s+right|true\\s+right|sa[gğ]\\s*profil|sa[gğ]\\s*yandan|sa[gğ]dan)${WORD_END}`, 'iu') },
  { angle: 'three_quarter_left', pattern: new RegExp(`${WORD_EDGE}(three[\\s-]?quarter\\s+left|3/4\\s+left|sol\\s*(üç|uc)\\s*[çc]eyrek)${WORD_END}`, 'iu') },
  { angle: 'three_quarter_right', pattern: new RegExp(`${WORD_EDGE}(three[\\s-]?quarter\\s+right|3/4\\s+right|sa[gğ]\\s*(üç|uc)\\s*[çc]eyrek)${WORD_END}`, 'iu') },
  { angle: 'slight_up', pattern: new RegExp(`${WORD_EDGE}(slight(?:ly)?\\s+up|mildly\\s+upward|hafif\\s+alttan)${WORD_END}`, 'iu') },
  { angle: 'slight_down', pattern: new RegExp(`${WORD_EDGE}(slight(?:ly)?\\s+down|mildly\\s+downward|hafif\\s+üstten)${WORD_END}`, 'iu') },
  { angle: 'front', pattern: new RegExp(`${WORD_EDGE}(front(?:al)?|facing\\s+camera|eyes\\s+to\\s+camera|önden|kar[sş][ıi]dan)${WORD_END}`, 'iu') },
]

const GENERIC_PROFILE_PATTERN = new RegExp(`${WORD_EDGE}(yandan|profil)${WORD_END}`, 'iu')

export function isFlowAnglePreset(value: unknown): value is FlowAnglePreset {
  return typeof value === 'string' && FLOW_ANGLE_PRESETS.includes(value as FlowAnglePreset)
}

export function inferAnglesFromPrompt(prompt: string): FlowAnglePreset[] {
  const text = prompt.trim()
  if (!text) return ['front']
  const matches = ANGLE_INTENT_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.angle)
  const unique = [...new Set(matches)]
  if (
    GENERIC_PROFILE_PATTERN.test(text)
    && !unique.includes('left_profile')
    && !unique.includes('right_profile')
  ) {
    unique.push('left_profile')
  }
  const resolved = unique.filter((angle) => {
    if (angle === 'low_angle' && unique.includes('slight_up')) return false
    if (angle === 'high_angle' && unique.includes('slight_down')) return false
    return true
  })
  return resolved.length > 0 ? resolved : ['front']
}

export function resolveAngleChoice(input: {
  prompt?: string
  angles?: unknown
  choice?: unknown
}): FlowAngleChoice {
  if (input.choice === FLOW_ANGLE_CUSTOM) return FLOW_ANGLE_CUSTOM
  if (isFlowAnglePreset(input.choice)) return input.choice
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  if (isFlowAnglePreset(prompt)) return prompt
  const matched = FLOW_ANGLE_PRESETS.find((preset) => FLOW_ANGLE_PROMPTS[preset] === prompt)
  if (matched) return matched
  if (prompt) return FLOW_ANGLE_CUSTOM
  const fromList = Array.isArray(input.angles)
    ? input.angles.filter(isFlowAnglePreset)
    : isFlowAnglePreset(input.angles)
      ? [input.angles]
      : []
  return fromList[0] ?? 'front'
}

export function resolveAngleSettings(input: {
  prompt?: string
  angles?: unknown
  angle?: unknown
  fromChip?: boolean
}): { prompt: string; angles: FlowAnglePreset[] } {
  const promptValue = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  const presetClicked = Boolean(input.fromChip) && isFlowAnglePreset(promptValue)
  const prompt = presetClicked && isFlowAnglePreset(promptValue)
    ? FLOW_ANGLE_PROMPTS[promptValue]
    : promptValue
  const inferred = prompt ? inferAnglesFromPrompt(prompt) : []
  const fromList = Array.isArray(input.angles)
    ? input.angles.filter(isFlowAnglePreset)
    : isFlowAnglePreset(input.angles)
      ? [input.angles]
      : []
  const fromSingle = isFlowAnglePreset(input.angle) ? [input.angle] : []
  const angles = presetClicked
    ? [promptValue]
    : inferred.length > 0 && prompt
      ? inferred
      : fromList.length > 0
        ? fromList
        : fromSingle
  const resolved = angles.length > 0 ? angles : (['front'] as FlowAnglePreset[])
  const fallback: FlowAnglePreset = resolved[0] ?? 'front'
  return {
    prompt: prompt || FLOW_ANGLE_PROMPTS[fallback],
    angles: resolved,
  }
}
