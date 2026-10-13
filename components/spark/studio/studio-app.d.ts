export interface StudioOptions {
  /** Switches the app theme; the studio's theme button and Shift+D call it. */
  setTheme?: (theme: 'light' | 'dark') => void
  /** Name of the opened Spark project, shown in the top bar title. */
  projectTitle?: string
  /** Label of the way back to the project list (breadcrumb text and tooltip). */
  backLabel?: string
  /** Called when the user clicks the logo or breadcrumb to return to the project list. */
  onBack?: () => void
}

export interface StudioHandle {
  /** Refreshes the studio's theme button after the app theme changed elsewhere. */
  syncTheme(): void
  /** Removes the studio DOM and releases every listener, observer, timer and frame. */
  dispose(): void
}

export function mountStudio(root: HTMLElement, options?: StudioOptions): StudioHandle
