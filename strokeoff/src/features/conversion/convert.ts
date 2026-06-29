import type { ConversionMode } from '@/types'
import type { ConversionConfig, RatioConfig, TierConfig } from './types'

function isRatio(
  mode: ConversionMode,
  config: ConversionConfig,
): config is RatioConfig {
  return mode === 'ratio' && 'pointsPerStroke' in config
}

/**
 * Maps a player's side-game points to strokes deducted (spec §8). Pure — the
 * round-end calculation (Phase 6) and the editor preview both use this.
 *
 * - tier: step function; the highest band whose `minPoints` is met wins.
 * - ratio: floor(points / pointsPerStroke).
 */
export function strokesForPoints(
  mode: ConversionMode,
  config: ConversionConfig,
  points: number,
): number {
  const pts = Math.max(0, Math.floor(points))

  if (isRatio(mode, config)) {
    const per = config.pointsPerStroke
    if (!per || per <= 0) return 0
    return Math.floor(pts / per)
  }

  const tiers = [...(config as TierConfig).tiers].sort(
    (a, b) => a.minPoints - b.minPoints,
  )
  let strokes = 0
  for (const band of tiers) {
    if (pts >= band.minPoints) strokes = band.strokes
  }
  return strokes
}
