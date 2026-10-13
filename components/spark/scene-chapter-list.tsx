'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { CompositionDocument } from '@/lib/spark/composition-client'
import type { SparkCompositionActions } from '@/lib/spark/composition-session'
import type { OutlineThumbnails } from '@/lib/spark/outline/outline-thumbnails'
import { sceneStatus } from '@/lib/spark/scene-status'
import { planRenameChapter, type ChapterPlan } from '@/lib/spark/timeline/timeline-chapter-edits'
import { planMainReorder } from '@/lib/spark/timeline/timeline-edits'
import { formatTimelineTime } from '@/lib/spark/timeline/timeline-geometry'
import { buildTimelineModel, type TimelineChapter, type TimelineMainBlock } from '@/lib/spark/timeline/timeline-model'

import { chapterColor, useChapterNamer } from './timeline/timeline-chapters'
import './timeline/timeline.css'
import { Icon, formatDuration } from './tools/studio-parts'

/**
 * Timeline v3 left panel (coordinator decision, owner feedback 2026-10-03): the Scenes list of the previous design with the
 * chapters as plain headings ("● INTRO · 0:00", a pencil on hover renames). No collapsing, tints, menus or section
 * dragging: chapter editing lives in the timeline's chapter row. Dragging a scene card past a heading moves it into that
 * chapter (one command: `scene.reorder` + `scene.set_section`); "Add scene" (the shell's footer) adds to the selected
 * scene's chapter. Replaces the Outline while `SPARK_TIMELINE_EDITING_ENABLED` is on.
 */

type DropTarget = { kind: 'scene'; sceneId: string; after: boolean } | { kind: 'chapter'; chapterKey: string }

export type SceneChapterListProps = {
  document: CompositionDocument
  selectedSceneId: string | null
  canWrite: boolean
  writeTitle: string | undefined
  actions: SparkCompositionActions
  /** Delivery thumbnails of the scenes' media (null: none, the cards keep their placeholder). */
  thumbnails: OutlineThumbnails | null
  mediaName?: (storageObjectId: string) => string | null
  onNotice: (text: string) => void
  /** Test seam for new section ids. */
  uuid?: () => string
}

export function SceneChapterList({ document, selectedSceneId, canWrite, writeTitle, actions, thumbnails, mediaName, onNotice, uuid }: SceneChapterListProps) {
  const t = useTranslations('Spark.editor')
  const t3 = useTranslations('Spark.editor.timelineV3')
  const tStatus = useTranslations('Spark.editor.sceneStatus')
  const model = React.useMemo(() => buildTimelineModel(document), [document])
  const name = useChapterNamer(mediaName)
  const [dragFrom, setDragFrom] = React.useState<string | null>(null)
  const [dropAt, setDropAt] = React.useState<DropTarget | null>(null)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const comingSoon = t('comingSoon')

  const clearDrag = () => {
    setDragFrom(null)
    setDropAt(null)
  }
  /** A card dropped before / after a card, or on a heading: it lands there and joins that chapter, as one command. */
  const drop = (target: DropTarget) => {
    const from = dragFrom
    clearDrag()
    if (!from || !canWrite) return
    let insertIndex: number
    let chapter: TimelineChapter | null
    if (target.kind === 'chapter') {
      chapter = model.chapters.find((candidate) => candidate.key === target.chapterKey) ?? null
      const first = chapter ? model.mainById.get(chapter.sceneIds[0]!) : undefined
      if (!chapter || !first) return
      insertIndex = first.index
    } else {
      const block = model.mainById.get(target.sceneId)
      if (!block) return
      insertIndex = block.index + (target.after ? 1 : 0)
      const index = model.chapterOf.get(target.sceneId)
      chapter = index === undefined ? null : (model.chapters[index] ?? null)
    }
    const plan = planMainReorder(model, { sceneIds: [from], insertIndex, ...(chapter && !chapter.auto && { sectionId: chapter.sectionId }) })
    if (plan.ok) void actions.apply(plan.specs)
  }
  const send = (plan: ChapterPlan) => {
    if (plan.ok) void actions.apply(plan.specs)
    else if (plan.reason !== 'nothing') onNotice(t3(`chapters.refusals.${plan.reason}`))
  }
  const rename = (chapterKey: string, value: string) => {
    setRenaming(null)
    if (!canWrite) return
    send(planRenameChapter(document, model, { chapterKey, title: value }, { name, ...(uuid && { uuid }) }))
  }

  const sceneCard = (block: TimelineMainBlock) => {
    const sceneId = block.sceneId
    const scene = document.scenes.find((candidate) => candidate.scene_id === sceneId)
    const on = sceneId === selectedSceneId
    const classes = ['scene-item']
    if (on) classes.push('on')
    if (dragFrom === sceneId) classes.push('dragging')
    if (dropAt?.kind === 'scene' && dropAt.sceneId === sceneId) classes.push(dropAt.after ? 'drop-after' : 'drop-before')
    const seconds = block.resolved ? block.lengthFrames / model.rate : null
    const status = scene ? sceneStatus(scene) : null
    const statusText = status ? status.reasons.map((reason) => tStatus(`reasons.${reason}`)).join(', ') : null
    const cardLabel = t('sceneCardLabel', { n: block.index + 1, total: model.main.length, duration: formatDuration(seconds) })
    return (
      <div
        key={sceneId}
        className={classes.join(' ')}
        role="button"
        tabIndex={0}
        aria-pressed={on}
        aria-label={statusText ? t('sceneStatus.cardLabel', { label: cardLabel, status: statusText }) : cardLabel}
        draggable={canWrite}
        title={canWrite ? t('dragToReorder') : undefined}
        data-scene-card={sceneId}
        onClick={() => actions.select(sceneId)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          actions.select(sceneId)
        }}
        onDragStart={(event) => {
          if (!canWrite) return
          setDragFrom(sceneId)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', sceneId)
        }}
        onDragOver={(event) => {
          if (!dragFrom) return
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          const after = event.clientY >= rect.top + rect.height / 2
          if (dropAt?.kind !== 'scene' || dropAt.sceneId !== sceneId || dropAt.after !== after) setDropAt({ kind: 'scene', sceneId, after })
        }}
        onDrop={(event) => {
          if (!dragFrom) return
          event.preventDefault()
          drop({ kind: 'scene', sceneId, after: dropAt?.kind === 'scene' && dropAt.sceneId === sceneId ? dropAt.after : false })
        }}
        onDragEnd={clearDrag}
      >
        <div className="si-num">{block.index + 1}</div>
        <div>
          <SceneThumb block={block} thumbnails={thumbnails} />
          <div className="si-meta">
            <span className="si-name">{t('sceneName', { n: block.index + 1 })}</span>
            <span className="si-dur">
              {status && statusText ? <span className={`st-dot${status.tone === 'attention' ? ' warn' : ''}`} title={statusText} aria-hidden /> : null}
              {formatDuration(seconds)}
            </span>
          </div>
        </div>
        <div className="si-tools">
          <button type="button" disabled title={`${t('duplicateScene')} · ${comingSoon}`} aria-label={t('duplicateScene')}>
            <Icon name="dup" size="sm" />
          </button>
          <button
            type="button"
            disabled={!canWrite}
            title={writeTitle ?? t('deleteScene')}
            aria-label={t('deleteScene')}
            onClick={(event) => {
              event.stopPropagation()
              void actions.removeScene(sceneId)
            }}
          >
            <Icon name="trash" size="sm" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sc-list" data-scene-chapters>
      {model.chapters.map((chapter) => {
        const label = name(chapter)
        const time = formatTimelineTime(chapter.playStartFrame, model.fps)
        const over = dropAt?.kind === 'chapter' && dropAt.chapterKey === chapter.key
        return (
          <React.Fragment key={chapter.key}>
            <div
              className={`sc-chapter${chapter.auto ? ' auto' : ''}${over ? ' drop-on' : ''}`}
              style={{ '--tl-chapter': chapterColor(chapter.colorIndex) } as React.CSSProperties}
              data-chapter-heading={chapter.key}
              onDragOver={(event) => {
                if (!dragFrom) return
                event.preventDefault()
                if (!over) setDropAt({ kind: 'chapter', chapterKey: chapter.key })
              }}
              onDrop={(event) => {
                if (!dragFrom) return
                event.preventDefault()
                drop({ kind: 'chapter', chapterKey: chapter.key })
              }}
            >
              <i className="dot" aria-hidden />
              {renaming === chapter.key ? (
                <HeadingRenameInput initial={label} label={t3('chapters.rename')} onCommit={(value) => rename(chapter.key, value)} onCancel={() => setRenaming(null)} />
              ) : (
                <>
                  <span className="nm" title={label}>
                    {label}
                  </span>
                  <span className="t">· {time}</span>
                  {canWrite ? (
                    <button type="button" className="edit" title={t3('chapters.rename')} aria-label={t3('chapters.renameNamed', { name: label })} onClick={() => setRenaming(chapter.key)}>
                      <Icon name="edit" size="sm" />
                    </button>
                  ) : null}
                </>
              )}
            </div>
            {chapter.sceneIds.map((sceneId) => {
              const block = model.mainById.get(sceneId)
              return block ? sceneCard(block) : null
            })}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/** A heading's name field: Enter or leaving it saves, Escape cancels. */
function HeadingRenameInput({ initial, label, onCommit, onCancel }: { initial: string; label: string; onCommit: (value: string) => void; onCancel: () => void }) {
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
      className="sc-chapter-input"
      aria-label={label}
      value={value}
      maxLength={200}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') finish(true)
        else if (event.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
    />
  )
}

/**
 * A scene card's 16:9 picture: the delivery thumbnail of its media (asked for once the card is on screen), a title card of
 * the first text for graphics, or the media kind's icon while there is no picture.
 */
function SceneThumb({ block, thumbnails }: { block: TimelineMainBlock; thumbnails: OutlineThumbnails | null }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const objectId = block.picture?.storageObjectId ?? null
  const [visible, setVisible] = React.useState(() => typeof IntersectionObserver === 'undefined')
  React.useEffect(() => {
    const element = ref.current
    if (!element || !objectId || visible || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [objectId, visible])
  const subscribe = React.useCallback((listener: () => void) => (thumbnails ? thumbnails.subscribe(listener) : () => undefined), [thumbnails])
  const version = React.useSyncExternalStore(subscribe, () => thumbnails?.getVersion() ?? 0, () => 0)
  React.useEffect(() => {
    if (visible && objectId) thumbnails?.request(objectId)
  }, [thumbnails, objectId, visible, version])
  const url = objectId && thumbnails ? thumbnails.url(objectId) : null
  return (
    <div className="thumb" ref={ref}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage thumbnail URL, not a static asset
        <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : !block.picture && block.label.kind === 'text' ? (
        <span className="sc-card">
          <span>{block.label.text}</span>
        </span>
      ) : block.picture ? (
        <span className="sc-kind">
          <Icon name={block.picture.mediaKind === 'video' ? 'video' : 'image'} size="sm" />
        </span>
      ) : null}
    </div>
  )
}
