'use client'

import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

export type StorageUploadFingerprint = {
  checksumSha256: string
  idempotencyKey: string
}

export async function createStorageUploadFingerprint(input: {
  channelId: string
  parentPath?: string
  file: File
  signal?: AbortSignal
}): Promise<StorageUploadFingerprint> {
  const checksumSha256 = await calculateFileSha256(input.file, input.signal)
  const identity = [
    input.channelId,
    input.parentPath ?? '',
    input.file.name,
    input.file.type || 'application/octet-stream',
    String(input.file.size),
    checksumSha256,
  ].join('\u0000')

  return {
    checksumSha256,
    idempotencyKey: `storage-upload:sha256:${bytesToHex(sha256(new TextEncoder().encode(identity)))}`,
  }
}

export async function calculateFileSha256(file: File, signal?: AbortSignal) {
  throwIfAborted(signal)
  if (typeof file.stream === 'function') {
    try {
      return await hashFileStream(file, signal)
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  throwIfAborted(signal)
  const buffer = new Uint8Array(await file.arrayBuffer())
  throwIfAborted(signal)
  return bytesToHex(sha256(buffer))
}

async function hashFileStream(file: File, signal?: AbortSignal) {
  const hasher = sha256.create()
  const reader = file.stream().getReader()
  const onAbort = () => {
    void reader.cancel()
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    while (true) {
      const chunk = await reader.read()
      throwIfAborted(signal)
      if (chunk.done) break
      hasher.update(chunk.value)
    }
    return bytesToHex(hasher.digest())
  } finally {
    signal?.removeEventListener('abort', onAbort)
    reader.releaseLock()
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Upload aborted.', 'AbortError')
}
