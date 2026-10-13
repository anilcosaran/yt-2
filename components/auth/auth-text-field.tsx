'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type AuthTextFieldProps = Omit<React.ComponentProps<typeof Input>, 'id'> & {
  id?: string
  label: string
}

export function AuthTextField({
  id,
  label,
  className,
  ...props
}: AuthTextFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <div className="w-full">
      <Label htmlFor={inputId} className="sr-only">
        {label}
      </Label>
      <Input
        id={inputId}
        className={cn(
          'h-12 rounded-[10px] border border-border bg-muted/25 px-3.5 py-0 text-[14px] font-semibold shadow-none transition-colors placeholder:text-[13px] placeholder:font-medium hover:border-primary/35 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 dark:bg-card/80',
          className,
        )}
        {...props}
      />
    </div>
  )
}
