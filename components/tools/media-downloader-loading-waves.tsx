'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

import styles from './media-downloader-metadata-preview.module.css'

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function nextWavePose(index: number, initial = false) {
  const travel = initial ? 12 : 26
  const radius = () => `${randomBetween(32, 68).toFixed(1)}%`
  return {
    transform: `translate3d(${randomBetween(-travel, travel).toFixed(1)}%, ${randomBetween(-travel, travel).toFixed(1)}%, 0) rotate(${randomBetween(-70, 70).toFixed(1)}deg) scale(${randomBetween(0.8, 1.2).toFixed(2)}, ${randomBetween(0.8, 1.2).toFixed(2)})`,
    opacity: randomBetween(index < 2 ? 0.66 : 0.42, index < 2 ? 0.9 : 0.7).toFixed(2),
    borderRadius: `${radius()} ${radius()} ${radius()} ${radius()} / ${radius()} ${radius()} ${radius()} ${radius()}`,
  }
}

export function MediaDownloaderLoadingWaves() {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const elements = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[data-media-loading-wave]') ?? [])
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const animations = new Set<Animation>()
    let disposed = false
    let started = false

    const shouldPause = () => motionPreference.matches || document.visibilityState === 'hidden'

    const start = () => {
      if (started || disposed || shouldPause()) return
      started = true
      elements.forEach((element, index) => {
        if (typeof element.animate !== 'function') return
        let current = nextWavePose(index, true)
        Object.assign(element.style, current)

        const advance = () => {
          if (disposed) return
          const next = nextWavePose(index)
          const animation = element.animate([current, next], {
            duration: randomBetween(4000, 7500) / 3.3,
            easing: 'ease-in-out',
            fill: 'forwards',
          })
          animations.add(animation)
          if (shouldPause()) animation.pause()
          animation.onfinish = () => {
            if (disposed) return
            // Continue from the last pose; there is no timeline reset or loop seam.
            Object.assign(element.style, next)
            current = next
            animations.delete(animation)
            animation.onfinish = null
            animation.cancel()
            advance()
          }
        }
        advance()
      })
    }

    const syncPlayback = () => {
      start()
      for (const animation of animations) {
        if (shouldPause()) animation.pause()
        else animation.play()
      }
    }
    motionPreference.addEventListener('change', syncPlayback)
    document.addEventListener('visibilitychange', syncPlayback)
    start()

    return () => {
      disposed = true
      motionPreference.removeEventListener('change', syncPlayback)
      document.removeEventListener('visibilitychange', syncPlayback)
      for (const animation of animations) {
        animation.onfinish = null
        animation.cancel()
      }
      animations.clear()
    }
  }, [])

  return (
    <div ref={containerRef} aria-hidden="true" className={styles.waves} data-media-downloader-waves>
      <span data-media-loading-wave className={cn(styles.wave, styles.bluePrimary)} />
      <span data-media-loading-wave className={cn(styles.wave, styles.violetPrimary)} />
      <span data-media-loading-wave className={cn(styles.wave, styles.blueSecondary)} />
      <span data-media-loading-wave className={cn(styles.wave, styles.violetSecondary)} />
    </div>
  )
}
