'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import type { SparkCompositionState } from '@/lib/spark/composition-session'
import { layerViewOf, sceneLayerViews } from '@/lib/spark/stage/document-layers'
import { controlSet } from '@/lib/spark/stage/toolbox-model'

import { clampMenuPosition } from '../spark-quick-ai'
import { StudioIcon } from '../studio-icon'
import type { SparkStageBinding } from './use-spark-stage'

const MENU_SIZE = { width: 240, height: 330 }
/** Physical key caps: the same in every locale (the design's `kbd` hints). */
const KEYS = {
  edit: 'Enter',
  ask: 'Ctrl K',
  front: 'Shift ]',
  forward: ']',
  backward: '[',
  back: 'Shift [',
  remove: 'Del',
  duplicate: 'Ctrl D',
  copy: 'Ctrl C',
  paste: 'Ctrl V',
} as const

/**
 * The layer context menu (design `.cmenu`): right-click on a layer, or "More" in the toolbox, or the ContextMenu key. Edit
 * text, Ask AI, the four order actions, centre, reset position and delete. Each item is one typed command through the stage
 * controller; items the inspector schema does not list for the layer are not shown. Closes on Escape, outside click,
 * scroll and resize like the timeline's text menu.
 */
export function StageContextMenu({
  binding,
  menu,
  composition,
  canWrite,
  writeTitle,
  onClose,
}: {
  binding: SparkStageBinding
  menu: { x: number; y: number; layerId: string }
  composition: SparkCompositionState
  canWrite: boolean
  writeTitle?: string
  onClose: () => void
}) {
  const t = useTranslations('Spark.editor.stage')
  const { controller, schema } = binding
  const ref = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // One subscription per open menu; the first enabled item takes the focus once.
  React.useEffect(() => {
    const element = ref.current
    element?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const close = () => onCloseRef.current()
    const onPointer = (event: MouseEvent) => {
      if (element && !element.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [])

  const document = composition.workingCopy?.document ?? null
  const sceneId = controller.selection.getSnapshot()?.sceneId ?? null
  const view = layerViewOf(document, sceneId, menu.layerId)
  if (!view) return null
  const controls = controlSet(schema, view)
  const order = sceneLayerViews(document, sceneId).map((candidate) => candidate.layerId)
  const index = order.indexOf(menu.layerId)
  const atTop = index === order.length - 1
  const atBottom = index === 0
  const disabled = !canWrite
  const position = clampMenuPosition(
    menu.x,
    menu.y,
    { width: globalThis.window?.innerWidth ?? 1280, height: globalThis.window?.innerHeight ?? 800 },
    controller.contextToolbar ? { ...MENU_SIZE, height: MENU_SIZE.height + 110 } : MENU_SIZE,
  )

  return (
    <div ref={ref} className="cmenu" role="menu" aria-label={t('menu.label')} style={{ left: position.x, top: position.y }}>
      {view.kind === 'text' && controls.content ? (
        <button type="button" role="menuitem" disabled={disabled} title={writeTitle} onClick={() => controller.startTextEdit()}>
          <StudioIcon name="type" />
          {t('menu.editText')}
          <kbd>{KEYS.edit}</kbd>
        </button>
      ) : null}
      <button type="button" role="menuitem" disabled={disabled} title={writeTitle} onClick={() => controller.askAi()}>
        <StudioIcon name="sparkles" className="spark" />
        {t('menu.askAi')}
        <kbd>{KEYS.ask}</kbd>
      </button>
      {controller.contextToolbar && view.kind !== 'motion_instance' ? (
        // Contextual toolbar (`SPARK_CONTEXT_TOOLBAR_ENABLED`): the same duplicate / copy / paste as Ctrl/Cmd+D / C / V.
        <>
          <hr />
          <button type="button" role="menuitem" disabled={disabled} title={writeTitle} onClick={() => void controller.duplicateSelected()}>
            <StudioIcon name="dup" />
            {t('ctb.duplicate')}
            <kbd>{KEYS.duplicate}</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              controller.copySelected()
              onClose()
            }}
          >
            <StudioIcon name="copy" />
            {t('ctb.copy')}
            <kbd>{KEYS.copy}</kbd>
          </button>
          <button type="button" role="menuitem" disabled={disabled || !controller.canPaste} title={writeTitle} onClick={() => void controller.pasteClipboard()}>
            <StudioIcon name="copy" />
            {t('ctb.paste')}
            <kbd>{KEYS.paste}</kbd>
          </button>
        </>
      ) : null}
      {controls.arrange ? (
        <>
          <hr />
          <button type="button" role="menuitem" disabled={disabled || atTop} title={writeTitle} onClick={() => void controller.arrangeSelected('front')}>
            <StudioIcon name="front" />
            {t('menu.front')}
            <kbd>{KEYS.front}</kbd>
          </button>
          <button type="button" role="menuitem" disabled={disabled || atTop} title={writeTitle} onClick={() => void controller.arrangeSelected('forward')}>
            <StudioIcon name="front" />
            {t('menu.forward')}
            <kbd>{KEYS.forward}</kbd>
          </button>
          <button type="button" role="menuitem" disabled={disabled || atBottom} title={writeTitle} onClick={() => void controller.arrangeSelected('backward')}>
            <StudioIcon name="back" />
            {t('menu.backward')}
            <kbd>{KEYS.backward}</kbd>
          </button>
          <button type="button" role="menuitem" disabled={disabled || atBottom} title={writeTitle} onClick={() => void controller.arrangeSelected('back')}>
            <StudioIcon name="back" />
            {t('menu.back')}
            <kbd>{KEYS.back}</kbd>
          </button>
        </>
      ) : null}
      {controls.position ? (
        <>
          <hr />
          <button type="button" role="menuitem" disabled={disabled} title={writeTitle} onClick={() => void controller.centreSelected()}>
            <StudioIcon name="center-h" />
            {t('menu.centre')}
          </button>
          {view.transform ? (
            <button type="button" role="menuitem" disabled={disabled} title={writeTitle} onClick={() => void controller.resetSelected()}>
              <StudioIcon name="refresh" />
              {t('menu.reset')}
            </button>
          ) : null}
        </>
      ) : null}
      {controls.remove ? (
        <>
          <hr />
          <button type="button" role="menuitem" className="danger" disabled={disabled} title={writeTitle} onClick={() => void controller.deleteSelected()}>
            <StudioIcon name="trash" />
            {t('menu.delete')}
            <kbd>{KEYS.remove}</kbd>
          </button>
        </>
      ) : null}
    </div>
  )
}
