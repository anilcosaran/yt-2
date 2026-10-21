'use client'

import * as React from 'react'

import { STUDIO_ICON_SPRITE } from '../studio/studio-icons'
import { Icon } from '../tools/studio-parts'
import { LAB_SYMBOLS, instrumentSans } from '../lab/lab-frame'

/**
 * The agent's side of a conversation, one set of parts for every place an agent works with the user — the Spark
 * project's chat and the main Chat (New Video) — in Spark's look (the studio and lab styles, app theme colours).
 * The parts take data, not a run: Spark feeds them its run, the main Chat the job's server state.
 *
 * They follow AI Elements (elements.ai-sdk.dev): `AgentThinking` is Reasoning (one shimmering line while the agent
 * works, its thoughts as plain paragraphs, folded to "6 sn düşündü" after), `AgentQueue` is Queue (the plan as to-dos in
 * sections: a circle per item, struck through when done), `AgentChain` is Chain of Thought (the steps the agent takes,
 * one under the other on a thin line, with what each one makes), `AgentMedia` shows outputs side by side (four images
 * in a row while they render), `AgentQuestion` is the question the agent asks before it plans and `AgentSuggestions`
 * the Suggestion chips. Copy comes from the caller.
 */

/** Spark's style scope inline, for parts shown outside a Spark page (the main Chat's thread and composer). */
export function AgentScope({ children, className, sprite = false }: { children: React.ReactNode; className?: string; sprite?: boolean }) {
  return (
    <div className={`lb-calm${className ? ` ${className}` : ''}`}>
      <div className={`yt-studio lb-root lb-inline ${instrumentSans.variable}`}>
        {sprite ? <AgentSprite /> : null}
        {children}
      </div>
    </div>
  )
}

/** The icon sprite the parts draw from; once per page outside Spark. */
export function AgentSprite() {
  return <svg aria-hidden style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: STUDIO_ICON_SPRITE + LAB_SYMBOLS }} />
}

/** One turn of the agent: its name, then what it says and shows. */
export function AgentTurn({ children, who = 'Spark', className }: { children: React.ReactNode; who?: React.ReactNode; className?: string }) {
  return (
    <div className={`m-ai${className ? ` ${className}` : ''}`}>
      {who ? <div className="ai-who"><span className="orb"><Icon name="sparkles" /></span>{who}</div> : null}
      {children}
    </div>
  )
}

/** The activity indicator of the agent's lines: eight spokes turning, in the text colour (Apple's spinner). */
export function AgentSpinner() {
  return (
    <svg className="lb-activity" viewBox="0 0 24 24" aria-hidden>
      {Array.from({ length: 8 }, (_, index) => (
        <line key={index} x1="12" y1="2.75" x2="12" y2="6.75" transform={`rotate(${index * 45} 12 12)`} opacity={0.25 + (index / 7) * 0.75} />
      ))}
    </svg>
  )
}

/** The fold mark of a quiet line: a small solid triangle that turns down when the line is open. */
export function AgentCaret() {
  return (
    <svg className="lb-caret" viewBox="0 0 8 8" aria-hidden>
      <path d="M2.5 1.25 6.25 4 2.5 6.75z" />
    </svg>
  )
}

/**
 * Reasoning: one quiet line of text — while the agent works, what it is doing now, shimmering; when it is done, how
 * long it took (`doneLabel`). Its thoughts stay folded under it (the caret) until the user opens them.
 */
export function AgentThinking({ working, label, doneLabel, lines = [] }: {
  working: boolean
  label: React.ReactNode
  doneLabel?: React.ReactNode
  lines?: React.ReactNode[]
}) {
  const [open, setOpen] = React.useState(false)
  const foldable = lines.length > 0
  return (
    <div className={`lb-reason${open && foldable ? ' open' : ''}`}>
      <button type="button" className="lb-reason-head" aria-expanded={foldable ? open : undefined} disabled={!foldable} onClick={() => setOpen(!open)}>
        <span className={working ? 'lb-shimmer' : 'lb-reason-label'}>{working ? label : doneLabel ?? label}</span>
        {foldable ? <AgentCaret /> : null}
      </button>
      {open && foldable ? (
        <div className="lb-reason-body">
          {lines.map((line, index) => <p key={index}>{line}</p>)}
        </div>
      ) : null}
    </div>
  )
}

export type AgentStepState = 'done' | 'current' | 'waiting' | 'pending' | 'undone' | 'skipped' | 'failed'

/** The mark of a step or item: a tick, a turning circle, a clock (waits on the user), a cross, or what is still to come. */
export function AgentStepIcon({ state, pending = <span className="lb-pending" /> }: { state: AgentStepState; pending?: React.ReactNode }) {
  if (state === 'done') return <Icon name="check" />
  if (state === 'current') return <AgentSpinner />
  if (state === 'waiting') return <span className="lb-waiting"><Icon name="clock" /></span>
  if (state === 'undone') return <Icon name="undo" />
  if (state === 'failed') return <span className="lb-failed"><Icon name="x" /></span>
  return pending
}

export type AgentQueueItem = {
  id: string
  text: React.ReactNode
  state: AgentStepState
  description?: React.ReactNode
  /** Muted, at the end of the row (a length, a count). */
  meta?: React.ReactNode
  /** Small previews under the item (QueueItemAttachment). */
  files?: React.ReactNode
  /** Shown on hover (QueueItemActions). */
  actions?: React.ReactNode
  onClick?: () => void
}

export type AgentQueueSection = {
  id: string
  label: React.ReactNode
  /** Leads the label ("5 sahne"); a number or words. */
  count?: React.ReactNode
  /** At the end of the section bar (e.g. the estimate). */
  meta?: React.ReactNode
  items: AgentQueueItem[]
  defaultOpen?: boolean
}

/**
 * Queue: the plan as to-dos, in sections that fold (a heading with the count and the label, the items in a hairline
 * card under it). Each item has a small circle that fills when it is done (the text is then struck through), turns
 * while it is being made and shows a clock while it waits on the user; a description and previews may follow it,
 * actions show on hover. `footer` closes the queue (the plan's state and its buttons).
 */
export function AgentQueue({ sections, footer }: { sections: AgentQueueSection[]; footer?: React.ReactNode }) {
  const [closed, setClosed] = React.useState<Record<string, boolean>>({})
  return (
    <div className="lb-queue lb-in">
      {sections.map((section) => {
        const open = !(closed[section.id] ?? section.defaultOpen === false)
        return (
          <section key={section.id} className={`lb-queue-sec${open ? ' open' : ''}`}>
            <button type="button" className="lb-queue-bar" aria-expanded={open} onClick={() => setClosed((current) => ({ ...current, [section.id]: open }))}>
              <span className="lb-queue-label">{section.count !== undefined ? <b>{section.count}</b> : null}{section.label}</span>
              <AgentCaret />
              {section.meta ? <span className="lb-queue-meta">{section.meta}</span> : null}
            </button>
            {open ? (
              <ul className="lb-queue-list">
                {section.items.map((item) => (
                  <li key={item.id} className={`lb-queue-item ${item.state}${item.onClick ? ' go' : ''}`} onClick={item.onClick}>
                    <span className="lb-queue-ind"><AgentStepIcon state={item.state} pending={<i className="lb-queue-dot" />} /></span>
                    <span className={`lb-queue-text${item.state === 'current' ? ' lb-shimmer' : ''}`}>{item.text}</span>
                    {item.actions ? <span className="lb-queue-acts">{item.actions}</span> : null}
                    {item.meta ? <span className="lb-queue-end">{item.meta}</span> : null}
                    {item.description ? <span className="lb-queue-desc">{item.description}</span> : null}
                    {item.files ? <span className="lb-queue-files">{item.files}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )
      })}
      {footer ? <div className="lb-queue-foot">{footer}</div> : null}
    </div>
  )
}

export type AgentChainStep = {
  id: string
  label: React.ReactNode
  state: AgentStepState
  description?: React.ReactNode
  /** Small tags under the label (ChainOfThoughtSearchResult). */
  badges?: React.ReactNode[]
  /** What the step made (ChainOfThoughtImage), e.g. `AgentMedia`. */
  media?: React.ReactNode
  /** A control at the end of the row, on hover (e.g. "Geri al"). */
  action?: React.ReactNode
  onClick?: () => void
}

/**
 * Chain of Thought, a hairline card folded to one line: while the agent works, the step it is on, shimmering beside a
 * turning indicator, with how far it has got (`meta`, at the end); when it is done, `title`. `preview` (what it is
 * making now, e.g. four frames side by side) shows under the line; the steps themselves — one under the other on a
 * thin line, with a description, tags and what each made — open from the line.
 */
export function AgentChain({ title, working, current, meta, steps, preview, footer }: {
  title: React.ReactNode
  working: boolean
  /** The step in progress, said on the folded line. */
  current?: React.ReactNode
  meta?: React.ReactNode
  steps: AgentChainStep[]
  preview?: React.ReactNode
  footer?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className={`lb-cot lb-in${open ? ' open' : ''}`}>
      <button type="button" className="lb-cot-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {working ? <AgentSpinner /> : <Icon name="check-c" />}
        <span className={`lb-cot-title${working ? ' lb-shimmer' : ''}`}>{working ? current ?? title : title}</span>
        <AgentCaret />
        {meta ? <span className="lb-cot-meta">{meta}</span> : null}
      </button>
      {open ? (
        <ol className="lb-cot-steps">
          {steps.map((step) => (
            <li key={step.id} className={`lb-cot-step ${step.state}${step.onClick ? ' go' : ''}`} onClick={step.onClick}>
              <span className="lb-cot-ico"><AgentStepIcon state={step.state} pending={<i className="lb-cot-dot" />} /></span>
              <div className="lb-cot-main">
                <div className="lb-cot-row">
                  <span className={`lb-cot-label${step.state === 'current' ? ' lb-shimmer' : ''}`}>{step.label}</span>
                  {step.action ? <span className="lb-cot-act">{step.action}</span> : null}
                </div>
                {step.description ? <div className="lb-cot-desc">{step.description}</div> : null}
                {step.badges?.length ? <div className="lb-cot-badges">{step.badges.map((badge, index) => <span key={index}>{badge}</span>)}</div> : null}
                {step.media ? <div className="lb-cot-media">{step.media}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : preview ? (
        <div className="lb-cot-preview">{preview}</div>
      ) : null}
      {footer ? <div className="lb-cot-foot">{footer}</div> : null}
    </div>
  )
}

export type AgentMediaTile = {
  id: string
  /** `null` while it renders (a shimmering frame of the right shape). */
  content: React.ReactNode | null
  /** The one the agent kept, among variants. */
  chosen?: boolean
  label?: string
}

/** What a step makes, side by side in the format's shape: up to four in a row, each one filling in when it is done. */
export function AgentMedia({ tiles, ratio = '9 / 16' }: { tiles: AgentMediaTile[]; ratio?: string }) {
  return (
    <div className="lb-media" style={{ '--lb-media-n': Math.min(4, Math.max(1, tiles.length)), '--lb-media-ar': ratio } as React.CSSProperties}>
      {tiles.map((tile) => (
        <figure key={tile.id} className={`lb-media-tile${tile.content ? '' : ' rendering'}${tile.chosen ? ' chosen' : ''}`} title={tile.label}>
          {tile.content}
          {tile.chosen ? <span className="lb-media-pick"><Icon name="check" size="sm" /></span> : null}
        </figure>
      ))}
    </div>
  )
}

export type AgentQuestionOption = { id: string; label: string; hint?: string; recommended?: boolean }

/**
 * The question the agent asks before it plans, docked on the composer: a chip with the topic, the question, the
 * answers to pick from (the number keys pick while nothing is being typed), "Kendi cevabım" (the user's own words in
 * the composer, `onOwn`) and "Atla" (leave the call to the agent).
 */
export function AgentQuestion({
  chip,
  position,
  text,
  options,
  onAnswer,
  onSkip,
  onOwn,
  disabled = false,
  copy = {},
}: {
  chip?: React.ReactNode
  /** e.g. "1/2" when more than one question is asked. */
  position?: string
  text: string
  options: AgentQuestionOption[]
  onAnswer: (option: AgentQuestionOption) => void
  onSkip?: () => void
  onOwn?: () => void
  disabled?: boolean
  copy?: { skip?: string; skipTitle?: string; own?: string; ownHint?: string; recommended?: string }
}) {
  React.useEffect(() => {
    if (disabled) return
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return
      const option = options[Number(event.key) - 1]
      if (option) onAnswer(option)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options, onAnswer, disabled])

  return (
    <div className="lb-ask lb-in" role="group" aria-label={text}>
      <div className="lb-ask-h">
        {chip ? <span className="lb-ask-chip">{chip}</span> : null}
        {position ? <span className="lb-ask-n">{position}</span> : null}
        <span className="grow" />
        {onSkip ? <button type="button" className="lb-act" disabled={disabled} onClick={onSkip} title={copy.skipTitle}>{copy.skip ?? 'Atla'}</button> : null}
      </div>
      <p className="lb-ask-q">{text}</p>
      <div className="lb-ask-opts">
        {options.map((option, index) => (
          <button key={option.id} type="button" disabled={disabled} onClick={() => onAnswer(option)}>
            <kbd>{index + 1}</kbd>
            <span>
              <b>
                {option.label}
                {option.recommended ? <em className="lb-ask-rec">{copy.recommended ?? 'Önerilen'}</em> : null}
              </b>
              {option.hint ? <small>{option.hint}</small> : null}
            </span>
          </button>
        ))}
        {onOwn ? (
          <button type="button" disabled={disabled} onClick={onOwn}>
            <kbd><Icon name="edit" size="sm" /></kbd>
            <span>
              <b>{copy.own ?? 'Kendi cevabım'}</b>
              <small>{copy.ownHint ?? 'Aşağıya yaz ve gönder'}</small>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** `icon`: a Spark sprite name for the chip (`sparkles` when left out). */
export type AgentSuggestion = { id: string; label: string; icon?: string }

/**
 * Suggestion: short next steps as chips over the composer; one click hands it to the composer or sends it.
 * `singleLine` keeps them on one row: what does not fit is scrolled into view sideways instead of wrapping.
 * `layout="list"`: one per row with an arrow on hover, for a start screen's ideas.
 */
export function AgentSuggestions({ items, onPick, label, singleLine = false, layout = 'chips' }: {
  items: AgentSuggestion[]
  onPick: (item: AgentSuggestion) => void
  label?: string
  singleLine?: boolean
  layout?: 'chips' | 'list'
}) {
  if (items.length === 0) return null
  const list = layout === 'list'
  return (
    <div
      className={list ? 'sugg lb-suggest sugg-list' : singleLine ? 'sugg lb-suggest sugg-line' : 'sugg lb-suggest'}
      role="group"
      aria-label={label}
      // A mouse wheel has no sideways axis: let it move the row while there is more to reach.
      onWheel={singleLine && !list ? (event) => {
        const row = event.currentTarget
        if (event.deltaX === 0 && row.scrollWidth > row.clientWidth) row.scrollLeft += event.deltaY
      } : undefined}
    >
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onPick(item)}>
          <Icon name={item.icon ?? 'sparkles'} size="sm" />
          {list ? <span className="sugg-text">{item.label}</span> : item.label}
          {list ? <span className="sugg-go"><Icon name="arrow-right" size="sm" /></span> : null}
        </button>
      ))}
    </div>
  )
}
