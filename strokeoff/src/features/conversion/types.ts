import type { ConversionMode } from '@/types'

/** A tier band: points at or above `minPoints` deduct `strokes` (step function). */
export interface TierBand {
  minPoints: number
  strokes: number
}

export interface TierConfig {
  tiers: TierBand[]
}

export interface RatioConfig {
  /** Every N points = 1 stroke off. */
  pointsPerStroke: number
}

export type ConversionConfig = TierConfig | RatioConfig

export interface Conversion {
  mode: ConversionMode
  config: ConversionConfig
}

export const DEFAULT_TIER_CONFIG: TierConfig = {
  tiers: [
    { minPoints: 0, strokes: 0 },
    { minPoints: 5, strokes: 1 },
    { minPoints: 10, strokes: 2 },
    { minPoints: 15, strokes: 3 },
  ],
}

export const DEFAULT_RATIO_CONFIG: RatioConfig = {
  pointsPerStroke: 5,
}
