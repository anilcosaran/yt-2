import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'

import type { SparkPreviewFontFace, SparkPreviewManifest } from './preview-client'

/**
 * Y1-07 W2: loads the pinned platform font faces the preview draws text with. The gateway lays text out once with
 * exactly these faces (`scene_compiler@1`, the browser never re-wraps), so the first frame of a scene must not be
 * painted before every face it uses is in `document.fonts` (K241 "no frame before the font is ready"), and a face that
 * cannot be loaded is an explicit failure, never a silent fallback to another font (F45).
 *
 * Faces are content-addressed (`url` names the sha256): the bytes are fetched once per face, verified against that
 * sha256 (a CDN or proxy cannot swap a face), registered with the FontFace API and remembered for the page's lifetime.
 */

export class SparkFontLoadError extends Error {
  constructor(
    readonly faces: readonly SparkPreviewFontFace[],
    readonly reason: 'fetch_failed' | 'checksum_mismatch' | 'decode_failed',
  ) {
    super(`Font ${faces.map((face) => `${face.family} ${face.weight}`).join(', ')} could not be loaded (${reason})`)
    this.name = 'SparkFontLoadError'
  }
}

export type SparkFontLoader = {
  /** Loads the faces into `document.fonts`; resolves when all are ready. Rejects with SparkFontLoadError (no fallback). */
  ensure(faces: readonly SparkPreviewFontFace[]): Promise<void>
  isLoaded(face: Pick<SparkPreviewFontFace, 'sha256'>): boolean
  /**
   * E1-N: the verified bytes of a loaded face (the text engine of the browser's local preview lays text out against the
   * pinned font file itself), or null while it is not loaded.
   */
  bytes?(sha256: string): Uint8Array | null
}

type FontFaceLike = { load(): Promise<unknown> }
type FontFaceConstructor = new (family: string, source: ArrayBuffer, descriptors?: { weight?: string; style?: string; display?: string }) => FontFaceLike
type FontSetLike = { add(face: never): unknown }

export type SparkFontLoaderOptions = {
  fetcher?: typeof fetch
  fontSet?: FontSetLike
  FontFaceCtor?: FontFaceConstructor
  /** Origin of the gateway; default the same base URL the gateway client uses. */
  baseUrl?: string
  /** Verifies the bytes; default SubtleCrypto SHA-256. */
  sha256Hex?: (bytes: ArrayBuffer) => Promise<string>
}

async function subtleSha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createSparkFontLoader(options: SparkFontLoaderOptions = {}): SparkFontLoader {
  const loaded = new Set<string>()
  const inflight = new Map<string, Promise<void>>()
  const verified = new Map<string, Uint8Array>()

  const loadOne = async (face: SparkPreviewFontFace): Promise<void> => {
    const fetcher = options.fetcher ?? fetch
    const baseUrl = options.baseUrl ?? getYoutorchApiBaseUrl()
    let bytes: ArrayBuffer
    try {
      const response = await fetcher(`${baseUrl}${face.url}`, { credentials: 'include' })
      if (!response.ok) throw new SparkFontLoadError([face], 'fetch_failed')
      bytes = await response.arrayBuffer()
    } catch (error) {
      throw error instanceof SparkFontLoadError ? error : new SparkFontLoadError([face], 'fetch_failed')
    }
    const digest = await (options.sha256Hex ?? subtleSha256Hex)(bytes)
    if (digest !== face.sha256) throw new SparkFontLoadError([face], 'checksum_mismatch')
    verified.set(face.sha256, new Uint8Array(bytes.slice(0)))
    try {
      const Ctor = options.FontFaceCtor ?? (globalThis.FontFace as unknown as FontFaceConstructor)
      const fontSet = options.fontSet ?? (globalThis.document?.fonts as unknown as FontSetLike)
      // `display: block`: never paint the text in a fallback while the face loads.
      const fontFace = new Ctor(face.family, bytes, { weight: String(face.weight), style: face.style, display: 'block' })
      await fontFace.load()
      fontSet.add(fontFace as never)
    } catch {
      throw new SparkFontLoadError([face], 'decode_failed')
    }
    loaded.add(face.sha256)
  }

  return {
    isLoaded: (face) => loaded.has(face.sha256),
    bytes: (sha256) => (loaded.has(sha256) ? (verified.get(sha256) ?? null) : null),
    async ensure(faces) {
      const pending: Promise<void>[] = []
      const seen = new Set<string>()
      for (const face of faces) {
        if (loaded.has(face.sha256) || seen.has(face.sha256)) continue
        seen.add(face.sha256)
        let request = inflight.get(face.sha256)
        if (!request) {
          request = loadOne(face).finally(() => inflight.delete(face.sha256))
          inflight.set(face.sha256, request)
        }
        pending.push(request)
      }
      await Promise.all(pending)
    },
  }
}

type IrNode = { kind?: unknown; content?: { kind?: unknown; font?: { family?: unknown; weight?: unknown; style?: unknown } }; children?: unknown }

/**
 * The faces of `manifest` that a Motion IR document draws text with (by family, weight and style of its text nodes).
 * A text font the manifest does not list is skipped: the gateway refuses such a layer at compile time.
 */
export function facesForIr(manifest: Pick<SparkPreviewManifest, 'fonts'>, irDocument: Record<string, unknown>): SparkPreviewFontFace[] {
  const wanted = new Map<string, SparkPreviewFontFace>()
  const byKey = new Map(manifest.fonts.faces.map((face) => [`${face.family}\u0000${face.weight}\u0000${face.style}`, face]))
  const visit = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes as IrNode[]) {
      const font = node?.content?.kind === 'text' ? node.content.font : undefined
      if (font && typeof font.family === 'string' && typeof font.weight === 'number') {
        const face = byKey.get(`${font.family}\u0000${font.weight}\u0000${font.style === 'italic' ? 'italic' : 'normal'}`)
        if (face) wanted.set(face.sha256, face)
      }
      visit(node?.children)
    }
  }
  visit(irDocument.nodes)
  return [...wanted.values()]
}
