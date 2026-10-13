import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import { expect } from 'vitest'

import { getMessagesForLocale } from '@/i18n/messages'
import { documentWithScenes, fixedScene, layerId, sceneId, textLayer } from '@/lib/spark/composition-test-fixtures'
import type { CompositionDocument } from '@/lib/spark/composition-client'
import type { SparkCompositionState } from '@/lib/spark/composition-session'
import { writeCardDrag, type SparkCardDrag } from '@/lib/spark/stage/placement'
import { createFakeTextMeasurer } from '@/lib/spark/optimistic/fake-text-measurer'
import { createLocalPreviewSource } from '@/lib/spark/optimistic/local-preview-source'
import { createStageBackend, imageSource, videoSource } from '@/lib/spark/stage/stage-test-harness'
import type { InspectorSchema } from '@/lib/spark/stage/inspector-schema'
import type { MediaSizeResolver } from '@/lib/spark/stage/media-size'
import { inspectorSchemaFixture } from '@/lib/spark/stage/stage-test-fixtures'
import { loadVendoredRuntime } from '@/lib/spark/stage/stage-test-runtime'

import { SparkEditorShell } from '../spark-editor-shell'

/**
 * Shared harness of the editor-tool component tests (happy-dom): the REAL editor shell with the stage over a fake gateway
 * (`createStageBackend`), the registry's tools, and helpers for clicks, waits and native drag events. A test file mocks its
 * own network modules (`vi.mock`) and uses this to mount and drive the editor.
 */

export const S1 = sceneId(1)
export const en = getMessagesForLocale('en')
export const FRAME = { left: 100, top: 50, width: 960, height: 540 }
export const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

/** A 5 s scene with one title and the project's sources: an image, a 2 s and a 12 s video, a 4 s and a 60 s song. */
export function projectDocument(options: { withClip?: boolean } = {}): CompositionDocument {
  const title = { ...textLayer(layerId(1), 2), text: 'Merhaba', scene_range: { start_frame: 0, end_frame: 150 } }
  const clip = {
    layer_id: layerId(2),
    rev: 1,
    layer_kind: 'clip',
    placement: { source_id: 'src_video_short', source_range: { in_tick: 0, out_tick: 180_000 }, scene_range: { start_frame: 0, end_frame: 60 } },
  }
  const document = documentWithScenes([S1], {
    version: 4,
    scenes: [fixedScene(S1, { duration_frames: 150, rev: 3, layers: [title, ...(options.withClip ? [clip] : [])] as never })],
  })
  document.source_media = [
    imageSource('src_image', 'obj_image'),
    videoSource('src_video_short', { seconds: 2, objectId: 'obj_video_short' }),
    videoSource('src_video_long', { seconds: 12, objectId: 'obj_video_long' }),
    videoSource('src_song', { seconds: 4, kind: 'audio', objectId: 'obj_song' }),
    videoSource('src_long_song', { seconds: 60, kind: 'audio', objectId: 'obj_long_song' }),
  ]
  return document
}

let root: Root | null = null
let container: HTMLElement | null = null
const restore: Array<() => void> = []

/** Call from `beforeEach`: the page's layout in happy-dom (stage 1056 x 644, frame 960 x 540 at (100, 50), one strip card). */
export function installLayout() {
  const original = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.classList.contains('frame')) return rect(FRAME.left, FRAME.top, FRAME.width, FRAME.height)
    if (this.classList.contains('stage')) return rect(0, 0, 1056, 644)
    if (this.classList.contains('seg-b') && this.hasAttribute('data-scene-id')) return rect(0, 600, 300, 31)
    return rect(0, 0, 0, 0)
  }
  restore.push(() => {
    HTMLElement.prototype.getBoundingClientRect = original
  })
  const size = (value: number) =>
    function (this: HTMLElement) {
      return this.classList.contains('stage') ? value : 0
    }
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: size(1056) })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: size(644) })
  restore.push(() => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)['clientWidth']
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)['clientHeight']
  })
}

/** Call from `afterEach`. */
export async function unmountEditor() {
  await act(async () => root?.unmount())
  root = null
  container?.remove()
  container = null
  while (restore.length > 0) restore.pop()!()
}

export async function settle(ms = 10) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

export async function until(check: () => boolean, label: string) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (check()) return
    await settle()
  }
  throw new Error(`Timed out waiting for ${label}`)
}

export type MountOptions = {
  /** E1-N: simulated round trip (ms) of every gateway call; the call log is `view.backend.calls`. */
  latencyMs?: number
  /** First number of the session's id counter (a test that adds scenes must not meet the fixtures' ids). */
  idStart?: number
  /** E1-N: optimistic writes: the session applies edits to its own copy and the stage draws them before the server answers. */
  optimistic?: boolean
  /**
   * E1-N: session options (retry delays, ...) on top of `optimistic`. WP2: the session's idle read-back of a copy taken from
   * receipts is off unless a test sets `verifyDelayMs` (see `stage`).
   */
  session?: Record<string, unknown>
  /**
   * WP2: the stage's idle check of a copy it drew by itself (server plan + IR read in the background). Off by default: it runs
   * on a wall-clock idle timer, so a test that is not about it would see its reads at a moment that depends on the machine
   * (and one that waits for them would race the timer). A test about it sets the delay, e.g. `{ verifyIdleMs: 0 }`.
   */
  stage?: { verifyIdleMs?: number | null }
  document?: CompositionDocument
  role?: 'owner' | 'viewer'
  stageEnabled?: boolean
  stock?: 'available' | 'unavailable'
  /** Spark effects: the Transitions browser / Animations panel UI switches (default both off). */
  effects?: { transitionsBrowser: boolean; animationsPanel: boolean }
  /** The inspector schema the stage reads (default `inspectorSchemaFixture()`). */
  schema?: () => InspectorSchema
  /** `SPARK_CONTEXT_TOOLBAR_ENABLED` (default off). */
  contextToolbar?: boolean
  /** The pixel size of a project source (default: unknown, the picture cannot be read in happy-dom). */
  mediaSize?: MediaSizeResolver
  /** Timeline v2 (`SPARK_TIMELINE_EDITING_ENABLED`, default off). */
  timelineEditing?: boolean
  /** Live FX preview (`SPARK_LIVE_FX_PREVIEW_ENABLED`, default off); with `optimistic` the fake server plans like a gateway with transitions on. */
  liveFx?: boolean
  /**
   * The gateway's release switches the fake server's preview plan reports (with `optimistic`): the `scene-transitions@2`
   * kinds (`COMPOSITION_TRANSITIONS_V2_ENABLED`, with `liveFx`), the relaxed split (`COMPOSITION_RELAXED_SPLIT_ENABLED`).
   */
  gateway?: { transitionCatalog?: 2; relaxedSplitEnabled?: boolean }
}

export async function mountEditor(options: MountOptions = {}) {
  const backend = await createStageBackend({
    document: options.document ?? projectDocument(),
    role: options.role ?? 'owner',
    latencyMs: options.latencyMs,
    idStart: options.idStart,
    ...(options.optimistic && { real: true }),
    ...(options.liveFx && { liveFx: true }),
    ...(options.gateway && { gateway: options.gateway }),
    session: { ...(options.optimistic && { optimistic: true }), ...options.session },
  })
  /** E1-N: pictures the browser drew that the server's own IR later contradicted (must stay empty: the parity tests pin it). */
  const mismatches: Array<{ sceneId: string; dependencyHash: string }> = []
  const stageSource = options.optimistic
    ? createLocalPreviewSource({
        base: backend.source,
        store: backend.localStore,
        media: { playbackUrl: (id) => `/playback/${id}`, imageUrl: (id) => `/image/${id}` },
        probeImage: async () => ({ width: 1000, height: 500 }),
        measurer: (manifest) => createFakeTextMeasurer(manifest.fonts.font_set_hash),
        onMismatch: (info) => mismatches.push(info),
        ...(options.liveFx && { liveFx: true }),
      })
    : backend.source
  const stockStatus = async () => ({ source_status: options.stock ?? 'unavailable' })

  function Host() {
    const state = React.useSyncExternalStore(backend.session.subscribe, backend.session.getSnapshot, backend.session.getSnapshot) as SparkCompositionState
    if (state.status !== 'ready' || !state.project) return null
    return (
      <SparkEditorShell
        project={state.project}
        composition={state}
        actions={backend.session}
        backLabel="Back"
        onBack={() => undefined}
        stockStatus={stockStatus}
        stageEnabled={options.stageEnabled ?? true}
        stageOverrides={{
          source: stageSource,
          loadRuntime: async () => loadVendoredRuntime(),
          loadSchema: async () => (options.schema ?? inspectorSchemaFixture)(),
          coverage: null,
          verifyIdleMs: options.stage?.verifyIdleMs === undefined ? null : options.stage.verifyIdleMs,
          mediaSize: options.mediaSize ?? (async () => null),
        }}
        {...(options.effects && { effects: options.effects })}
        contextToolbarEnabled={options.contextToolbar === true}
        {...(options.timelineEditing && { timelineEditing: true })}
        {...(options.liveFx && { liveFx: true })}
      />
    )
  }

  container = globalThis.document.createElement('div')
  globalThis.document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Host />
      </NextIntlClientProvider>,
    )
  })
  const view = {
    backend,
    mismatches,
    $: (selector: string) => container!.querySelector<HTMLElement>(selector),
    $$: (selector: string) => [...container!.querySelectorAll<HTMLElement>(selector)],
    tool: (label: string) => [...container!.querySelectorAll<HTMLButtonElement>('.rail .rail-btn')].find((button) => button.textContent === label)!,
    text: () => container!.textContent ?? '',
  }
  if (options.stageEnabled !== false) await until(() => view.$('.frame .scene-root') !== null, 'the scene to be drawn')
  if (options.stageEnabled !== false && options.role !== 'viewer') await until(() => !view.tool('Text').disabled, 'the stage tools to settle')
  return view
}

export type EditorView = Awaited<ReturnType<typeof mountEditor>>
export const opsOf = (view: EditorView) => view.backend.commands.flatMap((command) => command.ops as Array<Record<string, unknown>>)

export async function click(target: Element | null) {
  expect(target).not.toBeNull()
  await act(async () => {
    ;(target as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

export async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Picks files in a file input like the browser's dialog does. */
export async function pickFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export const file = (name: string, type: string, size = 8) => new File([new Uint8Array(size)], name, { type })

/** A native drag event whose `dataTransfer` carries a tool card, desktop files or plain text. */
export function dragEvent(type: 'dragover' | 'drop', client: { x: number; y: number }, payload: { card?: SparkCardDrag; files?: File[]; text?: string }) {
  const store = new Map<string, string>()
  const dataTransfer = {
    setData: (mime: string, value: string) => void store.set(mime, value),
    getData: (mime: string) => store.get(mime) ?? '',
    get types() {
      return [...store.keys(), ...((payload.files?.length ?? 0) > 0 ? ['Files'] : [])]
    },
    files: payload.files ?? [],
    effectAllowed: 'none' as DataTransfer['effectAllowed'],
    dropEffect: 'none',
  }
  if (payload.card) writeCardDrag(dataTransfer, payload.card)
  if (payload.text) dataTransfer.setData('text/plain', payload.text)
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: client.x, clientY: client.y })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  return event
}

export async function dispatch(target: Element, event: Event) {
  await act(async () => {
    target.dispatchEvent(event)
  })
}
