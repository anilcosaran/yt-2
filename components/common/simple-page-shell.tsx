import { PageHeader } from '@/components/common/page-header'

interface SimplePageShellProps {
  title: string
  emptyText: string
}

export function SimplePageShell({ title, emptyText }: SimplePageShellProps) {
  return (
    <div className="p-6">
      <PageHeader
        breadcrumbs={[{ label: title }]}
        title={title}
      />

      <div className="flex min-h-[360px] items-center justify-center rounded-md border border-border bg-card px-6 py-12 text-sm text-muted-foreground">
        {emptyText}
      </div>
    </div>
  )
}
