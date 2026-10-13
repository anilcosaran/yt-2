'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AddToSparkResult } from '@/lib/motion-editor/add-to-spark'
import type { CatalogItem } from '@/lib/motion-editor/catalog-model'
import { sparkProjectHref, type SparkProject } from '@/lib/spark/api'

/**
 * The inline project picker behind "Add to Spark project": the user's Spark projects of the active workspace channel (the
 * list Spark itself shows), one chosen, then the Motion goes in as a new scene (`addMotionToSparkProject`). A project whose
 * format the Motion does not offer is listed but not selectable, with the reason. Every refusal names itself.
 */

export type SparkPickerDeps = {
  /** The active workspace channel; null while none is chosen. */
  channelId: string | null
  listProjects: (channelId: string, options: { signal: AbortSignal }) => Promise<SparkProject[]>
  addMotion: (input: { projectId: string; item: CatalogItem }) => Promise<AddToSparkResult>
}

type ListState = { status: 'loading' } | { status: 'ready'; projects: SparkProject[] } | { status: 'error' }

export function MotionSparkPicker({ item, deps, onCancel }: { item: CatalogItem; deps: SparkPickerDeps; onCancel: () => void }) {
  const t = useTranslations('Motion.catalog.spark')
  const [list, setList] = React.useState<ListState>({ status: 'loading' })
  const [reload, setReload] = React.useState(0)
  const [chosen, setChosen] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [result, setResult] = React.useState<AddToSparkResult | null>(null)
  const { channelId, listProjects } = deps

  React.useEffect(() => {
    if (!channelId) return undefined
    const controller = new AbortController()
    listProjects(channelId, { signal: controller.signal })
      .then((projects) => {
        if (!controller.signal.aborted) setList({ status: 'ready', projects: projects.filter((project) => (project.lifecycleState ?? 'active') === 'active') })
      })
      .catch(() => {
        if (!controller.signal.aborted) setList({ status: 'error' })
      })
    return () => controller.abort()
  }, [channelId, listProjects, reload])

  const supports = (project: SparkProject) => item.aspectRatios.length === 0 || item.aspectRatios.includes(project.aspectRatio)
  const chosenProject = list.status === 'ready' ? list.projects.find((project) => project.id === chosen) ?? null : null

  const add = async () => {
    if (!chosenProject || adding) return
    setAdding(true)
    setResult(null)
    try {
      setResult(await deps.addMotion({ projectId: chosenProject.id, item }))
    } finally {
      setAdding(false)
    }
  }

  const failure = result && !result.ok ? (result.reason === 'refused' ? t(`refused.${result.refusal.reason}`, refusalValues(result.refusal)) : t(`failed.${result.reason}`)) : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel/40 p-3.5" data-motion-spark-picker="">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t('cancel')}</Button>
      </div>
      {!channelId ? (
        <p className="text-sm text-muted-foreground" role="status">{t('noChannel')}</p>
      ) : list.status === 'loading' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" aria-hidden />{t('loading')}</p>
      ) : list.status === 'error' ? (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => {
            setList({ status: 'loading' })
            setReload((count) => count + 1)
          }}>{t('retry')}</Button>
        </div>
      ) : list.projects.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          <Button asChild size="sm" variant="outline"><Link href="/spark">{t('newProject')}</Link></Button>
        </div>
      ) : (
        <ul role="radiogroup" aria-label={t('title')} className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
          {list.projects.map((project) => {
            const usable = supports(project)
            return (
              <li key={project.id}>
                <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${chosen === project.id ? 'border-ring bg-accent' : 'border-border'} ${usable ? '' : 'cursor-not-allowed opacity-50'}`}>
                  <input type="radio" name="motion-spark-project" value={project.id} checked={chosen === project.id} disabled={!usable || adding} onChange={() => { setChosen(project.id); setResult(null) }} />
                  <span className="min-w-0 flex-1 truncate">{project.title}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{usable ? project.aspectRatio : t('ratioUnavailable', { ratio: project.aspectRatio })}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}
      {result?.ok && chosenProject ? (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{t('added', { project: chosenProject.title })}</span>
          <Link href={sparkProjectHref(result.projectId)} className="font-medium underline underline-offset-2">{t('openProject')}</Link>
        </p>
      ) : null}
      {channelId && list.status === 'ready' && list.projects.length > 0 ? (
        <Button type="button" size="sm" className="self-end" disabled={!chosenProject || adding || result?.ok === true} aria-busy={adding || undefined} onClick={() => void add()}>
          {adding ? t('adding') : t('add')}
        </Button>
      ) : null}
    </div>
  )
}

function refusalValues(refusal: Extract<AddToSparkResult, { ok: false; reason: 'refused' }>['refusal']): Record<string, string | number> {
  if (refusal.reason === 'ratio_not_available') return { ratio: refusal.ratio }
  if (refusal.reason === 'scene_too_short') return { seconds: refusal.minSeconds }
  return {}
}
