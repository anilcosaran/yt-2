'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/common/page-header'
import { TabBar, TabBarItem } from '@/components/common/tab-bar'
import { ChannelPageSkeleton, ChannelsPageLoading } from './channel-page-loading'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  addChannel,
  disconnectChannel,
  listChannels,
  type Channel,
  type ChannelPlanInfo,
  updateChannelSettings,
} from '@/lib/channel/api'
import {
  BrandOverlayEditor,
  DEFAULT_BRAND_OVERLAY_CONFIG,
  type BrandOverlayEditorValue,
} from '@/components/brand-overlay/brand-overlay-editor'
import { useActiveChannel } from '@/lib/channel/active-channel'
import { WorkspaceChannelRequired } from '@/components/channel/workspace-channel-required'
import { ChannelGoogleConnect } from '@/components/channel/channel-google-connect'
import { getMyFeatureLimits } from '@/lib/feature-control/api'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Link2,
  PlusCircle,
  Unplug,
  Youtube,
} from 'lucide-react'
import { UiText } from '@/components/i18n/ui-text'
import { useLocalizedError } from '@/hooks/use-localized-error'
import { useTranslations } from 'next-intl'

type ChannelView = 'statistics' | 'videos' | 'settings' | 'connection'

const channelSetupStepKeys = ['setupDetails', 'setupConnection', 'setupReady'] as const

const CONNECTION_STATUS_REFRESH_MS = 900

const channelStatusKeys = {
  setup: 'statusSetup',
  connected: 'statusConnected',
  disconnected: 'statusDisconnected',
  plan_paused: 'statusPaused',
  removing: 'statusRemoving',
  removed: 'statusRemoved',
} as const

const channelStatusValueKeys = {
  setup: 'statusValueSetup',
  connected: 'statusValueConnected',
  disconnected: 'statusValueDisconnected',
  plan_paused: 'statusValuePaused',
  removing: 'statusValueRemoving',
  removed: 'statusValueRemoved',
} as const

export default function ChannelsPage() {
  return (
    <Suspense fallback={<ChannelsPageLoading />}>
      <ChannelsContent />
    </Suspense>
  )
}

function ChannelsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeView = getChannelView(searchParams.get('view'))
  const createRequested = searchParams.get('create') === '1'

  const clearCreateRequest = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('create')
    const nextQuery = nextParams.toString()

    router.replace(nextQuery ? `/channels?${nextQuery}` : '/channels', { scroll: false })
  }, [router, searchParams])

  const handleViewChange = useCallback((value: string) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('view', value)
    nextParams.delete('create')

    router.push(`/channels?${nextParams.toString()}`)
  }, [router, searchParams])

  return (
    <ChannelWorkspace
      activeView={activeView}
      createRequested={createRequested}
      onCreateRequestHandled={clearCreateRequest}
      onChange={handleViewChange}
    />
  )
}

function ChannelWorkspace({
  activeView,
  createRequested,
  onCreateRequestHandled,
  onChange,
}: {
  activeView: ChannelView
  createRequested: boolean
  onCreateRequestHandled: () => void
  onChange: (value: string) => void
}) {
  const tAuto = useTranslations('Auto')
  const tChannels = useTranslations('Channels')
  const { activeChannel, channels, isLoading, setActiveChannelId } = useActiveChannel()
  const limitsQuery = useQuery({
    queryKey: ['feature-limits', 'my'],
    queryFn: getMyFeatureLimits,
    staleTime: 60_000,
  })
  const channelLimit = limitsQuery.data?.features.find((feature) => feature.key === 'max_youtube_channels')?.value
  const canAddChannel = limitsQuery.isSuccess
    && typeof channelLimit === 'number'
    && Boolean(activeChannel)
    && channels.length > 0
    && channels.length < channelLimit
  const [setupOpen, setSetupOpen] = useState(false)
  const [connectionRefreshSignal, setConnectionRefreshSignal] = useState(0)
  const [connectionRefreshChannelId, setConnectionRefreshChannelId] = useState<string | null>(null)

  useEffect(() => {
    if (!createRequested) return
    onChange('connection')
  }, [createRequested, onChange])

  useEffect(() => {
    if (!connectionRefreshSignal) return

    const timeout = window.setTimeout(() => {
      setConnectionRefreshChannelId(null)
    }, CONNECTION_STATUS_REFRESH_MS + 200)

    return () => window.clearTimeout(timeout)
  }, [connectionRefreshSignal])

  const openSetup = () => {
    setSetupOpen(true)
  }

  const closeSetup = useCallback(() => {
    setSetupOpen(false)
    if (createRequested) onCreateRequestHandled()
  }, [createRequested, onCreateRequestHandled])

  const finishSetup = useCallback((channel: Channel, options?: { verified?: boolean }) => {
    setActiveChannelId(channel.id)
    setSetupOpen(false)
    if (options?.verified) {
      setConnectionRefreshChannelId(channel.id)
      setConnectionRefreshSignal((current) => current + 1)
    }
    onChange('connection')
  }, [onChange, setActiveChannelId])

  const handleSetupCreated = useCallback((channel: Channel) => {
    setActiveChannelId(channel.id)
  }, [setActiveChannelId])

  const needsConnect = !activeChannel
    || activeChannel.status === 'setup'
    || activeChannel.status === 'disconnected'
  const createButtonDisabled = setupOpen

  const handleConnectButtonClick = () => {
    onChange('connection')
  }

  const handleAddButtonClick = () => {
    if (createButtonDisabled || !canAddChannel) return
    openSetup()
  }

  const channelBreadcrumbs = activeChannel
    ? [{ label: tChannels('channels') }, { label: activeChannel.name, icon: Youtube }]
    : [{ label: tChannels('channels') }]

  return (
    <div className="hg-scrollbar relative h-full overflow-y-auto bg-background">
      <div className="hg-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="relative mx-auto min-h-full w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        breadcrumbs={channelBreadcrumbs}
        icon={Youtube}
        title={tAuto('channel_879f0b1b')}
        badge={activeChannel ? tChannels(channelStatusKeys[activeChannel.status]) : undefined}
        description={tAuto('manage_videos_connection_and_channel_settings_52571866')}
        className="mb-0"
        actions={needsConnect || canAddChannel ? (
          <div className="flex flex-wrap items-center gap-2">
            {needsConnect ? (
              <Button
                className="h-10 gap-2 rounded-xl px-4"
                onClick={handleConnectButtonClick}
              >
                <Link2 className="size-4" />
                {tChannels('connectChannel')}
              </Button>
            ) : null}
            {canAddChannel ? (
              <Button
                className="h-10 gap-2 rounded-xl px-4"
                variant={needsConnect ? 'outline' : 'default'}
                disabled={createButtonDisabled}
                onClick={handleAddButtonClick}
              >
                <PlusCircle className="size-4" />
                {tChannels('addChannel')}
              </Button>
            ) : null}
          </div>
        ) : undefined}
      />

      {setupOpen ? (
        <ChannelSetupWizard
          activeChannel={activeChannel}
          onCancel={closeSetup}
          onCreated={handleSetupCreated}
          onFinished={finishSetup}
        />
      ) : isLoading ? (
        <ChannelPageSkeleton />
      ) : activeChannel ? (
        <TabsShell
          activeView={activeView}
          activeChannel={activeChannel}
          connectionRefreshChannelId={connectionRefreshChannelId}
          connectionRefreshSignal={connectionRefreshSignal}
          onChange={onChange}
        />
      ) : (
        <EmptyChannelState />
      )}
      </div>
    </div>
  )
}

function ChannelSetupWizard({
  activeChannel,
  onCancel,
  onCreated,
  onFinished,
}: {
  activeChannel: Channel | null
  onCancel: () => void
  onCreated: (channel: Channel) => void
  onFinished: (channel: Channel, options?: { verified?: boolean }) => void
}) {
  const tAuto = useTranslations('Auto')
  const tChannels = useTranslations('Channels')
  const localizeError = useLocalizedError()
  const { refreshChannels } = useActiveChannel()
  const [step, setStep] = useState<'details' | 'connection'>('details')
  const [name, setName] = useState('')
  const [createdChannel, setCreatedChannel] = useState<Channel | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const limitsQuery = useQuery({
    queryKey: ['feature-limits', 'my'],
    queryFn: getMyFeatureLimits,
    staleTime: 60_000,
  })

  const limit = limitsQuery.data?.features.find((feature) => feature.key === 'max_youtube_channels')
  const planInfo: ChannelPlanInfo = {
    planType: limitsQuery.data?.plan_type ?? null,
    channelLimit: limit?.value ?? null,
  }

  const targetChannel = createdChannel
  const canConnectTarget = targetChannel?.status === 'setup' || targetChannel?.status === 'disconnected'

  const createMutation = useMutation({
    mutationFn: addChannel,
  })

  const currentStep = step === 'details' ? 0 : 1

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || createMutation.isPending) return

    if (createdChannel) {
      setCreateError(null)
      setStep('connection')
      return
    }

    setCreateError(null)
    try {
      const channel = await createMutation.mutateAsync({
        name: trimmedName,
        platform: 'youtube',
        memoryEnabled: true,
      })
      await refreshChannels()
      setCreatedChannel(channel)
      onCreated(channel)
      setStep('connection')
    } catch (error) {
      setCreateError(localizeError(error, 'generic'))
    }
  }

  // P01C-13: the channel connects with Youtorch's own Google app (popup + channel picker), never a pasted token.
  const handleConnected = async () => {
    await refreshChannels()
    const connected = (await listChannels()).find((channel) => channel.id === targetChannel?.id) ?? targetChannel
    if (!connected) return
    onCreated(connected)
    onFinished(connected, { verified: true })
  }

  return (
    <ChannelWizardSurface
      className="mt-6"
      currentStep={currentStep}
      steps={channelSetupStepKeys.map((key) => ({ title: tChannels(key) }))}
    >
      {step === 'details' && (
        <form onSubmit={handleCreate}>
          <div className="border-b border-border/70 px-5 py-5 sm:px-6">
            <p className="text-[18px] font-semibold leading-6 text-foreground"><UiText id="kanal_detaylari_580b4558" /></p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              <UiText id="once_youtorch_icinde_kanal_workspace_i_olusturul_ca7ba162" /></p>
          </div>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            {createError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle><UiText id="kanal_olusturulamadi_7778edc7" /></AlertTitle>
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground"><UiText id="kanal_adi_b83a7719" /></span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={tAuto('orn_youtorch_labs_26def6f1')}
                maxLength={255}
                autoComplete="off"
                autoFocus
                disabled={Boolean(createdChannel)}
              />
            </label>

            <div className="grid border-y border-border/70 text-sm sm:grid-cols-2 sm:divide-x sm:divide-border/70">
              <div className="py-3 sm:pr-4">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground"><UiText id="aktif_plan_a0ac8d88" /></p>
                <p className="mt-1 font-medium text-foreground">
                  {limitsQuery.isLoading
                    ? tAuto('limit_kontrol_ediliyor_b9661b81')
                    : planInfo.channelLimit !== null && planInfo.channelLimit !== undefined
                      ? tChannels('channelLimit', { limit: planInfo.channelLimit })
                      : tAuto('limit_bilgisi_hazir_degil_fff275c9')}
                </p>
              </div>
              <div className="border-t border-border/70 py-3 sm:border-t-0 sm:pl-4">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground"><UiText id="secili_kanal_6d395eb0" /></p>
                <p className="mt-1 truncate font-medium text-foreground">
                  {activeChannel?.name ?? tAuto('yeni_workspace_4c136ec5')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-full border-border/80 bg-background px-4 text-foreground shadow-sm hover:bg-muted/40"
              onClick={onCancel}
            >
              <UiText id="geri_4928cfc9" /></Button>
            <Button
              type="submit"
              className="h-9 rounded-full px-4"
              disabled={!name.trim() || createMutation.isPending}
            >
              {createdChannel
                ? tAuto('baglantiya_don_ac95917d')
                : createMutation.isPending
                  ? tAuto('olusturuluyor_e43343a0')
                  : tAuto('sonraki_adim_56282c8e')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {step === 'connection' && (
        <div>
          <div className="border-b border-border/70 px-5 py-5 sm:px-6">
            <p className="text-[18px] font-semibold leading-6 text-foreground"><UiText id="kanal_baglantisi_90aa5d7f" /></p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {tChannels('googleConnect.description', { channel: targetChannel?.name ?? tAuto('yeni_kanal_f6992943') })}</p>
          </div>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            {!canConnectTarget && targetChannel && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle><UiText id="kanal_baglanti_icin_hazir_degil_46099bc3" /></AlertTitle>
                <AlertDescription>
                  {tChannels('channelUnavailable', { status: tChannels(channelStatusValueKeys[targetChannel.status]) })}
                </AlertDescription>
              </Alert>
            )}
            {targetChannel && canConnectTarget && (
              <ChannelGoogleConnect channel={targetChannel} onConnected={handleConnected} />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-full border-border/80 bg-background px-4 text-foreground shadow-sm hover:bg-muted/40"
              onClick={() => setStep('details')}
            >
              <UiText id="geri_4928cfc9" /></Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-full border-border/80 bg-background px-4 text-foreground shadow-sm hover:bg-muted/40"
              onClick={() => targetChannel && onFinished(targetChannel)}
              disabled={!targetChannel}
            >
              <UiText id="sonra_bagla_09107396" /></Button>
          </div>
        </div>
      )}
    </ChannelWizardSurface>
  )
}

function ChannelWizardSurface({
  currentStep,
  steps,
  children,
  className,
}: {
  currentStep: number
  steps: Array<{ title: string }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-border/80 bg-card shadow-none',
        className,
      )}
    >
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3 sm:px-6">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto">
          {steps.map((item, index) => {
            const active = index === currentStep
            const complete = index < currentStep

            return (
              <div key={item.title} className="flex shrink-0 items-center gap-1">
                <div
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors',
                    active && 'bg-background text-foreground shadow-xs',
                    complete && 'text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground',
                      active && 'bg-foreground text-background',
                      complete && 'bg-success/15 text-success',
                    )}
                  >
                    {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className="whitespace-nowrap">{item.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                )}
              </div>
            )
          })}
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyChannelState() {
  return <WorkspaceChannelRequired />
}

function ChannelStatusBadge({ status }: { status: Channel['status'] }) {
  if (status === 'connected') {
    return <Badge className="bg-success/10 text-success hover:bg-success/10"><UiText id="bagli_9b328f50" /></Badge>
  }
  if (status === 'plan_paused') {
    return <Badge className="bg-warning/15 text-warning hover:bg-warning/15"><UiText id="plan_duraklatti_b5e59c3d" /></Badge>
  }
  if (status === 'removing') {
    return <Badge variant="secondary"><UiText id="kaldiriliyor_0eacad60" /></Badge>
  }
  if (status === 'setup') {
    return <Badge className="bg-primary/10 text-primary hover:bg-primary/10"><UiText id="kurulum_gerekli_47fa0e35" /></Badge>
  }
  return <Badge variant="secondary"><UiText id="bagli_degil_e22767f2" /></Badge>
}

function ConnectedOnlyState({
  activeChannel,
  title,
  description,
}: {
  activeChannel: Channel
  title: string
  description: string
}) {
  return (
    <Card className="rounded-lg border-border/80 py-0 shadow-none" data-channel-id={activeChannel.id}>
      <Empty className="min-h-[300px] justify-start rounded-lg border-0 bg-transparent px-6 pb-8 pt-[76px]">
        <EmptyMedia>
          <ChannelConnectIllustration />
        </EmptyMedia>
        <EmptyHeader className="max-w-lg">
          <EmptyTitle className="text-[22px] font-semibold leading-7 tracking-normal">
            {title}
          </EmptyTitle>
          <EmptyDescription className="max-w-xl text-[15px] leading-6 text-foreground">
            {description}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="max-w-md gap-0 pt-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-border/80 bg-background px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted/40"
          >
            <Link href="/channels?view=connection">
              <Link2 className="h-4 w-4" />
              <UiText id="connection_a_git_2b1b4b74" /></Link>
          </Button>
        </EmptyContent>
      </Empty>
    </Card>
  )
}

function ConnectedDataPending({
  activeChannel,
  title,
  description,
}: {
  activeChannel: Channel
  title: string
  description: string
}) {
  return (
    <Card className="rounded-lg border-border/80 shadow-none" data-channel-id={activeChannel.id}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <Youtube className="h-9 w-9 text-[#FF0033]" />
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {activeChannel.name} {' '}<UiText id="bagli_bu_alan_kanal_bazli_veri_senkronu_geldigin_6ce25e7a" /></p>
        </div>
      </CardContent>
    </Card>
  )
}

function TabsShell({
  activeView,
  activeChannel,
  connectionRefreshChannelId,
  connectionRefreshSignal,
  onChange,
}: {
  activeView: ChannelView
  activeChannel: Channel
  connectionRefreshChannelId: string | null
  connectionRefreshSignal: number
  onChange: (value: string) => void
}) {
  return (
    <Tabs
      value={activeView}
      onValueChange={(value) => onChange(getChannelView(value))}
      className="w-full"
    >
      <TabBar className="mt-4">
        <TabBarItem value="statistics">
          <UiText id="statistics_2086b21f" /></TabBarItem>
        <TabBarItem value="videos">
          <UiText id="videos_56b71e89" /></TabBarItem>
        <TabBarItem value="settings">
          <UiText id="settings_c7f73bb5" /></TabBarItem>
        <TabBarItem value="connection">
          <UiText id="connection_6512ee15" /></TabBarItem>
      </TabBar>

      <TabsContent value="statistics" className="mt-0">
        <StatisticsTab activeChannel={activeChannel} />
      </TabsContent>
      <TabsContent value="videos" className="mt-0">
        <VideosTab activeChannel={activeChannel} />
      </TabsContent>
      <TabsContent value="settings" className="mt-0">
        <SettingsTab activeChannel={activeChannel} />
      </TabsContent>
      <TabsContent value="connection" className="mt-0">
        <ConnectionTab
          activeChannel={activeChannel}
          refreshChannelId={connectionRefreshChannelId}
          refreshSignal={connectionRefreshSignal}
        />
      </TabsContent>
    </Tabs>
  )
}

function StatisticsTab({ activeChannel }: { activeChannel: Channel }) {
  const tAuto = useTranslations('Auto')
  if (activeChannel.status !== 'connected') {
    return (
      <ConnectedOnlyState
        activeChannel={activeChannel}
        title={tAuto('channel_statistics_2e07ff5f')}
        description={tAuto('izlenme_abone_artisi_ve_gunluk_performans_verile_908d5b76')}
      />
    )
  }

  return (
    <ConnectedDataPending
      activeChannel={activeChannel}
      title={tAuto('channel_statistics_2e07ff5f')}
      description={tAuto('kanal_bagli_youtube_analytics_senkronu_tamamland_0683b493')}
    />
  )

}

function VideosTab({ activeChannel }: { activeChannel: Channel }) {
  const tAuto = useTranslations('Auto')
  if (activeChannel.status !== 'connected') {
    return (
      <ConnectedOnlyState
        activeChannel={activeChannel}
        title={tAuto('channel_videos_a63971b9')}
        description={tAuto('yayinlanmis_video_listesi_ve_video_metrikleri_ka_4a75f980')}
      />
    )
  }

  return (
    <ConnectedDataPending
      activeChannel={activeChannel}
      title={tAuto('channel_videos_a63971b9')}
      description={tAuto('kanal_bagli_youtube_video_senkronu_tamamlandigin_ce5d0874')}
    />
  )
}

function SettingsTab({ activeChannel }: { activeChannel: Channel }) {
  const tAuto = useTranslations('Auto')
  const tChannels = useTranslations('Channels')
  const localizeError = useLocalizedError()
  const { refreshChannels } = useActiveChannel()
  const [displayName, setDisplayName] = useState(activeChannel.name)
  useEffect(() => {
    setDisplayName(activeChannel.name)
  }, [activeChannel.id, activeChannel.name])
  const renameMutation = useMutation({
    mutationFn: () => updateChannelSettings({
      channelId: activeChannel.id,
      name: displayName.trim(),
    }),
    onSuccess: async () => {
      await refreshChannels()
    },
  })
  const preset = activeChannel.settings.brandOverlay
  const [brandOverlay, setBrandOverlay] = useState<BrandOverlayEditorValue>(() => ({
    applyPolicy: preset?.applyPolicy ?? 'default',
    assetStorageObjectId: preset?.assetStorageObjectId ?? null,
    config: preset ? {
      anchor: preset.anchor,
      widthRatio: preset.widthRatio,
      opacity: preset.opacity,
      marginRatio: preset.marginRatio,
      animationMode: preset.animationMode,
      intervalSeconds: preset.intervalSeconds,
      fadeSeconds: preset.fadeSeconds,
    } : DEFAULT_BRAND_OVERLAY_CONFIG,
  }))
  const [saveError, setSaveError] = useState<string | null>(null)
  useEffect(() => {
    const next = activeChannel.settings.brandOverlay
    setBrandOverlay({
      applyPolicy: next?.applyPolicy ?? 'default',
      assetStorageObjectId: next?.assetStorageObjectId ?? null,
      config: next ? {
        anchor: next.anchor,
        widthRatio: next.widthRatio,
        opacity: next.opacity,
        marginRatio: next.marginRatio,
        animationMode: next.animationMode,
        intervalSeconds: next.intervalSeconds,
        fadeSeconds: next.fadeSeconds,
      } : DEFAULT_BRAND_OVERLAY_CONFIG,
    })
  }, [activeChannel.id, activeChannel.settings.brandOverlay, activeChannel.settings.brandOverlayVersion])
  const saveMutation = useMutation({
    mutationFn: () => updateChannelSettings({
      channelId: activeChannel.id,
      expectedBrandOverlayVersion: activeChannel.settings.brandOverlayVersion,
      brandOverlay: {
        applyPolicy: brandOverlay.applyPolicy ?? 'default',
        assetStorageObjectId: brandOverlay.assetStorageObjectId,
        ...brandOverlay.config,
      },
    }),
    onSuccess: async () => {
      setSaveError(null)
      await refreshChannels()
    },
    onError: (error) => setSaveError(localizeError(error)),
  })
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Card className="rounded-lg border-border/80 shadow-none lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{tChannels('displayName')}</CardTitle>
          <CardDescription>{tChannels('displayNameHint')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 space-y-2">
            <span className="text-sm font-medium text-foreground">{tChannels('displayName')}</span>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={255}
              autoComplete="off"
            />
          </label>
          <Button
            type="button"
            disabled={renameMutation.isPending || !displayName.trim() || displayName.trim() === activeChannel.name}
            onClick={() => renameMutation.mutate()}
          >
            {renameMutation.isPending ? tAuto('saving_ae7e8875') : tChannels('saveDisplayName')}
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-lg border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base"><UiText id="brand_overlay_f79533dc" /></CardTitle>
          <CardDescription><UiText id="video_ve_gorsellerde_kullanilacak_logo_konum_say_c5944aaf" /></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BrandOverlayEditor channelId={activeChannel.id} value={brandOverlay} onChange={setBrandOverlay} disabled={saveMutation.isPending} />
          {saveError ? <p className="text-sm text-destructive" role="alert">{saveError}</p> : null}
          <div className="flex justify-end">
            <Button type="button" disabled={saveMutation.isPending || (brandOverlay.applyPolicy === 'required' && !brandOverlay.assetStorageObjectId)} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? tAuto('saving_ae7e8875') : tAuto('save_brand_overlay_6920d891')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <SettingCard
        title={`${activeChannel.name} varsayilanlari`}
        description={tAuto('baslik_aciklama_ve_planli_yayin_davranisini_beli_1034a266')}
        items={[
          ['Default visibility', 'Unlisted on review'],
          ['Language', 'Turkish'],
          ['Approval gate', 'Required'],
        ]}
      />
      <Card className="rounded-lg border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base"><UiText id="automation_a15fde51" /></CardTitle>
          <CardDescription><UiText id="yayin_oncesi_otomatik_kontroller_99101f65" /></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow title={tAuto('thumbnail_quality_check_5b52e890')} enabled />
          <ToggleRow title={tAuto('copyright_risk_scan_a3876e0f')} enabled />
          <ToggleRow title={tAuto('comment_monitoring_a0ac3e7b')} enabled />
        </CardContent>
      </Card>
    </div>
  )
}

function ConnectionTab({
  activeChannel,
  refreshChannelId,
  refreshSignal,
}: {
  activeChannel: Channel
  refreshChannelId: string | null
  refreshSignal: number
}) {
  const tAuto = useTranslations('Auto')
  const tChannels = useTranslations('Channels')
  const localizeError = useLocalizedError()
  const { refreshChannels } = useActiveChannel()
  const [actionError, setActionError] = useState<string | null>(null)
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [statusRefreshing, setStatusRefreshing] = useState(false)
  const [localRefreshSignal, setLocalRefreshSignal] = useState(0)
  const disconnectMutation = useMutation({
    mutationFn: () => disconnectChannel(activeChannel.id),
    onSuccess: async () => {
      setActionError(null)
      await refreshChannels()
      setLocalRefreshSignal((current) => current + 1)
    },
    onError: (error) => {
      setActionError(localizeError(error))
    },
  })
  const isConnected = activeChannel.status === 'connected'
  const canConnect = activeChannel.status === 'setup' || activeChannel.status === 'disconnected'

  useEffect(() => {
    setActionError(null)
    setShowConnectForm(false)
  }, [activeChannel.id, activeChannel.platform_channel_id])

  useEffect(() => {
    if (!refreshSignal || refreshChannelId !== activeChannel.id) return

    setStatusRefreshing(true)
    const timeout = window.setTimeout(() => {
      setStatusRefreshing(false)
    }, CONNECTION_STATUS_REFRESH_MS)

    return () => window.clearTimeout(timeout)
  }, [activeChannel.id, refreshChannelId, refreshSignal])

  useEffect(() => {
    if (!localRefreshSignal) return

    setStatusRefreshing(true)
    const timeout = window.setTimeout(() => {
      setStatusRefreshing(false)
    }, CONNECTION_STATUS_REFRESH_MS)

    return () => window.clearTimeout(timeout)
  }, [localRefreshSignal])

  const needsReconnect = Boolean(activeChannel.connector_connection?.reauth_required)
  const handleConnected = async () => {
    setActionError(null)
    setShowConnectForm(false)
    await refreshChannels()
    setLocalRefreshSignal((current) => current + 1)
  }

  const connectionCopy = {
    title: tChannels('connectionDetails'),
    description: tChannels('googleConnect.description', { channel: activeChannel.name }),
  }

  if (!showConnectForm) {
    return (
      <Card className="rounded-lg border-border/80 py-0 shadow-none" data-channel-id={activeChannel.id}>
        <CardContent className="space-y-4 py-5">
          {actionError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle><UiText id="islem_tamamlanamadi_03286228" /></AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {statusRefreshing ? (
            <ConnectionStatusWidgetSkeleton />
          ) : (
            <ConnectionStatusWidget
              activeChannel={activeChannel}
              action={isConnected && !needsReconnect ? (
                <Button
                  variant="outline"
                  className="h-9 rounded-full border-border/80 bg-background px-4 text-foreground shadow-sm hover:bg-muted/40"
                  disabled={disconnectMutation.isPending}
                  onClick={() => disconnectMutation.mutate()}
                >
                  <Unplug className="h-4 w-4" />
                  {disconnectMutation.isPending ? tAuto('kesiliyor_43aacfec') : tAuto('baglantiyi_kes_d35c62cc')}
                </Button>
              ) : (
                <Button
                  className="h-9 rounded-full px-4"
                  disabled={!canConnect && !needsReconnect}
                  onClick={() => {
                    setActionError(null)
                    setShowConnectForm(true)
                  }}
                >
                  <Link2 className="h-4 w-4" />
                  {needsReconnect ? tChannels('googleConnect.reconnect') : <UiText id="kanal_bagla_c84db8fa" />}</Button>
              )}
            />
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-lg border-border/80 py-0 shadow-none" data-channel-id={activeChannel.id}>
      <div className="border-b border-border/70 px-5 py-4 sm:px-6">
        <ConnectionBodyBackButton onClick={() => setShowConnectForm(false)} />
      </div>

      <div className="border-b border-border/70 px-5 py-5 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-[18px] font-semibold leading-6 text-foreground">{connectionCopy.title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{connectionCopy.description}</p>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <ChannelGoogleConnect channel={activeChannel} onConnected={handleConnected} />
      </div>
    </Card>
  )
}

function ConnectionStatusWidget({
  activeChannel,
  action,
}: {
  activeChannel: Channel
  action: React.ReactNode
}) {
  const tChannels = useTranslations('Channels')
  const copy = getConnectionStatusCopy(activeChannel)

  return (
    <div className="flex items-start gap-3">
      <ConnectionStatusIcon tone={copy.tone} />
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold leading-6 text-foreground">{tChannels(copy.titleKey)}</p>
            {action}
          </div>
          <p className="text-sm leading-5 text-muted-foreground">{tChannels(copy.descriptionKey)}</p>
        </div>
      </div>
    </div>
  )
}

function ConnectionStatusWidgetSkeleton() {
  const tAuto = useTranslations('Auto')
  return (
    <div className="flex items-start gap-3" aria-label={tAuto('baglanti_durumu_yenileniyor_d9a15f87')}>
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
  )
}

function ConnectionStatusIcon({ tone }: { tone: 'success' | 'warning' | 'muted' }) {
  return (
    <span
      className={cn(
        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
        tone === 'success' && 'bg-success/10 text-success',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
    >
      {tone === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
    </span>
  )
}

function getConnectionStatusCopy(channel: Channel) {
  // P01C-13: the Connector connection needs a new consent (reconnect with Google; a provider outage is not this).
  if (channel.status === 'connected' && channel.connector_connection?.reauth_required) {
    return {
      titleKey: 'googleConnect.reauthTitle' as const,
      descriptionKey: 'googleConnect.reauthDescription' as const,
      tone: 'warning' as const,
    }
  }

  if (channel.status === 'connected') {
    return {
      titleKey: 'connectedTitle' as const,
      descriptionKey: 'connectedDescription' as const,
      tone: 'success' as const,
    }
  }

  if (channel.status === 'plan_paused') {
    return {
      titleKey: 'pausedTitle' as const,
      descriptionKey: 'pausedDescription' as const,
      tone: 'warning' as const,
    }
  }

  if (channel.status === 'disconnected') {
    return {
      titleKey: 'disconnectedTitle' as const,
      descriptionKey: 'disconnectedDescription' as const,
      tone: 'muted' as const,
    }
  }

  return {
    titleKey: 'disconnectedTitle' as const,
    descriptionKey: 'unverifiedDescription' as const,
    tone: 'muted' as const,
  }
}

function ConnectionBodyBackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-fit gap-1 rounded-full px-2 text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <ArrowLeft className="h-4 w-4" />
      <UiText id="geri_4928cfc9" /></Button>
  )
}

function ChannelConnectIllustration() {
  return (
    <svg width="152" height="88" viewBox="0 0 152 88" fill="none" aria-hidden="true">
      <circle cx="58" cy="34" r="22" fill="#FF0033" opacity="0.92" />
      <circle cx="94" cy="34" r="22" fill="#8EA7FF" opacity="0.95" />
      <path d="M51 27.5c0-2.2 2.4-3.5 4.3-2.4l17.4 10.2c1.9 1.1 1.9 3.8 0 4.9L55.3 50.4c-1.9 1.1-4.3-.2-4.3-2.4V27.5Z" fill="#FFFFFF" />
      <rect x="85" y="24" width="28" height="22" rx="6" fill="#172B4D" />
      <path d="M91 35h16M99 29v12" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="119" cy="57" r="12" fill="#36B37E" />
      <path d="m114 57 3.2 3.2 7-7.4" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getChannelView(view: string | null): ChannelView {
  if (
    view === 'statistics'
    || view === 'videos'
    || view === 'settings'
    || view === 'connection'
  ) {
    return view
  }
  return 'statistics'
}

function SettingCard({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: Array<[string, string]>
}) {
  return (
    <Card className="rounded-lg border-border/80 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ToggleRow({ title, enabled }: { title: string; enabled?: boolean }) {
  const tAuto = useTranslations('Auto')
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/80 p-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{tAuto('unavailable_2c9c1f79')}</span>
      </span>
      <Switch checked={enabled} disabled aria-label={`${title}: ${tAuto('unavailable_2c9c1f79')}`} />
    </div>
  )
}
