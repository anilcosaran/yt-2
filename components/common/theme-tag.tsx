'use client'

import { cn } from '@/lib/utils'

export type ThemeTagVariant = 
  | 'increase-revenue' 
  | 'delight' 
  | 'win-enterprise' 
  | 'delight-users' 
  | 'expand-horizons'
  | 'default'

interface ThemeTagProps {
  label: string
  variant?: ThemeTagVariant
  icon?: React.ReactNode
  className?: string
}

const variantStyles: Record<ThemeTagVariant, { bg: string; text: string; icon?: string }> = {
  'increase-revenue': {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: '🌱',
  },
  'delight': {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    icon: '❤️',
  },
  'win-enterprise': {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    icon: '🎯',
  },
  'delight-users': {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    icon: '❤️',
  },
  'expand-horizons': {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-400',
    icon: '🚀',
  },
  'default': {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
  },
}

export function ThemeTag({ label, variant = 'default', icon, className }: ThemeTagProps) {
  const styles = variantStyles[variant]
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
        styles.bg,
        styles.text,
        className
      )}
    >
      {icon || styles.icon}
      <span>{label}</span>
    </span>
  )
}
