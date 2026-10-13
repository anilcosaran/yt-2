import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The sidebar open/close glyph: a rounded panel with a short bar on its left edge (the quieter style Vercel uses),
 * drawn on lucide's 24px grid so it sits next to lucide icons with the same size and stroke classes.
 */
export function SidebarToggleIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-6 shrink-0', className)}
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M8.5 9v6" />
    </svg>
  )
}
