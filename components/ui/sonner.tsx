'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()
  const { className, style, toastOptions, ...toasterProps } = props

  const classNames = {
    toast: 'rounded-md border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg',
    title: 'text-sm font-medium leading-5 text-foreground',
    description: 'text-xs leading-4 text-muted-foreground',
    content: 'gap-0.5',
    closeButton: 'border-border bg-popover text-muted-foreground hover:bg-muted hover:text-foreground',
    icon: 'text-muted-foreground',
    success: 'border-success/25 bg-success/[0.06] text-foreground',
    error: 'border-destructive/35 bg-destructive/[0.06] text-foreground [&_[data-icon]]:text-destructive [&_svg]:text-destructive',
    warning: 'border-warning/30 bg-warning/[0.08] text-foreground',
    info: 'border-info/25 bg-info/[0.06] text-foreground',
    loading: 'border-border bg-popover text-foreground',
    default: 'border-border bg-popover text-foreground',
    ...toastOptions?.classNames,
  }

  return (
    <Sonner
      {...toasterProps}
      // Paper is a light theme; the toaster knows light, dark and system.
      theme={(theme === 'paper' ? 'light' : theme) as ToasterProps['theme']}
      className={['toaster group', className].filter(Boolean).join(' ')}
      richColors={false}
      toastOptions={{
        ...toastOptions,
        classNames,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'color-mix(in srgb, var(--success) 6%, var(--popover))',
          '--success-text': 'var(--foreground)',
          '--success-border': 'color-mix(in srgb, var(--success) 25%, var(--border))',
          '--error-bg': 'color-mix(in srgb, var(--destructive) 6%, var(--popover))',
          '--error-text': 'var(--foreground)',
          '--error-border': 'color-mix(in srgb, var(--destructive) 25%, var(--border))',
          '--warning-bg': 'color-mix(in srgb, var(--warning) 8%, var(--popover))',
          '--warning-text': 'var(--foreground)',
          '--warning-border': 'color-mix(in srgb, var(--warning) 30%, var(--border))',
          '--info-bg': 'color-mix(in srgb, var(--info) 6%, var(--popover))',
          '--info-text': 'var(--foreground)',
          '--info-border': 'color-mix(in srgb, var(--info) 25%, var(--border))',
          ...style,
        } as React.CSSProperties
      }
    />
  )
}

export { Toaster }
