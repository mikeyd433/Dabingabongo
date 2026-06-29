import { describe, expect, it } from 'vitest'
import {
  connectionLabel,
  isRetriableNetworkError,
  mergePendingEvents,
  pendingLogEvents,
  type PendingMutation,
} from './pending'
import type { PointEvent } from '@/types'

function event(id: string, createdAt: string): PointEvent {
  return {
    id,
    round_id: 'r1',
    subject_player_id: 'p1',
    rule_id: 'rule1',
    rule_name_snapshot: 'Birdie',
    points_snapshot: 1,
    count: 1,
    logged_by: 'p1',
    edited_at: null,
    voided: false,
    void_reason: null,
    created_at: createdAt,
  }
}

function logMutation(id: string, ev?: PointEvent): PendingMutation {
  return {
    id,
    type: 'log',
    roundId: 'r1',
    rpc: 'log_point',
    params: {},
    optimisticEvent: ev,
    createdAt: 1,
  }
}

describe('isRetriableNetworkError', () => {
  it('treats fetch TypeErrors as retriable', () => {
    expect(isRetriableNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isRetriableNetworkError(new TypeError('Load failed'))).toBe(true)
  })

  it('treats network-ish messages as retriable', () => {
    expect(isRetriableNetworkError({ message: 'network request failed' })).toBe(
      true,
    )
    expect(isRetriableNetworkError({ message: 'request timeout' })).toBe(true)
  })

  it('treats server responses (code/status) as non-retriable', () => {
    // PostgREST permission denied — replaying would fail identically.
    expect(isRetriableNetworkError({ code: '42501', message: 'denied' })).toBe(
      false,
    )
    expect(isRetriableNetworkError({ status: 403, message: 'forbidden' })).toBe(
      false,
    )
  })

  it('does not retry aborts or empty errors', () => {
    expect(isRetriableNetworkError({ name: 'AbortError' })).toBe(false)
    expect(isRetriableNetworkError(null)).toBe(false)
    expect(isRetriableNetworkError({ message: 'something odd' })).toBe(false)
  })
})

describe('pendingLogEvents', () => {
  it('returns only log mutations that carry an optimistic event', () => {
    const ev = event('e1', '2026-01-01T00:00:00Z')
    const pending: PendingMutation[] = [
      logMutation('e1', ev),
      logMutation('e2'), // no optimistic event
      { ...logMutation('x'), type: 'void' },
    ]
    expect(pendingLogEvents(pending)).toEqual([ev])
  })
})

describe('mergePendingEvents', () => {
  it('overlays queued events, newest first', () => {
    const server = [event('e1', '2026-01-01T00:00:00Z')]
    const pending = [event('e2', '2026-01-01T00:05:00Z')]
    const merged = mergePendingEvents(server, pending)
    expect(merged.map((e) => e.id)).toEqual(['e2', 'e1'])
  })

  it('dedupes by id so a synced event is never double-counted', () => {
    const shared = event('e1', '2026-01-01T00:00:00Z')
    const merged = mergePendingEvents([shared], [shared])
    expect(merged).toHaveLength(1)
  })

  it('returns the server array untouched when nothing is pending', () => {
    const server = [event('e1', '2026-01-01T00:00:00Z')]
    expect(mergePendingEvents(server, [])).toBe(server)
  })
})

describe('connectionLabel', () => {
  it('labels offline, with and without a queue', () => {
    expect(connectionLabel({ online: false, queued: 0 })).toBe('Offline')
    expect(connectionLabel({ online: false, queued: 3 })).toBe(
      'Offline · 3 queued',
    )
  })

  it('labels syncing and online', () => {
    expect(connectionLabel({ online: true, queued: 1 })).toBe('Syncing 1…')
    expect(connectionLabel({ online: true, queued: 2 })).toBe('Syncing 2…')
    expect(connectionLabel({ online: true, queued: 0 })).toBe('Online')
  })
})
