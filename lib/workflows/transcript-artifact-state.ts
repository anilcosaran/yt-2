export const TRANSCRIPT_ARTIFACT_STALE_AFTER_MS = 30 * 60_000

type TranscriptArtifactState = {
  status: string
  updated_at: string
}

export function isActiveTranscriptArtifact(artifact: TranscriptArtifactState) {
  return artifact.status === 'processing' || artifact.status === 'deleting'
}

export function isStaleTranscriptArtifact(
  artifact: TranscriptArtifactState,
  nowMs = Date.now(),
) {
  if (!isActiveTranscriptArtifact(artifact)) return false
  const updatedAtMs = Date.parse(artifact.updated_at)
  return Number.isFinite(updatedAtMs)
    && Math.max(0, nowMs - updatedAtMs) >= TRANSCRIPT_ARTIFACT_STALE_AFTER_MS
}

export function blocksTranscriptMutation(
  artifact: TranscriptArtifactState,
  nowMs = Date.now(),
) {
  return isActiveTranscriptArtifact(artifact) && !isStaleTranscriptArtifact(artifact, nowMs)
}
