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
  // pins its own intent regardless of the device preference — but several fixed
  // themes are light (Receipt, Newsprint, Brutalist…), so derive the palette from
  // the theme's background luminance instead of assuming dark.
  const colorScheme =
    theme.mode === 'fixed' ? fixedColorScheme(theme) : theme.mode
  root.style.setProperty('color-scheme', colorScheme)
  root.dataset.theme = theme.id
}

/** Pick the UA palette for a fixed theme from its background luminance. */
function fixedColorScheme(theme: Theme): 'light dark' | 'dark light' {
  const lum = hexLuminance(theme.tokens['--color-bg'])
  // Unparseable → fall back to the prior dark-first default.
  return lum != null && lum > 0.5 ? 'light dark' : 'dark light'
}

/** Perceived luminance (0–1) of a #rgb/#rrggbb color, or null if unparseable. */
function hexLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h =
    m[1].length === 3
      ? m[1].replace(/./g, (c) => c + c)
      : m[1]
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
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
