import { ViewTransition } from 'react'

import { WORK_TAB_TRANSITION } from '@/lib/page-transitions'

/**
 * Moving between pages has one quiet motion everywhere: the old page fades out quickly and the new one rises a few
 * pixels into place, sharpening as it arrives (`.page-exit` / `.page-enter` in globals.css). Moving between the top
 * bar's tabs (`WORK_TAB_TRANSITION`) has none: the page swaps at once, as a browser's tabs do. The template is
 * mounted again on every navigation, so its `ViewTransition` exits and enters; the menus around it are layouts and
 * stay put. Without View Transitions support the pages simply swap.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ [WORK_TAB_TRANSITION]: 'none', default: 'page-enter' }}
      exit={{ [WORK_TAB_TRANSITION]: 'none', default: 'page-exit' }}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}
