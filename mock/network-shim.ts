// Browser-side safety net: nothing in yt-2 may reach a server. Calls that bypass lib/gateway/client.ts
// (streaming endpoints, downloads, the old /api/storage proxies) and any cross-origin request are answered
// locally, and EventSource streams are replaced with an always-open stand-in. A fixture with a live story (the demo
// chat) can send run events down the open streams of a run with `publishMockStreamEvent`, like the server's SSE.

const MOCK_API_HOST = 'mock-api.yt-2.local'
const INSTALLED = Symbol.for('yt2.mockNetworkShim')

type ShimWindow = Window & typeof globalThis & { [INSTALLED]?: boolean }

export function installMockNetworkShim() {
  if (typeof window === 'undefined') return
  const target = window as ShimWindow
  if (target[INSTALLED]) return
  target[INSTALLED] = true

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
    if (url.protocol === 'data:' || url.protocol === 'blob:') return realFetch(input, init)
    const sameOrigin = url.origin === window.location.origin
    if (sameOrigin && !url.pathname.startsWith('/api/v1/') && !url.pathname.startsWith('/api/storage/') && !url.pathname.startsWith('/api/assistant/')) {
      return realFetch(input, init)
    }
    return mockResponse(url)
  }

  window.EventSource = MockEventSource as unknown as typeof EventSource
}

function mockResponse(url: URL): Response {
  if (url.pathname === '/api/storage/waveform') return json(200, syntheticWaveform(url.searchParams.get('objectId') ?? ''))
  const message = url.hostname === MOCK_API_HOST || url.pathname.startsWith('/api/')
    ? 'This request is not available in yt-2 mock mode.'
    : `Blocked external request to ${url.origin} (yt-2 has no network access).`
  console.info(`[yt-2 mock] ${message} ${url.pathname}`)
  return json(503, { error: { code: 'MOCK_UNAVAILABLE', message } })
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** audiowaveform v2 peaks (8-bit, mono) so timeline audio clips draw a waveform. */
function syntheticWaveform(seed: string) {
  const length = 1200
  const data: number[] = []
  let phase = seed.length
  for (let index = 0; index < length; index += 1) {
    phase += 0.17
    const envelope = 0.35 + 0.65 * Math.abs(Math.sin(index / 37 + seed.length))
    const peak = Math.round(Math.min(127, 20 + 100 * envelope * Math.abs(Math.sin(phase * 1.7))))
    data.push(-peak, peak)
  }
  return { version: 2, channels: 1, sample_rate: 44100, samples_per_pixel: 512, bits: 8, length, data }
}

const openSources = new Set<MockEventSource>()

/** Sends one event (`type`, JSON `data`) to every open stream whose URL `matches`. */
export function publishMockStreamEvent(matches: (url: string) => boolean, type: string, data: unknown) {
  const body = JSON.stringify(data)
  for (const source of openSources) {
    if (source.readyState !== 1 || !matches(source.url)) continue
    const event = new MessageEvent(type, { data: body })
    if (type === 'message') source.onmessage?.(event)
    source.dispatchEvent(event)
  }
}

class MockEventSource extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSED = 2
  readonly url: string
  readonly withCredentials: boolean
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string | URL, init?: EventSourceInit) {
    super()
    this.url = String(url)
    this.withCredentials = Boolean(init?.withCredentials)
    openSources.add(this)
    setTimeout(() => {
      if (this.readyState === 2) return
      this.readyState = 1
      const event = new Event('open')
      this.onopen?.(event)
      this.dispatchEvent(event)
    }, 0)
  }

  close() {
    this.readyState = 2
    openSources.delete(this)
  }
}

installMockNetworkShim()
