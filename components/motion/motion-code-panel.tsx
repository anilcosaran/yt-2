'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * P06-02 code panel: the opt-in view of the draft's typed source (`motion-library@1`, as JSON). It opens on request only
 * (the default view is preview + Chat + parameters); its save is one CAS write of the whole source, and a source that is
 * not JSON is never sent. Closing the panel does not save anything.
 */
export function MotionCodePanel({
  sourceText,
  editable,
  disabled,
  onSave,
}: {
  sourceText: string
  editable: boolean
  disabled: boolean
  onSave: (text: string) => void
}) {
  const t = useTranslations('Motion.editor')
  return (
    <form
      className="flex flex-col gap-2"
      data-motion-code-panel=""
      onSubmit={(event) => {
        event.preventDefault()
        const text = new FormData(event.currentTarget).get('source')
        if (typeof text === 'string') onSave(text)
      }}
    >
      <p className="text-xs text-muted-foreground">{t('source.hint')}</p>
      <Textarea
        name="source"
        aria-label={t('source.label')}
        defaultValue={sourceText}
        readOnly={!editable}
        spellCheck={false}
        className="min-h-96 font-mono text-xs"
      />
      {editable ? (
        <Button type="submit" size="sm" className="self-end" disabled={disabled}>
          {t('actions.saveSource')}
        </Button>
      ) : null}
    </form>
  )
}
