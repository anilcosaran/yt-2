import type { CompositionMotionEnergy, CompositionMotionRevisionRef } from './composition-typed-edits'
import { loadMotionExposureShared, type MotionOverlayBlock } from './motion-exposure'

/**
 * E1-D: which Motions cannot sit over other layers (E1-C). The gateway's scene compiler refuses an overlay of a Motion that
 * drives a camera (`motion_overlay_camera_not_supported`), follows word or beat timing (`motion_overlay_anchor_not_supported`)
 * or draws content it does not stage (`motion_content_not_staged`): that Motion must stay its own scene ("Add as new
 * scene"). The answer belongs to the immutable revision (its manifest digest), so it is remembered per digest for the
 * page's lifetime: a Motion learned to be own-scene-only is shown so on its card and never written as an overlay again.
 *
 * Two ways to learn it: the typed source of the revision is read once before the first overlay (`ensureOverlaySupport`), and
 * the preview's per-layer warning of a written overlay is the authority when the scan could not tell (`rememberOverlayBlock`).
 * Server-derived knowledge only; nothing is stored in the browser.
 */

export type OverlayBlock = MotionOverlayBlock | 'anchor'

const blocked = new Map<string, OverlayBlock>()
const readable = new Set<string>()
/** WP4: the energies a revision offers, learned from the same typed-source read (absent = not known). */
const energies = new Map<string, readonly CompositionMotionEnergy[]>()
const pending = new Map<string, Promise<OverlayBlock | null>>()
const listeners = new Set<() => void>()
let version = 0

function changed(): void {
  version += 1
  for (const listener of [...listeners]) listener()
}

/** What is known about this revision: why it cannot be an overlay, or null (it can, or nothing is known yet). */
export function overlayBlockFor(manifestSha256: string): OverlayBlock | null {
  return blocked.get(manifestSha256) ?? null
}

export function rememberOverlayBlock(manifestSha256: string, block: OverlayBlock): void {
  if (blocked.get(manifestSha256) === block) return
  blocked.set(manifestSha256, block)
  changed()
}

export const subscribeOverlaySupport = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Snapshot for `useSyncExternalStore`: changes whenever something was learned. */
export const overlaySupportVersion = () => version

/**
 * Reads the revision's typed source once (immutable by digest) and remembers whether it can be an overlay. A read that fails
 * answers null and is retried next time: the gateway's per-layer warning after the write stays the authority.
 */
export async function ensureOverlaySupport(ref: CompositionMotionRevisionRef, load: typeof loadMotionExposureShared = loadMotionExposureShared): Promise<OverlayBlock | null> {
  const sha = ref.manifest_sha256
  const known = blocked.get(sha)
  if (known) return known
  if (readable.has(sha)) return null
  const running = pending.get(sha)
  if (running) return running
  const task = load(ref)
    .then((exposure) => {
      readable.add(sha)
      const offered = exposure.energies
      if (offered) energies.set(sha, [...offered])
      if (exposure.overlayBlock) rememberOverlayBlock(sha, exposure.overlayBlock)
      else if (offered) changed()
      return exposure.overlayBlock
    })
    .catch(() => null)
    .finally(() => pending.delete(sha))
  pending.set(sha, task)
  return task
}

/** WP4: the energies this revision offers when its typed source was read (null = not known: the server picks one it offers). */
export function revisionEnergies(manifestSha256: string): readonly CompositionMotionEnergy[] | null {
  return energies.get(manifestSha256) ?? null
}

/**
 * WP4: reads the typed source of these revisions in the background when the Motion drawer opens (a few at a time, each once
 * per page: immutable by digest), so a card that cannot be an overlay says so before anyone clicks it and the "+" never
 * waits for that read. Stops starting new reads once `signal` aborts (the drawer closed); a read already running finishes.
 */
export async function prefetchOverlaySupport(
  refs: readonly CompositionMotionRevisionRef[],
  options: { signal?: AbortSignal; concurrency?: number; load?: typeof loadMotionExposureShared } = {},
): Promise<void> {
  const queue = refs.filter((ref, index) => refs.findIndex((other) => other.manifest_sha256 === ref.manifest_sha256) === index)
  const workers = Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 3, queue.length)) }, async () => {
    for (let ref = queue.shift(); ref; ref = queue.shift()) {
      if (options.signal?.aborted) return
      await ensureOverlaySupport(ref, options.load)
    }
  })
  await Promise.all(workers)
}

export function resetOverlaySupportForTests(): void {
  blocked.clear()
  readable.clear()
  pending.clear()
  energies.clear()
  changed()
}
