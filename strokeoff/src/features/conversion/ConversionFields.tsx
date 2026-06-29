import { useState } from 'react'
import { TextInput } from '@/components/TextInput'
import { Select } from '@/components/Select'
import { Button } from '@/components/Button'
import { strokesForPoints } from './convert'
import {
  DEFAULT_RATIO_CONFIG,
  DEFAULT_TIER_CONFIG,
  type ConversionConfig,
  type RatioConfig,
  type TierConfig,
} from './types'
import type { ConversionMode } from '@/types'

export interface ConversionValue {
  mode: ConversionMode
  config: ConversionConfig
}

interface ConversionFieldsProps {
  initial: ConversionValue
  /** Fires on every edit with the current mode + config. */
  onChange: (value: ConversionValue) => void
}

/**
 * Controlled editor for a tier/ratio conversion (spec §8). Holds both a tier and
 * a ratio draft internally so switching modes is lossless; emits the active one.
 */
export function ConversionFields({ initial, onChange }: ConversionFieldsProps) {
  const [mode, setMode] = useState<ConversionMode>(initial.mode)
  const [tier, setTier] = useState<TierConfig>(
    initial.mode === 'tier'
      ? (initial.config as TierConfig)
      : DEFAULT_TIER_CONFIG,
  )
  const [ratio, setRatio] = useState<RatioConfig>(
    initial.mode === 'ratio'
      ? (initial.config as RatioConfig)
      : DEFAULT_RATIO_CONFIG,
  )

  function emit(
    next: Partial<{
      mode: ConversionMode
      tier: TierConfig
      ratio: RatioConfig
    }>,
  ) {
    const m = next.mode ?? mode
    const t = next.tier ?? tier
    const r = next.ratio ?? ratio
    onChange({ mode: m, config: m === 'tier' ? t : r })
  }

  const config = mode === 'tier' ? tier : ratio

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2">
        <span className="font-label text-sm text-muted">Mode</span>
        <Select
          value={mode}
          onChange={(e) => {
            const m = e.target.value as ConversionMode
            setMode(m)
            emit({ mode: m })
          }}
        >
          <option value="tier">Tier table</option>
          <option value="ratio">Ratio</option>
        </Select>
      </label>

      {mode === 'tier' ? (
        <div className="flex flex-col gap-2">
          {tier.tiers.map((band, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-28 font-label text-xs text-muted">
                {band.minPoints}+ points
              </span>
              <TextInput
                type="number"
                inputMode="numeric"
                aria-label={`Strokes for ${band.minPoints}+ points`}
                value={String(band.strokes)}
                onChange={(e) => {
                  const next = {
                    tiers: tier.tiers.map((b, j) =>
                      j === i
                        ? { ...b, strokes: Number(e.target.value) || 0 }
                        : b,
                    ),
                  }
                  setTier(next)
                  emit({ tier: next })
                }}
                className="w-20"
              />
              <span className="font-label text-xs text-muted">strokes off</span>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const last = tier.tiers[tier.tiers.length - 1]
              const next = {
                tiers: [
                  ...tier.tiers,
                  {
                    minPoints: (last?.minPoints ?? 0) + 5,
                    strokes: (last?.strokes ?? 0) + 1,
                  },
                ],
              }
              setTier(next)
              emit({ tier: next })
            }}
          >
            Add band
          </Button>
        </div>
      ) : (
        <label className="flex items-center gap-2">
          <span className="font-label text-sm text-muted">
            Points per stroke
          </span>
          <TextInput
            type="number"
            inputMode="numeric"
            value={String(ratio.pointsPerStroke)}
            onChange={(e) => {
              const next = { pointsPerStroke: Number(e.target.value) || 0 }
              setRatio(next)
              emit({ ratio: next })
            }}
            className="w-24"
          />
        </label>
      )}

      <p className="font-numeral text-xs text-muted">
        Preview: 12 points → −{strokesForPoints(mode, config, 12)} strokes
      </p>
    </div>
  )
}
