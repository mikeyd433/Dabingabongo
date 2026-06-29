/**
 * Celebration animations (spec §12). Each rule carries an `animation_config`;
 * when a point is confirmed and the round's master toggle is on, the matching
 * preset fires. Tier 1 (this phase) is the built-in preset library + color
 * choices, defaulting to plain confetti. Tier 2/3 (custom particle / Lottie-GIF)
 * come later and **fall back to confetti** here until their assets render.
 */

export type AnimationPreset =
  | 'confetti'
  | 'fireworks'
  | 'raining-discs'
  | 'screen-flash'
  | 'emoji-burst'
  // Tier 2 — custom particle from an uploaded image (spec §12).
  | 'image-burst'

/** Where the effect's colors come from: a named source or a literal hex string. */
export type AnimationColor = 'theme' | 'rainbow' | string

// A type alias (not interface) so it carries an implicit index signature and slots
// straight into the `animation_config` jsonb column (Record<string, unknown>).
export type AnimationConfig = {
  /** Spec §12 tiers: 1 = preset library, 2 = custom emoji/image particle. */
  tier: number
  preset: AnimationPreset
  color: AnimationColor
  /** Glyph for `emoji-burst` (and overridable for `raining-discs`). */
  emoji?: string
  /** Public URL of the uploaded particle image for `image-burst` (tier 2). */
  imageUrl?: string
}

export const TIER1_PRESETS: AnimationPreset[] = [
  'confetti',
  'fireworks',
  'raining-discs',
  'screen-flash',
  'emoji-burst',
]

/** Every renderable preset, including tier-2 custom-particle effects. */
export const ALL_PRESETS: AnimationPreset[] = [...TIER1_PRESETS, 'image-burst']

export const PRESET_LABELS: Record<AnimationPreset, string> = {
  confetti: 'Confetti',
  fireworks: 'Fireworks',
  'raining-discs': 'Raining discs',
  'screen-flash': 'Screen flash',
  'emoji-burst': 'Emoji burst',
  'image-burst': 'Custom image',
}

export const DEFAULT_ANIMATION: AnimationConfig = {
  tier: 1,
  preset: 'confetti',
  color: 'theme',
}

// Guardrails so a heavy effect can't jank the round (spec §12).
const MAX_DURATION_MS = 1500
const MAX_PARTICLES = 180

const RAINBOW = [
  '#ef4444',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
]

/** Coerce arbitrary jsonb (or undefined) into a valid AnimationConfig. */
export function normalizeAnimation(raw: unknown): AnimationConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_ANIMATION
  const r = raw as Record<string, unknown>
  const preset = ALL_PRESETS.includes(r.preset as AnimationPreset)
    ? (r.preset as AnimationPreset)
    : DEFAULT_ANIMATION.preset
  const color =
    typeof r.color === 'string' && r.color.length > 0
      ? (r.color as AnimationColor)
      : DEFAULT_ANIMATION.color
  const tier = typeof r.tier === 'number' ? r.tier : 1
  const emoji = typeof r.emoji === 'string' ? r.emoji : undefined
  const imageUrl = typeof r.imageUrl === 'string' ? r.imageUrl : undefined
  return { tier, preset, color, emoji, imageUrl }
}

export interface ResolvedAnimation {
  preset: AnimationPreset
  colors: string[]
  emoji: string | null
  imageUrl: string | null
  durationMs: number
  particleCount: number
}

function resolveColors(
  color: AnimationColor,
  theme: { accent: string; winner: string },
): string[] {
  if (color === 'rainbow') return RAINBOW
  if (color === 'theme') return [theme.accent, theme.winner]
  if (typeof color === 'string' && color.startsWith('#')) return [color]
  return [theme.accent, theme.winner]
}

/**
 * Resolve a stored config (against the active theme's colors) into the concrete
 * inputs the canvas engine needs, applying the performance caps. Unknown presets
 * — and a `image-burst` with no uploaded image yet — fall back to confetti
 * (graceful degradation, spec §12).
 */
export function resolveAnimation(
  raw: unknown,
  theme: { accent: string; winner: string },
): ResolvedAnimation {
  const cfg = normalizeAnimation(raw)
  let preset: AnimationPreset = ALL_PRESETS.includes(cfg.preset)
    ? cfg.preset
    : 'confetti'
  // The custom-image effect needs an image; without one, fall back.
  if (preset === 'image-burst' && !cfg.imageUrl) preset = 'confetti'

  const emoji =
    preset === 'emoji-burst'
      ? cfg.emoji || '🎉'
      : preset === 'raining-discs'
        ? cfg.emoji || '🥏'
        : null

  const durationMs = Math.min(
    preset === 'screen-flash' ? 450 : 1200,
    MAX_DURATION_MS,
  )
  const particleCount = Math.min(
    preset === 'screen-flash' ? 0 : preset === 'fireworks' ? 90 : 120,
    MAX_PARTICLES,
  )

  return {
    preset,
    colors: resolveColors(cfg.color, theme),
    emoji,
    imageUrl: preset === 'image-burst' ? (cfg.imageUrl ?? null) : null,
    durationMs,
    particleCount,
  }
}
