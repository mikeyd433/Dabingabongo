/**
 * Light haptic feedback for key presses — the app is meant to work one-handed on
 * a phone outdoors (CLAUDE.md), and a short buzz confirms a tap landed without
 * looking. Progressive enhancement via the Vibration API: Android/Chrome buzz,
 * iOS Safari silently ignores it, so it's never required. A persisted preference
 * lets a future Settings toggle mute it.
 */
export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning'

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 25,
  success: [12, 40, 18],
  warning: [20, 60, 20],
}

const STORAGE_KEY = 'strokeoff:haptics'

let enabled = readPreference()

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function hapticsEnabled(): boolean {
  return enabled
}

export function setHapticsEnabled(next: boolean): void {
  enabled = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // Private mode / no storage — keep the in-memory preference.
  }
}

/** Fire a haptic pulse if supported and not muted. Safe to call anywhere. */
export function haptic(kind: HapticKind = 'light'): void {
  if (!enabled) return
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return
  }
  try {
    navigator.vibrate(PATTERNS[kind])
  } catch {
    // Some browsers throw if called without a user gesture — ignore.
  }
}
