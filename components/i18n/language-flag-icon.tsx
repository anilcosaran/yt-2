import { Globe2 } from 'lucide-react'
import 'flag-icons/css/flag-icons.min.css'

import { cn } from '@/lib/utils'

export function LanguageFlagIcon({
  region,
  className,
}: {
  region: string | null | undefined
  className?: string
}) {
  const normalizedRegion = typeof region === 'string' && /^[a-z]{2}$/i.test(region.trim())
    ? region.trim().toLocaleLowerCase('en-US')
    : null

  if (!normalizedRegion) {
    return (
      <span
        aria-hidden="true"
        data-language-flag="global"
        className={cn(
          'inline-flex h-4 w-[22px] shrink-0 items-center justify-center rounded-[3px] border border-border/70 bg-muted text-muted-foreground shadow-sm',
          className,
        )}
      >
        <Globe2 className="size-3" />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      data-language-flag={normalizedRegion}
      className={cn(
        'inline-flex h-4 w-[22px] shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-black/10 dark:ring-white/15',
        className,
      )}
    >
      <span className={cn('fi h-full w-full', `fi-${normalizedRegion}`)} />
    </span>
  )
}
