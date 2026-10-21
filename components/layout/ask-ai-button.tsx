'use client'

import * as React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { UiText } from '@/components/i18n/ui-text'
import { workTabFromPath } from '@/lib/work-tabs'

/**
 * "AI'a sor", the agent panel's launcher: a quiet pill in the page panel's bottom right corner, where the panel opens
 * (`agent-panel.tsx`), shown while it is closed. Pages only: work (a project's or an automation's tab, the new tab
 * and what it starts) has Spark's own panel. On a phone it is the mark alone.
 */
export function AskAiButton({ onOpen }: { onOpen: () => void }) {
  return (
    // An unsaved Flow is told from the automation list by its query, read on the client.
    <React.Suspense fallback={null}>
      <AskAiButtonOnPage onOpen={onOpen} />
    </React.Suspense>
  )
}

function AskAiButtonOnPage({ onOpen }: { onOpen: () => void }) {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  if (workTabFromPath(pathname, search) !== null) return null
  return (
    <button
      type="button"
      data-ask-ai-trigger
      aria-controls="agent-panel"
      aria-expanded={false}
      onClick={onOpen}
      className="animate-in fade-in-0 zoom-in-95 absolute bottom-4 right-4 z-40 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-popover/90 pl-2 pr-4 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_28px_-10px_rgb(0_0_0/0.35)] backdrop-blur-md transition-[translate,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-popover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 max-sm:size-11 max-sm:justify-center max-sm:p-0"
    >
      <span className="grid size-7 place-items-center rounded-full bg-orange-500/12 text-orange-500 dark:text-orange-400">
        <Sparkles className="size-3.5" aria-hidden />
      </span>
      <span className="max-sm:sr-only"><UiText id="ask_ai_8dbaeb8e" /></span>
    </button>
  )
}
