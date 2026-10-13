'use client'

import { useTranslations } from 'next-intl'
import type { WorkflowAgentLaunchResult, WorkflowAgentStatusResult } from '@/lib/workflows/api'

type AdmissionRun = {
  launch: WorkflowAgentLaunchResult | null
  status: WorkflowAgentStatusResult | null
}

export function ToolAdmissionSummary({ runs }: { runs: AdmissionRun[] }) {
  const t = useTranslations('Workflows.runs')
  const waiting = runs.flatMap((run) => {
    const admission = run.status?.admission ?? run.launch?.admission
    const status = run.status?.status ?? (admission?.decision === 'parked' ? 'parked' : 'queued')
    const label = status === 'parked' ? 'admissionParked'
      : status === 'promoting' ? 'admissionPromoting'
        : status === 'waiting_for_credit' || status === 'failed_balance' ? 'admissionCredit'
          : status === 'expired' ? 'admissionExpired' : null
    if (!label) return []
    return [{ id: run.status?.workflowId || run.launch?.agent_id || '', admission, label }]
  })
  if (waiting.length === 0) return null
  return <div role="status" className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
    {waiting.map(({ id, admission, label }) => <div key={id}>
      <p>{t(label)} <code>{id}</code></p>
      {admission?.queue_position != null ? <p>{t('admissionPosition', { position: admission.queue_position })}</p> : null}
      {admission?.park_expires_at ? <p>{t('admissionExpiry', { expiry: admission.park_expires_at })}</p> : null}
    </div>)}
  </div>
}
