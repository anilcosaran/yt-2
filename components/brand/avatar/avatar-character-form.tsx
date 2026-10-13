'use client'

import * as React from 'react'
import {
  Box,
  ChevronDown,
  Clapperboard,
  Library,
  Palette,
  RotateCcw,
  Smile,
  Sparkles,
  Timer,
  Upload,
  UserRound,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  AvatarUpgradeNote,
  AvatarVoiceLibraryPicker,
  AvatarVoiceUploadField,
  EMPTY_VOICE_UPLOAD,
  type AvatarVoiceUploadValue,
} from '@/components/brand/avatar/avatar-voice-controls'
import { useAvatarImagePrice } from '@/components/brand/avatar/use-avatar-pricing'
import { CreditActionButton } from '@/components/billing/credit-action-button'
import {
  StorageMediaInput,
  type StorageMediaSelection,
} from '@/components/storage/storage-media-input'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createAvatar,
  createAvatarIdempotencyKey,
  type Avatar,
} from '@/lib/avatar/api'
import {
  buildCharacterPayload,
  buildVoicePayload,
  canSubmitCharacter,
  CHARACTER_FRAMINGS,
  CHARACTER_PROMPT_SUGGESTIONS,
  CHARACTER_SECTIONS,
  CHARACTER_STYLES,
  characterPreviewPrompt,
  composeCharacterPrompt,
  type AvatarVoiceChoice,
  type CharacterChipGroup,
  type CharacterDraft,
  type CharacterStyle,
} from '@/lib/avatar/character'
import {
  avatarEstimate,
  classifyAvatarPurchaseError,
  isAvatarFairUseReached,
  resolveAvatarCreationPrice,
  toAvatarExpectedPrice,
  type AvatarEntitlement,
} from '@/lib/avatar/entitlement'
import { getSafeAuthMessage } from '@/lib/auth/errors'
import type { CreditPrice } from '@/lib/billing/credit-price'
import { cn } from '@/lib/utils'

const STYLE_VISUALS: Record<CharacterStyle, { icon: LucideIcon; gradient: string }> = {
  realistic: { icon: UserRound, gradient: 'from-[#C9A27E] via-[#8C6A52] to-[#3B2A22]' },
  cinematic: { icon: Clapperboard, gradient: 'from-[#1F3B57] via-[#2C5E7A] to-[#D98E4A]' },
  cartoon: { icon: Smile, gradient: 'from-[#FFD166] via-[#F78C6B] to-[#EF476F]' },
  anime: { icon: Sparkles, gradient: 'from-[#8EC5FC] via-[#B69CF5] to-[#E0C3FC]' },
  '3d': { icon: Box, gradient: 'from-[#43C6AC] via-[#3A9DC7] to-[#191654]' },
  illustration: { icon: Palette, gradient: 'from-[#F6D365] via-[#E6A57E] to-[#B06AB3]' },
}

const SUGGESTION_IDS = ['presenter', 'mascot', 'narrator', 'coach', 'robot'] as const

export type CharacterVoiceMode = AvatarVoiceChoice['mode']

export function AvatarCharacterForm({
  channelId,
  entitlement,
  defaultDisplayName,
  initialDraft,
  initialReference = null,
  onCreated,
  onEntitlementStale,
}: {
  channelId: string
  entitlement: AvatarEntitlement | null
  defaultDisplayName: string
  initialDraft: CharacterDraft
  initialReference?: StorageMediaSelection | null
  onCreated: (avatar: Avatar) => void
  onEntitlementStale?: () => void
}) {
  const t = useTranslations('BrandAvatar.character')
  const tFlow = useTranslations('BrandAvatar.createFlow')
  const [draft, setDraft] = React.useState<CharacterDraft>(initialDraft)
  const [reference, setReference] = React.useState<StorageMediaSelection | null>(initialReference)
  const [voiceMode, setVoiceMode] = React.useState<CharacterVoiceMode>('library')
  const [voiceProfileId, setVoiceProfileId] = React.useState<string | null>(null)
  const [voiceUpload, setVoiceUpload] = React.useState<AvatarVoiceUploadValue>(EMPTY_VOICE_UPLOAD)
  const [voiceBusy, setVoiceBusy] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const referenceId = reference?.storageObjectId ?? null
  const voiceCloneEnabled = entitlement?.voice_clone_enabled ?? false
  const voiceChoice: AvatarVoiceChoice = voiceMode === 'library'
    ? { mode: 'library', voiceProfileId }
    : voiceMode === 'upload'
      ? {
          mode: 'upload',
          storageObjectId: voiceUpload.storageObjectId,
          consentAccepted: voiceUpload.consentAccepted,
        }
      : { mode: 'later' }
  const voicePayload = voiceMode === 'upload' && !voiceCloneEnabled ? null : buildVoicePayload(voiceChoice)
  const uploadVoiceClone = voiceMode === 'upload' && voiceCloneEnabled

  const isFree = (entitlement?.free_avatars.remaining ?? 0) > 0
  const imagePrice = useAvatarImagePrice({
    channelId,
    entitlement,
    sourceStorageObjectId: referenceId,
    enabled: Boolean(entitlement) && !isFree,
    fallback: 'character_credits',
  })
  const price: CreditPrice = !entitlement
    ? { kind: 'pending' }
    : !isFree && imagePrice.kind === 'pending'
      ? { kind: 'pending' }
      : resolveAvatarCreationPrice({
          entitlement,
          kind: 'digital_human',
          uploadVoiceClone,
          estimateCredits: imagePrice.kind === 'credits' ? imagePrice.credits : null,
          hasReference: Boolean(referenceId),
        })

  const contentReady = canSubmitCharacter(draft, Boolean(referenceId))
  const blockedReason = isAvatarFairUseReached(entitlement)
    ? tFlow('fairUse')
    : !contentReady
      ? t('blockedEmpty')
      : !voicePayload || (voiceMode === 'upload' && voiceBusy)
        ? t('blockedVoice')
        : null
  const freeStatus = price.kind === 'free'
    ? uploadVoiceClone
      ? t('freeWithVoiceClone', {
          remaining: price.remaining ?? 0,
          limit: price.limit ?? 0,
          credits: avatarEstimate(entitlement, 'voice_clone_credits'),
        })
      : tFlow('freeStatus', { remaining: price.remaining ?? 0, limit: price.limit ?? 0 })
    : null

  const updateField = (field: keyof CharacterDraft['fields'], value: string) => {
    setDraft((current) => ({ ...current, fields: { ...current.fields, [field]: value } }))
  }

  const submit = async () => {
    if (pending || blockedReason || !voicePayload) return
    const expectedPrice = toAvatarExpectedPrice(price)
    if (!expectedPrice) return
    setPending(true)
    setError(null)
    try {
      const avatar = await createAvatar({
        channelId,
        kind: 'digital_human',
        displayName: draft.name.trim() || defaultDisplayName,
        idempotencyKey: createAvatarIdempotencyKey('create-avatar'),
        sourceStorageObjectId: referenceId ?? undefined,
        character: buildCharacterPayload(draft, { hasReference: Boolean(referenceId) }),
        voice: voicePayload,
        expectedPrice,
      })
      onCreated(avatar)
    } catch (caught) {
      setError(describeCreateError(caught, tFlow))
      if (classifyAvatarPurchaseError(caught) !== 'other') onEntitlementStale?.()
    } finally {
      setPending(false)
    }
  }

  const preview = draft.mode === 'detailed' ? characterPreviewPrompt(draft) : ''

  return (
    <div data-avatar-create-step="character" className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <SegmentControl
          ariaLabel={t('modeLabel')}
          value={draft.mode}
          options={[
            { value: 'detailed', label: t('modeDetailed') },
            { value: 'prompt', label: t('modePrompt') },
          ]}
          onChange={(mode) => setDraft((current) => ({ ...current, mode: mode as CharacterDraft['mode'] }))}
        />

        <section>
          <SectionTitle>{t('styleTitle')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-character-styles="cards">
            {CHARACTER_STYLES.map((style) => {
              const visual = STYLE_VISUALS[style]
              const Icon = visual.icon
              const selected = draft.style === style
              return (
                <button
                  key={style}
                  type="button"
                  data-character-style={style}
                  aria-pressed={selected}
                  onClick={() => setDraft((current) => ({ ...current, style: current.style === style ? null : style }))}
                  className={cn(
                    'group overflow-hidden rounded-2xl border text-left transition',
                    selected ? 'border-foreground ring-2 ring-foreground/20' : 'border-border hover:border-foreground/30',
                  )}
                >
                  <span className={cn('flex aspect-[16/9] items-center justify-center bg-gradient-to-br', visual.gradient)}>
                    <Icon className="size-7 text-white drop-shadow" strokeWidth={1.6} />
                  </span>
                  <span className="block px-3 py-2 text-sm font-medium text-foreground">{t(`styles.${style}`)}</span>
                </button>
              )
            })}
          </div>
        </section>

        {draft.mode === 'detailed' ? (
          <>
            {CHARACTER_SECTIONS.map((section) => (
              <section key={section.id} className="space-y-3" data-character-section={section.id}>
                <SectionTitle>{t(`sections.${section.id}`)}</SectionTitle>
                {section.groups.map((group) => (
                  <ChipGroup
                    key={group.field}
                    group={group}
                    value={draft.fields[group.field] ?? ''}
                    onChange={(value) => updateField(group.field, value)}
                  />
                ))}
              </section>
            ))}
            <section className="space-y-2">
              <SectionTitle>{t('framingTitle')}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                <Chip selected={!draft.framing} onClick={() => setDraft((current) => ({ ...current, framing: null }))}>
                  {t('any')}
                </Chip>
                {CHARACTER_FRAMINGS.map((framing) => (
                  <Chip
                    key={framing}
                    selected={draft.framing === framing}
                    onClick={() => setDraft((current) => ({ ...current, framing }))}
                  >
                    {t(`framing.${framing}`)}
                  </Chip>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="space-y-3" data-character-prompt="free">
            <SectionTitle>{t('promptLabel')}</SectionTitle>
            <div className="rounded-2xl border border-border bg-panel/40 px-3.5 py-3 transition-colors focus-within:border-foreground/30">
              <Textarea
                value={draft.prompt}
                maxLength={2000}
                rows={6}
                placeholder={t('promptPlaceholder')}
                aria-label={t('promptLabel')}
                onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                className="min-h-36 resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus-visible:ring-0"
              />
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
                  onClick={() => setDraft((current) => ({
                    ...current,
                    prompt: nextSuggestion(current.prompt),
                  }))}
                >
                  <Wand2 className="size-3.5" />
                  {t('suggest')}
                </button>
                <span>{draft.prompt.length} / 2000</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTION_IDS.map((id, index) => (
                <Chip
                  key={id}
                  selected={draft.prompt === CHARACTER_PROMPT_SUGGESTIONS[index]}
                  onClick={() => setDraft((current) => ({ ...current, prompt: CHARACTER_PROMPT_SUGGESTIONS[index]! }))}
                >
                  {t(`suggestions.${id}`)}
                </Chip>
              ))}
            </div>
          </section>
        )}

        <VoiceSection
          channelId={channelId}
          mode={voiceMode}
          voiceCloneEnabled={voiceCloneEnabled}
          voiceCredits={avatarEstimate(entitlement, 'voice_clone_credits')}
          voiceProfileId={voiceProfileId}
          upload={voiceUpload}
          onModeChange={setVoiceMode}
          onVoiceProfileChange={setVoiceProfileId}
          onUploadChange={setVoiceUpload}
          onUploadBusyChange={setVoiceBusy}
        />

        <section className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block">
            <SectionTitle>{t('nameLabel')}</SectionTitle>
            <Input
              value={draft.name}
              maxLength={120}
              placeholder={defaultDisplayName}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <div>
            <SectionTitle>{t('orientationTitle')}</SectionTitle>
            <SegmentControl
              ariaLabel={t('orientationTitle')}
              value={draft.orientation}
              options={[
                { value: 'portrait', label: t('orientation.portrait') },
                { value: 'landscape', label: t('orientation.landscape') },
              ]}
              onChange={(orientation) => setDraft((current) => ({
                ...current,
                orientation: orientation as CharacterDraft['orientation'],
              }))}
            />
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-5 md:sticky md:top-0 md:self-start">
        {draft.mode === 'detailed' ? (
          <section data-character-preview="prompt">
            <div className="mb-2 flex items-center justify-between gap-2">
              <SectionTitle className="mb-0">{t('previewTitle')}</SectionTitle>
              {draft.promptEdited ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setDraft((current) => ({ ...current, prompt: '', promptEdited: false }))}
                >
                  <RotateCcw className="size-3" />
                  {t('previewReset')}
                </button>
              ) : null}
            </div>
            <Textarea
              value={preview}
              rows={7}
              maxLength={2000}
              aria-label={t('previewTitle')}
              onChange={(event) => setDraft((current) => ({
                ...current,
                prompt: event.target.value,
                promptEdited: event.target.value.trim() !== composeCharacterPrompt(current),
              }))}
              className="min-h-40 resize-none rounded-2xl bg-panel/40 text-sm leading-6"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{t('previewHint')}</p>
          </section>
        ) : null}

        <section>
          <SectionTitle>{t('referenceTitle')}</SectionTitle>
          <StorageMediaInput
            channelId={channelId}
            value={referenceId ?? ''}
            selectedName={reference?.name}
            mediaKind="image"
            uploadMetadata={{ asset_role: 'avatar_reference' }}
            onChange={setReference}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{t('referenceHint')}</p>
        </section>

        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <CreditActionButton
          id="avatar-character-create"
          label={t('submit')}
          busyLabel={tFlow('creating')}
          price={price}
          availableCredits={entitlement?.credits.available ?? null}
          busy={pending}
          blockedReason={blockedReason}
          freeStatus={freeStatus}
          suggestUpgradeWhenInsufficient={(entitlement?.free_avatars.limit ?? 0) === 0}
          onClick={() => void submit()}
        />
      </aside>
    </div>
  )
}

export function describeCreateError(
  caught: unknown,
  tFlow: (key: string, values?: Record<string, string | number>) => string,
) {
  switch (classifyAvatarPurchaseError(caught)) {
    case 'price_changed': return tFlow('priceChanged')
    case 'insufficient_credits': return tFlow('insufficient')
    case 'clone_disabled': return tFlow('cloneDisabled')
    case 'voice_clone_disabled': return tFlow('voiceCloneDisabled')
    case 'voice_slots_full': return tFlow('voiceSlotsFullError')
    case 'fair_use': return tFlow('fairUse')
    case 'disabled': return tFlow('avatarsDisabled')
    default: return getSafeAuthMessage(caught)
  }
}

function nextSuggestion(current: string) {
  const index = CHARACTER_PROMPT_SUGGESTIONS.findIndex((item) => item === current)
  return CHARACTER_PROMPT_SUGGESTIONS[(index + 1) % CHARACTER_PROMPT_SUGGESTIONS.length]!
}

function VoiceSection({
  channelId,
  mode,
  voiceCloneEnabled,
  voiceCredits,
  voiceProfileId,
  upload,
  onModeChange,
  onVoiceProfileChange,
  onUploadChange,
  onUploadBusyChange,
}: {
  channelId: string
  mode: CharacterVoiceMode
  voiceCloneEnabled: boolean
  voiceCredits: number
  voiceProfileId: string | null
  upload: AvatarVoiceUploadValue
  onModeChange: (mode: CharacterVoiceMode) => void
  onVoiceProfileChange: (voiceProfileId: string | null) => void
  onUploadChange: (value: AvatarVoiceUploadValue) => void
  onUploadBusyChange: (busy: boolean) => void
}) {
  const t = useTranslations('BrandAvatar.character')
  const [open, setOpen] = React.useState(true)
  const options: Array<{ value: CharacterVoiceMode; icon: LucideIcon; label: string }> = [
    { value: 'library', icon: Library, label: t('voiceLibrary') },
    { value: 'upload', icon: Upload, label: t('voiceUpload') },
    { value: 'later', icon: Timer, label: t('voiceLater') },
  ]
  return (
    <section className="rounded-2xl border border-border" data-character-voice={mode}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">{t('voiceTitle')}</span>
          <span className="block text-xs text-muted-foreground">{t('voiceOptional')}</span>
        </span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-4">
          <div role="radiogroup" aria-label={t('voiceTitle')} className="grid grid-cols-3 gap-2">
            {options.map((option) => {
              const Icon = option.icon
              const selected = mode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onModeChange(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-medium transition',
                    selected ? 'border-foreground bg-foreground/5 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {option.label}
                </button>
              )
            })}
          </div>
          {mode === 'library' ? (
            <>
              <AvatarVoiceLibraryPicker channelId={channelId} value={voiceProfileId} onChange={onVoiceProfileChange} />
              <p className="text-xs text-muted-foreground">{t('voiceLibraryHint')}</p>
            </>
          ) : null}
          {mode === 'upload' ? (
            voiceCloneEnabled ? (
              <>
                <AvatarVoiceUploadField
                  channelId={channelId}
                  value={upload}
                  onChange={onUploadChange}
                  onBusyChange={onUploadBusyChange}
                />
                <p className="text-xs text-muted-foreground">{t('voiceUploadPrice', { credits: voiceCredits })}</p>
              </>
            ) : (
              <AvatarUpgradeNote message={t('voiceUpgrade')} />
            )
          ) : null}
          {mode === 'later' ? <p className="text-xs text-muted-foreground">{t('voiceLaterHint')}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function ChipGroup({
  group,
  value,
  onChange,
}: {
  group: CharacterChipGroup
  value: string
  onChange: (value: string) => void
}) {
  const t = useTranslations('BrandAvatar.character')
  const chipMatch = group.options.find((option) => option.value === value)
  const freeValue = chipMatch ? '' : value
  return (
    <div data-character-field={group.field}>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t(`fields.${group.field}`)}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {group.options.length > 0 ? (
          <Chip selected={!value} onClick={() => onChange('')}>{t('any')}</Chip>
        ) : null}
        {group.options.map((option) => (
          <Chip
            key={option.id}
            selected={value === option.value}
            onClick={() => onChange(value === option.value ? '' : option.value)}
          >
            {t(`options.${group.field}.${option.id}`)}
          </Chip>
        ))}
        {group.freeText ? (
          <Input
            value={freeValue}
            maxLength={120}
            aria-label={t(`fields.${group.field}`)}
            placeholder={t(`freeText.${group.field}`)}
            onChange={(event) => onChange(event.target.value)}
            className={cn('h-8 rounded-full px-3 text-xs', group.options.length > 0 ? 'w-44' : 'w-full')}
          />
        ) : null}
      </div>
    </div>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'h-8 rounded-full border px-3 text-xs font-medium transition',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function SegmentControl({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-full bg-muted/80 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-semibold transition sm:text-sm',
            value === option.value ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('mb-2 text-sm font-semibold text-foreground', className)}>{children}</p>
}
