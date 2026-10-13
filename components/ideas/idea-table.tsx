'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, ArrowDown, TrendingUp, Heart, Building, Globe, ChevronDown, Users } from 'lucide-react'
import type { Idea, IdeaTheme } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useFormatter } from 'next-intl'

interface IdeaTableProps {
  ideas: Idea[]
  onIdeaClick?: (idea: Idea) => void
  className?: string
}

const themeIcons: Record<string, React.ReactNode> = {
  'increase-revenue': <TrendingUp className="h-3.5 w-3.5" />,
  'win-enterprise': <Building className="h-3.5 w-3.5" />,
  'delight-users': <Heart className="h-3.5 w-3.5" />,
  'expand-horizons': <Globe className="h-3.5 w-3.5" />,
}

export function IdeaTable({ ideas, onIdeaClick, className }: IdeaTableProps) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === ideas.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ideas.map(i => i.id)))
    }
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      {/* Table Header */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
        <div className="w-8">
          <Checkbox
            checked={selectedIds.size === ideas.length && ideas.length > 0}
            onCheckedChange={toggleSelectAll}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <button className="flex items-center gap-1 hover:text-foreground">
            <UiText id="aa_ozet_73faf9f8" /><Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="w-[180px]">
          <button className="flex items-center gap-1 hover:text-foreground">
            <UiText id="theme_a797e309" /></button>
        </div>
        <div className="w-[100px]">
          <button className="flex items-center gap-1 hover:text-foreground">
            <UiText id="fx_rice_score_0f15ea40" /><ArrowDown className="h-3 w-3" />
          </button>
        </div>
        <div className="w-[100px]">
          <button className="flex items-center gap-1 hover:text-foreground">
            <UiText id="impact_62036a70" /></button>
        </div>
        <div className="w-[80px]">
          <button className="flex items-center gap-1 hover:text-foreground">
            <UiText id="ongor_4201784e" /></button>
        </div>
        <div className="w-[150px]">
          <button className="flex items-center gap-1 hover:text-foreground">
            <UiText id="customer_segments_07b7111a" /></button>
        </div>
        <div className="w-8">
          <Plus className="h-4 w-4" />
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-border">
        {ideas.map((idea) => (
          <IdeaRow
            key={idea.id}
            idea={idea}
            isSelected={selectedIds.has(idea.id)}
            onSelect={() => toggleSelect(idea.id)}
            onClick={() => onIdeaClick?.(idea)}
          />
        ))}
      </div>

      {/* Add Row */}
      <button className="flex w-full items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50">
        <Plus className="h-4 w-4" />
        <UiText id="olustur_91ec37e6" /></button>
    </div>
  )
}

interface IdeaRowProps {
  idea: Idea
  isSelected: boolean
  onSelect: () => void
  onClick: () => void
}

function IdeaRow({ idea, isSelected, onSelect, onClick }: IdeaRowProps) {
  const formatter = useFormatter()
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/30',
        isSelected && 'bg-primary/5'
      )}
    >
      <div className="w-8">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </div>
      
      {/* Summary */}
      <div className="flex-1 min-w-[200px]">
        <button
          onClick={onClick}
          className="text-left text-sm text-foreground hover:text-primary hover:underline"
        >
          {idea.summary}
        </button>
      </div>

      {/* Theme */}
      <div className="w-[180px]">
        {idea.theme && <ThemeBadge theme={idea.theme} />}
      </div>

      {/* RICE Score */}
      <div className="w-[100px]">
        <Badge variant="secondary" className="bg-primary/10 text-primary font-medium">
          {formatter.number(idea.riceScore)}
        </Badge>
      </div>

      {/* Impact */}
      <div className="w-[100px]">
        <ImpactDots value={idea.impact} />
      </div>

      {/* Effort */}
      <div className="w-[80px]">
        {idea.effort ? (
          <span className="text-sm text-muted-foreground">{idea.effort}</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>

      {/* Customer Segments */}
      <div className="w-[150px]">
        {idea.customerSegments && idea.customerSegments.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {idea.customerSegments.map((segment) => (
              <Badge key={segment} variant="outline" className="text-xs">
                <Users className="mr-1 h-3 w-3" />
                {idea.customerSegments!.length}
                <span className="ml-1">{segment}</span>
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>

      <div className="w-8" />
    </div>
  )
}

function ThemeBadge({ theme }: { theme: IdeaTheme }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: theme.color + '20', color: theme.color }}>
        {themeIcons[theme.id] || <TrendingUp className="h-3 w-3" />}
      </span>
      <span className="text-xs text-foreground">{theme.name}</span>
    </div>
  )
}

function ImpactDots({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            i <= value ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  )
}
