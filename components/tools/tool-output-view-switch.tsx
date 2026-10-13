'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

export type ToolOutputView = 'history' | 'example'

export function ToolOutputViewSwitch({
  value,
  onValueChange,
  className,
}: {
  value: ToolOutputView
  onValueChange: (value: ToolOutputView) => void
  className?: string
}) {
  const tAuto = useTranslations('Auto')
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next === 'history' || next === 'example') onValueChange(next)
      }}
      variant="outline"
      size="sm"
      aria-label={tAuto('history_and_example_e34c2c03')}
      className={cn(
        'h-8 rounded-full border border-border bg-muted/40 p-0.5',
        className,
      )}
    >
      <ToggleGroupItem
        value="history"
        className="h-7 rounded-full px-3 text-xs font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
      >
        {tAuto('history_90ccd649')}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="example"
        className="h-7 rounded-full px-3 text-xs font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
      >
        {tAuto('example_0f01ed56')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
