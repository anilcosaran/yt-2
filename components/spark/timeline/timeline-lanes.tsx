'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { OutlineThumbnails } from '@/lib/spark/outline/outline-thumbnails'
import { TRANSITION_CATALOG, type TransitionKind } from '@/lib/spark/scene-transitions'
import { formatSecondsLength, formatTimelineTime, inWindow } from '@/lib/spark/timeline/timeline-geometry'
import type { TimelineMediaPreviews } from '@/lib/spark/timeline/timeline-media-previews'
import {
  overlayRowsOf,
  type TimelineChapter,
  type TimelineCut,
  type TimelineMainBlock,
  type TimelineModel,
  type TimelineOverlayBlock,
} from '@/lib/spark/timeline/timeline-model'

import { Icon } from '../tools/studio-parts'
import { ChapterRow } from './timeline-chapters'
import { ClipMedia, Waveform } from './timeline-clip-media'
import { useExportStatusText } from './timeline-transition-picker'

/** Width of the lane heads (the sticky icon column) and the row heights the gestures hit-test with. */
export const TIMELINE_HEAD_PX = 40
export const TIMELINE_ROWS = { chapters: 26, ruler: 18, overlay: 26, main: 88, ticks: 6, strip: 12, audio: 24, captions: 22 } as const

export type TimelineWindow = { startFrame: number; endFrame: number }

export type TimelineLanesProps = {
  model: TimelineModel
  /** The frames to render (viewport ± one screen): blocks outside it are not in the DOM. */
  window: TimelineWindow
  /** Pixels per frame of the rendered view (the media slots pick their tiles with it). */
  ppf: number
  /** The selected keys joined by `|` (a string, so the memo compares it by value). */
  selection: string
  /** Rendered overlay rows (at least one, a drop target) while the lanes are open. */
  overlayRows: number
  ruler: { majorFrames: number; minorFrames: number }
  /** The gateway draws transitions (the preview plan's `transitions_enabled`): cuts show their transition. */
  transitionsEnabled: boolean
  /** A cut opens the transition picker (else it opens the scene's Transition properties). */
  transitionsEditable: boolean
  canWrite: boolean
  /** A server-first scene split is on its way: a dashed cut at this display frame. */
  pendingCut: number | null
  /** The Lanes toggle: overlay rows and the voice / music / sound / caption lanes (collapsed: ticks and a music strip). */
  lanesOpen: boolean
  previews: TimelineMediaPreviews
  thumbnails: OutlineThumbnails | null
  /** Changes when a filmstrip, a waveform or a thumbnail arrived (re-renders the media slots). */
  mediaVersion: number
  /** The shown chapter names (stable). */
  chapterName: (chapter: TimelineChapter) => string
  renamingChapter: string | null
  currentChapter: string | null
  onRenameCommit: (chapterKey: string, value: string) => void
  onRenameCancel: () => void
  /** The cut whose picker is open (its icon stays lit). */
  pickerSceneId: string | null
}

const pos = (start: number, length: number) => ({ '--s': start, '--l': length }) as React.CSSProperties

const TICK_KIND: Record<TimelineOverlayBlock['kind'], 'text' | 'media' | 'motion'> = {
  text: 'text',
  shape: 'motion',
  motion_instance: 'motion',
  clip: 'media',
  pending_slot: 'media',
}

/**
 * The lanes of the timeline (v2 P1-B, v3 compact layout): chapters, ruler, (overlay rows), the main track with its media
 * slots and cuts, the overlay ticks and the music strip — or, with Lanes open, the voice / music / sound / caption lanes.
 * A pure render of the model for the visible window; it never handles an event itself (the timeline delegates pointer
 * gestures through `data-gesture` / `data-key`), so a drag never re-renders it.
 */
export const TimelineLanes = React.memo(function TimelineLanes({
  model,
  window,
  ppf,
  selection,
  overlayRows,
  ruler,
  transitionsEnabled,
  transitionsEditable,
  canWrite,
  pendingCut,
  lanesOpen,
  previews,
  thumbnails,
  chapterName,
  renamingChapter,
  currentChapter,
  onRenameCommit,
  onRenameCancel,
  pickerSceneId,
}: TimelineLanesProps) {
  const t = useTranslations('Spark.editor.timelineV2')
  const t3 = useTranslations('Spark.editor.timelineV3')
  const tTransition = useTranslations('Spark.editor.transition')
  const exportText = useExportStatusText()
  const selected = React.useMemo(() => new Set(selection ? selection.split('|') : []), [selection])
  const rows = React.useMemo(() => overlayRowsOf(model), [model])
  const visible = <T extends { startFrame: number; endFrame: number }>(items: readonly T[]) => items.filter((item) => inWindow(window, item.startFrame, item.endFrame))
  const fps = model.fps
  const length = (frames: number) => formatSecondsLength(frames, fps)

  const ticks: React.ReactNode[] = []
  const first = Math.max(0, Math.floor(window.startFrame / ruler.majorFrames) * ruler.majorFrames)
  const last = Math.min(Math.max(window.endFrame, 0), model.totalFrames + ruler.majorFrames * 2)
  for (let frame = first; frame <= last; frame += ruler.majorFrames) {
    ticks.push(
      <span key={frame} className="tl2-tick" style={{ '--s': frame } as React.CSSProperties}>
        <b>{formatTimelineTime(frame, fps)}</b>
      </span>,
    )
  }

  const mainLabel = (block: TimelineMainBlock) =>
    block.label.kind === 'text' ? block.label.text : block.label.kind === 'none' ? t('labels.clip', { n: block.index + 1 }) : t(`labels.${block.label.kind}`)
  const overlayLabel = (block: TimelineOverlayBlock) => {
    if (block.kind === 'text') return block.text?.trim() || t('kinds.text')
    if (block.kind === 'clip') return block.mediaKind === 'video' ? t('labels.video') : t('labels.image')
    return t(`kinds.${block.kind}`)
  }
  const cutTitle = (cut: TimelineCut) => {
    const status = exportText(cut.exportState, fps)
    if (!cut.transition) return transitionsEditable && canWrite ? t3('cuts.add', { n: cut.index }) : t('cutLabel', { n: cut.index })
    const frames = cut.window?.durationFrames ?? cut.transition.duration_frames
    const base = t('bandLabel', { name: tTransition(`kinds.${cut.transition.kind}`), seconds: length(frames) })
    return status ? `${base} · ${status}` : base
  }

  return (
    <>
      <div className="tl2-row chapters" data-lane="chapters" role="group" aria-label={t3('lanes.chapters')}>
        <div className="tl2-head" title={t3('lanes.chapters')}>
          <Icon name="scenes" size="sm" />
        </div>
        <div className="tl2-lane">
          <ChapterRow
            model={model}
            window={window}
            name={chapterName}
            renaming={renamingChapter}
            current={currentChapter}
            canWrite={canWrite}
            onRenameCommit={onRenameCommit}
            onRenameCancel={onRenameCancel}
          />
        </div>
      </div>

      <div className="tl2-row ruler" data-lane="ruler">
        <div className="tl2-head" aria-hidden />
        <div className="tl2-lane" data-gesture="scrub" style={{ '--tl-minor': ruler.minorFrames } as React.CSSProperties}>
          {ticks}
        </div>
      </div>

      {lanesOpen
        ? Array.from({ length: overlayRows }, (_, offset) => overlayRows - 1 - offset).map((row) => (
            <div key={`overlay-${row}`} className="tl2-row overlay" data-lane="overlay" data-row={row} role="group" aria-label={t('lanes.overlay', { n: row + 1 })}>
              <div className="tl2-head">{t('lanes.overlayShort', { n: row + 1 })}</div>
              <div className="tl2-lane">
                {visible(rows[row] ?? []).map((block) => {
                  const on = selected.has(block.key)
                  const label = overlayLabel(block)
                  const trim = canWrite && block.trimmable
                  return (
                    <div
                      key={block.key}
                      className={`tl2-blk k-${block.kind}${on ? ' on' : ''}`}
                      data-key={block.key}
                      data-gesture="overlay"
                      role="button"
                      tabIndex={-1}
                      aria-pressed={on}
                      aria-label={t('overlayLabel', { kind: t(`kinds.${block.kind}`), label, start: formatTimelineTime(block.startFrame, fps), end: formatTimelineTime(block.endFrame, fps) })}
                      title={label}
                      style={pos(block.startFrame, block.endFrame - block.startFrame)}
                    >
                      {trim ? <span className="tl2-h s" data-gesture="trim-start" aria-hidden><i /></span> : null}
                      {block.enterFrames !== null ? (
                        <span className="tl2-ramp in" style={{ '--r': block.enterFrames } as React.CSSProperties}>
                          {canWrite ? <span className="tl2-ramp-grip" data-gesture="ramp-in" title={t('rampIn')} /> : null}
                        </span>
                      ) : null}
                      <span className="nm">{label}</span>
                      {block.exitFrames !== null ? (
                        <span className="tl2-ramp out" style={{ '--r': block.exitFrames } as React.CSSProperties}>
                          {canWrite ? <span className="tl2-ramp-grip" data-gesture="ramp-out" title={t('rampOut')} /> : null}
                        </span>
                      ) : null}
                      {trim ? <span className="tl2-h e" data-gesture="trim-end" aria-hidden><i /></span> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        : null}

      <div className="tl2-row main" data-lane="main" role="group" aria-label={t('lanes.main')}>
        <div className="tl2-head" title={t('lanes.main')}>
          <Icon name="video" size="sm" />
        </div>
        <div className="tl2-lane">
          {visible(model.main).map((block) => {
            const on = selected.has(block.key)
            const label = mainLabel(block)
            const endTrim = canWrite && block.resolved && !block.narrationBound && !block.pending
            const startTrim = endTrim && block.mainClip?.startFrame === 0
            return (
              <div
                key={block.key}
                className={`tl2-blk main${on ? ' on' : ''}${block.resolved ? '' : ' unresolved'}${block.pending ? ' pending' : ''}`}
                data-key={block.key}
                data-gesture="main"
                data-at={block.startFrame}
                role="button"
                tabIndex={-1}
                aria-pressed={on}
                aria-label={t('mainLabel', { n: block.index + 1, total: model.main.length, label, duration: length(block.lengthFrames) })}
                title={label}
                style={pos(block.startFrame, block.lengthFrames)}
              >
                <ClipMedia block={block} ppf={ppf} window={window} previews={previews} thumbnails={thumbnails} />
                <span className="tl3-chip">
                  <span className="n">{block.index + 1}</span>
                  <span className="nm">{label}</span>
                </span>
                <span className="d">{block.resolved ? length(block.lengthFrames) : '—'}</span>
                <span className={`tl2-h s${startTrim ? '' : ' off'}`} data-gesture="trim-start" aria-hidden>
                  <i />
                </span>
                <span className={`tl2-h e${endTrim ? '' : ' off'}`} data-gesture="trim-end" aria-hidden>
                  <i />
                </span>
              </div>
            )
          })}
          {transitionsEnabled
            ? model.cuts
                .filter((cut) => inWindow(window, cut.frame - 30, cut.frame + 30))
                .flatMap((cut) => {
                  const parts: React.ReactNode[] = []
                  const state = cut.exportState.state
                  const flagged = state === 'video_cut' || state === 'video_project' || state === 'off' || state === 'unavailable'
                  if (cut.transition) {
                    const frames = cut.window?.durationFrames ?? cut.transition.duration_frames
                    const start = cut.window?.startFrame ?? cut.frame - Math.floor(frames / 2)
                    const name = tTransition(`kinds.${cut.transition.kind}`)
                    const on = selected.has(`scene:${cut.sceneId}`)
                    parts.push(
                      <div
                        key={`band:${cut.sceneId}`}
                        className={`tl2-band x-${state}${on ? ' on' : ''}${cut.window?.clamped ? ' clamped' : ''}`}
                        data-key={`cut:${cut.sceneId}`}
                        data-gesture="band"
                        data-scene={cut.sceneId}
                        data-transition-into={cut.sceneId}
                        data-at={start}
                        data-export-state={state}
                        role="button"
                        tabIndex={-1}
                        aria-label={t('bandLabel', { name, seconds: length(frames) })}
                        title={cutTitle(cut)}
                        style={pos(start, frames)}
                      >
                        {transitionsEditable && canWrite ? <span className="tl2-h s" data-gesture="band-start" aria-hidden /> : null}
                        {transitionsEditable && canWrite ? <span className="tl2-h e" data-gesture="band-end" aria-hidden /> : null}
                      </div>,
                    )
                  }
                  if (!cut.resolved && !cut.transition) return parts
                  const add = !cut.transition && transitionsEditable && canWrite
                  parts.push(
                    <button
                      key={`cut:${cut.sceneId}`}
                      type="button"
                      className={`tl2-cut${cut.transition ? ` set x-${state}` : add ? ' add' : ''}${pickerSceneId === cut.sceneId ? ' open' : ''}`}
                      data-key={`cut:${cut.sceneId}`}
                      data-gesture="cut"
                      data-scene={cut.sceneId}
                      data-transition-into={cut.sceneId}
                      data-at={cut.frame}
                      aria-label={cutTitle(cut)}
                      aria-haspopup={transitionsEditable && canWrite ? 'dialog' : undefined}
                      title={cutTitle(cut)}
                      style={{ '--s': cut.frame } as React.CSSProperties}
                    >
                      {cut.transition ? <TransitionGlyph kind={cut.transition.kind} /> : add ? '+' : '·'}
                      {cut.transition && flagged ? <span className="warn" aria-hidden>!</span> : null}
                    </button>,
                  )
                  return parts
                })
            : null}
          {pendingCut !== null ? <span className="tl2-pending-cut" style={{ '--s': pendingCut } as React.CSSProperties} aria-hidden /> : null}
        </div>
      </div>

      {lanesOpen ? (
        <>
          <AudioRow lane="voice" icon="mic" label={t('lanes.voice')} blocks={visible(model.voice)} selected={selected} name={t('kinds.narration')} />
          <AudioRow lane="music" icon="music" label={t('lanes.music')} blocks={visible(model.music)} selected={selected} name={t('kinds.music')} />
          {model.sfx.length > 0 ? <AudioRow lane="sfx" icon="clip" label={t('lanes.sfx')} blocks={visible(model.sfx)} selected={selected} name={t('kinds.sfx')} /> : null}
          {model.captions.length > 0 ? (
            <div className="tl2-row captions" data-lane="captions" role="group" aria-label={t('lanes.captions')}>
              <div className="tl2-head" title={t('lanes.captions')}>
                <Icon name="cc" size="sm" />
              </div>
              <div className="tl2-lane">
                {visible(model.captions).map((block) => (
                  <div
                    key={block.key}
                    className={`tl2-blk caption${selected.has(block.key) ? ' on' : ''}`}
                    data-key={block.key}
                    data-gesture="caption"
                    role="button"
                    tabIndex={-1}
                    aria-pressed={selected.has(block.key)}
                    aria-label={t('kinds.captions')}
                    style={pos(block.startFrame, block.endFrame - block.startFrame)}
                  >
                    <span className="nm">{t('kinds.captions')}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="tl2-row tl3-ticks" data-lane="ticks" aria-hidden>
            <div className="tl2-head" />
            <div className="tl2-lane">
              {visible(model.overlays).map((block) => (
                <span
                  key={block.key}
                  className={`tl3-tick k-${TICK_KIND[block.kind]}${selected.has(block.key) ? ' on' : ''}`}
                  data-gesture="tick"
                  data-key={block.key}
                  title={overlayLabel(block)}
                  style={pos(block.startFrame, block.endFrame - block.startFrame)}
                />
              ))}
            </div>
          </div>
          <div className="tl2-row tl3-strip" data-lane="music" role="group" aria-label={t('lanes.music')}>
            <div className="tl2-head" title={t('lanes.music')}>
              <Icon name="music" size="sm" />
            </div>
            <div className="tl2-lane">
              {visible(model.music).map((block) => {
                const peaks = block.media ? previews.waveform(block.media.storageObjectId) : 'none'
                return (
                  <div
                    key={block.key}
                    className={`tl3-music${selected.has(block.key) ? ' on' : ''}`}
                    data-key={block.key}
                    data-gesture="audio"
                    role="button"
                    tabIndex={-1}
                    aria-pressed={selected.has(block.key)}
                    aria-label={t('kinds.music')}
                    style={pos(block.startFrame, block.endFrame - block.startFrame)}
                  >
                    {typeof peaks === 'object' && block.media ? (
                      <Waveform peaks={peaks} startSeconds={block.media.sourceStartSeconds} endSeconds={block.media.sourceEndSeconds} offsetPx={0} widthPx={(block.endFrame - block.startFrame) * ppf} />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
})

/**
 * The kind symbol of a set transition on its cut icon (two frames meeting the way the kind moves), by the catalogue's
 * group: blends and light (fade, blur, dip, flash) overlap, the Zoom group nests, every other kind slides.
 */
function TransitionGlyph({ kind }: { kind: TransitionKind }) {
  const group = TRANSITION_CATALOG[kind]?.group
  return (
    <svg className="tl3-glyph" viewBox="0 0 16 16" aria-hidden data-kind={kind}>
      {kind === 'fade' || kind === 'blur' || group === 'light' ? (
        <>
          <circle cx="6" cy="8" r="4" />
          <circle cx="10" cy="8" r="4" opacity=".55" />
        </>
      ) : group === 'zoom' ? (
        <>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
          <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
        </>
      ) : (
        <>
          <rect x="2" y="3" width="7" height="10" rx="1.5" />
          <path d="M11 5l3 3-3 3" />
        </>
      )}
    </svg>
  )
}

function AudioRow({
  lane,
  icon,
  label,
  blocks,
  selected,
  name,
}: {
  lane: 'voice' | 'music' | 'sfx'
  icon: string
  label: string
  blocks: TimelineModel['voice']
  selected: ReadonlySet<string>
  name: string
}) {
  return (
    <div className="tl2-row audio" data-lane={lane} role="group" aria-label={label}>
      <div className="tl2-head" title={label}>
        <Icon name={icon} size="sm" />
      </div>
      <div className="tl2-lane">
        {blocks.map((block) => (
          <div
            key={block.key}
            className={`tl2-blk r-${block.role}${selected.has(block.key) ? ' on' : ''}`}
            data-key={block.key}
            data-gesture="audio"
            role="button"
            tabIndex={-1}
            aria-pressed={selected.has(block.key)}
            aria-label={name}
            style={pos(block.startFrame, block.endFrame - block.startFrame)}
          >
            <span className="nm">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
