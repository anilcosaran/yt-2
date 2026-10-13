'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

type AppAlertTone = 'default' | 'destructive' | 'warning' | 'success'
type AppAlertConfirmVariant = React.ComponentProps<typeof Button>['variant']

type AppAlertDialogProps = {
  open: boolean
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  closeLabel?: string
  showCancel?: boolean
  showClose?: boolean
  showConfirm?: boolean
  busy?: boolean
  tone?: AppAlertTone
  confirmVariant?: AppAlertConfirmVariant
  onOpenChange: (open: boolean) => void
  onConfirm?: () => void
  onCancel?: () => void
}

const toneStyles: Record<AppAlertTone, { icon: React.ElementType; iconClassName: string; confirmVariant: AppAlertConfirmVariant }> = {
  default: {
    icon: Info,
    iconClassName: 'text-[#0C66E4]',
    confirmVariant: 'default',
  },
  destructive: {
    icon: XCircle,
    iconClassName: 'text-destructive',
    confirmVariant: 'destructive',
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'text-[#C2410C]',
    confirmVariant: 'default',
  },
  success: {
    icon: CheckCircle2,
    iconClassName: 'text-[#166534]',
    confirmVariant: 'default',
  },
}

function AppAlertDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  closeLabel = 'Close',
  showCancel = true,
  showClose = true,
  showConfirm = true,
  busy = false,
  tone = 'default',
  confirmVariant,
  onOpenChange,
  onConfirm,
  onCancel,
}: AppAlertDialogProps) {
  const toneStyle = toneStyles[tone]
  const Icon = toneStyle.icon
  const resolvedConfirmVariant = confirmVariant ?? toneStyle.confirmVariant

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[min(440px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-md border-border bg-background p-0 shadow-[0_22px_70px_rgba(15,23,42,0.22)] sm:max-w-none">
        <div className="flex items-start gap-3 px-5 pb-4 pt-5">
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', toneStyle.iconClassName)} />
          <AlertDialogHeader className="min-w-0 flex-1 gap-1 text-left">
            <AlertDialogTitle className="text-base font-semibold leading-6 text-foreground">
              {title}
            </AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-sm leading-5 text-muted-foreground">
                {description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {showClose && (
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-mr-2 -mt-1 text-muted-foreground hover:text-foreground"
                aria-label={closeLabel}
                onClick={onCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDialogCancel>
          )}
        </div>
        {children && (
          <div className="px-5 pb-1">
            {children}
          </div>
        )}
        <AlertDialogFooter className="gap-2 px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
          {showCancel && (
            <AlertDialogCancel asChild>
              <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                {cancelLabel}
              </Button>
            </AlertDialogCancel>
          )}
          {showConfirm && (
            <Button
              type="button"
              variant={resolvedConfirmVariant}
              onClick={onConfirm}
              disabled={busy}
            >
              {confirmLabel}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { AppAlertDialog, type AppAlertTone }
