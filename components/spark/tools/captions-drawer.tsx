'use client'

import * as React from 'react'
import { useFormatter, useTranslations } from 'next-intl'

import type { CaptionSource, CaptionStyle } from '@/lib/spark/captions-client'

import type { SourceFlow } from './use-spark-captions'
import { EmptyNote, Icon, Toggle } from './studio-parts'

const CAPTION_POSITIONS = ['top', 'middle', 'bottom'] as const

export type CaptionsDrawerProps = {
  /** `loading` until the first read of the sources; `error` when it failed. */
  status: 'loading' | 'ready' | 'error'
  /** `COMPOSITION_CAPTIONS_ENABLED` on the gateway: off = no new captions (existing tracks can still be turned off). */
  enabled: boolean
  sources: readonly CaptionSource[]
  /** A project holds at most `max` caption tracks; at the limit only a source that already has one can go on. */
  trackLimit: { max: number; used: number }
  flows: Readonly<Record<string, SourceFlow>>
  /** Sources whose transcription was requested or runs (T1R-1): Add stays closed for them until their track exists. */
  watched: ReadonlySet<string>
  /** Scene numbers (1-based, timeline order) of a source's scenes. */
  sceneNumbers(sceneIds: readonly string[]): number[]
  styles: readonly CaptionStyle[]
  /** The look of the first caption track (a platform look), null when it uses the project's Kit or there is no track. */
  selectedStyle: CaptionStyle['preset_id'] | null
  /** The project has at least one caption track. */
  hasTracks: boolean
  canWrite: boolean
  writeTitle: string | undefined
  onBegin(sourceId: string): void
  onConfirm(sourceId: string): void
  onCancel(sourceId: string): void
  onRemove(source: CaptionSource): void
  onTurnOffAll(): void
  onStyle(style: CaptionStyle): void
  onRetry(): void
}

/**
 * Captions drawer of the design (E1-G): "Show captions" is on while the project has caption tracks. Turning captions on
 * picks a source (the AI narration, a voice-over or an uploaded video), shows the price of transcribing it (a source
 * that already has a transcript is free), and on confirmation runs the transcription; the burned-in track appears on the
 * timeline when it ends. The four style tiles are the platform looks (Brand Kit caption tokens); position is the bottom
 * safe area in v1 and a second language stays a later feature.
 */
export function CaptionsDrawer(props: CaptionsDrawerProps) {
  const t = useTranslations('Spark.editor.captions')
  const flowT = useTranslations('Spark.editor.captions.flow')
  const comingSoon = useTranslations('Spark.editor')('comingSoon')
  const format = useFormatter()
  const { canWrite, writeTitle } = props
  const credits = (value: number) => format.number(value, { maximumFractionDigits: 2 })

  const sourceTitle = (source: CaptionSource) => {
    const kind = source.kind === 'narration' ? flowT('narration') : source.kind === 'voice_over' ? flowT('voiceOver') : flowT('video')
    const numbers = props.sceneNumbers(source.scene_ids)
    if (numbers.length === 0) return kind
    const where = numbers.length === 1 ? flowT('inScene', { number: numbers[0]! }) : flowT('inScenes', { numbers: numbers.join(', ') })
    return `${kind} · ${where}`
  }

  const stateText = (source: CaptionSource) => {
    if (source.track) return flowT('stateOn')
    switch (source.transcript.state) {
      case 'processing':
        return flowT('stateProcessing')
      case 'ready':
        return flowT('stateReady')
      case 'failed':
        return flowT('stateFailed')
      default:
        return flowT('stateNone')
    }
  }

  const tile = (preset: CaptionStyle['preset_id'], label: string, sample: React.ReactNode) => {
    const style = props.styles.find((candidate) => candidate.preset_id === preset)
    const disabled = !canWrite || !props.hasTracks || !style
    return (
      <button
        key={preset}
        type="button"
        className={`cap-tile${props.selectedStyle === preset ? ' on' : ''}`}
        aria-pressed={props.selectedStyle === preset}
        aria-label={label}
        disabled={disabled}
        title={writeTitle ?? (props.hasTracks ? undefined : flowT('needsTrack'))}
        onClick={() => style && props.onStyle(style)}
      >
        {sample}
      </button>
    )
  }

  const atLimit = props.trackLimit.used >= props.trackLimit.max
  const firstOpen = props.sources.find(
    (source) => !source.track && !props.flows[source.source_id] && !props.watched.has(source.source_id) && source.transcript.state !== 'processing' && !atLimit,
  )
  const toggleTitle = writeTitle ?? (props.hasTracks ? undefined : props.sources.length === 0 ? flowT('needsSources') : flowT('turnOnHint'))

  const flowPanel = (source: CaptionSource) => {
    const flow = props.flows[source.source_id]
    if (!flow) return null
    const note: React.CSSProperties = { color: 'var(--st-text-3)', fontSize: 12.5, margin: '0 0 8px' }
    if (flow.phase === 'quoting') {
      return (
        <div className="cap-flow" style={{ padding: '0 4px 12px' }} role="status">
          <p style={{ ...note, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spin" aria-hidden />
            {flowT('quoting')}
          </p>
        </div>
      )
    }
    if (flow.phase === 'error') {
      return (
        <div className="cap-flow" style={{ padding: '0 4px 12px' }} role="alert">
          <p style={{ ...note, color: 'var(--st-danger, #ef4444)' }}>{flowT(`errors.${flow.failure}`)}</p>
          <button type="button" className="btn sm" onClick={() => props.onCancel(source.source_id)}>
            {flowT('cancel')}
          </button>
        </div>
      )
    }
    const quote = flow.quote
    const free = quote.state === 'transcript_ready'
    const starting = flow.phase === 'starting'
    return (
      <div className="cap-flow" style={{ padding: '0 4px 12px' }}>
        {flow.phase === 'quote' && flow.changed ? <p style={{ ...note, color: 'var(--st-text)' }}>{flowT('quoteChanged')}</p> : null}
        {flow.phase === 'quote' && flow.unsure ? <p style={{ ...note, color: 'var(--st-text)' }}>{flowT('unsure')}</p> : null}
        <p style={note}>{free ? flowT('quoteFree') : flowT('quotePaid', { credits: credits(quote.estimated_credits) })}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn primary sm" disabled={starting || !canWrite} title={writeTitle} onClick={() => props.onConfirm(source.source_id)}>
            {starting ? <span className="spin" aria-hidden /> : null}
            {starting ? flowT('starting') : free ? flowT('confirmFree') : flowT('confirmPaid', { credits: credits(quote.estimated_credits) })}
          </button>
          <button type="button" className="btn ghost sm" disabled={starting} onClick={() => props.onCancel(source.source_id)}>
            {flowT('cancel')}
          </button>
        </div>
      </div>
    )
  }

  const sourceRow = (source: CaptionSource) => {
    const title = sourceTitle(source)
    const flow = props.flows[source.source_id]
    const processing = source.transcript.state === 'processing' && !source.track
    const busy = flow !== undefined || processing || props.watched.has(source.source_id)
    return (
      <React.Fragment key={source.source_id}>
        <div className="opt-row" data-caption-source={source.source_id} data-state={source.track ? 'on' : source.transcript.state}>
          <span className="opt-ic">
            <Icon name={source.kind === 'video' ? 'video' : 'mic'} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{title}</b>
            <small style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {processing ? <span className="spin" aria-hidden /> : null}
              {stateText(source)}
            </small>
          </span>
          {source.track ? (
            <button type="button" className="btn ghost sm" disabled={!canWrite} title={writeTitle} aria-label={flowT('removeLabel', { source: title })} onClick={() => props.onRemove(source)}>
              {flowT('remove')}
            </button>
          ) : (
            <button
              type="button"
              className="btn sm"
              disabled={!canWrite || busy || !props.enabled || atLimit}
              title={writeTitle ?? (atLimit ? flowT('limitReached', { max: props.trackLimit.max }) : undefined)}
              aria-label={flowT('addLabel', { source: title })}
              onClick={() => props.onBegin(source.source_id)}
            >
              {flowT('add')}
            </button>
          )}
        </div>
        {flowPanel(source)}
      </React.Fragment>
    )
  }

  let sourcesBody: React.ReactNode
  if (props.status === 'loading') {
    sourcesBody = (
      <p role="status" style={{ color: 'var(--st-text-3)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px' }}>
        <span className="spin" aria-hidden />
        {flowT('loading')}
      </p>
    )
  } else if (props.status === 'error') {
    sourcesBody = (
      <div role="alert" style={{ margin: '0 4px' }}>
        <p style={{ color: 'var(--st-danger, #ef4444)', fontSize: 12.5 }}>{flowT('loadFailed')}</p>
        <button type="button" className="btn sm" onClick={props.onRetry}>
          {flowT('retry')}
        </button>
      </div>
    )
  } else if (!props.enabled) {
    sourcesBody = <EmptyNote title={flowT('unavailableTitle')} body={flowT('unavailable')} />
  } else if (props.sources.length === 0) {
    sourcesBody = <EmptyNote title={flowT('noSourcesTitle')} body={flowT('noSources')} />
  } else {
    sourcesBody = (
      <>
        {props.sources.map(sourceRow)}
        {atLimit && props.sources.some((source) => !source.track) ? (
          <p role="note" style={{ color: 'var(--st-text-3)', fontSize: 11.5, margin: '0 4px' }}>
            {flowT('limitReached', { max: props.trackLimit.max })}
          </p>
        ) : null}
      </>
    )
  }

  return (
    <div className="dr-body">
      <Toggle
        label={t('show')}
        hint={t('showHint')}
        on={props.hasTracks}
        disabled={!canWrite || (props.hasTracks ? false : !props.enabled || !firstOpen)}
        title={toggleTitle}
        onClick={() => (props.hasTracks ? props.onTurnOffAll() : firstOpen && props.onBegin(firstOpen.source_id))}
        style={{ padding: 4 }}
      />
      <div className="dr-label">{flowT('sources')}</div>
      {sourcesBody}
      <div className="dr-label">{t('style')}</div>
      <div className="grid2">
        {tile(
          'classic',
          t('styleClassic'),
          <span style={{ background: 'rgba(0,0,0,.75)', color: '#fff', fontSize: 10, padding: '2px 5px', borderRadius: 3 }}>{t('styleClassic')}</span>,
        )}
        {tile(
          'bold',
          t('styleBoldLabel'),
          <span style={{ color: '#fff', font: '700 12px var(--st-font-ui)', textShadow: '0 1px 0 #000,0 0 6px #000' }}>
            {t.rich('styleBold', { pop: (chunks) => <span style={{ color: '#fde047' }}>{chunks}</span> })}
          </span>,
        )}
        {tile(
          'karaoke',
          t('styleKaraokeLabel'),
          <span style={{ color: '#fff', fontSize: 10.5 }}>
            {t.rich('styleKaraoke', {
              hl: (chunks) => <span style={{ background: '#4353ff', padding: '0 2px', borderRadius: 2 }}>{chunks}</span>,
            })}
          </span>,
        )}
        {tile(
          'minimal',
          t('styleMinimal'),
          <span style={{ color: 'rgba(255,255,255,.85)', fontSize: 10, letterSpacing: '.02em' }}>{t('styleMinimal')}</span>,
        )}
      </div>
      <p style={{ color: 'var(--st-text-3)', fontSize: 11.5, margin: '8px 4px 0' }}>{flowT('styleHint')}</p>
      <div className="dr-label">{t('position')}</div>
      <div className="iseg">
        {CAPTION_POSITIONS.map((position) => (
          <button
            key={position}
            type="button"
            className={position === 'bottom' ? 'on' : undefined}
            aria-pressed={position === 'bottom'}
            disabled={position !== 'bottom'}
            title={position === 'bottom' ? undefined : `${t(`positions.${position}`)} · ${flowT('later')}`}
          >
            {t(`positions.${position}`)}
          </button>
        ))}
      </div>
      <p style={{ color: 'var(--st-text-3)', fontSize: 11.5, margin: '8px 4px 0' }}>{flowT('positionNote')}</p>
      <div className="dr-label">{t('languages')}</div>
      <button type="button" className="opt-row" disabled title={`${comingSoon} · ${flowT('later')}`}>
        <span className="opt-ic">
          <Icon name="globe" />
        </span>
        <span>
          <b>{t('addLanguage')}</b>
          <small>{t('addLanguageHint')}</small>
        </span>
      </button>
    </div>
  )
}
