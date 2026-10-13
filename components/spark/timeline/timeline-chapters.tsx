'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { formatTimelineTime, inWindow } from '@/lib/spark/timeline/timeline-geometry'
import type { TimelineChapter, TimelineModel } from '@/lib/spark/timeline/timeline-model'

/**
 * Spark timeline v3: the chapter row (the YouTube-chapter look of the previous design's pace bars). Each chapter is a 3 px
 * coloured bar over its scenes with its name and start time (both hide when the chapter is narrow); automatic chapters of a
 * project without sections are muted. A pure render: the timeline handles the gestures through `data-gesture`
 * (`chapter` = click jumps and selects the first scene, double-click renames; `chapter-edge` = drag the edge between two
 * chapters) and the context menu (`ChapterMenu`).
 */

/** The chapter palette (the previous design's SECTION_COLORS order). */
export const CHAPTER_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899', '#14b8a6', '#eab308'] as const

export function chapterColor(index: number): string {
  return CHAPTER_COLORS[((index % CHAPTER_COLORS.length) + CHAPTER_COLORS.length) % CHAPTER_COLORS.length]!
}

/**
 * The shown name of a chapter in the editor's language: a section's title; an automatic chapter's "Intro" / "Outro", first
 * text, media name (`mediaName`, read at call time) or "Scene n". The returned function is stable between renders.
 */
export function useChapterNamer(mediaName?: (storageObjectId: string) => string | null): (chapter: TimelineChapter) => string {
  const t = useTranslations('Spark.editor.timelineV3.chapters')
  const mediaNameRef = React.useRef(mediaName)
  React.useLayoutEffect(() => {
    mediaNameRef.current = mediaName
  })
  return React.useCallback(
    (chapter: TimelineChapter): string => {
      const title = chapter.title
      switch (title.kind) {
        case 'section':
        case 'text':
          return title.text
        case 'intro':
          return t('intro')
        case 'outro':
          return t('outro')
        case 'media':
          return mediaNameRef.current?.(title.storageObjectId) ?? t('scene', { n: title.n })
        case 'scene':
          return t('scene', { n: title.n })
      }
    },
    [t],
  )
}

export type ChapterRowProps = {
  model: TimelineModel
  window: { startFrame: number; endFrame: number }
  /** The shown name of a chapter (stable between renders). */
  name: (chapter: TimelineChapter) => string
  /** The chapter being renamed (an input in place of its name), or null. */
  renaming: string | null
  /** The chapter of the selected scene (highlighted). */
  current: string | null
  canWrite: boolean
  onRenameCommit: (chapterKey: string, value: string) => void
  onRenameCancel: () => void
}

export const ChapterRow = React.memo(function ChapterRow({ model, window, name, renaming, current, canWrite, onRenameCommit, onRenameCancel }: ChapterRowProps) {
  const t = useTranslations('Spark.editor.timelineV3')
  const edges = canWrite && !model.autoChapters ? model.chapters.slice(1) : []
  return (
    <>
      {model.chapters
        .filter((chapter) => inWindow(window, chapter.startFrame, chapter.endFrame))
        .map((chapter) => {
          const label = name(chapter)
          const time = formatTimelineTime(chapter.playStartFrame, model.fps)
          const classes = ['tl3-chapter']
          if (chapter.auto) classes.push('auto')
          if (current === chapter.key) classes.push('on')
          return (
            <div
              key={chapter.key}
              className={classes.join(' ')}
              data-gesture="chapter"
              data-chapter={chapter.key}
              data-scene={chapter.sceneIds[0]}
              role="button"
              tabIndex={-1}
              aria-label={t(chapter.auto ? 'chapters.autoLabel' : 'chapters.label', { name: label, time })}
              title={chapter.auto ? t('chapters.autoTitle', { name: label, time }) : `${label} · ${time}`}
              style={{ '--s': chapter.startFrame, '--l': chapter.endFrame - chapter.startFrame, '--tl-chapter': chapterColor(chapter.colorIndex) } as React.CSSProperties}
            >
              <i className="bar" aria-hidden />
              {renaming === chapter.key ? (
                <ChapterRenameInput initial={label} label={t('chapters.rename')} onCommit={(value) => onRenameCommit(chapter.key, value)} onCancel={onRenameCancel} />
              ) : (
                <>
                  <span className="nm">{label}</span>
                  <span className="t">{time}</span>
                </>
              )}
            </div>
          )
        })}
      {edges
        .filter((chapter) => inWindow(window, chapter.startFrame - 1, chapter.startFrame + 1))
        .map((chapter) => (
          <span
            key={`edge:${chapter.key}`}
            className="tl3-chapter-edge"
            data-gesture="chapter-edge"
            data-left={chapter.index - 1}
            title={t('chapters.dragEdge')}
            style={{ '--s': chapter.startFrame } as React.CSSProperties}
          />
        ))}
    </>
  )
})

/** The name field of a chapter being renamed: Enter or leaving it saves, Escape cancels. */
function ChapterRenameInput({ initial, label, onCommit, onCancel }: { initial: string; label: string; onCommit: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = React.useState(initial)
  const done = React.useRef(false)
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    ref.current?.select()
  }, [])
  const finish = (commit: boolean) => {
    if (done.current) return
    done.current = true
    if (commit) onCommit(value)
    else onCancel()
  }
  return (
    <input
      ref={ref}
      className="tl3-chapter-input"
      aria-label={label}
      value={value}
      maxLength={200}
      onChange={(event) => setValue(event.target.value)}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') finish(true)
        else if (event.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
    />
  )
}

export type ChapterMenuItem = 'rename' | 'makeChapters' | 'startAtCut' | 'mergeNext' | 'delete' | 'copyYoutube'

/** The chapter row's context menu: one command per item (Copy only writes the clipboard). */
export function ChapterMenu({
  x,
  y,
  items,
  disabled,
  onPick,
}: {
  x: number
  y: number
  items: readonly ChapterMenuItem[]
  disabled: ReadonlySet<ChapterMenuItem>
  onPick: (item: ChapterMenuItem) => void
}) {
  const t = useTranslations('Spark.editor.timelineV3.chapters.menu')
  return (
    <div className="tl2-menu" role="menu" style={{ left: x, top: y }} data-chapter-menu>
      {items.map((item) => (
        <button key={item} type="button" role="menuitem" disabled={disabled.has(item)} onClick={() => onPick(item)} data-chapter-item={item}>
          {t(item)}
        </button>
      ))}
    </div>
  )
}
