'use client'

import { DeveloperConsent } from './developer-consent'
import { DeveloperResourcePicker } from './developer-resource-picker'

/** Client entry of `/developer/authorize/[uid]` (DEV-02) with the DEV-03 typed resource picker. */
export function DeveloperConsentPage({ uid, initialError }: { uid: string; initialError: string | null }) {
  return (
    <DeveloperConsent
      uid={uid}
      initialError={initialError}
      renderResourcePicker={({ resourceKinds, onChange, disabled }) => (
        <DeveloperResourcePicker uid={uid} resourceKinds={resourceKinds} onChange={onChange} disabled={disabled} />
      )}
    />
  )
}
