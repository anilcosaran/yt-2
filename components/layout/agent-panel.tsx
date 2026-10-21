'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronUp, Clock, Maximize2, Minus, Sparkles, SquarePen, X } from 'lucide-react'

import { ChatMarkdown } from '@/components/chat/chat-markdown'
import { AgentScope, AgentSprite, AgentSuggestions, AgentThinking } from '@/components/spark/agent/agent-thread'
import { PromptBox, PromptBoxChip, PromptBoxInput, PromptBoxSend, PromptBoxSpacer } from '@/components/spark/agent/prompt-box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLocalizedError } from '@/hooks/use-localized-error'
import {
  ASSISTANT_COMPOSER_CATALOG_QUERY_KEY,
  ASSISTANT_CONVERSATIONS_UPDATED_EVENT,
  addAssistantMessage,
  createAssistantConversation,
  getAssistantComposerCatalog,
  getAssistantConversation,
  getAssistantRunStatus,
  listAssistantRunEvents,
  shouldApplyAssistantRunEvent,
  stopAssistantRun,
  type AssistantComposerCatalog,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantRunState,
} from '@/lib/assistant/api'
import {
  buildAssistantConversationIdempotencyKey,
  createAssistantMessageIdempotencyKey,
  createNewChatIntentId,
} from '@/lib/assistant/client-intents'
import { prepareChatComposerMessage } from '@/lib/assistant/composer/chat-submit'
import { buildSlashMenuItems } from '@/lib/assistant/composer/composer-menu'
import { COMPOSER_DEFAULT_MODE } from '@/lib/assistant/composer/composer-mode'
import type { ComposerCommandChip } from '@/lib/assistant/composer/composer-state'
import { isProductionG1Reply } from '@/lib/assistant/production-launch-api'
import { listSkillInstallations, skillInstallationsQueryKey } from '@/lib/assistant/skills-api'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { cn } from '@/lib/utils'

import './agent-panel.css'

/**
 * The agent panel: the shell's "AI'a sor" opens Spark in a hairline panel floating over the page panel's right side
 * (Linear's agent panel, in the app's look): one soft surface — the conversation's title and the window controls, the
 * thread, the composer — as tall as what it holds. It talks through the main Chat's path — a conversation of the
 * active channel, `assistant_message_context_v1` messages, the run followed until it ends — so the same conversation
 * opens on /chat ("Sohbette aç"). The parts are the shared agent set (`AgentScope`, `AgentThinking`, `PromptBox`);
 * cards the Chat draws (questions, plans, payments) wait there.
 */

export type AgentPanelState = 'closed' | 'open' | 'minimized'

const TERMINAL_RUN_STATES = new Set<AssistantRunState>(['completed', 'failed', 'cancelled'])
const WAITING_RUN_STATES = new Set<AssistantRunState>(['waiting_for_user', 'waiting_for_approval', 'waiting_for_payment'])
const RUN_POLL_MS = 1_200
const RUN_WAITING_POLL_MS = 5_000
const SURFACE = 'dashboard_chat'
/** The Chat's narration of `assistant.status.updated` stages (statusStageNarration in app/chat/page.tsx). */
const STAGE_TITLE_KEYS: Record<string, string> = {
  memory_context: 'stages.memoryContextTitle',
  planning: 'stages.planningTitle',
  planning_replay: 'stages.planningReplayTitle',
  autonomy_defaulting: 'stages.defaultsTitle',
  tool_execution: 'stages.toolExecutionTitle',
  approval_required: 'stages.approvalTitle',
  finalizing: 'stages.finalizingTitle',
}
/** The welcome's suggestions and their Spark sprite icons. */
const SUGGESTIONS = [
  { id: 'ideas', icon: 'wand' },
  { id: 'summary', icon: 'history' },
  { id: 'script', icon: 'file' },
] as const

export function AgentPanel({ state, onStateChange }: { state: AgentPanelState; onStateChange: (next: AgentPanelState) => void }) {
  const t = useTranslations('Chat.agentPanel')
  const router = useRouter()
  const thread = useAgentPanelThread()
  const [draft, setDraft] = React.useState('')
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const panelRef = React.useRef<HTMLElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const minimized = state === 'minimized'
  const open = state === 'open'
  const empty = thread.messages.length === 0 && !thread.pending && !thread.error

  const close = React.useCallback(() => {
    onStateChange('closed')
    // Back to the control that opened it, when focus was in the panel (it is drawn again once the panel is closed).
    if (panelRef.current?.contains(document.activeElement)) {
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-ask-ai-trigger]')?.focus())
    }
  }, [onStateChange])

  // Esc closes the panel (a menu open over it closes first).
  React.useEffect(() => {
    if (state === 'closed') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[data-radix-popper-content-wrapper] [data-state="open"], [role="dialog"][data-state="open"]')) return
      close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, state])

  // Opened (or restored): the field takes the focus.
  React.useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true })
  }, [open])

  // The newest turn stays in view.
  const turnCount = thread.messages.length + (thread.pending ? 1 : 0)
  React.useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport || !open) return
    const frame = window.requestAnimationFrame(() => viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' }))
    return () => window.cancelAnimationFrame(frame)
  }, [open, turnCount, thread.working, thread.stage])

  function submit() {
    const text = draft
    if (!thread.canSend(text)) return
    setDraft('')
    void thread.send(text).then((sent) => {
      if (!sent) setDraft((current) => current || text)
    })
  }

  // The panel stays up until the Chat is on screen (it has no top bar, so the layout closes the panel there).
  function expand() {
    const conversationId = thread.conversation?.id
    router.push(conversationId ? `/chat?id=${encodeURIComponent(conversationId)}` : '/chat')
  }

  return (
    <aside
      ref={panelRef}
      id="agent-panel"
      aria-label={t('region')}
      hidden={state === 'closed'}
      data-empty={empty && !minimized ? '' : undefined}
      className={cn(
        // One surface, as tall as its content (from a compact start up to the page panel's height).
        'agent-panel absolute bottom-2 right-2 z-40 flex flex-col overflow-hidden rounded-[18px] text-popover-foreground',
        minimized ? 'w-[min(300px,calc(100%-16px))]' : 'max-h-[calc(100%-64px)] min-h-[min(440px,calc(100%-64px))] w-[min(420px,calc(100%-16px))]',
        state === 'closed' && 'hidden',
      )}
    >
      <AgentSprite />
      <header className="flex h-12 shrink-0 items-center gap-2 pl-4 pr-2">
        <PanelTitle
          name={thread.conversation?.title?.trim() || t('newChat')}
          model={thread.modelLabel}
          modelTitle={t('modelTitle')}
          onRestore={minimized ? () => onStateChange('open') : undefined}
          restoreLabel={t('restore')}
        />
        <div className="ml-auto flex shrink-0 items-center">
          {thread.conversation && !minimized ? (
            <PanelIconButton label={t('newChat')} onClick={() => { thread.reset(); setDraft(''); inputRef.current?.focus() }}>
              <SquarePen />
            </PanelIconButton>
          ) : null}
          <PanelIconButton label={minimized ? t('restore') : t('minimize')} onClick={() => onStateChange(minimized ? 'open' : 'minimized')}>
            {minimized ? <ChevronUp /> : <Minus />}
          </PanelIconButton>
          <PanelIconButton label={t('expand')} onClick={expand}>
            <Maximize2 />
          </PanelIconButton>
          <PanelIconButton label={t('close')} onClick={close}>
            <X />
          </PanelIconButton>
        </div>
      </header>

      {!minimized ? (
        <>
          <div ref={scrollRef} className="hover-scrollbar flex min-h-0 flex-auto flex-col overflow-y-auto px-4 pb-3 pt-1" aria-live="polite">
            {empty ? (
              <PanelWelcome
                onPick={(text) => {
                  setDraft(text)
                  inputRef.current?.focus()
                }}
              />
            ) : (
              <PanelTranscript thread={thread} onExpand={expand} />
            )}
          </div>
          <div className="shrink-0 px-2.5 pb-2.5">
            <PromptBox
              as="form"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
              bar={(
                <>
                  <PanelSkillsMenu skill={thread.skill} onSkillChange={thread.setSkill} />
                  <PromptBoxSpacer />
                  {thread.running ? (
                    <PromptBoxSend mode="stop" label={t('stop')} onClick={() => void thread.stop()} />
                  ) : (
                    <PromptBoxSend label={t('send')} busy={thread.sending} disabled={!thread.canSend(draft)} />
                  )}
                </>
              )}
            >
              <PromptBoxInput
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onSend={submit}
                placeholder={thread.messages.length > 0 ? t('replyPlaceholder') : t('placeholder')}
                aria-label={t('placeholder')}
              />
            </PromptBox>
          </div>
        </>
      ) : null}
    </aside>
  )
}

function PanelTitle({ name, model, modelTitle, onRestore, restoreLabel }: {
  name: string
  model: string | null
  modelTitle: string
  onRestore?: () => void
  restoreLabel: string
}) {
  const content = (
    <>
      <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">{name}</span>
      {model ? (
        <span title={modelTitle} className="agent-panel-fill inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium text-muted-foreground">
          {model}
        </span>
      ) : null}
    </>
  )
  if (!onRestore) return <div className="flex min-w-0 items-center gap-2">{content}</div>
  return (
    <button type="button" onClick={onRestore} aria-label={restoreLabel} className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left outline-none focus-visible:underline">
      {content}
    </button>
  )
}

function PanelIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-[15px]"
    >
      {children}
    </button>
  )
}

/**
 * An empty panel, close over the composer: Spark's mark (the "AI'a sor" orange), a line of welcome and the
 * suggestions as rows, all left-aligned; a faint glow of the same orange lights the space above.
 */
function PanelWelcome({ onPick }: { onPick: (text: string) => void }) {
  const t = useTranslations('Chat.agentPanel')
  const suggestions = SUGGESTIONS.map(({ id, icon }) => ({ id, icon, label: t(`suggestions.${id}`) }))
  return (
    <div className="mt-auto flex flex-col pb-1 pt-8">
      <span className="agent-panel-mark grid size-9 place-items-center rounded-[11px]">
        <Sparkles className="size-[17px]" aria-hidden />
      </span>
      <p className="mt-4 text-[17px] font-semibold tracking-[-0.015em] text-foreground">{t('emptyTitle')}</p>
      <p className="mt-1 max-w-[330px] text-[13px] leading-5 text-muted-foreground">{t('emptyHint')}</p>
      <AgentScope className="mt-4">
        <AgentSuggestions layout="list" items={suggestions} label={t('suggestionsLabel')} onPick={(item) => onPick(item.label)} />
      </AgentScope>
    </div>
  )
}

/**
 * The thread: the user's lines on the right (a skill that rode along under them, "… bağlama eklendi"), Spark's
 * answers as plain text, each led by how long it worked ("12 sn düşündü", the stages it went through folded under
 * it); while it works, one shimmering line says what it is doing.
 */
function PanelTranscript({ thread, onExpand }: { thread: AgentPanelThread; onExpand: () => void }) {
  const t = useTranslations('Chat.agentPanel')
  const tChat = useTranslations('Chat')
  const visible = thread.messages.filter(isVisibleMessage)
  const stageTitle = (stage: string) => tChat(STAGE_TITLE_KEYS[stage] ?? 'stages.fallbackTitle')
  const workingLabel = thread.stage ? stageTitle(thread.stage) : t('thinking')
  const waiting = Boolean(thread.runState && WAITING_RUN_STATES.has(thread.runState))
  const notice = thread.runState === 'failed' ? t('failed') : thread.runState === 'cancelled' ? t('stopped') : null

  return (
    <div className="mt-auto flex flex-col gap-5 pt-3">
      {visible.map((message, index) => {
        if (message.role === 'user') {
          return <PanelUserLine key={message.id} content={message.content} context={thread.notes[message.id]?.skill} />
        }
        // The first answer after the user's line says how long Spark worked on it.
        const asked = visible[index - 1]
        const seconds = asked?.role === 'user' ? (Date.parse(message.created_at) - Date.parse(asked.created_at)) / 1000 : 0
        const stages = asked ? thread.notes[asked.id]?.stages ?? [] : []
        return (
          <div key={message.id} className="flex flex-col gap-2">
            {seconds >= 1 ? (
              <AgentScope>
                <AgentThinking
                  working={false}
                  label={tChat('aiElements.reasoning.thought')}
                  doneLabel={tChat('aiElements.reasoning.thoughtFor', { duration: workedFor(tChat, seconds) })}
                  lines={stages.map(stageTitle)}
                />
              </AgentScope>
            ) : null}
            <ChatMarkdown content={message.content} />
          </div>
        )
      })}
      {thread.pending ? <PanelUserLine content={thread.pending.content} context={thread.pending.skill} pending /> : null}
      {thread.working ? (
        <AgentScope>
          <AgentThinking working label={workingLabel} />
        </AgentScope>
      ) : null}
      {waiting && !thread.working ? (
        <div className="agent-panel-fill flex items-center gap-2.5 rounded-[12px] py-1.5 pl-3 pr-1.5 text-[13px] text-muted-foreground">
          <Clock className="size-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t('waitingShort')}</span>
          <button
            type="button"
            onClick={onExpand}
            className="h-7 shrink-0 rounded-md px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('expand')}
          </button>
        </div>
      ) : null}
      {notice && !thread.working ? <p className="text-[12.5px] leading-5 text-muted-foreground">{notice}</p> : null}
      {thread.error ? <p role="alert" className="text-[12.5px] leading-5 text-destructive">{t('sendFailed', { reason: thread.error })}</p> : null}
    </div>
  )
}

function PanelUserLine({ content, context, pending = false }: { content: string; context?: string; pending?: boolean }) {
  const t = useTranslations('Chat.agentPanel')
  return (
    <div className="flex flex-col items-end gap-1.5">
      <p className={cn(
        'agent-panel-fill max-w-[88%] whitespace-pre-wrap break-words rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-[1.45] text-foreground',
        pending && 'opacity-70',
      )}>
        {content}
      </p>
      {context ? (
        <p className="flex max-w-[88%] items-center gap-1.5 pr-1 text-[12px] text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-medium text-foreground/80">{context}</span>
          <span className="shrink-0">{t('contextAdded')}</span>
        </p>
      ) : null}
    </div>
  )
}

/** "12 sn", "2 dk 5 sn": how long Spark worked, in the Chat's reasoning words (thinkingDuration in production-flow). */
function workedFor(tChat: (key: string, values?: Record<string, number>) => string, seconds: number) {
  const whole = Math.max(1, Math.round(seconds))
  if (whole < 60) return tChat('aiElements.reasoning.seconds', { count: whole })
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return rest === 0 ? tChat('aiElements.reasoning.minutes', { count: minutes }) : tChat('aiElements.reasoning.minutesSeconds', { minutes, seconds: rest })
}

/** "Yetenekler": the user's installed skills (the Chat's slash menu source); one rides with the next message. */
function PanelSkillsMenu({ skill, onSkillChange }: { skill: ComposerCommandChip | null; onSkillChange: (skill: ComposerCommandChip | null) => void }) {
  const t = useTranslations('Chat.agentPanel')
  const { activeChannelId } = useActiveChannel()
  const [requested, setRequested] = React.useState(false)
  const skills = useQuery({
    queryKey: skillInstallationsQueryKey(activeChannelId),
    queryFn: ({ signal }) => listSkillInstallations({ channelId: activeChannelId }, { signal }),
    enabled: requested,
    staleTime: 60_000,
  })
  const items = React.useMemo(
    () => buildSlashMenuItems({ surface: SURFACE, tools: [], skills: skills.data ?? [] }).filter((item) => item.group === 'skills'),
    [skills.data],
  )

  return (
    <DropdownMenu onOpenChange={(next) => { if (next) setRequested(true) }}>
      <DropdownMenuTrigger asChild>
        <PromptBoxChip icon={<Sparkles aria-hidden />} label={skill?.label ?? t('skills')} caret active={Boolean(skill)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-64 rounded-xl p-1.5">
        {skills.isPending ? (
          <DropdownMenuItem disabled className="rounded-md px-2 py-1.5 text-[13px]">{t('skillsLoading')}</DropdownMenuItem>
        ) : skills.isError ? (
          <DropdownMenuItem disabled className="rounded-md px-2 py-1.5 text-[13px]">{t('skillsError')}</DropdownMenuItem>
        ) : items.length === 0 ? (
          <DropdownMenuItem disabled className="rounded-md px-2 py-1.5 text-[13px]">{t('skillsEmpty')}</DropdownMenuItem>
        ) : items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onSelect={() => onSkillChange(item.chip)}
            className={cn('flex-col items-start gap-0.5 rounded-md px-2 py-1.5', skill?.key === item.chip.key && 'bg-accent')}
          >
            <span className="text-[13px] font-medium">{item.label}</span>
            {item.description ? <span className="line-clamp-1 text-[12px] text-muted-foreground">{item.description}</span> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-1.5" />
        {skill ? (
          <DropdownMenuItem onSelect={() => onSkillChange(null)} className="rounded-md px-2 py-1.5 text-[13px]">{t('skillRemove')}</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild className="rounded-md px-2 py-1.5 text-[13px]">
          <Link href="/memory">{t('skillsManage')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type AgentPanelThread = ReturnType<typeof useAgentPanelThread>

/**
 * The panel's conversation, on the main Chat's path: the conversation is created for the active channel with the
 * new-chat intent key, each message goes out as the Chat composer's `assistant_message_context_v1` payload with the
 * catalog's default selection, and the run is followed (status and events) until it ends, the transcript re-read
 * when a message lands.
 */
function useAgentPanelThread() {
  const tChat = useTranslations('Chat')
  const locale = useLocale()
  const localizeError = useLocalizedError()
  const { activeChannel, activeChannelId } = useActiveChannel()
  const channelName = activeChannel?.name ?? null
  const catalogQuery = useQuery({
    queryKey: ASSISTANT_COMPOSER_CATALOG_QUERY_KEY,
    queryFn: getAssistantComposerCatalog,
    enabled: Boolean(activeChannelId),
    staleTime: 60_000,
  })
  const catalog = catalogQuery.data ?? null
  const modelId = catalog ? defaultChatModelId(catalog) : null
  const modelLabel = catalog?.chat_models.find((model) => model.id === modelId)?.label ?? null

  const [conversation, setConversation] = React.useState<AssistantConversation | null>(null)
  const [messages, setMessages] = React.useState<AssistantMessage[]>([])
  const [pending, setPending] = React.useState<{ content: string; skill?: string } | null>(null)
  /** Per message the user sent from here: the skill that rode with it and the stages its run went through. */
  const [notes, setNotes] = React.useState<Record<string, MessageNote>>({})
  const [runId, setRunId] = React.useState<string | null>(null)
  const [runState, setRunState] = React.useState<AssistantRunState | null>(null)
  const [stage, setStage] = React.useState<string | null>(null)
  const [skill, setSkill] = React.useState<ComposerCommandChip | null>(null)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const generationRef = React.useRef(0)
  const intentIdRef = React.useRef<string | null>(null)
  const sequenceRef = React.useRef(0)
  const sendingRef = React.useRef(false)
  /** The user's message the followed run answers. */
  const askedIdRef = React.useRef<string | null>(null)

  const refresh = React.useCallback(async (conversationId: string, signal?: AbortSignal) => {
    const detail = await getAssistantConversation(conversationId, { signal })
    if (signal?.aborted) return
    setConversation(detail.conversation)
    setMessages((current) => mergeMessages(current, detail.messages))
  }, [])

  // The run is followed until it ends: its status and new events, the transcript re-read when a message lands.
  const conversationId = conversation?.id ?? null
  React.useEffect(() => {
    if (!conversationId || !runId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null
    const poll = async () => {
      try {
        const [status, events] = await Promise.all([
          getAssistantRunStatus(runId, { signal: controller.signal }),
          listAssistantRunEvents({ runId, afterSequence: sequenceRef.current, limit: 200 }, { signal: controller.signal }),
        ])
        if (controller.signal.aborted) return
        const fresh = events.filter((event) => event.run_id === runId && shouldApplyAssistantRunEvent(sequenceRef.current, event))
        for (const event of fresh) sequenceRef.current = Math.max(sequenceRef.current, event.sequence)
        const stages = fresh.map((event) => event.event_type === 'assistant.status.updated' ? event.payload.stage : null)
          .filter((value): value is string => typeof value === 'string')
        const nextStage = stages.at(-1)
        if (nextStage) setStage(nextStage)
        const askedId = askedIdRef.current
        if (askedId && stages.length > 0) {
          setNotes((current) => {
            const note = current[askedId] ?? { stages: [] }
            const trail = [...note.stages]
            for (const value of stages) if (trail.at(-1) !== value) trail.push(value)
            return { ...current, [askedId]: { ...note, stages: trail } }
          })
        }
        const terminal = TERMINAL_RUN_STATES.has(status.state)
        if (terminal || fresh.some((event) => event.event_type === 'message.created')) await refresh(conversationId, controller.signal)
        if (controller.signal.aborted) return
        setRunState(status.state)
        if (!terminal) timer = setTimeout(poll, WAITING_RUN_STATES.has(status.state) ? RUN_WAITING_POLL_MS : RUN_POLL_MS)
      } catch {
        if (!controller.signal.aborted) timer = setTimeout(poll, RUN_WAITING_POLL_MS)
      }
    }
    timer = setTimeout(poll, RUN_POLL_MS / 2)
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [conversationId, refresh, runId])

  const running = Boolean(runId && runState && !TERMINAL_RUN_STATES.has(runState) && !WAITING_RUN_STATES.has(runState))
  const working = Boolean(pending) || running

  const canSend = React.useCallback(
    (text: string) => Boolean((text.trim() || skill) && activeChannelId && catalog && !sending && !working),
    [activeChannelId, catalog, sending, skill, working],
  )

  /** Sends one message; false when it did not go out (the caller gives the text back to the field). */
  const send = React.useCallback(async (text: string) => {
    const content = text.trim()
    if (!activeChannelId || !catalog || !modelId || sendingRef.current) return false
    if (!content && !skill) return false
    const generation = generationRef.current
    const sentSkill = skill
    sendingRef.current = true
    setSending(true)
    setError(null)
    setPending({ content: content || sentSkill?.label || '', skill: content ? sentSkill?.label : undefined })
    setSkill(null)
    try {
      const prepared = await prepareChatComposerMessage({
        surface: SURFACE,
        channelId: activeChannelId,
        locale,
        state: { text: content, chips: sentSkill ? [sentSkill] : [] },
        attachments: [],
        selection: { ...catalog.defaults, model_id: modelId },
        mode: COMPOSER_DEFAULT_MODE,
        fallbackContent: tChat('prompts.attachedMedia'),
        t: tChat,
      })
      if (!prepared.ok) throw new PanelSendError(prepared.message)
      let target = conversation
      if (!target) {
        intentIdRef.current ??= createNewChatIntentId()
        target = await createAssistantConversation({
          title: conversationTitle(content || sentSkill?.label || '', channelName),
          metadata: { channel_id: activeChannelId, channel_name: channelName },
          idempotencyKey: buildAssistantConversationIdempotencyKey(intentIdRef.current, activeChannelId),
        })
        if (generation !== generationRef.current) return true
        setConversation(target)
      }
      const append = await addAssistantMessage({
        conversationId: target.id,
        content: prepared.content,
        contentJson: prepared.contentJson,
        modelId,
        composerSelection: prepared.bodySelection,
        idempotencyKey: createAssistantMessageIdempotencyKey(),
      })
      if (generation !== generationRef.current) return true
      window.dispatchEvent(new CustomEvent(ASSISTANT_CONVERSATIONS_UPDATED_EVENT))
      // A written answer to a presented plan (no new job): the Chat's plan card shows the outcome.
      if (isProductionG1Reply(append)) {
        await refresh(target.id)
        return true
      }
      sequenceRef.current = append.event.sequence
      askedIdRef.current = append.message.id
      setNotes((current) => ({ ...current, [append.message.id]: { skill: content ? sentSkill?.label : undefined, stages: [] } }))
      setMessages((current) => mergeMessages(current, [append.message]))
      setStage(null)
      setRunState(append.run.state)
      setRunId(append.run.id)
      return true
    } catch (sendError) {
      if (generation !== generationRef.current) return true
      setSkill(sentSkill)
      setError(sendError instanceof PanelSendError ? sendError.message : localizeError(sendError))
      return false
    } finally {
      sendingRef.current = false
      setSending(false)
      if (generation === generationRef.current) setPending(null)
    }
  }, [activeChannelId, catalog, channelName, conversation, locale, localizeError, modelId, refresh, skill, tChat])

  const stop = React.useCallback(async () => {
    if (!runId) return
    try {
      const result = await stopAssistantRun({ runId })
      setRunState(result.state)
    } catch (stopError) {
      setError(localizeError(stopError))
    }
  }, [localizeError, runId])

  /** "Yeni sohbet": the next message starts another conversation. */
  const reset = React.useCallback(() => {
    generationRef.current += 1
    intentIdRef.current = null
    sequenceRef.current = 0
    askedIdRef.current = null
    setConversation(null)
    setMessages([])
    setNotes({})
    setPending(null)
    setRunId(null)
    setRunState(null)
    setStage(null)
    setSkill(null)
    setError(null)
  }, [])

  return { conversation, messages, notes, pending, runState, stage, skill, setSkill, sending, error, running, working, modelLabel, canSend, send, stop, reset }
}

type MessageNote = { skill?: string; stages: string[] }

class PanelSendError extends Error {}

/** The catalog's default chat model when it lists it, else its first (the Chat composer's choice). */
function defaultChatModelId(catalog: AssistantComposerCatalog) {
  const listed = catalog.chat_models.some((model) => model.id === catalog.defaults.model_id)
  return listed ? catalog.defaults.model_id : catalog.chat_models[0]?.id ?? catalog.defaults.model_id
}

/** What the transcript shows: the two sides' text; the Chat's approval cards stay there. */
function isVisibleMessage(message: AssistantMessage) {
  if (message.role !== 'user' && message.role !== 'assistant') return false
  if (message.content_json.type === 'assistant.approval_required_message') return false
  return message.content.trim().length > 0
}

function mergeMessages(current: AssistantMessage[], incoming: AssistantMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at))
}

/** The Chat's conversation title: the first words of the message (createConversationTitle in app/chat/page.tsx). */
function conversationTitle(message: string, channelName?: string | null) {
  const cleaned = message.replace(/\s+/g, ' ').replace(/[`*_#>[\]{}()]/g, '').trim()
  if (!cleaned) return channelName ? `${channelName} chat` : 'New chat'
  const title = cleaned.split(' ').filter(Boolean).slice(0, 8).join(' ')
  return title.length > 64 ? `${title.slice(0, 61).trim()}...` : title
}
