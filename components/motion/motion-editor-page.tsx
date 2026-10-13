'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { parseMotionEditorRoute } from '@/lib/motion-editor/resource'
import { MotionEditorSession } from '@/lib/motion-editor/session'

import { MotionChatPane } from './motion-chat-pane'
import { MotionEditorShell } from './motion-editor-shell'
import { MotionEditorStatus } from './motion-status-view'

const LIBRARY_HREF = '/motion'

/**
 * P06-02 full-screen Motion authoring page for one private draft. The route parameter is checked first (a malformed id
 * is an explicit invalid state, nothing is read); the draft then loads behind a spinner and the editor opens only once
 * the server answered. A missing, forbidden or closed resource stops at its own state — no default Motion opens.
 */
export function MotionEditorPage({ draftId }: { draftId: string }) {
  const route = parseMotionEditorRoute(draftId)
  if (!route.ok) return <MotionEditorStatus status="invalid" onBack={() => undefined} onRetry={() => undefined} />
  return <MotionEditorPageBody draftId={route.draftId} />
}

function MotionEditorPageBody({ draftId }: { draftId: string }) {
  const router = useRouter()
  const [session] = React.useState(() => new MotionEditorSession({ draftId }))
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)

  React.useEffect(() => {
    void session.load()
    return () => session.abort()
  }, [session])

  const backToLibrary = React.useCallback(() => router.push(LIBRARY_HREF), [router])

  if (state.status === 'ready' && state.draft) {
    return (
      <MotionEditorShell
        state={state}
        actions={{
          saveSource: (text) => void session.saveSource(text),
          setTestValues: (values) => void session.setTestValues(values),
          setViewpoint: (view) => void session.setViewpoint(view),
          validate: () => void session.validate(),
          archive: () => void session.archive(),
          publish: () => void session.publish(),
          openCodePanel: session.openCodePanel,
          closeCodePanel: session.closeCodePanel,
        }}
        chat={(
          <MotionChatPane
            draftId={state.draft.draft_id}
            title={state.draft.name}
            draftVersion={state.draft.draft.version}
            onDraftMayHaveChanged={session.reloadDraft}
          />
        )}
      />
    )
  }
  return <MotionEditorStatus status={state.status} onBack={backToLibrary} onRetry={() => void session.load()} />
}
