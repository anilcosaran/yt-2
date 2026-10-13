'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { ScriptReviewHostProvider } from '@/components/chat/script-review/script-review-host'
import { Button } from '@/components/ui/button'
import { createSparkCompositionSession, type SparkCompositionState } from '@/lib/spark/composition-session'
import type { SparkEffectsSwitches } from '@/lib/spark/effects/effects-switches'
import { measureSparkOpenReady } from '@/lib/spark/spark-open-timing'

import { SparkEditorShell } from './spark-editor-shell'
import { hasUnsavedEdits, useUnsavedEditsWarning } from './use-unsaved-edits-warning'

const PROJECTS_HREF = '/spark'

/**
 * Full-screen Spark editor for one server-side project. The project and its Composition
 * working copy load together behind a spinner; the editor opens only once both exist and the
 * user can open them. Every edit goes through the Composition command API.
 */
export function SparkEditorPage({
  projectId,
  exportEnabled = false,
  stageEnabled = false,
  motionEnabled = false,
  optimisticEnabled = false,
  effects,
  contextMeterEnabled = false,
  contextToolbarEnabled = false,
  timelineEditing = false,
  redoEnabled = false,
  liveFx = false,
  motionCodeEnabled = false,
}: {
  projectId: string
  exportEnabled?: boolean
  stageEnabled?: boolean
  /** E1-D: the Motion tool switch (`MOTION_UI_ENABLED`). */
  motionEnabled?: boolean
  /** E1-N: edits are applied to the editor's own copy first and saved in the background (`SPARK_OPTIMISTIC_EDITING_ENABLED`). */
  optimisticEnabled?: boolean
  /** Spark effects: the Transitions browser and the Animations panel switches (`lib/spark/effects/effects-switches.ts`). */
  effects?: SparkEffectsSwitches
  /** The side chat's context ring (`SPARK_CONTEXT_METER_ENABLED`, `lib/spark/context-meter-switch.ts`). */
  contextMeterEnabled?: boolean
  /** The contextual toolbar of the stage (`SPARK_CONTEXT_TOOLBAR_ENABLED`). */
  contextToolbarEnabled?: boolean
  /** Timeline v2 (`SPARK_TIMELINE_EDITING_ENABLED`, `lib/spark/timeline/timeline-switch.ts`). */
  timelineEditing?: boolean
  /** Spark redo (`SPARK_REDO_ENABLED`, `lib/spark/history/redo-switch.ts`): the Redo button and Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y. */
  redoEnabled?: boolean
  /** Live FX preview (`SPARK_LIVE_FX_PREVIEW_ENABLED`, `lib/spark/stage/live-fx-switch.ts`). */
  liveFx?: boolean
  /** The Code tab and the Assistant's direct apply (`SPARK_MOTION_CODE_TAB_ENABLED`, `lib/spark/motion-code/motion-code-switch.ts`). */
  motionCodeEnabled?: boolean
}) {
  const t = useTranslations('Spark.editor')
  const router = useRouter()
  const [session] = React.useState(() => createSparkCompositionSession({ projectId, optimistic: optimisticEnabled, redo: redoEnabled }))
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)

  React.useEffect(() => {
    void session.load()
    // E1-N: leaving the editor (in-app navigation included) still sends the edits the user already saw on the canvas.
    return () => session.close()
  }, [session])

  // E1-N: an edit that is not on the server yet lives only in this tab: closing it asks first.
  useUnsavedEditsWarning(hasUnsavedEdits(state))

  const backToProjects = React.useCallback(() => router.push(PROJECTS_HREF), [router])
  // Y1-07 W9: "Open in Chat" continues the project's linked conversation on the Chat page.
  const openChat = React.useCallback((path: string) => router.push(path), [router])

  // P03-13: an explicit open from Chat is measured to the editor showing the project (no media wait).
  const ready = state.status === 'ready'
  React.useEffect(() => {
    if (ready) measureSparkOpenReady()
  }, [ready])

  if (state.status === 'ready' && state.project && state.workingCopy) {
    return (
      <ScriptReviewHostProvider>
        <SparkEditorShell
          project={state.project}
          composition={state}
          actions={session}
          backLabel={t('backToProjects')}
          onBack={backToProjects}
          onOpenChat={openChat}
          exportEnabled={exportEnabled}
          stageEnabled={stageEnabled}
          motionEnabled={motionEnabled}
          contextToolbarEnabled={contextToolbarEnabled}
          {...(effects && { effects })}
          contextMeterEnabled={contextMeterEnabled}
          timelineEditing={timelineEditing}
          liveFx={liveFx}
          motionCodeEnabled={motionCodeEnabled}
        />
      </ScriptReviewHostProvider>
    )
  }

  return (
    <SparkEditorStatus
      status={state.status}
      onBack={backToProjects}
      onRetry={() => void session.load()}
    />
  )
}

export function SparkEditorStatus({
  status,
  onBack,
  onRetry,
}: {
  status: SparkCompositionState['status']
  onBack: () => void
  onRetry: () => void
}) {
  const t = useTranslations('Spark.editor')
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      {status === 'loading' || status === 'ready' ? (
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      ) : (
        <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center" role="alert">
          <p className="text-sm text-muted-foreground">
            {status === 'not_found' ? t('notFound') : t('loadFailed')}
          </p>
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
