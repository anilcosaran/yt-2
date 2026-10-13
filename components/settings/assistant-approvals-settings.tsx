'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { Ban, Coins, Gauge, Loader2, ShieldCheck, Users } from 'lucide-react'

import { SettingRow, SettingsList } from '@/components/settings/setting-row'
import { AppAlertDialog } from '@/components/ui/app-alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  autoFloorMaxCredits,
  revokeFullAccess,
  saveAutoAskFloor,
  saveFullAccessLimit,
  saveFullAccessMembersSwitch,
  saveJobCap,
  type SettingsSaveResult,
} from '@/lib/assistant/approvals-settings'
import {
  FULL_ACCESS_STATE_QUERY_KEY,
  getFullAccessState,
  type FullAccessState,
} from '@/lib/assistant/full-access-api'
import { formatCredits, parseCreditsInput } from '@/lib/assistant/full-access-flow'
import {
  ASSISTANT_SPEND_POLICY_QUERY_KEY,
  getAssistantSpendPolicy,
  type AssistantSpendPolicy,
} from '@/lib/assistant/spend-policy-api'

/**
 * Y1-02 Settings > Approvals (Yol 1 decisions 5-7): where the user manages Full access and when the assistant asks about
 * money. Full access consent (revoke), the Full access approval limit (on at 1000 credits by default, changeable,
 * can be turned off), the owner / admin switch for members, the Auto "don't ask below N" floor and the optional own
 * cap on one job. Every value is server state, saved with a version check; the balance stop is never loosened here.
 */

type Translator = (key: string, values?: Record<string, string | number>) => string

export function ApprovalsSettingsSection() {
  const t = useTranslations('Settings') as unknown as Translator
  const fullAccess = useQuery({
    queryKey: FULL_ACCESS_STATE_QUERY_KEY,
    queryFn: ({ signal }) => getFullAccessState({ signal }),
    retry: 1,
  })
  const policy = useQuery({
    queryKey: ASSISTANT_SPEND_POLICY_QUERY_KEY,
    queryFn: ({ signal }) => getAssistantSpendPolicy({ signal }),
    retry: 1,
  })
  if (!fullAccess.data && !fullAccess.isError) {
    return (
      <div className="flex flex-col gap-3" data-approvals-state="loading">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }
  if (!fullAccess.data) {
    return (
      <p role="alert" className="py-6 text-sm text-muted-foreground" data-approvals-state="error">
        {t('approvals.loadFailed')}
      </p>
    )
  }
  return <ApprovalsSettingsView state={fullAccess.data} policy={policy.data ?? null} />
}

export function ApprovalsSettingsView({ state, policy }: { state: FullAccessState; policy: AssistantSpendPolicy | null }) {
  const t = useTranslations('Settings') as unknown as Translator
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [notice, setNotice] = React.useState<SettingsSaveResult | null>(null)
  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: FULL_ACCESS_STATE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ASSISTANT_SPEND_POLICY_QUERY_KEY }),
    ])
  }, [queryClient])
  const run = React.useCallback(async (action: () => Promise<SettingsSaveResult>): Promise<SettingsSaveResult> => {
    const result = await action()
    setNotice(result)
    // A conflict or a failure re-reads the server state so the page never shows an unsaved guess.
    await refresh()
    return result
  }, [refresh])

  return (
    <div data-approvals-state="ready">
      <p className="pb-4 text-sm leading-5 text-muted-foreground">{t('approvals.intro')}</p>
      <SettingsList>
        <FullAccessConsentRow state={state} run={run} />
        {state.limit && <FullAccessLimitRow state={state} run={run} />}
        {state.workspace_policy.can_manage && <MembersRow state={state} run={run} />}
        {policy && policy.auto_ask_min_credits !== undefined && <AutoFloorRow policy={policy} run={run} />}
        {policy && policy.job_max_credits !== undefined && <JobCapRow policy={policy} run={run} />}
      </SettingsList>
      {notice && (
        <p
          role={notice === 'saved' ? 'status' : 'alert'}
          className={notice === 'saved' ? 'pt-3 text-xs text-success' : 'pt-3 text-xs text-amber-700 dark:text-amber-100'}
          data-approvals-result={notice}
        >
          {notice === 'saved'
            ? t('approvals.saved')
            : notice === 'conflict'
              ? t('approvals.conflict')
              : notice === 'above_ceiling'
                ? t('approvals.aboveCeiling', { credits: formatCredits(autoFloorMaxCredits(policy) ?? 0, locale) })
                : t('approvals.failed')}
        </p>
      )}
    </div>
  )
}

type RunAction = (action: () => Promise<SettingsSaveResult>) => Promise<SettingsSaveResult>

function Help({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{children}</p>
}

function FullAccessConsentRow({ state, run }: { state: FullAccessState; run: RunAction }) {
  const t = useTranslations('Settings') as unknown as Translator
  const format = useFormatter()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const status = t(`approvals.consent.${state.consent_state}`, {
    date: state.consent ? format.dateTime(new Date(state.consent.accepted_at), { dateStyle: 'medium' }) : '',
  })
  // A consent can be withdrawn while one exists (also when the workspace currently blocks it).
  const canRevoke = state.consent !== null && state.consent.revoked_at === null
  return (
    <SettingRow label={t('approvals.consent.label')} icon={ShieldCheck}>
      <div className="min-w-0 sm:text-right">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <span className="text-sm text-foreground" data-full-access-consent-state={state.consent_state}>{status}</span>
          {canRevoke && (
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirming(true)}>
              {t('approvals.consent.revoke')}
            </Button>
          )}
        </div>
        <Help>{t('approvals.consent.help')}</Help>
      </div>
      <AppAlertDialog
        open={confirming}
        tone="warning"
        title={t('approvals.consent.revokeTitle')}
        description={t('approvals.consent.revokeDescription')}
        confirmLabel={t('approvals.consent.revokeConfirm')}
        cancelLabel={t('approvals.cancel')}
        closeLabel={t('approvals.close')}
        busy={busy}
        onOpenChange={(open) => { if (!busy) setConfirming(open) }}
        onConfirm={() => {
          setBusy(true)
          void run(() => revokeFullAccess()).finally(() => {
            setBusy(false)
            setConfirming(false)
          })
        }}
      />
    </SettingRow>
  )
}

function FullAccessLimitRow({ state, run }: { state: FullAccessState; run: RunAction }) {
  const t = useTranslations('Settings') as unknown as Translator
  const locale = useLocale()
  const limit = state.limit!
  const [busy, setBusy] = React.useState(false)
  const save = async (change: { enabled: boolean; credits?: number | null }) => {
    setBusy(true)
    try {
      return await run(() => saveFullAccessLimit(state, change))
    } finally {
      setBusy(false)
    }
  }
  return (
    <SettingRow label={t('approvals.limit.label')} icon={Gauge}>
      <div className="min-w-0 sm:text-right">
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-sm text-muted-foreground">{t('approvals.limit.switch')}</span>
          <Switch
            checked={limit.enabled}
            disabled={busy}
            onCheckedChange={(enabled) => void save({ enabled })}
            aria-label={t('approvals.limit.switch')}
          />
        </div>
        {limit.enabled && (
          <div className="mt-2 sm:flex sm:justify-end">
            <CreditsField
              key={`limit:${limit.limit_version}:${limit.credits ?? 'default'}`}
              value={limit.credits ?? limit.default_credits}
              ariaLabel={t('approvals.limit.amount')}
              busy={busy}
              onSave={(credits) => save({ enabled: true, credits })}
              resetLabel={limit.source === 'user' ? t('approvals.limit.useDefault', { credits: formatCredits(limit.default_credits, locale) }) : null}
              onReset={() => save({ enabled: true, credits: null })}
            />
          </div>
        )}
        <Help>
          {limit.enabled
            ? t('approvals.limit.helpOn', { credits: formatCredits(limit.effective_credits ?? limit.default_credits, locale) })
            : t('approvals.limit.helpOff')}
        </Help>
        <Help>{t('approvals.limit.skipHint')}</Help>
      </div>
    </SettingRow>
  )
}

function MembersRow({ state, run }: { state: FullAccessState; run: RunAction }) {
  const t = useTranslations('Settings') as unknown as Translator
  const [busy, setBusy] = React.useState(false)
  return (
    <SettingRow label={t('approvals.members.label')} icon={Users}>
      <div className="min-w-0 sm:text-right">
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-sm text-muted-foreground">{t('approvals.members.switch')}</span>
          <Switch
            checked={state.workspace_policy.allow_members}
            disabled={busy}
            onCheckedChange={(allow) => {
              setBusy(true)
              void run(() => saveFullAccessMembersSwitch(state, allow)).finally(() => setBusy(false))
            }}
            aria-label={t('approvals.members.switch')}
          />
        </div>
        <Help>{t('approvals.members.help')}</Help>
      </div>
    </SettingRow>
  )
}

function AutoFloorRow({ policy, run }: { policy: AssistantSpendPolicy; run: RunAction }) {
  const t = useTranslations('Settings') as unknown as Translator
  const locale = useLocale()
  const [busy, setBusy] = React.useState(false)
  const own = policy.auto_ask_min_credits ?? null
  const effective = policy.auto_threshold?.effective_floor_credits ?? null
  const maxCredits = autoFloorMaxCredits(policy)
  const save = async (credits: number | null) => {
    setBusy(true)
    try {
      return await run(() => saveAutoAskFloor(policy, credits))
    } finally {
      setBusy(false)
    }
  }
  return (
    <SettingRow label={t('approvals.autoFloor.label')} icon={Coins}>
      <div className="min-w-0 sm:text-right">
        <div className="sm:flex sm:justify-end">
          <CreditsField
            key={`floor:${policy.policy_version}:${own ?? 'default'}`}
            value={own ?? effective}
            allowZero
            ariaLabel={t('approvals.autoFloor.amount')}
            busy={busy}
            onSave={save}
            resetLabel={own !== null ? t('approvals.autoFloor.useDefault') : null}
            onReset={() => save(null)}
          />
        </div>
        <Help>
          {effective !== null
            ? t('approvals.autoFloor.help', { credits: formatCredits(effective, locale) })
            : t('approvals.autoFloor.helpUnknown')}
        </Help>
        {maxCredits !== null && <Help>{t('approvals.autoFloor.max', { credits: formatCredits(maxCredits, locale) })}</Help>}
      </div>
    </SettingRow>
  )
}

function JobCapRow({ policy, run }: { policy: AssistantSpendPolicy; run: RunAction }) {
  const t = useTranslations('Settings') as unknown as Translator
  const locale = useLocale()
  const [busy, setBusy] = React.useState(false)
  const own = policy.job_max_credits ?? null
  const tenantCap = policy.tenant_job_cap_credits ?? null
  const save = async (credits: number | null) => {
    setBusy(true)
    try {
      return await run(() => saveJobCap(policy, credits))
    } finally {
      setBusy(false)
    }
  }
  return (
    <SettingRow label={t('approvals.jobCap.label')} icon={Ban}>
      <div className="min-w-0 sm:text-right">
        <div className="sm:flex sm:justify-end">
          <CreditsField
            key={`cap:${policy.policy_version}:${own ?? 'none'}`}
            value={own}
            placeholder={t('approvals.jobCap.none')}
            ariaLabel={t('approvals.jobCap.amount')}
            busy={busy}
            onSave={save}
            resetLabel={own !== null ? t('approvals.jobCap.clear') : null}
            onReset={() => save(null)}
          />
        </div>
        <Help>{t('approvals.jobCap.help')}</Help>
        {tenantCap !== null && <Help>{t('approvals.jobCap.tenant', { credits: formatCredits(tenantCap, locale) })}</Help>}
      </div>
    </SettingRow>
  )
}

/** One credit amount: a text field with Save, and an optional "back to default / clear" action. */
export function CreditsField({
  value,
  allowZero = false,
  placeholder,
  ariaLabel,
  busy,
  onSave,
  resetLabel,
  onReset,
}: {
  value: number | null
  allowZero?: boolean
  placeholder?: string
  ariaLabel: string
  busy: boolean
  onSave: (credits: number) => void | Promise<unknown>
  resetLabel: string | null
  onReset: () => void | Promise<unknown>
}) {
  const t = useTranslations('Settings') as unknown as Translator
  const [text, setText] = React.useState(value === null ? '' : String(value))
  const parsed = parseCreditsInput(text, { allowZero })
  const unchanged = parsed.ok && parsed.value === value
  const showInvalid = text.trim() !== '' && !parsed.ok
  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <Input
        value={text}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={showInvalid || undefined}
        disabled={busy}
        onChange={(event) => setText(event.target.value)}
        className="h-8 w-28 shadow-none"
      />
      <span className="text-xs text-muted-foreground">{t('approvals.creditsUnit')}</span>
      <Button
        type="button"
        size="sm"
        className="h-8 px-3 text-xs"
        disabled={busy || !parsed.ok || unchanged}
        onClick={() => { if (parsed.ok) void onSave(parsed.value) }}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : t('approvals.save')}
      </Button>
      {resetLabel && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={busy} onClick={() => void onReset()}>
          {resetLabel}
        </Button>
      )}
      {showInvalid && <p role="alert" className="basis-full text-xs text-destructive">{t('approvals.invalidAmount')}</p>}
    </div>
  )
}
