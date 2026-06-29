import type { Theme } from './types'
import { statSheet } from './statSheet'
import { arcade } from './arcade'
import { galleryThemes } from './gallery'

/**
 * The theme registry (spec §13). The launch set leads with `stat-sheet` (default)
 * and `arcade`, then the rest of the ~21-theme gallery. Adding a theme is just
 * another bundle in `gallery.ts` — no component changes (architecture principle 1).
 */
export const themes: Theme[] = [statSheet, arcade, ...galleryThemes]

export const themesById: Record<string, Theme> = Object.fromEntries(
  themes.map((theme) => [theme.id, theme]),
)

/** The house default every new round/group falls back to (spec §13). */
export const DEFAULT_THEME_ID = statSheet.id

export function getTheme(id: string): Theme {
  return themesById[id] ?? statSheet
}
