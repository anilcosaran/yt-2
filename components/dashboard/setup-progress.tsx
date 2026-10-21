'use client'

import Link from 'next/link'
import { Check, Rocket } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { DashboardTranslator, SetupStep } from './dashboard-model'

/**
 * Setting up, kept small: a pill with how far along it is; the steps open in a popover as hairline-separated rows,
 * each with its one action. Gone once every step is done.
 */
export function SetupProgress({ t, steps, done }: { t: DashboardTranslator; steps: SetupStep[]; done: boolean[] }) {
  const finished = done.filter(Boolean).length
  if (finished === steps.length) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-border px-3 text-[14px] font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
        >
          <Rocket className="size-4 text-muted-foreground" />
          {t('completeSetup')}
          <span className="flex gap-0.5" aria-hidden>
            {steps.map((step, index) => (
              <span key={step.href} className={cn('h-1 w-2.5 rounded-full', done[index] ? 'bg-foreground' : 'bg-border')} />
            ))}
          </span>
          <span className="tabular-nums text-muted-foreground">{finished}/{steps.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[380px] rounded-xl p-0">
        <div className="px-5 pb-4 pt-5">
          <p className="font-display text-[17px] text-foreground">{t('completeSetup')}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">{t('growth.setupSubtitle')}</p>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {steps.map((step, index) => (
            <li key={step.href} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
              {done[index] ? (
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" />
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="inline-flex h-8 shrink-0 items-center rounded-full bg-muted px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/[0.12]"
                >
                  {step.cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
