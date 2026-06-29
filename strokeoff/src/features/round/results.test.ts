import { describe, expect, it } from 'vitest'
import {
  closestToTarget,
  computeResults,
  parseConversion,
  randomPick,
} from './results'
import type { PointEvent, RoundPlayer } from '@/types'

function player(
  partial: Partial<RoundPlayer> & { id: string },
): RoundPlayer {
  return {
    round_id: 'r',
    profile_id: partial.id,
    display_name: partial.id,
    is_guest: false,
    managed_by: null,
    roster_status: 'active',
    joined_at: '2026-06-29T00:00:00Z',
    regular_strokes: null,
    claim_token: null,
    claim_token_expires_at: null,
    claimed: false,
    ...partial,
  }
}

function event(subject: string, points: number, count = 1): PointEvent {
  return {
    id: `${subject}-${points}-${count}-${Math.random()}`,
    round_id: 'r',
    subject_player_id: subject,
    rule_id: 'rule',
    rule_name_snapshot: 'Rule',
    points_snapshot: points,
    count,
    logged_by: 'u',
    edited_at: null,
    voided: false,
    void_reason: null,
    created_at: '2026-06-29T00:00:00Z',
  }
}

// Ratio: every 5 points = 1 stroke off.
const ratio = { mode: 'ratio', config: { pointsPerStroke: 5 } }

describe('parseConversion', () => {
  it('accepts a valid snapshot and rejects junk', () => {
    expect(parseConversion(ratio)?.mode).toBe('ratio')
    expect(parseConversion(null)).toBeNull()
    expect(parseConversion({ mode: 'nope' })).toBeNull()
    expect(parseConversion({ mode: 'tier' })).toBeNull()
  })
})

describe('computeResults', () => {
  it('is preliminary (points order, no ranks) until every score is entered', () => {
    const players = [
      player({ id: 'a', regular_strokes: 54 }),
      player({ id: 'b' }), // no score yet
    ]
    const events = [event('a', 1, 10), event('b', 1, 4)]
    const res = computeResults(players, events, ratio)
    expect(res.finalsReady).toBe(false)
    expect(res.winner).toBeNull()
    expect(res.rows.map((r) => r.player.id)).toEqual(['a', 'b']) // 10 > 4 points
    expect(res.rows.every((r) => r.rank === null)).toBe(true)
  })

  it('computes deductions, adjusted finals, ranks, and a sole winner', () => {
    const players = [
      player({ id: 'a', regular_strokes: 54 }), // 10 pts -> -2 -> 52
      player({ id: 'b', regular_strokes: 50 }), // 4 pts  -> -0 -> 50 (winner)
      player({ id: 'c', regular_strokes: 60 }), // 20 pts -> -4 -> 56
    ]
    const events = [event('a', 1, 10), event('b', 1, 4), event('c', 1, 20)]
    const res = computeResults(players, events, ratio)
    expect(res.finalsReady).toBe(true)
    const byId = Object.fromEntries(res.rows.map((r) => [r.player.id, r]))
    expect(byId.a.strokesOff).toBe(2)
    expect(byId.a.adjusted).toBe(52)
    expect(byId.b.adjusted).toBe(50)
    expect(byId.c.adjusted).toBe(56)
    expect(res.rows.map((r) => r.player.id)).toEqual(['b', 'a', 'c']) // ascending
    expect(res.rows.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(res.winner?.player.id).toBe('b')
    expect(res.winner?.byTiebreak).toBe(false)
  })

  it('flags a tie for the win and resolves it only with a recorded winner', () => {
    const players = [
      player({ id: 'a', regular_strokes: 52 }), // 10 pts -> -2 -> 50
      player({ id: 'b', regular_strokes: 50 }), // 0 pts  -> -0 -> 50
    ]
    const events = [event('a', 1, 10)]
    const tied = computeResults(players, events, ratio)
    expect(tied.tiedForWin.map((r) => r.player.id).sort()).toEqual(['a', 'b'])
    expect(tied.winner).toBeNull()
    expect(tied.rows.map((r) => r.rank)).toEqual([1, 1])

    const resolved = computeResults(players, events, ratio, 'b')
    expect(resolved.winner?.player.id).toBe('b')
    expect(resolved.winner?.byTiebreak).toBe(true)
  })

  it('excludes players who left the round', () => {
    const players = [
      player({ id: 'a', regular_strokes: 50 }),
      player({ id: 'gone', roster_status: 'left', regular_strokes: 10 }),
    ]
    const res = computeResults(players, [], ratio)
    expect(res.rows.map((r) => r.player.id)).toEqual(['a'])
  })
})

describe('tie-break helpers', () => {
  it('closestToTarget picks the nearest value', () => {
    expect(
      closestToTarget(
        [
          { playerId: 'a', value: 7 },
          { playerId: 'b', value: 12 },
        ],
        10,
      ),
    ).toBe('b')
  })

  it('randomPick maps the RNG into range', () => {
    expect(randomPick(['a', 'b', 'c'], 0)).toBe('a')
    expect(randomPick(['a', 'b', 'c'], 0.99)).toBe('c')
    expect(randomPick([], 0.5)).toBeNull()
  })
})
