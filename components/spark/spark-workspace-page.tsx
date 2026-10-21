'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AuthClientError } from '@/lib/auth/errors'
import { createSparkProject, getSparkProject, sparkProjectHref, type SparkProject } from '@/lib/spark/api'
import { closeWorkTab, openWorkTab, projectSearchWithoutMode, replaceWorkTab } from '@/lib/work-tabs'

import { labViewFromQuery, titleFromPrompt, type LabPhase, type LabRatio, type LabView } from './lab/lab-model'
import { SparkLab } from './lab/spark-lab'

const PROJECTS_HREF = '/spark'

const sparkProjectQueryKey = (projectId: string) => ['spark', 'project', projectId] as const

type ProjectLoad = { status: 'loading' | 'not_found' | 'error' } | { status: 'ready'; project: SparkProject; leftAt?: LabPhase }

// Where a project's run was left, so a project that already has a plan does not open as a new one. This stands
// in for the project's saved state: only the moment is kept (per tab), the run itself is the demo's.
const leftAtKey = (projectId: string) => `yt2_spark_workspace_${projectId}`

function writeLeftAt(projectId: string, phase: LabPhase) {
  // A run left while Spark was still working has finished by the next visit.
  const settled = phase === 'empty' ? null : phase === 'drafting' || phase === 'plan' ? 'plan' : 'done'
  try {
    if (settled) window.sessionStorage.setItem(leftAtKey(projectId), settled)
    else window.sessionStorage.removeItem(leftAtKey(projectId))
  } catch {
    // Without sessionStorage the project opens as new next time.
  }
}

function readLeftAt(projectId: string): LabPhase | undefined {
  try {
    const stored = window.sessionStorage.getItem(leftAtKey(projectId))
    return stored === 'plan' || stored === 'done' ? stored : undefined
  } catch {
    return undefined
  }
}

/**
 * The view a project opens on. A link from when projects had a Flow mode (`?mode=flow`) opens its canvas where it
 * is now, Plan › Akış, and its address is put right without a navigation.
 */
function useProjectView(view: LabView) {
  const searchParams = useSearchParams()
  const [legacySearch] = React.useState(() => {
    const search = searchParams.toString()
    const mapped = projectSearchWithoutMode(search)
    return mapped === search ? null : mapped
  })
  React.useEffect(() => {
    if (legacySearch === null) return
    const url = new URL(window.location.href)
    url.search = legacySearch
    window.history.replaceState(null, '', url)
  }, [legacySearch])
  return React.useMemo(
    () => (legacySearch === null ? view : labViewFromQuery(Object.fromEntries(new URLSearchParams(legacySearch)))),
    [legacySearch, view],
  )
}

/**
 * One Spark project, as a tab of the shell (`lib/work-tabs.ts`): the workspace (`./lab`: Sohbet, Plan and Editör;
 * its canvas is Plan › Akış). The project loads behind a spinner and the workspace opens once it exists and the user
 * can open it; its name and format are the project's own, and its tab is opened (or named) then. A project that is
 * gone closes its tab. It opens on the view its tab was left on; a project with nothing in it yet opens on Sohbet's
 * start, where it is described in one sentence.
 *
 * Only the project itself is read from the gateway. What happens in the workspace is the scripted run of the
 * design prototype: it does not read or write the project's composition.
 */
export function SparkWorkspacePage({ projectId, view: linkedView }: { projectId: string; view: LabView }) {
  const router = useRouter()
  const view = useProjectView(linkedView)
  // A project read once stays in the query cache, so coming back to its tab opens it at once (and reads it again
  // behind it once it is stale) instead of behind the spinner.
  const query = useQuery({
    queryKey: sparkProjectQueryKey(projectId),
    queryFn: ({ signal }) => getSparkProject(projectId, { signal }),
  })
  // The page is mounted for one project (`key`), so where its run was left is read once, before it opens.
  const [leftAt] = React.useState(() => readLeftAt(projectId))
  // A project that is gone and one the user may not open read the same, as they did in the editor.
  const missing = query.error instanceof AuthClientError && (query.error.status === 404 || query.error.status === 403)
  const load: ProjectLoad = query.data
    ? { status: 'ready', project: query.data, leftAt }
    : { status: query.isError && !query.isFetching ? (missing ? 'not_found' : 'error') : 'loading' }
  const projectTitle = query.data?.title

  React.useEffect(() => {
    if (projectTitle !== undefined) openWorkTab({ kind: 'spark', id: projectId, title: projectTitle })
  }, [projectId, projectTitle])

  React.useEffect(() => {
    if (missing) closeWorkTab('spark', projectId)
  }, [missing, projectId])

  const rememberPhase = React.useCallback((phase: LabPhase) => writeLeftAt(projectId, phase), [projectId])
  const phase = load.status === 'ready' ? view.phase ?? load.leftAt : undefined

  return (
    <div className="relative h-full">
      {load.status === 'ready' ? (
        <SparkLab
          {...view}
          variant={phase && phase !== 'empty' ? view.variant : 'c'}
          phase={phase}
          ratio={view.ratio ?? load.project.aspectRatio}
          title={load.project.title}
          runKey={projectId}
          onPhase={view.phase ? undefined : rememberPhase}
          contained
        />
      ) : (
        <ProjectStatus
          status={load.status}
          onBack={() => router.push(PROJECTS_HREF)}
          onRetry={() => void query.refetch()}
        />
      )}
    </div>
  )
}

const NEW_PROJECT_PATH = '/spark/new'

/**
 * "Yeni proje" at `/spark/new`. The page stays mounted once its project is made (only the address changes, see
 * `NewProject`), so "+" coming back to `/spark/new` from there would find the same page with that project's run in
 * it: each return starts the next project afresh.
 */
export function SparkNewProjectPage({ channelId, view }: { channelId: string | null; view: LabView }) {
  const pathname = usePathname()
  const [round, setRound] = React.useState(0)
  const [lastPath, setLastPath] = React.useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (pathname === NEW_PROJECT_PATH) setRound((count) => count + 1)
  }
  return <NewProject key={round} channelId={channelId} view={view} />
}

/**
 * The workspace on Sohbet before a project exists. Nothing is made until the first sentence. With it the project
 * is created in `channelId`, named from the sentence and in the format chosen in the composer; the address then
 * becomes the project's own without leaving the page, so the run goes on, and the project opens as a tab, in the
 * new tab's place when it was started from there. Leaving before the first sentence leaves no project behind.
 */
function NewProject({ channelId, view }: { channelId: string | null; view: LabView }) {
  const t = useTranslations('Spark')
  const router = useRouter()
  const requested = React.useRef(false)
  const projectId = React.useRef<string | null>(null)
  const phase = React.useRef<LabPhase>('empty')

  // A project belongs to a channel; a link without one has nowhere to make it.
  React.useEffect(() => {
    if (!channelId) router.replace(PROJECTS_HREF)
  }, [channelId, router])

  const createFromFirstSentence = React.useCallback(
    ({ prompt, ratio }: { prompt: string; ratio: LabRatio }) => {
      if (!channelId || requested.current) return
      requested.current = true
      createSparkProject(channelId, { title: titleFromPrompt(prompt), aspectRatio: ratio, clientRequestId: crypto.randomUUID() }).then(
        (project) => {
          projectId.current = project.id
          writeLeftAt(project.id, phase.current)
          replaceWorkTab({ kind: 'spark', id: project.id, title: project.title })
          // The page stays: only the address changes, and with it what a reload or a shared link opens.
          const url = new URL(window.location.href)
          url.pathname = sparkProjectHref(project.id)
          url.searchParams.delete('channel')
          window.history.replaceState(null, '', url)
        },
        () => toast.error(t('create.failed')),
      )
    },
    [channelId, t],
  )

  const rememberPhase = React.useCallback((next: LabPhase) => {
    phase.current = next
    if (projectId.current) writeLeftAt(projectId.current, next)
  }, [])

  if (!channelId) return null
  return (
    <div className="relative h-full">
      <SparkLab {...view} onStart={createFromFirstSentence} onPhase={rememberPhase} contained />
    </div>
  )
}

/** The project is on its way, is not there, or did not load: the same three screens the editor had. */
function ProjectStatus({ status, onBack, onRetry }: { status: 'loading' | 'not_found' | 'error'; onBack: () => void; onRetry: () => void }) {
  const t = useTranslations('Spark.editor')
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      {status === 'loading' ? (
        // After a beat (`route-in`), so a quick read shows nothing at all instead of a flash.
        <div className="route-in flex flex-col items-center gap-4" role="status" aria-live="polite">
          <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center" role="alert">
          <p className="text-sm text-muted-foreground">{status === 'not_found' ? t('notFound') : t('loadFailed')}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" aria-hidden />
              {t('backToProjects')}
            </Button>
            {status === 'error' ? <Button onClick={onRetry}>{t('retry')}</Button> : null}
          </div>
        </div>
      )}
    </div>
  )
}
