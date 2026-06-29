import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ANIMATION,
  normalizeAnimation,
  resolveAnimation,
} from './types'

const theme = { accent: '#1d4ed8', winner: '#15803d' }

describe('normalizeAnimation', () => {
  it('defaults junk/empty to plain confetti', () => {
    expect(normalizeAnimation(null)).toEqual(DEFAULT_ANIMATION)
    expect(normalizeAnimation({ preset: 'nope' }).preset).toBe('confetti')
  })

  it('keeps a valid preset, color, and emoji', () => {
    const cfg = normalizeAnimation({
      preset: 'emoji-burst',
      color: 'rainbow',
      emoji: '🔥',
    })
    expect(cfg.preset).toBe('emoji-burst')
    expect(cfg.color).toBe('rainbow')
    expect(cfg.emoji).toBe('🔥')
  })
})

describe('resolveAnimation', () => {
  it('uses theme colors for a theme-colored confetti default', () => {
    const r = resolveAnimation(null, theme)
    expect(r.preset).toBe('confetti')
    expect(r.colors).toEqual([theme.accent, theme.winner])
    expect(r.emoji).toBeNull()
  })

  it('supplies the disc glyph for raining-discs and honors a custom emoji', () => {
    expect(resolveAnimation({ preset: 'raining-discs' }, theme).emoji).toBe('🥏')
    expect(
      resolveAnimation({ preset: 'emoji-burst', emoji: '🦄' }, theme).emoji,
    ).toBe('🦄')
  })

  it('resolves a hex color and rainbow', () => {
    expect(
      resolveAnimation({ preset: 'confetti', color: '#ff0000' }, theme).colors,
    ).toEqual(['#ff0000'])
    expect(
      resolveAnimation({ preset: 'confetti', color: 'rainbow' }, theme).colors
        .length,
    ).toBeGreaterThan(2)
  })

  it('renders a custom image burst only once an image is uploaded', () => {
    // No image yet → graceful confetti fallback.
    expect(resolveAnimation({ preset: 'image-burst' }, theme).preset).toBe(
      'confetti',
    )
    // With an image → renders the custom burst and carries the URL through.
    const withImage = resolveAnimation(
      { preset: 'image-burst', tier: 2, imageUrl: 'https://x/p.png' },
      theme,
    )
    expect(withImage.preset).toBe('image-burst')
    expect(withImage.imageUrl).toBe('https://x/p.png')
  })

  it('falls back to confetti for an unknown preset', () => {
    expect(resolveAnimation({ preset: 'lottie-thing' }, theme).preset).toBe(
      'confetti',
    )
  })

  it('caps duration and particle count', () => {
    const r = resolveAnimation({ preset: 'confetti' }, theme)
    expect(r.durationMs).toBeLessThanOrEqual(1500)
    expect(r.particleCount).toBeLessThanOrEqual(180)
    // screen-flash has no particles
    expect(resolveAnimation({ preset: 'screen-flash' }, theme).particleCount).toBe(0)
  })
})
