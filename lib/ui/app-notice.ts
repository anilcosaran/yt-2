import { toast } from 'sonner'

export type AppNoticeTone = 'default' | 'info' | 'success' | 'warning' | 'error'

export type AppNoticeInput = {
  title: string
  description?: string
  tone?: AppNoticeTone
  durationMs?: number
}

export function showAppNotice({
  title,
  description,
  tone = 'default',
  durationMs,
}: AppNoticeInput) {
  const options = {
    description,
    duration: durationMs,
    position: 'bottom-right' as const,
  }
  if (tone === 'warning') return toast.warning(title, options)
  if (tone === 'error') return toast.error(title, options)
  if (tone === 'success') return toast.success(title, options)
  if (tone === 'info') return toast.info(title, options)
  return toast(title, options)
}
