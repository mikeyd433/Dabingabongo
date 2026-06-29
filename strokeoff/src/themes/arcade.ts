import type { Theme } from './types'

/**
 * Arcade — stub second theme (spec §13, theme 2). Its only Phase 0 job is to prove
 * that switching the active token bundle restyles the entire shell with zero
 * component changes. Dark high-score board: neon cyan/magenta, winner = glowing column.
 * Fixed dark palette so exported scorecards look identical for everyone.
 */
export const arcade: Theme = {
  id: 'arcade',
  name: 'Arcade',
  description:
    'Dark high-score board; neon cyan/magenta, pixel wordmark, rank chips; winner = glowing column + crown.',
  mode: 'fixed',
  tokens: {
    '--color-bg': '#0a0a18',
    '--color-surface': '#141430',
    '--color-surface-alt': '#1e1e44',
    '--color-text': '#e7faff',
    '--color-muted': '#7a7ab0',
    '--color-border': '#2d2d66',

    '--color-accent': '#22d3ee',
    '--color-accent-contrast': '#0a0a18',
    '--color-winner': '#f0f',

    '--font-label': "'Press Start 2P', 'Courier New', monospace",
    '--font-numeral': "ui-monospace, 'Courier New', monospace",
    '--font-display': "'Press Start 2P', 'Courier New', monospace",

    '--radius-card': '0.25rem',
    '--border-width-card': '2px',
  },
}
