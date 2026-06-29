import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe as subscribeQueue } from './offlineQueue'
import type { ConnectionState } from '@/features/offline/pending'

function subscribeOnline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/** Live connection + offline-queue state for the header indicator (spec §4). */
export function useConnection(): ConnectionState {
  const online = useSyncExternalStore(subscribeOnline, getOnline, () => true)
  const pending = useSyncExternalStore(
    subscribeQueue,
    getSnapshot,
    getSnapshot,
  )
  return { online, queued: pending.length }
}
