'use client'

import * as React from 'react'

import type { CompositionDocument } from '@/lib/spark/composition-client'
import type { SparkCompositionActions } from '@/lib/spark/composition-session'
import {
  applyAssistantMotionRevision,
  assistantApplyEligible,
  type AssistantApplyDeps,
  type AssistantApplyResult,
  type AssistantApplyTarget,
} from '@/lib/spark/motion-code/motion-assistant-apply'
import type { MotionRepointOutcome } from '@/lib/spark/motion-code/motion-repoint-run'
import { motionLayerViewOf } from '@/lib/spark/motion-layers'
import type { MotionResult } from '@/lib/spark/motion-result'
import type { SparkChatEntry } from '@/lib/spark/spark-side-chat'

/**
 * Assistant direct apply, the editor side (owner decision 2026-10-04, see `motion-assistant-apply.ts`): remembers which Motion
 * layer was selected when a chat message was sent and, when a FRESH closing card of the conversation carries a revision made
 * from that layer's Motion, applies it to that layer at once. "Fresh" = the card arrived after the transcript was loaded in this
 * editor session: opening a project never re-applies old cards, and an Undo is never undone again by a tab switch (each card is
 * handled once; the result lives here, in the shell, not in the pane that comes and goes).
 */

export type AssistantMotionApplyNotice = { kind: 'refused' | 'failed'; reason: string | null }

export function useAssistantMotionApply(input: {
  enabled: boolean
  projectId: string
  /** The side chat is loaded: entries present now are the baseline, never applied. */
  ready: boolean
  entries: readonly SparkChatEntry[]
  document: CompositionDocument | null
  apply: SparkCompositionActions['apply']
  /** The layer now holds the revision: select it, remember the way back. */
  onApplied: (outcome: Extract<MotionRepointOutcome, { status: 'applied' }>) => void
  onNotice: (notice: AssistantMotionApplyNotice) => void
  deps?: Partial<Pick<AssistantApplyDeps, 'getDraft' | 'listRevisions' | 'loadExposure' | 'uuid'>>
}) {
  const [overrides, setOverrides] = React.useState<ReadonlyMap<string, MotionResult>>(() => new Map())
  const target = React.useRef<AssistantApplyTarget | null>(null)
  const baseline = React.useRef<Set<string> | null>(null)
  const handled = React.useRef<Set<string>>(new Set())
  const latest = React.useRef(input)
  React.useLayoutEffect(() => {
    latest.current = input
  })

  /** Called when a message is sent: the selected Motion layer (or none) is what a revision card of its answer is about. */
  const noteTarget = React.useCallback((next: AssistantApplyTarget | null) => {
    target.current = next
  }, [])

  const run = React.useCallback(async (entryId: string, card: MotionResult, pinned: AssistantApplyTarget) => {
    const current = latest.current
    const result: AssistantApplyResult = await applyAssistantMotionRevision(
      { result: card, target: pinned },
      {
        ...current.deps,
        projectId: current.projectId,
        // The newest document at the moment each step runs (the plan is never built from the one of the click).
        document: () => latest.current.document,
        apply: (specs, options) => latest.current.apply(specs, options),
        layerView: (sceneId, layerId) => motionLayerViewOf(latest.current.document, sceneId, layerId),
      },
    )
    if (result.status === 'applied') {
      // One revision answers one message: the next message names its own layer.
      if (target.current === pinned) target.current = null
      setOverrides((map) => new Map(map).set(entryId, result.result))
      latest.current.onApplied(result.outcome)
    } else if (result.status === 'refused' || result.status === 'failed') {
      latest.current.onNotice({ kind: result.status, reason: result.outcome.status === 'refused' ? result.outcome.refusal.reason : result.outcome.status === 'failed' ? result.outcome.stage : null })
    }
  }, [])

  const { ready, entries } = input
  React.useEffect(() => {
    if (!ready) return
    if (baseline.current === null) {
      baseline.current = new Set(entries.map((entry) => entry.id))
      return
    }
    for (const entry of entries) {
      const card = entry.motionResult
      if (!card || baseline.current.has(entry.id) || handled.current.has(entry.id)) continue
      handled.current.add(entry.id)
      const pinned = target.current
      if (!latest.current.enabled || !assistantApplyEligible(card) || !pinned) continue
      void run(entry.id, card, pinned)
    }
  }, [ready, entries, run])

  return { overrides, noteTarget }
}
