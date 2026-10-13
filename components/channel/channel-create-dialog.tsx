'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, PlusCircle } from 'lucide-react'

import {
  addChannel,
  CHANNELS_QUERY_KEY,
  type Channel,
  type ChannelPlanInfo,
} from '@/lib/channel/api'
import { WORKSPACE_BOOTSTRAP_QUERY_KEY } from '@/lib/workspace/api'
import { getMyFeatureLimits } from '@/lib/feature-control/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

interface ChannelCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (channel: Channel) => void
}

export function ChannelCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ChannelCreateDialogProps) {
  const tAuto = useTranslations('Auto')
  const queryClient = useQueryClient()
  const localizeError = useLocalizedError()
  const [name, setName] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const limitsQuery = useQuery({
    queryKey: ['feature-limits', 'my'],
    queryFn: getMyFeatureLimits,
    enabled: open,
    staleTime: 60_000,
  })
  const planInfo = React.useMemo<ChannelPlanInfo>(() => {
    const limit = limitsQuery.data?.features.find((feature) => feature.key === 'max_youtube_channels')
    return {
      planType: limitsQuery.data?.plan_type ?? null,
      channelLimit: limit?.value ?? null,
    }
  }, [limitsQuery.data])
  const createMutation = useMutation({
    mutationFn: addChannel,
    onSuccess: async (channel) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: WORKSPACE_BOOTSTRAP_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY }),
      ])
      onCreated?.(channel)
      setName('')
      setErrorMessage(null)
      onOpenChange(false)
    },
  })

  React.useEffect(() => {
    if (!open) {
      setName('')
      setErrorMessage(null)
    }
  }, [open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || createMutation.isPending) return

    setErrorMessage(null)
    try {
      await createMutation.mutateAsync({
        name: trimmedName,
        platform: 'youtube',
        memoryEnabled: true,
      })
    } catch (error) {
      setErrorMessage(localizeError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle><UiText id="yeni_kanal_ekle_16e63948" /></DialogTitle>
            <DialogDescription>
              <UiText id="kanal_once_youtorch_workspace_olarak_acilir_goog_589db6f1" /></DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle><UiText id="kanal_eklenemedi_0964a20f" /></AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="channel-name"><UiText id="kanal_adi_b83a7719" /></Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={tAuto('orn_youtorch_labs_26def6f1')}
              maxLength={255}
              autoComplete="off"
            />
          </div>

          {planInfo.planType && planInfo.channelLimit !== null && planInfo.channelLimit !== undefined && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <UiText id="aktif_plan_kanal_limiti_29f771dc" />{' '}
              <span className="font-medium text-foreground">{planInfo.channelLimit}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <UiText id="vazgec_e8872f72" /></Button>
            <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
              <PlusCircle className="h-4 w-4" />
              {createMutation.isPending ? tAuto('ekleniyor_f2faae60') : tAuto('kanal_ekle_ec976e3e')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
