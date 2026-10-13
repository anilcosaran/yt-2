'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { MotionCatalogView } from '@/components/motion/catalog/motion-catalog-view'
import { addMotionToSparkProject } from '@/lib/motion-editor/add-to-spark'
import { createCatalogPreviewSource } from '@/lib/motion-editor/catalog-preview-source'
import { isCatalogTab, isCategoryId, starterMotion, type CatalogItem, type CatalogTab, type CategoryId } from '@/lib/motion-editor/catalog-model'
import { MotionLibrarySession } from '@/lib/motion-editor/library-session'
import { LiveSlotPool } from '@/lib/motion-editor/live-slots'
import { setPendingMotionPrompt } from '@/lib/motion-editor/pending-prompt'
import { listSparkProjects } from '@/lib/spark/api'
import { useActiveChannel } from '@/lib/channel/active-channel'

import type { SparkPickerDeps } from './catalog/motion-spark-picker'

const EDITOR_HREF = (draftId: string) => `/motion/${encodeURIComponent(draftId)}`
const PROJECT_PAGE_SIZE = 50

/**
 * The Motion area's catalog page (P06-02 library, redesigned as a catalog). The library session reads the platform
 * catalogue, the user's saved Motions and drafts and the VideoStyle presets; this container keeps the screen state in the
 * URL (`?tab=`, `?category=`, `?q=`, `?motion=` for a Motion's dialog; never browser storage) and wires the three actions:
 * Customize (fork into a private draft, open it), Create motion (a draft forked from the starter Motion that carries the
 * prompt to the editor's chat) and Add to Spark project (a new scene in a chosen project).
 */
export function MotionLibraryPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { activeChannelId } = useActiveChannel()
  const [session] = React.useState(() => new MotionLibrarySession())
  const state = React.useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const [chosenStyle, setChosenStyle] = React.useState<string | null>(null)
  const [pool] = React.useState(() => new LiveSlotPool())
  const [source] = React.useState(() => createCatalogPreviewSource())
  const [creating, setCreating] = React.useState(false)
  const [createFailed, setCreateFailed] = React.useState(false)
  // The look is what the user sees selected: their choice, else the first listed preset (visible, never hidden).
  const styleRef = chosenStyle ?? state.styles[0]?.preset_ref ?? ''

  const tabParam = params.get('tab')
  const tab: CatalogTab = isCatalogTab(tabParam) ? tabParam : 'catalog'
  const categoryParam = params.get('category')
  const category: CategoryId | null = isCategoryId(categoryParam) ? categoryParam : null
  const urlQuery = params.get('q') ?? ''
  const openId = params.get('motion')

  // The search box types into local state at once and the URL follows; the URL stays the truth for reloads and links.
  const [typed, setTyped] = React.useState(urlQuery)
  const [seenUrlQuery, setSeenUrlQuery] = React.useState(urlQuery)
  if (seenUrlQuery !== urlQuery) {
    setSeenUrlQuery(urlQuery)
    setTyped(urlQuery)
  }

  const update = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      const query = next.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  React.useEffect(() => {
    void session.load()
    return () => session.abort()
  }, [session])

  const customize = React.useCallback(
    async (item: CatalogItem) => {
      if (!item.platform || styleRef === '') return
      const draftId = await session.customize(item.platform, styleRef)
      if (draftId) router.push(EDITOR_HREF(draftId))
    },
    [router, session, styleRef],
  )

  const create = React.useCallback(
    async (prompt: string) => {
      const starter = starterMotion(state.motions)
      if (!starter || styleRef === '' || creating) return false
      setCreating(true)
      setCreateFailed(false)
      try {
        const draftId = await session.customize(starter, styleRef)
        if (!draftId) {
          setCreateFailed(true)
          return false
        }
        setPendingMotionPrompt(draftId, prompt)
        router.push(EDITOR_HREF(draftId))
        return true
      } finally {
        setCreating(false)
      }
    },
    [creating, router, session, state.motions, styleRef],
  )

  const spark = React.useMemo<SparkPickerDeps>(
    () => ({
      channelId: activeChannelId,
      listProjects: async (channelId, options) => (await listSparkProjects(channelId, { limit: PROJECT_PAGE_SIZE, signal: options.signal })).projects,
      addMotion: ({ projectId, item }) => addMotionToSparkProject({ projectId, item, videoStyleRef: styleRef === '' ? null : styleRef }),
    }),
    [activeChannelId, styleRef],
  )

  return (
    <MotionCatalogView
      state={state}
      tab={tab}
      category={category}
      query={typed}
      openId={openId}
      onTab={(next) => update({ tab: next === 'catalog' ? null : next, category: null })}
      onCategory={(next) => update({ category: next })}
      onQuery={(next) => {
        setTyped(next)
        update({ q: next.trim() === '' ? null : next })
      }}
      onOpen={(id) => update({ motion: id })}
      onClose={() => update({ motion: null })}
      styleRef={styleRef}
      onStyleRef={setChosenStyle}
      onCustomize={(item) => void customize(item)}
      onCreate={create}
      creating={creating}
      createFailed={createFailed}
      onRetry={() => void session.load()}
      source={source}
      pool={pool}
      spark={spark}
    />
  )
}
