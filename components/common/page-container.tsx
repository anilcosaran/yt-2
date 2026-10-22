import * as React from 'react'

import { cn } from '@/lib/utils'

type PageContainerProps = {
  children: React.ReactNode
  /** On the scrolling frame (e.g. `route-in` for a loading page). */
  className?: string
  /** On the centred column (e.g. `@container` for a page that splits on its own width). */
  contentClassName?: string
}

/**
 * The one frame every sidebar page sits in: the same width, gutters and top on every page, so a title, a toolbar and
 * a grid start at the same place whichever page is open. Work surfaces (a canvas, a project, the inbox's two panes)
 * fill the whole area instead and do not use it.
 */
export function PageContainer({ children, className, contentClassName }: PageContainerProps) {
  return (
    <div className={cn('hg-scrollbar relative h-full overflow-y-auto bg-background text-foreground', className)}>
      <div className="hg-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className={cn('relative mx-auto min-h-full w-full max-w-[1200px] px-4 pb-10 pt-6 md:px-8 md:pt-8', contentClassName)}>
        {children}
      </div>
    </div>
  )
}
