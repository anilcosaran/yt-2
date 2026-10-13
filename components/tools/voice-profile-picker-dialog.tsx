'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AudioLines,
  Bookmark,
  Check,
  Loader2,
  Play,
  Volume2,
  RefreshCw,
  Search,
  Shuffle,
  Sparkles,
  Square,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LanguageFlagIcon } from '@/components/i18n/language-flag-icon'
import {
  favoriteVoiceProfile,
  getVoiceProfilePreview,
  listVoiceProfileFavorites,
  unfavoriteVoiceProfile,
  type VoiceProfile,
} from '@/lib/voice/api'
import {
  getWorkflowAgentOutput,
  getWorkflowAgentStatus,
  launchWorkflowAgent,
  cancelWorkflowAgent,
} from '@/lib/workflows/api'
import { publicRuntimeErrorMessageForError } from '@/lib/public-runtime-error'
import { getLanguageDisplay } from '@/lib/i18n/language-display'
import { isAmbiguousMutationError } from '@/lib/idempotency/client-mutation-control'
import {
  cancelVoicePreviewAgentAttempt,
  clearVoicePreviewAttempt,
  saveVoicePreviewAgentId,
  voicePreviewAttemptScope,
  voicePreviewAttemptStore,
  voicePreviewOperationFingerprint,
  type VoicePreviewAttempt,
  type VoicePreviewOperation,
} from '@/lib/voice/preview-attempt'
import { registerBrowserPrincipalLifecycleResetter } from '@/lib/auth/browser-principal-storage'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'
import { useToolCopy } from '@/lib/i18n/use-tool-copy'

type VoicePickerTab = 'featured' | 'all' | 'mine' | 'saved'

export type VoicePickerHeadingState = {
  profile: VoiceProfile | null
  title: string
  previewing: boolean
  hasSelection: boolean
  selectionLabel: string | null
}

export function pickDefaultPublicVoiceProfile(profiles: VoiceProfile[]): VoiceProfile | null {
  const ready = profiles.filter((profile) => profile.origin === 'stock' && profile.status === 'ready')
  return ready.find((profile) => profile.catalog.featured) ?? ready[0] ?? null
}

export function resolveVoicePickerHeading(
  profiles: VoiceProfile[],
  value: string,
  focusedProfileId: string | null,
): VoicePickerHeadingState {
  const selectedProfile = profiles.find((profile) => profile.id === value) ?? null
  const focusedProfile = profiles.find((profile) => profile.id === focusedProfileId) ?? null
  const selectionLabel = selectedProfile?.display_name
    ?? (value === 'default' ? 'System default voice' : null)
  const previewing = Boolean(focusedProfile && focusedProfile.id !== selectedProfile?.id)

  return {
    profile: previewing ? focusedProfile : selectedProfile,
    title: previewing
      ? `Previewing ${focusedProfile!.display_name}`
      : selectionLabel ?? 'Choose a voice',
    previewing,
    hasSelection: Boolean(selectionLabel),
    selectionLabel,
  }
}

export function VoiceProfilePickerDialog({
  channelId,
  modelId,
  modelLanguages,
  defaultLanguage,
  profiles,
  value,
  disabled = false,
  stockLoading = false,
  customLoading = false,
  stockError = false,
  customError = false,
  onRetryStock,
  onRetryCustom,
  onValueChange,
  compact = false,
}: {
  channelId: string | null
  modelId: string
  modelLanguages: string[]
  defaultLanguage?: string | null
  profiles: VoiceProfile[]
  value: string
  compact?: boolean
  disabled?: boolean
  stockLoading?: boolean
  customLoading?: boolean
  stockError?: boolean
  customError?: boolean
  onRetryStock?: () => void
  onRetryCustom?: () => void
  onValueChange: (voiceProfileId: string) => void
}) {
  const toolCopy = useToolCopy()
  const tAuto = useTranslations('Auto')
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<VoicePickerTab>('featured')
  const [query, setQuery] = React.useState('')
  const [language, setLanguage] = React.useState('all')
  const [gender, setGender] = React.useState('all')
  const [ageBand, setAgeBand] = React.useState('all')
  const [accent, setAccent] = React.useState('all')
  const [tag, setTag] = React.useState('all')
  const [playingId, setPlayingId] = React.useState<string | null>(null)
  const [focusedProfileId, setFocusedProfileId] = React.useState<string | null>(null)
  const [customPreviewOpen, setCustomPreviewOpen] = React.useState(false)
  const [previewText, setPreviewText] = React.useState('Hello! This is a preview of my Youtorch voice.')
  const [previewLanguage, setPreviewLanguage] = React.useState(defaultLanguage ?? '')
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = React.useState<string | null>(null)
  const [generatingPreview, setGeneratingPreview] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set())
  const [favoritesLoading, setFavoritesLoading] = React.useState(false)
  const [favoriteBusyId, setFavoriteBusyId] = React.useState<string | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const previewRequestRef = React.useRef(0)
  const generationRef = React.useRef(0)
  const generatedPreviewAbortRef = React.useRef<AbortController | null>(null)
  const generatedPreviewAgentIdRef = React.useRef<string | null>(null)
  const generatedPreviewAttemptRef = React.useRef<VoicePreviewAttempt | null>(null)
  const generatedPreviewCancellationRef = React.useRef<Promise<boolean> | null>(null)
  const selected = profiles.find((profile) => profile.id === value) ?? null
  const catalogLoading = stockLoading || customLoading
  const catalogUnavailable = stockError && customError
  const focusedProfile = profiles.find((profile) => profile.id === focusedProfileId) ?? null
  const heading = resolveVoicePickerHeading(profiles, value, focusedProfileId)
  const headingProfile = heading.profile
  const previewLanguages = React.useMemo(() => {
    if (!focusedProfile) return modelLanguages
    const supported = new Set(focusedProfile.supported_languages)
    const compatible = modelLanguages.filter((item) => supported.has(item))
    return compatible.length > 0 ? compatible : focusedProfile.supported_languages
  }, [focusedProfile, modelLanguages])
  const languages = React.useMemo(
    () => [...new Set(profiles.flatMap((profile) => profile.supported_languages))]
      .sort((left, right) => left.localeCompare(right)),
    [profiles],
  )
  const accents = React.useMemo(
    () => [...new Set(profiles.flatMap((profile) => profile.catalog.accent ? [profile.catalog.accent] : []))]
      .sort((left, right) => left.localeCompare(right)),
    [profiles],
  )
  const tags = React.useMemo(
    () => [...new Set(profiles.flatMap((profile) => [
      ...profile.catalog.tone_tags,
      ...profile.catalog.use_case_tags,
    ]))].sort((left, right) => left.localeCompare(right)),
    [profiles],
  )
  const visibleProfiles = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return profiles.filter((profile) => {
      if (tab === 'featured' && !profile.catalog.featured) return false
      if (tab === 'mine' && profile.origin === 'stock') return false
      if (tab === 'saved' && !savedIds.has(profile.id)) return false
      if (language !== 'all' && !profile.supported_languages.includes(language)) return false
      if (gender !== 'all' && profile.catalog.gender !== gender) return false
      if (ageBand !== 'all' && profile.catalog.age_band !== ageBand) return false
      if (accent !== 'all' && profile.catalog.accent !== accent) return false
      if (
        tag !== 'all'
        && !profile.catalog.tone_tags.includes(tag)
        && !profile.catalog.use_case_tags.includes(tag)
      ) return false
      return !normalizedQuery
        || profile.display_name.toLocaleLowerCase().includes(normalizedQuery)
        || profile.catalog.description?.toLocaleLowerCase().includes(normalizedQuery)
        || profile.catalog.tone_tags.some((item) => item.includes(normalizedQuery))
        || profile.catalog.use_case_tags.some((item) => item.includes(normalizedQuery))
        || profile.default_language?.toLocaleLowerCase().includes(normalizedQuery)
    })
  }, [accent, ageBand, gender, language, profiles, query, savedIds, tab, tag])
  const tabUsesStockCatalog = tab !== 'mine'
  const tabUsesCustomCatalog = tab !== 'featured'
  const activeCatalogLoading = (
    (tabUsesStockCatalog && stockLoading)
    || (tabUsesCustomCatalog && customLoading)
  )
  const activeStockError = tabUsesStockCatalog && stockError
  const activeCustomError = tabUsesCustomCatalog && customError
  const activeCatalogError = activeStockError || activeCustomError
  const activeCatalogUnavailable = tab === 'featured'
    ? stockError
    : tab === 'mine'
      ? customError
      : stockError && customError
  const retryActiveCatalog = () => {
    if (activeStockError) onRetryStock?.()
    if (activeCustomError) onRetryCustom?.()
  }

  const cancelGeneratedPreview = () => {
    generationRef.current += 1
    generatedPreviewAbortRef.current?.abort()
    generatedPreviewAbortRef.current = null
    const agentId = generatedPreviewAgentIdRef.current
    const attempt = generatedPreviewAttemptRef.current
    generatedPreviewAgentIdRef.current = null
    generatedPreviewAttemptRef.current = null
    let cancellation = generatedPreviewCancellationRef.current ?? Promise.resolve(true)
    if (agentId) {
      cancellation = cancellation.then(async () => {
        await cancelVoicePreviewAgentAttempt({
          attempt,
          agentId,
          cancelAgent: cancelWorkflowAgent,
        })
        return true
      })
      generatedPreviewCancellationRef.current = cancellation
      void cancellation.finally(() => {
        if (generatedPreviewCancellationRef.current === cancellation) {
          generatedPreviewCancellationRef.current = null
        }
      })
    }
    setGeneratingPreview(false)
    return cancellation
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setCustomPreviewOpen(false)
      const initialProfile = selected
      setFocusedProfileId(initialProfile?.id ?? null)
      if (initialProfile?.catalog.demo_text) {
        setPreviewText(initialProfile.catalog.demo_text)
      }
      setPreviewLanguage((current) => (
        previewLanguages.includes(current)
          ? current
          : defaultLanguage
            && previewLanguages.includes(defaultLanguage)
            ? defaultLanguage
            : initialProfile?.catalog.demo_language
              ?? initialProfile?.default_language
              ?? previewLanguages[0]
              ?? ''
      ))
      if (channelId) {
        setFavoritesLoading(true)
        void listVoiceProfileFavorites()
          .then((ids) => setSavedIds(new Set(ids)))
          .catch(() => setSavedIds(new Set()))
          .finally(() => setFavoritesLoading(false))
      } else {
        setSavedIds(new Set())
        setFavoritesLoading(false)
      }
      return
    }
    previewRequestRef.current += 1
    cancelGeneratedPreview()
    audioRef.current?.pause()
    audioRef.current = null
    setPlayingId(null)
  }

  React.useEffect(() => registerBrowserPrincipalLifecycleResetter(() => {
    generationRef.current += 1
    previewRequestRef.current += 1
    generatedPreviewAbortRef.current?.abort()
    generatedPreviewAbortRef.current = null
    generatedPreviewAgentIdRef.current = null
    generatedPreviewAttemptRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    setGeneratedPreviewUrl(null)
    setGeneratingPreview(false)
    setPlayingId(null)
    setOpen(false)
  }), [])

  React.useEffect(() => () => {
    generationRef.current += 1
    generatedPreviewAbortRef.current?.abort()
    const agentId = generatedPreviewAgentIdRef.current
    const attempt = generatedPreviewAttemptRef.current
    generatedPreviewAgentIdRef.current = null
    generatedPreviewAttemptRef.current = null
    if (agentId) {
      void cancelVoicePreviewAgentAttempt({
        attempt,
        agentId,
        cancelAgent: cancelWorkflowAgent,
      })
    }
  }, [])

  React.useEffect(() => {
    if (previewLanguages.includes(previewLanguage)) return
    setPreviewLanguage(
      focusedProfile?.default_language && previewLanguages.includes(focusedProfile.default_language)
        ? focusedProfile.default_language
        : previewLanguages[0] ?? '',
    )
  }, [focusedProfile?.default_language, previewLanguage, previewLanguages])

  const toggleFavorite = async (profileId: string) => {
    if (!channelId || favoriteBusyId) return
    const wasSaved = savedIds.has(profileId)
    setFavoriteBusyId(profileId)
    setSavedIds((current) => {
      const next = new Set(current)
      if (wasSaved) next.delete(profileId)
      else next.add(profileId)
      return next
    })
    try {
      if (wasSaved) await unfavoriteVoiceProfile(profileId)
      else await favoriteVoiceProfile(profileId, channelId)
    } catch {
      setSavedIds((current) => {
        const next = new Set(current)
        if (wasSaved) next.add(profileId)
        else next.delete(profileId)
        return next
      })
    } finally {
      setFavoriteBusyId(null)
    }
  }

  const choose = (profileId: string) => {
    onValueChange(profileId)
    setOpen(false)
  }
  const chooseRandom = () => {
    const candidates = visibleProfiles.length > 0 ? visibleProfiles : profiles
    if (candidates.length === 0) return
    choose(candidates[Math.floor(Math.random() * candidates.length)]!.id)
  }
  const togglePreview = async (profile: VoiceProfile) => {
    if (!channelId || !profile.preview_available) return
    setFocusedProfileId(profile.id)
    if (playingId === profile.id) {
      previewRequestRef.current += 1
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingId(null)
      return
    }
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    audioRef.current?.pause()
    setPlayingId(profile.id)
    const preview = await getVoiceProfilePreview(profile.id, channelId).catch(() => null)
    if (!preview || previewRequestRef.current !== requestId) {
      if (previewRequestRef.current === requestId) setPlayingId(null)
      return
    }
    const audio = new Audio(preview.url)
    audio.preload = 'metadata'
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audioRef.current = audio
    void audio.play().catch(() => setPlayingId(null))
  }

  const generatePreview = async () => {
    const profile = focusedProfile
    const text = previewText.trim()
    if (!channelId || !modelId || !profile || !text || !previewLanguage || generatingPreview) return
    const requestedOperation: VoicePreviewOperation = {
      channelId,
      modelId,
      profileId: profile.id,
      text,
      language: previewLanguage,
      outputFormat: 'mp3',
    }
    const cancellation = cancelGeneratedPreview()
    const generation = generationRef.current
    await cancellation
    if (generationRef.current !== generation) return
    const scope = voicePreviewAttemptScope(channelId)
    const requestedFingerprint = voicePreviewOperationFingerprint(requestedOperation)
    const existingAttempt = voicePreviewAttemptStore.findByScope(scope)
    const operation = existingAttempt?.fingerprint === requestedFingerprint
      ? requestedOperation
      : existingAttempt?.payload ?? requestedOperation
    let attempt: VoicePreviewAttempt = existingAttempt ?? voicePreviewAttemptStore.save({
      scope,
      fingerprint: requestedFingerprint,
      idempotencyKey: `voice-preview-${crypto.randomUUID()}`,
      payload: requestedOperation,
    })

    if (existingAttempt && existingAttempt.fingerprint !== requestedFingerprint) {
      setFocusedProfileId(operation.profileId)
      setPreviewText(operation.text)
      setPreviewLanguage(operation.language)
    }
    const controller = new AbortController()
    generatedPreviewAbortRef.current = controller
    setGeneratingPreview(true)
    setPreviewError(null)
    setGeneratedPreviewUrl(null)
    try {
      let agentId = attempt.payload.agentId
      if (!agentId) {
        const launch = await launchWorkflowAgent({
          projectId: operation.channelId,
          channelId: operation.channelId,
          nodeType: 'speech_generate@1',
          params: {
            text: operation.text,
            model_id: operation.modelId,
            voice_profile_id: operation.profileId,
            language: operation.language,
            output_format: operation.outputFormat,
          },
          idempotencyKey: attempt.idempotencyKey,
        })
        if (generationRef.current !== generation) return
        agentId = launch.agent_id
        attempt = saveVoicePreviewAgentId(attempt, agentId)
      }
      generatedPreviewAgentIdRef.current = agentId
      generatedPreviewAttemptRef.current = attempt
      if (controller.signal.aborted || generationRef.current !== generation) return
      let completed = false
      for (let pollAttempt = 0; pollAttempt < 60; pollAttempt += 1) {
        await abortableDelay(1_500, controller.signal)
        const status = await getWorkflowAgentStatus(agentId, { signal: controller.signal })
        if (controller.signal.aborted || generationRef.current !== generation) return
        const normalizedStatus = status.status.toLowerCase()
        if (['completed', 'success', 'succeeded'].includes(normalizedStatus)) {
          generatedPreviewAgentIdRef.current = null
          generatedPreviewAttemptRef.current = null
          completed = true
          break
        }
        if (['failed', 'cancelled', 'canceled', 'billing_failed'].includes(normalizedStatus)) {
          generatedPreviewAgentIdRef.current = null
          generatedPreviewAttemptRef.current = null
          clearVoicePreviewAttempt(attempt)
          throw new Error(status.errorMessage ?? 'Voice preview generation failed.')
        }
      }
      if (!completed) {
        const timedOutAgentId = generatedPreviewAgentIdRef.current
        const timedOutAttempt = generatedPreviewAttemptRef.current
        generatedPreviewAgentIdRef.current = null
        generatedPreviewAttemptRef.current = null
        if (timedOutAgentId) {
          const cancelResult = await cancelVoicePreviewAgentAttempt({
            attempt: timedOutAttempt,
            agentId: timedOutAgentId,
            cancelAgent: cancelWorkflowAgent,
          })
          if (controller.signal.aborted || generationRef.current !== generation) return
          if (cancelResult.outcome === 'completed') {
            const result = await getWorkflowAgentOutput(timedOutAgentId, { signal: controller.signal })
            if (controller.signal.aborted || generationRef.current !== generation) return
            const url = findAudioUrl(result.output)
            if (url) {
              if (timedOutAttempt) clearVoicePreviewAttempt(timedOutAttempt)
              setGeneratedPreviewUrl(url)
              playAudioUrl(url, `generated:${operation.profileId}`)
              return
            }
          }
          if (cancelResult.outcome === 'not_supported' || cancelResult.outcome === 'unknown') {
            setPreviewError('Voice preview is still finishing. Keep this dialog open and try again.')
            return
          }
        }
        setPreviewError('Voice preview timed out. You can try again.')
        return
      }
      const result = await getWorkflowAgentOutput(agentId, { signal: controller.signal })
      if (controller.signal.aborted || generationRef.current !== generation) return
      const url = findAudioUrl(result.output)
      if (!url) {
        clearVoicePreviewAttempt(attempt)
        setPreviewError('The generated preview did not include a playable audio URL.')
        return
      }
      clearVoicePreviewAttempt(attempt)
      setGeneratedPreviewUrl(url)
      playAudioUrl(url, `generated:${operation.profileId}`)
    } catch (error) {
      if (generationRef.current === generation && !controller.signal.aborted && (error as Error).name !== 'AbortError') {
        if (!attempt.payload.agentId && !isAmbiguousMutationError(error)) clearVoicePreviewAttempt(attempt)
        setPreviewError(publicRuntimeErrorMessageForError(error, 'Voice preview generation failed.'))
      }
    } finally {
      if (generatedPreviewAbortRef.current === controller) {
        generatedPreviewAbortRef.current = null
        setGeneratingPreview(false)
      }
    }
  }

  const playAudioUrl = (url: string, id: string) => {
    previewRequestRef.current += 1
    audioRef.current?.pause()
    const audio = new Audio(url)
    audio.preload = 'metadata'
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audioRef.current = audio
    setPlayingId(id)
    void audio.play().catch(() => setPlayingId(null))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div
        className={cn(
          'group flex w-full items-center transition hover:border-primary/40 hover:bg-accent/40',
          compact
            ? 'min-h-9 min-w-0 gap-1.5 rounded-[10px] border border-border/80 bg-muted/40 px-2.5 py-[2px]'
            : 'min-h-14 gap-3 rounded-xl border border-border bg-panel/40 px-3.5',
          disabled && 'opacity-55',
        )}
      >
        <button
          type="button"
          disabled={disabled || !compact || !selected?.preview_available}
          aria-label={compact && selected?.preview_available
            ? (playingId === selected.id ? tAuto('stop_recording_d77426b1') : tAuto('play_speech_56cd933c'))
            : undefined}
          onClick={() => {
            if (!selected) return
            void togglePreview(selected)
          }}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-primary/[0.12] text-primary transition',
            compact ? 'size-7 enabled:hover:bg-primary/[0.28]' : 'size-9',
            (!compact || !selected?.preview_available) && 'pointer-events-none',
          )}
        >
          {compact && playingId === selected?.id
            ? <Square className="size-3 fill-current" />
            : <Volume2 className={compact ? 'size-3.5' : 'size-4'} />}
        </button>
        <DialogTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {selected?.display_name ?? (value === 'default' ? tAuto('system_default_voice_e495ac27') : tAuto('choose_a_voice_abcd28a4'))}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {selected
                  ? compactVoiceSummary(selected)
                  : catalogLoading
                    ? tAuto('loading_compatible_voices_10667503')
                    : catalogUnavailable
                      ? tAuto('voice_catalog_unavailable_c276f846')
                      : tAuto('preview_search_or_choose_at_random_57d6834a')}
              </span>
            </span>
            {compact ? null : (
              <Badge variant="outline" className="rounded-full bg-background/50 px-2.5">
                <UiText id="browse_2f3b5c55" /></Badge>
            )}
          </button>
        </DialogTrigger>
      </div>
      <DialogContent className="flex h-[min(46rem,calc(100dvh-1rem))] max-h-[92dvh] w-[calc(100vw-1rem)] max-w-[70rem] flex-col gap-0 overflow-hidden rounded-3xl border-border bg-panel p-0 shadow-2xl sm:w-[calc(100vw-2rem)] sm:max-w-[70rem]">
        <div className="px-4 pb-3 pt-5 sm:px-6 sm:pb-4">
          <div className="flex items-center gap-3 pr-8">
            <DialogTitle className="flex min-h-7 min-w-0 flex-1 items-center gap-2.5 text-base sm:text-lg">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/90 text-background shadow-sm">
                {heading.hasSelection && !heading.previewing
                  ? <Check className="size-4" />
                  : <AudioLines className="size-4" />}
              </span>
              <span className="min-w-0 truncate">
                {toolCopy(heading.title)}
              </span>
              {heading.previewing && heading.selectionLabel ? (
                <span className="hidden shrink-0 text-xs font-normal text-muted-foreground xl:inline">
                  {heading.selectionLabel} selected
                </span>
              ) : null}
              {headingProfile ? (
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {shortLanguageCode(headingProfile.default_language)}
                  {headingProfile.supported_languages.length > 1
                    ? ` +${headingProfile.supported_languages.length - 1}`
                    : ''}
                </span>
              ) : null}
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-xs"
              >
                <Link href="/tools?tool=voice-clone" onClick={() => setOpen(false)}>
                  <AudioLines className="size-3.5" />
                  <span className="hidden sm:inline"><UiText id="open_voice_clone_05b71f01" /></span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
                onClick={() => choose('default')}
              >
                <UiText id="default_808d7dca" /></Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
                disabled={profiles.length === 0}
                onClick={chooseRandom}
              >
                <Shuffle className="size-3.5" />
                <span className="hidden sm:inline"><UiText id="random_58d888c0" /></span>
              </Button>
              <Button
                type="button"
                variant={customPreviewOpen ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
                disabled={!focusedProfile}
                onClick={() => setCustomPreviewOpen((current) => !current)}
              >
                <Sparkles className="size-3.5" />
                <span className="hidden md:inline"><UiText id="try_text_d82862ce" /></span>
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">
            <UiText id="preview_and_choose_a_voice_profile_b4bf83af" /></DialogDescription>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tAuto('search_voices_d9c583f1')}
              aria-label={tAuto('search_voices_d9c583f1')}
              className="h-11 rounded-xl border-border/80 bg-background/45 pl-10 pr-4 shadow-inner shadow-black/5 focus-visible:border-ring/70 focus-visible:ring-2 focus-visible:ring-ring/20"
            />
          </div>
        </div>

        <div className="border-b border-border/75 px-4 sm:px-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="tools-scrollbar -mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 pb-2 lg:flex-1">
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                aria-label={tAuto('filter_voice_gender_8e032001')}
                className="h-10 shrink-0 rounded-lg border border-border/80 bg-background/45 px-3 text-xs font-medium text-foreground outline-none transition hover:border-ring/55 focus:border-ring"
              >
                <option value="all"><UiText id="any_gender_9b58cf70" /></option>
                <option value="female"><UiText id="female_b7c17e97" /></option>
                <option value="male"><UiText id="male_3f3a489c" /></option>
                <option value="nonbinary"><UiText id="nonbinary_7d22f981" /></option>
                <option value="unknown"><UiText id="unspecified_a6e7eb70" /></option>
              </select>
              <select
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                aria-label={tAuto('filter_voice_tag_3a311185')}
                disabled={tags.length === 0}
                className="h-10 shrink-0 rounded-lg border border-border/80 bg-background/45 px-3 text-xs font-medium text-foreground outline-none transition hover:border-ring/55 focus:border-ring disabled:opacity-45"
              >
                <option value="all"><UiText id="tags_848eed0f" /></option>
                {tags.map((item) => <option key={item} value={item}>{humanizeTag(item)}</option>)}
              </select>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger
                  aria-label={tAuto('filter_voice_language_99cba362')}
                  className="h-10 w-auto min-w-36 shrink-0 rounded-lg border-border/80 bg-background/45 px-3 text-xs font-medium shadow-none transition hover:border-ring/55"
                >
                  <SelectValue>
                    <span className="flex min-w-0 items-center gap-2">
                      <LanguageFlagIcon region={language === 'all' ? null : getLanguageDisplay(language).flagRegion} />
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground">
                        {language === 'all' ? 'ALL' : getLanguageDisplay(language).code}
                      </span>
                      <span className="truncate">
                        {language === 'all' ? <UiText id="any_language_867dd441" /> : languageName(language)}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <LanguageFlagIcon region={null} />
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground">ALL</span>
                      <UiText id="any_language_867dd441" />
                    </span>
                  </SelectItem>
                  {languages.map((item) => (
                    <SelectItem key={item} value={item}>
                      <span className="flex items-center gap-2">
                        <LanguageFlagIcon region={getLanguageDisplay(item).flagRegion} />
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground">
                          {getLanguageDisplay(item).code}
                        </span>
                        <span>{languageName(item)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <select
                value={ageBand}
                onChange={(event) => setAgeBand(event.target.value)}
                aria-label={tAuto('filter_voice_age_21ff3450')}
                className="h-10 shrink-0 rounded-lg border border-border/80 bg-background/45 px-3 text-xs font-medium text-foreground outline-none transition hover:border-ring/55 focus:border-ring"
              >
                <option value="all"><UiText id="any_age_2c269f3f" /></option>
                <option value="young"><UiText id="young_190ad954" /></option>
                <option value="adult"><UiText id="adult_17748728" /></option>
                <option value="mature"><UiText id="mature_1878d676" /></option>
              </select>
              {accents.length > 0 ? (
                <select
                  value={accent}
                  onChange={(event) => setAccent(event.target.value)}
                  aria-label={tAuto('filter_voice_accent_a87c5958')}
                  className="h-10 shrink-0 rounded-lg border border-border/80 bg-background/45 px-3 text-xs font-medium text-foreground outline-none transition hover:border-ring/55 focus:border-ring"
                >
                  <option value="all"><UiText id="any_accent_4f76a6f0" /></option>
                  {accents.map((item) => <option key={item} value={item}>{humanizeTag(item)}</option>)}
                </select>
              ) : null}
            </div>

            <div
              role="tablist"
              aria-label={tAuto('voice_catalog_sections_707b43ec')}
              className="tools-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto lg:justify-end"
            >
              {([
                ['featured', 'Featured'],
                ['all', 'All voices'],
                ['mine', 'My voices'],
                ['saved', 'Saved'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'relative shrink-0 px-3 pb-3 pt-2 text-xs font-semibold transition sm:text-sm',
                    'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition',
                    tab === id
                      ? 'text-foreground after:bg-foreground'
                      : 'text-muted-foreground after:bg-transparent hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
              {favoritesLoading ? (
                <Loader2 className="ml-1 size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>
        </div>

        {focusedProfile && customPreviewOpen ? (
          <div className="grid gap-3 border-b border-border bg-background/20 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
            <div className="space-y-1.5">
              <label htmlFor="voice-preview-text" className="text-xs font-semibold text-foreground">
                <UiText id="try_your_own_text_9bf1862d" /></label>
              <Textarea
                id="voice-preview-text"
                value={previewText}
                maxLength={500}
                rows={2}
                onChange={(event) => setPreviewText(event.target.value)}
                placeholder={tAuto('write_a_short_sentence_to_hear_this_voice_a90ac4e0')}
                disabled={generatingPreview}
                className="min-h-16 resize-none bg-background"
              />
              <p className="text-[11px] text-muted-foreground">
                <UiText id="custom_previews_run_normal_tts_and_use_the_displ_cebfedbc" />{' '}{previewText.length}/500
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="voice-preview-language" className="text-xs font-semibold text-foreground">
                <UiText id="preview_language_fe73d472" /></label>
              <Select
                value={previewLanguage}
                onValueChange={setPreviewLanguage}
                disabled={generatingPreview || previewLanguages.length === 0}
              >
                <SelectTrigger id="voice-preview-language" className="h-10 w-full rounded-xl border-border bg-panel/40 px-3.5 text-sm shadow-none">
                  <SelectValue>
                    <span className="flex min-w-0 items-center gap-2">
                      <LanguageFlagIcon region={getLanguageDisplay(previewLanguage).flagRegion} />
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground">
                        {getLanguageDisplay(previewLanguage).code}
                      </span>
                      <span className="truncate">{languageName(previewLanguage)}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {previewLanguages.map((item) => (
                    <SelectItem key={item} value={item}>
                      <span className="flex items-center gap-2">
                        <LanguageFlagIcon region={getLanguageDisplay(item).flagRegion} />
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground">
                          {getLanguageDisplay(item).code}
                        </span>
                        <span>{languageName(item)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {focusedProfile.display_name}
              </p>
            </div>
            <div className="flex items-end gap-2 pb-5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={generatingPreview}
                onClick={() => setCustomPreviewOpen(false)}
              >
                <UiText id="hide_34d8b60f" /></Button>
              {generatedPreviewUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => playAudioUrl(generatedPreviewUrl, `generated:${focusedProfile.id}`)}
                >
                  <Play className="size-3.5 fill-current" />
                  <UiText id="replay_c0f85d66" /></Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={generatingPreview || !channelId || !previewText.trim() || !previewLanguage || !modelId}
                onClick={() => { void generatePreview() }}
              >
                {generatingPreview
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Sparkles className="size-3.5" />}
                <UiText id="generate_fc45f9b7" /></Button>
            </div>
            {previewError ? (
              <p role="alert" className="text-xs text-destructive lg:col-span-3">{previewError}</p>
            ) : null}
          </div>
        ) : null}

        <div className="tools-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-5 sm:py-3">
          {visibleProfiles.length > 0 && !activeCatalogUnavailable && !activeCatalogLoading ? (
            <div className="sticky top-0 z-10 mb-1 hidden grid-cols-[2.75rem_minmax(0,1.4fr)_4.25rem_4.5rem_3rem_minmax(4.5rem,0.9fr)_1.75rem_2rem] items-center gap-x-3 bg-panel px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <span className="sr-only">Play</span>
              <span>Voice</span>
              <span>Age</span>
              <span>Gender</span>
              <span>Lang</span>
              <span>Style</span>
              <span className="sr-only">Selected</span>
              <span className="sr-only">Save</span>
            </div>
          ) : null}
          {activeCatalogError && !activeCatalogUnavailable ? (
            <div
              role="status"
              className="mb-2 flex items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-foreground"
            >
              <AudioLines className="size-4 shrink-0 text-amber-600 dark:text-amber-300" />
              <span className="min-w-0 flex-1">
                <UiText id="some_voices_are_temporarily_unavailable_availabl_2be06705" /></span>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={retryActiveCatalog}>
                <RefreshCw className="size-3.5" />
                <UiText id="retry_9f5cd8a2" /></Button>
            </div>
          ) : null}

          {activeCatalogLoading && visibleProfiles.length === 0 ? (
            <div className="flex h-full min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <UiText id="loading_compatible_voices_10667503" /></div>
          ) : activeCatalogUnavailable ? (
            <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-6 text-center">
              <AudioLines className="size-6 text-destructive/75" />
              <p className="text-sm font-medium text-destructive"><UiText id="voice_catalog_could_not_be_loaded_3ee8a1dd" /></p>
              <p className="max-w-md text-xs text-muted-foreground">
                <UiText id="your_current_voice_selection_has_not_changed_5c56cb00" /></p>
              <Button type="button" variant="outline" size="sm" className="mt-1" onClick={retryActiveCatalog}>
                <RefreshCw className="size-3.5" />
                <UiText id="retry_9f5cd8a2" /></Button>
            </div>
          ) : visibleProfiles.length === 0 ? (
            <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Search className="size-6 opacity-60" />
              <p className="text-sm font-medium text-foreground"><UiText id="no_matching_voices_d6bf982a" /></p>
              <p className="text-xs"><UiText id="try_another_search_filter_or_catalog_tab_91270a03" /></p>
            </div>
          ) : visibleProfiles.map((profile) => {
            const selectedProfile = profile.id === value
            const previewAvailable = Boolean(channelId && profile.preview_available)
            const quickPreviewLabel = playingId === profile.id
              ? tAuto('stop_recording_d77426b1')
              : profile.origin === 'stock'
                ? tAuto('play_speech_56cd933c')
                : `${tAuto('play_5d12bd53')}: ${tAuto('reference_recording_9aff77b2')}`
            const meta = voicePickerRowMeta(profile)
            return (
              <div
                key={profile.id}
                className={cn(
                  'group grid grid-cols-[2.75rem_minmax(0,1fr)_1.75rem] items-center gap-x-2 rounded-xl px-2 py-1.5 transition md:grid-cols-[2.75rem_minmax(0,1.4fr)_4.25rem_4.5rem_3rem_minmax(4.5rem,0.9fr)_1.75rem_2rem] md:gap-x-3 md:px-2.5',
                  selectedProfile
                    ? 'bg-primary/[0.10] ring-1 ring-inset ring-primary/35'
                    : focusedProfile?.id === profile.id
                      ? 'bg-muted/50'
                      : 'hover:bg-muted/45',
                )}
              >
                <button
                  type="button"
                  aria-label={previewAvailable ? `${quickPreviewLabel}: ${profile.display_name}` : `Preview unavailable for ${profile.display_name}`}
                  title={previewAvailable ? quickPreviewLabel : undefined}
                  disabled={!previewAvailable}
                  onClick={() => { void togglePreview(profile) }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/[0.18] text-primary shadow-sm transition enabled:hover:scale-[1.03] enabled:hover:bg-primary/[0.28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:bg-muted disabled:text-muted-foreground"
                >
                  {playingId === profile.id
                    ? <Square className="size-3.5 fill-current" />
                    : <Play className="ml-0.5 size-4 fill-current" />}
                </button>
                <button
                  type="button"
                  aria-pressed={selectedProfile}
                  onClick={() => choose(profile.id)}
                  className="min-w-0 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {profile.display_name}
                    </span>
                    {profile.origin !== 'stock' ? (
                      <Badge variant="secondary" className="hidden shrink-0 rounded-full px-1.5 py-0 text-[10px] sm:inline-flex">
                        <UiText id="my_voice_0fa7cde3" /></Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground md:hidden">
                    {meta.language} · {meta.gender} · {meta.age}
                  </span>
                </button>
                <span className="hidden truncate text-xs text-muted-foreground md:block">{meta.age}</span>
                <span className="hidden truncate text-xs text-muted-foreground md:block">{meta.gender}</span>
                <span
                  className="hidden truncate text-xs font-medium uppercase tracking-wide text-muted-foreground md:block"
                  title={profile.supported_languages.map(languageName).join(', ')}
                >
                  {meta.language}
                </span>
                <span className="hidden truncate text-xs text-muted-foreground md:block">{meta.style}</span>
                <span className="flex size-7 shrink-0 items-center justify-center">
                  {selectedProfile
                    ? <Check className="size-4 text-primary" aria-label={tAuto('selected_voice_67d6aeab')} />
                    : <span className="size-4 rounded-full border border-border/80" aria-hidden />}
                </span>
                <button
                  type="button"
                  aria-label={savedIds.has(profile.id) ? `Remove ${profile.display_name} from saved voices` : `Save ${profile.display_name}`}
                  disabled={!channelId || favoriteBusyId !== null}
                  onClick={() => { void toggleFavorite(profile.id) }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50"
                >
                  {favoriteBusyId === profile.id
                    ? <Loader2 className="size-4 animate-spin" />
                    : <Bookmark className={cn('size-4', savedIds.has(profile.id) && 'fill-current text-primary')} />}
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function findAudioUrl(value: unknown, depth = 0): string | null {
  if (depth > 6) return null
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && /\.(mp3|wav|m4a|aac|flac|opus|oga|ogg)(\?|#|$)/i.test(value)) {
      return value
    }
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findAudioUrl(item, depth + 1)
      if (result) return result
    }
    return null
  }
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['audio_url', 'speech_url', 'cdn_url', 'artifact_url', 'output_url', 'download_url', 'url']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate
  }
  for (const candidate of Object.values(record)) {
    const result = findAudioUrl(candidate, depth + 1)
    if (result) return result
  }
  return null
}

export function voicePickerRowMeta(profile: VoiceProfile) {
  const style = profile.catalog.tone_tags[0]
    ?? profile.catalog.use_case_tags[0]
    ?? (profile.origin === 'stock' ? 'Stock' : 'Mine')
  return {
    age: shortAge(profile.catalog.age_band),
    gender: shortGender(profile.catalog.gender),
    language: shortLanguageCode(profile.default_language),
    style: humanizeTag(style),
  }
}

function compactVoiceSummary(profile: VoiceProfile) {
  const meta = voicePickerRowMeta(profile)
  return [meta.language, meta.gender, meta.age].filter((item) => item !== '—').join(' · ')
}

function shortLanguageCode(language: string | null | undefined) {
  const normalized = language?.trim().toUpperCase()
  if (!normalized) return '—'
  return normalized.split(/[-_]/)[0] ?? '—'
}

function shortAge(value: string | null | undefined) {
  if (value === 'young') return 'Young'
  if (value === 'adult') return 'Adult'
  if (value === 'mature') return 'Mature'
  return '—'
}

function shortGender(value: string | null | undefined) {
  if (value === 'female') return 'Female'
  if (value === 'male') return 'Male'
  if (value === 'nonbinary') return 'NB'
  return '—'
}

function languageName(value: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(value) ?? value
  } catch {
    return value
  }
}

function humanizeTag(value: string) {
  return value
    .split('-')
    .map((part) => part ? part[0]!.toUpperCase() + part.slice(1) : part)
    .join(' ')
}
