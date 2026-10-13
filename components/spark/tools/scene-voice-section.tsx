'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'

import type { CompositionDocument } from '@/lib/spark/composition-client'
import type { NarrationVoiceFailure, NarrationVoiceQuote } from '@/lib/spark/narration-voice-client'
import { MAX_VOICE_SCENES_PER_REQUEST, MAX_VOICE_TEXT_CHARACTERS } from '@/lib/spark/narration-voice-client'
import { currentVoiceView, primaryLanguage, profileSpeaks, sceneNumberOf } from '@/lib/spark/scene-voice'
import type { VoiceProfile } from '@/lib/voice/api'

import './scene-voice.css'
import type { SparkToolContext, TimelineScene } from './spark-tool-types'
import { Icon, formatSeconds } from './studio-parts'
import { useSceneVoice, type SceneVoiceFlow } from './use-scene-voice'

/** The same address the Tools price pill sends to (`ADD_CREDITS_HREF`); a literal so the editor does not load the Tools button. */
const TOP_UP_HREF = '/settings/top-up'

type Translate = ReturnType<typeof useTranslations<'Spark.editor.sceneVoice'>>

/** The name of a language in the user's own language ("tr" -> "Turkish"/"Türkçe"); the code when the runtime has no name. */
function languageName(locale: string, tag: string | null): string {
  if (!tag) return ''
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(primaryLanguage(tag)) ?? tag
  } catch {
    return tag
  }
}

/**
 * E1-K scene panel "Voice" (D5 follow-up; QA-367…): the voice this scene's narration was made with and a picker that
 * re-speaks the SAME script with another voice. The user picks a voice (stock or their own, filtered by language, with a
 * sample to listen to), chooses "this scene" or "all scenes", sees the price BEFORE anything runs and confirms; the
 * server then launches the speech jobs, replaces each scene's narration in one undoable command when its audio is ready
 * and the editor re-reads the working copy. Nothing about the narration is written from the browser.
 */
export function SceneVoiceSection({
  ctx,
  document,
  entry,
  readOnly,
}: {
  ctx: SparkToolContext
  document: CompositionDocument
  entry: TimelineScene
  readOnly: boolean
}) {
  const t = useTranslations('Spark.editor.sceneVoice')
  const locale = useLocale()
  const sceneId = entry.scene.scene_id
  const flowT = React.useCallback(
    (key: string, values?: Record<string, string | number>) => (t as unknown as (k: string, v?: Record<string, string | number>) => string)(key, values),
    [t],
  )
  const voice = useSceneVoice({
    projectId: ctx.project.id,
    channelId: ctx.project.channelId,
    document,
    sceneId,
    toast: ctx.toast,
    t: flowT,
  })
  const { state, thisScene, flow } = voice
  const view = currentVoiceView(thisScene)
  const name = (tag: string | null) => languageName(locale, tag)

  let current: string
  if (view.kind === 'voice') current = t('named', { name: view.name, language: name(view.language) })
  else if (view.kind === 'generated') current = t('generated')
  else if (view.kind === 'supplied') current = t('supplied')
  else current = t('none')
  if ('seconds' in view && view.seconds !== null) current = t('withSeconds', { value: current, seconds: formatSeconds(view.seconds) })

  // Why the scene cannot be re-voiced right now (the picker is closed and its button disabled), as one sentence.
  let blocked: string | null = null
  if (voice.stateQuery.isError) blocked = t('stateFailed')
  else if (state && !state.enabled) blocked = t('unavailable')
  else if (readOnly) blocked = t('readOnly')
  else if (state && thisScene?.script.state === 'none') blocked = t('noScript')
  else if (state && thisScene?.script.state === 'unavailable') blocked = t('scriptUnavailable')
  else if (state && thisScene?.script.state === 'too_long') blocked = t('textTooLong', { max: MAX_VOICE_TEXT_CHARACTERS })
  const busy = voice.running || (flow.kind !== 'idle' && flow.kind !== 'error')
  const canChange = state !== undefined && blocked === null && !busy
  const listId = React.useId()

  return (
    <div className="vc" data-scene-voice>
      <div className="vc-head">
        <span>
          {t('label')}
          <small data-scene-voice-current>{voice.stateQuery.isPending ? t('loadingState') : current}</small>
        </span>
        <button
          type="button"
          className="btn ghost sm"
          aria-expanded={voice.open}
          aria-controls={listId}
          disabled={!canChange}
          title={blocked ?? undefined}
          onClick={() => voice.setOpen(!voice.open)}
        >
          <Icon name="mic" size="sm" />
          {voice.open ? t('hide') : t('change')}
        </button>
      </div>
      {blocked ? (
        <span className="vc-note" role={voice.stateQuery.isError ? 'alert' : undefined}>
          {blocked}
          {voice.stateQuery.isError ? (
            <>
              {' '}
              <button type="button" className="vc-link" onClick={() => void voice.stateQuery.refetch()}>
                {t('retry')}
              </button>
            </>
          ) : null}
        </span>
      ) : null}

      <div id={listId} hidden={!voice.open}>
        {voice.open ? <VoicePicker voice={voice} t={t} locale={locale} name={name} /> : null}
      </div>

      <FlowView flow={flow} voice={voice} t={t} locale={locale} document={document} />
    </div>
  )
}

function VoicePicker({
  voice,
  t,
  locale,
  name,
}: {
  voice: ReturnType<typeof useSceneVoice>
  t: Translate
  locale: string
  name: (tag: string | null) => string
}) {
  const { scriptLanguage, flow } = voice
  const disabled = voice.running || (flow.kind !== 'idle' && flow.kind !== 'error')
  const scriptName = name(scriptLanguage)
  const all = voice.allScenes
  const pickFirst = voice.selected === null ? t('pickFirst') : undefined
  const unsupported = voice.selected !== null && !voice.selectedSpeaks ? t('wrongLanguage', { language: scriptName }) : undefined
  const applyDisabled = disabled || voice.selected === null || !voice.selectedSpeaks
  let allDisabledTitle: string | undefined
  if (all && !all.ok) allDisabledTitle = all.reason === 'none' ? t('allNone') : t('allTooMany', { max: MAX_VOICE_SCENES_PER_REQUEST, count: all.count })
  const tabs = ['all', 'stock', 'mine'] as const

  return (
    <div className="vc-picker">
      <div className="seg" role="group" aria-label={t('tabs.label')}>
        {tabs.map((tab) => (
          <button key={tab} type="button" className={voice.tab === tab ? 'on' : undefined} aria-pressed={voice.tab === tab} onClick={() => voice.setTab(tab)}>
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>
      <div className="row">
        <label className="field">
          <select aria-label={t('language')} value={voice.languageMode} onChange={(event) => voice.setLanguageMode(event.target.value as 'script' | 'all')}>
            {scriptLanguage ? <option value="script">{t('languageScript', { language: scriptName })}</option> : null}
            <option value="all">{t('languageAll')}</option>
          </select>
          <Icon name="down" size="sm" />
        </label>
        <label className="field">
          <Icon name="search" size="sm" />
          <input aria-label={t('search')} placeholder={t('search')} value={voice.search} onChange={(event) => voice.setSearch(event.target.value)} />
        </label>
      </div>

      {voice.voicesQuery.isPending ? (
        <div className="vc-status" role="status">
          <span className="spin" aria-hidden />
          {t('loading')}
        </div>
      ) : voice.voicesQuery.isError ? (
        <div className="vc-status" role="alert">
          {t('loadFailed')}{' '}
          <button type="button" className="vc-link" onClick={() => void voice.voicesQuery.refetch()}>
            {t('retry')}
          </button>
        </div>
      ) : voice.voices.length === 0 ? (
        <div className="vc-status">{t('empty')}</div>
      ) : (
        <ul className="vc-list" aria-label={t('listLabel')}>
          {voice.voices.map((profile) => (
            <VoiceItem
              key={profile.id}
              profile={profile}
              selected={voice.selectedId === profile.id}
              playing={voice.playingId === profile.id}
              speaks={profileSpeaks(profile, scriptLanguage)}
              scriptName={scriptName}
              locale={locale}
              t={t}
              onSelect={() => voice.select(profile)}
              onPlay={() => void voice.togglePreview(profile)}
            />
          ))}
        </ul>
      )}
      {voice.previewFailed ? (
        <span className="vc-note" role="alert">
          {t('previewFailed')}
        </span>
      ) : null}

      <div className="vc-actions">
        <button type="button" className="btn primary sm" disabled={applyDisabled} title={unsupported ?? pickFirst} onClick={voice.applyToScene}>
          {t('applyScene')}
        </button>
        <button
          type="button"
          className="btn sm"
          disabled={applyDisabled || !all || !all.ok}
          title={allDisabledTitle ?? unsupported ?? pickFirst}
          onClick={voice.applyToAll}
        >
          {t('applyAll', { count: all && all.ok ? all.sceneIds.length : (all?.count ?? 0) })}
        </button>
      </div>
    </div>
  )
}

function VoiceItem({
  profile,
  selected,
  playing,
  speaks,
  scriptName,
  locale,
  t,
  onSelect,
  onPlay,
}: {
  profile: VoiceProfile
  selected: boolean
  playing: boolean
  speaks: boolean
  scriptName: string
  locale: string
  t: Translate
  onSelect: () => void
  onPlay: () => void
}) {
  const meta = [profile.catalog.accent, ...profile.catalog.tone_tags.slice(0, 2)].filter(Boolean).join(' · ')
  const languages = [...new Set(profile.supported_languages.map((tag) => languageName(locale, tag)))].slice(0, 3).join(', ')
  return (
    <li className={`vc-item${selected ? ' on' : ''}${speaks ? '' : ' off'}`} data-voice-id={profile.id}>
      <button type="button" className="vc-pick" aria-pressed={selected} disabled={!speaks} title={speaks ? undefined : t('wrongLanguage', { language: scriptName })} onClick={onSelect}>
        <b>
          {profile.display_name}
          {profile.origin !== 'stock' ? <span className="vc-badge">{t('mineBadge')}</span> : null}
        </b>
        <small>{[meta, languages].filter(Boolean).join(' · ')}</small>
      </button>
      {profile.preview_available ? (
        <button
          type="button"
          className="btn ghost sm vc-play"
          aria-pressed={playing}
          aria-label={playing ? t('stop', { name: profile.display_name }) : t('play', { name: profile.display_name })}
          onClick={onPlay}
        >
          <Icon name={playing ? 'stop' : 'play'} size="sm" />
        </button>
      ) : null}
    </li>
  )
}

const credits = (locale: string, value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)

function FlowView({
  flow,
  voice,
  t,
  locale,
  document,
}: {
  flow: SceneVoiceFlow
  voice: ReturnType<typeof useSceneVoice>
  t: Translate
  locale: string
  document: CompositionDocument
}) {
  if (voice.running) {
    return (
      <div className="vc-card" role="status" data-voice-running>
        <div className="vc-status">
          <span className="spin" aria-hidden />
          {voice.runTotal > 1 ? t('runningMany', { done: voice.runReady, total: voice.runTotal }) : t('running')}
        </div>
        <span className="vc-note">{t('runningHint')}</span>
      </div>
    )
  }
  if (flow.kind === 'idle') return null
  if (flow.kind === 'quoting' || flow.kind === 'starting') {
    return (
      <div className="vc-status" role="status">
        <span className="spin" aria-hidden />
        {flow.kind === 'quoting' ? t('quoting') : t('starting')}
      </div>
    )
  }
  if (flow.kind === 'error') return <FlowError failure={flow.failure} t={t} onDismiss={voice.dismissError} />
  return <QuoteCard flow={flow} voice={voice} t={t} locale={locale} document={document} />
}

function FlowError({ failure, t, onDismiss }: { failure: NarrationVoiceFailure; t: Translate; onDismiss: () => void }) {
  return (
    <div className="vc-card vc-error" role="alert" data-voice-error={failure}>
      <span>{t(`errors.${failure}`)}</span>
      <div className="vc-actions">
        {failure === 'insufficient_balance' ? (
          <a className="btn primary sm" href={TOP_UP_HREF} target="_blank" rel="noopener">
            {t('topUp')}
          </a>
        ) : null}
        <button type="button" className="btn ghost sm" onClick={onDismiss}>
          {t('close')}
        </button>
      </div>
    </div>
  )
}

function QuoteCard({
  flow,
  voice,
  t,
  locale,
  document,
}: {
  flow: Extract<SceneVoiceFlow, { kind: 'quote' }>
  voice: ReturnType<typeof useSceneVoice>
  t: Translate
  locale: string
  document: CompositionDocument
}) {
  const quote: NarrationVoiceQuote = flow.quote
  const voiceName = quote.voice.display_name ?? voice.selected?.display_name ?? t('voiceFallback')
  const billable = quote.billable_scenes > 0
  // A recording the user added is replaced too: say so before they pay.
  const replacesRecording = quote.scenes.some((scene) => scene.state === 'quote' && voice.state?.scenes.find((candidate) => candidate.scene_id === scene.scene_id)?.narration?.source_mode === 'supplied_audio')
  return (
    <div className="vc-card" role="group" aria-label={t('quoteTitle', { voice: voiceName })} data-voice-quote>
      <b>{t('quoteTitle', { voice: voiceName })}</b>
      <ul className="vc-lines">
        {quote.scenes.map((scene) => (
          <li key={scene.scene_id}>
            <span>{t('quoteScene', { n: sceneNumberOf(document, scene.scene_id), characters: scene.characters ?? 0 })}</span>
            <span>{scene.state === 'quote' ? t('credits', { credits: credits(locale, scene.estimated_credits) }) : t(`quoteStates.${scene.state}`)}</span>
          </li>
        ))}
      </ul>
      {billable ? (
        <div className="vc-total">
          <b>{t('total')}</b>
          <span data-voice-price>{t('credits', { credits: credits(locale, quote.total_credits) })}</span>
        </div>
      ) : (
        <span className="vc-note">{t('nothingToDo')}</span>
      )}
      {flow.priceChanged ? (
        <span className="vc-note" role="status">
          {t('priceChanged')}
        </span>
      ) : null}
      {billable ? <span className="vc-note">{t('note')}</span> : null}
      {billable && replacesRecording ? <span className="vc-note">{t('replacesRecording')}</span> : null}
      <div className="vc-actions">
        {billable ? (
          <button type="button" className="btn primary sm" onClick={voice.confirm}>
            {t('confirm', { credits: credits(locale, quote.total_credits) })}
          </button>
        ) : null}
        <button type="button" className="btn ghost sm" onClick={voice.cancel}>
          {billable ? t('cancel') : t('close')}
        </button>
      </div>
    </div>
  )
}
