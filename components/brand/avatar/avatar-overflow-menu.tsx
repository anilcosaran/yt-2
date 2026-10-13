'use client'

import * as React from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AvatarOverflowMenu({
  onRename,
  onDelete,
}: {
  onRename?: () => void
  onDelete: () => void
}) {
  const t = useTranslations('BrandAvatar')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-full"
          data-avatar-overflow="menu"
          aria-label={t('moreActions')}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {onRename ? (
          <DropdownMenuItem
            onSelect={() => {
              onRename()
            }}
          >
            <Pencil className="size-4" />
            {t('rename')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onDelete()
          }}
        >
          <Trash2 className="size-4" />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
