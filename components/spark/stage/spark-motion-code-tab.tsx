'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { CompositionDocument } from '@/lib/spark/composition-client'
import type { SparkCompositionActions } from '@/lib/spark/composition-session'
import type { CompositionMotionRevisionRef } from '@/lib/spark/composition-typed-edits'
import {
  DEFAULT_MOTION_CODE_APPLY_DEPS,
  newMotionCodeAttempt,
  publishEditedMotionSource,
  type MotionCodeApplyDeps,
  type MotionCodeAttempt,
  type MotionCodeIssue,
  type MotionCodeStage,
} from '@/lib/spark/motion-code/motion-code-apply'
import { checkMotionSourceText } from '@/lib/spark/motion-code/motion-code-validate'
import type { MotionSource } from '@/lib/spark/motion-code/motion-source'
import { repointMotionLayer, type MotionRepointDeps, type MotionRepointOutcome } from '@/lib/spark/motion-code/motion-repoint-run'
import { revertTargetFor, type RevertDeps, type RevertMemory } from '@/lib/spark/motion-code/motion-revert'
import type { MotionLayerView } from '@/lib/spark/motion-layers'

import { StudioIcon } from '../studio-icon'

type Applied = Extract<MotionRepointOutcome, { status: 'applied' }>

/** What the last action said, tied to the layer it is about (an apply moves the tab to the new layer; its notice follows). */
export type SparkMotionCodeResult =
  | { kind: 'blocked'; layerId: string; stage: MotionCodeStage; issues: MotionCodeIssue[]; reason: string | null }
  | { kind: 'failed'; layerId: string; stage: MotionCodeStage }
  | { kind: 'applied'; layerId: string; /** The layer the apply started from: the notice shows on it and on the layer that replaced it. */ fromLayerId: string; outcome: Applied; revert: boolean }
  /** The new revision exists (it is in My Motions) but the layer could not take it. */
  | { kind: 'not_applied'; layerId: string; reason: string; saved: boolean }

export type SparkMotionCodeTabDeps = {
  publish?: MotionCodeApplyDeps
  repoint?: Pick<MotionRepointDeps, 'loadExposure' | 'uuid'>
  revert?: RevertDeps
  newAttempt?: () => MotionCodeAttempt
}

/**
 * Code tab of the right panel (owner decision 2026-10-04, replaces Q34): the readable source of the selected Motion layer's
 * pinned revision. Read-only where the user cannot write or the Motion authoring switch is off; otherwise EDITABLE, behind a
 * short warning ("Editing code can break this scene. Changes are your responsibility; you can undo.").
 *
 * Apply = cheap local check -> fork to a private draft -> write the source -> the Motion validator -> "Save as Motion" (an
 * immutable revision) -> re-pin the layer to it, ONE undoable editor action (`motion-code-apply.ts`, `motion-repoint.ts`). A hard
 * failure (not JSON, validator refusal) blocks and is shown inline; nothing on the project changes before the revision exists.
 * Reset restores the source the tab opened with; Revert re-pins the previous revision (the one before this session's apply, else
 * the revision the Motion was forked from).
 */
export function SparkMotionCodeTab({
  view,
  source,
  projectId,
  sceneNumber,
  editable,
  canWrite,
  writeTitle,
  getDocument,
  apply,
  onUndo,
  revertMemory,
  onRepointed,
  stale = false,
  controlled,
  deps = {},
}: {
  view: MotionLayerView
  source: MotionSource
  projectId: string
  sceneNumber: number
  /** Editing is offered at all (the Motion authoring switch is on and the user may write); false = read-only view. */
  editable: boolean
  canWrite: boolean
  writeTitle?: string
  /** The newest document the editor holds (read after every await). */
  getDocument: () => CompositionDocument | null
  apply: SparkCompositionActions['apply']
  /** The editor's own Undo (the header button): the notice after an apply offers it. */
  onUndo: () => void
  revertMemory: RevertMemory
  /** The layer now holds another revision (a new layer id): the shell selects it. */
  onRepointed: (outcome: Applied) => void
  /** The pinned revision changed and its source is still being read: `source` is the previous one, shown read-only meanwhile. */
  stale?: boolean
  /** The last action's notice, held by the caller (see the state below). */
  controlled?: { result: SparkMotionCodeResult | null; onResult: (result: SparkMotionCodeResult | null) => void }
  deps?: SparkMotionCodeTabDeps
}) {
  const t = useTranslations('Spark.editor.motionCode')
  const [text, setText] = React.useState(source.text)
  const [pending, setPending] = React.useState<MotionCodeStage | 'repoint' | 'revert' | null>(null)
  // The notice normally lives in the shell: the repoint removes the old layer, so the tab is unmounted for a moment before the new
  // layer is selected, and a state kept here would be lost with it. Without a shell (tests) the tab keeps it itself.
  const [localResult, setLocalResult] = React.useState<SparkMotionCodeResult | null>(null)
  const result = controlled ? controlled.result : localResult
  const setResult = controlled ? controlled.onResult : setLocalResult
  const [revert, setRevert] = React.useState<{ key: string; target: CompositionMotionRevisionRef | null } | null>(null)
  const attempt = React.useRef<{ key: string; value: MotionCodeAttempt } | null>(null)
  const pin = view.motionRef

  // The source the tab shows follows the pinned revision: another revision (an apply, an Undo, the Assistant) resets the text.
  const sourceKey = `${pin.motion_revision_id}/${pin.manifest_sha256}`
  const [shownSource, setShownSource] = React.useState(source)
  if (shownSource !== source) {
    setShownSource(source)
    setText(source.text)
  }

  const revertKey = `${view.layerId}/${sourceKey}`
  React.useEffect(() => {
    let live = true
    void revertTargetFor(view.layerId, pin, revertMemory, deps.revert).then((target) => {
      if (live) setRevert({ key: revertKey, target })
    })
    return () => {
      live = false
    }
    // The pin's parts are in the key; `pin` itself is a fresh object per document read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revertKey, revertMemory])
  // A target found for another layer or revision is never offered for this one.
  const revertTarget = revert?.key === revertKey ? revert.target : null

  const dirty = text !== source.text
  const deferred = React.useDeferredValue(text)
  const check = React.useMemo(() => (deferred === source.text ? null : checkMotionSourceText(deferred, source.pattern)), [deferred, source])
  const localIssues = check && !check.ok ? check.issues : []
  const busy = pending !== null || stale
  const canEdit = editable && canWrite && view.v2
  const canApply = canEdit && dirty && !busy && check !== null && check.ok

  const repointDeps: MotionRepointDeps = { document: getDocument, apply, ...deps.repoint }
  const remember = (outcome: Applied) => {
    revertMemory.set(outcome.layerId, outcome.previousRef)
    onRepointed(outcome)
  }

  const runApply = async () => {
    if (!canApply) return
    setResult(null)
    const key = `${view.layerId}/${sourceKey}/${text.length}:${hashText(text)}`
    if (attempt.current?.key !== key) attempt.current = { key, value: (deps.newAttempt ?? newMotionCodeAttempt)() }
    setPending('fork')
    const published = await publishEditedMotionSource(
      { projectId, view, text, baseline: source.pattern, attempt: attempt.current.value, onStage: setPending },
      deps.publish ?? DEFAULT_MOTION_CODE_APPLY_DEPS,
    )
    if (published.status === 'blocked') {
      setPending(null)
      setResult({ kind: 'blocked', layerId: view.layerId, stage: published.stage, issues: published.issues, reason: published.reason })
      return
    }
    if (published.status === 'failed') {
      setPending(null)
      setResult({ kind: 'failed', layerId: view.layerId, stage: published.stage })
      return
    }
    setPending('repoint')
    const outcome = await repointMotionLayer({ view, target: published.ref }, repointDeps)
    setPending(null)
    if (outcome.status === 'applied') {
      attempt.current = null
      setResult({ kind: 'applied', layerId: outcome.layerId, fromLayerId: view.layerId, outcome, revert: false })
      remember(outcome)
    } else {
      setResult({ kind: 'not_applied', layerId: view.layerId, saved: true, reason: outcome.status === 'refused' ? outcome.refusal.reason : outcome.stage })
    }
  }

  const runRevert = async () => {
    if (!revertTarget || busy || !canWrite) return
    setResult(null)
    setPending('revert')
    const outcome = await repointMotionLayer({ view, target: revertTarget }, repointDeps)
    setPending(null)
    if (outcome.status === 'applied') {
      setResult({ kind: 'applied', layerId: outcome.layerId, fromLayerId: view.layerId, outcome, revert: true })
      remember(outcome)
    } else {
      setResult({ kind: 'not_applied', layerId: view.layerId, saved: false, reason: outcome.status === 'refused' ? outcome.refusal.reason : outcome.stage })
    }
  }

  const shown = result && (result.layerId === view.layerId || (result.kind === 'applied' && result.fromLayerId === view.layerId)) ? result : null
  const originKey = source.origin === 'saved' ? 'originSaved' : 'originLibrary'

  return (
    <div data-motion-code-tab={editable ? 'editable' : 'readonly'}>
      <div className="pp-head">
        <span className="ic">
          <StudioIcon name="code" />
        </span>
        <div>
          <b>{t('title')}</b>
          <small>
            {t('scene', { n: sceneNumber })} · {t(originKey)} · {source.format}
          </small>
        </div>
      </div>

      <section className="pp-sec">
        {canEdit ? (
          <p className="pp-banner warn" role="note" data-motion-code-warning="">
            <StudioIcon name="shield" className="sm" />
            <span>{t('warning')}</span>
          </p>
        ) : (
          <p className="pp-banner" role="note" data-motion-code-readonly="">
            <StudioIcon name="lock" className="sm" />
            <span>{t(!canWrite ? 'readOnlyRole' : !editable ? 'readOnlyOff' : 'readOnlyLegacy')}</span>
          </p>
        )}
        <textarea
          className="pp-code"
          aria-label={t('sourceLabel')}
          data-motion-code-source=""
          value={text}
          readOnly={!canEdit || busy}
          spellCheck={false}
          wrap="off"
          aria-invalid={localIssues.length > 0 || undefined}
          title={!canWrite ? writeTitle : undefined}
          onChange={(event) => {
            setText(event.target.value)
            if (shown) setResult(null)
          }}
          // Typing keeps its own undo: the editor's window shortcuts (Ctrl/Cmd+Z) must not take the key.
          onKeyDown={(event) => event.stopPropagation()}
        />
        {dirty && localIssues.length > 0 ? (
          <ul className="pp-issues" role="alert" data-motion-code-issues="local">
            {localIssues.map((issue) => (
              <li key={issue.code}>{t(`issues.${issue.code}`, { detail: issue.detail ?? '' })}</li>
            ))}
          </ul>
        ) : null}

        {shown?.kind === 'blocked' ? <BlockedNotice result={shown} /> : null}
        {shown?.kind === 'failed' ? (
          <p className="pp-hint warn" role="alert" data-motion-code-result="failed">
            {t('failed', { stage: t(`stage.${shown.stage}`) })}
          </p>
        ) : null}
        {shown?.kind === 'not_applied' ? (
          <p className="pp-hint warn" role="alert" data-motion-code-result="not_applied">
            {t(shown.saved ? 'notApplied' : 'revertFailed', { reason: t(`notAppliedReasons.${NOT_APPLIED_REASONS.has(shown.reason) ? shown.reason : 'other'}`) })}
          </p>
        ) : null}
        {shown?.kind === 'applied' ? <AppliedNotice result={shown} onUndo={onUndo} /> : null}
        {pending ? (
          <p className="pp-hint" role="status" aria-busy="true" data-motion-code-pending={pending}>
            {t(`pending.${pending}`)}
          </p>
        ) : stale ? (
          <p className="pp-hint" role="status" aria-busy="true" data-motion-code-pending="source">
            {t('loading')}
          </p>
        ) : null}

        <div className="pp-actions">
          {canEdit ? (
            <button type="button" className="btn sm primary" disabled={!canApply} title={!canWrite ? writeTitle : undefined} data-motion-code-apply="" onClick={() => void runApply()}>
              {t('apply')}
            </button>
          ) : null}
          {canEdit ? (
            <button type="button" className="btn sm" disabled={!dirty || busy} data-motion-code-reset="" onClick={() => setText(source.text)}>
              {t('reset')}
            </button>
          ) : null}
          {canEdit && revertTarget ? (
            <button type="button" className="btn sm" disabled={busy} title={t('revertHint')} data-motion-code-revert="" onClick={() => void runRevert()}>
              {t('revert')}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}

const NOT_APPLIED_REASONS = new Set([
  'layer_missing',
  'not_v2',
  'no_range',
  'video_style_unavailable',
  'target_project_private',
  'needs_image',
  'exposure',
  'write',
])

function BlockedNotice({ result }: { result: Extract<SparkMotionCodeResult, { kind: 'blocked' }> }) {
  const t = useTranslations('Spark.editor.motionCode')
  const headline =
    result.reason === 'source_not_editable'
      ? t('blocked.source_not_editable')
      : result.stage === 'validator'
        ? t('blocked.validator')
        : result.stage === 'publish'
          ? t('blocked.publish', { reason: result.reason ? t(`publishReasons.${PUBLISH_REASONS.has(result.reason) ? result.reason : 'other'}`) : t('publishReasons.other') })
          : result.stage === 'write'
            ? t('blocked.write', { reason: result.reason ?? '' })
            : t('blocked.local')
  return (
    <div data-motion-code-result="blocked" data-motion-code-stage={result.stage}>
      <p className="pp-hint warn" role="alert">
        {headline}
      </p>
      {result.issues.length > 0 ? (
        <ul className="pp-issues" data-motion-code-issues={result.stage}>
          {result.issues.slice(0, 8).map((issue, index) => (
            <li key={`${issue.code}:${issue.path ?? ''}:${index}`}>
              {result.stage === 'local' ? t(`issues.${LOCAL_CODES.has(issue.code) ? issue.code : 'other'}`, { detail: issue.message ?? '' }) : <code>{issue.code}</code>}
              {result.stage === 'local' ? null : issue.path ? ` ${issue.path}` : ''}
              {result.stage !== 'local' && issue.message ? ` - ${issue.message}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const LOCAL_CODES = new Set(['empty', 'not_json', 'not_object', 'too_large', 'missing_manifest', 'missing_body', 'unchanged'])
const PUBLISH_REASONS = new Set(['not_available', 'archived', 'validation_missing', 'validation_stale', 'validation_failed', 'unchanged'])

function AppliedNotice({ result, onUndo }: { result: Extract<SparkMotionCodeResult, { kind: 'applied' }>; onUndo: () => void }) {
  const t = useTranslations('Spark.editor.motionCode')
  const { outcome } = result
  return (
    <div data-motion-code-result={result.revert ? 'reverted' : 'applied'}>
      <p className="pp-hint" role="status">
        {t(result.revert ? 'reverted' : 'applied')}{' '}
        <button type="button" className="btn sm" data-motion-code-undo="" onClick={onUndo}>
          {t('undo')}
        </button>
      </p>
      {outcome.dropped.length > 0 ? <p className="pp-hint">{t('dropped', { names: outcome.dropped.join(', ') })}</p> : null}
      {outcome.lost.length > 0 ? <p className="pp-hint">{t('lost')}</p> : null}
      {outcome.followUpFailed ? <p className="pp-hint warn">{t('followUpFailed')}</p> : null}
    </div>
  )
}

/** A short stable digest of the text (an attempt key part, not security): the same text replays the same attempt. */
function hashText(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0
  return (hash >>> 0).toString(36)
}
