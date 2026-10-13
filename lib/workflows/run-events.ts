import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'

/**
 * LAT-03 run event push. The gateway streams change hints for the tenant's runs (SSE); the UI refetches the
 * status endpoint of the run named in the hint. Polling stays the safety net: while the stream is connected the
 * status poll interval is stretched to `RUN_EVENTS_SAFETY_POLL_MS`, and any failure falls back to normal polling.
 * The stream exists only when the gateway's WORKFLOW_RUN_EVENTS_SSE_ENABLED is on; otherwise it fails at once and
 * the UI keeps polling, so the UI needs no switch of its own.
 */
export const RUN_EVENTS_SAFETY_POLL_MS = 45_000
/** Reconnect delays after the browser gave up on the stream (non-200, 503, closed connection). */
export const RUN_EVENTS_RECONNECT_DELAYS_MS = [5_000, 15_000, 60_000, 120_000] as const

export interface WorkflowRunEventMessage {
  workflowId: string
  kind: 'status' | 'node' | 'runtime_event'
  status: string | null
  nodeKey: string | null
  nodeStatus: string | null
  occurredAt: string | null
}

export function getWorkflowRunEventsUrl() {
  return `${getYoutorchApiBaseUrl()}/api/v1/workflows/events`
}

export function parseWorkflowRunEventMessage(data: string): WorkflowRunEventMessage | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    const workflowId = typeof record.workflowId === 'string' ? record.workflowId.trim() : ''
    const kind = record.kind
    if (!workflowId || (kind !== 'status' && kind !== 'node' && kind !== 'runtime_event')) return null
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)
    return {
      workflowId,
      kind,
      status: text(record.status),
      nodeKey: text(record.nodeKey),
      nodeStatus: text(record.nodeStatus),
      occurredAt: text(record.occurredAt),
    }
  } catch {
    return null
  }
}

/** Stretches a running poll to the safety interval while the push stream is connected. */
export function withRunEventsSafetyPoll(interval: number | false, connected: boolean): number | false {
  if (!connected || interval === false) return interval
  return Math.max(interval, RUN_EVENTS_SAFETY_POLL_MS)
}

/** The parts of a browser EventSource the connection uses (a fake in tests). */
export interface RunEventSourceLike {
  readonly readyState: number
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void
  close(): void
}

export interface WorkflowRunEventsConnectionOptions {
  createSource: () => RunEventSourceLike
  onEvent: (event: WorkflowRunEventMessage) => void
  onConnectedChange: (connected: boolean) => void
  /** Called on every (re)connect: hints sent while disconnected are lost, so callers refetch. */
  onReady?: () => void
  setTimer?: (callback: () => void, delayMs: number) => unknown
  clearTimer?: (handle: unknown) => void
  reconnectDelaysMs?: readonly number[]
}

const EVENT_SOURCE_CLOSED = 2

/** Framework-free connection state machine behind `useWorkflowRunEvents`. */
export class WorkflowRunEventsConnection {
  private source: RunEventSourceLike | null = null
  private timer: unknown = null
  private attempt = 0
  private connected = false
  private stopped = true

  constructor(private readonly options: WorkflowRunEventsConnectionOptions) {}

  start() {
    if (!this.stopped) return
    this.stopped = false
    this.open()
  }

  stop() {
    this.stopped = true
    this.clearTimer()
    this.source?.close()
    this.source = null
    this.setConnected(false)
  }

  private open() {
    if (this.stopped) return
    let source: RunEventSourceLike
    try {
      source = this.options.createSource()
    } catch {
      this.scheduleReconnect()
      return
    }
    this.source = source
    source.addEventListener('ready', () => {
      if (this.source !== source) return
      this.attempt = 0
      this.setConnected(true)
      this.options.onReady?.()
    })
    source.addEventListener('run', (message) => {
      if (this.source !== source) return
      const event = parseWorkflowRunEventMessage(message.data)
      if (event) this.options.onEvent(event)
    })
    source.addEventListener('error', () => {
      if (this.source !== source) return
      // Fall back to normal polling at once; the browser may still reconnect on its own.
      this.setConnected(false)
      if (source.readyState === EVENT_SOURCE_CLOSED) {
        source.close()
        this.source = null
        this.scheduleReconnect()
      }
    })
  }

  private scheduleReconnect() {
    if (this.stopped || this.timer !== null) return
    const delays = this.options.reconnectDelaysMs ?? RUN_EVENTS_RECONNECT_DELAYS_MS
    const delay = delays[Math.min(this.attempt, delays.length - 1)] ?? RUN_EVENTS_RECONNECT_DELAYS_MS[0]
    this.attempt += 1
    const setTimer = this.options.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms))
    this.timer = setTimer(() => {
      this.timer = null
      this.open()
    }, delay)
  }

  private clearTimer() {
    if (this.timer === null) return
    const clearTimer = this.options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>))
    clearTimer(this.timer)
    this.timer = null
  }

  private setConnected(connected: boolean) {
    if (this.connected === connected) return
    this.connected = connected
    this.options.onConnectedChange(connected)
  }
}
