'use client'

import * as React from 'react'
import { CloudUpload, FileUp, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { formatBytes } from './library-logic'
import { useLibraryStore } from './library-store'
import { CollectionGlyph } from './library-ui'

type PendingFile = { name: string; type: string; size: number }

const SAMPLE_FILES: PendingFile[] = [
  { name: 'kabak-tatlisi-yemek.jpg', type: 'image/jpeg', size: 2_800_000 },
  { name: 'salon-aksam-mekan.jpg', type: 'image/jpeg', size: 3_400_000 },
  { name: 'sef-ece-pizza-hamuru.mp4', type: 'video/mp4', size: 64_000_000 },
  { name: 'musteri-yorum-ayse.mp4', type: 'video/mp4', size: 38_000_000 },
]

export function LibraryUploadDialog({
  open,
  onOpenChange,
  initialDestination = 'auto',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDestination?: string
}) {
  const t = useTranslations('Library.upload')
  const collections = useLibraryStore((state) => state.collections)
  const autoRoute = useLibraryStore((state) => state.preferences.autoRouteToSmartCollections)
  const upload = useLibraryStore((state) => state.upload)
  const [files, setFiles] = React.useState<PendingFile[]>([])
  const [destination, setDestination] = React.useState(initialDestination)
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setFiles([])
      setDestination(initialDestination)
    }
  }, [initialDestination, open])

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((current) => [...current, ...Array.from(list).map((file) => ({ name: file.name, type: file.type || 'application/octet-stream', size: file.size }))])
  }

  const start = () => {
    const nameOf = (id: string) => collections.find((collection) => collection.id === id)?.name ?? id
    upload(files, destination, (result) => {
      const parts = result.added.map((entry) => t('routedTo', { count: entry.count, name: nameOf(entry.collectionId) }))
      if (result.suggested) parts.push(t('routedReview', { count: result.suggested }))
      toast.success(t('doneToast', { count: files.length }), { description: parts.join(' · ') || t('routedNone') })
    })
    toast(t('startedToast', { count: files.length }))
    onOpenChange(false)
  }

  const target = collections.find((collection) => collection.id === destination)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}
          className={cn(
            'flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/30',
          )}
        >
          <CloudUpload className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{t('drop')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('formats')}</p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}><FileUp />{t('choose')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setFiles((current) => [...current, ...SAMPLE_FILES])}>{t('samples')}</Button>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
        </div>

        {files.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm">
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('destination')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDestination('auto')}
              className={cn('flex items-start gap-3 rounded-xl border p-3 text-left', destination === 'auto' ? 'border-primary/60 bg-primary/10' : 'border-border hover:bg-accent/50')}
            >
              <Sparkles className="mt-0.5 size-4 text-primary" />
              <span>
                <span className="block text-sm font-medium">{t('auto')}</span>
                <span className="block text-xs text-muted-foreground">{autoRoute ? t('autoHint') : t('autoOff')}</span>
              </span>
            </button>
            <select
              value={destination === 'auto' ? '' : destination}
              onChange={(event) => setDestination(event.target.value || 'auto')}
              className={cn('h-auto rounded-xl border bg-background px-3 text-sm', destination !== 'auto' ? 'border-primary/60' : 'border-border')}
            >
              <option value="">{t('pickCollection')}</option>
              {collections.filter((collection) => collection.status !== 'archived' && collection.status !== 'frozen').map((collection) => (
                <option key={collection.id} value={collection.id}>{collection.name}</option>
              ))}
            </select>
          </div>
          {target && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CollectionGlyph collection={target} size="sm" />
              {target.smart && target.settings.analysis.scope !== 'off' ? t('targetSmart') : t('targetManual')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button disabled={files.length === 0} onClick={start}>{t('start', { count: files.length })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Small floating progress card while simulated uploads run. */
export function LibraryUploadProgress() {
  const t = useTranslations('Library.upload')
  const uploads = useLibraryStore((state) => state.uploads)
  if (!uploads.length) return null
  const progress = Math.round(uploads.reduce((sum, job) => sum + job.progress, 0) / uploads.length)
  return (
    <div className="fixed bottom-6 right-6 z-40 w-72 rounded-2xl border border-border bg-popover p-4 shadow-xl">
      <p className="text-sm font-medium">{t('progress', { count: uploads.length })}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">{uploads[0]?.name}</p>
    </div>
  )
}
