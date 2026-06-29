import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, getTheme, themes, themesById } from './registry'
import { statSheet } from './statSheet'

/**
 * Token-architecture sanity. Proves every theme is a complete, distinct token
 * bundle — the basis for restyling the shell by swapping bundles with no component
 * changes (Phase 0 acceptance).
 */
describe('theme registry', () => {
  it('has stat-sheet as the default theme', () => {
    expect(DEFAULT_THEME_ID).toBe('stat-sheet')
    expect(getTheme(DEFAULT_THEME_ID)).toBe(statSheet)
  })

  it('falls back to the default for an unknown id', () => {
    expect(getTheme('does-not-exist')).toBe(statSheet)
  })

  it('every theme defines the same set of token keys', () => {
    const expectedKeys = Object.keys(statSheet.tokens).sort()
    for (const theme of themes) {
      expect(Object.keys(theme.tokens).sort()).toEqual(expectedKeys)
    }
  })

  it('stat-sheet and arcade are distinct bundles (switching swaps values)', () => {
    const a = themesById['stat-sheet'].tokens
    const b = themesById['arcade'].tokens
    expect(a['--color-bg']).not.toBe(b['--color-bg'])
    expect(a['--color-accent']).not.toBe(b['--color-accent'])
  })
})
