/**
 * P05-11 test support: a seeded random source (tests must not use Math.random or the wall clock) and helpers the
 * working-set tests share. Not imported by application code.
 */

/** mulberry32: a small deterministic generator; the same seed always gives the same sequence. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** A manual clock: time moves only when the test says so. */
export function manualClock(startMs = 1_700_000_000_000) {
  let now = startMs
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms
      return now
    },
    set: (ms: number) => {
      now = ms
    },
  }
}

/** Nearest-rank percentile (the P07-13 statistic): the value at rank ceil(p * n / 100) of the sorted samples. */
export function nearestRank(samples: readonly number[], percentile: number): number {
  if (samples.length === 0) throw new RangeError('no samples')
  const ordered = [...samples].sort((a, b) => a - b)
  const rank = Math.ceil((percentile * ordered.length) / 100)
  return ordered[Math.max(1, rank) - 1]!
}
