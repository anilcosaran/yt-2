'use client'

import * as React from 'react'

import type { PlaybackSnapshot } from '@/lib/spark/playback-store'
import type { StageViewState } from '@/lib/spark/stage/stage-controller'
import type { StageSelection } from '@/lib/spark/stage/stage-selection'

import type { SparkStageBinding } from './use-spark-stage'

/** The stage's view state (selection overlay, drag state, menu, text editor, presenter status). */
export function useStageState(binding: SparkStageBinding): StageViewState {
  return React.useSyncExternalStore(binding.controller.subscribe, binding.controller.getSnapshot, binding.controller.getSnapshot)
}

/** `{playing, frame, totalFrames, fps}`: re-renders on play/pause and range changes, NOT on every frame. */
export function usePlaybackSnapshot(binding: SparkStageBinding): PlaybackSnapshot {
  return React.useSyncExternalStore(binding.playback.subscribe, binding.playback.getSnapshot, binding.playback.getSnapshot)
}

/** The playhead frame: re-renders on every frame, for the few small pieces that show it (time label, playhead). */
export function usePlaybackFrame(binding: SparkStageBinding): number {
  const subscribe = React.useCallback((listener: () => void) => binding.playback.subscribeFrame(() => listener()), [binding.playback])
  return React.useSyncExternalStore(subscribe, () => binding.playback.frame, () => binding.playback.frame)
}

const NO_SELECTION_SUBSCRIBE = () => () => undefined
const NO_SELECTION = () => null

/** The canvas selection (changes only when the user selects), for the few places that must not follow every frame. */
export function useStageSelection(binding: SparkStageBinding | null): StageSelection | null {
  return React.useSyncExternalStore(
    binding ? binding.controller.selection.subscribe : NO_SELECTION_SUBSCRIBE,
    binding ? binding.controller.selection.getSnapshot : NO_SELECTION,
    NO_SELECTION,
  )
}
