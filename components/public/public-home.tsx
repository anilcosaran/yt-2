import Link from 'next/link'

import { PublicAnnouncementBar } from '@/components/layout/announcement-bar'
import { Button } from '@/components/ui/button'
import { UiText } from '@/components/i18n/ui-text'

export function PublicHome() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicAnnouncementBar />

      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            <UiText id="youtorch_020aa912" /></Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login"><UiText id="sign_in_ada2e9e9" /></Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login"><UiText id="get_started_90e40d50" /></Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl content-center gap-10 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <p className="mb-3 text-sm font-medium text-primary"><UiText id="youtorch_workspace_1366b42d" /></p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            <UiText id="content_operations_workflows_and_channel_intelli_e48c21a7" /></h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            <UiText id="build_repeatable_creator_workflows_manage_channe_8fd9f754" /></p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/login"><UiText id="start_now_67a04c79" /></Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login"><UiText id="sign_in_ada2e9e9" /></Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 rounded-md border border-border bg-card p-4 shadow-sm">
          <div className="rounded-md border border-border bg-background p-4">
            <div className="text-sm font-medium"><UiText id="workflow_health_4941cb02" /></div>
            <div className="mt-3 h-2 rounded bg-muted">
              <div className="h-2 w-3/4 rounded bg-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-background p-4">
              <div className="text-2xl font-semibold">12</div>
              <div className="text-sm text-muted-foreground"><UiText id="active_workflows_b85656cf" /></div>
            </div>
            <div className="rounded-md border border-border bg-background p-4">
              <div className="text-2xl font-semibold">4</div>
              <div className="text-sm text-muted-foreground"><UiText id="connected_channels_a6875b82" /></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
