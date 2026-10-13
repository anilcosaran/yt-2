export type PickerGalleryItem = {
  url: string
  label: string
  kind?: 'image' | 'video' | 'audio'
  index?: number
}

export type PickerGalleryNode = {
  id: string
  settings?: Record<string, unknown>
}

export type PickerGalleryEdge = {
  source: string
  target: string
  targetHandle?: string | null
  targetInput?: string
  sourceHandle?: string | null
  sourcePort?: string
}

export type PickerGalleryNodeOutput = {
  nodeKey: string
  outputData?: unknown
}

export type PickerGalleryRunOutput = {
  outputs?: PickerGalleryNodeOutput[]
}

const LIST_KEYS = ['frames', 'clips', 'downloads', 'items', 'item', 'results', 'images', 'uploaded'] as const
const IMAGE_URL_KEYS = [
  'image_url',
  'imageUrl',
  'thumbnail_url',
  'thumbnailUrl',
  'gif',
  'url',
  'src',
] as const
const VIDEO_URL_KEYS = ['video_url', 'videoUrl', 'playback_url', 'mp4_url'] as const
const CDN_URL_KEYS = ['cdn_url', 'cdnUrl'] as const
const AUDIO_URL_KEYS = ['audio_url', 'audioUrl', 'voice_url'] as const

export function buildPickerRuntimeGalleries(
  nodes: PickerGalleryNode[],
  edges: PickerGalleryEdge[],
  runOutput?: PickerGalleryRunOutput | null,
): Map<string, PickerGalleryItem[]> {
  const galleries = new Map<string, PickerGalleryItem[]>()
  const outputsByKey = indexOutputs(runOutput?.outputs)
  if (outputsByKey.size === 0) return galleries

  for (const node of nodes) {
    const previewNode = isPreviewHelperSettings(node.settings)
    if (!previewNode) continue
    const incoming = incomingItemsConnection(node.id, edges)
    if (!incoming) continue
    const items = extractGalleryItems(outputsByKey.get(incoming.sourceId)?.outputData, incoming.sourcePort)
    if (items.length > 0) galleries.set(node.id, items)
  }
  return galleries
}

export function isPreviewHelperSettings(settings?: Record<string, unknown>) {
  return settings?.helper_preview === true
}

function incomingItemsConnection(nodeId: string, edges: PickerGalleryEdge[]) {
  const match = edges.find((edge) => edge.target === nodeId && targetsItemsPort(edge))
    ?? edges.find((edge) => edge.target === nodeId)
  if (!match?.source) return null
  return {
    sourceId: match.source,
    sourcePort: normalizePort(match.sourcePort || match.sourceHandle),
  }
}

function targetsItemsPort(edge: PickerGalleryEdge) {
  const input = normalizePort(edge.targetInput || edge.targetHandle)
  return !input || input === 'items' || input === 'media' || input === 'audio' || input === 'input'
}

function normalizePort(value: string | null | undefined) {
  if (!value) return ''
  return value.replace(/^(input|output):/i, '').trim().toLocaleLowerCase('en-US')
}

function indexOutputs(outputs: PickerGalleryNodeOutput[] | undefined) {
  const map = new Map<string, PickerGalleryNodeOutput>()
  for (const output of outputs ?? []) {
    if (output.nodeKey) map.set(output.nodeKey, output)
  }
  return map
}

export function extractGalleryItems(outputData: unknown, sourcePort?: string | null): PickerGalleryItem[] {
  const unwrapped = unwrapResult(outputData)
  if (sourcePort && isRecord(unwrapped)) {
    const focused = unwrapped[sourcePort]
    if (focused != null) {
      const focusedItems = collectGalleryItems(focused)
      if (focusedItems.length > 0) return focusedItems
    }
  }
  return collectGalleryItems(unwrapped)
}

function collectGalleryItems(value: unknown): PickerGalleryItem[] {
  const list = extractList(value)
  const items: PickerGalleryItem[] = []
  for (const [index, entry] of list.entries()) {
    const media = extractMedia(entry)
    if (!media) continue
    items.push({
      url: media.url,
      label: String(index + 1),
      kind: media.kind,
      index,
    })
  }
  return items
}

function unwrapResult(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('result' in value) return value.result
  if ('output' in value) return value.output
  return value
}

function extractList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return [value]
  if (!isRecord(value)) return []
  for (const key of LIST_KEYS) {
    const candidate = value[key]
    if (Array.isArray(candidate) && candidate.length > 0) return candidate
    if (key === 'item' && candidate != null && !Array.isArray(candidate)) return [candidate]
  }
  const singles = [value.first_frame, value.last_frame, value.primary_image].filter((item) => item != null)
  if (singles.length > 0) return singles
  if (extractMedia(value)) return [value]
  return []
}

function extractMedia(value: unknown): { url: string; kind: 'image' | 'video' | 'audio' } | null {
  if (typeof value === 'string') {
    const url = usableMediaUrl(value)
    return url ? { url, kind: mediaKindFromUrl(url) } : null
  }
  if (!isRecord(value)) return null
  for (const key of AUDIO_URL_KEYS) {
    const url = typeof value[key] === 'string' ? usableMediaUrl(value[key] as string) : null
    if (url) return { url, kind: 'audio' }
  }
  for (const key of VIDEO_URL_KEYS) {
    const url = typeof value[key] === 'string' ? usableMediaUrl(value[key] as string) : null
    if (url) return { url, kind: 'video' }
  }
  for (const key of CDN_URL_KEYS) {
    const url = typeof value[key] === 'string' ? usableMediaUrl(value[key] as string) : null
    if (url) return { url, kind: kindForCdnUrl(url) }
  }
  for (const key of IMAGE_URL_KEYS) {
    const url = typeof value[key] === 'string' ? usableMediaUrl(value[key] as string) : null
    if (url) return { url, kind: mediaKindFromUrl(url) }
  }
  return null
}

function usableMediaUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:|blob:|data:)/i.test(trimmed)) return trimmed
  if (/\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|mp3|wav|m4a|ogg)(?:$|\?)/i.test(trimmed)) return trimmed
  return null
}

function kindForCdnUrl(url: string): 'image' | 'video' | 'audio' {
  const kind = mediaKindFromUrl(url)
  if (kind !== 'image') return kind
  if (/\.(png|jpe?g|webp|gif|avif)(?:$|\?)/i.test(url)) return 'image'
  return 'video'
}

function mediaKindFromUrl(url: string): 'image' | 'video' | 'audio' {
  if (/\.(mp4|webm|mov)(?:$|\?)/i.test(url)) return 'video'
  if (/\.(mp3|wav|m4a|ogg|aac)(?:$|\?)/i.test(url)) return 'audio'
  return 'image'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
