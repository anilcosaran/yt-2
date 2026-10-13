'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, CircleAlert, Loader2, PenLine, ShieldCheck, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  activateReviewedSkillRevision,
  type SkillAuthoringCard,
  type SkillDiffCard,
  type SkillResultCard,
  type SkillSavedCard,
} from '@/lib/assistant/skill-authoring'

/**
 * P01D-11 saved / diff / result cards of the Chat skill authoring tools. They reuse the chat's workflow draft card
 * frame (same container, icon tile, title, subtitle, pill row and outline button) so a skill result reads like every
 * other assistant action. The only action is the explicit, digest-bound activation of a reviewed revision (K78).
 */

type SkillCardTranslator = (key: string, values?: Record<string, string | number>) => string

const CARD_FRAME = 'flex w-[min(620px,92vw)] items-center gap-3 rounded-[14px] border border-border/80 bg-card p-3 text-card-foreground shadow-[0_16px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white dark:shadow-[0_16px_44px_rgba(0,0,0,0.24)]'
const ICON_TILE = 'flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground ring-1 ring-border/80 dark:bg-white/10 dark:text-white dark:ring-white/8'
const PILL = 'rounded-full border border-border px-2 py-0.5 font-medium text-muted-foreground dark:border-white/12 dark:text-white/56'
const ACTION_BUTTON = 'h-10 cursor-pointer rounded-[10px] border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-colors hover:bg-muted dark:border-white/22 dark:bg-white/[0.035] dark:text-white dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] dark:hover:border-white/42 dark:hover:bg-white/[0.075] dark:hover:text-white'

export function SkillAuthoringCards({ cards, messageId }: { cards: SkillAuthoringCard[]; messageId: string }) {
  const t = useTranslations('Chat') as unknown as SkillCardTranslator
  if (cards.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {cards.map((card, index) => {
        const key = `${messageId}:${index}`
        if (card.schema_version === 'skill_saved_card_v1') return <SkillSavedCardView key={key} card={card} t={t} />
        if (card.schema_version === 'skill_diff_card_v1') return <SkillDiffCardView key={key} card={card} t={t} />
        return <SkillResultCardView key={key} card={card} t={t} messageId={messageId} />
      })}
    </div>
  )
}

function CardFrame({ icon, title, subtitle, pills, children }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  pills: Array<{ label: string; tone?: 'default' | 'attention' }>
  children?: React.ReactNode
}) {
  return (
    <div className={CARD_FRAME}>
      <div className={ICON_TILE}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground dark:text-white">{title}</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground dark:text-white/58">{subtitle}</p>
        {pills.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground dark:text-white/44">
            {pills.map((pill, index) => (
              <span key={`${pill.label}:${index}`} className={pill.tone === 'attention' ? 'text-amber-700 dark:text-amber-100' : PILL}>
                {pill.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children && <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>}
    </div>
  )
}

function skillTitle(skill: { name: string; revision_number: number | null } | null, t: SkillCardTranslator) {
  if (!skill) return t('skillCard.untitled')
  return skill.revision_number ? t('skillCard.revisionTitle', { name: skill.name, revision: skill.revision_number }) : skill.name
}

function SkillSavedCardView({ card, t }: { card: SkillSavedCard; t: SkillCardTranslator }) {
  const pills: Array<{ label: string; tone?: 'default' | 'attention' }> = []
  if (card.outcome === 'draft_saved') {
    pills.push({ label: t('skillCard.draft') })
    if (card.authored_by === 'ai_draft') pills.push({ label: t('skillCard.aiDraft') })
    if (card.diff_summary) {
      pills.push({ label: t('skillCard.linesChanged', { added: card.diff_summary.lines_added, removed: card.diff_summary.lines_removed }) })
    }
  }
  const subtitle = card.outcome === 'draft_saved'
    ? t('skillCard.savedSubtitle')
    : card.outcome === 'needs_input'
      ? t('skillCard.questionsSubtitle')
      : t('skillCard.notSavedSubtitle')
  return (
    <div className="flex flex-col gap-2">
      <CardFrame icon={<Sparkles className="size-5" />} title={skillTitle(card.skill, t)} subtitle={subtitle} pills={pills} />
      {card.outcome === 'needs_input' && card.questions.length > 0 && (
        <ol className="ml-1 list-decimal space-y-1 pl-5 text-sm text-foreground dark:text-white">
          {card.questions.map((question) => <li key={question.id}>{question.text}</li>)}
        </ol>
      )}
    </div>
  )
}

function SkillDiffCardView({ card, t }: { card: SkillDiffCard; t: SkillCardTranslator }) {
  const pills: Array<{ label: string; tone?: 'default' | 'attention' }> = []
  if (card.body.changed) pills.push({ label: t('skillCard.linesChanged', { added: card.body.lines_added, removed: card.body.lines_removed }) })
  for (const field of card.manifest.slice(0, 4)) pills.push({ label: field.field })
  for (const section of card.authoring.slice(0, 3)) pills.push({ label: section.section })
  const addedCapabilities = card.manifest.find((field) => field.field === 'required_capabilities')?.added ?? []
  for (const capability of addedCapabilities.slice(0, 3)) {
    pills.push({ label: t('skillCard.newCapability', { capability }), tone: 'attention' })
  }
  const subtitle = card.baseline
    ? t('skillCard.diffSubtitle', { from: card.baseline.revision_number, to: card.skill.revision_number ?? 0 })
    : t('skillCard.firstRevision')
  return <CardFrame icon={<PenLine className="size-5" />} title={skillTitle(card.skill, t)} subtitle={subtitle} pills={pills} />
}

function SkillResultCardView({ card, t, messageId }: { card: SkillResultCard; t: SkillCardTranslator; messageId: string }) {
  if (card.kind === 'activation_review' && card.review && card.skill?.skill_revision_id) {
    return <SkillActivationReviewCard card={card} review={card.review} t={t} messageId={messageId} />
  }
  if (card.status === 'failed' && card.kind !== 'validate') {
    return (
      <CardFrame
        icon={<CircleAlert className="size-5" />}
        title={skillTitle(card.skill, t)}
        subtitle={t('skillCard.failedSubtitle')}
        pills={card.reason ? [{ label: card.reason, tone: 'attention' }] : []}
      />
    )
  }
  if (card.kind === 'search') {
    const items = card.items ?? []
    return (
      <div className="flex flex-col gap-2">
        <CardFrame icon={<Sparkles className="size-5" />} title={t('skillCard.searchTitle')} subtitle={t('skillCard.searchSubtitle', { count: items.length })} pills={[]} />
        {items.length > 0 && (
          <ul className="ml-1 space-y-1 pl-1 text-sm text-foreground dark:text-white">
            {items.slice(0, 8).map((item) => (
              <li key={item.skill_id} className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{item.name}</span>
                <span className={PILL}>{item.source}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  if (card.kind === 'read') {
    return (
      <CardFrame
        icon={<Sparkles className="size-5" />}
        title={skillTitle(card.skill, t)}
        subtitle={card.excerpt?.description || t('skillCard.readSubtitle')}
        pills={(card.excerpt?.required_capabilities ?? []).slice(0, 5).map((capability) => ({ label: capability }))}
      />
    )
  }
  if (card.kind === 'validate') {
    const ok = card.validation?.ok === true
    const codes = [...new Set([...(card.validation?.finding_codes ?? []), ...(card.validation?.issues ?? []).map((issue) => issue.code)])]
    return (
      <CardFrame
        icon={ok ? <ShieldCheck className="size-5" /> : <CircleAlert className="size-5" />}
        title={skillTitle(card.skill, t)}
        subtitle={ok ? t('skillCard.validSubtitle') : t('skillCard.invalidSubtitle')}
        pills={codes.slice(0, 5).map((code) => ({ label: code, tone: 'attention' as const }))}
      />
    )
  }
  if (card.kind === 'test') {
    return (
      <CardFrame
        icon={<ShieldCheck className="size-5" />}
        title={skillTitle(card.skill, t)}
        subtitle={card.status === 'not_available' ? t('skillCard.testNotAvailable') : card.status === 'ok' ? t('skillCard.testPassed') : t('skillCard.testFailed')}
        pills={[]}
      />
    )
  }
  return (
    <CardFrame icon={<Check className="size-5" />} title={skillTitle(card.skill, t)} subtitle={t('skillCard.deactivatedSubtitle')} pills={[]} />
  )
}

function SkillActivationReviewCard({ card, review, t, messageId }: {
  card: SkillResultCard
  review: NonNullable<SkillResultCard['review']>
  t: SkillCardTranslator
  messageId: string
}) {
  const [state, setState] = React.useState<'idle' | 'pending' | 'done' | 'error'>('idle')
  const [errorCode, setErrorCode] = React.useState<string | null>(null)
  const activate = review.actions.find((action) => action.kind === 'activate')
  const pills: Array<{ label: string; tone?: 'default' | 'attention' }> = []
  if (review.risk.level) {
    pills.push({ label: t('skillCard.risk', { level: review.risk.level }), tone: review.risk.raised ? 'attention' : 'default' })
  }
  for (const capability of review.capabilities.filter((item) => item.status !== 'owner_resolves_at_dispatch').slice(0, 3)) {
    pills.push({ label: t('skillCard.capabilityStatus', { capability: capability.ref, status: capability.status }), tone: 'attention' })
  }
  if (review.conflicts > 0) pills.push({ label: t('skillCard.conflicts', { count: review.conflicts }), tone: 'attention' })
  if (review.test_status === 'not_available') pills.push({ label: t('skillCard.testNotAvailable') })

  async function handleActivate() {
    if (!card.skill?.skill_revision_id || state === 'pending' || state === 'done') return
    setState('pending')
    setErrorCode(null)
    try {
      await activateReviewedSkillRevision({
        skillId: card.skill.skill_id,
        revisionId: card.skill.skill_revision_id,
        reviewDigestSha256: review.review_digest_sha256,
        // Stable per card: a double click or a retry is the same accepted step.
        idempotencyKey: `skill-activate:${messageId}:${review.review_digest_sha256.slice(0, 16)}`,
      })
      setState('done')
    } catch (error) {
      setErrorCode(typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : 'UNKNOWN')
      setState('error')
    }
  }

  const subtitle = state === 'done'
    ? t('skillCard.activatedSubtitle')
    : state === 'error'
      ? errorCode === 'ASSISTANT_SKILL_REVIEW_STALE' ? t('skillCard.reviewStale') : t('skillCard.activationFailed')
      : activate?.allowed
        ? t('skillCard.reviewSubtitle')
        : t('skillCard.activationUnavailable', { reason: activate?.reason ?? 'not_offered' })
  return (
    <CardFrame icon={<ShieldCheck className="size-5" />} title={skillTitle(card.skill, t)} subtitle={subtitle} pills={pills}>
      {activate?.allowed && state !== 'done' && (
        <Button type="button" variant="outline" size="sm" className={ACTION_BUTTON} onClick={handleActivate} disabled={state === 'pending'}>
          {state === 'pending' ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('skillCard.activateInChat')}
        </Button>
      )}
      {state === 'done' && (
        <span className={PILL}>
          <Check className="mr-1 inline size-3.5" />
          {t('skillCard.activated')}
        </span>
      )}
    </CardFrame>
  )
}
