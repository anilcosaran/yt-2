'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Plus, Calendar, Edit, ThumbsUp, MessageSquare, Heart, Smile, MoreHorizontal } from 'lucide-react'
import type { Goal, Risk } from '@/lib/types'
import { UiText } from '@/components/i18n/ui-text'
import { useFormatter, useTranslations } from 'next-intl'

interface GoalDetailPanelProps {
  goal: Goal
  className?: string
}

export function GoalDetailPanel({ goal, className }: GoalDetailPanelProps) {
  const format = useFormatter()
  const tGoals = useTranslations('Goals')
  return (
    <div className={cn('w-80 border-l border-border bg-card', className)}>
      <div className="p-4">
        {/* Progress Section */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-foreground"><UiText id="ilerleme_a30905c0" /></h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{tGoals('panel.fromKeyResult')}</span>
            <span className="text-muted-foreground">{goal.progress}%</span>
          </div>
          <Progress value={goal.progress} className="mt-2 h-1" />
        </div>

        {/* Owner */}
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-medium text-foreground"><UiText id="sahibi_d7bb78f3" /></h3>
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={goal.owner.avatar} alt={goal.owner.name} />
              <AvatarFallback className="text-xs">
                {goal.owner.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground">{goal.owner.name}</span>
          </div>
        </div>

        {/* Followers */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground"><UiText id="takipciler_f3b05dad" /></h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <button className="mt-1 text-sm text-primary hover:underline">
            <UiText id="takipci_ekleyin_6db75b74" /></button>
          {goal.followers.length > 0 && (
            <div className="mt-2 flex -space-x-1">
              {goal.followers.map((follower) => (
                <Avatar key={follower.id} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={follower.avatar} alt={follower.name} />
                  <AvatarFallback className="text-xs">
                    {follower.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
        </div>

        {/* Parent Goal */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground"><UiText id="ust_amac_446f3a20" /></h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Child Goals */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground"><UiText id="alt_amaclar_01f8a256" /></h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Type */}
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-medium text-foreground"><UiText id="tur_ac839d86" /></h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground"><UiText id="amac_d232a808" /></span>
          </div>
        </div>

        {/* Teams */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground"><UiText id="takimlar_3e7075a7" /></h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground"><UiText id="etiketler_b0d99439" /></h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Start Date */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground"><UiText id="baslangic_tarihi_b7ba0309" /></h3>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Edit className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {format.dateTime(new Date(goal.startDate), {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>
    </div>
  )
}

interface RiskItemProps {
  risk: Risk
}

export function RiskItem({ risk }: RiskItemProps) {
  const tGoals = useTranslations('Goals')
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-destructive/10 text-destructive">
          <span className="text-xs font-medium">!</span>
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground">{risk.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{risk.description}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar className="h-5 w-5">
          <AvatarImage src={risk.author.avatar} alt={risk.author.name} />
          <AvatarFallback className="text-xs">
            {risk.author.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span>
          {tGoals('panel.riskCreatedBy', { name: risk.author.name, date: risk.createdAt })}
        </span>
        <span>•</span>

        {/* Reaction buttons */}
        <div className="flex items-center gap-1">
          <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted">
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted">
            <span>👏</span>
          </button>
          <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted">
            <span>🎉</span>
          </button>
          <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted">
            <Heart className="h-3.5 w-3.5 text-destructive" />
          </button>
          <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted">
            <Smile className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
