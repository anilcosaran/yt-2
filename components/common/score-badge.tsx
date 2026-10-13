'use client'

import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 1000) return 'bg-blue-600 text-white'
  if (score >= 500) return 'bg-blue-500 text-white'
  if (score >= 200) return 'bg-blue-400 text-white'
  if (score >= 50) return 'bg-blue-300 text-blue-900'
  return 'bg-blue-200 text-blue-800'
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const formattedScore = score >= 1000 
    ? `${(score / 1000).toFixed(1).replace('.0', '')}.${(score % 1000).toString().padStart(3, '0').slice(0, 3)}`
    : score.toString()
  
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold min-w-[40px]',
        getScoreColor(score),
        className
      )}
    >
      {formattedScore}
    </span>
  )
}
