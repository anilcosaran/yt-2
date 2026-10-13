'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { VideoStylePresetOption } from '@/lib/motion-editor/api'
import { formatClock, CATALOG_FPS, titleOf, type CatalogItem } from '@/lib/motion-editor/catalog-model'
import type { CatalogPreview, CatalogPreviewSource } from '@/lib/motion-editor/catalog-preview-source'
import type { MotionResourceFailure } from '@/lib/motion-editor/resource'
import { parameterLabel } from '@/lib/spark/motion-parameter-fields'
import type { PlaybackStore } from '@/lib/spark/playback-store'

import { MotionRuntimePlayer, type MotionPlayerDeps } from '../motion-runtime-player'
import { MotionPoster } from './motion-poster'
import { MotionSparkPicker, type SparkPickerDeps } from './motion-spark-picker'
import { usePrefersReducedMotion } from './use-viewport'

const editorHref = (draftId: string) => `/motion/${encodeURIComponent(draftId)}`

export type CustomizeStatus = { busy: boolean; failure: { kind: MotionResourceFailure; reason: string | null } | null }

/**
 * The large preview dialog of one Motion (deep link `?motion=<id>`; ESC and the close button close it, focus is trapped
 * inside and returns to the card). Left: the live player with play/pause and a scrubber (a platform Motion has no compile to
 * draw yet, so its poster and a note stand in). Right: the Motion's exposed fields (read-only: they show what the Motion
 * lets Spark edit, with the sample the card shows), its facts and the two ways to use it: "Add to Spark project" (an inline
 * project picker, the Motion goes in as a new scene) and "Customize with AI" (forks it into a private draft and opens the
 * editor).
 */
export function MotionDetailDialog({
  item,
  onClose,
  source,
  playerDeps,
  styles,
  styleRef,
  onStyleRef,
  onCustomize,
  customize,
  spark,
}: {
  item: CatalogItem
  onClose: () => void
  source: CatalogPreviewSource
  playerDeps?: MotionPlayerDeps
  styles: readonly VideoStylePresetOption[]
  styleRef: string
  onStyleRef: (ref: string) => void
  onCustomize: (item: CatalogItem) => void
  customize: CustomizeStatus
  spark: SparkPickerDeps
}) {
  const t = useTranslations('Motion.catalog')
  const library = useTranslations('Motion.library')
  const editor = useTranslations('Motion.editor')
  const locale = useLocale() === 'tr' ? 'tr' : 'en'
  const title = titleOf(item, locale)
  const [picking, setPicking] = React.useState(false)
  const [live, setLive] = React.useState<CatalogPreview | null>(null)
  const premiumClosed = item.premium && item.locked
  const canAdd = item.kind !== 'draft' && !premiumClosed
  const duration = live ? live.durationFrames / live.fps : item.durationFrames !== null ? item.durationFrames / CATALOG_FPS : null
  const ratios = live ? [live.ratio] : item.aspectRatios

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"
        data-motion-dialog={item.id}
        onCloseAutoFocus={(event) => {
          // The dialog has no trigger element (it opens from the card or a deep link), so focus goes back to the card itself.
          event.preventDefault()
          for (const card of globalThis.document.querySelectorAll<HTMLElement>('[data-motion-card]')) {
            if (card.getAttribute('data-motion-card') === item.id) card.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{item.summary || t('dialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2" aria-label={t('dialog.previewTitle')} role="group">
            <DialogPreview item={item} title={title} source={source} {...(playerDeps && { playerDeps })} onLive={setLive} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('dialog.category')}</dt>
              <dd><Badge variant="outline" className="font-normal">{t(`categories.${item.category}`)}</Badge></dd>
              {ratios.length > 0 ? (
                <>
                  <dt className="text-muted-foreground">{t('dialog.formats')}</dt>
                  <dd className="font-mono text-xs">{ratios.join(' · ')}</dd>
                </>
              ) : null}
              {duration !== null ? (
                <>
                  <dt className="text-muted-foreground">{t('dialog.duration')}</dt>
                  <dd className="font-mono text-xs">{formatClock(duration)}</dd>
                </>
              ) : null}
              {item.kind === 'draft' ? (
                <>
                  <dt className="text-muted-foreground">{t('card.draft')}</dt>
                  <dd className="text-xs">{t('card.draftVersion', { version: item.draftVersion ?? 0 })}{item.validated ? ` · ${t('card.validated')}` : ''}</dd>
                </>
              ) : null}
            </dl>

            <section aria-labelledby="motion-dialog-fields" className="flex flex-col gap-2">
              <h3 id="motion-dialog-fields" className="text-sm font-semibold">{t('dialog.fields')}</h3>
              {item.parameters.length > 0 ? (
                <>
                  <ul className="flex flex-col gap-2" data-motion-fields="">
                    {item.parameters.map((parameter) => {
                      const sample = item.sampleValues[parameter.parameter_id]
                      const kind = ['text', 'color', 'duration', 'number', 'media'].includes(parameter.kind) ? parameter.kind : 'enum'
                      return (
                        <li key={parameter.parameter_id} className="flex flex-col gap-0.5 rounded-lg border border-border bg-panel/40 px-3 py-2 text-sm" data-motion-field={parameter.parameter_id}>
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{parameterLabel(parameter.parameter_id)}</span>
                            <span className="text-xs text-muted-foreground">{editor(`parameters.kind.${kind}`)}</span>
                            {parameter.required ? <Badge variant="outline" className="font-normal">{t('dialog.required')}</Badge> : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {[
                              sample !== undefined ? `${t('dialog.sample')}: ${String(sample)}` : null,
                              parameter.text ? t('dialog.maxChars', { count: parameter.text.max_chars }) : null,
                              parameter.duration ? t('dialog.frames', { min: parameter.duration.min_frames, max: parameter.duration.max_frames }) : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="text-xs text-muted-foreground">{t('dialog.fieldsHint')}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{premiumClosed ? t('dialog.fieldsLocked') : item.kind === 'draft' ? t('dialog.fieldsDraft') : t('dialog.fieldsNone')}</p>
              )}
            </section>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {item.kind === 'platform' && !premiumClosed && styles.length > 0 ? (
                <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  {library('lookLabel')}
                  <select
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-panel/50 px-2 text-sm text-foreground"
                    value={styleRef}
                    onChange={(event) => onStyleRef(event.target.value)}
                  >
                    {styles.map((style) => (
                      <option key={style.preset_ref} value={style.preset_ref}>{style.title[locale]}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {premiumClosed ? (
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <p>{t('dialog.premiumNote')}</p>
                  <Button asChild variant="outline" size="sm"><Link href="/motion/community">{t('dialog.buy')}</Link></Button>
                </div>
              ) : null}
              {item.kind === 'draft' ? <p className="text-xs text-muted-foreground">{t('dialog.draftNote')}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={!canAdd} aria-expanded={picking} onClick={() => setPicking((open) => !open)}>
                  {t('dialog.addToSpark')}
                </Button>
                {item.kind === 'platform' ? (
                  <Button type="button" variant="outline" disabled={premiumClosed || customize.busy || styleRef === ''} aria-busy={customize.busy || undefined} onClick={() => onCustomize(item)}>
                    {customize.busy ? t('dialog.customizing') : t('dialog.customize')}
                  </Button>
                ) : item.draftId ? (
                  <Button asChild variant="outline"><Link href={editorHref(item.draftId)}>{t('dialog.openDraft')}</Link></Button>
                ) : null}
              </div>
              {customize.failure ? (
                <p role="alert" className="text-xs text-destructive">{library(`createFailed.${customize.failure.kind}`, { reason: customize.failure.reason ?? '' })}</p>
              ) : null}
              {picking && canAdd ? <MotionSparkPicker item={item} deps={spark} onCancel={() => setPicking(false)} /> : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type DialogPreviewState = { status: 'none' } | { status: 'loading' } | { status: 'ready'; preview: CatalogPreview } | { status: 'failed' }

function DialogPreview({ item, title, source, playerDeps, onLive }: { item: CatalogItem; title: string; source: CatalogPreviewSource; playerDeps?: MotionPlayerDeps; onLive: (preview: CatalogPreview | null) => void }) {
  const t = useTranslations('Motion.catalog.dialog')
  const player = useTranslations('Motion.editor.preview')
  const reducedMotion = usePrefersReducedMotion()
  const reducedRef = React.useRef(reducedMotion)
  React.useEffect(() => {
    reducedRef.current = reducedMotion
  })
  const drawable = source.canPreview(item) && !item.locked
  const [state, setState] = React.useState<DialogPreviewState>(drawable ? { status: 'loading' } : { status: 'none' })

  React.useEffect(() => {
    if (!drawable) return undefined
    const controller = new AbortController()
    source
      .load(item, { signal: controller.signal })
      .then((preview) => {
        if (controller.signal.aborted) return
        setState({ status: 'ready', preview })
        onLive(preview)
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'failed' })
      })
    return () => controller.abort()
  }, [drawable, item, source, onLive])

  const autoplay = React.useCallback((playback: PlaybackStore | null) => {
    if (playback && !reducedRef.current) playback.play()
  }, [])

  if (state.status === 'ready') {
    return <MotionRuntimePlayer ir={state.preview.ir} sha={state.preview.sha} variant="full" {...(playerDeps && { deps: playerDeps })} onPlayback={autoplay} />
  }
  return (
    <>
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border" data-motion-dialog-poster="">
        <MotionPoster item={item} title={title} large />
        {state.status === 'loading' ? (
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/30 text-sm text-white" role="status"><Loader2 className="size-4 animate-spin" aria-hidden />{player('player.loading')}</span>
        ) : null}
      </div>
      {state.status === 'none' && item.kind === 'platform' && !item.locked ? <p className="text-xs text-muted-foreground">{t('noLivePreview')}</p> : null}
      {state.status === 'failed' ? <p role="alert" className="text-xs text-muted-foreground">{t('previewFailed')}</p> : null}
    </>
  )
}
