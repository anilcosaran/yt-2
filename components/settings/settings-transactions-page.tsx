'use client'

import { SettingsFrame, TransactionsSection } from '@/components/settings/settings-page'

export function SettingsTransactionsPage() {
  return (
    <SettingsFrame activeSection="transactions">
      <TransactionsSection />
    </SettingsFrame>
  )
}
