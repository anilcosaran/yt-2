'use client'

import * as React from 'react'

/**
 * P03-20 where "Planı gör" opens the plan (KARAR 8A): the main Chat hosts it as its right panel (the plan canvas), the
 * Spark editor as a temporary cover of its preview + timeline area. The host only knows which job's plan is open; the
 * surface rendered by the host loads the owner data, autosaves and closes itself after the save acknowledgement.
 * A plan that becomes ready opens by itself once (`autoOpen`), like Spark's Plan view; it never replaces a plan the
 * user opened, and a plan the user closed stays closed until they open it again. State lives in memory only.
 */

export interface ScriptReviewTarget {
  projectId: string
  jobId: string
}

export interface ScriptReviewHost {
  target: ScriptReviewTarget | null
  /** Opens the job's script; another open script is closed first (flush + ACK), a failed save keeps it open. */
  open(target: ScriptReviewTarget): void
  /** A plan became ready: open it unless another plan is open or the user already closed this one. */
  autoOpen(target: ScriptReviewTarget): void
  /** Asks the open surface to save and close (the same path as its Close button). */
  requestClose(): void
}

interface ScriptReviewHostInternal extends ScriptReviewHost {
  /** Called by the surface once its pending edits were acknowledged. */
  closed(target: ScriptReviewTarget): void
  /** The surface's save-then-close routine; resolves true when it closed. */
  registerCloser(closer: () => Promise<boolean>): () => void
}

const ScriptReviewHostContext = React.createContext<ScriptReviewHostInternal | null>(null)

/** The host of this surface (Chat panel or Spark cover); null where no script review can open. */
export function useScriptReviewHost(): ScriptReviewHost | null {
  return React.useContext(ScriptReviewHostContext)
}

export function useScriptReviewHostInternal(): ScriptReviewHostInternal | null {
  return React.useContext(ScriptReviewHostContext)
}

export function sameScriptReviewTarget(left: ScriptReviewTarget | null, right: ScriptReviewTarget | null): boolean {
  return Boolean(left && right && left.projectId === right.projectId && left.jobId === right.jobId)
}

export function ScriptReviewHostProvider({
  children,
  onOpen,
  handleRef,
  initialTarget = null,
  resetKey,
}: {
  children: React.ReactNode
  /** e.g. the main Chat closes its workflow canvas panel: one right panel at a time. */
  onOpen?: () => void
  /** Lets the page close the review from outside the provider (e.g. when it opens another right panel). */
  handleRef?: React.Ref<ScriptReviewHost>
  /** Test/SSR seed; the product always opens by an explicit click. */
  initialTarget?: ScriptReviewTarget | null
  /** A new value (e.g. another conversation) closes the review; the surface still sends its pending patch. */
  resetKey?: string
}) {
  const [target, setTarget] = React.useState<ScriptReviewTarget | null>(initialTarget)
  const [scope, setScope] = React.useState(resetKey)
  if (scope !== resetKey) {
    setScope(resetKey)
    setTarget(null)
  }
  const closerRef = React.useRef<(() => Promise<boolean>) | null>(null)
  // Plans the user closed (or that already opened by themselves) in this session: autoOpen leaves them alone.
  const settledRef = React.useRef(new Set<string>())
  const onOpenRef = React.useRef(onOpen)
  React.useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])

  const value = React.useMemo<ScriptReviewHostInternal>(() => ({
    target,
    open(next) {
      const current = target
      if (sameScriptReviewTarget(current, next)) return
      const show = () => {
        onOpenRef.current?.()
        setTarget(next)
      }
      const closer = closerRef.current
      if (!current || !closer) {
        show()
        return
      }
      void closer().then((closed) => { if (closed) show() })
    },
    autoOpen(next) {
      const key = `${next.projectId}:${next.jobId}`
      if (target || settledRef.current.has(key)) return
      settledRef.current.add(key)
      onOpenRef.current?.()
      setTarget(next)
    },
    requestClose() {
      const closer = closerRef.current
      if (closer) {
        void closer()
        return
      }
      if (target) settledRef.current.add(`${target.projectId}:${target.jobId}`)
      setTarget(null)
    },
    closed(closedTarget) {
      settledRef.current.add(`${closedTarget.projectId}:${closedTarget.jobId}`)
      setTarget((current) => (sameScriptReviewTarget(current, closedTarget) ? null : current))
    },
    registerCloser(closer) {
      closerRef.current = closer
      return () => {
        if (closerRef.current === closer) closerRef.current = null
      }
    },
  }), [target])

  React.useImperativeHandle(handleRef, () => value, [value])

  return <ScriptReviewHostContext.Provider value={value}>{children}</ScriptReviewHostContext.Provider>
}
