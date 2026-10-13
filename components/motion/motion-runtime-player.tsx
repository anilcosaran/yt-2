'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Pause, Play } from 'lucide-react'

import { listPlatformFonts } from '@/lib/brand-kit/api'
import { PlaybackStore } from '@/lib/spark/playback-store'
import { facesForIr, type PreviewFontFace } from '@/lib/spark/stage/preview-contract'
import { loadMotionRuntime, type MotionRuntimeModule } from '@/lib/spark/stage/runtime-api'
import { SceneRuntimePool, type MountedScene } from '@/lib/spark/stage/runtime-host'
import { formatFrameTime } from '@/lib/spark/stage/scene-plan'
import { createStageFontLoader, type StageFontLoader } from '@/lib/spark/stage/stage-fonts'

/**
 * E1-D: the Motion area's picture. The deterministic server compile of a draft (`motion-ir@1`) is drawn by the SAME pinned
 * `motion-runtime` host the Spark stage uses (`SceneRuntimePool`, `mode: 'preview'`, seek-only): a frame is exactly
 * `runtime.seek(frame)`, nothing is laid out again in the browser. The pinned font faces the compile measured with are
 * loaded and verified before the first frame (no frame in a fallback face, F45); a face or the runtime that cannot be
 * loaded is an explicit failure, never a guess. Play/pause and a scrubber drive a `PlaybackStore`.
 */

export type MotionPlayerDeps = {
  loadRuntime: () => Promise<MotionRuntimeModule>
  /** The platform catalogue faces (`GET /api/v1/brand/fonts`) as pinned preview faces. */
  loadFaces: () => Promise<PreviewFontFace[]>
  fonts: StageFontLoader
}

export const DEFAULT_PLAYER_DEPS: MotionPlayerDeps = {
  loadRuntime: () => loadMotionRuntime(),
  loadFaces: async () =>
    (await listPlatformFonts()).map((face) => ({
      font_id: face.font.font_id,
      font_revision: face.font.font_revision,
      family: face.family,
      weight: face.weight,
      style: face.style === 'italic' ? ('italic' as const) : ('normal' as const),
      sha256: face.font.sha256,
      url: `/api/v1/composition/fonts/${face.font.sha256}`,
    })),
  fonts: createStageFontLoader(),
}

type PlayerState = { status: 'loading' } | { status: 'ready'; playback: PlaybackStore; totalFrames: number } | { status: 'failed'; code: 'runtime_unavailable' | 'font_unavailable' | 'ir_refused' }

type CanvasOf = { width: number; height: number }

function canvasOf(ir: Record<string, unknown>): CanvasOf {
  const canvas = ir['canvas'] as { width?: unknown; height?: unknown } | undefined
  return { width: typeof canvas?.width === 'number' ? canvas.width : 1920, height: typeof canvas?.height === 'number' ? canvas.height : 1080 }
}

export function MotionRuntimePlayer({
  ir,
  sha,
  deps = DEFAULT_PLAYER_DEPS,
  variant = 'full',
  onPlayback,
  onFailed,
}: {
  ir: Record<string, unknown>
  sha: string
  deps?: MotionPlayerDeps
  /**
   * `full` (the editor, the catalog dialog): framed picture with the play/pause bar and scrubber. `bare` (a catalog card): the
   * picture only, filling its box, driven from outside through `onPlayback`.
   */
  variant?: 'full' | 'bare'
  /** The playback store once the first frame is drawn (the owner plays/pauses it); null when the picture is torn down. */
  onPlayback?: (playback: PlaybackStore | null) => void
  /** The runtime, a font or the document could not be loaded: the picture will not appear. */
  onFailed?: (code: 'runtime_unavailable' | 'font_unavailable' | 'ir_refused') => void
}) {
  const t = useTranslations('Motion.editor.preview')
  const hostRef = React.useRef<HTMLDivElement>(null)
  const [state, setState] = React.useState<PlayerState>({ status: 'loading' })
  // The owner's callbacks are read at call time, so a new closure never re-mounts the picture.
  const callbacks = React.useRef({ onPlayback, onFailed })
  React.useEffect(() => {
    callbacks.current = { onPlayback, onFailed }
  })
  const canvas = canvasOf(ir)
  const fps = typeof ir['fps'] === 'number' && ir['fps'] > 0 ? ir['fps'] : 30
  const durationFrames = typeof ir['duration_frames'] === 'number' ? ir['duration_frames'] : 0

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let cancelled = false
    let pool: SceneRuntimePool | null = null
    let playback: PlaybackStore | null = null
    let unsubscribe: (() => void) | null = null
    let observer: ResizeObserver | null = null
    setState({ status: 'loading' })

    const run = async () => {
      let runtime: MotionRuntimeModule
      try {
        runtime = await deps.loadRuntime()
      } catch {
        if (!cancelled) {
          setState({ status: 'failed', code: 'runtime_unavailable' })
          callbacks.current.onFailed?.('runtime_unavailable')
        }
        return
      }
      try {
        const faces = facesForIr(await deps.loadFaces(), ir)
        await deps.fonts.ensure(faces)
      } catch {
        if (!cancelled) {
          setState({ status: 'failed', code: 'font_unavailable' })
          callbacks.current.onFailed?.('font_unavailable')
        }
        return
      }
      if (cancelled) return
      let scene: MountedScene
      try {
        pool = new SceneRuntimePool(runtime, host, null)
        pool.setScale(host.clientWidth > 0 ? host.clientWidth / canvas.width : 1)
        scene = pool.activate({ sceneId: 'motion-preview', startFrame: 0, durationFrames, dependencyHash: sha, ir, assets: {}, nativeLayers: [], warnings: [] })
      } catch {
        pool?.dispose()
        pool = null
        if (!cancelled) {
          setState({ status: 'failed', code: 'ir_refused' })
          callbacks.current.onFailed?.('ir_refused')
        }
        return
      }
      playback = new PlaybackStore()
      playback.configure({ totalFrames: durationFrames, fps: { num: fps, den: 1 } })
      scene.seek(0)
      unsubscribe = playback.subscribeFrame((frame) => scene.seek(frame))
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => pool?.setScale(host.clientWidth > 0 ? host.clientWidth / canvas.width : 1))
        observer.observe(host)
      }
      setState({ status: 'ready', playback, totalFrames: durationFrames })
      callbacks.current.onPlayback?.(playback)
    }
    void run()

    return () => {
      cancelled = true
      if (playback) callbacks.current.onPlayback?.(null)
      unsubscribe?.()
      observer?.disconnect()
      playback?.dispose()
      pool?.dispose()
    }
    // The IR is identified by its digest: a new compile (a new `sha`) mounts a new picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sha, deps])

  return (
    <div className={variant === 'bare' ? 'size-full' : 'flex flex-col gap-2'} data-motion-player={state.status}>
      <div
        ref={hostRef}
        className={variant === 'bare' ? 'relative w-full overflow-hidden' : 'relative w-full overflow-hidden rounded-md border border-border'}
        style={{
          aspectRatio: `${canvas.width} / ${canvas.height}`,
          // A neutral checkerboard: an overlay Motion is transparent where it draws nothing.
          backgroundColor: '#1b1b1f',
          backgroundImage: 'linear-gradient(45deg,#26262b 25%,transparent 25%,transparent 75%,#26262b 75%),linear-gradient(45deg,#26262b 25%,transparent 25%,transparent 75%,#26262b 75%)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0,12px 12px',
        }}
        role="img"
        aria-label={t('player.frame')}
      >
        {state.status === 'loading' ? (
          <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('player.loading')}
          </span>
        ) : null}
        {state.status === 'failed' ? (
          <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground" role="alert">
            {t(`player.failed.${state.code}`)}
          </span>
        ) : null}
      </div>
      {state.status === 'ready' && variant === 'full' ? <PlayerBar playback={state.playback} totalFrames={state.totalFrames} fps={fps} /> : null}
    </div>
  )
}

function PlayerBar({ playback, totalFrames, fps }: { playback: PlaybackStore; totalFrames: number; fps: number }) {
  const t = useTranslations('Motion.editor.preview')
  const { playing } = React.useSyncExternalStore(playback.subscribe, playback.getSnapshot, playback.getSnapshot)
  const subscribeFrame = React.useCallback((listener: () => void) => playback.subscribeFrame(() => listener()), [playback])
  const frame = React.useSyncExternalStore(subscribeFrame, () => playback.frame, () => playback.frame)
  const rate = { num: fps, den: 1 }
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border hover:bg-accent"
        aria-label={playing ? t('player.pause') : t('player.play')}
        title={playing ? t('player.pause') : t('player.play')}
        onClick={() => playback.toggle()}
      >
        {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </button>
      <input
        type="range"
        className="min-w-0 flex-1"
        aria-label={t('player.scrub')}
        min={0}
        max={Math.max(0, totalFrames - 1)}
        step={1}
        value={frame}
        onChange={(event) => playback.seek(Number(event.target.value))}
      />
      <span className="font-mono text-xs text-muted-foreground" aria-label={t('player.time')}>
        {formatFrameTime(frame, rate)} / {formatFrameTime(Math.max(0, totalFrames - 1), rate)}
      </span>
    </div>
  )
}
