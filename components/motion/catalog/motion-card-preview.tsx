'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { CatalogPreview, CatalogPreviewSource } from '@/lib/motion-editor/catalog-preview-source'
import type { CatalogItem } from '@/lib/motion-editor/catalog-model'
import type { LiveSlotPool } from '@/lib/motion-editor/live-slots'
import type { PlaybackStore } from '@/lib/spark/playback-store'

import { MotionRuntimePlayer, type MotionPlayerDeps } from '../motion-runtime-player'
import { MotionPoster } from './motion-poster'
import { useInView, usePrefersReducedMotion } from './use-viewport'

/**
 * The picture of a catalog card. It is a static poster until it earns a live player: the card must be in the viewport
 * (IntersectionObserver), the item must have a compile to draw, and the shared pool must have a free slot (at most
 * `pool.max` live players exist at once; the others keep their poster). The live picture is the real `motion-runtime`
 * host (`MotionRuntimePlayer`, seek-only) showing its first frame; it plays while the card is hovered or focused and rewinds
 * and pauses when the pointer leaves. With `prefers-reduced-motion` it never plays on its own (the dialog has an explicit
 * play button). A compile or runtime that fails leaves the poster and a quiet note, never an error wall.
 */
export function MotionCardPreview({
  item,
  title,
  pool,
  source,
  playerDeps,
  suspended = false,
  playing,
  onMeta,
}: {
  item: CatalogItem
  title: string
  pool: LiveSlotPool
  source: CatalogPreviewSource
  playerDeps?: MotionPlayerDeps
  /** While something covers the grid (the dialog) no card holds a slot. */
  suspended?: boolean
  /** The card is hovered or focused. */
  playing: boolean
  /** The compile's own length and format once read (the card's meta line prefers them). */
  onMeta?: (preview: CatalogPreview) => void
}) {
  const t = useTranslations('Motion.catalog.card')
  const frame = React.useRef<HTMLDivElement>(null)
  const inView = useInView(frame)
  const reducedMotion = usePrefersReducedMotion()
  const drawable = source.canPreview(item) && !item.locked
  const wants = drawable && inView && !suspended
  const [preview, setPreview] = React.useState<CatalogPreview | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [drawn, setDrawn] = React.useState(false)

  React.useEffect(() => {
    if (!wants) return undefined
    pool.want(item.id)
    return () => pool.release(item.id)
  }, [wants, pool, item.id])
  React.useSyncExternalStore(pool.subscribe, pool.getVersion, pool.getVersion)
  const granted = wants && pool.holds(item.id)

  React.useEffect(() => {
    if (!granted || preview || failed) return undefined
    const controller = new AbortController()
    source
      .load(item, { signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return
        setPreview(value)
        onMeta?.(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [granted, preview, failed, source, item, onMeta])

  const playbackRef = React.useRef<PlaybackStore | null>(null)
  const shouldPlay = playing && !reducedMotion
  const shouldPlayRef = React.useRef(shouldPlay)
  React.useEffect(() => {
    shouldPlayRef.current = shouldPlay
  })

  const onPlayback = React.useCallback((playback: PlaybackStore | null) => {
    playbackRef.current = playback
    setDrawn(playback !== null)
    if (playback && shouldPlayRef.current) playback.play()
  }, [])

  React.useEffect(() => {
    const playback = playbackRef.current
    if (!playback) return undefined
    if (!shouldPlay) {
      playback.pause()
      playback.seek(0)
      return undefined
    }
    playback.play()
    // A hovered card loops: when a run reaches its end it starts over.
    let restarting = false
    const unsubscribe = playback.subscribe(() => {
      if (restarting || playback.playing || !shouldPlayRef.current) return
      restarting = true
      playback.seek(0)
      playback.play()
      restarting = false
    })
    return unsubscribe
  }, [shouldPlay, drawn])

  const showPlayer = granted && preview !== null && !failed
  const ratio = preview ? preview.ratio.split(':').map(Number) : [16, 9]
  const aspect = (ratio[0] ?? 16) / (ratio[1] ?? 9)

  return (
    <div ref={frame} className="relative aspect-video w-full overflow-hidden bg-black" data-motion-live={showPlayer ? (drawn ? 'drawn' : 'loading') : failed ? 'failed' : 'poster'}>
      <MotionPoster item={item} title={title} />
      {granted && !preview && !failed ? <div className="absolute inset-0 animate-pulse bg-white/5" data-motion-skeleton="" aria-hidden /> : null}
      {showPlayer ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black" style={{ opacity: drawn ? 1 : 0, transition: 'opacity 200ms' }} role="img" aria-label={t('preview', { title })}>
          <div className="h-full" style={{ aspectRatio: String(aspect), maxWidth: '100%' }}>
            <MotionRuntimePlayer
              ir={preview.ir}
              sha={preview.sha}
              variant="bare"
              {...(playerDeps && { deps: playerDeps })}
              onPlayback={onPlayback}
              onFailed={() => setFailed(true)}
            />
          </div>
        </div>
      ) : null}
      {failed ? <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/80" role="status">{t('previewFailed')}</span> : null}
    </div>
  )
}
