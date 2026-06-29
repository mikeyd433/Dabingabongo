import type { PointEvent } from '@/types'

/**
 * Phase 10 — offline resilience. Pure helpers for the offline write queue and the
 * connection indicator. No IndexedDB or React in here so the decisions (what to
 * retry, how to merge queued events, what to show) stay unit-testable; the IO lives
 * in `lib/offlineQueue.ts` and the wiring in `lib/offlineMutations.ts`.
 */

export type PendingMutationType = 'log' | 'edit' | 'void'

/**
 * A point-scoring RPC that failed to reach the server and is parked for replay.
 * `id` is the client-generated event UUID for a log (so replays dedupe and the
 * idempotent `log_point` RPC can't double-count — principle 6), or a synthetic
 * key for an edit/void. `params` is the exact RPC argument object.
 */
export interface PendingMutation {
  id: string
  type: PendingMutationType
  roundId: string
  rpc: string
  params: Record<string, unknown>
  /** Present for `log` so the feed/leaderboard can show the event before it syncs. */
  optimisticEvent?: PointEvent
  createdAt: number
}

/**
 * Should a failed write be queued for retry, or surfaced as a hard error?
 *
 * Transient connectivity loss (the request never reached the server) is
 * retriable. A real server response — a PostgREST/Supabase error with a `code`
 * or HTTP `status` (permission denied, validation) — is not: replaying it would
 * fail identically, so we let it throw.
 */
export function isRetriableNetworkError(err: unknown): boolean {
  if (err == null) return false
  // supabase-js / undici throw a TypeError ("Failed to fetch", "fetch failed",
  // Safari's "Load failed") when the request never got a response.
  if (err instanceof TypeError) return true

  const e = err as {
    code?: unknown
    status?: unknown
    message?: unknown
    name?: unknown
  }
  if (e.name === 'AbortError') return false
  // A non-empty string code or numeric HTTP status means the server answered.
  if (typeof e.code === 'string' && e.code.length > 0) return false
  if (typeof e.status === 'number' && e.status > 0) return false

  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : ''
  return (
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  )
}

/** The optimistic point events carried by queued `log` mutations. */
export function pendingLogEvents(pending: PendingMutation[]): PointEvent[] {
  return pending
    .filter((m): m is PendingMutation & { optimisticEvent: PointEvent } =>
      m.type === 'log' && Boolean(m.optimisticEvent),
    )
    .map((m) => m.optimisticEvent)
}

/**
 * Overlay still-queued events onto the server ledger so they stay visible while
 * offline (and survive a reload). Dedupe by event id — once a queued log syncs,
 * the server returns the same id, so this never double-counts — and keep the
 * query's newest-first ordering.
 */
export function mergePendingEvents(
  serverEvents: PointEvent[],
  pending: PointEvent[],
): PointEvent[] {
  if (pending.length === 0) return serverEvents
  const seen = new Set(serverEvents.map((e) => e.id))
  const extra = pending.filter((e) => !seen.has(e.id))
  if (extra.length === 0) return serverEvents
  return [...extra, ...serverEvents].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )
}

export interface ConnectionState {
  online: boolean
  /** Number of writes parked in the offline queue. */
  queued: number
}

/** Human label for the header connection indicator. */
export function connectionLabel(state: ConnectionState): string {
  if (!state.online) {
    return state.queued > 0 ? `Offline · ${state.queued} queued` : 'Offline'
  }
  if (state.queued > 0) {
    return state.queued === 1 ? 'Syncing 1…' : `Syncing ${state.queued}…`
  }
  return 'Online'
}
