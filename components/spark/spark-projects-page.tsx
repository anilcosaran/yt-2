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
  sparkProjectHref,
  type SparkAspectRatio,
  type SparkProject,
} from '@/lib/spark/api'

const PAGE_SIZE = 24

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; projects: SparkProject[]; nextCursor: string | null; loadingMore: boolean }

/**
 * Spark entry: the user's projects in the active channel. Opening one leaves the shell for the full-screen
 * workspace. "New project" opens that workspace on Sohbet without making anything: the project is created with
 * the first sentence and named from it (`SparkNewProjectPage`).
 */
export function SparkProjectsPage() {
  const t = useTranslations('Spark')
  const router = useRouter()
  const { activeChannelId, workspaceReady } = useActiveChannel()
  const [reloadKey, setReloadKey] = React.useState(0)
  const openCreate = React.useCallback(() => {
    if (activeChannelId) router.push(`/spark/new?channel=${encodeURIComponent(activeChannelId)}`)
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

  const openProject = React.useCallback((projectId: string) => {
    router.push(sparkProjectHref(projectId))
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

function ProjectCard({ project, onOpen }: { project: SparkProject; onOpen: (projectId: string) => void }) {
  const t = useTranslations('Spark')
  const format = useFormatter()
  return (
    <button
      type="button"
      onClick={() => onOpen(project.id)}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-panel text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex h-32 items-center justify-center bg-muted/40">
        <AspectFrame ratio={project.aspectRatio} />
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

const aspectFrameSize: Record<SparkAspectRatio, string> = {
  '16:9': 'h-14 w-24',
  '9:16': 'h-24 w-14',
  '1:1': 'size-20',
}

function AspectFrame({ ratio }: { ratio: SparkAspectRatio }) {
  return <div className={`${aspectFrameSize[ratio]} rounded-md border-2 border-foreground/20 bg-background`} aria-hidden />
}

function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <Skeleton key={item} className="h-48 rounded-xl" />
      ))}
    </div>
  )
}
