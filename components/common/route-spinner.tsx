import { useTranslations } from 'next-intl'

import { ActivitySpinner } from '@/components/ui/activity-spinner'
import { cn } from '@/lib/utils'

/**
 * A route's loading moment where a skeleton would not match the page that is coming (the chat, Spark): the page's
 * background and a small spinner in the middle. It appears only after a beat (`route-in`), so a quick navigation
 * shows nothing at all instead of a flash.
 */
export function RouteSpinner({ className }: { className?: string }) {
  const t = useTranslations('Auto')
  return (
    <div role="status" aria-label={t('loading_8f26c652')} className={cn('flex h-full min-h-[60vh] w-full items-center justify-center bg-background', className)}>
      <span className="route-in text-muted-foreground">
        <ActivitySpinner className="size-5" />
      </span>
    </div>
  )
}
