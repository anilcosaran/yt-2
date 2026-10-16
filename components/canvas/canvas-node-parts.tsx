'use client'

import * as React from 'react'
import { AlertCircle, Check, Copy, ExternalLink, Loader2, Pause, Play } from 'lucide-react'
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import {
  CANVAS_KINDS,
  optionValue,
  type CanvasColor,
  type CanvasNodeData,
  type CanvasNodeKind,
  type CanvasNodeStatus,
  type CanvasResult,
} from './canvas-model'

/** The card's kind as a small tinted tile in its colour. */
export function CanvasKindTile({ kind, color, className }: { kind: CanvasNodeKind; color: CanvasColor; className?: string }) {
  const Icon = CANVAS_KINDS[kind].icon
  return (
    <span data-cv-color={color} className={cn('cv-tile flex size-8 shrink-0 items-center justify-center rounded-lg', className)}>
      {/* `text-current`: menus colour bare icons grey; the tile's colour wins. */}
      <Icon className="size-4 text-current" strokeWidth={2} />
    </span>
  )
}

/** Where the card stands, in words as well as colour. Nothing while it waits for its first run. */
export function CanvasStatusBadge({ status, className }: { status: CanvasNodeStatus; className?: string }) {
  const t = useTranslations('Canvas.status')
  if (status === 'idle') return null
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium',
        status === 'running' && 'bg-muted text-foreground',
        status === 'done' && 'text-muted-foreground',
        status === 'error' && 'bg-destructive/10 text-destructive',
        className,
      )}
    >
      {status === 'running' && <Loader2 className="size-3 animate-spin" />}
      {status === 'done' && <Check className="size-3 text-success" />}
      {status === 'error' && <AlertCircle className="size-3" />}
      {t(status)}
    </span>
  )
}

/** "3 dakika önce". The clock ticks every half minute, so a result newer than the last tick reads as "now", not ahead. */
export function useCanvasAgo() {
  const format = useFormatter()
  const now = useNow({ updateInterval: 30_000 })
  return (at: number) => format.relativeTime(at, Math.max(now.getTime(), at))
}

/** "Başlık fikirleri · Orta": the card's settings in one line. */
export function useCanvasOptionSummary(data: Pick<CanvasNodeData, 'kind' | 'options'>) {
  const t = useTranslations('Canvas')
  return CANVAS_KINDS[data.kind].options
    .map((option) => t(`options.${option.id}.values.${optionValue(data, option.id)}`))
    .join(' · ')
}

export function useCanvasNodeTitle(data: Pick<CanvasNodeData, 'kind' | 'title'>) {
  const t = useTranslations('Canvas')
  return data.title.trim() || t(`kinds.${data.kind}.name`)
}

const RATIO_CLASS: Record<string, string> = {
  landscape: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-[9/16]',
}

/** What the card made. `compact` on the card itself, full size in its popup. */
export function CanvasResultView({ result, color, compact = false }: { result: CanvasResult; color: CanvasColor; compact?: boolean }) {
  switch (result.type) {
    case 'text':
      return <TextResult text={result.text} compact={compact} />
    case 'images':
      return <ImagesResult images={result.images} ratio={result.ratio} compact={compact} />
    case 'video':
      return <VideoResult key={result.id} poster={result.poster} seconds={result.seconds} ratio={result.ratio} compact={compact} />
    case 'audio':
      return <AudioResult key={result.id} script={result.script} seconds={result.seconds} voice={result.voice} color={color} compact={compact} />
    case 'link':
      return <LinkResult result={result} compact={compact} />
  }
}

/** The result's place while the card works. */
export function CanvasRunningView({ kind, compact = false }: { kind: CanvasNodeKind; compact?: boolean }) {
  if (kind === 'text' || kind === 'link') {
    return (
      <div className={cn('space-y-2', compact ? 'py-1' : 'py-2')}>
        {[92, 100, 78, compact ? 0 : 86].filter(Boolean).map((width, index) => (
          <div key={index} className="cv-shimmer h-3 rounded-full" style={{ width: `${width}%` }} />
        ))}
      </div>
    )
  }
  if (kind === 'voice') return <div className={cn('cv-shimmer rounded-xl', compact ? 'h-12' : 'h-20')} />
  return <div className={cn('cv-shimmer rounded-xl', compact ? 'aspect-video' : 'aspect-video w-full max-w-3xl')} />
}

function TextResult({ text, compact }: { text: string; compact: boolean }) {
  const t = useTranslations('Canvas.result')
  if (compact) {
    return <p className="line-clamp-6 whitespace-pre-wrap text-[13px] leading-5 text-foreground/90">{text}</p>
  }
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => toast.success(t('copied')), () => toast.error(t('copyFailed')))
        }}
        className="absolute -top-1 right-0 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Copy className="size-3.5" />
        {t('copy')}
      </button>
      <p className="whitespace-pre-wrap pt-8 text-[15px] leading-7 text-foreground">{text}</p>
    </div>
  )
}

function ImagesResult({ images, ratio, compact }: { images: string[]; ratio: string; compact: boolean }) {
  const t = useTranslations('Canvas.result')
  const columns = images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
  return (
    <div className={cn('grid gap-1.5', columns, !compact && 'mx-auto w-full gap-3', !compact && (ratio === 'portrait' ? 'max-w-xl' : 'max-w-3xl'))}>
      {images.map((src, index) => (
        <div
          key={`${src}-${index}`}
          className={cn(
            'relative overflow-hidden bg-muted',
            compact ? 'rounded-lg' : 'rounded-xl',
            compact && ratio === 'portrait' ? 'aspect-[4/5]' : RATIO_CLASS[ratio] ?? 'aspect-video',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- sample pictures, shown at many sizes on a zoomable board */}
          <img src={src} alt={t('imageAlt', { index: index + 1 })} draggable={false} className="absolute inset-0 size-full object-cover" />
        </div>
      ))}
    </div>
  )
}

function VideoResult({ poster, seconds, ratio, compact }: { poster: string; seconds: number; ratio: string; compact: boolean }) {
  const t = useTranslations('Canvas.result')
  const [playing, setPlaying] = React.useState(false)
  const [round, setRound] = React.useState(0)
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-black',
        compact ? 'aspect-video rounded-lg' : cn('mx-auto w-full rounded-xl', ratio === 'portrait' ? 'aspect-[9/16] max-w-xs' : 'aspect-video max-w-3xl'),
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the clip's frame from the sample pictures */}
      <img
        key={round}
        src={poster}
        alt=""
        draggable={false}
        className={cn('absolute inset-0 size-full object-cover', playing && 'cv-playing')}
        style={{ '--cv-seconds': `${seconds}s` } as React.CSSProperties}
        onAnimationEnd={() => setPlaying(false)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <button
        type="button"
        aria-label={playing ? t('pause') : t('play')}
        onClick={() => {
          if (!playing) setRound((value) => value + 1)
          setPlaying((value) => !value)
        }}
        className={cn(
          'nodrag absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-105',
          compact ? 'size-9' : 'size-14',
        )}
      >
        {playing ? <Pause className={compact ? 'size-4' : 'size-5'} /> : <Play className={cn('translate-x-px', compact ? 'size-4' : 'size-5')} />}
      </button>
      <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
        {formatSeconds(seconds)}
      </span>
      {playing && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
          <span key={round} className="block h-full origin-left bg-white" style={{ animation: `cv-fill ${seconds}s linear forwards` }} />
        </span>
      )}
    </div>
  )
}

const WAVE = Array.from({ length: 48 }, (_, index) => 22 + Math.abs(Math.sin(index * 0.9) * Math.cos(index * 0.31)) * 78)
const SPEECH_RATE: Record<string, number> = { slow: 0.85, normal: 1, fast: 1.2 }

function AudioResult({ script, seconds, voice, color, compact }: { script: string; seconds: number; voice: string; color: CanvasColor; compact: boolean }) {
  const t = useTranslations('Canvas')
  const locale = useLocale()
  const [progress, setProgress] = React.useState<number | null>(null)
  const frame = React.useRef<number | null>(null)

  const stop = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    setProgress(null)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  React.useEffect(() => stop, [stop])

  const play = () => {
    stop()
    // The browser reads the script aloud where it can; the bars follow the estimated length either way.
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(script)
      utterance.lang = locale === 'tr' ? 'tr-TR' : 'en-US'
      utterance.rate = SPEECH_RATE.normal
      window.speechSynthesis.speak(utterance)
    }
    const started = performance.now()
    const tick = (now: number) => {
      const next = Math.min(1, (now - started) / (seconds * 1000))
      setProgress(next)
      if (next < 1) frame.current = requestAnimationFrame(tick)
      else stop()
    }
    frame.current = requestAnimationFrame(tick)
  }

  const bars = compact ? WAVE.slice(0, 32) : WAVE
  const lit = progress === null ? 0 : Math.round(progress * bars.length)
  return (
    <div data-cv-color={color} className={cn('rounded-xl border border-border bg-muted/40', compact ? 'p-2' : 'mx-auto w-full max-w-2xl p-4')}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={progress === null ? t('result.play') : t('result.pause')}
          onClick={() => (progress === null ? play() : stop())}
          className={cn('nodrag cv-tile flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105', compact ? 'size-8' : 'size-11')}
        >
          {progress === null ? <Play className="size-4 translate-x-px" /> : <Pause className="size-4" />}
        </button>
        <div aria-hidden className={cn('cv-wave min-w-0 flex-1', compact ? 'h-7' : 'h-12')}>
          {bars.map((height, index) => (
            <span key={index} data-on={index < lit} style={{ height: `${height}%` }} />
          ))}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatSeconds(seconds)}</span>
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-muted-foreground">{t('options.voice.values.' + voice)} · {script}</p>
      )}
    </div>
  )
}

function LinkResult({ result, compact }: { result: Extract<CanvasResult, { type: 'link' }>; compact: boolean }) {
  const t = useTranslations('Canvas.result')
  if (compact) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{result.host}</p>
        <p className="line-clamp-2 text-[13px] font-medium leading-5">{result.title}</p>
        <p className="line-clamp-3 text-[13px] leading-5 text-muted-foreground">{result.summary}</p>
      </div>
    )
  }
  return (
    <div className="mx-auto w-full max-w-2xl">
      <a
        href={result.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {result.host}
        <ExternalLink className="size-3" />
      </a>
      <h3 className="mt-2 font-display text-xl text-foreground">{result.title}</h3>
      <p className="mt-3 text-[15px] leading-7 text-foreground/90">{result.summary}</p>
      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('keyPoints')}</p>
      <ul className="mt-2 space-y-2">
        {result.points.map((point) => (
          <li key={point} className="flex gap-2 text-sm leading-6 text-foreground/90">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatSeconds(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
