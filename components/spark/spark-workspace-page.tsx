'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AuthClientError } from '@/lib/auth/errors'
import { createSparkProject, getSparkProject, sparkProjectHref, type SparkProject } from '@/lib/spark/api'

import { titleFromPrompt, type LabPhase, type LabRatio, type LabView } from './lab/lab-model'
import { SparkLab } from './lab/spark-lab'

const PROJECTS_HREF = '/spark'

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
 * One Spark project, in the workspace (`./lab`): Sohbet, Plan and Editör. The project loads behind a spinner and
 * the workspace opens once it exists and the user can open it; its name and format are the project's own. A new
 * project has nothing in it yet, so it opens on Sohbet, where it is described in one sentence.
 *
 * Only the project itself is read from the gateway. What happens in the workspace is the scripted run of the
 * design prototype: it does not read or write the project's composition.
 */
export function SparkWorkspacePage({ projectId, view }: { projectId: string; view: LabView }) {
  const router = useRouter()
  const [load, setLoad] = React.useState<ProjectLoad>({ status: 'loading' })
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    getSparkProject(projectId, { signal: controller.signal }).then(
      (project) => setLoad({ status: 'ready', project, leftAt: readLeftAt(projectId) }),
      (error: unknown) => {
        if (controller.signal.aborted) return
        // A project that is gone and one the user may not open read the same, as they did in the editor.
        const missing = error instanceof AuthClientError && (error.status === 404 || error.status === 403)
        setLoad({ status: missing ? 'not_found' : 'error' })
      },
    )
    return () => controller.abort()
  }, [projectId, attempt])

  const rememberPhase = React.useCallback((phase: LabPhase) => writeLeftAt(projectId, phase), [projectId])

  if (load.status === 'ready') {
    return (
      <SparkLab
        {...view}
        phase={view.phase ?? load.leftAt}
        ratio={view.ratio ?? load.project.aspectRatio}
        title={load.project.title}
        runKey={projectId}
        onPhase={view.phase ? undefined : rememberPhase}
      />
    )
  }

  return (
    <ProjectStatus
      status={load.status}
      onBack={() => router.push(PROJECTS_HREF)}
      onRetry={() => {
        setLoad({ status: 'loading' })
        setAttempt((count) => count + 1)
      }}
    />
  )
}

/**
 * "Yeni proje": the workspace on Sohbet before a project exists. Nothing is made until the first sentence. With
 * it the project is created in `channelId`, named from the sentence and in the format chosen in the composer;
 * the address then becomes the project's own without leaving the page, so the run goes on. Leaving before the
 * first sentence leaves no project behind.
 */
export function SparkNewProjectPage({ channelId, view }: { channelId: string | null; view: LabView }) {
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
  return <SparkLab {...view} onStart={createFromFirstSentence} onPhase={rememberPhase} />
}

/** The project is on its way, is not there, or did not load: the same three screens the editor had. */
function ProjectStatus({ status, onBack, onRetry }: { status: 'loading' | 'not_found' | 'error'; onBack: () => void; onRetry: () => void }) {
  const t = useTranslations('Spark.editor')
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      {status === 'loading' ? (
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
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
