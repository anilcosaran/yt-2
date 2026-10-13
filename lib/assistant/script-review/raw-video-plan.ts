/**
 * P04-21 slice 3 (raw video): which page the Plan view shows for a job. A job with a script is the script review; a job
 * without one (an uploaded video) is the same page with only the publish package section, when the job has a package.
 * Pure: the surface reads the owner data behind a loading state and asks here what to render (no local copy).
 */

export type RawVideoPlanState =
  /** The job has a script (or its read has not finished or failed): the script review decides. */
  | 'not_raw'
  /** The job has no script and its package is being read. */
  | 'loading'
  /** The job has no script and has a publish package: the plan is the package alone. */
  | 'raw_video'
  /** The job has no script and no readable package: "this job has no script yet". */
  | 'empty'

export function rawVideoPlanState(input: {
  /** The script review read finished without error. */
  reviewSucceeded: boolean
  hasScript: boolean
  /** The package read: not started/pending, failed, or its outcome (`absent`: none, closed gate or no access). */
  packageRead: 'idle' | 'pending' | 'error' | 'ok' | 'absent'
}): RawVideoPlanState {
  if (!input.reviewSucceeded || input.hasScript) return 'not_raw'
  if (input.packageRead === 'idle' || input.packageRead === 'pending') return 'loading'
  return input.packageRead === 'ok' ? 'raw_video' : 'empty'
}
