'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { Clapperboard, Plus } from 'lucide-react'

import { WorkspaceRouteLoading } from '@/components/common/workspace-route-loading'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useActiveChannel } from '@/lib/channel/active-channel'
import {
  listSparkProjects,
  mergeSparkProjectPages,
  newSparkProjectHref,
  type SparkAspectRatio,
  type SparkProject,
} from '@/lib/spark/api'
import { openWorkTab, sparkProjectWorkHref } from '@/lib/work-tabs'

const PAGE_SIZE = 24

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; projects: SparkProject[]; nextCursor: string | null; loadingMore: boolean }

/**
 * Spark entry: the user's projects in the active channel. Opening one opens it straight into its work, as a tab
 * in the top bar, on the view it was left on (`lib/work-tabs.ts`). "New project" opens the workspace on Sohbet
 * without making anything: the project is created with the first sentence and named from it (`SparkNewProjectPage`).
 */
export function SparkProjectsPage() {
  const t = useTranslations('Spark')
  const router = useRouter()
  const { activeChannelId, workspaceReady } = useActiveChannel()
  const [reloadKey, setReloadKey] = React.useState(0)
  const openCreate = React.useCallback(() => {
    if (activeChannelId) router.push(newSparkProjectHref(activeChannelId))
  }, [activeChannelId, router])
  // Results are keyed by channel and reload so a channel switch or retry shows loading until its own response.
  const requestKey = activeChannelId ? `${activeChannelId}:${reloadKey}` : null
  const [result, setResult] = React.useState<{ key: string; state: ListState } | null>(null)
  const state = React.useMemo<ListState>(
    () => (result && result.key === requestKey ? result.state : { status: 'loading' }),
    [result, requestKey],
  )

  React.useEffect(() => {
    if (!activeChannelId || !requestKey) return undefined
    const controller = new AbortController()
    listSparkProjects(activeChannelId, { limit: PAGE_SIZE, signal: controller.signal })
      .then((page) => setResult({
        key: requestKey,
        state: { status: 'ready', projects: page.projects, nextCursor: page.nextCursor, loadingMore: false },
      }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: requestKey, state: { status: 'error' } })
      })
    return () => controller.abort()
  }, [activeChannelId, requestKey])

  const loadMore = React.useCallback(async () => {
    if (state.status !== 'ready' || !state.nextCursor || state.loadingMore || !activeChannelId || !requestKey) return
    setResult({ key: requestKey, state: { ...state, loadingMore: true } })
    try {
      const page = await listSparkProjects(activeChannelId, { limit: PAGE_SIZE, cursor: state.nextCursor })
      // P02-15: a project moved above the cursor while paging; start over instead of skipping it.
      if (page.restartRequired) {
        setReloadKey((key) => key + 1)
        return
      }
      setResult({
        key: requestKey,
        state: {
          status: 'ready',
          projects: mergeSparkProjectPages(state.projects, page.projects),
          nextCursor: page.nextCursor,
          loadingMore: false,
        },
      })
    } catch {
      setResult({ key: requestKey, state: { ...state, loadingMore: false } })
    }
  }, [activeChannelId, requestKey, state])

  const openProject = React.useCallback((project: SparkProject) => {
    openWorkTab({ kind: 'spark', id: project.id, title: project.title })
    router.push(sparkProjectWorkHref(project.id))
  }, [router])

  if (!workspaceReady) return <WorkspaceRouteLoading />

  return (
    <div className="hg-scrollbar relative h-full overflow-y-auto bg-background">
      <div className="hg-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="relative mx-auto min-h-full w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-panel">
              <Clapperboard className="size-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>
          <Button onClick={openCreate} disabled={!activeChannelId}>
            <Plus className="size-4" aria-hidden />
            {t('newProject')}
          </Button>
        </header>

        <section className="mt-8" aria-labelledby="spark-recent-projects">
          <h2 id="spark-recent-projects" className="text-sm font-medium text-muted-foreground">
            {t('recentProjects')}
          </h2>
          <div className="mt-3">
            {!activeChannelId ? (
              <p className="text-sm text-muted-foreground">{t('noChannel')}</p>
            ) : state.status === 'loading' ? (
              <ProjectGridSkeleton />
            ) : state.status === 'error' ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{t('loadFailed')}</span>
                <Button variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
                  {t('retry')}
                </Button>
              </div>
            ) : state.projects.length === 0 ? (
              <Empty className="border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Clapperboard aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
                  <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreate}>
                    <Plus className="size-4" aria-hidden />
                    {t('newProject')}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {state.projects.map((project) => (
                    <li key={project.id}>
                      <ProjectCard project={project} onOpen={openProject} />
                    </li>
                  ))}
                </ul>
                {state.nextCursor ? (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" onClick={loadMore} disabled={state.loadingMore}>
                      {state.loadingMore ? <Spinner /> : null}
                      {t('loadMore')}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ProjectCard({ project, onOpen }: { project: SparkProject; onOpen: (project: SparkProject) => void }) {
  const t = useTranslations('Spark')
  const format = useFormatter()
  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-panel text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video overflow-hidden bg-muted/40">
        <ProjectCover url={project.coverUrl} ratio={project.aspectRatio} />
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium" title={project.title}>{project.title}</p>
        <p className="text-xs text-muted-foreground">
          {project.aspectRatio} · {t('updated', { time: format.relativeTime(new Date(project.updatedAt)) })}
        </p>
      </div>
    </button>
  )
}

const coverFrameClass: Record<SparkAspectRatio, string> = {
  '16:9': 'size-full',
  '9:16': 'aspect-[9/16] h-full',
  '1:1': 'aspect-square h-full',
}

/**
 * The project's still in its own ratio; vertical and square stills sit on a blurred copy of themselves so the
 * 16:9 card stays filled. A project without a still (or one that fails to load) shows a quiet icon instead.
 */
function ProjectCover({ url, ratio }: { url?: string; ratio: SparkAspectRatio }) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  if (!url || failedUrl === url) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        <Clapperboard className="size-6" aria-hidden />
      </div>
    )
  }
  return (
    <>
      {ratio === '16:9' ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-xl" aria-hidden />
      )}
      <div className="relative flex h-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(url)}
          className={`${coverFrameClass[ratio]} object-cover`}
        />
      </div>
    </>
  )
}

function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="overflow-hidden rounded-xl border border-border bg-panel">
          <Skeleton className="aspect-video rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
