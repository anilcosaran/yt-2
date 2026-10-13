'use client'

import * as React from 'react'

/** The project's view switch (Lite / Plan / Editör), shown in the middle of the top bar. */
export const ViewSwitchContext = React.createContext<React.ReactNode>(null)

/**
 * A layer beside `.yt-studio`, outside the Spark style scope. The Flow canvas is an app-themed (Tailwind)
 * surface and the Spark scope resets its paddings and borders, so it is mounted here over its slot.
 */
export const LabOverlayContext = React.createContext<HTMLElement | null>(null)
