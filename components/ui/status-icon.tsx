import * as React from 'react'
import { Check, X } from 'lucide-react'

import { cn } from '@/lib/utils'

export type StatusIconState = 'success' | 'failed'
export type StatusIconSize = 'xs' | 'sm' | 'md'

const sizeClassNames: Record<StatusIconSize, string> = {
  xs: 'size-4 [&_svg]:size-2.5',
  sm: 'size-5 [&_svg]:size-3',
  md: 'size-6 [&_svg]:size-3.5',
}

export function StatusIcon({
  status,
  size = 'sm',
  className,
  'aria-label': ariaLabel,
  title,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  status: StatusIconState
  size?: StatusIconSize
}) {
  const success = status === 'success'
  const label = ariaLabel ?? (success ? 'Success' : 'Failed')
  const Icon = success ? Check : X

  return (
    <span
      role="img"
      data-slot="status-icon"
      data-status={status}
      aria-label={label}
      title={title ?? label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border bg-white',
        success
          ? 'border-[#557a6b]/55 text-[#557a6b]'
          : 'border-[#9a514b]/55 text-[#9a514b]',
        sizeClassNames[size],
        className,
      )}
      {...props}
    >
      <Icon strokeWidth={2.15} />
    </span>
  )
}
