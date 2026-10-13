/**
 * P03-13: the client side of the two Spark open latencies. `spark-open-ready` runs from the user's explicit
 * open (chat "Open in Spark" / "Continue in Spark") to the editor showing the project; it never includes
 * probe, proxy or render waits (the server's `composition_spark_entry_settle_seconds` measures those).
 * Performance entries only: nothing is stored, and a missing Performance API is a no-op.
 */
export const SPARK_OPEN_REQUESTED_MARK = 'spark-open-requested'
export const SPARK_OPEN_READY_MEASURE = 'spark-open-ready'

type PerformanceLike = Pick<Performance, 'mark' | 'measure' | 'getEntriesByName' | 'clearMarks'>

function perf(): PerformanceLike | null {
  return typeof performance !== 'undefined' && typeof performance.mark === 'function' ? performance : null
}

export function markSparkOpenRequested(api: PerformanceLike | null = perf()): void {
  if (!api) return
  api.clearMarks(SPARK_OPEN_REQUESTED_MARK)
  api.mark(SPARK_OPEN_REQUESTED_MARK)
}

/**
 * Called once when the editor shows the project. Returns the ready latency in ms, or null when the editor
 * was not opened through an explicit Spark open in this page (a deep link or a reload is not measured).
 */
export function measureSparkOpenReady(api: PerformanceLike | null = perf()): number | null {
  if (!api || api.getEntriesByName(SPARK_OPEN_REQUESTED_MARK, 'mark').length === 0) return null
  const measure = api.measure(SPARK_OPEN_READY_MEASURE, SPARK_OPEN_REQUESTED_MARK)
  api.clearMarks(SPARK_OPEN_REQUESTED_MARK)
  return measure && typeof measure.duration === 'number' ? Math.round(measure.duration) : null
}
