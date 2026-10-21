'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  BadgePoundSterling,
  Building2,
  Check,
  Circle,
  CircleHelp,
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Search,
  Sparkles,
  UserRound,
  WandSparkles,
  Youtube,
  Zap,
} from 'lucide-react'

import {
  completeOnboarding,
  type CompleteOnboardingInput,
  type OnboardingAccountType,
  type OnboardingChannelCountRange,
  type OnboardingGoal,
  type OnboardingPainPoint,
} from '@/lib/onboarding/api'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { useTranslations } from 'next-intl'

type StepId = 'account' | 'goals' | 'channels' | 'referral' | 'pain'

type Choice<T extends string> = {
  value: T
  titleKey: string
  bodyKey: string
  icon: React.ElementType
}

const steps: StepId[] = ['account', 'goals', 'channels', 'referral', 'pain']

const accountChoices: Choice<OnboardingAccountType>[] = [
  {
    value: 'personal',
    titleKey: 'accountPersonalTitle',
    bodyKey: 'accountPersonalBody',
    icon: Sparkles,
  },
  {
    value: 'organization',
    titleKey: 'accountTeamTitle',
    bodyKey: 'accountTeamBody',
    icon: Building2,
  },
]

const goalChoices: Choice<OnboardingGoal>[] = [
  { value: 'monetization', titleKey: 'goalMonetizationTitle', bodyKey: 'goalMonetizationBody', icon: BadgePoundSterling },
  { value: 'multi_channel', titleKey: 'goalMultiChannelTitle', bodyKey: 'goalMultiChannelBody', icon: Zap },
  { value: 'brand_growth', titleKey: 'goalBrandGrowthTitle', bodyKey: 'goalBrandGrowthBody', icon: Sparkles },
  { value: 'sales_video', titleKey: 'goalSalesVideoTitle', bodyKey: 'goalSalesVideoBody', icon: WandSparkles },
  { value: 'automated_content', titleKey: 'goalAutomatedContentTitle', bodyKey: 'goalAutomatedContentBody', icon: Zap },
  { value: 'grow_existing_channel', titleKey: 'goalGrowChannelTitle', bodyKey: 'goalGrowChannelBody', icon: Youtube },
]

const channelChoices: Choice<OnboardingChannelCountRange>[] = [
  { value: 'one', titleKey: 'channelOneTitle', bodyKey: 'channelOneBody', icon: UserRound },
  { value: 'one_to_three', titleKey: 'channelOneToThreeTitle', bodyKey: 'channelOneToThreeBody', icon: Youtube },
  { value: 'three_to_five', titleKey: 'channelThreeToFiveTitle', bodyKey: 'channelThreeToFiveBody', icon: Building2 },
  { value: 'five_plus', titleKey: 'channelFivePlusTitle', bodyKey: 'channelFivePlusBody', icon: Zap },
]

const referralChoices = [
  { value: 'instagram', titleKey: 'referralInstagram', icon: Instagram },
  { value: 'twitter_x', titleKey: 'referralTwitter', icon: MessageCircle },
  { value: 'tiktok', titleKey: 'referralTikTok', icon: Zap },
  { value: 'youtube', titleKey: 'referralYouTube', icon: Youtube },
  { value: 'google_search', titleKey: 'referralGoogle', icon: Search },
  { value: 'linkedin', titleKey: 'referralLinkedIn', icon: Linkedin },
  { value: 'chatgpt', titleKey: 'referralChatGPT', icon: Sparkles },
  { value: 'reddit', titleKey: 'referralReddit', icon: CircleHelp },
  { value: 'facebook', titleKey: 'referralFacebook', icon: Facebook },
  { value: 'news_articles', titleKey: 'referralNews', icon: CircleHelp },
  { value: 'word_of_mouth', titleKey: 'referralWordOfMouth', icon: MessageCircle },
  { value: 'other', titleKey: 'referralOther', icon: Circle },
] as const

const painChoices: Choice<OnboardingPainPoint>[] = [
  { value: 'cost_control', titleKey: 'painCostsTitle', bodyKey: 'painCostsBody', icon: BadgePoundSterling },
  { value: 'output_quality', titleKey: 'painQualityTitle', bodyKey: 'painQualityBody', icon: WandSparkles },
  { value: 'no_views', titleKey: 'painViewsTitle', bodyKey: 'painViewsBody', icon: Search },
  { value: 'youtube_safety', titleKey: 'painSafetyTitle', bodyKey: 'painSafetyBody', icon: Youtube },
  { value: 'process_management', titleKey: 'painProcessTitle', bodyKey: 'painProcessBody', icon: Zap },
  { value: 'getting_started', titleKey: 'painGettingStartedTitle', bodyKey: 'painGettingStartedBody', icon: Sparkles },
]

export function OnboardingPage() {
  const tAuto = useTranslations('Auto')
  const tOnboarding = useTranslations('Onboarding')
  const localizeError = useLocalizedError()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stepIndex, setStepIndex] = React.useState(0)
  const [accountType, setAccountType] = React.useState<OnboardingAccountType | null>(null)
  const [goals, setGoals] = React.useState<OnboardingGoal[]>([])
  const [channelCountRange, setChannelCountRange] = React.useState<OnboardingChannelCountRange | null>(null)
  const [referralSource, setReferralSource] = React.useState<string | null>(null)
  const [painPoint, setPainPoint] = React.useState<OnboardingPainPoint | null>(null)
  const [showReassurance, setShowReassurance] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const step = steps[stepIndex]
  const progress = ((stepIndex + 1) / steps.length) * 100

  const referralCode = React.useMemo(() => {
    const code = searchParams.get('ref') ?? searchParams.get('referral_code')
    return code?.trim() ? code.trim() : null
  }, [searchParams])

  const canContinue =
    (step === 'account' && accountType) ||
    (step === 'goals' && goals.length > 0) ||
    (step === 'channels' && channelCountRange) ||
    (step === 'referral' && referralSource) ||
    (step === 'pain' && painPoint)

  function goBack() {
    setError(null)
    if (showReassurance) {
      setShowReassurance(false)
      return
    }
    if (stepIndex > 0) setStepIndex((value) => value - 1)
  }

  function goNext() {
    setError(null)
    if (step === 'goals' && goals.length === 1 && goals[0] === 'grow_existing_channel') {
      setChannelCountRange('one')
      setStepIndex(3)
      return
    }
    if (step === 'pain') {
      setShowReassurance(true)
      return
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1))
  }

  function toggleGoal(goal: OnboardingGoal) {
    setGoals((current) =>
      current.includes(goal)
        ? current.filter((item) => item !== goal)
        : [...current, goal],
    )
  }

  async function handleSubmit() {
    if (!accountType || goals.length === 0 || !channelCountRange || !referralSource || !painPoint) return

    const input: CompleteOnboardingInput = {
      account_type: accountType,
      goals,
      channel_count_range: channelCountRange,
      referral_source: referralSource,
      referral_code: referralCode,
      pain_point: painPoint,
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await completeOnboarding(input)
      router.replace('/offer-plan')
    } catch (submitError) {
      setError(localizeError(submitError))
      setShowReassurance(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-svh overflow-hidden bg-[#08090a] text-white">
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-white/10">
        <div className="h-full bg-[#c8ff16] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="relative mx-auto flex min-h-svh w-full max-w-7xl flex-col px-5 py-7 sm:px-8">
        <header className="flex items-center justify-between text-sm text-white/62">
          <button
            type="button"
            onClick={goBack}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full px-3 font-medium transition-colors hover:bg-white/[0.08] hover:text-white',
              stepIndex === 0 && !showReassurance && 'invisible',
            )}
          >
            <ArrowLeft className="size-4" />
            <UiText id="geri_4928cfc9" /></button>
          <p className="font-medium">{stepIndex + 1} of {steps.length}</p>
        </header>

        <section className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-5xl">
            {step === 'account' && (
              <StepShell
                title={tAuto('how_do_you_plan_to_use_youtorch_72bf7d36')}
                subtitle="We will tailor your workspace to your goals"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {accountChoices.map((choice) => (
                    <LargeChoiceCard
                      key={choice.value}
                      choice={choice}
                      selected={accountType === choice.value}
                      onClick={() => setAccountType(choice.value)}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 'goals' && (
              <StepShell title={tAuto('what_are_you_trying_to_build_5a6eb5c8')} subtitle="Pick every goal that matters right now">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {goalChoices.map((choice) => (
                    <LargeChoiceCard
                      key={choice.value}
                      choice={choice}
                      selected={goals.includes(choice.value)}
                      compact
                      onClick={() => toggleGoal(choice.value)}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 'channels' && (
              <StepShell title={tAuto('how_many_channels_will_you_manage_8430afe6')} subtitle="This helps us recommend the right plan">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {channelChoices.map((choice) => (
                    <LargeChoiceCard
                      key={choice.value}
                      choice={choice}
                      selected={channelCountRange === choice.value}
                      compact
                      onClick={() => setChannelCountRange(choice.value)}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 'referral' && (
              <StepShell title={tAuto('how_did_you_hear_about_us_eec24033')} subtitle={tOnboarding('referralSubtitle')}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {referralChoices.map((choice) => {
                    const Icon = choice.icon
                    const selected = referralSource === choice.value
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() => setReferralSource(choice.value)}
                        className={cn(
                          'flex h-20 items-center justify-between rounded-lg bg-[#1a1c1f] px-5 text-left transition-all hover:bg-[#22262a]',
                          selected && 'bg-[#2b2f32] ring-2 ring-[#c8ff16]',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-4">
                          <Icon className="size-5 shrink-0 text-white" />
                          <span className="truncate text-lg font-bold">{tOnboarding(choice.titleKey)}</span>
                        </span>
                        <SelectionDot selected={selected} />
                      </button>
                    )
                  })}
                </div>
              </StepShell>
            )}

            {step === 'pain' && (
              <StepShell title={tAuto('what_gets_in_the_way_most_often_e2c78ab7')} subtitle={tOnboarding('painSubtitle')}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {painChoices.map((choice) => (
                    <LargeChoiceCard
                      key={choice.value}
                      choice={choice}
                      selected={painPoint === choice.value}
                      compact
                      onClick={() => setPainPoint(choice.value)}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {error && (
              <p className="mx-auto mt-6 max-w-xl rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-100">
                {error}
              </p>
            )}

            <div className="mt-10 flex justify-center">
              <button
                type="button"
                disabled={!canContinue || isSubmitting}
                onClick={goNext}
                className="h-14 min-w-48 rounded-full bg-white px-8 text-base font-bold text-black transition-all hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40"
              >
                <UiText id="continue_2e026239" /></button>
            </div>
          </div>
        </section>
      </div>

      {showReassurance && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 px-5 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-[#121212] p-7 text-center shadow-2xl sm:p-10">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#c8ff16] text-black">
              <Check className="size-7" />
            </div>
            <h2 className="mt-7 text-4xl font-bold leading-tight tracking-normal sm:text-5xl">
              <UiText id="ai_does_not_have_to_feel_confusing_10b8cb1f" /></h2>
            <p className="mx-auto mt-4 max-w-lg text-base font-medium leading-7 text-white/62">
              <UiText id="your_first_workspace_will_start_with_the_plan_an_7c222f2d" /></p>
            {error && <p className="mt-5 text-sm font-semibold text-red-100">{error}</p>}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="mt-8 h-14 min-w-48 rounded-full bg-[#c8ff16] px-8 text-base font-bold text-black transition-all hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-50"
            >
              {isSubmitting ? tAuto('saving_ae7e8875') : tAuto('devam_et_ba789d8b')}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full">
      <div className="mx-auto mb-10 max-w-4xl text-center">
        <h1 className="text-balance text-4xl font-bold leading-[1.06] tracking-normal sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 text-lg font-medium leading-7 text-white/58">
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  )
}

function LargeChoiceCard<T extends string>({
  choice,
  selected,
  compact = false,
  onClick,
}: {
  choice: Choice<T>
  selected: boolean
  compact?: boolean
  onClick: () => void
}) {
  const tOnboarding = useTranslations('Onboarding')
  const Icon = choice.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex min-h-72 flex-col justify-center rounded-lg bg-[#1a1c1f] p-7 text-center transition-all hover:bg-[#22262a]',
        compact && 'min-h-40',
        selected && 'bg-[#2b2f32] ring-2 ring-[#c8ff16]',
      )}
    >
      <SelectionDot selected={selected} className="absolute right-5 top-5" />
      <Icon className="mx-auto size-8 text-white" />
      <h2 className="mt-7 text-2xl font-bold leading-tight tracking-normal">{tOnboarding(choice.titleKey)}</h2>
      <p className="mx-auto mt-3 max-w-xs text-base font-medium leading-6 text-white/58">{tOnboarding(choice.bodyKey)}</p>
    </button>
  )
}

function SelectionDot({ selected, className }: { selected: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border border-white/16 text-black',
        selected && 'border-[#c8ff16] bg-[#c8ff16]',
        className,
      )}
    >
      {selected && <Check className="size-4" />}
    </span>
  )
}
