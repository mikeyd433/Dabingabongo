import { DEFAULT_THEME_ID } from '@/themes'
import type { ScoringMode } from '@/types'

/**
 * Client-side app preferences (spec §11, Me → Settings). Stored in localStorage
 * and used to pre-fill round setup, so a player's usual choices are the starting
 * point. Group defaults (theme/conversion) still win where a group sets them.
 * Haptics has its own toggle in lib/haptics.ts (it's a device-level concern).
 */
export interface RoundDefaults {
  scoringMode: ScoringMode
  animations: boolean
  themeId: string
}

const KEY = 'strokeoff:prefs'

const DEFAULTS: RoundDefaults = {
  scoringMode: 'multi_phone',
  animations: true,
  themeId: DEFAULT_THEME_ID,
}

export function getRoundDefaults(): RoundDefaults {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<RoundDefaults>
    return {
      scoringMode:
        parsed.scoringMode === 'single_phone' ? 'single_phone' : 'multi_phone',
      animations: parsed.animations !== false,
      themeId:
        typeof parsed.themeId === 'string' ? parsed.themeId : DEFAULT_THEME_ID,
    }
  } catch {
    return DEFAULTS
  }
}

export function setRoundDefaults(next: Partial<RoundDefaults>): RoundDefaults {
  const merged = { ...getRoundDefaults(), ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    // Private mode / no storage — preference just won't persist.
  }
  return merged
}
