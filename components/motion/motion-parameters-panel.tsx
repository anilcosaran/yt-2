'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MotionDraft } from '@/lib/motion-editor/api'
import { parameterFieldKind, sampleValuesOf, valuesFromForm } from '@/lib/motion-editor/parameters'

/**
 * P06-02 parameter panel: the draft's exposed parameters (`motion_exposure_v1`, derived by the server from the typed
 * source) and the Test Data values the preview and the validation compile with. An empty field keeps the source's own
 * sample. Media is bound in a project and is never a Test Data value; number parameters are authoring-only, the rest is
 * what Spark may edit (text/colour/duration).
 */
export function MotionParametersPanel({
  draft,
  disabled,
  onApply,
}: {
  draft: MotionDraft
  disabled: boolean
  onApply: (values: Record<string, string | number>) => void
}) {
  const t = useTranslations('Motion.editor')
  const [invalid, setInvalid] = React.useState<string[]>([])
  const samples = React.useMemo(() => sampleValuesOf(draft.draft.pattern), [draft.draft.pattern])
  const parameters = draft.capabilities.parameters
  const values = draft.draft.test_data.values

  if (parameters.length === 0) return <p className="text-sm text-muted-foreground">{t('parameters.empty')}</p>

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const result = valuesFromForm(new FormData(event.currentTarget), parameters)
        setInvalid(result.invalid)
        if (result.invalid.length === 0) onApply(result.values)
      }}
    >
      {parameters.map((parameter) => {
        const kind = parameterFieldKind(parameter)
        const id = `motion-param-${parameter.parameter_id}`
        const current = values[parameter.parameter_id]
        const sample = samples[parameter.parameter_id]
        return (
          <div key={parameter.parameter_id} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <span>{parameter.parameter_id}</span>
              <span className="text-xs font-normal text-muted-foreground">{t(`parameters.kind.${kind === 'other' ? 'enum' : kind}`)}</span>
              <Badge variant="outline">{parameter.spark_editable ? t('parameters.sparkField') : t('parameters.authoringOnly')}</Badge>
            </label>
            {kind === 'media' ? (
              <p id={id} className="text-sm text-muted-foreground">{t('parameters.mediaBound')}</p>
            ) : kind === 'other' ? null : (
              <Input
                id={id}
                name={parameter.parameter_id}
                type={kind === 'duration' || kind === 'number' ? 'number' : 'text'}
                defaultValue={current === undefined ? '' : String(current)}
                placeholder={sample === undefined ? (kind === 'color' ? '#RRGGBB' : '') : String(sample)}
                maxLength={parameter.text?.max_chars}
                min={parameter.duration?.min_frames ?? parameter.number?.min}
                max={parameter.duration?.max_frames ?? parameter.number?.max}
                disabled={disabled}
                aria-invalid={invalid.includes(parameter.parameter_id) || undefined}
              />
            )}
          </div>
        )
      })}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t('parameters.lookLabel')}: {draft.draft.test_data.video_style_ref}
        </span>
        <Button type="submit" size="sm" disabled={disabled}>
          {t('actions.applyValues')}
        </Button>
      </div>
    </form>
  )
}
