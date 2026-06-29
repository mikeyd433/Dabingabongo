import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext } from './ThemeContext'
import { DEFAULT_THEME_ID, getTheme } from './registry'
import type { Theme } from './types'

/**
 * Applies a theme's tokens as CSS custom properties on a root element. This is the
 * one place that touches the DOM for theming — every component just reads the
 * resulting `var(--…)` values (directly or via Tailwind), so a theme change here
 * restyles the entire shell with zero component edits (spec §13).
 */
function applyTheme(theme: Theme, root: HTMLElement) {
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(key, value)
  }
  // Tell the browser which form-control/scrollbar palette to use. A `fixed` theme
  // declares its own light/dark intent so exports look identical everywhere.
  const colorScheme =
    theme.mode === 'fixed'
      ? // Heuristic: fixed themes in our set are dark unless clearly light.
        'dark light'
      : theme.mode
  root.style.setProperty('color-scheme', colorScheme)
  root.dataset.theme = theme.id
}

interface ThemeProviderProps {
  children: ReactNode
  /** Initial theme; defaults to the house theme. */
  initialThemeId?: string
}

export function ThemeProvider({
  children,
  initialThemeId = DEFAULT_THEME_ID,
}: ThemeProviderProps) {
  const [themeId, setThemeId] = useState(initialThemeId)
  const theme = useMemo(() => getTheme(themeId), [themeId])

  useEffect(() => {
    applyTheme(theme, document.documentElement)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setThemeId,
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
