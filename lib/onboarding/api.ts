'use client'

import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

export const onboardingAccountTypeSchema = z.enum(['personal', 'organization'])
export const onboardingGoalSchema = z.enum([
  'monetization',
  'multi_channel',
  'brand_growth',
  'sales_video',
  'automated_content',
  'grow_existing_channel',
])
export const onboardingChannelCountRangeSchema = z.enum([
  'one',
  'one_to_three',
  'three_to_five',
  'five_plus',
])
export const onboardingPainPointSchema = z.enum([
  'cost_control',
  'output_quality',
  'no_views',
  'youtube_safety',
  'process_management',
  'getting_started',
])

export const completeOnboardingInputSchema = z.object({
  account_type: onboardingAccountTypeSchema,
  goals: z.array(onboardingGoalSchema).min(1),
  channel_count_range: onboardingChannelCountRangeSchema,
  referral_source: z.string().min(1),
  referral_code: z.string().nullable(),
  pain_point: onboardingPainPointSchema,
})

const completeOnboardingResponseSchema = z.object({
  data: z.object({
    tenant: z.unknown(),
    onboarding_profile: z.unknown(),
  }),
})

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingInputSchema>
export type OnboardingAccountType = z.infer<typeof onboardingAccountTypeSchema>
export type OnboardingGoal = z.infer<typeof onboardingGoalSchema>
export type OnboardingChannelCountRange = z.infer<typeof onboardingChannelCountRangeSchema>
export type OnboardingPainPoint = z.infer<typeof onboardingPainPointSchema>

export async function completeOnboarding(input: CompleteOnboardingInput) {
  const payload = completeOnboardingInputSchema.parse(input)
  return gatewayRequest('/api/v1/tenants/me/complete-onboarding', {
    method: 'POST',
    body: payload,
    csrf: true,
    schema: completeOnboardingResponseSchema,
  })
}
