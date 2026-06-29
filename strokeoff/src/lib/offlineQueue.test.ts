import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearQueue,
  dequeue,
  enqueue,
  getSnapshot,
  list,
} from './offlineQueue'
import type { PendingMutation } from '@/features/offline/pending'

// jsdom has no IndexedDB, so the queue exercises its in-memory fallback here —
// which is exactly the behaviour we want guaranteed within a session.

function mutation(id: string, createdAt: number): PendingMutation {
  return {
    id,
    type: 'log',
    roundId: 'r1',
    rpc: 'log_point',
    params: { p_event_id: id },
    createdAt,
  }
}

describe('offlineQueue (in-memory fallback)', () => {
  beforeEach(async () => {
    await clearQueue()
  })

  it('enqueues and lists oldest-first', async () => {
    await enqueue(mutation('b', 2))
    await enqueue(mutation('a', 1))
    const all = await list()
    expect(all.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('dedupes on id (idempotent replays / repeated edits)', async () => {
    await enqueue(mutation('a', 1))
    await enqueue(mutation('a', 5))
    const all = await list()
    expect(all).toHaveLength(1)
    expect(all[0].createdAt).toBe(5)
  })

  it('dequeues a replayed mutation', async () => {
    await enqueue(mutation('a', 1))
    await enqueue(mutation('b', 2))
    await dequeue('a')
    expect((await list()).map((m) => m.id)).toEqual(['b'])
  })

  it('reflects current contents in the synchronous snapshot', async () => {
    await enqueue(mutation('a', 1))
    expect(getSnapshot().map((m) => m.id)).toEqual(['a'])
    await clearQueue()
    expect(getSnapshot()).toEqual([])
  })
})
