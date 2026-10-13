'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { isTerminalJobState } from '@/lib/assistant/composer/conversation-jobs'
import { useConversationJobs } from '@/lib/assistant/composer/use-conversation-jobs'
import { MotionChatSession, type MotionChatState } from '@/lib/motion-editor/chat-session'
import { takePendingMotionPrompt } from '@/lib/motion-editor/pending-prompt'
import { useRefreshOnAgentJobEnd } from '@/lib/spark/use-agent-job-refresh'

/**
 * P06-02 Chat region of the Motion screen: the draft's Assistant conversation (shared conversation API, linked to the
 * draft on the server). `MotionChatView` is the pure body; `MotionChatPane` owns the session.
 */
export function MotionChatView({
  state,
  text,
  onText,
  onSend,
  working = false,
}: {
  state: MotionChatState
  text: string
  onText: (text: string) => void
  onSend: () => void
  /** E1-H: a job of this chat is running (it may be editing the draft right now). */
  working?: boolean
}) {
  const t = useTranslations('Motion.editor.chat')
  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-72 min-h-24 flex-col gap-2 overflow-y-auto text-sm" aria-live="polite">
        {state.status === 'loading' ? (
          <span className="flex items-center gap-2 text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('loading')}
          </span>
        ) : state.status === 'error' ? (
          <span role="alert" className="text-muted-foreground">{t('loadFailed')}</span>
        ) : state.entries.length === 0 ? (
          <span className="text-muted-foreground">{t('empty')}</span>
        ) : (
          state.entries.map((entry) => (
            <p key={entry.id} data-role={entry.role} className={entry.role === 'user' ? 'self-end rounded-xl bg-accent px-3 py-2' : 'rounded-xl bg-panel/60 px-3 py-2'} aria-busy={entry.pending || undefined}>
              {entry.content}
            </p>
          ))
        )}
        {working && state.status === 'ready' ? (
          <span className="flex items-center gap-2 text-muted-foreground" role="status" data-motion-chat-working="">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('working')}
          </span>
        ) : null}
        {state.error === 'send_failed' ? <span role="alert" className="text-destructive">{t('sendFailed')}</span> : null}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
        }}
      >
        <Textarea value={text} onChange={(event) => onText(event.target.value)} placeholder={t('placeholder')} aria-label={t('placeholder')} disabled={state.status !== 'ready' || state.sending} maxLength={4000} />
        <Button type="submit" size="sm" className="self-end" disabled={state.status !== 'ready' || state.sending || text.trim().length === 0}>
          {t('send')}
        </Button>
      </form>
    </div>
  )
}

export function MotionChatPane({
  draftId,
  title,
  draftVersion,
  onDraftMayHaveChanged,
}: {
  draftId: string
  title: string
  /** The draft version the screen shows now: the `seen_draft_version` of the next message (the edit's CAS starts there). */
  draftVersion: number
  /** E1-H: a job of this chat ended, so the draft may have been edited by the Assistant: the screen re-reads it. */
  onDraftMayHaveChanged?: () => void | Promise<void>
}) {
  const locale = useLocale()
  const [session] = React.useState(() => new MotionChatSession({ draftId, title, locale, getDraftVersion: () => draftVersion }))
  React.useEffect(() => {
    session.setDraftVersion(draftVersion)
  }, [session, draftVersion])
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const [text, setText] = React.useState('')

  React.useEffect(() => {
    void session.load()
    return () => session.dispose()
  }, [session])

  // The shared conversation stream: an answer re-reads the transcript, a job end re-reads the draft the job edited.
  const jobs = useConversationJobs({
    conversationId: state.conversationId,
    enabled: state.status === 'ready',
    focusedJobId: null,
    onBackgroundEvent: session.refresh,
  })
  useRefreshOnAgentJobEnd(jobs, state.status === 'ready', onDraftMayHaveChanged)
  const working = [...jobs.values()].some((job) => !isTerminalJobState(job.state) && job.state !== 'waiting_for_user')

  const send = React.useCallback(async () => {
    if (await session.send(text)) setText('')
  }, [session, text])

  // "Create motion" on the Motion catalog hands its prompt over (module memory, once): it is this draft's first message.
  // A refused send puts the text back into the box so nothing the user wrote is lost.
  React.useEffect(() => {
    if (state.status !== 'ready') return
    const prompt = takePendingMotionPrompt(draftId)
    if (!prompt) return
    void session.send(prompt).then((sent) => {
      if (!sent) setText((current) => (current === '' ? prompt : current))
    })
  }, [draftId, session, state.status])

  return <MotionChatView state={state} text={text} onText={setText} onSend={() => void send()} working={working} />
}
