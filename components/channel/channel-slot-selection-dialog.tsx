'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CHANNEL_SLOT_SELECTION_CHECK_EVENT,
  CHANNEL_SLOT_SELECTION_QUERY_KEY,
  CHANNELS_QUERY_KEY,
  confirmChannelSlotSelection,
  getPendingChannelSlotSelection,
  type Channel,
} from '@/lib/channel/api'
import { WORKSPACE_BOOTSTRAP_QUERY_KEY } from '@/lib/workspace/api'
import { cn } from '@/lib/utils'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

const SLOT_SELECTION_WATCH_MS = 15_000

const channelStatusKeys = {
  setup: 'statusSetup',
  connected: 'statusConnected',
  disconnected: 'statusDisconnected',
  plan_paused: 'statusPaused',
  removing: 'statusRemoving',
  removed: 'statusRemoved',
} as const

interface ChannelSlotSelectionDialogProps {
  channels: Channel[]
  enabled?: boolean
  onSelectionConfirmed?: (channelIds: string[]) => void
}

type ChannelSelectionRow = Pick<Channel, 'id' | 'name' | 'status'>

export function ChannelSlotSelectionDialog({ channels, enabled = true, onSelectionConfirmed }: ChannelSlotSelectionDialogProps) {
  const tAuto = useTranslations('Auto')
  const tChannels = useTranslations('Channels')
  const queryClient = useQueryClient()
  const localizeError = useLocalizedError()
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [watchUntil, setWatchUntil] = React.useState(0)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const selectionQuery = useQuery({
    queryKey: CHANNEL_SLOT_SELECTION_QUERY_KEY,
    queryFn: getPendingChannelSlotSelection,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
    enabled,
  })
  const selection = selectionQuery.data ?? null
  const channelById = React.useMemo(
    () => new Map(channels.map((channel) => [channel.id, channel])),
    [channels],
  )
  const candidateChannels = React.useMemo<ChannelSelectionRow[]>(
    () => (selection?.candidate_channel_ids ?? []).map((channelId) => {
      const channel = channelById.get(channelId)
      return channel
        ? { id: channel.id, name: channel.name, status: channel.status }
        : { id: channelId, name: tChannels('unknownChannel', { id: channelId.slice(0, 8) }), status: 'plan_paused' as Channel['status'] }
    }),
    [channelById, selection?.candidate_channel_ids, tChannels],
  )
  const selectableLimit = Math.max(0, selection?.selectable_limit ?? 0)
  const selectedCount = selectedIds.length
  const canSubmit = Boolean(selection) && selectedCount === selectableLimit
  const confirmMutation = useMutation({
    mutationFn: confirmChannelSlotSelection,
    onSuccess: async () => {
      onSelectionConfirmed?.(selectedIds)
      setErrorMessage(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CHANNEL_SLOT_SELECTION_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: WORKSPACE_BOOTSTRAP_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY }),
      ])
    },
  })

  React.useEffect(() => {
    if (!selection) {
      setSelectedIds([])
      setErrorMessage(null)
      return
    }

    const selected = selection.selected_channel_ids?.length
      ? selection.selected_channel_ids
      : selection.candidate_channel_ids.slice(0, selectableLimit)
    setSelectedIds(selected)
    setErrorMessage(null)
  }, [selectableLimit, selection])

  React.useEffect(() => {
    const handleSelectionCheck = () => {
      setWatchUntil(Date.now() + SLOT_SELECTION_WATCH_MS)
      void queryClient.invalidateQueries({ queryKey: CHANNEL_SLOT_SELECTION_QUERY_KEY })
    }

    window.addEventListener(CHANNEL_SLOT_SELECTION_CHECK_EVENT, handleSelectionCheck)
    return () => window.removeEventListener(CHANNEL_SLOT_SELECTION_CHECK_EVENT, handleSelectionCheck)
  }, [queryClient])

  React.useEffect(() => {
    if (selection || watchUntil <= Date.now()) return

    const timer = window.setInterval(() => {
      if (Date.now() > watchUntil) {
        window.clearInterval(timer)
        return
      }
      void selectionQuery.refetch()
    }, 1000)

    return () => window.clearInterval(timer)
  }, [selection, selectionQuery, watchUntil])

  const toggleChannel = (channelId: string) => {
    if (confirmMutation.isPending) return

    setSelectedIds((current) => {
      if (selectableLimit === 0) return current
      if (current.includes(channelId)) {
        return current.filter((id) => id !== channelId)
      }

      if (current.length >= selectableLimit) {
        return [...current.slice(1), channelId]
      }

      return [...current, channelId]
    })
  }

  const handleSubmit = async () => {
    if (!selection || !canSubmit || confirmMutation.isPending) return

    setErrorMessage(null)
    try {
      await confirmMutation.mutateAsync({
        selectionId: selection.selection_id,
        channelIds: selectedIds,
      })
    } catch (error) {
      setErrorMessage(localizeError(error))
    }
  }

  if (!selection) return null

  const targetPlan = formatPlanLabel(selection.new_plan)

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[520px]"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle>{tChannels('chooseChannelCount', { count: selectableLimit })}</DialogTitle>
            <Badge variant={canSubmit ? 'default' : 'secondary'} className="shrink-0">
              {selectedCount}/{selectableLimit}
            </Badge>
          </div>
          <DialogDescription className="mt-2 leading-6">
            {tChannels('planAllowsChannelCount', { plan: targetPlan, count: selectableLimit })}{' '}
            <strong className="font-semibold underline underline-offset-2"><UiText id="upgrade_plan_e80fe7c8" /></strong> {' '}<UiText id="to_keep_more_active_fd711140" /></DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle><UiText id="selection_could_not_be_saved_2e91aeb8" /></AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2 pr-1">
            {candidateChannels.map((channel) => {
              const checked = selectedIds.includes(channel.id)
              return (
                <label
                  key={channel.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors',
                    checked && 'border-primary bg-primary/5',
                    confirmMutation.isPending && 'cursor-wait opacity-70',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={confirmMutation.isPending || selectableLimit === 0}
                    onCheckedChange={() => toggleChannel(channel.id)}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-foreground">{channel.name}</span>
                      {checked ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {tChannels(channelStatusKeys[channel.status])}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          {candidateChannels.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle><UiText id="no_selectable_channels_found_cfbf12a8" /></AlertTitle>
              <AlertDescription><UiText id="refresh_the_page_once_channel_sync_finishes_18cd47a5" /></AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            disabled={!canSubmit || confirmMutation.isPending}
            onClick={handleSubmit}
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <UiText id="saving_369c534d" /></>
            ) : (
              tAuto('keep_selected_channels_14f187ed')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatPlanLabel(plan: string) {
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`
}
