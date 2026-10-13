'use client'

import { useTranslations } from 'next-intl'

import type { CompositionDocument } from '@/lib/spark/composition-client'
import type { SparkCompositionActions } from '@/lib/spark/composition-session'
import { sceneMusic } from '@/lib/spark/composition-typed-edits'
import { sceneMotionLayer } from '@/lib/spark/motion-instance'

import { SparkMotionControls } from '../spark-motion-controls'
import { SceneBackgroundSection } from './scene-background-section'
import { SceneTransitionSection } from './scene-transition-section'
import { useHasQueryClient } from './narration-voice-queries'
import { SceneVoiceSection } from './scene-voice-section'
import { Icon, PanelSection, Toggle, formatDuration } from './studio-parts'
import type { SparkToolContext, TimelineScene } from './spark-tool-types'

/**
 * Scene properties shown while no element is selected (design `renderProps` without a selection).
 * Only values the document holds are shown: sections without a document field stay disabled
 * "coming soon" with no demo value. "Music" is on while music plays in the scene and turns the
 * scene's own music off as one command; music of the whole project cannot be removed here.
 *
 * E1-J: with the stage on (`tool.stage`) the "Background" section is live (colour, picture or video, replace, remove:
 * `scene-background-section.tsx`); without it the design's disabled placeholder stays.
 * E1-L: "Transition" is live (`scene-transition-section.tsx`): the transition into this scene, set through the document.
 *
 * E1-K: the "Voice" row (design "Avatar voice") is live with a tool context (`scene-voice-section.tsx`): the voice the
 * scene's narration was made with and a picker that re-speaks the scene's script with another voice (price first, then a
 * paid job, then the narration is replaced on the server). It does not need the stage.
 */
export function ScenePanel({
  document,
  entry,
  canWrite,
  readOnly,
  actions,
  tool,
}: {
  document: CompositionDocument
  entry: TimelineScene
  canWrite: boolean
  readOnly: boolean
  actions: SparkCompositionActions
  /** What the registry's tools read and call (the shell's `SparkToolContext`); absent: no tool-backed sections. */
  tool?: SparkToolContext
}) {
  const t = useTranslations('Spark.editor')
  const comingSoon = t('comingSoon')
  // The Voice row reads the server through the query cache the root layout mounts; without one it stays the placeholder.
  const voiceReady = useHasQueryClient()
  const music = sceneMusic(document, entry.scene)
  const motionLayer = sceneMotionLayer(entry.scene)
  const musicRemovable = music.scenePlacementIds.length > 0
  let musicTitle: string | undefined
  if (readOnly) musicTitle = t('readOnly')
  else if (!musicRemovable) musicTitle = music.projectWide ? t('scenePanel.projectMusic') : comingSoon

  return (
    <>
      <div className="pp-head">
        <span className="ic">
          <Icon name="scenes" />
        </span>
        <div>
          <b>{t('sceneName', { n: entry.number })}</b>
          <small>{formatDuration(entry.seconds)}</small>
        </div>
      </div>
      <PanelSection label={t('scenePanel.layout')}>
        <button type="button" className="btn w100" disabled title={comingSoon}>
          <Icon name="refresh" size="sm" />
          {t('scenePanel.replaceLayout')}
        </button>
      </PanelSection>
      {motionLayer ? (
        // P06-46 / QA-243: a document v2 Motion scene's Enerji and Kalıp (free recompiles, one undo each).
        <PanelSection label={t('motionSection.label')}>
          <SparkMotionControls
            projectId={document.project_id}
            layerId={motionLayer.layer_id}
            layerRev={motionLayer.rev}
            canWrite={canWrite}
            readOnly={readOnly}
            apply={actions.apply}
          />
        </PanelSection>
      ) : null}
      {tool?.stage ? (
        <SceneBackgroundSection ctx={tool} document={document} entry={entry} canWrite={canWrite} readOnly={readOnly} />
      ) : (
        <PanelSection label={t('scenePanel.background')}>
          <label className="field" title={comingSoon}>
            <span className="sw" />
            <input disabled aria-label={t('scenePanel.background')} />
          </label>
          <Toggle label={t('scenePanel.backgroundMedia')} on={false} disabled title={comingSoon} />
        </PanelSection>
      )}
      <PanelSection label={t('scenePanel.audio')}>
        <Toggle
          label={t('scenePanel.music')}
          hint={t('scenePanel.musicHint')}
          on={musicRemovable || music.projectWide}
          disabled={!musicRemovable || !canWrite}
          title={musicTitle}
          onClick={() => void actions.removeSceneMusic(entry.scene.scene_id)}
        />
        {tool && voiceReady ? (
          <SceneVoiceSection ctx={tool} document={document} entry={entry} readOnly={readOnly} />
        ) : (
          <Toggle label={t('scenePanel.avatarVoice')} on={false} disabled title={comingSoon} />
        )}
      </PanelSection>
      <SceneTransitionSection document={document} entry={entry} canWrite={canWrite} readOnly={readOnly} actions={actions} stage={tool?.stage ?? null} />
    </>
  )
}
