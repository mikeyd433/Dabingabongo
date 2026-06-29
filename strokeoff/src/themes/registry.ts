import type { Theme } from './types'
import { statSheet } from './statSheet'
import { arcade } from './arcade'

/**
 * The theme registry. Phase 0 ships the default (`stat-sheet`) plus one stub
 * (`arcade`) to prove token-driven switching. The full ~21-theme set lands in
 * Phase 7 — adding a theme is just another entry here, no component changes.
 */
export const themes: Theme[] = [statSheet, arcade]

export const themesById: Record<string, Theme> = Object.fromEntries(
  themes.map((theme) => [theme.id, theme]),
)

/** The house default every new round/group falls back to (spec §13). */
export const DEFAULT_THEME_ID = statSheet.id

export function getTheme(id: string): Theme {
  return themesById[id] ?? statSheet
}
