import {
  newSectionId,
  sceneSetSectionSpec,
  sectionInsertSpec,
  sectionRemoveSpec,
  sectionUpdateSpec,
  type CompositionDocument,
  type CompositionOpSpec,
} from '../composition-client'
import type { TimelineChapter, TimelineModel } from './timeline-model'

/**
 * Spark timeline v3: the chapter row's edits (YouTube-chapter look, owner feedback 2026-10-03). A chapter is a run of
 * scenes of one section (`timeline-model.ts`); a project without sections shows one automatic chapter per scene. Every
 * gesture is ONE command (one undo group) built here from the section ops the editor already applies locally
 * (`section.insert/update/remove`, `scene.set_section`, see `optimistic/document-ops.ts`):
 *
 * - rename (an automatic chapter: "make chapters" with that name, see below), make chapters,
 * - start a chapter at a cut, move the edge between two chapters (it snaps to a cut, the scenes in between change chapter),
 * - merge with the next chapter, delete (its scenes join the chapter before it, the first chapter's the one after it),
 * - copy the YouTube chapter list (`0:00 Intro` lines) with the chapters shorter than YouTube's 10 s.
 *
 * Renaming an automatic chapter or "Make chapters" writes real sections for every scene at once (a section per chapter,
 * named as shown); a command the gateway would refuse for its size (more than `CHAPTER_MAX_OPS` ops) is not built.
 * Nothing is applied here; the timeline sends the plan with `actions.apply`.
 */

/** The gateway's `COMPOSITION_COMMAND_LIMITS.ops`: one command carries at most this many ops. */
export const CHAPTER_MAX_OPS = 100
/** The gateway's section title bound. */
export const CHAPTER_TITLE_MAX_LENGTH = 200
/** YouTube needs every chapter to last at least this long (and the first to start at 0:00). */
export const YOUTUBE_MIN_CHAPTER_SECONDS = 10

export type ChapterRefusal = 'nothing' | 'too_many' | 'invalid' | 'title'
export type ChapterPlan = { ok: true; specs: CompositionOpSpec[] } | { ok: false; reason: ChapterRefusal }

/** The shown name of a chapter (an automatic chapter's name comes from the UI: Intro / Outro, its text, its media's name). */
export type ChapterNamer = (chapter: TimelineChapter) => string

type Options = { uuid?: () => string; name: ChapterNamer }

/** One chapter of the layout a gesture asks for: an existing section (or null = a new one), its title and its scenes. */
type Wanted = { sectionId: string | null; title: string; sceneIds: string[] }

const defaultUuid = () => globalThis.crypto.randomUUID()

/** A trimmed title the gateway accepts, or null. */
export function chapterTitle(value: string): string | null {
  const title = value.replace(/\s+/g, ' ').trim()
  return title.length >= 1 && title.length <= CHAPTER_TITLE_MAX_LENGTH ? title : null
}

function planOf(specs: CompositionOpSpec[]): ChapterPlan {
  if (specs.length === 0) return { ok: false, reason: 'nothing' }
  if (specs.length > CHAPTER_MAX_OPS) return { ok: false, reason: 'too_many' }
  return { ok: true, specs }
}

function chapterByKey(model: TimelineModel, key: string): TimelineChapter | undefined {
  return model.chapters.find((chapter) => chapter.key === key)
}

/** A section title fit for the gateway (an automatic name that would not be accepted falls back to a plain one). */
function fitTitle(value: string, fallback: string): string {
  return chapterTitle(value) ?? chapterTitle(fallback) ?? 'Chapter'
}

/**
 * The ops that turn the current chapters into `wanted` (strip order): a `section.insert` for each new chapter (right after
 * the section of the chapter before it), a `section.update` for a new title, a `scene.set_section` for each scene whose
 * chapter changes (a scene without a section keeps none while it stays in the chapter it joins), then `section.remove`
 * for the sections the gesture empties.
 */
function layoutSpecs(document: CompositionDocument, model: TimelineModel, wanted: readonly Wanted[], options: { uuid: () => string; remove?: readonly string[] }): CompositionOpSpec[] {
  const titles = new Map(document.sections.map((section) => [section.section_id, section.title]))
  const effective = new Map<string, string | null>()
  for (const chapter of model.chapters) for (const sceneId of chapter.sceneIds) effective.set(sceneId, chapter.sectionId)
  const sectionOf = new Map(document.scenes.map((scene) => [scene.scene_id, scene.section_id]))
  const inserts: CompositionOpSpec[] = []
  const updates: CompositionOpSpec[] = []
  const moves: CompositionOpSpec[] = []
  let previous: string | null = null
  for (const chapter of wanted) {
    let sectionId = chapter.sectionId
    if (sectionId === null) {
      sectionId = newSectionId(options.uuid())
      inserts.push(sectionInsertSpec({ sectionId, title: chapter.title, afterSectionId: previous }))
    } else if (titles.get(sectionId) !== chapter.title) {
      updates.push(sectionUpdateSpec(sectionId, { title: chapter.title }))
      titles.set(sectionId, chapter.title)
    }
    for (const sceneId of chapter.sceneIds) {
      const shown = effective.get(sceneId) ?? null
      const stored = sectionOf.get(sceneId) ?? null
      if (shown !== sectionId || (stored !== null && stored !== sectionId)) moves.push(sceneSetSectionSpec(sceneId, sectionId))
    }
    previous = sectionId
  }
  const removes = [...new Set(options.remove ?? [])].map((sectionId) => sectionRemoveSpec(sectionId))
  return [...inserts, ...updates, ...moves, ...removes]
}

/** Every chapter as it is shown, as a wanted layout (automatic chapters become new sections named as shown). */
function currentLayout(model: TimelineModel, name: ChapterNamer): Wanted[] {
  return model.chapters.map((chapter) => ({
    sectionId: chapter.sectionId,
    // A section keeps its stored title; an automatic chapter is named as the row shows it.
    title: chapter.title.kind === 'section' ? chapter.title.text : fitTitle(name(chapter), `${chapter.index + 1}`),
    sceneIds: [...chapter.sceneIds],
  }))
}

/** Sections the wanted layout no longer uses but the document's scenes did (to be removed by the same command). */
function emptiedSections(model: TimelineModel, wanted: readonly Wanted[]): string[] {
  const used = new Set(wanted.flatMap((chapter) => (chapter.sectionId !== null && chapter.sceneIds.length > 0 ? [chapter.sectionId] : [])))
  return [...new Set(model.chapters.flatMap((chapter) => (chapter.sectionId !== null && !used.has(chapter.sectionId) ? [chapter.sectionId] : [])))]
}

function finish(document: CompositionDocument, model: TimelineModel, wanted: Wanted[], options: Options): ChapterPlan {
  const kept = wanted.filter((chapter) => chapter.sceneIds.length > 0)
  return planOf(layoutSpecs(document, model, kept, { uuid: options.uuid ?? defaultUuid, remove: emptiedSections(model, kept) }))
}

// ---------------------------------------------------------------- gestures

/** "Make chapters" of a project without sections: one section per automatic chapter, named as shown. One command. */
export function planMakeChapters(document: CompositionDocument, model: TimelineModel, options: Options): ChapterPlan {
  if (!model.autoChapters || model.chapters.length === 0) return { ok: false, reason: 'invalid' }
  return finish(document, model, currentLayout(model, options.name), options)
}

/** Rename (double-click): a section's title; an automatic chapter makes chapters for every scene with this one renamed. */
export function planRenameChapter(document: CompositionDocument, model: TimelineModel, input: { chapterKey: string; title: string }, options: Options): ChapterPlan {
  const chapter = chapterByKey(model, input.chapterKey)
  if (!chapter) return { ok: false, reason: 'invalid' }
  const title = chapterTitle(input.title)
  if (title === null) return { ok: false, reason: 'title' }
  if (chapter.sectionId !== null) {
    const current = document.sections.find((section) => section.section_id === chapter.sectionId)
    if (!current) return { ok: false, reason: 'invalid' }
    return current.title === title ? { ok: false, reason: 'nothing' } : planOf([sectionUpdateSpec(chapter.sectionId, { title })])
  }
  const wanted = currentLayout(model, options.name)
  wanted[chapter.index] = { ...wanted[chapter.index]!, title }
  return finish(document, model, wanted, options)
}

/**
 * "Start chapter at this cut": the scenes of the chapter from the cut on get a new section right after the chapter's own
 * (named `title`). Only inside a chapter of a project with sections (an automatic chapter is one scene: every cut already
 * starts one).
 */
export function planStartChapterAt(document: CompositionDocument, model: TimelineModel, input: { sceneId: string; title: string }, options: Omit<Options, 'name'> & { name?: ChapterNamer }): ChapterPlan {
  const index = model.chapterOf.get(input.sceneId)
  const chapter = index === undefined ? undefined : model.chapters[index]
  if (!chapter || chapter.auto || chapter.sectionId === null) return { ok: false, reason: 'invalid' }
  const at = chapter.sceneIds.indexOf(input.sceneId)
  if (at <= 0) return { ok: false, reason: 'nothing' }
  const title = chapterTitle(input.title)
  if (title === null) return { ok: false, reason: 'title' }
  // A project with sections: every chapter is a section that keeps its title, so no name is needed.
  const name: ChapterNamer = options.name ?? ((candidate) => `${candidate.index + 1}`)
  const wanted = currentLayout(model, name)
  wanted.splice(chapter.index, 1, { ...wanted[chapter.index]!, sceneIds: chapter.sceneIds.slice(0, at) }, { sectionId: null, title, sceneIds: chapter.sceneIds.slice(at) })
  return finish(document, model, wanted, { ...options, name })
}

/** Whether "Start chapter at this cut" applies to the cut into this scene. */
export function canStartChapterAt(model: TimelineModel, sceneId: string): boolean {
  const index = model.chapterOf.get(sceneId)
  const chapter = index === undefined ? undefined : model.chapters[index]
  return chapter !== undefined && !chapter.auto && chapter.sceneIds.indexOf(sceneId) > 0
}

/**
 * The edge between chapter `leftIndex` and the next one dragged to the cut before scene `sceneIndex` (strip index): the
 * scenes in between change chapter. Each side keeps at least one scene (the target is clamped).
 */
export function planMoveChapterEdge(document: CompositionDocument, model: TimelineModel, input: { leftIndex: number; sceneIndex: number }, options: Options): ChapterPlan {
  const left = model.chapters[input.leftIndex]
  const right = model.chapters[input.leftIndex + 1]
  if (!left || !right) return { ok: false, reason: 'invalid' }
  const first = model.mainById.get(left.sceneIds[0]!)!.index
  const last = model.mainById.get(right.sceneIds[right.sceneIds.length - 1]!)!.index
  const target = Math.min(Math.max(input.sceneIndex, first + 1), last)
  const current = model.mainById.get(right.sceneIds[0]!)!.index
  if (target === current) return { ok: false, reason: 'nothing' }
  const span = model.main.slice(first, last + 1).map((block) => block.sceneId)
  const wanted = currentLayout(model, options.name)
  wanted[left.index] = { ...wanted[left.index]!, sceneIds: span.slice(0, target - first) }
  wanted[right.index] = { ...wanted[right.index]!, sceneIds: span.slice(target - first) }
  // An automatic project: only the two chapters change, the others stay one scene each (all become sections).
  return finish(document, model, wanted, options)
}

/** The strip index of the scene a chapter edge dragged to `frame` starts the right chapter at (the nearest cut). */
export function chapterEdgeTarget(model: TimelineModel, frame: number): number {
  let best = 1
  let distance = Number.POSITIVE_INFINITY
  for (let index = 1; index < model.main.length; index += 1) {
    const d = Math.abs(model.main[index]!.startFrame - frame)
    if (d < distance) {
      best = index
      distance = d
    }
  }
  return best
}

/** "Merge with next": the next chapter's scenes join this one (its section goes when nothing else uses it). */
export function planMergeChapterWithNext(document: CompositionDocument, model: TimelineModel, input: { chapterKey: string }, options: Options): ChapterPlan {
  const chapter = chapterByKey(model, input.chapterKey)
  const next = chapter ? model.chapters[chapter.index + 1] : undefined
  if (!chapter || !next) return { ok: false, reason: 'invalid' }
  const wanted = currentLayout(model, options.name)
  wanted[chapter.index] = { ...wanted[chapter.index]!, sceneIds: [...chapter.sceneIds, ...next.sceneIds] }
  wanted[next.index] = { ...wanted[next.index]!, sceneIds: [] }
  return finish(document, model, wanted, options)
}

/**
 * "Delete chapter": its scenes join the chapter before it (the first chapter's join the one after it) and its section is
 * removed; every other run of the same section joins its own neighbour too. The only chapter: its scenes keep no section.
 */
export function planDeleteChapter(document: CompositionDocument, model: TimelineModel, input: { chapterKey: string }, options: Options): ChapterPlan {
  const chapter = chapterByKey(model, input.chapterKey)
  if (!chapter) return { ok: false, reason: 'invalid' }
  if (model.chapters.length === 1) {
    if (chapter.sectionId === null) return { ok: false, reason: 'nothing' }
    const sectionOf = new Map(document.scenes.map((scene) => [scene.scene_id, scene.section_id]))
    const specs = chapter.sceneIds.filter((sceneId) => sectionOf.get(sceneId) !== null).map((sceneId) => sceneSetSectionSpec(sceneId, null))
    return planOf([...specs, sectionRemoveSpec(chapter.sectionId)])
  }
  const wanted = currentLayout(model, options.name)
  const doomed = chapter.sectionId === null ? [chapter] : model.chapters.filter((candidate) => candidate.sectionId === chapter.sectionId)
  const gone = new Set(doomed.map((candidate) => candidate.index))
  for (const run of doomed) {
    // The nearest chapter before the run that stays (else the nearest after it).
    let home = -1
    for (let index = run.index - 1; index >= 0; index -= 1) if (!gone.has(index)) {
      home = index
      break
    }
    if (home < 0) for (let index = run.index + 1; index < model.chapters.length; index += 1) if (!gone.has(index)) {
      home = index
      break
    }
    if (home < 0) return { ok: false, reason: 'invalid' }
    const target = wanted[home]!
    wanted[home] = { ...target, sceneIds: home < run.index ? [...target.sceneIds, ...run.sceneIds] : [...run.sceneIds, ...target.sceneIds] }
    wanted[run.index] = { ...wanted[run.index]!, sceneIds: [] }
  }
  return finish(document, model, wanted, options)
}

// ---------------------------------------------------------------- YouTube chapters

/** `m:ss` (or `h:mm:ss` from an hour) of a play frame, the format YouTube reads in a description. */
export function youtubeTime(frame: number, fps: { num: number; den: number }): string {
  const total = Math.max(0, Math.floor((frame * fps.den) / fps.num))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

export type YoutubeChapters = {
  /** One `0:00 Intro` line per chapter. */
  text: string
  /** Chapters shorter than YouTube's 10 s (YouTube then shows no chapters). */
  short: string[]
  /** YouTube needs at least three chapters. */
  tooFew: boolean
}

/** The chapter list for a YouTube description, on the playback clock (what the export renders). */
export function youtubeChapters(model: TimelineModel, name: ChapterNamer): YoutubeChapters {
  const lines: string[] = []
  const short: string[] = []
  model.chapters.forEach((chapter, index) => {
    const title = name(chapter)
    const start = index === 0 ? 0 : chapter.playStartFrame
    const end = model.chapters[index + 1]?.playStartFrame ?? model.playTotalFrames
    lines.push(`${youtubeTime(start, model.fps)} ${title}`)
    if ((end - start) / model.rate < YOUTUBE_MIN_CHAPTER_SECONDS) short.push(title)
  })
  return { text: lines.join('\n'), short, tooFew: model.chapters.length < 3 }
}
