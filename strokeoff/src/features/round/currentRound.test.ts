import { describe, expect, it } from 'vitest'
import { selectCurrentRound } from './currentRound'
import type { Round } from '@/types'

function round(partial: Partial<Round>): Round {
  return {
    id: 'r',
    group_id: 'g',
    code: 'ABCDE',
    course_name: '',
    played_on: '2026-06-29',
    scoring_mode: 'multi_phone',
    status: 'lobby',
    conversion_snapshot: null,
    theme_snapshot: null,
    animations_enabled: true,
    par: null,
    tiebreak_winner_id: null,
    tiebreak_method: null,
    created_by: 'u',
    started_at: null,
    ended_at: null,
    created_at: '2026-06-29T00:00:00Z',
    ...partial,
  }
}

describe('selectCurrentRound', () => {
  it('returns null when nothing is joinable', () => {
    expect(selectCurrentRound([])).toBeNull()
    expect(
      selectCurrentRound([round({ status: 'complete' }), null, undefined]),
    ).toBeNull()
  })

  it('ignores completed rounds and picks the newest joinable one', () => {
    const older = round({ id: 'old', created_at: '2026-06-01T00:00:00Z' })
    const newer = round({
      id: 'new',
      status: 'active',
      created_at: '2026-06-20T00:00:00Z',
    })
    const done = round({ id: 'done', status: 'complete' })
    expect(selectCurrentRound([older, done, newer])?.id).toBe('new')
  })
})
