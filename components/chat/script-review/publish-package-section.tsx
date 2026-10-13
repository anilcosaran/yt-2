'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { PublishPackageController, type PublishPackageError } from '@/lib/assistant/script-review/publish-package-controller'
import {
  PUBLISH_PACKAGE_QUERY_KEY,
  loadPublishPackage,
  revisePublishPackage,
  type PublishPackageField,
  type PublishPackageView,
} from '@/lib/assistant/script-review/publish-package-api'
import {
  PUBLISH_LIMITS,
  buildPublishPackageModel,
  draftToCommit,
  resyncDraft,
  sceneOrderOf,
  staleReasonsOf,
  tagsText,
  type PublishPackageEdit,
  type PublishPackageModel,
} from '@/lib/assistant/script-review/publish-package-model'
import { PRODUCTION_PLAN_SUMMARY_QUERY_KEY } from '@/lib/assistant/script-review/script-review-api'

type Translator = (key: string, values?: Record<string, string | number>) => string

/**
 * P04-21 "Yayın paketi" of the Plan view (KARAR-VIDEO-BRIEF §12A, K293): the title options with the selected one, the
 * description, the tags, the thumbnail with its source, reason and cost, and the chapters of a long video, with a stale
 * marker on every field whose basis (script, shot plan, transcript) moved. It reads and edits through the owner routes
 * behind a loading state (no local copy, no browser storage) and never publishes: approving the plan is not a
 * permission to publish. Same `pl-sec` / `pl-card` / `voice-row` / `tagc` / `stag` / `oldv` design as the other sections.
 * Absent (no package yet, gate closed, job not readable): the section is not shown.
 */

const EDITABLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  border: 0,
  background: 'transparent',
  resize: 'none',
  font: 'inherit',
  color: 'inherit',
  fieldSizing: 'content',
  minHeight: '1.5em',
} as React.CSSProperties

export interface PublishPackageControls {
  model: PublishPackageModel
  /** The field being stored (edits go one at a time). */
  pending: PublishPackageField | null
  error: { kind: PublishPackageError; field: PublishPackageField | null } | null
  onEdit(edit: PublishPackageEdit): void
}

/** The slot the Plan view renders after its screens: loads the job's package and shows the section, or nothing. */
export function PublishPackageSlot({ projectId, jobId, shots }: {
  projectId: string
  jobId: string
  shots: ReadonlyArray<{ order: number; beat_ids: readonly string[]; scene_id?: unknown }> | null
}) {
  const query = useQuery({
    queryKey: [...PUBLISH_PACKAGE_QUERY_KEY, projectId, jobId],
    queryFn: ({ signal }) => loadPublishPackage(projectId, jobId, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
  if (query.data?.status !== 'ok') return null
  return <PublishPackagePanel projectId={projectId} jobId={jobId} view={query.data.view} shots={shots} />
}

function PublishPackagePanel({ projectId, jobId, view, shots }: {
  projectId: string
  jobId: string
  view: PublishPackageView
  shots: ReadonlyArray<{ order: number; beat_ids: readonly string[]; scene_id?: unknown }> | null
}) {
  const queryClient = useQueryClient()
  const [controller] = React.useState(() => new PublishPackageController({
    view,
    newIdempotencyKey: () => `publish-package:${view.package_id}:${randomKey()}`,
    send: (request) => revisePublishPackage({ projectId, jobId, ...request }),
    reload: async () => {
      const fresh = await queryClient.fetchQuery({
        queryKey: [...PUBLISH_PACKAGE_QUERY_KEY, projectId, jobId],
        queryFn: ({ signal }) => loadPublishPackage(projectId, jobId, { signal }),
        staleTime: 0,
      })
      return fresh.status === 'ok' ? fresh.view : null
    },
    onSaved: () => {
      // A new package revision never moves the plan; the summary is re-read so the cards stay honest about what they show.
      void queryClient.invalidateQueries({ queryKey: [...PRODUCTION_PLAN_SUMMARY_QUERY_KEY, projectId, jobId] })
    },
  }))
  const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  // A newer read of the package (a script change made fields stale, another tab wrote) is adopted when nothing is in flight.
  React.useEffect(() => controller.refresh(view), [controller, view])
  React.useEffect(() => () => controller.dispose(), [controller])
  const model = React.useMemo(() => buildPublishPackageModel(snapshot.view), [snapshot.view])
  return (
    <PublishPackageSection
      shots={shots}
      controls={{ model, pending: snapshot.pending, error: snapshot.error, onEdit: (edit) => void controller.edit(edit) }}
    />
  )
}

export function PublishPackageSection({ controls, shots }: {
  controls: PublishPackageControls
  shots: ReadonlyArray<{ order: number; beat_ids: readonly string[]; scene_id?: unknown }> | null
}) {
  const t = useTranslations('Chat') as unknown as Translator
  const { model, pending, error, onEdit } = controls
  const staleFields = [...model.stale.keys()]
  const invalid = (field: PublishPackageField) => error?.kind === 'refused' && error.field === field
  const marker = (field: PublishPackageField) => {
    const reasons = staleReasonsOf(model, field)
    if (reasons.length === 0) return null
    return (
      <span className="tagc" data-publish-stale={field} title={reasons.map((reason) => t(`scriptReview.publish.staleReasons.${reason}`)).join(' ')}>
        {t('scriptReview.publish.stale')}
      </span>
    )
  }
  const thumb = model.thumbnail
  const detail = thumb.detail
  const sceneOrder = detail?.kind === 'frame' ? sceneOrderOf(detail.sceneId, shots) : null
  const detailText = detail?.kind === 'frame'
    ? [
      sceneOrder !== null ? t('scriptReview.publish.thumbnailFrameScene', { order: sceneOrder }) : null,
      t('scriptReview.publish.thumbnailFrameAt', { seconds: Math.round(detail.atSeconds * 10) / 10 }),
    ].filter((part): part is string => Boolean(part)).join(' · ')
    : detail?.kind === 'image' ? t('scriptReview.publish.thumbnailImage') : detail?.kind === 'generation' ? t('scriptReview.publish.thumbnailGeneration') : ''
  const cost = thumb.cost.status === 'priced' && thumb.cost.credits !== null
    ? t('scriptReview.publish.cost.priced', { credits: thumb.cost.credits })
    : t(`scriptReview.publish.cost.${thumb.cost.status}`)

  return (
    <section className="pl-sec" data-publish-package-revision={model.revision} aria-busy={pending !== null}>
      <h3>
        <Icon name="file" />
        {t('scriptReview.sections.publish')}
        <span className="r muted" style={{ fontWeight: 500, fontSize: 12 }} role="status">
          {pending !== null ? t('scriptReview.publish.saving') : t(`scriptReview.publish.origin.${model.origin}`)}
        </span>
      </h3>
      {error && error.kind !== 'refused' ? (
        <div className="oldv" role="alert" style={{ marginBottom: 10 }}>
          <Icon name="history" size="sm" />
          <span>{t(`scriptReview.publish.errors.${error.kind}`)}</span>
        </div>
      ) : null}
      {staleFields.length > 0 ? (
        <div className="oldv" role="status" style={{ marginBottom: 10 }}>
          <Icon name="history" size="sm" />
          <span>{t('scriptReview.publish.staleNotice')}</span>
        </div>
      ) : null}

      <div className="pl-card strat2">
        <div className="sf2">
          <div className="sf2-l">{t('scriptReview.publish.titles')} {marker('titles')}</div>
          {model.titles.map((title, index) => (
            <div key={title.titleId} data-publish-title={title.titleId} data-publish-title-selected={title.selected || undefined} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DraftField
                  value={title.text}
                  maxLength={PUBLISH_LIMITS.titleChars}
                  label={t('scriptReview.publish.titleOption', { n: index + 1 })}
                  invalid={invalid('titles')}
                  onCommit={(text) => onEdit({ kind: 'title_text', titleId: title.titleId, text })}
                />
              </div>
              {title.selected ? (
                <span className="tagc">{t('scriptReview.publish.selected')}</span>
              ) : (
                <button type="button" className="btn ghost sm" onClick={() => onEdit({ kind: 'select_title', titleId: title.titleId })}>
                  {t('scriptReview.publish.select')}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="sf2">
          <div className="sf2-l">{t('scriptReview.publish.description')} {marker('description')}</div>
          <DraftField
            multiline
            value={model.description}
            maxLength={PUBLISH_LIMITS.descriptionChars}
            label={t('scriptReview.publish.description')}
            invalid={invalid('description')}
            onCommit={(text) => onEdit({ kind: 'description', text })}
          />
        </div>
        <div className="sf2">
          <div className="sf2-l">{t('scriptReview.publish.tags')} {marker('tags')}</div>
          <DraftField
            value={tagsText(model.tags)}
            maxLength={PUBLISH_LIMITS.tagsTotalChars}
            label={t('scriptReview.publish.tags')}
            placeholder={t('scriptReview.publish.tagsHint')}
            invalid={invalid('tags')}
            onCommit={(text) => onEdit({ kind: 'tags', text })}
          />
          {model.tags.length > 0 ? (
            <div className="stags" style={{ marginTop: 6 }}>
              {model.tags.map((tag) => <span key={tag} className="stag">{tag}</span>)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pl-card" style={{ overflow: 'hidden', marginTop: 12 }}>
        <div className="voice-row" data-publish-thumbnail={thumb.source} data-publish-thumbnail-cost={thumb.cost.status}>
          <span className="sic"><Icon name="image" size="sm" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <b>{t('scriptReview.publish.thumbnail')}</b>
              <span className="tagc">{t(`scriptReview.publish.source.${thumb.source}`)}</span>
              <span className="tagc" title={t('scriptReview.publish.costHint')}>{cost}</span>
              {marker('thumbnail')}
            </div>
            <small className="muted">{[thumb.reason, detailText].filter(Boolean).join(' · ')}</small>
            <DraftField
              value={thumb.titleText}
              maxLength={PUBLISH_LIMITS.titleChars}
              label={t('scriptReview.publish.thumbnailText')}
              placeholder={t('scriptReview.publish.thumbnailText')}
              invalid={invalid('thumbnail')}
              onCommit={(text) => onEdit({ kind: 'thumbnail_text', text })}
            />
          </div>
        </div>
      </div>

      {model.chapters ? (
        <div className="pl-card" style={{ overflow: 'hidden', marginTop: 12 }}>
          <div className="sf2-l" style={{ padding: '8px 12px 0' }}>{t('scriptReview.publish.chapters')} {marker('chapters')}</div>
          {model.chapters.map((chapter) => (
            <div key={chapter.chapterId} className="voice-row" data-publish-chapter={chapter.chapterId}>
              <span className="sic"><Icon name="clock" size="sm" /></span>
              <span className="muted" style={{ minWidth: 44 }}>{chapter.startLabel}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DraftField
                  value={chapter.title}
                  maxLength={PUBLISH_LIMITS.titleChars}
                  label={t('scriptReview.publish.chapterTitle')}
                  invalid={invalid('chapters')}
                  onCommit={(text) => onEdit({ kind: 'chapter_title', chapterId: chapter.chapterId, text })}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error?.kind === 'refused' ? (
        <div className="oldv" role="alert" style={{ marginTop: 10 }}>
          <Icon name="history" size="sm" />
          <span>{t('scriptReview.publish.errors.refused')}</span>
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 10 }}>{t('scriptReview.publish.notPublishing')}</p>
    </section>
  )
}

/**
 * One text of the package: the user types into a local draft and the edit is stored when the field loses focus (Enter in
 * a one-line field). The draft follows the owner's text when it changes and the user has not typed on top of it.
 */
function DraftField({ value, onCommit, maxLength, label, placeholder, invalid, multiline }: {
  value: string
  onCommit(text: string): void
  maxLength: number
  label: string
  placeholder?: string
  invalid: boolean
  multiline?: boolean
}) {
  const [draft, setDraft] = React.useState(value)
  const seen = React.useRef(value)
  React.useEffect(() => {
    if (value === seen.current) return
    const previous = seen.current
    seen.current = value
    setDraft((current) => resyncDraft(current, previous, value))
  }, [value])
  const commit = () => {
    const text = draftToCommit(draft, value)
    if (text !== null) onCommit(text)
  }
  const common = {
    className: 'ed',
    style: EDITABLE,
    value: draft,
    maxLength,
    placeholder,
    'aria-label': label,
    'aria-invalid': invalid || undefined,
    onBlur: commit,
  }
  return multiline ? (
    <textarea {...common} rows={3} onChange={(event) => setDraft(event.target.value)} />
  ) : (
    <input
      {...common}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function Icon({ name, size }: { name: string; size?: 'sm' }) {
  return (
    <svg className={`i${size ? ` ${size}` : ''}`} aria-hidden>
      <use href={`#i-${name}`} />
    </svg>
  )
}

function randomKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}
