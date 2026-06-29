import { describe, expect, it } from 'vitest'
import { buildLeaderboard, eventValue, tallyPoints } from './leaderboard'
import type { PointEvent, RoundPlayer } from '@/types'

function player(partial: Partial<RoundPlayer> & { id: string }): RoundPlayer {
  return {
    round_id: 'r',
    profile_id: partial.id,
    display_name: partial.id,
    is_guest: false,
    managed_by: null,
    roster_status: 'active',
    joined_at: '2026-06-29T00:00:00Z',
    regular_strokes: null,
    score_confirmed: false,
    final_adjusted: null,
    final_rank: null,
    is_winner: false,
    claim_token: null,
    claim_token_expires_at: null,
    claimed: false,
    ...partial,
  }
}

function event(partial: Partial<PointEvent> & { subject_player_id: string }): PointEvent {
  return {
    id: Math.random().toString(36).slice(2),
    round_id: 'r',
    rule_id: 'rule',
    rule_name_snapshot: 'Rule',
    points_snapshot: 1,
    count: 1,
    logged_by: 'u',
    edited_at: null,
    voided: false,
    void_reason: null,
    created_at: '2026-06-29T00:00:00Z',
    ...partial,
  }
}

describe('eventValue', () => {
  it('multiplies count by snapshotted points', () => {
    expect(eventValue(event({ subject_player_id: 'a', count: 3, points_snapshot: 2 }))).toBe(6)
  })

  it('counts voided events as zero', () => {
    expect(
      eventValue(event({ subject_player_id: 'a', count: 3, points_snapshot: 2, voided: true })),
    ).toBe(0)
  })
})

describe('tallyPoints', () => {
  it('sums non-voided events per subject', () => {
    const totals = tallyPoints([
      event({ subject_player_id: 'a', count: 2, points_snapshot: 1 }),
      event({ subject_player_id: 'a', count: 1, points_snapshot: 3 }),
      event({ subject_player_id: 'b', count: 1, points_snapshot: 5 }),
      event({ subject_player_id: 'b', count: 9, points_snapshot: 1, voided: true }),
    ])
    expect(totals.get('a')).toBe(5)
    expect(totals.get('b')).toBe(5)
  })
})

describe('buildLeaderboard', () => {
  it('ranks active players by points, highest first, defaulting to 0', () => {
    const players = [player({ id: 'a' }), player({ id: 'b' }), player({ id: 'c' })]
    const events = [
      event({ subject_player_id: 'a', count: 1, points_snapshot: 2 }),
      event({ subject_player_id: 'b', count: 3, points_snapshot: 2 }),
    ]
    const board = buildLeaderboard(players, events)
    expect(board.map((r) => [r.player.id, r.points, r.rank])).toEqual([
      ['b', 6, 1],
      ['a', 2, 2],
      ['c', 0, 3],
    ])
  })

  it('gives tied players the same rank (1,2,2,4) and excludes players who left', () => {
    const players = [
      player({ id: 'a', joined_at: '2026-06-29T00:00:01Z' }),
      player({ id: 'b', joined_at: '2026-06-29T00:00:02Z' }),
      player({ id: 'c', joined_at: '2026-06-29T00:00:03Z' }),
      player({ id: 'gone', roster_status: 'left' }),
    ]
    const events = [
      event({ subject_player_id: 'a', count: 5, points_snapshot: 1 }),
      event({ subject_player_id: 'b', count: 3, points_snapshot: 1 }),
      event({ subject_player_id: 'c', count: 3, points_snapshot: 1 }),
      event({ subject_player_id: 'gone', count: 99, points_snapshot: 1 }),
    ]
    const board = buildLeaderboard(players, events)
    expect(board.map((r) => r.player.id)).toEqual(['a', 'b', 'c'])
    expect(board.map((r) => r.rank)).toEqual([1, 2, 2])
  })
})
