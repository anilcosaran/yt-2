'use client'

import { Download, Link2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { MediaDownloaderMetadataPreview } from '@/components/tools/media-downloader-metadata-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatYoutubeImportCreditAmount,
  type YoutubeImportQuote,
} from '@/lib/storage/youtube-import'
import { formatEstimatedMediaSize } from '@/lib/workflows/media-downloader-quote'
import { cn } from '@/lib/utils'

const SUPPORTED_SOURCE_LABELS = ['YouTube', 'Instagram', 'TikTok', 'Facebook'] as const

export function StorageYoutubeImportPanel({
  draft,
  error,
  quote,
  quoting,
  creditCheckFailed = false,
  creditCheckRetrying = false,
  canConfirm,
  disabled,
  idPrefix = 'storage-youtube',
  onDraftChange,
  onVariantChange,
  onRetryCreditCheck,
  onImport,
}: {
  draft: string
  error: string | null
  quote: YoutubeImportQuote | null
  quoting: boolean
  creditCheckFailed?: boolean
  creditCheckRetrying?: boolean
  canConfirm: boolean
  disabled: boolean
  idPrefix?: string
  onDraftChange: (value: string) => void
  onVariantChange?: (variantId: string) => void
  onRetryCreditCheck?: () => void
  onImport: () => void
}) {
  const tStorage = useTranslations('Storage')
  const describedBy = error ? `${idPrefix}-error` : `${idPrefix}-hint`

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 items-start justify-center overflow-y-auto p-4 sm:p-6">
      <form
        className="@container w-full max-w-2xl space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!disabled && !quoting && canConfirm) onImport()
        }}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
              <Link2 className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <h3 className="font-display text-base leading-tight text-foreground">
                {tStorage('picker.youtubePanelTitle')}
              </h3>
              <p id={`${idPrefix}-hint`} className="text-sm leading-relaxed text-muted-foreground">
                {tStorage('picker.youtubeHint')}
              </p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {SUPPORTED_SOURCE_LABELS.map((label) => (
              <li
                key={label}
                className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="sticky top-0 z-20 grid grid-cols-1 gap-2 bg-card py-1 @lg:grid-cols-[minmax(0,1fr)_12rem]">
          <Input
            autoFocus
            type="url"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={tStorage('picker.youtubePlaceholder')}
            aria-label={tStorage('picker.youtubePlaceholder')}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            disabled={disabled}
            className={cn(
              'h-11 min-w-0 rounded-xl bg-background shadow-none',
              error ? 'border-destructive focus-visible:ring-destructive' : 'border-border',
            )}
          />
          <Button
            type="submit"
            disabled={disabled || quoting || !canConfirm}
            className="h-11 w-full rounded-xl px-3 text-xs"
          >
            {quoting
              ? <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
              : <Download aria-hidden="true" className="size-4 shrink-0" />}
            {youtubeImportDownloadLabel(tStorage, quoting ? null : quote)}
          </Button>
        </div>

        {error ? (
          <p id={`${idPrefix}-error`} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        {creditCheckFailed ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3.5 py-3" role="alert">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm font-medium text-destructive">
                {tStorage('picker.youtubeCreditCheckFailed')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={creditCheckRetrying || disabled}
                onClick={onRetryCreditCheck}
                className="h-8 shrink-0 rounded-lg"
              >
                {creditCheckRetrying ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> : null}
                {tStorage('picker.youtubeCreditCheckRetry')}
              </Button>
            </div>
          </div>
        ) : null}

        <YoutubeImportQuoteCard
          quote={quote}
          quoting={quoting}
          disabled={disabled}
          onVariantChange={onVariantChange}
        />
      </form>
    </div>
  )
}

function youtubeImportDownloadLabel(
  tStorage: ReturnType<typeof useTranslations<'Storage'>>,
  quote: YoutubeImportQuote | null,
) {
  if (!quote?.snapshotId) return tStorage('picker.youtubeConfirm')
  return tStorage('picker.youtubeDownloadCredits', {
    cost: tStorage('picker.youtubeCreditAmount', {
      count: quote.credits,
      amount: formatYoutubeImportCreditAmount(quote.credits),
    }),
  })
}

function YoutubeImportQuoteCard({
  quote,
  quoting,
  disabled,
  onVariantChange,
}: {
  quote: YoutubeImportQuote | null
  quoting: boolean
  disabled: boolean
  onVariantChange?: (variantId: string) => void
}) {
  const tStorage = useTranslations('Storage')
  const tAuto = useTranslations('Auto')
  const readyQuote = quote?.snapshotId ? quote : null
  if (!readyQuote && !quoting) return null

  const controls = (
    <div className="space-y-3">
      {!readyQuote || readyQuote.variants.length > 0 ? (
        <label className="block min-w-0 space-y-2">
          <span className="text-sm font-semibold">{tStorage('picker.youtubeQuality')}</span>
          {readyQuote ? (
            <select
              value={readyQuote.variantId ?? ''}
              onChange={(event) => onVariantChange?.(event.target.value)}
              disabled={disabled || quoting}
              className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {readyQuote.variants.map((variant) => (
                <option key={variant.variantId} value={variant.variantId}>
                  {variant.label} · {formatEstimatedMediaSize(variant.estimatedMediaBytes)} · {formatYoutubeImportCreditAmount(variant.estimatedCredits)}
                </option>
              ))}
            </select>
          ) : <Skeleton aria-hidden="true" className="h-10 w-full rounded-xl" />}
        </label>
      ) : null}
      <dl className="grid grid-cols-2 gap-3" aria-busy={quoting}>
        {[
          {
            label: tAuto('media_downloader_estimated_size'),
            value: readyQuote?.estimatedMediaBytes != null ? formatEstimatedMediaSize(readyQuote.estimatedMediaBytes) : '—',
          },
          {
            label: tAuto('estimated_credits_7dbeefda'),
            value: readyQuote ? formatYoutubeImportCreditAmount(readyQuote.credits) : '—',
          },
        ].map((estimate) => (
          <div key={estimate.label} className="min-w-0 space-y-1.5">
            <dt className="text-[11px] leading-4 text-muted-foreground">{estimate.label}</dt>
            <dd className="text-sm font-medium tabular-nums leading-4">
              {quoting
                ? <Skeleton aria-hidden="true" className="h-4 w-16 max-w-full rounded-full" />
                : estimate.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )

  return (
    <div className="rounded-2xl border border-border bg-panel/40 p-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none sm:p-4">
      <MediaDownloaderMetadataPreview
        {...(readyQuote
          ? { state: 'ready' as const, metadata: readyQuote, refreshing: quoting }
          : { state: 'loading' as const })}
        loadingControls={controls}
      >
        {controls}
      </MediaDownloaderMetadataPreview>
    </div>
  )
}
