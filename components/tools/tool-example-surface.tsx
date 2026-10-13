'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  getToolExampleDefinition,
  type ToolExampleBlock,
} from '@/lib/tools/tool-example-catalog'

const exampleRenderers: Record<string, React.ComponentType> = {}

export function registerToolExampleRenderer(id: string, renderer: React.ComponentType) {
  exampleRenderers[id] = renderer
}

export function ToolExampleSurface({
  toolId,
  className,
}: {
  toolId: string
  className?: string
}) {
  const definition = getToolExampleDefinition(toolId)
  return (
    <div
      data-tool-example-surface={toolId}
      className={cn(
        'tool-example-surface relative min-h-[22rem] overflow-hidden rounded-2xl border border-border bg-background/40',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_42%)]" />
      <div className="relative space-y-6 px-4 py-6 sm:px-6">
        {definition.blocks.map((block, index) => (
          <ToolExampleBlockView key={`${block.type}-${index}`} block={block} />
        ))}
      </div>
    </div>
  )
}

function ToolExampleBlockView({ block }: { block: ToolExampleBlock }) {
  const tAuto = useTranslations('Auto')
  if (block.type === 'hero') {
    return (
      <header className="mx-auto max-w-2xl text-center">
        <h3 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          {tAuto(block.titleKey)}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
          {tAuto(block.descriptionKey)}
        </p>
      </header>
    )
  }
  if (block.type === 'note') {
    return (
      <p className="text-center text-sm text-muted-foreground">{tAuto(block.textKey)}</p>
    )
  }
  if (block.type === 'video') {
    return (
      <figure className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-black">
        <video
          className="aspect-video w-full"
          src={block.src}
          poster={block.poster}
          controls
          playsInline
          preload="metadata"
        />
        {block.titleKey ? (
          <figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">
            {tAuto(block.titleKey)}
          </figcaption>
        ) : null}
      </figure>
    )
  }
  if (block.type === 'custom') {
    const Renderer = exampleRenderers[block.rendererId]
    return Renderer ? <Renderer /> : null
  }
  if (block.type === 'image-grid') {
    const trailingStart = block.compactTrailing
      ? Math.max(0, block.items.length - (block.items.length % block.columns || block.columns))
      : block.items.length
    const leading = block.compactTrailing ? block.items.slice(0, trailingStart) : block.items
    const trailing = block.compactTrailing ? block.items.slice(trailingStart) : []
    return (
      <div className="space-y-3">
        <div className={cn(
          'grid gap-2.5 sm:gap-3',
          block.columns === 3 && 'grid-cols-2 sm:grid-cols-3',
          block.columns === 4 && 'grid-cols-2 sm:grid-cols-4',
          block.columns === 5 && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
        )}
        >
          {leading.map((item, index) => (
            <ExampleImageTile
              key={`${item.src}-${index}`}
              src={item.src}
              label={tAuto(item.labelKey)}
              alt={tAuto(item.altKey)}
              index={index}
            />
          ))}
        </div>
        {trailing.length > 0 ? (
          <div className={cn(
            'grid gap-2.5 sm:gap-3',
            trailing.length === 4 && 'grid-cols-2 sm:grid-cols-4',
            trailing.length === 3 && 'grid-cols-2 sm:grid-cols-3',
            trailing.length === 2 && 'grid-cols-2',
            trailing.length === 1 && 'grid-cols-1 max-w-xs mx-auto',
          )}
          >
            {trailing.map((item, index) => (
              <ExampleImageTile
                key={`${item.src}-trail-${index}`}
                src={item.src}
                label={tAuto(item.labelKey)}
                alt={tAuto(item.altKey)}
                index={trailingStart + index}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }
  return null
}

function ExampleImageTile({
  src,
  label,
  alt,
  index,
}: {
  src: string
  label: string
  alt: string
  index: number
}) {
  return (
    <figure
      className="tool-example-tile group relative overflow-hidden rounded-2xl bg-muted"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={1080}
        height={1920}
        className="aspect-[9/16] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <figcaption className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
        {String(index + 1).padStart(2, '0')} {label}
      </figcaption>
    </figure>
  )
}
