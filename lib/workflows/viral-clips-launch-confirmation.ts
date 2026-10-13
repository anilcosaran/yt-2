import type { ViralClipsQuotaSnapshot } from '@/lib/workflows/api'

type ViralClipsLaunchConfirmationPlan =
  | {
      messageKey: 'runs.viralClipsQuotaConfirmation'
      values: { credits: number }
    }
  | {
      messageKey: 'runs.viralClipsQuotaLimitedConfirmation'
      values: {
        remaining: number
        max: number
        credits: number
      }
    }

export function getViralClipsLaunchConfirmationPlan(
  quota: ViralClipsQuotaSnapshot | undefined,
  credits: number,
): ViralClipsLaunchConfirmationPlan | null {
  if (!quota) return null

  if (quota.limited) {
    return {
      messageKey: 'runs.viralClipsQuotaLimitedConfirmation',
      values: {
        remaining: quota.remaining_clips,
        max: quota.max_clips_this_run,
        credits,
      },
    }
  }

  return {
    messageKey: 'runs.viralClipsQuotaConfirmation',
    values: { credits },
  }
}
