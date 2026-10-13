'use client'

// Memory → Skills → the skill popup: a wide, quiet sheet that opens on a blank page — a name, a one-sentence
// description and the method as Markdown. Two quiet buttons bring text in: "AI ile oluştur" opens a prompt box and AI
// writes the skill into the page while you watch, "Katalog" drops in a ready method; both can be taken back. Once
// something is written the popup no longer closes by a click outside: it asks first. Youtorch's and shared skills
// open read-only and can be copied.

import * as React from 'react'
import {
  Clapperboard,
  Copy,
  Download,
  FileText,
  LibraryBig,
  ListOrdered,
  PenLine,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { PromptBox, PromptBoxInput, PromptBoxNote, PromptBoxSend, PromptBoxSpacer } from '@/components/spark/agent/prompt-box'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { MarkdownEditor } from './markdown-editor'
import { Chip } from './memory-list'
import type { SkillItem } from './memory-seed'
import { draftSkillWithAi, useMemoryStore } from './memory-store'
import {
  bodyFromSteps,
  nameFromFile,
  parseSkillMarkdown,
  skillFileName,
  skillToMarkdown,
  stepsFromBody,
  type SkillDocument,
} from './skill-markdown'

const MAX_FILE_BYTES = 200 * 1024
/** AI's draft appears a few letters at a time, so it reads as being written. */
const WRITE_STEP = 4
const WRITE_TICK_MS = 16
/** `named`: the entry is a whole skill; the other is an outline that keeps the name you gave. */
const CATALOG: Array<{ id: 'method' | 'product' | 'titles'; icon: LucideIcon; named: boolean }> = [
  { id: 'method', icon: ListOrdered, named: false },
  { id: 'product', icon: Clapperboard, named: true },
  { id: 'titles', icon: PenLine, named: true },
]

/** Text brought into the page (by AI, the catalog or a file) and what it replaced, so it can be taken back. */
type Applied = {
  from: { kind: 'ai' } | { kind: 'catalog'; name: string } | { kind: 'file'; name: string }
  previous: SkillDocument
}

export function SkillDialog({
  open,
  onOpenChange,
  skillId,
  initialRequest = '',
  onOpenSkill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  skillId: string | null
  /** Opens the AI box with this sentence in it (an example on the Skills tab). */
  initialRequest?: string
  onOpenSkill: (id: string) => void
}) {
  const t = useTranslations('MemoryPage.skillEditor')
  // The popup keeps showing the skill it was opened with while it fades out.
  const [shownId, setShownId] = React.useState(skillId)
  if (open && shownId !== skillId) setShownId(skillId)
  const skill = useMemoryStore((state) => (shownId ? state.skills.find((entry) => entry.id === shownId) ?? null : null))
  const readOnly = Boolean(skill && skill.origin !== 'mine')
  const written = React.useRef(false)
  const [confirming, setConfirming] = React.useState(false)
  const setWritten = React.useCallback((value: boolean) => {
    written.current = value
  }, [])

  const close = () => {
    written.current = false
    setConfirming(false)
    onOpenChange(false)
  }
  // A click outside, Esc and the close button all come here: unsaved writing is asked about first.
  const requestClose = () => {
    if (written.current) setConfirming(true)
    else close()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
        <DialogContent
          aria-describedby={undefined}
          className={cn(
            'flex max-h-[calc(100dvh-3rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-4xl',
            !readOnly && 'h-[44rem]',
          )}
        >
          <SkillSheet
            key={shownId ?? 'new'}
            skill={skill}
            initialRequest={shownId ? '' : initialRequest}
            onWrittenChange={setWritten}
            onClose={close}
            onOpenSkill={onOpenSkill}
          />
        </DialogContent>
      </Dialog>
      <AppAlertDialog
        open={confirming}
        tone="warning"
        confirmVariant="destructive"
        title={t('discard.title')}
        description={t('discard.description')}
        confirmLabel={t('discard.confirm')}
        cancelLabel={t('discard.cancel')}
        closeLabel={t('discard.cancel')}
        onOpenChange={setConfirming}
        onConfirm={close}
      />
    </>
  )
}

function SkillSheet({
  skill,
  initialRequest,
  onWrittenChange,
  onClose,
  onOpenSkill,
}: {
  skill: SkillItem | null
  initialRequest: string
  onWrittenChange: (written: boolean) => void
  onClose: () => void
  onOpenSkill: (id: string) => void
}) {
  const t = useTranslations('MemoryPage.skillEditor')
  const tSkills = useTranslations('MemoryPage.skills')
  const tCommon = useTranslations('MemoryPage.common')
  const saveSkill = useMemoryStore((state) => state.saveSkill)
  const copySkill = useMemoryStore((state) => state.copySkill)

  const [saved] = React.useState<SkillDocument>(() => ({
    name: skill?.name ?? '',
    description: skill?.description ?? '',
    body: skill ? skill.body ?? bodyFromSteps(skill.steps, t('stepsHeading')) : '',
  }))
  const [name, setName] = React.useState(saved.name)
  const [description, setDescription] = React.useState(saved.description)
  const [body, setBody] = React.useState(saved.body)
  const [enabled, setEnabled] = React.useState(skill?.enabled ?? true)
  const [aiOpen, setAiOpen] = React.useState(Boolean(initialRequest))
  const [request, setRequest] = React.useState(initialRequest)
  const [phase, setPhase] = React.useState<'idle' | 'thinking' | 'writing'>('idle')
  const [applied, setApplied] = React.useState<Applied | null>(null)
  /** The AI run that may still write; a stop, an undo or closing the popup moves it on. */
  const run = React.useRef(0)
  const nameRef = React.useRef<HTMLInputElement>(null)
  const descriptionRef = React.useRef<HTMLTextAreaElement>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const readOnly = Boolean(skill && skill.origin !== 'mine')
  const busy = phase !== 'idle'
  const written = name !== saved.name || description !== saved.description || body !== saved.body

  React.useEffect(() => {
    onWrittenChange(written)
  }, [onWrittenChange, written])

  React.useEffect(() => () => {
    run.current = -1
  }, [])

  // While AI writes, the page follows the last line.
  React.useEffect(() => {
    if (phase === 'writing' && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [body, phase])

  const apply = (draft: SkillDocument, from: Applied['from']) => {
    setApplied({ from, previous: { name, description, body } })
    setName(draft.name)
    setDescription(draft.description)
    setBody(draft.body)
  }

  const undo = () => {
    if (!applied) return
    run.current += 1
    setPhase('idle')
    setName(applied.previous.name)
    setDescription(applied.previous.description)
    setBody(applied.previous.body)
    setApplied(null)
  }

  const write = (draft: SkillDocument, token: number) => {
    const total = draft.name.length + draft.description.length + draft.body.length
    const atOnce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let at = 0
    const tick = () => {
      if (run.current !== token) return
      at = atOnce ? total : Math.min(total, at + WRITE_STEP)
      setName(draft.name.slice(0, at))
      setDescription(draft.description.slice(0, Math.max(0, at - draft.name.length)))
      setBody(draft.body.slice(0, Math.max(0, at - draft.name.length - draft.description.length)))
      if (at < total) {
        window.setTimeout(tick, WRITE_TICK_MS)
        return
      }
      setPhase('idle')
      setAiOpen(false)
      setRequest('')
    }
    tick()
  }

  const generate = async () => {
    if (!request.trim() || busy) return
    const token = (run.current += 1)
    setPhase('thinking')
    const draft = await draftSkillWithAi(request)
    if (run.current !== token) return
    setApplied({ from: { kind: 'ai' }, previous: { name, description, body } })
    setPhase('writing')
    write({
      name: draft.name,
      description: draft.description,
      body: `## ${t('whenHeading')}\n\n${draft.description}\n\n${bodyFromSteps(draft.steps, t('stepsHeading'))}`,
    }, token)
  }

  /** Stops AI: nothing changes while it was still thinking, what it wrote so far stays (and can be taken back). */
  const stop = () => {
    run.current += 1
    setPhase('idle')
  }

  const readFile = async (file: File | undefined) => {
    if (!file || busy) return
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      toast.error(t('uploadError.wrongType'))
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(t('uploadError.tooLarge'))
      return
    }
    const text = await file.text().catch(() => null)
    if (!text?.trim()) {
      toast.error(text === null ? t('uploadError.failed') : t('uploadError.empty'))
      return
    }
    const draft = parseSkillMarkdown(text, nameFromFile(file.name))
    apply({ ...draft, name: draft.name || name }, { kind: 'file', name: file.name })
  }

  const save = () => {
    if (readOnly || busy) return
    if (!name.trim()) {
      toast.error(t('nameRequired'))
      nameRef.current?.focus()
      return
    }
    saveSkill({
      id: skill?.id,
      name: name.trim(),
      description: description.trim(),
      body: body.trim(),
      steps: stepsFromBody(body),
      enabled,
      draft: !enabled,
    })
    toast.success(skill ? tSkills('savedToast') : tSkills('addedToast'))
    onClose()
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([skillToMarkdown({ name: name.trim(), description: description.trim(), body })], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = skillFileName(name)
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          save()
        }
      }}
      onDragOver={(event) => {
        if (!readOnly && event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
      onDrop={(event) => {
        if (readOnly || event.dataTransfer.files.length === 0) return
        event.preventDefault()
        void readFile(event.dataTransfer.files[0])
      }}
    >
      {/* The same thin line as a page on its way (NavigationProgress), along the popup's top: AI is thinking. */}
      {phase === 'thinking' && <div aria-hidden="true" className="nav-progress pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5" />}

      <div className="px-5 pt-5 pb-4">
        <DialogTitle className="sr-only">{skill ? skill.name : tSkills('addTitle')}</DialogTitle>
        <input
          ref={nameRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              descriptionRef.current?.focus()
            }
          }}
          autoFocus={!readOnly && !aiOpen}
          readOnly={readOnly || busy}
          placeholder={tSkills('namePlaceholder')}
          aria-label={tSkills('nameLabel')}
          className="w-full bg-transparent pr-10 font-display text-2xl text-foreground outline-none placeholder:text-muted-foreground/45"
        />
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(event) => setDescription(event.target.value.replace(/\n/g, ' '))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              bodyRef.current?.focus()
            }
          }}
          rows={1}
          readOnly={readOnly || busy}
          placeholder={tSkills('descriptionPlaceholder')}
          aria-label={tSkills('descriptionLabel')}
          className="mt-1 block w-full resize-none field-sizing-content bg-transparent text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground/55"
        />
        {readOnly && skill && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {skill.origin === 'builtin'
              ? <><Chip>{tSkills('origin.builtin')}</Chip>{tSkills('builtinHint')}</>
              : <><Chip tone="violet">{tSkills('origin.shared', { name: skill.sharedBy ?? '' })}</Chip>{tSkills('sharedHint', { name: skill.sharedBy ?? '' })}</>}
          </p>
        )}
      </div>

      <MarkdownEditor
        className="flex-1"
        value={body}
        onChange={setBody}
        textareaRef={bodyRef}
        readOnly={readOnly}
        busy={busy}
        label={t('bodyLabel')}
        placeholder={t.raw('bodyPlaceholder') as string}
        actions={(
          <>
            <ToolbarButton label={t('upload')} icon={Upload} disabled={busy} onClick={() => fileRef.current?.click()} />
            <ToolbarButton label={t('download')} icon={Download} disabled={busy} onClick={download} />
          </>
        )}
      />

      {readOnly && skill ? (
        <div className="flex justify-end border-t border-border px-3 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const id = copySkill(skill.id)
              if (id) onOpenSkill(id)
            }}
          >
            <Copy />{tSkills('copy')}
          </Button>
        </div>
      ) : (
        <>
          {applied && !busy && (
            <p className="flex items-center gap-1.5 border-t border-border px-5 py-2 text-xs text-muted-foreground">
              {applied.from.kind === 'ai' ? <Sparkles className="size-3.5 shrink-0 text-primary" /> : applied.from.kind === 'catalog' ? <LibraryBig className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
              <span className="min-w-0 truncate">
                {applied.from.kind === 'ai' ? t('applied.ai') : t(`applied.${applied.from.kind}`, { name: applied.from.name })}
              </span>
              <button type="button" onClick={undo} className="ml-auto shrink-0 font-medium text-foreground hover:underline">{t('undo')}</button>
            </p>
          )}

          {aiOpen && (
            <div className="border-t border-border px-3 pt-3">
              <PromptBox
                as="form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void generate()
                }}
                bar={(
                  <>
                    {busy && <PromptBoxNote>{phase === 'thinking' ? tSkills('generating') : t('ai.writing')}</PromptBoxNote>}
                    <PromptBoxSpacer />
                    {busy
                      ? <PromptBoxSend mode="stop" label={t('ai.stop')} onClick={stop} />
                      : <PromptBoxSend label={tSkills('generate')} disabled={!request.trim()} />}
                  </>
                )}
              >
                <PromptBoxInput
                  autoFocus
                  value={request}
                  disabled={busy}
                  aria-label={tSkills('describeLabel')}
                  placeholder={tSkills('describePlaceholder')}
                  onChange={(event) => setRequest(event.target.value)}
                  onSend={() => void generate()}
                />
              </PromptBox>
            </div>
          )}

          <div className={cn('flex flex-wrap items-center gap-1 px-3 py-3', !aiOpen && 'border-t border-border')}>
            <Button type="button" variant={aiOpen ? 'secondary' : 'ghost'} size="sm" disabled={busy} aria-expanded={aiOpen} onClick={() => setAiOpen((value) => !value)}>
              <Sparkles />{tSkills('generate')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" disabled={busy}><LibraryBig />{t('catalog.title')}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-72">
                {CATALOG.map((entry) => {
                  const title = t(`catalog.${entry.id}.title`)
                  return (
                    <DropdownMenuItem
                      key={entry.id}
                      className="items-start gap-3 py-2"
                      onSelect={() => apply({
                        name: entry.named ? t(`catalog.${entry.id}.name`) : name,
                        description: entry.named ? t(`catalog.${entry.id}.description`) : description,
                        body: t.raw(`catalog.${entry.id}.body`) as string,
                      }, { kind: 'catalog', name: title })}
                    >
                      <entry.icon className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{title}</span>
                        <span className="block text-xs text-muted-foreground">{t(`catalog.${entry.id}.hint`)}</span>
                      </span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <label className="ml-auto flex items-center gap-2 px-2 text-sm text-muted-foreground" title={tSkills('enableNowHint')}>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              {tSkills('enableNow')}
            </label>
            <Button type="button" onClick={save} disabled={!name.trim() || busy} className="px-5">
              {applied?.from.kind === 'ai' ? t('approve') : skill ? tCommon('save') : tCommon('add')}
            </Button>
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={(event) => {
          void readFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </div>
  )
}

function ToolbarButton({ label, icon: Icon, disabled, onClick }: { label: string; icon: LucideIcon; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="size-4" />
    </button>
  )
}
