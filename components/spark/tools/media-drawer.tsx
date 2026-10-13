'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { isFileDrag } from '@/lib/spark/stage/placement'

import { SparkStockDrawer, type StockDropHandler } from '../spark-stock-drawer'
import { insertProjectSource } from './insert-source'
import { MediaLibraryTab } from './media/media-library-tab'
import { autoPlacesUploads, mediaAdderOf, mediaLibraryOf, mediaUploaderOf, uploadAndPlace } from './media/media-services'
import { MediaUploadTab } from './media/media-upload-tab'
import type { SparkToolContext, SparkToolDrawerProps } from './spark-tool-types'

type MediaTab = 'upload' | 'library' | 'stock'
const TABS: readonly MediaTab[] = ['upload', 'library', 'stock']

/** The holder of the registered handler of a Stock card dropped on the canvas or the timeline (set by the Stock tab). */
export class StockDropHolder {
  private current: StockDropHandler | null = null

  set(handler: StockDropHandler | null): void {
    this.current = handler
  }

  get handler(): StockDropHandler | null {
    return this.current
  }

  dispose(): void {
    this.current = null
  }
}

export const stockDropHolderOf = (ctx: SparkToolContext): StockDropHolder => ctx.service('media.stock-drop', () => new StockDropHolder())

/**
 * The registry's Media drawer (D10): Upload (file picker and drop zone, several files with progress), My media (the Storage
 * library with search and category filters) and Stock (the platform catalogue, unchanged). The Media tool is enabled by the
 * stage; only the Stock TAB depends on the platform gate and is disabled with its reason while the catalogue is closed.
 * Desktop files dropped anywhere on the drawer are uploaded.
 */
export function MediaToolDrawer({ ctx }: SparkToolDrawerProps) {
  const t = useTranslations('Spark.editor.media')
  const stockAvailable = ctx.stockAvailability === 'available'
  const [tab, setTab] = React.useState<MediaTab>('library')
  const active: MediaTab = tab === 'stock' && !stockAvailable ? 'library' : tab
  const uploader = mediaUploaderOf(ctx)
  const library = mediaLibraryOf(ctx)
  const adder = mediaAdderOf(ctx)
  const stockDrop = stockDropHolderOf(ctx)
  const [dropActive, setDropActive] = React.useState(false)
  const registerStockDrop = React.useCallback(
    (handler: StockDropHandler | null) => {
      stockDrop.set(handler)
    },
    [stockDrop],
  )

  const enabledTabs = TABS.filter((id) => id !== 'stock' || stockAvailable)
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = enabledTabs.indexOf(active)
    const next = enabledTabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + enabledTabs.length) % enabledTabs.length]
    if (next) setTab(next)
  }
  const tabs = (
    <div className="seg" role="tablist" aria-label={t('tabs.label')}>
      {TABS.map((id) => {
        const disabled = id === 'stock' && !stockAvailable
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`media-tab-${id}`}
            aria-selected={active === id}
            tabIndex={active === id ? 0 : -1}
            className={active === id ? 'on' : undefined}
            disabled={disabled}
            title={disabled ? t('tabs.stockUnavailable') : undefined}
            onKeyDown={onTabKey}
            onClick={() => setTab(id)}
          >
            {t(`tabs.${id}`)}
          </button>
        )
      })}
    </div>
  )

  // Desktop files dropped on the drawer are uploaded (the Upload tab shows them), whichever tab is open.
  const dropHandlers = ctx.canWrite
    ? {
        onDragOver: (event: React.DragEvent) => {
          if (!isFileDrag(event.dataTransfer)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDropActive(true)
        },
        onDragLeave: (event: React.DragEvent) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropActive(false)
        },
        onDrop: (event: React.DragEvent) => {
          setDropActive(false)
          if (!isFileDrag(event.dataTransfer)) return
          event.preventDefault()
          const files = Array.from(event.dataTransfer.files)
          // WP5a: with instant editing a file dropped on the drawer goes to the playhead by itself once it is ready.
          const result = autoPlacesUploads(ctx) ? uploadAndPlace(ctx, files, { kind: 'playhead' }) : uploader.add(files)
          for (const file of result.refused) ctx.notify(`media.upload.refused.${file.reason}`, { name: file.name }, 'error')
          if (result.accepted.length > 0) setTab('upload')
        },
      }
    : {}

  return (
    <div style={{ display: 'contents' }} {...dropHandlers}>
      {active === 'stock' ? (
        <SparkStockDrawer
          projectId={ctx.project.id}
          canWrite={ctx.canWrite}
          writeTitle={ctx.writeTitle}
          insertSourceClip={(sourceId, kind) => insertProjectSource(ctx, sourceId, kind)}
          sourceTabs={tabs}
          registerDrop={registerStockDrop}
        />
      ) : (
        <div className={`dr-body${dropActive ? ' drop-ready' : ''}`} role="tabpanel" aria-labelledby={`media-tab-${active}`}>
          {tabs}
          {active === 'upload' ? (
            <MediaUploadTab ctx={ctx} uploader={uploader} adder={adder} />
          ) : (
            <MediaLibraryTab ctx={ctx} library={library} adder={adder} onUpload={() => setTab('upload')} />
          )}
        </div>
      )}
    </div>
  )
}
