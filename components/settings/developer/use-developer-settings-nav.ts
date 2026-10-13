'use client'

import { useQuery } from '@tanstack/react-query'
import { Code2 } from 'lucide-react'
import type * as React from 'react'

import { DEVELOPER_STATUS_QUERY_KEY, getDeveloperPlatformStatus } from '@/lib/developer/api'

interface SettingsNavItem {
  readonly id: string
  readonly labelKey: string
  readonly href: string
  readonly icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

interface SettingsNavSection {
  readonly labelKey: string
  readonly items: ReadonlyArray<SettingsNavItem>
}

export const DEVELOPER_SETTINGS_NAV_ITEM: SettingsNavItem = {
  id: 'developer',
  labelKey: 'developer',
  href: '/settings?section=developer',
  icon: Code2,
}

/**
 * DEV-01: the Settings sidebar shows "Developer" in the workspace group only while the gateway reports the Developer
 * Platform as enabled (default off). Server state, no browser storage; a failed status read hides the item.
 */
export function useSettingsSectionsWithDeveloper<Section extends SettingsNavSection>(sections: ReadonlyArray<Section>): ReadonlyArray<SettingsNavSection> {
  const status = useQuery({
    queryKey: DEVELOPER_STATUS_QUERY_KEY,
    queryFn: ({ signal }) => getDeveloperPlatformStatus({ signal }),
    staleTime: 60_000,
    retry: false,
  })
  if (!status.data?.enabled) return sections
  return sections.map((section) => (section.labelKey === 'workspace'
    ? { ...section, items: [...section.items, DEVELOPER_SETTINGS_NAV_ITEM] }
    : section))
}
