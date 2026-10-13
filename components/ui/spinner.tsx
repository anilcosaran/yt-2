import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  const tAuto = useTranslations('Auto')
  return (
    <Loader2Icon
      role="status"
      aria-label={tAuto('loading_8f26c652')}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
