'use client'

import { Button } from '@/components/ui/button'
import type { ConnectorResourceCandidate } from '@/lib/connector/api'

/**
 * P01C-13 account resource choice (e.g. which YouTube channel) after a connect: the provider's real resources from
 * the server candidate list, one existing outline button per resource. Nothing is picked for the user.
 */
export function ConnectorResourcePicker({
  label,
  candidates,
  disabled,
  onPick,
}: {
  label: string
  candidates: ConnectorResourceCandidate[]
  disabled: boolean
  onPick: (candidate: ConnectorResourceCandidate) => void
}) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <Button
            key={`${candidate.resource_kind}:${candidate.resource_id}`}
            type="button"
            variant="outline"
            className="h-9 rounded-full border-border/80 bg-background px-4 text-foreground shadow-sm hover:bg-muted/40"
            disabled={disabled}
            onClick={() => onPick(candidate)}
          >
            {candidate.display_label ?? candidate.resource_id}
          </Button>
        ))}
      </div>
    </div>
  )
}
