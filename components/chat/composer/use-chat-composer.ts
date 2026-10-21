'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import type { ChatLocale, ChatTranslator } from '@/components/chat/chat-copy'
import { useMcpTemplateInsert } from '@/components/chat/composer/mcp-template-insert'
import { useComposerResourceDescribe } from '@/components/chat/composer/resource-describe'
import { useMemoryUploadChoice } from '@/components/memory/use-memory-upload-choice'
import { useLocalizedError } from '@/hooks/use-localized-error'
import {
  ASSISTANT_COMPOSER_CATALOG_QUERY_KEY,
  ASSISTANT_CONVERSATION_SETTINGS_QUERY_KEY,
  getAssistantComposerCatalog,
  getAssistantConversationSettings,
  issueAssistantPlannerModelCommand,
} from '@/lib/assistant/api'
import { buildComposerMenuStops, effectiveComposerMenuIndex } from '@/lib/assistant/composer/composer-menu-stops'
import { readComposerOutputCountMax } from '@/lib/assistant/composer/composer-output-count'
import type { ComposerMentionChip } from '@/lib/assistant/composer/composer-state'
import type { NewChatHandoff } from '@/lib/assistant/composer/new-chat-handoff'
import { relabelFromCandidates, type ComposerResourceCandidate } from '@/lib/assistant/composer/resource-mentions'
import { useComposerModeControl } from '@/lib/assistant/composer/use-composer-mode'
import { useComposerOutputCount } from '@/lib/assistant/composer/use-composer-output-count'
import { useMentionMenuGroups } from '@/lib/assistant/composer/use-mention-menu'
import { useSlashMenuGroups } from '@/lib/assistant/composer/use-slash-menu'
import { composerMentionToken, useTypedComposer, type TypedComposerMenuGroup, type TypedComposerMenuItem } from '@/lib/assistant/composer/use-typed-composer'
import {
  classifyPlannerModelCommand,
  plannerModelView,
  shouldRetryPlannerModelForJobOnly,
  type PlannerModelCommandResult,
} from '@/lib/assistant/planner-model-selection'
import { registerBrowserPrincipalLifecycleResetter } from '@/lib/auth/browser-principal-storage'

import {
  isChatUploadAbort,
  readChatAssetAttachment,
  uploadChatMediaFile,
  type ChatAssetAttachment,
  type ChatAssetKind,
} from './chat-attachments'
import {
  COMPOSER_DEFAULT_SETTINGS,
  COMPOSER_VIDEO_DURATION_MIN_SECONDS,
  areComposerSettingsEqual,
  buildComposerOptions,
  plannerModelNoticeKey,
  readComposerSettings,
  reconcileComposerSettings,
  selectedComposerImageModel,
  type ComposerSettings,
} from './composer-settings'

const NO_NOTICE = () => {}

/**
 * The main Chat's composer state (P03-01): the typed text and chips with their `/` and `@` menus, the attached files
 * (`@image1`), the models / output / duration / canvas settings, the "Adet" pick, the mode and the chat model. The
 * Chat page sends what it holds; the new tab hands it to a new chat (`snapshot`, then `restore` on the Chat).
 *
 * `conversationId` is the loaded conversation (null: a new chat, whose model and mode picks are local until the first
 * send commits them). `contextKey` names the composer's context: a change clears the chips, the files and the pick.
 */
export function useChatComposer(input: {
  channelId: string | null
  conversationId: string | null
  contextKey: string
  /** The context is loaded: menus, the catalog and uploads wait for it. */
  ready: boolean
  /** P03-14: the job the model and mode commands target (null: only new jobs change). */
  selectedJobId?: string | null
  /** The composer's errors and notices (a failed upload, a refused mode switch); null clears the last one. */
  onNotice?: (message: string | null) => void
}) {
  const { channelId, conversationId, contextKey, ready } = input
  const selectedJobId = input.selectedJobId ?? null
  const onNotice = input.onNotice ?? NO_NOTICE
  const activeLocale = useLocale()
  const locale: ChatLocale = activeLocale === 'tr' ? 'tr' : 'en'
  const tChat = useTranslations('Chat') as unknown as ChatTranslator
  const localizeError = useLocalizedError()
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false)
  const [isMediaPickerOpen, setIsMediaPickerOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [settings, setSettings] = React.useState<ComposerSettings>(COMPOSER_DEFAULT_SETTINGS)
  const [selectedAssets, setSelectedAssets] = React.useState<ChatAssetAttachment[]>([])
  // Short names of the attached files (`image1`); see appendSelectedAsset.
  const selectedAssetsRef = React.useRef<ChatAssetAttachment[]>([])
  const assetLabelsRef = React.useRef<Record<string, string>>({})
  const [assetLabels, setAssetLabels] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    selectedAssetsRef.current = selectedAssets
  }, [selectedAssets])
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const uploadAbortRef = React.useRef<AbortController | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const formRef = React.useRef<HTMLFormElement | null>(null)
  const contextKeyRef = React.useRef(contextKey)
  // S19: one shared "Belleğe de ekle" choice for the composer and the media picker uploads.
  const memoryUpload = useMemoryUploadChoice(ready ? channelId : null, 'chat_upload')
  // P03-01: shared typed composer (text + typed chips with one undo history); `draft`/`setDraft` are its text view.
  // QA-172: an MCP template chosen in the `/` menu is rendered and inserted as text (never sent).
  const mcpTemplates = useMcpTemplateInsert({ onNotice })
  const typedComposer = useTypedComposer({ resetKey: contextKey, textareaRef, onInsertAction: mcpTemplates.onInsertAction, mentionTokens: true })
  const draft = typedComposer.text
  const setDraft = typedComposer.setText
  const resetComposer = typedComposer.reset
  const slashMenu = useSlashMenuGroups({
    surface: 'dashboard_chat',
    channelId,
    trigger: typedComposer.trigger,
    enabled: Boolean(channelId && ready),
    conversationId,
  })
  // P03-02: `@` resource mentions from the owners' projections; a result relabels chips of the exact same identity.
  const describeComposerResource = useComposerResourceDescribe()
  const relabelComposer = typedComposer.relabel
  const handleMentionCandidates = React.useCallback(
    (candidates: ComposerResourceCandidate[]) => relabelComposer(relabelFromCandidates(candidates)),
    [relabelComposer],
  )
  const mentionMenu = useMentionMenuGroups({
    channelId,
    trigger: typedComposer.trigger,
    enabled: Boolean(channelId && ready),
    locale,
    describe: describeComposerResource,
    onCandidates: handleMentionCandidates,
  })
  const mentionTrigger = typedComposer.trigger?.kind === 'mention' ? typedComposer.trigger : null
  const attachedFilesGroup = React.useMemo<TypedComposerMenuGroup | null>(() => {
    if (!mentionTrigger) return null
    const query = mentionTrigger.query.trim().toLocaleLowerCase()
    const items: TypedComposerMenuItem[] = selectedAssets
      .map((asset) => ({ id: `file:${asset.id}`, group: 'attachedFiles', label: `@${assetLabels[asset.id] ?? asset.kind}`, description: asset.name }))
      .filter((item) => !query || item.label.toLocaleLowerCase().includes(query) || item.description.toLocaleLowerCase().includes(query))
    items.push({ id: 'file:pick', group: 'attachedFiles', label: tChat('typedComposer.pickFromLibrary'), description: tChat('typedComposer.pickFromLibraryHint') })
    return { id: 'attachedFiles', items }
  }, [assetLabels, mentionTrigger, selectedAssets, tChat])
  const activeMenu = mentionTrigger
    ? { ...mentionMenu, groups: attachedFilesGroup ? [attachedFilesGroup, ...mentionMenu.groups] : mentionMenu.groups }
    : slashMenu
  // QA-140: the keyboard stops include the connection header rows of the slash menu (Space turns their switch).
  const slashSwitchRows = typedComposer.trigger?.kind === 'slash' ? slashMenu.connectionSwitches?.rows ?? null : null
  const menuItems = React.useMemo(() => buildComposerMenuStops(activeMenu.groups, slashSwitchRows), [activeMenu.groups, slashSwitchRows])
  const menuOpen = typedComposer.trigger !== null
  const activeMenuItemId = menuItems[effectiveComposerMenuIndex(menuItems, typedComposer.activeIndex, typedComposer.activeExplicit)]?.id ?? null

  React.useEffect(() => {
    if (contextKeyRef.current === contextKey) return
    contextKeyRef.current = contextKey
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setIsUploading(false)
    setUploadProgress(null)
    setSelectedAssets([])
    setIsMediaPickerOpen(false)
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }, [contextKey])

  React.useEffect(() => () => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
  }, [])

  React.useEffect(() => registerBrowserPrincipalLifecycleResetter(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    resetComposer()
    setSelectedAssets([])
    setIsUploading(false)
    setUploadProgress(null)
    setIsMediaPickerOpen(false)
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }), [resetComposer])

  const catalogQuery = useQuery({
    queryKey: ASSISTANT_COMPOSER_CATALOG_QUERY_KEY,
    queryFn: getAssistantComposerCatalog,
    enabled: Boolean(channelId && ready),
    staleTime: 60_000,
  })
  const catalog = catalogQuery.data ?? null
  const options = React.useMemo(() => buildComposerOptions(catalog, tChat), [catalog, tChat])
  const minVideoDurationSeconds = catalog?.duration.min_seconds ?? COMPOSER_VIDEO_DURATION_MIN_SECONDS
  const maxVideoDurationSeconds = catalog?.duration.max_seconds ?? null
  const durationScaleMaxSeconds = catalog?.duration.scale_max_seconds ?? maxVideoDurationSeconds
  // QA-078: "Adet" of the canvas popover — up to the selected image model's max; the server re-checks it at dispatch.
  const outputCount = useComposerOutputCount({
    contextKey,
    text: draft,
    modelMax: readComposerOutputCountMax(selectedComposerImageModel(settings, catalog, options)?.inputSchema),
  })

  React.useEffect(() => {
    if (!catalog) return
    setSettings((current) => {
      const next = reconcileComposerSettings(current, catalog, tChat)
      return areComposerSettingsEqual(current, next) ? current : next
    })
  }, [catalog, tChat])

  // P01A-11: the server-committed planner model of this conversation and of its active job (job id = run id).
  // P03-14: model/mode commands target the composer's focused job (+ new jobs); without one only new jobs change.
  const conversationSettingsQuery = useQuery({
    queryKey: [...ASSISTANT_CONVERSATION_SETTINGS_QUERY_KEY, conversationId, selectedJobId],
    queryFn: ({ signal }) => getAssistantConversationSettings(
      { conversationId: conversationId!, jobId: selectedJobId },
      { signal },
    ),
    enabled: Boolean(conversationId),
  })
  const conversationSettings = conversationSettingsQuery.data ?? null
  const refetchConversationSettings = conversationSettingsQuery.refetch
  const plannerModel = React.useMemo(() => plannerModelView(conversationSettings), [conversationSettings])
  // P03-01 (Q74): three-level mode chip over the same settings command authority as the planner model.
  const mode = useComposerModeControl({
    conversationId,
    settings: conversationSettings,
    selectedJobId,
    catalog,
    refetchSettings: refetchConversationSettings,
    t: tChat,
    onNotice,
  })
  const [plannerModelCommandPending, setPlannerModelCommandPending] = React.useState(false)
  // A notice belongs to the conversation it was raised in; switching conversations never shows another one's.
  const [plannerModelNoticeState, setPlannerModelNoticeState] = React.useState<{ conversationId: string | null; result: PlannerModelCommandResult } | null>(null)
  const plannerModelNotice = plannerModelNoticeState && plannerModelNoticeState.conversationId === conversationId
    ? plannerModelNoticeState.result
    : null

  async function selectPlannerModel(modelId: string) {
    if (!conversationId) {
      // No conversation yet: the pick is only the first message's request; it is committed on send.
      setSettings((current) => ({ ...current, chatModelId: modelId }))
      return
    }
    if (!conversationSettings || plannerModelCommandPending || modelId === plannerModel.selectedModelId) return
    const job = conversationSettings.job && conversationSettings.job.job_id === selectedJobId ? conversationSettings.job : null
    setPlannerModelCommandPending(true)
    setPlannerModelNoticeState(null)
    try {
      const selectedJob = job ? { jobId: job.job_id, expectedJobSettingsVersion: job.job_settings_version } : null
      const result = await issueAssistantPlannerModelCommand({
        conversationId,
        plannerModelId: modelId,
        expectedConversationDefaultsVersion: conversationSettings.defaults.defaults_version,
        selectedJob,
      })
      if (shouldRetryPlannerModelForJobOnly(result.outcome, Boolean(selectedJob))) {
        // S9: a member of a shared conversation changes the model of the job they started; the default stays the owner's.
        const jobOnly = await issueAssistantPlannerModelCommand({
          conversationId,
          plannerModelId: modelId,
          expectedConversationDefaultsVersion: conversationSettings.defaults.defaults_version,
          selectedJob,
          jobOnly: true,
        })
        const jobOnlyOutcome = classifyPlannerModelCommand(jobOnly.outcome)
        setPlannerModelNoticeState({ conversationId, result: jobOnlyOutcome === 'applied' ? 'job_only' : jobOnlyOutcome })
        return
      }
      const outcome = classifyPlannerModelCommand(result.outcome)
      if (outcome !== 'applied') setPlannerModelNoticeState({ conversationId, result: outcome })
    } catch {
      setPlannerModelNoticeState({ conversationId, result: 'failed' })
    } finally {
      // Whatever happened, the composer shows the server's state, never the click.
      await refetchConversationSettings()
      setPlannerModelCommandPending(false)
    }
  }

  /** A brand-new conversation's first message: the picked model becomes its committed new-job default first. */
  async function commitInitialPlannerModel(newConversationId: string, modelId: string) {
    const current = await getAssistantConversationSettings({ conversationId: newConversationId })
    if (current.defaults.default_planner_model_id === modelId) return
    const result = await issueAssistantPlannerModelCommand({
      conversationId: newConversationId,
      plannerModelId: modelId,
      expectedConversationDefaultsVersion: current.defaults.defaults_version,
    })
    const outcome = classifyPlannerModelCommand(result.outcome)
    if (outcome !== 'applied') {
      setPlannerModelNoticeState({ conversationId: newConversationId, result: outcome })
      throw new Error(tChat(plannerModelNoticeKey(outcome)))
    }
  }

  // Each attached file gets a short name (`image1`, `video2`) that is written into the text as `@image1`; the file
  // itself shows as a small token next to "+" (hover to preview) instead of a box above the composer.

  const appendSelectedAsset = React.useCallback((asset: ChatAssetAttachment, options: { insertToken?: boolean } = {}) => {
    const current = selectedAssetsRef.current
    const existing = current.find((item) => item.id === asset.id)
    if (existing) return assetLabelsRef.current[existing.id] ?? null
    const label = nextComposerAssetLabel(asset.kind, current.map((item) => assetLabelsRef.current[item.id]).filter(Boolean))
    assetLabelsRef.current = { ...assetLabelsRef.current, [asset.id]: label }
    selectedAssetsRef.current = [...current, asset]
    setAssetLabels(assetLabelsRef.current)
    setSelectedAssets((items) => (items.some((item) => item.id === asset.id) ? items : [...items, asset]))
    if (options.insertToken !== false) setDraft((text) => appendComposerToken(text, `@${label}`))
    return label
  }, [setDraft])

  function selectMediaAsset(asset: ChatAssetAttachment) {
    appendSelectedAsset(asset)
    setIsMediaPickerOpen(false)
    // Typing goes on after the new `@image1` token (the caret was still where `@` was typed, before the token).
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
  }

  function removeMediaAsset(assetId: string) {
    const label = assetLabelsRef.current[assetId]
    setSelectedAssets((current) => current.filter((asset) => asset.id !== assetId))
    if (label) setDraft((text) => removeComposerToken(text, `@${label}`))
  }

  /** `@` menu rows of attached files: an attached file writes its `@image1` token; "Kütüphaneden seç" opens the picker. */
  function handleAttachedFileMenuItem(item: TypedComposerMenuItem) {
    if (!item.id.startsWith('file:')) return false
    const trigger = typedComposer.trigger
    if (!trigger) return true
    const range = { start: trigger.start, end: trigger.end, token: draft.slice(trigger.start, trigger.end) }
    if (item.id === 'file:pick') {
      typedComposer.insertText(range, '')
      setIsMediaPickerOpen(true)
      return true
    }
    const label = assetLabelsRef.current[item.id.slice('file:'.length)]
    if (label) typedComposer.insertText(range, `@${label} `)
    return true
  }

  function selectMenuItem(item: TypedComposerMenuItem) {
    if (!handleAttachedFileMenuItem(item)) typedComposer.selectMenuItem(item)
  }

  /** Typing away a token removes what it refers to (the attached file or the `@` resource). */
  function handleTextChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    typedComposer.handleChange(event)
    const next = event.target.value
    const gone = (token: string) => hasComposerToken(draft, token) && !hasComposerToken(next, token)
    const removedAssetIds = selectedAssets.filter((asset) => assetLabels[asset.id] && gone(`@${assetLabels[asset.id]}`)).map((asset) => asset.id)
    if (removedAssetIds.length > 0) setSelectedAssets((current) => current.filter((asset) => !removedAssetIds.includes(asset.id)))
    for (const chip of typedComposer.chips) {
      if (chip.kind === 'mention' && gone(composerMentionToken(chip.label))) typedComposer.removeChip(chip.key)
    }
  }

  function removeMentionChip(chip: ComposerMentionChip) {
    typedComposer.removeChip(chip.key)
    setDraft((text) => removeComposerToken(text, composerMentionToken(chip.label)))
  }

  function openUploadPicker() {
    setIsAddMenuOpen(false)
    if (!uploadInputRef.current) return
    uploadInputRef.current.value = ''
    uploadInputRef.current.click()
  }

  async function upload(files: FileList | null) {
    const targetChannelId = channelId
    if (
      !files
      || files.length === 0
      || !targetChannelId
      || !ready
      || isUploading
    ) return
    const selectedFiles = Array.from(files).filter((file) => file.size > 0)
    if (selectedFiles.length === 0) return
    uploadAbortRef.current?.abort()
    const uploadController = new AbortController()
    uploadAbortRef.current = uploadController
    setIsUploading(true)
    setUploadProgress(0)
    onNotice(null)
    const memoryIngestion = memoryUpload.beginBatch(targetChannelId, selectedFiles)
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        if (uploadController.signal.aborted) break
        const file = selectedFiles[index]!
        const uploaded = await uploadChatMediaFile(targetChannelId, file, (progress) => {
          if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) return
          const base = (index / selectedFiles.length) * 100
          setUploadProgress(Math.round(base + (progress / selectedFiles.length)))
        }, uploadController.signal, memoryIngestion)
        if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) break
        appendSelectedAsset(uploaded)
      }
    } catch (uploadError) {
      if (!isChatUploadAbort(uploadError, uploadController.signal)) {
        onNotice(localizeError(uploadError))
      }
    } finally {
      if (uploadAbortRef.current !== uploadController) return
      uploadAbortRef.current = null
      setIsUploading(false)
      setUploadProgress(null)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  /** What a new chat started elsewhere brings (the new tab): the content, the files, the settings and the picks. */
  function snapshot(): NewChatHandoff {
    return {
      state: typedComposer.state,
      assets: selectedAssets,
      assetLabels: Object.fromEntries(selectedAssets.flatMap((asset) => (assetLabels[asset.id] ? [[asset.id, assetLabels[asset.id]!]] : []))),
      settings,
      mode: mode.draft,
      outputCount: outputCount.pick,
    }
  }

  const restoreDraftMode = mode.restoreDraft
  const restoreOutputCount = outputCount.restore
  /** Puts a handed-over composer back (a new chat started on the new tab); the files keep their `@image1` names. */
  const restore = React.useCallback((handoff: NewChatHandoff) => {
    const assets = handoff.assets.flatMap((value) => {
      const asset = readChatAssetAttachment(value)
      return asset ? [asset] : []
    })
    resetComposer(handoff.state)
    assetLabelsRef.current = { ...assetLabelsRef.current, ...handoff.assetLabels }
    selectedAssetsRef.current = assets
    setAssetLabels(assetLabelsRef.current)
    setSelectedAssets(assets)
    const restoredSettings = readComposerSettings(handoff.settings)
    if (restoredSettings) setSettings(restoredSettings)
    restoreDraftMode(handoff.mode)
    restoreOutputCount(handoff.outputCount)
  }, [resetComposer, restoreDraftMode, restoreOutputCount])

  const hasContent = Boolean(draft.trim() || selectedAssets.length > 0 || typedComposer.chips.length > 0)
  /** Everything but the host's own send state: the host adds `!sending`. */
  const canSubmit = Boolean(
    channelId
      && ready
      && hasContent
      && !isUploading
      // P01A-11: an existing conversation sends only after its committed model is known (no local guess).
      && !(conversationId && !conversationSettings)
      && !plannerModelCommandPending,
  )

  return {
    channelId,
    conversationId,
    ready,
    locale,
    textareaRef,
    formRef,
    uploadInputRef,
    typedComposer,
    draft,
    setDraft,
    slashMenu,
    mentionMenu,
    activeMenu,
    menuItems,
    menuOpen,
    activeMenuItemId,
    handleAttachedFileMenuItem,
    selectMenuItem,
    handleTextChange,
    removeMentionChip,
    catalog,
    options,
    minVideoDurationSeconds,
    maxVideoDurationSeconds,
    durationScaleMaxSeconds,
    settings,
    setSettings,
    outputCount,
    conversationSettings,
    refetchConversationSettings,
    plannerModel,
    plannerModelCommandPending,
    plannerModelNotice,
    selectPlannerModel,
    commitInitialPlannerModel,
    mode,
    memoryUpload,
    mcpTemplates,
    selectedAssets,
    setSelectedAssets,
    assetLabels,
    appendSelectedAsset,
    selectMediaAsset,
    removeMediaAsset,
    isUploading,
    uploadProgress,
    openUploadPicker,
    upload,
    isAddMenuOpen,
    setIsAddMenuOpen,
    isMediaPickerOpen,
    setIsMediaPickerOpen,
    hasContent,
    canSubmit,
    snapshot,
    restore,
  }
}

export type ChatComposerControl = ReturnType<typeof useChatComposer>

export function hasComposerToken(text: string, token: string) {
  return composerTokenPattern(token).test(text)
}

/** `image1`, `image2`, `video1`…: the lowest free number for the kind among the files already attached. */
export function nextComposerAssetLabel(kind: ChatAssetKind, taken: string[]) {
  const prefix = kind === 'document' ? 'file' : kind
  let index = 1
  while (taken.includes(`${prefix}${index}`)) index += 1
  return `${prefix}${index}`
}

export function composerTokenPattern(token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'u')
}

/** Adds ` @image1 ` at the end of the text unless it is already there. */
export function appendComposerToken(text: string, token: string) {
  if (composerTokenPattern(token).test(text)) return text
  const base = text.replace(/\s+$/u, '')
  return base ? `${base} ${token} ` : `${token} `
}

/** Removes the first `@image1` token from the text (and the extra space it leaves). */
export function removeComposerToken(text: string, token: string) {
  return text.replace(composerTokenPattern(token), '$1').replace(/ {2,}/gu, ' ')
}
