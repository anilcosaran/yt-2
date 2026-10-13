'use client'

import * as React from 'react'
import { AlertTriangle, Loader2, ScrollText } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isAuthClientError } from '@/lib/auth/errors'
import {
  templateArgumentsComplete,
  templateArgumentValues,
  templateNeedsArguments,
  type ComposerTemplateInsertAction,
} from '@/lib/assistant/composer/composer-menu-templates'
import type { TypedComposerTriggerRange } from '@/lib/assistant/composer/use-typed-composer'
import { renderMcpTemplate } from '@/lib/connectors/mcp-catalog-api'

/**
 * QA-172 — the host side of an MCP template chosen in the `/` menu: a template without required arguments is rendered
 * on the server (P01C-26 `prompts/render`, text only) and replaces the `/query` token as one undo step; one with
 * required arguments first asks for them in a small dialog (existing Dialog + Input). Nothing is ever sent: the text
 * stays in the composer for the user to edit and send.
 */

type InsertText = (range: TypedComposerTriggerRange, text: string) => void

type PendingTemplate = { action: ComposerTemplateInsertAction; range: TypedComposerTriggerRange; insert: InsertText }

export type McpTemplateRenderErrorKind = 'template_unavailable' | 'argument_invalid' | 'feature_unavailable' | 'unavailable' | 'failed'

/** Stable server codes only (P01C-26 `CONNECTOR_MCP_CATALOG_REQUEST_INVALID` details, status classes). */
export function describeMcpTemplateRenderError(error: unknown): McpTemplateRenderErrorKind {
  if (!isAuthClientError(error)) return 'failed'
  const details = error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : null
  const detail = typeof details?.['detail'] === 'string' ? details['detail'] : null
  if (error.code === 'CONNECTOR_MCP_CATALOG_REQUEST_INVALID') return detail === 'template_unknown' ? 'template_unavailable' : 'argument_invalid'
  if (error.code === 'CONNECTOR_FEATURE_UNAVAILABLE' || error.status === 403) return 'feature_unavailable'
  if (error.status === 404) return 'template_unavailable'
  if (error.status === 503) return 'unavailable'
  return 'failed'
}

export function useMcpTemplateInsert(options: { onNotice?: (message: string | null) => void } = {}) {
  const t = useTranslations('Chat')
  const { onNotice } = options
  const [pending, setPending] = React.useState<PendingTemplate | null>(null)

  const onInsertAction = React.useCallback((action: ComposerTemplateInsertAction, range: TypedComposerTriggerRange, insert: InsertText) => {
    if (templateNeedsArguments(action)) {
      setPending({ action, range, insert })
      return
    }
    onNotice?.(null)
    void renderMcpTemplate({ connectionId: action.connectionId, name: action.name })
      .then((rendered) => insert(range, rendered.insert_text))
      .catch((error: unknown) => onNotice?.(t(`mcpTemplates.errors.${describeMcpTemplateRenderError(error)}`, { name: action.label })))
  }, [onNotice, t])

  const dialog = (
    <McpTemplateArgumentsDialog
      pending={pending}
      onClose={() => setPending(null)}
      onInserted={() => setPending(null)}
    />
  )
  return { onInsertAction, dialog }
}

export function McpTemplateArgumentsDialog({
  pending,
  onClose,
  onInserted,
}: {
  pending: PendingTemplate | null
  onClose: () => void
  onInserted: () => void
}) {
  const t = useTranslations('Chat')
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[480px]">
        {pending ? (
          <McpTemplateArgumentsForm
            key={`${pending.action.connectionId}:${pending.action.name}:${pending.range.start}`}
            pending={pending}
            onCancel={onClose}
            onInserted={onInserted}
          />
        ) : (
          <DialogHeader>
            <DialogTitle>{t('mcpTemplates.argumentsTitleFallback')}</DialogTitle>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The small form: one input per argument (required ones marked), "Ekle" renders and inserts; nothing is sent. */
export function McpTemplateArgumentsForm({
  pending,
  onCancel,
  onInserted,
}: {
  pending: PendingTemplate
  onCancel: () => void
  onInserted: () => void
}) {
  const t = useTranslations('Chat')
  const { action } = pending
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [errorKind, setErrorKind] = React.useState<McpTemplateRenderErrorKind | null>(null)
  const complete = templateArgumentsComplete(action, values)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!complete || busy) return
    setBusy(true)
    setErrorKind(null)
    try {
      const rendered = await renderMcpTemplate({ connectionId: action.connectionId, name: action.name, arguments: templateArgumentValues(action, values) })
      pending.insert(pending.range, rendered.insert_text)
      onInserted()
    } catch (error) {
      setErrorKind(describeMcpTemplateRenderError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="mcp-template-arguments">
      <DialogHeader>
        <DialogTitle>{t('mcpTemplates.argumentsTitle', { name: action.label })}</DialogTitle>
        <DialogDescription>{t('mcpTemplates.argumentsDescription', { connector: action.connectorLabel })}</DialogDescription>
      </DialogHeader>
      {errorKind ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t(`mcpTemplates.errors.${errorKind}`, { name: action.label })}</AlertDescription>
        </Alert>
      ) : null}
      {action.arguments.map((argument) => {
        const id = `mcp-template-argument-${argument.name}`
        return (
          <div key={argument.name} className="space-y-2">
            <Label htmlFor={id}>
              {argument.name}
              {argument.required ? <span className="text-muted-foreground"> · {t('mcpTemplates.required')}</span> : null}
            </Label>
            <Input
              id={id}
              value={values[argument.name] ?? ''}
              onChange={(event) => setValues((current) => ({ ...current, [argument.name]: event.target.value }))}
              maxLength={1000}
              autoComplete="off"
              required={argument.required}
            />
          </div>
        )
      })}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{t('mcpTemplates.cancel')}</Button>
        <Button type="submit" disabled={!complete || busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ScrollText className="size-4" />}
          {busy ? t('mcpTemplates.inserting') : t('mcpTemplates.insert')}
        </Button>
      </DialogFooter>
    </form>
  )
}
