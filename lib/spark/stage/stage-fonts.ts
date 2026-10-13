import { getYoutorchApiBaseUrl } from '@/lib/auth/api-base-url'

import type { PreviewFontFace } from './preview-contract'

/**
 * Pinned font bytes into `document.fonts` (W2 consumer side). The runtime draws text line by line from the stored
 * layout ("the browser never re-wraps"), which is only the renderer's picture when the page uses the SAME face bytes:
 * each face is fetched by its sha256 path, its digest is verified against the pin, and a face that is missing or does
 * not match rejects. There is no silent fallback (F45, K241 "no frame before the font").
 */

export class StageFontLoadError extends Error {
  constructor(readonly faces: readonly Pick<PreviewFontFace, 'family' | 'weight' | 'style' | 'sha256'>[], message: string) {
    super(message)
    this.name = 'StageFontLoadError'
  }
}

export interface StageFontLoader {
  ensure(faces: readonly PreviewFontFace[], signal?: AbortSignal): Promise<void>
  isLoaded(face: Pick<PreviewFontFace, 'sha256'>): boolean
}

type FontSetLike = { add(face: unknown): unknown }
type FontFaceCtor = new (family: string, source: ArrayBuffer, descriptors: { weight: string; style: string }) => { load(): Promise<unknown> }

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createStageFontLoader(
  options: { fetcher?: typeof fetch; fontSet?: FontSetLike; FontFaceCtor?: FontFaceCtor; baseUrl?: string; digest?: (bytes: ArrayBuffer) => Promise<string> } = {},
): StageFontLoader {
  const loaded = new Set<string>()
  const inFlight = new Map<string, Promise<void>>()

  const loadOne = async (face: PreviewFontFace, signal?: AbortSignal): Promise<void> => {
    const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
    const baseUrl = options.baseUrl ?? getYoutorchApiBaseUrl()
    const response = await fetcher(`${baseUrl}${face.url}`, { credentials: 'include', signal })
    if (!response.ok) throw new StageFontLoadError([face], `Font ${face.family} ${face.weight} could not be fetched (${response.status}).`)
    const bytes = await response.arrayBuffer()
    const digest = await (options.digest ?? sha256Hex)(bytes)
    if (digest !== face.sha256) throw new StageFontLoadError([face], `Font ${face.family} ${face.weight} does not match its pin.`)
    const Ctor = options.FontFaceCtor ?? (globalThis as { FontFace?: FontFaceCtor }).FontFace
    const fontSet = options.fontSet ?? (globalThis.document as unknown as { fonts?: FontSetLike } | undefined)?.fonts
    if (!Ctor || !fontSet) throw new StageFontLoadError([face], 'This browser cannot load pinned fonts.')
    const fontFace = new Ctor(face.family, bytes, { weight: String(face.weight), style: face.style })
    await fontFace.load()
    fontSet.add(fontFace)
    loaded.add(face.sha256)
  }

  return {
    isLoaded: (face) => loaded.has(face.sha256),
    async ensure(faces, signal) {
      const pending = faces.filter((face) => !loaded.has(face.sha256))
      const results = await Promise.allSettled(
        pending.map((face) => {
          let task = inFlight.get(face.sha256)
          if (!task) {
            task = loadOne(face, signal).finally(() => inFlight.delete(face.sha256))
            inFlight.set(face.sha256, task)
          }
          return task
        }),
      )
      const failed = pending.filter((_, index) => results[index]!.status === 'rejected')
      if (failed.length > 0) throw new StageFontLoadError(failed, `${failed.length} pinned font face(s) could not be loaded.`)
    },
  }
}
