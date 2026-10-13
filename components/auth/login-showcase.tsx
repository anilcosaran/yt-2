'use client'

import * as React from 'react'
import Image from 'next/image'

import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'
import { useTranslations } from 'next-intl'

const slides = [
  {
    titleKey: 'welcomeTitle',
    subtitleKey: 'welcomeSubtitle',
    image: '/auth/ai-video-workspace.png',
    altKey: 'welcomeAlt',
    background:
      'linear-gradient(145deg, rgb(255 252 250), rgb(255 244 239) 52%, rgb(249 225 219))',
    darkBackground:
      'linear-gradient(145deg, rgb(26 25 30), rgb(42 35 39) 52%, rgb(66 45 44))',
    glow:
      'radial-gradient(circle at 48% 112%, rgb(255 86 48 / 0.18), transparent 56%)',
    darkGlow:
      'radial-gradient(circle at 48% 112%, rgb(255 86 48 / 0.18), transparent 56%)',
  },
  {
    titleKey: 'planTitle',
    subtitleKey: 'planSubtitle',
    image: '/auth/storyboard-timeline.png',
    altKey: 'planAlt',
    background:
      'linear-gradient(145deg, rgb(250 251 255), rgb(244 242 255) 52%, rgb(232 226 250))',
    darkBackground:
      'linear-gradient(145deg, rgb(24 26 32), rgb(36 35 48) 52%, rgb(50 43 67))',
    glow:
      'radial-gradient(circle at 48% 112%, rgb(124 58 237 / 0.16), transparent 56%)',
    darkGlow:
      'radial-gradient(circle at 48% 112%, rgb(124 58 237 / 0.18), transparent 56%)',
  },
  {
    titleKey: 'publishTitle',
    subtitleKey: 'publishSubtitle',
    image: '/auth/campaign-publishing.png',
    altKey: 'publishAlt',
    background:
      'linear-gradient(145deg, rgb(250 255 253), rgb(240 251 246) 52%, rgb(220 241 232))',
    darkBackground:
      'linear-gradient(145deg, rgb(24 30 29), rgb(33 47 43) 52%, rgb(43 65 56))',
    glow:
      'radial-gradient(circle at 48% 112%, rgb(54 179 126 / 0.16), transparent 56%)',
    darkGlow:
      'radial-gradient(circle at 48% 112%, rgb(54 179 126 / 0.17), transparent 56%)',
  },
]

function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function syncDarkMode() {
      setIsDarkMode(
        document.documentElement.classList.contains('dark') ||
          (!document.documentElement.classList.contains('light') &&
            mediaQuery.matches),
      )
    }

    const observer = new MutationObserver(syncDarkMode)

    syncDarkMode()
    mediaQuery.addEventListener('change', syncDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      mediaQuery.removeEventListener('change', syncDarkMode)
      observer.disconnect()
    }
  }, [])

  return isDarkMode
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    setReducedMotion(mediaQuery.matches)

    function handleChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return reducedMotion
}

export function LoginShowcase() {
  const tAuto = useTranslations('Auto')
  const tShowcase = useTranslations('LoginShowcase')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const isDarkMode = useDarkMode()
  const reducedMotion = useReducedMotion()
  const activeSlide = slides[activeIndex]

  React.useEffect(() => {
    if (reducedMotion) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length)
    }, 4500)

    return () => window.clearInterval(timer)
  }, [reducedMotion])

  return (
    <section
      className="relative isolate hidden overflow-hidden text-white transition-colors duration-700 lg:flex lg:h-svh"
      style={{
        background: isDarkMode
          ? activeSlide.darkBackground
          : activeSlide.background,
      }}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-[44%] transition-opacity duration-700"
        style={{ background: isDarkMode ? activeSlide.darkGlow : activeSlide.glow }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_14%,rgb(255_255_255_/_0.35),transparent_24%),radial-gradient(circle_at_86%_20%,rgb(255_255_255_/_0.24),transparent_22%)] dark:bg-[radial-gradient(circle_at_14%_14%,rgb(255_255_255_/_0.1),transparent_24%),radial-gradient(circle_at_86%_20%,rgb(255_255_255_/_0.08),transparent_22%)]" />

      <span className="absolute -bottom-44 left-8 h-[760px] w-[760px] rounded-full border border-[#172B4D]/8 dark:border-white/8" />
      <span className="absolute -bottom-52 left-36 h-[800px] w-[800px] rounded-full border border-[#172B4D]/7 dark:border-white/7" />
      <span className="absolute -bottom-60 left-64 h-[840px] w-[840px] rounded-full border border-[#172B4D]/6 dark:border-white/6" />

      <div className="relative z-10 flex h-svh w-full flex-col px-[4.8vw] py-[52px]">
        <div className="mx-auto flex h-full w-full max-w-[960px] flex-col">
          <div className="flex min-h-0 flex-[0_0_65%] items-center">
            <div className="w-full overflow-hidden rounded-[28px] border border-white/80 bg-white/72 p-3 shadow-[0_30px_76px_rgb(23_43_77_/_0.12)] backdrop-blur dark:border-white/12 dark:bg-white/8 dark:shadow-[0_30px_76px_rgb(0_0_0_/_0.28)]">
              <div className="overflow-hidden rounded-[20px] border border-white/70 bg-[#eef5ff] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.8)] dark:border-white/10 dark:bg-[#0f172a]">
                <div className="flex h-11 items-center gap-2 border-b border-[#dfe7f4] bg-white/88 px-4 dark:border-white/10 dark:bg-[#111827]/90">
                  <span className="size-3 rounded-full bg-[#ff5f57]" />
                  <span className="size-3 rounded-full bg-[#ffbd2e]" />
                  <span className="size-3 rounded-full bg-[#28c840]" />
                  <span className="ml-3 h-6 flex-1 rounded-full bg-[#eef2f7] dark:bg-white/10" />
                </div>
                <div className="relative aspect-[1.64]">
                  {slides.map((slide, index) => {
                    const isActive = index === activeIndex

                    return (
                      <Image
                        key={slide.image}
                        src={slide.image}
                        alt={tShowcase(slide.altKey)}
                        fill
                        priority={index === 0}
                        sizes="58vw"
                        className={cn(
                          'object-cover transition-[opacity,transform] duration-1000 ease-out motion-reduce:transition-none',
                          isActive
                            ? 'scale-100 opacity-100'
                            : 'scale-[1.02] opacity-0',
                        )}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex flex-1 flex-col justify-start pt-8">
            <div className="absolute -inset-x-10 top-0 h-[210px] rounded-full bg-white/30 blur-3xl dark:bg-black/18" />
            <div
              key={activeSlide.titleKey}
              className="relative animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
            >
              <h2 className="max-w-[560px] text-[44px] font-bold leading-[1.08] tracking-normal text-[#172B4D] dark:text-white">
                {tShowcase(activeSlide.titleKey)}
              </h2>
              <p className="mt-4 max-w-[520px] text-[17px] font-medium leading-[1.38] text-[#42526E] dark:text-white/78">
                {tShowcase(activeSlide.subtitleKey)}
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between gap-6">
            <p className="text-sm font-medium text-[#6B778C] dark:text-white/50">
              <UiText id="copy_2026_youtorch_all_rights_reserved_12f70f96" /></p>
            <div className="flex gap-2" aria-label={tAuto('showcase_slides_adf2ea86')}>
              {slides.map((slide, index) => (
                <button
                  key={slide.titleKey}
                  type="button"
                  aria-label={tShowcase('showSlide', { title: tShowcase(slide.titleKey) })}
                  aria-current={index === activeIndex}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    'h-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 motion-reduce:transition-none',
                    index === activeIndex
                      ? 'w-8 bg-[#172B4D] dark:bg-white'
                      : 'w-2.5 bg-[#172B4D]/25 hover:bg-[#172B4D]/45 dark:bg-white/35 dark:hover:bg-white/60',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
