'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  getAssistantConversationSettings,
  type AssistantComposerCatalog,
  type AssistantConversationSettings,
} from '@/lib/assistant/api'
import { FULL_ACCESS_STATE_QUERY_KEY, type FullAccessState } from '@/lib/assistant/full-access-api'
import { acceptFullAccessConsentFlow } from '@/lib/assistant/full-access-flow'

import {
  COMPOSER_DEFAULT_MODE,
  COMPOSER_MODES,
  composerModeView,
  type ComposerMode,
  type ComposerModeCommandResult,
} from './composer-mode'
import {
  planDraftComposerMode,
  switchComposerMode,
  type ModeNotice,
  type ModeSwitchResult,
} from './mode-switch'

type Translator = (key: string, values?: Record<string, string | number>) => string

export type ComposerModeOptionView = { id: ComposerMode; label: string; detail: string }

const NOTICE_KEYS: Record<ModeNotice, string> = {
  stale: 'typedComposer.modeNotice.stale',
  target_gone: 'typedComposer.modeNotice.targetGone',
  consent_required: 'typedComposer.modeNotice.consentRequired',
  forbidden: 'typedComposer.modeNotice.forbidden',
  failed: 'typedComposer.modeNotice.failed',
  members_not_allowed: 'fullAccessCard.notice.membersNotAllowed',
  full_access_unavailable: 'fullAccessCard.notice.unavailable',
}

export function composerModeNoticeKey(result: Exclude<ComposerModeCommandResult, 'applied'>): string {
  return NOTICE_KEYS[result]
}

/** The one-time Full access warning card the composer opens (Q74, K354): the text revision it shows and its progress. */
export type FullAccessConsentPrompt = {
  state: FullAccessState
  /** The consent is being recorded / the mode switch is being applied. */
  busy: boolean
  /** Why the last confirm did not complete; the card stays open. */
  error: 'failed' | 'revision_changed' | null
}

/**
 * P03-01 (Q74) three-level mode control over the settings command authority. Before a conversation exists the pick
 * is local and is committed as the new-job default on the first send (like the planner model, P01A-11). With a
 * conversation the chip shows the committed mode; a click issues a settings command for the selected job + future
 * jobs, or `future_jobs_only` without a selected job (P03-14). A refused command leaves the chip on the server state.
 *
 * Y1-02: Full access goes through `switchComposerMode`: the server's consent state decides, a missing consent opens
 * the one-time warning card (`fullAccessConsent`), and accepting it records the consent and applies the switch.
 */
export function useComposerModeControl(input: {
  conversationId: string | null
  settings: AssistantConversationSettings | null
  /** The job the composer targets (P03-14); null means only new jobs change. */
  selectedJobId: string | null
  catalog: AssistantComposerCatalog | null
  refetchSettings: () => Promise<unknown>
  t: Translator
  onNotice: (message: string) => void
}) {
  const { conversationId, settings, selectedJobId, refetchSettings, t, onNotice } = input
  const queryClient = useQueryClient()
  const [draftMode, setDraftMode] = React.useState<ComposerMode>(COMPOSER_DEFAULT_MODE)
  // The consent id a draft Full access pick was confirmed with; committed together with the mode on the first send.
  const [draftConsentId, setDraftConsentId] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [prompt, setPrompt] = React.useState<FullAccessConsentPrompt | null>(null)
  const shownAtRef = React.useRef<Date>(new Date())
  const view = React.useMemo(() => composerModeView(settings), [settings])

  const options = React.useMemo<ComposerModeOptionView[]>(() => {
    const offered = input.catalog?.modes.length
      ? input.catalog.modes.map((mode) => mode.id)
      : input.catalog?.approval_modes.length
        ? input.catalog.approval_modes.map((mode) => (mode.id === 'autonomous' ? 'auto' as const : 'ask' as const))
        : [...COMPOSER_MODES]
    return COMPOSER_MODES.filter((mode) => offered.includes(mode)).map((mode) => ({
      id: mode,
      label: mode === 'ask' ? t('composer.ask') : mode === 'auto' ? t('composer.auto') : t('typedComposer.fullAccess'),
      detail: mode === 'ask' ? t('composer.askDetail') : mode === 'auto' ? t('composer.autoDetail') : t('typedComposer.fullAccessDetail'),
    }))
  }, [input.catalog, t])

  const value: ComposerMode = conversationId ? view.selectedMode ?? COMPOSER_DEFAULT_MODE : draftMode

  const openPrompt = React.useCallback((state: FullAccessState) => {
    shownAtRef.current = new Date()
    setPrompt({ state, busy: false, error: null })
  }, [])

  const handleResult = React.useCallback((result: ModeSwitchResult) => {
    if (result.kind === 'needs_consent') openPrompt(result.state)
    else if (result.kind === 'notice') onNotice(t(NOTICE_KEYS[result.notice]))
  }, [onNotice, openPrompt, t])

  const applyToConversation = React.useCallback(async (mode: ComposerMode, consentId: string | null): Promise<ModeSwitchResult | null> => {
    if (!conversationId || !settings) return null
    const job = settings.job && settings.job.job_id === selectedJobId ? settings.job : null
    try {
      return await switchComposerMode({
        mode,
        conversationId,
        expectedConversationDefaultsVersion: settings.defaults.defaults_version,
        selectedJob: job ? { jobId: job.job_id, expectedJobSettingsVersion: job.job_settings_version } : null,
        consentId,
      })
    } finally {
      // The chip shows the server's state, never the click.
      await refetchSettings()
    }
  }, [conversationId, refetchSettings, selectedJobId, settings])

  const select = React.useCallback(async (mode: ComposerMode) => {
    if (!conversationId) {
      setPending(true)
      try {
        const plan = await planDraftComposerMode(mode)
        if (plan.kind === 'ready') {
          setDraftMode(mode)
          setDraftConsentId(plan.consentId)
        } else if (plan.kind === 'needs_consent') openPrompt(plan.state)
        else onNotice(t(NOTICE_KEYS[plan.notice]))
      } finally {
        setPending(false)
      }
      return
    }
    if (!settings || pending || mode === view.selectedMode) return
    setPending(true)
    try {
      const result = await applyToConversation(mode, null)
      if (result) handleResult(result)
    } finally {
      setPending(false)
    }
  }, [applyToConversation, conversationId, handleResult, onNotice, openPrompt, pending, settings, t, view.selectedMode])

  const confirmConsent = React.useCallback(async () => {
    if (!prompt || prompt.busy) return
    setPrompt({ ...prompt, busy: true, error: null })
    const outcome = await acceptFullAccessConsentFlow({ state: prompt.state, shownAt: shownAtRef.current })
    if (outcome.kind === 'revision_changed') {
      // The warning text changed while the card was open: show the new revision and ask again.
      shownAtRef.current = new Date()
      setPrompt({ state: outcome.state, busy: false, error: 'revision_changed' })
      return
    }
    if (outcome.kind === 'blocked') {
      setPrompt(null)
      onNotice(t(NOTICE_KEYS.members_not_allowed))
      return
    }
    if (outcome.kind === 'failed') {
      setPrompt({ ...prompt, busy: false, error: 'failed' })
      return
    }
    void queryClient.invalidateQueries({ queryKey: FULL_ACCESS_STATE_QUERY_KEY })
    if (!conversationId) {
      setDraftMode('auto_full')
      setDraftConsentId(outcome.consentId)
      setPrompt(null)
      return
    }
    const result = await applyToConversation('auto_full', outcome.consentId)
    setPrompt(null)
    if (result) handleResult(result)
  }, [applyToConversation, conversationId, handleResult, onNotice, prompt, queryClient, t])

  const dismissConsent = React.useCallback(() => {
    setPrompt((current) => (current?.busy ? current : null))
  }, [])

  /** A brand-new conversation's first message: the picked mode becomes its committed new-job default first. */
  const commitInitialMode = React.useCallback(async (newConversationId: string) => {
    const current = await getAssistantConversationSettings({ conversationId: newConversationId })
    if (current.defaults.default_mode === draftMode) return draftMode
    const result = await switchComposerMode({
      mode: draftMode,
      conversationId: newConversationId,
      expectedConversationDefaultsVersion: current.defaults.defaults_version,
      selectedJob: null,
      consentId: draftMode === 'auto_full' ? draftConsentId : null,
    })
    if (result.kind === 'applied') return draftMode
    // Refused (e.g. Tam erişim whose consent was revoked meanwhile): the conversation keeps its server default; say so
    // and continue with it. The warning card is not opened in the middle of a send.
    onNotice(t(NOTICE_KEYS[result.kind === 'notice' ? result.notice : 'consent_required']))
    return current.defaults.default_mode
  }, [draftConsentId, draftMode, onNotice, t])

  const fullAccessConsent = React.useMemo(() => (prompt
    ? { prompt, confirm: () => void confirmConsent(), dismiss: dismissConsent }
    : null), [confirmConsent, dismissConsent, prompt])

  /** The pick before a conversation exists (and the consent a Full access pick was confirmed with). */
  const draft = React.useMemo<ComposerModeDraft>(() => ({ mode: draftMode, consentId: draftConsentId }), [draftConsentId, draftMode])
  /** A new chat started elsewhere (the new tab) brings its pick; it is committed on the first send like a local one. */
  const restoreDraft = React.useCallback((next: ComposerModeDraft) => {
    setDraftMode(next.mode)
    setDraftConsentId(next.mode === 'auto_full' ? next.consentId : null)
  }, [])

  return { value, options, pending, view, select, commitInitialMode, fullAccessConsent, draft, restoreDraft }
}

export type ComposerModeDraft = { mode: ComposerMode; consentId: string | null }
