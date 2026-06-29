import { describe, expect, it } from 'vitest'
import { groupLiveEvents } from './feed'
import type { PointEvent } from '@/types'

function ev(overrides: Partial<PointEvent>): PointEvent {
  return {
    id: 'e1',
    round_id: 'r1',
    subject_player_id: 'p1',
    rule_id: 'birdie',
    rule_name_snapshot: 'Birdie',
    points_snapshot: 1,
    count: 1,
    logged_by: 'p1',
    edited_at: null,
    voided: false,
    void_reason: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('groupLiveEvents', () => {
  it('stacks repeated same-rule events for a player into one group', () => {
    // Newest-first, as the ledger query returns them.
    const groups = groupLiveEvents([
      ev({ id: 'e3', created_at: '2026-01-01T00:03:00Z' }),
      ev({ id: 'e2', created_at: '2026-01-01T00:02:00Z' }),
      ev({ id: 'e1', created_at: '2026-01-01T00:01:00Z' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(3)
    // Latest event drives the controls + timestamp.
    expect(groups[0].latestId).toBe('e3')
    expect(groups[0].latestAt).toBe('2026-01-01T00:03:00Z')
  })

  it('sums edited counts, not just event tallies', () => {
    const groups = groupLiveEvents([
      ev({ id: 'e2', count: 2, created_at: '2026-01-01T00:02:00Z' }),
      ev({ id: 'e1', count: 3, created_at: '2026-01-01T00:01:00Z' }),
    ])
    expect(groups[0].count).toBe(5)
    expect(groups[0].latestCount).toBe(2)
  })

  it('keeps different rules and different players in separate groups', () => {
    const groups = groupLiveEvents([
      ev({ id: 'a', subject_player_id: 'p1', rule_id: 'birdie' }),
      ev({ id: 'b', subject_player_id: 'p2', rule_id: 'birdie' }),
      ev({ id: 'c', subject_player_id: 'p1', rule_id: 'parked', rule_name_snapshot: 'Parked' }),
    ])
    expect(groups).toHaveLength(3)
  })

  it('drops voided events from the live feed', () => {
    const groups = groupLiveEvents([
      ev({ id: 'e2', voided: true, created_at: '2026-01-01T00:02:00Z' }),
      ev({ id: 'e1', created_at: '2026-01-01T00:01:00Z' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].count).toBe(1)
    expect(groups[0].latestId).toBe('e1')
  })

  it('flags a group as edited if any of its events was edited', () => {
    const groups = groupLiveEvents([
      ev({ id: 'e2', created_at: '2026-01-01T00:02:00Z' }),
      ev({ id: 'e1', edited_at: '2026-01-01T00:01:30Z' }),
    ])
    expect(groups[0].edited).toBe(true)
  })

  it('orders groups by newest activity first', () => {
    const groups = groupLiveEvents([
      ev({ id: 'b', rule_id: 'parked', rule_name_snapshot: 'Parked', created_at: '2026-01-01T00:05:00Z' }),
      ev({ id: 'a', rule_id: 'birdie', created_at: '2026-01-01T00:01:00Z' }),
    ])
    expect(groups.map((g) => g.ruleName)).toEqual(['Parked', 'Birdie'])
  })
})
