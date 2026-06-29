import type { Theme } from './types'

/**
 * Stat-sheet — the default theme (spec §13, theme 1).
 * Clean modern box score: light, tabular numerals, one accent; winner = tinted column.
 */
export const statSheet: Theme = {
  id: 'stat-sheet',
  name: 'Stat-sheet',
  description:
    'Clean modern box score; light, tabular numerals, one accent; winner = tinted column.',
  mode: 'light',
  tokens: {
    '--color-bg': '#f8fafc',
    '--color-surface': '#ffffff',
    '--color-surface-alt': '#f1f5f9',
    '--color-text': '#0f172a',
    '--color-muted': '#64748b',
    '--color-border': '#e2e8f0',

    '--color-accent': '#1d4ed8',
    '--color-accent-contrast': '#ffffff',
    '--color-winner': '#15803d',

    '--font-label': "'Inter', system-ui, sans-serif",
    '--font-numeral':
      "'Inter', ui-monospace, 'SF Mono', 'Roboto Mono', monospace",
    '--font-display': "'Inter', system-ui, sans-serif",

    '--radius-card': '0.75rem',
    '--border-width-card': '1px',
  },
}
