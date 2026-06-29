import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { flushQueue } from './offlineMutations'

/**
 * Phase 10 — reconnect sync. Mounted once (in Layout): when the browser comes back
 * online (or on load, in case we started with a parked queue), replay the offline
 * write queue and refetch active queries so the live round catches up. The RPCs are
 * idempotent on the event id, so a replay that already applied is a harmless no-op.
 */
export function useOfflineSync(): void {
  const qc = useQueryClient()
  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      const replayed = await flushQueue()
      if (cancelled) return
      // Refetch even when nothing replayed: coming back online, our cached round
      // data may be stale versus what others logged while we were away.
      void qc.invalidateQueries({ type: 'active' })
      return replayed
    }

    window.addEventListener('online', sync)
    // Attempt once on mount — handles "opened the app already holding a queue".
    void sync()

    return () => {
      cancelled = true
      window.removeEventListener('online', sync)
    }
  }, [qc])
}
