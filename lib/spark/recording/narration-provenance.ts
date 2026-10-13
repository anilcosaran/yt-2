import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

/**
 * `narration_provenance` of a narration the user RECORDED (E1-F Voice only): `source_mode: supplied_audio`, a ready
 * recording that is never regenerated without an explicit convert (P06-27). The digest mirrors the gateway's
 * `narrationSpecDigest` for supplied audio (`composition/domain/narration/narration-slot.ts`): SHA-256 of
 * `JSON.stringify(["narration-spec-v1", "supplied_audio", source_id])`; it depends on the source only, so it is the same
 * for the same recording whatever else changes in the scene.
 */
export const NARRATION_SPEC_DIGEST_VERSION = 'narration-spec-v1'

export function suppliedAudioProvenance(sourceId: string): { source_mode: 'supplied_audio'; spec_sha256: string } {
  const digest = sha256(new TextEncoder().encode(JSON.stringify([NARRATION_SPEC_DIGEST_VERSION, 'supplied_audio', sourceId])))
  return { source_mode: 'supplied_audio', spec_sha256: bytesToHex(digest) }
}
