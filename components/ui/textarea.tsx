import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-xl border border-border bg-panel/40 px-3.5 py-3 text-sm text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/40 focus-visible:border-primary/50 focus-visible:ring-0 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
