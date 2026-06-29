/**
 * Theme = data, not code (spec §13, CLAUDE.md architecture principle 1).
 *
 * A theme is a bundle of design tokens expressed as CSS custom properties. Every
 * visual surface reads from these variables — never from hardcoded colors/fonts —
 * so adding a theme means dropping a new bundle into the registry with zero
 * component changes. The token keys here are the single source of truth; Tailwind
 * (tailwind.config.js) and components both reference the same `--color-*` / `--font-*`
 * variables.
 */

/**
 * How a theme handles light/dark. A `fixed` theme renders identically regardless
 * of the device's color-scheme preference (e.g. the arcade board is always dark),
 * which keeps exported scorecards consistent for everyone (spec §13).
 */
export type ThemeMode = 'light' | 'dark' | 'fixed'

/** The full set of token CSS variables every theme must define. */
export interface ThemeTokens {
  /* Palette */
  '--color-bg': string
  '--color-surface': string
  '--color-surface-alt': string
  '--color-text': string
  '--color-muted': string
  '--color-border': string

  /* Accents */
  '--color-accent': string
  '--color-accent-contrast': string
  '--color-winner': string

  /* Typography */
  '--font-label': string
  '--font-numeral': string
  '--font-display': string

  /* Card chrome */
  '--radius-card': string
  '--border-width-card': string
}

export interface Theme {
  id: string
  name: string
  /** Visual direction, shown in the (future) theme gallery. */
  description: string
  mode: ThemeMode
  tokens: ThemeTokens
  /** Bespoke winner badge (spec §13); defaults to a plain "Winner" when absent. */
  winner?: WinnerTreatment
}

/**
 * Per-theme winner treatment (spec §13) — the badge a theme stamps on the winner
 * (e.g. arcade "JACKPOT", casino "HOUSE WINS"). Data, not code: a theme declares
 * it and the results board / scorecards render it; themes without one fall back
 * to a plain "Winner".
 */
export interface WinnerTreatment {
  /** Badge text in the theme's voice. */
  label: string
  /** Optional glyph shown before the label (e.g. "👑", "🪙"). */
  emoji?: string
}

/** A theme's winner treatment, or the plain default. */
export function winnerTreatment(theme: Theme): WinnerTreatment {
  return theme.winner ?? { label: 'Winner' }
}
