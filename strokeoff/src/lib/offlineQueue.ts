import type { PendingMutation } from '@/features/offline/pending'

/**
 * Phase 10 — durable offline write queue. Point logs/edits/voids that can't reach
 * the server are persisted here and replayed on reconnect (`lib/offlineMutations.ts`).
 *
 * Backed by IndexedDB so the queue survives a reload/app close on a patchy course.
 * An in-memory mirror is the synchronous source of truth for reads (it powers
 * `useSyncExternalStore` snapshots); writes update the mirror and persist to IDB.
 * Where IndexedDB is unavailable (tests/jsdom, private-mode failures) it falls back
 * to memory-only and still behaves correctly within the session.
 */

const DB_NAME = 'stroke-off'
const STORE = 'pending-mutations'
const VERSION = 1

const EMPTY: PendingMutation[] = []

let mirror: PendingMutation[] | null = null
let memoryOnly = false
let hydration: Promise<void> | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function hydrate(): Promise<void> {
  if (mirror !== null) return
  if (hydration) return hydration
  hydration = (async () => {
    if (!idbAvailable()) {
      memoryOnly = true
      mirror = []
      return
    }
    try {
      const db = await openDb()
      const tx = db.transaction(STORE, 'readonly')
      const all = await new Promise<PendingMutation[]>((resolve, reject) => {
        const req = tx.objectStore(STORE).getAll()
        req.onsuccess = () => resolve(req.result as PendingMutation[])
        req.onerror = () => reject(req.error)
      })
      mirror = all
    } catch {
      // Private mode or a blocked DB — degrade to in-memory rather than crash.
      memoryOnly = true
      mirror = []
    }
  })()
  return hydration
}

async function persistPut(m: PendingMutation): Promise<void> {
  if (memoryOnly || !idbAvailable()) return
  try {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(m)
    await txDone(tx)
  } catch {
    memoryOnly = true
  }
}

async function persistDelete(id: string): Promise<void> {
  if (memoryOnly || !idbAvailable()) return
  try {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    await txDone(tx)
  } catch {
    memoryOnly = true
  }
}

/** Subscribe to queue changes (for `useSyncExternalStore`); triggers hydration. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  void hydrate().then(notify)
  return () => {
    listeners.delete(listener)
  }
}

/** Synchronous current queue contents — empty until hydration resolves. */
export function getSnapshot(): PendingMutation[] {
  return mirror ?? EMPTY
}

/** Add (or replace, by id) a parked mutation. Idempotent on `id`. */
export async function enqueue(m: PendingMutation): Promise<void> {
  await hydrate()
  mirror = [...(mirror ?? []).filter((x) => x.id !== m.id), m]
  await persistPut(m)
  notify()
}

/** Remove a mutation once it has been replayed (or is unrecoverable). */
export async function dequeue(id: string): Promise<void> {
  await hydrate()
  mirror = (mirror ?? []).filter((x) => x.id !== id)
  await persistDelete(id)
  notify()
}

/** All parked mutations, oldest first (replay order). */
export async function list(): Promise<PendingMutation[]> {
  await hydrate()
  return [...(mirror ?? [])].sort((a, b) => a.createdAt - b.createdAt)
}

/** Test/reset helper — clears the queue (memory + IDB). */
export async function clearQueue(): Promise<void> {
  await hydrate()
  mirror = []
  if (!memoryOnly && idbAvailable()) {
    try {
      const db = await openDb()
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      await txDone(tx)
    } catch {
      memoryOnly = true
    }
  }
  notify()
}
