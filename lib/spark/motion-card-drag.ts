import type { MotionExposedParameter } from '@/lib/motion-editor/api'

import type { CompositionMotionEnergy, CompositionMotionRevisionRef } from './composition-typed-edits'
import type { MotionCard, MotionRatio } from './motion-catalog'
import type { SparkCardDrag } from './stage/placement'

/**
 * E1-D drag payload of a Motion card (D14, `SPARK_CARD_MIME`): what the canvas and the timeline hand back to the Motion tool's
 * `onDrop` so a dropped card plans exactly like its "+" button, without the drawer being asked again. JSON-safe and small: the
 * exact revision pin, the length bounds, the ratios and energies, the ids of the required image fields and the look to insert
 * with. Nothing here is trusted as a value: the plan and the gateway check everything again.
 */

export const MOTION_TOOL_ID = 'motion'
export const MOTION_CARD_KIND = 'motion_card'

export type MotionCardDragData = {
  key: string
  origin: MotionCard['origin']
  premium: boolean
  /** E1-I: the workspace bought this premium Motion (a drop of it is placed; the server's gate decides again). */
  owned: boolean
  ref: CompositionMotionRevisionRef
  title: { en: string; tr: string }
  ratios: MotionRatio[]
  energies: CompositionMotionEnergy[] | null
  minFrames: number | null
  maxFrames: number | null
  /** Ids of the required, Spark-editable image fields. */
  imageFields: string[]
  /** The look to insert with when the project has none of its own (the drawer's default preset). */
  videoStyleRef: string | null
}

export function motionCardDrag(card: MotionCard, videoStyleRef: string | null): SparkCardDrag {
  const data: MotionCardDragData = {
    key: card.key,
    origin: card.origin,
    premium: card.premium,
    owned: card.owned === true,
    ref: card.ref,
    title: card.title,
    ratios: [...card.aspectRatios],
    energies: card.energies ? [...card.energies] : null,
    minFrames: card.durationRange?.minFrames ?? null,
    maxFrames: card.durationRange?.maxFrames ?? null,
    imageFields: card.parameters.filter((parameter) => parameter.kind === 'media' && parameter.required && parameter.spark_editable).map((parameter) => parameter.parameter_id),
    videoStyleRef,
  }
  return { tool: MOTION_TOOL_ID, kind: MOTION_CARD_KIND, data: data as unknown as Record<string, unknown> }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const RATIOS: readonly string[] = ['16:9', '9:16', '1:1']
const ENERGIES: readonly string[] = ['sakin', 'dengeli', 'canli']

function refOf(value: unknown): CompositionMotionRevisionRef | null {
  if (!isObject(value)) return null
  const { motion_id: motionId, motion_revision_id: revisionId, scope, manifest_sha256: sha } = value
  if (!isString(motionId) || !isString(revisionId) || !isString(sha) || (scope !== 'library' && scope !== 'project_private')) return null
  return { motion_id: motionId, motion_revision_id: revisionId, scope, manifest_sha256: sha }
}

/** The card a drop brings back, or null for a payload that is not a well-formed Motion card (the drop is then ignored). */
export function motionCardFromDrag(drag: SparkCardDrag): { card: MotionCard; videoStyleRef: string | null } | null {
  if (drag.tool !== MOTION_TOOL_ID || drag.kind !== MOTION_CARD_KIND) return null
  const data = drag.data
  const ref = refOf(data['ref'])
  const title = data['title']
  if (!ref || !isString(data['key']) || !isObject(title) || !isString(title['en']) || !isString(title['tr'])) return null
  const origin = data['origin'] === 'mine' ? 'mine' : 'platform'
  const ratios = Array.isArray(data['ratios']) ? data['ratios'].filter((value): value is MotionRatio => isString(value) && RATIOS.includes(value)) : []
  const energies = Array.isArray(data['energies']) ? data['energies'].filter((value): value is CompositionMotionEnergy => isString(value) && ENERGIES.includes(value)) : null
  const min = typeof data['minFrames'] === 'number' ? data['minFrames'] : null
  const max = typeof data['maxFrames'] === 'number' ? data['maxFrames'] : null
  const imageFields = Array.isArray(data['imageFields']) ? data['imageFields'].filter(isString) : []
  const parameters: MotionExposedParameter[] = imageFields.map((parameterId) => ({ parameter_id: parameterId, kind: 'media', spark_editable: true, required: true }))
  return {
    card: {
      key: data['key'],
      origin,
      premium: data['premium'] === true,
      owned: data['owned'] === true,
      ref,
      title: { en: title['en'], tr: title['tr'] },
      summary: '',
      aspectRatios: ratios,
      energies,
      durationRange: min !== null && max !== null ? { minFrames: min, maxFrames: max } : null,
      parameters,
      sampleText: null,
      priceCredits: null,
      needsImage: imageFields.length > 0,
    },
    videoStyleRef: isString(data['videoStyleRef']) ? data['videoStyleRef'] : null,
  }
}
