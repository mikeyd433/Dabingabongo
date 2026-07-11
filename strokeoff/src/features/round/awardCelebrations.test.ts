import { describe, expect, it } from 'vitest'
import { collectNewAwards } from './awardCelebrations'
import type { PointEvent } from '@/types'

function ev(partial: Partial<PointEvent> & { id: string }): PointEvent {
  return {
    round_id: 'r1',
    subject_player_id: 'me',
    rule_id: 'multi-rule',
    rule_name_snapshot: 'Rule',
    points_snapshot: 1,
    count: 1,
    logged_by: 'other-user',
    edited_at: null,
    voided: false,
    void_reason: null,
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

const OPTS = {
  myPlayerId: 'me',
  myUserId: 'my-user',
  // 'multi-rule' and 'everyone-rule' are multi-player; anything else isn't.
  isMultiplayerRule: (id: string | null) =>
    id === 'multi-rule' || id === 'everyone-rule',
}

describe('collectNewAwards', () => {
  it('seeds without celebrating on the first (not-ready) pass', () => {
    const seen = new Set<string>()
    const events = [ev({ id: 'a' }), ev({ id: 'b' })]
    expect(collectNewAwards(events, seen, false, OPTS)).toEqual([])
    // History is now remembered, so a later ready pass ignores it.
    expect(collectNewAwards(events, seen, true, OPTS)).toEqual([])
  })

  it('celebrates a new multi-player award to me by someone else', () => {
    const seen = new Set<string>()
    collectNewAwards([], seen, false, OPTS) // seed empty
    const out = collectNewAwards(
      [ev({ id: 'x', count: 3, points_snapshot: 2 })],
      seen,
      true,
      OPTS,
    )
    expect(out).toEqual([{ eventId: 'x', ruleId: 'multi-rule', amount: 6 }])
  })

  it('skips my own logs, single-player rules, other subjects, and voided', () => {
    const seen = new Set<string>()
    collectNewAwards([], seen, false, OPTS)
    const out = collectNewAwards(
      [
        ev({ id: 'mine', logged_by: 'my-user' }), // I logged it
        ev({ id: 'single', rule_id: 'solo-rule' }), // not multiplayer
        ev({ id: 'other', subject_player_id: 'someone-else' }), // not me
        ev({ id: 'void', voided: true }), // reversed
        ev({ id: 'good' }), // qualifies
      ],
      seen,
      true,
      OPTS,
    )
    expect(out.map((a) => a.eventId)).toEqual(['good'])
  })

  it('does not celebrate the same event twice across passes', () => {
    const seen = new Set<string>()
    collectNewAwards([], seen, false, OPTS)
    const events = [ev({ id: 'once' })]
    expect(collectNewAwards(events, seen, true, OPTS)).toHaveLength(1)
    expect(collectNewAwards(events, seen, true, OPTS)).toHaveLength(0)
  })

  it('celebrates everyone-rule awards too', () => {
    const seen = new Set<string>()
    collectNewAwards([], seen, false, OPTS)
    const out = collectNewAwards(
      [ev({ id: 'e', rule_id: 'everyone-rule' })],
      seen,
      true,
      OPTS,
    )
    expect(out.map((a) => a.ruleId)).toEqual(['everyone-rule'])
  })
})
