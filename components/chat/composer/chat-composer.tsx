'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  AtSign,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  Cpu,
  Film,
  Image as ImageIcon,
  Images as ImagesIcon,
  LayoutTemplate,
  Loader2,
  Lock,
  Mic,
  PencilLine,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Type as TypeIcon,
  Upload,
  UserRound,
  X,
} from 'lucide-react'

import { ChatInlineAlert } from '@/components/chat/chat-inline-alert'
import { useChatCopy, type ChatCopy, type ChatLocale, type ChatTranslator } from '@/components/chat/chat-copy'
import { ComposerAddConnectors } from '@/components/chat/composer/composer-add-connectors'
import { ComposerOutputCountSection, composerOutputCountButtonValue } from '@/components/chat/composer/composer-output-count-section'
import { connectionSwitchGroupBody } from '@/components/chat/composer/connection-switch-rows'
import { ComposerModeChip, TypedComposerChips, TypedComposerMenu, menuItemDomId } from '@/components/chat/composer/typed-composer-parts'
import { FullAccessWarningCard } from '@/components/chat/full-access-warning-card'
import { UiText } from '@/components/i18n/ui-text'
import { MemoryIngestionCheckbox, MemoryUploadSummaryLine } from '@/components/memory/memory-ingestion-checkbox'
import type { MemoryUploadChoice } from '@/components/memory/use-memory-upload-choice'
import { PromptBox, PromptBoxChip, PromptBoxInput, PromptBoxSend, PromptBoxSpacer } from '@/components/spark/agent/prompt-box'
import { isStorageMediaSelectable } from '@/components/storage/storage-media-input'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { isCommandChip, type ComposerMentionChip } from '@/lib/assistant/composer/composer-state'
import type { ComposerOutputCountControl } from '@/lib/assistant/composer/use-composer-output-count'
import { composerMentionToken } from '@/lib/assistant/composer/use-typed-composer'
import { plannerModelHint, type PlannerModelCommandResult, type PlannerModelView } from '@/lib/assistant/planner-model-selection'
import { listStorageObjects, type StorageListInput, type StorageObjectItem } from '@/lib/storage/api'
import { useStorageThumbnailUrl } from '@/lib/storage/use-storage-thumbnail-url'
import { cn } from '@/lib/utils'

import {
  AttachmentKindIcon,
  CHAT_MEDIA_UPLOAD_ACCEPT,
  attachmentFromStorageItem,
  formatAttachmentMeta,
  formatBytesLabel,
  getMediaThumbnailUrl,
  inferAttachmentKind,
  isChatUploadAbort,
  isVisualAttachment,
  uploadChatMediaFile,
  type ChatAssetAttachment,
} from './chat-attachments'
import {
  COMPOSER_DURATION_PRESETS,
  COMPOSER_DURATION_SLIDER_STEP_SECONDS,
  COMPOSER_VIDEO_DURATION_MIN_SECONDS,
  PLANNER_MODEL_HINT_KEYS,
  PLANNER_MODEL_NOTICE_KEYS,
  clampVideoDurationSeconds,
  composerImageTaskOptions,
  composerModelSupportsImageTask,
  getComposerDurationScaleMax,
  modelInputOptions,
  parseComposerDurationInteger,
  reconcileImageModelInputs,
  selectComposerImageModelForTask,
  type ComposerAspectOption,
  type ComposerAspectRatio,
  type ComposerDurationUnit,
  type ComposerInputOption,
  type ComposerModelOption,
  type ComposerOptions,
  type ComposerSettings,
} from './composer-settings'
import { hasComposerToken, type ChatComposerControl } from './use-chat-composer'

type MediaPickerView = 'image' | 'video' | 'uploads'

const CHAT_COMPOSER_MENU_ID = 'chat-composer-menu'

/**
 * The main Chat's composer (P03-01), one for every place that starts or continues a Chat conversation: the Chat page
 * and the new tab. Its state is `useChatComposer`; the host adds what belongs to its run: `leading` (the job focus
 * chip), `send` (the send / stop button), `onSubmit` and the placeholder. `dialogs`: the media picker, the file input
 * and the MCP template form render with it; the Chat page renders them itself (`ChatComposerDialogs`) at its root.
 */
export function ChatComposer({
  composer,
  size = 'default',
  onSubmit,
  leading,
  send,
  placeholder,
  sending = false,
  autoFocus,
  ariaLabel,
  dialogs = true,
}: {
  composer: ChatComposerControl
  /** `big`: the start screen's box (a taller field). */
  size?: 'default' | 'big'
  onSubmit: React.FormEventHandler<HTMLFormElement>
  /** Before the command chips, inside the box (the Chat's job focus chip). */
  leading?: React.ReactNode
  /** In place of the plain send button (the Chat's production send / stop). */
  send?: React.ReactNode
  placeholder?: string
  /** The host is sending: the field and the chips wait. */
  sending?: boolean
  autoFocus?: boolean
  ariaLabel?: string
  dialogs?: boolean
}) {
  const copy = useChatCopy()
  const tChat = useTranslations('Chat') as unknown as ChatTranslator
  const mirrorRef = React.useRef<HTMLDivElement | null>(null)
  const inputWrapRef = React.useRef<HTMLDivElement | null>(null)
  const [tokenHover, setTokenHover] = React.useState<{ token: string; left: number; bottom: number } | null>(null)
  const { typedComposer, draft, selectedAssets, assetLabels, channelId, conversationId, conversationSettings, ready, formRef, textareaRef } = composer
  const canSubmit = composer.canSubmit && !sending

  // `@image1` / `@Ece_Avatar` tokens of this message: the inline layer draws them as pills with their picture.
  const tokens = new Map<string, ComposerTokenRef>()
  for (const asset of selectedAssets) {
    const label = assetLabels[asset.id]
    if (label) tokens.set(`@${label}`, { kind: 'asset', asset })
  }
  for (const chip of typedComposer.chips) {
    if (chip.kind === 'mention') tokens.set(composerMentionToken(chip.label), { kind: 'mention', chip })
  }
  const inlineTokens = [...tokens.keys()].filter((token) => hasComposerToken(draft, token))
  // A reference whose token is not in the text (e.g. the text was replaced) stays visible next to "+".
  const orphanAssets = selectedAssets.filter((asset) => !inlineTokens.includes(`@${assetLabels[asset.id] ?? ''}`))
  const orphanMentions = typedComposer.chips.filter((chip): chip is ComposerMentionChip => chip.kind === 'mention' && !inlineTokens.includes(composerMentionToken(chip.label)))

  /** The preview card of the token under the pointer (the layer sits under the textarea, so hit-test its pills). */
  function handlePointer(event: React.MouseEvent<HTMLTextAreaElement>) {
    const mirror = mirrorRef.current
    const wrap = inputWrapRef.current
    if (!mirror || !wrap || inlineTokens.length === 0) {
      if (tokenHover) setTokenHover(null)
      return
    }
    for (const element of mirror.querySelectorAll<HTMLElement>('[data-token]')) {
      const rect = element.getBoundingClientRect()
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        const token = element.dataset.token ?? ''
        if (tokenHover?.token !== token) {
          const box = wrap.getBoundingClientRect()
          setTokenHover({ token, left: rect.left - box.left, bottom: box.bottom - rect.top + 6 })
        }
        return
      }
    }
    if (tokenHover) setTokenHover(null)
  }

  const trigger = typedComposer.trigger
  const hoveredToken = tokenHover ? tokens.get(tokenHover.token) : undefined

  return (
    <>
      {composer.isUploading && (
        <ComposerUploadProgress progress={composer.uploadProgress} locale={composer.locale} />
      )}
      {(selectedAssets.length > 0 || composer.isUploading) && (
        <MemoryUploadSummaryLine summary={composer.memoryUpload.summary} className="-mt-1 mb-2 px-1" />
      )}

      <PromptBox
        as="form"
        ref={formRef}
        size={size}
        className="@container scroll-mt-24"
        onSubmit={onSubmit}
        overlay={composer.menuOpen && trigger ? (
          <TypedComposerMenu
            id={CHAT_COMPOSER_MENU_ID}
            kind={trigger.kind}
            groups={composer.activeMenu.groups}
            activeItemId={composer.activeMenuItemId}
            loading={composer.activeMenu.loading}
            error={composer.activeMenu.error}
            notice={trigger.kind === 'mention' && composer.mentionMenu.failedKinds.length > 0 ? tChat('typedComposer.resourcesPartial') : null}
            onSelect={composer.selectMenuItem}
            renderGroupBody={trigger.kind === 'slash' ? connectionSwitchGroupBody(composer.slashMenu.connectionSwitches, { menuId: CHAT_COMPOSER_MENU_ID, activeStopId: composer.activeMenuItemId }) : undefined}
          />
        ) : null}
        top={(
          <TypedComposerChips
            chips={typedComposer.chips.filter(isCommandChip)}
            disabled={sending}
            onRemove={typedComposer.removeChip}
            onCopy={typedComposer.copyChips}
            leading={leading}
          />
        )}
        bar={(
          <>
            <ComposerAddMenu
              copy={copy}
              open={composer.isAddMenuOpen}
              disabled={!channelId || !ready || composer.isUploading}
              onOpenChange={composer.setIsAddMenuOpen}
              onUpload={composer.openUploadPicker}
              onAssets={() => {
                composer.setIsAddMenuOpen(false)
                composer.setIsMediaPickerOpen(true)
              }}
              memoryUpload={composer.memoryUpload}
              connectors={<ComposerAddConnectors active={composer.isAddMenuOpen} conversationId={conversationId} onAdd={() => composer.setIsAddMenuOpen(false)} />}
            />
            <ComposerReferenceTokens
              assets={orphanAssets}
              labels={assetLabels}
              mentions={orphanMentions}
              disabled={sending}
              onRemoveAsset={composer.removeMediaAsset}
              onRemoveMention={composer.removeMentionChip}
            />
            <ComposerSettingsChips
              settings={composer.settings}
              options={composer.options}
              minVideoDurationSeconds={composer.minVideoDurationSeconds}
              maxVideoDurationSeconds={composer.maxVideoDurationSeconds}
              durationScaleMaxSeconds={composer.durationScaleMaxSeconds}
              disabled={!channelId || !ready}
              modelsDisabled={!channelId || !ready}
              plannerModel={{
                serverBacked: Boolean(conversationId),
                loaded: Boolean(conversationSettings),
                pending: composer.plannerModelCommandPending,
                view: composer.plannerModel,
                notice: composer.plannerModelNotice,
                onSelect: (modelId) => void composer.selectPlannerModel(modelId),
              }}
              outputCount={composer.outputCount}
              onChange={composer.setSettings}
            />
            <PromptBoxSpacer />
            <ComposerModeChip
              value={composer.mode.value}
              options={composer.mode.options}
              pending={composer.mode.pending}
              disabled={!channelId || !ready || (Boolean(conversationId) && !conversationSettings)}
              onSelect={(mode) => void composer.mode.select(mode)}
            />
            {composer.mode.fullAccessConsent && (
              <FullAccessWarningCard
                prompt={composer.mode.fullAccessConsent.prompt}
                onConfirm={composer.mode.fullAccessConsent.confirm}
                onDismiss={composer.mode.fullAccessConsent.dismiss}
              />
            )}
            {send ?? <PromptBoxSend label={copy.sendMessage} disabled={!canSubmit} busy={sending} />}
          </>
        )}
      >
        <div ref={inputWrapRef} className="relative">
          {inlineTokens.length > 0 && (
            <ComposerTokenMirror mirrorRef={mirrorRef} text={draft} tokens={tokens} inline={inlineTokens} />
          )}
          <PromptBoxInput
            ref={textareaRef}
            value={draft}
            onChange={composer.handleTextChange}
            onSelect={typedComposer.handleSelect}
            onScroll={(event) => {
              if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop
            }}
            onMouseMove={handlePointer}
            onMouseLeave={() => setTokenHover(null)}
            onPaste={(event) => { typedComposer.handlePaste(event) }}
            aria-controls={composer.menuOpen ? CHAT_COMPOSER_MENU_ID : undefined}
            aria-activedescendant={composer.menuOpen && composer.activeMenuItemId ? menuItemDomId(CHAT_COMPOSER_MENU_ID, composer.activeMenuItemId) : undefined}
            aria-label={ariaLabel}
            onKeyDown={(event) => {
              // An attached-file row of the `@` menu is handled here (it adds text, not a chip).
              if (composer.menuOpen && (event.key === 'Enter' || event.key === 'Tab') && composer.activeMenuItemId?.startsWith('file:')) {
                const item = composer.activeMenu.groups.flatMap((group) => group.items).find((entry) => entry.id === composer.activeMenuItemId)
                if (item && composer.handleAttachedFileMenuItem(item)) {
                  event.preventDefault()
                  return
                }
              }
              // P03-01: menu keys (select only adds a chip) and the composer's own undo history come first.
              if (typedComposer.handleKeyDown(event, composer.menuOpen ? composer.menuItems : [], {
                onToggleSwitch: (stop) => { if (!composer.slashMenu.connectionSwitches?.pending) void composer.slashMenu.connectionSwitches?.setEnabled(stop.connectionId, !stop.enabled) },
              })) return
              if (event.key !== 'Enter' || event.shiftKey) return
              if (!canSubmit) return
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }}
            placeholder={placeholder ?? (!channelId ? copy.selectChannel : copy.placeholder)}
            disabled={!channelId || !ready || sending}
            rows={size === 'big' ? 2 : 1}
            autoFocus={autoFocus}
            // With tokens in the text the layer underneath draws the words; the textarea keeps caret and selection.
            className={cn('relative', inlineTokens.length > 0 && 'pb-ghost selection:bg-primary/25')}
          />
          {tokenHover && hoveredToken && (
            <ComposerTokenPreview
              reference={hoveredToken}
              token={tokenHover.token}
              style={{ left: tokenHover.left, bottom: tokenHover.bottom }}
            />
          )}
        </div>
      </PromptBox>
      {dialogs ? <ChatComposerDialogs composer={composer} /> : null}
    </>
  )
}

/** What the composer opens outside its box: the media picker, the hidden file input and the MCP template form. */
export function ChatComposerDialogs({ composer }: { composer: ChatComposerControl }) {
  const { uploadInputRef, mcpTemplates, isMediaPickerOpen, setIsMediaPickerOpen, ready, channelId, locale, selectMediaAsset, memoryUpload, upload } = composer
  return (
    <>
      {mcpTemplates.dialog}
      <MediaPickerDialog
        open={isMediaPickerOpen}
        channelId={ready ? channelId : null}
        locale={locale}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={selectMediaAsset}
        memoryUpload={memoryUpload}
      />
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept={CHAT_MEDIA_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => void upload(event.currentTarget.files)}
      />
    </>
  )
}

function ComposerSettingsChips({
  settings,
  options,
  minVideoDurationSeconds,
  maxVideoDurationSeconds,
  durationScaleMaxSeconds,
  disabled,
  modelsDisabled,
  plannerModel,
  outputCount,
  onChange,
}: {
  settings: ComposerSettings
  options: ComposerOptions
  minVideoDurationSeconds: number
  maxVideoDurationSeconds: number | null
  durationScaleMaxSeconds: number | null
  disabled: boolean
  /** P01A-11: the models control stays usable during an active job (a switch applies from its next step). */
  modelsDisabled: boolean
  plannerModel: ComposerPlannerModelControl
  /** QA-078: the "Adet" section of the canvas popover. */
  outputCount: ComposerOutputCountControl
  onChange: React.Dispatch<React.SetStateAction<ComposerSettings>>
}) {
  const selectedImageModel = selectComposerImageModelForTask(settings.imageModelId, settings.imageTask, options.imageModels)
  const compatibleImageModels = options.imageModels.filter((option) => composerModelSupportsImageTask(option, settings.imageTask))
  const imageModelOptions = compatibleImageModels.length > 0 ? compatibleImageModels : options.imageModels
  const imageTaskOptions = composerImageTaskOptions(options.imageModels)
  const imageSizeOptions = modelInputOptions(selectedImageModel, 'sizes')
  const imageResolutionOptions = modelInputOptions(selectedImageModel, 'resolutions')
  const imageQualityOptions = modelInputOptions(selectedImageModel, 'qualities')
  const imageFormatOptions = modelInputOptions(selectedImageModel, 'output_formats')

  return (
    <>
      <ComposerModelsControl
        settings={settings}
        options={options}
        imageModels={imageModelOptions}
        disabled={modelsDisabled}
        mediaDisabled={disabled}
        plannerModel={plannerModel}
        onChange={onChange}
      />
      <ComposerOutputControl
        aspectRatio={settings.aspectRatio}
        aspectOptions={options.aspectRatios}
        imageTask={settings.imageTask}
        imageTaskOptions={imageTaskOptions}
        imageModels={options.imageModels}
        disabled={disabled}
        onChange={onChange}
      />
      <ComposerDurationChip
        value={settings.durationSeconds}
        minSeconds={minVideoDurationSeconds}
        maxSeconds={maxVideoDurationSeconds}
        scaleMaxSeconds={durationScaleMaxSeconds}
        disabled={disabled || maxVideoDurationSeconds === null}
        onChange={(durationSeconds) => onChange((current) => ({ ...current, durationSeconds }))}
      />
      <ComposerCanvasControl
        settings={settings}
        imageSizeOptions={imageSizeOptions}
        imageResolutionOptions={imageResolutionOptions}
        imageQualityOptions={imageQualityOptions}
        imageFormatOptions={imageFormatOptions}
        outputCount={outputCount}
        disabled={disabled}
        onChange={onChange}
      />
    </>
  )
}

type ComposerControlOption = {
  id: string
  label: string
  hint: string
}

/** P01A-11 chat model control: server-backed for an existing conversation, a local first-message pick otherwise. */
type ComposerPlannerModelControl = {
  serverBacked: boolean
  loaded: boolean
  pending: boolean
  view: PlannerModelView
  notice: PlannerModelCommandResult | null
  onSelect: (modelId: string) => void
}

/**
 * A composer bar popover: it opens under its button when there is room below (the centered start screen) and flips
 * above it otherwise (the composer at the bottom of a conversation); with room on neither side it scrolls.
 */
function ComposerPopoverContent({ className, ...props }: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      side="bottom"
      align="start"
      sideOffset={8}
      collisionPadding={12}
      className={cn('youtorch-thin-scrollbar max-h-(--radix-popover-content-available-height) overflow-y-auto rounded-xl border-border bg-popover shadow-xl shadow-black/40', className)}
      {...props}
    />
  )
}

/**
 * The composer menus' look (the model picker's): sections split by a rule (`divide-y` on the popover), a quiet label,
 * one-line rows. Shared by the "+", output, duration and canvas menus.
 */
function ComposerMenuSection({ label, className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className={cn('p-1.5', className)}>
      {label ? <p className="px-2.5 pb-1 pt-1 text-xs text-muted-foreground">{label}</p> : null}
      {children}
    </div>
  )
}

/** A menu row: icon, name, an optional quiet value (`16:9`) and, for a choice, ✓ when it is the selected one. */
function ComposerMenuRow({
  icon,
  label,
  meta,
  selected,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & {
  icon?: React.ReactNode
  label: React.ReactNode
  meta?: React.ReactNode
  /** Set for a choice (✓ when true); left out for an action row. */
  selected?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        'flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      {icon ? <span className={cn('flex size-[18px] shrink-0 items-center justify-center [&>svg]:size-[18px]', selected ? 'text-foreground' : 'text-muted-foreground')}>{icon}</span> : null}
      <span className={cn('min-w-0 flex-1 truncate', selected ? 'font-semibold text-foreground' : 'text-foreground/75')}>{label}</span>
      {meta ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
      {selected === undefined ? null : selected ? <Check strokeWidth={1.75} className="size-4 shrink-0 text-foreground" /> : <span className="size-4 shrink-0" />}
    </button>
  )
}

/** A composer bar button; also the `asChild` trigger of its popover (the trigger's props reach the button). */
function ComposerControlButton({
  icon: Icon,
  label,
  value,
  open,
  ...props
}: Omit<React.ComponentProps<'button'>, 'value'> & {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string
  open: boolean
  /** A ⌄ after the value (the model picker, like a select). */
  caret?: boolean
}) {
  return (
    <PromptBoxChip
      title={value ? `${label}: ${value}` : label}
      aria-expanded={open}
      {...props}
      icon={<Icon />}
      srLabel={label}
      label={value}
      collapse
    />
  )
}

/** A choice row of a composer menu (also the "Adet" section's row); the hint is the quiet value at its end. */
function ComposerControlOptionRow({
  option,
  selected,
  disabled = false,
  onClick,
}: {
  option: ComposerControlOption
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return <ComposerMenuRow label={option.label} meta={option.hint || undefined} selected={selected} disabled={disabled} onClick={onClick} />
}

function ComposerModelsControl({
  settings,
  options,
  imageModels,
  disabled,
  mediaDisabled,
  plannerModel,
  onChange,
}: {
  settings: ComposerSettings
  options: ComposerOptions
  imageModels: ComposerModelOption[]
  disabled: boolean
  /** Video/image picks keep their previous rule (locked while a job runs); only the chat model stays switchable. */
  mediaDisabled: boolean
  plannerModel: ComposerPlannerModelControl
  onChange: React.Dispatch<React.SetStateAction<ComposerSettings>>
}) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  // Model Selector (AI Elements): a searchable palette, models grouped by what they do.
  const [open, setOpen] = React.useState(false)
  // P01A-11: exact catalog models; the checked one is the server-committed model (or the unsent first-message pick).
  const plannerModelValue = plannerModel.serverBacked ? plannerModel.view.selectedModelId : settings.chatModelId
  const groups = [
    {
      key: 'orchestration' as const,
      icon: Cpu,
      title: tChat('composer.orchestration'),
      value: plannerModelValue,
      options: options.chatModels.map((option) => {
        const hint = plannerModel.serverBacked ? plannerModelHint(option.id, plannerModel.view) : null
        return { id: option.id, label: option.label, hint: hint ? tChat(PLANNER_MODEL_HINT_KEYS[hint]) : option.description }
      }),
    },
    {
      key: 'video' as const,
      icon: Film,
      title: tChat('composer.video'),
      value: settings.videoModelId,
      options: options.videoModels.map((option) => ({ id: option.id, label: option.label, hint: option.description })),
    },
    {
      key: 'image' as const,
      icon: ImageIcon,
      title: tChat('composer.image'),
      value: settings.imageModelId,
      options: imageModels.map((option) => ({ id: option.id, label: option.label, hint: option.description })),
    },
  ]

  function selectModel(group: (typeof groups)[number]['key'], id: string) {
    if (group === 'orchestration') {
      plannerModel.onSelect(id)
      return
    }
    if (group === 'video') {
      onChange((current) => ({ ...current, videoModelId: id }))
      return
    }
    onChange((current) => {
      const model = options.imageModels.find((option) => option.id === id) ?? null
      return { ...current, imageModelId: id, ...reconcileImageModelInputs(current, model) }
    })
  }

  const plannerLabel = options.chatModels.find((option) => option.id === plannerModelValue)?.label

  return (
    <Popover open={open && !disabled} onOpenChange={(nextOpen) => setOpen(disabled ? false : nextOpen)}>
      <PopoverTrigger asChild>
        <ComposerControlButton
          icon={Cpu}
          label={tAuto('models_f3798f81')}
          value={plannerLabel}
          open={open}
          disabled={disabled}
          caret
        />
      </PopoverTrigger>
      {/* A quiet select: search on top, one line per model (its kind's icon, name, ✓ / lock), groups split by rules. */}
      <ComposerPopoverContent aria-label={tChat('modelSelector.title')} className="w-72 overflow-hidden p-0">
        <Command className="bg-transparent **:data-[slot=command-input-wrapper]:h-11 **:data-[slot=command-input-wrapper]:gap-2.5 **:data-[slot=command-input-wrapper]:px-3.5 [&_[cmdk-group-heading]]:sr-only">
          <CommandInput placeholder={tChat('modelSelector.search')} />
          <CommandList className="youtorch-thin-scrollbar max-h-[min(22rem,calc(var(--radix-popover-content-available-height,100vh)_-_3rem))]">
            <CommandEmpty>{tChat('modelSelector.empty')}</CommandEmpty>
            {groups.map((group, index) => (
              <React.Fragment key={group.key}>
                {index > 0 ? <CommandSeparator className="mx-0" /> : null}
                <CommandGroup heading={group.title} className="p-1.5">
                  {group.key === 'orchestration' && plannerModel.notice ? (
                    <p role="status" className="px-2.5 py-1.5 text-xs text-muted-foreground">{tChat(PLANNER_MODEL_NOTICE_KEYS[plannerModel.notice])}</p>
                  ) : null}
                  {group.key === 'orchestration' && plannerModel.serverBacked && !plannerModel.loaded ? (
                    <p className="px-2.5 py-1.5 text-xs text-muted-foreground">{tChat('composer.modelSettingsLoading')}</p>
                  ) : group.options.map((option) => {
                    const selected = option.id === group.value
                    const locked = group.key === 'orchestration' ? plannerModel.pending : mediaDisabled
                    return (
                      <CommandItem
                        key={option.id}
                        value={`${group.title} ${option.label} ${option.id}`}
                        disabled={locked}
                        title={option.hint || undefined}
                        onSelect={() => {
                          selectModel(group.key, option.id)
                          setOpen(false)
                        }}
                        className="h-9 gap-3 rounded-lg px-2.5"
                      >
                        <group.icon className={cn('!size-[18px]', selected ? 'text-foreground' : 'text-muted-foreground')} />
                        <span className={cn('min-w-0 flex-1 truncate text-sm', selected ? 'font-semibold text-foreground' : 'text-foreground/75')}>{option.label}</span>
                        {selected
                          ? <Check strokeWidth={1.75} className="!size-4 text-foreground" />
                          : locked ? <Lock className="!size-3.5 text-muted-foreground" /> : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </ComposerPopoverContent>
    </Popover>
  )
}

/** The icon of an image generation mode in the output menu (an unknown mode gets the sparkles). */
const IMAGE_TASK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text_to_image: TypeIcon,
  image_to_image: ImageIcon,
  reference_image: ImagesIcon,
  image_edit: PencilLine,
}

function ComposerOutputControl({
  aspectRatio,
  aspectOptions,
  imageTask,
  imageTaskOptions,
  imageModels,
  disabled,
  onChange,
}: {
  aspectRatio: ComposerAspectRatio
  aspectOptions: ComposerAspectOption[]
  imageTask: string
  imageTaskOptions: ComposerInputOption[]
  imageModels: ComposerModelOption[]
  disabled: boolean
  onChange: React.Dispatch<React.SetStateAction<ComposerSettings>>
}) {
  const tAuto = useTranslations('Auto')
  const [open, setOpen] = React.useState(false)
  const selectedAspect = aspectOptions.find((option) => option.id === aspectRatio) ?? aspectOptions[0]

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ComposerControlButton
          icon={SlidersHorizontal}
          label={tAuto('output_4bed3361')}
          value={selectedAspect?.id === '9:16' ? tAuto('short_0fe7d82f') : selectedAspect?.label}
          open={open}
          disabled={disabled}
        />
      </PopoverTrigger>
      <ComposerPopoverContent className="w-64 divide-y divide-border p-0">
        <ComposerMenuSection label={tAuto('frame_size_b4062689')}>
          {aspectOptions.map((option) => (
            <ComposerMenuRow
              key={option.id}
              icon={<option.icon />}
              label={option.id === '9:16' ? tAuto('short_0fe7d82f') : option.label}
              meta={option.id}
              selected={option.id === aspectRatio}
              onClick={() => onChange((current) => ({ ...current, aspectRatio: option.id }))}
            />
          ))}
        </ComposerMenuSection>
        {imageTaskOptions.length > 0 && (
          <ComposerMenuSection label={tAuto('generation_mode_d4e81c05')}>
            {imageTaskOptions.map((option) => {
              const TaskIcon = IMAGE_TASK_ICONS[option.id] ?? Sparkles
              return (
                <ComposerMenuRow
                  key={option.id}
                  icon={<TaskIcon />}
                  label={option.label}
                  title={option.detail}
                  selected={option.id === imageTask}
                  onClick={() => onChange((current) => {
                    const model = selectComposerImageModelForTask(current.imageModelId, option.id, imageModels)
                    const nextInputs = reconcileImageModelInputs({ ...current, imageTask: option.id }, model)
                    return { ...current, imageModelId: model?.id ?? current.imageModelId, ...nextInputs }
                  })}
                />
              )
            })}
          </ComposerMenuSection>
        )}
      </ComposerPopoverContent>
    </Popover>
  )
}

function ComposerDurationChip({
  value,
  minSeconds,
  maxSeconds,
  scaleMaxSeconds,
  disabled,
  onChange,
}: {
  value: number
  minSeconds: number
  maxSeconds: number | null
  scaleMaxSeconds: number | null
  disabled: boolean
  onChange: (value: number) => void
}) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  const formatLocalizedDurationLabel = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.round(seconds))
    if (safeSeconds < 60) return tChat('composer.durationSeconds', { seconds: safeSeconds })
    const minutes = Math.floor(safeSeconds / 60)
    const remainingSeconds = safeSeconds % 60
    if (minutes < 60) return remainingSeconds === 0
      ? tChat('composer.durationMinutes', { minutes })
      : tChat('composer.durationMinutesSeconds', { minutes, seconds: remainingSeconds })
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes === 0
      ? tChat('composer.durationHours', { hours })
      : tChat('composer.durationHoursMinutes', { hours, minutes: remainingMinutes })
  }
  const [open, setOpen] = React.useState(false)
  const [customValue, setCustomValue] = React.useState('')
  const [customUnit, setCustomUnit] = React.useState<ComposerDurationUnit>('minutes')
  const resolvedMinSeconds = Math.max(COMPOSER_VIDEO_DURATION_MIN_SECONDS, Math.round(minSeconds))
  const planMaxSeconds = Math.max(resolvedMinSeconds, Math.round(maxSeconds ?? resolvedMinSeconds))
  const clampedValue = clampVideoDurationSeconds(value, planMaxSeconds, resolvedMinSeconds)
  const sliderStepSeconds = COMPOSER_DURATION_SLIDER_STEP_SECONDS
  const sliderScaleMaxSeconds = getComposerDurationScaleMax(planMaxSeconds, scaleMaxSeconds)
  const upgradeAvailable = sliderScaleMaxSeconds > planMaxSeconds
  const [sliderValue, setSliderValue] = React.useState(clampedValue)
  const normalizedSliderValue = clampVideoDurationSeconds(sliderValue, sliderScaleMaxSeconds, resolvedMinSeconds)
  const planLimitProgress = Math.min((planMaxSeconds / sliderScaleMaxSeconds) * 100, 100)
  const progress = Math.min((Math.min(normalizedSliderValue, planMaxSeconds) / sliderScaleMaxSeconds) * 100, 100)
  const isPastPlanLimit = normalizedSliderValue > planMaxSeconds
  const customDurationSeconds = parseComposerDurationInteger(customValue, customUnit)
  const customExceedsPlan = customDurationSeconds !== null && customDurationSeconds > planMaxSeconds

  const commitDuration = React.useCallback((candidateSeconds: number) => {
    const committedSeconds = clampVideoDurationSeconds(candidateSeconds, planMaxSeconds, resolvedMinSeconds)
    setSliderValue(committedSeconds)
    onChange(committedSeconds)
    setOpen(false)
  }, [onChange, planMaxSeconds, resolvedMinSeconds])

  // Opening starts from the committed duration with an empty custom field; closing drops an uncommitted slider value.
  const handleOpenChange = (nextOpen: boolean) => {
    setSliderValue(clampedValue)
    if (nextOpen) setCustomValue('')
    setOpen(nextOpen)
  }

  const commitCustomDuration = () => {
    if (customDurationSeconds === null) return
    commitDuration(customDurationSeconds)
  }

  return (
    <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <PromptBoxChip
          disabled={disabled}
          aria-expanded={open}
          icon={<Clock />}
          label={<span className="tabular-nums">{maxSeconds === null ? tAuto('length_3bade34e') : formatLocalizedDurationLabel(clampedValue)}</span>}
        />
      </PopoverTrigger>

      <ComposerPopoverContent className="w-72 divide-y divide-border p-0">
        <div className="px-4 pb-3 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground"><UiText id="duration_1370004d" /></span>
            <span className={cn('text-sm font-semibold tabular-nums', isPastPlanLimit ? 'text-rose-400' : 'text-foreground')}>
              {formatLocalizedDurationLabel(normalizedSliderValue)}
            </span>
          </div>

          <div className="relative mt-3 flex h-4 items-center">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-accent">
              {upgradeAvailable && (
                <div
                  className="absolute inset-y-0 right-0 bg-rose-500/25"
                  style={{ width: (100 - planLimitProgress) + '%' }}
                />
              )}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-foreground/80 transition-[width] duration-150 ease-out"
                style={{ width: progress + '%' }}
              />
            </div>
            <input
              type="range"
              min={resolvedMinSeconds}
              max={sliderScaleMaxSeconds}
              step={sliderStepSeconds}
              value={normalizedSliderValue}
              onChange={(event) => setSliderValue(Number(event.currentTarget.value))}
              onPointerUp={(event) => commitDuration(Number(event.currentTarget.value))}
              onPointerCancel={(event) => commitDuration(Number(event.currentTarget.value))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setSliderValue(clampedValue)
                  setOpen(false)
                }
              }}
              onKeyUp={(event) => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter'].includes(event.key)) {
                  commitDuration(Number(event.currentTarget.value))
                }
              }}
              className={cn(
                'absolute inset-0 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-popover [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110',
                isPastPlanLimit
                  ? '[&::-webkit-slider-thumb]:bg-rose-400'
                  : '[&::-webkit-slider-thumb]:bg-foreground',
              )}
              aria-label={tAuto('video_duration_72347bc5')}
              aria-valuetext={isPastPlanLimit
                ? tChat('composer.planLimitExceededSelection', { duration: formatLocalizedDurationLabel(planMaxSeconds) })
                : formatLocalizedDurationLabel(normalizedSliderValue)}
            />
          </div>

          <div className="relative mt-1 h-4 whitespace-nowrap text-[11px] text-muted-foreground">
            <span className="absolute left-0">{formatLocalizedDurationLabel(resolvedMinSeconds)}</span>
            <span
              className="absolute -translate-x-full text-foreground/75"
              style={{ left: planLimitProgress + '%' }}
            >
              {formatLocalizedDurationLabel(planMaxSeconds)}
            </span>
            {upgradeAvailable && <span className="absolute right-0 text-rose-400"><UiText id="maks_sure_fc0583c5" /></span>}
          </div>

          {(isPastPlanLimit || customExceedsPlan) && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-4 text-rose-400">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {isPastPlanLimit
                  ? tChat('composer.planMaximumWillBeSelected', { duration: formatLocalizedDurationLabel(planMaxSeconds) })
                  : customExceedsPlan
                    ? tChat('composer.planMaximumWillBeApplied', { duration: formatLocalizedDurationLabel(planMaxSeconds) })
                    : tChat('composer.planMaximum', { duration: formatLocalizedDurationLabel(planMaxSeconds) })}
              </span>
            </p>
          )}
        </div>

        <div className="grid auto-cols-fr grid-flow-col gap-1 p-1.5">
          {COMPOSER_DURATION_PRESETS.map((preset) => {
            const locked = preset < resolvedMinSeconds || preset > planMaxSeconds
            const selected = clampedValue === preset
            return (
              <button
                key={preset}
                type="button"
                disabled={locked}
                aria-pressed={selected}
                title={locked ? tChat('composer.planMaximum', { duration: formatLocalizedDurationLabel(planMaxSeconds) }) : undefined}
                onClick={() => commitDuration(preset)}
                className={cn(
                  'h-8 whitespace-nowrap rounded-lg px-1 text-[13px] tabular-nums transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-35',
                  selected ? 'bg-accent font-semibold text-foreground' : 'text-foreground/75',
                )}
              >
                {formatLocalizedDurationLabel(preset)}
              </button>
            )
          })}
        </div>

        <div className="p-1.5">
          <div className="flex h-9 items-center gap-3 rounded-lg px-2.5 focus-within:bg-accent/60">
            <Clock className={cn('size-[18px] shrink-0', customExceedsPlan ? 'text-rose-400' : 'text-muted-foreground')} />
            <input
              value={customValue}
              inputMode="numeric"
              pattern="[0-9]*"
              onChange={(event) => {
                const digits = event.currentTarget.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
                setCustomValue(digits)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                commitCustomDuration()
              }}
              placeholder="3"
              aria-label={tAuto('custom_video_duration_796a41ab')}
              className="min-w-0 flex-1 bg-transparent text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="relative shrink-0">
              <select
                value={customUnit}
                onChange={(event) => setCustomUnit(event.currentTarget.value as ComposerDurationUnit)}
                aria-label={tAuto('duration_unit_0af43a1a')}
                className="h-7 appearance-none rounded-md bg-transparent py-0 pl-2 pr-6 text-xs text-foreground/75 outline-none transition hover:bg-accent focus-visible:bg-accent"
              >
                <option value="seconds">{tChat('composer.secondsShort')}</option>
                <option value="minutes">{tChat('composer.minutesShort')}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            </div>
            <button
              type="button"
              disabled={customDurationSeconds === null}
              title={customExceedsPlan ? tChat('composer.maximumApplied', { duration: formatLocalizedDurationLabel(planMaxSeconds) }) : tAuto('sureyi_uygula_59d32ccd')}
              onClick={commitCustomDuration}
              aria-label={tAuto('apply_custom_duration_36683753')}
              className={cn(
                '-mr-1 grid size-7 shrink-0 place-items-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30',
                customExceedsPlan
                  ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                  : 'bg-foreground text-background hover:bg-foreground/90',
              )}
            >
              <Check className="size-3.5" />
            </button>
          </div>
        </div>
      </ComposerPopoverContent>
    </Popover>
  )
}
function ComposerCanvasControl({
  settings,
  imageSizeOptions,
  imageResolutionOptions,
  imageQualityOptions,
  imageFormatOptions,
  outputCount,
  disabled,
  onChange,
}: {
  settings: ComposerSettings
  imageSizeOptions: ComposerInputOption[]
  imageResolutionOptions: ComposerInputOption[]
  imageQualityOptions: ComposerInputOption[]
  imageFormatOptions: ComposerInputOption[]
  outputCount: ComposerOutputCountControl
  disabled: boolean
  onChange: React.Dispatch<React.SetStateAction<ComposerSettings>>
}) {
  const tAuto = useTranslations('Auto')
  const tChat = useTranslations('Chat')
  const [open, setOpen] = React.useState(false)
  const groups = [
    { key: 'imageSize' as const, title: tChat('composer.canvasSize'), value: settings.imageSize, options: imageSizeOptions },
    { key: 'imageResolution' as const, title: tChat('composer.resolution'), value: settings.imageResolution, options: imageResolutionOptions },
    { key: 'imageQuality' as const, title: tChat('composer.quality'), value: settings.imageQuality, options: imageQualityOptions },
    { key: 'imageOutputFormat' as const, title: tChat('composer.format'), value: settings.imageOutputFormat, options: imageFormatOptions },
  ].filter((group) => group.options.length > 0)

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ComposerControlButton
          icon={LayoutTemplate}
          label={tAuto('canvas_a3f80b87')}
          value={composerOutputCountButtonValue(outputCount, tChat)}
          open={open}
          disabled={disabled}
        />
      </PopoverTrigger>
      <ComposerPopoverContent className="max-h-[min(24rem,var(--radix-popover-content-available-height,100vh))] w-60 divide-y divide-border p-0">
        <ComposerOutputCountSection view={outputCount} row={ComposerControlOptionRow} onSelect={outputCount.select} />
        {groups.length === 0 && outputCount.options.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground"><UiText id="no_canvas_settings_for_this_model_c1bf28da" /></p>
        ) : groups.map((group) => (
          <ComposerMenuSection key={group.key} label={group.title}>
            {group.options.map((option) => (
              <ComposerMenuRow
                key={option.id}
                label={option.label}
                title={option.detail}
                selected={option.id === group.value}
                onClick={() => onChange((current) => ({ ...current, [group.key]: option.id }))}
              />
            ))}
          </ComposerMenuSection>
        ))}
      </ComposerPopoverContent>
    </Popover>
  )
}

function ComposerUploadProgress({
  progress,
  locale,
}: {
  progress: number | null
  locale: ChatLocale
}) {
  const copy = useChatCopy()
  return (
    <div className="mb-3 rounded-[14px] border border-border/80 bg-background px-3 py-2 text-foreground shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-none">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 animate-spin text-muted-foreground dark:text-white/58" />
        <span>{copy.uploadingMedia}{progress === null ? '' : ` ${progress}%`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-white/8">
        <div className="h-full rounded-full bg-primary transition-all dark:bg-white/70" style={{ width: `${progress ?? 12}%` }} />
      </div>
    </div>
  )
}

/** Attached files and `@` resources as small tokens next to "+": thumbnail/icon + `@name`; hover shows a preview. */
function ComposerReferenceTokens({
  assets,
  labels,
  mentions,
  disabled,
  onRemoveAsset,
  onRemoveMention,
}: {
  assets: ChatAssetAttachment[]
  labels: Record<string, string>
  mentions: ComposerMentionChip[]
  disabled: boolean
  onRemoveAsset: (assetId: string) => void
  onRemoveMention: (chip: ComposerMentionChip) => void
}) {
  const tAuto = useTranslations('Auto')
  if (assets.length === 0 && mentions.length === 0) return null
  const token = 'flex h-9 max-w-44 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/40 pl-1 pr-1.5 text-xs font-medium text-foreground'
  const remove = 'flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-45'
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {assets.map((asset) => {
        const name = `@${labels[asset.id] ?? asset.kind}`
        return (
          <HoverCard key={asset.id} openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span className={token} tabIndex={0}>
                <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                  <ComposerTokenThumb asset={asset} iconClassName="size-3.5" />
                </span>
                <span className="truncate">{name}</span>
                <button type="button" disabled={disabled} aria-label={tAuto('remove_attachment_0fcc6594')} onClick={() => onRemoveAsset(asset.id)} className={remove}>
                  <X className="size-3" />
                </button>
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-64 p-2">
              <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                <ComposerTokenThumb asset={asset} iconClassName="size-8" />
              </div>
              <p className="mt-2 truncate px-1 text-sm font-medium text-foreground">{name}</p>
              <p className="truncate px-1 text-xs text-muted-foreground">{asset.name}</p>
            </HoverCardContent>
          </HoverCard>
        )
      })}
      {mentions.map((chip) => {
        const name = composerMentionToken(chip.label)
        return (
          <HoverCard key={chip.key} openDelay={150} closeDelay={80}>
            <HoverCardTrigger asChild>
              <span className={token} tabIndex={0}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MentionKindIcon chip={chip} className="size-3.5" />
                </span>
                <span className="truncate">{name}</span>
                <button type="button" disabled={disabled} aria-label={tAuto('remove_attachment_0fcc6594')} onClick={() => onRemoveMention(chip)} className={remove}>
                  <X className="size-3" />
                </button>
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-56 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MentionKindIcon chip={chip} className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{chip.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{name}</span>
                </span>
              </div>
            </HoverCardContent>
          </HoverCard>
        )
      })}
    </div>
  )
}

type ComposerTokenRef = { kind: 'asset'; asset: ChatAssetAttachment } | { kind: 'mention'; chip: ComposerMentionChip }

function MentionKindIcon({ chip, className }: { chip: ComposerMentionChip; className?: string }) {
  if (chip.resourceKind === 'avatar') return <UserRound className={className} />
  if (chip.resourceKind === 'voice') return <Mic className={className} />
  if (chip.resourceKind.includes('template')) return <LayoutTemplate className={className} />
  return <AtSign className={className} />
}

/** Space (px) between a token's picture and its label in the composer text. */
const COMPOSER_TOKEN_PICTURE_GAP = 3

/**
 * Draws the composer text under the (transparent) textarea with the same box and wrapping, so `@image1` tokens show
 * as pills with their picture in place of the `@`, exactly where they are typed. Same characters, so the caret lines up.
 */
function ComposerTokenMirror({
  mirrorRef,
  text,
  tokens,
  inline,
}: {
  mirrorRef: React.Ref<HTMLDivElement>
  text: string
  tokens: Map<string, ComposerTokenRef>
  inline: string[]
}) {
  const alternatives = inline.map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')
  const pattern = new RegExp(`(?<=^|\\s)(${alternatives})(?=\\s|$)`, 'u')
  const parts = text.split(pattern)
  return (
    <div
      ref={mirrorRef}
      aria-hidden="true"
      className="pb-input pb-mirror"
    >
      {parts.map((part, index) => {
        const reference = index % 2 === 1 ? tokens.get(part) : undefined
        if (!reference) return <React.Fragment key={index}>{part}</React.Fragment>
        const label = part.slice(1)
        return (
          <span key={index} data-token={part} className="relative rounded-[5px] bg-primary/15 ring-[3px] ring-primary/15">
            <span className="text-transparent">@</span>
            <span className="absolute -left-px top-1/2 flex size-[14px] -translate-y-1/2 items-center justify-center overflow-hidden rounded-[4px] bg-muted text-muted-foreground">
              {reference.kind === 'asset' ? <ComposerTokenThumb asset={reference.asset} iconClassName="size-2.5" /> : <MentionKindIcon chip={reference.chip} className="size-2.5" />}
            </span>
            {/* A small gap after the picture; the label's tighter tracking gives the width back, so the token keeps its width. */}
            <span style={{ marginLeft: COMPOSER_TOKEN_PICTURE_GAP, letterSpacing: -COMPOSER_TOKEN_PICTURE_GAP / Array.from(label).length }}>{label}</span>
          </span>
        )
      })}
      {'\u200b'}
    </div>
  )
}

/** The preview card above a hovered token: the picture (or icon), the token and the file / resource name. */
function ComposerTokenPreview({ reference, token, style }: { reference: ComposerTokenRef; token: string; style: React.CSSProperties }) {
  return (
    <div style={style} className="pointer-events-none absolute z-30 w-60 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl shadow-black/30 duration-150 animate-in fade-in slide-in-from-bottom-1">
      {reference.kind === 'asset' ? (
        <>
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
            <ComposerTokenThumb asset={reference.asset} iconClassName="size-8" />
          </div>
          <p className="mt-2 truncate px-1 text-sm font-medium">{token}</p>
          <p className="truncate px-1 text-xs text-muted-foreground">{reference.asset.name}</p>
        </>
      ) : (
        <div className="flex items-center gap-2.5 p-1">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MentionKindIcon chip={reference.chip} className="size-5" /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{reference.chip.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{token}</span>
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * A token's picture: a Storage file's signed thumbnail (as in the media picker; a video has no image URL of its own),
 * else the file's preview image, else its kind icon (also when the image fails).
 */
function ComposerTokenThumb({ asset, iconClassName }: { asset: ChatAssetAttachment; iconClassName?: string }) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const storageThumbnail = useStorageThumbnailUrl({
    channelId: asset.channelId,
    objectId: asset.objectId ?? '',
    enabled: Boolean(asset.objectId) && isVisualAttachment(asset),
  })
  const src = storageThumbnail.data?.url ?? getMediaThumbnailUrl(asset) ?? (isVisualAttachment(asset) ? asset.previewUrl ?? null : null)
  if (!src || failedSrc === src) return <AttachmentKindIcon kind={asset.kind} className={iconClassName} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
}

function StoragePickerPreview({
  item,
  channelId,
}: {
  item: StorageObjectItem
  channelId: string | null
}) {
  const kind = inferAttachmentKind({ url: item.name, mimeType: item.mime_type, name: item.name })
  const thumbnail = useStorageThumbnailUrl({
    channelId,
    objectId: item.id,
    enabled: kind === 'image' || kind === 'video',
  })
  if (thumbnail.data?.url && (kind === 'image' || kind === 'video')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnail.data.url}
        alt={item.name}
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full object-cover"
      />
    )
  }
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground dark:text-white/48">
      <AttachmentKindIcon kind={kind} className="size-9" />
    </div>
  )
}

function ComposerAddMenu({
  copy,
  open,
  disabled,
  onOpenChange,
  onUpload,
  onAssets,
  memoryUpload,
  connectors,
}: {
  copy: ChatCopy
  open: boolean
  disabled: boolean
  onOpenChange: (open: boolean) => void
  onUpload: () => void
  onAssets: () => void
  memoryUpload: MemoryUploadChoice
  /** QA-131: the "Connectors" group (connected connectors + "Add" in a new tab). */
  connectors?: React.ReactNode
}) {
  return (
    <Popover open={open && !disabled} onOpenChange={(nextOpen) => onOpenChange(disabled ? false : nextOpen)}>
      <PopoverTrigger asChild>
        <PromptBoxChip aria-label={copy.addContext} title={copy.addContext} disabled={disabled} icon={<Plus />} />
      </PopoverTrigger>
      <ComposerPopoverContent className="w-64 divide-y divide-border p-0">
        <ComposerMenuSection>
          <ComposerMenuRow icon={<Upload />} label={copy.addMenuUpload} onClick={onUpload} />
          <MemoryIngestionCheckbox
            checked={memoryUpload.checked}
            availability={memoryUpload.availability}
            onCheckedChange={memoryUpload.setChecked}
            className={cn('h-9 w-full gap-3 rounded-lg px-2.5 hover:bg-accent [&>button]:mx-px', memoryUpload.availability.available && 'text-foreground/75')}
          />
          <ComposerMenuRow icon={<ImageIcon />} label={copy.addMenuAssets} onClick={onAssets} />
        </ComposerMenuSection>
        {connectors}
      </ComposerPopoverContent>
    </Popover>
  )
}

function MediaPickerDialog({
  open,
  channelId,
  locale,
  onClose,
  onSelect,
  memoryUpload,
}: {
  open: boolean
  channelId: string | null
  locale: ChatLocale
  onClose: () => void
  onSelect: (asset: ChatAssetAttachment) => void
  memoryUpload: MemoryUploadChoice
}) {
  const copy = useChatCopy()
  const localizeError = useLocalizedError()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const uploadAbortRef = React.useRef<AbortController | null>(null)
  const [view, setView] = React.useState<MediaPickerView>('image')
  const [search, setSearch] = React.useState('')
  const [items, setItems] = React.useState<StorageObjectItem[]>([])
  const [previewItem, setPreviewItem] = React.useState<StorageObjectItem | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setUploading(false)
    setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [channelId])

  React.useEffect(() => () => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
  }, [])

  React.useEffect(() => {
    if (!open || !channelId) return undefined
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    const timeout = window.setTimeout(() => {
      const input = getChatMediaListInput(view, search)
      listStorageObjects(channelId, input, { signal: controller.signal })
        .then((result) => {
          if (cancelled) return
          const nextItems = result.data.filter((item) => item.type === 'file')
          setItems(nextItems)
          setPreviewItem((current) => current && nextItems.some((item) => item.id === current.id) ? current : nextItems[0] ?? null)
        })
        .catch((loadError) => {
          if (cancelled) return
          setError(localizeError(loadError))
          setItems([])
          setPreviewItem(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 180)
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [channelId, open, search, view])

  if (!open) return null

  async function refreshItems(signal?: AbortSignal) {
    if (!channelId) return
    const result = await listStorageObjects(
      channelId,
      getChatMediaListInput(view, search),
      { signal },
    )
    const nextItems = result.data.filter((item) => item.type === 'file')
    setItems(nextItems)
    setPreviewItem(nextItems[0] ?? null)
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !channelId || uploading) return
    const selectedFiles = Array.from(files).filter((file) => file.size > 0)
    if (selectedFiles.length === 0) return
    uploadAbortRef.current?.abort()
    const uploadController = new AbortController()
    uploadAbortRef.current = uploadController
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    const memoryIngestion = memoryUpload.beginBatch(channelId, selectedFiles)
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        if (uploadController.signal.aborted) break
        const file = selectedFiles[index]!
        const uploaded = await uploadChatMediaFile(channelId, file, (progress) => {
          if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) return
          const base = (index / selectedFiles.length) * 100
          setUploadProgress(Math.round(base + (progress / selectedFiles.length)))
        }, uploadController.signal, memoryIngestion)
        if (uploadAbortRef.current !== uploadController || uploadController.signal.aborted) break
        onSelect(uploaded)
      }
      if (!uploadController.signal.aborted) await refreshItems(uploadController.signal)
    } catch (uploadError) {
      if (!isChatUploadAbort(uploadError, uploadController.signal)) {
        setError(localizeError(uploadError))
      }
    } finally {
      if (uploadAbortRef.current !== uploadController) return
      uploadAbortRef.current = null
      setUploading(false)
      setUploadProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const tabs: Array<{ id: MediaPickerView; label: string; icon: React.ReactNode }> = [
    { id: 'image', label: copy.mediaPickerImages, icon: <ImageIcon className="size-4" /> },
    { id: 'video', label: copy.mediaPickerVideos, icon: <Film className="size-4" /> },
    { id: 'uploads', label: copy.mediaPickerUploads, icon: <Upload className="size-4" /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/24 p-3 text-foreground backdrop-blur-md dark:bg-black/54 dark:text-white sm:p-6">
      <div className="flex h-[min(720px,92vh)] w-full max-w-5xl overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-[0_34px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#202020] dark:shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
        <aside className="relative hidden w-40 shrink-0 border-r border-border/70 bg-muted/45 p-3 dark:border-white/6 dark:bg-black/12 sm:block">
          <div className="mb-4 truncate px-2 text-sm font-semibold text-muted-foreground dark:text-white/74">{copy.mediaPickerTitle}</div>
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cn(
                  'flex h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                  view === tab.id
                    ? 'bg-accent text-accent-foreground dark:bg-white/16 dark:text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground dark:text-white/48 dark:hover:bg-white/8 dark:hover:text-white/76',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="absolute bottom-8 flex flex-col items-start gap-1">
            <MemoryIngestionCheckbox
              checked={memoryUpload.checked}
              availability={memoryUpload.availability}
              disabled={uploading || !channelId}
              onCheckedChange={memoryUpload.setChecked}
              className="px-3 py-1 text-xs dark:text-white/74"
            />
            <button
              type="button"
              disabled={uploading || !channelId}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50 dark:text-white dark:hover:bg-white/8"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {copy.mediaPickerUpload}
            </button>
            <MemoryUploadSummaryLine summary={memoryUpload.summary} className="max-w-[8.5rem] whitespace-normal px-3" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/70 p-3 dark:border-white/6">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-border/70 bg-input px-3 dark:border-transparent dark:bg-white/7">
              <Search className="size-5 shrink-0 text-muted-foreground dark:text-white/46" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.mediaPickerSearch}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground dark:text-white dark:placeholder:text-white/42"
              />
            </div>
            <div className="hidden h-11 items-center gap-2 rounded-[14px] border border-border/70 bg-muted/50 px-4 text-sm font-semibold text-muted-foreground dark:border-transparent dark:bg-white/7 dark:text-white/64 sm:flex">
              {copy.mediaPickerRecent}
              <ChevronDown className="size-4 text-muted-foreground/80 dark:text-white/42" />
            </div>
            <button
              type="button"
              aria-label={copy.mediaPickerClose}
              onClick={onClose}
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground dark:text-white/58 dark:hover:bg-white/8 dark:hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_480px]">
            <div className="min-h-0 overflow-y-auto p-4">
              <div className="mb-3 flex gap-2 sm:hidden">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setView(tab.id)}
                    className={cn(
                      'flex h-9 items-center gap-1 rounded-full px-3 text-sm transition-colors',
                      view === tab.id
                        ? 'bg-accent text-accent-foreground dark:bg-white dark:text-black'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:bg-white/8 dark:text-white/62 dark:hover:bg-white/12 dark:hover:text-white',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {error && (
                <ChatInlineAlert
                  tone="error"
                  title={copy.loadErrorTitle}
                  detail={error}
                  className="mb-3"
                />
              )}

              {uploading && (
                <div className="mb-3 rounded-md border border-border/80 bg-muted/35 px-3 py-2 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.055] dark:text-white/72">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <UiText id="uploading_media_456f6114" />{uploadProgress === null ? '' : ` ${uploadProgress}%`}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-white/8">
                    <div className="h-full rounded-full bg-primary transition-all dark:bg-white/55" style={{ width: `${uploadProgress ?? 12}%` }} />
                  </div>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-video rounded-md bg-muted dark:bg-white/8" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-muted-foreground dark:text-white/62">
                  <ImageIcon className="mb-3 size-12 text-muted-foreground/50 dark:text-white/32" />
                  <p className="text-lg font-semibold">{copy.mediaPickerEmpty}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {items.map((item) => {
                    const asset = attachmentFromStorageItem(item, channelId)
                    const selected = previewItem?.id === item.id
                    const selectable = isStorageMediaSelectable(item)
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'overflow-hidden rounded-md border bg-card text-left transition-colors hover:border-primary/30 hover:bg-muted/45 dark:bg-white/[0.045] dark:hover:border-white/24 dark:hover:bg-white/[0.07]',
                          selected ? 'border-primary/45 dark:border-white/34' : 'border-border/80 dark:border-white/10',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          onDoubleClick={() => selectable && onSelect(asset)}
                          className="block w-full text-left"
                        >
                          <div className="aspect-video bg-muted dark:bg-black/36">
                            <StoragePickerPreview item={item} channelId={channelId} />
                          </div>
                        </button>
                        <div className="flex items-center gap-2 p-2">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-medium text-foreground dark:text-white/82">{item.name}</p>
                            <p className="text-xs text-muted-foreground dark:text-white/38">{formatAttachmentMeta(asset)}</p>
                          </button>
                          <button
                            type="button"
                            aria-label={copy.mediaPickerSelect}
                            disabled={!selectable}
                            onClick={() => selectable && onSelect(asset)}
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 dark:bg-white/10 dark:text-white dark:hover:bg-white dark:hover:text-black"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="hidden min-h-0 border-l border-border/70 p-4 dark:border-white/6 md:block">
              <div className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border/70 bg-muted/30 dark:border-transparent dark:bg-white/[0.045]">
                {previewItem ? (
                  <>
                    <div className="min-h-0 flex-1 bg-muted/60 dark:bg-black/22">
                      <StoragePickerPreview item={previewItem} channelId={channelId} />
                    </div>
                    <div className="border-t border-border/70 p-4 dark:border-white/8">
                      <p className="truncate text-sm font-semibold text-foreground dark:text-white/86">{previewItem.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground dark:text-white/42">{previewItem.mime_type ?? 'file'} · {formatBytesLabel(previewItem.size_bytes)}</p>
                      <Button
                        type="button"
                        disabled={!isStorageMediaSelectable(previewItem)}
                        onClick={() => isStorageMediaSelectable(previewItem)
                          && onSelect(attachmentFromStorageItem(previewItem, channelId))}
                        className="mt-4 h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                      >
                        <Plus className="size-4" />
                        {copy.mediaPickerSelect}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground dark:text-white/38">
                    <ImageIcon className="size-10" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-t border-border/70 p-3 dark:border-white/6 sm:hidden">
            <MemoryIngestionCheckbox
              checked={memoryUpload.checked}
              availability={memoryUpload.availability}
              disabled={uploading || !channelId}
              onCheckedChange={memoryUpload.setChecked}
              className="justify-center text-xs dark:text-white/74"
            />
            <Button
              type="button"
              disabled={uploading || !channelId}
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {copy.mediaPickerUpload}
            </Button>
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={CHAT_MEDIA_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => void handleUpload(event.currentTarget.files)}
      />
    </div>
  )
}

function getChatMediaListInput(view: MediaPickerView, search: string): StorageListInput {
  const base: StorageListInput = {
    type: 'file',
    scope: 'descendants',
    search: search.trim() || undefined,
    sortBy: 'updated_at',
    sortOrder: 'desc',
    limit: 60,
  }
  if (view === 'image') return { ...base, category: 'image' }
  if (view === 'video') return { ...base, category: 'video' }
  return base
}
