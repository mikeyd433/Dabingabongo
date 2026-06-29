import { useCallback, useState } from 'react'

/**
 * One-time coach marks (spec §3). Tiny dismissible hints that show once per
 * device and are then remembered in localStorage, so the live screen can guide a
 * first-time scorer without nagging afterwards. Keyed by a stable string id.
 */
const PREFIX = 'strokeoff:coach:'

function seen(id: string): boolean {
  try {
    return localStorage.getItem(PREFIX + id) === '1'
  } catch {
    return false
  }
}

function markSeen(id: string): void {
  try {
    localStorage.setItem(PREFIX + id, '1')
  } catch {
    // No storage (private mode) — the hint just shows again next time.
  }
}

/** [shouldShow, dismiss] for a one-time coach mark. */
export function useCoachMark(id: string): [boolean, () => void] {
  const [show, setShow] = useState(() => !seen(id))
  const dismiss = useCallback(() => {
    markSeen(id)
    setShow(false)
  }, [id])
  return [show, dismiss]
}
