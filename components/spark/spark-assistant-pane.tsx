'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { MotionResultCard } from '@/components/chat/motion-result-card'
import type { ComposerChip } from '@/lib/assistant/composer/composer-state'
import type { ComposerMenuStop } from '@/lib/assistant/composer/composer-menu-stops'
import { useTypedComposer } from '@/lib/assistant/composer/use-typed-composer'
import type { MotionUndoOutcome } from '@/lib/spark/motion-placement-undo'
import type { MotionPlacementView, MotionResult } from '@/lib/spark/motion-result'
import type { SparkQuickAiCard } from '@/lib/spark/quick-ai-session'
import { useLocalizedRuntimeError } from '@/lib/i18n/use-localized-runtime-error'
import type { SparkChatJobNotice } from '@/lib/spark/side-chat-job-notice'
import type { SparkChatEntry, SparkSideChatState } from '@/lib/spark/spark-side-chat'
import { shortText, type SparkLayerChip, type SparkTextLayerView } from '@/lib/spark/spark-selection'

import { PromptBox, PromptBoxInput, PromptBoxSend, PromptBoxSpacer } from './agent/prompt-box'
import { SparkComposerChips, SparkComposerMenuHost } from './spark-composer-menus'
import { SparkContextMeter } from './spark-context-meter'
import { SparkQuickAiCardView, type SparkQuickAiActions } from './spark-quick-ai'
import { SparkSpendMeter } from './spark-spend-meter'
import { StudioIcon } from './studio-icon'

/** QA-081: the project side chat as the pane needs it (state + actions of `SparkSideChatSession`). */
export type SparkSideChatView = {
  state: SparkSideChatState
  /** A job of the chat is running (not waiting for the user): the design's thinking row. */
  working: boolean
  /** FIX-DEV-3: a job failed (it leaves no message) or waits for the user's approval or payment (a card only Chat renders). */
  notice?: SparkChatJobNotice | null
  /** With a `failed` notice: the failed job's public error code (e.g. `E3101`), shown as its localized reason. */
  failureCode?: string | null
  /** E1-H: the typed composer sends the text and its chips (a `/motion` command chip, `@` mentions) as typed refs. */
  send: (text: string, chips?: readonly ComposerChip[]) => Promise<boolean>
  retryLoad: () => void
  /** QA-081: the open P03-23 chip question (e.g. "Hangi müzik?"), answered with one tap; typing answers it too. */
  question?: SparkChatEntry | null
  answer?: (entryId: string, option: { label: string; value: string }) => Promise<boolean>
}

type PaneEntry = { kind: 'card'; seq: number; card: SparkQuickAiCard } | { kind: 'chat'; seq: number; entry: SparkChatEntry }

/**
 * Where Enter in the composer sends. Y1-07 W8 fixes the routing bug: a focused text layer used to send the composer text
 * to the quick "rewrite" lane. Enter now ALWAYS goes to the side chat (with the selection as context); the quick lane
 * is reached only by its "Rewrite with AI" button. Only a pane with no side chat at all keeps the quick lane so the
 * composer is never dead.
 */
export function composerRoute(input: { hasChat: boolean; hasFocus: boolean }): 'chat' | 'quick' {
  return !input.hasChat && input.hasFocus ? 'quick' : 'chat'
}

/** More selected layers than this share one "N layers" chip. */
const MAX_LAYER_CHIPS = 3

/**
 * The right panel's Assistant tab (design `.pane` → `.msgs` + `.composer-wrap`).
 * - The composer talks to the project's side chat (QA-081); Enter ALWAYS sends there. The scene the user picked on the
 *   timeline is the message's selection (`.ctx .chip`, removable for a general request); Y1-07 W8 adds the selected
 *   layers (one chip per layer, `.chip.focus`) and the marked time range (`.chip`, clock icon). The transcript
 *   (`.m-user` / `.m-ai`) and the quick AI cards share one arrival order.
 * - QA-068: while a text layer is selected the focus chip (`.ctx .chip.focus`) and the suggestion row (`.sugg`,
 *   "Rewrite with AI") offer the quick lane for it. The quick lane is reached ONLY by that button; typing in the composer
 *   never reroutes the message (the old behaviour sent a focused text's composer text to the rewrite lane). Without a
 *   side chat (none linked) the composer falls back to the quick lane so it is never dead.
 */
export function SparkAssistantPane({
  cards,
  quickAi,
  onRewrite,
  focus,
  onClearFocus,
  sceneNumber,
  onClearScene,
  layers,
  onRemoveLayers,
  rangeLabel,
  onClearRange,
  chat,
  canWrite,
  writeTitle,
  promptRef,
  channelId,
  fps,
  onUndoMotion,
  motionOverrides,
  contextMeterEnabled = false,
}: {
  cards: readonly SparkQuickAiCard[]
  quickAi: SparkQuickAiActions
  /** Asks the quick lane to rewrite the focused text, following `instruction` when given. */
  onRewrite: (instruction: string | null) => void
  focus: SparkTextLayerView | null
  onClearFocus: () => void
  /** QA-081: strip number of the scene the next chat message is about (null: a general request). */
  sceneNumber?: number | null
  onClearScene?: () => void
  /** Y1-07 W8: the other selected layers of that scene (the focused text is `focus`), one chip each. */
  layers?: readonly SparkLayerChip[]
  onRemoveLayers?: (layerIds: readonly string[]) => void
  /** Y1-07 W8: the marked time range as "0:04–0:07"; null = no range. */
  rangeLabel?: string | null
  onClearRange?: () => void
  chat?: SparkSideChatView | null
  canWrite: boolean
  writeTitle: string | undefined
  promptRef?: React.RefObject<HTMLTextAreaElement | null>
  /** E1-H: the project's channel (the `/` and `@` menus read the channel's tools, skills and resources). */
  channelId?: string | null
  /** E1-H: the project's frame rate, for the "0:12" label of a Motion result card. */
  fps?: number
  /** E1-H: undoes the placement of a Motion result card (exactly its undo group); absent = no Undo button. */
  onUndoMotion?: (placement: Extract<MotionPlacementView, { status: 'applied' }>) => Promise<MotionUndoOutcome>
  /**
   * Code tab: a card whose revision the editor applied to the selected Motion layer shows the applied placement (with its
   * Undo) instead of the server's card; keyed by chat entry id. Absent = every card is the server's.
   */
  motionOverrides?: ReadonlyMap<string, MotionResult>
  /**
   * The context meter switch (`SPARK_CONTEXT_METER_ENABLED`): the context ring next to the send button replaces the spend
   * chip above the composer (its card carries the job's spend). Off: the spend chip, exactly as before.
   */
  contextMeterEnabled?: boolean
}) {
  const t = useTranslations('Spark.editor')
  const tq = useTranslations('Spark.editor.quickAi')
  const tc = useTranslations('Spark.editor.sideChat')
  const localizedRuntimeError = useLocalizedRuntimeError()
  const ta = useTranslations('Spark.editor.askAi')
  // E1-H: the typed composer (text + typed chips, one undo history, `/` and `@` triggers); the textarea is shared with the
  // shell's `promptRef` (Ask AI focuses it).
  const ownTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const textareaRef = promptRef ?? ownTextareaRef
  const stopsRef = React.useRef<readonly ComposerMenuStop[]>([])
  const composer = useTypedComposer({ resetKey: chat?.state.conversationId ?? 'spark-chat', textareaRef })
  const draft = composer.text
  const quickMode = composerRoute({ hasChat: Boolean(chat), hasFocus: focus !== null }) === 'quick'
  const chatReady = chat?.state.status === 'ready'
  const composing = quickMode ? canWrite : chatReady && !chat.state.sending
  const canSend = composing && (draft.trim().length > 0 || (!quickMode && composer.chips.length > 0))
  const entries = React.useMemo<PaneEntry[]>(() => {
    const merged: PaneEntry[] = [
      ...cards.map((card) => ({ kind: 'card' as const, seq: card.seq, card })),
      ...(chat?.state.entries ?? []).map((entry) => ({ kind: 'chat' as const, seq: entry.seq, entry })),
    ]
    return merged.sort((a, b) => a.seq - b.seq)
  }, [cards, chat?.state.entries])

  const send = async () => {
    if (!canSend) return
    const text = draft.trim()
    if (quickMode) {
      onRewrite(text)
      composer.reset()
      return
    }
    // The message leaves with its chips; a refused or failed send puts the text and the chips back.
    const snapshot = composer.state
    composer.reset()
    if (chat && !(await chat.send(text, snapshot.chips)) && !textareaRef.current?.value) composer.reset(snapshot)
  }

  const chatWorking = Boolean(chat && (chat.working || chat.state.sending))
  // A new message (the user's, or the assistant's answer) is a new turn: the context meter reads the server again.
  const lastEntry = chat?.state.entries.at(-1)
  const turnKey = `${chat?.state.entries.length ?? 0}:${lastEntry?.id ?? ''}`
  const contextMeter = contextMeterEnabled && !quickMode && chat ? chat : null

  let placeholder = t('assistantPlaceholder')
  if (quickMode) placeholder = tq('placeholder')
  else if (chat) placeholder = tc('placeholder')
  let sendTitle: string | undefined = t('comingSoon')
  if (composing) sendTitle = t('send')
  else if (quickMode) sendTitle = writeTitle
  else if (chat) sendTitle = undefined

  return (
    <div className="pane">
      <div className="msgs">
        {chat?.state.status === 'loading' ? (
          <div className="think" role="status">
            <span className="spin" aria-hidden />
            <span className="txt">{tc('loading')}</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty">
            <div className="big">
              <StudioIcon name="sparkles" />
            </div>
            <h3>{t('assistantTitle')}</h3>
            <p>{chat ? tc('emptyBody') : t('assistantBody')}</p>
          </div>
        ) : (
          entries.map((item) =>
            item.kind === 'card' ? (
              <SparkQuickAiCardView key={item.card.id} card={item.card} actions={quickAi} canWrite={canWrite} writeTitle={writeTitle} />
            ) : (
              <SparkChatMessage
                key={item.entry.id}
                entry={item.entry}
                assistantLabel={t('assistant')}
                fps={fps}
                onUndoMotion={onUndoMotion}
                motionResult={motionOverrides?.get(item.entry.id) ?? item.entry.motionResult ?? null}
              />
            ),
          )
        )}
        {chat && (chat.working || chat.state.sending) && chat.state.status === 'ready' ? (
          <div className="m-ai">
            <div className="think" role="status">
              <span className="spin" aria-hidden />
              <span className="txt">{tc('working')}</span>
            </div>
          </div>
        ) : null}
        {chat?.notice && chat.state.status === 'ready' && !chat.state.sending ? (
          <p className="spark-muted" role="status" data-job-notice={chat.notice}>
            {tc(`jobNotice.${chat.notice}`)}
            {chat.notice === 'failed' && chat.failureCode ? ` ${localizedRuntimeError(chat.failureCode)}` : null}
          </p>
        ) : null}
        {chat?.state.error ? (
          <p className="spark-muted" role="alert">
            {tc(`errors.${chat.state.error}`)}
            {chat.state.error === 'load_failed' ? (
              <>
                {' '}
                <button type="button" className="btn ghost sm" onClick={chat.retryLoad}>
                  {tc('retry')}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="composer-wrap">
        <SparkComposerMenuHost composer={composer} textareaRef={textareaRef} stopsRef={stopsRef} channelId={channelId ?? null} enabled={composing && !quickMode} />
        {contextMeter ? null : <SparkSpendMeter conversationId={chat?.state.conversationId ?? null} working={chatWorking} />}
        {focus && canWrite && !(chat?.question?.questionOptions && chat.answer) ? (
          <div className="sugg">
            <button type="button" onClick={() => onRewrite(null)}>
              <StudioIcon name="sparkles" />
              {tq('rewrite')}
            </button>
          </div>
        ) : null}
        {chat?.question?.questionOptions && chat.answer ? (
          <div className="sugg" role="group" aria-label={chat.question.content}>
            {chat.question.questionOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                disabled={chat.state.sending}
                onClick={() => void chat.answer?.(chat.question!.id, option)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        <PromptBox
          bar={(
            <>
              <PromptBoxSpacer />
              {contextMeter ? (
                <SparkContextMeter conversationId={contextMeter.state.conversationId} working={chatWorking} turnKey={turnKey} />
              ) : null}
              <PromptBoxSend type="button" label={t('send')} disabled={!canSend} title={sendTitle} onClick={() => void send()} />
            </>
          )}
        >
          <div className="ctx">
            {!quickMode ? <SparkComposerChips chips={composer.chips} disabled={!composing} onRemove={composer.removeChip} /> : null}
            {sceneNumber ? (
              <span className="chip">
                <StudioIcon name="scenes" />
                {t('sceneName', { n: sceneNumber })}
                {onClearScene ? (
                  <button type="button" title={tc('removeScene')} aria-label={tc('removeScene')} onClick={onClearScene}>
                    <StudioIcon name="x" className="sm" />
                  </button>
                ) : null}
              </span>
            ) : null}
            {focus ? (
              <span className="chip focus">
                <StudioIcon name="type" />
                {tq('textChip', { text: shortText(focus.text) })}
                <button type="button" title={tq('removeFromMessage')} aria-label={tq('removeFromMessage')} onClick={onClearFocus}>
                  <StudioIcon name="x" className="sm" />
                </button>
              </span>
            ) : null}
            {layers && layers.length > MAX_LAYER_CHIPS ? (
              <span className="chip focus">
                <StudioIcon name="shapes" />
                {ta('layers', { n: layers.length })}
                <button
                  type="button"
                  title={tq('removeFromMessage')}
                  aria-label={tq('removeFromMessage')}
                  onClick={() => onRemoveLayers?.(layers.map((layer) => layer.layerId))}
                >
                  <StudioIcon name="x" className="sm" />
                </button>
              </span>
            ) : (
              (layers ?? []).map((layer) => (
                <span className="chip focus" key={layer.layerId} data-layer-chip={layer.layerId}>
                  <StudioIcon name={LAYER_CHIP_ICONS[layer.kind]} />
                  {layer.kind === 'text'
                    ? layer.label
                      ? ta('layer.text', { text: layer.label })
                      : ta('layer.textPlain')
                    : ta(`layer.${layer.kind}`)}
                  <button type="button" title={tq('removeFromMessage')} aria-label={tq('removeFromMessage')} onClick={() => onRemoveLayers?.([layer.layerId])}>
                    <StudioIcon name="x" className="sm" />
                  </button>
                </span>
              ))
            )}
            {rangeLabel ? (
              <span className="chip" data-range-chip>
                <StudioIcon name="clock" />
                {rangeLabel}
                {onClearRange ? (
                  <button type="button" title={ta('removeRange')} aria-label={ta('removeRange')} onClick={onClearRange}>
                    <StudioIcon name="x" className="sm" />
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
          <PromptBoxInput
            ref={textareaRef}
            rows={1}
            disabled={!composing}
            value={draft}
            placeholder={placeholder}
            aria-label={t('assistant')}
            onChange={composer.handleChange}
            onSelect={composer.handleSelect}
            onPaste={(event) => {
              composer.handlePaste(event)
            }}
            onKeyDown={(event) => {
              // P03-01: the menu keys (selecting only adds a chip: `/motion` + Enter inserts the chip, the rest is the
              // prompt) and the composer's own undo history come before Enter sends.
              if (composer.handleKeyDown(event, composer.trigger && !quickMode ? stopsRef.current : [])) return
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              void send()
            }}
          />
        </PromptBox>
      </div>
    </div>
  )
}

const LAYER_CHIP_ICONS: Record<SparkLayerChip['kind'], string> = {
  text: 'type',
  shape: 'shapes',
  image: 'image',
  video: 'video',
  motion: 'motion',
  slot: 'plus',
}

/**
 * One side chat message: the user's bubble (`.m-user .bubble`) or the assistant's text (`.m-ai .ai-text`). E1-H: an answer that
 * closed a `/motion` job carries the "Motion ready - Open in Motion / Undo" card under its text.
 */
function SparkChatMessage({
  entry,
  assistantLabel,
  fps,
  onUndoMotion,
  motionResult,
}: {
  entry: SparkChatEntry
  assistantLabel: string
  fps?: number
  onUndoMotion?: (placement: Extract<MotionPlacementView, { status: 'applied' }>) => Promise<MotionUndoOutcome>
  motionResult: MotionResult | null
}) {
  if (entry.role === 'user') {
    return (
      <div className="m-user" data-chat-entry={entry.id}>
        <div className="bubble">{entry.content}</div>
      </div>
    )
  }
  return (
    <div className="m-ai" data-chat-entry={entry.id}>
      <div className="ai-who">
        <span className="orb">
          <StudioIcon name="sparkles" />
        </span>
        {assistantLabel}
      </div>
      <div className="ai-text">{entry.content}</div>
      {motionResult ? <MotionResultCard result={motionResult} fps={fps} onUndo={onUndoMotion} className="w-full" /> : null}
    </div>
  )
}
