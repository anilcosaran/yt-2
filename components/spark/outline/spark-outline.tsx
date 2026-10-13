'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { newSectionId, type CompositionDocument } from '@/lib/spark/composition-client'
import type { SparkCompositionActions } from '@/lib/spark/composition-session'
import {
  OUTLINE_MAX_OPS,
  SECTION_TITLE_MAX_LENGTH,
  buildOutline,
  clipStepTarget,
  groupStepTarget,
  nextSectionGroup,
  planAddSection,
  planAddSections,
  planClipMove,
  planDeleteSection,
  planGroupMove,
  planMergeWithNext,
  planRename,
  type ClipDropTarget,
  type Outline,
  type OutlineClip,
  type OutlineGroup,
  type OutlinePlan,
} from '@/lib/spark/outline/outline-model'
import { OutlineThumbnails, storageThumbnailResolver, type OutlineThumbnailResolver } from '@/lib/spark/outline/outline-thumbnails'

import { clampMenuPosition } from '../spark-quick-ai'
import { Icon, formatDuration, formatSeconds } from '../tools/studio-parts'
import './spark-outline.css'

/** What one drag carries (also the keyboard's Alt+↑/↓ moves go through the same plans). */
type Drag = { kind: 'clip'; sceneId: string } | { kind: 'group'; groupKey: string }
type DropAt =
  | { kind: 'clip'; groupKey: string; index: number; at: { sceneId: string; after: boolean } | 'head' | 'empty' }
  | { kind: 'group'; beforeKey: string | null; mark: { groupKey: string; after: boolean } }

type Editing = { sectionId: string; groupKey: string; value: string }

const DRAG_TYPE = 'application/x-spark-outline'
const MENU_SIZE = { width: 220, height: 200 }

export type SparkOutlineProps = {
  document: CompositionDocument
  selectedSceneId: string | null
  canWrite: boolean
  writeTitle?: string
  actions: Pick<SparkCompositionActions, 'select' | 'apply' | 'removeScene'>
  /** The project's channel: the Storage delivery path of the clip thumbnails. */
  channelId: string
  /** Click on a clip selects it AND moves the playhead to its start. */
  onSeekScene?: (sceneId: string) => void
  /** A gesture that cannot become one command (too many clips) says why. */
  onNotice?: (text: string) => void
  /** Replaces the Storage thumbnail path (tests). */
  thumbnails?: OutlineThumbnailResolver
  /** The file name of a Storage object the editor knows (the label after the first text). */
  mediaNameOf?: (storageObjectId: string) => string | null
  /** UUID source of new section ids (tests); `crypto.randomUUID` by default. */
  createId?: () => string
}

/**
 * Timeline v2 P1-C, the left "Outline" panel (replaces the scene list while the timeline editing switch is on): sections
 * with their role tint, title (double-click or F2 renames), start and length, collapse and a menu (add before / after,
 * merge with next, delete), the clips under each section (thumbnail, label, length, status dot) and an "Unsorted" run
 * for clips without a section. Dragging a clip within or between sections, or a section header with its clips, is ONE
 * command; so is "Add sections" of a project without any. Alt+↑/↓ does the same moves from the keyboard. Every edit is
 * applied locally first when the editor is optimistic (P1-D).
 */
export function SparkOutline({
  document,
  selectedSceneId,
  canWrite,
  writeTitle,
  actions,
  channelId,
  onSeekScene,
  onNotice,
  thumbnails,
  mediaNameOf,
  createId,
}: SparkOutlineProps) {
  const t = useTranslations('Spark.editor.outline')
  const editorT = useTranslations('Spark.editor')
  const statusT = useTranslations('Spark.editor.sceneStatus')
  const outline = React.useMemo(() => buildOutline(document), [document])
  const board = React.useMemo(() => new OutlineThumbnails(thumbnails ?? storageThumbnailResolver(channelId)), [thumbnails, channelId])
  const rootRef = React.useRef<HTMLDivElement>(null)
  const focusAfter = React.useRef<string | null>(null)
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set())
  // The header being renamed: one run's header even when the section shows as several runs.
  const [editing, setEditing] = React.useState<Editing | null>(null)
  const editingRef = React.useRef<Editing | null>(null)
  const [pendingRename, setPendingRename] = React.useState<string | null>(null)
  const [menu, setMenu] = React.useState<{ groupKey: string; x: number; y: number } | null>(null)
  const dragRef = React.useRef<Drag | null>(null)
  const [drag, setDrag] = React.useState<Drag | null>(null)
  const [dropAt, setDropAt] = React.useState<DropAt | null>(null)
  const uuid = createId ?? (() => globalThis.crypto.randomUUID())

  // A section the user just added opens its name for typing as soon as it is in the outline (never over a name the user is
  // typing elsewhere: it waits until that one is saved or cancelled).
  const created = pendingRename && editing === null ? outline.groups.find((group) => group.sectionId === pendingRename) : undefined
  if (created) {
    setPendingRename(null)
    setEditing({ sectionId: created.sectionId!, groupKey: created.key, value: created.title })
  }
  React.useEffect(() => {
    editingRef.current = editing
  }, [editing])

  // Keyboard moves keep the focus on what moved (it may now render under another section).
  React.useLayoutEffect(() => {
    const selector = focusAfter.current
    if (!selector) return
    const element = rootRef.current?.querySelector<HTMLElement>(selector)
    if (element) {
      focusAfter.current = null
      element.focus()
    }
  })

  const send = (plan: OutlinePlan): boolean => {
    if (!plan.ok) {
      if (plan.reason === 'too_many') onNotice?.(t('tooMany', { max: OUTLINE_MAX_OPS }))
      return false
    }
    void actions.apply(plan.specs)
    return true
  }

  const pick = (sceneId: string) => {
    actions.select(sceneId)
    onSeekScene?.(sceneId)
  }

  const collapseKey = (group: OutlineGroup) => group.sectionId ?? group.key
  const setGroupCollapsed = (group: OutlineGroup, value: boolean) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (value) next.add(collapseKey(group))
      else next.delete(collapseKey(group))
      return next
    })

  const startRename = (group: OutlineGroup) => {
    if (!canWrite || !group.sectionId) return
    setMenu(null)
    setEditing({ sectionId: group.sectionId, groupKey: group.key, value: group.title })
  }
  const commitRename = () => {
    const current = editingRef.current
    if (!current) return
    editingRef.current = null
    setEditing(null)
    focusAfter.current = `[data-group-key="${current.groupKey}"] .ol-head`
    send(planRename(document, current.sectionId, current.value))
  }
  const cancelRename = () => {
    const current = editingRef.current
    editingRef.current = null
    setEditing(null)
    if (current) focusAfter.current = `[data-group-key="${current.groupKey}"] .ol-head`
  }

  const addSection = (groupKey: string | null, place: 'before' | 'after') => {
    setMenu(null)
    const sectionId = newSectionId(uuid())
    if (send(planAddSection(document, outline, { groupKey, place, sectionId, title: t('newSection') }))) setPendingRename(sectionId)
  }
  const addSections = () => {
    const ids = [newSectionId(uuid()), newSectionId(uuid()), newSectionId(uuid())] as const
    send(planAddSections(document, { ids, titles: { intro: t('defaults.intro'), body: t('defaults.body'), outro: t('defaults.outro') } }))
  }

  const moveClip = (sceneId: string, target: ClipDropTarget) => send(planClipMove(document, outline, sceneId, target))

  const clearDrag = () => {
    dragRef.current = null
    setDrag(null)
    setDropAt(null)
  }
  const beginDrag = (event: React.DragEvent, next: Drag) => {
    if (!canWrite) {
      event.preventDefault()
      return
    }
    event.stopPropagation()
    dragRef.current = next
    setDrag(next)
    setMenu(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_TYPE, next.kind === 'clip' ? next.sceneId : next.groupKey)
  }
  const showDrop = (next: DropAt) =>
    setDropAt((current) => (current && JSON.stringify(current) === JSON.stringify(next) ? current : next))
  const dropClipAt = (event: React.DragEvent, groupKey: string, index: number) => {
    const current = dragRef.current
    if (current?.kind !== 'clip') return
    event.preventDefault()
    event.stopPropagation()
    clearDrag()
    moveClip(current.sceneId, { groupKey, index })
  }

  const groupMarkup = (group: OutlineGroup, groupIndex: number) => {
    const isCollapsed = collapsed.has(collapseKey(group))
    const isEditing = editing !== null && editing.groupKey === group.key
    const title = group.sectionId ? group.title : t('unsorted')
    const nextKey = outline.groups[groupIndex + 1]?.key ?? null
    const headLabel = t('sectionLabel', { title, start: formatSeconds(group.start), duration: formatDuration(group.seconds), count: group.clips.length })
    const classes = ['ol-sec']
    if (isCollapsed) classes.push('collapsed')
    if (drag?.kind === 'group' && drag.groupKey === group.key) classes.push('dragging')
    if (dropAt?.kind === 'group' && dropAt.mark.groupKey === group.key) classes.push(dropAt.mark.after ? 'drop-after' : 'drop-before')
    const headClasses = ['ol-head']
    if (dropAt?.kind === 'clip' && dropAt.groupKey === group.key && dropAt.at === 'head') headClasses.push('drop-into')
    const draggableHead = canWrite && group.clips.length > 0 && !isEditing
    return (
      <div
        key={group.key}
        className={classes.join(' ')}
        data-group-key={group.key}
        data-role={group.role ?? 'unsorted'}
        onDragOver={(event) => {
          if (dragRef.current?.kind !== 'group') return
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          const after = event.clientY >= rect.top + rect.height / 2
          showDrop({ kind: 'group', beforeKey: after ? nextKey : group.key, mark: { groupKey: group.key, after } })
        }}
        onDrop={(event) => {
          const current = dragRef.current
          if (current?.kind !== 'group') return
          event.preventDefault()
          const target = dropAt?.kind === 'group' ? dropAt.beforeKey : group.key
          clearDrag()
          send(planGroupMove(outline, current.groupKey, target))
        }}
      >
        <div
          className={headClasses.join(' ')}
          role="heading"
          aria-level={3}
          tabIndex={0}
          aria-label={headLabel}
          data-section-head={group.sectionId ?? undefined}
          draggable={draggableHead}
          title={draggableHead && group.sectionId ? t('dragSection') : undefined}
          onDragStart={(event) => beginDrag(event, { kind: 'group', groupKey: group.key })}
          onDragEnd={clearDrag}
          onDragOver={(event) => {
            if (dragRef.current?.kind !== 'clip') return
            event.preventDefault()
            event.stopPropagation()
            showDrop({ kind: 'clip', groupKey: group.key, index: 0, at: 'head' })
          }}
          onDrop={(event) => dropClipAt(event, group.key, 0)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return
            if (event.key === 'F2') {
              event.preventDefault()
              startRename(group)
            } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
              event.preventDefault()
              if (!canWrite) return
              const target = groupStepTarget(outline, group.key, event.key === 'ArrowUp' ? -1 : 1)
              if (!target) return
              focusAfter.current = group.sectionId ? `[data-section-head="${group.sectionId}"]` : `[data-group-key="${group.key}"] .ol-head`
              send(planGroupMove(outline, group.key, target.beforeKey))
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              setGroupCollapsed(group, event.key === 'ArrowLeft')
            }
          }}
        >
          <button
            type="button"
            className="ol-tog"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? t('expand', { title }) : t('collapse', { title })}
            onClick={() => setGroupCollapsed(group, !isCollapsed)}
          >
            <Icon name={isCollapsed ? 'right' : 'down'} size="sm" />
          </button>
          <span className="ol-role" aria-hidden />
          {isEditing ? (
            <RenameInput
              value={editing.value}
              label={t('renameLabel')}
              onChange={(value) => {
                const next = { ...editing, value }
                editingRef.current = next
                setEditing(next)
              }}
              onCommit={commitRename}
              onCancel={cancelRename}
            />
          ) : (
            <span className="ol-title" title={title} onDoubleClick={() => startRename(group)}>
              {title}
            </span>
          )}
          <span className="ol-time">{formatSeconds(group.start)}</span>
          <span className="ol-len">{formatDuration(group.seconds)}</span>
          {group.sectionId ? (
            <button
              type="button"
              className="ol-more"
              aria-haspopup="menu"
              aria-expanded={menu?.groupKey === group.key}
              aria-label={t('moreActions', { title })}
              data-menu-trigger={group.key}
              onClick={(event) => {
                if (menu?.groupKey === group.key) {
                  setMenu(null)
                  return
                }
                const rect = event.currentTarget.getBoundingClientRect()
                setMenu({ groupKey: group.key, x: rect.right - MENU_SIZE.width, y: rect.bottom + 4 })
              }}
            >
              <Icon name="more" size="sm" />
            </button>
          ) : null}
        </div>
        {isCollapsed ? null : group.clips.length === 0 ? (
          <div
            className={`ol-empty${dropAt?.kind === 'clip' && dropAt.groupKey === group.key && dropAt.at === 'empty' ? ' drop-into' : ''}`}
            onDragOver={(event) => {
              if (dragRef.current?.kind !== 'clip') return
              event.preventDefault()
              event.stopPropagation()
              showDrop({ kind: 'clip', groupKey: group.key, index: 0, at: 'empty' })
            }}
            onDrop={(event) => dropClipAt(event, group.key, 0)}
          >
            {t('dropHere')}
          </div>
        ) : (
          <div className="ol-clips">{group.clips.map((clip, index) => clipMarkup(group, clip, index))}</div>
        )}
      </div>
    )
  }

  const clipMarkup = (group: OutlineGroup, clip: OutlineClip, index: number) => {
    const on = clip.sceneId === selectedSceneId
    const mediaName = clip.media ? (mediaNameOf?.(clip.media.storageObjectId) ?? null) : null
    const label = clip.text ?? mediaName ?? t('clipName', { n: clip.number })
    const duration = formatDuration(clip.seconds)
    const statusText = clip.status ? clip.status.reasons.map((reason) => statusT(`reasons.${reason}`)).join(', ') : null
    const base = t('clipLabel', { label, n: clip.number, total: outline.order.length, duration })
    const classes = ['ol-clip']
    if (on) classes.push('on')
    if (drag?.kind === 'clip' && drag.sceneId === clip.sceneId) classes.push('dragging')
    if (dropAt?.kind === 'clip' && typeof dropAt.at === 'object' && dropAt.at.sceneId === clip.sceneId) classes.push(dropAt.at.after ? 'drop-after' : 'drop-before')
    return (
      <div
        key={clip.sceneId}
        className={classes.join(' ')}
        role="button"
        tabIndex={0}
        aria-pressed={on}
        aria-label={statusText ? t('clipStatusLabel', { label: base, status: statusText }) : base}
        data-scene-id={clip.sceneId}
        draggable={canWrite}
        title={canWrite ? t('dragClip') : undefined}
        onClick={() => pick(clip.sceneId)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            pick(clip.sceneId)
          } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault()
            if (!canWrite) return
            const target = clipStepTarget(outline, clip.sceneId, event.key === 'ArrowUp' ? -1 : 1)
            if (!target) return
            focusAfter.current = `[data-scene-id="${clip.sceneId}"]`
            moveClip(clip.sceneId, target)
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const rows = [...(rootRef.current?.querySelectorAll<HTMLElement>('.ol-clip') ?? [])]
            const position = rows.indexOf(event.currentTarget)
            rows[position + (event.key === 'ArrowUp' ? -1 : 1)]?.focus()
          }
        }}
        onDragStart={(event) => beginDrag(event, { kind: 'clip', sceneId: clip.sceneId })}
        onDragEnd={clearDrag}
        onDragOver={(event) => {
          if (dragRef.current?.kind !== 'clip') return
          event.preventDefault()
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          const after = event.clientY >= rect.top + rect.height / 2
          showDrop({ kind: 'clip', groupKey: group.key, index: index + (after ? 1 : 0), at: { sceneId: clip.sceneId, after } })
        }}
        onDrop={(event) => {
          const at = dropAt?.kind === 'clip' && dropAt.groupKey === group.key ? dropAt.index : index
          dropClipAt(event, group.key, at)
        }}
      >
        <OutlineThumb clip={clip} board={board} />
        <span className="ol-meta">
          <span className="ol-label" title={label}>
            {label}
          </span>
          <span className="ol-dur">
            {clip.status && statusText ? (
              <span className={`st-dot${clip.status.tone === 'attention' ? ' warn' : ''}`} title={statusText} aria-hidden />
            ) : null}
            {duration}
          </span>
        </span>
        <button
          type="button"
          className="ol-del"
          disabled={!canWrite}
          title={writeTitle ?? editorT('deleteScene')}
          aria-label={editorT('deleteScene')}
          onClick={(event) => {
            event.stopPropagation()
            void actions.removeScene(clip.sceneId)
          }}
        >
          <Icon name="trash" size="sm" />
        </button>
      </div>
    )
  }

  const menuGroup = menu ? outline.groups.find((group) => group.key === menu.groupKey) : undefined
  const canAddSections = !outline.hasSections && outline.order.length > 0

  return (
    <div className="ol" ref={rootRef} data-outline aria-label={t('listLabel')} role="group">
      {outline.groups.map((group, index) => groupMarkup(group, index))}
      {canAddSections ? (
        <button type="button" className="ol-add" disabled={!canWrite} title={writeTitle ?? t('addSectionsHint')} onClick={addSections}>
          <Icon name="plus" size="sm" />
          {t('addSections')}
        </button>
      ) : outline.hasSections ? (
        <button type="button" className="ol-add" disabled={!canWrite} title={writeTitle} onClick={() => addSection(null, 'after')}>
          <Icon name="plus" size="sm" />
          {t('addSection')}
        </button>
      ) : null}
      {menu && menuGroup ? (
        <SectionMenu
          key={menuGroup.key}
          outline={outline}
          group={menuGroup}
          position={menu}
          canWrite={canWrite}
          writeTitle={writeTitle}
          onClose={(restoreFocus) => {
            setMenu(null)
            if (restoreFocus) focusAfter.current = `[data-menu-trigger="${menuGroup.key}"]`
          }}
          onRename={() => startRename(menuGroup)}
          onAddBefore={() => addSection(menuGroup.key, 'before')}
          onAddAfter={() => addSection(menuGroup.key, 'after')}
          onMergeNext={() => {
            setMenu(null)
            send(planMergeWithNext(document, outline, menuGroup.key))
          }}
          onDelete={() => {
            setMenu(null)
            send(planDeleteSection(outline, menuGroup.key))
          }}
        />
      ) : null}
    </div>
  )
}

/** The section title as an input: Enter or leaving the field saves, Escape keeps the old name. */
function RenameInput({
  value,
  label,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string
  label: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      className="ol-rename"
      aria-label={label}
      value={value}
      maxLength={SECTION_TITLE_MAX_LENGTH}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') {
          event.preventDefault()
          onCommit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
      }}
      onBlur={onCommit}
    />
  )
}

/** The section header's menu (design `.cmenu`): closes on Escape (focus back on its button), outside click, scroll, resize. */
function SectionMenu({
  outline,
  group,
  position,
  canWrite,
  writeTitle,
  onClose,
  onRename,
  onAddBefore,
  onAddAfter,
  onMergeNext,
  onDelete,
}: {
  outline: Outline
  group: OutlineGroup
  position: { x: number; y: number }
  canWrite: boolean
  writeTitle?: string
  onClose: (restoreFocus: boolean) => void
  onRename: () => void
  onAddBefore: () => void
  onAddAfter: () => void
  onMergeNext: () => void
  onDelete: () => void
}) {
  const t = useTranslations('Spark.editor.outline')
  const ref = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  React.useEffect(() => {
    const element = ref.current
    element?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const onPointer = (event: MouseEvent) => {
      if (element && !element.contains(event.target as Node) && !(event.target as Element | null)?.closest?.('[data-menu-trigger]')) onCloseRef.current(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current(true)
    }
    const close = () => onCloseRef.current(false)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [])

  const spot = clampMenuPosition(
    position.x,
    position.y,
    { width: globalThis.window?.innerWidth ?? 1280, height: globalThis.window?.innerHeight ?? 800 },
    MENU_SIZE,
  )
  const hasNext = nextSectionGroup(outline, group.key) !== null
  const disabled = !canWrite
  return (
    <div
      ref={ref}
      className="cmenu ol-menu"
      role="menu"
      aria-label={t('menuLabel')}
      style={{ left: spot.x, top: spot.y }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
        const index = items.indexOf(globalThis.document.activeElement as HTMLButtonElement)
        const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }}
    >
      <button type="button" role="menuitem" disabled={disabled} title={writeTitle} onClick={onRename}>
        <Icon name="edit" size="sm" />
        {t('rename')}
        <kbd>F2</kbd>
      </button>
      <hr />
      <button type="button" role="menuitem" disabled={disabled} title={writeTitle} onClick={onAddBefore}>
        <Icon name="up" size="sm" />
        {t('addBefore')}
      </button>
      <button type="button" role="menuitem" disabled={disabled} title={writeTitle} onClick={onAddAfter}>
        <Icon name="down" size="sm" />
        {t('addAfter')}
      </button>
      <button type="button" role="menuitem" disabled={disabled || !hasNext} title={writeTitle} onClick={onMergeNext}>
        <Icon name="scenes" size="sm" />
        {t('mergeNext')}
      </button>
      <hr />
      <button type="button" role="menuitem" className="danger" disabled={disabled} title={writeTitle} onClick={onDelete}>
        <Icon name="trash" size="sm" />
        {t('delete')}
      </button>
    </div>
  )
}

/**
 * A clip's picture: the delivery thumbnail of its main clip (asked for once the card is on screen), a title card of the
 * first text for graphics only, or the media kind's icon while there is no picture.
 */
function OutlineThumb({ clip, board }: { clip: OutlineClip; board: OutlineThumbnails }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const objectId = clip.media?.storageObjectId ?? null
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
  const version = React.useSyncExternalStore(board.subscribe, board.getVersion, board.getVersion)
  React.useEffect(() => {
    if (visible && objectId) board.request(objectId)
  }, [board, objectId, visible, version])
  const url = objectId ? board.url(objectId) : null
  return (
    <span className="ol-thumb" ref={ref} aria-hidden>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage thumbnail URL, not a static asset
        <img src={url} alt="" draggable={false} />
      ) : clip.titleCard ? (
        <span className="ol-card">
          <span>{clip.titleCard}</span>
        </span>
      ) : clip.media ? (
        <Icon name={clip.media.kind === 'video' ? 'video' : 'image'} size="sm" />
      ) : null}
    </span>
  )
}
