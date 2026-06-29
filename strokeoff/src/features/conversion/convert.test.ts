import { describe, expect, it } from 'vitest'
import { strokesForPoints } from './convert'
import { DEFAULT_RATIO_CONFIG, DEFAULT_TIER_CONFIG } from './types'

describe('strokesForPoints — tier', () => {
  it('returns the highest band whose minPoints is met', () => {
    expect(strokesForPoints('tier', DEFAULT_TIER_CONFIG, 0)).toBe(0)
    expect(strokesForPoints('tier', DEFAULT_TIER_CONFIG, 4)).toBe(0)
    expect(strokesForPoints('tier', DEFAULT_TIER_CONFIG, 5)).toBe(1)
    expect(strokesForPoints('tier', DEFAULT_TIER_CONFIG, 12)).toBe(2)
    expect(strokesForPoints('tier', DEFAULT_TIER_CONFIG, 100)).toBe(3)
  })

  it('is order-independent (sorts bands)', () => {
    const shuffled = {
      tiers: [
        { minPoints: 10, strokes: 2 },
        { minPoints: 0, strokes: 0 },
        { minPoints: 5, strokes: 1 },
      ],
    }
    expect(strokesForPoints('tier', shuffled, 7)).toBe(1)
  })
})

describe('strokesForPoints — ratio', () => {
  it('floors points / pointsPerStroke', () => {
    expect(strokesForPoints('ratio', DEFAULT_RATIO_CONFIG, 4)).toBe(0)
    expect(strokesForPoints('ratio', DEFAULT_RATIO_CONFIG, 5)).toBe(1)
    expect(strokesForPoints('ratio', DEFAULT_RATIO_CONFIG, 14)).toBe(2)
  })

  it('guards against a zero/invalid ratio', () => {
    expect(strokesForPoints('ratio', { pointsPerStroke: 0 }, 10)).toBe(0)
  })
})

describe('strokesForPoints — input hygiene', () => {
  it('clamps negative and fractional points', () => {
    expect(strokesForPoints('tier', DEFAULT_TIER_CONFIG, -3)).toBe(0)
    expect(strokesForPoints('ratio', DEFAULT_RATIO_CONFIG, 5.9)).toBe(1)
  })

  it('does not crash on a malformed/mismatched config (returns 0)', () => {
    // A `tier` snapshot whose config has no `tiers` array, or a mode/config
    // mismatch, must degrade to no deduction rather than throwing.
    // @ts-expect-error — deliberately malformed config
    expect(strokesForPoints('tier', {}, 20)).toBe(0)
    // @ts-expect-error — ratio-shaped config under tier mode
    expect(strokesForPoints('tier', { pointsPerStroke: 5 }, 20)).toBe(0)
  })
})
