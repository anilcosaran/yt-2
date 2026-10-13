'use client'

import { cn } from '@/lib/utils'

interface ImpactDotsProps {
  value: number // 0-5
  maxDots?: number
  className?: string
}

export function ImpactDots({ value, maxDots = 5, className }: ImpactDotsProps) {
  const filledDots = Math.min(Math.max(0, Math.round(value)), maxDots)
  
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: maxDots }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'h-2 w-2 rounded-full',
            index < filledDots 
              ? 'bg-blue-500 dark:bg-blue-400' 
              : 'bg-gray-200 dark:bg-gray-700'
          )}
        />
      ))}
    </div>
  )
}
