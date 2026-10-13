'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MotionDraft, MotionEnergy, MotionRatio } from '@/lib/motion-editor/api'
import { motionPatternToText, type MotionEditorNotice, type MotionEditorState } from '@/lib/motion-editor/session'

import { MotionCodePanel } from './motion-code-panel'
import { MotionParametersPanel } from './motion-parameters-panel'
import { MotionPreviewPanel } from './motion-preview-panel'

export type MotionEditorShellActions = {
  saveSource(text: string): void
  setTestValues(values: Record<string, string | number>): void
  setViewpoint(view: { ratio?: MotionRatio; energy?: MotionEnergy }): void
  validate(): void
  archive(): void
  /** P06-12 "Motion olarak kaydet": the server decides whether it can run (`capabilities.actions.publish`). */
  publish(): void
  openCodePanel(): void
  closeCodePanel(): void
}

const LIBRARY_HREF = '/motion'

function Region({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} data-motion-region={id} className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <h2 id={id} className="text-sm font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ValidationSummary({ draft }: { draft: MotionDraft }) {
  const t = useTranslations('Motion.editor.validation')
  const receipt = draft.draft.validation
  if (!receipt) return <p className="text-sm text-muted-foreground">{t('none')}</p>
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <p className={receipt.ok && receipt.current ? 'text-foreground' : 'text-muted-foreground'}>
        {!receipt.current ? t('stale') : receipt.ok ? t('ok') : t('issues', { count: receipt.issues.length })}
      </p>
      {receipt.current && receipt.compile_skipped ? <p className="text-xs text-muted-foreground">{t(`skipped.${receipt.compile_skipped}`)}</p> : null}
      {receipt.current && receipt.issues.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {receipt.issues.slice(0, 8).map((issue, index) => (
            <li key={`${issue.code}:${issue.path}:${index}`}>
              <span className="font-mono">{issue.code}</span> {issue.path}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Why "Motion olarak kaydet" is not available yet, when the user can act on it (validate, fix, edit). */
const PUBLISH_HINTS = ['validation_missing', 'validation_stale', 'validation_failed', 'unchanged'] as const

function PublishHint({ draft }: { draft: MotionDraft }) {
  const t = useTranslations('Motion.editor.publish')
  const publish = draft.capabilities.actions.publish
  if (publish.available || !publish.reason || !(PUBLISH_HINTS as readonly string[]).includes(publish.reason)) return null
  // "Unchanged" only matters once something was saved: a fresh, unsaved draft names what is missing instead.
  if (publish.reason === 'unchanged' && !draft.latest_revision) return null
  return (
    <p data-motion-publish-hint={publish.reason} className="text-xs text-muted-foreground">
      {t(`reason.${publish.reason}`)}
    </p>
  )
}

function NoticeLine({ notice }: { notice: MotionEditorNotice | null }) {
  const t = useTranslations('Motion.editor.notices')
  if (!notice) return null
  return (
    <p role="status" data-motion-notice={notice.kind} className="rounded-md border border-border bg-panel/60 px-3 py-2 text-sm">
      {t(notice.kind, { reason: notice.reason ?? '' })}
    </p>
  )
}

/**
 * P06-02 Motion authoring screen (ready state): the DEFAULT view is preview + Chat + parameters; the code panel is closed
 * and opens on request only. Which surfaces and actions exist comes from the server's capability inspector
 * (`draft.capabilities`), never from a client guess. Spark's boundary is stated by the server too: only the exposed
 * text/colour/media/duration are Spark fields; everything structural happens here, on this private draft.
 */
export function MotionEditorShell({
  state,
  actions,
  chat,
}: {
  state: MotionEditorState
  actions: MotionEditorShellActions
  chat: React.ReactNode
}) {
  const t = useTranslations('Motion.editor')
  const draft = state.draft
  if (!draft) return null
  const capabilities = draft.capabilities
  const busy = state.saving
  const canEdit = capabilities.actions.edit_source && !busy
  const codePanel = capabilities.surfaces.code_panel
  const returnTo = draft.return_to

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-background p-4 md:p-6" data-motion-editor="" data-code-panel={state.codePanelOpen ? 'open' : 'closed'}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={LIBRARY_HREF}>
              <ArrowLeft className="size-4" aria-hidden />
              {t('backToLibrary')}
            </Link>
          </Button>
          <h1 className="min-w-0 truncate text-lg font-semibold">{draft.name}</h1>
          <Badge variant="outline">{t('draftBadge')}</Badge>
          <span className="text-xs text-muted-foreground">{t('sourceOf', { blueprint: draft.source.blueprint_ref })}</span>
          {draft.latest_revision ? (
            <span data-motion-latest-revision={draft.latest_revision.revision_number} className="text-xs text-muted-foreground">
              {t('latestRevision', { number: draft.latest_revision.revision_number })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {returnTo ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/spark/${encodeURIComponent(returnTo.project_id)}`}>{t('returnToProject')}</Link>
            </Button>
          ) : null}
          {codePanel.opt_in ? (
            <Button variant="outline" size="sm" aria-expanded={state.codePanelOpen} onClick={state.codePanelOpen ? actions.closeCodePanel : actions.openCodePanel}>
              {state.codePanelOpen ? t('actions.hideSource') : t('actions.showSource')}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={!capabilities.actions.validate || busy} onClick={actions.validate}>
            {t('actions.validate')}
          </Button>
          <Button variant="outline" size="sm" disabled={!capabilities.actions.publish.available || busy} onClick={actions.publish}>
            {t('actions.publish')}
          </Button>
          <Button variant="ghost" size="sm" disabled={!capabilities.actions.archive || busy} onClick={actions.archive}>
            {t('actions.archive')}
          </Button>
        </div>
      </header>

      <NoticeLine notice={state.notice} />

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {capabilities.surfaces.preview.default_open ? (
            <Region id="motion-region-preview" title={t('regions.preview')}>
              <MotionPreviewPanel draft={draft} preview={state.preview} disabled={!canEdit} onViewpoint={actions.setViewpoint} />
            </Region>
          ) : null}
          {capabilities.surfaces.chat.default_open ? (
            <Region id="motion-region-chat" title={t('regions.chat')}>
              {chat}
            </Region>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          {capabilities.surfaces.parameters.default_open ? (
            <Region id="motion-region-parameters" title={t('regions.parameters')}>
              <MotionParametersPanel
                key={`${draft.draft_id}:${draft.draft.version}`}
                draft={draft}
                disabled={!capabilities.actions.set_test_data || busy}
                onApply={actions.setTestValues}
              />
              <ValidationSummary draft={draft} />
              <PublishHint draft={draft} />
            </Region>
          ) : null}
        </div>
      </div>

      {state.codePanelOpen ? (
        <Region id="motion-region-source" title={t('regions.source')}>
          <MotionCodePanel
            key={`${draft.draft_id}:${draft.draft.version}`}
            sourceText={motionPatternToText(draft.draft.pattern)}
            editable={codePanel.source_editable}
            disabled={busy}
            onSave={actions.saveSource}
          />
        </Region>
      ) : null}
    </div>
  )
}
