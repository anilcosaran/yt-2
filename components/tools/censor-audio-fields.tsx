'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import previewManifest from '@/public/audio/censor/manifest.json'
import { ToolField } from './tool-primitives'

// Generated from the renderer by workflow-engine/scripts/generate_censor_preview_audio.py.
export const CENSOR_SOUND_VERSION = previewManifest.version
export const CENSOR_SOUNDS = previewManifest.sounds
type Sound = keyof typeof CENSOR_SOUNDS
type Mode = 'off' | 'mute' | 'beep'
let stopActivePreview: (() => void) | null = null

export function censorPreviewSamples(sound: Sound, sampleRate: number, duration = previewManifest.durationSec) {
  const [frequency, amplitude] = CENSOR_SOUNDS[sound]
  return Float32Array.from({ length: Math.round(duration * sampleRate) }, (_, index) => {
    const t = index / sampleRate
    const envelope = Math.max(0, Math.min(1, t / previewManifest.rampSec, (duration - t) / previewManifest.rampSec))
    return amplitude * Math.sin(2 * Math.PI * frequency * t) * envelope
  })
}

export function CensorAudioFields({ values, audioEnabled, captionsEnabled, sourceLanguage, beepEnabled = false, onValueChange }: {
  values: Record<string, unknown>
  audioEnabled: boolean
  captionsEnabled: boolean
  sourceLanguage: string
  beepEnabled?: boolean
  onValueChange: (name: string, value: unknown) => void
}) {
  const t = useTranslations('Auto')
  const fieldId = useId()
  const [playing, setPlaying] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const stopOwn = useRef<(() => void) | null>(null)
  const mode: Mode = values.censor === 'profanity' ? values.censor_audio_mode === 'beep' ? 'beep' : 'mute' : 'off'
  const configuredSound: Sound = values.censor_sound === 'soft' || values.censor_sound === 'digital' ? values.censor_sound : 'classic'
  const [previewSound, setPreviewSound] = useState<Sound>(configuredSound)
  const sound = mode === 'beep' ? configuredSound : previewSound
  const enabled = audioEnabled || captionsEnabled
  const unsupported = !['auto', 'en', 'tr'].includes(sourceLanguage.split('-')[0].toLowerCase())
  const description = !enabled ? 'censor_v1_disabled'
    : mode === 'off' ? 'censor_v1_off_description'
    : !audioEnabled ? 'censor_v1_captions_only'
    : mode === 'beep' ? 'censor_v1_beep_description' : 'censor_v1_mute_description'
  const previewLabel = playing ? t('censor_v1_stop') : t('censor_v1_preview_sound', { sound: t(`censor_v1_${sound}`) })

  useEffect(() => () => { stopOwn.current?.() }, [mode, sound, audioEnabled])

  function preview() {
    if (stopOwn.current) { stopOwn.current(); return }
    stopActivePreview?.()
    setPreviewFailed(false)
    const audio = new Audio(`/audio/censor/${sound}-${CENSOR_SOUND_VERSION}.wav`)
    let stopped = false
    const close = () => {
      if (stopped) return
      stopped = true
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      setPlaying(false)
      if (stopActivePreview === close) stopActivePreview = null
      if (stopOwn.current === close) stopOwn.current = null
    }
    const fail = () => {
      if (stopped) return
      setPreviewFailed(true)
      close()
    }
    stopOwn.current = close
    stopActivePreview = close
    audio.onended = close
    audio.onerror = fail
    setPlaying(true)
    void audio.play().catch(fail)
  }

  function chooseMode(value: Mode) {
    stopOwn.current?.()
    setPreviewFailed(false)
    onValueChange('censor', value === 'off' ? 'off' : 'profanity')
    onValueChange('censor_audio_mode', value === 'off' ? undefined : value)
    onValueChange('censor_sound', value === 'beep' ? previewSound : undefined)
  }

  return <ToolField label={t('censor_v1_label')} hint={t('censor_v1_hint')} hintMode="tooltip"
    action={<div className="flex items-center rounded-lg border border-border/70 bg-background/60 p-0.5">
      <Select value={sound} onValueChange={(value) => {
        stopOwn.current?.()
        setPreviewFailed(false)
        setPreviewSound(value as Sound)
        if (mode === 'beep') onValueChange('censor_sound', value)
      }}>
        <SelectTrigger size="sm" aria-label={t('censor_v1_sound')}
          className="max-w-28 gap-1 rounded-md border-0 bg-transparent px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(CENSOR_SOUNDS) as Sound[]).map((value) =>
            <SelectItem key={value} value={value}>{t(`censor_v1_${value}`)}</SelectItem>)}
        </SelectContent>
      </Select>
      <button type="button" onClick={preview} title={previewLabel} aria-label={previewLabel} aria-pressed={playing}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {playing ? <Square aria-hidden="true" className="size-3.5 fill-current" /> : <Play aria-hidden="true" className="size-3.5 fill-current" />}
      </button>
    </div>}>
    <fieldset aria-describedby={`${fieldId}-description`} className="grid min-w-0 grid-cols-3 gap-1 rounded-xl border border-border/70 bg-background/50 p-1">
      <legend className="sr-only">{t('censor_v1_label')}</legend>
      {(['off', 'mute', 'beep'] as const).map((value) => {
        const disabled = !enabled || value === 'beep' && (!beepEnabled || !audioEnabled)
        return <label key={value} className="relative min-w-0"
          title={value === 'beep' && !beepEnabled ? t('censor_v1_beep_unavailable') : undefined}>
          <input type="radio" name={fieldId} value={value} checked={(enabled ? mode : 'off') === value}
            disabled={disabled} onChange={() => chooseMode(value)} className="peer sr-only" />
          <span className="flex h-8 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-40">
            {t(`censor_v1_${value}`)}
          </span>
        </label>
      })}
    </fieldset>
    <p id={`${fieldId}-description`} className="text-xs leading-5 text-muted-foreground">{t(description)}</p>
    {unsupported && mode !== 'off' && enabled ? <p role="status" className="text-xs leading-5 text-amber-700 dark:text-amber-300">{t('censor_v1_unsupported')}</p> : null}
    {previewFailed ? <p role="status" className="text-xs text-muted-foreground">{t('censor_v1_preview_failed')}</p> : null}
  </ToolField>
}
