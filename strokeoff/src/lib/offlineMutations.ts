import { supabase } from './supabase'
import { dequeue, enqueue, list } from './offlineQueue'
import {
  isRetriableNetworkError,
  type PendingMutation,
} from '@/features/offline/pending'

/**
 * Phase 10 — the bridge between the scoring hooks and the offline queue. A write
 * is attempted immediately; on a transient network failure it is parked in
 * IndexedDB (`offlineQueue`) and replayed by `flushQueue` on reconnect. The
 * underlying RPCs are idempotent on the event id, so replays never double-count.
 */

export interface RpcRequest {
  type: PendingMutation['type']
  roundId: string
  rpc: string
  params: Record<string, unknown>
  optimisticEvent?: PendingMutation['optimisticEvent']
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Run an RPC, queuing it for later if the network is the only thing that failed.
 * Returns `{ queued: true }` when parked; rethrows real (server) errors so the
 * caller can roll back its optimistic update.
 */
export async function callRpcOrQueue(
  req: RpcRequest,
  id: string,
): Promise<{ queued: boolean }> {
  try {
    if (isOffline()) {
      // Skip the doomed round-trip; queue straight away.
      await park(req, id)
      return { queued: true }
    }
    const { error } = await supabase.rpc(req.rpc, req.params)
    if (error) throw error
    return { queued: false }
  } catch (err) {
    if (isRetriableNetworkError(err) || isOffline()) {
      await park(req, id)
      return { queued: true }
    }
    throw err
  }
}

async function park(req: RpcRequest, id: string): Promise<void> {
  await enqueue({
    id,
    type: req.type,
    roundId: req.roundId,
    rpc: req.rpc,
    params: req.params,
    optimisticEvent: req.optimisticEvent,
    createdAt: Date.now(),
  })
}

let flushing = false

/**
 * Replay every parked mutation in order. Stops early (leaving the rest queued) if
 * the network is still down; drops a mutation that fails with a permanent server
 * error so one bad write can't wedge the queue. Returns the number replayed.
 */
export async function flushQueue(): Promise<number> {
  if (flushing || isOffline()) return 0
  flushing = true
  let replayed = 0
  try {
    const pending = await list()
    for (const m of pending) {
      try {
        const { error } = await supabase.rpc(m.rpc, m.params)
        if (error) throw error
        await dequeue(m.id)
        replayed += 1
      } catch (err) {
        if (isRetriableNetworkError(err) || isOffline()) break
        // Permanent failure (permission/validation): drop it so it can't block
        // the rest of the queue forever.
        await dequeue(m.id)
      }
    }
  } finally {
    flushing = false
  }
  return replayed
}
