import type { Theme, WinnerTreatment } from './types'
import { statSheet } from './statSheet'
import { arcade } from './arcade'
import { galleryThemes } from './gallery'

/**
 * The theme registry (spec §13). The launch set leads with `stat-sheet` (default)
 * and `arcade`, then the rest of the ~21-theme gallery. Adding a theme is just
 * another bundle in `gallery.ts` — no component changes (architecture principle 1).
 */

/**
 * Bespoke winner badges by theme (spec §13). Kept as one data map rather than
 * scattered through every bundle; a theme may still set its own `winner` (that
 * wins). Anything unlisted falls back to a plain "Winner".
 */
const WINNER_TREATMENTS: Record<string, WinnerTreatment> = {
  arcade: { label: 'High score', emoji: '🕹️' },
  'casino-felt': { label: 'House wins', emoji: '🪙' },
  pinball: { label: 'Jackpot', emoji: '🎯' },
  'comic-pop': { label: 'Kapow!', emoji: '💥' },
  bowling: { label: 'Strike!', emoji: '🎳' },
  synthwave: { label: 'Radical', emoji: '🌆' },
  noir: { label: 'Case closed', emoji: '🕵️' },
  galaxy: { label: 'Stellar', emoji: '✨' },
  tiki: { label: 'Big kahuna', emoji: '🌺' },
  vintage: { label: 'Champion', emoji: '🏆' },
  trail: { label: 'Trail boss', emoji: '🥏' },
}

function withTreatment(theme: Theme): Theme {
  const winner = theme.winner ?? WINNER_TREATMENTS[theme.id]
  // Preserve object identity when there's no treatment to attach.
  return winner ? { ...theme, winner } : theme
}

export const themes: Theme[] = [statSheet, arcade, ...galleryThemes].map(
  withTreatment,
)

export const themesById: Record<string, Theme> = Object.fromEntries(
  themes.map((theme) => [theme.id, theme]),
)

/** The house default every new round/group falls back to (spec §13). */
export const DEFAULT_THEME_ID = statSheet.id

export function getTheme(id: string): Theme {
  return themesById[id] ?? statSheet
}
