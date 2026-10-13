'use client'

import * as React from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { useLibraryStore } from './library-store'

/** New collection: a name and the smart switch. Everything else lives in the collection's settings. */
export function LibraryNewCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const t = useTranslations('Library.newCollection')
  const createCollection = useLibraryStore((state) => state.createCollection)
  const [name, setName] = React.useState('')
  const [smart, setSmart] = React.useState(true)
  const [description, setDescription] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setName('')
    setSmart(true)
    setDescription('')
  }, [open])

  const create = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const { id, matches } = createCollection({ name, description: smart ? description : '', smart })
    toast.success(t('createdToast', { name: name.trim() }), {
      description: !smart
        ? undefined
        : matches.suggested
          ? t('createdSuggested', { count: matches.suggested })
          : matches.added
            ? t('createdAdded', { count: matches.added })
            : t('createdEmpty'),
    })
    onOpenChange(false)
    onCreated(id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription className="sr-only">{t('description')}</DialogDescription>
          </DialogHeader>

          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t('namePlaceholder')} aria-label={t('name')} />

          <div className={cn('rounded-xl border p-3 transition-colors', smart ? 'border-primary/40 bg-primary/8' : 'border-border')}>
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="size-4 text-primary" />{t('smart')}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{t('smartHint')}</span>
              </span>
              <Switch checked={smart} onCheckedChange={setSmart} className="mt-0.5" />
            </label>
            {smart && (
              <Textarea
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('descriptionPlaceholder')}
                aria-label={t('descriptionLabel')}
                className="mt-3 resize-none bg-background"
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={!name.trim()}>{t('create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
