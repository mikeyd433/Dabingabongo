import { createContext } from 'react'
import type { Theme } from './types'

export interface ThemeContextValue {
  theme: Theme
  /** Switch the active theme by id. Restyles the whole shell via token swap. */
  setThemeId: (id: string) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
