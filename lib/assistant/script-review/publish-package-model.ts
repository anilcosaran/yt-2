import {
  type PublishPackageField,
  type PublishPackagePatch,
  type PublishPackageView,
  type PublishStaleReason,
  type PublishThumbnail,
} from './publish-package-api'
import { formatClock } from './script-review-model'

/**
 * P04-21 pure model of the "Yayın paketi" section (KARAR-VIDEO-BRIEF §12A, K293): what the panel shows of the job's
 * package (title options with the selected one, description, tags, the thumbnail with its source, reason and cost,
 * chapter times, and which fields are stale and why) and the typed partial revisions an edit becomes. Nothing here
 * decides anything: the owner's answer is the truth, the panel keeps no local copy of the package.
 */

/** The package limits the panel guards before the request (the owner re-checks every one). */
export const PUBLISH_LIMITS = { titleChars: 100, descriptionChars: 5000, tagChars: 100, tagsMax: 30, tagsTotalChars: 500 } as const

export interface PublishTitleRow {
  titleId: string
  text: string
  selected: boolean
}

export type PublishThumbnailDetail =
  | { kind: 'frame'; sceneId: string; atSeconds: number }
  | { kind: 'image'; resourceId: string }
  | { kind: 'generation'; prompt: string }

export interface PublishThumbnailRow {
  source: PublishThumbnail['source']
  reason: string
  titleText: string
  detail: PublishThumbnailDetail | null
  cost: { status: 'free' | 'priced' | 'not_ready'; credits: number | null }
}

export interface PublishChapterRow {
  chapterId: string
  /** `m:ss` of the chapter start (server-derived from the script). */
  startLabel: string
  title: string
}

export interface PublishPackageModel {
  revision: number
  origin: 'agent' | 'user'
  titles: PublishTitleRow[]
  description: string
  tags: string[]
  thumbnail: PublishThumbnailRow
  /** Absent on a short video. */
  chapters: PublishChapterRow[] | null
  /** Fields whose basis moved, with the reasons (an owner answer, never a local guess). */
  stale: ReadonlyMap<PublishPackageField, readonly PublishStaleReason[]>
}

export function buildPublishPackageModel(view: PublishPackageView): PublishPackageModel {
  const body = view.body
  const thumbnail = body.thumbnail
  const detail: PublishThumbnailDetail | null = thumbnail.frame
    ? { kind: 'frame', sceneId: thumbnail.frame.scene_id, atSeconds: thumbnail.frame.at_seconds }
    : thumbnail.image
      ? { kind: 'image', resourceId: thumbnail.image.resource_id }
      : thumbnail.generation
        ? { kind: 'generation', prompt: thumbnail.generation.prompt }
        : null
  return {
    revision: view.revision,
    origin: view.origin,
    titles: body.titles.options.map((option) => ({ titleId: option.title_id, text: option.text, selected: option.title_id === body.titles.selected_title_id })),
    description: body.description,
    tags: body.tags,
    thumbnail: {
      source: thumbnail.source,
      reason: thumbnail.reason,
      titleText: thumbnail.title_text ?? '',
      detail,
      cost: { status: thumbnail.cost.status, credits: thumbnail.cost.credits ?? null },
    },
    chapters: body.chapters ? body.chapters.map((chapter) => ({ chapterId: chapter.chapter_id, startLabel: formatClock(chapter.start_seconds) ?? '0:00', title: chapter.title })) : null,
    stale: new Map(view.stale_fields.map((item) => [item.field, item.reasons.filter((reason): reason is PublishStaleReason => reason === 'script_changed' || reason === 'shot_plan_changed' || reason === 'transcript_changed')])),
  }
}

/** The reasons a field is stale, or an empty list when it is fresh. */
export function staleReasonsOf(model: PublishPackageModel, field: PublishPackageField): readonly PublishStaleReason[] {
  return model.stale.get(field) ?? []
}

function fold(value: string): string {
  return value.toLocaleLowerCase('tr').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * The tags a comma or line separated text stands for: trimmed, without the characters the owner refuses (`,` `<` `>`), no
 * repeat (compared folded), each within its limit, at most the limit of tags and of characters together.
 */
export function parseTags(text: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  let total = 0
  for (const raw of text.split(/[,\n]/)) {
    const tag = raw.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, PUBLISH_LIMITS.tagChars)
    if (!tag || seen.has(fold(tag))) continue
    if (tags.length >= PUBLISH_LIMITS.tagsMax || total + tag.length + (tags.length > 0 ? 1 : 0) > PUBLISH_LIMITS.tagsTotalChars) break
    seen.add(fold(tag))
    tags.push(tag)
    total += tag.length + (tags.length > 1 ? 1 : 0)
  }
  return tags
}

export function tagsText(tags: readonly string[]): string {
  return tags.join(', ')
}

/** The typed edits of the section; each becomes one partial revision built on the newest view. */
export type PublishPackageEdit =
  | { kind: 'select_title'; titleId: string }
  | { kind: 'title_text'; titleId: string; text: string }
  | { kind: 'description'; text: string }
  | { kind: 'tags'; text: string }
  | { kind: 'thumbnail_text'; text: string }
  | { kind: 'chapter_title'; chapterId: string; text: string }

/** Which field of the package an edit rewrites (and so makes fresh). */
export function fieldOfEdit(edit: PublishPackageEdit): PublishPackageField {
  switch (edit.kind) {
    case 'select_title':
    case 'title_text':
      return 'titles'
    case 'description':
      return 'description'
    case 'tags':
      return 'tags'
    case 'thumbnail_text':
      return 'thumbnail'
    case 'chapter_title':
      return 'chapters'
  }
}

/** A key that names the edit, so a retried click or blur of the same edit replays with the same idempotency key. */
export function editKey(edit: PublishPackageEdit): string {
  return JSON.stringify(edit)
}

export type PublishPackagePatchResult =
  | { ok: true; patch: PublishPackagePatch }
  /** Nothing to write (the edit is what the package already says) or the edit cannot be written. */
  | { ok: false; reason: 'unchanged' | 'unknown_target' | 'empty_text' | 'empty_tags' }

/** The partial revision of one edit on the newest view; the server derives the cost, the basis and the origin. */
export function patchOfEdit(view: PublishPackageView, edit: PublishPackageEdit): PublishPackagePatchResult {
  const body = view.body
  switch (edit.kind) {
    case 'select_title': {
      if (!body.titles.options.some((option) => option.title_id === edit.titleId)) return { ok: false, reason: 'unknown_target' }
      if (body.titles.selected_title_id === edit.titleId) return { ok: false, reason: 'unchanged' }
      return { ok: true, patch: { selected_title_id: edit.titleId } }
    }
    case 'title_text': {
      const text = edit.text.trim().slice(0, PUBLISH_LIMITS.titleChars)
      const option = body.titles.options.find((candidate) => candidate.title_id === edit.titleId)
      if (!option) return { ok: false, reason: 'unknown_target' }
      if (!text) return { ok: false, reason: 'empty_text' }
      if (option.text === text) return { ok: false, reason: 'unchanged' }
      return {
        ok: true,
        patch: {
          titles: {
            options: body.titles.options.map((candidate) => ({ title_id: candidate.title_id, text: candidate.title_id === edit.titleId ? text : candidate.text })),
            selected_title_id: body.titles.selected_title_id,
          },
        },
      }
    }
    case 'description': {
      const text = edit.text.trim().slice(0, PUBLISH_LIMITS.descriptionChars)
      if (!text) return { ok: false, reason: 'empty_text' }
      return text === body.description ? { ok: false, reason: 'unchanged' } : { ok: true, patch: { description: text } }
    }
    case 'tags': {
      const tags = parseTags(edit.text)
      if (tags.length === 0 && body.tags.length === 0) return { ok: false, reason: 'unchanged' }
      return tags.join('\n') === body.tags.join('\n') ? { ok: false, reason: 'unchanged' } : { ok: true, patch: { tags } }
    }
    case 'thumbnail_text': {
      const text = edit.text.trim().slice(0, PUBLISH_LIMITS.titleChars)
      const previous = body.thumbnail.title_text ?? ''
      // The cost is the server's: it is never part of a request.
      const rest = Object.fromEntries(Object.entries(body.thumbnail).filter(([key]) => key !== 'cost' && key !== 'title_text'))
      if (previous === text) return { ok: false, reason: 'unchanged' }
      return { ok: true, patch: { thumbnail: { ...rest, ...(text ? { title_text: text } : {}) } as PublishPackagePatch['thumbnail'] } }
    }
    case 'chapter_title': {
      const chapters = body.chapters
      const text = edit.text.trim().slice(0, PUBLISH_LIMITS.titleChars)
      if (!chapters || !chapters.some((chapter) => chapter.chapter_id === edit.chapterId)) return { ok: false, reason: 'unknown_target' }
      if (!text) return { ok: false, reason: 'empty_text' }
      if (chapters.find((chapter) => chapter.chapter_id === edit.chapterId)!.title === text) return { ok: false, reason: 'unchanged' }
      return { ok: true, patch: { chapters: chapters.map((chapter) => ({ ...chapter, title: chapter.chapter_id === edit.chapterId ? text : chapter.title })) } }
    }
  }
}

/**
 * The plan's own name of a scene the thumbnail names: the 1-based order of the shot that starts it (`S4` in the Plan view),
 * or null when the shots do not say (the panel then shows nothing rather than an internal id).
 */
export function sceneOrderOf(sceneId: string, shots: ReadonlyArray<{ order: number; beat_ids: readonly string[]; scene_id?: unknown }> | null): number | null {
  if (!shots) return null
  const explicit = shots.find((shot) => shot.scene_id === sceneId)
  if (explicit) return explicit.order
  const derived = shots.find((shot) => shot.beat_ids.length > 0 && `scene-${shot.beat_ids[0]}` === sceneId)
  return derived ? derived.order : null
}

/** The text to store when a field loses focus: the draft, only when it says something other than the owner's text. */
export function draftToCommit(draft: string, value: string): string | null {
  return draft.trim() === value ? null : draft
}

/**
 * The draft after the owner's text changed from `previous` to `next`: it follows the owner when the user has not typed on
 * top of it (or typed exactly what the owner now says, trimmed), and keeps the user's typing otherwise.
 */
export function resyncDraft(draft: string, previous: string, next: string): string {
  return draft === previous || draft.trim() === next ? next : draft
}
