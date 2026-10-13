import {
  orderedScenes,
  sceneDurationSeconds,
  sceneReorderSpec,
  sceneSetSectionSpec,
  sectionInsertSpec,
  sectionRemoveSpec,
  sectionUpdateSpec,
  type CompositionDocument,
  type CompositionOpSpec,
  type CompositionScene,
} from '../composition-client'
import { sceneStatus, type SceneStatus } from '../scene-status'

/**
 * Timeline v2 P1-C: the model of the editor's left "Outline" panel. The document is not changed: sections are
 * `document.sections`, a section on screen is a RUN of consecutive scenes (strip order, `scene_sequence`) with the same
 * `section_id`, and every clip under it is still a scene. Scenes without a section form an "Unsorted" run; a section no
 * scene uses yet shows as an empty header after the section that precedes it in `document.sections`.
 *
 * Every gesture of the panel becomes ONE command (one undo group) built here from the typed op builders: a clip dragged
 * within or between sections (`scene.reorder` + `scene.set_section`), a section header dragged (one `scene.reorder` per
 * clip of its run), rename, add before / after, merge with the next section, delete (its clips join the previous
 * section) and "Add sections" for a project without any (Intro / Body / Outro). A command the gateway would refuse for
 * its size (more than `OUTLINE_MAX_OPS` ops) is not built. Pure functions; the panel renders and sends.
 */

/** The gateway's `COMPOSITION_COMMAND_LIMITS.ops`: one command carries at most this many ops. */
export const OUTLINE_MAX_OPS = 100
/** The gateway's section title bound (`section.insert` / `section.update`). */
export const SECTION_TITLE_MAX_LENGTH = 200

/** Phase 1 role tint, by position among the section runs: first = intro, last = outro, the others body. */
export type OutlineRole = 'intro' | 'body' | 'outro'

export type OutlineClip = {
  sceneId: string
  /** 1-based place in the strip. */
  number: number
  seconds: number | null
  /** Seconds from the start of the video to the clip. */
  start: number
  /** The first text of the scene (earliest on screen), the label before the media name and "Clip n". */
  text: string | null
  /** The scene's main clip (or its first clip when none covers the canvas): what the thumbnail shows. */
  media: { storageObjectId: string; kind: 'video' | 'image' } | null
  /** A scene of graphics only (no clip) shows a title card of its first text instead of a picture. */
  titleCard: string | null
  status: SceneStatus | null
}

export type OutlineGroup = {
  /** Stable while the run exists: `section:<id>` (`#<n>` for a second run of the same section) or `unsorted#<n>`. */
  key: string
  /** null: the "Unsorted" run. */
  sectionId: string | null
  title: string
  role: OutlineRole | null
  clips: OutlineClip[]
  /** Seconds from the start of the video to the run (an empty section: where its first clip would start). */
  start: number
  /** Total length; null while a clip's length is unknown. */
  seconds: number | null
}

export type Outline = {
  groups: OutlineGroup[]
  /** Scene ids in strip order (the clips of the groups, in order). */
  order: string[]
  /** The project has sections (otherwise the panel offers "Add sections"). */
  hasSections: boolean
}

type Body = Record<string, unknown>

const isRecord = (value: unknown): value is Body => typeof value === 'object' && value !== null && !Array.isArray(value)

function frameRange(value: unknown): { start_frame: number; end_frame: number } | null {
  if (!isRecord(value)) return null
  const start = value['start_frame']
  const end = value['end_frame']
  return typeof start === 'number' && typeof end === 'number' ? { start_frame: start, end_frame: end } : null
}

/**
 * The design's main-clip rule: the lowest clip layer whose transform is absent or covers the canvas. Without the media's
 * natural size in the document, "covers" is read from the transform the editor writes for a cover fit (scale of at least
 * 1, no rotation); a picture-in-picture is scaled down.
 */
function coversCanvas(layer: Body): boolean {
  const transform = layer['transform']
  if (!isRecord(transform)) return true
  const scale = transform['scale']
  const rotation = transform['rotation_deg']
  return typeof scale === 'number' && scale >= 1 && (rotation === undefined || rotation === 0)
}

function sceneMedia(document: CompositionDocument, scene: CompositionScene): OutlineClip['media'] {
  const clips = (scene.layers as unknown as Body[]).filter(
    (layer) => layer['layer_kind'] === 'clip' && isRecord(layer['placement']) && frameRange((layer['placement'] as Body)['scene_range']) !== null,
  )
  const main = clips.find(coversCanvas) ?? clips[0]
  if (!main) return null
  const sourceId = (main['placement'] as Body)['source_id']
  const source = document.source_media.find((candidate) => candidate.source_id === sourceId) as Body | undefined
  const object = isRecord(source?.['storage_object']) ? (source!['storage_object'] as Body) : null
  const objectId = object?.['storage_object_id']
  const kind = object?.['media_kind']
  if (typeof objectId !== 'string' || (kind !== 'video' && kind !== 'image')) return null
  return { storageObjectId: objectId, kind }
}

/** The text shown first (earliest start; the lowest layer on a tie), whitespace collapsed. */
function firstText(scene: CompositionScene): string | null {
  let best: { text: string; start: number } | null = null
  for (const layer of scene.layers as unknown as Body[]) {
    if (layer['layer_kind'] !== 'text' || typeof layer['text'] !== 'string') continue
    const text = layer['text'].replace(/\s+/g, ' ').trim()
    if (!text) continue
    const start = frameRange(layer['scene_range'])?.start_frame ?? 0
    if (!best || start < best.start) best = { text, start }
  }
  return best?.text ?? null
}

function clipOf(document: CompositionDocument, scene: CompositionScene, number: number, start: number, seconds: number | null): OutlineClip {
  const media = sceneMedia(document, scene)
  const text = firstText(scene)
  const hasClip = scene.layers.some((layer) => layer.layer_kind === 'clip')
  return { sceneId: scene.scene_id, number, seconds, start, text, media, titleCard: !hasClip ? text : null, status: sceneStatus(scene) }
}

const sum = (clips: readonly OutlineClip[]) =>
  clips.some((clip) => clip.seconds === null) ? null : clips.reduce((total, clip) => total + (clip.seconds ?? 0), 0)

/** The outline of a document: runs of sections in strip order, empty sections, Unsorted runs, role tints. */
export function buildOutline(document: CompositionDocument): Outline {
  const sectionIds = new Set(document.sections.map((section) => section.section_id))
  const titles = new Map(document.sections.map((section) => [section.section_id, section.title]))
  const groups: OutlineGroup[] = []
  const runsOf = new Map<string, number>()
  const order: string[] = []
  let start = 0
  orderedScenes(document).forEach((scene, index) => {
    const seconds = sceneDurationSeconds(document, scene)
    const clip = clipOf(document, scene, index + 1, start, seconds)
    start += seconds ?? 0
    order.push(scene.scene_id)
    const sectionId = scene.section_id !== null && sectionIds.has(scene.section_id) ? scene.section_id : null
    const last = groups[groups.length - 1]
    if (last && last.sectionId === sectionId) {
      last.clips.push(clip)
      return
    }
    const base = sectionId === null ? 'unsorted' : `section:${sectionId}`
    const run = runsOf.get(base) ?? 0
    runsOf.set(base, run + 1)
    groups.push({
      key: run === 0 && sectionId !== null ? base : `${base}#${run}`,
      sectionId,
      title: sectionId === null ? '' : (titles.get(sectionId) ?? ''),
      role: null,
      clips: [clip],
      start: clip.start,
      seconds: null,
    })
  })
  // Sections no scene uses yet: right after the run of the section before them in `document.sections`.
  document.sections.forEach((section, index) => {
    if (runsOf.has(`section:${section.section_id}`)) return
    let at = 0
    for (let before = index - 1; before >= 0; before -= 1) {
      const previous = document.sections[before]!.section_id
      let last = groups.length - 1
      while (last >= 0 && groups[last]!.sectionId !== previous) last -= 1
      if (last >= 0) {
        at = last + 1
        break
      }
    }
    runsOf.set(`section:${section.section_id}`, 1)
    groups.splice(at, 0, { key: `section:${section.section_id}`, sectionId: section.section_id, title: section.title, role: null, clips: [], start: 0, seconds: 0 })
  })
  let elapsed = 0
  for (const group of groups) {
    group.start = group.clips[0]?.start ?? elapsed
    group.seconds = sum(group.clips)
    elapsed = group.start + (group.seconds ?? 0)
  }
  const sectioned = groups.filter((group) => group.sectionId !== null)
  sectioned.forEach((group, index) => {
    group.role = index === 0 ? 'intro' : index === sectioned.length - 1 ? 'outro' : 'body'
  })
  return { groups, order, hasSections: document.sections.length > 0 }
}

// ---------------------------------------------------------------- commands

export type OutlinePlan =
  | { ok: true; specs: CompositionOpSpec[] }
  /** `nothing`: the gesture changes nothing; `too_many`: more than `OUTLINE_MAX_OPS` ops; `invalid`: not possible here. */
  | { ok: false; reason: 'nothing' | 'too_many' | 'invalid' }

function planOf(specs: CompositionOpSpec[]): OutlinePlan {
  if (specs.length === 0) return { ok: false, reason: 'nothing' }
  if (specs.length > OUTLINE_MAX_OPS) return { ok: false, reason: 'too_many' }
  return { ok: true, specs }
}

function sectionOfScene(document: CompositionDocument, sceneId: string): string | null {
  return document.scenes.find((scene) => scene.scene_id === sceneId)?.section_id ?? null
}

/** The last clip shown before group `index` that is not one of `moving` (null: the start of the strip). */
function clipBefore(outline: Outline, index: number, moving: ReadonlySet<string>): string | null {
  for (let group = index - 1; group >= 0; group -= 1) {
    const clips = outline.groups[group]!.clips
    for (let clip = clips.length - 1; clip >= 0; clip -= 1) {
      if (!moving.has(clips[clip]!.sceneId)) return clips[clip]!.sceneId
    }
  }
  return null
}

/** Where a dragged clip lands: before the clip at `index` of the group (`index` counts the dragged clip where it is now). */
export type ClipDropTarget = { groupKey: string; index: number }

/** A clip dragged within or between sections: one `scene.reorder` and / or one `scene.set_section`. */
export function planClipMove(document: CompositionDocument, outline: Outline, sceneId: string, target: ClipDropTarget): OutlinePlan {
  const groupIndex = outline.groups.findIndex((group) => group.key === target.groupKey)
  const group = outline.groups[groupIndex]
  if (!group || !outline.order.includes(sceneId)) return { ok: false, reason: 'invalid' }
  const current = group.clips.findIndex((clip) => clip.sceneId === sceneId)
  const others = group.clips.filter((clip) => clip.sceneId !== sceneId)
  const index = Math.max(0, Math.min(others.length, current >= 0 && target.index > current ? target.index - 1 : target.index))
  const after = index > 0 ? others[index - 1]!.sceneId : clipBefore(outline, groupIndex, new Set([sceneId]))
  const position = outline.order.indexOf(sceneId)
  const previous = position > 0 ? outline.order[position - 1]! : null
  const specs: CompositionOpSpec[] = []
  if (previous !== after) specs.push(sceneReorderSpec(sceneId, after))
  if (sectionOfScene(document, sceneId) !== group.sectionId) specs.push(sceneSetSectionSpec(sceneId, group.sectionId))
  return planOf(specs)
}

/** Keyboard move of a clip one place up or down; at the edge of its group it joins the neighbouring group. */
export function clipStepTarget(outline: Outline, sceneId: string, direction: -1 | 1): ClipDropTarget | null {
  const groupIndex = outline.groups.findIndex((group) => group.clips.some((clip) => clip.sceneId === sceneId))
  const group = outline.groups[groupIndex]
  if (!group) return null
  const index = group.clips.findIndex((clip) => clip.sceneId === sceneId)
  if (direction < 0) {
    if (index > 0) return { groupKey: group.key, index: index - 1 }
    const previous = outline.groups[groupIndex - 1]
    return previous ? { groupKey: previous.key, index: previous.clips.length } : null
  }
  if (index < group.clips.length - 1) return { groupKey: group.key, index: index + 2 }
  const next = outline.groups[groupIndex + 1]
  return next ? { groupKey: next.key, index: 0 } : null
}

/**
 * A section header dragged: its run lands before group `beforeKey` (null: at the end). One `scene.reorder` per clip, in
 * order, so the run arrives whole.
 */
export function planGroupMove(outline: Outline, groupKey: string, beforeKey: string | null): OutlinePlan {
  const group = outline.groups.find((candidate) => candidate.key === groupKey)
  if (!group || group.clips.length === 0) return { ok: false, reason: 'invalid' }
  const targetIndex = beforeKey === null ? outline.groups.length : outline.groups.findIndex((candidate) => candidate.key === beforeKey)
  if (targetIndex < 0) return { ok: false, reason: 'invalid' }
  const run = group.clips.map((clip) => clip.sceneId)
  const after = clipBefore(outline, targetIndex, new Set(run))
  const first = outline.order.indexOf(run[0]!)
  if ((first > 0 ? outline.order[first - 1]! : null) === after) return { ok: false, reason: 'nothing' }
  return planOf(run.map((sceneId, index) => sceneReorderSpec(sceneId, index === 0 ? after : run[index - 1]!)))
}

/**
 * Keyboard move of a run past its neighbouring run: the key of the group it lands before (null: the end). Empty sections
 * are stepped over (their place follows `document.sections`, not the strip), so every step moves clips.
 */
export function groupStepTarget(outline: Outline, groupKey: string, direction: -1 | 1): { beforeKey: string | null } | null {
  const groups = outline.groups
  const index = groups.findIndex((group) => group.key === groupKey)
  if (index < 0) return null
  let neighbour = index + direction
  while (neighbour >= 0 && neighbour < groups.length && groups[neighbour]!.clips.length === 0) neighbour += direction
  if (neighbour < 0 || neighbour >= groups.length) return null
  return { beforeKey: direction < 0 ? groups[neighbour]!.key : (groups[neighbour + 1]?.key ?? null) }
}

/** A trimmed title the gateway accepts, or null. */
export function sectionTitle(value: string): string | null {
  const title = value.trim()
  return title.length >= 1 && title.length <= SECTION_TITLE_MAX_LENGTH ? title : null
}

export function planRename(document: CompositionDocument, sectionId: string, value: string): OutlinePlan {
  const section = document.sections.find((candidate) => candidate.section_id === sectionId)
  const title = sectionTitle(value)
  if (!section) return { ok: false, reason: 'invalid' }
  if (title === null || title === section.title) return { ok: false, reason: 'nothing' }
  return planOf([sectionUpdateSpec(sectionId, { title })])
}

/**
 * A new, empty section next to a group: "after" follows the group's section in `document.sections`, "before" follows the
 * section shown before the group (the start of the list when there is none), so it appears where it was asked for.
 */
export function planAddSection(
  document: CompositionDocument,
  outline: Outline,
  input: { groupKey: string | null; place: 'before' | 'after'; sectionId: string; title: string },
): OutlinePlan {
  const title = sectionTitle(input.title)
  if (title === null) return { ok: false, reason: 'invalid' }
  let afterSectionId: string | null
  if (input.groupKey === null) {
    // "Add section" at the bottom: after the last section shown.
    afterSectionId = [...outline.groups].reverse().find((group) => group.sectionId !== null)?.sectionId ?? null
  } else {
    const index = outline.groups.findIndex((group) => group.key === input.groupKey)
    const group = outline.groups[index]
    if (!group) return { ok: false, reason: 'invalid' }
    afterSectionId =
      input.place === 'after'
        ? group.sectionId
        : (outline.groups.slice(0, index).reverse().find((candidate) => candidate.sectionId !== null)?.sectionId ?? null)
    if (input.place === 'after' && afterSectionId === null) return { ok: false, reason: 'invalid' }
  }
  if (afterSectionId !== null && !document.sections.some((section) => section.section_id === afterSectionId)) return { ok: false, reason: 'invalid' }
  return planOf([sectionInsertSpec({ sectionId: input.sectionId, title, afterSectionId })])
}

/** The section shown right after this group, which "Merge with next" folds into it (null: none). */
export function nextSectionGroup(outline: Outline, groupKey: string): OutlineGroup | null {
  const index = outline.groups.findIndex((group) => group.key === groupKey)
  const group = outline.groups[index]
  const next = outline.groups[index + 1]
  if (!group?.sectionId || !next?.sectionId || next.sectionId === group.sectionId) return null
  return next
}

/** "Merge with next": every clip of the next section joins this one, then the next section is removed. */
export function planMergeWithNext(document: CompositionDocument, outline: Outline, groupKey: string): OutlinePlan {
  const group = outline.groups.find((candidate) => candidate.key === groupKey)
  const next = nextSectionGroup(outline, groupKey)
  if (!group?.sectionId || !next?.sectionId) return { ok: false, reason: 'invalid' }
  const moving = outline.order.filter((sceneId) => sectionOfScene(document, sceneId) === next.sectionId)
  return planOf([...moving.map((sceneId) => sceneSetSectionSpec(sceneId, group.sectionId)), sectionRemoveSpec(next.sectionId)])
}

/**
 * "Delete section": the clips of each run join the group shown before that run (a section, or Unsorted), the first run
 * of the list joins the group after it; then the section is removed. One command.
 */
export function planDeleteSection(outline: Outline, groupKey: string): OutlinePlan {
  const sectionId = outline.groups.find((group) => group.key === groupKey)?.sectionId
  if (!sectionId) return { ok: false, reason: 'invalid' }
  const specs: CompositionOpSpec[] = []
  outline.groups.forEach((group, index) => {
    if (group.sectionId !== sectionId || group.clips.length === 0) return
    const neighbour = index > 0 ? outline.groups[index - 1] : outline.groups[index + 1]
    const home = neighbour && neighbour.sectionId !== sectionId ? neighbour.sectionId : null
    for (const clip of group.clips) specs.push(sceneSetSectionSpec(clip.sceneId, home))
  })
  specs.push(sectionRemoveSpec(sectionId))
  return planOf(specs)
}

/**
 * "Add sections" for a project without sections (a blank or uploaded project): Intro, Body and Outro in one command; the
 * first clip goes to Intro, the last to Outro, the rest to Body. The titles come in the editor's language.
 */
export function planAddSections(
  document: CompositionDocument,
  input: { ids: readonly [string, string, string]; titles: { intro: string; body: string; outro: string } },
): OutlinePlan {
  if (document.sections.length > 0) return { ok: false, reason: 'invalid' }
  const order = orderedScenes(document).map((scene) => scene.scene_id)
  if (order.length === 0) return { ok: false, reason: 'nothing' }
  const [intro, body, outro] = input.ids
  const titles = [sectionTitle(input.titles.intro), sectionTitle(input.titles.body), sectionTitle(input.titles.outro)]
  if (titles.some((title) => title === null)) return { ok: false, reason: 'invalid' }
  const specs = [
    sectionInsertSpec({ sectionId: intro, title: titles[0]!, afterSectionId: null }),
    sectionInsertSpec({ sectionId: body, title: titles[1]!, afterSectionId: intro }),
    sectionInsertSpec({ sectionId: outro, title: titles[2]!, afterSectionId: body }),
    ...order.map((sceneId, index) =>
      sceneSetSectionSpec(sceneId, index === 0 ? intro : index === order.length - 1 ? outro : body),
    ),
  ]
  return planOf(specs)
}
