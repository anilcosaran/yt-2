'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { Plus, Shapes } from 'lucide-react'

import { PageContainer } from '@/components/common/page-container'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { createCanvas, useCanvases, type Canvas } from '@/lib/canvas/canvases'
import { openWorkTab, workTabPath } from '@/lib/work-tabs'

import { useClock } from './use-clock'

/** A sheet of dotted paper: the cover every canvas card has, the canvas's own ground. */
const PAPER_DOTS: React.CSSProperties = {
  backgroundImage: 'radial-gradient(color-mix(in srgb, var(--foreground) 18%, transparent) 1px, transparent 1.5px)',
  backgroundSize: '16px 16px',
  backgroundPosition: '8px 8px',
}

/**
 * Canvas entry: the user's canvases, the most recently used first. Each one is a project of its own and opens as its
 * work tab in the top bar (`lib/work-tabs.ts`); "Yeni canvas" makes one and opens it straight away.
 */
export function CanvasListPage() {
  const t = useTranslations('Canvas')
  const router = useRouter()
  const canvases = useCanvases()

  const open = React.useCallback((canvas: Canvas) => {
    openWorkTab({ kind: 'canvas', id: canvas.id, title: canvas.title })
    router.push(workTabPath('canvas', canvas.id))
  }, [router])

  const create = React.useCallback(() => open(createCanvas(t('untitled'))), [open, t])

  return (
    <PageContainer>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={(
          <Button onClick={create}>
            <Plus className="size-4" aria-hidden />
            {t('newCanvas')}
          </Button>
        )}
        className="mb-0"
      />

      {/* Read from this browser once the page is on the client: nothing is drawn until then, so there is no flash. */}
      <section className="mt-6" aria-label={t('title')}>
        {canvases === null ? null : canvases.length === 0 ? (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Shapes aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
              <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={create}>
                <Plus className="size-4" aria-hidden />
                {t('newCanvas')}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {canvases.map((canvas) => (
              <li key={canvas.id}>
                <CanvasCard canvas={canvas} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  )
}

function CanvasCard({ canvas, onOpen }: { canvas: Canvas; onOpen: (canvas: Canvas) => void }) {
  const t = useTranslations('Canvas')
  const format = useFormatter()
  const now = useClock()
  return (
    <button
      type="button"
      onClick={() => onOpen(canvas)}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-panel text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="aspect-video bg-muted/40" style={PAPER_DOTS} aria-hidden />
      <div className="space-y-1 border-t border-border p-3">
        <p className="truncate text-sm font-medium" title={canvas.title}>{canvas.title}</p>
        <p className="text-xs text-muted-foreground">
          {now ? t('updated', { time: format.relativeTime(Math.min(canvas.updatedAt, now), now) }) : ' '}
        </p>
      </div>
    </button>
  )
}
