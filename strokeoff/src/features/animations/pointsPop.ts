import { useSyncExternalStore } from 'react'

/**
 * Tiny module store for the centered "+N" points pop (spec §12). Any code that
 * lands a point — the local logger or a Realtime-driven award to me — calls
 * `showPointsPop(amount)`; a single <PointsPop /> overlay renders the active
 * pops. Kept out of React state so imperative call sites (the scoring RPC
 * success, the award-celebration hook) can fire it without prop-drilling.
 */

export interface PointsPop {
  id: string
  amount: number
}

/** How long a "+N" stays up — tuned to sit alongside the celebration (~1.2s). */
export const POINTS_POP_MS = 1300

let pops: PointsPop[] = []
let seq = 0
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Show a big centered "+amount". No-ops for a zero/non-finite amount or on the server. */
export function showPointsPop(amount: number): void {
  if (typeof window === 'undefined') return
  if (!Number.isFinite(amount) || amount === 0) return
  const id = `pop-${(seq += 1)}`
  pops = [...pops, { id, amount }]
  emit()
  window.setTimeout(() => {
    pops = pops.filter((p) => p.id !== id)
    emit()
  }, POINTS_POP_MS)
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): PointsPop[] {
  return pops
}

/** Subscribe a component to the active pops (stable reference while unchanged). */
export function usePointsPops(): PointsPop[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Test-only: clear the queue between cases. */
export function __resetPointsPops(): void {
  pops = []
  seq = 0
  listeners.clear()
}
